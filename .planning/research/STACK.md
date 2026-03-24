# Stack Research

**Domain:** MCP Platform & Intelligence Expansion (dual-surface: CLI plugin + MCP server)
**Researched:** 2026-03-24 (v3.0 additions to existing v1.0/v2.0 stack)
**Confidence:** HIGH

## Key Insight: v3.0 Breaks the "No Dependencies" Rule -- Intentionally

v1.0/v2.0 was pure Markdown + JSON + Bash. Zero npm dependencies. That rule served the plugin layer well.

v3.0 introduces an MCP server layer that REQUIRES `@modelcontextprotocol/sdk` (Node.js). This is not scope creep -- it is the only path to reaching Desktop/Cowork users. The MCP SDK is the single justified dependency. Everything else stays dependency-free or uses what MCP SDK already pulls in.

**The dual-layer rule:** Plugin layer (commands/, skills/, agents/, hooks/) stays pure Markdown + JSON + Bash. MCP server layer (bin/, lib/) is Node.js CJS. They share core logic through lib/.

---

## Existing Stack (v1.0/v2.0 -- DO NOT CHANGE)

| Technology | Role | Status |
|------------|------|--------|
| Markdown + YAML frontmatter | Skills, agents, commands, pipelines, references | Shipped, stable |
| JSON | plugin.json, hooks.json, .mcp.json, settings.json, STATE.md frontmatter | Shipped, stable |
| Bash scripts (20 in scripts/) | Room analysis, state computation, meeting intelligence, PDF, transcription | Shipped, stable |
| Neo4j Aura + Brain MCP | 21K-node graph at brain.mindrian.ai (remote MCP, Streamable HTTP) | Deployed |
| Pinecone | 1,427 embeddings for Brain semantic search | Deployed |
| Cytoscape.js (via CDN in dashboard HTML) | De Stijl knowledge graph visualization | Shipped v1.0 |
| Velma API | Meeting transcription at 3c/hour | Integrated v2.0 |
| sentence-transformers + LSA (Python) | HSI computation scripts | Shipped v2.0 |

---

## v3.0 Stack Additions

### 1. MCP Server Framework

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@modelcontextprotocol/sdk` | 1.27.1 | Build MindrianOS MCP server exposing tools to Desktop/Cowork | THE official SDK. Only real option. 34,700+ dependents. MIT license. Supports both stdio and Streamable HTTP transports on a single McpServer instance. [HIGH confidence -- verified npm registry 2026-03-24] |
| `zod` | ^3.25 (use 3.25.76) | Input/output schema validation for MCP tools | Required peer dependency of MCP SDK. SDK declares `"^3.25 || ^4.0"`. Use 3.x because zod-to-json-schema (used internally by SDK) is more tested with 3.x. 4.x works but is newer. [HIGH confidence -- verified npm peer deps] |

**Transport decision: stdio for v3.0. Streamable HTTP deferred to v3.x+.**

Rationale:
- Claude Desktop spawns stdio MCP servers as child processes via `claude_desktop_config.json`. This is the native, zero-config path for local use.
- Streamable HTTP adds authentication, CORS, port management, and TLS complexity with zero benefit for a locally-spawned server.
- The Brain MCP already uses Streamable HTTP for remote access. MindrianOS-Plugin MCP is local-first.
- When remote room access is needed, add Streamable HTTP transport alongside stdio. The SDK supports dual transports on the same McpServer instance -- no code refactor needed.

**MCP server code pattern:**

```javascript
// bin/mindrian-mcp-server.cjs
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { z } = require("zod");

// Import shared core
const roomOps = require("../lib/core/room-ops.cjs");
const meetingOps = require("../lib/core/meeting-ops.cjs");

const server = new McpServer({ name: "mindrian-os", version: "0.4.2" });

// Thin wrapper: Zod schema -> core function -> MCP response
server.registerTool("analyze-room", {
  title: "Analyze Room",
  description: "Scan Data Room for gaps, convergence, contradictions",
  inputSchema: { roomPath: z.string().optional() }
}, async ({ roomPath }) => {
  const result = roomOps.analyzeRoom(roomPath || "./room");
  return { content: [{ type: "text", text: result }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### 2. Shared Core Library (CLI + MCP)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js CJS (no framework) | >=18 | `lib/core/*.cjs` shared internals called by both CLI and MCP | Mirrors proven GSD pattern. Zero additional dependencies. CJS because plugin ecosystem uses CommonJS. |

**Architecture:**

```
MindrianOS-Plugin/
  bin/
    mindrian-tools.cjs          # CLI entry point (GSD pattern: process.argv)
    mindrian-mcp-server.cjs     # MCP entry point (stdio transport)
  lib/
    core/                       # Shared internals -- the REAL logic
      room-ops.cjs              # Wraps scripts/analyze-room, compute-state
      meeting-ops.cjs           # Wraps scripts/compute-meetings-intelligence
      intelligence-ops.cjs      # Cross-relationship scan, convergence detection
      persona-ops.cjs           # AI team member generation
      opportunity-ops.cjs       # Grant search, opportunity matching
    tools/                      # MCP tool registrations (thin wrappers)
      room-tools.cjs            # registerTool calls for room operations
      meeting-tools.cjs         # registerTool calls for meeting operations
      intelligence-tools.cjs
      persona-tools.cjs
      opportunity-tools.cjs
    schemas/                    # Zod schemas shared between CLI and MCP
      room-schemas.cjs
      meeting-schemas.cjs
```

**Critical pattern:** `lib/core/*.cjs` functions wrap existing Bash scripts via `child_process.execSync`. The Bash scripts remain the authoritative computation layer. Core library is the Node.js API surface.

```javascript
// lib/core/room-ops.cjs
const { execSync } = require('child_process');
const path = require('path');

function analyzeRoom(roomPath) {
  const scriptDir = path.resolve(__dirname, '../../scripts');
  return execSync(`bash ${scriptDir}/analyze-room "${roomPath}"`, {
    encoding: 'utf-8',
    timeout: 5000
  });
}
```

**Why no Commander/yargs for CLI:** Claude is the caller, not a human. `process.argv` switch-case is sufficient. GSD's gsd-tools.cjs proves this works for 40+ subcommands with zero dependencies.

### 3. Opportunity Bank & Grant Discovery

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Grants.gov REST API | v1 | Programmatic search of US federal grants | Free. No API key needed for search endpoint (`v1/api/search2`). Returns structured JSON with opportunity details, deadlines, eligibility, amounts. 60 req/min rate limit. [HIGH confidence -- verified Grants.gov API docs] |
| `cheerio` | 1.2.0 | Parse HTML from non-API grant sources | jQuery-style DOM traversal. 19,873 npm dependents. Pure JS, no native bindings. Lightweight alternative to headless browsers. [HIGH confidence -- verified npm] |
| Native `fetch` | Built into Node 18+ | HTTP requests for APIs and web pages | No package needed. Node 18+ global fetch. |

**Grant discovery strategy:**

1. **Grants.gov API** (primary, structured) -- keyword search by domain from room STATE.md, filter by open/forecasted status, match against venture sector.
2. **Cheerio scraping** (secondary, for non-API sources) -- SBIR.gov program pages, state grant portals, foundation directories.
3. **Room-driven matching** -- extract venture domain, keywords, stage from room/STATE.md. Match against grant eligibility criteria. Score relevance.

**Trigger pattern: Hook-driven, not cron.**
- `session-start` hook already runs `analyze-room`. Extend it: `mindrian-tools.cjs opportunity-scan --room ./room`
- Each session start, check room domain keywords against cached grant data. Fetch fresh if stale (>24h).
- Results filed to `room/opportunity-bank/grants/` as structured Markdown entries.
- Zero infrastructure. No persistent process. No cron. Session start IS the trigger.

### 4. AI Team Member Personas

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| No new library | -- | Persona generation from room intelligence | Personas are structured Markdown files generated from room data + prompt templates. Not a library problem. |

**Pattern:**

Persona = structured Markdown in `room/team/ai-personas/<name>.md`:
```markdown
---
name: Dr. Sarah Chen
role: Market Validation Expert
hat: Yellow (Benefits)
domain: Healthcare AI market analysis
generated: 2026-03-24
source-sections: [market-analysis, competitive-analysis]
---

# Dr. Sarah Chen -- Market Validation Expert

## Expertise
[Generated from room/market-analysis/ and room/competitive-analysis/ content]

## Perspective (Yellow Hat -- Benefits)
[Bono's Six Hats perspective assignment]

## Communication Style
[Generated personality traits]

## Knowledge Boundaries
[What this persona knows vs. doesn't know, based on room content]
```

Generated by `lib/core/persona-ops.cjs` which reads room sections, extracts themes, assigns Bono hats, and templates the persona file. Claude loads persona files as context when the user invokes `/mindrian-os:team consult`.

**Why no persona framework (no LangChain agents, no CrewAI, no AutoGen):** These frameworks add massive dependency trees and fight ICM-native architecture where the folder IS the orchestration. Claude already IS the LLM. Persona files are context Claude reads -- no agent orchestration framework needed.

### 5. Scheduled Agents (OPTIONAL -- Future Only)

| Technology | Version | Purpose | When to Use |
|------------|---------|---------|-------------|
| `node-cron` | 4.2.1 | Schedule periodic grant discovery sweeps | ONLY if MCP server runs as persistent Streamable HTTP process (v3.x+ remote room mode). Not needed for v3.0 stdio mode. |

For v3.0, session-start hook handles all proactive scanning. `node-cron` is a future dependency, not a current one.

---

## Supporting Libraries (New)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^3.25.76 | Schema validation for MCP tools and CLI input validation | Always. Required by MCP SDK. |
| `cheerio` | 1.2.0 | HTML parsing for grant discovery scraping | When scraping grant sources beyond Grants.gov API. |

**Total new npm dependencies for v3.0: 2** (`@modelcontextprotocol/sdk` + `cheerio`). Zod is pulled in by SDK. Everything else is Node.js built-ins.

---

## Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `npx @modelcontextprotocol/inspector` | Test MCP server tools interactively | Official MCP debugging tool. Connects via stdio, lets you call tools and inspect responses. Use during development. |
| `claude --plugin-dir .` + Desktop config | Test dual delivery | CLI: test via plugin-dir flag. Desktop: add to claude_desktop_config.json as local stdio server. |

---

## Installation

```bash
# Initialize package.json (if not exists)
cd /home/jsagi/MindrianOS-Plugin
npm init -y

# Core: MCP server + schema validation
npm install @modelcontextprotocol/sdk@1.27.1 zod@^3.25

# Opportunity discovery: HTML parsing for non-API grant sources
npm install cheerio@1.2.0

# That's it. 3 packages. Everything else is Node.js built-ins or existing Bash scripts.
```

**Claude Desktop configuration (user-side):**

```json
{
  "mcpServers": {
    "mindrian-os": {
      "command": "node",
      "args": ["/path/to/MindrianOS-Plugin/bin/mindrian-mcp-server.cjs"],
      "env": {
        "MINDRIAN_ROOM_PATH": "/path/to/user/project/room"
      }
    }
  }
}
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `@modelcontextprotocol/sdk` stdio | Streamable HTTP transport | When remote team access is needed (v3.x+). Add alongside stdio on same McpServer instance. |
| Native `fetch` (Node 18+) | `node-fetch` / `axios` / `got` | Never. Native fetch is sufficient. Zero reason to add HTTP client dependencies. |
| `cheerio` for scraping | Playwright / Puppeteer | Only if a grant site requires JavaScript rendering (unlikely for .gov sites). 200MB+ browser download not justified. |
| No cron for v3.0 | `node-cron` / `agenda` / `bull` | Session-start hook handles proactive scanning. Add cron only if persistent server mode is built. |
| Filesystem room state | SQLite / Redis / Turso | Never. The filesystem IS the ICM architecture. Adding a database creates dual-source-of-truth. |
| Prompt-based personas | LangChain agents / CrewAI | Never. These fight ICM-native design. Claude loads persona markdown as context. |
| Zod 3.x | Zod 4.x | When MCP SDK ecosystem fully stabilizes on 4.x. The SDK accepts both, but 3.x has broader compatibility today. |
| Grants.gov free API | Paid grant databases (Foundation Directory Online, GrantStation) | Only if targeting private/foundation grants beyond federal scope. Adds cost. Defer until proven demand. |
| CJS modules | ESM modules | When Claude Code plugin ecosystem adopts ESM. Currently CJS is the norm (gsd-tools.cjs pattern). |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Express / Hono / Fastify for MCP | MCP SDK includes Hono internally for Streamable HTTP. Adding another HTTP framework creates conflicts. | MCP SDK's built-in transport layer |
| LangChain / CrewAI / AutoGen / Semantic Kernel | Fights ICM-native architecture. Adds 50+ transitive dependencies. Claude IS the LLM -- no orchestration framework needed. | Direct prompt engineering + room-as-context |
| SQLite / Redis / Turso for room state | Creates dual source of truth with filesystem. Breaks "folder IS orchestration" principle. | `room/` filesystem + STATE.md |
| WebSocket libraries (ws, socket.io) | MCP Streamable HTTP handles server-to-client push via SSE when needed. | MCP SDK Streamable HTTP transport (future) |
| Puppeteer / Playwright for scraping | 200MB+ browser download. Grant sites are server-rendered HTML. | `cheerio` + native `fetch` |
| Commander / yargs / meow for CLI | Claude is the caller, not a human. Process.argv parsing is sufficient. GSD pattern proves this. | Direct `process.argv` switch-case in CJS |
| Zod 4.x (for now) | Works with MCP SDK, but ecosystem (zod-to-json-schema) is more battle-tested with 3.x. | `zod@^3.25` |
| dotenv | Plugin runs in Claude's environment. MCP server inherits env from spawning process. `.env` files add confusion about where config lives. | Direct `process.env` access |
| TypeScript | Build step breaks "every output is an edit surface" principle. CJS files are directly inspectable and editable. | Plain CJS with JSDoc type comments if needed |
| npm workspaces / monorepo tools | Single repo with flat structure. No packages to link. | Flat `bin/` + `lib/` structure |

---

## Stack Patterns by Variant

**If building for CLI-only users (Claude Code):**
- `mindrian-tools.cjs` is the entry point
- Import from `lib/core/*` directly
- Hook scripts call `node bin/mindrian-tools.cjs <subcommand>`
- No MCP SDK in this path -- pure Node.js + Bash
- Because: CLI users have full script execution via hooks

**If building for Desktop/Cowork users:**
- `mindrian-mcp-server.cjs` is the entry point (stdio)
- Register MCP tools that wrap `lib/core/*` functions
- User adds to `claude_desktop_config.json`
- Because: Desktop/Cowork only speak MCP protocol, not plugin commands

**If both (the target):**
- Both entry points import the SAME `lib/core/*` modules
- Feature parity guaranteed by shared core
- Plugin commands = skill triggers CLI tools layer
- MCP tools = thin Zod-validated wrappers around same core
- Because: "Every feature ships as both" is the v3.0 rule

**If adding remote room access (v3.x+):**
- Add Streamable HTTP transport to existing McpServer
- Same instance, dual transports (stdio + HTTP)
- Room folder must be accessible (Git sync, mounted volume, or shared drive)
- Add `node-cron` for background opportunity scanning
- Because: Remote users can't trigger session-start hooks

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@modelcontextprotocol/sdk@1.27.1` | `zod@^3.25 \|\| ^4.0`, Node.js >=18 | SDK internally uses Hono 4.x, Express 5.x, ajv 8.x. Do NOT add these as direct dependencies -- they come bundled. |
| `zod@^3.25` | `@modelcontextprotocol/sdk@1.27.1`, `zod-to-json-schema@^3.25` | Pin to 3.x branch for stability. |
| `cheerio@1.2.0` | Node.js >=18 | Pure JS, no native bindings. Works everywhere. |
| Plugin layer (Markdown + JSON + Bash) | Claude Code 1.x+ | No change from v1.0/v2.0. Plugin layer is independent of MCP server layer. |
| Brain MCP (remote) | MCP protocol 2024+ | Already deployed. MindrianOS MCP server is SEPARATE -- Claude Desktop lists both in config. |

---

## Integration Points: How New Stack Connects to Existing

| Existing Component | How v3.0 Stack Integrates |
|-------------------|--------------------------|
| 20 Bash scripts in `scripts/` | `lib/core/*.cjs` wraps script invocations via `child_process.execSync`. Bash scripts remain authoritative. Core library is the Node.js API surface over them. |
| `hooks/hooks.json` + hook scripts | `session-start` hook gains opportunity scan: calls `node bin/mindrian-tools.cjs opportunity-scan`. New hook for persona refresh on room changes. |
| Brain MCP (brain.mindrian.ai) | MindrianOS MCP server is SEPARATE. Both listed in user's `claude_desktop_config.json`. Claude orchestrates between them. They share no code. |
| Plugin commands (commands/*.md) | Commands invoke `mindrian-tools.cjs` subcommands. Same core functions. Commands are the plugin-layer entry; tools.cjs is the execution layer. |
| De Stijl dashboard | Dashboard reads `room/` filesystem. MCP tools write to same filesystem. Dashboard auto-refreshes. No direct integration needed. |
| `room/` folder structure | Opportunity Bank = `room/opportunity-bank/`. Funding Room = `room/funding/`. AI Personas = `room/team/ai-personas/`. Same ICM pattern, new sections. |
| settings.json | Add MCP server path config. Plugin still uses `{"agent": "larry-extended"}`. |
| `.mcp.json` | Add MindrianOS local MCP server alongside existing Brain remote MCP. |

---

## Sources

- [@modelcontextprotocol/sdk on npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -- verified v1.27.1, dependencies, peer deps (`zod@^3.25 || ^4.0`), engine (Node >=18) [HIGH confidence]
- [MCP TypeScript SDK server docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) -- McpServer API, registerTool with Zod schemas, StdioServerTransport, Streamable HTTP [HIGH confidence]
- [MCP local server connection guide](https://modelcontextprotocol.io/docs/develop/connect-local-servers) -- stdio is native transport for Claude Desktop [HIGH confidence]
- [Claude Desktop MCP config](https://support.claude.com/en/articles/11503834-building-custom-connectors-via-remote-mcp-servers) -- claude_desktop_config.json format, stdio vs HTTP [HIGH confidence]
- [Grants.gov API](https://www.grants.gov/api) -- free search endpoint (`v1/api/search2`), no auth for search, 60 req/min, structured JSON responses [HIGH confidence]
- [Grants.gov API Guide](https://grants.gov/api/api-guide) -- endpoint details, query parameters, rate limits [HIGH confidence]
- [Cheerio on npm](https://www.npmjs.com/package/cheerio) -- verified v1.2.0, 19,873 dependents, pure JS [HIGH confidence]
- [node-cron on npm](https://www.npmjs.com/package/node-cron) -- verified v4.2.1, crontab syntax, pure JS [HIGH confidence]
- GSD reference implementation (`~/.claude/get-shit-done/bin/gsd-tools.cjs`) -- proven CJS single-entry-point pattern, 40+ subcommands, process.argv routing [HIGH confidence, local verification]

---
*Stack research for: MindrianOS v3.0 MCP Platform & Intelligence Expansion*
*Researched: 2026-03-24*
