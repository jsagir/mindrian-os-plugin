# Phase 52: MCP Foundation - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning
**Mode:** Auto-generated (--auto flag, recommended defaults selected)

<domain>
## Phase Boundary

All 64 plugin commands work as MCP tools on Desktop and Cowork with intelligence firing on every write operation and Brain-driven routing resilient to cold starts. This phase delivers the infrastructure that ALL subsequent phases depend on.

Requirements: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06

</domain>

<decisions>
## Implementation Decisions

### Router Structure
- Split data_room router (currently 34 commands) into 3 sub-routers: room_state (~5 cmds: status, analyze, compute-state, get-state, suggest-next), room_content (~15 cmds: opportunities, funding, personas, reasoning-*), room_graph (~7 cmds: graph-*, visualize-*)
- Add orchestration router for meta-commands: act, act-chain, act-swarm, act-dry-run, rooms-*, scout-*, reanalyze, onboard, models, admin (~20 sub-commands)
- Extend existing routers: find-analogies -> methodology, causal-* -> analysis, speakers -> meeting, dashboard/wiki/present/publish/snapshot -> export
- Target: 8-10 routers, each with 5-15 commands, total token budget ~6-7K
- splash and funding (already covered by data_room sub-commands) need NO new registration

### Intelligence Cascade
- Create lib/core/intelligence-cascade.cjs as shared module
- Called by BOTH PostToolUse hook (CLI) and MCP tool handlers (Desktop/Cowork)
- Signature: runCascade(roomDir, { trigger, filePath, section })
- Cascade steps: HSI computation -> cross-reference scan -> graph indexing -> proactive intelligence
- MCP tools that WRITE to room must call runCascade after the write operation
- Read-only MCP tools skip the cascade entirely

### Brain-Driven Routing
- Create lib/mcp/brain-router.cjs as new module
- 3-tier fallback: in-memory cache (10-min TTL, keyed by room_path + STATE.md hash) -> local heuristic (references/methodology/problem-types.md routing table) -> Brain MCP (native fetch to brain.mindrian.ai, 2-second timeout)
- Brain-router RECOMMENDS framework chains, does NOT execute them -- returns { chain, confidence, source, reasoning, target_sections }
- Called ONLY by orchestration router for act*, suggest-next commands -- NOT on every tool call
- When Brain is cold/unreachable, local fallback provides recommendation within 100ms

### Output Standardization
- Every MCP tool response ends with `## Suggested Next` section containing: tool_name (string), args (JSON), rationale (1 sentence)
- Pipeline chaining is LLM-orchestrated: Claude reads Suggested Next and decides whether to call the next tool
- Methodology/analysis tools suggest the next framework in the Brain-recommended chain
- Data room tools suggest relevant analysis after state changes

### SDK Upgrade
- Upgrade @modelcontextprotocol/sdk from ^1.27.1 to ^1.29.0
- Required for ext-apps peer dependency (Phase 60) and StreamableHTTPServerTransport (Phase 53)
- Do NOT upgrade to 2.0.0-alpha (breaking changes)

### Claude's Discretion
- Exact number of routers (8-10 range) based on what groups naturally
- Internal naming conventions for router tools
- Error message format for unknown commands
- Whether to use z.enum or z.string with validation for sub-commands (z.enum preferred for type safety)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- lib/mcp/tool-router.cjs -- existing 6 hierarchical routers, proven pattern, ~620 lines
- lib/core/*.cjs -- 9 shared modules (room-ops, state-ops, meeting-ops, graph-ops, opportunity-ops, persona-ops, reasoning-ops, visual-ops, integration-registry)
- lib/core/brain-client.cjs -- existing HTTP client to Brain MCP
- lib/mcp/larry-context.cjs -- Larry personality context for MCP tools
- lib/mcp/resources.cjs -- MCP resource registration
- lib/mcp/prompts.cjs -- MCP prompt registration
- bin/mindrian-mcp-server.cjs -- MCP server entry point, 78 lines

### Established Patterns
- Router registration: server.tool(name, description, zodSchema, handler)
- textResponse(text, isError) helper for all tool responses
- buildContext(pluginRoot, roomDir, command, userContext) for methodology tools
- loadReference(pluginRoot, command) for command reference files
- loadRoomState(roomDir) for STATE.md
- ALL_TOOL_COMMANDS flat array for parity checking

### Integration Points
- registerRouterTools() in bin/mindrian-mcp-server.cjs -- where new routers are added
- hooks/scripts/*.sh -- PostToolUse fires intelligence cascade, needs to share logic with MCP handlers
- commands/*.md -- 64 command definitions, some have metadata needed by routers

### Canonical References
- lib/mcp/tool-router.cjs -- current router implementation
- bin/mindrian-mcp-server.cjs -- server entry point
- lib/core/brain-client.cjs -- Brain MCP client
- .planning/research/ARCHITECTURE-v18-integration.md -- integration architecture from research
- .planning/research/PITFALLS.md -- critical pitfalls to avoid
- .planning/research/STACK-cowork.md -- SDK upgrade details
- references/research/RESEARCH_15_V1.8_OPTIMIZATION_JTBD.md -- optimization context
- references/research/RESEARCH_16_NATIVE_FIRST_PLUGIN_ARCHITECTURE.md -- native-first architecture

</code_context>

<specifics>
## Specific Ideas

- The 15 orphaned commands categorize into 4 groups per ARCHITECTURE research: Category A (7 new orchestration router), Category B (3 extend existing routers), Category C (5 extend export router), Category D (2 no registration needed)
- Hook intelligence cascade (PostToolUse) must become a shared module BEFORE any MCP tool writes -- this is the #1 priority within this phase per PITFALLS research
- Brain-router.cjs depends on brain-client.cjs (exists) and state-ops.cjs (exists) -- no new external dependencies

</specifics>

<deferred>
## Deferred Ideas

- Streamable HTTP transport -- Phase 53 (Surface Detection)
- MCP Apps registration -- Phase 60 (MCP Apps)
- MCP Tasks registration -- Phase 58 (Scheduled Intelligence)
- Resource subscription handlers -- deferred until Claude clients implement push

</deferred>
