# MCP Apps Strategic Research: MindrianOS as MCP-Native Product

**Date:** 2026-04-09
**Author:** Research Agent (Claude Opus 4.6)
**Purpose:** Determine whether MindrianOS should pivot from CLI-plugin to MCP-native product using MCP Apps
**Depends on:** RESEARCH_17 (MCP UI Frameworks), generative-ui-deep-research.md, Phase 60 (existing MCP Apps implementation)
**Decision weight:** HIGH - this determines product architecture direction

---

## Table of Contents

1. [MCP Apps Technical Deep Dive](#1-mcp-apps-technical-deep-dive)
2. [MindrianOS Current MCP State](#2-mindrianos-current-mcp-state)
3. [Feature Migration Map](#3-feature-migration-map)
4. [The Strategic Question](#4-the-strategic-question)
5. [MCP-UI Community Ecosystem](#5-mcp-ui-community-ecosystem)
6. [Limitations and Risks](#6-limitations-and-risks)
7. [Recommended Architecture](#7-recommended-architecture)
8. [Migration Path](#8-migration-path)
9. [Risk Assessment](#9-risk-assessment)
10. [RECOMMENDATION](#10-recommendation)

---

## 1. MCP Apps Technical Deep Dive

### 1.1 What MCP Apps Are

MCP Apps (SEP-1865, extension ID `io.modelcontextprotocol/ui`) is the first official extension to the Model Context Protocol specification. Released 2026-01-26. It allows MCP server tools to return interactive HTML interfaces that render directly inside the conversation in any compliant host.

The core insight: instead of tools returning only text/JSON, they can declare a `ui://` resource containing an HTML page. The host renders this in a sandboxed iframe with bidirectional JSON-RPC communication.

**Official spec:** https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx
**SDK:** `@modelcontextprotocol/ext-apps` v1.5.0+ (MindrianOS already depends on v1.5.0)
**Blog:** https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/

### 1.2 UI Primitives Available

**Full web platform.** MCP Apps render in an iframe, which means:

| Primitive | Supported | Notes |
|-----------|-----------|-------|
| HTML/CSS/JS | YES | Any standard web content |
| React | YES | Official starter template exists |
| Vue | YES | Official starter template exists |
| Svelte | YES | Official starter template exists |
| Preact | YES | Official starter template exists |
| Solid | YES | Official starter template exists |
| Vanilla JS | YES | Official starter template exists |
| Canvas 2D | YES | Standard HTML5 canvas |
| WebGL | YES | Three.js example in official repo |
| SVG | YES | Standard inline or embedded |
| Cytoscape.js | YES | Standard JS library, loadable via CDN (with CSP) or bundled |
| Mermaid | YES | Standard JS library |
| Web Audio | YES | Requires `microphone` permission for input |
| Video | YES | Standard HTML5 video |
| WebSocket | YES | Requires CSP `connectDomains` configuration |
| IndexedDB | YES | Available in iframe context |
| LocalStorage | YES | Scoped to iframe origin (host-dependent) |

**Critical finding:** There is NO restriction on what web technologies you can use inside the iframe. If it runs in a browser, it runs in an MCP App. The official examples include Three.js 3D rendering, CesiumJS globe maps, GLSL shaders, PDF viewers, video players, and speech-to-text.

### 1.3 Sandbox Model

MCP Apps run in a sandboxed iframe with the following mandatory permissions:
- `allow-scripts` - JavaScript execution
- `allow-same-origin` - Same-origin access (for IndexedDB, localStorage)

The sandbox PREVENTS:
- Access to the parent window's DOM
- Reading host cookies or localStorage
- Navigating the parent page
- Executing scripts in the parent context
- Access to the host filesystem (no `fs` module, no File System Access API by default)

**CSP (Content Security Policy)** is deny-by-default:
```
default-src 'none';
script-src 'self' 'unsafe-inline';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
media-src 'self' data:;
connect-src 'none';
```

External resources (CDN scripts, fonts, images) require explicit CSP declaration in `_meta.ui.csp`:
```json
{
  "_meta": {
    "ui": {
      "resourceUri": "ui://mindrian-os/dashboard",
      "csp": {
        "resourceDomains": ["fonts.googleapis.com", "cdn.jsdelivr.net"],
        "connectDomains": ["api.mindrian.ai"]
      }
    }
  }
}
```

**Permissions** that can be requested:
- `camera` - camera access
- `microphone` - microphone access
- `geolocation` - location access
- `clipboardWrite` - clipboard write access

Hosts MAY honor or deny these permissions.

### 1.4 Bidirectional Communication

The communication model uses JSON-RPC 2.0 over `postMessage`:

**Host -> App (notifications):**
- `ui/notifications/tool-input` - streams tool arguments as they arrive (before tool execution completes)
- `ui/notifications/tool-result` - pushes completed tool result to app
- Theme changes, display mode changes

**App -> Host (requests):**
- `tools/call` - app calls any MCP tool on the same server (or other servers if visibility allows)
- `ui/context/update` - app updates the model's context with structured data
- `ui/openLink` - request host to open a URL
- `ui/log` - logging

**Critical pattern for MindrianOS:** An MCP App can call back to any tool on the MindrianOS MCP server. This means the dashboard app can call `room_state`, `room_graph`, `methodology`, etc. The UI becomes a visual front-end for the entire 64-command tool suite.

```javascript
// Inside MCP App HTML:
const app = new App({ name: 'MindrianOS Dashboard', version: '1.0.0' });
app.connect();

// Call any MindrianOS MCP tool from the UI
const roomState = await app.callServerTool({
  name: 'room_state',
  arguments: { command: 'status' }
});

// Call methodology tools
const analysisResult = await app.callServerTool({
  name: 'methodology',
  arguments: { command: 'lean-canvas', section: 'problem-definition' }
});
```

### 1.5 Hosting Model

MCP Apps are served as `ui://` resources from the MCP server itself. The HTML is either:

1. **Bundled inline** - the server reads an HTML file and returns it as `text` in the resource response (MindrianOS current pattern)
2. **Built with Vite + vite-plugin-singlefile** - bundles all CSS/JS into a single HTML file
3. **External URL** - the `_meta.ui.csp` can allow loading from external origins

**MindrianOS already uses pattern #1.** The `app-views.cjs` file loads HTML templates from `lib/mcp/app-html/` and serves them via `registerAppResource`.

### 1.6 Bundle Size Limits

**No explicit size limit in the specification.** The spec defines content delivery as either `text` (string) or `blob` (base64). Practical limits are:
- JSON-RPC message size limits of the transport (stdio: effectively unlimited; HTTP: server-configured)
- Host memory constraints
- Current MindrianOS templates: dashboard.html (316 lines), wiki.html (383 lines), graph.html (428 lines) - all well under any practical limit
- Heavy libraries (Cytoscape.js ~800KB, Three.js ~600KB) should be loaded via CDN with CSP rather than inlined

### 1.7 State Persistence

**Within a conversation:** State persists naturally in the iframe's JavaScript runtime. Variables, IndexedDB, localStorage all work.

**Across conversations:** This is the key limitation. When the conversation ends or the MCP server disconnects, the iframe is destroyed. State must be persisted either:
- Server-side (MCP server writes to filesystem/database)
- Via tool calls (app calls a "save state" tool that writes to room/)
- In the room's STATE.md or a dedicated `.mindrian/ui-state.json` file

**Known issue (OpenAI):** On ChatGPT, revisiting a conversation does NOT re-fire `ontoolresult` for existing data. The app remounts in initial state. This is a host implementation detail, not a spec limitation. Claude handles this better.

### 1.8 Filesystem Access

**MCP Apps (the HTML iframe) have NO direct filesystem access.** This is by design - security sandbox.

**But:** The MCP App can call tools on the MCP server, and the MCP server has full filesystem access. So the pattern is:
1. App needs file data -> calls server tool -> server reads filesystem -> returns data
2. App needs to save -> calls server tool -> server writes to filesystem

This is exactly how MindrianOS already works. The dashboard HTML calls back to the server for room data refresh.

### 1.9 Client Support (April 2026)

| Client | MCP Apps Support | Status |
|--------|-----------------|--------|
| Claude (web) | YES | Full support |
| Claude Desktop | YES | Full support |
| ChatGPT | YES | Full support (via Apps SDK compatibility) |
| VS Code (GitHub Copilot) | YES | Insiders build, rolling out |
| Goose (Block/Square) | YES | Full support |
| Postman | YES | Full support |
| MCPJam | YES | Full support |
| JetBrains IDEs | EXPLORING | Under investigation |
| AWS | EXPLORING | Under investigation |
| Google DeepMind | EXPLORING | Antigravity integration |
| Cursor/Windsurf | NOT YET | No announcement |

**Critical finding:** MCP Apps work on BOTH Claude AND ChatGPT. This is the platform-independence answer.

---

## 2. MindrianOS Current MCP State

### 2.1 Existing MCP Infrastructure

MindrianOS already has substantial MCP infrastructure:

| Component | File | Status |
|-----------|------|--------|
| MCP Server | `bin/mindrian-mcp-server.cjs` | Shipped, dual transport (stdio + HTTP) |
| Tool Router | `lib/mcp/tool-router.cjs` | 9 router tools covering 64 CLI commands |
| App Views | `lib/mcp/app-views.cjs` | 3 MCP Apps (dashboard, wiki, graph) |
| HTML Templates | `lib/mcp/app-html/*.html` | 3 templates, 1,127 lines total |
| Capability Registry | `lib/mcp/capability-registry.cjs` | Surface-aware feature gating |
| Surface Detection | `lib/mcp/surface-detect.cjs` | Auto-detects CLI/Desktop/Cowork |
| Resources | `lib/mcp/resources.cjs` | Read-only room browsing via room:// URIs |
| Prompts | `lib/mcp/prompts.cjs` | Methodology workflows with Larry personality |
| Session Catch-up | `lib/mcp/session-catchup.cjs` | State preservation across sessions |
| Pipeline State | `lib/mcp/pipeline-state.cjs` | Multi-step pipeline tracking |

### 2.2 What Already Works

The existing `app-views.cjs` already implements the MCP Apps pattern correctly:
- Uses `registerAppTool` and `registerAppResource` from `@modelcontextprotocol/ext-apps/server`
- Serves HTML via `ui://mindrian-os/*` URIs
- Uses `RESOURCE_MIME_TYPE` (`text/html;profile=mcp-app`)
- Dashboard renders Mondrian grid, wiki renders section browser, graph renders Cytoscape.js
- Bidirectional communication is declared (APP-06) but the HTML templates use a basic `postMessage` pattern

### 2.3 What's Missing

| Gap | Description | Effort |
|-----|-------------|--------|
| No `App` class usage in HTML | Templates don't import `@modelcontextprotocol/ext-apps` client-side `App` class | Small - add script import |
| No `callServerTool` in UI | Dashboard can't refresh data by calling room_state tool | Medium - wire up bidirectional calls |
| No host theming | Templates use hardcoded De Stijl tokens, don't consume `useHostStyles` | Small - optional, De Stijl IS the brand |
| No CSP declarations | Templates assume bundled assets only; CDN Cytoscape requires CSP | Small - add csp to _meta.ui |
| CLI gets nothing | CLI surface has `apps: false` in capability map | By design - CLI uses terminal output |
| No action buttons | Dashboard is read-only, no "Run Lean Canvas" buttons | Medium - add tool-calling buttons |
| No form inputs | No meeting filing form, no search input in wiki | Medium - new App views |
| 3 apps only | 64 commands but only 3 visual apps | Large - build more apps |

### 2.4 Package Dependencies

MindrianOS already has `@modelcontextprotocol/ext-apps@^1.5.0` in `package.json`. The SDK is installed and in use. No new dependencies are needed to expand MCP Apps.

---

## 3. Feature Migration Map

### 3.1 Every Major Feature Mapped

| Feature | Current (CLI) | MCP App Version | Feasibility | Effort |
|---------|--------------|-----------------|-------------|--------|
| **Data Room Dashboard** | localhost HTML via /mos:room | Inline Mondrian grid with live section counts, stage badge, health score | DONE (exists) | Enhance |
| **Knowledge Graph** | Cytoscape in localhost browser | Inline interactive Cytoscape graph with pan/zoom/filter | DONE (exists) | Enhance |
| **Wiki Browser** | localhost server via /mos:wiki | Inline section browser with article navigation | DONE (exists) | Enhance |
| **APPROVE/REJECT/DEFER** | Larry asks in text, user types response | Clickable buttons in dashboard that call `room_content` tool | HIGH | 2-3 days |
| **Mode Selection** | Session-start text prompt | Visual card with 3 mode buttons (Explorer/Builder/Critic) | HIGH | 1-2 days |
| **Onboarding Wizard** | 7-step conversation with Larry | Multi-step form with progress stepper, each step calls `orchestration` tool | HIGH | 1 week |
| **Meeting Filing** | Text paste, Larry processes | Form with text area, speaker tagging dropdowns, date picker, calls `meeting` tool | HIGH | 3-5 days |
| **Room Status** | Text table from /mos:status | Mondrian grid live view with section health colors | HIGH (dashboard enhancement) | 2-3 days |
| **Grading** | Text rubric from /mos:grade | Visual scorecard with radar chart, letter grade badge, component breakdown | HIGH | 3-5 days |
| **Pipeline Progress** | Text progress from /mos:pipeline | Visual pipeline tracker with step indicators, current step highlighted | HIGH | 2-3 days |
| **Opportunity Bank** | Text list from /mos:opportunities | Card grid with deadline badges, relevance scores, "Apply" action buttons | HIGH | 3-5 days |
| **Lean Canvas** | Text conversation with Larry | 9-box visual canvas, each box editable, auto-saves to room | MEDIUM | 1 week |
| **Six Thinking Hats** | Text conversation cycling hats | Visual hat carousel with color-coded panels, rotate button | MEDIUM | 3-5 days |
| **Grant Discovery** | Text results from /mos:research | Table with sort/filter, deadline countdown, relevance score bars | HIGH | 3-5 days |
| **Persona Gallery** | Text from /mos:persona | Visual cards with avatar, hat color, "Ask This Persona" button | MEDIUM | 2-3 days |
| **Export Preview** | Browser opens static HTML | Inline preview of export before saving, with "Export" button | HIGH | 3-5 days |
| **Mondrian Banner** | ASCII art in terminal | SVG Mondrian banner rendered inline | HIGH | 1 day |

### 3.2 What CANNOT Be MCP Apps

| Feature | Why Not | Alternative |
|---------|---------|-------------|
| SessionStart hooks | MCP Apps are triggered by tool calls, not session lifecycle | Keep as CLI hook; MCP server's session-catchup handles Desktop/Cowork |
| PostToolUse hooks | App can't intercept tool calls between LLM and server | Server-side middleware in tool-router.cjs |
| File watchers (chokidar) | Iframe has no filesystem access | Server-side watcher notifies app via tool result push |
| Background intelligence (scout) | No persistent background process in iframe | MCP server-side scheduled tasks; Cowork persistent agents |
| HSI computation (Python) | Can't run Python in iframe | Server-side script, results displayed in app |
| Velma transcription | API calls need server-side keys | Server-side tool, streaming results to app |
| Brain MCP queries | Separate MCP server, app can't directly reach it | Server-side proxy tool; app calls MindrianOS tool which calls Brain |

### 3.3 The 80/20 Analysis

**80% of user-facing value can be delivered through 5 MCP Apps:**

1. **Room Command Center** (enhanced dashboard) - status, sections, actions, APPROVE/REJECT
2. **Knowledge Explorer** (enhanced graph + wiki merged) - graph view, article drill-down, search
3. **Methodology Workbench** - Lean Canvas, Hats, Beautiful Question as visual tools
4. **Meeting Studio** - filing form, speaker tagging, intelligence results
5. **Pipeline Monitor** - chain progress, framework sequence, suggested next

The remaining 20% (hooks, background intelligence, Brain queries, HSI) stays server-side where it already works.

---

## 4. The Strategic Question

### 4.1 Does MCP Apps Make MindrianOS Platform-Independent?

**YES.** This is the single most important finding of this research.

MCP Apps work on:
- Claude (web + desktop) - Anthropic
- ChatGPT - OpenAI
- VS Code GitHub Copilot - Microsoft
- Goose - Block/Square
- Postman - API platform
- Any future MCP-compliant client

A MindrianOS MCP server with MCP Apps would work identically across ALL these platforms. The same dashboard, same graph, same wiki, same forms. One codebase, every AI client.

**This removes the Claude Code dependency.** MindrianOS currently requires Claude Code for its full power (hooks, scripts, slash commands). With MCP Apps, the full visual experience works on ANY MCP client. The server runs locally, the UI renders in whatever client the user prefers.

### 4.2 Business Model Shift

| Current Model | MCP-Native Model |
|--------------|-----------------|
| Claude Code plugin (marketplace) | MCP server (any client) |
| Requires Claude Code subscription | Works with ANY AI subscription |
| Distribution: Claude plugin marketplace only | Distribution: npm, MCPHub, MCP Market, GitHub, .mcpb packages |
| CLI-first, Desktop/Cowork as secondary | Visual-first, CLI as power-user option |
| Locked to Anthropic ecosystem | Platform-agnostic, ecosystem-independent |
| Brain MCP = remote enrichment | Brain MCP = same pattern, works everywhere |

**The marketplace shifts from Claude-specific to MCP-ecosystem-wide:**
- MCPHub (getmcpapps.com) - first dedicated MCP Apps marketplace
- MCP Market (mcpmarket.com) - directory of MCP servers
- npm - standard package distribution
- .mcpb Desktop Extensions - one-click install for Claude Desktop

### 4.3 Competitive Landscape

| Competitor | What They Do | MindrianOS Advantage |
|-----------|-------------|---------------------|
| Generic MCP servers (filesystem, git, database) | Single-purpose tools | Integrated wicked problem management system |
| Shopify MCP UI | Commerce-specific interactive components | Domain: innovation/venture methodology, not commerce |
| mcp-generative-ui | Auto-wraps any MCP server with UI | MindrianOS has purpose-built De Stijl UI with domain logic |
| Flowbite MCP UI Starter | Generic widget library | MindrianOS has 25 methodology frameworks + Brain intelligence |
| Individual methodology tools | Single framework (e.g., "lean canvas generator") | Integrated 64-command suite with cross-framework chaining |

**Nobody else has:** A knowledge graph (Brain) + 25 chained methodology frameworks + visual Data Room + grading intelligence + meeting filing pipeline, all delivered as MCP Apps that work on every AI platform.

### 4.4 Does This Solve the "Dependency on Claude" Problem?

**Partially but significantly.**

What it DOES solve:
- UI works on Claude, ChatGPT, VS Code, Goose, and any future MCP client
- MCP server is a standard Node.js process - no platform lock-in
- Distribution is platform-agnostic (npm, not just Claude marketplace)
- Users on OpenAI, Microsoft, or other ecosystems can use MindrianOS

What it does NOT solve:
- Claude Code hooks (SessionStart, PostToolUse) are Claude-specific
- Skills/agents/commands (.claude-plugin format) are Claude-specific
- Larry's personality is prompt-engineered for Claude's behavior patterns
- Brain MCP is model-agnostic but Larry's reasoning quality varies by model

**The migration creates a dual-distribution model:**
- **Claude Code Plugin** (current): Full power with hooks, skills, proactive intelligence
- **MCP Server** (new): Visual experience on any platform, slightly less proactive (no hooks), same tools

### 4.5 Can MindrianOS Run on ChatGPT/Copilot/Cursor?

| Platform | MCP Server Support | MCP Apps Support | MindrianOS Viability |
|----------|-------------------|-----------------|---------------------|
| ChatGPT | YES (via Apps SDK) | YES | FULL visual experience |
| VS Code Copilot | YES | YES (Insiders) | FULL visual experience |
| Cursor | YES (MCP servers) | NOT YET | Tools only, no UI yet |
| Windsurf | YES (MCP servers) | NOT YET | Tools only, no UI yet |
| Goose | YES | YES | FULL visual experience |
| JetBrains | YES (MCP servers) | EXPLORING | Tools only for now |

**ChatGPT compatibility is the biggest unlock.** OpenAI explicitly supports MCP Apps through their Apps SDK, with full iframe-and-bridge compatibility. MindrianOS could reach ChatGPT's user base.

---

## 5. MCP-UI Community Ecosystem

### 5.1 MCP-UI Organization

**GitHub:** https://github.com/MCP-UI-Org/mcp-ui (4.6K stars, 344 forks)
**Site:** https://mcpui.dev/

MCP-UI pioneered the concept of interactive UI over MCP and directly influenced the official MCP Apps specification. The community packages are now fully compliant with the MCP Apps standard.

**Packages:**
- `@mcp-ui/client` - recommended SDK for MCP Apps hosts (React components: `AppRenderer`, `UIResourceRenderer`)
- `@mcp-ui/server` - `createUIResource()` helper for servers
- `mcp_ui_server` (Ruby) - Ruby gem
- `mcp-ui-server` (Python) - Python package

**Adopters:** Postman, HuggingFace, Shopify, Goose, ElevenLabs

### 5.2 Shopify's Approach

Shopify's "Breaking the Text Wall" blog (https://shopify.engineering/mcp-ui-breaking-the-text-wall) introduced an **intent-based messaging system** where:
- UI components don't directly modify state
- Components bubble up "intents" to the agent
- Agent interprets intents and takes action
- Preserves agent control while enabling rich interaction

This pattern maps directly to MindrianOS: a "Run Lean Canvas" button doesn't execute the framework directly - it sends an intent to Larry, who then runs the methodology with full context.

### 5.3 Community Patterns for Complex Apps

From the ext-apps examples repository:

| Pattern | Example | MindrianOS Application |
|---------|---------|----------------------|
| Data exploration with drill-down | wiki-explorer-server | Room wiki with article navigation |
| Multi-parameter configuration | budget-allocator-server | Pipeline configuration, mode selection |
| Real-time monitoring | system-monitor-server | Room health dashboard |
| Scenario modeling | scenario-modeler-server | Scenario planning methodology |
| Cohort analysis | cohort-heatmap-server | Cross-section analysis heatmap |
| 3D visualization | threejs-server | Future: 3D knowledge graph |
| Document viewing | pdf-server | Export preview |

---

## 6. Limitations and Risks

### 6.1 What MCP Apps CANNOT Do That CLI Hooks Can

| Capability | CLI Hooks | MCP Apps | Gap Severity |
|-----------|-----------|----------|--------------|
| **SessionStart** - run code when session begins | YES (hooks.json) | NO - apps only activate on tool call | HIGH |
| **PostToolUse** - intercept after every tool | YES (hooks.json) | NO - no hook mechanism | HIGH |
| **File watchers** - chokidar on room/ | YES (scripts) | NO - no filesystem access | MEDIUM |
| **Background processes** - continuous scanning | YES (scripts) | NO - iframe lifecycle tied to conversation | MEDIUM |
| **Shell execution** - run bash scripts | YES (scripts/) | NO - sandboxed iframe | LOW (server-side) |
| **Environment variables** - read .env | YES (process.env) | NO - isolated context | LOW (server-side) |
| **Direct Brain MCP** - query Neo4j | YES (via .mcp.json) | NO - separate MCP server | LOW (proxy tool) |

**The hook gap is the most significant.** MindrianOS's proactive intelligence (session-start room analysis, post-tool cascade detection) depends on hooks. MCP Apps have no equivalent.

**Mitigation strategies:**
1. MCP server itself can run proactive analysis when first tool is called (lazy initialization)
2. A dedicated `room_state` tool can include proactive signals in its response
3. The dashboard app can call `room_state` on mount, getting the same catch-up data
4. Cowork persistent agents can run background tasks without hooks

### 6.2 Can MCP Apps Trigger Other MCP Tools?

**YES.** This is explicitly supported. From the specification:

```javascript
// App calls a tool on its own server
const result = await app.callServerTool({
  name: 'room_state',
  arguments: { command: 'analyze' }
});
```

**Visibility rules:**
- Tools with `visibility: ["model", "app"]` (default) are callable by both the LLM and the app
- Tools with `visibility: ["app"]` are callable ONLY by the app (hidden from LLM)
- Cross-server tool calls are blocked unless the host explicitly allows them

This means a MindrianOS dashboard app can call ALL 64 MindrianOS commands through the 9 router tools. The UI becomes a visual shell for the entire system.

### 6.3 Performance: Knowledge Graph with 200+ Nodes

**Cytoscape.js in an iframe handles this easily.** The current graph.html template already loads Cytoscape via CDN and renders arbitrary node/edge counts. Performance characteristics:

- Cytoscape.js handles 1,000+ nodes smoothly in modern browsers
- The iframe has the same rendering engine as a regular browser tab
- WebGL-accelerated rendering is available if needed (via Cytoscape canvas renderer)
- The ALIGN X Milken room has 30 pages and 295 edges - rendered fine
- Practical limit is likely 5,000-10,000 nodes before layout algorithms slow down

**The bottleneck is data transfer, not rendering.** A graph with 200 nodes and 500 edges serialized as JSON is roughly 50-100KB - trivial for the postMessage channel.

### 6.4 Offline Capability

**NO.** MCP Apps require an active MCP server connection. If the server disconnects:
- The iframe may persist visually but cannot call tools
- No offline-first pattern exists in the spec
- This is identical to the current CLI behavior (no room analysis without Claude running)

**Not a practical issue** because MindrianOS already requires an active AI session to function.

### 6.5 Context Window Survival

**The UI does NOT consume context tokens.** This is a major advantage. MCP App iframes are rendered client-side by the host. The tool result (JSON data) does enter the context, but the HTML rendering is free.

Current token cost comparison:
- CLI room status: ~1,750 tokens of text description
- MCP App: ~200 tokens of JSON summary + zero-token visual rendering

**Context window resets:** When the context compacts, the iframe state MAY be preserved (host-dependent) but tool results are lost from context. The app would need to re-fetch data via `callServerTool`. This is solvable by having the app detect stale state and refresh.

---

## 7. Recommended Architecture

### 7.1 Dual-Delivery Architecture (Recommended)

```
                    MindrianOS Product
                    ==================

    +-----------------+          +------------------+
    | Claude Code     |          | Any MCP Client   |
    | Plugin Layer    |          | (ChatGPT, VS     |
    | (.claude-plugin)|          |  Code, Goose,    |
    |                 |          |  Postman, etc.)   |
    | - hooks.json    |          |                  |
    | - skills/       |          |                  |
    | - commands/     |          |                  |
    | - agents/       |          |                  |
    +---------+-------+          +--------+---------+
              |                           |
              v                           v
    +-------------------------------------------------+
    |         MindrianOS MCP Server                    |
    |         (bin/mindrian-mcp-server.cjs)            |
    |                                                  |
    |  +-------------------------------------------+   |
    |  | Tool Router (11 tools, 64 cmds; test-234) |   |
    |  +-------------------------------------------+   |
    |  | MCP Apps (ui:// resources)                 |   |
    |  |  - Room Command Center                    |   |
    |  |  - Knowledge Explorer                     |   |
    |  |  - Methodology Workbench                  |   |
    |  |  - Meeting Studio                         |   |
    |  |  - Pipeline Monitor                       |   |
    |  |  - Grading Scorecard                      |   |
    |  |  - Opportunity Board                      |   |
    |  +-------------------------------------------+   |
    |  | Resources (room:// read-only browsing)     |   |
    |  +-------------------------------------------+   |
    |  | Prompts (Larry methodology workflows)      |   |
    |  +-------------------------------------------+   |
    |  | lib/core/* (shared business logic)          |   |
    |  +-------------------------------------------+   |
    +-------------------------------------------------+
              |                           |
              v                           v
    +------------------+        +------------------+
    | room/ filesystem |        | Brain MCP        |
    | (user's data)    |        | (brain.mindrian  |
    +------------------+        |  .ai - remote)   |
                                +------------------+
```

### 7.2 MCP App Architecture Per View

Each MCP App follows this pattern:

```
lib/mcp/
  app-views.cjs           -- registration (existing, expand)
  app-html/
    command-center.html    -- Room Command Center (enhanced dashboard)
    knowledge-explorer.html -- Graph + Wiki merged
    methodology-workbench.html -- Visual methodology tools
    meeting-studio.html    -- Meeting filing form
    pipeline-monitor.html  -- Chain/swarm progress
    grading-scorecard.html -- Visual grade with radar chart
    opportunity-board.html -- Grant/opportunity cards

Each HTML file:
  1. Imports App class from ext-apps (bundled or CDN)
  2. Calls app.connect() on load
  3. Receives initial data via app.ontoolresult
  4. Renders De Stijl UI with data
  5. User interactions -> app.callServerTool() -> server processes -> app updates
  6. Optionally: app.updateContext() to inform the LLM of user choices
```

### 7.3 Server-Side Enhancements

```javascript
// Enhanced tool registration with app-visible tools
registerAppTool(server, 'room-command-center', {
  title: 'Room Command Center',
  description: 'Interactive Data Room dashboard with actions',
  schema: z.object({
    room_path: z.string().optional(),
    action: z.enum(['view', 'approve', 'reject', 'defer']).optional(),
    target: z.string().optional()
  }),
  _meta: {
    ui: {
      resourceUri: 'ui://mindrian-os/command-center',
      csp: {
        resourceDomains: ['fonts.googleapis.com', 'fonts.gstatic.com']
      }
    }
  }
}, async (args) => {
  if (args.action === 'approve') {
    // Handle cascade approval
    return handleCascadeAction(args.action, args.target, roomDir);
  }
  const data = scanRoomData(args.room_path || roomDir);
  data._pendingCascades = getPendingCascades(roomDir);
  return { content: [{ type: 'text', text: JSON.stringify(data) }] };
});

// App-only tool (hidden from LLM, only callable by UI)
registerAppTool(server, 'ui-save-preference', {
  title: 'Save UI Preference',
  description: 'Persist user UI preference',
  schema: z.object({ key: z.string(), value: z.string() }),
  _meta: {
    ui: {
      resourceUri: 'ui://mindrian-os/command-center',
      visibility: ['app']  // Hidden from LLM
    }
  }
}, async (args) => {
  // Save to room/.mindrian/ui-prefs.json
  saveUiPreference(roomDir, args.key, args.value);
  return { content: [{ type: 'text', text: 'saved' }] };
});
```

### 7.4 Client-Side Pattern (Inside HTML)

```html
<!-- Recommended pattern for MindrianOS MCP Apps -->
<script type="module">
import { App } from '@modelcontextprotocol/ext-apps';

const app = new App({ name: 'MindrianOS Command Center', version: '1.0.0' });

// 1. Connect to host
app.connect();

// 2. Receive initial tool result
app.ontoolresult = (result) => {
  const data = JSON.parse(result.content.find(c => c.type === 'text').text);
  renderDashboard(data);
  renderPendingCascades(data._pendingCascades);
};

// 3. User clicks "APPROVE" on a cascade suggestion
async function handleApprove(cascadeId) {
  const result = await app.callServerTool({
    name: 'room-command-center',
    arguments: { action: 'approve', target: cascadeId }
  });
  // Refresh dashboard with updated data
  const data = JSON.parse(result.content.find(c => c.type === 'text').text);
  renderDashboard(data);
}

// 4. User clicks "Run Lean Canvas" - send intent to LLM
async function handleRunMethodology(framework) {
  // Update model context so Larry knows user wants to run this
  await app.updateContext({
    type: 'user-intent',
    data: { action: 'run-methodology', framework }
  });
}

// 5. Save UI state for next session
async function saveLayout(layout) {
  await app.callServerTool({
    name: 'ui-save-preference',
    arguments: { key: 'dashboard-layout', value: JSON.stringify(layout) }
  });
}
</script>
```

---

## 8. Migration Path

### Phase 0: Foundation (1 week) - IMMEDIATE

**Enhance existing 3 MCP Apps with bidirectional communication:**

1. Add `App` class import to dashboard.html, wiki.html, graph.html
2. Replace manual postMessage with `app.connect()` + `app.ontoolresult`
3. Add "Refresh" button that calls `app.callServerTool({ name: 'room-dashboard' })`
4. Add CSP declarations for Google Fonts CDN
5. Test on Claude Desktop, Claude web, and basic-host

**Result:** Existing apps become truly interactive instead of read-only snapshots.

### Phase 1: Command Center (2 weeks)

**Build the Room Command Center - the flagship MCP App:**

1. Merge dashboard + status into single "Command Center" app
2. Add APPROVE/REJECT/DEFER buttons for cascade suggestions
3. Add mode selection widget (Explorer/Builder/Critic)
4. Add "Suggested Next" panel calling `room_state suggest-next`
5. Add section health indicators with click-to-drill-down

**Result:** Users manage their room visually on ANY MCP client.

### Phase 2: Visual Methodologies (2 weeks)

**Turn key methodology tools into visual apps:**

1. Lean Canvas - 9-box visual grid, each box editable
2. Six Thinking Hats - colored hat carousel with perspective panels
3. Grading Scorecard - radar chart + letter grade + component breakdown
4. Pipeline Monitor - visual step tracker for chains/swarms

**Result:** Core methodology experience becomes visual.

### Phase 3: Knowledge Explorer (1 week)

**Merge graph + wiki into unified explorer:**

1. Split-pane: graph on left, article content on right
2. Click node in graph -> article loads in right pane
3. Search bar that filters both graph and wiki
4. Thread type filter (INFORMS, CONTRADICTS, CONVERGES)

**Result:** Users explore their knowledge graph conversationally.

### Phase 4: Meeting Studio + Opportunity Board (2 weeks)

**Build input-focused apps:**

1. Meeting filing form with text area, date picker, speaker tagging
2. Opportunity Board with grant cards, deadline badges, status filters
3. Both call respective MCP tools for data and actions

**Result:** Key input workflows become visual.

### Phase 5: Platform Distribution (1 week)

**Package for multi-platform distribution:**

1. Publish as npm package: `npx mindrian-os --stdio`
2. Create .mcpb Desktop Extension for Claude Desktop
3. Create ChatGPT custom connector configuration
4. Create VS Code MCP configuration
5. List on MCPHub and MCP Market

**Result:** MindrianOS available on every MCP platform.

### Total Timeline: 8-9 weeks for full MCP-native experience

---

## 9. Risk Assessment

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| **MCP Apps spec changes** | MEDIUM | LOW | Building on official ext-apps SDK (already a dependency). Spec is stable since 2026-01-26. Community adoption (4.6K stars) provides stability pressure. |
| **Host rendering inconsistencies** | MEDIUM | MEDIUM | Known issue with ChatGPT (ontoolresult not re-firing on revisit). Test on all target hosts. Keep UI stateless where possible, re-fetch on mount. |
| **Loss of hook proactivity** | HIGH | CERTAIN | MCP Apps cannot replace SessionStart/PostToolUse hooks. Mitigation: lazy initialization in first tool call, server-side catch-up computation, keep Claude Code plugin as power-user tier. |
| **De Stijl branding in different hosts** | LOW | LOW | Hardcoded CSS tokens work in any iframe. Host theming is optional - De Stijl IS the brand, don't adapt to host theme. |
| **Bundle size for complex apps** | LOW | LOW | Current templates are 300-400 lines. Even with Cytoscape.js bundled (~800KB), well within practical limits. CDN loading with CSP is the recommended pattern. |
| **Context token overhead** | LOW | LOW | MCP Apps actually REDUCE token usage. UI rendering is client-side (zero tokens). Tool results are compact JSON. Net savings vs text-heavy CLI output. |
| **Competitor copying UI** | LOW | LOW | UI is the visible layer. The moat is Brain (21K nodes), teaching calibration, methodology chaining intelligence. UI can be copied; intelligence graph cannot. |
| **ChatGPT/VS Code stop supporting MCP Apps** | MEDIUM | VERY LOW | OpenAI invested heavily in Apps SDK + MCP compatibility. Microsoft invested in VS Code MCP. Too much momentum to reverse. |
| **User confusion (two distribution modes)** | MEDIUM | MEDIUM | Clear messaging: "Claude Code Plugin = full power with Larry as copilot. MCP Server = visual experience on any platform." Both share same Brain, same room, same tools. |
| **Development effort diverts from Brain/methodology** | HIGH | MEDIUM | Phase 0-1 (3 weeks) delivers most value. Don't build all 7+ apps before validating. Ship Command Center first, measure adoption. |

---

## 10. RECOMMENDATION

### Verdict: YES - Rebuild MindrianOS as MCP-Native with Dual Distribution

**The evidence is overwhelming:**

1. **Platform independence is real.** MCP Apps work on Claude, ChatGPT, VS Code, Goose, and Postman today. One codebase, every AI platform. This eliminates the single biggest business risk (Claude Code dependency).

2. **MindrianOS is already 60% there.** The MCP server exists. Three MCP Apps exist. The tool router covers all 64 commands. The gap is upgrading existing apps from read-only to interactive, and building 4-5 more apps.

3. **The moat is preserved.** MCP Apps are the presentation layer. The moat is Brain intelligence, methodology chaining, grading calibration, and teaching intelligence. Moving to MCP Apps doesn't leak IP - it makes the IP accessible to more users.

4. **Token economics improve.** MCP Apps render client-side at zero token cost. This is strictly better than CLI text output that consumes context.

5. **The market is forming NOW.** MCPHub, MCP Market, and OpenAI's Apps SDK are creating distribution channels. Early mover advantage is available for the next 6-12 months.

### The Dual-Distribution Model

```
Tier 1: MindrianOS MCP Server (MCP-native)
  - Works on ANY MCP client
  - Visual experience via MCP Apps
  - 11 tool routers, ~64 commands (see tests/test-234-tool-description-floor.cjs)
  - Brain enrichment via remote MCP
  - Distribution: npm, MCPHub, MCP Market, .mcpb

Tier 2: MindrianOS Claude Code Plugin (power tier)
  - Everything in Tier 1, PLUS:
  - SessionStart hooks (proactive intelligence)
  - PostToolUse hooks (cascade detection)
  - Skills (auto-loaded Larry personality)
  - Commands (slash command discovery)
  - Agents (sub-agent orchestration)
  - Distribution: Claude marketplace
```

**Tier 1 is the product. Tier 2 is the premium experience for Claude users.**

### Immediate Next Steps

1. **Phase 0 NOW** (1 week): Upgrade existing 3 apps with `App` class, bidirectional tool calls, CSP. Prove the pattern works on Claude Desktop + basic-host.

2. **Phase 1 NEXT** (2 weeks): Build Room Command Center. This is the hero app that demonstrates the full vision.

3. **Test on ChatGPT** (1 day): After Phase 1, connect the MCP server to ChatGPT via cloudflared tunnel. Verify the same dashboard renders. Screenshot it. This is the proof that platform independence works.

4. **Defer Phases 2-5** until Phase 1 is validated with real users.

### What NOT to Do

- Do NOT rewrite the CLI plugin layer. It works. Keep it as Tier 2.
- Do NOT build a standalone web app (Next.js, Vercel). MCP Apps eliminate the need for a separate web deployment.
- Do NOT try to replicate hooks in MCP Apps. Accept the limitation, work around it with lazy initialization.
- Do NOT use React for MCP Apps yet. Vanilla JS + bundled HTML is simpler, smaller, and already proven in the existing templates. Add React only when component complexity justifies it.
- Do NOT chase every MCP client. Focus on Claude + ChatGPT. Those two cover 90%+ of the market.

---

## Sources

- [MCP Apps Overview](https://modelcontextprotocol.io/extensions/apps/overview) - Official MCP documentation
- [MCP Apps Build Guide](https://modelcontextprotocol.io/extensions/apps/build) - Official build documentation
- [MCP Apps Blog Announcement](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) - January 2026 launch
- [ext-apps GitHub Repository](https://github.com/modelcontextprotocol/ext-apps/) - SDK source and examples
- [ext-apps Specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) - Full technical spec
- [ext-apps API Documentation](https://modelcontextprotocol.github.io/ext-apps/api/documents/Overview.html) - TypeDoc API reference
- [@modelcontextprotocol/ext-apps on npm](https://www.npmjs.com/package/@modelcontextprotocol/ext-apps) - SDK package
- [MCP-UI Organization](https://github.com/MCP-UI-Org/mcp-ui) - Community framework (4.6K stars)
- [MCP-UI Documentation](https://mcpui.dev/) - Community SDK docs
- [ChatGPT MCP Apps Compatibility](https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt) - OpenAI's MCP Apps support
- [OpenAI Apps SDK](https://developers.openai.com/apps-sdk/quickstart) - ChatGPT app development
- [Shopify MCP UI: Breaking the Text Wall](https://shopify.engineering/mcp-ui-breaking-the-text-wall) - Intent-based UI pattern
- [MCP Apps: WorkOS Analysis](https://workos.com/blog/2026-01-27-mcp-apps) - Industry analysis
- [MCPHub Marketplace](https://blog.getmcpapps.com/what-are-mcp-apps-a-complete-guide-for-developers-in-2026) - MCP Apps marketplace
- [Goose: MCP-UI to MCP Apps](https://block.github.io/goose/blog/2026/01/22/mcp-ui-to-mcp-apps/) - Migration perspective
- [MCP Apps State Persistence Issue](https://github.com/openai/openai-apps-sdk-examples/issues/195) - ChatGPT ontoolresult limitation
- RESEARCH_17_MCP_UI_FRAMEWORKS.md - Prior MindrianOS research
- generative-ui-deep-research.md - Prior generative UI research
