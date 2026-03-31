# Brain Query Patterns

9 named Cypher/Pinecone templates. Single source of truth for all agents, skills, and commands.

## How to Use

Agents and skills read this file on demand. To execute a pattern:
1. Find the named pattern below
2. Replace `$parameters` with specific values from current context
3. Call `mcp__neo4j-brain__read_neo4j_cypher` with the adapted Cypher
4. For `brain_search_semantic`, call `mcp__pinecone-brain__search-records` instead

Never run Cypher without a LIMIT clause. Never expose raw results to users -- synthesize into insights.

---

## 1. brain_framework_chain

**Purpose:** Given current frameworks + problem type, recommend next framework.

```cypher
MATCH (current:Framework)-[r:FEEDS_INTO|TRANSFORMS_OUTPUT_TO]->(next:Framework)
WHERE current.name IN $current_frameworks
AND NOT next.name IN $current_frameworks
OPTIONAL MATCH (next)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType {name: $problem_type})
RETURN next.name AS framework,
       type(r) AS relation,
       r.confidence AS confidence,
       r.transform_description AS transform,
       pt IS NOT NULL AS matches_problem_type
ORDER BY r.confidence DESC, matches_problem_type DESC
LIMIT 5
```

**Output:** List of recommended next frameworks with confidence scores and problem-type alignment.

---

## 2. brain_grade_calibrate

**Purpose:** Get rubric score distribution and percentile data from real graded projects.

```cypher
MATCH (f:Framework)-[a:APPLIED_IN]->(e:Example)
WHERE f.name IN $frameworks_used
RETURN e.project_name AS project,
       e.grade AS grade,
       e.grade_numeric AS score,
       e.rubric_scores AS rubric,
       e.feedback_patterns AS feedback,
       e.percentile AS percentile,
       a.quality_score AS quality
ORDER BY e.grade_numeric DESC
LIMIT 20
```

**Output:** Distribution of grades, rubric scores, and feedback patterns for calibration.

---

## 3. brain_find_patterns

**Purpose:** Find similar ventures via Tool/Framework co-occurrence patterns.

```cypher
MATCH (f:Framework)-[:CO_OCCURS]->(related:Framework)
WHERE f.name IN $current_frameworks
WITH related, count(*) AS overlap
OPTIONAL MATCH (related)-[:APPLIED_IN]->(e:Example)
RETURN related.name AS framework,
       overlap,
       collect(DISTINCT e.project_name)[..3] AS example_projects,
       related.category AS category
ORDER BY overlap DESC
LIMIT 10
```

**Output:** Frameworks that commonly co-occur with current set, plus example projects.

---

## 4. brain_concept_connect

**Purpose:** GraphRAG -- immediate connections from a concept node.

```cypher
MATCH (c {name: $concept})-[r]->(connected)
RETURN c.name AS source,
       type(r) AS relationship,
       connected.name AS target,
       labels(connected)[0] AS target_type,
       r.confidence AS confidence
ORDER BY r.confidence DESC
LIMIT 20
```

**Output:** All immediate graph neighbors of a concept with relationship types.

---

## 5. brain_cross_domain

**Purpose:** Cross-domain discovery between two domains via shared Framework/Concept connections.

```cypher
MATCH (a:Concept {name: $domain_a})-[:CO_OCCURS|FEEDS_INTO*1..2]-(shared)-[:CO_OCCURS|FEEDS_INTO*1..2]-(b:Concept {name: $domain_b})
WHERE shared <> a AND shared <> b
RETURN DISTINCT shared.name AS bridge,
       labels(shared)[0] AS bridge_type,
       count(*) AS path_count
ORDER BY path_count DESC
LIMIT 15
```

**Output:** Bridging concepts/frameworks that connect two domains.

---

## 6. brain_contradiction_check

**Purpose:** Find Framework pairs with conflicting effectiveness for the same ProblemType.

```cypher
MATCH (f1:Framework)-[a1:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)<-[a2:ADDRESSES_PROBLEM_TYPE]-(f2:Framework)
WHERE f1.name IN $room_frameworks
AND f2.name IN $room_frameworks
AND f1 <> f2
AND abs(a1.effectiveness - a2.effectiveness) > 0.4
RETURN f1.name AS framework_a,
       f2.name AS framework_b,
       pt.name AS problem_type,
       a1.effectiveness AS effectiveness_a,
       a2.effectiveness AS effectiveness_b,
       abs(a1.effectiveness - a2.effectiveness) AS gap
ORDER BY gap DESC
LIMIT 10
```

**Output:** Framework pairs with significantly different effectiveness ratings for the same problem type.

---

## 7. brain_gap_assess

**Purpose:** Given current room frameworks, find missing prerequisites and feed-into targets.

```cypher
MATCH (current:Framework)-[:PREREQUISITE]->(prereq:Framework)
WHERE current.name IN $room_frameworks
AND NOT prereq.name IN $room_frameworks
RETURN 'PREREQUISITE' AS gap_type,
       current.name AS for_framework,
       prereq.name AS missing,
       prereq.description AS description
UNION
MATCH (current:Framework)-[:FEEDS_INTO]->(target:Framework)
WHERE current.name IN $room_frameworks
AND NOT target.name IN $room_frameworks
RETURN 'FEEDS_INTO' AS gap_type,
       current.name AS for_framework,
       target.name AS missing,
       target.description AS description
LIMIT 10
```

**Output:** Missing prerequisites and natural next-step frameworks not yet in the room.

---

## 8. brain_search_semantic

**Purpose:** Pinecone vector search -- not Cypher. Semantic similarity across Brain embeddings.

```
Tool: mcp__pinecone-brain__search-records
Parameters:
  query: $search_text
  top_k: 10
  filter: { type: $node_type }  (optional -- filter by Framework, Book, Tool, etc.)
```

**Output:** Ranked list of semantically similar items with scores and metadata.

**Usage notes:** Use for fuzzy matching when exact node names are unknown. Combine with Cypher patterns for hybrid retrieval: semantic search finds candidates, Cypher explores their graph neighborhood.

---

## 9. brain_analogy_search

**Purpose:** Cross-domain analogy discovery -- find frameworks from DIFFERENT domains that address the SAME problem type.

```cypher
MATCH (f1:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
WHERE f1.category = $source_category
WITH pt, collect(f1) AS source_frameworks
MATCH (f2:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt)
WHERE NOT f2.category = $source_category
AND NOT f2 IN source_frameworks
OPTIONAL MATCH (f2)-[:CO_OCCURS]->(bridge:Framework)
WHERE bridge IN source_frameworks
RETURN f2.name AS framework,
       f2.category AS category,
       f2.description AS description,
       pt.name AS problem_type,
       bridge.name AS bridge_framework
ORDER BY bridge IS NOT NULL DESC
LIMIT 15
```

**Parameters:**
- `$source_category` -- the venture's primary domain/category (e.g., "healthcare", "education", "fintech")

**Output:** Frameworks from other domains that solve the same type of problem, with optional bridging frameworks that connect the two domains.

**Usage notes:** Used by the Design-by-Analogy pipeline (Stage 3 SEARCH) and `/mos:find-analogies --brain`. The key insight: same problem type + different domain = structural analogy candidate. Bridge frameworks increase confidence that the analogy is meaningful, not superficial.
