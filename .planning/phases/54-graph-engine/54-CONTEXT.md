# Phase 54: Graph Engine - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning
**Mode:** Auto-generated (smart discuss --auto)

<domain>
## Phase Boundary

NetworkX-based graph engine that operates on CausalClaim nodes exported from KuzuDB. Provides: chain traversal (because...because...because), cascade simulation (if X fails, what breaks?), bottleneck detection (betweenness centrality), contradiction detection (cycle finding), cross-reference linking to HSI/RS/Analogy edges, and inversion protocol (negate a claim, see what changes).

</domain>

<decisions>
## Implementation Decisions

### Architecture
- **D-01:** Python script (compute-causal.py) reads KuzuDB export, runs NetworkX algorithms, writes .causal-results.json. CJS bridge updates KuzuDB with computed properties. Follows existing compute-hsi.py pattern.
- **D-02:** KuzuDB export to JSON via a new CJS export function (exportCausalGraph). NetworkX reads the JSON. No Python KuzuDB bindings.

### Algorithm Parameters
- **D-03:** Chain traversal: nx.all_simple_paths with cutoff=6. Bounded paths (no ACYCLIC -- KuzuDB 0.11.3 doesn't support it).
- **D-04:** Cascade simulation: nx.descendants on CASCADES_TO subgraph. Confidence decays multiplicatively per hop (child_conf = parent_conf * edge_strength).
- **D-05:** Bottleneck detection: nx.betweenness_centrality (unweighted). Surface nodes with high centrality + low out-degree (blocking many things, enabling few).
- **D-06:** Contradiction detection: nx.simple_cycles on CAUSES subgraph. Report cycles as circular reasoning.
- **D-07:** Inversion protocol: copy graph, remove target node, find all paths that no longer exist. These are the "broken chains" -- what the claim was supporting.

### Cross-Reference Queries
- **D-08:** Multi-hop Cypher queries joining CausalClaim → EXTRACTED_FROM → Artifact → HSI_CONNECTION/REVERSE_SALIENT/ANALOGOUS_TO. Three separate queries for ENGINE-05, ENGINE-06, ENGINE-07.
- **D-09:** Cross-reference results stored as properties on CausalClaim nodes (hsi_linked, rs_linked, analogy_linked booleans or counts).

### Output Format
- **D-10:** .causal-results.json contains: chains[], cascades[], bottlenecks[], contradictions[], inversions[], cross_refs{}. Same pattern as .hsi-results.json.

### Claude's Discretion
- NetworkX graph construction details (DiGraph vs MultiDiGraph)
- JSON export schema specifics
- Error handling for empty graphs or disconnected components
- Performance tuning (k parameter for approximate betweenness if needed at scale)

</decisions>

<canonical_refs>
## Canonical References

### Phase 52-53 Outputs
- `lib/core/lazygraph-ops.cjs` -- CausalClaim schema, createCausalClaim(), createExtractedFromEdge(), graphStats()
- `scripts/causal-to-kuzu.cjs` -- CJS bridge pattern for causal data
- `docs/lazygraph-schema.md` -- Full CausalClaim + edge documentation

### Existing Engine Patterns
- `scripts/compute-hsi.py` -- Reference Python engine pattern (read room, compute, write JSON)
- `scripts/detect-reverse-salients.py` -- Reference for cross-section analysis pattern
- `scripts/hsi-to-kuzu.cjs` -- Reference CJS bridge (read JSON, write to KuzuDB)

### Research
- `.planning/research/STACK-causal.md` -- NetworkX function signatures, KuzuDB Cypher patterns
- `.planning/research/ARCHITECTURE-causal.md` -- Data flow, scalability considerations
- `.planning/research/PITFALLS-causal.md` -- Pitfall 1 (WALK semantics), Pitfall 3 (confidence miscalibration)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `compute-hsi.py` -- Python engine template: argparse CLI, room path input, JSON output, sklearn/numpy computation
- `lazygraph-ops.cjs` -- exportCausalGraph() needs to be added (new function exporting CausalClaim nodes + edges as JSON)
- NetworkX 3.6.1 already installed (verified in Phase 52 research)

### Established Patterns
- Python scripts output .json files, CJS bridges read them and write to KuzuDB
- Scripts run from post-write hook cascade or on-demand via commands
- Error handling: try/catch with fallback values, never crash the hook cascade

### Integration Points
- `lib/core/lazygraph-ops.cjs` -- Add exportCausalGraph() function
- `scripts/compute-causal.py` -- New Python engine (main deliverable)
- `commands/causal.md` -- Add trace subcommand (calls compute-causal.py then presents results)

</code_context>

<specifics>
## Specific Ideas

- Chain traversal should present as natural language: "X BECAUSE Y BECAUSE Z" not graph notation
- Cascade simulation should narrate like dominos: "If [claim] is wrong, then [child1] falls, which breaks [child2]..."
- Bottleneck should surprise the user: "You haven't mentioned [hidden blocker] but it affects 7 downstream claims"
- Cross-reference is the integration magic: "This causal chain runs through an HSI surprise connection -- the link between [artifact A] and [artifact B] has a causal explanation"

</specifics>

<deferred>
## Deferred Ideas

- Weighted betweenness centrality (needs confidence calibration data -- v1.8.0+)
- Causal graph visualization in Cytoscape.js dashboard (v1.8.0+)
- Streaming computation for large graphs (unnecessary at current scale)

</deferred>

---

*Phase: 54-graph-engine*
*Context gathered: 2026-04-05 via smart discuss --auto*
