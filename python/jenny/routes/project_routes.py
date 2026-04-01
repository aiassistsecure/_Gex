"""
Project management routes.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from jenny.config import get_config

router = APIRouter()


class ProjectInfo(BaseModel):
    name: str
    path: str
    has_backend: bool
    has_frontend: bool
    has_config: bool
    files_count: int


class ProjectScanRequest(BaseModel):
    path: Optional[str] = None


@router.get("/project/info")
async def get_project_info():
    """Get current workspace project info."""
    config = get_config()
    workspace = Path(config.workspace_dir).resolve()

    if not workspace.exists():
        raise HTTPException(status_code=404, detail="Workspace not found")

    has_backend = (workspace / "backend").exists() or (workspace / "app.py").exists()
    has_frontend = (workspace / "frontend").exists() or (workspace / "index.html").exists()
    has_config = (workspace / "jenny.config.json").exists()

    files = list(workspace.rglob("*"))
    files = [f for f in files if f.is_file() and ".git" not in str(f)]

    return ProjectInfo(
        name=workspace.name,
        path=str(workspace),
        has_backend=has_backend,
        has_frontend=has_frontend,
        has_config=has_config,
        files_count=len(files),
    )


@router.post("/project/scan")
async def scan_project(req: ProjectScanRequest):
    """Scan a project directory and return its structure."""
    config = get_config()
    target = Path(req.path or config.workspace_dir).resolve()

    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Path not found: {target}")

    tree = _build_tree(target, max_depth=4)
    return {"root": str(target), "tree": tree}


def _build_tree(path: Path, max_depth: int, current_depth: int = 0) -> list:
    """Build a file tree structure."""
    if current_depth >= max_depth:
        return []

    items = []
    try:
        for entry in sorted(path.iterdir(), key=lambda e: (not e.is_dir(), e.name)):
            if entry.name.startswith(".") or entry.name in (
                "node_modules", "__pycache__", ".git", "dist", "build", "venv", ".venv"
            ):
                continue

            node = {
                "name": entry.name,
                "type": "directory" if entry.is_dir() else "file",
                "path": str(entry.relative_to(path)),
            }

            if entry.is_dir():
                node["children"] = _build_tree(entry, max_depth, current_depth + 1)

            if entry.is_file():
                node["size"] = entry.stat().st_size
                node["extension"] = entry.suffix

            items.append(node)
    except PermissionError:
        pass

    return items


@router.get("/project/files/{file_path:path}")
async def read_file(file_path: str):
    """Read a file's content from the workspace."""
    config = get_config()
    full_path = Path(config.workspace_dir) / file_path

    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    # Security: ensure path is within workspace
    try:
        full_path.resolve().relative_to(Path(config.workspace_dir).resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        content = full_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Binary file — cannot read as text")

    return {
        "path": file_path,
        "content": content,
        "size": full_path.stat().st_size,
        "extension": full_path.suffix,
    }
