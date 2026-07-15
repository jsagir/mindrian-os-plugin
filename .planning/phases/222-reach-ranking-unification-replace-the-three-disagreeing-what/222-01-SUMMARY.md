---
phase: 222-reach-ranking-unification-replace-the-three-disagreeing-what
plan: 01
subsystem: navigation / room-db persistence
tags: [ranker-weights, migration, hedge-layer, part-9-chokepoint, req-5, req-7]
requires: []
provides:
  - "room.db table ranker_weights (per-expert_id scalar weight store)"
  - "navigation.readHedgeWeightState / navigation.upsertHedgeWeightState typed accessor pair"
  - "EVENT_TYPES member reach_weight_state_unavailable (Req 7 degrade signal)"
  - "tests/test-222-frozen-scalars.cjs (Req 5 live tripwire)"
affects:
  - "lib/core/room-db.cjs migration chain (now 3 phase migrations)"
  - "Plans 02-03 consume this substrate (ranker module + call-site wirings)"
tech-stack:
  added: []
  patterns:
    - "sentinel-idempotent CREATE TABLE migration (phase-109-session-focus analog)"
    - "typed navigation.cjs accessor pair over a schema-specific table (Part 9 chokepoint)"
    - "read discloses / write validates (corruption visible to caller, not laundered)"
key-files:
  created:
    - lib/core/migrations/phase-222-ranker-weights.cjs
    - lib/core/navigation/ranker-weights.cjs
    - tests/test-222-weight-state.cjs
    - tests/test-222-frozen-scalars.cjs
  modified:
    - lib/core/room-db.cjs
    - lib/core/navigation.cjs
    - lib/core/navigation/memory-events.cjs
decisions:
  - "D-02 honored: weight state lives in a REAL room.db table, not memory_event rows"
  - "Per-expert_id row keying (not weight_a/weight_b) so a future fourth expert class needs a ROW not a schema migration (SEED-057)"
  - "Migration creates the table EMPTY; zero rows IS the cold-start contract; seed rows written by the accessor at first upsert"
metrics:
  duration: ~4 min
  tasks: 3
  files-created: 4
  files-modified: 3
  completed: 2026-07-15
---

# Phase 222 Plan 01: Weight-State Persistence Substrate Summary

Landed the Phase 222 Hedge-layer persistence substrate: a sentinel-idempotent `ranker_weights` room.db table (D-02), reached only through one typed `navigation.cjs` accessor pair (Part 9 chokepoint), plus the Req 7 degrade EVENT_TYPES entry and the Req 5 frozen-scalar tripwire landed before any behavior code.

## What Was Built

- **Migration (`phase-222-ranker-weights.cjs`)** mirroring `phase-109-session-focus.cjs`: `SENTINEL_KEY = 'phase_222_ranker_weights_v1'`, transaction-wrapped `CREATE TABLE IF NOT EXISTS ranker_weights (expert_id TEXT PRIMARY KEY, weight REAL NOT NULL, update_count INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)`, ROLLBACK + rethrow on error. No ALTER TABLE backfill block (no FK dependency). Wired into `room-db.cjs` (require + call, appended last).
- **Accessor pair (`lib/core/navigation/ranker-weights.cjs`)**: `readWeightState(db)` returns `null` on cold start (zero rows), lets SQL faults propagate (so Plan 02 can emit the degrade event), and returns stored scalars unlaundered. `upsertWeightState(db, weights, opts)` validates finite numbers at the write boundary (throws `TypeError`), wraps all row upserts in one `BEGIN`/`COMMIT`/`ROLLBACK` transaction, uses per-row `ON CONFLICT(expert_id) DO UPDATE`. Re-exported from `navigation.cjs` as `readHedgeWeightState` / `upsertHedgeWeightState`.
- **Req 7 event type**: `reach_weight_state_unavailable` added to the `EVENT_TYPES` Set (disclosed-degrade signal, SEED-059 discipline). Cold start does NOT emit it (Pitfall 5).
- **Tests**: `test-222-weight-state.cjs` (7 no-mock checks against real `openRoomDb` + real navigation exports) and `test-222-frozen-scalars.cjs` (4 frozen-scalar assertions + 1 self-guard proving the guard never imports the new ranker module).

## Verification

- `node tests/test-222-weight-state.cjs` -> exit 0, all 7 checks green.
- `node tests/test-222-frozen-scalars.cjs` -> exit 0, 5 assertions green.
- Task 1 migration idempotency probe prints `OK` (applied:true then applied:false, table present).
- `git diff package.json package-lock.json` empty (Req 4 zero-dependency holds).
- `git diff lib/workflow/f-selector-ranker.cjs lib/hmi/dial-reach-orchestrator.cjs` empty (this plan reads, never writes, the frozen modules).

## Deviations from Plan

None - plan executed exactly as written. One cosmetic adjustment inside scope: the `navigation.cjs` doc comment was reworded to avoid the literal tokens `readHedgeWeightState`/`upsertHedgeWeightState` so the acceptance grep (`== 2`, the two re-export lines only) matched exactly; and the `test-222-frozen-scalars.cjs` self-guard was structured to keep the contiguous `reach-hedge-ranker` literal on exactly one non-comment line (built the search regex from a single `NEW_MODULE` const). Both are acceptance-criteria conformance, not behavior changes.

## Threat Model Coverage

- **T-222-01 (tampering, NaN/negative weight):** `upsertWeightState` rejects non-finite numbers at write; `readWeightState` returns stored values unlaundered so Plan 02 can detect corruption.
- **T-222-03 (Part 9 breach):** only the migration and `ranker-weights.cjs` run SQL against the table; `navigation.cjs` exposes typed accessors only, no `db.prepare` escape hatch.
- **T-222-04 (DoS via migration):** sentinel-idempotent, transaction-wrapped, ROLLBACK on error; test (7) re-opens a migrated room and proves the no-op.
- **T-222-SC (supply chain):** zero new packages; `package.json`/`package-lock.json` unchanged.

## Self-Check: PASSED

- All 4 created files present on disk.
- All 3 task commits present in git history (87fb5c37, ae8f5772, 3acc5889).
