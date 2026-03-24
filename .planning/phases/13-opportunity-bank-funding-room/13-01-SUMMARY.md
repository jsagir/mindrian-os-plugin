---
phase: 13-opportunity-bank-funding-room
plan: 01
subsystem: room-sections
tags: [opportunity-bank, funding, lifecycle, frontmatter, section-registry]

requires:
  - phase: 10-core-node-modules
    provides: "section-registry.cjs with dynamic discovery and pre-assigned opportunity-bank/funding metadata"
provides:
  - "opportunity-ops.cjs module with 6 exports (listOpportunities, listFunding, parseOpportunityFrontmatter, parseFundingStatus, getOpportunityBankState, getFundingState)"
  - "Opportunity artifact frontmatter schema (references/opportunities/opportunity-template.md)"
  - "4-stage funding lifecycle definitions (references/opportunities/funding-lifecycle.md)"
  - "Test fixtures: sample-room-opp with opportunity-bank and funding sections"
  - "Phase 13 test suite (13 assertions)"
affects: [13-02, 13-03, opportunity-commands, funding-commands, mcp-tool-router]

tech-stack:
  added: []
  patterns: ["YAML frontmatter parsing via regex/split (no yaml library)", "Per-opportunity folder lifecycle tracking with STATUS.md"]

key-files:
  created:
    - lib/core/opportunity-ops.cjs
    - references/opportunities/opportunity-template.md
    - references/opportunities/funding-lifecycle.md
    - tests/fixtures/sample-room-opp/STATE.md
    - tests/fixtures/sample-room-opp/problem-definition/current.md
    - tests/fixtures/sample-room-opp/opportunity-bank/STATE.md
    - tests/fixtures/sample-room-opp/opportunity-bank/2026-03-20-nsf-sbir.md
    - tests/fixtures/sample-room-opp/funding/STATE.md
    - tests/fixtures/sample-room-opp/funding/nsf-sbir-phase1/STATUS.md
    - tests/test-phase-13.sh
  modified: []

key-decisions:
  - "YAML frontmatter parsing uses regex/split (no yaml library) following existing codebase pattern"
  - "Funding lifecycle is flat per-opportunity folders (not sub-rooms by type) per CONTEXT.md discretion"
  - "Outcomes (awarded/rejected/withdrawn) are separate from stages per CONTEXT.md locked decision"
  - "run-all.sh auto-discovers test-phase-13.sh via glob pattern -- no manual registration needed"

patterns-established:
  - "Opportunity artifact frontmatter schema: methodology, funder, program, amount, deadline, relevance_score, room_connections, status"
  - "Funding STATUS.md schema: stage, outcome, source_opportunity (wikilink), transition_history"
  - "Per-opportunity lifecycle folders under room/funding/ with STATUS.md tracking"

requirements-completed: [OPP-01, FUND-01]

duration: 3min
completed: 2026-03-25
---

# Phase 13 Plan 01: Opportunity Bank + Funding Room Foundation Summary

**opportunity-ops.cjs module with frontmatter parsing, 4-stage funding lifecycle templates, and test fixtures for opportunity-bank and funding sections**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T23:52:21Z
- **Completed:** 2026-03-24T23:55:31Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- opportunity-ops.cjs exports 6 functions for opportunity-bank and funding operations
- Reference templates define frontmatter schema (opportunity-template.md) and 4-stage lifecycle (funding-lifecycle.md)
- Realistic test fixtures with a sample room containing populated opportunity-bank and funding sections
- Phase 13 test suite passes all 13 assertions; full suite green (6/6 test scripts)

## Task Commits

Each task was committed atomically:

1. **Task 1: Reference templates + test fixtures** - `f924871` (feat)
2. **Task 2: opportunity-ops.cjs core module** - `8541002` (feat)

## Files Created/Modified

- `lib/core/opportunity-ops.cjs` - Core module: listOpportunities, listFunding, parseOpportunityFrontmatter, parseFundingStatus, getOpportunityBankState, getFundingState
- `references/opportunities/opportunity-template.md` - Opportunity artifact frontmatter schema and filing instructions
- `references/opportunities/funding-lifecycle.md` - 4-stage lifecycle definitions (Discovered > Researched > Applying > Submitted) with STATUS.md schema
- `tests/fixtures/sample-room-opp/STATE.md` - Sample room state with venture context
- `tests/fixtures/sample-room-opp/problem-definition/current.md` - Sample problem statement for context-driven testing
- `tests/fixtures/sample-room-opp/opportunity-bank/STATE.md` - Section state with 1 filed opportunity
- `tests/fixtures/sample-room-opp/opportunity-bank/2026-03-20-nsf-sbir.md` - Sample opportunity artifact with full frontmatter
- `tests/fixtures/sample-room-opp/funding/STATE.md` - Pipeline summary with 1 entry in Researched stage
- `tests/fixtures/sample-room-opp/funding/nsf-sbir-phase1/STATUS.md` - Sample funding lifecycle entry with transition history
- `tests/test-phase-13.sh` - Phase 13 test suite (8 test groups, 13 assertions)

## Decisions Made

- YAML frontmatter parsing uses regex/split (no yaml library) following existing codebase pattern in room-ops.cjs
- Funding lifecycle uses flat per-opportunity folders (not sub-rooms by funding type) -- simplest structure, type tracked via frontmatter
- Outcomes (awarded/rejected/withdrawn) are separate attributes from stages per CONTEXT.md locked decision
- run-all.sh auto-discovers test-phase-13.sh via its glob pattern -- no manual registration step needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- opportunity-ops.cjs ready for Plan 02 (CLI commands + MCP tool registration)
- Frontmatter schema and lifecycle templates define the contracts Plan 02/03 build against
- Section discovery confirmed working for both opportunity-bank and funding
- Test fixtures available for integration testing in subsequent plans

---
*Phase: 13-opportunity-bank-funding-room*
*Completed: 2026-03-25*
