---
phase: 211-eureka-generator-mvp
plan: 03
subsystem: eureka-engine
tags: [measured-differential, jaccard-v1, D-200-1, provenance, canon-part-8, canon-part-7, tdd, additive-only]
requires:
  - lib/core/eureka/embedding-spine.cjs (211-01: embedTexts, encoderProvenance, cosineSimilarity)
  - lib/core/rs-pinecone-bridge.cjs (cosineSimilarity, Part 7 reuse)
  - lib/core/rs-egress-prompts.cjs (auditQueryString / auditQueryObject, Part 8 dual-layer)
  - lib/core/rs-differential-scorer.cjs (legacy score() surface, extended additively)
provides:
  - lib/core/eureka/lexical-overlap.cjs (lexicalOverlap / tokenize / LEXICAL_METHOD / _test)
  - "scoreMeasured export on rs-differential-scorer.cjs (the D-200-1 measured path)"
  - "env var: EUREKA_DIFF_FLOOR (default 0.3, reuses DIFF_FLOOR)"
  - tests/test-211-measured-differential.cjs (10 offline contract tests)
affects:
  - 211-05 (room report + aggregator consumes scoreMeasured with opts.vectors full-matrix reuse)
  - 200 (legacy score() proven byte-compatible; measured path now sits alongside)
tech-stack:
  added: []
  patterns:
    - "pure-CJS deterministic Jaccard over normalized stopword-filtered token sets (no Python, no deps)"
    - "versioned metric tag (jaccard-v1) = frozen stopword list + frozen tokenize rules"
    - "env-string -> validated -> default resolution reused for EUREKA_DIFF_FLOOR (SEMANTIC_FLOOR precedent)"
    - "lazy-require heavy dep INSIDE the function (Canon Decision #8 graceful degradation)"
    - "Part 8 dual-layer audit mirrored from score(): pre-input scan + pre-return audit"
    - "additive-only edit to a shared surface (0 deletions; carve-out + lsaBridgeScript byte-unchanged)"
key-files:
  created:
    - lib/core/eureka/lexical-overlap.cjs
    - tests/test-211-measured-differential.cjs
  modified:
    - lib/core/rs-differential-scorer.cjs
decisions:
  - "Sentiment leg DROPPED per s11: measured formula is differential(lexical, semantic) only"
  - "The SIGN is the insight: signed_diff = semantic - lexical; >0 semantic_implementation, <0 structural_transfer"
  - "Every result provenance-tagged (model/dtype/method/date); never a bare differential number (s11, STRIDE T-211-07)"
  - "EUREKA_DIFF_FLOOR + bands are UNCALIBRATED defaults; Phase 202 APO calibrates (documented in-source)"
  - "scoreMeasured is purely additive; legacy score() contract byte-compatible (Phase 200 stays green)"
metrics:
  duration: ~20m
  tasks_completed: 2
  files_created: 2
  files_modified: 1
  completed: 2026-07-05
---

# Phase 211 Plan 03: Measured Differential (D-200-1 Swap) Summary

Turned the cross-domain differential from a remote/Python-bound pair of legs into a LOCAL, MEASURED, reproducible one. Added `scoreMeasured(a, b, opts)` to `lib/core/rs-differential-scorer.cjs` (semantic = local MiniLM cosine from the 211-01 embedding spine, lexical = a new pure-CJS `jaccard-v1` overlap), keeping the SIGN as the insight and stamping provenance on every number - all while the legacy `score()` contract stays byte-compatible (Phase 200 gate: PASS=6 FAIL=0). The decimals stop being decorative: every differential is now something you could recompute and defend.

## What Was Built

- **`lib/core/eureka/lexical-overlap.cjs`** (the no-Python lexical leg): pure CJS, zero deps, node built-ins only.
  - `tokenize(text)`: lowercase, split on non-alphanumerics, drop tokens shorter than 2 chars, drop a frozen ~60-word English stopword set. Deterministic; non-string input yields `[]`, never throws.
  - `lexicalOverlap(a, b)`: Jaccard = |intersection| / |union| over the two token SETS. Identical content vocabulary = 1.0, disjoint = 0.0, both-empty/stopword-only = 0.0 (never NaN).
  - Metric is VERSIONED as `jaccard-v1` (exported `LEXICAL_METHOD`): the tag refers to that exact frozen stopword list PLUS those exact tokenize rules, so any future change bumps to `jaccard-v2` and stored numbers stay recomputable.
  - SEED-049 D2: this retires the Python sklearn LSA spawn on the measured pair-wise path (a 2-document IDF+SVD is degenerate anyway, per the existing Part 7 carve-out). Corpus-level lexical retrieval (FTS5/BM25) is a different job in 211-02.
- **`scoreMeasured(a, b, opts)`** on `rs-differential-scorer.cjs` (purely additive section):
  - Semantic leg resolution: `opts.vectors` (the 211-05 full-matrix reuse path) > `opts.encodeFn` (test injection) > local embedding spine `embedTexts` (lazy-required inside the function for Tier-0 graceful degradation).
  - Semantic cosine via the SAME `pineconeBridge.cosineSimilarity` that `score()` trusts (Part 7 reuse, no fork).
  - `signed_diff = semantic - lexical` keeps direction: `semantic_implementation` (>0) vs `structural_transfer` (<0). `passes = abs_diff > EUREKA_DIFF_FLOOR AND the HIGH leg > 0.2`. Bands breakthrough/high/opportunity/moderate/low over `abs_diff`.
  - `provenance: { semantic_model, semantic_dtype, dim, lexical_method: 'jaccard-v1', measured_at }` on every result.
  - Encoder failure degrades to `{ semantic: null, passes: false, warning: 'encoder_unavailable' }` and NEVER throws; Part 8 violations remain the only escape route (same contract as `score()`).
  - Canon Part 8 dual-layer defense mirrored from `score()`: Layer 1 `auditQueryString` on both inputs BEFORE any compute (so the injected `encodeFn` is never reached on a forbidden input), Layer 2 `auditQueryObject` on the composite output before return.
  - `EUREKA_DIFF_FLOOR` env resolution reuses the `SEMANTIC_FLOOR` pattern (default 0.3 = `DIFF_FLOOR`; invalid value falls back to 0.3).
- **`tests/test-211-measured-differential.cjs`**: 10 offline, deterministic, network-free tests (stub encoders + injected lexical + `_forceUnavailable`). No model download, no Brain, no egress.

## Task Commits (TDD gates)

| Task | Gate | Commit | What |
|------|------|--------|------|
| 1 | RED | `1a34e7ff` | `test(211-03)`: failing tests 1-4 for lexical-overlap |
| 1 | GREEN | `b902b302` | `feat(211-03)`: lexical-overlap.cjs (jaccard-v1) |
| 2 | RED | `bcb29df0` | `test(211-03)`: failing tests 5-10 for scoreMeasured |
| 2 | GREEN | `0f4511ed` | `feat(211-03)`: scoreMeasured (measured, signed, provenance-tagged, Part 8) |

No REFACTOR gate was needed (both implementations passed clean on first GREEN).

## Behaviors Verified

- **Tests 1-4 (lexical):** identity 1.0 / disjoint 0.0; the canonical eureka pair (sleep-science circadian rhythm vs manufacturing shift scheduling) shares NO content vocabulary (0.0) after stopword removal - the eureka signal; tokenize lowercases, strips punctuation, drops stopwords, is deterministic; empty/stopword-only yields 0.0, never NaN, never throws.
- **Tests 5-10 (scoreMeasured):** near-identical semantic + low lexical -> `signed_diff ~+0.95`, `semantic_implementation`, passes, band `breakthrough`; orthogonal semantic + high lexical -> `signed_diff ~-0.8`, `structural_transfer`, passes (high leg = lexical 0.8); provenance stamped (model/dtype/`jaccard-v1`/ISO date) + `EUREKA_DIFF_FLOOR` resolution (invalid env -> 0.3, valid honored); forbidden input throws `ExternalEgressViolation` with encodeFn call-count 0; encoder-unavailable degrades without throwing; legacy `score`/`SEMANTIC_FLOOR`/`passesSemanticFloor`/`gateCandidatesBySemanticFloor` + `_test` floors (0.3/0.2/0.2) all unchanged.

## Verification

- `node tests/test-211-measured-differential.cjs` -> **10/10 PASS**, exit 0 (offline, stub legs).
- `node tests/test-200-corpus-quality.cjs` -> exit 0 (6 assertions green).
- `bash tests/run-all-200.sh` -> **PASS=6 FAIL=0 SKIP=0** (legacy contract behavior byte-compatible).
- `git diff --numstat lib/core/rs-differential-scorer.cjs` -> **184 insertions, 0 deletions** (purely additive; the CANON PART 7 CARVE-OUT header block and the embedded Python `lsaBridgeScript` are byte-unchanged).
- Acceptance greps: `scoreMeasured` code-count 2 (definition + export), `measured_at` code-count 3, `jaccard-v1` code-count 2 in lexical-overlap, zero npm requires in lexical-overlap, no em-dash in any touched file.

## Canon Compliance

- **Part 7 (Reuse Before Build):** semantic cosine uses the re-exported `pineconeBridge.cosineSimilarity` (the same function `score()` and the embedding spine use); no fork.
- **Part 8 (Graph Boundary):** the measured path is fully local (MiniLM cosine + CJS Jaccard; no Brain, no network, no Python spawn) and keeps the score() dual-layer audit. Layer 1 pre-input scan is proven to run before any leg (Test 8 call-count 0); Layer 2 pre-return audit catches anything smuggled via a leg. STRIDE T-211-06 mitigated.
- **Decision #8 (Tier-0 graceful degradation):** the embedding spine is lazy-required inside `scoreMeasured`; an absent heavy dep degrades to `encoder_unavailable` instead of failing the module load.
- **STRIDE T-211-07 (repudiation):** mandatory provenance object on every result; bands documented UNCALIBRATED in-source.
- **STRIDE T-211-08 (legacy drift):** Test 10 regression pin + run-all-200 gate + additive-only diff (0 deletions) prove no drift.

## Deviations from Plan

None - plan executed exactly as written. Both tasks followed the RED -> GREEN TDD cycle with no bugs, no missing critical functionality, and no blocking issues encountered. No architectural changes were needed.

## Known Stubs

None. The `encodeFn` / `opts.vectors` / `lexicalFn` / `_forceUnavailable` parameters are documented test-injection and reuse seams (the contract consumed by 211-05), not shipped stubs - the real local path (spine `embedTexts` + `jaccard-v1`) is the default and is exercised by the legacy-parallel Phase 200 suite plus the offline contract tests.

## Notes for Downstream Plans

- **211-05** consumes `scoreMeasured(a, b, { vectors: [vecA, vecB] })` - the full-matrix reuse path: embed each node ONCE via the spine, then reuse vectors across all pairs without re-embedding. The result shape (`semantic`, `lexical`, `signed_diff`, `abs_diff`, `direction`, `passes`, `band`, `provenance`) is the aggregator's per-pair record.
- `EUREKA_DIFF_FLOOR` (default 0.3) and the bands are UNCALIBRATED defaults; **Phase 202 (APO)** calibrates them. Do not present the current bands as validated.
- The lexical metric is versioned: if the stopword list or tokenize rules ever change, bump `LEXICAL_METHOD` to `jaccard-v2` so stored differentials remain recomputable.

## Self-Check: PASSED

- Files exist: `lib/core/eureka/lexical-overlap.cjs`, `tests/test-211-measured-differential.cjs`, `211-03-SUMMARY.md` - all FOUND.
- Commits exist: `1a34e7ff` (Task 1 RED), `b902b302` (Task 1 GREEN), `bcb29df0` (Task 2 RED), `0f4511ed` (Task 2 GREEN) - all FOUND in git log.
- Offline tests 10/10 PASS; Phase 200 regression PASS=6 FAIL=0; scorer diff additive-only (184+/0-).
