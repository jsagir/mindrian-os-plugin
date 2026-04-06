// ============================================================
// BRAIN NORMALIZATION -- TARGETED SURGERY
// Based on 4-category orphan analysis
// Run sections sequentially. Each is idempotent.
//
// Category 1: True orphans -- wire stranded nodes
// Category 2: Near-orphans -- add missing outbound edges
// Category 3: LazyGraphConcept noise -- bulk delete
// Category 4: DictionaryTerms -- wire through to frameworks
// ============================================================


// ============================================================
// CATEGORY 1A: CASE STUDIES -- Wire Challenger & NASA
// These are the crown jewels of wicked problem teaching.
// They need: ILLUSTRATES -> Framework, DEMONSTRATES -> ProblemType
// ============================================================

// Challenger -- Root Cause, Systems Thinking, Wicked Problems
MATCH (cs) WHERE cs.name = 'Challenger' AND 'CaseStudy' IN labels(cs)
MATCH (rca:Framework) WHERE rca.name =~ '(?i)root cause.*'
MERGE (cs)-[:ILLUSTRATES {relevance: 1.0, teaching_core: true}]->(rca);

MATCH (cs) WHERE cs.name = 'Challenger' AND 'CaseStudy' IN labels(cs)
MATCH (st:Framework) WHERE st.name =~ '(?i)systems think.*'
MERGE (cs)-[:ILLUSTRATES {relevance: 0.95, teaching_core: true}]->(st);

MATCH (cs) WHERE cs.name = 'Challenger' AND 'CaseStudy' IN labels(cs)
MATCH (pt:ProblemType) WHERE pt.name = 'Wicked'
MERGE (cs)-[:DEMONSTRATES {clarity: 'canonical_example'}]->(pt);

// NASA -- same treatment
MATCH (cs) WHERE cs.name = 'NASA' AND 'CaseStudy' IN labels(cs)
MATCH (rca:Framework) WHERE rca.name =~ '(?i)root cause.*'
MERGE (cs)-[:ILLUSTRATES {relevance: 1.0, teaching_core: true}]->(rca);

MATCH (cs) WHERE cs.name = 'NASA' AND 'CaseStudy' IN labels(cs)
MATCH (st:Framework) WHERE st.name =~ '(?i)systems think.*'
MERGE (cs)-[:ILLUSTRATES {relevance: 0.9, teaching_core: true}]->(st);

MATCH (cs) WHERE cs.name = 'NASA' AND 'CaseStudy' IN labels(cs)
MATCH (rs:Framework) WHERE rs.name =~ '(?i)reverse salient.*'
MERGE (cs)-[:ILLUSTRATES {relevance: 0.85, teaching_core: true}]->(rs);

// Wire ALL CaseStudy nodes to at least one ProblemType
// Diagnostic first -- find unconnected case studies:
// MATCH (cs:CaseStudy)
// WHERE NOT (cs)-[:ILLUSTRATES]->() AND NOT (cs)-[:DEMONSTRATES]->()
// RETURN cs.name, labels(cs)
// ORDER BY cs.name;


// ============================================================
// CATEGORY 1B: CONTEXT FLOW TYPES -- Wire orchestration logic
// These represent how multi-agent pipelines pass information.
// They need: USED_BY -> Framework/ProcessStep, PART_OF -> Process
// ============================================================

// Aggregated Insights -- used by pipeline methodology
MATCH (cft) WHERE cft.name = 'Aggregated Insights' AND 'ContextFlowType' IN labels(cft)
MATCH (f:Framework) WHERE f.name =~ '(?i).*pipeline.*' OR f.name =~ '(?i).*minto.*'
MERGE (cft)-[:USED_BY {flow_role: 'synthesis'}]->(f);

// Direct Output -- used by single-framework sessions
MATCH (cft) WHERE cft.name = 'Direct Output' AND 'ContextFlowType' IN labels(cft)
MATCH (f:Framework) WHERE f.name =~ '(?i).*lean canvas.*' OR f.name =~ '(?i).*jobs.*'
MERGE (cft)-[:USED_BY {flow_role: 'primary_output'}]->(f);

// Filtered Results -- used by grading and assessment
MATCH (cft) WHERE cft.name = 'Filtered Results' AND 'ContextFlowType' IN labels(cft)
MATCH (f:Framework) WHERE f.name =~ '(?i).*invest.*thesis.*'
MERGE (cft)-[:USED_BY {flow_role: 'assessment_filter'}]->(f);


// ============================================================
// CATEGORY 1C: DEDUPLICATE ChallengeElement
// Same node created twice with identical properties.
// Strategy: keep one, transfer relationships, delete duplicate.
// ============================================================

// Diagnostic -- find duplicates:
// MATCH (a:ChallengeElement), (b:ChallengeElement)
// WHERE a.name = b.name AND id(a) < id(b)
// RETURN a.name, id(a) AS keep, id(b) AS delete_id
// ORDER BY a.name;

// For each duplicate pair, transfer rels from duplicate to keeper:
MATCH (a:ChallengeElement), (b:ChallengeElement)
WHERE a.name = b.name AND id(a) < id(b)
WITH a AS keeper, b AS duplicate
OPTIONAL MATCH (duplicate)-[r]->(target)
WITH keeper, duplicate, collect({rel: type(r), target: target, props: properties(r)}) AS outRels
UNWIND outRels AS outRel
WITH keeper, duplicate, outRel
WHERE outRel.target IS NOT NULL
CALL apoc.create.relationship(keeper, outRel.rel, outRel.props, outRel.target) YIELD rel
WITH DISTINCT duplicate
DETACH DELETE duplicate;


// ============================================================
// CATEGORY 2A: CORE PRINCIPLES -- Wire beyond FOLLOWS_PRINCIPLE
// They know their source course but not what they govern.
// Need: GOVERNS -> Framework, VALIDATES -> ProcessStep
// ============================================================

// Diagnostic -- see what CorePrinciples exist:
// MATCH (cp:CorePrinciple)
// RETURN cp.name, [(cp)-[r]->(t) | {rel: type(r), target: t.name}] AS connections
// ORDER BY cp.name;

// Wire CorePrinciples to the Frameworks they conceptually govern
// Pattern: match by name similarity or known pedagogical mapping
MATCH (cp:CorePrinciple)
MATCH (f:Framework)
WHERE toLower(f.name) CONTAINS toLower(cp.name)
   OR toLower(f.description) CONTAINS toLower(cp.name)
MERGE (cp)-[:GOVERNS {source: 'name_match', confidence: 0.7}]->(f);

// Wire to ProblemTypes where the principle is most relevant
MATCH (cp:CorePrinciple)
WHERE cp.name =~ '(?i).*(wicked|complex|uncertain|ambig).*'
MATCH (pt:ProblemType {name: 'Wicked'})
MERGE (cp)-[:APPLIES_TO {confidence: 0.75}]->(pt);

MATCH (cp:CorePrinciple)
WHERE cp.name =~ '(?i).*(defin|clarity|scope|bound).*'
MATCH (pt:ProblemType {name: 'Un-Defined'})
MERGE (cp)-[:APPLIES_TO {confidence: 0.75}]->(pt);


// ============================================================
// CATEGORY 2B: DELIVERABLE TEMPLATES -- Wire to what they produce
// They know PRODUCES -> Workshop but not what room section they
// file into or what framework generates them.
// ============================================================

// Wire DeliverableTemplate -> room section mapping
// Pattern: match template name to room section keywords
MATCH (dt:DeliverableTemplate)
WHERE dt.name =~ '(?i).*(canvas|model|business).*'
SET dt.room_section = 'business-model';

MATCH (dt:DeliverableTemplate)
WHERE dt.name =~ '(?i).*(compet|market|landscape|blue ocean).*'
SET dt.room_section = 'competitive-analysis';

MATCH (dt:DeliverableTemplate)
WHERE dt.name =~ '(?i).*(problem|need|job|pain).*'
SET dt.room_section = 'problem-definition';

MATCH (dt:DeliverableTemplate)
WHERE dt.name =~ '(?i).*(solution|design|prototype|mvp).*'
SET dt.room_section = 'solution-design';

MATCH (dt:DeliverableTemplate)
WHERE dt.name =~ '(?i).*(team|role|hire|org).*'
SET dt.room_section = 'team-execution';

MATCH (dt:DeliverableTemplate)
WHERE dt.name =~ '(?i).*(financ|revenue|cost|project).*'
SET dt.room_section = 'financial-model';

MATCH (dt:DeliverableTemplate)
WHERE dt.name =~ '(?i).*(ip|patent|legal|protect).*'
SET dt.room_section = 'legal-ip';

// Wire templates to frameworks that generate them
MATCH (dt:DeliverableTemplate)-[:PRODUCES]->(w)
MATCH (f:Framework)-[:HAS_PHASE]->(p:Phase)
WHERE toLower(w.name) CONTAINS toLower(f.name)
   OR toLower(f.name) CONTAINS toLower(w.name)
MERGE (f)-[:GENERATES_DELIVERABLE]->(dt);


// ============================================================
// CATEGORY 2C: SELECTION CRITERIA -- Wire to what they filter
// Only know USES_CRITERIA -> Workshop 3. Need to know what
// ProblemType or Framework they help select.
// ============================================================

MATCH (sc:SelectionCriteria)
MATCH (f:Framework)
WHERE toLower(sc.name) CONTAINS toLower(f.name)
   OR toLower(f.description) CONTAINS toLower(sc.name)
MERGE (sc)-[:SELECTS_FOR {confidence: 0.7}]->(f);


// ============================================================
// CATEGORY 2D: SIX HATS AGENT -- Wire to ProblemTypes and Bots
// Knows parent framework, nothing else.
// ============================================================

MATCH (sha:SixHatsAgent)
MATCH (pt:ProblemType)
WHERE pt.name IN ['Wicked', 'Ill-Defined']
MERGE (sha)-[:APPLIES_TO {effectiveness: 0.85}]->(pt);

// Wire to the Six Thinking Hats framework explicitly
MATCH (sha:SixHatsAgent)
MATCH (f:Framework) WHERE f.name =~ '(?i).*six.*hat.*'
MERGE (sha)-[:IMPLEMENTS]->(f);


// ============================================================
// CATEGORY 3: LAZYGRAPHCONCEPT NOISE -- Bulk delete
// ~503 generic English words extracted from chunks.
// Not PWS concepts. Safe to remove.
// ============================================================

// 3a. Diagnostic -- preview what gets deleted:
// MATCH (lgc:LazyGraphConcept)
// WHERE NOT (lgc)-[:CO_OCCURS]->(:Framework)
// AND NOT (lgc)-[:CO_OCCURS]->(:Concept)
// AND lgc.name =~ '^[a-z][a-z ]+$'
// AND size(lgc.name) < 20
// RETURN lgc.name, count{(lgc)-[]->()} AS rel_count
// ORDER BY rel_count ASC
// LIMIT 50;

// 3b. Delete LazyGraphConcepts that are:
//   - all lowercase (generic words, not proper nouns/frameworks)
//   - short (<20 chars)
//   - only connected to other LazyGraphConcepts (no Framework/Concept links)
//   - have 0 relationships to canonical MindrianOS labels
MATCH (lgc:LazyGraphConcept)
WHERE lgc.name =~ '^[a-z][a-z ]+$'
AND size(lgc.name) < 20
AND NOT (lgc)-[:CO_OCCURS]->(:Framework)
AND NOT (lgc)-[:CO_OCCURS]->(:Concept {canonical: true})
AND NOT (lgc)-[:CO_OCCURS]->(:Book)
AND NOT (lgc)-[:CO_OCCURS]->(:Tool)
// Safety: only delete if ALL relationships are to other LazyGraphConcepts
AND all(r IN [(lgc)-[rel]->() | labels(endNode(rel))] WHERE 'LazyGraphConcept' IN r)
DETACH DELETE lgc;

// 3c. Promote valuable LazyGraphConcepts to Concept
// If a LazyGraphConcept CO_OCCURS with 3+ Frameworks, it's real
MATCH (lgc:LazyGraphConcept)
WHERE size([(lgc)-[:CO_OCCURS]->(:Framework) | 1]) >= 3
SET lgc:Concept
SET lgc.promoted_from = 'LazyGraphConcept'
SET lgc.promoted_date = date();


// ============================================================
// CATEGORY 4: DICTIONARY TERMS -- Wire through to Frameworks
// Know INTRODUCES_TERM -> Book but nothing about what Framework
// uses them, what ProblemType they apply to, or what Workshop
// teaches them.
// ============================================================

// 4a. Wire DictionaryTerm -> Framework via Book -> Framework path
// If a Book REFERENCES a Framework, and the Book INTRODUCES a Term,
// then the Term is USED_IN that Framework
MATCH (dt:DictionaryTerm)<-[:INTRODUCES_TERM]-(b:Book)-[:REFERENCES]->(f:Framework)
MERGE (dt)-[:USED_IN {source: 'book_bridge', confidence: 0.75}]->(f);

// 4b. Wire by name matching -- term name appears in framework description
MATCH (dt:DictionaryTerm)
MATCH (f:Framework)
WHERE toLower(f.description) CONTAINS toLower(dt.name)
AND size(dt.name) > 5  // avoid short generic matches
MERGE (dt)-[:USED_IN {source: 'description_match', confidence: 0.6}]->(f);

// 4c. Wire specific high-value terms manually
// Accumulative Core -> PWS methodology
MATCH (dt:DictionaryTerm {name: 'Accumulative Core'})
MATCH (f:Framework) WHERE f.name =~ '(?i).*pws.*' OR f.name =~ '(?i).*personal wisdom.*'
MERGE (dt)-[:DEFINES_CONCEPT_IN {confidence: 0.95}]->(f);

// Brainstorming -> Six Thinking Hats, Beautiful Question
MATCH (dt:DictionaryTerm {name: 'Brainstorming'})
MATCH (f:Framework) WHERE f.name =~ '(?i).*six.*hat.*' OR f.name =~ '(?i).*beautiful question.*'
MERGE (dt)-[:USED_IN {confidence: 0.8}]->(f);

// 4d. Wire terms to ProblemTypes via semantic clustering
// Terms about uncertainty/ambiguity -> Un-Defined/Wicked
MATCH (dt:DictionaryTerm)
WHERE dt.name =~ '(?i).*(uncertain|ambig|unknown|explor|discover).*'
MATCH (pt:ProblemType)
WHERE pt.name IN ['Un-Defined', 'Wicked']
MERGE (dt)-[:RELEVANT_TO {confidence: 0.6}]->(pt);

// Terms about analysis/structure -> Well-Defined/Ill-Defined
MATCH (dt:DictionaryTerm)
WHERE dt.name =~ '(?i).*(analy|structur|measur|metric|assess).*'
MATCH (pt:ProblemType)
WHERE pt.name IN ['Well-Defined', 'Ill-Defined']
MERGE (dt)-[:RELEVANT_TO {confidence: 0.6}]->(pt);


// ============================================================
// SECTION 5: POST-SURGERY VERIFICATION
// Run all of these after the normalization completes
// ============================================================

// V1. True orphan count (should be near 0 for CaseStudy, ContextFlowType)
// MATCH (n)
// WHERE NOT (n)-[]-()
// AND NOT 'LazyGraphConcept' IN labels(n)
// RETURN labels(n)[0] AS label, count(*) AS orphan_count
// ORDER BY orphan_count DESC
// LIMIT 20;

// V2. ChallengeElement deduplication
// MATCH (a:ChallengeElement), (b:ChallengeElement)
// WHERE a.name = b.name AND id(a) < id(b)
// RETURN count(*) AS remaining_duplicates;

// V3. CorePrinciple connection density (target: 2+ rels each)
// MATCH (cp:CorePrinciple)
// RETURN cp.name, count{(cp)-[]->()} AS outbound_rels
// ORDER BY outbound_rels ASC;

// V4. DictionaryTerm -> Framework coverage
// MATCH (dt:DictionaryTerm)
// OPTIONAL MATCH (dt)-[:USED_IN|DEFINES_CONCEPT_IN]->(f:Framework)
// WITH dt, count(f) AS framework_links
// RETURN
//   count(CASE WHEN framework_links > 0 THEN 1 END) AS wired,
//   count(CASE WHEN framework_links = 0 THEN 1 END) AS still_orphaned;

// V5. LazyGraphConcept cleanup count
// MATCH (lgc:LazyGraphConcept)
// RETURN count(lgc) AS remaining_lazy,
//        count(CASE WHEN lgc.promoted_from IS NOT NULL THEN 1 END) AS promoted;

// V6. CaseStudy wiring
// MATCH (cs:CaseStudy)
// RETURN cs.name,
//        [(cs)-[r]->(t) | type(r) + ' -> ' + t.name] AS connections
// ORDER BY cs.name;

// V7. Full MindrianOS edge health
// MATCH ()-[r]->()
// WHERE type(r) IN [
//   'FEEDS_INTO', 'TYPICAL_AT', 'ADDRESSES_PROBLEM_TYPE',
//   'PREREQUISITE', 'ILLUSTRATES', 'DEMONSTRATES',
//   'USED_IN', 'GOVERNS', 'APPLIES_TO', 'IMPLEMENTS',
//   'GENERATES_DELIVERABLE', 'SELECTS_FOR'
// ]
// RETURN type(r) AS edge_type, count(r) AS count
// ORDER BY count DESC;
