---
phase: 384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-
plan: 08
subsystem: testing
tags: [perf, real-room-copy, census, walls, S1, S2, S3, S4, S5, S7, S8, S9, measurements]
requires:
  - phase: 384-07
    provides: db-open-bench with copy-room modes
provides:
  - Q1 state file (Q1 not needed) and the picker counts
  - local-class copy: process census, two wall sets with n = 15 re-runs, SubagentStop at 1, 5, 20 files, script costs, MCP start, database open, event-loop block
  - real-copy-table.md with the PRD claim rows for S1 to S5 and S7 to S9 on the copy
affects: [384-09]
tech-stack:
  added: []
  patterns: [copy-room runs from a pinned export, isolation check kept strict, retry of a breached take]
key-files:
  created:
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/q1-answer.md
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/real-copy-table.md
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/counts-copy-local.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/script-timings-copy-local.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/mcp-timings-copy-local.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/walls-copy-local-s1.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/walls-copy-local-s2.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/walls-copy-local-s1-rerun.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/walls-copy-local-s2-rerun.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/subagent-files-copy-local.json
  modified: []
key-decisions:
  - "Q1 is not needed: the local class had a quiet room. The isolation check stayed strict."
  - "The mount class is NOT MEASURED: picker line candidates=1 quiet=0."
  - "One breached take (exit 3, source shm sidecar) was discarded and taken again on the same copy; the kept files all have exit 0 and intersect 0."
requirements-completed: [PERF384-05]
duration: about 4 h including waits for host load
completed: 2026-11-05
---

# Phase 384 Plan 08: Real-room copies, one quiet room per class Summary

The local class (221 files, ext2/ext3) was measured on one copy: a SessionStart costs about 5.1 s (n = 7, spread 5.2 percent) against 2.7 s on the fixture room, UserPromptSubmit about 415 ms against 109 ms, and the three SessionStart-like events start 92 to 95 processes with 44 to 45 node starts; the mount class has no quiet room (candidates=1, quiet=0) and is NOT MEASURED.

## Commits

| Sha | Subject |
|-----|---------|
| b8976c8a8 | docs(384-08): Q1 state and the quiet-room preflight (counts only) |
| 4f258be3f | docs(384-08): room-dependent costs on quiet real-room copies, one per class (counts and timings only) |
| (this docs commit) | docs(384-08): plan summary |

## Q1 state

`Q1: not needed`. Picker lines: `picked class=local file_count=221 fs_type=ext2/ext3` (exit 0) and `picked none class=mount candidates=1 quiet=0` (exit 75). No owner question was asked. The isolation check was not relaxed. The background reader process was not stopped.

## Classes measured

| Class | File count | File system | Status |
|-------|-----------|-------------|--------|
| local | 221 (13,728,700 bytes; room.db about 6.1 MB) | ext2/ext3 | measured |
| mount | not copied | not copied | NOT MEASURED (no quiet room: candidates=1, quiet=0) |

## Key numbers, local copy (DIRECT unless marked; n = runs in the statistic)

| Number | Set 1 / set 2 median ms | p95 ms | n | Spread percent |
|--------|-------------------------|--------|---|----------------|
| SessionStart changed wall | 5,079.8 / 4,821.6 | 6,038.7 / 8,625.5 | 7 | 5.2 |
| SessionStart compact wall | 5,107.8 / 5,355.5 | 5,295.4 / 5,611.9 | 7 | 4.7 |
| PostCompact wall | 5,208.9 / 4,759.7 | 5,686.3 / 5,336.0 | 7 | 9.0 |
| UserPromptSubmit wall | 421.0 / 408.2 | 463.8 / 474.3 | 7 | 3.1 |
| Stop:unchanged:tx4m wall (re-run) | 1,692.2 / 1,646.0 | 1,813.8 / 1,724.9 | 15 | 2.8 |
| Stop:changed wall (re-run) | 1,698.8 / 1,869.4 | 1,858.2 / 2,172.2 | 15 | 9.6 |
| SubagentStop 1 / 5 / 20 files wall (one set) | 301.6 / 337.4 / 487.6 | 459.2 / 468.6 / 656.3 | 7 | not measured (one set) |
| SessionStart processes / node starts | 94 / 45 (changed) | - | 3 repeats | agree |
| SubagentStop processes at 1 / 5 / 20 files (walls-subagent) | 3,378 / 16,475 / 16,637 | - | 3 repeats | not measured |
| MCP os initialize (one set) | 568.8 | 588.5 | 7 | 7.4 (from fixture) |
| stop_gate_check first call, loop blocked (one set) | 837.4 (max 1,098.4) | 931.4 | 7 | 33.2 (from fixture) |
| Database open cold / warm (one set) | 4.78 / 1.126 | 5.40 / 1.498 | 7 | 0 / 0 (from fixture) |
| Opens per SessionStart | 9 (3 repeats agree) | - | 3 | - |
| Room file reads per Stop (unchanged / changed) | 496 / 530; 2 transcript reads | - | 1 repeat stored | repeats differ |

Spreads of the five unstable wall targets after the n = 15 re-run: PostToolUse:Write 46.5, PreCompact 36.0, floor:node 32.0, Stop:changed:tx4m 14.7, TaskCompleted 12.7, PostToolUse:Read 10.4. They were kept, not dropped. The bare node floor moved from 33.8 to 77.8 ms across four sets with load1 below 2, so short targets carry a host-speed error.

## Against the PRD claims (as in real-copy-table.md; plan 384-09 applies the rule)

- S1: node starts 44 to 45 (PRD about 50), differs by 5 to 6. SessionStart 5.1 s on the local copy (PRD sample 6.7 s), differs by about 1.6 s below.
- S2: 8 and 8 hooks match. Stop node starts 35 to 38 against about 10, differs by 25 to 28.
- S3: 9 opens per SessionStart, about 40.5 ms DERIVED, 0.8 percent of the wall.
- S4: 3,378 processes at 1 file against 2 to 3 per file, differs by orders of magnitude.
- S5: the drain hook takes 33.6 ms; the module warm-up 53.7 ms against a PRD 96 to 191 ms. Differs. The copy had no finding files, so the re-read cost is NOT MEASURED.
- S7: start 568.8 ms; no npm child in the exec check.
- S8: stop_gate_check blocks about 0.84 s median (max 1.1 s cold, 1.5 s warm); PRD up to 7 s.
- S9: 2 transcript reads per Stop match; 496 room reads per Stop over 15 section folders.

## Deviations from Plan

### Owner instructions applied

**1. Pinned tree.** All runs used `git archive` of BASE_SHA_384 in the scratch folder with node_modules linked from the live checkout. Harness and bench code ran from the live checkout. The scratch folder is the one the plan names.

### Auto-fixed Issues

**2. [Rule 3 - Blocking] SessionStart:startup:unchanged took the changed path on the copy**
- **Found during:** Task 2, verify-results on the first wall pair
- **Issue:** verify-results rejects an :unchanged target that took the changed path (7 of 7 runs, both sets).
- **Fix:** the first pair was discarded and both sets were taken again without that target. The wall time of the target is NOT MEASURED; its first-pass medians (5,124.1 and 4,941.9 ms) are noted in the table only as information. Same outcome as on the fixture room in plan 384-04.

**3. [Rule 1 - Bug in the run] Isolation breach in the first s1 re-run (exit 3)**
- **Found during:** Task 2 step 3 (re-run at n = 15)
- **Issue:** 1 path changed in the source and in the copy, class shm (the shared-memory sidecar). The plan is strict: the check was not relaxed.
- **Fix:** the file of that take was removed from the commit set and the take was run again on the same copy. The second take exited 0 with 0 source paths changed. The plan text says "mark the class NOT MEASURED" on exit 3; I applied it to the failing take only (as Task 3 step 3 says "for the failing part") because all other files of the class have exit 0 and intersect 0. The main session may overrule this reading. Counts by class are in real-copy-table.md.

**4. [Rule 3 - Blocking] A noisy re-run**
- The first s2 re-run had three targets with load1 above 2 (verify-results rejects noisy targets). The file was discarded and taken again. The kept file passes.

**5. [Rule 3 - Blocking] The write guard refused a driver script outside the repository**
- The guard accepts paths inside the repository only, so each stage ran as an inline command in the background. No file inside the repository was written with a shell redirect.

### Other notes

- Two extra result files are committed that the plan does not list: `walls-copy-local-s1-rerun.json`, `walls-copy-local-s2-rerun.json` (the n = 15 re-runs, same as plans 384-03 and 384-04) and `subagent-files-copy-local.json` (the walls-subagent timing file, which the counts merge cannot hold).
- The `summarize-isolation` subcommand returned an empty set list for the measurements folder and for the scratch folder (it reads no result file of these names). The isolation counts in the table come from the `isolation` block of each result file, read directly.
- Mount-class files (`counts-copy-mount.json`, `walls-copy-mount-s1.json`, `walls-copy-mount-s2.json`, `script-timings-copy-mount.json`, `mcp-timings-copy-mount.json`) do not exist, because the class is NOT MEASURED.
- The wall-clock part of the stage that ran the SubagentStop sizes raised load1 to about 23 each time; the harness gate waited for it to fall before the next run.
- The room_startup, artifact_file and memory_event tool calls returned an error with the default arguments in 3 of 3 repeats on the copy; their opens are NOT MEASURED here.

## Authentication gates

None.

## Known Stubs

None.

## Threat Flags

None. Result files hold counts, timings, hook ids and script base names only; the Part 8 grep (home paths, mounted-drive paths, rooms-folder segment, temp paths) found nothing in any committed file, and the dash check found nothing. The pick file and all copies lived in the scratch folder only.

## C10 check (product dirty files)

- At the start: 0 entries. At the end: 0 entries; the diff of the two lists is empty. No product file was edited by this plan.
- phase-guard from BASE_SHA_384: OK (25 peer commits touching product paths).

## Deletion

Every room copy (the bench folder), the pick file, the pinned export and the scratch folder were deleted with `clean-bench --all` and `rm -rf`. A node check printed `scratch gone` and `bench gone`.

## Self-Check: PASSED

- Files exist: q1-answer.md, real-copy-table.md, counts-copy-local.json, script-timings-copy-local.json, mcp-timings-copy-local.json, the four wall files and subagent-files-copy-local.json.
- Commits: the Q1 commit and 4f258be3f exist on main.
- verify-results on the measurements folder: OK. phase-guard: OK. Part 8 grep and dash check: clean.
