# Phase 15: User Knowledge Graph - Research

**Researched:** 2026-03-25
**Domain:** Embedded graph database (KuzuDB) for per-project queryable knowledge graph
**Confidence:** MEDIUM (see critical finding below)

## Summary

Phase 15 adds a persistent, queryable knowledge graph to each MindrianOS room using an embedded graph database. The graph captures inter-room relationships (INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES) as typed edges between room artifact nodes, making Simon's "weak interactions between subsystems" queryable via Cypher. The existing `build-graph` script and `analyze-room` already detect these relationships and output them as JSON -- Phase 15 persists them in a proper graph database with Cypher query support.

**Critical finding: KuzuDB was acquired by Apple in October 2025 and archived.** The GitHub repository was archived on October 10, 2025, and the docs site (docs.kuzudb.com) is offline. The `kuzu` npm package v0.11.3 remains installable and functional, but receives no updates. Two community forks exist: RyuGraph (Predictable Labs) and a Vela Partners fork. The recommendation is to **proceed with the archived `kuzu@0.11.3` npm package** for the following reasons: (1) the API is stable and complete for our needs, (2) our usage is simple (tens to hundreds of nodes, not millions), (3) the MIT license allows indefinite use, (4) the Node.js binding is pre-built for all platforms, and (5) switching to a fork later is trivial since the Cypher dialect and API are identical.

**Primary recommendation:** Use `kuzu@0.11.3` as a new npm dependency. Create `lib/core/lazygraph-ops.cjs` module that wraps KuzuDB operations. Extend `graph-ops.cjs` to add KuzuDB-backed commands alongside the existing `build-graph` script. Hook-driven updates via the existing PostToolUse/Write hook. Natural language query translation handled by Larry (prompt-based, not code-based).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- KuzuDB as the embedded graph engine (like SQLite for graphs) -- zero server, zero setup, runs in-process
- Two-Graph Architecture: Brain (Neo4j, remote) = methodology; Room Graph (KuzuDB, local) = venture data
- Graph stored in `room/.lazygraph/` directory (per-project, embedded)
- Tiered capability: Tier 0 (in-memory from analyze-room), Tier 1 (KuzuDB persistent), Tier 2 (+ Pinecone semantic)
- Five edge types: INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES
- Natural language queries translated to Cypher by Larry
- Hook-driven auto-updates on artifact filing
- Dual delivery: CLI commands + MCP tools

### Claude's Discretion
- KuzuDB Node.js binding API specifics
- Graph schema design (node types, property names)
- Pinecone embedding strategy for Tier 2
- How to handle graph migration when room structure changes
- Performance optimization for large rooms

### Deferred Ideas (OUT OF SCOPE)
- Full HSI reverse salient detection via graph (v4.0)
- Graph-powered assumption validity tracking
- Cross-user anonymized graph patterns
- Graph export for investor presentations
- Real-time graph updates during conversation (vs post-write hook)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GRAPH-01 | Room artifacts automatically indexed as KuzuDB nodes (embedded, one DB per project in room/.lazygraph/) | KuzuDB Node.js API: `new Database("room/.lazygraph")` creates file-based DB; schema-first approach requires CREATE NODE TABLE before inserts |
| GRAPH-02 | Cross-references (INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES) stored as typed edges | KuzuDB CREATE REL TABLE per edge type; MERGE for upsert; existing analyze-room already detects these relationships |
| GRAPH-03 | User can query project graph via /mos:query with natural language (Larry translates to Cypher) | KuzuDB is Cypher-compatible; Larry generates Cypher from NL; conn.query() returns structured results |
| GRAPH-04 | Room artifacts embedded in user-owned Pinecone index for semantic search (optional Tier 2) | Pinecone MCP tools already available; embedding at filing time; cross-reference with KuzuDB graph for hybrid search |
| GRAPH-05 | Graph auto-updates when new artifacts are filed (hook-driven) | Existing PostToolUse/Write hook in hooks.json; extend post-write script to call lazygraph-ops index function |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| kuzu | 0.11.3 | Embedded graph database with Cypher | Only embedded graph DB with Node.js bindings, Cypher support, and pre-built binaries for all platforms. Archived but stable and complete for our scale. MIT license. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @modelcontextprotocol/sdk | ^1.27.1 | MCP tool registration | Already installed; graph query and index tools register here |
| Pinecone MCP | existing | Semantic embeddings for Tier 2 | Only when user opts into Tier 2 semantic layer |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| kuzu@0.11.3 (archived) | RyuGraph (Predictable Labs fork) | No npm package yet; must build from source; overkill for our scale. Switch trivially later if needed. |
| kuzu@0.11.3 | Vela Partners fork | Python-only enhanced fork; no Node.js package. Focused on multi-writer (not needed for single-user room). |
| kuzu@0.11.3 | DuckPGQ (DuckDB graph extension) | SQL/PGQ syntax, not Cypher. Would break Brain/Room graph query language parity. |
| kuzu@0.11.3 | Pure JSON graph (graph.json) | Already exists via build-graph. No Cypher queries, no indexes, no MERGE semantics. KuzuDB adds real query power. |

**Installation:**
```bash
npm install kuzu@0.11.3
```

**Total new npm dependencies for Phase 15: 1** (`kuzu`). This brings the project to 3 total npm deps (`@modelcontextprotocol/sdk`, `kuzu`).

## Architecture Patterns

### Recommended Project Structure
```
lib/core/
├── lazygraph-ops.cjs    # NEW: KuzuDB wrapper (create/open DB, schema, index, query)
├── graph-ops.cjs        # EXTEND: add lazygraph subcommands alongside existing buildGraph
├── room-ops.cjs         # EXISTING: analyzeRoom output feeds graph indexing
├── section-registry.cjs # EXISTING: discoverSections provides node metadata

room/.lazygraph/          # KuzuDB database directory (per-project, gitignored)

scripts/
├── build-graph           # EXISTING: still generates dashboard JSON
├── analyze-room          # EXISTING: provides relationship detection input
```

### Pattern 1: Schema-First Graph Initialization
**What:** KuzuDB requires explicit schema creation before data insertion (unlike Neo4j's schema-optional model). On first use or when schema needs updating, create all node and relationship tables.
**When to use:** First call to any lazygraph command, or when room structure changes.
**Example:**
```javascript
// Source: KuzuDB official docs (archived) + npm package API
const kuzu = require('kuzu');

async function initLazyGraph(lazygraphDir) {
  const db = new kuzu.Database(lazygraphDir);
  const conn = new kuzu.Connection(db);

  // Node tables
  await conn.query(`
    CREATE NODE TABLE IF NOT EXISTS Artifact(
      id STRING PRIMARY KEY,
      title STRING,
      section STRING,
      methodology STRING,
      created STRING,
      content_hash STRING
    )
  `);

  await conn.query(`
    CREATE NODE TABLE IF NOT EXISTS Section(
      name STRING PRIMARY KEY,
      label STRING,
      color STRING
    )
  `);

  // Relationship tables (one per edge type)
  await conn.query(`CREATE REL TABLE IF NOT EXISTS INFORMS(FROM Artifact TO Artifact)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS CONTRADICTS(FROM Artifact TO Artifact, confidence STRING)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS CONVERGES(FROM Artifact TO Artifact, term STRING)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS ENABLES(FROM Artifact TO Artifact)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS INVALIDATES(FROM Artifact TO Artifact)`);
  await conn.query(`CREATE REL TABLE IF NOT EXISTS BELONGS_TO(FROM Artifact TO Section)`);

  return { db, conn };
}
```

### Pattern 2: Incremental Artifact Indexing (Hook-Driven)
**What:** When a post-write hook fires, index only the changed artifact and re-scan its relationships.
**When to use:** Every artifact filing (methodology session, meeting segment, manual edit).
**Example:**
```javascript
// Called from post-write hook via mindrian-tools.cjs graph index <roomDir> <filePath>
async function indexArtifact(conn, roomDir, filePath) {
  const id = getArtifactId(filePath, roomDir);
  const title = extractTitle(filePath);
  const section = extractSection(filePath, roomDir);
  const methodology = extractFrontmatter(filePath, 'methodology');
  const contentHash = computeHash(filePath);

  // Upsert artifact node
  await conn.query(`
    MERGE (a:Artifact {id: $id})
    ON CREATE SET a.title = $title, a.section = $section,
                  a.methodology = $methodology, a.content_hash = $contentHash
    ON MATCH SET a.title = $title, a.methodology = $methodology,
                 a.content_hash = $contentHash
  `, { id, title, section, methodology, contentHash });

  // Upsert section node
  await conn.query(`
    MERGE (s:Section {name: $section})
  `, { section });

  // Upsert BELONGS_TO
  await conn.query(`
    MATCH (a:Artifact {id: $id}), (s:Section {name: $section})
    MERGE (a)-[:BELONGS_TO]->(s)
  `, { id, section });

  // Scan for cross-references and create edges
  await scanAndCreateEdges(conn, roomDir, id, filePath);
}
```

### Pattern 3: Natural Language Query via Larry
**What:** User asks a question in natural language. Larry translates to Cypher, executes against KuzuDB, formats results.
**When to use:** /mos:query command or MCP query tool.
**Example flow:**
```
User: "What contradicts my pricing assumption?"
Larry generates: MATCH (a:Artifact)-[:CONTRADICTS]->(b:Artifact)
                 WHERE b.section = 'financial-model'
                 RETURN a.title, a.section, b.title
Larry formats: "Your market analysis entry 'B2C Consumer Trends' contradicts
               the pricing in 'Revenue Projections' -- different customer type assumptions."
```
**Implementation:** The /mos:query command passes the question + graph schema to Larry. Larry returns Cypher. The tool executes it and returns raw results. Larry formats the response.

### Pattern 4: Full Rebuild from analyze-room Output
**What:** Rebuild the entire graph from scratch by running analyze-room and parsing its structured output.
**When to use:** First-time graph creation for an existing room, or after schema migration.
**Example:**
```javascript
async function rebuildGraph(conn, roomDir) {
  // Clear existing data
  await conn.query('MATCH (n) DETACH DELETE n');

  // Index all artifacts
  const sections = discoverSections(roomDir);
  for (const section of sections.all) {
    const sectionDir = path.join(roomDir, section);
    const files = fs.readdirSync(sectionDir).filter(f =>
      f.endsWith('.md') && f !== 'STATE.md' && f !== 'ROOM.md'
    );
    for (const file of files) {
      await indexArtifact(conn, roomDir, path.join(sectionDir, file));
    }
  }

  // Run analyze-room for relationship detection
  const analysis = roomOps.analyzeRoom(roomDir);
  await parseAnalysisToEdges(conn, analysis);
}
```

### Anti-Patterns to Avoid
- **Opening a new Database instance per query:** KuzuDB Database objects are heavyweight (they load the catalog, open WAL files). Open once, reuse the connection. Close explicitly when done.
- **Storing full artifact content in graph nodes:** KuzuDB is for relationships, not document storage. Store only metadata (id, title, section, methodology, content_hash). Read full content from the .md files.
- **Running graph operations synchronously in hooks:** The 3-second hook timeout is tight. Graph indexing must be fast. For a single artifact index, KuzuDB sub-millisecond latency is fine. For full rebuilds, use async or the CLI command, not the hook.
- **Using Neo4j APOC functions:** KuzuDB has no APOC. Stick to standard Cypher. All queries must be validated against KuzuDB's Cypher dialect.
- **Hardcoding edge types:** Use the 5 established edge types from CONTEXT.md. Don't invent new ones without updating the schema.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Graph storage | JSON file with adjacency lists | KuzuDB embedded DB | Cypher queries, MERGE semantics, indexes, ACID transactions |
| Relationship detection | New detection logic | Existing analyze-room output | Already detects CONTRADICTS, CONVERGES; add INFORMS/ENABLES/INVALIDATES parsing |
| Cross-reference scanning | Custom regex parser | Existing build-graph wikilink parser | Lines 458-529 of build-graph already extract [[wikilinks]] and track concept references |
| Natural language to Cypher | Custom NL parser | Larry prompt with schema context | LLM-native task; provide schema + examples in prompt |
| Graph visualization | New dashboard | Existing De Stijl dashboard + graph.json | build-graph continues to output dashboard JSON; KuzuDB is the persistent query backend |

**Key insight:** Most of the relationship detection logic already exists in `analyze-room` (CONTRADICTS, CONVERGES) and `build-graph` (INFORMS via wikilinks, FEEDS_INTO via pipelines). Phase 15 persists these into KuzuDB rather than rebuilding detection from scratch.

## Common Pitfalls

### Pitfall 1: KuzuDB Archived -- No Security Patches
**What goes wrong:** Using an archived package that receives no security or bug fixes.
**Why it happens:** Apple acquired KuzuDB in October 2025 and archived the repository.
**How to avoid:** (1) The package is embedded/local-only with no network exposure -- attack surface is minimal. (2) Pin to exact version 0.11.3. (3) If a critical CVE emerges, swap to RyuGraph fork (API-compatible). (4) Monitor the kuzu npm page and RyuGraph/Vela forks quarterly.
**Warning signs:** npm audit warnings on the kuzu package; RyuGraph publishing an npm package.

### Pitfall 2: Schema-First Requirement Breaks Dynamic Sections
**What goes wrong:** KuzuDB requires `CREATE NODE TABLE` before data insertion. New room sections added dynamically won't have corresponding graph structure.
**Why it happens:** Unlike Neo4j which auto-creates labels, KuzuDB enforces schema.
**How to avoid:** Use a single `Artifact` node table with a `section` STRING property (not one table per section). Use `IF NOT EXISTS` on all CREATE TABLE statements. Run schema initialization every time the graph is opened.
**Warning signs:** "Table not found" errors when indexing artifacts from new sections.

### Pitfall 3: Hook Timeout Exceeded by Graph Rebuild
**What goes wrong:** Full graph rebuild takes >3 seconds, exceeding PostToolUse hook timeout.
**Why it happens:** Large rooms with 100+ artifacts require many sequential inserts.
**How to avoid:** Hook only indexes the SINGLE changed artifact (incremental). Full rebuild is a separate CLI command (`/mos:graph rebuild`), not a hook action. Single-artifact index should take <100ms even with relationship scanning.
**Warning signs:** Hook timeouts in Claude Code logs; graph getting out of sync.

### Pitfall 4: KuzuDB Walk Semantics vs Neo4j Trail Semantics
**What goes wrong:** Variable-length path queries return unexpected results because KuzuDB allows repeated edges (walk semantic) while Neo4j doesn't (trail semantic).
**Why it happens:** Fundamental Cypher dialect difference documented at docs.kuzudb.com/cypher/difference/.
**How to avoid:** Always specify upper bounds on variable-length paths (KuzuDB default max is 30). For path queries, use `SHORTEST` keyword. Document this in the schema reference for Larry's query generation prompt.
**Warning signs:** Queries returning exponentially many results; infinite-seeming query times.

### Pitfall 5: Database File Locking on Concurrent Access
**What goes wrong:** Two processes try to open the same .lazygraph directory simultaneously.
**Why it happens:** Hook fires while user is running a query command; MCP server and CLI both access the graph.
**How to avoid:** Open database with read-only mode for queries; write operations serialized through a single code path. KuzuDB uses WAL (Write-Ahead Logging) which supports concurrent reads but single writer. For this project (single user, sequential operations), this is fine.
**Warning signs:** "Database is locked" errors; corrupted WAL files.

### Pitfall 6: MERGE Requires Existing Schema (Different from Neo4j)
**What goes wrong:** `MERGE (a:NewLabel {id: $id})` fails because KuzuDB requires the node table to exist first.
**Why it happens:** Neo4j auto-creates labels on MERGE; KuzuDB does not.
**How to avoid:** Always run schema initialization before any MERGE. Use `CREATE NODE TABLE IF NOT EXISTS` and `CREATE REL TABLE IF NOT EXISTS` in the init function.
**Warning signs:** "Table not found" errors on MERGE operations.

## Code Examples

### Opening and Querying a LazyGraph
```javascript
// Source: KuzuDB npm docs + official getting started guide
const kuzu = require('kuzu');
const path = require('path');

async function openLazyGraph(roomDir) {
  const lazygraphDir = path.join(path.resolve(roomDir), '.lazygraph');
  // Ensure directory exists
  const fs = require('fs');
  if (!fs.existsSync(lazygraphDir)) {
    fs.mkdirSync(lazygraphDir, { recursive: true });
  }

  const db = new kuzu.Database(lazygraphDir);
  const conn = new kuzu.Connection(db);

  // Ensure schema exists (idempotent)
  await initSchema(conn);

  return { db, conn };
}

async function queryGraph(conn, cypherQuery) {
  const result = await conn.query(cypherQuery);
  const rows = await result.getAll();
  return rows;
}

// Cleanup -- important to close DB properly
function closeLazyGraph(db) {
  // KuzuDB Node.js binding handles cleanup on GC,
  // but explicit close is good practice
  db.close();
}
```

### Indexing a Single Artifact (Hook Path)
```javascript
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function computeContentHash(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

function getArtifactId(filePath, roomDir) {
  const rel = path.relative(path.resolve(roomDir), path.resolve(filePath));
  return rel.replace(/\.md$/, '').replace(/\\/g, '/');
}

async function indexSingleArtifact(conn, roomDir, filePath) {
  const id = getArtifactId(filePath, roomDir);
  const section = id.split('/')[0];
  const contentHash = computeContentHash(filePath);

  // Read file for metadata
  const content = fs.readFileSync(filePath, 'utf-8');
  const title = (content.match(/^# (.+)$/m) || [null, path.basename(filePath, '.md')])[1];

  // Extract methodology from frontmatter
  const methodMatch = content.match(/^methodology:\s*(.+)$/m);
  const methodology = methodMatch ? methodMatch[1].trim().replace(/"/g, '') : '';

  // Upsert artifact
  await conn.query(
    `MERGE (a:Artifact {id: '${id}'})
     ON CREATE SET a.title = '${title}', a.section = '${section}',
                   a.methodology = '${methodology}', a.content_hash = '${contentHash}'
     ON MATCH SET a.title = '${title}', a.methodology = '${methodology}',
                  a.content_hash = '${contentHash}'`
  );

  // Upsert section + BELONGS_TO
  await conn.query(`MERGE (s:Section {name: '${section}'})`);
  await conn.query(
    `MATCH (a:Artifact {id: '${id}'}), (s:Section {name: '${section}'})
     MERGE (a)-[:BELONGS_TO]->(s)`
  );

  // Scan for [[wikilinks]] to create INFORMS edges
  const wikilinks = content.match(/\[\[([^\]]+)\]\]/g) || [];
  for (const link of wikilinks) {
    const target = link.replace(/\[\[|\]\]/g, '').toLowerCase().replace(/\s/g, '-');
    // Check if target is a section name
    await conn.query(
      `MATCH (a:Artifact {id: '${id}'}), (t:Artifact)
       WHERE t.section = '${target}'
       MERGE (a)-[:INFORMS]->(t)`
    );
  }

  return { id, section, title, contentHash };
}
```

### CLI Entry Point Pattern
```javascript
// In mindrian-tools.cjs, extend the graph command group:
case 'graph': {
  switch (subcommand) {
    case 'build': {
      // Existing: generate dashboard JSON
      const result = graphOps.buildGraph(roomDir, outputPath);
      output(result, raw, JSON.stringify(result));
      break;
    }
    case 'index': {
      // NEW: index a single artifact into KuzuDB
      const filePath = argv[3];
      const result = await graphOps.indexArtifact(roomDir, filePath);
      output(result, raw, JSON.stringify(result));
      break;
    }
    case 'rebuild': {
      // NEW: full graph rebuild from all room artifacts
      const result = await graphOps.rebuildGraph(roomDir);
      output(result, raw, JSON.stringify(result));
      break;
    }
    case 'query': {
      // NEW: execute Cypher query against KuzuDB
      const cypher = argv[3];
      const result = await graphOps.queryGraph(roomDir, cypher);
      output(result, raw, JSON.stringify(result));
      break;
    }
    case 'stats': {
      // NEW: graph statistics (node count, edge count, per-type counts)
      const result = await graphOps.graphStats(roomDir);
      output(result, raw, JSON.stringify(result));
      break;
    }
  }
}
```

## KuzuDB Cypher Dialect -- Key Differences from Neo4j

| Feature | Neo4j | KuzuDB | Impact |
|---------|-------|--------|--------|
| Schema | Optional (labels auto-created) | Mandatory (CREATE NODE TABLE first) | Must init schema before any data ops |
| Pattern matching | Trail semantic (no repeated edge) | Walk semantic (allows repeated edge) | Add upper bounds to variable-length paths |
| Variable-length paths | No default upper bound | Default upper bound = 30 | Explicit bounds recommended |
| MERGE | Works without prior schema | Requires table to exist | Always run schema init first |
| SHORTEST path | `shortestPath()` function | `SHORTEST` keyword in MATCH | Different syntax for path algorithms |
| List functions | `collect()`, `size()` | `list_concat()`, `list_reverse()` etc. | Use `list_` prefix for list operations |
| APOC | Available | Not available | No APOC. Pure Cypher only. |
| Index creation | `CREATE INDEX` | Not supported on custom properties | Rely on primary key indexes only |
| Type system | Flexible | Postgres-style strict typing | All LIST elements must be same type |
| Case sensitivity | Labels case-sensitive | Table names case-insensitive | Minor but be aware |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| KuzuDB as maintained OSS | KuzuDB archived (Apple acquisition) | Oct 2025 | npm package works but no updates; forks emerging |
| graph.json flat file (build-graph) | KuzuDB persistent graph + graph.json for dashboard | Phase 15 | Cypher queryability, MERGE semantics, persistence |
| analyze-room text output | analyze-room feeds KuzuDB edges | Phase 15 | Relationships become queryable, not just reportable |

**Deprecated/outdated:**
- KuzuDB docs site (docs.kuzudb.com): OFFLINE. Use GitHub-hosted docs at kuzudb.github.io/docs/ or cached API docs at kuzudb.github.io/api-docs/nodejs/
- KuzuDB npm `@next` tag: Do not use dev builds from archived project

## Open Questions

1. **KuzuDB native binary compatibility with Claude Code plugin distribution**
   - What we know: kuzu npm package includes pre-built native binaries for Linux x86-64, macOS Universal, Windows x86-64. Installs via `npm install kuzu`.
   - What's unclear: Whether Claude Code plugin installs handle native binaries correctly, or if users need to run `npm install` separately.
   - Recommendation: Test install flow on all three platforms. If native binary causes issues, fall back to `@kuzu/kuzu-wasm` (WebAssembly build, slower but no native deps). Pin to 0.11.3 exactly.

2. **Graph initialization timing**
   - What we know: Schema must be created before any data operations. First-time graph creation from an existing room requires full rebuild.
   - What's unclear: Should graph init happen on SessionStart hook, on first query, or on explicit command?
   - Recommendation: Lazy initialization on first graph command. If `.lazygraph/` directory doesn't exist, create schema + run full rebuild. Subsequent calls just open and connect.

3. **Relationship detection completeness for ENABLES and INVALIDATES**
   - What we know: analyze-room detects CONTRADICTS and CONVERGES. build-graph detects INFORMS (via wikilinks). ENABLES and INVALIDATES are not detected by existing scripts.
   - What's unclear: How to detect ENABLES and INVALIDATES without LLM analysis.
   - Recommendation: Tier 1 stores INFORMS, CONTRADICTS, CONVERGES from existing detection. ENABLES and INVALIDATES are Tier 2 (require semantic analysis via Pinecone/LLM). Document this tiering explicitly in GRAPH-02 implementation.

4. **Parameterized queries vs string interpolation**
   - What we know: KuzuDB supports parameterized queries with `$` prefix. The Node.js API supports passing parameters.
   - What's unclear: Exact parameter passing syntax in the Node.js binding (the docs site is offline).
   - Recommendation: Use string interpolation with proper escaping for v1, then refactor to parameterized queries once API behavior is validated. Sanitize all user-provided strings to prevent Cypher injection.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in assert + custom test runner (no framework installed) |
| Config file | none -- see Wave 0 |
| Quick run command | `node tests/test-lazygraph.cjs` |
| Full suite command | `node tests/run-all.cjs` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRAPH-01 | Artifacts indexed as KuzuDB nodes | unit | `node tests/test-lazygraph.cjs::indexArtifact` | -- Wave 0 |
| GRAPH-02 | 5 edge types stored as typed relationships | unit | `node tests/test-lazygraph.cjs::edgeTypes` | -- Wave 0 |
| GRAPH-03 | Cypher query returns structured results | unit | `node tests/test-lazygraph.cjs::queryGraph` | -- Wave 0 |
| GRAPH-04 | Pinecone embedding integration | manual-only | Manual -- requires Pinecone API key | -- Tier 2 |
| GRAPH-05 | Hook-driven auto-update | integration | `node tests/test-lazygraph.cjs::hookTrigger` | -- Wave 0 |

### Sampling Rate
- **Per task commit:** `node tests/test-lazygraph.cjs`
- **Per wave merge:** Full suite including CLI and MCP integration
- **Phase gate:** All GRAPH-01 through GRAPH-05 (except GRAPH-04 manual) green

### Wave 0 Gaps
- [ ] `tests/test-lazygraph.cjs` -- covers GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-05
- [ ] `tests/fixtures/test-room/` -- minimal room with 3 sections, 5 artifacts, cross-references
- [ ] `npm install kuzu@0.11.3` -- dependency installation
- [ ] Verify `kuzu` native binary loads correctly on development platform (WSL2 Linux)

## Sources

### Primary (HIGH confidence)
- [kuzu npm package](https://www.npmjs.com/package/kuzu) - v0.11.3, MIT license, pre-built binaries
- [KuzuDB Node.js API docs (GitHub-hosted)](https://kuzudb.github.io/api-docs/nodejs/) - Database, Connection, QueryResult classes
- [KuzuDB Getting Started (GitHub-hosted)](https://kuzudb.github.io/docs/get-started/) - Full Node.js example with schema creation
- [KuzuDB Cypher Differences](https://docs.kuzudb.com/cypher/difference/) - Schema-first, walk semantics, list functions (cached before site went offline)
- Existing codebase: `scripts/build-graph` (706 lines), `scripts/analyze-room` (426 lines), `lib/core/graph-ops.cjs`, `lib/core/section-registry.cjs`

### Secondary (MEDIUM confidence)
- [Apple acquires KuzuDB - MacRumors](https://www.macrumors.com/2026/02/11/apple-acquires-new-database-app/) - Acquisition confirmed Feb 2026 reporting, Oct 2025 agreement
- [9to5Mac - Kuzu acquisition](https://9to5mac.com/2026/02/11/kuzu-database-company-joins-apples-list-of-recent-acquisitions/) - GitHub archived Oct 10, 2025
- [Vela Partners KuzuDB fork](https://www.vela.partners/blog/kuzudb-ai-agent-memory-graph-database) - Multi-writer fork, Python-only, API-compatible
- [RyuGraph (Predictable Labs fork)](https://github.com/predictable-labs/ryugraph) - Active fork, MIT license, v25.9.2
- [KuzuDB abandoned - The Register](https://www.theregister.com/2025/10/14/kuzudb_abandoned/) - Community reaction and fork landscape

### Tertiary (LOW confidence)
- KuzuDB parameterized query syntax in Node.js - docs site offline, API behavior needs runtime validation
- RyuGraph npm package availability - not confirmed as of research date

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - kuzu@0.11.3 is stable and functional but archived; no updates coming; forks exist but immature
- Architecture: HIGH - Pattern follows existing codebase conventions exactly (lib/core/*.cjs wrapping, mindrian-tools.cjs routing, hook integration)
- Pitfalls: HIGH - KuzuDB Cypher differences well-documented; archival risk is real but mitigated by MIT license and simple usage pattern

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (monitor RyuGraph npm publication; if available, evaluate as drop-in replacement)
