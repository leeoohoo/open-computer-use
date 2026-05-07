from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator


class DisplayMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_id: str
    logical_width: int
    logical_height: int
    physical_width: int
    physical_height: int
    scale_x: float = 1.0
    scale_y: float = 1.0
    offset_x: int = 0
    offset_y: int = 0


class CaptureRegion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    left: int
    top: int
    width: int
    height: int


class CoordinateTarget(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: float
    y: float
    display_id: str = "main"


class OCRBlock(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str
    x: int
    y: int
    width: int
    height: int


class DetectedElement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    label: str
    x: int
    y: int
    width: int
    height: int
    confidence: float = 0.0


class AppDescriptor(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    bundle_id: str | None = None
    path: str | None = None
    is_running: bool | None = None
    is_frontmost: bool | None = None
    pid: int | None = None


class InstalledAppsResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    apps: list[AppDescriptor] = Field(default_factory=list)
    count: int = 0
    query: str | None = None
    message: str = ""


class FrontmostAppResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    app: AppDescriptor | None = None
    message: str = ""


class AppControlRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    app_name: str | None = None
    bundle_id: str | None = None
    wait_seconds: float = Field(default=1.0, ge=0.0, le=15.0)

    @model_validator(mode="after")
    def validate_target(self) -> "AppControlRequest":
        if self.app_name or self.bundle_id:
            return self
        raise ValueError("Provide app_name or bundle_id.")


class AccessibilitySnapshotRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    app_name: str | None = None
    bundle_id: str | None = None
    max_depth: int = Field(default=3, ge=0, le=8)
    max_children: int = Field(default=25, ge=1, le=100)
    use_cached: bool = False


class AppControlResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    action: Literal["launch_app", "activate_app"]
    app: AppDescriptor | None = None
    frontmost_app: AppDescriptor | None = None
    strategy: str = ""
    message: str = ""


class PermissionDescriptor(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    label: str
    category: Literal["permission", "capability"]
    group: Literal["system_permission", "runtime_capability"] = "system_permission"
    status: Literal["granted", "not_granted", "unknown", "unsupported"]
    granted: bool | None = None
    can_request: bool = False
    blocking: bool = True
    requires_restart: bool = False
    settings_url: str | None = None
    action_label: str | None = None
    status_hint: str = ""
    manual_steps: list[str] = Field(default_factory=list)
    message: str = ""


class PermissionOverviewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    platform: str
    items: list[PermissionDescriptor] = Field(default_factory=list)
    all_granted: bool = False
    ready_for_desktop_use: bool = False
    missing_permission_ids: list[str] = Field(default_factory=list)
    missing_blocking_ids: list[str] = Field(default_factory=list)
    requestable_permission_ids: list[str] = Field(default_factory=list)
    message: str = ""


class PermissionRequestPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    permission_ids: list[str] = Field(default_factory=list)
    request_missing_only: bool = True
    open_settings_on_failure: bool = True


class PermissionRequestResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    permission_id: str
    attempted: bool = False
    status: Literal["granted", "not_granted", "unknown", "unsupported"]
    granted: bool | None = None
    message: str = ""


class PermissionRequestResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    platform: str
    results: list[PermissionRequestResult] = Field(default_factory=list)
    overview: PermissionOverviewResponse
    message: str = ""


class UIElementBounds(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: float
    y: float
    width: float
    height: float


class UIElementNode(BaseModel):
    model_config = ConfigDict(extra="forbid")

    element_id: str | None = None
    role: str
    subrole: str | None = None
    title: str | None = None
    value: str | None = None
    description: str | None = None
    enabled: bool | None = None
    focused: bool | None = None
    selected: bool | None = None
    interactable: bool | None = None
    available_actions: list[str] = Field(default_factory=list)
    bounds: UIElementBounds | None = None
    children: list["UIElementNode"] = Field(default_factory=list)


class UIWindowDescriptor(BaseModel):
    model_config = ConfigDict(extra="forbid")

    window_id: str | None = None
    title: str | None = None
    role: str | None = None
    subrole: str | None = None
    bounds: UIElementBounds | None = None
    focused: bool | None = None
    children: list[UIElementNode] = Field(default_factory=list)


class AccessibilitySnapshotResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    app: AppDescriptor | None = None
    windows: list[UIWindowDescriptor] = Field(default_factory=list)
    message: str = ""


class ElementActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    app_name: str | None = None
    bundle_id: str | None = None
    element_id: str
    button: Literal["left", "middle", "right"] = "left"
    clicks: int = Field(default=1, ge=1, le=3)
    snapshot_max_depth: int = Field(default=4, ge=0, le=8)
    snapshot_max_children: int = Field(default=40, ge=1, le=100)
    use_cached_snapshot: bool = True


class ElementActionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    action: Literal["click_element"]
    app: AppDescriptor | None = None
    element_id: str
    logical_target: CoordinateTarget | None = None
    physical_target: CoordinateTarget | None = None
    message: str = ""


class PressElementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    app_name: str | None = None
    bundle_id: str | None = None
    element_id: str
    snapshot_max_depth: int = Field(default=4, ge=0, le=8)
    snapshot_max_children: int = Field(default=40, ge=1, le=100)
    use_cached_snapshot: bool = True
    fallback_to_click: bool = True


class PressElementResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    action: Literal["press_element"]
    app: AppDescriptor | None = None
    element_id: str
    strategy: str = ""
    logical_target: CoordinateTarget | None = None
    physical_target: CoordinateTarget | None = None
    message: str = ""


class PerformElementActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    app_name: str | None = None
    bundle_id: str | None = None
    element_id: str
    action_name: str
    snapshot_max_depth: int = Field(default=4, ge=0, le=8)
    snapshot_max_children: int = Field(default=40, ge=1, le=100)
    use_cached_snapshot: bool = True
    fallback_to_click: bool = False


class PerformElementActionResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    action: Literal["perform_element_action"]
    app: AppDescriptor | None = None
    element_id: str
    action_name: str
    strategy: str = ""
    logical_target: CoordinateTarget | None = None
    physical_target: CoordinateTarget | None = None
    message: str = ""


class TypeIntoElementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    app_name: str | None = None
    bundle_id: str | None = None
    element_id: str
    text: str
    click_first: bool = True
    clear_first: bool = False
    typing_interval: float = Field(default=0.02, ge=0.0, le=1.0)
    snapshot_max_depth: int = Field(default=4, ge=0, le=8)
    snapshot_max_children: int = Field(default=40, ge=1, le=100)
    use_cached_snapshot: bool = True


class TypeIntoElementResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    action: Literal["type_into_element"]
    app: AppDescriptor | None = None
    element_id: str
    logical_target: CoordinateTarget | None = None
    physical_target: CoordinateTarget | None = None
    text_length: int = 0
    message: str = ""


class SetValueElementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    app_name: str | None = None
    bundle_id: str | None = None
    element_id: str
    text: str
    snapshot_max_depth: int = Field(default=4, ge=0, le=8)
    snapshot_max_children: int = Field(default=40, ge=1, le=100)
    use_cached_snapshot: bool = True
    fallback_to_typing: bool = True
    click_first_on_fallback: bool = True
    clear_first_on_fallback: bool = False
    typing_interval: float = Field(default=0.02, ge=0.0, le=1.0)


class SetValueElementResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    action: Literal["set_value"]
    app: AppDescriptor | None = None
    element_id: str
    strategy: str = ""
    logical_target: CoordinateTarget | None = None
    physical_target: CoordinateTarget | None = None
    text_length: int = 0
    message: str = ""


class FocusElementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    app_name: str | None = None
    bundle_id: str | None = None
    element_id: str
    snapshot_max_depth: int = Field(default=4, ge=0, le=8)
    snapshot_max_children: int = Field(default=40, ge=1, le=100)
    use_cached_snapshot: bool = True


class FocusElementResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    action: Literal["focus_element"]
    app: AppDescriptor | None = None
    element_id: str
    logical_target: CoordinateTarget | None = None
    physical_target: CoordinateTarget | None = None
    message: str = ""


class ElementPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    app_name: str | None = None
    bundle_id: str | None = None
    element_id: str
    crop_size: int = Field(default=180, ge=32, le=512)
    snapshot_max_depth: int = Field(default=4, ge=0, le=8)
    snapshot_max_children: int = Field(default=40, ge=1, le=100)
    use_cached_snapshot: bool = True


class ElementPreviewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    action: Literal["preview_element"]
    app: AppDescriptor | None = None
    element_id: str
    logical_target: CoordinateTarget | None = None
    physical_target: CoordinateTarget | None = None
    preview_region: VerificationRegion | None = None
    preview_marker: PreviewMarker | None = None
    preview_image_base64: str | None = None
    preview_image_mime_type: str = "image/png"
    message: str = ""


class Observation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    screenshot_base64: str
    screenshot_mime_type: str = "image/png"
    image_width: int | None = None
    image_height: int | None = None
    display: DisplayMetadata
    available_displays: list[DisplayMetadata] = Field(default_factory=list)
    captured_display_id: str | None = None
    capture_scope: Literal["virtual_desktop", "display", "frontmost_window", "region"] = "display"
    region: CaptureRegion | None = None
    frontmost_app: AppDescriptor | None = None
    ocr_blocks: list[OCRBlock] = Field(default_factory=list)
    detected_elements: list[DetectedElement] = Field(default_factory=list)
    timestamp: float


class VerificationRegion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    left: int
    top: int
    width: int
    height: int


class PreviewMarker(BaseModel):
    model_config = ConfigDict(extra="forbid")

    x: int
    y: int
    style: Literal["crosshair"] = "crosshair"
    color: str = "#ff3b30"


class DebugArtifactBundle(BaseModel):
    model_config = ConfigDict(extra="forbid")

    output_dir: str
    metadata_path: str | None = None
    before_image_path: str | None = None
    after_image_path: str | None = None
    preview_image_path: str | None = None
    report_path: str | None = None


class ActionVerification(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_in_bounds: bool | None = None
    pointer_position_matches: bool | None = None
    pointer_distance_pixels: float | None = None
    visual_change_detected: bool | None = None
    screenshot_change_ratio: float | None = None
    verification_method: str = "pointer_position_and_region_diff"
    actual_physical_position: CoordinateTarget | None = None
    compared_region: VerificationRegion | None = None
    verification_status: Literal["passed", "uncertain", "failed"] = "uncertain"
    details: str = ""


class ObserveAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["observe"]


class ObserveRegionAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["observe_region"]
    region: CaptureRegion
    display_id: str = "main"


class ClickAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["click", "double_click", "right_click"]
    target: CoordinateTarget
    button: Literal["left", "middle", "right"] = "left"


class MoveAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["move"]
    target: CoordinateTarget


class TypeTextAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["type_text"]
    text: str
    interval: float = 0.02


class PressKeyAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["press_key"]
    key: str


class HotkeyAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["hotkey"]
    keys: list[str]


class ScrollAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["scroll"]
    direction: Literal["up", "down"] = "down"
    amount: int = 400


class LaunchAppAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["launch_app"]
    app_name: str | None = None
    bundle_id: str | None = None
    wait_seconds: float = Field(default=1.0, ge=0.0, le=15.0)

    @model_validator(mode="after")
    def validate_target(self) -> "LaunchAppAction":
        if self.app_name or self.bundle_id:
            return self
        raise ValueError("Provide app_name or bundle_id.")


class ActivateAppAction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Literal["activate_app"]
    app_name: str | None = None
    bundle_id: str | None = None
    wait_seconds: float = Field(default=0.75, ge=0.0, le=15.0)

    @model_validator(mode="after")
    def validate_target(self) -> "ActivateAppAction":
        if self.app_name or self.bundle_id:
            return self
        raise ValueError("Provide app_name or bundle_id.")


DesktopAction = Annotated[
    Union[
        ObserveAction,
        ObserveRegionAction,
        ClickAction,
        MoveAction,
        TypeTextAction,
        PressKeyAction,
        HotkeyAction,
        ScrollAction,
        LaunchAppAction,
        ActivateAppAction,
    ],
    Field(discriminator="action"),
]


class ExecuteActionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: DesktopAction
    executor_id: str | None = None
    capture_after: bool = True
    verify_action: bool = True
    debug_output_dir: str | None = None


class ActionExecutionResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    success: bool
    action: str
    executor_id: str | None = None
    message: str
    logical_target: CoordinateTarget | None = None
    physical_target: CoordinateTarget | None = None
    before_observation: Observation | None = None
    observation: Observation | None = None
    verification: ActionVerification | None = None
    debug_artifacts: DebugArtifactBundle | None = None
    raw_result: dict = Field(default_factory=dict)


class TargetPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target: CoordinateTarget
    executor_id: str | None = None
    crop_size: int = Field(default=160, ge=32, le=512)
    include_preview_image: bool = False


class TargetPreviewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    executor_id: str
    display: DisplayMetadata
    logical_target: CoordinateTarget
    physical_target: CoordinateTarget
    target_in_bounds: bool
    pointer_position: CoordinateTarget | None = None
    pointer_distance_pixels: float | None = None
    preview_region: VerificationRegion | None = None
    preview_marker: PreviewMarker | None = None
    preview_image_base64: str | None = None
    preview_image_mime_type: str = "image/png"
    message: str = ""


class PointerStateResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    executor_id: str
    display: DisplayMetadata
    logical_position: CoordinateTarget
    physical_position: CoordinateTarget
    message: str = ""


class LocalPathSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str
    roots: list[str] = Field(default_factory=list)
    max_results: int = Field(default=20, ge=1, le=200)
    directories_only: bool = True
    case_sensitive: bool = False


class LocalPathSearchResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str
    roots: list[str] = Field(default_factory=list)
    matches: list[str] = Field(default_factory=list)
    truncated: bool = False
    message: str = ""


class DirectoryListRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str
    include_hidden: bool = False
    max_entries: int = Field(default=200, ge=1, le=1000)


class DirectoryEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    path: str
    is_dir: bool
    size: int | None = None


class DirectoryListResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str
    entries: list[DirectoryEntry] = Field(default_factory=list)
    truncated: bool = False
    message: str = ""


class HealthResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str
    executor: str
