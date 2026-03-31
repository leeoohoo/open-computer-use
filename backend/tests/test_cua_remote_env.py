"""Tests for RemoteVMController Windows command handling.

Verifies:
- Python script execution builds correct PowerShell path (Join-Path, not single-quoted $env:TEMP)
- Double powershell.exe wrapper is stripped
- Bash-style \\$ escaping is converted to $ for PowerShell
- Bash-only syntax on Windows is detected and wrapped via Python/Git Bash fallback
- Linux commands pass through unchanged
"""

import asyncio
import base64
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.cua_remote_env import RemoteVMController, RemoteVMEnv


# ═══════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════

def make_controller(platform: str = "windows") -> RemoteVMController:
    """Create a controller with a real event loop for testing."""
    loop = asyncio.new_event_loop()
    ctrl = RemoteVMController("test-machine-id", loop, platform=platform)
    ctrl._terminal_connected = True  # skip terminal connect
    return ctrl


def make_execute_mock(success: bool = True, output: str = "ok"):
    """Create a mock for vm_control_service.execute_command."""
    mock = AsyncMock(return_value={
        "success": success,
        "output": output,
        "error": "",
    })
    return mock


# ═══════════════════════════════════════════════════════════════════════════
# 1. PYTHON SCRIPT EXECUTION — WINDOWS PATH FIX
# ═══════════════════════════════════════════════════════════════════════════

class TestAsyncRunPythonWindows:
    """Verify _async_run_python builds correct PowerShell command on Windows."""

    @pytest.mark.asyncio
    async def test_uses_join_path_not_single_quotes(self):
        """$env:TEMP must be expanded — uses Join-Path, not single-quoted path."""
        ctrl = make_controller("windows")
        mock_exec = make_execute_mock()

        with patch("app.services.cua_remote_env.vm_control_service") as mock_vm:
            mock_vm.execute_command = mock_exec
            await ctrl._async_run_python("print('hello')")

            # Get the command that was sent
            call_args = mock_exec.call_args
            cmd = call_args[0][2]["command"]  # 3rd positional arg is params dict

            # Must use Join-Path for proper path construction
            assert "Join-Path" in cmd, f"Expected Join-Path in command, got: {cmd}"
            # Must NOT have single-quoted $env:TEMP (the old bug)
            assert "'$env:TEMP\\" not in cmd, f"Found single-quoted $env:TEMP in: {cmd}"
            # Must contain base64 encoded script
            encoded = base64.b64encode(b"print('hello')").decode()
            assert encoded in cmd

    @pytest.mark.asyncio
    async def test_script_path_variable_used(self):
        """Should define $scriptPath and use it in WriteAllBytes and python call."""
        ctrl = make_controller("windows")
        mock_exec = make_execute_mock()

        with patch("app.services.cua_remote_env.vm_control_service") as mock_vm:
            mock_vm.execute_command = mock_exec
            await ctrl._async_run_python("x = 1")

            cmd = mock_exec.call_args[0][2]["command"]
            assert "$scriptPath" in cmd
            assert "WriteAllBytes($scriptPath" in cmd
            assert "python $scriptPath" in cmd

    @pytest.mark.asyncio
    async def test_linux_uses_base64_pipeline(self):
        """Linux path should use echo | base64 -d pipeline, not PowerShell."""
        ctrl = make_controller("linux")
        mock_exec = make_execute_mock()

        with patch("app.services.cua_remote_env.vm_control_service") as mock_vm:
            mock_vm.execute_command = mock_exec
            await ctrl._async_run_python("print('hi')")

            cmd = mock_exec.call_args[0][2]["command"]
            assert "base64 -d" in cmd
            assert "/tmp/_cua_script.py" in cmd
            assert "python3" in cmd
            assert "Join-Path" not in cmd


# ═══════════════════════════════════════════════════════════════════════════
# 2. BASH SCRIPT EXECUTION — DOUBLE POWERSHELL WRAPPER STRIPPING
# ═══════════════════════════════════════════════════════════════════════════

class TestStripPowershellWrapper:
    """Verify redundant powershell.exe -Command prefix is stripped on Windows."""

    @pytest.mark.asyncio
    async def test_strips_powershell_command_prefix(self):
        """powershell.exe -Command 'Get-Process' → just Get-Process."""
        ctrl = make_controller("windows")
        mock_exec = make_execute_mock()

        with patch("app.services.cua_remote_env.vm_control_service") as mock_vm:
            mock_vm.execute_command = mock_exec
            await ctrl._async_run_bash(
                'powershell.exe -Command "Get-Process"', timeout=30
            )

            cmd = mock_exec.call_args[0][2]["command"]
            # Should NOT have double powershell.exe invocation
            assert not cmd.strip().lower().startswith("powershell"), \
                f"Expected stripped wrapper, got: {cmd}"
            assert "Get-Process" in cmd

    @pytest.mark.asyncio
    async def test_strips_noProfile_bypass_prefix(self):
        """powershell.exe -NoProfile -ExecutionPolicy Bypass -Command should be stripped."""
        ctrl = make_controller("windows")
        mock_exec = make_execute_mock()

        with patch("app.services.cua_remote_env.vm_control_service") as mock_vm:
            mock_vm.execute_command = mock_exec
            await ctrl._async_run_bash(
                'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$x = 1; Write-Host $x"',
                timeout=30,
            )

            cmd = mock_exec.call_args[0][2]["command"]
            assert not cmd.strip().lower().startswith("powershell")
            assert "$x = 1" in cmd

    @pytest.mark.asyncio
    async def test_strips_single_quoted_wrapper(self):
        """powershell.exe -Command '...' with single quotes should strip quotes."""
        ctrl = make_controller("windows")
        mock_exec = make_execute_mock()

        with patch("app.services.cua_remote_env.vm_control_service") as mock_vm:
            mock_vm.execute_command = mock_exec
            await ctrl._async_run_bash(
                "powershell.exe -Command 'Get-Date'", timeout=30
            )

            cmd = mock_exec.call_args[0][2]["command"]
            assert cmd.strip() == "Get-Date"

    @pytest.mark.asyncio
    async def test_no_stripping_on_linux(self):
        """Linux commands should never be stripped, even if they mention powershell."""
        ctrl = make_controller("linux")
        mock_exec = make_execute_mock()

        with patch("app.services.cua_remote_env.vm_control_service") as mock_vm:
            mock_vm.execute_command = mock_exec
            await ctrl._async_run_bash("echo hello", timeout=30)

            cmd = mock_exec.call_args[0][2]["command"]
            assert cmd == "echo hello"


# ═══════════════════════════════════════════════════════════════════════════
# 3. BASH-STYLE DOLLAR ESCAPING FIX
# ═══════════════════════════════════════════════════════════════════════════

class TestDollarEscapingFix:
    """Verify \\$ → $ conversion on Windows."""

    @pytest.mark.asyncio
    async def test_fixes_escaped_dollar_signs(self):
        """\\$log.IsEnabled should become $log.IsEnabled for PowerShell."""
        ctrl = make_controller("windows")
        mock_exec = make_execute_mock()

        with patch("app.services.cua_remote_env.vm_control_service") as mock_vm:
            mock_vm.execute_command = mock_exec
            await ctrl._async_run_bash(
                'Write-Host "Value: \\$log.IsEnabled"', timeout=30
            )

            cmd = mock_exec.call_args[0][2]["command"]
            assert "\\$" not in cmd, f"Escaped dollars not fixed: {cmd}"
            assert "$log.IsEnabled" in cmd

    @pytest.mark.asyncio
    async def test_multiple_escaped_dollars(self):
        """Multiple \\$ should all be fixed."""
        ctrl = make_controller("windows")
        mock_exec = make_execute_mock()

        with patch("app.services.cua_remote_env.vm_control_service") as mock_vm:
            mock_vm.execute_command = mock_exec
            await ctrl._async_run_bash(
                '\\$today = (Get-Date).Date; \\$tomorrow = \\$today.AddDays(1)',
                timeout=30,
            )

            cmd = mock_exec.call_args[0][2]["command"]
            assert "\\$" not in cmd
            assert "$today" in cmd
            assert "$tomorrow" in cmd

    @pytest.mark.asyncio
    async def test_no_dollar_escaping_on_linux(self):
        """Linux should NOT fix \\$ — that's valid bash escaping."""
        ctrl = make_controller("linux")
        mock_exec = make_execute_mock()

        with patch("app.services.cua_remote_env.vm_control_service") as mock_vm:
            mock_vm.execute_command = mock_exec
            await ctrl._async_run_bash('echo "\\$HOME"', timeout=30)

            cmd = mock_exec.call_args[0][2]["command"]
            assert "\\$HOME" in cmd  # Should preserve bash escaping


# ═══════════════════════════════════════════════════════════════════════════
# 4. BASH SYNTAX DETECTION ON WINDOWS
# ═══════════════════════════════════════════════════════════════════════════

class TestBashSyntaxDetection:
    """Verify bash-only commands on Windows are detected and wrapped."""

    @pytest.mark.asyncio
    async def test_heredoc_detected(self):
        """Heredoc (<<) should trigger bash wrapping on Windows."""
        ctrl = make_controller("windows")
        mock_exec = make_execute_mock()

        with patch("app.services.cua_remote_env.vm_control_service") as mock_vm:
            mock_vm.execute_command = mock_exec
            await ctrl._async_run_bash(
                "cat > /tmp/test.txt << 'EOF'\nhello\nEOF", timeout=30
            )

            # Should have been routed through _async_run_python (base64 encoded)
            cmd = mock_exec.call_args[0][2]["command"]
            # The Python wrapper goes through _async_run_python which uses base64
            assert "FromBase64String" in cmd or "base64" in cmd.lower(), \
                f"Expected Python wrapper for bash on Windows, got: {cmd[:200]}"

    @pytest.mark.asyncio
    async def test_tmp_path_detected(self):
        """/tmp/ paths should trigger bash wrapping on Windows."""
        ctrl = make_controller("windows")
        mock_exec = make_execute_mock()

        with patch("app.services.cua_remote_env.vm_control_service") as mock_vm:
            mock_vm.execute_command = mock_exec
            await ctrl._async_run_bash("ls /tmp/myfile.txt", timeout=30)

            cmd = mock_exec.call_args[0][2]["command"]
            assert "FromBase64String" in cmd or "base64" in cmd.lower()

    @pytest.mark.asyncio
    async def test_sudo_detected(self):
        """sudo should trigger bash wrapping on Windows."""
        ctrl = make_controller("windows")
        mock_exec = make_execute_mock()

        with patch("app.services.cua_remote_env.vm_control_service") as mock_vm:
            mock_vm.execute_command = mock_exec
            await ctrl._async_run_bash("sudo apt-get update", timeout=30)

            cmd = mock_exec.call_args[0][2]["command"]
            assert "FromBase64String" in cmd or "base64" in cmd.lower()

    @pytest.mark.asyncio
    async def test_powershell_passthrough(self):
        """Pure PowerShell commands should pass through without wrapping."""
        ctrl = make_controller("windows")
        mock_exec = make_execute_mock()

        with patch("app.services.cua_remote_env.vm_control_service") as mock_vm:
            mock_vm.execute_command = mock_exec
            await ctrl._async_run_bash("Get-Process | Select-Object Name", timeout=30)

            cmd = mock_exec.call_args[0][2]["command"]
            # Should NOT be wrapped — pure PowerShell
            assert "Get-Process" in cmd
            assert "FromBase64String" not in cmd

    @pytest.mark.asyncio
    async def test_bash_on_linux_passthrough(self):
        """Bash commands on Linux should always pass through unchanged."""
        ctrl = make_controller("linux")
        mock_exec = make_execute_mock()

        with patch("app.services.cua_remote_env.vm_control_service") as mock_vm:
            mock_vm.execute_command = mock_exec
            code = "cat > /tmp/test.txt << 'EOF'\nhello\nEOF"
            await ctrl._async_run_bash(code, timeout=30)

            cmd = mock_exec.call_args[0][2]["command"]
            assert cmd == code  # Unchanged


# ═══════════════════════════════════════════════════════════════════════════
# 5. COMBINED SCENARIOS — REAL-WORLD ERROR PATTERNS
# ═══════════════════════════════════════════════════════════════════════════

class TestRealWorldErrorPatterns:
    """Test against the actual error patterns from the bug report."""

    @pytest.mark.asyncio
    async def test_writeallbytes_env_temp_path(self):
        """Original bug: WriteAllBytes('$env:TEMP\\_cua_script.py') failed.
        Now uses Join-Path so $env:TEMP expands correctly."""
        ctrl = make_controller("windows")
        mock_exec = make_execute_mock()

        with patch("app.services.cua_remote_env.vm_control_service") as mock_vm:
            mock_vm.execute_command = mock_exec
            await ctrl._async_run_python("import subprocess\nprint('test')")

            cmd = mock_exec.call_args[0][2]["command"]
            # The old broken pattern must not appear
            assert "'$env:TEMP\\_cua_script.py'" not in cmd
            assert "'$env:TEMP\\" not in cmd
            # The fix pattern must be present
            assert "Join-Path" in cmd
            assert "$scriptPath" in cmd

    @pytest.mark.asyncio
    async def test_double_powershell_with_escaped_dollars(self):
        """Real error: powershell.exe -Command "... \\$log.IsEnabled ..."
        wrapped again by Electron's powershell.exe -Command."""
        ctrl = make_controller("windows")
        mock_exec = make_execute_mock()

        code = (
            'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "'
            '\\$today = (Get-Date).Date\n'
            '\\$log = Get-WinEvent -ListLog \'Microsoft-Windows-PrintService/Operational\'\n'
            'Write-Host \\"Log IsEnabled: \\$(\\$log.IsEnabled)\\""'
        )

        with patch("app.services.cua_remote_env.vm_control_service") as mock_vm:
            mock_vm.execute_command = mock_exec
            await ctrl._async_run_bash(code, timeout=30)

            cmd = mock_exec.call_args[0][2]["command"]
            # Should have stripped the powershell.exe prefix
            assert not cmd.strip().lower().startswith("powershell")
            # Should have fixed \$ escaping
            assert "\\$" not in cmd
            assert "$today" in cmd

    @pytest.mark.asyncio
    async def test_bash_heredoc_on_windows(self):
        """Real error: cat > /tmp/print_events.ps1 << 'PSEOF' sent to PowerShell."""
        ctrl = make_controller("windows")
        mock_exec = make_execute_mock()

        code = (
            "cat > /tmp/print_events.ps1 << 'PSEOF'\n"
            "$today = (Get-Date).Date\n"
            "Write-Host 'hello'\n"
            "PSEOF\n"
            "powershell.exe -File /tmp/print_events.ps1"
        )

        with patch("app.services.cua_remote_env.vm_control_service") as mock_vm:
            mock_vm.execute_command = mock_exec
            await ctrl._async_run_bash(code, timeout=30)

            cmd = mock_exec.call_args[0][2]["command"]
            # Should be wrapped as Python (detected heredoc + /tmp/)
            assert "FromBase64String" in cmd


# ═══════════════════════════════════════════════════════════════════════════
# 6. REMOTE VM ENV WRAPPER
# ═══════════════════════════════════════════════════════════════════════════

class TestRemoteVMEnv:
    """Verify RemoteVMEnv correctly wires platform to controller."""

    def test_creates_controller_with_platform(self):
        loop = asyncio.new_event_loop()
        env = RemoteVMEnv("machine-1", loop, platform="windows")
        assert env.controller.platform == "windows"
        assert env.controller.machine_id == "machine-1"
        loop.close()

    def test_default_platform_is_linux(self):
        loop = asyncio.new_event_loop()
        env = RemoteVMEnv("machine-2", loop)
        assert env.controller.platform == "linux"
        loop.close()
