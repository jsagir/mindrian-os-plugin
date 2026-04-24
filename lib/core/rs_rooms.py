#!/usr/bin/env python3
"""
rs_rooms.py -- Multi-room artifact loader for the Reverse Salient Engine
==============================================================================

Plan 89-04 Mode A extension: load artifacts from N user rooms simultaneously
and tag every artifact with its source room_id so the engine can filter
pairs to cross-room bridges only. Rediscovers the Yissum x CU x Hopkins
connections the user found manually.

Design notes:
  - Room artifacts live on the filesystem (room/section/artifact.md), NOT in
    a SQLite `artifacts` table. The Phase 89 baseline (Plan 89-01, scripts/
    rs-engine.py:discover_artifacts) walks the filesystem because
    lib/core/lazygraph-ops.cjs has no such table. This module follows that
    same pattern per-room and aggregates into one flat corpus.
  - global_id = "{room_id}::{artifact_id}" guarantees uniqueness across
    rooms even when two rooms name their artifacts identically. This is the
    plan's explicit risk-mitigation.
  - Missing/unreadable rooms are skipped with a stderr warning; the engine
    continues with whatever rooms successfully loaded. Mode B/C and Mode A
    single-room require artifacts; cross-room requires >= 2 rooms actually
    contributing artifacts for any cross-room pair to exist.

Authoritative source invariants preserved:
  - Empty body filter (>= 50 chars of real content, matching discover_artifacts).
  - Skip dirs (.git, .lazygraph, .mindrian, node_modules, .obsidian).
  - Skip files (STATE.md, ROOM.md, MINTO.md -- metadata, not venture content).
  - Section = first-segment of relative path (same as discover_artifacts).

License: BSL-1.1 (see LICENSE at repo root).
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Dict, List, Sequence


# --- Constants (kept in sync with scripts/rs-engine.py discover_artifacts) ---

SKIP_FILES = {"STATE.md", "ROOM.md", "MINTO.md"}
SKIP_DIRS = {".lazygraph", ".git", ".mindrian", "node_modules", ".obsidian"}
MIN_BODY_CHARS = 50


# --- Helpers (minimal local copies so rs_rooms does not import from scripts/) -

def _extract_title(content: str, filepath: Path) -> str:
    match = re.search(r"^# (.+)$", content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return filepath.stem.replace("-", " ").title()


def _extract_body(content: str) -> str:
    fm_match = re.match(r"^---\n[\s\S]*?\n---\n?", content)
    if fm_match:
        return content[fm_match.end():]
    return content


# --- Public API -------------------------------------------------------------

def load_multi_room_corpus(room_paths: Sequence[str]) -> List[Dict]:
    """Load artifacts from N rooms, tagging each with its source room_id.

    Args:
      room_paths: list of filesystem paths, each pointing to one room root.
        Room root = the directory that contains section subdirectories
        (e.g. `~/rooms/yissum-deeptech`, not `~/rooms/yissum-deeptech/room`).

    Returns:
      Flat list of artifact dicts. Each artifact carries:
        - global_id      : f"{room_id}::{artifact_id}" (unique across corpus)
        - room_id        : basename of the room path (e.g. "yissum-deeptech")
        - artifact_id    : per-room id (section/stem), same shape as 89-01
        - section        : first path segment under the room root
        - title          : H1 header or humanized filename
        - text           : body text (post-frontmatter strip)
        - path           : absolute filesystem path to the source .md
        - source_room_path: absolute path to the room root (debugging)

    Behavior:
      - Missing rooms (no directory) print a stderr note and are skipped.
        Not fatal: the engine may still have enough artifacts from other rooms.
      - Rooms with zero usable artifacts (empty sections, files < 50 chars)
        are silently skipped.
      - Artifact order is deterministic: rooms in input order, files sorted
        by filesystem walk. This matters because index-based pair lookups
        in rs-engine.py assume the artifact list is stable across runs.
    """
    corpus: List[Dict] = []
    seen_room_ids: Dict[str, int] = {}

    for rp in room_paths:
        room_path = Path(rp).resolve()
        if not room_path.exists():
            print(
                f"[rs-rooms] Skip {rp}: path does not exist",
                file=sys.stderr,
            )
            continue
        if not room_path.is_dir():
            print(
                f"[rs-rooms] Skip {rp}: not a directory",
                file=sys.stderr,
            )
            continue

        room_id = room_path.name
        # Disambiguate if two different paths share a basename. The second
        # occurrence gets a suffix so global_id uniqueness survives.
        seen_count = seen_room_ids.get(room_id, 0)
        if seen_count > 0:
            room_id = f"{room_id}-{seen_count + 1}"
        seen_room_ids[room_path.name] = seen_count + 1

        room_contribution = _load_single_room(room_path, room_id)
        if not room_contribution:
            print(
                f"[rs-rooms] Skip {rp}: no usable artifacts (>= {MIN_BODY_CHARS} chars)",
                file=sys.stderr,
            )
            continue
        corpus.extend(room_contribution)

    return corpus


def _load_single_room(room_path: Path, room_id: str) -> List[Dict]:
    """Walk one room and return artifact dicts tagged with room_id."""
    artifacts: List[Dict] = []
    for root, dirs, files in os.walk(room_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        rel_root = Path(root).relative_to(room_path)
        if str(rel_root) == ".":
            # Skip room-root files -- not part of any section.
            continue
        section = str(rel_root).split(os.sep)[0]
        for fname in sorted(files):
            if not fname.endswith(".md"):
                continue
            if fname in SKIP_FILES:
                continue
            fpath = Path(root) / fname
            try:
                content = fpath.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            body = _extract_body(content).strip()
            if len(body) < MIN_BODY_CHARS:
                continue
            artifact_id = str(rel_root / Path(fname).stem).replace(os.sep, "/")
            global_id = f"{room_id}::{artifact_id}"
            artifacts.append({
                "global_id": global_id,
                "room_id": room_id,
                "artifact_id": artifact_id,
                "section": section,
                "title": _extract_title(content, fpath),
                "text": body,
                "path": str(fpath),
                "source_room_path": str(room_path),
            })
    return artifacts


def summarize_corpus(corpus: Sequence[Dict]) -> Dict[str, int]:
    """Return {room_id: artifact_count} for a loaded corpus.

    Used by the engine to warn when a single room dominates the corpus
    (>= 95% share would skew LSA toward that room's vocabulary and make
    cross-room pair discovery unreliable). The 5% warning threshold is
    documented in the plan's Risks section.
    """
    counts: Dict[str, int] = {}
    for art in corpus:
        rid = art.get("room_id") or "unknown"
        counts[rid] = counts.get(rid, 0) + 1
    return counts


__all__ = [
    "load_multi_room_corpus",
    "summarize_corpus",
    "MIN_BODY_CHARS",
    "SKIP_FILES",
    "SKIP_DIRS",
]
