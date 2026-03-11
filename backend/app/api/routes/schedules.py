"""
Schedule API endpoints — CRUD for automated/recurring task schedules.

Schedules are stored as metadata inside the chat's `room_settings` JSONB column.
Execution logs are stored in `room_settings.schedule.history` (JSONB array).
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from croniter import croniter
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.auth import get_verified_user_id
from app.services.database import DatabaseService
from app.services.task_scheduler import task_scheduler

logger = logging.getLogger(__name__)
router = APIRouter()
db_service = DatabaseService()

# Frequency presets → cron expressions
FREQUENCY_CRON_MAP = {
    "every_15_minutes": "*/15 * * * *",
    "every_30_minutes": "*/30 * * * *",
    "hourly": "0 * * * *",
    "every_6_hours": "0 */6 * * *",
    "every_12_hours": "0 */12 * * *",
    "daily": "0 9 * * *",
    "weekly": "0 9 * * 1",
    "monthly": "0 9 1 * *",
}


class CreateScheduleRequest(BaseModel):
    frequency: str = Field(
        description="Preset frequency or 'custom' for cron expression"
    )
    cron: Optional[str] = Field(
        default=None, description="Custom cron expression (required when frequency='custom')"
    )
    timezone: str = Field(default="UTC", description="IANA timezone name")
    machine_id: str = Field(alias="machineId", description="Target machine UUID")
    time: Optional[str] = Field(
        default=None,
        description="Time of day for daily/weekly/monthly (HH:MM format)",
    )
    day_of_week: Optional[int] = Field(
        default=None,
        alias="dayOfWeek",
        description="Day of week for weekly (0=Mon, 6=Sun)",
    )
    day_of_month: Optional[int] = Field(
        default=None,
        alias="dayOfMonth",
        description="Day of month for monthly (1-28)",
    )
    task_prompt: Optional[str] = Field(
        default=None,
        alias="taskPrompt",
        description="Custom task prompt to use instead of the first chat message",
    )

    class Config:
        populate_by_name = True


class TriggerConfig(BaseModel):
    id: Optional[str] = None
    target_chat_id: str
    event: str = "on_complete"  # "on_complete" | "on_failure" | "on_any"
    pass_output: bool = True
    enabled: bool = True


class ScheduleResponse(BaseModel):
    chat_id: str
    title: Optional[str]
    enabled: bool
    frequency: str
    cron: str
    timezone: str
    machine_id: str
    last_run_at: Optional[str]
    next_run_at: Optional[str]
    consecutive_failures: int
    paused_reason: Optional[str]
    run_count: int
    created_at: Optional[str]
    task_prompt: Optional[str] = None
    triggers: Optional[List[dict]] = None
    team_hub_id: Optional[str] = None
    last_output_summary: Optional[str] = None


class ScheduleHistoryEntry(BaseModel):
    id: str
    chat_id: str
    status: str
    trigger: str
    duration_seconds: Optional[int]
    credits_charged: Optional[int]
    error: Optional[str]
    executed_at: str


def _parse_room_settings(room_settings) -> dict:
    if not room_settings:
        return {}
    if isinstance(room_settings, str):
        try:
            return json.loads(room_settings)
        except Exception:
            return {}
    return room_settings


def _build_cron_expression(req: CreateScheduleRequest) -> str:
    """Build cron expression from the request parameters."""
    if req.frequency == "custom":
        if not req.cron:
            raise HTTPException(
                status_code=400,
                detail="cron expression is required when frequency is 'custom'",
            )
        # Validate the cron expression
        try:
            croniter(req.cron)
        except (ValueError, KeyError) as e:
            raise HTTPException(
                status_code=400, detail=f"Invalid cron expression: {e}"
            )
        return req.cron

    base_cron = FREQUENCY_CRON_MAP.get(req.frequency)
    if not base_cron:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid frequency: {req.frequency}. "
            f"Valid values: {', '.join(list(FREQUENCY_CRON_MAP.keys()) + ['custom'])}",
        )

    # Adjust time for daily/weekly/monthly
    if req.time and req.frequency in ("daily", "weekly", "monthly"):
        try:
            parts = req.time.split(":")
            hour = int(parts[0])
            minute = int(parts[1]) if len(parts) > 1 else 0
        except (ValueError, IndexError):
            raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM")

        if req.frequency == "daily":
            base_cron = f"{minute} {hour} * * *"
        elif req.frequency == "weekly":
            dow = req.day_of_week if req.day_of_week is not None else 1
            base_cron = f"{minute} {hour} * * {dow}"
        elif req.frequency == "monthly":
            dom = req.day_of_month if req.day_of_month is not None else 1
            dom = max(1, min(28, dom))
            base_cron = f"{minute} {hour} {dom} * *"

    return base_cron


async def _verify_chat_ownership(chat_id: str, user_id: str) -> dict:
    """Verify the chat exists and belongs to the user."""
    chat = await db_service.get_chat(chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    if chat.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat


async def _check_schedule_limit(user_id: str, exclude_chat_id: Optional[str] = None):
    """Check if the user has reached their schedule limit."""
    if not db_service.client:
        return

    # Get user tier
    tier = "free"
    try:
        import asyncio

        loop = asyncio.get_event_loop()
        response = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("machine_limits")
                .select("tier")
                .eq("user_id", user_id)
                .maybe_single()
                .execute(),
            ),
            timeout=10,
        )
        if response and response.data:
            tier = response.data.get("tier", "free")
    except Exception:
        pass

    max_schedules = task_scheduler.get_max_schedules_for_tier(tier)

    # Count existing enabled schedules
    try:
        import asyncio

        loop = asyncio.get_event_loop()
        response = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("chats")
                .select("id, room_settings")
                .eq("user_id", user_id)
                .not_.is_("room_settings", "null")
                .execute(),
            ),
            timeout=15,
        )

        count = 0
        if response and response.data:
            for chat in response.data:
                if exclude_chat_id and chat["id"] == exclude_chat_id:
                    continue
                rs = _parse_room_settings(chat.get("room_settings"))
                if rs.get("schedule", {}).get("enabled"):
                    count += 1

        if count >= max_schedules:
            raise HTTPException(
                status_code=403,
                detail=f"Schedule limit reached ({max_schedules} for {tier} tier). "
                f"Upgrade your plan for more automated tasks.",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to check schedule limit: {e}")


async def _verify_machine_ownership(machine_id: str, user_id: str):
    """Verify the target machine exists and belongs to the user."""
    machine = await db_service.get_machine(machine_id, user_id)
    if not machine:
        raise HTTPException(
            status_code=404,
            detail=f"Machine {machine_id} not found or not accessible",
        )


def _build_schedule_response(chat: dict, schedule: dict) -> ScheduleResponse:
    """Build a ScheduleResponse from a chat dict and schedule dict."""
    return ScheduleResponse(
        chat_id=chat["id"],
        title=chat.get("title"),
        enabled=schedule.get("enabled", False),
        frequency=schedule.get("frequency", ""),
        cron=schedule.get("cron", ""),
        timezone=schedule.get("timezone", "UTC"),
        machine_id=schedule.get("target_machine_id", ""),
        last_run_at=schedule.get("last_run_at"),
        next_run_at=schedule.get("next_run_at"),
        consecutive_failures=schedule.get("consecutive_failures", 0),
        paused_reason=schedule.get("paused_reason"),
        run_count=schedule.get("run_count", 0),
        created_at=schedule.get("created_at"),
        task_prompt=schedule.get("task_prompt"),
        triggers=schedule.get("triggers"),
        team_hub_id=schedule.get("team_hub_id"),
        last_output_summary=schedule.get("last_output_summary"),
    )


# ─── Static routes FIRST (before /{chat_id} to avoid "history" matching as a chat_id) ───


@router.get("")
async def list_schedules(
    user_id: str = Depends(get_verified_user_id),
):
    """List all scheduled tasks for the authenticated user."""
    if not db_service.client:
        return {"schedules": []}

    try:
        import asyncio

        loop = asyncio.get_event_loop()
        response = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("chats")
                .select("id, title, room_settings, updated_at")
                .eq("user_id", user_id)
                .not_.is_("room_settings", "null")
                .order("updated_at", desc=True)
                .execute(),
            ),
            timeout=15,
        )

        schedules = []
        if response and response.data:
            for chat in response.data:
                rs = _parse_room_settings(chat.get("room_settings"))
                schedule = rs.get("schedule")
                if not schedule:
                    continue
                if not schedule.get("enabled") and schedule.get("paused_reason") == "deleted":
                    continue

                schedules.append(
                    _build_schedule_response(chat, schedule).model_dump()
                )

        return {"schedules": schedules}

    except Exception as e:
        logger.error(f"Failed to list schedules: {e}")
        return {"schedules": []}


@router.get("/history")
async def get_schedule_history(
    user_id: str = Depends(get_verified_user_id),
    chat_id: Optional[str] = Query(None),
    limit: int = Query(default=50, le=200),
):
    """Get execution history from room_settings.schedule.history JSONB arrays."""
    if not db_service.client:
        return {"history": []}

    try:
        import asyncio

        loop = asyncio.get_event_loop()

        if chat_id:
            # Single chat history
            response = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: db_service.client.table("chats")
                    .select("id, room_settings")
                    .eq("id", chat_id)
                    .eq("user_id", user_id)
                    .maybe_single()
                    .execute(),
                ),
                timeout=15,
            )
            chats_data = [response.data] if response and response.data else []
        else:
            # All chats with schedules
            response = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: db_service.client.table("chats")
                    .select("id, room_settings")
                    .eq("user_id", user_id)
                    .not_.is_("room_settings", "null")
                    .execute(),
                ),
                timeout=15,
            )
            chats_data = response.data if response and response.data else []

        # Collect all history entries from room_settings
        all_entries = []
        for chat in chats_data:
            rs = _parse_room_settings(chat.get("room_settings"))
            schedule = rs.get("schedule", {})
            history_list = schedule.get("history", [])
            for entry in history_list:
                all_entries.append(
                    ScheduleHistoryEntry(
                        id=entry.get("id", ""),
                        chat_id=chat["id"],
                        status=entry.get("status", "unknown"),
                        trigger=entry.get("trigger", "cron"),
                        duration_seconds=entry.get("duration_seconds"),
                        credits_charged=entry.get("credits_charged"),
                        error=entry.get("error"),
                        executed_at=entry.get("executed_at", ""),
                    ).model_dump()
                )

        # Sort by executed_at descending and limit
        all_entries.sort(key=lambda e: e.get("executed_at", ""), reverse=True)
        return {"history": all_entries[:limit]}

    except Exception as e:
        logger.error(f"Failed to get schedule history: {e}")
        return {"history": []}


# ─── Parameterized routes (/{chat_id}) ───


@router.post("/{chat_id}")
async def create_or_update_schedule(
    chat_id: str,
    req: CreateScheduleRequest,
    user_id: str = Depends(get_verified_user_id),
):
    """Create or update a schedule for a chat."""
    chat = await _verify_chat_ownership(chat_id, user_id)
    await _verify_machine_ownership(req.machine_id, user_id)
    await _check_schedule_limit(user_id, exclude_chat_id=chat_id)

    cron_expr = _build_cron_expression(req)

    import pytz

    try:
        tz = pytz.timezone(req.timezone)
    except pytz.exceptions.UnknownTimeZoneError:
        raise HTTPException(status_code=400, detail=f"Unknown timezone: {req.timezone}")

    now_tz = datetime.now(tz)
    cron = croniter(cron_expr, now_tz)
    next_run = cron.get_next(datetime).astimezone(timezone.utc)

    room_settings = _parse_room_settings(chat.get("room_settings"))
    existing_schedule = room_settings.get("schedule", {})

    # Resolve task_prompt: use provided value, or preserve existing
    task_prompt = req.task_prompt if req.task_prompt is not None else existing_schedule.get("task_prompt")

    schedule = {
        "enabled": True,
        "frequency": req.frequency,
        "cron": cron_expr,
        "timezone": req.timezone,
        "target_machine_id": req.machine_id,
        "next_run_at": next_run.isoformat(),
        "last_run_at": existing_schedule.get("last_run_at"),
        "consecutive_failures": 0,
        "max_failures": 5,
        "paused_reason": None,
        "run_count": existing_schedule.get("run_count", 0),
        "created_at": existing_schedule.get("created_at", datetime.now(timezone.utc).isoformat()),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "history": existing_schedule.get("history", []),
        "task_prompt": task_prompt,
        # Preserve collaboration fields
        "triggers": existing_schedule.get("triggers", []),
        "team_hub_id": existing_schedule.get("team_hub_id"),
        "last_output_summary": existing_schedule.get("last_output_summary"),
    }

    room_settings["schedule"] = schedule

    if not db_service.client:
        raise HTTPException(status_code=500, detail="Database not available")

    try:
        import asyncio

        loop = asyncio.get_event_loop()
        await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("chats")
                .update({
                    "room_settings": room_settings,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
                .eq("id", chat_id)
                .eq("user_id", user_id)
                .execute(),
            ),
            timeout=15,
        )
    except Exception as e:
        logger.error(f"Failed to save schedule: {e}")
        raise HTTPException(status_code=500, detail="Failed to save schedule")

    return {
        "schedule": _build_schedule_response(chat, schedule).model_dump()
    }


@router.get("/{chat_id}")
async def get_schedule(
    chat_id: str,
    user_id: str = Depends(get_verified_user_id),
):
    """Get schedule configuration for a chat."""
    chat = await _verify_chat_ownership(chat_id, user_id)
    room_settings = _parse_room_settings(chat.get("room_settings"))
    schedule = room_settings.get("schedule")

    if not schedule or schedule.get("paused_reason") == "deleted":
        return {"schedule": None}

    return {
        "schedule": _build_schedule_response(chat, schedule).model_dump()
    }


@router.delete("/{chat_id}")
async def delete_schedule(
    chat_id: str,
    user_id: str = Depends(get_verified_user_id),
):
    """Disable (soft-delete) a schedule for a chat."""
    chat = await _verify_chat_ownership(chat_id, user_id)
    room_settings = _parse_room_settings(chat.get("room_settings"))
    schedule = room_settings.get("schedule")

    if not schedule:
        return {"success": True}

    schedule["enabled"] = False
    schedule["paused_reason"] = "deleted"
    room_settings["schedule"] = schedule

    try:
        import asyncio

        loop = asyncio.get_event_loop()
        await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("chats")
                .update({"room_settings": room_settings})
                .eq("id", chat_id)
                .eq("user_id", user_id)
                .execute(),
            ),
            timeout=15,
        )
    except Exception as e:
        logger.error(f"Failed to delete schedule: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete schedule")

    return {"success": True}


@router.post("/{chat_id}/run-now")
async def trigger_run_now(
    chat_id: str,
    user_id: str = Depends(get_verified_user_id),
):
    """Trigger an immediate execution of a scheduled task."""
    chat = await _verify_chat_ownership(chat_id, user_id)
    room_settings = _parse_room_settings(chat.get("room_settings"))
    schedule = room_settings.get("schedule")

    if not schedule or not schedule.get("target_machine_id"):
        raise HTTPException(
            status_code=400,
            detail="No schedule configured for this chat",
        )

    triggered = await task_scheduler.trigger_immediate(chat_id, user_id)
    if not triggered:
        raise HTTPException(
            status_code=409,
            detail="Task is already running. Please wait for the current execution to complete.",
        )

    return {"success": True, "message": "Task execution triggered"}


@router.patch("/{chat_id}/pause")
async def toggle_pause(
    chat_id: str,
    user_id: str = Depends(get_verified_user_id),
):
    """Pause or resume a schedule."""
    chat = await _verify_chat_ownership(chat_id, user_id)
    room_settings = _parse_room_settings(chat.get("room_settings"))
    schedule = room_settings.get("schedule")

    if not schedule:
        raise HTTPException(status_code=400, detail="No schedule configured")

    currently_enabled = schedule.get("enabled", False)
    schedule["enabled"] = not currently_enabled

    if currently_enabled:
        schedule["paused_reason"] = "user_paused"
    else:
        schedule["paused_reason"] = None
        schedule["consecutive_failures"] = 0
        try:
            import pytz

            tz = pytz.timezone(schedule.get("timezone", "UTC"))
            now_tz = datetime.now(tz)
            cron = croniter(schedule.get("cron", "0 * * * *"), now_tz)
            next_run = cron.get_next(datetime).astimezone(timezone.utc)
            schedule["next_run_at"] = next_run.isoformat()
        except Exception as e:
            logger.error(f"Failed to calculate next run: {e}")

    room_settings["schedule"] = schedule

    try:
        import asyncio

        loop = asyncio.get_event_loop()
        await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("chats")
                .update({
                    "room_settings": room_settings,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                })
                .eq("id", chat_id)
                .eq("user_id", user_id)
                .execute(),
            ),
            timeout=15,
        )
    except Exception as e:
        logger.error(f"Failed to toggle pause: {e}")
        raise HTTPException(status_code=500, detail="Failed to update schedule")

    action = "resumed" if schedule["enabled"] else "paused"
    return {"success": True, "enabled": schedule["enabled"], "message": f"Schedule {action}"}


# ─── Triggers ───


class UpdateTriggersRequest(BaseModel):
    triggers: List[TriggerConfig]


@router.put("/{chat_id}/triggers")
async def update_triggers(
    chat_id: str,
    req: UpdateTriggersRequest,
    user_id: str = Depends(get_verified_user_id),
):
    """Set the trigger list for a schedule."""
    chat = await _verify_chat_ownership(chat_id, user_id)
    room_settings = _parse_room_settings(chat.get("room_settings"))
    schedule = room_settings.get("schedule")
    if not schedule:
        raise HTTPException(status_code=400, detail="No schedule configured for this chat")

    # Validate target chats exist and belong to user
    import uuid as _uuid

    for trig in req.triggers:
        if trig.target_chat_id == chat_id:
            raise HTTPException(status_code=400, detail="An agent cannot trigger itself")
        await _verify_chat_ownership(trig.target_chat_id, user_id)
        if not trig.id:
            trig.id = str(_uuid.uuid4())[:8]

    schedule["triggers"] = [t.model_dump() for t in req.triggers]
    room_settings["schedule"] = schedule

    try:
        import asyncio

        loop = asyncio.get_event_loop()
        await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("chats")
                .update({"room_settings": room_settings})
                .eq("id", chat_id)
                .eq("user_id", user_id)
                .execute(),
            ),
            timeout=15,
        )
    except Exception as e:
        logger.error(f"Failed to update triggers: {e}")
        raise HTTPException(status_code=500, detail="Failed to update triggers")

    return {"success": True, "triggers": schedule["triggers"]}


# ─── Delegates ───


class DelegateConfig(BaseModel):
    chat_id: str = Field(description="Chat ID of the delegate employee")
    title: str = Field(description="Display name of the delegate")
    role: str = Field(default="General tasks", description="Role/specialty description")


class UpdateDelegatesRequest(BaseModel):
    delegates: List[DelegateConfig] = Field(
        default_factory=list, description="List of delegate employees"
    )


@router.put("/{chat_id}/delegates")
async def update_delegates(
    chat_id: str,
    req: UpdateDelegatesRequest,
    user_id: str = Depends(get_verified_user_id),
):
    """Set the delegates list for a schedule (employees this agent can call)."""
    chat = await _verify_chat_ownership(chat_id, user_id)
    room_settings = _parse_room_settings(chat.get("room_settings"))
    schedule = room_settings.get("schedule")
    if not schedule:
        raise HTTPException(status_code=400, detail="No schedule configured for this chat")

    # Validate delegates
    for delegate in req.delegates:
        if delegate.chat_id == chat_id:
            raise HTTPException(status_code=400, detail="An employee cannot delegate to itself")
        # Verify delegate chat exists and belongs to user
        delegate_chat = await _verify_chat_ownership(delegate.chat_id, user_id)
        # Verify delegate has a schedule with a machine
        delegate_rs = _parse_room_settings(delegate_chat.get("room_settings"))
        delegate_sched = delegate_rs.get("schedule", {})
        if not delegate_sched.get("target_machine_id"):
            raise HTTPException(
                status_code=400,
                detail=f"Delegate '{delegate.title}' has no machine assigned",
            )

    schedule["delegates"] = [
        {
            "chat_id": d.chat_id,
            "title": d.title,
            "role": d.role,
            "added_at": datetime.now(timezone.utc).isoformat(),
        }
        for d in req.delegates
    ]
    room_settings["schedule"] = schedule

    try:
        import asyncio

        loop = asyncio.get_event_loop()
        await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("chats")
                .update({"room_settings": room_settings})
                .eq("id", chat_id)
                .eq("user_id", user_id)
                .execute(),
            ),
            timeout=15,
        )
    except Exception as e:
        logger.error(f"Failed to update delegates: {e}")
        raise HTTPException(status_code=500, detail="Failed to update delegates")

    return {"success": True, "delegates": schedule["delegates"]}


@router.get("/{chat_id}/delegates")
async def get_delegates(
    chat_id: str,
    user_id: str = Depends(get_verified_user_id),
):
    """Get the delegates list for a schedule."""
    chat = await _verify_chat_ownership(chat_id, user_id)
    room_settings = _parse_room_settings(chat.get("room_settings"))
    schedule = room_settings.get("schedule", {})
    delegates = schedule.get("delegates", [])
    return {"success": True, "delegates": delegates}


# ─── Team Hubs ───


class CreateTeamRequest(BaseModel):
    name: str = Field(description="Team name")
    instructions: Optional[str] = Field(default=None, description="Team-wide guidelines")
    member_chat_ids: List[str] = Field(default_factory=list, description="Chat IDs to add as members")


class UpdateTeamRequest(BaseModel):
    name: Optional[str] = None
    instructions: Optional[str] = None


class TeamResponse(BaseModel):
    hub_id: str
    name: str
    instructions: Optional[str]
    members: List[dict]
    shared_memory_keys: List[str]
    created_at: str


@router.post("/teams/create")
async def create_team(
    req: CreateTeamRequest,
    user_id: str = Depends(get_verified_user_id),
):
    """Create a team hub (stored as a regular chat row with team_hub in room_settings)."""
    if not db_service.client:
        raise HTTPException(status_code=500, detail="Database not available")

    import asyncio

    loop = asyncio.get_event_loop()

    # Validate member chats
    for mid in req.member_chat_ids:
        await _verify_chat_ownership(mid, user_id)

    now = datetime.now(timezone.utc).isoformat()
    hub_room_settings = {
        "team_hub": {
            "name": req.name,
            "instructions": req.instructions or "",
            "members": [],
            "shared_memory": {},
            "created_at": now,
        }
    }

    # Build member entries
    for mid in req.member_chat_ids:
        member_chat = await db_service.get_chat(mid)
        hub_room_settings["team_hub"]["members"].append({
            "chat_id": mid,
            "title": member_chat.get("title", "Untitled") if member_chat else "Untitled",
            "added_at": now,
        })

    # Create hub chat row
    try:
        response = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("chats")
                .insert({
                    "user_id": user_id,
                    "title": f"Team: {req.name}",
                    "room_settings": hub_room_settings,
                })
                .execute(),
            ),
            timeout=15,
        )
        hub_id = response.data[0]["id"]
    except Exception as e:
        logger.error(f"Failed to create team hub: {e}")
        raise HTTPException(status_code=500, detail="Failed to create team")

    # Link member schedules to this hub
    for mid in req.member_chat_ids:
        await _link_member_to_hub(mid, hub_id, user_id)

    return {
        "team": TeamResponse(
            hub_id=hub_id,
            name=req.name,
            instructions=req.instructions,
            members=hub_room_settings["team_hub"]["members"],
            shared_memory_keys=[],
            created_at=now,
        ).model_dump()
    }


async def _link_member_to_hub(chat_id: str, hub_id: str, user_id: str):
    """Set team_hub_id on a member chat's schedule."""
    import asyncio

    chat = await db_service.get_chat(chat_id)
    if not chat:
        return
    rs = _parse_room_settings(chat.get("room_settings"))
    schedule = rs.get("schedule", {})
    schedule["team_hub_id"] = hub_id
    rs["schedule"] = schedule

    loop = asyncio.get_event_loop()
    try:
        await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("chats")
                .update({"room_settings": rs})
                .eq("id", chat_id)
                .eq("user_id", user_id)
                .execute(),
            ),
            timeout=10,
        )
    except Exception as e:
        logger.warning(f"Failed to link member {chat_id} to hub {hub_id}: {e}")


async def _unlink_member_from_hub(chat_id: str, user_id: str):
    """Remove team_hub_id from a member chat's schedule."""
    import asyncio

    chat = await db_service.get_chat(chat_id)
    if not chat:
        return
    rs = _parse_room_settings(chat.get("room_settings"))
    schedule = rs.get("schedule", {})
    schedule.pop("team_hub_id", None)
    rs["schedule"] = schedule

    loop = asyncio.get_event_loop()
    try:
        await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("chats")
                .update({"room_settings": rs})
                .eq("id", chat_id)
                .eq("user_id", user_id)
                .execute(),
            ),
            timeout=10,
        )
    except Exception as e:
        logger.warning(f"Failed to unlink member {chat_id}: {e}")


@router.get("/teams/list")
async def list_teams(
    user_id: str = Depends(get_verified_user_id),
):
    """List all team hubs for the user."""
    if not db_service.client:
        return {"teams": []}

    try:
        import asyncio

        loop = asyncio.get_event_loop()
        response = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("chats")
                .select("id, title, room_settings, created_at")
                .eq("user_id", user_id)
                .not_.is_("room_settings", "null")
                .order("created_at", desc=True)
                .execute(),
            ),
            timeout=15,
        )

        teams = []
        if response and response.data:
            for chat in response.data:
                rs = _parse_room_settings(chat.get("room_settings"))
                hub = rs.get("team_hub")
                if not hub:
                    continue
                teams.append(TeamResponse(
                    hub_id=chat["id"],
                    name=hub.get("name", "Untitled Team"),
                    instructions=hub.get("instructions"),
                    members=hub.get("members", []),
                    shared_memory_keys=list(hub.get("shared_memory", {}).keys()),
                    created_at=hub.get("created_at", chat.get("created_at", "")),
                ).model_dump())

        return {"teams": teams}

    except Exception as e:
        logger.error(f"Failed to list teams: {e}")
        return {"teams": []}


@router.get("/teams/{hub_id}")
async def get_team(
    hub_id: str,
    user_id: str = Depends(get_verified_user_id),
):
    """Get a team hub's details."""
    chat = await _verify_chat_ownership(hub_id, user_id)
    rs = _parse_room_settings(chat.get("room_settings"))
    hub = rs.get("team_hub")
    if not hub:
        raise HTTPException(status_code=404, detail="Not a team hub")

    return {
        "team": TeamResponse(
            hub_id=hub_id,
            name=hub.get("name", ""),
            instructions=hub.get("instructions"),
            members=hub.get("members", []),
            shared_memory_keys=list(hub.get("shared_memory", {}).keys()),
            created_at=hub.get("created_at", ""),
        ).model_dump()
    }


@router.patch("/teams/{hub_id}")
async def update_team(
    hub_id: str,
    req: UpdateTeamRequest,
    user_id: str = Depends(get_verified_user_id),
):
    """Update a team hub's name or instructions."""
    chat = await _verify_chat_ownership(hub_id, user_id)
    rs = _parse_room_settings(chat.get("room_settings"))
    hub = rs.get("team_hub")
    if not hub:
        raise HTTPException(status_code=404, detail="Not a team hub")

    if req.name is not None:
        hub["name"] = req.name
    if req.instructions is not None:
        hub["instructions"] = req.instructions

    rs["team_hub"] = hub

    try:
        import asyncio

        loop = asyncio.get_event_loop()
        await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("chats")
                .update({
                    "room_settings": rs,
                    "title": f"Team: {hub['name']}",
                })
                .eq("id", hub_id)
                .eq("user_id", user_id)
                .execute(),
            ),
            timeout=15,
        )
    except Exception as e:
        logger.error(f"Failed to update team: {e}")
        raise HTTPException(status_code=500, detail="Failed to update team")

    return {"success": True}


@router.post("/teams/{hub_id}/members")
async def add_team_member(
    hub_id: str,
    chat_id: str = Query(..., description="Chat ID of the agent to add"),
    user_id: str = Depends(get_verified_user_id),
):
    """Add a member to a team."""
    hub_chat = await _verify_chat_ownership(hub_id, user_id)
    member_chat = await _verify_chat_ownership(chat_id, user_id)

    rs = _parse_room_settings(hub_chat.get("room_settings"))
    hub = rs.get("team_hub")
    if not hub:
        raise HTTPException(status_code=404, detail="Not a team hub")

    members = hub.get("members", [])
    if any(m["chat_id"] == chat_id for m in members):
        return {"success": True, "message": "Already a member"}

    members.append({
        "chat_id": chat_id,
        "title": member_chat.get("title", "Untitled"),
        "added_at": datetime.now(timezone.utc).isoformat(),
    })
    hub["members"] = members
    rs["team_hub"] = hub

    try:
        import asyncio

        loop = asyncio.get_event_loop()
        await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("chats")
                .update({"room_settings": rs})
                .eq("id", hub_id)
                .eq("user_id", user_id)
                .execute(),
            ),
            timeout=15,
        )
    except Exception as e:
        logger.error(f"Failed to add member: {e}")
        raise HTTPException(status_code=500, detail="Failed to add member")

    await _link_member_to_hub(chat_id, hub_id, user_id)
    return {"success": True}


@router.delete("/teams/{hub_id}/members")
async def remove_team_member(
    hub_id: str,
    chat_id: str = Query(..., description="Chat ID of the agent to remove"),
    user_id: str = Depends(get_verified_user_id),
):
    """Remove a member from a team."""
    hub_chat = await _verify_chat_ownership(hub_id, user_id)

    rs = _parse_room_settings(hub_chat.get("room_settings"))
    hub = rs.get("team_hub")
    if not hub:
        raise HTTPException(status_code=404, detail="Not a team hub")

    members = hub.get("members", [])
    hub["members"] = [m for m in members if m["chat_id"] != chat_id]
    rs["team_hub"] = hub

    try:
        import asyncio

        loop = asyncio.get_event_loop()
        await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("chats")
                .update({"room_settings": rs})
                .eq("id", hub_id)
                .eq("user_id", user_id)
                .execute(),
            ),
            timeout=15,
        )
    except Exception as e:
        logger.error(f"Failed to remove member: {e}")
        raise HTTPException(status_code=500, detail="Failed to remove member")

    await _unlink_member_from_hub(chat_id, user_id)
    return {"success": True}


@router.delete("/teams/{hub_id}")
async def delete_team(
    hub_id: str,
    user_id: str = Depends(get_verified_user_id),
):
    """Delete a team hub and unlink all members."""
    hub_chat = await _verify_chat_ownership(hub_id, user_id)
    rs = _parse_room_settings(hub_chat.get("room_settings"))
    hub = rs.get("team_hub")
    if not hub:
        raise HTTPException(status_code=404, detail="Not a team hub")

    # Unlink all members
    for member in hub.get("members", []):
        await _unlink_member_from_hub(member["chat_id"], user_id)

    # Delete the hub chat row
    try:
        import asyncio

        loop = asyncio.get_event_loop()
        await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: db_service.client.table("chats")
                .delete()
                .eq("id", hub_id)
                .eq("user_id", user_id)
                .execute(),
            ),
            timeout=15,
        )
    except Exception as e:
        logger.error(f"Failed to delete team: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete team")

    return {"success": True}


@router.get("/teams/{hub_id}/memory")
async def get_team_shared_memory(
    hub_id: str,
    user_id: str = Depends(get_verified_user_id),
):
    """View all shared memory entries for a team."""
    hub_chat = await _verify_chat_ownership(hub_id, user_id)
    rs = _parse_room_settings(hub_chat.get("room_settings"))
    hub = rs.get("team_hub")
    if not hub:
        raise HTTPException(status_code=404, detail="Not a team hub")

    memory = hub.get("shared_memory", {})
    entries = []
    for key, val in memory.items():
        entries.append({
            "key": key,
            "value": val.get("value", ""),
            "written_by": val.get("written_by_title", "unknown"),
            "updated_at": val.get("updated_at", ""),
        })

    return {"memory": entries}
