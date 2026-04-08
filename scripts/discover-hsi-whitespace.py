#!/usr/bin/env python3
"""
discover-hsi-whitespace.py -- HSI-Seeded Whitespace Detection
==============================================================
After HSI finds surprising pairs (high |semantic_sim - structural_sim|),
this script maps the embedding region BETWEEN them to find missing
connecting artifacts.

For each qualifying HSI pair (hsi_score > threshold):
  1. Compute centroid of the two artifacts' 768-dim embeddings
  2. Check if Brain frameworks exist near centroid (cosine sim > 0.5)
     but no room artifacts exist near centroid (cosine sim > 0.6)
  3. If yes, that's a whitespace zone -- the missing connecting insight

Per D-01, D-02, D-03 from Phase 64 CONTEXT.

Usage:
    python3 scripts/discover-hsi-whitespace.py /path/to/room [--threshold 0.4] [--output path]

Output:
    {room_dir}/.mindrian/discovery-hsi-whitespace.json
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
        "HSI whitespace discovery requires numpy. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.neighbors import NearestNeighbors
except ImportError:
    print(
        "HSI whitespace discovery requires scikit-learn. Run: pip install -r requirements-whitespace.txt",
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


def classify_gap_signal(brain_density, room_density):
    """Classify gap signal strength based on density contrast.

    Returns:
        "strong" if brain_density > 0.5 and room_density < 0.3
        "moderate" if brain_density > 0.3 and room_density < 0.5
        "weak" otherwise
    """
    if brain_density > 0.5 and room_density < 0.3:
        return "strong"
    if brain_density > 0.3 and room_density < 0.5:
        return "moderate"
    return "weak"


def detect_hsi_whitespace(room_dir, threshold=0.4):
    """Detect whitespace zones between surprising HSI pairs.

    For each HSI pair with score > threshold:
    1. Compute centroid between the two artifacts
    2. Check Brain framework density near centroid (k-NN, k=3)
    3. Check room artifact density near centroid (k-NN, k=3)
    4. If Brain is dense but room is sparse, that's a whitespace zone

    Args:
        room_dir: path to room directory
        threshold: minimum HSI score to qualify (default 0.4)

    Returns:
        Result dict with metadata and zones
    """
    room_path = Path(room_dir)

    # Load HSI results
    hsi_data = load_hsi_results(room_path)
    if hsi_data is None:
        print(
            "No .hsi-results.json found. Run compute-hsi.py first.",
            file=sys.stderr,
        )
        return _empty_result("No .hsi-results.json found")

    hsi_pairs = hsi_data.get("hsi_pairs", [])
    qualifying_pairs = [p for p in hsi_pairs if p.get("hsi_score", 0) > threshold]

    if not qualifying_pairs:
        print(
            f"No HSI pairs with score > {threshold} found.",
            file=sys.stderr,
        )
        return _empty_result(f"No HSI pairs with score > {threshold}")

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

    # Brain framework names
    baselines_list = bl_data.get("baselines", [])
    brain_names = [b.get("name", f"brain-{i}") for i, b in enumerate(baselines_list)]

    # Fit k-NN models for density checking
    brain_nn = NearestNeighbors(n_neighbors=min(3, len(brain_embs)), metric="cosine")
    brain_nn.fit(brain_embs)

    room_nn = NearestNeighbors(n_neighbors=min(3, len(room_embs)), metric="cosine")
    room_nn.fit(room_embs)

    # Process each qualifying pair
    zones = []
    zone_counter = 0

    for pair in qualifying_pairs:
        left_id = pair.get("left_id", "")
        right_id = pair.get("right_id", "")

        left_idx = emb_lookup.get(left_id)
        right_idx = emb_lookup.get(right_id)

        if left_idx is None or right_idx is None:
            continue  # artifact not in embeddings (skipped during embedding phase)

        # Compute centroid between the two artifacts
        left_emb = room_embs[left_idx]
        right_emb = room_embs[right_idx]
        centroid = (left_emb + right_emb) / 2.0
        centroid = centroid.reshape(1, -1)

        # Check Brain density near centroid
        brain_dists, brain_indices = brain_nn.kneighbors(centroid)
        # Cosine distance -> cosine similarity = 1 - distance
        brain_sims = 1.0 - brain_dists[0]
        brain_density = float(np.mean(brain_sims))

        # Check room density near centroid
        room_dists, room_indices = room_nn.kneighbors(centroid)
        room_sims = 1.0 - room_dists[0]
        room_density = float(np.mean(room_sims))

        gap_signal = classify_gap_signal(brain_density, room_density)

        # Get nearest Brain framework names
        nearest_brain = [brain_names[int(idx)] for idx in brain_indices[0]]

        # Get nearest room artifact IDs
        nearest_room = [
            embeddings_list[int(idx)].get("id", f"artifact-{idx}")
            for idx in room_indices[0]
        ]

        # Get artifact titles for hypothesis generation
        left_title = embeddings_list[left_idx].get("title", left_id)
        right_title = embeddings_list[right_idx].get("title", right_id)

        zone_counter += 1
        zones.append({
            "zone_id": f"HSI-WS-{zone_counter:03d}",
            "seed_pair": {
                "left_id": left_id,
                "right_id": right_id,
                "hsi_score": pair.get("hsi_score", 0),
            },
            "centroid_description": f"Region between [{left_title}] and [{right_title}]",
            "nearest_brain_frameworks": nearest_brain,
            "nearest_room_artifacts": nearest_room,
            "brain_density": round(brain_density, 4),
            "room_density": round(room_density, 4),
            "gap_signal": gap_signal,
            "hypothesis": (
                f"The connection between [{left_title}] and [{right_title}] "
                f"may involve {nearest_brain[0] if nearest_brain else 'unknown framework'} "
                f"-- this connecting insight hasn't been articulated yet"
            ),
        })

    # Sort by gap signal strength (strong first) then by brain_density descending
    signal_order = {"strong": 0, "moderate": 1, "weak": 2}
    zones.sort(key=lambda z: (signal_order.get(z["gap_signal"], 3), -z["brain_density"]))

    result = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hsi_pairs_checked": len(qualifying_pairs),
            "zones_found": len(zones),
            "threshold": threshold,
        },
        "zones": zones,
    }

    return result


def _empty_result(note=""):
    """Return empty result structure for edge cases."""
    return {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "hsi_pairs_checked": 0,
            "zones_found": 0,
            "note": note,
        },
        "zones": [],
    }


def main():
    parser = argparse.ArgumentParser(
        description="Detect whitespace zones between surprising HSI pairs"
    )
    parser.add_argument("room_dir", help="Path to room directory")
    parser.add_argument(
        "--threshold",
        type=float,
        default=0.4,
        help="Minimum HSI score threshold for qualifying pairs (default: 0.4)",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Output JSON path (default: {room_dir}/.mindrian/discovery-hsi-whitespace.json)",
    )

    args = parser.parse_args()
    room_dir = Path(args.room_dir).resolve()

    if not room_dir.is_dir():
        print(f"Error: {room_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    # Run detection
    result = detect_hsi_whitespace(room_dir, threshold=args.threshold)

    # Determine output path
    if args.output:
        output_path = Path(args.output).resolve()
    else:
        output_path = room_dir / ".mindrian" / "discovery-hsi-whitespace.json"

    # Write output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    # Print summary to stderr
    zones = result.get("zones", [])
    n_strong = sum(1 for z in zones if z["gap_signal"] == "strong")
    n_moderate = sum(1 for z in zones if z["gap_signal"] == "moderate")
    n_weak = sum(1 for z in zones if z["gap_signal"] == "weak")

    print(
        f"HSI Whitespace: {len(zones)} zones found "
        f"({n_strong} strong, {n_moderate} moderate, {n_weak} weak) "
        f"from {result['metadata']['hsi_pairs_checked']} qualifying pairs",
        file=sys.stderr,
    )
    print(f"  Output: {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
