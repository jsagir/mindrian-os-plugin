// Brain Causal Framework Enrichment
// Phase 52: BRAIN-01 through BRAIN-06
// Execute via mcp__neo4j-brain__write_neo4j_cypher
//
// IMPORTANT: Before running any write statements, run the discovery queries
// in the "Discovery" section to verify exact node names. Replace placeholder
// names below with exact names from discovery results.
//
// Generated: 2026-04-05
// Requirements: BRAIN-01, BRAIN-02, BRAIN-03, BRAIN-04, BRAIN-05, BRAIN-06

// ============================================================================
// SECTION 0: DISCOVERY (run FIRST via mcp__neo4j-brain__read_neo4j_cypher)
// ============================================================================

// Query A: Get all Framework node names (verify exact spelling)
// MATCH (f:Framework) RETURN f.name AS name LIMIT 50

// Query B: Get all Concept node names
// MATCH (c:Concept) RETURN c.name AS name LIMIT 50

// Query C: Check VentureStage nodes
// MATCH (v:VentureStage) RETURN v.name AS name LIMIT 20

// Query D: Check existing edge types on Framework nodes
// MATCH (f:Framework)-[r]->() RETURN DISTINCT type(r) AS rel_type LIMIT 30

// Query E: Check if Falsifiability or Hypothesis Tree exist
// MATCH (f:Framework) WHERE f.name CONTAINS 'Falsif' OR f.name CONTAINS 'Hypothesis' RETURN f.name LIMIT 10

// ============================================================================
// SECTION 1: BRAIN-03 -- Create Theory of Change Framework node
// ============================================================================

MERGE (f:Framework {name: 'Theory of Change'})
ON CREATE SET f.description = 'Forward causal reasoning: articulate the causal pathway from activities to outcomes. Maps assumptions about how change happens.',
              f.category = 'causal',
              f.created = datetime()

// ============================================================================
// SECTION 2: BRAIN-04 -- Create Causal Reasoning parent Concept node
// ============================================================================

MERGE (c:Concept {name: 'Causal Reasoning'})
ON CREATE SET c.description = 'Parent concept connecting causal analysis frameworks: root cause analysis, systems thinking, causal loop diagrams, scenario analysis, and theory of change.',
              c.created = datetime()

// Link each causal framework to the Causal Reasoning concept
// NOTE: Use exact names from Query A. Names below are best-guess from Brain schema.

MATCH (f:Framework {name: 'Root Cause Analysis'}), (c:Concept {name: 'Causal Reasoning'})
MERGE (f)-[:RELATED_TO]->(c)

MATCH (f:Framework {name: 'Systems Thinking'}), (c:Concept {name: 'Causal Reasoning'})
MERGE (f)-[:RELATED_TO]->(c)

MATCH (f:Framework {name: 'Causal Loop Diagrams'}), (c:Concept {name: 'Causal Reasoning'})
MERGE (f)-[:RELATED_TO]->(c)

MATCH (f:Framework {name: 'Scenario Analysis Framework'}), (c:Concept {name: 'Causal Reasoning'})
MERGE (f)-[:RELATED_TO]->(c)

MATCH (f:Framework {name: 'Theory of Change'}), (c:Concept {name: 'Causal Reasoning'})
MERGE (f)-[:RELATED_TO]->(c)

// ============================================================================
// SECTION 3: BRAIN-01 -- Wire FEEDS_INTO chains
// ============================================================================

// Chain: Root Cause Analysis -> Systems Thinking -> Causal Loop Diagrams -> Scenario Analysis
MATCH (a:Framework {name: 'Root Cause Analysis'}), (b:Framework {name: 'Systems Thinking'})
MERGE (a)-[:FEEDS_INTO]->(b)

MATCH (a:Framework {name: 'Systems Thinking'}), (b:Framework {name: 'Causal Loop Diagrams'})
MERGE (a)-[:FEEDS_INTO]->(b)

MATCH (a:Framework {name: 'Causal Loop Diagrams'}), (b:Framework {name: 'Scenario Analysis Framework'})
MERGE (a)-[:FEEDS_INTO]->(b)

// Branch: Systems Thinking -> Reverse Salient Analysis
MATCH (a:Framework {name: 'Systems Thinking'}), (b:Framework {name: 'Reverse Salient Analysis'})
MERGE (a)-[:FEEDS_INTO]->(b)

// ============================================================================
// SECTION 4: BRAIN-02 -- CO_OCCURS edges (bidirectional)
// ============================================================================

// Root Cause Analysis <-> Six Thinking Hats
MATCH (a:Framework {name: 'Root Cause Analysis'}), (b:Framework {name: 'Six Thinking Hats'})
MERGE (a)-[:CO_OCCURS]->(b)
MERGE (b)-[:CO_OCCURS]->(a)

// Systems Thinking <-> Reverse Salient Analysis
MATCH (a:Framework {name: 'Systems Thinking'}), (b:Framework {name: 'Reverse Salient Analysis'})
MERGE (a)-[:CO_OCCURS]->(b)
MERGE (b)-[:CO_OCCURS]->(a)

// Cynefin <-> Root Cause Analysis
MATCH (a:Framework {name: 'Cynefin Framework'}), (b:Framework {name: 'Root Cause Analysis'})
MERGE (a)-[:CO_OCCURS]->(b)
MERGE (b)-[:CO_OCCURS]->(a)

// ============================================================================
// SECTION 5: BRAIN-05 -- TYPICAL_AT venture stage mappings
// ============================================================================

// Create VentureStage nodes if they do not exist (verify with Query C first)
MERGE (s:VentureStage {name: 'Pre-Opportunity'})
MERGE (s2:VentureStage {name: 'Opportunity Identified'})
MERGE (s3:VentureStage {name: 'Problem Validation'})

// Map causal frameworks to venture stages
MATCH (f:Framework {name: 'Root Cause Analysis'}), (s:VentureStage {name: 'Opportunity Identified'})
MERGE (f)-[:TYPICAL_AT]->(s)

MATCH (f:Framework {name: 'Systems Thinking'}), (s:VentureStage {name: 'Pre-Opportunity'})
MERGE (f)-[:TYPICAL_AT]->(s)

MATCH (f:Framework {name: 'Reverse Salient Analysis'}), (s:VentureStage {name: 'Pre-Opportunity'})
MERGE (f)-[:TYPICAL_AT]->(s)

MATCH (f:Framework {name: 'Theory of Change'}), (s:VentureStage {name: 'Problem Validation'})
MERGE (f)-[:TYPICAL_AT]->(s)

// ============================================================================
// SECTION 6: BRAIN-06 -- Link Falsifiability and Hypothesis Tree
// ============================================================================

// NOTE: Use exact names from Query E. Names below are best-guess.

// Link to Causal Reasoning concept
// NOTE: Falsifiability is a Concept, Logic Trees is a Concept (not Framework labels)
MATCH (f:Concept {name: 'Falsifiability'}), (c:Concept {name: 'Causal Reasoning'})
MERGE (f)-[:RELATED_TO]->(c)

MATCH (f:Concept {name: 'Logic Trees (Issue, Hypothesis, Decision)'}), (c:Concept {name: 'Causal Reasoning'})
MERGE (f)-[:RELATED_TO]->(c)

// FEEDS_INTO from Theory of Change to Logic Trees
MATCH (a:Framework {name: 'Theory of Change'}), (b:Concept {name: 'Logic Trees (Issue, Hypothesis, Decision)'})
MERGE (a)-[:FEEDS_INTO]->(b)

// FEEDS_INTO from Logic Trees to Falsifiability
MATCH (a:Concept {name: 'Logic Trees (Issue, Hypothesis, Decision)'}), (b:Concept {name: 'Falsifiability'})
MERGE (a)-[:FEEDS_INTO]->(b)

// ============================================================================
// VERIFICATION QUERIES (run via mcp__neo4j-brain__read_neo4j_cypher)
// ============================================================================

// Verify BRAIN-01: FEEDS_INTO chain
// MATCH (a:Framework)-[:FEEDS_INTO]->(b:Framework)
// WHERE a.name CONTAINS 'Root Cause' OR a.name CONTAINS 'Systems' OR a.name CONTAINS 'Causal Loop'
// RETURN a.name AS from_fw, b.name AS to_fw
// LIMIT 10

// Verify BRAIN-04: Causal Reasoning concept connections
// MATCH (f:Framework)-[:RELATED_TO]->(c:Concept {name: 'Causal Reasoning'})
// RETURN f.name AS framework
// LIMIT 10

// Verify BRAIN-05: TYPICAL_AT edges
// MATCH (f:Framework)-[:TYPICAL_AT]->(s:VentureStage)
// RETURN f.name AS framework, s.name AS stage
// LIMIT 10
