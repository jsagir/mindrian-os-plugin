# Architecture Patterns: v1.8.0 Cowork Adaptation

**Domain:** Multi-surface MCP plugin with persistent intelligence
**Researched:** 2026-04-05

## Recommended Architecture

### Dual-Transport MCP Server

The single `McpServer` instance serves both surfaces through transport detection:

```
                    +-----------------------+
                    |     McpServer         |
                    |  (mindrian-os v1.8)   |
                    |                       |
                    |  - 64 tools           |
                    |  - resources           |
                    |  - prompts            |
                    |  - tasks capability   |
                    +-----------+-----------+
                                |
                    +-----------+-----------+
                    |                       |
            +-------+-------+     +--------+--------+
            | StdioTransport|     | StreamableHTTP   |
            | (Desktop/CLI) |     | (Cowork)         |
            +---------------+     +---------+--------+
                                            |
                                  +---------+--------+
                                  | createMcpExpress |
                                  | App() wrapper    |
                                  | port 3847        |
                                  | 127.0.0.1 only   |
                                  +------------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `bin/mindrian-mcp-server.cjs` | Entry point, transport selection, server lifecycle | McpServer, transports |
| `lib/mcp/tool-router.cjs` | Hierarchical tool registration (64 commands) | McpServer, lib/core/* |
| `lib/mcp/resources.cjs` | Resource registration + subscription handler | McpServer, chokidar, room filesystem |
| `lib/mcp/apps.cjs` (NEW) | MCP Apps registration (dashboard, wiki, graph views) | McpServer, ext-apps SDK, room filesystem |
| `lib/mcp/tasks.cjs` (NEW) | Task lifecycle management for async operations | McpServer, lib/core/* |
| `lib/mcp/brain-router.cjs` (NEW) | Brain MCP consultation for methodology routing | Brain MCP (remote), tool-router |
| `lib/core/*.cjs` | Shared business logic (CLI + MCP) | Room filesystem, scripts/ |
| `scripts/*.sh` | Bash analysis scripts (20 existing) | Room filesystem, Neo4j, Pinecone |
| Brain MCP (remote) | Teaching graph intelligence | brain.mindrian.ai (Streamable HTTP) |

### Data Flow

**Tool Call Flow (with Brain routing):**
```
Cowork Client -> POST /mcp -> createMcpExpressApp
  -> NodeStreamableHTTPServerTransport
  -> McpServer.tool() handler
  -> brain-router.cjs: "What methodology chain for this context?"
  -> Brain MCP response: ["root-cause", "causal-tracing", "prediction"]
  -> tool-router.cjs: execute chain sequentially
  -> lib/core/root-cause.cjs -> lib/core/causal.cjs -> lib/core/predict.cjs
  -> Results filed to room/
  -> notifications/resources/updated emitted
  -> Response returned via SSE or JSON
```

**Resource Subscription Flow:**
```
Client -> resources/subscribe { uri: "room://state" }
  -> resources.cjs stores subscription
  -> chokidar watches room/STATE.md
  -> File changes detected
  -> notifications/resources/updated { uri: "room://state" }
  -> Client re-reads resource
```

**MCP Apps View Flow:**
```
Client -> tools/call { name: "room-dashboard" }
  -> apps.cjs generates room state JSON
  -> Returns { content: [...], _meta: { ui: { resourceUri: "ui://dashboard/..." } } }
  -> Client reads ui://dashboard/dashboard.html resource
  -> Sandboxed iframe renders De Stijl dashboard
  -> User interacts with dashboard
  -> PostMessageTransport sends events to host
  -> Host may invoke additional tools based on user action
```

**MCP Tasks Flow (async analysis):**
```
Client -> tools/call { name: "deep-analysis", params: { task: { ttl: 120000 } } }
  -> tasks.cjs creates task, returns CreateTaskResult { taskId, status: "working" }
  -> Background: lib/core/analyze.cjs runs expensive analysis
  -> Client polls: tasks/get { taskId }
  -> Analysis completes
  -> Client: tasks/result { taskId } -> Returns analysis results
```

## Patterns to Follow

### Pattern 1: Transport-Agnostic Tool Registration
**What:** Register tools once, serve over any transport.
**When:** Always. Every tool must work on both stdio and HTTP.
**Example:**
```javascript
// lib/mcp/tool-router.cjs - tools registered once
function registerRouterTools(server, roomDir, pluginRoot) {
  server.tool('analyze-room', schema, async (params) => {
    // Same handler serves both transports
    const result = await analyzeRoom(roomDir);
    return { content: [{ type: 'text', text: result }] };
  });
}

// bin/mindrian-mcp-server.cjs - transport selected at startup
if (process.env.MINDRIAN_TRANSPORT === 'http') {
  // Streamable HTTP for Cowork
} else {
  // stdio for Desktop/CLI
}
```

### Pattern 2: Brain Consultation at Router Layer
**What:** Router consults Brain before dispatching, not at tool level.
**When:** For methodology-selecting tools (act, pipeline, analyze).
**Example:**
```javascript
// lib/mcp/brain-router.cjs
async function consultBrain(roomContext, userIntent) {
  const response = await fetch('https://brain.mindrian.ai/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'recommend-framework-chain',
        arguments: { context: roomContext, intent: userIntent }
      }
    })
  });
  return response.json(); // Returns ordered methodology chain
}
```

### Pattern 3: Persistent Hat State as Filesystem
**What:** Each De Bono hat maintains state as markdown in `room/perspectives/`.
**When:** For all persistent agent state.
**Example:**
```
room/perspectives/
  black-hat/
    STATE.md          # Current concerns, risk register
    history/          # Previous session findings
  yellow-hat/
    STATE.md          # Current opportunities, HSI connections
    history/
  blue-hat/
    STATE.md          # Current process meta-analysis
    history/
```

### Pattern 4: MCP Apps as View Layer
**What:** Dashboard/wiki/graph HTML served as MCP App resources, not generated files.
**When:** For Cowork interactive views.
**Example:**
```javascript
// lib/mcp/apps.cjs
const { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } = require('@modelcontextprotocol/ext-apps/server');

function registerApps(server, roomDir) {
  registerAppTool(server, 'room-dashboard', {
    title: 'Data Room Dashboard',
    description: 'Interactive De Stijl dashboard',
    inputSchema: {},
    _meta: { ui: { resourceUri: 'ui://mindrian/dashboard.html' } }
  }, async () => {
    const state = await loadRoomState(roomDir);
    return { content: [{ type: 'text', text: JSON.stringify(state) }] };
  });

  registerAppResource(server, 'ui://mindrian/dashboard.html', 'ui://mindrian/dashboard.html',
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [{ uri: 'ui://mindrian/dashboard.html', mimeType: RESOURCE_MIME_TYPE, text: buildDashboardHtml(roomDir) }]
    })
  );
}
```

### Pattern 5: Task-Augmented Long Operations
**What:** Expensive tools (deep-analysis, full-scout, HSI-compute) return task handles.
**When:** Operation takes >5 seconds.
**Example:**
```javascript
server.tool('deep-analysis', schema, async (params) => {
  if (params.task) {
    // Async mode: return task handle, process in background
    const taskId = startBackgroundAnalysis(roomDir, params);
    return {
      task: {
        taskId,
        status: 'working',
        statusMessage: 'Analyzing room across all sections...',
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        ttl: params.task.ttl || 120000,
        pollInterval: 5000
      }
    };
  }
  // Sync mode: block until done
  return await runAnalysis(roomDir, params);
});
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Surface-Specific Tool Code
**What:** Writing different tool implementations for CLI vs Desktop vs Cowork.
**Why bad:** Breaks "same lib/core/* shared" principle. Feature parity becomes impossible.
**Instead:** One implementation in lib/core/*.cjs, thin transport-agnostic wrappers.

### Anti-Pattern 2: Stateful Server for Session Data
**What:** Storing session state in memory on the MCP server.
**Why bad:** Cowork may restart the server. Memory state is lost.
**Instead:** All state in room/ filesystem. Session ID maps to room path.

### Anti-Pattern 3: Polling Room Files for Changes
**What:** Timer-based polling to detect room file changes.
**Why bad:** Wasteful, laggy, doesn't scale.
**Instead:** chokidar file watching + MCP resource subscription notifications.

### Anti-Pattern 4: Blocking Tools for Expensive Operations
**What:** Making Cowork wait 30+ seconds for HSI computation or deep analysis.
**Why bad:** Blocks the conversation. User can't do anything else.
**Instead:** MCP Tasks -- return task handle, let user continue, poll for results.

### Anti-Pattern 5: React Build Pipeline for MCP Apps
**What:** Using React + bundler for MCP App HTML views.
**Why bad:** Adds build step, breaks "every output is an edit surface" principle.
**Instead:** Vanilla HTML/CSS/JS with Cytoscape.js (CDN). Self-contained .html files.

## Scalability Considerations

| Concern | Single User (Desktop) | Multi-Session (Cowork) | Team (Future v2.0) |
|---------|----------------------|----------------------|-------------------|
| Transport | stdio (1:1) | Streamable HTTP (1:N sessions) | Streamable HTTP + auth |
| Session isolation | Not needed | MCP-Session-Id per connection | Per-user session + shared room |
| File watching | Single watcher | Single watcher, broadcast to subscribed sessions | Distributed file events |
| Task management | In-memory map | In-memory map per session | Persistent task store |
| Brain calls | Direct fetch | Rate-limited fetch pool | Cached Brain responses |

## Sources

- [MCP TypeScript SDK server docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) - dual transport, createMcpExpressApp
- [MCP Transports spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) - Streamable HTTP, session management
- [MCP Tasks spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks) - task state machine, polling
- [MCP Apps Quickstart](https://apps.extensions.modelcontextprotocol.io/api/documents/Quickstart.html) - registerAppTool, registerAppResource
- [MCP Resources spec](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) - subscriptions, notifications
