from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from shared.schemas.desktop import ActionExecutionResult, DesktopAction, Observation


class AgentRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    goal: str
    actions: list[DesktopAction] = Field(default_factory=list)
    executor_id: str | None = None
    capture_initial_observation: bool = True
    capture_after_each_step: bool = True
    stop_on_error: bool = True


class AgentStepResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    index: int
    action: DesktopAction
    result: ActionExecutionResult


class AgentRunResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    goal: str
    executor_id: str
    completed: bool
    initial_observation: Observation | None = None
    final_observation: Observation | None = None
    steps: list[AgentStepResult] = Field(default_factory=list)
