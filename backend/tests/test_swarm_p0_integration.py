"""Integration tests for the full P0 layer — EventBus + StateMachine + Coordinator
working together as a cohesive system."""

import asyncio
import json
import time
import pytest
from typing import Dict, List

from app.services.swarm_coordinator import SwarmCoordinator
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
    EVT_PROPOSAL,
    EVT_WORK_STEAL,
    EventPriority,
    SwarmEvent,
    SwarmEventBus,
)
from app.services.swarm_memory import SwarmMemory
from app.services.swarm_state_machine import (
    MachineStatus,
    StateTransitionError,
    SwarmStateMachine,
)


class TestFullP0FlowHelpRequest:
    """End-to-end: Machine requests help → Coordinator dispatches → Helper pauses → Resumes."""

    def _setup(self):
        self.bus = SwarmEventBus(3)
        self.memory = SwarmMemory(3)
        self.sm = SwarmStateMachine(3, event_bus=self.bus)
        self.llm_calls = []

        for i in range(3):
            self.sm.register_machine(i, f"m{i}", f"Research topic {i}")
            self.sm.start(i)
            self.sm.get(i).step_count = (i + 1) * 5  # m0=5, m1=10, m2=15

        def mock_llm(sys, user):
            self.llm_calls.append(user)
            return json.dumps({
                "helper": 2,
                "advice_to_helper": "Try searching Google directly",
                "advice_to_requester": "Machine 2 will help you shortly",
            })

        self.coordinator = SwarmCoordinator(
            swarm_id="test",
            prompt="Research 3 topics",
            event_bus=self.bus,
            state_machine=self.sm,
            swarm_memory=self.memory,
            llm_call=mock_llm,
        )

    @pytest.mark.asyncio
    async def test_full_help_flow(self):
        """Machine 0 stuck → Coordinator picks Machine 2 → Machine 2 helps → Resumes."""
        self._setup()

        # Step 1: Machine 0 requests help
        self.memory.add_help_request(0, "CAPTCHA blocking me")
        self.bus.publish_broadcast(
            EVT_HELP_REQUEST,
            {"machine_index": 0, "description": "CAPTCHA blocking me"},
            source=0,
            priority=EventPriority.CRITICAL,
        )

        # Step 2: Coordinator processes the request
        await self.coordinator._process_events()

        # Step 3: Machine 2 receives HELP_DISPATCH (critical priority)
        m2_events = self.bus.drain_critical(2)
        help_events = [e for e in m2_events if e.event_type == EVT_HELP_DISPATCH]
        assert len(help_events) == 1
        assert help_events[0].data["help_target"] == 0

        # Step 4: Machine 2 transitions to HELPING state
        self.sm.start_helping(2, target_machine=0, help_subtask="Help with CAPTCHA")
        state2 = self.sm.get(2)
        assert state2.status == MachineStatus.HELPING
        assert state2.helping_machine == 0
        assert state2.paused_subtask == "Research topic 2"  # Original saved

        # Step 5: Machine 2 sends help back
        self.memory.send_message(2, 0, "Try using the alternative login URL: login2.example.com")

        # Step 6: Machine 2 resumes own task
        self.sm.resume_from_helping(2)
        assert state2.status == MachineStatus.RUNNING
        assert state2.subtask == "Research topic 2"  # Restored
        assert state2.helping_machine is None

        # Step 7: Machine 0 gets the message
        msgs = self.memory.get_messages(0)
        assert len(msgs) == 1
        assert "alternative login URL" in msgs[0]["message"]


class TestFullP0FlowDependencyResolution:
    """End-to-end: Machine blocks on dependency → Coordinator intervenes → Resolved."""

    def _setup(self):
        self.bus = SwarmEventBus(3)
        self.memory = SwarmMemory(3)
        self.sm = SwarmStateMachine(3, event_bus=self.bus)

        for i in range(3):
            self.sm.register_machine(i, f"m{i}", f"task {i}")
            self.sm.start(i)

        def mock_llm(sys, user):
            return json.dumps({
                "target_machine": 0,
                "directive": "Write 'product_urls' to shared memory ASAP",
            })

        self.coordinator = SwarmCoordinator(
            swarm_id="test",
            prompt="Compare products",
            event_bus=self.bus,
            state_machine=self.sm,
            swarm_memory=self.memory,
            llm_call=mock_llm,
        )

    @pytest.mark.asyncio
    async def test_full_dependency_flow(self):
        """Machine 1 blocked → Coordinator directs Machine 0 → Key written → Unblocked."""
        self._setup()

        # Step 1: Machine 1 declares dependency
        self.sm.block(1, "product_urls", "Need URLs to compare")

        # Step 2: Coordinator processes the DEPENDENCY_BLOCKED event
        await self.coordinator._process_events()

        # Step 3: Machine 0 gets a directive
        m0_events = self.bus.drain_all(0)
        directives = [e for e in m0_events if e.event_type == EVT_DIRECTIVE]
        assert len(directives) >= 1

        # Step 4: Machine 0 writes the key
        self.memory.write("product_urls", "url1.com, url2.com, url3.com", writer_index=0)

        # Step 5: Machine 1 can now read it
        entry = self.memory.read("product_urls")
        assert entry is not None
        assert "url1.com" in entry["value"]

        # Step 6: Unblock machine 1
        self.sm.unblock(1)
        assert self.sm.get(1).status == MachineStatus.RUNNING

    @pytest.mark.asyncio
    async def test_dependency_auto_resolved_if_key_exists(self):
        """If key already exists when blocked event arrives, resolve immediately."""
        self._setup()

        # Write key first
        self.memory.write("early_key", "value", writer_index=2)

        # Publish blocked event
        self.bus.publish_broadcast(
            EVT_DEPENDENCY_BLOCKED,
            {"machine_index": 1, "key": "early_key", "description": "Need it"},
            source=1,
        )

        await self.coordinator._process_events()

        # Machine 1 should get DEPENDENCY_RESOLVED directly
        m1_events = self.bus.drain_all(1)
        resolved = [e for e in m1_events if e.event_type == EVT_DEPENDENCY_RESOLVED]
        assert len(resolved) == 1
        assert resolved[0].data["value"] == "value"


class TestFullP0FlowWorkStealing:
    """End-to-end: Machine completes → Goes idle → Coordinator assigns stolen work."""

    def _setup(self):
        self.bus = SwarmEventBus(3)
        self.memory = SwarmMemory(3)
        self.sm = SwarmStateMachine(3, event_bus=self.bus)

        for i in range(3):
            self.sm.register_machine(i, f"m{i}", f"task {i}")
            self.sm.start(i)

        self.sm.get(0).step_count = 20  # Advanced
        self.sm.get(1).step_count = 5   # Behind
        self.sm.get(2).step_count = 10

        def mock_llm(sys, user):
            return json.dumps({
                "action": "steal",
                "target_machine": 1,
                "new_subtask": "Help machine 1 with data extraction",
                "narrow_existing": "Machine 1: only process first half",
            })

        self.coordinator = SwarmCoordinator(
            swarm_id="test",
            prompt="Extract all data",
            event_bus=self.bus,
            state_machine=self.sm,
            swarm_memory=self.memory,
            llm_call=mock_llm,
        )

    @pytest.mark.asyncio
    async def test_full_work_steal_flow(self):
        """Machine 0 completes → Coordinator splits Machine 1's work → Machine 0 picks up."""
        self._setup()

        # Step 1: Machine 0 completes
        self.sm.complete(0)
        self.memory.set_result(0, "Completed task 0 successfully")

        # Step 2: Coordinator processes completion
        await self.coordinator._process_events()

        # Step 3: Machine 0 should get WORK_STEAL
        m0_events = self.bus.drain_all(0)
        steal_events = [e for e in m0_events if e.event_type == EVT_WORK_STEAL]
        assert len(steal_events) == 1
        assert steal_events[0].data["new_subtask"] == "Help machine 1 with data extraction"
        assert steal_events[0].data["stolen_from"] == 1

        # Step 4: Machine 0 transitions to IDLE then picks up work
        self.sm.go_idle(0)
        self.sm.assign_stolen_work(0, "Help machine 1 with data extraction", stolen_from=1)
        state0 = self.sm.get(0)
        assert state0.status == MachineStatus.RUNNING
        assert state0.subtask == "Help machine 1 with data extraction"
        assert state0.stolen_from == 1


class TestFullP0FlowProposalAndDecision:
    """End-to-end: Machine proposes → Coordinator decides → All machines see decision."""

    def _setup(self):
        self.bus = SwarmEventBus(3)
        self.memory = SwarmMemory(3)
        self.sm = SwarmStateMachine(3, event_bus=self.bus)

        for i in range(3):
            self.sm.register_machine(i, f"m{i}", f"task {i}")
            self.sm.start(i)

        def mock_llm(sys, user):
            return json.dumps({
                "decision": "Google Sheets",
                "reasoning": "Machine 0 already started a spreadsheet",
            })

        self.coordinator = SwarmCoordinator(
            swarm_id="test",
            prompt="Compare and document",
            event_bus=self.bus,
            state_machine=self.sm,
            swarm_memory=self.memory,
            llm_call=mock_llm,
        )

    @pytest.mark.asyncio
    async def test_full_proposal_flow(self):
        """Machine 1 proposes format → Coordinator decides → All see decision."""
        self._setup()

        # Step 1: Machine 1 proposes
        self.bus.publish_broadcast(
            EVT_PROPOSAL,
            {"question": "Output format?", "options": "Google Sheets, Excel, CSV"},
            source=1,
        )

        # Step 2: Coordinator decides
        await self.coordinator._process_events()

        # Step 3: All machines (except source) see the decision
        for idx in [0, 2]:
            events = self.bus.drain_all(idx)
            decisions = [e for e in events if e.event_type == EVT_DECISION]
            assert len(decisions) == 1
            assert decisions[0].data["decision"] == "Google Sheets"

        # Step 4: Decision stored in shared memory
        stored = self.memory.read("decision:Output format?")
        assert stored is not None
        assert stored["value"] == "Google Sheets"


class TestFullP0FlowExpertiseRouting:
    """End-to-end: Machine claims expertise → Stored for routing."""

    def test_expertise_flow(self):
        """Machine 0 claims spreadsheet expertise → Can be found by others."""
        bus = SwarmEventBus(3)
        memory = SwarmMemory(3)
        sm = SwarmStateMachine(3, event_bus=bus)

        for i in range(3):
            sm.register_machine(i, f"m{i}", f"task {i}")
            sm.start(i)

        # Machine 0 claims expertise
        memory.claim_expertise(0, "spreadsheets")
        sm.get(0).expertise_domains.append("spreadsheets")

        # Can be found
        assert memory.find_expert("spreadsheets") == 0
        assert sm.find_expert("spreadsheets").index == 0


class TestFullP0FlowWaitForKey:
    """End-to-end: Machine waits for key → Another writes it → Woken up."""

    @pytest.mark.asyncio
    async def test_async_dependency_waiting(self):
        """Machine 1 waits → Machine 0 writes → Machine 1 unblocked."""
        memory = SwarmMemory(3)
        results = {}

        async def machine_1_waits():
            result = await memory.wait_for_key("analysis_data", timeout=5.0)
            results["machine_1"] = result

        async def machine_0_writes():
            await asyncio.sleep(0.2)
            memory.write("analysis_data", "important findings", writer_index=0)

        await asyncio.gather(
            machine_1_waits(),
            machine_0_writes(),
        )

        assert results["machine_1"] is not None
        assert results["machine_1"]["value"] == "important findings"

    @pytest.mark.asyncio
    async def test_wait_for_key_with_state_machine(self):
        """Full flow: block state → wait for key → write → unblock state."""
        bus = SwarmEventBus(2)
        memory = SwarmMemory(2)
        sm = SwarmStateMachine(2, event_bus=bus)

        sm.register_machine(0, "m0", "produce data")
        sm.register_machine(1, "m1", "consume data")
        sm.start(0)
        sm.start(1)

        # Machine 1 blocks
        sm.block(1, "dataset", "Need the dataset")
        assert sm.get(1).status == MachineStatus.BLOCKED

        async def machine_0_produces():
            await asyncio.sleep(0.1)
            memory.write("dataset", "rows of data", writer_index=0)

        async def machine_1_waits():
            result = await memory.wait_for_key("dataset", timeout=5.0)
            if result:
                sm.unblock(1)
            return result

        result, _ = await asyncio.gather(
            machine_1_waits(),
            machine_0_produces(),
        )

        assert result is not None
        assert sm.get(1).status == MachineStatus.RUNNING


class TestEventBusPriorityDrainSchedule:
    """Test that the event bus drain schedule works as designed for the step loop."""

    def test_critical_events_available_every_step(self):
        """CRITICAL events should be drainable at any step."""
        bus = SwarmEventBus(1)

        for step in range(1, 6):
            bus.publish_to_machine(0, EVT_NUDGE, {"step": step}, priority=EventPriority.CRITICAL)
            events = bus.drain_critical(0)
            assert len(events) == 1, f"Should get critical at step {step}"

    def test_normal_events_available_every_2_steps(self):
        """Simulating the CUA executor step loop drain schedule."""
        bus = SwarmEventBus(1)

        # Publish a bunch of events at different priorities
        bus.publish_to_machine(0, "test", {"p": "critical"}, priority=EventPriority.CRITICAL)
        bus.publish_to_machine(0, "test", {"p": "high"}, priority=EventPriority.HIGH)
        bus.publish_to_machine(0, "test", {"p": "normal"}, priority=EventPriority.NORMAL)
        bus.publish_to_machine(0, "test", {"p": "low"}, priority=EventPriority.LOW)

        # Step 1: drain CRITICAL+HIGH
        events = bus.drain_up_to_high(0)
        assert len(events) == 2
        assert events[0].data["p"] == "critical"
        assert events[1].data["p"] == "high"

        # Step 2: drain up to NORMAL
        events = bus.drain_up_to_normal(0)
        assert len(events) == 1
        assert events[0].data["p"] == "normal"

        # Step 5: drain all (LOW remaining)
        events = bus.drain_all(0)
        assert len(events) == 1
        assert events[0].data["p"] == "low"


class TestStateMachineTransitionChains:
    """Test complex state transition chains that happen in real swarm execution."""

    def test_full_lifecycle_happy_path(self):
        """PENDING → RUNNING → COMPLETED → IDLE → RUNNING (work steal) → COMPLETED."""
        sm = SwarmStateMachine(1)
        sm.register_machine(0, "m0", "original task")

        sm.start(0)
        assert sm.get(0).status == MachineStatus.RUNNING

        sm.complete(0)
        assert sm.get(0).status == MachineStatus.COMPLETED

        sm.go_idle(0)
        assert sm.get(0).status == MachineStatus.IDLE

        sm.assign_stolen_work(0, "new task", stolen_from=1)
        assert sm.get(0).status == MachineStatus.RUNNING
        assert sm.get(0).subtask == "new task"

        sm.complete(0)
        assert sm.get(0).status == MachineStatus.COMPLETED

    def test_help_lifecycle(self):
        """RUNNING → HELPING → RUNNING (resume) → COMPLETED."""
        sm = SwarmStateMachine(1)
        sm.register_machine(0, "m0", "my task")

        sm.start(0)
        sm.start_helping(0, target_machine=1, help_subtask="help task")
        assert sm.get(0).subtask == "help task"

        sm.resume_from_helping(0)
        assert sm.get(0).subtask == "my task"

        sm.complete(0)
        assert sm.get(0).status == MachineStatus.COMPLETED

    def test_blocked_lifecycle(self):
        """RUNNING → BLOCKED → RUNNING (unblocked) → COMPLETED."""
        sm = SwarmStateMachine(1)
        sm.register_machine(0, "m0", "task")

        sm.start(0)
        sm.block(0, "key", "waiting")
        assert sm.get(0).blocked_on == "key"

        sm.unblock(0)
        assert sm.get(0).blocked_on is None
        assert sm.get(0).status == MachineStatus.RUNNING

        sm.complete(0)

    def test_cancel_from_blocked(self):
        """RUNNING → BLOCKED → CANCELLED."""
        sm = SwarmStateMachine(1)
        sm.register_machine(0, "m0", "task")

        sm.start(0)
        sm.block(0, "key")
        sm.cancel(0)
        assert sm.get(0).is_terminal

    def test_fail_from_helping(self):
        """RUNNING → HELPING → FAILED."""
        sm = SwarmStateMachine(1)
        sm.register_machine(0, "m0", "task")

        sm.start(0)
        sm.start_helping(0, target_machine=1)
        sm.fail(0, "crash during help")
        assert sm.get(0).is_terminal


class TestCoordinatorRunLoop:
    """Test the coordinator's main run loop behavior."""

    @pytest.mark.asyncio
    async def test_coordinator_processes_events_during_run(self):
        """Coordinator should process events published during its run loop."""
        bus = SwarmEventBus(3)
        memory = SwarmMemory(3)
        sm = SwarmStateMachine(3, event_bus=bus)
        for i in range(3):
            sm.register_machine(i, f"m{i}", f"task {i}")
            sm.start(i)

        processed = []

        def mock_llm(sys, user):
            processed.append(user)
            return json.dumps({
                "helper": 1,
                "advice_to_helper": "help",
                "advice_to_requester": "wait",
            })

        coordinator = SwarmCoordinator(
            swarm_id="test",
            prompt="test",
            event_bus=bus,
            state_machine=sm,
            swarm_memory=memory,
            llm_call=mock_llm,
        )

        # Start coordinator
        task = asyncio.create_task(coordinator.run())

        # Publish a help request while coordinator is running
        await asyncio.sleep(0.1)
        bus.publish_broadcast(
            EVT_HELP_REQUEST,
            {"machine_index": 0, "description": "Need help"},
            source=0,
        )

        # Give coordinator time to process
        await asyncio.sleep(3.0)

        # Stop coordinator
        coordinator.stop()
        await asyncio.wait_for(task, timeout=5.0)

        # LLM should have been called
        assert len(processed) >= 1
