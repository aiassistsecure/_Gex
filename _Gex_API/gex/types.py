"""
Gex type definitions — Pydantic models for the entire system.
"""
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
import uuid


class GexConfig(BaseModel):
    """Runtime configuration for the Gex engine."""
    api_base: str = "https://api.aiassist.net"
    api_key: str = ""
    model: str = "moonshotai/kimi-k2-instruct"
    provider: str = "groq"
    max_file_size: int = 200_000
    max_context_chars: int = 100_000

    skip_dirs: set[str] = Field(default_factory=lambda: {
        "node_modules", ".git", "__pycache__", "venv", ".venv",
        "dist", "build", ".next", ".cache", "appendonlydir",
        "redis-data", ".local", ".upm", "_gex",
    })
    skip_files: set[str] = Field(default_factory=lambda: {
        "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
        "dump.rdb", ".DS_Store",
    })
    code_extensions: set[str] = Field(default_factory=lambda: {
        ".py", ".ts", ".tsx", ".js", ".jsx", ".rs", ".go",
        ".java", ".css", ".html", ".sql", ".sh", ".toml", ".yaml", ".yml",
    })


class ScannedFile(BaseModel):
    """A single scanned source file."""
    path: str
    size: int = 0
    lines: int = 0
    content: str = ""
    error: Optional[str] = None


class FileTreeNode(BaseModel):
    """A node in the file tree (file or directory)."""
    name: str
    path: str
    rel_path: str
    type: Literal["file", "directory"]
    children: list[FileTreeNode] = Field(default_factory=list)
    extension: Optional[str] = None
    size: Optional[int] = None


class DiffHunk(BaseModel):
    """A single hunk in a structured diff."""
    start: int
    end: int
    before_lines: list[str]
    after_lines: list[str]
    type: Literal["modification", "addition", "deletion"]


class FileDiff(BaseModel):
    """Structured diff for a single file."""
    file: str
    hunks: list[DiffHunk] = Field(default_factory=list)
    before: str = ""
    after: str = ""
    total_additions: int = 0
    total_deletions: int = 0


class PatchOperation(BaseModel):
    """A single patch operation within a PATCH block."""
    action: Literal["replace", "insert", "delete"]
    start_line: int
    end_line: Optional[int] = None
    content: Optional[str] = None


class SurgicalBlock(BaseModel):
    """A parsed surgical edit block from LLM output."""
    action: Literal["write", "patch", "patch_error"]
    path: str
    content: Optional[str] = None
    operations: Optional[list[PatchOperation]] = None
    raw: Optional[str] = None
    error: Optional[str] = None


class ApplyResult(BaseModel):
    """Result of applying a single surgical block."""
    path: str
    action: str
    status: Literal["applied", "skipped", "error", "blocked", "dry_run", "parse_error"]
    detail: str


class FileResult(BaseModel):
    """Result of running Gex on a single file."""
    file: str
    before: str = ""
    after: str = ""
    diff: Optional[FileDiff] = None
    status: Literal["patched", "unchanged", "error", "skipped"] = "unchanged"
    blocks_applied: int = 0
    error: Optional[str] = None
    llm_analysis: str = ""
    apply_results: list[ApplyResult] = Field(default_factory=list)
    tool_steps: list[str] = Field(default_factory=list)


class RunState(BaseModel):
    """State machine for a Gex run."""
    run_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    state: Literal["idle", "running", "paused", "completed", "failed"] = "idle"
    current_file: Optional[str] = None
    total_files: int = 0
    processed: int = 0
    progress: float = 0.0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error: Optional[str] = None
    results: list[FileResult] = Field(default_factory=list)


class RepoInfo(BaseModel):
    """Loaded repository info."""
    path: str
    name: str
    clone_path: Optional[str] = None
    file_count: int = 0
    tree: list[FileTreeNode] = Field(default_factory=list)
