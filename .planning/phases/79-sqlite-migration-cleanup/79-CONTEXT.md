# Phase 79: SQLite Migration + Cleanup - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase -- discuss skipped)

<domain>
## Phase Boundary

Update all 24+ files that reference KuzuDB/lazygraph patterns to use the new SQLite backend. Build migration tool for existing .lazygraph/ data. Add natural language graph queries (Larry translates to SQL). Remove kuzu npm dependency entirely.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion. Key constraints:

- Phase 77 rewrote lazygraph-ops.cjs to SQLite. Phase 78 added memory-ops.cjs. Both working, 91 tests pass.
- 7+ scripts still reference kuzu patterns: build-graph-from-kuzu.cjs, hsi-to-kuzu.cjs, causal-to-kuzu.cjs, whitespace-to-kuzu.cjs, build-ecosystem-graph.cjs, discovery-cycle.cjs, extract-room-intelligence.cjs
- bin/mindrian-tools.cjs graph subcommands need SQL instead of Cypher
- lib/mcp/tool-router.cjs room_graph router references kuzu
- lib/wiki/graph-links.cjs uses kuzu for wiki navigation
- NL graph queries: user asks in English, Larry/host LLM translates to SQL. Pre-built query templates for common patterns (contradictions, neighbors, paths, stats) + freeform SQL for power users.
- Migration tool: read existing .lazygraph/ KuzuDB data, write to room/.mindrian/room.db. OR just rebuild graph from room artifacts (simpler, more reliable since kuzu package may not install on all platforms).
- kuzu removal: delete from package.json dependencies, grep entire repo for remaining references
- Rename scripts: *-to-kuzu.cjs -> *-to-graph.cjs (or similar)

</decisions>

<code_context>
## Existing Code Insights

### Files to Update (from Phase 77 research -- 24+ files)
- scripts/build-graph-from-kuzu.cjs (396 lines) -- queries KuzuDB as primary graph source
- scripts/hsi-to-kuzu.cjs (171 lines) -- writes HSI edges to KuzuDB
- scripts/causal-to-kuzu.cjs (163 lines) -- writes CausalClaim nodes to KuzuDB
- scripts/whitespace-to-kuzu.cjs (235 lines) -- writes WhitespaceZone nodes to KuzuDB
- scripts/build-ecosystem-graph.cjs -- cross-project graph
- scripts/discovery-cycle.cjs -- discovery cycle linking
- scripts/extract-room-intelligence.cjs -- intelligence extraction
- bin/mindrian-tools.cjs (558 lines) -- graph subcommands
- lib/mcp/tool-router.cjs (927 lines) -- room_graph router
- lib/wiki/graph-links.cjs (271 lines) -- wiki navigation queries
- lib/core/intelligence-cascade.cjs (610 lines) -- Step 2 graph indexing
- Various presentation/export scripts that reference .lazygraph/

### Established Patterns
- lazygraph-ops.cjs now exports SQLite functions (Phase 77)
- memory-ops.cjs reuses same room.db via openGraph (Phase 78)
- All scripts use open-use-close pattern with try/finally

</code_context>

<specifics>
## Specific Ideas

Rebuild-from-artifacts is preferred over KuzuDB data migration (simpler, platform-independent, no kuzu dependency needed for migration).

</specifics>

<deferred>
## Deferred Ideas

None -- this phase completes the SQLite migration.

</deferred>
