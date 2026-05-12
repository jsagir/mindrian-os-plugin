---
status: awaiting_human_verify
trigger: "phase-109-migration-view-drop-collision: phase-109 nodes-provenance migration crashes openRoomDb for any room.db with the Phase-89 rs_discoveries view"
created: 2026-05-12T08:41:09Z
updated: 2026-05-12T08:48:00Z
---

## Current Focus

hypothesis: CONFIRMED. tightenSchemaWithCheckConstraints() did DROP TABLE nodes; ALTER TABLE nodes_new RENAME TO nodes while the rs_discoveries view (created by lazygraph-ops.cjs initSchema, which runs before the migration in openRoomDb) still referenced the legacy nodes table. SQLite's ALTER TABLE ... RENAME TO re-validates the whole schema (legacy_alter_table OFF by default in SQLite 3.51.2) and the now-dangling view threw "error in view rs_discoveries: no such table: main.nodes".
test: fixed -- migration now captures view/trigger sql from sqlite_master, drops them before the rebuild, recreates them after. Verified via `node tests/test-navigation-focus.cjs` (now 8/8) + new `tests/test-navigation-migration-views.cjs` (7/7) + end-to-end openRoomDb simulation.
expecting: human confirms the 10 affected navigation suites no longer crash on the rs_discoveries view in their real workflow.
next_action: await "confirmed fixed" or report of remaining failures.

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
files_changed: [lib/core/migrations/phase-109-nodes-provenance.cjs, tests/test-navigation-migration-views.cjs, lib/memory/run-feynman-tests.cjs]
