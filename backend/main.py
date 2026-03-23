"""
Coasty Chat Backend - FastAPI Application
Main entry point for the Python backend server
"""

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

# Add the backend directory to path
sys.path.insert(0, str(Path(__file__).parent))
# Add backend/app to path so computer_use_agent internal imports resolve
sys.path.insert(0, str(Path(__file__).parent / "app"))

from app.core.config import settings
from app.core.logging import setup_logging
from app.api.routes import chat, chats, health, models, search, vm_control, screenshots, billing, file_operations, electron_bridge, schedules, swarm, osworld
from app.core.middleware import InternalAPIKeyMiddleware, RateLimitMiddleware, CSRFMiddleware
from app.core.exceptions import setup_exception_handlers

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle application startup and shutdown events"""
    # Startup
    logger.info(f"Starting Coasty Backend Server v1.0.0")
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"Debug mode: {settings.DEBUG}")
    
    # Initialize services
    from app.services.cache import cache_service
    from app.services.screenshot_storage import screenshot_storage
    from app.services.agent_billing import agent_billing_service
    from app.services.task_scheduler import task_scheduler
    from app.services import analytics
    import asyncio

    await cache_service.initialize()
    await screenshot_storage.initialize()

    # Clean up orphaned swarm machines from previous runs.
    # Swarm machines are temporary and must always be deleted.
    from app.services.swarm_cleanup import cleanup_orphaned_swarm_machines
    try:
        cleaned = await cleanup_orphaned_swarm_machines()
        if cleaned > 0:
            logger.info(f"Startup: cleaned up {cleaned} orphaned swarm machines")
    except Exception as e:
        logger.error(f"Startup swarm cleanup failed: {e}")

    # Start periodic cleanup task for orphaned sessions
    cleanup_task = None
    async def periodic_cleanup():
        """Run cleanup every hour"""
        while True:
            try:
                await asyncio.sleep(3600)  # Wait 1 hour
                logger.info("Running periodic orphaned session cleanup")
                await agent_billing_service.cleanup_orphaned_sessions(max_age_hours=2)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in periodic cleanup: {str(e)}")

    cleanup_task = asyncio.create_task(periodic_cleanup())

    # Start task scheduler for automated/recurring tasks
    scheduler_task = asyncio.create_task(task_scheduler.start())

    # Start status health check poller — runs checks directly on the backend
    # and persists to status_checks table using the backend's Supabase credentials.
    # This eliminates the need for SUPABASE_SERVICE_ROLE in the frontend container.
    import httpx
    status_check_task = None
    async def periodic_status_check():
        """Run service health checks every 60s and persist to status_checks."""
        await asyncio.sleep(30)  # Wait for services to be ready

        supabase_url = settings.SUPABASE_URL
        supabase_key = settings.SUPABASE_SERVICE_ROLE or settings.SUPABASE_ANON_KEY
        if not supabase_url or not supabase_key:
            logger.warning("Status checker: Supabase not configured, skipping")
            return

        from supabase import create_client
        db = create_client(supabase_url, settings.SUPABASE_SERVICE_ROLE or supabase_key)

        while True:
            try:
                from datetime import datetime, timezone
                now = datetime.now(timezone.utc).isoformat()
                checks = []

                async def check(name, fn):
                    import time
                    start = time.monotonic()
                    try:
                        await fn()
                        latency = int((time.monotonic() - start) * 1000)
                        checks.append({"service_name": name, "status": "operational", "latency": latency, "message": None, "checked_at": now})
                    except Exception as e:
                        checks.append({"service_name": name, "status": "outage", "latency": None, "message": str(e)[:200], "checked_at": now})

                # Website — check frontend is responding
                async def check_website():
                    frontend_url = settings.CORS_ORIGINS[0] if isinstance(settings.CORS_ORIGINS, list) and settings.CORS_ORIGINS else "http://localhost:3000"
                    async with httpx.AsyncClient(timeout=5) as c:
                        r = await c.get(f"{frontend_url}/api/health")
                        if r.status_code >= 500:
                            raise Exception(f"HTTP {r.status_code}")

                # AI Backend — self-check
                async def check_backend():
                    pass  # If this code is running, the backend is up

                # Database
                async def check_database():
                    async with httpx.AsyncClient(timeout=5) as c:
                        r = await c.get(f"{supabase_url}/rest/v1/", headers={"apikey": supabase_key})
                        if r.status_code >= 500:
                            raise Exception(f"HTTP {r.status_code}")

                # Authentication
                async def check_auth():
                    async with httpx.AsyncClient(timeout=5) as c:
                        r = await c.get(f"{supabase_url}/auth/v1/health", headers={"apikey": supabase_key})
                        if not r.is_success:
                            raise Exception(f"HTTP {r.status_code}")

                # AI Models (Bedrock)
                async def check_models():
                    if settings.AWS_ACCESS_KEY_ID and settings.AWS_REGION:
                        import boto3
                        client = boto3.client("bedrock", region_name=settings.AWS_REGION,
                                              aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                                              aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY)
                        await asyncio.to_thread(client.list_foundation_models, byProvider="anthropic")
                    # If not configured, consider it operational (not an error)

                # File Storage
                async def check_storage():
                    async with httpx.AsyncClient(timeout=5) as c:
                        r = await c.get(f"{supabase_url}/storage/v1/bucket",
                                        headers={"apikey": supabase_key, "Authorization": f"Bearer {supabase_key}"})
                        if r.status_code >= 500:
                            raise Exception(f"HTTP {r.status_code}")

                await asyncio.gather(
                    check("Website", check_website),
                    check("AI Backend", check_backend),
                    check("Database", check_database),
                    check("Authentication", check_auth),
                    check("AI Models", check_models),
                    check("File Storage", check_storage),
                )

                # Persist to status_checks table
                if checks:
                    try:
                        db.table("status_checks").insert(checks).execute()
                        logger.debug(f"Status checks recorded: {len(checks)} services")
                    except Exception as e:
                        logger.debug(f"Failed to persist status checks: {e}")

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.debug(f"Status check cycle failed: {e}")
            await asyncio.sleep(60)  # Every 60 seconds

    status_check_task = asyncio.create_task(periodic_status_check())

    yield

    # Shutdown
    logger.info("Shutting down Coasty Backend Server")
    if status_check_task:
        status_check_task.cancel()
        try:
            await status_check_task
        except asyncio.CancelledError:
            pass
    if scheduler_task:
        scheduler_task.cancel()
        try:
            await scheduler_task
        except asyncio.CancelledError:
            pass
    if cleanup_task:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass
    await cache_service.close()
    analytics.flush()


# Create FastAPI app
app = FastAPI(
    title="Coasty Chat Backend",
    description="Python backend for Coasty multi-model AI chat application",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan
)

# Configure CORS
# Electron renderer sends Origin: null (file:// protocol), so we need
# allow_origin_regex to match both configured domains and Electron clients.
_cors_origins = [o for o in settings.CORS_ORIGINS if o != "*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins + ["null"],
    allow_origin_regex=r"^(https?://localhost(:\d+)?|file://.*|null)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Process-Time"],
)

# Add compression
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Add rate limiting
if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(RateLimitMiddleware)

# Add CSRF protection for state-changing operations
app.add_middleware(CSRFMiddleware)

# Internal API key gate — blocks direct access when INTERNAL_API_KEY is set
app.add_middleware(InternalAPIKeyMiddleware)

# Setup exception handlers
setup_exception_handlers(app)

# Include routers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(models.router, prefix="/api/models", tags=["models"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(vm_control.router, prefix="/api/vm", tags=["vm"])
app.include_router(screenshots.router, prefix="/api", tags=["screenshots"])
app.include_router(billing.router, prefix="/api/billing", tags=["billing"])
app.include_router(file_operations.router, prefix="/api/files", tags=["files"])
app.include_router(electron_bridge.router, prefix="/api/electron", tags=["electron"])
app.include_router(chats.router, prefix="/api/chats", tags=["chats"])
app.include_router(schedules.router, prefix="/api/schedules", tags=["schedules"])
app.include_router(swarm.router, prefix="/api/swarm", tags=["swarm"])
app.include_router(osworld.router, prefix="/api/osworld", tags=["osworld"])

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint"""
    return JSONResponse(
        content={
            "message": "Coasty Chat Backend API",
            "version": "1.0.0",
            "docs": "/docs" if settings.DEBUG else None,
        }
    )


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
        access_log=True,
        use_colors=True
    )