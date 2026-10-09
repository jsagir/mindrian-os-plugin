# Cypher subset over the SQLite room graph: specification (draft)

Status: draft for navigator review. Discovery only. No build plan, timeline or code in this document.
Scope: the read path over the room graph (room.db). Writes are out of scope for version 1.

## 1. Store (what is queried)

Source: room.db schema read live from the MindrianOS room graph (room_graph graph-query over sqlite_master), 2026-10-09.

`nodes` (id TEXT PRIMARY KEY):
- type TEXT NOT NULL: the label discriminator (e.g. RSDiscovery, ReverseSalient, Innovation, Paper, Author, Institution).
- properties TEXT DEFAULT '{}': JSON text. Property access reads from this column.
- source_path TEXT NOT NULL.
- created_by TEXT NOT NULL, CHECK in ('user','larry','import','brain','system'). The value 'brain' stays allowed by the schema, but no writer in this package may use it (decision 2026-10-08).
- confidence REAL.
- review_status TEXT NOT NULL DEFAULT 'proposed', CHECK in ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated').
- created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL (epoch integers).
- source_section, confirmed_by, confirmed_at, valid_from, valid_to, invalidated_at, last_modified_at (all nullable).

`edges` (PRIMARY KEY (source, target, type); FOREIGN KEY source and target REFERENCES nodes(id)):
- source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL.
- properties TEXT DEFAULT '{}': JSON text, so edge properties are a JSON column, not a separate table.
- review_status TEXT DEFAULT NULL.

Indexes exist on nodes(type), nodes(review_status), nodes(source_path), edges(source), edges(target), edges(type), and the combined (source, type) and (target, type). The translator can rely on these for the type filter and the join.

Edge direction: an edge row points from source to target. An undirected pattern matches both columns.

Other tables in room.db (assumptions, decisions_index, facts, fragments, held_contradictions, identity, ranker_weights, scaffold_log, session_focus, sessions, stakeholders, voice_log) are outside the graph subset. The translator reads only nodes and edges.

## 2. Accepted syntax (version 1)

Only this shape is accepted:

    MATCH <pattern> [WHERE <predicate>] RETURN <projection> [LIMIT <n>]

Pattern forms:
- Node: (v), (v:Label), (v:Label {key: $param, ...})
- One hop: (a)-[r]->(b), (a)-[r:TYPE]->(b), (a)-[r:TYPE]-(b) (undirected)
- Two hops: a chain of one-hop patterns sharing a variable. No variable-length paths in version 1.

Predicates: equality and inequality on a property, IN with a list parameter, CONTAINS and STARTS WITH on strings, AND, OR, NOT, parentheses.

Projections: variables, property access (v.prop), count(v), DISTINCT.

Parameters: $name only. Literal values inside the query text are allowed for labels, types and LIMIT only.

Rejected, with a clear error: CREATE, MERGE, SET, DELETE, REMOVE, CALL, OPTIONAL MATCH, UNWIND, WITH, ORDER BY (version 1 has no sort), UNION, variable-length paths, any function not in the allow-list.

Why these limits: each accepted form has one unambiguous Neo4j meaning, so the same query text can run on Neo4j later without edit. Anything outside this subset would give different results on the two stores, so it is refused here.

## 3. Translation rules (the contract, not the code)

- Each node pattern becomes a join row on `nodes`, filtered by `type` when a label is given.
- Each property access reads from `properties` through the JSON extraction function. The property name is a fixed identifier from the query text, checked against a name pattern, never concatenated as free text.
- Each edge pattern becomes a join on `edges`, filtered by `type` when given. Undirected patterns match both directions.
- Every value from the query goes into a bound parameter. The translator never builds SQL from raw query strings.
- The result is returned as rows of plain values, not as graph objects, in version 1.

## 4. Safety

- Read-only connection: the translator opens the database read-only. A write attempt fails at the connection level too, not only in the parser.
- Query length limit and row limit set by the caller. Default row limit applies when LIMIT is absent.
- Errors name the rejected construct and the position in the query. They do not echo room content.
- No network call. The translator runs local only.

## 5. Compatibility check (to run before a query is trusted)

A query is accepted only if it parses in this subset AND the same text parses in the Neo4j Cypher grammar with the same meaning. The Neo4j check is a test fixture, run offline, against stored expected results. No live Neo4j is needed for the check.

## 6. Brain paths (decision recorded 2026-10-08)

- whitespace-to-brain.cjs: no Brain write. Output goes to the room mirror (rs-sqlite-mirror path). The Brain write is removed in the design, not re-routed by this subset.
- rs-brain-substrate.cjs: DECIDED 2026-10-09, disable (not remove). It reads a Brain Pinecone substrate through brain-client.cjs. The file keeps its code and returns a clear 'Brain not available' status. It never falls back silently. Reversible if the Brain returns. The code change itself waits for step 3 approval.
- rs-expert-mapper.cjs: no Brain reference found. No change.

## 7. Open questions for the navigator

1. RESOLVED: edge properties are a JSON text column, edges.properties (see section 1).
2. DECIDED 2026-10-09: version 1 returns rows of plain values. Reason: rows map one-to-one onto the SQL results the room already uses, they need no new object model, and every accepted query has an unambiguous row meaning on both stores. Graph objects (node and edge maps) are deferred to a later version, after rows are proven.
3. RESOLVED: rs-brain-substrate.cjs is disabled, not removed (section 6).
4. RESOLVED 2026-10-09: the Neo4j compatibility fixtures live in the neo4j skills (the installed neo4j-cypher-skill and neo4j-modeling-skill), not in package-2026/_tests and not in the plugin repo.
