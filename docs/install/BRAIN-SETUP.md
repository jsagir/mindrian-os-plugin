# Brain Setup -- Canonical MCP Server Name

> Status: shipped in v1.11.2 (Plan 94-03)
> Audience: any user installing MindrianOS-Plugin who wants Brain-enriched
> /mos:* commands (Mode A / Mode B per Canon Part 3) instead of the
> graceful Tier 0 fallback.

---

## Section 1 -- Why the canonical name matters

Plugin commands resolve Brain MCP tool calls by frontmatter prefix. Every
command that needs Brain declares `mcp__mindrian-brain__<tool>` under
`allowed-tools:`. Claude Code resolves that prefix against the
`mcpServers` block in your personal `.mcp.json` (or
`claude_desktop_config.json` for Desktop / Cowork). If your config
declares the Brain server under a different name, Claude has nothing to
route the call to and silently falls through to the Tier 0 graceful path
(decision-traces show `routing_source: legacy` and
`brain_md_tier_mode: tier_0` on every session).

Before v1.11.2, the plugin's command frontmatter declared three
inconsistent prefixes (`mcp__neo4j-brain__`, `mcp__mindrian-brain__`,
`mcp__pinecone-brain__`) inherited from earlier development phases. The
v1.11.0 QA harness (Lawrence's Dr. Miriam Kaplan persona, 2026-04-28)
caught this: the Brain knowledge graph was alive (7,353 LazyGraphConcept
nodes, 119,706 CO_OCCURS edges, 20+ named PWS frameworks) but
unreachable from any /mos:* command.

v1.11.2 standardizes on a single canonical name: `mindrian-brain`.

If your personal `.mcp.json` already declares the Brain server under
`neo4j-brain` or `pinecone-brain` from an earlier install, rename the
key to `mindrian-brain` and the plugin will find it on the next session.

---

## Section 2 -- The user-side .mcp.json snippet

Add the following entry to your personal `.mcp.json`. The exact
`command` and `args` depend on which Neo4j MCP server you run; the
common ones are listed below the snippet.

```json
{
  "mcpServers": {
    "mindrian-brain": {
      "command": "<path to your Neo4j MCP server binary>",
      "args": [
        "<arg1>",
        "<arg2>"
      ],
      "env": {
        "NEO4J_URI": "bolt://...",
        "NEO4J_USERNAME": "...",
        "NEO4J_PASSWORD": "..."
      }
    }
  }
}
```

Common Neo4j MCP servers that satisfy the contract:

- `mcp-neo4j-cypher` (official Neo4j MCP, Python). Exposes
  `read_neo4j_cypher`, `write_neo4j_cypher`, `get_neo4j_schema`.
- `@neo4j/mcp-server-cypher` (community Node port). Same tool surface.
- The bundled `mcp-server-brain/server.cjs` in this repo (declares the
  server name `mindrian-brain` natively at registration time, see
  Section 5).

Whichever you pick, the registered server name in your `.mcp.json` MUST
be `mindrian-brain`. The plugin's command frontmatter resolves on that
name.

---

## Section 3 -- How to verify the wiring

Once `.mcp.json` is updated, restart your Claude Code session and run
either of:

1. `/mos:compare-ventures` from a room with at least one venture
   description in `STATE.md`. If wired, the command renders Brain
   pattern matches and semantic search results. If unwired, it falls
   through to the "This command needs Larry's Brain connected" message.

2. `/mos:diagnostics` and inspect the resulting decision-trace at
   `.mindrian/decision-traces/<session>.json`. Look for:
   - `routing_source: engine` (not `legacy`) on at least one trace
     event per session.
   - `brain_md_tier_mode: mode_a` or `mode_b` (not `tier_0`) on
     BRAIN.md derivations.

If both signals appear, your Brain is wired correctly under the
canonical name. If only `legacy` and `tier_0` appear, the resolution
failed; double-check that `mindrian-brain` is the literal key in your
`.mcp.json` mcpServers block.

---

## Section 4 -- Migration from v1.11.0 / v1.11.1

If you installed before v1.11.2 and your personal `.mcp.json` has any
of these legacy keys:

```json
"neo4j-brain":     { ... }
"pinecone-brain":  { ... }
"my-neo4j":        { ... }
```

Rename the key to `mindrian-brain`. The contents (command, args, env)
stay the same. Restart your session. The plugin's command frontmatter
will route correctly on the next prompt.

If you have BOTH `neo4j-brain` and `pinecone-brain` declared (a
pattern from very early installs), pick the one that points at your
Neo4j Aura instance and rename it to `mindrian-brain`. The
`pinecone-brain` semantic-search surface is replaced by
`mcp__mindrian-brain__brain_search` in the v1.11.2 command sweep; you
can drop the standalone Pinecone MCP entry if you no longer need direct
Pinecone access from Claude.

---

## Section 5 -- Required Brain tool surface

The plugin's command frontmatter expects these tool names under the
canonical `mindrian-brain` server:

| Tool name              | Purpose                                          | Used by commands                                          |
|------------------------|--------------------------------------------------|-----------------------------------------------------------|
| `brain_query`          | Allow-listed Cypher queries with frame-handles   | act, compare-ventures, find-analogies, find-connections, rs-explain, rs-fetch, scout, suggest-next |
| `brain_search`         | Pinecone semantic search over methodology corpus | act, compare-ventures, find-analogies, suggest-next       |
| `read_neo4j_cypher`    | Direct read-only Cypher for ad-hoc traversal     | all 13 Brain-touching commands                            |
| `brain_schema`         | Schema introspection for Brain-mode probing      | deep-grade, diagnose, grade, help, organize, pipeline     |
| `get_neo4j_schema`     | Fallback schema introspection if `brain_schema` absent | deep-grade, diagnose, grade, help, organize, pipeline |

If your Neo4j MCP server does not expose all of these names, you have
two paths:

1. Use the bundled `mcp-server-brain/server.cjs` in this repo. It
   registers as `mindrian-brain` natively and exposes
   `read_neo4j_cypher` plus `brain_query` / `brain_search` /
   `brain_schema` aliases. Boot via:
   ```bash
   cd mcp-server-brain && npm install && node server.cjs
   ```
   Then point your `.mcp.json` at it via Streamable HTTP. See
   `mcp-server-brain/README.md` for env-var requirements.

2. Bridge the missing tools yourself by writing a thin MCP wrapper that
   delegates to your existing Neo4j MCP. The plugin does not require a
   specific implementation; it only requires the tool names resolve
   under the canonical `mindrian-brain` prefix.

---

## Canon traceability

This plan implements QA Section 2 FIX-2 Option A (cheapest sweep) per
Phase 94 CONTEXT.md decisions. Option B (alias system in plugin
.mcp.json) and Option C (auto-detect at session-start) are deferred to
v1.12.

- Canon Part 7 (Reuse Before Build): no new alias system, no
  auto-detect, no new MCP server entry in the plugin's `.mcp.json`.
  We compose existing command frontmatter into a single canonical
  prefix.
- Canon Part 8 (Graph Boundary): the Brain query chokepoint behavior
  is unchanged. v1.11.2 only standardizes the MCP server name passed
  in. Zero user-data egress added or removed; allow-list scalars
  contract preserved.

---

## Related docs

- `docs/MINDRIAN-CANON.md` -- Part 8 graph boundary, Part 7 reuse rule
- `docs/CANON-PHASE-MAP.md` -- canonical phase ledger
- `mcp-server-brain/README.md` -- bundled Brain MCP server (optional)
- `references/brain/query-patterns.md` -- allow-listed Cypher patterns
  consumed by `brain_query`
- `.planning/phases/94-v1-11-2-tester-driven-fixer/94-CONTEXT.md` --
  the QA-rescoped Phase 94 brief that drove this plan

---

_Brain Setup -- MindrianOS-Plugin v1.11.2_
