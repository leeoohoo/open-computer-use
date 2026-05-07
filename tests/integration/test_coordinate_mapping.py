import os
import subprocess
import unittest
from base64 import b64decode
from io import BytesIO
from pathlib import Path
from types import SimpleNamespace
from tempfile import TemporaryDirectory
from unittest.mock import patch

from PIL import Image

from executor.client.desktop.controller import DesktopController
from shared.schemas.desktop import (
    AccessibilitySnapshotResponse,
    AppDescriptor,
    CaptureRegion,
    CoordinateTarget,
    UIElementBounds,
    UIElementNode,
    UIWindowDescriptor,
)


class PreviewController(DesktopController):
    def _preflight_screen_capture_access(self):  # type: ignore[override]
        return True

    def _take_screenshot_image(self, display_id=None):  # type: ignore[override]
        image = Image.new("RGB", (300, 200), (255, 255, 255))
        image.putpixel((150, 100), (255, 0, 0))
        return image

    def _read_monitor_geometry(self, display_id=None) -> tuple[int, int, int, int]:  # type: ignore[override]
        return (300, 200, 0, 0)


class AppInventoryController(DesktopController):
    def _read_installed_apps_by_key(self):  # type: ignore[override]
        from shared.schemas.desktop import AppDescriptor

        return {
            "safari": AppDescriptor(
                name="Safari",
                bundle_id="com.apple.Safari",
                path="/Applications/Safari.app",
                is_running=False,
                is_frontmost=False,
                pid=None,
            ),
            "finder": AppDescriptor(
                name="Finder",
                bundle_id="com.apple.finder",
                path="/System/Library/CoreServices/Finder.app",
                is_running=False,
                is_frontmost=False,
                pid=None,
            ),
        }

    def _read_running_apps_by_name(self):  # type: ignore[override]
        from shared.schemas.desktop import AppDescriptor

        return {
            "safari": AppDescriptor(
                name="Safari",
                bundle_id="com.apple.Safari",
                path="/Applications/Safari.app",
                is_running=True,
                is_frontmost=True,
                pid=123,
            )
        }


class AccessibilitySnapshotController(AppInventoryController):
    def __init__(self):
        super().__init__()
        self.snapshot_calls = 0
        self.ax_press_calls = 0
        self.ax_set_value_calls = 0
        self.fail_ax_press = False
        self.fail_ax_set_value = False

    def build_display_metadata(  # type: ignore[override]
        self,
        physical_width: int,
        physical_height: int,
        offset_x: int = 0,
        offset_y: int = 0,
        display_id: str | None = None,
    ):
        return super().build_display_metadata(
            physical_width=1000,
            physical_height=800,
            offset_x=0,
            offset_y=0,
            display_id=display_id,
        )

    def _read_monitor_geometry(self, display_id=None) -> tuple[int, int, int, int]:  # type: ignore[override]
        return (1000, 800, 0, 0)

    def _run_osascript(self, script: str) -> str:  # type: ignore[override]
        if "Captured accessibility snapshot" in script:
            self.snapshot_calls += 1
            return """
            {
              "message": "Captured accessibility snapshot for Safari.",
              "windows": [
                {
                  "title": "Example Page",
                  "role": "AXWindow",
                  "subrole": "AXStandardWindow",
                  "focused": true,
                  "bounds": {"x": 10, "y": 20, "width": 800, "height": 600},
                  "children": [
                    {
                      "role": "AXButton",
                      "subrole": "AXToolbarButton",
                      "title": "Reload",
                      "value": "",
                      "description": "Reload this page",
                      "enabled": true,
                      "focused": false,
                      "selected": false,
                      "actions": ["AXPress", "AXShowMenu"],
                      "bounds": {"x": 32, "y": 52, "width": 28, "height": 28},
                      "children": []
                    }
                  ]
                }
              ]
            }
            """
        return super()._run_osascript(script)

    def _preflight_accessibility_access(self):  # type: ignore[override]
        return True

    def _preflight_screen_capture_access(self):  # type: ignore[override]
        return True

    def click(self, target, button="left", clicks=1):  # type: ignore[override]
        self.last_click = {
            "target": target,
            "button": button,
            "clicks": clicks,
        }

    def hotkey(self, keys):  # type: ignore[override]
        self.last_hotkey = keys

    def press_key(self, key):  # type: ignore[override]
        self.last_key = key

    def type_text(self, text, interval=0.02):  # type: ignore[override]
        self.last_typed = {"text": text, "interval": interval}

    def capture_preview(self, target, crop_size=160, with_marker=True):  # type: ignore[override]
        preview = PreviewController().capture_preview(target, crop_size=crop_size, with_marker=with_marker)
        self.last_preview_target = target
        return preview

    def _take_screenshot_region_image(self, region):  # type: ignore[override]
        self.last_region_capture = region
        image = Image.new("RGB", (max(1, region.width), max(1, region.height)), (255, 255, 255))
        image.putpixel((min(image.size[0] - 1, 10), min(image.size[1] - 1, 10)), (255, 0, 0))
        return image

    def _perform_ax_press(self, app_name: str, element_id: str):  # type: ignore[override]
        self.ax_press_calls += 1
        self.last_ax_press = {"app_name": app_name, "element_id": element_id, "action_name": "AXPress"}
        if self.fail_ax_press:
            raise RuntimeError("AXPress failed")

    def _perform_ax_action(self, app_name: str, element_id: str, action_name: str):  # type: ignore[override]
        self.ax_press_calls += 1
        self.last_ax_press = {"app_name": app_name, "element_id": element_id, "action_name": action_name}
        if self.fail_ax_press:
            raise RuntimeError(f"{action_name} failed")

    def _set_ax_value(self, app_name: str, element_id: str, value: str):  # type: ignore[override]
        self.ax_set_value_calls += 1
        self.last_ax_set_value = {"app_name": app_name, "element_id": element_id, "value": value}
        if self.fail_ax_set_value:
            raise RuntimeError("AXValue set failed")


class FinderRecoveryController(AppInventoryController):
    def __init__(self):
        super().__init__()
        self.snapshot_calls = 0
        self.ensure_calls = 0

    def _preflight_accessibility_access(self):  # type: ignore[override]
        return True

    def _run_osascript(self, script: str) -> str:  # type: ignore[override]
        if "Captured accessibility snapshot" in script:
            self.snapshot_calls += 1
            if self.snapshot_calls == 1:
                return """
                {
                  "message": "Captured accessibility snapshot for Finder.",
                  "windows": []
                }
                """
            return """
            {
              "message": "Captured accessibility snapshot for Finder.",
              "windows": [
                {
                  "title": "Finder",
                  "role": "AXWindow",
                  "subrole": "AXStandardWindow",
                  "focused": true,
                  "bounds": {"x": 0, "y": 0, "width": 1200, "height": 800},
                  "children": []
                }
              ]
            }
            """
        if 'tell application id "com.apple.finder"' in script:
            self.ensure_calls += 1
            return ""
        return super()._run_osascript(script)


class FilesystemAppInventoryController(DesktopController):
    def __init__(self, root: Path):
        super().__init__()
        self.root = root

    def _iter_application_paths(self):  # type: ignore[override]
        return sorted(self.root.rglob("*.app"))


class RunningAppsController(DesktopController):
    def __init__(self, frontmost_name: str | None = "Finder"):
        super().__init__()
        self.frontmost_name = frontmost_name

    def _read_frontmost_app_name(self):  # type: ignore[override]
        return self.frontmost_name

    def _read_bundle_info(self, app_path: Path):  # type: ignore[override]
        if app_path.name == "Finder.app":
            return {
                "CFBundleDisplayName": "Finder",
                "CFBundleIdentifier": "com.apple.finder",
            }
        if app_path.name == "Safari.app":
            return {
                "CFBundleDisplayName": "Safari",
                "CFBundleIdentifier": "com.apple.Safari",
            }
        return {}


class FeishuAliasController(DesktopController):
    def _preflight_accessibility_access(self):  # type: ignore[override]
        return True

    def _read_installed_apps_by_key(self):  # type: ignore[override]
        from shared.schemas.desktop import AppDescriptor

        return {
            "com.electron.lark": AppDescriptor(
                name="Lark",
                bundle_id="com.electron.lark",
                path="/Applications/Lark.app",
                is_running=False,
                is_frontmost=False,
                pid=None,
            )
        }

    def _read_running_apps_by_name(self):  # type: ignore[override]
        from shared.schemas.desktop import AppDescriptor

        return {
            "lark": AppDescriptor(
                name="Lark",
                bundle_id="com.electron.lark",
                path="/Applications/Lark.app",
                is_running=True,
                is_frontmost=False,
                pid=2052,
            )
        }

    def _read_frontmost_app_name(self):  # type: ignore[override]
        return "Feishu"

    def _run_osascript(self, script: str) -> str:  # type: ignore[override]
        if 'tell process "Lark"' in script:
            raise RuntimeError("osascript failed; stderr=Process not found: Lark (-2700)")
        if 'tell process "Feishu"' in script:
            return """
            {
              "message": "Captured accessibility snapshot for Feishu.",
              "windows": [
                {
                  "title": "Chat",
                  "role": "AXWindow",
                  "subrole": "AXStandardWindow",
                  "focused": true,
                  "bounds": {"x": 0, "y": 0, "width": 900, "height": 700},
                  "children": []
                }
              ]
            }
            """
        return super()._run_osascript(script)


class LinuxAppInventoryController(DesktopController):
    def __init__(self):
        super().__init__()
        self.clipboard_text = None
        self.last_hotkey = None
        self.last_key = None

    def build_display_metadata(  # type: ignore[override]
        self,
        physical_width: int,
        physical_height: int,
        offset_x: int = 0,
        offset_y: int = 0,
        display_id: str | None = None,
    ):
        return super().build_display_metadata(
            physical_width=1000,
            physical_height=800,
            offset_x=0,
            offset_y=0,
            display_id=display_id,
        )

    def _read_monitor_geometry(self, display_id=None) -> tuple[int, int, int, int]:  # type: ignore[override]
        return (1000, 800, 0, 0)

    def _read_installed_apps_by_key(self):  # type: ignore[override]
        from shared.schemas.desktop import AppDescriptor

        return {
            "org.gnome.nautilus": AppDescriptor(
                name="Files",
                bundle_id="org.gnome.Nautilus",
                path="/usr/share/applications/org.gnome.Nautilus.desktop",
                is_running=False,
                is_frontmost=False,
                pid=None,
            ),
            "firefox": AppDescriptor(
                name="Firefox",
                bundle_id="firefox",
                path="/usr/share/applications/firefox.desktop",
                is_running=False,
                is_frontmost=False,
                pid=None,
            ),
        }

    def _read_running_apps_by_name(self):  # type: ignore[override]
        from shared.schemas.desktop import AppDescriptor

        return {
            "firefox": AppDescriptor(
                name="Firefox",
                bundle_id="firefox",
                path="/usr/share/applications/firefox.desktop",
                is_running=True,
                is_frontmost=True,
                pid=222,
            )
        }

    def _read_frontmost_app_name(self):  # type: ignore[override]
        return "Firefox"

    def _write_text_to_clipboard_linux(self, text: str) -> None:  # type: ignore[override]
        self.clipboard_text = text

    def _command_exists(self, name: str) -> bool:  # type: ignore[override]
        return name in {"gtk-launch", "xdotool"}

    def hotkey(self, keys):  # type: ignore[override]
        self.last_hotkey = keys

    def press_key(self, key):  # type: ignore[override]
        self.last_key = key


def build_fake_snapshot(app_name: str = "Firefox") -> AccessibilitySnapshotResponse:
    return AccessibilitySnapshotResponse(
        app=AppDescriptor(
            name=app_name,
            bundle_id=app_name.lower(),
            path=f"/usr/share/applications/{app_name.lower()}.desktop",
            is_running=True,
            is_frontmost=True,
            pid=100,
        ),
        windows=[
            UIWindowDescriptor(
                window_id="window-1",
                title="Example",
                role="window",
                subrole=None,
                bounds=UIElementBounds(x=10, y=20, width=800, height=600),
                focused=True,
                children=[
                    UIElementNode(
                        element_id="window-1/child-1",
                        role="button",
                        subrole=None,
                        title="Reload",
                        value=None,
                        description=None,
                        enabled=True,
                        focused=False,
                        selected=False,
                        interactable=True,
                        available_actions=["click"],
                        bounds=UIElementBounds(x=32, y=52, width=28, height=28),
                        children=[],
                    )
                ],
            )
        ],
        message=f"Captured accessibility snapshot for {app_name}.",
    )


class LinuxDesktopEntryController(DesktopController):
    def __init__(self, root: Path):
        super().__init__()
        self.root = root

    def _iter_linux_application_entry_paths(self):  # type: ignore[override]
        return sorted(self.root.rglob("*.desktop"))


class ProcessRootSnapshotController(AppInventoryController):
    def __init__(self):
        super().__init__()
        self.snapshot_calls = 0

    def _preflight_accessibility_access(self):  # type: ignore[override]
        return True

    def build_display_metadata(  # type: ignore[override]
        self,
        physical_width: int,
        physical_height: int,
        offset_x: int = 0,
        offset_y: int = 0,
        display_id: str | None = None,
    ):
        return super().build_display_metadata(
            physical_width=1000,
            physical_height=800,
            offset_x=0,
            offset_y=0,
            display_id=display_id,
        )

    def _read_monitor_geometry(self, display_id=None) -> tuple[int, int, int, int]:  # type: ignore[override]
        return (1000, 800, 0, 0)

    def _run_osascript(self, script: str) -> str:  # type: ignore[override]
        if "Captured accessibility snapshot" in script:
            self.snapshot_calls += 1
            return """
            {
              "message": "Captured accessibility snapshot for Feishu.",
              "windows": [
                {
                  "window_id": "window-0",
                  "title": "Feishu",
                  "role": "AXApplication",
                  "subrole": "AXProcessRoot",
                  "focused": true,
                  "children": [
                    {
                      "role": "AXButton",
                      "subrole": "",
                      "title": "Open Chat",
                      "value": "",
                      "description": "",
                      "enabled": true,
                      "focused": false,
                      "selected": false,
                      "actions": ["AXPress"],
                      "bounds": {"x": 100, "y": 200, "width": 80, "height": 30},
                      "children": []
                    }
                  ]
                }
              ]
            }
            """
        return super()._run_osascript(script)


class FakeMSS:
    def __init__(self, monitors):
        self.monitors = monitors


class FakeMSSContext(FakeMSS):
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class CoordinateMappingTests(unittest.TestCase):
    def setUp(self) -> None:
        self._env = dict(os.environ)

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self._env)

    def test_build_display_metadata_applies_scale(self) -> None:
        os.environ["CUA_DISPLAY_SCALE_X"] = "2"
        os.environ["CUA_DISPLAY_SCALE_Y"] = "2"
        controller = DesktopController()

        display = controller.build_display_metadata(
            physical_width=2880,
            physical_height=1800,
        )

        self.assertEqual(display.logical_width, 1440)
        self.assertEqual(display.logical_height, 900)
        self.assertEqual(display.scale_x, 2.0)
        self.assertEqual(display.scale_y, 2.0)

    def test_logical_to_physical_applies_scale_and_offset(self) -> None:
        os.environ["CUA_DISPLAY_SCALE_X"] = "2"
        os.environ["CUA_DISPLAY_SCALE_Y"] = "2"
        controller = DesktopController()

        display = controller.build_display_metadata(
            physical_width=1920,
            physical_height=1080,
            offset_x=100,
            offset_y=50,
        )

        mapped = controller.logical_to_physical(
            CoordinateTarget(x=10, y=20, display_id="main"),
            display=display,
        )

        self.assertEqual(mapped.x, 120)
        self.assertEqual(mapped.y, 90)

    def test_physical_to_logical_applies_scale_and_offset(self) -> None:
        os.environ["CUA_DISPLAY_SCALE_X"] = "2"
        os.environ["CUA_DISPLAY_SCALE_Y"] = "2"
        controller = DesktopController()

        display = controller.build_display_metadata(
            physical_width=1920,
            physical_height=1080,
            offset_x=100,
            offset_y=50,
        )

        mapped = controller.physical_to_logical(
            CoordinateTarget(x=120, y=90, display_id="main"),
            display=display,
        )

        self.assertEqual(mapped.x, 10)
        self.assertEqual(mapped.y, 20)

    def test_build_preview_region_stays_within_image_bounds(self) -> None:
        controller = DesktopController()
        display = controller.build_display_metadata(
            physical_width=1920,
            physical_height=1080,
        )

        region = controller._build_preview_region(  # type: ignore[attr-defined]
            image_width=1920,
            image_height=1080,
            physical_target=CoordinateTarget(x=10, y=12, display_id="main"),
            display=display,
            crop_size=160,
        )

        self.assertGreaterEqual(region.left, 0)
        self.assertGreaterEqual(region.top, 0)
        self.assertGreater(region.width, 0)
        self.assertGreater(region.height, 0)
        self.assertLessEqual(region.left + region.width, 1920)
        self.assertLessEqual(region.top + region.height, 1080)

    def test_capture_preview_returns_png_crop_and_physical_target(self) -> None:
        controller = PreviewController()

        preview_image_base64, preview_region, display, physical_target, preview_marker = controller.capture_preview(
            CoordinateTarget(x=150, y=100, display_id="main"),
            crop_size=80,
        )

        preview_bytes = b64decode(preview_image_base64)
        image = Image.open(BytesIO(preview_bytes))

        self.assertEqual(display.logical_width, 300)
        self.assertEqual(display.logical_height, 200)
        self.assertEqual(physical_target.x, 150)
        self.assertEqual(physical_target.y, 100)
        self.assertGreater(preview_region.width, 0)
        self.assertGreater(preview_region.height, 0)
        self.assertEqual(image.size, (preview_region.width, preview_region.height))
        self.assertEqual(preview_marker.x, preview_region.width // 2)
        self.assertEqual(preview_marker.y, preview_region.height // 2)

        center_pixel = image.getpixel((preview_marker.x, preview_marker.y))
        self.assertNotEqual(center_pixel, (255, 255, 255))

    def test_get_primary_monitor_falls_back_to_first_entry(self) -> None:
        controller = DesktopController()
        monitor = controller._get_primary_monitor(  # type: ignore[attr-defined]
            FakeMSS([{"left": 1, "top": 2, "width": 3, "height": 4}])
        )

        self.assertEqual(monitor["left"], 1)
        self.assertEqual(monitor["width"], 3)

    def test_get_primary_monitor_prefers_virtual_desktop_bounds_by_default(self) -> None:
        controller = DesktopController()
        monitor = controller._get_primary_monitor(  # type: ignore[attr-defined]
            FakeMSS(
                [
                    {"left": -1728, "top": 0, "width": 6208, "height": 2160},
                    {"left": 0, "top": 0, "width": 2560, "height": 1440},
                    {"left": 2560, "top": 0, "width": 1920, "height": 1080},
                    {"left": -1728, "top": 0, "width": 1728, "height": 1117},
                ]
            )
        )

        self.assertEqual(monitor["left"], -1728)
        self.assertEqual(monitor["width"], 6208)

    def test_get_primary_monitor_can_force_primary_display_mode(self) -> None:
        os.environ["CUA_CAPTURE_DISPLAY_MODE"] = "primary"
        controller = DesktopController()
        monitor = controller._get_primary_monitor(  # type: ignore[attr-defined]
            FakeMSS(
                [
                    {"left": -1728, "top": 0, "width": 6208, "height": 2160},
                    {"left": 0, "top": 0, "width": 2560, "height": 1440},
                    {"left": 2560, "top": 0, "width": 1920, "height": 1080},
                ]
            )
        )

        self.assertEqual(monitor["left"], 0)
        self.assertEqual(monitor["width"], 2560)

    def test_list_display_metadata_returns_individual_displays(self) -> None:
        controller = DesktopController()
        fake_module = SimpleNamespace(
            mss=lambda: FakeMSSContext(
                [
                    {"left": -1728, "top": 0, "width": 6208, "height": 2160},
                    {"left": 0, "top": 0, "width": 2560, "height": 1440},
                    {"left": 2560, "top": 0, "width": 1920, "height": 1080},
                    {"left": -1728, "top": 0, "width": 1728, "height": 1117},
                ]
            )
        )

        with patch("executor.client.desktop.controller.MSS_AVAILABLE", True):
            with patch("executor.client.desktop.controller.mss", fake_module):
                displays = controller.list_display_metadata()

        self.assertEqual(len(displays), 3)
        self.assertEqual(displays[0].display_id, "display-1")
        self.assertEqual(displays[0].offset_x, 0)
        self.assertEqual(displays[1].offset_x, 2560)
        self.assertEqual(displays[2].offset_x, -1728)

    def test_get_display_metadata_supports_specific_display_id(self) -> None:
        controller = DesktopController()
        fake_module = SimpleNamespace(
            mss=lambda: FakeMSSContext(
                [
                    {"left": -1728, "top": 0, "width": 6208, "height": 2160},
                    {"left": 0, "top": 0, "width": 2560, "height": 1440},
                    {"left": 2560, "top": 0, "width": 1920, "height": 1080},
                ]
            )
        )

        with patch("executor.client.desktop.controller.MSS_AVAILABLE", True):
            with patch("executor.client.desktop.controller.mss", fake_module):
                display = controller.get_display_metadata(display_id="display-2")

        self.assertEqual(display.display_id, "display-2")
        self.assertEqual(display.offset_x, 2560)
        self.assertEqual(display.physical_width, 1920)

    def test_logical_region_to_physical_applies_display_offset_and_scale(self) -> None:
        os.environ["CUA_DISPLAY_SCALE_X"] = "2"
        os.environ["CUA_DISPLAY_SCALE_Y"] = "2"
        controller = DesktopController()
        display = controller.build_display_metadata(
            physical_width=1920,
            physical_height=1080,
            offset_x=2560,
            offset_y=0,
            display_id="display-2",
        )

        region = controller._logical_region_to_physical(  # type: ignore[attr-defined]
            CaptureRegion(left=10, top=20, width=30, height=40),
            display,
        )

        self.assertEqual(region.left, 2580)
        self.assertEqual(region.top, 40)
        self.assertEqual(region.width, 60)
        self.assertEqual(region.height, 80)

    def test_list_apps_merges_installed_and_running_metadata(self) -> None:
        controller = AppInventoryController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            result = controller.list_apps()
        finally:
            os.sys.platform = original_platform

        self.assertEqual(result.count, 2)
        self.assertEqual(result.apps[0].name, "Safari")
        self.assertTrue(result.apps[0].is_running)
        self.assertTrue(result.apps[0].is_frontmost)

    def test_get_frontmost_app_returns_active_application(self) -> None:
        controller = AppInventoryController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            result = controller.get_frontmost_app()
        finally:
            os.sys.platform = original_platform

        self.assertIsNotNone(result.app)
        self.assertEqual(result.app.name, "Safari")

    def test_get_frontmost_app_marks_alias_match_as_frontmost(self) -> None:
        controller = FeishuAliasController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            result = controller.get_frontmost_app()
        finally:
            os.sys.platform = original_platform

        self.assertIsNotNone(result.app)
        self.assertEqual(result.app.name, "Lark")
        self.assertTrue(result.app.is_frontmost)

    def test_linux_list_apps_merges_installed_and_running_metadata(self) -> None:
        controller = LinuxAppInventoryController()
        original_platform = os.sys.platform
        os.sys.platform = "linux"
        try:
            result = controller.list_apps()
        finally:
            os.sys.platform = original_platform

        self.assertEqual(result.count, 2)
        self.assertEqual(result.apps[0].name, "Firefox")
        self.assertTrue(result.apps[0].is_running)
        self.assertTrue(result.apps[0].is_frontmost)

    def test_linux_get_frontmost_app_returns_active_application(self) -> None:
        controller = LinuxAppInventoryController()
        original_platform = os.sys.platform
        os.sys.platform = "linux"
        try:
            result = controller.get_frontmost_app()
        finally:
            os.sys.platform = original_platform

        self.assertIsNotNone(result.app)
        self.assertEqual(result.app.name, "Firefox")

    def test_linux_paste_uses_ctrl_v(self) -> None:
        controller = LinuxAppInventoryController()
        original_platform = os.sys.platform
        os.sys.platform = "linux"
        try:
            controller._paste_text("你好 Linux")  # type: ignore[attr-defined]
        finally:
            os.sys.platform = original_platform

        self.assertEqual(controller.clipboard_text, "你好 Linux")
        self.assertEqual(controller.last_hotkey, ["ctrl", "v"])

    def test_read_linux_desktop_entry_uses_desktop_metadata(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            app_dir = root / "applications"
            app_dir.mkdir(parents=True)
            desktop_file = app_dir / "org.gnome.Nautilus.desktop"
            desktop_file.write_text(
                "[Desktop Entry]\n"
                "Type=Application\n"
                "Name=Files\n"
                "Exec=nautilus --new-window %U\n"
                "StartupWMClass=org.gnome.Nautilus\n",
                encoding="utf-8",
            )
            controller = LinuxDesktopEntryController(root)
            original_platform = os.sys.platform
            os.sys.platform = "linux"
            try:
                apps = controller._read_installed_apps_by_key()  # type: ignore[attr-defined]
            finally:
                os.sys.platform = original_platform

        self.assertIn("org.gnome.nautilus", apps)
        self.assertEqual(apps["org.gnome.nautilus"].name, "Files")
        self.assertEqual(apps["org.gnome.nautilus"].path, str(desktop_file))

    def test_read_installed_apps_uses_filesystem_metadata(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            finder_info = root / "Finder.app" / "Contents"
            finder_info.mkdir(parents=True)
            (finder_info / "Info.plist").write_bytes(
                b'<?xml version="1.0" encoding="UTF-8"?>'
                b'<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" '
                b'"http://www.apple.com/DTDs/PropertyList-1.0.dtd">'
                b'<plist version="1.0"><dict>'
                b"<key>CFBundleDisplayName</key><string>Finder</string>"
                b"<key>CFBundleIdentifier</key><string>com.apple.finder</string>"
                b"</dict></plist>"
            )
            safari_info = root / "Safari.app" / "Contents"
            safari_info.mkdir(parents=True)
            (safari_info / "Info.plist").write_bytes(
                b'<?xml version="1.0" encoding="UTF-8"?>'
                b'<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" '
                b'"http://www.apple.com/DTDs/PropertyList-1.0.dtd">'
                b'<plist version="1.0"><dict>'
                b"<key>CFBundleName</key><string>Safari</string>"
                b"<key>CFBundleIdentifier</key><string>com.apple.Safari</string>"
                b"</dict></plist>"
            )

            controller = FilesystemAppInventoryController(root)
            apps = controller._read_installed_apps_by_key()  # type: ignore[attr-defined]

        self.assertIn("com.apple.finder", apps)
        self.assertIn("com.apple.safari", apps)
        self.assertEqual(apps["com.apple.finder"].name, "Finder")
        self.assertEqual(apps["com.apple.safari"].path, str(root / "Safari.app"))

    def test_read_running_apps_parses_process_table(self) -> None:
        controller = RunningAppsController(frontmost_name="Finder")
        ps_result = subprocess.CompletedProcess(
            args=["ps"],
            returncode=0,
            stdout=(
                "101 /System/Library/CoreServices/Finder.app/Contents/MacOS/Finder\n"
                "202 /Applications/Safari.app/Contents/MacOS/Safari\n"
                "303 /usr/libexec/some-daemon\n"
            ),
            stderr="",
        )

        with patch("executor.client.desktop.controller.subprocess.run", return_value=ps_result):
            apps = controller._read_running_apps_by_name()  # type: ignore[attr-defined]

        self.assertIn("finder", apps)
        self.assertIn("safari", apps)
        self.assertTrue(apps["finder"].is_frontmost)
        self.assertEqual(apps["safari"].bundle_id, "com.apple.Safari")
        self.assertEqual(apps["finder"].pid, 101)

    def test_launch_app_succeeds_even_if_metadata_refresh_fails(self) -> None:
        controller = DesktopController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            with patch("executor.client.desktop.controller.subprocess.run") as mock_run:
                with patch.object(controller, "_resolve_app", side_effect=RuntimeError("inventory offline")):
                    result = controller.launch_app(app_name="Finder", wait_seconds=0)
        finally:
            os.sys.platform = original_platform

        mock_run.assert_called_once()
        self.assertTrue(result.success)
        self.assertIsNone(result.app)
        self.assertIn("Metadata refresh warning", result.message)

    def test_accessibility_snapshot_parses_window_tree(self) -> None:
        controller = AccessibilitySnapshotController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            result = controller.get_accessibility_snapshot(app_name="Safari", max_depth=2, max_children=10)
        finally:
            os.sys.platform = original_platform

        self.assertIsNotNone(result.app)
        self.assertEqual(result.app.name, "Safari")
        self.assertEqual(len(result.windows), 1)
        self.assertEqual(result.windows[0].title, "Example Page")
        self.assertEqual(len(result.windows[0].children), 1)
        self.assertEqual(result.windows[0].children[0].role, "AXButton")
        self.assertEqual(result.windows[0].children[0].subrole, "AXToolbarButton")
        self.assertEqual(result.windows[0].children[0].title, "Reload")
        self.assertEqual(result.windows[0].window_id, "window-1")
        self.assertEqual(result.windows[0].children[0].element_id, "window-1/child-1")
        self.assertTrue(result.windows[0].children[0].interactable)
        self.assertFalse(result.windows[0].children[0].selected)
        self.assertEqual(result.windows[0].children[0].available_actions, ["AXPress", "AXShowMenu"])
        self.assertEqual(controller.snapshot_calls, 1)

    def test_finder_snapshot_recovers_from_empty_windows(self) -> None:
        controller = FinderRecoveryController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            result = controller.get_accessibility_snapshot(app_name="Finder", max_depth=2, max_children=10)
        finally:
            os.sys.platform = original_platform

        self.assertEqual(controller.ensure_calls, 1)
        self.assertEqual(controller.snapshot_calls, 2)
        self.assertEqual(len(result.windows), 1)
        self.assertIn("Opened a Finder window automatically", result.message)

    def test_accessibility_snapshot_retries_with_alias_process_name(self) -> None:
        controller = FeishuAliasController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            result = controller.get_accessibility_snapshot(app_name="Lark", max_depth=2, max_children=10)
        finally:
            os.sys.platform = original_platform

        self.assertIsNotNone(result.app)
        self.assertEqual(result.app.name, "Lark")
        self.assertEqual(len(result.windows), 1)
        self.assertIn("Feishu", result.message)

    def test_process_root_snapshot_supports_window_zero_elements(self) -> None:
        controller = ProcessRootSnapshotController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            result = controller.get_accessibility_snapshot(app_name="Safari", max_depth=2, max_children=10)
        finally:
            os.sys.platform = original_platform

        self.assertEqual(len(result.windows), 1)
        self.assertEqual(result.windows[0].window_id, "window-0")
        self.assertEqual(result.windows[0].children[0].element_id, "window-0/child-1")

    def test_click_element_supports_window_zero_elements(self) -> None:
        controller = ProcessRootSnapshotController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            result = controller.click_element(
                app_name="Safari",
                element_id="window-0/child-1",
            )
        finally:
            os.sys.platform = original_platform

        self.assertTrue(result.success)
        self.assertEqual(result.element_id, "window-0/child-1")
        self.assertAlmostEqual(result.physical_target.x, 140.0)
        self.assertAlmostEqual(result.physical_target.y, 215.0)

    def test_click_element_uses_element_bounds_center(self) -> None:
        controller = AccessibilitySnapshotController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            result = controller.click_element(
                app_name="Safari",
                element_id="window-1/child-1",
            )
        finally:
            os.sys.platform = original_platform

        self.assertTrue(result.success)
        self.assertEqual(result.element_id, "window-1/child-1")
        self.assertAlmostEqual(result.physical_target.x, 46.0)
        self.assertAlmostEqual(result.physical_target.y, 66.0)
        self.assertEqual(controller.last_click["button"], "left")

    def test_focus_element_clicks_once(self) -> None:
        controller = AccessibilitySnapshotController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            result = controller.focus_element(
                app_name="Safari",
                element_id="window-1/child-1",
            )
        finally:
            os.sys.platform = original_platform

        self.assertTrue(result.success)
        self.assertEqual(result.action, "focus_element")
        self.assertEqual(controller.last_click["clicks"], 1)

    def test_type_into_element_clicks_then_types(self) -> None:
        controller = AccessibilitySnapshotController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            result = controller.type_into_element(
                app_name="Safari",
                element_id="window-1/child-1",
                text="hello world",
                click_first=True,
                clear_first=False,
            )
        finally:
            os.sys.platform = original_platform

        self.assertTrue(result.success)
        self.assertEqual(result.text_length, 11)
        self.assertEqual(controller.last_click["button"], "left")
        self.assertEqual(controller.last_typed["text"], "hello world")

    def test_type_into_element_can_clear_first(self) -> None:
        controller = AccessibilitySnapshotController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            controller.type_into_element(
                app_name="Safari",
                element_id="window-1/child-1",
                text="abc",
                click_first=True,
                clear_first=True,
            )
        finally:
            os.sys.platform = original_platform

        self.assertEqual(controller.last_hotkey, ["command", "a"])
        self.assertEqual(controller.last_key, "backspace")

    def test_linux_type_into_element_can_clear_first(self) -> None:
        controller = LinuxAppInventoryController()
        controller.click = lambda target, button="left", clicks=1: None  # type: ignore[assignment]
        controller.type_text = lambda text, interval=0.02: None  # type: ignore[assignment]
        controller.get_accessibility_snapshot = lambda **kwargs: build_fake_snapshot("Firefox")  # type: ignore[assignment]
        original_platform = os.sys.platform
        os.sys.platform = "linux"
        try:
            controller.type_into_element(
                app_name="Firefox",
                element_id="window-1/child-1",
                text="abc",
                click_first=False,
                clear_first=True,
            )
        finally:
            os.sys.platform = original_platform

        self.assertEqual(controller.last_hotkey, ["ctrl", "a"])
        self.assertEqual(controller.last_key, "backspace")

    def test_press_element_prefers_accessibility_action(self) -> None:
        controller = AccessibilitySnapshotController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            result = controller.press_element(
                app_name="Safari",
                element_id="window-1/child-1",
            )
        finally:
            os.sys.platform = original_platform

        self.assertTrue(result.success)
        self.assertEqual(result.strategy, "accessibility_press")
        self.assertEqual(controller.ax_press_calls, 1)
        self.assertFalse(hasattr(controller, "last_click"))

    def test_press_element_falls_back_to_click(self) -> None:
        controller = AccessibilitySnapshotController()
        controller.fail_ax_press = True
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            result = controller.press_element(
                app_name="Safari",
                element_id="window-1/child-1",
            )
        finally:
            os.sys.platform = original_platform

        self.assertTrue(result.success)
        self.assertEqual(result.strategy, "click_fallback")
        self.assertEqual(controller.ax_press_calls, 1)
        self.assertEqual(controller.last_click["button"], "left")

    def test_set_value_prefers_accessibility_assignment(self) -> None:
        controller = AccessibilitySnapshotController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            result = controller.set_value_for_element(
                app_name="Safari",
                element_id="window-1/child-1",
                text="new value",
            )
        finally:
            os.sys.platform = original_platform

        self.assertTrue(result.success)
        self.assertEqual(result.strategy, "accessibility_set_value")
        self.assertEqual(result.text_length, 9)
        self.assertEqual(controller.ax_set_value_calls, 1)
        self.assertFalse(hasattr(controller, "last_typed"))

    def test_set_value_falls_back_to_typing(self) -> None:
        controller = AccessibilitySnapshotController()
        controller.fail_ax_set_value = True
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            result = controller.set_value_for_element(
                app_name="Safari",
                element_id="window-1/child-1",
                text="fallback",
                clear_first_on_fallback=True,
            )
        finally:
            os.sys.platform = original_platform

        self.assertTrue(result.success)
        self.assertEqual(result.strategy, "type_fallback")
        self.assertEqual(controller.ax_set_value_calls, 1)
        self.assertEqual(controller.last_typed["text"], "fallback")
        self.assertEqual(controller.last_hotkey, ["command", "a"])

    def test_linux_set_value_falls_back_to_typing_uses_ctrl_a(self) -> None:
        controller = LinuxAppInventoryController()
        controller.click = lambda target, button="left", clicks=1: None  # type: ignore[assignment]
        controller.type_text = lambda text, interval=0.02: setattr(controller, "last_typed", {"text": text, "interval": interval})  # type: ignore[assignment]
        controller._set_ax_value = lambda app_name, element_id, value: (_ for _ in ()).throw(RuntimeError("AXValue set failed"))  # type: ignore[assignment]
        controller.get_accessibility_snapshot = lambda **kwargs: build_fake_snapshot("Firefox")  # type: ignore[assignment]
        original_platform = os.sys.platform
        os.sys.platform = "linux"
        try:
            result = controller.set_value_for_element(
                app_name="Firefox",
                element_id="window-1/child-1",
                text="fallback",
                clear_first_on_fallback=True,
            )
        finally:
            os.sys.platform = original_platform

        self.assertTrue(result.success)
        self.assertEqual(result.strategy, "type_fallback")
        self.assertEqual(controller.last_hotkey, ["ctrl", "a"])
        self.assertEqual(controller.last_key, "backspace")

    def test_perform_element_action_uses_accessibility_action(self) -> None:
        controller = AccessibilitySnapshotController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            result = controller.perform_element_action(
                app_name="Safari",
                element_id="window-1/child-1",
                action_name="AXShowMenu",
            )
        finally:
            os.sys.platform = original_platform

        self.assertTrue(result.success)
        self.assertEqual(result.action_name, "AXShowMenu")
        self.assertEqual(result.strategy, "accessibility_action")
        self.assertEqual(controller.last_ax_press["element_id"], "window-1/child-1")
        self.assertEqual(controller.last_ax_press["action_name"], "AXShowMenu")

    def test_perform_element_action_rejects_unsupported_action(self) -> None:
        controller = AccessibilitySnapshotController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            with self.assertRaises(ValueError):
                controller.perform_element_action(
                    app_name="Safari",
                    element_id="window-1/child-1",
                    action_name="AXDoSomethingElse",
                )
        finally:
            os.sys.platform = original_platform

    def test_preview_element_returns_preview_image(self) -> None:
        controller = AccessibilitySnapshotController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            result = controller.preview_element(
                app_name="Safari",
                element_id="window-1/child-1",
                crop_size=120,
            )
        finally:
            os.sys.platform = original_platform

        self.assertTrue(result.success)
        self.assertEqual(result.action, "preview_element")
        self.assertIsNotNone(result.preview_image_base64)
        self.assertIsNotNone(result.preview_marker)
        self.assertEqual(controller.last_preview_target.display_id, "display-1")

    def test_capture_frontmost_window_observation_uses_focused_window_bounds(self) -> None:
        controller = AccessibilitySnapshotController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            result = controller.capture_frontmost_window_observation(app_name="Safari")
        finally:
            os.sys.platform = original_platform

        self.assertEqual(result.capture_scope, "frontmost_window")
        self.assertEqual(result.captured_display_id, "display-1")
        self.assertEqual(result.display.display_id, "display-1")
        self.assertIsNotNone(result.region)
        assert result.region is not None
        self.assertEqual(result.region.left, 10)
        self.assertEqual(result.region.top, 20)
        self.assertEqual(result.region.width, 800)
        self.assertEqual(result.region.height, 600)
        self.assertEqual(result.image_width, 800)
        self.assertEqual(result.image_height, 600)
        self.assertEqual(controller.last_region_capture.left, 10)
        self.assertEqual(controller.last_region_capture.top, 20)

    def test_click_in_observation_maps_image_coordinates_to_logical_region(self) -> None:
        controller = AccessibilitySnapshotController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            observation = controller.capture_frontmost_window_observation(app_name="Safari")
            target = controller.click_in_observation(400, 300, observation=observation)
        finally:
            os.sys.platform = original_platform

        self.assertEqual(target.display_id, "display-1")
        self.assertAlmostEqual(target.x, 410.5)
        self.assertAlmostEqual(target.y, 320.5)
        self.assertEqual(controller.last_click["target"].display_id, "display-1")

    def test_cached_snapshot_reuse_avoids_second_osascript_call(self) -> None:
        controller = AccessibilitySnapshotController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            controller.get_accessibility_snapshot(app_name="Safari", max_depth=2, max_children=10)
            controller.click_element(
                app_name="Safari",
                element_id="window-1/child-1",
                use_cached_snapshot=True,
            )
        finally:
            os.sys.platform = original_platform

        self.assertEqual(controller.snapshot_calls, 1)

    def test_disable_cached_snapshot_forces_refresh(self) -> None:
        controller = AccessibilitySnapshotController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            controller.get_accessibility_snapshot(app_name="Safari", max_depth=2, max_children=10)
            controller.click_element(
                app_name="Safari",
                element_id="window-1/child-1",
                use_cached_snapshot=False,
            )
        finally:
            os.sys.platform = original_platform

        self.assertEqual(controller.snapshot_calls, 2)

    def test_run_osascript_surfaces_stderr(self) -> None:
        controller = DesktopController()
        with patch(
            "executor.client.desktop.controller.subprocess.run",
            side_effect=subprocess.CalledProcessError(
                returncode=1,
                cmd=["osascript", "-e", "bad script"],
                stderr="expected end of line",
                output="",
            ),
        ):
            with self.assertRaisesRegex(RuntimeError, "stderr=expected end of line"):
                controller._run_osascript("bad script")  # type: ignore[attr-defined]


if __name__ == "__main__":
    unittest.main()
