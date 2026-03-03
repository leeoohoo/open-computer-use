"""
VM Control Service - Enhanced WebSocket communication with AI desktop agents
Based on the new interactive AI agent server architecture
"""

import json
import logging
import asyncio
import time
from typing import Dict, Any, Optional, List
import websockets
from websockets.protocol import State as WSState

from app.core.config import settings
from app.utils.image_compression import ImageCompressor
from app.services.ws_adapter import _AdapterState

# Constant for checking Electron adapter state without importing the full class
_AdapterState_OPEN = _AdapterState.OPEN

logger = logging.getLogger(__name__)


class VMControlService:
    """Enhanced service for controlling virtual machines via WebSocket"""
    
    def __init__(self):
        self.connections: Dict[str, WebSocketClientProtocol] = {}
        self.session_data: Dict[str, Dict] = {}
        self.connection_locks: Dict[str, asyncio.Lock] = {}
        self.command_locks: Dict[str, asyncio.Lock] = {}  # Prevents concurrent recv on same WS
        self.execution_locks: Dict[str, asyncio.Lock] = {}  # Per-machine session-level lock
        self.execution_owners: Dict[str, str] = {}  # machine_id -> chat_id (diagnostics)
        self.cancellation_events: Dict[str, asyncio.Event] = {}  # Per-machine force-stop signals
        self.heartbeat_tasks: Dict[str, asyncio.Task] = {}
        self.reconnect_attempts: Dict[str, int] = {}
        self.max_reconnect_attempts = 7  # Reasonable retry attempts
        self.reconnect_delay = 1.0  # Start with 1 second
        self.max_reconnect_delay = 15  # Max 15 seconds between attempts
        self.heartbeat_interval = 30  # Send heartbeat every 30 seconds
        self.connection_health: Dict[str, Dict] = {}  # Track connection health metrics
        self.last_successful_command: Dict[str, float] = {}  # Track last successful command time
        self.command_timeout = {
            # Longer timeouts for complex operations
            "browser_get_dom": 60.0,
            "browser_get_context": 45.0,  # Added - needs time to analyze page
            "browser_get_clickables": 45.0,  # Added - needs to scan all elements
            "detect_elements": 60.0,
            "ocr": 45.0,
            "browser_navigate": 45.0,
            "screenshot": 30.0,
            "browser_connect": 30.0,
            "browser_open": 30.0,
            # Default timeout - increased for network latency
            "default": 30.0
        }
    
    async def connect_to_agent(
        self,
        machine_id: str,
        public_ip: str,
        agent_port: int = 8080,  # Default WebSocket port (8081 for localhost)
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        vnc_password: Optional[str] = None  # Add password parameter
    ) -> bool:
        """
        Establish WebSocket connection to VM agent with auto-reconnect and heartbeat
        """
        # Use lock to prevent concurrent connection attempts
        if machine_id not in self.connection_locks:
            self.connection_locks[machine_id] = asyncio.Lock()
        
        async with self.connection_locks[machine_id]:
            # IMPORTANT: Check and reuse existing connections aggressively
            if machine_id in self.connections:
                ws = self.connections[machine_id]
                if ws.state == WSState.OPEN:
                    # Connection appears open - try to reuse without testing
                    # Testing adds latency and can cause issues
                    logger.info(f"✅ Reusing existing persistent connection for machine {machine_id}")
                    self.last_successful_command[machine_id] = time.time()
                    return True
                else:
                    # Connection is closed, clean up
                    logger.warning(f"Connection for {machine_id} is closed, cleaning up")
                    await self._cleanup_connection(machine_id)
            
            # Reset reconnect attempts for new connection
            self.reconnect_attempts[machine_id] = 0
            
            while self.reconnect_attempts[machine_id] < self.max_reconnect_attempts:
                try:
                    # Build WebSocket URL (port 8081 for localhost, 8080 for others)
                    # If port is explicitly provided, use it; otherwise apply localhost logic
                    actual_port = agent_port
                    if public_ip == "localhost" and agent_port == 8080:
                        actual_port = 8081  # Override to 8081 for localhost
                    agent_url = f"ws://{public_ip}:{actual_port}"
                    logger.info(f"🔌 Establishing persistent connection to {agent_url} (attempt {self.reconnect_attempts[machine_id] + 1})")
                    
                    # Connect with optimized settings for reliability
                    websocket = await asyncio.wait_for(
                        websockets.connect(
                            agent_url,
                            ping_interval=20,  # WebSocket ping every 20 seconds
                            ping_timeout=10,   # Wait 10 seconds for pong
                            close_timeout=10,  # Wait 10 seconds for close
                            max_size=50 * 1024 * 1024,  # 50MB max message size for large screenshots
                            compression=None   # Disable compression for lower latency
                        ),
                        timeout=30  # 30 second connection timeout
                    )
                    
                    # Store connection immediately
                    self.connections[machine_id] = websocket
                    
                    # Send authentication message with password
                    auth_message = {
                        "type": "auth",
                        "sessionId": session_id or f"backend_session_{int(time.time())}",
                        "userId": user_id or "backend_user",
                        "password": vnc_password or ""  # Include password for authentication
                    }
                    
                    await websocket.send(json.dumps(auth_message))
                    
                    # Wait for auth response — reject connection on failure
                    try:
                        response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                        auth_result = json.loads(response)

                        if auth_result.get("type") == "auth_success":
                            logger.info(f"✓ Authenticated with VM agent for machine {machine_id}")
                        else:
                            logger.error(f"VM agent auth rejected for {machine_id}: {auth_result}")
                            await websocket.close()
                            del self.connections[machine_id]
                            self.reconnect_attempts[machine_id] += 1
                            continue  # Retry with next attempt
                    except asyncio.TimeoutError:
                        logger.error(f"VM agent auth timeout for {machine_id} — closing connection")
                        await websocket.close()
                        del self.connections[machine_id]
                        self.reconnect_attempts[machine_id] += 1
                        continue  # Retry with next attempt
                    except Exception as e:
                        logger.error(f"VM agent auth error for {machine_id}: {e} — closing connection")
                        await websocket.close()
                        del self.connections[machine_id]
                        self.reconnect_attempts[machine_id] += 1
                        continue  # Retry with next attempt
                    
                    # Store connection data
                    self.session_data[machine_id] = {
                        "session_id": session_id or auth_message["sessionId"],
                        "user_id": user_id or auth_message["userId"],
                        "public_ip": public_ip,
                        "agent_port": agent_port,
                        "vnc_password": vnc_password,  # Store password for reconnection
                        "connected_at": time.time()
                    }
                    
                    # Start heartbeat task
                    await self._start_heartbeat(machine_id)
                    
                    # Reset reconnect attempts on successful connection
                    self.reconnect_attempts[machine_id] = 0
                    
                    logger.info(f"✅ Persistent connection established for machine {machine_id}")
                    logger.info(f"   Connection will be reused for all subsequent commands")
                    return True
                    
                except asyncio.TimeoutError:
                    logger.error(f"⏱️ Timeout connecting to VM agent at {public_ip}:{agent_port}")
                except websockets.exceptions.WebSocketException as e:
                    logger.error(f"🔌 WebSocket error: {e}")
                except Exception as e:
                    logger.error(f"❌ Failed to connect to VM agent: {str(e)}")
                
                # Increment attempts and calculate delay
                self.reconnect_attempts[machine_id] += 1
                if self.reconnect_attempts[machine_id] < self.max_reconnect_attempts:
                    # Simple exponential backoff
                    delay = min(
                        self.reconnect_delay * (2 ** (self.reconnect_attempts[machine_id] - 1)),
                        self.max_reconnect_delay
                    )
                    logger.info(f"⏳ Retrying in {delay:.1f} seconds (attempt {self.reconnect_attempts[machine_id]}/{self.max_reconnect_attempts})...")
                    await asyncio.sleep(delay)
                
            logger.error(f"❌ Max reconnection attempts reached for machine {machine_id}")
            return False
    
    async def _cleanup_connection(self, machine_id: str):
        """Clean up connection resources"""
        # Cancel heartbeat task
        if machine_id in self.heartbeat_tasks:
            task = self.heartbeat_tasks[machine_id]
            task.cancel()
            # Wait for task to complete cancellation
            try:
                await asyncio.wait_for(task, timeout=1.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass  # Expected when task is cancelled
            del self.heartbeat_tasks[machine_id]
        
        # Close and remove connection
        if machine_id in self.connections:
            try:
                ws = self.connections[machine_id]
                if ws.state == WSState.OPEN:
                    await ws.close(code=1000, reason="Session ended")
                # Give it a moment to close cleanly
                await asyncio.sleep(0.1)
            except Exception as e:
                logger.debug(f"Error closing WebSocket for {machine_id}: {e}")
            finally:
                del self.connections[machine_id]
    
    async def _start_heartbeat(self, machine_id: str):
        """Start heartbeat task for connection"""
        # Cancel existing heartbeat if any
        if machine_id in self.heartbeat_tasks:
            self.heartbeat_tasks[machine_id].cancel()
        
        # Create new heartbeat task
        self.heartbeat_tasks[machine_id] = asyncio.create_task(
            self._heartbeat_loop(machine_id)
        )
    
    async def _heartbeat_loop(self, machine_id: str):
        """Simple heartbeat using WebSocket ping frames instead of JSON messages"""
        consecutive_failures = 0
        max_consecutive_failures = 3
        
        while machine_id in self.connections:
            try:
                ws = self.connections.get(machine_id)
                if not ws or ws.state != WSState.OPEN:
                    logger.warning(f"Connection lost for machine {machine_id}")
                    break
                
                # Use WebSocket's built-in ping mechanism
                try:
                    # Send a WebSocket ping frame (not a JSON message)
                    pong_waiter = await ws.ping()
                    await asyncio.wait_for(pong_waiter, timeout=5.0)
                    
                    # Ping successful
                    consecutive_failures = 0
                    self.connection_health[machine_id] = {
                        "last_heartbeat": time.time(),
                        "status": "healthy"
                    }
                    logger.debug(f"Heartbeat successful for {machine_id}")
                    
                except asyncio.TimeoutError:
                    consecutive_failures += 1
                    logger.warning(f"Heartbeat timeout for {machine_id}, failures: {consecutive_failures}/{max_consecutive_failures}")
                    self.connection_health[machine_id] = {
                        "last_heartbeat": time.time(),
                        "status": "unhealthy"
                    }
                except websockets.exceptions.ConnectionClosed:
                    raise  # Let outer handler break the loop cleanly
                except Exception as e:
                    consecutive_failures += 1
                    logger.warning(f"Heartbeat error for {machine_id}: {e}")
                
                # Check if we should trigger reconnection
                if consecutive_failures >= max_consecutive_failures:
                    logger.error(f"Too many heartbeat failures for {machine_id}, triggering reconnection")
                    await self._cleanup_connection(machine_id)
                    # Trigger immediate reconnection
                    asyncio.create_task(self.ensure_connection(machine_id))
                    break
                
                # Wait before next heartbeat
                await asyncio.sleep(self.heartbeat_interval)
                
            except websockets.exceptions.ConnectionClosed as e:
                logger.warning(f"Connection closed for machine {machine_id}: {e}")
                break
            except websockets.exceptions.WebSocketException as e:
                logger.error(f"WebSocket error in heartbeat for {machine_id}: {e}")
                break
            except asyncio.CancelledError:
                logger.debug(f"Heartbeat task cancelled for {machine_id}")
                raise  # Re-raise to properly handle cancellation
            except Exception as e:
                logger.error(f"Unexpected heartbeat error for machine {machine_id}: {e}")
                await asyncio.sleep(self.heartbeat_interval)
        
        # Clean up on exit
        await self._cleanup_connection(machine_id)
    
    async def _wait_for_electron_reconnect(
        self, machine_id: str, timeout: float = 20.0, poll_interval: float = 1.0
    ) -> bool:
        """Wait for an Electron desktop app to re-establish its WebSocket.

        The Electron app has its own reconnection loop with exponential
        backoff (1s → 2s → 4s → … capped at 15s).  Rather than failing
        instantly, we poll for up to *timeout* seconds so that a brief
        network hiccup doesn't kill the entire CUA session.
        """
        deadline = time.time() + timeout
        attempt = 0
        while time.time() < deadline:
            attempt += 1
            ws = self.connections.get(machine_id)
            if ws is not None and ws.state == _AdapterState_OPEN:
                logger.info(
                    f"Electron reconnected for {machine_id} after {attempt} polls"
                )
                return True
            await asyncio.sleep(poll_interval)

        logger.error(
            f"Electron did not reconnect for {machine_id} within {timeout}s"
        )
        return False

    async def ensure_connection(self, machine_id: str) -> bool:
        """Ensure connection is active and REUSE existing connections"""
        # CRITICAL: Check if we have an active connection and REUSE it
        if machine_id in self.connections:
            ws = self.connections[machine_id]

            # Electron connections are managed by the electron_bridge endpoint.
            # The WebSocket is stored here by electron_bridge.py — we never
            # try to reconnect outbound for these.
            session = self.session_data.get(machine_id, {})
            if session.get("is_electron"):
                if ws.state == _AdapterState_OPEN:
                    logger.debug(f"Reusing Electron connection for {machine_id}")
                    return True
                else:
                    # Connection dropped — wait for the Electron app to reconnect
                    # (it has its own exponential backoff reconnection loop)
                    logger.warning(f"Electron connection lost for {machine_id}, waiting for reconnect...")
                    return await self._wait_for_electron_reconnect(machine_id)

            if ws.state == WSState.OPEN:
                # Quick check - don't ping every time (causes overhead)
                # Just verify the socket is open
                try:
                    # Check if we've used this connection recently
                    last_command = self.last_successful_command.get(machine_id, 0)
                    if time.time() - last_command < 60:  # Used in last minute
                        logger.debug(f"Reusing active connection for {machine_id} (last used {time.time() - last_command:.1f}s ago)")
                        return True

                    # Connection idle for a while, do a quick ping test
                    await asyncio.wait_for(ws.ping(), timeout=3.0)
                    logger.debug(f"Connection for {machine_id} verified and reused")
                    return True
                except (asyncio.TimeoutError, Exception) as e:
                    logger.warning(f"Connection test failed for machine {machine_id}: {e}")

        # Try to reconnect using stored session data (not for Electron — those reconnect themselves)
        if machine_id in self.session_data:
            session = self.session_data[machine_id]
            if session.get("is_electron"):
                # No existing connection object — wait for Electron to reconnect
                logger.warning(f"No connection for Electron machine {machine_id}, waiting for reconnect...")
                return await self._wait_for_electron_reconnect(machine_id)
            return await self.connect_to_agent(
                machine_id,
                session.get("public_ip"),
                session.get("agent_port", 8080),
                session.get("session_id"),
                session.get("user_id"),
                session.get("vnc_password")  # Pass stored password
            )

        return False
    
    def _get_command_lock(self, machine_id: str) -> asyncio.Lock:
        """Get or create a per-machine command lock to serialize WebSocket recv calls."""
        if machine_id not in self.command_locks:
            self.command_locks[machine_id] = asyncio.Lock()
        return self.command_locks[machine_id]

    def get_execution_lock(self, machine_id: str) -> asyncio.Lock:
        """Get or create a per-machine execution lock for session-level mutual exclusion."""
        if machine_id not in self.execution_locks:
            self.execution_locks[machine_id] = asyncio.Lock()
        return self.execution_locks[machine_id]

    def is_machine_busy(self, machine_id: str) -> tuple:
        """Check if a machine is currently executing a task. Returns (busy, owner_chat_id)."""
        lock = self.execution_locks.get(machine_id)
        if lock and lock.locked():
            return True, self.execution_owners.get(machine_id)
        return False, None

    def get_cancellation_event(self, machine_id: str) -> asyncio.Event:
        """Get or create a per-machine cancellation event."""
        if machine_id not in self.cancellation_events:
            self.cancellation_events[machine_id] = asyncio.Event()
        return self.cancellation_events[machine_id]

    def request_cancellation(self, machine_id: str) -> tuple:
        """Signal running execution to stop. Returns (was_busy, owner_chat_id)."""
        busy, owner = self.is_machine_busy(machine_id)
        if busy:
            self.get_cancellation_event(machine_id).set()
        return busy, owner

    def reset_cancellation(self, machine_id: str):
        """Clear stale cancellation signal (called when new execution starts)."""
        if machine_id in self.cancellation_events:
            self.cancellation_events[machine_id].clear()

    async def execute_command(
        self,
        machine_id: str,
        command: str,
        parameters: Dict[str, Any],
        timeout: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Execute a command on the VM using PERSISTENT connection.
        Serialized per-machine to prevent concurrent recv on the same WebSocket.
        """
        async with self._get_command_lock(machine_id):
            return await self._execute_command_inner(machine_id, command, parameters, timeout)

    async def _execute_command_inner(
        self,
        machine_id: str,
        command: str,
        parameters: Dict[str, Any],
        timeout: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Inner implementation of execute_command (called under command lock).
        """
        # Ensure we have a connection (will reuse if exists)
        if not await self.ensure_connection(machine_id):
            logger.error(f"Failed to establish/reuse connection for {machine_id}")
            return {
                "success": False,
                "error": "Cannot establish connection to VM agent"
            }

        websocket = self.connections[machine_id]
        
        # Determine timeout for this command
        if timeout is None:
            timeout = self.command_timeout.get(command, self.command_timeout["default"])
        
        # Prepare command message
        command_message = {
            "type": "command",
            "data": {
                "command": command,
                "parameters": parameters
            },
            "timestamp": time.time()
        }
        
        max_retries = 3  # Balanced retry count
        for attempt in range(max_retries):
            try:
                logger.debug(f"Sending command '{command}' to {machine_id} (attempt {attempt + 1}/{max_retries}) via persistent connection")
                await websocket.send(json.dumps(command_message))
                
                # Wait for response with timeout
                start_time = time.time()
                while time.time() - start_time < timeout:
                    try:
                        response = await asyncio.wait_for(
                            websocket.recv(),
                            timeout=min(timeout - (time.time() - start_time), 5.0)
                        )
                        result = json.loads(response)
                        
                        # Process command response
                        logger.debug(f"Received response from {machine_id}: {result.get('type')}")
                        
                        if result.get("type") == "result":
                            command_result = result.get("data", {})
                            # Track successful command
                            self.last_successful_command[machine_id] = time.time()
                            
                            # Only capture screenshots for browser-related commands
                            # The provider will filter this out before sending to model
                            if command.startswith("browser"):
                                try:
                                    screenshot_data = await self._capture_screenshot_inner(machine_id)
                                    if screenshot_data:
                                        command_result["frontendScreenshot"] = screenshot_data
                                        logger.info(f"Screenshot captured after browser command: {command}, size: {len(screenshot_data)} chars")
                                except Exception as e:
                                    logger.debug(f"Could not capture screenshot after {command}: {str(e)}")
                        
                            return command_result
                        elif result.get("type") == "error":
                            return {
                                "success": False,
                                "error": result.get("data", {}).get("error", "Unknown error")
                            }
                        else:
                            # Unexpected response type
                            logger.warning(f"Unexpected response type: {result.get('type')}")
                    
                    except asyncio.TimeoutError:
                        # Continue waiting if we haven't exceeded total timeout
                        if time.time() - start_time >= timeout:
                            raise
                        continue
                
                # If we get here, we've exceeded the timeout
                raise asyncio.TimeoutError(f"Command timeout after {timeout}s")
                
            except asyncio.TimeoutError:
                logger.error(f"⏱️ Command timeout for machine {machine_id} - attempt {attempt + 1}/{max_retries}")
                if attempt < max_retries - 1:
                    # Clean up potentially stuck connection
                    await self._cleanup_connection(machine_id)
                    await asyncio.sleep(2)  # Brief pause before reconnect
                    
                    # Try to reconnect before retry
                    if not await self.ensure_connection(machine_id):
                        return {
                            "success": False,
                            "error": "Connection lost and reconnection failed"
                        }
                    websocket = self.connections[machine_id]
                    await asyncio.sleep(1)  # Give connection time to stabilize
                else:
                    return {
                        "success": False,
                        "error": f"Command timeout after {max_retries} attempts",
                        "details": f"Command '{command}' exceeded {timeout}s timeout"
                    }
                    
            except websockets.exceptions.ConnectionClosed as e:
                logger.error(f"❌ Persistent connection lost for {machine_id}: {e}")
                # Clean up the dead connection
                await self._cleanup_connection(machine_id)
                
                if attempt < max_retries - 1:
                    logger.info(f"Attempting to re-establish persistent connection...")
                    await asyncio.sleep(1)
                    if await self.ensure_connection(machine_id):
                        websocket = self.connections[machine_id]
                        logger.info(f"✅ Persistent connection re-established, retrying command")
                        continue
                return {
                    "success": False,
                    "error": "Connection lost during command execution"
                }
                
            except Exception as e:
                logger.error(f"❌ Error executing command for machine {machine_id}: {str(e)}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(1)
                    continue
                return {
                    "success": False,
                    "error": f"Command execution failed: {str(e)}"
                }
        
        return {
            "success": False,
            "error": "Command failed after all retries"
        }
    
    async def capture_screenshot(self, machine_id: str) -> Optional[str]:
        """Capture a screenshot from the VM (public, lock-safe entry point)."""
        async with self._get_command_lock(machine_id):
            return await self._capture_screenshot_inner(machine_id)

    async def _capture_screenshot_inner(self, machine_id: str) -> Optional[str]:
        """Capture a screenshot (must be called under command lock)."""
        try:
            if not await self.ensure_connection(machine_id):
                return None
            
            websocket = self.connections[machine_id]
            
            # Send screenshot command
            screenshot_msg = {
                "type": "command",
                "data": {
                    "command": "screenshot",
                    "parameters": {}
                },
                "timestamp": time.time()
            }
            
            await websocket.send(json.dumps(screenshot_msg))
            
            # Wait for response
            timeout = 5.0
            start_time = time.time()
            
            while time.time() - start_time < timeout:
                try:
                    response = await asyncio.wait_for(
                        websocket.recv(),
                        timeout=min(timeout - (time.time() - start_time), 1.0)
                    )
                    result = json.loads(response)
                    
                    if result.get("type") == "result":
                        screenshot_data = result.get("data", {})
                        if screenshot_data.get("success") and screenshot_data.get("screenshot"):
                            screenshot_b64 = screenshot_data["screenshot"]
                            if not screenshot_b64.startswith("data:image"):
                                screenshot_b64 = f"data:image/png;base64,{screenshot_b64}"
                            
                            # Compress the screenshot before returning
                            try:
                                compressed, orig_size, new_size = ImageCompressor.compress_screenshot(
                                    screenshot_b64,
                                    max_width=1280,
                                    max_height=720,
                                    quality=70,
                                    format="JPEG"
                                )
                                logger.info(f"Screenshot compressed from {orig_size:,} to {new_size:,} bytes")
                                return compressed
                            except Exception as e:
                                logger.warning(f"Failed to compress screenshot, using original: {e}")
                                return screenshot_b64
                        return None
                        
                except asyncio.TimeoutError:
                    continue
                    
        except Exception as e:
            logger.debug(f"Could not capture screenshot: {str(e)}")
            
        return None
    
    async def disconnect(self, machine_id: str):
        """Disconnect from a VM agent"""
        logger.info(f"Disconnecting from machine {machine_id}")
        
        # Clean up connection
        await self._cleanup_connection(machine_id)
        
        # Remove session data
        if machine_id in self.session_data:
            del self.session_data[machine_id]
        
        # Remove locks
        if machine_id in self.connection_locks:
            del self.connection_locks[machine_id]
        if machine_id in self.command_locks:
            del self.command_locks[machine_id]
        
        # Reset reconnect attempts
        if machine_id in self.reconnect_attempts:
            del self.reconnect_attempts[machine_id]
        
        logger.info(f"✓ Disconnected from machine {machine_id}")
    
    async def disconnect_all(self):
        """Disconnect from all VM agents"""
        logger.info("Disconnecting from all machines")
        
        # Get list of machine IDs to disconnect
        machine_ids = list(self.connections.keys())
        
        # Disconnect each machine
        for machine_id in machine_ids:
            await self.disconnect(machine_id)
        
        logger.info("✓ Disconnected from all machines")
    
    def get_connection_status(self, machine_id: str) -> Dict[str, Any]:
        """Get connection status for a machine"""
        if machine_id not in self.connections:
            return {
                "connected": False,
                "error": "No connection exists"
            }
        
        ws = self.connections[machine_id]
        session = self.session_data.get(machine_id, {})
        
        return {
            "connected": ws.state == WSState.OPEN,
            "public_ip": session.get("public_ip"),
            "agent_port": session.get("agent_port"),
            "session_id": session.get("session_id"),
            "user_id": session.get("user_id"),
            "connected_at": session.get("connected_at"),
            "reconnect_attempts": self.reconnect_attempts.get(machine_id, 0)
        }
    
    def get_all_connections(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all connections"""
        return {
            machine_id: self.get_connection_status(machine_id)
            for machine_id in self.connections.keys()
        }


# Create singleton instance
vm_control_service = VMControlService()