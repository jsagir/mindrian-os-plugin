---
stage: 3
methodology: research
chain: analogy
input_from: abstract
output_to: transfer
room_section: competitive-analysis
---

# Stage 3: Search (Dual-Mode Analogy Retrieval)

## Input Extraction

Extract from Stage 2 artifact (scan `room/problem-definition/` for most recent artifact with `pipeline: analogy` and `pipeline_stage: 2` in frontmatter):

- **Abstract function description** -- the domain-independent encoding of the venture's core problem
- **TRIZ parameter mapping** -- improving/worsening parameters and suggested inventive principles
- **Functional keywords** -- 5-10 domain-independent search terms

Present to the user: "Searching for analogies to: [abstract function]. Looking for systems that [functional description] across [internal/external/both] sources."

## Stage Instructions

This stage runs DUAL-MODE search: internal (room graph + Brain) and external (web research). The mode depends on user preference or pipeline configuration:

- **Internal only** (`--brain`): KuzuDB + Brain queries, no web search
- **External only** (`--external`): Tavily web research, no Brain queries
- **Both** (default): All sources in parallel

### Internal Search (Tier 0 / Tier 1 / Tier 2)

#### Tier 0: LLM Reasoning (always available)

Use the abstract function description and functional keywords to generate candidate analogies from training knowledge. For each candidate, provide:
- Source domain
- How the analogy maps structurally
- Analogy distance classification (near / far / cross-domain)

Generate 3-5 candidates from diverse domains (biology, engineering, military, sports, economics, ecology, etc.).

#### Tier 1: KuzuDB Local Graph (if room/.lazygraph/ exists)

Query existing HSI_CONNECTION edges for structural_transfer matches:

```
Scan HSI_CONNECTION edges where innovation_type = 'structural_transfer'
Sort by hsi_score DESC
Return top 5 with source/target artifacts and structural descriptions
```

Also query CONTRADICTS edges that share the same TRIZ parameter pattern as the venture's contradiction.

#### Tier 2: Brain MCP (if connected)

Read `references/brain/query-patterns.md` for `brain_cross_domain` and `brain_search_semantic` patterns.

1. **brain_cross_domain**: Find bridging frameworks between the venture's domain and other domains
2. **brain_search_semantic**: Vector search using the abstract function description as query text
3. **brain_analogy_search**: Find frameworks from DIFFERENT domains that address the SAME problem type

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

### External Search (via Tavily MCP)

If external mode is active, dispatch parallel research queries:

1. **Biomimicry search**: Search AskNature.org with functional keywords
   - Query: "how does nature [abstract function keyword]?"
   - Example: "how does nature filter population by fit criteria?"

2. **Patent search**: Search Google Patents or Lens.org with TRIZ principles
   - Query: "[TRIZ principle name] AND [functional keyword]"
   - Example: "segmentation AND adaptive barrier delivery"

3. **Academic search**: Search Google Scholar or Semantic Scholar
   - Query: "[abstract function] cross-domain analogy"
   - Example: "overcome adaptive barrier delivery system structural isomorphism"

Each external result must include:
- Source URL and title
- Source domain classification
- How it maps to the venture's abstract function
- Analogy distance score (near/far/cross-domain)
- Structural fitness estimate (0-1)

### Ranking and Classification

Combine all results (internal + external) and rank by:

| Factor | Weight | Description |
|--------|--------|-------------|
| Structural fitness | 40% | How well the relational structure maps to the venture |
| Analogy distance | 30% | Far/cross-domain analogies score higher (more novel) |
| Evidence quality | 20% | Concrete examples beat abstract similarities |
| Source reliability | 10% | Brain graph > academic > patent > web |

Classify each analogy by distance:
- **Near** (same industry): structural_fitness 0.30-0.45, low surprise
- **Far** (adjacent domain): structural_fitness 0.45-0.65, medium surprise
- **Cross-domain** (completely different field): structural_fitness > 0.65, high surprise

When the methodology produces its artifact, ensure pipeline provenance is added to frontmatter:

```yaml
pipeline: analogy
pipeline_stage: 3
search_mode: "[internal|external|both]"
analogies_found: [count]
top_analogy: "[source domain]: [brief description]"
analogy_distances: { near: N, far: N, cross_domain: N }
discovery_methods: [list of methods that found results]
```

## Output Contract

The following sections from the artifact feed into Stage 4 (transfer):

- **Top 3-5 ranked analogies** -- each with source domain, structural mapping, distance classification
- **Structural fitness scores** -- quantified mapping quality for each analogy
- **Discovery provenance** -- how each analogy was found (LLM/KuzuDB/Brain/external)
- **TRIZ principle alignment** -- which inventive principles each analogy embodies

Stage 4 will extract these by scanning `room/competitive-analysis/` for the most recent artifact with `pipeline: analogy` and `pipeline_stage: 3` in frontmatter.
