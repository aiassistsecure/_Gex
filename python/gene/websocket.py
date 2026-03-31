"""
Gene WebSocket Connection Manager
Handles real-time bidirectional communication between Electron renderer and Python runtime.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any, Callable, Dict, Optional

from fastapi import WebSocket

logger = logging.getLogger("gene.ws")


class ConnectionManager:
    """Manages WebSocket connections with JSON envelope protocol.

    Protocol envelope:
        {
            "type": "agent:run" | "project:analyze" | "system:ping" | ...,
            "payload": { ... },
            "id": "optional-correlation-id"
        }
    """

    def __init__(self):
        self._connections: Dict[str, WebSocket] = {}
        self._handlers: Dict[str, Callable] = {}

    async def connect(self, websocket: WebSocket) -> str:
        """Accept a WebSocket connection, return client ID."""
        await websocket.accept()
        client_id = str(uuid.uuid4())[:8]
        self._connections[client_id] = websocket
        logger.info(f"Client connected: {client_id} (total: {len(self._connections)})")

        # Send welcome
        await self.send_to(client_id, {
            "type": "system:connected",
            "payload": {"clientId": client_id},
        })
        return client_id

    def disconnect(self, client_id: str) -> None:
        """Remove a client connection."""
        self._connections.pop(client_id, None)
        logger.info(f"Client disconnected: {client_id} (total: {len(self._connections)})")

    async def disconnect_all(self) -> None:
        """Close all connections gracefully."""
        for client_id, ws in list(self._connections.items()):
            try:
                await ws.close()
            except Exception:
                pass
        self._connections.clear()

    def register_handler(self, message_type: str, handler: Callable) -> None:
        """Register a handler for a specific message type."""
        self._handlers[message_type] = handler

    async def handle_message(self, client_id: str, data: dict) -> None:
        """Route incoming messages to registered handlers."""
        msg_type = data.get("type", "")
        payload = data.get("payload", {})
        msg_id = data.get("id")

        # Built-in handlers
        if msg_type == "system:ping":
            await self.send_to(client_id, {
                "type": "system:pong",
                "id": msg_id,
                "payload": {},
            })
            return

        # Custom handlers
        handler = self._handlers.get(msg_type)
        if handler:
            try:
                result = await handler(client_id, payload)
                if result is not None:
                    await self.send_to(client_id, {
                        "type": f"{msg_type}:result",
                        "id": msg_id,
                        "payload": result,
                    })
            except Exception as e:
                logger.error(f"Handler error for {msg_type}: {e}")
                await self.send_to(client_id, {
                    "type": "system:error",
                    "id": msg_id,
                    "payload": {"error": str(e), "source": msg_type},
                })
        else:
            logger.warning(f"No handler for message type: {msg_type}")
            await self.send_to(client_id, {
                "type": "system:unhandled",
                "id": msg_id,
                "payload": {"type": msg_type},
            })

    async def send_to(self, client_id: str, message: dict) -> None:
        """Send a message to a specific client."""
        ws = self._connections.get(client_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Send error to {client_id}: {e}")
                self.disconnect(client_id)

    async def broadcast(self, message: dict, exclude: Optional[str] = None) -> None:
        """Broadcast message to all connected clients."""
        for client_id in list(self._connections.keys()):
            if client_id != exclude:
                await self.send_to(client_id, message)

    async def stream_to(
        self,
        client_id: str,
        msg_type: str,
        chunks: Any,
        msg_id: Optional[str] = None,
    ) -> None:
        """Stream chunked data to a client (async generator support)."""
        async for chunk in chunks:
            await self.send_to(client_id, {
                "type": f"{msg_type}:chunk",
                "id": msg_id,
                "payload": chunk,
            })

        await self.send_to(client_id, {
            "type": f"{msg_type}:done",
            "id": msg_id,
            "payload": {},
        })

    @property
    def client_count(self) -> int:
        return len(self._connections)
