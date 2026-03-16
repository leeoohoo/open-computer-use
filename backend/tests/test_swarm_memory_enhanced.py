"""Tests for SwarmMemory enhancements — wait_for_key, help requests, expertise."""

import asyncio
import time
import pytest

from app.services.swarm_memory import SwarmMemory


class TestSwarmMemoryWaitForKey:
    """Test async dependency waiting via wait_for_key."""

    def setup_method(self):
        self.memory = SwarmMemory(3)

    @pytest.mark.asyncio
    async def test_wait_for_key_already_exists(self):
        """wait_for_key should return immediately if key exists."""
        self.memory.write("data", "hello", writer_index=0)
        result = await self.memory.wait_for_key("data", timeout=1.0)
        assert result is not None
        assert result["value"] == "hello"

    @pytest.mark.asyncio
    async def test_wait_for_key_written_after_wait_starts(self):
        """wait_for_key should resolve when key is written by another task."""
        async def writer():
            await asyncio.sleep(0.1)
            self.memory.write("late_data", "value123", writer_index=1)

        task = asyncio.create_task(writer())
        result = await self.memory.wait_for_key("late_data", timeout=5.0)
        assert result is not None
        assert result["value"] == "value123"
        await task

    @pytest.mark.asyncio
    async def test_wait_for_key_timeout(self):
        """wait_for_key should return None on timeout."""
        result = await self.memory.wait_for_key("never_written", timeout=0.1)
        assert result is None

    @pytest.mark.asyncio
    async def test_wait_for_key_multiple_waiters(self):
        """Multiple machines waiting on the same key should all be notified."""
        results = [None, None]

        async def waiter(idx):
            results[idx] = await self.memory.wait_for_key("shared_key", timeout=5.0)

        t1 = asyncio.create_task(waiter(0))
        t2 = asyncio.create_task(waiter(1))

        await asyncio.sleep(0.1)
        self.memory.write("shared_key", "shared_value", writer_index=2)

        await asyncio.gather(t1, t2)
        assert results[0] is not None
        assert results[0]["value"] == "shared_value"
        assert results[1] is not None
        assert results[1]["value"] == "shared_value"

    @pytest.mark.asyncio
    async def test_wait_for_key_reusable_after_write(self):
        """After a key is written, subsequent wait_for_key should return immediately."""
        self.memory.write("ready", "yes", writer_index=0)
        r1 = await self.memory.wait_for_key("ready", timeout=1.0)
        r2 = await self.memory.wait_for_key("ready", timeout=1.0)
        assert r1 is not None
        assert r2 is not None


class TestSwarmMemoryWriteWakesWaiters:
    """Test that write() properly wakes up wait_for_key waiters."""

    def setup_method(self):
        self.memory = SwarmMemory(2)

    @pytest.mark.asyncio
    async def test_write_sets_event(self):
        """Writing a key should set the corresponding asyncio.Event."""
        # Create the event by starting a wait
        wait_task = asyncio.create_task(
            self.memory.wait_for_key("test_key", timeout=5.0)
        )
        await asyncio.sleep(0.05)  # Let the event be created

        # Write should wake the waiter
        self.memory.write("test_key", "value", writer_index=0)

        result = await asyncio.wait_for(wait_task, timeout=2.0)
        assert result is not None
        assert result["value"] == "value"

    def test_write_with_negative_writer_index_shows_coordinator(self):
        """Writer index of -1 should show 'coordinator' as writer."""
        self.memory.write("key", "val", writer_index=-1)
        entry = self.memory.read("key")
        assert entry["written_by"] == "coordinator"


class TestSwarmMemoryHelpRequests:
    """Test help request tracking."""

    def setup_method(self):
        self.memory = SwarmMemory(3)

    def test_add_help_request(self):
        """add_help_request should record the request."""
        req = self.memory.add_help_request(0, "Stuck on CAPTCHA")
        assert req["machine_index"] == 0
        assert req["description"] == "Stuck on CAPTCHA"
        assert req["resolved"] is False
        assert req["timestamp"] > 0

    def test_get_pending_help_requests(self):
        """get_pending_help_requests should return only unresolved requests."""
        self.memory.add_help_request(0, "Help 1")
        self.memory.add_help_request(1, "Help 2")
        self.memory.resolve_help_request(0)

        pending = self.memory.get_pending_help_requests()
        assert len(pending) == 1
        assert pending[0]["machine_index"] == 1

    def test_resolve_help_request(self):
        """resolve_help_request should mark all requests from that machine."""
        self.memory.add_help_request(0, "Help A")
        self.memory.add_help_request(0, "Help B")
        self.memory.resolve_help_request(0)

        pending = self.memory.get_pending_help_requests()
        assert len(pending) == 0

    def test_no_pending_when_none_added(self):
        """Should return empty list when no help requests exist."""
        assert self.memory.get_pending_help_requests() == []


class TestSwarmMemoryExpertise:
    """Test expertise registry."""

    def setup_method(self):
        self.memory = SwarmMemory(3)

    def test_claim_expertise(self):
        """claim_expertise should register the machine as expert."""
        self.memory.claim_expertise(0, "spreadsheets")
        assert self.memory.find_expert("spreadsheets") == 0

    def test_find_expert_returns_none_when_no_expert(self):
        """find_expert should return None for unclaimed domains."""
        assert self.memory.find_expert("unknown") is None

    def test_claim_expertise_overwrites(self):
        """A new claim in the same domain overwrites the previous one."""
        self.memory.claim_expertise(0, "browser_auth")
        self.memory.claim_expertise(1, "browser_auth")
        assert self.memory.find_expert("browser_auth") == 1

    def test_list_expertise(self):
        """list_expertise should return all claims."""
        self.memory.claim_expertise(0, "spreadsheets")
        self.memory.claim_expertise(1, "web_scraping")
        claims = self.memory.list_expertise()
        assert claims == {"spreadsheets": 0, "web_scraping": 1}

    def test_list_expertise_empty(self):
        """list_expertise should return empty dict when no claims."""
        assert self.memory.list_expertise() == {}


class TestSwarmMemoryExistingFunctionality:
    """Regression tests — ensure existing functionality still works."""

    def setup_method(self):
        self.memory = SwarmMemory(3)

    def test_read_write(self):
        """Basic read/write should still work."""
        self.memory.write("key", "value", writer_index=0)
        result = self.memory.read("key")
        assert result["value"] == "value"
        assert result["written_by"] == "machine_0"

    def test_read_nonexistent(self):
        """Reading nonexistent key should return None."""
        assert self.memory.read("nope") is None

    def test_list_keys(self):
        """list_keys should return all stored keys."""
        self.memory.write("a", "1", writer_index=0)
        self.memory.write("b", "2", writer_index=1)
        keys = self.memory.list_keys()
        assert len(keys) == 2
        key_names = {k["key"] for k in keys}
        assert key_names == {"a", "b"}

    def test_send_message(self):
        """Point-to-point message should be deliverable."""
        ok = self.memory.send_message(0, 1, "hello")
        assert ok is True
        msgs = self.memory.get_messages(1)
        assert len(msgs) == 1
        assert msgs[0]["message"] == "hello"
        assert msgs[0]["from"] == "machine_0"

    def test_send_message_self_rejected(self):
        """Cannot send message to self."""
        ok = self.memory.send_message(0, 0, "self-talk")
        assert ok is False

    def test_send_message_out_of_range(self):
        """Cannot send to invalid machine index."""
        assert self.memory.send_message(0, 99, "msg") is False
        assert self.memory.send_message(0, -1, "msg") is False

    def test_broadcast_message(self):
        """Broadcast should reach all machines except sender."""
        count = self.memory.broadcast_message(0, "alert")
        assert count == 2
        assert len(self.memory.get_messages(1)) == 1
        assert len(self.memory.get_messages(2)) == 1
        assert len(self.memory.get_messages(0)) == 0  # Not sender

    def test_get_messages_drains_inbox(self):
        """get_messages should empty the inbox."""
        self.memory.send_message(0, 1, "msg1")
        self.memory.send_message(0, 1, "msg2")
        msgs = self.memory.get_messages(1)
        assert len(msgs) == 2
        # Second call should be empty
        assert len(self.memory.get_messages(1)) == 0

    def test_activity_log(self):
        """Activity logging and peer activity retrieval should work."""
        self.memory.log_activity(0, "step", "Clicked button")
        self.memory.log_activity(1, "step", "Typed text")

        # Machine 2 sees both
        peer = self.memory.get_peer_activity(2)
        assert len(peer) == 2

        # Machine 0 sees only machine 1's activity
        peer0 = self.memory.get_peer_activity(0)
        assert len(peer0) == 1
        assert peer0[0]["machine_index"] == 1

    def test_activity_cursor_prevents_duplicates(self):
        """Same activity should not be returned twice."""
        self.memory.log_activity(0, "step", "action 1")
        peer = self.memory.get_peer_activity(1)
        assert len(peer) == 1

        # No new activity — should return empty
        peer = self.memory.get_peer_activity(1)
        assert len(peer) == 0

    def test_subtask_registry(self):
        """Subtask get/set should work."""
        self.memory.set_subtasks({0: "task A", 1: "task B", 2: "task C"})
        all_tasks = self.memory.get_all_subtasks()
        assert all_tasks == {0: "task A", 1: "task B", 2: "task C"}

    def test_result_storage(self):
        """Result set/get should work."""
        self.memory.set_result(0, "result 0")
        self.memory.set_result(1, "result 1")
        results = self.memory.get_all_results()
        assert results == {0: "result 0", 1: "result 1"}
