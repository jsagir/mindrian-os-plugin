# Phase 52: Causal Schema + Brain Enrichment - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend KuzuDB with CausalClaim node type and 3 causal edge types (CAUSES, CASCADES_TO, EXTRACTED_FROM). Wire the Brain's causal framework family with traversable FEEDS_INTO/CO_OCCURS/TYPICAL_AT edges. Create Theory of Change Framework node and Causal Reasoning parent Concept node. Add Brain query patterns 11-13 for causal reasoning.

Two parallel targets: KuzuDB (local) and Neo4j Aura (remote Brain via MCP).

</domain>

<decisions>
## Implementation Decisions

### CausalClaim Node Properties
- **D-01:** Full 12 properties stored on node: id, cause, mechanism, effect, confidence, evidence, source_artifact, domain, falsifiable_prediction, novelty_score, extraction_method, created. No derived properties -- store everything for fast queries without joins.

### Brain Enrichment Scope
- **D-02:** Full enrichment -- wire FEEDS_INTO chains + CO_OCCURS edges + TYPICAL_AT stage mappings + create Theory of Change Framework node + Causal Reasoning parent Concept node + link Falsifiability/Hypothesis Tree to causal frameworks.
- **D-03:** Verify Brain node labels via MCP read query BEFORE running any CREATE statements. The Brain audit showed Framework, Concept, DictionaryTerm, and other labels -- exact names must be confirmed at runtime.

### Confidence Scoring Model
- **D-04:** Dynamic with all signals: initial score by extraction method (observed=0.7, asserted=0.5, inferred=0.3) + prediction outcomes + contradiction/invalidation edge effects + age decay + cross-reference boost from HSI/RS/Analogy edges.
- **D-05:** The confidence update formula will be defined in Phase 54 (Graph Engine), but the schema must support storing all signal types from day one. Store confidence as DOUBLE on CausalClaim node and on CAUSES edge (strength property).

### ACYCLIC Testing Strategy
- **D-06:** Belt and suspenders -- create synthetic test data (5-10 CausalClaim nodes with intentional cycles) in Phase 52 to validate ACYCLIC path queries work correctly. Re-test with real extracted data in Phase 53. Delete synthetic test data after validation.
- **D-07:** All variable-length path queries on CAUSES edges MUST use ACYCLIC semantic. WALK semantic reserved only for explicit cycle detection queries. This is a code review rule.

### Schema Evolution
- **D-08:** Follow existing pattern exactly: add to EDGE_TYPES array, add CREATE IF NOT EXISTS statements in initSchema(), extend graphStats() with CausalClaim-specific queries using appropriate FROM/TO node type routing.

### Claude's Discretion
- KuzuDB property types (STRING vs DOUBLE vs INT64) -- follow existing patterns in lazygraph-ops.cjs
- Exact CREATE TABLE syntax and default values
- Order of statements in initSchema()
- Brain enrichment Cypher execution order

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### KuzuDB Schema
- `lib/core/lazygraph-ops.cjs` -- Current schema definition (initSchema, EDGE_TYPES, graphStats). THE pattern to follow for adding CausalClaim + edges.
- `.planning/research/STACK-causal.md` -- KuzuDB Cypher patterns, ACYCLIC semantics, TIMESTAMP support details.
- `.planning/research/ARCHITECTURE-causal.md` -- Component boundaries, data flow, anti-patterns (especially Anti-Pattern 2: Python Direct KuzuDB Writes).

### Brain Enrichment
- `references/brain/query-patterns.md` -- Existing patterns 1-10. Patterns 11-13 to be added here.
- `.planning/research/SUMMARY-causal.md` -- Brain enrichment scope, suggested phase ordering.

### Research & Pitfalls
- `.planning/research/PITFALLS-causal.md` -- Pitfall 1 (WALK semantics), Pitfall 5 (disconnected graph), Pitfall 7 (Brain enrichment breaking existing queries). All apply directly to Phase 52.
- `.planning/research/FEATURES-causal.md` -- Feature dependencies showing schema as foundation for everything else.

### Consultant Session (reference only, NOT merged)
- Branch `claude/plugin-consultant-review-6MYsc` on remote -- contains causal schema design that informed but does NOT define v1.7.0. The consultant's CausalClaim schema has useful field definitions but the implementation approach was rejected (monolithic orchestrator, regex extraction).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lazygraph-ops.cjs` initSchema() pattern: CREATE NODE TABLE IF NOT EXISTS / CREATE REL TABLE IF NOT EXISTS -- exact pattern to follow
- EDGE_TYPES array on line 21: append CAUSES, CASCADES_TO, EXTRACTED_FROM
- graphStats() on line 361: add CausalClaim count query + causal edge routing (CausalClaim->CausalClaim for CAUSES/CASCADES_TO, CausalClaim->Artifact for EXTRACTED_FROM)
- `scripts/hsi-to-kuzu.cjs` -- reference for CJS bridge pattern (read JSON, write to KuzuDB)

### Established Patterns
- CJS is sole KuzuDB writer. Python outputs JSON only. (Decision from milestone init)
- All schema changes are idempotent (CREATE IF NOT EXISTS)
- Edge types have different FROM/TO routing in graphStats (Artifact->Artifact, Section->Section, etc.)
- Brain queries use named patterns with $parameter substitution in Cypher templates

### Integration Points
- `initSchema(conn)` -- add CausalClaim table + 3 edge tables
- `EDGE_TYPES` array -- append 3 new types
- `graphStats(conn)` -- add CausalClaim count + edge counts with correct FROM/TO routing
- `references/brain/query-patterns.md` -- append patterns 11, 12, 13
- `module.exports` at end of lazygraph-ops.cjs -- export any new CRUD functions

</code_context>

<specifics>
## Specific Ideas

- Confidence scoring is DYNAMIC with all signals -- schema must support this from day one even though the formula comes in Phase 54
- ACYCLIC is a HARD RULE for all causal chain queries -- enforce via code review comments in Cypher
- Brain label verification must happen BEFORE any write operations -- use MCP read query first
- The causal graph is a semantic layer ON TOP of the artifact graph, bridged by EXTRACTED_FROM edges

</specifics>

<deferred>
## Deferred Ideas

### ENGINE-09: Research-Backed Examples (Phase 55)
When an opportunity/prediction is identified, the analogy engine generates structural search queries. Two sources: (1) Brain/Pinecone finds teaching examples from PWS materials, (2) Tavily finds chronologically recent real-world examples. Both filtered by analogy engine structural match -- relevance determined by causal graph topology, not keywords. Reference: MindrianV2 "Examples" button feature.

**Critical wiring requirement:** Examples must be relevant according to the causal graph structure built in this milestone. The graph IS the relevance engine -- Pinecone and Tavily are search tools, but queries are generated from graph topology (which claims connect, what bottlenecks exist, which analogies match structurally).

### Novelty Scoring via Pinecone Embeddings (v1.8.0+)
Embed CausalClaim text and compare against Brain's Pinecone index. High distance = high novelty ("has anyone thought of this before?"). Deferred because it requires the claims to exist first and enough density to be meaningful.

</deferred>

---

*Phase: 52-causal-schema-brain-enrichment*
*Context gathered: 2026-04-05*
