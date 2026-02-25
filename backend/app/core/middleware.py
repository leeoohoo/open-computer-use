"""
Custom middleware for the FastAPI application
"""

import hmac
import time
import logging
import hashlib
from typing import Dict, Optional
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import Request, Response, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings

logger = logging.getLogger(__name__)


async def _safe_call_next(call_next, request: Request) -> Response:
    """Wrapper around call_next that handles client disconnects during streaming.

    Starlette's BaseHTTPMiddleware raises RuntimeError("No response returned.")
    when the client disconnects mid-stream (e.g. SSE). This is expected behavior,
    not a real error.
    """
    try:
        return await call_next(request)
    except RuntimeError as exc:
        if "No response returned" in str(exc):
            logger.debug(f"Client disconnected during {request.method} {request.url.path}")
            return Response(status_code=204)
        raise


class InternalAPIKeyMiddleware(BaseHTTPMiddleware):
    """Gate that requires either a shared internal key OR a valid Supabase JWT.

    Accepts requests that satisfy at least one of:
      1. X-Internal-Key header matching INTERNAL_API_KEY  (Next.js proxy)
      2. Authorization: Bearer <jwt> verified against Supabase  (Electron app)

    If INTERNAL_API_KEY is empty the middleware is a no-op (backward compat for dev).
    """

    _SKIP_PATHS = frozenset(["/", "/api/health", "/docs", "/redoc", "/openapi.json"])

    async def dispatch(self, request: Request, call_next):
        key = settings.INTERNAL_API_KEY
        if not key:
            return await _safe_call_next(call_next, request)

        # Let health / docs through
        if request.url.path in self._SKIP_PATHS:
            return await _safe_call_next(call_next, request)

        # CORS preflight requests never carry auth headers — let them through
        if request.method == "OPTIONS":
            return await _safe_call_next(call_next, request)

        # WebSocket upgrades (Electron) use their own auth handshake
        if request.headers.get("upgrade", "").lower() == "websocket":
            return await _safe_call_next(call_next, request)

        # Path 1: internal shared key (server-to-server from Next.js proxy)
        provided_key = request.headers.get("X-Internal-Key", "")
        if provided_key and hmac.compare_digest(provided_key, key):
            # Trust X-User-ID set by the proxy (it verified the user via Supabase)
            x_user_id = request.headers.get("X-User-ID")
            if x_user_id:
                request.state.verified_user_id = x_user_id
            return await _safe_call_next(call_next, request)

        # Path 2: Supabase Bearer token (Electron desktop app)
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer ") and settings.SUPABASE_URL and settings.SUPABASE_ANON_KEY:
            token = auth_header[7:]
            jwt_user_id = await self._verify_supabase_token(token)
            if jwt_user_id:
                request.state.verified_user_id = jwt_user_id
                return await _safe_call_next(call_next, request)

        logger.warning(f"Rejected request to {request.url.path} — no valid credential")
        return JSONResponse(
            status_code=403,
            content={"error": "Forbidden"},
        )

    @staticmethod
    async def _verify_supabase_token(token: str) -> Optional[str]:
        """Verify a Supabase JWT. Returns the user_id if valid, None otherwise."""
        import httpx
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{settings.SUPABASE_URL}/auth/v1/user",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "apikey": settings.SUPABASE_ANON_KEY,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("id")
                return None
        except Exception:
            return None


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware"""
    
    def __init__(self, app):
        super().__init__(app)
        self.requests: Dict[str, list] = defaultdict(list)
        self.hourly_requests: Dict[str, list] = defaultdict(list)
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path in ["/", "/api/health", "/docs", "/redoc", "/openapi.json"]:
            return await _safe_call_next(call_next, request)
        
        # Get client identifier (IP address or user ID)
        client_id = request.client.host if request.client else "unknown"
        
        # Check if user ID is in headers
        if "X-User-ID" in request.headers:
            client_id = request.headers["X-User-ID"]
        
        now = datetime.now()
        minute_ago = now - timedelta(minutes=1)
        hour_ago = now - timedelta(hours=1)
        
        # Clean old requests
        self.requests[client_id] = [
            req_time for req_time in self.requests[client_id]
            if req_time > minute_ago
        ]
        self.hourly_requests[client_id] = [
            req_time for req_time in self.hourly_requests[client_id]
            if req_time > hour_ago
        ]
        
        # Check rate limits
        if len(self.requests[client_id]) >= settings.RATE_LIMIT_PER_MINUTE:
            logger.warning(f"Rate limit exceeded for {client_id} (per minute)")
            return JSONResponse(
                status_code=429,
                content={"error": "Rate limit exceeded. Please wait before making more requests."}
            )
        
        if len(self.hourly_requests[client_id]) >= settings.RATE_LIMIT_PER_HOUR:
            logger.warning(f"Rate limit exceeded for {client_id} (per hour)")
            return JSONResponse(
                status_code=429,
                content={"error": "Hourly rate limit exceeded. Please wait before making more requests."}
            )
        
        # Record the request
        self.requests[client_id].append(now)
        self.hourly_requests[client_id].append(now)
        
        # Process the request
        return await _safe_call_next(call_next, request)


class CSRFMiddleware(BaseHTTPMiddleware):
    """CSRF protection middleware"""
    
    def __init__(self, app):
        super().__init__(app)
        self.secret = settings.CSRF_SECRET or "default-csrf-secret"
    
    async def dispatch(self, request: Request, call_next):
        # Skip CSRF for GET, HEAD, OPTIONS requests
        if request.method in ["GET", "HEAD", "OPTIONS"]:
            return await _safe_call_next(call_next, request)
        
        # Skip CSRF for certain paths and API routes
        skip_paths = [
            "/", "/api/health", "/docs", "/redoc", "/openapi.json",
            "/api/chat/", "/api/models/", "/api/search/", "/api/vm/"
        ]
        
        # Check if path should skip CSRF
        if any(request.url.path.startswith(path) for path in skip_paths):
            return await _safe_call_next(call_next, request)

        # In development mode, skip CSRF entirely
        if settings.DEBUG:
            return await _safe_call_next(call_next, request)

        # Check for CSRF token in headers
        csrf_token = request.headers.get("X-CSRF-Token")

        if not csrf_token:
            logger.warning(f"Missing CSRF token for {request.url.path}")
            return JSONResponse(
                status_code=403,
                content={"error": "CSRF token missing"}
            )

        # Validate CSRF token (simple implementation)
        # In production, use a more secure validation method
        expected_token = self._generate_token(request)

        if csrf_token != expected_token:
            logger.warning(f"Invalid CSRF token for {request.url.path}")
            return JSONResponse(
                status_code=403,
                content={"error": "Invalid CSRF token"}
            )

        return await _safe_call_next(call_next, request)
    
    def _generate_token(self, request: Request) -> str:
        """Generate a CSRF token"""
        # This is a simplified implementation
        # In production, use session-based tokens
        data = f"{self.secret}:{request.client.host if request.client else 'unknown'}"
        return hashlib.sha256(data.encode()).hexdigest()


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Request/Response logging middleware"""
    
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(time.time()))
        
        # Log request
        logger.info(f"Request {request_id}: {request.method} {request.url.path}")
        
        # Add request ID to response headers
        start_time = time.time()
        
        try:
            response = await call_next(request)

            # Calculate process time
            process_time = time.time() - start_time

            # Add headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Process-Time"] = str(process_time)

            # Log response
            logger.info(
                f"Response {request_id}: {response.status_code} "
                f"({process_time:.3f}s)"
            )

            return response

        except RuntimeError as e:
            if "No response returned" in str(e):
                process_time = time.time() - start_time
                logger.debug(
                    f"Request {request_id}: client disconnected ({process_time:.3f}s)"
                )
                return Response(status_code=204)
            raise

        except Exception as e:
            process_time = time.time() - start_time
            logger.error(
                f"Request {request_id} failed after {process_time:.3f}s: {str(e)}"
            )
            raise