#!/usr/bin/env python3
"""
rs-math.py -- Shared math helpers for the Reverse Salient Engine (Phase 89)
==============================================================================

Ports the authoritative Hughes 1983 / Kwan 2023 reverse-salient algorithm into
reusable pure functions. Consumed by:
  - scripts/rs-engine.py (Plan 89-01, Mode A single-room)
  - scripts/rs-engine.py Mode B/C (Plans 89-04, 89-05)

Authoritative source: .planning/phases/89-reverse-salient-engine/source/lsa.py
(Newton Kwan et al., 2023). The distinguishing property of this algorithm is
TOPIC-KEYWORD-MEMBERSHIP COUNTING + signed abs-diff detection -- NOT
cosine-on-SVD, NOT MiniLM cosine. Do not replace these with more modern
defaults; ALGORITHM-SOURCE.md documents why the keyword-membership signal is
load-bearing.

License: BSL-1.1 (see LICENSE at repo root).
"""

from __future__ import annotations

import math
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np


# ---------------------------------------------------------------------------
# Step 1: TF-IDF + Truncated SVD
# ---------------------------------------------------------------------------

def build_tfidf_svd(
    texts: Sequence[str],
    n_components: int = 80,
    max_features: int = 2000,
    max_df: float = 0.5,
    random_state: int = 256,
) -> Tuple[object, object, object]:
    """Fit TF-IDF + TruncatedSVD on a corpus.

    Ports source/lsa.py lines 39-55 faithfully. Parameter choices
    (2000 features, max_df=0.5, 80 components, n_iter=10, seed=256) are taken
    verbatim from the authoritative source. For corpora smaller than 80 docs,
    n_components is clamped to max(1, N-1) to avoid SVD underflow.

    Returns (vectorizer, svd_model, X) where X is the sparse TF-IDF matrix.
    """
    # Imported lazily so rs-math.py can be imported without sklearn for tests
    # that exercise only abs_diff_topk / classify_direction.
    from sklearn.decomposition import TruncatedSVD
    from sklearn.feature_extraction.text import TfidfVectorizer

    vectorizer = TfidfVectorizer(
        stop_words="english",
        max_features=max_features,
        max_df=max_df,
        smooth_idf=True,
    )
    X = vectorizer.fit_transform(texts)

    n_rows, n_terms = X.shape
    effective_components = max(1, min(n_components, n_rows - 1, n_terms - 1))
    svd_model = TruncatedSVD(
        n_components=effective_components,
        algorithm="randomized",
        n_iter=10,
        random_state=random_state,
    )
    svd_model.fit(X)

    return vectorizer, svd_model, X


# ---------------------------------------------------------------------------
# Step 2: Extract top-k keywords per SVD component
# ---------------------------------------------------------------------------

def extract_topic_keywords(svd_model, terms: Sequence[str], top_k: int = 7) -> List[List[str]]:
    """For each SVD component, return the top_k terms by weight descending.

    Ports source/lsa.py lines 59-72 faithfully. `terms` is typically the
    output of `vectorizer.get_feature_names_out()`.
    """
    topics: List[List[str]] = []
    for comp in svd_model.components_:
        sorted_terms = sorted(
            zip(terms, comp), key=lambda pair: pair[1], reverse=True
        )[:top_k]
        topics.append([t for t, _ in sorted_terms])
    return topics


# ---------------------------------------------------------------------------
# Step 3: Topic-keyword-membership counting (the authoritative signature)
# ---------------------------------------------------------------------------

def count_topic_membership(
    tokenized_papers: Sequence[Sequence[str]],
    topics: Sequence[Sequence[str]],
) -> np.ndarray:
    """Count how many of each paper's tokens appear in each topic's keyword set.

    Ports source/lsa.py lines 80-98 faithfully.

    CRITICAL: this is NOT cosine-on-SVD. It measures whether papers share
    topic-level keywords (top 7 terms per SVD component). ALGORITHM-SOURCE.md
    line 72 warns that swapping this for cosine-on-SVD changes the signal
    entirely. Do not optimize this.

    Returns a (n_papers, n_topics) float32 matrix.
    """
    n_papers = len(tokenized_papers)
    n_topics = len(topics)

    # Precompute topic keyword sets for O(1) membership lookup per token.
    topic_sets = [set(t) for t in topics]

    counts = np.zeros((n_papers, n_topics), dtype=np.float32)
    for i, tokens in enumerate(tokenized_papers):
        for word in tokens:
            for j, kw_set in enumerate(topic_sets):
                if word in kw_set:
                    counts[i, j] += 1.0
    return counts


# ---------------------------------------------------------------------------
# Step 4: Row-normalize + pairwise L1 distance + invert to similarity
# ---------------------------------------------------------------------------

def normalize_and_l1_similarity(topic_count_matrix: np.ndarray, dtype=np.float32) -> np.ndarray:
    """Row-normalize, compute pairwise L1 distance, invert, and rescale.

    Ports source/lsa.py lines 102-126 faithfully. Steps:
      1. Row-normalize (each paper becomes a topic distribution summing to 1)
      2. Pairwise L1 distance via broadcast
      3. Invert: sim = max(dist) - dist (closer pairs score higher)
      4. Rescale to [0, 1] centered at 0.5

    Diagonal entries should be ~1.0 (self-similarity maximum) after rescaling.

    Returns a (N, N) float32 similarity matrix.
    """
    # 2026: computed in float64 so the result matches the CJS twin
    # (rs-math.cjs, JS numbers are float64) to ~1e-12; the float32 return type
    # is kept by default for callers that depend on it (pass dtype=np.float64
    # to keep full precision).
    matrix = np.asarray(topic_count_matrix, dtype=np.float64)
    if matrix.ndim != 2:
        raise ValueError(f"topic_count_matrix must be 2-D, got shape {matrix.shape}")
    n = matrix.shape[0]
    if n == 0:
        return np.zeros((0, 0), dtype=dtype)

    row_sums = matrix.sum(axis=1)
    # Papers with zero keyword hits would divide by zero; substitute 1.0 so the
    # row stays all-zeros after normalization (most-dissimilar bucket). This
    # matches the np.nan_to_num behavior in source/lsa.py line 106.
    safe_row_sums = np.where(row_sums == 0.0, 1.0, row_sums)
    normalized = (matrix.T / safe_row_sums).T

    # Pairwise L1 distance: |normalized[i] - normalized[j]| summed across
    # topics, same broadcast trick as the authoritative source.
    diff = np.abs(normalized[:, None, :] - normalized[None, :, :])
    sum_matrix = diff.sum(axis=2)

    # Invert so that smaller distances become larger similarities.
    sum_matrix = sum_matrix.max() - sum_matrix

    # Rescale to [0, 1] centered at 0.5 (authoritative step).
    rng = sum_matrix.max() - sum_matrix.min()
    if rng == 0:
        # Degenerate corpus (all identical) -- return identity-like matrix so
        # abs_diff_topk still produces deterministic output.
        return np.eye(n, dtype=dtype)
    midpoint = (sum_matrix.max() + sum_matrix.min()) / 2.0
    return (((sum_matrix - midpoint) / rng) + 0.5).astype(dtype)


# ---------------------------------------------------------------------------
# Step 5: abs-diff top-k iterative argmax with symmetric cleanup
# ---------------------------------------------------------------------------

def abs_diff_topk(
    lsa_matrix: np.ndarray,
    semantic_matrix: np.ndarray,
    k: int = 1000,
    skip_diagonal: bool = True,
    min_percentile: Optional[float] = None,
) -> List[Tuple[int, int, float, float]]:
    """Return the top-k pairs by |semantic - lsa| differential.

    Ports source/comparison.py lines 130-147 faithfully. The whole innovation
    detection is this single signal: where do semantic and structural
    similarity disagree most?

    Each returned tuple is (i, j, signed_diff, abs_diff) where:
      - signed_diff = semantic_matrix[i, j] - lsa_matrix[i, j]
      - abs_diff    = |signed_diff|
      - signed_diff > 0 -> structural_transfer (different words, similar meaning)
      - signed_diff < 0 -> semantic_implementation (same words, different meaning)

    `skip_diagonal=True` excludes self-pairs so (i, i) never wins. Only the
    upper triangle is considered, so (j, i) can never be reported as well.

    2026 changes (results identical to the original iterative argmax):
      - selection is one stable sort, O(n^2 log n), instead of k full-matrix
        argmax scans, O(k n^2). Order: descending abs_diff, ties by row-major
        (i, j), value must be > 0.
      - NaN differentials are never selectable (the original argmax let a NaN
        win). Matches the CJS twin.
      - `min_percentile` (0..1, optional): keep only pairs at or above that
        quantile of this corpus's own strict-upper-triangle |diff|
        distribution, replacing a fixed cutoff with a corpus-relative one.
    """
    lsa = np.asarray(lsa_matrix, dtype=np.float64)
    sem = np.asarray(semantic_matrix, dtype=np.float64)
    if lsa.shape != sem.shape:
        raise ValueError(
            f"shape mismatch: lsa {lsa.shape} vs semantic {sem.shape}"
        )
    if lsa.ndim != 2 or lsa.shape[0] != lsa.shape[1]:
        raise ValueError(f"matrices must be square 2-D, got {lsa.shape}")
    n = lsa.shape[0]
    if n < 2:
        return []
    if min_percentile is not None and not (0.0 <= float(min_percentile) <= 1.0):
        raise ValueError("min_percentile must be within [0, 1]")

    signed_diff = sem - lsa
    abs_diff = np.abs(signed_diff)

    k = max(0, min(int(k), (n * (n - 1)) // 2))

    rows, cols = np.triu_indices(n, k=1 if skip_diagonal else 0)
    vals = abs_diff[rows, cols]

    floor_value = -np.inf
    if min_percentile is not None:
        off_i, off_j = np.triu_indices(n, k=1)
        dist = abs_diff[off_i, off_j]
        floor_value = percentile_threshold(dist[np.isfinite(dist)], float(min_percentile))

    keep = vals > 0.0  # False for NaN and for zero
    rows, cols, vals = rows[keep], cols[keep], vals[keep]
    # lexsort: last key is primary -> -vals primary, then row, then col.
    order = np.lexsort((cols, rows, -vals))

    results: List[Tuple[int, int, float, float]] = []
    for idx in order:
        if len(results) >= k:
            break
        v = float(vals[idx])
        if v < floor_value:
            break
        i, j = int(rows[idx]), int(cols[idx])
        results.append((i, j, float(signed_diff[i, j]), v))
    return results


# ---------------------------------------------------------------------------
# 2026: corpus-relative (percentile / z-score) differential ranking
# ---------------------------------------------------------------------------
#
# Same definitions as the CJS twin in rs-math.cjs; cross-checked by
# rs/_tests/core/crosscheck_math.cjs on seeded data.
#
#   quantile(sorted_asc, q)         linear interpolation (numpy default)
#   percentile_rank(sorted_asc, x)  mid-rank empirical CDF in [0, 1]:
#                                   (count(< x) + 0.5 * count(== x)) / n
#   z_scores(values)                population z-scores (ddof = 0); zeros when
#                                   the deviation is 0 or the input is empty

def quantile(sorted_asc: Sequence[float], q: float) -> float:
    n = len(sorted_asc)
    if n == 0 or not math.isfinite(q):
        return float("nan")
    qq = min(1.0, max(0.0, float(q)))
    idx = (n - 1) * qq
    lo = int(math.floor(idx))
    hi = int(math.ceil(idx))
    if lo == hi:
        return float(sorted_asc[lo])
    return float(sorted_asc[lo]) + (float(sorted_asc[hi]) - float(sorted_asc[lo])) * (idx - lo)


def percentile_threshold(values: Iterable[float], q: float) -> float:
    """Quantile of an unsorted iterable (non-finite values ignored)."""
    arr = sorted(float(v) for v in values if math.isfinite(float(v)))
    return quantile(arr, q)


def percentile_rank(sorted_asc: Sequence[float], x: float) -> float:
    import bisect

    n = len(sorted_asc)
    if n == 0 or not math.isfinite(x):
        return float("nan")
    left = bisect.bisect_left(sorted_asc, x)
    right = bisect.bisect_right(sorted_asc, x)
    return (left + 0.5 * (right - left)) / n


def z_scores(values: Sequence[float]) -> List[float]:
    n = len(values)
    if n == 0:
        return []
    mean = sum(values) / n
    ss = sum((v - mean) * (v - mean) for v in values)
    sd = math.sqrt(ss / n)
    if not sd > 0:
        return [0.0] * n
    return [(v - mean) / sd for v in values]


def abs_diff_distribution(lsa_matrix: np.ndarray, semantic_matrix: np.ndarray) -> List[float]:
    """Sorted ascending |semantic - lsa| over the strict upper triangle."""
    lsa = np.asarray(lsa_matrix, dtype=np.float64)
    sem = np.asarray(semantic_matrix, dtype=np.float64)
    n = lsa.shape[0]
    if n < 2:
        return []
    i, j = np.triu_indices(n, k=1)
    d = np.abs(sem[i, j] - lsa[i, j])
    return sorted(float(v) for v in d if math.isfinite(float(v)))


def rank_pairs_by_percentile(
    lsa_matrix: np.ndarray,
    semantic_matrix: np.ndarray,
    k: int = 1000,
    min_percentile: float = 0.9,
    skip_diagonal: bool = True,
) -> List[Dict[str, float]]:
    """Corpus-relative replacement for a fixed threshold. Returns dicts
    {i, j, signed_diff, abs_diff, percentile, z_score} for pairs at or above
    the `min_percentile` quantile of this corpus's own pair distribution."""
    top = abs_diff_topk(lsa_matrix, semantic_matrix, k=k,
                        skip_diagonal=skip_diagonal, min_percentile=min_percentile)
    dist = abs_diff_distribution(lsa_matrix, semantic_matrix)
    if not dist:
        return []
    mean = sum(dist) / len(dist)
    sd = math.sqrt(sum((v - mean) * (v - mean) for v in dist) / len(dist))
    out: List[Dict[str, float]] = []
    for i, j, signed, absv in top:
        out.append({
            "i": i,
            "j": j,
            "signed_diff": signed,
            "abs_diff": absv,
            "percentile": percentile_rank(dist, absv),
            "z_score": ((absv - mean) / sd) if sd > 0 else 0.0,
        })
    return out


# ---------------------------------------------------------------------------
# Step 6: Direction classification
# ---------------------------------------------------------------------------

def classify_direction(signed_diff: float) -> str:
    """Classify an RS pair by the sign of (semantic - lsa).

    Based on ALGORITHM-SOURCE.md lines 150-153:
      - signed > 0 -> structural_transfer      (different keywords, similar meaning)
      - signed <= 0 -> semantic_implementation (same keywords, different meaning)

    The zero case is rare in practice (post-rescaling); we bucket it with
    semantic_implementation for deterministic output.
    """
    return "structural_transfer" if float(signed_diff) > 0.0 else "semantic_implementation"


# ---------------------------------------------------------------------------
# Convenience: full LSA pipeline on raw text corpus
# ---------------------------------------------------------------------------

def build_lsa_matrix(
    texts: Sequence[str],
    n_components: int = 80,
    top_k: int = 7,
    lowercase_tokens: bool = False,
) -> np.ndarray:
    """Run the full authoritative LSA pipeline end-to-end.

    Equivalent to running build_tfidf_svd + extract_topic_keywords +
    count_topic_membership + normalize_and_l1_similarity in sequence. Provided
    as a single entry point so scripts/rs-engine.py and plans 89-04/89-05 can
    call one function and not re-wire the pipeline.

    Tokenization mirrors source/lsa.py lines 14-17: simple whitespace split on
    the raw text, so topic-keyword matching compares against the same tokens
    that TF-IDF saw. Do not pre-strip punctuation (see ALGORITHM-SOURCE.md
    Pitfall 1 in RESEARCH.md line 569-573).
    """
    # lowercase_tokens (2026, default False = original behaviour): TF-IDF
    # lowercases, so topic keywords are lowercase and a capitalised token can
    # never match its own keyword under the verbatim split. Opt in to count them.
    tokenized = [(t.lower() if lowercase_tokens else t).split() for t in texts]
    vec, svd, _X = build_tfidf_svd(texts, n_components=n_components)
    topics = extract_topic_keywords(svd, vec.get_feature_names_out(), top_k=top_k)
    counts = count_topic_membership(tokenized, topics)
    return normalize_and_l1_similarity(counts)


__all__ = [
    "build_tfidf_svd",
    "extract_topic_keywords",
    "count_topic_membership",
    "normalize_and_l1_similarity",
    "abs_diff_topk",
    "classify_direction",
    "build_lsa_matrix",
    # 2026 additions (percentile mode)
    "quantile",
    "percentile_threshold",
    "percentile_rank",
    "z_scores",
    "abs_diff_distribution",
    "rank_pairs_by_percentile",
]
