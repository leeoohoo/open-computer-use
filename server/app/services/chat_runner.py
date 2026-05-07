from __future__ import annotations

import base64
import io
import json
import os
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any
from urllib.parse import urljoin
import re

from fastapi.concurrency import run_in_threadpool
from openai import APIConnectionError, APIStatusError, APITimeoutError, AsyncOpenAI
from PIL import Image

from executor.client.desktop.controller import DesktopDependencyError
from server.app.services.orchestrator import LocalComputerUseService
from shared.schemas.chat import ChatDiagnostics, ChatMessage, ChatRequest, ChatResponse, ToolInvocation
from shared.schemas.desktop import (
    ClickAction,
    CoordinateTarget,
    DirectoryListRequest,
    ElementActionRequest,
    ElementPreviewRequest,
    ExecuteActionRequest,
    FocusElementRequest,
    HotkeyAction,
    LocalPathSearchRequest,
    PerformElementActionRequest,
    PressKeyAction,
    PressElementRequest,
    ScrollAction,
    SetValueElementRequest,
    TargetPreviewRequest,
    TypeTextAction,
    TypeIntoElementRequest,
)


class ModelRequestError(RuntimeError):
    def __init__(
        self,
        *,
        api_mode: str,
        url: str,
        message: str,
        status_code: int | None = None,
        response_body: str | None = None,
        retryable_in_auto: bool = False,
    ) -> None:
        self.api_mode = api_mode
        self.url = url
        self.status_code = status_code
        self.response_body = response_body
        self.retryable_in_auto = retryable_in_auto

        detail = f"{message} [mode={api_mode} url={url}"
        if status_code is not None:
            detail += f" status={status_code}"
        detail += "]"
        if response_body:
            detail += f" Response: {self._truncate(response_body)}"
        super().__init__(detail)

    @staticmethod
    def _truncate(text: str, limit: int = 400) -> str:
        compact = " ".join(text.split())
        if len(compact) <= limit:
            return compact
        return compact[: limit - 3] + "..."


class ChatRunner:
    def __init__(self, local_service: LocalComputerUseService) -> None:
        self.local_service = local_service
        self._internal_system_prompt = (
            "You are the execution engine for a local desktop automation assistant. "
            "When the user asks you to inspect or control the local computer, keep working until "
            "the task is completed, blocked, or you need a short clarification from the user. "
            "Do not stop after a planning sentence. While a desktop task is in progress, either "
            "emit one or more declared function tool calls or call finish. Use finish instead of "
            "plain text when the task is complete, blocked, or needs user input. Prefer using the "
            "declared desktop and filesystem tools before asking the user to repeat themselves. "
            "When a tool returns a screenshot image, inspect that image directly and use it to "
            "decide the next action instead of relying only on OCR summaries. "
            "For multi-display or visually dense UIs, do not guess a final click point from one large screenshot. "
            "First identify the relevant display or frontmost app, then use display-specific or region-specific observation "
            "tools to narrow the target before clicking. Prefer observe_frontmost_window for app-local actions "
            "before falling back to full-display screenshots. "
            "When an observation is cropped to a window or region, prefer click_in_viewport with image-relative "
            "coordinates from that screenshot instead of manually converting back to absolute screen coordinates. "
            "Do not pre-emptively tell the user that reading text is unstable or unreliable before you have tried window-level "
            "observation, region-level observation, or OCR-backed visual fallback. Prefer attempting another focused observation "
            "step over giving a cautionary disclaimer."
        )
        self._tool_retry_prompt = (
            "If the user's request requires inspecting or controlling the local computer, "
            "do not only describe your intent. Emit the appropriate tool calls now. "
            "Use finish when the task is complete, blocked, or you need a short user reply. "
            "If filesystem fallback tools such as find_paths or list_directory can help, "
            "use them before asking the user for a path or location hint. "
            "Do not answer with plain text only while the desktop task is still in progress. "
            "If a recent tool returned a screenshot image, inspect it directly before deciding "
            "what to click or type next. On multi-display tasks, prefer observe_display or observe_region "
            "before emitting click_at. For app interactions, prefer observe_frontmost_window before guessing a coordinate. "
            "If you are acting on a cropped screenshot, prefer click_in_viewport using that screenshot's image coordinates."
        )
        self._visual_retry_prompt = (
            "The app accessibility snapshot appears empty or unusable. Do not stop yet. "
            "Use observe, observe_display, observe_frontmost_window, or observe_region to inspect the screen image, then continue with "
            "click_at, press_key, hotkey, type_text, scroll, activate_app, or launch_app as needed. "
            "Use finish only if you have already finished the task or permissions are missing."
        )
        self._declared_tools_only_prompt = (
            "Use only the function tools declared in this API request. "
            "Do not call MCP services, built-in Codex tools, or tools named "
            "'computer-use' or 'codex'. Emit one or more calls from the provided "
            "function tool list now if the task needs computer inspection or control, "
            "or call finish if the task is complete."
        )
        root_dir = Path(__file__).resolve().parents[3]
        self._chat_debug_log_path = Path(
            os.getenv("OPEN_COMPUTER_USE_CHAT_LOG", str(root_dir / "chat_debug.log"))
        )
        self._chat_event_log_path = Path(
            os.getenv("OPEN_COMPUTER_USE_CHAT_EVENT_LOG", str(root_dir / "chat_events.log"))
        )

    def _build_openai_client_options(self, *, api_key: str, base_url: str) -> dict[str, Any]:
        return {
            "api_key": api_key,
            "base_url": base_url,
            "timeout": 60.0,
            "max_retries": 0,
        }

    async def _emit_event(
        self,
        event_callback: Any,
        *,
        event_type: str,
        payload: dict[str, Any],
    ) -> None:
        self._append_event_log({"type": event_type, **payload})
        if event_callback is None:
            return
        await run_in_threadpool(event_callback, {"type": event_type, **payload})

    def _next_tool_invocation_id(
        self,
        *,
        request_id: str,
        step_index: int,
        tool_name: str,
        tool_trace: list[ToolInvocation],
        explicit_id: str | None = None,
    ) -> str:
        return str(explicit_id or f"{request_id}_step{step_index}_{tool_name}_{len(tool_trace) + 1}")

    async def _record_tool_event(
        self,
        *,
        event_callback: Any | None,
        request_id: str,
        step_index: int,
        tool_trace: list[ToolInvocation],
        tool_id: str,
        tool_name: str,
        arguments: dict[str, Any],
        raw_result: dict[str, Any] | None = None,
        reply: str | None = None,
        finished: bool = False,
        started_at: float | None = None,
    ) -> ToolInvocation:
        if raw_result is None:
            pending_started_at = started_at or time.time()
            pending_tool = ToolInvocation(
                id=tool_id,
                name=tool_name,
                step_index=step_index,
                arguments=arguments,
                result={},
                preview_images=[],
                status="pending",
                started_at=pending_started_at,
            )
            await self._emit_event(
                event_callback,
                event_type="tool_started",
                payload={
                    "request_id": request_id,
                    "step_index": step_index,
                    "tool": pending_tool.model_dump(mode="json"),
                },
            )
            return pending_tool

        completed_at = time.time()
        result = self._sanitize_tool_result(raw_result)
        effective_started_at = started_at
        if effective_started_at is None:
            for existing in reversed(tool_trace):
                if existing.id == tool_id and existing.started_at is not None:
                    effective_started_at = existing.started_at
                    break
        duration_ms = None
        if effective_started_at is not None:
            duration_ms = max(0, int(round((completed_at - effective_started_at) * 1000)))
        tool_invocation = ToolInvocation(
            id=tool_id,
            name=tool_name,
            step_index=step_index,
            arguments=arguments,
            result=result,
            preview_images=self._extract_image_data_urls_from_tool_result(raw_result),
            status="error" if "error" in result else "success",
            started_at=effective_started_at,
            finished_at=completed_at,
            duration_ms=duration_ms,
        )
        tool_trace.append(tool_invocation)
        payload: dict[str, Any] = {
            "request_id": request_id,
            "step_index": step_index,
            "tool": tool_invocation.model_dump(mode="json"),
            "finished": finished,
        }
        if reply is not None:
            payload["reply"] = reply
        await self._emit_event(
            event_callback,
            event_type="tool_completed",
            payload=payload,
        )
        return tool_invocation

    async def run(self, payload: ChatRequest) -> ChatResponse:
        return await self.run_with_events(payload)

    async def run_with_events(
        self,
        payload: ChatRequest,
        *,
        event_callback: Any | None = None,
    ) -> ChatResponse:
        with self._temporary_ocr_setting(payload.enable_ocr):
            self._apply_runtime_image_limits(payload)
            messages = self._build_initial_messages(payload)
            tool_trace: list[ToolInvocation] = []
            api_mode_used: str | None = None
            forced_tool_retry_used = False
            visual_retry_used = False
            declared_tool_retry_used = False
            request_id = f"chat_{int(time.time() * 1000)}"
            diagnostics: dict[str, Any] = {
                "request_id": request_id,
                "api_mode_requested": payload.config.api_mode,
                "api_mode_used": None,
                "last_error_type": None,
                "last_error_message": None,
                "content_filter_triggered": False,
                "degraded_retry_used": False,
                "history_trimmed_for_model": False,
                "aggressive_trim_used": False,
                "tool_trace_count": 0,
                "serialized_message_count": 0,
                "serialized_user_message_count": 0,
                "serialized_assistant_message_count": 0,
                "serialized_tool_message_count": 0,
                "serialized_system_message_count": 0,
                "serialized_reasoning_message_count": 0,
                "serialized_image_part_count": 0,
            }
            self._append_debug_log(
                {
                    "event": "chat_run_started",
                    "request_id": request_id,
                    "model": payload.config.model,
                    "base_url": payload.config.base_url,
                    "api_mode": payload.config.api_mode,
                    "model_compat_mode": payload.config.model_compat_mode,
                    "max_steps": payload.max_steps,
                    "enable_ocr": payload.enable_ocr,
                    "messages": [message.model_dump() for message in messages],
                }
            )
            await self._emit_event(
                event_callback,
                event_type="run_started",
                payload={
                    "request_id": request_id,
                    "model": payload.config.model,
                    "api_mode": payload.config.api_mode,
                    "max_steps": payload.max_steps,
                },
            )

            for step_index in range(payload.max_steps):
                await self._emit_event(
                    event_callback,
                    event_type="step_started",
                    payload={
                        "request_id": request_id,
                        "step_index": step_index,
                    },
                )
                try:
                    response = await self._call_model(
                        payload,
                        messages,
                        tool_choice=self._select_tool_choice(messages),
                        request_id=request_id,
                        step_index=step_index,
                        diagnostics=diagnostics,
                    )
                except ModelRequestError as exc:
                    terminal_response = self._build_terminal_model_error_response(
                        payload=payload,
                        tool_trace=tool_trace,
                        diagnostics=diagnostics,
                        exc=exc,
                    )
                    await self._emit_event(
                        event_callback,
                        event_type="run_finished",
                        payload=terminal_response.model_dump(mode="json"),
                    )
                    return terminal_response
                api_mode_used = response["api_mode_used"]
                diagnostics["api_mode_used"] = api_mode_used
                tool_calls = response["tool_calls"]
                content = response["content"]
                response_error = response.get("response_error")
                self._append_debug_log(
                    {
                        "event": "chat_model_response",
                        "request_id": request_id,
                        "step_index": step_index,
                        "api_mode_used": api_mode_used,
                        "tool_calls_count": len(tool_calls),
                        "content": content,
                        "response_error": response_error,
                    }
                )
                await self._emit_event(
                    event_callback,
                    event_type="model_response",
                    payload={
                        "request_id": request_id,
                        "step_index": step_index,
                        "api_mode_used": api_mode_used,
                        "content": content,
                        "tool_calls_count": len(tool_calls),
                    },
                )

                if not tool_calls:
                    while True:
                        no_tool_diagnostics = self._build_no_tool_diagnostics(
                            messages=messages,
                            content=content,
                            forced_tool_retry_used=forced_tool_retry_used,
                            visual_retry_used=visual_retry_used,
                        )
                        self._append_debug_log(
                            {
                                "event": "chat_no_tool_decision",
                                "request_id": request_id,
                                "step_index": step_index,
                                "content": content,
                                "response_error": response_error,
                                **no_tool_diagnostics,
                            }
                        )
                        retry_prompt: str | None = None
                        retry_event: str | None = None
                        retry_response_event: str | None = None

                        if self._is_disallowed_tool_use_error(response_error) and not declared_tool_retry_used:
                            declared_tool_retry_used = True
                            retry_prompt = self._declared_tools_only_prompt
                            retry_event = "chat_force_declared_tool_retry"
                            retry_response_event = "chat_declared_tool_retry_response"
                        elif no_tool_diagnostics["should_force_visual_retry"]:
                            visual_retry_used = True
                            retry_prompt = self._visual_retry_prompt
                            retry_event = "chat_force_visual_retry"
                            retry_response_event = "chat_visual_retry_response"
                        elif no_tool_diagnostics["should_force_tool_retry"]:
                            forced_tool_retry_used = True
                            retry_prompt = self._tool_retry_prompt
                            retry_event = "chat_force_tool_retry"
                            retry_response_event = "chat_forced_tool_response"

                        if retry_prompt is None or retry_event is None or retry_response_event is None:
                            break

                        self._append_debug_log(
                            {
                                "event": retry_event,
                                "request_id": request_id,
                                "step_index": step_index,
                                "content": content,
                                "response_error": response_error,
                            }
                        )
                        if content:
                            messages.append(ChatMessage(role="assistant", content=content))
                        messages.append(ChatMessage(role="system", content=retry_prompt))
                        try:
                            response = await self._call_model(
                                payload,
                                messages,
                                tool_choice="required",
                                request_id=request_id,
                                step_index=step_index,
                                diagnostics=diagnostics,
                            )
                        except ModelRequestError as exc:
                            terminal_response = self._build_terminal_model_error_response(
                                payload=payload,
                                tool_trace=tool_trace,
                                diagnostics=diagnostics,
                                exc=exc,
                            )
                            await self._emit_event(
                                event_callback,
                                event_type="run_finished",
                                payload=terminal_response.model_dump(mode="json"),
                            )
                            return terminal_response
                        api_mode_used = response["api_mode_used"]
                        diagnostics["api_mode_used"] = api_mode_used
                        tool_calls = response["tool_calls"]
                        content = response["content"]
                        response_error = response.get("response_error")
                        self._append_debug_log(
                            {
                                "event": retry_response_event,
                                "request_id": request_id,
                                "step_index": step_index,
                                "api_mode_used": api_mode_used,
                                "tool_calls_count": len(tool_calls),
                                "content": content,
                                "response_error": response_error,
                            }
                        )
                        if tool_calls:
                            break

                    if not tool_calls:
                        fallback = await self._build_no_tool_fallback(
                            payload=payload,
                            messages=messages,
                            content=content,
                            response_error=response_error,
                            tool_trace=tool_trace,
                            request_id=request_id,
                            step_index=step_index,
                            event_callback=event_callback,
                        )
                        if fallback is not None:
                            await self._emit_event(
                                event_callback,
                                event_type="run_finished",
                                payload=fallback.model_dump(mode="json"),
                            )
                            return fallback

                        reply = content or "The model did not emit any tool calls after tool-call retries."
                        if self._is_disallowed_tool_use_error(response_error):
                            reply = (
                                "The model attempted to use an external MCP/Codex tool that is not declared "
                                "for this request, so no local function tool call was executed."
                            )
                        self._append_debug_log(
                            {
                                "event": "chat_run_finished_without_tools",
                                "request_id": request_id,
                                "step_index": step_index,
                                "reply": reply,
                                "response_error": response_error,
                            }
                        )
                        final_response = ChatResponse(
                            reply=reply,
                            model=payload.config.model,
                            api_mode_used=api_mode_used,
                            tool_trace=tool_trace,
                            diagnostics=self._build_chat_diagnostics(diagnostics, tool_trace=tool_trace),
                        )
                        await self._emit_event(
                            event_callback,
                            event_type="run_finished",
                            payload=final_response.model_dump(mode="json"),
                        )
                        return final_response
                    if tool_calls:
                        self._append_debug_log(
                            {
                                "event": "chat_retry_recovered_tool_calls",
                                "request_id": request_id,
                                "step_index": step_index,
                                "tool_calls_count": len(tool_calls),
                            }
                        )
                    else:
                        self._append_debug_log(
                            {
                                "event": "chat_run_finished_direct_reply",
                                "request_id": request_id,
                                "step_index": step_index,
                                "reply": content,
                                "tool_trace": [item.model_dump() for item in tool_trace],
                            }
                        )
                        final_response = ChatResponse(
                            reply=content,
                            model=payload.config.model,
                            api_mode_used=api_mode_used,
                            tool_trace=tool_trace,
                            diagnostics=self._build_chat_diagnostics(diagnostics, tool_trace=tool_trace),
                        )
                        await self._emit_event(
                            event_callback,
                            event_type="run_finished",
                            payload=final_response.model_dump(mode="json"),
                        )
                        return final_response

                messages.append(
                    ChatMessage(
                        role="assistant",
                        content=content,
                        reasoning_content=response.get("reasoning_content"),
                        tool_calls=tool_calls,
                    )
                )

                for tool_call in tool_calls:
                    tool_name = tool_call["function"]["name"]
                    raw_arguments = tool_call["function"].get("arguments") or "{}"
                    arguments = self._decode_tool_arguments(tool_name, raw_arguments)
                    tool_started_at = time.time()
                    tool_invocation_id = self._next_tool_invocation_id(
                        request_id=request_id,
                        step_index=step_index,
                        tool_name=tool_name,
                        tool_trace=tool_trace,
                        explicit_id=str(tool_call.get("call_id") or tool_call.get("id") or ""),
                    )
                    await self._record_tool_event(
                        event_callback=event_callback,
                        request_id=request_id,
                        step_index=step_index,
                        tool_trace=tool_trace,
                        tool_id=tool_invocation_id,
                        tool_name=tool_name,
                        arguments=arguments,
                        started_at=tool_started_at,
                    )
                    if tool_name == "finish":
                        result = {
                            "ok": True,
                            "message": arguments.get("message", ""),
                            "outcome": arguments.get("outcome", "completed"),
                        }
                        self._append_debug_log(
                            {
                                "event": "chat_finish_called",
                                "request_id": request_id,
                                "step_index": step_index,
                                "arguments": arguments,
                                "result": result,
                            }
                        )
                        await self._record_tool_event(
                            event_callback=event_callback,
                            request_id=request_id,
                            step_index=step_index,
                            tool_trace=tool_trace,
                            tool_id=tool_invocation_id,
                            tool_name=tool_name,
                            arguments=arguments,
                            raw_result=result,
                            reply=result["message"] or content or "任务已结束。",
                            finished=True,
                            started_at=tool_started_at,
                        )
                        final_response = ChatResponse(
                            reply=result["message"] or content or "任务已结束。",
                            model=payload.config.model,
                            api_mode_used=api_mode_used,
                            tool_trace=tool_trace,
                            diagnostics=self._build_chat_diagnostics(diagnostics, tool_trace=tool_trace),
                        )
                        await self._emit_event(
                            event_callback,
                            event_type="run_finished",
                            payload=final_response.model_dump(mode="json"),
                        )
                        return final_response
                    raw_result = await self._dispatch_tool(tool_name, arguments)
                    result = self._sanitize_tool_result(raw_result)
                    model_result_text, model_result_parts = self._tool_result_to_message_content(raw_result)
                    self._append_debug_log(
                        {
                            "event": "chat_tool_invocation",
                            "request_id": request_id,
                            "step_index": step_index,
                            "tool_name": tool_name,
                            "arguments": arguments,
                            "result": result,
                        }
                    )
                    await self._record_tool_event(
                        event_callback=event_callback,
                        request_id=request_id,
                        step_index=step_index,
                        tool_trace=tool_trace,
                        tool_id=tool_invocation_id,
                        tool_name=tool_name,
                        arguments=arguments,
                        raw_result=raw_result,
                        finished=False,
                        started_at=tool_started_at,
                    )
                    messages.append(
                        ChatMessage(
                            role="tool",
                            name=tool_name,
                            tool_call_id=tool_call.get("call_id") or tool_call["id"],
                            content=model_result_text,
                            content_parts=model_result_parts,
                        )
                    )

            self._append_debug_log(
                {
                    "event": "chat_run_max_steps_reached",
                    "request_id": request_id,
                    "tool_trace": [item.model_dump() for item in tool_trace],
                }
            )
            summary = self._summarize_tool_trace(tool_trace)
            await self._emit_event(
                event_callback,
                event_type="run_finished",
                payload={
                    "request_id": request_id,
                    "reply": (
                        "这轮操作没有正常收尾，工具调用步数已经用完。\n\n"
                        "我已经执行到这些步骤：\n"
                        f"{summary}"
                    ),
                    "api_mode_used": api_mode_used,
                    "tool_trace": [item.model_dump(mode="json") for item in tool_trace],
                    "diagnostics": self._build_chat_diagnostics(diagnostics, tool_trace=tool_trace).model_dump(mode="json"),
                },
            )
            final_response = ChatResponse(
                reply=(
                    "这轮操作没有正常收尾，工具调用步数已经用完。\n\n"
                    "我已经执行到这些步骤：\n"
                    f"{summary}"
                ),
                model=payload.config.model,
                api_mode_used=api_mode_used,
                tool_trace=tool_trace,
                diagnostics=self._build_chat_diagnostics(diagnostics, tool_trace=tool_trace),
            )
            await self._emit_event(
                event_callback,
                event_type="run_finished",
                payload=final_response.model_dump(mode="json"),
            )
            return final_response

    async def _call_model(
        self,
        payload: ChatRequest,
        messages: list[ChatMessage],
        tool_choice: str = "auto",
        request_id: str | None = None,
        step_index: int | None = None,
        diagnostics: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        errors: list[str] = []

        for api_mode in self._resolve_api_modes(payload.config.api_mode):
            try:
                normalized = await self._call_model_once(
                    payload,
                    messages,
                    api_mode,
                    tool_choice,
                    request_id=request_id,
                    step_index=step_index,
                    diagnostics=diagnostics,
                )
                normalized["api_mode_used"] = api_mode
                return normalized
            except ModelRequestError as exc:
                errors.append(str(exc))
                if diagnostics is not None:
                    diagnostics["last_error_type"] = self._classify_model_error(exc)
                    diagnostics["last_error_message"] = str(exc)
                    if self._is_content_filter_error(exc):
                        diagnostics["content_filter_triggered"] = True
                self._append_debug_log(
                    {
                        "event": "chat_model_error",
                        "request_id": request_id,
                        "step_index": step_index,
                        "api_mode": api_mode,
                        "tool_choice": tool_choice,
                        "error": str(exc),
                    }
                )
                if (
                    diagnostics is not None
                    and api_mode == "chat_completions"
                    and self._is_content_filter_error(exc)
                    and not diagnostics.get("degraded_retry_used")
                ):
                    diagnostics["degraded_retry_used"] = True
                    degraded = await self._retry_chat_completions_with_degraded_prompt(
                        payload=payload,
                        messages=messages,
                        tool_choice=tool_choice,
                        request_id=request_id,
                        step_index=step_index,
                        diagnostics=diagnostics,
                    )
                    if degraded is not None:
                        degraded["api_mode_used"] = "chat_completions"
                        return degraded
                if payload.config.api_mode != "auto" or not exc.retryable_in_auto:
                    raise

        raise ModelRequestError(
            api_mode="auto",
            url=payload.config.base_url,
            message="All model API modes failed.",
            response_body=" | ".join(errors),
            retryable_in_auto=False,
        )

    async def _call_model_once(
        self,
        payload: ChatRequest,
        messages: list[ChatMessage],
        api_mode: str,
        tool_choice: str,
        request_id: str | None = None,
        step_index: int | None = None,
        diagnostics: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if api_mode == "responses":
            return await self._call_responses_api(
                payload,
                messages,
                tool_choice,
                request_id=request_id,
                step_index=step_index,
                diagnostics=diagnostics,
            )
        if api_mode == "chat_completions":
            return await self._call_chat_completions_api(
                payload,
                messages,
                tool_choice,
                request_id=request_id,
                step_index=step_index,
                diagnostics=diagnostics,
            )
        raise ValueError(f"Unsupported API mode: {api_mode}")

    def _resolve_api_modes(self, configured_mode: str) -> list[str]:
        if configured_mode == "responses":
            return ["responses"]
        if configured_mode == "chat_completions":
            return ["chat_completions"]
        return ["responses", "chat_completions"]

    def _is_moonshot_kimi_thinking_incompatible_with_required(
        self,
        *,
        base_url: str,
        model: str,
        thinking_mode: str,
    ) -> bool:
        normalized_base_url = base_url.lower()
        normalized_model = model.lower()
        if "moonshot.cn" not in normalized_base_url and "platform.kimi.com" not in normalized_base_url:
            return False
        if not normalized_model.startswith("kimi-k2"):
            return False
        return thinking_mode == "enabled"

    def _resolve_chat_completions_thinking(
        self,
        *,
        base_url: str,
        model: str,
        tool_choice: str,
        thinking_mode: str,
    ) -> dict[str, str] | None:
        normalized_base_url = base_url.lower()
        normalized_model = model.lower()

        if thinking_mode == "disabled":
            return {"type": "disabled"}

        if thinking_mode == "enabled":
            return {"type": "enabled"}

        if "moonshot.cn" in normalized_base_url and tool_choice == "required" and normalized_model.startswith("kimi-k2"):
            return {"type": "disabled"}

        return None

    def _coerce_chat_completions_tool_choice(
        self,
        *,
        base_url: str,
        model: str,
        requested_tool_choice: str,
        thinking_mode: str,
    ) -> str:
        if (
            requested_tool_choice == "required"
            and self._is_moonshot_kimi_thinking_incompatible_with_required(
                base_url=base_url,
                model=model,
                thinking_mode=thinking_mode,
            )
        ):
            return "auto"
        return requested_tool_choice

    async def _call_responses_api(
        self,
        payload: ChatRequest,
        messages: list[ChatMessage],
        tool_choice: str,
        request_id: str | None = None,
        step_index: int | None = None,
        diagnostics: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        url = urljoin(payload.config.base_url.rstrip("/") + "/", "responses")
        serialized_input = self._serialize_responses_input(messages)
        self._apply_serialization_diagnostics(
            diagnostics,
            messages=messages,
            serialized_count=len(messages),
            aggressive_trim_used=False,
        )
        request_body = {
            "model": payload.config.model,
            "input": serialized_input,
            "tools": self._build_responses_tools(),
            "tool_choice": tool_choice,
            "reasoning": {"effort": payload.config.reasoning_effort},
        }
        response = await self._request_model_api(
            base_url=payload.config.base_url,
            url=url,
            request_body=request_body,
            api_key=payload.config.api_key,
            api_mode="responses",
            request_id=request_id,
            step_index=step_index,
            tool_choice=tool_choice,
        )
        return self._normalize_responses_payload(response, url)

    async def _call_chat_completions_api(
        self,
        payload: ChatRequest,
        messages: list[ChatMessage],
        tool_choice: str,
        request_id: str | None = None,
        step_index: int | None = None,
        diagnostics: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        url = urljoin(payload.config.base_url.rstrip("/") + "/", "chat/completions")
        resolved_tool_choice = self._coerce_chat_completions_tool_choice(
            base_url=payload.config.base_url,
            model=payload.config.model,
            requested_tool_choice=tool_choice,
            thinking_mode=payload.config.thinking_mode,
        )
        request_body = {
            "model": payload.config.model,
            "messages": self._build_chat_completions_messages(
                payload=payload,
                messages=messages,
                tool_choice=resolved_tool_choice,
                diagnostics=diagnostics,
            ),
            "tools": self._build_chat_completion_tools(),
            "tool_choice": resolved_tool_choice,
        }
        thinking = self._resolve_chat_completions_thinking(
            base_url=payload.config.base_url,
            model=payload.config.model,
            tool_choice=resolved_tool_choice,
            thinking_mode=payload.config.thinking_mode,
        )
        if thinking is not None:
            request_body["extra_body"] = {"thinking": thinking}
        if self._should_include_chat_completions_reasoning(
            base_url=payload.config.base_url,
            tool_choice=resolved_tool_choice,
        ):
            request_body["reasoning_effort"] = payload.config.reasoning_effort
        response = await self._request_model_api(
            base_url=payload.config.base_url,
            url=url,
            request_body=request_body,
            api_key=payload.config.api_key,
            api_mode="chat_completions",
            request_id=request_id,
            step_index=step_index,
            tool_choice=resolved_tool_choice,
        )
        return self._normalize_chat_completion_payload(response, url)

    async def _retry_chat_completions_with_degraded_prompt(
        self,
        *,
        payload: ChatRequest,
        messages: list[ChatMessage],
        tool_choice: str,
        request_id: str | None,
        step_index: int | None,
        diagnostics: dict[str, Any] | None,
    ) -> dict[str, Any] | None:
        url = urljoin(payload.config.base_url.rstrip("/") + "/", "chat/completions")
        degraded_messages = self._build_chat_completions_messages(
            payload=payload,
            messages=messages,
            tool_choice=tool_choice,
            force_aggressive_trim=True,
            diagnostics=diagnostics,
        )
        if diagnostics is not None:
            diagnostics["history_trimmed_for_model"] = True
        request_body = {
            "model": payload.config.model,
            "messages": degraded_messages,
            "tools": self._build_chat_completion_tools(),
            "tool_choice": "auto",
        }
        self._append_debug_log(
            {
                "event": "chat_degraded_retry_started",
                "request_id": request_id,
                "step_index": step_index,
                "tool_choice": tool_choice,
            }
        )
        try:
            response = await self._request_model_api(
                base_url=payload.config.base_url,
                url=url,
                request_body=request_body,
                api_key=payload.config.api_key,
                api_mode="chat_completions",
                request_id=request_id,
                step_index=step_index,
                tool_choice="auto",
            )
            normalized = self._normalize_chat_completion_payload(response, url)
            self._append_debug_log(
                {
                    "event": "chat_degraded_retry_succeeded",
                    "request_id": request_id,
                    "step_index": step_index,
                    "tool_calls_count": len(normalized.get("tool_calls") or []),
                    "content": normalized.get("content"),
                }
            )
            return normalized
        except ModelRequestError as exc:
            if diagnostics is not None:
                diagnostics["last_error_type"] = self._classify_model_error(exc)
                diagnostics["last_error_message"] = str(exc)
            self._append_debug_log(
                {
                    "event": "chat_degraded_retry_failed",
                    "request_id": request_id,
                    "step_index": step_index,
                    "error": str(exc),
                }
            )
            return None

    def _build_chat_completions_messages(
        self,
        *,
        payload: ChatRequest,
        messages: list[ChatMessage],
        tool_choice: str,
        force_aggressive_trim: bool = False,
        diagnostics: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        prepared_messages = messages
        aggressive_trim = force_aggressive_trim or self._should_force_aggressive_trim(
            compat_mode=payload.config.model_compat_mode
        )
        trim_changed = False
        if self._should_trim_chat_completions_history(
            base_url=payload.config.base_url,
            model=payload.config.model,
            compat_mode=payload.config.model_compat_mode,
        ):
            prepared_messages, trim_changed = self._trim_chat_completions_history(
                messages,
                tool_choice=tool_choice,
                aggressive=aggressive_trim,
            )
            if diagnostics is not None and trim_changed:
                diagnostics["history_trimmed_for_model"] = True
                if aggressive_trim:
                    diagnostics["aggressive_trim_used"] = True
        serialized_messages = [
            self._serialize_chat_completion_message(message) for message in prepared_messages
        ]
        self._apply_serialization_diagnostics(
            diagnostics,
            messages=prepared_messages,
            serialized_count=len(serialized_messages),
            aggressive_trim_used=aggressive_trim and trim_changed,
        )
        return serialized_messages

    def _should_force_aggressive_trim(self, *, compat_mode: str) -> bool:
        return compat_mode == "aggressive_kimi"

    def _should_trim_chat_completions_history(
        self,
        *,
        base_url: str,
        model: str,
        compat_mode: str,
    ) -> bool:
        if compat_mode == "standard":
            return False
        if compat_mode == "aggressive_kimi":
            return True
        normalized_base_url = base_url.lower()
        normalized_model = model.lower()
        return (
            "moonshot.cn" in normalized_base_url
            or "platform.kimi.com" in normalized_base_url
            or normalized_model.startswith("kimi-")
        )

    def _trim_chat_completions_history(
        self,
        messages: list[ChatMessage],
        *,
        tool_choice: str,
        aggressive: bool = False,
    ) -> tuple[list[ChatMessage], bool]:
        recent_count = 6 if aggressive else (10 if tool_choice == "required" else 8)
        assistant_reasoning_budget = 0 if aggressive else (2 if tool_choice == "required" else 1)
        tool_image_budget = 0 if aggressive else 1

        keep_flags = [message.role == "system" for message in messages]
        non_system_indices = [index for index, message in enumerate(messages) if message.role != "system"]
        start_index = max(0, len(non_system_indices) - recent_count)
        for index in non_system_indices[start_index:]:
            keep_flags[index] = True

        latest_user_index: int | None = None
        for index, message in enumerate(messages):
            if message.role == "user":
                latest_user_index = index
        if latest_user_index is not None:
            keep_flags[latest_user_index] = True

        for index, message in enumerate(messages):
            if not keep_flags[index] or message.role != "tool":
                continue
            owner_index = index - 1
            while owner_index >= 0 and messages[owner_index].role == "tool":
                owner_index -= 1
            if (
                owner_index >= 0
                and messages[owner_index].role == "assistant"
                and messages[owner_index].tool_calls
            ):
                keep_flags[owner_index] = True

        for index, message in enumerate(messages):
            if not keep_flags[index] or message.role != "assistant" or not message.tool_calls:
                continue
            next_index = index + 1
            while next_index < len(messages) and messages[next_index].role == "tool":
                keep_flags[next_index] = True
                next_index += 1

        reasoning_keep_ids: set[int] = set()
        image_keep_ids: set[int] = set()

        for index in range(len(messages) - 1, -1, -1):
            message = messages[index]
            if not keep_flags[index]:
                continue
            if (
                assistant_reasoning_budget > 0
                and message.role == "assistant"
                and message.reasoning_content
            ):
                reasoning_keep_ids.add(id(message))
                assistant_reasoning_budget -= 1
            if (
                tool_image_budget > 0
                and message.role == "tool"
                and self._message_contains_image_part(message.content_parts)
            ):
                image_keep_ids.add(id(message))
                tool_image_budget -= 1
            if assistant_reasoning_budget <= 0 and tool_image_budget <= 0:
                break

        trimmed: list[ChatMessage] = []
        changed = False

        for index, message in enumerate(messages):
            if not keep_flags[index]:
                changed = True
                continue

            clone = message.model_copy(deep=True)

            if clone.role == "assistant" and clone.reasoning_content:
                if id(message) not in reasoning_keep_ids:
                    clone.reasoning_content = None
                    changed = True

            if clone.role == "tool" and clone.content_parts:
                if id(message) in image_keep_ids:
                    limited_parts = self._limit_tool_content_parts(clone.content_parts)
                    if limited_parts != clone.content_parts:
                        changed = True
                    clone.content_parts = limited_parts
                else:
                    stripped_parts = self._strip_image_parts(clone.content_parts)
                    if stripped_parts != clone.content_parts:
                        changed = True
                    clone.content_parts = stripped_parts

            trimmed.append(clone)

        return trimmed, changed

    def _apply_serialization_diagnostics(
        self,
        diagnostics: dict[str, Any] | None,
        *,
        messages: list[ChatMessage],
        serialized_count: int,
        aggressive_trim_used: bool,
    ) -> None:
        if diagnostics is None:
            return

        role_counts = {
            "system": 0,
            "user": 0,
            "assistant": 0,
            "tool": 0,
        }
        reasoning_count = 0
        image_part_count = 0

        for message in messages:
            if message.role in role_counts:
                role_counts[message.role] += 1
            if message.reasoning_content:
                reasoning_count += 1
            image_part_count += self._count_image_parts(message.content_parts)

        diagnostics["serialized_message_count"] = serialized_count
        diagnostics["serialized_system_message_count"] = role_counts["system"]
        diagnostics["serialized_user_message_count"] = role_counts["user"]
        diagnostics["serialized_assistant_message_count"] = role_counts["assistant"]
        diagnostics["serialized_tool_message_count"] = role_counts["tool"]
        diagnostics["serialized_reasoning_message_count"] = reasoning_count
        diagnostics["serialized_image_part_count"] = image_part_count
        if aggressive_trim_used:
            diagnostics["aggressive_trim_used"] = True

    def _apply_runtime_image_limits(self, payload: ChatRequest) -> None:
        os.environ["CUA_MODEL_MAX_IMAGES_PER_TOOL_RESULT"] = str(
            payload.config.max_images_per_tool_result
        )
        os.environ["CUA_MODEL_IMAGE_MAX_EDGE"] = str(payload.config.model_image_max_edge)
        os.environ["CUA_MODEL_IMAGE_MAX_BYTES"] = str(payload.config.model_image_max_bytes)

    def _count_image_parts(self, content_parts: list[dict[str, Any]]) -> int:
        count = 0
        for part in content_parts:
            if not isinstance(part, dict):
                continue
            if part.get("type") in {"input_image", "image_url"}:
                count += 1
        return count

    def _is_content_filter_error(self, exc: ModelRequestError) -> bool:
        body = (exc.response_body or "").lower()
        return "content_filter" in body or "high risk" in body

    def _classify_model_error(self, exc: ModelRequestError) -> str:
        if self._is_content_filter_error(exc):
            return "content_filter"
        if exc.status_code is not None:
            return f"http_{exc.status_code}"
        return "request_error"

    def _build_chat_diagnostics(
        self,
        diagnostics: dict[str, Any],
        *,
        tool_trace: list[ToolInvocation],
    ) -> ChatDiagnostics:
        payload = dict(diagnostics)
        payload["tool_trace_count"] = len(tool_trace)
        return ChatDiagnostics(**payload)

    def _build_terminal_model_error_response(
        self,
        *,
        payload: ChatRequest,
        tool_trace: list[ToolInvocation],
        diagnostics: dict[str, Any],
        exc: ModelRequestError,
    ) -> ChatResponse:
        if diagnostics.get("last_error_type") is None:
            diagnostics["last_error_type"] = self._classify_model_error(exc)
        if diagnostics.get("last_error_message") is None:
            diagnostics["last_error_message"] = str(exc)
        if self._is_content_filter_error(exc):
            diagnostics["content_filter_triggered"] = True
            reply = (
                "模型服务把这次请求判定为高风险并拦截了。"
                " 这通常不是任务本身有问题，而是上下文里累计了过多截图、推理内容或多轮桌面操作信息。"
                " 我已经尽量做了裁剪和降级重试，但这次还是被拦下了。"
            )
        else:
            reply = f"模型请求失败：{exc}"
        return ChatResponse(
            reply=reply,
            model=payload.config.model,
            api_mode_used=diagnostics.get("api_mode_used"),
            tool_trace=tool_trace,
            diagnostics=self._build_chat_diagnostics(diagnostics, tool_trace=tool_trace),
        )

    def _message_contains_image_part(self, content_parts: list[dict[str, Any]]) -> bool:
        for part in content_parts:
            if not isinstance(part, dict):
                continue
            if part.get("type") in {"input_image", "image_url"}:
                return True
        return False

    def _strip_image_parts(self, content_parts: list[dict[str, Any]]) -> list[dict[str, Any]]:
        stripped: list[dict[str, Any]] = []
        for part in content_parts:
            if not isinstance(part, dict):
                continue
            if part.get("type") in {"input_image", "image_url"}:
                continue
            if part.get("type") in {"input_text", "output_text", "text"}:
                text = part.get("text")
                if isinstance(text, str) and text:
                    stripped.append(
                        {
                            "type": "input_text",
                            "text": self._truncate_text(text, limit=1200),
                        }
                    )
        return stripped

    def _limit_tool_content_parts(self, content_parts: list[dict[str, Any]]) -> list[dict[str, Any]]:
        limited: list[dict[str, Any]] = []
        image_kept = False
        for part in content_parts:
            if not isinstance(part, dict):
                continue
            part_type = part.get("type")
            if part_type in {"input_text", "output_text", "text"}:
                text = part.get("text")
                if isinstance(text, str) and text:
                    limited.append(
                        {
                            "type": "input_text",
                            "text": self._truncate_text(text, limit=1200),
                        }
                    )
                continue
            if part_type in {"input_image", "image_url"} and not image_kept:
                image_url = part.get("image_url")
                if isinstance(image_url, str) and image_url:
                    limited.append(
                        {
                            "type": "input_image",
                            "image_url": image_url,
                            "detail": "high",
                        }
                    )
                    image_kept = True
        return limited

    def _should_include_chat_completions_reasoning(self, *, base_url: str, tool_choice: str) -> bool:
        normalized = base_url.lower()
        if tool_choice == "required" and "moonshot.cn" in normalized:
            return False
        return True

    async def _request_model_api(
        self,
        *,
        base_url: str,
        url: str,
        request_body: dict[str, Any],
        api_key: str,
        api_mode: str,
        request_id: str | None = None,
        step_index: int | None = None,
        tool_choice: str | None = None,
    ) -> dict[str, Any]:
        client_options = self._build_openai_client_options(api_key=api_key, base_url=base_url)
        self._append_debug_log(
            {
                "event": "chat_http_request",
                "request_id": request_id,
                "step_index": step_index,
                "api_mode": api_mode,
                "tool_choice": tool_choice,
                "url": url,
                "transport": "openai_sdk",
                "client_options": self._redact_client_options(client_options),
                "request_body": request_body,
            }
        )

        client: AsyncOpenAI | None = None
        try:
            client = AsyncOpenAI(**client_options)
            if api_mode == "responses":
                response = await client.responses.create(**request_body)
            elif api_mode == "chat_completions":
                response = await client.chat.completions.create(**request_body)
            else:
                raise ValueError(f"Unsupported API mode: {api_mode}")

            parsed = self._dump_sdk_response(response)
            self._append_debug_log(
                {
                    "event": "chat_http_response",
                    "request_id": request_id,
                    "step_index": step_index,
                    "api_mode": api_mode,
                    "status_code": 200,
                    "url": url,
                    "response_body": parsed,
                }
            )
            return parsed
        except APIStatusError as exc:
            body = self._stringify_error_body(exc.body)
            parsed_error_payload = self._coerce_sdk_error_payload(api_mode=api_mode, body=exc.body)
            if parsed_error_payload is None and body:
                parsed_error_payload = self._coerce_http_error_payload(api_mode=api_mode, body=body)
            self._append_debug_log(
                {
                    "event": "chat_http_error",
                    "request_id": request_id,
                    "step_index": step_index,
                    "api_mode": api_mode,
                    "status_code": exc.status_code,
                    "url": url,
                    "response_body": body,
                    "parsed_error_payload": parsed_error_payload,
                }
            )
            if parsed_error_payload is not None:
                return parsed_error_payload
            raise ModelRequestError(
                api_mode=api_mode,
                url=url,
                message="Model endpoint returned an HTTP error.",
                status_code=exc.status_code,
                response_body=body,
                retryable_in_auto=exc.status_code in {400, 404, 405, 415, 422},
            ) from exc
        except APITimeoutError as exc:
            raise ModelRequestError(
                api_mode=api_mode,
                url=url,
                message="Model endpoint timed out.",
                retryable_in_auto=False,
            ) from exc
        except APIConnectionError as exc:
            raise ModelRequestError(
                api_mode=api_mode,
                url=url,
                message=f"Failed to reach model endpoint: {exc}",
                retryable_in_auto=False,
            ) from exc
        finally:
            if client is not None:
                await client.close()

    def _append_debug_log(self, record: dict[str, Any]) -> None:
        try:
            self._chat_debug_log_path.parent.mkdir(parents=True, exist_ok=True)
            payload = {"ts": time.strftime("%Y-%m-%d %H:%M:%S"), **record}
            with self._chat_debug_log_path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(payload, ensure_ascii=False) + "\n")
        except Exception:
            pass

    def _append_event_log(self, record: dict[str, Any]) -> None:
        try:
            self._chat_event_log_path.parent.mkdir(parents=True, exist_ok=True)
            payload = {"ts": time.strftime("%Y-%m-%d %H:%M:%S"), **record}
            with self._chat_event_log_path.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(payload, ensure_ascii=False) + "\n")
        except Exception:
            pass

    def _truncate_text(self, value: str, limit: int = 240) -> str:
        compact = " ".join(value.split())
        if len(compact) <= limit:
            return compact
        return compact[: limit - 3] + "..."

    def _sanitize_observation(self, observation: Any) -> Any:
        if not isinstance(observation, dict):
            return observation

        sanitized = dict(observation)
        for key in ("screenshot_base64", "preview_image_base64"):
            image_base64 = sanitized.get(key)
            if isinstance(image_base64, str) and image_base64:
                sanitized[key] = f"<base64:{len(image_base64)} chars>"

        ocr_blocks = sanitized.get("ocr_blocks")
        if isinstance(ocr_blocks, list):
            trimmed_blocks: list[dict[str, Any]] = []
            for item in ocr_blocks[:12]:
                if not isinstance(item, dict):
                    continue
                block = dict(item)
                text = block.get("text")
                if isinstance(text, str):
                    block["text"] = self._truncate_text(text, limit=80)
                trimmed_blocks.append(block)
            sanitized["ocr_blocks"] = trimmed_blocks
            sanitized["ocr_blocks_truncated"] = len(ocr_blocks) > len(trimmed_blocks)

        detected_elements = sanitized.get("detected_elements")
        if isinstance(detected_elements, list) and len(detected_elements) > 20:
            sanitized["detected_elements"] = detected_elements[:20]
            sanitized["detected_elements_truncated"] = True

        return sanitized

    def _looks_like_observation(self, value: Any) -> bool:
        if not isinstance(value, dict):
            return False
        observation_markers = {
            "screenshot_base64",
            "screenshot_mime_type",
            "display",
            "ocr_blocks",
            "detected_elements",
            "timestamp",
        }
        return any(marker in value for marker in observation_markers)

    def _sanitize_tool_result(self, result: Any) -> Any:
        if not isinstance(result, dict):
            return result

        if self._looks_like_observation(result):
            return self._sanitize_observation(result)

        sanitized = dict(result)
        for key in ("screenshot_base64", "preview_image_base64"):
            image_base64 = sanitized.get(key)
            if isinstance(image_base64, str) and image_base64:
                sanitized[key] = f"<base64:{len(image_base64)} chars>"
        for key in ("observation", "before_observation"):
            if key in sanitized:
                sanitized[key] = self._sanitize_observation(sanitized.get(key))
        return sanitized

    def _tool_result_to_message_content(self, result: Any) -> tuple[str, list[dict[str, Any]]]:
        if not isinstance(result, dict):
            text = json.dumps(result, ensure_ascii=False)
            return text, [{"type": "input_text", "text": text}]

        text_payload = json.dumps(self._sanitize_tool_result(result), ensure_ascii=False)
        content_parts: list[dict[str, Any]] = [{"type": "input_text", "text": text_payload}]
        for image_data_url in self._extract_image_data_urls_from_tool_result(result):
            content_parts.append(
                {
                    "type": "input_image",
                    "image_url": image_data_url,
                    "detail": "high",
                }
            )
        return text_payload, content_parts

    def _extract_image_data_urls_from_tool_result(self, result: dict[str, Any]) -> list[str]:
        image_urls: list[str] = []
        max_images = max(0, int(os.getenv("CUA_MODEL_MAX_IMAGES_PER_TOOL_RESULT", "1")))
        if max_images == 0:
            return image_urls

        def add_image(base64_value: Any, mime_type: Any) -> None:
            if not isinstance(base64_value, str) or not base64_value.strip():
                return
            compressed = self._compress_image_for_model(base64_value.strip(), mime_type)
            if compressed:
                image_urls.append(compressed)

        add_image(result.get("preview_image_base64"), result.get("preview_image_mime_type"))

        observation = result.get("observation")
        if isinstance(observation, dict):
            add_image(observation.get("screenshot_base64"), observation.get("screenshot_mime_type"))

        add_image(result.get("screenshot_base64"), result.get("screenshot_mime_type"))

        before_observation = result.get("before_observation")
        if isinstance(before_observation, dict):
            add_image(
                before_observation.get("screenshot_base64"),
                before_observation.get("screenshot_mime_type"),
            )

        deduped: list[str] = []
        seen: set[str] = set()
        for item in image_urls:
            if item in seen:
                continue
            seen.add(item)
            deduped.append(item)
            if len(deduped) >= max_images:
                break
        return deduped

    def _compress_image_for_model(self, image_value: str, mime_type: Any) -> str | None:
        decoded = self._decode_image_payload(image_value, mime_type)
        if decoded is None:
            return None

        raw_bytes, resolved_mime = decoded
        try:
            with Image.open(io.BytesIO(raw_bytes)) as image:
                image.load()
                compressed_bytes, compressed_mime = self._transcode_image_for_model(
                    image=image,
                    fallback_mime=resolved_mime,
                )
        except Exception:
            compressed_bytes = raw_bytes
            compressed_mime = resolved_mime

        encoded = base64.b64encode(compressed_bytes).decode("ascii")
        return f"data:{compressed_mime};base64,{encoded}"

    def _decode_image_payload(self, image_value: str, mime_type: Any) -> tuple[bytes, str] | None:
        normalized = image_value.strip()
        resolved_mime = mime_type if isinstance(mime_type, str) and mime_type else "image/png"
        if normalized.startswith("data:"):
            header, sep, payload = normalized.partition(",")
            if not sep or ";base64" not in header:
                return None
            header_mime = header[5:].split(";", 1)[0].strip()
            if header_mime:
                resolved_mime = header_mime
            try:
                return base64.b64decode(payload, validate=False), resolved_mime
            except Exception:
                return None
        try:
            return base64.b64decode(normalized, validate=False), resolved_mime
        except Exception:
            return None

    def _transcode_image_for_model(self, image: Image.Image, fallback_mime: str) -> tuple[bytes, str]:
        max_edge = max(256, int(os.getenv("CUA_MODEL_IMAGE_MAX_EDGE", "1600")))
        max_bytes = max(32_768, int(os.getenv("CUA_MODEL_IMAGE_MAX_BYTES", "350000")))
        quality_steps = [70, 60, 50, 40, 30]
        resampling = getattr(getattr(Image, "Resampling", Image), "LANCZOS")

        working = image.copy()
        if max(working.size) > max_edge:
            working.thumbnail((max_edge, max_edge), resample=resampling)

        if "A" in working.getbands():
            background = Image.new("RGB", working.size, (255, 255, 255))
            alpha = working.getchannel("A")
            background.paste(working, mask=alpha)
            working = background
        elif working.mode != "RGB":
            working = working.convert("RGB")

        png_buffer = io.BytesIO()
        working.save(png_buffer, format="PNG", optimize=True)
        best_bytes = png_buffer.getvalue()
        best_mime = fallback_mime or "image/png"
        if len(best_bytes) <= max_bytes:
            return best_bytes, best_mime

        current = working
        while True:
            for quality in quality_steps:
                buffer = io.BytesIO()
                current.save(buffer, format="JPEG", quality=quality, optimize=True)
                candidate = buffer.getvalue()
                if len(candidate) < len(best_bytes):
                    best_bytes = candidate
                    best_mime = "image/jpeg"
                if len(candidate) <= max_bytes:
                    return candidate, "image/jpeg"

            if len(best_bytes) <= max_bytes or max(current.size) <= 768:
                return best_bytes, best_mime

            next_width = max(768, int(current.size[0] * 0.8))
            next_height = max(768, int(current.size[1] * 0.8))
            if (next_width, next_height) == current.size:
                return best_bytes, best_mime
            current = current.resize((next_width, next_height), resample=resampling)

    @contextmanager
    def _temporary_ocr_setting(self, enabled: bool):
        previous = os.environ.get("CUA_ENABLE_OCR")
        os.environ["CUA_ENABLE_OCR"] = "1" if enabled else "0"
        try:
            yield
        finally:
            if previous is None:
                os.environ.pop("CUA_ENABLE_OCR", None)
            else:
                os.environ["CUA_ENABLE_OCR"] = previous

    def _summarize_tool_trace(self, tool_trace: list[ToolInvocation]) -> str:
        if not tool_trace:
            return "这轮没有真正执行到工具动作。"

        lines: list[str] = []
        for item in tool_trace[-6:]:
            result = item.result if isinstance(item.result, dict) else {}
            if result.get("error"):
                lines.append(f"- `{item.name}` 失败：{result['error']}")
                continue

            message = result.get("message")
            if isinstance(message, str) and message.strip():
                lines.append(f"- `{item.name}`：{self._truncate_text(message, limit=120)}")
                continue

            raw_result = result.get("raw_result")
            if isinstance(raw_result, dict) and raw_result:
                lines.append(
                    f"- `{item.name}`：已执行，结果摘要 {json.dumps(raw_result, ensure_ascii=False)}"
                )
                continue

            lines.append(f"- `{item.name}`：已执行。")

        return "\n".join(lines)

    def _redact_client_options(self, options: dict[str, Any]) -> dict[str, Any]:
        redacted = dict(options)
        if "api_key" in redacted:
            redacted["api_key"] = "***"
        return redacted

    def _dump_sdk_response(self, response: Any) -> dict[str, Any]:
        if isinstance(response, dict):
            return response
        if hasattr(response, "model_dump"):
            return response.model_dump(mode="json")
        raise ModelRequestError(
            api_mode="unknown",
            url="sdk-response",
            message="Model endpoint returned an unsupported SDK response object.",
            response_body=repr(response),
            retryable_in_auto=False,
        )

    def _stringify_error_body(self, body: Any) -> str | None:
        if body is None:
            return None
        if isinstance(body, str):
            return body
        try:
            return json.dumps(body, ensure_ascii=False)
        except TypeError:
            return str(body)

    def _coerce_sdk_error_payload(self, api_mode: str, body: Any) -> dict[str, Any] | None:
        if not isinstance(body, dict):
            return None
        if api_mode == "responses":
            if body.get("object") == "response" or isinstance(body.get("output"), list):
                return body
            return None
        if api_mode == "chat_completions":
            if isinstance(body.get("choices"), list):
                return body
            return None
        return None

    def _normalize_chat_completion_payload(self, response: dict[str, Any], url: str) -> dict[str, Any]:
        choices = response.get("choices")
        if not isinstance(choices, list) or not choices:
            raise ModelRequestError(
                api_mode="chat_completions",
                url=url,
                message="Unexpected chat completions response shape: missing choices.",
                response_body=json.dumps(response, ensure_ascii=False),
                retryable_in_auto=True,
            )

        message = choices[0].get("message")
        if not isinstance(message, dict):
            raise ModelRequestError(
                api_mode="chat_completions",
                url=url,
                message="Unexpected chat completions response shape: missing message.",
                response_body=json.dumps(response, ensure_ascii=False),
                retryable_in_auto=True,
            )

        content = self._coerce_message_text(message.get("content"))
        tool_calls = [
            self._normalize_tool_call(item, fallback_index=index)
            for index, item in enumerate(message.get("tool_calls") or [], start=1)
        ]
        return {
            "content": content,
            "reasoning_content": self._coerce_message_text(message.get("reasoning_content")),
            "tool_calls": tool_calls,
            "response_error": None,
        }

    def _normalize_responses_payload(self, response: dict[str, Any], url: str) -> dict[str, Any]:
        output = response.get("output")
        if not isinstance(output, list):
            raise ModelRequestError(
                api_mode="responses",
                url=url,
                message="Unexpected responses payload shape: missing output array.",
                response_body=json.dumps(response, ensure_ascii=False),
                retryable_in_auto=True,
            )

        text_parts: list[str] = []
        tool_calls: list[dict[str, Any]] = []

        for index, item in enumerate(output, start=1):
            if not isinstance(item, dict):
                continue
            item_type = item.get("type")

            if item_type == "function_call":
                tool_calls.append(self._normalize_tool_call(item, fallback_index=index))
                continue

            if item_type == "message":
                text_parts.extend(self._extract_content_texts(item.get("content")))
                continue

            if item_type in {"output_text", "text"}:
                text = item.get("text")
                if isinstance(text, str) and text:
                    text_parts.append(text)

        if not text_parts and isinstance(response.get("output_text"), str):
            output_text = response.get("output_text", "").strip()
            if output_text:
                text_parts.append(output_text)

        return {
            "content": "\n".join(part for part in text_parts if part).strip(),
            "tool_calls": tool_calls,
            "response_error": response.get("error") if isinstance(response.get("error"), dict) else None,
        }

    def _coerce_http_error_payload(self, api_mode: str, body: str) -> dict[str, Any] | None:
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            return None

        if not isinstance(parsed, dict):
            return None

        if api_mode == "responses":
            if parsed.get("object") == "response" or isinstance(parsed.get("output"), list):
                return parsed
            return None

        if api_mode == "chat_completions":
            if isinstance(parsed.get("choices"), list):
                return parsed
            return None

        return None

    async def _build_no_tool_fallback(
        self,
        *,
        payload: ChatRequest,
        messages: list[ChatMessage],
        content: str,
        response_error: Any,
        tool_trace: list[ToolInvocation],
        request_id: str,
        step_index: int,
        event_callback: Any | None = None,
    ) -> ChatResponse | None:
        latest_user = self._latest_user_message_text(messages)
        if not self._conversation_likely_needs_tools(messages):
            return None

        normalized_content = self._normalize_reply_text(content)
        visual_blocked = self._reply_indicates_visual_block(normalized_content)
        if visual_blocked:
            visual_fallback = await self._try_visual_observation_fallback(
                latest_user=latest_user,
                tool_trace=tool_trace,
                model_name=payload.config.model,
                request_id=request_id,
                step_index=step_index,
                prior_reply=content,
                event_callback=event_callback,
            )
            if visual_fallback is not None:
                self._append_debug_log(
                    {
                        "event": "chat_run_finished_with_visual_fallback",
                        "request_id": request_id,
                        "step_index": step_index,
                        "reply": visual_fallback.reply,
                        "response_error": response_error,
                        "tool_trace": [item.model_dump() for item in visual_fallback.tool_trace],
                    }
                )
                return visual_fallback

        if normalized_content and not self._reply_is_non_answer_placeholder(normalized_content):
            return None

        filesystem_fallback = await self._try_filesystem_folder_fallback(
            latest_user=latest_user,
            tool_trace=tool_trace,
            model_name=payload.config.model,
            request_id=request_id,
            step_index=step_index,
            event_callback=event_callback,
        )
        if filesystem_fallback is not None:
            self._append_debug_log(
                {
                    "event": "chat_run_finished_with_programmatic_fallback",
                    "request_id": request_id,
                    "step_index": step_index,
                    "reply": filesystem_fallback.reply,
                    "response_error": response_error,
                    "tool_trace": [item.model_dump() for item in filesystem_fallback.tool_trace],
                }
            )
            return filesystem_fallback

        return None

    async def _try_filesystem_folder_fallback(
        self,
        *,
        latest_user: str,
        tool_trace: list[ToolInvocation],
        model_name: str,
        request_id: str,
        step_index: int,
        event_callback: Any | None = None,
    ) -> ChatResponse | None:
        if not hasattr(self.local_service, "find_paths") or not hasattr(self.local_service, "list_directory"):
            return None

        folder_query = self._extract_folder_query(latest_user)
        if folder_query is None:
            return None

        search_arguments = {
            "query": folder_query,
            "roots": [],
            "max_results": 20,
            "directories_only": True,
            "case_sensitive": False,
        }
        search_started_at = time.time()
        search_tool_id = self._next_tool_invocation_id(
            request_id=request_id,
            step_index=step_index,
            tool_name="find_paths",
            tool_trace=tool_trace,
        )
        await self._record_tool_event(
            event_callback=event_callback,
            request_id=request_id,
            step_index=step_index,
            tool_trace=tool_trace,
            tool_id=search_tool_id,
            tool_name="find_paths",
            arguments=search_arguments,
            started_at=search_started_at,
        )
        search_result = await self._dispatch_tool("find_paths", search_arguments)
        self._append_debug_log(
            {
                "event": "chat_programmatic_tool_invocation",
                "request_id": request_id,
                "step_index": step_index,
                "tool_name": "find_paths",
                "arguments": search_arguments,
                "result": search_result,
            }
        )
        await self._record_tool_event(
            event_callback=event_callback,
            request_id=request_id,
            step_index=step_index,
            tool_trace=tool_trace,
            tool_id=search_tool_id,
            tool_name="find_paths",
            arguments=search_arguments,
            raw_result=search_result,
            started_at=search_started_at,
        )

        matches = search_result.get("matches")
        if not isinstance(matches, list) or not matches:
            reply = f"我尝试直接在本机常见目录里搜索“{folder_query}”文件夹，但还没有找到匹配结果。"
            return ChatResponse(
                reply=reply,
                model=model_name,
                api_mode_used="programmatic",
                tool_trace=tool_trace,
            )

        selected_path = self._select_best_directory_match(folder_query, matches)
        list_arguments = {
            "path": selected_path,
            "include_hidden": False,
            "max_entries": 200,
        }
        list_started_at = time.time()
        list_tool_id = self._next_tool_invocation_id(
            request_id=request_id,
            step_index=step_index,
            tool_name="list_directory",
            tool_trace=tool_trace,
        )
        await self._record_tool_event(
            event_callback=event_callback,
            request_id=request_id,
            step_index=step_index,
            tool_trace=tool_trace,
            tool_id=list_tool_id,
            tool_name="list_directory",
            arguments=list_arguments,
            started_at=list_started_at,
        )
        list_result = await self._dispatch_tool("list_directory", list_arguments)
        self._append_debug_log(
            {
                "event": "chat_programmatic_tool_invocation",
                "request_id": request_id,
                "step_index": step_index,
                "tool_name": "list_directory",
                "arguments": list_arguments,
                "result": list_result,
            }
        )
        await self._record_tool_event(
            event_callback=event_callback,
            request_id=request_id,
            step_index=step_index,
            tool_trace=tool_trace,
            tool_id=list_tool_id,
            tool_name="list_directory",
            arguments=list_arguments,
            raw_result=list_result,
            started_at=list_started_at,
        )

        entries = list_result.get("entries")
        if not isinstance(entries, list):
            return None

        reply = self._format_directory_listing_reply(folder_query, selected_path, entries)
        return ChatResponse(
            reply=reply,
            model=model_name,
            api_mode_used="programmatic",
            tool_trace=tool_trace,
        )

    def _normalize_reply_text(self, content: str) -> str:
        return " ".join(content.strip().lower().split())

    def _build_initial_messages(self, payload: ChatRequest) -> list[ChatMessage]:
        messages = [ChatMessage(role="system", content=self._internal_system_prompt)]
        user_system_prompt = payload.config.system_prompt.strip()
        if user_system_prompt:
            messages.append(ChatMessage(role="system", content=user_system_prompt))
        messages.extend(payload.messages)
        return messages

    def _select_tool_choice(self, messages: list[ChatMessage]) -> str:
        if self._conversation_likely_needs_tools(messages):
            return "required"
        return "auto"

    def _reply_is_non_answer_placeholder(self, normalized_content: str) -> bool:
        placeholder_markers = (
            "检查完成",
            "done checking",
            "done",
            "已完成",
            "操作完成",
            "completed",
        )
        return normalized_content in placeholder_markers

    def _reply_indicates_visual_block(self, normalized_content: str) -> bool:
        if not normalized_content:
            return False
        markers = (
            "accessibility tree",
            "accessibility snapshot",
            "empty window",
            "empty windows",
            "no usable window",
            "could not read",
            "can't read",
            "unable to read",
            "unreliable",
            "unstable",
            "抓不到",
            "空窗口",
            "读不到",
            "无法直接读到",
            "读取不稳定",
            "不稳定",
            "不可靠",
            "可访问性树",
            "无可用的窗口",
        )
        return any(marker in normalized_content for marker in markers)

    def _extract_folder_query(self, latest_user: str) -> str | None:
        if not latest_user:
            return None
        lowered = latest_user.lower()
        folder_markers = ("文件夹", "folder", "目录", "directory")
        if not any(marker in lowered for marker in folder_markers):
            return None

        patterns = (
            r"看看(?:我)?\s*([A-Za-z0-9._\-\u4e00-\u9fff]+)\s*(?:这个)?文件夹",
            r"查看(?:我)?\s*([A-Za-z0-9._\-\u4e00-\u9fff]+)\s*(?:这个)?文件夹",
            r"([A-Za-z0-9._\-\u4e00-\u9fff]+)\s*(?:这个)?文件夹",
            r"folder\s+([A-Za-z0-9._\-]+)",
            r"directory\s+([A-Za-z0-9._\-]+)",
        )
        for pattern in patterns:
            match = re.search(pattern, latest_user, flags=re.IGNORECASE)
            if match:
                candidate = match.group(1).strip().strip("`'\"“”‘’")
                if candidate:
                    return candidate
        return None

    def _select_best_directory_match(self, query: str, matches: list[Any]) -> str:
        normalized_query = query.lower()
        exact_matches: list[str] = []
        string_matches = [item for item in matches if isinstance(item, str)]
        for path in string_matches:
            if Path(path).name.lower() == normalized_query:
                exact_matches.append(path)
        if exact_matches:
            return sorted(exact_matches, key=len)[0]
        return sorted(string_matches, key=len)[0]

    def _format_directory_listing_reply(self, query: str, path: str, entries: list[dict[str, Any]]) -> str:
        if not entries:
            return f"我已经找到“{query}”文件夹：`{path}`，当前里面是空的。"

        preview_items: list[str] = []
        for entry in entries[:20]:
            if not isinstance(entry, dict):
                continue
            name = entry.get("name")
            if not isinstance(name, str) or not name:
                continue
            suffix = "/" if entry.get("is_dir") else ""
            preview_items.append(f"- {name}{suffix}")

        body = "\n".join(preview_items) if preview_items else "- 无法解析目录项"
        return f"我已经找到“{query}”文件夹：`{path}`。\n里面目前有这些内容：\n{body}"

    async def _try_visual_observation_fallback(
        self,
        *,
        latest_user: str,
        tool_trace: list[ToolInvocation],
        model_name: str,
        request_id: str,
        step_index: int,
        prior_reply: str,
        event_callback: Any | None = None,
    ) -> ChatResponse | None:
        if not (
            hasattr(self.local_service, "observe")
            or hasattr(self.local_service, "observe_display")
            or hasattr(self.local_service, "observe_frontmost_window")
        ):
            return None

        target_hint = self._extract_visual_target_hint(latest_user)

        observation_candidates: list[tuple[str, dict[str, Any]]] = []
        if hasattr(self.local_service, "observe_frontmost_window"):
            observation_candidates.append(
                (
                    "observe_frontmost_window",
                    {
                        "max_depth": 2,
                        "max_children": 20,
                    },
                )
            )
        if hasattr(self.local_service, "observe"):
            observation_candidates.append(("observe", {}))
        elif hasattr(self.local_service, "observe_display"):
            observation_candidates.append(("observe_display", {}))

        observe_result: dict[str, Any] | None = None
        for tool_name, arguments in observation_candidates:
            observation_started_at = time.time()
            observation_tool_id = self._next_tool_invocation_id(
                request_id=request_id,
                step_index=step_index,
                tool_name=tool_name,
                tool_trace=tool_trace,
            )
            await self._record_tool_event(
                event_callback=event_callback,
                request_id=request_id,
                step_index=step_index,
                tool_trace=tool_trace,
                tool_id=observation_tool_id,
                tool_name=tool_name,
                arguments=arguments,
                started_at=observation_started_at,
            )
            candidate_result = await self._dispatch_tool(tool_name, arguments)
            self._append_debug_log(
                {
                    "event": "chat_programmatic_tool_invocation",
                    "request_id": request_id,
                    "step_index": step_index,
                    "tool_name": tool_name,
                    "arguments": arguments,
                    "result": candidate_result,
                }
            )
            await self._record_tool_event(
                event_callback=event_callback,
                request_id=request_id,
                step_index=step_index,
                tool_trace=tool_trace,
                tool_id=observation_tool_id,
                tool_name=tool_name,
                arguments=arguments,
                raw_result=candidate_result,
                started_at=observation_started_at,
            )
            observe_result = candidate_result
            if "error" not in candidate_result:
                ocr_blocks = candidate_result.get("ocr_blocks")
                screenshot_base64 = candidate_result.get("screenshot_base64")
                if (isinstance(ocr_blocks, list) and ocr_blocks) or screenshot_base64:
                    break

        if observe_result is None:
            return None

        if "error" in observe_result:
            reply = (
                f"{prior_reply}\n\n我继续尝试了窗口和屏幕观察，但这一步失败了：{observe_result['error']}"
                if prior_reply
                else f"我继续尝试了窗口和屏幕观察，但这一步失败了：{observe_result['error']}"
            )
            return ChatResponse(
                reply=reply,
                model=model_name,
                api_mode_used="programmatic",
                tool_trace=tool_trace,
            )

        ocr_blocks = observe_result.get("ocr_blocks")
        if not isinstance(ocr_blocks, list):
            return None

        matched_lines: list[str] = []
        preview_lines: list[str] = []
        for item in ocr_blocks:
            if not isinstance(item, dict):
                continue
            text = item.get("text")
            if not isinstance(text, str):
                continue
            cleaned = text.strip()
            if not cleaned:
                continue
            if len(preview_lines) < 8:
                preview_lines.append(cleaned)
            if target_hint and target_hint in cleaned:
                matched_lines.append(cleaned)

        if matched_lines:
            unique_lines = list(dict.fromkeys(matched_lines))
            body = "\n".join(f"- {line}" for line in unique_lines[:8])
            prefix = "我继续缩小到当前窗口并做了视觉检查"
            if observe_result.get("capture_scope") == "frontmost_window":
                prefix = "我继续聚焦到前台窗口并做了视觉检查"
            reply = f"{prefix}，找到了和“{target_hint}”相关的文字：\n{body}"
        elif preview_lines:
            unique_preview = list(dict.fromkeys(preview_lines))
            body = "\n".join(f"- {line}" for line in unique_preview[:8])
            if target_hint:
                reply = (
                    f"我继续做了窗口级视觉检查，但暂时还没在当前可见区域里找到“{target_hint}”。"
                    f"\n当前屏幕上能识别到的一些文字是：\n{body}"
                )
            else:
                reply = f"我继续做了窗口级视觉检查，当前屏幕上能识别到的一些文字是：\n{body}"
        else:
            if target_hint:
                reply = (
                    f"我继续做了窗口级视觉检查，但当前这张画面里还没识别到足够稳定的“{target_hint}”相关文字。"
                    " 如果你要，我下一步会继续缩小到更具体的聊天区域再试。"
                )
            else:
                reply = "我继续做了窗口级视觉检查，但这次没有识别到足够可用的文字。"

        return ChatResponse(
            reply=reply,
            model=model_name,
            api_mode_used="programmatic",
            tool_trace=tool_trace,
        )

    def _extract_visual_target_hint(self, latest_user: str) -> str | None:
        if not latest_user:
            return None
        patterns = (
            r"看看\s*([A-Za-z0-9._\-\u4e00-\u9fff]+)\s*说了什么",
            r"看下\s*([A-Za-z0-9._\-\u4e00-\u9fff]+)\s*说了什么",
            r"查看\s*([A-Za-z0-9._\-\u4e00-\u9fff]+)\s*说了什么",
            r"看看\s*([A-Za-z0-9._\-\u4e00-\u9fff]+)\s*发了什么",
        )
        for pattern in patterns:
            match = re.search(pattern, latest_user, flags=re.IGNORECASE)
            if match:
                candidate = match.group(1).strip().strip("`'\"“”‘’")
                if candidate:
                    return candidate
        return None

    def _should_force_tool_retry(
        self,
        *,
        messages: list[ChatMessage],
        content: str,
        forced_tool_retry_used: bool,
    ) -> bool:
        if forced_tool_retry_used:
            return False

        if not self._conversation_likely_needs_tools(messages):
            return False

        normalized_content = " ".join(content.lower().split())
        if not normalized_content:
            return True

        return self._assistant_reply_seems_like_pending_action(normalized_content)

    def _should_force_visual_retry(
        self,
        *,
        messages: list[ChatMessage],
        content: str,
        visual_retry_used: bool,
    ) -> bool:
        if visual_retry_used:
            return False

        if not self._conversation_likely_needs_tools(messages):
            return False

        normalized_content = " ".join(content.lower().split())
        if not normalized_content:
            return False

        visual_block_markers = (
            "accessibility tree",
            "accessibility snapshot",
            "empty window",
            "empty windows",
            "no usable window",
            "could not read",
            "can't read",
            "unable to read",
            "unreliable",
            "unstable",
            "抓不到",
            "空窗口",
            "读不到",
            "无法直接读到",
            "读取不稳定",
            "不稳定",
            "不可靠",
            "可访问性树",
            "无可用的窗口",
        )
        return any(marker in normalized_content for marker in visual_block_markers)

    def _is_disallowed_tool_use_error(self, response_error: Any) -> bool:
        if not isinstance(response_error, dict):
            return False
        codex_error_info = response_error.get("codex_error_info")
        if not isinstance(codex_error_info, dict):
            return False
        return codex_error_info.get("gateway_error") == "disallowed_tool_use"

    def _latest_user_message_text(self, messages: list[ChatMessage]) -> str:
        for message in reversed(messages):
            if message.role == "user" and message.content:
                return message.content
        return ""

    def _recent_user_messages(self, messages: list[ChatMessage], *, limit: int = 4) -> list[str]:
        recent_messages: list[str] = []
        for message in reversed(messages):
            if message.role == "user" and message.content:
                recent_messages.append(message.content)
                if len(recent_messages) >= limit:
                    break
        recent_messages.reverse()
        return recent_messages

    def _has_recent_tool_activity(self, messages: list[ChatMessage], *, limit: int = 12) -> bool:
        for message in reversed(messages[-limit:]):
            if message.role == "tool":
                return True
            if message.role == "assistant" and message.tool_calls:
                return True
        return False

    def _message_is_active_task_follow_up(self, content: str) -> bool:
        normalized = " ".join(content.lower().split())
        if not normalized:
            return False

        exact_follow_ups = {
            "继续",
            "继续吧",
            "接着",
            "然后呢",
            "下一步",
            "继续做",
            "别停",
        }
        if normalized in exact_follow_ups:
            return True

        follow_up_markers = (
            "你自己不能",
            "自己不能",
            "你直接",
            "直接去",
            "自己去",
            "切过去",
            "切到",
            "联系人",
            "聊天",
            "消息",
            "搜一下",
            "搜索一下",
            "找一下",
            "打开他的聊天",
            "继续做",
        )
        return any(marker in normalized for marker in follow_up_markers)

    def _conversation_likely_needs_tools(self, messages: list[ChatMessage]) -> bool:
        latest_user = self._latest_user_message_text(messages)
        if self._request_likely_needs_tools(latest_user):
            return True
        if not self._message_is_active_task_follow_up(latest_user):
            return False

        recent_users = self._recent_user_messages(messages)
        prior_user_messages = recent_users[:-1] if recent_users else []
        recent_direct_request = any(
            self._request_likely_needs_tools(message) for message in prior_user_messages
        )
        return recent_direct_request or self._has_recent_tool_activity(messages)

    def _assistant_reply_seems_like_pending_action(self, normalized_content: str) -> bool:
        if not normalized_content:
            return False

        plan_like_markers = (
            "i will",
            "i'll",
            "let me",
            "first,",
            "first ",
            "next, i'll",
            "next i will",
            "going to",
            "use the tool",
            "use the tools",
            "desktop tool",
            "desktop tools",
            "i can inspect",
            "i can check",
            "i'll open",
            "i'll search",
            "我会",
            "接下来我会",
            "我先",
            "让我",
            "我将",
            "我来",
            "我这就",
            "马上",
            "马上把",
            "先确认",
            "先检查",
            "先看",
            "先打开",
            "先切到",
            "去搜索",
            "去找",
            "去打开",
            "直接用",
            "工具",
            "告诉我路径",
            "完整路径",
            "告诉我它在哪",
            "你可以先告诉我",
            "如果你不确定路径",
            "你只要回",
            "给我一个提示",
            "先告诉我",
            "告诉我 project",
            "where it is",
            "tell me the path",
            "full path",
            "if you don't know the path",
        )
        return any(marker in normalized_content for marker in plan_like_markers)

    def _build_no_tool_diagnostics(
        self,
        *,
        messages: list[ChatMessage],
        content: str,
        forced_tool_retry_used: bool,
        visual_retry_used: bool,
    ) -> dict[str, Any]:
        latest_user = self._latest_user_message_text(messages)
        recent_users = self._recent_user_messages(messages)
        normalized_content = " ".join(content.lower().split())
        latest_user_needs_tools = self._request_likely_needs_tools(latest_user)
        follow_up_to_desktop_task = self._message_is_active_task_follow_up(latest_user)
        recent_direct_tool_request = any(
            self._request_likely_needs_tools(message) for message in recent_users[:-1]
        )
        recent_tool_activity = self._has_recent_tool_activity(messages)
        active_desktop_task = self._conversation_likely_needs_tools(messages)
        reply_is_plan_like = self._assistant_reply_seems_like_pending_action(normalized_content)
        reply_is_visual_blocked = self._reply_indicates_visual_block(normalized_content)
        should_force_tool_retry = (
            (not forced_tool_retry_used)
            and active_desktop_task
            and ((not normalized_content) or reply_is_plan_like)
        )
        should_force_visual_retry = (
            (not visual_retry_used) and active_desktop_task and reply_is_visual_blocked
        )
        return {
            "latest_user": latest_user,
            "recent_user_messages": recent_users,
            "latest_user_needs_tools": latest_user_needs_tools,
            "follow_up_to_desktop_task": follow_up_to_desktop_task,
            "recent_direct_tool_request": recent_direct_tool_request,
            "recent_tool_activity": recent_tool_activity,
            "active_desktop_task": active_desktop_task,
            "reply_is_plan_like": reply_is_plan_like,
            "reply_is_visual_blocked": reply_is_visual_blocked,
            "forced_tool_retry_used": forced_tool_retry_used,
            "visual_retry_used": visual_retry_used,
            "should_force_tool_retry": should_force_tool_retry,
            "should_force_visual_retry": should_force_visual_retry,
        }

    def _request_likely_needs_tools(self, content: str) -> bool:
        normalized = content.lower()
        if not normalized:
            return False

        tool_request_markers = (
            "finder",
            "safari",
            "folder",
            "window",
            "desktop",
            "computer",
            "app",
            "file",
            "open",
            "click",
            "inspect",
            "check",
            "look at",
            "search",
            "lark",
            "chrome",
            "google chrome",
            "打开",
            "点击",
            "检查",
            "看看",
            "查看",
            "查一下",
            "找一下",
            "搜一下",
            "搜索",
            "切到",
            "切过去",
            "输入",
            "键入",
            "按下",
            "滚动",
            "联系人",
            "聊天",
            "消息",
            "文件夹",
            "窗口",
            "桌面",
            "电脑",
            "应用",
            "文件",
            "飞书",
        )
        return any(marker in normalized for marker in tool_request_markers)

    async def _dispatch_tool(self, tool_name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        try:
            if tool_name == "doctor":
                return {
                    "permissions": self.local_service.controller.get_permission_diagnostics(),
                    "display": self.local_service.controller.get_display_metadata().model_dump(),
                    "displays": [
                        display.model_dump()
                        for display in self.local_service.controller.list_display_metadata()
                    ],
                }

            if tool_name == "pointer_state":
                return self.local_service.get_pointer_state().model_dump()

            if tool_name == "observe":
                return self.local_service.observe_display(display_id=arguments.get("display_id")).model_dump()

            if tool_name == "observe_display":
                return self.local_service.observe_display(display_id=arguments.get("display_id")).model_dump()

            if tool_name == "observe_region":
                from shared.schemas.desktop import CaptureRegion

                return self.local_service.observe_region(
                    region=CaptureRegion(
                        left=arguments["left"],
                        top=arguments["top"],
                        width=arguments["width"],
                        height=arguments["height"],
                    ),
                    display_id=arguments.get("display_id"),
                ).model_dump()

            if tool_name == "observe_frontmost_window":
                return self.local_service.observe_frontmost_window(
                    app_name=arguments.get("app_name"),
                    bundle_id=arguments.get("bundle_id"),
                    max_depth=arguments.get("max_depth", 2),
                    max_children=arguments.get("max_children", 20),
                ).model_dump()

            if tool_name == "find_paths":
                return self.local_service.find_paths(
                    LocalPathSearchRequest(
                        query=arguments["query"],
                        roots=arguments.get("roots", []),
                        max_results=arguments.get("max_results", 20),
                        directories_only=arguments.get("directories_only", True),
                        case_sensitive=arguments.get("case_sensitive", False),
                    )
                ).model_dump()

            if tool_name == "list_directory":
                return self.local_service.list_directory(
                    DirectoryListRequest(
                        path=arguments["path"],
                        include_hidden=arguments.get("include_hidden", False),
                        max_entries=arguments.get("max_entries", 200),
                    )
                ).model_dump()

            if tool_name == "list_apps":
                return self.local_service.list_apps(query=arguments.get("query")).model_dump()

            if tool_name == "frontmost_app":
                return self.local_service.get_frontmost_app().model_dump()

            if tool_name == "accessibility_snapshot":
                from shared.schemas.desktop import AccessibilitySnapshotRequest

                return self.local_service.get_accessibility_snapshot(
                    AccessibilitySnapshotRequest(
                        app_name=arguments.get("app_name"),
                        bundle_id=arguments.get("bundle_id"),
                        max_depth=arguments.get("max_depth", 3),
                        max_children=arguments.get("max_children", 25),
                        use_cached=arguments.get("use_cached", False),
                    )
                ).model_dump()

            if tool_name == "click_element":
                return self.local_service.click_element(
                    ElementActionRequest(
                        app_name=arguments.get("app_name"),
                        bundle_id=arguments.get("bundle_id"),
                        element_id=arguments["element_id"],
                        button=arguments.get("button", "left"),
                        clicks=arguments.get("clicks", 1),
                        snapshot_max_depth=arguments.get("snapshot_max_depth", 4),
                        snapshot_max_children=arguments.get("snapshot_max_children", 40),
                        use_cached_snapshot=arguments.get("use_cached_snapshot", True),
                    )
                ).model_dump()

            if tool_name == "press_element":
                return self.local_service.press_element(
                    PressElementRequest(
                        app_name=arguments.get("app_name"),
                        bundle_id=arguments.get("bundle_id"),
                        element_id=arguments["element_id"],
                        snapshot_max_depth=arguments.get("snapshot_max_depth", 4),
                        snapshot_max_children=arguments.get("snapshot_max_children", 40),
                        use_cached_snapshot=arguments.get("use_cached_snapshot", True),
                        fallback_to_click=arguments.get("fallback_to_click", True),
                    )
                ).model_dump()

            if tool_name == "perform_element_action":
                return self.local_service.perform_element_action(
                    PerformElementActionRequest(
                        app_name=arguments.get("app_name"),
                        bundle_id=arguments.get("bundle_id"),
                        element_id=arguments["element_id"],
                        action_name=arguments["action_name"],
                        snapshot_max_depth=arguments.get("snapshot_max_depth", 4),
                        snapshot_max_children=arguments.get("snapshot_max_children", 40),
                        use_cached_snapshot=arguments.get("use_cached_snapshot", True),
                        fallback_to_click=arguments.get("fallback_to_click", False),
                    )
                ).model_dump()

            if tool_name == "type_into_element":
                return self.local_service.type_into_element(
                    TypeIntoElementRequest(
                        app_name=arguments.get("app_name"),
                        bundle_id=arguments.get("bundle_id"),
                        element_id=arguments["element_id"],
                        text=arguments["text"],
                        click_first=arguments.get("click_first", True),
                        clear_first=arguments.get("clear_first", False),
                        typing_interval=arguments.get("typing_interval", 0.02),
                        snapshot_max_depth=arguments.get("snapshot_max_depth", 4),
                        snapshot_max_children=arguments.get("snapshot_max_children", 40),
                        use_cached_snapshot=arguments.get("use_cached_snapshot", True),
                    )
                ).model_dump()

            if tool_name == "set_value":
                return self.local_service.set_value_for_element(
                    SetValueElementRequest(
                        app_name=arguments.get("app_name"),
                        bundle_id=arguments.get("bundle_id"),
                        element_id=arguments["element_id"],
                        text=arguments["text"],
                        snapshot_max_depth=arguments.get("snapshot_max_depth", 4),
                        snapshot_max_children=arguments.get("snapshot_max_children", 40),
                        use_cached_snapshot=arguments.get("use_cached_snapshot", True),
                        fallback_to_typing=arguments.get("fallback_to_typing", True),
                        click_first_on_fallback=arguments.get("click_first_on_fallback", True),
                        clear_first_on_fallback=arguments.get("clear_first_on_fallback", False),
                        typing_interval=arguments.get("typing_interval", 0.02),
                    )
                ).model_dump()

            if tool_name == "focus_element":
                return self.local_service.focus_element(
                    FocusElementRequest(
                        app_name=arguments.get("app_name"),
                        bundle_id=arguments.get("bundle_id"),
                        element_id=arguments["element_id"],
                        snapshot_max_depth=arguments.get("snapshot_max_depth", 4),
                        snapshot_max_children=arguments.get("snapshot_max_children", 40),
                        use_cached_snapshot=arguments.get("use_cached_snapshot", True),
                    )
                ).model_dump()

            if tool_name == "preview_element":
                return self.local_service.preview_element(
                    ElementPreviewRequest(
                        app_name=arguments.get("app_name"),
                        bundle_id=arguments.get("bundle_id"),
                        element_id=arguments["element_id"],
                        crop_size=arguments.get("crop_size", 180),
                        snapshot_max_depth=arguments.get("snapshot_max_depth", 4),
                        snapshot_max_children=arguments.get("snapshot_max_children", 40),
                        use_cached_snapshot=arguments.get("use_cached_snapshot", True),
                    )
                ).model_dump()

            if tool_name == "open_url":
                from executor.client.main import open_url_in_safari

                return await run_in_threadpool(
                    open_url_in_safari,
                    self.local_service.controller,
                    arguments["url"],
                    arguments.get("app_name", "Safari"),
                )

            if tool_name == "search_web":
                from executor.client.main import build_search_url, open_url_in_safari

                url = build_search_url(arguments["query"], arguments.get("engine", "google"))
                result = await run_in_threadpool(
                    open_url_in_safari,
                    self.local_service.controller,
                    url,
                    arguments.get("app_name", "Safari"),
                )
                return {
                    "query": arguments["query"],
                    "engine": arguments.get("engine", "google"),
                    **result,
                }

            if tool_name == "activate_app":
                from shared.schemas.desktop import AppControlRequest

                return self.local_service.activate_app(
                    AppControlRequest(
                        app_name=arguments.get("app_name"),
                        bundle_id=arguments.get("bundle_id"),
                        wait_seconds=arguments.get("wait_seconds", 0.75),
                    )
                ).model_dump()

            if tool_name == "launch_app":
                from shared.schemas.desktop import AppControlRequest

                return self.local_service.launch_app(
                    AppControlRequest(
                        app_name=arguments.get("app_name"),
                        bundle_id=arguments.get("bundle_id"),
                        wait_seconds=arguments.get("wait_seconds", 1.0),
                    )
                ).model_dump()

            if tool_name == "preview_target":
                payload = TargetPreviewRequest(
                    target=CoordinateTarget(
                        x=arguments["x"],
                        y=arguments["y"],
                        display_id=arguments.get("display_id", "main"),
                    ),
                    crop_size=arguments.get("crop_size", 160),
                    include_preview_image=arguments.get("include_preview_image", False),
                )
                return self.local_service.preview_target(payload).model_dump()

            if tool_name == "click_debug":
                action_name = "right_click" if arguments.get("button") == "right" else "click"
                payload = ExecuteActionRequest(
                    action=ClickAction(
                        action=action_name,
                        target=CoordinateTarget(
                            x=arguments["x"],
                            y=arguments["y"],
                            display_id=arguments.get("display_id", "main"),
                        ),
                        button=arguments.get("button", "left"),
                    ),
                    capture_after=True,
                    verify_action=True,
                    debug_output_dir=arguments["debug_output_dir"],
                )
                return self.local_service.execute(payload).model_dump()

            if tool_name == "click_at":
                action_name = "right_click" if arguments.get("button") == "right" else "click"
                payload = ExecuteActionRequest(
                    action=ClickAction(
                        action=action_name,
                        target=CoordinateTarget(
                            x=arguments["x"],
                            y=arguments["y"],
                            display_id=arguments.get("display_id", "main"),
                        ),
                        button=arguments.get("button", "left"),
                    ),
                    capture_after=arguments.get("capture_after", True),
                    verify_action=arguments.get("verify_action", True),
                )
                return self.local_service.execute(payload).model_dump()

            if tool_name == "click_in_viewport":
                return self.local_service.click_in_last_observation(
                    x=arguments["x"],
                    y=arguments["y"],
                    button=arguments.get("button", "left"),
                    clicks=arguments.get("clicks", 1),
                )

            if tool_name == "type_text":
                payload = ExecuteActionRequest(
                    action=TypeTextAction(
                        action="type_text",
                        text=arguments["text"],
                        interval=arguments.get("interval", 0.02),
                    ),
                    capture_after=arguments.get("capture_after", True),
                    verify_action=False,
                )
                return self.local_service.execute(payload).model_dump()

            if tool_name == "press_key":
                payload = ExecuteActionRequest(
                    action=PressKeyAction(
                        action="press_key",
                        key=arguments["key"],
                    ),
                    capture_after=arguments.get("capture_after", True),
                    verify_action=False,
                )
                return self.local_service.execute(payload).model_dump()

            if tool_name == "hotkey":
                payload = ExecuteActionRequest(
                    action=HotkeyAction(
                        action="hotkey",
                        keys=arguments["keys"],
                    ),
                    capture_after=arguments.get("capture_after", True),
                    verify_action=False,
                )
                return self.local_service.execute(payload).model_dump()

            if tool_name == "scroll":
                payload = ExecuteActionRequest(
                    action=ScrollAction(
                        action="scroll",
                        direction=arguments.get("direction", "down"),
                        amount=arguments.get("amount", 400),
                    ),
                    capture_after=arguments.get("capture_after", True),
                    verify_action=False,
                )
                return self.local_service.execute(payload).model_dump()

            return {"error": f"Unsupported tool: {tool_name}"}
        except DesktopDependencyError as exc:
            return {"error": str(exc)}
        except Exception as exc:  # pragma: no cover - defensive path
            return {"error": str(exc)}

    def _serialize_chat_completion_message(self, message: ChatMessage) -> dict[str, Any]:
        content_value: Any = message.content
        if message.content_parts:
            content_value = self._to_chat_completion_content_parts(message.content_parts)
        data: dict[str, Any] = {
            "role": message.role,
            "content": content_value,
        }
        if message.role == "assistant" and message.reasoning_content:
            data["reasoning_content"] = message.reasoning_content
        if message.role == "assistant" and message.tool_calls:
            data["content"] = content_value if content_value else None
            data["tool_calls"] = message.tool_calls
        if message.name:
            data["name"] = message.name
        if message.tool_call_id:
            data["tool_call_id"] = message.tool_call_id
        return data

    def _to_chat_completion_content_parts(self, content_parts: list[dict[str, Any]]) -> list[dict[str, Any]]:
        converted: list[dict[str, Any]] = []
        for part in content_parts:
            if not isinstance(part, dict):
                continue
            part_type = part.get("type")
            if part_type in {"input_text", "output_text", "text"}:
                text = part.get("text")
                if isinstance(text, str):
                    converted.append({"type": "text", "text": text})
                continue
            if part_type in {"input_image", "image_url"}:
                image_url = part.get("image_url")
                if isinstance(image_url, str) and image_url:
                    converted.append(
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_url,
                                "detail": part.get("detail", "high"),
                            },
                        }
                    )
        return converted

    def _serialize_responses_input(self, messages: list[ChatMessage]) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []

        for message in messages:
            if message.role in {"system", "user", "assistant"} and (message.content or message.content_parts):
                if message.content_parts:
                    content_items = message.content_parts
                else:
                    content_type = "output_text" if message.role == "assistant" else "input_text"
                    content_items = [{"type": content_type, "text": message.content}]
                items.append(
                    {
                        "role": message.role,
                        "content": content_items,
                    }
                )

            if message.role == "assistant" and message.tool_calls:
                for tool_call in message.tool_calls:
                    function = tool_call.get("function") or {}
                    item: dict[str, Any] = {
                        "type": "function_call",
                        "call_id": tool_call.get("call_id") or tool_call.get("id"),
                        "name": function.get("name"),
                        "arguments": function.get("arguments") or "{}",
                    }
                    if tool_call.get("id"):
                        item["id"] = tool_call["id"]
                    items.append(item)

            if message.role == "tool":
                output: Any = message.content
                if message.content_parts:
                    output = message.content_parts
                items.append(
                    {
                        "type": "function_call_output",
                        "call_id": message.tool_call_id,
                        "output": output,
                    }
                )

        return items

    def _normalize_tool_call(self, item: dict[str, Any], fallback_index: int) -> dict[str, Any]:
        if "function" in item and isinstance(item["function"], dict):
            function = item["function"]
            name = function.get("name")
            raw_arguments = function.get("arguments") or "{}"
        else:
            name = item.get("name")
            raw_arguments = item.get("arguments") or "{}"

        if not isinstance(name, str) or not name:
            raise ModelRequestError(
                api_mode="responses" if item.get("type") == "function_call" else "chat_completions",
                url="",
                message="Tool call is missing a function name.",
                response_body=json.dumps(item, ensure_ascii=False),
                retryable_in_auto=True,
            )

        if not isinstance(raw_arguments, str):
            raw_arguments = json.dumps(raw_arguments, ensure_ascii=False)

        tool_id = item.get("id") or item.get("call_id") or f"tool_call_{fallback_index}"
        call_id = item.get("call_id") or tool_id
        return {
            "id": tool_id,
            "type": "function",
            "call_id": call_id,
            "function": {
                "name": name,
                "arguments": raw_arguments,
            },
        }

    def _decode_tool_arguments(self, tool_name: str, raw_arguments: str) -> dict[str, Any]:
        try:
            parsed = json.loads(raw_arguments or "{}")
        except json.JSONDecodeError as exc:
            raise ValueError(f"Tool call {tool_name} returned invalid JSON arguments: {raw_arguments}") from exc

        if not isinstance(parsed, dict):
            raise ValueError(f"Tool call {tool_name} must return a JSON object of arguments.")
        return parsed

    def _coerce_message_text(self, content: Any) -> str:
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "\n".join(self._extract_content_texts(content)).strip()
        return ""

    def _extract_content_texts(self, content: Any) -> list[str]:
        if isinstance(content, str):
            return [content]
        if not isinstance(content, list):
            return []

        texts: list[str] = []
        for item in content:
            if isinstance(item, str):
                texts.append(item)
                continue
            if not isinstance(item, dict):
                continue

            item_type = item.get("type")
            if item_type in {"input_text", "output_text", "text"}:
                text = item.get("text")
                if isinstance(text, str) and text:
                    texts.append(text)
                continue

            if item_type == "refusal":
                refusal = item.get("refusal")
                if isinstance(refusal, str) and refusal:
                    texts.append(refusal)

        return texts

    def _build_chat_completion_tools(self) -> list[dict[str, Any]]:
        return [
            {
                "type": "function",
                "function": {
                    "name": "finish",
                    "description": "Explicitly finish the current task, report a blocking issue, or ask for a short user reply.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "message": {"type": "string"},
                            "outcome": {
                                "type": "string",
                                "enum": ["completed", "blocked", "needs_user_input"],
                                "default": "completed",
                            },
                        },
                        "required": ["message"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "doctor",
                    "description": "Inspect local desktop permissions and display availability.",
                    "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "pointer_state",
                    "description": "Read the current pointer position and display metadata.",
                    "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "observe",
                    "description": "Capture a screenshot observation. Optionally target a specific display_id.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "display_id": {"type": "string", "default": "main"},
                        },
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "observe_display",
                    "description": "Capture a screenshot observation for a specific display_id. Use this first on multi-display setups.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "display_id": {"type": "string", "default": "main"},
                        },
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "observe_region",
                    "description": "Capture a screenshot observation for a logical region inside a specific display. Use this to zoom into a candidate area before clicking.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "left": {"type": "integer"},
                            "top": {"type": "integer"},
                            "width": {"type": "integer"},
                            "height": {"type": "integer"},
                            "display_id": {"type": "string", "default": "main"},
                        },
                        "required": ["left", "top", "width", "height"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "observe_frontmost_window",
                    "description": "Capture a screenshot observation cropped to the focused window of the target app or current frontmost app. Prefer this for precise in-app clicking.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "app_name": {"type": "string"},
                            "bundle_id": {"type": "string"},
                            "max_depth": {"type": "integer", "default": 2},
                            "max_children": {"type": "integer", "default": 20},
                        },
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "find_paths",
                    "description": "Search local filesystem paths by name. Useful when app accessibility data is unavailable.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"},
                            "roots": {"type": "array", "items": {"type": "string"}},
                            "max_results": {"type": "integer", "default": 20},
                            "directories_only": {"type": "boolean", "default": True},
                            "case_sensitive": {"type": "boolean", "default": False},
                        },
                        "required": ["query"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "list_directory",
                    "description": "List entries in a local directory path directly from the filesystem.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string"},
                            "include_hidden": {"type": "boolean", "default": False},
                            "max_entries": {"type": "integer", "default": 200},
                        },
                        "required": ["path"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "list_apps",
                    "description": "List installed and running applications on the local computer.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"},
                        },
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "frontmost_app",
                    "description": "Inspect which application is currently frontmost.",
                    "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "accessibility_snapshot",
                    "description": "Capture a lightweight accessibility tree for a target app or the current frontmost app.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "app_name": {"type": "string"},
                            "bundle_id": {"type": "string"},
                            "max_depth": {"type": "integer", "default": 3},
                            "max_children": {"type": "integer", "default": 25},
                            "use_cached": {"type": "boolean", "default": False},
                        },
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "click_element",
                    "description": "Click a UI element by element_id from a recent or reproducible accessibility snapshot.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "app_name": {"type": "string"},
                            "bundle_id": {"type": "string"},
                            "element_id": {"type": "string"},
                            "button": {"type": "string", "enum": ["left", "middle", "right"], "default": "left"},
                            "clicks": {"type": "integer", "default": 1},
                            "snapshot_max_depth": {"type": "integer", "default": 4},
                            "snapshot_max_children": {"type": "integer", "default": 40},
                            "use_cached_snapshot": {"type": "boolean", "default": True},
                        },
                        "required": ["element_id"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "press_element",
                    "description": "Invoke a UI element by element_id using accessibility action first, then click fallback if needed.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "app_name": {"type": "string"},
                            "bundle_id": {"type": "string"},
                            "element_id": {"type": "string"},
                            "snapshot_max_depth": {"type": "integer", "default": 4},
                            "snapshot_max_children": {"type": "integer", "default": 40},
                            "use_cached_snapshot": {"type": "boolean", "default": True},
                            "fallback_to_click": {"type": "boolean", "default": True},
                        },
                        "required": ["element_id"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "perform_element_action",
                    "description": "Perform a named accessibility action such as AXPress or AXShowMenu on a UI element by element_id.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "app_name": {"type": "string"},
                            "bundle_id": {"type": "string"},
                            "element_id": {"type": "string"},
                            "action_name": {"type": "string"},
                            "snapshot_max_depth": {"type": "integer", "default": 4},
                            "snapshot_max_children": {"type": "integer", "default": 40},
                            "use_cached_snapshot": {"type": "boolean", "default": True},
                            "fallback_to_click": {"type": "boolean", "default": False},
                        },
                        "required": ["element_id", "action_name"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "type_into_element",
                    "description": "Focus a UI element by element_id and type text into it.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "app_name": {"type": "string"},
                            "bundle_id": {"type": "string"},
                            "element_id": {"type": "string"},
                            "text": {"type": "string"},
                            "click_first": {"type": "boolean", "default": True},
                            "clear_first": {"type": "boolean", "default": False},
                            "typing_interval": {"type": "number", "default": 0.02},
                            "snapshot_max_depth": {"type": "integer", "default": 4},
                            "snapshot_max_children": {"type": "integer", "default": 40},
                            "use_cached_snapshot": {"type": "boolean", "default": True},
                        },
                        "required": ["element_id", "text"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "set_value",
                    "description": "Set the value of a text-like UI element by element_id using accessibility APIs first, then typing fallback if needed.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "app_name": {"type": "string"},
                            "bundle_id": {"type": "string"},
                            "element_id": {"type": "string"},
                            "text": {"type": "string"},
                            "snapshot_max_depth": {"type": "integer", "default": 4},
                            "snapshot_max_children": {"type": "integer", "default": 40},
                            "use_cached_snapshot": {"type": "boolean", "default": True},
                            "fallback_to_typing": {"type": "boolean", "default": True},
                            "click_first_on_fallback": {"type": "boolean", "default": True},
                            "clear_first_on_fallback": {"type": "boolean", "default": False},
                            "typing_interval": {"type": "number", "default": 0.02},
                        },
                        "required": ["element_id", "text"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "focus_element",
                    "description": "Focus a UI element by element_id.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "app_name": {"type": "string"},
                            "bundle_id": {"type": "string"},
                            "element_id": {"type": "string"},
                            "snapshot_max_depth": {"type": "integer", "default": 4},
                            "snapshot_max_children": {"type": "integer", "default": 40},
                            "use_cached_snapshot": {"type": "boolean", "default": True},
                        },
                        "required": ["element_id"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "preview_element",
                    "description": "Capture a marked preview image centered on a UI element by element_id.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "app_name": {"type": "string"},
                            "bundle_id": {"type": "string"},
                            "element_id": {"type": "string"},
                            "crop_size": {"type": "integer", "default": 180},
                            "snapshot_max_depth": {"type": "integer", "default": 4},
                            "snapshot_max_children": {"type": "integer", "default": 40},
                            "use_cached_snapshot": {"type": "boolean", "default": True},
                        },
                        "required": ["element_id"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "launch_app",
                    "description": "Launch an application by name or bundle id.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "app_name": {"type": "string"},
                            "bundle_id": {"type": "string"},
                            "wait_seconds": {"type": "number", "default": 1.0},
                        },
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "activate_app",
                    "description": "Bring an application to the foreground by name or bundle id.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "app_name": {"type": "string"},
                            "bundle_id": {"type": "string"},
                            "wait_seconds": {"type": "number", "default": 0.75},
                        },
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "open_url",
                    "description": "Open a URL in Safari.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "url": {"type": "string"},
                            "app_name": {"type": "string", "default": "Safari"},
                        },
                        "required": ["url"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "search_web",
                    "description": "Search the web in Safari.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"},
                            "engine": {"type": "string", "enum": ["google", "bing"], "default": "google"},
                            "app_name": {"type": "string", "default": "Safari"},
                        },
                        "required": ["query"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "preview_target",
                    "description": "Preview where a logical target would land on screen.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "x": {"type": "number"},
                            "y": {"type": "number"},
                            "display_id": {"type": "string", "default": "main"},
                            "crop_size": {"type": "integer", "default": 160},
                            "include_preview_image": {"type": "boolean", "default": False},
                        },
                        "required": ["x", "y"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "click_debug",
                    "description": "Execute a click and export debug artifacts.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "x": {"type": "number"},
                            "y": {"type": "number"},
                            "display_id": {"type": "string", "default": "main"},
                            "button": {
                                "type": "string",
                                "enum": ["left", "right", "middle"],
                                "default": "left",
                            },
                            "debug_output_dir": {"type": "string"},
                        },
                        "required": ["x", "y", "debug_output_dir"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "click_at",
                    "description": "Click a logical screen coordinate directly. Use observe or preview_target first when you need to confirm a target.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "x": {"type": "number"},
                            "y": {"type": "number"},
                            "display_id": {"type": "string", "default": "main"},
                            "button": {
                                "type": "string",
                                "enum": ["left", "right", "middle"],
                                "default": "left",
                            },
                            "capture_after": {"type": "boolean", "default": True},
                            "verify_action": {"type": "boolean", "default": True},
                        },
                        "required": ["x", "y"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "click_in_viewport",
                    "description": "Click using image-relative coordinates inside the most recent observation screenshot. Prefer this after observe_frontmost_window or observe_region.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "x": {"type": "number"},
                            "y": {"type": "number"},
                            "button": {
                                "type": "string",
                                "enum": ["left", "right", "middle"],
                                "default": "left",
                            },
                            "clicks": {"type": "integer", "default": 1},
                        },
                        "required": ["x", "y"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "type_text",
                    "description": "Type literal text using the keyboard into the currently focused app.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "text": {"type": "string"},
                            "interval": {"type": "number", "default": 0.02},
                            "capture_after": {"type": "boolean", "default": True},
                        },
                        "required": ["text"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "press_key",
                    "description": "Press a single key in the currently focused app.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "key": {"type": "string"},
                            "capture_after": {"type": "boolean", "default": True},
                        },
                        "required": ["key"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "hotkey",
                    "description": "Press a hotkey chord such as command+l or command+shift+k in the currently focused app.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "keys": {"type": "array", "items": {"type": "string"}},
                            "capture_after": {"type": "boolean", "default": True},
                        },
                        "required": ["keys"],
                        "additionalProperties": False,
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "scroll",
                    "description": "Scroll the currently focused app view up or down.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "direction": {"type": "string", "enum": ["up", "down"], "default": "down"},
                            "amount": {"type": "integer", "default": 400},
                            "capture_after": {"type": "boolean", "default": True},
                        },
                        "additionalProperties": False,
                    },
                },
            },
        ]

    def _build_responses_tools(self) -> list[dict[str, Any]]:
        tools: list[dict[str, Any]] = []
        for entry in self._build_chat_completion_tools():
            function = entry["function"]
            tools.append(
                {
                    "type": "function",
                    "name": function["name"],
                    "description": function["description"],
                    "parameters": function["parameters"],
                }
            )
        return tools
