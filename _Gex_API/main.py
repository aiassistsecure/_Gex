"""
_Gex OS — FastAPI Backend (Gene Edition)
AI-native code surgery environment, vendored as Gene's development IDE.

When launched by `gene dev`, receives GENE_WORKSPACE env var pointing
to the user's project directory, and auto-loads it on startup.
"""
import os
import json
import subprocess
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from gex.types import GexConfig
from gex.runner import GexRunner
from routes import repo, run, settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load settings on startup, auto-load Gene workspace if present."""
    settings_file = Path(__file__).parent / "gex_settings.json"
    if settings_file.exists():
        saved = json.loads(settings_file.read_text())
        config = GexConfig(**{k: v for k, v in saved.items() if v})
    else:
        config = GexConfig(
            api_base=os.getenv("AIAS_API_URL", "https://api.aiassist.net"),
            api_key=os.getenv("AIAS_API_KEY", ""),
            model=os.getenv("AIAS_MODEL", "moonshotai/kimi-k2-instruct"),
            provider=os.getenv("AIAS_PROVIDER", "groq"),
        )

    run.reconfigure_runner(config)

    # Store Gene workspace path if provided
    workspace = os.getenv("GENE_WORKSPACE", "")
    if workspace:
        app.state.gene_workspace = workspace
    else:
        app.state.gene_workspace = ""

    print(f"\n  [*] _Gex OS Backend (Gene IDE)")
    print(f"  Model: {config.provider}/{config.model}")
    print(f"  API Key: {'[OK] Set' if config.api_key else '[--] Not set -- configure in UI'}")
    if workspace:
        print(f"  Workspace: {workspace}")
    print()
    yield


app = FastAPI(
    title="_Gex OS (Gene Edition)",
    description="AI-native code surgery IDE for Gene apps",
    version="1.0.0",
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


# ── Gene-specific routes ──

@app.get("/")
async def root():
    return {
        "name": "_Gex OS (Gene IDE)",
        "version": "1.0.0",
        "status": "running",
        "workspace": app.state.gene_workspace or None,
        "docs": "/docs",
    }


@app.get("/api/workspace")
async def get_workspace():
    """Return the auto-loaded workspace path (set by gene dev)."""
    workspace = app.state.gene_workspace
    return {
        "workspace": workspace if workspace else None,
        "exists": bool(workspace and Path(workspace).exists()),
    }


class GeneCLIRequest(BaseModel):
    action: str   # "build" | "package" | "info"
    cwd: Optional[str] = None


@app.post("/api/gene/cli")
async def run_gene_cli(req: GeneCLIRequest):
    """Run a Gene CLI command from the UI."""
    workspace = req.cwd or app.state.gene_workspace
    if not workspace:
        raise HTTPException(status_code=400, detail="No workspace set")

    allowed = {"build", "package", "info"}
    if req.action not in allowed:
        raise HTTPException(status_code=400, detail=f"Unknown action: {req.action}")

    try:
        result = subprocess.run(
            ["node", _find_gene_cli(), req.action],
            cwd=workspace,
            capture_output=True,
            text=True,
            timeout=300,
        )
        return {
            "action": req.action,
            "exit_code": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Command timed out")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Gene CLI not found")


def _find_gene_cli() -> str:
    """Locate the Gene CLI script relative to this file."""
    gene_root = Path(__file__).parent.parent
    cli_path = gene_root / "cli" / "bin" / "gene.js"
    if cli_path.exists():
        return str(cli_path)
    return "gene"  # Fall back to PATH
