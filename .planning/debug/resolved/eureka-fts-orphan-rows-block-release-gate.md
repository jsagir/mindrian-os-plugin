---
status: resolved
kind: rca
trigger: "scripts/release.sh --prerelease --allow-ahead HARD ABORTS at Step 6.6 (doctor --acceptance --pre-tag) on the eureka-fts-index-visible gate: eureka_fts stale in room jonathan-contractor-motj (451 orphan rows pointing at deleted nodes)"
issue_id: ""
severity: high
surfaces: [cli]
canon_parts: [8, 9]
created: 2026-08-01
updated: 2026-08-01
---

## Current Focus

hypothesis: CONFIRMED - (a). `lib/core/eureka/tri-modal-index.cjs::indexNodes()` reconciles
`eureka_fts` ONLY per-live-node. Its single lexical DELETE is
`DELETE FROM eureka_fts WHERE node_id = ?`, run once per entry in `items` (nodes that currently
exist in `nodes` AND yield non-empty indexed text), immediately followed by a re-INSERT. There is
no set-based prune anywhere in the file for rows whose `node_id` is no longer in `nodes`.

The orphan reconcile DOES exist in this repo - but only in
`lib/core/lazygraph-ops.cjs::rebuildGraph` (`:803-818`, `DELETE FROM eureka_fts WHERE node_id NOT
IN (SELECT id FROM nodes)`, inside the rebuild's BEGIN), with a duplicate copy in
`scripts/build-ecosystem-graph.cjs`. It runs on a FULL GRAPH REBUILD only. The sanctioned repair
path for `index_stale` (`requestFtsBuild` -> `scripts/fts-index-drain.cjs` -> `indexNodes`) never
invokes it. Since `ftsIndexState` DEFINES `index_stale` as `orphan_rows >= FTS_STALE_ORPHAN_FLOOR`
(= 1), the documented repair path structurally cannot clear the exact condition the doctor gate
flags. The doctor module's "lazy build-on-first-miss repairs it" story is true for `index_absent`
and `index_empty`, and false for `index_stale`.

test: (done) read `indexNodes()` end to end, then measure the real room to confirm the drain
really did work rather than silently no-op'ing.
expecting: after the fix, `ftsIndexState(db)` against
`~/MindrianRooms/motj-ecosystem/sub-rooms/jonathan-contractor-motj/.mindrian/room.db` reports
`orphan_rows: 0` / `reason: "ok"`, and a full `node scripts/doctor.cjs --acceptance --pre-tag`
no longer fails on `eureka-fts-index-visible`.
next_action: AWAITING HUMAN VERIFICATION. The fix is applied, the RED test is 5/5 GREEN, the REAL
room is repaired (451 -> 0 orphans, 245 live rows intact), and
`node scripts/doctor.cjs --acceptance --pre-tag` is 13/13 with `eureka-fts-index-visible` PASSING.
Nothing further is blocked. On confirmation: commit, move this file to `.planning/debug/resolved/`,
append the knowledge-base entry, and the release cut (`scripts/release.sh --prerelease
--allow-ahead`) is the operator's own call, deliberately NOT run by this session.

tdd_checkpoint:
  test_file: "tests/test-244-fts-build-orphan-prune.cjs"
  test_names: "5 scenarios: prune / anti-vacuity / idempotence / capability-absent / reported-bug"
  status: "green"
  green_output: |
    PASS: 1. the prune: indexNodes clears a deleted node row AND a pre-existing sentinel orphan
    PASS: 2. anti-vacuity: a surviving node keeps its row and keeps matching
    PASS: 3. idempotence: repeated passes hold orphan_rows at 0 with no duplicate rows
    PASS: 4. capability-absent no-op: MINDRIAN_FORCE_FTS_ABSENT skips the prune without throwing
    PASS: 5. reported bug: requestFtsBuild + drain repairs index_stale to ok on a real room
    PASS=5 FAIL=0
  failure_output: |
    FAIL: 1. the prune ... -- orphan_rows is still 2            (2 !== 0)
    FAIL: 2. anti-vacuity ... -- exactly the two surviving rows (3 !== 2)
    FAIL: 3. idempotence ... -- pass 1 clears the orphans       (2 !== 0)
    FAIL: 4. capability-absent ... -- fts_pruned               (undefined !== 0)
    FAIL: 5. reported bug ... -- accumulated orphan must be gone (true !== false)
    PASS=0 FAIL=5
  red_is_honest: "Scenarios 1, 2, 3 and 5 fail on BEHAVIOR (orphan rows survive a successful
    build, which is the defect verbatim). Scenario 4 fails only on the not-yet-existing
    `fts_pruned` provenance field; its behavioral assertions (no throw, honest bi-modal
    provenance, orphan correctly SURVIVES when FTS5 is absent) already pass, which is correct
    since scenario 4 is a guard-PLACEMENT test rather than a defect test."

planned_fix (GREEN phase, in `lib/core/eureka/tri-modal-index.cjs` only):
  1. Add an exported `reconcileFtsOrphans(db)` that self-guards on `ensureFtsAvailable().ok` and
     `tableExists(db, 'eureka_fts')`, runs
     `DELETE FROM eureka_fts WHERE node_id NOT IN (SELECT id FROM nodes)` and returns
     `{ pruned: <changes> }` (0 when either guard skips). Verified legal against an fts5 virtual
     table with `node_id UNINDEXED`: `run()` returned `{changes: 2}`, the live row survived and
     still MATCHed.
  2. Call it from `indexNodes()` INSIDE the existing `ftsLive` gate, BEFORE the per-node
     delete-then-insert loop, and surface the count as an additive `fts_pruned` key on the return.
     Placement is order-independent here (unlike `rebuildGraph`, which must reconcile AFTER its
     reindex because it WIPES and regenerates `nodes` in the same transaction); `indexNodes` only
     ever READS `nodes`, so the orphan set is stable throughout.
  3. Do NOT swallow a prune fault the way `lazygraph-ops.cjs` does. There the swallow is right
     because a reconcile fault must not abort an otherwise-succeeding rebuild. Here a swallowed
     fault would recreate this exact bug: a "successful" build that did not reconcile. Letting it
     propagate hands it to the drain's existing keep-on-failure + retry + permanent-failure-record
     discipline, which is the NEVER SILENT ROT contract `fts-index-drain.cjs` already states.
  4. Do NOT add a BEGIN/COMMIT around `indexNodes`. It awaits `embedTexts` mid-body, and holding a
     write transaction across that await would lock room.db for the whole embed batch.
  5. Additive only: no existing consumer deep-equals the return shape (checked all four call
     sites; every one reads named fields), so the new `fts_pruned` key is safe.
  Return shape after the fix:
    `{ indexed, vec_backend, embedded, fts_backend, fts_pruned }`
  Also update the module's Exports header block and the `indexNodes` doc comment, which currently
  claims "Full-corpus reindex" and "Per-node DELETE-then-INSERT keeps it idempotent" without
  admitting that idempotence was scoped to LIVE nodes only.

reasoning_checkpoint:
  hypothesis: "indexNodes() upserts only live-node rows and has no set-based orphan prune, so the
    requestFtsBuild -> drain -> indexNodes repair path can never reduce orphan_rows, which is the
    sole definition of index_stale."
  confirming_evidence:
    - "Code read, tri-modal-index.cjs:349-356: the only eureka_fts DELETE is `WHERE node_id = ?`
       bound to live item ids. No NOT IN / NOT EXISTS prune exists anywhere in the file."
    - "The drain PROVABLY did real work on this room: eureka_vec_fallback holds 245 rows,
       eureka_meta holds embedding_model=MongoDB/mdbr-leaf-ir and embedding_dim=384 (the one-time
       model fetch the symptoms describe), and room.db mtime is 2026-08-01 10:16, the drain run."
    - "The arithmetic matches the mechanism exactly: fts_rows 696 = 245 live rows + 451 orphans,
       and `SELECT count(*) FROM eureka_fts WHERE node_id IN (SELECT id FROM nodes)` = 245 =
       eureka_vec_fallback rows = items.length. The drain rewrote precisely the 245 live rows and
       touched none of the 451 orphans."
    - "No .mindrian/fts-index-failures.json exists and the queue is empty - the drain cleared the
       entry on SUCCESS per its own keep-on-failure discipline. There is no hidden failure."
    - "Orphan node_ids are genuine deletions (entity:entity-extract:<hash> ids plus an old
       b2-journey meeting path), i.e. a real backlog of removed nodes, not table corruption."
  falsification_test: "If indexNodes had a set-based orphan prune, a successful drain would have
    driven orphan_rows to 0. The drain succeeded (proven by the vectors, the meta row, the mtime,
    the emptied queue and the absent failure log) and orphan_rows stayed at exactly 451.
    Conversely, had the drain silently no-op'd, eureka_vec_fallback would not hold 245 freshly
    embedded vectors and eureka_meta would not name the model."
  fix_rationale: "Give indexNodes the same set-based reconcile rebuildGraph already performs, so
    the eureka_fts BUILD path itself converges the index onto the nodes table instead of only
    upserting live rows. That addresses the root cause (the build path never prunes) rather than
    the symptom (this one room's 451 rows): every room that accumulates deleted nodes then
    self-heals through the sanctioned lazy-build path, closing the structural release-reliability
    risk, not just today's blocker."
  blind_spots:
    - "Rows for nodes that STILL exist but no longer yield indexable text stay stale. They are not
      orphans by countOrphans' definition so they never trip the gate. Deliberately out of scope;
      logged as a follow-up."
    - "The reconcile SQL will exist in three places (lazygraph-ops.cjs, build-ecosystem-graph.cjs,
      and the new canonical export). Not consolidating the two pre-existing inline copies keeps
      the blast radius minimal but leaves the sync hazard their own comments already flag."
    - "indexNodes runs without an explicit transaction, so a concurrent reader can observe the
      index mid-rebuild. Pre-existing and unchanged by this fix."
    - "Behavior on a node:sqlite build genuinely lacking FTS5 is covered only by the existing
      MINDRIAN_FORCE_FTS_ABSENT seam, not by a real FTS5-less binary."

## Source-of-Truth Preamble

- **CODE claims read against:** branch `main` @ `2c40176e` (working tree,
  `/home/jsagi/dev/MindrianOS-Plugin`). Working tree is clean; the only local commit ahead of the
  `v1.16.0-beta.5` tag is `2c40176e` (the unrelated, already-verified statusline room-health fix).
- **WIRE claims probe against:** none. Pure LOCAL room.db / eureka_fts defect. Canon Part 8
  (LOCAL only, zero Brain egress) and Part 9 (room.db reached only through navigation.cjs) are
  both relevant constraints on the fix, not suspects in the bug itself.
- **Date of audit:** 2026-08-01
- **Re-verification rule:** `ftsIndexState(db)` was read directly against the real room's
  `room.db` (read-only `DatabaseSync`) both BEFORE and AFTER the manual repair attempt below;
  both reads returned byte-identical `{node_rows:690, fts_rows:696, orphan_rows:451}`.

## Meta

- Repo: /home/jsagi/dev/MindrianOS-Plugin
- Affected room: `~/MindrianRooms/motj-ecosystem/sub-rooms/jonathan-contractor-motj` (a
  registered sub-room, parent `motj-ecosystem`, per `~/MindrianRooms/.rooms/registry.json`:
  `{"path": "motj-ecosystem/sub-rooms/jonathan-contractor-motj", ...}`)
- Reported by: live session, discovered while cutting `v1.16.0-beta.7` to ship the statusline fix
- Date first observed: 2026-08-01 (this exact gate; the underlying staleness was already visible
  as a WARN in `/mos:doctor`'s bare-run output earlier the same session, non-blocking there)
- Related debug sessions: none found under this slug.
- **Operator note (self-correction, keep visible):** the first manual repair attempt targeted the
  WRONG path (`~/MindrianRooms/jonathan-contractor-motj`, a plausible-looking top-level guess that
  does not exist as a real room) and `requestFtsBuild`'s `mkdirSync(recursive:true)` side effect
  created a stray empty directory there. That directory was deleted before any further action.
  The correct sub-room path above was used for the second (real) attempt described below.

## Problem Statement

`doctor --acceptance --pre-tag`'s `eureka-fts-index-visible` check (`lib/core/doctor/eureka-fts-health-module.cjs`)
correctly flags `jonathan-contractor-motj`'s `eureka_fts` index as stale (451 orphan rows). The
module ships with NO `fix()` by design (`fix_supported: false` in `data/doctor-modules.json`),
documenting that repair instead happens via the lazy build-on-first-miss path
(`requestFtsBuild` + `spawnFtsBuildDrain` / `scripts/fts-index-drain.cjs`). Manually driving that
exact path end to end against the correct room produced a clean exit (0) and an emptied queue,
but did NOT reduce the orphan count at all on re-check. Either the repair path is incomplete for
the orphan-row case, or something about the manual invocation silently failed to do real work.

## Symptoms

expected: enqueuing + draining a stale room's `eureka_fts` index (the documented, sanctioned
repair path) reduces `orphan_rows` toward 0 and clears the `index_stale` classification.
actual: `requestFtsBuild(roomDir, {reason:'index_stale'})` returned `{ok:true, queued:true}`;
`node scripts/fts-index-drain.cjs --worker --room <roomDir>` exited 0 after a one-time local
embedding-model fetch (MongoDB/mdbr-leaf-ir); the queue file returned to `{"entries": []}`
afterward (looks like a clean success from the outside). But `ftsIndexState(db)` read directly
against the room's `room.db` immediately after is byte-identical to before:
`{"present":true,"reason":"index_stale","node_rows":690,"fts_rows":696,"orphan_rows":451,"healthy":false}`.
A full `node scripts/doctor.cjs` re-run still reports the same stale finding for this room.
errors: none visible. No exception, no non-zero exit, no entry logged to
`<roomDir>/.mindrian/fts-index-failures.json` (check whether that file exists/what it contains -
not yet inspected).
reproduction:
  1. `node -e "require('./lib/core/eureka/fts-index-lifecycle.cjs').requestFtsBuild(process.argv[1], {reason:'index_stale'})" "$HOME/MindrianRooms/motj-ecosystem/sub-rooms/jonathan-contractor-motj"`
     -> `{"ok":true,"queued":true,...}`
  2. `node scripts/fts-index-drain.cjs --worker --room "$HOME/MindrianRooms/motj-ecosystem/sub-rooms/jonathan-contractor-motj"` -> exit 0
  3. Re-read `ftsIndexState(db)` against the same `room.db` -> orphan_rows still 451, reason still
     `index_stale`.
  4. `node scripts/doctor.cjs` (bare run) -> `eureka-fts-health` WARN, same room, same numbers.
started: unknown how long this room's index has actually been stale (the 451 orphan rows suggest
a real backlog of deleted nodes, not a one-off). First OBSERVED as a release-blocking HARD ABORT
today, 2026-08-01, when it was previously only a non-blocking WARN on a bare `/mos:doctor` run.

## Scope and Impact

- Affected surfaces: cli (doctor's acceptance gate; also the underlying Eureka lexical-search
  feature quality for this specific room, independent of the release-gate angle).
- Affected commands: `scripts/release.sh --prerelease` (and any `--pre-tag`/`--acceptance` run)
  HARD ABORTS whenever ANY registered room's `eureka_fts` index is stale - this is not specific to
  `jonathan-contractor-motj`, that room is just the one currently tripping it.
- Severity: high for THIS release (it is the only thing standing between the tree and shipping the
  already-verified statusline fix). Medium/ongoing beyond that: if the lazy-repair path genuinely
  cannot clear orphan rows, ANY room that accumulates deleted nodes will eventually trip this same
  HARD ABORT with no automated recovery, which is a structural release-reliability risk, not just
  a one-room annoyance.
- Version range: unknown when the orphan rows accumulated; the release-blocking gate itself
  (`eureka-fts-index-visible` in `doctor --acceptance --pre-tag`) is presumably recent (ties to
  Phase 244).

## Evidence

- timestamp: 2026-08-01T00:00:00Z
  checked: `data/doctor-modules.json`'s `eureka-fts-health` entry and
  `lib/core/doctor/eureka-fts-health-module.cjs`'s header comment
  found: `fix_supported: false`; header explicitly states repair is NOT the doctor's job and
  instead happens via `requestFtsBuild` + `spawnFtsBuildDrain` (Plan 02's lazy build-on-first-miss).
  implication: there is no doctor-side `--fix` to lean on; the fix has to happen in the
  build/drain path itself, or in how staleness is measured, or both.

- timestamp: 2026-08-01T00:00:00Z
  checked: live `requestFtsBuild` + `fts-index-drain.cjs --worker --room` run against the REAL
  room path, followed by a direct `ftsIndexState(db)` re-check.
  found: the drain reports success (exit 0, queue emptied) but `orphan_rows` is unchanged
  (451 before and after, to the row).
  implication: the documented repair path, run exactly as documented, does not fix the exact
  defect the doctor gate is complaining about. Either `indexNodes()` doesn't prune orphans, or
  the "success" is not what it appears to be.

- timestamp: 2026-08-01T10:30:00Z
  checked: `lib/core/eureka/tri-modal-index.cjs::indexNodes()` read end to end (Required
  Investigation step 1).
  found: the ENTIRE lexical write leg is `:348-356`. It prepares exactly two statements,
  `DELETE FROM eureka_fts WHERE node_id = ?` and `INSERT INTO eureka_fts(node_id, text)`, and runs
  the delete-then-insert pair once per entry of `items`. `items` is built at `:337-343` from
  `SELECT id, type, properties FROM nodes`, skipping any node whose `indexedText` is empty. So
  every node_id it deletes is by construction a node_id that EXISTS in `nodes`.
  implication: root cause. A node_id that is no longer in `nodes` is never named by any DELETE, so
  its `eureka_fts` row is immortal. `indexNodes` is a per-live-node upsert, NOT a reconcile,
  despite its "Full-corpus reindex" header.

- timestamp: 2026-08-01T10:32:00Z
  checked: where the orphan reconcile actually lives (grep for the NOT IN prune).
  found: `lib/core/lazygraph-ops.cjs:803-818` (`reconcileFtsIndexInline`) runs
  `DELETE FROM eureka_fts WHERE node_id NOT IN (SELECT id FROM nodes)` guarded by
  `ensureFtsAvailable().ok` + `tableExists`, inside `rebuildGraph`'s BEGIN. Its own comment at
  `:799-802` states an identical block is duplicated in `scripts/build-ecosystem-graph.cjs` and
  that "both copies must be kept in sync". `tests/test-244-fts-rebuild-reconcile.cjs` pins that
  path with five scenarios.
  implication: the capability exists and is well tested, but ONLY on the full-graph-rebuild path.
  The FTS build/drain path (`requestFtsBuild` -> `fts-index-drain.cjs` -> `indexNodes`) never
  reaches it. The doctor gate flags `index_stale`, and the repair the doctor's header points at
  cannot clear `index_stale`. That is the structural gap.

- timestamp: 2026-08-01T10:35:00Z
  checked: live read-only measurement of the real room via `openRoomDbReadOnlyForCaller` (Canon
  Part 9 door), covering eureka_meta, eureka_vec_fallback, live-vs-orphan fts row split, and
  room.db mtime (Required Investigation step 3).
  found: `eureka_meta` = `[{embedding_dim: "384"}, {embedding_model: "MongoDB/mdbr-leaf-ir"}]`;
  `eureka_vec_fallback` = 245 rows; `SELECT count(*) FROM eureka_fts WHERE node_id IN (SELECT id
  FROM nodes)` = 245; `fts_rows` = 696; `orphan_rows` = 451; room.db mtime 2026-08-01 10:16.
  Sample orphan node_ids: `b2-journey/meetings/2026-06-28-yehuda-kaplan-narrative-kickoff`,
  `entity:entity-extract:ad970f3b`, `entity:entity-extract:1bee8c71`.
  implication: the drain DID do real work (it embedded 245 items, wrote 245 vectors and the model
  provenance row, and stamped the db at exactly the reported run time). 696 = 245 + 451 exactly.
  It rewrote precisely the live rows and left every orphan untouched, which is the fingerprint of
  the per-live-node upsert above and NOT of a silent no-op. Hypothesis (b) is eliminated.

- timestamp: 2026-08-01T10:36:00Z
  checked: `<roomDir>/.mindrian/fts-index-failures.json` and `fts-index-queue.json` (Required
  Investigation step 4).
  found: the failures log does NOT exist. The queue is `{"entries": []}`, mtime 10:16.
  implication: expected and consistent with success. `fts-index-drain.cjs` only clears a queue
  entry on a SUCCESSFUL build and only writes a failure record after FTS_BUILD_MAX_ATTEMPTS. An
  emptied queue plus no failure log is positive proof the build succeeded. Nothing was hidden;
  the build genuinely succeeded and genuinely could not fix the defect.

- timestamp: 2026-08-01T10:40:00Z
  checked: whether `DELETE FROM eureka_fts WHERE node_id NOT IN (SELECT id FROM nodes)` is even
  legal against an fts5 virtual table with `node_id UNINDEXED`, on a throwaway `:memory:` db.
  found: legal. 3 rows in, 1 live + 2 orphans, `run()` returned `{changes: 2}`, the live row
  survived, and `MATCH` still resolved it afterwards.
  implication: the fix's core statement works and reports a usable `changes` count, so the prune
  can carry honest provenance rather than being a silent write.

## Eliminated

- hypothesis: "(b) the manual enqueue + drain repair attempt silently no-op'd (stale/cached
  room.db handle, dedupe treating the room as already handled, an FTS_STALE_ORPHAN_FLOOR
  interaction, or a require.cache artifact across the two separate node processes)."
  evidence: the drain left four independent, positive traces of real work on this exact room:
  245 rows in `eureka_vec_fallback`, an `eureka_meta` row naming `MongoDB/mdbr-leaf-ir` at dim
  384 (the one-time model fetch the symptoms describe), a room.db mtime of 10:16 matching the run,
  and a queue emptied with no failure log (which `fts-index-drain.cjs` only does on success).
  A no-op produces none of those. The unchanged 451 is fully explained by (a) instead.
  timestamp: 2026-08-01T10:35:00Z

## Required Investigation (for the debugger)

1. Read `lib/core/eureka/tri-modal-index.cjs::indexNodes()` completely. Does it ever `DELETE FROM
   eureka_fts WHERE node_id NOT IN (SELECT id FROM nodes)` (or equivalent), or is it purely
   `INSERT`/`INSERT OR REPLACE`? This single read likely settles (a) vs (b).
2. If it's insert-only: that's the root cause. Design the fix carefully - re-verify Canon Part 9
   (room.db reached only through navigation.cjs) and Part 8 (LOCAL only) are honored, and consider
   whether the fix belongs in `indexNodes()` itself (a full-reconcile pass) or as an explicit
   dedicated prune step in the drain worker before/after `indexNodes()` runs.
3. If it turns out `indexNodes()` DOES prune orphans correctly: then re-drive the enqueue+drain
   path with real instrumentation (add temporary logging, or drive both steps in ONE node process
   rather than two separate `node -e` invocations, to rule out any require-cache / process-boundary
   artifact) and find out why THIS run didn't do the work.
4. Check `<roomDir>/.mindrian/fts-index-failures.json` for a permanent-failure record - if present,
   read it; if absent, confirm that's expected for whatever actually happened.
5. Whatever the root cause, fix it via TDD and verify against the REAL room
   (`~/MindrianRooms/motj-ecosystem/sub-rooms/jonathan-contractor-motj`), not just a synthetic
   fixture - the whole point is this exact room's `orphan_rows` has to actually drop.
6. Final verification: `node scripts/doctor.cjs --acceptance --pre-tag` must no longer fail on
   `eureka-fts-index-visible`.

## Resolution

root_cause: |
  `lib/core/eureka/tri-modal-index.cjs::indexNodes()` was a per-LIVE-node upsert, not a reconcile,
  despite its "full-corpus reindex" header. Its entire lexical write leg prepared
  `DELETE FROM eureka_fts WHERE node_id = ?` + `INSERT INTO eureka_fts(node_id, text)` and ran the
  pair once per entry of `items`, where `items` was built from `SELECT id, type, properties FROM
  nodes`. Every node_id the DELETE was ever bound to was therefore by construction a node_id that
  STILL EXISTED, so a row whose node had been deleted was never named by any statement in the loop
  and was immortal.

  A set-based orphan prune already existed in the repo, but only on the FULL GRAPH REBUILD path
  (`lib/core/lazygraph-ops.cjs::rebuildGraph`, duplicated verbatim in
  `scripts/build-ecosystem-graph.cjs`). The FTS BUILD path
  (`requestFtsBuild` -> `scripts/fts-index-drain.cjs` -> `indexNodes`), which is the exact repair
  the doctor's `eureka-fts-health-module.cjs` header points every operator at, never reached it.
  Since `fts-index-lifecycle.cjs` DEFINES `index_stale` as
  `orphan_rows >= FTS_STALE_ORPHAN_FLOOR` (= 1), the documented repair path was structurally
  incapable of clearing the one condition the release gate flags. The doctor module's
  "lazy build-on-first-miss repairs it" story was true for `index_absent` and `index_empty`, and
  false for `index_stale`.

fix: |
  1. `lib/core/eureka/tri-modal-index.cjs`: NEW exported `reconcileFtsOrphans(db) -> { pruned }`.
     Self-guards on `ensureFtsAvailable().ok` and `tableExists(db, 'eureka_fts')` (either guard
     short-circuits to `{ pruned: 0 }`), then runs
     `DELETE FROM eureka_fts WHERE node_id NOT IN (SELECT id FROM nodes)` and returns the honest
     `changes` count. It deliberately does NOT swallow: on the build path a swallowed reconcile
     fault would be a "successful" build that silently did not reconcile, i.e. this exact bug
     regenerated. Propagating hands it to `fts-index-drain.cjs`'s existing keep-on-failure + retry
     + permanent-failure-record discipline (its own stated NEVER SILENT ROT contract).
  2. `indexNodes()` calls it INSIDE the existing `ftsLive` capability gate, before the per-node
     upsert loop, and surfaces the count as an additive `fts_pruned` return key. Order is
     irrelevant here because `indexNodes` only ever READS `nodes` (unlike `rebuildGraph`, which
     must reconcile AFTER its reindex because it wipes and regenerates `nodes` in the same
     transaction). No BEGIN/COMMIT was added: the function awaits `embedTexts` mid-body and holding
     a write transaction across that await would lock room.db for the whole embed batch.
  3. Additive-key safety RE-CONFIRMED at all four call sites before relying on it:
     `scripts/eureka-portfolio-report.cjs:883` (reads `idx.embedded`, `idx.vec_backend`),
     `scripts/eureka-room-report.cjs:304` (same two), `scripts/entity-extract.cjs:924` (reads
     `idx.embedded`), `scripts/fts-index-drain.cjs:172` (ignores the return entirely). None
     deep-equals the shape, so `fts_pruned` is safe.
  4. CONSOLIDATION (the sync hazard both former copies' own comments flagged): `lazygraph-ops.cjs`
     and `scripts/build-ecosystem-graph.cjs` now delegate to `tri.reconcileFtsOrphans(conn)`
     instead of each carrying its own copy of the DELETE SQL. There is now exactly ONE copy.
     Each caller KEEPS its own `try/catch` swallow, because on the rebuild path a reconcile fault
     genuinely must not abort an otherwise-succeeding rebuild. Fault policy stayed at the call
     site; only the operation was extracted.
  5. Doc comments corrected: the module Exports header and the `indexNodes` block no longer claim
     unqualified "full-corpus reindex" / "idempotent" without naming that the old idempotence was
     scoped to LIVE nodes only.

verification: |
  1. TDD GREEN: `node tests/test-244-fts-build-orphan-prune.cjs` -> PASS=5 FAIL=0 (was 0/5).
  2. Regression: `bash tests/run-all-244.sh` -> PASS=10 FAIL=0 SKIP=0 (includes the sibling
     `test-244-fts-rebuild-reconcile.cjs` 5/5, which pins the consolidated rebuild path, and the
     244 no-em-dash fence).
  3. Wider regression on every suite touching the three changed files, all green:
     test-211-tri-modal 12/12, test-211-vec0-capability 5/5, test-211-vector-store 5/5,
     test-219-fts5-degrade 4/4, test-236-rebuild-preserves-journal 5/5,
     test-236-rebuild-crash-mid-transaction 4/4, test-236-rebuild-wal-concurrent-read 3/3,
     test-236-ecosystem-graph-preserves-journal 7/7, test-236-backfill-default-preserves-journal
     6/6, test-240-jtbd-event-survives-rebuild 6/6, test-nested-artifact-indexing exit 0.
  4. REAL ROOM (`~/MindrianRooms/motj-ecosystem/sub-rooms/jonathan-contractor-motj`), repaired
     through the SANCTIONED path only (`requestFtsBuild` then
     `node scripts/fts-index-drain.cjs --worker --room <roomDir>`, exit 0, queue emptied, no
     `fts-index-failures.json` written):
       BEFORE {"present":true,"reason":"index_stale","node_rows":690,"fts_rows":696,"orphan_rows":451,"healthy":false}
       AFTER  {"present":true,"reason":"ok",         "node_rows":690,"fts_rows":245,"orphan_rows":0,  "healthy":true}
     ANTI-VACUITY: 696 - 451 = 245 exactly, and the 245 surviving rows equal the independently
     derived live-row count and the `eureka_vec_fallback` row count. The prune cut along exactly
     the orphan/live line; it did not reach zero by emptying the index.
     A pre-repair byte copy of room.db was taken to
     `<scratchpad>/room.db.pre-fts-prune.bak` before any write.
  5. RELEASE GATE: `node scripts/doctor.cjs --acceptance --pre-tag` -> exit 0, 13/13 points passed,
     with `PASS eureka-fts-index-visible: local lexical trigger index (eureka_fts) is present and
     not stale, per registered room`. No other gate fails.
  6. Repo-wide: bare `node scripts/doctor.cjs` -> `eureka-fts-health` now reads
     "45 room(s) measured: 8 with a built index, 37 absent (Tier 0 default, not a defect), 0 empty,
     0 stale". The earlier WARN is gone across every registered room, not just this one.
  7. Gates: `node scripts/check-substrate.cjs` exit 0 (eureka_fts is a derived projection, not a
     nodes/edges reach, so no net-new substrate reach was introduced); `verify-release` and the
     connector/orchestration-projection/render coverage gates all PASS inside the acceptance run;
     0 em-dashes in every changed file. Canon Part 9 honored (caller-owned handle, no room-db.cjs
     require added, zero typed edges / memory_event / node mutations; eureka_fts is a freely
     rebuildable derived projection). Canon Part 8 honored (zero network reach added).

files_changed:
  - lib/core/eureka/tri-modal-index.cjs   # new reconcileFtsOrphans export; indexNodes calls it inside the ftsLive gate; additive fts_pruned; corrected doc comments
  - lib/core/lazygraph-ops.cjs            # rebuildGraph's inline reconcile now delegates to the shared helper, keeps its own swallow
  - scripts/build-ecosystem-graph.cjs     # same delegation, keeps its own swallow
  - tests/test-244-fts-build-orphan-prune.cjs  # NEW (RED phase), 5 scenarios
  - tests/run-all-244.sh                  # registers the new test

## Pre-existing, UNRELATED, not fixed here

- `node tests/test-sqlite-ops.cjs` fails 4 subtests (`SQLITE-01: Database lifecycle`,
  `SQLITE-02: Core functions`, `All 21 exports present`; 48 pass / 4 fail). CONFIRMED PRE-EXISTING:
  re-run with all three of this session's source changes `git stash`ed produced byte-identical
  failures. Out of scope for this RCA, does not touch eureka_fts, and does NOT block
  `doctor --acceptance --pre-tag` (which is 13/13). Worth its own session.
- `agentshield-all-surfaces-clean` PASSES with an advisory `WARN: 2 ambiguous finding(s) across
  surfaces (no flagged; blocker not tripped)`. Pre-existing and non-blocking.

## Non-Code Follow-ups

- DONE. `rethinking-mindrianos` room: filed at
  `~/MindrianRooms/rethinking-mindrianos/research/2026-08-01-fts-build-path-upsert-not-reconcile/2026-08-01-fts-build-path-upsert-not-reconcile.md`
  per the Dev-Research Compositing convention, cross-linked back to this file. Its carry-forward
  generalizes the defect class (a per-key upsert driven by iterating the SOURCE cannot reach the
  difference set; an "X repairs this" header is an untested behavioral claim; extract the
  operation but leave fault policy at the call site).
- PENDING (operator's call, deliberately NOT run by this session): `bash scripts/release.sh
  --prerelease --allow-ahead` to cut the release containing the statusline fix (`2c40176e`) plus
  this one. The gate that was blocking it is now clear.
- PENDING: knowledge-base.md summary block, on the move to `.planning/debug/resolved/`.
- FOLLOW-UP (logged, deliberately out of scope): rows for nodes that STILL exist but no longer
  yield indexable text stay stale. They are not orphans by `countOrphans`' definition so they never
  trip the gate, and no current surface is degraded by them.
