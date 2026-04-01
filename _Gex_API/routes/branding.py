"""
Branding routes — Read/write app branding config (jenny.config.json + package.json).
Handles logo upload/URL fetch and icon resizing via Pillow.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional
import json, os, shutil, subprocess
from pathlib import Path
import httpx

router = APIRouter(prefix="/api/branding", tags=["branding"])


def get_workspace() -> Optional[Path]:
    ws = os.getenv("JENNY_WORKSPACE")
    return Path(ws) if ws else None


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def save_json(path: Path, data: dict):
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


class BrandingUpdate(BaseModel):
    appName:     Optional[str] = None
    productName: Optional[str] = None   # falls back to appName
    appId:       Optional[str] = None
    version:     Optional[str] = None
    description: Optional[str] = None
    accentColor: Optional[str] = None
    logoPath:    Optional[str] = None   # relative path within project


@router.get("")
async def get_branding():
    """Return merged branding config from jenny.config.json + package.json."""
    ws = get_workspace()
    if not ws:
        return {"error": "No workspace loaded"}

    jenny  = load_json(ws / "jenny.config.json")
    pkg   = load_json(ws / "package.json")
    build = pkg.get("build", {})

    return {
        "appName":     jenny.get("appName", pkg.get("name", "")),
        "productName": build.get("productName", jenny.get("appName", "")),
        "appId":       build.get("appId", ""),
        "version":     pkg.get("version", "1.0.0"),
        "description": jenny.get("description", pkg.get("description", "")),
        "accentColor": jenny.get("theme", {}).get("accent", "#e85d04"),
        "logoPath":    jenny.get("icon", ""),
        "iconSet":     jenny.get("iconSet", False),
    }


@router.post("")
async def update_branding(req: BrandingUpdate):
    """Write branding fields to jenny.config.json and package.json."""
    ws = get_workspace()
    if not ws:
        raise HTTPException(400, "No workspace loaded")

    # ── jenny.config.json ──────────────────────────────────────────
    jenny = load_json(ws / "jenny.config.json")
    if req.appName:
        jenny["appName"] = req.appName
    if req.description is not None:
        jenny["description"] = req.description
    if req.accentColor:
        jenny.setdefault("theme", {})["accent"] = req.accentColor
    if req.logoPath is not None:
        jenny["icon"] = req.logoPath
    save_json(ws / "jenny.config.json", jenny)

    # ── package.json ──────────────────────────────────────────────
    pkg = load_json(ws / "package.json")
    if req.version:
        pkg["version"] = req.version
    if req.appName or req.productName:
        pkg.setdefault("build", {})["productName"] = req.productName or req.appName
    if req.appId:
        pkg.setdefault("build", {})["appId"] = req.appId
    if req.description is not None:
        pkg["description"] = req.description
    # Sync icon into electron-builder config
    if req.logoPath:
        pkg.setdefault("build", {})["icon"] = req.logoPath
    save_json(ws / "package.json", pkg)

    return {"status": "saved"}


@router.post("/logo")
async def upload_logo(file: UploadFile = File(...)):
    """Accept a logo upload, save it, and generate icon sizes via Pillow."""
    ws = get_workspace()
    if not ws:
        raise HTTPException(400, "No workspace loaded")

    assets_dir = ws / "assets"
    assets_dir.mkdir(exist_ok=True)

    # Save original
    ext        = Path(file.filename).suffix.lower() or ".png"
    logo_path  = assets_dir / f"logo{ext}"
    content    = await file.read()
    logo_path.write_bytes(content)

    icon_result = _generate_icons(logo_path, assets_dir)
    rel_logo    = str(logo_path.relative_to(ws)).replace("\\", "/")

    # Auto-save into config
    jenny = load_json(ws / "jenny.config.json")
    jenny["icon"] = rel_logo
    if icon_result.get("ico"):
        jenny["iconSet"] = True
    save_json(ws / "jenny.config.json", jenny)

    pkg = load_json(ws / "package.json")
    ico = icon_result.get("ico", rel_logo)
    pkg.setdefault("build", {})["icon"] = ico
    save_json(ws / "package.json", pkg)

    return {"logo": rel_logo, "icons": icon_result}


@router.post("/logo-url")
async def logo_from_url(body: dict):
    """Fetch a logo from a URL, save it, then process icons."""
    ws  = get_workspace()
    url = body.get("url", "").strip()
    if not ws or not url:
        raise HTTPException(400, "No workspace or URL")

    assets_dir = ws / "assets"
    assets_dir.mkdir(exist_ok=True)

    async with httpx.AsyncClient(timeout=10.0) as client:
        res = await client.get(url)
    if res.status_code != 200:
        raise HTTPException(400, f"Could not fetch image: HTTP {res.status_code}")

    content_type = res.headers.get("content-type", "")
    ext = ".png" if "png" in content_type else ".jpg" if "jpeg" in content_type else ".png"
    logo_path = assets_dir / f"logo{ext}"
    logo_path.write_bytes(res.content)

    icon_result = _generate_icons(logo_path, assets_dir)
    rel_logo    = str(logo_path.relative_to(ws)).replace("\\", "/")

    jenny = load_json(ws / "jenny.config.json")
    jenny["icon"] = rel_logo
    jenny["iconSet"] = bool(icon_result.get("ico"))
    save_json(ws / "jenny.config.json", jenny)

    pkg = load_json(ws / "package.json")
    pkg.setdefault("build", {})["icon"] = icon_result.get("ico", rel_logo)
    save_json(ws / "package.json", pkg)

    return {"logo": rel_logo, "icons": icon_result}


def _generate_icons(source: Path, assets_dir: Path) -> dict:
    """Generate icon files using Pillow (preferred) or ImageMagick CLI fallback."""
    result = {}
    try:
        from PIL import Image
        img = Image.open(source).convert("RGBA")

        # .ico with all required Windows sizes
        ico_path = assets_dir / "icon.ico"
        img.save(ico_path, format="ICO", sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
        result["ico"] = str(ico_path.relative_to(assets_dir.parent)).replace("\\", "/")

        # PNG sizes for Linux/macOS
        for size in [16, 32, 64, 128, 256, 512]:
            out = assets_dir / f"icon_{size}.png"
            img.resize((size, size), Image.LANCZOS).save(out, format="PNG")
        result["png512"] = str((assets_dir / "icon_512.png").relative_to(assets_dir.parent)).replace("\\", "/")
        result["method"] = "pillow"

    except ImportError:
        # Try ImageMagick CLI fallback
        try:
            ico_path = assets_dir / "icon.ico"
            subprocess.run(
                ["magick", "convert", str(source),
                 "-define", "icon:auto-resize=256,128,64,48,32,16",
                 str(ico_path)],
                check=True, capture_output=True
            )
            result["ico"] = str(ico_path.relative_to(assets_dir.parent)).replace("\\", "/")
            result["method"] = "imagemagick"
        except Exception:
            result["method"] = "none"
            result["warning"] = "Install Pillow (pip install pillow) or ImageMagick for icon generation"

    except Exception as e:
        result["error"] = str(e)
        result["method"] = "failed"

    return result
