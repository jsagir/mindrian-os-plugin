---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "18"
subsystem: doctor
tags: [rca, doctor, graph-doctor, ctx, b16]
requires: []
provides:
  - doctor always-pass ctx carries roomDir from --room
affects: [386-21]
tech-stack:
  added: []
  patterns: [fix at the engine when more than one module reads the field]
key-files:
  created:
    - tests/test-386-graph-doctor-room-ctx.cjs
  modified:
    - scripts/doctor.cjs
    - .planning/debug/graph-doctor-module-ctx-roomdir-never-set.md
key-decisions:
  - "Fix origin is the engine: 2 modules (graph-doctor, research-providers) read ctx.roomDir"
requirements-completed: [B16]
duration: 35min
completed: 2026-11-06
---

# Phase 386 Plan 18: graph-doctor ctx.roomDir Summary

The doctor now passes `roomDir` (from `--room`, null when absent) in the ctx of every always-cadence module, so graph-doctor reports the requested room and not the working directory.

## Accomplishments

- `target: PRESENT` in the RCA (module and registry row both exist; Phases 384 and 385 did not change them).
- Reproduced with a fixture room and a temporary HOME. With `--room=<fixture>` from another directory the row was a skip naming the working directory. From inside the fixture with no flag it was a warn with 1 proposal.
- RCA table: 2 modules read ctx.roomDir (graph-doctor, research-providers). Engine fix chosen. research-providers loads that room's egress policy only when `--room` is given; with no flag it is unchanged.
- Test file with 3 arms. RED run: G1 failed, G2 and G3 passed. GREEN run: all 3 pass. The test reads the row from the real doctor JSON, so it uses the engine's own ctx.
- Checks after the fix: tests/graph-doctor/test-graph-doctor.cjs 6 pass, tests/test-3692-providers.cjs 46 pass, node --check ok. `doctor --acceptance --json` with a temporary HOME gives the same ok/not-ok per row before and after (25 points, 19 pass, 6 fail on both runs; the 6 follow from the empty temporary HOME).

## Task Commits

1. Task 1, RCA: e6ab6286b
2. Task 2, RED test: 30a79afd7
3. Task 3, fix: 0b100bb0e

## Deviations from Plan

None.

## Notes

- `bash tests/run-all-386.sh` shows 10 pass and 1 fail. The failing file is tests/test-386-check-pending-hooks.cjs, the RED test of plan 386-11 committed by a peer (f1d26593c). It is not caused by this plan.
- `tests/test-doctor-module-contract-parity.cjs` exited 0.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED
