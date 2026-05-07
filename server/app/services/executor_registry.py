from __future__ import annotations

from fastapi import WebSocket

from server.app.services.executor_registry_core import ExecutorRegistryCore
from server.app.services.remote_executor import RemoteExecutorSession
from shared.schemas.runtime import ExecutorRegistration


class ExecutorRegistry(ExecutorRegistryCore):
    async def register_remote(
        self,
        websocket: WebSocket,
        registration: ExecutorRegistration,
    ) -> RemoteExecutorSession:
        session = RemoteExecutorSession(
            websocket=websocket,
            registration=registration,
            on_disconnect=self.detach_remote,
        )
        await self.attach_remote(registration.executor_id, session)
        return session
