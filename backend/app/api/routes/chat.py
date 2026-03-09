"""
Chat API endpoints - Main chat functionality
"""

import json
import logging
import asyncio
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.models.chat import ChatRequest
from app.services.auth import validate_user, get_verified_user_id
from app.services.database import DatabaseService
from app.services.usage_tracker import UsageTracker
from app.services.vm_control import vm_control_service
from app.services.agent_billing import agent_billing_service
from app.utils.sanitize import sanitize_content
from app.providers.provider_factory import ProviderFactory
from app.services.multi_agent_executor import MultiAgentExecutor
from app.services.cua_executor import CUAExecutor

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize services
db_service = DatabaseService()
usage_tracker = UsageTracker()
provider_factory = ProviderFactory()


def _merge_screenshots(
    tool_invocations: List[Dict],
    screenshot_store: Dict[str, str],
) -> List[Dict]:
    """Create a copy of tool_invocations with screenshots merged in from the
    separate store.  Used right before DB saves so the persisted message has
    all screenshots while the in-memory list stays lightweight.

    Tool invocations that already carry a ``frontendScreenshot`` key (e.g.
    from the multi-agent executor which doesn't use the separate store) are
    left untouched.
    """
    if not screenshot_store:
        return tool_invocations  # Nothing to merge — avoid copy

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
    """Transform tool invocations into the parts format expected by the frontend/DB."""
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


async def store_assistant_message(
    chat_id: str,
    content: str,
    tool_invocations: List[Dict],
    model: str,
    message_group_id: Optional[str] = None
):
    """Store (INSERT) a new assistant message in database."""
    try:
        logger.info(f"[store_assistant_message] Storing for chat {chat_id} "
                    f"({len(content)} chars, {len(tool_invocations) if tool_invocations else 0} tools)")

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

        result = await db_service.save_message(message_data)
        if result:
            logger.info(f"[store_assistant_message] Stored message {result.get('id', '?')} for chat {chat_id}")
        else:
            logger.warning(f"[store_assistant_message] save_message returned None for chat {chat_id}")
        return result

    except Exception as e:
        logger.error(f"Failed to store assistant message: {e}", exc_info=True)
        return None


async def update_assistant_message(
    message_id: str,
    content: str,
    tool_invocations: List[Dict],
):
    """Update an existing assistant message with new accumulated content.

    Called after each CUA step so long-running sessions are persisted
    incrementally rather than only at the very end.
    """
    try:
        sanitized = sanitize_content(content)
        update_data: Dict[str, Any] = {"content": sanitized}

        if tool_invocations:
            update_data["parts"] = _build_message_parts(tool_invocations)

        result = await db_service.update_message(message_id, update_data)
        if result:
            logger.debug(f"[update_assistant_message] Updated {message_id} "
                        f"({len(sanitized)} chars, {len(tool_invocations)} tools)")
        return result

    except Exception as e:
        logger.error(f"Failed to update assistant message {message_id}: {e}", exc_info=True)
        return None




async def get_machine_connection_info(machine_id: str, user_id: str) -> Optional[Dict]:
    """Get machine connection information from database or detect local Docker"""
    try:
        # Check if it's an Electron desktop machine (connected via electron_bridge)
        electron_session = vm_control_service.session_data.get(machine_id, {})
        if electron_session.get("is_electron"):
            system_info = electron_session.get("system_info", {})
            logger.info(f"Detected Electron desktop machine: {machine_id}, platform={system_info.get('platform')}")
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

        # Check if it's a local machine
        if machine_id.startswith("local-"):
            # Extract the container ID
            container_id = machine_id.replace("local-", "")
            logger.info(f"Detected local Docker container: {container_id}")
            
            # For local Docker containers, use localhost with port 8081
            return {
                "public_ip": "localhost",
                "agent_port": 8081,  # Use port 8081 for localhost connections
                "vnc_port": 5901,
                "websocket_port": 6080,
                "machine_name": f"Local Docker Container ({container_id[:8]})",
                "vnc_password": "coasty123",  # Local containers may have different auth
                "is_local": True
            }
        
        # Get machine details from database (Azure machines)
        machine = await db_service.get_machine(machine_id, user_id)
        if not machine:
            logger.error(f"Machine {machine_id} not found for user {user_id}")
            return None

        # Check if it's an Electron machine in the DB (provider == "electron").
        # When the Electron WebSocket drops briefly, cleanup sets status to
        # "stopped" and removes session_data.  We still return Electron info
        # so the caller can wait for the app to reconnect instead of 404-ing.
        machine_settings = machine.get("settings", {})
        if machine_settings.get("provider") == "electron":
            logger.info(
                f"Machine {machine_id} is an Electron machine in DB "
                f"(status={machine.get('status')}), returning Electron info"
            )
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
            logger.warning(f"Machine {machine_id} is not running (status: {machine.get('status')})")
            return None

        # Check if it's marked as local in settings
        settings = machine.get("settings", {})
        if settings.get("isLocal"):
            ports = settings.get("ports", {})
            # Check if it's localhost - use port 8081, otherwise use configured port
            public_ip = machine.get("public_ip_address", "localhost")
            default_agent_port = 8081 if public_ip == "localhost" else 8080
            return {
                "public_ip": public_ip,
                "agent_port": ports.get("agent", default_agent_port),
                "vnc_port": ports.get("vnc", 5901),
                "websocket_port": ports.get("websocket", 6080),
                "machine_name": machine.get("display_name", "Local VM"),
                "vnc_password": machine.get("vnc_password", "coasty123"),  # Include password
                "is_local": True
            }
        
        # Azure machine
        return {
            "public_ip": machine.get("public_ip_address"),
            "agent_port": machine.get("ai_agent_port", 8080),
            "vnc_port": machine.get("vnc_port", 5901),
            "websocket_port": machine.get("websocket_port", 6080),
            "machine_name": machine.get("display_name", "VM Desktop"),
            "vnc_password": machine.get("vnc_password"),  # Include password for authentication
            "is_local": False
        }
    except Exception as e:
        logger.error(f"Error getting machine connection info: {str(e)}")
        return None



@router.post("/")
async def chat_endpoint(
    request: Request,
    chat_request: ChatRequest,
    user_id: str = Depends(get_verified_user_id),
) -> StreamingResponse:
    """
    Main chat endpoint - handles streaming responses with tool support
    """
    try:
        # Validate request
        if not chat_request.messages or not chat_request.chat_id:
            raise HTTPException(status_code=400, detail="Missing required fields")

        # Require machine_id for all chat requests
        if not chat_request.machine_id:
            raise HTTPException(status_code=400, detail="machine_id is required. Please select a machine.")

        logger.info(f"Virtual machine selected: {chat_request.machine_id} for chat {chat_request.chat_id}")

        # Check usage limits
        can_proceed = await usage_tracker.check_and_increment(
            user_id=user_id,
            model=chat_request.model,
            is_authenticated=True,
        )

        if not can_proceed:
            raise HTTPException(status_code=429, detail="Usage limit exceeded")
        
        # Log user message
        user_message = chat_request.messages[-1]
        if user_message.role == "user":
            # Convert attachments to dict if they exist
            attachments_dict = None
            if user_message.attachments:
                attachments_dict = [att.dict() for att in user_message.attachments]
            
            await db_service.save_message({
                "chat_id": chat_request.chat_id,
                "user_id": user_id,
                "role": "user",
                "content": sanitize_content(user_message.content),
                "attachments": attachments_dict,
                "message_group_id": chat_request.message_group_id,
                "created_at": datetime.utcnow().isoformat()
            })
        
        # Get Bedrock provider (all models route through Bedrock)
        provider = provider_factory.get_provider(chat_request.model)
        provider.initialize()
        
        # Multi-agent execution with VM
        logger.info(f"Machine selected ({chat_request.machine_id}), using multi-agent execution")

        # Check if user has sufficient credits before starting
        balance_check = await agent_billing_service.check_balance_for_session(user_id)
        if not balance_check["can_start"]:
            raise HTTPException(
                status_code=402,  # Payment Required
                detail=f"Insufficient credits. You have {balance_check['current_balance']} credits, "
                       f"but need at least {balance_check['required_balance']} to start a session. "
                       f"Please purchase more credits to continue."
            )

        logger.info(f"User {user_id} has {balance_check['current_balance']} credits, "
                   f"estimated runtime: {balance_check['estimated_runtime_minutes']} minutes")

        # Get machine connection info
        connection_info = await get_machine_connection_info(
            chat_request.machine_id,
            user_id
        )

        if not connection_info:
            raise HTTPException(status_code=404, detail=f"Machine {chat_request.machine_id} not found or not running. It may have been stopped or terminated.")

        # Start billing session
        billing_session_id = await agent_billing_service.start_session(
            user_id=user_id,
            machine_id=chat_request.machine_id,
            session_type="ai_controlled",
            ai_model=chat_request.model,
            ai_objective=chat_request.messages[-1].content if chat_request.messages else None
        )

        if not billing_session_id:
            raise HTTPException(
                status_code=402,
                detail="Failed to start billing session. Please check your credit balance."
            )

        logger.info(f"Started billing session {billing_session_id} for user {user_id}")

        # Pre-establish connection to VM agent
        if connection_info.get("is_electron"):
            # Electron connections are already established via the /api/electron/ws endpoint.
            # If the connection isn't present yet (app still reconnecting after a
            # brief drop), wait up to 20s for it instead of failing immediately.
            if chat_request.machine_id not in vm_control_service.connections:
                logger.info(f"Electron connection not present for {chat_request.machine_id}, waiting for reconnect...")
                reconnected = await vm_control_service._wait_for_electron_reconnect(
                    chat_request.machine_id
                )
                if not reconnected:
                    raise HTTPException(
                        status_code=503,
                        detail="Electron desktop app is not connected. Please ensure the app is running."
                    )
            logger.info(f"Using existing Electron connection for {chat_request.machine_id}")
        else:
            try:
                # Use port 8081 for localhost, 8080 for others (unless explicitly set)
                public_ip = connection_info["public_ip"]
                default_port = 8081 if public_ip == "localhost" else 8080
                agent_port = connection_info.get("agent_port", default_port)

                connected = await vm_control_service.connect_to_agent(
                    chat_request.machine_id,
                    public_ip,
                    agent_port,
                    connection_info.get("session_id"),
                    connection_info.get("user_id"),
                    connection_info.get("vnc_password")  # Pass the password
                )
                if not connected:
                    logger.warning(f"Failed to connect to VM {chat_request.machine_id}")
            except Exception as e:
                logger.error(f"Error connecting to VM: {str(e)}")

        # Use the model from backend settings (env-configurable), not from frontend
        bedrock_model = settings.BEDROCK_DEFAULT_MODEL

        # Initialize executor — CUA or legacy multi-agent based on feature flag
        use_cua = os.environ.get("USE_CUA_EXECUTOR", "true").lower() == "true"

        if use_cua:
            executor = CUAExecutor(
                machine_id=chat_request.machine_id,
                connection_info=connection_info,
                provider=provider,
                model=bedrock_model,
                temperature=1.0,
                max_tokens=None,
            )
            logger.info(f"Using CUA executor with model {bedrock_model}")
        else:
            executor = MultiAgentExecutor(
                machine_id=chat_request.machine_id,
                connection_info=connection_info,
                provider=provider,
                model=bedrock_model,
                temperature=1.0,
                max_tokens=None,
            )
            logger.info(f"Using legacy multi-agent executor with model {bedrock_model}")

        # Get user request and context
        user_request = chat_request.messages[-1].content if chat_request.messages else ""
        context = None
        continuation_context = None

        # Check if this is a continuation after waiting for user input
        # Look for a special marker in recent assistant messages
        if len(chat_request.messages) > 1:
            # Check if the previous assistant message indicates waiting for user input
            for msg in reversed(chat_request.messages[:-1]):
                if msg.role == "assistant" and "[Waiting for your response...]" in msg.content:
                    # This is a continuation - extract metadata if available
                    # For now, we'll pass the conversation as context
                    logger.info("Detected continuation after user input request")
                    # Note: In a production system, you'd store and retrieve the actual plan state
                    # For now, we'll let the executor handle it as a new request with context
                    break

            # Build conversation context
            context = "Previous conversation:\n"
            for msg in chat_request.messages[:-1][-5:]:  # Last 5 messages for context
                context += f"{msg.role}: {msg.content[:500]}...\n"

        # Stream multi-agent execution
        async def stream_multi_agent_response():
            """Stream multi-agent execution with per-step billing and incremental DB saves."""
            completion_status = "failed"  # Default to failed, update on success
            error_message = None
            was_cancelled = False
            execution_lock = None
            llm_usage = None  # Populated from CUA executor finish metadata

            # Track the DB message ID so we INSERT once then UPDATE on each step
            assistant_message_id: Optional[str] = None

            # Acquire per-machine execution lock to prevent concurrent use
            machine_id = chat_request.machine_id
            chat_id = chat_request.chat_id
            execution_lock = vm_control_service.get_execution_lock(machine_id)
            try:
                await asyncio.wait_for(execution_lock.acquire(), timeout=5.0)
            except asyncio.TimeoutError:
                # If a cancellation was already requested (user force-stopped via
                # the override button), the previous task is likely stuck in its
                # cleanup phase (billing / DB saves).  Replace the stale lock so
                # the new request can proceed immediately.
                cancel_event = vm_control_service.get_cancellation_event(machine_id)
                if cancel_event.is_set():
                    logger.warning(
                        f"Machine {machine_id} lock stuck after cancellation — "
                        f"replacing lock for chat {chat_id}"
                    )
                    new_lock = asyncio.Lock()
                    vm_control_service.execution_locks[machine_id] = new_lock
                    execution_lock = new_lock
                    await execution_lock.acquire()
                else:
                    busy, owner_chat = vm_control_service.is_machine_busy(machine_id)
                    logger.warning(f"Machine {machine_id} is busy (owner: {owner_chat}), rejecting chat {chat_id}")
                    yield f'3:{json.dumps("This machine is currently busy with another task. Please wait or use a different machine.")}\n\n'
                    yield f'd:{json.dumps({"finishReason": "error"})}\n\n'
                    return
            vm_control_service.execution_owners[machine_id] = chat_id
            vm_control_service.reset_cancellation(machine_id)

            try:
                all_content = ""
                all_tool_invocations = []
                screenshot_store: Dict[str, str] = {}  # toolCallId → base64, from CUA executor
                chunk_count = 0
                stream_cancelled = False

                logger.info("Starting to stream multi-agent response")

                async for chunk in executor.stream_execution(user_request, context, continuation_context):
                    # Check if client disconnected
                    if request and await request.is_disconnected():
                        stream_cancelled = True
                        logger.info("Client disconnected during multi-agent execution, stopping stream")
                        break

                    # Check if another request force-stopped this execution
                    if vm_control_service.get_cancellation_event(machine_id).is_set():
                        stream_cancelled = True
                        logger.info(f"Execution on {machine_id} force-stopped by another request")
                        break

                    chunk_count += 1
                    chunk_type = chunk.get("type")
                    logger.debug(f"Streaming chunk {chunk_count} of type: {chunk_type}")

                    # Format chunks for SSE based on type
                    if chunk_type == "keepalive":
                        # Send empty text delta to keep connection alive.
                        # SSE comments (":\n\n") break the Vercel AI SDK
                        # stream parser which expects "<code>:<data>" format.
                        yield f'0:{json.dumps("")}\n\n'

                    elif chunk_type == "text":
                        content = chunk.get("content", "")
                        if content:
                            all_content += content
                            yield f"0:{json.dumps(content)}\n\n"

                    elif chunk_type == "tool_call":
                        tool_call_id = chunk.get("toolCallId") or chunk.get("id", str(uuid.uuid4()))
                        tool_name = chunk.get("toolName") or chunk.get("tool") or chunk.get("name", "")
                        tool_args = chunk.get("args") or {}

                        tool_call = {
                            "toolCallId": tool_call_id,
                            "toolName": tool_name,
                            "args": tool_args,
                        }
                        all_tool_invocations.append(tool_call)

                        frontend_chunk = {
                            "toolCallId": tool_call_id,
                            "toolName": tool_name,
                            "args": tool_args,
                        }
                        yield f"9:{json.dumps(frontend_chunk)}\n\n"

                    elif chunk_type == "tool_result":
                        tool_call_id = chunk.get("toolCallId") or chunk.get("id", "")
                        result = chunk.get("result")
                        screenshot = chunk.get("frontendScreenshot")

                        for tool_inv in all_tool_invocations:
                            if tool_inv.get("toolCallId") == tool_call_id:
                                tool_inv["result"] = result
                                break

                        # Store screenshot separately — merged into invocations
                        # only at DB save time to keep in-memory list lightweight
                        if screenshot:
                            screenshot_store[tool_call_id] = screenshot

                        # Embed screenshot INSIDE result so Vercel AI SDK
                        # carries it through to toolInvocation.result on the frontend
                        frontend_result = result
                        if screenshot:
                            if isinstance(result, dict):
                                frontend_result = {**result, "frontendScreenshot": screenshot}
                            else:
                                frontend_result = {"_result": result, "frontendScreenshot": screenshot}

                        frontend_chunk = {
                            "toolCallId": tool_call_id,
                            "result": frontend_result,
                        }
                        yield f"a:{json.dumps(frontend_chunk)}\n\n"

                    elif chunk_type == "reasoning":
                        yield f"g:{json.dumps(chunk.get('content', ''))}\n\n"

                    elif chunk_type == "error":
                        error_content = chunk.get("content", "Unknown error")
                        all_content += f"\n{error_content}\n"
                        yield f"3:{json.dumps(str(error_content))}\n\n"

                    elif chunk_type == "user_input_required":
                        logger.info(f"User input requested: {chunk.get('question', '')}")

                    elif chunk_type == "step_complete":
                        # ── Per-step billing ──
                        step_num = chunk.get("step", 0)
                        step_content = chunk.get("content", all_content)
                        step_tools = chunk.get("tool_invocations", all_tool_invocations)

                        # Pick up the screenshot store from executor (if CUA)
                        chunk_ss_store = chunk.get("screenshot_store")
                        if chunk_ss_store:
                            screenshot_store.update(chunk_ss_store)

                        try:
                            billing_info = await agent_billing_service.charge_step(
                                billing_session_id, step_num
                            )
                            if billing_info.get("charged", 0) > 0:
                                logger.info(
                                    f"Step {step_num} billed: {billing_info['charged']} credits, "
                                    f"balance: {billing_info.get('remaining_balance', '?')}"
                                )
                            # Stop execution if user ran out of credits
                            if billing_info.get("should_stop"):
                                logger.warning("User out of credits — stopping execution")
                                stop_text = "\n[Session ended: insufficient credits]\n"
                                all_content += stop_text
                                yield f"0:{json.dumps(stop_text)}\n\n"
                                # Signal the executor to stop via cancellation event
                                vm_control_service.get_cancellation_event(machine_id).set()
                                stream_cancelled = True
                                break
                        except Exception as billing_err:
                            logger.error(f"Step billing error: {billing_err}")

                        # ── Incremental DB save ──
                        # Merge screenshots into a copy for persistence only
                        save_tools = _merge_screenshots(step_tools, screenshot_store)
                        try:
                            if assistant_message_id is None:
                                # First step — INSERT the message
                                save_result = await store_assistant_message(
                                    chat_id=chat_request.chat_id,
                                    content=step_content,
                                    tool_invocations=save_tools,
                                    model=chat_request.model,
                                    message_group_id=chat_request.message_group_id,
                                )
                                if save_result:
                                    assistant_message_id = save_result.get("id")
                                    logger.info(
                                        f"Created assistant message {assistant_message_id} at step {step_num}"
                                    )
                            else:
                                # Subsequent steps — UPDATE existing message
                                await update_assistant_message(
                                    assistant_message_id,
                                    step_content,
                                    save_tools,
                                )
                        except Exception as save_err:
                            logger.error(f"Step DB save error: {save_err}")

                    elif chunk_type == "finish":
                        completion_status = "completed"

                        # Capture LLM usage from executor metadata
                        finish_metadata = chunk.get("metadata", {})
                        llm_usage = finish_metadata.get("llm_usage")

                        # Pick up any final screenshot store updates
                        chunk_ss_store = chunk.get("screenshot_store")
                        if chunk_ss_store:
                            screenshot_store.update(chunk_ss_store)

                        chunk_content = chunk.get("content", "")
                        final_content = chunk_content if chunk_content else all_content
                        final_tool_invocations = chunk.get("tool_invocations", all_tool_invocations)

                        logger.info(
                            f"Finish — content: {len(final_content)} chars, "
                            f"tools: {len(final_tool_invocations)}"
                        )

                        # Merge screenshots for DB persistence
                        save_tools = _merge_screenshots(final_tool_invocations, screenshot_store)

                        # Final DB save (update if already created, insert if not)
                        if assistant_message_id:
                            await update_assistant_message(
                                assistant_message_id,
                                final_content,
                                save_tools,
                            )
                        else:
                            await store_assistant_message(
                                chat_id=chat_request.chat_id,
                                content=final_content,
                                tool_invocations=save_tools,
                                model=chat_request.model,
                                message_group_id=chat_request.message_group_id,
                            )

                        # Send merged version to frontend finish event too
                        finish_data = {
                            "finishReason": "stop",
                            "content": final_content,
                            "toolInvocations": save_tools or [],
                        }
                        yield f"d:{json.dumps(finish_data)}\n\n"

                # Handle stream cancellation (client disconnect)
                if stream_cancelled and (all_content or all_tool_invocations):
                    completion_status = "cancelled"
                    cancelled_content = (
                        all_content + "\n\n[Response stopped by user]"
                        if all_content
                        else "[Response stopped by user]"
                    )

                    # Merge screenshots for DB persistence
                    save_tools = _merge_screenshots(all_tool_invocations, screenshot_store)

                    try:
                        if assistant_message_id:
                            await update_assistant_message(
                                assistant_message_id,
                                cancelled_content,
                                save_tools,
                            )
                        else:
                            await store_assistant_message(
                                chat_id=chat_request.chat_id,
                                content=cancelled_content,
                                tool_invocations=save_tools,
                                model=chat_request.model,
                                message_group_id=chat_request.message_group_id,
                            )

                        finish_data = {
                            "finishReason": "cancelled",
                            "content": cancelled_content,
                            "toolInvocations": save_tools or [],
                        }
                        yield f"d:{json.dumps(finish_data)}\n\n"
                    except Exception as save_error:
                        logger.error(f"Failed to save cancelled message: {save_error}")

                logger.info(f"Finished streaming {chunk_count} chunks")

            except asyncio.CancelledError:
                completion_status = "cancelled"
                error_message = "Stream cancelled by client"
                logger.info(
                    f"Stream cancelled (asyncio) — {len(all_content)} chars, "
                    f"{len(all_tool_invocations)} tools"
                )

                cancelled_content = (
                    all_content + "\n\n[Response stopped by user]"
                    if all_content
                    else "[Response stopped by user]"
                )

                # Merge screenshots for DB persistence
                save_tools = _merge_screenshots(all_tool_invocations, screenshot_store)

                try:
                    if assistant_message_id:
                        await update_assistant_message(
                            assistant_message_id,
                            cancelled_content,
                            save_tools,
                        )
                    else:
                        await store_assistant_message(
                            chat_id=chat_request.chat_id,
                            content=cancelled_content,
                            tool_invocations=save_tools,
                            model=chat_request.model,
                            message_group_id=chat_request.message_group_id,
                        )

                    try:
                        finish_data = {
                            "finishReason": "cancelled",
                            "content": cancelled_content,
                            "toolInvocations": save_tools or [],
                        }
                        yield f"d:{json.dumps(finish_data)}\n\n"
                    except Exception:
                        pass  # Connection might be closed

                except Exception as save_error:
                    logger.error(f"Failed to save partial message: {save_error}", exc_info=True)

                was_cancelled = True

            except Exception as e:
                error_message = str(e)
                logger.error(f"Error in multi-agent streaming: {error_message}", exc_info=True)
                yield f"3:{json.dumps(error_message)}\n\n"

            finally:
                # Always end the billing session (charges only the uncharged remainder)
                try:
                    billing_summary = await agent_billing_service.end_session(
                        billing_session_id,
                        completion_status,
                        error_message,
                    )

                    logger.info(
                        f"Billing summary for session {billing_session_id}: "
                        f"{billing_summary.get('duration_minutes', 0)} min, "
                        f"{billing_summary.get('credits_charged', 0)} credits total, "
                        f"balance: {billing_summary.get('final_balance', 0)}"
                    )

                except Exception as billing_error:
                    logger.error(f"Failed to end billing session: {billing_error}")

                # Persist LLM usage to database for analytics.
                # If stream was interrupted before the finish chunk, collect
                # usage directly from the executor's engine instances.
                if not llm_usage and use_cua and hasattr(executor, "collect_usage"):
                    try:
                        llm_usage = executor.collect_usage()
                    except Exception as collect_err:
                        logger.error(f"Failed to collect LLM usage from executor: {collect_err}")

                if llm_usage and llm_usage.get("total_calls", 0) > 0:
                    try:
                        await db_service.save_llm_usage(
                            user_id=user_id,
                            chat_id=chat_request.chat_id,
                            session_id=billing_session_id,
                            model=chat_request.model,
                            llm_usage=llm_usage,
                        )
                    except Exception as usage_err:
                        logger.error(f"Failed to save LLM usage: {usage_err}")

                # Release per-machine execution lock
                if execution_lock is not None and execution_lock.locked():
                    vm_control_service.execution_owners.pop(machine_id, None)
                    execution_lock.release()

                if was_cancelled:
                    logger.debug("Re-raising CancelledError after cleanup")
                    raise asyncio.CancelledError()

        return StreamingResponse(
            stream_multi_agent_response(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Disable Nginx buffering
                "Transfer-Encoding": "chunked",
                "Content-Encoding": "none",  # Ensure no compression
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat endpoint error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/feedback")
async def chat_feedback(
    request: Request,
    feedback: Dict
):
    """Submit feedback for a chat response"""
    try:
        # Store feedback in database
        await db_service.save_feedback(feedback)
        return {"success": True}
    except Exception as e:
        logger.error(f"Feedback error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to save feedback")


@router.get("/machine-status/{machine_id}")
async def get_machine_execution_status(
    machine_id: str,
    user_id: str = Depends(get_verified_user_id),
):
    """Check if a machine is currently busy executing a task."""
    busy, owner_chat_id = vm_control_service.is_machine_busy(machine_id)
    return {"busy": busy, "ownerChatId": owner_chat_id}


@router.post("/stop-machine/{machine_id}")
async def stop_machine_execution(
    machine_id: str,
    user_id: str = Depends(get_verified_user_id),
):
    """Force-stop the current execution on a machine.

    Sets a cancellation event that the running stream checks on each iteration.
    The active execution will break, save partial progress, end billing, and release the lock.
    """
    busy, owner_chat_id = vm_control_service.is_machine_busy(machine_id)

    if not busy:
        return {"stopped": False, "reason": "Machine is not busy", "ownerChatId": None}

    vm_control_service.request_cancellation(machine_id)

    # Wait for the lock to actually release (up to 5s)
    lock = vm_control_service.get_execution_lock(machine_id)
    released = False
    for _ in range(50):
        if not lock.locked():
            released = True
            break
        await asyncio.sleep(0.1)

    return {
        "stopped": True,
        "released": released,
        "ownerChatId": owner_chat_id,
    }