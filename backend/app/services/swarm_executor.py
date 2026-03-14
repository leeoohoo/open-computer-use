"""
Swarm Executor — decomposes a prompt into subtasks and runs them across
multiple machines in parallel with shared memory and message passing.

1. LLM decomposes user prompt into N subtasks (one per machine)
2. Each machine gets its own CUAExecutor with a unique subtask
3. Machines share an in-memory SwarmMemory for key-value storage and messaging
4. After all machines finish, LLM aggregates results into a summary
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
from app.services.swarm_memory import SwarmMemory
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
    """Orchestrates parallel CUA execution across N machines with task decomposition."""

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
        self._machine_statuses: Dict[str, str] = {
            m["machine_id"]: "pending" for m in machines
        }

        # Swarm-level shared memory (ephemeral, in-memory)
        self.swarm_memory = SwarmMemory(len(machines))

        # Per-machine subtasks (populated by _decompose_task)
        self._subtasks: List[str] = []

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def request_cancellation(self) -> None:
        """Signal all machines to stop."""
        self._cancel_event.set()
        for m in self.machines:
            evt = vm_control_service.get_cancellation_event(m["machine_id"])
            evt.set()

    async def stream_execution(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Run all machines in parallel and yield interleaved chunks.

        Yields dicts with at least:
            - ``swarm_id``
            - ``machine_id`` / ``machine_index`` (per-machine chunks)
            - ``type``  (text | tool_call | tool_result | reasoning | error |
                         step_complete | finish | swarm_meta | swarm_planning |
                         swarm_summary)
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

                try:
                    chunk = await asyncio.wait_for(queue.get(), timeout=2.0)
                except asyncio.TimeoutError:
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

            await asyncio.gather(*tasks, return_exceptions=True)

            # Drain remaining items
            while not queue.empty():
                try:
                    leftover = queue.get_nowait()
                    if leftover is not None:
                        yield leftover
                except asyncio.QueueEmpty:
                    break

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
            "- Each subtask must be self-contained and actionable on its own computer\n"
            "- Include all necessary context in each subtask\n"
            "- Subtasks should divide the work efficiently (not duplicate it)\n"
            "- If the task naturally has fewer parts than machines, assign supplementary "
            "tasks (verification, documentation, alternative approaches)\n"
            "- Each subtask should mention it can use shared memory "
            "(read_shared_memory/write_shared_memory) to coordinate with other machines, "
            "and swarm messaging (send_swarm_message/broadcast_swarm_message/read_swarm_messages) "
            "to communicate with teammates\n\n"
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
            "Synthesize their results into a clear, unified summary.\n\n"
            "Rules:\n"
            "- Highlight key findings from each machine\n"
            "- Note any conflicts or inconsistencies between results\n"
            "- Provide a cohesive overall conclusion\n"
            "- Keep the summary concise but comprehensive"
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

            # Build context that tells the agent about swarm coordination
            # Include the FULL team plan so each machine knows what everyone is doing
            all_subtasks = self.swarm_memory.get_all_subtasks()
            team_plan_lines = []
            for si, st in sorted(all_subtasks.items()):
                marker = " <-- YOU" if si == index else ""
                team_plan_lines.append(f"  Machine {si}: {st}{marker}")
            team_plan = "\n".join(team_plan_lines)

            swarm_context = (
                f"You are Machine {index} in a {len(self.machines)}-machine swarm working together on a shared goal.\n\n"
                f"OVERALL GOAL: {self.prompt}\n\n"
                f"TEAM PLAN (all machines):\n{team_plan}\n\n"
                f"YOUR SUBTASK: {subtask}\n\n"
                f"COORDINATION:\n"
                f"- Your teammates' recent progress will be automatically shown to you as [TEAM UPDATE] notes.\n"
                f"  Use these to stay aware of what others have found — adapt your approach if relevant.\n"
                f"- agent.write_shared_memory(key, value) / agent.read_shared_memory(key) — "
                f"shared key-value store for passing data between machines (e.g. URLs, findings, config)\n"
                f"- agent.send_swarm_message(machine_index, message) — send a direct message to a specific teammate\n"
                f"- agent.broadcast_swarm_message(message) — announce something important to all teammates\n"
                f"- agent.read_swarm_messages() — check for direct messages from teammates\n\n"
                f"TIPS:\n"
                f"- Write important findings to shared memory early so teammates can use them.\n"
                f"- If you find something that changes the overall approach, broadcast it.\n"
                f"- Check shared memory before doing work that a teammate may have already done."
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
            )

            async for chunk in executor.stream_execution(swarm_context):
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

            self._machine_statuses[machine_id] = "completed"

        except asyncio.CancelledError:
            self._machine_statuses[machine_id] = "cancelled"
            self.swarm_memory.set_result(index, "Execution was cancelled")
            logger.info(f"Swarm machine {index} ({machine_id}) cancelled")
        except Exception as e:
            self._machine_statuses[machine_id] = "failed"
            self.swarm_memory.set_result(index, f"Failed with error: {e}")
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
