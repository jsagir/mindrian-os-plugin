# mcp-server-brain -- Claude Code project notes

> Audience: anyone editing the Brain MCP server (`server.cjs` +
> `lib/neo4j-tools.cjs` + `lib/pinecone-tools.cjs` + `lib/brain-ask.cjs`).
> Deployment: mindrian-brain.onrender.com (remote, Streamable HTTP, API-key gated).

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
| `brain_query` | `lib/neo4j-tools.cjs` | Read-only Cypher against the teaching graph -- admin key required (Phase 127.1 Plan 05 moat guard) |
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

---

## Brain-query moat guard (Phase 127.1 Plan 05)

The teaching graph IS the moat (Canon Part 9). Plan 127.1-05 closed a
confidentiality hole in the served `brain_query` tool. Before this plan, the
handler ran arbitrary caller-supplied Cypher under `defaultAccessMode: READ`
only. That blocks writes but not reads: any Brain keyholder could run
`MATCH (n) RETURN n` and copy the whole methodology graph.

Two of the four moat-guard decisions shipped in code in v1.13.0-beta.21. The
remaining two were resolved as a tier confirmation plus a deferral.

### D-MOAT-1 -- brain_query admin gate (SHIPPED v1.13.0-beta.21)

`brain_query` is gated to the `admin` plan, mirroring the existing `brain_write`
gate verbatim. A non-admin keyholder calling `brain_query` gets an
authorization-denied `isError` response and runs zero caller Cypher; the caller
is pointed at `brain_search` and `brain_ask` for methodology lookups. The tool
stays registered and functional for admin callers, so Canon G-2 holds (the
generic Cypher tools survive the Pinecone retirement). Implemented in
`lib/neo4j-tools.cjs`; commit `0d1416a6`.

### D-MOAT-2 -- Cypher execution safeguards (SHIPPED v1.13.0-beta.21)

Four execution safeguards, ported from the official Neo4j `mcp-neo4j-cypher`
recipe, bound any read the admin gate still permits (an admin call can still be
a runaway query). They also bound `brain_schema` reads where meaningful: the
timeout and the byte cap apply to `brain_schema`, while the EXPLAIN reject and
the row cap do not, because `brain_schema` runs fixed `CALL db.*` procedures
rather than caller Cypher.

| Knob | Default | What it bounds |
|------|---------|----------------|
| `BRAIN_CYPHER_MAX_ESTIMATED_ROWS` | 5000 | EXPLAIN-plan estimated-row reject, before execution |
| `BRAIN_CYPHER_MAX_ROWS` | 1000 | Hard cap on returned records |
| `BRAIN_CYPHER_MAX_BYTES` | 524288 | Response size cap |
| `BRAIN_CYPHER_TIMEOUT_MS` | 5000 | Read transaction timeout |

The defaults are declared on the `mindrian-brain` Render service in `render.yaml`
and documented in `.env.example`. The server falls back to these values if the
vars are unset, so the safeguards are live with no operator action required.
Implemented in `lib/neo4j-tools.cjs`; commit `dd0d3ef7`.

The `BRAIN_*` prefix is intentional. The official Neo4j server uses `NEO4J_*`
names (`NEO4J_CYPHER_MAX_ROWS` and so on). The Brain runs a hand-rolled
`neo4j-tools.cjs`, not the official server, and already uses a `BRAIN_API_KEYS`
convention. The `BRAIN_` prefix keeps the namespace consistent and signals
"Brain-local, hand-rolled, not the official server's config".

### D-MOAT-4 -- Aura tier confirmed: Aura Free

The Brain's Neo4j instance (`5b8df33f.databases.neo4j.io`) was confirmed on the
Neo4j Aura console to run on the **Aura Free** tier.

### D-MOAT-3 -- scoped neo4j_reader credential: DEFERRED

D-MOAT-3 planned a scoped `neo4j_reader` credential that DENIES READ on the
embedding property and the methodology body text, so the served read path would
use a least-privilege credential instead of the `neo4j` superuser.

This is not achievable on **Aura Free**. Aura Free has no role-based access
control: no custom roles (`CREATE ROLE` fails), no additional database users,
and no property-level `DENY READ`. The built-in `reader` role exists on every
tier but cannot deny the `embedding` property or the body text, so it would not
actually protect the moat.

D-MOAT-3 is therefore DEFERRED. It needs one of:

- the Brain's Neo4j moved to **Aura Professional** or higher, where RBAC allows
  a scoped `neo4j_reader` role with property-level `DENY READ`; or
- a curated / parameterized-query surface shipped as a future phase, so the
  served read path never accepts arbitrary caller Cypher in the first place.

No `NEO4J_READER_USER` / `NEO4J_READER_PASSWORD` env vars were added to
`render.yaml` or `.env.example`, because no scoped credential exists to point
them at. Until D-MOAT-3 lands, the D-MOAT-1 admin gate plus the D-MOAT-2
execution safeguards are the live scoping levers, and the served read path
continues to use the existing `NEO4J_USER` credential. Re-pointing the served
read path onto a scoped reader credential is a `server.cjs` concern that Plan
127.1-05 deliberately did not touch (soak-independence from Plan 127.1-04).

### D-MOAT-3 (curated-op surface) -- the second option, now SHIPPED

D-MOAT-3's deferral note named two ways forward. The first (Aura Professional
RBAC) is still deferred. The SECOND -- "a curated / parameterized-query surface
shipped as a future phase, so the served read path never accepts arbitrary
caller Cypher in the first place" -- is now LANDED as the curated-op surface in
`lib/brain-ask.cjs` (BUG 2 fix).

The curated-op surface is an optional `op` MODE of the existing `brain_ask`
tool. It is NOT a new MCP tool: the startup tool count stays at **6**. When a
caller sets `op`, the server resolves it to one of a closed set of FROZEN
server-side Cypher strings and runs it READ-only, bounded by the D-MOAT-2 caps.
When `op` is absent, `brain_ask` behaves exactly as before (the
natural-language directive path is untouched).

| Op | Params | Returns rows shaped |
|----|--------|---------------------|
| `list_frameworks` | `{ limit? }` | `{ name, description, category }` |
| `framework_edges` | `{ edge_type, limit? }` | `{ from, to, confidence, transform }` (FEEDS_INTO) or `{ framework, problem_type }` (ADDRESSES_PROBLEM_TYPE) |
| `framework_chain_slice` | `{ seeds, max_hops?, limit? }` | `{ from, to, hop_distance }` |

Why this is moat-safe (Canon Part 8):

- **No caller Cypher.** The caller never supplies a query string. Each op maps
  to a frozen Cypher constant. The `edge_type` param is a closed enum that
  SELECTS one of two frozen strings; `max_hops` is server-clamped to `[1,3]`
  and the clamped integer SELECTS one of three frozen variants (a
  variable-length bound cannot be a `$`-bound param). The relationship type and
  the hop bound are never interpolated from caller input. Every other param
  (`limit`, `seeds`) is `$`-bound. The `MATCH (n) RETURN n` graph-copy attack
  stays blocked.
- **Ungated by design.** The curated-op surface is reachable by any valid API
  key -- it is a mode of `brain_ask`, which is ungated. Only `brain_query` and
  `brain_write` are admin-gated (D-MOAT-1); that gate is untouched.
- **D-MOAT-2 bounded.** The curated read applies the same row cap, byte cap,
  and read timeout as `brain_query` (`BRAIN_CYPHER_MAX_ROWS` /
  `BRAIN_CYPHER_MAX_BYTES` / `BRAIN_CYPHER_TIMEOUT_MS`). `list_frameworks`
  bulk-enumerates the framework catalogue (names + descriptions + categories),
  so the D-MOAT-2 row cap is the relevant ceiling on that op. Catalogue
  enumeration is the "anyone can copy" tier per `.claude/includes/moat.md`; the
  connection graph, grading calibration, and mode calibration -- the actual
  moat -- are NOT bulk-exposed by any op.
- **Graceful degradation.** A graph failure, a timeout, an oversized payload,
  or a bad param returns `{ op, source:'neo4j_curated', count:0, rows:[],
  degraded:true }` rather than throwing.

`neo4j-tools.cjs` does not export its `runBoundedRead` helper, so the curated
path replicates the timeout + row cap + byte cap inline in `brain-ask.cjs`,
reading the same `BRAIN_CYPHER_*` env vars with the same defaults.

### Cross-references

- `.planning/phases/127.1-brain-graphrag-collapse-pinecone-neo4j-hnsw-server-side-substrate-swap/127.1-05-PLAN.md` -- the plan
- `.planning/phases/127.1-brain-graphrag-collapse-pinecone-neo4j-hnsw-server-side-substrate-swap/127.1-05-SUMMARY.md` -- the outcome record
