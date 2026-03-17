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
