"""
rebrand_to_jenny.py
One-shot rename of every "gene/Gene/GENE" → "jenny/Jenny/JENNY" across the codebase.
Also renames files and directories named "gene*" → "jenny*".

Safe skips: gex, _Gex, node_modules, .venv, __pycache__, .git, dist, build, *.png, *.ico, *.exe
"""
import os
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).parent

# ── Dirs/files to skip entirely ──────────────────────────────────
SKIP_DIRS = {
    "node_modules", ".venv", "__pycache__", ".git",
    "dist", "build", ".next", "coverage",
}
SKIP_EXTS = {
    ".png", ".jpg", ".jpeg", ".ico", ".exe", ".dll", ".so",
    ".pyc", ".pyo", ".zip", ".tar", ".gz", ".whl", ".lock",
}
SKIP_FILES = {"rebrand_to_jenny.py"}   # don't eat ourselves

# ── Replacement pairs (order matters — longest first) ────────────
TEXT_REPLACEMENTS = [
    # env vars first (GENE_ prefix)
    (r'\bGENE_',    'JENNY_'),
    # gene.config.json  →  jenny.config.json
    (r'gene\.config\.json', 'jenny.config.json'),
    # gene-runtime  →  jenny-runtime
    (r'gene-runtime', 'jenny-runtime'),
    # Title-case word
    (r'\bGene\b',   'Jenny'),
    # lower-case word
    (r'\bgene\b',   'jenny'),
    # ALL-CAPS word (after GENE_ already caught)
    (r'\bGENE\b',   'JENNY'),
]

# Pre-compile patterns
COMPILED = [(re.compile(p), r) for p, r in TEXT_REPLACEMENTS]

changed_files  = []
renamed_paths  = []

def should_skip(path: Path) -> bool:
    for part in path.parts:
        if part in SKIP_DIRS:
            return True
    if path.suffix.lower() in SKIP_EXTS:
        return True
    if path.name in SKIP_FILES:
        return True
    return False

def replace_in_file(path: Path) -> bool:
    """Return True if file was modified."""
    try:
        original = path.read_text(encoding="utf-8", errors="surrogateescape")
    except Exception:
        return False   # binary or unreadable

    text = original
    for pattern, repl in COMPILED:
        text = pattern.sub(repl, text)

    if text != original:
        path.write_text(text, encoding="utf-8", errors="surrogateescape")
        return True
    return False

# ── Phase 1: Replace text content in all files ───────────────────
print("\n=== Phase 1: Text replacement ===")
for path in sorted(ROOT.rglob("*")):
    if path.is_dir() or should_skip(path):
        continue
    if replace_in_file(path):
        rel = path.relative_to(ROOT)
        changed_files.append(str(rel))
        print(f"  ✏  {rel}")

# ── Phase 2: Rename files named gene* → jenny* ───────────────────
print("\n=== Phase 2: File renames ===")
# Collect bottom-up so we don't rename a parent before child
all_paths = sorted(ROOT.rglob("*"), key=lambda p: -len(p.parts))
for path in all_paths:
    if should_skip(path):
        continue
    if re.search(r'\bgene\b', path.name, re.IGNORECASE):
        new_name = re.sub(r'\bgene\b', lambda m: 'Jenny' if m.group().istitle() else ('JENNY' if m.group().isupper() else 'jenny'), path.name, flags=re.IGNORECASE)
        new_path = path.parent / new_name
        if new_path != path:
            try:
                path.rename(new_path)
                print(f"  📁 {path.relative_to(ROOT)}  →  {new_name}")
                renamed_paths.append((str(path.relative_to(ROOT)), new_name))
            except Exception as e:
                print(f"  ⚠  Could not rename {path.name}: {e}")

# ── Summary ───────────────────────────────────────────────────────
print(f"\n✅ Done!")
print(f"   {len(changed_files)} files had text replaced")
print(f"   {len(renamed_paths)} files/dirs renamed")
