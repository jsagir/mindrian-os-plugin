---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "16"
type: execute
subsystem: memory-hook
tags: [B14, posttooluse, room-scope, realpath]
requires: [386-01]
provides: [B14 fixed]
key-files:
  created: [.planning/debug/memory-artifact-graph-hook-reconciles-wrong-room.md, tests/test-386-memory-artifact-hook-room-scope.cjs]
  modified: [scripts/memory-artifact-graph-hook.cjs]
requirements-completed: [B14]
completed: 2026-11-06
---

# Phase 386 Plan 16: B14 memory hook room scope Summary

The PostToolUse memory hook now reconciles the active room only when the written file lies inside that room (realpath on both sides).

## Verdict

target: PRESENT. Reproduced on fixture rooms: a hook run for a MINTO.md path in room B moved the active room A from 0 to 2 memory_artifact nodes.

## Root cause

runHook gated on the basename of the written path only, then resolved the room from the environment or registry. Nothing tied the file to the room. The twin hook (gsd-artifact-graph-hook.cjs) resolves the room from the written file, so it is unchanged.

## Fix

isInsideRoom (and realOrResolve, which uses realpath of the nearest existing ancestor so a not-yet-created file works) runs before any room.db work. A path outside the room, a path equal to the room, and a path with ".." or a symlink that leaves the room all return with no reconcile. Exit 0 always, the finally block and the no-network rule are unchanged.

## Commits

- RCA commit docs(386-16) target PRESENT
- test(386-16) RED (M1 and M2 fail)
- fix(386-16) isInsideRoom check
- docs(386-16) RCA resolution

## Deviations from Plan

None.

## Verification

- tests/test-386-memory-artifact-hook-room-scope.cjs: RED (M1, M2), then GREEN (M1 to M5 ok).
- tests/test-150-memory-nodes.cjs and tests/test-261029-qef-hook-timeouts.cjs exit 0.
- `bash tests/run-all-386.sh`: PASS=12 FAIL=0 at the end of this plan.
- UNVERIFIED: `bash tests/run-all-150.sh` was started by mistake (not a suite this plan names) and was not read to the end.

## Known Stubs

None.

## Self-Check: PASSED
