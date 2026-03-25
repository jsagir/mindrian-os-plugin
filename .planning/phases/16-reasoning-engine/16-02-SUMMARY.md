---
phase: 16-reasoning-engine
plan: 02
subsystem: reasoning
tags: [cli-routing, mcp-tools, lazygraph, reasoning-engine, dual-delivery]

requires:
  - phase: 16-reasoning-engine
    provides: "reasoning-ops.cjs core module with 8 exported functions"
  - phase: 11-mcp-server
    provides: "tool-router.cjs hierarchical MCP tool registration pattern"
  - phase: 15-lazygraph
    provides: "lazygraph-ops.cjs schema, EDGE_TYPES array, initSchema()"
provides:
  - "6 CLI reasoning subcommands (get/generate/verify/run/list/frontmatter)"
  - "6 MCP data_room reasoning commands (reasoning-get/generate/verify/run/list/frontmatter)"
  - "REASONING_INFORMS edge type in LazyGraph schema (Section-to-Section)"
  - "CLI/MCP parity at 46/46 commands"
affects: [16-03-lazygraph-integration]

tech-stack:
  added: []
  patterns: [cli-mcp-dual-delivery-reasoning, section-to-section-graph-edges]

key-files:
  created: []
  modified:
    - bin/mindrian-tools.cjs
    - lib/mcp/tool-router.cjs
    - lib/core/lazygraph-ops.cjs

key-decisions:
  - "CLI reasoning frontmatter accepts both JSON (set/merge) and plain section name (get) -- same dual-parse pattern as invoke-persona"
  - "MCP reasoning commands use section parameter for all data passing -- consistent with existing data_room patterns"
  - "REASONING_INFORMS is Section-to-Section (not Artifact-to-Artifact) -- reasoning dependencies are between room sections"
  - "ALL_TOOL_COMMANDS uses 'reason' (matching commands/reason.md filename) not 'reasoning' for parity"

patterns-established:
  - "Section-to-Section edge type pattern: REASONING_INFORMS with provides property"
  - "Reasoning dual delivery: identical operations accessible from CLI and MCP"

requirements-completed: [REASON-02, REASON-04, REASON-05]

duration: 3min
completed: 2026-03-25
---

# Phase 16 Plan 02: CLI/MCP/LazyGraph Wiring Summary

**6 reasoning CLI subcommands, 6 MCP tool commands, and REASONING_INFORMS edge type wired across all three delivery surfaces with 46/46 parity**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T13:18:12Z
- **Completed:** 2026-03-25T13:21:31Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- CLI reasoning command group with 6 subcommands (get/generate/verify/run/list/frontmatter) routed to reasoning-ops.cjs
- MCP data_room tool extended with 6 reasoning commands for Desktop/Cowork access
- LazyGraph schema extended with REASONING_INFORMS edge type (Section-to-Section with provides property)
- Full test suite green: 9/9 tests pass including CLI integration (Test 9)
- CLI/MCP parity maintained at 46/46 commands

## Task Commits

Each task was committed atomically:

1. **Task 1: CLI routing and LazyGraph schema extension** - `9686b6c` (feat)
2. **Task 2: MCP tool router integration** - `cec7d2b` (feat)

## Files Created/Modified
- `bin/mindrian-tools.cjs` - Added reasoning command group with 6 subcommands + USAGE text
- `lib/mcp/tool-router.cjs` - Added 6 reasoning commands to DATA_ROOM_COMMANDS, case handlers, updated description
- `lib/core/lazygraph-ops.cjs` - Added REASONING_INFORMS to EDGE_TYPES, initSchema, graphStats

## Decisions Made
- CLI reasoning frontmatter accepts both JSON `{ action, section, field, value }` and plain section name -- follows invoke-persona dual-parse precedent
- REASONING_INFORMS is Section-to-Section (not Artifact-to-Artifact) because reasoning dependencies model how one room section's reasoning informs another's
- graphStats updated to handle Section-to-Section edge queries (new edge type pattern)
- ALL_TOOL_COMMANDS uses 'reason' (matching commands/reason.md) for parity check

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ALL_TOOL_COMMANDS parity mismatch**
- **Found during:** Task 2
- **Issue:** Initially added 'reasoning' to ALL_TOOL_COMMANDS but parity check expects 'reason' (matching commands/reason.md filename)
- **Fix:** Changed to 'reason' in ALL_TOOL_COMMANDS
- **Files modified:** lib/mcp/tool-router.cjs
- **Verification:** `node lib/parity/check-parity.cjs` passes (46/46)
- **Committed in:** cec7d2b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for parity correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All reasoning operations now accessible from CLI, Desktop, and Cowork
- REASONING_INFORMS edge type ready for Plan 03 LazyGraph integration (populating edges from reasoning frontmatter requires/provides/affects)
- Test 9 now passes -- CLI integration complete

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 16-reasoning-engine*
*Completed: 2026-03-25*
