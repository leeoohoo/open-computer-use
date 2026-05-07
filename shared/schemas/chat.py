from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ModelConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str
    base_url: str
    api_key: str
    api_mode: Literal["auto", "responses", "chat_completions"] = "auto"
    thinking_mode: Literal["auto", "enabled", "disabled"] = "auto"
    reasoning_effort: Literal["minimal", "low", "medium", "high"] = "medium"
    model_compat_mode: Literal["auto", "standard", "aggressive_kimi"] = "auto"
    max_images_per_tool_result: int = Field(default=1, ge=0, le=5)
    model_image_max_edge: int = Field(default=1600, ge=256, le=4096)
    model_image_max_bytes: int = Field(default=350000, ge=32768, le=4000000)
    system_prompt: str = (
        "You are a local desktop automation assistant. Use the provided tools when you need "
        "to inspect or control the computer. Inspect screenshot images returned by tools directly "
        "when available. If accessibility snapshots are empty or unusable, fall back to screenshot-based "
        "inspection and then local filesystem tools such as searching paths and listing directories. "
        "Be concise and action-oriented."
    )


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["system", "user", "assistant", "tool"]
    content: str
    reasoning_content: str | None = None
    content_parts: list[dict[str, Any]] = Field(default_factory=list)
    name: str | None = None
    tool_call_id: str | None = None
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    config: ModelConfig
    messages: list[ChatMessage] = Field(default_factory=list)
    max_steps: int = Field(default=100, ge=1, le=500)
    enable_ocr: bool = False


class RunConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    model: str
    base_url: str
    api_key: str
    api_mode: Literal["auto", "responses", "chat_completions"] = "auto"
    thinking_mode: Literal["auto", "enabled", "disabled"] = "auto"
    reasoning_effort: Literal["minimal", "low", "medium", "high"] = "medium"
    model_compat_mode: Literal["auto", "standard", "aggressive_kimi"] = "auto"
    system_prompt: str = ModelConfig.model_fields["system_prompt"].default
    max_steps: int = Field(default=100, ge=1, le=500)
    enable_ocr: bool = False
    max_images_per_tool_result: int = Field(default=1, ge=0, le=5)
    model_image_max_edge: int = Field(default=1600, ge=256, le=4096)
    model_image_max_bytes: int = Field(default=350000, ge=32768, le=4000000)


class ToolInvocation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str | None = None
    name: str
    step_index: int | None = None
    arguments: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] = Field(default_factory=dict)
    preview_images: list[str] = Field(default_factory=list)
    status: Literal["pending", "success", "error"] = "success"
    started_at: float | None = None
    finished_at: float | None = None
    duration_ms: int | None = None


class ChatDiagnostics(BaseModel):
    model_config = ConfigDict(extra="forbid")

    request_id: str | None = None
    api_mode_requested: str | None = None
    api_mode_used: str | None = None
    last_error_type: str | None = None
    last_error_message: str | None = None
    content_filter_triggered: bool = False
    degraded_retry_used: bool = False
    history_trimmed_for_model: bool = False
    aggressive_trim_used: bool = False
    tool_trace_count: int = 0
    serialized_message_count: int = 0
    serialized_user_message_count: int = 0
    serialized_assistant_message_count: int = 0
    serialized_tool_message_count: int = 0
    serialized_system_message_count: int = 0
    serialized_reasoning_message_count: int = 0
    serialized_image_part_count: int = 0


class ChatResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reply: str
    model: str
    api_mode_used: str | None = None
    tool_trace: list[ToolInvocation] = Field(default_factory=list)
    diagnostics: ChatDiagnostics | None = None
