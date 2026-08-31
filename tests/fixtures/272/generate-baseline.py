#!/usr/bin/env python3
"""
tests/fixtures/272/generate-baseline.py
========================================

Standalone ARPACK baseline capture script (Phase 272, PYPORT-05, D-03).

Runs the authoritative lib/core/rs_math.py pipeline against
tests/fixtures/272/room, with TruncatedSVD(algorithm="arpack") substituted
for the shipped TruncatedSVD(algorithm="randomized", n_iter=10) combination
-- for BASELINE CAPTURE ONLY. All other parameters (n_components=80,
max_features=2000, max_df=0.5, smooth_idf=True, random_state=256) stay
IDENTICAL to the shipped values. The shipped Python fallback
(lib/core/rs_math.py) is NOT modified by this script and stays unchanged
(Pitfall 1, D-04, D-05).

Why ARPACK: RESEARCH.md Finding F-1 measured, live, that the shipped
n_iter=10 randomized SVD has NOT converged for this problem shape -- two
Python runs with different seeds disagree on 16-45% of topic keywords on
proxy corpora. ARPACK is measured deterministic (seed-to-seed overlap 1.0).
Gating a mathematically correct CJS port against the under-converged
randomized baseline would fail the gate for the wrong reason.

This script does two things, per RESEARCH.md's Wave 0 Gaps (a MEASUREMENT
task, not just a build task):

  1. Captures the ARPACK baseline (run 1) -> baseline-python.fixture.json.
  2. Re-runs the ARPACK LSA pipeline a SECOND time against the SAME fixture
     room (the semantic/embedding leg is computed once and reused, since it
     is deterministic given a fixed model and fixed input order -- the only
     source of possible run-to-run variance is the SVD leg) and measures the
     actual top-50 pair-overlap and max signed_diff delta between run 1 and
     run 2. This measured number -- NOT an inherited, unjustified 0.80 from
     an unrelated phase (127.1) -- is what sets RANK_AGREEMENT_GATE_THRESHOLD,
     written to NOISE-FLOOR.md and noise-floor.json.

Writes:
  - tests/fixtures/272/baseline-python.fixture.json
  - tests/fixtures/272/NOISE-FLOOR.md
  - tests/fixtures/272/noise-floor.json (machine-readable sibling, read
    programmatically by tests/272-rank-agreement.test.cjs)

Run: python3 tests/fixtures/272/generate-baseline.py
Requires: sklearn 1.8.0, numpy 2.2.6, sentence-transformers 5.3.0 (all
confirmed present on this dev machine, all-MiniLM-L6-v2 already cached
locally -- no network egress).

No em-dashes (CLAUDE.md HARD RULE). Use hyphens.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import numpy as np

_THIS_FILE = Path(__file__).resolve()
_REPO_ROOT = _THIS_FILE.parent.parent.parent.parent  # tests/fixtures/272/generate-baseline.py -> repo root
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from lib.core.rs_math import (  # noqa: E402
    abs_diff_topk,
    classify_direction,
    count_topic_membership,
    extract_topic_keywords,
    normalize_and_l1_similarity,
)
from lib.core.rs_corpus_exclude import SKIP_DIRS, SKIP_FILES  # noqa: E402

ROOM_DIR = _THIS_FILE.parent / "room"  # tests/fixtures/272/room
BASELINE_PATH = _THIS_FILE.parent / "baseline-python.fixture.json"
NOISE_FLOOR_MD_PATH = _THIS_FILE.parent / "NOISE-FLOOR.md"
NOISE_FLOOR_JSON_PATH = _THIS_FILE.parent / "noise-floor.json"

# Parameters IDENTICAL to lib/core/rs_math.py's build_tfidf_svd -- only the
# SVD algorithm changes (randomized -> arpack), per Pitfall 1.
N_COMPONENTS = 80
MAX_FEATURES = 2000
MAX_DF = 0.5
RANDOM_STATE = 256
TOP_K_KEYWORDS = 7
FULL_K = 2000  # covers the full fixture room (96 artifacts); abs_diff_topk clamps to n*(n-1)/2 anyway.


# --- discover_artifacts (duplicated minimal walk, matches scripts/rs-engine.py) --------------

def extract_title(content: str, filepath: Path) -> str:
    match = re.search(r"^# (.+)$", content, re.MULTILINE)
    if match:
        return match.group(1).strip()
    return filepath.stem.replace("-", " ").title()


def extract_body(content: str) -> str:
    fm_match = re.match(r"^---\n[\s\S]*?\n---\n?", content)
    if fm_match:
        return content[fm_match.end():]
    return content


def discover_artifacts(room_dir: Path):
    """Duplicate of scripts/rs-engine.py's discover_artifacts (identical
    contract: skip SKIP_DIRS/SKIP_FILES, skip room-root files, skip bodies
    under 50 chars, artifact_id = <section>/<filename-stem>). Duplicated
    rather than imported so this standalone baseline-capture script does not
    pull in rs-engine.py's much heavier import surface (ensure_ml_deps,
    rs_corpus, rs_rooms, rs_hybrid, rs_cache, the sqlite3 edge writer), none
    of which baseline capture against tests/fixtures/272/room needs.
    """
    artifacts = []
    room_path = room_dir.resolve()
    for root, dirs, files in os.walk(room_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        rel_root = Path(root).relative_to(room_path)
        if str(rel_root) == ".":
            continue
        section = str(rel_root).split(os.sep)[0]
        for fname in sorted(files):
            if not fname.endswith(".md"):
                continue
            if fname in SKIP_FILES:
                continue
            fpath = Path(root) / fname
            try:
                content = fpath.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            body = extract_body(content).strip()
            if len(body) < 50:
                continue
            artifact_id = str(rel_root / Path(fname).stem).replace(os.sep, "/")
            artifacts.append({
                "id": artifact_id,
                "section": section,
                "title": extract_title(content, fpath),
                "path": str(fpath.relative_to(room_path)),
                "text": body,
            })
    return artifacts


# --- ARPACK-substituted LSA pipeline (baseline capture only) ---------------------------------

def build_tfidf_svd_arpack(
    texts,
    n_components: int = N_COMPONENTS,
    max_features: int = MAX_FEATURES,
    max_df: float = MAX_DF,
    random_state: int = RANDOM_STATE,
):
    """Same as lib.core.rs_math.build_tfidf_svd, EXCEPT algorithm="arpack"
    instead of the shipped algorithm="randomized", n_iter=10. All other
    parameters are IDENTICAL to the shipped values -- this is a baseline
    capture substitution only (Pitfall 1); the shipped Python fallback is
    untouched by this file.
    """
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
    assert effective_components == 80, (
        f"expected tests/fixtures/272/room to clamp n_components at 80 "
        f"(the whole point of the >=90-artifact fixture room), got "
        f"{effective_components} (n_rows={n_rows}, n_terms={n_terms}) -- "
        "re-check tests/fixtures/272/build-fixture-room.cjs's vocabulary size"
    )
    svd_model = TruncatedSVD(
        n_components=effective_components,
        algorithm="arpack",
        random_state=random_state,
    )
    svd_model.fit(X)
    return vectorizer, svd_model, X


def build_lsa_matrix_arpack(texts, n_components: int = N_COMPONENTS, top_k: int = TOP_K_KEYWORDS):
    tokenized = [t.split() for t in texts]
    vec, svd, _X = build_tfidf_svd_arpack(texts, n_components=n_components)
    topics = extract_topic_keywords(svd, vec.get_feature_names_out(), top_k=top_k)
    counts = count_topic_membership(tokenized, topics)
    return normalize_and_l1_similarity(counts)


def embed_local_minilm(texts):
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer("all-MiniLM-L6-v2")
    vectors = model.encode(list(texts), show_progress_bar=False)
    return np.asarray(vectors, dtype=np.float32)


def semantic_similarity_matrix(embeddings):
    from sklearn.metrics.pairwise import cosine_similarity

    sim = cosine_similarity(embeddings)
    return np.clip(sim, 0.0, 1.0).astype(np.float32)


def build_pairs(artifacts, lsa_matrix, sem_matrix, k: int = FULL_K):
    top_pairs = abs_diff_topk(lsa_matrix, sem_matrix, k=k)
    pair_dicts = []
    for i, j, signed, absv in top_pairs:
        a_i, a_j = artifacts[i], artifacts[j]
        pair_dicts.append({
            "source_artifact_id": a_i["id"],
            "source_title": a_i["title"],
            "source_section": a_i["section"],
            "target_artifact_id": a_j["id"],
            "target_title": a_j["title"],
            "target_section": a_j["section"],
            "lsa_score": round(float(lsa_matrix[i, j]), 4),
            "semantic_score": round(float(sem_matrix[i, j]), 4),
            "signed_diff": round(float(signed), 4),
            "abs_diff": round(float(absv), 4),
            "direction": classify_direction(signed),
        })
    return pair_dicts


def top50_pair_id_set(pair_dicts):
    ranked = sorted(pair_dicts, key=lambda p: p["abs_diff"], reverse=True)[:50]
    return set((p["source_artifact_id"], p["target_artifact_id"]) for p in ranked)


def main():
    print(f"generate-baseline: discovering artifacts under {ROOM_DIR}")
    artifacts = discover_artifacts(ROOM_DIR)
    print(f"generate-baseline: {len(artifacts)} artifacts discovered")
    assert len(artifacts) >= 90, f"expected >=90 artifacts, found {len(artifacts)}"

    texts = [f"{a['title']}\n{a['text']}" for a in artifacts]

    print("generate-baseline: computing embeddings via local MiniLM (deterministic, computed once)")
    embeddings = embed_local_minilm(texts)
    sem_matrix = semantic_similarity_matrix(embeddings)

    print("generate-baseline: run 1 -- ARPACK LSA pipeline (this is the captured baseline)")
    lsa_matrix_1 = build_lsa_matrix_arpack(texts)
    pairs_1 = build_pairs(artifacts, lsa_matrix_1, sem_matrix)

    print("generate-baseline: run 2 -- ARPACK LSA pipeline against the SAME fixture room (noise-floor measurement)")
    lsa_matrix_2 = build_lsa_matrix_arpack(texts)
    pairs_2 = build_pairs(artifacts, lsa_matrix_2, sem_matrix)

    # --- Noise-floor measurement: Python (ARPACK) vs itself, on THIS room ---
    top50_1 = top50_pair_id_set(pairs_1)
    top50_2 = top50_pair_id_set(pairs_2)
    overlap = len(top50_1 & top50_2) / 50.0

    by_key_1 = {(p["source_artifact_id"], p["target_artifact_id"]): p["signed_diff"] for p in pairs_1}
    max_delta = 0.0
    for p in pairs_2:
        key = (p["source_artifact_id"], p["target_artifact_id"])
        if key in by_key_1:
            d = abs(p["signed_diff"] - by_key_1[key])
            if d > max_delta:
                max_delta = d

    print(f"generate-baseline: measured top-50 pair overlap (ARPACK run1 vs run2) = {overlap:.4f}")
    print(f"generate-baseline: measured max signed_diff delta (shared pairs) = {max_delta:.6f}")

    # Gate threshold: at or slightly below the measured overlap (conservative
    # rounding to two decimals), never above it (Pitfall 1's failure mode).
    threshold = round(max(0.0, overlap - 0.05), 2)
    print(f"generate-baseline: RANK_AGREEMENT_GATE_THRESHOLD = {threshold}")
    assert threshold <= overlap, "gate threshold must never exceed the measured noise floor (Pitfall 1)"

    # --- Write baseline-python.fixture.json (run 1's pairs = the canonical captured baseline) ---
    baseline = {
        "schema_version": "1",
        "phase": "272",
        "purpose": (
            "ARPACK-regenerated Python ground truth for the D-03 rank-agreement "
            "gate (PYPORT-05). algorithm=\"arpack\" substituted for the shipped "
            "algorithm=\"randomized\", n_iter=10 combination -- baseline capture "
            "ONLY. The shipped Python fallback (lib/core/rs_math.py) is unchanged."
        ),
        "source": "tests/fixtures/272/room",
        "generated_by": "tests/fixtures/272/generate-baseline.py",
        "embedding_model": "all-MiniLM-L6-v2",
        "svd_algorithm": "arpack",
        "n_components": 80,
        "artifact_count": len(artifacts),
        "pairs": pairs_1,
    }
    BASELINE_PATH.write_text(json.dumps(baseline, indent=2) + "\n", encoding="utf-8")
    print(f"generate-baseline: wrote {len(pairs_1)} pairs to {BASELINE_PATH}")

    # --- Write NOISE-FLOOR.md ---
    noise_floor_md = f"""# Phase 272 Noise Floor -- Measured, Not Assumed

PYPORT-05 / D-03. This file documents the MEASURED Python-vs-itself
rank-agreement noise floor on the real Phase 272 fixture room
(`tests/fixtures/272/room`, {len(artifacts)} artifacts), and the
`RANK_AGREEMENT_GATE_THRESHOLD` derived from it.

Generated by `tests/fixtures/272/generate-baseline.py`. Re-run that script to
regenerate this file if the fixture room ever changes.

## Why this measurement exists

RESEARCH.md's Wave 0 Gaps explicitly separate "measurement" from "build": the
rank-agreement gate threshold must trace to a measured noise floor on THIS
fixture room, not be inherited from an unrelated phase's threshold (Phase
127.1's `>= 0.80`) without justification. Setting the gate above the measured
noise floor would fail a mathematically correct CJS port for the wrong reason
(Pitfall 1) -- exactly the failure mode the shipped `n_iter=10` randomized SVD
would have caused if used as the baseline (see Finding F-1: two randomized
runs disagreed on 16-45% of topic keywords on proxy corpora).

## Method

1. Compute the semantic-leg embeddings ONCE (local MiniLM, deterministic
   given a fixed model and fixed input order -- no source of run-to-run
   variance here).
2. Run the ARPACK-substituted LSA pipeline (`algorithm="arpack"`, all other
   parameters identical to the shipped `rs_math.py` values) TWICE against the
   SAME fixture room. ARPACK is measured deterministic across seeds
   (RESEARCH.md F-1: "ARPACK seed-to-seed: identical (1.0)"), so the only
   question this measurement answers is whether that determinism holds, in
   practice, on THIS room's actual matrix shape and content -- not assumed
   from a different, proxy corpus.
3. Compute top-50 pair-id-set overlap (by `abs_diff`, ranked, top 50) between
   run 1 and run 2.
4. Compute the maximum per-pair `signed_diff` delta among pairs shared by
   both runs' top-50 sets.

## Measured numbers

- **Top-50 pair overlap (ARPACK run 1 vs run 2):** `{overlap:.4f}`
- **Max signed_diff delta (shared pairs):** `{max_delta:.6f}`
- **Artifact count:** {len(artifacts)}
- **n_components:** 80 (verified clamped, not n_rows - 1 -- see
  `build_tfidf_svd_arpack`'s assertion)

## Justified gate threshold

```
RANK_AGREEMENT_GATE_THRESHOLD = {threshold}
```

The threshold is set at or below the measured overlap ({overlap:.4f}),
rounded down by 0.05 for a conservative margin. This gives the CJS port real
headroom for legitimate numerical-library differences (a different SVD
implementation, different floating-point summation order) WITHOUT accepting
a broken port -- and it is never set above what Python agrees with itself on
this exact room, which is the concrete rule Pitfall 1 exists to enforce.

`tests/272-rank-agreement.test.cjs` reads this threshold PROGRAMMATICALLY
from `noise-floor.json` (the machine-readable sibling of this file), not as a
hardcoded duplicate literal -- if this file is ever regenerated with a
different measured overlap, the test picks up the new threshold automatically
rather than silently using a stale copy.
"""
    NOISE_FLOOR_MD_PATH.write_text(noise_floor_md, encoding="utf-8")
    print(f"generate-baseline: wrote {NOISE_FLOOR_MD_PATH}")

    noise_floor_json = {
        "schema_version": "1",
        "phase": "272",
        "fixture_room": "tests/fixtures/272/room",
        "artifact_count": len(artifacts),
        "measured_top50_overlap_arpack_vs_arpack": overlap,
        "measured_max_signed_diff_delta": max_delta,
        "RANK_AGREEMENT_GATE_THRESHOLD": threshold,
        "generated_by": "tests/fixtures/272/generate-baseline.py",
    }
    NOISE_FLOOR_JSON_PATH.write_text(json.dumps(noise_floor_json, indent=2) + "\n", encoding="utf-8")
    print(f"generate-baseline: wrote {NOISE_FLOOR_JSON_PATH}")

    print("generate-baseline: done.")


if __name__ == "__main__":
    main()
