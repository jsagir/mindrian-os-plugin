---
phase: 52-mcp-foundation
plan: 02
subsystem: mcp
tags: [mcp, tool-router, hierarchical-routing, pipeline-chaining, intelligence-cascade, zod]

# Dependency graph
requires:
  - phase: 52-mcp-foundation/01
    provides: intelligence-cascade.cjs shared module for write-tool cascade
provides:
  - 9 hierarchical MCP routers covering all 64 CLI commands
  - formatSuggestedNext helper for LLM-orchestrated pipeline chaining
  - Intelligence cascade wired into all MCP write-tool handlers
  - ALL_TOOL_COMMANDS parity array (62 entries = 64 - splash - funding)
affects: [52-mcp-foundation/03, 53-surface-detection, 54-token-hook, 60-mcp-apps]

# Tech tracking
tech-stack:
  added: []
  patterns: [hierarchical-router-9-groups, suggested-next-chaining, write-tool-cascade-pattern, fireCascade-helper]

key-files:
  created: []
  modified:
    - lib/mcp/tool-router.cjs
    - bin/mindrian-mcp-server.cjs

key-decisions:
  - "9 routers (not 8 or 10) - natural grouping: room_state/room_content/room_graph split from data_room, orchestration new, rest extended"
  - "ALL_TOOL_COMMANDS uses CLI names (62 entries) not router sub-command names for parity validation"
  - "fireCascade helper wraps runCascade with try/catch - cascade failures never break tool responses"
  - "Orchestration router at 20 commands accepted (prefix-grouped: act-*, rooms-*, scout-*)"

patterns-established:
  - "formatSuggestedNext(tool, args, rationale) appended to every tool response for pipeline chaining"
  - "fireCascade(roomDir, command, section, result) called after every write operation"
  - "Per-router Suggested Next defaults: methodology->analyze, analysis chains causal-*, intelligence grade->deep-grade"

requirements-completed: [MCP-01, MCP-02, MCP-05]

# Metrics
duration: 6min
completed: 2026-04-05
---

# Phase 52 Plan 02: Router Restructuring Summary

**9 hierarchical MCP routers covering all 64 CLI commands with Suggested Next pipeline chaining and intelligence cascade on write-tools**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-05T19:25:52Z
- **Completed:** 2026-04-05T19:31:51Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Restructured MCP routers from 6 (with data_room at 34 commands) to 9 routers with no group exceeding 15 (orchestration at 20 with prefix-grouped names, accepted exception)
- Registered all 15 orphan commands: act, act-chain, act-swarm, act-dry-run, rooms-*, scout-*, find-analogies, causal-*, speakers, dashboard, wiki, present, publish, snapshot
- Added formatSuggestedNext to every tool response enabling LLM-orchestrated pipeline chaining (MCP-05)
- Wired intelligence cascade (fireCascade) into 12 write-tool handlers for CLI/MCP surface parity

## Task Commits

Each task was committed atomically:

1. **Task 1: Restructure routers from 6 to 9 with full 64-command coverage** - `a715c2a` (feat)
2. **Task 2: Update MCP server entry point and validate parity** - `dcb5140` (chore)

## Files Created/Modified
- `lib/mcp/tool-router.cjs` - 9 hierarchical routers, formatSuggestedNext, fireCascade, ALL_TOOL_COMMANDS (849 lines)
- `bin/mindrian-mcp-server.cjs` - Updated comments for 9 tools/64 commands

## Decisions Made
- Used 9 routers (room_state 5, room_content 15, room_graph 13, methodology 14, analysis 13, intelligence 7, meeting 3, export 7, orchestration 20) - natural grouping from command semantics
- ALL_TOOL_COMMANDS uses CLI-facing names (62 entries) rather than router sub-command names, enabling direct parity validation against commands/*.md files
- fireCascade helper wraps intelligence-cascade.cjs with silent error handling - cascade failures must never break tool responses per existing cascade design
- Causal commands (causal-extract/trace/predict) have specific chaining: extract->trace->predict->analyze

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all routers dispatch to existing core modules. Orchestration router commands that need Brain routing (act*, suggest-next) will be enhanced in Plan 03 but currently serve reference files.

## Next Phase Readiness
- All 64 commands now reachable via MCP - ready for Plan 03 (brain-router.cjs)
- Suggested Next enables pipeline chaining that brain-router will enhance with dynamic recommendations
- Intelligence cascade wired in - Desktop/Cowork write operations now trigger the same intelligence pipeline as CLI hooks

## Self-Check: PASSED

---
*Phase: 52-mcp-foundation*
*Completed: 2026-04-05*
