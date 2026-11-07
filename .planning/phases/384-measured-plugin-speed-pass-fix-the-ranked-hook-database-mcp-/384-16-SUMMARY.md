---
phase: 384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-
plan: 16
subsystem: hooks
tags: [perf, subagent-stop, concurrency-cap, ab-verdict, no-gain, worse, reverted]
requires:
  - phase: 384-12
    provides: ab-verdict, pin-tree, tree-b modes
  - phase: 384-15
    provides: measuring routine
provides:
  - parity group and golden envelope for scripts/on-agent-complete
  - measured before and after of a batch cap of 4 on the SubagentStop cascade, verdict NO-GAIN (change reverted)
key-files:
  created:
    - tests/test-384-s4-agent-complete.cjs
    - tests/fixtures/384-s4-envelope-golden.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/fix-s4-set1.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/fix-s4-set2.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/fix-s4-readings.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/fix-s4-readings.md
  modified: []
key-decisions:
  - "Keep rule applied as written: primary NO-GAIN, three guards WORSE, no retake (the rule retakes only NOT-RESOLVED), fix and mechanism commits reverted, parity commit stays."
requirements-completed: []
completed: 2026-11-07
---

# Phase 384 Plan 16: S4 SubagentStop cap Summary

STATUS PARTIAL. The cap worked as a mechanism (at most 4 post-write calls in flight, tests green) but the machine stayed busy longer and spent more CPU. `ab-verdict` printed `VERDICT NO-GAIN d1=-11060 d2=-13390 noise=8870 floor=50` on survivor CPU at 20 files. Three guards printed WORSE. The fix and the mechanism commits are reverted. `ab-verdict outcome` exits 0.

START_SHA: 5a67d8e0671914246f3195b2980170bda379a881.

## Commits

| Sha | Subject | State |
|-----|---------|-------|
| 876689f2b | test(384-16): parity group for on-agent-complete (golden envelope, call sets, return time) | stays |
| 96543f446 | test(384-16): failing mechanism group, SubagentStop starts every modified file at once | reverted by dd1a8937e |
| e25550a9f | perf(384-16): SubagentStop starts at most 4 modified files at a time from one background dispatcher (S4) | reverted by f640469cb |
| f640469cb | Revert of e25550a9f | |
| dd1a8937e | Revert of 96543f446 | |
| 76ac4cd34 | docs(384-16): S4 before and after on pinned exports, verdict NO-GAIN | stays |

BEFORE tree = 96543f446 (FIX^); its scripts/on-agent-complete equals START_SHA. After the reverts `git diff 5a67d8e06 HEAD -- scripts hooks lib` is empty. hooks/hooks.json never changed. phase-guard prints OK.

## Change tried (reverted)

The foreground loop collected the eligible files; one background subshell (stdin /dev/null, stdout and stderr /dev/null) started them in batches of K, K = 4 by default, `MOS_AGENT_COMPLETE_MAX_JOBS` replacing it for a positive integer of 1 to 4 digits without a leading zero, a plain `wait` between batches. Same calls per file, same envelope, same compute-state step.

## RED and GREEN checks

- Parity group (P1 envelope bytes vs golden for 0, 3, 20 files; P2 call sets and exact arguments with 5 and 23 eligible files, noise files, a name with a space; P3 state step, 0.9 s lower bound, one analytics call; P4 hook exits before the first cascade ends; P5 bash 3.2 guard): passed on the unchanged script, passed with the change, passed again after the reverts.
- Mechanism group on the unchanged script (RED): M1 max in flight 20; M2 for the values 2, 1, 0, -3, abc and empty all failed (max in flight 8 with 8 files).
- Mechanism group with the change (GREEN): ALL PASS.
- After the reverts the mechanism group fails again at HEAD (its code lives in the parity commit 876689f2b, see deviation 1). The parity group passes.

## Measurement (copied from measurements/fix-s4-readings.md)

Pinned exports of BEFORE and FIX, fixture room, n of 7 per tree per set, two interleaved sets, process-census walls-subagent under the lock, load1 at start 1.87 to 1.99.

Primary, survivor CPU at 20 files:

| median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| 28715 (27080 / 30350) | 40940 (38140 / 43740) | n/a | n/a | -11060 | -13390 | 8870 | 50 | 11.387776 | 13.678554 | NO-GAIN |

Guards:

| guard | median A | median B | p95 A | p95 B | d1 | d2 | noise | verdict |
|---|---|---|---|---|---|---|---|---|
| tail (background_ms) 20 files | 21253.5 | 37208 | 22269 | 41426 | -15083 | -16826 | 1743 | WORSE |
| processes (exec_total) 20 files | 17633.5 | 50635 | n/a | n/a | -31707 | -34296 | 2589 | WORSE |
| survivor CPU 5 files | 10030 | 11230 | n/a | n/a | -1430 | -970 | 2460 | NO-GAIN |
| tail (background_ms) 5 files | 9136.5 | 14203 | 10779 | 15712 | -5060 | -5073 | 33 | WORSE |

Informative: hook return time at 20 files printed KEEP (median 669.9 ms before, 456.45 ms after, d1 244.4, d2 182.5, noise 61.9); at 5 files NO-GAIN. Load1 at the end of the runs: no difference (noise 0.78).

The numbers do not show why the process count at 20 files rose from a median of 17633.5 to 50635 (UNVERIFIED cause). One reading to test later: the cascades that ran at the same moment may have shared work that the batches no longer share. This is not tested here.

## Suites (run in the working tree with the change, before the measurement)

Green: tests/test-384-s4-agent-complete.cjs (both groups), test-hook-envelope-shape (16), test-240.1-hook-write-site.sh, test-240.1-state-version-preserved (5 scenarios), test-compute-state-persists, test-261029-qef-hook-timeouts, `build-connector-registry --check`, `build-orchestration-projection --check`.

Red, not failures of this plan:
- test-connector-tier-d-hooks CHECK 4 (scripts/brain-derivation-drain.cjs require of a brain-client): red in an export of START_SHA too (3 passed, 1 failed).
- run-all-366: PASSED=75 FAILED=1 KNOWN=1. The failing leg is the 380 gate wiring (changelog face-panel checks), the same as recorded in 384-14 and 384-15.

## Deviations from Plan

1. [Process] The mechanism group code was written together with the parity group and landed in the parity commit 876689f2b. The commit named "failing mechanism group" (96543f446) holds only a 3-line comment that records the RED reading. History was not rewritten. The parity commit therefore also carries a mechanism group that fails on the unchanged script.
2. [Rule 1 - Test assertion] P4 as written (exit under 800 ms for 20 files) failed on the unchanged script: the foreground fork cost of the old code was 0.94 to 2.3 s for 20 files on this host and rises with load. P4 now uses a post-write stub of 3 s and asserts that the hook exits before the first cascade ends; the exit time is printed as a note. The parity group passes on the unchanged script with this form.
3. [Rule 1 - Test fixture] The 23-eligible-file case runs without noise files: a hidden file takes one of the 20 slots of `head -20` before the guard skips it (old and new code alike), so the "newest 20" would be 19 with noise.
4. [Process] No retake: the primary word is NO-GAIN and F10 retakes only NOT-RESOLVED (same reading as plans 384-13 and 384-15). Guards printed WORSE.
5. [Process] The revert commits carry no Co-Authored-By trailer (git revert --no-edit, no amend).
6. [Process] The branch is `main` in a linked worktree; the worktree-agent branch assertion does not apply.

## Known Stubs

None.

## Threat Flags

None. The change was reverted; while present it kept every file name quoted, used the same call arguments and discarded all dispatcher output.

## NOT MEASURED, UNVERIFIED

Native Windows, Desktop and Cowork surfaces (SubagentStop is a CLI hook), a real room (fixture room only, Canon Part 8), the macOS branch of the script (stat per file), other values of K (only 4 was measured), the cause of the larger process count.

## Self-Check: PASSED

Files exist: tests/test-384-s4-agent-complete.cjs, tests/fixtures/384-s4-envelope-golden.json, fix-s4-set1.json, fix-s4-set2.json, fix-s4-readings.json, fix-s4-readings.md. Commits 876689f2b, 96543f446, e25550a9f, f640469cb, dd1a8937e, 76ac4cd34 are in the log. `ab-verdict outcome` exits 0. phase-guard prints OK. Parity group passes at HEAD.
