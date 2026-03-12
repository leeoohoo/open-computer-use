"""
Swarm API routes — parallel execution of the same prompt across multiple machines.

Endpoints:
    POST /api/swarm/execute   — start swarm execution (SSE streaming)
    POST /api/swarm/stop/{swarm_id}  — cancel a running swarm
    GET  /api/swarm/status/{swarm_id} — check swarm status
"""

import asyncio
import json
import logging
import time
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.auth import get_verified_user_id
from app.services.agent_billing import agent_billing_service
from app.services.vm_control import vm_control_service
from app.services.swarm_executor import SwarmExecutor, get_active_swarm
from app.providers.provider_factory import ProviderFactory
from app.api.routes.chat import get_machine_connection_info

logger = logging.getLogger(__name__)

router = APIRouter()

# Module-level provider factory instance (same pattern as chat.py)
provider_factory = ProviderFactory()


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class SwarmMachine(BaseModel):
    machine_id: str
    display_name: Optional[str] = None


class SwarmExecuteRequest(BaseModel):
    """Sent by the Next.js proxy after machines are created and ready."""
    swarm_id: str
    prompt: str
    machines: List[SwarmMachine]
    model: Optional[str] = None
    max_steps: int = Field(default=200, le=500)


# ---------------------------------------------------------------------------
# POST /api/swarm/execute
# ---------------------------------------------------------------------------

@router.post("/execute")
async def swarm_execute(
    request: Request,
    body: SwarmExecuteRequest,
    user_id: str = Depends(get_verified_user_id),
) -> StreamingResponse:
    """Start parallel CUA execution on all provided machines."""
    if not body.machines:
        raise HTTPException(status_code=400, detail="No machines provided")

    if not body.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt is required")

    # Credit check
    balance_check = await agent_billing_service.check_balance_for_session(user_id)
    if not balance_check["can_start"]:
        raise HTTPException(
            status_code=402,
            detail=f"Insufficient credits ({balance_check['current_balance']}). "
                   f"Swarm mode requires at least {balance_check['required_balance']}.",
        )

    # Resolve connection info for each machine
    resolved_machines: List[Dict[str, Any]] = []
    for m in body.machines:
        conn = await get_machine_connection_info(m.machine_id, user_id)
        if not conn:
            logger.warning(f"Swarm: machine {m.machine_id} not reachable, skipping")
            continue
        resolved_machines.append({
            "machine_id": m.machine_id,
            "connection_info": conn,
            "display_name": m.display_name or m.machine_id[:8],
        })

    if not resolved_machines:
        raise HTTPException(
            status_code=404,
            detail="None of the swarm machines are reachable",
        )

    # Provider — use instance method, not class method
    bedrock_model = body.model or settings.BEDROCK_DEFAULT_MODEL
    provider = provider_factory.get_provider(bedrock_model)
    provider.initialize()

    # Start billing sessions for each machine
    billing_sessions: Dict[str, str] = {}
    for m in resolved_machines:
        sid = await agent_billing_service.start_session(
            user_id=user_id,
            machine_id=m["machine_id"],
            session_type="ai_controlled",
            ai_model=bedrock_model,
            ai_objective=f"[SWARM] {body.prompt[:200]}",
        )
        if sid:
            billing_sessions[m["machine_id"]] = sid
        else:
            logger.warning(f"Swarm: failed to start billing for machine {m['machine_id']}")

    # Build executor
    executor = SwarmExecutor(
        swarm_id=body.swarm_id,
        machines=resolved_machines,
        prompt=body.prompt,
        provider=provider,
        model=bedrock_model,
        user_id=user_id,
        temperature=1.0,
        max_steps=body.max_steps,
    )

    async def stream_swarm():
        completion_status = "failed"
        try:
            async for chunk in executor.stream_execution():
                # Check client disconnect
                if await request.is_disconnected():
                    logger.info(f"Swarm {body.swarm_id}: client disconnected")
                    executor.request_cancellation()
                    completion_status = "cancelled"
                    break

                chunk_type = chunk.get("type", "unknown")

                # Per-machine billing on step_complete
                if chunk_type == "step_complete":
                    mid = chunk.get("machine_id")
                    sid = billing_sessions.get(mid)
                    if sid:
                        step_num = chunk.get("step", 0)
                        charge_result = await agent_billing_service.charge_step(
                            sid, step_num
                        )
                        if charge_result.get("should_stop"):
                            logger.warning(
                                f"Swarm {body.swarm_id}: credits exhausted, cancelling"
                            )
                            executor.request_cancellation()
                            completion_status = "cancelled"

                # Map chunk to SSE code
                sse_code = _chunk_type_to_sse_code(chunk_type)
                yield f"{sse_code}:{json.dumps(chunk)}\n\n"

            # If we got here without breaking, it completed normally
            if completion_status == "failed":
                completion_status = "completed"

        except asyncio.CancelledError:
            logger.info(f"Swarm {body.swarm_id}: stream cancelled")
            completion_status = "cancelled"
        except Exception as e:
            logger.error(f"Swarm {body.swarm_id}: stream error: {e}", exc_info=True)
            completion_status = "failed"
            yield f'3:{json.dumps({"error": str(e), "swarm_id": body.swarm_id})}\n\n'
        finally:
            # End all billing sessions with correct status
            for mid, sid in billing_sessions.items():
                try:
                    machine_status = executor._machine_statuses.get(mid, "unknown")
                    bill_status = completion_status
                    if machine_status == "failed":
                        bill_status = "failed"
                    elif machine_status == "cancelled":
                        bill_status = "cancelled"
                    await agent_billing_service.end_session(sid, bill_status)
                except Exception as e:
                    logger.error(f"Failed to end billing session {sid}: {e}")

    return StreamingResponse(
        stream_swarm(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Encoding": "none",
        },
    )


# ---------------------------------------------------------------------------
# POST /api/swarm/stop/{swarm_id}
# ---------------------------------------------------------------------------

@router.post("/stop/{swarm_id}")
async def swarm_stop(
    swarm_id: str,
    user_id: str = Depends(get_verified_user_id),
) -> Dict[str, Any]:
    """Cancel a running swarm."""
    swarm = get_active_swarm(swarm_id)
    if not swarm:
        return {"stopped": False, "reason": "Swarm not found or already finished"}

    # Ownership check
    if swarm.user_id and swarm.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to stop this swarm")

    swarm.request_cancellation()
    return {"stopped": True, "swarm_id": swarm_id}


# ---------------------------------------------------------------------------
# GET /api/swarm/status/{swarm_id}
# ---------------------------------------------------------------------------

@router.get("/status/{swarm_id}")
async def swarm_status(
    swarm_id: str,
    user_id: str = Depends(get_verified_user_id),
) -> Dict[str, Any]:
    """Get status of a running swarm."""
    swarm = get_active_swarm(swarm_id)
    if not swarm:
        return {"active": False, "swarm_id": swarm_id}

    # Ownership check
    if swarm.user_id and swarm.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this swarm")

    return {
        "active": True,
        "swarm_id": swarm_id,
        "machine_statuses": dict(swarm._machine_statuses),
        "cancelled": swarm._cancel_event.is_set(),
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _chunk_type_to_sse_code(chunk_type: str) -> str:
    """Map swarm chunk types to SSE type codes."""
    mapping = {
        "text": "0",
        "error": "3",
        "tool_call": "9",
        "tool_result": "a",
        "reasoning": "g",
        "finish": "d",
        # Swarm-specific types all use "s"
        "swarm_meta": "s",
        "swarm_machine_status": "s",
        "keepalive": "s",
        "step_complete": "s",
    }
    return mapping.get(chunk_type, "s")
