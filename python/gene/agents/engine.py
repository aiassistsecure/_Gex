"""
Gene Agent Engine
Orchestrates AI agents for project analysis, code generation, and patching.
Uses AiAssist.net as the LLM provider.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, Optional

from gene.agents.aiassist import AiAssistClient
from gene.agents.analyzer import ProjectAnalyzer
from gene.agents.generator import CodeGenerator
from gene.agents.patcher import SurgicalPatcher
from gene.config import GeneConfig

logger = logging.getLogger("gene.agents")


class AgentEngine:
    """Central orchestrator for all Gene agents.

    Responsibilities:
        - Manage AiAssist client lifecycle
        - Route requests to appropriate agents
        - Handle agent results
    """

    def __init__(self, config: GeneConfig):
        self.config = config
        self.client = AiAssistClient(
            api_key=config.aiassist_api_key,
            base_url=config.aiassist_api_url,
            default_provider=config.aiassist_provider,
        )
        self.analyzer = ProjectAnalyzer(config)
        self.generator = CodeGenerator(config, self.client)
        self.patcher = SurgicalPatcher(config, self.client)

    async def get_providers(self) -> Dict[str, Any]:
        """Fetch available providers from AiAssist."""
        return await self.client.get_providers()

    async def analyze(self, path: Optional[str] = None) -> Dict[str, Any]:
        """Analyze a project directory.

        Returns structured analysis including:
            - Project type detection
            - Framework detection
            - Dependencies
            - File structure summary
        """
        target = path or self.config.workspace_dir
        logger.info(f"Analyzing project at: {target}")
        return self.analyzer.analyze(target)

    async def generate(
        self,
        prompt: str,
        target_path: Optional[str] = None,
        model: Optional[str] = None,
        provider: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate code from a natural language prompt.

        Args:
            prompt: Natural language description of what to generate
            target_path: Where to write generated files
            model: LLM model to use
            provider: AiAssist provider override

        Returns:
            Generated file operations (create, modify)
        """
        logger.info(f"Generating code: {prompt[:80]}...")
        return await self.generator.generate(
            prompt=prompt,
            target_path=target_path or self.config.workspace_dir,
            model=model,
            provider=provider,
        )

    async def patch(
        self,
        file_path: str,
        instruction: str,
        model: Optional[str] = None,
        provider: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Apply a surgical patch to an existing file.

        Uses Gex-style anchor-based patching:
            1. Read current file
            2. Send to LLM with instruction
            3. Receive structured patch
            4. Stage changes (never mutate original directly)
            5. Return diff for review

        Args:
            file_path: Path to file to patch
            instruction: Natural language edit instruction
            model: LLM model to use
            provider: AiAssist provider override

        Returns:
            Staged patch with diff preview
        """
        logger.info(f"Patching {file_path}: {instruction[:80]}...")
        return await self.patcher.patch(
            file_path=file_path,
            instruction=instruction,
            model=model,
            provider=provider,
        )
