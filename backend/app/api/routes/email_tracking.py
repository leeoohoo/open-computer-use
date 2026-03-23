"""
Email Campaign Tracking Endpoints

Public (unauthenticated) endpoints for email open/click/unsubscribe tracking.
These must bypass all auth middleware.

Routes (mounted at /api/t):
    GET /o/{recipient_id}  — Open tracking pixel (1x1 transparent GIF)
    GET /c/{recipient_id}  — Click tracking redirect
    GET /u/{recipient_id}  — Unsubscribe page
    POST /u/{recipient_id} — RFC 8058 One-Click Unsubscribe
"""

import base64
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse, Response

logger = logging.getLogger(__name__)
router = APIRouter()

# 1x1 transparent GIF (43 bytes)
TRACKING_PIXEL = base64.b64decode(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
)


def _get_db():
    """Lazy import to avoid circular deps at module load."""
    from supabase import create_client
    from app.core.config import settings
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE or settings.SUPABASE_ANON_KEY)


def _record_open(recipient_id: str, user_agent: str, ip: str):
    """Background task: record an open event."""
    try:
        db = _get_db()
        # Get recipient to find campaign_id
        result = db.table("email_recipients").select("id,campaign_id,opened_at").eq("id", recipient_id).execute()
        if not result.data:
            return
        recipient = result.data[0]

        # Insert event (always — tracks repeat opens)
        db.table("email_events").insert({
            "campaign_id": recipient["campaign_id"],
            "recipient_id": recipient_id,
            "event_type": "opened",
            "user_agent": (user_agent or "")[:500],
            "ip_address": (ip or "")[:50],
        }).execute()

        # Update recipient status (only first open)
        if not recipient.get("opened_at"):
            now = datetime.now(timezone.utc).isoformat()
            db.table("email_recipients").update({
                "status": "opened",
                "opened_at": now,
            }).eq("id", recipient_id).execute()

    except Exception as e:
        logger.error(f"Failed to record open for {recipient_id}: {e}")


def _record_click(recipient_id: str, link_url: str, user_agent: str, ip: str):
    """Background task: record a click event."""
    try:
        db = _get_db()
        result = db.table("email_recipients").select("id,campaign_id,clicked_at").eq("id", recipient_id).execute()
        if not result.data:
            return
        recipient = result.data[0]

        db.table("email_events").insert({
            "campaign_id": recipient["campaign_id"],
            "recipient_id": recipient_id,
            "event_type": "clicked",
            "link_url": (link_url or "")[:2000],
            "user_agent": (user_agent or "")[:500],
            "ip_address": (ip or "")[:50],
        }).execute()

        if not recipient.get("clicked_at"):
            now = datetime.now(timezone.utc).isoformat()
            db.table("email_recipients").update({
                "status": "clicked",
                "clicked_at": now,
            }).eq("id", recipient_id).execute()

    except Exception as e:
        logger.error(f"Failed to record click for {recipient_id}: {e}")


def _record_unsubscribe(recipient_id: str):
    """Background task: record an unsubscribe."""
    try:
        db = _get_db()
        result = db.table("email_recipients").select("id,campaign_id,email").eq("id", recipient_id).execute()
        if not result.data:
            return
        recipient = result.data[0]

        # Add to unsubscribe list
        db.table("email_unsubscribes").upsert({
            "email": recipient["email"],
            "campaign_id": recipient["campaign_id"],
            "reason": "user_clicked_unsubscribe",
        }, on_conflict="email").execute()

        # Update recipient
        db.table("email_recipients").update({
            "status": "unsubscribed",
        }).eq("id", recipient_id).execute()

        # Log event
        db.table("email_events").insert({
            "campaign_id": recipient["campaign_id"],
            "recipient_id": recipient_id,
            "event_type": "unsubscribed",
        }).execute()

    except Exception as e:
        logger.error(f"Failed to record unsubscribe for {recipient_id}: {e}")


@router.get("/o/{recipient_id}")
async def track_open(recipient_id: str, request: Request, background_tasks: BackgroundTasks):
    """Open tracking pixel — returns 1x1 transparent GIF."""
    ua = request.headers.get("user-agent", "")
    ip = request.client.host if request.client else ""
    background_tasks.add_task(_record_open, recipient_id, ua, ip)
    return Response(
        content=TRACKING_PIXEL,
        media_type="image/gif",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"},
    )


@router.get("/c/{recipient_id}")
async def track_click(
    recipient_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    url: str = Query(..., description="Base64-encoded original URL"),
):
    """Click tracking redirect — decodes URL and redirects."""
    try:
        # Add padding if needed
        padded = url + "=" * (-len(url) % 4)
        original_url = base64.urlsafe_b64decode(padded).decode("utf-8")
    except Exception:
        original_url = "https://coasty.ai"

    ua = request.headers.get("user-agent", "")
    ip = request.client.host if request.client else ""
    background_tasks.add_task(_record_click, recipient_id, original_url, ua, ip)
    return RedirectResponse(url=original_url, status_code=302)


@router.get("/u/{recipient_id}", response_class=HTMLResponse)
async def unsubscribe_page(recipient_id: str, background_tasks: BackgroundTasks):
    """Unsubscribe confirmation page."""
    background_tasks.add_task(_record_unsubscribe, recipient_id)
    return HTMLResponse(content="""
    <!DOCTYPE html>
    <html>
    <head><title>Unsubscribed</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex;
               justify-content: center; align-items: center; min-height: 100vh;
               background: #f4f4f7; margin: 0; }
        .card { background: white; padding: 48px; border-radius: 12px; text-align: center;
                box-shadow: 0 2px 8px rgba(0,0,0,0.06); max-width: 400px; }
        h1 { font-size: 24px; color: #111; margin: 0 0 12px; }
        p { color: #666; font-size: 15px; line-height: 1.6; }
        a { color: #2563eb; }
    </style>
    </head>
    <body>
    <div class="card">
        <h1>You've been unsubscribed</h1>
        <p>You won't receive any more marketing emails from Coasty.</p>
        <p>If this was a mistake, contact us at <a href="mailto:hello@coasty.ai">hello@coasty.ai</a>.</p>
    </div>
    </body>
    </html>
    """)


@router.post("/u/{recipient_id}")
async def unsubscribe_oneclick(recipient_id: str, background_tasks: BackgroundTasks):
    """RFC 8058 One-Click Unsubscribe (POST)."""
    background_tasks.add_task(_record_unsubscribe, recipient_id)
    return Response(status_code=200)
