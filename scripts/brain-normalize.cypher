// ============================================================
// BRAIN NORMALIZATION FOR MINDRIANOS
// Run sections sequentially. Each section is idempotent.
// Target: Align Neo4j graph to MindrianOS schema.md contract
//
// Current: 32,612 nodes, 170,791 rels, 828 labels, 1,633 rel types
// Target:  ~15 canonical labels, ~30 canonical rel types,
//          rich FEEDS_INTO/TYPICAL_AT/ADDRESSES_PROBLEM_TYPE edges
// ============================================================


// ============================================================
// SECTION 1: LABEL NORMALIZATION -- Merge duplicates
// Problem: concept vs Concept, person vs Person, etc.
// Strategy: Copy lowercase nodes to PascalCase, merge properties
// ============================================================

// 1a. concept (314) -> Concept (1600)
MATCH (n:concept)
WHERE NOT n:Concept
SET n:Concept
REMOVE n:concept;

// 1b. content (66) -> Content (4)
MATCH (n:content)
WHERE NOT n:Content
SET n:Content
REMOVE n:content;

// 1c. person (59) -> Person (381)
MATCH (n:person)
WHERE NOT n:Person
SET n:Person
REMOVE n:person;

// 1d. organization (30) -> Organization (139)
MATCH (n:organization)
WHERE NOT n:Organization
SET n:Organization
REMOVE n:organization;

// 1e. location (5) -> Location (46)
MATCH (n:location)
WHERE NOT n:Location
SET n:Location
REMOVE n:location;

// 1f. method (57) -> Method (16) -- keep Method as canonical
MATCH (n:method)
WHERE NOT n:Method
SET n:Method
REMOVE n:method;

// 1g. event (2) -> Event (1012)
MATCH (n:event)
WHERE NOT n:Event
SET n:Event
REMOVE n:event;

// 1h. group (1) -> Group (29)
MATCH (n:group)
WHERE NOT n:Group
SET n:Group
REMOVE n:group;

// 1i. DOMAIN (4) -> Domain (143)
MATCH (n:DOMAIN)
WHERE NOT n:Domain
SET n:Domain
REMOVE n:DOMAIN;

// 1j. OPPORTUNITY (20) -> Opportunity (42)
MATCH (n:OPPORTUNITY)
WHERE NOT n:Opportunity
SET n:Opportunity
REMOVE n:OPPORTUNITY;

// 1k. SOURCE (17) -> Source (5)
MATCH (n:SOURCE)
WHERE NOT n:Source
SET n:Source
REMOVE n:SOURCE;

// 1l. Unknown (1) -> UNKNOWN (61) -- merge into UNKNOWN then reclassify later
MATCH (n:Unknown)
WHERE NOT n:UNKNOWN
SET n:UNKNOWN
REMOVE n:Unknown;


// ============================================================
// SECTION 2: VENTURE STAGE NODES
// Problem: Only 4 TYPICAL_AT edges. No VentureStage nodes.
// MindrianOS needs stage-based routing (query 10c).
// ============================================================

// 2a. Create canonical VentureStage nodes
MERGE (s:VentureStage {name: 'Pre-Opportunity'})
SET s.order = 1, s.description = 'Exploring domains, no clear problem yet';

MERGE (s:VentureStage {name: 'Discovery'})
SET s.order = 2, s.description = 'Problem identified, exploring scope and stakeholders';

MERGE (s:VentureStage {name: 'Validation'})
SET s.order = 3, s.description = 'Testing assumptions against market reality';

MERGE (s:VentureStage {name: 'Design'})
SET s.order = 4, s.description = 'Solution architecture and business model';

MERGE (s:VentureStage {name: 'Investment'})
SET s.order = 5, s.description = 'Investment-ready with complete thesis';


// ============================================================
// SECTION 3: PROBLEM TYPE CANONICALIZATION
// Problem: 18 ProblemType nodes. MindrianOS expects 4 canonical.
// Strategy: Keep all 18, add canonical flag to the big 4.
// ============================================================

// 3a. Flag the 4 canonical problem types
MATCH (pt:ProblemType)
WHERE pt.name IN ['Un-Defined', 'Ill-Defined', 'Well-Defined', 'Wicked']
SET pt.canonical = true;

// 3b. Link non-canonical to nearest canonical parent
MATCH (pt:ProblemType)
WHERE pt.canonical IS NULL OR pt.canonical = false
SET pt.canonical = false;

// 3c. Create SUBTYPE_OF edges for non-canonical -> canonical
// (Run after reviewing which subtypes map where)
// Example pattern -- adapt based on actual node names:
MATCH (sub:ProblemType)
WHERE sub.name CONTAINS 'ill-defined' OR sub.name CONTAINS 'Ill'
AND sub.canonical = false
MATCH (parent:ProblemType {name: 'Ill-Defined', canonical: true})
MERGE (sub)-[:SUBTYPE_OF]->(parent);

MATCH (sub:ProblemType)
WHERE sub.name CONTAINS 'well-defined' OR sub.name CONTAINS 'Well'
AND sub.canonical = false
MATCH (parent:ProblemType {name: 'Well-Defined', canonical: true})
MERGE (sub)-[:SUBTYPE_OF]->(parent);

MATCH (sub:ProblemType)
WHERE sub.name CONTAINS 'wicked' OR sub.name CONTAINS 'Wicked'
AND sub.canonical = false
MATCH (parent:ProblemType {name: 'Wicked', canonical: true})
MERGE (sub)-[:SUBTYPE_OF]->(parent);

MATCH (sub:ProblemType)
WHERE sub.name CONTAINS 'un-defined' OR sub.name CONTAINS 'undefined'
AND sub.canonical = false
MATCH (parent:ProblemType {name: 'Un-Defined', canonical: true})
MERGE (sub)-[:SUBTYPE_OF]->(parent);


// ============================================================
// SECTION 4: FEEDS_INTO ENRICHMENT
// Problem: Only 17 edges for 86 frameworks. Larry can't chain.
// Source: Lawrence's teaching sequences + methodology literature
// ============================================================

// 4a. Problem Discovery chain
MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Beautiful Question' AND b.name = 'Jobs-to-Be-Done'
MERGE (a)-[:FEEDS_INTO {confidence: 0.9, transform_description: 'Questions identify struggling moments to investigate'}]->(b);

MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Jobs-to-Be-Done' AND b.name = 'Blue Ocean Strategy'
MERGE (a)-[:FEEDS_INTO {confidence: 0.85, transform_description: 'Customer jobs reveal uncontested market space'}]->(b);

MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Jobs-to-Be-Done' AND b.name = 'Lean Canvas'
MERGE (a)-[:FEEDS_INTO {confidence: 0.9, transform_description: 'Customer jobs become problem/solution fit on canvas'}]->(b);

// 4b. Domain Exploration chain
MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Domain Exploration' AND b.name = 'Reverse Salient'
MERGE (a)-[:FEEDS_INTO {confidence: 0.85, transform_description: 'Domain map reveals lagging components'}]->(b);

MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Reverse Salient' AND b.name = 'S-Curve Analysis'
MERGE (a)-[:FEEDS_INTO {confidence: 0.8, transform_description: 'Bottleneck timing depends on technology maturity'}]->(b);

MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Domain Exploration' AND b.name = 'Trending to the Absurd'
MERGE (a)-[:FEEDS_INTO {confidence: 0.8, transform_description: 'Domain boundaries pushed to extremes reveal hidden problems'}]->(b);

// 4c. Validation chain
MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Lean Canvas' AND b.name = 'Six Thinking Hats'
MERGE (a)-[:FEEDS_INTO {confidence: 0.75, transform_description: 'Canvas assumptions need multi-perspective stress testing'}]->(b);

MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Six Thinking Hats' AND b.name = 'Devils Advocate'
MERGE (a)-[:FEEDS_INTO {confidence: 0.8, transform_description: 'Hat perspectives identify claims to challenge'}]->(b);

MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Devils Advocate' AND b.name = 'Root Cause Analysis'
MERGE (a)-[:FEEDS_INTO {confidence: 0.75, transform_description: 'Challenged assumptions reveal root problems'}]->(b);

// 4d. Analysis chain
MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Competitive Analysis' AND b.name = 'Blue Ocean Strategy'
MERGE (a)-[:FEEDS_INTO {confidence: 0.9, transform_description: 'Competitor mapping reveals where to compete differently'}]->(b);

MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Blue Ocean Strategy' AND b.name = 'Dominant Design Analysis'
MERGE (a)-[:FEEDS_INTO {confidence: 0.8, transform_description: 'Blue ocean positioning depends on where standards are shifting'}]->(b);

// 4e. Structuring chain
MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Minto Pyramid' AND b.name = 'Scenario Planning'
MERGE (a)-[:FEEDS_INTO {confidence: 0.7, transform_description: 'Structured argument reveals assumptions to scenario-test'}]->(b);

MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Scenario Planning' AND b.name = 'Systems Thinking'
MERGE (a)-[:FEEDS_INTO {confidence: 0.8, transform_description: 'Scenarios reveal feedback loops in the system'}]->(b);

// 4f. Investment readiness chain
MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Systems Thinking' AND b.name = 'Investment Thesis'
MERGE (a)-[:FEEDS_INTO {confidence: 0.75, transform_description: 'System understanding grounds the investment narrative'}]->(b);

MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Lean Canvas' AND b.name = 'Investment Thesis'
MERGE (a)-[:FEEDS_INTO {confidence: 0.85, transform_description: 'Business model feeds directly into thesis construction'}]->(b);

// 4g. Cross-domain discovery
MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Design-by-Analogy' AND b.name = 'Reverse Salient'
MERGE (a)-[:FEEDS_INTO {confidence: 0.7, transform_description: 'Analogies from other domains reveal bottleneck solutions'}]->(b);

MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Known-Unknown Matrix' AND b.name = 'Root Cause Analysis'
MERGE (a)-[:FEEDS_INTO {confidence: 0.8, transform_description: 'Unknown unknowns need root cause investigation'}]->(b);

MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Known-Unknown Matrix' AND b.name = 'Beautiful Question'
MERGE (a)-[:FEEDS_INTO {confidence: 0.85, transform_description: 'Mapping unknowns generates the right questions to ask'}]->(b);

// 4h. Causal reasoning chain
MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Root Cause Analysis' AND b.name = 'Systems Thinking'
MERGE (a)-[:FEEDS_INTO {confidence: 0.85, transform_description: 'Root causes often live in system feedback loops'}]->(b);

MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Systems Thinking' AND b.name = 'Scenario Planning'
MERGE (a)-[:FEEDS_INTO {confidence: 0.8, transform_description: 'System dynamics drive multiple plausible futures'}]->(b);

// 4i. Observation to needs
MATCH (a:Framework), (b:Framework)
WHERE a.name = 'User Needs Mapping' AND b.name = 'Jobs-to-Be-Done'
MERGE (a)-[:FEEDS_INTO {confidence: 0.9, transform_description: 'Observed user processes reveal struggling moments'}]->(b);

MATCH (a:Framework), (b:Framework)
WHERE a.name = 'Trending to the Absurd' AND b.name = 'Scenario Planning'
MERGE (a)-[:FEEDS_INTO {confidence: 0.75, transform_description: 'Extreme trends become scenario inputs'}]->(b);

// 4j. DIKW chain
MATCH (a:Framework), (b:Framework)
WHERE a.name = 'DIKW Pyramid' AND b.name = 'Minto Pyramid'
MERGE (a)-[:FEEDS_INTO {confidence: 0.8, transform_description: 'Knowledge hierarchy structures the argument pyramid'}]->(b);


// ============================================================
// SECTION 5: TYPICAL_AT ENRICHMENT
// Problem: Only 4 edges. Larry can't recommend by stage.
// Maps frameworks to the venture stages where they're most useful.
// ============================================================

// Pre-Opportunity: exploration and questioning
MATCH (f:Framework), (s:VentureStage {name: 'Pre-Opportunity'})
WHERE f.name IN [
  'Beautiful Question',
  'Domain Exploration',
  'Trending to the Absurd',
  'Known-Unknown Matrix',
  'DIKW Pyramid'
]
MERGE (f)-[:TYPICAL_AT {importance: 0.9}]->(s);

// Discovery: problem definition and stakeholder mapping
MATCH (f:Framework), (s:VentureStage {name: 'Discovery'})
WHERE f.name IN [
  'Jobs-to-Be-Done',
  'User Needs Mapping',
  'Reverse Salient',
  'S-Curve Analysis',
  'Root Cause Analysis',
  'Six Thinking Hats',
  'Design-by-Analogy'
]
MERGE (f)-[:TYPICAL_AT {importance: 0.9}]->(s);

// Validation: testing and challenging
MATCH (f:Framework), (s:VentureStage {name: 'Validation'})
WHERE f.name IN [
  'Devils Advocate',
  'Competitive Analysis',
  'Blue Ocean Strategy',
  'Lean Canvas',
  'Scenario Planning',
  'Six Thinking Hats'
]
MERGE (f)-[:TYPICAL_AT {importance: 0.9}]->(s);

// Design: structuring and modeling
MATCH (f:Framework), (s:VentureStage {name: 'Design'})
WHERE f.name IN [
  'Minto Pyramid',
  'Systems Thinking',
  'Dominant Design Analysis',
  'Lean Canvas',
  'Scenario Planning'
]
MERGE (f)-[:TYPICAL_AT {importance: 0.9}]->(s);

// Investment: thesis and presentation
MATCH (f:Framework), (s:VentureStage {name: 'Investment'})
WHERE f.name IN [
  'Investment Thesis',
  'Minto Pyramid',
  'Systems Thinking',
  'Competitive Analysis'
]
MERGE (f)-[:TYPICAL_AT {importance: 0.9}]->(s);


// ============================================================
// SECTION 6: ADDRESSES_PROBLEM_TYPE ENRICHMENT
// Problem: 38 edges exist but many frameworks lack mappings.
// Each framework should address 1-3 problem types with
// effectiveness scores.
// ============================================================

// Exploration frameworks -> Un-Defined
MATCH (f:Framework), (pt:ProblemType {name: 'Un-Defined'})
WHERE f.name IN [
  'Beautiful Question',
  'Domain Exploration',
  'Trending to the Absurd',
  'Known-Unknown Matrix',
  'DIKW Pyramid',
  'Design-by-Analogy'
]
MERGE (f)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.85}]->(pt);

// Analysis frameworks -> Ill-Defined
MATCH (f:Framework), (pt:ProblemType {name: 'Ill-Defined'})
WHERE f.name IN [
  'Jobs-to-Be-Done',
  'Reverse Salient',
  'S-Curve Analysis',
  'User Needs Mapping',
  'Root Cause Analysis',
  'Competitive Analysis',
  'Blue Ocean Strategy',
  'Lean Canvas'
]
MERGE (f)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.85}]->(pt);

// Structuring frameworks -> Well-Defined
MATCH (f:Framework), (pt:ProblemType {name: 'Well-Defined'})
WHERE f.name IN [
  'Minto Pyramid',
  'Investment Thesis',
  'Dominant Design Analysis',
  'Lean Canvas',
  'Systems Thinking'
]
MERGE (f)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.85}]->(pt);

// Multi-perspective frameworks -> Wicked
MATCH (f:Framework), (pt:ProblemType {name: 'Wicked'})
WHERE f.name IN [
  'Six Thinking Hats',
  'Devils Advocate',
  'Scenario Planning',
  'Systems Thinking',
  'Known-Unknown Matrix',
  'Root Cause Analysis'
]
MERGE (f)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.8}]->(pt);


// ============================================================
// SECTION 7: PREREQUISITE ENRICHMENT
// Which frameworks need other frameworks to have been
// completed first for maximum effectiveness?
// ============================================================

// Can't do Blue Ocean without Competitive Analysis
MATCH (a:Framework {name: 'Blue Ocean Strategy'}), (b:Framework {name: 'Competitive Analysis'})
MERGE (a)-[:PREREQUISITE {strength: 0.9}]->(b);

// Can't do Investment Thesis without Lean Canvas
MATCH (a:Framework {name: 'Investment Thesis'}), (b:Framework {name: 'Lean Canvas'})
MERGE (a)-[:PREREQUISITE {strength: 0.85}]->(b);

// Can't do Scenario Planning without Systems Thinking
MATCH (a:Framework {name: 'Scenario Planning'}), (b:Framework {name: 'Systems Thinking'})
MERGE (a)-[:PREREQUISITE {strength: 0.7}]->(b);

// Can't do Devils Advocate without something TO challenge
MATCH (a:Framework {name: 'Devils Advocate'}), (b:Framework {name: 'Lean Canvas'})
MERGE (a)-[:PREREQUISITE {strength: 0.8}]->(b);

// Minto Pyramid needs content to structure
MATCH (a:Framework {name: 'Minto Pyramid'}), (b:Framework {name: 'Jobs-to-Be-Done'})
MERGE (a)-[:PREREQUISITE {strength: 0.7}]->(b);

// S-Curve needs domain knowledge first
MATCH (a:Framework {name: 'S-Curve Analysis'}), (b:Framework {name: 'Domain Exploration'})
MERGE (a)-[:PREREQUISITE {strength: 0.85}]->(b);

// Reverse Salient needs system understanding
MATCH (a:Framework {name: 'Reverse Salient'}), (b:Framework {name: 'Domain Exploration'})
MERGE (a)-[:PREREQUISITE {strength: 0.8}]->(b);

// Design-by-Analogy needs problem definition
MATCH (a:Framework {name: 'Design-by-Analogy'}), (b:Framework {name: 'Root Cause Analysis'})
MERGE (a)-[:PREREQUISITE {strength: 0.7}]->(b);

// Dominant Design needs competitive landscape
MATCH (a:Framework {name: 'Dominant Design Analysis'}), (b:Framework {name: 'Competitive Analysis'})
MERGE (a)-[:PREREQUISITE {strength: 0.85}]->(b);

// Investment Thesis needs structured argument
MATCH (a:Framework {name: 'Investment Thesis'}), (b:Framework {name: 'Minto Pyramid'})
MERGE (a)-[:PREREQUISITE {strength: 0.75}]->(b);


// ============================================================
// SECTION 8: LABEL CONSOLIDATION -- Absorb tiny labels
// Problem: 541 labels with <5 nodes. Noise.
// Strategy: Tag with :_Legacy, don't delete. MindrianOS queries
// only target canonical labels so legacy becomes invisible.
// ============================================================

// 8a. Tag all nodes that ONLY have non-canonical labels
// Canonical labels MindrianOS queries:
// Framework, Phase, Concept, ProblemType, Book, Tool, Course,
// Example, ProcessStep, Person, Domain, LazyGraphConcept,
// __Entity__, Document, DocumentChunk, Chunk, Entity,
// Event, Organization, VentureStage, Method, Technique,
// Product, DiagnosticElement, StrategicComponent, Question,
// Assumption, Component, Author, Topic, Insight, CreativeWork,
// DictionaryTerm, ReverseSalient, Characteristic, Memory,
// Session, StrategicResponse, User, Content, Location, Group,
// Source, Opportunity, Process, Journey

// NOTE: Run this diagnostic FIRST to see what would be tagged:
// MATCH (n)
// WHERE none(l IN labels(n) WHERE l IN [
//   'Framework','Phase','Concept','ProblemType','Book','Tool',
//   'Course','Example','ProcessStep','Person','Domain',
//   'LazyGraphConcept','__Entity__','Document','DocumentChunk',
//   'Chunk','Entity','Event','Organization','VentureStage',
//   'Method','Technique','Product','DiagnosticElement',
//   'StrategicComponent','Question','Assumption','Component',
//   'Author','Topic','Insight','CreativeWork','DictionaryTerm',
//   'ReverseSalient','Characteristic','Memory','Session',
//   'StrategicResponse','User','Content','Location','Group',
//   'Source','Opportunity','Process','Journey','Problem',
//   'base','content','concept'
// ])
// RETURN labels(n) AS orphan_labels, count(*) AS count
// ORDER BY count DESC
// LIMIT 50


// ============================================================
// SECTION 9: INDEX CREATION
// Ensure MindrianOS hot-path queries hit indexes
// ============================================================

CREATE INDEX framework_name IF NOT EXISTS FOR (n:Framework) ON (n.name);
CREATE INDEX concept_name IF NOT EXISTS FOR (n:Concept) ON (n.name);
CREATE INDEX problemtype_name IF NOT EXISTS FOR (n:ProblemType) ON (n.name);
CREATE INDEX venturestage_name IF NOT EXISTS FOR (n:VentureStage) ON (n.name);
CREATE INDEX phase_name IF NOT EXISTS FOR (n:Phase) ON (n.name);
CREATE INDEX book_title IF NOT EXISTS FOR (n:Book) ON (n.title);
CREATE INDEX tool_name IF NOT EXISTS FOR (n:Tool) ON (n.name);
CREATE INDEX example_name IF NOT EXISTS FOR (n:Example) ON (n.name);
CREATE INDEX processstep_name IF NOT EXISTS FOR (n:ProcessStep) ON (n.name);
CREATE INDEX person_name IF NOT EXISTS FOR (n:Person) ON (n.name);
CREATE INDEX domain_name IF NOT EXISTS FOR (n:Domain) ON (n.name);


// ============================================================
// SECTION 10: VERIFICATION QUERIES
// Run these after normalization to confirm the graph is healthy
// ============================================================

// 10a. FEEDS_INTO density check (target: 40+ edges)
// MATCH (:Framework)-[r:FEEDS_INTO]->(:Framework)
// RETURN count(r) AS feeds_into_count;

// 10b. TYPICAL_AT coverage check (target: all 5 stages populated)
// MATCH (f:Framework)-[:TYPICAL_AT]->(s:VentureStage)
// RETURN s.name AS stage, count(f) AS frameworks
// ORDER BY s.order;

// 10c. ADDRESSES_PROBLEM_TYPE coverage (target: 60+ edges)
// MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
// RETURN pt.name AS problem_type, count(f) AS frameworks;

// 10d. PREREQUISITE chain check (target: 15+ edges)
// MATCH (:Framework)-[r:PREREQUISITE]->(:Framework)
// RETURN count(r) AS prerequisite_count;

// 10e. Orphan frameworks (no FEEDS_INTO, no TYPICAL_AT)
// MATCH (f:Framework)
// WHERE NOT (f)-[:FEEDS_INTO]->() AND NOT (f)-[:TYPICAL_AT]->()
// RETURN f.name AS orphan_framework
// ORDER BY f.name;

// 10f. Label duplication resolved?
// MATCH (n)
// WITH labels(n) AS labs
// UNWIND labs AS label
// RETURN label, count(*) AS count
// ORDER BY count DESC
// LIMIT 30;

// 10g. VentureStage nodes exist?
// MATCH (s:VentureStage)
// RETURN s.name, s.order;
