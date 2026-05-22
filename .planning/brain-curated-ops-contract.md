# Brain Curated-Op Surface -- FROZEN CONTRACT (BUG 2 fix)

Status: FROZEN 2026-05-22. All three builder agents bind to this. Do not deviate.

## Why

`brain_query` (raw caller Cypher) is admin-gated (D-MOAT-1) and stays gated -- it
is the moat. Plugin consumers written against raw Cypher are starved for every
non-admin user. Fix: a curated, parameterized surface added as an `op` MODE of
the existing ungated `brain_ask` tool. No new MCP tool (keeps the startup tool
count at 6). No caller Cypher ever. Any valid API key may call it.

## Graph facts (verified live 2026-05-22)

- 167 Framework nodes; 122 have `description`, 20 have `category`.
- 176 `(:Framework)-[:FEEDS_INTO]->(:Framework)` edges.
- 142 `(:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(:ProblemType)` edges.
- `CO_OCCURS`, `FailureMode`, `Venture`: ZERO. No ops target them.

## Server side -- `brain_ask` gains an optional `op`

`mcp-server-brain/lib/brain-ask.cjs`. Add to the Zod input schema:

    op:     z.enum(['list_frameworks','framework_edges','framework_chain_slice']).optional()
    params: z.object({}).passthrough().optional()

When `op` is ABSENT: behave EXACTLY as today (natural-language directive
synthesis -- do not touch that path).

When `op` is SET: resolve to a FROZEN server-side Cypher from a `CURATED_OPS`
map, run it READ-only on a Neo4j session bounded by the D-MOAT-2 caps
(BRAIN_CYPHER_MAX_ROWS / _MAX_BYTES / _TIMEOUT_MS -- reuse the bounded-read
helper from neo4j-tools.cjs), and return:

    { op: <name>, source: 'neo4j_curated', count: <n>, rows: [ ... ] }

All params are `$`-bound. No string interpolation of caller input into Cypher.
On graph failure: return `{ op, source:'neo4j_curated', count:0, rows:[], degraded:true }`.

### op 1 -- `list_frameworks`

Params: `{ limit?: number }` (server clamps to <= BRAIN_CYPHER_MAX_ROWS, default 1000).
Cypher (frozen):

    MATCH (f:Framework) WHERE f.name IS NOT NULL
    RETURN f.name AS name,
           coalesce(f.description,'') AS description,
           coalesce(f.category,'') AS category
    ORDER BY f.name LIMIT $limit

Row shape: `{ name, description, category }`.

### op 2 -- `framework_edges`

Params: `{ edge_type: 'FEEDS_INTO' | 'ADDRESSES_PROBLEM_TYPE', limit?: number }`.
`edge_type` is a closed enum -> the server selects ONE of TWO frozen Cypher
strings (the relationship type is NEVER interpolated from caller input):

  FEEDS_INTO:
    MATCH (a:Framework)-[r:FEEDS_INTO]->(b:Framework)
    RETURN a.name AS from, b.name AS to,
           coalesce(r.confidence,0.0) AS confidence,
           coalesce(r.transform_description,'') AS transform
    LIMIT $limit
  ADDRESSES_PROBLEM_TYPE:
    MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
    RETURN f.name AS framework, pt.name AS problem_type
    LIMIT $limit

Row shape: FEEDS_INTO -> `{ from, to, confidence, transform }`;
ADDRESSES_PROBLEM_TYPE -> `{ framework, problem_type }`.

### op 3 -- `framework_chain_slice`

Params: `{ seeds: string[], max_hops?: 1|2|3 }`. Server clamps `max_hops` to
[1,3] (default 2). Because a variable-length bound cannot be a bound param, the
server selects one of three frozen Cypher variants by the CLAMPED integer (a
server-controlled clamped int, never caller text). `seeds` IS `$`-bound.

    MATCH path = (f:Framework)-[:FEEDS_INTO*1..{N}]->(g:Framework)
    WHERE f.name IN $seeds
    RETURN f.name AS from, g.name AS to, length(path) AS hop_distance
    LIMIT $limit

Row shape: `{ from, to, hop_distance }`.

## Client side -- `lib/core/brain-client.cjs`

Add a helper. `query()` stays as-is (admin/build-time path).

    async askOp(operation, params = {})
      -> calls callTool('brain_ask', { op: operation, params })
      -> parses the JSON text payload
      -> returns { op, source, count, rows, degraded? }
      -> on any transport/parse failure returns { op, count:0, rows:[], degraded:true }

Consumers call `brain.askOp('list_frameworks', {})` etc. Consumers that only
need a framework chain for ONE anchor keep using `brain.ask(question)` and read
`next_gate.options[].framework` (the directive path -- already ungated, already
shipped).

## Canon Part 8

Every op returns only generic teaching methodology (framework names,
descriptions, categories, typed edges, problem-type enums). Every input is a
generic handle (framework name, enum, integer). No op accepts caller Cypher --
the `MATCH (n) RETURN n` graph-copy attack stays blocked; the `brain_query`
admin gate is untouched. `list_frameworks` bulk-enumerates the framework
catalogue (names + descriptions) -- this is the "anyone can copy" tier per
.claude/includes/moat.md; the connection graph + grading calibration + mode
calibration (the actual moat) are NOT bulk-exposed. Capped by D-MOAT-2.
