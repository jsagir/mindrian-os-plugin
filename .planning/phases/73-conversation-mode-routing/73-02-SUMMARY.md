---
phase: 73-conversation-mode-routing
plan: 02
subsystem: api
tags: [brain-client, persona-chains, framework-routing, tier0-fallback, neo4j, feeds-into]

# Dependency graph
requires:
  - phase: 72-opportunity-graph-integration
    provides: brain-client.cjs with suggestValidationSteps and FEEDS_INTO pattern
provides:
  - getFrameworkChain(persona) export in brain-client.cjs
  - Tier 0 persona-chains.md reference with TTO/Researcher/Business chains
affects: [73-conversation-mode-routing, 74-conversation-capture]

# Tech tracking
tech-stack:
  added: []
  patterns: [brain-then-tier0-fallback, persona-to-entry-framework-mapping]

key-files:
  created: [references/personality/persona-chains.md]
  modified: [lib/core/brain-client.cjs]

key-decisions:
  - "Inline Tier 0 chains in getTier0Chain() rather than parsing persona-chains.md at runtime - simpler, no file I/O in hot path"
  - "Unknown persona defaults to researcher chain (problem-first is the safest generic path)"

patterns-established:
  - "Persona entry mapping: each persona maps to a specific entry framework name for Brain FEEDS_INTO queries"
  - "Chain result shape: {persona, chain: [{framework, description, order}], source: 'brain'|'tier0'}"

requirements-completed: [CONV-02, CONV-03]

# Metrics
duration: 3min
completed: 2026-04-09
---

# Phase 73 Plan 02: Brain Framework Chain Selection Summary

**getFrameworkChain(persona) with Brain FEEDS_INTO queries and Tier 0 hardcoded fallback for TTO/Researcher/Business personas**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-09T20:10:33Z
- **Completed:** 2026-04-09T20:13:10Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created Tier 0 persona-chains.md with 3 personas, each with entry signals, JTBD, 4-step chains, and Larry question sequences
- Added getFrameworkChain(persona) to brain-client.cjs with Brain FEEDS_INTO query path and Tier 0 fallback
- All three personas return correct 4-step chains; unknown persona safely defaults to researcher

## Task Commits

Each task was committed atomically:

1. **Task 1: Create persona-chains.md Tier 0 reference** - `1eeedf5` (feat)
2. **Task 2: Add getFrameworkChain to brain-client.cjs** - `e7fa7ea` (feat)

## Files Created/Modified
- `references/personality/persona-chains.md` - Tier 0 hardcoded framework chains for TTO, Researcher, Business personas
- `lib/core/brain-client.cjs` - Added getFrameworkChain() and getTier0Chain() functions, updated exports

## Decisions Made
- Inline Tier 0 chains in getTier0Chain() rather than parsing persona-chains.md at runtime - keeps hot path simple with zero file I/O
- Unknown persona defaults to researcher chain - problem-first is the safest generic exploration path

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- getFrameworkChain is ready for Mode 2 skill to call during conversation routing
- Chain result shape ({persona, chain, source}) provides everything Mode 2 needs to guide Larry's question sequence
- Phase 74 (Conversation Capture) can bank opportunities extracted during chain-guided conversations

---
*Phase: 73-conversation-mode-routing*
*Completed: 2026-04-09*
