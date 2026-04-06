// ============================================================
// BRAIN NORMALIZATION -- SUPPLEMENT
// Run AFTER brain-normalize-final.cypher
//
// Addresses:
//   A. Mullins Model Validation (Technique -> proper wiring)
//   B. Opportunity Bank consolidation (21 nodes -> 1 canonical)
//   C. Example node audit (grading calibration gap)
//   D. Cross-graph Example/CaseStudy -> Framework wiring
// ============================================================


// ============================================================
// SECTION A: MULLINS MODEL VALIDATION
// Currently: Technique node with 2 rels
// PWS role: THE gateway validation before "Ready to Build"
// More critical than Lean Canvas in the PWS methodology
// ============================================================

// A1. Promote to ValidationTool (keep Technique label for backward compat)
MATCH (m:Technique {name: 'Mullins Model Validation'})
SET m:ValidationTool
SET m.pws_critical = true
SET m.description = 'John Mullins 7-domain validation model. The gateway between Well-Defined Problem and Ready to Build in PWS methodology.'
SET m.pws_stage = 'Well-Defined Problem';

// A2. Wire to PWS pipeline
MATCH (m:Technique {name: 'Mullins Model Validation'})
MATCH (ptvc:Framework {name: 'PWS Triple Validation Compass'})
MERGE (ptvc)-[:FEEDS_INTO {confidence: 0.95, chain: 'pws_core'}]->(m);

MATCH (m:Technique {name: 'Mullins Model Validation'})
MATCH (fdd:Framework {name: 'Financial Due Diligence Framework'})
MERGE (m)-[:FEEDS_INTO {confidence: 0.85, chain: 'pws_core'}]->(fdd);

MATCH (m:Technique {name: 'Mullins Model Validation'})
MATCH (ipdd:Framework {name: 'IP Due Diligence Framework'})
MERGE (m)-[:FEEDS_INTO {confidence: 0.85, chain: 'pws_core'}]->(ipdd);

// A3. Wire to VentureStage
MATCH (m:Technique {name: 'Mullins Model Validation'})
MATCH (s:VentureStage {name: 'Well-Defined Problem'})
MERGE (m)-[:TYPICAL_AT {importance: 0.95}]->(s);

// A4. Wire to ProblemType
MATCH (m:Technique {name: 'Mullins Model Validation'})
MATCH (pt:ProblemType {name: 'Well-Defined Problem'})
MERGE (m)-[:ADDRESSES_PROBLEM_TYPE {effectiveness: 0.9}]->(pt);

// A5. Wire to DeliverableTemplate
MATCH (m:Technique {name: 'Mullins Model Validation'})
MATCH (dt:DeliverableTemplate {name: 'Stakeholder Map with Feasibility Analysis'})
MERGE (dt)-[:VALIDATED_BY]->(m);

// A6. Wire to CorePrinciple
MATCH (m:Technique {name: 'Mullins Model Validation'})
MATCH (cp:CorePrinciple {name: 'Evidence Beats Opinions'})
MERGE (cp)-[:GOVERNS]->(m);

// A7. Wire to SelectionCriteria
MATCH (m:Technique {name: 'Mullins Model Validation'})
MATCH (sc:SelectionCriteria {name: 'Worth Investment'})
MERGE (sc)-[:VALIDATED_BY]->(m);

// A8. Wire to Workshop
MATCH (m:Technique {name: 'Mullins Model Validation'})
MATCH (w:Workshop {name: 'Workshop 5: Stakeholders and Feasibility'})
MERGE (w)-[:TEACHES]->(m);

// A9. Wire to FrameworkAgent (InvestmentAnalysisAgent should use it)
MATCH (m:Technique {name: 'Mullins Model Validation'})
MATCH (agent:FrameworkAgent {name: 'InvestmentAnalysisAgent'})
MERGE (agent)-[:DERIVED_FROM]->(m);

// A10. Wire PREREQUISITE -- Mullins needs validated problem
MATCH (m:Technique {name: 'Mullins Model Validation'})
MATCH (pdf:Framework {name: 'Problem Definition Transformation Framework'})
MERGE (m)-[:PREREQUISITE {strength: 0.9}]->(pdf);

// A11. Wire to books
MATCH (m:Technique {name: 'Mullins Model Validation'})
MATCH (b:Book) WHERE b.name =~ '(?i).*new business road test.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 1.0}]->(m);

MATCH (m:Technique {name: 'Mullins Model Validation'})
MATCH (b:Book) WHERE b.name =~ '(?i).*customer.funded business.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.9}]->(m);

// A12. Consolidate Mullins-related fragments
MATCH (c:Concept {name: 'Mullins Model'})
MATCH (m:Technique {name: 'Mullins Model Validation'})
MERGE (c)-[:PART_OF]->(m);

MATCH (c:Concept {name: 'John Mullins Framework'})
MATCH (m:Technique {name: 'Mullins Model Validation'})
MERGE (c)-[:PART_OF]->(m);

// Wire John Mullins Person node
MATCH (p) WHERE p.name =~ '(?i)^john mullins$' AND 'Person' IN labels(p) OR 'Concept' IN labels(p)
MATCH (m:Technique {name: 'Mullins Model Validation'})
MERGE (p)-[:CREATED]->(m);


// ============================================================
// SECTION B: OPPORTUNITY BANK CONSOLIDATION
// 21 nodes -> 1 canonical DictionaryTerm (already wired to PWS Course)
// ============================================================

// B1. Promote the DictionaryTerm as canonical
MATCH (ob:DictionaryTerm {name: 'Opportunity Bank'})
SET ob:CanonicalConcept
SET ob.pws_critical = true
SET ob.description = 'Continuously growing portfolio of problems worth investigating. The volume game -- many candidates narrow to few well-defined problems.'
SET ob.aliases = ['Bank of Opportunities', 'Problem Bank', 'Problem Opportunity Bank'];

// B2. Wire the content from Bank of Opportunities Building Process
MATCH (ob:DictionaryTerm {name: 'Opportunity Bank'})
MATCH (process:Product {name: 'Bank of Opportunities Building Process'})
MERGE (ob)-[:HAS_PROCESS]->(process);

// B3. Wire to PWS pipeline
MATCH (ob:DictionaryTerm {name: 'Opportunity Bank'})
MATCH (ds:Framework {name: 'Domain Selection'})
MERGE (ob)-[:FEEDS_INTO]->(ds);

MATCH (ob:DictionaryTerm {name: 'Opportunity Bank'})
MATCH (dt:DeliverableTemplate {name: 'Problem Bank'})
MERGE (ob)-[:IMPLEMENTS]->(dt);

MATCH (ob:DictionaryTerm {name: 'Opportunity Bank'})
MATCH (dt:DeliverableTemplate {name: 'Candidate Problems Shortlist'})
MERGE (ob)-[:FEEDS_INTO]->(dt);

// B4. Wire to CorePrinciple
MATCH (ob:DictionaryTerm {name: 'Opportunity Bank'})
MATCH (cp:CorePrinciple {name: 'Portfolio Not Projects'})
MERGE (cp)-[:GOVERNS]->(ob);

// B5. Wire to Workshops that produce it
MATCH (ob:DictionaryTerm {name: 'Opportunity Bank'})
MATCH (w1:Workshop {name: 'Workshop 1: Innovation as Discipline'})
MATCH (w2:Workshop {name: 'Workshop 2: Ill-Defined Problem Investigation'})
MERGE (w1)-[:PRODUCES]->(ob)
MERGE (w2)-[:PRODUCES]->(ob);

// B6. Wire to VentureStage
MATCH (ob:DictionaryTerm {name: 'Opportunity Bank'})
MATCH (s:VentureStage {name: 'Pre-Opportunity'})
MERGE (ob)-[:TYPICAL_AT]->(s);

// B7. Connect orphan variants to canonical via ALIAS_OF
// (Don't delete them -- they have relationships that might be useful)
MATCH (ob:DictionaryTerm {name: 'Opportunity Bank'})
MATCH (variant)
WHERE variant.name =~ '(?i).*(opportunity bank|bank of opportunit).*'
AND NOT variant = ob
AND NOT variant:LazyGraphConcept  // handle these separately
MERGE (variant)-[:ALIAS_OF]->(ob);

// B8. Delete LazyGraphConcept noise
MATCH (lgc:LazyGraphConcept)
WHERE lgc.name =~ '(?i).*(opportunity bank|bank of opportunit).*'
DETACH DELETE lgc;

// B9. Wire Problem Bank (Entity) to canonical
MATCH (ob:DictionaryTerm {name: 'Opportunity Bank'})
MATCH (pb:Entity {name: 'Problem Bank'})
MERGE (pb)-[:ALIAS_OF]->(ob);


// ============================================================
// SECTION C: EXAMPLE NODES -- Audit and enrichment
//
// CRITICAL FINDING: schema.md says 100+ graded student projects
// with rubric_scores. Reality: 16 Example nodes, ALL are teaching
// illustrations (Edison lightbulb, Socrates syllogism), NONE have:
//   - grade / grade_numeric
//   - rubric_scores
//   - feedback_patterns
//   - percentile
//   - project_name
//
// The grading calibration layer does not exist in the graph.
// This section wires what IS there to Frameworks and ProblemTypes,
// and flags the gap for future data loading.
// ============================================================

// C1. Wire existing Example nodes to Frameworks where applicable

// Naval aviation examples -> Reverse Salient Analysis
MATCH (e:Example)
WHERE e.name =~ '(?i).*(plane.*ship|naval|submarine|japanese planes).*'
MATCH (f:Framework {name: 'Reverse Salient Analysis'})
MERGE (e)-[:ILLUSTRATES]->(f);

// Edison lightbulb -> Hypothesis-Driven Problem Solving
MATCH (e:Example)
WHERE e.name =~ '(?i).*edison.*filament.*'
MATCH (f:Framework {name: 'Hypothesis-Driven Problem Solving'})
MERGE (e)-[:ILLUSTRATES]->(f);

// Li-ion batteries -> Research-driven innovation
MATCH (e:Example)
WHERE e.name =~ '(?i).*li.ion.*'
MATCH (f:Framework {name: 'Sustaining vs Disruptive Innovation'})
MERGE (e)-[:ILLUSTRATES]->(f);

// MOSFET -> serendipitous discovery
MATCH (e:Example)
WHERE e.name =~ '(?i).*mosfet.*'
MATCH (f:Framework {name: 'Opportunity Recognition as Pattern Recognition'})
MERGE (e)-[:ILLUSTRATES]->(f);

// Environmental trending example -> TTA
MATCH (e:Example)
WHERE e.name =~ '(?i).*trending environmental.*'
MATCH (f:Framework {name: 'Trending to the Absurd'})
MERGE (e)-[:ILLUSTRATES]->(f);

// Socrates syllogism -> Pyramid Principle / MECE
MATCH (e:Example)
WHERE e.name =~ '(?i).*socrates.*mortal.*'
MATCH (f:Framework {name: 'The Pyramid Principle'})
MERGE (e)-[:ILLUSTRATES]->(f);

// Municipal Water Systems -> Systems Thinking
MATCH (e:Example {name: 'Municipal Water Systems'})
MATCH (f:Framework {name: 'Systems Thinking'})
MERGE (e)-[:ILLUSTRATES]->(f);

// Personal Mobility / Prosthetics -> JTBD
MATCH (e:Example)
WHERE e.name IN ['Personal Mobility Example', 'Prosthetics Example']
MATCH (f:Framework {name: 'Jobs to Be Done (JTBD)'})
MERGE (e)-[:ILLUSTRATES]->(f);

// Why? or How? -> Beautiful Question
MATCH (e:Example {name: 'Why? or How?'})
MATCH (f:Framework {name: 'Beautiful Question Framework'})
MERGE (e)-[:ILLUSTRATES]->(f);

// Innovation opportunity examples -> Four Lenses
MATCH (e:Example)
WHERE e.name =~ 'Example-.*' AND e.type = 'innovation_opportunity'
MATCH (f:Framework {name: 'Four Lenses of Innovation'})
MERGE (e)-[:ILLUSTRATES]->(f);

// C2. Create GRADING_CALIBRATION_MISSING marker node
// This makes the gap visible and queryable
MERGE (gap:SystemGap {name: 'Grading Calibration Data Missing'})
SET gap.description = 'schema.md specifies 100+ graded student projects with rubric_scores, grade, grade_numeric, feedback_patterns, percentile. Actual graph has 0 such nodes. Grading agent operates without calibration data.'
SET gap.severity = 'CRITICAL'
SET gap.required_data = ['project_name', 'grade', 'grade_numeric', 'rubric_scores', 'feedback_patterns', 'percentile']
SET gap.expected_count = 100
SET gap.actual_count = 0
SET gap.detected_date = date();


// ============================================================
// SECTION D: CROSS-GRAPH EXAMPLE WIRING
// Wire teaching examples that exist as other node types
// (ProcessStep, CaseStudy, etc.) but should also connect
// to the Framework they illustrate
// ============================================================

// D1. Wire Workshops to the Frameworks they teach
MATCH (w:Workshop {name: 'Workshop 1: Innovation as Discipline'})
MATCH (f:Framework {name: 'Domain Selection'})
MATCH (f2:Framework {name: 'Four Lenses of Innovation'})
MERGE (w)-[:TEACHES]->(f)
MERGE (w)-[:TEACHES]->(f2);

MATCH (w:Workshop {name: 'Workshop 2: Ill-Defined Problem Investigation'})
MATCH (f:Framework {name: 'Jobs to Be Done (JTBD)'})
MATCH (f2:Framework {name: 'Process Mapping for Innovation'})
MATCH (f3:Framework {name: 'User Journey Mapping'})
MERGE (w)-[:TEACHES]->(f)
MERGE (w)-[:TEACHES]->(f2)
MERGE (w)-[:TEACHES]->(f3);

MATCH (w:Workshop {name: 'Workshop 3: From Problems to Opportunities'})
MATCH (f:Framework {name: 'Reverse Salient Analysis'})
MATCH (f2:Framework {name: 'Causal Loop Diagrams'})
MATCH (f3:Framework {name: 'Systems Thinking'})
MERGE (w)-[:TEACHES]->(f)
MERGE (w)-[:TEACHES]->(f2)
MERGE (w)-[:TEACHES]->(f3);

MATCH (w:Workshop {name: 'Workshop 4: Sharp Definition - Well-Defined Problem'})
MATCH (f:Framework {name: 'Root Cause Analysis'})
MATCH (f2:Framework {name: 'Problem Definition Transformation Framework'})
MATCH (f3:Framework {name: 'Well-Defined Problem Framework'})
MERGE (w)-[:TEACHES]->(f)
MERGE (w)-[:TEACHES]->(f2)
MERGE (w)-[:TEACHES]->(f3);

MATCH (w:Workshop {name: 'Workshop 5: Stakeholders and Feasibility'})
MATCH (f:Framework {name: 'PWS Triple Validation Compass'})
MATCH (m:Technique {name: 'Mullins Model Validation'})
MERGE (w)-[:TEACHES]->(f)
MERGE (w)-[:TEACHES]->(m);

MATCH (w:Workshop {name: 'Workshop 6: From Problem to Project'})
MATCH (f:Framework {name: 'Financial Due Diligence Framework'})
MATCH (f2:Framework {name: 'IP Due Diligence Framework'})
MERGE (w)-[:TEACHES]->(f)
MERGE (w)-[:TEACHES]->(f2);

MATCH (w:Workshop {name: 'Workshop 7: Advanced Work and Mentoring'})
MATCH (f:Framework {name: 'Six Thinking Hats'})
MATCH (f2:Framework {name: 'MECE (Mutually Exclusive, Collectively Exhaustive)'})
MATCH (f3:Framework {name: 'The Pyramid Principle'})
MERGE (w)-[:TEACHES]->(f)
MERGE (w)-[:TEACHES]->(f2)
MERGE (w)-[:TEACHES]->(f3);

// D2. Wire Bots to their Framework
MATCH (bot:Bot {name: 'Trending to the Absurd'})
MATCH (f:Framework {name: 'Trending to the Absurd'})
MERGE (bot)-[:IMPLEMENTS]->(f);

MATCH (bot:Bot {name: 'Jobs to Be Done'})
MATCH (f:Framework {name: 'Jobs to Be Done (JTBD)'})
MERGE (bot)-[:IMPLEMENTS]->(f);

MATCH (bot:Bot {name: 'S-Curve Analysis'})
MATCH (f:Framework {name: 'Sustaining vs Disruptive Innovation'})
MERGE (bot)-[:IMPLEMENTS]->(f);

MATCH (bot:Bot {name: 'Scenario Analysis'})
MATCH (f:Framework {name: 'Scenario Planning'})
MERGE (bot)-[:IMPLEMENTS]->(f);

MATCH (bot:Bot {name: 'Beautiful Question'})
MATCH (f:Framework {name: 'Beautiful Question Framework'})
MERGE (bot)-[:IMPLEMENTS]->(f);

MATCH (bot:Bot {name: 'Known/Unknown Matrix'})
MATCH (f:Framework {name: 'Knowns and Unknowns Matrix Framework'})
MERGE (bot)-[:IMPLEMENTS]->(f);

MATCH (bot:Bot {name: 'Red Team'})
MATCH (f:Framework) WHERE f.name STARTS WITH 'PWS-Bias Devil'
MERGE (bot)-[:IMPLEMENTS]->(f);

MATCH (bot:Bot {name: 'Nested Hierarchies'})
MATCH (f:Framework {name: 'Systems Thinking'})
MERGE (bot)-[:IMPLEMENTS]->(f);

MATCH (bot:Bot {name: 'Ackoff DIKW Pyramid'})
MATCH (f:Framework {name: 'The Pyramid Principle'})
MERGE (bot)-[:IMPLEMENTS]->(f);

MATCH (bot:Bot {name: 'PWS Grading'})
MATCH (v:ValidationTool {name: 'PWS Value Proposition'})
MERGE (bot)-[:IMPLEMENTS]->(v);

MATCH (bot:Bot {name: 'Lawrence'})
MATCH (pws:Framework {name: 'PWS Methodology'})
MERGE (bot)-[:IMPLEMENTS]->(pws);

MATCH (bot:Bot {name: 'Larry Playground'})
MATCH (pws:Framework {name: 'PWS Methodology'})
MERGE (bot)-[:IMPLEMENTS]->(pws);

MATCH (bot:Bot {name: 'Leadership Coach'})
MATCH (f:Framework {name: 'Adaptive Leadership'})
MERGE (bot)-[:IMPLEMENTS]->(f);

// D3. Wire ContextFlowType nodes (if they exist)
MATCH (direct:ContextFlowType {name: 'Direct Output'})
MATCH (aggregated:ContextFlowType {name: 'Aggregated Insights'})
MATCH (filtered:ContextFlowType {name: 'Filtered Results'})

WITH direct, aggregated, filtered
MATCH (rsa:FrameworkAgent {name: 'ReverseSalientAgent'})
MATCH (jsa:FrameworkAgent {name: 'JobsToBeDoneAgent'})
MATCH (sta:FrameworkAgent {name: 'SystemThinkingAgent'})
MATCH (sha:FrameworkAgent {name: 'SixHatsAgent'})
MATCH (daa:FrameworkAgent {name: 'DevilsAdvocateAgent'})
MATCH (dea:FrameworkAgent {name: 'DomainExplorerAgent'})
MATCH (bia:FrameworkAgent {name: 'BiasDetectorAgent'})
MATCH (kua:FrameworkAgent {name: 'KnownUnknownsAgent'})
MATCH (cia:FrameworkAgent {name: 'CrossDomainInnovationAgent'})

MERGE (rsa)-[:USES_FLOW]->(direct)
MERGE (jsa)-[:USES_FLOW]->(direct)
MERGE (sta)-[:USES_FLOW]->(direct)
MERGE (sha)-[:USES_FLOW]->(aggregated)
MERGE (daa)-[:USES_FLOW]->(aggregated)
MERGE (bia)-[:USES_FLOW]->(aggregated)
MERGE (dea)-[:USES_FLOW]->(filtered)
MERGE (kua)-[:USES_FLOW]->(filtered)
MERGE (cia)-[:USES_FLOW]->(filtered);

// D4. ChallengeElement deduplication
CALL apoc.periodic.iterate(
  'MATCH (n:ChallengeElement)
   WITH n.name AS name, collect(n) AS nodes
   WHERE size(nodes) > 1
   RETURN nodes',
  'CALL apoc.refactor.mergeNodes(nodes, {properties: "combine", mergeRels: true}) YIELD node RETURN node',
  {batchSize: 10}
);


// ============================================================
// VERIFICATION -- Full post-normalization health check
// ============================================================

// V-ALL. Complete edge census
// MATCH ()-[r]->()
// WHERE type(r) IN [
//   'FEEDS_INTO','TYPICAL_AT','ADDRESSES_PROBLEM_TYPE','PREREQUISITE',
//   'GOVERNS','GROUNDS_FRAMEWORK','ILLUSTRATES','HAS_AGENT',
//   'DERIVED_FROM','SUBTYPE_OF','IMPLEMENTS','TEACHES','VALIDATES',
//   'TYPICAL_AT','VALIDATED_BY','FILTERS_VIA','ALIAS_OF',
//   'USES_FLOW','CLARIFIES_TO','PROGRESSES_TO','EMBODIED_IN',
//   'PRODUCES','HAS_PROCESS','REPRESENTS','OFTEN_PRESENTS_AS'
// ]
// RETURN type(r) AS edge_type, count(r) AS count
// ORDER BY count DESC;

// V-MULLINS. Mullins is fully wired
// MATCH (m:Technique {name: 'Mullins Model Validation'})
// RETURN m.name,
//   [(m)-[r]->(t) | type(r) + ' -> ' + coalesce(t.name, labels(t)[0])] AS outbound,
//   [(s)-[r]->(m) | coalesce(s.name, labels(s)[0]) + ' -' + type(r) + '->'] AS inbound;

// V-OPPBANK. Opportunity Bank consolidated
// MATCH (ob:DictionaryTerm {name: 'Opportunity Bank'})
// RETURN [(ob)-[r]->(t) | type(r) + ' -> ' + t.name] AS connections,
//        size([(v)-[:ALIAS_OF]->(ob) | v]) AS alias_count;

// V-GRADING. Grading gap visible
// MATCH (gap:SystemGap {name: 'Grading Calibration Data Missing'})
// RETURN gap.severity, gap.expected_count, gap.actual_count;

// V-BOTS. All bots wired
// MATCH (b:Bot)
// OPTIONAL MATCH (b)-[:IMPLEMENTS]->(target)
// RETURN b.name, target.name AS implements
// ORDER BY b.name;

// V-WORKSHOPS. All workshops teach frameworks
// MATCH (w:Workshop)
// OPTIONAL MATCH (w)-[:TEACHES]->(f)
// RETURN w.name, collect(f.name) AS teaches
// ORDER BY w.name;
