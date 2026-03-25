---
phase: 15-user-knowledge-graph
plan: 02
subsystem: cli-mcp-hooks
tags: [kuzudb, lazygraph, cypher, cli, mcp, hooks, dual-surface, post-write]

# Dependency graph
requires:
  - phase: 15-user-knowledge-graph
    provides: lazygraph-ops.cjs (7 exports for KuzuDB operations)
  - phase: 11-mcp-server
    provides: tool-router.cjs (hierarchical MCP tool registration)
provides:
  - CLI commands for graph index/rebuild/query/stats via mindrian-tools.cjs
  - Post-write hook auto-indexing for room .md artifacts
  - MCP tool registration for all 4 lazygraph commands under data_room
  - NL-to-Cypher query support via schema reference in MCP tool description
affects: [15-03, dashboard, brain-integration, parity-checking]

# Tech tracking
tech-stack:
  added: []
  patterns: [open-use-close-graph, background-hook-indexing, schema-in-tool-description, state-md-walkup-room-detection]

key-files:
  created: []
  modified: [lib/core/graph-ops.cjs, bin/mindrian-tools.cjs, scripts/post-write, lib/mcp/tool-router.cjs, tests/test-phase-15.sh]

key-decisions:
  - "Open-use-close pattern for all graph-ops wrappers (try/finally ensures closeGraph on error)"
  - "Post-write hook runs graph index in background with 2s timeout to avoid blocking hook budget"
  - "NL query via schema reference in MCP tool description (Larry generates Cypher from user's natural language)"
  - "STATE.md walk-up for room root detection (robust against paths containing 'room' as substring)"
  - "graph-query MCP command uses section parameter for Cypher string (consistent with existing parameter reuse pattern)"

patterns-established:
  - "open-use-close: All graph-ops wrappers open DB, operate, close in finally block"
  - "background hook indexing: post-write fires graph index as background process with timeout"
  - "schema-in-description: MCP tool descriptions include DB schema for LLM Cypher generation"

requirements-completed: [GRAPH-03, GRAPH-05]

# Metrics
duration: 14min
completed: 2026-03-25
---

# Phase 15 Plan 02: LazyGraph CLI, Hooks, and MCP Integration Summary

**Dual-surface graph commands (CLI + MCP) with post-write hook auto-indexing and NL query via Cypher schema reference**

## Performance

- **Duration:** 14 min
- **Started:** 2026-03-25T09:34:25Z
- **Completed:** 2026-03-25T09:48:12Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Extended graph-ops.cjs from 1 export (buildGraph) to 5 exports with open-use-close KuzuDB pattern
- CLI routes graph index/rebuild/query/stats through mindrian-tools.cjs (all async-await)
- Post-write hook auto-indexes room .md artifacts in background (2s timeout, non-blocking)
- MCP tool-router registers 4 new graph commands under data_room (49 total commands, up from 45)
- NL query supported via KuzuDB schema reference embedded in graph-query tool description
- Test suite expanded from 23 to 31 assertions, all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend graph-ops.cjs and CLI routing** - `236e8ad` (feat)
2. **Task 2: Wire post-write hook for automatic graph indexing** - `c7cc2cf` (feat)
3. **Task 3: Register lazygraph MCP tools and update parity** - `de5e522` (feat)

## Files Created/Modified
- `lib/core/graph-ops.cjs` - Extended with 4 new lazygraph wrapper functions (open-use-close pattern)
- `bin/mindrian-tools.cjs` - Added graph index/rebuild/query/stats CLI subcommands + USAGE string
- `scripts/post-write` - Added background LazyGraph indexing for room .md artifacts
- `lib/mcp/tool-router.cjs` - 4 new graph commands in DATA_ROOM_COMMANDS, ALL_TOOL_COMMANDS updated (49)
- `tests/test-phase-15.sh` - 8 new CLI integration + parity tests (31 total assertions)

## Decisions Made
- Open-use-close pattern with try/finally for all graph-ops wrappers prevents DB lock leaks
- Post-write hook uses STATE.md walk-up for room detection (not path substring matching)
- Background process + timeout 2s ensures hook never blocks the 3s hook budget
- NL query implemented by embedding KuzuDB schema in MCP tool description so Larry generates Cypher
- graph-query reuses the existing `section` parameter for Cypher string input (no new parameter needed)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All lazygraph operations now available via CLI and MCP (dual-surface complete)
- Hook-driven auto-updates active for room .md artifacts
- Ready for 15-03 (graph visualization / dashboard integration)
- GRAPH-03 (NL query) and GRAPH-05 (hook-driven updates) requirements satisfied

## Self-Check: PASSED

All files exist. All commits verified (236e8ad, c7cc2cf, de5e522).

---
*Phase: 15-user-knowledge-graph*
*Completed: 2026-03-25*
