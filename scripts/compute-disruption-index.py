#!/usr/bin/env python3
"""
compute-disruption-index.py -- CD Index: Consolidating vs Disrupting per Artifact
==================================================================================
Inspired by Funk & Owen-Smith (2017). Measures whether each artifact introduces
new concepts (disruptive) or references existing vocabulary (consolidating).
Artifacts are processed in chronological order (file modification time).

Usage:
    python3 scripts/compute-disruption-index.py /path/to/room [--output PATH]

Output:
    {room_dir}/.mindrian/disruption-index.json

No embedding dependency -- reads room artifacts directly.
"""

import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path


# --- Constants (same as compute-hsi.py) ---

SKIP_FILES = {"STATE.md", "ROOM.md", "MINTO.md", "WHITESPACE.md"}
SKIP_DIRS = {".lazygraph", ".git", "node_modules", ".mindrian"}


# --- Helper functions ---


def extract_body(content):
    """Extract body text after frontmatter --- block."""
    fm_match = re.match(r"^---\n[\s\S]*?\n---\n?", content)
    if fm_match:
        return content[fm_match.end():]
    return content


def extract_concepts(text):
    """Extract unigram concepts from text."""
    return set(re.findall(r'\b[a-z][a-z-]+[a-z]\b', text.lower()))


def discover_artifacts(room_dir):
    """Walk room_dir for .md files, return list with modification times."""
    artifacts = []
    room_path = Path(room_dir).resolve()

    for root, dirs, files in os.walk(room_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        rel_root = Path(root).relative_to(room_path)
        if str(rel_root) == ".":
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

            body = extract_body(content)
            if len(body.strip()) < 50:
                continue

            artifact_id = str(Path(rel_root) / Path(fname).stem).replace(os.sep, "/")
            mtime = fpath.stat().st_mtime

            artifacts.append({
                "id": artifact_id,
                "section": section,
                "path": str(fpath.relative_to(room_path)),
                "text": body.strip(),
                "mtime": mtime,
            })

    return artifacts


def main():
    parser = argparse.ArgumentParser(
        description="CD index: consolidating vs disrupting per artifact (Funk & Owen-Smith 2017)"
    )
    parser.add_argument("room_dir", help="Path to room directory")
    parser.add_argument(
        "--output",
        default=None,
        help="Output JSON path (default: {room_dir}/.mindrian/disruption-index.json)",
    )

    args = parser.parse_args()
    room_dir = Path(args.room_dir).resolve()

    if not room_dir.is_dir():
        print(f"Error: {room_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    if args.output:
        output_path = Path(args.output).resolve()
    else:
        output_path = room_dir / ".mindrian" / "disruption-index.json"

    # Discover and sort artifacts by modification time (oldest first)
    artifacts = discover_artifacts(room_dir)
    artifacts.sort(key=lambda a: a["mtime"])

    if len(artifacts) < 1:
        result = {
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "artifact_count": 0,
                "room_cd": None,
                "note": "no artifacts found",
            },
            "artifacts": [],
        }
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
        print("Disruption: no artifacts found, wrote empty results", file=sys.stderr)
        sys.exit(0)

    # Build cumulative vocabulary and compute CD index
    cumulative_vocab = set()
    artifact_results = []

    for art in artifacts:
        concepts = extract_concepts(art["text"])

        new_concepts = concepts - cumulative_vocab
        referenced_concepts = concepts & cumulative_vocab

        n_new = len(new_concepts)
        n_ref = len(referenced_concepts)
        total = n_new + n_ref

        if total == 0:
            cd_index = 0.0
        else:
            cd_index = (n_new - n_ref) / total

        # Classification
        if cd_index > 0.2:
            classification = "disruptive"
        elif cd_index < -0.2:
            classification = "consolidating"
        else:
            classification = "balanced"

        artifact_results.append({
            "artifact_id": art["id"],
            "section": art["section"],
            "cd_index": round(cd_index, 4),
            "classification": classification,
            "new_concepts": n_new,
            "referenced_concepts": n_ref,
            "total_concepts": len(concepts),
        })

        # Add this artifact's concepts to cumulative vocabulary
        cumulative_vocab.update(concepts)

    # Room-level CD = mean across artifacts
    cd_values = [a["cd_index"] for a in artifact_results]
    room_cd = round(sum(cd_values) / len(cd_values), 4) if cd_values else None

    # Count classifications
    disruptive_count = sum(1 for a in artifact_results if a["classification"] == "disruptive")
    consolidating_count = sum(1 for a in artifact_results if a["classification"] == "consolidating")
    balanced_count = sum(1 for a in artifact_results if a["classification"] == "balanced")

    result = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "room_dir": str(room_dir),
            "artifact_count": len(artifacts),
            "room_cd": room_cd,
            "cumulative_vocabulary_size": len(cumulative_vocab),
            "classification_counts": {
                "disruptive": disruptive_count,
                "consolidating": consolidating_count,
                "balanced": balanced_count,
            },
        },
        "artifacts": artifact_results,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    print(
        f"Disruption: {len(artifacts)} artifacts, room CD={room_cd}, "
        f"D={disruptive_count}/C={consolidating_count}/B={balanced_count} -> {output_path}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
