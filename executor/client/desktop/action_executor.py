from __future__ import annotations

import base64
import io
import json
import time
from pathlib import Path
from typing import Protocol

from PIL import Image, ImageChops

from executor.client.desktop.controller import DesktopController
from shared.schemas.desktop import (
    ActionExecutionResult,
    ActionVerification,
    ActivateAppAction,
    ClickAction,
    CoordinateTarget,
    DebugArtifactBundle,
    DisplayMetadata,
    ExecuteActionRequest,
    HotkeyAction,
    LaunchAppAction,
    MoveAction,
    Observation,
    ObserveAction,
    ObserveRegionAction,
    PressKeyAction,
    VerificationRegion,
    ScrollAction,
    TypeTextAction,
)

DEFAULT_CAPABILITIES = [
    "observe",
    "click",
    "double_click",
    "right_click",
    "move",
    "type_text",
    "press_key",
    "hotkey",
    "scroll",
    "launch_app",
    "activate_app",
]

POINTER_MATCH_THRESHOLD_PX = 6.0
REGION_DIFF_THRESHOLD = 0.0
DEFAULT_VERIFICATION_DELAY_SECONDS = 0.15
DEFAULT_REGION_HALF_SIZE = 48


class DesktopControllerProtocol(Protocol):
    def capture_observation(self, display_id: str | None = None) -> Observation: ...

    def capture_region_observation(self, region, display_id: str | None = None) -> Observation: ...

    def get_display_metadata(self): ...

    def logical_to_physical(self, target: CoordinateTarget, display=None) -> CoordinateTarget: ...

    def click(self, target: CoordinateTarget, button: str = "left", clicks: int = 1) -> None: ...

    def move(self, target: CoordinateTarget) -> None: ...

    def get_pointer_position(self) -> CoordinateTarget: ...

    def pointer_distance_to(self, physical_target: CoordinateTarget) -> float: ...

    def type_text(self, text: str, interval: float = 0.02) -> None: ...

    def press_key(self, key: str) -> None: ...

    def hotkey(self, keys: list[str]) -> None: ...

    def scroll(self, direction: str, amount: int) -> None: ...

    def launch_app(
        self,
        app_name: str | None = None,
        bundle_id: str | None = None,
        wait_seconds: float = 1.0,
    ) -> object: ...

    def activate_app(
        self,
        app_name: str | None = None,
        bundle_id: str | None = None,
        wait_seconds: float = 0.75,
    ) -> object: ...


class DesktopActionExecutor:
    def __init__(self, controller: DesktopControllerProtocol | None = None) -> None:
        self.controller = controller or DesktopController()

    def capabilities(self) -> list[str]:
        return list(DEFAULT_CAPABILITIES)

    def observe(self) -> Observation:
        return self.controller.capture_observation()

    def execute(self, payload: ExecuteActionRequest) -> ActionExecutionResult:
        action = payload.action

        if isinstance(action, ObserveAction):
            return ActionExecutionResult(
                success=True,
                action=action.action,
                executor_id=payload.executor_id or "local",
                message="Captured observation.",
                observation=self.observe(),
                raw_result={"timestamp": time.time()},
            )

        if isinstance(action, ObserveRegionAction):
            return ActionExecutionResult(
                success=True,
                action=action.action,
                executor_id=payload.executor_id or "local",
                message="Captured region observation.",
                observation=self.controller.capture_region_observation(
                    action.region,
                    display_id=action.display_id,
                ),
                raw_result={
                    "timestamp": time.time(),
                    "display_id": action.display_id,
                    "region": action.region.model_dump(),
                },
            )

        if isinstance(action, ClickAction):
            display = self.controller.get_display_metadata(display_id=action.target.display_id)
            self._ensure_target_in_bounds(action.target, display)
            before_observation = self._maybe_capture_before(payload)
            physical = self.controller.logical_to_physical(action.target, display)
            clicks = 2 if action.action == "double_click" else 1
            button = "right" if action.action == "right_click" else action.button
            self.controller.click(action.target, button=button, clicks=clicks)
            self._sleep_for_verification()
            after_observation = self._maybe_capture_after(payload)
            verification = self._build_pointer_verification(
                display=display,
                logical_target=action.target,
                physical_target=physical,
                before_observation=before_observation,
                after_observation=after_observation,
            )
            debug_artifacts = self._maybe_write_debug_artifacts(
                payload=payload,
                action_name=action.action,
                logical_target=action.target,
                physical_target=physical,
                display=display,
                before_observation=before_observation,
                after_observation=after_observation,
                verification=verification,
            )
            return self._result_for_pointer_action(
                action_name=action.action,
                logical_target=action.target,
                physical_target=physical,
                payload=payload,
                message="Pointer action executed.",
                before_observation=before_observation,
                after_observation=after_observation,
                verification=verification,
                debug_artifacts=debug_artifacts,
            )

        if isinstance(action, MoveAction):
            display = self.controller.get_display_metadata(display_id=action.target.display_id)
            self._ensure_target_in_bounds(action.target, display)
            before_observation = self._maybe_capture_before(payload)
            physical = self.controller.logical_to_physical(action.target, display)
            self.controller.move(action.target)
            self._sleep_for_verification()
            after_observation = self._maybe_capture_after(payload)
            verification = self._build_pointer_verification(
                display=display,
                logical_target=action.target,
                physical_target=physical,
                before_observation=before_observation,
                after_observation=after_observation,
            )
            debug_artifacts = self._maybe_write_debug_artifacts(
                payload=payload,
                action_name=action.action,
                logical_target=action.target,
                physical_target=physical,
                display=display,
                before_observation=before_observation,
                after_observation=after_observation,
                verification=verification,
            )
            return self._result_for_pointer_action(
                action_name=action.action,
                logical_target=action.target,
                physical_target=physical,
                payload=payload,
                message="Cursor moved.",
                before_observation=before_observation,
                after_observation=after_observation,
                verification=verification,
                debug_artifacts=debug_artifacts,
            )

        if isinstance(action, TypeTextAction):
            self.controller.type_text(action.text, interval=action.interval)
            return self._result_without_target(
                action_name=action.action,
                payload=payload,
                message="Typed text.",
                raw_result={"text_length": len(action.text)},
            )

        if isinstance(action, PressKeyAction):
            self.controller.press_key(action.key)
            return self._result_without_target(
                action_name=action.action,
                payload=payload,
                message="Pressed key.",
                raw_result={"key": action.key},
            )

        if isinstance(action, HotkeyAction):
            self.controller.hotkey(action.keys)
            return self._result_without_target(
                action_name=action.action,
                payload=payload,
                message="Pressed hotkey.",
                raw_result={"keys": action.keys},
            )

        if isinstance(action, ScrollAction):
            self.controller.scroll(direction=action.direction, amount=action.amount)
            return self._result_without_target(
                action_name=action.action,
                payload=payload,
                message="Scrolled.",
                raw_result={"direction": action.direction, "amount": action.amount},
            )

        if isinstance(action, LaunchAppAction):
            result = self.controller.launch_app(
                app_name=action.app_name,
                bundle_id=action.bundle_id,
                wait_seconds=action.wait_seconds,
            )
            return self._result_without_target(
                action_name=action.action,
                payload=payload,
                message=result.message,
                raw_result=result.model_dump(),
            )

        if isinstance(action, ActivateAppAction):
            result = self.controller.activate_app(
                app_name=action.app_name,
                bundle_id=action.bundle_id,
                wait_seconds=action.wait_seconds,
            )
            return self._result_without_target(
                action_name=action.action,
                payload=payload,
                message=result.message,
                raw_result=result.model_dump(),
            )

        raise ValueError(f"Unsupported action: {action.action}")

    def _result_for_pointer_action(
        self,
        action_name: str,
        logical_target: CoordinateTarget,
        physical_target: CoordinateTarget,
        payload: ExecuteActionRequest,
        message: str,
        before_observation: Observation | None,
        after_observation: Observation | None,
        verification: ActionVerification | None,
        debug_artifacts: DebugArtifactBundle | None = None,
    ) -> ActionExecutionResult:
        return ActionExecutionResult(
            success=True,
            action=action_name,
            executor_id=payload.executor_id or "local",
            message=message,
            logical_target=logical_target,
            physical_target=physical_target,
            before_observation=before_observation,
            observation=after_observation,
            verification=verification,
            debug_artifacts=debug_artifacts,
            raw_result={"timestamp": time.time()},
        )

    def _result_without_target(
        self,
        action_name: str,
        payload: ExecuteActionRequest,
        message: str,
        raw_result: dict,
    ) -> ActionExecutionResult:
        observation = self.observe() if payload.capture_after else None
        return ActionExecutionResult(
            success=True,
            action=action_name,
            executor_id=payload.executor_id or "local",
            message=message,
            observation=observation,
            raw_result=raw_result,
        )

    def _maybe_capture_before(self, payload: ExecuteActionRequest) -> Observation | None:
        if not payload.verify_action:
            return None
        return self.observe()

    def _maybe_capture_after(self, payload: ExecuteActionRequest) -> Observation | None:
        if payload.capture_after or payload.verify_action:
            return self.observe()
        return None

    def _ensure_target_in_bounds(
        self,
        target: CoordinateTarget,
        display: DisplayMetadata,
    ) -> None:
        if 0 <= target.x < display.logical_width and 0 <= target.y < display.logical_height:
            return
        raise ValueError(
            "Target is outside the logical display bounds: "
            f"({target.x}, {target.y}) not within "
            f"{display.logical_width}x{display.logical_height}."
        )

    def _build_pointer_verification(
        self,
        display: DisplayMetadata,
        logical_target: CoordinateTarget,
        physical_target: CoordinateTarget,
        before_observation: Observation | None,
        after_observation: Observation | None,
    ) -> ActionVerification:
        target_in_bounds = (
            0 <= logical_target.x < display.logical_width
            and 0 <= logical_target.y < display.logical_height
        )
        change_ratio = None
        pointer_matches = None
        pointer_distance = None
        actual_pointer = None
        compared_region = None
        visual_change_detected = None
        details = []
        status: str = "uncertain"

        if not target_in_bounds:
            return ActionVerification(
                target_in_bounds=False,
                visual_change_detected=False,
                screenshot_change_ratio=0.0,
                verification_status="failed",
                details="The target was outside the logical display bounds.",
            )

        details.append("Target was within the logical display bounds.")

        try:
            actual_pointer = self.controller.get_pointer_position()
            pointer_distance = self.controller.pointer_distance_to(physical_target)
            pointer_matches = pointer_distance <= POINTER_MATCH_THRESHOLD_PX
            if pointer_matches:
                details.append(
                    "Pointer landed near the physical target "
                    f"(distance={pointer_distance:.2f}px)."
                )
            else:
                status = "failed"
                details.append(
                    "Pointer did not land close enough to the physical target "
                    f"(distance={pointer_distance:.2f}px)."
                )
        except Exception as exc:
            details.append(f"Pointer position verification was unavailable: {exc}.")

        if before_observation and after_observation:
            change_ratio, compared_region = self._compute_screenshot_change_ratio(
                before_observation.screenshot_base64,
                after_observation.screenshot_base64,
                physical_target,
                display,
            )
            visual_change_detected = change_ratio > REGION_DIFF_THRESHOLD
            if visual_change_detected and status != "failed":
                status = "passed"
                details.append(
                    "Visible local screen change detected near the target "
                    f"(ratio={change_ratio:.6f})."
                )
            else:
                if status != "failed":
                    status = "uncertain"
                details.append(
                    "No meaningful local screen change was detected near the target. "
                    "The click may still have succeeded if the UI stayed visually static."
                )
        else:
            details.append("No before/after screenshots were available for visual verification.")

        return ActionVerification(
            target_in_bounds=True,
            pointer_position_matches=pointer_matches,
            pointer_distance_pixels=pointer_distance,
            visual_change_detected=visual_change_detected,
            screenshot_change_ratio=change_ratio,
            actual_physical_position=actual_pointer,
            compared_region=compared_region,
            verification_status=status,  # type: ignore[arg-type]
            details=" ".join(details),
        )

    def _compute_screenshot_change_ratio(
        self,
        before_screenshot_base64: str,
        after_screenshot_base64: str,
        physical_target: CoordinateTarget,
        display: DisplayMetadata,
    ) -> tuple[float, VerificationRegion | None]:
        try:
            before_bytes = base64.b64decode(before_screenshot_base64, validate=False)
            after_bytes = base64.b64decode(after_screenshot_base64, validate=False)
        except Exception:
            fallback_ratio = 1.0 if before_screenshot_base64 != after_screenshot_base64 else 0.0
            return fallback_ratio, None

        try:
            before_image = Image.open(io.BytesIO(before_bytes)).convert("RGB")
            after_image = Image.open(io.BytesIO(after_bytes)).convert("RGB")
        except Exception:
            fallback_ratio = 1.0 if before_bytes != after_bytes else 0.0
            return fallback_ratio, None

        if before_image.size != after_image.size:
            return 1.0, VerificationRegion(
                left=0,
                top=0,
                width=max(before_image.size[0], after_image.size[0]),
                height=max(before_image.size[1], after_image.size[1]),
            )

        region = self._build_verification_region(
            display=display,
            image_width=before_image.size[0],
            image_height=before_image.size[1],
            physical_target=physical_target,
        )
        box = (
            region.left,
            region.top,
            region.left + region.width,
            region.top + region.height,
        )
        before_region = before_image.crop(box)
        after_region = after_image.crop(box)
        diff = ImageChops.difference(before_region, after_region)
        histogram = diff.histogram()

        total_pixels = before_region.size[0] * before_region.size[1]
        if total_pixels <= 0:
            return 0.0, region

        changed_pixels = 0
        channel_bins = 256
        for pixel_value in range(1, channel_bins):
            offset = pixel_value
            changed_pixels += histogram[offset]
            changed_pixels += histogram[channel_bins + offset]
            changed_pixels += histogram[(channel_bins * 2) + offset]

        max_changed = total_pixels * 3
        ratio = changed_pixels / max_changed if max_changed else 0.0
        return ratio, region

    def _build_verification_region(
        self,
        display: DisplayMetadata,
        image_width: int,
        image_height: int,
        physical_target: CoordinateTarget,
    ) -> VerificationRegion:
        center_x = int(round(physical_target.x - display.offset_x))
        center_y = int(round(physical_target.y - display.offset_y))

        left = max(0, center_x - DEFAULT_REGION_HALF_SIZE)
        top = max(0, center_y - DEFAULT_REGION_HALF_SIZE)
        right = min(image_width, center_x + DEFAULT_REGION_HALF_SIZE)
        bottom = min(image_height, center_y + DEFAULT_REGION_HALF_SIZE)

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

    def _sleep_for_verification(self) -> None:
        time.sleep(DEFAULT_VERIFICATION_DELAY_SECONDS)

    def _maybe_write_debug_artifacts(
        self,
        payload: ExecuteActionRequest,
        action_name: str,
        logical_target: CoordinateTarget,
        physical_target: CoordinateTarget,
        display: DisplayMetadata,
        before_observation: Observation | None,
        after_observation: Observation | None,
        verification: ActionVerification | None,
    ) -> DebugArtifactBundle | None:
        if not payload.debug_output_dir:
            return None

        output_dir = Path(payload.debug_output_dir).expanduser()
        output_dir.mkdir(parents=True, exist_ok=True)

        before_image_path = self._write_observation_image(output_dir / "before.png", before_observation)
        after_image_path = self._write_observation_image(output_dir / "after.png", after_observation)
        preview_image_path = None
        try:
            preview_image_base64, _, _, _, _ = self.controller.capture_preview(
                logical_target,
                crop_size=160,
            )
            preview_path = output_dir / "preview.png"
            preview_path.write_bytes(base64.b64decode(preview_image_base64))
            preview_image_path = str(preview_path)
        except Exception:
            preview_image_path = None

        metadata_path = output_dir / "metadata.json"
        metadata = {
            "action": action_name,
            "logical_target": logical_target.model_dump(),
            "physical_target": physical_target.model_dump(),
            "display": display.model_dump(),
            "verification": verification.model_dump() if verification else None,
            "before_timestamp": before_observation.timestamp if before_observation else None,
            "after_timestamp": after_observation.timestamp if after_observation else None,
        }
        metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
        report_path = output_dir / "report.html"
        report_path.write_text(
            self._build_debug_report_html(
                action_name=action_name,
                logical_target=logical_target,
                physical_target=physical_target,
                verification=verification,
                before_image_path=before_image_path,
                after_image_path=after_image_path,
                preview_image_path=preview_image_path,
                metadata_path=str(metadata_path),
            ),
            encoding="utf-8",
        )

        return DebugArtifactBundle(
            output_dir=str(output_dir),
            metadata_path=str(metadata_path),
            before_image_path=before_image_path,
            after_image_path=after_image_path,
            preview_image_path=preview_image_path,
            report_path=str(report_path),
        )

    def _write_observation_image(self, path: Path, observation: Observation | None) -> str | None:
        if observation is None:
            return None
        path.write_bytes(base64.b64decode(observation.screenshot_base64))
        return str(path)

    def _build_debug_report_html(
        self,
        action_name: str,
        logical_target: CoordinateTarget,
        physical_target: CoordinateTarget,
        verification: ActionVerification | None,
        before_image_path: str | None,
        after_image_path: str | None,
        preview_image_path: str | None,
        metadata_path: str,
    ) -> str:
        verification_status = verification.verification_status if verification else "unknown"
        verification_details = verification.details if verification else "No verification details."
        pointer_distance = (
            f"{verification.pointer_distance_pixels:.2f}px"
            if verification and verification.pointer_distance_pixels is not None
            else "n/a"
        )
        screenshot_change_ratio = (
            f"{verification.screenshot_change_ratio:.6f}"
            if verification and verification.screenshot_change_ratio is not None
            else "n/a"
        )

        def image_block(title: str, path: str | None) -> str:
            if not path:
                return f"<section><h2>{title}</h2><p>Not available.</p></section>"
            filename = Path(path).name
            return (
                f"<section><h2>{title}</h2>"
                f"<img src=\"{filename}\" alt=\"{title}\" />"
                f"<p><code>{filename}</code></p>"
                f"</section>"
            )

        return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Open Computer Use Debug Report</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f6f4ee;
      --panel: #fffdf8;
      --line: #d8d0bf;
      --text: #1d1a16;
      --muted: #6b6255;
      --accent: #c2410c;
      --ok: #1d7a46;
      --warn: #9a6700;
      --bad: #b42318;
    }}
    body {{
      margin: 0;
      padding: 24px;
      background: var(--bg);
      color: var(--text);
      font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    h1, h2 {{ margin: 0 0 12px; }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 16px;
      margin-top: 20px;
    }}
    section {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
    }}
    img {{
      width: 100%;
      height: auto;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: white;
    }}
    .meta {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }}
    .chip {{
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-weight: 600;
      background: #efe7da;
      color: var(--accent);
    }}
    .status-passed {{ color: var(--ok); }}
    .status-uncertain {{ color: var(--warn); }}
    .status-failed {{ color: var(--bad); }}
    code {{
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
    }}
    p.muted {{ color: var(--muted); }}
  </style>
</head>
<body>
  <section>
    <h1>Open Computer Use Debug Report</h1>
    <p class="muted">Action: <strong>{action_name}</strong></p>
    <div class="meta">
      <div><strong>Logical target</strong><br /><code>{logical_target.x}, {logical_target.y}</code></div>
      <div><strong>Physical target</strong><br /><code>{physical_target.x}, {physical_target.y}</code></div>
      <div><strong>Verification</strong><br /><span class="chip status-{verification_status}">{verification_status}</span></div>
      <div><strong>Pointer distance</strong><br /><code>{pointer_distance}</code></div>
      <div><strong>Local diff ratio</strong><br /><code>{screenshot_change_ratio}</code></div>
      <div><strong>Metadata</strong><br /><code>{Path(metadata_path).name}</code></div>
    </div>
    <p>{verification_details}</p>
  </section>
  <div class="grid">
    {image_block("Before", before_image_path)}
    {image_block("After", after_image_path)}
    {image_block("Preview", preview_image_path)}
  </div>
</body>
</html>
"""
