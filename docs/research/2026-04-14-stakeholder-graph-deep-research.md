---
title: Knowledge Graph-Powered Stakeholder Analysis with Deep Research
author: Jonathan Sagir
project: MindrianOS
date: 2026-04-14
status: authority for v1.11.x Stakeholder Intelligence milestone
type: external research synthesis authored by the project lead, pasted into brainstorming session and normalized to repo formatting conventions (em-dashes to hyphens)
related:
  - docs/research/2026-04-14-feynman-minto-scn-benchmark.md
  - docs/superpowers/specs/2026-04-14-phase-84-smart-notebook-co-pilot-design.md
  - .planning/research/cross-session-memory-and-room-intent.md
---

# Knowledge Graph-Powered Stakeholder Analysis with Deep Research

## Executive Summary

Traditional stakeholder analysis collapses a rich ecosystem of actors into a flat 2x2 matrix. Knowledge graphs (KGs) fundamentally change this by treating stakeholders as **nodes**, their relationships as **edges**, and their attributes (power, interest, stance, legitimacy) as **properties** on both. When combined with an LLM-powered deep research pipeline, the graph continuously builds and reasons itself, surfacing hidden coalitions, indirect influence paths, and strategic leverage points that no static matrix can reveal.

***

## Part 1 - Why a Graph Is the Right Data Model for Stakeholders

### The Limits of a 2x2 Matrix

The Power-Interest Grid (Mendelow, 1991) and the Salience Model (Mitchell, Agle & Wood, 1997) treat each stakeholder as an isolated point scored on two or three dimensions. This works for small, well-understood groups. But it silently drops the most important dimension: **who influences whom**. A community liaison with low formal power but strong informal connections to five key officials is invisible on a grid, yet they are a critical leverage node.

### Stakeholders as a Property Graph

In a knowledge graph, the model becomes:

- **Nodes** - Stakeholders (persons, organizations, roles, coalitions)
- **Node properties** - `power`, `interest`, `legitimacy`, `urgency`, `stance` (support/oppose), `sector`, `geography`
- **Edges** - Typed relationships: `INFLUENCES`, `FUNDS`, `REGULATES`, `PARTNERS_WITH`, `OPPOSES`, `IS_MEMBER_OF`, `COMMUNICATES_WITH`
- **Edge properties** - `strength` (weak/strong), `direction` (one-way / mutual), `type` (formal / informal), `timestamp`

This representation answers questions that grids can never address:

- *What other initiatives is this stakeholder involved in?*
- *Which processes or applications do they interact with?*
- *Who influences them indirectly, two or three hops away?*
- *Which clusters of stakeholders tend to act together?*

### The Key Graph Advantage: Multi-Hop Reasoning

A regulator might not be directly connected to your project, but they sit on an advisory panel with an NGO that funds a think tank that shapes your key investor's ESG criteria. A graph can traverse this 4-hop path in milliseconds; a spreadsheet never sees it. This is called **indirect influence path discovery** and it is the core unique value of the graph model.

***

## Part 2 - Graph Schema Design for Stakeholder Analysis

### Node Labels

```cypher
(:Stakeholder {name, type, sector, geography, power, interest, legitimacy, urgency, stance, notes})
(:Organization  {name, type, country})
(:Person        {name, title, org})
(:Coalition     {name, issue_area})
(:Issue         {name, domain})
(:Initiative    {name, status})
```

Power, interest, legitimacy, and urgency are typically scored 1-5 (or normalized 0-1). `stance` is an enum: `strong_support`, `support`, `neutral`, `oppose`, `strong_oppose`. Storing these as **edge properties** rather than node properties is important when the same stakeholder participates in multiple initiatives - their power/interest score may differ by context.

### Relationship (Edge) Types

| Relationship | Direction | Meaning |
|---|---|---|
| `INFLUENCES` | directed | A shapes B's opinion or decisions |
| `FUNDS` | directed | A provides resources to B |
| `REGULATES` | directed | A has regulatory authority over B |
| `PARTNERS_WITH` | undirected | Formal collaboration |
| `OPPOSES` | directed | A actively works against B's goals |
| `IS_MEMBER_OF` | directed | A belongs to coalition/org B |
| `COMMUNICATES_WITH` | undirected | Regular contact/relationship |
| `IS_STAKEHOLDER_IN` | directed | A has interest in initiative B (with power + interest as edge props) |

### Sample Cypher Setup (Neo4j)

```cypher
// Create a stakeholder with attributes
CREATE (:Stakeholder:Person {
  name: "Avi Cohen",
  title: "Director General, Ministry of Energy",
  sector: "Government",
  geography: "IL"
})

// Create a stakeholder relationship with attributes
MATCH (a:Stakeholder {name: "Avi Cohen"}),
      (b:Stakeholder {name: "Israel Innovation Authority"})
CREATE (a)-[:INFLUENCES {strength: 0.85, type: "formal", since: 2023}]->(b)

// Assign stakeholder role in an initiative with power/interest scores
MATCH (s:Stakeholder {name: "Avi Cohen"}), (i:Initiative {name: "Smart Grid 2026"})
CREATE (s)-[:IS_STAKEHOLDER_IN {power: 5, interest: 4, stance: "support"}]->(i)
```

***

## Part 3 - Deep Research Pipeline: LLM + Knowledge Graph

The most powerful pattern is coupling an LLM agentic loop with a live Neo4j graph - each iteration of research adds new nodes/edges, and the graph's evolving structure guides the next research prompt. This is precisely the "agentic deep graph reasoning" approach demonstrated in recent MIT research, where an LLM-graph feedback loop produces self-organizing knowledge networks.

### Pipeline Architecture

```
[Source Documents / Web / APIs]
         |
         v
[LLM NER + Relation Extraction Agent]
   -> Extract: entities, relationships, attributes
         |
         v
[Graph Ingest -> Neo4j / FalkorDB / ArangoDB]
   -> Merge nodes, create edges, update properties
         |
         v
[Graph Analysis Layer (GDS)]
   -> Run centrality, community detection, path queries
         |
         v
[LLM Reasoning Agent]
   -> Query graph, reason over paths, generate hypotheses
   -> Formulate next research questions from graph gaps
         |
         v
[Back to Sources] <- iterative loop
```

### Step 1 - Entity & Relation Extraction with LLM

Use an LLM (Claude, GPT-4, Mistral) as an NER + relation extraction agent. Feed it news articles, policy documents, LinkedIn bios, annual reports, meeting notes:

```python
prompt = """
Extract all stakeholders, organizations, and their relationships from the text below.
Return JSON with format:
{
  "nodes": [{"name": "...", "type": "person|org|coalition", "sector": "...", "geography": "..."}],
  "edges": [{"from": "...", "to": "...", "relationship": "INFLUENCES|FUNDS|REGULATES|...",
              "strength": 0-1, "evidence": "quote from text"}]
}

Text: {document}
"""
```

The key is using a **taxonomy-constrained** extraction - telling the LLM exactly which node types and relationship types are valid, preventing noise and keeping the graph clean. Research confirms that unconstrained LLM extraction produces poor graph quality, while taxonomy-guided extraction reaches 93%+ category coverage.

### Step 2 - Graph Ingest and Deduplication

Use `MERGE` in Cypher (not `CREATE`) to avoid duplicate nodes:

```cypher
MERGE (s:Stakeholder {name: $name})
ON CREATE SET s.sector = $sector, s.geography = $geo, s.created = timestamp()
ON MATCH SET s.last_seen = timestamp()

MERGE (a:Stakeholder {name: $from})-[r:INFLUENCES]->(b:Stakeholder {name: $to})
ON CREATE SET r.strength = $strength, r.evidence = $evidence
ON MATCH SET r.strength = (r.strength + $strength) / 2  // average over evidence
```

### Step 3 - Graph Algorithm Layer (Neo4j GDS)

Once the graph is populated, run graph algorithms to score and rank stakeholders:

#### PageRank - Who is most referenced/deferred to?

```cypher
CALL gds.pageRank.stream('stakeholder-graph', {
  relationshipTypes: ['INFLUENCES'],
  dampingFactor: 0.85,
  maxIterations: 20
})
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS stakeholder, score
ORDER BY score DESC LIMIT 20
```

PageRank scores stakeholders that are **pointed to by other influential stakeholders**, effectively measuring systemic importance.

#### Betweenness Centrality - Who are the brokers and gatekeepers?

```cypher
CALL gds.betweenness.stream('stakeholder-graph')
YIELD nodeId, score
RETURN gds.util.asNode(nodeId).name AS stakeholder, score
ORDER BY score DESC LIMIT 20
```

High betweenness = this stakeholder sits on many shortest paths between others. Remove them and the network fragments. These are your **critical bridge actors**, often mid-level liaisons, trade association heads, or trusted journalists.

#### Community Detection - Who are the coalitions?

```cypher
CALL gds.louvain.stream('stakeholder-graph', {
  relationshipTypes: ['PARTNERS_WITH', 'IS_MEMBER_OF', 'COMMUNICATES_WITH']
})
YIELD nodeId, communityId
RETURN communityId, collect(gds.util.asNode(nodeId).name) AS members
ORDER BY size(members) DESC
```

Louvain modularity groups stakeholders who are more densely connected to each other than to the rest. These are your de facto coalitions.

#### Influence Path Discovery - How do I reach stakeholder X?

```cypher
MATCH path = shortestPath(
  (me:Stakeholder {name: "My Organization"})-[:INFLUENCES|COMMUNICATES_WITH*..5]->
  (target:Stakeholder {name: "Ministry of Finance"})
)
RETURN [node IN nodes(path) | node.name] AS influence_path, length(path) AS hops
```

This surfaces the "6 degrees of separation" logic, finding indirect access routes to hard-to-reach stakeholders through intermediate connectors.

### Step 4 - LLM Reasoning over Graph Results

This is the "deep research" layer. After computing graph metrics, feed the results back to the LLM:

```python
graph_context = """
Top 5 by PageRank: [Minister A (4.2), NGO Director B (3.8), think tank C (3.1)...]
Top 5 by Betweenness: [Liaison D (0.45), journalist E (0.38)...]
Communities detected: [Cluster 1: Govt + Regulators, Cluster 2: Environmental NGOs + Academia]
Influence path to Ministry of Finance: My Org -> Think Tank C -> Advisor F -> Ministry
"""

prompt = f"""
Given this stakeholder network analysis:
{graph_context}

Analyze:
1. Who are the 3 highest-priority stakeholders to engage and why?
2. What engagement sequence would maximize coalition-building?
3. What hidden risks or missing stakeholders might exist?
4. Generate 3 follow-up research questions to expand the graph.
"""
```

The LLM then formulates new research queries, which feed back into document retrieval, expand the graph, and trigger another analysis cycle. This is the "self-organizing" quality: the graph guides its own expansion.

***

## Part 4 - Integrating Traditional Scoring into the Graph

Classic matrix scores do not disappear. They become **node and edge properties** queryable alongside graph structure.

### Salience Score as a Derived Property

The Mitchell-Agle-Wood salience model assigns scores for **power**, **legitimacy**, and **urgency**. In the graph, compute a composite salience score per stakeholder per initiative:

$$
S_i = w_1 \cdot P_i + w_2 \cdot L_i + w_3 \cdot U_i
$$

Where `P` = power, `L` = legitimacy, `U` = urgency, all scored 1-5, and weights sum to 1. Then store it back as a node property and use it to filter Cypher queries:

```cypher
MATCH (s:Stakeholder)-[r:IS_STAKEHOLDER_IN]->(i:Initiative {name: "Project X"})
WITH s, r, (0.4 * r.power + 0.35 * r.legitimacy + 0.25 * r.urgency) AS salience
SET r.salience = salience
RETURN s.name, salience, r.stance
ORDER BY salience DESC
```

### Hybrid Ranking: Graph + Matrix

Combine graph centrality with matrix scoring for a **holistic priority rank**:

$$
\text{Priority}_i = \alpha \cdot \text{PageRank}_i + \beta \cdot \text{Betweenness}_i + \gamma \cdot S_i
$$

Where `alpha + beta + gamma = 1` (tune to context). This surfaces stakeholders who are both individually salient AND structurally critical in the network, the two dimensions that the 2x2 matrix and graph each handle independently.

***

## Part 5 - Agentic Deep Research Architecture (Full Stack)

For a production-grade agentic stakeholder intelligence system aligned with the MindrianOS stack (Neo4j, Supabase, Claude/LLM, Python/Node.js):

### Tech Stack Mapping

| Layer | Component | Purpose |
|---|---|---|
| Graph DB | Neo4j (or FalkorDB for speed) | Store stakeholder KG |
| Extraction | Claude / GPT-4 + LangChain | NER + relation extraction |
| Orchestration | LangGraph / custom agent loop | Iterative research cycle |
| Search | Perplexity API / SerpAPI | Web research for new data |
| Vector Store | Supabase pgvector | Semantic search over documents |
| Analysis | Neo4j GDS (Python client) | Centrality, community detection |
| Visualization | Graphistry / neovis.js / D3 | Interactive graph UI |
| RAG Layer | LlamaIndex / custom | Query KG + docs together |

### MCP Server Integration

Given the MindrianOS MCP server architecture, expose Neo4j as an MCP tool so Claude can directly query the stakeholder graph during reasoning:

```javascript
// MCP tool: query_stakeholder_graph
{
  name: "query_stakeholder_graph",
  description: "Query the stakeholder knowledge graph for influence paths, communities, or centrality scores",
  inputSchema: {
    query_type: "enum: [influence_path, top_by_pagerank, community_members, stakeholder_profile]",
    params: "object: {source, target, initiative, top_n}"
  }
}
```

Claude can then call this tool mid-reasoning: *"Before deciding the engagement strategy, let me check if there is an indirect path between my org and the Ministry..."*.

### Agentic Research Loop (Pseudocode)

```python
async def stakeholder_deep_research(initiative: str, seed_stakeholders: list):
    graph = Neo4jGraph(uri, auth)

    for iteration in range(max_iterations):
        # 1. Identify graph gaps (nodes with few connections, low-confidence edges)
        gaps = graph.query("MATCH (s:Stakeholder) WHERE s.degree < 2 RETURN s.name")

        # 2. Generate research queries for gaps using LLM
        queries = llm.generate_queries(gaps, context=initiative)

        # 3. Fetch new data (web search, documents, APIs)
        new_docs = await research_agent.search(queries)

        # 4. Extract entities + relations from new docs
        extracted = llm.extract_graph_data(new_docs, schema=STAKEHOLDER_SCHEMA)

        # 5. Merge into graph
        graph.merge(extracted)

        # 6. Re-run graph algorithms
        scores = graph.run_gds(["pagerank", "betweenness", "louvain"])

        # 7. LLM reasons over updated graph, decides if done or continues
        decision = llm.reason(scores, graph.summary())
        if decision.converged:
            break

    return graph.generate_engagement_plan(initiative)
```

This is directly analogous to the MIT agentic deep graph reasoning framework. The graph structure drives the next research step rather than a static query plan.

***

## Part 6 - What Deep Research Reveals That Static Analysis Misses

| Insight Type | Static 2x2 Matrix | Knowledge Graph + Deep Research |
|---|---|---|
| Hidden coalitions | Not visible | Detected via community detection (Louvain) |
| Indirect influence paths | Only direct | Multi-hop path queries (3-5 hops) |
| Broker/gatekeeper roles | Overlooked | Betweenness centrality identifies bridges |
| Temporal dynamics | Snapshot only | Edge timestamps track relationship evolution |
| Cross-initiative stakeholders | Siloed by project | Shared nodes reveal strategic actors |
| Emergent influencers | Missed | PageRank detects rising connectivity |
| Engagement sequencing | Manual judgment | Shortest path = optimal outreach order |
| Sentiment & stance propagation | Per-stakeholder only | Edge-weighted opinion diffusion modeling |

***

## Conclusion

Using a knowledge graph for stakeholder analysis transforms a periodic, manual exercise into a continuously updated intelligence system. The graph schema captures not just *who* stakeholders are but *how they are connected*, enabling three capabilities unavailable in any matrix tool: (1) discovery of hidden coalitions via community detection, (2) identification of broker actors via betweenness centrality, and (3) indirect influence path tracing for strategic access. Coupled with an LLM-powered deep research loop, where the graph guides its own expansion by flagging knowledge gaps and generating new queries, the result is a self-organizing stakeholder map that grows more insightful with each iteration. For practitioners already running Neo4j and Claude-based agentic pipelines, the integration path is direct and the incremental value over static methods is substantial.

***

## Application to MindrianOS

This research is the authority for the **v1.11.x Stakeholder Intelligence milestone** in MindrianOS. v1.10.8 (Phase 84) lands the foundation: Stakeholder node type in the local per-room lazygraph-ops, with bridge traversals from CONTRADICTS/CONVERGES edges back to stakeholder nodes via existing edge types. v1.11.x adds Initiative and Claim node types, full edge vocabulary from Part 2 above, Feynman-MINTO extraction (see `docs/research/2026-04-14-feynman-minto-scn-benchmark.md` for the evaluation protocol), Brain MCP wiring for Neo4j + GDS execution, and the `/mos:stakeholders` command for user-facing queries.

The Feynman-MINTO engine (MindrianOS Phase 81 deliverable) is the taxonomy-constrained extraction pipeline. Its mathematical formalization as a Stakeholder-Centric Network (SCN) extraction system, with benchmark protocol and evaluation metrics, is documented separately as a novel MindrianOS development.
