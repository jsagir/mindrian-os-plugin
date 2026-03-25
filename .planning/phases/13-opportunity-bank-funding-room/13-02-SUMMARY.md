---
phase: 13-opportunity-bank-funding-room
plan: 02
subsystem: opportunity-bank
tags: [grant-discovery, grants-gov, simpler-grants, opportunity-scanner, confirm-first, mcp-tools, cli]

requires:
  - phase: 13-opportunity-bank-funding-room
    provides: "opportunity-ops.cjs with 6 base exports, opportunity-template.md, funding-lifecycle.md, test fixtures"
provides:
  - "Context-driven grant discovery engine (buildGrantQuery, scanOpportunities) calling Grants.gov and Simpler Grants APIs"
  - "Opportunity filing and rejection capture (fileOpportunity, rejectOpportunity)"
  - "CLI commands: mindrian-tools.cjs opportunity scan/list/file"
  - "MCP tools: scan-opportunities, list-opportunities, file-opportunity in data_room router"
  - "/mos:opportunities command with confirm-first UX documentation"
  - "opportunity-scanner agent for Larry's proactive discovery flow"
  - "analyze-room Section 5: Opportunity Bank intelligence (OPP-04)"
  - "grant-api-patterns.md reference for domain-to-category mapping and relevance scoring"
affects: [13-03, session-start-hook, analyze-room, brain-enrichment]

tech-stack:
  added: []
  patterns: ["Context-driven API queries from room state", "Promise.allSettled for dual-API resilience", "Multi-factor relevance scoring", "Confirm-first UX pattern for filing"]

key-files:
  created:
    - commands/opportunities.md
    - agents/opportunity-scanner.md
    - references/opportunities/grant-api-patterns.md
  modified:
    - lib/core/opportunity-ops.cjs
    - bin/mindrian-tools.cjs
    - lib/mcp/tool-router.cjs
    - scripts/analyze-room
    - tests/test-phase-13.sh

key-decisions:
  - "Relevance scoring uses multi-factor approach (domain match, geography, stage, deadline, amount) rather than single keyword match"
  - "Promise.allSettled for dual-API calls: one API failure does not block the other"
  - "MCP file-opportunity uses section parameter for JSON data (reuses existing schema)"
  - "analyze-room opportunity section checks 14-day staleness threshold for funding entries"

patterns-established:
  - "Context-driven discovery: room STATE.md + problem-definition generate search queries"
  - "Confirm-first pattern: Larry presents opportunities, user decides to file or reject"
  - "Rejection is data: rejectOpportunity captures reason in STATE.md for future query refinement"
  - "Dual-delivery: every operation available as both CLI command and MCP tool"

requirements-completed: [OPP-02, OPP-03, OPP-04]

duration: 5min
completed: 2026-03-25
---

# Phase 13 Plan 02: Context-Driven Grant Discovery + Dual Delivery Summary

**Context-driven grant scanner calling Grants.gov + Simpler Grants APIs from room intelligence, with confirm-first filing, rejection capture, CLI + MCP dual delivery, and analyze-room opportunity intelligence**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-24T23:58:00Z
- **Completed:** 2026-03-25T00:03:36Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Grant discovery engine reads room context (domain, geography, stage) and generates API queries -- not hardcoded searches
- Dual API scanning (Grants.gov + Simpler Grants) with Promise.allSettled resilience and 10-second timeouts
- Multi-factor relevance scoring (domain fit, geography, stage match, deadline, amount) produces 0.0-1.0 scores
- Confirm-first UX: Larry presents opportunities with reasoning, user decides to file or reject with reason capture
- Full dual delivery: CLI (mindrian-tools.cjs opportunity scan/list/file) and MCP (data_room tool extensions)
- analyze-room Section 5: Opportunity Bank intelligence with status counts, top relevance, upcoming deadlines, and funding pipeline summary
- Test suite expanded to 23 assertions, full suite green (6/6 scripts, 96 total assertions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Grant discovery engine + opportunity filing** - `ea5db27` (feat)
2. **Task 2: CLI command + MCP tools + opportunity-scanner agent** - `e4b5cc1` (feat)
3. **Task 3: analyze-room opportunity-bank intelligence (OPP-04)** - `a6bfd68` (feat)

## Files Created/Modified

- `lib/core/opportunity-ops.cjs` - Added buildGrantQuery, scanOpportunities, searchGrantsGov, searchSimplerGrants, fileOpportunity, rejectOpportunity (6 new exports)
- `references/opportunities/grant-api-patterns.md` - Domain-to-category mapping, API endpoint docs, relevance scoring approach
- `commands/opportunities.md` - /mos:opportunities command with scan, list, file subcommands and confirm-first UX
- `agents/opportunity-scanner.md` - Proactive discovery agent instructions for Larry
- `bin/mindrian-tools.cjs` - Added opportunity command group with scan/list/file routing
- `lib/mcp/tool-router.cjs` - Added scan-opportunities, list-opportunities, file-opportunity to DATA_ROOM_COMMANDS with handlers
- `scripts/analyze-room` - Section 5: Opportunity Bank intelligence (status counts, top relevance, deadlines, funding pipeline)
- `tests/test-phase-13.sh` - Expanded from 13 to 23 assertions covering Plan 02 features

## Decisions Made

- Multi-factor relevance scoring rather than single keyword match -- provides more nuanced opportunity ranking
- Promise.allSettled for dual-API calls: one API failure returns partial results instead of total failure
- MCP file-opportunity reuses the existing `section` parameter to pass JSON data (avoids adding new schema)
- analyze-room staleness threshold set to 14 days for funding entries (matches typical grant review cycles)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - grant APIs are public (no auth required). No external service configuration needed.

## Next Phase Readiness

- All opportunity operations working via CLI and MCP for Plan 03 integration
- analyze-room intelligence enriches session-start hook with opportunity context
- Rejection data captured for future Brain enrichment (query refinement from user feedback)
- Test fixtures and assertions ready for Plan 03 expansion

---
*Phase: 13-opportunity-bank-funding-room*
*Completed: 2026-03-25*
