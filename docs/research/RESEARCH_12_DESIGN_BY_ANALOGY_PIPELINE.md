# RESEARCH 12: Design-by-Analogy (DbA) Pipeline for MindrianOS

Date: 2026-03-31
Session: Powerhouse 1.6.0 Research
Status: Research complete, ready for planning

---

## Core Discovery

MindrianOS already performs Design-by-Analogy. It just doesn't know it yet.

The HSI pipeline's structural_transfer type IS the DbA "Abstract" step -- the system found a structural isomorphism between domains. The semantic_implementation type IS the DbA "Transfer" step -- the system found that a solution pattern in one domain applies to a different domain's problem.

What's missing: HSI only discovers analogies between room artifacts (intra-room). DbA needs to also discover analogies from EXTERNAL domains (inter-room, cross-Brain, web research). And discoveries need formalization into Abstract-Transfer-Respecify rather than just similarity scores.

---

## The DbA Family of Methods

### TRIZ (Theory of Inventive Problem Solving)
Most systematic version. 39 technical parameters, contradiction matrix from 2.5M patents. Domain-agnostic -- essentially biomimicry applied to engineering patents instead of nature.

### Synectics
4 analogy types: Direct (literal similarity), Personal (imagine yourself AS the problem), Symbolic (compressed poetic description), Fantasy (ideal/magical version).

### SAPPhIRE Model
7-layer ontology for encoding ANY system: State, Action, Part, Phenomenon, Input/output, Real Effect. Enables structural matching across domains.

### Functional Basis / AskNature
Match by FUNCTION, not structure. "What else achieves function X?" Standardized verbs: separate, convert, regulate, deliver, protect, transform.

### Cross-Domain Innovation Synthesizer (LLM-era)
Deconstruct source -> Map structural isomorphisms -> Generate solutions by importing "alien logic" -> Evaluate feasibility.

### Mathematical Backbone: Structural Isomorphism
Two systems are analogous not because they look alike but because their relational structure is preserved under mapping. If system A has relations R1(a1, a2) and system B has R1(b1, b2), and the mapping a_i -> b_i preserves all relations, they are isomorphic and solutions transfer.

---

## The DbA Pipeline -- 5 Stages

### Stage 1: DECOMPOSE (Extract Functional Structure)
Input: Room artifacts across all sections.
Process: For each artifact, extract: what FUNCTION does this serve? What PROBLEM does this address? What MECHANISM does it use? Encode as SAPPhIRE function-behavior-structure triples. Identify the venture's CORE CONTRADICTION.
Output: Filed to problem-definition/ with pipeline: analogy, pipeline_stage: 1.
Uses: /mos:reason (Minto/MECE decomposition).

### Stage 2: ABSTRACT (Domain-Independent Encoding)
Input: Stage 1 decomposition.
Process: Strip all domain-specific language. Replace with functional verbs (deliver, protect, transform, connect, filter, amplify, regulate). Map to TRIZ parameter space -- which of the 39 parameters are in tension?
Output: Filed to problem-definition/ with pipeline: analogy, pipeline_stage: 2. Contains domain-independent function description, abstract contradiction in TRIZ format, functional keywords for search.
Larry's role: Challenge domain-specific thinking. "You keep saying 'tumor resistance' -- but what is resistance, functionally? It's an adaptive barrier. Where else do adaptive barriers block delivery systems?"

### Stage 3: SEARCH (Cross-Domain Analogy Retrieval)
Input: Abstract function description from Stage 2.
Process -- DUAL MODE (Internal + External):

INTERNAL SEARCH (within room + Brain):
- Tier 0: LLM reasoning generates candidate analogies from training data
- Tier 1: KuzuDB HSI_CONNECTION edges for near-domain analogies
- Tier 2: Brain brain_cross_domain and brain_search_semantic for framework-level analogies

EXTERNAL SEARCH (orchestrated web research):
- Tavily MCP: Search AskNature.org for biomimicry matches ("how does nature [abstract function]?")
- Tavily MCP: Search Google Patents / Lens.org for patent abstracts matching TRIZ principles
- Tavily MCP: Search academic databases for cross-domain solutions
- Research agent (run_in_background): Parallel external search across 3+ source domains
- Each external result filed to room with source provenance and analogy_distance classification

Output: Filed to competitive-analysis/ with pipeline: analogy, pipeline_stage: 3. Ranked candidates with source domains, structural mapping, analogy distance, discovery method (internal/external).

### Stage 4: TRANSFER (Map Solutions Back)
Input: Top analogies from Stage 3 + original room context.
Process: For each top-3 analogy, build explicit correspondence table mapping source domain elements to venture domain. Generate concrete design proposals. Rate transfer feasibility: structural fit x implementation distance.
Output: Filed to solution-design/ with pipeline: analogy, pipeline_stage: 4.
Uses: /mos:structure-argument (Minto Pyramid).

### Stage 5: VALIDATE (Stress-Test the Transfer)
Input: Transfer proposals from Stage 4.
Process: Devil's Advocate challenges structural mapping. TRIZ contradiction analysis -- does transferred solution introduce new contradictions? Rate survivors by structural integrity x novelty x feasibility.
Output: Filed to competitive-analysis/ with pipeline: analogy, pipeline_stage: 5. Survival map, failure analysis, refined proposals.
Uses: /mos:challenge-assumptions (Devil's Advocate).

---

## SAPPhIRE Mapping to Room Sections

| SAPPhIRE Layer | Room Section | Artifact Content |
|---|---|---|
| State | problem-definition/ | Market gap, problem state, current situation |
| Action | solution-design/ | Product/service action, user interaction |
| Part | team-execution/ | Team composition, partnerships, resources |
| Phenomenon | market-analysis/ | Market trends, user behaviors, demand signals |
| Input | business-model/ | Revenue streams, funding, customer acquisition |
| Real effect | competitive-analysis/ | Moat, structural advantage, economic logic |
| Effect | financial-model/ | Unit economics, growth mechanism, value chain |

---

## TRIZ Integration via KuzuDB

When a CONTRADICTS edge is created, classify using TRIZ:
1. Extract what artifact A improves (Parameter X of 39)
2. Extract what artifact B worsens (Parameter Y of 39)
3. Look up TRIZ Contradiction Matrix[X][Y]
4. Return suggested Inventive Principles (from the 40)

New CONTRADICTS edge properties: triz_improving_param, triz_worsening_param, triz_principles, contradiction_type (technical/physical/administrative).

This takes an existing detected contradiction and proposes a STRUCTURED RESOLUTION DIRECTION, not just flagging the conflict.

---

## 3 New KuzuDB Edge Types

ANALOGOUS_TO: Artifacts with preserved functional structure. Properties: analogy_distance (near/far/cross-domain), structural_fitness (0-1), source_domain, transfer_map (JSON), discovery_method (hsi/brain/llm/external/user), pipeline_stage.

STRUCTURALLY_ISOMORPHIC: Sections with identical relational topology. Properties: isomorphism_score (0-1), mapped_elements (JSON), source.

RESOLVES_VIA: Links a CONTRADICTS edge to its resolution. Properties: resolution_type (analogy/triz_principle/direct), triz_principle, analogy_source, confidence (0-1). Closes the loop: contradiction -> analogy -> resolution.

---

## Analogy Distance and HSI Innovation Differential

| Analogy Distance | HSI Score | Semantic Surprise | Character |
|---|---|---|---|
| Near (same domain) | 0.30-0.45 | Low | Same industry, different application |
| Far (adjacent domain) | 0.45-0.65 | Medium | Different industry, recognizable pattern |
| Cross-domain | > 0.65 | High | Completely different domain, preserved structure |

High spectral_gap + high semantic_surprise = genuine cross-domain insight vs superficial keyword overlap.

---

## External Research Orchestration (Dual Mode)

### Internal Discovery (existing infrastructure)
- KuzuDB local graph (HSI_CONNECTION, REVERSE_SALIENT edges)
- Brain MCP (brain_cross_domain, brain_concept_connect, brain_search_semantic)
- Room-proactive skill (contradiction and convergence detection)

### External Discovery (new for 1.6.0)
- Research agent dispatched with run_in_background for parallel web research
- Tavily MCP for AskNature.org biomimicry search
- Tavily MCP for patent database search (Google Patents, Lens.org)
- Tavily MCP for academic paper search
- Each external result scored with analogy_distance and structural_fitness
- Filed to room with full provenance (source URL, search query, discovery method)
- Opportunity Bank fed with funding leads from analogous domains

### Orchestration Pattern
Stage 3 SEARCH dispatches parallel agents:
- Agent 1 (sonnet): Internal search -- KuzuDB + Brain queries
- Agent 2 (sonnet): Biomimicry search -- AskNature + nature analogies
- Agent 3 (haiku): Patent search -- TRIZ principles in target domains
- Agent 4 (sonnet): Academic search -- cross-domain research papers
All run via run_in_background. SubagentStop hook collects results. Main Larry synthesizes and ranks.

---

## Opportunity Bank Connection

When cross-domain analogy discovered in Stage 3 and source domain has known funding:
1. Analogy creates ANALOGOUS_TO edge referencing source domain
2. Opportunity scanner includes analogous domain terms in API queries
3. Filed opportunity includes analogy_source and cross_domain fields
4. Structural_fitness score helps rank opportunity relevance

Example: Education-tech venture structurally analogous to telemedicine. Healthcare funding bodies (NIH SBIR, HRSA) become opportunity leads for the ed-tech venture.

---

## Brain Neo4j as Analogy Engine

New query pattern -- brain_analogy_search:
```cypher
MATCH (f1:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
WHERE f1.category = $source_category
WITH pt, collect(f1) AS source_frameworks
MATCH (f2:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt)
WHERE NOT f2.category = $source_category
AND NOT f2 IN source_frameworks
OPTIONAL MATCH (f2)-[:CO_OCCURS]->(bridge:Framework)
WHERE bridge IN source_frameworks
RETURN f2.name, f2.category, f2.description, pt.name, bridge.name
ORDER BY bridge IS NOT NULL DESC
LIMIT 15
```

Finds frameworks from DIFFERENT domains that address the SAME problem type.

---

## What Already Exists (80% of infrastructure)

| DbA Requirement | MindrianOS Has It |
|---|---|
| Problem decomposition | Room sections = Simon's hierarchy |
| Structural similarity | HSI structural_transfer |
| Semantic similarity | HSI semantic_implementation |
| Cross-domain search | Brain brain_cross_domain |
| Contradiction detection | KuzuDB CONTRADICTS edges |
| Solution transfer | Pipeline stage chaining |
| Validation | /mos:challenge-assumptions |
| Thinking quality | Spectral OM-HMM |
| Knowledge graph | KuzuDB + Brain Neo4j |
| Multi-tier degradation | Tier 0/1/2 throughout |
| External research | Tavily MCP + research agent |

## What Needs Building (20%)

1. pipelines/analogy/CHAIN.md + 5 stage files
2. commands/find-analogies.md
3. references/methodology/triz-matrix.json (static)
4. references/methodology/triz-principles.md (static)
5. references/methodology/sapphire-encoding.md (static)
6. 3 new KuzuDB edge types in lazygraph-ops.cjs
7. TRIZ classification on CONTRADICTS edges
8. brain_analogy_search query pattern
9. Analogy distance classifier in compute-hsi.py
10. External search orchestration in Stage 3

---

## User Experience

/mos:find-analogies -- Quick on-demand analogy scan (reads room, runs DECOMPOSE + SEARCH internally)
/mos:find-analogies --brain -- Brain-enriched cross-domain search
/mos:find-analogies --external -- Full external research orchestration
/mos:pipeline analogy -- Full 5-stage pipeline with provenance
Passive: Room-proactive surfaces analogy insights from HSI structural_transfer pairs during SessionStart

---

## Research References

- Gentner, D. (1983). Structure-Mapping Theory of Analogy. Cognitive Science.
- Altshuller, G. (1999). TRIZ: The Innovation Algorithm.
- Chakrabarti, A. et al. SAPPhIRE Model and Idea-Inspire 3.0.
- Gordon, W. J. J. (1961). Synectics: The Development of Creative Capacity.
- Seabrook, E. & Wiskott, L. (2022). Spectral Theory of Markov Chains. arxiv 2207.02296.
- Van Clief, J. & McDermott, D. (2026). ICM. arxiv 2603.16021.
