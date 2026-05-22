# Brain Query Patterns

13 named Cypher/Pinecone templates. Single source of truth for all agents, skills, and commands.

## How to Use

Agents and skills read this file on demand. To execute a pattern:
1. Find the named pattern below
2. For patterns that use `brain_ask`: call `mcp__mindrian-brain__brain_ask` with the
   natural-language question template shown. Read `next_gate.options[].framework` for the
   ranked chain and `directive.guided.framework` for the matched anchor. No Cypher needed.
3. For `brain_search_semantic`, call `mcp__mindrian-brain__brain_search`
   (or `mcp__pinecone-brain__search-records` as fallback).

Never expose raw results to users -- synthesize into insights.

---

## 1. brain_framework_chain

**Purpose:** Given current frameworks + problem type, recommend next framework.

**Tool:** `mcp__mindrian-brain__brain_ask` (ungated -- works for all valid API keys)

**Question template:**

```
recommend a framework for a {problem_type} venture that has already applied {current_frameworks}
```

Example:
```
recommend a framework for a wicked problem venture that has already applied
"Beautiful Question Framework, Domain Selection"
```

**How to read the response:**
- `next_gate.options[].framework` -- ranked list of recommended next frameworks
- `next_gate.options[].confidence` -- confidence score per framework (0..1)
- `next_gate.options[].verb` -- canonical Canon Part 3 verb associated with this option
- `directive.guided.framework` -- the matched anchor framework Brain selected

**Graceful degradation:** if `brain_ask` is unavailable, use the local routing table at
`references/methodology/problem-types.md` -- match the problem type cell, exclude already-applied
frameworks, prioritize the one targeting the emptiest room section.

**Output:** Ranked next frameworks with confidence scores and problem-type alignment.

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

## 11. causal_framework_select

**Purpose:** Given a problem type and venture stage, which causal framework fits best?

```cypher
MATCH (f:Framework)-[:RELATED_TO]->(:Concept {name: 'Causal Reasoning'})
OPTIONAL MATCH (f)-[:TYPICAL_AT]->(s:VentureStage {name: $stage})
RETURN f.name AS framework,
       f.description AS description,
       s IS NOT NULL AS matches_stage
ORDER BY matches_stage DESC
LIMIT 5
```

**Parameters:**
- `$stage` -- venture stage from STATE.md (Pre-Opportunity, Opportunity Identified, Problem Validation, Discovery, Design, Investment)

**Output:** Ranked list of causal frameworks with stage-match indicator.

---

## 12. causal_pattern_match

**Purpose:** Given a causal claim's domain, find which frameworks and teaching examples address similar causal patterns.

```cypher
MATCH (f:Framework)-[:RELATED_TO]->(:Concept {name: 'Causal Reasoning'})
OPTIONAL MATCH (f)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
WHERE pt.name CONTAINS $domain OR pt.name CONTAINS $problem_keyword
OPTIONAL MATCH (f)-[a:APPLIED_IN]->(e:Example)
RETURN f.name AS framework,
       collect(DISTINCT pt.name) AS problem_types,
       collect(DISTINCT e.project_name)[0..3] AS example_projects,
       a.grade_numeric AS example_grade
ORDER BY size(collect(DISTINCT pt.name)) DESC
LIMIT 5
```

**Parameters:**
- `$domain` -- causal claim domain (materials, business, competitive, financial, team, legal, general)
- `$problem_keyword` -- keyword from the causal claim's cause or effect text

**Output:** Frameworks that address similar problem types, with teaching examples for calibration.

---

## 13. causal_contradiction_resolve

**Purpose:** When two causal claims contradict, find frameworks and resolution patterns from the Brain.

```cypher
MATCH (f:Framework)-[:RELATED_TO]->(:Concept {name: 'Causal Reasoning'})
WHERE f.name IN ['Six Thinking Hats', 'Cynefin', 'Root Cause Analysis', 'Systems Thinking']
OPTIONAL MATCH (f)-[:CO_OCCURS]->(co:Framework)
OPTIONAL MATCH (f)-[:FEEDS_INTO]->(next:Framework)
RETURN f.name AS framework,
       f.description AS description,
       collect(DISTINCT co.name) AS co_occurs_with,
       collect(DISTINCT next.name) AS feeds_into
LIMIT 10
```

**Parameters:** None -- returns the full contradiction resolution toolkit.

**Output:** Frameworks suited for resolving causal contradictions, with their co-occurrence and chaining relationships.

---

## 14. brain_whitespace_similar

**Purpose:** Given a problem type and optional venture stage, find what whitespace gaps similar ventures discovered.

```cypher
MATCH (wz:WhitespaceZone)-[:EXPLORED_BY]->(f:Framework)
WHERE wz.problem_type = $problem_type
WITH wz, collect(f.name) AS chain, wz.density_score AS density, wz.strategic_rank AS rank
ORDER BY rank ASC, density ASC
RETURN wz.problem_type AS problem_type,
       wz.hypothesis AS hypothesis,
       chain AS framework_chain,
       density,
       rank
LIMIT 10
```

**Parameters:**
- `$problem_type` -- problem classification (Ill-Defined, Well-Defined, Wicked, Un-Defined)

**Output:** Ranked whitespace zones discovered by other ventures with the same problem type, including the framework chains used to explore them.

**Usage notes:** Used by Larry when a user asks "what am I missing?" or when Brain proactively suggests surfaces gaps. Results are anonymized -- no room or user identifying data is stored. Combine with pattern 1 (brain_framework_chain) to recommend next exploration steps.

---

## 15. brain_whitespace_resolve

**Purpose:** Given a whitespace pattern type, find which framework chains have been used to resolve similar gaps.

```cypher
MATCH (pt:ProblemType)-[tw:TYPICAL_WHITESPACE]->(wp:WhitespacePattern)
WHERE wp.type = $whitespace_type
WITH pt, tw.occurrences AS frequency
MATCH (wz:WhitespaceZone {problem_type: wp.type})-[:EXPLORED_BY]->(f:Framework)
WITH pt, frequency, wz, collect({name: f.name, position: wz.density_score}) AS chain
RETURN pt.name AS problem_type,
       frequency AS times_seen,
       wz.hypothesis AS example_hypothesis,
       [c IN chain | c.name] AS resolution_chain
ORDER BY frequency DESC
LIMIT 10
```

**Parameters:**
- `$whitespace_type` -- the whitespace pattern type string (matches WhitespaceZone.problem_type)

**Output:** Problem types that commonly exhibit this whitespace pattern, how often it occurs, example hypotheses, and the framework chains that have explored it.

**Usage notes:** Used when Larry says "ventures like yours typically have a gap in X -- here's how others explored it." The resolution_chain shows the actual methodology sequence used, not just a recommendation. Combine with pattern 14 for full whitespace intelligence: 14 finds WHAT gaps exist, 15 finds HOW to resolve them.
