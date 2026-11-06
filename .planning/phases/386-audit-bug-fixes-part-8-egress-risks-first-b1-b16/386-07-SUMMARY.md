---
phase: 386-audit-bug-fixes-part-8-egress-risks-first-b1-b16
plan: "07"
subsystem: hooks
tags: [rca, operator-update, registry-shape, dormant-feature, owner-decision]
requires:
  - phase: 386-01
    provides: RCA conventions for this phase
provides:
  - RCA proving the silent exit of scripts/operator-update.cjs on the keyed registry shape
  - Owner decision block with the anchored line decision: unwire
affects: [386-08, 385-08, 385-12]
tech-stack:
  added: []
  patterns: [trace copy plus canonical-resolver scratch copy for read-only hook reproduction]
key-files:
  created:
    - .planning/debug/operator-update-registry-read-dormant-feature.md
  modified: []
key-decisions:
  - "Owner decision 2026-11-06: unwire. The operator state feature stays off. Plan 386-08 is a recorded skip."
requirements-completed: [B3]
duration: 40min
completed: 2026-11-06
---

# Phase 386 Plan 07: operator-update registry read Summary

The RCA proves that scripts/operator-update.cjs exits at its no-room branch for all 4 hook events on a real registry, and the owner decided `decision: unwire`, so plan 386-08 is skipped.

## Accomplishments

- Reproduced on a temporary registry made by scripts/room-registry (keyed shape) and a fixture room. A trace copy printed the exit branch: no-room silent success for SessionStart, Stop, PostToolUse and UserPromptSubmit.
- On a legacy-shape registry the script reached the event switch and wrote `conversation-operator.json`.
- A scratch copy with the canonical resolver showed what a repair turns on: operator state moves, and room.db gets 3 nodes and 1 OPERATOR_TRANSITION edge on a plain prompt. A transitioning firing loads 169 repo modules; the shipped copy loads 2. No timing was measured.
- Listed the consumers that change if the state moves: the JUST_TALK silence rule in scripts/intent-classifier.cjs, the packet operator field, the status line.
- Root cause: a private legacy-shape copy of the registry read that Phase 127.3 did not replace in this file. The same dead reader serves the SessionStart BUILD_ROOM resume hint.
- Recorded the owner decision and the Phase 385 hand-off (385-08 Stop leg, 385-12 item R2 for the other two entries).

## Task Commits

1. Task 1 (RCA): 7f92d560f
2. Task 2 (owner decision block): see the commit that follows this summary in git log of the RCA file

## Files Created/Modified

- .planning/debug/operator-update-registry-read-dormant-feature.md (created)

## Decisions Made

- unwire. The feature and the SessionStart resume hint stay off. A later plan may repair the read with a keyed-shape test.

## Deviations from Plan

None. The plan executed as written. No product file was edited.

## Issues Encountered

None.

## Known Stubs

None.

## Next Phase Readiness

Plan 386-08 ends as a skip. Plan 385-12 R2 needs the owner ruling for the PostToolUse and UserPromptSubmit entries.
