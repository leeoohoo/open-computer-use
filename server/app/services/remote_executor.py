from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any, Callable, Awaitable

from fastapi import WebSocket, WebSocketDisconnect

from shared.schemas.desktop import ActionExecutionResult, ExecuteActionRequest, Observation
from shared.schemas.runtime import (
    ExecutorErrorMessage,
    ExecutorExecuteCommand,
    ExecutorExecutionResultMessage,
    ExecutorObservationMessage,
    ExecutorObserveCommand,
    ExecutorPongMessage,
    ExecutorRegisteredMessage,
    ExecutorRegistration,
    ExecutorStatus,
    parse_transport_message,
)


DisconnectCallback = Callable[[str], Awaitable[None]]


class RemoteExecutorSession:
    def __init__(
        self,
        websocket: WebSocket,
        registration: ExecutorRegistration,
        on_disconnect: DisconnectCallback,
    ) -> None:
        self.websocket = websocket
        self.registration = registration
        self.on_disconnect = on_disconnect
        self._send_lock = asyncio.Lock()
        self._pending: dict[str, asyncio.Future[Any]] = {}
        self.last_seen_at = time.time()

    def get_status(self) -> ExecutorStatus:
        return ExecutorStatus(
            executor_id=self.registration.executor_id,
            name=self.registration.name,
            transport="websocket",
            connected=True,
            platform=self.registration.platform,
            version=self.registration.version,
            capabilities=self.registration.capabilities,
            last_seen_at=self.last_seen_at,
        )

    async def observe(self) -> Observation:
        request_id = uuid.uuid4().hex
        response = await self._request(ExecutorObserveCommand(type="observe", request_id=request_id))
        if not isinstance(response, Observation):
            raise RuntimeError("Unexpected observation response payload.")
        return response

    async def execute(self, payload: ExecuteActionRequest) -> ActionExecutionResult:
        request_id = uuid.uuid4().hex
        remote_payload = payload.model_copy(update={"executor_id": self.registration.executor_id})
        response = await self._request(
            ExecutorExecuteCommand(type="execute", request_id=request_id, payload=remote_payload)
        )
        if not isinstance(response, ActionExecutionResult):
            raise RuntimeError("Unexpected execution response payload.")
        return response

    async def run(self) -> None:
        try:
            await self._send_message(
                ExecutorRegisteredMessage(
                    type="registered",
                    executor_id=self.registration.executor_id,
                )
            )

            while True:
                raw = await self.websocket.receive_text()
                self.last_seen_at = time.time()
                message = parse_transport_message(raw)

                if isinstance(message, ExecutorObservationMessage):
                    self._resolve_request(message.request_id, message.observation)
                    continue

                if isinstance(message, ExecutorExecutionResultMessage):
                    self._resolve_request(message.request_id, message.result)
                    continue

                if isinstance(message, ExecutorErrorMessage):
                    self._reject_request(message.request_id, message.error)
                    continue

                if isinstance(message, ExecutorPongMessage):
                    continue

                if isinstance(message, ExecutorRegisteredMessage):
                    continue

                self._reject_request(
                    None,
                    f"Unexpected message type from executor: {message.type}",
                )
        except WebSocketDisconnect:
            pass
        finally:
            self._fail_all_pending("Executor disconnected.")
            await self.on_disconnect(self.registration.executor_id)

    async def close(self, reason: str = "Closing executor session.") -> None:
        self._fail_all_pending(reason)
        try:
            await self.websocket.close(code=1000, reason=reason)
        except RuntimeError:
            pass

    async def _request(self, message: ExecutorObserveCommand | ExecutorExecuteCommand) -> Any:
        loop = asyncio.get_running_loop()
        future: asyncio.Future[Any] = loop.create_future()
        self._pending[message.request_id] = future
        await self._send_message(message)

        try:
            return await asyncio.wait_for(future, timeout=30.0)
        finally:
            self._pending.pop(message.request_id, None)

    async def _send_message(self, message) -> None:
        async with self._send_lock:
            await self.websocket.send_text(message.model_dump_json())

    def _resolve_request(self, request_id: str, value: Any) -> None:
        future = self._pending.get(request_id)
        if future and not future.done():
            future.set_result(value)

    def _reject_request(self, request_id: str | None, error: str) -> None:
        if request_id is None:
            self._fail_all_pending(error)
            return

        future = self._pending.get(request_id)
        if future and not future.done():
            future.set_exception(RuntimeError(error))

    def _fail_all_pending(self, error: str) -> None:
        for future in self._pending.values():
            if not future.done():
                future.set_exception(RuntimeError(error))
        self._pending.clear()
