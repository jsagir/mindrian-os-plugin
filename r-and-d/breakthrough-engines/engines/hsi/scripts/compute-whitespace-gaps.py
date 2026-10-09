#!/usr/bin/env python3
"""
compute-whitespace-gaps.py -- Whitespace Gap Detection & Novelty Scoring
=========================================================================
Performs UMAP (or PCA) dimensionality reduction, KDE density estimation, gap
detection, and SemNovel-style novelty scoring on room artifacts against
Brain baseline.

Loads Phase 60 embeddings (whitespace-embeddings.json and
brain-baseline.json), reduces dimensions, fits density models, and
detects whitespace zones where Brain knows about topics the room
hasn't explored.

Usage:
    python3 scripts/compute-whitespace-gaps.py /path/to/room [--output path]
        [--umap-dim 15] [--kde-bandwidth scott-scaled|scott|FLOAT] [--knn-k 5]
        [--gap-method hybrid|legacy] [--gap-percentile 0.75]

Output:
    {room_dir}/.mindrian/whitespace-results.json

Per D-10, D-11: novelty_score = 1 - max(cosine_similarity(artifact, brain_baselines))
Per D-06, D-07: KDE density on UMAP-reduced room space, evaluated at Brain positions
Per D-09: RS bottleneck integration boosts strategic ranking

2026 revision (every pre-existing output key is kept, new keys are additive):
  - Gap selection is corpus-relative. The default --gap-method hybrid ranks
    every Brain framework by the mean percentile of four independent
    sparsity signals (KDE density, k-NN distance, dense cosine distance to the
    nearest room artifact, lexical coverage of the framework's own words in
    the room text) and reports those at or above --gap-percentile. The old
    rule (KDE density below the 10th percentile of the room's own densities)
    is still available as --gap-method legacy.
  - Each gap carries a source trail, a second-signal check and a novelty-check
    status; each novelty row carries a corpus percentile and band.
  - Scott's rule is applied to the data scale (the original used the bare
    factor n^(-1/(d+4)) as an absolute bandwidth). --kde-bandwidth scott keeps
    the old behaviour.
  - The RS boost now finds reverse_salients where .hsi-results.json actually
    keeps them (top level); the original looked under a "data" key that file
    never has, so the boost never fired.
  - UMAP failures are recorded (metadata.reducer) instead of silently falling
    back; dimension mismatches are reported instead of crashing; scikit-learn
    is no longer required; results are written atomically.
"""

import argparse
import hashlib
import json
import math
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# Auto-install of Python ML deps (v1.10.9, plan 85-10, LAWRENCE-001), kept when
# the helper exists, switchable off, and no longer a crash when it is absent.
sys.path.insert(0, str(Path(__file__).resolve().parent / "lib"))
try:
    from ensure_ml_deps import ensure
except ImportError:
    def ensure(_packages):  # pragma: no cover - helper absent
        return None
if os.environ.get("HSI_NO_AUTO_INSTALL") != "1":
    ensure(["numpy", "scikit-learn"])

# --- Guarded imports ---

try:
    import numpy as np
except ImportError:
    print(
        "Whitespace gaps require numpy. Run: pip install -r requirements-whitespace.txt",
        file=sys.stderr,
    )
    sys.exit(1)

# Prevent numba JIT crash with llvmlite on some systems
if "NUMBA_DISABLE_JIT" not in os.environ:
    os.environ["NUMBA_DISABLE_JIT"] = "1"

SCHEMA_VERSION = "2.0"
SEED = 42
_umap_available = False
# UMAP import deferred to function call -- numba/llvmlite can crash at import time


# --- numpy replacements for the scikit-learn pieces (small data, deterministic) ---


def cosine_similarity(a, b):
    """Row-wise cosine similarity matrix."""
    a = np.atleast_2d(np.asarray(a, dtype=float))
    b = np.atleast_2d(np.asarray(b, dtype=float))
    na = np.linalg.norm(a, axis=1, keepdims=True)
    nb = np.linalg.norm(b, axis=1, keepdims=True)
    na[na < 1e-12] = 1.0
    nb[nb < 1e-12] = 1.0
    return (a / na) @ (b / nb).T


def empirical_percentile(values):
    """Empirical percentile in [0, 1] (ties share their average rank)."""
    v = np.asarray(values, dtype=float).ravel()
    n = v.size
    if n == 0:
        return v
    if n == 1:
        return np.ones(1)
    uniq, inv, counts = np.unique(v, return_inverse=True, return_counts=True)
    cum = np.cumsum(counts)
    return ((cum - counts + cum - 1) / 2.0)[inv] / (n - 1)


def gaussian_kde_logdensity(train, query, bandwidth, exclude_self=False):
    """Gaussian KDE log-density of `query` under `train` (equals
    sklearn KernelDensity(kernel='gaussian').score_samples). With exclude_self
    the point itself is left out (train and query must be the same array)."""
    train = np.asarray(train, dtype=float)
    query = np.asarray(query, dtype=float)
    n, d = train.shape
    h = max(float(bandwidth), 1e-6)
    out = np.empty(query.shape[0])
    for start in range(0, query.shape[0], 256):
        q = query[start:start + 256]
        d2 = ((q[:, None, :] - train[None, :, :]) ** 2).sum(axis=2)
        logk = -0.5 * d2 / (h * h)
        if exclude_self:
            idx = np.arange(start, start + q.shape[0])
            logk[np.arange(q.shape[0]), idx] = -np.inf
        m = np.max(logk, axis=1, keepdims=True)
        m[~np.isfinite(m)] = 0.0
        lse = m[:, 0] + np.log(np.exp(logk - m).sum(axis=1) + 1e-300)
        count = n - 1 if exclude_self else n
        out[start:start + q.shape[0]] = lse - math.log(max(count, 1)) - d * math.log(h) - 0.5 * d * math.log(2 * math.pi)
    return out


def knn_distances(train, query, k):
    """(distances, indices) of the k nearest `train` rows for every `query` row."""
    train = np.asarray(train, dtype=float)
    query = np.asarray(query, dtype=float)
    k = max(1, min(k, train.shape[0]))
    d = np.sqrt(((query[:, None, :] - train[None, :, :]) ** 2).sum(axis=2))
    idx = np.argsort(d, axis=1, kind="stable")[:, :k]
    return np.take_along_axis(d, idx, axis=1), idx


def pca_reduce(x, n_components):
    """Deterministic PCA via SVD (sign-fixed)."""
    x = np.asarray(x, dtype=float)
    xc = x - x.mean(axis=0, keepdims=True)
    u, s, vt = np.linalg.svd(xc, full_matrices=False)
    k = min(n_components, vt.shape[0])
    signs = np.sign(vt[np.arange(k), np.argmax(np.abs(vt[:k]), axis=1)])
    signs[signs == 0] = 1.0
    return xc @ (vt[:k].T * signs)


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


LAST_REDUCER = {"name": "unset", "reason": None}


def umap_reduce(combined_embeddings, n_density=15, n_viz=2):
    """Reduce combined embeddings to density and visualization dimensions.

    Per D-01, D-05: 768-dim -> 15-dim for KDE density, 2-dim for visualization.
    Uses UMAP when available, falls back to PCA if UMAP/numba crashes. Which
    reducer ran, and why UMAP was skipped, is recorded in LAST_REDUCER (and in
    the result metadata) instead of being swallowed.

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
    max_density = max(1, min(n_density, n_samples - 1, n_features))
    max_viz = max(1, min(n_viz, n_samples - 1, n_features))

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
            random_state=SEED,
            n_neighbors=n_neighbors,
        )
        reduced_density = reducer_density.fit_transform(combined_embeddings)

        reducer_viz = _umap.UMAP(
            n_components=max_viz,
            metric="cosine",
            random_state=SEED,
            n_neighbors=n_neighbors,
        )
        reduced_viz = reducer_viz.fit_transform(combined_embeddings)

        LAST_REDUCER.update(name="umap", reason=None)
        return reduced_density, reduced_viz
    except Exception as exc:  # noqa: BLE001 - umap/numba can fail in many ways
        LAST_REDUCER.update(name="pca", reason="umap unavailable: %s: %s" % (type(exc).__name__, str(exc)[:120]))

    # PCA fallback (deterministic, works everywhere)
    return pca_reduce(combined_embeddings, max_density), pca_reduce(combined_embeddings, max_viz)


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


def resolve_bandwidth(kde_bandwidth, room_reduced):
    """Bandwidth for the Gaussian KDE.

    'scott'        legacy: the bare factor n^(-1/(d+4)) used as an absolute bandwidth.
    'scott-scaled' Scott's rule proper: factor times the mean per-axis standard deviation of the
                   room points (scale-free; floor 1e-3 so a degenerate room does not divide by zero).
    FLOAT          used as given.
    """
    n_room, d = room_reduced.shape
    factor = n_room ** (-1.0 / (d + 4))
    if kde_bandwidth == "scott":
        return factor
    if kde_bandwidth == "scott-scaled":
        sd = float(np.mean(np.std(room_reduced, axis=0)))
        return factor * max(sd, 1e-3)
    return float(kde_bandwidth)


def detect_whitespace_zones(
    room_reduced, brain_reduced, brain_names, room_embeddings_full,
    kde_bandwidth="scott", knn_k=5
):
    """Detect Brain positions with low KDE density in room-artifact space.

    Per D-06, D-07, D-08:
    - Fit KDE on ROOM embeddings only (the "explored" space)
    - Evaluate density at BRAIN baseline positions
    - Brain positions with low density = whitespace zones

    This is the LEGACY rule (--gap-method legacy): a Brain framework is a gap
    when its KDE density is below the 10th percentile of the room points' own
    densities. Kept bit-for-bit in behaviour apart from the numpy KDE.

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
    bandwidth = resolve_bandwidth(kde_bandwidth, room_reduced)

    room_densities = gaussian_kde_logdensity(room_reduced, room_reduced, bandwidth)
    brain_densities = gaussian_kde_logdensity(room_reduced, brain_reduced, bandwidth)

    # Threshold: 10th percentile of room density distribution
    threshold = np.percentile(room_densities, 10)

    # k-NN density on room embeddings
    brain_knn_dists, _ = knn_distances(room_reduced, brain_reduced, min(knn_k, n_room))
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
            nearest_indices = np.argsort(dists, kind="stable")[:3]

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


# ---------------------------------------------------------------------------
# Hybrid gap detection (2026): percentile of four sparsity signals
# ---------------------------------------------------------------------------

_TOKEN_RE = re.compile(r"(?u)\b\w\w+\b")
_STOP = frozenset("""a about an and are as at be by for from has have in into is it its of on or that the this to was were with
""".split())


def _tokens(text):
    return [t for t in _TOKEN_RE.findall(str(text or "").lower()) if t not in _STOP]


def lexical_coverage(query_text, room_texts):
    """Idf-weighted fraction of the query's distinct words that occur anywhere in the
    room text, in [0, 1]. Words absent from the room get the highest idf, so a
    framework whose vocabulary the room never uses scores near 0. None when the
    query has no usable word or there is no room text."""
    q = sorted(set(_tokens(query_text)))
    docs = [set(_tokens(t)) for t in room_texts if t]
    if not q or not docs:
        return None
    n = len(docs)
    total = 0.0
    hit = 0.0
    for term in q:
        df = sum(1 for d in docs if term in d)
        idf = math.log(1.0 + (n - df + 0.5) / (df + 0.5))
        total += idf
        if df > 0:
            hit += idf
    return float(hit / total) if total > 0 else None


def gap_id_for(framework):
    """Deterministic zone id; identical to whitespace-to-graph.cjs: ws-<slug>-<md5[:8]>."""
    slug = re.sub(r"[^a-z0-9]+", "-", (framework or "unknown").lower()).strip("-")
    return "ws-%s-%s" % (slug, hashlib.md5(str(framework or "unknown").encode("utf-8")).hexdigest()[:8])


def detect_whitespace_zones_hybrid(
    room_reduced, brain_reduced, brain_names, room_embeddings_full, brain_embeddings_full,
    kde_bandwidth="scott-scaled", knn_k=5, gap_percentile=0.75, lexical_cov=None,
):
    """Rank every Brain framework by corpus-relative sparsity and return the top band.

    Signals (each converted to a percentile rank among the Brain frameworks, so
    no absolute density or similarity cutoff is involved):
      kde     low KDE density of the room at the framework position
      knn     large distance to the k-th nearest room artifact (reduced space)
      dense   low max cosine similarity to any room artifact (ORIGINAL space)
      lexical low idf-weighted word coverage of the framework's name in the room text
    gap_score = mean of the available signals; gap_percentile = percentile of
    gap_score; frameworks with gap_percentile >= `gap_percentile` are returned
    (all of them when gap_percentile is 0), most sparse first, ties by name.
    """
    n_room = room_reduced.shape[0]
    m = brain_reduced.shape[0]
    bandwidth = resolve_bandwidth(kde_bandwidth, room_reduced)
    brain_density = gaussian_kde_logdensity(room_reduced, brain_reduced, bandwidth)
    room_loo = gaussian_kde_logdensity(room_reduced, room_reduced, bandwidth, exclude_self=True) \
        if n_room > 1 else np.array([])
    dists, _ = knn_distances(room_reduced, brain_reduced, min(knn_k, n_room))
    knn_density = 1.0 / (dists[:, -1] + 1e-10)
    max_cos = cosine_similarity(brain_embeddings_full, room_embeddings_full).max(axis=1)

    comps = {
        "kde": 1.0 - empirical_percentile(brain_density),
        "knn": 1.0 - empirical_percentile(knn_density),
        "dense": 1.0 - empirical_percentile(max_cos),
    }
    lex_gap = None
    if lexical_cov is not None and all(v is not None for v in lexical_cov):
        lex_gap = 1.0 - empirical_percentile(np.asarray(lexical_cov, dtype=float))
        comps["lexical"] = lex_gap
    score = np.mean(np.vstack(list(comps.values())), axis=0)
    gp = empirical_percentile(score)

    order = sorted(range(m), key=lambda i: (-round(float(score[i]), 12), str(brain_names[i]), i))
    gaps = []
    for i in order:
        if gp[i] < gap_percentile:
            continue
        dd = np.linalg.norm(room_reduced - brain_reduced[i], axis=1)
        nearest = np.argsort(dd, kind="stable")[:3]
        dense_gap_pct = float(comps["dense"][i])
        second = {
            "method": "dense_vs_lexical_agreement" if lex_gap is not None else "dense_only",
            "dense_gap_percentile": round(dense_gap_pct, 4),
            "lexical_gap_percentile": round(float(lex_gap[i]), 4) if lex_gap is not None else None,
            "confirmed": (bool(dense_gap_pct >= 0.5 and lex_gap[i] >= 0.5) if lex_gap is not None else None),
        }
        pct_in_room = float((room_loo < brain_density[i]).mean()) if room_loo.size else None
        gaps.append({
            "brain_framework": brain_names[i],
            "density_score": float(brain_density[i]),
            "knn_density": float(knn_density[i]),
            "nearest_room_artifacts": [int(idx) for idx in nearest],
            "hypothesis": f"Room has not explored topics related to '{brain_names[i]}'",
            "strategic_rank": 0.0,
            "problem_type": "",
            # additive 2026 keys
            "gap_score": round(float(score[i]), 4),
            "gap_percentile": round(float(gp[i]), 4),
            "density_vs_room_percentile": None if pct_in_room is None else round(pct_in_room, 4),
            "dense_cosine_to_nearest_room_artifact": round(float(max_cos[i]), 4),
            "lexical_coverage": None if lexical_cov is None or lexical_cov[i] is None else round(float(lexical_cov[i]), 4),
            "signal_percentiles": {k: round(float(v[i]), 4) for k, v in comps.items()},
            "second_signal": second,
            "selection_method": "hybrid_percentile",
        })
    return gaps


def rank_by_strategic_importance(gaps, rs_data=None):
    """Boost strategic ranking of whitespace zones near RS bottlenecks.

    Per D-09: If .hsi-results.json has reverse_salients, cross-reference
    with whitespace zones. Matching zones get a strategic_rank boost.

    Args:
        gaps: list of gap dicts
        rs_data: dict from .hsi-results.json (optional). The reverse_salients
            list is read from the top level (where .hsi-results.json keeps it)
            or, for older wrapped payloads, from rs_data["data"].

    Returns:
        gaps list with strategic_rank updated
    """
    if not gaps:
        return gaps

    # Base rank = 1/(position+1)
    for i, gap in enumerate(gaps):
        gap["strategic_rank"] = 1.0 / (i + 1)

    # If RS data available, boost matching gaps
    reverse_salients = []
    if isinstance(rs_data, dict):
        if isinstance(rs_data.get("reverse_salients"), list):
            reverse_salients = rs_data["reverse_salients"]
        elif isinstance(rs_data.get("data"), dict):
            reverse_salients = rs_data["data"].get("reverse_salients", []) or []
    if reverse_salients:
        rs_sections = {}
        for rs in reverse_salients:
            key = str(rs.get("section") or rs.get("target_section") or "").lower()
            if key:
                rs_sections[key] = max(rs_sections.get(key, 0.0), float(rs.get("differential_score", 0.0) or 0.0))

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
                    gap["rs_boost"] = {"section": rs_section, "differential_score": rs_score}
                    break

    return gaps


def _read_room_texts(room_path, entries):
    """Text of each embedded artifact, read from its recorded path (empty string
    when the file is gone). Titles are appended so the lexical signal still has
    something to work with when only titles are available."""
    texts = []
    for e in entries:
        body = ""
        rel = e.get("path")
        if rel:
            try:
                body = (Path(room_path) / rel).read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                body = ""
        texts.append((str(e.get("title", "")) + "\n" + body).strip())
    return texts


def run_whitespace_analysis(room_dir, umap_dim=15, kde_bandwidth="scott-scaled", knn_k=5,
                            gap_method="hybrid", gap_percentile=0.75):
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
        gap_method: 'hybrid' (default, corpus-percentile) or 'legacy' (10th percentile of room density)
        gap_percentile: with hybrid, report frameworks at or above this gap percentile (0..1)

    Returns:
        Result dict with metadata, gaps, novelty_scores, umap_2d
    """
    room_path = Path(room_dir)
    now_iso = datetime.now(timezone.utc).isoformat()

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
                "timestamp": now_iso,
                "room_artifact_count": len(room_embs),
                "brain_baseline_count": 0,
                "umap_dims": umap_dim,
                "kde_bandwidth": str(kde_bandwidth),
                "model": model_name,
                "note": "No Brain baseline - gap detection skipped, novelty scores unavailable",
                "schema_version": SCHEMA_VERSION,
            },
            "gaps": [],
            "novelty_scores": [],
            "umap_2d": {"room": [], "brain": [], "labels_room": [], "labels_brain": []},
        }

    if room_embs.ndim != 2 or brain_embs.ndim != 2 or room_embs.shape[1] != brain_embs.shape[1]:
        shapes = (getattr(room_embs, "shape", None), getattr(brain_embs, "shape", None))
        print("Whitespace: room and Brain vectors are not comparable (shapes %s vs %s); "
              "re-embed with the same model" % shapes, file=sys.stderr)
        return _empty_result("Dimension mismatch between room embeddings %s and Brain baseline %s" % shapes)
    if not (np.isfinite(room_embs).all() and np.isfinite(brain_embs).all()):
        return _empty_result("Non-finite values in room or Brain vectors")
    bl_model = bl_data.get("metadata", {}).get("model_name", "unknown")

    # Step 2: UMAP reduction
    combined = np.vstack([room_embs, brain_embs])
    reduced_15, reduced_2 = umap_reduce(combined, n_density=umap_dim, n_viz=2)

    n_room = len(room_embs)
    room_reduced_15 = reduced_15[:n_room]
    brain_reduced_15 = reduced_15[n_room:]
    room_reduced_2 = reduced_2[:n_room]
    brain_reduced_2 = reduced_2[n_room:]

    # Brain framework names
    baselines = bl_data["baselines"]
    brain_names = [b.get("name", f"brain-{i}") for i, b in enumerate(baselines)]
    ws_embeddings_list = ws_data.get("embeddings", [])

    # Step 3+4: KDE + Gap detection
    if gap_method == "legacy":
        gaps = detect_whitespace_zones(
            room_reduced_15, brain_reduced_15, brain_names, room_embs,
            kde_bandwidth=kde_bandwidth, knn_k=knn_k,
        )
        for g in gaps:
            g["selection_method"] = "legacy_room_density_p10"
    else:
        room_texts = _read_room_texts(room_path, ws_embeddings_list)
        queries = [
            " ".join(str(b.get(k, "")) for k in ("name", "description", "summary")).strip() for b in baselines
        ]
        lex = [lexical_coverage(q, room_texts) for q in queries]
        gaps = detect_whitespace_zones_hybrid(
            room_reduced_15, brain_reduced_15, brain_names, room_embs, brain_embs,
            kde_bandwidth=kde_bandwidth, knn_k=knn_k, gap_percentile=gap_percentile, lexical_cov=lex,
        )

    # Step 5: Strategic ranking with RS data
    hsi_path = room_path / ".hsi-results.json"
    rs_data = None
    if hsi_path.exists():
        try:
            rs_data = json.loads(hsi_path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as exc:
            print("Whitespace: .hsi-results.json unreadable (%s); no RS boost applied" % exc, file=sys.stderr)

    gaps = rank_by_strategic_importance(gaps, rs_data)

    # Update nearest_room_artifacts with actual artifact info, add ids and trail
    baseline_by_name = {}
    for b in baselines:
        baseline_by_name.setdefault(b.get("name", ""), b)
    sim_room_brain = cosine_similarity(room_embs, brain_embs)
    name_index = {n: i for i, n in enumerate(brain_names)}
    for gap in gaps:
        indices = gap["nearest_room_artifacts"]
        fw = gap["brain_framework"]
        bi = name_index.get(fw)
        gap["nearest_room_artifacts"] = [
            {
                "artifact_id": ws_embeddings_list[idx]["id"],
                "title": ws_embeddings_list[idx]["title"],
                "section": ws_embeddings_list[idx].get("section", ""),
            }
            for idx in indices
            if idx < len(ws_embeddings_list)
        ]
        gap["zone_id"] = gap_id_for(fw)
        gap["gap_id"] = gap["zone_id"]
        gap["nearest_frameworks"] = [fw]
        bl_entry = baseline_by_name.get(fw, {})
        gap["source_trail"] = [{
            "source": "brain-baseline.json",
            "source_id": fw,
            "url": bl_entry.get("url"),
            "retrieved_at": (bl_data.get("metadata", {}) or {}).get("timestamp", now_iso),
            "extracted_sentence": str(bl_entry.get("description") or bl_entry.get("summary") or "")[:300],
        }] + [
            {
                "source": "whitespace-embeddings.json",
                "source_id": a["artifact_id"],
                "path": next((e.get("path") for e in ws_embeddings_list if e["id"] == a["artifact_id"]), None),
                "retrieved_at": (ws_data.get("metadata", {}) or {}).get("timestamp", now_iso),
                "cosine_to_framework": (round(float(sim_room_brain[next((k for k, e in enumerate(ws_embeddings_list)
                                         if e["id"] == a["artifact_id"]), 0), bi]), 4) if bi is not None else None),
            }
            for a in gap["nearest_room_artifacts"]
        ]
        mentioned = any(fw.lower() in str(e.get("title", "")).lower() for e in ws_embeddings_list)
        gap["novelty_check"] = {"status": "in_room_check_only", "framework_named_in_room_title": bool(mentioned),
                                "external_literature": "not_run"}

    # Step 6: Novelty scoring on original 768-dim embeddings
    novelty_scores = compute_novelty_scores(room_embs, brain_embs)
    novelty_pct = empirical_percentile(novelty_scores)

    # Find nearest brain framework for each artifact
    nearest_brain_idx = np.argmax(sim_room_brain, axis=1)

    novelty_list = []
    for i, emb_entry in enumerate(ws_embeddings_list):
        nearest_idx = int(nearest_brain_idx[i])
        pct = float(novelty_pct[i])
        novelty_list.append({
            "artifact_id": emb_entry["id"],
            "title": emb_entry.get("title", ""),
            "section": emb_entry.get("section", ""),
            "novelty_score": float(novelty_scores[i]),
            "nearest_brain_framework": brain_names[nearest_idx],
            # additive 2026 keys (aliases are what whitespace-command.cjs reads)
            "artifact": emb_entry["id"],
            "nearest_concept": brain_names[nearest_idx],
            "nearest_brain_similarity": round(float(sim_room_brain[i, nearest_idx]), 4),
            "novelty_percentile": round(pct, 4),
            "novelty_band": "novel" if pct >= 0.8 else ("moderate" if pct >= 0.4 else "covered"),
        })

    # Build result
    result = {
        "metadata": {
            "timestamp": now_iso,
            "room_artifact_count": n_room,
            "brain_baseline_count": len(brain_embs),
            "umap_dims": umap_dim,
            "kde_bandwidth": str(kde_bandwidth),
            "model": model_name,
            "schema_version": SCHEMA_VERSION,
            "gap_selection": {
                "method": gap_method,
                "gap_percentile": gap_percentile if gap_method == "hybrid" else None,
                "basis": ("mean percentile of KDE, k-NN, dense-cosine and lexical sparsity over all Brain frameworks"
                          if gap_method == "hybrid" else "KDE density below 10th percentile of room densities"),
                "gaps_reported": len(gaps),
                "frameworks_ranked": len(brain_embs),
            },
            "provenance": {
                "script": "compute-whitespace-gaps.py",
                "computed_at": now_iso,
                "reducer": LAST_REDUCER["name"],
                "reducer_note": LAST_REDUCER["reason"],
                "seed": SEED,
                "knn_k": knn_k,
                "kde_bandwidth_value": round(float(resolve_bandwidth(kde_bandwidth, room_reduced_15)), 6),
                "embedding_model_room": model_name,
                "embedding_model_brain": bl_model,
                "model_mismatch": bool(model_name != bl_model),
                "versions": {"python": sys.version.split()[0], "numpy": np.__version__},
            },
        },
        "gaps": gaps,
        "novelty_scores": novelty_list,
        "umap_2d": {
            "room": room_reduced_2.tolist(),
            "brain": brain_reduced_2.tolist(),
            "labels_room": [e.get("title", e["id"]) for e in ws_embeddings_list],
            "labels_brain": brain_names,
            # additive: the shape interpret-whitespace.cjs's anchor gate reads
            "room_artifacts": [
                {"id": e["id"], "title": e.get("title", ""), "section": e.get("section", ""),
                 "x": float(room_reduced_2[k][0]), "y": float(room_reduced_2[k][1] if room_reduced_2.shape[1] > 1 else 0.0)}
                for k, e in enumerate(ws_embeddings_list)
            ],
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
            "schema_version": SCHEMA_VERSION,
        },
        "gaps": [],
        "novelty_scores": [],
        "umap_2d": {"room": [], "brain": [], "labels_room": [], "labels_brain": []},
    }


def main(argv=None):
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
        default="scott-scaled",
        help="KDE bandwidth: scott-scaled (default, Scott's rule on the data scale), scott (legacy bare "
             "factor) or a float",
    )
    parser.add_argument(
        "--knn-k",
        type=int,
        default=5,
        help="k for k-NN density estimation (default: 5)",
    )
    parser.add_argument(
        "--gap-method",
        choices=["hybrid", "legacy"],
        default="hybrid",
        help="hybrid (default): corpus-percentile ranking of four sparsity signals; legacy: KDE density "
             "below the 10th percentile of the room's own densities",
    )
    parser.add_argument(
        "--gap-percentile",
        type=float,
        default=0.75,
        help="With --gap-method hybrid: report Brain frameworks at or above this gap percentile (default 0.75)",
    )

    args = parser.parse_args(argv)
    room_dir = Path(args.room_dir).resolve()

    if not room_dir.is_dir():
        print(f"Error: {room_dir} is not a directory", file=sys.stderr)
        sys.exit(1)
    if not (0.0 <= args.gap_percentile <= 1.0) or args.umap_dim < 1 or args.knn_k < 1:
        print("Error: --gap-percentile must be within 0..1; --umap-dim and --knn-k must be >= 1", file=sys.stderr)
        sys.exit(1)
    if args.kde_bandwidth not in ("scott", "scott-scaled"):
        try:
            if float(args.kde_bandwidth) <= 0:
                raise ValueError
        except ValueError:
            print("Error: --kde-bandwidth must be scott, scott-scaled or a positive number", file=sys.stderr)
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
        gap_method=args.gap_method,
        gap_percentile=args.gap_percentile,
    )

    # Write output atomically
    output_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = output_path.with_name(output_path.name + ".tmp-%d" % os.getpid())
    tmp.write_text(json.dumps(result, indent=2), encoding="utf-8")
    os.replace(str(tmp), str(output_path))

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
