---
phase: 224-graph-derivation-harness-seed-034
plan: 01
subsystem: database
tags: [sqlite, migration, graph-derivation, review_status, embedding-classifier, cascade-edges]

# Dependency graph
requires:
  - phase: 222-ranker-weights
    provides: phase-222-ranker-weights.cjs sentinel-idempotent migration pattern (copied for D-05)
  - phase: 218-entity-extraction
    provides: openRoomDb D-05 write-safety (busy_timeout 5000, synchronous NORMAL) protecting background derivation
  - phase: 169-graph-derivation-harness
    provides: graph-derivation.cjs runDerivation composer + navigation.writeEdge chokepoint this plan extends
provides:
  - "edges.review_status column (TEXT, NULL default) on every room.db via phase-224-edge-review-status migration"
  - "writeEdge optional review_status param ('proposed'|'confirmed'), upsert never mutates it (Ralph invariant)"
  - "runDerivation writes derived edges with review_status:'proposed' as a literal column value"
  - "graph-derive-classifier.cjs: score-to-edge-type layer (CONVERGES/INFORMS only, D-01) + scoreBasedDeriveFn + pair builders"
  - "fixture-room-224.cjs: b2-journey-shaped fixture builder every later Phase 224 plan reuses"
  - "fixture-calibrated floors DERIVE_CONVERGES_FLOOR=0.55, DERIVE_INFORMS_FLOOR=0.45"
affects: [224-02-per-write-derive, 224-03-backfill-swap, 224-04-aggregate-harness]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sentinel-idempotent additive ALTER TABLE migration with defensive PRAGMA column probe (partial-migration safe)"
    - "review_status as a first-class edges column set at first-insert only; upsert never downgrades (Ralph invariant)"
    - "Thin score-to-edge-type classifier consuming scoreMeasured AS-IS; zero deps, no sqlite/navigation/backfill require"
    - "Fixture-calibrated thresholds (evidence table in module header) instead of intuition constants (D-01)"

key-files:
  created:
    - lib/core/migrations/phase-224-edge-review-status.cjs
    - lib/core/graph-derive-classifier.cjs
    - tests/helpers/fixture-room-224.cjs
    - tests/test-224-migration.cjs
    - tests/test-224-classifier.cjs
  modified:
    - lib/core/room-db.cjs
    - lib/core/navigation/edges.cjs
    - lib/core/graph-derivation.cjs

key-decisions:
  - "D-05: derived edges carry review_status as a COLUMN (navigator ruling, overrode researcher node-status recommendation)"
  - "Legacy/non-derivation edges stay review_status NULL: never retroactively demoted to proposal, never silently promoted to confirmed"
  - "D-01: score-based derivation emits CONVERGES + INFORMS only; stance types structurally excluded (precision over recall)"
  - "Floors calibrated from the fixture with the real encoder: related pair 0.6095, noise max 0.3683 -> CONVERGES 0.55 / INFORMS 0.45"

patterns-established:
  - "Pattern 1: additive column migration guarded by PRAGMA table_info probe survives a partially-migrated db"
  - "Pattern 2: derivation writer passes review_status:'proposed'; the enum-validated writeEdge upsert protects confirmed + NULL rows"
  - "Pattern 3: classifier module is import-clean (only node built-ins + rs-differential-scorer) so the Part 9 sweep stays green"

requirements-completed: ["Req 1", "Req 4"]

# Metrics
duration: 12min
completed: 2026-07-15
---

# Phase 224 Plan 01: Graph-Derivation Harness Foundations Summary

**edges.review_status column migration + additive writeEdge extension so derived edges literally carry review_status 'proposed', plus a fixture-calibrated CONVERGES/INFORMS-only score classifier consuming scoreMeasured AS-IS.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-15T09:25:16Z
- **Completed:** 2026-07-15T09:36:55Z
- **Tasks:** 2
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments
- D-05 schema foundation: every room.db opened through `openRoomDb` now carries `edges.review_status`; derived edges land `'proposed'` as a literal column value; legacy rows stay NULL; re-runs and confirmed rows are untouched (the Ralph invariant).
- D-01 classification layer: a new thin `graph-derive-classifier.cjs` maps `scoreMeasured().semantic` to CONVERGES / INFORMS / null ONLY, with the stance types (CONTRADICTS / INVALIDATES / REFINES / ROOT_CAUSES) structurally excluded, verified by a comment-stripped source grep.
- Thresholds are fixture-calibrated, not invented: the real local encoder (MongoDB/mdbr-leaf-ir, q8, 384-dim) scored the b2-journey fixture, and the observed 0.6095 related-pair vs 0.3683 noise-ceiling drove DERIVE_CONVERGES_FLOOR=0.55 / DERIVE_INFORMS_FLOOR=0.45, recorded as an evidence table in the module header.
- The shared `fixture-room-224.cjs` b2-journey fixture (21 files, structural nodes, 0 typed edges) and the O(n) / N-choose-2 pair builders every later Phase 224 plan reuses.

## Task Commits

Each task was committed atomically (TDD: RED test then GREEN implementation):

1. **Task 1 (RED): failing D-05 migration proof** - `5ce955b3` (test)
2. **Task 1 (GREEN): migration + writeEdge extension + runDerivation proposed edges** - `ef8a026c` (feat)
3. **Task 2: D-01 classifier + pair builders + b2-journey fixture** - `2eaa1b1e` (feat)

## Files Created/Modified
- `lib/core/migrations/phase-224-edge-review-status.cjs` (created) - sentinel-idempotent, transaction-wrapped, defensive-PRAGMA-guarded ALTER TABLE edges ADD COLUMN review_status; documents the NULL-is-not-a-proposal semantics.
- `lib/core/graph-derive-classifier.cjs` (created) - classifyScore + scoreBasedDeriveFn + buildNewArtifactPairs + buildAllPairs + _test; zero new deps, import-clean.
- `tests/helpers/fixture-room-224.cjs` (created) - buildFixtureRoom224 b2-journey builder (2 related paraphrases + 19 distinct domains), indexed via graph-ops.indexArtifact.
- `tests/test-224-migration.cjs` (created) - 6-behavior migration + writeEdge proof.
- `tests/test-224-classifier.cjs` (created) - behaviors 1-5 + a --calibrate mode that emits the fixture evidence.
- `lib/core/room-db.cjs` (modified) - chains runPhase224EdgeReviewStatus after runPhase222RankerWeights.
- `lib/core/navigation/edges.cjs` (modified) - writeEdge gains the optional review_status enum param; INSERT column list adds review_status; ON CONFLICT still updates properties ONLY.
- `lib/core/graph-derivation.cjs` (modified) - runDerivation's writeEdge call passes review_status:'proposed'; Pitfall-1 header comment amended per the D-05 ruling.

## Decisions Made
- Followed the plan and the D-05 navigator ruling exactly: review_status is a real edges COLUMN, not a node-only status. Did not re-litigate against the researcher's node-status recommendation (that OQ is RESOLVED in 224-CONTEXT.md).
- Existing-rows default = NULL (Claude's-discretion item, D-05), documented in the migration header: NULL is the honest "not part of the proposal lifecycle" third state, so legacy edges are neither demoted to proposals nor silently promoted to confirmed.
- Floors chosen upward-biased (precision over recall) with a clear ~0.18 margin above the highest observed noise (0.3683) and below the related pair (0.6095).

## Deviations from Plan

None - plan executed exactly as written. Both TDD tasks landed green on their specified verification commands, and all three named regression legs stayed green.

## Threat Model Coverage
- **T-224-01 (Tampering, migration):** mitigated - sentinel-idempotent + BEGIN/COMMIT/ROLLBACK + defensive PRAGMA column probe; the double-run no-op is proven by test behavior 2.
- **T-224-02 (Elevation of privilege, writeEdge review_status):** mitigated - enum validation ('proposed'/'confirmed' only, else invalid_review_status); the upsert never mutates review_status, so no writer promotes or demotes an existing row (proven by test behaviors 4-5).
- **T-224-03 (Repudiation, legacy NULL edges):** accepted by design - NULL documented as not-a-proposal in the migration header; no retroactive relabeling.
- **T-224-04 (Information disclosure, classifier reading artifact text):** mitigated - LOCAL fs reads only; comment-stripped grep confirms zero network primitives and no forbidden requires on executable lines.
- **T-224-SC (Supply chain):** mitigated - zero new dependencies; package.json / package-lock.json show no drift across the three commits.

## Issues Encountered
None. The local embedding encoder loaded cleanly (384-dim), so the D-01 calibration ran with the real encoder as required and no checkpoint was needed.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (per-write trigger) can now inject `scoreBasedDeriveFn` and write edges through the `review_status:'proposed'` contract this plan established.
- Plan 03 (backfill swap) can drive `buildAllPairs` + `scoreBasedDeriveFn` as the new default deriver over the same fixture.
- Note for Plan 02: `runDerivation`'s current `deriveForPair` treats a non-array (Promise) return as `[]`; `scoreBasedDeriveFn` is async, so the Plan 02 wiring (detached worker per D-02) must await it rather than pass it straight into the existing synchronous `runDerivation` loop.

---
*Phase: 224-graph-derivation-harness-seed-034*
*Completed: 2026-07-15*
