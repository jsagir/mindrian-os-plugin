# Phase 53: Surface Detection + Write Safety - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase, discuss skipped)

<domain>
## Phase Boundary

Auto-detect CLI/Desktop/Cowork at server startup, enable dual transport (stdio + Streamable HTTP), KuzuDB write gateway with promise-chain serialization, and capability-aware feature registration.

Requirements: SURF-01, SURF-02, SURF-03, SURF-04, WRITE-01, WRITE-02, WRITE-03

</domain>

<decisions>
## Implementation Decisions

### Surface Detection
- Create lib/mcp/surface-detect.cjs (~40 lines)
- Detection order: MINDRIAN_TRANSPORT env (explicit) -> CLAUDE_SURFACE env (Anthropic-set) -> COWORK_SESSION_ID or /sessions dir (Cowork VM) -> process.argv check (CLI) -> default (Desktop stdio)
- Returns { surface: 'cli'|'desktop'|'cowork', transport: 'stdio'|'http', capabilities: { hooks, apps, tasks, scripts } }
- Called once at server startup, not per-request

### Dual Transport
- mindrian-mcp-server.cjs reads surface detection result
- if transport === 'http': use StreamableHTTPServerTransport on 127.0.0.1:3847 with Express
- else: use StdioServerTransport (current default)
- Both use same McpServer instance -- register tools once

### KuzuDB Write Safety
- Add promise-chain write queue in graph-ops.cjs (~30 lines)
- let writeQueue = Promise.resolve(); enqueueWrite(fn) chains via .then()
- All write operations (indexArtifact, rebuildGraph) go through queue
- Read operations (queryGraph, graphStats) bypass queue -- KuzuDB allows concurrent reads
- File-based write lock: room/.graph/write.lock with PID + timestamp, 5s stale cleanup

### Setup Auto-Configuration
- /mos:setup detects surface and generates appropriate config
- Desktop: add to claude_desktop_config.json as stdio
- Cowork: configure via Settings > Integrations as Streamable HTTP URL
- Brain MCP: add separately (remote, already Streamable HTTP)

### Claude's Discretion
All implementation choices at Claude's discretion -- pure infrastructure phase.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- bin/mindrian-mcp-server.cjs -- current stdio-only server entry point
- lib/mcp/tool-router.cjs -- 9 routers (from Phase 52), all tools registered on single McpServer
- lib/core/graph-ops.cjs -- current KuzuDB operations, open-use-close pattern
- commands/setup.md -- existing /mos:setup command definition

### Integration Points
- bin/mindrian-mcp-server.cjs -- add transport selection based on surface detection
- lib/core/graph-ops.cjs -- add write queue to all write functions
- commands/setup.md -- add surface-aware configuration generation

### Canonical References
- .planning/research/STACK-cowork.md -- dual transport architecture pattern
- .planning/research/ARCHITECTURE-v18-integration.md -- surface detection flow diagram
- .planning/research/PITFALLS.md -- KuzuDB single-writer contention details

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- infrastructure phase. Refer to ROADMAP success criteria.

</specifics>

<deferred>
## Deferred Ideas

- Resource subscriptions with chokidar -- deferred until Claude clients implement push
- MCP Tasks registration -- Phase 58

</deferred>
