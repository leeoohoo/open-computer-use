from __future__ import annotations

import asyncio
from typing import Protocol

from server.app.services.orchestrator import LocalComputerUseService
from shared.schemas.desktop import ActionExecutionResult, ExecuteActionRequest, Observation
from shared.schemas.runtime import ExecutorStatus


class RemoteExecutorProtocol(Protocol):
    registration: object

    def get_status(self) -> ExecutorStatus: ...

    async def observe(self) -> Observation: ...

    async def execute(self, payload: ExecuteActionRequest) -> ActionExecutionResult: ...

    async def close(self, reason: str = "Closing executor session.") -> None: ...


class ExecutorRegistryCore:
    def __init__(self, local_service: LocalComputerUseService | None = None) -> None:
        self.local_service = local_service or LocalComputerUseService()
        self._remote_sessions: dict[str, RemoteExecutorProtocol] = {}
        self._lock = asyncio.Lock()

    def list_statuses(self) -> list[ExecutorStatus]:
        statuses = [self.local_service.get_status()]
        statuses.extend(session.get_status() for session in self._remote_sessions.values())
        return statuses

    async def observe(self, executor_id: str | None = None) -> Observation:
        if executor_id and executor_id != "local":
            session = self._require_remote(executor_id)
            return await session.observe()
        return self.local_service.observe()

    async def execute(self, payload: ExecuteActionRequest) -> ActionExecutionResult:
        executor_id = payload.executor_id
        if executor_id and executor_id != "local":
            session = self._require_remote(executor_id)
            return await session.execute(payload)
        local_payload = payload.model_copy(update={"executor_id": "local"})
        return self.local_service.execute(local_payload)

    async def attach_remote(self, executor_id: str, session: RemoteExecutorProtocol) -> None:
        old_session = None
        async with self._lock:
            old_session = self._remote_sessions.get(executor_id)
            self._remote_sessions[executor_id] = session

        if old_session is not None:
            await old_session.close("Replaced by a new connection.")

    async def detach_remote(self, executor_id: str) -> None:
        async with self._lock:
            self._remote_sessions.pop(executor_id, None)

    def _require_remote(self, executor_id: str) -> RemoteExecutorProtocol:
        session = self._remote_sessions.get(executor_id)
        if session is None:
            raise ValueError(f"Executor '{executor_id}' is not connected.")
        return session
