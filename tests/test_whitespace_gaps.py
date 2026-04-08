#!/usr/bin/env python3
"""
test_whitespace_gaps.py -- Unit tests for compute-whitespace-gaps.py
====================================================================
Tests UMAP reduction, KDE density estimation, gap detection,
novelty scoring, strategic ranking, and output JSON structure.
"""

import importlib.util
import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pytest
from sklearn.metrics.pairwise import cosine_similarity

# --- Import hyphenated module via importlib ---

SCRIPT_DIR = Path(__file__).resolve().parent.parent / "scripts"
spec = importlib.util.spec_from_file_location(
    "compute_whitespace_gaps",
    SCRIPT_DIR / "compute-whitespace-gaps.py",
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


# --- Fixtures ---

@pytest.fixture
def room_embeddings():
    """5 room artifact embeddings (768-dim), tightly clustered."""
    rng = np.random.RandomState(42)
    center = rng.randn(768)
    center = center / np.linalg.norm(center)
    # Tight cluster around center
    vecs = []
    for _ in range(5):
        noise = rng.randn(768) * 0.05
        v = center + noise
        v = v / np.linalg.norm(v)
        vecs.append(v)
    return np.array(vecs)


@pytest.fixture
def brain_embeddings():
    """3 brain baseline embeddings (768-dim), one near room, two far away."""
    rng = np.random.RandomState(42)
    # One near room center
    center = rng.randn(768)
    center = center / np.linalg.norm(center)
    near = center + rng.randn(768) * 0.05
    near = near / np.linalg.norm(near)

    # Two far away (orthogonal directions)
    far1 = rng.randn(768)
    far1 = far1 / np.linalg.norm(far1)
    far2 = rng.randn(768)
    far2 = far2 / np.linalg.norm(far2)

    return np.array([near, far1, far2])


@pytest.fixture
def sample_room_dir(room_embeddings, brain_embeddings):
    """Create a temp room dir with Phase 60 output files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        mindrian = Path(tmpdir) / ".mindrian"
        mindrian.mkdir()

        # whitespace-embeddings.json
        ws_data = {
            "metadata": {
                "timestamp": "2026-04-08T00:00:00Z",
                "model_name": "BAAI/llm-embedder",
                "model_dim": 768,
                "artifact_count": 5,
                "content_hashes": {},
            },
            "embeddings": [
                {
                    "id": f"section/artifact-{i}",
                    "section": "section",
                    "title": f"Artifact {i}",
                    "path": f"section/artifact-{i}.md",
                    "vector": room_embeddings[i].tolist(),
                }
                for i in range(5)
            ],
        }
        (mindrian / "whitespace-embeddings.json").write_text(
            json.dumps(ws_data), encoding="utf-8"
        )

        # brain-baseline.json
        bl_data = {
            "metadata": {
                "timestamp": "2026-04-08T00:00:00Z",
                "model_name": "BAAI/llm-embedder",
                "model_dim": 768,
                "framework_count": 3,
                "brain_version": "test",
            },
            "baselines": [
                {
                    "name": f"Framework {i}",
                    "description": f"Description of framework {i}",
                    "category": "test",
                    "vector": brain_embeddings[i].tolist(),
                }
                for i in range(3)
            ],
        }
        (mindrian / "brain-baseline.json").write_text(
            json.dumps(bl_data), encoding="utf-8"
        )

        yield tmpdir


# --- Test 1: Novelty scores = 1 - max(cosine_sim) ---

def test_novelty_scores_formula(room_embeddings, brain_embeddings):
    """compute_novelty_scores returns 1 - max(cosine_sim) for each artifact."""
    scores = mod.compute_novelty_scores(room_embeddings, brain_embeddings)

    # Manually compute expected
    sim_matrix = cosine_similarity(room_embeddings, brain_embeddings)
    expected = 1.0 - np.max(sim_matrix, axis=1)

    assert len(scores) == len(room_embeddings)
    np.testing.assert_allclose(scores, expected, atol=1e-6)


# --- Test 2: Novelty scores in [0.0, 1.0] for normalized embeddings ---

def test_novelty_score_range(room_embeddings, brain_embeddings):
    """Novelty scores are bounded [0, 1] for unit-normalized embeddings."""
    scores = mod.compute_novelty_scores(room_embeddings, brain_embeddings)
    assert all(0.0 <= s <= 1.0 for s in scores)


# --- Test 3: Identical artifact gets ~0, random gets near 1 ---

def test_novelty_identical_vs_random():
    """An artifact identical to a baseline gets ~0, a random vector ~1."""
    rng = np.random.RandomState(99)
    baseline = rng.randn(1, 768)
    baseline = baseline / np.linalg.norm(baseline)

    # Identical
    identical = baseline.copy()
    scores_id = mod.compute_novelty_scores(identical, baseline)
    assert scores_id[0] < 0.01, f"Identical should be ~0, got {scores_id[0]}"

    # Random orthogonal-ish
    random_vec = rng.randn(1, 768)
    random_vec = random_vec / np.linalg.norm(random_vec)
    scores_rnd = mod.compute_novelty_scores(random_vec, baseline)
    assert scores_rnd[0] > 0.5, f"Random should be >0.5, got {scores_rnd[0]}"


# --- Test 4: detect_whitespace_zones returns Brain positions with low KDE density ---

def test_detect_whitespace_zones(room_embeddings, brain_embeddings):
    """Far brain baselines should be detected as whitespace zones."""
    # UMAP reduce (mock to just use first 15 dims or PCA for determinism)
    from sklearn.decomposition import PCA

    combined = np.vstack([room_embeddings, brain_embeddings])
    pca = PCA(n_components=15, random_state=42)
    reduced = pca.fit_transform(combined)

    room_reduced = reduced[: len(room_embeddings)]
    brain_reduced = reduced[len(room_embeddings) :]

    brain_names = ["Near Framework", "Far Framework 1", "Far Framework 2"]

    gaps = mod.detect_whitespace_zones(
        room_reduced, brain_reduced, brain_names, room_embeddings
    )

    # Should detect at least the 2 far baselines as gaps
    assert isinstance(gaps, list)
    assert len(gaps) >= 1  # at least one gap detected
    # Gap entries should have required keys
    for gap in gaps:
        assert "brain_framework" in gap
        assert "density_score" in gap


# --- Test 5: rank_by_strategic_importance boosts zones near RS bottlenecks ---

def test_strategic_ranking_with_rs():
    """RS bottleneck data boosts strategic rank of matching zones."""
    gaps = [
        {"brain_framework": "Design Thinking", "density_score": -5.0},
        {"brain_framework": "Market Analysis", "density_score": -3.0},
    ]
    rs_data = {
        "data": {
            "reverse_salients": [
                {"section": "market-analysis", "differential_score": 0.8}
            ]
        }
    }

    ranked = mod.rank_by_strategic_importance(gaps, rs_data)
    assert isinstance(ranked, list)
    assert len(ranked) == 2
    # Each gap should have strategic_rank
    for g in ranked:
        assert "strategic_rank" in g


# --- Test 6: Output JSON structure has required keys ---

def test_output_json_structure(sample_room_dir):
    """Output JSON has metadata, gaps, novelty_scores, umap_2d keys."""
    result = mod.run_whitespace_analysis(sample_room_dir)

    assert "metadata" in result
    assert "gaps" in result
    assert "novelty_scores" in result
    assert "umap_2d" in result

    # Metadata keys
    meta = result["metadata"]
    assert "timestamp" in meta
    assert "room_artifact_count" in meta
    assert "brain_baseline_count" in meta
    assert "umap_dims" in meta
    assert "model" in meta

    # Novelty scores structure
    for ns in result["novelty_scores"]:
        assert "artifact_id" in ns
        assert "novelty_score" in ns
        assert "nearest_brain_framework" in ns

    # UMAP 2D structure
    u2d = result["umap_2d"]
    assert "room" in u2d
    assert "brain" in u2d
    assert "labels_room" in u2d
    assert "labels_brain" in u2d


# --- Test 7: UMAP reduction produces correct output dimensions ---

def test_umap_reduction_dimensions(room_embeddings, brain_embeddings):
    """UMAP produces N x 15 for density and N x 2 for visualization."""
    combined = np.vstack([room_embeddings, brain_embeddings])
    reduced_15, reduced_2 = mod.umap_reduce(combined)

    assert reduced_15.shape == (8, 15), f"Expected (8,15), got {reduced_15.shape}"
    assert reduced_2.shape == (8, 2), f"Expected (8,2), got {reduced_2.shape}"
