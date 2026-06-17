# Phase 162 deferred items (out-of-scope discoveries during execution)

## DI-162-02-01: pre-existing em-dashes in scripts/generate-standalone

Discovered during Phase 162-02 Task 2 (repoint dashboard graph.json writer).

`scripts/generate-standalone` carries 5 pre-existing em-dash characters (U+2014)
in comment lines and embedded HTML/Python strings (lines 4, 117, 131, 145, 152 at
HEAD before this phase). These violate the CLAUDE.md NO-EM-DASH HARD RULE but are
NOT in any line this phase modified (the phase only changed the build-graph call
on lines ~34-37, which use hyphens).

Per the executor SCOPE BOUNDARY (only auto-fix issues directly caused by the
current task's changes), these are logged here rather than fixed inline. A
dedicated em-dash sweep should clean them.

## DI-162-02-02: pre-existing test-confirm-claim-flow.cjs failure (last_modified_at)

`tests/test-confirm-claim-flow.cjs` has 2 FAILED assertions with
`{"ok":false,"reason":"no such column: last_modified_at"}`. The test builds its
in-memory db via `tests/claim-harness/build-fixture-room-db.cjs applySchema`,
which does NOT include the Phase 160 bitemporal column `last_modified_at` that
confirm-node.cjs now references. This is a claim-harness fixture vs bitemporal
migration drift, fully independent of Phase 162-02 (which touched neither
confirm-node.cjs, the bitemporal migration, nor the claim-harness fixture).

PROOF it is pre-existing: with all Phase 162-02 source changes reverted to the W1
base commit 07eeeed0, the same 2 assertions still FAIL identically.

## DI-162-02-03: pre-existing test-connector-exhaustive-coverage.cjs failure (RETRO-07)

`tests/test-connector-exhaustive-coverage.cjs` (Phase 144.1 RETRO-07 gate) has 2
FAILED checks: CHECK 1 (1 surface classified in NEITHER registry nor allow-list)
and CHECK 2 (1 surface double-classified). This gate audits commands/ + skills/ +
agents/ against data/connector-registry.json -- none of which Phase 162-02
touched. Phase 144.1 is PLANNED (not shipped) in the canon map, so this gate is
expected RED until that sweep lands.

PROOF it is pre-existing: identical "4 passed, 2 failed" at the W1 base commit
07eeeed0 with all Phase 162-02 source reverted.

## DI-162-02-04: openRoomDb FK-rebuild fragility on un-migrated rooms WITH edges (pre-existing)

migrateSectionNodes(roomDir) opens room.db via roomDbMod.openRoomDb (the
allow-listed lazy creator + migration chain). When a room.db was created with the
BARE 3-column lazygraph schema (via openGraph) AND already carries edges, the
first openRoomDb call runs the Phase-109 provenance migration which RE-CREATES the
nodes table with `foreign_keys = ON`; the existing edges then trip
"FOREIGN KEY constraint failed" DURING the openRoomDb migration, before any
Phase-162 logic runs. migrateSectionNodes degrades gracefully here
({ok:false, reason:'open_room_db_failed'}) rather than throwing or corrupting.

Scope assessment: this is a PRE-EXISTING openRoomDb / phase-109 migration
fragility, not introduced by Phase 162-02. Production rooms are unaffected:
birthRoom opens room.db via openRoomDb from the start, so the schema is wide
before any edge is written, and migrateSectionNodes on a properly-migrated room
WITH edges succeeds (verified: {ok:true, migrated:2}). The only trip path is the
synthetic openGraph-3col-then-edges-then-openRoomDb sequence. A follow-up should
harden the phase-109 nodes-table re-create to defer FK enforcement during the
rebuild (PRAGMA defer_foreign_keys), which would fix the whole legacy-room class.

## DI-162-02-05: dashboard/graph.json CWD-relative default output pollutes a committed file

`scripts/build-graph` (line 727) and `lib/core/graph-ops.cjs` (line 44) default their
output to a CWD-relative `./dashboard/graph.json`. When a test or manual run executes
`build-graph` with cwd at the repo root and a throwaway room as input (and without
pinning cwd to a temp dir, the way `tests/test-cascade-surface-loop-fires.cjs:108`
does), it OVERWRITES the git-committed `dashboard/graph.json` snapshot with transient
data. Observed during W2 verification: the working tree carried an overwrite sourced
from `roomDir: /tmp/ac-cQMmwh/room` (53 nodes / 11 edges, roomName "Data Room"); it
was discarded via `git checkout -- dashboard/graph.json`. The HEAD snapshot is itself
a fixture export (`/tmp/chatctx-hnzttu/rooms/fixture`, 14 nodes), never live room data,
and historically gets swept into "housekeeping" commits (53ce6f31, d6e0a7b4) -- so the
pollution is invisible noise rather than a tracked deliverable.

Scope assessment: a single-authority-graph phase should not leave a committed graph
artifact that any unpinned run can silently clobber. Candidate fixes (a later wave):
(a) move the committed snapshot out of the default output path, (b) make the default
output a temp/ignored path and require an explicit `--out dashboard/graph.json` for the
committed snapshot, or (c) gitignore `dashboard/graph.json` entirely and regenerate it
at release time. Logged here rather than fixed in W2 (out of the 162-02 task scope).

## Carried-fence note

run-all-155.sh aggregates carried fences (run-all-1441 / run-all-146 / run-all-150.5)
that transitively include the two pre-existing failures above. Phase 162-02's own
new gates are all GREEN:
- tests/test-section-nodes-birth-and-migration.cjs 5/5
- tests/test-dashboard-graph-feed.cjs 3/3
- tests/test-graph-export.cjs 5/5 (W1 regression fence)
- tests/test-memory-events-birth-floor.cjs 20/20
- scripts/check-substrate.cjs exit 0
