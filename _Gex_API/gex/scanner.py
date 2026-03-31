"""
Gex Scanner — Async file tree walking and source code scanning.
Extracted from _Gex.py scan_tree() / build_context() / build_tree_summary().
"""
from __future__ import annotations
import os
from pathlib import Path
from typing import AsyncGenerator
from .types import GexConfig, ScannedFile, FileTreeNode


class GexScanner:
    """Scans repositories for source files and builds file trees."""

    def __init__(self, config: GexConfig):
        self.config = config

    async def scan_tree(
        self, root: str, focus_file: str = None
    ) -> list[ScannedFile]:
        """Scan a directory tree and return all matching source files."""
        root_path = Path(root).resolve()
        files: list[ScannedFile] = []

        for path in sorted(root_path.rglob("*")):
            if not path.is_file():
                continue
            if any(skip in path.parts for skip in self.config.skip_dirs):
                continue
            if path.name in self.config.skip_files:
                continue
            if path.suffix not in self.config.code_extensions:
                continue
            if focus_file and focus_file not in str(path):
                continue

            rel = str(path.relative_to(root_path))
            try:
                size = path.stat().st_size
                content = path.read_text(errors="replace")
                if size > self.config.max_file_size:
                    lines = content.split("\n")
                    max_lines = self.config.max_file_size // 80
                    content = (
                        "\n".join(lines[:max_lines])
                        + f"\n\n# ... truncated ({len(lines) - max_lines} more lines)"
                    )
                files.append(ScannedFile(
                    path=rel,
                    size=size,
                    content=content,
                    lines=content.count("\n") + 1,
                ))
            except Exception as e:
                files.append(ScannedFile(path=rel, error=str(e)))

        return files

    async def build_file_tree(self, root: str) -> list[FileTreeNode]:
        """Build a hierarchical file tree for the UI."""
        root_path = Path(root).resolve()
        return await self._walk_dir(root_path, root_path)

    async def _walk_dir(
        self, dir_path: Path, root_path: Path
    ) -> list[FileTreeNode]:
        """Recursively walk a directory and build tree nodes."""
        nodes: list[FileTreeNode] = []

        try:
            entries = sorted(dir_path.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
        except PermissionError:
            return nodes

        for entry in entries:
            if entry.name in self.config.skip_dirs:
                continue
            if entry.name in self.config.skip_files:
                continue

            rel = str(entry.relative_to(root_path))

            if entry.is_dir():
                children = await self._walk_dir(entry, root_path)
                nodes.append(FileTreeNode(
                    name=entry.name,
                    path=str(entry),
                    rel_path=rel,
                    type="directory",
                    children=children,
                ))
            elif entry.is_file():
                nodes.append(FileTreeNode(
                    name=entry.name,
                    path=str(entry),
                    rel_path=rel,
                    type="file",
                    extension=entry.suffix,
                    size=entry.stat().st_size,
                ))

        return nodes

    def build_context(
        self, files: list[ScannedFile], max_chars: int = None
    ) -> str:
        """Build numbered source context string for LLM consumption."""
        max_chars = max_chars or self.config.max_context_chars
        parts: list[str] = []
        total = 0

        for f in files:
            content = f.content or f.error or ""
            numbered = "\n".join(
                f"{i+1:>4}| {line}"
                for i, line in enumerate(content.split("\n"))
            )
            header = f"### {f.path} ({f.lines} lines)\n"
            block = f"```\n{numbered}\n```\n"
            chunk = header + block

            if total + len(chunk) > max_chars:
                parts.append(f"### {f.path}\n[truncated: context limit reached]\n")
                break

            parts.append(chunk)
            total += len(chunk)

        return "\n".join(parts)

    def build_tree_summary(self, files: list[ScannedFile]) -> str:
        """Build a flat text summary of the file tree."""
        return "\n".join(
            f"  {f.path}  ({f.lines} lines, {f.size} bytes)"
            for f in files
        )
