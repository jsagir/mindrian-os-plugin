# Technology Stack: v2.0 SQLite + MCP Server + MCP Apps

**Project:** MindrianOS Plugin v2.0
**Researched:** 2026-04-09

## Recommended Stack

### Core: Database Migration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `better-sqlite3` | 11.x | Replace KuzuDB for embedded graph + memory | Synchronous API (simpler than async KuzuDB), WAL mode for concurrent access, ~2MB overhead vs ~20MB, native JSON support via json_extract(), prepared statements eliminate injection risk. 19K+ GitHub stars. Actively maintained. [HIGH confidence] |

### Core: MCP Server

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@modelcontextprotocol/sdk` | 1.27.1+ | MCP server framework (stdio transport) | THE official SDK. Already used by mcp-server-brain. McpServer + StdioServerTransport for local. Supports dual transport on same instance when HTTP needed later. [HIGH confidence] |
| `zod` | ^3.25 | Tool input/output schema validation | Required peer dependency of MCP SDK. Use 3.x (not 4.x) for ecosystem stability. [HIGH confidence] |

### Core: MCP Apps

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@modelcontextprotocol/ext-apps` | 1.1.2+ | Server-side registerAppTool/registerAppResource + client-side App class | Official MCP Apps SDK. Provides both server helpers and client iframe communication. Used by Anthropic, OpenAI. [HIGH confidence] |
| `vite` | 6.x | Build bundler for MCP App HTML | Fast, zero-config for simple apps. Required for vite-plugin-singlefile. [HIGH confidence] |
| `vite-plugin-singlefile` | 2.x | Inline all CSS/JS/assets into single HTML | Required by MCP Apps: sandboxed iframes have deny-by-default CSP, so external resources won't load. Single-file bundling is the documented approach. [HIGH confidence] |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cytoscape` | 3.x | Knowledge graph visualization in MCP Apps | MCP Apps graph view. Already used in dashboard/ via CDN, now npm import for bundling. |
| `express` | 5.x | HTTP server for MCP Apps testing (basic-host) | Dev only. Not needed in production stdio mode. |
| `cors` | 2.x | CORS middleware for MCP Apps dev server | Dev only. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Embedded DB | better-sqlite3 | sql.js (WASM SQLite) | sql.js is slower, no WAL mode, no native file I/O. better-sqlite3 is the standard for Node.js SQLite. |
| Embedded DB | better-sqlite3 | DuckDB | Overkill for graph storage. DuckDB excels at analytics, not OLTP. Larger binary. |
| Embedded DB | better-sqlite3 | KuzuDB (keep) | Abandoned Oct 2025, archived on GitHub, no maintenance. Must migrate. |
| MCP Apps bundler | vite + singlefile | esbuild | esbuild doesn't have a single-file plugin equivalent. Vite is documented in MCP Apps guide. |
| MCP Apps bundler | vite + singlefile | webpack | Heavier config, slower builds. Vite is the documented choice. |
| Graph in SQLite | nodes/edges JSON pattern | SQLite + FTS5 | FTS5 is for text search, not graph. Use alongside, not instead of, the graph tables. |
| MCP transport | stdio (local) | Streamable HTTP | stdio is simpler, no port/auth/CORS. Add HTTP later when remote room access needed. SDK supports dual transport. |

## Installation

```bash
# Core: embedded database
npm install better-sqlite3

# Core: MCP server
npm install @modelcontextprotocol/sdk zod

# MCP Apps: server helpers + client SDK
npm install @modelcontextprotocol/ext-apps

# MCP Apps: build tooling (dev dependencies)
npm install -D vite vite-plugin-singlefile

# MCP Apps: graph visualization (already in dashboard via CDN, now npm)
npm install cytoscape
```

## What NOT to Install

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `kuzu` | Abandoned, archived, no maintenance since Oct 2025 | better-sqlite3 |
| `prisma` / `drizzle` / `knex` | ORM overhead for graph patterns yields no benefit | Direct prepared statements |
| `express` in production | MCP stdio needs no HTTP server | StdioServerTransport |
| `typescript` for MCP server | Build step breaks edit-surface principle. CJS is directly inspectable. | Plain CJS with JSDoc |
| `typescript` for MCP Apps client | Only the mcp-apps/ subdirectory uses TS, compiled by Vite. Server stays CJS. | TS only in mcp-apps/src/ |

## Sources

- [better-sqlite3 npm](https://www.npmjs.com/package/better-sqlite3) -- v11.x, synchronous API, WAL mode docs [HIGH confidence]
- [better-sqlite3 performance docs](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md) -- WAL, checkpoint, prepared statements [HIGH confidence]
- [@modelcontextprotocol/sdk npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- v1.27.1, McpServer, stdio transport [HIGH confidence]
- [@modelcontextprotocol/ext-apps npm](https://www.npmjs.com/package/@modelcontextprotocol/ext-apps) -- v1.1.2, registerAppTool, registerAppResource, App class [HIGH confidence]
- [MCP Apps Build Guide](https://modelcontextprotocol.io/extensions/apps/build) -- vite-plugin-singlefile documented approach [HIGH confidence]
- [KuzuDB GitHub](https://github.com/kuzudb/kuzu) -- archived, last commit Oct 2025 [HIGH confidence -- verified]
