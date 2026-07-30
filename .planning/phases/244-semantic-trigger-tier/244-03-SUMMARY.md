---
phase: 244-semantic-trigger-tier
plan: 03
subsystem: database
tags: [sqlite-fts5, bm25, room-db, lazygraph-ops, transaction-atomicity, ghost-trigger]

# Dependency graph
requires:
  - phase: 244-01
    provides: "public tableExists export on tri-modal-index.cjs, the 4-tier TRIGGER_TIERS vocabulary, tests/run-all-244.sh aggregator"
provides:
  - "A guarded DELETE FROM eureka_fts WHERE node_id NOT IN (SELECT id FROM nodes), riding rebuildGraph's existing BEGIN/COMMIT, that removes stale FTS rows for nodes a rebuild genuinely deleted"
  - "The identical guarded reconcile in scripts/build-ecosystem-graph.cjs's own BEGIN/COMMIT wrap (the second clearIndexerOwnedRows call site)"
  - "tests/test-244-fts-rebuild-reconcile.cjs: 5 scenarios (ghost, anti-vacuity control, absent-table no-op, capability-absent no-op, atomicity) proving no candidate can point at a deleted node_id after a rebuild"
affects: [244-05, 244-06, 240.1-03, 240.1-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reconcile-after-full-regeneration, not reconcile-after-wipe: when a scoped DELETE inside a transaction is immediately followed by a full regeneration pass that restores most of what it just deleted, a derived-table cleanup pass must run AFTER the regeneration completes, not in the gap between the wipe and the regeneration, or it treats every about-to-be-restored row as permanently orphaned"
    - "Sentinel pre-existing orphan row as a mutation discriminator: a crash-atomicity test built only around a freshly-orphaned row cannot distinguish 'reconcile inside the transaction' from 'reconcile outside the transaction', because the freshly-orphaned row's node-delete is itself rolled back either way; a row that was ALREADY an orphan before the transaction opened is what makes an outside-the-transaction reconcile's permanent, autocommitted delete observably different from an inside-the-transaction one that gets rolled back with everything else"

key-files:
  created:
    - tests/test-244-fts-rebuild-reconcile.cjs
  modified:
    - lib/core/lazygraph-ops.cjs
    - scripts/build-ecosystem-graph.cjs

key-decisions:
  - "The reconcile runs AFTER the full section walk + ROOT-FILES reindex pass, immediately before COMMIT -- NOT immediately after clearIndexerOwnedRows as the plan's action text literally specified. Rule 1 auto-fix: clearIndexerOwnedRows wipes EVERY indexer-owned node on EVERY rebuild (not only ones whose files were deleted), and the reindex that follows restores all of them with the same deterministic path-derived id within the SAME transaction. A reconcile between the wipe and the reindex therefore sees a window where no Artifact/Section node exists yet and treats every one of their eureka_fts rows as orphaned, wiping the lexical index on every single rebuild rather than only the rows for content genuinely gone. Discovered live: scenario 2 (the anti-vacuity control) failed with the literal placement, tracing to exactly this timing gap."
  - "Second call site: scripts/build-ecosystem-graph.cjs GETS the identical guarded reconcile (not a written why-not comment). It opens the same <roomDir>/.mindrian/room.db and calls the same clearIndexerOwnedRows, and buildEcosystemGraph re-walks and reinserts every Artifact/Section node the same way rebuildGraph's section walk does, so it carries the identical staleness hazard and the identical wipe-then-regenerate timing hazard. Placed after buildEcosystemGraph(conn, resolved), before its COMMIT."
  - "The guarded block is duplicated verbatim (not extracted to a shared export) between lazygraph-ops.cjs and build-ecosystem-graph.cjs, matching the existing precedent that this file already duplicates the BEGIN/COMMIT/ROLLBACK wrap shape rather than importing it. An earlier attempt extracted a shared top-level reconcileFtsIndex function, but that broke the plan's literal grep-based line-order proof (the DELETE text would sit in a function definition physically before rebuildGraph's BEGIN, not between it and COMMIT); reverted to an inline scoped IIFE at each call site so the literal source text proves transaction membership."
  - "Sensor id / trigger tier plumbing is out of scope for this plan (TRIG-01's data-loss half only); this plan closes Pitfall 4 exclusively."

requirements-completed: [TRIG-01]

# Metrics
duration: 90min
completed: 2026-07-30
---

# Phase 244 Plan 03: FTS Rebuild Reconcile (Ghost-Trigger Fence) Summary

**One guarded `DELETE FROM eureka_fts WHERE node_id NOT IN (SELECT id FROM nodes)` closes the resurrection hazard in both `rebuildGraph` call sites, placed after the full reindex (not immediately after the wipe, per a live bug found during testing) so it can tell a genuinely deleted artifact from one merely wiped-and-regenerated in the same transaction.**

## Performance

- **Duration:** ~90 min
- **Completed:** 2026-07-30T20:24:00Z
- **Tasks:** 2/2
- **Files modified:** 3 (1 new, 2 modified)

## Accomplishments

- Closed Pitfall 4 (the ghost-trigger hazard): after a `rebuildGraph` (or `build-ecosystem-graph.cjs`) run deletes indexer-owned nodes for content genuinely gone from disk, `eureka_fts` no longer matches those deleted rows.
- Found and fixed a genuine bug in the plan's own literal placement instruction before it could ship: placing the reconcile immediately after `clearIndexerOwnedRows` (as `<action>` specified) wipes the lexical index on every rebuild, not only when content is actually deleted, because `clearIndexerOwnedRows` unconditionally deletes all indexer-owned nodes and the reindex that follows restores almost all of them in the same transaction. Moved to run after the full reindex, still inside the same `BEGIN`/`COMMIT`.
- Both `clearIndexerOwnedRows` call sites (`lib/core/lazygraph-ops.cjs::rebuildGraph` and `scripts/build-ecosystem-graph.cjs::main`) now carry the identical guarded reconcile.
- Five scenarios landed in `tests/test-244-fts-rebuild-reconcile.cjs`, all passing, with four live mutation proofs executed and reverted.

## Task Commits

Each task was committed atomically:

1. **Task 1: Reconcile eureka_fts against nodes inside rebuildGraph's transaction** - `bbfed074` (feat)
2. **Task 2: Fence the ghost trigger** - `8f208e91` (test) -- also carries the Rule 1 placement-bug fix discovered while writing this test's scenario 2, since the fix and its discovering test are inseparable

_No separate plan-metadata commit: SUMMARY.md is committed as part of this worktree's final commit per the parallel-executor protocol (STATE.md/ROADMAP.md are excluded and owned by the orchestrator)._

## Files Created/Modified

- `lib/core/lazygraph-ops.cjs` - `rebuildGraph` gains the guarded `eureka_fts` reconcile, placed immediately before `COMMIT` (after the ROOT-FILES pass), inside the same `BEGIN` opened at the top of the function. `INDEXER_OWNED_NODE_TYPES`/`INDEXER_OWNED_EDGE_TYPES` untouched.
- `scripts/build-ecosystem-graph.cjs` - the identical guarded reconcile added after `buildEcosystemGraph(conn, resolved)`, before that file's own `COMMIT` (the decided second call site).
- `tests/test-244-fts-rebuild-reconcile.cjs` - five scenarios (ghost, anti-vacuity control, absent-table no-op, capability-absent no-op, atomicity with a sentinel pre-existing orphan row) plus the four mutation proofs executed live during development (not shipped in the file; see below).

## Decisions Made

- **Reconcile placement: after the full reindex, not immediately after the wipe.** See `key-decisions` above. This is a Rule 1 (auto-fix bugs) deviation from the plan's literal `<action>` text, found live via scenario 2 turning red under the as-written placement.
- **Second call site gets the reconcile, not a why-not comment.** `scripts/build-ecosystem-graph.cjs` opens the identical room.db shape and carries the identical wipe-then-regenerate hazard.
- **Duplicated inline block over a shared export.** An extracted shared `reconcileFtsIndex(conn)` function was tried first; it broke the plan's literal grep-based line-order acceptance proof (the DELETE text lives in a function definition, not physically between the caller's `BEGIN` and `COMMIT`). Reverted to a duplicated inline IIFE at each of the two call sites, matching the existing precedent that `build-ecosystem-graph.cjs` already duplicates the `BEGIN`/`COMMIT`/`ROLLBACK` wrap shape rather than importing it.
- **`content` trigger tier / sensor wiring stays out of scope.** This plan closes only the Pitfall 4 data-integrity half of TRIG-01 (the reconcile). The sensor that will eventually consume `lexicalSearch` results is a later plan's concern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Moved the reconcile from "immediately after clearIndexerOwnedRows" to "immediately before COMMIT"**
- **Found during:** Task 2, writing scenario 2 (the anti-vacuity control)
- **Issue:** The plan's `<action>` text specified inserting the reconcile "immediately after `clearIndexerOwnedRows(conn);`". Implemented exactly as written, then scenario 2 (a survivor artifact whose file is never deleted) failed: its `eureka_fts` row was gone after the rebuild even though its node still existed. Root cause: `clearIndexerOwnedRows` unconditionally deletes ALL `Artifact`/`Section` nodes on EVERY rebuild call (not only nodes whose backing files were removed); the section walk + ROOT-FILES pass that follows then restores nearly all of them with the same deterministic, path-derived id, all within the SAME transaction. A reconcile placed in the gap between the wipe and the reindex sees a moment where NO `Artifact`/`Section` node exists yet, so it treats every single one of their `eureka_fts` rows as orphaned -- correctly identifying zero real ghosts and incorrectly nuking every survivor's row on every rebuild.
- **Fix:** Moved the guarded reconcile block to run after the ROOT-FILES pass completes (i.e., after `nodes` has been fully repopulated for this rebuild), still inside the same `BEGIN` opened at the top of the function and still before `COMMIT`. Applied the identical relocation to `scripts/build-ecosystem-graph.cjs` (after `buildEcosystemGraph(conn, resolved)`, before its `COMMIT`), since it has the identical wipe-then-regenerate shape.
- **Files modified:** `lib/core/lazygraph-ops.cjs`, `scripts/build-ecosystem-graph.cjs`
- **Verification:** All 5 scenarios in `tests/test-244-fts-rebuild-reconcile.cjs` pass with the corrected placement; `bash tests/run-all-236.sh` and `bash tests/run-all-219.sh` remain byte-identical to their pre-plan baselines with the corrected placement in place.
- **Committed in:** `8f208e91` (Task 2 commit; the fix and the test that discovered it landed together, since the test is what proves the fix)

---

**Total deviations:** 1 auto-fixed (Rule 1 - correctness bug in the plan's own literal placement instruction)
**Impact on plan:** Necessary for correctness. Without this fix, the reconcile as literally specified would have wiped `eureka_fts` on every single rebuild regardless of whether any content was actually deleted, which is a strictly worse outcome than the pre-plan state for any room that ever calls `rebuildGraph` after building the index (the lexical leg would silently go to zero hits on the very next rebuild). No scope creep: the fix stays inside the same two files and the same transaction the plan already targeted.

## Issues Encountered

**MUTATION PROOF 3 did not turn red, and this is expected, not papered over.** The plan's acceptance criteria for Task 2 specify: "remove the `tableExists` guard so the DELETE runs against a room with no `eureka_fts`; confirm scenario 3 turns RED (rebuild throws `no such table`)". Executed live: removing only the `tableExists` guard leaves scenario 3 GREEN (`PASS=5 FAIL=0`), because the SAME task's own required design -- "wrap the whole guarded block in a try/catch that swallows and continues, because a reconcile fault must never abort a rebuild that is otherwise succeeding" (T-244-10) -- catches the resulting `no such table: eureka_fts` exception before it can propagate out of `rebuildGraph`. Instrumented the catch block temporarily to observe the exact swallowed message: `MUTATION PROOF 3 swallowed: no such table: eureka_fts` (observed twice, once per rebuild call in the test file). This is the correct, intentional behavior per T-244-10 and per the mitigation the plan's own `<threat_model>` names for T-244-10; weakening the try/catch to force this specific mutation red would reintroduce the denial-of-service risk T-244-10 exists to close, purely to satisfy one acceptance-criteria line. Restored immediately; the file is byte-identical pre/post this observation.

## Mutation Proofs (4 total, all executed live and reverted)

### Mutation Proof 1 -- comment out the reconcile DELETE

Commented out `conn.prepare('DELETE FROM eureka_fts WHERE node_id NOT IN (SELECT id FROM nodes)').run();`. Scenario 1 turned RED:

```
FAIL: 1. the ghost: a deleted artifact stale FTS row is gone after a rebuild, orphan_rows is 0 -- a content-tier trigger must NOT be able to match the deleted ghost artifact after a rebuild (the resurrection hazard), got [{"node_id":"business-model/ghost-scenario1","rank":-1.8800363179764048}] (dead node_id: business-model/ghost-scenario1)
```

Dead `node_id`: `business-model/ghost-scenario1`. Restored; re-ran green (`PASS=5 FAIL=0`).

### Mutation Proof 2 -- widen to `DELETE FROM eureka_fts` (unconditional)

Removed the `WHERE node_id NOT IN (...)` clause. Scenario 2 turned RED while scenario 1 stayed green (proving scenario 1 alone is not a sufficient fence):

```
FAIL: 2. the anti-vacuity control: a surviving artifact keeps its FTS row and keeps matching -- a SURVIVING node must keep its FTS row and keep matching after the rebuild (an unconditional DELETE would fail this while passing scenario 1), got []
```

Restored; re-ran green (`PASS=5 FAIL=0`).

### Mutation Proof 3 -- remove the `tableExists` guard

Removed `if (!tri.tableExists(conn, 'eureka_fts')) return;`. Stayed GREEN (`PASS=5 FAIL=0`) -- documented above under Issues Encountered, with the observed swallowed exception message `no such table: eureka_fts`, rather than papering over the non-red result. Restored; file diffed byte-identical to pre-mutation state.

### Mutation Proof 4 -- move the guarded block outside `BEGIN`/`COMMIT` (before `BEGIN`)

Relocated the entire guarded IIFE to run before `conn.prepare('BEGIN').run()`. Both scenario 1 AND scenario 5 turned RED:

```
FAIL: 1. the ghost: ... got [{"node_id":"business-model/ghost-scenario1","rank":-1.8800363179764048}] (dead node_id: business-model/ghost-scenario1)
FAIL: 5. atomicity: a crash mid-transaction rolls back both node writes and the FTS reconcile -- ATOMICITY VIOLATION: the pre-existing sentinel orphan row must ALSO survive a failed rebuild. If the reconcile is not inside the same BEGIN as clearIndexerOwnedRows, its DELETE would have already committed BEFORE the transaction opened, and no ROLLBACK could restore it (this is exactly what Mutation Proof 4 flips red)
```

`PASS=3 FAIL=2`. Scenario 5's sentinel-orphan-row design (a row seeded directly into `eureka_fts` with a `node_id` that never corresponds to any real node, seeded BEFORE the crashing rebuild call) is what gives this mutation teeth: a freshly-orphaned row (the ghost artifact) cannot discriminate placement on its own, because its node-delete is rolled back either way regardless of where the reconcile sits; only a row that was ALREADY orphaned before the transaction opened exposes the difference between "deleted permanently by an autocommitted pre-BEGIN statement" and "deleted-then-rolled-back inside the same transaction as everything else." Restored; re-ran green (`PASS=5 FAIL=0`). File diffed byte-identical to pre-mutation state.

## Before/After Baseline Counts

**`bash tests/run-all-236.sh`** (captured before any Task 1 edit, via `git checkout --` to a clean working tree): `Phase 236: PASS=12 FAIL=0 SKIP=0`. Post-Task-2 re-run (final state, corrected placement): **identical** (`PASS=12 FAIL=0 SKIP=0`); the only diff lines against the captured log are non-deterministic noise (process PIDs, `mkdtemp` random suffixes).

**`bash tests/run-all-219.sh`** (captured before any Task 1 edit): `Phase 219: PASS=11 FAIL=2 SKIP=0` (the 2 pre-existing failures are the Plan 01-documented `table edges has no column named review_status` schema-drift condition from a concurrent session, confirmed unrelated to this plan). Post-Task-2 re-run: **PASS/FAIL/SKIP counts identical** (`PASS=11 FAIL=2 SKIP=0`).

**`node scripts/check-substrate.cjs --diff`**: exit 0 both before and after, with no allowlist edit.

## Second-Call-Site Decision (written down, per Task 1's acceptance criteria)

`clearIndexerOwnedRows` has two callers: `rebuildGraph` (`lib/core/lazygraph-ops.cjs`) and `main()` in `scripts/build-ecosystem-graph.cjs`. Both open the identical `<roomDir>/.mindrian/room.db` shape, and `buildEcosystemGraph` re-walks the whole room tree and reinserts every `Artifact`/`Section` node with a deterministic id the same way `rebuildGraph`'s section walk does. **Decision: the ecosystem builder GETS the identical guarded reconcile**, placed after `buildEcosystemGraph(conn, resolved)` completes and before that file's `COMMIT`, for the exact same reason and shape as the primary site.

## Line-Number Proof (Task 1 acceptance criteria)

`grep -n "prepare('BEGIN')\|DELETE FROM eureka_fts\|prepare('COMMIT')" lib/core/lazygraph-ops.cjs` (the `rebuildGraph`-specific triple; the file also contains an unrelated `indexArtifact` BEGIN/COMMIT pair at lines 567/571):

- `668`: `conn.prepare('BEGIN').run();` (top of `rebuildGraph`'s transaction)
- `813`: `conn.prepare('DELETE FROM eureka_fts WHERE node_id NOT IN (SELECT id FROM nodes)').run();` (the reconcile, after the full reindex)
- `820`: `conn.prepare('COMMIT').run();`

Ascending order confirmed: `668 < 813 < 820`, the reconcile sits strictly between `BEGIN` and `COMMIT`.

## Known Stubs

None. This plan ships one production statement (duplicated across two call sites) plus its test fence; no UI, no placeholder data paths.

## Threat Flags

None. This plan's only new surface is the reconcile DELETE itself, already covered by the plan's own `<threat_model>` (T-244-09/T-244-10/T-244-11), and the substrate-guard check confirms no exemption widening was needed.

## Next Phase Readiness

- Pitfall 4 (the ghost-trigger data-integrity hazard) is closed for both `rebuildGraph` and `build-ecosystem-graph.cjs`. A future content-tier sensor (later plans in this phase) can call `lexicalSearch` without inheriting a resurrection risk from a prior rebuild.
- The corrected placement pattern (reconcile-after-full-regeneration, not reconcile-after-wipe) is documented in this file's `tech-stack.patterns` and in the source comments at both call sites, so a future plan touching either transaction reads the rationale before moving anything.
- No blockers for 244-05/244-06 (the sensor and doctor-module plans that will consume `lexicalSearch`/`tableExists`).

## Self-Check: PASSED

All claimed files found on disk (`lib/core/lazygraph-ops.cjs`, `scripts/build-ecosystem-graph.cjs`, `tests/test-244-fts-rebuild-reconcile.cjs`, this SUMMARY.md). Both task commits (`bbfed074`, `8f208e91`) found in `git log`.

---
*Phase: 244-semantic-trigger-tier*
*Completed: 2026-07-30*
