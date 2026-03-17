"""
Swarm Executor — decomposes a prompt into subtasks and runs them across
multiple machines in parallel with shared memory, message passing,
a live coordinator, event bus, and formal state machine.

1. LLM decomposes user prompt into N subtasks (one per machine)
2. Each machine gets its own CUAExecutor with a unique subtask
3. Machines share an in-memory SwarmMemory for key-value storage and messaging
4. A live SwarmCoordinator monitors, dispatches help, and steals work
5. A priority-based SwarmEventBus routes events reactively
6. A SwarmStateMachine tracks formal states for each machine
7. After all machines finish, LLM aggregates results into a summary
"""

import asyncio
import json
import logging
import re
import time
import uuid
from typing import Any, AsyncGenerator, Dict, List, Optional

from app.core.config import settings
from app.services.cua_executor import CUAExecutor
from app.services.swarm_coordinator import SwarmCoordinator
from app.services.swarm_event_bus import (
    EVT_MACHINE_COMPLETED,
    EVT_PEER_ACTIVITY,
    EventPriority,
    SwarmEvent,
    SwarmEventBus,
)
from app.services.swarm_memory import SwarmMemory
from app.services.swarm_state_machine import (
    MachineStatus,
    SwarmStateMachine,
)
from app.services.vm_control import vm_control_service

logger = logging.getLogger(__name__)

# Global registry of active swarms so we can stop them externally.
# Safe for asyncio — all access is from the event loop thread.
_active_swarms: Dict[str, "SwarmExecutor"] = {}

# Model used for task decomposition and result aggregation.
# Uses a fast model to keep planning/aggregation quick.
_PLANNER_MODEL = settings.BEDROCK_DEFAULT_MODEL


def get_active_swarm(swarm_id: str) -> Optional["SwarmExecutor"]:
    return _active_swarms.get(swarm_id)


def _extract_json_array(text: str) -> Optional[List[str]]:
    """Extract a JSON array of strings from LLM output (handles markdown fences)."""
    # Try raw parse first
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list) and all(isinstance(s, str) for s in parsed):
            return parsed
    except (json.JSONDecodeError, TypeError):
        pass

    # Try extracting from markdown code fence
    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?\s*```", text, re.DOTALL)
    if fence_match:
        try:
            parsed = json.loads(fence_match.group(1))
            if isinstance(parsed, list) and all(isinstance(s, str) for s in parsed):
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass

    # Try finding first [ ... ] block
    bracket_match = re.search(r"\[.*\]", text, re.DOTALL)
    if bracket_match:
        try:
            parsed = json.loads(bracket_match.group(0))
            if isinstance(parsed, list) and all(isinstance(s, str) for s in parsed):
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass

    return None


class SwarmExecutor:
    """Orchestrates parallel CUA execution across N machines with task decomposition,
    a live coordinator, event bus, and formal state machine."""

    def __init__(
        self,
        swarm_id: str,
        machines: List[Dict[str, Any]],
        prompt: str,
        provider: Any,
        model: str,
        user_id: str = "",
        temperature: float = 1.0,
        max_steps: int = 200,
    ):
        self.swarm_id = swarm_id
        self.machines = machines
        self.prompt = prompt
        self.provider = provider
        self.model = model
        self.user_id = user_id
        self.temperature = temperature
        self.max_steps = max_steps

        self._cancel_event = asyncio.Event()
        self._pause_event = asyncio.Event()   # When set, machines are paused
        self._resume_event = asyncio.Event()  # When set, machines resume
        self._resume_event.set()  # Start in "not paused" state
        self._machine_statuses: Dict[str, str] = {
            m["machine_id"]: "pending" for m in machines
        }

        n = len(machines)

        # Swarm-level shared memory (ephemeral, in-memory)
        self.swarm_memory = SwarmMemory(n)

        # Priority-based event bus
        self.event_bus = SwarmEventBus(n)

        # Formal state machine for all machines
        self.state_machine = SwarmStateMachine(n, event_bus=self.event_bus)

        # Live coordinator (initialized after decomposition)
        self.coordinator: Optional[SwarmCoordinator] = None
        self._coordinator_task: Optional[asyncio.Task] = None

        # Per-machine subtasks (populated by _decompose_task)
        self._subtasks: List[str] = []

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def request_cancellation(self) -> None:
        """Signal all machines to stop."""
        self._cancel_event.set()
        # If paused, resume so machines can exit cleanly
        self._resume_event.set()
        self._pause_event.clear()
        if self.coordinator:
            self.coordinator.stop()
        for m in self.machines:
            evt = vm_control_service.get_cancellation_event(m["machine_id"])
            evt.set()

    def pause(self) -> bool:
        """Pause all machines. Returns True if state changed."""
        if self._pause_event.is_set() or self._cancel_event.is_set():
            return False
        self._pause_event.set()
        self._resume_event.clear()
        logger.info(f"Swarm {self.swarm_id}: paused")
        return True

    def resume(self) -> bool:
        """Resume all paused machines. Returns True if state changed."""
        if not self._pause_event.is_set():
            return False
        self._pause_event.clear()
        self._resume_event.set()
        logger.info(f"Swarm {self.swarm_id}: resumed")
        return True

    @property
    def is_paused(self) -> bool:
        return self._pause_event.is_set()

    async def stream_execution(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Run all machines in parallel and yield interleaved chunks.

        Yields dicts with at least:
            - ``swarm_id``
            - ``machine_id`` / ``machine_index`` (per-machine chunks)
            - ``type``  (text | tool_call | tool_result | reasoning | error |
                         step_complete | finish | swarm_meta | swarm_planning |
                         swarm_summary | coordinator_action)
        """
        _active_swarms[self.swarm_id] = self

        # Emit initial swarm metadata
        yield {
            "type": "swarm_meta",
            "swarm_id": self.swarm_id,
            "machine_count": len(self.machines),
            "machines": [
                {"machine_id": m["machine_id"], "index": i}
                for i, m in enumerate(self.machines)
            ],
            "status": "starting",
        }

        cancelled = False

        # Queue for coordinator events to be streamed to the frontend
        coordinator_events_queue: asyncio.Queue[Dict[str, Any]] = asyncio.Queue()

        def _on_coordinator_event(event_dict: Dict[str, Any]) -> None:
            """Callback for coordinator to push events into the SSE stream."""
            try:
                coordinator_events_queue.put_nowait(event_dict)
            except asyncio.QueueFull:
                pass

        try:
            # ── Phase 1: Task decomposition ──
            yield {
                "type": "swarm_planning",
                "swarm_id": self.swarm_id,
                "status": "decomposing",
            }

            self._subtasks = await self._decompose_task()

            # Register subtasks in shared memory so all machines can see the full plan
            self.swarm_memory.set_subtasks({
                i: self._subtasks[i] for i in range(len(self._subtasks))
            })

            # Register machines in the state machine
            for idx, machine in enumerate(self.machines):
                subtask = self._subtasks[idx] if idx < len(self._subtasks) else self.prompt
                self.state_machine.register_machine(
                    index=idx,
                    machine_id=machine["machine_id"],
                    subtask=subtask,
                )

            yield {
                "type": "swarm_planning",
                "swarm_id": self.swarm_id,
                "status": "planned",
                "subtasks": [
                    {
                        "machine_index": i,
                        "machine_id": self.machines[i]["machine_id"],
                        "subtask": self._subtasks[i],
                    }
                    for i in range(len(self.machines))
                ],
            }

            # ── Start Coordinator ──
            self.coordinator = SwarmCoordinator(
                swarm_id=self.swarm_id,
                prompt=self.prompt,
                event_bus=self.event_bus,
                state_machine=self.state_machine,
                swarm_memory=self.swarm_memory,
                llm_call=self._call_bedrock_converse,
                on_coordinator_event=_on_coordinator_event,
            )
            self._coordinator_task = asyncio.create_task(
                self.coordinator.run(),
                name=f"swarm-{self.swarm_id}-coordinator",
            )

            # ── Phase 2: Parallel execution ──
            queue: asyncio.Queue[Optional[Dict[str, Any]]] = asyncio.Queue()
            tasks = []

            for idx, machine in enumerate(self.machines):
                t = asyncio.create_task(
                    self._run_single_machine(idx, machine, queue),
                    name=f"swarm-{self.swarm_id}-machine-{idx}",
                )
                tasks.append(t)

            finished_count = 0
            total = len(self.machines)
            _was_paused = False  # Track pause state changes for SSE emission

            while finished_count < total:
                if self._cancel_event.is_set():
                    logger.info(f"Swarm {self.swarm_id} cancelled — stopping tasks")
                    cancelled = True
                    for t in tasks:
                        if not t.done():
                            t.cancel()
                    yield {
                        "type": "swarm_meta",
                        "swarm_id": self.swarm_id,
                        "status": "cancelled",
                    }
                    break

                # Emit pause/resume transitions
                if self._pause_event.is_set() and not _was_paused:
                    _was_paused = True
                    yield {
                        "type": "swarm_meta",
                        "swarm_id": self.swarm_id,
                        "status": "paused",
                    }
                elif not self._pause_event.is_set() and _was_paused:
                    _was_paused = False
                    yield {
                        "type": "swarm_meta",
                        "swarm_id": self.swarm_id,
                        "status": "running",
                    }

                try:
                    chunk = await asyncio.wait_for(queue.get(), timeout=2.0)
                except asyncio.TimeoutError:
                    # Drain coordinator events during timeout
                    while not coordinator_events_queue.empty():
                        try:
                            coord_evt = coordinator_events_queue.get_nowait()
                            coord_evt["swarm_id"] = self.swarm_id
                            yield coord_evt
                        except asyncio.QueueEmpty:
                            break
                    yield {
                        "type": "keepalive",
                        "swarm_id": self.swarm_id,
                        "timestamp": time.time(),
                    }
                    continue

                if chunk is None:
                    finished_count += 1
                    continue

                yield chunk

                # Also drain any pending coordinator events
                while not coordinator_events_queue.empty():
                    try:
                        coord_evt = coordinator_events_queue.get_nowait()
                        coord_evt["swarm_id"] = self.swarm_id
                        yield coord_evt
                    except asyncio.QueueEmpty:
                        break

            await asyncio.gather(*tasks, return_exceptions=True)

            # Drain remaining items
            while not queue.empty():
                try:
                    leftover = queue.get_nowait()
                    if leftover is not None:
                        yield leftover
                except asyncio.QueueEmpty:
                    break

            # Stop coordinator
            if self.coordinator:
                self.coordinator.stop()
            if self._coordinator_task and not self._coordinator_task.done():
                try:
                    await asyncio.wait_for(self._coordinator_task, timeout=5.0)
                except (asyncio.TimeoutError, asyncio.CancelledError):
                    self._coordinator_task.cancel()

            # ── Phase 3: Result aggregation ──
            if not cancelled:
                yield {
                    "type": "swarm_meta",
                    "swarm_id": self.swarm_id,
                    "status": "aggregating",
                }

                summary = await self._aggregate_results()

                yield {
                    "type": "swarm_summary",
                    "swarm_id": self.swarm_id,
                    "summary": summary,
                    "machine_statuses": dict(self._machine_statuses),
                    "subtasks": list(self._subtasks),
                }

                yield {
                    "type": "swarm_meta",
                    "swarm_id": self.swarm_id,
                    "status": "completed",
                    "machine_statuses": dict(self._machine_statuses),
                }

        except Exception as e:
            logger.error(f"Swarm {self.swarm_id} error: {e}", exc_info=True)
            yield {
                "type": "error",
                "swarm_id": self.swarm_id,
                "error": str(e),
            }
        finally:
            # Ensure coordinator is stopped
            if self.coordinator:
                self.coordinator.stop()
            if self._coordinator_task and not self._coordinator_task.done():
                self._coordinator_task.cancel()
            _active_swarms.pop(self.swarm_id, None)

    # ------------------------------------------------------------------
    # Task decomposition (Phase 1)
    # ------------------------------------------------------------------

    async def _decompose_task(self) -> List[str]:
        """Use LLM to break user prompt into N independent subtasks.

        Falls back to giving every machine the original prompt if
        decomposition fails.
        """
        n = len(self.machines)

        # Single machine — no decomposition needed
        if n == 1:
            return [self.prompt]

        system_prompt = (
            "You are a task decomposition planner for a multi-agent swarm system. "
            "Given a user's task and a number of available machines, break the task "
            "into exactly that many independent subtasks that can run in parallel.\n\n"
            "Rules:\n"
            "- Each subtask must be a plain, human-readable instruction describing what to do on the computer's desktop\n"
            "- Write subtasks as GUI actions (e.g. 'Open Google Chrome and search for X', 'Navigate to Y website and extract Z')\n"
            "- Do NOT include any API calls, function names, or code references in the subtask text\n"
            "- Do NOT mention shared_memory, swarm_messages, or any internal coordination APIs — "
            "those are handled automatically by the system\n"
            "- Each subtask must be self-contained and actionable on its own computer\n"
            "- Include all necessary context in each subtask\n"
            "- Subtasks should divide the work efficiently (not duplicate it)\n"
            "- If the task naturally has fewer parts than machines, assign supplementary "
            "tasks (verification, documentation, alternative approaches)\n\n"
            f"Return ONLY a JSON array of exactly {n} strings. No other text."
        )

        user_message = (
            f"Task: {self.prompt}\n\n"
            f"Number of machines: {n}\n\n"
            f"Machine display names: {', '.join(m.get('display_name', f'machine_{i}') for i, m in enumerate(self.machines))}\n\n"
            "Decompose this into exactly {n} parallel subtasks. Return a JSON array of {n} strings."
        ).format(n=n)

        try:
            subtasks = await asyncio.to_thread(
                self._call_bedrock_converse, system_prompt, user_message
            )
            parsed = _extract_json_array(subtasks)
            if parsed and len(parsed) == n:
                logger.info(f"Swarm {self.swarm_id}: decomposed into {n} subtasks")
                return parsed
            elif parsed:
                # Wrong count — pad or trim
                logger.warning(
                    f"Swarm {self.swarm_id}: got {len(parsed)} subtasks, expected {n}"
                )
                while len(parsed) < n:
                    parsed.append(self.prompt)
                return parsed[:n]
            else:
                logger.warning(
                    f"Swarm {self.swarm_id}: failed to parse subtasks, using original prompt"
                )
                return [self.prompt] * n

        except Exception as e:
            logger.error(
                f"Swarm {self.swarm_id}: task decomposition failed: {e}",
                exc_info=True,
            )
            return [self.prompt] * n

    # ------------------------------------------------------------------
    # Result aggregation (Phase 3)
    # ------------------------------------------------------------------

    async def _aggregate_results(self) -> str:
        """Use LLM to synthesize a summary from all machine results."""
        results = self.swarm_memory.get_all_results()

        if not results:
            return "No results were produced by any machine."

        system_prompt = (
            "You are a results aggregator for a multi-agent swarm system. "
            "Multiple machines worked on subtasks of a larger goal in parallel. "
            "Synthesize their results into a clear, well-structured markdown summary.\n\n"
            "Format rules:\n"
            "- Start with a one-line **Overview** that captures the outcome in a sentence\n"
            "- Use a ## heading for each machine's contribution (e.g. '## Machine 1 — <subtask>')\n"
            "- Under each machine heading, use bullet points for key findings\n"
            "- End with a ## Conclusion section that synthesizes the overall result\n"
            "- If any machine failed or had issues, note it clearly with a > blockquote\n"
            "- Use **bold** for important values, `code` for technical terms\n"
            "- Keep the summary concise — no fluff, just findings and conclusions\n"
            "- Do NOT use h1 (#) headings — start at h2 (##)"
        )

        results_text = []
        for idx in range(len(self.machines)):
            subtask = self._subtasks[idx] if idx < len(self._subtasks) else "Unknown"
            result = results.get(idx, "No result (machine may have failed)")
            status = self._machine_statuses.get(
                self.machines[idx]["machine_id"], "unknown"
            )
            name = self.machines[idx].get("display_name", f"machine_{idx}")
            results_text.append(
                f"--- Machine {idx} ({name}) [status: {status}] ---\n"
                f"Subtask: {subtask}\n"
                f"Result: {result}\n"
            )

        # Include shared memory state
        shared_keys = self.swarm_memory.list_keys()
        shared_mem_text = ""
        if shared_keys:
            shared_mem_text = "\n--- Shared Memory State ---\n"
            for entry in shared_keys:
                shared_mem_text += f"  {entry['key']}: {entry['preview']}\n"

        user_message = (
            f"Original task: {self.prompt}\n\n"
            f"{''.join(results_text)}"
            f"{shared_mem_text}\n"
            "Provide a unified summary of the swarm execution results."
        )

        try:
            summary = await asyncio.to_thread(
                self._call_bedrock_converse, system_prompt, user_message
            )
            logger.info(f"Swarm {self.swarm_id}: aggregation complete")
            return summary
        except Exception as e:
            logger.error(
                f"Swarm {self.swarm_id}: result aggregation failed: {e}",
                exc_info=True,
            )
            # Fallback: concatenate raw results
            return "Aggregation failed. Raw results:\n" + "\n".join(results_text)

    # ------------------------------------------------------------------
    # Bedrock converse helper
    # ------------------------------------------------------------------

    def _call_bedrock_converse(self, system_prompt: str, user_message: str) -> str:
        """Call Bedrock converse API synchronously (run via asyncio.to_thread).

        Uses the already-initialized provider.client (boto3 bedrock-runtime).
        """
        if not self.provider.client:
            raise RuntimeError("BedrockProvider client not initialized")

        response = self.provider.client.converse(
            modelId=_PLANNER_MODEL,
            messages=[
                {"role": "user", "content": [{"text": user_message}]},
            ],
            system=[{"text": system_prompt}],
            inferenceConfig={"maxTokens": 4096, "temperature": 0.3},
        )

        return response["output"]["message"]["content"][0]["text"]

    # ------------------------------------------------------------------
    # Per-machine execution (Phase 2)
    # ------------------------------------------------------------------

    async def _run_single_machine(
        self,
        index: int,
        machine: Dict[str, Any],
        queue: asyncio.Queue,
    ) -> None:
        """Execute CUA on one machine and push labeled chunks into *queue*."""
        machine_id = machine["machine_id"]
        connection_info = machine["connection_info"]
        execution_lock = None

        # Get this machine's subtask
        subtask = (
            self._subtasks[index]
            if index < len(self._subtasks)
            else self.prompt
        )

        # Transition state machine: PENDING → RUNNING
        try:
            self.state_machine.start(index)
        except Exception as e:
            logger.warning(f"State machine start failed for machine {index}: {e}")

        self._machine_statuses[machine_id] = "running"

        # Notify that this machine started (include its subtask)
        await queue.put({
            "type": "swarm_machine_status",
            "swarm_id": self.swarm_id,
            "machine_id": machine_id,
            "machine_index": index,
            "status": "running",
            "subtask": subtask,
        })

        accumulated_content = ""

        try:
            # Acquire execution lock
            execution_lock = vm_control_service.get_execution_lock(machine_id)
            try:
                await asyncio.wait_for(execution_lock.acquire(), timeout=5.0)
            except asyncio.TimeoutError:
                raise RuntimeError(f"Machine {machine_id} is busy (could not acquire lock)")

            vm_control_service.reset_cancellation(machine_id)

            # Connect to VM agent
            if not connection_info.get("is_electron"):
                public_ip = connection_info["public_ip"]
                default_port = 8081 if public_ip == "localhost" else 8080
                agent_port = connection_info.get("agent_port", default_port)
                await vm_control_service.connect_to_agent(
                    machine_id,
                    public_ip,
                    agent_port,
                    connection_info.get("session_id"),
                    connection_info.get("user_id"),
                    connection_info.get("vnc_password"),
                )

            # Wait until the VM screen is actually ready (not black/blank).
            # Freshly created EC2 machines may still be booting when the swarm
            # starts; a black screenshot causes the agent to fall back to the
            # code agent instead of using the desktop.
            max_screen_checks = 10
            screen_ready = False
            for check_idx in range(max_screen_checks):
                try:
                    result = await vm_control_service.execute_command(
                        machine_id, "screenshot", {}
                    )
                    if result and result.get("screenshot"):
                        import base64
                        from io import BytesIO
                        from PIL import Image

                        screenshot_b64 = result["screenshot"]
                        if "," in screenshot_b64:
                            screenshot_b64 = screenshot_b64.split(",", 1)[1]
                        raw_bytes = base64.b64decode(screenshot_b64)
                        image = Image.open(BytesIO(raw_bytes))
                        # Check if the image is mostly black/blank
                        small = image.resize((32, 32)).convert("L")
                        pixels = list(small.getdata())
                        avg_brightness = sum(pixels) / len(pixels)
                        if avg_brightness > 15:  # Not a black screen
                            screen_ready = True
                            logger.info(
                                f"Swarm machine {index} ({machine_id}): screen ready "
                                f"(brightness={avg_brightness:.1f}, check {check_idx + 1})"
                            )
                            break
                        else:
                            logger.info(
                                f"Swarm machine {index} ({machine_id}): screen still dark "
                                f"(brightness={avg_brightness:.1f}), waiting... "
                                f"({check_idx + 1}/{max_screen_checks})"
                            )
                    else:
                        logger.info(
                            f"Swarm machine {index} ({machine_id}): no screenshot yet, waiting... "
                            f"({check_idx + 1}/{max_screen_checks})"
                        )
                except Exception as e:
                    logger.warning(
                        f"Swarm machine {index} ({machine_id}): screenshot check failed: {e}, "
                        f"waiting... ({check_idx + 1}/{max_screen_checks})"
                    )

                if check_idx < max_screen_checks - 1:
                    await asyncio.sleep(5)

            if not screen_ready:
                logger.warning(
                    f"Swarm machine {index} ({machine_id}): screen not ready after "
                    f"{max_screen_checks} checks, proceeding anyway"
                )

            # Build context that tells the agent about swarm coordination
            # Include the FULL team plan so each machine knows what everyone is doing
            all_subtasks = self.swarm_memory.get_all_subtasks()
            team_plan_lines = []
            for si, st in sorted(all_subtasks.items()):
                marker = " <-- YOU" if si == index else ""
                team_plan_lines.append(f"  Machine {si}: {st}{marker}")
            team_plan = "\n".join(team_plan_lines)

            # Separate the subtask (user_request) from coordination info (context)
            # so that TASK_DESCRIPTION in the worker system prompt only contains
            # the actual subtask — not the full swarm coordination blob.
            swarm_coordination_context = (
                f"You are Machine {index} in a {len(self.machines)}-machine swarm working together on a shared goal.\n\n"
                f"OVERALL GOAL: {self.prompt}\n\n"
                f"TEAM PLAN (all machines):\n{team_plan}\n\n"
                f"COORDINATION:\n"
                f"- Your teammates' recent progress will be automatically shown to you as [TEAM UPDATE] notes.\n"
                f"  Use these to stay aware of what others have found — adapt your approach if relevant.\n"
                f"- The coordinator is watching the team and will send you [COORDINATOR] messages if you need to change approach.\n\n"
                f"SWARM TOOLS (these are built-in agent tools you call directly — they are NOT code/scripts):\n"
                f"- agent.write_shared_memory(key, value) — write a value to the shared key-value store (e.g. URLs, findings, config)\n"
                f"- agent.read_shared_memory(key) — read a value from the shared key-value store\n"
                f"- agent.send_swarm_message(machine_index, message) — send a direct message to a specific teammate\n"
                f"- agent.broadcast_swarm_message(message) — announce something important to all teammates\n"
                f"- agent.read_swarm_messages() — check for direct messages from teammates\n"
                f"- agent.request_help(description) — ask the coordinator for help when you're stuck\n"
                f"- agent.wait_for_dependency(key, description) — block until a shared memory key is available\n"
                f"- agent.claim_expertise(domain) — declare yourself the expert in a domain\n"
                f"- agent.propose_decision(question, options) — propose a team-wide decision\n"
                f"- agent.resume_own_task() — resume your own task after helping a teammate\n\n"
                f"CREDENTIAL TOOLS (for logging into websites):\n"
                f"- agent.lookup_credential(service) — look up stored credentials for a service (e.g. 'gmail.com'). "
                f"Credentials are cached server-side and never shown to you directly.\n"
                f"- agent.fill_credential_field(service, field) — type a stored credential into the currently focused input field. "
                f"First click the input field, then call this. Fields: 'username', 'password', 'email', etc.\n"
                f"  Example flow: agent.lookup_credential('gmail.com') → click username field → "
                f"agent.fill_credential_field('gmail.com', 'username') → click password field → "
                f"agent.fill_credential_field('gmail.com', 'password')\n\n"
                f"TIPS:\n"
                f"- Write important findings to shared memory early so teammates can use them.\n"
                f"- If you find something that changes the overall approach, broadcast it.\n"
                f"- Check shared memory before doing work that a teammate may have already done.\n"
                f"- If you're stuck, call agent.request_help() — the coordinator will dispatch a helper.\n"
                f"- If you need data another machine is producing, use agent.wait_for_dependency()."
            )

            # Extract email identity if the frontend provisioned a WorkMail mailbox
            email_identity = machine.get("email_identity")  # {email, password} or None

            # Add email tools to coordination context if email identity is available
            if email_identity:
                email_section = (
                    f"\n\nEMAIL TOOLS (you have your own email address for this session):\n"
                    f"- Your email: {email_identity['email']}\n"
                    f"- agent.get_my_email_address() — returns your email address\n"
                    f"- agent.check_my_email() — read your inbox (recent messages)\n"
                    f"- agent.wait_for_verification_email(from_hint) — wait for a verification email and auto-extract codes/links\n"
                    f"  Example: agent.wait_for_verification_email('noreply@github.com')\n"
                    f"  Example: agent.wait_for_verification_email('verify@example.com', 60)\n"
                    f"- agent.send_email(to, subject, body) — send an email from your mailbox\n"
                    f"  Example: agent.send_email('user@example.com', 'Report', 'Here are the results...')\n\n"
                    f"EMAIL TIPS:\n"
                    f"- When signing up for services, use your email ({email_identity['email']}) instead of asking the user.\n"
                    f"- After submitting a signup form, call agent.wait_for_verification_email() to get the confirmation code.\n"
                    f"- You can type your email directly into form fields — no need to use fill_credential_field for your own email.\n"
                    f"- Your teammates also have their own email addresses — check shared memory for machine_N_email keys."
                )
                swarm_coordination_context += email_section

            # Store email address in swarm memory so teammates can discover it
            if email_identity:
                self.swarm_memory.write(
                    f"machine_{index}_email",
                    email_identity["email"],
                    writer_index=index,
                )

            executor = CUAExecutor(
                machine_id=machine_id,
                connection_info=connection_info,
                provider=self.provider,
                model=self.model,
                temperature=self.temperature,
                max_steps=self.max_steps,
                swarm_memory=self.swarm_memory,
                machine_index=index,
                event_bus=self.event_bus,
                state_machine=self.state_machine,
                email_identity=email_identity,
            )

            async for chunk in executor.stream_execution(subtask, context=swarm_coordination_context):
                if self._cancel_event.is_set():
                    break

                # Wait while paused (blocks until resume or cancel)
                if self._pause_event.is_set():
                    try:
                        await self._resume_event.wait()
                    except asyncio.CancelledError:
                        break
                    if self._cancel_event.is_set():
                        break

                # Accumulate text content for result aggregation
                if chunk.get("type") == "text":
                    accumulated_content += chunk.get("content", "")

                # Label every chunk with swarm + machine info
                chunk["swarm_id"] = self.swarm_id
                chunk["machine_id"] = machine_id
                chunk["machine_index"] = index
                await queue.put(chunk)

            # Store result for aggregation
            # Use last ~2000 chars as the result summary
            result_summary = accumulated_content[-2000:] if accumulated_content else "No output produced"
            self.swarm_memory.set_result(index, result_summary)

            # Transition state machine: RUNNING → COMPLETED
            try:
                self.state_machine.complete(index)
            except Exception:
                pass  # May already be in a terminal state

            self._machine_statuses[machine_id] = "completed"

        except asyncio.CancelledError:
            self._machine_statuses[machine_id] = "cancelled"
            self.swarm_memory.set_result(index, "Execution was cancelled")
            try:
                self.state_machine.cancel(index)
            except Exception:
                pass
            logger.info(f"Swarm machine {index} ({machine_id}) cancelled")
        except Exception as e:
            self._machine_statuses[machine_id] = "failed"
            self.swarm_memory.set_result(index, f"Failed with error: {e}")
            try:
                self.state_machine.fail(index, str(e))
            except Exception:
                pass
            logger.error(
                f"Swarm machine {index} ({machine_id}) failed: {e}",
                exc_info=True,
            )
            try:
                await queue.put({
                    "type": "error",
                    "swarm_id": self.swarm_id,
                    "machine_id": machine_id,
                    "machine_index": index,
                    "error": str(e),
                })
            except asyncio.CancelledError:
                pass
        finally:
            # Emit final status BEFORE sentinel
            try:
                queue.put_nowait({
                    "type": "swarm_machine_status",
                    "swarm_id": self.swarm_id,
                    "machine_id": machine_id,
                    "machine_index": index,
                    "status": self._machine_statuses[machine_id],
                })
            except Exception:
                pass

            # Send sentinel
            try:
                queue.put_nowait(None)
            except Exception:
                pass

            # Release execution lock
            if execution_lock and execution_lock.locked():
                try:
                    execution_lock.release()
                except Exception:
                    pass

            # Disconnect from VM
            try:
                await vm_control_service._cleanup_connection(machine_id)
            except (asyncio.CancelledError, Exception):
                pass
