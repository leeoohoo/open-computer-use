"""
API routes for the auto-blog engine.
- POST /api/auto-blog/trigger — manually trigger a generation run
- GET /api/auto-blog/status — check engine status and stats
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Request, HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auto-blog", tags=["auto-blog"])


def _check_auth(request: Request):
    """Verify internal API key."""
    key = request.headers.get("x-internal-key") or ""
    if not settings.INTERNAL_API_KEY or key != settings.INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.post("/trigger")
async def trigger_generation(request: Request):
    """Manually trigger a blog generation run (doesn't wait for daily schedule)."""
    _check_auth(request)

    from app.services.auto_blog import auto_blog_engine
    import asyncio

    # Run in background so the request returns immediately
    asyncio.create_task(auto_blog_engine.run_daily_generation())

    return {
        "status": "triggered",
        "message": "Blog generation started in background. Check logs for progress.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/status")
async def get_status(request: Request):
    """Get auto-blog engine status and content stats."""
    _check_auth(request)

    from app.services.auto_blog import auto_blog_engine

    auto_blog_engine._init_clients()

    stats = {
        "engine": "running",
        "bedrock_configured": auto_blog_engine.bedrock_client is not None,
        "supabase_configured": auto_blog_engine.supabase is not None,
        "search_configured": bool(settings.GOOGLE_SEARCH_KEY and settings.GOOGLE_SEARCH_CX),
    }

    if auto_blog_engine.supabase:
        try:
            blog_count = auto_blog_engine.supabase.table("blog_posts").select("id", count="exact").execute()
            seo_count = auto_blog_engine.supabase.table("seo_pages").select("slug", count="exact").execute()
            stats["blog_posts_count"] = blog_count.count or 0
            stats["seo_pages_count"] = seo_count.count or 0
        except Exception as e:
            stats["db_error"] = str(e)

    return stats
