# Stack Research: SQLite Graph+Memory Migration & MCP Server with MCP Apps

**Domain:** Embedded graph database migration + MCP server expansion + interactive UI
**Researched:** 2026-04-09
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `better-sqlite3` | 12.8.0 | Replace KuzuDB for graph+memory storage | Synchronous API eliminates async open/use/close ceremony. WAL mode enables concurrent reads from MCP server + plugin simultaneously. 40x faster than node-sqlite3. Native C++ addon, prebuilt binaries for all platforms. The standard choice for embedded SQLite in Node.js -- no real competitor. [HIGH confidence -- npm registry verified 2026-04-09] |
| `@modelcontextprotocol/sdk` | 1.29.0 | MCP server framework (already installed) | Already a dependency at ^1.29.0. Supports dual transport (stdio + Streamable HTTP) on single McpServer instance. 40,600+ npm dependents. v2 expected Q2 2026 but v1.x will get 6 months of patches post-v2. No version change needed. [HIGH confidence -- npm registry verified] |
| `@modelcontextprotocol/ext-apps` | 1.5.0 | MCP Apps UI resources (already installed) | Already a dependency at ^1.5.0. Provides App class for client-side UI communication plus server-side resource registration helpers. Spec frozen at 2026-01-26. Supported by Claude, Claude Desktop, VS Code Copilot, Goose, Postman. No version change needed. [HIGH confidence -- npm + official spec verified] |
| `vite` | 6.x | Bundle MCP App HTML into single-file resources | MCP Apps require self-contained HTML served via ui:// scheme. vite-plugin-singlefile inlines all JS/CSS into one HTML file. This is the official pattern from ext-apps examples. Dev dependency only. [HIGH confidence -- ext-apps examples use this exact pattern] |
| `vite-plugin-singlefile` | 2.x | Inline JS+CSS into single HTML file for MCP Apps | Companion to Vite. Produces the single dist/index.html that becomes the ui:// resource blob. Used in all official MCP Apps examples. Dev dependency only. [HIGH confidence -- verified in ext-apps repo examples] |

### SQLite Schema Design (NEW -- replaces KuzuDB)

The schema uses plain adjacency tables, not a graph extension. This is the correct choice because:

1. MindrianOS graph traversals are shallow (1-3 hops max for cross-section discovery)
2. SQLite recursive CTEs handle shallow graph traversal with negligible performance difference vs dedicated graph engines
3. No dependency on alpha-stage extensions (sqlite-graph is 0.1.0-alpha, not production-ready)
4. Full SQL power for the memory system (temporal queries, validity lifecycles, aggregation)

**Recommended schema pattern:**

```sql
-- Graph layer (replaces .lazygraph/ KuzuDB)
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,        -- 'artifact', 'section', 'concept', 'assumption'
  title TEXT,
  section TEXT,
  methodology TEXT,
  content_hash TEXT,
  created TEXT,
  data TEXT                  -- JSON blob for type-specific fields
);
CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_nodes_section ON nodes(section);

CREATE TABLE edges (
  source TEXT NOT NULL REFERENCES nodes(id),
  target TEXT NOT NULL REFERENCES nodes(id),
  type TEXT NOT NULL,        -- 'INFORMS', 'CONTRADICTS', 'CONVERGES', etc.
  weight REAL DEFAULT 1.0,
  data TEXT,                 -- JSON blob for edge-specific properties
  created TEXT,
  PRIMARY KEY (source, target, type)
);
CREATE INDEX idx_edges_source ON edges(source);
CREATE INDEX idx_edges_target ON edges(target);
CREATE INDEX idx_edges_type ON edges(type);

-- Memory layer (NEW)
CREATE TABLE identity (      -- L0: who is this user/project
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated TEXT
);

CREATE TABLE facts (          -- L1: validated claims with temporal validity
  id TEXT PRIMARY KEY,
  claim TEXT NOT NULL,
  source TEXT,               -- artifact ID, meeting ID, or 'user'
  validity TEXT DEFAULT 'untested',  -- untested/supported/contradicted/stale
  confidence REAL DEFAULT 0.5,
  created TEXT,
  expires TEXT,              -- NULL = permanent
  invalidated_by TEXT        -- fact ID that contradicted this
);
CREATE INDEX idx_facts_validity ON facts(validity);

CREATE TABLE sessions (       -- L2: conversation/session context
  id TEXT PRIMARY KEY,
  started TEXT,
  ended TEXT,
  summary TEXT,
  room_dir TEXT
);

CREATE TABLE fragments (      -- L3: raw extracted snippets
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  content TEXT NOT NULL,
  source_type TEXT,          -- 'meeting', 'artifact', 'conversation'
  source_ref TEXT,
  created TEXT
);
CREATE INDEX idx_fragments_session ON fragments(session_id);
```

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | 3.25.x | MCP tool schema validation | Already installed (^3.25). Required by MCP SDK. No change needed. |
| `express` | 5.1.x | Streamable HTTP transport | Already installed (^5.1.0). Used by MCP SDK internally for HTTP transport. No change needed. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `vite` + `vite-plugin-singlefile` | Bundle MCP App UIs into single HTML files | Dev dependency. Configure in `apps/vite.config.js`. Output to `lib/mcp-apps/dist/`. |
| `npx @modelcontextprotocol/inspector` | Test MCP server tools + Apps interactively | Already available. Now also tests ui:// resource rendering. |

## Installation

```bash
# Core: embedded SQLite (the only NEW runtime dependency)
npm install better-sqlite3

# Dev: MCP Apps UI bundling
npm install -D vite vite-plugin-singlefile
```

That is it. Two new packages: one runtime, two dev. Everything else is already installed.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `better-sqlite3` (synchronous) | `sql.js` (WASM-based SQLite) | Never for this project. sql.js is 2-10x slower, no WAL mode, no concurrent access. Only useful when native addons cannot be compiled (browser, serverless). |
| `better-sqlite3` (synchronous) | `node-sqlite3` (async callback-based) | Never. 40x slower than better-sqlite3 in benchmarks. Callback API is harder to reason about. better-sqlite3's synchronous API is actually faster because it avoids event loop overhead. |
| Plain adjacency tables | `sqlite-graph` extension (Cypher on SQLite) | Not yet. sqlite-graph is 0.1.0-alpha (Oct 2025), C99 extension requiring custom compilation, no npm package. Re-evaluate when it hits 1.0. Our graph traversals are shallow enough that recursive CTEs work fine. |
| Plain adjacency tables | `graphqlite` (Cypher + graph algorithms) | Not yet. Same maturity concern. Also Rust-based, adding build complexity. |
| Plain adjacency tables | DuckDB with DuckPGQ | Never for embedded per-room use. DuckDB is 50MB+ binary, designed for analytics not OLTP. Overkill for a room-level graph. |
| Vite single-file bundling | Inline HTML strings in CJS | Only for trivial UIs (< 50 lines). The dashboard, wiki, and graph views will have enough JS/CSS to justify a proper build step. Inline strings become unmaintainable fast. |
| Vite single-file bundling | esbuild + manual HTML wrapping | Possible but Vite + singlefile is the official pattern from MCP Apps examples. Following the standard path reduces debugging time. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| KuzuDB (`kuzu` npm package) | Archived Oct 2025. No maintenance. Current dependency causes install warnings. REMOVE from package.json. | `better-sqlite3` with adjacency tables |
| `sqlite-graph` extension | Alpha quality (0.1.0), no npm package, requires C compilation, untested on Windows | Recursive CTEs for graph traversal |
| `sql.js` | WASM overhead, no WAL mode, no concurrent access, 2-10x slower | `better-sqlite3` |
| `knex` / `drizzle` / `prisma` (ORMs) | Massive dependency trees. Schema is simple enough for raw SQL. ORM abstraction hides the graph query patterns we need (recursive CTEs). | Direct `better-sqlite3` prepared statements |
| `sequelize` | Same as above, plus it is async-only which fights better-sqlite3's synchronous API | Direct prepared statements |
| React/Vue/Svelte for MCP Apps | Framework overhead for what are essentially data visualization dashboards. Vanilla JS + Cytoscape.js (already used) is sufficient. Adding a framework means a heavier build toolchain. | Vanilla JS MCP Apps with Vite bundling |
| `electron` / `tauri` for UI | MCP Apps renders UI inside the chat client. No need for a separate window framework. | MCP Apps ui:// resources |

## Integration Points: How New Stack Connects to Existing

### better-sqlite3 replaces KuzuDB in lazygraph-ops.cjs

The current `lazygraph-ops.cjs` exports: `openGraph`, `closeGraph`, `initSchema`, `indexArtifact`, `rebuildGraph`, `queryGraph`, `graphStats`. The replacement maintains the SAME export signatures but changes internals:

| Current (KuzuDB) | New (better-sqlite3) | Change |
|-------------------|----------------------|--------|
| `const kuzu = require('kuzu')` | `const Database = require('better-sqlite3')` | Import swap |
| `new kuzu.Database(dbPath)` + `new kuzu.Connection(db)` | `new Database(dbPath)` + `db.pragma('journal_mode = WAL')` | Simpler -- one object, not two |
| `await conn.query(cypher)` (async) | `db.prepare(sql).all()` (sync) | Async-to-sync. Eliminates all await/try/finally chains |
| `db.close()` (required to release lock) | `db.close()` (or let GC handle it) | Same pattern but WAL means less lock contention |
| `room/.lazygraph/` directory | `room/.mindrian/room.db` single file | Cleaner. One file instead of directory of WAL/lock files |
| Cypher queries | SQL with recursive CTEs | All 19 edge types map to `edges.type` column |

**graph-ops.cjs** wraps lazygraph-ops.cjs with write queue and lock. The write queue (`enqueueWrite`) can be simplified because:
- WAL mode allows concurrent reads while writing
- better-sqlite3 is synchronous, so no promise chains needed for individual operations
- The `write-lock.cjs` file-based lock is still useful for cross-process safety (MCP server + plugin hook both accessing room.db)

**Key migration pattern:** The 24+ files that touch KuzuDB almost all go through `lazygraph-ops.cjs`. Replace that one file, keep the same exports, and consumers do not change.

### MCP Apps connect to existing dashboard views

The existing De Stijl dashboard (Cytoscape.js graph, wiki, insights) is already HTML+JS. The migration path:

1. Extract existing dashboard HTML/JS from `scripts/` and `lib/visual/` into `apps/` source directory
2. Add Vite build step that produces single-file HTML
3. Register each view as a ui:// resource in the MCP server
4. Tools reference their UI via `_meta.ui.resourceUri: "ui://mindrian/graph.html"`

The MCP Apps pattern:
```javascript
// In mindrian-mcp-server.cjs (server-side)
server.resource('ui://mindrian/graph.html', async () => {
  const html = fs.readFileSync(path.join(__dirname, '../lib/mcp-apps/dist/graph.html'), 'utf8');
  return { contents: [{ uri: 'ui://mindrian/graph.html', mimeType: 'text/html', text: html }] };
});

server.tool('graph_query', { /* zod schema */ }, async (params) => {
  // ... run query ...
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    _meta: { ui: { resourceUri: 'ui://mindrian/graph.html' } }
  };
});
```

### Python scripts exposed via child_process (existing pattern)

The 14 Python computation scripts (`compute-hsi.py`, `detect-reverse-salients.py`, etc.) are already invoked via `child_process.execSync` in the existing CJS modules. The MCP tool wrappers follow the same pattern:

```javascript
// MCP tool wraps existing core function
server.tool('hsi_score', hsiSchema, async ({ roomDir }) => {
  const result = require('../lib/core/intelligence-cascade.cjs').computeHSI(roomDir);
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
```

No new Python-to-Node bridge is needed. The `child_process.execSync` pattern in `lib/core/*.cjs` is the bridge.

## better-sqlite3 Concurrency Model (Critical for MCP + Plugin coexistence)

The MCP server and plugin hooks can both access `room.db` simultaneously. WAL mode makes this safe:

| Scenario | WAL Behavior | Our Pattern |
|----------|-------------|-------------|
| MCP reads while hook writes | WAL allows. Readers see last committed state. | Safe. No locking needed for reads. |
| MCP writes while hook writes | SQLite serializes writes. Second writer waits (busy_timeout). | Set `db.pragma('busy_timeout = 5000')` to wait up to 5s. |
| MCP writes while hook reads | WAL allows. Reader sees pre-write state until commit. | Safe. Eventual consistency is fine for our use case. |
| Checkpoint starvation (long reads block WAL recycle) | WAL file grows unbounded. | Call `db.pragma('wal_checkpoint(TRUNCATE)')` at session end. |

**Configuration on open:**
```javascript
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');  // Safe with WAL, 2x faster than FULL
db.pragma('foreign_keys = ON');
```

## MCP Apps Architecture for MindrianOS

### Three UI Resources to ship:

| UI Resource | URI | Existing Code Base | Complexity |
|-------------|-----|-------------------|------------|
| Knowledge Graph | `ui://mindrian/graph.html` | Cytoscape.js dashboard already exists in `scripts/build-graph` + dashboard HTML | Low -- extract and bundle |
| Wiki View | `ui://mindrian/wiki.html` | Wiki HTML generation exists in visual-ops.cjs | Medium -- needs interactive navigation |
| Room Dashboard | `ui://mindrian/dashboard.html` | De Stijl dashboard exists as static HTML export | Medium -- needs live data refresh via callServerTool() |

### Build pipeline:

```
apps/
  graph/
    index.html        -- Cytoscape.js graph viewer
    src/app.js        -- MCP App SDK integration
  wiki/
    index.html        -- Wiki article viewer
    src/app.js
  dashboard/
    index.html        -- De Stijl room dashboard
    src/app.js
  vite.config.js      -- Shared config with singlefile plugin

npm run build:apps    -- Produces lib/mcp-apps/dist/{graph,wiki,dashboard}.html
```

Each app uses `@modelcontextprotocol/ext-apps` App class to:
- Receive tool result data from the host
- Call `callServerTool()` for interactive queries (e.g., click a node, query its edges)
- Use `sendMessage()` to inject text into the conversation from the UI

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `better-sqlite3@12.8.0` | Node.js >=18, all platforms | Prebuilt binaries for macOS (arm64/x64), Linux (x64/arm64), Windows (x64). Falls back to node-gyp compilation if no prebuild. |
| `better-sqlite3@12.8.0` | `@modelcontextprotocol/sdk@1.29.0` | No conflicts. better-sqlite3 is synchronous, MCP SDK is async. They operate at different layers. |
| `@modelcontextprotocol/ext-apps@1.5.0` | `@modelcontextprotocol/sdk@1.29.0` | Co-developed by same team. ext-apps is an extension, not a replacement. Both use JSON-RPC. |
| `vite@6.x` + `vite-plugin-singlefile@2.x` | Node.js >=18 | Dev dependency only. Does not affect runtime. |

## Packages to REMOVE

| Package | Why Remove |
|---------|-----------|
| `kuzu@0.11.3` | KuzuDB archived Oct 2025. No maintenance. Native addon causes install issues on some platforms. Replaced by better-sqlite3. |

## Sources

- [better-sqlite3 on npm](https://www.npmjs.com/package/better-sqlite3) -- verified v12.8.0, synchronous API, WAL mode docs [HIGH confidence]
- [better-sqlite3 performance docs](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md) -- WAL mode, busy_timeout, concurrent access patterns [HIGH confidence]
- [better-sqlite3 API docs](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md) -- Database constructor, pragma(), prepare(), transaction() [HIGH confidence]
- [@modelcontextprotocol/sdk on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- verified v1.29.0, 40,621 dependents [HIGH confidence]
- [@modelcontextprotocol/ext-apps on npm](https://www.npmjs.com/package/@modelcontextprotocol/ext-apps) -- verified v1.5.0 in package.json [HIGH confidence]
- [MCP Apps specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) -- ui:// scheme, resource registration, security model [HIGH confidence]
- [MCP Apps overview](https://modelcontextprotocol.io/extensions/apps/overview) -- architecture, client support, bidirectional communication [HIGH confidence]
- [MCP Apps vanilla JS example](https://github.com/modelcontextprotocol/ext-apps/tree/main/examples/basic-server-vanillajs) -- Vite + singlefile pattern [HIGH confidence]
- [MCP Apps blog post](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) -- production readiness, supported clients [HIGH confidence]
- [simple-graph (SQLite graph pattern)](https://github.com/dpapathanasiou/simple-graph) -- nodes+edges adjacency pattern reference [MEDIUM confidence]
- [vite-plugin-singlefile on npm](https://www.npmjs.com/package/vite-plugin-singlefile) -- verified v2.x, inline JS+CSS into HTML [HIGH confidence]
- [sqlite-graph extension](https://github.com/agentflare-ai/sqlite-graph) -- evaluated and rejected: 0.1.0-alpha, no npm package [HIGH confidence on rejection rationale]

---
*Stack research for: MindrianOS v2.0 SQLite + MCP Server + MCP Apps*
*Researched: 2026-04-09*
