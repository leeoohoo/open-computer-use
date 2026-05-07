from __future__ import annotations

import base64
import configparser
import ctypes
import ctypes.util
import io
import json
import os
import plistlib
import shlex
import shutil
import subprocess
import sys
import time
from pathlib import Path
from math import hypot
from tempfile import NamedTemporaryFile, TemporaryDirectory
from typing import Any

from PIL import Image, ImageDraw

from shared.schemas.desktop import (
    AccessibilitySnapshotResponse,
    AppDescriptor,
    AppControlResponse,
    CaptureRegion,
    OCRBlock,
    DetectedElement,
    ElementActionResponse,
    ElementPreviewResponse,
    FocusElementResponse,
    FrontmostAppResponse,
    InstalledAppsResponse,
    CoordinateTarget,
    DisplayMetadata,
    Observation,
    PerformElementActionResponse,
    PressElementResponse,
    PreviewMarker,
    SetValueElementResponse,
    TypeIntoElementResponse,
    UIElementBounds,
    UIElementNode,
    UIWindowDescriptor,
    VerificationRegion,
    PermissionDescriptor,
    PermissionOverviewResponse,
    PermissionRequestResponse,
    PermissionRequestResult,
)

try:
    import mss
    import mss.tools
    from mss.exception import ScreenShotError

    MSS_AVAILABLE = True
except ImportError:  # pragma: no cover - environment dependent
    mss = None
    ScreenShotError = Exception
    MSS_AVAILABLE = False

try:
    import pyautogui

    pyautogui.FAILSAFE = False
    PYAUTOGUI_AVAILABLE = True
except ImportError:  # pragma: no cover - environment dependent
    pyautogui = None
    PYAUTOGUI_AVAILABLE = False


class DesktopDependencyError(RuntimeError):
    """Raised when local desktop automation dependencies are unavailable."""


class DesktopController:
    _APP_NAME_ALIAS_GROUPS = (
        ("Lark", "Feishu", "飞书"),
    )

    def __init__(self) -> None:
        self.default_display_id = "main"
        self._last_accessibility_snapshot: AccessibilitySnapshotResponse | None = None
        self._last_observation: Observation | None = None
        self._debug_log_path = Path(
            os.getenv(
                "OPEN_COMPUTER_USE_CHAT_LOG",
                str(Path(__file__).resolve().parents[3] / "chat_debug.log"),
            )
        )

    def capture_observation(self, display_id: str | None = None) -> Observation:
        self._append_debug_log({"event": "desktop_observe_started"})
        try:
            self.assert_screen_recording_permission()
            available_displays = self.list_display_metadata()
            display = self.get_display_metadata(display_id=display_id)
            image = self._take_screenshot_image(display_id=display.display_id)
            screenshot_base64 = self._encode_png_base64(image)
            ocr_blocks = self._extract_ocr_blocks(image)
            frontmost_app = None
            try:
                frontmost_app = self.get_frontmost_app().app
            except Exception:
                frontmost_app = None
            observation = Observation(
                screenshot_base64=screenshot_base64,
                screenshot_mime_type="image/png",
                image_width=image.size[0],
                image_height=image.size[1],
                display=display,
                available_displays=available_displays,
                captured_display_id=display.display_id,
                capture_scope=self._capture_scope_for_display_id(display.display_id),
                frontmost_app=frontmost_app,
                ocr_blocks=ocr_blocks,
                detected_elements=[],
                timestamp=time.time(),
            )
            self._append_debug_log(
                {
                    "event": "desktop_observe_finished",
                    "ocr_blocks_count": len(ocr_blocks),
                    "display": display.model_dump(),
                    "captured_display_id": display.display_id,
                    "available_displays": [item.model_dump() for item in available_displays],
                }
            )
            self._last_observation = observation
            return observation
        except Exception as exc:
            self._append_debug_log({"event": "desktop_observe_error", "error": str(exc)})
            raise

    def capture_region_observation(
        self,
        region: CaptureRegion,
        display_id: str | None = None,
    ) -> Observation:
        self._append_debug_log(
            {
                "event": "desktop_observe_region_started",
                "region": region.model_dump(),
                "display_id": display_id,
            }
        )
        self.assert_screen_recording_permission()
        available_displays = self.list_display_metadata()
        display = self.get_display_metadata(display_id=display_id)
        physical_region = self._logical_region_to_physical(region, display)
        image = self._take_screenshot_region_image(physical_region)
        screenshot_base64 = self._encode_png_base64(image)
        ocr_blocks = self._extract_ocr_blocks(image)
        frontmost_app = None
        try:
            frontmost_app = self.get_frontmost_app().app
        except Exception:
            frontmost_app = None
        observation = Observation(
            screenshot_base64=screenshot_base64,
            screenshot_mime_type="image/png",
            image_width=image.size[0],
            image_height=image.size[1],
            display=display,
            available_displays=available_displays,
            captured_display_id=display.display_id,
            capture_scope="region",
            region=region,
            frontmost_app=frontmost_app,
            ocr_blocks=ocr_blocks,
            detected_elements=[],
            timestamp=time.time(),
        )
        self._append_debug_log(
            {
                "event": "desktop_observe_region_finished",
                "display": display.model_dump(),
                "region": region.model_dump(),
                "ocr_blocks_count": len(ocr_blocks),
            }
        )
        self._last_observation = observation
        return observation

    def capture_frontmost_window_observation(
        self,
        app_name: str | None = None,
        bundle_id: str | None = None,
        max_depth: int = 2,
        max_children: int = 20,
    ) -> Observation:
        self._append_debug_log(
            {
                "event": "desktop_observe_frontmost_window_started",
                "app_name": app_name,
                "bundle_id": bundle_id,
            }
        )
        self.assert_screen_recording_permission()
        snapshot = self.get_accessibility_snapshot(
            app_name=app_name,
            bundle_id=bundle_id,
            max_depth=max_depth,
            max_children=max_children,
            use_cached=False,
        )
        display = self._display_for_snapshot(snapshot)
        logical_region = self._window_region_from_snapshot(snapshot, display)
        observation = self.capture_region_observation(
            region=logical_region,
            display_id=display.display_id,
        )
        observation.capture_scope = "frontmost_window"
        observation.frontmost_app = snapshot.app
        self._append_debug_log(
            {
                "event": "desktop_observe_frontmost_window_finished",
                "display": display.model_dump(),
                "region": logical_region.model_dump(),
                "app": snapshot.app.model_dump() if snapshot.app else None,
            }
        )
        self._last_observation = observation
        return observation

    def get_last_observation(self) -> Observation | None:
        return self._last_observation

    def click_in_observation(
        self,
        x: float,
        y: float,
        *,
        observation: Observation | None = None,
        button: str = "left",
        clicks: int = 1,
    ) -> CoordinateTarget:
        active_observation = observation or self._last_observation
        if active_observation is None:
            raise ValueError("No prior observation is available for viewport-relative clicking.")

        image_width = active_observation.image_width
        image_height = active_observation.image_height
        if image_width is None or image_height is None or image_width <= 0 or image_height <= 0:
            raise ValueError("The observation is missing screenshot dimensions.")

        if not (0 <= x < image_width and 0 <= y < image_height):
            raise ValueError(
                "Viewport target is outside the observation image bounds: "
                f"({x}, {y}) not within {image_width}x{image_height}."
            )

        display = active_observation.display
        region = active_observation.region
        logical_left = region.left if region else 0
        logical_top = region.top if region else 0
        logical_width = region.width if region else display.logical_width
        logical_height = region.height if region else display.logical_height
        if logical_width <= 0 or logical_height <= 0:
            raise ValueError("The observation viewport dimensions are invalid.")

        logical_x = logical_left + ((x + 0.5) / image_width) * logical_width
        logical_y = logical_top + ((y + 0.5) / image_height) * logical_height
        target = CoordinateTarget(
            x=logical_x,
            y=logical_y,
            display_id=active_observation.captured_display_id or display.display_id,
        )
        self.click(target, button=button, clicks=clicks)
        return target

    def get_display_metadata(self, display_id: str | None = None) -> DisplayMetadata:
        physical_width, physical_height, offset_x, offset_y = self._read_monitor_geometry(display_id=display_id)
        self._validate_monitor_geometry(physical_width, physical_height)
        return self.build_display_metadata(
            physical_width=physical_width,
            physical_height=physical_height,
            offset_x=offset_x,
            offset_y=offset_y,
            display_id=display_id,
        )

    def build_display_metadata(
        self,
        physical_width: int,
        physical_height: int,
        offset_x: int = 0,
        offset_y: int = 0,
        display_id: str | None = None,
    ) -> DisplayMetadata:
        scale_x = float(os.getenv("CUA_DISPLAY_SCALE_X", "1.0"))
        scale_y = float(os.getenv("CUA_DISPLAY_SCALE_Y", "1.0"))
        logical_width = max(1, round(physical_width / scale_x))
        logical_height = max(1, round(physical_height / scale_y))

        return DisplayMetadata(
            display_id=display_id or self.default_display_id,
            logical_width=logical_width,
            logical_height=logical_height,
            physical_width=physical_width,
            physical_height=physical_height,
            scale_x=scale_x,
            scale_y=scale_y,
            offset_x=int(os.getenv("CUA_DISPLAY_OFFSET_X", str(offset_x))),
            offset_y=int(os.getenv("CUA_DISPLAY_OFFSET_Y", str(offset_y))),
        )

    def list_display_metadata(self) -> list[DisplayMetadata]:
        if MSS_AVAILABLE:
            with mss.mss() as sct:
                monitors = self._get_individual_monitors(sct)
                return [
                    self.build_display_metadata(
                        physical_width=int(monitor["width"]),
                        physical_height=int(monitor["height"]),
                        offset_x=int(monitor["left"]),
                        offset_y=int(monitor["top"]),
                        display_id=f"display-{index}",
                    )
                    for index, monitor in enumerate(monitors, start=1)
                ]

        return [self.get_display_metadata()]

    def logical_to_physical(
        self,
        target: CoordinateTarget,
        display: DisplayMetadata | None = None,
    ) -> CoordinateTarget:
        active_display = display or self.get_display_metadata(display_id=target.display_id)
        if target.display_id != active_display.display_id:
            raise ValueError(
                f"Unknown display_id '{target.display_id}'. Expected '{active_display.display_id}'."
            )

        physical_x = int(round(active_display.offset_x + target.x * active_display.scale_x))
        physical_y = int(round(active_display.offset_y + target.y * active_display.scale_y))
        return CoordinateTarget(
            x=physical_x,
            y=physical_y,
            display_id=active_display.display_id,
        )

    def physical_to_logical(
        self,
        target: CoordinateTarget,
        display: DisplayMetadata | None = None,
    ) -> CoordinateTarget:
        active_display = display or self.get_display_metadata(display_id=target.display_id)
        if target.display_id != active_display.display_id:
            raise ValueError(
                f"Unknown display_id '{target.display_id}'. Expected '{active_display.display_id}'."
            )

        logical_x = (target.x - active_display.offset_x) / active_display.scale_x
        logical_y = (target.y - active_display.offset_y) / active_display.scale_y
        return CoordinateTarget(
            x=logical_x,
            y=logical_y,
            display_id=active_display.display_id,
        )

    def take_screenshot(self, display_id: str | None = None) -> str:
        self.assert_screen_recording_permission()
        return self._encode_png_base64(self._take_screenshot_image(display_id=display_id))

    def capture_preview(
        self,
        target: CoordinateTarget,
        crop_size: int = 160,
        with_marker: bool = True,
    ) -> tuple[str, VerificationRegion, DisplayMetadata, CoordinateTarget, PreviewMarker]:
        self.assert_screen_recording_permission()
        display = self.get_display_metadata(display_id=target.display_id)
        physical_target = self.logical_to_physical(target, display)
        image = self._take_screenshot_image(display_id=display.display_id)
        region = self._build_preview_region(
            image_width=image.size[0],
            image_height=image.size[1],
            physical_target=physical_target,
            display=display,
            crop_size=crop_size,
        )
        cropped = image.crop(
            (
                region.left,
                region.top,
                region.left + region.width,
                region.top + region.height,
            )
        )
        marker = PreviewMarker(
            x=max(0, min(region.width - 1, int(round(physical_target.x - display.offset_x - region.left)))),
            y=max(0, min(region.height - 1, int(round(physical_target.y - display.offset_y - region.top)))),
        )
        if with_marker:
            self._draw_preview_marker(cropped, marker)
        buffer = io.BytesIO()
        cropped.save(buffer, format="PNG")
        return (
            base64.b64encode(buffer.getvalue()).decode("ascii"),
            region,
            display,
            physical_target,
            marker,
        )

    def move(self, target: CoordinateTarget) -> None:
        self.assert_accessibility_permission()
        self._require_pyautogui()
        mapped = self.logical_to_physical(target, self.get_display_metadata(display_id=target.display_id))
        pyautogui.moveTo(mapped.x, mapped.y, duration=0)

    def click(self, target: CoordinateTarget, button: str = "left", clicks: int = 1) -> None:
        self.assert_accessibility_permission()
        self._require_pyautogui()
        mapped = self.logical_to_physical(target, self.get_display_metadata(display_id=target.display_id))
        pyautogui.click(mapped.x, mapped.y, button=button, clicks=clicks, interval=0.1)

    def type_text(self, text: str, interval: float = 0.02) -> None:
        self.assert_accessibility_permission()
        self._require_pyautogui()
        if not text:
            return
        if self._should_type_via_paste(text):
            self._paste_text(text)
            return
        try:
            pyautogui.write(text, interval=interval)
        except Exception:
            self._paste_text(text)

    def press_key(self, key: str) -> None:
        self.assert_accessibility_permission()
        self._require_pyautogui()
        pyautogui.press(key)

    def hotkey(self, keys: list[str]) -> None:
        self.assert_accessibility_permission()
        self._require_pyautogui()
        pyautogui.hotkey(*keys)

    def _should_type_via_paste(self, text: str) -> bool:
        # pyautogui.write() 对中文和部分特殊字符在 macOS 上不稳定，
        # 这类内容优先走剪贴板粘贴更可靠。
        return any(ord(char) > 127 for char in text)

    def _paste_text(self, text: str) -> None:
        self._write_text_to_clipboard(text)
        self.hotkey(self._paste_hotkey())

    def _paste_hotkey(self) -> list[str]:
        if sys.platform == "darwin":
            return ["command", "v"]
        return ["ctrl", "v"]

    def _select_all_hotkey(self) -> list[str]:
        if sys.platform == "darwin":
            return ["command", "a"]
        return ["ctrl", "a"]

    def _write_text_to_clipboard(self, text: str) -> None:
        if sys.platform == "darwin":
            with TemporaryDirectory(prefix="open-computer-use-paste-") as temp_dir:
                text_path = Path(temp_dir) / "clipboard.txt"
                text_path.write_text(text, encoding="utf-8")
                script = (
                    "set sourceFile to POSIX file "
                    f"\"{self._escape_applescript_string(str(text_path))}\"\n"
                    "set fileHandle to open for access sourceFile\n"
                    "set clipboardText to read fileHandle as «class utf8»\n"
                    "close access fileHandle\n"
                    "set the clipboard to clipboardText"
                )
                self._run_osascript(script)
            return

        if sys.platform.startswith("linux"):
            self._write_text_to_clipboard_linux(text)
            return

        raise DesktopDependencyError(
            "Clipboard text input fallback is currently implemented for macOS and Linux only."
        )

    def scroll(self, direction: str, amount: int) -> None:
        self.assert_accessibility_permission()
        self._require_pyautogui()
        signed_amount = amount if direction == "up" else -amount
        pyautogui.scroll(signed_amount)

    def get_pointer_position(self) -> CoordinateTarget:
        self.assert_accessibility_permission()
        self._require_pyautogui()
        position = pyautogui.position()
        display = self._display_for_physical_point(float(position.x), float(position.y))
        return CoordinateTarget(x=float(position.x), y=float(position.y), display_id=display.display_id)

    def pointer_distance_to(self, physical_target: CoordinateTarget) -> float:
        pointer = self.get_pointer_position()
        return hypot(pointer.x - physical_target.x, pointer.y - physical_target.y)

    def list_apps(self, query: str | None = None) -> InstalledAppsResponse:
        if sys.platform != "darwin" and not sys.platform.startswith("linux"):
            raise DesktopDependencyError("App discovery is currently implemented for macOS and Linux only.")

        apps = self._read_application_inventory()
        normalized_query = query.lower().strip() if query else None
        if normalized_query:
            apps = [
                app
                for app in apps
                if self._app_matches_query(app, normalized_query)
                or normalized_query in (app.bundle_id or "").lower()
                or normalized_query in (app.path or "").lower()
            ]

        apps.sort(key=lambda item: (not bool(item.is_running), item.name.lower()))
        return InstalledAppsResponse(
            apps=apps,
            count=len(apps),
            query=query,
            message=f"Found {len(apps)} matching apps." if query else f"Found {len(apps)} apps.",
        )

    def get_frontmost_app(self) -> FrontmostAppResponse:
        if sys.platform != "darwin" and not sys.platform.startswith("linux"):
            raise DesktopDependencyError(
                "Frontmost app inspection is currently implemented for macOS and Linux only."
            )

        try:
            running = self._read_running_apps_by_name()
        except Exception:
            running = {}
        for app in running.values():
            if app.is_frontmost:
                return FrontmostAppResponse(app=app, message="Frontmost app detected.")
        frontmost_name = self._read_frontmost_app_name()
        if frontmost_name:
            app = self._resolve_app(app_name=frontmost_name)
            if app is not None:
                return FrontmostAppResponse(
                    app=AppDescriptor(
                        name=app.name,
                        bundle_id=app.bundle_id,
                        path=app.path,
                        is_running=app.is_running,
                        is_frontmost=True,
                        pid=app.pid,
                    ),
                    message="Frontmost app inferred from the desktop session.",
                )
            return FrontmostAppResponse(
                app=AppDescriptor(
                    name=frontmost_name,
                    bundle_id=None,
                    path=None,
                    is_running=None,
                    is_frontmost=True,
                    pid=None,
                ),
                message="Frontmost app inferred from the desktop session.",
            )
        return FrontmostAppResponse(app=None, message="No frontmost app could be determined.")

    def launch_app(
        self,
        app_name: str | None = None,
        bundle_id: str | None = None,
        wait_seconds: float = 1.0,
    ) -> AppControlResponse:
        if sys.platform != "darwin" and not sys.platform.startswith("linux"):
            raise DesktopDependencyError("Launching apps are currently implemented for macOS and Linux only.")

        try:
            resolved_target = self._resolve_app(app_name=app_name, bundle_id=bundle_id)
        except Exception:
            resolved_target = None

        command, strategy, target_label = self._build_launch_command(
            resolved_target=resolved_target,
            app_name=app_name,
            bundle_id=bundle_id,
        )

        subprocess.run(command, check=True)
        if wait_seconds > 0:
            time.sleep(wait_seconds)

        app = None
        frontmost = None
        metadata_warning: str | None = None
        try:
            app = self._resolve_app(app_name=app_name, bundle_id=bundle_id)
            frontmost = self.get_frontmost_app().app
        except Exception as exc:
            metadata_warning = str(exc)
        return AppControlResponse(
            success=True,
            action="launch_app",
            app=app,
            frontmost_app=frontmost,
            strategy=strategy,
            message=(
                f"Launched app target: {target_label}."
                if not metadata_warning
                else f"Launched app target: {target_label}. Metadata refresh warning: {metadata_warning}"
            ),
        )

    def activate_app(
        self,
        app_name: str | None = None,
        bundle_id: str | None = None,
        wait_seconds: float = 0.75,
    ) -> AppControlResponse:
        if sys.platform != "darwin" and not sys.platform.startswith("linux"):
            raise DesktopDependencyError("Activating apps are currently implemented for macOS and Linux only.")

        target = self._resolve_app(app_name=app_name, bundle_id=bundle_id)
        if target is None:
            raise ValueError("Could not resolve the target app to activate.")

        self._activate_platform_app(target)
        if wait_seconds > 0:
            time.sleep(wait_seconds)

        refreshed_target = self._resolve_app(app_name=target.name, bundle_id=target.bundle_id)
        frontmost = self.get_frontmost_app().app
        return AppControlResponse(
            success=True,
            action="activate_app",
            app=refreshed_target or target,
            frontmost_app=frontmost,
            strategy="linux_activate" if sys.platform.startswith("linux") else "osascript_activate",
            message=f"Activated app: {target.name}.",
        )

    def get_accessibility_snapshot(
        self,
        app_name: str | None = None,
        bundle_id: str | None = None,
        max_depth: int = 3,
        max_children: int = 25,
        use_cached: bool = False,
    ) -> AccessibilitySnapshotResponse:
        self._append_debug_log(
            {
                "event": "desktop_accessibility_started",
                "app_name": app_name,
                "bundle_id": bundle_id,
                "max_depth": max_depth,
                "max_children": max_children,
                "use_cached": use_cached,
            }
        )
        try:
            if sys.platform != "darwin" and not sys.platform.startswith("linux"):
                raise DesktopDependencyError(
                    "Accessibility snapshots are currently implemented for macOS and Linux only."
                )

            self.assert_accessibility_permission()
            target = self._resolve_app(app_name=app_name, bundle_id=bundle_id)
            if target is None:
                target = self.get_frontmost_app().app
            if target is None:
                raise ValueError("Could not determine which app to inspect.")

            if use_cached and self._snapshot_matches_target(self._last_accessibility_snapshot, target):
                if self._is_finder_app(target) and not self._last_accessibility_snapshot.windows:  # type: ignore[union-attr]
                    use_cached = False
            if use_cached and self._snapshot_matches_target(self._last_accessibility_snapshot, target):
                snapshot = self._last_accessibility_snapshot  # type: ignore[assignment]
                self._append_debug_log(
                    {
                        "event": "desktop_accessibility_finished",
                        "app": target.model_dump(),
                        "windows_count": len(snapshot.windows),
                        "message": snapshot.message,
                        "used_cached": True,
                    }
                )
                return snapshot  # type: ignore[return-value]

            snapshot = self._capture_accessibility_snapshot(
                target=target,
                max_depth=max_depth,
                max_children=max_children,
            )
            if self._is_finder_app(target) and not snapshot.windows:
                self._ensure_finder_window()
                time.sleep(0.25)
                snapshot = self._capture_accessibility_snapshot(
                    target=target,
                    max_depth=max_depth,
                    max_children=max_children,
                    message_suffix=" Opened a Finder window automatically and retried once.",
                )
            self._last_accessibility_snapshot = snapshot
            self._append_debug_log(
                {
                    "event": "desktop_accessibility_finished",
                    "app": target.model_dump(),
                    "windows_count": len(snapshot.windows),
                    "message": snapshot.message,
                    "used_cached": False,
                }
            )
            return snapshot
        except Exception as exc:
            self._append_debug_log(
                {
                    "event": "desktop_accessibility_error",
                    "app_name": app_name,
                    "bundle_id": bundle_id,
                    "error": str(exc),
                }
            )
            raise

    def click_element(
        self,
        element_id: str,
        app_name: str | None = None,
        bundle_id: str | None = None,
        button: str = "left",
        clicks: int = 1,
        snapshot_max_depth: int = 4,
        snapshot_max_children: int = 40,
        use_cached_snapshot: bool = True,
    ) -> ElementActionResponse:
        snapshot, target_node, logical_target, physical_target = self._resolve_element_target(
            element_id=element_id,
            app_name=app_name,
            bundle_id=bundle_id,
            snapshot_max_depth=snapshot_max_depth,
            snapshot_max_children=snapshot_max_children,
            use_cached_snapshot=use_cached_snapshot,
        )
        self.click(logical_target, button=button, clicks=clicks)
        return ElementActionResponse(
            success=True,
            action="click_element",
            app=snapshot.app,
            element_id=element_id,
            logical_target=logical_target,
            physical_target=physical_target,
            message=f"Clicked element {element_id}.",
        )

    def press_element(
        self,
        element_id: str,
        app_name: str | None = None,
        bundle_id: str | None = None,
        snapshot_max_depth: int = 4,
        snapshot_max_children: int = 40,
        use_cached_snapshot: bool = True,
        fallback_to_click: bool = True,
    ) -> PressElementResponse:
        snapshot, _, logical_target, physical_target = self._resolve_element_target(
            element_id=element_id,
            app_name=app_name,
            bundle_id=bundle_id,
            snapshot_max_depth=snapshot_max_depth,
            snapshot_max_children=snapshot_max_children,
            use_cached_snapshot=use_cached_snapshot,
        )

        try:
            self._perform_ax_press(
                app_name=(snapshot.app.name if snapshot.app else app_name) or "",
                element_id=element_id,
            )
            return PressElementResponse(
                success=True,
                action="press_element",
                app=snapshot.app,
                element_id=element_id,
                strategy="accessibility_press",
                logical_target=logical_target,
                physical_target=physical_target,
                message=f"Pressed element {element_id} using accessibility action.",
            )
        except Exception as exc:
            if not fallback_to_click:
                raise ValueError(f"Failed to press element {element_id}: {exc}") from exc

        self.click(logical_target, button="left", clicks=1)
        return PressElementResponse(
            success=True,
            action="press_element",
            app=snapshot.app,
            element_id=element_id,
            strategy="click_fallback",
            logical_target=logical_target,
            physical_target=physical_target,
            message=f"Pressed element {element_id} via click fallback.",
        )

    def perform_element_action(
        self,
        element_id: str,
        action_name: str,
        app_name: str | None = None,
        bundle_id: str | None = None,
        snapshot_max_depth: int = 4,
        snapshot_max_children: int = 40,
        use_cached_snapshot: bool = True,
        fallback_to_click: bool = False,
    ) -> PerformElementActionResponse:
        snapshot, target_node, logical_target, physical_target = self._resolve_element_target(
            element_id=element_id,
            app_name=app_name,
            bundle_id=bundle_id,
            snapshot_max_depth=snapshot_max_depth,
            snapshot_max_children=snapshot_max_children,
            use_cached_snapshot=use_cached_snapshot,
        )

        available_actions = set(target_node.available_actions or [])
        if available_actions and action_name not in available_actions and not (
            action_name == "AXPress" and fallback_to_click
        ):
            raise ValueError(
                f"Action {action_name} is not available for element {element_id}. "
                f"Available actions: {sorted(available_actions)}"
            )

        try:
            self._perform_ax_action(
                app_name=(snapshot.app.name if snapshot.app else app_name) or "",
                element_id=element_id,
                action_name=action_name,
            )
            return PerformElementActionResponse(
                success=True,
                action="perform_element_action",
                app=snapshot.app,
                element_id=element_id,
                action_name=action_name,
                strategy="accessibility_action",
                logical_target=logical_target,
                physical_target=physical_target,
                message=f"Performed {action_name} on element {element_id}.",
            )
        except Exception as exc:
            if not (fallback_to_click and action_name == "AXPress"):
                raise ValueError(f"Failed to perform {action_name} on element {element_id}: {exc}") from exc

        self.click(logical_target, button="left", clicks=1)
        return PerformElementActionResponse(
            success=True,
            action="perform_element_action",
            app=snapshot.app,
            element_id=element_id,
            action_name=action_name,
            strategy="click_fallback",
            logical_target=logical_target,
            physical_target=physical_target,
            message=f"Performed {action_name} on element {element_id} via click fallback.",
        )

    def type_into_element(
        self,
        element_id: str,
        text: str,
        app_name: str | None = None,
        bundle_id: str | None = None,
        click_first: bool = True,
        clear_first: bool = False,
        typing_interval: float = 0.02,
        snapshot_max_depth: int = 4,
        snapshot_max_children: int = 40,
        use_cached_snapshot: bool = True,
    ) -> TypeIntoElementResponse:
        snapshot, _, logical_target, physical_target = self._resolve_element_target(
            element_id=element_id,
            app_name=app_name,
            bundle_id=bundle_id,
            snapshot_max_depth=snapshot_max_depth,
            snapshot_max_children=snapshot_max_children,
            use_cached_snapshot=use_cached_snapshot,
        )

        if click_first:
            self.click(logical_target, button="left", clicks=1)
            time.sleep(0.05)
        if clear_first:
            self.hotkey(self._select_all_hotkey())
            time.sleep(0.03)
            self.press_key("backspace")
            time.sleep(0.03)

        self.type_text(text, interval=typing_interval)
        return TypeIntoElementResponse(
            success=True,
            action="type_into_element",
            app=snapshot.app,
            element_id=element_id,
            logical_target=logical_target,
            physical_target=physical_target,
            text_length=len(text),
            message=f"Typed into element {element_id}.",
        )

    def set_value_for_element(
        self,
        element_id: str,
        text: str,
        app_name: str | None = None,
        bundle_id: str | None = None,
        snapshot_max_depth: int = 4,
        snapshot_max_children: int = 40,
        use_cached_snapshot: bool = True,
        fallback_to_typing: bool = True,
        click_first_on_fallback: bool = True,
        clear_first_on_fallback: bool = False,
        typing_interval: float = 0.02,
    ) -> SetValueElementResponse:
        snapshot, _, logical_target, physical_target = self._resolve_element_target(
            element_id=element_id,
            app_name=app_name,
            bundle_id=bundle_id,
            snapshot_max_depth=snapshot_max_depth,
            snapshot_max_children=snapshot_max_children,
            use_cached_snapshot=use_cached_snapshot,
        )

        try:
            self._set_ax_value(
                app_name=(snapshot.app.name if snapshot.app else app_name) or "",
                element_id=element_id,
                value=text,
            )
            return SetValueElementResponse(
                success=True,
                action="set_value",
                app=snapshot.app,
                element_id=element_id,
                strategy="accessibility_set_value",
                logical_target=logical_target,
                physical_target=physical_target,
                text_length=len(text),
                message=f"Set value for element {element_id} using accessibility value assignment.",
            )
        except Exception as exc:
            if not fallback_to_typing:
                raise ValueError(f"Failed to set value for element {element_id}: {exc}") from exc

        typed = self.type_into_element(
            element_id=element_id,
            text=text,
            app_name=app_name,
            bundle_id=bundle_id,
            click_first=click_first_on_fallback,
            clear_first=clear_first_on_fallback,
            typing_interval=typing_interval,
            snapshot_max_depth=snapshot_max_depth,
            snapshot_max_children=snapshot_max_children,
            use_cached_snapshot=use_cached_snapshot,
        )
        return SetValueElementResponse(
            success=True,
            action="set_value",
            app=typed.app,
            element_id=element_id,
            strategy="type_fallback",
            logical_target=typed.logical_target,
            physical_target=typed.physical_target,
            text_length=typed.text_length,
            message=f"Set value for element {element_id} via typing fallback.",
        )

    def focus_element(
        self,
        element_id: str,
        app_name: str | None = None,
        bundle_id: str | None = None,
        snapshot_max_depth: int = 4,
        snapshot_max_children: int = 40,
        use_cached_snapshot: bool = True,
    ) -> FocusElementResponse:
        snapshot, _, logical_target, physical_target = self._resolve_element_target(
            element_id=element_id,
            app_name=app_name,
            bundle_id=bundle_id,
            snapshot_max_depth=snapshot_max_depth,
            snapshot_max_children=snapshot_max_children,
            use_cached_snapshot=use_cached_snapshot,
        )
        self.click(logical_target, button="left", clicks=1)
        return FocusElementResponse(
            success=True,
            action="focus_element",
            app=snapshot.app,
            element_id=element_id,
            logical_target=logical_target,
            physical_target=physical_target,
            message=f"Focused element {element_id}.",
        )

    def preview_element(
        self,
        element_id: str,
        app_name: str | None = None,
        bundle_id: str | None = None,
        crop_size: int = 180,
        snapshot_max_depth: int = 4,
        snapshot_max_children: int = 40,
        use_cached_snapshot: bool = True,
    ) -> ElementPreviewResponse:
        snapshot, _, logical_target, physical_target = self._resolve_element_target(
            element_id=element_id,
            app_name=app_name,
            bundle_id=bundle_id,
            snapshot_max_depth=snapshot_max_depth,
            snapshot_max_children=snapshot_max_children,
            use_cached_snapshot=use_cached_snapshot,
        )
        preview_image_base64, preview_region, _, _, preview_marker = self.capture_preview(
            logical_target,
            crop_size=crop_size,
        )
        return ElementPreviewResponse(
            success=True,
            action="preview_element",
            app=snapshot.app,
            element_id=element_id,
            logical_target=logical_target,
            physical_target=physical_target,
            preview_region=preview_region,
            preview_marker=preview_marker,
            preview_image_base64=preview_image_base64,
            message=f"Previewed element {element_id}.",
        )

    def get_permission_diagnostics(self) -> dict:
        return {
            "platform": sys.platform,
            "accessibility_granted": self._preflight_accessibility_access(),
            "screen_recording_granted": self._preflight_screen_capture_access(),
        }

    def get_permission_overview(self) -> PermissionOverviewResponse:
        items: list[PermissionDescriptor] = []

        accessibility_granted = self._preflight_accessibility_access()
        screen_granted = self._preflight_screen_capture_access()
        pyautogui_ready = PYAUTOGUI_AVAILABLE
        screenshot_ready = MSS_AVAILABLE or PYAUTOGUI_AVAILABLE

        if sys.platform == "darwin":
            apple_events_granted = self._preflight_apple_events_access()
            items.extend(
                [
                    PermissionDescriptor(
                        id="accessibility",
                        label="Accessibility",
                        category="permission",
                        group="system_permission",
                        status=self._permission_status(accessibility_granted),
                        granted=accessibility_granted,
                        can_request=True,
                        blocking=True,
                        requires_restart=False,
                        settings_url="x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
                        action_label="Open Accessibility Settings",
                        status_hint=(
                            "Lets the app send input events and read the accessibility tree."
                            if accessibility_granted
                            else "Without this, direct app control, element discovery, keyboard, and mouse actions may fail."
                        ),
                        manual_steps=[
                            "Open System Settings > Privacy & Security > Accessibility.",
                            "Enable access for the app or terminal session that is running Open Computer Use.",
                            "If the toggle was added just now, retry the action in this app.",
                        ],
                        message=(
                            "Required for keyboard, mouse, and accessibility tree control."
                        ),
                    ),
                    PermissionDescriptor(
                        id="screen_recording",
                        label="Screen Recording",
                        category="permission",
                        group="system_permission",
                        status=self._permission_status(screen_granted),
                        granted=screen_granted,
                        can_request=True,
                        blocking=True,
                        requires_restart=False,
                        settings_url="x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
                        action_label="Open Screen Recording Settings",
                        status_hint=(
                            "Screen capture is available."
                            if screen_granted
                            else "Without this, screenshots, visual inspection, and screenshot-based clicking will fail."
                        ),
                        manual_steps=[
                            "Open System Settings > Privacy & Security > Screen Recording.",
                            "Enable access for the app or terminal session that is running Open Computer Use.",
                            "After enabling it, close and reopen the affected app if macOS asks you to.",
                        ],
                        message="Required for screenshots and visual inspection.",
                    ),
                    PermissionDescriptor(
                        id="apple_events",
                        label="Automation / Apple Events",
                        category="permission",
                        group="system_permission",
                        status=self._permission_status(apple_events_granted),
                        granted=apple_events_granted,
                        can_request=True,
                        blocking=False,
                        requires_restart=False,
                        settings_url="x-apple.systempreferences:com.apple.preference.security?Privacy_Automation",
                        action_label="Open Automation Settings",
                        status_hint=(
                            "Automation access looks available for System Events."
                            if apple_events_granted
                            else "This is used for some osascript-driven app control paths. Missing access may affect activation or scripted UI flows."
                        ),
                        manual_steps=[
                            "Open System Settings > Privacy & Security > Automation.",
                            "Find the app or terminal session that is running Open Computer Use.",
                            "Enable control for System Events or the target app when macOS asks.",
                        ],
                        message="Used when controlling apps through osascript and System Events on macOS.",
                    ),
                ]
            )
        elif sys.platform.startswith("linux"):
            items.extend(
                [
                    PermissionDescriptor(
                        id="at_spi",
                        label="AT-SPI Accessibility",
                        category="capability",
                        group="runtime_capability",
                        status="granted" if self._linux_accessibility_stack_available() else "not_granted",
                        granted=self._linux_accessibility_stack_available(),
                        can_request=False,
                        blocking=False,
                        requires_restart=False,
                        settings_url=None,
                        action_label=None,
                        status_hint=(
                            "AT-SPI is available."
                            if self._linux_accessibility_stack_available()
                            else "Install or enable the AT-SPI stack if you want accessibility snapshots and direct element actions on Linux."
                        ),
                        manual_steps=[
                            "Make sure the desktop session exposes accessibility support.",
                            "Install the AT-SPI Python bindings and related desktop packages if needed.",
                            "Retry from a normal GUI session, not a headless shell.",
                        ],
                        message="Needed for accessibility snapshots and direct element actions on Linux.",
                    ),
                    PermissionDescriptor(
                        id="display_session",
                        label="GUI Desktop Session",
                        category="capability",
                        group="runtime_capability",
                        status="granted" if self._linux_gui_session_available() else "not_granted",
                        granted=self._linux_gui_session_available(),
                        can_request=False,
                        blocking=True,
                        requires_restart=False,
                        settings_url=None,
                        action_label=None,
                        status_hint=(
                            "A GUI desktop session is available."
                            if self._linux_gui_session_available()
                            else "No DISPLAY or WAYLAND_DISPLAY was detected, so desktop automation cannot talk to a live GUI session."
                        ),
                        manual_steps=[
                            "Run the app from a logged-in desktop session.",
                            "Confirm DISPLAY or WAYLAND_DISPLAY is exported for the process.",
                            "Retry after launching from the same user session as the desktop.",
                        ],
                        message="Needed for screenshot capture and desktop automation.",
                    ),
                ]
            )

        items.extend(
            [
                PermissionDescriptor(
                    id="screenshot_tooling",
                    label="Screenshot Tooling",
                    category="capability",
                    group="runtime_capability",
                    status="granted" if screenshot_ready else "not_granted",
                    granted=screenshot_ready,
                    can_request=False,
                    blocking=True,
                    requires_restart=False,
                    action_label=None,
                    status_hint=(
                        "Screenshot libraries are available."
                        if screenshot_ready
                        else "Install screenshot support such as mss, or provide a working pyautogui screenshot backend."
                    ),
                    manual_steps=[
                        "Install the Python dependencies from this project.",
                        "Verify screenshot libraries can access the desktop session.",
                        "Retry after confirming desktop permissions are also granted.",
                    ],
                    message="Provided by mss or pyautogui screenshot support.",
                ),
                PermissionDescriptor(
                    id="input_tooling",
                    label="Mouse And Keyboard Tooling",
                    category="capability",
                    group="runtime_capability",
                    status="granted" if pyautogui_ready else "not_granted",
                    granted=pyautogui_ready,
                    can_request=False,
                    blocking=True,
                    requires_restart=False,
                    action_label=None,
                    status_hint=(
                        "pyautogui input control is available."
                        if pyautogui_ready
                        else "Mouse and keyboard automation depends on pyautogui being installed and usable in this environment."
                    ),
                    manual_steps=[
                        "Install the Python dependencies from this project.",
                        "Verify pyautogui can talk to the current desktop session.",
                        "Retry after fixing any GUI-session or permission issues.",
                    ],
                    message="Provided by pyautogui for click, move, type, and hotkey control.",
                ),
            ]
        )

        missing_permission_ids = [item.id for item in items if item.status == "not_granted"]
        missing_blocking_ids = [item.id for item in items if item.status == "not_granted" and item.blocking]
        requestable_permission_ids = [item.id for item in items if item.can_request]
        all_granted = not missing_permission_ids
        ready_for_desktop_use = not missing_blocking_ids

        if ready_for_desktop_use:
            message = "Desktop automation prerequisites look ready."
        else:
            message = "Some required permissions or capabilities are still missing."

        return PermissionOverviewResponse(
            platform=sys.platform,
            items=items,
            all_granted=all_granted,
            ready_for_desktop_use=ready_for_desktop_use,
            missing_permission_ids=missing_permission_ids,
            missing_blocking_ids=missing_blocking_ids,
            requestable_permission_ids=requestable_permission_ids,
            message=message,
        )

    def request_permissions(
        self,
        *,
        permission_ids: list[str] | None = None,
        request_missing_only: bool = True,
        open_settings_on_failure: bool = True,
    ) -> PermissionRequestResponse:
        overview = self.get_permission_overview()
        allowed_ids = {item.id for item in overview.items if item.can_request}
        target_ids = permission_ids or list(allowed_ids)
        if request_missing_only:
            target_ids = [item_id for item_id in target_ids if item_id in overview.missing_permission_ids]

        results: list[PermissionRequestResult] = []
        for permission_id in target_ids:
            if permission_id not in allowed_ids:
                results.append(
                    PermissionRequestResult(
                        permission_id=permission_id,
                        attempted=False,
                        status="unsupported",
                        granted=None,
                        message="This permission cannot be requested by the current platform helper.",
                    )
                )
                continue
            results.append(
                self._request_platform_permission(
                    permission_id=permission_id,
                    open_settings_on_failure=open_settings_on_failure,
                )
            )

        refreshed = self.get_permission_overview()
        if not results:
            message = "No permission prompts were necessary."
        elif refreshed.ready_for_desktop_use:
            message = "Permission request flow finished and desktop automation is ready."
        else:
            message = "Permission request flow finished. Some permissions still need manual approval."

        return PermissionRequestResponse(
            platform=sys.platform,
            results=results,
            overview=refreshed,
            message=message,
        )

    def assert_accessibility_permission(self) -> None:
        granted = self._preflight_accessibility_access()
        if granted is False:
            if sys.platform.startswith("linux"):
                raise DesktopDependencyError(
                    "Accessibility access is not available. On Linux, make sure the session exposes "
                    "AT-SPI accessibility and that the required desktop automation tools are installed."
                )
            raise DesktopDependencyError(
                "Accessibility permission is not granted. On macOS, enable Accessibility "
                "for the terminal or Python runtime that launches this project."
            )

    def assert_screen_recording_permission(self) -> None:
        granted = self._preflight_screen_capture_access()
        if granted is False:
            if sys.platform.startswith("linux"):
                raise DesktopDependencyError(
                    "Screenshot capture is not available. On Linux, run inside a normal GUI session "
                    "and make sure screenshot tooling such as mss can access the display server."
                )
            raise DesktopDependencyError(
                "Screen Recording permission is not granted. On macOS, enable Screen Recording "
                "for the terminal or Python runtime that launches this project."
            )

    def _take_screenshot_image(self, display_id: str | None = None) -> Image.Image:
        if MSS_AVAILABLE:
            try:
                with mss.mss() as sct:
                    monitor = self._get_monitor_by_display_id(sct, display_id=display_id)
                    screenshot = sct.grab(monitor)
                    return Image.frombytes("RGB", screenshot.size, screenshot.rgb)
            except ScreenShotError as exc:
                if sys.platform.startswith("linux"):
                    raise DesktopDependencyError(
                        "Screenshot capture failed. On Linux, make sure this process is running inside "
                        "an active GUI session with access to X11 or Wayland screenshot APIs."
                    ) from exc
                raise DesktopDependencyError(
                    "Screenshot capture failed. On macOS, grant Screen Recording permission "
                    "to the terminal or Python runtime and try again."
                ) from exc

        if PYAUTOGUI_AVAILABLE:
            return pyautogui.screenshot().convert("RGB")

        raise DesktopDependencyError(
            "Screenshot support is unavailable. Install mss or pyautogui first."
        )

    def _take_screenshot_region_image(self, region: CaptureRegion) -> Image.Image:
        if MSS_AVAILABLE:
            try:
                with mss.mss() as sct:
                    screenshot = sct.grab(
                        {
                            "left": int(region.left),
                            "top": int(region.top),
                            "width": int(region.width),
                            "height": int(region.height),
                        }
                    )
                    return Image.frombytes("RGB", screenshot.size, screenshot.rgb)
            except ScreenShotError as exc:
                if sys.platform.startswith("linux"):
                    raise DesktopDependencyError(
                        "Region screenshot capture failed. On Linux, make sure this process is running "
                        "inside an active GUI session with access to X11 or Wayland screenshot APIs."
                    ) from exc
                raise DesktopDependencyError(
                    "Region screenshot capture failed. On macOS, grant Screen Recording permission "
                    "to the terminal or Python runtime and try again."
                ) from exc

        full_image = self._take_screenshot_image()
        box = (
            int(region.left),
            int(region.top),
            int(region.left + region.width),
            int(region.top + region.height),
        )
        return full_image.crop(box)

    def _build_preview_region(
        self,
        image_width: int,
        image_height: int,
        physical_target: CoordinateTarget,
        display: DisplayMetadata,
        crop_size: int,
    ) -> VerificationRegion:
        half = max(16, crop_size // 2)
        center_x = int(round(physical_target.x - display.offset_x))
        center_y = int(round(physical_target.y - display.offset_y))

        left = max(0, center_x - half)
        top = max(0, center_y - half)
        right = min(image_width, center_x + half)
        bottom = min(image_height, center_y + half)

        if right <= left:
            right = min(image_width, left + 1)
        if bottom <= top:
            bottom = min(image_height, top + 1)

        return VerificationRegion(
            left=left,
            top=top,
            width=max(1, right - left),
            height=max(1, bottom - top),
        )

    def _draw_preview_marker(self, image: Image.Image, marker: PreviewMarker) -> None:
        draw = ImageDraw.Draw(image)
        color = marker.color
        radius = 10
        inner_gap = 3

        draw.rectangle(
            [(0, 0), (image.size[0] - 1, image.size[1] - 1)],
            outline=color,
            width=2,
        )

        draw.line(
            [(marker.x - radius, marker.y), (marker.x - inner_gap, marker.y)],
            fill=color,
            width=2,
        )
        draw.line(
            [(marker.x + inner_gap, marker.y), (marker.x + radius, marker.y)],
            fill=color,
            width=2,
        )
        draw.line(
            [(marker.x, marker.y - radius), (marker.x, marker.y - inner_gap)],
            fill=color,
            width=2,
        )
        draw.line(
            [(marker.x, marker.y + inner_gap), (marker.x, marker.y + radius)],
            fill=color,
            width=2,
        )
        draw.ellipse(
            [
                (marker.x - inner_gap, marker.y - inner_gap),
                (marker.x + inner_gap, marker.y + inner_gap),
            ],
            outline=color,
            width=2,
        )

    def _read_monitor_geometry(self, display_id: str | None = None) -> tuple[int, int, int, int]:
        if MSS_AVAILABLE:
            with mss.mss() as sct:
                monitor = self._get_monitor_by_display_id(sct, display_id=display_id)
                return (
                    int(monitor["width"]),
                    int(monitor["height"]),
                    int(monitor["left"]),
                    int(monitor["top"]),
                )

        if PYAUTOGUI_AVAILABLE:
            size = pyautogui.size()
            return int(size.width), int(size.height), 0, 0

        raise DesktopDependencyError(
            "Display metadata support is unavailable. Install mss or pyautogui first."
        )

    def _validate_monitor_geometry(self, physical_width: int, physical_height: int) -> None:
        if physical_width > 0 and physical_height > 0:
            return
        raise DesktopDependencyError(
            "Display geometry is invalid. This usually means the process does not have usable "
            "desktop access yet, or it is running outside a normal GUI session."
        )

    def _preflight_accessibility_access(self) -> bool | None:
        if sys.platform != "darwin":
            return None
        try:
            framework = ctypes.cdll.LoadLibrary(
                "/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices"
            )
            checker = getattr(framework, "AXIsProcessTrusted")
            checker.restype = ctypes.c_bool
            checker.argtypes = []
            return bool(checker())
        except Exception:
            return None

    def _preflight_screen_capture_access(self) -> bool | None:
        if sys.platform != "darwin":
            return None
        try:
            framework = ctypes.cdll.LoadLibrary(
                "/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics"
            )
            checker = getattr(framework, "CGPreflightScreenCaptureAccess")
            checker.restype = ctypes.c_bool
            checker.argtypes = []
            return bool(checker())
        except Exception:
            return None

    def _preflight_apple_events_access(
        self,
        *,
        bundle_id: str = "com.apple.systemevents",
        prompt_if_needed: bool = False,
    ) -> bool | None:
        if sys.platform != "darwin":
            return None
        try:
            framework_path = (
                ctypes.util.find_library("CoreServices")
                or "/System/Library/Frameworks/CoreServices.framework/CoreServices"
            )
            framework = ctypes.cdll.LoadLibrary(framework_path)

            class AEDesc(ctypes.Structure):
                _fields_ = [
                    ("descriptorType", ctypes.c_uint32),
                    ("dataHandle", ctypes.c_void_p),
                ]

            ae_create_desc = getattr(framework, "AECreateDesc")
            ae_create_desc.restype = ctypes.c_short
            ae_create_desc.argtypes = [
                ctypes.c_uint32,
                ctypes.c_void_p,
                ctypes.c_longlong,
                ctypes.POINTER(AEDesc),
            ]

            ae_dispose_desc = getattr(framework, "AEDisposeDesc")
            ae_dispose_desc.restype = ctypes.c_short
            ae_dispose_desc.argtypes = [ctypes.POINTER(AEDesc)]

            determine_permission = getattr(framework, "AEDeterminePermissionToAutomateTarget")
            determine_permission.restype = ctypes.c_int32
            determine_permission.argtypes = [
                ctypes.POINTER(AEDesc),
                ctypes.c_uint32,
                ctypes.c_uint32,
                ctypes.c_bool,
            ]

            type_application_bundle_id = 1651863140
            k_core_event_class = 1634039412
            k_ae_open_application = 1868656752
            err_ae_event_not_permitted = -1743

            bundle_bytes = bundle_id.encode("utf-8")
            descriptor = AEDesc()
            create_status = ae_create_desc(
                type_application_bundle_id,
                ctypes.c_char_p(bundle_bytes),
                len(bundle_bytes),
                ctypes.byref(descriptor),
            )
            if create_status != 0:
                return None

            try:
                permission_status = determine_permission(
                    ctypes.byref(descriptor),
                    k_core_event_class,
                    k_ae_open_application,
                    bool(prompt_if_needed),
                )
            finally:
                ae_dispose_desc(ctypes.byref(descriptor))

            if permission_status == 0:
                return True
            if permission_status == err_ae_event_not_permitted:
                return False
            return None
        except Exception:
            return None

    def _request_platform_permission(
        self,
        *,
        permission_id: str,
        open_settings_on_failure: bool,
    ) -> PermissionRequestResult:
        if sys.platform != "darwin":
            return PermissionRequestResult(
                permission_id=permission_id,
                attempted=False,
                status="unsupported",
                granted=None,
                message="Permission prompts are currently automated only on macOS.",
            )

        if permission_id == "accessibility":
            granted = self._prompt_accessibility_access()
            if not granted and open_settings_on_failure:
                self._open_system_settings_url(
                    "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
                )
            return PermissionRequestResult(
                permission_id=permission_id,
                attempted=True,
                status=self._permission_status(granted),
                granted=granted,
                message=(
                    "Requested Accessibility permission."
                    if granted
                    else "Opened or prompted Accessibility permission. You may still need to approve it manually."
                ),
            )

        if permission_id == "screen_recording":
            opened = False
            if open_settings_on_failure:
                opened = self._open_system_settings_url(
                    "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
                )
            granted = self._preflight_screen_capture_access()
            return PermissionRequestResult(
                permission_id=permission_id,
                attempted=opened,
                status=self._permission_status(granted),
                granted=granted,
                message=(
                    "Opened Screen Recording settings. macOS requires manual approval here."
                    if opened
                    else "Screen Recording must be approved manually in System Settings."
                ),
            )

        if permission_id == "apple_events":
            granted = self._preflight_apple_events_access(prompt_if_needed=True)
            if granted is not True and open_settings_on_failure:
                self._open_system_settings_url(
                    "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation"
                )
            return PermissionRequestResult(
                permission_id=permission_id,
                attempted=True,
                status=self._permission_status(granted),
                granted=granted,
                message=(
                    "Requested Automation / Apple Events access."
                    if granted
                    else "Opened or prompted Automation / Apple Events access. You may still need to approve it manually."
                ),
            )

        return PermissionRequestResult(
            permission_id=permission_id,
            attempted=False,
            status="unsupported",
            granted=None,
            message=f"Unsupported permission id: {permission_id}",
        )

    def _get_primary_monitor(self, sct) -> dict:
        monitors = getattr(sct, "monitors", [])
        capture_mode = os.getenv("CUA_CAPTURE_DISPLAY_MODE", "all").strip().lower()
        if capture_mode == "primary" and len(monitors) > 1:
            return monitors[1]
        if len(monitors) > 1:
            return monitors[0]
        if len(monitors) == 1:
            return monitors[0]
        raise DesktopDependencyError(
            "No monitors were reported by mss. Check screen recording permissions or use a GUI session."
        )

    def _get_individual_monitors(self, sct) -> list[dict]:
        monitors = getattr(sct, "monitors", [])
        if len(monitors) > 1:
            return [monitor for monitor in monitors[1:] if isinstance(monitor, dict)]
        if len(monitors) == 1:
            return [monitors[0]]
        return []

    def _permission_status(self, granted: bool | None) -> str:
        if granted is True:
            return "granted"
        if granted is False:
            return "not_granted"
        return "unknown"

    def _linux_accessibility_stack_available(self) -> bool:
        try:
            import pyatspi  # type: ignore[import-not-found]
        except ImportError:
            return False
        return hasattr(pyatspi, "Registry")

    def _linux_gui_session_available(self) -> bool:
        return bool(os.getenv("DISPLAY") or os.getenv("WAYLAND_DISPLAY"))

    def _prompt_accessibility_access(self) -> bool | None:
        if sys.platform != "darwin":
            return None
        try:
            framework = ctypes.cdll.LoadLibrary(
                "/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices"
            )
            checker = getattr(framework, "AXIsProcessTrustedWithOptions")
            checker.restype = ctypes.c_bool
            checker.argtypes = [ctypes.c_void_p]
            return bool(checker(None))
        except Exception:
            # Fallback to opening settings when direct prompt is unavailable.
            self._open_system_settings_url(
                "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
            )
            return self._preflight_accessibility_access()

    def _open_system_settings_url(self, url: str) -> bool:
        if sys.platform != "darwin":
            return False
        try:
            subprocess.run(["open", url], check=True, capture_output=True, text=True)
            return True
        except Exception:
            return False

    def _get_monitor_by_display_id(self, sct, display_id: str | None = None) -> dict:
        resolved_display_id = (display_id or self.default_display_id).strip() or self.default_display_id
        if resolved_display_id == self.default_display_id:
            return self._get_primary_monitor(sct)

        if resolved_display_id.startswith("display-"):
            suffix = resolved_display_id.split("-", 1)[1]
            try:
                index = int(suffix)
            except ValueError as exc:
                raise ValueError(f"Invalid display_id: {resolved_display_id}") from exc
            monitors = self._get_individual_monitors(sct)
            if 1 <= index <= len(monitors):
                return monitors[index - 1]
            raise ValueError(
                f"Unknown display_id '{resolved_display_id}'. Available displays: "
                + ", ".join(f"display-{i}" for i in range(1, len(monitors) + 1))
            )

        raise ValueError(f"Unsupported display_id: {resolved_display_id}")

    def _capture_scope_for_display_id(self, display_id: str) -> str:
        return "virtual_desktop" if display_id == self.default_display_id else "display"

    def _display_for_physical_point(self, x: float, y: float) -> DisplayMetadata:
        displays = self.list_display_metadata()
        for display in displays:
            left = display.offset_x
            top = display.offset_y
            right = left + display.physical_width
            bottom = top + display.physical_height
            if left <= x < right and top <= y < bottom:
                return display
        return self.get_display_metadata()

    def _logical_region_to_physical(
        self,
        region: CaptureRegion,
        display: DisplayMetadata,
    ) -> CaptureRegion:
        left = int(round(display.offset_x + region.left * display.scale_x))
        top = int(round(display.offset_y + region.top * display.scale_y))
        width = max(1, int(round(region.width * display.scale_x)))
        height = max(1, int(round(region.height * display.scale_y)))
        return CaptureRegion(left=left, top=top, width=width, height=height)

    def _display_for_snapshot(self, snapshot: AccessibilitySnapshotResponse) -> DisplayMetadata:
        focused_windows = [window for window in snapshot.windows if window.focused and window.bounds]
        candidate_windows = focused_windows or [window for window in snapshot.windows if window.bounds]
        if not candidate_windows:
            return self.get_display_metadata()
        bounds = candidate_windows[0].bounds
        assert bounds is not None
        center_x = bounds.x + (bounds.width / 2.0)
        center_y = bounds.y + (bounds.height / 2.0)
        return self._display_for_physical_point(center_x, center_y)

    def _window_region_from_snapshot(
        self,
        snapshot: AccessibilitySnapshotResponse,
        display: DisplayMetadata,
    ) -> CaptureRegion:
        focused_windows = [window for window in snapshot.windows if window.focused and window.bounds]
        candidate_windows = focused_windows or [window for window in snapshot.windows if window.bounds]
        if not candidate_windows:
            return CaptureRegion(
                left=0,
                top=0,
                width=display.logical_width,
                height=display.logical_height,
            )
        bounds = candidate_windows[0].bounds
        assert bounds is not None
        left = max(0, int(round((bounds.x - display.offset_x) / display.scale_x)))
        top = max(0, int(round((bounds.y - display.offset_y) / display.scale_y)))
        width = max(1, int(round(bounds.width / display.scale_x)))
        height = max(1, int(round(bounds.height / display.scale_y)))
        width = min(width, max(1, display.logical_width - left))
        height = min(height, max(1, display.logical_height - top))
        return CaptureRegion(left=left, top=top, width=width, height=height)

    def _require_pyautogui(self) -> None:
        if not PYAUTOGUI_AVAILABLE:
            raise DesktopDependencyError(
                "Mouse and keyboard control require pyautogui to be installed."
            )

    def _read_application_inventory(self) -> list[AppDescriptor]:
        installed = self._read_installed_apps_by_key()
        try:
            running = self._read_running_apps_by_name()
        except Exception:
            running = {}

        merged: dict[str, AppDescriptor] = {}
        for key, app in installed.items():
            merged[key] = app

        for app in running.values():
            candidate_keys = [
                (app.bundle_id or "").lower(),
                (app.path or "").lower(),
                app.name.lower(),
            ]
            existing = None
            existing_key = None
            for candidate in candidate_keys:
                if candidate and candidate in merged:
                    existing = merged[candidate]
                    existing_key = candidate
                    break
            if existing:
                merged[existing_key or candidate_keys[0]] = AppDescriptor(
                    name=existing.name or app.name,
                    bundle_id=existing.bundle_id or app.bundle_id,
                    path=existing.path or app.path,
                    is_running=True,
                    is_frontmost=app.is_frontmost,
                    pid=app.pid,
                )
            else:
                merged[(app.bundle_id or app.path or app.name).lower()] = app

        return list(merged.values())

    def _read_installed_apps_by_key(self) -> dict[str, AppDescriptor]:
        result: dict[str, AppDescriptor] = {}
        for app_path in self._iter_application_paths():
            descriptor = self._build_installed_app_descriptor(app_path)
            if descriptor is None:
                continue
            key = (descriptor.bundle_id or descriptor.path or descriptor.name).lower()
            result[key] = descriptor
        return result

    def _read_running_apps_by_name(self) -> dict[str, AppDescriptor]:
        if sys.platform.startswith("linux"):
            return self._read_running_apps_by_name_linux()

        result: dict[str, AppDescriptor] = {}
        frontmost_name = self._read_frontmost_app_name()
        ps_output = subprocess.run(
            ["ps", "-axo", "pid=,comm="],
            check=True,
            capture_output=True,
            text=True,
        )
        for line in ps_output.stdout.splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            parts = stripped.split(None, 1)
            if len(parts) != 2:
                continue
            pid_text, command_path = parts
            try:
                pid = int(pid_text)
            except ValueError:
                continue

            command_name = Path(command_path).name
            if not command_name.endswith(".app") and "/Contents/MacOS/" not in command_path:
                continue

            app_path = self._extract_app_path_from_process(command_path)
            descriptor = self._build_running_app_descriptor(
                command_name=command_name,
                command_path=command_path,
                pid=pid,
                app_path=app_path,
                frontmost_name=frontmost_name,
            )
            if descriptor is None:
                continue
            result[descriptor.name.lower()] = descriptor
        return result

    def _iter_application_paths(self) -> list[Path]:
        if sys.platform.startswith("linux"):
            return self._iter_linux_application_entry_paths()

        search_roots = [
            Path("/Applications"),
            Path("/System/Applications"),
            Path("/System/Applications/Utilities"),
            Path.home() / "Applications",
        ]
        seen: set[str] = set()
        paths: list[Path] = []
        for root in search_roots:
            if not root.exists():
                continue
            for dirpath, dirnames, _ in os.walk(root):
                current = Path(dirpath)
                if current.suffix == ".app":
                    resolved = str(current)
                    if resolved not in seen:
                        seen.add(resolved)
                        paths.append(current)
                    dirnames[:] = []
                    continue
                dirnames[:] = [name for name in dirnames if not name.startswith(".")]
        return paths

    def _build_installed_app_descriptor(self, app_path: Path) -> AppDescriptor | None:
        if sys.platform.startswith("linux"):
            return self._build_linux_installed_app_descriptor(app_path)

        if app_path.name.startswith("."):
            return None

        info = self._read_bundle_info(app_path)
        name = (
            self._clean_text(info.get("CFBundleDisplayName"))
            or self._clean_text(info.get("CFBundleName"))
            or app_path.stem
        )
        if not name:
            return None

        bundle_id = self._clean_text(info.get("CFBundleIdentifier"))
        return AppDescriptor(
            name=name.removesuffix(".app"),
            bundle_id=bundle_id,
            path=str(app_path),
            is_running=False,
            is_frontmost=False,
            pid=None,
        )

    def _read_bundle_info(self, app_path: Path) -> dict[str, object]:
        if sys.platform.startswith("linux"):
            return self._read_linux_desktop_entry(app_path)

        info_path = app_path / "Contents" / "Info.plist"
        if not info_path.exists():
            return {}
        try:
            with info_path.open("rb") as fh:
                payload = plistlib.load(fh)
            return payload if isinstance(payload, dict) else {}
        except Exception:
            return {}

    def _extract_app_path_from_process(self, command_path: str) -> Path | None:
        marker = ".app/"
        if marker in command_path:
            prefix, _ = command_path.split(marker, 1)
            return Path(prefix + ".app")
        candidate = Path(command_path)
        if candidate.suffix == ".app":
            return candidate
        return None

    def _build_running_app_descriptor(
        self,
        *,
        command_name: str,
        command_path: str,
        pid: int,
        app_path: Path | None,
        frontmost_name: str | None,
    ) -> AppDescriptor | None:
        info = self._read_bundle_info(app_path) if app_path else {}
        name = (
            self._clean_text(info.get("CFBundleDisplayName"))
            or self._clean_text(info.get("CFBundleName"))
            or (app_path.stem if app_path else None)
            or Path(command_name).stem
        )
        if not name:
            return None

        bundle_id = self._clean_text(info.get("CFBundleIdentifier"))
        normalized_name = name.removesuffix(".app")
        return AppDescriptor(
            name=normalized_name,
            bundle_id=bundle_id,
            path=str(app_path) if app_path else command_path,
            is_running=True,
            is_frontmost=self._app_names_match(frontmost_name, normalized_name),
            pid=pid,
        )

    def _read_frontmost_app_name(self) -> str | None:
        if sys.platform.startswith("linux"):
            return self._read_frontmost_app_name_linux()

        script = '''
        tell application "System Events"
            set frontProc to first application process whose frontmost is true
            return name of frontProc
        end tell
        '''
        try:
            raw = self._run_osascript(script)
        except Exception:
            return None
        return self._clean_text(raw)

    def _resolve_app(self, app_name: str | None = None, bundle_id: str | None = None) -> AppDescriptor | None:
        apps = self._read_application_inventory()
        if bundle_id:
            normalized_bundle = bundle_id.lower()
            for app in apps:
                if (app.bundle_id or "").lower() == normalized_bundle:
                    return app
        if app_name:
            for app in apps:
                if self._app_names_match(app.name, app_name):
                    return app
        return None

    def _build_activate_applescript(self, target: AppDescriptor) -> str:
        if target.bundle_id:
            return f'tell application id "{self._escape_applescript_string(target.bundle_id)}" to activate'
        return f'tell application "{self._escape_applescript_string(target.name)}" to activate'

    def _build_launch_command(
        self,
        *,
        resolved_target: AppDescriptor | None,
        app_name: str | None,
        bundle_id: str | None,
    ) -> tuple[list[str], str, str]:
        if sys.platform.startswith("linux"):
            return self._build_linux_launch_command(
                resolved_target=resolved_target,
                app_name=app_name,
                bundle_id=bundle_id,
            )

        if resolved_target and resolved_target.bundle_id:
            return ["open", "-b", resolved_target.bundle_id], "open_bundle_id", resolved_target.bundle_id
        if bundle_id:
            return ["open", "-b", bundle_id], "open_bundle_id", bundle_id
        if resolved_target:
            return ["open", "-a", resolved_target.name], "open_app_name", resolved_target.name
        if app_name:
            return ["open", "-a", app_name], "open_app_name", app_name
        raise ValueError("Provide app_name or bundle_id.")

    def _activate_platform_app(self, target: AppDescriptor) -> None:
        if sys.platform.startswith("linux"):
            self._activate_linux_app(target)
            return

        script = self._build_activate_applescript(target)
        subprocess.run(["osascript", "-e", script], check=True)

    def _build_accessibility_snapshot_script(
        self,
        app_name: str,
        max_depth: int,
        max_children: int,
    ) -> str:
        escaped_name = self._escape_applescript_string(app_name)
        return f'''
        use framework "Foundation"
        use scripting additions
        using terms from application "System Events"

        on safeText(valueRef)
            try
                if valueRef is missing value then
                    return ""
                end if
                return valueRef as text
            on error
                return ""
            end try
        end safeText

        on safeBool(valueRef)
            try
                return valueRef as boolean
            on error
                return false
            end try
        end safeBool

        on safeNumber(valueRef)
            try
                return valueRef as real
            on error
                return 0
            end try
        end safeNumber

        on safeActionNames(elementRef)
            set actionNames to {{}}
            try
                set actionRefs to actions of elementRef
                repeat with actionRef in actionRefs
                    try
                        set end of actionNames to (name of actionRef) as text
                    end try
                end repeat
            end try
            return actionNames
        end safeActionNames

        on elementBounds(elementRef)
            try
                set p to position of elementRef
                set s to size of elementRef
                return {{x:(item 1 of p), y:(item 2 of p), width:(item 1 of s), height:(item 2 of s)}}
            on error
                return missing value
            end try
        end elementBounds

        on serializeElement(elementRef, depthLeft, childLimit)
            set roleText to my safeText(role of elementRef)
            set subroleText to my safeText(subrole of elementRef)
            set titleText to my safeText(title of elementRef)
            set valueText to my safeText(value of elementRef)
            set descText to my safeText(description of elementRef)
            set enabledValue to false
            try
                set enabledValue to enabled of elementRef
            end try
            set focusedValue to false
            try
                set focusedValue to focused of elementRef
            end try
            set selectedValue to false
            try
                set selectedValue to selected of elementRef
            end try
            set boundsValue to my elementBounds(elementRef)
            set actionNames to my safeActionNames(elementRef)
            set childItems to {{}}
            if depthLeft > 0 then
                try
                    set childRefs to UI elements of elementRef
                    set itemCount to count of childRefs
                    if itemCount > childLimit then
                        set itemCount to childLimit
                    end if
                    repeat with i from 1 to itemCount
                        set end of childItems to my serializeElement(item i of childRefs, depthLeft - 1, childLimit)
                    end repeat
                end try
            end if
            return {{role:roleText, subrole:subroleText, title:titleText, value:valueText, description:descText, enabled:enabledValue, focused:focusedValue, selected:selectedValue, actions:actionNames, bounds:boundsValue, children:childItems}}
        end serializeElement

        on serializeWindow(windowRef, depthLeft, childLimit)
            set roleText to my safeText(role of windowRef)
            set subroleText to my safeText(subrole of windowRef)
            set titleText to my safeText(title of windowRef)
            set focusedValue to false
            try
                set focusedValue to focused of windowRef
            end try
            set boundsValue to my elementBounds(windowRef)
            set childItems to {{}}
            try
                set childRefs to UI elements of windowRef
                set itemCount to count of childRefs
                if itemCount > childLimit then
                    set itemCount to childLimit
                end if
                repeat with i from 1 to itemCount
                    set end of childItems to my serializeElement(item i of childRefs, depthLeft, childLimit)
                end repeat
            end try
            return {{title:titleText, role:roleText, subrole:subroleText, focused:focusedValue, bounds:boundsValue, children:childItems}}
        end serializeWindow

        on serializeProcessRoot(processRef, depthLeft, childLimit)
            set roleText to "AXApplication"
            try
                set roleText to my safeText(role of processRef)
            end try
            set titleText to "{escaped_name}"
            try
                set titleText to my safeText(name of processRef)
            end try
            set childItems to {{}}
            try
                set childRefs to UI elements of processRef
                set itemCount to count of childRefs
                if itemCount > childLimit then
                    set itemCount to childLimit
                end if
                repeat with i from 1 to itemCount
                    set end of childItems to my serializeElement(item i of childRefs, depthLeft, childLimit)
                end repeat
            end try
            return {{window_id:"window-0", title:titleText, role:roleText, subrole:"AXProcessRoot", focused:true, bounds:missing value, children:childItems}}
        end serializeProcessRoot

        tell application "System Events"
            if not (exists process "{escaped_name}") then
                error "Process not found: {escaped_name}"
            end if
            tell process "{escaped_name}"
                set windowItems to {{}}
                set usedProcessRootFallback to false
                try
                    set windowRefs to windows
                    set windowCount to count of windowRefs
                    repeat with i from 1 to windowCount
                        set end of windowItems to my serializeWindow(item i of windowRefs, {max_depth}, {max_children})
                    end repeat
                end try
                if (count of windowItems) is 0 then
                    try
                        set end of windowItems to my serializeProcessRoot(it, {max_depth}, {max_children})
                        set usedProcessRootFallback to true
                    end try
                end if
                set resultMessage to "Captured accessibility snapshot for {escaped_name}."
                if usedProcessRootFallback then
                    set resultMessage to resultMessage & " Used process-root fallback."
                end if
                set resultRecord to {{message:resultMessage, windows:windowItems}}
            end tell
        end tell

        set jsonData to current application's NSJSONSerialization's dataWithJSONObject:resultRecord options:0 |error|:(missing value)
        set jsonText to (current application's NSString's alloc()'s initWithData:jsonData encoding:(current application's NSUTF8StringEncoding)) as text
        return jsonText
        end using terms from
        '''

    def _build_ax_action_script(self, app_name: str, element_id: str, action_name: str) -> str:
        escaped_name = self._escape_applescript_string(app_name)
        escaped_action = self._escape_applescript_string(action_name)
        path_literal = self._build_applescript_path_list(element_id)
        window_index = self._extract_window_index(element_id)
        target_ref_expr = "it" if window_index == 0 else f"window {window_index}"
        return f'''
        use scripting additions

        on resolveElement(windowRef, pathItems)
            set currentRef to windowRef
            repeat with pathItem in pathItems
                set childIndexText to pathItem as text
                set AppleScript's text item delimiters to "-"
                set pieces to text items of childIndexText
                set AppleScript's text item delimiters to ""
                if (count of pieces) is less than 2 then
                    error "Invalid path segment: " & childIndexText
                end if
                set childIndex to (item 2 of pieces) as integer
                set currentRef to UI element childIndex of currentRef
            end repeat
            return currentRef
        end resolveElement

        tell application "System Events"
            tell process "{escaped_name}"
                set targetWindow to {target_ref_expr}
                set targetElement to my resolveElement(targetWindow, {path_literal})
                perform action "{escaped_action}" of targetElement
            end tell
        end tell
        '''

    def _build_ax_set_value_script(self, app_name: str, element_id: str, value: str) -> str:
        escaped_name = self._escape_applescript_string(app_name)
        escaped_value = self._escape_applescript_string(value)
        path_literal = self._build_applescript_path_list(element_id)
        window_index = self._extract_window_index(element_id)
        target_ref_expr = "it" if window_index == 0 else f"window {window_index}"
        return f'''
        use scripting additions

        on resolveElement(windowRef, pathItems)
            set currentRef to windowRef
            repeat with pathItem in pathItems
                set childIndexText to pathItem as text
                set AppleScript's text item delimiters to "-"
                set pieces to text items of childIndexText
                set AppleScript's text item delimiters to ""
                if (count of pieces) is less than 2 then
                    error "Invalid path segment: " & childIndexText
                end if
                set childIndex to (item 2 of pieces) as integer
                set currentRef to UI element childIndex of currentRef
            end repeat
            return currentRef
        end resolveElement

        tell application "System Events"
            tell process "{escaped_name}"
                set targetWindow to {target_ref_expr}
                set targetElement to my resolveElement(targetWindow, {path_literal})
                set value of targetElement to "{escaped_value}"
            end tell
        end tell
        '''

    def _run_osascript(self, script: str) -> str:
        try:
            completed = subprocess.run(
                ["osascript", "-e", script],
                check=True,
                capture_output=True,
                text=True,
            )
        except subprocess.CalledProcessError as exc:
            stderr = (exc.stderr or "").strip()
            stdout = (exc.stdout or "").strip()
            detail_parts = ["osascript failed"]
            if stderr:
                detail_parts.append(f"stderr={stderr}")
            if stdout:
                detail_parts.append(f"stdout={stdout}")
            raise RuntimeError("; ".join(detail_parts)) from exc
        return completed.stdout.strip()

    def _parse_window_descriptor(self, payload: dict, window_index: int) -> UIWindowDescriptor:
        window_id = payload.get("window_id")
        if not isinstance(window_id, str) or not window_id:
            window_id = f"window-{window_index}"
        return UIWindowDescriptor(
            window_id=window_id,
            title=self._clean_text(payload.get("title")),
            role=self._clean_text(payload.get("role")),
            subrole=self._clean_text(payload.get("subrole")),
            bounds=self._parse_bounds(payload.get("bounds")),
            focused=payload.get("focused") if isinstance(payload.get("focused"), bool) else None,
            children=[
                self._parse_ui_element_node(item, parent_id=window_id, child_index=index)
                for index, item in enumerate(payload.get("children", []), start=1)
                if isinstance(item, dict)
            ],
        )

    def _parse_ui_element_node(self, payload: dict, parent_id: str, child_index: int) -> UIElementNode:
        element_id = payload.get("element_id")
        if not isinstance(element_id, str) or not element_id:
            element_id = f"{parent_id}/child-{child_index}"
        available_actions = payload.get("actions")
        if not isinstance(available_actions, list):
            available_actions = []
        return UIElementNode(
            element_id=element_id,
            role=self._clean_text(payload.get("role")) or "unknown",
            subrole=self._clean_text(payload.get("subrole")),
            title=self._clean_text(payload.get("title")),
            value=self._clean_text(payload.get("value")),
            description=self._clean_text(payload.get("description")),
            enabled=payload.get("enabled") if isinstance(payload.get("enabled"), bool) else None,
            focused=payload.get("focused") if isinstance(payload.get("focused"), bool) else None,
            selected=payload.get("selected") if isinstance(payload.get("selected"), bool) else None,
            interactable=self._infer_interactable(payload),
            available_actions=[str(item) for item in available_actions if isinstance(item, str) and item],
            bounds=self._parse_bounds(payload.get("bounds")),
            children=[
                self._parse_ui_element_node(item, parent_id=element_id, child_index=index)
                for index, item in enumerate(payload.get("children", []), start=1)
                if isinstance(item, dict)
            ],
        )

    def _parse_bounds(self, payload: object) -> UIElementBounds | None:
        if not isinstance(payload, dict):
            return None
        numeric_fields = {}
        for field in ("x", "y", "width", "height"):
            value = payload.get(field)
            if not isinstance(value, int | float):
                return None
            numeric_fields[field] = float(value)
        return UIElementBounds(**numeric_fields)

    def _infer_interactable(self, payload: dict) -> bool | None:
        role = self._clean_text(payload.get("role"))
        enabled = payload.get("enabled") if isinstance(payload.get("enabled"), bool) else None
        if enabled is False:
            return False
        if not role:
            return None
        interactive_roles = {
            "AXButton",
            "AXLink",
            "AXTextField",
            "AXTextArea",
            "AXComboBox",
            "AXPopUpButton",
            "AXCheckBox",
            "AXRadioButton",
            "AXTabGroup",
            "AXMenuButton",
            "AXMenuItem",
            "AXCell",
            "AXRow",
            "AXSlider",
            "AXIncrementor",
        }
        actions = payload.get("actions")
        if isinstance(actions, list) and any(isinstance(item, str) and item == "AXPress" for item in actions):
            return True
        return role in interactive_roles

    def _find_element_in_snapshot(
        self,
        snapshot: AccessibilitySnapshotResponse,
        element_id: str,
    ) -> UIElementNode | None:
        for window in snapshot.windows:
            for child in window.children:
                found = self._find_element_in_node(child, element_id)
                if found:
                    return found
        return None

    def _find_element_in_node(self, node: UIElementNode, element_id: str) -> UIElementNode | None:
        if node.element_id == element_id:
            return node
        for child in node.children:
            found = self._find_element_in_node(child, element_id)
            if found:
                return found
        return None

    def _resolve_element_target(
        self,
        element_id: str,
        app_name: str | None,
        bundle_id: str | None,
        snapshot_max_depth: int,
        snapshot_max_children: int,
        use_cached_snapshot: bool,
    ) -> tuple[AccessibilitySnapshotResponse, UIElementNode, CoordinateTarget, CoordinateTarget]:
        snapshot = self.get_accessibility_snapshot(
            app_name=app_name,
            bundle_id=bundle_id,
            max_depth=snapshot_max_depth,
            max_children=snapshot_max_children,
            use_cached=use_cached_snapshot,
        )
        target_node = self._find_element_in_snapshot(snapshot, element_id)
        if target_node is None:
            raise ValueError(f"Element not found: {element_id}")
        if target_node.bounds is None:
            raise ValueError(f"Element has no usable bounds: {element_id}")

        logical_target = self._bounds_center_to_logical(target_node.bounds)
        physical_target = self.logical_to_physical(logical_target)
        return snapshot, target_node, logical_target, physical_target

    def _perform_ax_press(self, app_name: str, element_id: str) -> None:
        self._perform_ax_action(app_name=app_name, element_id=element_id, action_name="AXPress")

    def _perform_ax_action(self, app_name: str, element_id: str, action_name: str) -> None:
        self.assert_accessibility_permission()
        if sys.platform.startswith("linux"):
            self._perform_linux_accessibility_action(
                app_name=app_name,
                element_id=element_id,
                action_name=action_name,
            )
            return
        script = self._build_ax_action_script(
            app_name=app_name,
            element_id=element_id,
            action_name=action_name,
        )
        self._run_osascript(script)

    def _set_ax_value(self, app_name: str, element_id: str, value: str) -> None:
        self.assert_accessibility_permission()
        if sys.platform.startswith("linux"):
            self._set_linux_accessibility_value(
                app_name=app_name,
                element_id=element_id,
                value=value,
            )
            return
        script = self._build_ax_set_value_script(
            app_name=app_name,
            element_id=element_id,
            value=value,
        )
        self._run_osascript(script)

    def _snapshot_matches_target(
        self,
        snapshot: AccessibilitySnapshotResponse | None,
        target: AppDescriptor,
    ) -> bool:
        if snapshot is None or snapshot.app is None:
            return False
        if target.bundle_id and snapshot.app.bundle_id:
            return target.bundle_id == snapshot.app.bundle_id
        return target.name == snapshot.app.name

    def _capture_accessibility_snapshot(
        self,
        target: AppDescriptor,
        max_depth: int,
        max_children: int,
        message_suffix: str = "",
    ) -> AccessibilitySnapshotResponse:
        if sys.platform.startswith("linux"):
            return self._capture_linux_accessibility_snapshot(
                target=target,
                max_depth=max_depth,
                max_children=max_children,
                message_suffix=message_suffix,
            )

        payload: dict[str, object] = {}
        last_error: Exception | None = None
        last_process_name = target.name

        for process_name in self._candidate_accessibility_process_names(target):
            last_process_name = process_name
            script = self._build_accessibility_snapshot_script(
                app_name=process_name,
                max_depth=max_depth,
                max_children=max_children,
            )
            try:
                raw = self._run_osascript(script)
                payload = json.loads(raw) if raw else {}
                last_error = None
                break
            except Exception as exc:
                last_error = exc
                if not self._is_process_not_found_error(exc):
                    raise

        if last_error is not None:
            raise last_error

        windows = [
            self._parse_window_descriptor(item, window_index=index)
            for index, item in enumerate(payload.get("windows", []), start=1)
            if isinstance(item, dict)
        ]
        message = payload.get("message") or f"Captured accessibility snapshot for {last_process_name}."
        if not windows and not self._is_finder_app(target):
            windows = [
                UIWindowDescriptor(
                    window_id="window-0",
                    title=target.name,
                    role="AXApplication",
                    subrole="AXProcessRoot",
                    bounds=None,
                    focused=True,
                    children=[],
                )
            ]
            if "process-root fallback" not in message.lower():
                message = f"{message} Added an empty process-root fallback window."
        if message_suffix:
            message = f"{message}{message_suffix}"
        return AccessibilitySnapshotResponse(
            app=target,
            windows=windows,
            message=message,
        )

    def _encode_png_base64(self, image: Image.Image) -> str:
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("ascii")

    def _extract_ocr_blocks(self, image: Image.Image) -> list[OCRBlock]:
        enable_ocr = os.getenv("CUA_ENABLE_OCR", "").strip().lower()
        if enable_ocr not in {"1", "true", "yes", "on"}:
            return []
        if sys.platform != "darwin":
            return []

        script_path = Path(__file__).with_name("vision_ocr.swift")
        if not script_path.exists():
            return []

        temp_path: Path | None = None
        try:
            with NamedTemporaryFile(suffix=".png", delete=False) as fh:
                temp_path = Path(fh.name)
            image.save(temp_path, format="PNG")
            completed = subprocess.run(
                ["swift", str(script_path), str(temp_path)],
                check=True,
                capture_output=True,
                text=True,
                timeout=float(os.getenv("CUA_OCR_TIMEOUT_SECONDS", "3.0")),
            )
            payload = json.loads(completed.stdout or "{}")
            raw_blocks = payload.get("ocr_blocks", [])
            blocks: list[OCRBlock] = []
            for item in raw_blocks:
                if not isinstance(item, dict):
                    continue
                text = item.get("text")
                x = item.get("x")
                y = item.get("y")
                width = item.get("width")
                height = item.get("height")
                if not isinstance(text, str) or not text.strip():
                    continue
                if not all(isinstance(value, int | float) for value in (x, y, width, height)):
                    continue
                blocks.append(
                    OCRBlock(
                        text=text.strip(),
                        x=int(round(float(x))),
                        y=int(round(float(y))),
                        width=max(1, int(round(float(width)))),
                        height=max(1, int(round(float(height)))),
                    )
                )
            return blocks
        except Exception:
            return []
        finally:
            if temp_path is not None:
                try:
                    temp_path.unlink(missing_ok=True)
                except Exception:
                    pass

    def _append_debug_log(self, record: dict[str, object]) -> None:
        try:
            self._debug_log_path.parent.mkdir(parents=True, exist_ok=True)
            payload = {"ts": time.strftime("%Y-%m-%d %H:%M:%S"), **record}
            with self._debug_log_path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(payload, ensure_ascii=False) + "\n")
        except Exception:
            pass

    def _app_matches_query(self, app: AppDescriptor, normalized_query: str) -> bool:
        for candidate in self._app_name_candidates(app.name):
            normalized_candidate = self._normalize_app_name(candidate)
            if normalized_query in normalized_candidate:
                return True
        return False

    def _app_names_match(self, left: str | None, right: str | None) -> bool:
        if not left or not right:
            return False
        left_names = {self._normalize_app_name(candidate) for candidate in self._app_name_candidates(left)}
        right_names = {self._normalize_app_name(candidate) for candidate in self._app_name_candidates(right)}
        return not left_names.isdisjoint(right_names)

    def _candidate_accessibility_process_names(self, target: AppDescriptor) -> list[str]:
        candidates = self._app_name_candidates(target.name)
        frontmost_name = self._read_frontmost_app_name()
        if self._app_names_match(frontmost_name, target.name):
            candidates.extend(self._app_name_candidates(frontmost_name))

        result: list[str] = []
        seen: set[str] = set()
        for candidate in candidates:
            cleaned = self._clean_text(candidate)
            normalized = self._normalize_app_name(cleaned)
            if not cleaned or not normalized or normalized in seen:
                continue
            seen.add(normalized)
            result.append(cleaned.removesuffix(".app"))
        return result or [target.name]

    def _app_name_candidates(self, name: str | None) -> list[str]:
        if not name:
            return []

        cleaned = self._clean_text(name) or name
        normalized = self._normalize_app_name(cleaned)
        candidates = [cleaned.removesuffix(".app")]

        for group in self._APP_NAME_ALIAS_GROUPS:
            normalized_group = {self._normalize_app_name(item) for item in group}
            if normalized in normalized_group:
                for item in group:
                    if self._normalize_app_name(item) != normalized:
                        candidates.append(item)
                break

        return candidates

    def _normalize_app_name(self, name: str | None) -> str:
        if not name:
            return ""
        return self._clean_text(name).lower().removesuffix(".app")

    def _is_process_not_found_error(self, exc: Exception) -> bool:
        message = str(exc).lower()
        return "process not found" in message

    def _capture_linux_accessibility_snapshot(
        self,
        *,
        target: AppDescriptor,
        max_depth: int,
        max_children: int,
        message_suffix: str = "",
    ) -> AccessibilitySnapshotResponse:
        try:
            import pyatspi  # type: ignore[import-not-found]
        except ImportError as exc:
            raise DesktopDependencyError(
                "Linux accessibility snapshots require pyatspi (AT-SPI). "
                "Install python3-pyatspi or the equivalent package for your distro."
            ) from exc

        desktop = pyatspi.Registry.getDesktop(0)
        candidate_names = {self._normalize_app_name(item) for item in self._candidate_accessibility_process_names(target)}
        app_ref = None
        for index in range(desktop.childCount):
            child = desktop.getChildAtIndex(index)
            child_name = self._normalize_app_name(getattr(child, "name", None))
            if child_name in candidate_names:
                app_ref = child
                break
        if app_ref is None:
            raise ValueError(f"Could not locate Linux accessibility app for {target.name}.")

        windows: list[UIWindowDescriptor] = []
        for index in range(min(app_ref.childCount, max_children)):
            child = app_ref.getChildAtIndex(index)
            if child is None:
                continue
            window = self._serialize_linux_accessibility_window(
                node=child,
                window_index=index + 1,
                depth_left=max_depth,
                child_limit=max_children,
            )
            if window is not None:
                windows.append(window)

        message = f"Captured accessibility snapshot for {target.name} on Linux."
        if message_suffix:
            message += message_suffix
        return AccessibilitySnapshotResponse(
            app=target,
            windows=windows,
            message=message,
        )

    def _serialize_linux_accessibility_window(
        self,
        *,
        node: Any,
        window_index: int,
        depth_left: int,
        child_limit: int,
    ) -> UIWindowDescriptor | None:
        bounds = self._linux_accessibility_bounds(node)
        title = self._clean_text(getattr(node, "name", None))
        role_name = self._linux_accessibility_role_name(node)
        return UIWindowDescriptor(
            window_id=f"window-{window_index}",
            title=title,
            role=role_name,
            subrole=None,
            bounds=bounds,
            focused=self._linux_accessibility_is_focused(node),
            children=self._serialize_linux_accessibility_children(
                node=node,
                parent_id=f"window-{window_index}",
                depth_left=depth_left,
                child_limit=child_limit,
            ),
        )

    def _serialize_linux_accessibility_children(
        self,
        *,
        node: Any,
        parent_id: str,
        depth_left: int,
        child_limit: int,
    ) -> list[UIElementNode]:
        if depth_left <= 0:
            return []
        children: list[UIElementNode] = []
        child_count = min(getattr(node, "childCount", 0), child_limit)
        for index in range(child_count):
            child = node.getChildAtIndex(index)
            if child is None:
                continue
            element_id = f"{parent_id}/child-{index + 1}"
            role_name = self._linux_accessibility_role_name(child) or "unknown"
            actions = self._linux_accessibility_action_names(child)
            children.append(
                UIElementNode(
                    element_id=element_id,
                    role=role_name,
                    subrole=None,
                    title=self._clean_text(getattr(child, "name", None)),
                    value=self._linux_accessibility_value(child),
                    description=self._clean_text(getattr(child, "description", None)),
                    enabled=self._linux_accessibility_enabled(child),
                    focused=self._linux_accessibility_is_focused(child),
                    selected=self._linux_accessibility_selected(child),
                    interactable=bool(actions),
                    available_actions=actions,
                    bounds=self._linux_accessibility_bounds(child),
                    children=self._serialize_linux_accessibility_children(
                        node=child,
                        parent_id=element_id,
                        depth_left=depth_left - 1,
                        child_limit=child_limit,
                    ),
                )
            )
        return children

    def _linux_accessibility_role_name(self, node: Any) -> str | None:
        try:
            role_name = node.getRoleName()
        except Exception:
            role_name = None
        cleaned = self._clean_text(role_name)
        return cleaned

    def _linux_accessibility_bounds(self, node: Any) -> UIElementBounds | None:
        try:
            component = node.queryComponent()
            x, y, width, height = component.getExtents(0)
        except Exception:
            return None
        if width <= 0 or height <= 0:
            return None
        return UIElementBounds(
            x=float(x),
            y=float(y),
            width=float(width),
            height=float(height),
        )

    def _linux_accessibility_action_names(self, node: Any) -> list[str]:
        try:
            action = node.queryAction()
        except Exception:
            return []
        names: list[str] = []
        for index in range(getattr(action, "nActions", 0)):
            try:
                name = action.getName(index)
            except Exception:
                continue
            cleaned = self._clean_text(name)
            if cleaned:
                names.append(cleaned)
        return names

    def _linux_accessibility_enabled(self, node: Any) -> bool | None:
        try:
            state = node.getState()
            state_type = self._linux_accessibility_state_type("STATE_ENABLED")
            if state_type is not None:
                return bool(state.contains(state_type))
            sensitive_type = self._linux_accessibility_state_type("STATE_SENSITIVE")
            if sensitive_type is not None:
                return bool(state.contains(sensitive_type))
        except Exception:
            return None
        return None

    def _linux_accessibility_is_focused(self, node: Any) -> bool | None:
        try:
            state = node.getState()
            state_type = self._linux_accessibility_state_type("STATE_FOCUSED")
            if state_type is None:
                return None
            return bool(state.contains(state_type))
        except Exception:
            return None

    def _linux_accessibility_selected(self, node: Any) -> bool | None:
        try:
            state = node.getState()
            state_type = self._linux_accessibility_state_type("STATE_SELECTED")
            if state_type is None:
                return None
            return bool(state.contains(state_type))
        except Exception:
            return None

    def _linux_accessibility_value(self, node: Any) -> str | None:
        try:
            text_iface = node.queryText()
            count = text_iface.characterCount
            if count > 0:
                return self._clean_text(text_iface.getText(0, count))
        except Exception:
            pass
        try:
            value_iface = node.queryValue()
            current = value_iface.currentValue
            if current is not None:
                return str(current)
        except Exception:
            pass
        return None

    def _perform_linux_accessibility_action(self, app_name: str, element_id: str, action_name: str) -> None:
        node = self._resolve_linux_accessibility_element(app_name=app_name, element_id=element_id)
        try:
            action = node.queryAction()
        except Exception as exc:
            raise ValueError(f"Element does not expose Linux accessibility actions: {element_id}") from exc
        for index in range(getattr(action, "nActions", 0)):
            try:
                name = action.getName(index)
            except Exception:
                continue
            if self._clean_text(name) == action_name:
                action.doAction(index)
                return
        raise ValueError(f"Linux accessibility action not found: {action_name}")

    def _set_linux_accessibility_value(self, app_name: str, element_id: str, value: str) -> None:
        node = self._resolve_linux_accessibility_element(app_name=app_name, element_id=element_id)
        try:
            editable = node.queryEditableText()
            editable.setTextContents(value)
            return
        except Exception:
            pass
        raise ValueError(f"Linux accessibility element does not support direct value assignment: {element_id}")

    def _resolve_linux_accessibility_element(self, app_name: str, element_id: str) -> Any:
        snapshot = self.get_accessibility_snapshot(
            app_name=app_name,
            max_depth=6,
            max_children=60,
            use_cached=True,
        )
        if snapshot.app is None:
            raise ValueError(f"Could not resolve Linux accessibility app: {app_name}")
        try:
            import pyatspi  # type: ignore[import-not-found]
        except ImportError as exc:
            raise DesktopDependencyError(
                "Linux accessibility actions require pyatspi (AT-SPI)."
            ) from exc

        desktop = pyatspi.Registry.getDesktop(0)
        candidate_names = {self._normalize_app_name(item) for item in self._candidate_accessibility_process_names(snapshot.app)}
        app_ref = None
        for index in range(desktop.childCount):
            child = desktop.getChildAtIndex(index)
            child_name = self._normalize_app_name(getattr(child, "name", None))
            if child_name in candidate_names:
                app_ref = child
                break
        if app_ref is None:
            raise ValueError(f"Could not locate Linux accessibility app for {app_name}.")

        parts = element_id.split("/")
        if not parts or not parts[0].startswith("window-"):
            raise ValueError(f"Unsupported element_id format: {element_id}")
        try:
            window_index = int(parts[0].split("-", 1)[1]) - 1
        except ValueError as exc:
            raise ValueError(f"Unsupported element_id format: {element_id}") from exc
        if window_index < 0 or window_index >= app_ref.childCount:
            raise ValueError(f"Window index out of range for {element_id}")
        node = app_ref.getChildAtIndex(window_index)
        for segment in parts[1:]:
            if not segment.startswith("child-"):
                continue
            child_index = int(segment.split("-", 1)[1]) - 1
            node = node.getChildAtIndex(child_index)
        return node

    def _linux_accessibility_state_type(self, constant_name: str) -> Any | None:
        try:
            import pyatspi  # type: ignore[import-not-found]
        except ImportError:
            return None
        return getattr(pyatspi, constant_name, None)

    def _command_exists(self, name: str) -> bool:
        return shutil.which(name) is not None

    def _run_text_command(self, command: list[str], *, check: bool = True) -> str:
        completed = subprocess.run(
            command,
            check=check,
            capture_output=True,
            text=True,
        )
        return completed.stdout.strip()

    def _write_text_to_clipboard_linux(self, text: str) -> None:
        if self._command_exists("wl-copy"):
            subprocess.run(["wl-copy"], input=text, text=True, check=True)
            return
        if self._command_exists("xclip"):
            subprocess.run(["xclip", "-selection", "clipboard"], input=text, text=True, check=True)
            return
        if self._command_exists("xsel"):
            subprocess.run(["xsel", "--clipboard", "--input"], input=text, text=True, check=True)
            return
        raise DesktopDependencyError(
            "Linux clipboard support requires one of: wl-copy, xclip, or xsel."
        )

    def _iter_linux_application_entry_paths(self) -> list[Path]:
        search_roots = [
            Path.home() / ".local/share/applications",
            Path("/usr/local/share/applications"),
            Path("/usr/share/applications"),
            Path("/var/lib/flatpak/exports/share/applications"),
            Path.home() / ".local/share/flatpak/exports/share/applications",
        ]
        seen: set[str] = set()
        paths: list[Path] = []
        for root in search_roots:
            if not root.exists():
                continue
            for path in sorted(root.rglob("*.desktop")):
                resolved = str(path)
                if resolved in seen:
                    continue
                seen.add(resolved)
                paths.append(path)
        return paths

    def _read_linux_desktop_entry(self, app_path: Path) -> dict[str, object]:
        parser = configparser.ConfigParser(interpolation=None)
        try:
            parser.read(app_path, encoding="utf-8")
        except Exception:
            return {}
        if not parser.has_section("Desktop Entry"):
            return {}
        section = parser["Desktop Entry"]
        return {
            "Name": section.get("Name"),
            "StartupWMClass": section.get("StartupWMClass"),
            "Exec": section.get("Exec"),
            "Icon": section.get("Icon"),
            "NoDisplay": section.get("NoDisplay"),
            "Hidden": section.get("Hidden"),
            "Type": section.get("Type"),
            "Terminal": section.get("Terminal"),
            "X-GNOME-FullName": section.get("X-GNOME-FullName"),
        }

    def _build_linux_installed_app_descriptor(self, app_path: Path) -> AppDescriptor | None:
        info = self._read_linux_desktop_entry(app_path)
        if not info:
            return None
        entry_type = self._clean_text(info.get("Type"))
        if entry_type and entry_type.lower() != "application":
            return None
        if self._desktop_entry_truthy(info.get("Hidden")) or self._desktop_entry_truthy(info.get("NoDisplay")):
            return None
        name = (
            self._clean_text(info.get("Name"))
            or self._clean_text(info.get("X-GNOME-FullName"))
            or app_path.stem
        )
        if not name:
            return None
        bundle_id = app_path.stem
        return AppDescriptor(
            name=name,
            bundle_id=bundle_id,
            path=str(app_path),
            is_running=False,
            is_frontmost=False,
            pid=None,
        )

    def _desktop_entry_truthy(self, value: object) -> bool:
        if not isinstance(value, str):
            return False
        return value.strip().lower() in {"1", "true", "yes"}

    def _read_running_apps_by_name_linux(self) -> dict[str, AppDescriptor]:
        result: dict[str, AppDescriptor] = {}
        frontmost_name = self._read_frontmost_app_name_linux()
        ps_output = subprocess.run(
            ["ps", "-axo", "pid=,comm=,args="],
            check=True,
            capture_output=True,
            text=True,
        )
        for line in ps_output.stdout.splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            parts = stripped.split(None, 2)
            if len(parts) < 2:
                continue
            try:
                pid = int(parts[0])
            except ValueError:
                continue
            command_name = Path(parts[1]).name
            args = parts[2] if len(parts) > 2 else parts[1]
            lower_args = args.lower()
            if not any(marker in lower_args for marker in ("/bin/", "/usr/", ".appimage", "flatpak", "snap/")):
                if command_name.startswith(("dbus-", "gvfs-", "xdg-", "gnome-", "kdeconnect")):
                    continue
            descriptor = AppDescriptor(
                name=command_name,
                bundle_id=command_name.lower(),
                path=args,
                is_running=True,
                is_frontmost=self._app_names_match(frontmost_name, command_name),
                pid=pid,
            )
            result[descriptor.name.lower()] = descriptor
        return result

    def _read_frontmost_app_name_linux(self) -> str | None:
        window_id = None
        if self._command_exists("xdotool"):
            try:
                window_id = self._run_text_command(["xdotool", "getactivewindow"])
            except Exception:
                window_id = None

        if window_id and self._command_exists("xprop"):
            try:
                wm_class = self._run_text_command(["xprop", "-id", window_id, "WM_CLASS"])
                parsed = self._parse_wm_class(wm_class)
                if parsed:
                    return parsed
            except Exception:
                pass

        if self._command_exists("gdbus"):
            try:
                output = self._run_text_command(
                    [
                        "gdbus",
                        "call",
                        "--session",
                        "--dest",
                        "org.gnome.Shell",
                        "--object-path",
                        "/org/gnome/Shell",
                        "--method",
                        "org.gnome.Shell.Eval",
                        "global.display.focus_window ? global.display.focus_window.get_wm_class() : ''",
                    ]
                )
                parsed = self._parse_gnome_shell_eval_string(output)
                if parsed:
                    return parsed
            except Exception:
                pass

        return None

    def _parse_wm_class(self, output: str) -> str | None:
        if "=" not in output:
            return None
        _, value = output.split("=", 1)
        parts = [item.strip().strip('"') for item in value.split(",")]
        for candidate in reversed(parts):
            cleaned = self._clean_text(candidate)
            if cleaned:
                return cleaned
        return None

    def _parse_gnome_shell_eval_string(self, output: str) -> str | None:
        quote_parts = [part for part in output.split("'") if part.strip()]
        if len(quote_parts) >= 2:
            cleaned = self._clean_text(quote_parts[1])
            if cleaned:
                return cleaned
        return None

    def _build_linux_launch_command(
        self,
        *,
        resolved_target: AppDescriptor | None,
        app_name: str | None,
        bundle_id: str | None,
    ) -> tuple[list[str], str, str]:
        desktop_id = None
        if resolved_target and resolved_target.path:
            desktop_id = Path(resolved_target.path).name
        elif bundle_id:
            desktop_id = bundle_id if bundle_id.endswith(".desktop") else f"{bundle_id}.desktop"

        if desktop_id and self._command_exists("gtk-launch"):
            return ["gtk-launch", desktop_id.removesuffix(".desktop")], "gtk_launch", desktop_id

        if resolved_target and resolved_target.path and resolved_target.path.endswith(".desktop"):
            exec_line = self._clean_text(self._read_linux_desktop_entry(Path(resolved_target.path)).get("Exec"))
            if exec_line:
                return self._desktop_exec_to_command(exec_line), "desktop_exec", resolved_target.name

        if app_name:
            if self._command_exists("gtk-launch"):
                sanitized = app_name.replace(" ", "-").lower()
                return ["gtk-launch", sanitized], "gtk_launch_guess", app_name
            if self._command_exists("xdg-open"):
                return ["xdg-open", app_name], "xdg_open_name", app_name

        raise ValueError("Provide app_name or bundle_id.")

    def _desktop_exec_to_command(self, exec_line: str) -> list[str]:
        parts = shlex.split(exec_line)
        filtered: list[str] = []
        for part in parts:
            if part.startswith("%"):
                continue
            filtered.append(part)
        if not filtered:
            raise ValueError("Desktop entry Exec command is empty.")
        return filtered

    def _activate_linux_app(self, target: AppDescriptor) -> None:
        if self._command_exists("xdotool"):
            for candidate in self._app_name_candidates(target.name):
                try:
                    window_id = self._run_text_command(["xdotool", "search", "--name", candidate], check=False)
                except Exception:
                    continue
                for line in window_id.splitlines():
                    cleaned = self._clean_text(line)
                    if not cleaned:
                        continue
                    subprocess.run(["xdotool", "windowactivate", cleaned], check=True)
                    return

        window_id = self._find_linux_window_id_for_app(target)
        if window_id and self._command_exists("wmctrl"):
            try:
                subprocess.run(["wmctrl", "-ia", window_id], check=True, capture_output=True, text=True)
                return
            except Exception:
                pass

        command, _, _ = self._build_linux_launch_command(
            resolved_target=target,
            app_name=target.name,
            bundle_id=target.bundle_id,
        )
        subprocess.run(command, check=True)

    def _find_linux_window_id_for_app(self, target: AppDescriptor) -> str | None:
        if self._command_exists("wmctrl"):
            try:
                output = self._run_text_command(["wmctrl", "-lx"])
            except Exception:
                return None
            candidate_names = {self._normalize_app_name(item) for item in self._app_name_candidates(target.name)}
            for line in output.splitlines():
                parts = line.split(None, 4)
                if len(parts) < 5:
                    continue
                window_id = parts[0]
                wm_class = parts[2]
                title = parts[4]
                normalized = self._normalize_app_name(wm_class.replace(".", " "))
                title_normalized = self._normalize_app_name(title)
                if normalized in candidate_names or title_normalized in candidate_names:
                    return window_id
        return None

    def _is_finder_app(self, target: AppDescriptor | None) -> bool:
        if target is None:
            return False
        if (target.bundle_id or "").lower() == "com.apple.finder":
            return True
        return target.name.lower() == "finder"

    def _ensure_finder_window(self) -> None:
        self._run_osascript(
            '''
            tell application id "com.apple.finder"
                activate
                try
                    reopen
                end try
                try
                    if (count of windows) is 0 then
                        make new Finder window
                    end if
                on error
                    make new Finder window
                end try
            end tell
            '''
        )

    def _bounds_center_to_logical(self, bounds: UIElementBounds) -> CoordinateTarget:
        center_x = bounds.x + bounds.width / 2.0
        center_y = bounds.y + bounds.height / 2.0
        display = self._display_for_physical_point(center_x, center_y)
        center_physical = CoordinateTarget(
            x=center_x,
            y=center_y,
            display_id=display.display_id,
        )
        return self.physical_to_logical(center_physical, display)

    def _clean_text(self, value: object) -> str | None:
        if not isinstance(value, str):
            return None
        text = value.strip()
        return text or None

    def _build_applescript_path_list(self, element_id: str) -> str:
        child_segments = self._extract_child_segments(element_id)
        if not child_segments:
            return "{}"
        quoted = ", ".join(f'"{self._escape_applescript_string(segment)}"' for segment in child_segments)
        return "{" + quoted + "}"

    def _extract_window_index(self, element_id: str) -> int:
        first = element_id.split("/", 1)[0]
        if not first.startswith("window-"):
            raise ValueError(f"Unsupported element_id format: {element_id}")
        try:
            return int(first.split("-", 1)[1])
        except ValueError as exc:
            raise ValueError(f"Unsupported element_id format: {element_id}") from exc

    def _extract_child_segments(self, element_id: str) -> list[str]:
        parts = element_id.split("/")
        if not parts or not parts[0].startswith("window-"):
            raise ValueError(f"Unsupported element_id format: {element_id}")
        return [part for part in parts[1:] if part.startswith("child-")]

    def _escape_applescript_string(self, value: str) -> str:
        return value.replace("\\", "\\\\").replace('"', '\\"')
