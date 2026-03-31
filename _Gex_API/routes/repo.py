"""
Repo routes — Load, browse, and read repository files.
Supports: local paths, GitHub/GitLab URLs (downloads as ZIP), direct ZIP drops.
"""
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pathlib import Path
import httpx
import zipfile
import io
import re
import shutil
import time
import os
import tempfile

from gex.scanner import GexScanner
from gex.types import GexConfig, FileTreeNode

router = APIRouter(prefix="/api/repo", tags=["repo"])

# Module-level scanner + state
_scanner = GexScanner(GexConfig())
_loaded_repo: dict = {}

# Workspace for downloaded repos
CLONE_WORKSPACE = Path(__file__).parent.parent / "_gex_repos"
CLONE_WORKSPACE.mkdir(exist_ok=True)

# Pattern to detect git URLs (scheme is optional for user convenience)
GIT_URL_PATTERN = re.compile(
    r"^(?:https?://)?(github\.com|gitlab\.com|bitbucket\.org)/[\w\-\.]+/[\w\-\.]+",
    re.IGNORECASE,
)


def is_git_url(path: str) -> bool:
    """Check if the given path looks like a git repository URL."""
    return bool(GIT_URL_PATTERN.match(path.strip().rstrip("/")))


def parse_github_url(url: str) -> tuple[str, str, str]:
    """Parse a GitHub URL into (owner, repo, branch).
    Supports: https://github.com/owner/repo[/tree/branch]
    """
    url = url.strip().rstrip("/")
    if url.endswith(".git"):
        url = url[:-4]

    parts = url.replace("https://", "").replace("http://", "").split("/")
    # parts[0] = 'github.com', parts[1] = owner, parts[2] = repo
    if len(parts) < 3:
        raise ValueError(f"Invalid GitHub URL: {url}")

    owner = parts[1]
    repo = parts[2]
    branch = "main"

    # Check for /tree/branch pattern
    if len(parts) >= 5 and parts[3] == "tree":
        branch = parts[4]

    return owner, repo, branch


def get_zip_url(url: str) -> tuple[str, str]:
    """Convert a git URL to a ZIP download URL. Returns (zip_url, repo_name)."""
    url = url.strip().rstrip("/")
    if url.endswith(".git"):
        url = url[:-4]

    if "github.com" in url:
        owner, repo, branch = parse_github_url(url)
        zip_url = f"https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.zip"
        return zip_url, repo
    elif "gitlab.com" in url:
        parts = url.replace("https://", "").split("/")
        owner, repo = parts[1], parts[2]
        zip_url = f"https://gitlab.com/{owner}/{repo}/-/archive/main/{repo}-main.zip"
        return zip_url, repo
    else:
        raise ValueError(f"Unsupported git host: {url}")


async def download_repo_zip(url: str) -> Path:
    """Download a repo as ZIP and extract it. Returns the extracted path."""
    zip_url, repo_name = get_zip_url(url)
    
    # Append timestamp for uniqueness so successive loads don't overwrite each other
    timestamp = int(time.time())
    unique_repo_name = f"{repo_name}_{timestamp}"
    dest = CLONE_WORKSPACE / unique_repo_name

    # Download ZIP
    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        resp = await client.get(zip_url)
        if resp.status_code == 404:
            # Try 'master' branch if 'main' fails
            fallback_url = zip_url.replace("/main.zip", "/master.zip").replace("/heads/main.", "/heads/master.")
            resp = await client.get(fallback_url)
        if resp.status_code != 200:
            raise Exception(f"Failed to download: HTTP {resp.status_code} from {zip_url}")

    # Extract ZIP
    dest.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
        # GitHub ZIPs have a top-level folder like "repo-main/"
        # We need to strip that and extract to our dest
        top_level = None
        for name in zf.namelist():
            parts = name.split("/", 1)
            if top_level is None:
                top_level = parts[0]
            if len(parts) > 1 and parts[1]:
                target = dest / parts[1]
                if name.endswith("/"):
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with open(target, "wb") as f:
                        f.write(zf.read(name))

    return dest


class LoadRepoRequest(BaseModel):
    path: str


class LoadRepoResponse(BaseModel):
    path: str
    name: str
    file_count: int
    tree: list[FileTreeNode]
    source: str = "local"  # "local" | "git" | "zip"


@router.post("/load", response_model=LoadRepoResponse)
async def load_repo(req: LoadRepoRequest):
    """Load a repo by local path or git URL (downloads as ZIP). Returns file tree."""
    raw_path = req.path.strip()
    source = "local"

    # Detect git URL
    if is_git_url(raw_path):
        # Auto-fix missing scheme
        if not raw_path.startswith("http"):
            raw_path = "https://" + raw_path
            
        try:
            repo_path = await download_repo_zip(raw_path)
            source = "git"
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Download failed: {str(e)}")
    else:
        # Local path — allowed when running as Gene IDE
        local = Path(raw_path).resolve()
        if not local.exists() or not local.is_dir():
            raise HTTPException(status_code=404, detail=f"Directory not found: {raw_path}")
        repo_path = local
        source = "local"

    tree = await _scanner.build_file_tree(str(repo_path))
    files = await _scanner.scan_tree(str(repo_path))

    _loaded_repo["path"] = str(repo_path)
    _loaded_repo["name"] = repo_path.name
    _loaded_repo["tree"] = tree
    _loaded_repo["files"] = files
    _loaded_repo["source"] = source

    return LoadRepoResponse(
        path=str(repo_path),
        name=repo_path.name,
        file_count=len(files),
        tree=tree,
        source=source,
    )


@router.get("/tree")
async def get_tree():
    """Get the file tree of the loaded repo."""
    if "tree" not in _loaded_repo:
        raise HTTPException(status_code=400, detail="No repo loaded")
    return _loaded_repo["tree"]


@router.get("/file")
async def read_file(path: str = Query(..., description="Absolute path to file")):
    """Read a single file's content."""
    file_path = Path(path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {path}")
    if not file_path.is_file():
        raise HTTPException(status_code=400, detail=f"Not a file: {path}")

    try:
        content = file_path.read_text(errors="replace")
        return {
            "path": str(file_path),
            "name": file_path.name,
            "content": content,
            "size": file_path.stat().st_size,
            "extension": file_path.suffix,
            "lines": content.count("\n") + 1,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SaveFileRequest(BaseModel):
    path: str
    content: str


@router.post("/save")
async def save_file(req: SaveFileRequest):
    """Save content to a file."""
    file_path = Path(req.path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {req.path}")
    if not file_path.is_file():
        raise HTTPException(status_code=400, detail=f"Not a file: {req.path}")

    try:
        file_path.write_text(req.content, encoding="utf-8")
        return {"status": "saved", "path": req.path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download")
async def download_repo_action(path: str, background_tasks: BackgroundTasks):
    """Zip the modified repository and return it as a download."""
    repo_path = Path(path).resolve()
    if not repo_path.exists() or not repo_path.is_dir():
        raise HTTPException(status_code=404, detail="Repository not found")

    # Generate a temporary path for the zip base
    zip_base = tempfile.mktemp(prefix="gex_export_")
    shutil.make_archive(zip_base, 'zip', root_dir=repo_path)
    zip_file = f"{zip_base}.zip"

    # Ensure we clean up the zip file from tmp after the user downloads it
    background_tasks.add_task(os.remove, zip_file)

    return FileResponse(
        zip_file,
        media_type="application/zip",
        filename=f"{repo_path.name}_patched.zip"
    )
