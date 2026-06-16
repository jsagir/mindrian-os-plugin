---
phase: 160-temporal-awareness-spine
plan: 04
subsystem: temporal
tags: [bitemporal, migration, supersession, part-9-chokepoint, valid-time, last-modified]
requires:
  - "getReferenceNow() reference clock (Plan 160-01)"
  - "phase-109-nodes-provenance tightened nodes schema (created_at column)"
provides:
  - "phase-160-nodes-bitemporal migration (R7): valid_from/valid_to/invalidated_at/last_modified_at"
  - "last_modified_at write-only discipline in promoteNodeStatus (write touches, read does not)"
  - "supersede() non-lossy supersession through the navigation chokepoint (R8)"
  - "promoteNodeStatus options.now seam + optional bitemporal-close (invalidatedAt/validTo)"
affects:
  - "Plan 05 point-in-time query helper (consumes valid_from/valid_to/invalidated_at)"
  - "Wave 5 HITL gate (needs the two-axis bitemporal storage)"
tech-stack:
  added: []
  patterns:
    - "phase-109 additive-idempotent-backfill migration template (sentinel-row idempotency)"
    - "options.now clock-seam injection (D-01a) for deterministic time in node writes"
    - "supersession routes through navigation.cjs chokepoint, never a side-door DELETE"
key-files:
  created:
    - lib/core/migrations/phase-160-nodes-bitemporal.cjs
    - lib/core/migrations/phase-160-nodes-bitemporal.test.cjs
    - lib/core/temporal/supersession.cjs
    - lib/core/temporal/supersession.test.cjs
  modified:
    - lib/core/navigation/transitions.cjs
    - lib/core/room-db.cjs
    - tests/test-129.5-confirm-node.cjs
decisions:
  - "Bitemporal columns are all nullable INTEGER epoch ms, so a plain duplicate-resilient ALTER TABLE suffices - no re-create-table step (unlike phase-109 which needed CHECK constraints)"
  - "promoteNodeStatus extended with optional opts.invalidatedAt/validTo so the bitemporal close rides the SAME chokepoint UPDATE - one writer, no side-door"
  - "supersession composes confirmed->superseded via promoteNodeStatus (which already logs status_superseded through the Part 9 chokepoint), then writeEdge for SUPERSEDES B->A"
metrics:
  duration_min: 18
  completed: 2026-06-16
---

# Phase 160 Plan 04: Bitemporal Node Model + Non-Lossy Supersession Summary

The node bitemporal model and its non-lossy supersession close: an additive idempotent backfilled migration adds `valid_from/valid_to/invalidated_at/last_modified_at` to the nodes table (backfill `valid_from=created_at`, others NULL), `last_modified_at` updates on write only (not read), and `supersede()` closes a superseded fact (`invalidated_at`/`valid_to`) without ever deleting the row, routed through the Part 9 chokepoint.

## What Was Built

R7 + R8 - Wave 4 part A of the temporal spine. Generalizes the half-built Phase 150.8 edge valid-time pattern to nodes.

- **`lib/core/migrations/phase-160-nodes-bitemporal.cjs`** - the bitemporal migration, authored as the phase-109-nodes-provenance.cjs analog (Canon Part 7). `runMigration(db)` adds the four nullable INTEGER epoch-ms columns via `addColumnsIdempotent` (duplicate-column tolerant), backfills `valid_from = created_at` for every existing row (others stay NULL), adds additive indices on `valid_from` + `invalidated_at`, guards idempotency with `SENTINEL_KEY = 'phase_160_bitemporal_migration_v1'`, and wraps the whole thing in `BEGIN/COMMIT/ROLLBACK`. Because every new column is nullable, NO re-create-table step is needed (the one structural simplification over phase-109, which needed it for CHECK constraints). Exports `runMigration` + `SENTINEL_KEY`.
- **`lib/core/navigation/transitions.cjs`** - two changes, both byte-compatible for existing callers:
  - `last_modified_at` write discipline (R7): every node-WRITE branch in `promoteNodeStatus` now also sets `last_modified_at` to the reference now. A node READ never runs this UPDATE, so reading never bumps it.
  - `options.now` seam (D-01a) so the stamp is the injected `getReferenceNow` reference rather than the raw system clock, and tests inject a fixed reference.
  - Optional `opts.invalidatedAt` / `opts.validTo` (R8 bitemporal close): when supplied (only honoured on the non-confirmed branch), the SAME chokepoint UPDATE that sets `review_status='superseded'` also closes the two bitemporal axes - so the entire close stays inside the one truth-state chokepoint (no second writer, no side-door).
- **`lib/core/room-db.cjs`** - registers the migration in the `openRoomDb` composition immediately after phase-109 (so the tightened nodes table with `created_at` exists), idempotent via its own sentinel.
- **`lib/core/temporal/supersession.cjs`** - `supersede(db, oldNodeId, newNodeId, opts)`: reads `B.valid_from`, closes A (`invalidated_at=referenceNow`, `valid_to=B.valid_from`, `review_status='superseded'`) by calling `navigation.promoteNodeStatus(confirmed->superseded)` with the bitemporal-close opts (which logs a `status_superseded` memory_event through the Part 9 chokepoint), then writes a `SUPERSEDES` edge B->A via `navigation.writeEdge` (ENUM/scalar properties only, Part 8). It requires `navigation.cjs` (the chokepoint), NEVER `room-db.cjs`; it issues NO `DELETE` and NO direct `INSERT INTO nodes`. The A row PERSISTS, so a point-in-time as-of query before supersession still returns it (the as-of helper itself is Plan 05). Exports `supersede`.

## Verification Results

Actual command output:

- **Task 1 (R7)** `node --test lib/core/migrations/phase-160-nodes-bitemporal.test.cjs` -> **4 tests, 4 pass, 0 fail**:
  - adds the four bitemporal columns additively;
  - backfill `valid_from=created_at`, `valid_to`/`invalidated_at`/`last_modified_at` NULL;
  - idempotent run-twice yields identical schema + data (`r1.applied=true`, `r2.applied=false` via sentinel) with no error;
  - reading a node leaves `last_modified_at` NULL while a `promoteNodeStatus` write sets it to the injected fixed reference now.
- **Task 2 (R8)** `node --test lib/core/temporal/supersession.test.cjs` -> **4 tests, 4 pass, 0 fail**:
  - after `supersede(A,B)` the A row is STILL PRESENT with `invalidated_at` = fixed reference now and `valid_to == B.valid_from`, `review_status='superseded'`;
  - a `SUPERSEDES` edge B->A exists (source B, target A);
  - a `status_superseded` memory_event targeting A was logged through the chokepoint;
  - A row count unchanged before/after - NO DELETE happened.
- **Phase 157 Part 8 boundary scan stays GREEN**: `node tests/test-orchestration-projection-part8-boundary.cjs` -> `6 passed, 0 failed (6 checks)`.
- **Phase 160-01 reference-now Part 8 fence still green**: `node tests/test-reference-now-part8.cjs` -> `all checks PASSED`.
- **No-side-door grep** (code-only, comments stripped): zero `DELETE` / `INSERT INTO nodes` in `supersession.cjs` production code; its only `require` is `../navigation.cjs`.
- **Regression sweep (no breakage from the transitions.cjs change)**: phase-109 migration suite (idempotent/backfill/coexistence/views) 4/4; `test-129-state-transition-events.cjs` 13/13; `test-navigation-acceptance.cjs` 1/1 (zero non-SQLite reads); `test-129.5-confirm-node.cjs` 19/19 (after the audit-exclusion deviation below).
- **substrate guard** (`scripts/check-substrate.cjs`) exit 0 (informational, 184 pre-existing baseline violations); `supersession.cjs` is NOT among the chokepoint-require violations - it routes correctly through navigation.cjs. The only mention of a Plan 160-04 file is `supersession.test.cjs:38 INSERT INTO nodes`, which is test-fixture node setup (expected; production code has zero raw writes).
- **Em-dash gate**: U+2014 scan over all created/modified files -> none (hyphens only).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended the test-129.5-confirm-node source-grep audit to exclude co-located `*.test.*` files**
- **Found during:** Task 1 regression sweep.
- **Issue:** `tests/test-129.5-confirm-node.cjs` carries a source-grep audit asserting `confirmNode` is the ONLY new PRODUCTION caller of `promoteNodeStatus`. The audit walks `lib/` + `scripts/` + `commands/` and flagged the plan-specified test file `lib/core/migrations/phase-160-nodes-bitemporal.test.cjs` (which legitimately imports `promoteNodeStatus` to assert the R7 write discipline) as an "unexpected production caller." Phase 109's migration tests live under `tests/` and so were never walked by this audit; a co-located `lib/` migration test must be excluded by the same intent (a test exercising the seam is not a production caller).
- **Fix:** Added a one-line `if (/\.test\.(cjs|js|mjs)$/.test(e.name)) continue;` to the audit's walk predicate, with a comment naming the intent. This narrows the audit to its actual target (production callers) without weakening it for any real production file.
- **Files modified:** `tests/test-129.5-confirm-node.cjs`
- **Commit:** bb3e94c3

No architectural deviations (Rule 4). No new dependencies (T-160-SC slopcheck N/A). No conflict with Plan 160-03: I touched only the migrations dir, the supersession path, transitions.cjs, room-db.cjs, and the confirm-node audit; I did NOT edit room-context.cjs or the sensor registry (160-03's files - their untracked artifacts `legd-recency-golden.*` and `sensor-recency.cjs` appeared in the worktree during execution and were correctly left unstaged).

## Deferred Issues

**DI-160-04-01 (out of scope, logged to deferred-items.md):** `tests/test-129.5-truth-machine.cjs` `test_truthMachine_instrumented` fails the fs-instrument gate due to `lib/core/persona-override.cjs` (commit `dcf9450c`, unrelated to Phase 160) reading the filesystem during the confirm flow. Proven pre-existing: the test fails IDENTICALLY with origin/main's `transitions.cjs` (Plan 160-04 changes reverted). Belongs to the persona-override / t2k track, not Plan 160-04. Not fixed.

## Known Stubs

None. The migration, the write discipline, and the supersession helper are fully wired and exercised by tests. The point-in-time as-of query assertion is intentionally Plan 05's scope (R9) - this plan asserts the row state + the SUPERSEDES edge + the audit event that Plan 05's helper will read.

## Commits

- bb3e94c3: `feat(160-04): bitemporal node migration + last_modified_at write discipline (R7)`
- cdb5d5f6: `feat(160-04): non-lossy supersession through the chokepoint (R8)`

## Self-Check: PASSED

All 4 created files + 3 modified files exist on disk; both task commits (bb3e94c3, cdb5d5f6) present in git history.
