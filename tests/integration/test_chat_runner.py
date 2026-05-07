import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from PIL import Image

from server.app.services.chat_runner import ChatRunner, ModelRequestError
from shared.schemas.chat import ChatMessage, ChatRequest, ModelConfig
from shared.schemas.desktop import CaptureRegion


class DummyLocalService:
    controller = None


class ToolExecutingLocalService:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str | None]] = []

    def list_apps(self, query: str | None = None):
        from shared.schemas.desktop import InstalledAppsResponse

        self.calls.append(("list_apps", query))
        return InstalledAppsResponse(
            apps=[],
            count=0,
            query=query,
            message="ok",
        )


class FilesystemToolLocalService:
    controller = None

    def find_paths(self, payload):
        from shared.schemas.desktop import LocalPathSearchResponse

        return LocalPathSearchResponse(
            query=payload.query,
            roots=payload.roots,
            matches=["/Users/lilei/project"],
            truncated=False,
            message="Found 1 matching paths.",
        )

    def list_directory(self, payload):
        from shared.schemas.desktop import DirectoryEntry, DirectoryListResponse

        return DirectoryListResponse(
            path=payload.path,
            entries=[
                DirectoryEntry(
                    name="open-computer-use",
                    path=f"{payload.path}/open-computer-use",
                    is_dir=True,
                    size=None,
                )
            ],
            truncated=False,
            message="Listed 1 entries.",
        )


class ObserveToolLocalService:
    controller = None
    viewport_clicks: list[dict] = []

    def observe_display(self, display_id: str | None = None):
        from shared.schemas.desktop import DisplayMetadata, Observation, OCRBlock

        return Observation(
            screenshot_base64="ZmFrZQ==",
            screenshot_mime_type="image/png",
            image_width=100,
            image_height=100,
            display=DisplayMetadata(
                display_id=display_id or "main",
                logical_width=100,
                logical_height=100,
                physical_width=100,
                physical_height=100,
                scale_x=1.0,
                scale_y=1.0,
                offset_x=0,
                offset_y=0,
            ),
            captured_display_id=display_id or "main",
            ocr_blocks=[
                OCRBlock(
                    text="飞书",
                    x=10,
                    y=12,
                    width=40,
                    height=20,
                )
            ],
            detected_elements=[],
            timestamp=1.0,
        )

    def observe_region(self, region, display_id: str | None = None):
        result = self.observe_display(display_id=display_id)
        result.capture_scope = "region"
        result.region = region
        return result

    def observe_frontmost_window(
        self,
        app_name: str | None = None,
        bundle_id: str | None = None,
        max_depth: int = 2,
        max_children: int = 20,
    ):
        result = self.observe_display(display_id="main")
        result.capture_scope = "frontmost_window"
        result.region = CaptureRegion(left=10, top=20, width=300, height=200)
        return result

    def click_in_last_observation(self, *, x: float, y: float, button: str = "left", clicks: int = 1):
        self.viewport_clicks.append({"x": x, "y": y, "button": button, "clicks": clicks})
        return {
            "success": True,
            "action": "click_in_viewport",
            "logical_target": {"x": x, "y": y, "display_id": "main"},
            "physical_target": {"x": x, "y": y, "display_id": "main"},
            "message": "Clicked using the last observation viewport.",
        }


class EmptyWindowThenObserveLocalService:
    controller = None

    def __init__(self) -> None:
        self.calls: list[str] = []

    def observe_frontmost_window(
        self,
        app_name: str | None = None,
        bundle_id: str | None = None,
        max_depth: int = 2,
        max_children: int = 20,
    ):
        from shared.schemas.desktop import DisplayMetadata, Observation

        self.calls.append("observe_frontmost_window")
        return Observation(
            screenshot_base64="ZmFrZQ==",
            screenshot_mime_type="image/png",
            image_width=200,
            image_height=120,
            display=DisplayMetadata(
                display_id="main",
                logical_width=200,
                logical_height=120,
                physical_width=200,
                physical_height=120,
                scale_x=1.0,
                scale_y=1.0,
                offset_x=0,
                offset_y=0,
            ),
            captured_display_id="main",
            ocr_blocks=[],
            detected_elements=[],
            capture_scope="frontmost_window",
            timestamp=1.0,
        )

    def observe_display(self, display_id: str | None = None):
        from shared.schemas.desktop import DisplayMetadata, Observation, OCRBlock

        self.calls.append("observe")
        return Observation(
            screenshot_base64="ZmFrZQ==",
            screenshot_mime_type="image/png",
            image_width=200,
            image_height=120,
            display=DisplayMetadata(
                display_id=display_id or "main",
                logical_width=200,
                logical_height=120,
                physical_width=200,
                physical_height=120,
                scale_x=1.0,
                scale_y=1.0,
                offset_x=0,
                offset_y=0,
            ),
            captured_display_id=display_id or "main",
            ocr_blocks=[
                OCRBlock(
                    text="彭雄斌：今晚 8 点前给你回复",
                    x=20,
                    y=30,
                    width=120,
                    height=18,
                )
            ],
            detected_elements=[],
            timestamp=2.0,
        )


class ChatRunnerNormalizationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.runner = ChatRunner(local_service=DummyLocalService())

    def test_chat_request_defaults_to_high_max_steps_for_long_tool_loops(self) -> None:
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="http://127.0.0.1:8089/v1",
                api_key="demo-key",
            )
        )

        self.assertEqual(request.max_steps, 100)
        self.assertFalse(request.enable_ocr)

    def test_normalize_responses_payload_with_text_reply(self) -> None:
        payload = {
            "output": [
                {
                    "type": "message",
                    "content": [
                        {"type": "output_text", "text": "你好"},
                        {"type": "output_text", "text": "世界"},
                    ],
                }
            ]
        }

        result = self.runner._normalize_responses_payload(payload, "http://127.0.0.1:8089/v1/responses")  # noqa: SLF001

        self.assertEqual(result["content"], "你好\n世界")
        self.assertEqual(result["tool_calls"], [])

    def test_normalize_responses_payload_with_function_call(self) -> None:
        payload = {
            "output": [
                {
                    "type": "function_call",
                    "id": "fc_1",
                    "call_id": "call_1",
                    "name": "search_web",
                    "arguments": '{"query":"今天新闻"}',
                }
            ]
        }

        result = self.runner._normalize_responses_payload(payload, "http://127.0.0.1:8089/v1/responses")  # noqa: SLF001

        self.assertEqual(result["content"], "")
        self.assertEqual(len(result["tool_calls"]), 1)
        self.assertEqual(result["tool_calls"][0]["function"]["name"], "search_web")
        self.assertEqual(result["tool_calls"][0]["call_id"], "call_1")

    def test_serialize_responses_input_preserves_tool_roundtrip(self) -> None:
        messages = [
            ChatMessage(role="system", content="system prompt"),
            ChatMessage(role="user", content="open safari"),
            ChatMessage(
                role="assistant",
                content="",
                tool_calls=[
                    {
                        "id": "fc_1",
                        "call_id": "call_1",
                        "type": "function",
                        "function": {"name": "open_url", "arguments": '{"url":"https://example.com"}'},
                    }
                ],
            ),
            ChatMessage(
                role="tool",
                name="open_url",
                tool_call_id="call_1",
                content='{"success":true}',
            ),
        ]

        items = self.runner._serialize_responses_input(messages)  # noqa: SLF001

        self.assertEqual(items[0]["role"], "system")
        self.assertEqual(items[1]["role"], "user")
        self.assertEqual(items[0]["content"][0]["type"], "input_text")
        self.assertEqual(items[1]["content"][0]["type"], "input_text")
        self.assertEqual(items[2]["type"], "function_call")
        self.assertEqual(items[2]["call_id"], "call_1")
        self.assertEqual(items[3]["type"], "function_call_output")
        self.assertEqual(items[3]["call_id"], "call_1")

    def test_serialize_responses_input_includes_tool_images(self) -> None:
        messages = [
            ChatMessage(role="user", content="看看当前屏幕"),
            ChatMessage(
                role="tool",
                name="observe",
                tool_call_id="call_obs_1",
                content='{"message":"Captured observation."}',
                content_parts=[
                    {"type": "input_text", "text": '{"message":"Captured observation."}'},
                    {
                        "type": "input_image",
                        "image_url": "data:image/png;base64,ZmFrZQ==",
                        "detail": "high",
                    },
                ],
            ),
        ]

        items = self.runner._serialize_responses_input(messages)  # noqa: SLF001

        self.assertEqual(items[1]["type"], "function_call_output")
        self.assertIsInstance(items[1]["output"], list)
        self.assertEqual(items[1]["output"][0]["type"], "input_text")
        self.assertEqual(items[1]["output"][1]["type"], "input_image")
        self.assertEqual(items[1]["output"][1]["image_url"], "data:image/png;base64,ZmFrZQ==")

    async def test_dispatch_tool_supports_observe_display(self) -> None:
        runner = ChatRunner(local_service=ObserveToolLocalService())

        result = await runner._dispatch_tool("observe_display", {"display_id": "display-2"})  # noqa: SLF001

        self.assertEqual(result["captured_display_id"], "display-2")
        self.assertEqual(result["display"]["display_id"], "display-2")

    async def test_dispatch_tool_supports_observe_region(self) -> None:
        runner = ChatRunner(local_service=ObserveToolLocalService())

        result = await runner._dispatch_tool(  # noqa: SLF001
            "observe_region",
            {
                "left": 10,
                "top": 20,
                "width": 30,
                "height": 40,
                "display_id": "display-1",
            },
        )

        self.assertEqual(result["capture_scope"], "region")
        self.assertEqual(result["captured_display_id"], "display-1")
        self.assertEqual(result["region"]["left"], 10)

    async def test_dispatch_tool_supports_observe_frontmost_window(self) -> None:
        runner = ChatRunner(local_service=ObserveToolLocalService())

        result = await runner._dispatch_tool(  # noqa: SLF001
            "observe_frontmost_window",
            {"app_name": "Safari"},
        )

        self.assertEqual(result["capture_scope"], "frontmost_window")

    async def test_dispatch_tool_supports_click_in_viewport(self) -> None:
        local_service = ObserveToolLocalService()
        runner = ChatRunner(local_service=local_service)

        result = await runner._dispatch_tool(  # noqa: SLF001
            "click_in_viewport",
            {"x": 12, "y": 18, "button": "left", "clicks": 1},
        )

        self.assertEqual(result["action"], "click_in_viewport")
        self.assertEqual(local_service.viewport_clicks[0]["x"], 12)

    def test_tool_result_to_message_content_redacts_top_level_screenshot_text_but_keeps_image_part(
        self,
    ) -> None:
        result = {
            "screenshot_base64": "ZmFrZQ==",
            "screenshot_mime_type": "image/png",
            "display": {"display_id": "main"},
            "ocr_blocks": [],
            "detected_elements": [],
            "timestamp": 1.0,
        }

        text_payload, parts = self.runner._tool_result_to_message_content(result)  # noqa: SLF001

        self.assertIn('"screenshot_base64": "<base64:8 chars>"', text_payload)
        self.assertNotIn('"screenshot_base64": "ZmFrZQ=="', text_payload)
        self.assertEqual(parts[1]["type"], "input_image")
        self.assertEqual(parts[1]["image_url"], "data:image/png;base64,ZmFrZQ==")

    def test_sanitize_tool_result_redacts_top_level_preview_image_base64(self) -> None:
        result = {
            "message": "preview ready",
            "preview_image_base64": "ZmFrZQ==",
            "preview_image_mime_type": "image/png",
        }

        sanitized = self.runner._sanitize_tool_result(result)  # noqa: SLF001

        self.assertEqual(sanitized["preview_image_base64"], "<base64:8 chars>")

    def test_compress_image_for_model_returns_data_url(self) -> None:
        image = Image.new("RGB", (2000, 1200), (255, 255, 255))
        for x in range(0, 2000, 20):
            for y in range(0, 1200, 20):
                image.putpixel((x, y), (x % 255, y % 255, (x + y) % 255))

        import base64
        import io

        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        encoded = base64.b64encode(buffer.getvalue()).decode("ascii")

        with patch.dict(
            "os.environ",
            {
                "CUA_MODEL_IMAGE_MAX_EDGE": "1200",
                "CUA_MODEL_IMAGE_MAX_BYTES": "120000",
            },
            clear=False,
        ):
            data_url = self.runner._compress_image_for_model(encoded, "image/png")  # noqa: SLF001

        self.assertIsNotNone(data_url)
        assert data_url is not None
        self.assertTrue(data_url.startswith("data:image/"))
        self.assertLess(len(data_url), 200000)

    def test_extract_image_data_urls_limits_image_count(self) -> None:
        with patch.dict("os.environ", {"CUA_MODEL_MAX_IMAGES_PER_TOOL_RESULT": "1"}, clear=False):
            result = {
                "preview_image_base64": "ZmFrZQ==",
                "preview_image_mime_type": "image/png",
                "observation": {
                    "screenshot_base64": "ZmFrZQ==",
                    "screenshot_mime_type": "image/png",
                },
            }

            urls = self.runner._extract_image_data_urls_from_tool_result(result)  # noqa: SLF001

        self.assertEqual(len(urls), 1)

    def test_apply_runtime_image_limits_updates_environment(self) -> None:
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="https://relay.nf.video/v1",
                api_key="demo-key",
            ),
        )
        request.config = request.config.model_copy(
            update={
                "max_images_per_tool_result": 2,
                "model_image_max_edge": 1280,
                "model_image_max_bytes": 240000,
            }
        )

        self.runner._apply_runtime_image_limits(request)  # noqa: SLF001

        self.assertEqual(__import__("os").environ["CUA_MODEL_MAX_IMAGES_PER_TOOL_RESULT"], "2")
        self.assertEqual(__import__("os").environ["CUA_MODEL_IMAGE_MAX_EDGE"], "1280")
        self.assertEqual(__import__("os").environ["CUA_MODEL_IMAGE_MAX_BYTES"], "240000")

    async def test_run_tool_trace_contains_preview_images(self) -> None:
        runner = ChatRunner(local_service=ObserveToolLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="http://127.0.0.1:8089/v1",
                api_key="demo-key",
                api_mode="responses",
            ),
            messages=[ChatMessage(role="user", content="看一下屏幕")],
            max_steps=2,
        )

        async def fake_call(payload, messages, tool_choice="auto", **kwargs):
            if len(messages) <= 3:
                return {
                    "content": "",
                    "tool_calls": [
                        {
                            "id": "fc_obs",
                            "call_id": "call_obs",
                            "type": "function",
                            "function": {"name": "observe_display", "arguments": '{"display_id":"main"}'},
                        }
                    ],
                    "api_mode_used": "responses",
                }
            return {
                "content": "观察完成",
                "tool_calls": [],
                "api_mode_used": "responses",
            }

        runner._call_model = fake_call  # type: ignore[method-assign]  # noqa: SLF001

        result = await runner.run(request)

        self.assertEqual(result.reply, "观察完成")
        self.assertEqual(len(result.tool_trace), 1)
        self.assertTrue(result.tool_trace[0].preview_images)
        self.assertTrue(result.tool_trace[0].preview_images[0].startswith("data:image/"))

    async def test_run_with_events_emits_tool_started_and_completed(self) -> None:
        runner = ChatRunner(local_service=ObserveToolLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="http://127.0.0.1:8089/v1",
                api_key="demo-key",
                api_mode="responses",
            ),
            messages=[ChatMessage(role="user", content="看一下屏幕")],
            max_steps=2,
        )

        async def fake_call(payload, messages, tool_choice="auto", **kwargs):
            if len(messages) <= 3:
                return {
                    "content": "",
                    "tool_calls": [
                        {
                            "id": "fc_obs",
                            "call_id": "call_obs",
                            "type": "function",
                            "function": {"name": "observe_display", "arguments": '{"display_id":"main"}'},
                        }
                    ],
                    "api_mode_used": "responses",
                }
            return {
                "content": "观察完成",
                "tool_calls": [],
                "api_mode_used": "responses",
            }

        runner._call_model = fake_call  # type: ignore[method-assign]  # noqa: SLF001

        events: list[dict] = []

        def collect(event: dict) -> None:
            events.append(event)

        result = await runner.run_with_events(request, event_callback=collect)

        event_types = [event["type"] for event in events]
        self.assertIn("tool_started", event_types)
        self.assertIn("tool_completed", event_types)
        self.assertEqual(event_types[-1], "run_finished")

        tool_started = next(event for event in events if event["type"] == "tool_started")
        tool_completed = next(event for event in events if event["type"] == "tool_completed")
        self.assertEqual(tool_started["tool"]["id"], "call_obs")
        self.assertEqual(tool_started["tool"]["status"], "pending")
        self.assertEqual(tool_started["tool"]["step_index"], 0)
        self.assertIsNotNone(tool_started["tool"]["started_at"])
        self.assertEqual(tool_completed["tool"]["id"], "call_obs")
        self.assertEqual(tool_completed["tool"]["status"], "success")
        self.assertEqual(tool_completed["tool"]["step_index"], 0)
        self.assertIsInstance(tool_completed["tool"]["duration_ms"], int)
        self.assertEqual(result.tool_trace[0].id, "call_obs")
        self.assertEqual(result.tool_trace[0].status, "success")
        self.assertEqual(result.tool_trace[0].step_index, 0)
        self.assertIsInstance(result.tool_trace[0].duration_ms, int)

    def test_serialize_responses_input_uses_output_text_for_assistant_history(self) -> None:
        messages = [
            ChatMessage(role="system", content="system prompt"),
            ChatMessage(role="user", content="你好"),
            ChatMessage(role="assistant", content="你好！我在这儿～需要我帮你做什么？"),
            ChatMessage(role="user", content="帮我看看 project 这个文件夹有什么"),
        ]

        items = self.runner._serialize_responses_input(messages)  # noqa: SLF001

        self.assertEqual(items[2]["role"], "assistant")
        self.assertEqual(items[2]["content"][0]["type"], "output_text")
        self.assertEqual(items[2]["content"][0]["text"], "你好！我在这儿～需要我帮你做什么？")

    def test_serialize_chat_completion_message_preserves_tool_content_parts(self) -> None:
        message = ChatMessage(
            role="tool",
            name="observe",
            tool_call_id="call_obs_1",
            content='{"message":"Captured observation."}',
            content_parts=[
                {"type": "input_text", "text": '{"message":"Captured observation."}'},
                {
                    "type": "input_image",
                    "image_url": "data:image/png;base64,ZmFrZQ==",
                    "detail": "high",
                },
            ],
        )

        item = self.runner._serialize_chat_completion_message(message)  # noqa: SLF001

        self.assertEqual(item["role"], "tool")
        self.assertEqual(item["tool_call_id"], "call_obs_1")
        self.assertEqual(item["content"][0]["type"], "text")
        self.assertEqual(item["content"][1]["type"], "image_url")
        self.assertEqual(item["content"][1]["image_url"]["url"], "data:image/png;base64,ZmFrZQ==")

    def test_coerce_http_error_payload_accepts_responses_body(self) -> None:
        payload = {
            "id": "resp_123",
            "object": "response",
            "status": "failed",
            "output": [
                {
                    "type": "message",
                    "content": [{"type": "output_text", "text": "我会先检查 Finder"}],
                }
            ],
        }

        result = self.runner._coerce_http_error_payload(  # noqa: SLF001
            api_mode="responses",
            body='{"id":"resp_123","object":"response","status":"failed","output":[{"type":"message","content":[{"type":"output_text","text":"我会先检查 Finder"}]}]}',
        )

        self.assertEqual(result, payload)

    def test_should_force_tool_retry_for_planning_text(self) -> None:
        messages = [ChatMessage(role="user", content="帮我看看 Finder 里的 project 文件夹里有什么")]

        result = self.runner._should_force_tool_retry(  # noqa: SLF001
            messages=messages,
            content="我会直接用桌面控制工具检查 Finder，定位到 project 文件夹并读取可见内容。",
            forced_tool_retry_used=False,
        )

        self.assertTrue(result)

    def test_should_force_tool_retry_when_model_asks_user_for_path_instead_of_using_tools(self) -> None:
        messages = [ChatMessage(role="user", content="帮我看看 project 这个文件夹有什么")]

        result = self.runner._should_force_tool_retry(  # noqa: SLF001
            messages=messages,
            content="你可以先告诉我 project 文件夹的完整路径，如果不确定路径我也可以先在常见位置帮你搜索。",
            forced_tool_retry_used=False,
        )

        self.assertTrue(result)

    def test_select_tool_choice_requires_tools_for_active_desktop_task(self) -> None:
        messages = [
            ChatMessage(role="user", content="帮我打开飞书"),
            ChatMessage(
                role="assistant",
                content="",
                tool_calls=[
                    {
                        "id": "fc_1",
                        "call_id": "call_1",
                        "type": "function",
                        "function": {"name": "launch_app", "arguments": '{"app_name":"Lark"}'},
                    }
                ],
            ),
            ChatMessage(role="tool", name="launch_app", tool_call_id="call_1", content='{"ok":true}'),
            ChatMessage(role="user", content="你自己切过去么"),
        ]

        result = self.runner._select_tool_choice(messages)  # noqa: SLF001

        self.assertEqual(result, "required")

    def test_coerce_chat_completions_tool_choice_downgrades_required_for_kimi_thinking_enabled(self) -> None:
        result = self.runner._coerce_chat_completions_tool_choice(  # noqa: SLF001
            base_url="https://api.moonshot.cn/v1",
            model="kimi-k2.6",
            requested_tool_choice="required",
            thinking_mode="enabled",
        )

        self.assertEqual(result, "auto")

    def test_coerce_chat_completions_tool_choice_keeps_required_when_thinking_not_enabled(self) -> None:
        result = self.runner._coerce_chat_completions_tool_choice(  # noqa: SLF001
            base_url="https://api.moonshot.cn/v1",
            model="kimi-k2.6",
            requested_tool_choice="required",
            thinking_mode="auto",
        )

        self.assertEqual(result, "required")

    def test_append_debug_log_writes_jsonl_record(self) -> None:
        with TemporaryDirectory() as tmpdir:
            log_path = Path(tmpdir) / "open-computer-use-chat-runner-test.log"
            runner = ChatRunner(local_service=DummyLocalService())
            runner._chat_debug_log_path = log_path  # type: ignore[attr-defined]  # noqa: SLF001
            runner._append_debug_log({"event": "unit_test", "ok": True})  # noqa: SLF001

            text = log_path.read_text(encoding="utf-8")
            self.assertIn('"event": "unit_test"', text)
            self.assertIn('"ok": true', text)

    def test_append_event_log_writes_jsonl_record(self) -> None:
        with TemporaryDirectory() as tmpdir:
            log_path = Path(tmpdir) / "open-computer-use-chat-events-test.log"
            runner = ChatRunner(local_service=DummyLocalService())
            runner._chat_event_log_path = log_path  # type: ignore[attr-defined]  # noqa: SLF001
            runner._append_event_log({"type": "tool_started", "request_id": "demo"})  # noqa: SLF001

            text = log_path.read_text(encoding="utf-8")
            self.assertIn('"type": "tool_started"', text)
            self.assertIn('"request_id": "demo"', text)

    def test_build_openai_client_options(self) -> None:
        options = self.runner._build_openai_client_options(  # noqa: SLF001
            api_key="demo-key",
            base_url="https://relay.nf.video/v1",
        )

        self.assertEqual(
            options,
            {
                "api_key": "demo-key",
                "base_url": "https://relay.nf.video/v1",
                "timeout": 60.0,
                "max_retries": 0,
            },
        )

    def test_redact_client_options_hides_api_key(self) -> None:
        redacted = self.runner._redact_client_options(  # noqa: SLF001
            {
                "api_key": "demo-key",
                "base_url": "https://relay.nf.video/v1",
                "timeout": 60.0,
                "max_retries": 0,
            }
        )

        self.assertEqual(redacted["api_key"], "***")
        self.assertEqual(redacted["base_url"], "https://relay.nf.video/v1")

    def test_coerce_sdk_error_payload_accepts_responses_body(self) -> None:
        payload = {
            "id": "resp_123",
            "object": "response",
            "status": "failed",
            "output": [],
        }

        result = self.runner._coerce_sdk_error_payload("responses", payload)  # noqa: SLF001

        self.assertEqual(result, payload)

    async def test_dispatch_tool_find_paths(self) -> None:
        runner = ChatRunner(local_service=FilesystemToolLocalService())

        result = await runner._dispatch_tool(  # noqa: SLF001
            "find_paths",
            {
                "query": "project",
                "roots": ["/Users/lilei"],
                "max_results": 10,
                "directories_only": True,
                "case_sensitive": False,
            },
        )

        self.assertEqual(result["query"], "project")
        self.assertEqual(result["matches"], ["/Users/lilei/project"])

    async def test_dispatch_tool_list_directory(self) -> None:
        runner = ChatRunner(local_service=FilesystemToolLocalService())

        result = await runner._dispatch_tool(  # noqa: SLF001
            "list_directory",
            {
                "path": "/Users/lilei/project",
                "include_hidden": False,
                "max_entries": 50,
            },
        )

        self.assertEqual(result["path"], "/Users/lilei/project")
        self.assertEqual(len(result["entries"]), 1)
        self.assertEqual(result["entries"][0]["name"], "open-computer-use")

    def test_build_chat_completion_tools_includes_filesystem_fallback_tools(self) -> None:
        names = [
            item["function"]["name"]
            for item in self.runner._build_chat_completion_tools()  # noqa: SLF001
        ]

        self.assertIn("finish", names)
        self.assertIn("find_paths", names)
        self.assertIn("list_directory", names)

    def test_build_chat_completion_tools_includes_generic_desktop_tools(self) -> None:
        names = [
            item["function"]["name"]
            for item in self.runner._build_chat_completion_tools()  # noqa: SLF001
        ]

        self.assertIn("observe", names)
        self.assertIn("click_at", names)
        self.assertIn("click_in_viewport", names)
        self.assertIn("type_text", names)
        self.assertIn("press_key", names)
        self.assertIn("hotkey", names)
        self.assertIn("scroll", names)

    async def test_dispatch_tool_observe_redacts_large_base64_in_result(self) -> None:
        runner = ChatRunner(local_service=ObserveToolLocalService())

        result = await runner._dispatch_tool("observe", {})  # noqa: SLF001

        self.assertEqual(result["ocr_blocks"][0]["text"], "飞书")
        self.assertEqual(result["screenshot_base64"], "ZmFrZQ==")

    async def test_request_model_api_uses_openai_sdk_for_responses(self) -> None:
        captured = {}
        runner = ChatRunner(local_service=DummyLocalService())

        class FakeResponse:
            def model_dump(self, mode="json"):
                captured["dump_mode"] = mode
                return {"output": []}

        class FakeResponses:
            async def create(self, **kwargs):
                captured["request_body"] = kwargs
                return FakeResponse()

        class FakeChatCompletions:
            async def create(self, **kwargs):
                captured["chat_request_body"] = kwargs
                return FakeResponse()

        class FakeChat:
            def __init__(self):
                self.completions = FakeChatCompletions()

        class FakeAsyncOpenAI:
            def __init__(self, **kwargs):
                captured["client_options"] = kwargs
                self.responses = FakeResponses()
                self.chat = FakeChat()

            async def close(self):
                captured["closed"] = True

        with patch("server.app.services.chat_runner.AsyncOpenAI", FakeAsyncOpenAI):
            result = await runner._request_model_api(  # noqa: SLF001
                base_url="https://relay.nf.video/v1",
                url="https://relay.nf.video/v1/responses",
                request_body={"model": "demo-model", "input": "hi"},
                api_key="demo-key",
                api_mode="responses",
            )

        self.assertEqual(result, {"output": []})
        self.assertEqual(
            captured["client_options"],
            {
                "api_key": "demo-key",
                "base_url": "https://relay.nf.video/v1",
                "timeout": 60.0,
                "max_retries": 0,
            },
        )
        self.assertEqual(captured["request_body"], {"model": "demo-model", "input": "hi"})
        self.assertEqual(captured["dump_mode"], "json")
        self.assertTrue(captured["closed"])

    async def test_call_responses_api_includes_reasoning_effort(self) -> None:
        runner = ChatRunner(local_service=DummyLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="https://relay.nf.video/v1",
                api_key="demo-key",
                api_mode="responses",
                reasoning_effort="high",
            ),
            messages=[ChatMessage(role="user", content="hi")],
        )
        captured = {}

        async def fake_request_model_api(**kwargs):
            captured["request_body"] = kwargs["request_body"]
            return {"output": []}

        with patch.object(runner, "_request_model_api", side_effect=fake_request_model_api):  # noqa: SLF001
            await runner._call_responses_api(request, request.messages, "auto")  # noqa: SLF001

        self.assertEqual(captured["request_body"]["reasoning"], {"effort": "high"})

    async def test_call_chat_completions_api_includes_reasoning_effort(self) -> None:
        runner = ChatRunner(local_service=DummyLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="https://relay.nf.video/v1",
                api_key="demo-key",
                api_mode="chat_completions",
                reasoning_effort="low",
            ),
            messages=[ChatMessage(role="user", content="hi")],
        )
        captured = {}

        async def fake_request_model_api(**kwargs):
            captured["request_body"] = kwargs["request_body"]
            return {"choices": [{"message": {"content": "ok"}}]}

        with patch.object(runner, "_request_model_api", side_effect=fake_request_model_api):  # noqa: SLF001
            await runner._call_chat_completions_api(request, request.messages, "auto")  # noqa: SLF001

        self.assertEqual(captured["request_body"]["reasoning_effort"], "low")

    async def test_call_chat_completions_api_omits_reasoning_for_moonshot_when_tool_choice_required(self) -> None:
        runner = ChatRunner(local_service=DummyLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="kimi-k2.6",
                base_url="https://api.moonshot.cn/v1",
                api_key="demo-key",
                api_mode="chat_completions",
                thinking_mode="auto",
                reasoning_effort="high",
            ),
            messages=[ChatMessage(role="user", content="hi")],
        )
        captured = {}

        async def fake_request_model_api(**kwargs):
            captured["request_body"] = kwargs["request_body"]
            return {"choices": [{"message": {"content": "ok"}}]}

        with patch.object(runner, "_request_model_api", side_effect=fake_request_model_api):  # noqa: SLF001
            await runner._call_chat_completions_api(request, request.messages, "required")  # noqa: SLF001

        self.assertNotIn("reasoning_effort", captured["request_body"])
        self.assertEqual(captured["request_body"]["extra_body"]["thinking"], {"type": "disabled"})

    async def test_call_chat_completions_api_keeps_thinking_enabled_for_non_required_tool_choice(self) -> None:
        runner = ChatRunner(local_service=DummyLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="kimi-k2.6",
                base_url="https://api.moonshot.cn/v1",
                api_key="demo-key",
                api_mode="chat_completions",
                thinking_mode="auto",
                reasoning_effort="high",
            ),
            messages=[ChatMessage(role="user", content="hi")],
        )
        captured = {}

        async def fake_request_model_api(**kwargs):
            captured["request_body"] = kwargs["request_body"]
            return {"choices": [{"message": {"content": "ok"}}]}

        with patch.object(runner, "_request_model_api", side_effect=fake_request_model_api):  # noqa: SLF001
            await runner._call_chat_completions_api(request, request.messages, "auto")  # noqa: SLF001

        self.assertNotIn("thinking", captured["request_body"])
        self.assertIn("reasoning_effort", captured["request_body"])

    async def test_call_chat_completions_api_respects_explicit_thinking_enabled(self) -> None:
        runner = ChatRunner(local_service=DummyLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="kimi-k2.6",
                base_url="https://api.moonshot.cn/v1",
                api_key="demo-key",
                api_mode="chat_completions",
                thinking_mode="enabled",
                reasoning_effort="high",
            ),
            messages=[ChatMessage(role="user", content="hi")],
        )
        captured = {}

        async def fake_request_model_api(**kwargs):
            captured["request_body"] = kwargs["request_body"]
            return {"choices": [{"message": {"content": "ok"}}]}

        with patch.object(runner, "_request_model_api", side_effect=fake_request_model_api):  # noqa: SLF001
            await runner._call_chat_completions_api(request, request.messages, "required")  # noqa: SLF001

        self.assertEqual(captured["request_body"]["extra_body"]["thinking"], {"type": "enabled"})
        self.assertEqual(captured["request_body"]["tool_choice"], "auto")
        self.assertEqual(captured["request_body"]["reasoning_effort"], "high")

    async def test_call_chat_completions_api_respects_explicit_thinking_disabled(self) -> None:
        runner = ChatRunner(local_service=DummyLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="https://relay.nf.video/v1",
                api_key="demo-key",
                api_mode="chat_completions",
                thinking_mode="disabled",
                reasoning_effort="medium",
            ),
            messages=[ChatMessage(role="user", content="hi")],
        )
        captured = {}

        async def fake_request_model_api(**kwargs):
            captured["request_body"] = kwargs["request_body"]
            return {"choices": [{"message": {"content": "ok"}}]}

        with patch.object(runner, "_request_model_api", side_effect=fake_request_model_api):  # noqa: SLF001
            await runner._call_chat_completions_api(request, request.messages, "auto")  # noqa: SLF001

        self.assertEqual(captured["request_body"]["extra_body"]["thinking"], {"type": "disabled"})
        self.assertEqual(captured["request_body"]["reasoning_effort"], "medium")

    def test_serialize_chat_completion_message_includes_reasoning_content(self) -> None:
        message = ChatMessage(
            role="assistant",
            content="我先看看。",
            reasoning_content="先分析窗口结构，再决定是否调用工具。",
            tool_calls=[],
        )

        item = self.runner._serialize_chat_completion_message(message)  # noqa: SLF001

        self.assertEqual(item["reasoning_content"], "先分析窗口结构，再决定是否调用工具。")

    def test_normalize_chat_completion_payload_extracts_reasoning_content(self) -> None:
        payload = {
            "choices": [
                {
                    "message": {
                        "content": "我先看看。",
                        "reasoning_content": "先分析一下当前界面。",
                        "tool_calls": [],
                    }
                }
            ]
        }

        result = self.runner._normalize_chat_completion_payload(  # noqa: SLF001
            payload,
            "https://api.moonshot.cn/v1/chat/completions",
        )

        self.assertEqual(result["reasoning_content"], "先分析一下当前界面。")


class ChatRunnerModeSelectionTests(unittest.IsolatedAsyncioTestCase):
    async def test_auto_mode_falls_back_to_chat_completions(self) -> None:
        runner = ChatRunner(local_service=DummyLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="http://127.0.0.1:8089/v1",
                api_key="demo-key",
                api_mode="auto",
            ),
            messages=[ChatMessage(role="user", content="hi")],
        )
        calls = []

        async def fake_call_once(payload, messages, api_mode, tool_choice, **kwargs):
            calls.append(api_mode)
            if api_mode == "responses":
                from server.app.services.chat_runner import ModelRequestError

                raise ModelRequestError(
                    api_mode="responses",
                    url="http://127.0.0.1:8089/v1/responses",
                    message="404",
                    status_code=404,
                    retryable_in_auto=True,
                )
            return {"content": "fallback ok", "tool_calls": []}

        runner._call_model_once = fake_call_once  # type: ignore[method-assign]  # noqa: SLF001

        result = await runner.run(request)

        self.assertEqual(calls, ["responses", "chat_completions"])
        self.assertEqual(result.reply, "fallback ok")
        self.assertEqual(result.api_mode_used, "chat_completions")

    async def test_run_retries_once_when_model_only_describes_tool_intent(self) -> None:
        runner = ChatRunner(local_service=DummyLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="http://127.0.0.1:8089/v1",
                api_key="demo-key",
                api_mode="responses",
            ),
            messages=[ChatMessage(role="user", content="帮我看看 Finder 里 project 文件夹里有什么")],
            max_steps=4,
        )
        calls = []

        async def fake_call(payload, messages, tool_choice="auto", **kwargs):
            calls.append({"roles": [message.role for message in messages], "tool_choice": tool_choice})
            if len(calls) == 1:
                return {
                    "content": "我会直接用桌面控制工具检查 Finder。",
                    "tool_calls": [],
                    "api_mode_used": "responses",
                }
            return {
                "content": "检查完成",
                "tool_calls": [],
                "api_mode_used": "responses",
            }

        runner._call_model = fake_call  # type: ignore[method-assign]  # noqa: SLF001

        result = await runner.run(request)

        self.assertEqual(result.reply, "检查完成")
        self.assertEqual(len(calls), 2)
        self.assertIn("system", calls[1]["roles"])
        self.assertEqual(calls[1]["tool_choice"], "required")

    async def test_run_executes_tool_calls_returned_by_forced_retry(self) -> None:
        local_service = ToolExecutingLocalService()
        runner = ChatRunner(local_service=local_service)
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="http://127.0.0.1:8089/v1",
                api_key="demo-key",
                api_mode="responses",
            ),
            messages=[ChatMessage(role="user", content="帮我看一下 Finder")],
            max_steps=4,
        )
        calls = []

        async def fake_call(payload, messages, tool_choice="auto", **kwargs):
            calls.append(tool_choice)
            if len(calls) == 1:
                return {
                    "content": "我先看看 Finder。",
                    "tool_calls": [],
                    "api_mode_used": "responses",
                }
            if len(calls) == 2:
                return {
                    "content": "",
                    "tool_calls": [
                        {
                            "id": "fc_1",
                            "call_id": "call_1",
                            "type": "function",
                            "function": {"name": "list_apps", "arguments": '{"query":"Finder"}'},
                        }
                    ],
                    "api_mode_used": "responses",
                }
            return {
                "content": "检查完成",
                "tool_calls": [],
                "api_mode_used": "responses",
            }

        runner._call_model = fake_call  # type: ignore[method-assign]  # noqa: SLF001

        result = await runner.run(request)

        self.assertEqual(calls, ["required", "required", "required"])
        self.assertEqual(local_service.calls, [("list_apps", "Finder")])
        self.assertEqual(len(result.tool_trace), 1)
        self.assertEqual(result.tool_trace[0].name, "list_apps")
        self.assertEqual(result.reply, "检查完成")

    async def test_run_triggers_visual_retry_when_accessibility_is_empty(self) -> None:
        runner = ChatRunner(local_service=DummyLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="http://127.0.0.1:8089/v1",
                api_key="demo-key",
                api_mode="responses",
            ),
            messages=[ChatMessage(role="user", content="帮我打开飞书 看看彭雄斌说了什么")],
            max_steps=4,
        )
        calls = []

        async def fake_call(payload, messages, tool_choice="auto", **kwargs):
            calls.append(
                {
                    "tool_choice": tool_choice,
                    "last_system": next((message.content for message in reversed(messages) if message.role == "system"), None),
                }
            )
            if len(calls) == 1:
                return {
                    "content": "我这边已经把飞书切到前台了，但系统仍然抓不到飞书窗口的可访问性树（返回是空窗口）。",
                    "tool_calls": [],
                    "api_mode_used": "responses",
                }
            return {
                "content": "还是不行",
                "tool_calls": [],
                "api_mode_used": "responses",
            }

        runner._call_model = fake_call  # type: ignore[method-assign]  # noqa: SLF001

        result = await runner.run(request)

        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[1]["tool_choice"], "required")
        self.assertIn("observe", calls[1]["last_system"])
        self.assertEqual(result.reply, "还是不行")

    async def test_run_retries_when_responses_payload_reports_disallowed_external_tool_use(self) -> None:
        local_service = ToolExecutingLocalService()
        runner = ChatRunner(local_service=local_service)
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="http://127.0.0.1:8089/v1",
                api_key="demo-key",
                api_mode="responses",
            ),
            messages=[ChatMessage(role="user", content="帮我看看我project 这个文件夹有啥")],
            max_steps=4,
        )
        calls = []

        async def fake_call(payload, messages, tool_choice="auto", **kwargs):
            calls.append(
                {
                    "tool_choice": tool_choice,
                    "roles": [message.role for message in messages],
                    "last_system": next((message.content for message in reversed(messages) if message.role == "system"), None),
                }
            )
            if len(calls) == 1:
                return {
                    "content": "我先直接用桌面自动化打开 Finder。",
                    "tool_calls": [],
                    "api_mode_used": "responses",
                    "response_error": {
                        "message": "Codex 尝试调用未在本次请求中声明的 MCP 服务：computer-use",
                        "codex_error_info": {"gateway_error": "disallowed_tool_use"},
                    },
                }
            if len(calls) == 2:
                return {
                    "content": "",
                    "tool_calls": [
                        {
                            "id": "fc_2",
                            "call_id": "call_2",
                            "type": "function",
                            "function": {"name": "list_apps", "arguments": '{"query":"Finder"}'},
                        }
                    ],
                    "api_mode_used": "responses",
                    "response_error": None,
                }
            return {
                "content": "检查完成",
                "tool_calls": [],
                "api_mode_used": "responses",
                "response_error": None,
            }

        runner._call_model = fake_call  # type: ignore[method-assign]  # noqa: SLF001

        result = await runner.run(request)

        self.assertEqual(len(calls), 3)
        self.assertEqual(calls[1]["tool_choice"], "required")
        self.assertIn("Use only the function tools declared in this API request.", calls[1]["last_system"])
        self.assertEqual(local_service.calls, [("list_apps", "Finder")])
        self.assertEqual(len(result.tool_trace), 1)
        self.assertEqual(result.reply, "检查完成")

    async def test_run_forces_retry_when_model_requests_path_hint_instead_of_tools(self) -> None:
        runner = ChatRunner(local_service=FilesystemToolLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="http://127.0.0.1:8089/v1",
                api_key="demo-key",
                api_mode="responses",
            ),
            messages=[ChatMessage(role="user", content="帮我看看 project 这个文件夹有什么")],
            max_steps=4,
        )
        calls = []

        async def fake_call(payload, messages, tool_choice="auto", **kwargs):
            calls.append(tool_choice)
            if len(calls) == 1:
                return {
                    "content": "你可以先告诉我 project 文件夹的完整路径，如果不确定路径我也可以先在常见位置帮你搜索。",
                    "tool_calls": [],
                    "api_mode_used": "responses",
                }
            if len(calls) == 2:
                return {
                    "content": "",
                    "tool_calls": [
                        {
                            "id": "fc_find",
                            "call_id": "call_find",
                            "type": "function",
                            "function": {"name": "find_paths", "arguments": '{"query":"project"}'},
                        }
                    ],
                    "api_mode_used": "responses",
                }
            return {
                "content": "我找到路径了。",
                "tool_calls": [],
                "api_mode_used": "responses",
            }

        runner._call_model = fake_call  # type: ignore[method-assign]  # noqa: SLF001

        result = await runner.run(request)

        self.assertEqual(calls, ["required", "required", "required"])
        self.assertEqual(len(result.tool_trace), 1)
        self.assertEqual(result.tool_trace[0].name, "find_paths")
        self.assertEqual(result.reply, "我找到路径了。")

    async def test_run_finishes_when_model_calls_finish_tool(self) -> None:
        runner = ChatRunner(local_service=DummyLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="http://127.0.0.1:8089/v1",
                api_key="demo-key",
                api_mode="responses",
            ),
            messages=[ChatMessage(role="user", content="帮我打开 Safari 然后告诉我结果")],
            max_steps=4,
        )
        calls = []

        async def fake_call(payload, messages, tool_choice="auto", **kwargs):
            calls.append(tool_choice)
            return {
                "content": "",
                "tool_calls": [
                    {
                        "id": "fc_finish",
                        "call_id": "call_finish",
                        "type": "function",
                        "function": {
                            "name": "finish",
                            "arguments": '{"message":"Safari 已经打开。","outcome":"completed"}',
                        },
                    }
                ],
                "api_mode_used": "responses",
            }

        runner._call_model = fake_call  # type: ignore[method-assign]  # noqa: SLF001

        result = await runner.run(request)

        self.assertEqual(calls, ["required"])
        self.assertEqual(result.reply, "Safari 已经打开。")
        self.assertEqual(len(result.tool_trace), 1)
        self.assertEqual(result.tool_trace[0].name, "finish")

    async def test_run_uses_programmatic_filesystem_fallback_when_model_returns_empty_reply(self) -> None:
        runner = ChatRunner(local_service=FilesystemToolLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="http://127.0.0.1:8089/v1",
                api_key="demo-key",
                api_mode="responses",
            ),
            messages=[ChatMessage(role="user", content="帮我看看 project 这个文件夹有什么")],
            max_steps=4,
        )

        async def fake_call(payload, messages, tool_choice="auto", **kwargs):
            return {
                "content": "",
                "tool_calls": [],
                "api_mode_used": "responses",
            }

        runner._call_model = fake_call  # type: ignore[method-assign]  # noqa: SLF001

        result = await runner.run(request)

        self.assertEqual(result.api_mode_used, "programmatic")
        self.assertEqual(result.model, "demo-model")
        self.assertEqual([item.name for item in result.tool_trace], ["find_paths", "list_directory"])
        self.assertIn("/Users/lilei/project", result.reply)
        self.assertIn("open-computer-use/", result.reply)

    async def test_programmatic_filesystem_fallback_emits_tool_events(self) -> None:
        runner = ChatRunner(local_service=FilesystemToolLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="http://127.0.0.1:8089/v1",
                api_key="demo-key",
                api_mode="responses",
            ),
            messages=[ChatMessage(role="user", content="帮我看看 project 这个文件夹有什么")],
            max_steps=4,
        )

        async def fake_call(payload, messages, tool_choice="auto", **kwargs):
            return {
                "content": "",
                "tool_calls": [],
                "api_mode_used": "responses",
            }

        runner._call_model = fake_call  # type: ignore[method-assign]  # noqa: SLF001

        events: list[dict] = []

        def collect(event: dict) -> None:
            events.append(event)

        result = await runner.run_with_events(request, event_callback=collect)

        started = [event for event in events if event["type"] == "tool_started"]
        completed = [event for event in events if event["type"] == "tool_completed"]
        self.assertEqual([event["tool"]["name"] for event in started], ["find_paths", "list_directory"])
        self.assertEqual([event["tool"]["name"] for event in completed], ["find_paths", "list_directory"])
        self.assertTrue(all(event["tool"]["status"] == "pending" for event in started))
        self.assertTrue(all(event["tool"]["status"] == "success" for event in completed))
        self.assertEqual([item.name for item in result.tool_trace], ["find_paths", "list_directory"])
        self.assertTrue(all(item.id for item in result.tool_trace))

    async def test_run_uses_programmatic_filesystem_fallback_when_model_returns_placeholder_reply(self) -> None:
        runner = ChatRunner(local_service=FilesystemToolLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="http://127.0.0.1:8089/v1",
                api_key="demo-key",
                api_mode="responses",
            ),
            messages=[ChatMessage(role="user", content="帮我看看 project 这个文件夹有什么")],
            max_steps=4,
        )

        async def fake_call(payload, messages, tool_choice="auto", **kwargs):
            return {
                "content": "检查完成",
                "tool_calls": [],
                "api_mode_used": "responses",
            }

        runner._call_model = fake_call  # type: ignore[method-assign]  # noqa: SLF001

        result = await runner.run(request)

        self.assertEqual(result.api_mode_used, "programmatic")
        self.assertEqual([item.name for item in result.tool_trace], ["find_paths", "list_directory"])
        self.assertIn("里面目前有这些内容", result.reply)

    async def test_visual_fallback_prefers_window_observation_before_generic_warning(self) -> None:
        local_service = EmptyWindowThenObserveLocalService()
        runner = ChatRunner(local_service=local_service)
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="http://127.0.0.1:8089/v1",
                api_key="demo-key",
                api_mode="responses",
            ),
            messages=[ChatMessage(role="user", content="帮我看看彭雄斌说了什么")],
            max_steps=3,
        )

        async def fake_call(payload, messages, tool_choice="auto", **kwargs):
            return {
                "content": "我可以继续帮你，不过为了更快定位，我先直接尝试在飞书搜索里打开“彭雄斌”的会话。但当前这套桌面工具对飞书窗口里的文字读取不稳定。",
                "tool_calls": [],
                "api_mode_used": "responses",
            }

        runner._call_model = fake_call  # type: ignore[method-assign]  # noqa: SLF001

        result = await runner.run(request)

        self.assertEqual(result.api_mode_used, "programmatic")
        self.assertEqual(local_service.calls, ["observe_frontmost_window"])
        self.assertEqual([item.name for item in result.tool_trace], ["observe_frontmost_window"])
        self.assertIn("彭雄斌", result.reply)
        self.assertNotIn("读取不稳定", result.reply)
        self.assertNotIn("不可靠", result.reply)

    async def test_visual_fallback_emits_tool_events(self) -> None:
        local_service = EmptyWindowThenObserveLocalService()
        runner = ChatRunner(local_service=local_service)
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="http://127.0.0.1:8089/v1",
                api_key="demo-key",
                api_mode="responses",
            ),
            messages=[ChatMessage(role="user", content="帮我看看彭雄斌说了什么")],
            max_steps=3,
        )

        async def fake_call(payload, messages, tool_choice="auto", **kwargs):
            return {
                "content": "可访问性树是空的。",
                "tool_calls": [],
                "api_mode_used": "responses",
            }

        runner._call_model = fake_call  # type: ignore[method-assign]  # noqa: SLF001

        events: list[dict] = []

        def collect(event: dict) -> None:
            events.append(event)

        result = await runner.run_with_events(request, event_callback=collect)

        started = [event for event in events if event["type"] == "tool_started"]
        completed = [event for event in events if event["type"] == "tool_completed"]
        self.assertEqual([event["tool"]["name"] for event in started], ["observe_frontmost_window"])
        self.assertEqual([event["tool"]["name"] for event in completed], ["observe_frontmost_window"])
        self.assertEqual(result.tool_trace[0].status, "success")

    def test_aggressive_kimi_compat_mode_forces_trim_and_updates_diagnostics(self) -> None:
        runner = ChatRunner(local_service=DummyLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="demo-model",
                base_url="https://relay.nf.video/v1",
                api_key="demo-key",
                api_mode="chat_completions",
                model_compat_mode="aggressive_kimi",
            ),
            messages=[
                ChatMessage(role="user", content="第 1 轮"),
                ChatMessage(
                    role="assistant",
                    content="我先观察一下",
                    reasoning_content="长推理内容",
                    tool_calls=[],
                ),
                ChatMessage(
                    role="tool",
                    name="observe",
                    tool_call_id="call_1",
                    content='{"message":"ok"}',
                    content_parts=[
                        {"type": "input_text", "text": '{"message":"ok"}'},
                        {"type": "input_image", "image_url": "data:image/png;base64,ZmFrZQ==", "detail": "high"},
                    ],
                ),
                ChatMessage(role="user", content="第 2 轮"),
                ChatMessage(role="assistant", content="继续"),
                ChatMessage(role="tool", name="click_at", tool_call_id="call_2", content='{"message":"clicked"}'),
                ChatMessage(role="user", content="第 3 轮"),
                ChatMessage(role="assistant", content="继续 2"),
                ChatMessage(role="tool", name="type_text", tool_call_id="call_3", content='{"message":"typed"}'),
                ChatMessage(role="user", content="第 4 轮"),
            ],
        )
        diagnostics = {
            "history_trimmed_for_model": False,
            "aggressive_trim_used": False,
            "serialized_message_count": 0,
            "serialized_user_message_count": 0,
            "serialized_assistant_message_count": 0,
            "serialized_tool_message_count": 0,
            "serialized_system_message_count": 0,
            "serialized_reasoning_message_count": 0,
            "serialized_image_part_count": 0,
        }

        serialized = runner._build_chat_completions_messages(  # noqa: SLF001
            payload=request,
            messages=runner._build_initial_messages(request),  # noqa: SLF001
            tool_choice="required",
            diagnostics=diagnostics,
        )

        self.assertTrue(diagnostics["history_trimmed_for_model"])
        self.assertTrue(diagnostics["aggressive_trim_used"])
        self.assertGreater(diagnostics["serialized_message_count"], 0)
        self.assertGreaterEqual(diagnostics["serialized_system_message_count"], 2)
        self.assertGreaterEqual(diagnostics["serialized_user_message_count"], 1)
        self.assertEqual(diagnostics["serialized_reasoning_message_count"], 0)
        self.assertEqual(diagnostics["serialized_image_part_count"], 0)
        self.assertLess(len(serialized), len(runner._build_initial_messages(request)))  # noqa: SLF001

    async def test_content_filter_triggers_degraded_retry_and_returns_diagnostics(self) -> None:
        runner = ChatRunner(local_service=DummyLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="kimi-k2.6",
                base_url="https://api.moonshot.cn/v1",
                api_key="demo-key",
                api_mode="chat_completions",
            ),
            messages=[ChatMessage(role="user", content="帮我打开 Safari")],
            max_steps=1,
        )

        async def fake_call_once(payload, messages, api_mode, tool_choice, **kwargs):
            raise ModelRequestError(
                api_mode="chat_completions",
                url="https://api.moonshot.cn/v1/chat/completions",
                message="Model endpoint returned an HTTP error.",
                status_code=400,
                response_body='{"code":400,"message":"The request was rejected because it was considered high risk","type":"content_filter"}',
            )

        async def fake_retry(**kwargs):
            return {
                "content": "降级后恢复成功",
                "tool_calls": [],
            }

        runner._call_model_once = fake_call_once  # type: ignore[method-assign]  # noqa: SLF001
        with patch.object(
            runner,
            "_retry_chat_completions_with_degraded_prompt",
            side_effect=fake_retry,
        ):  # noqa: SLF001
            result = await runner.run(request)

        self.assertEqual(result.reply, "降级后恢复成功")
        self.assertIsNotNone(result.diagnostics)
        assert result.diagnostics is not None
        self.assertTrue(result.diagnostics.content_filter_triggered)
        self.assertTrue(result.diagnostics.degraded_retry_used)

    async def test_terminal_model_error_response_sets_content_filter_diagnostics(self) -> None:
        runner = ChatRunner(local_service=DummyLocalService())
        request = ChatRequest(
            config=ModelConfig(
                model="kimi-k2.6",
                base_url="https://api.moonshot.cn/v1",
                api_key="demo-key",
                api_mode="chat_completions",
            ),
            messages=[ChatMessage(role="user", content="打开今天新闻")],
            max_steps=1,
        )

        async def fake_call(payload, messages, tool_choice="auto", **kwargs):
            raise ModelRequestError(
                api_mode="chat_completions",
                url="https://api.moonshot.cn/v1/chat/completions",
                message="Model endpoint returned an HTTP error.",
                status_code=400,
                response_body='{"code":400,"message":"The request was rejected because it was considered high risk","type":"content_filter"}',
            )

        runner._call_model = fake_call  # type: ignore[method-assign]  # noqa: SLF001

        result = await runner.run(request)

        self.assertIn("高风险", result.reply)
        self.assertIsNotNone(result.diagnostics)
        assert result.diagnostics is not None
        self.assertTrue(result.diagnostics.content_filter_triggered)
        self.assertEqual(result.diagnostics.last_error_type, "content_filter")


if __name__ == "__main__":
    unittest.main()
