from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse, StreamingResponse
import asyncio
import json

from executor.client.desktop.controller import DesktopDependencyError
from server.app.services.agent_runner import AgentRunner
from server.app.services.chat_runner import ChatRunner, ModelRequestError
from server.app.services.executor_registry import ExecutorRegistry
from server.app.services.mcp_http import HttpMCPService
from server.app.services.orchestrator import LocalComputerUseService
from server.app.services.run_config_store import RunConfigStore
from shared.schemas.chat import ChatRequest, ChatResponse, RunConfig
from shared.schemas.agent import AgentRunRequest, AgentRunResponse
from shared.schemas.desktop import (
    ActionExecutionResult,
    AccessibilitySnapshotRequest,
    AccessibilitySnapshotResponse,
    AppControlRequest,
    AppControlResponse,
    ElementActionRequest,
    ElementActionResponse,
    ElementPreviewRequest,
    ElementPreviewResponse,
    ExecuteActionRequest,
    FocusElementRequest,
    FocusElementResponse,
    FrontmostAppResponse,
    DirectoryListRequest,
    DirectoryListResponse,
    HealthResponse,
    InstalledAppsResponse,
    LocalPathSearchRequest,
    LocalPathSearchResponse,
    Observation,
    PointerStateResponse,
    PerformElementActionRequest,
    PerformElementActionResponse,
    PressElementRequest,
    PressElementResponse,
    PermissionOverviewResponse,
    PermissionRequestPayload,
    PermissionRequestResponse,
    SetValueElementRequest,
    SetValueElementResponse,
    TargetPreviewRequest,
    TargetPreviewResponse,
    TypeIntoElementRequest,
    TypeIntoElementResponse,
)
from shared.schemas.runtime import (
    ExecutorErrorMessage,
    ExecutorRegisterMessage,
    ExecutorStatus,
    parse_transport_message,
)

router = APIRouter()
service = LocalComputerUseService()
registry = ExecutorRegistry(local_service=service)
agent_runner = AgentRunner(registry=registry)
chat_runner = ChatRunner(local_service=service)
mcp_service = HttpMCPService(local_service=service)
run_config_store = RunConfigStore()


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", executor="local")


@router.get("/api/v1/config", response_model=RunConfig)
async def get_run_config() -> RunConfig:
    try:
        return run_config_store.load()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/api/v1/config", response_model=RunConfig)
async def save_run_config(payload: RunConfig) -> RunConfig:
    try:
        return run_config_store.save(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/api/v1/executors", response_model=list[ExecutorStatus])
async def list_executors() -> list[ExecutorStatus]:
    return registry.list_statuses()


@router.get("/api/v1/observe", response_model=Observation)
async def observe(executor_id: str | None = None, display_id: str | None = None) -> Observation:
    try:
        if executor_id and executor_id != "local":
            return await registry.observe(executor_id)
        return service.observe_display(display_id=display_id)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/api/v1/apps", response_model=InstalledAppsResponse)
async def list_apps(query: str | None = None) -> InstalledAppsResponse:
    try:
        return service.list_apps(query=query)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/api/v1/apps/frontmost", response_model=FrontmostAppResponse)
async def get_frontmost_app() -> FrontmostAppResponse:
    try:
        return service.get_frontmost_app()
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/api/v1/permissions", response_model=PermissionOverviewResponse)
async def get_permissions() -> PermissionOverviewResponse:
    try:
        return service.get_permission_overview()
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/permissions/request", response_model=PermissionRequestResponse)
async def request_permissions(payload: PermissionRequestPayload) -> PermissionRequestResponse:
    try:
        return service.request_permissions(payload)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/apps/launch", response_model=AppControlResponse)
async def launch_app(payload: AppControlRequest) -> AppControlResponse:
    try:
        return service.launch_app(payload)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/apps/activate", response_model=AppControlResponse)
async def activate_app(payload: AppControlRequest) -> AppControlResponse:
    try:
        return service.activate_app(payload)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/apps/accessibility", response_model=AccessibilitySnapshotResponse)
async def get_accessibility_snapshot(payload: AccessibilitySnapshotRequest) -> AccessibilitySnapshotResponse:
    try:
        return service.get_accessibility_snapshot(payload)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/apps/click-element", response_model=ElementActionResponse)
async def click_element(payload: ElementActionRequest) -> ElementActionResponse:
    try:
        return service.click_element(payload)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/apps/press-element", response_model=PressElementResponse)
async def press_element(payload: PressElementRequest) -> PressElementResponse:
    try:
        return service.press_element(payload)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/apps/perform-action", response_model=PerformElementActionResponse)
async def perform_element_action(payload: PerformElementActionRequest) -> PerformElementActionResponse:
    try:
        return service.perform_element_action(payload)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/apps/type-into-element", response_model=TypeIntoElementResponse)
async def type_into_element(payload: TypeIntoElementRequest) -> TypeIntoElementResponse:
    try:
        return service.type_into_element(payload)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/apps/set-value", response_model=SetValueElementResponse)
async def set_value(payload: SetValueElementRequest) -> SetValueElementResponse:
    try:
        return service.set_value_for_element(payload)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/apps/focus-element", response_model=FocusElementResponse)
async def focus_element(payload: FocusElementRequest) -> FocusElementResponse:
    try:
        return service.focus_element(payload)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/apps/preview-element", response_model=ElementPreviewResponse)
async def preview_element(payload: ElementPreviewRequest) -> ElementPreviewResponse:
    try:
        return service.preview_element(payload)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/actions/execute", response_model=ActionExecutionResult)
async def execute_action(payload: ExecuteActionRequest) -> ActionExecutionResult:
    try:
        return await registry.execute(payload)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/targets/preview", response_model=TargetPreviewResponse)
async def preview_target(payload: TargetPreviewRequest) -> TargetPreviewResponse:
    if payload.executor_id and payload.executor_id != "local":
        raise HTTPException(status_code=400, detail="Target preview is only supported for local executor.")

    try:
        return service.preview_target(payload)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/api/v1/pointer", response_model=PointerStateResponse)
async def pointer_state(executor_id: str | None = None) -> PointerStateResponse:
    if executor_id and executor_id != "local":
        raise HTTPException(status_code=400, detail="Pointer state is only supported for local executor.")

    try:
        return service.get_pointer_state(executor_id)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/files/find-paths", response_model=LocalPathSearchResponse)
async def find_paths(payload: LocalPathSearchRequest) -> LocalPathSearchResponse:
    try:
        return service.find_paths(payload)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/files/list-directory", response_model=DirectoryListResponse)
async def list_directory(payload: DirectoryListRequest) -> DirectoryListResponse:
    try:
        return service.list_directory(payload)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/agent/runs", response_model=AgentRunResponse)
async def run_agent(payload: AgentRunRequest) -> AgentRunResponse:
    try:
        return await agent_runner.run(payload)
    except DesktopDependencyError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    try:
        return await chat_runner.run(payload)
    except ModelRequestError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - defensive path
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/api/v1/chat/stream")
async def chat_stream(payload: ChatRequest) -> StreamingResponse:
    async def event_generator():
        queue: asyncio.Queue[dict | None] = asyncio.Queue()

        def on_event(event: dict) -> None:
            queue.put_nowait(event)

        async def run_chat() -> None:
            try:
                await chat_runner.run_with_events(payload, event_callback=on_event)
            except ModelRequestError as exc:
                queue.put_nowait(
                    {
                        "type": "run_finished",
                        "reply": f"模型请求失败：{exc}",
                        "model": payload.config.model,
                        "api_mode_used": None,
                        "tool_trace": [],
                        "diagnostics": None,
                    }
                )
            except Exception as exc:  # pragma: no cover - defensive path
                queue.put_nowait(
                    {
                        "type": "run_finished",
                        "reply": f"请求失败：{exc}",
                        "model": payload.config.model,
                        "api_mode_used": None,
                        "tool_trace": [],
                        "diagnostics": None,
                    }
                )
            finally:
                queue.put_nowait(None)

        task = asyncio.create_task(run_chat())
        try:
            while True:
                event = await queue.get()
                if event is None:
                    break
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/mcp")
async def mcp_discovery() -> dict:
    return {
        "name": "open-computer-use",
        "transport": "http-jsonrpc",
        "endpoint": "/mcp",
        "initialize": mcp_service.initialize_result(),
        "tools": mcp_service.tools_list_result()["tools"],
    }


@router.post("/mcp")
async def mcp_http(request: dict) -> JSONResponse:
    try:
        response = await mcp_service.handle_jsonrpc(request)
        return JSONResponse(content=response)
    except DesktopDependencyError as exc:
        return JSONResponse(
            status_code=503,
            content={
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "error": {"code": -32001, "message": str(exc)},
            },
        )
    except ValueError as exc:
        return JSONResponse(
            status_code=400,
            content={
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "error": {"code": -32602, "message": str(exc)},
            },
        )
    except Exception as exc:  # pragma: no cover - defensive path
        return JSONResponse(
            status_code=500,
            content={
                "jsonrpc": "2.0",
                "id": request.get("id"),
                "error": {"code": -32603, "message": str(exc)},
            },
        )


@router.websocket("/api/v1/ws/executors/connect")
async def connect_executor(websocket: WebSocket) -> None:
    await websocket.accept()

    try:
        raw = await websocket.receive_text()
        message = parse_transport_message(raw)

        if not isinstance(message, ExecutorRegisterMessage):
            await websocket.send_text(
                ExecutorErrorMessage(
                    type="error",
                    error="The first WebSocket message must be a register message.",
                ).model_dump_json()
            )
            await websocket.close(code=1008, reason="registration required")
            return

        session = await registry.register_remote(websocket, message.payload)
        await session.run()
    except WebSocketDisconnect:
        return
    except Exception as exc:
        try:
            await websocket.send_text(
                ExecutorErrorMessage(type="error", error=str(exc)).model_dump_json()
            )
        except RuntimeError:
            pass
        try:
            await websocket.close(code=1011, reason="executor error")
        except RuntimeError:
            pass
