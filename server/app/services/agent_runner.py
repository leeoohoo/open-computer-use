from __future__ import annotations

from server.app.services.executor_registry_core import ExecutorRegistryCore
from shared.schemas.agent import AgentRunRequest, AgentRunResponse, AgentStepResult
from shared.schemas.desktop import ExecuteActionRequest


class AgentRunner:
    def __init__(self, registry: ExecutorRegistryCore) -> None:
        self.registry = registry

    async def run(self, payload: AgentRunRequest) -> AgentRunResponse:
        executor_id = payload.executor_id or "local"
        initial_observation = None
        final_observation = None
        steps: list[AgentStepResult] = []
        completed = True

        if payload.capture_initial_observation:
            initial_observation = await self.registry.observe(payload.executor_id)

        for index, action in enumerate(payload.actions):
            result = await self.registry.execute(
                ExecuteActionRequest(
                    action=action,
                    executor_id=payload.executor_id,
                    capture_after=payload.capture_after_each_step,
                )
            )
            steps.append(
                AgentStepResult(
                    index=index,
                    action=action,
                    result=result,
                )
            )

            if result.observation is not None:
                final_observation = result.observation

            if not result.success and payload.stop_on_error:
                completed = False
                break

        if final_observation is None and (steps or initial_observation is not None):
            final_observation = await self.registry.observe(payload.executor_id)

        return AgentRunResponse(
            goal=payload.goal,
            executor_id=executor_id,
            completed=completed,
            initial_observation=initial_observation,
            final_observation=final_observation,
            steps=steps,
        )
