// Phase 116 -- Unresolved Tension Hook -- Brain stub completion patch.
// Applied post-release per 89-07 Q5 precedent. Idempotent (MERGE not CREATE).
// Canon Part 8: zero user content; only framework-name handles + plugin scalars.
//
// Apply via: claude_ai_brain_query MCP or equivalent.
// Verify: re-query (:Agent {name: 'UnresolvedTensionHook'}) and confirm
// IMPLEMENTS_SUBCLAIM + CONSUMES_PATTERN + READS_VIA + SURFACES_VIA edges land.

MERGE (a:Agent {name: 'UnresolvedTensionHook'})
ON CREATE SET a.shipped_at = '2026-05-06', a.plugin_phase = '116', a.version = '1.13.0-beta.5'
ON MATCH SET a.version = '1.13.0-beta.5';

MERGE (p:CanonPart {id: 'Part-10-sub-claim-3'})
ON CREATE SET p.title = 'Persistent Conversation Across Sessions';

MERGE (a)-[:IMPLEMENTS_SUBCLAIM]->(p);

MERGE (pat:Pattern {name: 'AgenticSurfacingPattern'})
ON CREATE SET pat.canonical_doc = 'docs/AGENTIC-SURFACING-PATTERN.md', pat.origin_phase = '89-07';

MERGE (a)-[:CONSUMES_PATTERN]->(pat);

MERGE (s:Substrate {name: 'PostingNavigationCjs'})
ON CREATE SET s.phase = '109', s.module_path = 'lib/core/navigation.cjs';

MERGE (a)-[:READS_VIA]->(s);

MERGE (sel:Selector {shape: 'F.1'})
ON CREATE SET sel.phase = '88.2-05', sel.module_path = 'lib/hmi/selector-dispatcher.cjs';

MERGE (a)-[:SURFACES_VIA]->(sel);

RETURN 'UnresolvedTensionHook stub completed via IMPLEMENTS_SUBCLAIM + CONSUMES_PATTERN + READS_VIA + SURFACES_VIA' AS status;
