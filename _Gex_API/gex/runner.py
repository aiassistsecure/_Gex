"""
Gex Runner — The async engine that orchestrates code surgery.
Handles single-file and full-repo runs with streaming support.
"""
from __future__ import annotations
import shutil
import uuid
import json
from pathlib import Path
from datetime import datetime
from typing import AsyncGenerator, Optional

import httpx

from .types import (
    GexConfig, ScannedFile, FileResult, FileDiff,
    RunState, ApplyResult, SurgicalBlock,
)
from .scanner import GexScanner
from .diff import DiffEngine
from .patch import PatchEngine


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
7. NEVER output raw python/javascript/markdown code blocks to present your fixes. You MUST encapsulate ALL actual changes inside <<<WRITE>>> and <<<PATCH>>> tags, or your changes will be ignored.
8. NEVER extract code into brand new files unless specifically asked. You MUST confine your patches strictly to the existing file paths provided in the File Tree.
9. CRITICAL: If you are asked to modify a system prompt or Gex code, DO NOT escape angle brackets (like <<<) in your JSON output. Our parser handles them perfectly. Provide them EXACTLY as they appear in the source.

If no fixes are needed, say so clearly and explain why the code is already correct."""


class GexRunner:
    """
    The core Gex engine. Runs AI code surgery on files and repos.
    Supports single-file and streaming full-repo modes.
    """

    def __init__(self, config: GexConfig):
        self.config = config
        self.scanner = GexScanner(config)
        self.diff_engine = DiffEngine()
        self.patch_engine = PatchEngine()
        self._runs: dict[str, RunState] = {}

    def get_auth_headers(self) -> dict:
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }
        if self.config.provider:
            headers["X-AiAssist-Provider"] = self.config.provider
        return headers

    async def send_to_llm(
        self, client: httpx.AsyncClient, system_prompt: str, user_msg: str, repo_path: str
    ) -> AsyncGenerator[str, None]:
        """Send a prompt to the LLM and yield intermediate tool usage until final output."""
        from .agent import AGENT_TOOLS, execute_tool
        
        # Determine if we should include tavily_search based on our custom search implementation, 
        # but for now we just use the 2 basic tools.
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_msg},
        ]
        
        loop_count = 0
        max_loops = 15
        
        while loop_count < max_loops:
            payload = {
                "model": self.config.model,
                "messages": messages,
                "tools": AGENT_TOOLS,
                "tool_choice": "auto",
                "temperature": 0.2,
                "max_tokens": 16384,
            }

            resp = await client.post(
                f"{self.config.api_base}/v1/chat/completions",
                json=payload,
                headers=self.get_auth_headers(),
                timeout=120,
            )
            resp.raise_for_status()
            data = resp.json()
            message = data["choices"][0]["message"]
            
            tool_calls = message.get("tool_calls", [])
            
            if not tool_calls:
                yield message.get("content", "")
                break
                
            messages.append(message)
            
            for tool_call in tool_calls:
                fn_name = tool_call["function"]["name"]
                try:
                    args = json.loads(tool_call["function"]["arguments"])
                except:
                    args = {}
                    
                # Yield intermediate status to caller
                if fn_name == "read_file":
                    yield f"[TOOL] Reading {args.get('path')}..."
                elif fn_name == "search_files":
                    yield f"[TOOL] Searching for '{args.get('pattern')}'..."
                    
                result = execute_tool(repo_path, fn_name, args)
                
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "content": result
                })
                
            loop_count += 1
            
        if loop_count >= max_loops:
            yield "LLM tool loop exceeded maximum iterations. Force stopped."

    def clone_repo(self, source: str) -> str:
        """Clone a repo to a parallel _gex directory."""
        source_path = Path(source).resolve()
        clone_path = source_path.parent / f"{source_path.name}_gex"

        if clone_path.exists():
            shutil.rmtree(clone_path)

        shutil.copytree(
            source_path,
            clone_path,
            ignore=shutil.ignore_patterns(*self.config.skip_dirs, *self.config.skip_files),
            dirs_exist_ok=False,
        )
        return str(clone_path)

    def _build_user_prompt(
        self, files: list[ScannedFile], tree: str, focus: str = None
    ) -> str:
        """Build the user prompt for LLM analysis."""
        context = self.scanner.build_context(files)
        focus_block = (
            f"\n\n**Focus area**: {focus}\nPrioritize fixes related to this area."
            if focus else ""
        )
        return f"""Analyze this code and provide surgical fixes:

## File Tree
{tree}

## Source Code (line-numbered)
{context}
{focus_block}

Provide your fixes using <<<WRITE>>> and <<<PATCH>>> blocks. Be precise with line numbers.
End with a ## Summary of all changes."""

    async def run_file(
        self,
        repo_path: str,
        file_path: str,
        focus: str = None,
        clone_path: str = None,
    ) -> FileResult:
        """
        Run Gex on a single file.
        Returns a FileResult with before/after content, structured diff, and apply results.
        """
        # Scan just this file
        files = await self.scanner.scan_tree(repo_path, focus_file=file_path)
        if not files:
            return FileResult(
                file=file_path,
                status="error",
                error=f"File not found: {file_path}",
            )

        # Clone if needed
        if not clone_path:
            clone_path = self.clone_repo(repo_path)

        # Read the original content
        scanned = files[0]
        before = scanned.content

        # Build prompt and send to LLM
        tree = self.scanner.build_tree_summary(files)
        user_prompt = self._build_user_prompt(files, tree, focus)

        async with httpx.AsyncClient() as client:
            try:
                llm_output = ""
                tool_steps = []
                async for chunk in self.send_to_llm(client, GEX_SYSTEM_PROMPT, user_prompt, repo_path):
                    if chunk.startswith("[TOOL]"):
                        tool_steps.append(chunk)
                    else:
                        llm_output += chunk + "\n"
            except httpx.HTTPStatusError as e:
                return FileResult(
                    file=file_path,
                    status="error",
                    error=f"LLM request failed: {e.response.status_code}",
                    before=before,
                )
            except Exception as e:
                return FileResult(
                    file=file_path,
                    status="error",
                    error=str(e),
                    before=before,
                )

        # Parse surgical blocks
        try:
            with open("llm_debug_dump.txt", "w", encoding="utf-8") as f:
                f.write(llm_output)
        except Exception:
            pass

        blocks = self.patch_engine.parse_surgical_blocks(llm_output)

        if not blocks:
            return FileResult(
                file=file_path,
                status="unchanged",
                before=before,
                after=before,
                llm_analysis=llm_output,
                tool_steps=tool_steps,
            )

        # Apply blocks to clone
        apply_results = self.patch_engine.apply_blocks_to_clone(clone_path, blocks)

        # Read the modified file
        clone_file = Path(clone_path) / scanned.path
        after = clone_file.read_text(errors="replace") if clone_file.exists() else before

        # Compute structured diff
        diff = self.diff_engine.compute(before, after, file_path)

        applied_count = sum(1 for r in apply_results if r.status == "applied")
        error_count = sum(1 for r in apply_results if r.status in ["error", "parse_error", "blocked", "skipped"])

        # Determine status strictly based on whether THIS file actually changed
        status = "unchanged"
        if diff.hunks:
            status = "patched"
        elif error_count > 0:
            # Only flag an error if an error occurred targeting THIS file specifically
            # to avoid false positives from the LLM hallucinating unrelated paths
            target_errors = sum(1 for r in apply_results if r.status in ["error", "parse_error", "blocked", "skipped"] and Path(r.path).name == Path(file_path).name)
            if target_errors > 0:
                status = "error"

        error_msg = None
        if status == "error":
            error_msg = next((r.detail for r in apply_results if r.status in ["error", "parse_error"] and Path(r.path).name == Path(file_path).name), "Failed to parse or apply patches.")

        return FileResult(
            file=file_path,
            before=before,
            after=after,
            diff=diff,
            status=status,
            blocks_applied=applied_count,
            error=error_msg,
            llm_analysis=llm_output,
            apply_results=apply_results,
            tool_steps=tool_steps,
        )

    async def run_repo(
        self,
        repo_path: str,
        focus: str = None,
        mode: str = "sequential",
        run_id: str = None,
    ) -> AsyncGenerator[tuple[RunState, FileResult], None]:
        """
        Run Gex on an entire repo, yielding per-file results.
        This is the STREAMING GENERATOR that powers live UI updates.
        """
        if run_id is None:
            run_id = str(uuid.uuid4())[:8]
        run_state = RunState(run_id=run_id, state="running", started_at=datetime.now())

        # Store run state
        self._runs[run_id] = run_state

        try:
            # Scan all files
            files = await self.scanner.scan_tree(repo_path)
            run_state.total_files = len(files)

            if not files:
                run_state.state = "completed"
                run_state.completed_at = datetime.now()
                return

            # Clone the repo once
            clone_path = self.clone_repo(repo_path)

            # Process each file
            for i, scanned_file in enumerate(files):
                run_state.current_file = scanned_file.path
                run_state.processed = i
                run_state.progress = i / len(files)

                try:
                    result = await self.run_file(
                        repo_path,
                        scanned_file.path,
                        focus=focus,
                        clone_path=clone_path,
                    )
                    run_state.results.append(result)
                    yield run_state, result
                except Exception as e:
                    error_result = FileResult(
                        file=scanned_file.path,
                        status="error",
                        error=str(e),
                    )
                    run_state.results.append(error_result)
                    yield run_state, error_result

            run_state.state = "completed"
            run_state.processed = len(files)
            run_state.progress = 1.0
            run_state.completed_at = datetime.now()

        except Exception as e:
            run_state.state = "failed"
            run_state.error = str(e)
            run_state.completed_at = datetime.now()

    def get_run_state(self, run_id: str) -> Optional[RunState]:
        """Get the current state of a run."""
        return self._runs.get(run_id)
