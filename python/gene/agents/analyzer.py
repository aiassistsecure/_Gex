"""
Project Analyzer Agent
Scans and analyzes project structure, detects frameworks, dependencies, and patterns.
This is a pure-local agent — no LLM required.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from gene.config import GeneConfig

logger = logging.getLogger("gene.agents.analyzer")

# Framework detection patterns
FRAMEWORK_MARKERS = {
    "react": ["package.json:react", "src/App.jsx", "src/App.tsx"],
    "vue": ["package.json:vue", "src/App.vue"],
    "angular": ["angular.json", "package.json:@angular/core"],
    "fastapi": ["requirements.txt:fastapi", "app.py:FastAPI", "main.py:FastAPI"],
    "flask": ["requirements.txt:flask", "app.py:Flask"],
    "django": ["manage.py", "settings.py:INSTALLED_APPS"],
    "electron": ["package.json:electron", "main.js:BrowserWindow"],
    "next": ["next.config.js", "next.config.mjs", "package.json:next"],
    "tailwind": ["tailwind.config.js", "tailwind.config.ts"],
}


class ProjectAnalyzer:
    """Analyzes project structure without requiring an LLM."""

    def __init__(self, config: GeneConfig):
        self.config = config

    def analyze(self, path: str) -> Dict[str, Any]:
        """Full project analysis."""
        root = Path(path).resolve()

        if not root.exists():
            return {"error": f"Path not found: {path}"}

        return {
            "project": {
                "name": root.name,
                "path": str(root),
                "type": self._detect_project_type(root),
            },
            "frameworks": self._detect_frameworks(root),
            "languages": self._detect_languages(root),
            "dependencies": self._detect_dependencies(root),
            "structure": self._summarize_structure(root),
            "stats": self._compute_stats(root),
        }

    def _detect_project_type(self, root: Path) -> str:
        """Detect primary project type."""
        if (root / "electron" / "main.js").exists() and (root / "backend").exists():
            return "gene-app"
        if (root / "package.json").exists():
            pkg = self._read_json(root / "package.json")
            if "electron" in pkg.get("devDependencies", {}):
                return "electron"
            return "node"
        if (root / "pyproject.toml").exists() or (root / "setup.py").exists():
            return "python"
        if (root / "Cargo.toml").exists():
            return "rust"
        if (root / "go.mod").exists():
            return "go"
        return "unknown"

    def _detect_frameworks(self, root: Path) -> List[str]:
        """Detect frameworks used in the project."""
        detected = []

        for framework, markers in FRAMEWORK_MARKERS.items():
            for marker in markers:
                if ":" in marker:
                    file_name, search_term = marker.split(":", 1)
                    file_path = root / file_name

                    if not file_path.exists():
                        # Try recursive search
                        matches = list(root.rglob(file_name))
                        if not matches:
                            continue
                        file_path = matches[0]

                    try:
                        content = file_path.read_text(encoding="utf-8", errors="ignore")
                        if search_term in content:
                            detected.append(framework)
                            break
                    except Exception:
                        continue
                else:
                    if (root / marker).exists():
                        detected.append(framework)
                        break

        return detected

    def _detect_languages(self, root: Path) -> Dict[str, int]:
        """Count files by language/extension."""
        ext_map = {
            ".py": "Python",
            ".js": "JavaScript",
            ".jsx": "React JSX",
            ".ts": "TypeScript",
            ".tsx": "React TSX",
            ".html": "HTML",
            ".css": "CSS",
            ".json": "JSON",
            ".md": "Markdown",
            ".yml": "YAML",
            ".yaml": "YAML",
            ".toml": "TOML",
            ".rs": "Rust",
            ".go": "Go",
        }

        counts: Dict[str, int] = {}
        for f in root.rglob("*"):
            if not f.is_file():
                continue
            if any(skip in str(f) for skip in [
                "node_modules", "__pycache__", ".git", "dist", "build", ".venv", "venv"
            ]):
                continue
            lang = ext_map.get(f.suffix.lower())
            if lang:
                counts[lang] = counts.get(lang, 0) + 1

        return dict(sorted(counts.items(), key=lambda x: -x[1]))

    def _detect_dependencies(self, root: Path) -> Dict[str, List[str]]:
        """Detect project dependencies."""
        deps = {}

        # Python
        req_file = root / "requirements.txt"
        if req_file.exists():
            lines = req_file.read_text().strip().splitlines()
            deps["python"] = [
                l.strip().split(">=")[0].split("==")[0].split("[")[0]
                for l in lines
                if l.strip() and not l.startswith("#")
            ]

        # Node
        pkg_file = root / "package.json"
        if pkg_file.exists():
            pkg = self._read_json(pkg_file)
            node_deps = list(pkg.get("dependencies", {}).keys())
            node_deps += list(pkg.get("devDependencies", {}).keys())
            if node_deps:
                deps["node"] = node_deps

        return deps

    def _summarize_structure(self, root: Path) -> Dict[str, Any]:
        """Create a high-level structure summary."""
        top_dirs = []
        top_files = []

        for entry in sorted(root.iterdir()):
            if entry.name.startswith("."):
                continue
            if entry.is_dir() and entry.name not in ("node_modules", "__pycache__", "dist", "build"):
                child_count = sum(1 for _ in entry.rglob("*") if _.is_file())
                top_dirs.append({"name": entry.name, "files": child_count})
            elif entry.is_file():
                top_files.append(entry.name)

        return {"directories": top_dirs, "root_files": top_files}

    def _compute_stats(self, root: Path) -> Dict[str, int]:
        """Compute basic project statistics."""
        all_files = [
            f for f in root.rglob("*")
            if f.is_file() and not any(
                skip in str(f) for skip in ["node_modules", "__pycache__", ".git", "dist"]
            )
        ]
        total_size = sum(f.stat().st_size for f in all_files)

        return {
            "total_files": len(all_files),
            "total_size_bytes": total_size,
            "total_size_mb": round(total_size / (1024 * 1024), 2),
        }

    def _read_json(self, path: Path) -> dict:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return {}
