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
from app.api.routes import chat, chats, health, models, search, vm_control, screenshots, billing, file_operations, electron_bridge, schedules
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

    yield

    # Shutdown
    logger.info("Shutting down Coasty Backend Server")
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