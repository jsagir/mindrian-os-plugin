---
phase: 384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-
plan: 10
subsystem: testing
tags: [perf, operator-update, lazy-require, cascade-skip, hmi-poll, T02, T03, T04, T05, measurements]
requires:
  - phase: 384-08
    provides: shared measurement lock, bench working style
provides:
  - bench for T02 to T05 with a check file (18 check groups)
  - 12 result files (two timing sets and one counts file per finding)
  - measurements/t02-t05-costs.md (rules, hypotheses, tables, reading summary, observations)
affects: [384-09]
key-files:
  created:
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/t02-t05-bench.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/test-t02-t05-bench.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/t02-t05-costs.md
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/t02-operator-update-s1.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/t02-operator-update-s2.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/t02-operator-update-counts.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/t03-lazy-require-s1.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/t03-lazy-require-s2.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/t03-lazy-require-counts.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/t04-cascade-skip-s1.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/t04-cascade-skip-s2.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/t04-cascade-skip-counts.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/t05-hmi-poll-s1.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/t05-hmi-poll-s2.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/t05-hmi-poll-counts.json
  modified: []
key-decisions:
  - "All four premise gates passed; no task stopped; the plan ends DONE."
  - "T04 runs on the first artifact file of each room, not on the file that findTouchTarget returns (that file is the identity file ROOM.md, which the cascade skips)."
requirements-completed: [PERF384-02, PERF384-03]
completed: 2026-11-05
---

# Phase 384 Plan 10: T02 to T05 costs Summary

Four findings were measured on fixture rooms from a pinned export of BASE_SHA_384. The cost of one operator-update call is 6.5 to 8.0 ms above a bare node start and the guard-passing registry adds no measurable time. The lazy timeline-runner require lowers the module count of all four processes, and the time difference is above noise for the statusline and the cold load only. A skipped cascade call costs about 59 ms, and the Write event on a harness-layout room costs about 3.0 s more than on a default-layout room. The HMI poll hook is 46 to 47 ms above doctor alone, and doctor is 0.61 of the hook.

No reading in this plan confirms or refutes an S finding. Plan 384-09 applies its own rule.

## Commits (hypothesis commits first for each task)

| Sha | Subject |
|-----|---------|
| f35690889 | docs(384-10): rules and T02 hypothesis, fixed before any measurement |
| fa5292687 | docs(384-10): T02 operator-update cost per call against the node floor |
| 59d71e960 | docs(384-10): T03 hypothesis and reading rule, fixed before any measurement |
| f1c923a31 | docs(384-10): T03 lazy timeline-runner require, before and after in a scratch copy |
| 400550e09 | docs(384-10): T04 hypothesis and reading rule, fixed before any measurement |
| e543f5cdb | docs(384-10): T04 cascade skip on a default-layout fixture room |
| 5cac7f30c | docs(384-10): T05 hypothesis and reading rule, fixed before any measurement |
| 5ff1bf1fa | docs(384-10): T05 hmi poll hook against doctor ui-compliance alone, reading summary |
| (this docs commit) | docs(384-10): plan summary |

## RED and GREEN checks

RED was recorded before each implementation: the bench file missing (B0, task 1), `makeLazyText is not a function` (B7 to B10, task 2), `layoutOf is not a function` (B11 to B14, task 3) and `shareReading is not a function` (B15 to B18, task 4). GREEN: `t02-t05-bench: ALL PASS` after each task (B0 to B6, then B7 to B10, B11 to B14, B15 to B18) and in the final verify of each task.

## Premise gates

| Gate | Outcome |
|------|---------|
| T03 equivalence (R5) | passed: 14 sections, 0 mismatches (sync), 0 mismatches (async), 12 sections used the lazy path; the two trees differ in 2 files, 1 line each |
| T04 skipped on the default layout (R5) | passed: skipped true in 3 of 3 repeats, reason "filePath not inside a room directory"; control on the harness layout skipped true in 0 of 3 |
| T05 poll status word (R5) | passed: status ok, doctor exit 0, 1 key under checks |

## Readings (d(1), d(2) in ms; 2 x noise in ms)

| Pair | Reading | d(1) | d(2) | 2 x noise |
|------|---------|------|------|-----------|
| T02-a UserPromptSubmit (call above floor) | PASS | 8.0 | 6.5 | 1.7 |
| T02-a Stop | PASS | 7.2 | 8.0 | 1.9 |
| T02-a PostToolUse Read | PASS | 7.0 | 8.0 | 2.9 |
| T02-b UserPromptSubmit (guard-passing above product shape) | FAIL | 0.5 | 0.3 | 1.1 |
| T02-b Stop | FAIL | -0.6 | -0.9 | 2.2 |
| T02-b PostToolUse Read | FAIL | 1.1 | -0.4 | 1.8 |
| T02-c (R1, path taken) | PASS | sums 0 0 0 against 1 1 1 | | |
| T03 statusline (R3) | PASS | 40.6 | 39.0 | 1.6 |
| T03 on-stop | FAIL (modules 521 to 380, time inside noise) | 5.7 | 8.6 | 69.0 |
| T03 drain | FAIL (modules 169 to 167) | -2.5 | -1.9 | 8.8 |
| T03 cold load | PASS (modules 167 to 3) | 48.2 | 49.1 | 1.8 |
| T04-a (R1) | PASS | | | |
| T04-b (skipped cascade call above floor) | PASS | 59.4 | 59.3 | 0.9 |
| T04-c (Write, harness layout above default layout) | PASS | 2995.2 | 2987.4 | 70.5 |
| T04-d (counts) | NOT RESOLVED (harness layout repeats differ) | | | |
| T05-a (R4) | PASS | 46.0 | 47.0 | 7.0 |
| T05-b (R1) | PASS | | | |

## Key medians (ms, n = 15 per set, set 1 / set 2) and spreads

| Target | Median set 1 / set 2 | p95 set 1 / set 2 | Spread percent |
|--------|----------------------|-------------------|----------------|
| bare node floor (T02) | 22.8 / 23.4 | 24.4 / 26.9 | 2.6 |
| operator-update, UserPromptSubmit, product shape | 30.7 / 30.5 | 32.2 / 32.6 | 0.8 |
| operator-update, UserPromptSubmit, guard-passing | 31.4 / 31.1 | 33.4 / 33.4 | 0.9 |
| statusline process, tree A / tree B (T03) | 84.4 / 44.8 | 90.1 / 47.4 | 0.2 / 1.4 |
| on-stop hook, tree A / tree B | 1079.5 / 1063.4 | 1158.5 / 1146.7 | 1.3 / 1.9 |
| cascade CLI call, default layout (T04) | 81.6 / 81.8 | 87.5 / 83.8 | 0.2 |
| Write event, default layout | 197.8 / 214.1 | 899.7 / 477.6 | 7.9 |
| Write event, harness layout | 3249.9 / 3231.0 | 3420.8 / 3356.3 | 0.6 |
| HMI poll hook (T05) | 119.5 / 121.4 | 122.7 / 123.7 | 1.6 |
| doctor --ui-compliance alone | 73.1 / 74.7 | 75.6 / 79.0 | 2.1 |

Derived targets with a spread above 10 percent are kept and shown in the md (for example t02:d:real-minus-floor:ups 19.7, t03:d:onstop 41.2, t03:d:drain 26.8).

## Deviations from Plan

**1. [Rule 1 - Bug] T04 artifact choice.** Found during the first T04 count run. findTouchTarget returns the identity file ROOM.md for the harness fixture, and the cascade skips it with the reason "ROOM.md is not an artifact" (3 of 3 repeats). A control on that file is not a control. All T04 runs use the first artifact file of each room (depth first, byte order, identity files excluded; the same kind of file in both rooms). The finding is on file as an observation: a Write event on the fixture touch target did not run the cascade. Commit e543f5cdb.

**2. [Process] Scratch splice files.** During task 3 and 4 I built two code blocks as text files in the scratch folder with a shell heredoc and spliced them into the bench with a script. A later Write to the scratch folder was refused by the path guard, and I did not use a shell redirect again: the task 4 code went into the bench with Edit. The scratch files held code only and no result data.

**3. [Process] Test groups removed and re-added.** The B15 to B18 groups were written during the task 3 timing chain and removed from the check file before the task 3 commit (so the task 3 verify run could pass), then added again at the start of task 4 and recorded RED. The bench file was not edited while a timing chain was running.

## Notes

C10 start and end check: the list of dirty product paths (hooks, scripts, lib, bin, package.json, npm-shrinkwrap.json, data) was empty at the start and at the end (0 entries, diff equal). No product file changed in the repo. The lazy edit exists only in the deleted scratch copy.

No real room, registry, ledger or home folder was read. No push, tag, release or version bump. STATE.md, ROADMAP.md and REQUIREMENTS.md were not edited.

Lock: every measurement and every check run took `$HOME/.cache/mos-perf-384.lock` with flock; the lock file was not touched otherwise.

## NOT MEASURED, UNVERIFIED

- Real default-layout behaviour of a user room: not read (Canon Part 8).
- SubagentStop wall time: counted only (T04-d), no timing.
- T04-d harness layout counts: repeats differ (Write modules 1042 to 1139, node starts 13; SubagentStop with 5 files node starts 44 to 46, modules 4305 to 4749), so the reading is NOT RESOLVED.
- meets floor: pending Q5b in every reading row.
- Native Windows, Desktop and Cowork: not measured.
- The claim that the earlier fixture runs of plans 384-04 and 384-05 used the file ROOM.md as the Write artifact is not re-read from their result files; it is shown only for the fixture built in this plan.

## Cleanup

The scratch folder was removed after the final verify (clean-bench, then removal; confirmed gone). The folder of plan 384-08 was not touched. Plan 384-09 must add 384-10 to its depends_on (and move to wave 10) and read measurements/t02-t05-costs.md.

## Self-Check: PASSED

All 14 result and bench files and the md exist; the eight commits above exist in the log; verify commands of all four tasks exited 0.
