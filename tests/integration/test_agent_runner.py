import unittest

from server.app.services.agent_runner import AgentRunner
from shared.schemas.agent import AgentRunRequest
from shared.schemas.desktop import (
    ActionExecutionResult,
    CoordinateTarget,
    DisplayMetadata,
    ExecuteActionRequest,
    MoveAction,
    Observation,
    ScrollAction,
)


class FakeRegistry:
    def __init__(self) -> None:
        self.calls = []
        self.display = DisplayMetadata(
            display_id="main",
            logical_width=100,
            logical_height=100,
            physical_width=100,
            physical_height=100,
        )

    async def observe(self, executor_id=None):
        self.calls.append(("observe", executor_id))
        return Observation(
            screenshot_base64="img",
            display=self.display,
            timestamp=1.0,
        )

    async def execute(self, payload: ExecuteActionRequest):
        self.calls.append(("execute", payload.executor_id, payload.action.action))
        return ActionExecutionResult(
            success=True,
            action=payload.action.action,
            executor_id=payload.executor_id or "local",
            message="ok",
            observation=Observation(
                screenshot_base64="after",
                display=self.display,
                timestamp=2.0,
            ),
        )


class AgentRunnerTests(unittest.IsolatedAsyncioTestCase):
    async def test_runner_collects_initial_and_final_observations(self) -> None:
        runner = AgentRunner(registry=FakeRegistry())
        payload = AgentRunRequest(
            goal="Demo task",
            actions=[
                MoveAction(
                    action="move",
                    target=CoordinateTarget(x=1, y=2, display_id="main"),
                ),
                ScrollAction(action="scroll", direction="down", amount=100),
            ],
            executor_id="local",
        )

        result = await runner.run(payload)

        self.assertTrue(result.completed)
        self.assertEqual(len(result.steps), 2)
        self.assertIsNotNone(result.initial_observation)
        self.assertIsNotNone(result.final_observation)
        self.assertEqual(result.executor_id, "local")


if __name__ == "__main__":
    unittest.main()
