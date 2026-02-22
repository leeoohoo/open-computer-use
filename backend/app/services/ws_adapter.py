"""
WebSocket Adapter - Makes FastAPI WebSocket compatible with the websockets library interface.

The VMControlService uses the `websockets` library API (.send(), .recv(), .state, .ping()).
Electron connections arrive as FastAPI WebSocket objects which have a different API.
This adapter bridges the gap so execute_command() works transparently with both.
"""

import asyncio
import json
import logging
from enum import IntEnum

logger = logging.getLogger(__name__)


class _AdapterState(IntEnum):
    """Mirror websockets.protocol.State for compatibility."""
    OPEN = 1
    CLOSED = 4


class FastAPIWebSocketAdapter:
    """Wraps a FastAPI WebSocket to match the websockets library interface."""

    def __init__(self, ws):
        self._ws = ws
        self._closed = False

    @property
    def state(self):
        if self._closed:
            return _AdapterState.CLOSED
        return _AdapterState.OPEN

    async def send(self, data: str):
        """Send a text message (matches websockets.WebSocketClientProtocol.send)."""
        try:
            await self._ws.send_text(data)
        except Exception as e:
            self._closed = True
            raise

    async def recv(self):
        """Receive a text message (matches websockets.WebSocketClientProtocol.recv)."""
        try:
            return await self._ws.receive_text()
        except Exception as e:
            self._closed = True
            raise

    async def ping(self):
        """Send a ping. FastAPI WebSocket doesn't have native ping, so send a JSON ping."""
        fut = asyncio.get_event_loop().create_future()
        try:
            await self._ws.send_text(json.dumps({"type": "ping"}))
            # Resolve immediately - we don't wait for pong in this adapter
            fut.set_result(None)
        except Exception as e:
            self._closed = True
            fut.set_exception(e)
        return fut

    async def close(self, code: int = 1000, reason: str = ""):
        """Close the WebSocket connection."""
        self._closed = True
        try:
            await self._ws.close(code=code, reason=reason)
        except Exception:
            pass

    @property
    def closed(self):
        return self._closed
