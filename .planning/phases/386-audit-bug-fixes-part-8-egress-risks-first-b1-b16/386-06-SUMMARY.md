---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "06"
subsystem: room-registry-readers
tags: [rca, b3, registry, resolve-active-room, jtbd]
status: complete
requires: ["386-01"]
provides:
  - hmi-status-command, across-session-memory and memory-completion-detector resolve a room on the keyed registry shape and on the legacy array shape
affects: [386-07, 386-08]
key-files:
  created:
    - .planning/debug/registry-readers-legacy-shape-never-resolve.md
    - tests/test-386-registry-readers.cjs
  modified:
    - scripts/hmi-status-command.cjs
    - lib/hmi/across-session-memory.cjs
    - scripts/memory-completion-detector.cjs
requirements: [B3]
decisions:
  - "slug to directory goes through registryRoomPath in lib/core/resolve-active-room.cjs for all 3 readers"
metrics:
  tasks_done: 3
  tasks_total: 3
  completed: 2026-11-06
---

# Phase 386 Plan 06: B3 registry readers Summary

Three readers kept private copies of the legacy registry shape (an `active_room` slug and a `rooms` array). scripts/room-registry writes an `active` slug and a `rooms` object keyed by slug. On that shape hmi-status-command returned null, across-session-memory returned null and ignored the opt-out marker of a nested room, and memory-completion-detector fell back to the folder basename. All 3 now route through lib/core/resolve-active-room.cjs.

## Skip rule

All 3 targets were PRESENT (Phase 385 did not remove or narrow them). No skip.

## Commits

- cf6f0d2d7 docs(386-06): RCA with reader table
- 73997c440 test(386-06): RED, R1 R2 R3 fail on the keyed shape, R4 passes
- 33af7ee46 fix(386-06): GREEN, 3 readers use the canonical resolver

## Verification (PROVEN)

- `node tests/test-386-registry-readers.cjs`: 7 of 7 ok (RED showed 4 FAIL, 3 ok).
- `node tests/test-resolve-active-room-canonical.cjs`: 12/12 green.
- `node tests/test-across-session-memory.cjs`: 36/36 passed.
- `bash tests/run-all-386.sh`: PASS=4 FAIL=0 (includes peer 386 test files present at run time).
- Also green: tests/test-hmi-status-command.cjs, tests/test-memory-hook-integration.cjs, tests/test-jtbd-taxonomy.cjs.

## What turns on

logGraphTransition (promote, park, complete) now finds the room directory and writes a `jtbd_transitioned` memory event to the local room graph. The room opt-out marker is honored for a nested room. /mos:hmi-status finds the active room. All local, no Brain call.

## Deviations from Plan

### Auto-fixed Issues

None. Notes:

- **Behavior note (not a defect):** `resolveRoomDirForSlug` and `isRoomOptOut` now use registryRoomPath, which falls back to `<home>/<slug>` for a slug the registry does not know when that directory exists (the documented leg-2 contract of the canonical module). The old code returned null for an unknown slug.
- **Enumeration note:** memory-completion-detector must list registry slugs to test each directory, and the canonical module exports no list function. The file enumerates slug keys of both shapes and leaves path derivation to registryRoomPath. Adding a list export to the canonical module is a possible later cleanup.
- **R4 fixture:** the legacy fixture entry carries both `abs_path` and `path`. The old across-session isRoomOptOut read only `path`, so a legacy entry with `abs_path` alone is also fixed by this change, but the test does not pin that case.

## Pre-existing reds (not caused by this plan)

- tests/test-hmi-compliance-e2e.cjs: test 11 "expected 4 Stop entries, got 8" (hooks.json count). The test reads hooks/hooks.json, which this plan did not touch (ASSUMED pre-existing; no baseline run before the edit).

## Follow-up recorded in the RCA

- scripts/memory-resume-nudge.cjs `backfillFromWithinSession` walks the `rooms` array only (legacy-only reader, not in this plan files_modified).
- scripts/operator-update.cjs stays with plans 386-07 and 386-08.

## Known Stubs

None.

## Self-Check: PASSED
