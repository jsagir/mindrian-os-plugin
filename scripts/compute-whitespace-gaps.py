#!/usr/bin/env python3
"""
compute-whitespace-gaps.py -- Whitespace Gap Detection & Novelty Scoring
=========================================================================
Performs UMAP dimensionality reduction, KDE density estimation, gap
detection, and SemNovel-style novelty scoring on room artifacts against
Brain baseline.

Loads Phase 60 embeddings (whitespace-embeddings.json and
brain-baseline.json), reduces dimensions, fits density models, and
detects whitespace zones where Brain knows about topics the room
hasn't explored.

Usage:
    python3 scripts/compute-whitespace-gaps.py /path/to/room [--output path]
        [--umap-dim 15] [--kde-bandwidth scott] [--knn-k 5]

Output:
    {room_dir}/.mindrian/whitespace-results.json

Per D-10, D-11: novelty_score = 1 - max(cosine_similarity(artifact, brain_baselines))
Per D-06, D-07: KDE density on UMAP-reduced room space, evaluated at Brain positions
Per D-09: RS bottleneck integration boosts strategic ranking
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# --- Guarded imports ---

try:
    import numpy as np
except ImportError:
    print(
        "Whitespace gaps require numpy. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.neighbors import KernelDensity, NearestNeighbors
except ImportError:
    print(
        "Whitespace gaps require scikit-learn. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from sklearn.decomposition import PCA
except ImportError:
    pass

# Prevent numba JIT crash with llvmlite on some systems
if "NUMBA_DISABLE_JIT" not in os.environ:
    os.environ["NUMBA_DISABLE_JIT"] = "1"

_umap_available = False
# UMAP import deferred to function call -- numba/llvmlite can crash at import time


# --- Core functions ---


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


def umap_reduce(combined_embeddings, n_density=15, n_viz=2):
    """Reduce combined embeddings to density and visualization dimensions.

    Per D-01, D-05: 768-dim -> 15-dim for KDE density, 2-dim for visualization.
    Uses UMAP when available, falls back to PCA if UMAP/numba crashes.

    Args:
        combined_embeddings: np.ndarray of shape (N, 768) with room + brain vectors
        n_density: dimensions for density estimation (default 15)
        n_viz: dimensions for visualization (default 2)

    Returns:
        Tuple of (reduced_density, reduced_viz) np.ndarrays
    """
    n_samples = combined_embeddings.shape[0]
    n_features = combined_embeddings.shape[1]

    # Cap components to valid range
    max_density = min(n_density, n_samples - 1, n_features)
    max_viz = min(n_viz, n_samples - 1, n_features)

    # Try UMAP with lazy import (numba/llvmlite can crash at import time)
    # Set NUMBA_DISABLE_JIT if not already set to avoid llvmlite abort
    try:
        if "NUMBA_DISABLE_JIT" not in os.environ:
            os.environ["NUMBA_DISABLE_JIT"] = "1"
        import umap as _umap

        n_neighbors = min(15, n_samples - 1)
        if n_neighbors < 2:
            n_neighbors = 2

        reducer_density = _umap.UMAP(
            n_components=max_density,
            metric="cosine",
            random_state=42,
            n_neighbors=n_neighbors,
        )
        reduced_density = reducer_density.fit_transform(combined_embeddings)

        reducer_viz = _umap.UMAP(
            n_components=max_viz,
            metric="cosine",
            random_state=42,
            n_neighbors=n_neighbors,
        )
        reduced_viz = reducer_viz.fit_transform(combined_embeddings)

        return reduced_density, reduced_viz
    except Exception:
        pass  # fall through to PCA

    # PCA fallback (deterministic, works everywhere)
    pca_density = PCA(n_components=max_density, random_state=42)
    reduced_density = pca_density.fit_transform(combined_embeddings)

    pca_viz = PCA(n_components=max_viz, random_state=42)
    reduced_viz = pca_viz.fit_transform(combined_embeddings)

    return reduced_density, reduced_viz


def compute_novelty_scores(room_embeddings, brain_embeddings):
    """Compute SemNovel novelty score for each room artifact.

    Per D-10, D-11, D-12:
    novelty_score = 1 - max(cosine_similarity(artifact_emb, all_brain_embs))

    Computed on ORIGINAL 768-dim embeddings (not UMAP-reduced) for accuracy.

    Args:
        room_embeddings: np.ndarray of shape (N, dim)
        brain_embeddings: np.ndarray of shape (M, dim)

    Returns:
        np.ndarray of novelty scores, shape (N,)
    """
    sim_matrix = cosine_similarity(room_embeddings, brain_embeddings)
    max_sim = np.max(sim_matrix, axis=1)
    scores = 1.0 - max_sim
    # Clamp to [0, 1] to handle floating point precision
    return np.clip(scores, 0.0, 1.0)


def detect_whitespace_zones(
    room_reduced, brain_reduced, brain_names, room_embeddings_full,
    kde_bandwidth="scott", knn_k=5
):
    """Detect Brain positions with low KDE density in room-artifact space.

    Per D-06, D-07, D-08:
    - Fit KDE on ROOM embeddings only (the "explored" space)
    - Evaluate density at BRAIN baseline positions
    - Brain positions with low density = whitespace zones

    Args:
        room_reduced: np.ndarray (N, d) room embeddings in UMAP space
        brain_reduced: np.ndarray (M, d) brain embeddings in UMAP space
        brain_names: list of brain framework names
        room_embeddings_full: np.ndarray (N, orig_dim) for nearest artifact lookup
        kde_bandwidth: bandwidth method for KDE (default "scott")
        knn_k: k for k-NN density estimation

    Returns:
        List of gap dicts with brain_framework, density_score, knn_density,
        nearest_room_artifacts
    """
    n_room = room_reduced.shape[0]

    # Compute Scott's rule bandwidth: h = n^(-1/(d+4))
    d = room_reduced.shape[1]
    if kde_bandwidth == "scott":
        bandwidth = n_room ** (-1.0 / (d + 4))
    else:
        bandwidth = float(kde_bandwidth)

    # Fit KDE on room-only embeddings
    kde = KernelDensity(kernel="gaussian", bandwidth=bandwidth)
    kde.fit(room_reduced)

    # Evaluate density at room positions (for threshold)
    room_densities = kde.score_samples(room_reduced)

    # Evaluate density at brain positions
    brain_densities = kde.score_samples(brain_reduced)

    # Threshold: 10th percentile of room density distribution
    threshold = np.percentile(room_densities, 10)

    # k-NN density on room embeddings
    knn_k_actual = min(knn_k, n_room)
    nn = NearestNeighbors(n_neighbors=knn_k_actual, metric="euclidean")
    nn.fit(room_reduced)
    brain_knn_dists, brain_knn_idx = nn.kneighbors(brain_reduced)
    # k-NN density = 1 / distance to kth neighbor
    knn_density = 1.0 / (brain_knn_dists[:, -1] + 1e-10)

    # Detect gaps: brain positions below threshold
    gaps = []
    for i, (name, density, knn_d) in enumerate(
        zip(brain_names, brain_densities, knn_density)
    ):
        if density < threshold:
            # Find nearest room artifacts by UMAP distance
            dists = np.linalg.norm(room_reduced - brain_reduced[i], axis=1)
            nearest_indices = np.argsort(dists)[:3]

            gaps.append({
                "brain_framework": name,
                "density_score": float(density),
                "knn_density": float(knn_d),
                "nearest_room_artifacts": [int(idx) for idx in nearest_indices],
                "hypothesis": f"Room has not explored topics related to '{name}'",
                "strategic_rank": 0.0,
                "problem_type": "",
            })

    # Sort by density (lowest = biggest gap first)
    gaps.sort(key=lambda g: g["density_score"])

    return gaps


def rank_by_strategic_importance(gaps, rs_data=None):
    """Boost strategic ranking of whitespace zones near RS bottlenecks.

    Per D-09: If .hsi-results.json has reverse_salients, cross-reference
    with whitespace zones. Matching zones get a strategic_rank boost.

    Args:
        gaps: list of gap dicts
        rs_data: dict from .hsi-results.json (optional)

    Returns:
        gaps list with strategic_rank updated
    """
    if not gaps:
        return gaps

    # Base rank = 1/(position+1)
    for i, gap in enumerate(gaps):
        gap["strategic_rank"] = 1.0 / (i + 1)

    # If RS data available, boost matching gaps
    if rs_data and "data" in rs_data:
        reverse_salients = rs_data["data"].get("reverse_salients", [])
        rs_sections = {
            rs.get("section", "").lower(): rs.get("differential_score", 0.0)
            for rs in reverse_salients
        }

        for gap in gaps:
            framework_lower = gap["brain_framework"].lower()
            # Check if any RS section name appears in framework name or vice versa
            for rs_section, rs_score in rs_sections.items():
                if rs_section and (
                    rs_section in framework_lower
                    or framework_lower in rs_section
                    or any(
                        word in framework_lower
                        for word in rs_section.replace("-", " ").split()
                        if len(word) > 3
                    )
                ):
                    # Boost: multiply by (1 + RS differential score)
                    gap["strategic_rank"] *= 1.0 + rs_score
                    break

    return gaps


def run_whitespace_analysis(room_dir, umap_dim=15, kde_bandwidth="scott", knn_k=5):
    """Run full whitespace analysis pipeline.

    Steps:
    1. Load Phase 60 embeddings
    2. UMAP reduce
    3. KDE density estimation on room-only space
    4. Gap detection at Brain positions
    5. Strategic ranking with RS data
    6. Novelty scoring on original embeddings

    Args:
        room_dir: path to room directory
        umap_dim: UMAP dimensions for density (default 15)
        kde_bandwidth: KDE bandwidth method
        knn_k: k for k-NN density

    Returns:
        Result dict with metadata, gaps, novelty_scores, umap_2d
    """
    room_path = Path(room_dir)

    # Step 1: Load embeddings
    ws_data, room_embs = load_embeddings(room_path)
    bl_data, brain_embs = load_baselines(room_path)

    # Handle missing/empty cases
    if ws_data is None or room_embs is None or len(room_embs) == 0:
        return _empty_result("No room embeddings found")

    has_brain = bl_data is not None and brain_embs is not None and len(brain_embs) > 0
    model_name = ws_data.get("metadata", {}).get("model_name", "unknown")

    # If no brain, only do novelty scoring placeholder
    if not has_brain:
        return {
            "metadata": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "room_artifact_count": len(room_embs),
                "brain_baseline_count": 0,
                "umap_dims": umap_dim,
                "kde_bandwidth": str(kde_bandwidth),
                "model": model_name,
                "note": "No Brain baseline - gap detection skipped, novelty scores unavailable",
            },
            "gaps": [],
            "novelty_scores": [],
            "umap_2d": {"room": [], "brain": [], "labels_room": [], "labels_brain": []},
        }

    # Step 2: UMAP reduction
    combined = np.vstack([room_embs, brain_embs])
    reduced_15, reduced_2 = umap_reduce(combined, n_density=umap_dim, n_viz=2)

    n_room = len(room_embs)
    room_reduced_15 = reduced_15[:n_room]
    brain_reduced_15 = reduced_15[n_room:]
    room_reduced_2 = reduced_2[:n_room]
    brain_reduced_2 = reduced_2[n_room:]

    # Brain framework names
    brain_names = [b.get("name", f"brain-{i}") for i, b in enumerate(bl_data["baselines"])]

    # Step 3+4: KDE + Gap detection
    gaps = detect_whitespace_zones(
        room_reduced_15, brain_reduced_15, brain_names, room_embs,
        kde_bandwidth=kde_bandwidth, knn_k=knn_k,
    )

    # Step 5: Strategic ranking with RS data
    hsi_path = room_path / ".hsi-results.json"
    rs_data = None
    if hsi_path.exists():
        try:
            rs_data = json.loads(hsi_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass

    gaps = rank_by_strategic_importance(gaps, rs_data)

    # Update nearest_room_artifacts with actual artifact info
    ws_embeddings_list = ws_data.get("embeddings", [])
    for gap in gaps:
        indices = gap["nearest_room_artifacts"]
        gap["nearest_room_artifacts"] = [
            {
                "artifact_id": ws_embeddings_list[idx]["id"],
                "title": ws_embeddings_list[idx]["title"],
            }
            for idx in indices
            if idx < len(ws_embeddings_list)
        ]

    # Step 6: Novelty scoring on original 768-dim embeddings
    novelty_scores = compute_novelty_scores(room_embs, brain_embs)

    # Find nearest brain framework for each artifact
    sim_matrix = cosine_similarity(room_embs, brain_embs)
    nearest_brain_idx = np.argmax(sim_matrix, axis=1)

    novelty_list = []
    for i, emb_entry in enumerate(ws_embeddings_list):
        nearest_idx = int(nearest_brain_idx[i])
        novelty_list.append({
            "artifact_id": emb_entry["id"],
            "title": emb_entry.get("title", ""),
            "section": emb_entry.get("section", ""),
            "novelty_score": float(novelty_scores[i]),
            "nearest_brain_framework": brain_names[nearest_idx],
        })

    # Build result
    result = {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "room_artifact_count": n_room,
            "brain_baseline_count": len(brain_embs),
            "umap_dims": umap_dim,
            "kde_bandwidth": str(kde_bandwidth),
            "model": model_name,
        },
        "gaps": gaps,
        "novelty_scores": novelty_list,
        "umap_2d": {
            "room": room_reduced_2.tolist(),
            "brain": brain_reduced_2.tolist(),
            "labels_room": [e.get("title", e["id"]) for e in ws_embeddings_list],
            "labels_brain": brain_names,
        },
    }

    return result


def _empty_result(note=""):
    """Return empty result structure for edge cases."""
    return {
        "metadata": {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "room_artifact_count": 0,
            "brain_baseline_count": 0,
            "umap_dims": 0,
            "kde_bandwidth": "",
            "model": "none",
            "note": note,
        },
        "gaps": [],
        "novelty_scores": [],
        "umap_2d": {"room": [], "brain": [], "labels_room": [], "labels_brain": []},
    }


def main():
    parser = argparse.ArgumentParser(
        description="Detect whitespace gaps and compute novelty scores for room artifacts"
    )
    parser.add_argument("room_dir", help="Path to room directory")
    parser.add_argument(
        "--output",
        default=None,
        help="Output JSON path (default: {room_dir}/.mindrian/whitespace-results.json)",
    )
    parser.add_argument(
        "--umap-dim",
        type=int,
        default=15,
        help="UMAP dimensions for density estimation (default: 15)",
    )
    parser.add_argument(
        "--kde-bandwidth",
        default="scott",
        help="KDE bandwidth method or float value (default: scott)",
    )
    parser.add_argument(
        "--knn-k",
        type=int,
        default=5,
        help="k for k-NN density estimation (default: 5)",
    )

    args = parser.parse_args()
    room_dir = Path(args.room_dir).resolve()

    if not room_dir.is_dir():
        print(f"Error: {room_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    # Determine output path
    if args.output:
        output_path = Path(args.output).resolve()
    else:
        output_path = room_dir / ".mindrian" / "whitespace-results.json"

    # Run analysis
    result = run_whitespace_analysis(
        room_dir,
        umap_dim=args.umap_dim,
        kde_bandwidth=args.kde_bandwidth,
        knn_k=args.knn_k,
    )

    # Write output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")

    # Print summary
    gaps = result.get("gaps", [])
    novelty = result.get("novelty_scores", [])
    n_gaps = len(gaps)
    n_artifacts = result["metadata"]["room_artifact_count"]
    n_baselines = result["metadata"]["brain_baseline_count"]

    print(f"Whitespace Analysis: {n_artifacts} room artifacts, {n_baselines} Brain baselines")
    print(f"  Gaps found: {n_gaps}")

    if n_gaps > 0:
        print("  Top gaps:")
        for g in gaps[:3]:
            print(f"    - {g['brain_framework']} (density: {g['density_score']:.2f})")

    if novelty:
        scores = [ns["novelty_score"] for ns in novelty]
        print(f"  Novelty: avg={np.mean(scores):.3f}, min={np.min(scores):.3f}, max={np.max(scores):.3f}")

    print(f"  Output: {output_path}")


if __name__ == "__main__":
    main()
