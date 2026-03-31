"""
Gex Checkpoints — Freeze/restore workspace snapshots.
Stores full file content in .gex/checkpoints/ inside the repo.
No git required. Replicates the concept without the dependency.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
from datetime import datetime
import json, uuid

router = APIRouter(prefix="/api/checkpoints", tags=["checkpoints"])

# Dirs/files we never snapshot
SKIP_DIRS = {"node_modules", ".git", "__pycache__", "venv", ".venv",
             "dist", "build", ".next", ".cache", ".gex", "_gex_repos"}
SKIP_EXT  = {".lock", ".rdb", ".DS_Store", ".pyc"}
MAX_FILE_BYTES = 500_000


def _checkpoint_dir(repo_path: str) -> Path:
    d = Path(repo_path) / ".gex" / "checkpoints"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _snapshot_repo(repo_path: str) -> dict[str, str]:
    """Walk the repo and capture all source file contents."""
    root = Path(repo_path).resolve()
    files: dict[str, str] = {}
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(skip in path.parts for skip in SKIP_DIRS):
            continue
        if path.suffix in SKIP_EXT or path.name.startswith("."):
            continue
        if path.stat().st_size > MAX_FILE_BYTES:
            continue
        rel = path.relative_to(root).as_posix()
        try:
            files[rel] = path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            pass
    return files


# ── Models ───────────────────────────────────────────────────────────────────

class FreezeRequest(BaseModel):
    repo_path: str
    label: Optional[str] = None   # human label, e.g. "pre-patch" or "working add-nav"


class RestoreRequest(BaseModel):
    repo_path: str
    files: Optional[list[str]] = None  # restore specific files only; None = full restore


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("")
async def freeze(req: FreezeRequest):
    """Freeze the current workspace state into a named snapshot."""
    ts = datetime.now()
    ts_str = ts.strftime("%Y%m%d_%H%M%S")   # e.g. 20260331_184442
    cp_id  = str(uuid.uuid4())[:6]
    filename = f"{ts_str}_{cp_id}"           # e.g. 20260331_184442_a3f9c1
    label = req.label or f"snapshot {ts.strftime('%Y-%m-%d %H:%M:%S')}"

    files = _snapshot_repo(req.repo_path)

    checkpoint = {
        "id":         filename,
        "label":      label,
        "timestamp":  ts.isoformat(),
        "repo_path":  req.repo_path,
        "file_count": len(files),
        "files":      files,
    }

    cp_file = _checkpoint_dir(req.repo_path) / f"{filename}.json"
    cp_file.write_text(json.dumps(checkpoint, indent=2), encoding="utf-8")

    return {
        "id":         filename,
        "label":      label,
        "timestamp":  ts.isoformat(),
        "file_count": len(files),
    }


@router.get("")
async def list_checkpoints(repo_path: str):
    """List all snapshots for a repo, newest first."""
    cp_dir = _checkpoint_dir(repo_path)
    checkpoints = []
    for f in sorted(cp_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            checkpoints.append({
                "id":         data["id"],
                "label":      data.get("label", "snapshot"),
                "timestamp":  data.get("timestamp", ""),
                "file_count": data.get("file_count", 0),
            })
        except Exception:
            pass
    return {"checkpoints": checkpoints}


@router.post("/{checkpoint_id}/restore")
async def restore(checkpoint_id: str, req: RestoreRequest):
    """Restore workspace files to a frozen snapshot."""
    cp_file = _checkpoint_dir(req.repo_path) / f"{checkpoint_id}.json"
    if not cp_file.exists():
        raise HTTPException(status_code=404, detail=f"Checkpoint not found: {checkpoint_id}")

    data = json.loads(cp_file.read_text(encoding="utf-8"))
    all_files: dict[str, str] = data.get("files", {})
    targets = req.files or list(all_files.keys())

    restored, failed = [], []
    for rel in targets:
        if rel not in all_files:
            failed.append(rel)
            continue
        target = Path(req.repo_path) / rel
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(all_files[rel], encoding="utf-8")
            restored.append(rel)
        except Exception as e:
            failed.append(f"{rel}: {e}")

    return {
        "status": "restored",
        "checkpoint_id": checkpoint_id,
        "label": data.get("label"),
        "restored": len(restored),
        "failed": failed,
    }


@router.delete("/{checkpoint_id}")
async def delete_checkpoint(checkpoint_id: str, repo_path: str):
    """Delete a snapshot."""
    cp_file = _checkpoint_dir(repo_path) / f"{checkpoint_id}.json"
    if not cp_file.exists():
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    cp_file.unlink()
    return {"status": "deleted", "id": checkpoint_id}
