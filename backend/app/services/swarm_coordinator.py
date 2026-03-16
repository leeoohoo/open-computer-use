"""
Swarm Coordinator — Live LLM-based manager that monitors and intervenes.

Runs as an asyncio task alongside the worker machines. It:
1. Monitors all machines via the event bus (receives ALL events)
2. Runs periodic "standups" to detect issues and realign
3. Handles help requests by dispatching helpers
4. Detects stuck machines and nudges/reassigns
5. Resolves dependency blockers by directing capable machines
6. Handles proposals (shared decisions) for the team
7. Triggers work stealing when machines go idle

The coordinator does NOT have a VM — it's pure LLM reasoning on swarm state.
"""

import asyncio
import json
import logging
import re
import time
from typing import Any, Callable, Dict, List, Optional

from app.services.swarm_event_bus import (
    EVT_COORDINATOR_COMMAND,
    EVT_DECISION,
    EVT_DEPENDENCY_BLOCKED,
    EVT_DEPENDENCY_RESOLVED,
    EVT_DIRECTIVE,
    EVT_HELP_DISPATCH,
    EVT_HELP_REQUEST,
    EVT_MACHINE_COMPLETED,
    EVT_NARROW_SCOPE,
    EVT_NUDGE,
    EVT_PROPOSAL,
    EVT_WORK_STEAL,
    EventPriority,
    SwarmEvent,
    SwarmEventBus,
)
from app.services.swarm_state_machine import (
    MachineState,
    MachineStatus,
    SwarmStateMachine,
)

logger = logging.getLogger(__name__)

# How often the coordinator runs its standup loop (seconds)
STANDUP_INTERVAL = 30.0

# How long with no activity before a machine is considered stuck (seconds)
STUCK_THRESHOLD_NUDGE = 90.0    # First nudge
STUCK_THRESHOLD_REASSIGN = 180.0  # Escalate to reassignment

# Max time a machine can be blocked before coordinator intervenes
BLOCKED_ESCALATION_THRESHOLD = 60.0

# Coordinator LLM config
COORDINATOR_MAX_TOKENS = 2048
COORDINATOR_TEMPERATURE = 0.2


def _extract_json_from_response(text: str) -> Optional[Dict]:
    """Try to extract a JSON object from LLM response text."""
    # Try raw parse
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except (json.JSONDecodeError, TypeError):
        pass

    # Try markdown fence
    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if fence_match:
        try:
            parsed = json.loads(fence_match.group(1))
            if isinstance(parsed, dict):
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass

    # Try first { ... } block
    brace_match = re.search(r"\{.*\}", text, re.DOTALL)
    if brace_match:
        try:
            parsed = json.loads(brace_match.group(0))
            if isinstance(parsed, dict):
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass

    return None


class SwarmCoordinator:
    """Live coordinator that monitors and manages swarm execution.

    Usage:
        coordinator = SwarmCoordinator(
            swarm_id="...",
            prompt="user's original task",
            event_bus=bus,
            state_machine=sm,
            swarm_memory=memory,
            llm_call=some_bedrock_call_fn,
        )
        # Launch as asyncio task alongside workers:
        coord_task = asyncio.create_task(coordinator.run())
        # ... when done:
        coordinator.stop()
        await coord_task
    """

    def __init__(
        self,
        swarm_id: str,
        prompt: str,
        event_bus: SwarmEventBus,
        state_machine: SwarmStateMachine,
        swarm_memory: Any,  # SwarmMemory instance
        llm_call: Callable[[str, str], str],
        on_coordinator_event: Optional[Callable[[Dict[str, Any]], None]] = None,
    ):
        self.swarm_id = swarm_id
        self.prompt = prompt
        self.event_bus = event_bus
        self.state_machine = state_machine
        self.swarm_memory = swarm_memory
        self._llm_call = llm_call  # sync fn: (system_prompt, user_msg) -> str
        self._on_event = on_coordinator_event  # optional callback for SSE streaming

        self._stop_event = asyncio.Event()
        self._running = False

        # Track which machines we've already nudged (avoid spamming)
        self._nudged_machines: Dict[int, float] = {}
        # Track help requests already handled
        self._handled_help_requests: set = set()
        # Track proposals already decided
        self._handled_proposals: set = set()
        # Recent coordinator actions for context
        self._action_log: List[Dict[str, Any]] = []

    def stop(self) -> None:
        """Signal the coordinator to stop."""
        self._stop_event.set()

    @property
    def is_running(self) -> bool:
        return self._running

    # ──────────────────────────────────────────────────────────────────
    # Main loop
    # ──────────────────────────────────────────────────────────────────

    async def run(self) -> None:
        """Main coordinator loop. Run as an asyncio task."""
        self._running = True
        logger.info(f"Coordinator started for swarm {self.swarm_id}")

        last_standup = time.time()

        try:
            while not self._stop_event.is_set():
                # Process events from the coordinator queue
                await self._process_events()

                # Periodic standup check
                now = time.time()
                if now - last_standup >= STANDUP_INTERVAL:
                    await self._run_standup()
                    last_standup = now

                # Check for stuck machines between standups
                self._check_stuck_machines()

                # Short sleep to avoid tight-looping
                try:
                    await asyncio.wait_for(self._stop_event.wait(), timeout=2.0)
                    break  # stop event was set
                except asyncio.TimeoutError:
                    pass

        except asyncio.CancelledError:
            logger.info(f"Coordinator cancelled for swarm {self.swarm_id}")
        except Exception as e:
            logger.error(f"Coordinator error: {e}", exc_info=True)
        finally:
            self._running = False
            logger.info(f"Coordinator stopped for swarm {self.swarm_id}")

    # ──────────────────────────────────────────────────────────────────
    # Event processing
    # ──────────────────────────────────────────────────────────────────

    async def _process_events(self) -> None:
        """Drain and handle all pending events from the coordinator queue."""
        events = self.event_bus.coordinator_drain_all()

        for event in events:
            try:
                await self._handle_event(event)
            except Exception as e:
                logger.warning(f"Coordinator failed to handle event {event.event_type}: {e}")

    async def _handle_event(self, event: SwarmEvent) -> None:
        """Route an event to the appropriate handler."""
        etype = event.event_type

        if etype == EVT_HELP_REQUEST:
            await self._handle_help_request(event)
        elif etype == EVT_DEPENDENCY_BLOCKED:
            await self._handle_dependency_blocked(event)
        elif etype == EVT_MACHINE_COMPLETED:
            await self._handle_machine_completed(event)
        elif etype == EVT_PROPOSAL:
            await self._handle_proposal(event)
        # Other events are consumed for awareness but don't trigger action

    # ──────────────────────────────────────────────────────────────────
    # Help request handling
    # ──────────────────────────────────────────────────────────────────

    async def _handle_help_request(self, event: SwarmEvent) -> None:
        """Handle a help request from a struggling machine."""
        from_idx = event.data.get("machine_index", event.source)
        description = event.data.get("description", "")
        request_id = f"help-{from_idx}-{event.event_id}"

        if request_id in self._handled_help_requests:
            return
        self._handled_help_requests.add(request_id)

        logger.info(f"Coordinator handling help request from machine {from_idx}: {description}")

        # Find available helpers
        helpers = self.state_machine.available_helpers(exclude=from_idx)
        if not helpers:
            # No one to help — send encouragement back
            self._send_directive(
                from_idx,
                "No teammates are available to help right now. "
                "Try a different approach — look for alternative URLs, "
                "skip this step if possible, or work around the blocker."
            )
            return

        # Ask coordinator LLM which machine should help and how
        state_report = self.state_machine.status_report()
        shared_keys = self.swarm_memory.list_keys()
        shared_mem_str = ", ".join(f"{k['key']}={k['preview'][:50]}" for k in shared_keys) if shared_keys else "(empty)"

        user_msg = (
            f"HELP REQUEST from Machine {from_idx}:\n"
            f"  Problem: {description}\n\n"
            f"CURRENT STATE:\n{state_report}\n\n"
            f"SHARED MEMORY: {shared_mem_str}\n\n"
            f"Available helpers (sorted by progress): "
            f"{', '.join(f'Machine {h.index} (step {h.step_count})' for h in helpers)}\n\n"
            "Decide:\n"
            "1. Which machine should help? (pick the best candidate)\n"
            "2. What specific advice or action should the helper take?\n"
            "3. Should any other machine be notified?\n\n"
            "Return JSON: {\"helper\": <machine_index>, \"advice_to_helper\": \"...\", "
            "\"advice_to_requester\": \"...\", \"notify_others\": false}"
        )

        response = await self._call_llm("help_dispatch", user_msg)
        parsed = _extract_json_from_response(response)

        if parsed and "helper" in parsed:
            helper_idx = int(parsed["helper"])
            advice_to_helper = parsed.get("advice_to_helper", "Help your teammate.")
            advice_to_requester = parsed.get("advice_to_requester", "Help is on the way.")

            # Dispatch help
            self.event_bus.publish_to_machine(
                target=helper_idx,
                event_type=EVT_HELP_DISPATCH,
                data={
                    "help_target": from_idx,
                    "description": description,
                    "advice": advice_to_helper,
                },
                source=-1,
                priority=EventPriority.CRITICAL,
            )

            # Notify the requester
            self._send_directive(from_idx, advice_to_requester)

            self._log_action("help_dispatch", {
                "from": from_idx,
                "helper": helper_idx,
                "description": description,
            })
        else:
            # LLM couldn't decide — send generic advice
            self._send_directive(
                from_idx,
                f"Try a different approach. Suggestion: {response[:200]}"
            )

    # ──────────────────────────────────────────────────────────────────
    # Dependency blocked handling
    # ──────────────────────────────────────────────────────────────────

    async def _handle_dependency_blocked(self, event: SwarmEvent) -> None:
        """Handle a machine blocked on a dependency."""
        blocked_idx = event.data.get("machine_index", event.source)
        key = event.data.get("key", "")
        description = event.data.get("description", "")

        # Check if key already exists (race condition — might have been written)
        existing = self.swarm_memory.read(key)
        if existing:
            self.event_bus.publish_to_machine(
                target=blocked_idx,
                event_type=EVT_DEPENDENCY_RESOLVED,
                data={"key": key, "value": existing.get("value", "")},
                source=-1,
                priority=EventPriority.HIGH,
            )
            return

        # Find which machine is most likely to produce this key
        state_report = self.state_machine.status_report()

        user_msg = (
            f"Machine {blocked_idx} is BLOCKED waiting for shared memory key '{key}'.\n"
            f"Reason: {description}\n\n"
            f"CURRENT STATE:\n{state_report}\n\n"
            f"Which running machine is most likely to produce key '{key}'? "
            f"Send them a directive to prioritize writing this key.\n\n"
            "Return JSON: {{\"target_machine\": <index>, \"directive\": \"...\"}}"
        )

        response = await self._call_llm("dependency_resolution", user_msg)
        parsed = _extract_json_from_response(response)

        if parsed and "target_machine" in parsed:
            target = int(parsed["target_machine"])
            directive = parsed.get("directive", f"Machine {blocked_idx} needs key '{key}' — please write it to shared memory ASAP.")

            self._send_directive(target, directive)

            self._log_action("dependency_directive", {
                "blocked": blocked_idx,
                "key": key,
                "directed_to": target,
            })

    # ──────────────────────────────────────────────────────────────────
    # Machine completed → work stealing
    # ──────────────────────────────────────────────────────────────────

    async def _handle_machine_completed(self, event: SwarmEvent) -> None:
        """When a machine completes, check if it should steal work."""
        completed_idx = event.data.get("machine_index", event.source)

        # Find machines still running
        running = self.state_machine.get_by_status(MachineStatus.RUNNING)
        blocked = self.state_machine.get_by_status(MachineStatus.BLOCKED)
        active = running + blocked

        if not active:
            return  # Everyone's done or finishing

        # Ask coordinator LLM if work stealing makes sense
        state_report = self.state_machine.status_report()
        shared_keys = self.swarm_memory.list_keys()
        shared_mem_str = ", ".join(f"{k['key']}={k['preview'][:50]}" for k in shared_keys) if shared_keys else "(empty)"

        completed_state = self.state_machine.get(completed_idx)
        completed_task = completed_state.subtask if completed_state else "unknown"

        user_msg = (
            f"Machine {completed_idx} has COMPLETED its task: \"{completed_task}\"\n"
            f"It is now idle and available for more work.\n\n"
            f"CURRENT STATE:\n{state_report}\n\n"
            f"SHARED MEMORY: {shared_mem_str}\n\n"
            f"ORIGINAL GOAL: {self.prompt}\n\n"
            "Should the idle machine pick up additional work?\n"
            "Options:\n"
            "1. Split a struggling machine's remaining work\n"
            "2. Assign a supplementary task (verification, documentation, etc.)\n"
            "3. Do nothing — let it stay idle\n\n"
            "Return JSON: {\"action\": \"steal\"|\"supplement\"|\"idle\", "
            "\"target_machine\": <index or null>, \"new_subtask\": \"...\", "
            "\"narrow_existing\": \"...\" (new scope for target if splitting)}"
        )

        response = await self._call_llm("work_stealing", user_msg)
        parsed = _extract_json_from_response(response)

        if not parsed or parsed.get("action") == "idle":
            return

        action = parsed.get("action", "idle")
        new_subtask = parsed.get("new_subtask", "")
        target_machine = parsed.get("target_machine")

        if action == "steal" and target_machine is not None and new_subtask:
            # Assign stolen work to the idle machine
            self.event_bus.publish_to_machine(
                target=completed_idx,
                event_type=EVT_WORK_STEAL,
                data={
                    "new_subtask": new_subtask,
                    "stolen_from": int(target_machine),
                },
                source=-1,
                priority=EventPriority.CRITICAL,
            )

            # Narrow the target machine's scope
            narrow_task = parsed.get("narrow_existing", "")
            if narrow_task:
                self.event_bus.publish_to_machine(
                    target=int(target_machine),
                    event_type=EVT_NARROW_SCOPE,
                    data={"new_subtask": narrow_task, "reason": f"Machine {completed_idx} is picking up part of your work."},
                    source=-1,
                    priority=EventPriority.HIGH,
                )

            self._log_action("work_steal", {
                "idle_machine": completed_idx,
                "target_machine": target_machine,
                "new_subtask": new_subtask,
            })

        elif action == "supplement" and new_subtask:
            self.event_bus.publish_to_machine(
                target=completed_idx,
                event_type=EVT_WORK_STEAL,
                data={
                    "new_subtask": new_subtask,
                    "stolen_from": -1,  # supplementary, not stolen
                },
                source=-1,
                priority=EventPriority.CRITICAL,
            )

            self._log_action("supplement_task", {
                "machine": completed_idx,
                "subtask": new_subtask,
            })

    # ──────────────────────────────────────────────────────────────────
    # Proposal (shared decision) handling
    # ──────────────────────────────────────────────────────────────────

    async def _handle_proposal(self, event: SwarmEvent) -> None:
        """Handle a shared decision proposal."""
        from_idx = event.source
        question = event.data.get("question", "")
        options = event.data.get("options", "")
        proposal_id = f"proposal-{from_idx}-{question[:30]}"

        if proposal_id in self._handled_proposals:
            return
        self._handled_proposals.add(proposal_id)

        state_report = self.state_machine.status_report()

        user_msg = (
            f"Machine {from_idx} is asking the team to decide:\n"
            f"  Question: {question}\n"
            f"  Options: {options}\n\n"
            f"CURRENT STATE:\n{state_report}\n\n"
            f"GOAL: {self.prompt}\n\n"
            "Make the best decision for the team. Consider what's already in progress.\n"
            "Return JSON: {{\"decision\": \"...\", \"reasoning\": \"...\"}}"
        )

        response = await self._call_llm("decision", user_msg)
        parsed = _extract_json_from_response(response)

        decision = parsed.get("decision", response[:200]) if parsed else response[:200]
        reasoning = parsed.get("reasoning", "") if parsed else ""

        # Store decision in shared memory
        decision_key = f"decision:{question[:50]}"
        self.swarm_memory.write(decision_key, decision, writer_index=-1)

        # Broadcast to all machines
        self.event_bus.publish_broadcast(
            event_type=EVT_DECISION,
            data={
                "question": question,
                "decision": decision,
                "reasoning": reasoning,
                "decided_by": "coordinator",
            },
            source=-1,
            priority=EventPriority.HIGH,
        )

        self._log_action("decision", {
            "question": question,
            "decision": decision,
        })

    # ──────────────────────────────────────────────────────────────────
    # Periodic standup
    # ──────────────────────────────────────────────────────────────────

    async def _run_standup(self) -> None:
        """Periodic coordinator check — detect issues and realign the team."""
        # Don't run standup if all machines are done
        if self.state_machine.all_terminal():
            return

        state_report = self.state_machine.status_report()
        shared_keys = self.swarm_memory.list_keys()
        shared_mem_str = ", ".join(f"{k['key']}={k['preview'][:50]}" for k in shared_keys) if shared_keys else "(empty)"

        recent_actions = ""
        if self._action_log:
            recent = self._action_log[-5:]
            recent_actions = "\n".join(
                f"  - {a['type']}: {json.dumps({k: v for k, v in a.items() if k != 'type'})}"
                for a in recent
            )

        user_msg = (
            f"STANDUP CHECK — periodic sync for swarm {self.swarm_id}\n\n"
            f"GOAL: {self.prompt}\n\n"
            f"CURRENT STATE:\n{state_report}\n\n"
            f"SHARED MEMORY: {shared_mem_str}\n\n"
        )

        if recent_actions:
            user_msg += f"RECENT COORDINATOR ACTIONS:\n{recent_actions}\n\n"

        user_msg += (
            "Questions to answer:\n"
            "1. Is any machine stuck or making no progress?\n"
            "2. Is any machine doing duplicate work with another?\n"
            "3. Should any tasks be reassigned or reprioritized?\n"
            "4. Are there unresolved dependencies or blockers?\n"
            "5. Should the overall approach change based on findings so far?\n\n"
            "If everything looks good, return: {\"actions\": []}\n"
            "Otherwise return: {\"actions\": [{\"type\": \"directive\"|\"reassign\"|\"nudge\", "
            "\"target\": <machine_index>, \"message\": \"...\"}]}"
        )

        response = await self._call_llm("standup", user_msg)
        parsed = _extract_json_from_response(response)

        if not parsed:
            return

        actions = parsed.get("actions", [])
        if not isinstance(actions, list):
            return

        for action in actions:
            action_type = action.get("type", "")
            target = action.get("target")
            message = action.get("message", "")

            if target is None:
                continue

            target = int(target)

            if action_type == "directive":
                self._send_directive(target, message)
            elif action_type == "nudge":
                self._send_nudge(target, message)
            elif action_type == "reassign":
                new_task = action.get("new_subtask", message)
                self.event_bus.publish_to_machine(
                    target=target,
                    event_type=EVT_COORDINATOR_COMMAND,
                    data={"command": "reassign", "new_subtask": new_task, "reason": message},
                    source=-1,
                    priority=EventPriority.CRITICAL,
                )

            self._log_action(f"standup_{action_type}", {
                "target": target,
                "message": message[:100],
            })

    # ──────────────────────────────────────────────────────────────────
    # Stuck machine detection (non-LLM, runs between standups)
    # ──────────────────────────────────────────────────────────────────

    def _check_stuck_machines(self) -> None:
        """Detect machines with no recent activity and nudge them."""
        stuck = self.state_machine.stuck_machines(stale_seconds=STUCK_THRESHOLD_NUDGE)
        now = time.time()

        for machine in stuck:
            last_nudge = self._nudged_machines.get(machine.index, 0)
            if now - last_nudge < STUCK_THRESHOLD_NUDGE:
                continue  # Already nudged recently

            staleness = machine.seconds_since_activity

            if staleness >= STUCK_THRESHOLD_REASSIGN:
                # Escalated — mark as needing attention at next standup
                self._send_nudge(
                    machine.index,
                    f"You haven't made progress for {staleness:.0f}s. "
                    "The coordinator may reassign your work if you don't respond. "
                    "Try a completely different approach, or call agent.request_help() "
                    "if you're stuck."
                )
            else:
                # First nudge
                self._send_nudge(
                    machine.index,
                    f"You haven't made progress for {staleness:.0f}s. "
                    "Are you stuck? Try a different approach or ask for help."
                )

            self._nudged_machines[machine.index] = now

        # Also check long-blocked machines
        for machine in self.state_machine.blocked_machines():
            if machine.blocked_duration > BLOCKED_ESCALATION_THRESHOLD:
                last_nudge = self._nudged_machines.get(machine.index, 0)
                if now - last_nudge < BLOCKED_ESCALATION_THRESHOLD:
                    continue
                self._nudged_machines[machine.index] = now
                # This will be handled more thoroughly in the next standup

    # ──────────────────────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────────────────────

    def _send_directive(self, target: int, message: str) -> None:
        """Send a directive to a specific machine."""
        self.event_bus.publish_to_machine(
            target=target,
            event_type=EVT_DIRECTIVE,
            data={"message": message},
            source=-1,
            priority=EventPriority.HIGH,
        )

    def _send_nudge(self, target: int, message: str) -> None:
        """Send a nudge to a stuck machine."""
        self.event_bus.publish_to_machine(
            target=target,
            event_type=EVT_NUDGE,
            data={"message": message},
            source=-1,
            priority=EventPriority.CRITICAL,
        )

    async def _call_llm(self, context: str, user_message: str) -> str:
        """Call the coordinator LLM. Runs sync fn in thread."""
        system_prompt = (
            "You are the coordinator of a multi-machine swarm. "
            "Your job is to keep the team aligned, unblock stuck machines, "
            "route help requests, and make strategic decisions.\n\n"
            "Rules:\n"
            "- Be decisive — pick the best option and commit\n"
            "- Keep messages concise — agents are working, don't distract them\n"
            "- Only intervene when there's a clear problem or opportunity\n"
            "- Always return valid JSON as specified in the request\n"
            "- Machine indices are 0-based\n"
        )

        try:
            result = await asyncio.to_thread(self._llm_call, system_prompt, user_message)
            return result
        except Exception as e:
            logger.error(f"Coordinator LLM call failed ({context}): {e}")
            return "{}"

    def _log_action(self, action_type: str, details: Dict[str, Any]) -> None:
        """Record a coordinator action for context."""
        entry = {"type": action_type, "timestamp": time.time(), **details}
        self._action_log.append(entry)
        # Keep last 20 actions
        if len(self._action_log) > 20:
            self._action_log = self._action_log[-20:]

        # Notify SSE stream if callback provided
        if self._on_event:
            try:
                self._on_event({
                    "type": "coordinator_action",
                    "swarm_id": self.swarm_id,
                    "action": action_type,
                    "details": details,
                })
            except Exception:
                pass
