# Technology Stack

Lean operational stack source for the MindrianOS plugin. Version facts are reconciled against package.json.

## Existing Stack (v1.0/v2.0 - stable)

| Technology | Role | Status |
|------------|------|--------|
| Markdown + YAML frontmatter | Skills, agents, commands, pipelines, references | Shipped, stable |
| JSON | plugin.json, hooks.json, .mcp.json, settings.json, STATE.md frontmatter | Shipped, stable |
| Bash scripts (scripts/) | Room analysis, state computation, meeting intelligence, PDF, transcription | Shipped, stable |
| Neo4j Aura + Brain MCP | Remote teaching graph at mindrian-brain.onrender.com (Streamable HTTP) | Deployed |
| Pinecone | Brain semantic-search vectors (pws-brain, 1024-dim) | Deployed |
| Cytoscape.js (CDN in dashboard HTML) | De Stijl knowledge-graph visualization | Shipped v1.0 |
| Velma API | Meeting transcription | Integrated v2.0 |
| sentence-transformers + LSA (Python) | HSI computation scripts | Shipped v2.0 |

## v3.0 Additions (MCP delivery)

| Technology | Version | Role |
|------------|---------|------|
| `@modelcontextprotocol/sdk` | ^1.29.0 | MindrianOS MCP server exposing tools to Desktop/Cowork; stdio + Streamable HTTP on one McpServer instance |
| `zod` | ^3.25.76 | Input/output schema validation for MCP tools; required by the MCP SDK |
| Node.js CJS shared core | Node >=22.5.0 | `lib/core/*.cjs` internals called by both the CLI and the MCP server; zero added framework |

- The MindrianOS MCP server is local-first (stdio), spawned by the host as a child process; Streamable HTTP is added only when remote room access is needed, on the same McpServer instance.
- The Brain MCP (remote) is SEPARATE from the MindrianOS MCP server; both are listed in the host config and share no code.
- Native `fetch` (Node built-in) covers HTTP; no HTTP-client dependency is added.
- The filesystem is the room state of record; no database is introduced (ICM: the folder structure IS the orchestration).

## Runtime Libraries (in package.json)

- `gray-matter` parses skill/command YAML frontmatter.
- `markdown-it` + `@ig3/markdown-it-wikilinks` render room artifacts and wikilinks.
- `flexsearch` powers local artifact search; `chokidar` watches the room filesystem.
- `chrono-node` parses natural-language dates; `asciichart` renders terminal charts.
- `semver` drives the release-bump algebra; `express` backs the optional local server surface.

## Engine

- Node.js >=22.5.0 (package.json `engines.node`).
