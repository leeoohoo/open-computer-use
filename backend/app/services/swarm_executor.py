"""
Swarm Executor — runs the same prompt across multiple machines in parallel.

Each machine gets its own CUAExecutor instance.  Results are streamed back
with machine labels so the frontend can display per-machine progress.
"""

import asyncio
import json
import logging
import time
import uuid
from typing import Any, AsyncGenerator, Dict, List, Optional

from app.services.cua_executor import CUAExecutor
from app.services.vm_control import vm_control_service

logger = logging.getLogger(__name__)

# Global registry of active swarms so we can stop them externally.
# Safe for asyncio — all access is from the event loop thread.
_active_swarms: Dict[str, "SwarmExecutor"] = {}


def get_active_swarm(swarm_id: str) -> Optional["SwarmExecutor"]:
    return _active_swarms.get(swarm_id)


class SwarmExecutor:
    """Orchestrates parallel CUA execution across N machines."""

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

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def request_cancellation(self) -> None:
        """Signal all machines to stop."""
        self._cancel_event.set()
        # Set per-machine cancellation events directly (bypass is_machine_busy
        # check since swarm machines may not hold the execution lock yet).
        for m in self.machines:
            evt = vm_control_service.get_cancellation_event(m["machine_id"])
            evt.set()

    async def stream_execution(self) -> AsyncGenerator[Dict[str, Any], None]:
        """Run all machines in parallel and yield interleaved chunks.

        Yields dicts with at least:
            - ``swarm_id``
            - ``machine_id``
            - ``machine_index``
            - ``type``  (text | tool_call | tool_result | reasoning | error |
                         step_complete | finish | swarm_meta)
            - type-specific payload fields
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
            # Build one queue that all machine coroutines push into.
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
                # Check swarm-level cancellation
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

            # Wait for all tasks to actually finish (handles cancellation).
            await asyncio.gather(*tasks, return_exceptions=True)

            # Drain any remaining items queued after the sentinel
            while not queue.empty():
                try:
                    leftover = queue.get_nowait()
                    if leftover is not None:
                        yield leftover
                except asyncio.QueueEmpty:
                    break

            # Final swarm-level finish event (only if not cancelled)
            if not cancelled:
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
    # Internal
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

        self._machine_statuses[machine_id] = "running"

        # Notify that this machine started
        await queue.put({
            "type": "swarm_machine_status",
            "swarm_id": self.swarm_id,
            "machine_id": machine_id,
            "machine_index": index,
            "status": "running",
        })

        try:
            # Acquire execution lock to prevent concurrent use of this machine
            execution_lock = vm_control_service.get_execution_lock(machine_id)
            try:
                await asyncio.wait_for(execution_lock.acquire(), timeout=5.0)
            except asyncio.TimeoutError:
                raise RuntimeError(f"Machine {machine_id} is busy (could not acquire lock)")

            # Reset any stale cancellation from previous executions
            vm_control_service.reset_cancellation(machine_id)

            # Connect to the VM agent
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

            executor = CUAExecutor(
                machine_id=machine_id,
                connection_info=connection_info,
                provider=self.provider,
                model=self.model,
                temperature=self.temperature,
                max_steps=self.max_steps,
            )

            async for chunk in executor.stream_execution(self.prompt):
                if self._cancel_event.is_set():
                    break

                # Label every chunk with swarm + machine info
                chunk["swarm_id"] = self.swarm_id
                chunk["machine_id"] = machine_id
                chunk["machine_index"] = index
                await queue.put(chunk)

            self._machine_statuses[machine_id] = "completed"

        except asyncio.CancelledError:
            self._machine_statuses[machine_id] = "cancelled"
            logger.info(f"Swarm machine {index} ({machine_id}) cancelled")
        except Exception as e:
            self._machine_statuses[machine_id] = "failed"
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
            # Emit final status BEFORE sentinel so consumer sees it
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

            # Send sentinel (use put_nowait to avoid CancelledError)
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
