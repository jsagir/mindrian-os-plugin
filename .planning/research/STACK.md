# Technology Stack

Lean operational stack source. Version facts are reconciled against package.json.

## Existing Stack (v1.0/v2.0 - stable)

| Technology | Role |
|------------|------|
| Markdown + YAML frontmatter | Skills, agents, commands, pipelines, references |
| JSON | plugin.json, hooks.json, .mcp.json, settings.json, STATE.md frontmatter |
| Bash scripts (scripts/) | Room analysis, state, meeting intelligence, PDF, transcription |
| Neo4j Aura + Brain MCP | Remote teaching graph (Streamable HTTP) at mindrian-brain.onrender.com |
| Pinecone | Brain semantic-search vectors (pws-brain, 1024-dim) |
| Cytoscape.js (CDN) | De Stijl knowledge-graph visualization |
| sentence-transformers + LSA (Python) | HSI computation scripts |

## v3.0 Additions (MCP delivery)

| Technology | Version | Role |
|------------|---------|------|
| `@modelcontextprotocol/sdk` | ^1.29.0 | MindrianOS MCP server (stdio + Streamable HTTP on one McpServer instance) |
| `zod` | ^3.25.76 | Schema validation for MCP tools; required by the MCP SDK |
| Node.js CJS shared core | Node >=22.16.0 | `lib/core/*.cjs` called by both the CLI and the MCP server. The floor is v22.16.0 because that is where `node:sqlite`'s `timeout` constructor option (the room.db write-safety option) starts working. The lower v22.13.0 floor, where the module stopped needing `--experimental-sqlite`, is NOT sufficient: on 22.13-22.15 the module loads but `timeout` is silently ignored, so the write-safety fix ships and does nothing. Source: Context7 against the Node.js v22.x API docs, the `timeout` option version-history entry. |

Local-first: the MindrianOS MCP server is stdio (host-spawned); the remote Brain MCP is SEPARATE and shares no code. Native `fetch` covers HTTP; the filesystem is the room state of record (no database).
