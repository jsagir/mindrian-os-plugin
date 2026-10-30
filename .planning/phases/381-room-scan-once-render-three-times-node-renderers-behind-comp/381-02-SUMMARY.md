---
phase: 381-room-scan-once-render-three-times-node-renderers-behind-comp
plan: 02
subsystem: measurement
tags: [perf, bench, hooks, before-numbers]
requires:
  - phase: 381-01
    provides: BASE_SHA, oracle-381.cjs (buildOldTree, copyRoom, cleanEnv), room-381 fixture builder
provides:
  - phase copy of the audit hook bench with a SessionStart payload
  - per-script timing helper (OLD tree or NEW repo, copy only)
  - Before numbers at the phase base (381-MEASUREMENTS.md)
affects: [381-08]
tech-stack:
  added: []
  patterns: [argv switch-case router, measurement on a /mnt/c copy only]
key-files:
  created:
    - .planning/phases/381-room-scan-once-render-three-times-node-renderers-behind-comp/bench/hook-bench-381.cjs
    - .planning/phases/381-room-scan-once-render-three-times-node-renderers-behind-comp/bench/script-timing-381.cjs
    - .planning/phases/381-room-scan-once-render-three-times-node-renderers-behind-comp/bench/BENCH-DIFF.md
    - .planning/phases/381-room-scan-once-render-three-times-node-renderers-behind-comp/381-MEASUREMENTS.md
  modified: []
key-decisions:
  - "TOUCH target is the newest non-ignored .md (a meeting file), not FEYNMAN.md: the lx3 ignore list makes FEYNMAN.md, MINTO.md and BRIEF.md invisible to the CHANGED check."
  - "PAUSE_MS added to the bench copy: the /mnt/c 9p mount keeps whole seconds, so back-to-back TOUCH and STATE.md writes tie."
requirements-completed: [PERF381-07]
duration: one quiet window (21:19Z to 21:28Z) plus setup
completed: 2026-10-29
---

# Phase 381 Plan 02: Before numbers at the phase base Summary

The phase owns a SessionStart-capable copy of the audit hook bench and a per-script timing helper, and 381-MEASUREMENTS.md holds real Before numbers taken on HEAD e696981a3 (scripts equal BASE_SHA 65aaf329f).

## Before numbers (full tables and raw lines in 381-MEASUREMENTS.md)

| Metric | Median | load1 |
|---|---|---|
| compute-team (copy, old) | 2535 ms | 0.77 |
| compute-state (copy, old) | 7977 ms | 0.86 |
| analyze-room (copy, old) | 22734 ms | 1.04 |
| compute-meetings-intelligence (copy, old) | 239 ms | 1.03 |
| SessionStart CHANGED, real room, 8 hooks | 26943 ms | 1.12 to 1.75 |
| Stop CHANGED event wall, real room | 4688 ms | 0.82 to 1.00 |
| on-stop-state-bg done elapsed_s | 5, 5, 6 s | 0.82 to 1.00 |

## Tasks

1. Phase copy of the hook bench and the per-script timing helper - commit 0017dcf49; PAUSE_MS follow-up 4be65a64f.
2. Measure the phase base and write 381-MEASUREMENTS.md - commit 8e6ba5eb9.

## Deviations from Plan

**1. [Rule 1 - Bug] TOUCH target ineffective.** The plan's rule (newest .md at depth 1 of problem-definition) picks FEYNMAN.md, which the lx3 `room_newer` ignore list skips. A first SessionStart series on it read `state mode=reuse reason=unchanged`. Fixed by touching `problem-definition/<meeting-file>.md`. Discarded numbers are in the Notes of 381-MEASUREMENTS.md.

**2. [Rule 3 - Blocking] Same-second tie on the 9p mount.** In the first Stop series the second run read as unchanged. Added env PAUSE_MS to hook-bench-381.cjs (recorded in BENCH-DIFF.md) and repeated the series. Commit 4be65a64f.

**3. [Rule 3 - Blocking] Copy failed on a transient lock.** `cp -a` of the live room failed on `.mindrian/write.lock`. Recreated the copy whole and repeated Block 1.

## Issues Encountered

- Sub-second mtimes cannot be restored on the 9p mount (whole seconds only). Both touched files were restored to the whole second.
- The shipped hooks rewrote render timestamps in `problem-definition/FEYNMAN.md` and other generated files of the real room during the series (normal hook output, authorized by ruling 10). FEYNMAN.md content sha256 is not the original; the diff is three render timestamps. Not overwritten.
- Two other session ids wrote `.mindrian/decision-traces/` during Block 2 (hidden path, cannot affect the CHANGED check).

## Threat Flags

None. No shipped script, lib file or hook changed.

## Known Stubs

None.

## Self-Check: PASSED

Files exist: bench/hook-bench-381.cjs, bench/script-timing-381.cjs, bench/BENCH-DIFF.md, 381-MEASUREMENTS.md. Commits exist: 0017dcf49, 4be65a64f, 8e6ba5eb9.
