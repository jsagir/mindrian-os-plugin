// Brain Normalization v1.9.4
// Executed: 2026-04-09
// Method: Python neo4j driver (direct Aura connection)
//
// BASELINE:
//   LazyGraphConcepts: 7,931
//   CO_OCCURS edges:   122,915
//   FEEDS_INTO edges:  147
//
// RESULTS:
//   LazyGraphConcepts: 7,578 (-353)
//   CO_OCCURS edges:   119,706 (-3,209)
//   FEEDS_INTO edges:  167 (+20)

// ============================================================
// Section 1b: "The X" / "X" prefix deduplication
// 280 pairs found and merged. Kept higher-degree node.
// Edges redirected (CO_OCCURS, MENTIONED_IN) before deletion.
// ============================================================

MATCH (a:LazyGraphConcept)
WHERE a.name STARTS WITH 'The '
WITH a, substring(a.name, 4) AS stripped
MATCH (b:LazyGraphConcept)
WHERE toLower(trim(b.name)) = toLower(trim(stripped)) AND b <> a
WITH a, b, size([(a)--() | 1]) AS a_deg, size([(b)--() | 1]) AS b_deg
WITH CASE WHEN a_deg >= b_deg THEN a ELSE b END AS keeper,
     CASE WHEN a_deg >= b_deg THEN b ELSE a END AS victim
// Redirect outbound CO_OCCURS, inbound CO_OCCURS, MENTIONED_IN
// Then: DETACH DELETE victim
// (Executed via Python batches of 20 for transaction safety)

// ============================================================
// Section 2: File path contamination removal (73 nodes)
// Tightened filter: only actual file paths, not "Input/Output"
// ============================================================

// Python logic (not pure Cypher -- requires string inspection):
//   - path/to/file.ext (slash + extension)
//   - /absolute paths
//   - \\backslash paths
//   - wsl.localhost contamination
//   - node_modules paths
//   - C:\Windows paths

// ============================================================
// Section 3: Noise removal -- 0 nodes (graph was clean)
// Section 4: Self-loops -- 0 loops found
// ============================================================

// ============================================================
// Task 2: 20 missing FEEDS_INTO edges added
// confidence: 0.7 (below 0.87 manual average)
// source: 'v1.9.4-normalization'
// ============================================================
// Key connections wired:
//   - Leadership cluster -> PWS Value Proposition (6 edges)
//   - Wicked Problem Detection <-> Systems Thinking / Six Hats (4 edges)
//   - Five Practices <-> First Who Then What <-> PWS Value Proposition (4 edges)
//   - Psychological Safety -> Six Thinking Hats (1 edge)
//   - Causal Loop Diagrams -> Six Thinking Hats (1 edge)
