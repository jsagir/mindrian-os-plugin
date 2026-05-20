# mcp-server-brain -- Claude Code project notes

> Audience: anyone editing the Brain MCP server (`server.cjs` +
> `lib/neo4j-tools.cjs` + `lib/pinecone-tools.cjs` + `lib/brain-ask.cjs`).
> Deployment: brain.mindrian.ai (remote, Streamable HTTP, API-key gated).

This directory is the remote Brain MCP server. It is NOT shipped to users; it
is served. Canon Part 8 governs it absolutely: the Brain holds generic
methodology only, never a specific user's artifacts, rejections, meetings, or
decisions. Any code path that writes user-specific bytes to this server, or
queries it with a payload containing user-specific strings, is a canonical
breach -- see `docs/MINDRIAN-CANON.md` Part 8 and the brain-boundary PR gate.

---

## Deferred Tool Loading (Phase 95.6 D-11b)

Anthropic shipped Deferred Tool Loading in 2026: an MCP server's tool NAMES
load at startup, but each tool's full SCHEMA loads on demand via ToolSearch
rather than at the start of every session. For plugins / servers with 50+ MCP
tools this cuts the per-session context overhead by roughly an order of
magnitude.

**Current Brain MCP startup tool surface: 6 tools.**

| Tool | Source | Purpose |
|------|--------|---------|
| `brain_schema` | `lib/neo4j-tools.cjs` | Neo4j node/relationship taxonomy |
| `brain_query` | `lib/neo4j-tools.cjs` | Read-only Cypher against the teaching graph |
| `brain_write` | `lib/neo4j-tools.cjs` | Plan-gated write (Canon Part 8 scoped) |
| `brain_search` | `lib/pinecone-tools.cjs` | Pinecone semantic search (12,401 vectors, 6 namespaces) -- retiring to Neo4j HNSW in Phase 127.1 |
| `brain_stats` | `lib/pinecone-tools.cjs` | Index statistics |
| `brain_ask` | `lib/brain-ask.cjs` | Natural-language methodology Q&A wrapper |

Phase 127.1 migrates the 12,401-vector Pinecone corpus to a new 1024-dim Neo4j HNSW index; the pre-existing 384-dim Neo4j entity-embedding layer is a separate orthogonal layer that Phase 127.1 does not touch.

Six is well under the deferred-loading inflection point, so the current
surface is fine to declare at startup. But the rule below applies as the
server grows.

### RULE

When adding new Brain MCP tools:

1. Prefer the schema-on-demand pattern over schema-at-startup. New capability
   should be reachable via ToolSearch + an on-demand schema fetch rather than
   declared in the startup tool list.
2. Keep the Brain MCP at no more than ~10-15 tools declared at startup.
   Beyond that, the startup tool surface starts costing meaningful context
   budget on every session that loads the server.
3. Tool growth that genuinely needs many surfaces should ship as a deferred
   tool family, not as 30 individually-declared startup tools.

### Release-time check

`mcp-server-brain` should not declare more than ~10-15 tools at startup. Count
the `server.tool(...)` registrations across `lib/neo4j-tools.cjs`,
`lib/pinecone-tools.cjs`, and `lib/brain-ask.cjs` (plus any new modules) at
release time:

```bash
grep -c "server.tool(" mcp-server-brain/lib/*.cjs | awk -F: '{s+=$2} END {print s}'
```

If that count exceeds 15, the new tools beyond the cap must be designed for
deferred loading before the release ships.

---

## Cross-references

- `docs/MINDRIAN-CANON.md` Part 8 -- the graph boundary (security constitution)
- `docs/CANON-PHASE-MAP.md` Part 8 row -- shipped Brain boundary defenses
- `.planning/phases/95.6-install-cache-windows-hardening-and-skill-loop-resilience/95.6-PACKAGING-RESEARCH.md` Sections 2 + 5 -- the architecture + the Deferred Tool Loading reference
- `docs/install/BRAIN-SETUP.md` -- how users configure the Brain MCP (canonical server name)
