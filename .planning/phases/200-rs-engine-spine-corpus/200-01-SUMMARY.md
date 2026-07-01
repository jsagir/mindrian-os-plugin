---
phase: 200-rs-engine-spine-corpus
plan: 01
subsystem: rs-engine
tags: [reverse-salient, corpus, semantic-floor, differential-scorer, openalex, embeddings, regression-fixture]

# Dependency graph
requires:
  - phase: 140-02
    provides: the .heal-backup exclude token in scripts/rs-engine.py (the drift baseline this plan generalized)
  - phase: 89.2-06
    provides: the dual-floor differential scorer (rs-differential-scorer.cjs) the H2 gate extends additively
provides:
  - Single-source RS corpus exclude-list (lib/core/rs_corpus_exclude.py) imported by all three room walkers (drift-proof)
  - Semantic-floor gate on external returns (SEMANTIC_FLOOR, default 0.15, tunable via RS_SEMANTIC_FLOOR) in both rs_corpus.py and rs-differential-scorer.cjs
  - Non-degenerate regression fixture + assertion guarding the SEED-018 boundary-extreme collapse
affects: [200-02, 200-03, phase-205-differential-scorer, rs-engine-embedding-spine]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared exclude source imported by every walker (anti-drift by construction, not by parity test)"
    - "Pre-matrix semantic-floor gate: drop off-topic external candidates BEFORE the differential, keyed off a tunable constant"
    - "Deterministic offline stub-encoder tests (fixed-vocabulary bag-of-words) for embedding-dependent logic (Canon Part 8)"

key-files:
  created:
    - tests/test-200-corpus-quality.cjs
    - tests/fixtures/rs-corpus/known-good-topic.json
    - lib/core/rs_corpus_exclude.py  # shipped in a50044e2 (H1)
  modified:
    - lib/core/rs_corpus.py
    - lib/core/rs-differential-scorer.cjs

key-decisions:
  - "H1 root cause was walker drift, not a missing CJS exclude-list: fixed at the true site (three Python walkers -> one shared source), not the planned research-corpus.cjs surface"
  - "H2 gate is additive to the shared differential scorer (Phase-205 logic left intact) and defaults to 0.15, tunable via RS_SEMANTIC_FLOOR"
  - "fetch_external is a thin gated wrapper over fetch_corpus so existing ungated callers are unaffected (backward compatible)"

patterns-established:
  - "Anti-drift by import: walkers keep no local literal; the shared module is the only source"
  - "Embedding-dependent logic is tested with an injected deterministic stub encoder, never a live model"

requirements-completed: [SEED-018-H1, SEED-018-H2]

# Metrics
duration: ~35min
completed: 2026-07-01
---

# Phase 200 Plan 01: RS Engine Spine Corpus (SEED-018 Bug Fix) Summary

**Killed the SEED-018 degenerate-output bug at both root causes: a single-source exclude-list that ends the .heal-backup corpus inflation across all three room walkers, plus a semantic-floor gate (0.15, tunable) that drops off-topic OpenAlex returns before they poison the differential matrix - locked by a non-degenerate regression fixture.**

## Performance

- **Duration:** ~35 min (this session; H1 landed in a prior session)
- **Completed:** 2026-07-01
- **Tasks:** 4 (Tasks 1-2 shipped prior via a50044e2; Tasks 3-4 this session)
- **Files created/modified this session:** 4

## Accomplishments

- **H2 semantic-floor gate (Task 3):** off-topic external candidates (an atmospheric-remote-sensing paper on a "multi-user team collaboration" topic) are now dropped BEFORE the unified differential matrix, at both the Python fetch site and the shared CJS scorer, keyed off a tunable `SEMANTIC_FLOOR` (default 0.15).
- **H3 regression lock (Task 4):** a fixture + assertion proves the differential no longer collapses every pair to the boundary extreme (`semantic 0.0 / lsa 1.0 / signed_diff -1.0`) - the literal SEED-018 symptom.
- **H1 already shipped (Tasks 1-2):** confirmed `tests/test-200-corpus-exclude.sh` stays green; the single-source exclude-list holds.
- All new tests run offline with a deterministic stub encoder - no Brain, no live model, no network (Canon Part 8).

## Task Commits

1. **Tasks 1-2: single-source exclude-list (H1)** - `a50044e2` (fix) [prior session]
2. **Task 3: semantic-floor gate on RS external returns (H2)** - `d1b15623` (fix)
3. **Task 4: RS corpus non-degenerate regression fixture (H3)** - `8632e930` (test)

**Plan metadata:** see final `docs(200-01)` commit.

## Files Created/Modified

- `lib/core/rs-differential-scorer.cjs` - added `SEMANTIC_FLOOR`, `passesSemanticFloor`, and `gateCandidatesBySemanticFloor` (additive; reuses `rs-pinecone-bridge.cosineSimilarity` per Part 7; existing dual-floor `score()` untouched - shared surface with Phase 205).
- `lib/core/rs_corpus.py` - added `SEMANTIC_FLOOR`, `_cosine`, `semantic_gate`, and a `fetch_external` gated wrapper over `fetch_corpus` (backward compatible when no topic embedding / encoder is supplied).
- `tests/test-200-corpus-quality.cjs` - new; H2 gate assertions (CJS + Python parity) and the H3 non-degenerate regression, all with a fixed-vocabulary offline stub encoder.
- `tests/fixtures/rs-corpus/known-good-topic.json` - new; overlapping-but-distinct room artifacts + a topic with a non-degenerate `expected_pair_shape`.
- `lib/core/rs_corpus_exclude.py` - the H1 shared source (context only; not modified this session).

## Decisions Made

- **Gate defaults + tunability:** `SEMANTIC_FLOOR = 0.15`, overridable via `RS_SEMANTIC_FLOOR`, validated into `[0, 1]`. Chosen low enough to keep genuinely on-topic returns while dropping zero-overlap noise.
- **`fetch_external` over mutating `fetch_corpus`:** the gate lives in a wrapper so the tiered fetcher's early-return control flow and all existing callers stay exactly as they were.
- **Reuse over rebuild (Part 7):** the CJS gate consumes the existing `cosineSimilarity` from `rs-pinecone-bridge.cjs` rather than adding a second cosine.

## Deviations from Plan

### 1. [Reconciliation - Grounded correction to Tasks 1-2 site] H1 shipped at the true root-cause site

- **Found during:** the prior session (documented in the plan's top-of-file correction comment and the `a50044e2` commit body); reconciled here.
- **Issue:** the original Task 1-2 targeted `lib/core/research-corpus.cjs` with a `CORPUS_EXCLUDE` / `isExcludedCorpusPath` surface and a Python/CJS parity test. Grounded in the real code, that was the wrong site: `research-corpus.cjs` is an external fetcher and never touches `room_count`. The room-artifact walk lives in THREE Python walkers (`rs_hybrid.py`, `rs_rooms.py`, `scripts/rs-engine.py`), each carrying its own drifted `SKIP_DIRS` copy - `scripts/rs-engine.py` had `.heal-backup` (Phase 140-02) but the other two did not, so `--mode hybrid` walked into `.heal-backup` and inflated `room_count` to 706. **The drift was the bug.**
- **Fix:** one shared source `lib/core/rs_corpus_exclude.py` (`SKIP_DIRS` / `SKIP_FILES` / `MIN_BODY_CHARS`) imported by all three walkers with no local literal, extended with the SEED-018 tokens. This is a stronger anti-drift guarantee than a cross-language parity test. The CJS-parity task and the `.rs-engine-results-*.json` exclusion were dropped (walkers count only `.md`, so result JSONs never inflated the count).
- **Files:** `lib/core/rs_corpus_exclude.py`, `lib/core/rs_hybrid.py`, `lib/core/rs_rooms.py`, `scripts/rs-engine.py`, `tests/test-200-corpus-exclude.sh`.
- **Verification:** `bash tests/test-200-corpus-exclude.sh` green.
- **Committed in:** `a50044e2`.

### 2. [Faithful-to-plan naming] H2 site named `fetch_external`, not `load_room_artifacts`

- The plan's Task 3 referenced a `fetch_external` gate; the module's orchestrator is `fetch_corpus`. Implemented the gate as `semantic_gate` plus a `fetch_external` wrapper (matching the plan's wording) rather than renaming `fetch_corpus`. Additive and backward compatible.

---

**Total deviations:** 2 (1 grounded root-cause reconciliation carried from the prior session, 1 minor naming realization). **Impact:** the H1 correction was necessary for correctness - the originally-planned site would not have fixed the bug. No scope creep.

## Issues Encountered

None. Both new sites are additive; the shared CJS scorer was re-read immediately before editing (Phase-205 concurrent branch) and its logic was appended to, never altered.

## User Setup Required

None - no external service configuration required. `RS_SEMANTIC_FLOOR` is an optional tuning env var with a safe default.

## Next Phase Readiness

- H4/H5 (threshold ordering / encoder swap) remain explicitly deferred; the encoder swap belongs to the embedding-spine decision D-200-1 (Plans 200-02 / 200-03).
- The semantic-floor gate is wired but is a no-op until a caller supplies a topic embedding + encoder (the embedding spine). Plans 200-02/03 should pass those through so the gate becomes live in production.

## Self-Check: PASSED

- Files verified on disk: `tests/test-200-corpus-quality.cjs`, `tests/fixtures/rs-corpus/known-good-topic.json`, `lib/core/rs_corpus_exclude.py`, `200-01-SUMMARY.md` - all FOUND.
- Commits verified: `a50044e2` (H1), `d1b15623` (H2), `8632e930` (H3) - all FOUND.
- Verification: `node tests/test-200-corpus-quality.cjs` = 6 assertions green; `bash tests/test-200-corpus-exclude.sh` = green.

---
*Phase: 200-rs-engine-spine-corpus*
*Completed: 2026-07-01*
