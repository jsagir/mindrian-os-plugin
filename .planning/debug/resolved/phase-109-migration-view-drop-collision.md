---
status: resolved
trigger: "phase-109-migration-view-drop-collision: phase-109 nodes-provenance migration crashes openRoomDb for any room.db with the Phase-89 rs_discoveries view"
created: 2026-05-12T08:41:09Z
updated: 2026-05-12
resolved: 2026-05-12
fix_commit: 7d87ed5
---

## Current Focus

hypothesis: CONFIRMED + FIXED + HUMAN-VERIFIED. tightenSchemaWithCheckConstraints() did DROP TABLE nodes; ALTER TABLE nodes_new RENAME TO nodes while the rs_discoveries view (created by lazygraph-ops.cjs initSchema, which runs before the migration in openRoomDb) still referenced the legacy nodes table. SQLite's ALTER TABLE ... RENAME TO re-validates the whole schema (legacy_alter_table OFF by default in SQLite 3.51.2) and the now-dangling view threw "error in view rs_discoveries: no such table: main.nodes".
test: fixed in commit 7d87ed5 -- migration now captures view/trigger sql from sqlite_master, drops them before the rebuild, recreates them after. Verified via `node tests/test-navigation-focus.cjs` (now 8/8) + new `tests/test-navigation-migration-views.cjs` (7/7) + end-to-end openRoomDb simulation. Human independently confirmed: 14/16 Phase-109 test suites now pass (was 4/16); zero `error in view rs_discoveries: no such table: main.nodes` occurrences.
expecting: (resolved) human confirmed.
next_action: (none) session archived. See Followups section for the remaining Phase-109 work that this fix does NOT cover.

## Symptoms

expected: openRoomDb() runs phase-109-nodes-provenance cleanly on ANY room.db incl. rooms with the Phase-89 rs_discoveries view. After migration, the 15 Phase-109 suites pass.
actual: openRoomDb() throws `error in view rs_discoveries: no such table: main.nodes` at tightenSchemaWithCheckConstraints (phase-109-nodes-provenance.cjs:280). Knock-on: test/84-smart-notebook-copilot.test.cjs hangs on a dangling SQLite handle, blocking run-feynman-tests.cjs.
errors: `error in view rs_discoveries: no such table: main.nodes` raised by node:sqlite inside a db.exec() during the nodes-table rebuild.
reproduction: `node tests/test-navigation-focus.cjs` -- fails at makeRoom -> openRoomDb -> migration crash. Also 9 other test-navigation-* suites + test-brain-ingestion-part-9-invariant + test-room-home-vs-brain-derivation-regression fail the same way.
timeline: introduced ~2026-05-05 by Phase 109 Plan 109-01 (commit eec5008). Latent bug, never worked for rooms with rs_discoveries view. Not a regression.

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-05-12T08:43:00Z
  checked: ran `node tests/test-navigation-focus.cjs`
  found: throw at phase-109-nodes-provenance.cjs:280:6 -- that line is `db.exec('ALTER TABLE nodes_new RENAME TO nodes')`. The symptom's guess of "one of the CREATE INDEX calls" is wrong; it's the RENAME.
  implication: SQLite's RENAME TABLE step re-parses all views/triggers and the rs_discoveries view (which SELECTs FROM nodes) is dangling because `DROP TABLE nodes` ran on the line before. The idiomatic fix is the 12-step recipe: drop dependent views/triggers BEFORE the rebuild, recreate them AFTER.

- timestamp: 2026-05-12T08:44:00Z
  checked: lib/core/room-db.cjs openRoomDb() ordering + lib/core/lazygraph-ops.cjs initSchema()
  found: openRoomDb calls lazygraph.initSchema(db) (which CREATE VIEW IF NOT EXISTS rs_discoveries AS SELECT ... FROM nodes WHERE type='RSDiscovery') BEFORE memory.initMemorySchema and BEFORE runPhase109NodesProvenance. So every real room that has been opened post-Phase-89 carries the rs_discoveries view by the time the migration runs.
  implication: the migration MUST handle pre-existing views referencing `nodes`. Don't hardcode just rs_discoveries -- enumerate from sqlite_master so future views/triggers are covered too.

## Evidence (cont.)

- timestamp: 2026-05-12T08:46:00Z
  checked: implemented the fix + ran the full affected suite set + an end-to-end openRoomDb simulation (fresh room dir: initSchema creates rs_discoveries, then migration runs in the same openRoomDb call)
  found: with the fix in place, 11/12 affected navigation suites pass (the 12th, test-navigation-acceptance.cjs, prints "MISSING - Wave 4 must implement full navigation flow ... Plan 109-10" -- a deliberate not-yet-implemented stub, NOT the rs_discoveries crash; verified no "rs_discoveries"/"no such table" in its output). test-brain-ingestion-part-9-invariant 9/9, test-room-home-vs-brain-derivation-regression 8/8. The 3 pre-existing migration tests (coexistence/idempotent/backfill) stay green. New tests/test-navigation-migration-views.cjs 7/7. lazygraph-rs-discoveries-view.test.cjs still passes. E2E sim: nodes table ends with 12 provenance cols, rs_discoveries view present + queryable, sentinel set, reopen idempotent.
  implication: root cause confirmed and fix verified. Knock-on Phase-84 hang (dangling SQLite handle) should clear because the migration no longer throws mid-rebuild and leaves no half-open handle.

## Resolution

root_cause: phase-109-nodes-provenance.cjs:tightenSchemaWithCheckConstraints() rebuilt the `nodes` table via the rename-out-of-existence pattern (DROP TABLE nodes; ALTER TABLE nodes_new RENAME TO nodes) but did NOT drop and recreate the views/triggers that depend on `nodes`. SQLite (3.51.2, legacy_alter_table OFF) re-validates every schema object during ALTER TABLE ... RENAME TO; the now-dangling rs_discoveries view (created by lazygraph initSchema, which runs before this migration in openRoomDb) made the RENAME throw "error in view rs_discoveries: no such table: main.nodes". This blocked 10 of the 15 Phase-109 navigation suites and left a dangling SQLite handle that hung an unrelated Phase-84 test in the Feynman runner.
fix: tightenSchemaWithCheckConstraints() now follows the canonical SQLite 12-step recipe for dependent objects: a new dependentSchemaObjects(db) helper enumerates every view/trigger from sqlite_master whose sql references `nodes` (LIKE '%nodes%' AND NOT LIKE '%nodes_new%' -- not hardcoded to rs_discoveries); the migration DROPs each before the table rebuild and re-execs the captured CREATE sql verbatim after the indices are rebuilt. Idempotency is preserved -- the sentinel still short-circuits a second run, and on a fresh run the drop-then-recreate is a no-op for unrelated objects. Added tests/test-navigation-migration-views.cjs (seeds a room.db with an rs_discoveries-style view + a second bare-CREATE view + a trigger referencing nodes; asserts no throw, views/trigger still work post-migration, idempotent re-run) and registered it in lib/memory/run-feynman-tests.cjs.
verification: `node tests/test-navigation-focus.cjs` 8/8 (was: crash). 10 previously-crashing navigation suites no longer crash on rs_discoveries; test-navigation-acceptance.cjs still fails on its own Wave-4 not-implemented stub (unrelated). 3 pre-existing migration tests stay green. New views test 7/7. End-to-end openRoomDb simulation passes (12-col nodes, rs_discoveries present + queryable, sentinel set, idempotent reopen).
human_verification: 2026-05-12 -- user verified independently. 14/16 Phase-109 test suites now GREEN (was 4/16): test-navigation-{migration-idempotent, migration-backfill, migration-coexistence, migration-views, focus, memory-events, neighborhood, insights, chokepoint-hook, packet-builder, packet-part8-leak, perf-10k} + test-brain-ingestion-part-9-invariant + test-room-home-vs-brain-derivation-regression. The `error in view rs_discoveries: no such table: main.nodes` crash is gone (0 occurrences in test-navigation-focus output). The only two still-failing suites are `test-navigation-acceptance.cjs` and `test-canon-part-9-ratification.cjs` -- both deliberate 8-line `process.exit(1)` "MISSING - Plan 109-10/109-11" stubs, NOT the migration bug, explicitly out of scope. Working tree clean except pre-existing unrelated testers-hub drift (dashboard/graph.json, docs/testers/*).
fix_commit: 7d87ed5 -- "fix(109-01): phase-109 nodes-provenance migration drops+recreates dependent views around the nodes-table rebuild" (on main, unpushed at time of resolution).
files_changed: [lib/core/migrations/phase-109-nodes-provenance.cjs, tests/test-navigation-migration-views.cjs, lib/memory/run-feynman-tests.cjs]

## Followups (NOT covered by this fix)

This fix unblocks Phase 109's SQL navigation substrate -- but Phase 109 is NOT complete. Outstanding work, recorded here so it is not lost:

1. **Two stub tests need real assertions.** `tests/test-navigation-acceptance.cjs` (Plan 109-10 -- the zero-non-SQLite-reads acceptance gate) and `tests/test-canon-part-9-ratification.cjs` (Plan 109-11) are currently 8-line `process.exit(1)` "MISSING" stubs. They must get real assertions before Phase 109 can pass its own gate. Out of scope for this debug session -- do NOT touch these stubs as part of the migration fix.
2. **Canon Part 9 needs ratifying.** The Part 9 proposal text at `.planning/research/2026-05-03-canon-part-9-memory-locality-proposal.md` must be merged into `docs/MINDRIAN-CANON.md` as a new Part 9 (per CANON-PHASE-MAP: ratifies at the Phase 109 release gate).
3. **Missing SUMMARYs for plans 109-00 / 109-01 / 109-07 / 109-09.** These SUMMARY files live only on archived worktree branches (`origin/archive/worktree-agent-*`), not on main. They must be recovered or recreated before `gsd-tools phase complete 109` can run cleanly.
