"""
AI Provider service — simplified for Amazon Bedrock only.
"""

import os
import logging
from typing import Dict, Optional, Any

from app.providers.bedrock_provider import BedrockProvider
from app.core.config import settings

logger = logging.getLogger(__name__)


class AIProviderService:
    """Service for managing the Bedrock provider."""

    def __init__(self):
        self._provider = BedrockProvider()

    def get_provider(self, model_id: str) -> BedrockProvider:
        """Get the Bedrock provider (all models route through Bedrock)."""
        return self._provider

    def is_model_available(self, model_id: str, user_id: Optional[str] = None) -> bool:
        """Check if a model is available — requires AWS credentials."""
        if model_id in settings.FREE_MODELS:
            return True
        # Available if AWS credentials are configured
        return bool(os.environ.get("AWS_ACCESS_KEY_ID"))
