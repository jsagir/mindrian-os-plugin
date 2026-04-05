# Domain Pitfalls: v1.7.0 Causal Reasoning Layer

**Domain:** Causal graph engine for MindrianOS plugin
**Researched:** 2026-04-03

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: WALK Semantics on Cyclic Causal Graphs
**What goes wrong:** KuzuDB's default variable-length path uses WALK semantics, which revisits nodes. Causal graphs frequently have cycles (feedback loops are real). WALK on a cyclic graph causes exponential path expansion or timeout.
**Why it happens:** Developer writes `MATCH (a)-[:CAUSES*1..5]->(b)` without specifying semantics. Works in testing with small acyclic test data, breaks in production when real cycles appear.
**Consequences:** Query hangs, KuzuDB process consumes all memory, user sees timeout.
**Prevention:** ALWAYS use ACYCLIC semantic for causal chain queries: `MATCH (a)-[:CAUSES*1..5 ACYCLIC]->(b)`. Reserve WALK only for explicit cycle detection queries. Code review rule: any Kleene star without ACYCLIC must have a comment explaining why.
**Detection:** Query taking >5 seconds on <1000 nodes. Test with intentional cycles in test data.

### Pitfall 2: LLM Hallucinated Causal Claims
**What goes wrong:** Larry extracts cause-effect relationships that don't exist in the source text. "Market is growing" becomes "Market growth CAUSES competitive advantage" -- a plausible but unsupported inference.
**Why it happens:** LLMs are pattern-completion machines. They generate plausible causal chains even when the source text only states correlation or juxtaposition.
**Consequences:** Causal graph is populated with false claims. Cascade simulation produces garbage. User loses trust in the system.
**Prevention:** Every extracted claim requires: (1) explicit cause text, (2) explicit mechanism text, (3) explicit effect text. If any is missing, the claim is flagged as "inferred" not "extracted." User must confirm inferred claims before they enter the graph as "active."
**Detection:** Claims where `extraction_method = 'llm'` and `mechanism` is empty or generic. Audit script that checks mechanism specificity.

### Pitfall 3: Confidence Score Miscalibration
**What goes wrong:** Initial confidence scores (0.5 default) never get updated because prediction resolution requires manual user action. After months, all claims still show 0.5 confidence, making the score meaningless.
**Why it happens:** Closed-loop learning depends on users resolving predictions. Users forget or don't prioritize prediction review.
**Consequences:** Confidence scores are noise, not signal. Betweenness centrality weighted by confidence produces misleading bottleneck rankings.
**Prevention:** (1) Larry proactively prompts for prediction resolution when deadline passes. (2) Confidence also updates from CONTRADICTS and INVALIDATES edges (not just predictions). (3) Default confidence varies by extraction_method: 'observed' = 0.7, 'asserted' = 0.5, 'inferred' = 0.3.
**Detection:** Room with >20 claims where all confidence values are still 0.5. Summary stats in REGISTRY.json showing 0 resolved predictions after 30+ days.

## Moderate Pitfalls

### Pitfall 4: Two Writers to KuzuDB
**What goes wrong:** Both Python and CJS try to write to the same .lazygraph database simultaneously. KuzuDB embedded mode doesn't support concurrent writers from different processes.
**Prevention:** Maintain single-writer rule: CJS is the ONLY KuzuDB writer. Python scripts output JSON. CJS reads JSON and writes to KuzuDB. Never add `kuzu` to Python requirements.

### Pitfall 5: Causal Graph Disconnected from Artifact Graph
**What goes wrong:** CausalClaim nodes are created but EXTRACTED_FROM edges are missing or broken. The causal layer floats disconnected from source artifacts. Provenance queries return nothing.
**Prevention:** Extraction function must atomically create both the CausalClaim node AND the EXTRACTED_FROM edge. Never create a CausalClaim without linking it to a source Artifact. Schema validation: orphan CausalClaim detection query should run as health check.

### Pitfall 6: Over-Extracting Causal Claims
**What goes wrong:** Every statement in every artifact generates a causal claim. 10 artifacts produce 200 claims. The causal graph becomes noise.
**Prevention:** Extract only EXPLICIT causal statements (contains "because," "causes," "leads to," "results in," "enables," "prevents"). Rate limit: max 5 claims per artifact. Require minimum mechanism specificity. Larry should be selective, not exhaustive.

### Pitfall 7: Brain Enrichment Breaking Existing Queries
**What goes wrong:** Adding FEEDS_INTO, CO_OCCURS, TYPICAL_AT edges changes the behavior of existing Brain queries that use open-ended relationship traversal.
**Prevention:** New edge types should be explicitly named in queries. Existing Brain queries use specific relationship types. Test all 10 existing Brain query patterns after enrichment.

## Minor Pitfalls

### Pitfall 8: REGISTRY.json Growing Unbounded
**What goes wrong:** Over months, REGISTRY.json accumulates thousands of predictions. File parsing slows down.
**Prevention:** Archive resolved predictions to `room/.predictions/archive/YYYY.json` when they exceed 100 entries. Keep only active (pending) predictions in REGISTRY.json.

### Pitfall 9: NetworkX Export Format Mismatch
**What goes wrong:** NetworkX's `node_link_data()` format doesn't match Cytoscape.js expected format exactly. Dashboard shows empty graph.
**Prevention:** Verify format compatibility early. NetworkX node_link_data outputs `{nodes: [], links: []}`. Cytoscape expects `{elements: {nodes: [], edges: []}}`. Write a thin adapter.

### Pitfall 10: Cross-Type Variable-Length Paths in KuzuDB
**What goes wrong:** A query like `MATCH (c:CausalClaim)-[:EXTRACTED_FROM]->(a:Artifact)-[:HSI_CONNECTION]->(a2:Artifact)` works, but trying to traverse mixed relationship types in a single Kleene star `(c)-[*1..3]->(target)` may not work as expected across different node types.
**Prevention:** Use explicit multi-hop patterns (chain of specific relationships) instead of generic Kleene star when crossing node type boundaries. Reserve Kleene star for same-type traversals (CausalClaim to CausalClaim via CAUSES).

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Schema extension | Existing .lazygraph databases need migration | Use CREATE IF NOT EXISTS (idempotent) |
| Brain enrichment | Framework node labels may not match expected names | Verify Brain schema before running CREATE statements |
| Python causal engine | cutoff parameter for all_simple_paths too high | Start with cutoff=6, reduce if slow |
| Post-write integration | Causal step adds latency to post-write cascade | Make causal step async or deferred (flag candidates now, process later) |
| Prediction registry | Users never resolve predictions | Larry proactive prompts + deadline-based nudges |
| Command wiring | /mos:causal extract on large artifacts produces too many claims | Cap at 5 claims per artifact, require user confirmation |
