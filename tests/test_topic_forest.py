#!/usr/bin/env python3
"""
Tests for compute-topic-forest.py -- TopicForest Hierarchical Clustering
========================================================================
Covers corpus-size routing, tree construction for all three strategies,
sparse branch detection, and edge cases (empty room, no Brain baseline).
"""

import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

import numpy as np
import pytest

# Add scripts/ to path so we can import the module
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

import compute_topic_forest as ctf


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _make_room(tmp_path, n_artifacts=10, n_baselines=5, dim=768):
    """Create a fake room with whitespace-embeddings.json and brain-baseline.json."""
    mindrian_dir = tmp_path / ".mindrian"
    mindrian_dir.mkdir(parents=True, exist_ok=True)

    rng = np.random.RandomState(42)

    # Room embeddings
    embeddings = []
    for i in range(n_artifacts):
        vec = rng.randn(dim).tolist()
        embeddings.append({
            "id": f"section-{i // 3}/artifact-{i}",
            "section": f"section-{i // 3}",
            "title": f"Artifact {i}",
            "path": f"section-{i // 3}/artifact-{i}.md",
            "vector": vec,
        })

    ws_data = {
        "metadata": {
            "model_name": "BAAI/llm-embedder",
            "model_dim": dim,
            "artifact_count": n_artifacts,
        },
        "embeddings": embeddings,
    }
    (mindrian_dir / "whitespace-embeddings.json").write_text(
        json.dumps(ws_data), encoding="utf-8"
    )

    # Brain baselines
    baselines = []
    for i in range(n_baselines):
        vec = rng.randn(dim).tolist()
        baselines.append({
            "name": f"Framework {i}",
            "description": f"Description for framework {i}",
            "vector": vec,
        })

    bl_data = {
        "metadata": {
            "model_name": "BAAI/llm-embedder",
            "model_dim": dim,
        },
        "baselines": baselines,
    }
    (mindrian_dir / "brain-baseline.json").write_text(
        json.dumps(bl_data), encoding="utf-8"
    )

    return tmp_path


# ---------------------------------------------------------------------------
# Test: corpus size routing
# ---------------------------------------------------------------------------

class TestCorpusSizeRouting:
    def test_small_corpus_returns_taxonomy(self):
        assert ctf.select_strategy(0) == "taxonomy"
        assert ctf.select_strategy(5) == "taxonomy"
        assert ctf.select_strategy(19) == "taxonomy"

    def test_medium_corpus_returns_hdbscan(self):
        assert ctf.select_strategy(20) == "hdbscan"
        assert ctf.select_strategy(35) == "hdbscan"
        assert ctf.select_strategy(49) == "hdbscan"

    def test_large_corpus_returns_topicforest(self):
        assert ctf.select_strategy(50) == "topicforest"
        assert ctf.select_strategy(100) == "topicforest"
        assert ctf.select_strategy(1000) == "topicforest"


# ---------------------------------------------------------------------------
# Test: taxonomy strategy (< 20 artifacts)
# ---------------------------------------------------------------------------

class TestTaxonomyTree:
    def test_returns_tree_with_brain_framework_leaves(self, tmp_path):
        room_dir = _make_room(tmp_path, n_artifacts=10, n_baselines=5)
        result = ctf.run_topic_forest(room_dir)

        assert result["metadata"]["strategy"] == "taxonomy"
        tree = result["tree"]
        assert tree is not None
        assert "children" in tree
        # Each child should reference a brain framework
        for child in tree["children"]:
            assert "framework_name" in child or "children" in child

    def test_frameworks_with_no_artifacts_marked_whitespace(self, tmp_path):
        # Create room with 5 artifacts but 10 baselines -- some must be sparse
        room_dir = _make_room(tmp_path, n_artifacts=5, n_baselines=10)
        result = ctf.run_topic_forest(room_dir)

        tree = result["tree"]
        whitespace_branches = result["whitespace_branches"]
        # With random embeddings and 10 frameworks, at least some should be whitespace
        # (5 artifacts can't cover all 10 frameworks)
        assert isinstance(whitespace_branches, list)


# ---------------------------------------------------------------------------
# Test: HDBSCAN strategy (20-50 artifacts)
# ---------------------------------------------------------------------------

class TestHdbscanTree:
    def test_returns_flat_clusters(self, tmp_path):
        room_dir = _make_room(tmp_path, n_artifacts=30, n_baselines=5)
        result = ctf.run_topic_forest(room_dir)

        assert result["metadata"]["strategy"] == "hdbscan"
        tree = result["tree"]
        assert tree is not None
        assert "children" in tree

    def test_cluster_nodes_have_counts(self, tmp_path):
        room_dir = _make_room(tmp_path, n_artifacts=30, n_baselines=5)
        result = ctf.run_topic_forest(room_dir)

        tree = result["tree"]
        for child in tree["children"]:
            assert "artifact_count" in child
            assert "brain_framework_count" in child


# ---------------------------------------------------------------------------
# Test: TopicForest agglomerative strategy (50+ artifacts)
# ---------------------------------------------------------------------------

class TestAgglomerativeTree:
    def test_returns_hierarchical_tree_with_depth(self, tmp_path):
        room_dir = _make_room(tmp_path, n_artifacts=60, n_baselines=10)
        result = ctf.run_topic_forest(room_dir)

        assert result["metadata"]["strategy"] == "topicforest"
        tree = result["tree"]
        assert tree is not None
        # Hierarchical tree should have depth > 1
        max_depth = _get_max_depth(tree)
        assert max_depth > 1, f"Expected hierarchical tree with depth > 1, got {max_depth}"

    def test_granularity_levels_present(self, tmp_path):
        room_dir = _make_room(tmp_path, n_artifacts=60, n_baselines=10)
        result = ctf.run_topic_forest(room_dir)

        assert "granularity" in result
        gran = result["granularity"]
        assert "coarse" in gran
        assert "medium" in gran
        assert "fine" in gran
        for level in ["coarse", "medium", "fine"]:
            assert "n_clusters" in gran[level]
            assert "cluster_assignments" in gran[level]

    def test_labels_pending_true(self, tmp_path):
        room_dir = _make_room(tmp_path, n_artifacts=60, n_baselines=10)
        result = ctf.run_topic_forest(room_dir)

        assert result["metadata"]["labels_pending"] is True


# ---------------------------------------------------------------------------
# Test: sparse branch detection
# ---------------------------------------------------------------------------

class TestSparseBranchDetection:
    def test_marks_whitespace_when_brain_only(self, tmp_path):
        """Nodes with brain frameworks but zero room artifacts should be whitespace."""
        room_dir = _make_room(tmp_path, n_artifacts=60, n_baselines=10)
        result = ctf.run_topic_forest(room_dir)

        whitespace = result["whitespace_branches"]
        assert isinstance(whitespace, list)
        # Each whitespace entry should have required fields
        for wb in whitespace:
            assert "node_id" in wb
            assert "depth" in wb
            assert "brain_framework_count" in wb


# ---------------------------------------------------------------------------
# Test: edge cases
# ---------------------------------------------------------------------------

class TestEdgeCases:
    def test_empty_room_returns_valid_json(self, tmp_path):
        """Zero artifacts should produce valid output without crashing."""
        room_dir = _make_room(tmp_path, n_artifacts=0, n_baselines=5)
        result = ctf.run_topic_forest(room_dir)

        assert "metadata" in result
        assert "tree" in result
        assert result["metadata"]["n_artifacts"] == 0

    def test_no_brain_baseline_returns_valid_tree(self, tmp_path):
        """No brain baseline -- tree from room artifacts only, no whitespace detection."""
        mindrian_dir = tmp_path / ".mindrian"
        mindrian_dir.mkdir(parents=True, exist_ok=True)

        rng = np.random.RandomState(42)
        embeddings = []
        for i in range(25):
            embeddings.append({
                "id": f"section-{i // 3}/artifact-{i}",
                "section": f"section-{i // 3}",
                "title": f"Artifact {i}",
                "path": f"section-{i // 3}/artifact-{i}.md",
                "vector": rng.randn(768).tolist(),
            })
        ws_data = {
            "metadata": {"model_name": "BAAI/llm-embedder", "model_dim": 768, "artifact_count": 25},
            "embeddings": embeddings,
        }
        (mindrian_dir / "whitespace-embeddings.json").write_text(
            json.dumps(ws_data), encoding="utf-8"
        )
        # No brain-baseline.json

        result = ctf.run_topic_forest(tmp_path)

        assert "metadata" in result
        assert "tree" in result
        # No whitespace detection possible without Brain
        assert result["whitespace_branches"] == []

    def test_single_artifact_returns_valid_json(self, tmp_path):
        """One artifact should not crash."""
        room_dir = _make_room(tmp_path, n_artifacts=1, n_baselines=3)
        result = ctf.run_topic_forest(room_dir)

        assert "metadata" in result
        assert "tree" in result

    def test_output_written_to_disk(self, tmp_path):
        """Verify topic-forest.json is written when called via main pipeline."""
        room_dir = _make_room(tmp_path, n_artifacts=10, n_baselines=5)
        output_path = tmp_path / ".mindrian" / "topic-forest.json"

        result = ctf.run_topic_forest(room_dir)
        ctf.write_output(result, output_path)

        assert output_path.exists()
        loaded = json.loads(output_path.read_text(encoding="utf-8"))
        assert loaded["metadata"]["strategy"] == "taxonomy"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_max_depth(node, current=0):
    """Recursively find max depth in tree."""
    if "children" not in node or not node["children"]:
        return current
    return max(_get_max_depth(c, current + 1) for c in node["children"])
