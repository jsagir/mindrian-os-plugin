// ============================================================
// BRAIN NORMALIZATION -- BOOK LAYER SURGERY
//
// Three diseases diagnosed:
//   1. Massive duplication (88 null-title ghosts + 6x Systems Thinking etc.)
//   2. Strong DictionaryTerm wiring, blind to Frameworks (998 vs 6 edges)
//   3. INTRODUCES_FRAMEWORK lands on Concept nodes (123/125 mislanded)
//
// Data from live queries (2026-04-06):
//   - 88 Book nodes with title=NULL (using name field instead)
//   - 13 of those 88 are duplicates of titled books
//   - 75 are standalone books that were never given a title property
//   - Introduction to Systems Thinking: 6 copies, 160 rels each = 830+ redundant edges
//   - INTRODUCES_FRAMEWORK: 123 -> Concept, only 2 -> Framework
//   - INTRODUCES_CONCEPT: 4 -> Framework (labels are literally swapped)
//   - Only ~6 direct Book -> Framework edges exist total
//
// Strategy: deduplicate, normalize properties, rewire to Frameworks
// ============================================================


// ============================================================
// PHASE 1: PROPERTY NORMALIZATION
// Fix the 75 books that have name but no title.
// This must run BEFORE dedup so matching works.
// ============================================================

// 1a. Copy name to title for all books missing title
MATCH (b:Book)
WHERE b.title IS NULL AND b.name IS NOT NULL
SET b.title = b.name;

// 1b. Verify
// MATCH (b:Book) WHERE b.title IS NULL RETURN count(b);
// Expected: 0


// ============================================================
// PHASE 2: BOOK DEDUPLICATION
// Strategy: For each set of duplicates, keep the one with the
// most relationships. Transfer all relationships from duplicates
// to the keeper, then delete duplicates.
//
// Three duplicate categories:
//   A. Same title, multiple nodes (Introduction to Systems Thinking x6)
//   B. Titled book + formerly-null-title book (The Lean Startup x2 after Phase 1)
//   C. Short name vs full subtitle ("The Innovators Dilemma" vs "The Innovator's Dilemma")
// ============================================================

// 2a. EXACT TITLE MATCH dedup -- handles categories A and B
// Find duplicate sets, keep the node with most relationships
// NOTE: This uses APOC. If APOC unavailable, use Phase 2-ALT below.

MATCH (b:Book)
WITH toLower(trim(b.title)) AS norm_title, collect(b) AS copies
WHERE size(copies) > 1
// Sort copies by relationship count descending to pick the richest as keeper
WITH norm_title, copies,
     [c IN copies | {node: c, rels: size([(c)-[]-() | 1])}] AS scored
WITH norm_title,
     scored[0].node AS keeper,
     [s IN scored[1..] | s.node] AS duplicates
// Transfer inbound relationships from each duplicate to keeper
UNWIND duplicates AS dup
WITH keeper, dup
// Transfer outbound rels
CALL {
  WITH keeper, dup
  MATCH (dup)-[r]->(target)
  WHERE target <> keeper
  WITH keeper, type(r) AS relType, properties(r) AS relProps, target
  CALL apoc.create.relationship(keeper, relType, relProps, target) YIELD rel
  RETURN count(rel) AS out_transferred
}
// Transfer inbound rels
CALL {
  WITH keeper, dup
  MATCH (source)-[r]->(dup)
  WHERE source <> keeper
  WITH keeper, type(r) AS relType, properties(r) AS relProps, source
  CALL apoc.create.relationship(source, relType, relProps, keeper) YIELD rel
  RETURN count(rel) AS in_transferred
}
// Merge properties from duplicate onto keeper (keeper wins conflicts)
SET keeper += dup {.author, .isbn, .year, .publisher, .description, .category}
// Delete the duplicate
DETACH DELETE dup
RETURN count(*) AS duplicates_removed;


// -- PHASE 2-ALT: NO-APOC FALLBACK --
// If APOC is not available, run these instead.
// This handles the specific known duplicates manually.
// Uncomment this block and skip Phase 2a above.

// -- Introduction to Systems Thinking (6 copies -> 1) --
// MATCH (b:Book)
// WHERE b.title = 'Introduction to Systems Thinking'
// WITH b ORDER BY size([(b)-[]-() | 1]) DESC
// WITH collect(b) AS all
// WITH all[0] AS keeper, all[1..] AS dupes
// UNWIND dupes AS dup
// // For each outbound rel on duplicate, create on keeper if not exists
// WITH keeper, dup
// MATCH (dup)-[r:INTRODUCES_TERM]->(dt:DictionaryTerm)
// MERGE (keeper)-[:INTRODUCES_TERM]->(dt)
// WITH keeper, dup
// MATCH (dup)-[r:ENHANCES_TOOL]->(t)
// MERGE (keeper)-[:ENHANCES_TOOL]->(t)
// WITH keeper, dup
// MATCH (dup)-[r:INTRODUCES_FRAMEWORK]->(c)
// MERGE (keeper)-[:INTRODUCES_FRAMEWORK]->(c)
// WITH keeper, dup
// MATCH (dup)-[r:RELATED_READING]->(other)
// MERGE (keeper)-[:RELATED_READING]->(other)
// WITH keeper, dup
// DETACH DELETE dup;

// -- Scenarios: Uncharted Waters Ahead (2 copies) --
// MATCH (b:Book)
// WHERE b.title = 'Scenarios: Uncharted Waters Ahead'
// WITH b ORDER BY size([(b)-[]-() | 1]) DESC
// WITH collect(b) AS all
// WITH all[0] AS keeper, all[1..] AS dupes
// UNWIND dupes AS dup
// MATCH (dup)-[r]->(target) WHERE target <> keeper
// WITH keeper, dup, type(r) AS rt, target
// FOREACH (_ IN CASE WHEN rt = 'INTRODUCES_TERM' THEN [1] ELSE [] END |
//   MERGE (keeper)-[:INTRODUCES_TERM]->(target))
// FOREACH (_ IN CASE WHEN rt = 'ENHANCES_TOOL' THEN [1] ELSE [] END |
//   MERGE (keeper)-[:ENHANCES_TOOL]->(target))
// FOREACH (_ IN CASE WHEN rt = 'INTRODUCES_FRAMEWORK' THEN [1] ELSE [] END |
//   MERGE (keeper)-[:INTRODUCES_FRAMEWORK]->(target))
// WITH DISTINCT dup
// DETACH DELETE dup;

// Repeat pattern for: Thinking in Bets, The Fifth Discipline,
// Four Lenses of Innovation, Technological Discontinuities,
// The Lean Startup, Capitalism Socialism and Democracy
// (Copy the Scenarios pattern, change the WHERE title = '...')


// ============================================================
// PHASE 3: FIX INTRODUCES_FRAMEWORK MISLANDING
// 123 edges point to Concept nodes instead of Framework nodes.
//
// Three sub-strategies:
//   A. Where a Framework node exists with matching name -> redirect edge
//   B. Where no Framework exists but should -> promote Concept to Framework
//   C. Where it's genuinely a Concept (not a framework) -> keep as-is,
//      but add a GROUNDS -> nearest Framework edge
// ============================================================

// 3a. REDIRECT: Concept target has a matching Framework node
// Delete Concept edge, create Framework edge
MATCH (b:Book)-[old:INTRODUCES_FRAMEWORK]->(c:Concept)
WHERE NOT 'Framework' IN labels(c)
MATCH (f:Framework)
WHERE toLower(f.name) = toLower(c.name)
MERGE (b)-[:INTRODUCES_FRAMEWORK]->(f)
DELETE old;

// 3b. REDIRECT: Concept name is a substring of Framework name (fuzzy match)
// e.g., "Shell Scenario Planning Method" -> "Scenario Planning"
// e.g., "Design Thinking Process" -> "Design Thinking"
MATCH (b:Book)-[old:INTRODUCES_FRAMEWORK]->(c:Concept)
WHERE NOT 'Framework' IN labels(c)
MATCH (f:Framework)
WHERE toLower(f.name) <> toLower(c.name)  // not exact (those were handled in 3a)
AND (toLower(c.name) CONTAINS toLower(f.name)
     OR toLower(f.name) CONTAINS toLower(c.name))
AND size(f.name) > 5  // avoid tiny substring false matches
WITH b, old, c, f,
     // Prefer the shortest framework name match (most specific)
     abs(size(c.name) - size(f.name)) AS name_distance
ORDER BY name_distance ASC
WITH b, old, c, collect(f)[0] AS best_match
MERGE (b)-[:INTRODUCES_FRAMEWORK]->(best_match)
// Keep the old edge to Concept as INTRODUCES_CONCEPT (it IS a concept too)
WITH b, old, c
// Retype the old edge: delete INTRODUCES_FRAMEWORK, create INTRODUCES_CONCEPT
MERGE (b)-[:INTRODUCES_CONCEPT]->(c)
DELETE old;

// 3c. BRIDGE: Concept targets that have NO matching Framework
// These are genuine concepts (Build-Measure-Learn Cycle, Creative Destruction, etc.)
// They shouldn't be Frameworks, but they should CONNECT to Frameworks
// Retype edge from INTRODUCES_FRAMEWORK to INTRODUCES_CONCEPT (correct label)
MATCH (b:Book)-[old:INTRODUCES_FRAMEWORK]->(c:Concept)
WHERE NOT 'Framework' IN labels(c)
// No matching Framework found
AND NOT exists {
  MATCH (f:Framework)
  WHERE toLower(f.name) = toLower(c.name)
     OR toLower(c.name) CONTAINS toLower(f.name)
     OR toLower(f.name) CONTAINS toLower(c.name)
}
MERGE (b)-[:INTRODUCES_CONCEPT]->(c)
DELETE old;


// ============================================================
// PHASE 4: FIX THE SWAPPED INTRODUCES_CONCEPT EDGES
// 4 edges labeled INTRODUCES_CONCEPT actually point to Framework nodes.
// Retype them to INTRODUCES_FRAMEWORK.
// ============================================================

MATCH (b:Book)-[old:INTRODUCES_CONCEPT]->(f:Framework)
MERGE (b)-[:INTRODUCES_FRAMEWORK]->(f)
DELETE old;


// ============================================================
// PHASE 5: WIRE BOOKS TO FRAMEWORKS (the big missing link)
// Only ~6 direct Book->Framework edges exist.
// Books know DictionaryTerms (998 edges), Tools (549 edges),
// but not which Frameworks they ground.
//
// Strategy: Known mappings from PWS curriculum + name matching
// ============================================================

// 5a. KNOWN MAPPINGS -- Lawrence's curriculum provenance
// These are the intellectual sources that ground each framework.

// Systems Thinking family
MATCH (b:Book) WHERE b.title =~ '(?i).*fifth discipline.*'
MATCH (f:Framework) WHERE f.name =~ '(?i)systems think.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.95, source: 'curriculum'}]->(f);

MATCH (b:Book) WHERE b.title =~ '(?i).*introduction to systems thinking.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*causal loop.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.95, source: 'curriculum'}]->(f);

MATCH (b:Book) WHERE b.title =~ '(?i).*thinking in systems.*'
MATCH (f:Framework) WHERE f.name =~ '(?i)systems think.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.9, source: 'curriculum'}]->(f);

// Scenario Planning family
MATCH (b:Book) WHERE b.title =~ '(?i).*scenarios.*uncharted.*'
MATCH (f:Framework) WHERE f.name =~ '(?i)scenario plan.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.95, source: 'curriculum'}]->(f);

MATCH (b:Book) WHERE b.title =~ '(?i).*art of the long view.*'
MATCH (f:Framework) WHERE f.name =~ '(?i)scenario plan.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.9, source: 'curriculum'}]->(f);

// Decision-making under uncertainty
MATCH (b:Book) WHERE b.title =~ '(?i).*thinking in bets.*'
MATCH (f:Framework) WHERE f.name =~ '(?i)scenario plan.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.8, source: 'curriculum'}]->(f);

// Six Thinking Hats
MATCH (b:Book) WHERE b.title =~ '(?i).*six thinking hats.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*six.*hat.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 1.0, source: 'canonical'}]->(f);

// Innovation / Disruption
MATCH (b:Book) WHERE b.title =~ '(?i).*innovator.s dilemma.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*dominant design.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.85, source: 'curriculum'}]->(f);

MATCH (b:Book) WHERE b.title =~ '(?i).*innovator.s dilemma.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*s.curve.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.8, source: 'curriculum'}]->(f);

MATCH (b:Book) WHERE b.title =~ '(?i).*crossing the chasm.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*s.curve.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.85, source: 'curriculum'}]->(f);

MATCH (b:Book) WHERE b.title =~ '(?i).*diffusion of innovations.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*s.curve.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.9, source: 'curriculum'}]->(f);

// Blue Ocean
MATCH (b:Book) WHERE b.title =~ '(?i).*blue ocean.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*blue ocean.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 1.0, source: 'canonical'}]->(f);

// Lean / Customer Discovery
MATCH (b:Book) WHERE b.title =~ '(?i).*lean startup.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*lean canvas.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.85, source: 'curriculum'}]->(f);

MATCH (b:Book) WHERE b.title =~ '(?i).*mom test.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*jobs.*be.*done.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.8, source: 'curriculum'}]->(f);

MATCH (b:Book) WHERE b.title =~ '(?i).*competing against luck.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*jobs.*be.*done.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.95, source: 'canonical'}]->(f);

MATCH (b:Book) WHERE b.title =~ '(?i).*jobs to be done.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*jobs.*be.*done.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 1.0, source: 'canonical'}]->(f);

MATCH (b:Book) WHERE b.title =~ '(?i).*talking to humans.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*user needs.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.85, source: 'curriculum'}]->(f);

MATCH (b:Book) WHERE b.title =~ '(?i).*hidden in plain sight.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*user needs.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.8, source: 'curriculum'}]->(f);

// Minto / Structured Thinking
MATCH (b:Book) WHERE b.title =~ '(?i).*minto.*' OR b.title =~ '(?i).*pyramid principle.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*minto.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 1.0, source: 'canonical'}]->(f);

MATCH (b:Book) WHERE b.title =~ '(?i).*mckinsey.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*minto.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.7, source: 'curriculum'}]->(f);

// Root Cause / Wicked Problems
MATCH (b:Book) WHERE b.title =~ '(?i).*thinking.*fast.*slow.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*devils advocate.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.7, source: 'curriculum'}]->(f);

// Reverse Salient
MATCH (b:Book) WHERE b.title =~ '(?i).*networks of power.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*reverse salient.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 1.0, source: 'canonical'}]->(f);

// Technological Revolutions
MATCH (b:Book) WHERE b.title =~ '(?i).*technological revolution.*financial capital.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*s.curve.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.85, source: 'curriculum'}]->(f);

// Dominant Design
MATCH (b:Book) WHERE b.title =~ '(?i).*technological discontinuities.*dominant design.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*dominant design.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 1.0, source: 'canonical'}]->(f);

// Four Lenses
MATCH (b:Book) WHERE b.title =~ '(?i).*four lenses.*innovation.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*four lenses.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 1.0, source: 'canonical'}]->(f);

// Design-by-Analogy
MATCH (b:Book) WHERE b.title =~ '(?i).*surfaces and essences.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*design.by.analog.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.85, source: 'curriculum'}]->(f);

MATCH (b:Book) WHERE b.title =~ '(?i).*medici effect.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*design.by.analog.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.8, source: 'curriculum'}]->(f);

// Megatrends / Trending
MATCH (b:Book) WHERE b.title =~ '(?i).*megatrends.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*trending.*absurd.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.8, source: 'curriculum'}]->(f);

MATCH (b:Book) WHERE b.title =~ '(?i).*popcorn report.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*trending.*absurd.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.75, source: 'curriculum'}]->(f);

// Red Teaming / Devils Advocate
MATCH (b:Book) WHERE b.title =~ '(?i).*red team.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*devils advocate.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.85, source: 'curriculum'}]->(f);

// Investment
MATCH (b:Book) WHERE b.title =~ '(?i).*zero to one.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*investment thesis.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.75, source: 'curriculum'}]->(f);

// DIKW
MATCH (b:Book) WHERE b.title =~ '(?i).*sciences of the artificial.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*dikw.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.8, source: 'curriculum'}]->(f);

// Known-Unknown Matrix
MATCH (b:Book) WHERE b.title =~ '(?i).*ignorance.*drives science.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*known.*unknown.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.85, source: 'curriculum'}]->(f);

// Beautiful Question
MATCH (b:Book) WHERE b.title =~ '(?i).*beautiful question.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*beautiful question.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 1.0, source: 'canonical'}]->(f);

// Domain Exploration
MATCH (b:Book) WHERE b.title =~ '(?i).*innovation and entrepreneurship.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*domain explor.*'
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.8, source: 'curriculum'}]->(f);


// 5b. ALGORITHMIC BRIDGING -- For books not in known mappings
// Use the InnovationTool layer as a bridge:
// Book -ENHANCES_TOOL-> InnovationTool -???-> Framework
// If we can find Tool -> Framework connections, we can infer Book -> Framework

MATCH (b:Book)-[:ENHANCES_TOOL]->(t:InnovationTool)
MATCH (t)<-[:USES_TOOL]-(f:Framework)
WHERE NOT (b)-[:GROUNDS_FRAMEWORK]->(f)
MERGE (b)-[:GROUNDS_FRAMEWORK {confidence: 0.6, source: 'tool_bridge'}]->(f);


// ============================================================
// PHASE 6: CONCEPT-TO-FRAMEWORK WIRING
// The 123 Concept nodes that INTRODUCES_FRAMEWORK pointed to
// are real PWS concepts. They should connect UP to Frameworks.
// e.g., "Build-Measure-Learn Cycle" -> Lean Canvas
//       "Creative Destruction" -> Dominant Design Analysis
//       "Beachhead Strategy" -> S-Curve Analysis
// ============================================================

// 6a. Name-match bridging
MATCH (c:Concept)
WHERE (c)<-[:INTRODUCES_CONCEPT]-(:Book)
MATCH (f:Framework)
WHERE toLower(f.description) CONTAINS toLower(c.name)
AND size(c.name) > 8
AND NOT (c)-[:PART_OF|RELATED_TO]->(f)
MERGE (c)-[:RELATED_TO {source: 'name_in_description', confidence: 0.65}]->(f);

// 6b. Known concept-to-framework mappings
MATCH (c:Concept {name: 'Build-Measure-Learn Cycle'})
MATCH (f:Framework) WHERE f.name =~ '(?i).*lean canvas.*'
MERGE (c)-[:PART_OF {confidence: 0.9}]->(f);

MATCH (c:Concept {name: 'Creative Destruction'})
MATCH (f:Framework) WHERE f.name =~ '(?i).*dominant design.*'
MERGE (c)-[:RELATED_TO {confidence: 0.85}]->(f);

MATCH (c:Concept) WHERE c.name =~ '(?i).*dominant design.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*dominant design.*'
MERGE (c)-[:PART_OF {confidence: 0.9}]->(f);

MATCH (c:Concept) WHERE c.name =~ '(?i).*feedback loop.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*systems think.*'
MERGE (c)-[:PART_OF {confidence: 0.9}]->(f);

MATCH (c:Concept) WHERE c.name =~ '(?i).*causal loop.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*causal loop.*'
MERGE (c)-[:PART_OF {confidence: 0.95}]->(f);

MATCH (c:Concept) WHERE c.name =~ '(?i).*beachhead.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*s.curve.*'
MERGE (c)-[:RELATED_TO {confidence: 0.7}]->(f);

MATCH (c:Concept) WHERE c.name =~ '(?i).*era of ferment.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*dominant design.*'
MERGE (c)-[:PART_OF {confidence: 0.9}]->(f);

MATCH (c:Concept) WHERE c.name =~ '(?i).*minimum viable product.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*lean canvas.*'
MERGE (c)-[:PART_OF {confidence: 0.85}]->(f);

MATCH (c:Concept) WHERE c.name =~ '(?i).*four actions framework.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*blue ocean.*'
MERGE (c)-[:PART_OF {confidence: 0.95}]->(f);

MATCH (c:Concept) WHERE c.name =~ '(?i).*technology adoption lifecycle.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*s.curve.*'
MERGE (c)-[:PART_OF {confidence: 0.9}]->(f);

MATCH (c:Concept) WHERE c.name =~ '(?i).*chasm framework.*'
MATCH (f:Framework) WHERE f.name =~ '(?i).*s.curve.*'
MERGE (c)-[:PART_OF {confidence: 0.85}]->(f);


// ============================================================
// PHASE 7: VERIFICATION QUERIES
// Run after all phases complete
// ============================================================

// V1. Book deduplication check
// MATCH (b:Book)
// WITH b.title AS title, count(b) AS copies
// WHERE copies > 1
// RETURN title, copies ORDER BY copies DESC;
// Expected: 0 duplicates (or only intentional variants)

// V2. INTRODUCES_FRAMEWORK target labels
// MATCH (b:Book)-[:INTRODUCES_FRAMEWORK]->(target)
// RETURN labels(target)[0] AS target_label, count(*) AS count;
// Expected: only Framework targets, no Concept targets

// V3. GROUNDS_FRAMEWORK coverage
// MATCH (b:Book)-[:GROUNDS_FRAMEWORK]->(f:Framework)
// RETURN f.name AS framework, count(DISTINCT b) AS grounding_books
// ORDER BY grounding_books DESC;
// Expected: 20+ frameworks with at least 1 grounding book

// V4. Full Book -> Framework edge inventory
// MATCH (b:Book)-[r]->(f:Framework)
// RETURN type(r) AS rel_type, count(r) AS count
// ORDER BY count DESC;
// Expected: GROUNDS_FRAMEWORK (40+), INTRODUCES_FRAMEWORK (10+)

// V5. Orphan books (no Framework connection at all)
// MATCH (b:Book)
// WHERE NOT (b)-[:GROUNDS_FRAMEWORK|INTRODUCES_FRAMEWORK]->(:Framework)
// RETURN b.title, [(b)-[r]->() | type(r)] AS rel_types
// ORDER BY b.title
// LIMIT 30;

// V6. The full provenance chain (Book -> Framework -> ProblemType)
// MATCH (b:Book)-[:GROUNDS_FRAMEWORK]->(f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
// RETURN b.title AS book, f.name AS framework, pt.name AS problem_type
// ORDER BY framework, book;
// Expected: Complete intellectual provenance chains

// V7. Total Book count (should be ~100, down from ~157 after dedup)
// MATCH (b:Book) RETURN count(b) AS total_books;
