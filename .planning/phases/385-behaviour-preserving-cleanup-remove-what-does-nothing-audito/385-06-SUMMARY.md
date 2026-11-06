---
phase: 385
plan: 06
subsystem: dead-code
tags: [cleanup, dead-module, dead-script]
requirements-completed: [CLEAN385-01]
key-files:
  created: [tests/test-385-room-intelligence-removed.cjs]
  modified: [docs/BACKEND-MAP.md]
  deleted: [lib/core/room-type-detector.cjs, scripts/extract-room-intelligence.cjs]
completed: 2026-11-06
---

# Phase 385 Plan 06: Remove the dead pair extract-room-intelligence and room-type-detector Summary

The dead script (714 lines) and the detector module only it loaded (386 lines) are gone, with their two documentation rows. scripts/generate-snapshot.cjs defines its own `detectRoomType` and is untouched.

## Commit

- 67c3d61cf chore(385-06): remove dead pair extract-room-intelligence and room-type-detector (4 paths, 1,102 deletions).
- Revert note: `git revert 67c3d61cf` restores both files and both rows. No other file depends on them.

## Caller proof re-run (HEAD d05f2e3f8)

Same as the planner's result. The docs/BACKEND-MAP.md rows are at lines 71 and 213.
- Hits outside .planning and CHANGELOG: the 2 table rows, the detector own usage text (line 342), the script own usage text and header (lines 14, 24, 652). The only line that loads the detector is scripts/extract-room-intelligence.cjs:24.
- `detectRoomType`, `getRoomTypeConfig`, `extractRoomIntelligence` outside the pair: scripts/generate-snapshot.cjs lines 172 and 365 (its own local function) and one note under docs/research. Neither loads the module.
- No loader walks lib/core. The script has a usage text, so a person could run it by hand; the PRD authorises removal of a module with no caller.

## RED evidence

```
FAIL neither lib/core/room-type-detector.cjs nor scripts/extract-room-intelligence.cjs is tracked: still tracked: lib/core/room-type-detector.cjs, scripts/extract-room-intelligence.cjs
FAIL no tracked file outside .planning and CHANGELOG.md names room-type-detector or extract-room-intelligence: named in: docs/BACKEND-MAP.md, lib/core/room-type-detector.cjs, scripts/extract-room-intelligence.cjs
ok   scripts/generate-snapshot.cjs stays tracked and keeps its own function detectRoomType
exit 1
```

## Verify after the change

- New test: 3/3 ok.
- connector-registry, orchestration-projection, harness-manifest checks: OK.
- `git grep -c -E 'room-type-detector|extract-room-intelligence' -- docs/BACKEND-MAP.md`: 0 matches. HEAD holds exactly the 4 expected paths. Never-touch guard: 0.
- doctor: deferred to one run at the end of the remaining plans (long suites run once).

## Deviations

None.
