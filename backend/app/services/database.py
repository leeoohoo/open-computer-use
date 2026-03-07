"""
Database service for Supabase operations
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
import json
import hashlib

from supabase import create_client, Client
from app.core.config import settings
from app.utils.content_sanitizer import ContentSanitizer
import asyncio
from functools import wraps

logger = logging.getLogger(__name__)


class DatabaseService:
    """Service for database operations"""
    
    def __init__(self):
        self.client: Optional[Client] = None
        self._initialize()
    
    def _initialize(self):
        """Initialize Supabase client with optimized settings"""
        try:
            if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE:
                # Create client with custom options for better performance
                self.client = create_client(
                    settings.SUPABASE_URL,
                    settings.SUPABASE_SERVICE_ROLE
                )
                # Set custom timeout for the client's session
                if hasattr(self.client, 'postgrest') and hasattr(self.client.postgrest, 'session'):
                    # Increase timeout for large operations (screenshots, etc)
                    self.client.postgrest.session.timeout = 60  # 60 seconds for large content
                    
                logger.info("Supabase client initialized successfully with optimized settings")
            else:
                logger.warning("Supabase credentials not configured")
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {str(e)}")
    
    async def save_message(self, message_data: Dict[str, Any]) -> Optional[Dict]:
        """Save a chat message directly without compression or chunking"""
        if not self.client:
            logger.warning("Database client not initialized")
            return None
        
        max_retries = 3
        retry_delay = 1  # seconds
        
        # Process data before saving
        try:
            # Sanitize the message data to remove null bytes and invalid Unicode
            sanitized_message_data = ContentSanitizer.sanitize_message_data(message_data)
            
            # Create a copy for database operations
            data = sanitized_message_data.copy()
            
            # Remove fields that don't exist in the database
            if "attachments" in data:
                attachments = data.pop("attachments")
                # Ensure attachments are serializable (convert objects to dicts if needed)
                if attachments:
                    if isinstance(attachments, list):
                        # Convert any Pydantic models to dicts
                        serializable_attachments = []
                        for att in attachments:
                            if hasattr(att, 'dict'):
                                serializable_attachments.append(att.dict())
                            elif isinstance(att, dict):
                                serializable_attachments.append(att)
                            else:
                                logger.warning(f"Skipping non-serializable attachment: {type(att)}")
                        data["experimental_attachments"] = serializable_attachments
                    else:
                        data["experimental_attachments"] = attachments
            
            # Handle parts (tool invocations) - check for inline screenshots
            if "parts" in data:
                # Log if parts contain screenshots
                if isinstance(data["parts"], list):
                    for part in data["parts"]:
                        if isinstance(part, dict) and "toolInvocation" in part:
                            tool_inv = part["toolInvocation"]
                            # Check for inline screenshot in the tool invocation itself
                            if "frontendScreenshot" in tool_inv:
                                screenshot_size = len(tool_inv["frontendScreenshot"])
                                logger.info(f"Tool invocation contains inline screenshot: {screenshot_size:,} chars")
                            # Also check in the result
                            result = tool_inv.get("result")
                            if isinstance(result, dict) and "frontendScreenshot" in result:
                                screenshot_size = len(result["frontendScreenshot"])
                                logger.info(f"Tool result contains inline screenshot: {screenshot_size:,} chars")
            
            # Handle tool_invocations (old field name)
            if "tool_invocations" in data:
                data["parts"] = data.pop("tool_invocations")
            
            if isinstance(data.get("content"), list):
                data["content"] = json.dumps(data["content"])
            
            # Validate content before saving
            if isinstance(data.get("content"), str):
                is_valid, error_msg = ContentSanitizer.validate_for_postgres(data["content"])
                if not is_valid:
                    logger.error(f"Content validation failed: {error_msg}")
                    # Re-sanitize more aggressively
                    data["content"] = ContentSanitizer.sanitize_content(data["content"])
                    logger.info("Content re-sanitized after validation failure")
                
                # Log large content
                if len(data["content"]) > 1000000:  # 1MB
                    logger.info(f"Large content detected ({len(data['content'])} chars), storing full content")
            
            # Enhanced retry logic with adaptive timeouts
            for attempt in range(max_retries):
                try:
                    # Calculate adaptive timeout based on content size
                    content_size = len(str(data.get("content", "")))
                    parts_size = len(json.dumps(data.get("parts", [])) if data.get("parts") else "")
                    total_size = content_size + parts_size
                    
                    # More generous timeout for large messages: base 60s + 20s per MB
                    timeout_seconds = 60.0 + (total_size / 1_000_000) * 20
                    timeout_seconds = min(timeout_seconds, 300.0)  # Cap at 5 minutes
                    
                    logger.debug(f"Attempt {attempt + 1}: Saving message with {total_size:,} bytes, timeout: {timeout_seconds:.1f}s")
                    
                    # Use asyncio to run the synchronous operation with adaptive timeout
                    loop = asyncio.get_event_loop()
                    response = await asyncio.wait_for(
                        loop.run_in_executor(
                            None,
                            lambda: self.client.table("messages").insert(data).execute()
                        ),
                        timeout=timeout_seconds
                    )
                    
                    if response and response.data:
                        logger.info(f"Successfully saved message to database (attempt {attempt + 1})")
                        return response.data[0]
                    else:
                        logger.warning(f"No data returned from insert (attempt {attempt + 1})")
                        return None
                        
                except asyncio.TimeoutError:
                    logger.warning(f"Database timeout on attempt {attempt + 1}/{max_retries}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2  # Exponential backoff
                    else:
                        logger.error("All retry attempts failed due to timeout")
                        # Return None but don't save a truncated version
                        return None
                            
                except Exception as e:
                    error_str = str(e)
                    is_transient = (
                        "statement timeout" in error_str.lower()
                        or "520" in error_str
                        or "502" in error_str
                        or "503" in error_str
                        or "504" in error_str
                        or "web server is returning an unknown error" in error_str.lower()
                        or "connection" in error_str.lower() and "error" in error_str.lower()
                    )
                    if is_transient and attempt < max_retries - 1:
                        logger.warning(f"Transient database error on attempt {attempt + 1}: {error_str[:200]}")
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2
                    else:
                        logger.error(f"Database error on attempt {attempt + 1}: {error_str[:200]}")
                        return None
            
            return None
            
        except Exception as e:
            logger.error(f"Error processing message data: {str(e)}")
            return None
    
    async def update_message(self, message_id: str, update_data: Dict[str, Any]) -> Optional[Dict]:
        """Update an existing message by ID.

        Used for incremental saves during long-running CUA sessions so that
        content and tool invocations are persisted after every step rather
        than only at the very end.
        """
        if not self.client:
            logger.warning("Database client not initialized")
            return None

        try:
            from app.utils.content_sanitizer import ContentSanitizer

            data = update_data.copy()

            # Sanitize content if present
            if "content" in data and isinstance(data["content"], str):
                data["content"] = ContentSanitizer.sanitize_content(data["content"])

            # Sanitize parts if present
            if "parts" in data and isinstance(data["parts"], list):
                for part in data["parts"]:
                    if isinstance(part, dict) and "toolInvocation" in part:
                        tool_inv = part["toolInvocation"]
                        for field in ("args", "result"):
                            if field in tool_inv and isinstance(tool_inv[field], str):
                                tool_inv[field] = ContentSanitizer.sanitize_content(tool_inv[field])

            content_size = len(str(data.get("content", "")))
            parts_size = len(json.dumps(data.get("parts", [])) if data.get("parts") else "")
            total_size = content_size + parts_size
            timeout_seconds = min(60.0 + (total_size / 1_000_000) * 20, 300.0)

            max_retries = 3
            retry_delay = 1

            for attempt in range(max_retries):
                try:
                    loop = asyncio.get_event_loop()
                    response = await asyncio.wait_for(
                        loop.run_in_executor(
                            None,
                            lambda: self.client.table("messages")
                                .update(data)
                                .eq("id", message_id)
                                .execute(),
                        ),
                        timeout=timeout_seconds,
                    )

                    if response and response.data:
                        logger.debug(f"Updated message {message_id} ({total_size:,} bytes)")
                        return response.data[0]
                    return None

                except asyncio.TimeoutError:
                    logger.warning(f"Timeout updating message {message_id} (attempt {attempt + 1}/{max_retries})")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2
                    else:
                        logger.error(f"All retry attempts failed for updating message {message_id} due to timeout")
                        return None

                except Exception as e:
                    error_str = str(e)
                    is_transient = (
                        "statement timeout" in error_str.lower()
                        or "520" in error_str
                        or "502" in error_str
                        or "503" in error_str
                        or "504" in error_str
                        or "web server is returning an unknown error" in error_str.lower()
                        or "connection" in error_str.lower() and "error" in error_str.lower()
                    )

                    if is_transient and attempt < max_retries - 1:
                        logger.warning(f"Transient error updating message {message_id} (attempt {attempt + 1}/{max_retries}): {error_str[:200]}")
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2
                    else:
                        logger.error(f"Error updating message {message_id} (attempt {attempt + 1}/{max_retries}): {error_str[:200]}")
                        return None

            return None

        except Exception as e:
            logger.error(f"Error processing update data: {str(e)}")
            return None

    async def get_chat_messages(
        self,
        chat_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict]:
        """Get messages for a chat with automatic reconstruction of chunked content"""
        if not self.client:
            return []
        
        try:
            response = (
                self.client.table("messages")
                .select("*")
                .eq("chat_id", chat_id)
                .order("created_at", desc=False)
                .limit(limit)
                .execute()
            )
            
            messages = response.data if response.data else []
            
            # Parse JSON fields and handle chunked/compressed content
            for msg in messages:
                # Handle chunked messages
                if msg.get("is_chunked") and msg.get("content"):
                    try:
                        content_meta = json.loads(msg["content"])
                        if isinstance(content_meta, dict) and content_meta.get("__chunked"):
                            # Reconstruct from chunks
                            logger.info(f"Reconstructing chunked message {content_meta.get('message_id')}")
                            reconstructed = await MessageOptimizer.reconstruct_from_chunks(
                                content_meta.get("message_id"),
                                self
                            )
                            if reconstructed:
                                msg["content"] = reconstructed
                            else:
                                # Use summary if reconstruction fails
                                msg["content"] = content_meta.get("summary", "[Failed to reconstruct content]")
                    except Exception as e:
                        logger.error(f"Failed to reconstruct chunked message: {str(e)}")
                
                # Handle compressed messages
                elif msg.get("is_compressed") and msg.get("content"):
                    try:
                        content_meta = json.loads(msg["content"])
                        if isinstance(content_meta, dict) and content_meta.get("__compressed"):
                            # Decompress content
                            decompressed = MessageOptimizer.decompress_content(content_meta.get("data"))
                            msg["content"] = decompressed
                    except Exception as e:
                        logger.error(f"Failed to decompress message: {str(e)}")
                
                # Parse remaining JSON fields
            for msg in messages:
                # Parse parts field (tool invocations)
                if msg.get("parts"):
                    if isinstance(msg["parts"], str):
                        try:
                            msg["parts"] = json.loads(msg["parts"])
                        except:
                            msg["parts"] = []
                    
                    # Transform parts to frontend expected format
                    if isinstance(msg["parts"], list):
                        transformed_parts = []
                        for part in msg["parts"]:
                            if isinstance(part, dict):
                                # Check if it's already in the correct format
                                if part.get("type") == "tool-invocation":
                                    transformed_parts.append(part)
                                # Transform from backend format to frontend format
                                elif "toolName" in part or "toolCallId" in part:
                                    transformed_parts.append({
                                        "type": "tool-invocation",
                                        "toolInvocation": {
                                            "toolCallId": part.get("toolCallId", part.get("id", "")),
                                            "toolName": part.get("toolName", ""),
                                            "args": part.get("args", {}),
                                            "state": "result",  # Stored invocations are completed
                                            "result": part.get("result")
                                        }
                                    })
                                else:
                                    transformed_parts.append(part)
                        msg["parts"] = transformed_parts
                    else:
                        msg["parts"] = []
                
                # Handle legacy tool_invocations field
                if msg.get("tool_invocations") and isinstance(msg["tool_invocations"], str):
                    try:
                        msg["tool_invocations"] = json.loads(msg["tool_invocations"])
                    except:
                        pass
                
                if msg.get("content") and isinstance(msg["content"], str):
                    # Check if content is JSON
                    try:
                        parsed = json.loads(msg["content"])
                        if isinstance(parsed, list):
                            msg["content"] = parsed
                    except:
                        pass
            
            return messages
        
        except Exception as e:
            logger.error(f"Failed to get chat messages: {str(e)}")
            return []
    
    async def get_user(self, user_id: str) -> Optional[Dict]:
        """Get user data"""
        if not self.client:
            return None
        
        try:
            response = (
                self.client.table("users")
                .select("*")
                .eq("id", user_id)
                .single()
                .execute()
            )
            return response.data
        
        except Exception as e:
            logger.error(f"Failed to get user: {str(e)}")
            return None
    
    async def get_user_api_key(
        self,
        user_id: str,
        provider: str
    ) -> Optional[str]:
        """Get user's encrypted API key for a provider"""
        if not self.client:
            return None
        
        try:
            response = (
                self.client.table("user_keys")
                .select("encrypted_key")
                .eq("user_id", user_id)
                .eq("provider", provider)
                .single()
                .execute()
            )
            
            if response.data:
                # Decrypt the key (implement decryption logic)
                from app.utils.encryption import decrypt_api_key
                return decrypt_api_key(response.data["encrypted_key"])
            
            return None
        
        except Exception as e:
            logger.error(f"Failed to get user API key: {str(e)}")
            return None
    
    async def check_usage(
        self,
        user_id: str,
        model: str,
        is_authenticated: bool
    ) -> Dict[str, Any]:
        """Check user's usage limits"""
        if not self.client:
            return {"allowed": True, "remaining": -1}
        
        try:
            # Get user's usage for today
            today = datetime.utcnow().date().isoformat()
            
            response = (
                self.client.table("usage_tracking")
                .select("message_count")
                .eq("user_id", user_id)
                .eq("date", today)
                .single()
                .execute()
            )
            
            current_usage = response.data["message_count"] if response.data else 0
            
            # Check limits based on authentication and model
            if not is_authenticated:
                limit = 10  # Unauthenticated users get 10 messages per day
            elif model in settings.FREE_MODELS:
                limit = 100  # Free models get 100 messages per day
            else:
                limit = 1000  # Premium models get 1000 messages per day
            
            return {
                "allowed": current_usage < limit,
                "remaining": max(0, limit - current_usage),
                "limit": limit,
                "current": current_usage
            }
        
        except Exception as e:
            # If table doesn't exist, allow the request
            if "PGRST205" in str(e) or "usage_tracking" in str(e):
                logger.debug("Usage tracking table not found, allowing request")
                return {"allowed": True, "remaining": -1}
            logger.error(f"Failed to check usage: {str(e)}")
            return {"allowed": True, "remaining": -1}
    
    async def increment_usage(self, user_id: str) -> bool:
        """Increment user's message count"""
        if not self.client:
            return True
        
        try:
            today = datetime.utcnow().date().isoformat()
            
            # Try to update existing record
            response = (
                self.client.table("usage_tracking")
                .select("id, message_count")
                .eq("user_id", user_id)
                .eq("date", today)
                .single()
                .execute()
            )
            
            if response.data:
                # Update existing record
                new_count = response.data["message_count"] + 1
                self.client.table("usage_tracking").update({
                    "message_count": new_count,
                    "updated_at": datetime.utcnow().isoformat()
                }).eq("id", response.data["id"]).execute()
            else:
                # Create new record
                self.client.table("usage_tracking").insert({
                    "user_id": user_id,
                    "date": today,
                    "message_count": 1,
                    "created_at": datetime.utcnow().isoformat()
                }).execute()
            
            return True
        
        except Exception as e:
            # If table doesn't exist, don't fail the request
            if "PGRST205" in str(e) or "usage_tracking" in str(e):
                logger.debug("Usage tracking table not found, skipping increment")
                return True
            logger.error(f"Failed to increment usage: {str(e)}")
            return True  # Don't block requests due to tracking failures
    
    async def save_llm_usage(
        self,
        user_id: str,
        chat_id: str,
        session_id: str,
        model: str,
        llm_usage: Dict[str, Any],
    ) -> bool:
        """Persist LLM token usage for analytics.

        Inserts one row per session into the ``llm_usage`` table with
        aggregated totals and per-caller breakdown.
        """
        if not self.client:
            return False

        try:
            row = {
                "user_id": user_id,
                "chat_id": chat_id,
                "session_id": session_id,
                "model": model,
                "total_input_tokens": llm_usage.get("total_input_tokens", 0),
                "total_output_tokens": llm_usage.get("total_output_tokens", 0),
                "total_cache_creation_tokens": llm_usage.get("total_cache_creation_tokens", 0),
                "total_cache_read_tokens": llm_usage.get("total_cache_read_tokens", 0),
                "total_calls": llm_usage.get("total_calls", 0),
                "by_caller": llm_usage.get("by_caller", {}),
                "created_at": datetime.utcnow().isoformat(),
            }
            self.client.table("llm_usage").insert(row).execute()
            logger.info(
                f"Saved LLM usage for user={user_id} chat={chat_id}: "
                f"input={row['total_input_tokens']} output={row['total_output_tokens']} "
                f"calls={row['total_calls']}"
            )
            return True
        except Exception as e:
            logger.error(f"Failed to save LLM usage: {e}")
            return False

    async def save_feedback(self, feedback: Dict[str, Any]) -> bool:
        """Save user feedback"""
        if not self.client:
            return False
        
        try:
            feedback["created_at"] = datetime.utcnow().isoformat()
            
            self.client.table("feedback").insert(feedback).execute()
            return True
        
        except Exception as e:
            logger.error(f"Failed to save feedback: {str(e)}")
            return False
    
    async def get_chat(self, chat_id: str) -> Optional[Dict]:
        """Get chat details"""
        if not self.client:
            return None
        
        try:
            response = (
                self.client.table("chats")
                .select("*")
                .eq("id", chat_id)
                .single()
                .execute()
            )
            return response.data
        
        except Exception as e:
            logger.error(f"Failed to get chat: {str(e)}")
            return None
    
    async def create_chat(self, chat_data: Dict[str, Any]) -> Optional[Dict]:
        """Create a new chat"""
        if not self.client:
            return None
        
        try:
            chat_data["created_at"] = datetime.utcnow().isoformat()
            
            response = self.client.table("chats").insert(chat_data).execute()
            return response.data[0] if response.data else None
        
        except Exception as e:
            logger.error(f"Failed to create chat: {str(e)}")
            return None
    
    async def get_machine(self, machine_id: str, user_id: str) -> Optional[Dict]:
        """Get machine details for a user"""
        if not self.client:
            return None

        try:
            response = (
                self.client.table("user_machines")
                .select("*")
                .eq("id", machine_id)
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )
            return response.data

        except Exception as e:
            logger.error(f"Failed to get machine {machine_id}: {str(e)}")
            return None
    
    async def get_machine_session(self, machine_id: str, session_id: str) -> Optional[Dict]:
        """Get active machine session"""
        if not self.client:
            return None

        try:
            response = (
                self.client.table("machine_sessions")
                .select("*")
                .eq("id", session_id)
                .eq("machine_id", machine_id)
                .is_("ended_at", None)
                .maybe_single()
                .execute()
            )
            return response.data

        except Exception as e:
            logger.error(f"Failed to get machine session: {str(e)}")
            return None
    
    async def store_message_chunk(self, chunk_data: Dict[str, Any], timeout: int = 30) -> Optional[Dict]:
        """Store a message chunk with retry logic"""
        if not self.client:
            logger.warning("Database client not initialized")
            return None
        
        max_retries = 3
        retry_delay = 1
        
        for attempt in range(max_retries):
            try:
                # Create table if it doesn't exist (you'll need to add migration)
                # For now, we'll use a simple approach
                loop = asyncio.get_event_loop()
                response = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda: self.client.table("message_chunks").insert(chunk_data).execute()
                    ),
                    timeout=timeout
                )
                
                if response and response.data:
                    logger.debug(f"Successfully stored chunk {chunk_data.get('chunk_index')} (attempt {attempt + 1})")
                    return response.data[0]
                else:
                    logger.warning(f"No data returned from chunk insert (attempt {attempt + 1})")
                    
            except asyncio.TimeoutError:
                logger.warning(f"Chunk storage timeout on attempt {attempt + 1}/{max_retries}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
            except Exception as e:
                # If table doesn't exist, try to store in messages table with special flag
                if "message_chunks" in str(e):
                    logger.info("message_chunks table not found, using fallback storage")
                    try:
                        # Store as a special message type
                        fallback_data = {
                            "chat_id": f"chunk_{chunk_data.get('parent_message_id')}",
                            "role": "system",
                            "content": json.dumps({
                                "__chunk": True,
                                **chunk_data
                            }),
                            "created_at": chunk_data.get("created_at", datetime.utcnow().isoformat())
                        }
                        
                        response = await asyncio.wait_for(
                            loop.run_in_executor(
                                None,
                                lambda: self.client.table("messages").insert(fallback_data).execute()
                            ),
                            timeout=timeout
                        )
                        
                        if response and response.data:
                            logger.info(f"Stored chunk using fallback method")
                            return response.data[0]
                    except Exception as fallback_error:
                        logger.error(f"Fallback chunk storage failed: {str(fallback_error)}")
                
                logger.error(f"Chunk storage error on attempt {attempt + 1}: {str(e)}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
        
        return None
    
    async def get_message_chunks(self, parent_message_id: str) -> List[Dict]:
        """Retrieve all chunks for a parent message"""
        if not self.client:
            return []
        
        try:
            # Try to get from message_chunks table first
            try:
                response = (
                    self.client.table("message_chunks")
                    .select("*")
                    .eq("parent_message_id", parent_message_id)
                    .order("chunk_index", desc=False)
                    .execute()
                )
                
                if response.data:
                    return response.data
            except Exception as e:
                if "message_chunks" in str(e):
                    logger.info("message_chunks table not found, trying fallback retrieval")
            
            # Fallback: Try to get from messages table
            response = (
                self.client.table("messages")
                .select("*")
                .eq("chat_id", f"chunk_{parent_message_id}")
                .eq("role", "system")
                .order("created_at", desc=False)
                .execute()
            )
            
            if response.data:
                # Extract chunk data from content
                chunks = []
                for msg in response.data:
                    if msg.get("content"):
                        try:
                            content = json.loads(msg["content"])
                            if content.get("__chunk"):
                                chunks.append(content)
                        except:
                            pass
                return chunks
            
            return []
            
        except Exception as e:
            logger.error(f"Failed to get message chunks: {str(e)}")
            return []