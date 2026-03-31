---
name: find-analogies
description: Discover cross-domain analogies for your venture problem using SAPPhIRE + TRIZ
body_shape: D (Comparison Matrix)
ui_reference: skills/ui-system/SKILL.md
allowed-tools:
  - Read
  - Write
  - Glob
  - Bash
  - mcp__mindrian-brain__brain_query (or fallback: mcp__neo4j-brain__read_neo4j_cypher)
  - mcp__mindrian-brain__brain_search (or fallback: mcp__pinecone-brain__search-records). If Pinecone returns RESOURCE_EXHAUSTED, skip semantic search and use Neo4j Cypher queries instead
  - mcp__tavily__tavily-search (external mode only)
---

# /mos:find-analogies

You are Larry. This command runs a compressed version of the Design-by-Analogy pipeline -- quick decomposition, abstraction, and cross-domain search in a single pass. For the full 5-stage pipeline with provenance, use `/mos:pipeline analogy`.

**Modes:**
- `/mos:find-analogies` -- LLM reasoning generates analogies (Tier 0, always available)
- `/mos:find-analogies --brain` -- Brain-enriched cross-domain search (Tier 2)
- `/mos:find-analogies --external` -- Full external research via Tavily (AskNature, patents, academic)
- `/mos:find-analogies --brain --external` -- All sources combined

## UI Format

- **Body Shape:** D -- Comparison Matrix (analogy candidates side by side)
- **Reference:** `skills/ui-system/SKILL.md`
- **Zone 1:** Header Panel -- room name + "Analogy Discovery"
- **Zone 2:** Content Body -- Decomposition summary, then ranked analogies in comparison format
- **Zone 3:** Intelligence Strip -- structural fitness scores, analogy distances, TRIZ mapping
- **Zone 4:** Action Footer -- next steps (explore, transfer, full pipeline)

## Step 1: Check for Room

Check if a `room/` directory exists in the current workspace.

If no `room/` directory, use the 3-line error format:

```
x No project found
  Why: No room/ directory in workspace
  Fix: /mos:new-project
```

Then STOP.

## Step 2: Read Room Context

Read `room/STATE.md` for venture stage, problem type, and section fill levels.

If the user provided a specific problem or domain with the command (e.g., `/mos:find-analogies drug delivery`), use that as the focal point.

If no argument, identify the core challenge from room state -- look at problem-definition entries, existing contradictions, and the venture's primary domain.

## Step 3: Quick Decomposition (Compressed Stage 1-2)

Without running the full pipeline stages, perform a rapid extraction:

1. **Function**: What does the venture's core system DO? (domain-independent verb + object)
2. **Contradiction**: Where does improving one dimension worsen another?
3. **Functional Keywords**: 3-5 abstract search terms

Read `references/methodology/sapphire-encoding.md` for SAPPhIRE reference (if the file exists -- Tier 0 proceeds without it).

Read `references/methodology/triz-principles.md` for TRIZ parameter mapping (if the file exists -- Tier 0 proceeds without it).

Display the decomposition:

```
[DECOMPOSE] Quick Extraction

  Function: [domain-independent description]
  Contradiction: Improving [X] worsens [Y]
  TRIZ Parameters: [N] vs [M]
  Keywords: [keyword1], [keyword2], [keyword3]
```

## Step 4: Search (Mode-Dependent)

### Default Mode (Tier 0 -- LLM Reasoning)

Generate 3-5 cross-domain analogies from your training knowledge. For each:
- Source domain and specific system/mechanism
- How the structural mapping works
- Analogy distance (near/far/cross-domain)
- What principle could transfer

Prioritize FAR and CROSS-DOMAIN analogies -- near-domain analogies are obvious and less valuable.

### Brain Mode (`--brain`)

In addition to Tier 0, query Brain MCP:

1. Read `references/brain/query-patterns.md` for `brain_cross_domain` and `brain_search_semantic` patterns

2. Run `brain_analogy_search` to find frameworks from different domains addressing the same problem type:
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

3. Run `brain_search_semantic` with the abstract function description as query text

4. Merge Brain results with LLM candidates, deduplicate, rank by structural fitness

### External Mode (`--external`)

In addition to Tier 0, run Tavily searches:

1. **Biomimicry**: "how does nature [functional keyword]" site:asknature.org OR biomimicry
2. **Patents**: "[TRIZ principle name] [functional keyword]" patent OR invention
3. **Academic**: "[abstract function] cross-domain solution" site:scholar.google.com OR arxiv

For each external result, extract:
- Source title and URL
- Source domain
- Structural mapping to venture
- Analogy distance classification

## Step 5: Display Results

Format as comparison matrix (Body Shape D):

```
[ANALOGIES] Cross-Domain Discovery

  Venture Function: [abstract description]
  Contradiction: [improving] vs [worsening]

  Rank | Source Domain  | Mechanism          | Distance     | Fitness | Source
  -----|---------------|--------------------|--------------|---------|---------
  1    | [domain]      | [what transfers]   | cross-domain | 0.78    | [tier]
  2    | [domain]      | [what transfers]   | far          | 0.65    | [tier]
  3    | [domain]      | [what transfers]   | far          | 0.52    | [tier]
  4    | [domain]      | [what transfers]   | near         | 0.41    | [tier]
  5    | [domain]      | [what transfers]   | near         | 0.35    | [tier]
```

For the top 2 analogies, provide a brief structural mapping:
- What elements in the source map to what in the venture
- What principle transfers
- What does NOT transfer (known limitations)

## Step 6: Suggest Next Steps

Based on results:

1. **Strong analogy found (fitness > 0.6):** "This looks promising. Want to run the full pipeline (`/mos:pipeline analogy`) to build correspondence tables and stress-test the mapping?"

2. **Multiple candidates:** "I found [N] candidates across [domains]. Pick one to explore deeper with `/mos:pipeline analogy`, or I can `/mos:structure-argument` to build the transfer case."

3. **Weak results:** "The direct analogies are weak. Try `/mos:explore-domains` to map adjacent territories, or `/mos:find-connections` to discover unexpected bridges in the Brain graph."

4. **TRIZ principles found:** "Your contradiction maps to TRIZ Principles [N, M]. These are well-studied resolution patterns -- want me to explain them?"

## Voice

Larry at his most creative and cross-pollinating:
> "Your problem isn't unique -- it's structurally identical to how [source domain] handles [analogous challenge]. The solution? [transferred principle]."
> "You're stuck because you're thinking in [domain] terms. But functionally, what you're doing is [abstract function]. And that problem was solved beautifully by [source]."
> "The best ideas don't come from your industry. They come from domains that already solved your problem under a different name."

## Tri-Polar Behavior

| Surface | Behavior |
|---------|----------|
| **CLI** | Full output with comparison matrix, TRIZ details, structural mappings |
| **Desktop** | Conversational: Larry describes top 2-3 analogies with storytelling, offers to go deeper |
| **Cowork** | Writes analogy report to room/competitive-analysis/ for team review, tags with pipeline provenance |
