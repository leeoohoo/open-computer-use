"""
Exception handlers and custom exceptions
"""

import logging
from typing import Any

from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class ChatError(Exception):
    """Base exception for chat-related errors"""
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class AuthenticationError(ChatError):
    """Authentication error"""
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, 401)


class RateLimitError(ChatError):
    """Rate limit exceeded error"""
    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(message, 429)


class ModelNotFoundError(ChatError):
    """Model not found error"""
    def __init__(self, model: str):
        super().__init__(f"Model {model} not found", 404)


class ProviderError(ChatError):
    """Provider-related error"""
    def __init__(self, provider: str, message: str):
        super().__init__(f"{provider}: {message}", 500)


def setup_exception_handlers(app: FastAPI):
    """Setup custom exception handlers"""
    
    @app.exception_handler(ChatError)
    async def chat_error_handler(request: Request, exc: ChatError):
        logger.error(f"Chat error: {exc.message}")
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.message}
        )
    
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        if exc.status_code >= 500:
            logger.error(f"HTTP error {exc.status_code}: {exc.detail}")
        else:
            logger.warning(f"HTTP error {exc.status_code}: {exc.detail}")
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": exc.detail}
        )
    
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.error(f"Validation error: {exc.errors()}")
        return JSONResponse(
            status_code=422,
            content={
                "error": "Validation error",
                "details": exc.errors()
            }
        )
    
    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"}
        )