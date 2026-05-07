from __future__ import annotations

import time

from executor.client.desktop.action_executor import DesktopActionExecutor
from executor.client.desktop.controller import DesktopController
from shared.schemas.desktop import (
    ActionExecutionResult,
    AccessibilitySnapshotRequest,
    AccessibilitySnapshotResponse,
    AppControlRequest,
    AppControlResponse,
    CaptureRegion,
    ElementActionRequest,
    ElementActionResponse,
    ElementPreviewRequest,
    ElementPreviewResponse,
    FocusElementRequest,
    FocusElementResponse,
    FrontmostAppResponse,
    DirectoryEntry,
    DirectoryListRequest,
    DirectoryListResponse,
    ExecuteActionRequest,
    InstalledAppsResponse,
    LocalPathSearchRequest,
    LocalPathSearchResponse,
    Observation,
    PointerStateResponse,
    PerformElementActionRequest,
    PerformElementActionResponse,
    PressElementRequest,
    PressElementResponse,
    SetValueElementRequest,
    SetValueElementResponse,
    TargetPreviewRequest,
    TargetPreviewResponse,
    TypeIntoElementRequest,
    TypeIntoElementResponse,
    PermissionOverviewResponse,
    PermissionRequestPayload,
    PermissionRequestResponse,
)
from shared.schemas.runtime import ExecutorStatus
from pathlib import Path
from typing import Iterable


class LocalComputerUseService:
    def __init__(self, controller: DesktopController | None = None) -> None:
        self.executor = DesktopActionExecutor(controller or DesktopController())
        self.controller = self.executor.controller

    def observe(self) -> Observation:
        return self.executor.observe()

    def observe_display(self, display_id: str | None = None) -> Observation:
        return self.controller.capture_observation(display_id=display_id)

    def observe_region(self, region: CaptureRegion, display_id: str | None = None) -> Observation:
        return self.controller.capture_region_observation(region=region, display_id=display_id)

    def observe_frontmost_window(
        self,
        app_name: str | None = None,
        bundle_id: str | None = None,
        max_depth: int = 2,
        max_children: int = 20,
    ) -> Observation:
        return self.controller.capture_frontmost_window_observation(
            app_name=app_name,
            bundle_id=bundle_id,
            max_depth=max_depth,
            max_children=max_children,
        )

    def list_apps(self, query: str | None = None) -> InstalledAppsResponse:
        return self.controller.list_apps(query=query)

    def get_frontmost_app(self) -> FrontmostAppResponse:
        return self.controller.get_frontmost_app()

    def launch_app(self, payload: AppControlRequest) -> AppControlResponse:
        return self.controller.launch_app(
            app_name=payload.app_name,
            bundle_id=payload.bundle_id,
            wait_seconds=payload.wait_seconds,
        )

    def activate_app(self, payload: AppControlRequest) -> AppControlResponse:
        return self.controller.activate_app(
            app_name=payload.app_name,
            bundle_id=payload.bundle_id,
            wait_seconds=payload.wait_seconds,
        )

    def get_accessibility_snapshot(self, payload: AccessibilitySnapshotRequest) -> AccessibilitySnapshotResponse:
        return self.controller.get_accessibility_snapshot(
            app_name=payload.app_name,
            bundle_id=payload.bundle_id,
            max_depth=payload.max_depth,
            max_children=payload.max_children,
            use_cached=payload.use_cached,
        )

    def get_permission_overview(self) -> PermissionOverviewResponse:
        return self.controller.get_permission_overview()

    def request_permissions(self, payload: PermissionRequestPayload) -> PermissionRequestResponse:
        return self.controller.request_permissions(
            permission_ids=payload.permission_ids,
            request_missing_only=payload.request_missing_only,
            open_settings_on_failure=payload.open_settings_on_failure,
        )

    def click_element(self, payload: ElementActionRequest) -> ElementActionResponse:
        return self.controller.click_element(
            element_id=payload.element_id,
            app_name=payload.app_name,
            bundle_id=payload.bundle_id,
            button=payload.button,
            clicks=payload.clicks,
            snapshot_max_depth=payload.snapshot_max_depth,
            snapshot_max_children=payload.snapshot_max_children,
            use_cached_snapshot=payload.use_cached_snapshot,
        )

    def press_element(self, payload: PressElementRequest) -> PressElementResponse:
        return self.controller.press_element(
            element_id=payload.element_id,
            app_name=payload.app_name,
            bundle_id=payload.bundle_id,
            snapshot_max_depth=payload.snapshot_max_depth,
            snapshot_max_children=payload.snapshot_max_children,
            use_cached_snapshot=payload.use_cached_snapshot,
            fallback_to_click=payload.fallback_to_click,
        )

    def perform_element_action(self, payload: PerformElementActionRequest) -> PerformElementActionResponse:
        return self.controller.perform_element_action(
            element_id=payload.element_id,
            action_name=payload.action_name,
            app_name=payload.app_name,
            bundle_id=payload.bundle_id,
            snapshot_max_depth=payload.snapshot_max_depth,
            snapshot_max_children=payload.snapshot_max_children,
            use_cached_snapshot=payload.use_cached_snapshot,
            fallback_to_click=payload.fallback_to_click,
        )

    def type_into_element(self, payload: TypeIntoElementRequest) -> TypeIntoElementResponse:
        return self.controller.type_into_element(
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

    def set_value_for_element(self, payload: SetValueElementRequest) -> SetValueElementResponse:
        return self.controller.set_value_for_element(
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

    def focus_element(self, payload: FocusElementRequest) -> FocusElementResponse:
        return self.controller.focus_element(
            element_id=payload.element_id,
            app_name=payload.app_name,
            bundle_id=payload.bundle_id,
            snapshot_max_depth=payload.snapshot_max_depth,
            snapshot_max_children=payload.snapshot_max_children,
            use_cached_snapshot=payload.use_cached_snapshot,
        )

    def preview_element(self, payload: ElementPreviewRequest) -> ElementPreviewResponse:
        return self.controller.preview_element(
            element_id=payload.element_id,
            app_name=payload.app_name,
            bundle_id=payload.bundle_id,
            crop_size=payload.crop_size,
            snapshot_max_depth=payload.snapshot_max_depth,
            snapshot_max_children=payload.snapshot_max_children,
            use_cached_snapshot=payload.use_cached_snapshot,
        )

    def execute(self, payload: ExecuteActionRequest) -> ActionExecutionResult:
        return self.executor.execute(payload)

    def preview_target(self, payload: TargetPreviewRequest) -> TargetPreviewResponse:
        display = self.controller.get_display_metadata(display_id=payload.target.display_id)
        target_in_bounds = (
            0 <= payload.target.x < display.logical_width
            and 0 <= payload.target.y < display.logical_height
        )
        physical_target = self.controller.logical_to_physical(payload.target, display)

        preview_image_base64 = None
        preview_region = None
        preview_marker = None
        message = "Target preview generated."
        if target_in_bounds and payload.include_preview_image:
            (
                preview_image_base64,
                preview_region,
                _,
                physical_target,
                preview_marker,
            ) = self.controller.capture_preview(
                payload.target,
                crop_size=payload.crop_size,
            )
        elif target_in_bounds:
            preview_region = self.controller._build_preview_region(  # type: ignore[attr-defined]
                image_width=display.physical_width,
                image_height=display.physical_height,
                physical_target=physical_target,
                display=display,
                crop_size=payload.crop_size,
            )
        else:
            message = "Target is outside the logical display bounds."

        pointer_position = None
        pointer_distance_pixels = None
        try:
            pointer_position = self.controller.get_pointer_position()
            pointer_distance_pixels = self.controller.pointer_distance_to(physical_target)
        except Exception:
            pointer_position = None
            pointer_distance_pixels = None

        return TargetPreviewResponse(
            executor_id=payload.executor_id or "local",
            display=display,
            logical_target=payload.target,
            physical_target=physical_target,
            target_in_bounds=target_in_bounds,
            pointer_position=pointer_position,
            pointer_distance_pixels=pointer_distance_pixels,
            preview_region=preview_region,
            preview_marker=preview_marker,
            preview_image_base64=preview_image_base64,
            message=message,
        )

    def click_in_last_observation(
        self,
        *,
        x: float,
        y: float,
        button: str = "left",
        clicks: int = 1,
    ) -> dict:
        logical_target = self.controller.click_in_observation(
            x=x,
            y=y,
            button=button,
            clicks=clicks,
        )
        display = self.controller.get_display_metadata(display_id=logical_target.display_id)
        physical_target = self.controller.logical_to_physical(logical_target, display)
        return {
            "success": True,
            "action": "click_in_viewport",
            "logical_target": logical_target.model_dump(),
            "physical_target": physical_target.model_dump(),
            "message": "Clicked using the last observation viewport.",
        }

    def get_pointer_state(self, executor_id: str | None = None) -> PointerStateResponse:
        physical_position = self.controller.get_pointer_position()
        display = self.controller.get_display_metadata(display_id=physical_position.display_id)
        logical_position = self.controller.physical_to_logical(physical_position, display)
        return PointerStateResponse(
            executor_id=executor_id or "local",
            display=display,
            logical_position=logical_position,
            physical_position=physical_position,
            message="Pointer state captured.",
        )

    def find_paths(self, payload: LocalPathSearchRequest) -> LocalPathSearchResponse:
        query = payload.query.strip()
        if not query:
            raise ValueError("Query must not be empty.")

        roots = self._normalize_search_roots(payload.roots)
        normalized_query = query if payload.case_sensitive else query.lower()
        matches: list[str] = []
        truncated = False

        for root in roots:
            for candidate in self._iter_search_candidates(root):
                name = candidate.name if payload.case_sensitive else candidate.name.lower()
                if normalized_query not in name:
                    continue
                if payload.directories_only and not candidate.is_dir():
                    continue
                matches.append(str(candidate))
                if len(matches) >= payload.max_results:
                    truncated = True
                    break
            if truncated:
                break

        message = f"Found {len(matches)} matching paths."
        if truncated:
            message += " Results were truncated."

        return LocalPathSearchResponse(
            query=query,
            roots=[str(root) for root in roots],
            matches=matches,
            truncated=truncated,
            message=message,
        )

    def list_directory(self, payload: DirectoryListRequest) -> DirectoryListResponse:
        target = Path(payload.path).expanduser().resolve()
        if not target.exists():
            raise ValueError(f"Path does not exist: {target}")
        if not target.is_dir():
            raise ValueError(f"Path is not a directory: {target}")

        entries: list[DirectoryEntry] = []
        truncated = False

        for child in sorted(target.iterdir(), key=lambda item: (not item.is_dir(), item.name.lower())):
            if not payload.include_hidden and child.name.startswith("."):
                continue
            stat_result = None
            try:
                stat_result = child.stat()
            except OSError:
                stat_result = None
            entries.append(
                DirectoryEntry(
                    name=child.name,
                    path=str(child),
                    is_dir=child.is_dir(),
                    size=(None if child.is_dir() else (stat_result.st_size if stat_result else None)),
                )
            )
            if len(entries) >= payload.max_entries:
                truncated = True
                break

        message = f"Listed {len(entries)} entries from {target}."
        if truncated:
            message += " Results were truncated."

        return DirectoryListResponse(
            path=str(target),
            entries=entries,
            truncated=truncated,
            message=message,
        )

    def get_status(self) -> ExecutorStatus:
        return ExecutorStatus(
            executor_id="local",
            name="local-desktop",
            transport="local",
            connected=True,
            platform="local",
            version="0.1.0",
            capabilities=self.executor.capabilities(),
            last_seen_at=time.time(),
        )

    def _normalize_search_roots(self, roots: list[str]) -> list[Path]:
        if roots:
            normalized = [Path(root).expanduser().resolve() for root in roots]
            return [path for path in normalized if path.exists() and path.is_dir()]

        home = Path.home()
        candidates = [
            home / "Desktop",
            home / "Downloads",
            home / "Documents",
            home,
        ]
        result: list[Path] = []
        seen: set[str] = set()
        for candidate in candidates:
            resolved = candidate.resolve()
            key = str(resolved)
            if key in seen or not resolved.exists() or not resolved.is_dir():
                continue
            seen.add(key)
            result.append(resolved)
        return result

    def _iter_search_candidates(self, root: Path) -> Iterable[Path]:
        try:
            for candidate in root.rglob("*"):
                yield candidate
        except OSError:
            return
