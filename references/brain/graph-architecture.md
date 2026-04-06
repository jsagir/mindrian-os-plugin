# Brain Graph Architecture -- Structural Guide

How the Neo4j Brain is actually wired. Pre-normalization audit 2026-04-06, v1.8.2 normalization executed same day.

## Post-Normalization Metrics (v1.8.2)

```
Metric                    Before    After    Status
-----------------------------------------------
FEEDS_INTO                    17       47    PASS (target 35+)
TYPICAL_AT                     4       40    PASS (target 30+)
ADDRESSES_PROBLEM_TYPE        38       63    PASS (target 50+)
PREREQUISITE                   0       14    PASS (target 14)
ALIAS_OF                       0       22    PASS (target 20+)
TEACHES                        0      370    PASS (target 16+)
GOVERNS                        0       16    PASS (target 10+)
GROUNDS_FRAMEWORK              0       24    PASS (target 10+)
Bot IMPLEMENTS                 0       14    PASS (target 15)
FrameworkAgent orphans       7/10     0/10   PASS
LazyGraph orphans             511        0   PASS
DictionaryTerm duplicates      19        0   PASS
```

Script: `scripts/v182-brain-optimize.cypher` (19 sections, idempotent)

## The 5-Layer Stack

```
Layer              Nodes    Purpose                         Key Rels
---------------------------------------------------------------------------
L1 Curated          281    Hand-built methodology spine     FEEDS_INTO, TYPICAL_AT,
                           Framework, ProblemType,          ADDRESSES_PROBLEM_TYPE,
                           VentureStage, ValidationTool,    PREREQUISITE, GOVERNS,
                           Bot, Workshop, CorePrinciple,    HAS_AGENT, TEACHES,
                           DeliverableTemplate, CaseStudy   ILLUSTRATES

L2 Document        1,454   Source material chunks           PART_OF (Doc->Chunk),
                           Document, Chunk, DocumentChunk   FIRST_CHUNK, NEXT_CHUNK

L3 Entity          5,316   Extraction bridge layer          HAS_ENTITY (Chunk->Entity),
                           __Entity__ (multi-labeled)       RELATES_TO, CLASSIFIES,
                                                            AUTHORED_BY, HAS_TOPIC

L4 Lazy            8,425   Co-occurrence semantic fabric    CO_OCCURS (245K edges),
                           LazyGraphConcept                 MENTIONED_IN (->Chunk)

L5 Taxonomy          970   Reference knowledge              INTRODUCES_TERM,
                           DictionaryTerm, InnovationTool,  ENHANCES_TOOL,
                           Book, Person, Author             GROUNDS_FRAMEWORK

L6 Runtime         1,449   Usage patterns                   HAD_SESSION,
                           Session, Problem, Insight,       EXPLORED, DISCOVERED,
                           Journey, Assumption, User        SUPPORTS

L7 Other           6,183   Mixed/uncategorized              Various
                           base, Concept, Entity,
                           ProcessStep, Component, etc.
---------------------------------------------------------------------------
Total             24,078   (8,534 more in multi-labeled overlap)
```

## The Critical Structural Insight

**The Lazy layer and the Curated layer have ZERO direct edges between them.**

Confirmed: `MATCH (lgc:LazyGraphConcept)-[r]-(curated) WHERE curated:Framework RETURN count(r)` returns 0.

The only path between them is a 3-hop chain through the Document and Entity layers:

```
LazyGraphConcept -[MENTIONED_IN]-> Chunk <-[HAS_ENTITY]- __Entity__ -[various]-> Framework
                                                                     ^
                                                          Only ~70 edges reach
                                                          curated nodes here
```

This means:
- Any query that tries `(f:Framework)-[:CO_OCCURS]-(lgc)` returns nothing
- The CO_OCCURS graph is a self-contained semantic network
- To use Lazy intelligence for Curated decisions, you must bridge through Chunks
- The ALIAS_OF edges created by normalization scripts partially fix this

## CO_OCCURS Statistics

```
Total edges:       122,915 (directed, weight property on 99.99%)
Weight range:      1 - 33
Distribution:      92% are weight=1 (single co-occurrence)
                   7.7% are weight 2-5
                   0.03% are weight 6+ (only 49 edges -- these are STRONG signals)
No weight:         6 edges (effectively unweighted noise)
```

**Weight interpretation:** Weight = number of document chunks where both concepts appear.
Weight >= 6 is a genuinely strong co-occurrence across the teaching corpus.

## LazyGraphConcept Degree Distribution

```
Total concepts:    8,425
Orphans (0 rels):    511  (safe to delete)
Average degree:       29
Hub threshold:       100+ degree = 751 concepts
Max degree:        1,367 (concept: "Innovation")
```

**Top hubs** (most connected in the CO_OCCURS graph):
- Innovation (1,367), Opportunities (1,070), People (857), Ideas (781)
- Uncertainty (779), Problems (778), Questions (562)
- Trending To The Absurd (516) -- this IS a framework name
- Classroom (439), Creativity (368), Questioning (361)

Hubs above ~400 are generic English words, not PWS-specific.
Hubs in the 50-200 range are the useful signal layer.

## Entity Bridge Layer

The `__Entity__` layer (5,316 nodes) is the extraction output from document processing. Key facts:

- 732 Entity nodes also carry the `Concept` label
- 323 also carry `Person`
- 87 also carry `Book`
- 19 also carry `Framework` (dirty multi-labeling)
- 1 carries `ProblemType` (the Wicked Problem canonical node)

**Entity -> Curated bridges** (only ~70 edges):
- RELATES_TO -> ProblemType: 26 edges
- CLASSIFIES -> ProblemType: 10 edges
- HAS -> Framework: 8 edges
- PART_OF -> Workshop: 8 edges
- ADDRESSES_PROBLEM_TYPE -> ProblemType/Framework: 13 edges
- APPLIED_IN -> Framework: 5 edges

This bridge layer is THIN. Most __Entity__ nodes connect only to Chunks (7,718 HAS_ENTITY edges) and to each other.

## Layer Interaction Map

```
L1 Curated  <--- ~70 edges --->  L3 Entity  <-- 7,718 HAS_ENTITY -->  L2 Document
     |                                |                                     |
     | (after normalization:          |                                     |
     |  ALIAS_OF, GROUNDS_FRAMEWORK)  |                                     |
     |                                |                               1,183 PART_OF
     v                                v                                     |
L5 Taxonomy ---INTRODUCES_TERM-----> L3                              L2 Document
     |         ENHANCES_TOOL                                               |
     |                                                              11,935 MENTIONED_IN
     v                                                                     |
(after normalization:                                                      v
 GROUNDS_FRAMEWORK -> L1)                                            L4 Lazy
                                                                   245K CO_OCCURS
                                                                   (self-contained)
```

## Practical Query Patterns

### Pattern 1: Curated Layer -- Causal Chain Traversal

Walk the FEEDS_INTO spine from any framework:
```cypher
MATCH path = (start:Framework {name: 'Domain Selection'})
             -[:FEEDS_INTO*1..6]->(end)
RETURN [n IN nodes(path) | n.name] AS chain, length(path) AS hops
ORDER BY hops
```

### Pattern 2: Curated Layer -- Reverse Prerequisite Lookup

What must be completed before a target framework?
```cypher
MATCH (target:Framework {name: 'PWS Triple Validation Compass'})
MATCH (upstream)-[:FEEDS_INTO|PREREQUISITE*1..4]->(target)
RETURN upstream.name AS prerequisite, labels(upstream)[0] AS type
```

### Pattern 3: Curated Layer -- Stage-Based Recommendation

What frameworks are appropriate for a venture stage?
```cypher
MATCH (stage:VentureStage {name: $venture_stage})
MATCH (f)-[:TYPICAL_AT]->(stage)
OPTIONAL MATCH (f)-[:FEEDS_INTO]->(next)
WHERE NOT (next)-[:TYPICAL_AT]->(stage)
RETURN f.name AS current_framework, collect(DISTINCT next.name) AS leads_to
```

### Pattern 4: Curated Layer -- Problem Type Routing

Given a problem classification, which frameworks apply?
```cypher
MATCH (pt:ProblemType {name: $problem_type})
MATCH (f)-[:ADDRESSES_PROBLEM_TYPE]->(pt)
OPTIONAL MATCH (f)-[:TYPICAL_AT]->(s:VentureStage)
RETURN f.name AS framework, collect(s.name) AS stages,
       labels(f)[0] AS type
ORDER BY size(collect(s.name)) DESC
```

### Pattern 5: Lazy Layer -- Semantic Neighborhood

Find concepts that co-occur with a target concept (weight >= 2 filters noise):
```cypher
MATCH (n:LazyGraphConcept {name: $concept})
      -[r:CO_OCCURS]->(neighbor:LazyGraphConcept)
WHERE r.weight >= 2
RETURN neighbor.name AS concept, r.weight AS strength
ORDER BY strength DESC
LIMIT 20
```

### Pattern 6: Lazy -> Curated Bridge (3-hop)

Find curated Framework nodes semantically related to a lazy concept:
```cypher
MATCH (lazy:LazyGraphConcept {name: $concept})
      -[:MENTIONED_IN]->(chunk:Chunk)
      <-[:HAS_ENTITY]-(entity:__Entity__)
WITH entity, count(DISTINCT chunk) AS chunk_support
WHERE chunk_support >= 2
MATCH (entity)-[:RELATES_TO|PART_OF|HAS|CLASSIFIES]->(curated)
WHERE any(l IN labels(curated) WHERE l IN ['Framework','ProblemType'])
RETURN curated.name AS curated_node, labels(curated)[0] AS type, 
       chunk_support
ORDER BY chunk_support DESC
LIMIT 10
```

### Pattern 7: ALIAS_OF Traversal (post-normalization)

After running normalization scripts, use ALIAS_OF for ProblemType queries:
```cypher
MATCH (pt:ProblemType {name: $problem_type})
OPTIONAL MATCH (alias)-[:ALIAS_OF]->(pt)
WITH pt, collect(alias) + [pt] AS all_nodes
UNWIND all_nodes AS node
MATCH (node)-[r]-(connected)
RETURN DISTINCT connected.name, labels(connected)[0], type(r)
LIMIT 30
```

### Pattern 8: Full Provenance Chain (post-normalization)

Book -> Framework -> ProblemType with stage context:
```cypher
MATCH (b:Book)-[:GROUNDS_FRAMEWORK]->(f:Framework)
      -[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
OPTIONAL MATCH (f)-[:TYPICAL_AT]->(s:VentureStage)
RETURN b.name AS book, f.name AS framework, 
       pt.name AS problem_type, collect(s.name) AS stages
ORDER BY f.name
```

### Pattern 9: Lazy Concept Promotion Candidates

Find LazyGraphConcepts worth promoting to Concept based on curated proximity:
```cypher
MATCH (lgc:LazyGraphConcept)-[:MENTIONED_IN]->(chunk:Chunk)
      <-[:HAS_ENTITY]-(entity:__Entity__)
      -[]->(curated)
WHERE any(l IN labels(curated) WHERE l IN ['Framework','ProblemType','Book'])
WITH lgc, count(DISTINCT curated) AS curated_links,
     size([(lgc)-[:CO_OCCURS]-() | 1]) AS co_occurs_degree
WHERE curated_links >= 2 AND co_occurs_degree >= 20
RETURN lgc.name AS candidate, curated_links, co_occurs_degree
ORDER BY curated_links DESC, co_occurs_degree DESC
LIMIT 30
```

### Pattern 10: Cross-Domain Discovery via Lazy Layer

Find unexpected connections between two frameworks through CO_OCCURS:
```cypher
// First find lazy concepts that bridge to both framework names
MATCH (lgc1:LazyGraphConcept)-[:MENTIONED_IN]->(c1:Chunk)
      <-[:HAS_ENTITY]-(e1)-[]->(f1:Framework {name: $framework_a})
MATCH (lgc1)-[:CO_OCCURS]-(bridge:LazyGraphConcept)-[:CO_OCCURS]-(lgc2:LazyGraphConcept)
MATCH (lgc2)-[:MENTIONED_IN]->(c2:Chunk)
      <-[:HAS_ENTITY]-(e2)-[]->(f2:Framework {name: $framework_b})
WHERE bridge <> lgc1 AND bridge <> lgc2
RETURN DISTINCT bridge.name AS bridge_concept,
       lgc1.name AS near_a, lgc2.name AS near_b
LIMIT 10
```

## What MindrianOS Uses Each Layer For

| MindrianOS Feature | Primary Layer | Bridge Needed? |
|---|---|---|
| /mos:suggest-next | L1 (FEEDS_INTO + TYPICAL_AT) | No |
| /mos:diagnose | L1 (ADDRESSES_PROBLEM_TYPE) | No |
| /mos:grade | L1 (Example nodes -- MISSING) | No |
| /mos:find-connections | L4 (CO_OCCURS) -> L1 | Yes, 3-hop |
| /mos:find-analogies | L4 (CO_OCCURS) + L1 (ADDRESSES) | Yes, 3-hop |
| /mos:query (natural language) | L1 + L4 + L5 | Pattern-dependent |
| /mos:research | External (web) + L5 (Books) | No |
| /mos:act | L1 (FEEDS_INTO chain) | No |
| Proactive intelligence | L1 (gap_assess, contradiction_check) | No |
| Grading calibration | L1 (Example nodes -- MISSING) | No |
| Meeting filing | L2 (new Chunks) -> L3 -> L4 | Creates new bridges |

## Known Gaps (post-normalization)

1. **Grading calibration data missing:** 0 Example nodes have grade/rubric_scores.
   Schema.md promises 100+. This is a data loading problem, not a wiring problem.

2. **Lazy-to-Curated bridge is thin:** Only ~70 edges connect __Entity__ to curated
   nodes. The ALIAS_OF edges from normalization help, but the Entity layer needs
   enrichment with more RELATES_TO/CLASSIFIES edges.

3. **CO_OCCURS is unweighted for 92% of edges:** Weight=1 means "appeared in same
   chunk once." Only 49 edges have weight >= 6. The semantic signal is sparse.

4. **511 orphan LazyGraphConcepts:** Safe to delete but not yet cleaned.

5. **The "Other" layer (6,183 nodes):** Uncategorized Concept, Entity, ProcessStep,
   Component, base nodes. Many are useful but unlabeled relative to MindrianOS
   taxonomy. Future work: classify and promote valuable ones.
