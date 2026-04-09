# Phase 77: SQLite Foundation - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase -- discuss skipped)

<domain>
## Phase Boundary

Replace KuzuDB embedded graph database (abandoned Oct 2025) with SQLite via better-sqlite3. Room graph stored at room/.mindrian/room.db with nodes + edges tables. All 27 lazygraph-ops.cjs exports must work identically with SQLite backend (same function signatures, same return shapes). WAL mode enabled for concurrent read access (plugin + MCP server simultaneously).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion -- infrastructure phase. Key constraints from research:

- Use better-sqlite3 (synchronous API simplifies codebase -- eliminates async open/use/close ceremony)
- Plain adjacency tables (nodes + edges with JSON properties) -- NOT per-type tables, NOT graph extensions
- Keep async function wrappers initially to avoid 100+ call-site breakage (await on sync return is harmless)
- SQLite schema: single `nodes` table + single `edges` table + `concepts` table
- WAL mode via `PRAGMA journal_mode=WAL` on database open
- Database path: room/.mindrian/room.db (replaces .lazygraph/ directory)
- Use INSERT ON CONFLICT DO UPDATE (NOT INSERT OR REPLACE) to preserve properties
- Only ~10 Cypher patterns to translate mechanically (MERGE -> INSERT ON CONFLICT, MATCH by id -> SELECT WHERE, MATCH edges -> JOIN, DETACH DELETE -> DELETE FROM edges + nodes)
- graph-ops.cjs write queue and lock pattern stays -- just internals change

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- lazygraph-ops.cjs (1,016 lines, 27 exports) -- THE replacement target
- graph-ops.cjs (164 lines) -- high-level wrapper, uses write queue
- write-lock.cjs -- Promise-chain serialization pattern (keep as-is)

### Established Patterns
- Open-use-close: `const { db, conn } = await openGraph(roomDir); ... await closeGraph(db);`
- Write serialization: `enqueueWrite(roomDir, fn)` with `acquireLock/releaseLock`
- Graceful degradation: all graph features check for `.lazygraph/` existence first (change to room.db existence)

### Integration Points
- intelligence-cascade.cjs step 2 calls graphOps.indexArtifact
- 7 scripts: build-graph-from-kuzu.cjs, hsi-to-kuzu.cjs, causal-to-kuzu.cjs, whitespace-to-kuzu.cjs, etc.
- bin/mindrian-tools.cjs graph subcommands
- lib/mcp/tool-router.cjs room_graph router
- lib/wiki/graph-links.cjs for wiki navigation

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- infrastructure phase. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

- Memory layer tables (Phase 78)
- Migration from existing .lazygraph/ data (Phase 79)
- Natural language graph queries (Phase 79)
- Removing kuzu npm dependency (Phase 79)

</deferred>
