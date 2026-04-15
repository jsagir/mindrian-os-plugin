#!/usr/bin/env python3
"""
sealed-walker.py -- GUARDRAIL.md parser for session-start sealed-room walker.

Extracted from scripts/session-start in plan 85-01 so the bash driver
stays free of `python3 -c` invocations (plan 85-01 verification gate)
and this parser can be unit-tested independently.

Reads NUL-delimited GUARDRAIL.md paths from stdin, parses up to 10 rooms,
emits tab-separated (name, relpath, rules) lines on stdout.

Gated on python3 availability in session-start: if python3 is not
available (Windows without real python3), the walker is a no-op and
session-start continues without sealed-room context. Plan 85-06 will
replace this with a node-native walker.
"""

import os
import re
import sys


def parse_guardrail(path):
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            raw_lines = f.readlines()
    except Exception:
        return ""
    # Cap scan to first 200 lines defensively.
    lines = raw_lines[:200]
    # Strip YAML frontmatter if present at top.
    if lines and lines[0].strip() == "---":
        end = None
        for i in range(1, len(lines)):
            if lines[i].strip() == "---":
                end = i
                break
        if end is not None:
            lines = lines[end + 1:]
    # Strip leading h1 title (first non-blank line if it starts with "# ").
    idx = 0
    while idx < len(lines) and lines[idx].strip() == "":
        idx += 1
    if idx < len(lines) and lines[idx].lstrip().startswith("# "):
        lines = lines[idx + 1:]
    # Scan first 30 lines of remaining content, skipping code fences,
    # collect first 3 non-blank prose lines.
    window = lines[:30]
    in_fence = False
    prose = []
    for ln in window:
        stripped = ln.strip()
        if stripped.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if not stripped:
            continue
        clean = stripped.replace("`", "")
        clean = re.sub(r"\s+", " ", clean).strip()
        clean = clean.replace("|", " ")
        clean = re.sub(r"\s+", " ", clean).strip()
        if clean:
            prose.append(clean[:240])
        if len(prose) >= 3:
            break
    return " | ".join(prose)


def main():
    data = sys.stdin.buffer.read()
    paths = [p.decode("utf-8", "replace") for p in data.split(b"\x00") if p]

    root = os.environ.get("SEALED_ROOMS_ROOT", "")
    results = []
    for p in paths:
        room_dir = os.path.dirname(p)
        name = os.path.basename(room_dir)
        if not name or name.startswith("."):
            continue
        rel = os.path.relpath(room_dir, root) if root else room_dir
        rules = parse_guardrail(p)
        results.append((name, rel, rules))

    results.sort(key=lambda r: r[0].lower())
    total = len(results)
    capped = results[:10]
    for name, rel, rules in capped:
        print(f"{name}\t{rel}\t{rules}")
    if total > 10:
        print(f"__MORE__\t{total - 10}\t")


if __name__ == "__main__":
    main()
