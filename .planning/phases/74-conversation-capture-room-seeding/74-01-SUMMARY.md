---
phase: 74-conversation-capture-room-seeding
plan: 01
subsystem: conversation
tags: [scratchpad, opportunity-banking, cli, persistence, conversation-mode]

requires:
  - phase: 71-opportunity-extraction-engine
    provides: opportunityHash dedup function, bankOpportunity room-level banking
  - phase: 73-conversation-first-routing
    provides: conversation-mode skill with persona detection and framework chains
provides:
  - scratchpad-ops.cjs module for pre-room opportunity and highlight persistence
  - bank-opportunity CLI subcommand for room or scratchpad banking
  - conversation-mode skill instructions for when/how Larry banks opportunities
affects: [74-02, 75-onboarding-redesign]

tech-stack:
  added: []
  patterns: [atomic-file-write, lazy-require-for-circular-deps, djb2-hash-dedup]

key-files:
  created: [lib/core/scratchpad-ops.cjs]
  modified: [bin/mindrian-tools.cjs, skills/conversation-mode/SKILL.md]

key-decisions:
  - "Atomic writes (write .tmp then rename) for scratchpad crash safety"
  - "Lazy require of opportunity-ops.cjs in migrateToRoom to avoid circular deps"
  - "bank-opportunity auto-detects JSON vs roomDir+JSON argument pattern"

patterns-established:
  - "Scratchpad pattern: ~/.mindrian/scratchpad.json as cross-session pre-room persistence"
  - "Dual-target banking: same CLI command banks to room or scratchpad based on room existence"

requirements-completed: [CONV-04, CONV-06]

duration: 4min
completed: 2026-04-09
---

# Phase 74 Plan 01: Conversation Capture + Room Seeding Summary

**Pre-room scratchpad persistence at ~/.mindrian/scratchpad.json with bank-opportunity CLI that banks to room or scratchpad, plus Larry banking instructions in conversation-mode skill**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-09T20:23:40Z
- **Completed:** 2026-04-09T20:27:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- scratchpad-ops.cjs with full CRUD (read, write, getScratchpadOpportunities, updateScratchpadMeta, migrateToRoom, clearScratchpad)
- bank-opportunity CLI subcommand that auto-routes to room (via bankOpportunity) or scratchpad (via writeScratchpadEntry)
- Conversation-mode skill updated with banking thresholds, confidence mapping, and scratchpad persistence instructions

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scratchpad-ops.cjs and add bank-opportunity subcommand** - `4d37883` (feat)
2. **Task 2: Update conversation-mode skill with banking and scratchpad instructions** - `f2b3a65` (feat)

## Files Created/Modified
- `lib/core/scratchpad-ops.cjs` - Pre-room scratchpad CRUD with atomic writes and dedup
- `bin/mindrian-tools.cjs` - Added scratchpadOps require and bank-opportunity case
- `skills/conversation-mode/SKILL.md` - Added Opportunity Banking and Scratchpad Persistence sections

## Decisions Made
- Atomic writes (write .tmp then rename) prevent corrupted scratchpad on crash
- Lazy require of opportunity-ops.cjs only in migrateToRoom avoids circular dependency at module load
- bank-opportunity detects whether first arg is JSON or roomDir by checking for second arg

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- bank-opportunity CLI ready for Larry to call during Mode 2 conversations
- Scratchpad persists across sessions at ~/.mindrian/scratchpad.json
- migrateToRoom() ready for 74-02 (room seeding from banked opportunities)
- conversation-mode skill has complete banking instructions for Larry

---
*Phase: 74-conversation-capture-room-seeding*
*Completed: 2026-04-09*
