"""
Code Generator Agent
Generates code from natural language prompts using AiAssist LLM.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from jenny.agents.aiassist import AiAssistClient
from jenny.config import GeneConfig

logger = logging.getLogger("jenny.agents.generator")

SYSTEM_PROMPT = """You are Jenny, an expert code generator for desktop applications built with Python + Electron.

When asked to generate code, respond with a JSON object containing file operations:
{
    "files": [
        {
            "path": "relative/path/to/file.ext",
            "action": "create",  // "create" or "modify"
            "content": "full file content here"
        }
    ],
    "summary": "Brief description of what was generated"
}

Rules:
- Always use relative paths
- Generate complete, production-ready code
- Follow best practices for the target language
- Include proper error handling
- Add comments for complex logic
- Use modern patterns and conventions
- For Python: use type hints, async where appropriate
- For React: use functional components, hooks
- For CSS: use Tailwind utility classes when in a Tailwind project

IMPORTANT: Respond ONLY with the JSON object, no markdown fences, no explanation text."""


class CodeGenerator:
    """Generates code files from natural language using AiAssist."""

    def __init__(self, config: GeneConfig, client: AiAssistClient):
        self.config = config
        self.client = client

    async def generate(
        self,
        prompt: str,
        target_path: str,
        model: Optional[str] = None,
        provider: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate code from a prompt.

        Returns:
            {
                "files": [...],
                "summary": "...",
                "staged": true,
                "staging_dir": "..."
            }
        """
        if not self.client.api_key:
            return {
                "error": "AiAssist API key not configured. Set JENNY_AIASSIST_API_KEY env var.",
                "files": [],
            }

        # Build context
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": self._build_prompt(prompt, target_path)},
        ]

        # Call AiAssist
        response = await self.client.chat_completion(
            messages=messages,
            model=model or "llama-3.3-70b-versatile",
            provider=provider,
            temperature=0.3,
            max_tokens=8192,
        )

        content = self.client.get_content(response)

        if not content or "error" in response:
            return {"error": response.get("error", "Empty response"), "files": []}

        # Parse the generated file operations
        try:
            result = self._parse_generation(content)
        except Exception as e:
            logger.error(f"Failed to parse generation: {e}")
            return {
                "error": f"Failed to parse LLM output: {e}",
                "raw_output": content[:2000],
                "files": [],
            }

        # Stage files (never write directly to workspace)
        staging_dir = Path(target_path) / ".jenny" / "staging"
        staging_dir.mkdir(parents=True, exist_ok=True)

        staged_files = []
        for file_op in result.get("files", []):
            staged_path = staging_dir / file_op["path"]
            staged_path.parent.mkdir(parents=True, exist_ok=True)
            staged_path.write_text(file_op["content"], encoding="utf-8")
            staged_files.append({
                "path": file_op["path"],
                "action": file_op.get("action", "create"),
                "staged_at": str(staged_path),
                "size": len(file_op["content"]),
            })

        return {
            "files": staged_files,
            "summary": result.get("summary", "Code generated"),
            "staged": True,
            "staging_dir": str(staging_dir),
        }

    def _build_prompt(self, prompt: str, target_path: str) -> str:
        """Build a contextualized prompt with project info."""
        target = Path(target_path)
        context_parts = [f"Project directory: {target.name}"]

        # Detect existing structure
        if (target / "package.json").exists():
            try:
                pkg = json.loads((target / "package.json").read_text())
                deps = list(pkg.get("dependencies", {}).keys())
                if deps:
                    context_parts.append(f"Node dependencies: {', '.join(deps[:10])}")
            except Exception:
                pass

        if (target / "requirements.txt").exists():
            try:
                reqs = (target / "requirements.txt").read_text().strip().splitlines()[:10]
                context_parts.append(f"Python dependencies: {', '.join(reqs)}")
            except Exception:
                pass

        context = "\n".join(context_parts)
        return f"""Context:\n{context}\n\nRequest:\n{prompt}"""

    def _parse_generation(self, content: str) -> Dict[str, Any]:
        """Parse the LLM's JSON output into file operations."""
        # Strip markdown code fences if present
        text = content.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            lines = lines[1:]  # Remove opening fence
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]  # Remove closing fence
            text = "\n".join(lines)

        return json.loads(text)
