# Phase 76: Brain Normalization + Wave 1 Algorithms

## Goal

Clean the Brain's LazyGraph noise (62% CO_OCCURS signal loss) and ship 4 novel intelligence metrics that operate on room artifact embeddings with zero new dependencies.

## Depends On

- Phase 60 (embedding infrastructure) -- whitespace-embeddings.json schema
- Phase 65 (brain intelligence layer) -- Brain MCP connection patterns

## Context

The Brain validation (10 Questions for the Brain, 2026-04-09) revealed:
- CO_OCCURS graph has 62% noise (surface-form duplication, file path contamination)
- 280 "The X" / "X" prefix duplicate LazyGraphConcept pairs
- 73 file path strings leaked into concept graph
- Leadership framework cluster has zero FEEDS_INTO to PWS methodology chains
- 20 missing FEEDS_INTO edges discoverable by shared problem-type/venture-stage overlap

Separately, the feasibility assessment identified 12 algorithms; 4 are Wave 1 (zero new deps).

## Tasks

### Task 1: LazyGraph Entity Normalization

| # | Task | Status |
|---|------|--------|
| 1.1 | Scan for exact-lowercase duplicate LazyGraphConcepts | Done (0 found) |
| 1.2 | Merge 280 "The X" / "X" prefix duplicate pairs (keep higher-degree, redirect edges) | Done |
| 1.3 | Delete 73 file path contamination nodes (tightened filter: slash+extension, not "Risk/Reward") | Done |
| 1.4 | Scan for noise nodes (<=2 chars, all-numeric, whitespace-only) | Done (0 found) |
| 1.5 | Scan for CO_OCCURS self-loops | Done (0 found) |
| 1.6 | Document normalization in scripts/brain-normalize-v194.cypher | Done |

### Task 2: Missing FEEDS_INTO Edges

| # | Task | Status |
|---|------|--------|
| 2.1 | Run Q10 discovery query (shared problem types + venture stages, no existing FEEDS_INTO) | Done |
| 2.2 | Add 20 edges at confidence 0.7 (below 0.87 manual average) | Done |
| 2.3 | Wire leadership cluster -> PWS Value Proposition (6 edges) | Done |
| 2.4 | Wire Wicked Problem Detection <-> Systems Thinking / Six Hats (4 edges) | Done |
| 2.5 | Wire Five Practices <-> First Who Then What triangle (4 edges) | Done |

### Task 3: Wave 1 Algorithm Scripts

| # | Task | Status |
|---|------|--------|
| 3.1 | Create compute-blindspot-mass.py (Good-Turing coverage % per section) | Done |
| 3.2 | Create compute-bayesian-surprise.py (leave-one-out cosine shift per artifact) | Done |
| 3.3 | Create compute-element-novelty.py (per-artifact + per-concept novelty scoring) | Done |
| 3.4 | Create compute-disruption-index.py (CD consolidation/disruption classification) | Done |
| 3.5 | Validate all 4 scripts parse (ast.parse) | Done |

## Results

### Brain Before/After

| Metric | Before | After | Delta |
|--------|--------|-------|-------|
| LazyGraphConcepts | 7,931 | 7,578 | -353 |
| CO_OCCURS edges | 122,915 | 119,706 | -3,209 |
| FEEDS_INTO edges | 147 | 167 | +20 |

### Wave 1 Scripts

| Script | Size | Dependencies | Output |
|--------|------|-------------|--------|
| compute-blindspot-mass.py | 6.1KB | re, collections (stdlib only) | .mindrian/blindspot-coverage.json |
| compute-bayesian-surprise.py | 5.4KB | numpy, sklearn.metrics.pairwise | .mindrian/surprise-scores.json |
| compute-element-novelty.py | 8.7KB | numpy, sklearn, sentence-transformers (optional) | .mindrian/element-novelty.json |
| compute-disruption-index.py | 6.7KB | re, collections (stdlib only) | .mindrian/disruption-index.json |

### Algorithm Foundations

| Algorithm | Academic Basis | Adaptation |
|-----------|---------------|------------|
| Good-Turing Coverage | Good (1953), Gale & Sampson (1995) | coverage = 1 - (singletons/N) per room section |
| Bayesian Surprise | Itti & Baldi (2005) | cosine distance proxy for KL divergence between centroids |
| Element Novelty | Yin et al. (2023) | embedding distance from room centroid, TF-IDF element extraction |
| Disruption Index | Funk & Owen-Smith (2017) | concept vocabulary overlap (inspired by, not direct adaptation of CD index) |

## Validation

- Python ast.parse: all 4 scripts pass
- Brain connection: Python neo4j driver, direct Aura access
- Normalization: no legitimate concepts deleted (tightened path filter verified)
- FEEDS_INTO: 0.7 confidence distinguishes algorithmic from manual edges

## Files Changed

- scripts/brain-normalize-v194.cypher (NEW -- normalization documentation)
- scripts/compute-blindspot-mass.py (NEW)
- scripts/compute-bayesian-surprise.py (NEW)
- scripts/compute-element-novelty.py (NEW)
- scripts/compute-disruption-index.py (NEW)

## Execution Method

- Tasks 1-2: Python neo4j driver (neo4j+s://5b8df33f.databases.neo4j.io)
- Task 3: Direct file creation following existing script patterns
- No MCP write tools available in session; Python driver used instead
