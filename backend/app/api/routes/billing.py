"""
Billing API endpoints - Credit management and session tracking
"""

import logging
from typing import Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel

from app.services.auth import validate_user, get_verified_user_id
from app.services.agent_billing import agent_billing_service
from app.services.database import DatabaseService

logger = logging.getLogger(__name__)
router = APIRouter()

db_service = DatabaseService()


class CreditBalanceResponse(BaseModel):
    """Response for credit balance check"""
    user_id: str
    balance: int
    can_start_session: bool
    estimated_runtime_minutes: int
    credits_per_minute: int


class SessionStatusResponse(BaseModel):
    """Response for session status check"""
    session_id: str
    user_id: str
    machine_id: str
    started_at: str
    duration_minutes: int
    credits_used: int
    current_balance: int
    remaining_minutes: int


@router.get("/credits/balance")
async def get_credit_balance(user_id: str = Depends(get_verified_user_id)) -> CreditBalanceResponse:
    """Get user's current credit balance and session eligibility"""
    try:
        balance_info = await agent_billing_service.check_balance_for_session(user_id)
        
        return CreditBalanceResponse(
            user_id=user_id,
            balance=balance_info["current_balance"],
            can_start_session=balance_info["can_start"],
            estimated_runtime_minutes=balance_info["estimated_runtime_minutes"],
            credits_per_minute=balance_info["credits_per_minute"]
        )
    except Exception as e:
        logger.error(f"Error getting credit balance: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get credit balance")


@router.get("/sessions/{session_id}/status")
async def get_session_status(
    session_id: str,
    user_id: str = Depends(get_verified_user_id)
) -> SessionStatusResponse:
    """Get current status of an active billing session"""
    try:
        status = await agent_billing_service.get_session_status(session_id)
        
        if not status:
            raise HTTPException(status_code=404, detail="Session not found or inactive")
        
        # Verify user owns this session
        if status["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Access denied")
        
        return SessionStatusResponse(
            session_id=session_id,
            user_id=status["user_id"],
            machine_id=status["machine_id"],
            started_at=status["started_at"],
            duration_minutes=status["duration_minutes"],
            credits_used=status["credits_used"],
            current_balance=status["current_balance"],
            remaining_minutes=status["remaining_minutes"]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting session status: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get session status")


@router.post("/sessions/cleanup")
async def cleanup_orphaned_sessions(
    max_age_hours: int = 2,
    user_id: str = Depends(get_verified_user_id)
):
    """Manually trigger cleanup of orphaned sessions (admin only)"""
    try:
        # Check if user is admin (you might want to implement proper admin check)
        # For now, we'll just log the request
        logger.info(f"User {user_id} requested orphaned session cleanup")
        
        await agent_billing_service.cleanup_orphaned_sessions(max_age_hours)
        
        return {"message": "Cleanup completed successfully"}
    except Exception as e:
        logger.error(f"Error cleaning up sessions: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to cleanup sessions")


@router.get("/usage/history")
async def get_usage_history(
    user_id: str = Depends(get_verified_user_id),
    limit: int = 50
):
    """Get user's VM usage history"""
    try:
        if not db_service.client:
            raise HTTPException(status_code=500, detail="Database not available")
        
        # Get recent machine usage
        response = db_service.client.table("machine_usage").select(
            "*, user_machines!inner(display_name, container_name)"
        ).eq(
            "user_id", user_id
        ).order(
            "period_start", desc=True
        ).limit(limit).execute()
        
        if response and response.data:
            # Calculate credits for each usage entry
            usage_history = []
            for entry in response.data:
                duration_seconds = entry.get("cpu_seconds", 0)
                duration_minutes = int(duration_seconds / 60)
                credits_used = duration_minutes * agent_billing_service.CREDITS_PER_MINUTE
                
                usage_history.append({
                    "machine_name": entry.get("user_machines", {}).get("display_name", "Unknown"),
                    "started_at": entry.get("period_start"),
                    "ended_at": entry.get("period_end"),
                    "duration_minutes": duration_minutes,
                    "credits_used": credits_used,
                    "estimated_cost": entry.get("estimated_cost", 0)
                })
            
            return {"usage_history": usage_history}
        
        return {"usage_history": []}
        
    except Exception as e:
        logger.error(f"Error getting usage history: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get usage history")