# Phase 54: Graph Engine - Research

**Researched:** 2026-04-03
**Domain:** NetworkX graph algorithms + CJS export/import bridge for causal reasoning
**Confidence:** HIGH

## Summary

Phase 54 builds the computational heart of the causal reasoning layer: a Python script (`compute-causal.py`) that reads CausalClaim data exported from KuzuDB as JSON, runs six NetworkX algorithms (chain traversal, cascade simulation, bottleneck detection, contradiction detection, cross-reference linking, inversion protocol), and writes `.causal-results.json` for the CJS bridge to import back. A new `exportCausalGraph()` function in `lazygraph-ops.cjs` provides the export, and a new `causal-results-to-kuzu.cjs` bridge writes computed properties back.

The pattern is identical to the established HSI pipeline: `compute-hsi.py` reads room artifacts and writes `.hsi-results.json`, `hsi-to-kuzu.cjs` reads that JSON and writes edges to KuzuDB. Phase 54 follows the same architecture with different algorithms. Zero new dependencies are required -- NetworkX 3.6.1 and KuzuDB 0.11.3 (npm) are already installed.

The cross-reference queries (ENGINE-05, ENGINE-06, ENGINE-07) are Cypher queries that run in CJS, not Python. They join CausalClaim nodes through EXTRACTED_FROM edges to Artifact nodes, then traverse HSI_CONNECTION, REVERSE_SALIENT, and ANALOGOUS_TO edges to find where causal chains intersect with existing intelligence layers.

**Primary recommendation:** Build `exportCausalGraph()` in lazygraph-ops.cjs, then `compute-causal.py` following the exact `compute-hsi.py` pattern (argparse, room path, JSON output), then `causal-results-to-kuzu.cjs` following the `hsi-to-kuzu.cjs` pattern. Cross-reference queries are separate Cypher functions in lazygraph-ops.cjs.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Python script (compute-causal.py) reads KuzuDB export, runs NetworkX algorithms, writes .causal-results.json. CJS bridge updates KuzuDB with computed properties. Follows existing compute-hsi.py pattern.
- **D-02:** KuzuDB export to JSON via a new CJS export function (exportCausalGraph). NetworkX reads the JSON. No Python KuzuDB bindings.
- **D-03:** Chain traversal: nx.all_simple_paths with cutoff=6. Bounded paths (no ACYCLIC -- KuzuDB 0.11.3 doesn't support it).
- **D-04:** Cascade simulation: nx.descendants on CASCADES_TO subgraph. Confidence decays multiplicatively per hop (child_conf = parent_conf * edge_strength).
- **D-05:** Bottleneck detection: nx.betweenness_centrality (unweighted). Surface nodes with high centrality + low out-degree (blocking many things, enabling few).
- **D-06:** Contradiction detection: nx.simple_cycles on CAUSES subgraph. Report cycles as circular reasoning.
- **D-07:** Inversion protocol: copy graph, remove target node, find all paths that no longer exist. These are the "broken chains" -- what the claim was supporting.
- **D-08:** Multi-hop Cypher queries joining CausalClaim -> EXTRACTED_FROM -> Artifact -> HSI_CONNECTION/REVERSE_SALIENT/ANALOGOUS_TO. Three separate queries for ENGINE-05, ENGINE-06, ENGINE-07.
- **D-09:** Cross-reference results stored as properties on CausalClaim nodes (hsi_linked, rs_linked, analogy_linked booleans or counts).
- **D-10:** .causal-results.json contains: chains[], cascades[], bottlenecks[], contradictions[], inversions[], cross_refs{}. Same pattern as .hsi-results.json.

### Claude's Discretion
- NetworkX graph construction details (DiGraph vs MultiDiGraph)
- JSON export schema specifics
- Error handling for empty graphs or disconnected components
- Performance tuning (k parameter for approximate betweenness if needed at scale)

### Deferred Ideas (OUT OF SCOPE)
- Weighted betweenness centrality (needs confidence calibration data -- v1.8.0+)
- Causal graph visualization in Cytoscape.js dashboard (v1.8.0+)
- Streaming computation for large graphs (unnecessary at current scale)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENGINE-01 | Chain traversal: /mos:causal trace shows "because...because...because" chain up to 6 hops | nx.all_simple_paths(G, source, target, cutoff=6) on CAUSES subgraph; verified working in NetworkX 3.6.1 |
| ENGINE-02 | Cascade simulation: "if X is wrong, what falls?" with multiplicative confidence decay | nx.descendants(G, node) on CASCADES_TO subgraph; multiply parent_conf * edge_strength per hop |
| ENGINE-03 | Bottleneck detection: high-centrality, low-out-degree nodes surfaced proactively | nx.betweenness_centrality(G) unweighted; filter for centrality > threshold AND out_degree < threshold |
| ENGINE-04 | Contradiction detection: circular reasoning caught (A causes B causes C causes A) | nx.simple_cycles(G) on CAUSES subgraph; each cycle is a circular reasoning chain |
| ENGINE-05 | Cross-reference HSI: which HSI pairs have causal explanations | Cypher: CausalClaim->EXTRACTED_FROM->Artifact->HSI_CONNECTION->Artifact<-EXTRACTED_FROM<-CausalClaim |
| ENGINE-06 | Cross-reference RS: which reverse salients have causal chains | Cypher: CausalClaim->EXTRACTED_FROM->Artifact->BELONGS_TO->Section->REVERSE_SALIENT->Section |
| ENGINE-07 | Cross-reference Analogy: which analogies match causal structure | Cypher: CausalClaim->EXTRACTED_FROM->Artifact->ANALOGOUS_TO->Artifact<-EXTRACTED_FROM<-CausalClaim |
| ENGINE-08 | Inversion protocol: negate a claim, see what breaks | G.copy(), remove_node(), check which descendants lose all paths from roots |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NetworkX | 3.6.1 | All graph algorithms (paths, centrality, cycles, descendants) | Already installed; verified locally; every algorithm needed is built-in |
| KuzuDB (npm) | 0.11.3 | Graph storage, Cypher queries, export/import | Already installed; single-writer CJS pattern established |
| Python 3 | 3.x (system) | Script runtime for compute-causal.py | Already used by compute-hsi.py and detect-reverse-salients.py |
| Node.js CJS | >=18 | CJS bridge scripts, lazygraph-ops.cjs | Project standard per CLAUDE.md |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| json (Python stdlib) | builtin | Read/write .causal-export.json and .causal-results.json | Always -- JSON is the bridge format |
| argparse (Python stdlib) | builtin | CLI argument parsing for compute-causal.py | Always -- matches compute-hsi.py pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| NetworkX | igraph | igraph needs C bindings; NetworkX already installed |
| DiGraph | MultiDiGraph | MultiDiGraph allows parallel edges between same nodes; unnecessary unless multiple CAUSES edges between same pair are needed. Use DiGraph -- simpler, matches the data model |
| Python kuzu bindings | JSON bridge | D-02 locks this: CJS is the single KuzuDB writer |

**Installation:**
```bash
# Nothing to install. All dependencies already present.
```

**Version verification:** NetworkX 3.6.1 confirmed via `python3 -c "import networkx; print(networkx.__version__)"`. KuzuDB npm confirmed via `require('kuzu')`.

## Architecture Patterns

### Recommended Project Structure
```
scripts/
  compute-causal.py          # NEW: NetworkX engine (main deliverable)
  causal-results-to-kuzu.cjs # NEW: CJS bridge (reads .causal-results.json, writes to KuzuDB)
lib/core/
  lazygraph-ops.cjs          # MODIFIED: add exportCausalGraph() + cross-reference Cypher queries
room/
  .lazygraph-causal-export.json  # Intermediate: CJS exports CausalClaim graph
  .causal-results.json           # Intermediate: Python writes computed results
```

### Pattern 1: Python-JSON-CJS Bridge (EXISTING -- follow exactly)
**What:** Python reads JSON, computes, writes JSON. CJS reads JSON and writes to KuzuDB.
**When:** Every computation requiring Python libraries.
**Example (from compute-hsi.py):**
```python
# Source: scripts/compute-hsi.py lines 668-818
parser = argparse.ArgumentParser(description='...')
parser.add_argument('room_dir', help='Path to room directory')
parser.add_argument('--output', default=None, help='Output JSON path')
args = parser.parse_args()
room_dir = Path(args.room_dir).resolve()
output_path = args.output or str(room_dir / '.causal-results.json')
# ... compute ...
Path(output_path).write_text(json.dumps(result, indent=2), encoding='utf-8')
```

### Pattern 2: CJS Export Function (EXISTING -- follow hsi-to-kuzu.cjs)
**What:** CJS function queries KuzuDB, serializes to JSON for Python consumption.
**When:** Python needs graph data that lives in KuzuDB.
**Example (new exportCausalGraph):**
```javascript
// Follow hsi-to-kuzu.cjs open-use-close pattern (lines 29-170)
async function exportCausalGraph(roomDir) {
  const { db, conn } = await openGraph(roomDir);
  try {
    const nodes = await queryGraph(conn, 
      'MATCH (c:CausalClaim) RETURN c.id, c.cause, c.mechanism, c.effect, c.confidence, c.domain');
    const causesEdges = await queryGraph(conn,
      'MATCH (a:CausalClaim)-[r:CAUSES]->(b:CausalClaim) RETURN a.id, b.id, r.confidence, r.mechanism');
    const cascadesEdges = await queryGraph(conn,
      'MATCH (a:CausalClaim)-[r:CASCADES_TO]->(b:CausalClaim) RETURN a.id, b.id, r.cascade_type, r.severity');
    // Write JSON
    const exportData = { nodes, causes_edges: causesEdges, cascades_edges: cascadesEdges, metadata: {...} };
    fs.writeFileSync(path.join(roomDir, '.lazygraph-causal-export.json'), JSON.stringify(exportData, indent=2));
    return exportData;
  } finally {
    await closeGraph(db);
  }
}
```

### Pattern 3: Cross-Reference Cypher Queries (NEW -- CJS-side, not Python)
**What:** Multi-hop Cypher joins across CausalClaim and Artifact node types.
**When:** ENGINE-05, ENGINE-06, ENGINE-07 cross-reference queries.
**Why CJS not Python:** These queries traverse KuzuDB edges directly. No NetworkX algorithm needed. CJS is the KuzuDB reader/writer.
**Example:**
```javascript
// ENGINE-05: HSI cross-reference
async function crossRefHSI(conn) {
  return queryGraph(conn, `
    MATCH (c1:CausalClaim)-[:EXTRACTED_FROM]->(a1:Artifact)
          -[:HSI_CONNECTION]->(a2:Artifact)<-[:EXTRACTED_FROM]-(c2:CausalClaim)
    WHERE c1.id <> c2.id
    RETURN c1.id AS claim1, c2.id AS claim2, a1.id AS artifact1, a2.id AS artifact2
  `);
}
```

### Anti-Patterns to Avoid
- **Python writing to KuzuDB:** Python NEVER touches .lazygraph. CJS is the single writer. (Pitfall 4)
- **WALK semantics on causal queries:** Always use ACYCLIC for variable-length causal traversals in Cypher. (Pitfall 1)
- **Unbounded all_simple_paths:** Always use cutoff=6. Without cutoff, dense graphs cause combinatorial explosion.
- **Monolithic compute script:** Separate each ENGINE requirement into its own function. Don't chain them so tightly that one failure blocks all.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Path finding | Custom DFS/BFS | nx.all_simple_paths | Handles cutoff, yields generators, memory-efficient |
| Cycle detection | Custom cycle finder | nx.simple_cycles | Johnson's algorithm, correct for directed graphs |
| Centrality | Custom betweenness | nx.betweenness_centrality | O(VE) Brandes algorithm, handles disconnected graphs |
| Descendants | Custom traversal | nx.descendants | Returns full set, handles cycles gracefully |
| Graph copy | Manual dict copy | G.copy() | Proper deep copy of graph structure |

**Key insight:** Every algorithm in ENGINE-01 through ENGINE-08 maps directly to a single NetworkX function call. The engineering is in the JSON schema, the bridge, and the presentation -- not the algorithms.

## Common Pitfalls

### Pitfall 1: WALK Semantics on Cyclic Causal Graphs (CRITICAL)
**What goes wrong:** KuzuDB default variable-length path uses WALK semantics, which revisits nodes. Causal graphs can have cycles.
**Why it happens:** Developer writes `MATCH (a)-[:CAUSES*1..5]->(b)` without specifying ACYCLIC.
**How to avoid:** Always use `ACYCLIC` in Cypher: `MATCH (a)-[:CAUSES*1..5 ACYCLIC]->(b)`. Note: D-03 says "no ACYCLIC" for chain traversal -- this means use NetworkX (Python-side) for chain traversal, not Cypher. The ACYCLIC rule applies to any KuzuDB Cypher queries that DO use variable-length paths (e.g., cross-reference queries).
**Warning signs:** Query taking >5 seconds on <1000 nodes.

### Pitfall 2: Empty Graph Handling
**What goes wrong:** compute-causal.py crashes when room has zero CausalClaim nodes (no extraction done yet).
**Why it happens:** NetworkX functions error on empty graphs or missing nodes.
**How to avoid:** Check node count first. If 0 nodes, write empty results JSON and exit 0 (same as compute-hsi.py line 694-709).
**Warning signs:** Python traceback on fresh rooms.

### Pitfall 3: CAUSES Edges Between CausalClaim Nodes Don't Exist Yet
**What goes wrong:** Phase 53 created CausalClaim nodes and EXTRACTED_FROM edges, but CAUSES edges between CausalClaim nodes (CausalClaim->CausalClaim) don't exist in the schema. The CAUSES edge in lazygraph-ops.cjs is Artifact->Artifact.
**Why it happens:** The schema has `CAUSES(FROM Artifact TO Artifact)` but the engine needs `CAUSES(FROM CausalClaim TO CausalClaim)` for chain traversal.
**How to avoid:** Check if a new CAUSES_CLAIM edge table is needed (CausalClaim->CausalClaim), or if the engine should build the graph purely from CASCADES_TO edges (which ARE CausalClaim->CausalClaim). Recommendation: Use CASCADES_TO for cascade simulation (ENGINE-02). For chain traversal (ENGINE-01), the Python engine should infer causal chains by reading the claim data and building a NetworkX DiGraph from the domain/mechanism relationships, OR a new edge type needs to be created. **This is a critical gap to resolve in planning.**
**Warning signs:** exportCausalGraph() returns zero CAUSES edges between CausalClaims.

### Pitfall 4: Inversion Protocol Node Selection
**What goes wrong:** Inversion protocol (ENGINE-08) removes a node, but the user-specified claim ID doesn't exist in the graph.
**Why it happens:** Claim IDs are string-based, user may mistype.
**How to avoid:** Validate claim exists before removal. Return clear error message listing available claim IDs if not found.
**Warning signs:** KeyError in NetworkX when calling remove_node().

### Pitfall 5: Cross-Reference Queries Return Nothing
**What goes wrong:** ENGINE-05/06/07 Cypher queries return empty because EXTRACTED_FROM edges are missing (orphan CausalClaims).
**Why it happens:** Phase 53 extraction may have failed to create EXTRACTED_FROM edges for some claims.
**How to avoid:** Run an orphan detection query first: `MATCH (c:CausalClaim) WHERE NOT EXISTS { MATCH (c)-[:EXTRACTED_FROM]->() } RETURN c.id`. Warn if orphans found.
**Warning signs:** Cross-reference results always empty despite having claims and HSI data.

## Code Examples

### compute-causal.py Structure (follows compute-hsi.py exactly)
```python
#!/usr/bin/env python3
"""
compute-causal.py -- Causal Graph Engine
Usage: python3 scripts/compute-causal.py /path/to/room [--output path]
"""
import argparse
import json
import sys
from pathlib import Path
import networkx as nx

def load_causal_graph(room_dir):
    """Load .lazygraph-causal-export.json into NetworkX DiGraph."""
    export_path = Path(room_dir) / '.lazygraph-causal-export.json'
    if not export_path.exists():
        return nx.DiGraph(), {}
    data = json.loads(export_path.read_text('utf-8'))
    G = nx.DiGraph()
    node_data = {}
    for node in data.get('nodes', []):
        nid = node['c.id']
        G.add_node(nid)
        node_data[nid] = node
    for edge in data.get('causes_edges', []):
        G.add_edge(edge['a.id'], edge['b.id'], 
                   confidence=edge.get('r.confidence', 0.5))
    return G, node_data

def find_chains(G, source, target, cutoff=6):
    """ENGINE-01: All causal chains between source and target."""
    if source not in G or target not in G:
        return []
    return [list(p) for p in nx.all_simple_paths(G, source, target, cutoff=cutoff)]

def simulate_cascade(G, claim_id, node_data):
    """ENGINE-02: Cascade simulation with multiplicative confidence decay."""
    if claim_id not in G:
        return []
    descendants = nx.descendants(G, claim_id)
    results = []
    for desc in descendants:
        # Find shortest path to compute decay
        try:
            path = nx.shortest_path(G, claim_id, desc)
        except nx.NetworkXNoPath:
            continue
        # Multiplicative decay
        conf = node_data.get(claim_id, {}).get('c.confidence', 0.5)
        for i in range(len(path) - 1):
            edge_data = G.edges[path[i], path[i+1]]
            conf *= edge_data.get('confidence', 0.5)
        results.append({'claim_id': desc, 'residual_confidence': round(conf, 4), 
                        'hops': len(path) - 1})
    return sorted(results, key=lambda x: x['residual_confidence'])

def detect_bottlenecks(G, top_n=5):
    """ENGINE-03: High centrality + low out-degree = blocking bottleneck."""
    if len(G) < 2:
        return []
    bc = nx.betweenness_centrality(G)
    results = []
    for node, centrality in bc.items():
        out_deg = G.out_degree(node)
        results.append({'claim_id': node, 'centrality': round(centrality, 4), 
                        'out_degree': out_deg})
    # Sort by centrality desc, then out_degree asc (high centrality + low out = bottleneck)
    results.sort(key=lambda x: (-x['centrality'], x['out_degree']))
    return results[:top_n]

def detect_contradictions(G):
    """ENGINE-04: Circular reasoning = simple cycles in CAUSES subgraph."""
    return [list(cycle) for cycle in nx.simple_cycles(G)]

def inversion_protocol(G, target_node):
    """ENGINE-08: Remove node, find broken paths."""
    if target_node not in G:
        return {'error': f'Node {target_node} not found'}
    # Find all roots (nodes with in-degree 0)
    roots = [n for n in G.nodes() if G.in_degree(n) == 0]
    original_descendants = nx.descendants(G, target_node)
    G_copy = G.copy()
    G_copy.remove_node(target_node)
    broken = []
    for desc in original_descendants:
        if desc not in G_copy:
            continue
        reachable = False
        for root in roots:
            if root in G_copy and nx.has_path(G_copy, root, desc):
                reachable = True
                break
        if not reachable:
            broken.append(desc)
    return {'removed': target_node, 'broken_chains': broken, 
            'total_affected': len(broken)}

def main():
    parser = argparse.ArgumentParser(description='Causal graph engine')
    parser.add_argument('room_dir', help='Path to room directory')
    parser.add_argument('--output', default=None)
    # ... run all algorithms, write .causal-results.json
```

### exportCausalGraph() in lazygraph-ops.cjs
```javascript
// Source: follows hsi-to-kuzu.cjs open-use-close pattern
async function exportCausalGraph(roomDir) {
  const resolved = path.resolve(roomDir);
  const { db, conn } = await openGraph(resolved);
  try {
    const nodes = await queryGraph(conn,
      `MATCH (c:CausalClaim) RETURN c.id, c.cause, c.mechanism, c.effect, 
       c.confidence, c.domain, c.source_artifact`);
    const causesEdges = await queryGraph(conn,
      `MATCH (a:CausalClaim)-[r:CASCADES_TO]->(b:CausalClaim) 
       RETURN a.id AS source, b.id AS target, r.cascade_type, r.severity`);
    const exportData = {
      metadata: { exported_at: new Date().toISOString(), node_count: nodes.length, edge_count: causesEdges.length },
      nodes,
      edges: causesEdges
    };
    const exportPath = path.join(resolved, '.lazygraph-causal-export.json');
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf-8');
    return exportData;
  } finally {
    await closeGraph(db);
  }
}
```

### Cross-Reference Cypher Queries (CJS-side)
```javascript
// ENGINE-05: HSI cross-reference
async function crossRefCausalHSI(conn) {
  return queryGraph(conn, `
    MATCH (c1:CausalClaim)-[:EXTRACTED_FROM]->(a1:Artifact)
          -[h:HSI_CONNECTION]->(a2:Artifact)<-[:EXTRACTED_FROM]-(c2:CausalClaim)
    WHERE c1.id <> c2.id
    RETURN c1.id AS claim1, c2.id AS claim2, 
           a1.id AS artifact1, a2.id AS artifact2,
           h.hsi_score AS hsi_score, h.surprise_type AS surprise_type
  `);
}

// ENGINE-06: Reverse Salient cross-reference
async function crossRefCausalRS(conn) {
  return queryGraph(conn, `
    MATCH (c:CausalClaim)-[:EXTRACTED_FROM]->(a:Artifact)-[:BELONGS_TO]->(s1:Section)
          -[rs:REVERSE_SALIENT]->(s2:Section)
    RETURN c.id AS claim_id, s1.name AS source_section, s2.name AS target_section,
           rs.innovation_thesis AS thesis, rs.differential_score AS rs_score
  `);
}

// ENGINE-07: Analogy cross-reference
async function crossRefCausalAnalogy(conn) {
  return queryGraph(conn, `
    MATCH (c1:CausalClaim)-[:EXTRACTED_FROM]->(a1:Artifact)
          -[an:ANALOGOUS_TO]->(a2:Artifact)<-[:EXTRACTED_FROM]-(c2:CausalClaim)
    WHERE c1.id <> c2.id
    RETURN c1.id AS claim1, c2.id AS claim2,
           a1.id AS artifact1, a2.id AS artifact2,
           an.analogy_distance AS distance, an.structural_fitness AS fitness
  `);
}
```

## .causal-results.json Output Schema (D-10)
```json
{
  "metadata": {
    "timestamp": "2026-04-03T14:30:00Z",
    "room_dir": "/path/to/room",
    "node_count": 12,
    "edge_count": 18,
    "algorithms_run": ["chains", "cascades", "bottlenecks", "contradictions", "inversions"]
  },
  "chains": [
    {
      "source": "claim-001",
      "target": "claim-005",
      "paths": [["claim-001", "claim-003", "claim-005"]],
      "path_count": 1,
      "max_depth": 2
    }
  ],
  "cascades": [
    {
      "root_claim": "claim-001",
      "affected": [
        {"claim_id": "claim-003", "residual_confidence": 0.35, "hops": 1},
        {"claim_id": "claim-005", "residual_confidence": 0.175, "hops": 2}
      ],
      "total_affected": 2
    }
  ],
  "bottlenecks": [
    {"claim_id": "claim-003", "centrality": 0.45, "out_degree": 1, "in_degree": 4}
  ],
  "contradictions": [
    {"cycle": ["claim-002", "claim-006", "claim-002"], "length": 2}
  ],
  "inversions": [],
  "cross_refs": {
    "hsi": [{"claim1": "claim-001", "claim2": "claim-005", "hsi_score": 0.42}],
    "reverse_salients": [{"claim_id": "claim-003", "source_section": "problem-definition", "target_section": "solution-design"}],
    "analogies": []
  }
}
```

## .lazygraph-causal-export.json Schema (input to Python)
```json
{
  "metadata": {
    "exported_at": "2026-04-03T14:30:00Z",
    "node_count": 12,
    "edge_count": 18
  },
  "nodes": [
    {
      "c.id": "claim-001",
      "c.cause": "Etch chamber downtime costs $2-5M/year",
      "c.mechanism": "Qualification timelines create switching costs",
      "c.effect": "Semiconductor fabs adopt plasma-enhanced coatings",
      "c.confidence": 0.7,
      "c.domain": "materials",
      "c.source_artifact": "problem-definition/market-pain"
    }
  ],
  "edges": [
    {
      "source": "claim-001",
      "target": "claim-003",
      "cascade_type": "invalidation",
      "severity": "high"
    }
  ]
}
```

## Critical Design Decision: CAUSES vs CASCADES_TO for Chain Traversal

**The gap:** The current schema has `CAUSES(FROM Artifact TO Artifact)` and `CASCADES_TO(FROM CausalClaim TO CausalClaim)`. There is NO `CAUSES(FROM CausalClaim TO CausalClaim)` edge type. ENGINE-01 needs "because...because...because" chains between CausalClaim nodes.

**Resolution options:**
1. **Use CASCADES_TO for all Python-side graph algorithms** -- CASCADES_TO already connects CausalClaim->CausalClaim and semantically represents "if this is wrong, that is affected." The Python engine builds a DiGraph from CASCADES_TO edges. Chain traversal, cascade, bottleneck, contradiction, inversion all operate on this graph.
2. **Add a new CausalClaim-to-CausalClaim CAUSES edge** -- Would require schema migration in lazygraph-ops.cjs and changes to extraction logic in Phase 53.

**Recommendation:** Option 1. CASCADES_TO is the correct edge for the algorithms in this phase. The "because...because...because" chain IS a cascade chain -- "X is true BECAUSE Y is true BECAUSE Z is true" maps to "if Z falls, Y falls, X falls." The Python engine should treat CASCADES_TO edges as the causal chain for all ENGINE algorithms. This avoids schema changes and aligns with the existing D-04 decision.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Python kuzu bindings | JSON bridge (CJS exports, Python reads) | Phase 52 design | Avoids dual-writer corruption |
| Generic graph traversal | Bounded paths with cutoff=6 | D-03 | Prevents combinatorial explosion |
| WALK semantics (KuzuDB default) | ACYCLIC for Cypher, cutoff for NetworkX | Phase 52 research | Prevents infinite loops on cyclic graphs |

## Open Questions

1. **CASCADES_TO as the universal causal edge**
   - What we know: CASCADES_TO connects CausalClaim->CausalClaim, CAUSES connects Artifact->Artifact
   - What's unclear: Does the extraction pipeline (Phase 53) actually create CASCADES_TO edges between claims? Need to verify causal-to-kuzu.cjs writes CASCADES_TO edges.
   - Recommendation: Verify by checking if causal-to-kuzu.cjs or the extraction command creates CASCADES_TO edges. If not, the export function will need to infer edges from claim relationships.

2. **Chain traversal needs source AND target**
   - What we know: nx.all_simple_paths requires both source and target node
   - What's unclear: How does the user specify source/target? The command interface is Phase 56.
   - Recommendation: compute-causal.py should support both modes: (a) all chains from a specific source to all reachable nodes, (b) all chains between specific source-target pair. Use nx.descendants for mode (a), nx.all_simple_paths for mode (b).

3. **Bottleneck threshold values**
   - What we know: D-05 says "high centrality + low out-degree"
   - What's unclear: What are "high" and "low"? These depend on graph density.
   - Recommendation: Use relative thresholds -- top 5 by centrality where out_degree < median out_degree. Report all and let the presentation layer highlight the top results.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | compute-causal.py | yes | 3.x | -- |
| NetworkX | All graph algorithms | yes | 3.6.1 | -- |
| KuzuDB (npm) | Export/import bridge | yes | 0.11.3 | -- |
| Node.js | CJS bridge scripts | yes | >=18 | -- |

**Missing dependencies:** None. All dependencies already installed from previous phases.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual verification via CLI + Python unit assertions |
| Config file | none -- see Wave 0 |
| Quick run command | `python3 scripts/compute-causal.py /path/to/test-room` |
| Full suite command | `python3 scripts/compute-causal.py /path/to/test-room && node scripts/causal-results-to-kuzu.cjs /path/to/test-room` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENGINE-01 | Chain traversal returns paths | smoke | `python3 scripts/compute-causal.py test-room && python3 -c "import json; d=json.load(open('test-room/.causal-results.json')); assert len(d['chains'])>0"` | No Wave 0 |
| ENGINE-02 | Cascade shows multiplicative decay | smoke | `python3 -c "import json; d=json.load(open('test-room/.causal-results.json')); assert d['cascades'][0]['affected'][0]['residual_confidence']<1.0"` | No Wave 0 |
| ENGINE-03 | Bottleneck returns centrality scores | smoke | `python3 -c "import json; d=json.load(open('test-room/.causal-results.json')); assert len(d['bottlenecks'])>0"` | No Wave 0 |
| ENGINE-04 | Contradiction catches cycles | smoke | Requires test data with intentional cycle | No Wave 0 |
| ENGINE-05 | HSI cross-ref returns matches | smoke | `node -e "..."` with test room that has both HSI and causal data | No Wave 0 |
| ENGINE-06 | RS cross-ref returns matches | smoke | Same as above with RS data | No Wave 0 |
| ENGINE-07 | Analogy cross-ref returns matches | smoke | Same as above with analogy data | No Wave 0 |
| ENGINE-08 | Inversion shows broken chains | smoke | `python3 -c "import json; d=json.load(open('test-room/.causal-results.json')); assert 'inversions' in d"` | No Wave 0 |

### Sampling Rate
- **Per task commit:** `python3 scripts/compute-causal.py test-room`
- **Per wave merge:** Full pipeline: export -> compute -> import -> cross-reference
- **Phase gate:** All 8 ENGINE requirements produce non-empty results on test data

### Wave 0 Gaps
- [ ] Test room with CausalClaim nodes and CASCADES_TO edges (seed data)
- [ ] Test room with intentional cycle for contradiction detection
- [ ] Test room with both HSI pairs and causal claims for cross-reference validation

## Project Constraints (from CLAUDE.md)

- **CJS modules:** All Node.js code must be CommonJS (.cjs), not ESM
- **No TypeScript:** Plain CJS with JSDoc if needed
- **Single KuzuDB writer:** CJS is the only KuzuDB writer. Python writes JSON only.
- **Tri-Polar design:** Consider CLI, Desktop, and Cowork surfaces (Phase 54 is engine-only, presentation is Phase 56)
- **No new dependencies:** Zero new pip or npm installs
- **Error handling:** try/catch with fallback values, never crash the hook cascade
- **Release process:** CHANGELOG + plugin.json bump required on push (Phase 57 handles this)
- **MWP moat:** Every feature must deepen the 7-layer MWP integration. Phase 54 deepens Layers 5 (HSI) and 6 (Proactive Intelligence) by connecting causal reasoning to existing edge types.
- **No em-dashes:** Use hyphens instead (per user memory)

## Sources

### Primary (HIGH confidence)
- `scripts/compute-hsi.py` -- Reference Python engine pattern (read locally, 818 lines)
- `scripts/detect-reverse-salients.py` -- Cross-section analysis pattern (read locally, 243 lines)
- `lib/core/lazygraph-ops.cjs` -- CausalClaim schema, CRUD functions, export patterns (read locally, 760 lines)
- `scripts/hsi-to-kuzu.cjs` -- CJS bridge pattern (read locally, 171 lines)
- `scripts/causal-to-kuzu.cjs` -- Causal extraction bridge (read locally, 138 lines)
- `.planning/research/STACK-causal.md` -- NetworkX function signatures, verified locally
- `.planning/research/ARCHITECTURE-causal.md` -- Data flow patterns
- `.planning/research/PITFALLS-causal.md` -- Known pitfalls with mitigations
- NetworkX 3.6.1 -- verified `python3 -c "import networkx; print(networkx.__version__)"` returns 3.6.1

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md` -- ENGINE requirement definitions (success criteria)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all dependencies verified installed, all APIs confirmed working
- Architecture: HIGH -- follows existing patterns (compute-hsi.py, hsi-to-kuzu.cjs) exactly
- Pitfalls: HIGH -- PITFALLS-causal.md already documented; CAUSES vs CASCADES_TO gap identified from code review

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable -- no external dependency changes expected)
