"""
Electron Bridge - WebSocket endpoint for Electron desktop apps.

Accepts inbound WebSocket connections from Electron clients.
Stores the WebSocket in vm_control_service.connections so that
existing executors can send commands through it transparently.

The key insight: instead of the backend connecting outbound to a VM,
the Electron app connects inbound here, and we store that WebSocket
in the same connections dict. execute_command() works unchanged.
"""

import json
import logging
import time
import asyncio
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from app.services.vm_control import vm_control_service
from app.services.ws_adapter import FastAPIWebSocketAdapter
from app.services.database import DatabaseService
from app.services.auth import validate_user

logger = logging.getLogger(__name__)
router = APIRouter()
db_service = DatabaseService()


@router.websocket("/ws")
async def electron_websocket(
    websocket: WebSocket,
    # Only non-sensitive system details come via query params.
    # Auth credentials (token, machine_id, user_id) arrive in the first
    # WebSocket message to avoid exposing tokens in server/proxy logs.
    platform: str = Query(""),
    os_name: str = Query(""),
    os_version: str = Query(""),
    arch: str = Query(""),
    hostname: str = Query(""),
    username: str = Query(""),
    home_dir: str = Query(""),
    shell: str = Query(""),
    screen_width: str = Query("0"),
    screen_height: str = Query("0"),
):
    """
    Accept WebSocket connection from Electron desktop app.

    The Electron app connects here with system details in query params.
    Auth credentials are sent in the first message body (not the URL)
    to prevent token exposure in server/proxy/CDN access logs.
    """
    # 1. Accept the WebSocket first (must accept before receiving messages)
    await websocket.accept()

    # 2. Wait for the auth message (first message from client, 10s timeout)
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=10)
        auth_msg = json.loads(raw)
    except (asyncio.TimeoutError, json.JSONDecodeError, WebSocketDisconnect):
        try:
            await websocket.send_json({"type": "auth_failed", "reason": "No auth message received"})
            await websocket.close(code=4001, reason="Auth timeout")
        except Exception:
            pass
        return

    if auth_msg.get("type") != "auth":
        try:
            await websocket.send_json({"type": "auth_failed", "reason": "Expected auth message"})
            await websocket.close(code=4001, reason="Bad auth")
        except Exception:
            pass
        return

    token = auth_msg.get("token", "")
    machine_id = auth_msg.get("machine_id", "")
    user_id = auth_msg.get("user_id", "")

    if not token or not machine_id or not user_id:
        try:
            await websocket.send_json({"type": "auth_failed", "reason": "Missing credentials"})
            await websocket.close(code=4001, reason="Missing credentials")
        except Exception:
            pass
        return

    # 3. Validate the user
    user = await validate_user(user_id)
    if not user:
        try:
            await websocket.send_json({"type": "auth_failed", "reason": "Invalid user"})
            await websocket.close(code=4001, reason="Invalid user")
        except Exception:
            pass
        return

    logger.info(f"Electron app connected: machine_id={machine_id}, user_id={user_id}, platform={platform}, os={os_name}")

    # 4. Wrap in adapter so vm_control_service can use .send()/.recv() as usual
    adapter = FastAPIWebSocketAdapter(websocket)

    # Build system_info dict from query params sent by the Electron app
    system_info = {
        "platform": platform or "unknown",         # win32, darwin, linux
        "os_name": os_name or "Unknown OS",         # Windows_NT 10.0.26200
        "os_version": os_version or "",
        "arch": arch or "",                         # x64, arm64
        "hostname": hostname or "",
        "username": username or "",
        "home_dir": home_dir or "",
        "shell": shell or "",                       # powershell, bash, zsh
        "screen_width": int(screen_width or 0),
        "screen_height": int(screen_height or 0),
    }

    # 5. Store in vm_control_service (same dict as regular VM connections)
    vm_control_service.connections[machine_id] = adapter
    vm_control_service.session_data[machine_id] = {
        "session_id": f"electron_session_{int(time.time())}",
        "user_id": user_id,
        "public_ip": "electron",
        "agent_port": 0,
        "vnc_password": None,
        "connected_at": time.time(),
        "is_electron": True,
        "system_info": system_info,
    }
    vm_control_service.last_successful_command[machine_id] = time.time()

    # Initialize per-machine locks
    if machine_id not in vm_control_service.connection_locks:
        vm_control_service.connection_locks[machine_id] = asyncio.Lock()
    if machine_id not in vm_control_service.command_locks:
        vm_control_service.command_locks[machine_id] = asyncio.Lock()

    # 6. Register machine in database
    await _register_electron_machine(machine_id, user_id, hostname=hostname, username=username, platform=platform)

    # 7. Send auth success
    await websocket.send_json({
        "type": "auth_success",
        "message": "Connected to Coasty backend",
        "machine_id": machine_id,
    })

    try:
        # 8. Keep connection alive.
        # CRITICAL: We must NOT consume messages here — execute_command()
        # handles all command/response traffic via the stored adapter.
        # We only need to keep this coroutine alive so FastAPI doesn't
        # close the WebSocket. We periodically send pings to detect drops.
        while True:
            await asyncio.sleep(30)
            try:
                await websocket.send_json({"type": "ping"})
            except Exception:
                logger.info(f"Electron ping failed, connection lost: {machine_id}")
                break

    except WebSocketDisconnect:
        logger.info(f"Electron app disconnected: {machine_id}")
    except Exception as e:
        logger.error(f"Electron WebSocket error: {e}")
    finally:
        await _cleanup_electron_connection(machine_id)


async def _register_electron_machine(
    machine_id: str,
    user_id: str,
    hostname: str = "",
    username: str = "",
    platform: str = "",
):
    """Register or update the Electron machine in the database."""
    try:
        if not db_service.client:
            logger.warning("No database client, skipping Electron machine registration")
            return

        # Build a personalized display name: "username's hostname"
        display_name = f"{username}'s {hostname}" if username and hostname else hostname or "Local Desktop"

        # Check if machine already exists
        existing = await db_service.get_machine(machine_id, user_id)
        if existing:
            update_data: dict = {
                "status": "running",
                "last_active_at": datetime.now(timezone.utc).isoformat(),
                "display_name": display_name,
            }
            db_service.client.table("user_machines").update(
                update_data
            ).eq("id", machine_id).execute()
            logger.info(f"Updated Electron machine status to running: {machine_id}")
            return

        # Insert new machine record
        db_service.client.table("user_machines").insert({
            "id": machine_id,
            "user_id": user_id,
            "container_name": f"electron-{machine_id[:12]}",
            "display_name": display_name,
            "status": "running",
            "azure_resource_group": "",
            "azure_container_group": "",
            "azure_location": "local",
            "vnc_password": "",
            "vnc_port": 0,
            "websocket_port": 0,
            "cpu_cores": 0,
            "memory_gb": 0,
            "storage_gb": 0,
            "gpu_enabled": False,
            "auto_shutdown_minutes": 0,
            "settings": {
                "isLocal": True,
                "provider": "electron",
                "platform": platform or "unknown",
                "hostname": hostname or "",
                "username": username or "",
            },
        }).execute()
        logger.info(f"Registered new Electron machine: {machine_id} ({display_name})")

    except Exception as e:
        logger.error(f"Failed to register Electron machine: {e}")


async def _cleanup_electron_connection(machine_id: str):
    """Clean up when Electron disconnects."""
    logger.info(f"Cleaning up Electron connection: {machine_id}")

    # Remove from vm_control_service
    vm_control_service.connections.pop(machine_id, None)
    vm_control_service.session_data.pop(machine_id, None)
    vm_control_service.last_successful_command.pop(machine_id, None)

    # Cancel heartbeat if any
    task = vm_control_service.heartbeat_tasks.pop(machine_id, None)
    if task:
        task.cancel()

    # Update DB status
    try:
        if db_service.client:
            db_service.client.table("user_machines").update({
                "status": "stopped",
            }).eq("id", machine_id).execute()
    except Exception as e:
        logger.error(f"Failed to update Electron machine status: {e}")
