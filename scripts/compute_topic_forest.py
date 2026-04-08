#!/usr/bin/env python3
"""
compute-topic-forest.py -- TopicForest Hierarchical Clustering
==============================================================
Constructs a hierarchical topic tree from room + Brain embeddings with
corpus-size-aware algorithm routing. Shows which branches of understanding
have coverage vs gaps at multiple granularity levels.

Three strategies based on corpus size:
  - taxonomy (<20 artifacts): Brain framework mapping, no clustering
  - hdbscan (20-50 artifacts): HDBSCAN flat clustering
  - topicforest (50+ artifacts): Ward's linkage agglomerative clustering

Usage:
    python3 scripts/compute-topic-forest.py /path/to/room [--output path]

Output:
    {room_dir}/.mindrian/topic-forest.json

Per D-01, D-02: Agglomerative clustering with Ward's linkage + multi-level
dendrogram cutting.
Per D-04: Sparse branches = Brain nodes present, zero room artifacts.
Per D-05, D-06: PCA to ~15 dims (deterministic, same as Phase 61).
Per D-07, D-08, D-09: Corpus size routing.
Per D-10: Graceful degradation -- never crash.
Per D-11, D-12: Output schema with labels_pending=true.
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
        "TopicForest requires numpy. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from sklearn.decomposition import PCA
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    print(
        "TopicForest requires scikit-learn. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)

try:
    from scipy.cluster.hierarchy import fcluster, linkage, to_tree
except ImportError:
    print(
        "TopicForest requires scipy. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)


# --- Data loading (same pattern as compute-whitespace-gaps.py) ---


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


# --- Corpus size routing ---


def select_strategy(n_artifacts):
    """Select clustering strategy based on corpus size.

    Per D-07, D-08, D-09:
      <20 artifacts -> taxonomy (Brain framework mapping)
      20-50 artifacts -> hdbscan (flat clustering)
      50+ artifacts -> topicforest (Ward's linkage hierarchical)

    Args:
        n_artifacts: number of room artifacts

    Returns:
        Strategy name string: "taxonomy", "hdbscan", or "topicforest"
    """
    if n_artifacts < 20:
        return "taxonomy"
    if n_artifacts < 50:
        return "hdbscan"
    return "topicforest"


# --- PCA reduction ---


def pca_reduce(embeddings, n_components=15):
    """Reduce embeddings to n_components dims using PCA.

    Per D-05, D-06: PCA for deterministic reduction. ~15 dims for clustering.

    Args:
        embeddings: np.ndarray of shape (N, D)
        n_components: target dimensions

    Returns:
        np.ndarray of shape (N, min(n_components, N-1, D))
    """
    n_samples, n_features = embeddings.shape
    max_components = min(n_components, n_samples - 1, n_features)
    if max_components < 1:
        return embeddings

    pca = PCA(n_components=max_components, random_state=42)
    return pca.fit_transform(embeddings)


# --- Taxonomy strategy (<20 artifacts) ---


def build_taxonomy_tree(room_embs, brain_embs, ws_data, bl_data):
    """Build flat tree mapping room artifacts to nearest Brain frameworks.

    No clustering. Each Brain framework is a leaf node. Room artifacts
    assigned to their nearest framework by cosine similarity. Frameworks
    with zero assigned artifacts -> is_whitespace=True.

    Args:
        room_embs: np.ndarray (N, D) room embeddings
        brain_embs: np.ndarray (M, D) brain embeddings
        ws_data: dict with embeddings metadata
        bl_data: dict with baselines metadata

    Returns:
        (tree_dict, whitespace_branches_list)
    """
    brain_names = [b.get("name", f"brain-{i}") for i, b in enumerate(bl_data.get("baselines", []))]
    ws_list = ws_data.get("embeddings", [])
    n_brain = len(brain_names)
    n_artifacts = len(room_embs) if room_embs is not None and len(room_embs) > 0 else 0

    # Assign artifacts to nearest brain framework
    assignments = {}  # brain_index -> [artifact_indices]
    for i in range(n_brain):
        assignments[i] = []

    if n_artifacts > 0 and n_brain > 0:
        sim_matrix = cosine_similarity(room_embs, brain_embs)
        nearest_brain = np.argmax(sim_matrix, axis=1)
        for art_idx, brain_idx in enumerate(nearest_brain):
            assignments[int(brain_idx)].append(art_idx)

    # Build tree: root -> framework leaves
    children = []
    whitespace_branches = []

    for brain_idx in range(n_brain):
        art_indices = assignments[brain_idx]
        is_ws = len(art_indices) == 0

        node = {
            "id": f"framework-{brain_idx}",
            "framework_name": brain_names[brain_idx],
            "depth": 1,
            "artifact_count": len(art_indices),
            "brain_framework_count": 1,
            "is_whitespace": is_ws,
            "label": None,
            "artifacts": [
                {"artifact_id": ws_list[idx]["id"], "title": ws_list[idx].get("title", "")}
                for idx in art_indices
                if idx < len(ws_list)
            ],
        }
        children.append(node)

        if is_ws:
            whitespace_branches.append({
                "node_id": f"framework-{brain_idx}",
                "depth": 1,
                "brain_framework_count": 1,
                "nearest_frameworks": [brain_names[brain_idx]],
            })

    tree = {
        "id": "root",
        "depth": 0,
        "artifact_count": n_artifacts,
        "brain_framework_count": n_brain,
        "is_whitespace": False,
        "label": None,
        "children": children,
    }

    return tree, whitespace_branches


# --- HDBSCAN strategy (20-50 artifacts) ---


def build_hdbscan_tree(room_embs, brain_embs, ws_data, bl_data):
    """Build flat cluster tree using HDBSCAN on combined embeddings.

    PCA reduces combined embeddings to ~15 dims. HDBSCAN finds flat clusters.
    Noise points grouped into "unclustered" node.

    Args:
        room_embs: np.ndarray (N, D)
        brain_embs: np.ndarray (M, D) or None
        ws_data: dict
        bl_data: dict or None

    Returns:
        (tree_dict, whitespace_branches_list)
    """
    from sklearn.cluster import HDBSCAN

    ws_list = ws_data.get("embeddings", [])
    n_room = len(room_embs)

    has_brain = brain_embs is not None and len(brain_embs) > 0
    brain_names = []
    if has_brain and bl_data:
        brain_names = [b.get("name", f"brain-{i}") for i, b in enumerate(bl_data.get("baselines", []))]

    # Combine embeddings
    if has_brain:
        combined = np.vstack([room_embs, brain_embs])
    else:
        combined = room_embs

    # PCA reduce
    reduced = pca_reduce(combined, n_components=15)

    # HDBSCAN
    min_cluster = max(3, n_room // 10)
    clusterer = HDBSCAN(min_cluster_size=min_cluster)
    labels = clusterer.fit_predict(reduced)

    # Split labels
    room_labels = labels[:n_room]
    brain_labels = labels[n_room:] if has_brain else np.array([])

    # Build cluster nodes
    unique_labels = set(room_labels.tolist())
    if has_brain:
        unique_labels.update(brain_labels.tolist())

    children = []
    whitespace_branches = []

    for cluster_id in sorted(unique_labels):
        room_mask = room_labels == cluster_id
        art_count = int(np.sum(room_mask))

        brain_count = 0
        cluster_frameworks = []
        if has_brain and len(brain_labels) > 0:
            brain_mask = brain_labels == cluster_id
            brain_count = int(np.sum(brain_mask))
            brain_indices = np.where(brain_mask)[0]
            cluster_frameworks = [brain_names[i] for i in brain_indices if i < len(brain_names)]

        is_ws = brain_count > 0 and art_count == 0

        node_id = f"cluster-{cluster_id}" if cluster_id >= 0 else "unclustered"
        node = {
            "id": node_id,
            "depth": 1,
            "artifact_count": art_count,
            "brain_framework_count": brain_count,
            "is_whitespace": is_ws,
            "label": None,
            "children": [],
        }
        if cluster_frameworks:
            node["frameworks"] = cluster_frameworks

        children.append(node)

        if is_ws:
            whitespace_branches.append({
                "node_id": node_id,
                "depth": 1,
                "brain_framework_count": brain_count,
                "nearest_frameworks": cluster_frameworks,
            })

    tree = {
        "id": "root",
        "depth": 0,
        "artifact_count": n_room,
        "brain_framework_count": len(brain_names),
        "is_whitespace": False,
        "label": None,
        "children": children,
    }

    return tree, whitespace_branches


# --- TopicForest agglomerative strategy (50+ artifacts) ---


def build_agglomerative_tree(room_embs, brain_embs, ws_data, bl_data):
    """Build hierarchical tree using Ward's linkage agglomerative clustering.

    Per D-01, D-02: Ward's linkage on PCA-reduced embeddings. Multi-level
    dendrogram cutting at 3 granularity levels (33%, 50%, 66% of max distance).

    Args:
        room_embs: np.ndarray (N, D)
        brain_embs: np.ndarray (M, D) or None
        ws_data: dict
        bl_data: dict or None

    Returns:
        (tree_dict, whitespace_branches_list, granularity_dict)
    """
    ws_list = ws_data.get("embeddings", [])
    n_room = len(room_embs)

    has_brain = brain_embs is not None and len(brain_embs) > 0
    brain_names = []
    if has_brain and bl_data:
        brain_names = [b.get("name", f"brain-{i}") for i, b in enumerate(bl_data.get("baselines", []))]

    # Combine embeddings
    if has_brain:
        combined = np.vstack([room_embs, brain_embs])
    else:
        combined = room_embs

    n_total = len(combined)

    # PCA reduce
    reduced = pca_reduce(combined, n_components=15)

    # Ward's linkage
    Z = linkage(reduced, method="ward")

    # Get scipy ClusterNode tree
    scipy_root = to_tree(Z)

    # Build JSON-serializable tree recursively
    def _build_node(scipy_node, depth=0):
        if scipy_node.is_leaf():
            idx = scipy_node.id
            is_room = idx < n_room
            framework_name = None
            if not is_room and has_brain:
                brain_idx = idx - n_room
                if brain_idx < len(brain_names):
                    framework_name = brain_names[brain_idx]

            return {
                "id": f"leaf-{idx}",
                "artifact_index": idx,
                "is_room_artifact": is_room,
                "framework_name": framework_name,
                "depth": depth,
                "artifact_count": 1 if is_room else 0,
                "brain_framework_count": 0 if is_room else 1,
                "is_whitespace": False,
                "label": None,
            }

        left = _build_node(scipy_node.get_left(), depth + 1)
        right = _build_node(scipy_node.get_right(), depth + 1)

        art_count = left["artifact_count"] + right["artifact_count"]
        brain_count = left["brain_framework_count"] + right["brain_framework_count"]
        is_ws = brain_count > 0 and art_count == 0

        return {
            "id": f"node-{scipy_node.id}",
            "depth": depth,
            "artifact_count": art_count,
            "brain_framework_count": brain_count,
            "is_whitespace": is_ws,
            "label": None,
            "children": [left, right],
        }

    tree = _build_node(scipy_root)

    # Mark sparse branches bottom-up (already done in _build_node via aggregation)

    # Multi-level dendrogram cutting
    max_dist = Z[-1, 2] if len(Z) > 0 else 1.0
    granularity = {}
    for level_name, pct in [("coarse", 0.66), ("medium", 0.50), ("fine", 0.33)]:
        threshold = max_dist * pct
        if threshold <= 0:
            threshold = 0.01
        cluster_labels = fcluster(Z, t=threshold, criterion="distance")
        granularity[level_name] = {
            "n_clusters": int(len(set(cluster_labels))),
            "cluster_assignments": cluster_labels.tolist(),
        }

    # Collect whitespace branches
    whitespace_branches = []

    def _collect_whitespace(node):
        if node.get("is_whitespace", False):
            frameworks = _collect_framework_names(node)
            whitespace_branches.append({
                "node_id": node["id"],
                "depth": node["depth"],
                "brain_framework_count": node["brain_framework_count"],
                "nearest_frameworks": frameworks,
            })
        for child in node.get("children", []):
            _collect_whitespace(child)

    _collect_whitespace(tree)

    return tree, whitespace_branches, granularity


def _collect_framework_names(node):
    """Recursively collect framework names from leaf nodes."""
    names = []
    if "framework_name" in node and node["framework_name"]:
        names.append(node["framework_name"])
    for child in node.get("children", []):
        names.extend(_collect_framework_names(child))
    return names


# --- Main pipeline ---


def run_topic_forest(room_dir):
    """Run the full TopicForest pipeline with corpus-size routing.

    Args:
        room_dir: path to room directory

    Returns:
        Result dict with metadata, tree, whitespace_branches, granularity
    """
    room_path = Path(room_dir)

    try:
        return _run_topic_forest_inner(room_path)
    except Exception as e:
        # Per D-10: graceful degradation -- never crash
        return _empty_result(f"Unexpected error: {str(e)}")


def _run_topic_forest_inner(room_path):
    """Inner pipeline without top-level exception handler."""
    # Load embeddings
    ws_data, room_embs = load_embeddings(room_path)
    bl_data, brain_embs = load_baselines(room_path)

    # Handle missing data
    if ws_data is None or room_embs is None or len(room_embs) == 0:
        n_baselines = 0
        if bl_data and brain_embs is not None and len(brain_embs) > 0:
            n_baselines = len(brain_embs)
        return _empty_result_with_baselines(0, n_baselines)

    n_artifacts = len(room_embs)
    has_brain = bl_data is not None and brain_embs is not None and len(brain_embs) > 0
    n_baselines = len(brain_embs) if has_brain else 0

    # Select strategy
    strategy = select_strategy(n_artifacts)

    # Route to appropriate builder
    tree = None
    whitespace_branches = []
    granularity = {}

    if strategy == "taxonomy":
        if has_brain:
            tree, whitespace_branches = build_taxonomy_tree(room_embs, brain_embs, ws_data, bl_data)
        else:
            tree, whitespace_branches = _build_room_only_taxonomy(room_embs, ws_data)

    elif strategy == "hdbscan":
        if has_brain:
            tree, whitespace_branches = build_hdbscan_tree(room_embs, brain_embs, ws_data, bl_data)
        else:
            tree, whitespace_branches = build_hdbscan_tree(room_embs, None, ws_data, None)

    elif strategy == "topicforest":
        if has_brain:
            tree, whitespace_branches, granularity = build_agglomerative_tree(
                room_embs, brain_embs, ws_data, bl_data
            )
        else:
            tree, whitespace_branches, granularity = build_agglomerative_tree(
                room_embs, None, ws_data, None
            )

    result = {
        "metadata": {
            "strategy": strategy,
            "n_artifacts": n_artifacts,
            "n_baselines": n_baselines,
            "granularity_levels": len(granularity) if granularity else 0,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "labels_pending": True,
        },
        "tree": tree,
        "whitespace_branches": whitespace_branches,
        "granularity": granularity if granularity else {},
    }

    return result


def _build_room_only_taxonomy(room_embs, ws_data):
    """Build a simple tree from room artifacts only (no Brain baseline)."""
    ws_list = ws_data.get("embeddings", [])
    n = len(room_embs)

    children = []
    for i in range(n):
        children.append({
            "id": f"artifact-{i}",
            "depth": 1,
            "artifact_count": 1,
            "brain_framework_count": 0,
            "is_whitespace": False,
            "label": None,
            "artifact_id": ws_list[i]["id"] if i < len(ws_list) else f"artifact-{i}",
        })

    tree = {
        "id": "root",
        "depth": 0,
        "artifact_count": n,
        "brain_framework_count": 0,
        "is_whitespace": False,
        "label": None,
        "children": children,
    }

    return tree, []


def _empty_result(note=""):
    """Return empty result structure for edge cases."""
    return {
        "metadata": {
            "strategy": "taxonomy",
            "n_artifacts": 0,
            "n_baselines": 0,
            "granularity_levels": 0,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "labels_pending": True,
            "note": note,
        },
        "tree": {
            "id": "root",
            "depth": 0,
            "artifact_count": 0,
            "brain_framework_count": 0,
            "is_whitespace": False,
            "label": None,
            "children": [],
        },
        "whitespace_branches": [],
        "granularity": {},
    }


def _empty_result_with_baselines(n_artifacts, n_baselines):
    """Return empty result with baseline count info."""
    result = _empty_result(
        "No room artifacts found" if n_artifacts == 0 else "Insufficient data"
    )
    result["metadata"]["n_baselines"] = n_baselines
    return result


def write_output(result, output_path):
    """Write result dict to JSON file."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(result, indent=2), encoding="utf-8")


# --- CLI entry point ---


def main():
    parser = argparse.ArgumentParser(
        description="Build hierarchical topic tree from room + Brain embeddings"
    )
    parser.add_argument("room_dir", help="Path to room directory")
    parser.add_argument(
        "--output",
        default=None,
        help="Output JSON path (default: {room_dir}/.mindrian/topic-forest.json)",
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
        output_path = room_dir / ".mindrian" / "topic-forest.json"

    # Run pipeline
    result = run_topic_forest(room_dir)

    # Write output
    write_output(result, output_path)

    # Print summary
    meta = result["metadata"]
    n_ws = len(result.get("whitespace_branches", []))
    print(f"TopicForest: {meta['n_artifacts']} artifacts, {meta['n_baselines']} baselines")
    print(f"  Strategy: {meta['strategy']}")
    print(f"  Whitespace branches: {n_ws}")
    if meta.get("granularity_levels", 0) > 0:
        gran = result.get("granularity", {})
        for level in ["coarse", "medium", "fine"]:
            if level in gran:
                print(f"  {level}: {gran[level]['n_clusters']} clusters")
    print(f"  Output: {output_path}")


if __name__ == "__main__":
    main()
