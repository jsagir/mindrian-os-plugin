---
phase: 39-model-profiles-routing
plan: 01
subsystem: core
tags: [model-routing, profiles, cascade, venture-stage, agent-dispatch]

requires: []
provides:
  - "MODEL_PROFILES table (8 agents x 3 tiers) for per-agent model dispatch"
  - "STAGE_HINTS table (5 venture stages) for adaptive model selection"
  - "CASCADE_MODELS table (5 steps) for pipeline step routing"
  - "resolveModel() 5-step cascade function"
  - "loadRoomConfig() with graceful defaults"
  - "formatProfileTable() for human-readable display"
  - "validate-model-profiles smoke test script (13 tests)"
affects: [39-02, 39-03, model-routing, cascade-pipeline, mos-models-command]

tech-stack:
  added: []
  patterns: [5-step-model-resolution-cascade, room-config-with-global-fallback, stage-hint-null-skip]

key-files:
  created:
    - lib/core/model-profiles.cjs
    - scripts/validate-model-profiles
  modified: []

key-decisions:
  - "Quality as default profile per D-01 - highest fidelity out of the box"
  - "null in STAGE_HINTS returns 'skip' - agent should not run at that venture stage"
  - "5-step cascade: override > stage-hint > inherit > profile > default"
  - "Room .config.json with ~/.mindrian/defaults.json global fallback"

patterns-established:
  - "Model resolution cascade: per-agent override > venture-stage hint > inherit > profile lookup > sonnet default"
  - "Stage-hint null = skip pattern for venture-stage gating of agents"
  - "Room config loading: room-level > global > hardcoded defaults"

requirements-completed: [MODEL-01, MODEL-02, MODEL-04, MODEL-05, MODEL-06]

duration: 2min
completed: 2026-03-31
---

# Phase 39 Plan 01: Model Profiles & Routing Summary

**8-agent model routing with 5-step resolution cascade, venture-stage hints, and cascade pipeline step assignments**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-31T22:35:14Z
- **Completed:** 2026-03-31T22:37:32Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- MODEL_PROFILES table mapping 8 agents across 3 tiers (quality/balanced/budget)
- 5-step resolveModel cascade: override > stage-hint > inherit > profile > default
- STAGE_HINTS with null=skip for venture-stage agent gating
- CASCADE_MODELS for 5 pipeline steps with null for pure-computation steps
- 13-test validation script passing all checks

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/core/model-profiles.cjs** - `40dd7a4` (feat)
2. **Task 2: Create validation script** - `889d05e` (test)

## Files Created/Modified
- `lib/core/model-profiles.cjs` - Core module with MODEL_PROFILES, STAGE_HINTS, CASCADE_MODELS tables, resolveModel(), loadRoomConfig(), formatProfileTable(), CLI interface
- `scripts/validate-model-profiles` - 13 smoke tests validating all model resolution paths

## Decisions Made
- Quality as default profile (D-01 compliance) - highest fidelity out of the box
- null in STAGE_HINTS returns 'skip' to prevent agents from running at wrong venture stages
- 5-step resolution cascade ensures predictable override behavior
- Room .config.json with ~/.mindrian/defaults.json global fallback for config hierarchy

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- model-profiles.cjs ready for import by /mos:models command (Plan 02)
- resolveModel() ready for integration into agent dispatch (Plan 03)
- CASCADE_MODELS ready for cascade pipeline routing

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 39-model-profiles-routing*
*Completed: 2026-03-31*
