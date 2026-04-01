"""
Jenny Template Manager
Registers, discovers, and scaffolds project templates.
Templates are composable: mix frontend + backend + config.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional

from jinja2 import Environment, BaseLoader

logger = logging.getLogger("jenny.templates")

# Built-in templates directory
BUILTIN_DIR = Path(__file__).parent / "builtin"


class TemplateManager:
    """Discovers and scaffolds project templates."""

    def __init__(self, extra_dirs: Optional[List[str]] = None):
        self._templates: Dict[str, Dict[str, Any]] = {}
        self._jinja = Environment(loader=BaseLoader())
        self._discover(BUILTIN_DIR)

        for d in (extra_dirs or []):
            if Path(d).exists():
                self._discover(Path(d))

    def _discover(self, root: Path) -> None:
        """Scan a directory for template manifests (template.json)."""
        if not root.exists():
            return

        for entry in root.iterdir():
            if entry.is_dir():
                manifest = entry / "template.json"
                if manifest.exists():
                    try:
                        meta = json.loads(manifest.read_text(encoding="utf-8"))
                        meta["_path"] = str(entry)
                        self._templates[meta.get("id", entry.name)] = meta
                        logger.info(f"Discovered template: {meta.get('name', entry.name)}")
                    except Exception as e:
                        logger.warning(f"Bad template manifest at {manifest}: {e}")

    def list_templates(self) -> List[Dict[str, Any]]:
        """List all available templates."""
        return [
            {
                "id": tid,
                "name": t.get("name", tid),
                "description": t.get("description", ""),
                "stack": t.get("stack", []),
                "category": t.get("category", "general"),
            }
            for tid, t in self._templates.items()
        ]

    def get_template(self, template_id: str) -> Optional[Dict[str, Any]]:
        """Get full template details."""
        return self._templates.get(template_id)

    def scaffold(
        self,
        template_id: str,
        project_name: str,
        target_dir: str,
        options: dict = {},
    ) -> Dict[str, Any]:
        """Scaffold a new project from a template.

        Copies template files, applies variable substitution via Jinja2,
        and returns the created file list.
        """
        template = self._templates.get(template_id)
        if not template:
            return {"error": f"Template not found: {template_id}"}

        source = Path(template["_path"])
        target = Path(target_dir).resolve()

        if target.exists() and any(target.iterdir()):
            return {"error": f"Target directory is not empty: {target}"}

        target.mkdir(parents=True, exist_ok=True)

        # Template variables
        variables = {
            "project_name": project_name,
            "project_name_slug": project_name.lower().replace(" ", "-").replace("_", "-"),
            "project_name_snake": project_name.lower().replace(" ", "_").replace("-", "_"),
            "project_name_pascal": project_name.replace(" ", "").replace("-", "").replace("_", ""),
            "gene_version": "1.0.0",
            **options,
        }

        # Copy and template files
        created_files = []
        for src_file in source.rglob("*"):
            if src_file.is_file() and src_file.name != "template.json":
                rel = src_file.relative_to(source)
                # Apply variable substitution to directory/file names
                rel_str = str(rel)
                for key, val in variables.items():
                    rel_str = rel_str.replace(f"__{key}__", val)
                
                dst = target / rel_str
                dst.parent.mkdir(parents=True, exist_ok=True)

                # Template text files, copy binary files
                try:
                    content = src_file.read_text(encoding="utf-8")
                    # Jinja2 render
                    rendered = self._jinja.from_string(content).render(**variables)
                    dst.write_text(rendered, encoding="utf-8")
                except UnicodeDecodeError:
                    shutil.copy2(src_file, dst)

                created_files.append(str(rel_str))

        logger.info(f"Scaffolded '{project_name}' from template '{template_id}' → {target}")

        return {
            "project_name": project_name,
            "template": template_id,
            "target_dir": str(target),
            "files_created": len(created_files),
            "files": created_files,
        }
