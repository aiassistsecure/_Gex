"""
Template management routes.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from jenny.templates.manager import TemplateManager

router = APIRouter()

_manager: Optional[TemplateManager] = None


def get_manager() -> TemplateManager:
    global _manager
    if _manager is None:
        _manager = TemplateManager()
    return _manager


class ScaffoldRequest(BaseModel):
    template: str = "default"
    name: str
    target_dir: str
    options: dict = {}


@router.get("/templates")
async def list_templates():
    """List all available templates."""
    manager = get_manager()
    return {"templates": manager.list_templates()}


@router.get("/templates/{template_id}")
async def get_template(template_id: str):
    """Get template details."""
    manager = get_manager()
    tpl = manager.get_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail=f"Template not found: {template_id}")
    return tpl


@router.post("/templates/scaffold")
async def scaffold_project(req: ScaffoldRequest):
    """Scaffold a new project from a template."""
    manager = get_manager()
    result = manager.scaffold(
        template_id=req.template,
        project_name=req.name,
        target_dir=req.target_dir,
        options=req.options,
    )
    return result
