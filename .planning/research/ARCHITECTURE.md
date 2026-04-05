# Architecture Patterns: Causal Reasoning Layer (v1.7.0)

**Domain:** Causal reasoning integration for MindrianOS Plugin
**Researched:** 2026-04-03
**Overall confidence:** HIGH (based on deep reading of existing codebase)

## Recommended Architecture

The causal layer integrates through the existing post-write cascade, adding one Python computation step and one CJS bridge writer -- the same pattern used by HSI and Reverse Salient detection. No new orchestrator. No new hooks. The cascade grows by one step.

```
                    POST-WRITE CASCADE (existing hook)
                    =================================

Write tool fires
    |
    v
[1] graph index (mindrian-tools.cjs graph index)     -- EXISTING
    |
    v
[2] compute-hsi.py                                    -- EXISTING
    |
    v
[3] detect-reverse-salients.py                        -- EXISTING
    |
    v
[4] hsi-to-kuzu.cjs                                   -- EXISTING
    |
    v
[5] extract-causal-claims.py          <-- NEW (reads .hsi-results.json + artifact text)
    |
    v
[6] causal-to-kuzu.cjs                <-- NEW (writes CausalClaim nodes + edges)
    |
    v
[7] cross-reference-causal.cjs        <-- NEW (links CausalClaims to HSI/RS/Analogy edges)
    |
    v
    (presentation regeneration)                        -- EXISTING
```

### Why AFTER HSI, Not Before or In Parallel

Causal extraction MUST run after HSI + RS for three reasons:

1. **Data dependency.** The cross-reference step (7) needs HSI_CONNECTION and REVERSE_SALIENT edges to already exist in KuzuDB. It links CausalClaims to these edges, creating the unified discovery graph. Running in parallel would race against hsi-to-kuzu.cjs.

2. **Enrichment, not duplication.** HSI computes statistical similarity (TF-IDF/SVD + embeddings). Causal extraction is semantic (LLM-driven or regex pattern matching). They answer different questions. HSI asks "what is surprisingly similar?" Causal asks "what claims cause what?" The causal step enriches HSI results with mechanism reasoning.

3. **Spectral metadata reuse.** extract-causal-claims.py can read the spectral OM-HMM profiles from .hsi-results.json to score causal claim confidence -- artifacts with high integrative thinking (fast Markov mixing) are more likely to contain genuine causal reasoning vs. mere correlation.

**Timing budget.** The existing HSI + RS + KuzuDB write completes in ~2-4 seconds for a typical room. Adding causal extraction + write + cross-reference should add ~1-2 seconds (Tier 0 regex) or ~3-5 seconds (Tier 1 LLM). Total cascade stays under the hook timeout because the entire HSI block already runs in a background subshell (the `( ... ) &` in post-write line 101-117).

---

## Component Boundaries

### New Files

| File | Type | Talks To | Reads | Writes |
|------|------|----------|-------|--------|
| `scripts/extract-causal-claims.py` | Python | Reads artifacts + .hsi-results.json | room/*.md, .hsi-results.json | .causal-claims.json |
| `scripts/causal-to-kuzu.cjs` | CJS bridge | KuzuDB via lazygraph-ops | .causal-claims.json | CausalClaim nodes, CAUSES/CASCADES_TO/EXTRACTED_FROM edges |
| `scripts/cross-reference-causal.cjs` | CJS bridge | KuzuDB via lazygraph-ops | KuzuDB (reads existing HSI/RS/Analogy edges) | CONVERGES_WITH edges linking CausalClaim to HSI/RS |
| `scripts/causal-graph-engine.py` | Python | NetworkX | .causal-claims.json + KuzuDB export | .causal-analysis.json (chains, cascades, bottlenecks) |
| `commands/causal.md` | Command | Larry, KuzuDB, Brain MCP | room/STATE.md, .causal-claims.json, .causal-analysis.json | room artifacts, .predictions/ |
| `references/brain/causal-patterns.md` | Reference | Brain MCP query patterns | -- | -- |
| `scripts/seed-brain-causal.cjs` | Admin script | Brain MCP (brain_write) | -- | Neo4j FEEDS_INTO/CO_OCCURS/TYPICAL_AT edges |

### Modified Files

| File | Change | Why |
|------|--------|-----|
| `scripts/post-write` | Add causal extraction + bridge steps after hsi-to-kuzu.cjs | Extend the cascade |
| `lib/core/lazygraph-ops.cjs` | Add CausalClaim node table, 4 new edge tables to schema, extend EDGE_TYPES array | KuzuDB schema evolution |
| `skills/room-proactive/SKILL.md` | Add causal signal detection triggers | Surface causal discoveries |
| `skills/brain-connector/SKILL.md` | Add causal Brain query patterns 11-13 reference | Brain enrichment |
| `references/brain/query-patterns.md` | Add patterns 11, 12, 13 | Causal framework selection, pattern match, contradiction resolve |
| `scripts/compute-state` | Add prediction summary section | STATE.md includes prediction counts |

---

## Data Flow

### Flow 1: Post-Write Cascade (Automatic)

```
User writes artifact to room/
    |
    v
post-write hook fires
    |
    v
[Existing] graph index -> compute-hsi.py -> detect-rs.py -> hsi-to-kuzu.cjs
    |
    v
[NEW] extract-causal-claims.py
    Input: room/*.md artifacts, .hsi-results.json (spectral profiles)
    Process:
      - Tier 0: Regex extraction of "because", "causes", "leads to",
        "results in", "enables", "prevents", "if...then" patterns
      - Tier 1 (if deps available): LLM-assisted extraction via
        structured prompt returning JSON CausalClaim objects
      - Score confidence using spectral OM-HMM profile of source artifact
      - Deduplicate against existing .causal-claims.json (content hash)
    Output: .causal-claims.json
    |
    v
[NEW] causal-to-kuzu.cjs
    Input: .causal-claims.json
    Process:
      - Open KuzuDB via lazygraph-ops openGraph()
      - MERGE CausalClaim nodes (cause, mechanism, effect, confidence,
        falsifiable_prediction, novelty_score, domain)
      - Create EXTRACTED_FROM edges to source Artifact nodes
      - Create CAUSES edges between CausalClaim nodes (chain detection)
      - Create CASCADES_TO edges for multi-hop chains
      - Close graph
    Output: KuzuDB updated
    |
    v
[NEW] cross-reference-causal.cjs
    Input: KuzuDB (reads CausalClaim + HSI_CONNECTION + REVERSE_SALIENT + ANALOGOUS_TO)
    Process:
      - For each CausalClaim, find HSI_CONNECTION edges involving the
        same source artifact (EXTRACTED_FROM -> Artifact -> HSI_CONNECTION)
      - For each CausalClaim, find REVERSE_SALIENT edges involving the
        same section
      - Create CONVERGES_WITH edges linking CausalClaim to related
        HSI/RS/Analogy edges (via shared artifacts/sections)
      - Score convergence strength: claims that appear in HSI surprise
        pairs AND reverse salient zones get elevated novelty scores
    Output: KuzuDB updated with cross-reference edges
```

### Flow 2: /mos:causal Command (User-Initiated)

```
User: /mos:causal extract "semiconductor qualification"
    |
    v
Larry reads room/STATE.md + .causal-claims.json
    |
    v
Larry extracts causal claims from specified topic area
(LLM-driven, not just regex -- deeper than automatic extraction)
    |
    v
Writes structured artifact to room/problem-definition/ or room/solution-design/
    |
    v
post-write cascade fires automatically (Flow 1)

---

User: /mos:causal trace "qualification timeline"
    |
    v
causal-graph-engine.py runs:
    - Load .causal-claims.json into NetworkX directed graph
    - Traverse CAUSES chains from specified concept
    - Compute betweenness centrality (Hughes bottleneck detection)
    - Identify cascade paths (longest chains, branching points)
    - Export .causal-analysis.json
    |
    v
Larry presents the chain: "X BECAUSE Y BECAUSE Z"
    - Highlights bottleneck nodes (high betweenness centrality)
    - Shows where chains cross section boundaries
    - Identifies assumption nodes (low confidence, high impact)

---

User: /mos:causal predict "geometry advantage"
    |
    v
Larry generates falsifiable prediction:
    - Reads causal chain for the concept
    - Applies Three Gaps framework (Abstraction, Reasoning, Reality)
    - Generates prediction with timeline, metric, threshold
    |
    v
Writes to room/.predictions/REGISTRY.json:
    {
      "id": "PRED-0001",
      "claim": "Geometry-enabled qualification reduces time by 40%",
      "metric": "Qualification cycle time (days)",
      "threshold": "< 180 days (vs. 300 day baseline)",
      "deadline": "2026-09-01",
      "status": "open",
      "causal_chain": ["CC-003", "CC-007", "CC-012"],
      "created": "2026-04-03",
      "outcome": null,
      "outcome_date": null
    }
```

### Flow 3: Brain Enrichment (Admin-Only Write)

```
Admin setup script (one-time, not per-user):
    |
    v
brain_write via MCP (requires admin API key):
    |
    v
Create FEEDS_INTO chain in Neo4j:
    Root Cause Analysis -[FEEDS_INTO]-> Systems Thinking
    Systems Thinking -[FEEDS_INTO]-> Causal Loop Diagrams
    Causal Loop Diagrams -[FEEDS_INTO]-> Scenario Analysis
    |
    v
Create CO_OCCURS edges:
    Root Cause Analysis -[CO_OCCURS]-> Six Thinking Hats
    Systems Thinking -[CO_OCCURS]-> Reverse Salient
    |
    v
Create "Causal Reasoning" parent Concept node:
    (concept:Concept {name: "Causal Reasoning"})
    -[CONTAINS]-> Root Cause Analysis
    -[CONTAINS]-> Systems Thinking
    -[CONTAINS]-> Causal Loop Diagrams
    -[CONTAINS]-> Scenario Analysis
    -[CONTAINS]-> Theory of Change (NEW framework node)
    |
    v
Create TYPICAL_AT stage mappings:
    Root Cause Analysis -[TYPICAL_AT]-> Pre-Opportunity
    Systems Thinking -[TYPICAL_AT]-> Discovery
    Theory of Change -[TYPICAL_AT]-> Design
    Scenario Analysis -[TYPICAL_AT]-> Investment
    |
    v
Brain query patterns 11-13 now have graph structure to traverse
```

---

## KuzuDB Schema Extension

### New Node Table: CausalClaim

```sql
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
  created STRING DEFAULT ''
)
```

### New Edge Tables

```sql
-- CausalClaim causes another CausalClaim (direct chain)
CREATE REL TABLE IF NOT EXISTS CAUSES(
  FROM CausalClaim TO CausalClaim,
  strength DOUBLE DEFAULT 0.5,
  mechanism STRING DEFAULT ''
)

-- CausalClaim cascades through multiple hops
CREATE REL TABLE IF NOT EXISTS CASCADES_TO(
  FROM CausalClaim TO CausalClaim,
  hop_count INT64 DEFAULT 1,
  path_confidence DOUBLE DEFAULT 0.0
)

-- CausalClaim was extracted from an Artifact
CREATE REL TABLE IF NOT EXISTS EXTRACTED_FROM(
  FROM CausalClaim TO Artifact,
  extraction_method STRING DEFAULT 'regex',
  sentence_index INT64 DEFAULT 0
)

-- CausalClaim converges with an HSI/RS/Analogy discovery
-- (cross-reference bridge edge)
CREATE REL TABLE IF NOT EXISTS CONVERGES_WITH(
  FROM CausalClaim TO Artifact,
  convergence_type STRING DEFAULT 'hsi',
  convergence_score DOUBLE DEFAULT 0.0,
  via_edge_type STRING DEFAULT ''
)
```

### Design Decision: CONVERGES_WITH Target

CONVERGES_WITH points FROM CausalClaim TO Artifact (not to edges directly, because KuzuDB cannot create edges between edges). The `via_edge_type` property records which edge type created the convergence (HSI_CONNECTION, REVERSE_SALIENT, or ANALOGOUS_TO). The `convergence_score` is computed by cross-reference-causal.cjs based on how many edge types converge on the same artifact pair.

---

## Cross-Reference Step: How It Works

This is the key integration point. cross-reference-causal.cjs performs three joins:

### Join 1: CausalClaim <-> HSI_CONNECTION

```cypher
// Find CausalClaims whose source artifact also appears in HSI surprise pairs
MATCH (cc:CausalClaim)-[:EXTRACTED_FROM]->(a:Artifact)-[hsi:HSI_CONNECTION]->(b:Artifact)
WHERE hsi.hsi_score > 0.4
RETURN cc.id AS claim_id, a.id AS artifact_a, b.id AS artifact_b,
       hsi.hsi_score, hsi.surprise_type
```

When a causal claim is extracted from an artifact that ALSO has a high HSI surprise connection, the claim gets a novelty boost. The causal mechanism explains WHY the HSI surprise exists.

### Join 2: CausalClaim <-> REVERSE_SALIENT

```cypher
// Find CausalClaims in sections that are reverse salient targets
MATCH (cc:CausalClaim)-[:EXTRACTED_FROM]->(a:Artifact)-[:BELONGS_TO]->(s:Section)
MATCH (s)<-[:REVERSE_SALIENT]-(s2:Section)
RETURN cc.id AS claim_id, s.name AS bottleneck_section,
       s2.name AS advancing_section
```

When a causal claim exists in a section identified as a reverse salient (bottleneck), the claim identifies the causal mechanism behind the bottleneck. This is Hughes (1983) made computational.

### Join 3: CausalClaim <-> ANALOGOUS_TO

```cypher
// Find CausalClaims whose source artifact has cross-domain analogies
MATCH (cc:CausalClaim)-[:EXTRACTED_FROM]->(a:Artifact)-[an:ANALOGOUS_TO]->(b:Artifact)
RETURN cc.id AS claim_id, a.id AS source, b.id AS analogy_target,
       an.analogy_distance, an.source_domain
```

When a causal claim has an analogous connection, the causal mechanism might transfer across domains. This is the highest-novelty finding: "This works BECAUSE X, and the same mechanism operates in [other domain]."

### Convergence Scoring

```
convergence_score = (
    0.4 * (hsi_match ? hsi_score : 0)
  + 0.35 * (rs_match ? rs_differential_score : 0)
  + 0.25 * (analogy_match ? structural_fitness : 0)
)
```

Claims that appear in all three (HSI surprise + reverse salient zone + analogy target) are the highest-value discoveries. These are the claims Larry should surface proactively.

---

## Unified Discovery: Cypher Query Patterns

### Pattern: Walk from CausalClaim through all edge types

```cypher
// THE unified discovery query
// Finds causal claims that connect to HSI surprises, reverse salients,
// AND cross-domain analogies in a single traversal
MATCH (cc:CausalClaim)-[:EXTRACTED_FROM]->(a:Artifact)
OPTIONAL MATCH (a)-[hsi:HSI_CONNECTION]->(b:Artifact)
  WHERE hsi.hsi_score > 0.4
OPTIONAL MATCH (a)-[:BELONGS_TO]->(s:Section)<-[rs:REVERSE_SALIENT]-(s2:Section)
OPTIONAL MATCH (a)-[an:ANALOGOUS_TO]->(c:Artifact)
WITH cc, a,
     collect(DISTINCT {target: b.id, score: hsi.hsi_score, type: hsi.surprise_type}) AS hsi_hits,
     collect(DISTINCT {bottleneck: s.name, advancing: s2.name, diff: rs.differential_score}) AS rs_hits,
     collect(DISTINCT {analogy: c.id, distance: an.analogy_distance, domain: an.source_domain}) AS analogy_hits
WHERE size(hsi_hits) > 0 OR size(rs_hits) > 0 OR size(analogy_hits) > 0
RETURN cc.id AS claim_id,
       cc.cause AS cause,
       cc.mechanism AS mechanism,
       cc.effect AS effect,
       cc.confidence AS confidence,
       cc.novelty_score AS novelty,
       a.id AS source_artifact,
       hsi_hits, rs_hits, analogy_hits,
       size(hsi_hits) + size(rs_hits) + size(analogy_hits) AS convergence_count
ORDER BY convergence_count DESC, cc.novelty_score DESC
LIMIT 10
```

### Pattern: Trace a causal chain with bottleneck detection

```cypher
// Follow CAUSES chain from a starting claim, marking bottlenecks
MATCH path = (start:CausalClaim)-[:CAUSES*1..5]->(end:CausalClaim)
WHERE start.id = $start_claim_id
WITH path, nodes(path) AS chain_nodes
UNWIND chain_nodes AS node
OPTIONAL MATCH (node)-[:EXTRACTED_FROM]->(a:Artifact)-[:BELONGS_TO]->(s:Section)
OPTIONAL MATCH (s)<-[:REVERSE_SALIENT]-(s2:Section)
RETURN [n IN chain_nodes | n.id] AS chain,
       [n IN chain_nodes | n.cause + ' -> ' + n.effect] AS chain_readable,
       length(path) AS chain_length,
       collect(DISTINCT s.name) AS sections_touched,
       count(DISTINCT s2) AS bottleneck_count
ORDER BY chain_length DESC
LIMIT 5
```

### Pattern: Find causal claims that explain HSI surprises

```cypher
// For a given HSI surprise pair, find causal claims that explain it
MATCH (a:Artifact)-[hsi:HSI_CONNECTION]->(b:Artifact)
WHERE hsi.hsi_score > $min_score
MATCH (cc:CausalClaim)-[:EXTRACTED_FROM]->(a)
RETURN a.id AS artifact_a, b.id AS artifact_b,
       hsi.hsi_score, hsi.surprise_type,
       cc.id AS explaining_claim,
       cc.cause, cc.mechanism, cc.effect
ORDER BY hsi.hsi_score DESC
LIMIT 10
```

---

## /mos:causal Command: Larry Integration

### Decision: disable-model-invocation = FALSE

The /mos:causal command should NOT use `disable-model-invocation: true`. Rationale:

1. **Causal extraction is inherently LLM work.** Unlike /mos:root-cause which guides users through a structured framework, /mos:causal extract needs Larry to reason about cause-effect relationships in the user's specific domain. This requires model intelligence, not just template filling.

2. **Larry's personality adds value.** The "because...because...because" chain presentation is Larry's teaching voice. Disabling model invocation would reduce it to data dump.

3. **Brain enrichment requires tool calls.** The causal command needs Brain MCP tools for framework selection (pattern 11), pattern matching (pattern 12), and contradiction resolution (pattern 13).

### Command Definition

```yaml
---
name: causal
description: Trace cause-effect chains, detect assumption cascades, and track predictions
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
  - mcp__mindrian-brain__brain_ask
  - mcp__mindrian-brain__brain_query
---
```

### Subcommands

| Subcommand | What Larry Does | Tools Used |
|------------|----------------|------------|
| `extract [topic]` | Deep causal extraction from room artifacts on topic | Read (artifacts), Brain (framework selection), Write (artifact) |
| `trace [concept]` | Run causal-graph-engine.py, present chain with bottlenecks | Bash (python3 causal-graph-engine.py), Read (.causal-analysis.json) |
| `predict [claim]` | Generate falsifiable prediction from causal chain | Read (chain), Brain (Three Gaps), Write (.predictions/REGISTRY.json) |

### Larry JTBD Triggers (for room-proactive skill)

| Signal | Larry Says |
|--------|-----------|
| 3+ causal claims form a chain | "You've got assumptions stacked 3-deep here. `/mos:causal trace` to see the chain." |
| CausalClaim in reverse salient zone | "Your [section] bottleneck has a causal explanation now. `/mos:causal trace [concept]`" |
| CausalClaim + HSI surprise + analogy | "This is a triple convergence -- causal mechanism, HSI surprise, AND cross-domain match. `/mos:causal extract [topic]` to dig deeper." |
| Prediction deadline approaching | "You have a prediction expiring in [N] days. Time to check: `/mos:causal predict --review`" |

---

## Prediction Tracking: Room Lifecycle Integration

### File Structure

```
room/
  .predictions/
    REGISTRY.json     -- All predictions with status
    HISTORY.json      -- Outcome log (append-only)
```

### Lifecycle Events

| Event | What Happens | Who Triggers |
|-------|-------------|-------------|
| Prediction created | Written to REGISTRY.json with status: "open" | /mos:causal predict |
| SessionStart | Check REGISTRY for predictions within 7 days of deadline | session-start hook |
| Larry reminds | "You have N open predictions approaching deadline" | room-proactive skill |
| User resolves | Updates status to "confirmed" or "refuted" with evidence | /mos:causal predict --review |
| Room export | Prediction track record included in thesis/report | generate-export.cjs |

### STATE.md Reference

The compute-state script should be extended to include a prediction summary:

```markdown
## Predictions

| Active | Approaching | Confirmed | Refuted |
|--------|-------------|-----------|---------|
| 3      | 1           | 2         | 1       |
```

This is a lightweight addition: compute-state reads .predictions/REGISTRY.json and counts statuses.

### Prediction Checking: Not Automatic

Predictions are NOT automatically confirmed or refuted. The user must provide evidence. Larry's job is to REMIND and ASK, not to judge. This follows Decision 12 (Assumptions are first-class entities) -- the user decides, the decision becomes graph data.

---

## Brain Enrichment Architecture

### What Happens in Neo4j (Admin Script)

A one-time seed script (`scripts/seed-brain-causal.cjs`) runs via `brain_write` MCP tool with admin key. It creates:

1. **FEEDS_INTO chains** between causal frameworks (directional dependency)
2. **CO_OCCURS edges** between commonly-used-together frameworks
3. **Concept node** "Causal Reasoning" as parent
4. **Framework node** "Theory of Change" (new, fills the forward-causal gap)
5. **TYPICAL_AT edges** mapping each framework to venture stages
6. **VALIDATES edges** linking Falsifiability and Hypothesis Tree to causal family

### What Users Get (via brain_ask / brain_query)

Three new query patterns in `references/brain/causal-patterns.md`:

**Pattern 11: causal_framework_select**
Given the user's venture stage + problem type, which causal framework applies? Uses the new TYPICAL_AT + ADDRESSES_PROBLEM_TYPE edges.

```cypher
MATCH (f:Framework)-[:TYPICAL_AT]->(vs:VentureStage {name: $venture_stage})
WHERE (f)-[:ADDRESSES_PROBLEM_TYPE]->(:ProblemType {name: $problem_type})
AND EXISTS { MATCH (c:Concept {name: 'Causal Reasoning'})-[:CONTAINS]->(f) }
RETURN f.name AS framework, f.description AS description
ORDER BY f.importance DESC
LIMIT 3
```

**Pattern 12: causal_pattern_match**
Given a causal claim extracted locally, does the Brain have a known pattern? Semantic search against framework descriptions to find matching causal templates.

**Pattern 13: causal_contradiction_resolve**
When two causal claims in the room contradict (different causes for the same effect), Brain suggests frameworks that resolve the tension (Six Thinking Hats, Dialectical Bootstrapping).

```cypher
MATCH (f:Framework)-[co:CO_OCCURS]->(resolver:Framework)
WHERE f.name IN $contradicting_frameworks
AND resolver.category IN ['perspective', 'synthesis']
RETURN resolver.name AS framework, resolver.description AS description,
       co.confidence AS confidence
ORDER BY co.confidence DESC
LIMIT 3
```

### Write Flow: Plugin to Brain

The plugin does NOT write to Neo4j at runtime. Brain enrichment is read-only for all users except admin. The data flow is:

```
Plugin -> reads from Brain (via brain_ask/brain_query)
Brain -> enriches Larry's causal reasoning with framework intelligence
Admin -> writes framework structure to Brain (one-time seed scripts)
```

This preserves the Brain IP protection model (Decision 5).

---

## CJS Bridge Pattern: causal-to-kuzu.cjs

Follows the exact pattern from `hsi-to-kuzu.cjs` (verified by reading lines 1-171):

```javascript
#!/usr/bin/env node
/**
 * causal-to-kuzu.cjs -- KuzuDB Writer for Causal Claims
 * Reads .causal-claims.json and creates CausalClaim nodes,
 * CAUSES, CASCADES_TO, and EXTRACTED_FROM edges.
 *
 * Usage: node scripts/causal-to-kuzu.cjs /path/to/room
 *
 * Follows the open-use-close pattern from Phase 15.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { openGraph, closeGraph, queryGraph } = require('../lib/core/lazygraph-ops.cjs');

function esc(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'");
}

async function main() {
  const roomDir = process.argv[2];
  if (!roomDir) { /* usage error */ }

  const resolvedRoom = path.resolve(roomDir);
  const claimsPath = path.join(resolvedRoom, '.causal-claims.json');

  if (!fs.existsSync(claimsPath)) process.exit(0);

  let data;
  try {
    data = JSON.parse(fs.readFileSync(claimsPath, 'utf-8'));
  } catch (e) { process.exit(0); }

  if (!data || !data.claims || data.claims.length === 0) process.exit(0);

  let db;
  try {
    const graph = await openGraph(resolvedRoom);
    db = graph.db;
    const conn = graph.conn;

    // Cleanup existing causal edges (fresh per run, same as HSI)
    try { await conn.query('MATCH (a:CausalClaim)-[r:CAUSES]->(b:CausalClaim) DELETE r'); } catch (e) {}
    try { await conn.query('MATCH (a:CausalClaim)-[r:CASCADES_TO]->(b:CausalClaim) DELETE r'); } catch (e) {}
    try { await conn.query('MATCH (a:CausalClaim)-[r:EXTRACTED_FROM]->(b:Artifact) DELETE r'); } catch (e) {}

    // Write CausalClaim nodes
    for (const claim of data.claims) {
      await conn.query(
        `MERGE (cc:CausalClaim {id: '${esc(claim.id)}'})
         ON CREATE SET cc.cause = '${esc(claim.cause)}',
                       cc.mechanism = '${esc(claim.mechanism)}',
                       cc.effect = '${esc(claim.effect)}',
                       cc.confidence = ${claim.confidence || 0.5},
                       cc.novelty_score = ${claim.novelty_score || 0.0},
                       cc.domain = '${esc(claim.domain)}',
                       cc.source_artifact = '${esc(claim.source_artifact)}',
                       cc.created = '${esc(claim.created)}'
         ON MATCH SET  /* same SET clause */`
      );

      // EXTRACTED_FROM edge
      if (claim.source_artifact) {
        await conn.query(
          `MATCH (cc:CausalClaim {id: '${esc(claim.id)}'}),
                 (a:Artifact {id: '${esc(claim.source_artifact)}'})
           MERGE (cc)-[:EXTRACTED_FROM]->(a)`
        );
      }
    }

    // Write CAUSES edges (from chain detection in extract step)
    for (const chain of (data.chains || [])) {
      // chain = { from: "CC-001", to: "CC-002", strength: 0.8 }
      await conn.query(
        `MATCH (a:CausalClaim {id: '${esc(chain.from)}'}),
               (b:CausalClaim {id: '${esc(chain.to)}'})
         MERGE (a)-[r:CAUSES]->(b)
         ON CREATE SET r.strength = ${chain.strength || 0.5}`
      );
    }

    // Summary
    process.stderr.write(`Causal: wrote ${data.claims.length} claims, ${(data.chains || []).length} chain edges\n`);

  } finally {
    if (db) await closeGraph(db);
  }
}

main();
```

### Key Pattern Decisions (Matching hsi-to-kuzu.cjs)

1. **Fresh per run.** Delete existing causal edges before rewriting. Same as HSI which deletes all HSI_CONNECTION edges each run (line 69-77 of hsi-to-kuzu.cjs). This avoids stale edge accumulation.

2. **Silent exit on missing data.** If .causal-claims.json doesn't exist or is empty, exit 0 silently. Same as hsi-to-kuzu.cjs behavior.

3. **Error swallowing.** Individual MERGE failures (e.g., missing Artifact node) are caught and skipped, same as hsi-to-kuzu.cjs line 107-109.

4. **Summary to stderr.** Progress reporting goes to stderr (not stdout) to avoid polluting hook output. Same as hsi-to-kuzu.cjs line 152-154.

---

## post-write Extension

The exact insertion point in `scripts/post-write` (after line 116, before line 119):

```bash
      # Run causal extraction (after HSI + RS are computed)
      if [ -f "${room_dir}/.hsi-results.json" ]; then
        python3 "${PLUGIN_ROOT}/scripts/extract-causal-claims.py" "$room_dir" 2>/dev/null || true

        # Write causal claims to KuzuDB
        if [ -f "${room_dir}/.causal-claims.json" ]; then
          node "${PLUGIN_ROOT}/scripts/causal-to-kuzu.cjs" "$room_dir" 2>/dev/null || true

          # Cross-reference causal claims with HSI/RS/Analogy edges
          node "${PLUGIN_ROOT}/scripts/cross-reference-causal.cjs" "$room_dir" 2>/dev/null || true
        fi
      fi
```

This goes INSIDE the existing `( ... ) &` background subshell block (lines 101-117), after the hsi-to-kuzu.cjs call. The causal steps inherit the background execution and won't block the hook.

---

## Build Order (Dependency Chain)

### Phase A: KuzuDB Schema + Extract (Foundation)

**Must come first.** Everything depends on CausalClaim nodes existing in KuzuDB.

1. Extend `lib/core/lazygraph-ops.cjs` with CausalClaim node table + 4 new edge tables
2. Create `scripts/extract-causal-claims.py` (Tier 0 regex, Tier 1 LLM-assisted)
3. Create `scripts/causal-to-kuzu.cjs` (follows hsi-to-kuzu.cjs pattern exactly)
4. Extend `scripts/post-write` to call extract + bridge after hsi-to-kuzu.cjs
5. Create `.causal-claims.json` intermediate format specification

**Verification:** After this phase, writing an artifact to a room should produce CausalClaim nodes in KuzuDB.

### Phase B: Cross-Reference + Unified Discovery

**Depends on Phase A.** Creates the cross-reference bridge between causal claims and HSI/RS/Analogy.

1. Create `scripts/cross-reference-causal.cjs` (three joins: HSI, RS, Analogy)
2. Add cross-reference step to post-write cascade (after causal-to-kuzu.cjs)
3. Create unified discovery Cypher queries (tested against real room data)
4. Add convergence scoring to cross-reference step

**Verification:** CausalClaims should have CONVERGES_WITH edges to artifacts that also appear in HSI/RS/Analogy edges.

### Phase C: Graph Engine + /mos:causal Command

**Depends on Phase B.** The command needs cross-referenced data to produce meaningful results.

1. Create `scripts/causal-graph-engine.py` (NetworkX: chain traversal, betweenness centrality, cascade simulation)
2. Create `commands/causal.md` with three subcommands (extract, trace, predict)
3. Create `room/.predictions/` directory structure + REGISTRY.json schema
4. Integrate prediction checking into session-start hook

**Verification:** User can run /mos:causal trace and see "because...because...because" chains with bottleneck markers.

### Phase D: Brain Enrichment + Larry Wiring

**Depends on Phase C.** Enrichment enhances what already works, never gates it.

1. Create `scripts/seed-brain-causal.cjs` (admin-only Neo4j writes)
2. Create `references/brain/causal-patterns.md` (patterns 11-13)
3. Update `skills/brain-connector/SKILL.md` to reference causal patterns
4. Update `skills/room-proactive/SKILL.md` with causal signal triggers
5. Wire Larry JTBD suggestions for causal findings

**Verification:** Brain-connected users get causal framework recommendations. Non-Brain users still get full causal extraction and chain tracing from local data.

### Phase E: Prediction Lifecycle + Proactive Intelligence

**Depends on Phase D.** This is the closed-loop learning layer.

1. Extend `scripts/compute-state` to include prediction summary
2. Add prediction deadline checking to session-start
3. Create /mos:causal predict --review for outcome recording
4. Wire prediction outcomes back to CausalClaim confidence updates
5. Enhanced room-proactive: surface triple convergences (causal + HSI + RS + analogy)

**Verification:** Predictions have a lifecycle. Larry reminds about approaching deadlines. Confirmed/refuted outcomes update claim confidence.

```
Phase A (Schema + Extract)
    |
    v
Phase B (Cross-Reference)
    |
    v
Phase C (Graph Engine + Command)
    |
    v
Phase D (Brain + Larry Wiring)
    |
    v
Phase E (Prediction Lifecycle)
```

---

## Integration Points Summary

| Existing Pipeline | How Causal Layer Connects | Integration File |
|-------------------|--------------------------|------------------|
| **Graph Index** (mindrian-tools.cjs) | CausalClaim nodes indexed alongside Artifacts. EXTRACTED_FROM edge links them. | lazygraph-ops.cjs |
| **HSI Pipeline** (compute-hsi.py) | Spectral profiles reused for claim confidence. HSI_CONNECTION edges cross-referenced. | extract-causal-claims.py, cross-reference-causal.cjs |
| **Reverse Salient** (detect-reverse-salients.py) | RS edges cross-referenced with CausalClaims in bottleneck sections. | cross-reference-causal.cjs |
| **Analogy Pipeline** (pipelines/analogy/) | ANALOGOUS_TO edges cross-referenced with CausalClaims for transfer detection. | cross-reference-causal.cjs |
| **Brain Connector** (skills/brain-connector/) | Causal query patterns 11-13 enrich Larry's framework selection. | causal-patterns.md, brain-connector SKILL.md |
| **Room Proactive** (skills/room-proactive/) | Causal signals added to trigger table. Triple convergence = highest priority. | room-proactive SKILL.md |
| **Compute State** (scripts/compute-state) | Prediction summary added to STATE.md output. | compute-state |
| **Session Start** (scripts/session-start) | Prediction deadline checking. | session-start |
| **Export/Presentation** (scripts/generate-*) | CausalClaim chain visualization in exports. | generate-export.cjs, generate-presentation.cjs |
| **Post-Write Hook** (hooks/hooks.json) | NO CHANGE to hooks.json -- cascade extension is in post-write script. | scripts/post-write |

---

## Patterns to Follow

### Pattern 1: JSON Intermediate (Established)

All Python computation outputs JSON intermediates. CJS bridges read JSON and write to KuzuDB. Never let Python touch KuzuDB directly.

```
Python computes -> .json file -> CJS reads -> KuzuDB writes
```

This pattern exists in: compute-hsi.py -> .hsi-results.json -> hsi-to-kuzu.cjs
Causal follows: extract-causal-claims.py -> .causal-claims.json -> causal-to-kuzu.cjs

### Pattern 2: Open-Use-Close (Established)

Every CJS script that touches KuzuDB follows the open-use-close pattern from lazygraph-ops.cjs:

```javascript
const { openGraph, closeGraph, queryGraph } = require('../lib/core/lazygraph-ops.cjs');
async function main() {
  let db;
  try {
    const graph = await openGraph(roomDir);
    db = graph.db;
    const conn = graph.conn;
    // ... work ...
  } finally {
    if (db) await closeGraph(db);
  }
}
```

### Pattern 3: Background Subshell (Established)

Heavy computation in post-write runs in a background subshell to avoid blocking the hook timeout:

```bash
if [[ conditions ]]; then
  (
    python3 extract-causal-claims.py "$room_dir" 2>/dev/null || true
    node causal-to-kuzu.cjs "$room_dir" 2>/dev/null || true
    node cross-reference-causal.cjs "$room_dir" 2>/dev/null || true
  ) &
fi
```

### Pattern 4: Graceful Degradation (Established)

Tier 0 (regex only) works with zero Python deps beyond stdlib. Tier 1 (LLM-assisted) requires additional deps. The system MUST work without any optional deps.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Monolithic Orchestrator

**What:** Creating a single script that coordinates HSI + RS + Causal + Cross-Reference.
**Why bad:** Violates the cascade architecture. Each step is independent and composable. A monolithic orchestrator creates a single point of failure and makes it impossible to run steps individually for debugging.
**Instead:** Extend the existing post-write cascade. Each step reads the previous step's output file. Steps can be run independently.

### Anti-Pattern 2: Direct Python-to-KuzuDB

**What:** Having extract-causal-claims.py write directly to KuzuDB.
**Why bad:** KuzuDB's Python bindings have different behavior than the Node.js bindings used everywhere else. Mixing languages for KuzuDB access creates version/locking conflicts.
**Instead:** Python writes .json. CJS reads .json and writes to KuzuDB.

### Anti-Pattern 3: Real-Time Brain Writes

**What:** Having the plugin write FEEDS_INTO / CO_OCCURS edges to Neo4j at runtime.
**Why bad:** Brain writes require admin key. User plugins don't have admin key. Writing to remote Neo4j on every causal extraction would be slow and fragile.
**Instead:** Admin seed script runs once. Plugin reads from Brain at runtime.

### Anti-Pattern 4: Automatic Prediction Resolution

**What:** Having the system automatically mark predictions as confirmed or refuted.
**Why bad:** Violates Decision 12 (Assumptions are first-class entities) and Decision 13 (Rejection is data). The user's judgment IS the data. Automating it removes the learning signal.
**Instead:** Larry reminds. User provides evidence and judgment. The decision becomes graph data.

### Anti-Pattern 5: Causal Extraction During LLM Response

**What:** Having Larry extract causal claims inline during conversation and write them to .causal-claims.json.
**Why bad:** The post-write cascade already handles extraction. If Larry also writes claims during conversation, you get duplication and race conditions with the cascade.
**Instead:** Larry writes artifacts (room files). The post-write hook extracts claims. Separation of concerns: Larry reasons, cascade computes.

---

## Scalability Considerations

| Concern | 10 Artifacts | 100 Artifacts | 1000 Artifacts |
|---------|-------------|---------------|----------------|
| Causal extraction time | < 1s (regex) | 2-5s (regex), 10-20s (LLM) | LLM impractical, regex only |
| KuzuDB CausalClaim nodes | < 50 | < 500 | Need pruning/archival |
| Cross-reference queries | Instant | < 1s | Need indexes, batch processing |
| NetworkX chain traversal | Instant | < 2s | Need max-depth limits |
| .causal-claims.json size | < 10KB | < 100KB | < 1MB (manageable) |

For rooms with 100+ artifacts, the extraction step should use incremental processing (only extract from changed artifacts, similar to the HSI content hash cache pattern at compute-hsi.py lines 179-209).

---

## Sources

- Existing codebase: `scripts/post-write`, `scripts/hsi-to-kuzu.cjs`, `scripts/compute-hsi.py`, `scripts/detect-reverse-salients.py`, `lib/core/lazygraph-ops.cjs` (HIGH confidence -- direct code reading)
- KuzuDB schema patterns: verified against working initSchema() in lazygraph-ops.cjs lines 27-99 (HIGH confidence)
- Hughes (1983) Reverse Salients: betweenness centrality for bottleneck detection (HIGH confidence -- already implemented in codebase)
- Duraisamy (2025) Three Gaps framework: referenced in PROJECT.md as research basis (MEDIUM confidence -- not yet implemented, need to verify paper claims during build)
- NetworkX graph algorithms: chain traversal, betweenness centrality (HIGH confidence -- well-documented, stable library)
- Brain MCP server: verified brain_write tool requires admin key (line 85 of mcp-server-brain/lib/neo4j-tools.cjs) (HIGH confidence)
