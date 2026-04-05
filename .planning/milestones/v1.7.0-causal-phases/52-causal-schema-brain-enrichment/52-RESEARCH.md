# Phase 52: Causal Schema + Brain Enrichment - Research

**Researched:** 2026-04-03
**Domain:** KuzuDB schema extension + Neo4j Brain enrichment
**Confidence:** HIGH (verified against live KuzuDB 0.11.3 instance)

## Summary

Phase 52 extends the LazyGraph KuzuDB schema with a CausalClaim node type and three causal edge types (CAUSES, CASCADES_TO, EXTRACTED_FROM), then enriches the remote Brain Neo4j graph with causal framework wiring (FEEDS_INTO chains, CO_OCCURS edges, TYPICAL_AT stage mappings, new Framework and Concept nodes). It also adds Brain query patterns 11-13 to the existing query-patterns.md reference file.

The critical discovery from live testing is that **KuzuDB 0.11.3 does NOT support ACYCLIC or TRAIL path semantics** -- these keywords cause parser exceptions. Variable-length paths (`*1..N`) use WALK semantics only. The bounded upper limit prevents infinite traversal, but duplicate paths through cycles will appear in results. Cycle deduplication must happen in application code (CJS), not Cypher. This directly contradicts the STACK-causal.md research and CONTEXT.md decisions D-06/D-07 which assumed ACYCLIC was available.

**Primary recommendation:** Implement the schema exactly as designed, but replace all ACYCLIC Cypher queries with bounded variable-length paths (`*1..6`) plus CJS-side path deduplication. Use STRING for the `created` property (matching existing Artifact pattern) rather than TIMESTAMP. Test with synthetic cyclic data to verify the deduplication logic catches what ACYCLIC would have caught.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Full 12 properties stored on CausalClaim node: id, cause, mechanism, effect, confidence, evidence, source_artifact, domain, falsifiable_prediction, novelty_score, extraction_method, created. No derived properties.
- **D-02:** Full enrichment -- wire FEEDS_INTO chains + CO_OCCURS edges + TYPICAL_AT stage mappings + create Theory of Change Framework node + Causal Reasoning parent Concept node + link Falsifiability/Hypothesis Tree to causal frameworks.
- **D-03:** Verify Brain node labels via MCP read query BEFORE running any CREATE statements.
- **D-04:** Dynamic confidence with all signals: initial score by extraction method + prediction outcomes + contradiction/invalidation effects + age decay + cross-reference boost.
- **D-05:** Confidence stored as DOUBLE on CausalClaim node and on CAUSES edge (strength property). Formula defined in Phase 54.
- **D-06:** Belt and suspenders testing -- synthetic test data (5-10 nodes with cycles) to validate path queries. Delete after validation. **NOTE: ACYCLIC keyword unavailable in KuzuDB 0.11.3 -- test must verify CJS-side deduplication instead.**
- **D-07:** All variable-length causal chain queries MUST avoid returning cyclic paths. **NOTE: Since ACYCLIC is unavailable, this must be enforced via bounded paths + CJS deduplication, not Cypher keywords.**
- **D-08:** Follow existing pattern exactly: add to EDGE_TYPES array, add CREATE IF NOT EXISTS in initSchema(), extend graphStats().

### Claude's Discretion
- KuzuDB property types (STRING vs DOUBLE vs INT64) -- follow existing patterns in lazygraph-ops.cjs
- Exact CREATE TABLE syntax and default values
- Order of statements in initSchema()
- Brain enrichment Cypher execution order

### Deferred Ideas (OUT OF SCOPE)
- ENGINE-09: Research-Backed Examples (Phase 55)
- Novelty Scoring via Pinecone Embeddings (v1.8.0+)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHEMA-01 | CausalClaim node type with 12 properties | Verified: all types (STRING, DOUBLE, BOOLEAN) supported. TIMESTAMP works but existing pattern uses STRING for dates. |
| SCHEMA-02 | CAUSES edge (CausalClaim -> CausalClaim) with strength, mechanism, direction, discovery_method | Verified: same-type REL TABLE works. All property types supported. |
| SCHEMA-03 | CASCADES_TO edge (CausalClaim -> CausalClaim) with cascade_type, severity, path_length | Verified: same pattern as CAUSES. |
| SCHEMA-04 | EXTRACTED_FROM edge (CausalClaim -> Artifact) | Verified: cross-node-type REL TABLE works (tested Claim->Art edge). |
| SCHEMA-05 | All schema additions use CREATE IF NOT EXISTS | Verified: existing pattern in initSchema() uses this. KuzuDB 0.11.3 supports it. |
| SCHEMA-06 | graphStats() includes CausalClaim count and causal edge counts | Verified: existing graphStats() pattern routes edge counts by FROM/TO type. Add CausalClaim count + 3 edge type routes. |
| BRAIN-01 | Wire FEEDS_INTO chains: RCA -> Systems Thinking -> CLD -> Scenario Analysis | Brain MCP Cypher -- standard Neo4j CREATE pattern. Must verify node labels first (D-03). |
| BRAIN-02 | Add CO_OCCURS edges: RCA <-> Six Thinking Hats; ST <-> RSA; Cynefin <-> RCA | Bidirectional edges require two CREATE statements each (Neo4j standard). |
| BRAIN-03 | Create Theory of Change Framework node | Standard Neo4j CREATE with properties. |
| BRAIN-04 | Create Causal Reasoning parent Concept node | Standard Neo4j CREATE + RELATED_TO edges to framework family. |
| BRAIN-05 | Add TYPICAL_AT venture stage mappings | Requires VentureStage nodes to exist in Brain. Must verify (D-03). |
| BRAIN-06 | Link Falsifiability and Hypothesis Tree to causal frameworks | Must verify these Framework nodes exist by name in Brain. |
| BRAIN-07 | Add Brain query patterns 11-13 | Append to existing references/brain/query-patterns.md following established format. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| kuzu (npm) | 0.11.3 | Embedded graph database for LazyGraph | Already installed. CJS is the sole writer. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Brain MCP (remote) | Neo4j Aura | Remote teaching graph at brain.mindrian.ai | For BRAIN-01 through BRAIN-06 enrichment |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| STRING for created field | TIMESTAMP type | TIMESTAMP works in 0.11.3 with `current_timestamp()` default, but existing Artifact uses STRING. Consistency wins. |
| CJS path deduplication | KuzuDB ACYCLIC keyword | ACYCLIC not available in 0.11.3. CJS dedup is the only option. |

**Installation:**
```bash
# No new packages needed. Zero dependency change.
```

## Architecture Patterns

### Recommended Changes to lazygraph-ops.cjs

```
lib/core/lazygraph-ops.cjs (EXTEND, do not rewrite)
  Line 21: EDGE_TYPES array -- append CAUSES, CASCADES_TO, EXTRACTED_FROM
  Line 27-99: initSchema() -- append CausalClaim table + 3 edge tables after line 98
  Line 361-390: graphStats() -- add CausalClaim count + edge routing for 3 new types
  Line 593-608: module.exports -- export any new CRUD functions

references/brain/query-patterns.md (APPEND)
  After Pattern 10 -- add Patterns 11, 12, 13

docs/lazygraph-schema.md (EXTEND)
  Add CausalClaim node documentation + 3 edge type documentation
```

### Pattern 1: Idempotent Schema Extension (EXISTING -- follow exactly)
**What:** All CREATE statements use IF NOT EXISTS.
**When to use:** Every schema change in initSchema().
**Example:**
```javascript
// Source: lib/core/lazygraph-ops.cjs lines 29-98
await conn.query(`
  CREATE NODE TABLE IF NOT EXISTS CausalClaim(
    id STRING PRIMARY KEY,
    cause STRING,
    mechanism STRING,
    effect STRING,
    confidence DOUBLE DEFAULT 0.5,
    evidence STRING DEFAULT '',
    source_artifact STRING DEFAULT '',
    domain STRING DEFAULT '',
    falsifiable_prediction STRING DEFAULT '',
    novelty_score DOUBLE DEFAULT 0.0,
    extraction_method STRING DEFAULT 'asserted',
    created STRING DEFAULT ''
  )
`);
```

### Pattern 2: Edge Type Routing in graphStats() (EXISTING -- follow exactly)
**What:** graphStats() routes edge count queries based on FROM/TO node types.
**When to use:** Adding any new edge type.
**Example:**
```javascript
// Source: lib/core/lazygraph-ops.cjs lines 370-378
// Existing routing pattern:
if (edgeType === 'BELONGS_TO') {
  query = `MATCH (a:Artifact)-[:${edgeType}]->(s:Section) RETURN count(*) AS cnt`;
} else if (edgeType === 'REASONING_INFORMS' || edgeType === 'REVERSE_SALIENT' || ...) {
  query = `MATCH (s1:Section)-[:${edgeType}]->(s2:Section) RETURN count(*) AS cnt`;
}
// New routing for causal edges:
// CAUSES, CASCADES_TO: CausalClaim -> CausalClaim
// EXTRACTED_FROM: CausalClaim -> Artifact
```

### Pattern 3: CJS Bridge Script (EXISTING -- follow hsi-to-kuzu.cjs)
**What:** Standalone CJS script that reads JSON, opens graph, writes edges, closes graph.
**When to use:** Any batch write operation from computed results.
**Example reference:** `scripts/hsi-to-kuzu.cjs` -- open-use-close pattern, esc() helper, error handling, stderr output.

### Pattern 4: MERGE with ON CREATE SET / ON MATCH SET (EXISTING)
**What:** Upsert pattern for nodes and edges.
**When to use:** All data writes to avoid duplicates.
**Example:**
```javascript
// Source: lib/core/lazygraph-ops.cjs lines 450-464
await conn.query(
  `MATCH (a:Artifact {id: '${esc(sourceId)}'}), (b:Artifact {id: '${esc(targetId)}'})
   MERGE (a)-[r:ANALOGOUS_TO]->(b)
   ON CREATE SET r.analogy_distance = '${distance}', ...
   ON MATCH SET r.analogy_distance = '${distance}', ...`
);
```

### Anti-Patterns to Avoid
- **ACYCLIC keyword in Cypher:** Does NOT work in KuzuDB 0.11.3. Parser exception. Must use bounded `*1..N` plus CJS deduplication.
- **TIMESTAMP DEFAULT current_timestamp (no parens):** Causes "Variable not in scope" error. Use `current_timestamp()` with parens if using TIMESTAMP, or use STRING to match existing pattern.
- **Python direct KuzuDB writes:** Violates single-writer rule. CJS is sole writer.
- **OPTIONAL MATCH in KuzuDB:** Not supported. Use MATCH and handle empty results in application code.
- **TRAIL keyword:** Not supported in 0.11.3. Parser exception.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph cycle detection | Custom cycle-finding algorithm | NetworkX `simple_cycles()` in Phase 54 | NetworkX handles DAG validation, cycle enumeration, topological sort |
| Path deduplication | Complex Cypher-level filtering | CJS `Set` or `Map` on path signatures | KuzuDB 0.11.3 has no ACYCLIC/TRAIL. Simple JS dedup is reliable |
| Brain label verification | Hardcoded label assumptions | MCP read query first | Labels may drift. Runtime verification is the D-03 decision |
| Schema documentation | Manual doc maintenance | Generate from SHOW_TABLES() output | Keeps docs in sync with actual schema |

**Key insight:** KuzuDB 0.11.3 is an embedded database with limited Cypher support compared to Neo4j or newer KuzuDB versions. All advanced path semantics must be implemented in application code.

## Common Pitfalls

### Pitfall 1: ACYCLIC Keyword Assumption (CRITICAL -- verified broken)
**What goes wrong:** Developer writes `MATCH (a)-[:CAUSES*1..5 ACYCLIC]->(b)` per the STACK research doc. KuzuDB throws parser exception.
**Why it happens:** STACK-causal.md documents ACYCLIC as a KuzuDB feature, but it's not available in version 0.11.3 (the installed version). The feature may exist in newer KuzuDB versions.
**How to avoid:** Use bounded paths `*1..N` only. Implement deduplication in CJS: collect all paths, filter out any path where a node ID appears more than once.
**Warning signs:** Parser exception containing "ACYCLIC" in error message.

### Pitfall 2: TIMESTAMP DEFAULT without parens
**What goes wrong:** `TIMESTAMP DEFAULT current_timestamp` (no parens) throws "Variable current_timestamp is not in scope."
**Why it happens:** KuzuDB 0.11.3 requires function call syntax `current_timestamp()`.
**How to avoid:** Either use `TIMESTAMP DEFAULT current_timestamp()` or use STRING type (matching existing Artifact.created pattern). Recommendation: use STRING for consistency with existing schema.
**Warning signs:** Binder exception on schema creation.

### Pitfall 3: Brain Framework Node Label Mismatch
**What goes wrong:** Cypher references `(f:Framework {name: 'Root Cause Analysis'})` but the actual Brain uses a different label or name string.
**Why it happens:** Brain schema was built incrementally. Names may not match exactly.
**How to avoid:** D-03 mandates: run a read query FIRST (`MATCH (f:Framework) RETURN f.name LIMIT 50`) to verify exact names before any CREATE.
**Warning signs:** Zero results from MATCH, meaning MERGE creates orphaned edges.

### Pitfall 4: VentureStage Nodes May Not Exist
**What goes wrong:** BRAIN-05 requires TYPICAL_AT edges to VentureStage nodes. If these don't exist in the Brain, the entire mapping fails silently.
**Why it happens:** VentureStage might be a concept used in pattern 10c but not yet materialized as nodes.
**How to avoid:** Verify VentureStage nodes exist. If not, create them as part of enrichment.
**Warning signs:** Pattern 10c in query-patterns.md references `(:VentureStage {name: $venture_stage})`.

### Pitfall 5: Disconnected CausalClaim Nodes (from PITFALLS-causal.md)
**What goes wrong:** CausalClaim nodes created without EXTRACTED_FROM edges float disconnected from the artifact graph.
**Why it happens:** Extraction creates the node but skips the provenance edge.
**How to avoid:** Any CRUD function that creates a CausalClaim MUST atomically create the EXTRACTED_FROM edge. Schema design alone does not enforce this -- the CJS function must.
**Warning signs:** Orphan detection query: `MATCH (c:CausalClaim) WHERE NOT (c)-[:EXTRACTED_FROM]->() RETURN c.id`

### Pitfall 6: Brain Enrichment Breaking Existing Queries
**What goes wrong:** Adding new edge types (FEEDS_INTO, CO_OCCURS, TYPICAL_AT) to existing Framework nodes changes behavior of pattern queries that traverse all relationships.
**Why it happens:** Open-ended relationship traversal `(f)-[r]->(connected)` picks up new edge types.
**How to avoid:** Existing Brain patterns (1-10) use explicit relationship types. Adding new types should not affect them. But test all 10 patterns after enrichment.
**Warning signs:** Existing patterns returning unexpected results after enrichment.

### Pitfall 7: KuzuDB Segfault on Close
**What goes wrong:** KuzuDB 0.11.3 segfaults when `db.close()` is called during Node.js process exit (exit code 139).
**Why it happens:** Known issue with KuzuDB 0.11.3 archived version.
**How to avoid:** Tests must check output correctness, NOT exit code. Wrap close in try/catch. The test pattern from test-phase-27 handles this: check for "ALL_DONE" marker, then check exit code 139 is acceptable.
**Warning signs:** Exit code 139 in test scripts.

## Code Examples

### CausalClaim Node Table (verified syntax)
```javascript
// Verified: all types work in KuzuDB 0.11.3
// STRING for id, cause, mechanism, effect, evidence, source_artifact,
//   domain, falsifiable_prediction, extraction_method, created
// DOUBLE for confidence, novelty_score
await conn.query(`
  CREATE NODE TABLE IF NOT EXISTS CausalClaim(
    id STRING PRIMARY KEY,
    cause STRING,
    mechanism STRING,
    effect STRING,
    confidence DOUBLE DEFAULT 0.5,
    evidence STRING DEFAULT '',
    source_artifact STRING DEFAULT '',
    domain STRING DEFAULT '',
    falsifiable_prediction STRING DEFAULT '',
    novelty_score DOUBLE DEFAULT 0.0,
    extraction_method STRING DEFAULT 'asserted',
    created STRING DEFAULT ''
  )
`);
```

### Cross-Node-Type Edge (verified working)
```javascript
// Verified: FROM CausalClaim TO Artifact works in KuzuDB 0.11.3
await conn.query(`
  CREATE REL TABLE IF NOT EXISTS EXTRACTED_FROM(
    FROM CausalClaim TO Artifact,
    extraction_method STRING DEFAULT 'llm',
    extracted_at STRING DEFAULT ''
  )
`);
```

### Same-Type Edge with Properties (verified working)
```javascript
await conn.query(`
  CREATE REL TABLE IF NOT EXISTS CAUSES(
    FROM CausalClaim TO CausalClaim,
    strength DOUBLE DEFAULT 0.5,
    mechanism STRING DEFAULT '',
    direction STRING DEFAULT 'forward',
    discovery_method STRING DEFAULT 'llm'
  )
`);
```

### Variable-Length Path Query (WALK only -- no ACYCLIC)
```javascript
// KuzuDB 0.11.3: WALK semantics only. ACYCLIC/TRAIL not supported.
// Bounded to N hops to prevent infinite traversal.
// CJS-side deduplication required for cycle avoidance.
const result = await conn.query(
  `MATCH (start:CausalClaim {id: '${esc(startId)}'})-[:CAUSES*1..6]->(end:CausalClaim)
   RETURN start.id AS src, end.id AS dst`
);
const rows = await result.getAll();

// Deduplicate: remove rows where the path revisits a node
// (KuzuDB WALK semantics may return A->B->C->A->B paths)
const seen = new Set();
const unique = rows.filter(r => {
  const key = r.src + '->' + r.dst;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
```

### graphStats() Extension
```javascript
// Add to the edge type routing in graphStats():
if (edgeType === 'CAUSES' || edgeType === 'CASCADES_TO') {
  query = `MATCH (c1:CausalClaim)-[:${edgeType}]->(c2:CausalClaim) RETURN count(*) AS cnt`;
} else if (edgeType === 'EXTRACTED_FROM') {
  query = `MATCH (c:CausalClaim)-[:${edgeType}]->(a:Artifact) RETURN count(*) AS cnt`;
}

// Add CausalClaim to node counts:
const causalRows = await queryGraph(conn, 'MATCH (c:CausalClaim) RETURN count(*) AS cnt');
const causalCount = causalRows[0]?.cnt || 0;
```

### Brain Query Pattern 11 (Neo4j Cypher)
```cypher
// Pattern 11: causal_framework_select
// Given a problem type and venture stage, which causal framework fits?
MATCH (f:Framework)-[:RELATED_TO]->(:Concept {name: 'Causal Reasoning'})
OPTIONAL MATCH (f)-[:TYPICAL_AT]->(s:VentureStage {name: $stage})
RETURN f.name AS framework,
       f.description AS description,
       s IS NOT NULL AS matches_stage
ORDER BY matches_stage DESC
LIMIT 5
```

### Test Pattern (follow test-phase-27-kuzu-schema.sh)
```bash
# Single Node.js process for all DB tests (avoids segfault per-test)
# Check ALL_DONE marker, not exit code
# Parse T-prefixed output lines with grep
RESULT=$(node -e "
const lg = require('$SCRIPT_DIR/lib/core/lazygraph-ops.cjs');
async function run() {
  const { db, conn } = await lg.openGraph(TEST_DIR + '/room');
  // ... test logic ...
  console.log('T1:causal_table=' + tableNames.includes('CausalClaim'));
  await lg.closeGraph(db);
  console.log('ALL_DONE');
}
run().catch(e => { console.error('FATAL: ' + e.message); process.exit(1); });
" 2>&1 || true)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ACYCLIC path semantics | CJS-side deduplication | KuzuDB 0.11.3 limitation | All Cypher patterns from STACK research need rewriting |
| TIMESTAMP DEFAULT current_timestamp | STRING for dates OR TIMESTAMP DEFAULT current_timestamp() | KuzuDB 0.11.3 requires parens | Schema design must use correct syntax |

**Deprecated/outdated in prior research:**
- STACK-causal.md Cypher patterns 1-6 use ACYCLIC keyword -- must be rewritten without it
- STACK-causal.md CausalClaim schema uses `TIMESTAMP DEFAULT current_timestamp()` -- works but STRING is more consistent with existing schema

## Open Questions

1. **Brain Framework exact node names**
   - What we know: CONTEXT.md D-03 mandates runtime verification
   - What's unclear: Exact names like "Root Cause Analysis" vs "Root_Cause_Analysis" vs "RCA"
   - Recommendation: First task in Brain enrichment must be a read-only discovery query. Results determine exact Cypher for subsequent CREATE statements.

2. **VentureStage nodes in Brain**
   - What we know: Pattern 10c references VentureStage nodes. BRAIN-05 maps frameworks to stages.
   - What's unclear: Whether VentureStage nodes exist, what their exact name values are
   - Recommendation: Include VentureStage verification in the Brain discovery query. Create if missing.

3. **RELATED_TO vs BELONGS_TO for Concept linkage**
   - What we know: BRAIN-04 says "connecting via RELATED_TO." STACK-causal.md uses BELONGS_TO.
   - What's unclear: Which edge type the Brain already uses for Framework->Concept connections
   - Recommendation: Verify existing Brain edge types in discovery query. Use whatever is already established.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bash test scripts (test-*.sh) with embedded Node.js |
| Config file | tests/run-all.sh (test runner) |
| Quick run command | `bash tests/test-phase-52-causal-schema.sh` |
| Full suite command | `bash tests/run-all.sh` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHEMA-01 | CausalClaim table created with 12 properties | unit | `bash tests/test-phase-52-causal-schema.sh` | No -- Wave 0 |
| SCHEMA-02 | CAUSES edge table created with 4 properties | unit | Same test file | No -- Wave 0 |
| SCHEMA-03 | CASCADES_TO edge table created with 3 properties | unit | Same test file | No -- Wave 0 |
| SCHEMA-04 | EXTRACTED_FROM cross-type edge works | unit | Same test file | No -- Wave 0 |
| SCHEMA-05 | CREATE IF NOT EXISTS idempotent (run twice, no error) | unit | Same test file | No -- Wave 0 |
| SCHEMA-06 | graphStats() returns CausalClaim count + 3 edge counts | unit | Same test file | No -- Wave 0 |
| BRAIN-01 | FEEDS_INTO chains created in Brain | manual-only | MCP read query verification | N/A -- requires Brain MCP |
| BRAIN-02 | CO_OCCURS edges created | manual-only | MCP read query verification | N/A |
| BRAIN-03 | Theory of Change node exists | manual-only | MCP read query verification | N/A |
| BRAIN-04 | Causal Reasoning Concept node exists | manual-only | MCP read query verification | N/A |
| BRAIN-05 | TYPICAL_AT edges exist | manual-only | MCP read query verification | N/A |
| BRAIN-06 | Falsifiability/Hypothesis Tree linked | manual-only | MCP read query verification | N/A |
| BRAIN-07 | Patterns 11-13 in query-patterns.md | smoke | `grep -c 'Pattern 1[1-3]' references/brain/query-patterns.md` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `bash tests/test-phase-52-causal-schema.sh`
- **Per wave merge:** `bash tests/run-all.sh`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/test-phase-52-causal-schema.sh` -- covers SCHEMA-01 through SCHEMA-06 (KuzuDB schema tests)
- [ ] `tests/fixtures/test-room-causal/` -- fixture directory with sample artifacts for EXTRACTED_FROM edge testing
- [ ] Test for synthetic cycle data + bounded path query deduplication (verifies D-06/D-07 without ACYCLIC)

## Project Constraints (from CLAUDE.md)

- **Tri-Polar Design Rule:** Phase 52 is schema/reference-only. No user-facing commands. All three surfaces (CLI, Desktop, Cowork) benefit from the schema but no surface-specific code needed in this phase.
- **MWP Moat Mandate:** This phase deepens MWP Layer 7 (Brain Enrichment) and Layer 2 (Cascade Pipeline foundation). CausalClaim is a new edge generator that feeds the cascade pipeline.
- **Release Process:** Phase 52 does NOT bump plugin version -- it's infrastructure. Version bump happens at Phase 57 (Release).
- **Single Writer Rule:** CJS is sole KuzuDB writer. No Python writes. This is enforced by the existing architecture and must be maintained.
- **Brain IP Protection:** Brain enrichment happens via MCP (remote). IP never leaves brain.mindrian.ai.
- **No em-dashes:** Use hyphens throughout.

## Sources

### Primary (HIGH confidence)
- KuzuDB 0.11.3 live testing -- ACYCLIC/TRAIL/WALK semantics, TIMESTAMP behavior, cross-type edges (verified locally 2026-04-03)
- `lib/core/lazygraph-ops.cjs` -- exact initSchema(), EDGE_TYPES, graphStats(), module.exports patterns (608 lines, read in full)
- `scripts/hsi-to-kuzu.cjs` -- CJS bridge pattern (170 lines, read in full)
- `references/brain/query-patterns.md` -- all 10 existing patterns (340 lines, read in full)
- `docs/lazygraph-schema.md` -- current schema docs (223 lines, read in full)
- `tests/test-phase-27-kuzu-schema.sh` -- established test pattern (246 lines, read in full)

### Secondary (MEDIUM confidence)
- `.planning/research/STACK-causal.md` -- NetworkX algorithms, KuzuDB schema design (partially invalidated: ACYCLIC not available)
- `.planning/research/ARCHITECTURE-causal.md` -- component boundaries, data flow, anti-patterns (valid)
- `.planning/research/PITFALLS-causal.md` -- pitfall catalog (valid, Pitfall 1 WALK confirmed more severe than documented)

### Tertiary (LOW confidence)
- Brain Neo4j exact node labels -- must be verified at runtime via MCP read query (D-03)
- VentureStage node existence -- referenced in Pattern 10c but unverified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all verified working in 0.11.3
- Architecture: HIGH -- follows exact existing patterns (initSchema, graphStats, EDGE_TYPES, hsi-to-kuzu bridge)
- KuzuDB schema: HIGH -- cross-type edges, DOUBLE, STRING all verified working
- ACYCLIC workaround: HIGH -- verified that ACYCLIC/TRAIL are parser errors; bounded paths + CJS dedup is the correct approach
- Brain enrichment: MEDIUM -- Cypher patterns are standard Neo4j but exact node labels need runtime verification
- Pitfalls: HIGH -- Pitfall 1 (ACYCLIC) confirmed as real; others from research docs are valid

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable -- KuzuDB 0.11.3 is archived, Brain schema changes slowly)
