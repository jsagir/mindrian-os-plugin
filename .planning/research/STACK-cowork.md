# Technology Stack: v1.8.0 Cowork Adaptation

**Project:** MindrianOS Plugin - Cowork Adaptation
**Researched:** 2026-04-05 (updated with verified sources)
**Scope:** NEW dependencies only. Existing stack (SDK 1.27.1, Zod, KuzuDB, chokidar, express, etc.) is validated and not re-researched.
**Overall confidence:** HIGH

## Current Installed State

Before recommending additions, here is what's already in package.json:

| Package | Installed Version | Relevant To This Milestone |
|---------|-------------------|---------------------------|
| `@modelcontextprotocol/sdk` | ^1.27.1 | YES - needs upgrade to ^1.29.0 for ext-apps peer dep + improved Streamable HTTP |
| `zod` | ^3.25 | Already installed. SDK accepts ^3.25 or ^4.0. ext-apps accepts same. |
| `express` | ^5.1.0 | Already installed - SDK's `createMcpExpressApp()` wraps Express for Streamable HTTP |
| `chokidar` | ^4.0.3 | Already installed - file watching for MCP resource subscriptions |
| `kuzu` | ^0.11.3 | Already installed - LazyGraph |
| `flexsearch` | ^0.7.43 | Already installed - full-text search |

## Recommended Stack Changes

### 1. SDK Upgrade (REQUIRED - ext-apps peer dependency)

| Technology | From | To | Purpose | Why |
|------------|------|-----|---------|-----|
| `@modelcontextprotocol/sdk` | ^1.27.1 | **^1.29.0** | Streamable HTTP transport, Tasks, MCP Apps compatibility | ext-apps@1.5.0 has peer dependency `@modelcontextprotocol/sdk: ^1.29.0`. Also provides `createMcpExpressApp()`, `StreamableHTTPServerTransport`, improved session management. |

**Confidence:** HIGH - verified npm registry April 5 2026: latest stable is 1.29.0. ext-apps peer dep verified via `npm view`.

**CRITICAL: SSE transport is deprecated.** SSE connections stopped being accepted April 1, 2026. All remote MCP servers must use Streamable HTTP. The SDK 1.29.0 provides `StreamableHTTPServerTransport` which is the replacement.

**What the upgrade provides at no additional cost:**
- `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk/server/streamableHttp.js` - Streamable HTTP for Cowork
- `createMcpExpressApp()` from `@modelcontextprotocol/sdk/server/express.js` - Express wrapper with DNS rebinding protection
- `MCP-Session-Id` header-based session management
- SSE streaming for server-to-client push (resource notifications)
- Tasks capability declaration
- `notifications/resources/list_changed` and `resources/subscribe` (already in 1.27.1)

**Do NOT use 2.0.0-alpha.** Breaking changes: TaskManager refactor, Standard Schema migration replacing Zod, WebSocketClientTransport removed. Stay on 1.x until 2.0 stable.

**Import paths (CJS - verified working):**
```javascript
// Already in use
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

// NEW for Streamable HTTP (verified: StreamableHTTPServerTransport exported)
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
```

### 2. MCP Apps Extension (NEW - Required for Data Room Views in Cowork)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@modelcontextprotocol/ext-apps` | **^1.5.0** | Interactive UI components rendered inline in Cowork/Claude/Desktop | THE official MCP extension for returning HTML UIs from MCP tools. Spec 2026-01-26, status: Stable. Supported by Claude, Claude Desktop, VS Code Copilot, Goose, ChatGPT, Postman, MCPJam. |

**Confidence:** HIGH - verified npm April 5 2026: latest is 1.5.0. Peer deps verified: SDK ^1.29.0 (requires our upgrade), React optional (confirmed via peerDependenciesMeta).

**Peer dependencies:**
- `@modelcontextprotocol/sdk: ^1.29.0` - REQUIRED (hence SDK upgrade above)
- `react: ^17 || ^18 || ^19` - OPTIONAL (confirmed via `peerDependenciesMeta`)
- `react-dom: ^17 || ^18 || ^19` - OPTIONAL
- `zod: ^3.25 || ^4.0` - already satisfied

**Sub-packages (exports map):**
| Export | Purpose | Need It? |
|--------|---------|----------|
| `@modelcontextprotocol/ext-apps/server` | `registerAppTool`, `registerAppResource`, `RESOURCE_MIME_TYPE` | **YES** - server-side registration |
| `@modelcontextprotocol/ext-apps` | Core `App` class, `PostMessageTransport` | For UI-side code only (bundled in HTML) |
| `@modelcontextprotocol/ext-apps/app-bridge` | Host-side rendering engine | NO - Claude/Cowork host handles this |
| `@modelcontextprotocol/ext-apps/react` | React hooks for UI | NO - we use vanilla HTML/JS + Cytoscape CDN |

**How MCP Apps work (verified from official spec):**

1. Server registers a tool with `_meta.ui.resourceUri` pointing to a `ui://` resource
2. Server registers a `ui://` resource containing bundled HTML (mime: `text/html;profile=mcp-app`)
3. When LLM calls the tool, host fetches the `ui://` resource and renders it in a sandboxed iframe
4. UI communicates with host via JSON-RPC over postMessage (bidirectional)
5. UI can call back to server tools, update model context, and receive fresh data

**Server-side pattern (verified from quickstart):**
```javascript
const { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } = require('@modelcontextprotocol/ext-apps/server');

const resourceUri = 'ui://room-dashboard/dashboard.html';

// Register tool with UI metadata
registerAppTool(server, 'room-dashboard', {
  title: 'Data Room Dashboard',
  description: 'Interactive De Stijl dashboard for the current room',
  inputSchema: {},
  _meta: { ui: { resourceUri } }
}, async () => {
  const roomState = await getRoomState(roomDir);
  return { content: [{ type: 'text', text: JSON.stringify(roomState) }] };
});

// Register the bundled HTML resource
registerAppResource(server, resourceUri, resourceUri,
  { mimeType: RESOURCE_MIME_TYPE },  // = 'text/html;profile=mcp-app'
  async () => ({
    contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: dashboardHtml }]
  })
);
```

**UI-side pattern (vanilla JS, no React, bundled in HTML):**
```html
<script src="https://cdn.jsdelivr.net/npm/@modelcontextprotocol/ext-apps/dist/src/app-with-deps.js"></script>
<script>
  const app = new App();
  await app.connect();
  // Receive tool result data
  app.ontoolresult = (result) => { renderDashboard(result); };
  // Call back to server for fresh data
  await app.callServerTool({ name: 'room-status', arguments: {} });
  // Update conversation context
  await app.updateModelContext({ content: [{ type: 'text', text: 'User selected section: market-analysis' }] });
</script>
```

### 3. NO Other New Dependencies Needed

Everything else required for this milestone is already available:

| Capability | Already Provided By | Notes |
|------------|-------------------|-------|
| Streamable HTTP transport | SDK 1.29.0 (`StreamableHTTPServerTransport`) | Replaces deprecated SSE |
| Express for HTTP endpoint | `express@5.1.0` (installed) | SDK wraps it via `createMcpExpressApp()` |
| Resource subscriptions | SDK (since 1.27.1) | `resources/subscribe` + `notifications/resources/updated` |
| File watching for subscriptions | `chokidar@4.0.3` (installed) | Watch room files, emit resource change notifications |
| Schema validation | `zod@^3.25` (installed) | SDK and ext-apps both accept it |
| De Bono persistent state | Filesystem (room/) | Markdown files in `room/perspectives/` |
| Brain-driven routing | Native fetch to brain.mindrian.ai | No library needed |
| Scheduled intelligence | Cowork's built-in scheduler | Platform feature, not a dependency |
| Session management | SDK 1.29.0 | `MCP-Session-Id` headers |
| UUID generation | `require('crypto').randomUUID()` | Built into Node 18+ |

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `node-cron` / `cron` | Cowork has built-in scheduled tasks (daily/weekly/hourly/weekday). Each scheduled task spins up a full session with all MCP servers. | Cowork's native task scheduler |
| `ws` / `socket.io` | MCP Streamable HTTP uses SSE for server-to-client push. WebSockets are not in the MCP spec. | SDK's SSE via Streamable HTTP |
| `@modelcontextprotocol/sdk@2.0.0-alpha.*` | Breaking changes: TaskManager refactor, Standard Schema replaces Zod, WebSocket removed. | Stay on ^1.29.0 |
| `@modelcontextprotocol/ext-apps/react` | De Stijl views are vanilla HTML/JS with Cytoscape.js (CDN). React adds peer dep complexity and build step. | Vanilla HTML served as MCP App resources |
| `hono` / `fastify` | SDK bundles Hono internally for Streamable HTTP. Express already installed. | `createMcpExpressApp()` or raw `StreamableHTTPServerTransport` |
| Any state management library | De Bono hat persistence is markdown files in room/. Filesystem IS the state store (ICM principle). | `room/perspectives/{hat-color}/STATE.md` |
| `bull` / `agenda` / `bee-queue` | No background job queue needed. Cowork scheduler handles recurring work. | Cowork scheduled tasks |
| `uuid` | `require('crypto').randomUUID()` is native in Node 18+. | Built-in crypto module |
| `dotenv` | Plugin runs in Claude's environment. MCP server inherits env vars from spawning process. | Direct `process.env` access |

## Installation

```bash
# Upgrade SDK to meet ext-apps peer dependency
npm install @modelcontextprotocol/sdk@^1.29.0

# Add MCP Apps extension for interactive UI in Cowork
npm install @modelcontextprotocol/ext-apps@^1.5.0

# That's it. 1 upgrade + 1 new package.
```

**Total new packages:** 1 (`@modelcontextprotocol/ext-apps`)
**Total upgrades:** 1 (`@modelcontextprotocol/sdk` 1.27.1 -> 1.29.0)
**Total removed:** 0

## Feature-to-Stack Mapping

| v1.8.0 Feature | Stack Components | New? |
|----------------|-----------------|------|
| **64-command MCP coverage** | SDK `McpServer.tool()` + existing `lib/core/*.cjs` | No - same pattern, more entries |
| **Brain-driven routing** | Native fetch to brain.mindrian.ai + SDK tool registration | No - Brain MCP already deployed |
| **Streamable HTTP for Cowork** | SDK 1.29.0 `StreamableHTTPServerTransport` + express 5.1 | Upgrade only |
| **MCP Apps Data Room views** | `@modelcontextprotocol/ext-apps@1.5.0` server submodule | **NEW** |
| **Resource subscriptions** | SDK `resources/subscribe` + chokidar file watching | No - already available |
| **Cowork scheduled intelligence** | Cowork's built-in task scheduler + MCP tool invocation | No (platform feature) |
| **De Bono persistent hats** | Filesystem `room/perspectives/` + McpServer tools | No |
| **Surface auto-detection** | `process.env.MINDRIAN_TRANSPORT` + SDK dual transport | Upgrade only |
| **Session management** | SDK `MCP-Session-Id` headers | Upgrade only |

## Architecture: Transport Strategy

### Transport Decision Matrix

| Surface | Transport | Configuration | Why |
|---------|-----------|---------------|-----|
| **CLI** | N/A (direct script execution) | Plugin hooks fire scripts | CLI has full Bash access, no MCP needed for most commands |
| **Desktop** | stdio | `claude_desktop_config.json` | Desktop spawns MCP servers as child processes. stdio is zero-config. |
| **Cowork** | Streamable HTTP | Settings > Integrations (URL) | Cowork connects to MCP servers via URL. SSE deprecated April 1 2026. |

**IMPORTANT:** Do NOT add remote MCP servers to `claude_desktop_config.json`. Claude Desktop ignores remote servers in the JSON config. Remote servers (Streamable HTTP) must be added via Settings > Integrations in the UI.

### Dual Transport Server Pattern

```javascript
// bin/mindrian-mcp-server.cjs
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { randomUUID } = require('crypto');

const server = new McpServer({ name: 'mindrian-os', version });

// Register all tools on the single McpServer instance
registerRouterTools(server, roomDir, pluginRoot, larryContext);
registerResources(server, roomDir);
registerPrompts(server, roomDir, pluginRoot);
registerAppViews(server, roomDir);  // NEW: MCP Apps views

// Detect surface via env var
if (process.env.MINDRIAN_TRANSPORT === 'http') {
  // Cowork: Streamable HTTP on localhost
  const port = parseInt(process.env.MINDRIAN_PORT || '3847', 10);
  const express = require('express');
  const app = express();
  app.use(express.json());

  app.post('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID()
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(port, '127.0.0.1', () => {
    process.stderr.write(`[mindrian-os] Streamable HTTP on http://127.0.0.1:${port}/mcp\n`);
  });
} else {
  // Desktop: stdio (default)
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

## Cowork Environment Constraints (Verified)

Cowork runs in a sandboxed Linux VM on the user's machine. Understanding these constraints is critical:

| Constraint | Detail | Impact on MindrianOS |
|------------|--------|---------------------|
| **VM isolation** | Bubblewrap (bwrap) sandbox within VM. VirtioFS for host file access. | Room folder must be explicitly mounted by user |
| **Folder access** | Only user-selected folders mounted into VM. Home-directory-only UI restriction. | Room must be under ~/. External drives fail. |
| **Network** | Hard-coded 22-domain allowlist (NPM, PyPI, Anthropic API, etc.) | brain.mindrian.ai must be reachable OR Brain MCP connected via Integrations |
| **MCP servers** | Each scheduled task inherits all connected MCP servers | MindrianOS MCP auto-available in scheduled tasks |
| **Scheduled tasks** | Daily/weekly/hourly/weekday/on-demand. Only run while Desktop app is open. | Not a 24/7 daemon. "Daily briefing" runs when user opens Desktop. |
| **Memory persistence** | Projects retain memory across sessions. Standalone sessions do not. | Room must be part of a Cowork Project for persistent context |
| **Known bug** | Creating new scheduled task can disable MCP connectors in existing tasks (issue #40835, #43397) | Workaround: configure MCP servers in `~/.claude/mcp.json` for cloud-backed tasks |

## Persistent Agent State: De Bono Hats

No library needed. Each hat is a perspective agent with state stored in the room filesystem:

```
room/
  perspectives/
    white-hat/     # Facts and data
      STATE.md     # Current focus, last analysis timestamp
      analysis.md  # Latest objective analysis
    red-hat/       # Emotions and intuition
      STATE.md
      analysis.md
    black-hat/     # Causal chain validation, risks
      STATE.md
      analysis.md
    yellow-hat/    # HSI + analogies, benefits
      STATE.md
      analysis.md
    green-hat/     # Creative alternatives
      STATE.md
      analysis.md
    blue-hat/      # Brain framework chains, meta-process
      STATE.md
      analysis.md
```

State persistence between Cowork sessions is handled by Cowork's Project memory + the filesystem. No database, no Redis, no state management library. The room IS the state.

## KAIROS Readiness (Future-Proofing)

The Claude Code source leak revealed KAIROS - an always-on background agent with `autoDream` memory consolidation. While not yet publicly available, our architecture naturally supports it:

- Room artifacts are plain files (KAIROS can read/write them)
- MCP tools are the API surface (KAIROS would invoke them)
- State is filesystem-based (KAIROS autoDream can consolidate without special adapters)
- No library needed now. When KAIROS ships, MindrianOS tools are already consumable.

## Version Compatibility Matrix

| Package | Node.js | MCP SDK | Zod | Notes |
|---------|---------|---------|-----|-------|
| `@modelcontextprotocol/sdk@1.29.0` | >=18 | N/A | ^3.25 or ^4.0 | Bundles: Hono 4.x, Express 5.x, ajv 8.x, jose 6.x |
| `@modelcontextprotocol/ext-apps@1.5.0` | >=18 | ^1.29.0 | ^3.25 or ^4.0 | React optional. Server submodule has no React dependency. |
| `express@5.1.0` (installed) | >=18 | N/A | N/A | SDK also bundles Express 5.x internally |
| `chokidar@4.0.3` (installed) | >=18 | N/A | N/A | Pure JS, no native bindings |

## Critical Integration Points

### 1. Existing MCP Server (bin/mindrian-mcp-server.cjs)
- **Currently:** stdio only, 6 hierarchical router tools covering 49/64 commands
- **Change:** Add Streamable HTTP transport option (env-based), expand router to 64 commands, register MCP App views
- **Risk:** LOW - verified `StreamableHTTPServerTransport` is available in installed SDK

### 2. Existing Resources (lib/mcp/resources.cjs)
- **Currently:** Read-only room browsing via `room://` URIs
- **Change:** Add `resources/subscribe` handler, use chokidar to watch room files, emit `notifications/resources/updated`
- **Risk:** LOW - chokidar already installed and proven in this project

### 3. Existing Tool Router (lib/mcp/tool-router.cjs)
- **Currently:** 6 router tools dispatching to 49 commands via hierarchical grouping
- **Change:** Expand groups to cover all 64 commands, add Brain consultation at routing layer
- **Risk:** LOW - same pattern, more entries in each command group

### 4. New MCP Apps Views (lib/mcp/app-views.cjs -- NEW)
- **Currently:** Dashboard/wiki/graph are HTML files generated to room/ or served via express
- **Change:** Same HTML content served as MCP App resources via `ui://` URIs, rendered inline in Cowork/Desktop/Claude
- **Risk:** MEDIUM - ext-apps is Stable spec (Jan 2026) but relatively new. Vanilla JS examples exist and are proven. Our existing De Stijl HTML + Cytoscape.js patterns port directly.

### 5. Brain-Driven Routing (NEW layer in tool-router.cjs)
- **Currently:** CLI `/mos:act` does Brain consultation via bash scripts
- **Change:** MCP tool router consults Brain MCP (native fetch to brain.mindrian.ai) before dispatching methodology chains
- **Risk:** LOW - Brain MCP already deployed and stable. Native fetch, no new dependency.

### 6. Cowork Scheduled Tasks (Platform feature, no code change)
- **Currently:** CLI session-start hook runs `analyze-room`
- **Change:** User configures Cowork scheduled tasks that invoke MCP tools on cadence
- **Risk:** MEDIUM - documented bugs with MCP connector access in scheduled tasks (GitHub issues #40835, #43397). Mitigation: configure servers in `~/.claude/mcp.json` rather than only via UI.

## Sources

- [@modelcontextprotocol/sdk npm registry](https://www.npmjs.com/package/@modelcontextprotocol/sdk) - v1.29.0 latest stable [HIGH confidence, verified April 5 2026]
- [@modelcontextprotocol/ext-apps npm](https://www.npmjs.com/package/@modelcontextprotocol/ext-apps) - v1.5.0 latest, peer dep on SDK ^1.29.0, React optional [HIGH confidence, verified via npm view]
- [MCP Apps official spec](https://modelcontextprotocol.io/docs/extensions/apps) - Stable, ui:// scheme, sandboxed iframe, bidirectional JSON-RPC [HIGH confidence]
- [MCP Apps blog post](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) - Architecture, security model, App SDK [HIGH confidence]
- [ext-apps GitHub](https://github.com/modelcontextprotocol/ext-apps/) - spec, SDK, vanilla JS example [HIGH confidence]
- [MCP Apps Quickstart](https://apps.extensions.modelcontextprotocol.io/api/documents/Quickstart.html) - registerAppTool, registerAppResource, RESOURCE_MIME_TYPE [HIGH confidence]
- [TypeScript SDK server docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) - Streamable HTTP, dual transport, session management [HIGH confidence]
- [MCP Streamable HTTP deep dive](https://www.claudemcp.com/blog/mcp-streamable-http) - SSE deprecated April 1 2026, Streamable HTTP replacement [MEDIUM confidence]
- [Claude Cowork help center](https://support.claude.com/en/articles/13345190-get-started-with-cowork) - VM sandbox, scheduled tasks, project memory, limitations [HIGH confidence]
- [Cowork MCP connector bugs](https://github.com/anthropics/claude-code/issues/40835) - scheduled task MCP disable bug [HIGH confidence]
- [Cowork folder mount constraints](https://github.com/anthropics/claude-code/issues/19318) - external volume mounting fails [HIGH confidence]
- [Claude Code build remote MCP](https://support.claude.com/en/articles/11503834-build-custom-connectors-via-remote-mcp-servers) - remote servers via Settings > Integrations, not JSON config [HIGH confidence]
- [MCP Resources specification](https://modelcontextprotocol.io/specification/2025-06-18/server/resources) - subscribe, list_changed, notifications [HIGH confidence]
- [ccleaks KAIROS analysis](https://ccleaks.com) - background agent, autoDream, feature flags [MEDIUM confidence - leaked source, not official]
