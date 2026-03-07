"""
Agent Billing Service - Track and bill for agent runtime
Charges 10 credits per minute (rounded up) for agent execution time
"""

import asyncio
import logging
import math
from datetime import datetime, timedelta
from typing import Dict, Optional, Any
import uuid

from app.services.database import DatabaseService
from app.services import analytics
from app.core.config import settings

logger = logging.getLogger(__name__)


class AgentBillingService:
    """Service for tracking and billing agent runtime"""
    
    # Billing configuration
    CREDITS_PER_MINUTE = 10
    MIN_BALANCE_WARNING = 50  # Warn when balance drops below this
    MIN_BALANCE_REQUIRED = 20  # Minimum credits to start session
    CHECK_INTERVAL_SECONDS = 30  # Check credits every 30 seconds
    MAX_SESSION_DURATION = 21600  # Maximum 6 hours per session
    
    def __init__(self):
        self.db_service = DatabaseService()
        self.active_sessions: Dict[str, Dict] = {}
        self.credit_check_tasks: Dict[str, asyncio.Task] = {}
        self.session_locks: Dict[str, asyncio.Lock] = {}
        
    async def start_session(
        self,
        user_id: str,
        machine_id: str,
        session_type: str = "ai_controlled",
        ai_model: Optional[str] = None,
        ai_objective: Optional[str] = None
    ) -> Optional[str]:
        """
        Start a new billing session for agent execution
        Returns session_id if successful, None if insufficient credits
        """
        try:
            # Check user has minimum credits
            balance = await self._get_user_balance(user_id)
            if balance < self.MIN_BALANCE_REQUIRED:
                logger.warning(f"User {user_id} has insufficient credits ({balance} < {self.MIN_BALANCE_REQUIRED})")
                return None
            
            # Create session in database
            session_id = str(uuid.uuid4())
            session_data = {
                "id": session_id,
                "machine_id": machine_id,
                "user_id": user_id,
                "session_type": session_type,
                "started_at": datetime.utcnow().isoformat(),
                "ai_model": ai_model,
                "ai_objective": ai_objective,
                "ai_completion_status": "in_progress"
            }
            
            # Store in database
            if not self.db_service.client:
                logger.error("Database client not initialized")
                return None
                
            response = self.db_service.client.table("machine_sessions").insert(session_data).execute()
            if not response or not response.data:
                logger.error("Failed to create session in database")
                return None
            
            # Track active session
            self.active_sessions[session_id] = {
                "user_id": user_id,
                "machine_id": machine_id,
                "started_at": datetime.utcnow(),
                "last_check": datetime.utcnow(),
                "credits_used": 0,
                "warnings_sent": 0
            }
            
            # Create lock for this session
            self.session_locks[session_id] = asyncio.Lock()
            
            # Start periodic credit check task
            self.credit_check_tasks[session_id] = asyncio.create_task(
                self._periodic_credit_check(session_id)
            )
            
            logger.info(f"Started billing session {session_id} for user {user_id} (balance: {balance} credits)")
            analytics.track_agent_session_started(user_id, session_id, machine_id, ai_model or "unknown", ai_objective or "")
            return session_id
            
        except Exception as e:
            logger.error(f"Error starting billing session: {str(e)}")
            return None
    
    async def charge_step(self, session_id: str, step_number: int = 0) -> Dict[str, Any]:
        """Charge credits for time elapsed since last charge.

        Called at the end of each CUA executor step for granular billing.
        Only charges for NEW minutes not yet billed.

        Returns:
            Dict with charged credits, totals, remaining balance, and
            a should_stop flag if the user is out of credits.
        """
        if session_id not in self.active_sessions:
            return {"error": "Session not found", "should_stop": False}

        try:
            async with self.session_locks.get(session_id, asyncio.Lock()):
                session = self.active_sessions[session_id]
                now = datetime.utcnow()

                total_seconds = (now - session["started_at"]).total_seconds()
                total_minutes = math.ceil(total_seconds / 60)

                already_charged_minutes = session.get("charged_minutes", 0)
                new_minutes = total_minutes - already_charged_minutes

                if new_minutes <= 0:
                    balance = await self._get_user_balance(session["user_id"])
                    return {
                        "step": step_number,
                        "charged": 0,
                        "total_charged_minutes": already_charged_minutes,
                        "total_credits_used": already_charged_minutes * self.CREDITS_PER_MINUTE,
                        "remaining_balance": balance,
                        "should_stop": balance <= 0,
                    }

                new_credits = new_minutes * self.CREDITS_PER_MINUTE
                actual = await self._deduct_credits(
                    session["user_id"],
                    new_credits,
                    f"Step {step_number}: {new_minutes} min on {session['machine_id']}",
                    session_id,
                )

                session["charged_minutes"] = total_minutes
                session["credits_used"] = total_minutes * self.CREDITS_PER_MINUTE
                session["last_check"] = now

                balance = await self._get_user_balance(session["user_id"])

                logger.info(
                    f"Step {step_number} charge for session {session_id}: "
                    f"{actual} credits ({new_minutes} new min), balance: {balance}"
                )

                return {
                    "step": step_number,
                    "charged": actual,
                    "new_minutes": new_minutes,
                    "total_charged_minutes": total_minutes,
                    "total_credits_used": session["credits_used"],
                    "remaining_balance": balance,
                    "should_stop": balance <= 0,
                }

        except Exception as e:
            logger.error(f"Error in charge_step: {e}")
            return {"error": str(e), "should_stop": False}

    async def end_session(
        self,
        session_id: str,
        completion_status: str = "completed",
        error_message: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        End a billing session and calculate final charges
        Returns billing summary
        """
        try:
            if session_id not in self.active_sessions:
                logger.warning(f"Session {session_id} not found in active sessions")
                return {"error": "Session not found"}
            
            async with self.session_locks.get(session_id, asyncio.Lock()):
                session = self.active_sessions[session_id]
                ended_at = datetime.utcnow()
                
                # Calculate duration and credits
                duration_seconds = (ended_at - session["started_at"]).total_seconds()
                duration_minutes = math.ceil(duration_seconds / 60)  # Round up to nearest minute
                total_credits = duration_minutes * self.CREDITS_PER_MINUTE

                # Only charge the REMAINDER not already billed by charge_step()
                already_charged_minutes = session.get("charged_minutes", 0)
                remaining_minutes = duration_minutes - already_charged_minutes
                remaining_credits = remaining_minutes * self.CREDITS_PER_MINUTE

                actual_deducted = 0
                if remaining_credits > 0:
                    actual_deducted = await self._deduct_credits(
                        session["user_id"],
                        remaining_credits,
                        f"Final charge: {remaining_minutes} min on {session['machine_id']}",
                        session_id,
                    )

                    if actual_deducted == 0:
                        logger.error(f"Failed to deduct remaining credits for session {session_id}")
                    elif actual_deducted < remaining_credits:
                        logger.warning(
                            f"Partial final deduction for session {session_id}: "
                            f"{actual_deducted} of {remaining_credits} credits"
                        )

                # total_credits reflects everything actually charged across all steps + final
                already_charged_credits = already_charged_minutes * self.CREDITS_PER_MINUTE
                total_credits = already_charged_credits + actual_deducted
                
                # Update session in database
                if self.db_service.client:
                    update_data = {
                        "ended_at": ended_at.isoformat(),
                        "duration_seconds": int(duration_seconds),
                        "ai_completion_status": completion_status
                    }
                    
                    self.db_service.client.table("machine_sessions").update(
                        update_data
                    ).eq("id", session_id).execute()
                    
                    # Record usage for billing
                    usage_data = {
                        "user_id": session["user_id"],
                        "machine_id": session["machine_id"],
                        "period_start": session["started_at"].isoformat(),
                        "period_end": ended_at.isoformat(),
                        "cpu_seconds": duration_seconds,  # Simplified billing based on time
                        "estimated_cost": total_credits / 100  # Convert credits to dollars (1 credit = $0.01)
                    }
                    
                    self.db_service.client.table("machine_usage").insert(usage_data).execute()
                
                # Cancel credit check task
                if session_id in self.credit_check_tasks:
                    task = self.credit_check_tasks[session_id]
                    task.cancel()
                    # Wait for task to complete cancellation
                    try:
                        await asyncio.wait_for(task, timeout=1.0)
                    except (asyncio.CancelledError, asyncio.TimeoutError):
                        pass  # Expected when task is cancelled
                    del self.credit_check_tasks[session_id]
                
                # Remove from active sessions
                del self.active_sessions[session_id]
                if session_id in self.session_locks:
                    del self.session_locks[session_id]
                
                # Get final balance
                final_balance = await self._get_user_balance(session["user_id"])
                
                billing_summary = {
                    "session_id": session_id,
                    "duration_seconds": int(duration_seconds),
                    "duration_minutes": duration_minutes,
                    "credits_charged": total_credits,
                    "final_balance": final_balance,
                    "completion_status": completion_status
                }
                
                logger.info(f"Ended session {session_id}: {duration_minutes} min, {total_credits} credits charged")
                analytics.track_agent_session_ended(session["user_id"], session_id, duration_minutes, total_credits, completion_status)
                return billing_summary
                
        except Exception as e:
            logger.error(f"Error ending billing session: {str(e)}")
            return {"error": str(e)}
    
    async def _periodic_credit_check(self, session_id: str):
        """
        Periodically check if user has sufficient credits
        Warn or terminate session if credits are low
        """
        try:
            while session_id in self.active_sessions:
                try:
                    await asyncio.sleep(self.CHECK_INTERVAL_SECONDS)
                except asyncio.CancelledError:
                    # Task was cancelled, exit gracefully
                    logger.debug(f"Credit check task cancelled for session {session_id}")
                    break
                
                if session_id not in self.active_sessions:
                    break
                
                async with self.session_locks.get(session_id, asyncio.Lock()):
                    session = self.active_sessions.get(session_id)
                    if not session:
                        break
                    
                    # Calculate current usage
                    current_time = datetime.utcnow()
                    duration_seconds = (current_time - session["started_at"]).total_seconds()
                    
                    # Check for max session duration
                    if duration_seconds > self.MAX_SESSION_DURATION:
                        logger.warning(f"Session {session_id} exceeded max duration, ending")
                        await self.end_session(session_id, "timeout", "Maximum session duration exceeded")
                        break
                    
                    # Calculate credits used so far
                    duration_minutes = math.ceil(duration_seconds / 60)
                    credits_used = duration_minutes * self.CREDITS_PER_MINUTE
                    
                    # Get current balance
                    balance = await self._get_user_balance(session["user_id"])
                    
                    # Calculate remaining runtime
                    remaining_credits = balance
                    remaining_minutes = remaining_credits // self.CREDITS_PER_MINUTE
                    
                    # Log current status
                    logger.debug(f"Session {session_id}: {duration_minutes} min used, "
                               f"{credits_used} credits, balance: {balance}")
                    
                    # Check if we need to warn or stop
                    if balance <= 0:
                        logger.error(f"User {session['user_id']} out of credits, ending session")
                        await self.end_session(session_id, "insufficient_credits", "Out of credits")
                        break
                    elif balance < self.MIN_BALANCE_WARNING and session["warnings_sent"] == 0:
                        logger.warning(f"User {session['user_id']} low on credits ({balance} remaining)")
                        session["warnings_sent"] = 1
                        # Could send notification to user here
                    elif remaining_minutes <= 2 and session["warnings_sent"] < 2:
                        logger.warning(f"Session {session_id} has {remaining_minutes} minutes of credits left")
                        session["warnings_sent"] = 2
                    
                    session["last_check"] = current_time
                    session["credits_used"] = credits_used
                    
        except asyncio.CancelledError:
            logger.info(f"Credit check task cancelled for session {session_id}")
        except Exception as e:
            logger.error(f"Error in periodic credit check: {str(e)}")
    
    async def _get_user_balance(self, user_id: str) -> int:
        """Get user's current credit balance"""
        try:
            if not self.db_service.client:
                return 0
            
            response = self.db_service.client.table("user_credits").select("balance").eq(
                "user_id", user_id
            ).single().execute()
            
            if response and response.data:
                return response.data.get("balance", 0)
            return 0
            
        except Exception as e:
            logger.error(f"Error getting user balance: {str(e)}")
            return 0
    
    async def _deduct_credits(
        self,
        user_id: str,
        amount: int,
        description: str,
        session_id: str
    ) -> int:
        """
        Deduct credits from user balance (partial deduction if insufficient)
        Returns the actual amount deducted
        """
        try:
            if not self.db_service.client:
                return 0
            
            # Use the new partial deduction function
            response = self.db_service.client.rpc(
                "deduct_credits_partial",
                {
                    "p_user_id": user_id,
                    "p_amount": amount,
                    "p_resource_type": "virtual_machine",
                    "p_resource_id": session_id,
                    "p_description": description
                }
            ).execute()
            
            if response and response.data is not None:
                actual_deducted = response.data
                if actual_deducted < amount:
                    logger.warning(f"Partial deduction for user {user_id}: {actual_deducted} of {amount} credits")
                return actual_deducted
            return 0
            
        except Exception as e:
            logger.error(f"Error deducting credits: {str(e)}")
            return 0
    
    async def check_balance_for_session(self, user_id: str) -> Dict[str, Any]:
        """Check if user has enough balance to start a session"""
        balance = await self._get_user_balance(user_id)
        can_start = balance >= self.MIN_BALANCE_REQUIRED
        estimated_minutes = balance // self.CREDITS_PER_MINUTE if balance > 0 else 0
        
        return {
            "can_start": can_start,
            "current_balance": balance,
            "required_balance": self.MIN_BALANCE_REQUIRED,
            "estimated_runtime_minutes": estimated_minutes,
            "credits_per_minute": self.CREDITS_PER_MINUTE
        }
    
    async def get_session_status(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get current status of a billing session"""
        if session_id not in self.active_sessions:
            return None
        
        session = self.active_sessions[session_id]
        current_time = datetime.utcnow()
        duration_seconds = (current_time - session["started_at"]).total_seconds()
        duration_minutes = math.ceil(duration_seconds / 60)
        credits_used = duration_minutes * self.CREDITS_PER_MINUTE
        balance = await self._get_user_balance(session["user_id"])
        
        return {
            "session_id": session_id,
            "user_id": session["user_id"],
            "machine_id": session["machine_id"],
            "started_at": session["started_at"].isoformat(),
            "duration_seconds": int(duration_seconds),
            "duration_minutes": duration_minutes,
            "credits_used": credits_used,
            "current_balance": balance,
            "remaining_minutes": balance // self.CREDITS_PER_MINUTE if balance > 0 else 0
        }
    
    async def cleanup_orphaned_sessions(self, max_age_hours: int = 2):
        """Clean up sessions that were not properly ended"""
        try:
            if not self.db_service.client:
                return
            
            # Find sessions that are still "in_progress" but older than max_age
            cutoff_time = (datetime.utcnow() - timedelta(hours=max_age_hours)).isoformat()
            
            response = self.db_service.client.table("machine_sessions").select(
                "id, user_id, machine_id, started_at"
            ).eq(
                "ai_completion_status", "in_progress"
            ).lt(
                "started_at", cutoff_time
            ).execute()
            
            if response and response.data:
                for session in response.data:
                    logger.warning(f"Cleaning up orphaned session {session['id']}")
                    
                    # Calculate and charge for the time used
                    started_at = datetime.fromisoformat(session["started_at"].replace("Z", "+00:00"))
                    duration_seconds = min(
                        (datetime.utcnow() - started_at).total_seconds(),
                        self.MAX_SESSION_DURATION
                    )
                    duration_minutes = math.ceil(duration_seconds / 60)
                    total_credits = duration_minutes * self.CREDITS_PER_MINUTE
                    
                    # Deduct credits (partial if insufficient balance)
                    actual_deducted = await self._deduct_credits(
                        session["user_id"],
                        total_credits,
                        f"Orphaned session cleanup for machine {session['machine_id']}",
                        session["id"]
                    )
                    
                    if actual_deducted < total_credits:
                        logger.info(f"Partial deduction for orphaned session: {actual_deducted} of {total_credits}")
                    
                    # Update session status
                    self.db_service.client.table("machine_sessions").update({
                        "ended_at": datetime.utcnow().isoformat(),
                        "duration_seconds": int(duration_seconds),
                        "ai_completion_status": "failed"
                    }).eq("id", session["id"]).execute()
                    
                    logger.info(f"Cleaned up orphaned session {session['id']}, charged {total_credits} credits")
                    
        except Exception as e:
            logger.error(f"Error cleaning up orphaned sessions: {str(e)}")


# Global instance
agent_billing_service = AgentBillingService()