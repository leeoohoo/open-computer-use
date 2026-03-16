"""Tests for SwarmCoordinator — live LLM-based coordinator agent."""

import asyncio
import json
import pytest
import time
from typing import Any, Dict, List, Optional
from unittest.mock import MagicMock

from app.services.swarm_coordinator import (
    SwarmCoordinator,
    _extract_json_from_response,
)
from app.services.swarm_event_bus import (
    EVT_DECISION,
    EVT_DEPENDENCY_BLOCKED,
    EVT_DIRECTIVE,
    EVT_HELP_DISPATCH,
    EVT_HELP_REQUEST,
    EVT_MACHINE_COMPLETED,
    EVT_NUDGE,
    EVT_PROPOSAL,
    EVT_WORK_STEAL,
    EventPriority,
    SwarmEvent,
    SwarmEventBus,
)
from app.services.swarm_memory import SwarmMemory
from app.services.swarm_state_machine import (
    MachineStatus,
    SwarmStateMachine,
)


class TestExtractJsonFromResponse:
    """Test JSON extraction from LLM responses."""

    def test_raw_json(self):
        """Should parse raw JSON object."""
        result = _extract_json_from_response('{"key": "value"}')
        assert result == {"key": "value"}

    def test_json_in_markdown_fence(self):
        """Should extract JSON from markdown code fence."""
        text = 'Here is the answer:\n```json\n{"helper": 1}\n```\n'
        result = _extract_json_from_response(text)
        assert result == {"helper": 1}

    def test_json_in_plain_fence(self):
        """Should extract JSON from plain code fence."""
        text = '```\n{"action": "steal"}\n```'
        result = _extract_json_from_response(text)
        assert result == {"action": "steal"}

    def test_json_embedded_in_text(self):
        """Should find first JSON object in surrounding text."""
        text = 'I think the answer is {"decision": "yes"} based on analysis.'
        result = _extract_json_from_response(text)
        assert result == {"decision": "yes"}

    def test_returns_none_for_non_json(self):
        """Should return None for text without JSON."""
        assert _extract_json_from_response("no json here") is None

    def test_returns_none_for_json_array(self):
        """Should return None for JSON arrays (expects object)."""
        assert _extract_json_from_response('[1, 2, 3]') is None

    def test_empty_string(self):
        """Should return None for empty string."""
        assert _extract_json_from_response("") is None


class _CoordinatorTestBase:
    """Base class for coordinator tests with shared setup."""

    def _setup_coordinator(self, machine_count: int = 3, llm_response: str = "{}"):
        """Create a coordinator with mocked LLM."""
        self.bus = SwarmEventBus(machine_count)
        self.memory = SwarmMemory(machine_count)
        self.sm = SwarmStateMachine(machine_count, event_bus=self.bus)

        for i in range(machine_count):
            self.sm.register_machine(i, f"m{i}", f"task {i}")
            self.sm.start(i)

        # Mock LLM
        self.llm_responses: List[str] = []
        self.llm_calls: List[Dict] = []
        self._default_response = llm_response

        def mock_llm(system_prompt: str, user_message: str) -> str:
            self.llm_calls.append({
                "system": system_prompt,
                "user": user_message,
            })
            if self.llm_responses:
                return self.llm_responses.pop(0)
            return self._default_response

        self.coordinator_events: List[Dict] = []

        self.coordinator = SwarmCoordinator(
            swarm_id="test-swarm",
            prompt="Test task",
            event_bus=self.bus,
            state_machine=self.sm,
            swarm_memory=self.memory,
            llm_call=mock_llm,
            on_coordinator_event=lambda e: self.coordinator_events.append(e),
        )

    def _drain_coordinator_queue(self):
        """Clear the coordinator queue to prevent re-processing."""
        self.bus.coordinator_drain_all()


class TestCoordinatorHelpRequest(_CoordinatorTestBase):
    """Test help request handling."""

    @pytest.mark.asyncio
    async def test_help_request_dispatches_helper(self):
        """Coordinator should dispatch a helper when help is requested."""
        self._setup_coordinator()

        # Set machine progress so coordinator can pick best helper
        self.sm.get(1).step_count = 5
        self.sm.get(2).step_count = 15  # Most advanced — should be picked

        # LLM decides machine 2 should help
        self.llm_responses.append(json.dumps({
            "helper": 2,
            "advice_to_helper": "Try alternative URL",
            "advice_to_requester": "Help is coming",
        }))

        # Publish help request
        self.bus.publish_broadcast(
            EVT_HELP_REQUEST,
            {"machine_index": 0, "description": "Stuck on CAPTCHA"},
            source=0,
            priority=EventPriority.CRITICAL,
        )

        # Process events
        await self.coordinator._process_events()

        # Machine 2 should have received HELP_DISPATCH
        m2_events = self.bus.drain_all(2)
        help_dispatches = [e for e in m2_events if e.event_type == EVT_HELP_DISPATCH]
        assert len(help_dispatches) == 1
        assert help_dispatches[0].data["help_target"] == 0
        assert help_dispatches[0].data["advice"] == "Try alternative URL"

        # Machine 0 should have received a directive
        m0_events = self.bus.drain_all(0)
        directives = [e for e in m0_events if e.event_type == EVT_DIRECTIVE]
        assert len(directives) >= 1

    @pytest.mark.asyncio
    async def test_help_request_no_helpers_available(self):
        """When no helpers available, coordinator sends encouragement."""
        self._setup_coordinator(machine_count=1)

        self.bus.publish_broadcast(
            EVT_HELP_REQUEST,
            {"machine_index": 0, "description": "Stuck"},
            source=0,
        )

        await self.coordinator._process_events()

        # Machine 0 should get a directive (encouragement)
        m0_events = self.bus.drain_all(0)
        directives = [e for e in m0_events if e.event_type == EVT_DIRECTIVE]
        assert len(directives) >= 1

    @pytest.mark.asyncio
    async def test_duplicate_help_request_not_handled_twice(self):
        """Same help request should not be handled twice."""
        self._setup_coordinator()
        self.llm_responses.extend([
            json.dumps({"helper": 1, "advice_to_helper": "help", "advice_to_requester": "wait"}),
            json.dumps({"helper": 2, "advice_to_helper": "help", "advice_to_requester": "wait"}),
        ])

        # Publish same help request event twice
        event = SwarmEvent(
            EVT_HELP_REQUEST,
            {"machine_index": 0, "description": "Stuck"},
            source=0,
        )
        self.bus.publish(event)
        # Process first
        await self.coordinator._process_events()

        # Publish again with same event_id characteristics
        self.bus.publish(event)
        await self.coordinator._process_events()

        # LLM should only be called once for this help request
        assert len(self.llm_calls) == 1


class TestCoordinatorDependencyBlocked(_CoordinatorTestBase):
    """Test dependency blocked handling."""

    @pytest.mark.asyncio
    async def test_dependency_resolved_if_key_exists(self):
        """If blocked key already exists, coordinator sends RESOLVED immediately."""
        self._setup_coordinator()

        # Write the key before the blocked event
        self.memory.write("auth_token", "abc123", writer_index=1)

        self.bus.publish_broadcast(
            EVT_DEPENDENCY_BLOCKED,
            {"machine_index": 0, "key": "auth_token", "description": "Need auth"},
            source=0,
        )

        await self.coordinator._process_events()

        # Machine 0 should get DEPENDENCY_RESOLVED
        m0_events = self.bus.drain_all(0)
        resolved = [e for e in m0_events if e.event_type == "dependency_resolved"]
        assert len(resolved) == 1
        assert resolved[0].data["key"] == "auth_token"
        assert resolved[0].data["value"] == "abc123"

    @pytest.mark.asyncio
    async def test_dependency_blocked_directs_producer(self):
        """When key doesn't exist, coordinator directs another machine to produce it."""
        self._setup_coordinator()

        self.llm_responses.append(json.dumps({
            "target_machine": 1,
            "directive": "Please write auth_token ASAP",
        }))

        self.bus.publish_broadcast(
            EVT_DEPENDENCY_BLOCKED,
            {"machine_index": 0, "key": "auth_token", "description": "Need auth"},
            source=0,
        )

        await self.coordinator._process_events()

        # Machine 1 should get a directive
        m1_events = self.bus.drain_all(1)
        directives = [e for e in m1_events if e.event_type == EVT_DIRECTIVE]
        assert len(directives) >= 1


class TestCoordinatorWorkStealing(_CoordinatorTestBase):
    """Test work stealing when machines complete."""

    @pytest.mark.asyncio
    async def test_work_steal_on_completion(self):
        """Coordinator should assign stolen work when a machine completes."""
        self._setup_coordinator()

        self.llm_responses.append(json.dumps({
            "action": "steal",
            "target_machine": 1,
            "new_subtask": "Help machine 1 with remaining work",
            "narrow_existing": "Focus on first half only",
        }))

        self.bus.publish_broadcast(
            EVT_MACHINE_COMPLETED,
            {"machine_index": 0},
            source=0,
        )

        await self.coordinator._process_events()

        # Machine 0 should get WORK_STEAL
        m0_events = self.bus.drain_all(0)
        steal_events = [e for e in m0_events if e.event_type == EVT_WORK_STEAL]
        assert len(steal_events) == 1
        assert steal_events[0].data["new_subtask"] == "Help machine 1 with remaining work"
        assert steal_events[0].data["stolen_from"] == 1

    @pytest.mark.asyncio
    async def test_no_work_steal_when_idle_chosen(self):
        """Coordinator should not assign work if it decides 'idle'."""
        self._setup_coordinator()

        self.llm_responses.append(json.dumps({
            "action": "idle",
        }))

        self.bus.publish_broadcast(
            EVT_MACHINE_COMPLETED,
            {"machine_index": 0},
            source=0,
        )

        await self.coordinator._process_events()

        m0_events = self.bus.drain_all(0)
        steal_events = [e for e in m0_events if e.event_type == EVT_WORK_STEAL]
        assert len(steal_events) == 0

    @pytest.mark.asyncio
    async def test_supplementary_task_assignment(self):
        """Coordinator can assign supplementary tasks instead of stealing."""
        self._setup_coordinator()

        self.llm_responses.append(json.dumps({
            "action": "supplement",
            "new_subtask": "Verify results from all machines",
        }))

        self.bus.publish_broadcast(
            EVT_MACHINE_COMPLETED,
            {"machine_index": 0},
            source=0,
        )

        await self.coordinator._process_events()

        m0_events = self.bus.drain_all(0)
        steal_events = [e for e in m0_events if e.event_type == EVT_WORK_STEAL]
        assert len(steal_events) == 1
        assert steal_events[0].data["stolen_from"] == -1  # supplementary


class TestCoordinatorProposal(_CoordinatorTestBase):
    """Test proposal/decision handling."""

    @pytest.mark.asyncio
    async def test_proposal_results_in_decision(self):
        """Coordinator should make a decision and broadcast it."""
        self._setup_coordinator()

        self.llm_responses.append(json.dumps({
            "decision": "Google Sheets",
            "reasoning": "Machine 0 already started in Sheets",
        }))

        self.bus.publish_broadcast(
            EVT_PROPOSAL,
            {"question": "Which format?", "options": "Google Sheets, Excel"},
            source=1,
        )

        await self.coordinator._process_events()

        # All machines (except source) should get DECISION
        for i in [0, 2]:
            events = self.bus.drain_all(i)
            decisions = [e for e in events if e.event_type == EVT_DECISION]
            assert len(decisions) == 1
            assert decisions[0].data["decision"] == "Google Sheets"

        # Decision should be stored in shared memory
        decision_entry = self.memory.read("decision:Which format?")
        assert decision_entry is not None
        assert decision_entry["value"] == "Google Sheets"

    @pytest.mark.asyncio
    async def test_duplicate_proposal_not_handled_twice(self):
        """Same proposal should not trigger two LLM calls."""
        self._setup_coordinator()
        self.llm_responses.extend([
            json.dumps({"decision": "A"}),
            json.dumps({"decision": "B"}),
        ])

        # Same proposal twice
        for _ in range(2):
            self.bus.publish_broadcast(
                EVT_PROPOSAL,
                {"question": "Which?", "options": "A, B"},
                source=0,
            )

        await self.coordinator._process_events()
        assert len(self.llm_calls) == 1


class TestCoordinatorStandup(_CoordinatorTestBase):
    """Test periodic standup checks."""

    @pytest.mark.asyncio
    async def test_standup_with_no_issues(self):
        """Standup with no issues should result in empty actions."""
        self._setup_coordinator()

        self.llm_responses.append(json.dumps({"actions": []}))

        await self.coordinator._run_standup()

        # LLM was called
        assert len(self.llm_calls) == 1
        assert "STANDUP CHECK" in self.llm_calls[0]["user"]

    @pytest.mark.asyncio
    async def test_standup_sends_directives(self):
        """Standup should send directives based on LLM response."""
        self._setup_coordinator()

        self.llm_responses.append(json.dumps({
            "actions": [
                {"type": "directive", "target": 0, "message": "Speed up"},
                {"type": "nudge", "target": 1, "message": "You seem stuck"},
            ]
        }))

        await self.coordinator._run_standup()

        # Machine 0 should get directive
        m0_events = self.bus.drain_all(0)
        directives = [e for e in m0_events if e.event_type == EVT_DIRECTIVE]
        assert len(directives) >= 1

        # Machine 1 should get nudge
        m1_events = self.bus.drain_all(1)
        nudges = [e for e in m1_events if e.event_type == EVT_NUDGE]
        assert len(nudges) >= 1

    @pytest.mark.asyncio
    async def test_standup_skipped_when_all_terminal(self):
        """Standup should not run when all machines are done."""
        self._setup_coordinator()
        for i in range(3):
            self.sm.complete(i)

        await self.coordinator._run_standup()
        assert len(self.llm_calls) == 0


class TestCoordinatorStuckDetection(_CoordinatorTestBase):
    """Test stuck machine detection (non-LLM, runs between standups)."""

    def test_nudge_sent_to_stuck_machine(self):
        """Machines with no recent activity should get a nudge."""
        self._setup_coordinator()

        # Simulate stale machine
        self.sm.get(0).last_activity_time = time.time() - 100.0

        self.coordinator._check_stuck_machines()

        m0_events = self.bus.drain_all(0)
        nudges = [e for e in m0_events if e.event_type == EVT_NUDGE]
        assert len(nudges) == 1
        assert "progress" in nudges[0].data["message"].lower()

    def test_no_nudge_for_active_machines(self):
        """Recently active machines should not be nudged."""
        self._setup_coordinator()
        # Machine 0 activity is recent (just created)

        self.coordinator._check_stuck_machines()

        m0_events = self.bus.drain_all(0)
        nudges = [e for e in m0_events if e.event_type == EVT_NUDGE]
        assert len(nudges) == 0

    def test_no_double_nudge(self):
        """Same machine should not be nudged twice within threshold."""
        self._setup_coordinator()
        self.sm.get(0).last_activity_time = time.time() - 100.0

        self.coordinator._check_stuck_machines()
        self.bus.drain_all(0)  # Clear events

        self.coordinator._check_stuck_machines()
        m0_events = self.bus.drain_all(0)
        nudges = [e for e in m0_events if e.event_type == EVT_NUDGE]
        assert len(nudges) == 0  # Not nudged again


class TestCoordinatorLifecycle(_CoordinatorTestBase):
    """Test coordinator start/stop lifecycle."""

    @pytest.mark.asyncio
    async def test_coordinator_stops_on_signal(self):
        """Coordinator should stop when stop() is called."""
        self._setup_coordinator()

        # Start coordinator
        task = asyncio.create_task(self.coordinator.run())
        assert self.coordinator.is_running is False  # Not started yet

        await asyncio.sleep(0.1)
        assert self.coordinator.is_running is True

        # Stop it
        self.coordinator.stop()
        await asyncio.wait_for(task, timeout=5.0)
        assert self.coordinator.is_running is False

    @pytest.mark.asyncio
    async def test_coordinator_handles_llm_failure_gracefully(self):
        """Coordinator should not crash on LLM errors."""
        self.bus = SwarmEventBus(3)
        self.memory = SwarmMemory(3)
        self.sm = SwarmStateMachine(3, event_bus=self.bus)
        for i in range(3):
            self.sm.register_machine(i, f"m{i}", f"task {i}")
            self.sm.start(i)

        def failing_llm(system_prompt, user_message):
            raise RuntimeError("API error")

        coordinator = SwarmCoordinator(
            swarm_id="test",
            prompt="test",
            event_bus=self.bus,
            state_machine=self.sm,
            swarm_memory=self.memory,
            llm_call=failing_llm,
        )

        # Publish a help request — LLM will fail
        self.bus.publish_broadcast(
            EVT_HELP_REQUEST,
            {"machine_index": 0, "description": "Help"},
            source=0,
        )

        # Should not raise
        await coordinator._process_events()

    @pytest.mark.asyncio
    async def test_coordinator_event_callback(self):
        """on_coordinator_event callback should be called for actions."""
        self._setup_coordinator()

        self.llm_responses.append(json.dumps({
            "helper": 1,
            "advice_to_helper": "help",
            "advice_to_requester": "wait",
        }))

        self.bus.publish_broadcast(
            EVT_HELP_REQUEST,
            {"machine_index": 0, "description": "Stuck"},
            source=0,
        )

        await self.coordinator._process_events()

        # Callback should have been called
        assert len(self.coordinator_events) >= 1
        assert self.coordinator_events[0]["type"] == "coordinator_action"
