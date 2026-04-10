# Architecture Patterns: MCP Server + Plugin Co-Development with SQLite Migration

**Domain:** Claude Code plugin + MCP server co-development, embedded graph DB migration
**Researched:** 2026-04-09

## Recommended Architecture

### System Overview

```
User (Claude Code CLI / Desktop / Cowork / ChatGPT / VS Code)
    |
    +-- Plugin Layer (commands/ skills/ hooks/)
    |       |
    |       +-- mindrian-tools.cjs (CLI entry)
    |       |       |
    |       |       +-- lib/core/*.cjs  <-- SHARED CORE
    |       |                               |
    +-- MCP Server (stdio)                  |
    |       |                               |
    |       +-- mindrian-mcp-server.cjs     |
    |               |                       |
    |               +-- lib/core/*.cjs  ----+ (SAME modules)
    |
    +-- MCP Apps (ui:// resources)
    |       |
    |       +-- Bundled HTML (vite-plugin-singlefile)
    |       +-- @modelcontextprotocol/ext-apps client SDK
    |       +-- De Stijl dashboards rendered in sandboxed iframes
    |
    +-- Brain MCP (remote, brain.mindrian.ai)
            |
            +-- Neo4j + Pinecone (separate server, separate codebase)

Data Layer:
    room/.mindrian/room.db  (SQLite WAL mode)
        +-- nodes table (JSON body, generated id column)
        +-- edges table (source, target, type, properties JSON)
        +-- memory_identity (L0)
        +-- memory_facts (L1, temporal validity)
        +-- memory_sessions (L2)
        +-- memory_fragments (L3)
        +-- assumptions (validity lifecycle)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `mindrian-tools.cjs` | CLI entry point, process.argv routing | lib/core/*.cjs via require() |
| `mindrian-mcp-server.cjs` | MCP stdio server, Zod-validated tool handlers | lib/core/*.cjs via require() |
| `lib/core/lazygraph-ops.cjs` | Graph operations (SQLite internals, API unchanged) | room.db via better-sqlite3 |
| `lib/core/graph-ops.cjs` | Write queue, open-use-close orchestration | lazygraph-ops.cjs, write-lock.cjs |
| `lib/core/intelligence-cascade.cjs` | 6-step post-write pipeline | graph-ops.cjs, scripts/*.py |
| `lib/core/write-lock.cjs` | File-based write lock with PID tracking | Filesystem (.mindrian/write.lock) |
| `mcp-apps/` | Bundled HTML apps for ui:// resources | ext-apps SDK, MCP server |
| `mcp-server-brain/` | Remote Brain API (UNCHANGED) | Neo4j Aura, Pinecone |

### Data Flow

**Plugin write path:**
```
Hook fires --> intelligence-cascade.cjs --> graph-ops.enqueueWrite()
  --> write-lock.cjs acquireLock() --> lazygraph-ops.indexArtifact()
  --> SQLite room.db (WAL mode) --> releaseLock()
  --> HSI compute --> presentation regenerate
```

**MCP tool read path:**
```
Client calls tool --> mindrian-mcp-server.cjs handler
  --> lib/core/graph-ops.queryGraph(roomDir, sql)
  --> lazygraph-ops.openGraph() --> SQLite room.db (WAL reader)
  --> return JSON result
```

**MCP Apps render path:**
```
Client calls tool with _meta.ui.resourceUri --> server returns tool result
  --> host fetches ui:// resource --> server reads bundled HTML from dist/
  --> host renders in sandboxed iframe --> App.connect() establishes postMessage
  --> UI calls app.callServerTool() for interactive updates
```

## Architecture Decision 1: Co-Development -- Single Repo, Dual Entry Points

**Pattern:** Both the plugin (CLI) and MCP server live in the same repo and share `lib/core/*.cjs` modules. They are two entry points into the same logic.

### How It Works

```
MindrianOS-Plugin/
  bin/
    mindrian-tools.cjs        # CLI entry: process.argv -> core functions
    mindrian-mcp-server.cjs   # MCP entry: McpServer + StdioTransport -> core functions
  lib/core/
    lazygraph-ops.cjs          # Graph operations (SQLite internals)
    graph-ops.cjs              # Write queue + open-use-close wrapper
    intelligence-cascade.cjs   # Post-write pipeline
    brain-client.cjs           # Brain API calls
    room-ops.cjs               # Room state operations
    ... (31 total core modules)
```

**CLI tool handler pattern:**
```javascript
// bin/mindrian-tools.cjs
const graphOps = require('../lib/core/graph-ops.cjs');
// ... process.argv switch/case
case 'graph-query':
  const result = await graphOps.queryGraph(roomDir, query);
  process.stdout.write(JSON.stringify(result));
  break;
```

**MCP tool handler pattern:**
```javascript
// bin/mindrian-mcp-server.cjs
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const graphOps = require('../lib/core/graph-ops.cjs');
const { z } = require('zod');

const server = new McpServer({ name: 'mindrian', version: '2.0.0' });

server.tool('graph_query', { roomDir: z.string(), query: z.string() },
  async ({ roomDir, query }) => {
    const result = await graphOps.queryGraph(roomDir, query);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);
```

**Co-development rule enforcement:** Every function in `lib/core/*.cjs` MUST be pure business logic with no CLI or MCP awareness. Entry points (CLI/MCP) handle I/O formatting. Core handles computation.

### Why This Works

- Already proven: graph-ops.cjs wraps lazygraph-ops.cjs. MCP tools will wrap graph-ops.cjs the same way.
- Zero duplication. One fix propagates to both surfaces.
- The 31 core modules already have clean function signatures (roomDir, filePath, options) -- no CLI coupling.
- Matches the existing mcp-server-brain pattern (server.cjs wraps lib/*.cjs).

## Architecture Decision 2: SQLite Migration -- Replace Internals, Keep API

**Pattern:** Replace KuzuDB inside lazygraph-ops.cjs with better-sqlite3. The module's exports stay IDENTICAL. Every consumer (graph-ops.cjs, intelligence-cascade.cjs, 24+ files) continues calling the same functions.

### Schema Design: Graph Tables

Use the simple-graph pattern (nodes + edges with JSON properties) adapted for typed node/edge semantics:

```sql
-- Enable WAL mode (set once on DB creation)
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

-- Node tables
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'Artifact',  -- Artifact|Section|CausalClaim|WhitespaceZone
  properties TEXT NOT NULL DEFAULT '{}'   -- JSON blob with all typed fields
);

-- Edge tables
CREATE TABLE IF NOT EXISTS edges (
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  type TEXT NOT NULL,                     -- INFORMS|CONTRADICTS|CONVERGES|... (19 types)
  properties TEXT NOT NULL DEFAULT '{}',  -- JSON blob with edge-specific fields
  UNIQUE(source, target, type),
  FOREIGN KEY(source) REFERENCES nodes(id),
  FOREIGN KEY(target) REFERENCES nodes(id)
);

-- Indexes for graph traversal
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target);
CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type);
CREATE INDEX IF NOT EXISTS idx_edges_source_type ON edges(source, type);
CREATE INDEX IF NOT EXISTS idx_edges_target_type ON edges(target, type);
```

**Why single nodes + single edges table, not per-type tables:**
- KuzuDB required separate tables per node/edge type. SQLite doesn't.
- Single table with type column + JSON properties is simpler and more flexible.
- Adding new node/edge types requires zero schema migration -- just a new type string.
- JSON extraction via `json_extract(properties, '$.field')` handles typed access.
- Graph traversal queries use standard JOINs, no Cypher needed.

### Schema Design: Memory Tables

```sql
-- L0: Identity (who is the user, what is this room about)
CREATE TABLE IF NOT EXISTS memory_identity (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- L1: Facts with temporal validity
CREATE TABLE IF NOT EXISTS memory_facts (
  id TEXT PRIMARY KEY,
  fact TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'inferred',  -- user|inferred|meeting|brain
  confidence REAL NOT NULL DEFAULT 0.5,
  valid_from TEXT,
  valid_until TEXT,
  status TEXT NOT NULL DEFAULT 'active',    -- active|stale|contradicted|archived
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- L2: Session context (recent conversation state)
CREATE TABLE IF NOT EXISTS memory_sessions (
  id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  key_decisions TEXT NOT NULL DEFAULT '[]',  -- JSON array
  open_questions TEXT NOT NULL DEFAULT '[]', -- JSON array
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- L3: Raw fragments (meeting excerpts, quotes, observations)
CREATE TABLE IF NOT EXISTS memory_fragments (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'meeting', -- meeting|artifact|chat|observation
  source_id TEXT,
  tags TEXT NOT NULL DEFAULT '[]',             -- JSON array
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Assumption tracking with validity lifecycle
CREATE TABLE IF NOT EXISTS assumptions (
  id TEXT PRIMARY KEY,
  claim TEXT NOT NULL,
  section TEXT,                                -- room section this assumption belongs to
  status TEXT NOT NULL DEFAULT 'untested',      -- untested|supported|contradicted|stale
  evidence TEXT NOT NULL DEFAULT '[]',          -- JSON array of evidence references
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Migration Pattern: Cypher-to-SQL Translation

The key insight: lazygraph-ops.cjs uses Cypher string construction (MERGE, MATCH, etc.) throughout. Replace each Cypher pattern with an equivalent SQL pattern:

| KuzuDB Cypher | SQLite SQL |
|---------------|------------|
| `MERGE (a:Artifact {id: X}) ON CREATE SET ...` | `INSERT OR REPLACE INTO nodes (id, type, properties) VALUES (?, 'Artifact', ?)` |
| `MATCH (a:Artifact)-[:INFORMS]->(b:Artifact)` | `SELECT * FROM edges WHERE type = 'INFORMS' JOIN nodes ...` |
| `MATCH (a)-[r:CONTRADICTS]->(b) RETURN count(*)` | `SELECT COUNT(*) FROM edges WHERE type = 'CONTRADICTS'` |
| `MATCH (n) DETACH DELETE n` | `DELETE FROM edges; DELETE FROM nodes;` |
| Recursive graph traversal (CASCADES_TO paths) | `WITH RECURSIVE` CTE |

**Example: indexArtifact translation:**
```javascript
// BEFORE (Cypher):
await conn.query(`MERGE (a:Artifact {id: '${esc(id)}'}) ON CREATE SET a.title = '${esc(title)}' ...`);

// AFTER (SQL with prepared statements -- also fixes injection risk):
const stmt = db.prepare('INSERT OR REPLACE INTO nodes (id, type, properties) VALUES (?, ?, ?)');
stmt.run(id, 'Artifact', JSON.stringify({ title, section, methodology, created, content_hash: contentHash }));
```

**Critical improvement:** The current Cypher code uses string interpolation (`'${esc(...)}'`) which is an injection vector. SQLite prepared statements (`?` params) eliminate this class of bugs entirely.

### Open-Use-Close Pattern Replacement

**Current (KuzuDB):**
```javascript
async function openGraph(roomDir) {
  const db = new kuzu.Database(lazygraphPath);
  const conn = new kuzu.Connection(db);
  await initSchema(conn);
  return { db, conn };
}
```

**New (SQLite):**
```javascript
function openGraph(roomDir) {
  const dbPath = path.join(path.resolve(roomDir), '.mindrian', 'room.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  initSchema(db);
  return { db };  // No separate connection object needed
}

function closeGraph(db) {
  db.close();
}
```

**Key difference:** better-sqlite3 is synchronous. All `await conn.query(...)` calls become synchronous `db.prepare(...).run(...)` or `.get(...)`. This simplifies the entire module -- no more async/await in graph operations.

## Architecture Decision 3: Concurrent Access -- WAL Mode

**Problem:** Plugin hooks and MCP server may both access room.db simultaneously.

**Solution:** SQLite WAL (Write-Ahead Logging) mode with these properties:
- Multiple readers can operate concurrently with one writer
- Readers never block writers, writers never block readers
- Only one writer at a time (enforced by SQLite's internal locking)
- `busy_timeout = 5000` causes a write to retry for 5 seconds instead of failing immediately

**What changes in write-lock.cjs:**
The file-based write lock becomes OPTIONAL insurance. SQLite WAL handles concurrent reads natively. The write lock remains useful for:
1. Preventing write starvation (multiple rapid writes from different processes)
2. Ensuring the intelligence cascade runs atomically (index + HSI + presentation as one unit)

**What stays the same:**
- graph-ops.cjs `enqueueWrite()` still serializes writes within a single process
- write-lock.cjs still prevents cross-process write conflicts
- Read operations still bypass the queue (now guaranteed safe by WAL)

## Architecture Decision 4: MCP Apps -- Bundled HTML via Vite

**Pattern:** MCP Apps use `ui://` scheme resources. The MCP server serves bundled HTML (single-file) that renders in sandboxed iframes. Bidirectional communication via `@modelcontextprotocol/ext-apps` postMessage.

### Project Structure for MCP Apps

```
MindrianOS-Plugin/
  mcp-apps/
    src/
      dashboard/
        dashboard.html      # De Stijl dashboard UI
        dashboard.ts         # App client logic
      graph/
        graph.html           # Knowledge graph visualization
        graph.ts             # Cytoscape.js + App client
      wiki/
        wiki.html            # Wiki view
        wiki.ts              # App client logic
    vite.config.ts           # Builds each app to single HTML file
    dist/
      dashboard.html         # Bundled output (CSS + JS inlined)
      graph.html
      wiki.html
```

### Server-Side Registration

```javascript
// bin/mindrian-mcp-server.cjs
const { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE }
  = require('@modelcontextprotocol/ext-apps/server');
const fs = require('fs');
const path = require('path');

const APPS_DIST = path.join(__dirname, '..', 'mcp-apps', 'dist');

// Register dashboard app
registerAppResource(
  server,
  'ui://mindrian/dashboard.html',
  'ui://mindrian/dashboard.html',
  { mimeType: RESOURCE_MIME_TYPE },
  async () => {
    const html = fs.readFileSync(path.join(APPS_DIST, 'dashboard.html'), 'utf-8');
    return { contents: [{ uri: 'ui://mindrian/dashboard.html', mimeType: RESOURCE_MIME_TYPE, text: html }] };
  }
);

registerAppTool(
  server,
  'room_dashboard',
  {
    title: 'Room Dashboard',
    description: 'Show De Stijl room dashboard with knowledge graph',
    inputSchema: { roomDir: z.string() },
    _meta: { ui: { resourceUri: 'ui://mindrian/dashboard.html' } }
  },
  async ({ roomDir }) => {
    const roomOps = require('../lib/core/room-ops.cjs');
    const graphOps = require('../lib/core/graph-ops.cjs');
    const state = roomOps.readState(roomDir);
    const stats = await graphOps.graphStats(roomDir);
    return { content: [{ type: 'text', text: JSON.stringify({ state, stats }) }] };
  }
);
```

### Build Step

```json
{
  "scripts": {
    "build:apps": "cd mcp-apps && INPUT=src/dashboard/dashboard.html vite build && INPUT=src/graph/graph.html vite build && INPUT=src/wiki/wiki.html vite build"
  }
}
```

**Use `vite-plugin-singlefile`** to inline all CSS, JS, and assets into a single HTML file. This is required because MCP Apps iframes have deny-by-default CSP -- no external resource loading unless CSP is explicitly configured.

### UI Client Pattern

```javascript
// mcp-apps/src/dashboard/dashboard.ts
import { App } from '@modelcontextprotocol/ext-apps';

const app = new App({ name: 'Mindrian Dashboard', version: '2.0.0' });
app.connect();

// Receive initial tool result (room state + graph stats)
app.ontoolresult = (result) => {
  const data = JSON.parse(result.content?.find(c => c.type === 'text')?.text || '{}');
  renderDashboard(data);
};

// Interactive: user clicks a section, fetch details
document.addEventListener('click', async (e) => {
  if (e.target.dataset.section) {
    const result = await app.callServerTool({
      name: 'room_analyze',
      arguments: { roomDir: currentRoomDir, section: e.target.dataset.section }
    });
    renderSectionDetail(result);
  }
});
```

**Critical constraint:** MCP Apps rendering works across transport types. For local stdio servers, Claude Desktop handles the iframe rendering on its side -- the server just needs to register the resource and serve the HTML. The ui:// resource fetch happens through the same MCP protocol channel regardless of transport.

### What Existing Dashboard Assets to Reuse

The current `dashboard/` directory has De Stijl HTML templates with:
- Cytoscape.js graph visualization
- Mondrian grid layout
- Intelligence views
- Document reader

These become the source material for MCP Apps. The migration path:
1. Extract the HTML/CSS/JS from existing dashboard templates
2. Replace CDN script tags with npm imports (for vite bundling)
3. Add `@modelcontextprotocol/ext-apps` App client
4. Replace file:// data loading with `app.callServerTool()` calls

## Architecture Decision 5: MCP Server -- Local (stdio) + Remote API in One

**Pattern:** The MCP server exposes BOTH local compute tools AND remote Brain API tools through a single McpServer instance.

```javascript
// bin/mindrian-mcp-server.cjs
const server = new McpServer({ name: 'mindrian', version: '2.0.0' });

// Tier 1: Brain intelligence (proxied to remote Brain API)
const brainClient = require('../lib/core/brain-client.cjs');
server.tool('brain_ask', { question: z.string() }, async ({ question }) => {
  const answer = await brainClient.ask(question);
  return { content: [{ type: 'text', text: answer }] };
});

// Tier 2: Room intelligence (local compute via lib/core)
const roomOps = require('../lib/core/room-ops.cjs');
server.tool('room_analyze', { roomDir: z.string() }, async ({ roomDir }) => {
  const analysis = roomOps.analyzeRoom(roomDir);
  return { content: [{ type: 'text', text: JSON.stringify(analysis) }] };
});

// Tier 3: Graph + Export (local SQLite)
const graphOps = require('../lib/core/graph-ops.cjs');
server.tool('graph_query', { roomDir: z.string(), query: z.string() },
  async ({ roomDir, query }) => {
    const result = await graphOps.queryGraph(roomDir, query);
    return { content: [{ type: 'text', text: JSON.stringify(result) }] };
  }
);

// Python compute tools (child_process)
const { execFile } = require('child_process');
server.tool('hsi_score', { roomDir: z.string() }, async ({ roomDir }) => {
  return new Promise((resolve) => {
    execFile('python3', [path.join(SCRIPTS_DIR, 'compute-hsi.py'), roomDir],
      (err, stdout) => {
        resolve({ content: [{ type: 'text', text: err ? `Error: ${err.message}` : stdout }] });
      });
  });
});

// Start with stdio transport (local use)
const transport = new StdioServerTransport();
server.connect(transport);
```

**The user's claude_desktop_config.json:**
```json
{
  "mcpServers": {
    "mindrian": {
      "command": "node",
      "args": ["/path/to/MindrianOS-Plugin/bin/mindrian-mcp-server.cjs"],
      "env": {
        "MINDRIAN_ROOM": "/path/to/room",
        "BRAIN_API_KEY": "optional-key"
      }
    }
  }
}
```

**Design choice: Consolidate Brain into local MCP.** Keep Brain as separate remote MCP AND proxy Brain tools through the local Mindrian server. Desktop users configure ONE server (mindrian) that handles everything. The local server proxies Brain requests via brain-client.cjs. Power users can also add Brain directly for raw access. This reduces user configuration friction from two servers to one.

## Patterns to Follow

### Pattern 1: Adapter Layer (Cypher-to-SQL)

During migration, create a thin adapter that translates the existing queryGraph Cypher calls to SQL. This allows gradual migration without rewriting all 24+ consumer files at once.

**What:** A translation layer inside lazygraph-ops.cjs that accepts the same function signatures but executes SQL instead of Cypher.
**When:** Migration phase. Remove after all direct Cypher callers are updated.

```javascript
// Temporary adapter for queryGraph consumers that pass Cypher
function queryGraph(db, cypherOrSql) {
  // If it looks like Cypher (contains MATCH, RETURN), translate
  if (cypherOrSql.includes('MATCH') && cypherOrSql.includes('RETURN')) {
    const sql = translateCypherToSql(cypherOrSql);
    return db.prepare(sql).all();
  }
  // Otherwise it's already SQL
  return db.prepare(cypherOrSql).all();
}
```

**Note:** This adapter handles only the ~10 Cypher patterns actually used in the codebase (not general Cypher). The patterns are: MERGE node, MATCH node by id, MATCH edges by type, count(*), DETACH DELETE. These translate mechanically.

### Pattern 2: JSON Property Access

**What:** Use SQLite's `json_extract()` for typed property access in queries.
**When:** Any query that needs specific fields from the properties JSON blob.

```sql
-- Get all artifacts in a section with their titles
SELECT id, json_extract(properties, '$.title') AS title
FROM nodes
WHERE type = 'Artifact'
  AND json_extract(properties, '$.section') = ?;

-- Find high-confidence causal claims
SELECT id, json_extract(properties, '$.cause') AS cause,
       json_extract(properties, '$.confidence') AS confidence
FROM nodes
WHERE type = 'CausalClaim'
  AND CAST(json_extract(properties, '$.confidence') AS REAL) > 0.7;
```

### Pattern 3: Recursive CTE for Graph Traversal

**What:** Replace Cypher path queries with SQL recursive CTEs.
**When:** Finding cascade paths, multi-hop traversals.

```sql
-- Find all causal cascade paths from a given claim (up to 5 hops)
WITH RECURSIVE cascade(claim_id, depth, path) AS (
  -- Base case
  SELECT target, 1, source || ' -> ' || target
  FROM edges
  WHERE source = ? AND type = 'CASCADES_TO'
  
  UNION ALL
  
  -- Recursive step
  SELECT e.target, c.depth + 1, c.path || ' -> ' || e.target
  FROM cascade c
  JOIN edges e ON e.source = c.claim_id AND e.type = 'CASCADES_TO'
  WHERE c.depth < 5
    AND c.path NOT LIKE '%' || e.target || '%'  -- cycle prevention
)
SELECT * FROM cascade;
```

### Pattern 4: MCP Tool as Thin Wrapper

**What:** MCP tools are 5-10 line wrappers around core functions. Zero business logic in tool handlers.
**When:** Always, for every tool.

```javascript
// GOOD: thin wrapper
server.tool('room_state', { roomDir: z.string() }, async ({ roomDir }) => {
  const state = require('../lib/core/state-ops.cjs').readState(roomDir);
  return { content: [{ type: 'text', text: JSON.stringify(state) }] };
});

// BAD: business logic in tool handler
server.tool('room_state', { roomDir: z.string() }, async ({ roomDir }) => {
  const statePath = path.join(roomDir, 'STATE.md');
  const content = fs.readFileSync(statePath, 'utf-8');
  const parsed = parseYamlFrontmatter(content);
  // ... 50 lines of logic that should be in state-ops.cjs
});
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate Node Tables Per Type

**What:** Creating separate SQLite tables for Artifact, Section, CausalClaim, WhitespaceZone (mimicking KuzuDB's schema).
**Why bad:** SQLite doesn't benefit from typed node tables the way a graph DB does. You'd need complex UNION queries to traverse across types. Adding new types requires schema migration.
**Instead:** Single `nodes` table with `type` column. JSON properties handle per-type fields.

### Anti-Pattern 2: ORM for Graph Operations

**What:** Using Prisma, Drizzle, or Knex for the graph tables.
**Why bad:** Graph query patterns (recursive CTEs, JSON extraction, edge traversal) don't map well to ORMs. The overhead of an ORM layer adds complexity with zero benefit for this use case.
**Instead:** Direct better-sqlite3 prepared statements. The SQL is simple and predictable.

### Anti-Pattern 3: Async better-sqlite3 Wrappers

**What:** Wrapping synchronous better-sqlite3 calls in Promise.resolve() or async wrappers to maintain the async interface.
**Why bad:** Adds unnecessary overhead and obscures the actual execution model.
**Instead:** Change lazygraph-ops.cjs functions from async to sync. Update graph-ops.cjs (the only direct consumer) to match. The write queue in graph-ops.cjs can still use Promises for serialization, but the actual DB calls inside are sync.

### Anti-Pattern 4: Duplicating Brain Tools in Local MCP

**What:** Re-implementing Brain intelligence locally instead of proxying to the remote Brain API.
**Why bad:** Brain is the proprietary moat. Local implementation leaks IP. Also creates two implementations to maintain.
**Instead:** Local MCP server proxies Brain requests to brain.mindrian.ai via brain-client.cjs. Same API, no IP leakage.

### Anti-Pattern 5: MCP Apps with External Dependencies

**What:** Building MCP App HTML that loads scripts from CDN or external URLs.
**Why bad:** MCP Apps render in sandboxed iframes with deny-by-default CSP. External resources won't load without explicit CSP configuration, which many hosts won't support.
**Instead:** Use vite-plugin-singlefile to inline everything into one HTML file. Zero external dependencies.

## Integration Points: New vs Modified Components

### New Components

| Component | Purpose | Dependencies |
|-----------|---------|-------------|
| `bin/mindrian-mcp-server.cjs` | MCP server entry point (stdio) | @modelcontextprotocol/sdk, zod, lib/core/*.cjs |
| `mcp-apps/` | UI apps directory with Vite build | @modelcontextprotocol/ext-apps, vite, vite-plugin-singlefile |
| `mcp-apps/src/dashboard/` | De Stijl dashboard MCP App | ext-apps client SDK, Cytoscape.js |
| `mcp-apps/src/graph/` | Knowledge graph MCP App | ext-apps client SDK, Cytoscape.js |
| `mcp-apps/src/wiki/` | Wiki view MCP App | ext-apps client SDK |
| `mcp-apps/vite.config.ts` | Build config for single-file HTML | vite, vite-plugin-singlefile |
| `lib/core/memory-ops.cjs` | Memory layer CRUD (L0-L3 + assumptions) | better-sqlite3 via lazygraph-ops.cjs |
| Migration script | Reads .lazygraph/ KuzuDB, writes to room.db | kuzu (read-only), better-sqlite3 |

### Modified Components (API-Preserving)

| Component | What Changes | What Stays |
|-----------|-------------|------------|
| `lib/core/lazygraph-ops.cjs` | Internals: KuzuDB -> better-sqlite3. Cypher -> SQL. Async -> sync. | All 27 exported functions keep exact same signatures and return shapes |
| `lib/core/graph-ops.cjs` | Remove async from internal calls (sync better-sqlite3) | enqueueWrite(), all public APIs unchanged |
| `lib/core/write-lock.cjs` | Change `.graph/` to `.mindrian/` path | acquireLock/releaseLock/isServerRunning API unchanged |
| `lib/core/intelligence-cascade.cjs` | Reference to `.lazygraph/` -> `.mindrian/room.db` | Cascade steps, debounce, batching unchanged |
| `package.json` | Add better-sqlite3, @modelcontextprotocol/sdk, zod, ext-apps | Existing dependencies unchanged |
| `.mcp.json` | Add local mindrian MCP server alongside Brain | Brain MCP config unchanged |

### Unchanged Components (Zero Modification Needed)

- All 52 commands in `commands/`
- All skills in `skills/`
- All agents in `agents/`
- All hooks in `hooks/` (they call graph-ops, which abstracts the DB)
- `scripts/*.py` (HSI, reverse salients, whitespace -- file I/O unchanged)
- `mcp-server-brain/` (completely separate server)
- `dashboard/` (existing HTML templates, superseded by MCP Apps but kept for backward compat)

## Scalability Considerations

| Concern | Current (KuzuDB) | SQLite WAL | At Scale |
|---------|------------------|------------|----------|
| Concurrent reads | Problematic (open-use-close) | Unlimited concurrent readers | WAL checkpoint needed when file > 50MB |
| Write throughput | ~100 writes/sec with Cypher parsing | ~5,000 writes/sec with prepared statements | Write queue prevents contention |
| Graph traversal depth | Native Cypher (fast) | Recursive CTE (adequate for 2-4 hop, slower at 5+) | Acceptable: room graphs are shallow (max ~1000 nodes) |
| Memory per room | ~20MB KuzuDB overhead | ~2MB better-sqlite3 overhead | Better for rooms on low-spec machines |
| DB file size | .lazygraph/ directory (multiple files) | Single room.db file | Simpler backup, simpler migration |

## Build Order (Dependency-Aware)

```
Phase 1: SQLite Foundation
  1. Install better-sqlite3
  2. Rewrite lazygraph-ops.cjs internals (Cypher -> SQL)
  3. Keep all 27 export signatures identical
  4. Update write-lock.cjs paths (.graph/ -> .mindrian/)
  5. Run existing tests against new implementation
  
Phase 2: Memory Layer
  6. Add memory table schema to initSchema()
  7. Create memory-ops.cjs in lib/core/
  8. Wire memory tables into intelligence-cascade.cjs
  
Phase 3: Migration Tool
  9. Script to read existing .lazygraph/ KuzuDB and write to room.db
  10. Graceful fallback: if room.db missing, check for .lazygraph/
  
Phase 4: MCP Server
  11. Create bin/mindrian-mcp-server.cjs with StdioServerTransport
  12. Register Tier 1 tools (Brain proxy via brain-client.cjs)
  13. Register Tier 2 tools (Room intelligence via lib/core/)
  14. Register Tier 3 tools (Graph + Export)
  15. Test with MCP Inspector
  
Phase 5: MCP Apps
  16. Set up mcp-apps/ with Vite + vite-plugin-singlefile
  17. Port De Stijl dashboard to MCP App (from existing dashboard/)
  18. Port knowledge graph to MCP App
  19. Port wiki view to MCP App
  20. Register ui:// resources in MCP server
  21. Test with ext-apps basic-host
```

**Phase ordering rationale:**
- Phase 1 MUST be first: MCP tools need the DB to work.
- Phase 2 after Phase 1: memory tables go in the same room.db.
- Phase 3 can run in parallel with Phase 2: migration is independent.
- Phase 4 after Phase 1: MCP tools wrap lib/core/ which depends on SQLite.
- Phase 5 after Phase 4: MCP Apps depend on the MCP server existing.

## Sources

- [MCP Apps Official Release (Jan 2026)](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) -- ui:// scheme, registerAppTool, registerAppResource, sandboxed iframes, postMessage JSON-RPC [HIGH confidence]
- [Build an MCP App Guide](https://modelcontextprotocol.io/extensions/apps/build) -- server implementation, vite-plugin-singlefile bundling, App client SDK, testing with basic-host [HIGH confidence]
- [MCP Apps GitHub](https://github.com/modelcontextprotocol/ext-apps/) -- ext-apps SDK source, examples [HIGH confidence]
- [@modelcontextprotocol/ext-apps npm](https://www.npmjs.com/package/@modelcontextprotocol/ext-apps) -- v1.1.2, server + client helpers [HIGH confidence]
- [SQLite WAL Documentation](https://sqlite.org/wal.html) -- concurrent readers, single writer, checkpoint mechanics [HIGH confidence]
- [better-sqlite3 Performance](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md) -- WAL mode, checkpoint, multi-process access [HIGH confidence]
- [simple-graph SQLite schema](https://github.com/dpapathanasiou/simple-graph/blob/main/sql/schema.sql) -- nodes(body JSON, id generated), edges(source, target, properties) [HIGH confidence]
- [SQLite Recursive CTE Documentation](https://sqlite.org/lang_with.html) -- WITH RECURSIVE syntax for graph traversal [HIGH confidence]
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) -- McpServer, StdioServerTransport, tool registration [HIGH confidence]
- [Shopify MCP UI Engineering](https://shopify.engineering/mcp-ui-breaking-the-text-wall) -- production MCP UI patterns [MEDIUM confidence]
