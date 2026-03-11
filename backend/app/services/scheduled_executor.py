"""
Scheduled Executor — Headless execution pipeline for scheduled tasks.

Reuses CUAExecutor.stream_execution() but consumes the async generator
internally (no SSE streaming). Results are stored as messages in the chat.
Billing is handled identically to manual runs.
"""

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.services.database import DatabaseService
from app.services.agent_billing import agent_billing_service
from app.services.vm_control import vm_control_service
from app.providers.provider_factory import ProviderFactory
from app.utils.sanitize import sanitize_content

logger = logging.getLogger(__name__)

db_service = DatabaseService()
provider_factory = ProviderFactory()


async def _iter_with_idle_timeout(aiter, idle_timeout_sec: int):
    """Wrap an async iterator to raise TimeoutError if no item arrives within idle_timeout_sec."""
    ait = aiter.__aiter__()
    while True:
        try:
            chunk = await asyncio.wait_for(ait.__anext__(), timeout=idle_timeout_sec)
            yield chunk
        except StopAsyncIteration:
            return
        # asyncio.TimeoutError propagates up naturally


def _merge_screenshots(
    tool_invocations: List[Dict],
    screenshot_store: Dict[str, str],
) -> List[Dict]:
    """Create a copy of tool_invocations with screenshots merged in."""
    if not screenshot_store:
        return tool_invocations
    merged = []
    for inv in tool_invocations:
        tool_id = inv.get("toolCallId")
        if tool_id and tool_id in screenshot_store and "frontendScreenshot" not in inv:
            copy = dict(inv)
            copy["frontendScreenshot"] = screenshot_store[tool_id]
            merged.append(copy)
        else:
            merged.append(inv)
    return merged


def _build_message_parts(tool_invocations: List[Dict]) -> List[Dict]:
    """Transform tool invocations into the parts format expected by the DB."""
    parts = []
    for tool_inv in tool_invocations:
        tool_invocation_data = {
            "toolCallId": tool_inv.get("toolCallId", tool_inv.get("id", "")),
            "toolName": tool_inv.get("toolName", ""),
            "args": tool_inv.get("args", {}),
            "state": "result",
        }
        if "result" in tool_inv:
            tool_invocation_data["result"] = tool_inv["result"]
        if "frontendScreenshot" in tool_inv:
            tool_invocation_data["frontendScreenshot"] = tool_inv["frontendScreenshot"]
        parts.append({"type": "tool-invocation", "toolInvocation": tool_invocation_data})
    return parts


async def _store_message(
    chat_id: str,
    content: str,
    tool_invocations: List[Dict],
    model: str,
    message_group_id: Optional[str] = None,
) -> Optional[Dict]:
    """Store a new assistant message in the database."""
    try:
        sanitized = sanitize_content(content)
        message_data: Dict[str, Any] = {
            "chat_id": chat_id,
            "role": "assistant",
            "content": sanitized,
            "model": model,
            "message_group_id": message_group_id,
            "created_at": datetime.utcnow().isoformat(),
        }
        if tool_invocations:
            message_data["parts"] = _build_message_parts(tool_invocations)

        return await db_service.save_message(message_data)
    except Exception as e:
        logger.error(f"Failed to store scheduled message: {e}", exc_info=True)
        return None


async def _update_message(
    message_id: str,
    content: str,
    tool_invocations: List[Dict],
) -> Optional[Dict]:
    """Update an existing assistant message."""
    try:
        sanitized = sanitize_content(content)
        update_data: Dict[str, Any] = {"content": sanitized}
        if tool_invocations:
            update_data["parts"] = _build_message_parts(tool_invocations)
        return await db_service.update_message(message_id, update_data)
    except Exception as e:
        logger.error(f"Failed to update scheduled message {message_id}: {e}")
        return None


async def _get_task_prompt(chat_id: str) -> Optional[str]:
    """Extract the task prompt — first user message from the chat."""
    try:
        messages = await db_service.get_chat_messages(chat_id, limit=50)
        for msg in messages:
            if msg.get("role") == "user" and msg.get("content"):
                content = msg["content"]
                if isinstance(content, str):
                    return content
                elif isinstance(content, list):
                    # Extract text from structured content
                    texts = []
                    for part in content:
                        if isinstance(part, dict) and part.get("type") == "text":
                            texts.append(part.get("text", ""))
                        elif isinstance(part, str):
                            texts.append(part)
                    return " ".join(texts) if texts else None
        return None
    except Exception as e:
        logger.error(f"Failed to get task prompt for chat {chat_id}: {e}")
        return None


async def _get_machine_connection_info(
    machine_id: str, user_id: str
) -> Optional[Dict]:
    """Get machine connection info — reuses logic from chat.py."""
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
                "machine_name": f"My Computer ({system_info.get('hostname', 'Electron')})",
                "vnc_password": None,
                "is_local": True,
                "is_electron": True,
                "system_info": system_info,
            }

        # Local Docker
        if machine_id.startswith("local-"):
            container_id = machine_id.replace("local-", "")
            return {
                "public_ip": "localhost",
                "agent_port": 8081,
                "vnc_port": 5901,
                "websocket_port": 6080,
                "machine_name": f"Local Docker ({container_id[:8]})",
                "vnc_password": "coasty123",
                "is_local": True,
            }

        # DB-registered machine
        machine = await db_service.get_machine(machine_id, user_id)
        if not machine:
            return None

        machine_settings = machine.get("settings", {})
        if machine_settings.get("provider") == "electron":
            return {
                "public_ip": "electron",
                "agent_port": 0,
                "vnc_port": 0,
                "websocket_port": 0,
                "machine_name": machine.get("display_name", "Local Desktop"),
                "vnc_password": None,
                "is_local": True,
                "is_electron": True,
                "system_info": {
                    "platform": machine_settings.get("platform", "unknown"),
                    "hostname": machine_settings.get("hostname", ""),
                    "username": machine_settings.get("username", ""),
                },
            }

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
        logger.error(f"Error getting machine connection info: {e}")
        return None


async def _build_team_context(
    chat_id: str, user_id: str, schedule: dict
) -> Optional[str]:
    """Build context from team hub and teammates' recent activity."""
    hub_id = schedule.get("team_hub_id")
    if not hub_id:
        return None

    try:
        hub_chat = await db_service.get_chat(hub_id)
        if not hub_chat:
            return None

        hub_settings = hub_chat.get("room_settings", {})
        if isinstance(hub_settings, str):
            hub_settings = json.loads(hub_settings)
        team_hub = hub_settings.get("team_hub", {})

        parts: List[str] = []
        team_name = hub_chat.get("title") or team_hub.get("name", "Unnamed Team")
        parts.append(f"## You are part of team: {team_name}")

        if team_hub.get("instructions"):
            parts.append(f"Team guidelines: {team_hub['instructions']}")

        # Gather teammate summaries
        members = team_hub.get("members", [])
        teammate_lines: List[str] = []
        for member_id in members:
            if member_id == chat_id:
                continue
            try:
                member_chat = await db_service.get_chat(member_id)
                if not member_chat:
                    continue
                ms = member_chat.get("room_settings", {})
                if isinstance(ms, str):
                    ms = json.loads(ms)
                member_sched = ms.get("schedule", {})
                summary = member_sched.get("last_output_summary")
                if summary:
                    title = member_chat.get("title") or "Unnamed Agent"
                    teammate_lines.append(f"- **{title}**: {summary[:300]}")
            except Exception:
                continue

        if teammate_lines:
            parts.append("\n### Recent teammate activity:")
            parts.extend(teammate_lines)

        # Include shared memory
        shared_mem = team_hub.get("shared_memory", {})
        if shared_mem:
            parts.append("\n### Shared memory:")
            for key, entry in list(shared_mem.items())[:20]:
                val = str(entry.get("value", ""))[:300]
                parts.append(f"- `{key}`: {val}")

        return "\n".join(parts)

    except Exception as e:
        logger.warning(f"Failed to build team context for {chat_id}: {e}")
        return None


async def execute_scheduled_chat(
    chat_id: str,
    user_id: str,
    machine_id: str,
    model: Optional[str] = None,
    task_prompt_override: Optional[str] = None,
    triggered_context: Optional[Dict] = None,
) -> Dict[str, Any]:
    """
    Execute a scheduled chat task headlessly.

    Reuses CUAExecutor but consumes the async generator internally.
    Returns execution summary dict.

    Args:
        triggered_context: Optional dict with keys source_chat_id, source_title,
            summary, trigger_depth — injected when this run was triggered by another agent.
    """
    start_time = datetime.now(timezone.utc)
    billing_session_id = None
    completion_status = "failed"
    credits_charged = 0
    error_message = None
    execution_lock = None

    # Acquire per-machine execution lock to prevent concurrent use
    execution_lock = vm_control_service.get_execution_lock(machine_id)
    try:
        await asyncio.wait_for(execution_lock.acquire(), timeout=10.0)
    except asyncio.TimeoutError:
        busy, owner_chat = vm_control_service.is_machine_busy(machine_id)
        logger.warning(
            f"Machine {machine_id} busy (owner: {owner_chat}), "
            f"skipping scheduled chat {chat_id}"
        )
        return {
            "status": "skipped",
            "error": f"Machine busy with another task (chat: {owner_chat})",
            "duration_seconds": 0,
            "credits_charged": 0,
        }
    vm_control_service.execution_owners[machine_id] = chat_id
    vm_control_service.reset_cancellation(machine_id)

    try:
        # 1. Get task prompt (prefer override from schedule config, fall back to first user message)
        task_prompt = task_prompt_override or await _get_task_prompt(chat_id)
        if not task_prompt:
            return {
                "status": "failed",
                "error": "No user message found in chat to use as task prompt",
                "duration_seconds": 0,
                "credits_charged": 0,
            }

        # 1b. Inject triggered context (from a source agent trigger)
        if triggered_context:
            source_title = triggered_context.get("source_title", "Another Agent")
            source_summary = triggered_context.get("summary", "")
            if source_summary:
                task_prompt = (
                    f"[CONTEXT FROM PREVIOUS AGENT: {source_title}]\n"
                    f"{source_summary}\n\n"
                    f"[YOUR TASK]\n{task_prompt}"
                )

        # 1c. Inject team context (shared memory + teammate summaries)
        try:
            chat_data = await db_service.get_chat(chat_id)
            if chat_data:
                rs = chat_data.get("room_settings", {})
                if isinstance(rs, str):
                    rs = json.loads(rs)
                sched = rs.get("schedule", {})
                team_ctx = await _build_team_context(chat_id, user_id, sched)
                if team_ctx:
                    task_prompt = f"{team_ctx}\n\n---\n\n{task_prompt}"
        except Exception as e:
            logger.warning(f"Failed to inject team context: {e}")

        # 2. Store a system message indicating scheduled execution
        trigger_label = ""
        if triggered_context:
            trigger_label = f" (triggered by {triggered_context.get('source_title', 'another agent')})"
        scheduled_marker = (
            f"[Scheduled execution at {start_time.strftime('%Y-%m-%d %H:%M UTC')}{trigger_label}]\n"
            f"Re-running task: {task_prompt[:200]}"
        )
        await db_service.save_message({
            "chat_id": chat_id,
            "role": "user",
            "content": scheduled_marker,
            "created_at": start_time.isoformat(),
        })

        # 3. Get machine connection info
        connection_info = await _get_machine_connection_info(machine_id, user_id)
        if not connection_info:
            return {
                "status": "failed",
                "error": f"Machine {machine_id} not found or not running",
                "duration_seconds": 0,
                "credits_charged": 0,
            }

        # 4. Start billing session
        billing_session_id = await agent_billing_service.start_session(
            user_id=user_id,
            machine_id=machine_id,
            session_type="ai_controlled",
            ai_model=model or settings.BEDROCK_DEFAULT_MODEL,
            ai_objective=f"[SCHEDULED:{chat_id}] {task_prompt[:500]}",
        )

        if not billing_session_id:
            return {
                "status": "failed",
                "error": "Failed to start billing session",
                "duration_seconds": 0,
                "credits_charged": 0,
            }

        # 5. Connect to machine (for non-Electron machines)
        if connection_info.get("is_electron"):
            if machine_id not in vm_control_service.connections:
                reconnected = await vm_control_service._wait_for_electron_reconnect(
                    machine_id
                )
                if not reconnected:
                    return {
                        "status": "failed",
                        "error": "Electron app not connected",
                        "duration_seconds": 0,
                        "credits_charged": 0,
                    }
        else:
            public_ip = connection_info["public_ip"]
            default_port = 8081 if public_ip == "localhost" else 8080
            agent_port = connection_info.get("agent_port", default_port)
            await vm_control_service.connect_to_agent(
                machine_id,
                public_ip,
                agent_port,
                connection_info.get("session_id"),
                connection_info.get("user_id"),
                connection_info.get("vnc_password"),
            )

        # 6. Initialize executor
        bedrock_model = model or settings.BEDROCK_DEFAULT_MODEL
        provider = provider_factory.get_provider(bedrock_model)
        provider.initialize()

        # Get chat title for shared memory tools
        _chat_title = ""
        try:
            if chat_data:
                _chat_title = chat_data.get("title") or ""
        except Exception:
            pass

        use_cua = os.environ.get("USE_CUA_EXECUTOR", "true").lower() == "true"

        if use_cua:
            from app.services.cua_executor import CUAExecutor

            executor = CUAExecutor(
                machine_id=machine_id,
                connection_info=connection_info,
                provider=provider,
                model=bedrock_model,
                temperature=1.0,
                max_tokens=None,
                chat_id=chat_id,
                chat_title=_chat_title,
            )
        else:
            from app.services.multi_agent_executor import MultiAgentExecutor

            executor = MultiAgentExecutor(
                machine_id=machine_id,
                connection_info=connection_info,
                provider=provider,
                model=bedrock_model,
                temperature=1.0,
                max_tokens=None,
                chat_id=chat_id,
                chat_title=_chat_title,
            )

        # 6b. Enable delegation tools with execution-time context
        executor.set_delegation_context(
            user_id=user_id,
            billing_session_id=billing_session_id,
        )

        # 7. Consume the stream internally (no SSE)
        all_content = ""
        all_tool_invocations: List[Dict] = []
        screenshot_store: Dict[str, str] = {}  # toolCallId → base64, from CUA executor
        assistant_message_id: Optional[str] = None
        message_group_id = str(uuid.uuid4())
        idle_timeout = settings.SCHEDULED_TASK_IDLE_TIMEOUT

        try:
            async for chunk in _iter_with_idle_timeout(
                executor.stream_execution(task_prompt, None, None),
                idle_timeout,
            ):
                # Check if another request force-stopped this execution
                if vm_control_service.get_cancellation_event(machine_id).is_set():
                    logger.info(f"Scheduled execution on {machine_id} force-stopped")
                    all_content += "\n[Execution stopped: machine taken over by another task]\n"
                    completion_status = "cancelled"
                    break

                chunk_type = chunk.get("type")

                if chunk_type == "keepalive":
                    continue  # Keep iterating to prevent generator stall

                elif chunk_type == "text":
                    content = chunk.get("content", "")
                    if content:
                        all_content += content

                elif chunk_type == "tool_call":
                    tool_call = {
                        "toolCallId": chunk.get("toolCallId")
                        or chunk.get("id", str(uuid.uuid4())),
                        "toolName": chunk.get("toolName")
                        or chunk.get("tool")
                        or chunk.get("name", ""),
                        "args": chunk.get("args") or {},
                    }
                    all_tool_invocations.append(tool_call)

                elif chunk_type == "tool_result":
                    tool_call_id = chunk.get("toolCallId") or chunk.get("id", "")
                    result = chunk.get("result")
                    screenshot = chunk.get("frontendScreenshot")
                    for inv in all_tool_invocations:
                        if inv.get("toolCallId") == tool_call_id:
                            inv["result"] = result
                            break
                    # Store screenshot separately for lightweight in-memory list
                    if screenshot:
                        screenshot_store[tool_call_id] = screenshot

                elif chunk_type == "step_complete":
                    step_num = chunk.get("step", 0)
                    step_content = chunk.get("content", all_content)
                    step_tools = chunk.get("tool_invocations", all_tool_invocations)

                    # Pick up the screenshot store from executor (if CUA)
                    chunk_ss_store = chunk.get("screenshot_store")
                    if chunk_ss_store:
                        screenshot_store.update(chunk_ss_store)

                    # Bill this step
                    try:
                        billing_info = await agent_billing_service.charge_step(
                            billing_session_id, step_num
                        )
                        if billing_info.get("charged", 0) > 0:
                            credits_charged += billing_info["charged"]
                        if billing_info.get("should_stop"):
                            logger.warning(
                                f"Scheduled task {chat_id} stopped: out of credits"
                            )
                            all_content += "\n[Scheduled run ended: insufficient credits]\n"
                            # Signal executor to stop
                            vm_control_service.get_cancellation_event(machine_id).set()
                            completion_status = "cancelled"
                            break
                    except Exception as e:
                        logger.error(f"Step billing error: {e}")

                    # Merge screenshots for DB persistence
                    save_tools = _merge_screenshots(step_tools, screenshot_store)

                    # Incremental DB save
                    try:
                        if assistant_message_id is None:
                            save_result = await _store_message(
                                chat_id=chat_id,
                                content=step_content,
                                tool_invocations=save_tools,
                                model=bedrock_model,
                                message_group_id=message_group_id,
                            )
                            if save_result:
                                assistant_message_id = save_result.get("id")
                        else:
                            await _update_message(
                                assistant_message_id, step_content, save_tools
                            )
                    except Exception as e:
                        logger.error(f"Step DB save error: {e}")

                elif chunk_type == "error":
                    error_content = chunk.get("content", "Unknown error")
                    all_content += f"\n{error_content}\n"
                    error_message = str(error_content)

                elif chunk_type == "finish":
                    completion_status = "completed"
                    final_content = chunk.get("content", "") or all_content
                    final_tools = chunk.get("tool_invocations", all_tool_invocations)

                    # Pick up final screenshot store
                    chunk_ss_store = chunk.get("screenshot_store")
                    if chunk_ss_store:
                        screenshot_store.update(chunk_ss_store)

                    # Merge screenshots for DB persistence
                    save_tools = _merge_screenshots(final_tools, screenshot_store)

                    if assistant_message_id:
                        await _update_message(
                            assistant_message_id, final_content, save_tools
                        )
                    else:
                        await _store_message(
                            chat_id=chat_id,
                            content=final_content,
                            tool_invocations=save_tools,
                            model=bedrock_model,
                            message_group_id=message_group_id,
                        )

        except asyncio.TimeoutError:
            idle_min = idle_timeout // 60
            logger.warning(
                f"Scheduled task {chat_id} idle timeout: "
                f"no activity for {idle_min} minutes on machine {machine_id}"
            )
            all_content += f"\n[Execution timed out: no activity for {idle_min} minutes]\n"
            completion_status = "failed"
            error_message = f"No activity for {idle_min} minutes"

        # If no finish event was received, save whatever we have
        if completion_status in ("failed", "cancelled") and all_content:
            save_tools = _merge_screenshots(all_tool_invocations, screenshot_store)
            if assistant_message_id:
                await _update_message(
                    assistant_message_id, all_content, save_tools
                )
            else:
                await _store_message(
                    chat_id=chat_id,
                    content=all_content,
                    tool_invocations=save_tools,
                    model=bedrock_model,
                    message_group_id=message_group_id,
                )

    except Exception as e:
        error_message = str(e)
        logger.error(
            f"Scheduled execution failed for chat {chat_id}: {e}", exc_info=True
        )

    finally:
        # Release per-machine execution lock
        if execution_lock is not None and execution_lock.locked():
            vm_control_service.execution_owners.pop(machine_id, None)
            execution_lock.release()

        # End billing session
        if billing_session_id:
            try:
                billing_summary = await agent_billing_service.end_session(
                    billing_session_id,
                    completion_status,
                    error_message,
                )
                credits_charged = billing_summary.get("credits_charged", credits_charged)
            except Exception as e:
                logger.error(f"Failed to end billing session: {e}")

    end_time = datetime.now(timezone.utc)
    duration = int((end_time - start_time).total_seconds())

    return {
        "status": completion_status,
        "duration_seconds": duration,
        "credits_charged": credits_charged,
        "error": error_message,
    }
