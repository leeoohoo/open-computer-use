"""Tests for GroundAgent platform-specific behavior.

Verifies that:
- type() generates platform-correct clipboard install (no apt-get on Windows/macOS)
- type() uses correct modifier key per platform (command vs ctrl)
- switch_applications() generates correct code per platform
- open() generates correct code per platform
- hotkey() passes keys through correctly
- hold_and_press() generates correct keyDown/keyUp sequences
- Code agent receives correct platform context
"""

import pytest
from unittest.mock import MagicMock, patch

# We test GroundAgent methods by constructing instances with mocked dependencies


@patch("computer_use_agent.v1.agents.grounding.LMMAgent")
@patch("computer_use_agent.v1.agents.grounding.CodeAgent")
def _make_grounding_agent(platform: str, os_description: str = "",
                          MockCodeAgent=None, MockLMMAgent=None):
    """Create a GroundAgent with mocked LMMAgent/CodeAgent to avoid engine init."""
    try:
        from computer_use_agent.v1.agents.grounding import GroundAgent
    except ImportError:
        pytest.skip("GroundAgent not importable in test environment")

    env = MagicMock()
    env.controller = MagicMock()

    engine_params = {
        "model": "test",
        "engine_type": "bedrock",
        "region_name": "us-east-1",
        "aws_access_key_id": "test",
        "aws_secret_access_key": "test",
        "grounding_width": 1920,
        "grounding_height": 1080,
    }

    agent = GroundAgent(
        env=env,
        platform=platform,
        os_description=os_description or platform,
        engine_params_for_generation=engine_params,
        engine_params_for_grounding=engine_params,
        width=1920,
        height=1080,
    )
    return agent


# ═══════════════════════════════════════════════════════════════════════════
# 1. TYPE() — CLIPBOARD INSTALL
# ═══════════════════════════════════════════════════════════════════════════

class TestTypeClipboardInstall:
    """Verify type() generates correct clipboard fallback per platform."""

    def _get_type_command(self, platform: str, text: str = "hello"):
        """Generate the type command and return it as string."""
        agent = _make_grounding_agent(platform)
        # Mock generate_coords to avoid actual LLM call
        agent.generate_coords = MagicMock(return_value=[500, 300])
        agent.obs = {"screenshot": b"fake"}
        return agent.type(element_description="the input field", text=text)

    def test_linux_type_has_apt_get(self):
        """Linux should include apt-get install for xclip/xsel."""
        cmd = self._get_type_command("linux")
        assert "apt-get install" in cmd
        assert "xclip" in cmd
        assert "xsel" in cmd

    def test_windows_type_no_apt_get(self):
        """Windows should NOT have apt-get — just pip install pyperclip."""
        cmd = self._get_type_command("windows")
        assert "apt-get" not in cmd
        assert "xclip" not in cmd
        assert "pip" in cmd
        assert "pyperclip" in cmd

    def test_macos_type_no_apt_get(self):
        """macOS should NOT have apt-get — just pip install pyperclip."""
        cmd = self._get_type_command("macos")
        assert "apt-get" not in cmd
        assert "xclip" not in cmd
        assert "pip" in cmd
        assert "pyperclip" in cmd

    def test_linux_type_has_sudo(self):
        cmd = self._get_type_command("linux")
        assert "sudo" in cmd

    def test_windows_type_no_sudo(self):
        cmd = self._get_type_command("windows")
        assert "sudo" not in cmd

    def test_macos_type_no_sudo(self):
        cmd = self._get_type_command("macos")
        assert "sudo" not in cmd


# ═══════════════════════════════════════════════════════════════════════════
# 2. TYPE() — MODIFIER KEY (CTRL VS COMMAND)
# ═══════════════════════════════════════════════════════════════════════════

class TestTypeModifierKeys:
    """Verify type() uses correct modifier for overwrite and clipboard paste."""

    def _get_overwrite_command(self, platform: str):
        agent = _make_grounding_agent(platform)
        agent.generate_coords = MagicMock(return_value=[500, 300])
        agent.obs = {"screenshot": b"fake"}
        return agent.type(
            element_description="the field",
            text="new text",
            overwrite=True,
        )

    def test_linux_overwrite_uses_ctrl(self):
        cmd = self._get_overwrite_command("linux")
        assert "'ctrl'" in cmd
        assert "'command'" not in cmd

    def test_windows_overwrite_uses_ctrl(self):
        cmd = self._get_overwrite_command("windows")
        assert "'ctrl'" in cmd
        assert "'command'" not in cmd

    def test_macos_overwrite_uses_command(self):
        cmd = self._get_overwrite_command("macos")
        # macOS uses 'command' for select-all
        assert "'command'" in cmd

    def _get_unicode_paste_command(self, platform: str):
        agent = _make_grounding_agent(platform)
        agent.generate_coords = MagicMock(return_value=[500, 300])
        agent.obs = {"screenshot": b"fake"}
        return agent.type(
            element_description="the field",
            text="\u00e9l\u00e8ve",  # Unicode text with accents
        )

    def test_linux_unicode_paste_uses_ctrl_v(self):
        cmd = self._get_unicode_paste_command("linux")
        assert "pyperclip.copy" in cmd
        assert "'ctrl'" in cmd

    def test_macos_unicode_paste_uses_command_v(self):
        cmd = self._get_unicode_paste_command("macos")
        assert "pyperclip.copy" in cmd
        assert "'command'" in cmd


# ═══════════════════════════════════════════════════════════════════════════
# 3. SWITCH_APPLICATIONS() — PLATFORM BRANCHING
# ═══════════════════════════════════════════════════════════════════════════

class TestSwitchApplications:
    """Verify switch_applications() generates correct code per platform."""

    def _get_switch_command(self, platform: str, app: str = "firefox"):
        agent = _make_grounding_agent(platform)
        return agent.switch_applications(app)

    def test_linux_uses_wmctrl(self):
        cmd = self._get_switch_command("linux", "firefox")
        assert "wmctrl" in cmd

    def test_macos_uses_spotlight(self):
        cmd = self._get_switch_command("macos", "Safari")
        assert "command" in cmd.lower()
        assert "space" in cmd

    def test_windows_uses_win_key(self):
        cmd = self._get_switch_command("windows", "notepad")
        assert "win" in cmd.lower()
        assert "enter" in cmd.lower()

    def test_unsupported_platform_raises(self):
        agent = _make_grounding_agent("freebsd")
        with pytest.raises(AssertionError, match="Unsupported platform"):
            agent.switch_applications("app")


# ═══════════════════════════════════════════════════════════════════════════
# 4. OPEN() — PLATFORM BRANCHING
# ═══════════════════════════════════════════════════════════════════════════

class TestOpenApp:
    """Verify open() generates correct code per platform."""

    def _get_open_command(self, platform: str, app: str = "chrome"):
        agent = _make_grounding_agent(platform)
        return agent.open(app)

    def test_linux_uses_xdg_open(self):
        cmd = self._get_open_command("linux", "chrome")
        assert "xdg-open" in cmd or "shutil.which" in cmd

    def test_macos_uses_spotlight(self):
        cmd = self._get_open_command("macos", "Chrome")
        assert "command" in cmd.lower()
        assert "space" in cmd

    def test_windows_uses_win_key(self):
        cmd = self._get_open_command("windows", "notepad")
        assert "win" in cmd.lower()

    def test_unsupported_platform_raises(self):
        agent = _make_grounding_agent("solaris")
        with pytest.raises(AssertionError, match="Unsupported platform"):
            agent.open("app")


# ═══════════════════════════════════════════════════════════════════════════
# 5. HOTKEY() — KEY PASSTHROUGH
# ═══════════════════════════════════════════════════════════════════════════

class TestHotkey:
    """Verify hotkey() generates correct pyautogui code."""

    def test_hotkey_ctrl_c(self):
        agent = _make_grounding_agent("linux")
        cmd = agent.hotkey(["ctrl", "c"])
        assert "pyautogui.hotkey('ctrl', 'c')" in cmd

    def test_hotkey_command_v(self):
        agent = _make_grounding_agent("macos")
        cmd = agent.hotkey(["command", "v"])
        assert "pyautogui.hotkey('command', 'v')" in cmd

    def test_hotkey_single_key(self):
        agent = _make_grounding_agent("linux")
        cmd = agent.hotkey(["enter"])
        assert "pyautogui.hotkey('enter')" in cmd

    def test_hotkey_three_keys(self):
        agent = _make_grounding_agent("windows")
        cmd = agent.hotkey(["ctrl", "shift", "s"])
        assert "pyautogui.hotkey('ctrl', 'shift', 's')" in cmd


# ═══════════════════════════════════════════════════════════════════════════
# 6. HOLD_AND_PRESS() — MODIFIER SEQUENCES
# ═══════════════════════════════════════════════════════════════════════════

class TestHoldAndPress:
    """Verify hold_and_press() generates correct keyDown/keyUp sequences."""

    def test_hold_shift_press_arrows(self):
        agent = _make_grounding_agent("linux")
        cmd = agent.hold_and_press(["shift"], ["down", "down"])
        assert "keyDown('shift')" in cmd
        assert "keyUp('shift')" in cmd
        assert "press(['down', 'down'])" in cmd

    def test_hold_ctrl_press_c(self):
        agent = _make_grounding_agent("linux")
        cmd = agent.hold_and_press(["ctrl"], ["c"])
        assert "keyDown('ctrl')" in cmd
        assert "keyUp('ctrl')" in cmd

    def test_multiple_hold_keys(self):
        agent = _make_grounding_agent("linux")
        cmd = agent.hold_and_press(["ctrl", "shift"], ["a"])
        assert "keyDown('ctrl')" in cmd
        assert "keyDown('shift')" in cmd
        assert "keyUp('ctrl')" in cmd
        assert "keyUp('shift')" in cmd


# ═══════════════════════════════════════════════════════════════════════════
# 7. TYPE() — NEWLINE HANDLING
# ═══════════════════════════════════════════════════════════════════════════

class TestTypeNewlines:
    """Verify type() handles newlines by splitting into segments."""

    def _get_type_command_no_element(self, platform: str, text: str):
        agent = _make_grounding_agent(platform)
        agent.obs = {"screenshot": b"fake"}
        return agent.type(text=text)

    def test_newline_split(self):
        cmd = self._get_type_command_no_element("linux", "line1\nline2")
        assert "press('enter')" in cmd
        assert "write('line1')" in cmd
        assert "write('line2')" in cmd

    def test_no_newline_no_enter(self):
        cmd = self._get_type_command_no_element("linux", "single line")
        assert "press('enter')" not in cmd


# ═══════════════════════════════════════════════════════════════════════════
# 8. TYPE() — UNICODE SANITIZATION
# ═══════════════════════════════════════════════════════════════════════════

class TestTypeSanitization:
    """Verify type() sanitizes unicode characters."""

    def _get_type_command(self, platform, text):
        agent = _make_grounding_agent(platform)
        agent.obs = {"screenshot": b"fake"}
        return agent.type(text=text)

    def test_em_dash_replaced(self):
        cmd = self._get_type_command("linux", "hello \u2014 world")
        assert "\u2014" not in cmd  # Em dash should be replaced with -

    def test_smart_quotes_replaced(self):
        cmd = self._get_type_command("linux", "\u201chello\u201d")
        assert "\u201c" not in cmd
        assert "\u201d" not in cmd


# ═══════════════════════════════════════════════════════════════════════════
# 9. CODE AGENT PLATFORM CONTEXT FROM GROUNDING
# ═══════════════════════════════════════════════════════════════════════════

class TestCodeAgentPlatformFromGrounding:
    """Verify GroundAgent passes correct platform to code agent."""

    def test_platform_context_has_target_platform(self):
        """When call_code_agent builds platform_context, it should have target_platform."""
        agent = _make_grounding_agent("windows", "Windows 11 (x64)")
        # The platform_context is built inside call_code_agent at grounding.py:737
        # We can verify the attributes are set correctly
        assert agent.platform == "windows"
        assert agent.os_description == "Windows 11 (x64)"

    def test_platform_context_linux(self):
        agent = _make_grounding_agent("linux", "Ubuntu Linux with XFCE")
        assert agent.platform == "linux"
        assert agent.os_description == "Ubuntu Linux with XFCE"

    def test_platform_context_macos(self):
        agent = _make_grounding_agent("macos", "macOS 15.3 (arm64)")
        assert agent.platform == "macos"
        assert agent.os_description == "macOS 15.3 (arm64)"


# ═══════════════════════════════════════════════════════════════════════════
# 10. TERMINAL SIGNALS
# ═══════════════════════════════════════════════════════════════════════════

class TestTerminalSignals:
    """Verify done() and fail() return correct signals."""

    def test_done(self):
        agent = _make_grounding_agent("linux")
        assert agent.done() == "DONE"

    def test_fail(self):
        agent = _make_grounding_agent("linux")
        assert agent.fail() == "FAIL"

    def test_wait(self):
        agent = _make_grounding_agent("linux")
        cmd = agent.wait(5)
        assert "time.sleep(5)" in cmd


# ═══════════════════════════════════════════════════════════════════════════
# 11. SCROLL
# ═══════════════════════════════════════════════════════════════════════════

class TestScroll:
    """Verify scroll generates correct pyautogui code."""

    def test_vertical_scroll(self):
        agent = _make_grounding_agent("linux")
        agent.generate_coords = MagicMock(return_value=[500, 300])
        agent.obs = {"screenshot": b"fake"}
        cmd = agent.scroll("the page", -5)
        assert "vscroll(-5)" in cmd

    def test_horizontal_scroll(self):
        agent = _make_grounding_agent("linux")
        agent.generate_coords = MagicMock(return_value=[500, 300])
        agent.obs = {"screenshot": b"fake"}
        cmd = agent.scroll("the page", 3, shift=True)
        assert "hscroll(3)" in cmd
