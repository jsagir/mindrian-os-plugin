// ============================================================
// MindrianOS v1.8.2 -- Brain Graph Optimization
// Neo4j 5.27-aura + APOC 2026.03.0
// Run sections in order. Verification queries at end of each.
// Aura write constraint: use apoc.periodic.iterate for bulk ops,
// not apoc.periodic.commit.
// ============================================================


// ============================================================
// SECTION 1: LABEL NORMALIZATION
// ============================================================

// 1a: concept -> Concept
CALL apoc.periodic.iterate(
  'MATCH (n:concept) WHERE NOT n:Concept RETURN n',
  'SET n:Concept REMOVE n:concept',
  {batchSize: 500}
);

// 1b: Strip base label (import artifact)
CALL apoc.periodic.iterate(
  'MATCH (n:base) RETURN n',
  'REMOVE n:base',
  {batchSize: 500}
);

// 1c: Strip UNKNOWN label where a semantic label also exists
CALL apoc.periodic.iterate(
  'MATCH (n:UNKNOWN)
   WHERE size(labels(n)) > 1
   RETURN n',
  'REMOVE n:UNKNOWN',
  {batchSize: 500}
);

// VERIFY: MATCH (n:concept) RETURN count(n); -- 0
// VERIFY: MATCH (n:base) RETURN count(n);    -- 0


// ============================================================
// SECTION 2: VENTURESTAGE CHAIN (idempotent -- nodes exist)
// ============================================================

MERGE (s1:VentureStage {name:'Pre-Opportunity'})
  ON CREATE SET s1.order=1, s1.description='Still searching for problems worth solving';
MERGE (s2:VentureStage {name:'Opportunity Identified'})
  ON CREATE SET s2.order=2, s2.description='Found a problem, need deep understanding';
MERGE (s3:VentureStage {name:'Problem Validation'})
  ON CREATE SET s3.order=3, s3.description='Actively validating the problem hypothesis';
MERGE (s4:VentureStage {name:'Well-Defined Problem'})
  ON CREATE SET s4.order=4, s4.description='Problem clear, ready to design solution';
MERGE (s5:VentureStage {name:'Ready to Build'})
  ON CREATE SET s5.order=5, s5.description='Problem validated, solution designed';

MATCH (s1:VentureStage {name:'Pre-Opportunity'})
MATCH (s2:VentureStage {name:'Opportunity Identified'})
MERGE (s1)-[:PROGRESSES_TO]->(s2);

MATCH (s2:VentureStage {name:'Opportunity Identified'})
MATCH (s3:VentureStage {name:'Problem Validation'})
MERGE (s2)-[:PROGRESSES_TO]->(s3);

MATCH (s3:VentureStage {name:'Problem Validation'})
MATCH (s4:VentureStage {name:'Well-Defined Problem'})
MERGE (s3)-[:PROGRESSES_TO]->(s4);

MATCH (s4:VentureStage {name:'Well-Defined Problem'})
MATCH (s5:VentureStage {name:'Ready to Build'})
MERGE (s4)-[:PROGRESSES_TO]->(s5);

CREATE INDEX venture_stage_name IF NOT EXISTS FOR (n:VentureStage) ON (n.name);

// VERIFY: MATCH (n:VentureStage) RETURN n.name, n.order ORDER BY n.order; -- 5 rows


// ============================================================
// SECTION 3: PROBLEMTYPE CANONICALIZATION
// ============================================================

// 3a: Ensure 4 canonical nodes with correct labels
MERGE (u:ProblemType {name:'Undefined Problem'})
  ON CREATE SET u.order=1, u.complexity='chaotic',
    u.description='Broad opportunity space, future-back thinking, scattered observations';
MERGE (i:ProblemType {name:'Ill-Defined Problem'})
  ON CREATE SET i.order=2, i.complexity='complex',
    i.description='General direction identified but lacks specificity and testability';
MERGE (w:ProblemType {name:'Well-Defined Problem'})
  ON CREATE SET w.order=3, w.complexity='complicated',
    w.description='Specific, measurable, falsifiable outcomes, clear user segments';
MERGE (wk:ProblemType {name:'Wicked Problem'})
  ON CREATE SET wk.order=4, wk.complexity='chaotic',
    wk.description='No definitive formulation, no stopping rule, stakeholder-contested';

// 3b: Canonical LEADS_TO chain
MATCH (u:ProblemType {name:'Undefined Problem'})
MATCH (i:ProblemType {name:'Ill-Defined Problem'})
MERGE (u)-[:LEADS_TO]->(i);

MATCH (i:ProblemType {name:'Ill-Defined Problem'})
MATCH (w:ProblemType {name:'Well-Defined Problem'})
MERGE (i)-[:LEADS_TO]->(w);

MATCH (wk:ProblemType {name:'Wicked Problem'})
MATCH (i:ProblemType {name:'Ill-Defined Problem'})
MERGE (wk)-[:SUBTYPE_OF]->(i);

// 3c: Wire the 7-node 2D matrix to canonicals
MATCH (m:ProblemType) WHERE m.name STARTS WITH 'Undefined'
  AND m.name CONTAINS '+'
MATCH (c:ProblemType {name:'Undefined Problem'})
MERGE (m)-[:SUBTYPE_OF]->(c);

MATCH (m:ProblemType) WHERE m.name STARTS WITH 'Ill-Defined'
  AND m.name CONTAINS '+'
MATCH (c:ProblemType {name:'Ill-Defined Problem'})
MERGE (m)-[:SUBTYPE_OF]->(c);

MATCH (m:ProblemType) WHERE m.name STARTS WITH 'Well-Defined'
  AND m.name CONTAINS '+'
MATCH (c:ProblemType {name:'Well-Defined Problem'})
MERGE (m)-[:SUBTYPE_OF]->(c);

// 3d: Wire __Entity__+ProblemType Wicked Problem to canonical
MATCH (e {name:'Wicked Problem'}) WHERE '__Entity__' IN labels(e)
  AND 'ProblemType' IN labels(e)
MATCH (c:ProblemType {name:'Wicked Problem'})
  WHERE NOT '__Entity__' IN labels(c)
MERGE (e)-[:ALIAS_OF]->(c);

// VERIFY: MATCH (n:ProblemType)-[:SUBTYPE_OF]->(c) RETURN n.name, c.name; -- 9 rows


// ============================================================
// SECTION 4: DICTIONARYTERM DEDUPLICATION
// ============================================================

MATCH (n:DictionaryTerm {name:'Ill-defined Problem'})
WITH collect(n) AS nodes WHERE size(nodes) > 1
CALL apoc.refactor.mergeNodes(nodes,
  {properties:'combine', mergeRels:true}) YIELD node
SET node.name = 'Ill-defined Problem'
RETURN node.name;

MATCH (n:DictionaryTerm {name:'Well-defined Problem'})
WITH collect(n) AS nodes WHERE size(nodes) > 1
CALL apoc.refactor.mergeNodes(nodes,
  {properties:'combine', mergeRels:true}) YIELD node
SET node.name = 'Well-defined Problem'
RETURN node.name;

MATCH (n:DictionaryTerm {name:'Un-defined Problem'})
WITH collect(n) AS nodes WHERE size(nodes) > 1
CALL apoc.refactor.mergeNodes(nodes,
  {properties:'combine', mergeRels:true}) YIELD node
SET node.name = 'Un-defined Problem'
RETURN node.name;

MATCH (n:DictionaryTerm {name:'Problem Type Progression'})
WITH collect(n) AS nodes WHERE size(nodes) > 1
CALL apoc.refactor.mergeNodes(nodes,
  {properties:'combine', mergeRels:true}) YIELD node
SET node.name = 'Problem Type Progression'
RETURN node.name;

// Catch-all for remaining duplicates
CALL apoc.periodic.iterate(
  'MATCH (n:DictionaryTerm)
   WITH n.name AS term, collect(n) AS nodes
   WHERE size(nodes) > 1
   RETURN nodes',
  'CALL apoc.refactor.mergeNodes(nodes,
     {properties:"combine", mergeRels:true}) YIELD node
   RETURN node',
  {batchSize:5}
);

// VERIFY:
// MATCH (n:DictionaryTerm) WITH n.name AS t, count(n) AS c
// WHERE c > 1 RETURN t, c; -- 0 rows


// ============================================================
// SECTION 5: BOOK DEDUPLICATION + GROUNDS_FRAMEWORK
// ============================================================

// 5a: Merge 6x Introduction to Systems Thinking
MATCH (n:Book {name:'Introduction to Systems Thinking'})
WITH collect(n) AS nodes WHERE size(nodes) > 1
CALL apoc.refactor.mergeNodes(nodes,
  {properties:'combine', mergeRels:true}) YIELD node
RETURN node.name;

// 5b: Merge all remaining Book duplicates
CALL apoc.periodic.iterate(
  'MATCH (n:Book)
   WITH n.name AS title, collect(n) AS nodes
   WHERE size(nodes) > 1
   RETURN nodes',
  'CALL apoc.refactor.mergeNodes(nodes,
     {properties:"combine", mergeRels:true}) YIELD node
   RETURN node',
  {batchSize:5}
);

// 5c: Strip __Entity__ label from Book nodes
CALL apoc.periodic.iterate(
  'MATCH (n) WHERE "Book" IN labels(n) AND "__Entity__" IN labels(n)
   RETURN n',
  'REMOVE n:__Entity__',
  {batchSize:200}
);

// 5d: GROUNDS_FRAMEWORK -- curriculum provenance
MATCH (b:Book {name:'Introduction to Systems Thinking'})
MATCH (f:Framework {name:'Systems Thinking'})
MERGE (b)-[:GROUNDS_FRAMEWORK]->(f);

MATCH (b:Book {name:'The Four Lenses of Innovation: A Power Tool for Creative Thinking'})
MATCH (f:Framework {name:'Four Lenses of Innovation'})
MERGE (b)-[:GROUNDS_FRAMEWORK]->(f);

MATCH (b:Book {name:'Thinking in Systems: A Primer'})
MATCH (f:Framework {name:'Systems Thinking'})
MERGE (b)-[:GROUNDS_FRAMEWORK]->(f);

MATCH (b:Book {name:'The Fifth Discipline: The Art and Practice of the Learning Organization'})
MATCH (f:Framework {name:'Systems Thinking'})
MERGE (b)-[:GROUNDS_FRAMEWORK]->(f);

MATCH (b:Book {name:'Scenarios: Uncharted Waters Ahead'})
MATCH (f:Framework {name:'Scenario Planning'})
MERGE (b)-[:GROUNDS_FRAMEWORK]->(f);

MATCH (b:Book) WHERE b.name CONTAINS 'Crossing the Chasm'
MATCH (f:Framework {name:'Sustaining vs Disruptive Innovation'})
MERGE (b)-[:GROUNDS_FRAMEWORK]->(f);

MATCH (b:Book) WHERE b.name CONTAINS 'Innovator'
MATCH (f:Framework {name:'Sustaining vs Disruptive Innovation'})
MERGE (b)-[:GROUNDS_FRAMEWORK]->(f);

MATCH (b:Book) WHERE b.name CONTAINS 'Design Thinking'
   OR b.name CONTAINS 'Art of Innovation'
MATCH (f:Framework {name:'Design Thinking'})
MERGE (b)-[:GROUNDS_FRAMEWORK]->(f);

MATCH (b:Book) WHERE b.name CONTAINS 'Jobs to Be Done'
   OR b.name CONTAINS 'Competing Against Luck'
MATCH (f:Framework {name:'Jobs to Be Done (JTBD)'})
MERGE (b)-[:GROUNDS_FRAMEWORK]->(f);

MATCH (b:Book) WHERE b.name CONTAINS 'Pyramid Principle'
MATCH (f:Framework {name:'The Pyramid Principle'})
MERGE (b)-[:GROUNDS_FRAMEWORK]->(f);

MATCH (b:Book) WHERE b.name CONTAINS 'Bulletproof Problem Solving'
MATCH (f:Framework {name:'Root Cause Analysis'})
MERGE (b)-[:GROUNDS_FRAMEWORK]->(f);

// 5e: Fix INTRODUCES_FRAMEWORK mislanding (123 Concept -> Framework)
MATCH (b:Book)-[r:INTRODUCES_FRAMEWORK]->(c:Concept)
MATCH (f:Framework) WHERE f.name = c.name
MERGE (b)-[:INTRODUCES_FRAMEWORK]->(f)
DELETE r;

// VERIFY:
// MATCH (b:Book)-[:GROUNDS_FRAMEWORK]->(f:Framework) RETURN count(*); -- 10+
// MATCH (n:Book) WITH n.name, count(n) AS c WHERE c>1 RETURN count(n); -- 0


// ============================================================
// SECTION 6: OPPORTUNITY BANK CONSOLIDATION
// ============================================================

MATCH (canonical:DictionaryTerm {name:'Opportunity Bank'})
SET canonical:Framework
SET canonical.description =
  'Continuously growing portfolio of validated problems worth solving. '
  + 'Core PWS output -- volume game of discovery before selection. '
  + 'Built across Workshops 1-3, maintained throughout the innovation process.'
SET canonical.stage = 'Pre-Opportunity';

MATCH (variant)
WHERE variant.name IN [
  'bank of opportunities', 'opportunity bank', 'Bank of opportunities',
  'Opportunity bank', 'Opportunity Bank Framework', 'Bank of Opportunities',
  'Bank Of Opportunities'
]
AND NOT (variant:DictionaryTerm AND variant.name = 'Opportunity Bank')
MATCH (canonical:DictionaryTerm {name:'Opportunity Bank'})
MERGE (variant)-[:ALIAS_OF]->(canonical);

MATCH (process {name:'Bank of Opportunities Building Process'})
MATCH (canonical:DictionaryTerm {name:'Opportunity Bank'})
MERGE (process)-[:DESCRIBES_PROCESS_OF]->(canonical);

MATCH (canonical:DictionaryTerm {name:'Opportunity Bank'})
MATCH (ds:Framework {name:'Domain Selection'})
MATCH (w1:Workshop {name:'Workshop 1: Innovation as Discipline'})
MATCH (w2:Workshop {name:'Workshop 2: Ill-Defined Problem Investigation'})
MATCH (w3:Workshop {name:'Workshop 3: From Problems to Opportunities'})
MATCH (pb:DeliverableTemplate {name:'Problem Bank'})
MATCH (cp:CorePrinciple {name:'Portfolio Not Projects'})
MERGE (canonical)-[:FEEDS_INTO]->(ds)
MERGE (w1)-[:PRODUCES_CONCEPT]->(canonical)
MERGE (w2)-[:PRODUCES_CONCEPT]->(canonical)
MERGE (w3)-[:PRODUCES_CONCEPT]->(canonical)
MERGE (canonical)-[:IMPLEMENTED_AS]->(pb)
MERGE (cp)-[:GOVERNS]->(canonical);

// VERIFY:
// MATCH (n:DictionaryTerm {name:'Opportunity Bank'})-[r]-()
// RETURN type(r), count(*); -- 8+ rels


// ============================================================
// SECTION 7: FEEDS_INTO ENRICHMENT (4 real -> 35+)
// ============================================================

// -- PWS Core Spine --
MATCH (a:Framework {name:'Domain Selection'})
MATCH (b:Framework {name:'Four Lenses of Innovation'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Four Lenses of Innovation'})
MATCH (b:Framework {name:'Jobs to Be Done (JTBD)'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Jobs to Be Done (JTBD)'})
MATCH (b:Framework {name:'Process Mapping for Innovation'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Process Mapping for Innovation'})
MATCH (b:Framework {name:'Reverse Salient Analysis'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Reverse Salient Analysis'})
MATCH (b:Framework {name:'Causal Loop Diagrams'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Causal Loop Diagrams'})
MATCH (b:Framework {name:'Root Cause Analysis'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Root Cause Analysis'})
MATCH (b:Framework {name:'Problem Definition Transformation Framework'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Problem Definition Transformation Framework'})
MATCH (b:Framework {name:'PWS Triple Validation Compass'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'PWS Triple Validation Compass'})
MATCH (b:Technique {name:'Mullins Model Validation'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Technique {name:'Mullins Model Validation'})
MATCH (b:ValidationTool {name:'PWS Value Proposition'})
MERGE (a)-[:FEEDS_INTO]->(b);

// -- Cynefin routing --
MATCH (a:Framework {name:'Cynefin Framework'})
MATCH (b:Framework {name:'Beautiful Question Framework'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Cynefin Framework'})
MATCH (b:Framework {name:'Wicked Problem Detection Framework'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Cynefin Framework'})
MATCH (b:Framework {name:'Scenario Planning'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Knowns and Unknowns Matrix Framework'})
MATCH (b:Framework {name:'Cynefin Framework'})
MERGE (a)-[:FEEDS_INTO]->(b);

// -- Wicked problem cluster --
MATCH (a:Framework {name:'Wicked Problem Detection Framework'})
MATCH (b:Framework {name:'Causal Loop Diagrams'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Systems Thinking'})
MATCH (b:Framework {name:'Scenario Planning'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Scenario Planning'})
MATCH (b:Framework {name:'Knowns and Unknowns Matrix Framework'})
MERGE (a)-[:FEEDS_INTO]->(b);

// -- BONO / Six Hats --
MATCH (a:Framework {name:'BONO-Innovation Framework'})
MATCH (b:Framework {name:'Six Thinking Hats'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Six Thinking Hats'})
MATCH (b:Framework {name:'Beautiful Question Framework'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Six Thinking Hats'})
MATCH (b:Framework {name:'Hypothesis-Driven Problem Solving'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'BONO-Innovation Framework'})
MATCH (b:Framework {name:'PWS Triple Validation Compass'})
MERGE (a)-[:FEEDS_INTO]->(b);

// -- Design / discovery --
MATCH (a:Framework {name:'Design Thinking'})
MATCH (b:Framework {name:'Jobs to Be Done (JTBD)'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Design Thinking'})
MATCH (b:Framework {name:'User Journey Mapping'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'User Journey Mapping'})
MATCH (b:Framework {name:'Process Mapping for Innovation'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Beautiful Question Framework'})
MATCH (b:Framework {name:'Domain Selection'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Opportunity Recognition as Pattern Recognition'})
MATCH (b:Framework {name:'Domain Selection'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Trending to the Absurd'})
MATCH (b:Framework {name:'Scenario Planning'})
MERGE (a)-[:FEEDS_INTO]->(b);

// -- Validation / DD chain --
MATCH (a:Technique {name:'Mullins Model Validation'})
MATCH (b:Framework {name:'Financial Due Diligence Framework'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Technique {name:'Mullins Model Validation'})
MATCH (b:Framework {name:'IP Due Diligence Framework'})
MERGE (a)-[:FEEDS_INTO]->(b);

MATCH (a:Framework {name:'Financial Due Diligence Framework'})
MATCH (b:Framework {name:'Legal Due Diligence Framework'})
MERGE (a)-[:FEEDS_INTO]->(b);

// VERIFY: MATCH ()-[r:FEEDS_INTO]->(:Framework) RETURN count(r); -- 30+


// ============================================================
// SECTION 8: TYPICAL_AT STAGE MAPPING (4 -> 30+)
// ============================================================

WITH ['Domain Selection','Four Lenses of Innovation',
      'Trending to the Absurd','Beautiful Question Framework',
      'Knowns and Unknowns Matrix Framework','Cynefin Framework',
      'Opportunity Recognition as Pattern Recognition',
      'Wicked Problem Detection Framework','Scenario Planning'] AS names
UNWIND names AS fname
MATCH (f:Framework {name:fname})
MATCH (s:VentureStage {name:'Pre-Opportunity'})
MERGE (f)-[:TYPICAL_AT]->(s);

WITH ['Jobs to Be Done (JTBD)','Process Mapping for Innovation',
      'Causal Loop Diagrams','User Journey Mapping',
      'Reverse Salient Analysis','Design Thinking',
      'BONO-Innovation Framework','Six Thinking Hats',
      'Hypothesis-Driven Problem Solving',
      'Systems Thinking'] AS names
UNWIND names AS fname
MATCH (f:Framework {name:fname})
MATCH (s:VentureStage {name:'Opportunity Identified'})
MERGE (f)-[:TYPICAL_AT]->(s);

WITH ['Root Cause Analysis',
      'MECE (Mutually Exclusive, Collectively Exhaustive)',
      'The Pyramid Principle',
      'Wicked Problem Detection Framework'] AS names
UNWIND names AS fname
MATCH (f:Framework {name:fname})
MATCH (s:VentureStage {name:'Problem Validation'})
MERGE (f)-[:TYPICAL_AT]->(s);

WITH ['PWS Triple Validation Compass',
      'Problem Definition Transformation Framework',
      'Well-Defined Problem Framework',
      'PWS Methodology'] AS names
UNWIND names AS fname
MATCH (f:Framework {name:fname})
MATCH (s:VentureStage {name:'Well-Defined Problem'})
MERGE (f)-[:TYPICAL_AT]->(s);

MATCH (f:Technique {name:'Mullins Model Validation'})
MATCH (s:VentureStage {name:'Well-Defined Problem'})
MERGE (f)-[:TYPICAL_AT]->(s);

MATCH (f:ValidationTool {name:'PWS Value Proposition'})
MATCH (s:VentureStage {name:'Well-Defined Problem'})
MERGE (f)-[:TYPICAL_AT]->(s);

WITH ['Financial Due Diligence Framework',
      'IP Due Diligence Framework',
      'Legal Due Diligence Framework',
      'ESG Due Diligence Framework',
      'Theory of Change',
      'Changing Terms of Competition',
      'Tools vs Platforms Innovation'] AS names
UNWIND names AS fname
MATCH (f:Framework {name:fname})
MATCH (s:VentureStage {name:'Ready to Build'})
MERGE (f)-[:TYPICAL_AT]->(s);

// VERIFY: MATCH ()-[r:TYPICAL_AT]->() RETURN count(r); -- 30+


// ============================================================
// SECTION 9: ADDRESSES_PROBLEM_TYPE ENRICHMENT (38 -> 60+)
// ============================================================

WITH ['Domain Selection','Trending to the Absurd',
      'Beautiful Question Framework','Scenario Planning',
      'Knowns and Unknowns Matrix Framework',
      'Opportunity Recognition as Pattern Recognition'] AS names
UNWIND names AS fname
MATCH (f:Framework {name:fname})
MATCH (pt:ProblemType {name:'Undefined Problem'})
MERGE (f)-[:ADDRESSES_PROBLEM_TYPE]->(pt);

WITH ['Causal Loop Diagrams','Systems Thinking',
      'BONO-Innovation Framework','Six Thinking Hats',
      'User Journey Mapping','Process Mapping for Innovation',
      'Design Thinking','Wicked Problem Detection Framework',
      'Jobs to Be Done (JTBD)','Reverse Salient Analysis'] AS names
UNWIND names AS fname
MATCH (f:Framework {name:fname})
MATCH (pt:ProblemType {name:'Ill-Defined Problem'})
MERGE (f)-[:ADDRESSES_PROBLEM_TYPE]->(pt);

WITH ['PWS Triple Validation Compass',
      'Problem Definition Transformation Framework',
      'MECE (Mutually Exclusive, Collectively Exhaustive)',
      'Root Cause Analysis','Hypothesis-Driven Problem Solving',
      'The Pyramid Principle'] AS names
UNWIND names AS fname
MATCH (f:Framework {name:fname})
MATCH (pt:ProblemType {name:'Well-Defined Problem'})
MERGE (f)-[:ADDRESSES_PROBLEM_TYPE]->(pt);

MATCH (f:Technique {name:'Mullins Model Validation'})
MATCH (pt:ProblemType {name:'Well-Defined Problem'})
MERGE (f)-[:ADDRESSES_PROBLEM_TYPE]->(pt);

WITH ['Causal Loop Diagrams','Systems Thinking',
      'Scenario Planning','Cynefin Framework',
      'Wicked Problem Detection Framework'] AS names
UNWIND names AS fname
MATCH (f:Framework {name:fname})
MATCH (pt:ProblemType {name:'Wicked Problem'})
MERGE (f)-[:ADDRESSES_PROBLEM_TYPE]->(pt);

// Wire 2D matrix nodes
MATCH (m:ProblemType {name:'Ill-Defined + Wicked'})
MATCH (f:Framework {name:'Wicked Problem Detection Framework'})
MERGE (m)-[:ADDRESSED_BY]->(f);

MATCH (m:ProblemType {name:'Undefined + Wicked'})
MATCH (f:Framework {name:'Cynefin Framework'})
MERGE (m)-[:ADDRESSED_BY]->(f);

MATCH (m:ProblemType {name:'Well-Defined + Wicked'})
MATCH (f:Framework {name:'PWS Triple Validation Compass'})
MERGE (m)-[:ADDRESSED_BY]->(f);

// VERIFY: MATCH ()-[r:ADDRESSES_PROBLEM_TYPE]->() RETURN count(r); -- 60+


// ============================================================
// SECTION 10: PREREQUISITE EDGES (0 -> 14)
// ============================================================

MATCH (a:Framework {name:'Domain Selection'})
MATCH (b:Framework {name:'Cynefin Framework'})
MERGE (b)-[:PREREQUISITE]->(a);

MATCH (a:Framework {name:'Causal Loop Diagrams'})
MATCH (b:Framework {name:'Root Cause Analysis'})
MERGE (b)-[:PREREQUISITE]->(a);

MATCH (a:Framework {name:'Problem Definition Transformation Framework'})
MATCH (b:Framework {name:'PWS Triple Validation Compass'})
MERGE (b)-[:PREREQUISITE]->(a);

MATCH (a:Framework {name:'PWS Triple Validation Compass'})
MATCH (b:Technique {name:'Mullins Model Validation'})
MERGE (b)-[:PREREQUISITE]->(a);

MATCH (a:Framework {name:'Systems Thinking'})
MATCH (b:Framework {name:'Causal Loop Diagrams'})
MERGE (b)-[:PREREQUISITE]->(a);

MATCH (a:Framework {name:'Jobs to Be Done (JTBD)'})
MATCH (b:Framework {name:'User Journey Mapping'})
MERGE (b)-[:PREREQUISITE]->(a);

MATCH (a:Framework {name:'Cynefin Framework'})
MATCH (b:Framework {name:'Wicked Problem Detection Framework'})
MERGE (b)-[:PREREQUISITE]->(a);

MATCH (a:Framework {name:'MECE (Mutually Exclusive, Collectively Exhaustive)'})
MATCH (b:Framework {name:'The Pyramid Principle'})
MERGE (b)-[:PREREQUISITE]->(a);

MATCH (a:Framework {name:'Scenario Planning'})
MATCH (b:Framework {name:'Trending to the Absurd'})
MERGE (b)-[:PREREQUISITE]->(a);

MATCH (a:Framework {name:'Four Lenses of Innovation'})
MATCH (b:Framework {name:'Domain Selection'})
MERGE (b)-[:PREREQUISITE]->(a);

MATCH (a:Framework {name:'Root Cause Analysis'})
MATCH (b:Framework {name:'Problem Definition Transformation Framework'})
MERGE (b)-[:PREREQUISITE]->(a);

MATCH (a:Framework {name:'Wicked Problem Detection Framework'})
MATCH (b:Framework {name:'Causal Loop Diagrams'})
MERGE (b)-[:PREREQUISITE]->(a);

MATCH (a:Framework {name:'Causal Loop Diagrams'})
MATCH (b:Framework {name:'Systems Thinking'})
MERGE (b)-[:PREREQUISITE]->(a);

MATCH (a:Framework {name:'Beautiful Question Framework'})
MATCH (b:Framework {name:'Domain Selection'})
MERGE (b)-[:PREREQUISITE]->(a);

// VERIFY: MATCH ()-[r:PREREQUISITE]->() RETURN count(r); -- 14


// ============================================================
// SECTION 11: MULLINS MODEL VALIDATION -- FULL PROMOTION
// ============================================================

MATCH (n:Technique {name:'Mullins Model Validation'})
SET n:ValidationTool
SET n.description = 'Seven domains framework for early-stage idea validation. '
  + 'Prevents sunk cost trap by validating: market attractiveness, '
  + 'target segment benefits, industry attractiveness, competitive advantage, '
  + 'team capability, financial viability, connectedness.'
SET n.domains = [
  'Market attractiveness','Target segment benefits',
  'Industry attractiveness','Competitive advantage',
  'Team capability','Financial viability','Connectedness'
];

MATCH (mullins:Technique {name:'Mullins Model Validation'})
MATCH (b1) WHERE b1.name CONTAINS 'New Business Road Test'
MERGE (b1)-[:GROUNDS_FRAMEWORK]->(mullins);

MATCH (mullins:Technique {name:'Mullins Model Validation'})
MATCH (b2) WHERE b2.name CONTAINS 'Customer-Funded Business'
MERGE (b2)-[:GROUNDS_FRAMEWORK]->(mullins);

MATCH (mullins:Technique {name:'Mullins Model Validation'})
MATCH (w5:Workshop {name:'Workshop 5: Stakeholders and Feasibility'})
MERGE (w5)-[:TEACHES]->(mullins);

MATCH (mullins:Technique {name:'Mullins Model Validation'})
MATCH (cp:CorePrinciple {name:'Evidence Beats Opinions'})
MERGE (cp)-[:GOVERNS]->(mullins);

// VERIFY:
// MATCH (n {name:'Mullins Model Validation'})
// RETURN labels(n), size([(n)--() | 1]);  -- ValidationTool+Technique, 8+ rels


// ============================================================
// SECTION 12: WORKSHOP -> TEACHES -> FRAMEWORK (0 -> 16+)
// ============================================================

MATCH (w:Workshop {name:'Workshop 1: Innovation as Discipline'})
MATCH (f1:Framework {name:'Domain Selection'})
MATCH (f2:Framework {name:'Opportunity Recognition as Pattern Recognition'})
MERGE (w)-[:TEACHES]->(f1)
MERGE (w)-[:TEACHES]->(f2);

MATCH (w:Workshop {name:'Workshop 2: Ill-Defined Problem Investigation'})
MATCH (f1:Framework {name:'Four Lenses of Innovation'})
MATCH (f2:Framework {name:'Jobs to Be Done (JTBD)'})
MATCH (f3:Framework {name:'Process Mapping for Innovation'})
MERGE (w)-[:TEACHES]->(f1)
MERGE (w)-[:TEACHES]->(f2)
MERGE (w)-[:TEACHES]->(f3);

MATCH (w:Workshop {name:'Workshop 3: From Problems to Opportunities'})
MATCH (f1:Framework {name:'Reverse Salient Analysis'})
MATCH (f2:Framework {name:'Trending to the Absurd'})
MERGE (w)-[:TEACHES]->(f1)
MERGE (w)-[:TEACHES]->(f2);

MATCH (w:Workshop {name:'Workshop 4: Sharp Definition - Well-Defined Problem'})
MATCH (f1:Framework {name:'Root Cause Analysis'})
MATCH (f2:Framework {name:'Problem Definition Transformation Framework'})
MATCH (f3:Framework {name:'MECE (Mutually Exclusive, Collectively Exhaustive)'})
MERGE (w)-[:TEACHES]->(f1)
MERGE (w)-[:TEACHES]->(f2)
MERGE (w)-[:TEACHES]->(f3);

MATCH (w:Workshop {name:'Workshop 5: Stakeholders and Feasibility'})
MATCH (f1:Framework {name:'PWS Triple Validation Compass'})
MATCH (f2:Framework {name:'Design Thinking'})
MERGE (w)-[:TEACHES]->(f1)
MERGE (w)-[:TEACHES]->(f2);

MATCH (w:Workshop {name:'Workshop 6: From Problem to Project'})
MATCH (f1:Framework {name:'Theory of Change'})
MATCH (f2:Framework {name:'Changing Terms of Competition'})
MERGE (w)-[:TEACHES]->(f1)
MERGE (w)-[:TEACHES]->(f2);

MATCH (w:Workshop {name:'Workshop 7: Advanced Work and Mentoring'})
MATCH (f1:Framework {name:'Scenario Planning'})
MATCH (f2:Framework {name:'Knowns and Unknowns Matrix Framework'})
MERGE (w)-[:TEACHES]->(f1)
MERGE (w)-[:TEACHES]->(f2);

MATCH (w:Workshop {name:'Workshop 8: Demo Day / Project Review'})
MATCH (f1:Framework {name:'The Pyramid Principle'})
MERGE (w)-[:TEACHES]->(f1);

// VERIFY: MATCH (w:Workshop)-[r:TEACHES]->(f) RETURN count(r); -- 16+


// ============================================================
// SECTION 13: BOT -> IMPLEMENTS -> FRAMEWORK (0 -> 15)
// ============================================================

MATCH (b:Bot {name:'Trending to the Absurd'})
MATCH (f:Framework {name:'Trending to the Absurd'})
MERGE (b)-[:IMPLEMENTS]->(f);

MATCH (b:Bot {name:'Beautiful Question'})
MATCH (f:Framework {name:'Beautiful Question Framework'})
MERGE (b)-[:IMPLEMENTS]->(f);

MATCH (b:Bot {name:'Jobs to Be Done'})
MATCH (f:Framework {name:'Jobs to Be Done (JTBD)'})
MERGE (b)-[:IMPLEMENTS]->(f);

MATCH (b:Bot {name:'Known/Unknown Matrix'})
MATCH (f:Framework {name:'Knowns and Unknowns Matrix Framework'})
MERGE (b)-[:IMPLEMENTS]->(f);

MATCH (b:Bot {name:'Scenario Analysis'})
MATCH (f:Framework {name:'Scenario Planning'})
MERGE (b)-[:IMPLEMENTS]->(f);

MATCH (b:Bot {name:'Red Team'})
MATCH (f:Framework) WHERE f.name STARTS WITH 'PWS-Bias Devil'
MERGE (b)-[:IMPLEMENTS]->(f);

MATCH (b:Bot {name:'S-Curve Analysis'})
MATCH (f:Framework {name:'Sustaining vs Disruptive Innovation'})
MERGE (b)-[:IMPLEMENTS]->(f);

MATCH (b:Bot {name:'Nested Hierarchies'})
MATCH (f:Framework {name:'Systems Thinking'})
MERGE (b)-[:IMPLEMENTS]->(f);

MATCH (b:Bot {name:'Ackoff DIKW Pyramid'})
MATCH (f:Framework {name:'Systems Thinking'})
MERGE (b)-[:IMPLEMENTS]->(f);

MATCH (b:Bot {name:'Lawrence'})
MATCH (f:Framework {name:'PWS Methodology'})
MERGE (b)-[:IMPLEMENTS]->(f);

MATCH (b:Bot {name:'Larry Playground'})
MATCH (f:Framework {name:'PWS Applied Innovation Workshop Program'})
MERGE (b)-[:IMPLEMENTS]->(f);

MATCH (b:Bot {name:'PWS Grading'})
MATCH (f:Framework {name:'PWS Methodology'})
MERGE (b)-[:IMPLEMENTS]->(f);

MATCH (b:Bot {name:'Research Agent'})
MATCH (f:Framework {name:'Hypothesis-Driven Problem Solving'})
MERGE (b)-[:IMPLEMENTS]->(f);

MATCH (b:Bot {name:'GraphRAG Service'})
MATCH (f:Framework {name:'HSI Semantic Surprise Analysis Assistant'})
MERGE (b)-[:IMPLEMENTS]->(f);

MATCH (b:Bot {name:'Leadership Coach'})
MATCH (f:Framework {name:'Adaptive Leadership'})
MERGE (b)-[:IMPLEMENTS]->(f);

// VERIFY: MATCH (b:Bot)-[r:IMPLEMENTS]->(f) RETURN count(r); -- 15


// ============================================================
// SECTION 14: COREPRINCIPLE -> GOVERNS (0 -> 22+)
// ============================================================

MATCH (cp:CorePrinciple {name:'Portfolio Not Projects'})
MATCH (f1:Framework {name:'Domain Selection'})
MATCH (f2:Framework {name:'Opportunity Recognition as Pattern Recognition'})
MATCH (w1:Workshop {name:'Workshop 1: Innovation as Discipline'})
MERGE (cp)-[:GOVERNS]->(f1)
MERGE (cp)-[:GOVERNS]->(f2)
MERGE (cp)-[:EMBODIED_IN]->(w1);

MATCH (cp:CorePrinciple {name:'Problem Type Mastery'})
MATCH (u:ProblemType {name:'Undefined Problem'})
MATCH (i:ProblemType {name:'Ill-Defined Problem'})
MATCH (w:ProblemType {name:'Well-Defined Problem'})
MERGE (cp)-[:GOVERNS]->(u)
MERGE (cp)-[:GOVERNS]->(i)
MERGE (cp)-[:GOVERNS]->(w);

MATCH (cp:CorePrinciple {name:'PWS Triple Validation Compass'})
MATCH (f:Framework {name:'PWS Triple Validation Compass'})
MATCH (sc:SelectionCriteria {name:'Worth Investment'})
MATCH (ws:Workshop {name:'Workshop 5: Stakeholders and Feasibility'})
MERGE (cp)-[:GOVERNS]->(f)
MERGE (cp)-[:EXPRESSED_BY]->(sc)
MERGE (cp)-[:EMBODIED_IN]->(ws);

MATCH (cp:CorePrinciple {name:'Evidence Beats Opinions'})
MATCH (f1:Framework {name:'Root Cause Analysis'})
MATCH (f2:Technique {name:'Mullins Model Validation'})
MATCH (dt:DeliverableTemplate {name:'Well-Defined Problem Statement'})
MERGE (cp)-[:GOVERNS]->(f1)
MERGE (cp)-[:GOVERNS]->(f2)
MERGE (cp)-[:EXPRESSED_BY]->(dt);

MATCH (cp:CorePrinciple {name:'Relentless Feedback Loops'})
MATCH (f:Framework {name:'Causal Loop Diagrams'})
MERGE (cp)-[:GOVERNS]->(f);

MATCH (cp:CorePrinciple {name:'Domain-Driven Opportunity Hunting'})
MATCH (f:Framework {name:'Domain Selection'})
MERGE (cp)-[:GOVERNS]->(f);

MATCH (cp:CorePrinciple {name:'Dominant Design Awareness'})
MATCH (f1:Framework {name:'Sustaining vs Disruptive Innovation'})
MATCH (f2:Framework {name:'Trending to the Absurd'})
MERGE (cp)-[:GOVERNS]->(f1)
MERGE (cp)-[:GOVERNS]->(f2);

MATCH (cp:CorePrinciple {name:'Uncertainty Is Your Home'})
MATCH (f1:Framework {name:'Cynefin Framework'})
MATCH (f2:Framework {name:'Knowns and Unknowns Matrix Framework'})
MERGE (cp)-[:GOVERNS]->(f1)
MERGE (cp)-[:GOVERNS]->(f2);

MATCH (cp:CorePrinciple {name:'Cross-Pollination by Force'})
MATCH (f:Framework {name:'Algorithmic Generation of Reverse Salient Solutions'})
MERGE (cp)-[:GOVERNS]->(f);

MATCH (cp:CorePrinciple {name:'Public Innovation Commons'})
MATCH (f:Framework {name:'Six Thinking Hats'})
MERGE (cp)-[:GOVERNS]->(f);

// VERIFY: MATCH (n:CorePrinciple)-[r:GOVERNS|EMBODIED_IN|EXPRESSED_BY]->()
//         RETURN count(r); -- 22+


// ============================================================
// SECTION 15: FRAMEWORKAGENT WIRING (6 orphans -> fully wired)
// ============================================================

MATCH (agent:FrameworkAgent {name:'DevilsAdvocateAgent'})
MATCH (f:Framework) WHERE f.name STARTS WITH 'PWS-Bias Devil'
MATCH (pt:ProblemType {name:'Well-Defined Problem'})
MATCH (bot:Bot {name:'Red Team'})
MERGE (agent)-[:DERIVED_FROM]->(f)
MERGE (agent)-[:APPLIES_TO]->(pt)
MERGE (agent)-[:IMPLEMENTED_BY]->(bot);

MATCH (agent:FrameworkAgent {name:'InvestmentAnalysisAgent'})
MATCH (f:Technique {name:'Mullins Model Validation'})
MATCH (pt:ProblemType {name:'Well-Defined Problem'})
MATCH (bot:Bot {name:'Lawrence'})
MERGE (agent)-[:DERIVED_FROM]->(f)
MERGE (agent)-[:APPLIES_TO]->(pt)
MERGE (agent)-[:IMPLEMENTED_BY]->(bot);

MATCH (agent:FrameworkAgent {name:'DomainExplorerAgent'})
MATCH (f:Framework {name:'Domain Selection'})
MATCH (pt:ProblemType {name:'Undefined Problem'})
MATCH (bot:Bot {name:'Larry Playground'})
MERGE (agent)-[:DERIVED_FROM]->(f)
MERGE (agent)-[:APPLIES_TO]->(pt)
MERGE (agent)-[:IMPLEMENTED_BY]->(bot);

MATCH (agent:FrameworkAgent {name:'BiasDetectorAgent'})
MATCH (f:Framework {name:'Beautiful Questions Bias Detection'})
MATCH (pt:ProblemType {name:'Ill-Defined Problem'})
MATCH (bot:Bot {name:'Red Team'})
MERGE (agent)-[:DERIVED_FROM]->(f)
MERGE (agent)-[:APPLIES_TO]->(pt)
MERGE (agent)-[:IMPLEMENTED_BY]->(bot);

MATCH (agent:FrameworkAgent {name:'KnownUnknownsAgent'})
MATCH (f:Framework {name:'Knowns and Unknowns Matrix Framework'})
MATCH (pt:ProblemType {name:'Undefined Problem'})
MATCH (bot:Bot {name:'Known/Unknown Matrix'})
MERGE (agent)-[:DERIVED_FROM]->(f)
MERGE (agent)-[:APPLIES_TO]->(pt)
MERGE (agent)-[:IMPLEMENTED_BY]->(bot);

MATCH (agent:FrameworkAgent {name:'CrossDomainInnovationAgent'})
MATCH (f:Framework {name:'Algorithmic Generation of Reverse Salient Solutions'})
MATCH (pt:ProblemType {name:'Ill-Defined Problem'})
MATCH (bot:Bot {name:'Larry Playground'})
MERGE (agent)-[:DERIVED_FROM]->(f)
MERGE (agent)-[:APPLIES_TO]->(pt)
MERGE (agent)-[:IMPLEMENTED_BY]->(bot);

MATCH (agent:FrameworkAgent {name:'SixHatsAgent'})
MATCH (f:Framework {name:'Six Thinking Hats'})
MATCH (pt:ProblemType {name:'Ill-Defined Problem'})
MATCH (bot:Bot {name:'Larry Playground'})
MERGE (agent)-[:DERIVED_FROM]->(f)
MERGE (agent)-[:APPLIES_TO]->(pt)
MERGE (agent)-[:IMPLEMENTED_BY]->(bot);

// VERIFY:
// MATCH (n:FrameworkAgent) WITH n, size([(n)--() | 1]) AS c
// RETURN n.name, c ORDER BY c ASC; -- all should be 3+


// ============================================================
// SECTION 16: CASESTUDY WIRING
// ============================================================

MATCH (cs:CaseStudy {name:'Challenger'})
MATCH (rca:Framework {name:'Root Cause Analysis'})
MATCH (st:Framework {name:'Systems Thinking'})
MATCH (wpd:Framework {name:'Wicked Problem Detection Framework'})
SET cs.description = 'NASA Space Shuttle Challenger 1986. Organizational failure, '
  + 'groupthink, wicked problem misclassification under launch pressure.'
SET cs.domain = 'aerospace'
MERGE (cs)-[:ILLUSTRATES]->(rca)
MERGE (cs)-[:ILLUSTRATES]->(st)
MERGE (cs)-[:ILLUSTRATES]->(wpd);

MATCH (cs:CaseStudy {name:'NASA'})
MATCH (st:Framework {name:'Systems Thinking'})
MATCH (wpd:Framework {name:'Wicked Problem Detection Framework'})
SET cs.description = 'NASA organizational culture -- complex systems leadership, '
  + 'distributed decision-making, failure under uncertainty.'
MERGE (cs)-[:ILLUSTRATES]->(st)
MERGE (cs)-[:ILLUSTRATES]->(wpd);

MATCH (cs:CaseStudy {name:'Netflix'})
MATCH (f1:Framework {name:'Sustaining vs Disruptive Innovation'})
MATCH (f2:Framework {name:'Tools vs Platforms Innovation'})
MERGE (cs)-[:ILLUSTRATES]->(f1)
MERGE (cs)-[:ILLUSTRATES]->(f2);

MATCH (cs:CaseStudy {name:'Starbucks'})
MATCH (f:Framework {name:'Jobs to Be Done (JTBD)'})
MERGE (cs)-[:ILLUSTRATES]->(f);

MATCH (cs:CaseStudy {name:'GoPro'})
MATCH (f:Framework {name:'Tools vs Platforms Innovation'})
MERGE (cs)-[:ILLUSTRATES]->(f);

MATCH (cs:CaseStudy) WHERE cs.name CONTAINS 'Marconi'
MATCH (f:Framework {name:'Reverse Salient Analysis'})
MERGE (cs)-[:ILLUSTRATES]->(f);

MATCH (cs:CaseStudy) WHERE cs.name CONTAINS 'Naval Aviation'
MATCH (f:Framework {name:'Reverse Salient Analysis'})
MERGE (cs)-[:ILLUSTRATES]->(f);

MATCH (cs:CaseStudy {name:'Municipal Water Systems'})
MATCH (f:Framework {name:'Systems Thinking'})
MERGE (cs)-[:ILLUSTRATES]->(f);

MATCH (cs:CaseStudy {name:'Refugee Permanence'})
MATCH (f:Framework {name:'Wicked Problem Detection Framework'})
MERGE (cs)-[:ILLUSTRATES]->(f);

MATCH (cs:CaseStudy {name:'Total Urbanization'})
MATCH (f:Framework {name:'Trending to the Absurd'})
MERGE (cs)-[:ILLUSTRATES]->(f);

MATCH (cs:CaseStudy {name:'Extreme Water Limitation'})
MATCH (f:Framework {name:'Trending to the Absurd'})
MERGE (cs)-[:ILLUSTRATES]->(f);

MATCH (cs:CaseStudy {name:'Future of Educational Evaluation'})
MATCH (f:Framework {name:'Wicked Problem Detection Framework'})
MERGE (cs)-[:ILLUSTRATES]->(f);

MATCH (cs:CaseStudy) WHERE cs.name CONTAINS 'NATO'
MATCH (f:Framework {name:'Algorithmic Generation of Reverse Salient Solutions'})
MERGE (cs)-[:ILLUSTRATES]->(f);

MATCH (cs:CaseStudy) WHERE cs.name CONTAINS 'Shell'
MATCH (f:Framework {name:'Scenario Planning'})
MERGE (cs)-[:ILLUSTRATES]->(f);

MATCH (cs:CaseStudy {name:'Harbor cleanup robot'})
MATCH (f:Framework {name:'PWS Triple Validation Compass'})
MERGE (cs)-[:ILLUSTRATES]->(f);

MATCH (cs:CaseStudy {name:'Adaptive air mattress'})
MATCH (f:Framework {name:'Process Mapping for Innovation'})
MERGE (cs)-[:ILLUSTRATES]->(f);

MATCH (cs:CaseStudy) WHERE cs.name CONTAINS 'Military medicine'
MATCH (f:Framework {name:'Reverse Salient Analysis'})
MERGE (cs)-[:ILLUSTRATES]->(f);

// VERIFY:
// MATCH (n:CaseStudy) WITH n, size([(n)--() | 1]) AS c
// WHERE c < 2 RETURN count(n); -- target: <5


// ============================================================
// SECTION 17: LAZY LAYER BRIDGE -- ALIAS_OF
// ============================================================

// 17a: ProblemType aliases
MATCH (lazy:LazyGraphConcept)
WHERE lazy.name IN [
  'Well-Defined Problem','A Well-Defined Problem','The Well-Defined Problem',
  'Well-Defined Problems','Your Well-Defined Problem'
]
MATCH (canonical:ProblemType {name:'Well-Defined Problem'})
  WHERE NOT '__Entity__' IN labels(canonical)
MERGE (lazy)-[:ALIAS_OF]->(canonical);

MATCH (lazy:LazyGraphConcept)
WHERE lazy.name IN [
  'Ill-Defined Problems','An Ill-Defined Problem','Ill-defined',
  'Exploring Ill-Defined Problems'
]
MATCH (canonical:ProblemType {name:'Ill-Defined Problem'})
MERGE (lazy)-[:ALIAS_OF]->(canonical);

MATCH (lazy:LazyGraphConcept)
WHERE lazy.name IN [
  'Wicked Problems','Wicked Problem','A Wicked Problem','Every Wicked Problem'
]
MATCH (canonical:ProblemType {name:'Wicked Problem'})
MERGE (lazy)-[:ALIAS_OF]->(canonical);

MATCH (lazy:LazyGraphConcept)
WHERE lazy.name IN ['Undefined Problems','Un-Defined And Ill-Defined Problems']
MATCH (canonical:ProblemType {name:'Undefined Problem'})
MERGE (lazy)-[:ALIAS_OF]->(canonical);

// 17b: Framework aliases
MATCH (lazy:LazyGraphConcept {name:'Trending To The Absurd'})
MATCH (f:Framework {name:'Trending to the Absurd'})
MERGE (lazy)-[:ALIAS_OF]->(f);

MATCH (lazy:LazyGraphConcept {name:'Scenario Planning'})
MATCH (f:Framework {name:'Scenario Planning'})
MERGE (lazy)-[:ALIAS_OF]->(f);

MATCH (lazy:LazyGraphConcept {name:'Design Thinking'})
MATCH (f:Framework {name:'Design Thinking'})
MERGE (lazy)-[:ALIAS_OF]->(f);

MATCH (lazy:LazyGraphConcept {name:'Systems Thinking'})
MATCH (f:Framework {name:'Systems Thinking'})
MERGE (lazy)-[:ALIAS_OF]->(f);

MATCH (lazy:LazyGraphConcept {name:'Causal Loop Diagrams'})
MATCH (f:Framework {name:'Causal Loop Diagrams'})
MERGE (lazy)-[:ALIAS_OF]->(f);

MATCH (lazy:LazyGraphConcept {name:'Reverse Salient'})
MATCH (f:Framework {name:'Reverse Salient Analysis'})
MERGE (lazy)-[:ALIAS_OF]->(f);

MATCH (lazy:LazyGraphConcept {name:'Four Lenses'})
MATCH (f:Framework {name:'Four Lenses of Innovation'})
MERGE (lazy)-[:ALIAS_OF]->(f);

// 17c: Promote high-proximity LazyGraphConcepts
CALL apoc.periodic.iterate(
  'MATCH (lazy:LazyGraphConcept)-[r:CO_OCCURS]-(neighbor:LazyGraphConcept)
   WHERE neighbor.name IN [
     "PWS","Innovation","Well-Defined Problem","Ill-Defined Problems",
     "Problem Types","Wicked Problems","Opportunity Bank","Reverse Salient",
     "Jobs to Be Done","Four Lenses","Systems Thinking","Causal Loop Diagrams",
     "Trending To The Absurd","Scenario Planning","Design Thinking"
   ]
   WITH lazy, count(neighbor) AS fw_neighbors, sum(r.weight) AS proximity
   WHERE fw_neighbors >= 3 AND proximity >= 10
     AND size(lazy.name) < 50
     AND NOT lazy.name IN [
       "Well-Defined Problem","Ill-Defined Problems","Problem Types",
       "Wicked Problems","PWS","Innovation"
     ]
   RETURN lazy',
  'SET lazy:Concept REMOVE lazy:LazyGraphConcept',
  {batchSize:100}
);

// 17d: Delete orphan LazyGraphConcepts
CALL apoc.periodic.iterate(
  'MATCH (n:LazyGraphConcept)
   WHERE NOT (n)--()
   AND size(n.name) < 60
   RETURN n',
  'DELETE n',
  {batchSize:500}
);

// VERIFY:
// MATCH ()-[r:ALIAS_OF]->() RETURN count(r); -- 20+
// MATCH (n:LazyGraphConcept) WHERE NOT (n)--() RETURN count(n); -- 0


// ============================================================
// SECTION 18: INDEXES
// ============================================================

CREATE INDEX framework_agent_name IF NOT EXISTS
  FOR (n:FrameworkAgent) ON (n.name);
CREATE INDEX deliverable_template_name IF NOT EXISTS
  FOR (n:DeliverableTemplate) ON (n.name);
CREATE INDEX context_flow_name IF NOT EXISTS
  FOR (n:ContextFlowType) ON (n.name);
CREATE INDEX book_name_idx IF NOT EXISTS
  FOR (n:Book) ON (n.name);
CREATE INDEX problem_type_name IF NOT EXISTS
  FOR (n:ProblemType) ON (n.name);
CREATE INDEX technique_name IF NOT EXISTS
  FOR (n:Technique) ON (n.name);


// ============================================================
// SECTION 19: GRADING CALIBRATION GAP -- SYSTEM GAP NODE
// ============================================================

MERGE (gap:SystemGap {name:'GradingCalibrationGap'})
SET gap.severity = 'high'
SET gap.description =
  'Schema.md promises 100+ Example nodes with grade, rubric_scores, '
  + 'feedback_patterns, percentile from Lawrence grading records. '
  + 'Graph has 0. PWS Grading Bot is running on zero calibration data.'
SET gap.required_node_label = 'Example'
SET gap.required_properties = [
  'grade','rubric_scores','feedback_patterns','percentile',
  'submission_text','framework_used','problem_type'
]
SET gap.resolution = 'Data loading task -- not a wiring problem. '
  + 'Load 100+ graded submissions from Lawrence records as Example nodes, '
  + 'then wire: (Example)-[:DEMONSTRATES]->(Framework), '
  + '(Example)-[:GRADED_BY]->(Bot {name:PWS Grading}), '
  + '(Example)-[:ILLUSTRATES]->(ProblemType)'
SET gap.detected = date();

MATCH (gap:SystemGap {name:'GradingCalibrationGap'})
MATCH (bot:Bot {name:'PWS Grading'})
MERGE (gap)-[:AFFECTS]->(bot);


// ============================================================
// FINAL VERIFICATION BLOCK
// ============================================================

// MATCH ()-[r:FEEDS_INTO]->(:Framework) RETURN count(r);          -- 30+
// MATCH ()-[r:TYPICAL_AT]->() RETURN count(r);                    -- 30+
// MATCH ()-[r:ADDRESSES_PROBLEM_TYPE]->() RETURN count(r);        -- 60+
// MATCH ()-[r:PREREQUISITE]->() RETURN count(r);                  -- 14
// MATCH ()-[r:ALIAS_OF]->() RETURN count(r);                      -- 20+
// MATCH ()-[r:TEACHES]->() RETURN count(r);                       -- 16+
// MATCH (b:Bot)-[r:IMPLEMENTS]->() RETURN count(r);               -- 15
// MATCH ()-[r:GOVERNS|EMBODIED_IN|EXPRESSED_BY]->() RETURN count(r); -- 22+
// MATCH ()-[r:GROUNDS_FRAMEWORK]->() RETURN count(r);             -- 10+
// MATCH (n:FrameworkAgent) WITH n, size([(n)--() | 1]) AS c
//   WHERE c < 3 RETURN count(n);                                  -- 0
// MATCH (n:LazyGraphConcept) WHERE NOT (n)--() RETURN count(n);   -- 0
// MATCH (n:DictionaryTerm) WITH n.name, count(n) AS c
//   WHERE c > 1 RETURN count(n);                                  -- 0
// MATCH (n:Book) WITH n.name, count(n) AS c
//   WHERE c > 1 RETURN count(n);                                  -- 0

// ============================================================
// v1.8.2 COMPLETE
// ============================================================
