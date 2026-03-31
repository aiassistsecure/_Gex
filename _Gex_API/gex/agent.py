import json
import logging
from pathlib import Path
from typing import AsyncGenerator

import httpx

AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file in the project. Use this to examine code before making edits.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path to the file from project root (e.g., 'src/main.py')"
                    }
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_files",
            "description": "Search for a pattern in all files. Returns matching file paths and line snippets.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {
                        "type": "string",
                        "description": "Text pattern to search for (case-insensitive)"
                    },
                    "file_extension": {
                        "type": "string",
                        "description": "Optional: limit to files with this extension (e.g., '.py', '.js')"
                    }
                },
                "required": ["pattern"]
            }
        }
    }
]

def execute_read_file(repo_path: str, file_path: str) -> str:
    try:
        p = Path(repo_path) / file_path
        if not p.resolve().is_relative_to(Path(repo_path).resolve()):
            return f"Error: Access denied to {file_path}"
        if not p.exists() or not p.is_file():
            return f"Error: File not found: {file_path}"
        
        content = p.read_text(encoding="utf-8", errors="replace")
        lines = content.splitlines()
        numbered = "\n".join(f"{i+1:4d}| {line}" for i, line in enumerate(lines))
        return f"File: {file_path}\n```\n{numbered}\n```"
    except Exception as e:
        return f"Error reading file {file_path}: {e}"

def execute_search_files(repo_path: str, pattern: str, file_extension: str = None) -> str:
    try:
        results = []
        pattern_lower = pattern.lower()
        root = Path(repo_path).resolve()
        
        for p in root.rglob("*"):
            if not p.is_file(): continue
            # Skip hidden dirs and common ignores
            if any(part.startswith(".") for part in p.relative_to(root).parts): continue
            if any(ignore in p.parts for ignore in ["node_modules", "__pycache__", "build", "dist", "target"]): continue
            
            if file_extension and not p.name.endswith(file_extension):
                continue
                
            try:
                content = p.read_text(encoding="utf-8", errors="ignore")
                lines = content.splitlines()
                matches = []
                for i, line in enumerate(lines):
                    if pattern_lower in line.lower():
                        matches.append(f"L{i+1}: {line.strip()[:120]}")
                        if len(matches) >= 10: break
                if matches:
                    rel_path = p.relative_to(root).as_posix()
                    results.append(f"{rel_path}:\n" + "\n".join(matches))
            except:
                pass
            if len(results) >= 20: break
            
        if not results:
            return f"No matches found for '{pattern}'" + (f" in {file_extension} files" if file_extension else "")
        return f"Found matches in {len(results)} files:\n\n" + "\n\n".join(results)
    except Exception as e:
        return f"Error searching files: {e}"

def execute_tool(repo_path: str, tool_name: str, args: dict) -> str:
    if tool_name == "read_file":
        return execute_read_file(repo_path, args.get("path"))
    elif tool_name == "search_files":
        return execute_search_files(repo_path, args.get("pattern"), args.get("file_extension"))
    return f"Error: Unknown tool {tool_name}"
