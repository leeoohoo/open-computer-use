"""
Swarm State Machine — Formal state management for each machine in a swarm.

States:
    PENDING   → Machine allocated, not yet started
    RUNNING   → Actively executing its subtask
    BLOCKED   → Waiting for a dependency (shared memory key)
    HELPING   → Paused own task to help a peer
    COMPLETED → Finished its subtask successfully
    FAILED    → Encountered an unrecoverable error
    CANCELLED → Externally cancelled
    IDLE      → Finished own task, available for work stealing

Transitions are guarded — invalid transitions raise StateTransitionError.
Every transition emits an event to the SwarmEventBus.
"""

import time
from enum import Enum
from typing import Any, Dict, List, Optional

from app.services.swarm_event_bus import (
    EVT_DEPENDENCY_BLOCKED,
    EVT_MACHINE_COMPLETED,
    EVT_MACHINE_STUCK,
    EventPriority,
    SwarmEvent,
    SwarmEventBus,
)


class MachineStatus(str, Enum):
    """Possible states for a swarm machine."""
    PENDING = "pending"
    RUNNING = "running"
    BLOCKED = "blocked"
    HELPING = "helping"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    IDLE = "idle"


class StateTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""
    pass


# Valid transitions: from_state → set of allowed to_states
_VALID_TRANSITIONS: Dict[MachineStatus, set] = {
    MachineStatus.PENDING: {
        MachineStatus.RUNNING,
        MachineStatus.CANCELLED,
        MachineStatus.FAILED,
    },
    MachineStatus.RUNNING: {
        MachineStatus.COMPLETED,
        MachineStatus.FAILED,
        MachineStatus.CANCELLED,
        MachineStatus.BLOCKED,
        MachineStatus.HELPING,
        MachineStatus.IDLE,
    },
    MachineStatus.BLOCKED: {
        MachineStatus.RUNNING,      # Dependency resolved
        MachineStatus.CANCELLED,
        MachineStatus.FAILED,
    },
    MachineStatus.HELPING: {
        MachineStatus.RUNNING,      # Resumed own task
        MachineStatus.CANCELLED,
        MachineStatus.FAILED,
    },
    MachineStatus.COMPLETED: {
        MachineStatus.IDLE,         # Available for work stealing
    },
    MachineStatus.FAILED: set(),    # Terminal state
    MachineStatus.CANCELLED: set(), # Terminal state
    MachineStatus.IDLE: {
        MachineStatus.RUNNING,      # Work stealing assignment
        MachineStatus.CANCELLED,
    },
}


class MachineState:
    """Tracks the full state of a single machine in the swarm."""

    def __init__(self, index: int, machine_id: str, subtask: str):
        self.index = index
        self.machine_id = machine_id
        self.status = MachineStatus.PENDING
        self.subtask = subtask
        self.original_subtask = subtask

        # Execution tracking
        self.step_count = 0
        self.last_activity_time = time.time()
        self.started_at: Optional[float] = None
        self.completed_at: Optional[float] = None

        # Blocking / dependency
        self.blocked_on: Optional[str] = None           # Shared memory key
        self.blocked_since: Optional[float] = None
        self.blocked_description: Optional[str] = None

        # Helping state
        self.helping_machine: Optional[int] = None       # Index of machine being helped
        self.paused_subtask: Optional[str] = None        # Saved subtask while helping
        self.paused_step_count: Optional[int] = None

        # Work stealing
        self.stolen_from: Optional[int] = None           # Index of machine we took work from
        self.work_steal_subtask: Optional[str] = None

        # Expertise claims
        self.expertise_domains: List[str] = []

        # Transition history
        self._history: List[Dict[str, Any]] = []

    @property
    def is_terminal(self) -> bool:
        return self.status in (MachineStatus.FAILED, MachineStatus.CANCELLED)

    @property
    def is_active(self) -> bool:
        return self.status in (
            MachineStatus.RUNNING,
            MachineStatus.BLOCKED,
            MachineStatus.HELPING,
        )

    @property
    def is_available(self) -> bool:
        """Can this machine accept new work (idle or completed)?"""
        return self.status in (MachineStatus.COMPLETED, MachineStatus.IDLE)

    @property
    def seconds_since_activity(self) -> float:
        return time.time() - self.last_activity_time

    @property
    def blocked_duration(self) -> float:
        if self.blocked_since is None:
            return 0.0
        return time.time() - self.blocked_since

    def record_activity(self, step: int = 0) -> None:
        """Record that this machine just did something."""
        self.last_activity_time = time.time()
        if step > 0:
            self.step_count = step

    def to_dict(self) -> Dict[str, Any]:
        """Serialize for coordinator context."""
        d: Dict[str, Any] = {
            "index": self.index,
            "machine_id": self.machine_id,
            "status": self.status.value,
            "subtask": self.subtask,
            "step_count": self.step_count,
            "seconds_since_activity": round(self.seconds_since_activity, 1),
            "expertise": self.expertise_domains,
        }
        if self.status == MachineStatus.BLOCKED:
            d["blocked_on"] = self.blocked_on
            d["blocked_duration"] = round(self.blocked_duration, 1)
            d["blocked_description"] = self.blocked_description
        if self.status == MachineStatus.HELPING:
            d["helping_machine"] = self.helping_machine
        if self.stolen_from is not None:
            d["stolen_from"] = self.stolen_from
        return d


class SwarmStateMachine:
    """Manages state for all machines in a swarm with validated transitions."""

    def __init__(self, machine_count: int, event_bus: Optional[SwarmEventBus] = None):
        self.machine_count = machine_count
        self.event_bus = event_bus
        self._machines: Dict[int, MachineState] = {}

    def register_machine(self, index: int, machine_id: str, subtask: str) -> MachineState:
        """Register a machine. Must be called before any transitions."""
        state = MachineState(index, machine_id, subtask)
        self._machines[index] = state
        return state

    def get(self, index: int) -> Optional[MachineState]:
        """Get a machine's state by index."""
        return self._machines.get(index)

    def get_all(self) -> Dict[int, MachineState]:
        """Get all machine states."""
        return dict(self._machines)

    def get_by_status(self, status: MachineStatus) -> List[MachineState]:
        """Get all machines in a given status."""
        return [m for m in self._machines.values() if m.status == status]

    # ──────────────────────────────────────────────────────────────────
    # State transitions
    # ──────────────────────────────────────────────────────────────────

    def transition(
        self,
        index: int,
        to_status: MachineStatus,
        reason: str = "",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> MachineState:
        """Transition a machine to a new state.

        Raises StateTransitionError if the transition is invalid.
        Emits an event to the bus if one is configured.
        """
        state = self._machines.get(index)
        if state is None:
            raise StateTransitionError(f"Machine {index} not registered")

        from_status = state.status
        allowed = _VALID_TRANSITIONS.get(from_status, set())

        if to_status not in allowed:
            raise StateTransitionError(
                f"Machine {index}: invalid transition {from_status.value} → {to_status.value}. "
                f"Allowed: {[s.value for s in allowed]}"
            )

        # Record history
        state._history.append({
            "from": from_status.value,
            "to": to_status.value,
            "reason": reason,
            "timestamp": time.time(),
        })

        # Apply transition
        old_status = state.status
        state.status = to_status

        # Side effects based on target state
        if to_status == MachineStatus.RUNNING and old_status == MachineStatus.PENDING:
            state.started_at = time.time()
            state.last_activity_time = time.time()
        elif to_status == MachineStatus.COMPLETED:
            state.completed_at = time.time()
        elif to_status == MachineStatus.IDLE:
            state.completed_at = state.completed_at or time.time()

        # Emit event
        if self.event_bus is not None:
            self._emit_transition_event(state, old_status, to_status, reason, metadata)

        return state

    # ──────────────────────────────────────────────────────────────────
    # High-level transition helpers
    # ──────────────────────────────────────────────────────────────────

    def start(self, index: int) -> MachineState:
        """PENDING → RUNNING"""
        return self.transition(index, MachineStatus.RUNNING, reason="started")

    def complete(self, index: int) -> MachineState:
        """RUNNING → COMPLETED"""
        return self.transition(index, MachineStatus.COMPLETED, reason="task completed")

    def fail(self, index: int, error: str = "") -> MachineState:
        """Any active state → FAILED"""
        return self.transition(index, MachineStatus.FAILED, reason=f"failed: {error}")

    def cancel(self, index: int) -> MachineState:
        """Any non-terminal state → CANCELLED"""
        return self.transition(index, MachineStatus.CANCELLED, reason="cancelled")

    def block(self, index: int, dependency_key: str, description: str = "") -> MachineState:
        """RUNNING → BLOCKED (waiting for a dependency)."""
        state = self.transition(
            index,
            MachineStatus.BLOCKED,
            reason=f"waiting for key '{dependency_key}'",
            metadata={"key": dependency_key, "description": description},
        )
        state.blocked_on = dependency_key
        state.blocked_since = time.time()
        state.blocked_description = description
        return state

    def unblock(self, index: int) -> MachineState:
        """BLOCKED → RUNNING (dependency resolved)."""
        state = self.transition(index, MachineStatus.RUNNING, reason="dependency resolved")
        state.blocked_on = None
        state.blocked_since = None
        state.blocked_description = None
        return state

    def start_helping(self, index: int, target_machine: int, help_subtask: str = "") -> MachineState:
        """RUNNING → HELPING (pause own task to help a peer)."""
        state = self.transition(
            index,
            MachineStatus.HELPING,
            reason=f"helping machine {target_machine}",
            metadata={"target": target_machine},
        )
        state.helping_machine = target_machine
        state.paused_subtask = state.subtask
        state.paused_step_count = state.step_count
        if help_subtask:
            state.subtask = help_subtask
        return state

    def resume_from_helping(self, index: int) -> MachineState:
        """HELPING → RUNNING (done helping, resume own task)."""
        state = self.transition(index, MachineStatus.RUNNING, reason="resumed own task after helping")
        if state.paused_subtask:
            state.subtask = state.paused_subtask
            state.paused_subtask = None
        state.helping_machine = None
        state.paused_step_count = None
        return state

    def go_idle(self, index: int) -> MachineState:
        """COMPLETED → IDLE (available for work stealing)."""
        return self.transition(index, MachineStatus.IDLE, reason="available for work stealing")

    def assign_stolen_work(self, index: int, new_subtask: str, stolen_from: int) -> MachineState:
        """IDLE → RUNNING (work stealing assignment)."""
        state = self.transition(
            index,
            MachineStatus.RUNNING,
            reason=f"work stolen from machine {stolen_from}",
            metadata={"stolen_from": stolen_from, "new_subtask": new_subtask},
        )
        state.subtask = new_subtask
        state.stolen_from = stolen_from
        state.work_steal_subtask = new_subtask
        return state

    def reassign(self, index: int, new_subtask: str, reason: str = "coordinator reassignment") -> None:
        """Update a running machine's subtask without changing state."""
        state = self._machines.get(index)
        if state is None:
            raise StateTransitionError(f"Machine {index} not registered")
        if state.status != MachineStatus.RUNNING:
            raise StateTransitionError(
                f"Machine {index}: can only reassign RUNNING machines, "
                f"currently {state.status.value}"
            )
        state.subtask = new_subtask
        state._history.append({
            "from": "running",
            "to": "running",
            "reason": f"reassigned: {reason}",
            "timestamp": time.time(),
        })

    # ──────────────────────────────────────────────────────────────────
    # Queries
    # ──────────────────────────────────────────────────────────────────

    def all_terminal(self) -> bool:
        """Check if all machines have reached a terminal or completed/idle state."""
        for m in self._machines.values():
            if m.status not in (
                MachineStatus.COMPLETED,
                MachineStatus.FAILED,
                MachineStatus.CANCELLED,
                MachineStatus.IDLE,
            ):
                return False
        return True

    def stuck_machines(self, stale_seconds: float = 90.0) -> List[MachineState]:
        """Find running machines that haven't had activity recently."""
        return [
            m for m in self._machines.values()
            if m.status == MachineStatus.RUNNING
            and m.seconds_since_activity > stale_seconds
        ]

    def blocked_machines(self) -> List[MachineState]:
        """Find all blocked machines."""
        return self.get_by_status(MachineStatus.BLOCKED)

    def available_helpers(self, exclude: Optional[int] = None) -> List[MachineState]:
        """Find machines that could potentially help (running, ahead on their task).

        Returns machines sorted by step_count descending (most advanced first).
        """
        helpers = [
            m for m in self._machines.values()
            if m.status == MachineStatus.RUNNING
            and m.index != exclude
        ]
        helpers.sort(key=lambda m: m.step_count, reverse=True)
        return helpers

    def find_expert(self, domain: str) -> Optional[MachineState]:
        """Find a machine that has claimed expertise in a domain."""
        for m in self._machines.values():
            if domain in m.expertise_domains and m.is_active:
                return m
        return None

    def status_report(self) -> str:
        """Generate a human-readable status report for the coordinator."""
        lines = []
        for idx in sorted(self._machines.keys()):
            m = self._machines[idx]
            status_str = m.status.value.upper()
            line = f"  Machine {idx}: {status_str} (step {m.step_count})"
            line += f" — \"{m.subtask[:80]}\""
            if m.status == MachineStatus.BLOCKED:
                line += f"\n    BLOCKED on key '{m.blocked_on}' for {m.blocked_duration:.0f}s"
                if m.blocked_description:
                    line += f": {m.blocked_description}"
            elif m.status == MachineStatus.HELPING:
                line += f"\n    HELPING machine {m.helping_machine}"
            elif m.status == MachineStatus.RUNNING:
                staleness = m.seconds_since_activity
                if staleness > 30:
                    line += f"\n    WARNING: no activity for {staleness:.0f}s"
            lines.append(line)
        return "\n".join(lines)

    # ──────────────────────────────────────────────────────────────────
    # Event emission
    # ──────────────────────────────────────────────────────────────────

    def _emit_transition_event(
        self,
        state: MachineState,
        from_status: MachineStatus,
        to_status: MachineStatus,
        reason: str,
        metadata: Optional[Dict[str, Any]],
    ) -> None:
        """Emit a state transition event to the bus."""
        data = {
            "machine_index": state.index,
            "machine_id": state.machine_id,
            "from_status": from_status.value,
            "to_status": to_status.value,
            "reason": reason,
            "step_count": state.step_count,
        }
        if metadata:
            data.update(metadata)

        # Select event type based on the transition
        if to_status == MachineStatus.COMPLETED:
            event_type = EVT_MACHINE_COMPLETED
            priority = EventPriority.HIGH
        elif to_status == MachineStatus.BLOCKED:
            event_type = EVT_DEPENDENCY_BLOCKED
            priority = EventPriority.CRITICAL
        elif to_status == MachineStatus.FAILED:
            event_type = EVT_MACHINE_STUCK
            priority = EventPriority.HIGH
        else:
            event_type = "state_transition"
            priority = EventPriority.NORMAL

        event = SwarmEvent(
            event_type=event_type,
            data=data,
            source=state.index,
            target=None,  # Broadcast — coordinator and all peers see it
            priority=priority,
        )
        self.event_bus.publish(event)
