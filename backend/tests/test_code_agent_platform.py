"""Tests for Code Agent platform awareness.

Verifies that:
- Code agent receives TARGET machine platform, not backend server OS
- Platform context is correctly formatted and labeled
- Code agent prompt contains platform-specific instructions
- Script validation works for all code types
- Code block extraction handles all formats
"""

import pytest
from unittest.mock import MagicMock, patch, call

from computer_use_agent.v1.agents.code_agent import (
    CodeAgent,
    extract_code_block,
    validate_script_syntax,
    execute_code,
    _normalize_execution_result,
)
from computer_use_agent.v1.memory.system_memory import SYSTEM_MEMORY


# ═══════════════════════════════════════════════════════════════════════════
# 1. PLATFORM CONTEXT — TARGET VS BACKEND
# ═══════════════════════════════════════════════════════════════════════════

class TestCodeAgentPlatformContext:
    """Verify the code agent receives target platform info, not backend host."""

    @patch("computer_use_agent.v1.agents.code_agent.LMMAgent")
    def _make_code_agent(self, MockLMMAgent=None):
        """Create a CodeAgent with mocked engine params."""
        params = {
            "model": "test-model",
            "engine_type": "bedrock",
            "region_name": "us-east-1",
            "aws_access_key_id": "test",
            "aws_secret_access_key": "test",
        }
        return CodeAgent(params, budget=3)

    @patch("computer_use_agent.v1.agents.code_agent.LMMAgent")
    @patch("computer_use_agent.v1.agents.code_agent.call_llm_safe")
    def test_windows_target_context(self, mock_llm, MockLMMAgent):
        """When target is Windows, context should say Windows, not backend OS."""
        mock_llm.return_value = "DONE"
        agent = self._make_code_agent()

        mock_controller = MagicMock()

        result = agent.execute(
            "test task",
            screenshot="",
            env_controller=mock_controller,
            system_context={
                "target_platform": "windows",
                "target_os_description": "Windows 11 (x64) with PowerShell shell",
                "screen_resolution": "1920x1080",
            },
        )
        assert result["completion_reason"] == "DONE"

        # Verify the context message sent to the LMM agent contains target platform
        first_add_message = MockLMMAgent.return_value.add_message
        context_text = first_add_message.call_args_list[0][0][0]
        assert "target_platform" in context_text
        assert "windows" in context_text

    @patch("computer_use_agent.v1.agents.code_agent.LMMAgent")
    @patch("computer_use_agent.v1.agents.code_agent.call_llm_safe")
    def test_linux_target_context(self, mock_llm, MockLMMAgent):
        """When target is Linux, context should reflect Linux."""
        mock_llm.return_value = "DONE"
        agent = self._make_code_agent()

        mock_controller = MagicMock()

        result = agent.execute(
            "test task",
            screenshot="",
            env_controller=mock_controller,
            system_context={
                "target_platform": "linux",
                "target_os_description": "Ubuntu Linux with XFCE desktop environment",
                "screen_resolution": "1280x720",
            },
        )
        assert result["completion_reason"] == "DONE"

        context_text = MockLMMAgent.return_value.add_message.call_args_list[0][0][0]
        assert "linux" in context_text
        assert "Ubuntu" in context_text

    @patch("computer_use_agent.v1.agents.code_agent.LMMAgent")
    @patch("computer_use_agent.v1.agents.code_agent.call_llm_safe")
    def test_macos_target_context(self, mock_llm, MockLMMAgent):
        """When target is macOS, context should reflect macOS."""
        mock_llm.return_value = "DONE"
        agent = self._make_code_agent()

        mock_controller = MagicMock()

        result = agent.execute(
            "test task",
            screenshot="",
            env_controller=mock_controller,
            system_context={
                "target_platform": "macos",
                "target_os_description": "macOS 15.3 (arm64)",
                "screen_resolution": "2560x1600",
            },
        )
        assert result["completion_reason"] == "DONE"

        context_text = MockLMMAgent.return_value.add_message.call_args_list[0][0][0]
        assert "macos" in context_text

    def test_no_host_os_leak(self):
        """Code agent should not import platform module for host OS detection."""
        import computer_use_agent.v1.agents.code_agent as module
        # Verify the module doesn't import platform or os at top level
        source = open(module.__file__, encoding="utf-8").read()
        # Should NOT have: import platform as py_platform
        assert "py_platform.system()" not in source
        assert "py_platform.release()" not in source
        assert "py_platform.version()" not in source
        assert "py_platform.machine()" not in source


# ═══════════════════════════════════════════════════════════════════════════
# 2. CODE AGENT PROMPT — PLATFORM INSTRUCTIONS
# ═══════════════════════════════════════════════════════════════════════════

class TestCodeAgentPromptPlatform:
    """Verify the CODE_AGENT_PROMPT has comprehensive platform instructions."""

    def test_prompt_has_linux_section(self):
        prompt = SYSTEM_MEMORY.CODE_AGENT_PROMPT
        assert "## Linux" in prompt
        assert "apt-get" in prompt
        assert 'echo coasty-ai | sudo -S' in prompt
        assert 'Username: `user`' in prompt

    def test_prompt_has_windows_section(self):
        prompt = SYSTEM_MEMORY.CODE_AGENT_PROMPT
        assert "## Windows" in prompt
        assert "PowerShell" in prompt
        assert "winget" in prompt
        assert "NO sudo" in prompt

    def test_prompt_has_macos_section(self):
        prompt = SYSTEM_MEMORY.CODE_AGENT_PROMPT
        assert "## macOS" in prompt
        assert "brew" in prompt
        assert "pbcopy" in prompt
        assert "pbpaste" in prompt

    def test_prompt_warns_against_cross_platform_commands(self):
        """Prompt should explicitly warn against using Linux commands on Windows."""
        prompt = SYSTEM_MEMORY.CODE_AGENT_PROMPT
        assert "NEVER use" in prompt
        # Windows section warns against Linux commands
        assert "xdotool" in prompt
        assert "wmctrl" in prompt

    def test_prompt_mentions_target_platform(self):
        """Prompt should tell the agent to check target_platform."""
        prompt = SYSTEM_MEMORY.CODE_AGENT_PROMPT
        assert "target_platform" in prompt
        assert "target_os_description" in prompt

    def test_prompt_has_platform_aware_technical_notes(self):
        """Technical notes should mention platform differences for package install."""
        prompt = SYSTEM_MEMORY.CODE_AGENT_PROMPT
        assert "CORRECT package manager" in prompt


# ═══════════════════════════════════════════════════════════════════════════
# 3. SCRIPT VALIDATION
# ═══════════════════════════════════════════════════════════════════════════

class TestScriptValidation:
    """Verify script syntax validation for Python and Bash."""

    def test_valid_python(self):
        is_valid, err = validate_script_syntax("print('hello')", "python")
        assert is_valid is True
        assert err == ""

    def test_valid_bash(self):
        is_valid, err = validate_script_syntax("echo 'hello world'", "bash")
        assert is_valid is True

    def test_truncated_python_string(self):
        """Unterminated string should be detected as truncation."""
        code = "x = 'hello"
        is_valid, err = validate_script_syntax(code, "python")
        assert is_valid is False
        assert "TRUNCATED" in err

    def test_truncated_python_triple_quote(self):
        code = 'x = """hello world'
        is_valid, err = validate_script_syntax(code, "python")
        assert is_valid is False
        assert "TRUNCATED" in err

    def test_too_long_script(self):
        code = "x = 1\n" * 5000
        is_valid, err = validate_script_syntax(code, "python")
        assert is_valid is False
        assert "too long" in err

    def test_bash_unterminated_single_quote(self):
        code = "echo 'hello"
        is_valid, err = validate_script_syntax(code, "bash")
        assert is_valid is False
        assert "TRUNCATED" in err

    def test_bash_unterminated_double_quote(self):
        code = 'echo "hello'
        is_valid, err = validate_script_syntax(code, "bash")
        assert is_valid is False
        assert "TRUNCATED" in err

    def test_empty_code(self):
        is_valid, err = validate_script_syntax("", "python")
        assert is_valid is False

    def test_whitespace_only(self):
        is_valid, err = validate_script_syntax("   \n  ", "python")
        assert is_valid is False

    def test_regular_syntax_error(self):
        """Non-truncation syntax error should still be reported."""
        code = "def f(\n  pass"
        is_valid, err = validate_script_syntax(code, "python")
        assert is_valid is False
        assert "SyntaxError" in err


# ═══════════════════════════════════════════════════════════════════════════
# 4. CODE BLOCK EXTRACTION
# ═══════════════════════════════════════════════════════════════════════════

class TestCodeBlockExtraction:
    """Verify code block extraction from LLM responses."""

    def test_python_block(self):
        action = '<answer>\n```python\nprint("hello")\n```\n</answer>'
        code_type, code = extract_code_block(action)
        assert code_type == "python"
        assert code == 'print("hello")'

    def test_bash_block(self):
        action = '<answer>\n```bash\necho "hello"\n```\n</answer>'
        code_type, code = extract_code_block(action)
        assert code_type == "bash"
        assert code == 'echo "hello"'

    def test_generic_block(self):
        action = '<answer>\n```\nsome code\n```\n</answer>'
        code_type, code = extract_code_block(action)
        assert code_type is None
        assert code == "some code"

    def test_truncated_block_no_closing(self):
        """Missing closing ``` should still extract code."""
        action = '<answer>\n```python\nprint("truncated")'
        code_type, code = extract_code_block(action)
        assert code_type == "python"
        assert 'print("truncated")' in code

    def test_no_code_block(self):
        action = "DONE"
        code_type, code = extract_code_block(action)
        assert code is None

    def test_done_signal(self):
        action = "<answer>\nDONE\n</answer>"
        code_type, code = extract_code_block(action)
        assert code is None


# ═══════════════════════════════════════════════════════════════════════════
# 5. EXECUTION RESULT NORMALIZATION
# ═══════════════════════════════════════════════════════════════════════════

class TestResultNormalization:
    """Verify execution result normalization handles various formats."""

    def test_standard_format(self):
        result = _normalize_execution_result({
            "status": "ok", "returncode": 0,
            "output": "hello", "error": "",
        })
        assert result["status"] == "ok"
        assert result["return_code"] == 0
        assert result["output"] == "hello"

    def test_stdout_stderr_format(self):
        """Controllers that return stdout/stderr instead of output/error."""
        result = _normalize_execution_result({
            "status": "ok", "returncode": 0,
            "stdout": "hello", "stderr": "",
        })
        assert result["output"] == "hello"

    def test_none_result(self):
        result = _normalize_execution_result(None)
        assert result["status"] == "unknown"

    def test_empty_result(self):
        result = _normalize_execution_result({})
        assert result["status"] == "unknown"
        assert result["return_code"] == -1


# ═══════════════════════════════════════════════════════════════════════════
# 6. CODE EXECUTION ROUTING
# ═══════════════════════════════════════════════════════════════════════════

class TestCodeExecution:
    """Verify code execution routes to correct env_controller method."""

    def test_python_uses_run_python(self):
        ctrl = MagicMock()
        ctrl.run_python_script = MagicMock(return_value={"status": "ok"})
        execute_code("python", "print(1)", ctrl)
        ctrl.run_python_script.assert_called_once_with("print(1)")

    def test_bash_uses_run_bash(self):
        ctrl = MagicMock()
        ctrl.run_bash_script = MagicMock(return_value={"status": "ok"})
        execute_code("bash", "echo hello", ctrl)
        ctrl.run_bash_script.assert_called_once_with("echo hello", timeout=30)

    def test_unknown_type_returns_error(self):
        ctrl = MagicMock()
        result = execute_code("powershell", "Get-Process", ctrl)
        assert result["status"] == "error"

    def test_invalid_code_not_executed(self):
        """Truncated code should be caught before execution."""
        ctrl = MagicMock()
        ctrl.run_python_script = MagicMock()
        result = execute_code("python", "x = 'unterminated", ctrl)
        assert result["status"] == "error"
        assert "TRUNCATED" in result["error"]
        ctrl.run_python_script.assert_not_called()

    def test_exception_during_execution(self):
        ctrl = MagicMock()
        ctrl.run_python_script = MagicMock(side_effect=RuntimeError("VM down"))
        result = execute_code("python", "print(1)", ctrl)
        assert result["status"] == "error"
        assert "VM down" in result["error"]
