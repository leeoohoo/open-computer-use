"""Tests for SwarmStateMachine — formal state transitions for swarm machines."""

import asyncio
import time
import pytest

from app.services.swarm_event_bus import (
    EVT_DEPENDENCY_BLOCKED,
    EVT_MACHINE_COMPLETED,
    EventPriority,
    SwarmEvent,
    SwarmEventBus,
)
from app.services.swarm_state_machine import (
    MachineState,
    MachineStatus,
    StateTransitionError,
    SwarmStateMachine,
)


class TestMachineState:
    """Test MachineState properties and methods."""

    def test_initial_state_is_pending(self):
        """New machine state should start as PENDING."""
        state = MachineState(0, "m0", "task 0")
        assert state.status == MachineStatus.PENDING
        assert state.index == 0
        assert state.machine_id == "m0"
        assert state.subtask == "task 0"
        assert state.original_subtask == "task 0"

    def test_is_terminal_for_failed(self):
        """FAILED should be terminal."""
        state = MachineState(0, "m0", "task")
        state.status = MachineStatus.FAILED
        assert state.is_terminal is True

    def test_is_terminal_for_cancelled(self):
        """CANCELLED should be terminal."""
        state = MachineState(0, "m0", "task")
        state.status = MachineStatus.CANCELLED
        assert state.is_terminal is True

    def test_is_terminal_for_running(self):
        """RUNNING should NOT be terminal."""
        state = MachineState(0, "m0", "task")
        state.status = MachineStatus.RUNNING
        assert state.is_terminal is False

    def test_is_active(self):
        """RUNNING, BLOCKED, and HELPING are active states."""
        state = MachineState(0, "m0", "task")
        for status in (MachineStatus.RUNNING, MachineStatus.BLOCKED, MachineStatus.HELPING):
            state.status = status
            assert state.is_active is True, f"{status} should be active"

        for status in (MachineStatus.PENDING, MachineStatus.COMPLETED, MachineStatus.IDLE):
            state.status = status
            assert state.is_active is False, f"{status} should not be active"

    def test_is_available(self):
        """COMPLETED and IDLE are available for new work."""
        state = MachineState(0, "m0", "task")
        for status in (MachineStatus.COMPLETED, MachineStatus.IDLE):
            state.status = status
            assert state.is_available is True, f"{status} should be available"

    def test_record_activity_updates_time(self):
        """record_activity should update last_activity_time and step_count."""
        state = MachineState(0, "m0", "task")
        old_time = state.last_activity_time
        time.sleep(0.01)
        state.record_activity(step=5)
        assert state.last_activity_time > old_time
        assert state.step_count == 5

    def test_seconds_since_activity(self):
        """seconds_since_activity should return time since last activity."""
        state = MachineState(0, "m0", "task")
        state.last_activity_time = time.time() - 10.0
        assert state.seconds_since_activity >= 9.9

    def test_blocked_duration(self):
        """blocked_duration should return time since blocked_since."""
        state = MachineState(0, "m0", "task")
        state.blocked_since = time.time() - 5.0
        assert state.blocked_duration >= 4.9

    def test_blocked_duration_when_not_blocked(self):
        """blocked_duration should be 0 when not blocked."""
        state = MachineState(0, "m0", "task")
        assert state.blocked_duration == 0.0

    def test_to_dict_basic(self):
        """to_dict should include key fields."""
        state = MachineState(0, "m0", "task 0")
        state.status = MachineStatus.RUNNING
        state.step_count = 10
        d = state.to_dict()
        assert d["index"] == 0
        assert d["machine_id"] == "m0"
        assert d["status"] == "running"
        assert d["subtask"] == "task 0"
        assert d["step_count"] == 10

    def test_to_dict_blocked_includes_details(self):
        """to_dict for BLOCKED state should include blocking info."""
        state = MachineState(0, "m0", "task")
        state.status = MachineStatus.BLOCKED
        state.blocked_on = "auth_token"
        state.blocked_since = time.time() - 10.0
        state.blocked_description = "Need auth token"
        d = state.to_dict()
        assert d["blocked_on"] == "auth_token"
        assert d["blocked_duration"] >= 9.0
        assert d["blocked_description"] == "Need auth token"

    def test_to_dict_helping_includes_target(self):
        """to_dict for HELPING state should include who we're helping."""
        state = MachineState(0, "m0", "task")
        state.status = MachineStatus.HELPING
        state.helping_machine = 2
        d = state.to_dict()
        assert d["helping_machine"] == 2


class TestSwarmStateMachineTransitions:
    """Test state transitions with validation."""

    def setup_method(self):
        self.sm = SwarmStateMachine(3)
        for i in range(3):
            self.sm.register_machine(i, f"m{i}", f"task {i}")

    def test_register_machine(self):
        """Registering a machine should create a PENDING state."""
        state = self.sm.get(0)
        assert state is not None
        assert state.status == MachineStatus.PENDING

    def test_start_transitions_to_running(self):
        """start() should transition PENDING → RUNNING."""
        state = self.sm.start(0)
        assert state.status == MachineStatus.RUNNING
        assert state.started_at is not None

    def test_complete_transitions_to_completed(self):
        """complete() should transition RUNNING → COMPLETED."""
        self.sm.start(0)
        state = self.sm.complete(0)
        assert state.status == MachineStatus.COMPLETED
        assert state.completed_at is not None

    def test_fail_from_running(self):
        """fail() should transition RUNNING → FAILED."""
        self.sm.start(0)
        state = self.sm.fail(0, "something broke")
        assert state.status == MachineStatus.FAILED
        assert state.is_terminal

    def test_cancel_from_pending(self):
        """cancel() should transition PENDING → CANCELLED."""
        state = self.sm.cancel(0)
        assert state.status == MachineStatus.CANCELLED
        assert state.is_terminal

    def test_cancel_from_running(self):
        """cancel() should transition RUNNING → CANCELLED."""
        self.sm.start(0)
        state = self.sm.cancel(0)
        assert state.status == MachineStatus.CANCELLED

    def test_block_from_running(self):
        """block() should transition RUNNING → BLOCKED."""
        self.sm.start(0)
        state = self.sm.block(0, "auth_token", "Need auth")
        assert state.status == MachineStatus.BLOCKED
        assert state.blocked_on == "auth_token"
        assert state.blocked_since is not None
        assert state.blocked_description == "Need auth"

    def test_unblock_from_blocked(self):
        """unblock() should transition BLOCKED → RUNNING."""
        self.sm.start(0)
        self.sm.block(0, "key")
        state = self.sm.unblock(0)
        assert state.status == MachineStatus.RUNNING
        assert state.blocked_on is None
        assert state.blocked_since is None

    def test_start_helping(self):
        """start_helping() should transition RUNNING → HELPING."""
        self.sm.start(0)
        state = self.sm.start_helping(0, target_machine=1, help_subtask="help with login")
        assert state.status == MachineStatus.HELPING
        assert state.helping_machine == 1
        assert state.paused_subtask == "task 0"
        assert state.subtask == "help with login"

    def test_resume_from_helping(self):
        """resume_from_helping() should restore original subtask."""
        self.sm.start(0)
        self.sm.start_helping(0, target_machine=1, help_subtask="helping")
        state = self.sm.resume_from_helping(0)
        assert state.status == MachineStatus.RUNNING
        assert state.subtask == "task 0"  # Restored
        assert state.helping_machine is None

    def test_go_idle_from_completed(self):
        """go_idle() should transition COMPLETED → IDLE."""
        self.sm.start(0)
        self.sm.complete(0)
        state = self.sm.go_idle(0)
        assert state.status == MachineStatus.IDLE

    def test_assign_stolen_work(self):
        """assign_stolen_work() should transition IDLE → RUNNING with new subtask."""
        self.sm.start(0)
        self.sm.complete(0)
        self.sm.go_idle(0)
        state = self.sm.assign_stolen_work(0, "new task from machine 1", stolen_from=1)
        assert state.status == MachineStatus.RUNNING
        assert state.subtask == "new task from machine 1"
        assert state.stolen_from == 1

    def test_reassign_running_machine(self):
        """reassign() should update subtask for RUNNING machines."""
        self.sm.start(0)
        self.sm.reassign(0, "different task", reason="coordinator decision")
        state = self.sm.get(0)
        assert state.subtask == "different task"
        assert state.original_subtask == "task 0"  # Original unchanged

    def test_reassign_non_running_raises(self):
        """reassign() should raise for non-RUNNING machines."""
        with pytest.raises(StateTransitionError):
            self.sm.reassign(0, "new task")  # Machine is PENDING

    # ── Invalid transitions ──

    def test_invalid_transition_pending_to_completed(self):
        """PENDING → COMPLETED should raise StateTransitionError."""
        with pytest.raises(StateTransitionError):
            self.sm.complete(0)

    def test_invalid_transition_completed_to_running(self):
        """COMPLETED → RUNNING is not allowed (must go through IDLE)."""
        self.sm.start(0)
        self.sm.complete(0)
        with pytest.raises(StateTransitionError):
            self.sm.transition(0, MachineStatus.RUNNING)

    def test_invalid_transition_failed_to_anything(self):
        """FAILED is terminal — no transitions out."""
        self.sm.start(0)
        self.sm.fail(0)
        with pytest.raises(StateTransitionError):
            self.sm.transition(0, MachineStatus.RUNNING)

    def test_unregistered_machine_raises(self):
        """Transitioning an unregistered machine should raise."""
        with pytest.raises(StateTransitionError):
            self.sm.transition(99, MachineStatus.RUNNING)

    def test_transition_history_tracked(self):
        """All transitions should be recorded in _history."""
        self.sm.start(0)
        self.sm.block(0, "key")
        self.sm.unblock(0)
        state = self.sm.get(0)
        assert len(state._history) == 3
        assert state._history[0]["to"] == "running"
        assert state._history[1]["to"] == "blocked"
        assert state._history[2]["to"] == "running"


class TestSwarmStateMachineQueries:
    """Test query methods on the state machine."""

    def setup_method(self):
        self.sm = SwarmStateMachine(4)
        for i in range(4):
            self.sm.register_machine(i, f"m{i}", f"task {i}")

    def test_get_all(self):
        """get_all should return all machine states."""
        all_states = self.sm.get_all()
        assert len(all_states) == 4

    def test_get_by_status(self):
        """get_by_status should filter by status."""
        self.sm.start(0)
        self.sm.start(1)
        running = self.sm.get_by_status(MachineStatus.RUNNING)
        assert len(running) == 2
        pending = self.sm.get_by_status(MachineStatus.PENDING)
        assert len(pending) == 2

    def test_all_terminal_false_when_running(self):
        """all_terminal should be False when machines are still active."""
        self.sm.start(0)
        assert self.sm.all_terminal() is False

    def test_all_terminal_true_when_all_done(self):
        """all_terminal should be True when all machines are done."""
        for i in range(4):
            self.sm.start(i)
            self.sm.complete(i)
        assert self.sm.all_terminal() is True

    def test_all_terminal_true_with_mixed_terminal_states(self):
        """all_terminal should be True even with mixed completed/failed/cancelled."""
        self.sm.start(0)
        self.sm.complete(0)
        self.sm.start(1)
        self.sm.fail(1)
        self.sm.cancel(2)
        self.sm.start(3)
        self.sm.complete(3)
        self.sm.go_idle(3)
        assert self.sm.all_terminal() is True

    def test_stuck_machines(self):
        """stuck_machines should find RUNNING machines with old activity."""
        self.sm.start(0)
        self.sm.start(1)
        # Simulate stale activity on machine 0
        self.sm.get(0).last_activity_time = time.time() - 100.0
        stuck = self.sm.stuck_machines(stale_seconds=90.0)
        assert len(stuck) == 1
        assert stuck[0].index == 0

    def test_blocked_machines(self):
        """blocked_machines should return all BLOCKED machines."""
        self.sm.start(0)
        self.sm.start(1)
        self.sm.block(0, "key1")
        self.sm.block(1, "key2")
        blocked = self.sm.blocked_machines()
        assert len(blocked) == 2

    def test_available_helpers(self):
        """available_helpers should return RUNNING machines sorted by step_count."""
        self.sm.start(0)
        self.sm.start(1)
        self.sm.start(2)
        self.sm.get(0).step_count = 5
        self.sm.get(1).step_count = 15
        self.sm.get(2).step_count = 10

        helpers = self.sm.available_helpers(exclude=0)
        assert len(helpers) == 2
        assert helpers[0].index == 1  # Most advanced
        assert helpers[1].index == 2

    def test_find_expert(self):
        """find_expert should return the machine with claimed expertise."""
        self.sm.start(0)
        self.sm.get(0).expertise_domains.append("spreadsheets")
        result = self.sm.find_expert("spreadsheets")
        assert result is not None
        assert result.index == 0

    def test_find_expert_returns_none_when_no_expert(self):
        """find_expert should return None when no expert exists."""
        assert self.sm.find_expert("unknown_domain") is None

    def test_status_report_generates_readable_text(self):
        """status_report should produce a multi-line human-readable report."""
        self.sm.start(0)
        self.sm.start(1)
        self.sm.block(1, "data_key", "Need data")
        report = self.sm.status_report()
        assert "Machine 0: RUNNING" in report
        assert "Machine 1: BLOCKED" in report
        assert "data_key" in report


class TestSwarmStateMachineWithEventBus:
    """Test that state transitions emit events to the bus."""

    def setup_method(self):
        self.bus = SwarmEventBus(3)
        self.sm = SwarmStateMachine(3, event_bus=self.bus)
        for i in range(3):
            self.sm.register_machine(i, f"m{i}", f"task {i}")

    def test_completion_emits_event(self):
        """RUNNING → COMPLETED should emit machine_completed event."""
        self.sm.start(0)
        self.sm.complete(0)
        # Check coordinator queue
        events = self.bus.coordinator_drain_all()
        # Should have start transition + complete transition
        completed_events = [e for e in events if e.event_type == EVT_MACHINE_COMPLETED]
        assert len(completed_events) == 1
        assert completed_events[0].data["machine_index"] == 0
        assert completed_events[0].data["to_status"] == "completed"

    def test_block_emits_critical_event(self):
        """RUNNING → BLOCKED should emit a CRITICAL dependency event."""
        self.sm.start(0)
        self.sm.block(0, "auth_token")
        events = self.bus.coordinator_drain_all()
        blocked_events = [e for e in events if e.event_type == EVT_DEPENDENCY_BLOCKED]
        assert len(blocked_events) == 1
        assert blocked_events[0].priority == EventPriority.CRITICAL

    def test_events_broadcast_to_peers(self):
        """State transition events should be visible to peer machines."""
        self.sm.start(0)
        self.sm.complete(0)
        # Machine 1 should see the completion event
        events = self.bus.drain_all(1)
        completed_events = [e for e in events if e.event_type == EVT_MACHINE_COMPLETED]
        assert len(completed_events) >= 1
