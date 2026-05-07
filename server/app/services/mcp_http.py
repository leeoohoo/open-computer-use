from __future__ import annotations

import base64
import json
from typing import Any

from server.app.services.chat_runner import ChatRunner
from server.app.services.orchestrator import LocalComputerUseService


PROTOCOL_VERSION = "2024-11-05"
SERVER_INFO = {"name": "open-computer-use", "version": "0.1.0"}


TOOLS = [
    {
        "name": "doctor",
        "description": "Inspect local desktop permissions and display availability.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "pointer_state",
        "description": "Read current pointer position and display metadata.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "observe",
        "description": "Capture a screenshot observation. Optionally target a specific display_id.",
        "inputSchema": {
            "type": "object",
            "properties": {"display_id": {"type": "string"}},
            "additionalProperties": False,
        },
    },
    {
        "name": "observe_display",
        "description": "Capture a screenshot observation for a specific display_id.",
        "inputSchema": {
            "type": "object",
            "properties": {"display_id": {"type": "string"}},
            "additionalProperties": False,
        },
    },
    {
        "name": "observe_region",
        "description": "Capture a screenshot observation for a logical region inside a specific display.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "left": {"type": "integer"},
                "top": {"type": "integer"},
                "width": {"type": "integer"},
                "height": {"type": "integer"},
                "display_id": {"type": "string"},
            },
            "required": ["left", "top", "width", "height"],
            "additionalProperties": False,
        },
    },
    {
        "name": "observe_frontmost_window",
        "description": "Capture a screenshot observation cropped to the focused window of the target app or current frontmost app.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app_name": {"type": "string"},
                "bundle_id": {"type": "string"},
                "max_depth": {"type": "integer"},
                "max_children": {"type": "integer"},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "find_paths",
        "description": "Search local filesystem paths by name.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "roots": {"type": "array", "items": {"type": "string"}},
                "max_results": {"type": "integer"},
                "directories_only": {"type": "boolean"},
                "case_sensitive": {"type": "boolean"},
            },
            "required": ["query"],
            "additionalProperties": False,
        },
    },
    {
        "name": "list_directory",
        "description": "List entries in a local directory path.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "include_hidden": {"type": "boolean"},
                "max_entries": {"type": "integer"},
            },
            "required": ["path"],
            "additionalProperties": False,
        },
    },
    {
        "name": "list_apps",
        "description": "List installed and running applications.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "frontmost_app",
        "description": "Read the current frontmost application.",
        "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "accessibility_snapshot",
        "description": "Capture a lightweight accessibility tree for a target app or the frontmost app.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app_name": {"type": "string"},
                "bundle_id": {"type": "string"},
                "max_depth": {"type": "integer"},
                "max_children": {"type": "integer"},
                "use_cached": {"type": "boolean"},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "click_element",
        "description": "Click a UI element by element_id from an accessibility snapshot.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app_name": {"type": "string"},
                "bundle_id": {"type": "string"},
                "element_id": {"type": "string"},
                "button": {"type": "string"},
                "clicks": {"type": "integer"},
                "snapshot_max_depth": {"type": "integer"},
                "snapshot_max_children": {"type": "integer"},
                "use_cached_snapshot": {"type": "boolean"},
            },
            "required": ["element_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "press_element",
        "description": "Invoke a UI element by element_id using accessibility action first, then click fallback if needed.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app_name": {"type": "string"},
                "bundle_id": {"type": "string"},
                "element_id": {"type": "string"},
                "snapshot_max_depth": {"type": "integer"},
                "snapshot_max_children": {"type": "integer"},
                "use_cached_snapshot": {"type": "boolean"},
                "fallback_to_click": {"type": "boolean"},
            },
            "required": ["element_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "perform_element_action",
        "description": "Perform a named accessibility action such as AXPress or AXShowMenu on a UI element by element_id.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app_name": {"type": "string"},
                "bundle_id": {"type": "string"},
                "element_id": {"type": "string"},
                "action_name": {"type": "string"},
                "snapshot_max_depth": {"type": "integer"},
                "snapshot_max_children": {"type": "integer"},
                "use_cached_snapshot": {"type": "boolean"},
                "fallback_to_click": {"type": "boolean"},
            },
            "required": ["element_id", "action_name"],
            "additionalProperties": False,
        },
    },
    {
        "name": "type_into_element",
        "description": "Focus a UI element by element_id and type text into it.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app_name": {"type": "string"},
                "bundle_id": {"type": "string"},
                "element_id": {"type": "string"},
                "text": {"type": "string"},
                "click_first": {"type": "boolean"},
                "clear_first": {"type": "boolean"},
                "typing_interval": {"type": "number"},
                "snapshot_max_depth": {"type": "integer"},
                "snapshot_max_children": {"type": "integer"},
                "use_cached_snapshot": {"type": "boolean"},
            },
            "required": ["element_id", "text"],
            "additionalProperties": False,
        },
    },
    {
        "name": "set_value",
        "description": "Set the value of a text-like UI element by element_id using accessibility APIs first, then typing fallback if needed.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app_name": {"type": "string"},
                "bundle_id": {"type": "string"},
                "element_id": {"type": "string"},
                "text": {"type": "string"},
                "snapshot_max_depth": {"type": "integer"},
                "snapshot_max_children": {"type": "integer"},
                "use_cached_snapshot": {"type": "boolean"},
                "fallback_to_typing": {"type": "boolean"},
                "click_first_on_fallback": {"type": "boolean"},
                "clear_first_on_fallback": {"type": "boolean"},
                "typing_interval": {"type": "number"},
            },
            "required": ["element_id", "text"],
            "additionalProperties": False,
        },
    },
    {
        "name": "focus_element",
        "description": "Focus a UI element by element_id.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app_name": {"type": "string"},
                "bundle_id": {"type": "string"},
                "element_id": {"type": "string"},
                "snapshot_max_depth": {"type": "integer"},
                "snapshot_max_children": {"type": "integer"},
                "use_cached_snapshot": {"type": "boolean"},
            },
            "required": ["element_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "preview_element",
        "description": "Capture a marked preview image centered on a UI element by element_id.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app_name": {"type": "string"},
                "bundle_id": {"type": "string"},
                "element_id": {"type": "string"},
                "crop_size": {"type": "integer"},
                "snapshot_max_depth": {"type": "integer"},
                "snapshot_max_children": {"type": "integer"},
                "use_cached_snapshot": {"type": "boolean"},
            },
            "required": ["element_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "launch_app",
        "description": "Launch an application by name or bundle id.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app_name": {"type": "string"},
                "bundle_id": {"type": "string"},
                "wait_seconds": {"type": "number"},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "activate_app",
        "description": "Bring an application to the foreground by name or bundle id.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "app_name": {"type": "string"},
                "bundle_id": {"type": "string"},
                "wait_seconds": {"type": "number"},
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "open_url",
        "description": "Open a URL in the configured browser helper.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "url": {"type": "string"},
                "app_name": {"type": "string"},
            },
            "required": ["url"],
            "additionalProperties": False,
        },
    },
    {
        "name": "search_web",
        "description": "Search the web in the configured browser helper.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "engine": {"type": "string"},
                "app_name": {"type": "string"},
            },
            "required": ["query"],
            "additionalProperties": False,
        },
    },
    {
        "name": "click_at",
        "description": "Click a logical screen coordinate directly.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x": {"type": "number"},
                "y": {"type": "number"},
                "display_id": {"type": "string"},
                "button": {"type": "string"},
                "capture_after": {"type": "boolean"},
                "verify_action": {"type": "boolean"},
            },
            "required": ["x", "y"],
            "additionalProperties": False,
        },
    },
    {
        "name": "click_in_viewport",
        "description": "Click using image-relative coordinates inside the most recent observation screenshot.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "x": {"type": "number"},
                "y": {"type": "number"},
                "button": {"type": "string"},
                "clicks": {"type": "integer"},
            },
            "required": ["x", "y"],
            "additionalProperties": False,
        },
    },
    {
        "name": "type_text",
        "description": "Type literal text using the keyboard into the currently focused app.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "text": {"type": "string"},
                "interval": {"type": "number"},
                "capture_after": {"type": "boolean"},
            },
            "required": ["text"],
            "additionalProperties": False,
        },
    },
    {
        "name": "press_key",
        "description": "Press a single key in the currently focused app.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "key": {"type": "string"},
                "capture_after": {"type": "boolean"},
            },
            "required": ["key"],
            "additionalProperties": False,
        },
    },
    {
        "name": "hotkey",
        "description": "Press a hotkey chord in the currently focused app.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "keys": {"type": "array", "items": {"type": "string"}},
                "capture_after": {"type": "boolean"},
            },
            "required": ["keys"],
            "additionalProperties": False,
        },
    },
    {
        "name": "scroll",
        "description": "Scroll the currently focused app view up or down.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "direction": {"type": "string"},
                "amount": {"type": "integer"},
                "capture_after": {"type": "boolean"},
            },
            "additionalProperties": False,
        },
    },
]


class HttpMCPService:
    def __init__(self, local_service: LocalComputerUseService | None = None) -> None:
        self.local_service = local_service or LocalComputerUseService()
        self.runner = ChatRunner(local_service=self.local_service)

    def initialize_result(self) -> dict[str, Any]:
        return {
            "protocolVersion": PROTOCOL_VERSION,
            "serverInfo": SERVER_INFO,
            "capabilities": {"tools": {}},
        }

    def tools_list_result(self) -> dict[str, Any]:
        return {"tools": TOOLS}

    def _build_tool_result_content(self, result: Any) -> list[dict[str, Any]]:
        if isinstance(result, str):
            return [{"type": "text", "text": result}]

        if isinstance(result, dict):
            text_payload = json.dumps(
                self.runner._sanitize_tool_result(result),  # noqa: SLF001
                ensure_ascii=False,
                indent=2,
            )
            content: list[dict[str, Any]] = [{"type": "text", "text": text_payload}]
            content.extend(self._extract_image_content_blocks(result))
            return content

        return [{"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=2)}]

    def _extract_image_content_blocks(self, result: dict[str, Any]) -> list[dict[str, Any]]:
        content: list[dict[str, Any]] = []
        for image_data_url in self.runner._extract_image_data_urls_from_tool_result(result):  # noqa: SLF001
            decoded = self.runner._decode_image_payload(image_data_url, None)  # noqa: SLF001
            if decoded is None:
                continue
            raw_bytes, mime_type = decoded
            content.append(
                {
                    "type": "image",
                    "data": base64.b64encode(raw_bytes).decode("ascii"),
                    "mimeType": mime_type,
                }
            )
        return content

    async def handle_jsonrpc(self, request: dict[str, Any]) -> dict[str, Any]:
        method = request.get("method")
        request_id = request.get("id")
        params = request.get("params", {}) or {}

        if method == "initialize":
            return {"jsonrpc": "2.0", "id": request_id, "result": self.initialize_result()}

        if method == "tools/list":
            return {"jsonrpc": "2.0", "id": request_id, "result": self.tools_list_result()}

        if method == "tools/call":
            tool_name = params["name"]
            arguments = params.get("arguments", {}) or {}
            result = await self.runner._dispatch_tool(tool_name, arguments)  # noqa: SLF001
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {
                    "content": self._build_tool_result_content(result),
                    "isError": False,
                },
            }

        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {"code": -32601, "message": f"Unsupported method: {method}"},
        }
