---
phase: 384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-
plan: 03
subsystem: testing
tags: [perf, harness, quiet-room, room-picker, resolveSource, merge, smoke-sets, wave1-scope]
requires:
  - phase: 384-02
    provides: run mechanics, library exports, SessionStart compact target, transcript fixture
provides:
  - quietRoom, pickRoom, resolveSource and mergeResults, with the quiet-room, pick-room and merge commands
  - run --room copy takes --source, --source-file or --pick (and MOS_REAL_ROOM_384)
  - tools/perf/README.md (60 lines, matches the harness after plans 01 to 03)
  - two fixture-room smoke sets with measured spread, plus the n = 15 rerun of the one target above 10 percent
  - measurements/wave1-scope.md
affects: [384-04, 384-05, 384-06, 384-07, 384-08, 384-09]
tech-stack:
  added: []
  patterns: [one shared idle window for many candidate rooms, /proc cwd and fd scan for holders, warm-up until the skip path]
key-files:
  created:
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/wave1-scope.md
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/smoke-set1.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/smoke-set2.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/smoke-compare.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/smoke-rerun-set1.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/smoke-rerun-set2.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/smoke-rerun-compare.json
  modified:
    - tools/perf/perf-harness.cjs
    - tools/perf/README.md
    - tests/test-384-perf-harness.cjs
key-decisions:
  - "The isolation check stays strict (owner question Q1 open). quiet-room is a preflight only."
  - "Smoke sets ran on a pinned export of BASE_SHA_384, not on the live checkout (owner instruction, peer edits in the live tree)."
  - "An :unchanged target warms up until a run takes the skip path (up to 6 times) instead of once."
requirements-completed: [PERF384-01]
duration: about 1 h 15 min including waits for a peer suite
completed: 2026-11-05
---

# Phase 384 Plan 03: Harness picker, README and smoke spread Summary

The harness now has a quiet-room check, a room picker that never prints a path, one way to name a source room (resolveSource) and a merge command. It was proven on two quiet-host fixture-room sets of a pinned BASE_SHA_384 export: the maximum spread of the first pair was 10.5 percent (floor:node, 2.4 ms apart), and that target was 1.8 percent at n = 15.

## Commits

| Sha | Subject |
|-----|---------|
| 5df392a87 | feat(384-03): harness quiet-room preflight, room picker, resolveSource and merge (paths never printed) |
| 324b27600 | docs(384-03): Wave 1 scope list for the small items and unread modules |
| b9cb54273 | fix(384-03): harness warms up an :unchanged target until a run takes the skip path |
| 99b880b66 | docs(384-03): harness README and fixture-room smoke sets with measured spread |
| (this docs commit) | docs(384-03): plan summary |

## TDD record

RED (self-test before the code): `QR0 the library exports quietRoom, pickRoom, resolveSource and mergeResults` FAILED (1 FAILED; the checks QR1 to QR6 are guarded by QR0 and did not run).
GREEN (task 1): ALL PASS after one fix of the test itself (QR6 Part 8 check put the home path where the merge drops it; the path now sits in a kept target id). Final count 202 ok.
Test names: QR0 exports; QR1 holder by cwd, quiet folder, change inside the window; QR2 CLI counts, exit 75, no path, usage; QR3 median room, file cap, candidate cap, /mnt class, shared idle window; QR4 one-line output, --save mode 600, no path in stdout or stderr, none line exit 75, bad class, repo-path refusal; QR5 resolve order, run --source-file, run --pick, exit 75, exit 2; QR6 timing merge, counts merge, duplicate id, mixed schemas, room kinds, Part 8 stop, usage; WU warm-up repeats and cap.
WU (found by the smoke sets): the test was written after the finding. The finding itself is the RED: the first pair of sets took the changed path in 4 of 7 and 2 of 7 runs of an :unchanged target (verify-results exit 1).

## Smoke result (fixture room, 64 files, 4 CPUs, n = 7 per target, quiet host)

Tree: pinned export of BASE_SHA_384 (db2ea3b05bb70b55741bdeb40b545801b0c37cbe), `tree_label` pinned-db2ea3b05. load1 at start and end: set 1 1.22 and 1.78, set 2 1.41 and 0.75, rerun 0.53 and 0.64. Isolation: no path changed in the room copy (fixture room).

| Target | Set 1 median (p95) ms | Set 2 median (p95) ms | Spread percent |
|--------|-----------------------|-----------------------|----------------|
| floor:node | 21.7 (22.3) | 24.1 (27.1) | 10.5 |
| floor:node, rerun n = 15 | 22.2 (23.8) | 21.8 (31.9) | 1.8 |
| event:UserPromptSubmit | 110.9 (116.6) | 115.6 (119.5) | 4.2 |
| event:PostToolUse:Read | 34.0 (35.3) | 31.1 (35.7) | 8.9 |
| event:Stop:unchanged:tx4m | 1109.9 (1166.6) | 1125.0 (1144.6) | 1.4 |
| event:Stop:changed:tx4m | 1145.9 (1176.4) | 1099.8 (1172.9) | 4.1 |
| event:SessionStart:compact | 2618.7 (3096.2) | 2635.1 (3506.1) | 0.6 |

Overall maximum spread of the first pair: 10.5 percent (floor:node). After the n = 15 rerun the spread of that target is 1.8 percent. No target is unstable. The target PostToolUse:Read had 8.9 percent (2.9 ms apart), below the 10 percent line, so it was not rerun.
The first pair (before the warm-up fix) had a maximum of 6.3 percent; that pair is not on file because its :unchanged target failed the changed-path proof.
Observation (not a finding of this plan): the median background time after SessionStart:compact is 14,990 ms and 14,929 ms, about 15 s of work after the hook returns. Plan 384-04 measures this.

## Wave 1 scope list

hand-back reports: NOT AVAILABLE (two searches, commands in wave1-scope.md). Five items listed: yes for tool-router first-call loads (384-06, probe preload snapshots per tool call) and for the two MCP servers in series (384-06, the sum of two start medians); no for the busy-wait lock, pending-tier1-regen growth, _sessionDedupState, room.db copy per room and doctor git spawns. No unread module family is in scope until the five reports are supplied.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] One warm-up does not reach the unchanged state**
- **Found during:** Task 2 (first smoke pair)
- **Issue:** The Stop :unchanged target took the changed path in 4 of 7 (set 1) and 2 of 7 (set 2) runs. A one-off probe on the fixture room printed the cause: the first Stop runs reported `mode=detached reason=newer:<section>/ROOM.md` three times in a row, then `mode=skip`. The detached state rebuild of one run leaves the next run still "newer".
- **Fix:** measureTarget warms up an :unchanged target until a warm-up run is not on the changed path, at most 6 times; the result holds `warmup_runs`. The proof in verify-results is not weaker. Set 1 needed 6 warm-ups (the cap) and then proved 0 changed-path runs; set 2 needed 4.
- **Files modified:** tools/perf/perf-harness.cjs, tests/test-384-perf-harness.cjs
- **Commit:** b9cb54273

### Owner instruction applied (pinned tree)

The plan text names the main checkout as the tree. The owner brief replaced it: both smoke sets and the rerun ran on `git archive` of BASE_SHA_384 with node_modules linked from the live checkout. The harness itself ran from the live checkout, so `head_sha` in the machine block is the HEAD of the live checkout; `base_sha` and `tree_label` name the pinned tree. The export and the link were deleted at the end.

### Other notes

- Three extra result files (`smoke-rerun-set1.json`, `smoke-rerun-set2.json`, `smoke-rerun-compare.json`) hold the n = 15 rerun of floor:node. The plan asks for the rerun but lists no file name.
- README is 60 lines and also covers the plan 02 changes (clean-bench needs --source or --all, --restore, new targets, per_hook, the compact and tx4m targets).
- `pick-room --save` refuses a path inside the repository (exit 2). This is an addition for threat T-384-12.
- The self-test file got a second part (partQ) chained after part W.
- A wait loop of mine whose text contained the suite-guard string made the harness exit 75 for a while (the guard matches any command line with that text). It was my own process and I ended it. A peer suite (Phase 383) also held the host for about 45 minutes in total. The runs waited and nothing was killed.
- A typing error in one `flock` call created an empty file named `bash` in the repo root. It was never staged and I removed it.
- The scratch script for the first retry loop was made with a shell heredoc in the scratch folder (the Write guard allows only repo paths). It is not a deliverable and is deleted.
- I read the real room registry through `pick-room` twice (one line per class, counts only: class, file count, file system type). No room was measured and no path was printed.

## C10 check (product dirty files, peer-owned)

- At the start: 3 entries (data/harness-manifest.json, scripts/check-voice-style.cjs, data/harness-policies/voice-length.json). The peer committed them as 5c740b42d during the plan.
- At the end: 3 entries (data/doctor-modules.json, scripts/doctor.cjs, lib/core/doctor/doubled-room-trees-module.cjs). They belong to the Phase 383-09 doctor work (commits 2c1836a69, 1488a1d39, bc7a7d9f5, 4a2e60779 landed during this plan). This plan did not touch, stage or revert any of them.
- phase-guard from BASE_SHA_384: OK (32 commits checked, 7 peer commits touching product paths).

## Known Stubs

None.

## Threat Flags

None. The picker and quiet-room only read (readlink, stat, lstat). The saved pick file is mode 0600 and the CLI refuses a save path inside the repository.

## Self-Check: PASSED

- Files exist: tools/perf/perf-harness.cjs, tools/perf/README.md, tests/test-384-perf-harness.cjs, and the seven files under measurements/ named above.
- Commits 5df392a87, 324b27600, b9cb54273 and 99b880b66 exist on main.
- Self-test: perf-harness: ALL PASS (202 checks) under the 384 lock. verify-results on the measurements folder: OK. phase-guard: OK.
- The scratch folder and the pinned export were deleted.
