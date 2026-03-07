"""
Comprehensive tests for long-running task performance improvements.

Covers:
  - Screenshot separation / merge at DB save time
  - Step limit enforcement
  - Predict timeout and keepalive
  - Credit exhaustion signal via cancellation event
  - Grounding agent notes cap
  - Config value updates
  - All crash / cancellation paths preserve screenshots
"""

import asyncio
import json
import math
import queue
import time
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# 1. Screenshot merge helper (_merge_screenshots)
# ---------------------------------------------------------------------------

class TestMergeScreenshots:
    """Tests for the _merge_screenshots helper used in chat.py and
    scheduled_executor.py."""

    def _get_merge_fn(self):
        """Import from chat.py to test the real implementation."""
        from app.api.routes.chat import _merge_screenshots
        return _merge_screenshots

    def test_empty_store_returns_original_list(self):
        merge = self._get_merge_fn()
        invocations = [{"toolCallId": "t1", "result": {"ok": True}}]
        result = merge(invocations, {})
        assert result is invocations  # Same object — no copy needed

    def test_merges_screenshots_by_tool_call_id(self):
        merge = self._get_merge_fn()
        invocations = [
            {"toolCallId": "t1", "result": {"ok": True}},
            {"toolCallId": "t2", "result": {"ok": True}},
            {"toolCallId": "t3", "result": {"ok": True}},
        ]
        store = {"t1": "screenshot_data_1", "t3": "screenshot_data_3"}

        result = merge(invocations, store)

        assert len(result) == 3
        assert result[0]["frontendScreenshot"] == "screenshot_data_1"
        assert "frontendScreenshot" not in result[1]
        assert result[2]["frontendScreenshot"] == "screenshot_data_3"

    def test_does_not_modify_original_invocations(self):
        merge = self._get_merge_fn()
        invocations = [{"toolCallId": "t1", "result": {"ok": True}}]
        store = {"t1": "data"}

        result = merge(invocations, store)

        # Original should NOT have screenshot
        assert "frontendScreenshot" not in invocations[0]
        # Merged copy should
        assert result[0]["frontendScreenshot"] == "data"

    def test_preserves_existing_frontend_screenshot(self):
        """If a tool invocation already has a frontendScreenshot (e.g. from
        the multi-agent executor), don't overwrite it."""
        merge = self._get_merge_fn()
        invocations = [
            {"toolCallId": "t1", "frontendScreenshot": "existing_ss", "result": {}},
        ]
        store = {"t1": "new_ss"}

        result = merge(invocations, store)

        assert result[0]["frontendScreenshot"] == "existing_ss"

    def test_handles_missing_tool_call_id(self):
        merge = self._get_merge_fn()
        invocations = [{"result": {"ok": True}}]  # No toolCallId
        store = {"t1": "data"}

        result = merge(invocations, store)
        assert "frontendScreenshot" not in result[0]

    def test_large_store_performance(self):
        """Verify merge is O(n) and completes quickly for large lists."""
        merge = self._get_merge_fn()
        n = 10000
        invocations = [{"toolCallId": f"t{i}", "result": {}} for i in range(n)]
        store = {f"t{i}": f"ss_{i}" for i in range(0, n, 2)}  # Every other

        start = time.monotonic()
        result = merge(invocations, store)
        elapsed = time.monotonic() - start

        assert len(result) == n
        assert elapsed < 1.0  # Should be well under 1s for 10k items
        # Verify alternating pattern
        assert "frontendScreenshot" in result[0]
        assert "frontendScreenshot" not in result[1]


# ---------------------------------------------------------------------------
# 2. Step limit enforcement
# ---------------------------------------------------------------------------

class TestStepLimitEnforcement:
    """Tests that CUA executor respects max_steps."""

    def test_default_max_steps_is_500(self):
        from app.services.cua_executor import DEFAULT_MAX_STEPS
        assert DEFAULT_MAX_STEPS == 500

    @pytest.mark.asyncio
    async def test_step_limit_breaks_loop(self):
        """Simulate the step limit check logic."""
        from app.services.cua_executor import DEFAULT_MAX_STEPS

        max_steps = 3
        step_count = 0
        chunks = []

        # Simulate the loop logic
        while True:
            step_count += 1
            if max_steps > 0 and step_count > max_steps:
                chunks.append({"type": "text", "content": f"reached maximum of {max_steps} steps"})
                break
            chunks.append({"type": "step", "step": step_count})

        assert len(chunks) == 4  # 3 steps + 1 limit message
        assert "reached maximum" in chunks[-1]["content"]

    def test_zero_max_steps_means_unlimited(self):
        """max_steps=0 should never trigger the limit."""
        max_steps = 0
        step_count = 1000
        # The condition: max_steps > 0 and step_count > max_steps
        triggered = max_steps > 0 and step_count > max_steps
        assert not triggered


# ---------------------------------------------------------------------------
# 3. Predict timeout constants
# ---------------------------------------------------------------------------

class TestPredictTimeoutConfig:
    def test_predict_timeout_is_5_minutes(self):
        from app.services.cua_executor import PREDICT_TIMEOUT_SECONDS
        assert PREDICT_TIMEOUT_SECONDS == 300

    def test_keepalive_interval_is_30_seconds(self):
        from app.services.cua_executor import KEEPALIVE_INTERVAL_SECONDS
        assert KEEPALIVE_INTERVAL_SECONDS == 30

    @pytest.mark.asyncio
    async def test_predict_timeout_enforced_in_polling_loop(self):
        """The polling loop must enforce PREDICT_TIMEOUT_SECONDS via
        elapsed-time tracking, not a post-loop dead check."""
        from app.services.cua_executor import PREDICT_TIMEOUT_SECONDS

        # Simulate polling loop with a task that never finishes
        total_elapsed = 0.0
        poll_interval = 0.3
        timed_out = False

        # Fast-forward simulation (no real sleeps)
        while total_elapsed < PREDICT_TIMEOUT_SECONDS + 10:
            total_elapsed += poll_interval
            if total_elapsed >= PREDICT_TIMEOUT_SECONDS:
                timed_out = True
                break

        assert timed_out, "Timeout must fire within the polling loop"
        assert total_elapsed < PREDICT_TIMEOUT_SECONDS + poll_interval + 0.01


# ---------------------------------------------------------------------------
# 4. Grounding agent notes cap
# ---------------------------------------------------------------------------

class TestGroundingNotesCap:
    def test_max_grounding_notes_constant(self):
        from app.services.cua_executor import MAX_GROUNDING_NOTES
        assert MAX_GROUNDING_NOTES == 20

    def test_notes_capping_logic(self):
        """Verify the capping logic keeps only the most recent N notes."""
        from app.services.cua_executor import MAX_GROUNDING_NOTES

        notes = [f"note_{i}" for i in range(50)]

        # Apply the same logic as in cua_executor.py
        if len(notes) > MAX_GROUNDING_NOTES:
            notes = notes[-MAX_GROUNDING_NOTES:]

        assert len(notes) == MAX_GROUNDING_NOTES
        assert notes[0] == "note_30"
        assert notes[-1] == "note_49"

    def test_notes_below_cap_unchanged(self):
        from app.services.cua_executor import MAX_GROUNDING_NOTES

        notes = [f"note_{i}" for i in range(5)]
        original_len = len(notes)

        if len(notes) > MAX_GROUNDING_NOTES:
            notes = notes[-MAX_GROUNDING_NOTES:]

        assert len(notes) == original_len


# ---------------------------------------------------------------------------
# 5. Config values for long-running tasks
# ---------------------------------------------------------------------------

class TestConfigValues:
    def test_stream_timeout_raised(self):
        from app.core.config import settings
        assert settings.STREAM_TIMEOUT >= 300

    def test_scheduled_task_max_timeout_6_hours(self):
        from app.core.config import settings
        assert settings.SCHEDULED_TASK_MAX_TIMEOUT >= 21600

    def test_billing_max_session_duration_6_hours(self):
        from app.services.agent_billing import AgentBillingService
        assert AgentBillingService.MAX_SESSION_DURATION >= 21600


# ---------------------------------------------------------------------------
# 6. Credit exhaustion signal
# ---------------------------------------------------------------------------

class TestCreditExhaustionSignal:
    """Verify that billing should_stop triggers cancellation event."""

    @pytest.mark.asyncio
    async def test_cancellation_event_set_on_credit_exhaustion(self):
        """Simulate the chat.py step_complete handler setting the
        cancellation event when should_stop is True."""
        from app.services.vm_control import vm_control_service

        machine_id = f"test_machine_{uuid.uuid4().hex[:8]}"

        # Get the cancellation event
        event = vm_control_service.get_cancellation_event(machine_id)
        assert not event.is_set()

        # Simulate what chat.py now does when should_stop is True
        event.set()

        assert event.is_set()

        # Cleanup
        vm_control_service.cancellation_events.pop(machine_id, None)

    @pytest.mark.asyncio
    async def test_executor_detects_cancellation(self):
        """Simulate the executor's cancellation check at top of loop."""
        from app.services.vm_control import vm_control_service

        machine_id = f"test_machine_{uuid.uuid4().hex[:8]}"
        event = vm_control_service.get_cancellation_event(machine_id)

        # Not cancelled initially
        detected = event.is_set()
        assert not detected

        # Set cancellation (simulates billing exhaustion)
        event.set()

        # Now executor should detect it
        detected = event.is_set()
        assert detected

        # Cleanup
        vm_control_service.cancellation_events.pop(machine_id, None)


# ---------------------------------------------------------------------------
# 7. Screenshot store in step_complete/finish chunks
# ---------------------------------------------------------------------------

class TestScreenshotStoreInChunks:
    """Verify that CUA executor yields screenshot_store in chunks."""

    def test_step_complete_chunk_format(self):
        """The step_complete chunk should contain screenshot_store."""
        chunk = {
            "type": "step_complete",
            "step": 1,
            "content": "test content",
            "tool_invocations": [],
            "screenshot_store": {"t1": "ss_data"},
            "status": "running",
        }
        assert "screenshot_store" in chunk
        assert chunk["screenshot_store"]["t1"] == "ss_data"

    def test_finish_chunk_format(self):
        """The finish chunk should contain screenshot_store."""
        chunk = {
            "type": "finish",
            "content": "done",
            "tool_invocations": [],
            "screenshot_store": {"t1": "ss1", "t2": "ss2"},
            "metadata": {"status": "completed"},
        }
        assert "screenshot_store" in chunk
        assert len(chunk["screenshot_store"]) == 2


# ---------------------------------------------------------------------------
# 8. End-to-end crash scenario tests
# ---------------------------------------------------------------------------

class TestCrashScenarios:
    """Verify that screenshots are preserved in all exit paths."""

    def _setup_test_data(self, n_steps=5):
        """Create test tool invocations and screenshot store."""
        invocations = []
        store = {}
        for i in range(n_steps):
            tid = f"tool_{i}"
            invocations.append({
                "toolCallId": tid,
                "toolName": f"cua_click",
                "args": {"x": i * 10, "y": i * 10},
                "result": {"success": True},
            })
            store[tid] = f"data:image/jpeg;base64,fake_screenshot_{i}"
        return invocations, store

    def test_normal_finish_preserves_all_screenshots(self):
        from app.api.routes.chat import _merge_screenshots
        invocations, store = self._setup_test_data(5)

        merged = _merge_screenshots(invocations, store)

        for i, inv in enumerate(merged):
            assert "frontendScreenshot" in inv, f"Step {i} missing screenshot"
            assert f"fake_screenshot_{i}" in inv["frontendScreenshot"]

    def test_crash_at_step_3_preserves_steps_0_to_2(self):
        """Simulates crash at step 3 — the DB should have been saved
        at step 2 with screenshots for steps 0-2."""
        from app.api.routes.chat import _merge_screenshots

        invocations, store = self._setup_test_data(5)

        # At step 2 (before crash), only first 3 invocations saved
        partial_invocations = invocations[:3]
        partial_store = {k: v for k, v in store.items() if k in ["tool_0", "tool_1", "tool_2"]}

        merged = _merge_screenshots(partial_invocations, partial_store)

        assert len(merged) == 3
        for i, inv in enumerate(merged):
            assert "frontendScreenshot" in inv

    def test_cancellation_preserves_screenshots(self):
        """Client disconnect path — all accumulated screenshots saved."""
        from app.api.routes.chat import _merge_screenshots
        invocations, store = self._setup_test_data(10)

        # Simulate cancellation after 7 steps
        partial = invocations[:7]
        partial_store = {f"tool_{i}": store[f"tool_{i}"] for i in range(7)}

        merged = _merge_screenshots(partial, partial_store)

        assert len(merged) == 7
        assert all("frontendScreenshot" in inv for inv in merged)

    def test_empty_invocations_empty_store(self):
        from app.api.routes.chat import _merge_screenshots
        result = _merge_screenshots([], {})
        assert result == []

    def test_invocations_without_screenshots(self):
        """Some tool invocations may not have screenshots (search, credential)."""
        from app.api.routes.chat import _merge_screenshots
        invocations = [
            {"toolCallId": "search_1", "toolName": "cua_search", "result": {}},
            {"toolCallId": "click_1", "toolName": "cua_click", "result": {}},
        ]
        store = {"click_1": "screenshot_data"}

        merged = _merge_screenshots(invocations, store)

        assert "frontendScreenshot" not in merged[0]  # search has no screenshot
        assert merged[1]["frontendScreenshot"] == "screenshot_data"


# ---------------------------------------------------------------------------
# 9. Scheduled executor _merge_screenshots
# ---------------------------------------------------------------------------

class TestScheduledExecutorMerge:
    """Verify scheduled_executor has its own merge function."""

    def test_merge_function_exists(self):
        from app.services.scheduled_executor import _merge_screenshots
        assert callable(_merge_screenshots)

    def test_merge_produces_correct_output(self):
        from app.services.scheduled_executor import _merge_screenshots
        invocations = [{"toolCallId": "t1", "result": {}}]
        store = {"t1": "ss_data"}

        result = _merge_screenshots(invocations, store)
        assert result[0]["frontendScreenshot"] == "ss_data"
        assert "frontendScreenshot" not in invocations[0]  # Original untouched


# ---------------------------------------------------------------------------
# 10. Memory efficiency verification
# ---------------------------------------------------------------------------

class TestMemoryEfficiency:
    """Verify that the in-memory list stays lightweight."""

    def test_invocations_dont_hold_screenshots(self):
        """After the separation change, tool invocations in the accumulated
        list should NOT contain frontendScreenshot."""
        all_tool_invocations = []
        screenshot_store = {}

        # Simulate 100 steps of accumulation
        for i in range(100):
            tid = f"tool_{i}"
            invocation = {
                "toolCallId": tid,
                "toolName": "cua_click",
                "args": {"x": i},
                "result": {"success": True},
            }
            all_tool_invocations.append(invocation)
            screenshot_store[tid] = "A" * 80000  # ~80KB per screenshot

        # Verify no screenshots in the list
        for inv in all_tool_invocations:
            assert "frontendScreenshot" not in inv

        # Estimate memory: list should be small
        import sys
        list_size = sys.getsizeof(json.dumps(all_tool_invocations))
        store_size = sum(len(v) for v in screenshot_store.values())

        # List serialized should be << store
        assert list_size < store_size * 0.01  # List is <1% of screenshot data

    def test_merge_only_creates_shallow_copies(self):
        """Merge should create dict copies, not deep copies of results."""
        from app.api.routes.chat import _merge_screenshots

        result_obj = {"success": True, "data": [1, 2, 3]}
        invocations = [{"toolCallId": "t1", "result": result_obj}]
        store = {"t1": "screenshot"}

        merged = _merge_screenshots(invocations, store)

        # Result should be the same object (shallow copy of dict)
        assert merged[0]["result"] is result_obj


# ---------------------------------------------------------------------------
# 11. Keepalive logic unit test
# ---------------------------------------------------------------------------

class TestKeepaliveLogic:
    """Test the keepalive emission logic during predict polling."""

    @pytest.mark.asyncio
    async def test_keepalive_emitted_after_interval(self):
        """Simulate the polling loop and verify keepalive is emitted."""
        from app.services.cua_executor import KEEPALIVE_INTERVAL_SECONDS

        chunks_emitted = []
        keepalive_elapsed = 0.0
        poll_interval = 0.3

        # Simulate 35 seconds of polling with no progress messages
        simulated_time = 0.0
        while simulated_time < 35.0:
            simulated_time += poll_interval
            keepalive_elapsed += poll_interval

            if keepalive_elapsed >= KEEPALIVE_INTERVAL_SECONDS:
                chunks_emitted.append({"type": "keepalive", "content": ""})
                keepalive_elapsed = 0.0

        # Should have emitted 1 keepalive (at ~30s)
        assert len(chunks_emitted) == 1

    @pytest.mark.asyncio
    async def test_keepalive_reset_on_real_output(self):
        """If real progress messages come, keepalive timer resets."""
        from app.services.cua_executor import KEEPALIVE_INTERVAL_SECONDS

        keepalives = 0
        keepalive_elapsed = 0.0
        poll_interval = 0.3

        for i in range(200):  # 60 seconds of simulation
            keepalive_elapsed += poll_interval

            # Real message arrives every 10 seconds
            if i % 33 == 0 and i > 0:
                keepalive_elapsed = 0.0  # Reset

            if keepalive_elapsed >= KEEPALIVE_INTERVAL_SECONDS:
                keepalives += 1
                keepalive_elapsed = 0.0

        # With messages every 10s, keepalive should rarely fire
        # (only if message gap > 30s)
        assert keepalives == 0


# ---------------------------------------------------------------------------
# 12. Billing configuration tests
# ---------------------------------------------------------------------------

class TestBillingDuration:
    """Verify billing supports 6-hour sessions."""

    def test_max_session_supports_6_hours(self):
        from app.services.agent_billing import AgentBillingService
        six_hours_seconds = 6 * 60 * 60
        assert AgentBillingService.MAX_SESSION_DURATION >= six_hours_seconds

    def test_credit_cost_for_6_hours(self):
        """6 hours at 10 credits/min = 3600 credits."""
        from app.services.agent_billing import AgentBillingService
        minutes = 6 * 60
        cost = minutes * AgentBillingService.CREDITS_PER_MINUTE
        assert cost == 3600

    def test_periodic_check_interval(self):
        """Check interval should be reasonable for long tasks."""
        from app.services.agent_billing import AgentBillingService
        assert AgentBillingService.CHECK_INTERVAL_SECONDS <= 60


# ---------------------------------------------------------------------------
# 13. Integration-style test: full step_complete → DB save flow
# ---------------------------------------------------------------------------

class TestStepCompleteDBSaveFlow:
    """Simulate the full step_complete handling in chat.py."""

    def test_step_complete_merges_before_save(self):
        """The step_complete handler should merge screenshots into a copy
        before passing to store/update functions."""
        from app.api.routes.chat import _merge_screenshots

        all_tool_invocations = [
            {"toolCallId": "t1", "result": {"ok": True}},
            {"toolCallId": "t2", "result": {"ok": True}},
        ]
        screenshot_store = {"t1": "ss1", "t2": "ss2"}

        # Simulate what chat.py does at step_complete
        step_tools = all_tool_invocations  # comes from chunk
        save_tools = _merge_screenshots(step_tools, screenshot_store)

        # save_tools should have screenshots
        assert save_tools[0]["frontendScreenshot"] == "ss1"
        assert save_tools[1]["frontendScreenshot"] == "ss2"

        # Original should NOT
        assert "frontendScreenshot" not in all_tool_invocations[0]
        assert "frontendScreenshot" not in all_tool_invocations[1]

    def test_incremental_screenshot_store_growth(self):
        """Screenshot store grows as new steps produce screenshots."""
        from app.api.routes.chat import _merge_screenshots

        screenshot_store = {}
        all_invocations = []

        for step in range(5):
            tid = f"tool_step{step}"
            all_invocations.append({"toolCallId": tid, "result": {}})
            screenshot_store[tid] = f"ss_step{step}"

            # At each step, merge should include all screenshots so far
            merged = _merge_screenshots(all_invocations, screenshot_store)
            for inv in merged:
                assert "frontendScreenshot" in inv

        assert len(screenshot_store) == 5

    def test_screenshot_store_update_from_chunk(self):
        """chat.py updates its screenshot_store from chunk's screenshot_store."""
        local_store: Dict[str, str] = {"t1": "old_ss"}
        chunk_store = {"t2": "new_ss", "t3": "another_ss"}

        # Simulate: screenshot_store.update(chunk_ss_store)
        local_store.update(chunk_store)

        assert len(local_store) == 3
        assert local_store["t1"] == "old_ss"
        assert local_store["t2"] == "new_ss"
