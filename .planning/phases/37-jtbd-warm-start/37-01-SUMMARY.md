---
phase: 37-jtbd-warm-start
plan: 01
subsystem: ui
tags: [jtbd, session-start, nudges, greeting, analytics, bash, python3]

requires:
  - phase: 21-cli-ui-ruling-system
    provides: UI enforcement rules and symbol vocabulary
  - phase: 27-filing-pipeline-kuzudb-engine
    provides: Room state computation and analytics tracking
provides:
  - JTBD-framed session nudges replacing static command menu
  - Dynamic command menu prioritized by stage relevance and usage
  - build-jtbd-nudges helper script for room-aware nudge generation
affects: [session-start, larry-personality, warm-start]

tech-stack:
  added: []
  patterns: [JTBD nudge pattern "You have [state]. [action] [outcome]", dynamic menu generation from analytics]

key-files:
  created: [scripts/build-jtbd-nudges]
  modified: [scripts/session-start]

key-decisions:
  - "Nudge selection uses priority ordering (empty room > stage-specific > meetings > grade > presentation > convergence > competitive > no-meetings)"
  - "Dynamic menu scores candidates by stage relevance (50pts) + unused bonus (30pts) + anchor status (1000pts)"
  - "Cold start branch left untouched - JTBD only applies to warm start with active room"

patterns-established:
  - "JTBD nudge pattern: 'You have [concrete state]. [Natural language action] [outcome that matters].'"
  - "Dynamic menu: anchors (/mos:help, /mos:status) always shown, 4 additional by score"

requirements-completed: [JTBD-01, JTBD-02, JTBD-03]

duration: 4min
completed: 2026-03-31
---

# Phase 37 Plan 01: JTBD Warm Start Summary

**JTBD-framed session nudges replacing static command menu with room-state-aware personalized suggestions and stage-prioritized dynamic commands**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-31T22:01:48Z
- **Completed:** 2026-03-31T22:05:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created build-jtbd-nudges script that reads room state (sections, entries, stage, meetings, convergence) and analytics to output 2-3 calibrated nudges
- Every nudge follows "You have [state]. [action] [outcome]" pattern -- never describes features
- Dynamic 6-command menu prioritizes stage-relevant unused commands over frequently-used ones
- Wired JTBD output into session-start warm branch with 5 mandatory greeting rules for Larry

## Task Commits

Each task was committed atomically:

1. **Task 1: Create build-jtbd-nudges script** - `c720e30` (feat)
2. **Task 2: Wire JTBD nudges into session-start warm branch** - `0e7e01a` (feat)

## Files Created/Modified
- `scripts/build-jtbd-nudges` - Bash+Python3 script generating JTBD nudges and dynamic command menu from room state + analytics
- `scripts/session-start` - Warm branch updated to call build-jtbd-nudges and inject JTBD Greeting Rules

## Decisions Made
- Nudge priority order: empty room first, then stage-specific gaps, then meetings, then grade, then presentation, then convergence, then competitive analysis, then no-meetings
- Menu scoring: anchors (help/status) always included (1000pts), stage relevance (+50), never-used (+30), rarely-used (+15)
- Cold start branch intentionally untouched -- JTBD applies only when room exists

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed dead Python code block**
- **Found during:** Task 1
- **Issue:** Orphan python3 heredoc block with unused room_dir assignment before the main python block
- **Fix:** Removed the dead code block
- **Files modified:** scripts/build-jtbd-nudges
- **Committed in:** c720e30 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Cleanup only, no scope change.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- JTBD warm start is active for all rooms
- Analytics tracking already existed (track-analytics) -- nudge script reads it
- Ready for future enhancements: learning from dismissed nudges, tracking nudge effectiveness

---
*Phase: 37-jtbd-warm-start*
*Completed: 2026-03-31*
