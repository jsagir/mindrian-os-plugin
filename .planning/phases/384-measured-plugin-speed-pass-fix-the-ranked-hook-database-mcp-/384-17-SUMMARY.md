---
phase: 384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-
plan: 17
subsystem: brain
tags: [perf, brain-prewarm, timer, ab-verdict, keep, c-a]
requires:
  - phase: 384-12
    provides: ab-verdict, pin-tree, tree-b modes
  - phase: 384-16
    provides: measuring routine
provides:
  - parity and mechanism checks for lib/core/brain-prewarm.cjs
  - the pre-warm timeout timer is cleared in a finally clause (port of fb295a541)
  - measured before and after of doctor --all and the SessionStart background tail, verdict KEEP on both
key-files:
  created:
    - tests/test-384-ca-prewarm-timer.cjs
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/fix-ca-readings.md
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/fix-ca-readings.json
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/fix-ca-readings-events.json
  modified:
    - lib/core/brain-prewarm.cjs
key-decisions:
  - "Keep rule F10 applied as written: both primaries print KEEP, the guard prints NO-GAIN (not WORSE), so the fix stays. No retake needed."
requirements-completed: [PERF384-F06]
completed: 2026-11-07
---

# Phase 384 Plan 17: C-A pre-warm timer Summary

STATUS DONE. The fix stays. `ab-verdict` printed `VERDICT KEEP d1=13882 d2=14740.4 noise=1310.4 floor=50` on the doctor --all wall median, and `VERDICT KEEP d1=14826 d2=14840 noise=14 floor=50` on the SessionStart:changed background time. The guard printed NO-GAIN. `ab-verdict outcome` exits 0 on both readings files.

START_SHA: 7e7cccca5b6bd4897ca1759c69f5691995d63ac2.

## Commits

| Sha | Subject | State |
|-----|---------|-------|
| 3a9213d18 | test(384-17): parity group for brain-prewarm (marker keys, return value, no stdout) | stays |
| c5bf88d73 | test(384-17): failing mechanism group, the pre-warm timer stays armed after the probe answers | stays |
| 779fb8fe0 | fix(384-17): clear the Brain pre-warm timeout timer so the shim exits when the probe is done (port of fb295a541) | stays |
| 5e71292ac | docs(384-17): C-A before and after on pinned exports, verdict KEEP | stays |

BEFORE tree = c5bf88d73 (FIX^). Its lib/core/brain-prewarm.cjs equals START_SHA (the first two commits touch only the test file). The change was written by hand from `git show fb295a541`; no merge, no cherry-pick. Changed lines in lib/core/brain-prewarm.cjs: 9 (8 insertions, 1 deletion); the source commit has 9. hooks/hooks.json, scripts/doctor.cjs, package.json and npm-shrinkwrap.json never changed. phase-guard prints OK.

## Change

`let timer = null;` before the try; the timer is stored in `timer` inside the Promise executor of the race; `finally { if (timer !== null) clearTimeout(timer); }` after the catch. Comment says why in plain words. Marker keys, marker write, return value and debug log lines are unchanged.

## RED and GREEN checks

- Parity group (P1 marker keys, values, return equals file, no body, for object, null, reject and never-settling probes; P2 child exit 0, stdout empty, stderr empty, marker written; P3 settles in under 1000 ms with timeoutMs 20000; M3 timeout path resolves after timeoutMs with ok false): passed on the unchanged code and passed with the change.
- Mechanism group on the unchanged code (RED): M1 failed for the answering probe (before 0, after 1 armed Timeout) and for the rejecting probe (before 1, after 2); M2 failed (child exited after 8121 ms with timeoutMs 8000). M3 (no armed timer after the timeout path) passed, as the plan says.
- Mechanism group with the change (GREEN): M1 (0 and 0 after), M2 child exit 113 ms, M3 all pass; `ca-prewarm: ALL PASS` for `all`.
- Lesson from 384-16 applied: the mechanism group is in its own commit (c5bf88d73), and a run with no argument runs the parity group only. A revert of the fix and the mechanism commit would leave a no-argument run green.

## Measurement (copied from measurements/fix-ca-readings.md)

Pinned exports of BEFORE and FIX, fixture room, taskset 0-3, two interleaved sets under the lock. doctor:all n of 7 per tree per set; events n of 15 per tree per set. load1 at the start of the four blocks: 1.17, 1.28, 0.80, 0.43.

| metric | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| doctor --all wall_ms.median | 18419.4 (17877.2 / 18961.6) | 4108.2 (3995.2 / 4221.2) | 19455.9 | 4460.6 | 13882 | 14740.4 | 1310.4 | 50 | 5.887271 | 5.501193 | KEEP |
| SessionStart:changed background_ms | 14840 (14834 / 14846) | 7 (8 / 6) | n/a | n/a | 14826 | 14840 | 14 | 50 | 0.080863 | 28.571429 | KEEP |
| guard SessionStart:changed wall_ms.median | 5222.25 (5356.9 / 5087.6) | 5494.95 (5660.6 / 5329.3) | 6167.3 | 6251.5 | -303.7 | -241.7 | 600.6 | 50 | 5.156781 | 6.029172 | NO-GAIN |
| info PostCompact background_ms | 9.5 (8 / 11) | 10 (9 / 11) | n/a | n/a | -1 | 0 | 5 | 50 | 31.578947 | 20 | NO-GAIN |
| info PostCompact wall_ms.median | 37.4 (29.6 / 45.2) | 35.65 (28.4 / 42.9) | 49.6 | 48.6 | 1.2 | 2.3 | 30.1 | 50 | 41.71123 | 40.673212 | NO-GAIN |

Reading: doctor --all wall median is 18419.4 ms before and 4108.2 ms after, lower by about 14.3 s. The SessionStart:changed background time is 14840 ms before and 7 ms after, lower by about 14.8 s. These two differences are the evidence for the link between the 15 s timer and the two numbers (before this plan the link was a hypothesis). The guard difference is a rise of 270 ms in the median wall of the after tree against a noise of 600.6, so the word is NO-GAIN, not WORSE; no cause is claimed. In this run the PostCompact background time was about 10 ms in both trees; the 14.86 s tail recorded earlier for PostCompact in the census did not appear here, and the cause is UNVERIFIED and not examined. The doctor --all median before (18.4 s) is higher than the 16.4 s of plan 384-09 (different machine moment; the A-B difference is what is compared).

## Suites (run in the working tree with the change, before the measurement)

Green: tests/test-384-ca-prewarm-timer.cjs (all), test-339-brain-prewarm-cold-start, test-257-shim-honest-refusal, test-257-brain-tool-egress-invariant, test-380-build, test-380-copy, `build-connector-registry --check`.

Red, not failures of this plan:
- run-all-339: PASS=15 FAIL=1. The failing leg is `dist bundle staleness` (bundle generated from 2.0.0-beta.52, live plugin 2.0.0-beta.80). The same line prints in an export of START_SHA.
- run-all-366: PASSED=75 FAILED=1 KNOWN=1, the same result as in plans 384-14, 384-15 and 384-16 (380 gate wiring).

## Deviations from Plan

1. [Process] The default run (no argument) runs the parity group only; the plan text said "no argument runs both". Both groups run with the argument `all`. Reason: the lesson from 384-16 (a group that is RED on unchanged code must not run in a no-argument run at HEAD after a revert). The mechanism group is in a separate commit.
2. [Process] The shorter suites (test-339, test-257, test-380, run-all-339, run-all-366) ran without the lock; they are functional suites, not timed runs. Only the new test and the measurements ran under the lock.
3. [Process] No retake: both primaries are KEEP and the guard is not WORSE, so F10 asks for none.
4. [Process] The branch is `main` in a linked tree; the worktree-agent branch assertion does not apply. The revert path was not used.

## Known Stubs

None.

## Threat Flags

None. Marker content (three keys, no body), return value and stdout behavior are held by tests P1 and P2; the timeout path is held by M3.

## NOT MEASURED, UNVERIFIED

Brain network time (the Brain URL is the unreachable loopback in every run). A reachable Brain (the probe then answers in network time; the timer is cleared at that moment, the same code path). Desktop and Cowork surfaces (the pre-warm runs in the MCP shim on all three; only the Linux CLI path and the doctor path were measured). A real room (fixture room only, Canon Part 8). The cause of the guard rise of 270 ms (inside noise). The cause of the missing PostCompact tail.

## Self-Check: PASSED

Files exist: tests/test-384-ca-prewarm-timer.cjs, fix-ca-doctor-set1.json, fix-ca-doctor-set1-b.json, fix-ca-doctor-set2.json, fix-ca-doctor-set2-b.json, fix-ca-events-set1.json, fix-ca-events-set1-b.json, fix-ca-events-set2.json, fix-ca-events-set2-b.json, fix-ca-readings.json, fix-ca-readings-events.json, fix-ca-readings.md. Commits 3a9213d18, c5bf88d73, 779fb8fe0, 5e71292ac are in the log. `ab-verdict outcome` exits 0 on both readings files. verify-results OK. phase-guard prints OK. No path or room text in the result files. No em dash or en dash.
