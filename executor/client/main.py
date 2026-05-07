from __future__ import annotations

import asyncio
import argparse
import base64
import json
import platform
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import quote_plus

from executor.client.desktop.action_executor import DesktopActionExecutor
from executor.client.desktop.controller import DesktopController
from shared.schemas.desktop import (
    AccessibilitySnapshotRequest,
    AppControlRequest,
    ClickAction,
    CoordinateTarget,
    ElementActionRequest,
    ElementPreviewRequest,
    ExecuteActionRequest,
    FocusElementRequest,
    PerformElementActionRequest,
    PressElementRequest,
    SetValueElementRequest,
    TypeIntoElementRequest,
)
from shared.schemas.runtime import (
    ExecutorErrorMessage,
    ExecutorExecuteCommand,
    ExecutorExecutionResultMessage,
    ExecutorObserveCommand,
    ExecutorObservationMessage,
    ExecutorPongMessage,
    ExecutorRegisterMessage,
    ExecutorRegistration,
    parse_transport_message,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Local computer-use executor")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("observe", help="Capture a screenshot and display metadata")
    subparsers.add_parser("doctor", help="Run local desktop permission diagnostics")
    subparsers.add_parser("pointer-state", help="Read current pointer position")

    list_apps_parser = subparsers.add_parser("list-apps", help="List installed and running apps")
    list_apps_parser.add_argument("--query")

    subparsers.add_parser("frontmost-app", help="Read the current frontmost app")

    launch_app_parser = subparsers.add_parser("launch-app", help="Launch an app")
    launch_app_parser.add_argument("--app-name")
    launch_app_parser.add_argument("--bundle-id")
    launch_app_parser.add_argument("--wait-seconds", type=float, default=1.0)

    activate_app_parser = subparsers.add_parser("activate-app", help="Bring an app to the foreground")
    activate_app_parser.add_argument("--app-name")
    activate_app_parser.add_argument("--bundle-id")
    activate_app_parser.add_argument("--wait-seconds", type=float, default=0.75)

    snapshot_parser = subparsers.add_parser("accessibility-snapshot", help="Capture a lightweight accessibility tree")
    snapshot_parser.add_argument("--app-name")
    snapshot_parser.add_argument("--bundle-id")
    snapshot_parser.add_argument("--max-depth", type=int, default=3)
    snapshot_parser.add_argument("--max-children", type=int, default=25)
    snapshot_parser.add_argument("--use-cached", action="store_true")

    click_element_parser = subparsers.add_parser("click-element", help="Click a UI element by element_id")
    click_element_parser.add_argument("--element-id", required=True)
    click_element_parser.add_argument("--app-name")
    click_element_parser.add_argument("--bundle-id")
    click_element_parser.add_argument("--button", choices=["left", "middle", "right"], default="left")
    click_element_parser.add_argument("--clicks", type=int, default=1)
    click_element_parser.add_argument("--snapshot-max-depth", type=int, default=4)
    click_element_parser.add_argument("--snapshot-max-children", type=int, default=40)
    click_element_parser.add_argument("--no-use-cached-snapshot", action="store_true")

    press_element_parser = subparsers.add_parser("press-element", help="Press a UI element by element_id")
    press_element_parser.add_argument("--element-id", required=True)
    press_element_parser.add_argument("--app-name")
    press_element_parser.add_argument("--bundle-id")
    press_element_parser.add_argument("--snapshot-max-depth", type=int, default=4)
    press_element_parser.add_argument("--snapshot-max-children", type=int, default=40)
    press_element_parser.add_argument("--no-use-cached-snapshot", action="store_true")
    press_element_parser.add_argument("--no-fallback-to-click", action="store_true")

    perform_action_parser = subparsers.add_parser(
        "perform-element-action",
        help="Run a named accessibility action on a UI element by element_id",
    )
    perform_action_parser.add_argument("--element-id", required=True)
    perform_action_parser.add_argument("--action-name", required=True)
    perform_action_parser.add_argument("--app-name")
    perform_action_parser.add_argument("--bundle-id")
    perform_action_parser.add_argument("--snapshot-max-depth", type=int, default=4)
    perform_action_parser.add_argument("--snapshot-max-children", type=int, default=40)
    perform_action_parser.add_argument("--no-use-cached-snapshot", action="store_true")
    perform_action_parser.add_argument("--fallback-to-click", action="store_true")

    type_element_parser = subparsers.add_parser("type-into-element", help="Type text into a UI element by element_id")
    type_element_parser.add_argument("--element-id", required=True)
    type_element_parser.add_argument("--text", required=True)
    type_element_parser.add_argument("--app-name")
    type_element_parser.add_argument("--bundle-id")
    type_element_parser.add_argument("--click-first", action="store_true")
    type_element_parser.add_argument("--clear-first", action="store_true")
    type_element_parser.add_argument("--typing-interval", type=float, default=0.02)
    type_element_parser.add_argument("--snapshot-max-depth", type=int, default=4)
    type_element_parser.add_argument("--snapshot-max-children", type=int, default=40)
    type_element_parser.add_argument("--no-use-cached-snapshot", action="store_true")

    set_value_parser = subparsers.add_parser("set-value", help="Set a UI element value by element_id")
    set_value_parser.add_argument("--element-id", required=True)
    set_value_parser.add_argument("--text", required=True)
    set_value_parser.add_argument("--app-name")
    set_value_parser.add_argument("--bundle-id")
    set_value_parser.add_argument("--snapshot-max-depth", type=int, default=4)
    set_value_parser.add_argument("--snapshot-max-children", type=int, default=40)
    set_value_parser.add_argument("--no-use-cached-snapshot", action="store_true")
    set_value_parser.add_argument("--no-fallback-to-typing", action="store_true")
    set_value_parser.add_argument("--click-first-on-fallback", action="store_true")
    set_value_parser.add_argument("--clear-first-on-fallback", action="store_true")
    set_value_parser.add_argument("--typing-interval", type=float, default=0.02)

    focus_element_parser = subparsers.add_parser("focus-element", help="Focus a UI element by element_id")
    focus_element_parser.add_argument("--element-id", required=True)
    focus_element_parser.add_argument("--app-name")
    focus_element_parser.add_argument("--bundle-id")
    focus_element_parser.add_argument("--snapshot-max-depth", type=int, default=4)
    focus_element_parser.add_argument("--snapshot-max-children", type=int, default=40)
    focus_element_parser.add_argument("--no-use-cached-snapshot", action="store_true")

    preview_element_parser = subparsers.add_parser("preview-element", help="Preview a UI element by element_id")
    preview_element_parser.add_argument("--element-id", required=True)
    preview_element_parser.add_argument("--app-name")
    preview_element_parser.add_argument("--bundle-id")
    preview_element_parser.add_argument("--crop-size", type=int, default=180)
    preview_element_parser.add_argument("--snapshot-max-depth", type=int, default=4)
    preview_element_parser.add_argument("--snapshot-max-children", type=int, default=40)
    preview_element_parser.add_argument("--no-use-cached-snapshot", action="store_true")

    click_parser = subparsers.add_parser("click", help="Click a logical coordinate")
    click_parser.add_argument("--x", type=float, required=True)
    click_parser.add_argument("--y", type=float, required=True)
    click_parser.add_argument("--button", choices=["left", "middle", "right"], default="left")
    click_parser.add_argument("--clicks", type=int, default=1)

    click_debug_parser = subparsers.add_parser("click-debug", help="Preview, click, and export debug artifacts")
    click_debug_parser.add_argument("--x", type=float, required=True)
    click_debug_parser.add_argument("--y", type=float, required=True)
    click_debug_parser.add_argument("--button", choices=["left", "middle", "right"], default="left")
    click_debug_parser.add_argument("--crop-size", type=int, default=160)
    click_debug_parser.add_argument("--debug-output-dir", required=True)

    open_url_parser = subparsers.add_parser("open-url", help="Open a URL in Safari via keyboard automation")
    open_url_parser.add_argument("--url", required=True)
    open_url_parser.add_argument("--app-name", default="Safari")

    search_web_parser = subparsers.add_parser("search-web", help="Search the web in Safari via keyboard automation")
    search_web_parser.add_argument("--query", required=True)
    search_web_parser.add_argument("--app-name", default="Safari")
    search_web_parser.add_argument(
        "--engine",
        choices=["google", "bing"],
        default="google",
    )

    move_parser = subparsers.add_parser("move", help="Move the pointer")
    move_parser.add_argument("--x", type=float, required=True)
    move_parser.add_argument("--y", type=float, required=True)

    preview_parser = subparsers.add_parser("preview-target", help="Preview logical to physical mapping")
    preview_parser.add_argument("--x", type=float, required=True)
    preview_parser.add_argument("--y", type=float, required=True)
    preview_parser.add_argument("--crop-size", type=int, default=160)
    preview_parser.add_argument("--include-image", action="store_true")
    preview_parser.add_argument("--output", help="Optional path to write the preview PNG")

    type_parser = subparsers.add_parser("type", help="Type text")
    type_parser.add_argument("--text", required=True)
    type_parser.add_argument("--interval", type=float, default=0.02)

    key_parser = subparsers.add_parser("press-key", help="Press a single key")
    key_parser.add_argument("--key", required=True)

    hotkey_parser = subparsers.add_parser("hotkey", help="Press a hotkey")
    hotkey_parser.add_argument("keys", nargs="+")

    scroll_parser = subparsers.add_parser("scroll", help="Scroll the wheel")
    scroll_parser.add_argument("--direction", choices=["up", "down"], default="down")
    scroll_parser.add_argument("--amount", type=int, default=400)

    serve_parser = subparsers.add_parser("serve", help="Connect to the orchestrator over WebSocket")
    serve_parser.add_argument("--server-url", required=True)
    serve_parser.add_argument("--executor-id", required=True)
    serve_parser.add_argument("--name", default="local-executor")

    return parser


def build_search_url(query: str, engine: str = "google") -> str:
    encoded = quote_plus(query)
    if engine == "bing":
        return f"https://www.bing.com/search?q={encoded}"
    return f"https://www.google.com/search?q={encoded}"


def build_open_url_command(url: str, app_name: str = "Safari") -> list[str]:
    if sys.platform.startswith("linux"):
        return ["xdg-open", url]
    return ["open", "-a", app_name, url]


def build_location_hotkey() -> list[str]:
    if sys.platform == "darwin":
        return ["command", "l"]
    return ["ctrl", "l"]


def open_url_in_safari(
    controller: DesktopController,
    url: str,
    app_name: str = "Safari",
    launch_delay_seconds: float = 1.5,
) -> dict:
    if sys.platform == "darwin" or sys.platform.startswith("linux"):
        subprocess.run(
            build_open_url_command(url, app_name),
            check=True,
        )
        return {
            "success": True,
            "app_name": app_name,
            "url": url,
            "strategy": "native_open" if sys.platform == "darwin" else "xdg_open",
        }

    controller.hotkey(["command", "space"])
    time.sleep(0.5)
    controller.type_text(app_name)
    time.sleep(0.2)
    controller.press_key("enter")
    time.sleep(launch_delay_seconds)
    controller.hotkey(build_location_hotkey())
    time.sleep(0.2)
    controller.type_text(url, interval=0.01)
    time.sleep(0.2)
    controller.press_key("enter")
    return {
        "success": True,
        "app_name": app_name,
        "url": url,
        "strategy": "keyboard_fallback",
    }


async def serve_remote_executor(server_url: str, executor_id: str, name: str) -> None:
    try:
        import websockets
    except ImportError as exc:  # pragma: no cover - environment dependent
        raise RuntimeError("Remote serve mode requires the websockets package.") from exc

    executor = DesktopActionExecutor(DesktopController())
    registration = ExecutorRegistration(
        executor_id=executor_id,
        name=name,
        platform=platform.system().lower(),
        capabilities=executor.capabilities(),
    )

    async with websockets.connect(server_url, max_size=50 * 1024 * 1024) as websocket:
        await websocket.send(
            ExecutorRegisterMessage(
                type="register",
                payload=registration,
            ).model_dump_json()
        )
        print(json.dumps({"connected": True, "executor_id": executor_id}, indent=2))

        async for raw in websocket:
            message = parse_transport_message(raw)

            if isinstance(message, ExecutorObserveCommand):
                try:
                    observation = executor.observe()
                    response = ExecutorObservationMessage(
                        type="observation",
                        request_id=message.request_id,
                        observation=observation,
                    )
                except Exception as exc:  # pragma: no cover - runtime dependent
                    response = ExecutorErrorMessage(
                        type="error",
                        request_id=message.request_id,
                        error=str(exc),
                    )
                await websocket.send(response.model_dump_json())
                continue

            if isinstance(message, ExecutorExecuteCommand):
                try:
                    result = executor.execute(message.payload)
                    response = ExecutorExecutionResultMessage(
                        type="execution_result",
                        request_id=message.request_id,
                        result=result,
                    )
                except Exception as exc:  # pragma: no cover - runtime dependent
                    response = ExecutorErrorMessage(
                        type="error",
                        request_id=message.request_id,
                        error=str(exc),
                    )
                await websocket.send(response.model_dump_json())
                continue

            if message.type == "ping":
                await websocket.send(ExecutorPongMessage(type="pong").model_dump_json())


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    controller = DesktopController()
    executor = DesktopActionExecutor(controller)

    if args.command == "observe":
        observation = controller.capture_observation()
        print(observation.model_dump_json(indent=2))
        return

    if args.command == "doctor":
        diagnostics = controller.get_permission_diagnostics()
        display = None
        display_error = None
        screenshot_ok = False
        screenshot_error = None

        try:
            display = controller.get_display_metadata().model_dump()
        except Exception as exc:
            display_error = str(exc)
        displays = []
        try:
            displays = [item.model_dump() for item in controller.list_display_metadata()]
        except Exception:
            displays = []

        try:
            controller.take_screenshot()
            screenshot_ok = True
        except Exception as exc:
            screenshot_error = str(exc)

        print(
            json.dumps(
                {
                    "success": display is not None and screenshot_ok,
                    "action": "doctor",
                    "permissions": diagnostics,
                    "display": display,
                    "displays": displays,
                    "display_error": display_error,
                    "screenshot_ok": screenshot_ok,
                    "screenshot_error": screenshot_error,
                },
                indent=2,
            )
        )
        return

    if args.command == "pointer-state":
        display = controller.get_display_metadata()
        physical = controller.get_pointer_position()
        logical = controller.physical_to_logical(physical, display)
        print(
            json.dumps(
                {
                    "success": True,
                    "action": "pointer-state",
                    "display": display.model_dump(),
                    "logical_position": logical.model_dump(),
                    "physical_position": physical.model_dump(),
                },
                indent=2,
            )
        )
        return

    if args.command == "list-apps":
        result = controller.list_apps(query=args.query)
        print(result.model_dump_json(indent=2))
        return

    if args.command == "frontmost-app":
        result = controller.get_frontmost_app()
        print(result.model_dump_json(indent=2))
        return

    if args.command == "launch-app":
        payload = AppControlRequest(
            app_name=args.app_name,
            bundle_id=args.bundle_id,
            wait_seconds=args.wait_seconds,
        )
        result = controller.launch_app(
            app_name=payload.app_name,
            bundle_id=payload.bundle_id,
            wait_seconds=payload.wait_seconds,
        )
        print(result.model_dump_json(indent=2))
        return

    if args.command == "activate-app":
        payload = AppControlRequest(
            app_name=args.app_name,
            bundle_id=args.bundle_id,
            wait_seconds=args.wait_seconds,
        )
        result = controller.activate_app(
            app_name=payload.app_name,
            bundle_id=payload.bundle_id,
            wait_seconds=payload.wait_seconds,
        )
        print(result.model_dump_json(indent=2))
        return

    if args.command == "accessibility-snapshot":
        payload = AccessibilitySnapshotRequest(
            app_name=args.app_name,
            bundle_id=args.bundle_id,
            max_depth=args.max_depth,
            max_children=args.max_children,
            use_cached=args.use_cached,
        )
        result = controller.get_accessibility_snapshot(
            app_name=payload.app_name,
            bundle_id=payload.bundle_id,
            max_depth=payload.max_depth,
            max_children=payload.max_children,
            use_cached=payload.use_cached,
        )
        print(result.model_dump_json(indent=2))
        return

    if args.command == "click-element":
        payload = ElementActionRequest(
            element_id=args.element_id,
            app_name=args.app_name,
            bundle_id=args.bundle_id,
            button=args.button,
            clicks=args.clicks,
            snapshot_max_depth=args.snapshot_max_depth,
            snapshot_max_children=args.snapshot_max_children,
            use_cached_snapshot=not args.no_use_cached_snapshot,
        )
        result = controller.click_element(
            element_id=payload.element_id,
            app_name=payload.app_name,
            bundle_id=payload.bundle_id,
            button=payload.button,
            clicks=payload.clicks,
            snapshot_max_depth=payload.snapshot_max_depth,
            snapshot_max_children=payload.snapshot_max_children,
            use_cached_snapshot=payload.use_cached_snapshot,
        )
        print(result.model_dump_json(indent=2))
        return

    if args.command == "press-element":
        payload = PressElementRequest(
            element_id=args.element_id,
            app_name=args.app_name,
            bundle_id=args.bundle_id,
            snapshot_max_depth=args.snapshot_max_depth,
            snapshot_max_children=args.snapshot_max_children,
            use_cached_snapshot=not args.no_use_cached_snapshot,
            fallback_to_click=not args.no_fallback_to_click,
        )
        result = controller.press_element(
            element_id=payload.element_id,
            app_name=payload.app_name,
            bundle_id=payload.bundle_id,
            snapshot_max_depth=payload.snapshot_max_depth,
            snapshot_max_children=payload.snapshot_max_children,
            use_cached_snapshot=payload.use_cached_snapshot,
            fallback_to_click=payload.fallback_to_click,
        )
        print(result.model_dump_json(indent=2))
        return

    if args.command == "perform-element-action":
        payload = PerformElementActionRequest(
            element_id=args.element_id,
            action_name=args.action_name,
            app_name=args.app_name,
            bundle_id=args.bundle_id,
            snapshot_max_depth=args.snapshot_max_depth,
            snapshot_max_children=args.snapshot_max_children,
            use_cached_snapshot=not args.no_use_cached_snapshot,
            fallback_to_click=args.fallback_to_click,
        )
        result = controller.perform_element_action(
            element_id=payload.element_id,
            action_name=payload.action_name,
            app_name=payload.app_name,
            bundle_id=payload.bundle_id,
            snapshot_max_depth=payload.snapshot_max_depth,
            snapshot_max_children=payload.snapshot_max_children,
            use_cached_snapshot=payload.use_cached_snapshot,
            fallback_to_click=payload.fallback_to_click,
        )
        print(result.model_dump_json(indent=2))
        return

    if args.command == "type-into-element":
        payload = TypeIntoElementRequest(
            element_id=args.element_id,
            text=args.text,
            app_name=args.app_name,
            bundle_id=args.bundle_id,
            click_first=args.click_first,
            clear_first=args.clear_first,
            typing_interval=args.typing_interval,
            snapshot_max_depth=args.snapshot_max_depth,
            snapshot_max_children=args.snapshot_max_children,
            use_cached_snapshot=not args.no_use_cached_snapshot,
        )
        result = controller.type_into_element(
            element_id=payload.element_id,
            text=payload.text,
            app_name=payload.app_name,
            bundle_id=payload.bundle_id,
            click_first=payload.click_first,
            clear_first=payload.clear_first,
            typing_interval=payload.typing_interval,
            snapshot_max_depth=payload.snapshot_max_depth,
            snapshot_max_children=payload.snapshot_max_children,
            use_cached_snapshot=payload.use_cached_snapshot,
        )
        print(result.model_dump_json(indent=2))
        return

    if args.command == "set-value":
        payload = SetValueElementRequest(
            element_id=args.element_id,
            text=args.text,
            app_name=args.app_name,
            bundle_id=args.bundle_id,
            snapshot_max_depth=args.snapshot_max_depth,
            snapshot_max_children=args.snapshot_max_children,
            use_cached_snapshot=not args.no_use_cached_snapshot,
            fallback_to_typing=not args.no_fallback_to_typing,
            click_first_on_fallback=args.click_first_on_fallback,
            clear_first_on_fallback=args.clear_first_on_fallback,
            typing_interval=args.typing_interval,
        )
        result = controller.set_value_for_element(
            element_id=payload.element_id,
            text=payload.text,
            app_name=payload.app_name,
            bundle_id=payload.bundle_id,
            snapshot_max_depth=payload.snapshot_max_depth,
            snapshot_max_children=payload.snapshot_max_children,
            use_cached_snapshot=payload.use_cached_snapshot,
            fallback_to_typing=payload.fallback_to_typing,
            click_first_on_fallback=payload.click_first_on_fallback,
            clear_first_on_fallback=payload.clear_first_on_fallback,
            typing_interval=payload.typing_interval,
        )
        print(result.model_dump_json(indent=2))
        return

    if args.command == "focus-element":
        payload = FocusElementRequest(
            element_id=args.element_id,
            app_name=args.app_name,
            bundle_id=args.bundle_id,
            snapshot_max_depth=args.snapshot_max_depth,
            snapshot_max_children=args.snapshot_max_children,
            use_cached_snapshot=not args.no_use_cached_snapshot,
        )
        result = controller.focus_element(
            element_id=payload.element_id,
            app_name=payload.app_name,
            bundle_id=payload.bundle_id,
            snapshot_max_depth=payload.snapshot_max_depth,
            snapshot_max_children=payload.snapshot_max_children,
            use_cached_snapshot=payload.use_cached_snapshot,
        )
        print(result.model_dump_json(indent=2))
        return

    if args.command == "preview-element":
        payload = ElementPreviewRequest(
            element_id=args.element_id,
            app_name=args.app_name,
            bundle_id=args.bundle_id,
            crop_size=args.crop_size,
            snapshot_max_depth=args.snapshot_max_depth,
            snapshot_max_children=args.snapshot_max_children,
            use_cached_snapshot=not args.no_use_cached_snapshot,
        )
        result = controller.preview_element(
            element_id=payload.element_id,
            app_name=payload.app_name,
            bundle_id=payload.bundle_id,
            crop_size=payload.crop_size,
            snapshot_max_depth=payload.snapshot_max_depth,
            snapshot_max_children=payload.snapshot_max_children,
            use_cached_snapshot=payload.use_cached_snapshot,
        )
        print(result.model_dump_json(indent=2))
        return

    if args.command == "click":
        target = CoordinateTarget(x=args.x, y=args.y, display_id="main")
        controller.click(target, button=args.button, clicks=args.clicks)
        print(json.dumps({"success": True, "action": "click"}, indent=2))
        return

    if args.command == "click-debug":
        target = CoordinateTarget(x=args.x, y=args.y, display_id="main")
        display = controller.get_display_metadata()
        physical = controller.logical_to_physical(target, display)
        preview_image_base64, preview_region, _, _, preview_marker = controller.capture_preview(
            target,
            crop_size=args.crop_size,
        )

        debug_output_dir = Path(args.debug_output_dir).expanduser()
        debug_output_dir.mkdir(parents=True, exist_ok=True)
        preview_path = debug_output_dir / "preview-before-click.png"
        preview_path.write_bytes(base64.b64decode(preview_image_base64))

        result = executor.execute(
            ExecuteActionRequest(
                action=ClickAction(
                    action="right_click" if args.button == "right" else "click",
                    target=target,
                    button=args.button,
                ),
                executor_id="local",
                capture_after=True,
                verify_action=True,
                debug_output_dir=str(debug_output_dir),
            )
        )

        print(
            json.dumps(
                {
                    "success": result.success,
                    "action": "click-debug",
                    "logical_target": target.model_dump(),
                    "physical_target": physical.model_dump(),
                    "preview_region": preview_region.model_dump(),
                    "preview_marker": preview_marker.model_dump(),
                    "preview_before_click_path": str(preview_path),
                    "verification": result.verification.model_dump() if result.verification else None,
                    "debug_artifacts": result.debug_artifacts.model_dump() if result.debug_artifacts else None,
                },
                indent=2,
            )
        )
        return

    if args.command == "open-url":
        result = open_url_in_safari(
            controller=controller,
            url=args.url,
            app_name=args.app_name,
        )
        print(
            json.dumps(
                {
                    "action": "open-url",
                    **result,
                },
                indent=2,
            )
        )
        return

    if args.command == "search-web":
        url = build_search_url(args.query, engine=args.engine)
        result = open_url_in_safari(
            controller=controller,
            url=url,
            app_name=args.app_name,
        )
        print(
            json.dumps(
                {
                    "action": "search-web",
                    "query": args.query,
                    "engine": args.engine,
                    **result,
                },
                indent=2,
            )
        )
        return

    if args.command == "move":
        target = CoordinateTarget(x=args.x, y=args.y, display_id="main")
        controller.move(target)
        print(json.dumps({"success": True, "action": "move"}, indent=2))
        return

    if args.command == "preview-target":
        target = CoordinateTarget(x=args.x, y=args.y, display_id="main")
        display = controller.get_display_metadata()
        physical = controller.logical_to_physical(target, display)
        preview_image_base64 = None
        preview_region = controller._build_preview_region(  # type: ignore[attr-defined]
            image_width=display.physical_width,
            image_height=display.physical_height,
            physical_target=physical,
            display=display,
            crop_size=args.crop_size,
        )
        preview_marker = {
            "x": max(0, min(preview_region.width - 1, int(round(physical.x - display.offset_x - preview_region.left)))),
            "y": max(0, min(preview_region.height - 1, int(round(physical.y - display.offset_y - preview_region.top)))),
            "style": "crosshair",
            "color": "#ff3b30",
        }
        if args.include_image:
            preview_image_base64, preview_region, _, _, preview_marker = controller.capture_preview(
                target,
                crop_size=args.crop_size,
            )
        pointer_position = None
        pointer_distance_pixels = None
        try:
            pointer_position = controller.get_pointer_position().model_dump()
            pointer_distance_pixels = controller.pointer_distance_to(physical)
        except Exception:
            pointer_position = None
            pointer_distance_pixels = None

        if args.output and preview_image_base64:
            output_path = Path(args.output).expanduser()
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_bytes(base64.b64decode(preview_image_base64))

        print(
            json.dumps(
                {
                    "success": True,
                    "action": "preview-target",
                    "display": display.model_dump(),
                    "logical_target": target.model_dump(),
                    "physical_target": physical.model_dump(),
                    "pointer_position": pointer_position,
                    "pointer_distance_pixels": pointer_distance_pixels,
                    "preview_region": preview_region.model_dump(),
                    "preview_marker": preview_marker.model_dump() if hasattr(preview_marker, "model_dump") else preview_marker,
                    "preview_image_base64": preview_image_base64,
                    "preview_image_mime_type": "image/png",
                    "output_path": str(output_path) if args.output and preview_image_base64 else None,
                },
                indent=2,
            )
        )
        return

    if args.command == "type":
        controller.type_text(args.text, interval=args.interval)
        print(json.dumps({"success": True, "action": "type"}, indent=2))
        return

    if args.command == "press-key":
        controller.press_key(args.key)
        print(json.dumps({"success": True, "action": "press-key"}, indent=2))
        return

    if args.command == "hotkey":
        controller.hotkey(args.keys)
        print(json.dumps({"success": True, "action": "hotkey"}, indent=2))
        return

    if args.command == "scroll":
        controller.scroll(args.direction, args.amount)
        print(json.dumps({"success": True, "action": "scroll"}, indent=2))
        return

    if args.command == "serve":
        asyncio.run(
            serve_remote_executor(
                server_url=args.server_url,
                executor_id=args.executor_id,
                name=args.name,
            )
        )
        return

    parser.error(f"Unsupported command: {args.command}")


if __name__ == "__main__":
    main()
