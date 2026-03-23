"""
OSWorld Evaluation API Routes

Provides a stateful session-based API for OSWorld benchmark evaluation.
The CUA agent runs on the backend; OSWorld controls the VM and screenshots.

Endpoints:
    POST /session          — Create a new evaluation session
    POST /predict          — Run one predict step (screenshot → pyautogui actions)
    POST /session/reset    — Reset agent state for a new task
    DELETE /session/{id}   — Delete a session
    GET /sessions          — List active sessions
    GET /health            — Health check
"""

import asyncio
import base64
import logging
import time
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.osworld_session import osworld_session_manager

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Request/Response Models ──


class CreateSessionRequest(BaseModel):
    model: str = Field(
        default="coasty-cua-v1",
        description="Model alias (e.g. coasty-cua-v1, coasty-cua-v2, default). Resolved server-side.",
    )
    screen_width: int = Field(default=1920, description="VM screen width")
    screen_height: int = Field(default=1080, description="VM screen height")
    temperature: float = Field(default=1.0, description="LLM temperature")
    max_trajectory_length: int = Field(
        default=8, description="Max screenshot history to keep"
    )


class CreateSessionResponse(BaseModel):
    session_id: str
    model: str
    screen_size: str


class PredictRequest(BaseModel):
    session_id: str = Field(description="Session ID from create_session")
    instruction: str = Field(description="Task instruction text")
    screenshot: str = Field(description="Base64-encoded PNG screenshot")


class PredictResponse(BaseModel):
    reasoning: str
    actions: list[str]
    step_count: int


class ResetRequest(BaseModel):
    session_id: str


# ── Endpoints ──


@router.post("/session", response_model=CreateSessionResponse)
async def create_session(req: CreateSessionRequest):
    """Create a new OSWorld evaluation session with a CUA agent."""
    try:
        session_id = await asyncio.to_thread(
            osworld_session_manager.create_session,
            model=req.model,
            screen_width=req.screen_width,
            screen_height=req.screen_height,
            temperature=req.temperature,
            max_trajectory_length=req.max_trajectory_length,
        )
        return CreateSessionResponse(
            session_id=session_id,
            model=req.model,
            screen_size=f"{req.screen_width}x{req.screen_height}",
        )
    except Exception as e:
        logger.exception(f"Failed to create OSWorld session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):
    """Run one predict step: screenshot → pyautogui actions.

    The agent maintains conversation history between calls within
    the same session, enabling multi-step task execution.

    Reasoning and step count are redacted from the response — all
    chain-of-thought stays server-side to prevent information leakage.
    """
    session = osworld_session_manager.get_session(req.session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found or expired")

    # Decode screenshot
    try:
        screenshot_bytes = base64.b64decode(req.screenshot)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 screenshot: {e}")

    # Run prediction in thread (agent.predict is synchronous)
    try:
        _reasoning, actions = await asyncio.to_thread(
            session.predict, req.instruction, screenshot_bytes
        )
    except Exception as e:
        logger.exception(f"Predict failed for session {req.session_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    # Redact reasoning — chain-of-thought stays server-side only.
    # The agent's internal conversation history is maintained in the
    # session; the client never needs to feed reasoning back.
    return PredictResponse(
        reasoning="",
        actions=actions,
        step_count=0,
    )


@router.post("/session/reset")
async def reset_session(req: ResetRequest):
    """Reset agent state for a new task (keeps same session/model)."""
    success = await asyncio.to_thread(
        osworld_session_manager.reset_session, req.session_id
    )
    if not success:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    return {"status": "ok", "session_id": req.session_id}


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and free resources."""
    osworld_session_manager.delete_session(session_id)
    return {"status": "ok", "session_id": session_id}


@router.get("/sessions")
async def list_sessions():
    """List all active OSWorld sessions."""
    return {"sessions": osworld_session_manager.list_sessions()}


@router.get("/health")
async def osworld_health():
    """Health check for OSWorld API."""
    return {
        "status": "ok",
        "active_sessions": len(osworld_session_manager.list_sessions()),
        "timestamp": time.time(),
    }
