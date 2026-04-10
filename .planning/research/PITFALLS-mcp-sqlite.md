# Domain Pitfalls: v2.0 SQLite + MCP Server + MCP Apps

**Domain:** Embedded DB migration, MCP server co-development, MCP Apps
**Researched:** 2026-04-09

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Async-to-Sync Cascade Breakage

**What goes wrong:** lazygraph-ops.cjs is currently async (KuzuDB is async). better-sqlite3 is synchronous. Changing function signatures from `async function` to plain `function` breaks every caller that uses `await`.
**Why it happens:** 27 exported functions x 24+ consumer files = ~100 call sites that may use `await`.
**Consequences:** Runtime errors at every call site. Silent failures if `await` on a non-Promise returns the value but downstream code expects Promise semantics.
**Prevention:** Two options:
  1. **Keep async wrappers** (easiest): Functions stay async, internally call sync better-sqlite3. `await syncResult` just returns immediately. Zero caller changes needed. Cost: minor overhead.
  2. **Full sync conversion** (cleanest): Update all callers. Use `git grep 'await.*lazygraph\|await.*graphOps'` to find every call site.
**Detection:** Test suite. If tests pass with option 1, ship it. Refactor to option 2 in a follow-up.

### Pitfall 2: better-sqlite3 Native Module Build Failures

**What goes wrong:** better-sqlite3 requires node-gyp compilation of native C code. Fails on machines without build tools (common on Windows, some Mac setups).
**Why it happens:** Unlike KuzuDB's JavaScript wrapper, better-sqlite3 compiles SQLite from C source at install time.
**Consequences:** `npm install` fails. Plugin becomes uninstallable for some users.
**Prevention:**
  - Use `better-sqlite3` with prebuilds: `npm install better-sqlite3` ships prebuilt binaries for common platforms via prebuild-install. This works for most users without a compiler.
  - Document fallback: if prebuilt fails, `npm install --build-from-source` with node-gyp.
  - Test install on fresh Windows + Mac + Linux environments.
  - Consider `@aspect-build/better-sqlite3` (prebuilt fork) if native build is chronic issue.
**Detection:** CI test matrix: Windows, macOS, Linux.

### Pitfall 3: MCP Apps HTML Exceeds Host Size Limits

**What goes wrong:** vite-plugin-singlefile inlines ALL assets (CSS, JS, images) into one HTML file. With Cytoscape.js (~300KB minified) + De Stijl CSS + application code, the HTML can exceed 1MB.
**Why it happens:** No external resource loading in sandboxed iframes. Everything must be inline.
**Consequences:** MCP host rejects the resource (some hosts may have size limits for ui:// resources). Slow rendering.
**Prevention:**
  - Measure bundle size after build. Target < 500KB.
  - Use Cytoscape.js core only (not full bundle with extensions).
  - Minimize CSS (De Stijl is already minimal).
  - If too large: split into multiple MCP Apps (dashboard without graph, graph standalone).
  - MCP Apps spec does support configurable CSP -- investigate host-specific CSP settings to allow specific CDN domains as a fallback.
**Detection:** Build step should report file size. Add CI check: `wc -c dist/*.html`.

### Pitfall 4: Query Translation Completeness

**What goes wrong:** The ~10 Cypher patterns used in lazygraph-ops.cjs seem simple, but edge cases in MERGE semantics, multi-hop path queries, and ON MATCH SET behavior have subtle differences in SQL.
**Why it happens:** Cypher MERGE is atomic upsert with separate ON CREATE/ON MATCH handlers. SQL INSERT OR REPLACE drops the old row entirely (losing columns not in the INSERT).
**Consequences:** Data corruption: properties silently lost on upsert.
**Prevention:**
  - Use `INSERT ... ON CONFLICT(id) DO UPDATE SET ...` (SQLite UPSERT) instead of `INSERT OR REPLACE`. This preserves existing columns.
  - Map each of the 27 functions one-by-one with test cases.
  - The current MERGE pattern in Cypher always sets ALL columns on both CREATE and MATCH. Mirror this: always write all columns in the SQL UPDATE clause.
**Detection:** Port existing test suite. Add property-preservation assertions.

### Pitfall 5: room.db File Locking on Windows

**What goes wrong:** SQLite WAL mode requires shared memory (mmap). On Windows with certain antivirus configurations, the WAL-shm file gets locked by the AV scanner, causing SQLITE_BUSY errors.
**Why it happens:** Windows file locking semantics differ from POSIX. Antivirus real-time scanning locks files.
**Consequences:** Intermittent write failures that are hard to reproduce.
**Prevention:**
  - `busy_timeout = 5000` (5 second retry) handles most transient locks.
  - Document: add room/.mindrian/ to antivirus exclusions.
  - Graceful error messages: "Database temporarily locked. Retrying..." instead of stack traces.
**Detection:** Test on Windows with Defender active.

## Moderate Pitfalls

### Pitfall 1: MCP Apps postMessage Security

**What goes wrong:** MCP Apps use postMessage for iframe-to-host communication. If the origin check is missing or wrong, other iframes/tabs can inject messages.
**Prevention:** The ext-apps SDK handles origin validation. DO NOT implement custom postMessage handling -- use `app.connect()` and `app.callServerTool()` exclusively.

### Pitfall 2: WAL Checkpoint Starvation

**What goes wrong:** If the MCP server holds a long-running read transaction while the plugin writes continuously, the WAL file grows without bound.
**Prevention:** Use the open-use-close pattern (already in place). Never hold a DB handle across requests. Each MCP tool call opens, reads, closes. Each hook opens, writes, closes.

### Pitfall 3: JSON Property Schema Drift

**What goes wrong:** With JSON blobs in the properties column, there's no schema enforcement. Different code paths write different field names for the same concept.
**Prevention:** Define canonical property schemas as JSDoc types or constants in lazygraph-ops.cjs. All writes go through typed helper functions, never raw INSERT.

### Pitfall 4: MCP Server Process Lifecycle

**What goes wrong:** stdio MCP servers are spawned by the host (Claude Desktop). If the process crashes, the host may not respawn it. Uncaught exceptions kill the tool.
**Prevention:** Global error handler in mindrian-mcp-server.cjs:
```javascript
process.on('uncaughtException', (err) => {
  process.stderr.write(`[mindrian-mcp] Uncaught: ${err.message}\n`);
  // Do NOT exit -- let the MCP protocol handle recovery
});
```
Every tool handler MUST be wrapped in try/catch. Return error text, never throw.

### Pitfall 5: Migration Data Loss

**What goes wrong:** The KuzuDB-to-SQLite migration script fails partway through, leaving users with neither a working .lazygraph/ nor a complete room.db.
**Prevention:** Never modify .lazygraph/ during migration. Read from KuzuDB, write to room.db. If migration fails, .lazygraph/ is untouched. Add a migration status file (room/.mindrian/migration.json) tracking completion.

## Minor Pitfalls

### Pitfall 1: better-sqlite3 Version Mismatch with Node.js

**What goes wrong:** better-sqlite3 native addon compiled for Node 18 doesn't load on Node 22.
**Prevention:** `npm rebuild better-sqlite3` after Node version changes. Document in install guide.

### Pitfall 2: Vite Build Cache

**What goes wrong:** Vite caches builds. Old MCP App HTML served after code changes.
**Prevention:** Add `--force` to build script or clear dist/ before build.

### Pitfall 3: Large Graph Recursive CTE Performance

**What goes wrong:** Recursive CTEs on graphs with cycles hit the default recursion limit (1000).
**Prevention:** Explicit depth limit in all recursive CTEs (max 5 hops). Cycle detection via path tracking.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| SQLite migration | Async-to-sync breakage (#1), MERGE -> UPSERT semantics (#4) | Keep async wrappers initially, use ON CONFLICT instead of INSERT OR REPLACE |
| Memory layer | Schema drift in JSON properties (#M3) | Typed helper functions, canonical schemas |
| Migration tool | Partial migration data loss (#M5) | Never modify .lazygraph/, write migration status file |
| MCP server | Process crash kills all tools (#M4) | Global error handler, per-tool try/catch |
| MCP Apps | Bundle size (#3), external deps blocked by CSP (#Anti-5) | Measure build size, use vite-plugin-singlefile |
| Windows support | Native build failures (#2), WAL file locking (#5) | Prebuild binaries, busy_timeout, AV exclusion docs |

## Sources

- [SQLite WAL mode limitations](https://sqlite.org/wal.html) -- checkpoint starvation, network filesystem restriction [HIGH confidence]
- [better-sqlite3 installation](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md) -- native module build, prebuild-install [HIGH confidence]
- [MCP Apps security model](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) -- iframe sandboxing, CSP, postMessage [HIGH confidence]
- [SQLite UPSERT](https://sqlite.org/lang_upsert.html) -- INSERT ON CONFLICT DO UPDATE syntax [HIGH confidence]
- Existing codebase analysis: lazygraph-ops.cjs (1,016 lines), graph-ops.cjs, write-lock.cjs [HIGH confidence -- local]
