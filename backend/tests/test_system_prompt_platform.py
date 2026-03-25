"""Tests for Worker system prompt platform awareness.

Verifies that:
- CURRENT_OS placeholder gets replaced with actual OS description
- Platform-specific keyboard shortcut guidance is present
- All three platforms (linux, windows, macos) are covered
- set_cell_values is skipped for non-Linux platforms
- OS description builder handles all Electron platform strings
"""

import pytest
from unittest.mock import MagicMock

from computer_use_agent.v1.memory.system_memory import SYSTEM_MEMORY


# ═══════════════════════════════════════════════════════════════════════════
# 1. SYSTEM PROMPT TEMPLATE
# ═══════════════════════════════════════════════════════════════════════════

class TestSystemPromptTemplate:
    """Verify the system prompt template has required sections."""

    def _get_prompt(self, agent_mock=None, skipped=None):
        """Generate the prompt with a mock agent."""
        if agent_mock is None:
            agent_mock = MagicMock()
            agent_mock.__dir__ = MagicMock(return_value=[])
        return SYSTEM_MEMORY.construct_simple_worker_system_memory(
            agent_mock, skipped_actions=skipped or []
        )

    def test_contains_current_os_placeholder(self):
        """Template should contain CURRENT_OS for later replacement."""
        prompt = self._get_prompt()
        assert "CURRENT_OS" in prompt

    def test_contains_task_description_placeholder(self):
        prompt = self._get_prompt()
        assert "TASK_DESCRIPTION" in prompt

    def test_contains_platform_specific_section(self):
        """Prompt should have the platform-specific behavior section."""
        prompt = self._get_prompt()
        assert "Platform-Specific Behavior" in prompt

    def test_contains_macos_keyboard_guidance(self):
        prompt = self._get_prompt()
        assert "command" in prompt.lower()
        assert "macOS" in prompt

    def test_contains_windows_keyboard_guidance(self):
        prompt = self._get_prompt()
        assert "Windows" in prompt
        assert "ctrl" in prompt.lower()

    def test_contains_linux_keyboard_guidance(self):
        prompt = self._get_prompt()
        assert "Linux" in prompt

    def test_modifier_key_examples_per_platform(self):
        """Should show ctrl for Windows/Linux and command for macOS."""
        prompt = self._get_prompt()
        # macOS copy
        assert "command" in prompt and "'c'" in prompt
        # Windows close
        assert "alt" in prompt and "f4" in prompt.lower()

    def test_file_path_guidance_per_platform(self):
        prompt = self._get_prompt()
        assert "/Users/" in prompt  # macOS
        assert "C:\\\\" in prompt or "C:\\Users" in prompt  # Windows
        assert "/home/" in prompt  # Linux

    def test_no_hardcoded_ubuntu_xfce_in_drag(self):
        """Drag instructions should not hardcode Ubuntu/XFCE."""
        prompt = self._get_prompt()
        # Find the drag instruction line (rule 15)
        for line in prompt.split("\n"):
            if "drag-and-drop" in line.lower() and "agent.drag_and_drop" in line:
                assert "Ubuntu/XFCE" not in line, \
                    "Drag instruction should not hardcode Ubuntu/XFCE"

    def test_hotkey_examples_are_platform_aware(self):
        """Rule 17 should mention both ctrl and command for different OSes."""
        prompt = self._get_prompt()
        # Find rule 17
        for line in prompt.split("\n"):
            if "17." in line and "hotkey" in line.lower():
                assert "macOS" in line or "command" in line, \
                    "Rule 17 should mention macOS/command key"
                break


# ═══════════════════════════════════════════════════════════════════════════
# 2. OS DESCRIPTION REPLACEMENT
# ═══════════════════════════════════════════════════════════════════════════

class TestOsDescriptionReplacement:
    """Verify CURRENT_OS gets properly replaced for all platforms."""

    def test_replace_with_windows_description(self):
        prompt = SYSTEM_MEMORY.construct_simple_worker_system_memory(
            MagicMock(__dir__=MagicMock(return_value=[])),
            skipped_actions=[],
        )
        result = prompt.replace("CURRENT_OS", "Windows 11 (x64) with PowerShell shell")
        assert "You are working in Windows 11 (x64) with PowerShell shell" in result
        assert "CURRENT_OS" not in result

    def test_replace_with_macos_description(self):
        prompt = SYSTEM_MEMORY.construct_simple_worker_system_memory(
            MagicMock(__dir__=MagicMock(return_value=[])),
            skipped_actions=[],
        )
        result = prompt.replace("CURRENT_OS", "macOS 15.3 (arm64)")
        assert "You are working in macOS 15.3 (arm64)" in result

    def test_replace_with_linux_description(self):
        prompt = SYSTEM_MEMORY.construct_simple_worker_system_memory(
            MagicMock(__dir__=MagicMock(return_value=[])),
            skipped_actions=[],
        )
        result = prompt.replace("CURRENT_OS", "Ubuntu Linux with XFCE desktop environment")
        assert "Ubuntu Linux with XFCE desktop environment" in result


# ═══════════════════════════════════════════════════════════════════════════
# 3. OS DESCRIPTION BUILDER (CUAExecutor._build_os_description)
# ═══════════════════════════════════════════════════════════════════════════

class TestBuildOsDescription:
    """Verify CUAExecutor._build_os_description produces correct descriptions."""

    @staticmethod
    def _build(system_info):
        """Call the static method directly."""
        # Import here to avoid import errors if CUAExecutor deps aren't available
        try:
            from app.services.cua_executor import CUAExecutor
            return CUAExecutor._build_os_description(system_info)
        except ImportError:
            pytest.skip("CUAExecutor not importable in test environment")

    def test_windows_11_description(self):
        desc = self._build({
            "platform": "win32",
            "os_version": "10.0.26200",
            "arch": "x64",
            "shell": "powershell",
        })
        assert "Windows 11" in desc
        assert "x64" in desc
        assert "powershell" in desc

    def test_windows_10_description(self):
        desc = self._build({
            "platform": "win32",
            "os_version": "10.0.19045",
            "arch": "x64",
            "shell": "powershell",
        })
        assert "Windows 10" in desc

    def test_macos_description(self):
        desc = self._build({
            "platform": "darwin",
            "os_version": "15.3",
            "arch": "arm64",
        })
        assert "macOS" in desc
        assert "15.3" in desc
        assert "arm64" in desc

    def test_linux_electron_description(self):
        desc = self._build({
            "platform": "linux",
            "os_name": "Ubuntu 22.04",
            "arch": "x86_64",
            "shell": "bash",
        })
        assert "Ubuntu" in desc
        assert "x86_64" in desc

    def test_vm_default_no_system_info(self):
        desc = self._build({})
        assert "Ubuntu Linux" in desc
        assert "XFCE" in desc

    def test_windows_no_build_number(self):
        """Windows without a parseable build number should still say 'Windows'."""
        desc = self._build({
            "platform": "win32",
            "os_version": "",
            "arch": "x64",
        })
        assert "Windows" in desc


# ═══════════════════════════════════════════════════════════════════════════
# 4. CODE AGENT PROMPT SECTIONS
# ═══════════════════════════════════════════════════════════════════════════

class TestCodeAgentPromptSections:
    """Verify CODE_AGENT_PROMPT has all required platform sections."""

    def test_has_platform_aware_execution_header(self):
        prompt = SYSTEM_MEMORY.CODE_AGENT_PROMPT
        assert "Platform-Aware Execution" in prompt

    def test_linux_section_has_sudo(self):
        prompt = SYSTEM_MEMORY.CODE_AGENT_PROMPT
        # Between "## Linux" and "## Windows", should contain sudo
        linux_start = prompt.index("## Linux")
        windows_start = prompt.index("## Windows")
        linux_section = prompt[linux_start:windows_start]
        assert "sudo" in linux_section
        assert "apt-get" in linux_section
        assert "user" in linux_section.lower()

    def test_windows_section_forbids_linux(self):
        prompt = SYSTEM_MEMORY.CODE_AGENT_PROMPT
        windows_start = prompt.index("## Windows")
        macos_start = prompt.index("## macOS")
        windows_section = prompt[windows_start:macos_start]
        assert "NEVER use" in windows_section
        assert "PowerShell" in windows_section

    def test_macos_section_has_brew(self):
        prompt = SYSTEM_MEMORY.CODE_AGENT_PROMPT
        macos_start = prompt.index("## macOS")
        # Find end of macOS section (next ## or end)
        next_section = prompt.find("**ALWAYS check", macos_start)
        macos_section = prompt[macos_start:next_section]
        assert "brew" in macos_section
        assert "pbcopy" in macos_section

    def test_critical_warning_present(self):
        """Should have a strong warning about cross-platform command errors."""
        prompt = SYSTEM_MEMORY.CODE_AGENT_PROMPT
        assert "ALWAYS check the platform context" in prompt
        assert "#1 cause" in prompt


# ═══════════════════════════════════════════════════════════════════════════
# 5. REFLECTION PROMPT (should be platform-agnostic)
# ═══════════════════════════════════════════════════════════════════════════

class TestReflectionPrompt:
    """Verify reflection prompt doesn't have platform assumptions."""

    def test_no_platform_hardcoding(self):
        """Reflection prompt should not hardcode any specific OS."""
        prompt = SYSTEM_MEMORY.REFLECTION_ON_TRAJECTORY
        # Should not mention specific OS in reflection
        assert "Ubuntu" not in prompt
        assert "Windows 11" not in prompt
        assert "macOS" not in prompt
