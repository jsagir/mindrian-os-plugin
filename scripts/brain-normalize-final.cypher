// ============================================================
// BRAIN NORMALIZATION -- FINAL CONSOLIDATED SCRIPT
// All node names verified against live Neo4j 5.27-aura graph
// APOC 2026.03.0 confirmed available
//
// Run order: Sections 1-13 sequentially
// Each section is idempotent (safe to re-run)
//
// PRE-RUN STATE (2026-04-06):
//   FEEDS_INTO: 17 (only 4 are Framework->Framework)
//   TYPICAL_AT: 4
//   ADDRESSES_PROBLEM_TYPE: 38 (heavily polluted with __Entity__ noise)
//   PREREQUISITE: 0
//   GOVERNS: 0
//   GROUNDS_FRAMEWORK: 0
//   FrameworkAgents wired: 3 full + 1 partial (SixHats) / 10
//   CaseStudies wired: 10/30
//
// TARGET STATE:
//   FEEDS_INTO: 35+ (all Framework->Framework)
//   TYPICAL_AT: 30+
//   ADDRESSES_PROBLEM_TYPE: 50+ (Framework-only, with effectiveness scores)
//   PREREQUISITE: 12+
//   GOVERNS: 10+
//   GROUNDS_FRAMEWORK: 30+
//   FrameworkAgents wired: 10/10
//   CaseStudies wired: 26+/30
// ============================================================


// ============================================================
// SECTION 1: LABEL CLEANUP
// ============================================================

// 1a. Merge lowercase label variants into PascalCase canonical
CALL apoc.periodic.iterate(
  'MATCH (n:concept) WHERE NOT n:Concept RETURN n',
  'SET n:Concept REMOVE n:concept',
  {batchSize: 500}
);

CALL apoc.periodic.iterate(
  'MATCH (n:content) WHERE NOT n:Content RETURN n',
  'SET n:Content REMOVE n:content',
  {batchSize: 500}
);

CALL apoc.periodic.iterate(
  'MATCH (n:person) WHERE NOT n:Person RETURN n',
  'SET n:Person REMOVE n:person',
  {batchSize: 500}
);

CALL apoc.periodic.iterate(
  'MATCH (n:organization) WHERE NOT n:Organization RETURN n',
  'SET n:Organization REMOVE n:organization',
  {batchSize: 500}
);

CALL apoc.periodic.iterate(
  'MATCH (n:location) WHERE NOT n:Location RETURN n',
  'SET n:Location REMOVE n:location',
  {batchSize: 500}
);

CALL apoc.periodic.iterate(
  'MATCH (n:method) WHERE NOT n:Method RETURN n',
  'SET n:Method REMOVE n:method',
  {batchSize: 500}
);

CALL apoc.periodic.iterate(
  'MATCH (n:event) WHERE NOT n:Event RETURN n',
  'SET n:Event REMOVE n:event',
  {batchSize: 500}
);

CALL apoc.periodic.iterate(
  'MATCH (n:group) WHERE NOT n:Group RETURN n',
  'SET n:Group REMOVE n:group',
  {batchSize: 500}
);

CALL apoc.periodic.iterate(
  'MATCH (n:DOMAIN) WHERE NOT n:Domain RETURN n',
  'SET n:Domain REMOVE n:DOMAIN',
  {batchSize: 500}
);

CALL apoc.periodic.iterate(
  'MATCH (n:OPPORTUNITY) WHERE NOT n:Opportunity RETURN n',
  'SET n:Opportunity REMOVE n:OPPORTUNITY',
  {batchSize: 500}
);

CALL apoc.periodic.iterate(
  'MATCH (n:SOURCE) WHERE NOT n:Source RETURN n',
  'SET n:Source REMOVE n:SOURCE',
  {batchSize: 500}
);

// 1b. Remove orphan UNKNOWN and base labels
CALL apoc.periodic.iterate(
  'MATCH (n:UNKNOWN) RETURN n',
  'REMOVE n:UNKNOWN',
  {batchSize: 500}
);

CALL apoc.periodic.iterate(
  'MATCH (n:base) RETURN n',
  'REMOVE n:base',
  {batchSize: 500}
);

// 1c. Framework duplicate: "Safe fail culture" -> merge into "Safe Fail Culture"
MATCH (a:Framework {name: 'Safe Fail Culture'}), (b:Framework {name: 'Safe fail culture'})
CALL apoc.refactor.mergeNodes([a, b], {properties: 'combine', mergeRels: true}) YIELD node
SET node.name = 'Safe Fail Culture'
RETURN node.name;


// ============================================================
// SECTION 2: PROBLEMTYPE HIERARCHY
// Canonical: Undefined, Ill-Defined, Well-Defined
// Meta: Wicked, Tame
// Matrix: Definition x Complexity combos
// RCA-specific: Recurring Failure, etc.
// ============================================================

// 2a. Wire matrix combinations as SUBTYPE_OF canonical
MATCH (sub:ProblemType {name: 'Undefined + Simple'})
MATCH (parent:ProblemType {name: 'Undefined Problem'})
MERGE (sub)-[:SUBTYPE_OF]->(parent);

MATCH (sub:ProblemType {name: 'Undefined + Complex'})
MATCH (parent:ProblemType {name: 'Undefined Problem'})
MERGE (sub)-[:SUBTYPE_OF]->(parent);

MATCH (sub:ProblemType {name: 'Undefined + Wicked'})
MATCH (parent:ProblemType {name: 'Undefined Problem'})
MERGE (sub)-[:SUBTYPE_OF]->(parent);

MATCH (sub:ProblemType {name: 'Ill-Defined + Simple'})
MATCH (parent:ProblemType {name: 'Ill-Defined Problem'})
MERGE (sub)-[:SUBTYPE_OF]->(parent);

MATCH (sub:ProblemType {name: 'Ill-Defined + Wicked'})
MATCH (parent:ProblemType {name: 'Ill-Defined Problem'})
MERGE (sub)-[:SUBTYPE_OF]->(parent);

MATCH (sub:ProblemType {name: 'Well-Defined + Simple'})
MATCH (parent:ProblemType {name: 'Well-Defined Problem'})
MERGE (sub)-[:SUBTYPE_OF]->(parent);

MATCH (sub:ProblemType {name: 'Well-Defined + Wicked'})
MATCH (parent:ProblemType {name: 'Well-Defined Problem'})
MERGE (sub)-[:SUBTYPE_OF]->(parent);

// 2b. RCA-specific types -> Well-Defined Problem
WITH ['Recurring Failure','Quality Defect','System Failure',
      'Process Breakdown','Operational Underperformance','Safety Incident'] AS rca_types
UNWIND rca_types AS rca_name
MATCH (sub:ProblemType {name: rca_name})
MATCH (parent:ProblemType {name: 'Well-Defined Problem'})
MERGE (sub)-[:SUBTYPE_OF]->(parent);

// 2c. Wire Wicked/Tame as meta-types
MATCH (w:ProblemType {name: 'Wicked Problem'})
MATCH (i:ProblemType {name: 'Ill-Defined Problem'})
MERGE (w)-[:OFTEN_PRESENTS_AS]->(i);

MATCH (t:ProblemType {name: 'Tame Problem'})
MATCH (wd:ProblemType {name: 'Well-Defined Problem'})
MERGE (t)-[:OFTEN_PRESENTS_AS]->(wd);

// 2d. Canonical progression chain
MATCH (u:ProblemType {name: 'Undefined Problem'})
MATCH (i:ProblemType {name: 'Ill-Defined Problem'})
MATCH (w:ProblemType {name: 'Well-Defined Problem'})
MERGE (u)-[:CLARIFIES_TO]->(i)
MERGE (i)-[:CLARIFIES_TO]->(w);


// ============================================================
// SECTION 3: VENTURE STAGE CHAIN
// VentureStage nodes already exist. Wire the progression.
// ============================================================

MATCH (s1:VentureStage {name: 'Pre-Opportunity'})
MATCH (s2:VentureStage {name: 'Opportunity Identified'})
MATCH (s3:VentureStage {name: 'Problem Validation'})
MATCH (s4:VentureStage {name: 'Well-Defined Problem'})
MATCH (s5:VentureStage {name: 'Ready to Build'})
MERGE (s1)-[:PROGRESSES_TO]->(s2)
MERGE (s2)-[:PROGRESSES_TO]->(s3)
MERGE (s3)-[:PROGRESSES_TO]->(s4)
MERGE (s4)-[:PROGRESSES_TO]->(s5);

// Set order properties
SET s1.order = 1, s2.order = 2, s3.order = 3, s4.order = 4, s5.order = 5;

CREATE INDEX venture_stage_name IF NOT EXISTS FOR (n:VentureStage) ON (n.name);


// ============================================================
// SECTION 4: FEEDS_INTO -- The methodology spine
// ONLY Framework->Framework edges. Verified names.
// Current: 4 Framework->Framework edges
// Target: 35+
// ============================================================

// -- PWS Core Pipeline (Workshop 1-8 sequence) --

// Pre-Opportunity: Domain -> Four Lenses -> JTBD
MATCH (a:Framework {name: 'Domain Selection'})
MATCH (b:Framework {name: 'Four Lenses of Innovation'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.95, chain: 'pws_core'}]->(b);

// Four Lenses already feeds into Sustaining vs Disruptive (exists)

MATCH (a:Framework {name: 'Four Lenses of Innovation'})
MATCH (b:Framework {name: 'Jobs to Be Done (JTBD)'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.9, chain: 'pws_core'}]->(b);

// JTBD -> Process Mapping -> Reverse Salient
MATCH (a:Framework {name: 'Jobs to Be Done (JTBD)'})
MATCH (b:Framework {name: 'Process Mapping for Innovation'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.9, chain: 'pws_core'}]->(b);

MATCH (a:Framework {name: 'Process Mapping for Innovation'})
MATCH (b:Framework {name: 'Reverse Salient Analysis'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.9, chain: 'pws_core'}]->(b);

// Reverse Salient -> Causal Loop Diagrams (Systems Thinking already feeds CLD)
MATCH (a:Framework {name: 'Reverse Salient Analysis'})
MATCH (b:Framework {name: 'Causal Loop Diagrams'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.85, chain: 'pws_core'}]->(b);

// CLD -> Root Cause Analysis (Root Cause already feeds Systems Thinking - bidirectional)
MATCH (a:Framework {name: 'Causal Loop Diagrams'})
MATCH (b:Framework {name: 'Root Cause Analysis'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.85, chain: 'pws_core'}]->(b);

// Root Cause -> Problem Definition Transformation
MATCH (a:Framework {name: 'Root Cause Analysis'})
MATCH (b:Framework {name: 'Problem Definition Transformation Framework'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.9, chain: 'pws_core'}]->(b);

// Problem Definition -> Triple Validation
MATCH (a:Framework {name: 'Problem Definition Transformation Framework'})
MATCH (b:Framework {name: 'PWS Triple Validation Compass'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.9, chain: 'pws_core'}]->(b);

// Triple Validation -> Due Diligence cluster
MATCH (a:Framework {name: 'PWS Triple Validation Compass'})
MATCH (b:Framework {name: 'Financial Due Diligence Framework'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.8, chain: 'pws_core'}]->(b);

MATCH (a:Framework {name: 'PWS Triple Validation Compass'})
MATCH (b:Framework {name: 'IP Due Diligence Framework'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.8, chain: 'pws_core'}]->(b);

MATCH (a:Framework {name: 'PWS Triple Validation Compass'})
MATCH (b:Framework {name: 'Legal Due Diligence Framework'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.75, chain: 'pws_core'}]->(b);

MATCH (a:Framework {name: 'PWS Triple Validation Compass'})
MATCH (b:Framework {name: 'ESG Due Diligence Framework'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.75, chain: 'pws_core'}]->(b);

// Financial -> Legal (common sequence)
MATCH (a:Framework {name: 'Financial Due Diligence Framework'})
MATCH (b:Framework {name: 'Legal Due Diligence Framework'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.7, chain: 'due_diligence'}]->(b);

// -- Cynefin routing cluster --
MATCH (a:Framework {name: 'Knowns and Unknowns Matrix Framework'})
MATCH (b:Framework {name: 'Cynefin Framework'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.85, chain: 'problem_classification'}]->(b);

MATCH (a:Framework {name: 'Cynefin Framework'})
MATCH (b:Framework {name: 'Wicked Problem Detection Framework'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.9, chain: 'problem_classification'}]->(b);

MATCH (a:Framework {name: 'Cynefin Framework'})
MATCH (b:Framework {name: 'Scenario Planning'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.8, chain: 'problem_classification'}]->(b);

MATCH (a:Framework {name: 'Cynefin Framework'})
MATCH (b:Framework {name: 'Beautiful Question Framework'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.8, chain: 'problem_classification'}]->(b);

// -- Wicked problem chain --
MATCH (a:Framework {name: 'Wicked Problem Detection Framework'})
MATCH (b:Framework {name: 'Causal Loop Diagrams'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.85, chain: 'wicked'}]->(b);

MATCH (a:Framework {name: 'Wicked Problem Detection Framework'})
MATCH (b:Framework {name: 'Six Thinking Hats'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.8, chain: 'wicked'}]->(b);

// Scenario Planning -> Knowns/Unknowns (reflexive loop)
MATCH (a:Framework {name: 'Scenario Planning'})
MATCH (b:Framework {name: 'Knowns and Unknowns Matrix Framework'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.75, chain: 'uncertainty'}]->(b);

// -- Six Hats / BONO cluster --
MATCH (a:Framework {name: 'BONO-Innovation Framework'})
MATCH (b:Framework {name: 'Six Thinking Hats'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.95, chain: 'bono'}]->(b);

MATCH (a:Framework {name: 'Six Thinking Hats'})
MATCH (b:Framework {name: 'Hypothesis-Driven Problem Solving'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.8, chain: 'bono'}]->(b);

MATCH (a:Framework {name: 'Six Thinking Hats'})
MATCH (b:Framework {name: 'Beautiful Question Framework'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.75, chain: 'bono'}]->(b);

// -- Design / Discovery chain --
MATCH (a:Framework {name: 'Design Thinking'})
MATCH (b:Framework {name: 'Jobs to Be Done (JTBD)'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.85, chain: 'design'}]->(b);

MATCH (a:Framework {name: 'Design Thinking'})
MATCH (b:Framework {name: 'User Journey Mapping'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.9, chain: 'design'}]->(b);

MATCH (a:Framework {name: 'User Journey Mapping'})
MATCH (b:Framework {name: 'Process Mapping for Innovation'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.85, chain: 'design'}]->(b);

// -- Entry points --
MATCH (a:Framework {name: 'Beautiful Question Framework'})
MATCH (b:Framework {name: 'Domain Selection'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.85, chain: 'entry'}]->(b);

MATCH (a:Framework {name: 'Opportunity Recognition as Pattern Recognition'})
MATCH (b:Framework {name: 'Domain Selection'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.85, chain: 'entry'}]->(b);

MATCH (a:Framework {name: 'Trending to the Absurd'})
MATCH (b:Framework {name: 'Scenario Planning'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.8, chain: 'foresight'}]->(b);

MATCH (a:Framework {name: 'Trending to the Absurd'})
MATCH (b:Framework {name: 'Domain Selection'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.75, chain: 'foresight'}]->(b);

// -- Structuring chain --
MATCH (a:Framework {name: 'MECE (Mutually Exclusive, Collectively Exhaustive)'})
MATCH (b:Framework {name: 'The Pyramid Principle'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.95, chain: 'minto'}]->(b);

MATCH (a:Framework {name: 'The Pyramid Principle'})
MATCH (b:Framework {name: 'Hypothesis-Driven Problem Solving'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.8, chain: 'minto'}]->(b);

// -- Theory of Change --
MATCH (a:Framework {name: 'Theory of Change'})
MATCH (b:Framework {name: 'PWS Triple Validation Compass'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.8, chain: 'validation'}]->(b);

// -- Stock and Flow -> Systems Thinking family --
MATCH (a:Framework {name: 'Stock and Flow Diagrams'})
MATCH (b:Framework {name: 'Causal Loop Diagrams'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.9, chain: 'systems'}]->(b);

// -- Well-Defined Problem as convergence --
MATCH (a:Framework {name: 'Well-Defined Problem Framework'})
MATCH (b:Framework {name: 'Problem Definition Transformation Framework'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.85, chain: 'definition'}]->(b);

// -- Algorithmic Reverse Salient -> Reverse Salient Analysis --
MATCH (a:Framework {name: 'Algorithmic Generation of Reverse Salient Solutions'})
MATCH (b:Framework {name: 'Reverse Salient Analysis'})
MERGE (a)-[:FEEDS_INTO {confidence: 0.9, chain: 'reverse_salient'}]->(b);


// ============================================================
// SECTION 5: TYPICAL_AT -- Framework-to-VentureStage mapping
// Current: 4 edges. Target: 30+
// ============================================================

// Pre-Opportunity: exploration, questioning, domain scanning
WITH ['Domain Selection', 'Four Lenses of Innovation', 'Trending to the Absurd',
      'Beautiful Question Framework', 'Knowns and Unknowns Matrix Framework',
      'Cynefin Framework', 'Opportunity Recognition as Pattern Recognition',
      'Scenario Planning', 'Beautiful Questions Bias Detection'] AS names
UNWIND names AS fname
MATCH (f:Framework {name: fname})
MATCH (s:VentureStage {name: 'Pre-Opportunity'})
MERGE (f)-[:TYPICAL_AT {importance: 0.9}]->(s);

// Opportunity Identified: investigation, user research, system mapping
WITH ['Jobs to Be Done (JTBD)', 'Process Mapping for Innovation',
      'User Journey Mapping', 'Design Thinking', 'Reverse Salient Analysis',
      'BONO-Innovation Framework', 'Six Thinking Hats',
      'Wicked Problem Detection Framework', 'Hypothesis-Driven Problem Solving'] AS names
UNWIND names AS fname
MATCH (f:Framework {name: fname})
MATCH (s:VentureStage {name: 'Opportunity Identified'})
MERGE (f)-[:TYPICAL_AT {importance: 0.9}]->(s);

// Problem Validation: root cause, systems, causal analysis
WITH ['Root Cause Analysis', 'Causal Loop Diagrams', 'Systems Thinking',
      'Stock and Flow Diagrams', 'MECE (Mutually Exclusive, Collectively Exhaustive)',
      'The Pyramid Principle', 'Theory of Change'] AS names
UNWIND names AS fname
MATCH (f:Framework {name: fname})
MATCH (s:VentureStage {name: 'Problem Validation'})
MERGE (f)-[:TYPICAL_AT {importance: 0.9}]->(s);

// Well-Defined Problem: definition, validation, compass
WITH ['Problem Definition Transformation Framework', 'PWS Triple Validation Compass',
      'Well-Defined Problem Framework',
      'Algorithmic Generation of Reverse Salient Solutions'] AS names
UNWIND names AS fname
MATCH (f:Framework {name: fname})
MATCH (s:VentureStage {name: 'Well-Defined Problem'})
MERGE (f)-[:TYPICAL_AT {importance: 0.9}]->(s);

// Ready to Build: due diligence, competition, innovation type
WITH ['Financial Due Diligence Framework', 'IP Due Diligence Framework',
      'Legal Due Diligence Framework', 'ESG Due Diligence Framework',
      'Changing Terms of Competition', 'Tools vs Platforms Innovation',
      'Sustaining vs Disruptive Innovation'] AS names
UNWIND names AS fname
MATCH (f:Framework {name: fname})
MATCH (s:VentureStage {name: 'Ready to Build'})
MERGE (f)-[:TYPICAL_AT {importance: 0.9}]->(s);

// Also wire ValidationTools to stages
MATCH (v:ValidationTool {name: 'Mom Test'})
MATCH (s:VentureStage {name: 'Opportunity Identified'})
MERGE (v)-[:TYPICAL_AT {importance: 0.85}]->(s);

MATCH (v:ValidationTool {name: 'MVP Design'})
MATCH (s:VentureStage {name: 'Ready to Build'})
MERGE (v)-[:TYPICAL_AT {importance: 0.85}]->(s);

MATCH (v:ValidationTool {name: 'PWS Value Proposition'})
MATCH (s:VentureStage {name: 'Well-Defined Problem'})
MERGE (v)-[:TYPICAL_AT {importance: 0.9}]->(s);


// ============================================================
// SECTION 6: ADDRESSES_PROBLEM_TYPE -- Clean + Enrich
// Current: 38 edges, heavily polluted with __Entity__ noise
// Strategy: Add clean Framework->ProblemType edges with effectiveness
// Don't delete noisy edges (they might be useful for search)
// ============================================================

// Undefined Problem: exploration tools
WITH ['Domain Selection', 'Trending to the Absurd', 'Beautiful Question Framework',
      'Knowns and Unknowns Matrix Framework', 'Beautiful Questions Bias Detection',
      'Opportunity Recognition as Pattern Recognition'] AS names
UNWIND names AS fname
MATCH (f:Framework {name: fname})
MATCH (pt:ProblemType {name: 'Undefined Problem'})
MERGE (f)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.85}]->(pt);

// Ill-Defined Problem: investigation tools
WITH ['Jobs to Be Done (JTBD)', 'Process Mapping for Innovation',
      'User Journey Mapping', 'Design Thinking', 'Reverse Salient Analysis',
      'BONO-Innovation Framework', 'Six Thinking Hats',
      'Hypothesis-Driven Problem Solving', 'Causal Loop Diagrams',
      'Systems Thinking', 'Wicked Problem Detection Framework'] AS names
UNWIND names AS fname
MATCH (f:Framework {name: fname})
MATCH (pt:ProblemType {name: 'Ill-Defined Problem'})
MERGE (f)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.85}]->(pt);

// Well-Defined Problem: structuring and validation tools
WITH ['Problem Definition Transformation Framework', 'PWS Triple Validation Compass',
      'MECE (Mutually Exclusive, Collectively Exhaustive)', 'The Pyramid Principle',
      'Root Cause Analysis', 'Theory of Change', 'Well-Defined Problem Framework',
      'Financial Due Diligence Framework', 'IP Due Diligence Framework',
      'Legal Due Diligence Framework', 'ESG Due Diligence Framework'] AS names
UNWIND names AS fname
MATCH (f:Framework {name: fname})
MATCH (pt:ProblemType {name: 'Well-Defined Problem'})
MERGE (f)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.85}]->(pt);

// Wicked Problem: multi-perspective + systems tools
WITH ['Six Thinking Hats', 'Causal Loop Diagrams', 'Systems Thinking',
      'Scenario Planning', 'Cynefin Framework', 'Wicked Problem Detection Framework',
      'Knowns and Unknowns Matrix Framework', 'Root Cause Analysis',
      'Stock and Flow Diagrams'] AS names
UNWIND names AS fname
MATCH (f:Framework {name: fname})
MATCH (pt:ProblemType {name: 'Wicked Problem'})
MERGE (f)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.8}]->(pt);

// ValidationTools -> ProblemTypes
MATCH (v:ValidationTool {name: 'Mom Test'})
MATCH (pt:ProblemType {name: 'Ill-Defined Problem'})
MERGE (v)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.85}]->(pt);

MATCH (v:ValidationTool {name: 'MVP Design'})
MATCH (pt:ProblemType {name: 'Well-Defined Problem'})
MERGE (v)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.8}]->(pt);

MATCH (v:ValidationTool {name: 'PWS Value Proposition'})
MATCH (pt:ProblemType {name: 'Well-Defined Problem'})
MERGE (v)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.9}]->(pt);


// ============================================================
// SECTION 7: PREREQUISITE -- What must come first
// Current: 0 edges. This is the gap that causes Larry to
// recommend advanced frameworks to beginners.
// ============================================================

// Domain Selection is prerequisite for everything downstream
MATCH (a:Framework {name: 'Four Lenses of Innovation'})
MATCH (b:Framework {name: 'Domain Selection'})
MERGE (a)-[:PREREQUISITE {strength: 0.9}]->(b);

// JTBD needs domain context
MATCH (a:Framework {name: 'Jobs to Be Done (JTBD)'})
MATCH (b:Framework {name: 'Domain Selection'})
MERGE (a)-[:PREREQUISITE {strength: 0.8}]->(b);

// Reverse Salient needs process mapping
MATCH (a:Framework {name: 'Reverse Salient Analysis'})
MATCH (b:Framework {name: 'Process Mapping for Innovation'})
MERGE (a)-[:PREREQUISITE {strength: 0.85}]->(b);

// Causal Loop Diagrams needs systems understanding
MATCH (a:Framework {name: 'Causal Loop Diagrams'})
MATCH (b:Framework {name: 'Systems Thinking'})
MERGE (a)-[:PREREQUISITE {strength: 0.85}]->(b);

// Root Cause needs something TO analyze
MATCH (a:Framework {name: 'Root Cause Analysis'})
MATCH (b:Framework {name: 'Reverse Salient Analysis'})
MERGE (a)-[:PREREQUISITE {strength: 0.75}]->(b);

// Problem Definition Transformation needs root cause work
MATCH (a:Framework {name: 'Problem Definition Transformation Framework'})
MATCH (b:Framework {name: 'Root Cause Analysis'})
MERGE (a)-[:PREREQUISITE {strength: 0.85}]->(b);

// Triple Validation needs a defined problem
MATCH (a:Framework {name: 'PWS Triple Validation Compass'})
MATCH (b:Framework {name: 'Problem Definition Transformation Framework'})
MERGE (a)-[:PREREQUISITE {strength: 0.9}]->(b);

// Wicked Problem Detection needs Cynefin classification first
MATCH (a:Framework {name: 'Wicked Problem Detection Framework'})
MATCH (b:Framework {name: 'Cynefin Framework'})
MERGE (a)-[:PREREQUISITE {strength: 0.8}]->(b);

// Pyramid Principle needs MECE foundation
MATCH (a:Framework {name: 'The Pyramid Principle'})
MATCH (b:Framework {name: 'MECE (Mutually Exclusive, Collectively Exhaustive)'})
MERGE (a)-[:PREREQUISITE {strength: 0.9}]->(b);

// Due diligence needs validated compass
MATCH (a:Framework {name: 'Financial Due Diligence Framework'})
MATCH (b:Framework {name: 'PWS Triple Validation Compass'})
MERGE (a)-[:PREREQUISITE {strength: 0.85}]->(b);

MATCH (a:Framework {name: 'IP Due Diligence Framework'})
MATCH (b:Framework {name: 'PWS Triple Validation Compass'})
MERGE (a)-[:PREREQUISITE {strength: 0.85}]->(b);

MATCH (a:Framework {name: 'Legal Due Diligence Framework'})
MATCH (b:Framework {name: 'PWS Triple Validation Compass'})
MERGE (a)-[:PREREQUISITE {strength: 0.8}]->(b);

// Scenario Planning needs domain knowledge
MATCH (a:Framework {name: 'Scenario Planning'})
MATCH (b:Framework {name: 'Domain Selection'})
MERGE (a)-[:PREREQUISITE {strength: 0.7}]->(b);

// User Journey Mapping benefits from JTBD
MATCH (a:Framework {name: 'User Journey Mapping'})
MATCH (b:Framework {name: 'Jobs to Be Done (JTBD)'})
MERGE (a)-[:PREREQUISITE {strength: 0.75}]->(b);


// ============================================================
// SECTION 8: FRAMEWORK AGENTS -- Full wiring
// Current: 7/10 completely orphaned
// Target: All 10 wired to Framework + ProblemType + Bot
// ============================================================

// BiasDetectorAgent
MATCH (agent:FrameworkAgent {name: 'BiasDetectorAgent'})
MATCH (f:Framework {name: 'Beautiful Questions Bias Detection'})
MATCH (pt:ProblemType {name: 'Undefined Problem'})
MATCH (bot:Bot {name: 'Red Team'})
MERGE (agent)-[:DERIVED_FROM]->(f)
MERGE (agent)-[:APPLIES_TO]->(pt)
MERGE (agent)-[:IMPLEMENTED_BY]->(bot);

// CrossDomainInnovationAgent
MATCH (agent:FrameworkAgent {name: 'CrossDomainInnovationAgent'})
MATCH (f:Framework {name: 'Algorithmic Generation of Reverse Salient Solutions'})
MATCH (pt:ProblemType {name: 'Ill-Defined Problem'})
MATCH (bot:Bot {name: 'Larry Playground'})
MERGE (agent)-[:DERIVED_FROM]->(f)
MERGE (agent)-[:APPLIES_TO]->(pt)
MERGE (agent)-[:IMPLEMENTED_BY]->(bot);

// DevilsAdvocateAgent
MATCH (agent:FrameworkAgent {name: 'DevilsAdvocateAgent'})
MATCH (f:Framework) WHERE f.name STARTS WITH 'PWS-Bias Devil'
MATCH (pt:ProblemType {name: 'Well-Defined Problem'})
MATCH (bot:Bot {name: 'Red Team'})
MERGE (agent)-[:DERIVED_FROM]->(f)
MERGE (agent)-[:APPLIES_TO]->(pt)
MERGE (agent)-[:IMPLEMENTED_BY]->(bot);

// DomainExplorerAgent
MATCH (agent:FrameworkAgent {name: 'DomainExplorerAgent'})
MATCH (f:Framework {name: 'Domain Selection'})
MATCH (pt:ProblemType {name: 'Undefined Problem'})
MATCH (bot:Bot {name: 'Larry Playground'})
MERGE (agent)-[:DERIVED_FROM]->(f)
MERGE (agent)-[:APPLIES_TO]->(pt)
MERGE (agent)-[:IMPLEMENTED_BY]->(bot);

// InvestmentAnalysisAgent
MATCH (agent:FrameworkAgent {name: 'InvestmentAnalysisAgent'})
MATCH (f:Framework {name: 'Financial Due Diligence Framework'})
MATCH (pt:ProblemType {name: 'Well-Defined Problem'})
MATCH (bot:Bot {name: 'Lawrence'})
MERGE (agent)-[:DERIVED_FROM]->(f)
MERGE (agent)-[:APPLIES_TO]->(pt)
MERGE (agent)-[:IMPLEMENTED_BY]->(bot);

// KnownUnknownsAgent
MATCH (agent:FrameworkAgent {name: 'KnownUnknownsAgent'})
MATCH (f:Framework {name: 'Knowns and Unknowns Matrix Framework'})
MATCH (pt:ProblemType {name: 'Undefined Problem'})
MATCH (bot:Bot {name: 'Known/Unknown Matrix'})
MERGE (agent)-[:DERIVED_FROM]->(f)
MERGE (agent)-[:APPLIES_TO]->(pt)
MERGE (agent)-[:IMPLEMENTED_BY]->(bot);

// SixHatsAgent -- already has DERIVED_FROM, add ProblemType + Bot
MATCH (agent:FrameworkAgent {name: 'SixHatsAgent'})
MATCH (pt1:ProblemType {name: 'Ill-Defined Problem'})
MATCH (pt2:ProblemType {name: 'Wicked Problem'})
MATCH (bot:Bot {name: 'Larry Playground'})
MERGE (agent)-[:APPLIES_TO]->(pt1)
MERGE (agent)-[:APPLIES_TO]->(pt2)
MERGE (agent)-[:IMPLEMENTED_BY]->(bot);

// Wire agents to their Framework -> Agent chain
MATCH (agent:FrameworkAgent {name: 'JobsToBeDoneAgent'})
MATCH (f:Framework {name: 'Jobs to Be Done (JTBD)'})
MATCH (bot:Bot {name: 'Jobs to Be Done'})
MATCH (pt:ProblemType {name: 'Ill-Defined Problem'})
MERGE (f)-[:HAS_AGENT]->(agent)
MERGE (agent)-[:IMPLEMENTED_BY]->(bot)
MERGE (agent)-[:APPLIES_TO]->(pt);

MATCH (agent:FrameworkAgent {name: 'ReverseSalientAgent'})
MATCH (f:Framework {name: 'Reverse Salient Analysis'})
MERGE (f)-[:HAS_AGENT]->(agent);

MATCH (agent:FrameworkAgent {name: 'SystemThinkingAgent'})
MATCH (f:Framework {name: 'Systems Thinking'})
MATCH (bot:Bot {name: 'Nested Hierarchies'})
MATCH (pt:ProblemType {name: 'Wicked Problem'})
MERGE (f)-[:HAS_AGENT]->(agent)
MERGE (agent)-[:IMPLEMENTED_BY]->(bot)
MERGE (agent)-[:APPLIES_TO]->(pt);

// Wire remaining agents to their parent frameworks
MATCH (agent:FrameworkAgent {name: 'BiasDetectorAgent'})
MATCH (f:Framework {name: 'Beautiful Questions Bias Detection'})
MERGE (f)-[:HAS_AGENT]->(agent);

MATCH (agent:FrameworkAgent {name: 'CrossDomainInnovationAgent'})
MATCH (f:Framework {name: 'Algorithmic Generation of Reverse Salient Solutions'})
MERGE (f)-[:HAS_AGENT]->(agent);

MATCH (agent:FrameworkAgent {name: 'DevilsAdvocateAgent'})
MATCH (f:Framework) WHERE f.name STARTS WITH 'PWS-Bias Devil'
MERGE (f)-[:HAS_AGENT]->(agent);

MATCH (agent:FrameworkAgent {name: 'DomainExplorerAgent'})
MATCH (f:Framework {name: 'Domain Selection'})
MERGE (f)-[:HAS_AGENT]->(agent);

MATCH (agent:FrameworkAgent {name: 'InvestmentAnalysisAgent'})
MATCH (f:Framework {name: 'Financial Due Diligence Framework'})
MERGE (f)-[:HAS_AGENT]->(agent);

MATCH (agent:FrameworkAgent {name: 'KnownUnknownsAgent'})
MATCH (f:Framework {name: 'Knowns and Unknowns Matrix Framework'})
MERGE (f)-[:HAS_AGENT]->(agent);

MATCH (agent:FrameworkAgent {name: 'SixHatsAgent'})
MATCH (f:Framework {name: 'BONO-Innovation Framework'})
MERGE (f)-[:HAS_AGENT]->(agent);


// ============================================================
// SECTION 9: CASE STUDIES -- Wire the 19 orphans
// Current: 10 wired, 19 orphaned
// ============================================================

// Challenger -- THE canonical wicked problem case
MATCH (cs:CaseStudy {name: 'Challenger'})
MATCH (rca:Framework {name: 'Root Cause Analysis'})
MATCH (st:Framework {name: 'Systems Thinking'})
MATCH (wpd:Framework {name: 'Wicked Problem Detection Framework'})
MATCH (pt:ProblemType {name: 'Wicked Problem'})
MERGE (cs)-[:ILLUSTRATES {teaching_core: true}]->(rca)
MERGE (cs)-[:ILLUSTRATES {teaching_core: true}]->(st)
MERGE (cs)-[:ILLUSTRATES {teaching_core: true}]->(wpd)
MERGE (cs)-[:DEMONSTRATES]->(pt);

// NASA -- organizational complexity
MATCH (cs:CaseStudy {name: 'NASA'})
MATCH (st:Framework {name: 'Systems Thinking'})
MATCH (wpd:Framework {name: 'Wicked Problem Detection Framework'})
MATCH (rs:Framework {name: 'Reverse Salient Analysis'})
MATCH (pt:ProblemType {name: 'Wicked Problem'})
MERGE (cs)-[:ILLUSTRATES {teaching_core: true}]->(st)
MERGE (cs)-[:ILLUSTRATES {teaching_core: true}]->(wpd)
MERGE (cs)-[:ILLUSTRATES]->(rs)
MERGE (cs)-[:DEMONSTRATES]->(pt);

// Shell's 1973 -- already wired to Shell Scenario Planning Method (Concept)
// Also wire to the Framework node
MATCH (cs:CaseStudy {name: 'Shell\'s 1973 Oil Crisis Success'})
MATCH (sp:Framework {name: 'Scenario Planning'})
MERGE (cs)-[:ILLUSTRATES {teaching_core: true}]->(sp);

// Netflix -- disruption case
MATCH (cs:CaseStudy {name: 'Netflix'})
MATCH (f1:Framework {name: 'Sustaining vs Disruptive Innovation'})
MATCH (f2:Framework {name: 'Tools vs Platforms Innovation'})
MERGE (cs)-[:ILLUSTRATES]->(f1)
MERGE (cs)-[:ILLUSTRATES]->(f2);

// Starbucks -- user experience / JTBD
MATCH (cs:CaseStudy {name: 'Starbucks'})
MATCH (f:Framework {name: 'Jobs to Be Done (JTBD)'})
MATCH (uj:Framework {name: 'User Journey Mapping'})
MERGE (cs)-[:ILLUSTRATES]->(f)
MERGE (cs)-[:ILLUSTRATES]->(uj);

// GoPro -- platform innovation
MATCH (cs:CaseStudy {name: 'GoPro'})
MATCH (f:Framework {name: 'Tools vs Platforms Innovation'})
MATCH (fl:Framework {name: 'Four Lenses of Innovation'})
MERGE (cs)-[:ILLUSTRATES]->(f)
MERGE (cs)-[:ILLUSTRATES]->(fl);

// Marconi's Wireless -- reverse salient, dominant design
MATCH (cs:CaseStudy {name: 'Marconi\'s Wireless'})
MATCH (rs:Framework {name: 'Reverse Salient Analysis'})
MATCH (sd:Framework {name: 'Sustaining vs Disruptive Innovation'})
MERGE (cs)-[:ILLUSTRATES {teaching_core: true}]->(rs)
MERGE (cs)-[:ILLUSTRATES]->(sd);

// Naval Aviation -- systems evolution, dominant design
MATCH (cs:CaseStudy {name: 'Naval Aviation (1910-1941)'})
MATCH (rs:Framework {name: 'Reverse Salient Analysis'})
MATCH (st:Framework {name: 'Systems Thinking'})
MERGE (cs)-[:ILLUSTRATES {teaching_core: true}]->(rs)
MERGE (cs)-[:ILLUSTRATES]->(st);

// Municipal Water Systems -- systems thinking, causal loops
MATCH (cs:CaseStudy {name: 'Municipal Water Systems'})
MATCH (st:Framework {name: 'Systems Thinking'})
MATCH (cld:Framework {name: 'Causal Loop Diagrams'})
MERGE (cs)-[:ILLUSTRATES]->(st)
MERGE (cs)-[:ILLUSTRATES]->(cld);

// Water Infrastructure Team -- reverse salient
MATCH (cs:CaseStudy {name: 'Water Infrastructure Team'})
MATCH (rs:Framework {name: 'Reverse Salient Analysis'})
MERGE (cs)-[:ILLUSTRATES]->(rs);

// Refugee Permanence -- wicked problem, scenario planning
MATCH (cs:CaseStudy {name: 'Refugee Permanence'})
MATCH (wpd:Framework {name: 'Wicked Problem Detection Framework'})
MATCH (sp:Framework {name: 'Scenario Planning'})
MATCH (pt:ProblemType {name: 'Wicked Problem'})
MERGE (cs)-[:ILLUSTRATES]->(wpd)
MERGE (cs)-[:ILLUSTRATES]->(sp)
MERGE (cs)-[:DEMONSTRATES]->(pt);

// Total Urbanization -- trending to absurd, scenario planning
MATCH (cs:CaseStudy {name: 'Total Urbanization'})
MATCH (tta:Framework {name: 'Trending to the Absurd'})
MATCH (sp:Framework {name: 'Scenario Planning'})
MERGE (cs)-[:ILLUSTRATES]->(tta)
MERGE (cs)-[:ILLUSTRATES]->(sp);

// Extreme Water Limitation -- trending to absurd, wicked
MATCH (cs:CaseStudy {name: 'Extreme Water Limitation'})
MATCH (tta:Framework {name: 'Trending to the Absurd'})
MATCH (pt:ProblemType {name: 'Wicked Problem'})
MERGE (cs)-[:ILLUSTRATES]->(tta)
MERGE (cs)-[:DEMONSTRATES]->(pt);

// Future of Educational Evaluation -- wicked problem
MATCH (cs:CaseStudy {name: 'Future of Educational Evaluation'})
MATCH (wpd:Framework {name: 'Wicked Problem Detection Framework'})
MATCH (pt:ProblemType {name: 'Wicked Problem'})
MERGE (cs)-[:ILLUSTRATES]->(wpd)
MERGE (cs)-[:DEMONSTRATES]->(pt);

// NATO Innovation Hub -- cross-domain innovation
MATCH (cs:CaseStudy {name: 'NATO Innovation Hub example'})
MATCH (f:Framework {name: 'Algorithmic Generation of Reverse Salient Solutions'})
MATCH (fl:Framework {name: 'Four Lenses of Innovation'})
MERGE (cs)-[:ILLUSTRATES]->(f)
MERGE (cs)-[:ILLUSTRATES]->(fl);

// Harbor cleanup robot -- applied project student case
MATCH (cs:CaseStudy {name: 'Harbor cleanup robot'})
MATCH (f:Framework {name: 'PWS Triple Validation Compass'})
MERGE (cs)-[:ILLUSTRATES]->(f);

// Adaptive air mattress -- applied project student case
MATCH (cs:CaseStudy {name: 'Adaptive air mattress'})
MATCH (f:Framework {name: 'Process Mapping for Innovation'})
MATCH (jtbd:Framework {name: 'Jobs to Be Done (JTBD)'})
MERGE (cs)-[:ILLUSTRATES]->(f)
MERGE (cs)-[:ILLUSTRATES]->(jtbd);

// Military medicine DTA -- applied project
MATCH (cs:CaseStudy {name: 'Military medicine DTA project'})
MATCH (f:Framework {name: 'Reverse Salient Analysis'})
MATCH (rca:Framework {name: 'Root Cause Analysis'})
MERGE (cs)-[:ILLUSTRATES]->(f)
MERGE (cs)-[:ILLUSTRATES]->(rca);

// Sustainable Fashion Enthusiast -- JTBD persona
MATCH (cs:CaseStudy {name: 'Sustainable Fashion Enthusiast'})
MATCH (f:Framework {name: 'Jobs to Be Done (JTBD)'})
MERGE (cs)-[:ILLUSTRATES]->(f);

// Yellowtail Wine -- duplicate of Yellow Tail, merge
MATCH (a:CaseStudy {name: 'Yellow Tail case study'})
MATCH (b:CaseStudy {name: 'Yellowtail Wine'})
CALL apoc.refactor.mergeNodes([a, b], {properties: 'combine', mergeRels: true}) YIELD node
SET node.name = 'Yellow Tail Wine'
RETURN node.name;

// Wire Yellow Tail to Blue Ocean / Four Lenses
MATCH (cs:CaseStudy) WHERE cs.name IN ['Yellow Tail Wine', 'Yellow Tail case study']
MATCH (fl:Framework {name: 'Four Lenses of Innovation'})
MERGE (cs)-[:ILLUSTRATES]->(fl);

// Warby Parker duplicate merge
MATCH (cs:CaseStudy {name: 'Warby Parker'})
WITH collect(cs) AS nodes
WHERE size(nodes) > 1
CALL apoc.refactor.mergeNodes(nodes, {properties: 'combine', mergeRels: true}) YIELD node
RETURN node.name;

// CaseStudy-5594 -- unknown, tag for review
MATCH (cs:CaseStudy {name: 'CaseStudy-5594'})
SET cs._needs_review = true;


// ============================================================
// SECTION 10: CORE PRINCIPLES -- GOVERNS wiring
// ============================================================

MATCH (cp:CorePrinciple {name: 'Portfolio Not Projects'})
MATCH (f:Framework {name: 'Domain Selection'})
MATCH (f2:Framework {name: 'Opportunity Recognition as Pattern Recognition'})
MERGE (cp)-[:GOVERNS]->(f)
MERGE (cp)-[:GOVERNS]->(f2);

MATCH (cp:CorePrinciple {name: 'Problem Type Mastery'})
MATCH (u:ProblemType {name: 'Undefined Problem'})
MATCH (i:ProblemType {name: 'Ill-Defined Problem'})
MATCH (w:ProblemType {name: 'Well-Defined Problem'})
MERGE (cp)-[:GOVERNS]->(u)
MERGE (cp)-[:GOVERNS]->(i)
MERGE (cp)-[:GOVERNS]->(w);

MATCH (cp:CorePrinciple {name: 'PWS Triple Validation Compass'})
MATCH (f:Framework {name: 'PWS Triple Validation Compass'})
MERGE (cp)-[:GOVERNS]->(f);

MATCH (cp:CorePrinciple {name: 'Evidence Beats Opinions'})
MATCH (f:Framework {name: 'Root Cause Analysis'})
MATCH (v:ValidationTool {name: 'Mom Test'})
MERGE (cp)-[:GOVERNS]->(f)
MERGE (cp)-[:GOVERNS]->(v);

MATCH (cp:CorePrinciple {name: 'Relentless Feedback Loops'})
MATCH (f:Framework {name: 'Causal Loop Diagrams'})
MATCH (st:Framework {name: 'Systems Thinking'})
MERGE (cp)-[:GOVERNS]->(f)
MERGE (cp)-[:GOVERNS]->(st);

MATCH (cp:CorePrinciple {name: 'Domain-Driven Opportunity Hunting'})
MATCH (f:Framework {name: 'Domain Selection'})
MATCH (fl:Framework {name: 'Four Lenses of Innovation'})
MERGE (cp)-[:GOVERNS]->(f)
MERGE (cp)-[:GOVERNS]->(fl);

MATCH (cp:CorePrinciple {name: 'Dominant Design Awareness'})
MATCH (f:Framework {name: 'Sustaining vs Disruptive Innovation'})
MATCH (f2:Framework {name: 'Trending to the Absurd'})
MERGE (cp)-[:GOVERNS]->(f)
MERGE (cp)-[:GOVERNS]->(f2);

MATCH (cp:CorePrinciple {name: 'Uncertainty Is Your Home'})
MATCH (f:Framework {name: 'Cynefin Framework'})
MATCH (f2:Framework {name: 'Knowns and Unknowns Matrix Framework'})
MATCH (f3:Framework {name: 'Scenario Planning'})
MERGE (cp)-[:GOVERNS]->(f)
MERGE (cp)-[:GOVERNS]->(f2)
MERGE (cp)-[:GOVERNS]->(f3);

MATCH (cp:CorePrinciple {name: 'Cross-Pollination by Force'})
MATCH (f:Framework {name: 'Algorithmic Generation of Reverse Salient Solutions'})
MATCH (fl:Framework {name: 'Four Lenses of Innovation'})
MERGE (cp)-[:GOVERNS]->(f)
MERGE (cp)-[:GOVERNS]->(fl);

MATCH (cp:CorePrinciple {name: 'Public Innovation Commons'})
MATCH (f:Framework {name: 'Six Thinking Hats'})
MERGE (cp)-[:GOVERNS]->(f);

// Wire CorePrinciples to Workshops
MATCH (cp:CorePrinciple {name: 'Portfolio Not Projects'})
MATCH (w:Workshop {name: 'Workshop 1: Innovation as Discipline'})
MERGE (cp)-[:EMBODIED_IN]->(w);

MATCH (cp:CorePrinciple {name: 'Problem Type Mastery'})
MATCH (w:Workshop {name: 'Workshop 2: Ill-Defined Problem Investigation'})
MERGE (cp)-[:EMBODIED_IN]->(w);

MATCH (cp:CorePrinciple {name: 'Evidence Beats Opinions'})
MATCH (w:Workshop {name: 'Workshop 4: Sharp Definition - Well-Defined Problem'})
MERGE (cp)-[:EMBODIED_IN]->(w);

MATCH (cp:CorePrinciple {name: 'PWS Triple Validation Compass'})
MATCH (w:Workshop {name: 'Workshop 5: Stakeholders and Feasibility'})
MERGE (cp)-[:EMBODIED_IN]->(w);

MATCH (cp:CorePrinciple {name: 'Relentless Feedback Loops'})
MATCH (w:Workshop {name: 'Workshop 7: Advanced Work and Mentoring'})
MERGE (cp)-[:EMBODIED_IN]->(w);


// ============================================================
// SECTION 11: DELIVERABLE TEMPLATES + SELECTION CRITERIA
// ============================================================

// DeliverableTemplates -> VentureStage + ProblemType
MATCH (dt:DeliverableTemplate {name: 'Problem Bank'})
MATCH (vs:VentureStage {name: 'Pre-Opportunity'})
MATCH (pt:ProblemType {name: 'Undefined Problem'})
MERGE (dt)-[:TYPICAL_AT]->(vs)
MERGE (dt)-[:REPRESENTS]->(pt);

MATCH (dt:DeliverableTemplate {name: 'Opportunity Map'})
MATCH (vs:VentureStage {name: 'Opportunity Identified'})
MATCH (pt:ProblemType {name: 'Ill-Defined Problem'})
MERGE (dt)-[:TYPICAL_AT]->(vs)
MERGE (dt)-[:REPRESENTS]->(pt);

MATCH (dt:DeliverableTemplate {name: 'Candidate Problems Shortlist'})
MATCH (vs:VentureStage {name: 'Opportunity Identified'})
MERGE (dt)-[:TYPICAL_AT]->(vs);

MATCH (dt:DeliverableTemplate {name: 'Well-Defined Problem Statement'})
MATCH (vs:VentureStage {name: 'Well-Defined Problem'})
MATCH (f:Framework {name: 'Problem Definition Transformation Framework'})
MERGE (dt)-[:TYPICAL_AT]->(vs)
MERGE (dt)-[:VALIDATED_BY]->(f);

MATCH (dt:DeliverableTemplate {name: 'Stakeholder Map with Feasibility Analysis'})
MATCH (vs:VentureStage {name: 'Well-Defined Problem'})
MATCH (f:Framework {name: 'PWS Triple Validation Compass'})
MERGE (dt)-[:TYPICAL_AT]->(vs)
MERGE (dt)-[:VALIDATED_BY]->(f);

MATCH (dt:DeliverableTemplate {name: 'Applied Project Skeleton'})
MATCH (vs:VentureStage {name: 'Ready to Build'})
MERGE (dt)-[:TYPICAL_AT]->(vs);

MATCH (dt:DeliverableTemplate {name: 'Refined Project with Barrier Analysis'})
MATCH (vs:VentureStage {name: 'Ready to Build'})
MATCH (f:Framework {name: 'Root Cause Analysis'})
MERGE (dt)-[:TYPICAL_AT]->(vs)
MERGE (dt)-[:VALIDATED_BY]->(f);

MATCH (dt:DeliverableTemplate {name: 'Final Project Presentation'})
MATCH (vs:VentureStage {name: 'Ready to Build'})
MERGE (dt)-[:TYPICAL_AT]->(vs);

// SelectionCriteria -> Framework mapping
MATCH (sc:SelectionCriteria {name: 'Too Small'})
MATCH (f:Framework {name: 'PWS Triple Validation Compass'})
MERGE (sc)-[:FILTERS_VIA]->(f);

MATCH (sc:SelectionCriteria {name: 'Not Ripe'})
MATCH (f:Framework {name: 'Trending to the Absurd'})
MATCH (f2:Framework {name: 'Sustaining vs Disruptive Innovation'})
MERGE (sc)-[:FILTERS_VIA]->(f)
MERGE (sc)-[:FILTERS_VIA]->(f2);

MATCH (sc:SelectionCriteria {name: 'No Clear Stakeholder'})
MATCH (f:Framework {name: 'Jobs to Be Done (JTBD)'})
MERGE (sc)-[:FILTERS_VIA]->(f);

MATCH (sc:SelectionCriteria {name: 'Already Solved'})
MATCH (f:Framework {name: 'Reverse Salient Analysis'})
MERGE (sc)-[:FILTERS_VIA]->(f);

MATCH (sc:SelectionCriteria {name: 'Worth Investment'})
MATCH (f:Framework {name: 'PWS Triple Validation Compass'})
MATCH (v:ValidationTool {name: 'PWS Value Proposition'})
MERGE (sc)-[:VALIDATED_BY]->(f)
MERGE (sc)-[:VALIDATED_BY]->(v);


// ============================================================
// SECTION 12: BOOK LAYER
// 12a. Property normalization (title from name)
// 12b. Deduplication via apoc.refactor.mergeNodes
// 12c. INTRODUCES_FRAMEWORK mislanding fix
// 12d. GROUNDS_FRAMEWORK curriculum mappings
// ============================================================

// 12a. Copy name to title for books missing title
MATCH (b:Book)
WHERE b.title IS NULL AND b.name IS NOT NULL
SET b.title = b.name;

// 12b. Deduplicate books by title (keep richest node)
CALL apoc.periodic.iterate(
  'MATCH (b:Book)
   WHERE b.title IS NOT NULL
   WITH toLower(trim(b.title)) AS norm_title, collect(b) AS nodes
   WHERE size(nodes) > 1
   RETURN nodes',
  'CALL apoc.refactor.mergeNodes(nodes, {properties: "combine", mergeRels: true}) YIELD node RETURN node',
  {batchSize: 5}
);

// Also dedup by name for null-title books that share name with titled books
CALL apoc.periodic.iterate(
  'MATCH (b:Book)
   WITH toLower(trim(b.name)) AS norm_name, collect(b) AS nodes
   WHERE size(nodes) > 1
   RETURN nodes',
  'CALL apoc.refactor.mergeNodes(nodes, {properties: "combine", mergeRels: true}) YIELD node RETURN node',
  {batchSize: 5}
);

// 12c. Fix INTRODUCES_FRAMEWORK mislanding
// 123 edges point to Concept nodes. Redirect to Framework where match exists.
MATCH (b:Book)-[old:INTRODUCES_FRAMEWORK]->(c:Concept)
WHERE NOT 'Framework' IN labels(c)
MATCH (f:Framework)
WHERE toLower(f.name) = toLower(c.name)
MERGE (b)-[:INTRODUCES_FRAMEWORK]->(f)
// Retype old edge as INTRODUCES_CONCEPT (correct label)
MERGE (b)-[:INTRODUCES_CONCEPT]->(c)
DELETE old;

// Fuzzy match: concept name contains framework name or vice versa
MATCH (b:Book)-[old:INTRODUCES_FRAMEWORK]->(c:Concept)
WHERE NOT 'Framework' IN labels(c)
MATCH (f:Framework)
WHERE toLower(c.name) CONTAINS toLower(f.name)
AND size(f.name) > 8
MERGE (b)-[:INTRODUCES_FRAMEWORK]->(f)
MERGE (b)-[:INTRODUCES_CONCEPT]->(c)
DELETE old;

// Remaining: retype as INTRODUCES_CONCEPT (they ARE concepts, not frameworks)
MATCH (b:Book)-[old:INTRODUCES_FRAMEWORK]->(c:Concept)
WHERE NOT 'Framework' IN labels(c)
MERGE (b)-[:INTRODUCES_CONCEPT]->(c)
DELETE old;

// Fix swapped INTRODUCES_CONCEPT -> Framework (4 edges)
MATCH (b:Book)-[old:INTRODUCES_CONCEPT]->(f:Framework)
MERGE (b)-[:INTRODUCES_FRAMEWORK]->(f)
DELETE old;

// 12d. GROUNDS_FRAMEWORK -- intellectual provenance
// Systems Thinking family
MATCH (b:Book) WHERE b.name =~ '(?i).*fifth discipline.*'
MATCH (f:Framework {name: 'Systems Thinking'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.95}]->(f);

MATCH (b:Book) WHERE b.name =~ '(?i).*introduction to systems thinking.*'
MATCH (f:Framework {name: 'Causal Loop Diagrams'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.95}]->(f);

MATCH (b:Book) WHERE b.name =~ '(?i)^thinking in systems.*'
MATCH (f:Framework {name: 'Systems Thinking'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.9}]->(f);

// Scenario Planning
MATCH (b:Book) WHERE b.name =~ '(?i).*scenarios.*uncharted.*'
MATCH (f:Framework {name: 'Scenario Planning'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.95}]->(f);

MATCH (b:Book) WHERE b.name =~ '(?i).*art of the long view.*'
MATCH (f:Framework {name: 'Scenario Planning'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.9}]->(f);

MATCH (b:Book) WHERE b.name =~ '(?i).*thinking in bets.*'
MATCH (f:Framework {name: 'Scenario Planning'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.75}]->(f);

// Six Thinking Hats
MATCH (b:Book) WHERE b.name =~ '(?i)^six thinking hats.*'
MATCH (f:Framework {name: 'Six Thinking Hats'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 1.0}]->(f);

// Innovation / Disruption
MATCH (b:Book) WHERE b.name =~ '(?i).*innovator.s? dilemma.*'
MATCH (f:Framework {name: 'Sustaining vs Disruptive Innovation'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.9}]->(f);

MATCH (b:Book) WHERE b.name =~ '(?i).*crossing the chasm.*'
MATCH (f:Framework {name: 'Sustaining vs Disruptive Innovation'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.85}]->(f);

MATCH (b:Book) WHERE b.name =~ '(?i).*diffusion of innovations.*'
MATCH (f:Framework {name: 'Sustaining vs Disruptive Innovation'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.85}]->(f);

// JTBD / Customer Discovery
MATCH (b:Book) WHERE b.name =~ '(?i).*competing against luck.*'
MATCH (f:Framework {name: 'Jobs to Be Done (JTBD)'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.95}]->(f);

MATCH (b:Book) WHERE b.name =~ '(?i).*jobs to be done.*'
MATCH (f:Framework {name: 'Jobs to Be Done (JTBD)'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 1.0}]->(f);

MATCH (b:Book) WHERE b.name =~ '(?i).*mom test.*'
MATCH (f:Framework {name: 'Jobs to Be Done (JTBD)'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.8}]->(f);

MATCH (b:Book) WHERE b.name =~ '(?i).*talking to humans.*'
MATCH (f:Framework {name: 'User Journey Mapping'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.8}]->(f);

MATCH (b:Book) WHERE b.name =~ '(?i).*hidden in plain sight.*'
MATCH (f:Framework {name: 'Process Mapping for Innovation'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.8}]->(f);

// Lean Startup
MATCH (b:Book) WHERE b.name =~ '(?i).*lean startup.*'
MATCH (f:Framework {name: 'Hypothesis-Driven Problem Solving'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.85}]->(f);

// Four Lenses
MATCH (b:Book) WHERE b.name =~ '(?i).*four lenses.*innovation.*'
MATCH (f:Framework {name: 'Four Lenses of Innovation'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 1.0}]->(f);

// Design Thinking
MATCH (b:Book) WHERE b.name =~ '(?i).*change by design.*'
MATCH (f:Framework {name: 'Design Thinking'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.9}]->(f);

// Minto / MECE
MATCH (b:Book) WHERE b.name =~ '(?i).*(mckinsey mind|mckinsey way).*'
MATCH (f:Framework {name: 'MECE (Mutually Exclusive, Collectively Exhaustive)'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.8}]->(f);

// Red Teaming
MATCH (b:Book) WHERE b.name =~ '(?i).*red team.*'
MATCH (f:Framework) WHERE f.name STARTS WITH 'PWS-Bias Devil'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.85}]->(f);

// Megatrends / TTA
MATCH (b:Book) WHERE b.name =~ '(?i)^megatrends.*'
MATCH (f:Framework {name: 'Trending to the Absurd'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.8}]->(f);

// Reverse Salient (Hughes)
MATCH (b:Book) WHERE b.name =~ '(?i).*(networks of power|technological revolution).*'
MATCH (f:Framework {name: 'Reverse Salient Analysis'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.9}]->(f);

// Dominant Design
MATCH (b:Book) WHERE b.name =~ '(?i).*technological discontinuities.*dominant design.*'
MATCH (f:Framework {name: 'Sustaining vs Disruptive Innovation'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.9}]->(f);

// Sciences of the Artificial (Simon)
MATCH (b:Book) WHERE b.name =~ '(?i).*sciences of the artificial.*'
MATCH (f:Framework {name: 'Systems Thinking'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.85}]->(f);

// Domain Exploration
MATCH (b:Book) WHERE b.name =~ '(?i).*innovation and entrepreneurship.*'
MATCH (f:Framework {name: 'Domain Selection'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.8}]->(f);

// Medici Effect -- cross-pollination
MATCH (b:Book) WHERE b.name =~ '(?i).*medici effect.*'
MATCH (f:Framework {name: 'Algorithmic Generation of Reverse Salient Solutions'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.75}]->(f);

// Surfaces and Essences -- analogy
MATCH (b:Book) WHERE b.name =~ '(?i).*surfaces and essences.*'
MATCH (f:Framework {name: 'Algorithmic Generation of Reverse Salient Solutions'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.8}]->(f);

// Zero to One -- opportunity recognition
MATCH (b:Book) WHERE b.name =~ '(?i)^zero to one.*'
MATCH (f:Framework {name: 'Opportunity Recognition as Pattern Recognition'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.8}]->(f);

// Open Innovation
MATCH (b:Book) WHERE b.name =~ '(?i)^open innovation.*'
MATCH (f:Framework {name: 'Tools vs Platforms Innovation'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.75}]->(f);

// Beautiful Question
MATCH (b:Book) WHERE b.name =~ '(?i).*beautiful question.*'
MATCH (f:Framework {name: 'Beautiful Question Framework'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 1.0}]->(f);

// Cynefin (Snowden)
MATCH (b:Book) WHERE b.name =~ '(?i).*cynefin.*'
MATCH (f:Framework {name: 'Cynefin Framework'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 1.0}]->(f);

// Psychology of Intelligence Analysis
MATCH (b:Book) WHERE b.name =~ '(?i).*psychology of intelligence analysis.*'
MATCH (f:Framework {name: 'Knowns and Unknowns Matrix Framework'})
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.75}]->(f);

// Algorithmic bridging: Book -> InnovationTool -> Framework
MATCH (b:Book)-[:ENHANCES_TOOL]->(t:InnovationTool)<-[:USES_TOOL]-(f:Framework)
WHERE NOT (b)-[:GROUNDS_FRAMEWORK]->(f)
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.55, source: 'tool_bridge'}]->(f);


// ============================================================
// SECTION 13: LAZYGRAPHCONCEPT CLEANUP
// Delete true orphans, promote high-value to Concept
// ============================================================

// Delete orphaned LazyGraphConcepts (no relationships at all)
CALL apoc.periodic.iterate(
  'MATCH (n:LazyGraphConcept) WHERE NOT (n)--() RETURN n',
  'DELETE n',
  {batchSize: 500}
);

// Promote LazyGraphConcepts that CO_OCCUR with 3+ Frameworks
CALL apoc.periodic.iterate(
  'MATCH (n:LazyGraphConcept)-[:CO_OCCURS]-(f:Framework)
   WITH n, count(DISTINCT f) AS fw_count
   WHERE fw_count >= 3
   RETURN n',
  'SET n:Concept SET n.promoted_from = "LazyGraphConcept" REMOVE n:LazyGraphConcept',
  {batchSize: 100}
);

// DictionaryTerm -> Framework bridging via Book path
MATCH (dt:DictionaryTerm)<-[:INTRODUCES_TERM]-(b:Book)-[:GROUNDS_FRAMEWORK]->(f:Framework)
WHERE NOT (dt)-[:USED_IN]->(f)
MERGE (dt)-[:USED_IN {source: 'book_bridge'}]->(f);


// ============================================================
// SECTION 14: MISSING INDEXES
// ============================================================

CREATE INDEX venture_stage_name IF NOT EXISTS FOR (n:VentureStage) ON (n.name);
CREATE INDEX framework_agent_name IF NOT EXISTS FOR (n:FrameworkAgent) ON (n.name);
CREATE INDEX deliverable_template_name IF NOT EXISTS FOR (n:DeliverableTemplate) ON (n.name);
CREATE INDEX context_flow_type_name IF NOT EXISTS FOR (n:ContextFlowType) ON (n.name);
CREATE INDEX case_study_name IF NOT EXISTS FOR (n:CaseStudy) ON (n.name);
CREATE INDEX core_principle_name IF NOT EXISTS FOR (n:CorePrinciple) ON (n.name);
CREATE INDEX selection_criteria_name IF NOT EXISTS FOR (n:SelectionCriteria) ON (n.name);
CREATE INDEX workshop_name IF NOT EXISTS FOR (n:Workshop) ON (n.name);
CREATE INDEX bot_name IF NOT EXISTS FOR (n:Bot) ON (n.name);
CREATE INDEX validation_tool_name IF NOT EXISTS FOR (n:ValidationTool) ON (n.name);


// ============================================================
// VERIFICATION BLOCK -- Run after full normalization
// ============================================================

// V1. Edge counts (compare against pre-run state)
// MATCH ()-[r:FEEDS_INTO]->(:Framework) RETURN 'FEEDS_INTO' AS type, count(r) AS count
// UNION ALL MATCH ()-[r:TYPICAL_AT]->() RETURN 'TYPICAL_AT', count(r)
// UNION ALL MATCH ()-[r:ADDRESSES_PROBLEM_TYPE]->() RETURN 'ADDRESSES_PROBLEM_TYPE', count(r)
// UNION ALL MATCH ()-[r:PREREQUISITE]->() RETURN 'PREREQUISITE', count(r)
// UNION ALL MATCH ()-[r:GOVERNS]->() RETURN 'GOVERNS', count(r)
// UNION ALL MATCH ()-[r:GROUNDS_FRAMEWORK]->() RETURN 'GROUNDS_FRAMEWORK', count(r)
// UNION ALL MATCH ()-[r:ILLUSTRATES]->() RETURN 'ILLUSTRATES', count(r)
// UNION ALL MATCH ()-[r:HAS_AGENT]->() RETURN 'HAS_AGENT', count(r)
// UNION ALL MATCH ()-[r:DERIVED_FROM]->() RETURN 'DERIVED_FROM', count(r)
// UNION ALL MATCH ()-[r:SUBTYPE_OF]->() RETURN 'SUBTYPE_OF', count(r);

// V2. FrameworkAgent orphans (target: 0)
// MATCH (fa:FrameworkAgent)
// WHERE NOT (fa)-[:DERIVED_FROM]->()
// RETURN fa.name AS orphan_agent;

// V3. CaseStudy orphans (target: <3)
// MATCH (cs:CaseStudy)
// WHERE NOT (cs)-[:ILLUSTRATES|DEMONSTRATES|APPLIED_FRAMEWORK]->()
// RETURN cs.name AS orphan_case;

// V4. CorePrinciple coverage (target: all have 2+ rels)
// MATCH (cp:CorePrinciple)
// WITH cp, size([(cp)--() | 1]) AS rels
// WHERE rels < 2
// RETURN cp.name, rels;

// V5. Book deduplication (target: 0 dupe titles)
// MATCH (b:Book)
// WITH b.title AS title, count(b) AS cnt
// WHERE cnt > 1 AND title IS NOT NULL
// RETURN title, cnt;

// V6. INTRODUCES_FRAMEWORK lands on Framework only
// MATCH (b:Book)-[:INTRODUCES_FRAMEWORK]->(target)
// WHERE NOT 'Framework' IN labels(target)
// RETURN target.name, labels(target);

// V7. Full provenance chain count
// MATCH (b:Book)-[:GROUNDS_FRAMEWORK]->(f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
// RETURN count(DISTINCT f) AS frameworks_with_full_provenance;

// V8. Stage coverage (each stage should have 5+ frameworks)
// MATCH (f)-[:TYPICAL_AT]->(s:VentureStage)
// RETURN s.name, s.order, count(f) AS framework_count
// ORDER BY s.order;

// V9. Label cleanup
// MATCH (n:concept) RETURN count(n) AS lowercase_concept;
// MATCH (n:base) RETURN count(n) AS base_label;
// MATCH (n:UNKNOWN) RETURN count(n) AS unknown_label;

// V10. PREREQUISITE chain (should enable gap detection)
// MATCH (a:Framework)-[:PREREQUISITE]->(b:Framework)
// RETURN a.name AS requires, b.name AS prerequisite
// ORDER BY b.name;
