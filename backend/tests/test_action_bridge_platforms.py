"""Comprehensive tests for CUA action bridge platform-specific behavior.

Tests cover:
- Action parsing for all action types
- Platform detection (_is_linux_vm, _get_vm_platform)
- Platform-specific command routing (xdotool vs WebSocket)
- Hold-keys click routing (click_with_modifiers for non-Linux)
- Key mapping safety (_xkey)
- Raw code fallback
- Edge cases: empty code, terminal signals, multi-action sequences
"""

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.cua_action_bridge import (
    ActionCommand,
    _get_vm_platform,
    _is_linux_vm,
    _xkey,
    execute_action,
    parse_pyautogui_code,
)


# ── Fixtures ──────────────────────────────────────────────────────────────

def _mock_session(is_electron: bool = False, platform: str = "", os_type: str = "linux"):
    """Build a fake session_data entry for vm_control_service."""
    session = {"os_type": os_type}
    if is_electron:
        session["is_electron"] = True
        session["system_info"] = {"platform": platform}
    return session


# ═══════════════════════════════════════════════════════════════════════════
# 1. PLATFORM DETECTION
# ═══════════════════════════════════════════════════════════════════════════

class TestPlatformDetection:
    """Verify _get_vm_platform and _is_linux_vm detect all OS types."""

    @patch("app.services.cua_action_bridge.vm_control_service")
    def test_linux_vm_default(self, mock_svc):
        mock_svc.session_data = {"m1": _mock_session()}
        assert _get_vm_platform("m1") == "linux"
        assert _is_linux_vm("m1") is True

    @patch("app.services.cua_action_bridge.vm_control_service")
    def test_electron_windows(self, mock_svc):
        mock_svc.session_data = {"m1": _mock_session(is_electron=True, platform="win32")}
        assert _get_vm_platform("m1") == "windows"
        assert _is_linux_vm("m1") is False

    @patch("app.services.cua_action_bridge.vm_control_service")
    def test_electron_macos(self, mock_svc):
        mock_svc.session_data = {"m1": _mock_session(is_electron=True, platform="darwin")}
        assert _get_vm_platform("m1") == "macos"
        assert _is_linux_vm("m1") is False

    @patch("app.services.cua_action_bridge.vm_control_service")
    def test_electron_linux(self, mock_svc):
        mock_svc.session_data = {"m1": _mock_session(is_electron=True, platform="linux")}
        assert _get_vm_platform("m1") == "linux"
        assert _is_linux_vm("m1") is True

    @patch("app.services.cua_action_bridge.vm_control_service")
    def test_windows_server_vm(self, mock_svc):
        mock_svc.session_data = {"m1": _mock_session(os_type="windows")}
        assert _get_vm_platform("m1") == "windows"
        assert _is_linux_vm("m1") is False

    @patch("app.services.cua_action_bridge.vm_control_service")
    def test_unknown_machine_defaults_linux(self, mock_svc):
        mock_svc.session_data = {}
        assert _get_vm_platform("unknown") == "linux"


# ═══════════════════════════════════════════════════════════════════════════
# 2. KEY MAPPING SAFETY
# ═══════════════════════════════════════════════════════════════════════════

class TestXKeyMapping:
    """Verify _xkey maps pyautogui names to xdotool and rejects unsafe input."""

    def test_common_keys(self):
        assert _xkey("enter") == "Return"
        assert _xkey("tab") == "Tab"
        assert _xkey("escape") == "Escape"
        assert _xkey("backspace") == "BackSpace"
        assert _xkey("delete") == "Delete"
        assert _xkey("space") == "space"

    def test_modifier_keys(self):
        assert _xkey("ctrl") == "ctrl"
        assert _xkey("alt") == "alt"
        assert _xkey("shift") == "shift"
        assert _xkey("command") == "super"
        assert _xkey("win") == "super"
        assert _xkey("meta") == "super"

    def test_arrow_keys(self):
        assert _xkey("up") == "Up"
        assert _xkey("down") == "Down"
        assert _xkey("left") == "Left"
        assert _xkey("right") == "Right"

    def test_function_keys(self):
        for i in range(1, 13):
            assert _xkey(f"f{i}") == f"F{i}"

    def test_case_insensitive(self):
        assert _xkey("ENTER") == "Return"
        assert _xkey("Ctrl") == "ctrl"
        assert _xkey("ESCAPE") == "Escape"

    def test_safe_passthrough(self):
        """Alphanumeric keys should pass through unchanged."""
        assert _xkey("a") == "a"
        assert _xkey("Z") == "Z"
        assert _xkey("F13") == "F13"
        assert _xkey("KP_Enter") == "KP_Enter"

    def test_rejects_shell_injection(self):
        """Shell metacharacters must be rejected."""
        assert _xkey("; rm -rf /") == "VoidSymbol"
        assert _xkey("$(whoami)") == "VoidSymbol"
        assert _xkey("key && echo pwned") == "VoidSymbol"
        assert _xkey("`id`") == "VoidSymbol"
        assert _xkey("a|b") == "VoidSymbol"

    def test_empty_string_rejected(self):
        assert _xkey("") == "VoidSymbol"


# ═══════════════════════════════════════════════════════════════════════════
# 3. ACTION PARSING — DESKTOP ACTIONS
# ═══════════════════════════════════════════════════════════════════════════

class TestParseDesktopActions:
    """Verify parsing of click, type, key, scroll, drag, etc."""

    def test_simple_click(self):
        actions = parse_pyautogui_code("pyautogui.click(640, 360)")
        assert len(actions) == 1
        assert actions[0].action_type == "click"
        assert actions[0].params == {"x": 640, "y": 360, "button": "left"}

    def test_right_click(self):
        actions = parse_pyautogui_code("pyautogui.click(100, 200, button='right')")
        assert len(actions) == 1
        assert actions[0].params["button"] == "right"

    def test_double_click(self):
        actions = parse_pyautogui_code("pyautogui.click(100, 200, clicks=2)")
        assert len(actions) == 1
        assert actions[0].params["clicks"] == 2

    def test_triple_click(self):
        actions = parse_pyautogui_code("pyautogui.click(100, 200, clicks=3)")
        assert len(actions) == 1
        assert actions[0].params["clicks"] == 3

    def test_write_text(self):
        actions = parse_pyautogui_code("pyautogui.write('hello world')")
        assert len(actions) == 1
        assert actions[0].action_type == "type_text"
        assert actions[0].params["text"] == "hello world"

    def test_typewrite_alias(self):
        actions = parse_pyautogui_code("pyautogui.typewrite('test')")
        assert len(actions) == 1
        assert actions[0].action_type == "type_text"

    def test_press_single_key(self):
        actions = parse_pyautogui_code("pyautogui.press('enter')")
        assert len(actions) == 1
        assert actions[0].action_type == "key_press"
        assert actions[0].params["keys"] == ["enter"]

    def test_press_key_list(self):
        actions = parse_pyautogui_code("pyautogui.press(['tab', 'tab', 'enter'])")
        assert len(actions) == 1
        assert actions[0].action_type == "key_press"
        assert actions[0].params["keys"] == ["tab", "tab", "enter"]

    def test_hotkey_combo(self):
        actions = parse_pyautogui_code("pyautogui.hotkey('ctrl', 'c')")
        assert len(actions) == 1
        assert actions[0].action_type == "key_combo"
        assert actions[0].params["keys"] == ["ctrl", "c"]

    def test_hotkey_three_keys(self):
        actions = parse_pyautogui_code("pyautogui.hotkey('ctrl', 'shift', 's')")
        assert len(actions) == 1
        assert actions[0].params["keys"] == ["ctrl", "shift", "s"]

    def test_vertical_scroll(self):
        actions = parse_pyautogui_code("pyautogui.vscroll(-5)")
        assert len(actions) == 1
        assert actions[0].action_type == "scroll"
        assert actions[0].params["clicks"] == -5
        assert actions[0].params["direction"] == "vertical"

    def test_horizontal_scroll(self):
        actions = parse_pyautogui_code("pyautogui.hscroll(3)")
        assert len(actions) == 1
        assert actions[0].action_type == "scroll"
        assert actions[0].params["direction"] == "horizontal"

    def test_scroll_at_position(self):
        """moveTo followed by vscroll should attach coordinates."""
        code = "pyautogui.moveTo(400, 300)\npyautogui.vscroll(-3)"
        actions = parse_pyautogui_code(code)
        scroll = [a for a in actions if a.action_type == "scroll"][0]
        assert scroll.params["x"] == 400
        assert scroll.params["y"] == 300

    def test_drag_with_moveto(self):
        code = "pyautogui.moveTo(100, 200)\npyautogui.dragTo(300, 400)"
        actions = parse_pyautogui_code(code)
        assert len(actions) == 1
        assert actions[0].action_type == "drag"
        assert actions[0].params["x1"] == 100
        assert actions[0].params["y1"] == 200
        assert actions[0].params["x2"] == 300
        assert actions[0].params["y2"] == 400

    def test_sleep(self):
        actions = parse_pyautogui_code("time.sleep(3)")
        assert len(actions) == 1
        assert actions[0].action_type == "wait"
        assert actions[0].params["seconds"] == 3.0

    def test_short_sleep_not_wait_action(self):
        """Sleep < 1.0 second should not generate a 'wait' action."""
        actions = parse_pyautogui_code("time.sleep(0.5)")
        # Short sleeps are filtered from wait actions but may fall through to raw
        for a in actions:
            assert a.action_type != "wait"

    def test_clipboard_paste_merged(self):
        """pyperclip.copy + ctrl+v should merge into a single type_text."""
        code = "pyperclip.copy('hello')\npyautogui.hotkey('ctrl', 'v')"
        actions = parse_pyautogui_code(code)
        assert len(actions) == 1
        assert actions[0].action_type == "type_text"
        assert actions[0].params["text"] == "hello"

    def test_clipboard_paste_command_v_mac(self):
        """pyperclip.copy + command+v should also merge."""
        code = "pyperclip.copy('world')\npyautogui.hotkey('command', 'v')"
        actions = parse_pyautogui_code(code)
        assert len(actions) == 1
        assert actions[0].action_type == "type_text"
        assert actions[0].params["text"] == "world"

    def test_keydown_keyup_hold_keys(self):
        """keyDown + click + keyUp should set hold_keys on click."""
        code = (
            "pyautogui.keyDown('shift')\n"
            "pyautogui.click(100, 200)\n"
            "pyautogui.keyUp('shift')"
        )
        actions = parse_pyautogui_code(code)
        click = [a for a in actions if a.action_type == "click"][0]
        assert click.params.get("hold_keys") == ["shift"]


# ═══════════════════════════════════════════════════════════════════════════
# 4. ACTION PARSING — TERMINAL SIGNALS
# ═══════════════════════════════════════════════════════════════════════════

class TestParseTerminalSignals:
    """Verify DONE, FAIL, WAIT signals."""

    def test_done_signal(self):
        actions = parse_pyautogui_code("DONE")
        assert len(actions) == 1
        assert actions[0].action_type == "done"

    def test_fail_signal(self):
        actions = parse_pyautogui_code("FAIL")
        assert len(actions) == 1
        assert actions[0].action_type == "fail"

    def test_wait_signal(self):
        actions = parse_pyautogui_code("WAIT")
        assert len(actions) == 1
        assert actions[0].action_type == "wait"
        assert actions[0].params["seconds"] == 5

    def test_empty_code_returns_empty(self):
        assert parse_pyautogui_code("") == []
        assert parse_pyautogui_code("   ") == []
        assert parse_pyautogui_code(None) == []

    def test_case_insensitive_done(self):
        assert parse_pyautogui_code("done")[0].action_type == "done"
        assert parse_pyautogui_code("Done")[0].action_type == "done"


# ═══════════════════════════════════════════════════════════════════════════
# 5. ACTION PARSING — INTERCEPTED ACTIONS
# ═══════════════════════════════════════════════════════════════════════════

class TestParseInterceptedActions:
    """Verify all server-side intercepted actions parse correctly."""

    def test_search(self):
        actions = parse_pyautogui_code('search("python requests docs")')
        assert len(actions) == 1
        assert actions[0].action_type == "search"
        assert actions[0].params["query"] == "python requests docs"

    def test_web_search_alias(self):
        actions = parse_pyautogui_code('web_search("weather today")')
        assert len(actions) == 1
        assert actions[0].action_type == "search"

    def test_credential_lookup(self):
        actions = parse_pyautogui_code('lookup_credential("gmail.com")')
        assert len(actions) == 1
        assert actions[0].action_type == "credential_lookup"
        assert actions[0].params["service"] == "gmail.com"

    def test_credential_lookup_with_context(self):
        actions = parse_pyautogui_code('lookup_credential("gmail.com", "personal email")')
        assert len(actions) == 1
        assert actions[0].params["context"] == "personal email"

    def test_fill_credential_field(self):
        actions = parse_pyautogui_code('fill_credential_field("gmail.com", "password")')
        assert len(actions) == 1
        assert actions[0].action_type == "fill_credential_field"
        assert actions[0].params["service"] == "gmail.com"
        assert actions[0].params["field"] == "password"

    def test_shared_memory_read(self):
        actions = parse_pyautogui_code('read_shared_memory("api_key")')
        assert actions[0].action_type == "read_shared_memory"
        assert actions[0].params["key"] == "api_key"

    def test_shared_memory_write(self):
        actions = parse_pyautogui_code('write_shared_memory("result", "42")')
        assert actions[0].action_type == "write_shared_memory"
        assert actions[0].params["key"] == "result"
        assert actions[0].params["value"] == "42"

    def test_shared_memory_list(self):
        actions = parse_pyautogui_code("list_shared_memory()")
        assert actions[0].action_type == "list_shared_memory"

    def test_swarm_send_message(self):
        actions = parse_pyautogui_code('send_swarm_message("0", "done with scraping")')
        assert actions[0].action_type == "send_swarm_message"
        assert actions[0].params["to_machine"] == "0"
        assert actions[0].params["message"] == "done with scraping"

    def test_swarm_broadcast(self):
        actions = parse_pyautogui_code('broadcast_swarm_message("all done")')
        assert actions[0].action_type == "broadcast_swarm_message"

    def test_swarm_read_messages(self):
        actions = parse_pyautogui_code("read_swarm_messages()")
        assert actions[0].action_type == "read_swarm_messages"

    def test_delegation(self):
        actions = parse_pyautogui_code('delegate_to_employee("emp1", "analyze data")')
        assert actions[0].action_type == "delegate_to_employee"
        assert actions[0].params["employee_id"] == "emp1"
        assert actions[0].params["task"] == "analyze data"

    def test_delegation_with_context(self):
        actions = parse_pyautogui_code('delegate_to_employee("emp1", "analyze", "use CSV")')
        assert actions[0].params["context"] == "use CSV"

    def test_list_delegates(self):
        actions = parse_pyautogui_code("list_delegates()")
        assert actions[0].action_type == "list_delegates"

    def test_email_check(self):
        actions = parse_pyautogui_code("check_my_email()")
        assert actions[0].action_type == "check_my_email"

    def test_email_get_address(self):
        actions = parse_pyautogui_code("get_my_email_address()")
        assert actions[0].action_type == "get_my_email_address"

    def test_email_wait_verification(self):
        actions = parse_pyautogui_code('wait_for_verification_email("noreply@example.com", 60)')
        assert actions[0].action_type == "wait_for_verification_email"
        assert actions[0].params["from_hint"] == "noreply@example.com"
        assert actions[0].params["timeout"] == 60

    def test_email_wait_verification_default_timeout(self):
        actions = parse_pyautogui_code('wait_for_verification_email("verify@test.com")')
        assert actions[0].params["timeout"] == 120


# ═══════════════════════════════════════════════════════════════════════════
# 6. RAW CODE FALLBACK
# ═══════════════════════════════════════════════════════════════════════════

class TestRawCodeFallback:
    """Verify unparseable code falls back to raw execution."""

    def test_unknown_code_becomes_raw(self):
        actions = parse_pyautogui_code("some_custom_function(arg1, arg2)")
        assert len(actions) == 1
        assert actions[0].action_type == "raw"

    def test_complex_python_becomes_raw(self):
        code = "import subprocess\nsubprocess.run(['wmctrl', '-ia', win_id])"
        actions = parse_pyautogui_code(code)
        assert actions[0].action_type == "raw"


# ═══════════════════════════════════════════════════════════════════════════
# 7. MULTI-ACTION SEQUENCES (ORDER PRESERVATION)
# ═══════════════════════════════════════════════════════════════════════════

class TestMultiActionSequences:
    """Verify position-ordered parsing preserves execution order."""

    def test_click_then_type(self):
        code = "pyautogui.click(100, 200)\npyautogui.write('hello')"
        actions = parse_pyautogui_code(code)
        assert len(actions) == 2
        types = {a.action_type for a in actions}
        assert "click" in types
        assert "type_text" in types

    def test_search_then_click(self):
        code = 'search("google.com")\npyautogui.click(500, 300)'
        actions = parse_pyautogui_code(code)
        types = [a.action_type for a in actions]
        assert types == ["search", "click"]

    def test_credential_flow(self):
        """All expected action types should be present."""
        code = (
            "pyautogui.click(640, 300)\n"
            'lookup_credential("gmail.com")\n'
            'fill_credential_field("gmail.com", "username")\n'
            "pyautogui.click(640, 400)\n"
            'fill_credential_field("gmail.com", "password")\n'
            "pyautogui.press('enter')"
        )
        actions = parse_pyautogui_code(code)
        types = [a.action_type for a in actions]
        assert types.count("click") == 2
        assert types.count("credential_lookup") == 1
        assert types.count("fill_credential_field") == 2
        assert types.count("key_press") == 1
        assert len(actions) == 6

    def test_mixed_desktop_and_intercepted(self):
        code = (
            'search("best pizza NYC")\n'
            "pyautogui.click(300, 200)\n"
            "pyautogui.write('order pepperoni')\n"
            "pyautogui.hotkey('ctrl', 'enter')"
        )
        actions = parse_pyautogui_code(code)
        assert len(actions) == 4
        types = {a.action_type for a in actions}
        assert types == {"search", "click", "type_text", "key_combo"}


# ═══════════════════════════════════════════════════════════════════════════
# 8. EXECUTE_ACTION — PLATFORM ROUTING
# ═══════════════════════════════════════════════════════════════════════════

class TestExecuteActionPlatformRouting:
    """Verify execute_action routes commands correctly per platform."""

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_click_linux_uses_websocket(self, mock_svc):
        """Linux click should use WebSocket execute_command, not xdotool."""
        mock_svc.session_data = {"m1": _mock_session(os_type="linux")}
        mock_svc.execute_command = AsyncMock(return_value={"success": True})

        action = ActionCommand("click", {"x": 100, "y": 200, "button": "left"})
        result = await execute_action("m1", action)

        assert result["success"] is True
        mock_svc.execute_command.assert_called_once()
        call_args = mock_svc.execute_command.call_args
        assert call_args[0][1] == "click"

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_click_windows_uses_websocket(self, mock_svc):
        """Windows Electron click should use WebSocket."""
        mock_svc.session_data = {"m1": _mock_session(is_electron=True, platform="win32")}
        mock_svc.execute_command = AsyncMock(return_value={"success": True})

        action = ActionCommand("click", {"x": 100, "y": 200, "button": "left"})
        result = await execute_action("m1", action)

        assert result["success"] is True
        mock_svc.execute_command.assert_called_once()

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_key_press_linux_uses_xdotool(self, mock_svc):
        """Linux key_press should use xdotool via terminal_execute."""
        mock_svc.session_data = {"m1": _mock_session(os_type="linux")}
        mock_svc.execute_command = AsyncMock(return_value={"success": True})

        action = ActionCommand("key_press", {"keys": ["enter"]})
        result = await execute_action("m1", action)

        assert result["success"] is True
        call_args = mock_svc.execute_command.call_args
        assert call_args[0][1] == "terminal_execute"
        assert "xdotool key -- Return" in call_args[0][2]["command"]

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_key_press_windows_uses_native(self, mock_svc):
        """Windows Electron key_press should use native WebSocket command."""
        mock_svc.session_data = {"m1": _mock_session(is_electron=True, platform="win32")}
        mock_svc.execute_command = AsyncMock(return_value={"success": True})

        action = ActionCommand("key_press", {"keys": ["enter"]})
        result = await execute_action("m1", action)

        assert result["success"] is True
        call_args = mock_svc.execute_command.call_args
        assert call_args[0][1] == "key_press"
        assert call_args[0][2]["keys"] == ["enter"]

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_key_combo_linux_uses_xdotool(self, mock_svc):
        """Linux key_combo should use xdotool with mapped keys."""
        mock_svc.session_data = {"m1": _mock_session(os_type="linux")}
        mock_svc.execute_command = AsyncMock(return_value={"success": True})

        action = ActionCommand("key_combo", {"keys": ["ctrl", "c"]})
        result = await execute_action("m1", action)

        call_args = mock_svc.execute_command.call_args
        assert "xdotool key -- ctrl+c" in call_args[0][2]["command"]

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_key_combo_macos_uses_native(self, mock_svc):
        """macOS Electron key_combo should use native WebSocket command."""
        mock_svc.session_data = {"m1": _mock_session(is_electron=True, platform="darwin")}
        mock_svc.execute_command = AsyncMock(return_value={"success": True})

        action = ActionCommand("key_combo", {"keys": ["command", "c"]})
        result = await execute_action("m1", action)

        call_args = mock_svc.execute_command.call_args
        assert call_args[0][1] == "key_combo"
        assert call_args[0][2]["keys"] == ["command", "c"]

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_type_text_all_platforms(self, mock_svc):
        """type_text should use WebSocket 'type' on all platforms."""
        for session in [
            _mock_session(os_type="linux"),
            _mock_session(is_electron=True, platform="win32"),
            _mock_session(is_electron=True, platform="darwin"),
        ]:
            mock_svc.session_data = {"m1": session}
            mock_svc.execute_command = AsyncMock(return_value={"success": True})

            action = ActionCommand("type_text", {"text": "hello"})
            result = await execute_action("m1", action)

            assert result["success"] is True
            call_args = mock_svc.execute_command.call_args
            assert call_args[0][1] == "type"

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_scroll_linux_uses_xdotool(self, mock_svc):
        """Linux scroll should use xdotool button 4/5."""
        mock_svc.session_data = {"m1": _mock_session(os_type="linux")}
        mock_svc.execute_command = AsyncMock(return_value={"success": True})

        action = ActionCommand("scroll", {"clicks": -3, "direction": "vertical"})
        result = await execute_action("m1", action)

        call_args = mock_svc.execute_command.call_args
        cmd = call_args[0][2]["command"]
        assert "xdotool click" in cmd
        # -3 = scroll down = button 5
        assert "5" in cmd

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_scroll_windows_uses_native(self, mock_svc):
        """Windows scroll should use native WebSocket command."""
        mock_svc.session_data = {"m1": _mock_session(is_electron=True, platform="win32")}
        mock_svc.execute_command = AsyncMock(return_value={"success": True})

        action = ActionCommand("scroll", {"clicks": 3, "direction": "vertical"})
        result = await execute_action("m1", action)

        call_args = mock_svc.execute_command.call_args
        assert call_args[0][1] == "scroll"

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_drag_linux_uses_xdotool_midpoint(self, mock_svc):
        """Linux drag should use xdotool with midpoint for smoothness."""
        mock_svc.session_data = {"m1": _mock_session(os_type="linux")}
        mock_svc.execute_command = AsyncMock(return_value={"success": True})

        action = ActionCommand("drag", {
            "x1": 100, "y1": 200, "x2": 300, "y2": 400, "button": "left",
        })
        result = await execute_action("m1", action)

        call_args = mock_svc.execute_command.call_args
        cmd = call_args[0][2]["command"]
        # Should contain midpoint (200, 300)
        assert "200 300" in cmd
        assert "xdotool mousedown" in cmd
        assert "xdotool mouseup" in cmd


# ═══════════════════════════════════════════════════════════════════════════
# 9. HOLD-KEYS CLICK — THE CRITICAL FIX
# ═══════════════════════════════════════════════════════════════════════════

class TestHoldKeysClick:
    """Verify that click-with-modifiers uses the correct mechanism per platform.

    This is a critical test for the bug fix: non-Linux platforms were using
    key_press (press-and-release) instead of holding the modifier during click.
    """

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_hold_click_linux_uses_xdotool_keydown(self, mock_svc):
        """Linux hold_keys click should use xdotool keydown/keyup."""
        mock_svc.session_data = {"m1": _mock_session(os_type="linux")}
        mock_svc.execute_command = AsyncMock(return_value={"success": True})

        action = ActionCommand("click", {
            "x": 100, "y": 200, "button": "left", "hold_keys": ["shift"],
        })
        result = await execute_action("m1", action)

        call_args = mock_svc.execute_command.call_args
        cmd = call_args[0][2]["command"]
        assert "xdotool keydown shift" in cmd
        assert "xdotool keyup shift" in cmd
        assert "xdotool mousemove" in cmd
        assert "xdotool click" in cmd

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_hold_click_windows_uses_click_with_modifiers(self, mock_svc):
        """Windows hold_keys click should use click_with_modifiers command."""
        mock_svc.session_data = {"m1": _mock_session(is_electron=True, platform="win32")}
        mock_svc.execute_command = AsyncMock(return_value={"success": True})

        action = ActionCommand("click", {
            "x": 100, "y": 200, "button": "left", "hold_keys": ["shift"],
        })
        result = await execute_action("m1", action)

        call_args = mock_svc.execute_command.call_args
        assert call_args[0][1] == "click_with_modifiers"
        assert call_args[0][2]["hold_keys"] == ["shift"]
        assert call_args[0][2]["x"] == 100
        assert call_args[0][2]["y"] == 200

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_hold_click_macos_uses_click_with_modifiers(self, mock_svc):
        """macOS hold_keys click should use click_with_modifiers command."""
        mock_svc.session_data = {"m1": _mock_session(is_electron=True, platform="darwin")}
        mock_svc.execute_command = AsyncMock(return_value={"success": True})

        action = ActionCommand("click", {
            "x": 500, "y": 300, "button": "left",
            "hold_keys": ["command", "shift"],
        })
        result = await execute_action("m1", action)

        call_args = mock_svc.execute_command.call_args
        assert call_args[0][1] == "click_with_modifiers"
        assert set(call_args[0][2]["hold_keys"]) == {"command", "shift"}

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_hold_click_passes_clicks_count(self, mock_svc):
        """click_with_modifiers should pass the clicks count."""
        mock_svc.session_data = {"m1": _mock_session(is_electron=True, platform="win32")}
        mock_svc.execute_command = AsyncMock(return_value={"success": True})

        action = ActionCommand("click", {
            "x": 100, "y": 200, "button": "left",
            "hold_keys": ["ctrl"], "clicks": 2,
        })
        result = await execute_action("m1", action)

        call_args = mock_svc.execute_command.call_args
        assert call_args[0][2]["clicks"] == 2

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_no_hold_keys_click_unchanged(self, mock_svc):
        """Click without hold_keys should use normal click command."""
        mock_svc.session_data = {"m1": _mock_session(is_electron=True, platform="win32")}
        mock_svc.execute_command = AsyncMock(return_value={"success": True})

        action = ActionCommand("click", {"x": 100, "y": 200, "button": "left"})
        result = await execute_action("m1", action)

        call_args = mock_svc.execute_command.call_args
        assert call_args[0][1] == "click"  # Normal click, not click_with_modifiers


# ═══════════════════════════════════════════════════════════════════════════
# 10. RAW EXECUTION — PLATFORM ROUTING
# ═══════════════════════════════════════════════════════════════════════════

class TestRawExecution:
    """Verify raw code execution routes correctly per platform."""

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_raw_linux_uses_shell(self, mock_svc):
        """Linux raw should use terminal_execute via _run_shell."""
        mock_svc.session_data = {"m1": _mock_session(os_type="linux")}
        mock_svc.execute_command = AsyncMock(return_value={"success": True})

        action = ActionCommand("raw", {"code": "print('hello')"})
        result = await execute_action("m1", action)

        call_args = mock_svc.execute_command.call_args
        assert call_args[0][1] == "terminal_execute"
        assert "base64" in call_args[0][2]["command"]

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_raw_windows_uses_terminal_execute(self, mock_svc):
        """Windows raw should use terminal_execute with base64."""
        mock_svc.session_data = {"m1": _mock_session(is_electron=True, platform="win32")}
        mock_svc.execute_command = AsyncMock(return_value={"success": True})

        action = ActionCommand("raw", {"code": "print('hello')"})
        result = await execute_action("m1", action)

        call_args = mock_svc.execute_command.call_args
        assert call_args[0][1] == "terminal_execute"
        assert "base64" in call_args[0][2]["command"]


# ═══════════════════════════════════════════════════════════════════════════
# 11. RETRY LOGIC
# ═══════════════════════════════════════════════════════════════════════════

class TestRetryLogic:
    """Verify execute_action retry behavior."""

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_retries_on_failure(self, mock_svc):
        """Should retry up to max_retries times on failure."""
        mock_svc.session_data = {"m1": _mock_session(os_type="linux")}
        mock_svc.execute_command = AsyncMock(
            side_effect=[
                Exception("timeout"),
                Exception("timeout"),
                {"success": True},
            ]
        )

        action = ActionCommand("click", {"x": 100, "y": 200, "button": "left"})
        result = await execute_action("m1", action, max_retries=2)

        assert result["success"] is True
        assert mock_svc.execute_command.call_count == 3

    @pytest.mark.asyncio
    @patch("app.services.cua_action_bridge.vm_control_service")
    async def test_no_retry_for_terminal_actions(self, mock_svc):
        """done/fail/wait should not be retried."""
        for action_type in ("done", "fail", "wait"):
            action = ActionCommand(action_type, {"seconds": 1} if action_type == "wait" else {})
            result = await execute_action("m1", action, max_retries=2)
            assert result["success"] is True
