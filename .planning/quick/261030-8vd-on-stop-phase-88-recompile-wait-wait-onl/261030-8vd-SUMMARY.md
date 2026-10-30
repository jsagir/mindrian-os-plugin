---
phase: 261030-8vd-on-stop-phase-88-recompile-wait-wait-onl
plan: 01
quick_id: 261030-8vd
subsystem: hooks
tags: [perf, hooks, on-stop, phase-88, wait]
status: COMPLETE
requires: [261029-kqv, 261029-qef]
provides:
  - scripts/on-stop Phase 88 block waits only on the recompile PIDs; the 1 s watcher kills only those PIDs and writes to /dev/null
  - tests/test-261030-8vd-onstop-wait.cjs (arms S1, S2, B1..B4)
  - CHANGELOG.md one measured bullet under [Unreleased] / ### Changed
key-files:
  created:
    - tests/test-261030-8vd-onstop-wait.cjs
  modified:
    - scripts/on-stop
    - CHANGELOG.md
decisions:
  - "Real-room numbers in the CHANGELOG come from attempt 3, the only real-room pair whose load gap was within 1.0 (0.19)."
  - "The brief finding (DD-9) is recorded here only; the brief block is unchanged (C-3)."
completed: 2026-10-30
---

# Phase 261030-8vd Plan 01: on-stop Phase 88 recompile wait Summary

STATUS: COMPLETE. All 3 tasks ran. 3 commits exist, none pushed. Every gate is green. The Stop event median on the real room fell from 5,164 ms to 4,515 ms (attempt 3, PROVEN). The phase88 step fell from 2,981 ms to 2,255 ms (PROVEN).

## Commits (3, none pushed)

All three are ancestors of HEAD (PROVEN with `git merge-base --is-ancestor`). Branch quick/261030-onstop-wait, base 861ae9c59.

| Order | Sha | Message |
|-------|-----|---------|
| 1 | 46ab7b31a | test(261030-8vd): add failing test for the on-stop recompile wait |
| 2 | 20271cf68 | fix(261030-8vd): wait only on the recompile PIDs in the on-stop Phase 88 block |
| 3 | 5b994b84d | docs(261030-8vd): record the shorter turn-end wait in the changelog |

## Task 1: baseline and RED

Peer check (`git status --porcelain` on the three files): empty (PROVEN). Last commit that touched scripts/on-stop before the work: e25b862ae. Host load at the start: 12.10 (busy; other sessions run).

### Baseline of the 6 suites (before, run on the unchanged tree, NODE_PATH = MAIN/node_modules)

| Suite | Exit before | FAIL lines before | Exit after | FAIL lines after |
|-------|-------------|-------------------|------------|------------------|
| tests/test-261029-kqv-stop-skip-recompute.cjs | 0 | none | 0 | none |
| lib/memory/on-stop-snapshot.test.cjs | 0 (8/8) | none | 0 (8/8) | none |
| lib/memory/guardian-onstop-reaches-user.test.cjs | 1 (3/4) | "LEG B: an injected ~1250ms validator delay still writes the report and prunes the ghost": elapsed=3322ms over the 3000 ms budget, at load 12 | 0 (4/4) | none |
| tests/test-36925-brief-wiring.cjs | 0 (6 passed, 0 failed) | none | 0 (6 passed) | none |
| tests/test-198-adapter-budget.test.cjs | 0 (15 of 15) | none | 0 (15 of 15) | none |
| tests/test-261029-qef-hook-timeouts.cjs | 0 | none | 0 | none |

The guardian LEG B baseline failure is a load timing failure (host load 11.8 to 12.2, one run). It passed after the fix at load 13.1. UNVERIFIED whether the fix helped it: one run each, and the load differed. Treat it as flaky under load, not as a regression.

### RED output (unchanged tree, load 12.6, PROVEN)

```
  FAIL S1 block shape: waits on RECOMPILE_PIDS, guarded, watcher kills the list
    missing: RECOMPILE_PIDS=()
  ok S2 file: anchors once, bash -n, line budget
  FAIL B1 speed: 15 sections, real recompiler, median under 600 ms
    median 1024 ms is not under 600 ms (runs 1020,1024,1039)
  ok B2 hang that honors SIGTERM: exit 0 under 1300 ms (1008 ms)
  FAIL B3 hang that ignores SIGTERM: freed by the watcher, exit 0 under 1300 ms
    wall 3049 ms is not under 1300 ms
  FAIL B4 no ROOM.md: exit 0, empty output, under 600 ms
    wall 1011 ms is not under 600 ms
onstop-wait: 4 FAILED
```

The set matches the plan (S2 and B2 ok; S1, B1, B3, B4 FAIL). One test defect was found on the first RED run and fixed before the commit: B1 listed the `.mindrian` folder that the recompiler creates in the room root and tried to read `.mindrian/ROOM.md`. The fix filters the listing to the section folders (`s01`..`s15`). No production file was touched.

## Task 2: GREEN

Change: `scripts/on-stop` Phase 88 block only (15 insertions, 10 deletions). Output of the test at load 13.3 (PROVEN):

```
  ok S1 block shape: waits on RECOMPILE_PIDS, guarded, watcher kills the list
  ok S2 file: anchors once, bash -n, line budget
  ok B1 speed: 15 sections, real recompiler, median under 600 ms (runs 437, 428, 410 ms, median 428 ms)
  ok B2 hang that honors SIGTERM: exit 0 under 1300 ms (418 ms)
  ok B3 hang that ignores SIGTERM: freed by the watcher, exit 0 under 1300 ms (1008 ms)
  ok B4 no ROOM.md: exit 0, empty output, under 600 ms (4 ms)
onstop-wait: ALL PASS
```

| Arm | Before (RED) | After (GREEN) |
|-----|--------------|---------------|
| B1, 15 sections | 1,020 / 1,024 / 1,039 ms | 437 / 428 / 410 ms |
| B2, hang honors SIGTERM | 1,008 ms | 418 ms |
| B3, hang ignores SIGTERM | 3,049 ms | 1,008 ms |
| B4, no ROOM.md | 1,011 ms | 4 ms |

Other checks (PROVEN):
- `bash -n scripts/on-stop`: exit 0.
- Region check: ONLY-LOOP-CHANGED. Every line outside the anchor region is byte-identical to 861ae9c59, so the FBRIEF-01 brief block is unchanged.
- File mode: 100755.
- Line count: 656 lines, budget 680 (lineCountBudget pass). The block grew by 5 lines, as the plan expected (651 to 656).
- Suite table: see Task 1 (no new failure; the one baseline failure passed after).

## Task 3: measurement

Method: DD-6 to DD-8. Both variants ran in this worktree, with NODE_PATH = MAIN/node_modules and the harness copy in the scratchpad. Variant before = `git show 861ae9c59:scripts/on-stop`; variant after = HEAD. An EXIT trap restores HEAD. After the last leg, `git status --porcelain -- scripts/on-stop` and `git diff HEAD -- scripts/on-stop` were empty (PROVEN). The copy leg ran with `nice -n 10` for both variants, with MINDRIAN_ROOMS_HOME set to the scratchpad copy and no registry.json (resolve-room printed the copy path, PROVEN). The copy (138 MB, no .git) was deleted after the run.

Note: during the rsync of the real room, `.mindrian/room.db-shm` and `room.db-wal` vanished. Another session was using the real room at the same time. The real-room numbers carry that noise (UNVERIFIED how much).

### Every harness line, with uptime (PROVEN, from the measure log)

Room copy, attempt 1 (loads: before mean 13.34, after mean 13.14, gap 0.20: measured)

| Leg | Run | uptime load (1 min) | Harness line | phase88 |
|-----|-----|--------------------|--------------|---------|
| before copy | 1 | 13.38 | wall median=2042 ms, slowest on-stop=2041 ms, ambient-stop 166 ms | 1387 |
| before copy | 2 | 13.38 | wall median=1907 ms, on-stop=1907 ms, ambient-stop 143 ms | 1315 |
| before copy | 3 | 13.27 | wall median=1920 ms, on-stop=1920 ms, ambient-stop 147 ms | 1350 |
| after copy | 1 | 13.14 | wall median=1345 ms, on-stop=1344 ms, ambient-stop 170 ms | 738 |
| after copy | 2 | 13.14 | wall median=1263 ms, on-stop=1263 ms, ambient-stop 137 ms | 723 |
| after copy | 3 | 13.14 | wall median=1230 ms, on-stop=1230 ms, ambient-stop 148 ms | 715 |

Copy result: Stop median 1,920 to 1,263 ms (minus 657 ms); phase88 median 1,350 to 723 ms (minus 627 ms).

Real room, attempt 1 (loads: before mean 12.62, after mean 10.96, gap 1.66: inconclusive (load))

| Leg | Run | uptime load | Harness line | phase88 |
|-----|-----|-------------|--------------|---------|
| before real | 1 | 12.73 | wall 5372 ms, on-stop 5372 ms, hmi-compliance-poll 255 ms | 2933 |
| before real | 2 | 12.67 | wall 5367 ms, on-stop 5367 ms, ambient-stop 277 ms | 2991 |
| before real | 3 | 12.46 | wall 6133 ms, on-stop 6133 ms, hmi-compliance-poll 239 ms | 3143 |
| after real | 1 | 11.78 | wall 4555 ms, on-stop 4555 ms, hmi-compliance-poll 421 ms | 2245 |
| after real | 2 | 10.91 | wall 4709 ms, on-stop 4709 ms, ambient-stop 204 ms | 2462 |
| after real | 3 | 10.20 | wall 4638 ms, on-stop 4637 ms, hmi-compliance-poll 179 ms | 2446 |

Real room, attempt 2 (loads: before mean 7.67, after mean 5.92, gap 1.75: inconclusive (load))

| Leg | Run | uptime load | Harness line | phase88 |
|-----|-----|-------------|--------------|---------|
| before real | 1 | 8.01 | wall 5140 ms, on-stop 5140 ms, ambient-stop 171 ms | 2881 |
| before real | 2 | 7.77 | wall 4916 ms, on-stop 4916 ms, ambient-stop 184 ms | 2778 |
| before real | 3 | 7.22 | wall 5161 ms, on-stop 5161 ms, hmi-compliance-poll 174 ms | 2947 |
| after real | 1 | 6.34 | wall 4460 ms, on-stop 4460 ms, hmi-compliance-poll 189 ms | 2272 |
| after real | 2 | 5.91 | wall 4303 ms, on-stop 4302 ms, hmi-compliance-poll 165 ms | 2228 |
| after real | 3 | 5.52 | wall 4270 ms, on-stop 4269 ms, ambient-stop 210 ms | 2238 |

Real room, attempt 3 (loads: before mean 4.07, after mean 3.88, gap 0.19: measured)

| Leg | Run | uptime load | Harness line | phase88 |
|-----|-----|-------------|--------------|---------|
| before real | 1 | 4.51 | wall 5290 ms, on-stop 5290 ms, ambient-stop 175 ms | 2983 |
| before real | 2 | 3.97 | wall 5164 ms, on-stop 5164 ms, hmi-compliance-poll 167 ms | 2981 |
| before real | 3 | 3.73 | wall 5068 ms, on-stop 5068 ms, ambient-stop 184 ms | 2909 |
| after real | 1 | 3.51 | wall 4662 ms, on-stop 4662 ms, ambient-stop 172 ms | 2356 |
| after real | 2 | 4.19 | wall 4505 ms, on-stop 4504 ms, hmi-compliance-poll 171 ms | 2229 |
| after real | 3 | 3.94 | wall 4515 ms, on-stop 4515 ms, hmi-compliance-poll 180 ms | 2255 |

### Medians and verdicts

| Pair | Wall before | Wall after | phase88 before | phase88 after | Verdict |
|------|-------------|------------|----------------|---------------|---------|
| copy, attempt 1 | 1,920 | 1,263 | 1,350 | 723 | measured |
| real, attempt 1 | 5,372 | 4,638 | 2,991 | 2,446 | inconclusive (load) |
| real, attempt 2 | 5,140 | 4,303 | 2,881 | 2,238 | inconclusive (load) |
| real, attempt 3 | 5,164 | 4,515 | 2,981 | 2,255 | measured |

The load fell during the real-room attempts (host went from 12 to 4), which is why the before and after legs differed in attempts 1 and 2. The inconclusive pairs show the same direction and size of change (minus 734 and 837 ms), but they do not count. The CHANGELOG bullet uses attempt 3 for the real room and attempt 1 for the copy.

Comparison with F-2 (after kqv: 4,764 and 4,851 ms): the real-room before median of attempt 3 is 5,164 ms, 313 to 400 ms higher than F-2. UNVERIFIED reason: another session was active in the real room, and the host was busier than in F-2. The after median of 4,515 ms is 249 ms below the older F-2 value of 4,764 ms.

The result matches the stated expectation (a 0.6 to 0.9 s drop). The Stop event drop on the real room (attempt 3) is 649 ms; phase88 drops 726 ms.

## Findings

1. P-4 (PROVEN in planning): inside the async watcher subshell `$(jobs -p)` is empty, so the old watcher ran `kill` with no PID. The old 1 s cap never stopped anything. Arm B3 shows it: with a recompile that ignores SIGTERM, the old block took 3,049 ms; the new block takes 1,008 ms.
2. P-5 / DD-3 (PROVEN in planning): a watcher that keeps the hook stdout open holds the reader's pipe for its orphaned `sleep 1`. The new watcher writes to /dev/null. Arms B1 and B4 measure to pipe close, so a held pipe would fail them (B4: 4 ms).
3. DD-4 (UNVERIFIED): the bash 3.2 empty-array guard `[ -n "${RECOMPILE_PIDS[0]+set}" ]` is correct by documented behavior. No bash 3.2 binary is on this host (local bash is 5.2.21). Arm B4 runs the empty path on 5.2 only.
4. DD-5 (PROVEN by reading, P-8): the hook no longer waits on the track-analytics job started at line 147. It prints nothing to stdout and normally ends in milliseconds. This is a known change of scope of the wait. Its output to the hook is unchanged.
5. P-14 (UNVERIFIED, ASSUMED): stock macOS has no GNU `timeout`, so the recompile never runs there. This is pre-existing and out of scope.
6. DD-9, brief finding (orchestrator finding, not measured by this plan, C-3: brief block untouched). Skipped nests never touch BRIEF.md, so the oldest-first rotation never advances. On /mnt/c each nest costs about 120 ms (9p), so the 1.2 s budget is spent on 10 no-op skips, and 5 to 7 nests are never reached. Two options for a later quick:
   - (a) a cheap per-nest input-mtime check before the renderer is called;
   - (b) a cursor file that records where the last stop ended.
7. Still large after this fix: the real-room Stop is 4.5 s, and phase88 is still 2.2 s on the real room. The recompile step itself is not the whole of phase88 (the census and the single Node snapshot run on /mnt/c). UNVERIFIED which part dominates; a later quick can profile it.

## Deviations from Plan

1. [Rule 1 - test defect] B1 first read `.mindrian/ROOM.md`. Fixed in the test before the RED commit (see Task 1). No production change.
2. The plan verify command of Task 3 uses `grep -qF "${ADDED#+}"`, where the text starts with `- **`. grep reads that as an option. I ran the same check with `grep -qF --`. It passed (in-changed-ok). Every other check ran as written.
3. The plan Task 1 verify shows the dash check on the test file only. I also checked the CHANGELOG bullet and this SUMMARY for em-dash and en-dash.

## Threat Flags

None. The change adds no network call, no new file path and no new trust boundary. T-8vd-01 (watcher kills the PID list) is mitigated and proven by B3. T-8vd-02 (orphaned sleep) is mitigated by `>/dev/null 2>&1`. T-8vd-03 is mitigated by the `+set` guard (bash 5.2 only). T-8vd-06 (temporary swap) is closed: scripts/on-stop equals HEAD. T-8vd-07 is closed: the room copy is deleted.

## Protocol report

STATUS: DONE
CHANGED: tests/test-261030-8vd-onstop-wait.cjs (46ab7b31a), scripts/on-stop (20271cf68), CHANGELOG.md (5b994b84d). This SUMMARY is uncommitted (the orchestrator commits it).
VERIFIED: the new test fails on the unchanged tree (S1, B1, B3, B4) and passes after the fix; bash -n; region check ONLY-LOOP-CHANGED; mode 100755; 656 lines of 680; 6 suites show no new failure; the three commits are ancestors of HEAD; real-room Stop median 5,164 to 4,515 ms and phase88 2,981 to 2,255 ms at equal load (gap 0.19).
UNVERIFIED: bash 3.2 behavior; macOS without GNU timeout; that Claude Code waits for the stdout pipe to close; the cause of the high real-room before median compared with F-2; the guardian LEG B baseline failure (load flake, not rerun at equal load).
RISKS: under load, 15 parallel recompiles take 0.4 s and the 0.4 s timeout can cut some (pre-existing). The track-analytics job is no longer waited on. Another session shared the real room during the runs.
NEXT: Commit this SUMMARY with the planning files (git add -f). Then decide on the brief options (a) or (b) and on a profile of the rest of phase88.
