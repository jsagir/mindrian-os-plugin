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

from typing import Iterable, List, Sequence, Tuple

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

def normalize_and_l1_similarity(topic_count_matrix: np.ndarray) -> np.ndarray:
    """Row-normalize, compute pairwise L1 distance, invert, and rescale.

    Ports source/lsa.py lines 102-126 faithfully. Steps:
      1. Row-normalize (each paper becomes a topic distribution summing to 1)
      2. Pairwise L1 distance via broadcast
      3. Invert: sim = max(dist) - dist (closer pairs score higher)
      4. Rescale to [0, 1] centered at 0.5

    Diagonal entries should be ~1.0 (self-similarity maximum) after rescaling.

    Returns a (N, N) float32 similarity matrix.
    """
    matrix = np.asarray(topic_count_matrix, dtype=np.float32)
    n = matrix.shape[0]

    row_sums = matrix.sum(axis=1)
    # Papers with zero keyword hits would divide by zero; substitute 1.0 so the
    # row stays all-zeros after normalization (most-dissimilar bucket). This
    # matches the np.nan_to_num behavior in source/lsa.py line 106.
    safe_row_sums = np.where(row_sums == 0.0, 1.0, row_sums)
    normalized = (matrix.T / safe_row_sums).T

    # Pairwise L1 distance: |normalized[i] - normalized[j]| summed across
    # topics, same broadcast trick as the authoritative source.
    diff = np.abs(normalized[:, None, :] - normalized[None, :, :])
    sum_matrix = diff.sum(axis=2).astype(np.float32)

    # Invert so that smaller distances become larger similarities.
    sum_matrix = sum_matrix.max() - sum_matrix

    # Rescale to [0, 1] centered at 0.5 (authoritative step).
    rng = sum_matrix.max() - sum_matrix.min()
    if rng == 0:
        # Degenerate corpus (all identical) -- return identity-like matrix so
        # abs_diff_topk still produces deterministic output.
        return np.eye(n, dtype=np.float32)
    midpoint = (sum_matrix.max() + sum_matrix.min()) / 2.0
    return ((sum_matrix - midpoint) / rng) + 0.5


# ---------------------------------------------------------------------------
# Step 5: abs-diff top-k iterative argmax with symmetric cleanup
# ---------------------------------------------------------------------------

def abs_diff_topk(
    lsa_matrix: np.ndarray,
    semantic_matrix: np.ndarray,
    k: int = 1000,
    skip_diagonal: bool = True,
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

    `skip_diagonal=True` zeroes out self-pairs before iteration so
    (i, i) never wins. Symmetric cleanup ensures (j, i) is suppressed when
    (i, j) is selected, preventing duplicate reporting.
    """
    lsa = np.asarray(lsa_matrix, dtype=np.float64)
    sem = np.asarray(semantic_matrix, dtype=np.float64)
    if lsa.shape != sem.shape:
        raise ValueError(
            f"shape mismatch: lsa {lsa.shape} vs semantic {sem.shape}"
        )
    n = lsa.shape[0]
    if n < 2:
        return []

    signed_diff = sem - lsa
    abs_diff = np.abs(signed_diff).copy()

    if skip_diagonal:
        np.fill_diagonal(abs_diff, -np.inf)

    # Upper triangle only: symmetric matrix means (i,j) == (j,i); the
    # authoritative source handles this by suppressing the mirror after each
    # pick. We precompute mask so argmax never returns lower-triangle.
    iu = np.tril_indices(n, k=-1)
    abs_diff[iu] = -np.inf

    results: List[Tuple[int, int, float, float]] = []
    k = max(0, min(k, (n * (n - 1)) // 2))
    for _ in range(k):
        flat_index = int(np.argmax(abs_diff))
        i, j = np.unravel_index(flat_index, abs_diff.shape)
        max_val = float(abs_diff[i, j])
        if max_val == -np.inf or max_val <= 0.0:
            break
        results.append((int(i), int(j), float(signed_diff[i, j]), float(max_val)))
        # Symmetric cleanup: source/comparison.py lines 145-146 subtract the
        # max-val so the mirror never wins next iteration. We mask to -inf
        # directly since we already restrict to upper triangle.
        abs_diff[i, j] = -np.inf
        abs_diff[j, i] = -np.inf

    return results


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

def build_lsa_matrix(texts: Sequence[str], n_components: int = 80, top_k: int = 7) -> np.ndarray:
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
    tokenized = [t.split() for t in texts]
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
]
