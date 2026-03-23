"""
Health check and status endpoints
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

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
        logger.warning(f"Readiness: database check failed: {e}")
        checks["database"] = "error"
        all_ok = False

    # Check Bedrock / model provider availability (run in thread to avoid blocking)
    try:
        if settings.AWS_ACCESS_KEY_ID and settings.AWS_REGION:
            checks["models"] = await asyncio.to_thread(_check_bedrock)
        else:
            checks["models"] = "not_configured"
    except Exception as e:
        logger.warning(f"Readiness: models check failed: {e}")
        checks["models"] = "error"
        all_ok = False

    status = "ready" if all_ok else "degraded"
    if not all_ok:
        logger.warning(f"Readiness check degraded: {checks}")

    # Always return 200 — the body contains the actual status details.
    # Returning 503 would cause the status page "AI Models" check to show
    # as outage even when the only issue is "not_configured".
    return JSONResponse(
        content={
            "status": status,
            **checks,
        },
        status_code=200,
    )


@router.get("/status/history")
async def status_history():
    """Return 90-day status check history from the database.

    Public endpoint (no auth required) — used by the frontend status page.
    Uses the backend's service role to bypass RLS.

    Paginates through Supabase results (default limit is 1000 rows)
    to ensure all history data is returned.
    """
    if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE:
        return JSONResponse(content={"services": [], "has_data": False})

    try:
        from collections import defaultdict
        from supabase import create_client
        db = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE)

        ninety_days_ago = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()

        # Supabase PostgREST returns max 1000 rows by default.
        # Paginate to get all rows. We aggregate per-day counts as we go
        # to keep memory bounded.
        service_days: dict[str, dict[str, dict]] = defaultdict(
            lambda: defaultdict(lambda: {"op": 0, "degraded": 0, "outage": 0, "latencies": []})
        )

        PAGE_SIZE = 1000
        offset = 0
        total_fetched = 0

        while True:
            result = (
                db.table("status_checks")
                .select("service_name, status, latency, checked_at")
                .gte("checked_at", ninety_days_ago)
                .order("checked_at", desc=False)
                .range(offset, offset + PAGE_SIZE - 1)
                .execute()
            )

            rows = result.data if result.data else []
            if not rows:
                break

            for row in rows:
                date = row["checked_at"].split("T")[0]
                day = service_days[row["service_name"]][date]
                status = row["status"]
                if status == "operational":
                    day["op"] += 1
                elif status == "degraded":
                    day["degraded"] += 1
                else:
                    day["outage"] += 1
                if row["latency"] is not None:
                    day["latencies"].append(row["latency"])

            total_fetched += len(rows)

            # Stop if we got fewer than a full page (no more data)
            if len(rows) < PAGE_SIZE:
                break

            offset += PAGE_SIZE

            # Safety cap — don't fetch more than 500K rows
            if total_fetched >= 500_000:
                break

        if total_fetched == 0:
            return JSONResponse(
                content={"services": [], "has_data": False},
                headers={"Cache-Control": "public, max-age=300"},
            )

        # Build response with all 90 days filled
        services = []
        today = datetime.now(timezone.utc).date()

        for service_name, day_map in service_days.items():
            days = []
            total_checks = 0
            total_operational = 0

            for i in range(89, -1, -1):
                d = today - timedelta(days=i)
                date_str = d.isoformat()
                day_data = day_map.get(date_str)

                if day_data:
                    checks = day_data["op"] + day_data["degraded"] + day_data["outage"]
                    op_count = day_data["op"]
                    non_op_ratio = (checks - op_count) / checks if checks else 0

                    if day_data["outage"] > 0 and non_op_ratio > 0.3:
                        day_status = "outage"
                    elif (day_data["degraded"] > 0 or day_data["outage"] > 0) and non_op_ratio > 0.1:
                        day_status = "degraded"
                    else:
                        day_status = "operational"

                    avg_latency = (
                        round(sum(day_data["latencies"]) / len(day_data["latencies"]))
                        if day_data["latencies"] else None
                    )

                    days.append({
                        "date": date_str,
                        "status": day_status,
                        "checks": checks,
                        "operational_count": op_count,
                        "avg_latency": avg_latency,
                    })
                    total_checks += checks
                    total_operational += op_count
                else:
                    days.append({
                        "date": date_str,
                        "status": "operational",
                        "checks": 0,
                        "operational_count": 0,
                        "avg_latency": None,
                    })

            uptime = round((total_operational / total_checks) * 10000) / 100 if total_checks else 100
            services.append({
                "service_name": service_name,
                "days": days,
                "uptime_percent": uptime,
            })

        return JSONResponse(
            content={"services": services, "has_data": True},
            headers={"Cache-Control": "public, max-age=60"},
        )

    except Exception as e:
        logger.error(f"Status history query failed: {e}")
        return JSONResponse(content={"services": [], "has_data": False})