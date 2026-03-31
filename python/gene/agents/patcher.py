"""
Surgical Patcher Agent (Gex-inspired)
Applies targeted, anchor-based code patches using LLM intelligence.
Never mutates original files — always stages for review.
"""

from __future__ import annotations

import difflib
import json
import logging
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from gene.agents.aiassist import AiAssistClient
from gene.config import GeneConfig

logger = logging.getLogger("gene.agents.patcher")

PATCH_SYSTEM_PROMPT = """You are Gene Patcher — a surgical code editor. You receive a file and an instruction.

You must respond with a JSON object describing the exact changes:
{
    "patches": [
        {
            "anchor": "exact line or unique code fragment to locate the edit point",
            "action": "replace" | "insert_before" | "insert_after" | "delete",
            "old_content": "exact content being replaced (for 'replace' action)",
            "new_content": "the new content to insert/replace with",
            "explanation": "brief reason for this change"
        }
    ],
    "summary": "Brief overall summary of changes"
}

Rules:
- The "anchor" must be a UNIQUE string that appears exactly once in the file
- For "replace": old_content must match EXACTLY (including whitespace)
- For "insert_before"/"insert_after": new_content is inserted relative to anchor
- For "delete": removes the anchor and content around it as specified
- Preserve indentation and formatting
- Make minimal, surgical changes — don't rewrite entire files
- Each patch should be independent and apply cleanly

IMPORTANT: Respond ONLY with the JSON object."""


class SurgicalPatcher:
    """Applies Gex-style surgical patches to files.

    Workflow:
        1. Read target file
        2. Send to LLM with edit instruction
        3. Receive structured patches
        4. Create snapshot (backup)
        5. Apply patches to staging copy
        6. Generate diff for review
        7. Return staged result (never auto-apply to original)
    """

    def __init__(self, config: GeneConfig, client: AiAssistClient):
        self.config = config
        self.client = client

    async def patch(
        self,
        file_path: str,
        instruction: str,
        model: Optional[str] = None,
        provider: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate and stage a surgical patch."""
        workspace = Path(self.config.workspace_dir).resolve()
        target = (workspace / file_path).resolve()

        # Security check
        try:
            target.relative_to(workspace)
        except ValueError:
            return {"error": "File path must be within workspace"}

        if not target.exists():
            return {"error": f"File not found: {file_path}"}

        original_content = target.read_text(encoding="utf-8")

        if not self.client.api_key:
            return {
                "error": "AiAssist API key not configured. Set GENE_AIASSIST_API_KEY env var.",
            }

        # Get patches from LLM
        messages = [
            {"role": "system", "content": PATCH_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"File: {file_path}\n\n```\n{original_content}\n```\n\nInstruction: {instruction}",
            },
        ]

        response = await self.client.chat_completion(
            messages=messages,
            model=model or "llama-3.3-70b-versatile",
            provider=provider,
            temperature=0.2,
            max_tokens=8192,
        )

        content = self.client.get_content(response)
        if not content:
            return {"error": response.get("error", "Empty response"), "patches": []}

        # Parse patches
        try:
            patch_data = self._parse_patches(content)
        except Exception as e:
            return {
                "error": f"Failed to parse patch output: {e}",
                "raw_output": content[:2000],
            }

        # Create snapshot before applying
        snapshot_dir = workspace / ".gene" / "snapshots"
        snapshot_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        snapshot_path = snapshot_dir / f"{target.stem}_{timestamp}{target.suffix}"
        snapshot_path.write_text(original_content, encoding="utf-8")

        # Apply patches to get new content
        patched_content = original_content
        applied_patches = []

        for i, patch in enumerate(patch_data.get("patches", [])):
            result = self._apply_single_patch(patched_content, patch)
            if result["success"]:
                patched_content = result["content"]
                applied_patches.append({
                    "index": i,
                    "action": patch.get("action", "replace"),
                    "explanation": patch.get("explanation", ""),
                    "applied": True,
                })
            else:
                applied_patches.append({
                    "index": i,
                    "action": patch.get("action", "replace"),
                    "error": result["error"],
                    "applied": False,
                })

        # Stage the patched file
        staging_dir = workspace / ".gene" / "staging"
        staging_dir.mkdir(parents=True, exist_ok=True)
        staged_path = staging_dir / file_path
        staged_path.parent.mkdir(parents=True, exist_ok=True)
        staged_path.write_text(patched_content, encoding="utf-8")

        # Generate diff
        diff = self._generate_diff(original_content, patched_content, file_path)

        return {
            "file_path": file_path,
            "patches": applied_patches,
            "summary": patch_data.get("summary", "Patches applied"),
            "diff": diff,
            "staged_at": str(staged_path),
            "snapshot_at": str(snapshot_path),
            "staged": True,
            "auto_applied": False,
        }

    def _parse_patches(self, content: str) -> Dict[str, Any]:
        """Parse LLM patch JSON output."""
        text = content.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines)
        return json.loads(text)

    def _apply_single_patch(self, content: str, patch: dict) -> Dict[str, Any]:
        """Apply a single patch operation to content."""
        anchor = patch.get("anchor", "")
        action = patch.get("action", "replace")

        if not anchor:
            return {"success": False, "error": "Missing anchor", "content": content}

        if anchor not in content:
            return {
                "success": False,
                "error": f"Anchor not found in file: {anchor[:60]}...",
                "content": content,
            }

        # Count occurrences — anchor must be unique
        count = content.count(anchor)
        if count > 1:
            return {
                "success": False,
                "error": f"Anchor is ambiguous (found {count} times): {anchor[:60]}...",
                "content": content,
            }

        if action == "replace":
            old = patch.get("old_content", anchor)
            new = patch.get("new_content", "")
            if old not in content:
                # Fallback: replace anchor directly
                content = content.replace(anchor, new, 1)
            else:
                content = content.replace(old, new, 1)

        elif action == "insert_before":
            new = patch.get("new_content", "")
            idx = content.index(anchor)
            content = content[:idx] + new + content[idx:]

        elif action == "insert_after":
            new = patch.get("new_content", "")
            idx = content.index(anchor) + len(anchor)
            content = content[:idx] + new + content[idx:]

        elif action == "delete":
            content = content.replace(anchor, "", 1)

        return {"success": True, "content": content}

    def _generate_diff(self, original: str, patched: str, filename: str) -> str:
        """Generate a unified diff between original and patched content."""
        original_lines = original.splitlines(keepends=True)
        patched_lines = patched.splitlines(keepends=True)

        diff = difflib.unified_diff(
            original_lines,
            patched_lines,
            fromfile=f"a/{filename}",
            tofile=f"b/{filename}",
        )
        return "".join(diff)
