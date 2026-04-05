# Architecture Patterns: v1.7.0 Causal Reasoning Layer

**Domain:** Causal graph engine for MindrianOS plugin
**Researched:** 2026-04-03

## Recommended Architecture

```
User writes artifact
  |
  v
post-write hook fires
  |
  v
HSI pipeline (existing) --> .hsi-results.json
  |
  v
Reverse Salient detection (existing) --> updates .hsi-results.json
  |
  v
Causal candidate flagging (NEW) --> .causal-candidates.json
  |
  v
Larry reviews candidates (LLM extraction) --> CausalClaim JSON
  |
  v
CJS bridge writes to KuzuDB (CausalClaim nodes + edges)
  |
  v
compute-causal.py (on demand or periodic)
  |- Chain traversal (nx.all_simple_paths)
  |- Cascade simulation (nx.descendants)
  |- Bottleneck detection (nx.betweenness_centrality)
  |- Contradiction detection (nx.simple_cycles)
  |
  v
.causal-results.json --> CJS bridge updates KuzuDB
  |
  v
Prediction generation --> room/.predictions/REGISTRY.json
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `lazygraph-ops.cjs` | CausalClaim CRUD, Cypher queries, schema init | KuzuDB (direct), Python scripts (JSON files) |
| `compute-causal.py` | NetworkX graph algorithms on exported causal graph | lazygraph-ops.cjs (via JSON intermediates) |
| `post-write` hook | Triggers causal candidate flagging after HSI + RS | compute-hsi.py, detect-reverse-salients.py, lazygraph-ops.cjs |
| Brain MCP | Causal framework selection, pattern matching, contradiction resolution | Neo4j Aura (remote), Larry skill (directives) |
| `/mos:causal` command | User-facing extract/trace/predict subcommands | lazygraph-ops.cjs, compute-causal.py, REGISTRY.json |
| `REGISTRY.json` | Prediction state, closed-loop learning | /mos:causal command, Larry proactive skill |

### Data Flow

1. **Extraction flow:** Artifact text -> Larry LLM extraction -> CausalClaim JSON -> CJS bridge -> KuzuDB
2. **Analysis flow:** KuzuDB export -> compute-causal.py (NetworkX) -> .causal-results.json -> CJS bridge -> KuzuDB updates
3. **Discovery flow:** KuzuDB Cypher joins CausalClaim + HSI_CONNECTION + REVERSE_SALIENT -> cross-domain discoveries
4. **Prediction flow:** CausalClaim chain -> falsifiable prediction -> REGISTRY.json -> deadline check -> resolution -> confidence update
5. **Brain flow:** Brain MCP query -> framework selection -> Larry directive -> extraction parameters

## Patterns to Follow

### Pattern 1: Python-JSON-CJS Bridge (Existing, Extend)
**What:** Python scripts read/write JSON files. CJS reads JSON and writes to KuzuDB.
**When:** Any computation that needs Python libraries (NetworkX, sklearn).
**Why:** Avoids Python-KuzuDB binding issues. KuzuDB npm package is the single writer.

```
# Python exports
scripts/compute-causal.py /path/to/room
  reads:  room/.lazygraph-causal-export.json
  writes: room/.causal-results.json

# CJS consumes
lazygraph-ops.cjs:importCausalResults(roomDir)
  reads:  room/.causal-results.json
  writes: KuzuDB CausalClaim nodes + edges
```

### Pattern 2: Semantic Layer Over Artifact Graph
**What:** CausalClaim nodes are extracted FROM Artifacts but form their own subgraph.
**When:** Any new node type that represents derived/semantic information.
**Why:** Keeps Artifact graph clean (structural) while adding semantic layers that can evolve independently.

```
Artifact Graph (structural):
  [market-pain.md] --HSI_CONNECTION--> [coating-mechanism.md]

Causal Layer (semantic):
  [downtime-cost-claim] --CAUSES--> [coating-adoption-claim]
        |                                    |
  EXTRACTED_FROM                       EXTRACTED_FROM
        |                                    |
  [market-pain.md]                   [coating-mechanism.md]
```

### Pattern 3: Idempotent Schema Evolution
**What:** All CREATE TABLE/REL statements use IF NOT EXISTS.
**When:** Every schema change.
**Why:** Users may have existing .lazygraph databases. Schema must evolve without destroying data.

```javascript
// In initSchema(), add after existing tables:
await conn.query(`CREATE NODE TABLE IF NOT EXISTS CausalClaim(...)`);
await conn.query(`CREATE REL TABLE IF NOT EXISTS CAUSES(...)`);
// Existing tables are untouched
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Causal Orchestrator
**What:** Single script that does extraction + analysis + prediction + visualization.
**Why bad:** Violates the cascade pattern. Can't run analysis without extraction. Can't test independently.
**Instead:** Separate scripts for each stage, connected through JSON intermediates and the post-write cascade.

### Anti-Pattern 2: Python Direct KuzuDB Writes
**What:** Having compute-causal.py write directly to KuzuDB via Python kuzu bindings.
**Why bad:** Two writers (Python + CJS) to same database = potential corruption. Python kuzu package not in requirements.
**Instead:** Python writes JSON. CJS is the single KuzuDB writer.

### Anti-Pattern 3: Storing Predictions in KuzuDB
**What:** Making predictions a node type in KuzuDB.
**Why bad:** Predictions have complex lifecycle (pending -> validated/invalidated -> confidence propagation). JSON is more flexible for this evolving schema. Predictions are also human-reviewable as files.
**Instead:** JSON registry file. Only the derived confidence updates go back to KuzuDB.

### Anti-Pattern 4: WALK Semantics for Causal Queries
**What:** Using default WALK path semantics in KuzuDB variable-length queries.
**Why bad:** Causal graphs can have cycles. WALK revisits nodes, causing infinite loops or exponential blowup.
**Instead:** Always use ACYCLIC for causal chain queries. Use WALK only when explicitly looking for cycles.

## Scalability Considerations

| Concern | At 50 claims | At 500 claims | At 5000 claims |
|---------|-------------|---------------|----------------|
| NetworkX in-memory | Trivial (<1ms) | Fine (<100ms) | Fine (<1s). NetworkX handles 100K+ nodes. |
| KuzuDB queries | Trivial | Fine with indexes | May need query optimization for cross-type joins |
| JSON export/import | Trivial | Fine (<1MB) | Consider pagination or streaming |
| Betweenness centrality | O(VE) ~instant | O(VE) <1s | O(VE) ~5-10s. Consider approximation (`k` parameter). |
| all_simple_paths | Depends on graph density | Use cutoff=6 | Use cutoff=4, may need sampling |
| REGISTRY.json | Trivial | Fine | Consider splitting by year or archiving resolved |
