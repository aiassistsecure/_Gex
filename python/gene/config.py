"""
Gene Runtime Configuration
Pydantic-based settings loaded from gene.config.json, env vars, and CLI args.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class GeneConfig(BaseSettings):
    """Central configuration for the Gene Python runtime."""

    # Server
    host: str = Field(default="127.0.0.1", description="API server bind host")
    port: int = Field(default=18764, description="API server port")
    ws_port: int = Field(default=18765, description="WebSocket server port")

    # Runtime
    debug: bool = Field(default=False, description="Enable debug mode")
    log_level: str = Field(default="INFO", description="Logging level")
    workspace_dir: str = Field(default=".", description="Active workspace directory")

    # AiAssist Integration
    aiassist_api_url: str = Field(
        default="https://api.aiassist.net",
        description="AiAssist API base URL",
    )
    aiassist_api_key: str = Field(
        default="",
        description="AiAssist API key (Bearer token)",
    )
    aiassist_provider: str = Field(
        default="",
        description="Default AiAssist provider (groq, openai, anthropic, gemini, mistral)",
    )

    # Telemetry
    telemetry_enabled: bool = Field(
        default=False, description="Enable opt-in telemetry"
    )

    # Paths
    data_dir: str = Field(default="", description="Gene data directory")
    plugins_dir: str = Field(default="", description="Plugins directory")

    model_config = {
        "env_prefix": "GENE_",
        "env_file": ".env",
        "extra": "ignore",
    }

    @classmethod
    def load(cls, config_path: Optional[str] = None) -> "GeneConfig":
        """Load config from file, then overlay environment variables."""
        file_settings = {}

        # Try loading from gene.config.json
        paths_to_try = [
            config_path,
            os.environ.get("GENE_CONFIG_PATH"),
            "gene.config.json",
            str(Path.home() / ".gene" / "config.json"),
        ]

        for p in paths_to_try:
            if p and Path(p).exists():
                with open(p, "r") as f:
                    file_settings = json.load(f)
                break

        # Create instance — env vars override file settings
        return cls(**file_settings)


# Global singleton
_config: Optional[GeneConfig] = None


def get_config() -> GeneConfig:
    """Get or create the global config singleton."""
    global _config
    if _config is None:
        _config = GeneConfig.load()
    return _config


def set_config(config: GeneConfig) -> None:
    """Override the global config (used in tests)."""
    global _config
    _config = config
