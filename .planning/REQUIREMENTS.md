# Requirements: MindrianOS v1.9.0 Whitespace Mapping Power Tool

**Defined:** 2026-04-08
**Core Value:** Detect what's MISSING in a venture's understanding using methodology-aware embedding-space gap detection -- not just what connects (HSI) or what's bottlenecked (RS), but what nobody has thought of yet

## v1.9.0 Requirements

### Embedding & Detection Engine

- [x] **EMBED-01**: Room artifacts embedded using BAAI/llm-embedder (768-dim) via sentence-transformers, with MiniLM fallback for Tier 0
- [x] **EMBED-02**: Brain methodology/framework descriptions embedded as consensus baseline ("semantic universe") -- cached locally as JSON
- [ ] **EMBED-03**: Density estimation on UMAP-reduced embeddings (768d -> 15d) using KDE to identify low-density whitespace regions
- [ ] **EMBED-04**: Gap detection identifies Brain-covered regions with zero room artifact coverage -- ranked by strategic importance
- [ ] **EMBED-05**: External corpus mode queries Semantic Scholar API and/or patent databases, embeds results into same semantic space for cross-domain whitespace detection

### Interpretation & Strategy Layer (The Moat)

- [ ] **INTERP-01**: Each whitespace zone classified by problem type (Ill-Defined / Well-Defined / Wicked / Un-Defined) using Brain's problem taxonomy and nearest framework context
- [ ] **INTERP-02**: Framework chain selection uses Brain's FEEDS_INTO edges and effectiveness scores to sequence exploration methodology for each classified gap
- [x] **INTERP-03**: Hypothesis generation runs THROUGH the selected framework chain -- Larry generates hypotheses contextualized by the methodology, not generic prompting
- [ ] **INTERP-04**: TopicForest hierarchical gap tree built from room + Brain embeddings using agglomerative clustering with binary partitioning and recursive Claude labeling -- sparse branches = whitespace zones at multiple granularity levels

### Pipeline Integration (Discovery Cycle)

- [ ] **PIPE-01**: HSI -> Whitespace integration: after HSI finds surprising artifact pairs, whitespace maps what's BETWEEN them (the missing connecting artifact)
- [ ] **PIPE-02**: RS -> Whitespace integration: after RS finds bottleneck section, whitespace maps empty territory DOWNSTREAM of each bottleneck
- [ ] **PIPE-03**: Analogy -> Whitespace integration: after analogy engine maps cross-domain, whitespace identifies where causal/structural transfer hasn't been articulated
- [ ] **PIPE-04**: Discovery Cycle automation: HSI -> Whitespace -> RS -> Analogy chained in sequence, each feeding the next, on post-write hook or /mos:whitespace command

### Brain Whitespace Intelligence (Learning Loop)

- [ ] **BRAIN-01**: Whitespace pattern data written to Neo4j Brain -- WhitespaceZone nodes linked to Framework chains that explored them
- [ ] **BRAIN-02**: Cross-room whitespace patterns tracked in Brain (anonymized) -- Brain learns which gap types are real opportunities vs noise across all users
- [ ] **BRAIN-03**: TYPICAL_WHITESPACE edges connecting ProblemType -> common whitespace patterns discovered across rooms
- [ ] **BRAIN-04**: Brain query patterns for whitespace intelligence -- "what gaps did similar ventures find?" and "which framework chains resolved similar whitespace?"

### Output & Visualization

- [ ] **OUT-01**: /mos:whitespace command with subcommands: map, analyze, hypothesis, tree, score, external, compare
- [ ] **OUT-02**: Whitespace visualization in De Stijl dashboard -- D3.js density map (UMAP 2D scatter + KDE contours) and TopicForest tree overlay
- [x] **OUT-03**: KuzuDB WhitespaceZone nodes storing density_score, nearest_frameworks, hypothesis, strategic_rank, problem_type, exploration_status
- [ ] **OUT-04**: Every filed artifact gets a novelty score (embedding distance from Brain consensus) -- replaces Jaccard-based scoring
- [ ] **OUT-05**: Per-section WHITESPACE.md files written to each room section folder -- small ICM-native context files showing detected gaps relevant to THAT section, updated on each whitespace run

## Future Requirements

None deferred -- full scope selected.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom embedding model training | Using pre-trained llm-embedder; fine-tuning is a separate research effort |
| Real-time patent monitoring | API polling adds infrastructure complexity; on-demand query is sufficient for v1.9.0 |
| Multi-language embedding (Hebrew/Arabic) | llm-embedder is English-focused; multilingual (BAAI/bge-m3) deferred to future |
| Whitespace-as-a-service (paid MCP) | Business model decision not committed; architecture should support it but not build the billing |
| Drug discovery / biomedical vertical | Domain-agnostic architecture supports it but no domain-specific tuning in this milestone |
| Innovation Authority / TTO integration | National-scale deployment is a separate initiative; architecture enables but doesn't target |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| EMBED-01 | Phase 60 | Complete |
| EMBED-02 | Phase 60 | Complete |
| EMBED-03 | Phase 61 | Pending |
| EMBED-04 | Phase 61 | Pending |
| EMBED-05 | Phase 66 | Pending |
| INTERP-01 | Phase 62 | Pending |
| INTERP-02 | Phase 62 | Pending |
| INTERP-03 | Phase 62 | Complete |
| INTERP-04 | Phase 63 | Pending |
| PIPE-01 | Phase 64 | Pending |
| PIPE-02 | Phase 64 | Pending |
| PIPE-03 | Phase 64 | Pending |
| PIPE-04 | Phase 64 | Pending |
| BRAIN-01 | Phase 65 | Pending |
| BRAIN-02 | Phase 65 | Pending |
| BRAIN-03 | Phase 65 | Pending |
| BRAIN-04 | Phase 65 | Pending |
| OUT-01 | Phase 66 | Pending |
| OUT-02 | Phase 66 | Pending |
| OUT-03 | Phase 61 | Complete |
| OUT-04 | Phase 61 | Pending |
| OUT-05 | Phase 61 | Pending |

**Coverage:**
- v1.9.0 requirements: 22 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-04-08*
*Last updated: 2026-04-08 after roadmap creation*
