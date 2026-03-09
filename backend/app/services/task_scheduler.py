"""
Task Scheduler Service - Polls for due scheduled tasks and fires execution.

Uses a simple asyncio polling loop (matching the periodic_cleanup pattern in main.py)
that checks every 60 seconds for chats with enabled schedules whose next_run_at has passed.

Supports agent-to-agent triggers: when a schedule completes/fails, it can automatically
trigger other schedules with context from the source agent's output.
"""

import asyncio
import json
import logging
from collections import deque
from datetime import datetime, timezone
from typing import Dict, Optional, Any, Deque, List

from croniter import croniter
import pytz

from app.core.config import settings
from app.services.database import DatabaseService
from app.services.agent_billing import agent_billing_service
from app.services.vm_control import vm_control_service

logger = logging.getLogger(__name__)

# Maximum trigger chain depth to prevent infinite loops (A→B→A→B...)
MAX_TRIGGER_DEPTH = 5


class TaskScheduler:
    """Scheduler that polls DB for due scheduled tasks and executes them."""

    def __init__(self):
        self.db_service = DatabaseService()
        self.running_tasks: Dict[str, asyncio.Task] = {}  # chat_id -> asyncio.Task
        self.missed_runs: Dict[str, Deque[dict]] = {}  # chat_id -> queued re-run contexts (max 2)
        self.lock = asyncio.Lock()
        self._parse_schedule_limits()

    def _parse_schedule_limits(self):
        """Parse per-tier schedule limits from config."""
        self.schedule_limits = {"free": 3, "basic": 3, "pro": 10, "enterprise": 50}
        try:
            for pair in settings.SCHEDULE_LIMITS.split(","):
                tier, limit = pair.strip().split(":")
                self.schedule_limits[tier.strip()] = int(limit.strip())
        except Exception:
            pass

    async def start(self):
        """Main polling loop - runs every SCHEDULER_POLL_INTERVAL seconds."""
        if not settings.SCHEDULER_ENABLED:
            logger.info("Task scheduler is disabled")
            return

        logger.info(
            f"Task scheduler started (poll interval: {settings.SCHEDULER_POLL_INTERVAL}s)"
        )

        while True:
            try:
                await asyncio.sleep(settings.SCHEDULER_POLL_INTERVAL)
                logger.info("Scheduler: polling for due tasks...")
                await self._check_and_fire_due_tasks()
            except asyncio.CancelledError:
                logger.info("Task scheduler shutting down")
                break
            except Exception as e:
                logger.error(f"Task scheduler error: {e}", exc_info=True)

    async def _check_and_fire_due_tasks(self):
        """Query all chats with enabled schedules, fire any that are due."""
        async with self.lock:
            try:
                # Clean up completed tasks
                self._cleanup_completed_tasks()

                scheduled_chats = await self._get_enabled_schedules()
                if not scheduled_chats:
                    logger.info("Scheduler poll: no enabled schedules found")
                    return

                logger.info(
                    f"Scheduler poll: {len(scheduled_chats)} enabled schedule(s), "
                    f"{len(self.running_tasks)} task(s) currently running"
                )

                now = datetime.now(timezone.utc)

                for chat in scheduled_chats:
                    chat_id = chat["id"]
                    user_id = chat["user_id"]
                    room_settings = self._parse_room_settings(chat.get("room_settings"))
                    schedule = room_settings.get("schedule", {})

                    if not schedule.get("enabled"):
                        continue

                    # Check if paused
                    if schedule.get("paused_reason"):
                        continue

                    # Check circuit breaker
                    consecutive_failures = schedule.get("consecutive_failures", 0)
                    max_failures = schedule.get(
                        "max_failures", settings.MAX_CONSECUTIVE_FAILURES
                    )
                    if consecutive_failures >= max_failures:
                        await self._pause_schedule(
                            chat_id, room_settings, "too_many_failures"
                        )
                        logger.warning(
                            f"Auto-disabled schedule for chat {chat_id}: "
                            f"{consecutive_failures} consecutive failures"
                        )
                        continue

                    # Check if due
                    next_run_str = schedule.get("next_run_at")
                    if not next_run_str:
                        # Calculate initial next_run
                        next_run = self._calculate_next_run(
                            schedule.get("cron", "0 * * * *"),
                            schedule.get("timezone", "UTC"),
                        )
                        if next_run:
                            schedule["next_run_at"] = next_run.isoformat()
                            await self._update_schedule(chat_id, room_settings)
                        continue

                    next_run = datetime.fromisoformat(
                        next_run_str.replace("Z", "+00:00")
                    )
                    if next_run > now:
                        continue  # Not due yet

                    # Check overlap - skip if previous run still active
                    if chat_id in self.running_tasks:
                        running_task = self.running_tasks[chat_id]
                        if not running_task.done():
                            # Cancel tasks stuck longer than max timeout
                            start_time = getattr(running_task, '_start_time', None)
                            max_timeout = settings.SCHEDULED_TASK_MAX_TIMEOUT
                            if start_time and (now - start_time).total_seconds() > max_timeout:
                                logger.warning(
                                    f"Cancelling stuck task for chat {chat_id} "
                                    f"(running for >{max_timeout // 60}min)"
                                )
                                running_task.cancel()
                                del self.running_tasks[chat_id]
                            else:
                                q = self.missed_runs.get(chat_id)
                                if q is None:
                                    q = deque(maxlen=2)
                                    self.missed_runs[chat_id] = q
                                if len(q) < q.maxlen:
                                    q.append({
                                        "user_id": user_id,
                                        "room_settings": room_settings,
                                        "schedule": schedule,
                                    })
                                    logger.info(
                                        f"Queued missed run for chat {chat_id} "
                                        f"({len(q)}/{q.maxlen}): previous run still in progress"
                                    )
                                else:
                                    logger.info(
                                        f"Missed-run queue full for chat {chat_id} "
                                        f"({len(q)}/{q.maxlen}), skipping additional overlap"
                                    )
                                continue

                    # Advance next_run_at BEFORE firing so the schedule
                    # doesn't show "Overdue" while the task is executing
                    next_next_run = self._calculate_next_run(
                        schedule.get("cron", "0 * * * *"),
                        schedule.get("timezone", "UTC"),
                    )
                    if next_next_run:
                        schedule["next_run_at"] = next_next_run.isoformat()
                        room_settings["schedule"] = schedule
                        await self._update_schedule(chat_id, room_settings)

                    # Fire the task
                    logger.info(
                        f"Firing scheduled task for chat {chat_id} "
                        f"(user={user_id}, frequency={schedule.get('frequency')})"
                    )
                    task = asyncio.create_task(
                        self._execute_with_error_handling(
                            chat_id, user_id, room_settings, schedule
                        )
                    )
                    task._start_time = now  # Track when the task started
                    self.running_tasks[chat_id] = task

            except Exception as e:
                logger.error(f"Error checking due tasks: {e}", exc_info=True)

    async def _execute_with_error_handling(
        self,
        chat_id: str,
        user_id: str,
        room_settings: dict,
        schedule: dict,
        trigger: str = "cron",
        triggered_context: Optional[Dict] = None,
        trigger_depth: int = 0,
    ):
        """Wrapper that handles execution result and updates schedule metadata."""
        try:
            # Import here to avoid circular imports
            from app.services.scheduled_executor import execute_scheduled_chat

            machine_id = schedule.get("target_machine_id")
            if not machine_id:
                await self._finalize_execution(
                    chat_id, user_id, "failed",
                    error="No target machine configured",
                    success=False, trigger=trigger,
                    trigger_depth=trigger_depth,
                )
                return

            # Check machine availability
            machine_status = await self._check_machine_available(machine_id, user_id)
            if not machine_status["available"]:
                reason = machine_status["reason"]
                logger.warning(
                    f"Machine {machine_id} not available for chat {chat_id}: {reason}"
                )
                await self._finalize_execution(
                    chat_id, user_id, "skipped",
                    error=f"Machine unavailable: {reason}",
                    success=False, trigger=trigger,
                    pause_reason="machine_unavailable" if reason == "machine_not_found" else None,
                    trigger_depth=trigger_depth,
                )
                return

            # Check credits
            balance_check = await agent_billing_service.check_balance_for_session(
                user_id
            )
            if not balance_check.get("can_start"):
                logger.warning(
                    f"Insufficient credits for scheduled task {chat_id} "
                    f"(balance: {balance_check.get('current_balance', 0)})"
                )
                await self._finalize_execution(
                    chat_id, user_id, "skipped",
                    error="Insufficient credits",
                    success=False, trigger=trigger,
                    pause_reason="insufficient_credits",
                    trigger_depth=trigger_depth,
                )
                return

            # Execute with configurable max timeout as safety net
            max_timeout = settings.SCHEDULED_TASK_MAX_TIMEOUT
            try:
                result = await asyncio.wait_for(
                    execute_scheduled_chat(
                        chat_id=chat_id,
                        user_id=user_id,
                        machine_id=machine_id,
                        model=schedule.get("model"),
                        task_prompt_override=schedule.get("task_prompt"),
                        triggered_context=triggered_context,
                    ),
                    timeout=max_timeout,
                )
            except asyncio.TimeoutError:
                max_min = max_timeout // 60
                logger.warning(
                    f"Scheduled task {chat_id} timed out after {max_min} minutes"
                )
                await self._finalize_execution(
                    chat_id, user_id, "failed",
                    error=f"Execution timed out ({max_min} min limit)",
                    success=False, trigger=trigger,
                    trigger_depth=trigger_depth,
                )
                return

            status = result.get("status", "failed")
            await self._finalize_execution(
                chat_id, user_id, status,
                duration_seconds=result.get("duration_seconds"),
                credits_charged=result.get("credits_charged"),
                error=result.get("error"),
                success=status in ("completed", "cancelled"),
                trigger=trigger,
                trigger_depth=trigger_depth,
            )

        except asyncio.CancelledError:
            logger.warning(f"Scheduled task {chat_id} was cancelled")
            await self._finalize_execution(
                chat_id, user_id, "failed",
                error="Task cancelled (stuck too long)",
                success=False, trigger=trigger,
                trigger_depth=trigger_depth,
            )

        except Exception as e:
            logger.error(
                f"Scheduled task execution failed for chat {chat_id}: {e}",
                exc_info=True,
            )
            await self._finalize_execution(
                chat_id, user_id, "failed",
                error=str(e),
                success=False, trigger=trigger,
                trigger_depth=trigger_depth,
            )

        finally:
            # Drain any queued missed run for this chat
            await self._drain_missed_run(chat_id)

    async def _check_machine_available(
        self, machine_id: str, user_id: str
    ) -> Dict[str, Any]:
        """Check if a target machine is available for execution."""
        # Check Electron machine (connected via WebSocket)
        electron_session = vm_control_service.session_data.get(machine_id, {})
        if electron_session.get("is_electron"):
            if machine_id in vm_control_service.connections:
                return {"available": True}
            return {"available": False, "reason": "electron_offline"}

        # Check DB-registered machine
        machine = await self.db_service.get_machine(machine_id, user_id)
        if not machine:
            return {"available": False, "reason": "machine_not_found"}

        machine_settings = machine.get("settings", {})
        if machine_settings.get("provider") == "electron":
            # Electron machine registered in DB but not connected
            if machine_id not in vm_control_service.connections:
                return {"available": False, "reason": "electron_offline"}
            return {"available": True}

        if machine.get("status") != "running":
            return {
                "available": False,
                "reason": f"machine_status_{machine.get('status', 'unknown')}",
            }

        return {"available": True}

    async def _get_enabled_schedules(self) -> List[dict]:
        """Fetch all chats with enabled schedules using server-side JSONB filter."""
        if not self.db_service.client:
            logger.warning("Scheduler: DB client is None, cannot query schedules")
            return []

        max_retries = 3
        retry_delay = 2

        for attempt in range(max_retries):
            try:
                # Use JSONB contains (cs) operator so Postgres filters server-side,
                # avoiding the default 1000-row limit for non-scheduled chats.
                filter_json = json.dumps({"schedule": {"enabled": True}})

                loop = asyncio.get_event_loop()
                response = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda: self.db_service.client.table("chats")
                        .select("id, user_id, title, room_settings")
                        .contains("room_settings", filter_json)
                        .execute(),
                    ),
                    timeout=15,
                )

                if not response or not response.data:
                    logger.info("Scheduler: no enabled schedules found in DB")
                    return []

                logger.info(
                    f"Scheduler: found {len(response.data)} chat(s) with enabled schedules"
                )

                # Verify each result (belt-and-suspenders)
                results = []
                for chat in response.data:
                    rs = self._parse_room_settings(chat.get("room_settings"))
                    schedule = rs.get("schedule", {})
                    logger.info(
                        f"  Chat {chat['id'][:8]}... schedule: "
                        f"enabled={schedule.get('enabled')}, "
                        f"paused={schedule.get('paused_reason')}, "
                        f"freq={schedule.get('frequency')}, "
                        f"next_run={schedule.get('next_run_at')}"
                    )
                    if schedule.get("enabled"):
                        results.append(chat)

                return results

            except asyncio.TimeoutError:
                if attempt < max_retries - 1:
                    logger.warning(f"Scheduler: timeout fetching schedules (attempt {attempt + 1}/{max_retries}), retrying...")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    logger.error("Scheduler: all retry attempts timed out fetching schedules")
                    return []

            except Exception as e:
                error_str = str(e)
                is_transient = (
                    "520" in error_str
                    or "521" in error_str
                    or "502" in error_str
                    or "503" in error_str
                    or "504" in error_str
                    or "web server" in error_str.lower()
                    or "connection" in error_str.lower() and "error" in error_str.lower()
                )

                if is_transient and attempt < max_retries - 1:
                    logger.warning(f"Scheduler: transient error fetching schedules (attempt {attempt + 1}/{max_retries}): {error_str[:200]}")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    logger.error(f"Failed to fetch enabled schedules: {error_str[:200]}", exc_info=True)
                    return []

        return []

    def _parse_room_settings(self, room_settings) -> dict:
        """Parse room_settings which may be a JSON string or dict."""
        if not room_settings:
            return {}
        if isinstance(room_settings, str):
            try:
                return json.loads(room_settings)
            except Exception:
                return {}
        return room_settings

    def _calculate_next_run(
        self, cron_expr: str, tz_name: str = "UTC"
    ) -> Optional[datetime]:
        """Calculate the next run time from a cron expression."""
        try:
            tz = pytz.timezone(tz_name)
            now = datetime.now(tz)
            cron = croniter(cron_expr, now)
            next_run = cron.get_next(datetime)
            # Convert to UTC for storage
            return next_run.astimezone(timezone.utc)
        except Exception as e:
            logger.error(f"Failed to calculate next run from cron '{cron_expr}': {e}")
            return None

    async def _update_schedule(self, chat_id: str, room_settings: dict):
        """Update the room_settings for a chat."""
        if not self.db_service.client:
            return

        max_retries = 3
        retry_delay = 2

        for attempt in range(max_retries):
            try:
                loop = asyncio.get_event_loop()
                await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda: self.db_service.client.table("chats")
                        .update({"room_settings": room_settings})
                        .eq("id", chat_id)
                        .execute(),
                    ),
                    timeout=15,
                )
                return
            except Exception as e:
                error_str = str(e)
                is_transient = any(code in error_str for code in ("520", "521", "502", "503", "504")) or "web server" in error_str.lower()
                if is_transient and attempt < max_retries - 1:
                    logger.warning(f"Transient error updating schedule for chat {chat_id} (attempt {attempt + 1}/{max_retries}): {error_str[:200]}")
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    logger.error(f"Failed to update schedule for chat {chat_id}: {error_str[:200]}")
                    return

    async def _pause_schedule(
        self, chat_id: str, room_settings: dict, reason: str
    ):
        """Pause a schedule with a reason (used by circuit breaker in polling loop)."""
        schedule = room_settings.get("schedule", {})
        schedule["enabled"] = False
        schedule["paused_reason"] = reason
        room_settings["schedule"] = schedule
        await self._update_schedule(chat_id, room_settings)
        logger.info(f"Paused schedule for chat {chat_id}: {reason}")

    async def _finalize_execution(
        self,
        chat_id: str,
        user_id: str,
        status: str,
        duration_seconds: Optional[int] = None,
        credits_charged: Optional[int] = None,
        error: Optional[str] = None,
        trigger: str = "cron",
        success: bool = False,
        pause_reason: Optional[str] = None,
        trigger_depth: int = 0,
    ):
        """
        Atomic finalization: records history entry, updates schedule metadata,
        generates output summary, advances next_run_at, and processes triggers
        — all in a single read-modify-write to prevent race conditions.
        """
        if not self.db_service.client:
            return

        try:
            import uuid as _uuid

            now = datetime.now(timezone.utc)

            # 1. Read fresh room_settings from DB
            chat = await self.db_service.get_chat(chat_id)
            if not chat:
                return

            room_settings = self._parse_room_settings(chat.get("room_settings"))
            schedule = room_settings.get("schedule", {})

            # 2. Append history entry
            history_entry = {
                "id": str(_uuid.uuid4()),
                "status": status,
                "trigger": trigger,
                "duration_seconds": duration_seconds,
                "credits_charged": credits_charged,
                "error": error,
                "executed_at": now.isoformat(),
            }
            history = schedule.get("history", [])
            history.insert(0, history_entry)  # newest first
            schedule["history"] = history[:100]

            # 3. Update schedule metadata
            schedule["last_run_at"] = now.isoformat()

            if success:
                schedule["consecutive_failures"] = 0
                schedule["run_count"] = schedule.get("run_count", 0) + 1
                schedule["paused_reason"] = None
            else:
                schedule["consecutive_failures"] = (
                    schedule.get("consecutive_failures", 0) + 1
                )

            # 4. Pause if requested
            if pause_reason:
                schedule["enabled"] = False
                schedule["paused_reason"] = pause_reason
                logger.info(f"Paused schedule for chat {chat_id}: {pause_reason}")

            # 5. Generate output summary for inter-agent context
            output_summary = await self._generate_output_summary(
                chat_id, status, error
            )
            if output_summary:
                schedule["last_output_summary"] = output_summary

            # 6. Calculate next run (always, so the schedule advances)
            next_run = self._calculate_next_run(
                schedule.get("cron", "0 * * * *"),
                schedule.get("timezone", "UTC"),
            )
            if next_run:
                schedule["next_run_at"] = next_run.isoformat()

            # 7. Single atomic write with retry for transient errors
            room_settings["schedule"] = schedule

            max_retries = 3
            retry_delay = 2
            for attempt in range(max_retries):
                try:
                    loop = asyncio.get_event_loop()
                    await asyncio.wait_for(
                        loop.run_in_executor(
                            None,
                            lambda: self.db_service.client.table("chats")
                            .update({"room_settings": room_settings})
                            .eq("id", chat_id)
                            .execute(),
                        ),
                        timeout=15,
                    )
                    logger.info(
                        f"Finalized execution for chat {chat_id}: "
                        f"status={status}, success={success}, next_run={schedule.get('next_run_at')}"
                    )
                    break
                except Exception as inner_e:
                    error_str = str(inner_e)
                    is_transient = any(code in error_str for code in ("520", "521", "502", "503", "504")) or "web server" in error_str.lower()
                    if is_transient and attempt < max_retries - 1:
                        logger.warning(f"Transient error finalizing chat {chat_id} (attempt {attempt + 1}/{max_retries}): {error_str[:200]}")
                        await asyncio.sleep(retry_delay)
                        retry_delay *= 2
                    else:
                        logger.error(f"Failed to finalize execution for chat {chat_id}: {error_str[:200]}")
                        break

            # 8. Process triggers (fire-and-forget, after DB write is committed)
            await self._process_triggers(
                chat_id, user_id, status, schedule, trigger_depth
            )

        except Exception as e:
            logger.error(f"Failed to finalize execution for chat {chat_id}: {str(e)[:200]}")

    async def _generate_output_summary(
        self, chat_id: str, status: str, error: Optional[str]
    ) -> Optional[str]:
        """Generate a brief output summary from the agent's last message for inter-agent context."""
        if status == "failed":
            return f"Failed: {error or 'unknown error'}"
        if status == "skipped":
            return f"Skipped: {error or 'unknown reason'}"

        try:
            # Get the most recent assistant message from this chat
            loop = asyncio.get_event_loop()
            response = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: self.db_service.client.table("chats_messages")
                    .select("content")
                    .eq("chat_id", chat_id)
                    .eq("role", "assistant")
                    .order("created_at", desc=True)
                    .limit(1)
                    .execute(),
                ),
                timeout=10,
            )

            if not response or not response.data:
                return f"Completed (no output captured)"

            content = response.data[0].get("content", "")
            if not content:
                return "Completed successfully"

            # Truncate to reasonable summary length
            if len(content) > 500:
                return content[:500] + "..."
            return content

        except Exception as e:
            logger.warning(f"Failed to generate output summary for {chat_id}: {e}")
            return f"Completed (summary unavailable)"

    async def _process_triggers(
        self,
        source_chat_id: str,
        user_id: str,
        status: str,
        schedule: dict,
        trigger_depth: int,
    ):
        """Process triggers after a schedule execution completes."""
        triggers = schedule.get("triggers", [])
        if not triggers:
            return

        if trigger_depth >= MAX_TRIGGER_DEPTH:
            logger.warning(
                f"Trigger depth limit ({MAX_TRIGGER_DEPTH}) reached for "
                f"chat {source_chat_id}, skipping {len(triggers)} trigger(s)"
            )
            return

        source_title = None  # lazy-load if needed

        for trig in triggers:
            if not trig.get("enabled", True):
                continue

            event = trig.get("event", "on_complete")
            # Check if this trigger should fire
            if event == "on_complete" and status != "completed":
                continue
            if event == "on_failure" and status not in ("failed",):
                continue
            # "on_any" fires on any status

            target_chat_id = trig.get("target_chat_id")
            if not target_chat_id:
                continue

            # Build triggered context
            triggered_context = None
            if trig.get("pass_output", True):
                if source_title is None:
                    try:
                        chat = await self.db_service.get_chat(source_chat_id)
                        source_title = chat.get("title", "Unknown Agent") if chat else "Unknown Agent"
                    except Exception:
                        source_title = "Unknown Agent"

                triggered_context = {
                    "source_chat_id": source_chat_id,
                    "source_title": source_title,
                    "summary": schedule.get("last_output_summary", ""),
                    "trigger_depth": trigger_depth + 1,
                }

            logger.info(
                f"Trigger: {source_chat_id} ({event}) → {target_chat_id} "
                f"(depth={trigger_depth + 1})"
            )

            await self.trigger_immediate(
                target_chat_id,
                user_id,
                triggered_context=triggered_context,
                trigger_depth=trigger_depth + 1,
            )

    def _cleanup_completed_tasks(self):
        """Remove completed asyncio tasks from the tracking dict."""
        done_ids = [
            chat_id
            for chat_id, task in self.running_tasks.items()
            if task.done()
        ]
        for chat_id in done_ids:
            del self.running_tasks[chat_id]

        # Defensive: remove stale missed_runs for chats no longer running
        stale_missed = [
            cid for cid in self.missed_runs
            if cid not in self.running_tasks
        ]
        for cid in stale_missed:
            del self.missed_runs[cid]

    async def _drain_missed_run(self, chat_id: str):
        """If a cron trigger fired while this chat was running, execute the next queued one."""
        q = self.missed_runs.get(chat_id)
        if not q:
            self.missed_runs.pop(chat_id, None)
            return

        missed = q.popleft()
        if not q:
            del self.missed_runs[chat_id]

        logger.info(f"Draining queued missed run for chat {chat_id} ({len(q) if chat_id in self.missed_runs else 0} remaining)")
        now = datetime.now(timezone.utc)

        # Advance next_run_at before firing (same pattern as the main loop)
        schedule = missed["schedule"]
        next_next_run = self._calculate_next_run(
            schedule.get("cron", "0 * * * *"),
            schedule.get("timezone", "UTC"),
        )
        if next_next_run:
            schedule["next_run_at"] = next_next_run.isoformat()
            missed["room_settings"]["schedule"] = schedule
            await self._update_schedule(chat_id, missed["room_settings"])

        task = asyncio.create_task(
            self._execute_with_error_handling(
                chat_id,
                missed["user_id"],
                missed["room_settings"],
                schedule,
                trigger="cron_queued",
            )
        )
        task._start_time = now
        self.running_tasks[chat_id] = task

    async def trigger_immediate(
        self,
        chat_id: str,
        user_id: str,
        triggered_context: Optional[Dict] = None,
        trigger_depth: int = 0,
    ) -> bool:
        """Trigger an immediate execution of a scheduled task.

        Args:
            chat_id: The chat to execute.
            user_id: Owner of the chat.
            triggered_context: Optional context dict from a source agent trigger.
            trigger_depth: Current depth in a trigger chain (for loop prevention).
        """
        if chat_id in self.running_tasks and not self.running_tasks[chat_id].done():
            logger.warning(f"Cannot trigger {chat_id}: previous run still active")
            return False

        # Clear any queued missed run — manual trigger supersedes it
        self.missed_runs.pop(chat_id, None)

        chat = await self.db_service.get_chat(chat_id)
        if not chat:
            return False

        room_settings = self._parse_room_settings(chat.get("room_settings"))
        schedule = room_settings.get("schedule", {})

        if not schedule.get("target_machine_id"):
            return False

        trigger_label = "triggered" if triggered_context else "manual"
        task = asyncio.create_task(
            self._execute_with_error_handling(
                chat_id, user_id, room_settings, schedule,
                trigger=trigger_label,
                triggered_context=triggered_context,
                trigger_depth=trigger_depth,
            )
        )
        self.running_tasks[chat_id] = task
        return True

    def get_max_schedules_for_tier(self, tier: str) -> int:
        """Get the maximum number of schedules allowed for a tier."""
        return self.schedule_limits.get(tier, 0)


# Global singleton
task_scheduler = TaskScheduler()
