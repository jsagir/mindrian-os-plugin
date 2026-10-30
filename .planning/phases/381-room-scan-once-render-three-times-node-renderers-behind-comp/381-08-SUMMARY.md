---
phase: 381-room-scan-once-render-three-times-node-renderers-behind-comp
plan: 08
subsystem: infra
tags: [parity-record, measurements, changelog, perf]
requires:
  - phase: 381-07
    provides: all three entry points on the node renderers, legacy bodies behind MINDRIAN_LEGACY_COMPUTE=1
  - phase: 381-02
    provides: the Before numbers, the bench copies and the measurement method
provides:
  - 381-PARITY.md, the recorded zero-diff run that plan 381-09 reads before it removes the legacy bodies
  - the After section of 381-MEASUREMENTS.md with a Before and After table
  - two CHANGELOG Unreleased bullets (Changed, Fixed)
affects: [381-09]
tech-stack:
  added: []
  patterns: [one snapshot copy of the real room for parity, TOUCH target found by content sha256]
key-files:
  created:
    - .planning/phases/381-room-scan-once-render-three-times-node-renderers-behind-comp/381-PARITY.md
  modified:
    - .planning/phases/381-room-scan-once-render-three-times-node-renderers-behind-comp/381-MEASUREMENTS.md
    - CHANGELOG.md
key-decisions:
  - "The real room went into parity through one cp -a snapshot in the session scratchpad; the harness copied the snapshot per pair, and the snapshot was deleted after runs d and e."
  - "The Fixed bullet names no time limit value, because the 2 second figure is not in 381-MEASUREMENTS.md; every number in the bullets is traced to that file."
  - "CHANGELOG numbers are written without thousands separators so that each one matches the measurements file byte for byte."
requirements-completed: [PERF381-01, PERF381-07]
duration: 25min
completed: 2026-10-30
---

# Phase 381 Plan 08: Parity record, After numbers and CHANGELOG Summary

The zero-diff parity run is recorded on 24 gate-room labels and a real-room snapshot (5 runs, every run `parity: 0 diffs`). The After numbers use the Before protocol. SessionStart CHANGED on the real room went from a median of 26943 ms to 7775 ms. The background summary rebuild went from 5 s to 0 s. On the /mnt/c copy, compute-state went from 7977 ms to 1341 ms and analyze-room from 22734 ms to 1231 ms.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `17a964e18` | docs(381-08): record the zero-diff parity run on the gate rooms and the real-room copy |
| 2 | `94afd57c8` | docs(381-08): record the after numbers with the before protocol |
| 3 | `efbd18f85` | docs(381-08): changelog entries for the one-pass room summary and the stop-gate stamp fix |

The work ran in two stages. Stage A was Task 1 plus the bench dry runs. Stage B (Tasks 2 and 3) ran after the orchestrator confirmed a quiet window ("GO").

## Task 1: parity and the test run (PROVEN, HEAD 5affaf2b6)

| Run | Last line | load1 start/end |
|---|---|---|
| (a) default TZ=UTC | parity: 0 diffs in 68 pairs | 0.64 / 2.56 |
| (b) --tz host (Asia/Hebron) | parity: 0 diffs in 68 pairs | 2.36 / 1.97 |
| (c) --legacy-switch | parity: 0 diffs in 68 pairs | 1.81 / 1.90 |
| (d) --room snapshot | parity: 0 diffs in 71 pairs | 1.89 / 1.54 |
| (e) --determinism --room snapshot | parity: 0 diffs in 71 pairs | 1.41 / 1.55 |

- `bash tests/run-all-381.sh`: PASS=10 FAIL=0 SKIP=0.
- All 17 pinning-list and Part 11 commands exited 0. This includes test-phase-13 (32/0), test-phase-27 (8/0), connector-registry OK and orchestration-projection OK.
- tests/fixtures was clean before and after the run.

## Task 2: After numbers (HEAD 17a964e18, code equal to 5affaf2b6)

| Metric | Before median | After median | Change |
|---|---|---|---|
| compute-team, /mnt/c copy | 2535 ms | 362 ms | -2173 ms |
| compute-state, /mnt/c copy | 7977 ms | 1341 ms | -6636 ms |
| analyze-room, /mnt/c copy | 22734 ms | 1231 ms | -21503 ms |
| compute-meetings-intelligence, /mnt/c copy | 239 ms | 237 ms | -2 ms |
| SessionStart CHANGED, real room | 26943 ms | 7775 ms | -19168 ms |
| Stop event wall CHANGED, real room | 4688 ms | 4851 ms | +163 ms |
| on-stop-state-bg done elapsed_s | 5 s | 0 s | -5 s |

Two medians did not go down:
- compute-meetings-intelligence NEW (237 ms) is not lower than OLD in the same run (236 ms). This script is not ported (ruling 5).
- The Stop event wall went up by 163 ms. Since quick kqv it does not carry compute-state, because compute-state runs detached. The slowest hook is on-stop, and its other steps (phase88 2896 to 2936 ms, brief 1222 to 1273 ms in the series) are outside this phase.

Notes items 9 to 16 of 381-MEASUREMENTS.md record:
- the idle next-server process (pid 339036): 0.0 %CPU at every probe, 0.01 s of CPU in the whole window
- the foreign Stop cycle on the room in the Block 1 window (session `5ecdb98a`). Block 1 runs only on the copy.
- the installed-plugin compute-state runs after the window
- the restore of the TOUCH file mtime (1793272733) and its unchanged content sha256

## Task 3: CHANGELOG

The plan's own acceptance check for this task (`awk ... | grep -c "Not live until a release carries it."`) prints 14.

Number trace (`grep -cF` in 381-MEASUREMENTS.md):

| Number | Count in the file |
|---|---|
| Median of 3 | 1 |
| 26943 | 5 |
| 7775 | 3 |
| `\| 5 s \|` | 2 |
| `\| 0 s \|` | 2 |
| 7977 | 4 |
| 1341 | 5 |
| 22734 | 5 |
| 1231 | 4 |

- The new lines have no em-dash or en-dash. They do not use the words estimate or approximately, and they do not put "about" before a number.
- `git diff HEAD~1 -- CHANGELOG.md` shows 2 added lines (17 and 25) inside the Unreleased block.

## Deviations from Plan

1. **[Rule 3 - Blocking] The scratch loop of the pinning list consumed its own heredoc.** The first loop stopped after 6 commands, because `bash -c` read stdin. I ran the loop again with `< /dev/null`, and all commands exited 0. The scratch script was not committed.
2. **The Fixed bullet has no "2 second" value.** The plan's Step 2 text names it, but the acceptance criterion requires each number to be in 381-MEASUREMENTS.md, and it is not there. The bullet says "the save's time limit".
3. **Block 1 copy check.** The copy held 450 files, not 445 or 446. The room now has 447 files, and 3 transient files under `.mindrian` (`room.db-shm`, `room.db-wal`, `write.lock`) were present at copy time. The copy was complete: no file of the room was missing (comm check).

## Known Stubs

None.

## Threat Flags

None. This plan edits no shipped code.

## Self-Check: PASSED

- The files 381-PARITY.md, 381-MEASUREMENTS.md and CHANGELOG.md exist and are committed.
- `git log` shows the commits 17a964e18, 94afd57c8 and efbd18f85.
