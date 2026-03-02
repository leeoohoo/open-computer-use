"""
PostHog Analytics Service — Server-side event tracking
Tracks agent sessions, billing events, schedule executions, and electron connections.
"""

import logging
import os
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

_client = None
_disabled = False


def _get_client():
    global _client, _disabled
    if _disabled:
        return None
    if _client is not None:
        return _client

    api_key = os.environ.get("POSTHOG_API_KEY")
    host = os.environ.get("POSTHOG_HOST", "https://us.i.posthog.com")

    if not api_key:
        logger.info("POSTHOG_API_KEY not set — analytics disabled")
        _disabled = True
        return None

    try:
        import posthog
        posthog.project_api_key = api_key
        posthog.host = host
        _client = posthog
        logger.info("PostHog analytics initialized")
        return _client
    except ImportError:
        logger.warning("posthog package not installed — analytics disabled")
        _disabled = True
        return None


def capture(user_id: str, event: str, properties: Optional[Dict[str, Any]] = None):
    """Send an analytics event to PostHog."""
    client = _get_client()
    if not client:
        return
    try:
        client.capture(distinct_id=user_id, event=event, properties=properties or {})
    except Exception as e:
        logger.error(f"PostHog capture error: {e}")


def identify(user_id: str, properties: Dict[str, Any]):
    """Set user properties in PostHog."""
    client = _get_client()
    if not client:
        return
    try:
        client.identify(user_id, properties)
    except Exception as e:
        logger.error(f"PostHog identify error: {e}")


# ─── Agent Session Events ───

def track_agent_session_started(
    user_id: str,
    session_id: str,
    machine_id: str,
    model: str,
    objective: str = "",
):
    capture(user_id, "agent_session_started_server", {
        "session_id": session_id,
        "machine_id": machine_id,
        "model": model,
        "objective": objective[:200],
    })


def track_agent_session_ended(
    user_id: str,
    session_id: str,
    duration_minutes: int,
    credits_charged: int,
    status: str,
):
    capture(user_id, "agent_session_ended_server", {
        "session_id": session_id,
        "duration_minutes": duration_minutes,
        "credits_charged": credits_charged,
        "status": status,
    })


# ─── Billing Events ───

def track_credits_deducted(
    user_id: str,
    amount: int,
    balance_after: int,
    reason: str,
):
    capture(user_id, "credits_deducted", {
        "amount": amount,
        "balance_after": balance_after,
        "reason": reason,
    })


# ─── Schedule Events ───

def track_schedule_executed(
    user_id: str,
    chat_id: str,
    status: str,
    duration_seconds: int = 0,
    credits: int = 0,
):
    capture(user_id, "schedule_executed_server", {
        "chat_id": chat_id,
        "status": status,
        "duration_seconds": duration_seconds,
        "credits_charged": credits,
    })


# ─── Electron Events ───

def track_electron_connected(
    user_id: str,
    machine_id: str,
    platform: str,
):
    capture(user_id, "electron_connected_server", {
        "machine_id": machine_id,
        "platform": platform,
    })


# ─── Lifecycle ───

def flush():
    """Flush pending events. Call on app shutdown."""
    client = _get_client()
    if client:
        try:
            client.flush()
        except Exception:
            pass
