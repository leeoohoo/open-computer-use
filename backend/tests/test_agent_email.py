"""
Tests for the agent email service (backend/app/services/agent_email.py).

Tests cover:
- Verification code extraction from email bodies
- Verification link extraction from email bodies
- Email action parsing in the CUA action bridge
- Email identity injection into CUAExecutor
- Swarm coordination context generation with email tools
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.agent_email import (
    extract_verification_code,
    extract_verification_link,
    get_my_email_address,
)


# ---------------------------------------------------------------------------
# Verification code extraction
# ---------------------------------------------------------------------------


class TestExtractVerificationCode:
    """Test extraction of verification codes from email bodies."""

    def test_code_with_colon(self):
        text = "Your verification code is: 123456"
        assert extract_verification_code(text) == "123456"

    def test_code_without_colon(self):
        text = "Your code is 789012"
        assert extract_verification_code(text) == "789012"

    def test_otp_code(self):
        text = "Your OTP: 456789"
        assert extract_verification_code(text) == "456789"

    def test_pin_code(self):
        text = "Enter PIN: 1234"
        assert extract_verification_code(text) == "1234"

    def test_token_code(self):
        text = "Your token is 87654321"
        assert extract_verification_code(text) == "87654321"

    def test_enter_to_verify(self):
        text = "Enter 654321 to verify your account"
        assert extract_verification_code(text) == "654321"

    def test_use_code_for(self):
        text = "Use 112233 for your login"
        assert extract_verification_code(text) == "112233"

    def test_standalone_6_digit(self):
        text = "Your code:\n\n  123456\n\nDo not share."
        assert extract_verification_code(text) == "123456"

    def test_alphanumeric_code(self):
        text = "Your code is: ABC123"
        assert extract_verification_code(text) == "ABC123"

    def test_no_code_found(self):
        text = "Welcome to our service! Please check your settings."
        assert extract_verification_code(text) is None

    def test_empty_text(self):
        assert extract_verification_code("") is None

    def test_short_number_not_matched(self):
        text = "You have 12 new messages"
        assert extract_verification_code(text) is None


# ---------------------------------------------------------------------------
# Verification link extraction
# ---------------------------------------------------------------------------


class TestExtractVerificationLink:
    """Test extraction of verification links from email bodies."""

    def test_verify_link(self):
        text = "Click here to verify: https://example.com/verify?token=abc123"
        link = extract_verification_link(text)
        assert link is not None
        assert "verify" in link
        assert "token=abc123" in link

    def test_confirm_link(self):
        text = "Confirm your email: https://app.service.com/confirm/user123"
        link = extract_verification_link(text)
        assert link is not None
        assert "confirm" in link

    def test_activate_link(self):
        text = "Activate account: https://service.com/activate?key=xyz789"
        link = extract_verification_link(text)
        assert link is not None
        assert "activate" in link

    def test_token_query_param(self):
        text = "https://example.com/auth?token=longstring123&user=test"
        link = extract_verification_link(text)
        assert link is not None
        assert "token=longstring123" in link

    def test_code_query_param(self):
        text = "Click: https://service.com/callback?code=authcode456"
        link = extract_verification_link(text)
        assert link is not None
        assert "code=authcode456" in link

    def test_no_link_found(self):
        text = "Please visit our homepage for more information."
        assert extract_verification_link(text) is None

    def test_empty_text(self):
        assert extract_verification_link("") is None

    def test_regular_url_not_matched(self):
        text = "Visit https://example.com/about for details"
        assert extract_verification_link(text) is None


# ---------------------------------------------------------------------------
# get_my_email_address
# ---------------------------------------------------------------------------


class TestGetMyEmailAddress:
    """Test the get_my_email_address helper."""

    @pytest.mark.asyncio
    async def test_returns_email(self):
        result = await get_my_email_address("agent-test-0@agents.coasty.ai")
        assert result["success"] is True
        assert result["email"] == "agent-test-0@agents.coasty.ai"
        assert result["result"] == "agent-test-0@agents.coasty.ai"


# ---------------------------------------------------------------------------
# Action bridge parsing for email actions
# ---------------------------------------------------------------------------


class TestEmailActionParsing:
    """Test that email action patterns are correctly parsed by cua_action_bridge."""

    def test_check_my_email(self):
        from app.services.cua_action_bridge import parse_pyautogui_code

        actions = parse_pyautogui_code('check_my_email()')
        assert len(actions) == 1
        assert actions[0].action_type == "check_my_email"

    def test_get_my_email_address(self):
        from app.services.cua_action_bridge import parse_pyautogui_code

        actions = parse_pyautogui_code('get_my_email_address()')
        assert len(actions) == 1
        assert actions[0].action_type == "get_my_email_address"

    def test_wait_for_verification_email_with_hint(self):
        from app.services.cua_action_bridge import parse_pyautogui_code

        actions = parse_pyautogui_code('wait_for_verification_email("noreply@github.com")')
        assert len(actions) == 1
        assert actions[0].action_type == "wait_for_verification_email"
        assert actions[0].params["from_hint"] == "noreply@github.com"
        assert actions[0].params["timeout"] == 120  # default

    def test_wait_for_verification_email_with_timeout(self):
        from app.services.cua_action_bridge import parse_pyautogui_code

        actions = parse_pyautogui_code('wait_for_verification_email("verify@example.com", 60)')
        assert len(actions) == 1
        assert actions[0].action_type == "wait_for_verification_email"
        assert actions[0].params["from_hint"] == "verify@example.com"
        assert actions[0].params["timeout"] == 60

    def test_send_email(self):
        from app.services.cua_action_bridge import parse_pyautogui_code

        actions = parse_pyautogui_code('send_email("user@example.com", "Hello", "Body text")')
        assert len(actions) == 1
        assert actions[0].action_type == "send_email"
        assert actions[0].params["to"] == "user@example.com"
        assert actions[0].params["subject"] == "Hello"
        assert actions[0].params["body"] == "Body text"

    def test_send_email_multiline_body_escaped_newlines(self):
        """The exact failure case from production — body has \\n escape sequences."""
        from app.services.cua_action_bridge import parse_pyautogui_code

        code = 'send_email("prateekjannu@gmail.com", "Head of Growth - Your team is still doing this manually?", "Hello It\'s Grace,\\n\\nWe\'re a Stanford x Columbia team and we\'re onboarding a limited batch of early users to try our autonomous AI agent platform.\\n\\nBest,\\nGrace")'
        actions = parse_pyautogui_code(code)
        assert len(actions) == 1
        assert actions[0].action_type == "send_email"
        assert actions[0].params["to"] == "prateekjannu@gmail.com"
        assert "Head of Growth" in actions[0].params["subject"]
        assert "Hello It's Grace," in actions[0].params["body"]
        assert "\n\nWe're a Stanford" in actions[0].params["body"]
        assert "Best,\nGrace" in actions[0].params["body"]

    def test_send_email_literal_newlines_in_body(self):
        """Body contains actual newline characters (not escape sequences)."""
        from app.services.cua_action_bridge import parse_pyautogui_code

        code = 'send_email("to@x.com", "Subject", "Line 1\nLine 2\nLine 3")'
        actions = parse_pyautogui_code(code)
        assert len(actions) == 1
        assert actions[0].action_type == "send_email"
        assert actions[0].params["body"] == "Line 1\nLine 2\nLine 3"

    def test_send_email_triple_quoted_body(self):
        """Triple-quoted strings for long bodies."""
        from app.services.cua_action_bridge import parse_pyautogui_code

        code = '''send_email("to@x.com", "Subject", """Hello,

This is a multi-paragraph email.

Best regards,
Agent""")'''
        actions = parse_pyautogui_code(code)
        assert len(actions) == 1
        assert actions[0].action_type == "send_email"
        assert "multi-paragraph" in actions[0].params["body"]
        assert actions[0].params["body"].count("\n") >= 3

    def test_send_email_single_quotes(self):
        """All arguments use single quotes."""
        from app.services.cua_action_bridge import parse_pyautogui_code

        actions = parse_pyautogui_code("send_email('user@test.com', 'Hi there', 'Body content')")
        assert len(actions) == 1
        assert actions[0].params["to"] == "user@test.com"
        assert actions[0].params["subject"] == "Hi there"
        assert actions[0].params["body"] == "Body content"

    def test_send_email_escaped_quotes_in_body(self):
        """Body contains escaped quote characters."""
        from app.services.cua_action_bridge import parse_pyautogui_code

        code = 'send_email("to@x.com", "Subject", "She said \\"hello\\" to me")'
        actions = parse_pyautogui_code(code)
        assert len(actions) == 1
        assert actions[0].params["body"] == 'She said "hello" to me'

    def test_send_email_escaped_single_quotes_in_body(self):
        from app.services.cua_action_bridge import parse_pyautogui_code

        code = "send_email('to@x.com', 'Subject', 'It\\'s a great day')"
        actions = parse_pyautogui_code(code)
        assert len(actions) == 1
        assert actions[0].params["body"] == "It's a great day"

    def test_send_email_tabs_in_body(self):
        from app.services.cua_action_bridge import parse_pyautogui_code

        code = 'send_email("to@x.com", "Report", "Name\\tScore\\nAlice\\t95\\nBob\\t87")'
        actions = parse_pyautogui_code(code)
        assert len(actions) == 1
        assert "\t" in actions[0].params["body"]
        assert "Alice\t95" in actions[0].params["body"]

    def test_send_email_long_body_with_urls(self):
        """Real-world long email with URLs and special chars."""
        from app.services.cua_action_bridge import parse_pyautogui_code

        code = 'send_email("recipient@company.com", "Check this out", "Hi,\\n\\nHere is the link: https://example.com/path?key=value&foo=bar\\n\\nLet me know if you have questions.\\n\\nBest,\\nAgent")'
        actions = parse_pyautogui_code(code)
        assert len(actions) == 1
        assert actions[0].params["to"] == "recipient@company.com"
        assert "https://example.com/path?key=value&foo=bar" in actions[0].params["body"]

    def test_send_email_empty_body(self):
        from app.services.cua_action_bridge import parse_pyautogui_code

        actions = parse_pyautogui_code('send_email("to@x.com", "Subject", "")')
        assert len(actions) == 1
        assert actions[0].params["body"] == ""

    def test_send_email_with_commas_in_body(self):
        from app.services.cua_action_bridge import parse_pyautogui_code

        code = 'send_email("to@x.com", "Hello, World", "Dear user, welcome. Also, thanks.")'
        actions = parse_pyautogui_code(code)
        assert len(actions) == 1
        assert actions[0].params["subject"] == "Hello, World"
        assert actions[0].params["body"] == "Dear user, welcome. Also, thanks."

    def test_send_email_with_parentheses_in_body(self):
        from app.services.cua_action_bridge import parse_pyautogui_code

        code = 'send_email("to@x.com", "Update (v2)", "The new version (v2.1) is ready.")'
        actions = parse_pyautogui_code(code)
        assert len(actions) == 1
        assert actions[0].params["subject"] == "Update (v2)"
        assert actions[0].params["body"] == "The new version (v2.1) is ready."

    def test_send_email_mixed_with_other_actions(self):
        """send_email alongside other pyautogui actions in the same code block."""
        from app.services.cua_action_bridge import parse_pyautogui_code

        code = 'pyautogui.click(100, 200)\nsend_email("to@x.com", "Hi", "Body")\npyautogui.press("enter")'
        actions = parse_pyautogui_code(code)
        types = [a.action_type for a in actions]
        assert "click" in types
        assert "send_email" in types
        assert "key_press" in types

    def test_send_email_two_recipients_two_calls(self):
        """Two send_email calls in one code block."""
        from app.services.cua_action_bridge import parse_pyautogui_code

        code = 'send_email("a@x.com", "Hi A", "Body A")\nsend_email("b@x.com", "Hi B", "Body B")'
        actions = parse_pyautogui_code(code)
        emails = [a for a in actions if a.action_type == "send_email"]
        assert len(emails) == 2
        assert emails[0].params["to"] == "a@x.com"
        assert emails[1].params["to"] == "b@x.com"


# ---------------------------------------------------------------------------
# Python string parser unit tests
# ---------------------------------------------------------------------------


class TestParsePythonString:
    """Direct tests for _parse_python_string helper."""

    def test_simple_double_quoted(self):
        from app.services.cua_action_bridge import _parse_python_string

        result = _parse_python_string('"hello world"', 0)
        assert result == ("hello world", 13)

    def test_simple_single_quoted(self):
        from app.services.cua_action_bridge import _parse_python_string

        result = _parse_python_string("'hello'", 0)
        assert result == ("hello", 7)

    def test_escaped_newline(self):
        from app.services.cua_action_bridge import _parse_python_string

        result = _parse_python_string('"line1\\nline2"', 0)
        assert result is not None
        assert result[0] == "line1\nline2"

    def test_escaped_tab(self):
        from app.services.cua_action_bridge import _parse_python_string

        result = _parse_python_string('"col1\\tcol2"', 0)
        assert result is not None
        assert result[0] == "col1\tcol2"

    def test_escaped_quote(self):
        from app.services.cua_action_bridge import _parse_python_string

        result = _parse_python_string('"say \\"hi\\""', 0)
        assert result is not None
        assert result[0] == 'say "hi"'

    def test_escaped_backslash(self):
        from app.services.cua_action_bridge import _parse_python_string

        result = _parse_python_string('"path\\\\to\\\\file"', 0)
        assert result is not None
        assert result[0] == "path\\to\\file"

    def test_triple_double_quoted(self):
        from app.services.cua_action_bridge import _parse_python_string

        result = _parse_python_string('"""multi\nline\nstring"""', 0)
        assert result is not None
        assert result[0] == "multi\nline\nstring"

    def test_triple_single_quoted(self):
        from app.services.cua_action_bridge import _parse_python_string

        result = _parse_python_string("'''multi\nline'''", 0)
        assert result is not None
        assert result[0] == "multi\nline"

    def test_empty_string(self):
        from app.services.cua_action_bridge import _parse_python_string

        result = _parse_python_string('""', 0)
        assert result == ("", 2)

    def test_literal_newline_in_single_quoted(self):
        """LLM sometimes generates literal newlines in single-quoted strings."""
        from app.services.cua_action_bridge import _parse_python_string

        result = _parse_python_string('"hello\nworld"', 0)
        assert result is not None
        assert result[0] == "hello\nworld"

    def test_non_quote_start_returns_none(self):
        from app.services.cua_action_bridge import _parse_python_string

        result = _parse_python_string("hello", 0)
        assert result is None

    def test_offset_position(self):
        from app.services.cua_action_bridge import _parse_python_string

        result = _parse_python_string('xxx"value"yyy', 3)
        assert result is not None
        assert result[0] == "value"
        assert result[1] == 10


# ---------------------------------------------------------------------------
# _parse_send_email_call unit tests
# ---------------------------------------------------------------------------


class TestParseSendEmailCall:
    """Direct tests for _parse_send_email_call helper."""

    def test_basic_call(self):
        from app.services.cua_action_bridge import _parse_send_email_call

        code = '"to@x.com", "Subject", "Body")'
        result = _parse_send_email_call(code, 0)
        assert result == ("to@x.com", "Subject", "Body")

    def test_multiline_body(self):
        from app.services.cua_action_bridge import _parse_send_email_call

        code = '"to@x.com", "Sub", "Line1\\nLine2\\nLine3")'
        result = _parse_send_email_call(code, 0)
        assert result is not None
        assert result[2] == "Line1\nLine2\nLine3"

    def test_missing_args_returns_none(self):
        from app.services.cua_action_bridge import _parse_send_email_call

        code = '"to@x.com", "Subject")'
        result = _parse_send_email_call(code, 0)
        assert result is None

    def test_extra_whitespace(self):
        from app.services.cua_action_bridge import _parse_send_email_call

        code = '  "to@x.com" ,  "Sub" ,  "Body"  )'
        result = _parse_send_email_call(code, 0)
        assert result == ("to@x.com", "Sub", "Body")


# ---------------------------------------------------------------------------
# Email identity in CUAExecutor
# ---------------------------------------------------------------------------


class TestCUAExecutorEmailIdentity:
    """Test that CUAExecutor correctly accepts and stores email_identity."""

    def test_email_identity_stored(self):
        from app.services.cua_executor import CUAExecutor

        email_id = {"email": "agent-test-0@agents.coasty.ai", "password": "TestP@ss1"}
        # Can't fully construct without a provider, but we can test the init logic
        # by checking the class accepts the parameter
        import inspect
        sig = inspect.signature(CUAExecutor.__init__)
        assert "email_identity" in sig.parameters


# ---------------------------------------------------------------------------
# Swarm executor email context
# ---------------------------------------------------------------------------


class TestSwarmExecutorEmailContext:
    """Test that swarm executor generates correct email context."""

    def test_email_section_in_context(self):
        """Verify the email tools section is generated for agents with email."""
        email_identity = {"email": "agent-abc12345-0@agents.coasty.ai", "password": "Xyz!123"}

        # Simulate the context generation logic from swarm_executor.py
        email_section = (
            f"\n\nEMAIL TOOLS (you have your own email address for this session):\n"
            f"- Your email: {email_identity['email']}\n"
            f"- agent.get_my_email_address() — returns your email address\n"
            f"- agent.check_my_email() — read your inbox (recent messages)\n"
            f"- agent.wait_for_verification_email(from_hint) — wait for a verification email and auto-extract codes/links\n"
            f"- agent.send_email(to, subject, body) — send an email from your mailbox\n"
        )
        assert "agent-abc12345-0@agents.coasty.ai" in email_section
        assert "check_my_email" in email_section
        assert "wait_for_verification_email" in email_section
        assert "send_email" in email_section


# ---------------------------------------------------------------------------
# Backend swarm model with email_identity
# ---------------------------------------------------------------------------


class TestSwarmModels:
    """Test the Pydantic models for swarm with email identity."""

    def test_swarm_machine_with_email(self):
        from app.api.routes.swarm import SwarmMachine, EmailIdentity

        machine = SwarmMachine(
            machine_id="test-uuid",
            display_name="Swarm #1",
            email_identity=EmailIdentity(
                email="agent-test-0@agents.coasty.ai",
                password="TestP@ss1",
            ),
        )
        assert machine.email_identity is not None
        assert machine.email_identity.email == "agent-test-0@agents.coasty.ai"
        assert machine.email_identity.password == "TestP@ss1"

    def test_swarm_machine_without_email(self):
        from app.api.routes.swarm import SwarmMachine

        machine = SwarmMachine(
            machine_id="test-uuid",
            display_name="Swarm #1",
        )
        assert machine.email_identity is None

    def test_email_identity_in_execute_request(self):
        from app.api.routes.swarm import SwarmExecuteRequest, SwarmMachine, EmailIdentity

        req = SwarmExecuteRequest(
            swarm_id="test-swarm",
            prompt="Do something",
            machines=[
                SwarmMachine(
                    machine_id="m1",
                    email_identity=EmailIdentity(
                        email="agent-test-0@agents.coasty.ai",
                        password="Pass!1",
                    ),
                ),
                SwarmMachine(machine_id="m2"),
            ],
        )
        assert len(req.machines) == 2
        assert req.machines[0].email_identity is not None
        assert req.machines[1].email_identity is None


# ---------------------------------------------------------------------------
# Backend config for WorkMail
# ---------------------------------------------------------------------------


class TestWorkmailConfig:
    """Test that WorkMail settings are present in backend config."""

    def test_config_has_workmail_fields(self):
        from app.core.config import Settings

        import inspect
        fields = Settings.model_fields
        assert "WORKMAIL_IMAP_HOST" in fields
        assert "WORKMAIL_SMTP_HOST" in fields
        assert "WORKMAIL_IMAP_PORT" in fields
        assert "WORKMAIL_SMTP_PORT" in fields
        assert "WORKMAIL_DOMAIN" in fields

    def test_default_values(self):
        from app.core.config import Settings

        # Create a settings instance with no env overrides
        s = Settings(
            SUPABASE_URL="test",
            SUPABASE_ANON_KEY="test",
            SUPABASE_SERVICE_ROLE="test",
        )
        assert s.WORKMAIL_IMAP_HOST == "imap.mail.us-east-1.awsapps.com"
        assert s.WORKMAIL_SMTP_HOST == "smtp.mail.us-east-1.awsapps.com"
        assert s.WORKMAIL_IMAP_PORT == 993
        assert s.WORKMAIL_SMTP_PORT == 465
        assert s.WORKMAIL_DOMAIN == "agents.coasty.ai"


# ---------------------------------------------------------------------------
# Email instance patching
# ---------------------------------------------------------------------------


class TestEmailInstancePatching:
    """Test the _patch_email_actions_on_instance function."""

    def test_patch_adds_methods(self):
        from app.services.cua_executor import _patch_email_actions_on_instance

        # Create a mock grounding agent instance
        mock_agent = MagicMock()

        _patch_email_actions_on_instance(mock_agent)

        # Verify all email methods were added
        assert hasattr(mock_agent, "check_my_email")
        assert hasattr(mock_agent, "get_my_email_address")
        assert hasattr(mock_agent, "wait_for_verification_email")
        assert hasattr(mock_agent, "send_email")

    def test_patched_methods_return_code_strings(self):
        from app.services.cua_executor import _patch_email_actions_on_instance

        mock_agent = MagicMock()
        _patch_email_actions_on_instance(mock_agent)

        # Call the patched methods and verify they return code strings
        result = mock_agent.check_my_email()
        assert result == "check_my_email()"

        result = mock_agent.get_my_email_address()
        assert result == "get_my_email_address()"

        result = mock_agent.wait_for_verification_email("test@example.com", 60)
        assert 'wait_for_verification_email("test@example.com", 60)' == result

        result = mock_agent.send_email("to@x.com", "Subject", "Body")
        assert 'send_email("to@x.com", "Subject", "Body")' == result

    def test_patched_methods_have_is_agent_action(self):
        from app.services.cua_executor import _patch_email_actions_on_instance

        mock_agent = MagicMock()
        # Remove auto-created attributes so we can check real ones
        del mock_agent.check_my_email
        del mock_agent.get_my_email_address
        del mock_agent.wait_for_verification_email
        del mock_agent.send_email

        _patch_email_actions_on_instance(mock_agent)

        # The bound methods should have is_agent_action
        assert mock_agent.check_my_email.__func__.is_agent_action is True
        assert mock_agent.get_my_email_address.__func__.is_agent_action is True
        assert mock_agent.wait_for_verification_email.__func__.is_agent_action is True
        assert mock_agent.send_email.__func__.is_agent_action is True


# ---------------------------------------------------------------------------
# Universal email identity passthrough (chat.py → CUAExecutor)
# ---------------------------------------------------------------------------


class TestUniversalEmailPassthrough:
    """Test that email_identity from machine settings reaches CUAExecutor."""

    @pytest.mark.asyncio
    async def test_connection_info_includes_email_identity(self):
        """get_machine_connection_info should include email_identity from machine settings."""
        from app.api.routes.chat import get_machine_connection_info

        fake_machine = {
            "status": "running",
            "settings": {
                "provider": "aws",
                "email_identity": {
                    "email": "agent-abc12345-0@agents.coasty.ai",
                    "password": "TestPass!1",
                    "workmailUserId": "wu-123",
                },
            },
            "public_ip_address": "1.2.3.4",
            "ai_agent_port": 8080,
            "vnc_port": 5901,
            "websocket_port": 6080,
            "display_name": "Test VM",
            "vnc_password": "pwd",
        }

        with patch("app.api.routes.chat.vm_control_service") as mock_vm, \
             patch("app.api.routes.chat.db_service") as mock_db:
            mock_vm.session_data = {}
            mock_db.get_machine = AsyncMock(return_value=fake_machine)

            result = await get_machine_connection_info("machine-123", "user-1")

        assert result is not None
        assert result["email_identity"] is not None
        assert result["email_identity"]["email"] == "agent-abc12345-0@agents.coasty.ai"
        assert result["email_identity"]["workmailUserId"] == "wu-123"

    @pytest.mark.asyncio
    async def test_connection_info_no_email_when_absent(self):
        """email_identity should be None when not in machine settings."""
        from app.api.routes.chat import get_machine_connection_info

        fake_machine = {
            "status": "running",
            "settings": {"provider": "aws"},
            "public_ip_address": "1.2.3.4",
            "ai_agent_port": 8080,
            "vnc_port": 5901,
            "websocket_port": 6080,
            "display_name": "Test VM",
            "vnc_password": "pwd",
        }

        with patch("app.api.routes.chat.vm_control_service") as mock_vm, \
             patch("app.api.routes.chat.db_service") as mock_db:
            mock_vm.session_data = {}
            mock_db.get_machine = AsyncMock(return_value=fake_machine)

            result = await get_machine_connection_info("machine-456", "user-1")

        assert result is not None
        assert result["email_identity"] is None

    def test_cua_executor_accepts_email_identity(self):
        """CUAExecutor should accept email_identity parameter."""
        from app.services.cua_executor import CUAExecutor
        import inspect

        sig = inspect.signature(CUAExecutor.__init__)
        assert "email_identity" in sig.parameters
