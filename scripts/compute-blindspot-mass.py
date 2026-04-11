#!/usr/bin/env python3
"""
compute-blindspot-mass.py -- Good-Turing Coverage Estimation per Room Section
==============================================================================
Estimates concept coverage per section using Good-Turing frequency estimation.
Sections with many singleton concepts (appearing exactly once) have lower
coverage -- indicating potential blindspots in understanding.

Usage:
    python3 scripts/compute-blindspot-mass.py /path/to/room [--output PATH]

Output:
    {room_dir}/.mindrian/blindspot-coverage.json
"""

import argparse
import json
import os
import re
import sys
from collections import Counter
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
    """Extract unigram and bigram concepts from text.

    Unigrams: lowercase words matching [a-z][a-z-]+[a-z]
    Bigrams: consecutive unigram pairs joined by space.
    """
    unigrams = re.findall(r'\b[a-z][a-z-]+[a-z]\b', text.lower())
    bigrams = [f"{unigrams[i]} {unigrams[i+1]}" for i in range(len(unigrams) - 1)]
    return unigrams + bigrams


def good_turing_coverage(concepts):
    """Compute Good-Turing coverage estimate.

    coverage = 1.0 - (singletons / total_occurrences)
    where singletons = concepts appearing exactly once.
    """
    if not concepts:
        return 0.0

    freq = Counter(concepts)
    total = sum(freq.values())
    singletons = sum(1 for count in freq.values() if count == 1)

    if total == 0:
        return 0.0

    return 1.0 - (singletons / total)


def discover_artifacts(room_dir):
    """Walk room_dir for .md files, group by section (parent dir)."""
    sections = {}
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

            if section not in sections:
                sections[section] = []
            sections[section].append({
                "id": artifact_id,
                "path": str(fpath.relative_to(room_path)),
                "text": body.strip(),
            })

    return sections


def main():
    parser = argparse.ArgumentParser(
        description="Good-Turing coverage estimation per room section"
    )
    parser.add_argument("room_dir", help="Path to room directory")
    parser.add_argument(
        "--output",
        default=None,
        help="Output JSON path (default: {room_dir}/.mindrian/blindspot-coverage.json)",
    )

    args = parser.parse_args()
    room_dir = Path(args.room_dir).resolve()

    if not room_dir.is_dir():
        print(f"Error: {room_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    if args.output:
        output_path = Path(args.output).resolve()
    else:
        output_path = room_dir / ".mindrian" / "blindspot-coverage.json"

    # Discover artifacts grouped by section
    sections = discover_artifacts(room_dir)

    # Compute coverage per section
    section_results = []
    total_weighted_coverage = 0.0
    total_weight = 0

    for section_name, artifacts in sorted(sections.items()):
        if len(artifacts) < 3:
            section_results.append({
                "section": section_name,
                "artifact_count": len(artifacts),
                "coverage": None,
                "note": "skipped: fewer than 3 artifacts",
            })
            continue

        # Pool all concepts from section artifacts
        all_concepts = []
        for art in artifacts:
            all_concepts.extend(extract_concepts(art["text"]))

        coverage = good_turing_coverage(all_concepts)
        freq = Counter(all_concepts)
        singletons = sum(1 for c in freq.values() if c == 1)

        section_results.append({
            "section": section_name,
            "artifact_count": len(artifacts),
            "coverage": round(coverage, 4),
            "total_concepts": len(all_concepts),
            "unique_concepts": len(freq),
            "singletons": singletons,
        })

        total_weighted_coverage += coverage * len(artifacts)
        total_weight += len(artifacts)

    # Room-level weighted average
    room_coverage = (
        round(total_weighted_coverage / total_weight, 4)
        if total_weight > 0
        else None
    )

    total_artifacts = sum(len(a) for a in sections.values())

    result = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "room_dir": str(room_dir),
            "total_sections": len(sections),
            "total_artifacts": total_artifacts,
            "room_coverage": room_coverage,
        },
        "sections": section_results,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    print(
        f"Blindspot: {total_artifacts} artifacts across {len(sections)} sections, "
        f"room coverage={room_coverage} -> {output_path}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
