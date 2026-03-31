"""
Gex Diff Engine — Structured hunk-level diff computation.
Uses Python's difflib to produce per-hunk diffs with line-level alignment.
"""
from __future__ import annotations
import difflib
from .types import DiffHunk, FileDiff


class DiffEngine:
    """Computes structured diffs between before/after file content."""

    def compute(self, before: str, after: str, filepath: str) -> FileDiff:
        """
        Compute a structured diff with hunks.
        Returns a FileDiff with line-level change information.
        """
        before_lines = before.splitlines(keepends=True)
        after_lines = after.splitlines(keepends=True)

        hunks = self._extract_hunks(before_lines, after_lines)

        total_additions = sum(len(h.after_lines) for h in hunks if h.type in ("addition", "modification"))
        total_deletions = sum(len(h.before_lines) for h in hunks if h.type in ("deletion", "modification"))

        return FileDiff(
            file=filepath,
            hunks=hunks,
            before=before,
            after=after,
            total_additions=total_additions,
            total_deletions=total_deletions,
        )

    def _extract_hunks(
        self, before_lines: list[str], after_lines: list[str]
    ) -> list[DiffHunk]:
        """Extract change hunks from two sets of lines using SequenceMatcher."""
        matcher = difflib.SequenceMatcher(None, before_lines, after_lines)
        hunks: list[DiffHunk] = []

        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == "equal":
                continue

            before_block = [line.rstrip("\n\r") for line in before_lines[i1:i2]]
            after_block = [line.rstrip("\n\r") for line in after_lines[j1:j2]]

            if tag == "replace":
                hunk_type = "modification"
            elif tag == "insert":
                hunk_type = "addition"
            elif tag == "delete":
                hunk_type = "deletion"
            else:
                continue

            hunks.append(DiffHunk(
                start=i1 + 1,  # 1-indexed
                end=max(i2, j2),
                before_lines=before_block,
                after_lines=after_block,
                type=hunk_type,
            ))

        return hunks

    def compute_unified_diff(
        self, before: str, after: str, filepath: str
    ) -> str:
        """Generate a unified diff string (for display/logging)."""
        before_lines = before.splitlines(keepends=True)
        after_lines = after.splitlines(keepends=True)

        diff = difflib.unified_diff(
            before_lines,
            after_lines,
            fromfile=f"a/{filepath}",
            tofile=f"b/{filepath}",
            lineterm="",
        )
        return "".join(diff)
