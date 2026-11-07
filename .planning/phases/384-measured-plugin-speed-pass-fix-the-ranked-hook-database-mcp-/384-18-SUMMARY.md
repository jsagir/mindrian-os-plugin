---
phase: 384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-
plan: 18
subsystem: doctor
tags: [perf, doctor, room-map, memo, ab-verdict, no-gain, dropped, c-b]
requires:
  - phase: 384-12
    provides: ab-verdict, pin-tree, tree-b modes
  - phase: 384-17
    provides: measuring routine, doctor --all baseline with the pre-warm timer change
provides:
  - measured before and after of Phase 382 commit 23ab77410 in a scratch tree (fixture and local real-room copy), verdict NO-GAIN on both
  - owner decision option-c (drop C-B)
key-files:
  created:
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/fix-cb-pre-readings.md
    - .planning/phases/384-measured-plugin-speed-pass-fix-the-ranked-hook-database-mcp-/measurements/fix-cb-pre-readings.json
  modified: []
key-decisions:
  - "Owner decision 2026-11-07: option-c, drop C-B. Task 3 did not run. Commit 23ab77410 stays on its old branch (workspace/perf-optimize). The 987-line helpers of bc3421a8b and the parity test ce5e4d8b9 stay off main."
requirements-completed: [PERF384-F07]
completed: 2026-11-07
---

# Phase 384 Plan 18: C-B doctor room-map memo Summary

STATUS DONE. The owner chose option-c on 2026-11-07: drop C-B. No product file and no test file changed in this plan. Task 1 (scratch measurement) ran and gave VERDICT NO-GAIN on both room classes. Task 2 (owner decision) returned option-c. Task 3 did not run.

START_SHA: 25bb9d04b17b86be718d17e85ca6b0bf95d6969b.

## Commits

| Sha | Subject | State |
|-----|---------|-------|
| b198c23d5 | docs(384-18): C-B candidate before and after in a scratch tree, verdict NO-GAIN | stays |

## Decision

Owner decision (typed choice on the card, 2026-11-07): option-c, drop C-B.

- Commit 23ab77410 (46 insertions, 4 deletions; one map of the active room per doctor engine pass) stays on its old branch, workspace/perf-optimize (PROVEN: `git branch --contains 23ab77410` lists only that branch). It does not enter main. No merge, no cherry-pick.
- The parity test ce5e4d8b9 and the 987-line helpers of bc3421a8b stay off main, as owner decision 10 (C-C) says. The conflict between decision 10 and C-C does not arise.
- Task 3 (tests, port by hand, final before and after) did not run. No file of the four product files (lib/core/doctor/shared.cjs, room-map-module.cjs, section-ruling-module.cjs, scripts/doctor.cjs) changed.

## Task 1 measurement (copied from measurements/fix-cb-pre-readings.md)

Tree A is an export of START_SHA. Tree B is the same export with 23ab77410 applied (clean apply, no hand port). Target doctor --all, metric wall_ms.median, taskset 0-3, two interleaved sets, n of 7 per tree per set, under the lock. Load1 at block start: 0.81 (fixture), 1.07 (copy).

| class | median A | median B | p95 A | p95 B | d1 | d2 | noise | floor | spread A % | spread B % | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| local real-room copy (decision primary) | 3701.55 (3481.2 / 3921.9) | 3952 (4185.2 / 3718.8) | 4082.1 | 4431.8 | -704 | 203.1 | 907.1 | 50 | 11.905823 | 11.801619 | NO-GAIN |
| fixture rooms home | 3862.2 (3577.5 / 4146.9) | 3708.45 (3510.3 / 3906.6) | 4656.8 | 4022.5 | 67.2 | 240.3 | 965.7 | 50 | 14.742893 | 10.686405 | NO-GAIN |

Reading: the noise (about 900 ms) is larger than every difference. On the local copy the signs of d1 and d2 differ. On the fixture both signs are positive but inside the noise. No effect of the candidate is resolved at the floor of 50 ms.

The local copy was made by the harness picker, scratch only: class real-copy, 221 files, 13728700 bytes, file system ext2/ext3. Isolation check strict, both sets exit 0. No path or room name is in any file.

## NOT MEASURED

The Windows mount class is NOT MEASURED in this phase (owner decision 5). The numbers in the Phase 382 commit message (3.9 ms per file call warm, about 1.0 s per pass warm, 12 s cold) are the Phase 382 author's claims for the mount. They are not claims of this phase, and nothing here confirms or refutes them. If the mount class matters later, a mount measurement is the open item.

## Deviations from Plan

None. Task 1 ran as written; Task 2 stopped for the owner; the owner answer ended the plan before Task 3. The plan lists no SKIP.

## Known Stubs

None.

## Threat Flags

None. No code changed. The real-room copy was scratch only and was removed; no room content entered any file.

## Self-Check: PASSED

Commit b198c23d5 exists in the log. The ten fix-cb-pre-* files exist in the measurements folder. `verify-results` printed OK. No product file changed since START_SHA (`git diff --quiet START_SHA -- lib scripts hooks bin` clean at Task 1).
