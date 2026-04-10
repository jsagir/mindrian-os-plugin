# Feature Landscape: v2.0 SQLite + MCP Server + MCP Apps

**Domain:** Plugin/MCP co-development platform with embedded graph
**Researched:** 2026-04-09

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| All 27 lazygraph-ops functions work with SQLite | Users have existing rooms with graph data | High | 1,016 lines of Cypher -> SQL translation |
| Migration from .lazygraph/ to room.db | Users have existing KuzuDB data | Medium | Read-only KuzuDB import, write to SQLite |
| MCP server exposes 23 tools | PROJECT.md commits to 23 tools across 3 tiers | High | Each tool = thin wrapper around lib/core/ |
| WAL concurrent access works | Plugin + MCP server must not corrupt DB | Low | SQLite WAL is well-tested, busy_timeout handles contention |
| Larry Lite system prompt | MCP users need teaching methodology instinct | Low | 200-line prompt file, loaded as MCP server prompt |
| Graph query via natural language | Users ask Larry, Larry translates to SQL | Medium | No Cypher exposure; same pattern as current /mos:graph |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| MCP Apps De Stijl dashboard | Interactive dashboard IN the chat, not a separate URL | High | First MCP App that renders Mondrian grid + Cytoscape graph |
| Memory system (L0-L3) | Larry remembers across sessions, facts have temporal validity | Medium | New tables in room.db, new memory-ops.cjs |
| Assumption tracking | Claims have validity lifecycle (untested/supported/contradicted/stale) | Medium | Wicked problem management differentiator |
| Brain proxy in local MCP | One server config, all intelligence | Low | brain-client.cjs already exists, just wrap in MCP tool |
| Cross-host compatibility | Works in Claude, VS Code, ChatGPT, any MCP-compatible host | Low | stdio transport is universal |
| HSI via MCP tool | Innovation scoring available outside CLI | Low | child_process wrapper around existing Python script |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full Cypher query language over SQLite | Massive translation complexity, KuzuDB compat trap | Translate only the ~10 Cypher patterns actually used in codebase |
| Real-time collaborative editing via MCP | MCP is request/response, not real-time | Cowork handles collaboration natively |
| MCP Apps with React/Vue/Svelte framework | Adds build complexity, framework lock-in | Vanilla HTML/CSS/JS + ext-apps SDK. Vite bundles it. |
| Database admin tools in MCP server | Users should never see the schema | Larry translates natural language; schema is implementation detail |
| Multiple DB files per room | Splits graph and memory into separate concerns | Single room.db with all tables. One file to backup, one to migrate. |
| HTTP transport for v2.0 | Adds auth, CORS, port management complexity | stdio-only for v2.0. Add HTTP when remote room access needed. |

## Feature Dependencies

```
better-sqlite3 installed
  --> lazygraph-ops.cjs rewritten (Phase 1)
    --> graph-ops.cjs updated (Phase 1)
      --> MCP server tools registered (Phase 4)
        --> MCP Apps registered (Phase 5)
    --> memory-ops.cjs created (Phase 2)
    --> migration script (Phase 3)
  
vite + ext-apps installed
  --> dashboard MCP App built (Phase 5)
  --> graph MCP App built (Phase 5)
  --> wiki MCP App built (Phase 5)
    --> ui:// resources registered in MCP server (Phase 5)
```

## MVP Recommendation

Prioritize:
1. SQLite migration of lazygraph-ops.cjs (everything depends on this)
2. MCP server with Tier 2 room tools (room_analyze, room_state, graph_query)
3. One MCP App (dashboard) as proof of concept
4. Brain proxy tools (Tier 1) -- low effort, high value

Defer:
- Memory system (L0-L3): valuable but not blocking MCP server launch
- Wiki MCP App: can launch with dashboard + graph first
- Assumption tracking: builds on memory system, defer together

## Sources

- PROJECT.md milestone definition (23 tools, 3 tiers) [HIGH confidence -- local]
- Existing lazygraph-ops.cjs API surface (27 exports) [HIGH confidence -- local]
- [MCP Apps Guide](https://modelcontextprotocol.io/extensions/apps/build) [HIGH confidence]
