---
phase: 13-opportunity-bank-funding-room
plan: 03
subsystem: funding-lifecycle
tags: [funding, lifecycle, stage-tracking, wikilinks, cross-reference, cli, mcp, state-computation]

requires:
  - phase: 13-opportunity-bank-funding-room
    provides: "opportunity-ops.cjs with 12 base exports, grant discovery, CLI+MCP opportunity commands, test fixtures"
provides:
  - "Funding lifecycle functions: createFunding, updateFundingStage, setFundingOutcome, computeFundingState, computeOpportunityBankState"
  - "CLI: mindrian-tools.cjs funding list/create/advance/status/outcome/compute-state"
  - "MCP tools: list-funding, create-funding, update-funding-stage in data_room router"
  - "/mos:funding command with 5 subcommands"
  - "compute-opportunity-state bash script for pipeline integration"
  - "32 test assertions covering full funding lifecycle"
affects: [session-start-hook, analyze-room, brain-enrichment, export]

tech-stack:
  added: []
  patterns: ["Sequential stage validation (no skip, no backward)", "Wikilink cross-references for graph edges", "Outcome as separate attribute from stage"]

key-files:
  created:
    - commands/funding.md
    - scripts/compute-opportunity-state
  modified:
    - lib/core/opportunity-ops.cjs
    - bin/mindrian-tools.cjs
    - lib/mcp/tool-router.cjs
    - tests/test-phase-13.sh

key-decisions:
  - "Stage transitions enforced sequentially with explicit next-stage validation (no skipping allowed)"
  - "Outcome (awarded/rejected/withdrawn) only settable at submitted stage except withdrawn (any stage)"
  - "MCP funding commands reuse section parameter for JSON payloads (consistent with file-opportunity pattern)"
  - "CLI advance auto-determines next stage from current entry state (user doesn't specify target)"

patterns-established:
  - "Per-opportunity lifecycle folders with STATUS.md + metadata.yaml"
  - "Wikilink cross-references: [[opportunity-bank/{source}]] for graph edge creation"
  - "State computation: scan subdirectories, aggregate into pipeline summary STATE.md"
  - "Staleness detection: 14-day threshold flags entries needing attention"

requirements-completed: [FUND-02, FUND-03, FUND-04]

duration: 4min
completed: 2026-03-25
---

# Phase 13 Plan 03: Funding Lifecycle Management Summary

**4-stage funding lifecycle (Discovered > Researched > Applying > Submitted) with sequential stage validation, wikilink cross-references to opportunity-bank, pipeline state aggregation, and CLI + MCP dual delivery**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T00:06:18Z
- **Completed:** 2026-03-25T00:09:50Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- createFunding generates per-opportunity folders with STATUS.md containing wikilink cross-references to source opportunities
- Stage validation enforces strict sequential transitions (discovered > researched > applying > submitted) with no skipping or backward movement
- Outcomes (awarded/rejected/withdrawn) tracked as separate attribute from stage per CONTEXT.md locked decision
- computeFundingState aggregates pipeline into STATE.md with deadline tracking and 14-day staleness detection
- Full dual delivery: CLI (funding list/create/advance/status/outcome/compute-state) and MCP (list-funding, create-funding, update-funding-stage)
- Test suite expanded to 32 assertions, full suite green (6/6 scripts, 105 total assertions)

## Task Commits

Each task was committed atomically:

1. **Task 1: Funding lifecycle operations + state computation** - `eb59231` (feat)
2. **Task 2: CLI command + MCP tools for funding** - `4d96fbb` (feat)

## Files Created/Modified

- `lib/core/opportunity-ops.cjs` - Added createFunding, updateFundingStage, setFundingOutcome, computeFundingState, computeOpportunityBankState (5 new exports + 2 constants)
- `commands/funding.md` - /mos:funding command with list, create, advance, status, outcome subcommands
- `scripts/compute-opportunity-state` - Bash wrapper calling funding compute-state for pipeline integration
- `bin/mindrian-tools.cjs` - Added funding command group with 6 subcommands
- `lib/mcp/tool-router.cjs` - Added list-funding, create-funding, update-funding-stage to DATA_ROOM_COMMANDS with handlers
- `tests/test-phase-13.sh` - Expanded from 23 to 32 assertions covering Plan 03 funding lifecycle

## Decisions Made

- Stage transitions enforced sequentially -- updateFundingStage validates currentIdx + 1 === newIdx
- Outcome 'awarded' and 'rejected' restricted to 'submitted' stage; 'withdrawn' allowed at any stage
- CLI advance auto-determines next stage (reads current, increments) rather than requiring user to specify target
- MCP funding commands use section parameter for JSON payloads, consistent with existing file-opportunity pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Complete Phase 13 (all 3 plans) -- opportunity discovery through funding lifecycle fully operational
- CLI and MCP deliver all funding operations for Desktop/CLI/Cowork surfaces
- State computation ready for session-start hook integration
- Cross-references via wikilinks ready for build-graph traversal
- Test coverage comprehensive for regression detection in future phases

---
*Phase: 13-opportunity-bank-funding-room*
*Completed: 2026-03-25*
