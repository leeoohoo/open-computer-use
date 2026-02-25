"""
Authentication service
"""

import logging
from typing import Optional, Dict, Any

from fastapi import Request, HTTPException

from app.services.database import DatabaseService

logger = logging.getLogger(__name__)

db_service = DatabaseService()


async def validate_user(user_id: str) -> Optional[str]:
    """Validate user exists and is active. Returns user_id string if valid."""

    try:
        user = await db_service.get_user(user_id)

        if not user:
            logger.warning(f"User {user_id} not found")
            return None

        # Check if user is active (if there's such a field)
        if user.get("status") == "inactive":
            logger.warning(f"User {user_id} is inactive")
            return None

        return user_id

    except Exception as e:
        logger.error(f"Error validating user {user_id}: {str(e)}")
        return None


async def get_verified_user_id(request: Request) -> str:
    """FastAPI dependency: extract the user_id that was verified by the auth middleware.

    The InternalAPIKeyMiddleware sets ``request.state.verified_user_id``
    after validating the internal key (Next.js proxy) or the Supabase JWT
    (Electron app).  This dependency reads that value so endpoints don't
    need to trust a client-supplied query parameter.
    """
    uid: Optional[str] = getattr(request.state, "verified_user_id", None)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Ensure the user is still active in the database
    valid = await validate_user(uid)
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid user")

    return uid
