# Requirements: MindrianOS v1.7.0 Causal Reasoning Layer

**Defined:** 2026-04-05
**Core Value:** Larry can trace cause-effect chains, surface hidden bottlenecks, and generate falsifiable predictions -- enabling "because...because...because" reasoning across the Data Room

## v1.7.0 Requirements

### Schema & Storage

- [ ] **SCHEMA-01**: CausalClaim node type in KuzuDB with properties: id, cause, mechanism, effect, confidence, evidence, source_artifact, domain, falsifiable_prediction, novelty_score, extraction_method, created
- [ ] **SCHEMA-02**: CAUSES edge type (CausalClaim -> CausalClaim) with strength, mechanism, direction, discovery_method
- [ ] **SCHEMA-03**: CASCADES_TO edge type (CausalClaim -> CausalClaim) with cascade_type, severity, path_length
- [ ] **SCHEMA-04**: EXTRACTED_FROM edge type (CausalClaim -> Artifact) linking claims to source artifacts
- [ ] **SCHEMA-05**: All schema additions use CREATE IF NOT EXISTS (idempotent, safe for existing .lazygraph databases)
- [ ] **SCHEMA-06**: graphStats() includes CausalClaim count and causal edge counts

### Causal Extraction

- [ ] **EXTRACT-01**: Larry can extract cause/mechanism/effect triples from room artifacts via /mos:causal extract
- [ ] **EXTRACT-02**: Every extracted claim links to its source artifact via EXTRACTED_FROM edge (provenance)
- [ ] **EXTRACT-03**: Confidence scoring varies by extraction method: observed=0.7, asserted=0.5, inferred=0.3
- [ ] **EXTRACT-04**: Domain classification for claims: materials, business, competitive, financial, team, legal, general
- [ ] **EXTRACT-05**: Max 5 claims per artifact to prevent graph pollution
- [ ] **EXTRACT-06**: Three Gaps enforcement: every claim requires explicit mechanism and falsifiable prediction

### Graph Engine

- [ ] **ENGINE-01**: Chain traversal via NetworkX all_simple_paths -- trace "because...because...because" chains up to 6 hops
- [ ] **ENGINE-02**: Cascade simulation via NetworkX descendants -- "if X is wrong, what falls?" with confidence decay per hop (multiplicative)
- [ ] **ENGINE-03**: Bottleneck detection via betweenness centrality -- surface high-centrality nodes with low out-degree (hidden blockers)
- [ ] **ENGINE-04**: Contradiction detection via cycle finding -- catch circular reasoning in CAUSES subgraph
- [ ] **ENGINE-05**: Cross-reference linking CausalClaims to HSI_CONNECTION edges (which HSI pairs have causal explanations?)
- [ ] **ENGINE-06**: Cross-reference linking CausalClaims to REVERSE_SALIENT edges (which bottlenecks have causal chains running through them?)
- [ ] **ENGINE-07**: Cross-reference linking CausalClaims to ANALOGOUS_TO edges (which analogies match the causal structure of a bottleneck?)
- [ ] **ENGINE-08**: Inversion protocol -- negate a claim, simulate what changes in the graph (node removal + path recomputation)
- [ ] **ENGINE-09**: When an opportunity/prediction is identified, the analogy engine generates structural search queries and research agents find examples -- Brain/Pinecone for PWS teaching examples + Tavily for chronologically recent real-world examples. Relevance determined by causal graph topology.

### Prediction & Opportunity Tracking

- [ ] **PREDICT-01**: /mos:causal predict generates falsifiable predictions from causal claims with deadline and resolution criteria
- [ ] **PREDICT-02**: REGISTRY.json at room/.predictions/ stores predictions with lifecycle: pending -> confirmed/refuted/expired
- [ ] **PREDICT-03**: Predictions typed by opportunity category: business, research, new_business_model, funding, competitive, technical
- [ ] **PREDICT-04**: Larry proactively prompts for prediction resolution when deadline passes (via session-start or every 5th session)
- [ ] **PREDICT-05**: Resolved predictions propagate confidence updates back to source CausalClaim nodes in KuzuDB
- [ ] **PREDICT-06**: Prediction summary view showing hit rate, category distribution, and overdue count

### Brain Enrichment (Neo4j)

- [ ] **BRAIN-01**: Wire FEEDS_INTO chains: Root Cause Analysis -> Systems Thinking -> Causal Loop Diagrams -> Scenario Analysis; Systems Thinking -> Reverse Salient Analysis
- [ ] **BRAIN-02**: Add CO_OCCURS edges: Root Cause Analysis <-> Six Thinking Hats; Systems Thinking <-> Reverse Salient Analysis; Cynefin <-> Root Cause Analysis
- [ ] **BRAIN-03**: Create "Theory of Change" Framework node with phases, techniques, problem-type mappings (forward causal reasoning)
- [ ] **BRAIN-04**: Create "Causal Reasoning" parent Concept node connecting the framework family via RELATED_TO
- [ ] **BRAIN-05**: Add TYPICAL_AT venture stage mappings: Root Cause -> Opportunity Identified; Systems Thinking -> Pre-Opportunity; Reverse Salient -> Pre-Opportunity; Theory of Change -> Problem Validation
- [ ] **BRAIN-06**: Link Falsifiability and Hypothesis Tree to causal frameworks
- [ ] **BRAIN-07**: Add Brain query patterns 11-13: causal_framework_select, causal_pattern_match, causal_contradiction_resolve

### Post-Write Integration

- [ ] **HOOK-01**: Causal candidate flagging runs after HSI + RS in post-write cascade (background, async)
- [ ] **HOOK-02**: Lightweight heuristic flagging (regex for causal keywords) produces .causal-candidates.json
- [ ] **HOOK-03**: CJS bridge (causal-to-kuzu.cjs) writes flagged candidates to KuzuDB when /mos:causal extract confirms them
- [ ] **HOOK-04**: Cross-reference step runs after causal claims are written, linking to existing HSI/RS/Analogy edges

### Command & Larry Wiring

- [ ] **CMD-01**: /mos:causal command with 3 subcommands: extract (run extraction), trace (chain + cascade + bottleneck + contradiction), predict (generate + track predictions)
- [ ] **CMD-02**: Brain causal directives document (references/brain/causal-directives.md) with Three Gaps framework
- [ ] **CMD-03**: Brain query patterns 11-13 added to references/brain/query-patterns.md
- [ ] **CMD-04**: Larry personality JTBD suggestions for causal commands: "When assumptions stack 3-deep, /mos:causal trace cascade"
- [ ] **CMD-05**: Enhanced room-proactive: surface discoveries when graph has converging causal + HSI + RS + analogy edges
- [ ] **CMD-06**: Causal schema reference document (references/causal/causal-schema.md) for Cypher query context

### Release

- [ ] **REL-01**: CHANGELOG.md v1.7.0 entry with onboarding steps
- [ ] **REL-02**: plugin.json version bumped to 1.7.0
- [ ] **REL-03**: docs/lazygraph-schema.md updated with causal section

## Future Requirements (v1.8.0+)

- Cross-room causal linking (requires room federation)
- Causal claim visualization in De Stijl dashboard (add edge styling to existing Cytoscape.js)
- Prediction calibration dashboard (needs 50+ resolved predictions)
- Novelty scoring via embeddings (replace Jaccard with semantic distance)
- Full pipeline cycle: HSI seeds Causal seeds RS seeds Analogy seeds Causal (feedback loop)

## Out of Scope

| Feature | Reason |
|---------|--------|
| DoWhy / causal-learn / pgmpy integration | Wrong data type -- require tabular DataFrames, our data is text/graph |
| Bayesian network structure learning | Requires calibrated priors and observational data we don't have |
| Visual causal loop diagram editor | Heavy dependency, existing Cytoscape.js sufficient, CLD research shows >12 elements overwhelm users |
| Quantitative simulation (Vensim-style) | Research tool, not venture tool. Larry narrates cascades in natural language. |
| Automated extraction without human review | LLM hallucination risk poisons graph. Larry proposes, user confirms. |
| Prediction markets / betting | Over-engineering. Simple confirm/refute lifecycle is sufficient. |
| Python KuzuDB writes | Violates single-writer rule. CJS is sole KuzuDB writer. Python outputs JSON only. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCHEMA-01 | Phase 52 | Pending |
| SCHEMA-02 | Phase 52 | Pending |
| SCHEMA-03 | Phase 52 | Pending |
| SCHEMA-04 | Phase 52 | Pending |
| SCHEMA-05 | Phase 52 | Pending |
| SCHEMA-06 | Phase 52 | Pending |
| EXTRACT-01 | Phase 53 | Pending |
| EXTRACT-02 | Phase 53 | Pending |
| EXTRACT-03 | Phase 53 | Pending |
| EXTRACT-04 | Phase 53 | Pending |
| EXTRACT-05 | Phase 53 | Pending |
| EXTRACT-06 | Phase 53 | Pending |
| ENGINE-01 | Phase 54 | Pending |
| ENGINE-02 | Phase 54 | Pending |
| ENGINE-03 | Phase 54 | Pending |
| ENGINE-04 | Phase 54 | Pending |
| ENGINE-05 | Phase 54 | Pending |
| ENGINE-06 | Phase 54 | Pending |
| ENGINE-07 | Phase 54 | Pending |
| ENGINE-08 | Phase 54 | Pending |
| ENGINE-09 | Phase 55 | Pending |
| HOOK-01 | Phase 55 | Pending |
| HOOK-02 | Phase 55 | Pending |
| HOOK-03 | Phase 55 | Pending |
| HOOK-04 | Phase 55 | Pending |
| PREDICT-01 | Phase 55 | Pending |
| PREDICT-02 | Phase 55 | Pending |
| PREDICT-03 | Phase 55 | Pending |
| PREDICT-04 | Phase 55 | Pending |
| PREDICT-05 | Phase 55 | Pending |
| PREDICT-06 | Phase 55 | Pending |
| BRAIN-01 | Phase 52 | Pending |
| BRAIN-02 | Phase 52 | Pending |
| BRAIN-03 | Phase 52 | Pending |
| BRAIN-04 | Phase 52 | Pending |
| BRAIN-05 | Phase 52 | Pending |
| BRAIN-06 | Phase 52 | Pending |
| BRAIN-07 | Phase 52 | Pending |
| CMD-01 | Phase 56 | Pending |
| CMD-02 | Phase 56 | Pending |
| CMD-03 | Phase 56 | Pending |
| CMD-04 | Phase 56 | Pending |
| CMD-05 | Phase 56 | Pending |
| CMD-06 | Phase 56 | Pending |
| REL-01 | Phase 57 | Pending |
| REL-02 | Phase 57 | Pending |
| REL-03 | Phase 57 | Pending |

**Coverage:**
- v1.7.0 requirements: 40 total
- Mapped to phases: 40
- Unmapped: 0

---
*Requirements defined: 2026-04-05*
*Last updated: 2026-04-03 after roadmap creation (all 39 requirements mapped to Phases 52-57)*
