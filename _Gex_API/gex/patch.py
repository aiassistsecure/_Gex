"""
Gex Patch Engine — Parses LLM surgical blocks and applies them to cloned files.
Extracted from _Gex.py parse_surgical_blocks() / apply_patch_operations() / apply_blocks_to_clone().
"""
from __future__ import annotations
import os
import re
import json
from pathlib import Path
from typing import Optional
from .types import SurgicalBlock, PatchOperation, ApplyResult


class PatchEngine:
    """Parses and applies surgical edit blocks from LLM output."""

    def parse_surgical_blocks(self, llm_output: str) -> list[SurgicalBlock]:
        """Parse <<<WRITE>>> and <<<PATCH>>> blocks from LLM response reliably."""
        blocks: list[SurgicalBlock] = []
        # Match only block headers that are on their own lines (optionally prefixed by ##) to avoid splitting inside JSON patches
        pattern = re.compile(r'(?:^|\n)[ \t]*(?:#+\s*)?<<<(WRITE|PATCH):\s*([^\n>]+?)\s*>>>\s*(?=\r?\n|$)')
        
        pos = 0
        while True:
            match = pattern.search(llm_output, pos)
            if not match:
                break
                
            action = match.group(1).strip()
            filepath = match.group(2).strip()
            
            payload_start = match.end()
            end_match = llm_output.find("<<<END>>>", payload_start)
            
            if end_match == -1:
                body = llm_output[payload_start:]
                pos = len(llm_output)
            else:
                body = llm_output[payload_start:end_match]
                # Advance pos past the END tag so we skip everything nested inside!
                pos = end_match + len("<<<END>>>")
                
            body = body.strip()

            if action == "WRITE":
                # Remove markdown fences around full code block if LLM added them
                if body.startswith("```"):
                    body = re.sub(r'^```\w*\n?', '', body)
                    body = re.sub(r'\n?```$', '', body)
                    
                blocks.append(SurgicalBlock(
                    action="write",
                    path=filepath,
                    content=body,
                ))
            elif action == "PATCH":
                parsed_ops = self._parse_patch_json(filepath, body)
                if parsed_ops is not None:
                    blocks.append(SurgicalBlock(
                        action="patch",
                        path=filepath,
                        operations=parsed_ops,
                    ))
                else:
                    blocks.append(SurgicalBlock(
                        action="patch_error",
                        path=filepath,
                        raw=body,
                        error="all parse strategies failed",
                    ))

        return blocks

    def _parse_patch_json(
        self, filepath: str, body: str
    ) -> Optional[list[PatchOperation]]:
        """3-tier JSON parsing: strict → newline fix → regex fallback."""
        raw = body.strip()
        if raw.startswith("```"):
            raw = re.sub(r'^```\w*\n?', '', raw)
            raw = re.sub(r'\n?```$', '', raw)
            raw = raw.strip()

        # Tier 1: strict JSON
        try:
            ops_data = json.loads(raw)
            ops_list = ops_data if isinstance(ops_data, list) else ops_data.get("operations", [ops_data])
            return [PatchOperation(**op) for op in ops_list]
        except (json.JSONDecodeError, Exception):
            pass

        # Tier 2: fix escaped newlines
        fixed = re.sub(
            r'"content"\s*:\s*"((?:[^"\\]|\\.)*?)"',
            lambda m: '"content": ' + json.dumps(m.group(1).replace('\n', '\\n')),
            raw,
            flags=re.DOTALL,
        )
        try:
            ops_data = json.loads(fixed)
            ops_list = ops_data if isinstance(ops_data, list) else ops_data.get("operations", [ops_data])
            return [PatchOperation(**op) for op in ops_list]
        except (json.JSONDecodeError, Exception):
            pass

        # Tier 3: regex fallback
        ops: list[PatchOperation] = []
        op_pattern = re.compile(
            r'\{\s*"action"\s*:\s*"(\w+)"'
            r'(?:.*?"start_line"\s*:\s*(\d+))?'
            r'(?:.*?"end_line"\s*:\s*(\d+))?'
            r'(?:.*?"content"\s*:\s*(?:\"{3}(.*?)\"{3}|"((?:[^"\\]|\\.)*?)"))?' 
            r'[^}]*\}',
            re.DOTALL,
        )
        for m in op_pattern.finditer(raw):
            action = m.group(1)
            start = int(m.group(2)) if m.group(2) else 1
            end = int(m.group(3)) if m.group(3) else None
            
            # group(4) is """...""", group(5) is "..."
            raw_content = m.group(4) if m.group(4) is not None else m.group(5)
            content = None
            if raw_content is not None:
                content = raw_content.replace("\\n", "\n").replace('\\"', '"')
            ops.append(PatchOperation(
                action=action,
                start_line=start,
                end_line=end,
                content=content,
            ))

        if ops:
            return ops
        return None

    def apply_patch_operations(
        self, content: str, operations: list[PatchOperation]
    ) -> tuple[str, int, int]:
        """Apply patch operations to file content. Returns (new_content, added, removed)."""
        lines = content.split("\n")
        added = 0
        removed = 0

        sorted_ops = sorted(operations, key=lambda op: op.start_line, reverse=True)

        for op in sorted_ops:
            start_idx = op.start_line - 1

            if op.action == "insert":
                new_lines = (op.content or "").split("\n")
                lines = lines[:start_idx] + new_lines + lines[start_idx:]
                added += len(new_lines)

            elif op.action == "replace":
                end_idx = op.end_line or op.start_line
                new_lines = (op.content or "").split("\n")
                old_count = end_idx - start_idx
                lines = lines[:start_idx] + new_lines + lines[end_idx:]
                added += len(new_lines)
                removed += old_count

            elif op.action == "delete":
                end_idx = op.end_line or op.start_line
                old_count = end_idx - start_idx
                lines = lines[:start_idx] + lines[end_idx:]
                removed += old_count

        return "\n".join(lines), added, removed

    def validate_clone_path(
        self, clone_path: str, filepath: str
    ) -> Optional[Path]:
        """Validate that a file path stays within the clone directory."""
        clone_root = Path(clone_path).resolve()
        candidate = (clone_root / filepath).resolve()
        if not str(candidate).startswith(str(clone_root) + os.sep) and candidate != clone_root:
            return None
        return candidate

    def apply_blocks_to_clone(
        self, clone_path: str, blocks: list[SurgicalBlock]
    ) -> list[ApplyResult]:
        """Apply all surgical blocks to the cloned repository."""
        results: list[ApplyResult] = []

        for block in blocks:
            filepath = block.path
            full_path = self.validate_clone_path(clone_path, filepath)

            if full_path is None:
                results.append(ApplyResult(
                    path=filepath,
                    action=block.action.upper(),
                    status="blocked",
                    detail="path traversal detected — skipped",
                ))
                continue

            if block.action == "write":
                full_path.parent.mkdir(parents=True, exist_ok=True)
                full_path.write_text(block.content or "", encoding="utf-8")
                results.append(ApplyResult(
                    path=filepath,
                    action="WRITE",
                    status="applied",
                    detail=f"wrote {len(block.content or '')} chars",
                ))

            elif block.action == "patch":
                if not full_path.exists():
                    results.append(ApplyResult(
                        path=filepath,
                        action="PATCH",
                        status="skipped",
                        detail="file not found in clone",
                    ))
                    continue

                original = full_path.read_text(errors="replace")
                try:
                    new_content, added, removed = self.apply_patch_operations(
                        original, block.operations or []
                    )
                    full_path.write_text(new_content, encoding="utf-8")
                    results.append(ApplyResult(
                        path=filepath,
                        action="PATCH",
                        status="applied",
                        detail=f"+{added} -{removed} lines, {len(block.operations or [])} ops",
                    ))
                except Exception as e:
                    results.append(ApplyResult(
                        path=filepath,
                        action="PATCH",
                        status="error",
                        detail=str(e),
                    ))

            elif block.action == "patch_error":
                results.append(ApplyResult(
                    path=filepath,
                    action="PATCH",
                    status="parse_error",
                    detail=block.error or "unknown",
                ))

        return results
