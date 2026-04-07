# Architecture Patterns: Whitespace Mapping Integration (v1.9.0)

**Domain:** Whitespace detection integration with existing MindrianOS pipelines
**Researched:** 2026-04-07
**Overall confidence:** HIGH (based on direct reading of compute-hsi.py, detect-reverse-salients.py, hsi-to-kuzu.cjs, intelligence-cascade.cjs, lazygraph-ops.cjs, brain-client.cjs)

---

## 1. Where Does Whitespace Sit in the Post-Write Hook Chain?

Whitespace computation slots in as steps 9-10, AFTER all existing pipeline steps (including causal from v1.7.0), BEFORE presentation regeneration. The cascade grows by two steps following the proven compute-then-bridge pattern.

```
                    POST-WRITE CASCADE (intelligence-cascade.cjs)
                    =============================================

Write tool fires -> post-write hook -> mindrian-tools.cjs cascade
    |
    v
[1] classify-insight                          -- EXISTING
[2] graph index (graph-ops.cjs)               -- EXISTING
[3] compute-hsi.py                            -- EXISTING
    |    Side effect: .hsi-results.json + .hsi-embeddings.npy (NEW export)
[4] detect-reverse-salients.py                -- EXISTING
    |    Updates .hsi-results.json with reverse_salients
[5] hsi-to-kuzu.cjs                           -- EXISTING
[6] extract-causal-claims.py                  -- EXISTING (v1.7.0)
[7] causal-to-kuzu.cjs                        -- EXISTING (v1.7.0)
[8] cross-reference-causal.cjs                -- EXISTING (v1.7.0)
    |
    v
[9]  compute-whitespace.py        <-- NEW (reads .hsi-embeddings.npy + Brain baseline)
    |    Outputs: .whitespace-results.json
    v
[10] whitespace-to-kuzu.cjs       <-- NEW (writes WhitespaceZone nodes + edges)
    |
    v
    (presentation regeneration)               -- EXISTING
```

### Why This Position

1. **Embedding reuse.** compute-hsi.py (step 3) already calls `SentenceTransformer('all-MiniLM-L6-v2').encode(texts)`. A minimal modification exports the raw embedding matrix to `.hsi-embeddings.npy`. compute-whitespace.py loads this file -- zero recomputation, zero model reload.

2. **RS data dependency.** Whitespace zones downstream of reverse salients receive elevated strategic importance. RS data must exist in .hsi-results.json (populated at step 4) before whitespace reads it.

3. **Causal enrichment.** CausalClaim nodes in KuzuDB (populated at step 7) inform whitespace hypothesis generation -- "this causal link exists but the mechanism is unexplained" becomes a whitespace zone.

4. **Brain timing.** The consensus baseline from Brain Pinecone is fetched once per whitespace computation (not per artifact). Running last means room state is fully indexed before we compare against the baseline.

**Timing budget.** Steps 1-8 complete in ~5-8 seconds. Whitespace adds ~2-4 seconds: .npy load (~200ms), Brain HTTP call (~500-1500ms with 3s timeout), density estimation (~500ms), KuzuDB writes (~500ms). If Brain is unavailable (cold start or no key), whitespace completes in ~1 second. Total cascade stays under the 15-second hook timeout.

### Debounce Behavior

Whitespace inherits HSI's 30-second debounce. When HSI is debounced (same room written within 30s), whitespace ALSO skips because:
- No new .hsi-embeddings.npy was generated
- Artifact set hasn't changed
- Previous .whitespace-results.json is still valid

Implementation in intelligence-cascade.cjs: whitespace steps only execute when `hsiSuccess === true` (same guard pattern as RS detection at step 4).

---

## 2. How Do Whitespace Results Get Written to KuzuDB?

### New Node Table: WhitespaceZone

```cypher
CREATE NODE TABLE IF NOT EXISTS WhitespaceZone(
  id STRING PRIMARY KEY,
  label STRING,
  centroid_description STRING,
  density DOUBLE DEFAULT 0.0,
  strategic_importance DOUBLE DEFAULT 0.0,
  hypothesis STRING DEFAULT '',
  related_sections STRING DEFAULT '[]',
  discovery_method STRING DEFAULT 'density',
  brain_consensus_distance DOUBLE DEFAULT -1.0,
  created STRING DEFAULT ''
)
```

**Field semantics:**
- `id`: Deterministic hash from centroid coordinates (e.g., `WZ-a3f7b2`)
- `label`: Human-readable name from nearest artifact topics (e.g., "Regulatory - Reimbursement Gap")
- `density`: Normalized score (0.0 = empty void, 1.0 = fully covered)
- `strategic_importance`: 0-1 composite of density, RS proximity, and consensus distance
- `hypothesis`: What artifact SHOULD fill this zone
- `discovery_method`: `'density'` | `'topicforest'` | `'rs_downstream'` | `'analogy_gap'` | `'causal_mechanism'`
- `brain_consensus_distance`: Distance from Brain's expected coverage (-1.0 = Brain unavailable)

### New Edge Tables

```cypher
-- Which artifacts border this whitespace zone?
CREATE REL TABLE IF NOT EXISTS WHITESPACE_ADJACENT(
  FROM WhitespaceZone TO Artifact,
  distance DOUBLE DEFAULT 0.0,
  direction STRING DEFAULT ''
)

-- Which RS bottleneck makes this zone strategically important?
CREATE REL TABLE IF NOT EXISTS WHITESPACE_DOWNSTREAM(
  FROM WhitespaceZone TO Section,
  rs_opportunity_id STRING DEFAULT '',
  impact_score DOUBLE DEFAULT 0.0
)

-- Which Brain framework says "this topic should exist here"?
CREATE REL TABLE IF NOT EXISTS WHITESPACE_EXPECTED(
  FROM WhitespaceZone TO Artifact,
  brain_source STRING DEFAULT '',
  expected_framework STRING DEFAULT '',
  consensus_score DOUBLE DEFAULT 0.0
)
```

### Updated EDGE_TYPES in lazygraph-ops.cjs

```javascript
const EDGE_TYPES = [
  // ... existing 16 types ...
  'WHITESPACE_ADJACENT', 'WHITESPACE_DOWNSTREAM', 'WHITESPACE_EXPECTED'
];
```

### Bridge Script: whitespace-to-kuzu.cjs

Follows the exact hsi-to-kuzu.cjs pattern:
1. Read `.whitespace-results.json`
2. `openGraph(roomDir)` via lazygraph-ops
3. DELETE existing WhitespaceZone nodes and edges (fresh recomputation each run)
4. MERGE WhitespaceZone nodes from `whitespace_zones` array
5. Create WHITESPACE_ADJACENT edges to nearest Artifact nodes
6. Create WHITESPACE_DOWNSTREAM edges where RS overlap detected
7. Create WHITESPACE_EXPECTED edges where Brain consensus indicates missing coverage
8. `closeGraph(db)`
9. stderr summary: `WS: wrote N zone nodes, M adjacent edges, K downstream edges`

---

## 3. How Does Whitespace Use Existing MiniLM Embeddings?

### The Problem
compute-hsi.py already calls `SentenceTransformer('all-MiniLM-L6-v2').encode(texts)` (line 247). This produces a [N x 384] embedding matrix for N artifacts. Whitespace needs these exact embeddings. Recomputing wastes 2-3 seconds and loads an 80MB model twice.

### The Solution: Export + Import via .npy

**compute-hsi.py modification (minimal, ~10 lines):**

```python
# Module-level cache for downstream consumers
_last_embeddings = None

def compute_semantic_similarity_tier1(texts):
    global _last_embeddings
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        return None
    model = SentenceTransformer('all-MiniLM-L6-v2')
    embeddings = model.encode(texts, show_progress_bar=False)
    _last_embeddings = embeddings  # Cache for .npy export
    sim_matrix = cosine_similarity(embeddings)
    return np.clip(sim_matrix, 0.0, 1.0)

# In main(), after semantic matrix computation:
if _last_embeddings is not None:
    embedding_path = room_dir / '.hsi-embeddings.npy'
    np.save(str(embedding_path), _last_embeddings)
```

**compute-whitespace.py reads:**

```python
embedding_path = room_dir / '.hsi-embeddings.npy'
if embedding_path.exists():
    embeddings = np.load(str(embedding_path))
    # Verify shape matches artifact count
    if embeddings.shape[0] != len(artifacts):
        embeddings = None  # Stale, recompute
if embeddings is None:
    # Fallback: compute fresh (HSI was debounced or skipped)
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer('all-MiniLM-L6-v2')
    embeddings = model.encode(texts, show_progress_bar=False)
```

### Why MiniLM, Not llm-embedder

The prior research file suggested BAAI/llm-embedder (768-dim). This is WRONG for integration because:

1. **Anti-Pattern: Mixing embedding spaces.** HSI uses MiniLM (384-dim). Comparing MiniLM cosine similarities with llm-embedder distances is meaningless -- different semantic axes.
2. **Model size.** llm-embedder is ~440MB vs MiniLM's ~80MB. Doubles memory.
3. **Existing infrastructure.** MiniLM is already installed, loaded, and cached by HSI. Zero new dependencies.

Whitespace MUST use the same embedding model as HSI. If a future upgrade changes HSI's embedder, whitespace changes automatically (reads whatever .hsi-embeddings.npy contains).

### Cache Invalidation
`.hsi-embeddings.npy` is regenerated every time compute-hsi.py runs. The existing `.hsi-cache.json` content-hash mechanism ensures HSI only recomputes when artifacts actually change. When HSI is debounced, whitespace uses the previous .npy file -- correct because no artifacts changed.

---

## 4. How Does Brain Provide the Consensus Baseline?

### Constraint: Read-Only
Brain MCP is proprietary IP. Whitespace NEVER writes to Brain. It only reads via:
- `brain-client.cjs search(query)` -- Pinecone semantic search
- `brain-client.cjs query(cypher)` -- Neo4j Cypher queries

### Strategy: Topic-Seeded Semantic Search

**Step 1: Extract room topic keywords**
```python
# Parse STATE.md for domain, problem_type, frameworks_used
# Run TF-IDF on all room artifact text
# Take top 5 discriminative keywords
topic_keywords = extract_top_keywords(all_text, n=5)
```

**Step 2: Query Brain for consensus coverage**
```python
# For each keyword, find what Brain expects the room to cover
# Uses brain-client.cjs via subprocess (same pattern as causal extraction)
import subprocess, json

def brain_search(query, topK=5):
    """Call Brain via brain-client.cjs subprocess."""
    result = subprocess.run(
        ['node', '-e', f'''
          const brain = require("{plugin_root}/lib/core/brain-client.cjs");
          brain.search("{query}", {{ topK: {topK} }})
            .then(r => process.stdout.write(JSON.stringify(r)))
            .catch(() => process.stdout.write("null"));
        '''],
        capture_output=True, text=True, timeout=3
    )
    if result.stdout and result.stdout != 'null':
        return json.loads(result.stdout)
    return None

consensus_texts = []
for keyword in topic_keywords:
    result = brain_search(keyword, topK=5)
    if result and 'matches' in result:
        consensus_texts.extend([m.get('description', '') for m in result['matches']])
```

**Step 3: Build consensus embedding cloud**
```python
# Embed Brain descriptions using the SAME MiniLM model
# (model already loaded for fallback embedding)
consensus_embeddings = model.encode(consensus_texts)
# Shape: [M x 384] where M = number of Brain matches (up to 25)
```

**Step 4: Density estimation with consensus as evaluation points**
```python
# Fit KDE on room artifact embeddings (in reduced space)
# Evaluate density at Brain consensus positions
# Low density at consensus positions = whitespace zones
from sklearn.neighbors import BallTree

# Reduce dimensionality for density estimation (curse of dimensionality)
from sklearn.decomposition import PCA
pca = PCA(n_components=15)
reduced_room = pca.fit_transform(embeddings)
reduced_consensus = pca.transform(consensus_embeddings)

# Ball tree for efficient density queries
tree = BallTree(reduced_room)
# Count neighbors within radius for each consensus point
counts = tree.query_radius(reduced_consensus, r=radius, count_only=True)
# Low count = whitespace zone
```

### Why PCA, Not UMAP

The prior research suggested UMAP. PCA is better here because:
1. **Deterministic.** UMAP is stochastic -- different runs produce different layouts. Whitespace zone IDs would be unstable.
2. **No new dependency.** PCA is in sklearn (already installed for HSI). UMAP requires `umap-learn` (~100MB with dependencies).
3. **Speed.** PCA on 384-dim to 15-dim is ~10ms. UMAP is ~2-5 seconds.
4. **Sufficient.** We need density estimation, not visualization. PCA preserves enough structure for BallTree neighbor queries.

For 2D visualization in the dashboard, project from 15-dim PCA to 2D using the first two components. Not beautiful (PCA 2D is worse than UMAP 2D for visualization) but deterministic and free.

### Brain Unavailable (Tier 0)

If `brain-client.cjs search()` returns null (no API key, timeout, cold start):
- Skip consensus baseline entirely
- Run density estimation on room-only embeddings
- `brain_consensus_distance` set to -1.0 (sentinel)
- SemNovel scoring uses room centroid as reference instead of Brain
- Strategic importance drops consensus weight to 0
- Consistent with graceful degradation everywhere else in the plugin

### New Brain Query Patterns (references/brain/whitespace-patterns.md)

**Pattern 14: brain_whitespace_consensus**
```
Tool: brain_search
Parameters:
  query: $topic_keyword
  topK: 5
```
Returns framework/tool descriptions semantically related to the room's topic. These are "expected knowledge" for consensus baseline.

**Pattern 15: brain_topic_coverage**
```cypher
MATCH (f:Framework)-[:ADDRESSES_PROBLEM_TYPE]->(pt:ProblemType)
WHERE pt.name IN $room_problem_types
RETURN f.name AS framework,
       f.description AS description,
       f.category AS category
ORDER BY f.name
LIMIT 30
```
Returns all frameworks Brain associates with the room's problem type. Any framework in this list not represented in the room is a structural whitespace zone.

---

## 5. HSI -> Whitespace: What's BETWEEN Connected Artifacts?

HSI_CONNECTION edges link artifact pairs with high innovation differential. Whitespace finds the void between them:

```
Artifact A --[HSI_CONNECTION, hsi_score=0.72]--> Artifact B
                        |
                 [WhitespaceZone WZ-001]
                 "These artifacts are semantically connected
                  but nothing covers the bridging mechanism"
```

**Implementation:**
```python
# For each HSI pair with hsi_score > 0.5
for pair in hsi_pairs:
    if pair['hsi_score'] < 0.5:
        continue
    idx_a = artifact_id_to_index[pair['left_id']]
    idx_b = artifact_id_to_index[pair['right_id']]
    # Compute midpoint in embedding space
    midpoint = (embeddings[idx_a] + embeddings[idx_b]) / 2
    midpoint_reduced = pca.transform([midpoint])
    # Check density at midpoint
    count = tree.query_radius(midpoint_reduced, r=radius, count_only=True)
    if count[0] < density_threshold:
        # Whitespace zone between connected artifacts
        zones.append({
            'discovery_method': 'hsi_midpoint',
            'adjacent_artifacts': [pair['left_id'], pair['right_id']],
            'label': f"Gap between {pair['left_id']} and {pair['right_id']}"
        })
```

---

## 6. RS -> Whitespace: What's Downstream of Bottlenecks?

Reverse salients identify section pairs where innovation lags. Whitespace maps what SHOULD exist in the target section:

```
Section "problem-definition" --[REVERSE_SALIENT]--> Section "solution-design"
                                    |
                             [WhitespaceZone WZ-002]
                             discovery_method: 'rs_downstream'
                             strategic_importance: ELEVATED
```

**Implementation:**
```python
for rs in reverse_salients:
    target_section = rs['target_section']
    target_indices = [i for i, a in enumerate(artifacts) if a['section'] == target_section]
    if not target_indices:
        continue
    target_embeds = embeddings[target_indices]
    # Find sparse regions in target section's embedding subspace
    target_reduced = pca.transform(target_embeds)
    # Use wider radius -- section-level gaps are broader
    target_tree = BallTree(target_reduced)
    # Evaluate at consensus points filtered to this section's topics
    for cp_idx, cp in enumerate(reduced_consensus):
        count = target_tree.query_radius([cp], r=radius * 1.5, count_only=True)
        if count[0] < 1:
            zones.append({
                'discovery_method': 'rs_downstream',
                'rs_connection': rs['opportunity_id'],
                'related_sections': [target_section],
                'strategic_importance_boost': 0.3  # RS zones get +0.3 importance
            })
```

---

## 7. Analogy -> Whitespace: Unmapped Transfer Zones

ANALOGOUS_TO edges (from Design-by-Analogy) represent cross-domain analogies. Whitespace finds domains where the analogy SHOULD transfer but hasn't:

```
Artifact A --[ANALOGOUS_TO, transfer_map={"qual": ""}]--> Artifact B
                                    |
                         [WhitespaceZone WZ-003]
                         discovery_method: 'analogy_gap'
                         "Transfer map has unmapped elements"
```

**Implementation:** Query KuzuDB for ANALOGOUS_TO edges with incomplete transfer_map fields. Each unmapped source concept becomes a whitespace zone.

```javascript
// In whitespace-to-kuzu.cjs, query existing analogy edges
const analogies = await conn.query(
  `MATCH (a:Artifact)-[r:ANALOGOUS_TO]->(b:Artifact)
   WHERE r.transfer_map <> '{}'
   RETURN a.id, b.id, r.transfer_map, r.source_domain`
);
// Parse transfer_map, find keys with empty values -> analogy gap zones
```

### Causal -> Whitespace: Missing Mechanisms

CausalClaim nodes with empty `mechanism` fields or low confidence indicate causal assertions without explanatory depth:

```python
# Query: CausalClaims where mechanism is empty or confidence < 0.3
# These represent "we claim X causes Y but don't know HOW"
# Each becomes a whitespace zone with discovery_method = 'causal_mechanism'
```

---

## 8. How Does /mos:whitespace Invoke the Pipeline?

### Command Structure (commands/whitespace.md)

```yaml
---
name: whitespace
description: Map unexplored territory in your venture understanding
usage: /mos:whitespace [map|novelty|explore|fill|compare]
requires_room: true
---
```

### Subcommands

| Subcommand | Action |
|------------|--------|
| `map` | Display ranked whitespace zones with hypotheses |
| `novelty` | Display per-artifact SemNovel novelty scores |
| `explore [zone-id]` | Deep-dive with Brain-enriched suggestions |
| `fill [zone-id]` | Generate draft artifact to fill the gap |
| `compare [section]` | Show whitespace density by section |

### Invocation Flow

```
User: /mos:whitespace map
    |
    v
Command routes to skill handler
    |
    v
Check: .whitespace-results.json exists and < 5 min old?
    |-- YES --> Read and present
    |-- NO  --> node mindrian-tools.cjs whitespace-compute "${roomDir}"
    |           (runs compute-whitespace.py + whitespace-to-kuzu.cjs)
    |           Then read and present
    v
Larry presents findings:
    - Ranked whitespace zones with strategic importance
    - Per-zone: hypothesis, adjacent artifacts, discovery method
    - "You should explore [topic] because [reason]"
```

### mindrian-tools.cjs Extension

```javascript
case 'whitespace-compute': {
    const wsRoomDir = argv[1] || './room';
    const wsScript = path.join(SCRIPTS_DIR, 'compute-whitespace.py');
    execSync(`python3 "${wsScript}" "${wsRoomDir}"`, {
        timeout: 10000,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    const wsBridge = path.join(SCRIPTS_DIR, 'whitespace-to-kuzu.cjs');
    execSync(`node "${wsBridge}" "${wsRoomDir}"`, {
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'pipe']
    });
    // Read and output results
    const wsResults = JSON.parse(
        fs.readFileSync(path.join(wsRoomDir, '.whitespace-results.json'), 'utf8')
    );
    process.stdout.write(JSON.stringify(wsResults, null, 2));
    break;
}
```

---

## 9. How Do Whitespace Zones Appear in Dashboard/Presentation?

### Cytoscape.js Graph (Existing Dashboard)

WhitespaceZone nodes render as dashed-border diamonds in gold (De Stijl accent):

```javascript
// Add to dashboard graph style array
{
  selector: 'node[type="whitespace"]',
  style: {
    'border-style': 'dashed',
    'border-width': 2,
    'border-color': '#FFD700',  // De Stijl gold
    'background-color': 'rgba(255, 215, 0, 0.15)',
    'shape': 'diamond',
    'label': 'data(label)',
    'font-style': 'italic',
    'font-size': 10
  }
},
{
  selector: 'edge[type="WHITESPACE_ADJACENT"]',
  style: {
    'line-style': 'dashed',
    'line-color': '#FFD700',
    'opacity': 0.5,
    'width': 1
  }
}
```

### build-graph-from-kuzu.cjs Integration

The existing `scripts/build-graph-from-kuzu.cjs` reads KuzuDB and produces the graph JSON that Cytoscape renders. Add a query for WhitespaceZone nodes:

```javascript
// After existing Artifact and Section node queries:
const wsNodes = await conn.query(
  'MATCH (w:WhitespaceZone) RETURN w.id, w.label, w.density, w.strategic_importance'
);
// Add to graph JSON as nodes with type: 'whitespace'

const wsEdges = await conn.query(
  'MATCH (w:WhitespaceZone)-[r:WHITESPACE_ADJACENT]->(a:Artifact) RETURN w.id, a.id, r.distance'
);
// Add to graph JSON as edges with type: 'WHITESPACE_ADJACENT'
```

### Presentation Views

**generate-presentation.cjs** gains a "Whitespace Map" section:
- Section coverage heatmap (density per section, color-coded)
- Top 5 whitespace zones as investigation prompts
- Novelty leaderboard (most/least novel artifacts)

**generate-hub.cjs / generate-snapshot.cjs** gain a whitespace summary card:
- Zone count and top gap
- Strategic importance ranking

---

## Component Boundaries Summary

### New Files

| File | Type | Reads | Writes |
|------|------|-------|--------|
| `scripts/compute-whitespace.py` | Python | .hsi-results.json, .hsi-embeddings.npy, Brain (HTTP via subprocess) | .whitespace-results.json |
| `scripts/whitespace-to-kuzu.cjs` | CJS bridge | .whitespace-results.json | WhitespaceZone nodes + 3 edge types |
| `commands/whitespace.md` | Command | STATE.md, .whitespace-results.json | room artifacts (via /fill) |
| `references/brain/whitespace-patterns.md` | Reference | -- | -- |

### Modified Files (Existing)

| File | Change | Risk |
|------|--------|------|
| `scripts/compute-hsi.py` | Add `_last_embeddings` cache + .npy export (~10 lines) | LOW -- additive only, no logic change |
| `lib/core/intelligence-cascade.cjs` | Add steps 9-10 after causal block | LOW -- follows exact pattern of steps 6-8 |
| `lib/core/lazygraph-ops.cjs` | Add WhitespaceZone node table + 3 edge tables + EDGE_TYPES | LOW -- additive schema, idempotent CREATE IF NOT EXISTS |
| `scripts/build-graph-from-kuzu.cjs` | Add WhitespaceZone query to graph export | LOW -- additive |
| `skills/room-proactive/SKILL.md` | Add whitespace zone surface triggers | LOW -- text only |
| `references/brain/query-patterns.md` | Add patterns 14-15 | LOW -- text only |
| `scripts/compute-state` | Add whitespace summary to STATE.md | LOW -- additive section |

### Explicitly NOT Modified

| File | Reason |
|------|--------|
| `scripts/post-write` | Delegates to intelligence-cascade.cjs already |
| `scripts/detect-reverse-salients.py` | Consumed by whitespace, not modified |
| `scripts/hsi-to-kuzu.cjs` | Runs before whitespace, untouched |
| `hooks/hooks.json` | Hook routing unchanged |
| Brain MCP | Read-only constraint honored |

---

## .whitespace-results.json Schema

```json
{
  "metadata": {
    "timestamp": "2026-04-07T...",
    "room_dir": "/path/to/room",
    "artifact_count": 15,
    "zone_count": 4,
    "brain_available": true,
    "consensus_points": 12,
    "embedding_source": "hsi-embeddings.npy",
    "discovery_methods": {
      "density": 2,
      "topicforest": 1,
      "rs_downstream": 1,
      "hsi_midpoint": 0,
      "analogy_gap": 0,
      "causal_mechanism": 0
    }
  },
  "novelty_scores": [
    {
      "artifact_id": "problem-definition/market-gap",
      "novelty_score": 0.87,
      "consensus_distance": 0.72,
      "nearest_consensus": "Blue Ocean Strategy"
    }
  ],
  "whitespace_zones": [
    {
      "id": "WZ-a3f7b2",
      "label": "Regulatory Pathway - Reimbursement Gap",
      "density": 0.05,
      "strategic_importance": 0.92,
      "hypothesis": "Your room covers regulatory approval but has no artifact addressing reimbursement strategy...",
      "related_sections": ["solution-design", "business-model"],
      "discovery_method": "density",
      "brain_consensus_distance": 0.81,
      "adjacent_artifacts": ["solution-design/fda-510k", "business-model/pricing"],
      "rs_connection": null,
      "centroid_2d": [3.4, 2.1]
    }
  ],
  "section_coverage": {
    "problem-definition": { "density": 0.72, "artifact_count": 5, "zone_count": 0 },
    "solution-design": { "density": 0.45, "artifact_count": 3, "zone_count": 2 },
    "business-model": { "density": 0.23, "artifact_count": 2, "zone_count": 1 }
  },
  "topic_tree": {
    "clusters": [
      { "label": "Market Analysis", "depth": 0, "artifact_count": 5, "coverage": 0.8 },
      { "label": "Pricing Strategy", "depth": 1, "artifact_count": 0, "coverage": 0.0 }
    ]
  }
}
```

---

## Suggested Build Order

### Phase 1: Embedding Export (Foundation, Zero Risk)
- **Modify:** `scripts/compute-hsi.py` -- add _last_embeddings + .npy export
- **Test:** Run HSI, verify .npy file created, verify HSI results byte-identical
- **Dependencies:** None

### Phase 2: Core Whitespace Engine (Tier 0, Room-Only)
- **Create:** `scripts/compute-whitespace.py` -- density estimation, TopicForest, zone detection
- **Dependencies:** Phase 1 (.npy file)
- **No Brain, no KuzuDB, no integration yet** -- pure compute with JSON output
- **Test:** Run on test room, verify .whitespace-results.json

### Phase 3: KuzuDB Schema + Bridge
- **Modify:** `lib/core/lazygraph-ops.cjs` -- WhitespaceZone + 3 edge tables
- **Create:** `scripts/whitespace-to-kuzu.cjs` -- bridge writer
- **Dependencies:** Phase 2 (.whitespace-results.json)
- **Test:** Run bridge, verify KuzuDB contains zones

### Phase 4: Cascade Integration
- **Modify:** `lib/core/intelligence-cascade.cjs` -- add steps 9-10
- **Dependencies:** Phases 1-3
- **Test:** Write artifact to room, verify whitespace auto-computes

### Phase 5: Brain Consensus Baseline
- **Create:** `references/brain/whitespace-patterns.md`
- **Modify:** `scripts/compute-whitespace.py` -- add Brain search + consensus
- **Dependencies:** Phase 2 + brain-client.cjs (existing)
- **Test:** Run with Brain key, verify consensus_distance populated

### Phase 6: Cross-Pipeline Integration (HSI + RS + Analogy + Causal)
- **Modify:** `scripts/compute-whitespace.py` -- HSI midpoint, RS downstream, analogy gaps
- **Dependencies:** Phases 2-5 + existing pipeline results
- **Test:** Room with RS/Analogy edges shows enriched whitespace

### Phase 7: Command + Visualization
- **Create:** `commands/whitespace.md`
- **Modify:** Dashboard template, build-graph-from-kuzu.cjs, generate-presentation.cjs
- **Dependencies:** Phases 1-6
- **Test:** /mos:whitespace map shows zones; dashboard renders diamond nodes

### Phase 8: SemNovel Novelty Scoring
- **Modify:** `scripts/compute-whitespace.py` -- per-artifact novelty
- **Dependencies:** Phase 5 (consensus baseline needed for meaningful novelty)
- **Test:** /mos:whitespace novelty ranks artifacts by distance from consensus

---

## Anti-Patterns to Avoid

### 1. Writing to Brain
Brain is read-only IP. All whitespace data lives in room-local KuzuDB.

### 2. Recomputing Embeddings
Read .hsi-embeddings.npy. Only fallback to fresh SentenceTransformer if file missing.

### 3. Using a Different Embedding Model
Prior research suggested llm-embedder (768-dim). This MUST NOT be done. Whitespace must use the same MiniLM (384-dim) as HSI to ensure embedding space compatibility.

### 4. UMAP for Density Estimation
Prior research suggested UMAP. Use PCA instead: deterministic, no new dependency, sufficient for density queries. UMAP is stochastic and adds umap-learn (~100MB).

### 5. KDE in Raw 384-dim Space
Curse of dimensionality makes KDE meaningless above ~15 dimensions. PCA reduce to 15-dim first, then BallTree/KDE.

### 6. Running on Session Start
Model load + embedding + density = 5-15s. Too slow for session-start. Whitespace runs in the post-write cascade (already backgrounded) or via explicit `/mos:whitespace` command.

### 7. Creating Zones for Empty Rooms
Minimum 3 artifacts to trigger whitespace computation. Below that, everything is whitespace by definition.

---

## Scalability

| Concern | 10 artifacts | 50 artifacts | 200 artifacts |
|---------|-------------|-------------|---------------|
| .npy file size | ~15 KB | ~75 KB | ~300 KB |
| PCA + BallTree time | ~50ms | ~200ms | ~800ms |
| Brain consensus calls | 5 calls, ~1.5s | 5 calls, ~1.5s | 5 calls, ~1.5s |
| WhitespaceZone nodes | 2-5 | 5-15 | 15-30 |
| Total step 9-10 time | ~2s | ~2.5s | ~3.5s |

Brain calls are topic-count-limited (5), not artifact-count-limited. Embedding load from .npy scales linearly. PCA + BallTree scale well to hundreds of artifacts.

---

## Sources

- Existing codebase (all verified via direct file reading):
  - `scripts/compute-hsi.py` -- MiniLM embedding, spectral OM-HMM, cache pattern [HIGH]
  - `scripts/detect-reverse-salients.py` -- RS detection, scoring [HIGH]
  - `scripts/hsi-to-kuzu.cjs` -- bridge writer pattern [HIGH]
  - `scripts/causal-to-kuzu.cjs` -- bridge writer with node creation [HIGH]
  - `lib/core/intelligence-cascade.cjs` -- full cascade flow, debounce, batch [HIGH]
  - `lib/core/lazygraph-ops.cjs` -- KuzuDB schema, EDGE_TYPES, initSchema [HIGH]
  - `lib/core/brain-client.cjs` -- Brain HTTP client, search(), query() [HIGH]
  - `references/brain/query-patterns.md` -- 13 existing patterns [HIGH]
  - `.planning/research/ARCHITECTURE-causal.md` -- cascade extension precedent [HIGH]
- sklearn.neighbors.BallTree, sklearn.decomposition.PCA -- standard libraries [HIGH]
- Huan He et al., SemNovel (JBI 2025) -- novelty scoring via embedding distance [MEDIUM, paper confirmed but implementation details from training]
- Huan He et al., TopicForest (JBI 2025) -- hierarchical gap detection [MEDIUM, same]
