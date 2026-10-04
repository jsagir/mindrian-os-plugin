---
phase: 369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-
plan: 39
subsystem: mcp-read-surfaces
tags: [gap-closure, review, feed, room_changes, room_search, wr-07, wr-08, wr-19, d-18]
requires: [369-33]
provides:
  - room_changes refuses a cursor beyond the log head (checkpoint_expired)
  - room_changes metadata and page rows from one read transaction
  - room_search never follows a symlink and never reads outside the room
affects: [lib/mcp/tools/feed.cjs, lib/core/navigation/room-projection.cjs, lib/mcp/tools/room.cjs]
key-files:
  created: [tests/test-369-read-surfaces.cjs]
  modified: [lib/mcp/tools/feed.cjs, lib/core/navigation/room-projection.cjs, lib/mcp/tools/room.cjs]
requirements-completed: [REV369-07, REV369-15]
duration: ~25 min
completed: 2026-10-04
---

# Phase 369 Plan 39: Read-surface findings (WR-07, WR-08, WR-19) Summary

A future feed cursor now answers checkpoint_expired, a page's metadata and rows are one read transaction, and room_search skips every symlink and re-checks real-path containment before each read.

## Commits

- 0dbe55d0a test(369-39): RED proofs. First FAIL line quoted in the commit: `future cursor must not be ok: ... through=5003 latest_seq=3` (5 of 9 arms red).
- ea9ed3698 fix(369-39): the three fixes (feed.cjs, room-projection.cjs, room.cjs) plus the final detector arm.

## What changed and why

- **WR-07** (room-projection.cjs `readChanges` guard, feed.cjs): a cursor above `latest_seq` under the same epoch now returns the existing `checkpoint_expired` shape (room, epoch, floor, snapshot_revision = head). Cursor == head still answers ok with no changes. Same answer shapes, same key order; descriptions and schemas untouched.
- **WR-08**: `readChanges` now owns one deferred `BEGIN` on the caller's handle (reused if the caller already holds a transaction, the compactChangeLog "owns" idiom), reads the change-log meta first (fixing the WAL snapshot), then the rows, node lookups and the has_more probe. The feed passes `opts.guard = { epoch }`, so the epoch check, floor check, future-cursor check and the page all come from that one snapshot; reset answers are returned from `readChanges` as `{ reset, epoch, floor, snapshot_revision }` and feed.cjs turns them into the unchanged wire shape. A post-rows floor re-check answers checkpoint_expired if the floor overtook the cursor (unreachable inside a held WAL snapshot; it is the second line for a handle that cannot hold one). The change was kept inside room-projection.cjs (a plan-named file) because navigation.cjs is not a plan file, so no new export was added; Part 9 holds (no SQL or node:sqlite in lib/mcp).
- **WR-19**: room_search skips any Dirent that is a symbolic link (file or directory) and requires `isRealpathContained(roomDir, full)` before counting or reading a file, the rule room_artifact already applies. A refused file is skipped silently like an unreadable one. Consequence by design: an in-room symlink alias is also skipped (the plan says skip all symlinks), arm WR-19b pins that.

## Proofs (tests/test-369-read-surfaces.cjs, PASS=9 FAIL=0)

- WR-07a/b: future cursor refused with snapshot_revision = head; cursor at head ok and empty; head+1 refused.
- WR-08a (detector): metadata-then-rows with no transaction, with a compaction on a second connection fired by patching `DatabaseSync.prototype.prepare` just before the rows statement, shows the gap (first seq above 1 with from 0); the same interleave inside BEGIN on the read-only handle still starts at seq 1. This also proves a deferred BEGIN is legal on the read-only WAL handle.
- WR-08b: `room_changes` across the interleaved compaction returns a complete page or checkpoint_expired. Mutation check: with the transaction AND the re-check both disabled, this arm fails ("page starts at ... got 31"); with only the transaction disabled it still passes because the re-check catches the overtaken floor. Both layers verified by hand; room-projection.cjs restored byte-identical afterwards.
- WR-08c: cursor overtaken between calls is checkpoint_expired.
- WR-19a-c: outside-pointing symlinked file not read (plain sibling found), in-room alias skipped, symlinked directory skipped.

## Verification results

- test-369-room-changes PASS=11, test-369-change-log-compaction PASS=8, test-369-room-artifact PASS=8 (unchanged), test-369-feed-guards PASS=11, test-369-sse-room-changed PASS=7, test-369-constitution 7/0, test-369-writer-inventory PASS=29, tx-ownership static 8 of 8.
- `check-tool-honesty` OK (45 tools, 0 high-risk); `build-connector-registry --check` and render-coverage OK. No description or inputSchema moved, so no wire baseline was re-frozen.
- `bash tests/run-all-267.sh`: PASS=26 FAIL=5 SKIP=3. Failures are the expected-red window until plan 41, none involve room_changes or room_search: connector-descriptor count 35 vs baseline 34; zod4 description diffs on gate_answer, gate_render, room_list and a gate_list membership change; two new zod importers in scripts/mindrian-*.cjs (369.1 files); live tool count 48 vs snapshot 47; dual-era and shim snapshot-count follow-ons. Recorded, not re-pinned.

## Deviations from Plan

- **tests/e2e-369/replica.cjs not run.** The plan asks for it, but the parallel-tree notice for this execution forbids the e2e-369 browser suites while 369-34 soaks. Coverage substitute: the feed response key order and fields are byte-for-byte as before (test-369-room-changes 11 arms, including paging, resets and the live daemon arm). The replica run is owed to the verifier or plan 41 once the tree is quiet.
- **WR-08a detector reshaped** after the fix: `readChanges` became transactional itself, so the detector uses raw metadata-then-rows SQL on the handle instead of the old function (committed with the fix commit, since the RED version could only exercise the old non-transactional path). No other deviation.

## Decision recorded: epoch-reset half of WR-07 not built

A restored room.db carries its own older `sqlite_sequence` high-water mark and its own epoch, so nothing inside the restored file can reveal the regression. The feed refusal covers the browser symptom: a browser cursor ahead of the restored head is sent to a snapshot. Residual (T-369-39-04, accepted): a restored copy whose head has already passed the browser's cursor looks like a normal continuation; that needs an out-of-band signal, not a feed change. Snapshot mode still reads its meta and snapshot rows separately (as_of_seq travels with the cursor); left as is, out of this plan's scope.

## Threat Flags

None. No new network, auth or file-write surface; room_search surface only narrowed.

## Self-Check: PASSED

- FOUND: tests/test-369-read-surfaces.cjs, commits 0dbe55d0a and ea9ed3698, no em or en dashes in the four code files.
- STATE.md, ROADMAP.md and 369.1-owned files untouched.
