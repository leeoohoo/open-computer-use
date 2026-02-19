"""
Amazon Bedrock provider — single provider replacing all previous AI providers.
Uses boto3 bedrock-runtime client with AWS credentials from settings.
"""

import logging
from typing import Optional

import boto3

from app.core.config import settings

logger = logging.getLogger(__name__)


class BedrockProvider:
    """Single provider that routes all model calls through Amazon Bedrock."""

    def __init__(self):
        self.name = "bedrock"
        self.api_key = None  # Not used — AWS credentials from settings
        self.client = None
        self.initialized = False
        # Expose AWS credentials so CUA executor can read them
        self.aws_access_key_id = settings.AWS_ACCESS_KEY_ID
        self.aws_secret_access_key = settings.AWS_SECRET_ACCESS_KEY
        self.aws_region = settings.AWS_REGION

    def initialize(self, api_key: Optional[str] = None):
        """Create boto3 bedrock-runtime client using settings credentials."""
        if not self.aws_access_key_id or not self.aws_secret_access_key:
            logger.warning("AWS credentials not set in settings — BedrockProvider will rely on boto3 default credential chain")

        self.client = boto3.client(
            "bedrock-runtime",
            region_name=self.aws_region,
            aws_access_key_id=self.aws_access_key_id,
            aws_secret_access_key=self.aws_secret_access_key,
        )
        self.initialized = True
        logger.info(f"BedrockProvider initialized (region={self.aws_region})")
