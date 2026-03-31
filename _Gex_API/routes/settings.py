"""
Settings routes — Manage Gex configuration (API key, model, provider).
Normie-friendly: no env vars needed.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import json
from pathlib import Path
import httpx
import os

from gex.types import GexConfig
from routes.run import reconfigure_runner

router = APIRouter(prefix="/api/settings", tags=["settings"])

SETTINGS_FILE = Path(__file__).parent.parent / "gex_settings.json"


class SettingsUpdate(BaseModel):
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None


def load_settings() -> dict:
    if SETTINGS_FILE.exists():
        return json.loads(SETTINGS_FILE.read_text())
    return {}


def save_settings(data: dict):
    # Save locally to Gex OS
    SETTINGS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")

    # Sync to the active Gene Workspace if available
    workspace = os.getenv("GENE_WORKSPACE")
    if workspace:
        gene_config_path = Path(workspace) / "gene.config.json"
        if gene_config_path.exists():
            try:
                gene_data = json.loads(gene_config_path.read_text())
                if "aiassist" not in gene_data:
                    gene_data["aiassist"] = {}
                
                # Push the API config into the user's project
                if data.get("api_key"):
                    gene_data["aiassist"]["apiKey"] = data["api_key"]
                if data.get("model"):
                    gene_data["aiassist"]["model"] = data["model"]
                if data.get("provider"):
                    gene_data["aiassist"]["provider"] = data["provider"]
                
                gene_config_path.write_text(json.dumps(gene_data, indent=2), encoding="utf-8")
            except Exception:
                pass


@router.get("")
async def get_settings():
    """Get current settings (API key is masked)."""
    settings = load_settings()
    masked = dict(settings)
    if "api_key" in masked and masked["api_key"]:
        key = masked["api_key"]
        masked["api_key_preview"] = key[:8] + "..." + key[-4:] if len(key) > 12 else "***"
        masked["api_key_set"] = True
    else:
        masked["api_key_preview"] = ""
        masked["api_key_set"] = False

    # Don't send raw key
    masked.pop("api_key", None)
    return masked


@router.post("")
async def update_settings(req: SettingsUpdate):
    """Update settings. Reconfigures the Gex runner."""
    settings = load_settings()

    if req.api_key is not None:
        settings["api_key"] = req.api_key
    if req.api_base is not None:
        settings["api_base"] = req.api_base
    if req.model is not None:
        settings["model"] = req.model
    if req.provider is not None:
        settings["provider"] = req.provider

    save_settings(settings)

    # Reconfigure the runner with new settings
    config = GexConfig(**{k: v for k, v in settings.items() if v})
    reconfigure_runner(config)

    return {"status": "saved", "message": "Settings updated successfully"}


@router.get("/models")
async def list_models(api_key: Optional[str] = None):
    """List available models by proxying to AiAssist API."""
    settings = load_settings()
    key_to_use = api_key or settings.get("api_key")
    api_base = settings.get("api_base", "https://api.aiassist.net").rstrip("/")

    if key_to_use:
        try:
            async with httpx.AsyncClient(timeout=7.0) as client:
                res = await client.get(
                    f"{api_base}/v1/providers",
                    headers={"Authorization": f"Bearer {key_to_use}"}
                )
            if res.status_code == 200:
                data = res.json()
                models = []
                for p in data.get("providers", []):
                    provider_id = p.get("id")
                    for m in p.get("models", []):
                        models.append({
                            "id": m.get("id"),
                            "name": m.get("name") or m.get("id"),
                            "provider": provider_id
                        })
                return {"models": models}
        except Exception:
            pass # fallback to defaults

    return {
        "models": [
            {"id": "moonshotai/kimi-k2-instruct", "name": "Kimi K2 Instruct", "provider": "groq"},
            {"id": "deepseek/deepseek-r1", "name": "DeepSeek R1", "provider": "groq"},
            {"id": "meta-llama/llama-4-maverick", "name": "Llama 4 Maverick", "provider": "groq"},
            {"id": "google/gemini-2.5-pro-preview", "name": "Gemini 2.5 Pro", "provider": "google"},
            {"id": "anthropic/claude-sonnet-4", "name": "Claude Sonnet 4", "provider": "anthropic"},
            {"id": "openai/gpt-4.1", "name": "GPT-4.1", "provider": "openai"},
        ]
    }


@router.post("/validate")
async def validate_key(req: SettingsUpdate):
    """Validate an API key by making a real lightweight call to AiAssist."""
    key = req.api_key
    if not key or not key.strip():
        return {"valid": False, "error": "No key provided."}

    settings = load_settings()
    api_base = req.api_base or settings.get("api_base", "https://api.aiassist.net")
    api_base = api_base.rstrip("/")

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(
                f"{api_base}/v1/providers",
                headers={"Authorization": f"Bearer {key.strip()}"},
            )
        if res.status_code == 200:
            return {"valid": True}
        elif res.status_code in (401, 403):
            return {"valid": False, "error": "Invalid or expired API key."}
        else:
            return {"valid": False, "error": f"API returned {res.status_code} — check your key."}
    except httpx.TimeoutException:
        return {"valid": False, "error": "Request timed out — is the backend reachable?"}
    except Exception as e:
        return {"valid": False, "error": str(e)}
