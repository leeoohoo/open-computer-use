"""
Provider factory — simplified for Amazon Bedrock only.
All models route through a single BedrockProvider.
"""

import logging
from typing import Optional

from app.providers.bedrock_provider import BedrockProvider

logger = logging.getLogger(__name__)


class ProviderFactory:
    """Factory that returns a BedrockProvider for any model."""

    def __init__(self):
        self._provider: Optional[BedrockProvider] = None

    def get_provider(self, model_id: str) -> BedrockProvider:
        """Return the singleton BedrockProvider for any model ID."""
        if self._provider is None:
            self._provider = BedrockProvider()
        return self._provider
