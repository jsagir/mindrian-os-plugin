---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 11
subsystem: testing
tags: [change-log, writer-inventory, coverage, d-18, triggers]

requires:
  - phase: 369-04
    provides: fixture-room-369 builder, writer inventory fixture, run-all-369.sh leg
  - phase: 369-05
    provides: room_change_log triggers, readChangeLogMeta, withRoomTx
  - phase: 369-06
    provides: owns idiom at the eight unconditional-BEGIN writer sites
  - phase: 369-12
    provides: cross-process proof for U9, E5, E6, P1, R1
provides:
  - tests/test-369-writer-inventory.cjs, the CHG369-04 coverage matrix
  - covered_by on every row of tests/fixtures/369/writer-inventory.json
  - a live wide-regex scan that fails the build when a nodes/edges writer is added or removed
affects: [any later plan that adds a nodes or edges writer (must add an inventory row and drive it here)]

tech-stack:
  added: []
  patterns:
    - "Rollback arm asserts rows exist INSIDE the outer transaction before asserting zero after ROLLBACK, so it can never pass vacuously"
    - "Writers that open their own handle are observed through a separate read-only handle"
    - "covered_by is checked: a reference to this file must name a row this run actually drove"

key-files:
  created:
    - tests/test-369-writer-inventory.cjs
  modified:
    - tests/fixtures/369/writer-inventory.json

key-decisions:
  - "INSERT OR IGNORE rows (N4, N5, E2) are proven at the ignored statement: the second drive logs zero rows for the ignored entity; other statements in the same call (a new memory_event, a DO UPDATE edge) legitimately log"
  - "UPDATE rows that sit beside an insertNode (U2, U3, U5, U6) are proven by an exact row count: a fresh drive yields at least two upserts for the node (the insert and the explicit UPDATE), a lone insert would yield one"
  - "D4 executes the returned rollback SQL on a write-door handle: no in-tree caller runs rs-sqlite-mirror's rollback_cypher on room.db"

patterns-established:
  - "Adding a writer: add the inventory row, regenerate per_file_statement_counts with node tests/test-369-infra-helpers.cjs --print-counts, drive the row in this test, set covered_by"

requirements-completed: [CHG369-04]

duration: 45min
completed: 2026-10-03
---

# Phase 369 Plan 11: Writer Inventory Coverage Summary

**Every in-process writer row (N1-N5, U1-U8, E1-E4, D1-D4) is driven through its real function and watched writing a room_change_log row of the right entity, operation and id; rollbacks and ignored inserts log nothing; a live wide-regex scan turns any future writer into a failing test.**

## Accomplishments

- `tests/test-369-writer-inventory.cjs` (about 940 lines, 29 ok lines), one scenario per row plus exclusion, M1, scan and coverage arms, ending with the table `row | function | log rows | rollback | result`.
- N1 insertNode on all three schema variants: wide, plus mid and legacy both raw (3-column branch, installer run on a raw handle) and migrated through the write door. Includes `on_conflict: 'nothing'` (zero rows).
- N2 logMemoryEvent (the memory_event node IS logged), N3 writeDiscovery (all three core nodes and edges), N4 spine operator edge (second drive: operator nodes ignored, 0 rows), N5 drainBirthGateAnswers (anchor and no-venture stub both OR IGNORE; second drive 0 rows).
- U1 promoteNodeStatus directly, through `confirmNode` (the gate_answer path), under `withRoomTx` (one shared non-NULL transaction_id), and composed in a rolled back outer transaction (status UPDATE reverts). U2-U8 each prove the explicit UPDATE statement logs.
- E1 writeEdge on the wide (review_status) and the base 4-column edges variants; E2 storeBrainSuggestions (OR IGNORE edge, second drive 0 rows); E3 persistDecisionEdge and indexOpportunity; E4 indexArtifact plus all ten named creators, each checked for the exact `source char(31) type char(31) target` entity id, plus one rollback arm over all eleven.
- D1 rebuildGraph (delete rows for cleared ids followed by upserts for re-created ones, a vanished artifact only deleted; rolled back rebuild keeps the graph); D2 purge (node and edge deletes); D3 writeReverseSalientEdges (second run's DELETE logged, then re-upsert); D4 rollback SQL (edge and node deletes).
- Exclusion arm: `memory-ops.addFact` lands a facts row and logs zero rows; all six triggers target only nodes or edges.
- M1: a write-door open of the bare 3-column legacy fixture rebuilds nodes and reinstalls all six triggers with an epoch.
- Scan arm: reads the fixture's `scan_regex`, roots, extensions, excludes and `non_write_hits`; 1035 files, 60 mutation statements, per-file counts equal the fixture, 0 unlisted mutation sites. Checked to fail with the file and line when a count is altered. Advisory line: `check-substrate.cjs` RE_RAW_WRITE would miss 4 of the 60 hits.
- Fixture: `covered_by` added to all 28 rows (in-process rows name `test-369-writer-inventory.cjs#<ID>`; U9 arm2, E5/E6 arm3, P1 arm4, R1 arm5 of the plan 12 cross-process test; X1 "external writer replaced by the action layer (D-06), not in the slice"; M1 also names the ddl rebuild scenario).

## Test Results

- `node tests/test-369-writer-inventory.cjs`: PASS=29 FAIL=0, stable on repeated runs
- `node tests/test-369-infra-helpers.cjs`: PASS=9 FAIL=0 (the fixture still parses and reconciles)
- Mutation check: altering one per-file count in the fixture fails the scan arm with `lib/core/rs-engine.cjs: inventory says 2, live scan found 1 at line(s) 412`; restored.
- `git diff --stat -- lib scripts bin hooks`: empty for this plan; no production file touched.

## Task Commits

1. **Tasks 1 and 2 together: coverage matrix, exclusion, scan, covered_by** - `0db7964d3` (test). Both tasks edit the same two files and the node, edge and delete scenarios share one runner, so they landed as one commit rather than two.

## Deviations from Plan

None in behavior. Notes:

- **Rows 'how' signatures differ from the real functions** (not a plan deviation): the inventory text says `drainBirthGateAnswers(roomDir)`, `dispatchVerb(db, verb, nodeId)`, `surfaceBreakthrough(db, candidate)`, `writeFrameNode(db, spec)` and similar; the real signatures are `drainBirthGateAnswers(db, roomDir, answers, ventureNodeId)`, `dispatchVerb(verb, id, { db })`, `surfaceBreakthrough(bk, { db })`. The test drives the real ones. The `how` text was left untouched.
- **statement_lines in the fixture are stale** in files edited by plan 06 (for example transitions.cjs, lazygraph-ops.cjs shifted a few lines). Counts, which the scan compares, are correct; line numbers are descriptive only.
- **No row is marked unreachable.** Every `call` row was driven in-process.

## Open Items (observations outside this plan's files, no production change made)

1. **`purgeLegacySelfReferentialEntities` (D2) and `storeBrainSuggestions` (E2) still open an unconditional BEGIN** and were not among plan 06's eight sites. Composed inside `withRoomTx`, E2 throws and D2 returns `ok:false`; worse, D2's own `catch` issues `ROLLBACK`, which ends the CALLER's outer transaction. Neither has a composing caller today. If one ever does, adopt the owns idiom. The rollback arm for both is recorded as `n/a: owns an unconditional BEGIN (fails closed in an outer tx)`, and the test proves nothing leaks.
2. **Rows whose function opens its own handle** (N3, N4, E3, D3) have no rollback arm by construction (`n/a: opens its own handle`); capture there is proven by observing the log through a second handle.
3. **D4: no in-tree caller executes `rs-sqlite-mirror`'s `rollback_cypher`** on room.db; the test runs the returned statements on a write-door handle, as a dispatch caller would.

## Known Stubs

None.

## Threat Flags

None. T-369-11-01 mitigated: every inventory row driven and the live scan fails on drift. T-369-11-02 mitigated: `covered_by` is verified, a reference to this file must name a row this run drove, and no row is unproven.

## Self-Check: PASSED

- Files present: tests/test-369-writer-inventory.cjs, tests/fixtures/369/writer-inventory.json (every row has covered_by)
- Commit present: 0db7964d3
