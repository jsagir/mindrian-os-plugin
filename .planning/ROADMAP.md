# Roadmap: MindrianOS Plugin v1.8.2 -- Brain Graph Optimization

## Overview

| Phases | Requirements | Script | Execution |
|--------|-------------|--------|-----------|
| 4 phases | 27 REQs | v182-brain-optimize.cypher (19 sections) | Neo4j Aura console + MCP verification |

**Single source of truth:** `scripts/v182-brain-optimize.cypher`
**Architecture reference:** `references/brain/graph-architecture.md`

---

## Phase 52: Foundation -- Labels, Stages, ProblemTypes, Dedup

**Goal:** Clean the graph foundation so all subsequent wiring lands on canonical nodes.

**Script sections:** 1 (Labels), 2 (VentureStage), 3 (ProblemType), 4 (DictionaryTerm dedup), 5 (Book dedup + GROUNDS_FRAMEWORK), 6 (Opportunity Bank)

**Requirements:**
- FRAG-06: Label normalization
- CAUSAL-05: VentureStage progression chain
- FRAG-01: ProblemType consolidation
- FRAG-02: DictionaryTerm dedup
- FRAG-03: Book dedup + title normalization
- FRAG-04: INTRODUCES_FRAMEWORK mislanding fix
- LAZY-04: Provenance chain (GROUNDS_FRAMEWORK)
- FRAG-05: Opportunity Bank consolidation

**Success criteria:**
1. `MATCH (n:concept) RETURN count(n)` returns 0 (labels cleaned)
2. `MATCH (n:VentureStage) RETURN count(n)` returns 5 with PROGRESSES_TO chain
3. `MATCH (n:ProblemType)-[:SUBTYPE_OF]->(c) RETURN count(n)` returns 9+ (matrix + Wicked)
4. `MATCH (n:DictionaryTerm) WITH n.name, count(n) AS c WHERE c > 1 RETURN count(n)` returns 0
5. `MATCH (n:Book) WITH n.name, count(n) AS c WHERE c > 1 RETURN count(n)` returns 0
6. `MATCH ()-[r:GROUNDS_FRAMEWORK]->() RETURN count(r)` returns 10+

---

## Phase 53: Causal Spine -- FEEDS_INTO, TYPICAL_AT, PREREQUISITE, ADDRESSES

**Goal:** Wire the methodology intelligence that powers Larry's causal reasoning, stage recommendations, and gap detection.

**Script sections:** 7 (FEEDS_INTO), 8 (TYPICAL_AT), 9 (ADDRESSES_PROBLEM_TYPE), 10 (PREREQUISITE)

**Requirements:**
- CAUSAL-01: FEEDS_INTO enrichment (4 -> 35+)
- CAUSAL-02: PREREQUISITE edges (0 -> 14)
- CAUSAL-03: TYPICAL_AT enrichment (4 -> 30+)
- CAUSAL-04: ADDRESSES_PROBLEM_TYPE cleanup + enrichment

**Success criteria:**
1. `MATCH ()-[r:FEEDS_INTO]->(:Framework) RETURN count(r)` returns 30+
2. `MATCH ()-[r:TYPICAL_AT]->() RETURN count(r)` returns 30+
3. `MATCH ()-[r:ADDRESSES_PROBLEM_TYPE]->() RETURN count(r)` returns 60+
4. `MATCH ()-[r:PREREQUISITE]->() RETURN count(r)` returns 14
5. PWS spine traversal works: `MATCH path = (s:Framework {name:'Domain Selection'})-[:FEEDS_INTO*1..10]->(e) RETURN length(path)` returns paths up to 9-10 hops

---

## Phase 54: Agent + Teaching Layer -- Mullins, Workshops, Bots, Agents, CaseStudies

**Goal:** Wire every teaching entity to its Framework so Larry knows which bot runs which methodology, which workshop teaches what, and which case study illustrates which concept.

**Script sections:** 11 (Mullins), 12 (Workshops), 13 (Bots), 14 (CorePrinciples), 15 (FrameworkAgents), 16 (CaseStudies)

**Requirements:**
- AGENT-03: Mullins promotion + pipeline wiring
- AGENT-04: Workshop->TEACHES->Framework
- AGENT-05: Bot->IMPLEMENTS->Framework
- AGENT-06: CorePrinciple->GOVERNS
- AGENT-01: FrameworkAgents wired (10/10)
- AGENT-02: CaseStudies wired (26+/30)
- AGENT-07: Grading gap flagged

**Success criteria:**
1. `MATCH (n {name:'Mullins Model Validation'}) RETURN labels(n)` includes ValidationTool
2. `MATCH (w:Workshop)-[:TEACHES]->(f) RETURN count(r)` returns 16+
3. `MATCH (b:Bot)-[:IMPLEMENTS]->(f) RETURN count(r)` returns 15
4. `MATCH (n:FrameworkAgent) WITH n, size([(n)--() | 1]) AS c WHERE c < 3 RETURN count(n)` returns 0
5. `MATCH (n:CaseStudy) WITH n, size([(n)--() | 1]) AS c WHERE c < 2 RETURN count(n)` returns < 5

---

## Phase 55: Lazy Bridge + Verification -- ALIAS_OF, Promotion, Cleanup, Indexes, Docs

**Goal:** Bridge the Lazy layer to curated nodes so semantic intelligence reaches Larry, clean orphans, verify everything, update docs.

**Script sections:** 17 (ALIAS_OF + promotion + cleanup), 18 (Indexes), 19 (Grading gap)

**Requirements:**
- LAZY-01: ALIAS_OF from LazyGraphConcepts to canonical nodes
- LAZY-02: Promote valuable LazyGraphConcepts to Concept
- LAZY-03: Delete 511 orphan LazyGraphConcepts
- LAZY-05: DictionaryTerm->Framework bridging
- VERIFY-01: Edge count targets met
- VERIFY-02: Zero orphan agents/dupes/mislanded edges
- VERIFY-03: graph-architecture.md updated with post-normalization metrics
- VERIFY-04: Idempotency confirmed

**Success criteria:**
1. `MATCH ()-[r:ALIAS_OF]->() RETURN count(r)` returns 20+
2. `MATCH (n:LazyGraphConcept) WHERE NOT (n)--() RETURN count(n)` returns 0
3. All verification queries in the final block of v182-brain-optimize.cypher pass
4. `references/brain/graph-architecture.md` updated with post-run metrics
5. Re-running the full script produces no new edges (idempotent via MERGE)

---

## Requirement Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FRAG-06 | 52 | Pending |
| CAUSAL-05 | 52 | Pending |
| FRAG-01 | 52 | Pending |
| FRAG-02 | 52 | Pending |
| FRAG-03 | 52 | Pending |
| FRAG-04 | 52 | Pending |
| LAZY-04 | 52 | Pending |
| FRAG-05 | 52 | Pending |
| CAUSAL-01 | 53 | Pending |
| CAUSAL-02 | 53 | Pending |
| CAUSAL-03 | 53 | Pending |
| CAUSAL-04 | 53 | Pending |
| AGENT-03 | 54 | Pending |
| AGENT-04 | 54 | Pending |
| AGENT-05 | 54 | Pending |
| AGENT-06 | 54 | Pending |
| AGENT-01 | 54 | Pending |
| AGENT-02 | 54 | Pending |
| AGENT-07 | 54 | Pending |
| LAZY-01 | 55 | Pending |
| LAZY-02 | 55 | Pending |
| LAZY-03 | 55 | Pending |
| LAZY-05 | 55 | Pending |
| VERIFY-01 | 55 | Pending |
| VERIFY-02 | 55 | Pending |
| VERIFY-03 | 55 | Pending |
| VERIFY-04 | 55 | Pending |

**Coverage:** 27/27 requirements mapped. 0 unmapped.

---
*Roadmap created: 2026-04-06*
*Script: scripts/v182-brain-optimize.cypher (19 sections, 4 phases)*
