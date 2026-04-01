"""
Agent routes — triggers agent actions via HTTP.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from jenny.agents.engine import AgentEngine
from jenny.config import get_config

router = APIRouter()

# Shared engine instance
_engine: Optional[AgentEngine] = None


def get_engine() -> AgentEngine:
    global _engine
    if _engine is None:
        _engine = AgentEngine(get_config())
    return _engine


class AnalyzeRequest(BaseModel):
    path: Optional[str] = None


class GenerateRequest(BaseModel):
    prompt: str
    target_path: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None


class PatchRequest(BaseModel):
    file_path: str
    instruction: str
    model: Optional[str] = None
    provider: Optional[str] = None


# ─── Endpoints ───────────────────────────────────────────────────────


@router.post("/agent/analyze")
async def analyze_project(req: AnalyzeRequest):
    """Analyze a project and return structured summary."""
    engine = get_engine()
    result = await engine.analyze(req.path)
    return result


@router.post("/agent/generate")
async def generate_code(req: GenerateRequest):
    """Generate code from a natural language prompt."""
    engine = get_engine()
    result = await engine.generate(
        prompt=req.prompt,
        target_path=req.target_path,
        model=req.model,
        provider=req.provider,
    )
    return result


@router.post("/agent/patch")
async def patch_code(req: PatchRequest):
    """Apply a surgical code patch to a file."""
    engine = get_engine()
    result = await engine.patch(
        file_path=req.file_path,
        instruction=req.instruction,
        model=req.model,
        provider=req.provider,
    )
    return result


@router.get("/agent/providers")
async def list_providers():
    """List available AI providers from AiAssist."""
    engine = get_engine()
    providers = await engine.get_providers()
    return providers


@router.get("/agent/models")
async def list_models():
    """List available models from configured AiAssist providers."""
    engine = get_engine()
    providers = await engine.get_providers()
    # Flatten models from all providers
    all_models = []
    if isinstance(providers, dict):
        for provider_data in providers.get("providers", []):
            provider_name = provider_data.get("name", "")
            for model in provider_data.get("models", []):
                all_models.append({
                    "id": model.get("id", ""),
                    "name": model.get("name", model.get("id", "")),
                    "provider": provider_name,
                })
    return {"models": all_models}
