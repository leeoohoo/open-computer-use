"""
Employee Delegation Service — Allows agents to synchronously invoke
another employee (scheduled AI chat agent) as a tool call mid-execution.

The calling agent blocks until the delegate completes, then receives
the result summary as a tool result. This enables a "company of employees"
where agents delegate subtasks to specialists in real-time.

Follows the same closure-based tool factory pattern as shared_memory.py.
No new database tables — delegates are stored in room_settings.schedule.delegates.
"""

import asyncio
import contextvars
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.services.database import DatabaseService
from app.services.vm_control import vm_control_service
from app.services.agent_billing import agent_billing_service
from app.providers.provider_factory import ProviderFactory

logger = logging.getLogger(__name__)

db_service = DatabaseService()
provider_factory = ProviderFactory()

# ── Constants ──
MAX_DELEGATION_DEPTH = 3
DELEGATION_TIMEOUT = 300  # 5 minutes per delegation
DELEGATE_LOCK_TIMEOUT = 5  # seconds to wait for delegate's machine lock

# ── Call stack tracking ──
# Each async task gets its own copy via contextvars, preventing cross-task leakage.
_delegation_stack: contextvars.ContextVar[List[str]] = contextvars.ContextVar(
    "delegation_stack", default=[]
)


# ── Helpers ──

async def _get_schedule_for_chat(chat_id: str) -> Optional[Dict]:
    """Read a chat's schedule config from room_settings."""
    try:
        chat = await db_service.get_chat(chat_id)
        if not chat:
            return None
        rs = chat.get("room_settings", {})
        if isinstance(rs, str):
            rs = json.loads(rs)
        return rs.get("schedule", {})
    except Exception as e:
        logger.warning(f"Failed to get schedule for chat {chat_id}: {e}")
        return None


async def get_delegates_for_chat(chat_id: str) -> List[Dict]:
    """Get the list of delegates configured for an employee.

    Returns list of {chat_id, title, role}.
    """
    schedule = await _get_schedule_for_chat(chat_id)
    if not schedule:
        return []
    return schedule.get("delegates", [])


async def _get_machine_connection_info(
    machine_id: str, user_id: str
) -> Optional[Dict]:
    """Get machine connection info — mirrors scheduled_executor._get_machine_connection_info."""
    try:
        # Check Electron machine
        electron_session = vm_control_service.session_data.get(machine_id, {})
        if electron_session.get("is_electron"):
            system_info = electron_session.get("system_info", {})
            return {
                "public_ip": "electron",
                "agent_port": 0,
                "vnc_port": 0,
                "websocket_port": 0,
                "machine_name": electron_session.get("machine_name", "Desktop"),
                "is_electron": True,
                "system_info": system_info,
            }

        # Check DB machine
        loop = asyncio.get_event_loop()
        result = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("machines")
                .select("*")
                .eq("id", machine_id)
                .maybe_single()
                .execute(),
            ),
            timeout=10,
        )
        machine = result.data if result else None
        if not machine:
            return None

        if machine.get("status") != "running":
            return None

        ms = machine.get("settings", {})
        if ms.get("isLocal"):
            ports = ms.get("ports", {})
            public_ip = machine.get("public_ip_address", "localhost")
            default_agent_port = 8081 if public_ip == "localhost" else 8080
            return {
                "public_ip": public_ip,
                "agent_port": ports.get("agent", default_agent_port),
                "vnc_port": ports.get("vnc", 5901),
                "websocket_port": ports.get("websocket", 6080),
                "machine_name": machine.get("display_name", "Local VM"),
                "vnc_password": machine.get("vnc_password", "coasty123"),
                "is_local": True,
            }

        return {
            "public_ip": machine.get("public_ip_address"),
            "agent_port": machine.get("ai_agent_port", 8080),
            "vnc_port": machine.get("vnc_port", 5901),
            "websocket_port": machine.get("websocket_port", 6080),
            "machine_name": machine.get("display_name", "VM Desktop"),
            "vnc_password": machine.get("vnc_password"),
            "is_local": False,
        }
    except Exception as e:
        logger.error(f"Delegation: error getting machine connection info: {e}")
        return None


# ── Core Execution ──

async def execute_delegation(
    caller_chat_id: str,
    caller_title: str,
    target_chat_id: str,
    task: str,
    context: str,
    user_id: str,
    billing_session_id: Optional[str] = None,
    caller_machine_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Synchronously execute another employee and return the result.

    This is the core function called by the delegate_to_employee tool.
    It creates an executor for the delegate, runs their task, and returns
    a summary. The caller blocks until completion.

    Args:
        caller_chat_id: Chat ID of the calling employee
        caller_title: Title of the calling employee
        target_chat_id: Chat ID of the delegate employee
        task: Task description for the delegate
        context: Additional context/data for the delegate
        user_id: Owner user ID (for billing and DB access)
        billing_session_id: Parent billing session (delegate charges here)
        caller_machine_id: Machine ID of the caller (to detect same-machine)

    Returns:
        Dict with success, result_summary, employee_title, duration_seconds, error
    """
    start_time = datetime.now(timezone.utc)
    acquired_lock = False
    delegate_machine_id = None

    # 1. Validate delegate is in caller's allowed list
    caller_delegates = await get_delegates_for_chat(caller_chat_id)
    allowed_ids = {d["chat_id"] for d in caller_delegates}
    if target_chat_id not in allowed_ids:
        return {
            "success": False,
            "result_summary": f"Employee {target_chat_id} is not in your delegates list. "
                              f"Available delegates: {', '.join(d.get('title', d['chat_id']) for d in caller_delegates) or 'none'}",
            "error": "not_in_delegates",
            "duration_seconds": 0,
        }

    # 2. Check delegation call stack for circular calls and depth
    current_stack = _delegation_stack.get([])
    stack_copy = list(current_stack)

    if target_chat_id in stack_copy or target_chat_id == caller_chat_id:
        chain = " → ".join(stack_copy + [caller_chat_id, target_chat_id])
        return {
            "success": False,
            "result_summary": f"Circular delegation detected: {chain}",
            "error": "circular_delegation",
            "duration_seconds": 0,
        }

    if len(stack_copy) >= MAX_DELEGATION_DEPTH:
        return {
            "success": False,
            "result_summary": f"Maximum delegation depth ({MAX_DELEGATION_DEPTH}) exceeded. "
                              f"Current chain: {' → '.join(stack_copy)}",
            "error": "depth_exceeded",
            "duration_seconds": 0,
        }

    # 3. Push caller onto stack
    stack_copy.append(caller_chat_id)
    token = _delegation_stack.set(stack_copy)

    try:
        # 4. Read delegate's chat and schedule config
        delegate_chat = await db_service.get_chat(target_chat_id)
        if not delegate_chat:
            return {
                "success": False,
                "result_summary": "Delegate employee not found",
                "error": "delegate_not_found",
                "duration_seconds": 0,
            }

        delegate_rs = delegate_chat.get("room_settings", {})
        if isinstance(delegate_rs, str):
            delegate_rs = json.loads(delegate_rs)
        delegate_schedule = delegate_rs.get("schedule", {})
        delegate_machine_id = delegate_schedule.get("target_machine_id")
        delegate_title = delegate_chat.get("title") or "Unnamed Employee"

        if not delegate_machine_id:
            return {
                "success": False,
                "result_summary": f"Employee '{delegate_title}' has no machine assigned",
                "error": "no_machine",
                "duration_seconds": 0,
            }

        # 5. Handle machine locking
        same_machine = caller_machine_id and delegate_machine_id == caller_machine_id
        execution_lock = None

        if not same_machine:
            execution_lock = vm_control_service.get_execution_lock(delegate_machine_id)
            try:
                await asyncio.wait_for(
                    execution_lock.acquire(), timeout=DELEGATE_LOCK_TIMEOUT
                )
                acquired_lock = True
                vm_control_service.execution_owners[delegate_machine_id] = target_chat_id
                vm_control_service.reset_cancellation(delegate_machine_id)
            except asyncio.TimeoutError:
                busy, owner_chat = vm_control_service.is_machine_busy(delegate_machine_id)
                return {
                    "success": False,
                    "result_summary": f"Employee '{delegate_title}' is busy — their machine is in use"
                                      f"{f' by chat {owner_chat}' if owner_chat else ''}",
                    "error": "machine_busy",
                    "duration_seconds": 0,
                }

        # 6. Get delegate machine connection info
        connection_info = await _get_machine_connection_info(delegate_machine_id, user_id)
        if not connection_info:
            return {
                "success": False,
                "result_summary": f"Employee '{delegate_title}' machine is not available",
                "error": "machine_unavailable",
                "duration_seconds": 0,
            }

        # 7. Connect to delegate machine if needed
        if connection_info.get("is_electron"):
            if delegate_machine_id not in vm_control_service.connections:
                reconnected = await vm_control_service._wait_for_electron_reconnect(
                    delegate_machine_id
                )
                if not reconnected:
                    return {
                        "success": False,
                        "result_summary": f"Employee '{delegate_title}' Electron app is not connected",
                        "error": "electron_offline",
                        "duration_seconds": 0,
                    }
        elif not same_machine:
            public_ip = connection_info["public_ip"]
            default_port = 8081 if public_ip == "localhost" else 8080
            agent_port = connection_info.get("agent_port", default_port)
            await vm_control_service.connect_to_agent(
                delegate_machine_id,
                public_ip,
                agent_port,
                connection_info.get("session_id"),
                connection_info.get("user_id"),
                connection_info.get("vnc_password"),
            )

        # 8. Create executor
        bedrock_model = settings.BEDROCK_DEFAULT_MODEL
        provider = provider_factory.get_provider(bedrock_model)
        provider.initialize()

        use_cua = os.environ.get("USE_CUA_EXECUTOR", "true").lower() == "true"

        if use_cua:
            from app.services.cua_executor import CUAExecutor

            executor = CUAExecutor(
                machine_id=delegate_machine_id,
                connection_info=connection_info,
                provider=provider,
                model=bedrock_model,
                temperature=1.0,
                max_tokens=None,
                chat_id=target_chat_id,
                chat_title=delegate_title,
            )
        else:
            from app.services.multi_agent_executor import MultiAgentExecutor

            executor = MultiAgentExecutor(
                machine_id=delegate_machine_id,
                connection_info=connection_info,
                provider=provider,
                model=bedrock_model,
                temperature=1.0,
                max_tokens=None,
                chat_id=target_chat_id,
                chat_title=delegate_title,
            )

        # 9. Propagate delegation context (enables nested delegation + billing)
        executor.set_delegation_context(
            user_id=user_id,
            billing_session_id=billing_session_id,
        )

        # 10. Build delegated task prompt
        prompt_parts = []
        if context:
            prompt_parts.append(f"[CONTEXT FROM {caller_title}]\n{context}")
        prompt_parts.append(f"[YOUR TASK]\n{task}")
        prompt_parts.append(
            "\nComplete this task and provide a clear, concise result summary. "
            "When done, output DONE."
        )
        task_prompt = "\n\n".join(prompt_parts)

        # Store a marker message in delegate's chat for history
        try:
            await db_service.save_message({
                "chat_id": target_chat_id,
                "role": "user",
                "content": (
                    f"[Delegated task from {caller_title} at "
                    f"{start_time.strftime('%Y-%m-%d %H:%M UTC')}]\n{task_prompt[:500]}"
                ),
                "created_at": start_time.isoformat(),
            })
        except Exception as e:
            logger.warning(f"Failed to store delegation marker message: {e}")

        # 11. Consume stream with timeout
        all_content = ""
        all_tool_invocations: List[Dict] = []
        completion_status = "failed"
        step_count = 0

        try:
            async for chunk in _iter_with_timeout(
                executor.stream_execution(task_prompt, None, None),
                DELEGATION_TIMEOUT,
            ):
                # Check billing cancellation
                if not same_machine and vm_control_service.get_cancellation_event(
                    delegate_machine_id
                ).is_set():
                    all_content += "\n[Delegation stopped: machine taken over]\n"
                    break

                chunk_type = chunk.get("type")

                if chunk_type == "keepalive":
                    continue

                elif chunk_type == "text":
                    content = chunk.get("content", "")
                    if content:
                        all_content += content

                elif chunk_type == "tool_call":
                    all_tool_invocations.append({
                        "toolCallId": chunk.get("toolCallId", str(uuid.uuid4())),
                        "toolName": chunk.get("toolName", ""),
                        "args": chunk.get("args", {}),
                    })

                elif chunk_type == "tool_result":
                    tool_call_id = chunk.get("toolCallId", "")
                    result = chunk.get("result")
                    for inv in all_tool_invocations:
                        if inv.get("toolCallId") == tool_call_id:
                            inv["result"] = result
                            break

                elif chunk_type == "step_complete":
                    step_count += 1
                    # Charge billing step to parent session
                    if billing_session_id:
                        try:
                            billing_info = await agent_billing_service.charge_step(
                                billing_session_id, step_count
                            )
                            if billing_info.get("should_stop"):
                                logger.warning(
                                    f"Delegation {target_chat_id} stopped: out of credits"
                                )
                                all_content += "\n[Delegation ended: insufficient credits]\n"
                                if not same_machine:
                                    vm_control_service.get_cancellation_event(
                                        delegate_machine_id
                                    ).set()
                                break
                        except Exception as e:
                            logger.error(f"Delegation billing error: {e}")

                elif chunk_type == "error":
                    all_content += f"\n{chunk.get('content', 'Unknown error')}\n"

                elif chunk_type == "finish":
                    completion_status = "completed"
                    final_content = chunk.get("content", "")
                    if final_content:
                        all_content = final_content

        except asyncio.TimeoutError:
            logger.warning(
                f"Delegation to {target_chat_id} timed out after {DELEGATION_TIMEOUT}s"
            )
            all_content += f"\n[Delegation timed out after {DELEGATION_TIMEOUT // 60} minutes]\n"
            completion_status = "failed"

        # 12. Store delegate's output in their chat
        try:
            from app.utils.sanitize import sanitize_content

            await db_service.save_message({
                "chat_id": target_chat_id,
                "role": "assistant",
                "content": sanitize_content(all_content[:10000]),
                "model": bedrock_model,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as e:
            logger.warning(f"Failed to store delegation result message: {e}")

        # 13. Build result summary
        end_time = datetime.now(timezone.utc)
        duration = int((end_time - start_time).total_seconds())

        # Truncate result for tool response
        result_summary = all_content.strip()[:2000]
        if len(all_content.strip()) > 2000:
            result_summary += "\n... (truncated)"

        return {
            "success": completion_status == "completed",
            "result_summary": result_summary or "No output from delegate",
            "employee_title": delegate_title,
            "duration_seconds": duration,
            "steps_completed": step_count,
            "error": None if completion_status == "completed" else "execution_failed",
        }

    except Exception as e:
        end_time = datetime.now(timezone.utc)
        duration = int((end_time - start_time).total_seconds())
        logger.error(
            f"Delegation to {target_chat_id} failed: {e}", exc_info=True
        )
        return {
            "success": False,
            "result_summary": f"Delegation failed: {str(e)[:500]}",
            "error": str(e),
            "duration_seconds": duration,
        }

    finally:
        # Restore delegation stack
        _delegation_stack.reset(token)

        # Release delegate machine lock if we acquired it
        if acquired_lock and delegate_machine_id:
            try:
                lock = vm_control_service.get_execution_lock(delegate_machine_id)
                if lock.locked():
                    vm_control_service.execution_owners.pop(delegate_machine_id, None)
                    lock.release()
            except Exception as e:
                logger.error(f"Failed to release delegate machine lock: {e}")


async def _iter_with_timeout(aiter, total_timeout_sec: int):
    """Wrap an async iterator with a per-item idle timeout.

    Uses a generous per-item timeout (60s) plus the caller wraps
    the whole thing with asyncio.wait_for for the total timeout.
    """
    ait = aiter.__aiter__()
    deadline = asyncio.get_event_loop().time() + total_timeout_sec
    while True:
        remaining = deadline - asyncio.get_event_loop().time()
        if remaining <= 0:
            raise asyncio.TimeoutError("Delegation total timeout exceeded")
        try:
            chunk = await asyncio.wait_for(
                ait.__anext__(), timeout=min(remaining, 60)
            )
            yield chunk
        except StopAsyncIteration:
            return
        except asyncio.TimeoutError:
            # Check if this is total timeout or just idle
            if asyncio.get_event_loop().time() >= deadline:
                raise
            # Idle timeout on a single chunk — keep going
            continue


# ── Tool Factory ──

def create_delegation_tools(
    chat_id: str,
    chat_title: str,
    user_id: str,
    billing_session_id: Optional[str] = None,
    caller_machine_id: Optional[str] = None,
) -> Dict[str, Dict]:
    """Create delegation tools for an agent.

    Returns a dict of tool_name → tool_dict that can be added to the agent's tool set.
    Each tool has name, description, parameters, and execute keys.

    Follows the same pattern as create_shared_memory_tools() in shared_memory.py.
    """

    # Cache delegates list to avoid repeated DB reads within a single execution
    _cached_delegates: Dict[str, List[Dict]] = {}

    async def _get_delegates() -> List[Dict]:
        if "delegates" not in _cached_delegates:
            _cached_delegates["delegates"] = await get_delegates_for_chat(chat_id)
        return _cached_delegates["delegates"]

    async def execute_list_delegates() -> Dict:
        delegates = await _get_delegates()
        if not delegates:
            return {
                "success": True,
                "delegates": [],
                "result": "No delegates assigned. Ask your manager to assign employees to your delegate list.",
            }
        delegate_info = []
        for d in delegates:
            delegate_info.append({
                "employee_id": d["chat_id"],
                "title": d.get("title", "Unnamed"),
                "role": d.get("role", "General tasks"),
            })
        return {
            "success": True,
            "delegates": delegate_info,
            "result": f"You have {len(delegates)} delegate(s) available.",
        }

    async def execute_delegate(
        employee_id: str, task: str, context: str = ""
    ) -> Dict:
        # Validate employee_id is in our delegate list
        delegates = await _get_delegates()
        allowed_ids = {d["chat_id"] for d in delegates}

        if not delegates:
            return {
                "success": False,
                "result": "No delegates configured. Cannot delegate tasks.",
            }

        if employee_id not in allowed_ids:
            available = ", ".join(
                f"{d.get('title', 'Unknown')} (ID: {d['chat_id']})"
                for d in delegates
            )
            return {
                "success": False,
                "result": f"Employee '{employee_id}' is not in your delegates. "
                          f"Available: {available}",
            }

        # Execute the delegation
        result = await execute_delegation(
            caller_chat_id=chat_id,
            caller_title=chat_title,
            target_chat_id=employee_id,
            task=task,
            context=context,
            user_id=user_id,
            billing_session_id=billing_session_id,
            caller_machine_id=caller_machine_id,
        )

        # Format for tool result
        if result.get("success"):
            return {
                "success": True,
                "result": result.get("result_summary", "Task completed"),
                "employee": result.get("employee_title", ""),
                "duration_seconds": result.get("duration_seconds", 0),
            }
        else:
            return {
                "success": False,
                "result": result.get("result_summary", "Delegation failed"),
                "error": result.get("error", "unknown"),
            }

    # Build the description with delegate list if available
    # (loaded lazily on first tool call via _get_delegates)
    base_desc = (
        "Delegate a subtask to another AI employee and wait for their result. "
        "The employee will execute the task on their own machine and return "
        "a summary when done. Use list_delegates first to see available employees."
    )

    return {
        "delegate_to_employee": {
            "name": "delegate_to_employee",
            "description": base_desc,
            "parameters": {
                "type": "object",
                "properties": {
                    "employee_id": {
                        "type": "string",
                        "description": "The ID of the employee to delegate to (from list_delegates)",
                    },
                    "task": {
                        "type": "string",
                        "description": "Clear description of the subtask to delegate",
                    },
                    "context": {
                        "type": "string",
                        "description": "Any relevant data or context the delegate needs",
                    },
                },
                "required": ["employee_id", "task"],
            },
            "execute": execute_delegate,
        },
        "list_delegates": {
            "name": "list_delegates",
            "description": (
                "List all AI employees you can delegate tasks to. "
                "Shows each employee's ID, name, and role/specialty."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
            },
            "execute": execute_list_delegates,
        },
    }
