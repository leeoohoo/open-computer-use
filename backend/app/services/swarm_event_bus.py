"""
Swarm Event Bus — Priority-based event routing for swarm communication.

Replaces the flat activity-log polling with a reactive, priority-aware system:
- CRITICAL (P0): Coordinator commands, help requests, blockers → checked every step
- HIGH (P1): Direct messages, dependency completions, decisions → checked every step
- NORMAL (P2): Peer activity updates → checked every 2 steps
- LOW (P3): FYI updates, milestones → checked every 5 steps

All access must happen on the asyncio event loop (no threading).
"""

import asyncio
import time
from enum import IntEnum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple


class EventPriority(IntEnum):
    """Priority levels for swarm events. Lower value = higher priority."""
    CRITICAL = 0   # Coordinator commands, help requests, blockers
    HIGH = 1       # Direct messages, dependency completions, decisions
    NORMAL = 2     # Peer activity updates
    LOW = 3        # FYI updates, milestones


# ── Event type constants ──────────────────────────────────────────────

# Coordinator → Machine
EVT_COORDINATOR_COMMAND = "coordinator_command"
EVT_HELP_DISPATCH = "help_dispatch"
EVT_REASSIGN = "reassign"
EVT_NARROW_SCOPE = "narrow_scope"
EVT_WORK_STEAL = "work_steal"
EVT_NUDGE = "nudge"
EVT_DECISION = "decision"
EVT_DIRECTIVE = "directive"

# Machine → Coordinator / All
EVT_HELP_REQUEST = "help_request"
EVT_DEPENDENCY_BLOCKED = "dependency_blocked"
EVT_DEPENDENCY_RESOLVED = "dependency_resolved"
EVT_PROPOSAL = "proposal"
EVT_EXPERTISE_CLAIM = "expertise_claim"
EVT_MACHINE_COMPLETED = "machine_completed"
EVT_MACHINE_STUCK = "machine_stuck"

# Peer awareness (replaces old activity log injection)
EVT_PEER_ACTIVITY = "peer_activity"
EVT_PEER_MESSAGE = "peer_message"
EVT_BROADCAST = "broadcast"

# Map event types to their default priorities
_EVENT_PRIORITY_MAP: Dict[str, EventPriority] = {
    # Critical — must be seen immediately
    EVT_COORDINATOR_COMMAND: EventPriority.CRITICAL,
    EVT_HELP_DISPATCH: EventPriority.CRITICAL,
    EVT_REASSIGN: EventPriority.CRITICAL,
    EVT_WORK_STEAL: EventPriority.CRITICAL,
    EVT_HELP_REQUEST: EventPriority.CRITICAL,
    EVT_DEPENDENCY_BLOCKED: EventPriority.CRITICAL,
    EVT_NUDGE: EventPriority.CRITICAL,

    # High — important but not interrupting
    EVT_PEER_MESSAGE: EventPriority.HIGH,
    EVT_DEPENDENCY_RESOLVED: EventPriority.HIGH,
    EVT_DECISION: EventPriority.HIGH,
    EVT_DIRECTIVE: EventPriority.HIGH,
    EVT_NARROW_SCOPE: EventPriority.HIGH,
    EVT_MACHINE_COMPLETED: EventPriority.HIGH,

    # Normal — periodic awareness
    EVT_PEER_ACTIVITY: EventPriority.NORMAL,
    EVT_BROADCAST: EventPriority.NORMAL,
    EVT_PROPOSAL: EventPriority.NORMAL,

    # Low — informational
    EVT_EXPERTISE_CLAIM: EventPriority.LOW,
    EVT_MACHINE_STUCK: EventPriority.LOW,
}


def default_priority_for(event_type: str) -> EventPriority:
    """Return the default priority for an event type, defaulting to NORMAL."""
    return _EVENT_PRIORITY_MAP.get(event_type, EventPriority.NORMAL)


class SwarmEvent:
    """A single event in the bus."""

    __slots__ = ("event_type", "priority", "data", "source", "target", "timestamp", "event_id")

    _counter = 0  # monotonic ordering within same priority

    def __init__(
        self,
        event_type: str,
        data: Dict[str, Any],
        source: int = -1,
        target: Optional[int] = None,
        priority: Optional[EventPriority] = None,
    ):
        self.event_type = event_type
        self.priority = priority if priority is not None else default_priority_for(event_type)
        self.data = data
        self.source = source       # machine_index that emitted (-1 = coordinator)
        self.target = target        # None = broadcast to all, int = specific machine
        self.timestamp = time.time()
        SwarmEvent._counter += 1
        self.event_id = SwarmEvent._counter

    def __lt__(self, other: "SwarmEvent") -> bool:
        """For heapq ordering: lower priority value first, then older first."""
        if self.priority != other.priority:
            return self.priority < other.priority
        return self.event_id < other.event_id

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_type": self.event_type,
            "priority": self.priority.name,
            "data": self.data,
            "source": self.source,
            "target": self.target,
            "timestamp": self.timestamp,
            "event_id": self.event_id,
        }


class SwarmEventBus:
    """Priority-based event routing for swarm communication.

    Each machine has its own inbox (a list sorted by priority).
    The coordinator gets a copy of ALL events via a global queue.
    Machines can drain events up to a given priority threshold.
    """

    def __init__(self, machine_count: int):
        self.machine_count = machine_count

        # Per-machine inboxes: list of SwarmEvent, maintained sorted
        self._inboxes: Dict[int, List[SwarmEvent]] = {
            i: [] for i in range(machine_count)
        }

        # Global coordinator queue — receives ALL events
        self._coordinator_queue: asyncio.Queue[SwarmEvent] = asyncio.Queue()

        # Wake-up events so machines can be notified of critical events
        # without polling. Set when a CRITICAL event is published.
        self._wake_events: Dict[int, asyncio.Event] = {
            i: asyncio.Event() for i in range(machine_count)
        }

        # Subscribers: callbacks invoked on publish (for coordinator)
        self._global_subscribers: List[Callable[[SwarmEvent], None]] = []

        # Stats
        self._total_published = 0
        self._total_drained = 0

    # ──────────────────────────────────────────────────────────────────
    # Publishing
    # ──────────────────────────────────────────────────────────────────

    def publish(self, event: SwarmEvent) -> None:
        """Publish an event to the bus.

        - If event.target is set, routes to that machine only.
        - If event.target is None, broadcasts to all machines (except source).
        - Always sends a copy to the coordinator queue.
        """
        self._total_published += 1

        # Route to coordinator queue (always)
        try:
            self._coordinator_queue.put_nowait(event)
        except asyncio.QueueFull:
            pass  # coordinator queue is unbounded, shouldn't happen

        # Route to machine inboxes
        if event.target is not None:
            # Targeted event
            if 0 <= event.target < self.machine_count:
                self._insert_sorted(event.target, event)
                if event.priority <= EventPriority.CRITICAL:
                    self._wake_events[event.target].set()
        else:
            # Broadcast to all machines except source
            for idx in range(self.machine_count):
                if idx != event.source:
                    self._insert_sorted(idx, event)
                    if event.priority <= EventPriority.CRITICAL:
                        self._wake_events[idx].set()

        # Notify global subscribers
        for sub in self._global_subscribers:
            try:
                sub(event)
            except Exception:
                pass

    def publish_to_machine(
        self,
        target: int,
        event_type: str,
        data: Dict[str, Any],
        source: int = -1,
        priority: Optional[EventPriority] = None,
    ) -> SwarmEvent:
        """Convenience: create and publish a targeted event."""
        event = SwarmEvent(
            event_type=event_type,
            data=data,
            source=source,
            target=target,
            priority=priority,
        )
        self.publish(event)
        return event

    def publish_broadcast(
        self,
        event_type: str,
        data: Dict[str, Any],
        source: int = -1,
        priority: Optional[EventPriority] = None,
    ) -> SwarmEvent:
        """Convenience: create and publish a broadcast event."""
        event = SwarmEvent(
            event_type=event_type,
            data=data,
            source=source,
            target=None,
            priority=priority,
        )
        self.publish(event)
        return event

    # ──────────────────────────────────────────────────────────────────
    # Draining (consuming events)
    # ──────────────────────────────────────────────────────────────────

    def drain(
        self,
        machine_index: int,
        max_priority: EventPriority = EventPriority.LOW,
        limit: int = 50,
    ) -> List[SwarmEvent]:
        """Drain events from a machine's inbox up to the given priority level.

        Only returns events with priority <= max_priority.
        Events at lower priority levels remain in the inbox.
        Returns at most `limit` events, ordered by priority then time.
        """
        inbox = self._inboxes.get(machine_index, [])
        if not inbox:
            return []

        # Partition: events to return vs events to keep
        to_return: List[SwarmEvent] = []
        to_keep: List[SwarmEvent] = []

        for event in inbox:
            if event.priority <= max_priority and len(to_return) < limit:
                to_return.append(event)
            else:
                to_keep.append(event)

        self._inboxes[machine_index] = to_keep
        self._total_drained += len(to_return)

        # Clear wake event if no critical events remain
        has_critical = any(e.priority <= EventPriority.CRITICAL for e in to_keep)
        if not has_critical:
            self._wake_events[machine_index].clear()

        return to_return

    def drain_critical(self, machine_index: int) -> List[SwarmEvent]:
        """Drain only CRITICAL events from a machine's inbox."""
        return self.drain(machine_index, max_priority=EventPriority.CRITICAL)

    def drain_up_to_high(self, machine_index: int) -> List[SwarmEvent]:
        """Drain CRITICAL + HIGH events."""
        return self.drain(machine_index, max_priority=EventPriority.HIGH)

    def drain_up_to_normal(self, machine_index: int) -> List[SwarmEvent]:
        """Drain CRITICAL + HIGH + NORMAL events."""
        return self.drain(machine_index, max_priority=EventPriority.NORMAL)

    def drain_all(self, machine_index: int) -> List[SwarmEvent]:
        """Drain all events from a machine's inbox."""
        return self.drain(machine_index, max_priority=EventPriority.LOW)

    def peek(self, machine_index: int) -> Optional[SwarmEvent]:
        """Peek at the highest-priority event without removing it."""
        inbox = self._inboxes.get(machine_index, [])
        return inbox[0] if inbox else None

    def has_critical(self, machine_index: int) -> bool:
        """Check if there are any CRITICAL events pending."""
        inbox = self._inboxes.get(machine_index, [])
        return bool(inbox) and inbox[0].priority <= EventPriority.CRITICAL

    def inbox_size(self, machine_index: int) -> int:
        """Return the number of pending events for a machine."""
        return len(self._inboxes.get(machine_index, []))

    # ──────────────────────────────────────────────────────────────────
    # Coordinator queue
    # ──────────────────────────────────────────────────────────────────

    async def coordinator_get(self, timeout: float = 2.0) -> Optional[SwarmEvent]:
        """Get the next event from the coordinator's global queue.

        Returns None on timeout.
        """
        try:
            return await asyncio.wait_for(self._coordinator_queue.get(), timeout=timeout)
        except asyncio.TimeoutError:
            return None

    def coordinator_get_nowait(self) -> Optional[SwarmEvent]:
        """Non-blocking get from coordinator queue."""
        try:
            return self._coordinator_queue.get_nowait()
        except asyncio.QueueEmpty:
            return None

    def coordinator_drain_all(self) -> List[SwarmEvent]:
        """Drain all events currently in the coordinator queue."""
        events = []
        while True:
            try:
                events.append(self._coordinator_queue.get_nowait())
            except asyncio.QueueEmpty:
                break
        return events

    # ──────────────────────────────────────────────────────────────────
    # Async waiting
    # ──────────────────────────────────────────────────────────────────

    async def wait_for_critical(self, machine_index: int, timeout: float = 5.0) -> bool:
        """Wait until a critical event arrives for the given machine.

        Returns True if a critical event arrived, False on timeout.
        """
        try:
            await asyncio.wait_for(
                self._wake_events[machine_index].wait(), timeout=timeout
            )
            return True
        except asyncio.TimeoutError:
            return False

    # ──────────────────────────────────────────────────────────────────
    # Subscriptions
    # ──────────────────────────────────────────────────────────────────

    def subscribe_global(self, callback: Callable[[SwarmEvent], None]) -> None:
        """Register a callback invoked for every published event."""
        self._global_subscribers.append(callback)

    def unsubscribe_global(self, callback: Callable[[SwarmEvent], None]) -> None:
        """Remove a global subscriber."""
        try:
            self._global_subscribers.remove(callback)
        except ValueError:
            pass

    # ──────────────────────────────────────────────────────────────────
    # Internals
    # ──────────────────────────────────────────────────────────────────

    def _insert_sorted(self, machine_index: int, event: SwarmEvent) -> None:
        """Insert event into a machine's inbox maintaining sort order."""
        inbox = self._inboxes[machine_index]
        # Binary insertion to maintain sorted order
        lo, hi = 0, len(inbox)
        while lo < hi:
            mid = (lo + hi) // 2
            if inbox[mid] < event:
                lo = mid + 1
            else:
                hi = mid
        inbox.insert(lo, event)

    # ──────────────────────────────────────────────────────────────────
    # Stats / Debug
    # ──────────────────────────────────────────────────────────────────

    def stats(self) -> Dict[str, Any]:
        """Return bus statistics."""
        return {
            "total_published": self._total_published,
            "total_drained": self._total_drained,
            "coordinator_queue_size": self._coordinator_queue.qsize(),
            "inbox_sizes": {i: len(inbox) for i, inbox in self._inboxes.items()},
        }

    def clear(self) -> None:
        """Clear all inboxes and queues."""
        for idx in self._inboxes:
            self._inboxes[idx].clear()
            self._wake_events[idx].clear()
        # Drain coordinator queue
        while not self._coordinator_queue.empty():
            try:
                self._coordinator_queue.get_nowait()
            except asyncio.QueueEmpty:
                break
        self._total_published = 0
        self._total_drained = 0
