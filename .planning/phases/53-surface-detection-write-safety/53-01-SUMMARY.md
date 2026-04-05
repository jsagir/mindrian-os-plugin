---
phase: 53-surface-detection-write-safety
plan: 01
subsystem: infra
tags: [mcp, surface-detection, dual-transport, streamable-http, stdio, cowork, desktop, cli]

requires:
  - phase: 52-mcp-command-coverage
    provides: "9 hierarchical router tools covering 64 CLI commands"
provides:
  - "detectSurface() auto-detection of CLI/Desktop/Cowork at server startup"
  - "Dual transport: stdio (Desktop/CLI) + Streamable HTTP on 127.0.0.1:3847 (Cowork)"
  - "capability-registry.cjs hook point for surface-aware feature gating (Apps, Tasks, hooks, scripts)"
affects: [54-token-hook-optimization, 55-context-routing, 58-mcp-tasks, 60-mcp-apps]

tech-stack:
  added: [StreamableHTTPServerTransport, express (via MCP SDK bundled)]
  patterns: [surface-detection-at-startup, capability-gated-registration, graceful-transport-fallback]

key-files:
  created:
    - lib/mcp/surface-detect.cjs
    - lib/mcp/capability-registry.cjs
  modified:
    - bin/mindrian-mcp-server.cjs

key-decisions:
  - "Express imported via SDK bundle (require.resolve), not added as direct dependency"
  - "Graceful fallback to stdio if Express unavailable on HTTP path"
  - "MINDRIAN_TRANSPORT env override takes highest detection priority"

patterns-established:
  - "Surface detection at startup: call detectSurface() once, pass result down"
  - "Capability gating: registerCapabilities() conditionally enables features per surface"
  - "Transport branching: single McpServer instance serves either stdio or HTTP"

requirements-completed: [SURF-01, SURF-02, SURF-04]

duration: 2min
completed: 2026-04-05
---

# Phase 53 Plan 01: Surface Detection + Dual Transport Summary

**Auto-detection of CLI/Desktop/Cowork with 6-step priority chain, dual MCP transport (stdio + Streamable HTTP), and capability-gated feature registration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-05T20:09:37Z
- **Completed:** 2026-04-05T20:11:31Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- surface-detect.cjs with 6-step detection priority: MINDRIAN_TRANSPORT env, CLAUDE_SURFACE env, COWORK_SESSION_ID/sessions dir, non-TTY stdin check, TTY check, desktop default
- mindrian-mcp-server.cjs upgraded from stdio-only to dual transport with automatic surface-based selection
- capability-registry.cjs provides surface-aware feature gating with stub hooks for Phase 58 (Tasks) and Phase 60 (Apps)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create surface-detect.cjs and capability-registry.cjs** - `e2b1900` (feat)
2. **Task 2: Wire dual transport into mindrian-mcp-server.cjs** - `f9942f2` (feat)

## Files Created/Modified
- `lib/mcp/surface-detect.cjs` - 6-step surface detection returning { surface, transport, capabilities }
- `lib/mcp/capability-registry.cjs` - getCapabilities() and registerCapabilities() with Phase 58/60 hook points
- `bin/mindrian-mcp-server.cjs` - Dual transport entry point with automatic surface selection

## Decisions Made
- Express is imported via `require('express')` which resolves from MCP SDK's bundled dependency, not added as direct dependency (per CLAUDE.md "What NOT to Use" guidance)
- Graceful fallback: if Express cannot be loaded on HTTP path, falls back to stdio with warning
- MINDRIAN_TRANSPORT env var takes absolute priority in detection chain for testing/CI/override scenarios
- CAPABILITY_MAP exported from surface-detect.cjs and shared with capability-registry.cjs to avoid duplication

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all modules are fully functional for their scope. Phase 58/60 hook points in capability-registry.cjs are intentional commented placeholders documented in the code.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Surface detection is wired and verified for all three surfaces
- Phase 53-02 (KuzuDB write safety) can proceed independently
- Phase 54 (token/hook optimization) can consume surface.capabilities for conditional hook registration
- Phase 58 (MCP Tasks) and Phase 60 (MCP Apps) have registerCapabilities() hook point ready

---
*Phase: 53-surface-detection-write-safety*
*Completed: 2026-04-05*
