import unittest
from base64 import b64encode
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from PIL import Image

from executor.client.desktop.action_executor import DesktopActionExecutor
from shared.schemas.desktop import (
    ActivateAppAction,
    CaptureRegion,
    ClickAction,
    CoordinateTarget,
    DisplayMetadata,
    ExecuteActionRequest,
    LaunchAppAction,
    MoveAction,
    Observation,
    ObserveRegionAction,
    TypeTextAction,
)


class FakeController:
    def __init__(self) -> None:
        self.actions = []
        self.capture_count = 0
        self.pointer = CoordinateTarget(x=0, y=0, display_id="main")
        self.display = DisplayMetadata(
            display_id="main",
            logical_width=100,
            logical_height=100,
            physical_width=200,
            physical_height=200,
            scale_x=2.0,
            scale_y=2.0,
            offset_x=10,
            offset_y=20,
        )

    def capture_region_observation(self, region: CaptureRegion, display_id: str | None = None) -> Observation:
        self.actions.append(("observe_region", region, display_id))
        return self.capture_observation(display_id=display_id)

    def get_display_metadata(self, display_id=None):
        return self.display

    def capture_observation(self, display_id: str | None = None) -> Observation:
        self.capture_count += 1
        image = Image.new("RGB", (120, 120), (255, 255, 255))
        pixel = (self.capture_count * 40) % 255
        image.putpixel((20, 20), (pixel, 0, 0))
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        screenshot = b64encode(buffer.getvalue()).decode("ascii")
        return Observation(
            screenshot_base64=screenshot,
            image_width=120,
            image_height=120,
            display=self.display,
            captured_display_id=display_id or self.display.display_id,
            timestamp=float(self.capture_count),
        )

    def logical_to_physical(self, target: CoordinateTarget, display=None) -> CoordinateTarget:
        active = display or self.display
        return CoordinateTarget(
            x=active.offset_x + target.x * active.scale_x,
            y=active.offset_y + target.y * active.scale_y,
            display_id=target.display_id,
        )

    def click(self, target: CoordinateTarget, button: str = "left", clicks: int = 1) -> None:
        self.pointer = self.logical_to_physical(target)
        self.actions.append(("click", target, button, clicks))

    def move(self, target: CoordinateTarget) -> None:
        self.pointer = self.logical_to_physical(target)
        self.actions.append(("move", target))

    def get_pointer_position(self) -> CoordinateTarget:
        return self.pointer

    def pointer_distance_to(self, physical_target: CoordinateTarget) -> float:
        return ((self.pointer.x - physical_target.x) ** 2 + (self.pointer.y - physical_target.y) ** 2) ** 0.5

    def capture_preview(self, target: CoordinateTarget, crop_size: int = 160):
        image = Image.new("RGB", (crop_size, crop_size), (255, 255, 255))
        image.putpixel((crop_size // 2, crop_size // 2), (255, 0, 0))
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        preview = b64encode(buffer.getvalue()).decode("ascii")
        region = type("Region", (), {"left": 0, "top": 0, "width": crop_size, "height": crop_size})()
        marker = type("Marker", (), {"x": crop_size // 2, "y": crop_size // 2})()
        return preview, region, self.display, self.logical_to_physical(target), marker

    def type_text(self, text: str, interval: float = 0.02) -> None:
        self.actions.append(("type_text", text, interval))

    def press_key(self, key: str) -> None:
        self.actions.append(("press_key", key))

    def hotkey(self, keys: list[str]) -> None:
        self.actions.append(("hotkey", keys))

    def scroll(self, direction: str, amount: int) -> None:
        self.actions.append(("scroll", direction, amount))

    def launch_app(
        self,
        app_name: str | None = None,
        bundle_id: str | None = None,
        wait_seconds: float = 1.0,
    ):
        self.actions.append(("launch_app", app_name, bundle_id, wait_seconds))
        return type(
            "LaunchResult",
            (),
            {
                "message": "Launched app.",
                "model_dump": lambda self: {
                    "success": True,
                    "action": "launch_app",
                    "app": {"name": app_name or bundle_id},
                },
            },
        )()

    def activate_app(
        self,
        app_name: str | None = None,
        bundle_id: str | None = None,
        wait_seconds: float = 0.75,
    ):
        self.actions.append(("activate_app", app_name, bundle_id, wait_seconds))
        return type(
            "ActivateResult",
            (),
            {
                "message": "Activated app.",
                "model_dump": lambda self: {
                    "success": True,
                    "action": "activate_app",
                    "app": {"name": app_name or bundle_id},
                },
            },
        )()


class DesktopActionExecutorTests(unittest.TestCase):
    def test_move_returns_logical_and_physical_coordinates(self) -> None:
        executor = DesktopActionExecutor(controller=FakeController())
        payload = ExecuteActionRequest(
            action=MoveAction(
                action="move",
                target=CoordinateTarget(x=5, y=7, display_id="main"),
            ),
            capture_after=False,
            executor_id="local",
        )

        result = executor.execute(payload)

        self.assertTrue(result.success)
        self.assertEqual(result.logical_target.x, 5)
        self.assertEqual(result.logical_target.y, 7)
        self.assertEqual(result.physical_target.x, 20)
        self.assertEqual(result.physical_target.y, 34)
        self.assertEqual(result.executor_id, "local")

    def test_type_text_captures_follow_up_observation(self) -> None:
        executor = DesktopActionExecutor(controller=FakeController())
        payload = ExecuteActionRequest(
            action=TypeTextAction(action="type_text", text="hello"),
            capture_after=True,
            executor_id="local",
        )

        result = executor.execute(payload)

        self.assertTrue(result.success)
        self.assertEqual(result.raw_result["text_length"], 5)
        self.assertIsNotNone(result.observation)
        self.assertEqual(result.observation.timestamp, 1.0)

    def test_observe_region_action_returns_region_observation(self) -> None:
        executor = DesktopActionExecutor(controller=FakeController())
        payload = ExecuteActionRequest(
            action=ObserveRegionAction(
                action="observe_region",
                display_id="main",
                region=CaptureRegion(left=10, top=20, width=30, height=40),
            ),
            capture_after=False,
            executor_id="local",
        )

        result = executor.execute(payload)

        self.assertTrue(result.success)
        self.assertEqual(result.action, "observe_region")
        self.assertIsNotNone(result.observation)
        self.assertEqual(result.observation.captured_display_id, "main")

    def test_click_verification_reports_visible_change(self) -> None:
        executor = DesktopActionExecutor(controller=FakeController())
        payload = ExecuteActionRequest(
            action=ClickAction(
                action="click",
                target=CoordinateTarget(x=10, y=20, display_id="main"),
            ),
            capture_after=True,
            verify_action=True,
            executor_id="local",
        )

        result = executor.execute(payload)

        self.assertTrue(result.success)
        self.assertIsNotNone(result.before_observation)
        self.assertIsNotNone(result.observation)
        self.assertIsNotNone(result.verification)
        self.assertTrue(result.verification.target_in_bounds)
        self.assertTrue(result.verification.visual_change_detected)
        self.assertTrue(result.verification.pointer_position_matches)
        self.assertEqual(result.verification.verification_status, "passed")
        self.assertGreater(result.verification.screenshot_change_ratio, 0.0)
        self.assertIsNotNone(result.verification.compared_region)

    def test_click_uses_target_display_metadata(self) -> None:
        controller = FakeController()
        controller.display = DisplayMetadata(
            display_id="display-2",
            logical_width=200,
            logical_height=100,
            physical_width=400,
            physical_height=200,
            scale_x=2.0,
            scale_y=2.0,
            offset_x=500,
            offset_y=50,
        )
        executor = DesktopActionExecutor(controller=controller)
        payload = ExecuteActionRequest(
            action=ClickAction(
                action="click",
                target=CoordinateTarget(x=10, y=20, display_id="display-2"),
            ),
            capture_after=False,
            verify_action=False,
            executor_id="local",
        )

        result = executor.execute(payload)

        self.assertEqual(result.physical_target.display_id, "display-2")
        self.assertEqual(result.physical_target.x, 520)
        self.assertEqual(result.physical_target.y, 90)

    def test_click_out_of_bounds_raises_value_error(self) -> None:
        executor = DesktopActionExecutor(controller=FakeController())
        payload = ExecuteActionRequest(
            action=ClickAction(
                action="click",
                target=CoordinateTarget(x=500, y=20, display_id="main"),
            ),
            capture_after=True,
            verify_action=True,
            executor_id="local",
        )

        with self.assertRaises(ValueError):
            executor.execute(payload)

    def test_move_verification_fails_when_pointer_is_far_from_target(self) -> None:
        controller = FakeController()
        original_move = controller.move

        def drifted_move(target: CoordinateTarget) -> None:
            original_move(target)
            controller.pointer = CoordinateTarget(x=0, y=0, display_id="main")

        controller.move = drifted_move  # type: ignore[method-assign]
        executor = DesktopActionExecutor(controller=controller)
        payload = ExecuteActionRequest(
            action=MoveAction(
                action="move",
                target=CoordinateTarget(x=20, y=10, display_id="main"),
            ),
            capture_after=True,
            verify_action=True,
            executor_id="local",
        )

        result = executor.execute(payload)

        self.assertFalse(result.verification.pointer_position_matches)
        self.assertEqual(result.verification.verification_status, "failed")

    def test_click_can_write_debug_artifacts(self) -> None:
        executor = DesktopActionExecutor(controller=FakeController())

        with TemporaryDirectory() as temp_dir:
            payload = ExecuteActionRequest(
                action=ClickAction(
                    action="click",
                    target=CoordinateTarget(x=10, y=20, display_id="main"),
                ),
                capture_after=True,
                verify_action=True,
                executor_id="local",
                debug_output_dir=temp_dir,
            )

            result = executor.execute(payload)

            self.assertIsNotNone(result.debug_artifacts)
            output_dir = Path(temp_dir)
            self.assertTrue((output_dir / "before.png").exists())
            self.assertTrue((output_dir / "after.png").exists())
            self.assertTrue((output_dir / "preview.png").exists())
            report_path = output_dir / "report.html"
            self.assertTrue(report_path.exists())
            metadata_path = output_dir / "metadata.json"
            self.assertTrue(metadata_path.exists())
            metadata_text = metadata_path.read_text(encoding="utf-8")
            self.assertIn('"action": "click"', metadata_text)
            self.assertIn('"verification"', metadata_text)
            report_text = report_path.read_text(encoding="utf-8")
            self.assertIn("Open Computer Use Debug Report", report_text)
            self.assertIn("Pointer action executed", result.message)

    def test_launch_app_returns_controller_result_in_raw_result(self) -> None:
        executor = DesktopActionExecutor(controller=FakeController())
        payload = ExecuteActionRequest(
            action=LaunchAppAction(action="launch_app", app_name="Safari"),
            capture_after=False,
            executor_id="local",
        )

        result = executor.execute(payload)

        self.assertTrue(result.success)
        self.assertEqual(result.action, "launch_app")
        self.assertEqual(result.raw_result["app"]["name"], "Safari")

    def test_activate_app_returns_controller_result_in_raw_result(self) -> None:
        executor = DesktopActionExecutor(controller=FakeController())
        payload = ExecuteActionRequest(
            action=ActivateAppAction(action="activate_app", app_name="Finder"),
            capture_after=False,
            executor_id="local",
        )

        result = executor.execute(payload)

        self.assertTrue(result.success)
        self.assertEqual(result.action, "activate_app")
        self.assertEqual(result.raw_result["app"]["name"], "Finder")


if __name__ == "__main__":
    unittest.main()
