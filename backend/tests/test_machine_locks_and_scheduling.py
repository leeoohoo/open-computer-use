"""
Comprehensive tests for:
  1. VMControlService execution locks, busy detection, cancellation events
  2. TaskScheduler missed-run queue (max 2 per chat)
  3. End-to-end "Override & Run" cancellation flow
  4. Edge cases (double cancellation, stale events, concurrent acquires, etc.)

Run with:
    cd backend
    python -m pytest tests/test_machine_locks_and_scheduling.py -v
"""

import asyncio
from collections import deque
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# We test VMControlService in isolation (no WebSocket, no Supabase needed).
# Import the *class* so each test gets its own fresh instance.
# ---------------------------------------------------------------------------
from app.services.vm_control import VMControlService


# ═══════════════════════════════════════════════════════════════════════════
# Section 1: VMControlService — Execution Locks
# ═══════════════════════════════════════════════════════════════════════════


class TestExecutionLocks:
    """Per-machine execution lock creation, reuse, and busy detection."""

    def setup_method(self):
        self.svc = VMControlService()

    def test_get_execution_lock_creates_lock(self):
        lock = self.svc.get_execution_lock("machine-1")
        assert isinstance(lock, asyncio.Lock)
        assert "machine-1" in self.svc.execution_locks

    def test_get_execution_lock_returns_same_instance(self):
        lock1 = self.svc.get_execution_lock("machine-1")
        lock2 = self.svc.get_execution_lock("machine-1")
        assert lock1 is lock2

    def test_different_machines_get_different_locks(self):
        lock_a = self.svc.get_execution_lock("machine-a")
        lock_b = self.svc.get_execution_lock("machine-b")
        assert lock_a is not lock_b

    def test_is_machine_busy_when_no_lock_exists(self):
        busy, owner = self.svc.is_machine_busy("unknown-machine")
        assert busy is False
        assert owner is None

    @pytest.mark.asyncio
    async def test_is_machine_busy_when_lock_held(self):
        lock = self.svc.get_execution_lock("m1")
        await lock.acquire()
        self.svc.execution_owners["m1"] = "chat-42"

        busy, owner = self.svc.is_machine_busy("m1")
        assert busy is True
        assert owner == "chat-42"

        lock.release()

    @pytest.mark.asyncio
    async def test_is_machine_busy_after_lock_released(self):
        lock = self.svc.get_execution_lock("m1")
        await lock.acquire()
        self.svc.execution_owners["m1"] = "chat-42"
        lock.release()
        self.svc.execution_owners.pop("m1", None)

        busy, owner = self.svc.is_machine_busy("m1")
        assert busy is False
        assert owner is None

    @pytest.mark.asyncio
    async def test_lock_prevents_concurrent_acquisition(self):
        """Two coroutines competing for the same machine lock."""
        lock = self.svc.get_execution_lock("m1")
        order = []

        async def holder():
            await lock.acquire()
            order.append("holder-acquired")
            await asyncio.sleep(0.1)
            order.append("holder-releasing")
            lock.release()

        async def waiter():
            await asyncio.sleep(0.02)  # let holder go first
            order.append("waiter-waiting")
            await lock.acquire()
            order.append("waiter-acquired")
            lock.release()

        await asyncio.gather(holder(), waiter())

        assert order == [
            "holder-acquired",
            "waiter-waiting",
            "holder-releasing",
            "waiter-acquired",
        ]

    @pytest.mark.asyncio
    async def test_lock_timeout_behavior(self):
        """Simulate the 5-second timeout used in chat.py."""
        lock = self.svc.get_execution_lock("m1")
        await lock.acquire()
        self.svc.execution_owners["m1"] = "chat-old"

        with pytest.raises(asyncio.TimeoutError):
            await asyncio.wait_for(lock.acquire(), timeout=0.1)

        # Machine should still report busy
        busy, owner = self.svc.is_machine_busy("m1")
        assert busy is True
        assert owner == "chat-old"

        lock.release()


# ═══════════════════════════════════════════════════════════════════════════
# Section 2: VMControlService — Cancellation Events
# ═══════════════════════════════════════════════════════════════════════════


class TestCancellationEvents:
    """Per-machine cancellation event lifecycle."""

    def setup_method(self):
        self.svc = VMControlService()

    def test_get_cancellation_event_creates_event(self):
        event = self.svc.get_cancellation_event("m1")
        assert isinstance(event, asyncio.Event)
        assert not event.is_set()

    def test_get_cancellation_event_returns_same_instance(self):
        e1 = self.svc.get_cancellation_event("m1")
        e2 = self.svc.get_cancellation_event("m1")
        assert e1 is e2

    @pytest.mark.asyncio
    async def test_request_cancellation_when_busy(self):
        lock = self.svc.get_execution_lock("m1")
        await lock.acquire()
        self.svc.execution_owners["m1"] = "chat-1"

        was_busy, owner = self.svc.request_cancellation("m1")
        assert was_busy is True
        assert owner == "chat-1"
        assert self.svc.get_cancellation_event("m1").is_set()

        lock.release()

    def test_request_cancellation_when_not_busy(self):
        was_busy, owner = self.svc.request_cancellation("m-idle")
        assert was_busy is False
        assert owner is None
        # Event should NOT be set (no running execution to stop)
        assert not self.svc.get_cancellation_event("m-idle").is_set()

    @pytest.mark.asyncio
    async def test_reset_cancellation_clears_event(self):
        event = self.svc.get_cancellation_event("m1")
        event.set()
        assert event.is_set()

        self.svc.reset_cancellation("m1")
        assert not event.is_set()

    def test_reset_cancellation_noop_if_no_event(self):
        # Should not raise
        self.svc.reset_cancellation("nonexistent")

    @pytest.mark.asyncio
    async def test_double_cancellation_is_idempotent(self):
        lock = self.svc.get_execution_lock("m1")
        await lock.acquire()
        self.svc.execution_owners["m1"] = "chat-1"

        self.svc.request_cancellation("m1")
        self.svc.request_cancellation("m1")  # second call
        assert self.svc.get_cancellation_event("m1").is_set()

        lock.release()


# ═══════════════════════════════════════════════════════════════════════════
# Section 3: End-to-End "Override & Run" Flow
# ═══════════════════════════════════════════════════════════════════════════


class TestOverrideAndRunFlow:
    """Simulate the full flow: task A running → user sends B → cancel A → run B."""

    def setup_method(self):
        self.svc = VMControlService()

    @pytest.mark.asyncio
    async def test_full_override_flow(self):
        """
        1. Task A acquires lock, starts streaming
        2. User B checks busy → True
        3. User B requests cancellation → event is set
        4. Task A checks event, sees it, breaks loop, releases lock
        5. Task B acquires lock, resets cancellation, runs
        """
        machine = "m1"
        results = {"a_cancelled": False, "b_completed": False}

        async def task_a():
            lock = self.svc.get_execution_lock(machine)
            await lock.acquire()
            self.svc.execution_owners[machine] = "chat-a"
            self.svc.reset_cancellation(machine)

            # Simulate streaming chunks
            for i in range(100):
                if self.svc.get_cancellation_event(machine).is_set():
                    results["a_cancelled"] = True
                    break
                await asyncio.sleep(0.01)

            self.svc.execution_owners.pop(machine, None)
            lock.release()

        async def user_b():
            # Wait a bit for task A to start
            await asyncio.sleep(0.05)

            # Check busy
            busy, owner = self.svc.is_machine_busy(machine)
            assert busy is True
            assert owner == "chat-a"

            # Request cancellation
            self.svc.request_cancellation(machine)

            # Wait for lock release (like stop-machine endpoint)
            lock = self.svc.get_execution_lock(machine)
            for _ in range(50):
                if not lock.locked():
                    break
                await asyncio.sleep(0.05)

            assert not lock.locked(), "Lock should be released after cancellation"

            # Now task B acquires
            await lock.acquire()
            self.svc.execution_owners[machine] = "chat-b"
            self.svc.reset_cancellation(machine)

            # Verify cancellation cleared
            assert not self.svc.get_cancellation_event(machine).is_set()

            results["b_completed"] = True
            self.svc.execution_owners.pop(machine, None)
            lock.release()

        await asyncio.gather(task_a(), user_b())

        assert results["a_cancelled"] is True
        assert results["b_completed"] is True

    @pytest.mark.asyncio
    async def test_override_when_task_finishes_between_check_and_stop(self):
        """
        Edge case: task A finishes naturally between the busy check and stop call.
        request_cancellation should return (False, None). Task B proceeds normally.
        """
        machine = "m1"

        async def task_a():
            lock = self.svc.get_execution_lock(machine)
            await lock.acquire()
            self.svc.execution_owners[machine] = "chat-a"
            await asyncio.sleep(0.02)
            self.svc.execution_owners.pop(machine, None)
            lock.release()

        async def user_b():
            await asyncio.sleep(0.01)
            busy, _ = self.svc.is_machine_busy(machine)
            assert busy is True

            # Wait for A to finish naturally
            await asyncio.sleep(0.05)

            was_busy, _ = self.svc.request_cancellation(machine)
            assert was_busy is False  # Already finished

            # Acquire and run normally
            lock = self.svc.get_execution_lock(machine)
            await lock.acquire()
            self.svc.reset_cancellation(machine)
            lock.release()

        await asyncio.gather(task_a(), user_b())

    @pytest.mark.asyncio
    async def test_stale_cancellation_event_cleared_by_new_execution(self):
        """
        A cancellation event from a previous request should be cleared
        when a new execution starts (via reset_cancellation).
        """
        machine = "m1"

        # Simulate stale event
        self.svc.get_cancellation_event(machine).set()

        # New execution starts
        lock = self.svc.get_execution_lock(machine)
        await lock.acquire()
        self.svc.reset_cancellation(machine)

        # Event should be clear
        assert not self.svc.get_cancellation_event(machine).is_set()

        lock.release()


# ═══════════════════════════════════════════════════════════════════════════
# Section 4: TaskScheduler — Missed-Run Queue (max 2)
# ═══════════════════════════════════════════════════════════════════════════


class TestMissedRunQueue:
    """Test the deque-based missed-run queue with max 2 items per chat."""

    def _make_scheduler(self):
        """Create a TaskScheduler with mocked dependencies."""
        with patch("app.services.task_scheduler.DatabaseService"):
            with patch("app.services.task_scheduler.settings") as mock_settings:
                mock_settings.SCHEDULE_LIMITS = "free:3,basic:3,pro:10,enterprise:50"
                mock_settings.SCHEDULER_ENABLED = True
                mock_settings.SCHEDULER_POLL_INTERVAL = 60
                from app.services.task_scheduler import TaskScheduler
                scheduler = TaskScheduler()
        return scheduler

    def _fake_context(self, suffix=""):
        return {
            "user_id": f"user-{suffix}",
            "room_settings": {"schedule": {"cron": "* * * * *", "timezone": "UTC"}},
            "schedule": {"cron": "* * * * *", "timezone": "UTC"},
        }

    def test_queue_starts_empty(self):
        scheduler = self._make_scheduler()
        assert len(scheduler.missed_runs) == 0

    def test_enqueue_first_item(self):
        scheduler = self._make_scheduler()
        chat_id = "chat-1"

        q = deque(maxlen=2)
        scheduler.missed_runs[chat_id] = q
        ctx = self._fake_context("1")
        q.append(ctx)

        assert len(scheduler.missed_runs[chat_id]) == 1

    def test_enqueue_two_items(self):
        scheduler = self._make_scheduler()
        chat_id = "chat-1"

        q = deque(maxlen=2)
        scheduler.missed_runs[chat_id] = q
        q.append(self._fake_context("1"))
        q.append(self._fake_context("2"))

        assert len(scheduler.missed_runs[chat_id]) == 2

    def test_enqueue_third_item_drops_oldest(self):
        """deque(maxlen=2) auto-drops the oldest when a 3rd is appended."""
        scheduler = self._make_scheduler()
        chat_id = "chat-1"

        q = deque(maxlen=2)
        scheduler.missed_runs[chat_id] = q
        ctx1 = self._fake_context("1")
        ctx2 = self._fake_context("2")
        ctx3 = self._fake_context("3")
        q.append(ctx1)
        q.append(ctx2)
        q.append(ctx3)

        assert len(q) == 2
        # Oldest (ctx1) was evicted, ctx2 and ctx3 remain
        assert q[0] is ctx2
        assert q[1] is ctx3

    def test_scheduler_code_respects_maxlen_guard(self):
        """
        The scheduler code uses `if len(q) < q.maxlen` before appending.
        This means it does NOT auto-drop — it skips instead.
        Verify this behavior matches the actual code logic.
        """
        scheduler = self._make_scheduler()
        chat_id = "chat-1"

        # Simulate the actual scheduler code path
        q = scheduler.missed_runs.get(chat_id)
        if q is None:
            q = deque(maxlen=2)
            scheduler.missed_runs[chat_id] = q

        # First enqueue
        assert len(q) < q.maxlen
        q.append(self._fake_context("1"))

        # Second enqueue
        assert len(q) < q.maxlen
        q.append(self._fake_context("2"))

        # Third attempt — queue full, scheduler skips
        assert not (len(q) < q.maxlen)
        # Scheduler would log "Missed-run queue full" and continue

        assert len(q) == 2

    def test_different_chats_have_independent_queues(self):
        scheduler = self._make_scheduler()

        q1 = deque(maxlen=2)
        q2 = deque(maxlen=2)
        scheduler.missed_runs["chat-1"] = q1
        scheduler.missed_runs["chat-2"] = q2

        q1.append(self._fake_context("a"))
        q1.append(self._fake_context("b"))
        q2.append(self._fake_context("x"))

        assert len(scheduler.missed_runs["chat-1"]) == 2
        assert len(scheduler.missed_runs["chat-2"]) == 1

    @pytest.mark.asyncio
    async def test_drain_pops_first_item(self):
        """_drain_missed_run should pop the oldest item (FIFO)."""
        scheduler = self._make_scheduler()
        chat_id = "chat-1"

        q = deque(maxlen=2)
        scheduler.missed_runs[chat_id] = q
        ctx1 = self._fake_context("1")
        ctx2 = self._fake_context("2")
        q.append(ctx1)
        q.append(ctx2)

        # Mock _execute_with_error_handling and _update_schedule so drain works
        scheduler._execute_with_error_handling = AsyncMock()
        scheduler._update_schedule = AsyncMock()
        scheduler._calculate_next_run = MagicMock(
            return_value=datetime(2030, 1, 1, tzinfo=timezone.utc)
        )

        await scheduler._drain_missed_run(chat_id)

        # ctx1 was drained, a new task was created
        assert chat_id in scheduler.running_tasks
        # ctx2 should still be in the queue
        remaining = scheduler.missed_runs.get(chat_id)
        assert remaining is not None
        assert len(remaining) == 1
        assert remaining[0] is ctx2

    @pytest.mark.asyncio
    async def test_drain_removes_queue_when_last_item_popped(self):
        """When only 1 item in queue, draining it should clean up the dict entry."""
        scheduler = self._make_scheduler()
        chat_id = "chat-1"

        q = deque(maxlen=2)
        scheduler.missed_runs[chat_id] = q
        q.append(self._fake_context("1"))

        scheduler._execute_with_error_handling = AsyncMock()
        scheduler._update_schedule = AsyncMock()
        scheduler._calculate_next_run = MagicMock(
            return_value=datetime(2030, 1, 1, tzinfo=timezone.utc)
        )

        await scheduler._drain_missed_run(chat_id)

        # Queue should be removed from dict since it's now empty
        assert chat_id not in scheduler.missed_runs

    @pytest.mark.asyncio
    async def test_drain_noop_when_queue_empty(self):
        """Draining an empty/nonexistent queue should be a safe no-op."""
        scheduler = self._make_scheduler()
        # No queue exists for this chat
        await scheduler._drain_missed_run("chat-nonexistent")
        assert "chat-nonexistent" not in scheduler.missed_runs

    def test_cleanup_removes_stale_missed_runs(self):
        """_cleanup_completed_tasks should remove missed_runs for chats with no running task."""
        scheduler = self._make_scheduler()

        # Chat-1 has a completed task and missed runs
        done_task = MagicMock()
        done_task.done.return_value = True
        scheduler.running_tasks["chat-1"] = done_task

        q = deque(maxlen=2)
        q.append(self._fake_context("1"))
        scheduler.missed_runs["chat-1"] = q

        scheduler._cleanup_completed_tasks()

        # Completed task removed
        assert "chat-1" not in scheduler.running_tasks
        # Stale missed_runs also cleaned up
        assert "chat-1" not in scheduler.missed_runs


# ═══════════════════════════════════════════════════════════════════════════
# Section 5: TaskScheduler — Overlap Detection
# ═══════════════════════════════════════════════════════════════════════════


class TestOverlapDetection:
    """Test the scheduler's behavior when a new trigger fires while a task is running."""

    def _make_scheduler(self):
        with patch("app.services.task_scheduler.DatabaseService"):
            with patch("app.services.task_scheduler.settings") as mock_settings:
                mock_settings.SCHEDULE_LIMITS = "free:3,basic:3,pro:10,enterprise:50"
                mock_settings.SCHEDULER_ENABLED = True
                mock_settings.SCHEDULER_POLL_INTERVAL = 60
                from app.services.task_scheduler import TaskScheduler
                scheduler = TaskScheduler()
        return scheduler

    def test_running_task_detected_as_overlap(self):
        scheduler = self._make_scheduler()

        running = asyncio.Future()  # not done
        scheduler.running_tasks["chat-1"] = running

        assert "chat-1" in scheduler.running_tasks
        assert not scheduler.running_tasks["chat-1"].done()

    def test_stuck_task_detection_over_30_min(self):
        """Tasks running > 30 minutes should be detected as stuck."""
        scheduler = self._make_scheduler()

        task = MagicMock()
        task.done.return_value = False
        task._start_time = datetime(2020, 1, 1, tzinfo=timezone.utc)  # very old
        scheduler.running_tasks["chat-1"] = task

        now = datetime.now(timezone.utc)
        start_time = task._start_time
        assert (now - start_time).total_seconds() > 1800


# ═══════════════════════════════════════════════════════════════════════════
# Section 6: Schedule Tier Limits
# ═══════════════════════════════════════════════════════════════════════════


class TestScheduleTierLimits:
    """Test per-tier schedule limit parsing and enforcement."""

    def _make_scheduler(self):
        with patch("app.services.task_scheduler.DatabaseService"):
            with patch("app.services.task_scheduler.settings") as mock_settings:
                mock_settings.SCHEDULE_LIMITS = "free:3,basic:3,pro:10,enterprise:50"
                mock_settings.SCHEDULER_ENABLED = True
                mock_settings.SCHEDULER_POLL_INTERVAL = 60
                from app.services.task_scheduler import TaskScheduler
                scheduler = TaskScheduler()
        return scheduler

    def test_default_limits(self):
        scheduler = self._make_scheduler()
        assert scheduler.get_max_schedules_for_tier("free") == 3
        assert scheduler.get_max_schedules_for_tier("basic") == 3
        assert scheduler.get_max_schedules_for_tier("pro") == 10
        assert scheduler.get_max_schedules_for_tier("enterprise") == 50

    def test_unknown_tier_returns_zero(self):
        scheduler = self._make_scheduler()
        assert scheduler.get_max_schedules_for_tier("nonexistent") == 0

    def test_custom_limits_from_config(self):
        with patch("app.services.task_scheduler.DatabaseService"):
            with patch("app.services.task_scheduler.settings") as mock_settings:
                mock_settings.SCHEDULE_LIMITS = "free:5,pro:20"
                mock_settings.SCHEDULER_ENABLED = True
                mock_settings.SCHEDULER_POLL_INTERVAL = 60
                from app.services.task_scheduler import TaskScheduler
                scheduler = TaskScheduler()

        assert scheduler.get_max_schedules_for_tier("free") == 5
        assert scheduler.get_max_schedules_for_tier("pro") == 20


# ═══════════════════════════════════════════════════════════════════════════
# Section 7: Cron Expression → Next Run Calculation
# ═══════════════════════════════════════════════════════════════════════════


class TestCronCalculation:
    """Test the _calculate_next_run method."""

    def _make_scheduler(self):
        with patch("app.services.task_scheduler.DatabaseService"):
            with patch("app.services.task_scheduler.settings") as mock_settings:
                mock_settings.SCHEDULE_LIMITS = "free:3,basic:3,pro:10,enterprise:50"
                mock_settings.SCHEDULER_ENABLED = True
                mock_settings.SCHEDULER_POLL_INTERVAL = 60
                from app.services.task_scheduler import TaskScheduler
                scheduler = TaskScheduler()
        return scheduler

    def test_every_minute_cron(self):
        scheduler = self._make_scheduler()
        result = scheduler._calculate_next_run("* * * * *", "UTC")
        assert result is not None
        assert result.tzinfo is not None
        # Should be in the near future
        diff = (result - datetime.now(timezone.utc)).total_seconds()
        assert 0 < diff <= 61

    def test_daily_at_9am(self):
        scheduler = self._make_scheduler()
        result = scheduler._calculate_next_run("0 9 * * *", "America/New_York")
        assert result is not None
        assert result.minute == 0

    def test_weekly_cron(self):
        scheduler = self._make_scheduler()
        result = scheduler._calculate_next_run("0 10 * * 1", "UTC")  # Monday 10am
        assert result is not None

    def test_invalid_cron_returns_none(self):
        scheduler = self._make_scheduler()
        result = scheduler._calculate_next_run("invalid cron", "UTC")
        assert result is None

    def test_invalid_timezone_returns_none(self):
        scheduler = self._make_scheduler()
        result = scheduler._calculate_next_run("* * * * *", "Not/A/Timezone")
        assert result is None


# ═══════════════════════════════════════════════════════════════════════════
# Section 8: Concurrent Cancellation Scenarios
# ═══════════════════════════════════════════════════════════════════════════


class TestConcurrentScenarios:
    """Stress tests and race condition scenarios."""

    def setup_method(self):
        self.svc = VMControlService()

    @pytest.mark.asyncio
    async def test_multiple_machines_independent_locks(self):
        """Locking machine-1 should not affect machine-2."""
        lock1 = self.svc.get_execution_lock("m1")
        lock2 = self.svc.get_execution_lock("m2")

        await lock1.acquire()
        self.svc.execution_owners["m1"] = "chat-a"

        # m2 should be free
        busy2, _ = self.svc.is_machine_busy("m2")
        assert busy2 is False

        # m2 lock should be acquirable
        acquired = lock2.locked()
        assert acquired is False
        await lock2.acquire()
        lock2.release()

        lock1.release()

    @pytest.mark.asyncio
    async def test_cancellation_on_one_machine_doesnt_affect_another(self):
        """Cancelling m1 should not cancel m2."""
        lock1 = self.svc.get_execution_lock("m1")
        lock2 = self.svc.get_execution_lock("m2")
        await lock1.acquire()
        self.svc.execution_owners["m1"] = "chat-a"
        await lock2.acquire()
        self.svc.execution_owners["m2"] = "chat-b"

        self.svc.request_cancellation("m1")

        assert self.svc.get_cancellation_event("m1").is_set()
        assert not self.svc.get_cancellation_event("m2").is_set()

        lock1.release()
        lock2.release()

    @pytest.mark.asyncio
    async def test_rapid_acquire_release_cycle(self):
        """Simulate rapid task turnaround on the same machine."""
        machine = "m1"

        for i in range(10):
            lock = self.svc.get_execution_lock(machine)
            await lock.acquire()
            self.svc.execution_owners[machine] = f"chat-{i}"
            self.svc.reset_cancellation(machine)

            # Simulate brief work
            assert not self.svc.get_cancellation_event(machine).is_set()
            await asyncio.sleep(0.005)

            self.svc.execution_owners.pop(machine, None)
            lock.release()

        busy, _ = self.svc.is_machine_busy(machine)
        assert busy is False

    @pytest.mark.asyncio
    async def test_cancel_and_reacquire_race(self):
        """
        Simulate a race:
        - Task A is running
        - User B cancels and immediately tries to acquire
        - Task A receives cancellation and releases
        - User B should get the lock
        """
        machine = "m1"
        lock = self.svc.get_execution_lock(machine)
        events = []

        async def task_a():
            await lock.acquire()
            self.svc.execution_owners[machine] = "chat-a"
            self.svc.reset_cancellation(machine)
            events.append("a-started")

            # Poll for cancellation
            while not self.svc.get_cancellation_event(machine).is_set():
                await asyncio.sleep(0.01)

            events.append("a-cancelled")
            self.svc.execution_owners.pop(machine, None)
            lock.release()

        async def user_b():
            await asyncio.sleep(0.03)
            events.append("b-requesting-cancel")
            self.svc.request_cancellation(machine)

            # Try to acquire with timeout
            acquired = False
            try:
                await asyncio.wait_for(lock.acquire(), timeout=2.0)
                acquired = True
                self.svc.execution_owners[machine] = "chat-b"
                self.svc.reset_cancellation(machine)
                events.append("b-acquired")
                self.svc.execution_owners.pop(machine, None)
                lock.release()
            except asyncio.TimeoutError:
                events.append("b-timeout")

            assert acquired, "User B should have acquired the lock after cancellation"

        await asyncio.gather(task_a(), user_b())

        assert "a-started" in events
        assert "a-cancelled" in events
        assert "b-acquired" in events
        # Verify ordering
        assert events.index("a-started") < events.index("b-requesting-cancel")
        assert events.index("a-cancelled") < events.index("b-acquired")

    @pytest.mark.asyncio
    async def test_scheduled_executor_cancellation_simulation(self):
        """
        Simulate what happens in scheduled_executor.py when a cancellation
        event is set during stream consumption.
        """
        machine = "m1"
        lock = self.svc.get_execution_lock(machine)
        await lock.acquire()
        self.svc.execution_owners[machine] = "scheduled-chat-1"
        self.svc.reset_cancellation(machine)

        # Simulate streaming chunks
        chunks_processed = 0
        completion_status = "completed"

        async def fake_stream():
            for i in range(50):
                yield {"type": "text", "content": f"chunk-{i}"}
                await asyncio.sleep(0.01)

        async for chunk in fake_stream():
            if self.svc.get_cancellation_event(machine).is_set():
                completion_status = "cancelled"
                break
            chunks_processed += 1

            # Simulate cancellation arriving mid-stream
            if chunks_processed == 5:
                self.svc.request_cancellation(machine)

        assert completion_status == "cancelled"
        assert chunks_processed == 5  # Stopped after 5 chunks

        self.svc.execution_owners.pop(machine, None)
        lock.release()


# ═══════════════════════════════════════════════════════════════════════════
# Section 9: Trigger Immediate (Manual Run)
# ═══════════════════════════════════════════════════════════════════════════


class TestTriggerImmediate:
    """Test manual trigger behavior."""

    def _make_scheduler(self):
        with patch("app.services.task_scheduler.DatabaseService") as MockDB:
            with patch("app.services.task_scheduler.settings") as mock_settings:
                mock_settings.SCHEDULE_LIMITS = "free:3,basic:3,pro:10,enterprise:50"
                mock_settings.SCHEDULER_ENABLED = True
                mock_settings.SCHEDULER_POLL_INTERVAL = 60
                from app.services.task_scheduler import TaskScheduler
                scheduler = TaskScheduler()
                scheduler.db_service = MockDB()
        return scheduler

    @pytest.mark.asyncio
    async def test_trigger_blocked_by_running_task(self):
        scheduler = self._make_scheduler()

        running = asyncio.Future()  # not done
        scheduler.running_tasks["chat-1"] = running

        result = await scheduler.trigger_immediate("chat-1", "user-1")
        assert result is False

    @pytest.mark.asyncio
    async def test_trigger_clears_missed_runs(self):
        scheduler = self._make_scheduler()

        q = deque(maxlen=2)
        q.append({"user_id": "u", "room_settings": {}, "schedule": {}})
        scheduler.missed_runs["chat-1"] = q

        # Mock the DB call
        scheduler.db_service.get_chat = AsyncMock(return_value=None)

        await scheduler.trigger_immediate("chat-1", "user-1")
        # missed_runs should be cleared even if chat not found
        assert "chat-1" not in scheduler.missed_runs

    @pytest.mark.asyncio
    async def test_trigger_returns_false_when_chat_not_found(self):
        scheduler = self._make_scheduler()
        scheduler.db_service.get_chat = AsyncMock(return_value=None)

        result = await scheduler.trigger_immediate("chat-nonexistent", "user-1")
        assert result is False


# ═══════════════════════════════════════════════════════════════════════════
# Section 10: Integration — Lock + Cancellation + Queue Together
# ═══════════════════════════════════════════════════════════════════════════


class TestIntegration:
    """End-to-end scenarios combining locks, cancellation, and queue."""

    def setup_method(self):
        self.svc = VMControlService()

    @pytest.mark.asyncio
    async def test_chat_overrides_scheduled_task(self):
        """
        Scenario: Scheduled task running on machine → user sends chat →
        chat force-stops scheduled task → chat runs.
        """
        machine = "m1"
        results = {"scheduled_status": None, "chat_status": None}

        async def scheduled_task():
            lock = self.svc.get_execution_lock(machine)
            await lock.acquire()
            self.svc.execution_owners[machine] = "scheduled-chat"
            self.svc.reset_cancellation(machine)

            status = "completed"
            for i in range(100):
                if self.svc.get_cancellation_event(machine).is_set():
                    status = "cancelled"
                    break
                await asyncio.sleep(0.01)

            results["scheduled_status"] = status
            self.svc.execution_owners.pop(machine, None)
            lock.release()

        async def user_chat():
            await asyncio.sleep(0.05)

            # Step 1: Check busy
            busy, owner = self.svc.is_machine_busy(machine)
            assert busy is True
            assert owner == "scheduled-chat"

            # Step 2: Request cancellation
            was_busy, _ = self.svc.request_cancellation(machine)
            assert was_busy is True

            # Step 3: Wait for release
            lock = self.svc.get_execution_lock(machine)
            released = False
            for _ in range(50):
                if not lock.locked():
                    released = True
                    break
                await asyncio.sleep(0.05)
            assert released

            # Step 4: Acquire and run
            await lock.acquire()
            self.svc.execution_owners[machine] = "user-chat"
            self.svc.reset_cancellation(machine)

            results["chat_status"] = "completed"
            self.svc.execution_owners.pop(machine, None)
            lock.release()

        await asyncio.gather(scheduled_task(), user_chat())

        assert results["scheduled_status"] == "cancelled"
        assert results["chat_status"] == "completed"

    @pytest.mark.asyncio
    async def test_three_way_contention(self):
        """
        Three tasks competing for the same machine:
        - Scheduled task A starts
        - User chat B tries → triggers override
        - While B runs, scheduled task C fires → gets queued (would be skipped in real scheduler)
        """
        machine = "m1"
        order = []

        async def task_a():
            lock = self.svc.get_execution_lock(machine)
            await lock.acquire()
            self.svc.execution_owners[machine] = "a"
            self.svc.reset_cancellation(machine)
            order.append("a-start")

            while not self.svc.get_cancellation_event(machine).is_set():
                await asyncio.sleep(0.01)

            order.append("a-cancelled")
            self.svc.execution_owners.pop(machine, None)
            lock.release()

        async def task_b():
            await asyncio.sleep(0.03)
            self.svc.request_cancellation(machine)

            lock = self.svc.get_execution_lock(machine)
            for _ in range(100):
                if not lock.locked():
                    break
                await asyncio.sleep(0.02)

            await lock.acquire()
            self.svc.execution_owners[machine] = "b"
            self.svc.reset_cancellation(machine)
            order.append("b-start")

            await asyncio.sleep(0.1)
            order.append("b-done")
            self.svc.execution_owners.pop(machine, None)
            lock.release()

        async def task_c():
            await asyncio.sleep(0.08)
            # C arrives while B is running
            busy, owner = self.svc.is_machine_busy(machine)
            if busy:
                order.append(f"c-sees-busy-by-{owner}")
            else:
                order.append("c-machine-free")

        await asyncio.gather(task_a(), task_b(), task_c())

        assert "a-start" in order
        assert "a-cancelled" in order
        assert "b-start" in order
        assert "b-done" in order
        assert "c-sees-busy-by-b" in order

        # Verify final state is clean
        busy, _ = self.svc.is_machine_busy(machine)
        assert busy is False


# ═══════════════════════════════════════════════════════════════════════════
# Section 11: _iter_with_idle_timeout Helper
# ═══════════════════════════════════════════════════════════════════════════


class TestIterWithIdleTimeout:
    """Test the idle-timeout async iterator wrapper from scheduled_executor."""

    @pytest.mark.asyncio
    async def test_fast_generator_all_items_received(self):
        """When chunks arrive quickly, all items pass through."""
        from app.services.scheduled_executor import _iter_with_idle_timeout

        async def fast_gen():
            for i in range(10):
                yield {"type": "text", "content": f"chunk-{i}"}

        items = []
        async for chunk in _iter_with_idle_timeout(fast_gen(), idle_timeout_sec=5):
            items.append(chunk)

        assert len(items) == 10
        assert items[0]["content"] == "chunk-0"
        assert items[9]["content"] == "chunk-9"

    @pytest.mark.asyncio
    async def test_slow_generator_triggers_timeout(self):
        """When a chunk takes longer than idle_timeout, TimeoutError is raised."""
        from app.services.scheduled_executor import _iter_with_idle_timeout

        async def slow_gen():
            yield {"type": "text", "content": "first"}
            await asyncio.sleep(10)  # way longer than timeout
            yield {"type": "text", "content": "second"}

        items = []
        with pytest.raises(asyncio.TimeoutError):
            async for chunk in _iter_with_idle_timeout(slow_gen(), idle_timeout_sec=0.1):
                items.append(chunk)

        # First item was received before the stall
        assert len(items) == 1
        assert items[0]["content"] == "first"

    @pytest.mark.asyncio
    async def test_generator_with_moderate_delays_no_timeout(self):
        """Chunks arriving within the idle window should not trigger timeout."""
        from app.services.scheduled_executor import _iter_with_idle_timeout

        async def moderate_gen():
            for i in range(5):
                await asyncio.sleep(0.05)  # 50ms per chunk
                yield {"type": "text", "content": f"chunk-{i}"}

        items = []
        async for chunk in _iter_with_idle_timeout(moderate_gen(), idle_timeout_sec=1):
            items.append(chunk)

        assert len(items) == 5

    @pytest.mark.asyncio
    async def test_empty_generator(self):
        """An empty generator should produce no items and not raise."""
        from app.services.scheduled_executor import _iter_with_idle_timeout

        async def empty_gen():
            return
            yield  # noqa: unreachable — makes it an async generator

        items = []
        async for chunk in _iter_with_idle_timeout(empty_gen(), idle_timeout_sec=1):
            items.append(chunk)

        assert len(items) == 0

    @pytest.mark.asyncio
    async def test_timeout_on_first_chunk(self):
        """If the very first chunk never arrives, timeout fires."""
        from app.services.scheduled_executor import _iter_with_idle_timeout

        async def never_yields():
            await asyncio.sleep(10)
            yield {"type": "text", "content": "never"}

        with pytest.raises(asyncio.TimeoutError):
            async for _ in _iter_with_idle_timeout(never_yields(), idle_timeout_sec=0.1):
                pass

    @pytest.mark.asyncio
    async def test_idle_timeout_resets_per_chunk(self):
        """Each chunk resets the idle clock — total time can exceed idle_timeout."""
        from app.services.scheduled_executor import _iter_with_idle_timeout
        import time

        async def steady_gen():
            for i in range(10):
                await asyncio.sleep(0.05)  # 50ms each = 500ms total
                yield {"type": "text", "content": f"chunk-{i}"}

        start = time.monotonic()
        items = []
        # idle_timeout=0.2s per chunk, but total run is ~0.5s
        async for chunk in _iter_with_idle_timeout(steady_gen(), idle_timeout_sec=0.2):
            items.append(chunk)

        elapsed = time.monotonic() - start
        assert len(items) == 10
        # Total time exceeded idle_timeout — proves it resets per chunk
        assert elapsed > 0.2


# ═══════════════════════════════════════════════════════════════════════════
# Section 12: Configurable Timeout Values
# ═══════════════════════════════════════════════════════════════════════════


class TestConfigurableTimeouts:
    """Verify config values are used instead of hardcoded 1800."""

    def test_config_has_idle_timeout(self):
        from app.core.config import Settings
        s = Settings()
        assert s.SCHEDULED_TASK_IDLE_TIMEOUT == 300  # 5 minutes default

    def test_config_has_max_timeout(self):
        from app.core.config import Settings
        s = Settings()
        assert s.SCHEDULED_TASK_MAX_TIMEOUT == 5400  # 90 minutes default

    def test_config_idle_timeout_overridable(self):
        """Env var override should work."""
        import os
        os.environ["SCHEDULED_TASK_IDLE_TIMEOUT"] = "600"
        try:
            from app.core.config import Settings
            s = Settings()
            assert s.SCHEDULED_TASK_IDLE_TIMEOUT == 600
        finally:
            del os.environ["SCHEDULED_TASK_IDLE_TIMEOUT"]

    def test_config_max_timeout_overridable(self):
        """Env var override should work."""
        import os
        os.environ["SCHEDULED_TASK_MAX_TIMEOUT"] = "7200"
        try:
            from app.core.config import Settings
            s = Settings()
            assert s.SCHEDULED_TASK_MAX_TIMEOUT == 7200
        finally:
            del os.environ["SCHEDULED_TASK_MAX_TIMEOUT"]

    def test_scheduler_uses_config_for_stuck_detection(self):
        """Verify the scheduler references settings, not hardcoded 1800."""
        import inspect
        from app.services.task_scheduler import TaskScheduler
        source = inspect.getsource(TaskScheduler._check_and_fire_due_tasks)
        # Should reference settings, not literal 1800
        assert "settings.SCHEDULED_TASK_MAX_TIMEOUT" in source
        assert "1800" not in source

    def test_scheduler_uses_config_for_execution_timeout(self):
        """Verify _execute_with_error_handling uses settings for timeout."""
        import inspect
        from app.services.task_scheduler import TaskScheduler
        source = inspect.getsource(TaskScheduler._execute_with_error_handling)
        assert "settings.SCHEDULED_TASK_MAX_TIMEOUT" in source
        assert "timeout=1800" not in source


# ═══════════════════════════════════════════════════════════════════════════
# Section 13: Full Executor Simulation (Lock + Idle Timeout + Cancellation)
# ═══════════════════════════════════════════════════════════════════════════


class TestExecutorSimulation:
    """
    Simulate the real scheduled_executor.py flow end-to-end:
    lock acquisition → reset cancellation → stream with idle timeout →
    chunk processing → lock release.
    """

    def setup_method(self):
        self.svc = VMControlService()

    async def _run_simulated_execution(
        self,
        machine: str,
        chat_id: str,
        stream,
        idle_timeout: float,
        cancel_after_chunks: int | None = None,
    ) -> dict:
        """
        Mirrors the actual scheduled_executor.py flow:
        1. Acquire lock
        2. Reset cancellation
        3. Consume stream with idle timeout wrapper
        4. Check cancellation each chunk
        5. Release lock in finally
        """
        from app.services.scheduled_executor import _iter_with_idle_timeout

        lock = self.svc.get_execution_lock(machine)
        completion_status = "failed"
        chunks_processed = 0
        all_content = ""
        error_message = None

        try:
            await asyncio.wait_for(lock.acquire(), timeout=5.0)
        except asyncio.TimeoutError:
            return {"status": "skipped", "chunks": 0, "content": "", "error": "busy"}

        self.svc.execution_owners[machine] = chat_id
        self.svc.reset_cancellation(machine)

        try:
            try:
                async for chunk in _iter_with_idle_timeout(stream, idle_timeout):
                    # Check cancellation (same as real code)
                    if self.svc.get_cancellation_event(machine).is_set():
                        all_content += "\n[Execution stopped: machine taken over]\n"
                        completion_status = "cancelled"
                        break

                    chunk_type = chunk.get("type")
                    if chunk_type == "text":
                        all_content += chunk.get("content", "")
                    elif chunk_type == "finish":
                        completion_status = "completed"

                    chunks_processed += 1

                    # Optional: trigger cancellation after N chunks
                    if cancel_after_chunks and chunks_processed >= cancel_after_chunks:
                        self.svc.request_cancellation(machine)

            except asyncio.TimeoutError:
                idle_sec = idle_timeout
                all_content += f"\n[Timed out: no activity for {idle_sec}s]\n"
                completion_status = "failed"
                error_message = f"No activity for {idle_sec}s"

            # If stream ended without finish event
            if completion_status == "failed" and not error_message:
                error_message = "Stream ended without finish event"

        finally:
            if lock.locked():
                self.svc.execution_owners.pop(machine, None)
                lock.release()

        return {
            "status": completion_status,
            "chunks": chunks_processed,
            "content": all_content,
            "error": error_message,
        }

    @pytest.mark.asyncio
    async def test_normal_execution_completes(self):
        """Task streams chunks and finishes normally."""
        async def normal_stream():
            for i in range(5):
                yield {"type": "text", "content": f"Step {i}. "}
                await asyncio.sleep(0.01)
            yield {"type": "finish"}

        result = await self._run_simulated_execution(
            "m1", "chat-1", normal_stream(), idle_timeout=2.0
        )

        assert result["status"] == "completed"
        assert result["chunks"] == 6  # 5 text + 1 finish
        assert "Step 0" in result["content"]
        assert result["error"] is None

        # Lock should be released
        busy, _ = self.svc.is_machine_busy("m1")
        assert busy is False

    @pytest.mark.asyncio
    async def test_idle_timeout_kills_stuck_execution(self):
        """Stream stalls mid-execution → idle timeout fires → task fails."""
        async def stalling_stream():
            yield {"type": "text", "content": "Starting..."}
            yield {"type": "text", "content": "Working..."}
            await asyncio.sleep(10)  # Stall — simulates hung WebSocket
            yield {"type": "text", "content": "Never reached"}
            yield {"type": "finish"}

        result = await self._run_simulated_execution(
            "m1", "chat-1", stalling_stream(), idle_timeout=0.15
        )

        assert result["status"] == "failed"
        assert result["chunks"] == 2  # Only got 2 chunks before stall
        assert "activity" in result["error"].lower()
        assert "Timed out" in result["content"]

        # Lock must be released even after timeout
        busy, _ = self.svc.is_machine_busy("m1")
        assert busy is False

    @pytest.mark.asyncio
    async def test_cancellation_beats_idle_timeout(self):
        """Cancellation fires before idle timeout — should show cancelled, not timed out."""
        async def slow_but_alive_stream():
            for i in range(50):
                yield {"type": "text", "content": f"chunk-{i} "}
                await asyncio.sleep(0.02)

        result = await self._run_simulated_execution(
            "m1", "chat-1", slow_but_alive_stream(),
            idle_timeout=2.0,
            cancel_after_chunks=3,
        )

        assert result["status"] == "cancelled"
        assert result["chunks"] == 3
        assert "machine taken over" in result["content"]
        assert result["error"] is None  # Not a timeout error

        busy, _ = self.svc.is_machine_busy("m1")
        assert busy is False

    @pytest.mark.asyncio
    async def test_external_cancellation_during_execution(self):
        """Another user requests cancellation while execution streams."""
        machine = "m1"

        async def long_stream():
            for i in range(100):
                yield {"type": "text", "content": f"chunk-{i} "}
                await asyncio.sleep(0.01)
            yield {"type": "finish"}

        async def external_canceller():
            await asyncio.sleep(0.05)  # Let a few chunks through
            self.svc.request_cancellation(machine)

        result_holder = {}

        async def run_execution():
            result_holder["result"] = await self._run_simulated_execution(
                machine, "scheduled-chat", long_stream(), idle_timeout=2.0
            )

        await asyncio.gather(run_execution(), external_canceller())

        result = result_holder["result"]
        assert result["status"] == "cancelled"
        assert result["chunks"] > 0  # Got some chunks before cancel
        assert result["chunks"] < 100  # Didn't process all

        busy, _ = self.svc.is_machine_busy(machine)
        assert busy is False

    @pytest.mark.asyncio
    async def test_idle_timeout_on_first_chunk_never_arriving(self):
        """Stream never produces a chunk — idle timeout fires immediately."""
        async def never_starts():
            await asyncio.sleep(10)
            yield {"type": "text", "content": "too late"}

        result = await self._run_simulated_execution(
            "m1", "chat-1", never_starts(), idle_timeout=0.1
        )

        assert result["status"] == "failed"
        assert result["chunks"] == 0
        assert "activity" in result["error"].lower()

        busy, _ = self.svc.is_machine_busy("m1")
        assert busy is False

    @pytest.mark.asyncio
    async def test_long_running_task_with_steady_chunks(self):
        """
        Task runs for total time > idle_timeout but keeps producing chunks.
        Should complete successfully — idle timeout resets per chunk.
        """
        import time

        async def steady_long_stream():
            for i in range(20):
                yield {"type": "text", "content": f"step-{i} "}
                await asyncio.sleep(0.03)  # 30ms × 20 = 600ms total
            yield {"type": "finish"}

        start = time.monotonic()
        result = await self._run_simulated_execution(
            "m1", "chat-1", steady_long_stream(), idle_timeout=0.15
        )
        elapsed = time.monotonic() - start

        assert result["status"] == "completed"
        assert result["chunks"] == 21  # 20 text + 1 finish
        # Total time exceeded idle_timeout — proves per-chunk reset works
        assert elapsed > 0.15

    @pytest.mark.asyncio
    async def test_machine_busy_skips_execution(self):
        """If machine is already locked, execution is skipped."""
        machine = "m1"

        # Pre-acquire the lock (simulating another task running)
        lock = self.svc.get_execution_lock(machine)
        await lock.acquire()
        self.svc.execution_owners[machine] = "other-chat"

        async def any_stream():
            yield {"type": "text", "content": "should not run"}
            yield {"type": "finish"}

        result = await self._run_simulated_execution(
            machine, "chat-2", any_stream(), idle_timeout=1.0
        )

        assert result["status"] == "skipped"
        assert result["chunks"] == 0
        assert result["error"] == "busy"

        # Original lock still held
        busy, owner = self.svc.is_machine_busy(machine)
        assert busy is True
        assert owner == "other-chat"

        lock.release()

    @pytest.mark.asyncio
    async def test_override_flow_with_idle_timeout(self):
        """
        Full Override & Run with idle timeout:
        - Task A streams with idle timeout
        - User B force-stops A
        - A gets cancelled (not idle timeout)
        - B runs and completes
        """
        machine = "m1"
        results = {"a": None, "b": None}

        async def stream_a():
            for i in range(200):
                yield {"type": "text", "content": f"a-{i} "}
                await asyncio.sleep(0.01)
            yield {"type": "finish"}

        async def stream_b():
            for i in range(5):
                yield {"type": "text", "content": f"b-{i} "}
                await asyncio.sleep(0.01)
            yield {"type": "finish"}

        async def run_a():
            results["a"] = await self._run_simulated_execution(
                machine, "chat-a", stream_a(), idle_timeout=2.0
            )

        async def run_b():
            # Wait for A to start
            await asyncio.sleep(0.05)

            # Force-stop A
            self.svc.request_cancellation(machine)

            # Wait for lock release
            lock = self.svc.get_execution_lock(machine)
            for _ in range(100):
                if not lock.locked():
                    break
                await asyncio.sleep(0.02)

            # Run B
            results["b"] = await self._run_simulated_execution(
                machine, "chat-b", stream_b(), idle_timeout=2.0
            )

        await asyncio.gather(run_a(), run_b())

        assert results["a"]["status"] == "cancelled"
        assert results["a"]["chunks"] > 0
        assert "machine taken over" in results["a"]["content"]

        assert results["b"]["status"] == "completed"
        assert results["b"]["chunks"] == 6

        busy, _ = self.svc.is_machine_busy(machine)
        assert busy is False

    @pytest.mark.asyncio
    async def test_error_chunk_then_idle_timeout(self):
        """Stream sends an error chunk then stalls — idle timeout fires."""
        async def error_then_stall():
            yield {"type": "text", "content": "Starting..."}
            yield {"type": "error", "content": "Something went wrong"}
            await asyncio.sleep(10)  # Stall after error
            yield {"type": "finish"}

        result = await self._run_simulated_execution(
            "m1", "chat-1", error_then_stall(), idle_timeout=0.15
        )

        assert result["status"] == "failed"
        assert result["chunks"] == 2  # text + error
        assert "activity" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_sequential_executions_on_same_machine(self):
        """
        Two tasks run sequentially on the same machine.
        Verifies lock/cancellation state is clean between runs.
        """
        machine = "m1"

        async def short_stream(label):
            for i in range(3):
                yield {"type": "text", "content": f"{label}-{i} "}
            yield {"type": "finish"}

        # First execution
        r1 = await self._run_simulated_execution(
            machine, "chat-1", short_stream("first"), idle_timeout=1.0
        )
        assert r1["status"] == "completed"

        # Second execution — should work cleanly
        r2 = await self._run_simulated_execution(
            machine, "chat-2", short_stream("second"), idle_timeout=1.0
        )
        assert r2["status"] == "completed"

        # No stale state
        busy, _ = self.svc.is_machine_busy(machine)
        assert busy is False
        assert not self.svc.get_cancellation_event(machine).is_set()
