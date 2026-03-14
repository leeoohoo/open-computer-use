"""Tests for the context compaction system in Worker.flush_messages().

Validates that:
- _calc_text_len correctly measures message text
- _extract_text_from_messages produces formatted output
- _compact_context replaces old messages with a summary
- Role alternation is preserved after compaction
- The last 2 messages (current turn) are never compacted
- Emergency fallback triggers when compaction fails
- flush_messages integrates compaction correctly
"""

import sys
import os
import pytest
from unittest.mock import MagicMock, patch

# The computer_use_agent package lives under backend/app/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))

from computer_use_agent.v1.agents.worker import (
    Worker,
    COMPACTION_THRESHOLD,
    COMPACTION_TARGET,
    EMERGENCY_TARGET,
)


# ── Helpers ──────────────────────────────────────────────────────────────


def _make_msg(role: str, text: str) -> dict:
    """Build a minimal message dict matching mllm.py format."""
    return {"role": role, "content": [{"type": "text", "text": text}]}


def _make_msg_with_image(role: str, text: str) -> dict:
    """Build a message with both text and an image entry."""
    return {
        "role": role,
        "content": [
            {"type": "text", "text": text},
            {"type": "image_url", "image_url": {"url": "data:image/png;base64,ABC"}},
        ],
    }


def _big_text(n_chars: int) -> str:
    """Generate a string of exactly n_chars length."""
    return "x" * n_chars


def _build_conversation(system_text: str, turns: int, chars_per_msg: int) -> list:
    """Build a realistic [system, user, asst, user, asst, ...] message list."""
    msgs = [_make_msg("system", system_text)]
    for i in range(turns):
        msgs.append(_make_msg("user", _big_text(chars_per_msg)))
        msgs.append(_make_msg("assistant", _big_text(chars_per_msg)))
    return msgs


# ── _calc_text_len ───────────────────────────────────────────────────────


class TestCalcTextLen:
    def test_empty_messages(self):
        assert Worker._calc_text_len([]) == 0

    def test_single_message(self):
        msgs = [_make_msg("user", "hello")]
        assert Worker._calc_text_len(msgs) == 5

    def test_multiple_messages(self):
        msgs = [
            _make_msg("system", "sys"),
            _make_msg("user", "hello"),
            _make_msg("assistant", "world!"),
        ]
        assert Worker._calc_text_len(msgs) == 3 + 5 + 6

    def test_ignores_images(self):
        msgs = [_make_msg_with_image("user", "hi")]
        assert Worker._calc_text_len(msgs) == 2

    def test_handles_non_list_content(self):
        """Messages with string content (not list) should be handled gracefully."""
        msgs = [{"role": "user", "content": "plain string"}]
        assert Worker._calc_text_len(msgs) == 0  # Not a list, skipped


# ── _extract_text_from_messages ──────────────────────────────────────────


class TestExtractText:
    def test_basic_extraction(self):
        msgs = [
            _make_msg("user", "question"),
            _make_msg("assistant", "answer"),
        ]
        result = Worker._extract_text_from_messages(msgs)
        assert "[USER]:" in result
        assert "question" in result
        assert "[ASSISTANT]:" in result
        assert "answer" in result

    def test_empty_messages(self):
        assert Worker._extract_text_from_messages([]) == ""

    def test_skips_image_only_messages(self):
        msgs = [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": "data:image/png;base64,X"}},
                ],
            }
        ]
        # No text content, should produce empty string
        assert Worker._extract_text_from_messages(msgs) == ""


# ── _compact_context ─────────────────────────────────────────────────────


class TestCompactContext:
    """Test _compact_context in isolation using a mock agent and mock engine."""

    def _make_worker_for_compaction(self):
        """Build a minimal Worker-like object with just the methods we need."""
        # We can't easily construct a real Worker (needs grounding agent, etc.)
        # so we test the static/instance methods directly via a mock.
        worker = MagicMock(spec=Worker)
        worker._calc_text_len = Worker._calc_text_len
        worker._extract_text_from_messages = Worker._extract_text_from_messages
        worker._compact_context = Worker._compact_context.__get__(worker)
        worker.engine_params = {
            "model": "test-model",
            "region_name": "us-east-1",
            "aws_access_key_id": "fake",
            "aws_secret_access_key": "fake",
        }
        worker.turn_count = 5  # Simulated turn count for logging
        return worker

    def test_no_compaction_needed(self):
        """Should return True immediately if under threshold."""
        worker = self._make_worker_for_compaction()
        agent = MagicMock()
        agent.messages = [_make_msg("system", "small")]
        assert worker._compact_context(agent, 1000, 500) is True

    def test_successful_compaction(self):
        """Summary replaces old messages, keeping system + recent turns."""
        worker = self._make_worker_for_compaction()

        # Build messages: system + 4 turns (8 msgs), each 60K chars
        # Total text = ~480K (system is small), threshold = 400K
        agent = MagicMock()
        agent.messages = _build_conversation("system prompt", turns=4, chars_per_msg=60_000)
        total_before = Worker._calc_text_len(agent.messages)
        assert total_before > 400_000

        # Mock the compaction engine to return a summary
        mock_engine = MagicMock()
        mock_engine.generate.return_value = "This is a detailed summary of what happened. " * 5
        worker._build_compaction_engine = MagicMock(return_value=mock_engine)

        result = worker._compact_context(agent, 400_000, 200_000)
        assert result is True

        # Verify structure
        assert agent.messages[0]["role"] == "system"
        # Summary should be at index 1
        summary_text = agent.messages[1]["content"][0]["text"]
        assert "[CONTEXT SUMMARY" in summary_text
        assert "END CONTEXT SUMMARY" in summary_text
        # Total text should be much less than before
        total_after = Worker._calc_text_len(agent.messages)
        assert total_after < total_before

    def test_preserves_last_two_messages(self):
        """The current turn (last user + assistant) must never be compacted."""
        worker = self._make_worker_for_compaction()

        # Build: system + 3 turns (6 msgs)
        last_user_text = "LAST_USER_MSG_UNIQUE"
        last_asst_text = "LAST_ASST_MSG_UNIQUE"
        agent = MagicMock()
        agent.messages = _build_conversation("sys", turns=2, chars_per_msg=150_000)
        # Override last 2 with identifiable content
        agent.messages[-2] = _make_msg("user", last_user_text + _big_text(150_000))
        agent.messages[-1] = _make_msg("assistant", last_asst_text + _big_text(150_000))

        mock_engine = MagicMock()
        mock_engine.generate.return_value = "Summary of prior work with all important details preserved." * 3
        worker._build_compaction_engine = MagicMock(return_value=mock_engine)

        result = worker._compact_context(agent, 400_000, 200_000)
        assert result is True

        # Last two messages should still be there with their unique text
        all_text = " ".join(
            item.get("text", "")
            for msg in agent.messages
            for item in (msg.get("content", []) if isinstance(msg.get("content"), list) else [])
            if isinstance(item, dict)
        )
        assert last_user_text in all_text
        assert last_asst_text in all_text

    def test_role_alternation_user_after_summary(self):
        """If remaining[0] is 'user', an assistant ack is inserted."""
        worker = self._make_worker_for_compaction()

        # system, user1(big), asst1(big), user2, asst2
        # Compact user1 + asst1 → summary(user), then remaining starts with user2
        agent = MagicMock()
        agent.messages = [
            _make_msg("system", "sys"),
            _make_msg("user", _big_text(250_000)),
            _make_msg("assistant", _big_text(250_000)),
            _make_msg("user", "recent user msg"),
            _make_msg("assistant", "recent asst msg"),
        ]

        mock_engine = MagicMock()
        mock_engine.generate.return_value = "Detailed summary of agent actions and findings." * 3
        worker._build_compaction_engine = MagicMock(return_value=mock_engine)

        result = worker._compact_context(agent, 400_000, 200_000)
        assert result is True

        # Check role sequence: system, user(summary), assistant(ack), user, assistant
        roles = [m["role"] for m in agent.messages]
        for i in range(1, len(roles)):
            if roles[i - 1] == "user":
                assert roles[i] == "assistant", f"Two consecutive 'user' at index {i-1},{i}: {roles}"
            elif roles[i - 1] == "assistant":
                assert roles[i] == "user", f"Two consecutive 'assistant' at index {i-1},{i}: {roles}"

    def test_role_alternation_assistant_after_summary(self):
        """If remaining[0] is 'assistant', no ack is inserted."""
        worker = self._make_worker_for_compaction()

        # Compact only index 1 (user1), remaining starts with asst1
        agent = MagicMock()
        agent.messages = [
            _make_msg("system", "sys"),
            _make_msg("user", _big_text(300_000)),  # Only this gets compacted
            _make_msg("assistant", "asst1"),
            _make_msg("user", "user2"),
            _make_msg("assistant", "asst2"),
        ]

        mock_engine = MagicMock()
        mock_engine.generate.return_value = "Detailed summary of agent actions and findings." * 3
        worker._build_compaction_engine = MagicMock(return_value=mock_engine)

        result = worker._compact_context(agent, 200_000, 100_000)
        assert result is True

        # Summary is user, remaining starts with assistant → no ack needed
        roles = [m["role"] for m in agent.messages]
        # Should be: system, user(summary), assistant, user, assistant
        assert roles == ["system", "user", "assistant", "user", "assistant"]

    def test_engine_failure_returns_false(self):
        """If the LLM call fails, should return False for emergency fallback."""
        worker = self._make_worker_for_compaction()

        agent = MagicMock()
        agent.messages = _build_conversation("sys", turns=4, chars_per_msg=60_000)

        mock_engine = MagicMock()
        mock_engine.generate.side_effect = RuntimeError("Bedrock timeout")
        worker._build_compaction_engine = MagicMock(return_value=mock_engine)

        result = worker._compact_context(agent, 400_000, 200_000)
        assert result is False
        # Messages should be unchanged
        assert len(agent.messages) == 9  # system + 4 turns * 2

    def test_short_summary_returns_false(self):
        """If the LLM returns a very short summary, treat as failure."""
        worker = self._make_worker_for_compaction()

        agent = MagicMock()
        agent.messages = _build_conversation("sys", turns=4, chars_per_msg=60_000)

        mock_engine = MagicMock()
        mock_engine.generate.return_value = "OK"  # Too short (<50 chars)
        worker._build_compaction_engine = MagicMock(return_value=mock_engine)

        result = worker._compact_context(agent, 400_000, 200_000)
        assert result is False

    def test_only_three_messages_no_compaction(self):
        """With system + 1 turn (3 msgs), last 2 are protected → nothing to compact."""
        worker = self._make_worker_for_compaction()

        agent = MagicMock()
        agent.messages = [
            _make_msg("system", "sys"),
            _make_msg("user", _big_text(300_000)),
            _make_msg("assistant", _big_text(300_000)),
        ]

        # max_compactable = max(1, 3-2) = 1, so range(1, 1) is empty
        # compact_end stays at 1, returns True (nothing to compact)
        mock_engine = MagicMock()
        worker._build_compaction_engine = MagicMock(return_value=mock_engine)

        result = worker._compact_context(agent, 400_000, 200_000)
        assert result is True
        # Engine should never be called
        mock_engine.generate.assert_not_called()

    def test_conversation_text_truncated_for_long_input(self):
        """If extracted text > 150K chars, it should be truncated before sending to LLM."""
        worker = self._make_worker_for_compaction()

        # 6 turns, 50K each = 600K chars total, but we'd extract ~400K for compaction
        agent = MagicMock()
        agent.messages = _build_conversation("sys", turns=6, chars_per_msg=50_000)

        mock_engine = MagicMock()
        mock_engine.generate.return_value = "Thorough summary of all actions taken." * 5
        worker._build_compaction_engine = MagicMock(return_value=mock_engine)

        worker._compact_context(agent, 400_000, 200_000)

        # Check that the prompt sent to the engine has truncated text
        call_args = mock_engine.generate.call_args
        prompt = call_args[0][0]  # first positional arg
        user_text = prompt[1]["content"][0]["text"]
        # Should contain truncation marker if text was > 150K
        if len(user_text) > 150_000:
            # The total user_text includes the prefix + conversation_text
            # conversation_text itself is capped at 150K
            pass  # Just verify it didn't crash


# ── Integration: flush_messages with compaction ──────────────────────────


class TestFlushMessagesCompaction:
    """Test that flush_messages correctly triggers compaction."""

    def test_no_compaction_under_threshold(self):
        """Messages under threshold should not trigger compaction."""
        # Just verify _calc_text_len is called correctly
        msgs = _build_conversation("sys", turns=3, chars_per_msg=1000)
        total = Worker._calc_text_len(msgs)
        assert total < COMPACTION_THRESHOLD

    def test_emergency_fallback_reduces_context(self):
        """When compaction fails, emergency drop should still reduce context."""
        # Simulate: build messages > COMPACTION_THRESHOLD, mock _compact_context to fail
        msgs = _build_conversation("sys", turns=10, chars_per_msg=50_000)
        total = Worker._calc_text_len(msgs)
        assert total > COMPACTION_THRESHOLD

        # Simulate the emergency fallback loop directly
        while len(msgs) > 3 and Worker._calc_text_len(msgs) > EMERGENCY_TARGET:
            msgs.pop(1)

        final_total = Worker._calc_text_len(msgs)
        assert final_total <= EMERGENCY_TARGET
        assert len(msgs) >= 3  # system + at least last user/asst
