# Phase 52: Causal Schema + Brain Enrichment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 52-causal-schema-brain-enrichment
**Areas discussed:** CausalClaim node properties, Brain enrichment scope, Confidence scoring model, ACYCLIC testing strategy

---

## CausalClaim Node Properties

| Option | Description | Selected |
|--------|-------------|----------|
| Full (12 properties) | Store everything upfront: id, cause, mechanism, effect, confidence, evidence, source_artifact, domain, falsifiable_prediction, novelty_score, extraction_method, created | ✓ |
| Core + derived (8 stored, 4 derived) | Store 8, derive evidence/source_artifact from edges, novelty from topology, prediction from REGISTRY.json | |
| Minimal (6 essential) | id, cause, mechanism, effect, confidence, created. Everything else in edges/files. | |

**User's choice:** Full (12 properties)
**Notes:** Store everything on the node for fast queries without joins.

---

## Brain Enrichment Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full enrichment | Wire edges + create Theory of Change + Causal Reasoning parent + link Falsifiability. Verify labels first. | ✓ |
| Wiring only | Just add edges between existing nodes. No new nodes. Safer. | |
| Script + verify | Generate Cypher script, run interactively. | |

**User's choice:** Full enrichment
**Notes:** Verify Brain node labels via MCP read query before any CREATE statements.

---

## Confidence Scoring Model

| Option | Description | Selected |
|--------|-------------|----------|
| Static by method + prediction updates | observed=0.7, asserted=0.5, inferred=0.3. Only changes on prediction resolution. | |
| Static + edge-driven decay | Same initial + CONTRADICTS/INVALIDATES auto-reduce. Cascade uses multiplicative decay. | |
| Dynamic with all signals | Initial + predictions + contradiction/invalidation + age decay + cross-reference boost. | ✓ |

**User's choice:** Dynamic with all signals
**Notes:** Most sophisticated. Formula defined in Phase 54, but schema must support all signal types from day one.

---

## ACYCLIC Testing Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Synthetic test data in schema phase | Create 5-10 test nodes with cycles, validate, delete. | |
| Test with real room data | Wait until Phase 53 extraction. Risk: wasted work if ACYCLIC fails. | |
| Both -- synthetic now, real later | Belt and suspenders. Synthetic in 52, re-test with real data in 53. | ✓ |

**User's choice:** Both -- synthetic now, real later
**Notes:** Catches the #1 critical pitfall early while still validating with real data.

---

## Additional Discussion: Pinecone RAG Role

User asked how Pinecone RAG fits the causal layer. Clarified:
- Pinecone (1,427 Brain embeddings) serves as teaching examples retriever
- Brain query Pattern 12 uses Pinecone for semantic causal pattern matching
- Novelty scoring would embed CausalClaim text and compare against Pinecone (deferred to v1.8.0+)

## Additional Discussion: Research-Backed Examples (ENGINE-09)

User described MindrianV2 "Examples" button: gave users examples from PWS teaching materials + online, contextual, at every point. Proposed for v1.7.0:
- Analogy engine generates structural search queries from causal graph
- Two sources: Brain/Pinecone (teaching examples) + Tavily (recent real-world)
- Relevance determined by causal graph topology, not keywords
- Added as ENGINE-09, mapped to Phase 55

**Critical user note:** "It has to be wired to the relevancy according to the graph we made here." The graph IS the relevance engine.

## Claude's Discretion

- KuzuDB property types, CREATE TABLE syntax, default values
- Brain enrichment Cypher execution order
- Order of statements in initSchema()

## Deferred Ideas

- ENGINE-09: Research-backed examples via analogy engine as research orchestrator (Phase 55)
- Novelty scoring via Pinecone embeddings (v1.8.0+)
