"""
Swarm Memory — In-memory shared state, activity log, and message passing for
parallel CUA execution.

Provides:
- Key-value shared memory accessible by all machines in a swarm
- Message passing (point-to-point and broadcast) between machines
- Activity log — automatic timeline of significant actions across all machines
- Result storage for post-execution aggregation
- Async dependency waiting (wait_for_key) for blocking on shared memory keys

This is ephemeral — scoped to a single swarm execution lifetime.
NOT the same as the DB-backed shared_memory.py used for cross-chat team persistence.

Thread safety: all access happens on the asyncio event loop, so no locks needed.
SwarmMemory methods must NOT be called from threads (e.g. inside asyncio.to_thread).
"""

import asyncio
import time
from typing import Any, Dict, List, Optional


class SwarmMemory:
    """In-memory shared state container for a single swarm execution."""

    def __init__(self, machine_count: int):
        self.machine_count = machine_count
        self._store: Dict[str, Dict[str, Any]] = {}
        self._messages: Dict[int, List[Dict[str, Any]]] = {
            i: [] for i in range(machine_count)
        }
        self._results: Dict[int, str] = {}
        # Activity log — auto-populated timeline of significant events
        self._activity_log: List[Dict[str, Any]] = []
        # Track what each machine has already seen from the activity log
        self._activity_cursors: Dict[int, int] = {
            i: 0 for i in range(machine_count)
        }
        # Subtask assignments — set by the orchestrator after decomposition
        self._subtasks: Dict[int, str] = {}
        # Async key waiters — machines can block until a key is written
        self._key_events: Dict[str, asyncio.Event] = {}
        # Help request tracking
        self._help_requests: List[Dict[str, Any]] = []
        # Expertise registry — domain → machine_index
        self._expertise: Dict[str, int] = {}

    # ------------------------------------------------------------------
    # Subtask registry (set once by orchestrator, read by all machines)
    # ------------------------------------------------------------------

    def set_subtasks(self, subtasks: Dict[int, str]) -> None:
        """Store all subtask assignments so any machine can see the full plan."""
        self._subtasks = dict(subtasks)

    def get_all_subtasks(self) -> Dict[int, str]:
        """Get the full team plan — all machine subtask assignments."""
        return dict(self._subtasks)

    # ------------------------------------------------------------------
    # Activity log — automatic peer awareness
    # ------------------------------------------------------------------

    def log_activity(self, machine_index: int, activity_type: str, summary: str) -> None:
        """Record a significant action to the shared activity log.

        Called automatically by the executor after each step_complete,
        tool call, or important discovery.  Machines do NOT need to
        call this manually — it happens behind the scenes.
        """
        self._activity_log.append({
            "machine_index": machine_index,
            "type": activity_type,
            "summary": summary[:300],
            "timestamp": time.time(),
        })

    def get_peer_activity(self, machine_index: int, limit: int = 8) -> List[Dict[str, Any]]:
        """Get recent activity from OTHER machines that this machine hasn't seen.

        Returns up to `limit` new entries from peers (excludes own entries).
        Advances this machine's cursor so the same entries aren't returned twice.
        """
        cursor = self._activity_cursors.get(machine_index, 0)
        new_entries = self._activity_log[cursor:]
        # Advance cursor to current end
        self._activity_cursors[machine_index] = len(self._activity_log)

        # Filter to only peer entries (not this machine's own)
        peer_entries = [e for e in new_entries if e["machine_index"] != machine_index]
        return peer_entries[-limit:] if len(peer_entries) > limit else peer_entries

    # ------------------------------------------------------------------
    # Shared key-value memory
    # ------------------------------------------------------------------

    def read(self, key: str) -> Optional[Dict[str, Any]]:
        """Read a value from shared memory. Returns entry dict or None."""
        return self._store.get(key)

    def write(self, key: str, value: str, writer_index: int) -> None:
        """Write a key-value pair to shared memory.

        Also wakes up any machines waiting on this key via wait_for_key().
        """
        self._store[key] = {
            "value": value,
            "written_by": f"machine_{writer_index}" if writer_index >= 0 else "coordinator",
            "updated_at": time.time(),
        }
        # Wake up anyone waiting on this key
        if key in self._key_events:
            self._key_events[key].set()

    def list_keys(self) -> List[Dict[str, Any]]:
        """List all keys with metadata."""
        result = []
        for k, v in self._store.items():
            result.append({
                "key": k,
                "written_by": v.get("written_by", "unknown"),
                "preview": str(v.get("value", ""))[:200],
            })
        return result

    # ------------------------------------------------------------------
    # Message passing
    # ------------------------------------------------------------------

    def send_message(self, from_index: int, to_index: int, message: str) -> bool:
        """Send a message to a specific machine's inbox."""
        if to_index < 0 or to_index >= self.machine_count:
            return False
        if to_index == from_index:
            return False
        self._messages[to_index].append({
            "from": f"machine_{from_index}",
            "from_index": from_index,
            "message": message,
            "timestamp": time.time(),
        })
        return True

    def broadcast_message(self, from_index: int, message: str) -> int:
        """Send a message to all other machines. Returns count of recipients."""
        count = 0
        for idx in range(self.machine_count):
            if idx != from_index:
                self._messages[idx].append({
                    "from": f"machine_{from_index}",
                    "from_index": from_index,
                    "message": message,
                    "timestamp": time.time(),
                })
                count += 1
        return count

    def get_messages(self, machine_index: int) -> List[Dict[str, Any]]:
        """Drain and return all messages for a machine (empties the inbox)."""
        msgs = list(self._messages.get(machine_index, []))
        self._messages[machine_index] = []
        return msgs

    # ------------------------------------------------------------------
    # Result storage (for aggregation after execution)
    # ------------------------------------------------------------------

    def set_result(self, machine_index: int, result: str) -> None:
        """Store a machine's final result summary."""
        self._results[machine_index] = result

    def get_all_results(self) -> Dict[int, str]:
        """Get all stored results keyed by machine index."""
        return dict(self._results)

    # ------------------------------------------------------------------
    # Async dependency waiting
    # ------------------------------------------------------------------

    async def wait_for_key(self, key: str, timeout: float = 120.0) -> Optional[Dict[str, Any]]:
        """Block until a key exists in shared memory, or timeout.

        Returns the entry dict if the key was written, None on timeout.
        Must be called from the asyncio event loop.
        """
        # Check if already exists
        existing = self.read(key)
        if existing is not None:
            return existing

        # Create or get the event for this key
        if key not in self._key_events:
            self._key_events[key] = asyncio.Event()

        try:
            await asyncio.wait_for(self._key_events[key].wait(), timeout=timeout)
            return self.read(key)
        except asyncio.TimeoutError:
            return None

    # ------------------------------------------------------------------
    # Help requests
    # ------------------------------------------------------------------

    def add_help_request(self, machine_index: int, description: str) -> Dict[str, Any]:
        """Record a help request from a machine."""
        request = {
            "machine_index": machine_index,
            "description": description,
            "timestamp": time.time(),
            "resolved": False,
        }
        self._help_requests.append(request)
        return request

    def get_pending_help_requests(self) -> List[Dict[str, Any]]:
        """Get all unresolved help requests."""
        return [r for r in self._help_requests if not r["resolved"]]

    def resolve_help_request(self, machine_index: int) -> None:
        """Mark all help requests from a machine as resolved."""
        for r in self._help_requests:
            if r["machine_index"] == machine_index:
                r["resolved"] = True

    # ------------------------------------------------------------------
    # Expertise registry
    # ------------------------------------------------------------------

    def claim_expertise(self, machine_index: int, domain: str) -> None:
        """Register a machine as an expert in a domain."""
        self._expertise[domain] = machine_index

    def find_expert(self, domain: str) -> Optional[int]:
        """Find which machine (if any) is the expert for a domain."""
        return self._expertise.get(domain)

    def list_expertise(self) -> Dict[str, int]:
        """List all expertise claims."""
        return dict(self._expertise)
