#!/usr/bin/env python3
"""
discover-analogy-whitespace.py -- Analogy-Seeded Whitespace Detection
======================================================================
After the analogy engine maps cross-domain transfer (ANALOGOUS_TO edges),
this script checks if the transfer mechanism has been articulated in the
room's embedding space.

Two data sources (in priority order):
  1. .mindrian/analogy-edges.json (pre-exported by discovery-cycle orchestrator)
  2. HSI fallback: .hsi-results.json pairs where both artifacts are in
     DIFFERENT sections with high semantic_sim but low lsa_sim
     (semantic_sim > 0.6, lsa_sim < 0.3) -- analogy candidates

For each analogy pair:
  1. Compute centroid between source and target artifact embeddings
  2. Check if Brain frameworks exist near centroid (transfer mechanism)
  3. Check if any room artifact explains the connection (articulation)
  4. If Brain knows but room hasn't articulated, that's unarticulated
     transfer whitespace

Per D-07, D-08, D-09 from Phase 64 CONTEXT.

Usage:
    python3 scripts/discover-analogy-whitespace.py /path/to/room [--output path]

Output:
    {room_dir}/.mindrian/discovery-analogy-whitespace.json
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
        "Analogy whitespace discovery requires numpy. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.neighbors import NearestNeighbors
except ImportError:
    print(
        "Analogy whitespace discovery requires scikit-learn. Run: pip install -r requirements-whitespace.txt",
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


# --- Analogy data loading ---


def load_analogy_edges(room_dir):
    """Load pre-exported analogy edges from .mindrian/analogy-edges.json.

    Expected format:
    {
      "edges": [
        {
          "source_id": "artifact-id",
          "target_id": "artifact-id",
          "analogy_distance": "near|far|cross-domain",
          "structural_fitness": 0.0-1.0,
          "source_domain": "string",
          "target_domain": "string"
        }
      ]
    }

    Returns:
        List of edge dicts or None if file missing.
    """
    edge_path = Path(room_dir) / ".mindrian" / "analogy-edges.json"
    if not edge_path.exists():
        return None

    try:
        data = json.loads(edge_path.read_text(encoding="utf-8"))
        return data.get("edges", [])
    except (json.JSONDecodeError, OSError):
        return None


def extract_hsi_analogy_candidates(room_dir):
    """Extract analogy candidates from HSI results as fallback.

    Looks for pairs where both artifacts are in DIFFERENT sections with:
    - semantic_sim > 0.6 (conceptually similar)
    - lsa_sim < 0.3 (structurally different)

    These are cross-domain analogy candidates even without explicit
    ANALOGOUS_TO edges.

    Returns:
        List of candidate dicts or empty list.
    """
    hsi_path = Path(room_dir) / ".hsi-results.json"
    if not hsi_path.exists():
        return []

    try:
        hsi_data = json.loads(hsi_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []

    hsi_pairs = hsi_data.get("hsi_pairs", [])
    artifacts = hsi_data.get("artifacts", [])

    # Build section lookup
    artifact_sections = {a["id"]: a.get("section", "") for a in artifacts}

    candidates = []
    for pair in hsi_pairs:
        left_id = pair.get("left_id", "")
        right_id = pair.get("right_id", "")
        lsa_sim = pair.get("lsa_sim", 1.0)
        semantic_sim = pair.get("semantic_sim", 0.0)

        # Check cross-section + analogy pattern
        left_section = artifact_sections.get(left_id, "")
        right_section = artifact_sections.get(right_id, "")

        if left_section == right_section:
            continue  # same section, not cross-domain

        if semantic_sim > 0.6 and lsa_sim < 0.3:
            candidates.append({
                "source_id": left_id,
                "target_id": right_id,
                "source_section": left_section,
                "target_section": right_section,
                "analogy_distance": "cross-domain",
                "semantic_sim": semantic_sim,
                "lsa_sim": lsa_sim,
            })

    return candidates


# --- Core detection ---


def detect_analogy_whitespace(room_dir):
    """Detect whitespace in unarticulated cross-domain transfer mechanisms.

    For each analogy pair (source -> target):
    1. Compute centroid between source and target embeddings
    2. Find Brain frameworks near centroid (potential transfer mechanism)
    3. Check articulation gap: how far is the nearest room artifact from centroid?
    4. High articulation gap + Brain frameworks present = unarticulated transfer

    Args:
        room_dir: path to room directory

    Returns:
        Result dict with metadata and zones
    """
    room_path = Path(room_dir)

    # Try KuzuDB-exported edges first, then HSI fallback
    analogy_edges = load_analogy_edges(room_path)
    data_source = "kuzu"

    if analogy_edges is None or len(analogy_edges) == 0:
        analogy_edges = extract_hsi_analogy_candidates(room_path)
        data_source = "hsi-fallback"

    if not analogy_edges:
        print(
            "No analogy data available (no .mindrian/analogy-edges.json and no "
            "qualifying HSI pairs with high semantic_sim / low lsa_sim).",
            file=sys.stderr,
        )
        return _empty_result("No analogy data available from either source")

    # Load embeddings
    ws_data, room_embs = load_embeddings(room_path)
    if ws_data is None or room_embs is None or len(room_embs) == 0:
        print("No whitespace embeddings found.", file=sys.stderr)
        return _empty_result("No whitespace embeddings found")

    bl_data, brain_embs = load_baselines(room_path)
    if bl_data is None or brain_embs is None or len(brain_embs) == 0:
        print("No Brain baseline embeddings found.", file=sys.stderr)
        return _empty_result("No Brain baseline embeddings found")

    # Build embedding lookup by artifact ID
    embeddings_list = ws_data.get("embeddings", [])
    emb_lookup = {}
    for i, entry in enumerate(embeddings_list):
        emb_lookup[entry["id"]] = i

    # Build section lookup
    section_lookup = {entry["id"]: entry.get("section", "") for entry in embeddings_list}

    # Brain framework names
    baselines_list = bl_data.get("baselines", [])
    brain_names = [b.get("name", f"brain-{i}") for i, b in enumerate(baselines_list)]

    # Fit k-NN on Brain embeddings
    brain_nn = NearestNeighbors(n_neighbors=min(3, len(brain_embs)), metric="cosine")
    brain_nn.fit(brain_embs)

    # Process each analogy pair
    zones = []
    zone_counter = 0

    for edge in analogy_edges:
        source_id = edge.get("source_id", "")
        target_id = edge.get("target_id", "")

        source_idx = emb_lookup.get(source_id)
        target_idx = emb_lookup.get(target_id)

        if source_idx is None or target_idx is None:
            continue  # artifact not in embeddings

        # Compute centroid between source and target
        source_emb = room_embs[source_idx]
        target_emb = room_embs[target_idx]
        centroid = (source_emb + target_emb) / 2.0
        centroid = centroid.reshape(1, -1)

        # Find nearest Brain frameworks to centroid
        brain_dists, brain_indices = brain_nn.kneighbors(centroid)
        brain_sims = 1.0 - brain_dists[0]
        nearest_brain = [brain_names[int(idx)] for idx in brain_indices[0]]

        # Compute articulation gap:
        # 1.0 - max(cosine_sim of any room artifact to the centroid)
        # Higher = less articulated
        all_sims = cosine_similarity(centroid, room_embs)[0]
        max_room_sim = float(np.max(all_sims))
        articulation_gap = 1.0 - max_room_sim

        # Determine transfer type
        if data_source == "kuzu":
            transfer_type = edge.get("analogy_distance", "cross-domain")
            # Map KuzuDB values to our categories
            if transfer_type == "near":
                transfer_type = "structural"
            elif transfer_type == "far":
                transfer_type = "semantic"
            else:
                transfer_type = "cross-domain"
        else:
            # HSI fallback: derive from similarity pattern
            semantic_sim = edge.get("semantic_sim", 0)
            lsa_sim = edge.get("lsa_sim", 0)
            gap = semantic_sim - lsa_sim
            if gap > 0.5:
                transfer_type = "cross-domain"
            elif gap > 0.3:
                transfer_type = "semantic"
            else:
                transfer_type = "structural"

        # Gap signal based on articulation gap
        if articulation_gap > 0.6 and float(np.mean(brain_sims)) > 0.3:
            gap_signal = "strong"
        elif articulation_gap > 0.4:
            gap_signal = "moderate"
        else:
            gap_signal = "weak"

        # Get section info
        source_section = edge.get("source_section", section_lookup.get(source_id, ""))
        target_section = edge.get("target_section", section_lookup.get(target_id, ""))

        # Get titles
        source_title = embeddings_list[source_idx].get("title", source_id)
        target_title = embeddings_list[target_idx].get("title", target_id)

        zone_counter += 1
        zones.append({
            "zone_id": f"ANA-WS-{zone_counter:03d}",
            "source_artifact": source_id,
            "target_artifact": target_id,
            "source_section": source_section,
            "target_section": target_section,
            "transfer_type": transfer_type,
            "nearest_brain_frameworks": nearest_brain,
            "articulation_gap": round(articulation_gap, 4),
            "gap_signal": gap_signal,
            "hypothesis": (
                f"The analogy between [{source_title}] and [{target_title}] "
                f"works through {nearest_brain[0] if nearest_brain else 'unknown'} "
                f"but the transfer mechanism hasn't been written down"
            ),
        })

    # Sort by gap signal strength then articulation gap descending
    signal_order = {"strong": 0, "moderate": 1, "weak": 2}
    zones.sort(
        key=lambda z: (signal_order.get(z["gap_signal"], 3), -z["articulation_gap"])
    )

    result = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "analogies_checked": len(analogy_edges),
            "zones_found": len(zones),
            "source": data_source,
        },
        "zones": zones,
    }

    return result


def _empty_result(note=""):
    """Return empty result structure for edge cases."""
    return {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "analogies_checked": 0,
            "zones_found": 0,
            "source": "none",
            "note": note,
        },
        "zones": [],
    }


def main():
    parser = argparse.ArgumentParser(
        description="Detect unarticulated cross-domain transfer mechanisms via analogy whitespace"
    )
    parser.add_argument("room_dir", help="Path to room directory")
    parser.add_argument(
        "--output",
        default=None,
        help="Output JSON path (default: {room_dir}/.mindrian/discovery-analogy-whitespace.json)",
    )

    args = parser.parse_args()
    room_dir = Path(args.room_dir).resolve()

    if not room_dir.is_dir():
        print(f"Error: {room_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    # Run detection
    result = detect_analogy_whitespace(room_dir)

    # Determine output path
    if args.output:
        output_path = Path(args.output).resolve()
    else:
        output_path = room_dir / ".mindrian" / "discovery-analogy-whitespace.json"

    # Write output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    # Print summary to stderr
    zones = result.get("zones", [])
    n_strong = sum(1 for z in zones if z["gap_signal"] == "strong")
    n_moderate = sum(1 for z in zones if z["gap_signal"] == "moderate")
    source = result["metadata"].get("source", "none")

    print(
        f"Analogy Whitespace: {len(zones)} zones found "
        f"({n_strong} strong, {n_moderate} moderate) "
        f"from {result['metadata']['analogies_checked']} analogies "
        f"(source: {source})",
        file=sys.stderr,
    )
    print(f"  Output: {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
