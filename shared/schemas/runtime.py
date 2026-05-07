from __future__ import annotations

import json
import time
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

from shared.schemas.desktop import ActionExecutionResult, ExecuteActionRequest, Observation


class ExecutorRegistration(BaseModel):
    model_config = ConfigDict(extra="forbid")

    executor_id: str
    name: str
    platform: str
    version: str = "0.1.0"
    capabilities: list[str] = Field(default_factory=list)


class ExecutorStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    executor_id: str
    name: str
    transport: Literal["local", "websocket"]
    connected: bool = True
    platform: str | None = None
    version: str | None = None
    capabilities: list[str] = Field(default_factory=list)
    last_seen_at: float | None = None


class ExecutorRegisterMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["register"]
    payload: ExecutorRegistration


class ExecutorRegisteredMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["registered"]
    executor_id: str
    server_time: float = Field(default_factory=time.time)


class ExecutorObserveCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["observe"]
    request_id: str


class ExecutorExecuteCommand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["execute"]
    request_id: str
    payload: ExecuteActionRequest


class ExecutorObservationMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["observation"]
    request_id: str
    observation: Observation


class ExecutorExecutionResultMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["execution_result"]
    request_id: str
    result: ActionExecutionResult


class ExecutorErrorMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["error"]
    request_id: str | None = None
    error: str


class ExecutorPingMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["ping"]
    timestamp: float = Field(default_factory=time.time)


class ExecutorPongMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["pong"]
    timestamp: float = Field(default_factory=time.time)


ExecutorTransportMessage = Annotated[
    Union[
        ExecutorRegisterMessage,
        ExecutorRegisteredMessage,
        ExecutorObserveCommand,
        ExecutorExecuteCommand,
        ExecutorObservationMessage,
        ExecutorExecutionResultMessage,
        ExecutorErrorMessage,
        ExecutorPingMessage,
        ExecutorPongMessage,
    ],
    Field(discriminator="type"),
]

_transport_adapter = TypeAdapter(ExecutorTransportMessage)


def parse_transport_message(raw: str | dict) -> ExecutorTransportMessage:
    payload = json.loads(raw) if isinstance(raw, str) else raw
    return _transport_adapter.validate_python(payload)
