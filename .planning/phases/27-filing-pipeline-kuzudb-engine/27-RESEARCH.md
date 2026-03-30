# Phase 27: Filing Pipeline + KuzuDB Engine - Research

**Researched:** 2026-03-29
**Domain:** Post-write hook chain, KuzuDB graph engine, room intelligence pipeline
**Confidence:** HIGH

## Summary

Phase 27 wires together the complete filing cascade: every artifact write triggers classify -> KuzuDB index -> compute-state -> build-graph -> generate-presentation -> git commit -> push. The codebase already has strong foundations: `post-write` (the PostToolUse hook) already chains classify-insight + KuzuDB index + git-ops commit. The KuzuDB engine (`lazygraph-ops.cjs`) already has Artifact and Section node types with 7 edge types. The `build-graph` script already generates Cytoscape JSON from file scanning + analyze-room output. What is MISSING is: (1) the pipeline steps between KuzuDB index and build-graph (compute-state, generate-presentation), (2) Meeting and Speaker node types in KuzuDB, (3) Assumption tracking as first-class KuzuDB entities, (4) artifact IDs and pipeline provenance in frontmatter, (5) confidence scores on edges, (6) graph.json generation FROM KuzuDB queries rather than just file scanning, and (7) proactive intelligence persistence.

**Primary recommendation:** Extend `lazygraph-ops.cjs` schema with Meeting, Speaker, and Assumption node types + new edge types (SEGMENT_OF, SPOKE_IN, CONSULTED_ON, HAS_ASSUMPTION). Extend `post-write` to chain the full cascade. Refactor `build-graph` to query KuzuDB as primary source and fall back to file scanning when .lazygraph is absent.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FILE-01 | Post-write hook chain: classify -> KuzuDB index -> compute-state -> build-graph -> generate-presentation -> git commit -> push | Current post-write only runs classify + KuzuDB index + git-ops. Missing compute-state, build-graph, generate-presentation steps. |
| FILE-02 | Artifact IDs (stable hash) in frontmatter for reliable cross-referencing | `lazygraph-ops.cjs` already computes MD5 content_hash (8 hex chars). Need stable artifact_id field in frontmatter separate from content hash. |
| FILE-03 | Pipeline provenance in frontmatter (pipeline name, stage number, requires/provides) | `build-graph` already reads `pipeline` and `pipeline_stage` from frontmatter. Need `requires`/`provides` fields added to frontmatter contract. |
| FILE-04 | Meeting segments create KuzuDB nodes with SEGMENT_OF edges to meeting node | KuzuDB has no Meeting node type. `build-graph` creates meeting nodes in JSON only. Need Meeting node table + SEGMENT_OF rel table. |
| FILE-05 | Speaker expertise mapped to room sections via CONSULTED_ON edges | KuzuDB has no Speaker node type. `build-graph` creates speaker nodes in JSON only. Need Speaker node table + CONSULTED_ON rel table. |
| KUZU-01 | Every filing creates KuzuDB nodes + edges | `post-write` already calls `graph index` for .md files in rooms. Working. Needs extension for meeting/speaker types. |
| KUZU-02 | Cross-room relationship detection | `lazygraph-ops.cjs` operates per-room (.lazygraph/ inside room dir). Cross-room needs either shared DB or cross-DB queries. |
| KUZU-03 | graph.json generated from KuzuDB queries (not just file scanning) | `build-graph` is pure file-scanning bash. `generate-export.cjs` already queries KuzuDB and merges edges. Need build-graph to use KuzuDB as primary source. |
| KUZU-04 | Assumption tracking as first-class KuzuDB entities with validity status | Assumptions exist in artifact frontmatter (artifact-template.md) but NOT in KuzuDB. Need Assumption node table + HAS_ASSUMPTION edge. |
| KUZU-05 | Confidence scores on all edges | Only CONTRADICTS has confidence property. INFORMS, ENABLES, INVALIDATES, CONVERGES, BELONGS_TO lack it. Need schema migration. |
| ROOM-01 | STATE.md + MINTO.md context files maintained | `compute-state` writes STATE.md. MINTO.md generation exists in reasoning-ops but not in the auto chain. |
| ROOM-02 | CJS scripts operate on room path argument (ICM) | `lazygraph-ops.cjs` already takes roomDir as argument. `build-graph` takes ROOM_DIR as $1. Pattern established. |
| ROOM-03 | Room tree always browsable as GitHub repo | `git-ops` init creates .gitignore (skips .proactive-intelligence.json). All room files are markdown. Pattern established. |
| ROOM-04 | Proactive intelligence persisted in .proactive-intelligence.json | `git-ops` init already adds .proactive-intelligence.json to .gitignore. File does not yet exist -- needs creation by analyze-room or post-write. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| kuzu | 0.11.3 | Embedded graph database (KuzuDB) | Already in package.json, installed, tested. Apache 2.0. Per-project .lazygraph/ |
| gray-matter | 4.0.3 | YAML frontmatter parsing | Already in package.json. Used for frontmatter extraction |
| Node.js crypto | built-in | Content hashing for artifact IDs | Already used in lazygraph-ops.cjs for MD5 hashing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| chokidar | 4.0.3 | File watching | Already installed. Could be used for continuous graph updates |
| flexsearch | 0.7.43 | Full-text search | Already installed. For keyword-based cross-room detection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| KuzuDB | SQLite + manual graph | KuzuDB is already integrated, has Cypher, handles graph queries natively |
| Bash build-graph | Full CJS rewrite | Keep bash for backward compat, add CJS KuzuDB-sourced variant |

## Architecture Patterns

### Current Post-Write Chain (as of Phase 26)
```
PostToolUse:Write fires
  -> hooks/run-hook.cmd post-write
    -> scripts/post-write
      1. Active room guard (skip non-active rooms)
      2. Track analytics (background, async)
      3. KuzuDB graph index (background, 2s timeout)
      4. classify-insight (synchronous)
      5. git-ops commit (background, async)
```

### Target Post-Write Chain (Phase 27)
```
PostToolUse:Write fires
  -> hooks/run-hook.cmd post-write
    -> scripts/post-write
      1. Active room guard
      2. Track analytics (background)
      3. classify-insight (sync, <100ms)
      4. KuzuDB graph index (sync, <500ms) -- now blocking, not background
         - Index artifact node
         - Create Meeting/Speaker nodes if meeting-sourced
         - Extract and index Assumption nodes
         - Detect cross-references -> create INFORMS/CONTRADICTS edges
         - Set confidence scores on all new edges
      5. compute-state (background, <2s)
      6. build-graph (background, <5s) -- now queries KuzuDB
      7. generate-presentation (background, optional, <10s)
      8. git-ops commit + push (background)
      9. Persist proactive intelligence (background)
```

### KuzuDB Schema Extension

Current schema (lazygraph-ops.cjs):
```
Node Tables: Artifact, Section
Edge Tables: INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES, BELONGS_TO, REASONING_INFORMS
```

Target schema:
```
Node Tables:
  Artifact(id, title, section, methodology, created, content_hash, artifact_id, pipeline, pipeline_stage)
  Section(name, label)
  Meeting(id, name, date, source, speakers_count, decisions_count, action_items_count)
  Speaker(id, name, role, role_type, profile_path)
  Assumption(id, claim, status, source_artifact, created)

Edge Tables:
  INFORMS(FROM Artifact TO Artifact, confidence FLOAT)
  CONTRADICTS(FROM Artifact TO Artifact, confidence FLOAT)
  CONVERGES(FROM Artifact TO Artifact, term STRING, confidence FLOAT)
  ENABLES(FROM Artifact TO Artifact, confidence FLOAT)
  INVALIDATES(FROM Artifact TO Artifact, confidence FLOAT)
  BELONGS_TO(FROM Artifact TO Section, confidence FLOAT)
  REASONING_INFORMS(FROM Section TO Section, provides STRING)
  SEGMENT_OF(FROM Artifact TO Meeting, segment_type STRING, confidence FLOAT)
  SPOKE_IN(FROM Speaker TO Meeting)
  CONSULTED_ON(FROM Speaker TO Section, meeting_count INT)
  HAS_ASSUMPTION(FROM Artifact TO Assumption)
  ASSUMPTION_IMPACTS(FROM Assumption TO Section)
```

### Pattern: Stable Artifact IDs

Current `lazygraph-ops.cjs` uses relative path as ID (e.g., `problem-definition/market-trends`). This is fragile -- renaming a file changes the ID. Phase 27 needs a stable hash-based ID.

Recommended approach:
```javascript
// Stable artifact ID = SHA256(roomName + section + title + created)[:12]
function computeArtifactId(roomDir, section, title, created) {
  const roomName = path.basename(roomDir);
  const input = `${roomName}:${section}:${title}:${created}`;
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 12);
}
```

Written to frontmatter as:
```yaml
artifact_id: a1b2c3d4e5f6
```

The path-based ID remains as the KuzuDB primary key (for graph traversal). The artifact_id is a stable secondary identifier for cross-referencing.

### Pattern: Pipeline Provenance Frontmatter

Existing frontmatter already supports `pipeline` and `pipeline_stage` (read by build-graph). Extend with:
```yaml
pipeline: innovation-deep-dive
pipeline_stage: 3
pipeline_requires: [problem-definition/core-problem]
pipeline_provides: [solution-design/architecture]
```

### Pattern: KuzuDB-Sourced graph.json

Current `build-graph` is 735 lines of bash that scans files. The target is a CJS script that:
1. Opens KuzuDB (.lazygraph/)
2. Queries all nodes and edges via Cypher
3. Falls back to file scanning if .lazygraph/ doesn't exist
4. Outputs Cytoscape JSON format

`generate-export.cjs` already does this partially (lines 370-471) -- it queries KuzuDB and merges edges into the file-scanned graph. Phase 27 inverts this: KuzuDB is primary, file scanning is fallback.

### Anti-Patterns to Avoid
- **Blocking the hook with heavy computation:** The post-write hook has a 3s timeout. KuzuDB indexing must be fast (<500ms for a single artifact). Compute-state and build-graph run in background.
- **Breaking Tier 0 graceful degradation:** If .lazygraph/ doesn't exist, everything must still work via file scanning. KuzuDB enhances but never gates.
- **Storing runtime state in git:** .proactive-intelligence.json is already in .gitignore. Keep it that way.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph queries | Custom JS graph traversal | KuzuDB Cypher queries | Already integrated, handles cycles, has SHORTEST paths |
| YAML frontmatter parsing | Regex on frontmatter | gray-matter (already installed) | Handles edge cases (multi-line, nested, arrays) |
| Content hashing | Custom hash function | Node.js crypto.createHash | Already used in lazygraph-ops.cjs |
| File watching | Custom polling | chokidar (already installed) | Handles OS differences, debouncing |
| Section discovery | Manual directory listing | section-registry.cjs | Already handles core + extended + structural filtering |

## Common Pitfalls

### Pitfall 1: KuzuDB Schema Migration Without Data Preservation
**What goes wrong:** Adding new node/relationship tables drops existing data if not using `IF NOT EXISTS`.
**Why it happens:** KuzuDB requires schema-first. Changing table schemas requires drop + recreate.
**How to avoid:** Always use `CREATE NODE TABLE IF NOT EXISTS` and `CREATE REL TABLE IF NOT EXISTS`. For schema changes (adding properties), add new tables rather than altering existing ones. The `initSchema` function already uses this pattern.
**Warning signs:** Graph stats showing 0 after a code update.

### Pitfall 2: Hook Timeout Cascade
**What goes wrong:** Post-write hook exceeds 3000ms timeout, entire chain fails silently.
**Why it happens:** Adding compute-state + build-graph + generate-presentation synchronously.
**How to avoid:** Only classify-insight (sync, <100ms) and KuzuDB index (sync, <500ms) are blocking. Everything else runs in background with `&`.
**Warning signs:** `timeout` errors in hook output, missing graph updates.

### Pitfall 3: Cross-Room Detection Performance
**What goes wrong:** Scanning all rooms for cross-room relationships takes too long.
**Why it happens:** Each room has its own .lazygraph/ database. Cross-room queries require opening multiple databases.
**How to avoid:** KUZU-02 should be a lazy/background process, not part of the post-write chain. Consider a shared index file or periodic cross-room scan (e.g., on session-start).
**Warning signs:** Post-write hook timing out when multiple rooms exist.

### Pitfall 4: Assumption Node Duplication
**What goes wrong:** Same assumption extracted from different artifacts creates duplicate Assumption nodes.
**Why it happens:** Assumptions are free-text claims with no canonical ID.
**How to avoid:** Hash the normalized claim text for the Assumption ID. Use MERGE (upsert) when creating nodes.
**Warning signs:** Graph stats showing more assumptions than artifacts.

### Pitfall 5: build-graph Bash vs CJS Split
**What goes wrong:** Two separate graph builders (bash for dashboard, CJS for KuzuDB) diverge and produce inconsistent results.
**Why it happens:** Incremental migration from bash to CJS.
**How to avoid:** Keep the bash `build-graph` as a wrapper that calls a new CJS script (`build-graph.cjs`) which queries KuzuDB. The bash script becomes a thin shell.
**Warning signs:** Dashboard showing different edges than KuzuDB queries.

### Pitfall 6: KuzuDB Concurrent Access
**What goes wrong:** Multiple background processes try to open .lazygraph/ simultaneously (e.g., post-write indexing while build-graph is querying).
**Why it happens:** KuzuDB allows only one write connection at a time.
**How to avoid:** Use the existing open-use-close pattern (lazygraph-ops.cjs already does this). Keep write operations short. Background processes should use separate connection lifetimes.
**Warning signs:** "database is locked" errors in stderr.

## Code Examples

### Extending KuzuDB Schema (initSchema in lazygraph-ops.cjs)

```javascript
// Source: existing lazygraph-ops.cjs pattern
async function initSchema(conn) {
  // Existing tables (preserved)
  await conn.query(`CREATE NODE TABLE IF NOT EXISTS Artifact(
    id STRING PRIMARY KEY, title STRING, section STRING,
    methodology STRING, created STRING, content_hash STRING,
    artifact_id STRING, pipeline STRING, pipeline_stage INT64
  )`);
  await conn.query(`CREATE NODE TABLE IF NOT EXISTS Section(name STRING PRIMARY KEY, label STRING)`);

  // NEW node tables
  await conn.query(`CREATE NODE TABLE IF NOT EXISTS Meeting(
    id STRING PRIMARY KEY, name STRING, date STRING,
    source STRING, speakers_count INT64, decisions_count INT64,
    action_items_count INT64
  )`);
  await conn.query(`CREATE NODE TABLE IF NOT EXISTS Speaker(
    id STRING PRIMARY KEY, name STRING, role STRING,
    role_type STRING, profile_path STRING
  )`);
  await conn.query(`CREATE NODE TABLE IF NOT EXISTS Assumption(
    id STRING PRIMARY KEY, claim STRING, status STRING,
    source_artifact STRING, created STRING
  )`);

  // Existing edges with confidence added
  await conn.query(`CREATE REL TABLE IF NOT EXISTS INFORMS(FROM Artifact TO Artifact, confidence DOUBLE DEFAULT 0.5)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS CONTRADICTS(FROM Artifact TO Artifact, confidence DOUBLE DEFAULT 0.5)`);
  // ... etc

  // NEW edge tables
  await conn.query(`CREATE REL TABLE IF NOT EXISTS SEGMENT_OF(FROM Artifact TO Meeting, segment_type STRING, confidence DOUBLE)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS SPOKE_IN(FROM Speaker TO Meeting)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS CONSULTED_ON(FROM Speaker TO Section, meeting_count INT64 DEFAULT 1)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS HAS_ASSUMPTION(FROM Artifact TO Assumption)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS ASSUMPTION_IMPACTS(FROM Assumption TO Section)`);
}
```

**KuzuDB schema migration note:** Adding new columns to existing tables via `IF NOT EXISTS` on the table creation will NOT add new columns to existing tables. KuzuDB 0.11.3 supports `ALTER TABLE ... ADD COLUMN` for adding properties. Use this for adding `confidence` to existing edge tables and `artifact_id`/`pipeline` to Artifact:

```javascript
// Safe column addition (idempotent via try/catch)
async function migrateSchema(conn) {
  const migrations = [
    `ALTER TABLE Artifact ADD artifact_id STRING DEFAULT ''`,
    `ALTER TABLE Artifact ADD pipeline STRING DEFAULT ''`,
    `ALTER TABLE Artifact ADD pipeline_stage INT64 DEFAULT 0`,
    // Cannot add properties to existing REL tables in KuzuDB 0.11.x
    // New edges with confidence must be new REL tables or handled in app layer
  ];
  for (const sql of migrations) {
    try { await conn.query(sql); } catch (e) { /* column already exists */ }
  }
}
```

### Indexing Meeting in KuzuDB

```javascript
// New function in lazygraph-ops.cjs
async function indexMeeting(conn, roomDir, meetingDir) {
  const metadataPath = path.join(meetingDir, 'metadata.yaml');
  if (!fs.existsSync(metadataPath)) return null;

  const content = fs.readFileSync(metadataPath, 'utf-8');
  const id = 'meeting/' + path.basename(meetingDir);
  const name = extractYamlField(content, 'meeting_name');
  const date = extractYamlField(content, 'meeting_date');
  const source = extractYamlField(content, 'source');

  await conn.query(`
    MERGE (m:Meeting {id: '${esc(id)}'})
    ON CREATE SET m.name = '${esc(name)}', m.date = '${esc(date)}',
                  m.source = '${esc(source)}'
    ON MATCH SET m.name = '${esc(name)}', m.date = '${esc(date)}'
  `);

  return { id, name, date };
}
```

### Post-Write Chain Extension

```bash
# In scripts/post-write -- after KuzuDB index, add:

# Compute room state in background (updates STATE.md)
if [ -n "$room_dir" ] && [ -d "$room_dir" ]; then
  bash "${SCRIPT_DIR}/compute-state" "$room_dir" > "${room_dir}/STATE.md" 2>/dev/null &
fi

# Rebuild graph.json from KuzuDB in background
if [ -n "$room_dir" ] && [ -d "$room_dir/.lazygraph" ]; then
  PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  timeout 5 node "${PLUGIN_ROOT}/scripts/build-graph-from-kuzu.cjs" "$room_dir" 2>/dev/null &
fi

# Persist proactive intelligence
if [ -n "$room_dir" ] && [ -d "$room_dir" ]; then
  bash "${SCRIPT_DIR}/analyze-room" "$room_dir" 2>/dev/null | \
    node -e "const fs=require('fs');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{fs.writeFileSync('${room_dir}/.proactive-intelligence.json',JSON.stringify({updated:new Date().toISOString(),raw:d}));})" &
fi
```

### Querying KuzuDB for graph.json

```javascript
// New script: scripts/build-graph-from-kuzu.cjs
async function buildGraphFromKuzu(roomDir) {
  const { db, conn } = await lazygraph.openGraph(roomDir);
  try {
    // Get all nodes
    const artifacts = await lazygraph.queryGraph(conn,
      `MATCH (a:Artifact) RETURN a.id, a.title, a.section, a.methodology, a.created`
    );
    const meetings = await lazygraph.queryGraph(conn,
      `MATCH (m:Meeting) RETURN m.id, m.name, m.date`
    );
    const speakers = await lazygraph.queryGraph(conn,
      `MATCH (s:Speaker) RETURN s.id, s.name, s.role`
    );

    // Get all edges
    const edges = await lazygraph.queryGraph(conn,
      `MATCH (a)-[r]->(b) RETURN a.id AS src, type(r) AS relType, b.id AS tgt`
    );

    // Build Cytoscape JSON
    // ... (same format as current build-graph output)
  } finally {
    await lazygraph.closeGraph(db);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| File scanning only (build-graph bash) | KuzuDB + file scanning hybrid (generate-export.cjs) | Phase 15 | Graph queries are O(1) vs O(n) file scanning |
| Flat speaker/role frontmatter | Nested attribution block | Phase 7 | Better provenance chain |
| No auto-commit | git-ops commit on post-write | Phase 26 | Every filing is version-controlled |
| Manual graph rebuild | Auto-index on post-write | Phase 15 | KuzuDB stays current with room content |

## Open Questions

1. **KuzuDB ALTER TABLE for REL tables**
   - What we know: KuzuDB 0.11.3 supports `ALTER TABLE ... ADD COLUMN` for NODE tables. For REL tables, behavior is less documented.
   - What's unclear: Whether confidence can be added to existing INFORMS, ENABLES etc. REL tables via ALTER, or if new REL table definitions are needed.
   - Recommendation: Create new REL tables with confidence (e.g., INFORMS_V2) and migrate, OR handle confidence in application layer (store as JSON in a separate artifact).

2. **Cross-Room Detection Architecture (KUZU-02)**
   - What we know: Each room has its own .lazygraph/ database. The room registry is at .rooms/registry.json.
   - What's unclear: Whether to use a shared cross-room index, or periodic scanning.
   - Recommendation: Create a `.rooms/.cross-room-index.json` file that maps concepts/themes to room paths. Update it during post-write. This avoids opening multiple KuzuDB instances.

3. **MINTO.md Auto-Generation Timing**
   - What we know: reasoning-ops.cjs has MINTO.md generation. compute-state does not call it.
   - What's unclear: Whether MINTO.md should regenerate on every filing or only on explicit command.
   - Recommendation: MINTO.md generation is expensive (requires reading all artifacts). Run it on session-start or explicit command, not on every post-write.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All CJS scripts | Yes | 18+ (engines in package.json) | -- |
| KuzuDB npm | Graph engine | Yes | 0.11.3 | File scanning fallback |
| gray-matter | Frontmatter parsing | Yes | 4.0.3 | Regex parsing (existing in lazygraph-ops.cjs) |
| git | Room version control | Yes | Available on system | Silent no-op (git-ops pattern) |
| python3 | git-ops get-auto-push | Yes | Available on system | -- |
| bash | All scripts | Yes | Available on system | -- |

**Missing dependencies with no fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bash test scripts (custom) |
| Config file | tests/run-all.sh |
| Quick run command | `bash tests/test-phase-15.sh` (KuzuDB tests) |
| Full suite command | `bash tests/run-all.sh` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FILE-01 | Post-write chain fires all steps | integration | `bash tests/test-phase-27-pipeline.sh` | No -- Wave 0 |
| FILE-02 | Artifact IDs in frontmatter | unit | `bash tests/test-phase-27-artifact-ids.sh` | No -- Wave 0 |
| FILE-04 | Meeting nodes in KuzuDB | integration | `bash tests/test-phase-27-meetings.sh` | No -- Wave 0 |
| KUZU-01 | Filing creates KuzuDB nodes | integration | `bash tests/test-phase-15.sh` (extend) | Yes (partial) |
| KUZU-03 | graph.json from KuzuDB | integration | `bash tests/test-phase-27-graph.sh` | No -- Wave 0 |
| KUZU-04 | Assumption nodes in KuzuDB | unit | `bash tests/test-phase-27-assumptions.sh` | No -- Wave 0 |
| KUZU-05 | Confidence on edges | unit | `bash tests/test-phase-27-confidence.sh` | No -- Wave 0 |
| ROOM-04 | .proactive-intelligence.json written | integration | `bash tests/test-phase-27-proactive.sh` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `bash tests/test-phase-15.sh` (existing KuzuDB smoke test)
- **Per wave merge:** `bash tests/run-all.sh`
- **Phase gate:** Full suite green before verify

### Wave 0 Gaps
- [ ] `tests/test-phase-27-pipeline.sh` -- full post-write chain integration test
- [ ] `tests/test-phase-27-assumptions.sh` -- Assumption node CRUD
- [ ] `tests/test-phase-27-meetings.sh` -- Meeting + Speaker + SEGMENT_OF
- [ ] `tests/fixtures/test-room-meeting/` -- meeting fixture data (metadata.yaml, transcript, segments)

## Sources

### Primary (HIGH confidence)
- `/home/jsagi/MindrianOS-Plugin/lib/core/lazygraph-ops.cjs` -- Current KuzuDB schema, indexArtifact, queryGraph, all CRUD operations
- `/home/jsagi/MindrianOS-Plugin/scripts/post-write` -- Current hook chain (Phase 26: classify + index + git-ops)
- `/home/jsagi/MindrianOS-Plugin/scripts/build-graph` -- 735-line bash Cytoscape JSON builder
- `/home/jsagi/MindrianOS-Plugin/scripts/generate-export.cjs` -- KuzuDB query pattern (queryLazyGraph function, lines 370-471)
- `/home/jsagi/MindrianOS-Plugin/scripts/analyze-room` -- GAP/CONVERGE/CONTRADICT detection
- `/home/jsagi/MindrianOS-Plugin/scripts/compute-state` -- STATE.md generation
- `/home/jsagi/MindrianOS-Plugin/scripts/git-ops` -- Git commit/push operations
- `/home/jsagi/MindrianOS-Plugin/lib/core/graph-ops.cjs` -- CJS wrapper: buildGraph, indexArtifact, rebuildGraph, queryGraph, graphStats
- `/home/jsagi/MindrianOS-Plugin/docs/lazygraph-schema.md` -- Schema reference, KuzuDB dialect notes
- `/home/jsagi/MindrianOS-Plugin/references/meeting/artifact-template.md` -- Full meeting artifact frontmatter spec
- `/home/jsagi/MindrianOS-Plugin/references/meeting/cross-relationship-patterns.md` -- 5 edge types, detection heuristics, batch scan protocol
- `/home/jsagi/MindrianOS-Plugin/commands/file-meeting.md` -- 6-step meeting filing pipeline
- `/home/jsagi/MindrianOS-Plugin/package.json` -- kuzu 0.11.3, gray-matter 4.0.3
- `/home/jsagi/MindrianOS-Plugin/hooks/hooks.json` -- PostToolUse:Write -> post-write (3000ms timeout)
- `npm view kuzu version` -- confirmed 0.11.3 is latest

### Secondary (MEDIUM confidence)
- KuzuDB documentation on ALTER TABLE (training data, verified via schema docs)
- KuzuDB concurrent access behavior (one write connection, multiple read)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and working in the codebase
- Architecture: HIGH -- patterns established in Phase 15/26, extending not rewriting
- Pitfalls: HIGH -- based on actual code analysis of existing hook timing, KuzuDB locking, schema patterns

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable -- KuzuDB 0.11.3 is pinned, codebase patterns are established)
