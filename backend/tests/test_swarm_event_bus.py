"""Tests for SwarmEventBus — priority-based event routing."""

import asyncio
import pytest
from typing import List

from app.services.swarm_event_bus import (
    EVT_COORDINATOR_COMMAND,
    EVT_DECISION,
    EVT_DEPENDENCY_BLOCKED,
    EVT_DEPENDENCY_RESOLVED,
    EVT_DIRECTIVE,
    EVT_HELP_DISPATCH,
    EVT_HELP_REQUEST,
    EVT_MACHINE_COMPLETED,
    EVT_NUDGE,
    EVT_PEER_ACTIVITY,
    EVT_PEER_MESSAGE,
    EVT_WORK_STEAL,
    EventPriority,
    SwarmEvent,
    SwarmEventBus,
    default_priority_for,
)


class TestEventPriority:
    """Test priority ordering and defaults."""

    def test_priority_ordering(self):
        """CRITICAL < HIGH < NORMAL < LOW."""
        assert EventPriority.CRITICAL < EventPriority.HIGH
        assert EventPriority.HIGH < EventPriority.NORMAL
        assert EventPriority.NORMAL < EventPriority.LOW

    def test_default_priority_for_known_types(self):
        """Known event types should have expected default priorities."""
        assert default_priority_for(EVT_COORDINATOR_COMMAND) == EventPriority.CRITICAL
        assert default_priority_for(EVT_HELP_REQUEST) == EventPriority.CRITICAL
        assert default_priority_for(EVT_NUDGE) == EventPriority.CRITICAL
        assert default_priority_for(EVT_PEER_MESSAGE) == EventPriority.HIGH
        assert default_priority_for(EVT_DECISION) == EventPriority.HIGH
        assert default_priority_for(EVT_PEER_ACTIVITY) == EventPriority.NORMAL
        assert default_priority_for("unknown_type") == EventPriority.NORMAL

    def test_default_priority_for_unknown_type(self):
        """Unknown event types default to NORMAL."""
        assert default_priority_for("completely_made_up") == EventPriority.NORMAL


class TestSwarmEvent:
    """Test SwarmEvent creation and ordering."""

    def test_event_creation_with_defaults(self):
        """Event should use default priority from event type."""
        event = SwarmEvent(EVT_HELP_REQUEST, {"desc": "stuck"}, source=0)
        assert event.event_type == EVT_HELP_REQUEST
        assert event.priority == EventPriority.CRITICAL
        assert event.source == 0
        assert event.target is None
        assert event.data == {"desc": "stuck"}
        assert event.timestamp > 0
        assert event.event_id > 0

    def test_event_creation_with_explicit_priority(self):
        """Explicit priority overrides default."""
        event = SwarmEvent(EVT_PEER_ACTIVITY, {}, priority=EventPriority.CRITICAL)
        assert event.priority == EventPriority.CRITICAL

    def test_event_ordering_by_priority(self):
        """Lower priority value (higher urgency) should sort first."""
        critical = SwarmEvent(EVT_HELP_REQUEST, {}, priority=EventPriority.CRITICAL)
        normal = SwarmEvent(EVT_PEER_ACTIVITY, {}, priority=EventPriority.NORMAL)
        assert critical < normal

    def test_event_ordering_same_priority_by_time(self):
        """Same priority → older event (lower event_id) sorts first."""
        e1 = SwarmEvent("test", {}, priority=EventPriority.HIGH)
        e2 = SwarmEvent("test", {}, priority=EventPriority.HIGH)
        assert e1 < e2  # e1 has lower event_id

    def test_event_to_dict(self):
        """to_dict should include all fields."""
        event = SwarmEvent("test", {"key": "val"}, source=1, target=2)
        d = event.to_dict()
        assert d["event_type"] == "test"
        assert d["data"] == {"key": "val"}
        assert d["source"] == 1
        assert d["target"] == 2
        assert "timestamp" in d
        assert "event_id" in d
        assert "priority" in d


class TestSwarmEventBusPublish:
    """Test event publishing and routing."""

    def setup_method(self):
        self.bus = SwarmEventBus(3)

    def test_broadcast_routes_to_all_except_source(self):
        """Broadcast event should go to all machines except the source."""
        self.bus.publish_broadcast(EVT_PEER_ACTIVITY, {"info": "test"}, source=0)
        # Machine 0 (source) should have nothing
        assert self.bus.inbox_size(0) == 0
        # Machines 1 and 2 should have 1 event each
        assert self.bus.inbox_size(1) == 1
        assert self.bus.inbox_size(2) == 1

    def test_targeted_event_routes_to_target_only(self):
        """Targeted event should only go to the specified machine."""
        self.bus.publish_to_machine(1, EVT_DIRECTIVE, {"msg": "do this"}, source=-1)
        assert self.bus.inbox_size(0) == 0
        assert self.bus.inbox_size(1) == 1
        assert self.bus.inbox_size(2) == 0

    def test_coordinator_queue_receives_all_events(self):
        """Coordinator queue should get a copy of every event."""
        self.bus.publish_broadcast(EVT_PEER_ACTIVITY, {}, source=0)
        self.bus.publish_to_machine(1, EVT_DIRECTIVE, {}, source=-1)
        assert self.bus._coordinator_queue.qsize() == 2

    def test_publish_sets_wake_event_for_critical(self):
        """Critical events should set the wake event for targeted machines."""
        self.bus.publish_to_machine(
            target=0,
            event_type=EVT_NUDGE,
            data={},
            source=-1,
            priority=EventPriority.CRITICAL,
        )
        assert self.bus._wake_events[0].is_set()
        assert not self.bus._wake_events[1].is_set()

    def test_broadcast_critical_sets_wake_for_all_except_source(self):
        """Critical broadcast should wake all machines except source."""
        self.bus.publish_broadcast(
            EVT_HELP_REQUEST, {}, source=1, priority=EventPriority.CRITICAL,
        )
        assert self.bus._wake_events[0].is_set()
        assert not self.bus._wake_events[1].is_set()  # source
        assert self.bus._wake_events[2].is_set()

    def test_stats_tracks_published_count(self):
        """Stats should reflect the number of published events."""
        self.bus.publish_broadcast("test", {}, source=0)
        self.bus.publish_to_machine(1, "test", {})
        stats = self.bus.stats()
        assert stats["total_published"] == 2

    def test_out_of_range_target_ignored(self):
        """Publishing to an out-of-range target should not crash."""
        self.bus.publish_to_machine(99, EVT_DIRECTIVE, {})
        # Should just go to coordinator queue, not any inbox
        assert self.bus._coordinator_queue.qsize() == 1
        for i in range(3):
            assert self.bus.inbox_size(i) == 0


class TestSwarmEventBusDrain:
    """Test event draining with priority filtering."""

    def setup_method(self):
        self.bus = SwarmEventBus(3)

    def test_drain_returns_events_up_to_priority(self):
        """drain() should only return events at or above the given priority."""
        # Publish events at different priorities to machine 0
        self.bus.publish_to_machine(0, EVT_NUDGE, {"msg": "critical"}, priority=EventPriority.CRITICAL)
        self.bus.publish_to_machine(0, EVT_DIRECTIVE, {"msg": "high"}, priority=EventPriority.HIGH)
        self.bus.publish_to_machine(0, EVT_PEER_ACTIVITY, {"msg": "normal"}, priority=EventPriority.NORMAL)

        # Drain only CRITICAL
        critical = self.bus.drain_critical(0)
        assert len(critical) == 1
        assert critical[0].data["msg"] == "critical"

        # HIGH and NORMAL should still be there
        assert self.bus.inbox_size(0) == 2

    def test_drain_up_to_high_gets_critical_and_high(self):
        """drain_up_to_high should get both CRITICAL and HIGH events."""
        self.bus.publish_to_machine(0, "test", {}, priority=EventPriority.CRITICAL)
        self.bus.publish_to_machine(0, "test", {}, priority=EventPriority.HIGH)
        self.bus.publish_to_machine(0, "test", {}, priority=EventPriority.NORMAL)

        events = self.bus.drain_up_to_high(0)
        assert len(events) == 2
        assert self.bus.inbox_size(0) == 1  # NORMAL remains

    def test_drain_all_empties_inbox(self):
        """drain_all should return everything and empty the inbox."""
        for p in EventPriority:
            self.bus.publish_to_machine(0, "test", {"p": p.name}, priority=p)

        events = self.bus.drain_all(0)
        assert len(events) == 4
        assert self.bus.inbox_size(0) == 0

    def test_drain_respects_limit(self):
        """drain() should return at most `limit` events."""
        for _ in range(10):
            self.bus.publish_to_machine(0, "test", {}, priority=EventPriority.HIGH)

        events = self.bus.drain(0, max_priority=EventPriority.HIGH, limit=3)
        assert len(events) == 3
        assert self.bus.inbox_size(0) == 7

    def test_drain_preserves_priority_order(self):
        """Drained events should be in priority order (critical first)."""
        self.bus.publish_to_machine(0, "test", {"p": "low"}, priority=EventPriority.LOW)
        self.bus.publish_to_machine(0, "test", {"p": "critical"}, priority=EventPriority.CRITICAL)
        self.bus.publish_to_machine(0, "test", {"p": "high"}, priority=EventPriority.HIGH)

        events = self.bus.drain_all(0)
        assert events[0].data["p"] == "critical"
        assert events[1].data["p"] == "high"
        assert events[2].data["p"] == "low"

    def test_drain_empty_inbox_returns_empty_list(self):
        """Draining an empty inbox returns an empty list."""
        assert self.bus.drain_all(0) == []

    def test_drain_clears_wake_event_when_no_critical_remains(self):
        """After draining critical events, wake event should clear."""
        self.bus.publish_to_machine(0, "test", {}, priority=EventPriority.CRITICAL)
        assert self.bus._wake_events[0].is_set()

        self.bus.drain_critical(0)
        assert not self.bus._wake_events[0].is_set()

    def test_drain_keeps_wake_event_if_critical_remains(self):
        """If only some critical events drained, wake event stays set."""
        self.bus.publish_to_machine(0, "test", {}, priority=EventPriority.CRITICAL)
        self.bus.publish_to_machine(0, "test", {}, priority=EventPriority.CRITICAL)

        # Drain with limit=1
        self.bus.drain(0, max_priority=EventPriority.CRITICAL, limit=1)
        assert self.bus._wake_events[0].is_set()  # One critical still remains

    def test_stats_tracks_drained_count(self):
        """Stats should reflect total drained events."""
        self.bus.publish_to_machine(0, "test", {})
        self.bus.drain_all(0)
        stats = self.bus.stats()
        assert stats["total_drained"] == 1


class TestSwarmEventBusPeekAndHas:
    """Test peek and has_critical methods."""

    def setup_method(self):
        self.bus = SwarmEventBus(3)

    def test_peek_returns_highest_priority_event(self):
        """peek should return the highest-priority event without removing it."""
        self.bus.publish_to_machine(0, "test", {"p": "normal"}, priority=EventPriority.NORMAL)
        self.bus.publish_to_machine(0, "test", {"p": "critical"}, priority=EventPriority.CRITICAL)

        peeked = self.bus.peek(0)
        assert peeked.data["p"] == "critical"
        assert self.bus.inbox_size(0) == 2  # Not removed

    def test_peek_empty_inbox_returns_none(self):
        """peek on empty inbox returns None."""
        assert self.bus.peek(0) is None

    def test_has_critical_true_when_critical_present(self):
        """has_critical should be True when a critical event exists."""
        self.bus.publish_to_machine(0, "test", {}, priority=EventPriority.CRITICAL)
        assert self.bus.has_critical(0) is True

    def test_has_critical_false_when_no_critical(self):
        """has_critical should be False when only non-critical events exist."""
        self.bus.publish_to_machine(0, "test", {}, priority=EventPriority.NORMAL)
        assert self.bus.has_critical(0) is False

    def test_has_critical_false_when_empty(self):
        """has_critical should be False for empty inbox."""
        assert self.bus.has_critical(0) is False


class TestSwarmEventBusCoordinatorQueue:
    """Test the coordinator queue methods."""

    def setup_method(self):
        self.bus = SwarmEventBus(3)

    @pytest.mark.asyncio
    async def test_coordinator_get_returns_event(self):
        """coordinator_get should return events from the global queue."""
        self.bus.publish_broadcast("test", {"value": 42}, source=0)
        event = await self.bus.coordinator_get(timeout=1.0)
        assert event is not None
        assert event.data["value"] == 42

    @pytest.mark.asyncio
    async def test_coordinator_get_returns_none_on_timeout(self):
        """coordinator_get should return None when queue is empty and timeout expires."""
        event = await self.bus.coordinator_get(timeout=0.1)
        assert event is None

    def test_coordinator_get_nowait_returns_event(self):
        """Non-blocking get should return event when available."""
        self.bus.publish_broadcast("test", {}, source=0)
        event = self.bus.coordinator_get_nowait()
        assert event is not None

    def test_coordinator_get_nowait_returns_none_when_empty(self):
        """Non-blocking get should return None when queue is empty."""
        assert self.bus.coordinator_get_nowait() is None

    def test_coordinator_drain_all(self):
        """coordinator_drain_all should return and remove all events."""
        for i in range(5):
            self.bus.publish_broadcast("test", {"i": i}, source=0)
        events = self.bus.coordinator_drain_all()
        assert len(events) == 5
        assert self.bus.coordinator_get_nowait() is None


class TestSwarmEventBusAsyncWaiting:
    """Test async waiting for critical events."""

    def setup_method(self):
        self.bus = SwarmEventBus(3)

    @pytest.mark.asyncio
    async def test_wait_for_critical_returns_true_when_event_arrives(self):
        """wait_for_critical should return True when a critical event is published."""
        async def publish_after_delay():
            await asyncio.sleep(0.1)
            self.bus.publish_to_machine(0, "test", {}, priority=EventPriority.CRITICAL)

        task = asyncio.create_task(publish_after_delay())
        result = await self.bus.wait_for_critical(0, timeout=2.0)
        assert result is True
        await task

    @pytest.mark.asyncio
    async def test_wait_for_critical_returns_false_on_timeout(self):
        """wait_for_critical should return False on timeout."""
        result = await self.bus.wait_for_critical(0, timeout=0.1)
        assert result is False


class TestSwarmEventBusSubscriptions:
    """Test global subscriber functionality."""

    def setup_method(self):
        self.bus = SwarmEventBus(3)

    def test_global_subscriber_called_on_publish(self):
        """Global subscribers should be called for every published event."""
        received: List[SwarmEvent] = []
        self.bus.subscribe_global(lambda e: received.append(e))

        self.bus.publish_broadcast("test", {}, source=0)
        assert len(received) == 1

    def test_global_subscriber_unsubscribe(self):
        """Unsubscribed callbacks should not receive events."""
        received: List[SwarmEvent] = []
        callback = lambda e: received.append(e)
        self.bus.subscribe_global(callback)
        self.bus.unsubscribe_global(callback)

        self.bus.publish_broadcast("test", {}, source=0)
        assert len(received) == 0

    def test_subscriber_exception_does_not_break_publish(self):
        """A failing subscriber should not prevent event delivery."""
        def bad_callback(e):
            raise RuntimeError("boom")

        self.bus.subscribe_global(bad_callback)
        # Should not raise
        self.bus.publish_broadcast("test", {}, source=0)
        assert self.bus.inbox_size(1) == 1  # Event still delivered


class TestSwarmEventBusClear:
    """Test the clear method."""

    def setup_method(self):
        self.bus = SwarmEventBus(3)

    def test_clear_empties_everything(self):
        """clear() should empty all inboxes, queues, and stats."""
        self.bus.publish_broadcast("test", {}, source=0)
        self.bus.publish_to_machine(0, "test", {}, priority=EventPriority.CRITICAL)

        self.bus.clear()

        assert self.bus.inbox_size(0) == 0
        assert self.bus.inbox_size(1) == 0
        assert self.bus.coordinator_get_nowait() is None
        assert not self.bus._wake_events[0].is_set()
        stats = self.bus.stats()
        assert stats["total_published"] == 0
        assert stats["total_drained"] == 0
