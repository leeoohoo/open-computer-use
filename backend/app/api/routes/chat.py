"""
Chat API endpoints - Main chat functionality
"""

import json
import logging
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime
import uuid

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.models.chat import ChatRequest
from app.services.auth import validate_user
from app.services.database import DatabaseService
from app.services.usage_tracker import UsageTracker
from app.services.vm_control import vm_control_service
from app.services.agent_billing import agent_billing_service
from app.utils.sanitize import sanitize_content
from app.providers.provider_factory import ProviderFactory
from app.services.multi_agent_executor import MultiAgentExecutor

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize services
db_service = DatabaseService()
usage_tracker = UsageTracker()
provider_factory = ProviderFactory()


async def store_assistant_message(
    chat_id: str,
    content: str,
    tool_invocations: List[Dict],
    model: str,
    message_group_id: Optional[str] = None
):
    """Store assistant message in database with improved error handling"""
    try:
        # Debug logging
        logger.info(f"[store_assistant_message] Storing message for chat {chat_id}")
        logger.info(f"[store_assistant_message] Content length: {len(content)}")
        logger.info(f"[store_assistant_message] Tool invocations: {len(tool_invocations) if tool_invocations else 0}")
        
        # Sanitize content
        sanitized = sanitize_content(content)
        
        # Log content size but don't truncate
        if len(sanitized) > 1000000:  # 1MB
            logger.info(f"Large content detected ({len(sanitized)} chars), saving as-is")
        
        message_data = {
            "chat_id": chat_id,
            "role": "assistant",
            "content": sanitized,
            "model": model,
            "message_group_id": message_group_id,
            "created_at": datetime.utcnow().isoformat()
        }
        
        # Transform tool invocations to frontend expected format for parts
        if tool_invocations:
            logger.debug(f"Processing {len(tool_invocations)} tool invocations for storage")
            parts = []
            for tool_inv in tool_invocations:
                tool_invocation_data = {
                    "toolCallId": tool_inv.get("toolCallId", tool_inv.get("id", "")),
                    "toolName": tool_inv.get("toolName", ""),
                    "args": tool_inv.get("args", {}),
                    "state": "result"  # Stored invocations are completed
                }
                # Include result if present
                if "result" in tool_inv:
                    result = tool_inv["result"]
                    tool_invocation_data["result"] = result
                
                # Include frontendScreenshot if present (already compressed)
                if "frontendScreenshot" in tool_inv:
                    tool_invocation_data["frontendScreenshot"] = tool_inv["frontendScreenshot"]
                    screenshot_size = len(tool_inv["frontendScreenshot"])
                    if screenshot_size > 100000:  # 100KB
                        logger.info(f"Large compressed screenshot being stored inline: {screenshot_size:,} chars")
                
                parts.append({
                    "type": "tool-invocation",
                    "toolInvocation": tool_invocation_data
                })
            message_data["parts"] = parts
            logger.debug(f"Prepared {len(parts)} parts for storage")
        
        # Attempt to save with the improved retry logic
        logger.info(f"[store_assistant_message] Calling db_service.save_message for chat {chat_id}")
        result = await db_service.save_message(message_data)
        
        if result:
            logger.info(f"[store_assistant_message] Successfully stored message for chat {chat_id} - "
                       f"message ID: {result.get('id', 'unknown')}")
        else:
            logger.warning(f"[store_assistant_message] Message save returned None for chat {chat_id}, but continuing")
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to store assistant message: {str(e)}", exc_info=True)
        # Don't re-raise - we don't want to break the chat flow
        return None




async def get_machine_connection_info(machine_id: str, user_id: str) -> Optional[Dict]:
    """Get machine connection information from database or detect local Docker"""
    try:
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
                "vnc_password": "llmhub123",  # Local containers may have different auth
                "is_local": True
            }
        
        # Get machine details from database (Azure machines)
        machine = await db_service.get_machine(machine_id, user_id)
        if not machine:
            logger.error(f"Machine {machine_id} not found for user {user_id}")
            return None
        
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
                "vnc_password": machine.get("vnc_password", "llmhub123"),  # Include password
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
    chat_request: ChatRequest
) -> StreamingResponse:
    """
    Main chat endpoint - handles streaming responses with tool support
    """
    try:
        # Validate request
        if not chat_request.messages or not chat_request.chat_id or not chat_request.user_id:
            raise HTTPException(status_code=400, detail="Missing required fields")

        # Require machine_id for all chat requests
        if not chat_request.machine_id:
            raise HTTPException(status_code=400, detail="machine_id is required. Please select a machine.")

        logger.info(f"Virtual machine selected: {chat_request.machine_id} for chat {chat_request.chat_id}")
        
        # Validate user and check usage
        if chat_request.is_authenticated:
            user = await validate_user(chat_request.user_id)
            if not user:
                raise HTTPException(status_code=401, detail="Invalid user")
            
            # Check usage limits
            can_proceed = await usage_tracker.check_and_increment(
                user_id=chat_request.user_id,
                model=chat_request.model,
                is_authenticated=chat_request.is_authenticated
            )
            
            if not can_proceed:
                raise HTTPException(status_code=429, detail="Usage limit exceeded")
        else:
            # Check if model is allowed for unauthenticated users
            if chat_request.model not in settings.NON_AUTH_ALLOWED_MODELS:
                raise HTTPException(
                    status_code=403,
                    detail="This model requires authentication"
                )
        
        # Log user message
        user_message = chat_request.messages[-1]
        if user_message.role == "user":
            # Convert attachments to dict if they exist
            attachments_dict = None
            if user_message.attachments:
                attachments_dict = [att.dict() for att in user_message.attachments]
            
            await db_service.save_message({
                "chat_id": chat_request.chat_id,
                "user_id": chat_request.user_id,
                "role": "user",
                "content": sanitize_content(user_message.content),
                "attachments": attachments_dict,
                "message_group_id": chat_request.message_group_id,
                "created_at": datetime.utcnow().isoformat()
            })
        
        # Get provider for the model
        provider = provider_factory.get_provider(chat_request.model)
        if not provider:
            raise HTTPException(status_code=400, detail=f"Model {chat_request.model} not supported")
        
        # Get API key (either from settings or user's BYOK)
        api_key = None
        
        if not api_key:
            api_key = settings.get_provider_api_key(provider.name)
        
        if not api_key and chat_request.model not in settings.FREE_MODELS:
            raise HTTPException(
                status_code=403,
                detail=f"API key required for {provider.name}"
            )
        
        # Initialize provider with API key
        provider.initialize(api_key)
        
        # Multi-agent execution with VM
        logger.info(f"Machine selected ({chat_request.machine_id}), using multi-agent execution")

        # Check if user has sufficient credits before starting
        balance_check = await agent_billing_service.check_balance_for_session(chat_request.user_id)
        if not balance_check["can_start"]:
            raise HTTPException(
                status_code=402,  # Payment Required
                detail=f"Insufficient credits. You have {balance_check['current_balance']} credits, "
                       f"but need at least {balance_check['required_balance']} to start a session. "
                       f"Please purchase more credits to continue."
            )

        logger.info(f"User {chat_request.user_id} has {balance_check['current_balance']} credits, "
                   f"estimated runtime: {balance_check['estimated_runtime_minutes']} minutes")

        # Get machine connection info
        connection_info = await get_machine_connection_info(
            chat_request.machine_id,
            chat_request.user_id
        )

        if not connection_info:
            raise HTTPException(status_code=404, detail=f"Machine {chat_request.machine_id} not found or not running")

        # Start billing session
        billing_session_id = await agent_billing_service.start_session(
            user_id=chat_request.user_id,
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

        logger.info(f"Started billing session {billing_session_id} for user {chat_request.user_id}")

        # Pre-establish connection to VM agent
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

        # Initialize multi-agent executor
        executor = MultiAgentExecutor(
            machine_id=chat_request.machine_id,
            connection_info=connection_info,
            provider=provider,
            model=chat_request.model,
            temperature=1.0,
            max_tokens=None
        )

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
            """Stream multi-agent execution with proper SSE formatting and billing"""
            completion_status = "failed"  # Default to failed, update on success
            error_message = None
            was_cancelled = False  # Track if we got CancelledError

            try:
                all_content = ""
                all_tool_invocations = []
                chunk_count = 0
                stream_cancelled = False

                logger.info("Starting to stream multi-agent response")

                async for chunk in executor.stream_execution(user_request, context, continuation_context):
                    # Check if client disconnected
                    if request and await request.is_disconnected():
                        stream_cancelled = True
                        logger.info("Client disconnected during multi-agent execution, stopping stream")
                        break

                    chunk_count += 1
                    chunk_type = chunk.get("type")
                    logger.debug(f"Streaming chunk {chunk_count} of type: {chunk_type}")

                    # Format chunks for SSE based on type
                    if chunk_type == "text":
                        content = chunk.get("content", "")
                        if content:  # Only send if there's actual content
                            all_content += content
                            yield f"0:{json.dumps(content)}\n\n"

                    elif chunk_type == "tool_call":
                        # Extract fields from chunk (which comes from multi-agent executor)
                        tool_call_id = chunk.get("toolCallId") or chunk.get("id", str(uuid.uuid4()))
                        tool_name = chunk.get("toolName") or chunk.get("tool") or chunk.get("name", "")
                        tool_args = chunk.get("args") or {}

                        # Track for storage
                        tool_call = {
                            "toolCallId": tool_call_id,
                            "toolName": tool_name,
                            "args": tool_args
                        }
                        all_tool_invocations.append(tool_call)

                        # Send to frontend - AI SDK expects ONLY these three fields (no type field)
                        frontend_chunk = {
                            "toolCallId": tool_call_id,
                            "toolName": tool_name,
                            "args": tool_args
                        }
                        logger.debug(f"Multi-agent sending tool call: {json.dumps(frontend_chunk)}")
                        yield f"9:{json.dumps(frontend_chunk)}\n\n"

                    elif chunk_type == "tool_result":
                        # Extract fields from chunk
                        tool_call_id = chunk.get("toolCallId") or chunk.get("id", "")
                        result = chunk.get("result")

                        # Find the matching tool call and update it with the result
                        for tool_inv in all_tool_invocations:
                            if tool_inv.get("toolCallId") == tool_call_id:
                                tool_inv["result"] = result
                                break

                        # Send to frontend - AI SDK expects specific format
                        frontend_chunk = {
                            "toolCallId": tool_call_id,
                            "result": result
                        }
                        yield f"a:{json.dumps(frontend_chunk)}\n\n"

                    elif chunk_type == "reasoning":
                        yield f"2:{json.dumps({'reasoning': chunk.get('content', '')})}\n\n"

                    elif chunk_type == "user_input_required":
                        # This indicates the agent needs user input
                        logger.info(f"User input requested: {chunk.get('question', '')}")
                        # The actual user input prompt is sent as text, this is just metadata

                    elif chunk_type == "finish":
                        # Mark execution as successful
                        completion_status = "completed"

                        # Store final message with all content and tool invocations
                        # IMPORTANT: Use content from chunk (MultiAgentExecutor's accumulated content)
                        # which includes task plan markers, status updates, etc.
                        chunk_content = chunk.get("content", "")
                        chat_accumulated = all_content

                        # Use the chunk's content if provided (it should have everything)
                        final_content = chunk_content if chunk_content else chat_accumulated

                        # Log to debug what we're saving
                        logger.info(f"Multi-agent finish - chunk content length: {len(chunk_content)}, "
                                   f"chat accumulated length: {len(chat_accumulated)}, "
                                   f"using: {'chunk' if chunk_content else 'chat accumulated'}")

                        # Check for task plan markers
                        has_task_plan = "[TASK_PLAN_START]" in final_content
                        has_status = "[TASK_STATUS:" in final_content
                        logger.info(f"Content check - has task plan: {has_task_plan}, has status: {has_status}")

                        # Log first 500 chars for debugging
                        logger.info(f"Content preview: {final_content[:500]}...")

                        # Use tool invocations from chunk if available, otherwise use accumulated
                        final_tool_invocations = chunk.get("tool_invocations", all_tool_invocations)

                        logger.info(f"Saving to DB - content length: {len(final_content)}, "
                                   f"tool invocations: {len(final_tool_invocations)}")

                        # Note: Multi-agent executor already provides merged tool invocations with results
                        # from the finish chunk, so we can pass them directly
                        await store_assistant_message(
                            chat_id=chat_request.chat_id,
                            content=final_content,
                            tool_invocations=final_tool_invocations,
                            model=chat_request.model,
                            message_group_id=chat_request.message_group_id
                        )

                        # Send finish event with content and tool invocations for frontend
                        finish_data = {
                            'finishReason': 'stop',
                            'content': final_content,
                            'toolInvocations': final_tool_invocations if final_tool_invocations else []
                        }
                        yield f"d:{json.dumps(finish_data)}\n\n"

                # Check if stream was cancelled and save partial message
                if stream_cancelled and (all_content or all_tool_invocations):
                    completion_status = "cancelled"
                    logger.info(f"Saving partial multi-agent message after stream cancellation - "
                               f"content: {len(all_content)} chars, tool invocations: {len(all_tool_invocations)}")

                    # Log tool invocation details
                    for idx, tool_inv in enumerate(all_tool_invocations):
                        has_result = "result" in tool_inv
                        logger.debug(f"Tool invocation {idx}: {tool_inv.get('toolName')} "
                                   f"(ID: {tool_inv.get('toolCallId')[:8]}...) has_result: {has_result}")

                    try:
                        await store_assistant_message(
                            chat_id=chat_request.chat_id,
                            content=all_content + "\n\n[Response stopped by user]" if all_content else "[Response stopped by user]",
                            tool_invocations=all_tool_invocations,
                            model=chat_request.model,
                            message_group_id=chat_request.message_group_id
                        )
                        # Send finish event for the partial message
                        finish_data = {
                            'finishReason': 'cancelled',
                            'content': all_content + "\n\n[Response stopped by user]" if all_content else "[Response stopped by user]",
                            'toolInvocations': all_tool_invocations if all_tool_invocations else []
                        }
                        yield f"d:{json.dumps(finish_data)}\n\n"
                        logger.info(f"Saved partial multi-agent message with {len(all_content)} chars and "
                                   f"{len(all_tool_invocations)} tool invocations after cancellation")
                    except Exception as save_error:
                        logger.error(f"Failed to save partial multi-agent message after cancellation: {save_error}")

                logger.info(f"Finished streaming {chunk_count} chunks")
            except asyncio.CancelledError:
                # Handle asyncio cancellation
                completion_status = "cancelled"
                error_message = "Stream cancelled by client"
                logger.info(f"Multi-agent stream cancelled by client disconnect (asyncio) - "
                           f"content: {len(all_content)} chars, tool invocations: {len(all_tool_invocations)}")

                # Log tool invocation details
                for idx, tool_inv in enumerate(all_tool_invocations):
                    has_result = "result" in tool_inv
                    logger.debug(f"Tool invocation {idx}: {tool_inv.get('toolName')} "
                               f"(ID: {tool_inv.get('toolCallId')[:8]}...) has_result: {has_result}")

                # Save partial message if we have content - MUST complete before re-raising
                if all_content or all_tool_invocations:
                    try:
                        # Create a task to ensure it completes
                        save_result = await store_assistant_message(
                            chat_id=chat_request.chat_id,
                            content=all_content + "\n\n[Response stopped by user]" if all_content else "[Response stopped by user]",
                            tool_invocations=all_tool_invocations,
                            model=chat_request.model,
                            message_group_id=chat_request.message_group_id
                        )

                        if save_result:
                            logger.info(f"Successfully saved partial multi-agent message with {len(all_content)} chars and "
                                       f"{len(all_tool_invocations)} tool invocations")
                        else:
                            logger.warning(f"Save returned None for partial message")

                        # Try to send finish event (might fail if connection is closed)
                        try:
                            finish_data = {
                                'finishReason': 'cancelled',
                                'content': all_content + "\n\n[Response stopped by user]" if all_content else "[Response stopped by user]",
                                'toolInvocations': all_tool_invocations if all_tool_invocations else []
                            }
                            yield f"d:{json.dumps(finish_data)}\n\n"
                        except:
                            pass  # Connection might be closed, that's ok

                    except Exception as save_error:
                        logger.error(f"Failed to save partial multi-agent message: {save_error}", exc_info=True)

                # Mark that we got cancelled so we can re-raise after finally
                was_cancelled = True

            except Exception as e:
                error_message = str(e)
                logger.error(f"Error in multi-agent streaming: {error_message}", exc_info=True)
                yield f"3:{json.dumps({'error': error_message})}\n\n"

            finally:
                # Always end the billing session
                try:
                    billing_summary = await agent_billing_service.end_session(
                        billing_session_id,
                        completion_status,
                        error_message
                    )

                    # Log billing summary
                    logger.info(f"Billing summary for session {billing_session_id}: "
                               f"{billing_summary.get('duration_minutes', 0)} minutes, "
                               f"{billing_summary.get('credits_charged', 0)} credits charged, "
                               f"final balance: {billing_summary.get('final_balance', 0)}")

                    # Don't send billing event as it's not a standard SSE event type
                    # The frontend doesn't need to know about billing details in the stream

                except Exception as billing_error:
                    logger.error(f"Failed to end billing session: {str(billing_error)}")

                # Re-raise CancelledError if we got one, after finally block completes
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