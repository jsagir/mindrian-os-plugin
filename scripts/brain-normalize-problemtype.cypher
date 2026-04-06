// ============================================================
// BRAIN NORMALIZATION -- PROBLEM TYPE CONSOLIDATION
// Run AFTER brain-normalize-final.cypher
//
// The worst fragmentation in the graph:
//   - "Well-Defined Problem": LazyGraphConcept has 348 rels vs canonical 83
//   - "Ill-Defined Problem": 40+ variants, 8x DictionaryTerm duplicates
//   - "Wicked Problem": canonical is __Entity__+ProblemType, needs cleanup
//   - "Undefined Problem": 15+ variants scattered across labels
//
// Strategy:
//   1. Clean canonical ProblemType labels
//   2. Dedup DictionaryTerms (8->1)
//   3. ALIAS_OF high-rel LazyGraphConcepts to canonical
//   4. ALIAS_OF other significant variants
//   5. Wire the 2D matrix nodes
//   6. DON'T delete LazyGraph nodes -- their CO_OCCURS are valuable
//      for semantic search. ALIAS_OF lets traversal find canonical.
// ============================================================


// ============================================================
// PHASE 1: CLEAN CANONICAL PROBLEMTYPE LABELS
// Remove stale labels from canonical nodes so queries are clean
// ============================================================

// Wicked Problem: remove __Entity__ label from canonical ProblemType
MATCH (wp:ProblemType {name: 'Wicked Problem'})
WHERE '__Entity__' IN labels(wp)
REMOVE wp:__Entity__;

// Ill-Defined Problem: has Phase label (correct -- it IS a phase in PWS)
// Keep both ProblemType + Phase

// Well-Defined Problem: also ProblemType+Phase (correct)
// But there's ALSO a VentureStage node with same name (id:1517)
// These are DIFFERENT things -- don't merge. But wire them.
MATCH (pt:ProblemType {name: 'Well-Defined Problem'})
MATCH (vs:VentureStage {name: 'Well-Defined Problem'})
MERGE (pt)-[:CORRESPONDS_TO]->(vs);

// Ensure Wicked Problem has the right properties
MATCH (wp:ProblemType {name: 'Wicked Problem'})
SET wp.canonical = true
SET wp.complexity = 'chaotic'
SET wp.description = 'Complex, ill-structured problems with no definitive formulation, no stopping rule, and where every attempt at solution changes the problem itself. (Rittel & Webber, 1973)';

// Ensure Tame Problem is properly set
MATCH (tp:ProblemType {name: 'Tame Problem'})
SET tp.canonical = true
SET tp.complexity = 'complicated'
SET tp.description = 'Problems with clear formulation, definitive solutions, and testable answers. The opposite of wicked.';


// ============================================================
// PHASE 2: DICTIONARY TERM DEDUPLICATION
// 8x "Ill-defined Problem", 8x "Well-defined Problem", 3x "Wicked Problem"
// ============================================================

// Ill-defined Problem: 8 copies -> 1
MATCH (dt:DictionaryTerm {name: 'Ill-defined Problem'})
WITH collect(dt) AS nodes
WHERE size(nodes) > 1
CALL apoc.refactor.mergeNodes(nodes, {properties: 'combine', mergeRels: true}) YIELD node
SET node.canonical_problemtype = 'Ill-Defined Problem'
RETURN 'Ill-defined Problem DictionaryTerms merged' AS status;

// Well-defined Problem: 8 copies -> 1
MATCH (dt:DictionaryTerm {name: 'Well-defined Problem'})
WITH collect(dt) AS nodes
WHERE size(nodes) > 1
CALL apoc.refactor.mergeNodes(nodes, {properties: 'combine', mergeRels: true}) YIELD node
SET node.canonical_problemtype = 'Well-Defined Problem'
RETURN 'Well-defined Problem DictionaryTerms merged' AS status;

// Wicked Problem: 3 copies -> 1
MATCH (dt:DictionaryTerm {name: 'Wicked Problem'})
WITH collect(dt) AS nodes
WHERE size(nodes) > 1
CALL apoc.refactor.mergeNodes(nodes, {properties: 'combine', mergeRels: true}) YIELD node
SET node.canonical_problemtype = 'Wicked Problem'
RETURN 'Wicked Problem DictionaryTerms merged' AS status;

// Wicked Problems (plural): already just 1 copy, wire it
MATCH (dt:DictionaryTerm {name: 'Wicked Problems'})
MATCH (canonical:ProblemType {name: 'Wicked Problem'})
MERGE (dt)-[:DEFINES]->(canonical);

// Wire surviving DictionaryTerms to their canonical ProblemType
MATCH (dt:DictionaryTerm {name: 'Ill-defined Problem'})
MATCH (canonical:ProblemType {name: 'Ill-Defined Problem'})
MERGE (dt)-[:DEFINES]->(canonical);

MATCH (dt:DictionaryTerm {name: 'Well-defined Problem'})
MATCH (canonical:ProblemType {name: 'Well-Defined Problem'})
MERGE (dt)-[:DEFINES]->(canonical);

MATCH (dt:DictionaryTerm {name: 'Wicked Problem'})
MATCH (canonical:ProblemType {name: 'Wicked Problem'})
MERGE (dt)-[:DEFINES]->(canonical);


// ============================================================
// PHASE 3: LAZYGRAPHCONCEPT -> ALIAS_OF CANONICAL
// These have the MOST rels in the graph. We can't delete them
// (their CO_OCCURS edges are the semantic fabric). Instead we
// create ALIAS_OF edges so traversal can find the canonical node.
// ============================================================

// Well-Defined Problem variants (348 + 274 + 142 + 54 + 52 + 39 + 25 + 20 + 19 = 973 total rels!)
MATCH (lgc:LazyGraphConcept)
WHERE lgc.name IN [
  'Well-Defined Problem', 'A Well-Defined Problem', 'The Well-Defined Problem',
  'Well-Defined Problems', 'Well Defined Problems', 'An Interesting Well-Defined Problem',
  'Your Well-Defined Problem', 'Only Well-Defined Problems', 'Well-Defined Opportunities',
  'Well-Defined Problem Confidential'
]
MATCH (canonical:ProblemType {name: 'Well-Defined Problem'})
MERGE (lgc)-[:ALIAS_OF]->(canonical);

// Ill-Defined Problem variants (174 + 104 + 67 + 47 + 25 + 15 = 432 total rels)
MATCH (lgc:LazyGraphConcept)
WHERE lgc.name IN [
  'Ill-Defined Problems', 'Un-Defined And Ill-Defined Problems',
  'An Ill-Defined Problem', 'Ill-defined', 'Ill-Defined Problems Goal',
  'Exploring Ill-Defined Problems', 'Ill-Defined Problems Tools',
  'Ill-Defined Problems Tools For', 'Exploring Ill-Defined Problems Confidential',
  'Un-Defined And Ill-Defined Spaces',
  'Only 2 Ill-Defined Well-Defined Un'
]
MATCH (canonical:ProblemType {name: 'Ill-Defined Problem'})
MERGE (lgc)-[:ALIAS_OF]->(canonical);

// Wicked Problem variants (125 + 91 + 68 + 31 + 28 + 24 = 367 total rels)
MATCH (lgc:LazyGraphConcept)
WHERE lgc.name IN [
  'Wicked Problems', 'Wicked Problem', 'A Wicked Problem',
  'Every Wicked Problem', 'Wicked Problems Horst Rittel',
  'O Wicked Problem Exploration'
]
MATCH (canonical:ProblemType {name: 'Wicked Problem'})
MERGE (lgc)-[:ALIAS_OF]->(canonical);

// Undefined Problem variants (61 + 53 + 39 = 153 total rels)
MATCH (lgc:LazyGraphConcept)
WHERE lgc.name IN [
  'Undefined', 'Undefined Problems', 'Complex Undefined Problems'
]
MATCH (canonical:ProblemType {name: 'Undefined Problem'})
MERGE (lgc)-[:ALIAS_OF]->(canonical);

// Delete zero-rel LazyGraph variants (pure noise)
MATCH (lgc:LazyGraphConcept)
WHERE lgc.name IN [
  'ill-defined problem', 'ill-defined problems',
  'well-defined problem', 'well-defined problems',
  'wicked problems'
]
AND NOT (lgc)--()
DELETE lgc;


// ============================================================
// PHASE 4: OTHER LABEL VARIANTS -> ALIAS_OF CANONICAL
// ChallengeType, PipelineStage, Component, Concept, __Entity__
// ============================================================

// ChallengeType variants (3 nodes: Ill-Defined, Well-Defined, Undefined, Wicked)
MATCH (ct:ChallengeType {name: 'Ill-Defined Problem'})
MATCH (canonical:ProblemType {name: 'Ill-Defined Problem'})
MERGE (ct)-[:ALIAS_OF]->(canonical);

MATCH (ct:ChallengeType {name: 'Well-Defined Problem'})
MATCH (canonical:ProblemType {name: 'Well-Defined Problem'})
MERGE (ct)-[:ALIAS_OF]->(canonical);

MATCH (ct:ChallengeType {name: 'Undefined Problem'})
MATCH (canonical:ProblemType {name: 'Undefined Problem'})
MERGE (ct)-[:ALIAS_OF]->(canonical);

MATCH (ct:ChallengeType {name: 'Wicked Problem'})
MATCH (canonical:ProblemType {name: 'Wicked Problem'})
MERGE (ct)-[:ALIAS_OF]->(canonical);

// PipelineStage variants
MATCH (ps:PipelineStage {name: 'Ill-Defined Problem Stage'})
MATCH (canonical:ProblemType {name: 'Ill-Defined Problem'})
MERGE (ps)-[:STAGE_FOR]->(canonical);

MATCH (ps:PipelineStage {name: 'Undefined Problem Stage'})
MATCH (canonical:ProblemType {name: 'Undefined Problem'})
MERGE (ps)-[:STAGE_FOR]->(canonical);

MATCH (ps:PipelineStage {name: 'Well-Defined Problem Stage'})
MATCH (canonical:ProblemType {name: 'Well-Defined Problem'})
MERGE (ps)-[:STAGE_FOR]->(canonical);

// Component variants
MATCH (c:Component {name: 'Ill-Defined Problems'})
MATCH (canonical:ProblemType {name: 'Ill-Defined Problem'})
MERGE (c)-[:ALIAS_OF]->(canonical);

MATCH (c:Component {name: 'Well-Defined Problems'})
MATCH (canonical:ProblemType {name: 'Well-Defined Problem'})
MERGE (c)-[:ALIAS_OF]->(canonical);

MATCH (c:Component {name: 'Undefined Problems'})
MATCH (canonical:ProblemType {name: 'Undefined Problem'})
MERGE (c)-[:ALIAS_OF]->(canonical);

// __Entity__ variants with significant rels
MATCH (e)
WHERE e.name = 'Ill-Defined Problem'
AND '__Entity__' IN labels(e) AND 'Concept' IN labels(e)
MATCH (canonical:ProblemType {name: 'Ill-Defined Problem'})
MERGE (e)-[:ALIAS_OF]->(canonical);

MATCH (e)
WHERE e.name = 'Well-Defined Problem'
AND '__Entity__' IN labels(e)
AND NOT 'ProblemType' IN labels(e) AND NOT 'VentureStage' IN labels(e)
MATCH (canonical:ProblemType {name: 'Well-Defined Problem'})
MERGE (e)-[:ALIAS_OF]->(canonical);

MATCH (e)
WHERE e.name = 'Wicked Problem'
AND '__Entity__' IN labels(e) AND 'Concept' IN labels(e)
MATCH (canonical:ProblemType {name: 'Wicked Problem'})
MERGE (e)-[:ALIAS_OF]->(canonical);

// Concept (Innovation View) variants -- these are legitimate perspectives
MATCH (c:Concept {name: 'Ill-Defined Problem (Innovation View)'})
MATCH (canonical:ProblemType {name: 'Ill-Defined Problem'})
MERGE (c)-[:PERSPECTIVE_ON]->(canonical);

MATCH (c:Concept {name: 'Well-Defined Problem (Innovation View)'})
MATCH (canonical:ProblemType {name: 'Well-Defined Problem'})
MERGE (c)-[:PERSPECTIVE_ON]->(canonical);

MATCH (c:Concept {name: 'Well-Defined Problem (Innovation)'})
MATCH (canonical:ProblemType {name: 'Well-Defined Problem'})
MERGE (c)-[:PERSPECTIVE_ON]->(canonical);

MATCH (c:Concept {name: 'Undefined Problem (Innovation View)'})
MATCH (canonical:ProblemType {name: 'Undefined Problem'})
MERGE (c)-[:PERSPECTIVE_ON]->(canonical);

MATCH (c:Concept {name: 'Undefined Problem (Innovation)'})
MATCH (canonical:ProblemType {name: 'Undefined Problem'})
MERGE (c)-[:PERSPECTIVE_ON]->(canonical);

// InnovationTool "Wicked Problems" -> wire to framework
MATCH (it:InnovationTool {name: 'Wicked Problems'})
MATCH (f:Framework {name: 'Wicked Problem Detection Framework'})
MERGE (it)-[:USED_BY]->(f);

MATCH (it:InnovationTool {name: 'Wicked Problems'})
MATCH (canonical:ProblemType {name: 'Wicked Problem'})
MERGE (it)-[:ALIAS_OF]->(canonical);

// WeekModule variants -- wire to Workshops
MATCH (wm:WeekModule {name: 'Ill-defined Problems: Finding Problems Worth Solving'})
MATCH (w:Workshop {name: 'Workshop 2: Ill-Defined Problem Investigation'})
MERGE (wm)-[:PART_OF]->(w);

MATCH (wm:WeekModule {name: 'Ill-defined Problems: Challenging Orthodoxies'})
MATCH (w:Workshop {name: 'Workshop 2: Ill-Defined Problem Investigation'})
MERGE (wm)-[:PART_OF]->(w);

MATCH (wm:WeekModule {name: 'Well-defined Problems: Structuring Problems Worth Solving'})
MATCH (w:Workshop {name: 'Workshop 4: Sharp Definition - Well-Defined Problem'})
MERGE (wm)-[:PART_OF]->(w);

// MCPSequence and OrchestrationPath -- wire to ProblemType
MATCH (mcp:MCPSequence {name: 'Ill-Defined Problem MCP Flow'})
MATCH (canonical:ProblemType {name: 'Ill-Defined Problem'})
MERGE (mcp)-[:ORCHESTRATES]->(canonical);

MATCH (op:OrchestrationPath {name: 'Ill-Defined Problem Resolution Path'})
MATCH (canonical:ProblemType {name: 'Ill-Defined Problem'})
MERGE (op)-[:RESOLVES]->(canonical);

// Wicked Problem Detection sub-concepts
MATCH (wpc:Concept {name: 'Wicked Problem Carving'})
MATCH (f:Framework {name: 'Wicked Problem Detection Framework'})
MERGE (wpc)-[:PART_OF]->(f);

MATCH (wpo:Concept {name: 'Wicked Problem Overlay'})
MATCH (f:Framework {name: 'Wicked Problem Detection Framework'})
MERGE (wpo)-[:PART_OF]->(f);

MATCH (wpd:Technique {name: 'Wicked Problem Decomposition'})
MATCH (f:Framework {name: 'Wicked Problem Detection Framework'})
MERGE (wpd)-[:PART_OF]->(f);

// Wicked Problem Detector agent
MATCH (agent:Agent {name: 'Wicked Problem Detector'})
MATCH (f:Framework {name: 'Wicked Problem Detection Framework'})
MERGE (agent)-[:IMPLEMENTS]->(f);


// ============================================================
// PHASE 5: 2D MATRIX WIRING
// 7 intersection nodes: Definition x Complexity
// Already created SUBTYPE_OF in brain-normalize-final.cypher Section 2
// Here we add the complexity dimension edges
// ============================================================

// Wire complexity dimension
MATCH (m:ProblemType) WHERE m.name CONTAINS '+ Simple'
SET m.complexity = 'simple';

MATCH (m:ProblemType) WHERE m.name CONTAINS '+ Complex'
SET m.complexity = 'complex';

MATCH (m:ProblemType) WHERE m.name CONTAINS '+ Wicked'
SET m.complexity = 'wicked'
WITH m
MATCH (wp:ProblemType {name: 'Wicked Problem'})
MERGE (m)-[:HAS_CHARACTERISTIC]->(wp);

// Wire Framework recommendations to matrix intersections
// Undefined + Wicked gets the heaviest toolkit
MATCH (m:ProblemType {name: 'Undefined + Wicked'})
MATCH (f1:Framework {name: 'Cynefin Framework'})
MATCH (f2:Framework {name: 'Scenario Planning'})
MATCH (f3:Framework {name: 'Wicked Problem Detection Framework'})
MERGE (f1)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.9}]->(m)
MERGE (f2)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.85}]->(m)
MERGE (f3)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.9}]->(m);

// Ill-Defined + Wicked
MATCH (m:ProblemType {name: 'Ill-Defined + Wicked'})
MATCH (f1:Framework {name: 'Six Thinking Hats'})
MATCH (f2:Framework {name: 'Causal Loop Diagrams'})
MATCH (f3:Framework {name: 'Systems Thinking'})
MERGE (f1)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.9}]->(m)
MERGE (f2)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.85}]->(m)
MERGE (f3)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.85}]->(m);

// Well-Defined + Wicked (paradox: defined but still wicked)
MATCH (m:ProblemType {name: 'Well-Defined + Wicked'})
MATCH (f1:Framework {name: 'Root Cause Analysis'})
MATCH (f2:Framework {name: 'Theory of Change'})
MERGE (f1)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.85}]->(m)
MERGE (f2)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.8}]->(m);

// Undefined + Simple -> just explore
MATCH (m:ProblemType {name: 'Undefined + Simple'})
MATCH (f1:Framework {name: 'Domain Selection'})
MATCH (f2:Framework {name: 'Beautiful Question Framework'})
MERGE (f1)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.9}]->(m)
MERGE (f2)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.85}]->(m);

// Undefined + Complex -> explore + map
MATCH (m:ProblemType {name: 'Undefined + Complex'})
MATCH (f1:Framework {name: 'Knowns and Unknowns Matrix Framework'})
MATCH (f2:Framework {name: 'Trending to the Absurd'})
MERGE (f1)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.9}]->(m)
MERGE (f2)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.85}]->(m);

// Ill-Defined + Simple -> investigate
MATCH (m:ProblemType {name: 'Ill-Defined + Simple'})
MATCH (f1:Framework {name: 'Jobs to Be Done (JTBD)'})
MATCH (f2:Framework {name: 'Process Mapping for Innovation'})
MERGE (f1)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.9}]->(m)
MERGE (f2)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.85}]->(m);

// Well-Defined + Simple -> execute
MATCH (m:ProblemType {name: 'Well-Defined + Simple'})
MATCH (f1:Framework {name: 'MECE (Mutually Exclusive, Collectively Exhaustive)'})
MATCH (f2:Framework {name: 'The Pyramid Principle'})
MERGE (f1)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.9}]->(m)
MERGE (f2)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.9}]->(m);


// ============================================================
// PHASE 6: HORST RITTEL -- Wire the founder properly
// He appears as base+person with good description but no
// connection to Wicked Problem Detection Framework
// ============================================================

MATCH (hr)
WHERE hr.name =~ '(?i)^horst rittel.*'
AND ('person' IN labels(hr) OR 'Person' IN labels(hr))
MATCH (wp:ProblemType {name: 'Wicked Problem'})
MATCH (f:Framework {name: 'Wicked Problem Detection Framework'})
MERGE (hr)-[:ORIGINATED]->(wp)
MERGE (hr)-[:ORIGINATED]->(f);

// Wire Rittel & Webber document
MATCH (doc:Document {name: 'N04_Wicked Problems.pptx.txt'})
MATCH (f:Framework {name: 'Wicked Problem Detection Framework'})
MERGE (doc)-[:TEACHES]->(f);


// ============================================================
// PHASE 7: TAXONOMY NODE -- Wire the meta-concept
// "The Taxonomy of Problems: Un-defined, Ill-defined, Well-defined"
// exists as __Entity__ with 7 rels but no connection to ProblemTypes
// ============================================================

MATCH (tax:__Entity__)
WHERE tax.name = 'The Taxonomy of Problems: Un-defined, Ill-defined, Well-defined'
MATCH (u:ProblemType {name: 'Undefined Problem'})
MATCH (i:ProblemType {name: 'Ill-Defined Problem'})
MATCH (w:ProblemType {name: 'Well-Defined Problem'})
MERGE (tax)-[:CONTAINS]->(u)
MERGE (tax)-[:CONTAINS]->(i)
MERGE (tax)-[:CONTAINS]->(w);

// Also wire the base+concept taxonomy nodes
MATCH (tax)
WHERE tax.name =~ '(?i).*taxonomy of problems.*'
AND ('base' IN labels(tax) OR 'Concept' IN labels(tax))
MATCH (u:ProblemType {name: 'Undefined Problem'})
MERGE (tax)-[:ALIAS_OF]->(u);


// ============================================================
// PHASE 8: STRATEGY NODES
// 3 Strategy nodes for each problem type -- wire them
// ============================================================

MATCH (s:Strategy {name: 'Navigating Ill-Defined Problems'})
MATCH (pt:ProblemType {name: 'Ill-Defined Problem'})
MERGE (s)-[:STRATEGY_FOR]->(pt);

MATCH (s:Strategy {name: 'Addressing Well-Defined Problems'})
MATCH (pt:ProblemType {name: 'Well-Defined Problem'})
MERGE (s)-[:STRATEGY_FOR]->(pt);

MATCH (s:Strategy {name: 'Tackling Undefined Problems'})
MATCH (pt:ProblemType {name: 'Undefined Problem'})
MERGE (s)-[:STRATEGY_FOR]->(pt);


// ============================================================
// VERIFICATION
// ============================================================

// V1. Canonical ProblemType nodes should be the highest-connected
// MATCH (pt:ProblemType)
// WHERE pt.name IN ['Undefined Problem','Ill-Defined Problem','Well-Defined Problem','Wicked Problem','Tame Problem']
// RETURN pt.name, labels(pt), size([(pt)--() | 1]) AS rels
// ORDER BY rels DESC;

// V2. DictionaryTerm dedup check
// MATCH (dt:DictionaryTerm)
// WHERE dt.name =~ '(?i).*(ill.defined|well.defined|wicked).*'
// RETURN dt.name, count(dt) AS copies;
// Expected: 1 each

// V3. ALIAS_OF edges from LazyGraph -> canonical
// MATCH (lgc:LazyGraphConcept)-[:ALIAS_OF]->(pt:ProblemType)
// RETURN lgc.name, pt.name, size([(lgc)--() | 1]) AS lazy_rels
// ORDER BY lazy_rels DESC;

// V4. Full ProblemType traversal path test
// MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
// WHERE pt.name IN ['Undefined Problem','Ill-Defined Problem','Well-Defined Problem','Wicked Problem']
// OPTIONAL MATCH (lgc)-[:ALIAS_OF]->(pt)
// RETURN pt.name, count(DISTINCT f) AS frameworks, count(DISTINCT lgc) AS aliases
// ORDER BY pt.name;

// V5. 2D Matrix wiring
// MATCH (m:ProblemType)-[:SUBTYPE_OF]->(parent:ProblemType)
// WHERE m.name CONTAINS '+'
// OPTIONAL MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(m)
// RETURN m.name, parent.name, collect(f.name) AS frameworks;

// V6. No more stale __Entity__ label on Wicked Problem
// MATCH (wp:ProblemType {name: 'Wicked Problem'})
// RETURN labels(wp);
// Expected: [ProblemType] only, no __Entity__
