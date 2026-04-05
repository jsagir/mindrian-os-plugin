# Feature Landscape: v1.7.0 Causal Reasoning Layer

**Domain:** Causal graph engine for MindrianOS plugin
**Researched:** 2026-04-03

## Table Stakes

Features the causal layer must have to be useful. Missing = causal reasoning feels broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Causal claim extraction from artifacts | Without this, no causal graph exists | Med | LLM-based, Larry extracts cause/mechanism/effect triples |
| Chain traversal ("because...because...because") | Core promise of v1.7.0 | Low | nx.all_simple_paths, cutoff=6 |
| Cascade simulation ("if X is wrong, what falls?") | Users need to see downstream impact | Low | nx.descendants on CAUSES/CASCADES_TO edges |
| Provenance tracking (claim -> source artifact) | Users must trust causal claims have evidence | Low | EXTRACTED_FROM edge, simple Cypher join |
| KuzuDB persistence | Claims survive session restarts | Low | CausalClaim node table, standard schema extension |

## Differentiators

Features that make v1.7.0 genuinely novel vs. any other AI assistant.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Betweenness centrality bottleneck detection | Surfaces hidden bottleneck assumptions nobody asked about (Hughes reverse salient) | Med | nx.betweenness_centrality + Brain framework selection |
| Contradiction detection via cycle finding | Catches circular reasoning: "A causes B causes C causes A" | Low | nx.simple_cycles on CAUSES subgraph |
| Cross-domain discovery (Causal x HSI x RS) | Finds where causal claims from different sections connect through HSI surprise | High | Multi-hop Cypher joining 3 edge types |
| Falsifiable prediction generation | Turns vague claims into testable "if X then Y by Z date" statements | Med | Larry LLM + Three Gaps framework |
| Closed-loop prediction tracking | Tracks prediction accuracy over time, adjusts claim confidence | Med | REGISTRY.json + confidence propagation |
| Inversion protocol ("what if the opposite?") | Stress-tests assumptions by simulating claim removal | Med | NetworkX graph copy + node removal + path checking |
| Brain causal framework selection | Automatically picks the right causal framework for the problem type | Low | New Brain query patterns 11-13 |

## Anti-Features

Features to explicitly NOT build in v1.7.0.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Automated causal discovery from text (no human) | LLM extraction is unreliable without human review. False causal claims poison the graph. | Larry proposes, user confirms. Every extraction is a suggestion. |
| Bayesian network structure learning | Requires tabular data (DoWhy, pgmpy). Our data is text/graph. Massive dependency. | Use graph topology (NetworkX) for structural reasoning, not statistical causal inference. |
| Real-time causal graph visualization | Heavy dependency (D3/Plotly/Graphviz). Existing Cytoscape.js dashboard handles this. | Add causal layer to existing De Stijl dashboard as edge styling. |
| Causal claim editing in KuzuDB | Users should not directly edit graph state. | Edit via `/mos:causal` command which validates and maintains consistency. |
| Probability propagation (Bayesian updating on graph) | Requires calibrated priors we don't have. Over-engineering for v1.7.0. | Simple confidence scores (0-1) on claims, adjusted by prediction outcomes. |
| Cross-room causal linking | Rooms are independent. Cross-room linking breaks room isolation. | Defer to v2.0+ when room federation is designed. |

## Feature Dependencies

```
KuzuDB Schema Extension (CausalClaim + edges)
  |
  +--> Causal Claim Extraction (needs schema to store claims)
  |      |
  |      +--> Chain Traversal (needs claims in graph)
  |      +--> Cascade Simulation (needs claims in graph)
  |      +--> Bottleneck Detection (needs claims in graph)
  |      +--> Contradiction Detection (needs claims in graph)
  |      +--> Cross-Domain Discovery (needs claims + existing HSI/RS edges)
  |
  +--> Prediction Generation (needs claims to derive predictions from)
         |
         +--> Prediction Registry (needs predictions to track)
               |
               +--> Closed-Loop Learning (needs resolved predictions)

Brain Enrichment (independent, can run in parallel)
  |
  +--> Brain Framework Selection (needs FEEDS_INTO, CO_OCCURS, TYPICAL_AT)
  +--> Larry Causal Directives (needs Brain query patterns 11-13)
```

## MVP Recommendation

Prioritize:
1. KuzuDB schema extension (everything depends on it)
2. Causal claim extraction via Larry (populates the graph)
3. Chain traversal + cascade simulation (core "because...because" promise)
4. Bottleneck detection (key differentiator, low marginal effort with NetworkX)
5. Brain enrichment (independent, enriches Larry's framework selection)

Defer:
- Cross-domain discovery: High complexity, needs dense graph to be valuable. Wait until rooms have 50+ causal claims.
- Closed-loop learning: Needs time to accumulate predictions. Design the schema now, implement propagation later.
- Inversion protocol: Nice-to-have, not core. Can be a v1.7.1 addition.
