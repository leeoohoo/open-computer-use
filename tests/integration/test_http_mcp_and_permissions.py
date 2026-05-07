import os
import unittest

from executor.client.desktop.controller import DesktopController
from server.app.services.mcp_http import HttpMCPService
from server.app.services.orchestrator import LocalComputerUseService
from shared.schemas.desktop import DisplayMetadata, Observation


class PermissionController(DesktopController):
    def _preflight_accessibility_access(self):  # type: ignore[override]
        return True

    def _preflight_screen_capture_access(self):  # type: ignore[override]
        return False

    def _preflight_apple_events_access(self, *, bundle_id="com.apple.systemevents", prompt_if_needed=False):  # type: ignore[override]
        return None


class HttpMCPAndPermissionsTests(unittest.IsolatedAsyncioTestCase):
    async def test_http_mcp_initialize_returns_server_info(self) -> None:
        service = HttpMCPService(local_service=LocalComputerUseService(controller=PermissionController()))

        result = await service.handle_jsonrpc(
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {},
            }
        )

        self.assertEqual(result["jsonrpc"], "2.0")
        self.assertEqual(result["id"], 1)
        self.assertEqual(result["result"]["serverInfo"]["name"], "open-computer-use")

    async def test_http_mcp_tools_list_returns_doctor_tool(self) -> None:
        service = HttpMCPService(local_service=LocalComputerUseService(controller=PermissionController()))

        result = await service.handle_jsonrpc(
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/list",
                "params": {},
            }
        )

        tools = result["result"]["tools"]
        names = {tool["name"] for tool in tools}
        self.assertIn("doctor", names)
        self.assertIn("list_apps", names)

    async def test_http_mcp_tools_call_returns_image_content_block_for_observation(self) -> None:
        class ObserveOnlyLocalService:
            controller = PermissionController()

            def observe_display(self, display_id: str | None = None):
                return Observation(
                    screenshot_base64="ZmFrZQ==",
                    screenshot_mime_type="image/png",
                    image_width=100,
                    image_height=80,
                    display=DisplayMetadata(
                        display_id=display_id or "main",
                        logical_width=100,
                        logical_height=80,
                        physical_width=100,
                        physical_height=80,
                        scale_x=1.0,
                        scale_y=1.0,
                        offset_x=0,
                        offset_y=0,
                    ),
                    captured_display_id=display_id or "main",
                    ocr_blocks=[],
                    detected_elements=[],
                    timestamp=1.0,
                )

        service = HttpMCPService(local_service=ObserveOnlyLocalService())

        result = await service.handle_jsonrpc(
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {"name": "observe", "arguments": {}},
            }
        )

        self.assertEqual(result["jsonrpc"], "2.0")
        self.assertEqual(result["id"], 3)
        self.assertFalse(result["result"]["isError"])

        content = result["result"]["content"]
        self.assertEqual(content[0]["type"], "text")
        self.assertIn('"screenshot_base64": "<base64:8 chars>"', content[0]["text"])
        self.assertNotIn('"screenshot_base64": "ZmFrZQ=="', content[0]["text"])
        self.assertEqual(content[1]["type"], "image")
        self.assertEqual(content[1]["mimeType"], "image/png")
        self.assertEqual(content[1]["data"], "ZmFrZQ==")

    def test_permission_overview_reports_missing_screen_recording(self) -> None:
        controller = PermissionController()
        original_platform = os.sys.platform
        os.sys.platform = "darwin"
        try:
            overview = controller.get_permission_overview()
        finally:
            os.sys.platform = original_platform

        item_by_id = {item.id: item for item in overview.items}
        self.assertIn("screen_recording", item_by_id)
        self.assertIn("apple_events", item_by_id)
        self.assertEqual(item_by_id["screen_recording"].status, "not_granted")
        self.assertEqual(item_by_id["apple_events"].group, "system_permission")
        self.assertEqual(item_by_id["screenshot_tooling"].group, "runtime_capability")
        self.assertIn("screen_recording", overview.missing_permission_ids)

    def test_permission_request_skips_when_nothing_targeted(self) -> None:
        controller = PermissionController()
        response = controller.request_permissions(permission_ids=[], request_missing_only=True)

        self.assertEqual(response.platform, controller.get_permission_overview().platform)
        self.assertIsInstance(response.results, list)


if __name__ == "__main__":
    unittest.main()
