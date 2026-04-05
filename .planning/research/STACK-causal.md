# Stack Research: v1.7.0 Causal Reasoning Layer

**Domain:** Causal graph engine additions to existing MindrianOS plugin
**Researched:** 2026-04-03
**Overall confidence:** HIGH

## Key Insight: Zero New Dependencies Required

The causal reasoning layer needs NO new Python or Node packages. NetworkX 3.6.1 (already installed) provides every graph algorithm needed. KuzuDB 0.11.3 (already installed via npm) supports all required node/edge types including temporal properties. The work is schema extension + new Python scripts + Cypher patterns, not dependency management.

---

## 1. NetworkX Graph Algorithms for Causal Engine

**Status:** NetworkX 3.6.1 already installed, all functions verified working.
**Confidence:** HIGH (tested locally, official API)

### Required Functions (all verified present in nx 3.6.1)

| Function | Purpose in Causal Engine | Signature |
|----------|--------------------------|-----------|
| `nx.all_simple_paths(G, source, target, cutoff=None)` | Trace all causal chains between two CausalClaim nodes | Returns generator of paths |
| `nx.betweenness_centrality(G, weight=None)` | Identify bottleneck CausalClaims (Hughes reverse salient) | Returns dict {node: centrality} |
| `nx.simple_cycles(G)` | Detect circular reasoning / feedback loops | Returns generator of cycles |
| `nx.is_directed_acyclic_graph(G)` | Validate causal graph is a DAG (or flag cycles) | Returns bool |
| `nx.has_path(G, source, target)` | Quick check if causal chain exists between two claims | Returns bool |
| `nx.descendants(G, node)` | Forward cascade: everything downstream of a claim | Returns set |
| `nx.ancestors(G, node)` | Backward trace: everything upstream of a claim | Returns set |
| `nx.shortest_path(G, source, target, weight=None)` | Shortest causal path between claims | Returns list |
| `nx.topological_sort(G)` | Order causal claims by dependency (for DAGs) | Returns iterator |
| `nx.dag_longest_path(G)` | Deepest causal chain in the graph | Returns list |

### Algorithm Mapping to v1.7.0 Features

**Chain traversal** (`/mos:causal trace`):
```python
# Find all causal chains from claim A to claim B
chains = list(nx.all_simple_paths(G, claim_a, claim_b, cutoff=6))
# cutoff=6 prevents combinatorial explosion in dense graphs
```

**Cascade simulation** (`/mos:causal cascade`):
```python
# If claim X is invalidated, what falls?
downstream = nx.descendants(G, claim_x)
# Each downstream node is a potentially invalidated assumption
```

**Bottleneck detection** (Hughes reverse salient integration):
```python
bc = nx.betweenness_centrality(G, weight='confidence')
# Nodes with high betweenness are structural bottlenecks
# These are the claims that, if wrong, break the most chains
bottlenecks = sorted(bc.items(), key=lambda x: x[1], reverse=True)[:5]
```

**Contradiction detection** (cycle = circular reasoning):
```python
cycles = list(nx.simple_cycles(G))
# Each cycle is a set of claims that form circular reasoning
# Flag for user review: "A causes B causes C causes A"
```

**Inversion protocol** (what-if analysis):
```python
# Invert a claim: what if the opposite is true?
# Remove node, check which paths break
G_copy = G.copy()
G_copy.remove_node(inverted_claim)
for target in original_descendants:
    if not nx.has_path(G_copy, root, target):
        # This target is now unreachable -- cascade break
        broken_chains.append(target)
```

### Script Architecture

New script: `scripts/compute-causal.py`
- Follows existing pattern: reads JSON from KuzuDB export, runs NetworkX algorithms, outputs JSON
- Input: `room/.lazygraph-causal-export.json` (exported by CJS bridge)
- Output: `room/.causal-results.json` (consumed by CJS bridge to write back to KuzuDB)
- Integrated into post-write cascade: HSI -> RS -> Causal cross-reference

### What NOT to Use

| Library | Why Not |
|---------|---------|
| `igraph` | Heavier C dependency, no advantage over NetworkX for <10K node graphs |
| `graph-tool` | Requires C++ compilation, overkill for our scale |
| `snap.py` | Dead project, last updated 2019 |

---

## 2. KuzuDB Schema Extension for CausalClaim Nodes

**Status:** KuzuDB 0.11.3 (Node.js) supports all required data types.
**Confidence:** HIGH (verified from official docs)

### New Node Table: CausalClaim

```cypher
CREATE NODE TABLE IF NOT EXISTS CausalClaim(
  id STRING PRIMARY KEY,
  cause STRING,
  mechanism STRING,
  effect STRING,
  confidence DOUBLE DEFAULT 0.5,
  falsifiable_prediction STRING DEFAULT '',
  novelty_score DOUBLE DEFAULT 0.0,
  domain STRING DEFAULT '',
  source_artifact STRING DEFAULT '',
  extracted_at TIMESTAMP DEFAULT current_timestamp(),
  status STRING DEFAULT 'active',
  validated BOOLEAN DEFAULT false
)
```

**Design decisions:**
- `id` is STRING (not SERIAL) to match Artifact pattern: `section/claim-slug`
- `mechanism` is the "because" -- the HOW, not just the WHAT. This is the Three Gaps requirement (Duraisamy 2025): every claim needs a mechanism.
- `falsifiable_prediction` stores the testable prediction derived from this claim. Empty until user or Larry generates one.
- `novelty_score` is populated by the causal engine after cross-referencing with existing claims.
- `status` enum: 'active' | 'invalidated' | 'validated' | 'superseded'
- `extracted_at` uses KuzuDB's native TIMESTAMP with `current_timestamp()` default. Verified: KuzuDB supports TIMESTAMP in ISO-8601 format and `current_timestamp()` as default value function.

### New Edge Tables

```cypher
-- Direct causal relationship: X causes Y
CREATE REL TABLE IF NOT EXISTS CAUSES(
  FROM CausalClaim TO CausalClaim,
  confidence DOUBLE DEFAULT 0.5,
  mechanism STRING DEFAULT '',
  evidence_type STRING DEFAULT 'asserted'
)

-- Cascade: if X changes, Y is affected (weaker than CAUSES)
CREATE REL TABLE IF NOT EXISTS CASCADES_TO(
  FROM CausalClaim TO CausalClaim,
  cascade_type STRING DEFAULT 'direct',
  strength DOUBLE DEFAULT 0.5
)

-- Provenance: which artifact was this claim extracted from?
CREATE REL TABLE IF NOT EXISTS EXTRACTED_FROM(
  FROM CausalClaim TO Artifact,
  extraction_method STRING DEFAULT 'llm',
  extracted_at TIMESTAMP DEFAULT current_timestamp()
)
```

**Edge design rationale:**
- CAUSES is directional and typed: `evidence_type` = 'asserted' | 'observed' | 'tested' | 'contradicted'
- CASCADES_TO is weaker than CAUSES -- it means "if X changes, Y might need revision" without asserting direct causation
- EXTRACTED_FROM links back to source artifacts for provenance. This is critical for the Three Gaps framework: every claim must be traceable to evidence.
- `cascade_type` = 'direct' | 'indirect' | 'conditional' -- allows the cascade simulation to weight paths differently

### Cypher Query Patterns for Causal Operations

**Pattern 1: Trace full causal chain (variable-length path)**
```cypher
-- KuzuDB Kleene star syntax for variable-length paths
-- Find all causal chains from claim A up to 5 hops deep
MATCH (start:CausalClaim {id: $start_id})-[:CAUSES*1..5]->(end:CausalClaim)
RETURN start.id, end.id, end.cause, end.effect
```

**Pattern 2: Cascade impact analysis**
```cypher
-- What gets affected if this claim is invalidated?
-- Uses ACYCLIC semantic to prevent infinite loops
MATCH (root:CausalClaim {id: $claim_id})-[:CASCADES_TO*1..10 ACYCLIC]->(affected:CausalClaim)
RETURN affected.id, affected.cause, affected.effect, affected.confidence
ORDER BY affected.confidence DESC
```

**Pattern 3: Cross-reference causal claims with HSI connections**
```cypher
-- Discovery query: find where causal claims intersect with HSI surprise connections
MATCH (c1:CausalClaim)-[:EXTRACTED_FROM]->(a1:Artifact)
      -[:HSI_CONNECTION]->(a2:Artifact)<-[:EXTRACTED_FROM]-(c2:CausalClaim)
WHERE c1.domain <> c2.domain
RETURN c1.cause, c2.effect, a1.section, a2.section
```

**Pattern 4: Find bottleneck claims (high fan-out)**
```cypher
-- Claims that many others depend on
MATCH (bottleneck:CausalClaim)<-[:CAUSES]-(upstream:CausalClaim)
WITH bottleneck, COUNT(upstream) AS in_degree
MATCH (bottleneck)-[:CAUSES]->(downstream:CausalClaim)
WITH bottleneck, in_degree, COUNT(downstream) AS out_degree
WHERE in_degree + out_degree > 3
RETURN bottleneck.id, bottleneck.cause, in_degree, out_degree
ORDER BY in_degree + out_degree DESC
```

**Pattern 5: Provenance chain -- from prediction back to source artifact**
```cypher
MATCH (claim:CausalClaim {falsifiable_prediction: $prediction})
      -[:EXTRACTED_FROM]->(artifact:Artifact)
      -[:BELONGS_TO]->(section:Section)
RETURN claim.id, claim.cause, claim.mechanism, claim.effect,
       artifact.title, section.name
```

**Pattern 6: Find claims with cross-section causal links (REVERSE_SALIENT integration)**
```cypher
MATCH (c1:CausalClaim)-[:EXTRACTED_FROM]->(a1:Artifact)-[:BELONGS_TO]->(s1:Section)
      -[:REVERSE_SALIENT]->(s2:Section)<-[:BELONGS_TO]-(a2:Artifact)
      <-[:EXTRACTED_FROM]-(c2:CausalClaim)
WHERE c1 <> c2
RETURN s1.name, s2.name, c1.cause, c2.effect
```

### KuzuDB Path Semantics (Important)

KuzuDB supports three path semantics for variable-length patterns:
- **WALK** (default): nodes and edges can be revisited. Use for general exploration.
- **TRAIL**: edges cannot be revisited but nodes can. Use for cascade simulation.
- **ACYCLIC**: neither nodes nor edges can be revisited. Use for causal chain extraction to prevent circular reasoning paths.

For causal queries, **always use ACYCLIC** unless explicitly looking for cycles:
```cypher
MATCH p = (start:CausalClaim)-[:CAUSES*1..5 ACYCLIC]->(end:CausalClaim)
RETURN p
```

### Schema Integration with Existing LazyGraph

The CausalClaim node table is ADDITIONAL, not replacing Artifact or Section. The bridge is EXTRACTED_FROM edges linking CausalClaim -> Artifact. This means:

1. Existing INFORMS, CONTRADICTS, CONVERGES, HSI_CONNECTION, REVERSE_SALIENT edges continue to work on Artifacts
2. CausalClaim is a semantic layer ON TOP of the artifact graph
3. One Artifact can have multiple CausalClaims extracted from it
4. Cross-referencing is done through join queries (Pattern 3 above)

Update `EDGE_TYPES` array in lazygraph-ops.cjs:
```javascript
const EDGE_TYPES = [
  // Existing
  'INFORMS', 'CONTRADICTS', 'CONVERGES', 'ENABLES', 'INVALIDATES',
  'BELONGS_TO', 'REASONING_INFORMS', 'HSI_CONNECTION', 'REVERSE_SALIENT',
  'ANALOGOUS_TO', 'STRUCTURALLY_ISOMORPHIC', 'RESOLVES_VIA',
  // New causal edges
  'CAUSES', 'CASCADES_TO', 'EXTRACTED_FROM'
];
```

---

## 3. Neo4j Brain Graph Enrichment Patterns

**Status:** Neo4j Aura (remote, accessed via Brain MCP at brain.mindrian.ai)
**Confidence:** MEDIUM (patterns are standard Neo4j Cypher but need Brain schema verification)

### New Edge Types for Brain

These edges connect EXISTING Framework nodes in the Brain. No new node types needed.

```cypher
// FEEDS_INTO: Framework A's output feeds Framework B's input
// Directional chain: Root Cause Analysis -> Systems Thinking -> Causal Loop Diagrams
CREATE (rca:Framework {name: 'Root Cause Analysis'})
       -[:FEEDS_INTO {
         output_type: 'identified_causes',
         input_type: 'system_variables',
         confidence: 0.9,
         typical_sequence: 1
       }]->
       (st:Framework {name: 'Systems Thinking'})

// Full FEEDS_INTO chain
MATCH (rca:Framework {name: 'Root Cause Analysis'})
MATCH (st:Framework {name: 'Systems Thinking'})
MATCH (cld:Framework {name: 'Causal Loop Diagrams'})
MATCH (sa:Framework {name: 'Scenario Analysis'})
CREATE (rca)-[:FEEDS_INTO {output_type: 'identified_causes', typical_sequence: 1}]->(st)
CREATE (st)-[:FEEDS_INTO {output_type: 'system_model', typical_sequence: 2}]->(cld)
CREATE (cld)-[:FEEDS_INTO {output_type: 'feedback_loops', typical_sequence: 3}]->(sa)

// CO_OCCURS: Frameworks frequently used together (bidirectional)
MATCH (rca:Framework {name: 'Root Cause Analysis'})
MATCH (sth:Framework {name: 'Six Thinking Hats'})
CREATE (rca)-[:CO_OCCURS {
  frequency: 'high',
  reason: 'parallel perspectives on root causes',
  evidence: 'classroom_observation'
}]->(sth)
CREATE (sth)-[:CO_OCCURS {frequency: 'high', reason: 'parallel perspectives on root causes'}]->(rca)

// TYPICAL_AT: Framework is most effective at a venture stage
// Stages: discovery, problem_definition, solution_design, validation, scaling
MATCH (f:Framework {name: 'Root Cause Analysis'})
CREATE (f)-[:TYPICAL_AT {
  effectiveness: 0.9,
  reason: 'Most valuable when problem is ill-defined'
}]->(:VentureStage {name: 'problem_definition'})

// VALIDATES: Hypothesis-testing frameworks validate causal claims
MATCH (ht:Framework {name: 'Hypothesis Tree'})
MATCH (cr:Concept {name: 'Causal Reasoning'})
CREATE (ht)-[:VALIDATES {
  validation_type: 'falsification',
  mechanism: 'decompose_and_test'
}]->(cr)
```

### New Brain Node: "Theory of Change" Framework

```cypher
CREATE (toc:Framework {
  name: 'Theory of Change',
  description: 'Forward causal reasoning: if we do X, then Y, leading to Z',
  category: 'causal_reasoning',
  direction: 'forward',
  complementary_to: 'Root Cause Analysis',
  key_question: 'What chain of outcomes connects your actions to your intended impact?',
  typical_stages: ['problem_definition', 'solution_design', 'validation']
})
```

### New Brain Node: "Causal Reasoning" Parent Concept

```cypher
CREATE (cr:Concept {
  name: 'Causal Reasoning',
  description: 'The family of frameworks for understanding cause-effect relationships in ventures',
  category: 'meta_concept'
})

// Connect all causal frameworks to the parent
MATCH (cr:Concept {name: 'Causal Reasoning'})
MATCH (f:Framework)
WHERE f.name IN ['Root Cause Analysis', 'Systems Thinking', 'Causal Loop Diagrams',
                  'Scenario Analysis', 'Theory of Change', 'Reverse Salient']
CREATE (f)-[:BELONGS_TO]->(cr)
```

### Brain Query Patterns 11-13 (New)

```cypher
// Pattern 11: causal_framework_select
// Given a problem type and venture stage, which causal framework fits?
MATCH (f:Framework)-[:BELONGS_TO]->(:Concept {name: 'Causal Reasoning'})
MATCH (f)-[:TYPICAL_AT]->(s:VentureStage {name: $stage})
MATCH (f)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType {name: $problem_type})
RETURN f.name, f.key_question
ORDER BY s.effectiveness DESC

// Pattern 12: causal_pattern_match
// Given a causal claim, find similar patterns in the Brain
MATCH (f:Framework)-[:BELONGS_TO]->(:Concept {name: 'Causal Reasoning'})
MATCH (f)-[:CO_OCCURS]-(related:Framework)
WHERE f.name = $framework_name
RETURN related.name, related.key_question

// Pattern 13: causal_contradiction_resolve
// When two causal claims contradict, which framework resolves?
MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(:ProblemType {name: 'contradiction'})
MATCH (f)-[:FEEDS_INTO*0..2]->(resolver:Framework)
RETURN f.name, resolver.name, f.key_question
```

---

## 4. Prediction Registry JSON Schema

**Status:** Custom schema design for `room/.predictions/REGISTRY.json`
**Confidence:** HIGH (JSON schema is well-understood; design follows existing room JSON patterns)

### Schema Design

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Prediction Registry",
  "description": "Tracks falsifiable predictions derived from causal claims",
  "type": "object",
  "required": ["version", "predictions"],
  "properties": {
    "version": { "const": "1.0.0" },
    "room": { "type": "string" },
    "last_updated": { "type": "string", "format": "date-time" },
    "predictions": {
      "type": "array",
      "items": { "$ref": "#/$defs/prediction" }
    },
    "summary": {
      "type": "object",
      "properties": {
        "total": { "type": "integer" },
        "pending": { "type": "integer" },
        "validated": { "type": "integer" },
        "invalidated": { "type": "integer" },
        "accuracy_rate": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    }
  },
  "$defs": {
    "prediction": {
      "type": "object",
      "required": ["id", "statement", "source_claim_id", "created_at", "status"],
      "properties": {
        "id": {
          "type": "string",
          "description": "Unique prediction ID: pred-{YYYYMMDD}-{4-char-hash}"
        },
        "statement": {
          "type": "string",
          "description": "The falsifiable prediction in natural language"
        },
        "source_claim_id": {
          "type": "string",
          "description": "ID of the CausalClaim this prediction derives from"
        },
        "causal_chain": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Ordered list of CausalClaim IDs forming the chain"
        },
        "created_at": {
          "type": "string",
          "format": "date-time"
        },
        "deadline": {
          "type": "string",
          "format": "date-time",
          "description": "When this prediction should be checkable"
        },
        "status": {
          "type": "string",
          "enum": ["pending", "validated", "invalidated", "expired", "superseded"]
        },
        "resolution": {
          "type": "object",
          "properties": {
            "resolved_at": { "type": "string", "format": "date-time" },
            "outcome": { "type": "string", "enum": ["correct", "incorrect", "partial", "inconclusive"] },
            "evidence": { "type": "string" },
            "resolved_by": { "type": "string", "description": "Artifact ID containing resolution evidence" },
            "confidence_delta": {
              "type": "number",
              "description": "How much to adjust source claim confidence (-1 to +1)"
            }
          }
        },
        "tags": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Domain tags for grouping: ['market', 'technical', 'regulatory']"
        },
        "novelty_score": {
          "type": "number",
          "minimum": 0,
          "maximum": 10,
          "description": "How novel/non-obvious this prediction is (from causal engine)"
        }
      }
    }
  }
}
```

### Example REGISTRY.json Instance

```json
{
  "version": "1.0.0",
  "room": "synteris",
  "last_updated": "2026-04-03T14:30:00Z",
  "predictions": [
    {
      "id": "pred-20260403-a1b2",
      "statement": "Semiconductor fabs will adopt plasma-enhanced coatings within 18 months because etch chamber downtime costs $2-5M/year and qualification timelines create switching costs",
      "source_claim_id": "solution-design/semiconductor-coating-moat",
      "causal_chain": [
        "problem-definition/etch-chamber-downtime",
        "solution-design/plasma-coating-mechanism",
        "solution-design/semiconductor-coating-moat"
      ],
      "created_at": "2026-04-03T14:30:00Z",
      "deadline": "2027-10-03T00:00:00Z",
      "status": "pending",
      "resolution": null,
      "tags": ["market", "semiconductor", "adoption"],
      "novelty_score": 7.2
    }
  ],
  "summary": {
    "total": 1,
    "pending": 1,
    "validated": 0,
    "invalidated": 0,
    "accuracy_rate": 0
  }
}
```

### Closed-Loop Learning Mechanism

When a prediction is resolved:
1. `confidence_delta` propagates back to the source CausalClaim's `confidence` field in KuzuDB
2. All CASCADES_TO edges downstream of the resolved claim get their `strength` adjusted
3. If prediction was wrong, Larry surfaces: "Your assumption about X was incorrect. This affects these downstream claims: [list]"
4. Summary stats update for the room's overall prediction accuracy

This creates Tetlock-style calibration: users (and Larry) learn which types of causal claims are reliable vs. overconfident.

---

## 5. Causal Graph Visualization

**Recommendation: Do NOT add any visualization library. Use existing infrastructure.**
**Confidence:** HIGH

### Why No New Library

| Library Evaluated | Why Not |
|-------------------|---------|
| `causalgraph` (v0.1.1) | Requires owlready2 (OWL ontology library), heavy dependency for simple visualization. Last release Dec 2023 -- low maintenance. |
| `CausalNex` | Requires PyTorch or TensorFlow for Bayesian networks. Massive dependency. Needs tabular data for structure learning. |
| `WordGraph` | Academic, Jupyter-only, not suited for CLI output |
| `dag_tools` | Jupyter widget, not CLI-compatible |
| `graphviz` (Python) | Requires system graphviz installation. Not guaranteed on user machines. |

### What to Use Instead

The plugin already has TWO visualization paths that work:

1. **De Stijl HTML export** (v4.0, Phase 25): Cytoscape.js graph visualization in browser. Add causal nodes/edges as a new layer with distinct styling (red edges for CAUSES, orange for CASCADES_TO).

2. **ASCII graph in terminal** (existing CLI UI): For `/mos:causal trace` output, render causal chains as indented text:
```
semiconductor-coating-moat
  BECAUSE: plasma-coating-mechanism [confidence: 0.8]
    BECAUSE: etch-chamber-downtime [confidence: 0.9]
      EXTRACTED_FROM: problem-definition/market-pain.md
  PREDICTION: "Fabs adopt within 18 months" [status: pending]
```

3. **NetworkX -> JSON -> Cytoscape** pipeline: NetworkX can export to `node_link_data()` format which is directly consumable by Cytoscape.js in the existing De Stijl dashboard.

```python
import networkx as nx
import json

# Export causal subgraph for visualization
data = nx.node_link_data(causal_graph)
with open('room/.causal-viz.json', 'w') as f:
    json.dump(data, f)
```

This JSON is picked up by the existing De Stijl dashboard renderer with zero new dependencies.

---

## 6. Requirements File Update

Add to `requirements-hsi.txt` (rename to `requirements.txt` or create `requirements-causal.txt`):

```
# Existing (unchanged)
scikit-learn>=1.3.0
numpy>=1.24.0
sentence-transformers>=2.2.0

# Already installed, pin for clarity
networkx>=3.2.0
```

NetworkX is already installed (3.6.1) as a dependency of the HSI pipeline. Just pin it explicitly.

**No new pip installs needed. No new npm installs needed.**

---

## Summary: What Changes, What Doesn't

### Changes (New Code)

| Component | Type | Location |
|-----------|------|----------|
| CausalClaim node table | KuzuDB schema | `lib/core/lazygraph-ops.cjs` (add to `initSchema`) |
| CAUSES, CASCADES_TO, EXTRACTED_FROM edges | KuzuDB schema | `lib/core/lazygraph-ops.cjs` (add to `initSchema`) |
| `compute-causal.py` | New Python script | `scripts/compute-causal.py` |
| Causal export/import bridge | CJS functions | `lib/core/lazygraph-ops.cjs` (new functions) |
| Prediction registry | JSON file | `room/.predictions/REGISTRY.json` |
| Post-write causal hook | Hook extension | `scripts/post-write` (add causal step after RS) |
| Brain enrichment Cypher | One-time migration | Brain admin script or MCP mutation |
| `/mos:causal` command | New command | `commands/mos-causal.md` |

### No Changes (Existing)

| Component | Why Unchanged |
|-----------|---------------|
| NetworkX | Already installed (3.6.1), all functions available |
| KuzuDB (npm) | Already installed (0.11.3), supports all needed types |
| sklearn/numpy | Unchanged, still used by HSI |
| sentence-transformers | Unchanged, still used by HSI |
| Post-write cascade | Extended, not replaced |
| De Stijl dashboard | Extended with causal layer, not rebuilt |

### Alternatives Considered

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| Graph algorithms | NetworkX 3.6.1 | igraph, graph-tool | Already installed; igraph needs C; graph-tool needs C++ |
| Causal viz | Existing Cytoscape.js + ASCII | causalgraph, graphviz | New deps for marginal gain; Cytoscape already renders graphs |
| Temporal props | KuzuDB TIMESTAMP | External time-series DB | KuzuDB handles timestamps natively; no need for separate store |
| Prediction storage | JSON file | SQLite, KuzuDB node | JSON matches existing room patterns (.hsi-results.json); human-readable; git-trackable |
| Causal lib | NetworkX raw | DoWhy, pgmpy, causal-learn | All require DataFrames/tabular data; our data is text/graph |

---

## Sources

- KuzuDB data types: [KuzuDB Data Types](https://docs.kuzudb.com/cypher/data-types/)
- KuzuDB CREATE TABLE: [KuzuDB Create Table](https://docs.kuzudb.com/cypher/data-definition/create-table/)
- KuzuDB MATCH patterns: [KuzuDB Match](https://docs.kuzudb.com/cypher/query-clauses/match/)
- KuzuDB recursive functions: [KuzuDB Recursive Rel Functions](https://docs.kuzudb.com/cypher/expressions/recursive-rel-functions/)
- NetworkX 3.x documentation: verified locally via `python3 -c "import networkx"` (v3.6.1)
- Neo4j Cypher patterns: [Neo4j Cypher Cheat Sheet](https://neo4j.com/docs/cypher-cheat-sheet/25/all/)
- causalgraph package: [GitHub - causalgraph](https://github.com/causalgraph/causalgraph) (evaluated, rejected)
- CausalNex: [CausalNex Docs](https://causalnex.readthedocs.io/en/latest/01_introduction/01_introduction.html) (evaluated, rejected)
