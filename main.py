"""
_Gex OS — FastAPI Backend
AI-native code surgery environment powered by the Gex engine.
"""
import os
import json
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from gex.types import GexConfig
from gex.runner import GexRunner
from routes import repo, run, settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load settings on startup, configure runner."""
    settings_file = Path(__file__).parent / "gex_settings.json"
    if settings_file.exists():
        saved = json.loads(settings_file.read_text())
        config = GexConfig(**{k: v for k, v in saved.items() if v})
    else:
        # Fall back to env vars
        config = GexConfig(
            api_base=os.getenv("AIAS_API_URL", "https://api.aiassist.net"),
            api_key=os.getenv("AIAS_API_KEY", ""),
            model=os.getenv("AIAS_MODEL", "moonshotai/kimi-k2-instruct"),
            provider=os.getenv("AIAS_PROVIDER", "groq"),
        )

    run.reconfigure_runner(config)
    print(f"\n  ⚡ _Gex OS Backend")
    print(f"  Model: {config.provider}/{config.model}")
    print(f"  API Key: {'✅ Set' if config.api_key else '❌ Not set — configure in UI'}\n")
    yield


app = FastAPI(
    title="_Gex OS",
    description="AI-native code surgery environment",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(repo.router)
app.include_router(run.router)
app.include_router(settings.router)


@app.get("/")
async def root():
    return {
        "name": "_Gex OS",
        "version": "0.1.0",
        "status": "running",
        "docs": "/docs",
    }
