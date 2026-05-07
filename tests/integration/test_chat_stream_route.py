import json
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from server.app.main import create_app


class ChatStreamRouteTests(unittest.TestCase):
    def test_chat_stream_returns_sse_events(self) -> None:
        app = create_app()
        client = TestClient(app)

        async def fake_run_with_events(payload, event_callback=None):
            if event_callback is not None:
                event_callback(
                    {
                        "type": "run_started",
                        "request_id": "chat_test_1",
                        "model": payload.config.model,
                        "api_mode": payload.config.api_mode,
                        "max_steps": payload.max_steps,
                    }
                )
                event_callback(
                    {
                        "type": "tool_started",
                        "request_id": "chat_test_1",
                        "step_index": 0,
                        "tool": {
                            "id": "call_obs_1",
                            "name": "observe_display",
                            "arguments": {"display_id": "main"},
                            "result": {},
                            "preview_images": [],
                            "status": "pending",
                        },
                    }
                )
                event_callback(
                    {
                        "type": "tool_completed",
                        "request_id": "chat_test_1",
                        "step_index": 0,
                        "tool": {
                            "id": "call_obs_1",
                            "name": "observe_display",
                            "arguments": {"display_id": "main"},
                            "result": {"message": "Captured observation."},
                            "preview_images": ["data:image/png;base64,ZmFrZQ=="],
                            "status": "success",
                        },
                        "finished": False,
                    }
                )
                event_callback(
                    {
                        "type": "run_finished",
                        "reply": "观察完成",
                        "model": payload.config.model,
                        "api_mode_used": "responses",
                        "tool_trace": [
                            {
                                "id": "call_obs_1",
                                "name": "observe_display",
                                "arguments": {"display_id": "main"},
                                "result": {"message": "Captured observation."},
                                "preview_images": ["data:image/png;base64,ZmFrZQ=="],
                                "status": "success",
                            }
                        ],
                        "diagnostics": {
                            "request_id": "chat_test_1",
                            "api_mode_requested": "responses",
                            "api_mode_used": "responses",
                            "last_error_type": None,
                            "last_error_message": None,
                            "content_filter_triggered": False,
                            "degraded_retry_used": False,
                            "history_trimmed_for_model": False,
                            "aggressive_trim_used": False,
                            "tool_trace_count": 1,
                            "serialized_message_count": 2,
                            "serialized_user_message_count": 1,
                            "serialized_assistant_message_count": 0,
                            "serialized_tool_message_count": 0,
                            "serialized_system_message_count": 1,
                            "serialized_reasoning_message_count": 0,
                            "serialized_image_part_count": 0,
                        },
                    }
                )
            return None

        payload = {
            "config": {
                "model": "demo-model",
                "base_url": "https://relay.nf.video/v1",
                "api_key": "demo-key",
                "api_mode": "responses",
                "thinking_mode": "auto",
                "reasoning_effort": "medium",
                "model_compat_mode": "auto",
                "system_prompt": "test prompt",
                "max_images_per_tool_result": 1,
                "model_image_max_edge": 1600,
                "model_image_max_bytes": 350000,
            },
            "messages": [{"role": "user", "content": "看一下屏幕"}],
            "max_steps": 5,
            "enable_ocr": False,
        }

        with patch("server.app.api.routes.chat_runner.run_with_events", side_effect=fake_run_with_events):
            response = client.post("/api/v1/chat/stream", json=payload)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"].split(";")[0], "text/event-stream")

        body = response.text
        self.assertIn("run_started", body)
        self.assertIn("tool_started", body)
        self.assertIn("tool_completed", body)
        self.assertIn("run_finished", body)

        lines = [line for line in body.splitlines() if line.startswith("data: ")]
        events = [json.loads(line[6:]) for line in lines]
        self.assertEqual(events[1]["type"], "tool_started")
        self.assertEqual(events[2]["type"], "tool_completed")
        self.assertEqual(events[-1]["reply"], "观察完成")
        self.assertEqual(events[-1]["tool_trace"][0]["name"], "observe_display")
        self.assertEqual(events[-1]["tool_trace"][0]["status"], "success")


if __name__ == "__main__":
    unittest.main()
