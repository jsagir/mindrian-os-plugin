---
phase: 367-newborn-room-graph-connected-no-repair
plan: 05
subsystem: graph-index
tags: [catch-up-runner, job-lock, write-lock, status-file, cache, ac3, ac5, ac10]
requires:
  - "367-01 (listContentArtifacts)"
  - "367-03 (indexArtifactsBatch, computeHash, _readArtifactContent)"
  - "400.3-01 (openGraph mustExist and busyMs, acquireLockWithBackoff, INDEX_LOCK_WAIT_MS, classifyIndexError)"
provides:
  - "scripts/graph-catchup.cjs: run, parseArgs, takeWriteLock, classifyLockError, resolveRoomSet"
  - "lib/core/bg-worker.cjs: lowerWorkerPriority, armBackstop"
  - "<room>/.mindrian/graph-catchup.json status file and graph-catchup-cache.json cache"
affects:
  - "plan 367-06 (CLI hook triggers spawn this runner)"
  - "plan 367-08 (card leg calls run() and takeWriteLock)"
  - "plan 367-10 (doctor reads the status file and the job lock)"
tech-stack:
  added: []
  patterns: ["preload stub of a module-object function (-r) for lock-error mapping tests", "status file and cache by temp file plus rename, mode 0600"]
key-files:
  created:
    - lib/core/bg-worker.cjs
    - scripts/graph-catchup.cjs
    - tests/test-367-catchup-cli.cjs
  modified:
    - scripts/gsd-graph-derive-drain.cjs
    - scripts/check-substrate.cjs
    - tests/test-379.1-worker-caps.cjs
decisions:
  - "The runner reads <rooms home>/.rooms/registry.json itself for the registered --room test, because resolve-active-room.cjs does not export readRegistry; it calls the exported registryRoomPath per slug."
  - "A deferred batch (write_lock_held) saves the cache with the cursor at the last committed point before the room ends."
  - "The cursor after a committed batch is the rel of the last examined file (every examined file is then committed, cache-refreshed or counted)."
metrics:
  duration: "about 45 min"
  completed: 2026-11-26
  tasks: 2
  files: 6
---

# Phase 367 Plan 05: The catch-up runner, files leg Summary

`scripts/graph-catchup.cjs` catches a room's graph up to its files in one bounded, detached run: room set and room.db guard first, a per-room job lock, an atomic 0600 status file, a stat-and-hash cache with a cursor, 10-file or 250 ms batches under write.lock (acquireLockWithBackoff) inside withRoomTx, a 15 s budget and the design 5.2 state and reason words, all on the Phase 400.3-01 primitives with no stand-in.

BASE = ae7ce772719a92a1c0e17793ca63e24162f5e3be (git rev-parse HEAD at the start of Task 1).

## Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | bg-worker.cjs, the runner, room set, guard, locks, status, files leg | 57be8bcaa | lib/core/bg-worker.cjs, scripts/graph-catchup.cjs, scripts/gsd-graph-derive-drain.cjs, scripts/check-substrate.cjs, tests/test-367-catchup-cli.cjs |
| 2 | files leg arms U8-U11, AC3, AC5, AC10, the deferred cursor | 57daaf265 | scripts/graph-catchup.cjs, tests/test-367-catchup-cli.cjs, tests/test-379.1-worker-caps.cjs |

## The 400.3-01 primitive calls (scripts/graph-catchup.cjs at 57daaf265)

- :232 `function classifyLockError(err)`: "could not be acquired after retry" is lock_io_error first; else graphOps.classifyIndexError(err) === 'write_lock_held' is write_lock_held; else lock_io_error.
- :243 `function takeWriteLock(room)`; :245 `writeLock.acquireLockWithBackoff(room, { totalMs: graphOps.INDEX_LOCK_WAIT_MS })` (no literal 750).
- :291 `lazygraph.openGraph(room, { mustExist: true, busyMs: OPEN_BUSY_MS })`, OPEN_BUSY_MS = 5000 with the design section 4 comment.
- The release is `writeLock.releaseLock(room, handle)` after each batch. No bare `acquireLock(` call (PROVEN by the Task 2 verify grep).

## Design r7 section 4 against main

Plan 400.3-01 is on main at the base of this branch. The runner uses the primitives at once; no stand-in and no stand-in marker exist (PROVEN: `grep -c "until 400.3-01" scripts/graph-catchup.cjs` gives 0). The room guard `fs.existsSync(<room>/.mindrian/room.db)` runs before the job lock, any mkdir and the status file (U2). openGraph mustExist closes the window between the guard and the open (U11).

## Owner rulings after the 400.3 build, checked

- C10: no conflict. The batch transaction is navigation.withRoomTx (BEGIN IMMEDIATE); lazygraph indexArtifact is not changed (367-03 records the transfer to 400.3-06).
- H5: KNOWN-OPEN until plan 400.3-08. This plan does not fix or claim H5.
- D-10 against D-01: no conflict. The runner never creates room.db (guard plus mustExist, U2 and U11) and does not change the legacy cascade.
- D-03 amended: no conflict. Path candidates (cwd room, --room with .room-root) use .room-root then the room.db guard; identity candidates (session.primary, a registered --room, the registry active room) need room.db only (U3 arm E).
- Plan 400.3-08 stays a 400.3 plan. Seams kept: the require-safe run() export and the per-room job lock path.

## The 400.3 follow-up "no catch-up sweep re-indexes a filing whose index failed"

Closed for the rooms of the runner's room set once a trigger spawns the runner (plans 367-06, 367-11, 367-12): AC3 proves that a file with no node is indexed by the next run, and that the graph id set then equals the listContentArtifacts id set.

## Measurements (AC10, this host)

2,000 generated files in 20 sections: up to date in 1 run, 200 batches, longest BEGIN IMMEDIATE hold 28 ms (bound 500 ms); with the cache deleted, complete with files_indexed 0 in 1 run; one warm run 72 ms (bound 1000 ms). AC5: deferred, write_lock_held, inside 2000 ms.

## Regression runs (base-red rule)

List: every file of `grep -l "gsd-graph-derive-drain" tests/*.cjs`, plus tests/test-354-write-lock-ownership.cjs and tests/test-276-busy-timeout-propagation.cjs (17 files).

| File | BASE | After 57daaf265 |
|------|------|-------|
| tests/test-169-brain-boundary.cjs | PASS | PASS |
| tests/test-224-cost-bound.cjs | PASS | PASS |
| tests/test-224-encoder-skip.cjs | PASS | PASS |
| tests/test-224-per-write-derive.cjs | PASS | PASS |
| tests/test-224-proposed-only.cjs | PASS | PASS |
| tests/test-233-drain-backfill-producer-parity.cjs | PASS | PASS |
| tests/test-261029-qef-hook-timeouts.cjs | FAIL | FAIL |
| tests/test-261118-vbv-hook-telemetry-queue.cjs | PASS | PASS |
| tests/test-276-busy-timeout-propagation.cjs | PASS | PASS |
| tests/test-354-write-lock-ownership.cjs | PASS | PASS |
| tests/test-379.1-doctor-check.cjs | PASS | PASS |
| tests/test-379.1-pair-cursor.cjs | PASS | PASS |
| tests/test-379.1-queue-lock.cjs | PASS | PASS |
| tests/test-379.1-vector-cache.cjs | PASS | PASS |
| tests/test-379.1-worker-caps.cjs | PASS | PASS |
| tests/test-graph-derive-health-stale-skip.cjs | PASS | PASS |
| tests/test-graph-derive-sweep.cjs | PASS | PASS |

tests/test-261029-qef-hook-timeouts.cjs is base-red (A1 shape against a13ab61f1); this plan does not touch hooks. tests/test-379.1-worker-caps.cjs turned red after Task 1 and is green again after the fix below (14 passed).

Earlier plans stay green: test-367-artifact-set 7 passed; test-367-begin-immediate all 25 passed, 1 known-open (I1); test-400-3-mcp-filing-index 25 passed; test-400-3-room-root-detection cascade 13 passed.

## Verification

- `node tests/test-367-catchup-cli.cjs all`: 52 passed, 0 failed.
- The Task 1 verify (drain re-export identity, check-substrate --diff with the runner staged): exit 0.
- The Task 2 verify (no stand-in marker, acquireLockWithBackoff( present, mustExist: true present, no bare acquireLock(, no network text): exit 0.
- `node scripts/check-substrate.cjs --diff` before each commit: exit 0. No em-dash in any touched file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The registered --room test read a function that is not exported**
- **Found during:** Task 1
- **Issue:** resolve-active-room.cjs does not export readRegistry, so a registered --room without .room-root never matched.
- **Fix:** the runner reads `<rooms home>/.rooms/registry.json` itself (the same parse) and calls the exported registryRoomPath per slug. U3 gained arm E (a registered room without .room-root gets a status).
- **Files modified:** scripts/graph-catchup.cjs, tests/test-367-catchup-cli.cjs
- **Commit:** 57be8bcaa

**2. [Rule 1 - Regression caused by the move] tests/test-379.1-worker-caps.cjs arm (3)**
- **Found during:** Task 2 regression run
- **Issue:** the source fence looked for `os.setPriority`, the priority constants and `.unref()` in the drain source; Task 1 moved those bodies to lib/core/bg-worker.cjs.
- **Fix:** the arm reads those three facts from bg-worker.cjs and checks that the drain requires bg-worker.cjs. The worker-branch and detach-order checks are unchanged.
- **Files modified:** tests/test-379.1-worker-caps.cjs (not in the plan file list)
- **Commit:** 57daaf265

**3. [Rule 2 - Correctness] A deferred batch persists the cache cursor**
- **Found during:** Task 2 (AC5 "the cache cursor is persisted")
- **Fix:** on write_lock_held the runner saves the cache (cursor at the last committed point) before the room ends deferred.
- **Commit:** 57daaf265

**4. [Process] The files leg landed in the Task 1 commit.** The runner was written in one step; Task 2 added the arms and the deferred-cursor fix. The U8-U11, ac3, ac5 and ac10 arms therefore passed on their first run (no RED run for them). The unit group U1-U7 had a RED run (6 passed, 21 failed).

## Notes

- Root files of a room: D-367-01 (deferred-items.md) applies. `_indexArtifactBody` retypes a root file's node to Section, so a root file has no Artifact-typed node and its hash compare misses on every cache-cold run (it is re-indexed then; a warm cache skips it). The AC3 and AC10 fixtures hold section files only.
- The card leg (design 5.2 step 6) is plan 367-08; its counters stay 0 (a comment marks the place in _runRoom).
- Agent runs: the same single gsd-executor run as 367-01. Tokens: not measurable from inside the agent.

## Known Stubs

- scripts/graph-catchup.cjs _runRoom: the card leg is absent and cards_* counters are always 0. Intentional; plan 367-08 adds the card leg in this phase.

## Self-Check: PASSED

- FOUND lib/core/bg-worker.cjs, scripts/graph-catchup.cjs, tests/test-367-catchup-cli.cjs
- FOUND commits 57be8bcaa, 57daaf265
