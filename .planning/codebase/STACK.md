# Technology Stack (MindrianOS Plugin)

This file is the source of CLAUDE.md's GSD:stack block. The generator prefers it over .planning/research/STACK.md, which is the unrelated 2026-08-13 Memgraph and Brain stack research and stays untouched. CLAUDE.md is regenerated block-scoped, never in full, per 369-01-SUMMARY (the project and skills blocks carry hand-maintained text a full regeneration would regress).

## Existing Stack (v1.0/v2.0 - stable)

| Technology | Role |
|------------|------|
| Markdown + YAML frontmatter | Skills, agents, commands, pipelines, references |
| JSON | plugin.json, hooks.json, .mcp.json, settings.json, STATE.md frontmatter |
| Bash scripts (scripts/) | Room analysis, state, meeting intelligence, PDF, transcription |
| Theo + Brain MCP | Remote teaching graph (Streamable HTTP) at theo-mcp.onrender.com. Cutover from Neo4j Aura to Memgraph (pws-brain-mcp.onrender.com) landed 2026-07-22; cutover from Memgraph to Theo landed 2026-09-03 (Phase 339). lib/core/brain-client.cjs:24 is the single source of the default URL |
| e5 (multilingual-e5-large) | Brain semantic-search vectors, 1024-dim, embedded LOCALLY (passage:/query: prefixes, no network egress). Pinecone is RETIRED |
| Cytoscape.js (CDN) | De Stijl knowledge-graph visualization |
| sentence-transformers + LSA (Python) | HSI computation scripts |

## v3.0 Additions (MCP delivery)

| Technology | Version | Role |
|------------|---------|------|
| `@modelcontextprotocol/sdk` | ^1.29.0 | MindrianOS MCP server (stdio + Streamable HTTP on one McpServer instance) |
| `zod` | ^3.25.76 | Schema validation for MCP tools; required by the MCP SDK |
| Node.js CJS shared core | Node >=22.18.0 | `lib/core/*.cjs` called by both the CLI and the MCP server. The floor is v22.18.0 because that is the first Node 22 line where TypeScript type stripping runs unflagged and without an experimental warning (Node 22.18.0 release notes; Phase 369 D-17). The earlier v22.16.0 reason still holds underneath it as history: `node:sqlite`'s `timeout` constructor option (the room.db write-safety option) starts working at v22.16.0. The lower v22.13.0 floor, where the module stopped needing `--experimental-sqlite`, is NOT sufficient: on 22.13-22.15 the module loads but `timeout` is silently ignored, so the write-safety fix ships and does nothing. Source: Context7 against the Node.js v22.x API docs, the `timeout` option version-history entry. |
