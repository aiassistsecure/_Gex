"""
Jenny FastAPI Server
The main HTTP + WebSocket server for the Jenny Python runtime.
"""

from __future__ import annotations

import asyncio
import logging
import signal
import sys
from contextlib import asynccontextmanager
from typing import Any

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from jenny.config import GeneConfig, get_config, set_config
from jenny.websocket import ConnectionManager

logger = logging.getLogger("jenny")

# ─── WebSocket Manager (global) ────────────────────────────────────
ws_manager = ConnectionManager()


# ─── Lifespan ───────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    config = get_config()
    logger.info(f"🧬 Jenny Runtime v1.0.0 starting on {config.host}:{config.port}")
    logger.info(f"   Workspace: {config.workspace_dir}")
    logger.info(f"   Debug: {config.debug}")

    yield

    logger.info("🧬 Jenny Runtime shutting down...")
    await ws_manager.disconnect_all()


# ─── App Factory ────────────────────────────────────────────────────
def create_app(config: GeneConfig | None = None) -> FastAPI:
    """Create and configure the FastAPI application."""
    if config:
        set_config(config)

    cfg = get_config()

    app = FastAPI(
        title="Jenny Runtime",
        description="Python intelligence layer for Jenny desktop applications",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS — allow Electron renderer
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ─── Health ──────────────────────────────────────────────────
    @app.get("/health", tags=["system"])
    async def health_check():
        """Health check endpoint for the Node orchestrator."""
        return {
            "status": "healthy",
            "version": "1.0.0",
            "runtime": "jenny-python",
        }

    @app.get("/api/v1/status", tags=["system"])
    async def runtime_status():
        """Detailed runtime status."""
        return {
            "status": "running",
            "version": "1.0.0",
            "workspace": cfg.workspace_dir,
            "debug": cfg.debug,
            "aiassist_configured": bool(cfg.aiassist_api_key),
            "telemetry_enabled": cfg.telemetry_enabled,
        }

    # ─── WebSocket ───────────────────────────────────────────────
    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        """Main WebSocket endpoint for real-time communication."""
        client_id = await ws_manager.connect(websocket)
        try:
            while True:
                data = await websocket.receive_json()
                await ws_manager.handle_message(client_id, data)
        except WebSocketDisconnect:
            ws_manager.disconnect(client_id)
        except Exception as e:
            logger.error(f"WebSocket error for {client_id}: {e}")
            ws_manager.disconnect(client_id)

    # ─── Register Route Modules ──────────────────────────────────
    from jenny.routes import agent_routes, project_routes, template_routes

    app.include_router(project_routes.router, prefix="/api/v1", tags=["projects"])
    app.include_router(agent_routes.router, prefix="/api/v1", tags=["agents"])
    app.include_router(template_routes.router, prefix="/api/v1", tags=["templates"])

    return app


# ─── Entry Point ────────────────────────────────────────────────────
def main():
    """Launch the Jenny runtime server."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    config = GeneConfig.load()
    set_config(config)

    logger.info("🧬 Jenny Runtime — The Python Intelligence Layer")

    uvicorn.run(
        create_app(config),
        host=config.host,
        port=config.port,
        log_level=config.log_level.lower(),
        reload=config.debug,
    )


if __name__ == "__main__":
    main()
