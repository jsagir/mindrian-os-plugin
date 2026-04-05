# Research Summary: v1.7.0 Causal Reasoning Layer

**Domain:** Causal graph engine for MindrianOS plugin
**Researched:** 2026-04-03
**Overall confidence:** HIGH

## Executive Summary

The causal reasoning layer requires zero new dependencies. NetworkX 3.6.1 (already installed) provides every graph algorithm needed for chain traversal, cascade simulation, bottleneck detection via betweenness centrality, contradiction detection via cycle finding, and topological ordering. KuzuDB 0.11.3 (already installed) supports TIMESTAMP types with `current_timestamp()` defaults, variable-length path queries with Kleene star syntax, and ACYCLIC path semantics -- all essential for temporal causal graph queries.

The architecture follows the established Python -> JSON -> CJS -> KuzuDB bridge pattern. A new `compute-causal.py` script reads causal graph data exported from KuzuDB, runs NetworkX algorithms (betweenness centrality, cycle detection, cascade analysis), and writes results back as JSON for the CJS bridge to ingest. This slots into the existing post-write cascade after HSI and reverse salient detection.

For the Brain graph enrichment (Layer 1), the work is pure Cypher: creating FEEDS_INTO chains between existing Framework nodes, CO_OCCURS edges for commonly paired frameworks, TYPICAL_AT edges for venture stage mappings, and two new nodes (Theory of Change framework, Causal Reasoning parent concept). No schema migration needed -- just CREATE statements against existing node types.

The prediction tracking system uses a JSON registry file at `room/.predictions/REGISTRY.json`, following the same pattern as `.hsi-results.json`. The closed-loop learning mechanism propagates prediction outcomes back to CausalClaim confidence scores in KuzuDB, creating Tetlock-style calibration over time.

## Key Findings

**Stack:** Zero new dependencies. NetworkX 3.6.1 + KuzuDB 0.11.3 + existing Python/CJS bridge = complete causal engine.
**Architecture:** CausalClaim as new KuzuDB node type, bridged to Artifact via EXTRACTED_FROM edges. Causal graph is a semantic layer ON TOP of the existing artifact graph.
**Critical pitfall:** KuzuDB's Kleene star defaults to WALK semantics (nodes can be revisited). Causal queries MUST specify ACYCLIC to prevent infinite loops in cyclic causal graphs.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **KuzuDB Schema Extension** - Add CausalClaim node + 3 edge types to lazygraph-ops.cjs initSchema
   - Addresses: CausalClaim storage, CAUSES/CASCADES_TO/EXTRACTED_FROM edges
   - Avoids: Schema migration issues by using CREATE IF NOT EXISTS (idempotent)

2. **Brain Graph Enrichment** - One-time Cypher migration against Neo4j Aura
   - Addresses: FEEDS_INTO chains, CO_OCCURS, TYPICAL_AT, Theory of Change, Causal Reasoning concept
   - Avoids: Breaking existing Brain queries by only adding new edges/nodes

3. **Causal Python Engine** - compute-causal.py with NetworkX algorithms
   - Addresses: Chain traversal, cascade simulation, bottleneck detection, contradiction detection
   - Avoids: Dependency bloat by using only NetworkX (already installed)

4. **Post-Write Integration** - Hook cascade extension + CJS bridge functions
   - Addresses: Automatic causal candidate flagging, cross-reference with HSI/RS
   - Avoids: Monolithic orchestrator by extending existing cascade pattern

5. **Prediction Registry** - JSON schema + closed-loop learning
   - Addresses: Falsifiable prediction tracking, confidence calibration
   - Avoids: Over-engineering by using JSON file (not database) for prediction state

6. **Command + Larry Wiring** - /mos:causal command, personality JTBD, Brain directives
   - Addresses: User-facing causal reasoning, Three Gaps enforcement
   - Avoids: Exposing graph complexity by routing through Larry's natural language

**Phase ordering rationale:**
- Schema first because everything else writes to it
- Brain enrichment second because it's independent and informs Larry's framework selection
- Python engine third because it needs the schema to read/write
- Post-write fourth because it chains HSI -> RS -> Causal (needs engine)
- Predictions fifth because it needs the engine to generate them
- Command/Larry last because it's the user-facing integration of everything above

**Research flags for phases:**
- Phase 1 (Schema): Standard KuzuDB -- unlikely to need deeper research
- Phase 2 (Brain): May need Brain schema verification -- confirm Framework/Concept node labels match
- Phase 3 (Engine): Standard NetworkX -- unlikely to need research. Cutoff parameter for all_simple_paths needs tuning (start with 6)
- Phase 5 (Predictions): JSON registry design is straightforward but closed-loop confidence propagation needs careful testing

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (NetworkX) | HIGH | Verified locally, all functions present in 3.6.1 |
| Stack (KuzuDB schema) | HIGH | TIMESTAMP, Kleene star, ACYCLIC confirmed in docs |
| Brain enrichment | MEDIUM | Cypher patterns are standard but Brain schema labels need verification |
| Prediction registry | HIGH | JSON schema is well-understood, follows existing patterns |
| Visualization | HIGH | No new library needed, existing Cytoscape.js + ASCII sufficient |

## Gaps to Address

- Brain Framework/Concept node labels: need to confirm exact label names in Neo4j Aura before running enrichment queries
- KuzuDB 0.11.3 ACYCLIC semantic: documented but should be tested with the specific multi-table pattern (CausalClaim -> Artifact -> CausalClaim crosses node types)
- NetworkX cutoff parameter for all_simple_paths: 6 is a starting guess, may need adjustment based on real graph density
- Prediction deadline notification mechanism: not researched (how does Larry know when to prompt for resolution?)
