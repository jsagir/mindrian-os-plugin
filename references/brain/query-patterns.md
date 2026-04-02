# Brain Query Patterns

10 named Cypher/Pinecone templates. Single source of truth for all agents, skills, and commands.

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

---

## 10. brain_proactive_suggest

**Purpose:** Given the user's current Room state (frameworks used, venture stage, section health, active signals), return a ranked list of ACTIONS the Brain recommends -- not just frameworks, but specific /mos: commands with JTBD reasoning.

This is the Brain's proactive intelligence engine. It doesn't wait to be asked. It knows what works based on 100+ real projects and tells Larry WHAT to suggest and WHY.

### Query 10a: What Should the User Do Next?

```cypher
// Find frameworks the user HASN'T used that their current frameworks FEED INTO
MATCH (current:Framework)-[r:FEEDS_INTO]->(next:Framework)
WHERE current.name IN $room_frameworks
AND NOT next.name IN $room_frameworks
WITH next, r, r.confidence AS confidence

// Check if next framework addresses the user's problem type
OPTIONAL MATCH (next)-[apt:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType {name: $problem_type})

// Check if there's a phase/stage progression pattern
OPTIONAL MATCH (next)-[:HAS_PHASE]->(phase)
WITH next, confidence, pt, count(phase) AS phase_count

// Get success data from real projects
OPTIONAL MATCH (next)-[:APPLIED_IN]->(example:Example)
WHERE example.grade_numeric >= 80

RETURN next.name AS framework,
       next.description AS description,
       next.category AS category,
       confidence,
       pt IS NOT NULL AS matches_problem,
       phase_count,
       count(example) AS success_count
ORDER BY confidence DESC, matches_problem DESC, success_count DESC
LIMIT 5
```

**Parameters:**
- `$room_frameworks` -- frameworks the user has already used (from Room artifacts' methodology frontmatter)
- `$problem_type` -- inferred from STATE.md (e.g., "wicked", "ill-defined-complex")

**Output:** Ranked next-action recommendations with confidence and success data.

### Query 10b: What's the Proven Sequence for This Stage?

```cypher
// Find the most common framework SEQUENCE for this venture stage
MATCH (f1:Framework)-[r:FEEDS_INTO]->(f2:Framework)-[:FEEDS_INTO]->(f3:Framework)
WHERE f1.name IN $room_frameworks
AND NOT f2.name IN $room_frameworks
AND NOT f3.name IN $room_frameworks

// Check sequence success in real projects
OPTIONAL MATCH (f1)-[:APPLIED_IN]->(e:Example)<-[:APPLIED_IN]-(f2)
WHERE e.grade_numeric >= 75

RETURN f1.name AS current,
       f2.name AS next_step,
       f3.name AS after_that,
       r.confidence AS step_confidence,
       r.transform_description AS why_this_order,
       count(e) AS projects_used_this_sequence
ORDER BY step_confidence DESC, projects_used_this_sequence DESC
LIMIT 3
```

**Output:** Proven 3-step sequences starting from the user's current frameworks.

### Query 10c: What Are Users at This Stage Missing?

```cypher
// Compare this user's framework set against the TYPICAL set for their venture stage
MATCH (stage:VentureStage {name: $venture_stage})<-[:TYPICAL_AT]-(typical:Framework)
WHERE NOT typical.name IN $room_frameworks
OPTIONAL MATCH (typical)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType {name: $problem_type})
RETURN typical.name AS missing_framework,
       typical.description AS why_it_matters,
       typical.category AS category,
       pt IS NOT NULL AS addresses_your_problem
ORDER BY addresses_your_problem DESC, typical.importance DESC
LIMIT 5
```

**Parameters:**
- `$venture_stage` -- from STATE.md (Pre-Opportunity, Discovery, Validation, Design, Investment)

**Output:** Frameworks typical for this stage that the user hasn't used yet.

### How Larry Uses Pattern 10 (Proactive Command Mapping)

The Brain returns framework names. Larry maps them to /mos: commands using the routing table in `references/methodology/index.md`. The mapping:

| Brain Returns | Larry Suggests | JTBD Framing |
|--------------|---------------|-------------|
| "Jobs-to-Be-Done" not used | `/mos:analyze-needs` | "When you don't know what job your customer hires for, you want to discover the struggling moment. `/mos:analyze-needs` does exactly that." |
| "Blue Ocean Strategy" as next step | `/mos:dominant-designs` | "When you've mapped customer needs but don't see a differentiated position, you want to find whitespace. `/mos:dominant-designs` does exactly that." |
| "Six Thinking Hats" for wicked problem | `/mos:think-hats` or `/mos:persona --parallel` | "When your problem has 8/10 wicked characteristics, you want multiple perspectives simultaneously. `/mos:persona --parallel` does exactly that -- 6 hats in 2 minutes." |
| Contradiction between frameworks | `/mos:find-analogies` | "When Brain sees your frameworks disagree on effectiveness, you want to find how other domains resolved the same tension. `/mos:find-analogies --brain` does exactly that." |
| Missing prerequisite | The specific prerequisite command | "When Brain says you skipped a prerequisite that 80% of successful ventures complete first, you want to backfill before it compounds. `/mos:[prereq]` does exactly that." |
| 3-step proven sequence | Suggest step 2 | "When Brain has seen 47 ventures use this exact sequence and 80% scored above B+, you want to follow the proven path. Next step: `/mos:[step2]`." |

### Integration Point: session-start Hook

The session-start hook already queries Brain for framework chains (see commands/help.md Brain Enhancement). Pattern 10 extends this:

1. SessionStart loads room frameworks from STATE.md
2. If Brain is connected, run `brain_proactive_suggest` (10a)
3. Store top 3 suggestions in session context
4. Larry's JTBD provoked suggestions (every 3-7 turns) draw from these Brain-ranked suggestions FIRST before falling back to local heuristics

This means Brain-connected users get SMARTER suggestions than free-tier users. The Brain knows what worked for 100+ real ventures. Local heuristics are good. Brain suggestions are calibrated.

### Graceful Degradation

| Tier | Source | Quality |
|------|--------|---------|
| Brain + Room | Pattern 10a/10b/10c + Room Signals | Best: calibrated from real projects, sequence-aware, stage-matched |
| Room only | Local heuristics from STATE.md + KuzuDB | Good: Room-specific but no cross-venture calibration |
| No Room | Generic stage-based defaults | Okay: standard recommendations from methodology index |

Brain suggestions ENRICH. They never GATE. Free-tier users still get good suggestions from local Room intelligence.

---

## 11. brain_causal_framework_select

**Purpose:** Given a problem type and causal reasoning need, recommend which frameworks REVEAL causation vs merely describe it.

```cypher
MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType {name: $problem_type})
WHERE f.category IN ['causal-analysis', 'systems-thinking', 'root-cause', 'assumption-testing']
OPTIONAL MATCH (f)-[:APPLIED_IN]->(e:Example)
WHERE e.grade_numeric >= 75
RETURN f.name AS framework,
       f.description AS description,
       f.category AS category,
       count(e) AS success_count
ORDER BY success_count DESC
LIMIT 5
```

**Parameters:**
- `$problem_type` -- from STATE.md (e.g., "wicked", "ill-defined")

**Output:** Frameworks proven to reveal causal mechanisms for this problem type. Used by `/mos:causal` to select the right causal analysis approach.

**How Larry Uses Pattern 11:**
Larry maps Brain's framework recommendations to causal analysis modes:

| Brain Returns | Causal Mode | Larry's Approach |
|--------------|-------------|-----------------|
| "Root Cause Analysis" | 5 Whys chain | Each "why" becomes a CAUSES edge in KuzuDB |
| "Systems Thinking" | Feedback loop mapping | Bidirectional CAUSES edges, cycle detection |
| "Challenge Assumptions" | Cascade analysis | CASCADES_TO edges from assumption to dependent claims |
| "Scenario Planning" | Counterfactual branching | Competing causal chains for different futures |
| "Reverse Salient" | Bottleneck causation | Find where one blocked cause prevents an entire system |

---

## 12. brain_causal_pattern_match

**Purpose:** Find which causal patterns the Brain has seen in similar ventures. What causal mistakes do ventures at this stage commonly make?

```cypher
MATCH (f:Framework)-[:APPLIED_IN]->(e:Example)
WHERE f.name IN $room_frameworks
AND e.feedback_patterns IS NOT NULL
WITH e, collect(f.name) AS frameworks_used
WHERE any(p IN e.feedback_patterns WHERE p CONTAINS 'assumption' OR p CONTAINS 'causal' OR p CONTAINS 'root cause')
RETURN e.project_name AS project,
       e.grade AS grade,
       e.feedback_patterns AS patterns,
       frameworks_used
ORDER BY e.grade_numeric DESC
LIMIT 10
```

**Parameters:**
- `$room_frameworks` -- frameworks the user has already used

**Output:** Real projects with assumption/causal-related feedback patterns. Larry uses these to warn users about common causal reasoning mistakes.

**Common Feedback Patterns (from 100+ real projects):**
- "Vision-to-Execution Gap" → causal chain from vision to execution has missing links
- "Framework Vomit" → applying frameworks without tracing causal connections between them
- "Assumption Stack" → untested assumptions stacked 3+ deep without validation
- "Single Stakeholder" → causal model only considers one actor's perspective

---

## 13. brain_causal_contradiction_resolve

**Purpose:** When two causal claims contradict each other, find how similar contradictions were resolved in past ventures.

```cypher
MATCH (f1:Framework)-[c:CO_OCCURS]->(f2:Framework)
WHERE f1.name IN $contradicting_frameworks
AND f2.name IN $contradicting_frameworks
OPTIONAL MATCH (f1)-[:APPLIED_IN]->(e:Example)<-[:APPLIED_IN]-(f2)
WHERE e.grade_numeric >= 70
RETURN f1.name AS framework_a,
       f2.name AS framework_b,
       c.context AS co_occurrence_context,
       collect(DISTINCT e.project_name)[..3] AS resolved_in_projects,
       count(e) AS resolution_count
ORDER BY resolution_count DESC
LIMIT 5
```

**Parameters:**
- `$contradicting_frameworks` -- the two frameworks producing conflicting causal claims

**Output:** How past ventures resolved similar framework contradictions. Used when Larry detects competing causal explanations from different methodology runs.

**How Larry Uses Pattern 13:**
When two causal claims contradict:
1. Query Pattern 13 to find resolution precedents
2. If precedent exists: "In 3 previous ventures, this contradiction was resolved by [approach]. The successful ones used [framework] to disambiguate."
3. If no precedent: "This is a novel contradiction. Let's test both causal hypotheses: [prediction A] vs [prediction B]. Which can we validate fastest?"

---

## Causal Layer Integration Notes

**Brain is READ-ONLY for causal data.** All causal claims, edges, and cascade data are stored in local KuzuDB. Brain provides DIRECTIVES for:
- Which frameworks to use for causal analysis (Pattern 11)
- What causal mistakes to avoid (Pattern 12)
- How to resolve causal contradictions (Pattern 13)

**See also:** `references/brain/causal-directives.md` for the full directive set that governs Larry's causal reasoning behavior.
