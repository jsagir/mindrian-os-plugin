# Brain Setup -- Canonical MCP Server Name

> Status: shipped in v1.11.2 (Plan 94-03)
> Audience: any user installing MindrianOS-Plugin who wants Brain-enriched
> /mos:* commands (Mode A / Mode B per Canon Part 3) instead of the
> graceful Tier 0 fallback.

---

## Section 0 -- Authentication: Bearer-only (Phase 123 Plan-07)

The Brain HTTP server (currently `https://mindrian-brain.onrender.com`, moving to `https://brain.mindrian.ai`) authenticates exclusively via `Authorization: Bearer <your-key>`. The `x-api-key` header is **NOT** supported -- a raw `x-api-key` request returns 401 whose body links to `https://mindrianos.vercel.app/brain-access` for help. The `MINDRIAN_BRAIN_URL` env var lets you override the base URL (for staging, self-hosted, or future migration). The plugin's `lib/core/brain-client.cjs` sends the Bearer header on every call; nothing else works.

### Where the key is read from (Phase 123 Plan-07)

`lib/core/resolve-brain-key.cjs` is the single source of truth. It looks in this order:

1. `MINDRIAN_BRAIN_KEY` env var (explicit operator intent, highest priority)
2. `~/.mindrian.env` containing `MINDRIAN_BRAIN_KEY=<key>` (global backup, persists across CWDs)
3. `<cwd>/.env` containing `MINDRIAN_BRAIN_KEY=<key>` (project-local override)
4. not-found

On POSIX, both `.env`-style files MUST be `chmod 600`. The resolver refuses to load a key from a group/world-readable file -- SEC-02. `/mos:setup brain` chmods the file 0600 automatically; if you write the file by hand, `chmod 600 ~/.mindrian.env`.

If no key is found, you get the no-key fallback: request one at `https://mindrianos.vercel.app/brain-access`. Once you have it, either export it inline (`export MINDRIAN_BRAIN_KEY=...`) or run `/mos:setup brain` to persist it to `~/.mindrian.env`.

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

## Section 6 -- Bundled mcp-server-brain (optional/legacy)

**v1.11.2 (Plan 94-04) deprecates the bundled `mcp-server-brain/` in
favor of users pointing the canonical `mindrian-brain` name at their
own Neo4j MCP** (Plan 94-03 Option A; the cheapest sweep, no alias
system, no auto-detect). The bundled server remains buildable for
advanced users who want a single repo install path.

If you want the bundled path:

1. Run `bash install.sh` from this repo. Plan 94-04 added a Tier 0
   graceful post-install hook that runs `(cd mcp-server-brain && npm
   install)` automatically when the directory and `package.json` are
   present. If the directory is absent (advanced strip-down install),
   the hook silently skips.

2. Copy `.env.brain.template` to `.env.brain` and populate the 7
   required environment variables:

   | Variable             | Role                                        |
   |----------------------|---------------------------------------------|
   | `SUPABASE_URL`       | Supabase project URL hosting key/auth DB    |
   | `SUPABASE_KEY`       | Supabase service-role key (NEVER share)     |
   | `MINDRIAN_BRAIN_KEY` | Per-user secret validating Brain queries    |
   | `NEO4J_URI`          | bolt:// or neo4j+s:// connection string     |
   | `NEO4J_USERNAME`     | Neo4j auth                                  |
   | `NEO4J_PASSWORD`     | Neo4j auth                                  |
   | `PINECONE_API_KEY`   | Pinecone semantic search                    |

3. Verify the bundled server boots:

   ```bash
   node mcp-server-brain/test-brain.cjs
   ```

   The script exits 0 once the env vars are populated. If env vars are
   absent it skips gracefully with an "env not configured" message --
   the test never throws on a fresh install.

4. Register the bundled server in your personal `.mcp.json` under the
   canonical name `mindrian-brain` (Section 2 above). The plugin's
   command frontmatter routes Brain calls through that name.

### Drift warning at session-start

Plan 94-04 also added a session-start drift check. If your environment
has `MINDRIAN_BRAIN_KEY` exported but no `mindrian-brain` MCP server
resolves in any of:

- `<repo>/.mcp.json`
- `~/.config/claude-code/mcp.json`
- `~/.mcp.json`

then `scripts/session-start` emits a yellow `WARN` line on stderr at
the next session start. Loud yellow signal beats silent Tier 0
fallback. Fix the misconfiguration by registering the canonical name in
one of those config files (Section 2 above) and the warning clears on
the next session.

### Why the bundled server is now optional

The bundled `mcp-server-brain/` was the only Brain wiring path before
v1.11.2. Plan 94-03 standardized the canonical server name across 17
commands and made the user-side path (your own Neo4j MCP under
`mindrian-brain`) work with zero plugin changes. The bundled server is
a heavier install (Neo4j client + Pinecone client + Express + zod +
node_modules + `.env.brain`) and is not required for the plugin to
operate. Most users should follow Section 2 (point your existing Neo4j
MCP at the canonical name) and skip the bundled path entirely.

If a future Phase reconsiders the bundled path (e.g. fully managed
Brain hosted at brain.mindrian.ai with API-key auth), the deprecation
note here will be updated. For v1.11.2 the path is: user's own Neo4j
MCP under canonical name; bundled server retained as advanced-user
escape hatch.

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
