#!/usr/bin/env python3
"""
Gex — AI Code Surgeon
Scans source code, clones the repo to a parallel directory, asks the LLM
for surgical fixes using <<<WRITE>>> / <<<PATCH>>> patterns, applies them
to the clone, and posts a detailed summary to an AiAS workspace.

Supports single-file (--file) or full-repo (--scan) modes.

Surgical edit patterns (Keystone-lite):
  <<<WRITE:path/to/file>>>   — full file overwrite in clone
  <<<PATCH:path/to/file>>>   — line-based operations (replace/insert/delete)
  <<<END>>>                  — terminates a WRITE or PATCH block

Usage:
  python gex.py --scan ./myproject
  python gex.py --scan ./myproject --file src/auth.py
  python gex.py --scan ./myproject --file src/auth.py --focus "fix the login bug"
  python gex.py --scan ./myproject --dry-run
  python gex.py --list-workspaces
"""

import os
import sys
import json
import hashlib
import argparse
import shutil
import re
import httpx
from pathlib import Path
from datetime import datetime
from typing import Optional

API_BASE = os.getenv("AIAS_API_URL", "https://api.aiassist.net")
API_KEY = os.getenv("AIAS_API_KEY", "aai_YOUR_AIAS_KEY")
MODEL = os.getenv("AIAS_MODEL", "moonshotai/kimi-k2-instruct")
PROVIDER = os.getenv("AIAS_PROVIDER", "groq")

SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", "venv", ".venv",
    "dist", "build", ".next", ".cache", "appendonlydir",
    "redis-data", ".local", ".replit", ".upm", "_gex",
}
SKIP_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "dump.rdb", ".DS_Store",
}
CODE_EXTENSIONS = {
    ".py", ".ts", ".tsx", ".js", ".jsx", ".rs", ".go",
    ".java", ".css", ".html", ".sql", ".sh", ".toml", ".yaml", ".yml",
}
MAX_FILE_SIZE = 200_000
MAX_CONTEXT_CHARS = 100_000

auth_headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}
if PROVIDER:
    auth_headers["X-AiAssist-Provider"] = PROVIDER


def scan_tree(root: str, focus_file: str = None) -> list[dict]:
    root_path = Path(root).resolve()
    files = []
    for path in sorted(root_path.rglob("*")):
        if not path.is_file():
            continue
        if any(skip in path.parts for skip in SKIP_DIRS):
            continue
        if path.name in SKIP_FILES:
            continue
        if path.suffix not in CODE_EXTENSIONS:
            continue
        if focus_file and focus_file not in str(path):
            continue
        rel = str(path.relative_to(root_path))
        try:
            size = path.stat().st_size
            content = path.read_text(errors="replace")
            if size > MAX_FILE_SIZE:
                lines = content.split("\n")
                max_lines = MAX_FILE_SIZE // 80
                content = "\n".join(lines[:max_lines]) + f"\n\n# ... truncated ({len(lines) - max_lines} more lines)"
            files.append({"path": rel, "size": size, "content": content, "lines": content.count("\n") + 1})
        except Exception as e:
            files.append({"path": rel, "error": str(e)})
    return files


def build_context(files: list[dict], max_chars: int = MAX_CONTEXT_CHARS) -> str:
    parts = []
    total = 0
    for f in files:
        content = f.get("content", f.get("error", ""))
        numbered = "\n".join(f"{i+1:>4}| {line}" for i, line in enumerate(content.split("\n")))
        header = f"### {f['path']} ({f.get('lines', '?')} lines)\n"
        block = f"```\n{numbered}\n```\n"
        chunk = header + block
        if total + len(chunk) > max_chars:
            parts.append(f"### {f['path']}\n[truncated: context limit reached]\n")
            break
        parts.append(chunk)
        total += len(chunk)
    return "\n".join(parts)


def build_tree_summary(files: list[dict]) -> str:
    return "\n".join(f"  {f['path']}  ({f.get('lines', '?')} lines, {f.get('size', 0)} bytes)" for f in files)


def send_to_llm(client: httpx.Client, system_prompt: str, user_msg: str) -> str:
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg},
        ],
        "temperature": 0.2,
        "max_tokens": 16384,
    }
    resp = client.post(f"{API_BASE}/v1/chat/completions", json=payload, headers=auth_headers, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    content = data["choices"][0]["message"]["content"] or ""
    if not content.strip():
        print(f"[!] LLM returned empty content.")
        print(json.dumps(data, indent=2)[:2000])
    return content


def create_workspace(client: httpx.Client, name: str) -> Optional[dict]:
    resp = client.post(f"{API_BASE}/api/workspaces", json={
        "initial_message": f"Gex surgery workspace: {name}",
        "client_id": f"gex_{hashlib.md5(name.encode()).hexdigest()[:12]}",
    }, headers=auth_headers, timeout=30)
    if resp.status_code == 401:
        print("[!] API key auth failed. Check AIAS_API_KEY.")
        return None
    resp.raise_for_status()
    return resp.json()


def store_in_workspace(client: httpx.Client, workspace_id: str, content: str):
    max_len = 12000
    chunks = [content[i:i+max_len] for i in range(0, len(content), max_len)]
    for i, chunk in enumerate(chunks):
        label = f" (part {i+1}/{len(chunks)})" if len(chunks) > 1 else ""
        try:
            resp = client.post(
                f"{API_BASE}/api/workspaces/{workspace_id}/messages",
                json={"content": chunk},
                headers=auth_headers,
                timeout=120,
            )
            if resp.status_code != 200:
                print(f"[!] Failed to store in workspace{label}: {resp.status_code}")
        except Exception as e:
            print(f"[!] Workspace upload{label} failed: {e}")


def clone_repo(source: str) -> str:
    source_path = Path(source).resolve()
    clone_path = source_path.parent / f"{source_path.name}_gex"

    if clone_path.exists():
        print(f"       Cleaning existing clone: {clone_path.name}/")
        shutil.rmtree(clone_path)

    print(f"       Cloning to: {clone_path.name}/")
    shutil.copytree(
        source_path, clone_path,
        ignore=shutil.ignore_patterns(*SKIP_DIRS, *SKIP_FILES),
        dirs_exist_ok=False,
    )
    return str(clone_path)


def parse_surgical_blocks(llm_output: str) -> list[dict]:
    blocks = []
    pattern = re.compile(r'<<<(WRITE|PATCH):(.+?)>>>\s*\n(.*?)<<<END>>>', re.DOTALL)

    for match in pattern.finditer(llm_output):
        action = match.group(1)
        filepath = match.group(2).strip()
        body = match.group(3)

        if action == "WRITE":
            blocks.append({"action": "write", "path": filepath, "content": body.rstrip("\n")})
        elif action == "PATCH":
            parsed_ops = _parse_patch_json(filepath, body)
            if parsed_ops is not None:
                blocks.append({"action": "patch", "path": filepath, "operations": parsed_ops})
            else:
                blocks.append({"action": "patch_error", "path": filepath, "raw": body, "error": "all parse strategies failed"})

    return blocks


def _parse_patch_json(filepath: str, body: str):
    raw = body.strip()
    if raw.startswith("```"):
        raw = re.sub(r'^```\w*\n?', '', raw)
        raw = re.sub(r'\n?```$', '', raw)
        raw = raw.strip()

    try:
        ops_data = json.loads(raw)
        return ops_data if isinstance(ops_data, list) else ops_data.get("operations", [ops_data])
    except json.JSONDecodeError:
        pass

    fixed = re.sub(
        r'"content"\s*:\s*"((?:[^"\\]|\\.)*?)"',
        lambda m: '"content": ' + json.dumps(m.group(1).replace('\n', '\\n')),
        raw,
        flags=re.DOTALL,
    )
    try:
        ops_data = json.loads(fixed)
        return ops_data if isinstance(ops_data, list) else ops_data.get("operations", [ops_data])
    except json.JSONDecodeError:
        pass

    ops = []
    op_pattern = re.compile(
        r'\{\s*"action"\s*:\s*"(\w+)"'
        r'(?:.*?"start_line"\s*:\s*(\d+))?'
        r'(?:.*?"end_line"\s*:\s*(\d+))?'
        r'(?:.*?"content"\s*:\s*"((?:[^"\\]|\\.)*)?")?'
        r'[^}]*\}',
        re.DOTALL,
    )
    for m in op_pattern.finditer(raw):
        op = {"action": m.group(1)}
        if m.group(2):
            op["start_line"] = int(m.group(2))
        if m.group(3):
            op["end_line"] = int(m.group(3))
        if m.group(4) is not None:
            op["content"] = m.group(4).replace("\\n", "\n").replace('\\"', '"')
        ops.append(op)

    if ops:
        print(f"[*] Recovered {len(ops)} operations for {filepath} via regex fallback")
        return ops

    print(f"[!] Failed to parse PATCH JSON for {filepath} — all strategies failed")
    return None


def apply_patch_operations(content: str, operations: list[dict]) -> tuple[str, int, int]:
    lines = content.split("\n")
    added = 0
    removed = 0

    sorted_ops = sorted(operations, key=lambda op: op.get("start_line", 0), reverse=True)

    for op in sorted_ops:
        action = op.get("action", "replace")
        start = op.get("start_line", 1)
        start_idx = start - 1

        if action == "insert":
            new_lines = op.get("content", "").split("\n")
            lines = lines[:start_idx] + new_lines + lines[start_idx:]
            added += len(new_lines)

        elif action == "replace":
            end_idx = op.get("end_line", start)
            new_lines = op.get("content", "").split("\n")
            old_count = end_idx - start_idx
            lines = lines[:start_idx] + new_lines + lines[end_idx:]
            added += len(new_lines)
            removed += old_count

        elif action == "delete":
            end_idx = op.get("end_line", start)
            old_count = end_idx - start_idx
            lines = lines[:start_idx] + lines[end_idx:]
            removed += old_count

    return "\n".join(lines), added, removed


def validate_clone_path(clone_path: str, filepath: str) -> Optional[Path]:
    clone_root = Path(clone_path).resolve()
    candidate = (clone_root / filepath).resolve()
    if not str(candidate).startswith(str(clone_root) + os.sep) and candidate != clone_root:
        return None
    return candidate


def apply_blocks_to_clone(clone_path: str, blocks: list[dict]) -> list[dict]:
    results = []
    for block in blocks:
        filepath = block["path"]
        full_path = validate_clone_path(clone_path, filepath)

        if full_path is None:
            results.append({"path": filepath, "action": block["action"].upper(), "status": "blocked", "detail": "path traversal detected — skipped"})
            print(f"       BLOCK  {filepath}  [PATH TRAVERSAL — REJECTED]")
            continue

        if block["action"] == "write":
            full_path.parent.mkdir(parents=True, exist_ok=True)
            full_path.write_text(block["content"])
            results.append({"path": filepath, "action": "WRITE", "status": "applied", "detail": f"wrote {len(block['content'])} chars"})
            print(f"       WRITE  {filepath}")

        elif block["action"] == "patch":
            if not full_path.exists():
                results.append({"path": filepath, "action": "PATCH", "status": "skipped", "detail": "file not found in clone"})
                print(f"       PATCH  {filepath}  [SKIP — not found]")
                continue
            original = full_path.read_text(errors="replace")
            try:
                new_content, added, removed = apply_patch_operations(original, block["operations"])
                full_path.write_text(new_content)
                results.append({
                    "path": filepath, "action": "PATCH", "status": "applied",
                    "detail": f"+{added} -{removed} lines, {len(block['operations'])} ops",
                })
                print(f"       PATCH  {filepath}  (+{added} -{removed})")
            except Exception as e:
                results.append({"path": filepath, "action": "PATCH", "status": "error", "detail": str(e)})
                print(f"       PATCH  {filepath}  [ERROR: {e}]")

        elif block["action"] == "patch_error":
            results.append({"path": filepath, "action": "PATCH", "status": "parse_error", "detail": block["error"]})
            print(f"       PATCH  {filepath}  [PARSE ERROR]")

    return results


GEX_SYSTEM_PROMPT = """You are Gex, an expert code surgeon. You analyze source code and produce precise, surgical fixes.

You MUST use these exact block formats for ALL code changes:

## <<<WRITE:path/to/file>>>
Use for NEW files or FULL rewrites (>50% of file changes). Write the complete file content between the tags.
```
<<<WRITE:src/utils/helper.py>>>
def helper():
    return "fixed"
<<<END>>>
```

## <<<PATCH:path/to/file>>>
Use for TARGETED edits (1-30 lines changing). Provide a JSON array of operations:
```
<<<PATCH:src/auth.py>>>
[
  {"action": "replace", "start_line": 15, "end_line": 20, "content": "    return validate(token)"},
  {"action": "insert", "start_line": 5, "content": "import hashlib"},
  {"action": "delete", "start_line": 42, "end_line": 45}
]
<<<END>>>
```

### Operation types:
- **replace**: Replace lines start_line through end_line with new content
- **insert**: Insert content BEFORE start_line (existing code shifts down)
- **delete**: Remove lines start_line through end_line

### Rules:
1. Reference EXACT line numbers from the numbered source code provided
2. For replace: ALWAYS include the full line range (start to end of the block being replaced)
3. Keep patches minimal — change only what needs fixing
4. Never use placeholders like "// rest of code here"
5. Provide a clear explanation BEFORE each block explaining what you're fixing and why
6. After all blocks, provide a ## Summary section listing all changes made

If no fixes are needed, say so clearly and explain why the code is already correct."""


def build_user_prompt(files: list[dict], tree: str, focus: str = None) -> str:
    context = build_context(files)
    focus_block = f"\n\n**Focus area**: {focus}\nPrioritize fixes related to this area." if focus else ""

    return f"""Analyze this code and provide surgical fixes:

## File Tree
{tree}

## Source Code (line-numbered)
{context}
{focus_block}

Provide your fixes using <<<WRITE>>> and <<<PATCH>>> blocks. Be precise with line numbers.
End with a ## Summary of all changes."""


def build_summary_report(
    repo_name: str, files: list[dict], blocks: list[dict],
    results: list[dict], llm_output: str, clone_path: str, focus: str = None
) -> str:
    applied = [r for r in results if r["status"] == "applied"]
    skipped = [r for r in results if r["status"] != "applied"]

    changes_detail = ""
    for r in results:
        icon = "+" if r["status"] == "applied" else "!" if r["status"] == "error" else "~"
        changes_detail += f"  [{icon}] {r['action']:5}  {r['path']}  — {r['detail']}\n"

    return f"""# Gex Surgery Report
**Repo**: `{repo_name}`
**Clone**: `{Path(clone_path).name}/`
**Date**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
**Model**: `{PROVIDER}/{MODEL}`
**Files Scanned**: {len(files)}
**Patches Applied**: {len(applied)} / {len(results)}
{f'**Focus**: {focus}' if focus else ''}

---

## Changes Applied

{changes_detail}

---

## LLM Analysis

{llm_output}

---
*Generated by Gex — AI Code Surgeon*
"""


def run_gex(repo_path: str, focus: str = None, focus_file: str = None, dry_run: bool = False):
    print(f"\n{'='*60}")
    print(f"  Gex — AI Code Surgeon")
    print(f"  Repo:  {repo_path}")
    print(f"  Model: {PROVIDER}/{MODEL}")
    if focus:
        print(f"  Focus: {focus}")
    if focus_file:
        print(f"  File:  {focus_file}")
    if dry_run:
        print(f"  Mode:  DRY RUN (no files modified)")
    print(f"{'='*60}\n")

    if not API_KEY:
        print("[!] AIAS_API_KEY not set.")
        sys.exit(1)

    print("[1/6] Scanning codebase...")
    files = scan_tree(repo_path, focus_file)
    print(f"       Found {len(files)} source file(s)")
    if not files:
        print("[!] No matching files found.")
        sys.exit(1)

    tree = build_tree_summary(files)

    print("[2/6] Cloning repository...")
    if dry_run:
        clone_path = None
        print("       [DRY RUN] Skipping clone")
    else:
        clone_path = clone_repo(repo_path)

    print("[3/6] Sending to LLM for analysis...")
    client = httpx.Client()
    user_prompt = build_user_prompt(files, tree, focus)

    try:
        llm_output = send_to_llm(client, GEX_SYSTEM_PROMPT, user_prompt)
    except httpx.HTTPStatusError as e:
        print(f"[!] LLM request failed: {e.response.status_code}")
        print(f"    {e.response.text[:200]}")
        sys.exit(1)

    print("[4/6] Parsing surgical blocks...")
    blocks = parse_surgical_blocks(llm_output)
    print(f"       Found {len(blocks)} surgical block(s)")

    if not blocks:
        print("       No surgical edits produced — code may already be correct.")
        print("       LLM response saved to report.")

    results = []
    if blocks and not dry_run:
        print("[5/6] Applying patches to clone...")
        results = apply_blocks_to_clone(clone_path, blocks)
    elif dry_run:
        print("[5/6] [DRY RUN] Would apply these patches:")
        for b in blocks:
            if b["action"] == "write":
                print(f"       WRITE  {b['path']}  ({len(b['content'])} chars)")
            elif b["action"] == "patch":
                print(f"       PATCH  {b['path']}  ({len(b['operations'])} ops)")
            results.append({"path": b["path"], "action": b["action"].upper(), "status": "dry_run", "detail": "not applied"})
    else:
        print("[5/6] No patches to apply.")

    print("[6/6] Generating report & workspace...")
    repo_name = Path(repo_path).resolve().name
    report = build_summary_report(repo_name, files, blocks, results, llm_output, clone_path or repo_path, focus)

    report_dir = Path(repo_path) / "reports"
    report_dir.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = report_dir / f"gex_{repo_name}_{timestamp}.md"
    report_path.write_text(report)
    print(f"       Report saved: {report_path}")

    ws_name = f"Gex: {repo_name} ({datetime.now().strftime('%m/%d %H:%M')})"
    ws_result = create_workspace(client, ws_name)
    if ws_result:
        ws_id = ws_result.get("id", ws_result.get("workspace", {}).get("id", ""))
        if ws_id:
            store_in_workspace(client, ws_id, report)
            print(f"       Workspace: {ws_name}")
            print(f"       Workspace ID: {ws_id}")
        else:
            print("[!] Workspace created but no ID returned")
    else:
        print("       [!] Workspace creation failed — report saved locally only")

    client.close()

    applied = [r for r in results if r["status"] == "applied"]
    print(f"\n{'='*60}")
    print(f"  Gex surgery complete!")
    print(f"  Report:  {report_path}")
    if clone_path:
        print(f"  Clone:   {clone_path}")
    print(f"  Patches: {len(applied)} applied, {len(results) - len(applied)} skipped/errors")
    print(f"{'='*60}\n")

    return str(report_path)


SWEEP_FILE_PRIORITY = {
    "main": 1, "app": 1, "index": 1, "server": 1, "manage": 1,
    "route": 2, "router": 2, "api": 2, "view": 2, "endpoint": 2, "handler": 2,
    "service": 3, "controller": 3, "middleware": 3, "auth": 3,
    "model": 4, "schema": 4, "migration": 4, "db": 4, "database": 4,
    "util": 5, "helper": 5, "lib": 5, "common": 5, "config": 5,
    "component": 6, "page": 6, "layout": 6, "template": 6,
    "test": 8, "spec": 8,
}

SWEEP_MAX_FILE_CHARS = 30_000
SWEEP_CHUNK_LINES = 400


def _prioritize_files(files: list[dict]) -> list[dict]:
    def score(f):
        name = Path(f["path"]).stem.lower()
        for keyword, pri in SWEEP_FILE_PRIORITY.items():
            if keyword in name:
                return pri
        return 7
    return sorted(files, key=score)


def _chunk_file(f: dict) -> list[dict]:
    content = f.get("content", "")
    if len(content) <= SWEEP_MAX_FILE_CHARS:
        return [f]

    lines = content.split("\n")
    chunks = []
    for start in range(0, len(lines), SWEEP_CHUNK_LINES):
        end = min(start + SWEEP_CHUNK_LINES, len(lines))
        chunk_content = "\n".join(lines[start:end])
        chunk_lines = end - start
        label = f"{f['path']} [lines {start+1}-{end}]"
        chunks.append({
            "path": f["path"],
            "chunk_label": label,
            "size": len(chunk_content),
            "content": chunk_content,
            "lines": chunk_lines,
            "chunk_start": start + 1,
            "chunk_end": end,
        })
    return chunks


SWEEP_SYSTEM_PROMPT = """You are Gex, an expert code surgeon performing a sweep — fixing one file at a time across an entire codebase.

You are given:
1. The full file tree (read-only context, so you understand the project)
2. A single target file to fix (with line numbers)

Focus ONLY on the target file. Do not suggest changes to other files.

You MUST use these exact block formats for ALL code changes:

## <<<WRITE:path/to/file>>>
Use for FULL rewrites (>50% of file changes). Write the complete file content.
```
<<<WRITE:src/utils/helper.py>>>
def helper():
    return "fixed"
<<<END>>>
```

## <<<PATCH:path/to/file>>>
Use for TARGETED edits (1-30 lines changing). JSON array of operations:
```
<<<PATCH:src/auth.py>>>
[
  {"action": "replace", "start_line": 15, "end_line": 20, "content": "    return validate(token)"},
  {"action": "insert", "start_line": 5, "content": "import hashlib"},
  {"action": "delete", "start_line": 42, "end_line": 45}
]
<<<END>>>
```

### Rules:
1. Reference EXACT line numbers from the numbered source
2. Keep patches minimal — only fix what's broken
3. Never use placeholders like "// rest of code here"
4. If the file looks clean, say "No issues found" and skip the blocks
5. End with a brief ## Summary"""


def run_sweep(repo_path: str, focus: str = None, dry_run: bool = False):
    import time as _time

    print(f"\n{'='*60}")
    print(f"  Gex — Sweep Mode (Codebase Roomba)")
    print(f"  Repo:  {repo_path}")
    print(f"  Model: {PROVIDER}/{MODEL}")
    if focus:
        print(f"  Focus: {focus}")
    if dry_run:
        print(f"  Mode:  DRY RUN")
    print(f"{'='*60}\n")

    if not API_KEY:
        print("[!] AIAS_API_KEY not set.")
        sys.exit(1)

    print("[1/5] Scanning codebase...")
    all_files = scan_tree(repo_path)
    print(f"       Found {len(all_files)} source file(s)")
    if not all_files:
        print("[!] No source files found.")
        sys.exit(1)

    tree = build_tree_summary(all_files)
    prioritized = _prioritize_files(all_files)

    print("[2/5] Cloning repository...")
    if dry_run:
        clone_path = None
        print("       [DRY RUN] Skipping clone")
    else:
        clone_path = clone_repo(repo_path)

    client = httpx.Client()
    all_results = []
    all_llm_outputs = []
    files_fixed = 0
    files_clean = 0
    files_errored = 0
    total_start = _time.time()

    print(f"[3/5] Sweeping {len(prioritized)} files...\n")

    for idx, f in enumerate(prioritized, 1):
        filepath = f["path"]
        file_lines = f.get("lines", "?")
        print(f"  [{idx}/{len(prioritized)}] {filepath} ({file_lines} lines)")

        chunks = _chunk_file(f)
        file_had_patches = False

        for chunk in chunks:
            chunk_label = chunk.get("chunk_label", filepath)
            if len(chunks) > 1:
                print(f"           chunk: lines {chunk.get('chunk_start')}-{chunk.get('chunk_end')}")

            numbered = "\n".join(
                f"{i+1:>4}| {line}"
                for i, line in enumerate(chunk["content"].split("\n"))
            )
            if chunk.get("chunk_start", 1) > 1:
                numbered = "\n".join(
                    f"{chunk['chunk_start']+i:>4}| {line}"
                    for i, line in enumerate(chunk["content"].split("\n"))
                )

            focus_block = f"\n\n**Sweep focus**: {focus}" if focus else ""
            user_msg = f"""## Project File Tree
{tree}

## Target File: {chunk_label}
```
{numbered}
```
{focus_block}

Fix any issues in this file. Be precise with line numbers. If the file is clean, say "No issues found."
"""

            try:
                llm_output = send_to_llm(client, SWEEP_SYSTEM_PROMPT, user_msg)
                all_llm_outputs.append(f"### {chunk_label}\n\n{llm_output}")
            except httpx.HTTPStatusError as e:
                print(f"           [ERROR] LLM failed: {e.response.status_code}")
                files_errored += 1
                all_llm_outputs.append(f"### {chunk_label}\n\n[ERROR: {e.response.status_code}]")
                continue
            except Exception as e:
                print(f"           [ERROR] {e}")
                files_errored += 1
                continue

            blocks = parse_surgical_blocks(llm_output)

            if not blocks:
                if not file_had_patches:
                    print(f"           clean")
                continue

            file_had_patches = True

            if dry_run:
                for b in blocks:
                    action = b["action"].upper()
                    detail = f"{len(b.get('content', ''))} chars" if b["action"] == "write" else f"{len(b.get('operations', []))} ops"
                    print(f"           {action}  {b['path']}  ({detail})")
                    all_results.append({"path": b["path"], "action": action, "status": "dry_run", "detail": detail})
            elif clone_path:
                results = apply_blocks_to_clone(clone_path, blocks)
                for r in results:
                    print(f"           {r['action']}  {r['status']}  {r['detail']}")
                all_results.extend(results)

        if file_had_patches:
            files_fixed += 1
        elif not file_had_patches and filepath not in [r["path"] for r in all_results if r.get("status") == "error"]:
            files_clean += 1

    elapsed = _time.time() - total_start

    print(f"\n[4/5] Generating sweep report...")
    repo_name = Path(repo_path).resolve().name
    applied = [r for r in all_results if r["status"] == "applied"]

    changes_detail = ""
    for r in all_results:
        icon = "+" if r["status"] == "applied" else "!" if r["status"] == "error" else "~"
        changes_detail += f"  [{icon}] {r['action']:5}  {r['path']}  — {r['detail']}\n"

    llm_combined = "\n\n---\n\n".join(all_llm_outputs)

    report = f"""# Gex Sweep Report
**Repo**: `{repo_name}`
{f'**Clone**: `{Path(clone_path).name}/`' if clone_path else ''}
**Date**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
**Model**: `{PROVIDER}/{MODEL}`
**Duration**: {elapsed:.1f}s
{f'**Focus**: {focus}' if focus else ''}

## Stats
| Metric | Count |
|--------|-------|
| Files scanned | {len(all_files)} |
| Files fixed | {files_fixed} |
| Files clean | {files_clean} |
| Files errored | {files_errored} |
| Patches applied | {len(applied)} |
| Total patches | {len(all_results)} |

---

## Changes

{changes_detail if changes_detail else '  (no changes)'}

---

## Per-File Analysis

{llm_combined}

---
*Generated by Gex Sweep — AI Codebase Roomba*
"""

    report_dir = Path(repo_path) / "reports"
    report_dir.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = report_dir / f"gex_sweep_{repo_name}_{timestamp}.md"
    report_path.write_text(report)
    print(f"       Report saved: {report_path}")

    print("[5/5] Uploading to workspace...")
    ws_name = f"Gex Sweep: {repo_name} ({datetime.now().strftime('%m/%d %H:%M')})"
    ws_result = create_workspace(client, ws_name)
    if ws_result:
        ws_id = ws_result.get("id", ws_result.get("workspace", {}).get("id", ""))
        if ws_id:
            store_in_workspace(client, ws_id, report)
            print(f"       Workspace: {ws_name}")
            print(f"       Workspace ID: {ws_id}")
        else:
            print("[!] Workspace created but no ID returned")
    else:
        print("       [!] Workspace upload failed — report saved locally")

    client.close()

    print(f"\n{'='*60}")
    print(f"  Gex Sweep Complete!")
    print(f"  Duration:  {elapsed:.1f}s")
    print(f"  Files:     {files_fixed} fixed, {files_clean} clean, {files_errored} errors")
    print(f"  Patches:   {len(applied)} applied, {len(all_results) - len(applied)} skipped")
    print(f"  Report:    {report_path}")
    if clone_path:
        print(f"  Clone:     {clone_path}")
    print(f"{'='*60}\n")

    return str(report_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Gex — AI Code Surgeon")
    parser.add_argument("--scan", type=str, help="Path to repo/directory to scan (single-file or multi-file)")
    parser.add_argument("--sweep", type=str, help="Sweep an entire repo file-by-file (Roomba mode)")
    parser.add_argument("--file", type=str, help="Focus on a specific file path (use with --scan)")
    parser.add_argument("--focus", type=str, help="Focus area (e.g. 'security', 'error handling', 'performance')")
    parser.add_argument("--model", type=str, help="LLM model (e.g. gpt-5.4, moonshotai/kimi-k2-instruct)")
    parser.add_argument("--provider", type=str, help="LLM provider (groq, openai, anthropic, gemini, mistral)")
    parser.add_argument("--dry-run", action="store_true", help="Analyze and show patches without applying")

    args = parser.parse_args()

    if args.model:
        MODEL = args.model
    if args.provider:
        PROVIDER = args.provider
        if PROVIDER:
            auth_headers["X-AiAssist-Provider"] = PROVIDER
        elif "X-AiAssist-Provider" in auth_headers:
            del auth_headers["X-AiAssist-Provider"]

    if args.sweep:
        run_sweep(args.sweep, focus=args.focus, dry_run=args.dry_run)
    elif args.scan:
        run_gex(args.scan, focus=args.focus, focus_file=args.file, dry_run=args.dry_run)
    else:
        parser.print_help()
