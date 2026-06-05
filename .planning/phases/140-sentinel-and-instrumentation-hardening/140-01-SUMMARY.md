---
phase: 140-sentinel-and-instrumentation-hardening
plan: 01
subsystem: database
tags: [sqlite, room.db, node-sqlite, hsi, lazygraph, phase-109-provenance, scout, node-test]

# Dependency graph
requires:
  - phase: 109-sql-context-memory-navigation-spine
    provides: the Phase-109 nodes-provenance migration (source_path/created_by/created_at/last_seen_at NOT NULL + created_by CHECK) that the bare 3-col insert violated
provides:
  - lib/core/node-insert.cjs -- one shared NOT-NULL-safe node-insert helper (insertNode)
  - both-schema (migrated + un-migrated) node writes across all four bare-3-col sites
  - scout HSI-to-graph step that surfaces write failures instead of swallowing them
affects: [140-02, 140-03, 140-04, 145-scheduled-sensors, hsi-to-graph, lazygraph-ops, scout]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single NOT-NULL-safe node-insert chokepoint (insertNode) routed by all node-write sites (Canon Part 7 reuse-before-build)"
    - "PRAGMA table_info(nodes) runtime schema-detection for both-schema (migrated + un-migrated) safety"
    - "Unmask-not-swallow: if ! cmd; then advisory >&2; fi keeps a step non-fatal while surfacing stderr + exit"

key-files:
  created:
    - lib/core/node-insert.cjs
    - lib/core/hsi-to-graph.test.cjs
  modified:
    - scripts/hsi-to-graph.cjs
    - lib/core/lazygraph-ops.cjs
    - commands/scout.md

key-decisions:
  - "D-02: fix the whole bug-class via ONE shared helper; route all 4 bare-3-col inserts through insertNode"
  - "D-02a: PRAGMA table_info(nodes) detect -- wide insert on migrated schema, legacy 3-col on un-migrated; no migrate-then-write side effect imposed on the caller"
  - "created_by='system' (Phase-109 CHECK), source_path='system:hsi-to-graph' synthetic handle; system-bookkeeping nodes per Canon Part 9"
  - "D-03: replace 2>/dev/null || true with an if/fi that surfaces stderr + prints a degraded-step advisory, staying non-fatal"

patterns-established:
  - "insertNode(conn, id, type, properties, overrides) is the only sanctioned nodes-table upsert primitive going forward"
  - "Both-schema detection lives in the helper, not at the call sites"

requirements-completed: [HARD-02]

# Metrics
duration: 4min
completed: 2026-06-05
---

# Phase 140 Plan 01: NOT-NULL-Safe Node Insert + Scout Unmask Summary

**One shared PRAGMA-detected NOT-NULL-safe insertNode helper closes HARD-02 across all four bare-3-column node-write sites (both migrated and un-migrated room.db), and the scout HSI-to-graph step no longer swallows its write failure.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-05T03:54:17Z
- **Completed:** 2026-06-05T03:58:10Z
- **Tasks:** 3 (Task 1 + Task 2 are TDD: RED then GREEN)
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- Created `lib/core/node-insert.cjs`: the single NOT-NULL-safe node-insert chokepoint (D-02), both-schema safe via `PRAGMA table_info(nodes)` (D-02a).
- Routed all four bare-3-column node inserts through `insertNode`: the Section upserts in `scripts/hsi-to-graph.cjs` and the three siblings in `lib/core/lazygraph-ops.cjs` (`_indexArtifactBody` Artifact + Section, `createCausalClaim`, `addWhitespaceZone`).
- HARD-02 regression test (`lib/core/hsi-to-graph.test.cjs`) proves the writer lands its nodes with no `NOT NULL constraint failed: nodes.source_path` on a migrated room.db AND with no error on an un-migrated 3-col room.db, and that the migrated nodes carry `source_path='system:hsi-to-graph'` + `created_by='system'`.
- Unmasked the scout HSI-to-graph step (D-03): removed the `2>/dev/null || true` swallow; stderr now surfaces and a non-zero exit prints a visible degraded-step advisory while the scout run stays non-fatal.
- Proved both-schema safety against the real un-migrated dogfood room (`~/MindrianRooms/mindrianOS/.mindrian/room.db`) read-only: it is 3-col and `isMigratedSchema` correctly returns false.

## Task Commits

Each task was committed atomically to `main`:

1. **Task 1: HARD-02 both-schema regression test (RED)** - `78486aa2` (test)
2. **Task 2: shared NOT-NULL-safe helper + 4 sites routed (GREEN)** - `fa0e238b` (feat)
3. **Task 3: unmask scout HSI-to-graph write failure** - `89fd4c15` (fix)

_Task 1 and Task 2 form the TDD RED -> GREEN cycle for the helper._

## Files Created/Modified

- `lib/core/node-insert.cjs` (created) - The shared `insertNode` helper. Detects the migrated provenance schema via `PRAGMA table_info(nodes)` and builds the wide NOT-NULL insert (source_path/created_by/created_at/last_seen_at, review_status DEFAULT) on a migrated db or the legacy 3-col insert on an un-migrated db; preserves ON CONFLICT(id) DO UPDATE upsert semantics.
- `lib/core/hsi-to-graph.test.cjs` (created) - node:test suite: Test A (migrated, no NOT NULL fail), Test B (un-migrated, no error), Test C (system provenance scalars), plus an upsert idempotency test. Fixtures under os.tmpdir only.
- `scripts/hsi-to-graph.cjs` (modified) - Requires `node-insert`; the two Section upserts now call `insertNode`; the bare `upsertNode` prepared statement removed.
- `lib/core/lazygraph-ops.cjs` (modified) - Requires `node-insert`; the four node-write sites (Artifact + Section in `_indexArtifactBody`, `createCausalClaim`, `addWhitespaceZone`) now call `insertNode`. Edge inserts unchanged.
- `commands/scout.md` (modified) - The HSI-to-graph invocation replaced the `2>/dev/null || true` swallow with an `if ! ... fi` form that surfaces stderr + prints a degraded-step advisory and stays non-fatal.

## Decisions Made

- **PRAGMA-detect over migrate-then-write (D-02a):** chose runtime column-detection in the helper rather than routing `hsi-to-graph` through `openRoomDb`. Rationale: the helper receives a caller-owned `conn` and stays a thin, dependency-free insert primitive that does NOT open room.db itself, so it never trips the `room-db.cjs` navigation-bypass audit, and the heavier Phase-109 migration is not forced on every scout HSI step. Both schemas are handled; the dogfood room (un-migrated) is provably safe.
- **`review_status` left to the column DEFAULT** ('proposed') rather than listed explicitly, matching the Phase-109 schema default and the `evidence-claim.cjs` provenance pattern.
- **`created_by='system'`** satisfies the Phase-109 CHECK constraint; these Section/Artifact/CausalClaim/WhitespaceZone nodes are system-bookkeeping graph nodes (HSI + indexer pipelines), not human truth-claims (Canon Part 9).

## Deviations from Plan

None - plan executed exactly as written. All three tasks, both TDD gates (RED at `78486aa2`, GREEN at `fa0e238b`), and every acceptance-criteria grep passed without auto-fixes.

## Issues Encountered

None. The RED test failed exactly as designed (module-not-found on `node-insert.cjs` before Task 2), and turned GREEN once the helper landed. The pre-existing indexer suites (`index-artifact-transaction`, `lazygraph-rs-discoveries-view`, `room-auto-create`) stayed green (11/11), confirming the four-site reroute introduced no regression.

## Verification

- `node --test lib/core/hsi-to-graph.test.cjs` -> 4/4 pass (both schemas + provenance + upsert).
- `grep -c node-insert scripts/hsi-to-graph.cjs` = 1; `grep -c node-insert lib/core/lazygraph-ops.cjs` = 1.
- No bare-3-col literal `INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?)` remains outside the helper in lazygraph-ops (non-comment grep = 0).
- `grep -c table_info lib/core/node-insert.cjs` = 2 (the PRAGMA detect path is present).
- `commands/scout.md` HSI-to-graph invocation: no `2>/dev/null`, no `|| true`.
- Canon Part 8: `grep -rE "fetch|http|curl|brain.mindrian|tavily" lib/core/node-insert.cjs scripts/hsi-to-graph.cjs` returns zero network surface.
- No em-dashes across all five authored files.
- Pre-commit hooks ran on every commit (sequential main-tree execution, hooks NOT bypassed); command-registry check OK.

## User Setup Required

None - no external service configuration required.

## TDD Gate Compliance

Plan tasks 1 and 2 are `tdd="true"`. RED gate: `test(140-01)` commit `78486aa2` (failing). GREEN gate: `feat(140-01)` commit `fa0e238b` (passing). REFACTOR: not needed. Gate sequence satisfied.

## Next Phase Readiness

- HARD-02 closed; the HSI-to-graph write path is now both-schema safe and the scout failure is no longer silent (the D-03 honesty guarantee), which is the HARD prerequisite shape Phase 145 (scheduled sensors) needs from this surface.
- Plans 140-02 / 140-03 / 140-04 (HARD-01, HARD-03, HARD-04, HARD-05) remain to complete the phase; the `insertNode` helper is now the sanctioned node-write primitive any future site should reuse.

## Self-Check: PASSED

- All created/modified files present on disk.
- All three task commits present in git history (78486aa2, fa0e238b, 89fd4c15).
- Zero em-dashes in the SUMMARY.

---
*Phase: 140-sentinel-and-instrumentation-hardening*
*Completed: 2026-06-05*
