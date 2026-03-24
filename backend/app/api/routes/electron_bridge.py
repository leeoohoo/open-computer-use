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
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from collections import defaultdict

import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Request, Depends, HTTPException

from app.services.vm_control import vm_control_service
from app.services.ws_adapter import FastAPIWebSocketAdapter, _AdapterState
from app.services.database import DatabaseService
from app.services.auth import validate_user, get_verified_user_id
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()
db_service = DatabaseService()

# ── Remote approval system ──────────────────────────────────────────────
# When an Electron app requests user approval for a command, the request
# is stored here so the web/phone UI can poll for it and respond.
# Structure: { machine_id: { approval_id: { command, parameters, status, ... } } }
_pending_remote_approvals: Dict[str, Dict[str, Dict[str, Any]]] = defaultdict(dict)


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

    # 3. Verify the Supabase JWT token and confirm it belongs to the claimed user_id.
    #    The InternalAPIKeyMiddleware skips WebSocket upgrades, so we must verify here.
    verified_uid = await _verify_supabase_token(token)
    if not verified_uid or verified_uid != user_id:
        logger.warning(f"Electron WS auth failed: token user_id mismatch (claimed={user_id})")
        try:
            await websocket.send_json({"type": "auth_failed", "reason": "Invalid token"})
            await websocket.close(code=4001, reason="Invalid token")
        except Exception:
            pass
        return

    # 4. Ensure user row exists in public users table
    user = await validate_user(user_id)
    if not user:
        # User may exist in Supabase auth but not in the public users table
        # (e.g. signed up via Electron app which doesn't hit the webapp callback).
        # Try to auto-provision the users row.
        user = await _ensure_user_row(user_id, token)
        if not user:
            try:
                await websocket.send_json({"type": "auth_failed", "reason": "Invalid user"})
                await websocket.close(code=4001, reason="Invalid user")
            except Exception:
                pass
            return

    # 5. Verify machine ownership — reject if machine_id belongs to another user
    try:
        existing_machine = await db_service.get_machine(machine_id, user_id)
        if not existing_machine:
            # Machine doesn't exist for this user yet — check if it belongs to someone else
            if db_service.client:
                any_owner = (
                    db_service.client.table("user_machines")
                    .select("user_id")
                    .eq("id", machine_id)
                    .maybe_single()
                    .execute()
                )
                if any_owner and any_owner.data and any_owner.data.get("user_id") != user_id:
                    logger.warning(f"Electron WS: machine {machine_id} belongs to another user (not {user_id})")
                    await websocket.send_json({"type": "auth_failed", "reason": "Machine belongs to another user"})
                    await websocket.close(code=4003, reason="Machine ownership mismatch")
                    return
            else:
                # DB client unavailable — cannot verify ownership, reject
                logger.error(f"Machine ownership check skipped: DB client unavailable")
                await websocket.send_json({"type": "auth_failed", "reason": "Cannot verify machine ownership"})
                await websocket.close(code=4003, reason="Ownership check unavailable")
                return
    except Exception as e:
        logger.error(f"Machine ownership check failed: {e} — rejecting connection")
        try:
            await websocket.send_json({"type": "auth_failed", "reason": "Ownership verification error"})
            await websocket.close(code=4003, reason="Ownership check error")
        except Exception:
            pass
        return

    logger.info(f"Electron app connected: machine_id={machine_id}, user_id={user_id}, platform={platform}, os={os_name}")

    # 6. Wrap in adapter so vm_control_service can use .send()/.recv() as usual
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

    # 7. Store in vm_control_service (same dict as regular VM connections)
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

    # 8. Register machine in database
    await _register_electron_machine(machine_id, user_id, hostname=hostname, username=username, platform=platform)

    # 9. Send auth success
    await websocket.send_json({
        "type": "auth_success",
        "message": "Connected to Coasty backend",
        "machine_id": machine_id,
    })

    try:
        # 10. Keep connection alive with periodic pings.
        # CRITICAL: We must NOT consume messages here — execute_command()
        # handles all command/response traffic via the stored adapter.
        # Approval requests from the Electron app arrive interleaved with
        # command results and are handled in vm_control's recv() loop.
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
        # Only clean up if OUR adapter is still the registered one.
        # If the Electron app reconnected quickly, a new handler already
        # stored a new adapter — we must NOT remove it.
        await _cleanup_electron_connection(machine_id, adapter)


async def _verify_supabase_token(token: str) -> Optional[str]:
    """Verify a Supabase JWT and return the user_id it belongs to, or None."""
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        logger.warning("Cannot verify Supabase token: SUPABASE_URL or SUPABASE_ANON_KEY not set")
        return None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.SUPABASE_ANON_KEY,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("id")
            return None
    except Exception as e:
        logger.error(f"Supabase token verification failed: {e}")
        return None


async def _ensure_user_row(user_id: str, token: str) -> Optional[str]:
    """
    Verify the user exists in Supabase auth and create the public users row.

    When users sign up via the Electron app, Supabase creates the auth.users
    entry but the public users row is never created (the webapp callback at
    /auth/callback handles that for web sign-ups). This function fills that gap.

    Returns user_id on success, None if the user can't be verified.
    """
    logger.info(f"Attempting to auto-provision users row for {user_id}")
    try:
        if not db_service.client:
            logger.warning("No database client, cannot auto-provision user")
            return None

        # Verify the user exists in Supabase auth using the admin API
        logger.info(f"Looking up user {user_id} in Supabase auth...")
        auth_response = db_service.client.auth.admin.get_user_by_id(user_id)
        logger.info(f"Auth lookup response: {auth_response}")

        if not auth_response or not auth_response.user:
            logger.warning(f"User {user_id} not found in Supabase auth")
            return None

        auth_user = auth_response.user
        email = auth_user.email
        logger.info(f"Found auth user: {user_id} ({email}), creating users row...")

        # Create the public users row (same fields as webapp callback)
        db_service.client.table("users").insert({
            "id": user_id,
            "email": email,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "message_count": 0,
            "premium": False,
            "favorite_models": ["bedrock-default"],
        }).execute()

        logger.info(f"Auto-provisioned users row for Electron sign-up: {user_id} ({email})")
        return user_id

    except Exception as e:
        # 23505 = unique violation (row already exists — race condition, that's fine)
        if "23505" in str(e):
            logger.info(f"Users row already exists for {user_id} (race condition)")
            return user_id
        logger.error(f"Failed to auto-provision user {user_id}: {type(e).__name__}: {e}")
        return None


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


async def _cleanup_electron_connection(machine_id: str, own_adapter=None):
    """Clean up when Electron disconnects.

    If *own_adapter* is provided, only remove the connection from
    vm_control_service when it still points to this adapter.  This
    prevents a stale handler from wiping out a newer connection that
    was registered by a quick Electron reconnect.
    """
    current = vm_control_service.connections.get(machine_id)
    if own_adapter is not None and current is not own_adapter:
        # A newer handler already replaced our connection — don't touch it.
        logger.info(
            f"Skipping cleanup for {machine_id}: connection was replaced by a newer handler"
        )
        return

    logger.info(f"Cleaning up Electron connection: {machine_id}")

    # Remove from vm_control_service
    vm_control_service.connections.pop(machine_id, None)
    vm_control_service.session_data.pop(machine_id, None)
    vm_control_service.last_successful_command.pop(machine_id, None)

    # Cancel heartbeat if any
    task = vm_control_service.heartbeat_tasks.pop(machine_id, None)
    if task:
        task.cancel()

    # Clear any pending remote approvals for this machine
    _pending_remote_approvals.pop(machine_id, None)

    # Update DB status
    try:
        if db_service.client:
            db_service.client.table("user_machines").update({
                "status": "stopped",
            }).eq("id", machine_id).execute()
    except Exception as e:
        logger.error(f"Failed to update Electron machine status: {e}")


# ── REST endpoints ──────────────────────────────────────────────────────


@router.get("/machines")
async def list_electron_machines(user_id: str = Depends(get_verified_user_id)):
    """Return connection status for the user's Electron machines.

    For each Electron machine in the database, check whether an active
    WebSocket connection exists in vm_control_service.  This lets the
    web/phone UI show online/offline status without a WebSocket ping.
    """
    machines: list[Dict[str, Any]] = []

    try:
        if not db_service.client:
            raise HTTPException(status_code=500, detail="Database unavailable")

        result = (
            db_service.client.table("user_machines")
            .select("id, display_name, status, settings, last_active_at")
            .eq("user_id", user_id)
            .execute()
        )

        for row in result.data or []:
            settings_data = row.get("settings") or {}
            if isinstance(settings_data, str):
                try:
                    settings_data = json.loads(settings_data)
                except json.JSONDecodeError:
                    settings_data = {}

            if settings_data.get("provider") != "electron":
                continue

            machine_id = row["id"]
            ws = vm_control_service.connections.get(machine_id)
            session = vm_control_service.session_data.get(machine_id, {})
            is_connected = ws is not None and ws.state == _AdapterState.OPEN

            machines.append({
                "id": machine_id,
                "displayName": row.get("display_name", "Local Desktop"),
                "connected": is_connected,
                "platform": settings_data.get("platform", "unknown"),
                "hostname": settings_data.get("hostname", ""),
                "username": settings_data.get("username", ""),
                "lastActiveAt": row.get("last_active_at"),
                "systemInfo": session.get("system_info") if is_connected else None,
            })

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list Electron machines: {e}")
        raise HTTPException(status_code=500, detail="Failed to list machines")

    return {"machines": machines}


@router.get("/machines/{machine_id}/health")
async def electron_machine_health(
    machine_id: str,
    user_id: str = Depends(get_verified_user_id),
):
    """Check whether an Electron machine is online and ready.

    Unlike the generic agent-health endpoint (which opens a WebSocket to
    the VM), this simply checks whether the Electron app's inbound
    WebSocket is present and open in vm_control_service.
    """
    # Verify ownership
    session = vm_control_service.session_data.get(machine_id, {})
    if session.get("user_id") and session["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your machine")

    ws = vm_control_service.connections.get(machine_id)
    is_connected = ws is not None and ws.state == _AdapterState.OPEN

    return {
        "agentReady": is_connected,
        "connected": is_connected,
        "isElectron": True,
    }


# ── Remote Approval endpoints ───────────────────────────────────────────


@router.get("/machines/{machine_id}/approvals")
async def get_pending_approvals(
    machine_id: str,
    user_id: str = Depends(get_verified_user_id),
):
    """Return pending approval requests for a machine.

    The web/phone UI polls this endpoint to show approval prompts
    remotely (instead of requiring the user to be at the Electron app).
    """
    # Verify ownership via session or DB
    session = vm_control_service.session_data.get(machine_id, {})
    if session.get("user_id") and session["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your machine")

    approvals = list(_pending_remote_approvals.get(machine_id, {}).values())
    # Only return pending ones
    pending = [a for a in approvals if a.get("status") == "pending"]
    return {"approvals": pending}


@router.post("/machines/{machine_id}/approvals/{approval_id}/respond")
async def respond_to_approval(
    machine_id: str,
    approval_id: str,
    request: Request,
    user_id: str = Depends(get_verified_user_id),
):
    """Respond to a pending approval request from the web/phone UI.

    Body: { "approved": true/false, "reason": "optional deny reason" }
    """
    session = vm_control_service.session_data.get(machine_id, {})
    if session.get("user_id") and session["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not your machine")

    body = await request.json()
    approved = body.get("approved", False)
    reason = body.get("reason")

    machine_approvals = _pending_remote_approvals.get(machine_id, {})
    approval = machine_approvals.get(approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found or already handled")

    if approval["status"] != "pending":
        raise HTTPException(status_code=409, detail="Approval already responded to")

    approval["status"] = "approved" if approved else "denied"
    approval["reason"] = reason
    approval["responded_at"] = time.time()
    logger.info(f"Remote approval {approval_id} for {machine_id}: {approval['status']}")

    # Forward the response to the Electron app via WebSocket so the
    # local approval prompt can be dismissed and execution can proceed.
    ws = vm_control_service.connections.get(machine_id)
    if ws is not None:
        try:
            await ws.send(json.dumps({
                "type": "approval_response",
                "data": {
                    "id": approval_id,
                    "approved": approved,
                    "reason": reason,
                },
            }))
        except Exception as e:
            logger.warning(f"Failed to forward approval response to Electron: {e}")

    # Signal the waiting coroutine (if used internally)
    event: asyncio.Event = approval.get("_event")
    if event:
        event.set()

    return {"ok": True, "status": approval["status"]}


def create_remote_approval(machine_id: str, approval_id: str, command: str, parameters: Any) -> Dict[str, Any]:
    """Register a new remote approval request and return its record.

    Called from the Electron bridge's command dispatch to enable remote
    approval when the Electron overlay is not in focus / user is away.
    """
    record: Dict[str, Any] = {
        "id": approval_id,
        "command": command,
        "parameters": _sanitize_params(parameters),
        "status": "pending",
        "created_at": time.time(),
        "_event": asyncio.Event(),
    }
    _pending_remote_approvals[machine_id][approval_id] = record
    return record


async def wait_for_remote_approval(machine_id: str, approval_id: str, timeout: float = 120.0) -> Dict[str, Any]:
    """Wait until the remote approval is responded to, or timeout.

    Returns { "approved": bool, "reason": str | None }.
    """
    machine_approvals = _pending_remote_approvals.get(machine_id)
    if not machine_approvals:
        return {"approved": False, "reason": "Approval not found"}

    record = machine_approvals.get(approval_id)
    if not record:
        return {"approved": False, "reason": "Approval not found"}

    event: asyncio.Event = record.get("_event")
    if not event:
        return {"approved": False, "reason": "Approval record corrupted"}

    try:
        await asyncio.wait_for(event.wait(), timeout=timeout)
    except asyncio.TimeoutError:
        record["status"] = "timeout"

    # Clean up — use the same reference to avoid pop-on-empty-dict
    machine_approvals.pop(approval_id, None)
    # Remove machine entry if empty
    if not machine_approvals:
        _pending_remote_approvals.pop(machine_id, None)

    return {
        "approved": record.get("status") == "approved",
        "reason": record.get("reason"),
    }


def _sanitize_params(params: Any) -> Any:
    """Remove large binary data from parameters before storing for remote approval."""
    if not isinstance(params, dict):
        return params
    sanitized = {}
    for k, v in params.items():
        if isinstance(v, str) and len(v) > 1000:
            sanitized[k] = v[:200] + f"... ({len(v)} chars)"
        else:
            sanitized[k] = v
    return sanitized
