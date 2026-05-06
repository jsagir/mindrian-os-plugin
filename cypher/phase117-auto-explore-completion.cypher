// Phase 117 -- Auto-Explore-Domains on First Material -- Brain stub completion patch.
// Applied post-release per 89-07 Q5 + 116-00 precedent. Idempotent (MERGE not CREATE).
// Canon Part 8: zero user content; only framework-name handles + plugin scalars.
//
// Apply via: claude_ai_brain_query MCP or equivalent.
// Verify: re-query (:Agent {name: 'AutoExploreDomains'}) and confirm DELEGATES_TO + IMPLEMENTS edges land.

MERGE (a:Agent {name: 'AutoExploreDomains'})
ON CREATE SET a.shipped_at = '2026-05-06', a.plugin_phase = '117', a.version = '1.13.0-beta.7'
ON MATCH SET a.version = '1.13.0-beta.7';

MERGE (p:CanonPart {id: 'Part-10-sub-claim-5'})
ON CREATE SET p.title = 'Triple-Filter Math Auto-Fires';

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

MERGE (e1:Engine1Layer {name: 'WhitespaceMap'})
ON CREATE SET e1.algorithmic = true, e1.canon_part = 'Part 2 Engine 1';

MERGE (e2:Engine1Layer {name: 'ReverseSalient'})
ON CREATE SET e2.algorithmic = true, e2.canon_part = 'Part 2 Engine 1';

MERGE (e3:Engine1Layer {name: 'CrossDomainMatch'})
ON CREATE SET e3.algorithmic = true, e3.canon_part = 'Part 2 Engine 1', e3.formula = 'surprise = similarity * domain_distance';

MERGE (a)-[:COMPOSES]->(e1);
MERGE (a)-[:COMPOSES]->(e2);
MERGE (a)-[:COMPOSES]->(e3);

RETURN 'AutoExploreDomains stub completed via IMPLEMENTS_SUBCLAIM + CONSUMES_PATTERN + READS_VIA + SURFACES_VIA + 3x COMPOSES Engine1Layer' AS status;
