---
phase: 384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-
plan: 04
subsystem: testing
tags: [perf, census, exec-counter, ld-preload, hooks, process-count, subagent-stop]
requires:
  - phase: 384-03
    provides: harness library surface, quiet-room and pick-room, resolveSource, merge, README, wave1-scope
provides:
  - bench/exec-counter.c (LD_PRELOAD exec counter, calibrated: exactly 7 and exactly 5 on known scripts)
  - bench/process-census.cjs (build, run, blocks, walls-subagent) and its 43-check test
  - fixture-room counts for 14 event keys, two wall sets with spread, a SessionStart block trace and SubagentStop at 1, 5, 20 files
  - census-table.md with the counted numbers next to the PRD claims S1, S2 and S4
affects: [384-08, 384-09]
tech-stack:
  added: []
  patterns: [LD_PRELOAD exec counter with block list, marker scan of /proc environ, Latin-square rotation of sizes]
key-files:
  created:
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/exec-counter.c
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/process-census.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/bench/test-process-census.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/census-table.md
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/census-fixture.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/census-walls-fixture-s1.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/census-walls-fixture-s2.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/census-walls-fixture-s1-rerun.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/census-walls-fixture-s2-rerun.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/census-spread.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/session-start-blocks.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/subagent-files.json
  modified: []
key-decisions:
  - "strace is not installed; the exec counter is a small LD_PRELOAD library, proven on known scripts before any number is trusted."
  - "The measurement tree is a pinned export of BASE_SHA_384 (owner instruction); the live checkout was not measured."
  - "SessionStart:startup:unchanged wall time is NOT MEASURED: the fixture room never reaches the reuse path (reason registry), and verify-results rejects the target."
  - "The isolation check stays strict (owner question Q1 open). This plan used the fixture room only."
requirements-completed: [PERF384-02]
duration: about 6 h including waits for the shared lock and peer load
completed: 2026-11-05
---

# Phase 384 Plan 04: Process census, walls and SubagentStop scaling Summary

A calibrated LD_PRELOAD exec counter and a census runner now give, for 14 hook event keys on the fixture room, the number of processes started (by program), the wall time with spread, and the background time after the hooks return; SessionStart starts 44 to 45 node processes and about 100 processes in all, and one SubagentStop on a 20-file room starts about 17,000 processes over about 18 s after the hook returns.

## Commits

| Sha | Subject |
|-----|---------|
| 236bd974f | test(384-04): exec counter and census runner, calibrated on known scripts |
| 72b0eed8b | fix(384-04): census pins the CPU cap by re-exec, longer gate for SubagentStop rounds, survivor program names |
| fafd9a0bd | docs(384-04): process census, walls and SubagentStop scaling on the fixture room |
| (this docs commit) | docs(384-04): plan summary |

## TDD record

RED (the check file before the runner existed): `process-census: 30 FAILED (6 ok)`. GREEN: `process-census: ALL PASS (43 checks)`. It was run again, ALL PASS, before the measurement runs and after the last code change.
Check names: K0 library load; K1 build and no path in the output; K2 calibration A; K3 calibration B; K4 survivors (tail, CPU lower bound, kill by marker only, bystander survives, killed count); K5 block trace (shares within 30 percent of 29, 57, 14; no command text); K6 schemas and verify-results (3 repeats pass, n = 3 timing fails); K7 copy mode on a synthetic source (no path, source unchanged, walls-subagent in copy mode); K8 block list; K9 log parser and event keys.

## Calibration

| Case | Expected | Counted |
|------|----------|---------|
| A: bash script with builtins, 3 x /bin/true, env + true, node -e 0, sleep & | 7 | 7 |
| B: node with execFileSync('/bin/true') and execSync('/bin/true; /bin/true') | 5 | 5 |

Block list: with MOS_EXEC_BLOCK=touch the touch call fails and leaves no file, one B line is logged and the count stays 0.

## Per-event result (fixture room, pinned tree, final runs)

| Event key | Processes median (min-max) | node starts | Wall median ms (set 1 / set 2) | Spread percent | Tail after last hook ms |
|-----------|----------------------------|-------------|--------------------------------|----------------|-------------------------|
| SessionStart:startup:unchanged | 99 (99-99) | 44 | NOT MEASURED | - | 14,870 |
| SessionStart:startup:changed | 103 (103-103) | 45 | 2,764.3 / 2,733.5 (n=15) | 1.1 | 14,872 |
| SessionStart:compact | 99 (99-99) | 44 | 2,685.1 / 2,635.7 (n=15) | 1.9 | 14,872 |
| UserPromptSubmit | 19 (18-31) | 13 | 108.6 / 109.1 | 0.5 | 178 |
| Stop:unchanged:tx4m | 101 (101-101) | 36 | 1,244.1 / 1,224.1 | 1.6 | 182 |
| Stop:changed:tx4m | 110 (110-110) | 38 | 1,241.5 / 1,344.2 | 7.9 | 187 |
| PostToolUse:Write | 36 (36-44) | 9 | 200.0 / 210.0 (n=15) | 4.9 | 0 |
| PostToolUse:Read | 2 (2-2) | 2 | 32.9 / 34.0 | 3.3 | 0 |
| TaskCompleted | 77 (77-77) | 2 | 205.8 / 197.7 | 4.0 | 0 |
| PreCompact | 27 (27-27) | 3 | 220.9 / 214.8 | 2.8 | 0 |
| PostCompact | 93 (36-95) | 35 | 2,613.5 / 2,506.8 (n=15) | 4.2 | 14,864 |

SubagentStop (scaling run, n = 7 per size, Latin-square order): 1 file: wall 177.1 ms (p95 187.0), background 3,482 ms, 2,604 processes (node 9). 5 files: wall 178.5 ms, background 6,900 ms, 12,703 processes (node 46). 20 files: wall 301.8 ms, background 18,159 ms, 17,232 processes (16,390-19,052; node 171). Survivor CPU (lower bound): 1,460, 6,570 and 29,120 ms.

Spread: maximum 8.4 percent (Stop:unchanged) after the re-runs. Five targets were above 10 percent in the first pair (SessionStart:changed 47.6, SessionStart:compact 52.9, PostToolUse:Write 76.7, PostCompact 20.2, Stop:changed 10.5); the n = 15 re-runs of both sets gave 1.1, 1.9, 4.9, 4.2 and 1.8 percent. No target is unstable.

## PRD claims (counted next to claimed; the rule is applied by plan 384-09)

- S1 (about 50 node in SessionStart): counted 44 to 45 node starts, 99 to 103 processes; differs by 5 to 6 (a lower bound, the npm reconcile hook was not run). Four block ranges (417, 489-494, 570-572, 772-774) ran no line on the fixture path; 1562-1790 is 38.1 percent of the traced pass.
- S2: UserPromptSubmit 8 hooks matches; Stop 8 hooks matches; Stop 4 find matches; Stop about 10 node differs by 26 to 28 (36 to 38 counted); tool call 1 to 2 hooks matches for Read (2); writes 7 differs by 1 (8 hooks).
- S4 (2 to 3 processes per modified file): differs; about 8 to 9 node and 7 to 8 bash/sh starts per added file, and 2,604 to 17,232 processes in all, because the state recompute and the graph build run in the background. The file count is capped at 20; the concurrency is not.

## Findings worth a look in later plans (fixture room; UNVERIFIED on real rooms)

- A constant tail of 14.86 to 14.87 s follows SessionStart and PostCompact. The survivors are `bash session-start` and `node brain-prewarm.cjs` (program names PROVEN from /proc). `lib/core/brain-prewarm.cjs` has a 15000 ms default timeout, which is the likely cause (UNVERIFIED).
- The SessionStart state step never takes the reuse path in the fixture room (`reason=registry`, 8 of 8 probe starts): the registry file is newer than STATE.md at every start.
- SubagentStop process counts are stable in steady state (2,604 and 12,703, min = max) but vary between sessions and with room state (3,192-5,502 and 21,602-22,971 in the full census). The cause is not isolated.

## Deviations from Plan

### Owner instructions applied

**1. Pinned tree.** The plan names the main checkout as the tree. All runs used `git archive` of BASE_SHA_384 in `/tmp/mos-384-scratch-04/tree` with node_modules linked from the live checkout. The harness code ran from the live checkout, so `head_sha` in the machine block is the HEAD of the live checkout at that time; `base_sha` and `tree_label` (`pinned-db2ea3b05`) name the pinned tree. The scratch folder is `/tmp/mos-384-scratch-04` (not `/tmp/mos-384-scratch`) so that plan 384-05 does not share it. The export and the scratch folder are deleted.

### Auto-fixed Issues

**2. [Rule 1 - Bug] The CPU-cap re-exec dropped the subcommand**
- **Found during:** Task 2, first census run (usage error, exit 2)
- **Issue:** `ensurePinned` restarted the runner under `taskset -c 0-3` with the sub-arguments only. The self-test skips this path, so the 43 checks did not see it.
- **Fix:** it now passes the full argument list. A smoke run of two events through the real path passed before the long run.
- **Files modified:** bench/process-census.cjs
- **Commit:** 72b0eed8b

**3. [Rule 3 - Blocking] The load gate ran out in the SubagentStop scaling run**
- **Found during:** Task 2, first walls-subagent run (verify-results: size 1 flagged noisy)
- **Issue:** a 20-file run leaves load1 above 25; the default gate limit of 300 s was not always enough, and a run then started on a busy host.
- **Fix:** walls-subagent waits up to 900 s before each run. The first run was discarded (kept only as the informational numbers in census-table.md) and the command was run again. Its result is on file and no size is flagged.
- **Commit:** 72b0eed8b

**4. [Rule 2 - Missing critical functionality] Survivor program names and environment carry-over**
- The plan asked for survivor counts and CPU only. The census also records the program and script base names of the survivors (comm and the base name of argv[1] for node, bash, sh, dash; nothing else is read), because a constant 15 s tail is not interpretable without a name. The counter also adds LD_PRELOAD, MOS_EXEC_LOG, MOS_EXEC_BLOCK and MOS_PERF_RUN_ID to a child environment that lacks them, and logs an `I` line; the census reports `carry_over_calls` (0 in every event of the final run), so no subtree was hidden.
- **Commits:** 236bd974f, 72b0eed8b

### Other deviations and notes

- **SessionStart:startup:unchanged wall time is NOT MEASURED** (plan step 4 lists it). The fixture room never reaches the unchanged path (see findings), and verify-results rejects an :unchanged target that takes the changed path. Its process count is on file with the compute path marked.
- Four extra result files hold the n = 15 re-runs (`census-walls-fixture-s1-rerun.json`, `-s2-rerun.json`); the plan asks for the re-run but lists no file name (same as plan 03). census-spread.json was written by hand from the two `compare` outputs because the harness `spread` command needs a copy room too.
- A first full census run was replaced by a second run (after the survivor-name change). The second is the file on file; the table names the keys where the first run differed (UserPromptSubmit, Stop:unchanged:tx4m, PostCompact, three SubagentStop keys).
- The first set-2 wall run exited 75 because a peer suite (Phase 383) was running at that moment; it was started again after the suite ended. Nothing was killed.
- A walls-subagent run that I started was stopped by me after about one minute (to add the survivor names before the long run); only my own two processes were killed.
- **Peer collision:** commit 181bdc54a (a release session, "commit the in-progress bench files left in the shared tree") also committed 4 lines of my then-unfinished bench/process-census.cjs, and c7c6e9bde and 9d6a83cce committed 05's script-costs.cjs. The final content of process-census.cjs in HEAD is complete and tested (72b0eed8b). Bench files are under .planning and are not shipped.
- The lock was held by this plan for long stretches (about 3 h in total over the runs); plan 384-05 waited on it. `s9-transcript.json` of plan 05 once showed `load1_start` 27.23, the `load1_end` of my set 1, and made `verify-results` fail on the whole folder at that time; the whole folder passes now and this plan's files pass alone.

## Authentication gates

None.

## C10 check (product dirty files, peer-owned)

- At the start: 3 entries (data/doctor-modules.json, scripts/doctor.cjs, lib/core/doctor/doubled-room-trees-module.cjs). They belong to Phase 383 doctor work.
- At the end: 0 entries. The peer committed them during this plan. The diff of the two lists shows only removals; this plan staged, edited or reverted none of them.
- phase-guard from BASE_SHA_384: OK (69 commits checked, 25 peer commits touching product paths).

## Known Stubs

None.

## Threat Flags

None. The counter logs base names only (T-384-17: the result files hold no home path, no mounted-drive path and no rooms-folder segment, checked by grep); the survivor kill matches this run's marker only and a bystander survives (K4, T-384-18); the counting pass is separate from the wall runs (T-384-16). The npm reconcile hook was not run and the Brain URL was an unreachable loopback (T-384-19).

## Self-Check: PASSED

- Files exist: bench/exec-counter.c, bench/process-census.cjs, bench/test-process-census.cjs, and the eight measurement files and census-table.md listed above.
- Commits 236bd974f, 72b0eed8b and fafd9a0bd exist on main.
- Self-test under the 384 lock: process-census: ALL PASS (43 checks). verify-results on this plan's files: OK. Part 8 grep on the result files and this file: no match. Dash check: no match.
- The scratch folder and the pinned export were deleted.
