"""Tests for SwarmExecutor pause/resume functionality."""

import asyncio
import pytest

from unittest.mock import MagicMock, patch

from app.services.swarm_executor import SwarmExecutor


def _make_executor(n=2):
    """Create a minimal SwarmExecutor for testing pause/resume state."""
    machines = [{"machine_id": f"m{i}"} for i in range(n)]
    provider = MagicMock()
    return SwarmExecutor(
        swarm_id="test-swarm",
        machines=machines,
        prompt="test prompt",
        provider=provider,
        model="test-model",
    )


class TestPauseResumeState:
    """Test pause/resume state transitions on SwarmExecutor."""

    def test_initial_state_not_paused(self):
        ex = _make_executor()
        assert ex.is_paused is False
        assert ex._resume_event.is_set()  # not paused = resume is set

    def test_pause_sets_state(self):
        ex = _make_executor()
        result = ex.pause()
        assert result is True
        assert ex.is_paused is True
        assert ex._pause_event.is_set()
        assert not ex._resume_event.is_set()

    def test_pause_idempotent(self):
        ex = _make_executor()
        ex.pause()
        result = ex.pause()  # second call
        assert result is False  # no state change

    def test_resume_clears_pause(self):
        ex = _make_executor()
        ex.pause()
        result = ex.resume()
        assert result is True
        assert ex.is_paused is False
        assert ex._resume_event.is_set()

    def test_resume_when_not_paused(self):
        ex = _make_executor()
        result = ex.resume()
        assert result is False  # was not paused

    def test_pause_resume_cycle(self):
        ex = _make_executor()
        ex.pause()
        assert ex.is_paused
        ex.resume()
        assert not ex.is_paused
        ex.pause()
        assert ex.is_paused

    def test_cancel_while_paused_resumes(self):
        """Cancellation while paused should unblock machines so they can exit."""
        ex = _make_executor()
        ex.pause()
        assert not ex._resume_event.is_set()

        ex.request_cancellation()
        # Resume event should be set so machines can exit
        assert ex._resume_event.is_set()
        assert not ex._pause_event.is_set()

    def test_pause_after_cancel_rejected(self):
        ex = _make_executor()
        ex.request_cancellation()
        result = ex.pause()
        assert result is False  # can't pause a cancelled swarm


class TestPauseResumeAsync:
    """Test async behavior of pause/resume."""

    @pytest.mark.asyncio
    async def test_resume_event_unblocks_waiter(self):
        """_resume_event.wait() should unblock when resume() is called."""
        ex = _make_executor()
        ex.pause()

        unblocked = False

        async def waiter():
            nonlocal unblocked
            await ex._resume_event.wait()
            unblocked = True

        task = asyncio.create_task(waiter())
        await asyncio.sleep(0.05)
        assert not unblocked

        ex.resume()
        await asyncio.wait_for(task, timeout=1.0)
        assert unblocked

    @pytest.mark.asyncio
    async def test_cancel_unblocks_paused_waiter(self):
        """Cancelling while paused should unblock machines waiting on resume."""
        ex = _make_executor()
        ex.pause()

        unblocked = False

        async def waiter():
            nonlocal unblocked
            await ex._resume_event.wait()
            unblocked = True

        task = asyncio.create_task(waiter())
        await asyncio.sleep(0.05)
        assert not unblocked

        ex.request_cancellation()
        await asyncio.wait_for(task, timeout=1.0)
        assert unblocked
