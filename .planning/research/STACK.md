# Stack Research

**Domain:** v2.1.0 "Green the Floor" - ingest-pipeline fixes + batch enrichment on the Memgraph Brain (cross-repo: /home/jsagi/dev/ProblemsWorthSolving-Brain)
**Researched:** 2026-08-13
**Confidence:** HIGH (every API claim below cites Context7 against current Memgraph / neo4j-driver 6.x docs, or a direct source-file read from this session)

## Headline

**Zero new dependencies.** Every fix in this milestone lands in Cypher statement text and
ESM code changes inside the existing seams: `cypher()` (autocommit), `runIngestTx()`
(explicit tx), and the `brain_write` / `ingest_framework` / `brain_query` tool handlers.
The stack question for v2.1.0 is not "what to add" but "which seam carries which write" -
and one seam (autocommit DDL) currently has no reachable transport, which is an access
problem (Render SSH key), not a code-dependency problem.

## Existing Stack (verified against ProblemsWorthSolving-Brain/package.json this session)

| Technology | Version | Role |
|------------|---------|------|
| `neo4j-driver` | ^6.2.0 | The ONLY graph client. Autocommit via `session.run` (the `cypher()` seam), explicit tx via `session.beginTransaction` (the `runIngestTx` seam), `neo4j.int()` / `wrapInts()` for Bolt integer preservation |
| `zod` | ^4.4.3 | Tool input schemas (admin-tools.mjs already uses it) |
| `@modelcontextprotocol/server` / `node` | ^2.0.0-beta.4 | MCP surface; unchanged this milestone |
| `express` | ^5.2.1 | HTTP transport; unchanged |
| Memgraph (Render, `pws-brain-db`) | live | IN_MEMORY_TRANSACTIONAL + SNAPSHOT_ISOLATION (do not change - ANALYTICAL silently disables rollback, memgraph-bolt.mjs:262-264) |
| Node built-in test runner | Node 22+ | `node --test tests/*.test.mjs`; hermetic-first convention |

---

## (a) MERGE-based dedup that CANNOT self-loop: the guard pattern

### Root cause (source read, src/ingest/dedup.mjs:137-143)

The alias-branch statement is:

```cypher
MATCH (canon:Framework) WHERE canon.name = $canonName
MERGE (a:Framework {id: $aliasId}) SET a.name = $aliasName
MERGE (a)-[:ALIAS_OF]->(canon)
```

Nothing in the STATEMENT prevents `a` and `canon` from binding to the same node. The
JS-side `sameId` check (dedup.mjs:113-120) compares `fw.id` against a `canon.id` read in a
SEPARATE earlier query with DIFFERENT matching semantics: the read uses
`toLower(f.name) = toLower($canonName) ... LIMIT 1`, the write uses case-sensitive
`canon.name = $canonName` with NO limit. Three distinct holes let the check and the write
disagree:

1. **Semantic mismatch:** case-sensitive vs toLower, LIMIT 1 vs unbounded fan-out. The
   read can inspect node X while the write MERGEs against node Y (or against several).
2. **Null-id canon:** when the canonical carries no `id` prop (still true for a large
   share of live :Framework nodes), `sameId` is false even when `MERGE (a {id: $aliasId})`
   lands on that very node in a later state - the JS check is structurally blind there.
3. **Two round trips:** read-then-write across separate autocommit calls is a TOCTOU
   window; the graph can change between them.

This is exactly the class that minted the 41 historical self-loops (pre-2026-08-07 code
had NO check) and the 1 fresh one on Nested Hierarchies (internal id 42214, post-fix code,
proving the JS-side check is insufficient).

### The fix: guard IN the statement, not in JS

MERGE takes no WHERE clause; the openCypher idiom is a `WITH ... WHERE` gate between the
node resolution and the edge MERGE. Recommended replacement statement for
dedup.mjs:137-143:

```cypher
MATCH (canon:Framework) WHERE toLower(canon.name) = toLower($canonName)
WITH canon LIMIT 1
MERGE (a:Framework {id: $aliasId})
SET a.name = $aliasName
WITH a, canon
WHERE id(a) <> id(canon)
MERGE (a)-[:ALIAS_OF]->(canon)
RETURN id(a) AS alias_nid, id(canon) AS canon_nid
```

Why each piece:

- `toLower(...) LIMIT 1` aligns the write's canon resolution with the read's (dedup.mjs:104),
  killing holes 1 and 3 (one statement, one snapshot-isolated view).
- `WITH a, canon WHERE id(a) <> id(canon)` is the structural self-loop guard: when both
  bind the same node, ZERO rows reach the edge MERGE. A no-op, never a loop. `id()` is
  Memgraph's persistent per-entity identifier (Context7 /websites/memgraph,
  read-and-modify-data). The `id(x) <> id(y)` comparison form is already proven live on
  this exact engine: the executed 2026-08-11 runbook's Step 3f uses
  `WHERE id(target) <> id(canon)` and committed cleanly.
- `WITH ... WHERE` between write clauses is standard Memgraph Cypher (WHERE filters any
  preceding MATCH/WITH; Context7 /websites/memgraph, clauses/where + clauses/merge).

**No DB-level belt exists.** Memgraph constraints are node label-property only
(existence, uniqueness, type - Context7 /websites/memgraph, fundamentals/constraints +
differences-in-cypher-implementations). There is NO relationship constraint and therefore
no engine-level "ALIAS_OF may not self-loop" rule. So: belt = the statement guard above;
suspenders = (i) a hermetic test in tests/ asserting the built statement contains the
`id(a) <> id(canon)` gate (source-scan style, like the moat-parity tests), and (ii) the
already-proven idempotent hygiene DELETE (runbook Step 1,
`MATCH (f:Framework)-[r:ALIAS_OF]->(f) ... DELETE r`, returns 0 on re-run) kept as a
periodic contract probe: `MATCH (f:Framework)-[r:ALIAS_OF]->(f) RETURN count(r)` must be 0.

### The normalizeName direct-match branch (item 3, src/arm1-orchestrator.mjs:52)

The candidate fix in the milestone context is `AND NOT (f)-[:ALIAS_OF]->()` (bare pattern
predicate). **Use the documented Memgraph form instead** - the bare-pattern negation is
NOT what Memgraph's WHERE docs show; the two verified forms are the `exists()` function
and the EXISTS subquery (Context7 /websites/memgraph, clauses/where: "Negation with NOT
EXISTS" and "Filter with EXISTS Expressions"):

```cypher
OPTIONAL MATCH (f:Framework)
WHERE toLower(f.name) CONTAINS toLower($raw)
  AND NOT exists((f)-[:ALIAS_OF]->(:Framework))
```

(or the block form `AND NOT EXISTS { MATCH (f)-[:ALIAS_OF]->(:Framework) }`). Two
load-bearing details:

- Type the target `:Framework`. The live graph carries at least one
  `(:Framework)-[:ALIAS_OF]->(:DictionaryTerm)` edge (runbook 3b notes; live state showed
  0 for that node but the label class exists in the vocabulary). An untyped `->()` would
  suppress a canonical from direct match because of a glossary link - wrong.
- This fix runs BEFORE the self-loop DELETE hygiene in any future graph state: a node
  carrying only a self-loop would be excluded from direct match by this predicate while
  still being its own canon via the alias branch, which resolves to the same name - net
  effect harmless, but keep the Step-1 hygiene probe green anyway.

Note the runbook's Known Limitation 1 stands: this fix removes ALIASED nodes from the
direct branch (Scenario Planning drops from 6 to ~2), but the canonical
"Shell Scenario Planning Method" still direct-matches the substring AND arrives via the
alias branch - dedupe the final list (the query already collects DISTINCT per branch but
not across branches; add a final `WITH ... UNWIND ... RETURN collect(DISTINCT m)` or
dedupe in JS). Confirm against the floor gate's exact probe shape before claiming the
match-leg exception closed.

---

## (b) DDL and transactions: what Memgraph allows, and the correct seam

### Verified engine facts (Context7 /websites/memgraph)

| Claim | Source | Verdict |
|-------|--------|---------|
| Index manipulation is NOT permitted inside multicommand (explicit) transactions; use implicit/auto-commit | client-libraries (python + java pages): "Certain operations, such as index manipulation, are not permitted within multicommand transactions. In these cases, implicit or auto-commit transactions should be used" | CONFIRMED - no DDL-in-tx exists at all |
| The canonical pattern is a bare `session.run("CREATE INDEX ...")` on a session with no beginTransaction | client-libraries: "Run an implicit transaction for index creation" | CONFIRMED |
| `DROP VECTOR INDEX name;` is the drop syntax | querying/vector-search | CONFIRMED |
| DROP VECTOR INDEX "may be slow and memory-intensive as it restores vector data to the property store" | querying/vector-search | OPERATIONAL WARNING - see below |
| neo4j-driver 6.x: `session.run` outside `beginTransaction` = auto-commit; `beginTransaction/commit/rollback` = explicit | neo4j-javascript-driver 6.x README (Context7) + Memgraph client-libraries/javascript | CONFIRMED |

### Mapping onto the existing seams (source read, src/backends/memgraph-bolt.mjs)

| Seam | Transaction mode | Can run `DROP VECTOR INDEX`? |
|------|-----------------|------------------------------|
| `cypher()` (memgraph-bolt.mjs:112) | `session.run` = implicit autocommit | **YES - this is the ONE correct DDL seam** (same reason `createSnapshot()` at :333 routes through it) |
| `cypherReadOnly()` (:204) | executeRead, engine-enforced READ | NO - engine rejects; also FORBIDDEN_CLAUSE/WRITE_CLAUSE text guards catch `DROP` (admin-tools.mjs:43,108) |
| `runIngestTx()` (:270) | explicit `beginTransaction` | NO - Memgraph refuses index ops in a multicommand tx, by design |
| `brain_write` (admin-tools.mjs:275) | wraps runIngestTx | NO - correctly refuses; DO NOT loosen |
| `brain_query` (admin-tools.mjs:194) | wraps cypherReadOnly | NO - correctly refuses; DO NOT loosen |

**Conclusion the 2026-08-11 execution record already reached empirically ("no HTTPS seam
accepts index DDL") is engine-architectural, not a gap to patch in the tools.** The
recommended DDL-capable seam:

**Recommended: a Bolt-side ops script, not a new HTTP tool.**
`scripts/admin-drop-parked-indexes.mjs` in the brain repo that imports `cypher()` from
`src/backends/memgraph-bolt.mjs` and executes a FROZEN, hardcoded statement list - the 7
`DROP VECTOR INDEX <name>` rows from docs/VECTOR-INDEX-DISPOSITIONS.md (rows 3-9:
`framework_embeddings`, `concept_embeddings`, `creativework_embeddings`,
`entity_embeddings`, `person_embeddings`, `product_embeddings`, `vector`) plus a final
`CREATE SNAPSHOT` (also autocommit-legal; reuse `createSnapshot()`). Fail-closed: no
arguments accepted, no free Cypher, `mindrian_methodology_vec` and
`mindrian_methodology_vec_openai` (KEEP rows) structurally absent from the list; refuse to
run unless a pre-flight `SHOW INDEX INFO`/existence probe matches expectations. Run it
from a machine with Bolt reach: Render SSH tunnel to `pws-brain-db` (operator step:
register the SSH key - this is the actual blocker, not code) or a one-off Render job
inside the private network. Zero new HTTP surface, zero new dependency.

**Explicitly rejected alternative:** a `brain_ddl` HTTP admin tool behind
`BRAIN_HTTP_ADMIN=allow`. It would work (route an allowlisted enum through `cypher()`),
but the 2026-08-11 ops note is the argument against it: the temporary admin surface
stayed enabled ~2 days past its last write. A permanent DDL tool on the HTTP surface is a
standing widening of the moat for a one-time 7-statement ceremony. If the SSH key path is
truly unavailable, build it TEMPORARY with the same enable-execute-disable-in-one-sitting
discipline, allowlist in `src/contracts/` failing closed.

**Operational warning for the drops themselves:** Memgraph documents that dropping a
vector index "restores vector data to the property store" - i.e. each of the 7 drops
rehydrates its vectors as node properties, spending memory on a 10 GB-disk instance
before it frees any. Sequence: snapshot first (existing doctrine), drop one, verify, then
proceed; do not fire all 7 in one breath. Also fold in the Nested Hierarchies self-loop
DELETE (the id 42214 edge) on the same Bolt sitting - it needs no DDL seam (plain
`brain_write` can do it today) but the checkpoint queue already bundles them.

---

## (c) Idempotent batch prop-writer through the existing brain_write seam

### The pattern (Tier A: ~20 single-prop pattern_type SETs)

One `brain_write` call per carded batch, UNWIND as the batching mechanism - no tool-schema
change, no new endpoint:

```
tool: brain_write
cypher: |
  UNWIND $rows AS row
  MATCH (f:Framework)
  WHERE id(f) = row.nid AND f.name = row.name
  SET f.pattern_type = coalesce(f.pattern_type, row.pattern_type)
  RETURN count(*) AS touched
params: { "rows": [ { "nid": 34088, "name": "Reverse Salient Analysis", "pattern_type": "linear" }, ... ] }
dryRun: true    then dryRun: false
```

Why each piece (all verified against source this session):

- **`coalesce(f.pattern_type, row.pattern_type)` = additive-only + idempotent.** A
  stored value is NEVER overwritten (matches the ingest pipeline's own additive doctrine,
  dedup.mjs:13-15); a re-run of the same batch is a guaranteed no-op. Idempotency lives in
  the statement, not in operator discipline.
- **`id(f) = row.nid AND f.name = row.name` double guard.** Memgraph internal ids can be
  reused after node deletion; the name check makes a drifted graph a safe zero-row no-op
  instead of a wrong-node write. This is the exact proven pattern from every executed
  runbook statement (2026-08-11, all committed clean).
- **One call = one explicit tx = one post-commit snapshot.** brain_write routes through
  `runIngestTx` (rollback on any throw, so a malformed row aborts the WHOLE batch - no
  partial batch) and fires `createSnapshot()` once per commit (admin-tools.mjs:290-305).
  20 separate calls would cost 20 snapshots; one UNWIND costs one.
- **`wrapInts` covers nested ints.** admin-tools.mjs:180-189 recursively wraps integers
  inside arrays and objects with `neo4j.int()`, so `row.nid` survives Bolt's
  number-to-FLOAT demotion with no caller-side work (Memgraph rejects float ids/limits).
- **brain_write does NOT echo RETURN rows** (handler returns only `Written. Stats:
  {committed}` - admin-tools.mjs:306-310; confirmed by the execution record). So: dryRun
  validates parse + guards (statements execute then roll back), and VERIFICATION is a
  separate read-tier `brain_query`:
  `MATCH (f:Framework) WHERE f.pattern_type IS NOT NULL RETURN count(f)` before/after,
  plus per-node spot probes. Budget the verify step into the card; never claim the batch
  from the Stats line alone.

### The ~18 full enrichment payloads

These go through `ingest_framework` with the proven payload template (the reverse-salient
ingest shape: dry-run -> APPROVE card -> commit), **AFTER the live-node prop-drop fix
lands**. Ordering is load-bearing: the 2026-08-11 sitting proved the current pipeline
accepts framework-level props for an existing node and silently drops them
(accepted 17/rejected 0, `pattern_type` stayed null on node 34088).

### The prop-drop fix itself (item 1) - code, not stack

In `resolveFramework`'s two noop branches (dedup.mjs:75 exact-id, :116-120 sameId),
replace `statements: []` with an additive SET for incoming props the stored node LACKS
(computed in JS: incoming non-null, stored null), e.g.:

```cypher
MATCH (f:Framework {id: $id})
SET f += $missingProps
RETURN f.name
```

where `$missingProps` contains ONLY keys whose stored value was null in the just-read
`byId[0]` / `canon` row (so `SET +=` cannot overwrite - the conflict path stays
flag-never-write, `detectConflicts` unchanged). This turns the false-success into an
honest enrichment write with zero doctrine change. Belt: extend the plan's `warn`/`flag`
reporting so a noop-with-props-applied is visible as its own plan entry (the
NODE_PROP_KEYS incident pattern: silent anything is the enemy).

---

## (d) New dependencies: NONE. Proof per candidate

| Candidate | Needed? | Why not |
|-----------|---------|---------|
| Any new graph client (mgclient, pymgclient, gqlalchemy) | NO | `neo4j-driver` ^6.2.0 already covers autocommit, explicit tx, READ-mode sessions, int wrapping. Memgraph's own docs use the neo4j driver for JS clients |
| APOC / merge-helper library | NO | Memgraph has no APOC; `apoc.mergeNodes`-style collapse is already replaced by the proven ALIAS_OF `brain_write` surgery pattern (executed 2026-08-11). The self-loop guard is 3 lines of Cypher |
| Migration/DDL framework | NO | 7 frozen DROP statements + 1 snapshot in a fail-closed script through the existing `cypher()` seam. A framework would ADD surface to a moat that is deliberately narrow |
| Batch/queue library (for the 90-framework long tail) | NO | Demand-ranked queue is a data problem (readiness misses already measured live); a JSON/`.mjs` payload list in `payloads/` + the existing card ceremony is the established pattern (`payloads/` named the right pattern in the brain repo CLAUDE.md) |
| New test tooling | NO | Node built-in runner + hermetic source-scan tests (existing convention) cover the new guards |

## What NOT to Touch

| Do not | Why |
|--------|-----|
| Loosen brain_write / brain_query to accept DDL | Engine architecture makes it impossible in their tx modes anyway (explicit tx / READ mode); loosening the text guards would only create a confusing half-open door |
| Switch STORAGE MODE for the drops | ANALYTICAL disables transactional rollback silently (memgraph-bolt.mjs:262-264, RESEARCH Pitfall 6); the drops are autocommit ops, no mode change needed |
| Re-embed or touch the two KEEP indexes | e5-identity contract; `mindrian_methodology_vec` is the only e5-queryable index, `_openai` is KEEP-RETIRED backing a filed baseline |
| Add a permanent HTTP DDL tool | 2026-08-11 ops lesson: admin windows drift open. One-time ceremony, Bolt-side script |
| Rely on JS-side read-then-check for dedup identity | The proven-failed pattern (fresh self-loop id 42214 minted PAST the sameId check). The guard must be in the statement |

## Version Compatibility

| Package | Compatible with | Notes |
|---------|-----------------|-------|
| neo4j-driver ^6.2.0 | Memgraph Bolt (live, verified in production daily) | tx_timeout metadata accepted (measured, memgraph-bolt.mjs:106-108); Integer objects need `toPlain`/`neo4j.int` (already handled) |
| Cypher `WITH ... WHERE` gate + `id()` | Memgraph (current docs) | Runbook Step 3f used the identical `id(x) <> id(y)` form and committed on this engine 2026-08-11 |
| `exists((f)-[:ALIAS_OF]->(:Framework))` / `NOT EXISTS { MATCH ... }` | Memgraph (current docs) | Use these documented forms, NOT the bare `NOT (f)-[:ALIAS_OF]->()` pattern predicate (unverified on Memgraph); smoke-test the chosen form via read-tier brain_query before shipping the T1 change |

## Sources

- Context7 `/websites/memgraph` - clauses/where (EXISTS subquery, `exists()` function, NOT EXISTS negation), clauses/merge (relationship MERGE), read-and-modify-data (`id()` persistent identifier), querying/vector-search (`DROP VECTOR INDEX` syntax + property-store restore warning), fundamentals/constraints + differences-in-cypher-implementations (node-only constraint types), client-libraries python/java/javascript (index ops forbidden in multicommand tx; implicit `session.run` is the sanctioned path; explicit `beginTransaction` semantics). Confidence: HIGH.
- Context7 `/neo4j/neo4j-javascript-driver` (6.x branch README) - explicit tx lifecycle (`beginTransaction`/`commit`/`rollback`) vs `session.run`. Confidence: HIGH.
- Direct source reads this session (HIGH, primary): `ProblemsWorthSolving-Brain/src/ingest/dedup.mjs` (self-loop mechanism, sameId hole), `src/ingest/pipeline.mjs` (plan/statement order, snapshot ordering), `src/backends/memgraph-bolt.mjs` (cypher autocommit seam :112, runIngestTx :270, createSnapshot :333), `src/http/admin-tools.mjs` (brain_write handler :275, wrapInts :180, guards :43/:108), `src/arm1-orchestrator.mjs` (T1 query :52), `docs/2026-08-11-RUNBOOK-249-alias-collapse.md` (execution record, proven statement patterns, ops lesson), `docs/VECTOR-INDEX-DISPOSITIONS.md` (the 7 DROP rows), `package.json` (dependency versions).

---
*Stack research for: v2.1.0 "Green the Floor" (MindrianOS Plugin, cross-repo with ProblemsWorthSolving-Brain)*
*Researched: 2026-08-13*
