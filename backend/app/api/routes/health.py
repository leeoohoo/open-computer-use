"""
Health check endpoints
"""

import asyncio
import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health_check():
    """Basic liveness check — is the process alive?"""
    return JSONResponse(
        content={
            "status": "healthy",
            "service": "llmhub-backend",
            "version": "1.0.0"
        }
    )


def _check_bedrock() -> str:
    """Synchronous Bedrock connectivity check (runs in thread pool)."""
    import boto3
    client = boto3.client(
        "bedrock",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )
    # list_foundation_models validates credentials + connectivity
    client.list_foundation_models(byProvider="anthropic")
    return "available"


@router.get("/ready")
async def readiness_check():
    """Readiness check — can the service handle requests?

    Verifies connectivity to Supabase and (optionally) Bedrock.
    Used by the status page to differentiate 'process alive' from 'fully operational'.
    """
    checks = {}
    all_ok = True

    # Check Supabase connectivity
    try:
        if settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{settings.SUPABASE_URL}/rest/v1/",
                    headers={"apikey": settings.SUPABASE_ANON_KEY},
                )
                checks["database"] = "connected" if resp.status_code < 500 else "error"
                if resp.status_code >= 500:
                    all_ok = False
        else:
            checks["database"] = "not_configured"
    except Exception as e:
        logger.debug(f"Readiness: database check failed: {e}")
        checks["database"] = "error"
        all_ok = False

    # Check Bedrock / model provider availability (run in thread to avoid blocking)
    try:
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_REGION:
            checks["models"] = await asyncio.to_thread(_check_bedrock)
        else:
            checks["models"] = "not_configured"
    except Exception as e:
        logger.debug(f"Readiness: models check failed: {e}")
        checks["models"] = "error"
        all_ok = False

    return JSONResponse(
        content={
            "status": "ready" if all_ok else "degraded",
            **checks,
        },
        status_code=200 if all_ok else 503,
    )