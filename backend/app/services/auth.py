"""
Authentication service
"""

import logging
from typing import Optional, Dict, Any

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
