#!/usr/bin/env python3
"""
discover-rs-whitespace.py -- RS-Seeded Whitespace Detection
============================================================
After Reverse Salient detection finds bottleneck sections, this script
maps the embedding region DOWNSTREAM of each bottleneck to find what's
missing beyond it.

For each RS bottleneck:
  1. Identify target_section -- the section the bottleneck INFORMS/ENABLES
  2. Collect all room artifact embeddings from that target section
  3. Compute centroid of target section artifacts
  4. Check if Brain frameworks exist near centroid but NOT near actual
     target artifacts -- that's downstream whitespace

"The bottleneck prevents seeing what's beyond it."

Per D-04, D-05, D-06 from Phase 64 CONTEXT.

Usage:
    python3 scripts/discover-rs-whitespace.py /path/to/room [--output path]

Output:
    {room_dir}/.mindrian/discovery-rs-whitespace.json
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# --- Guarded imports ---

try:
    import numpy as np
except ImportError:
    print(
        "RS whitespace discovery requires numpy. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.neighbors import NearestNeighbors
except ImportError:
    print(
        "RS whitespace discovery requires scikit-learn. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)


# --- Embedding loading (reused from compute-whitespace-gaps.py) ---


def load_embeddings(room_dir):
    """Load Phase 60 whitespace-embeddings.json from room directory.

    Returns:
        Tuple of (embeddings_data dict, embedding_matrix np.ndarray) or
        (None, None) if file missing or empty.
    """
    ws_path = Path(room_dir) / ".mindrian" / "whitespace-embeddings.json"
    if not ws_path.exists():
        return None, None

    try:
        data = json.loads(ws_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None, None

    embeddings_list = data.get("embeddings", [])
    if not embeddings_list:
        return data, np.array([])

    vectors = np.array([e["vector"] for e in embeddings_list])
    return data, vectors


def load_baselines(room_dir):
    """Load Phase 60 brain-baseline.json from room directory.

    Returns:
        Tuple of (baseline_data dict, baseline_matrix np.ndarray) or
        (None, None) if file missing or empty.
    """
    bl_path = Path(room_dir) / ".mindrian" / "brain-baseline.json"
    if not bl_path.exists():
        return None, None

    try:
        data = json.loads(bl_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None, None

    baselines_list = data.get("baselines", [])
    if not baselines_list:
        return data, np.array([])

    vectors = np.array([b["vector"] for b in baselines_list])
    return data, vectors


def load_hsi_results(room_dir):
    """Load .hsi-results.json from room directory.

    Returns:
        dict or None if file missing.
    """
    hsi_path = Path(room_dir) / ".hsi-results.json"
    if not hsi_path.exists():
        return None

    try:
        return json.loads(hsi_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


# --- Core detection ---


def detect_rs_whitespace(room_dir):
    """Detect whitespace zones downstream of RS bottleneck sections.

    For each reverse salient:
    1. Get target_section (the downstream section)
    2. Collect all room embeddings from that section
    3. Compute section centroid
    4. Find Brain frameworks near centroid
    5. Check if those frameworks are far from actual section artifacts
    6. Gap = Brain knows about it, but room's downstream section hasn't explored it

    Args:
        room_dir: path to room directory

    Returns:
        Result dict with metadata and zones
    """
    room_path = Path(room_dir)

    # Load HSI/RS results
    hsi_data = load_hsi_results(room_path)
    if hsi_data is None:
        print(
            "No .hsi-results.json found. Run compute-hsi.py and detect-reverse-salients.py first.",
            file=sys.stderr,
        )
        return _empty_result("No .hsi-results.json found")

    reverse_salients = hsi_data.get("reverse_salients", [])
    if not reverse_salients:
        print("No reverse salients found in .hsi-results.json.", file=sys.stderr)
        return _empty_result("No reverse salients in .hsi-results.json")

    # Load embeddings
    ws_data, room_embs = load_embeddings(room_path)
    if ws_data is None or room_embs is None or len(room_embs) == 0:
        print("No whitespace embeddings found.", file=sys.stderr)
        return _empty_result("No whitespace embeddings found")

    bl_data, brain_embs = load_baselines(room_path)
    if bl_data is None or brain_embs is None or len(brain_embs) == 0:
        print("No Brain baseline embeddings found.", file=sys.stderr)
        return _empty_result("No Brain baseline embeddings found")

    # Build section -> embedding indices lookup
    embeddings_list = ws_data.get("embeddings", [])
    section_indices = {}
    for i, entry in enumerate(embeddings_list):
        section = entry.get("section", "")
        if section not in section_indices:
            section_indices[section] = []
        section_indices[section].append(i)

    # Brain framework names
    baselines_list = bl_data.get("baselines", [])
    brain_names = [b.get("name", f"brain-{i}") for i, b in enumerate(baselines_list)]

    # Fit k-NN on Brain embeddings for framework lookup
    brain_nn = NearestNeighbors(n_neighbors=min(3, len(brain_embs)), metric="cosine")
    brain_nn.fit(brain_embs)

    # Process each bottleneck
    zones = []
    zone_counter = 0
    seen_sections = set()  # Avoid duplicate zones for same target section

    for rs in reverse_salients:
        target_section = rs.get("target_section", "")
        source_section = rs.get("source_section", "")

        if not target_section:
            continue

        # Skip if we already analyzed this downstream section
        if target_section in seen_sections:
            continue
        seen_sections.add(target_section)

        # Get all room artifact indices in the target section
        target_indices = section_indices.get(target_section, [])
        if not target_indices:
            continue  # no artifacts in that section to analyze

        # Compute section centroid
        section_embs = room_embs[target_indices]
        section_centroid = np.mean(section_embs, axis=0).reshape(1, -1)

        # Find nearest Brain frameworks to section centroid
        brain_dists, brain_idx = brain_nn.kneighbors(section_centroid)
        brain_sims = 1.0 - brain_dists[0]  # cosine distance -> similarity
        nearest_brain = [brain_names[int(idx)] for idx in brain_idx[0]]

        # Compute section coverage: how well do actual section artifacts
        # cover the Brain frameworks near the centroid?
        # coverage = max cosine sim between any section artifact and
        # nearest Brain frameworks
        section_brain_sims = cosine_similarity(section_embs, brain_embs[brain_idx[0]])
        max_coverage_per_framework = np.max(section_brain_sims, axis=0)
        section_coverage = float(np.mean(max_coverage_per_framework))

        # Gap signal based on coverage
        if section_coverage < 0.3:
            gap_signal = "strong"
        elif section_coverage < 0.5:
            gap_signal = "moderate"
        else:
            gap_signal = "weak"

        zone_counter += 1
        zones.append({
            "zone_id": f"RS-WS-{zone_counter:03d}",
            "bottleneck": {
                "opportunity_id": rs.get("opportunity_id", ""),
                "source_section": source_section,
                "target_section": target_section,
            },
            "downstream_section": target_section,
            "nearest_brain_frameworks": nearest_brain,
            "section_coverage": round(section_coverage, 4),
            "gap_signal": gap_signal,
            "hypothesis": (
                f"Bottleneck in [{source_section}] blocks insight into "
                f"{nearest_brain[0] if nearest_brain else 'unknown'} "
                f"for [{target_section}]"
            ),
        })

    # Sort by gap signal strength
    signal_order = {"strong": 0, "moderate": 1, "weak": 2}
    zones.sort(key=lambda z: (signal_order.get(z["gap_signal"], 3), z["section_coverage"]))

    result = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "bottlenecks_checked": len(reverse_salients),
            "zones_found": len(zones),
        },
        "zones": zones,
    }

    return result


def _empty_result(note=""):
    """Return empty result structure for edge cases."""
    return {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "bottlenecks_checked": 0,
            "zones_found": 0,
            "note": note,
        },
        "zones": [],
    }


def main():
    parser = argparse.ArgumentParser(
        description="Detect whitespace zones downstream of RS bottleneck sections"
    )
    parser.add_argument("room_dir", help="Path to room directory")
    parser.add_argument(
        "--output",
        default=None,
        help="Output JSON path (default: {room_dir}/.mindrian/discovery-rs-whitespace.json)",
    )

    args = parser.parse_args()
    room_dir = Path(args.room_dir).resolve()

    if not room_dir.is_dir():
        print(f"Error: {room_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    # Run detection
    result = detect_rs_whitespace(room_dir)

    # Determine output path
    if args.output:
        output_path = Path(args.output).resolve()
    else:
        output_path = room_dir / ".mindrian" / "discovery-rs-whitespace.json"

    # Write output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    # Print summary to stderr
    zones = result.get("zones", [])
    n_strong = sum(1 for z in zones if z["gap_signal"] == "strong")
    n_moderate = sum(1 for z in zones if z["gap_signal"] == "moderate")

    print(
        f"RS Whitespace: {len(zones)} zones found "
        f"({n_strong} strong, {n_moderate} moderate) "
        f"from {result['metadata']['bottlenecks_checked']} bottlenecks",
        file=sys.stderr,
    )
    print(f"  Output: {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
