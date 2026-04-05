# Research 19: MCP Persistent Agents & Shared Intelligence Architecture

**Researched:** 2026-04-03
**Domain:** MCP server architecture, persistent agents, multi-agent systems, concurrent database access
**Overall Confidence:** MEDIUM-HIGH (official MCP spec verified, Claude Code features verified via multiple sources)

---

## 1. MCP Server Architecture for Teams

### Transport Selection: Stdio vs Streamable HTTP

**Recommendation: Streamable HTTP for any shared/team environment. Stdio for local-only single-user tools.**

| Transport | Use Case | Multi-User | Notifications | Authentication |
|-----------|----------|------------|---------------|----------------|
| **Stdio** | Local dev tools, CLI integrations | NO - one client per subprocess | Limited to request-response cycle | None needed (same machine) |
| **Streamable HTTP** | Team servers, remote agents, shared services | YES - multiple concurrent clients | Full SSE streaming + push notifications | OAuth, API keys, session management |

**Stdio** launches the MCP server as a subprocess of the client. The server reads JSON-RPC from stdin and writes to stdout. Zero infrastructure overhead, but fundamentally single-client. There is no way for multiple users to share a stdio-based MCP server.

**Streamable HTTP** (introduced March 2025, replaced the older SSE-only transport) operates as an independent process handling multiple client connections. It exposes a single HTTP endpoint (e.g., `https://host/mcp`) accepting both POST and GET requests. The server can respond with either a standard HTTP JSON response or upgrade to an SSE stream for streaming results, progress updates, and server-initiated notifications.

**Key Streamable HTTP capabilities for MindrianOS:**

- **Session management** via `MCP-Session-Id` header - server assigns session ID at initialization, client includes it on all subsequent requests
- **Resumable connections** - SSE events can carry IDs; on disconnect, client reconnects with `Last-Event-ID` header to resume without message loss
- **Server-initiated messages** - client can open a GET-based SSE stream to receive server-initiated requests and notifications without first sending a POST
- **Multiple simultaneous SSE streams** - client may connect to multiple streams; server must not broadcast the same message across streams

**Security requirements (from spec):**

1. Servers MUST validate the `Origin` header on all incoming connections (DNS rebinding protection)
2. Local servers SHOULD bind only to localhost (127.0.0.1)
3. Servers SHOULD implement proper authentication

**Confidence:** HIGH - verified from MCP specification 2025-11-25 directly.

### Authentication Patterns

The MCP spec itself does not mandate a specific auth mechanism but requires servers to implement "proper authentication." The emerging patterns in 2026:

- **OAuth 2.0** for multi-tenant SaaS-style MCP servers (the 2025-11-25 spec includes improved OAuth support)
- **API keys** for internal team servers behind a firewall
- **mTLS** for high-security environments
- **Session tokens** via the MCP-Session-Id mechanism for stateful sessions

**Confidence:** MEDIUM - OAuth is spec-referenced; other patterns are community convention.

---

## 2. Persistent Agent Patterns

### The State of Always-On AI Agents (April 2026)

There is no single "persistent agent" primitive in MCP. Instead, persistence is achieved by combining several mechanisms:

#### Pattern A: Claude Code /loop + Scheduled Tasks

Claude Code (March 2026) introduced `/loop` for recurring prompts:

```
/loop 5m "Check for new artifacts in .artifacts/ and summarize changes"
```

**Limitations:**
- Session-scoped: dies when terminal closes
- 3-day maximum lifetime (safety feature)
- Only fires while Claude Code is running and idle
- Seconds rounded to nearest minute (cron granularity)

For durable scheduling that survives restarts, use **Claude Desktop scheduled tasks** or **GitHub Actions**. Desktop tasks persist as long as the app runs in background.

#### Pattern B: Claude Cowork Dispatch

Launched March 17, 2026 - Dispatch is a persistent agent inside Claude Cowork that:
- Stays active on your computer
- Maintains context between sessions
- Continues working when you are not at the screen
- Controlled remotely via QR code (phone/tablet)
- Executes in a local sandbox (files never leave your machine)
- 38+ connectors (Notion, Gmail, Slack, Drive, Calendar)

Available on Max ($100/month) and Pro ($20/month) plans. This is currently the closest thing to an always-on AI agent from Anthropic.

#### Pattern C: MCP Async Tasks (2025-11-25 spec)

The Tasks primitive enables call-now, fetch-later patterns:

1. Client sends a task-augmented request
2. Server returns immediately with a durable handle (task ID)
3. Client polls `tasks/result` or subscribes for completion
4. Server runs the work in background, possibly including its own agent loop

Tasks are durable state machines with states: `pending`, `running`, `completed`, `failed`, `cancelled`. They can be polled by any client that has the task ID.

**This is the foundation for persistent MCP agents** - a server can accept a "watch this directory" task, run it as a long-lived background process, and let clients poll for results.

#### Pattern D: Custom Daemon + MCP Server

For MindrianOS, the most robust pattern:

```
[File System Watcher Daemon]
        |
        v
[MCP Server (Streamable HTTP)]
        |
        v
[Claude Code / Cowork / Any MCP Client]
```

The daemon process:
1. Watches the filesystem (chokidar/inotify)
2. Detects changes to room artifacts
3. Updates an internal event queue
4. Exposes events via MCP resources + notifications
5. Provides tools for querying change history

**Confidence:** HIGH for spec features, MEDIUM for Dispatch details (third-party reporting).

---

## 3. File Watching & Event-Driven MCP

### MCP Resource Subscriptions (Spec-Level Support)

The MCP spec (2025-11-25) provides two notification mechanisms for resources:

**1. List Change Notification:**
Server declares `listChanged` capability. When resources are added/removed:
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/list_changed"
}
```

**2. Individual Resource Subscriptions:**
Client subscribes to a specific resource URI:
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "resources/subscribe",
  "params": { "uri": "file:///project/src/main.rs" }
}
```

Server sends update notification when the resource changes:
```json
{
  "jsonrpc": "2.0",
  "method": "notifications/resources/updated",
  "params": { "uri": "file:///project/src/main.rs" }
}
```

**Critical design insight:** MCP uses a modified pub-sub pattern. The server sends a lightweight "something changed" notification; the CLIENT then decides whether to fetch updated content via `resources/read`. This decouples notification from data transfer.

### File Watching Implementation

The standard `@modelcontextprotocol/server-filesystem` is purely request-response with NO file watching. For event-driven behavior, you must implement your own.

**Recommended stack for MindrianOS file watcher:**

| Component | Technology | Why |
|-----------|-----------|-----|
| File watcher | `chokidar` v4+ | Cross-platform (FSEvents on Mac, inotify on Linux, FileSystemWatcher on Windows), efficient recursive watching |
| Event queue | In-memory ring buffer or SQLite | Buffer events between detection and client consumption |
| MCP notifications | Resource subscriptions | Spec-compliant push to clients |

**Implementation pattern:**

```typescript
// Pseudo-code for a watching MCP server
const watcher = chokidar.watch('/rooms/**/*', {
  awaitWriteFinish: { stabilityThreshold: 500 },
  ignored: /(^|[\/\\])\../ // ignore dotfiles
});

watcher.on('change', (path) => {
  // 1. Record event in queue
  eventQueue.push({ type: 'modified', path, timestamp: Date.now() });
  
  // 2. Notify subscribed MCP clients
  for (const sub of subscriptions.get(pathToUri(path))) {
    sub.notify('notifications/resources/updated', { uri: pathToUri(path) });
  }
  
  // 3. If list changed (new/deleted files), notify list watchers
  if (isNewOrDeleted(path)) {
    broadcastNotification('notifications/resources/list_changed');
  }
});
```

**Resource management:** Watch directories, not individual files. One chokidar instance per room root, not per file. Use `awaitWriteFinish` to debounce rapid writes.

**Confidence:** HIGH for MCP spec mechanisms, MEDIUM for chokidar integration patterns.

---

## 4. Persistent Personas (De Bono Hats)

### State of the Art for Multi-Persona Systems

Research reveals three tiers of persona persistence:

**Tier 1: Prompt-Based (Stateless)**
Load persona instructions at session start. No memory across sessions. This is what most "De Bono Six Hats" implementations do - each hat is a system prompt variation.

**Tier 2: Session Handoff Document (Semi-Persistent)**
A rolling handoff document carries context between conversations, replacing itself each time rather than accumulating. This addresses stale context without unbounded growth. 

**Tier 3: Identity Architecture (Truly Persistent)**
The most sophisticated approach uses structured behavioral specifications with:
- 29+ behavioral rules across 4 priority tiers
- Explicit conflict resolution hierarchies
- Persistent memory store (graph DB or vector store)
- Session-to-session state via structured handoff docs

**Key finding:** Research shows persistent personas maintain consistent voice and analytical approach across months of sessions, while base models without the architecture show measurable drift within a single extended conversation.

### Recommended Pattern for MindrianOS De Bono Personas

```
Each persona = {
  system_prompt: "identity.md",        // Static personality + reasoning style
  behavioral_rules: "rules.yaml",      // Priority-tiered behavioral constraints  
  memory: KuzuDB subgraph,             // Per-persona knowledge graph partition
  handoff: "HANDOFF.md",               // Rolling session state document
  reasoning_log: "REASONING.md"        // Minto/MECE structured output
}
```

Store persona state in the room's graph. Each persona gets a node with edges to its observations, reasoning artifacts, and interaction history. On session start, load the persona's subgraph + handoff document as context.

**Confidence:** MEDIUM - patterns are community-derived, no single authoritative standard exists.

---

## 5. Concurrent Database Access

### KuzuDB Concurrency Model

**Critical constraint: KuzuDB is single-writer, same-process only for read-write.**

| Scenario | Supported | Notes |
|----------|-----------|-------|
| Single process, multiple connections | YES | Transaction manager handles this |
| Multiple processes, all READ_ONLY | YES | Safe concurrent reads |
| Multiple processes, one READ_WRITE | NO | File lock prevents it |
| Multiple processes, mixed | NO | Buffer cache becomes stale across processes |

KuzuDB uses file-level locking. Attempting to open a locked database throws: `RuntimeError: IO exception: Could not set lock on file.`

**Production pattern (from KuzuDB docs):** One API server process embeds the READ_WRITE Database; all other consumers communicate via HTTP/gRPC, never direct database access.

**Vela Partners fork:** A community fork (`Vela-Engineering/kuzu`) adds concurrent multi-writer support specifically for multi-agent architectures. Worth monitoring but not production-stable.

### SQLite WAL Mode Concurrency

| Scenario | Supported | Notes |
|----------|-----------|-------|
| Multiple readers + single writer (same host) | YES | WAL mode enables this |
| Multiple concurrent writers | NO | Writes serialized (one at a time) |
| Network filesystem (NFS, CIFS) | NO | WAL requires shared memory on same host |
| Cross-host access | NO | wal-index uses shared memory |

SQLite WAL mode: unlimited concurrent readers, single writer at any moment. Readers never block writers and vice versa. But ALL processes must be on the same host machine (shared memory requirement for wal-index).

### Recommended Serialization Strategy for MindrianOS

**Architecture: Single-writer gateway process.**

```
[MCP Server Process] <-- sole READ_WRITE connection to KuzuDB/SQLite
       ^
       |  (HTTP/tool calls)
       |
[Claude Code]  [Cowork Dispatch]  [Other MCP Clients]
```

The MCP server is the ONLY process that opens the database in write mode. All writes go through MCP tool calls. Multiple MCP clients can connect simultaneously (via Streamable HTTP), but the server serializes writes internally.

For read-heavy workloads, consider a read replica pattern:
1. MCP server writes to primary DB
2. Periodic snapshots for read-only copies
3. Read-only MCP resources serve from snapshots

**Confidence:** HIGH - verified from official KuzuDB and SQLite documentation.

---

## 6. Agent-to-Agent Communication

### MCP vs A2A: Complementary Protocols

Two protocols now under the Linux Foundation's Agentic AI Foundation (AAIF):

| Protocol | Purpose | Maturity | Ecosystem |
|----------|---------|----------|-----------|
| **MCP** | Agent-to-tool (vertical) | Mature, 5000+ servers | Anthropic, widely adopted |
| **A2A** | Agent-to-agent (horizontal) | Growing, Google-originated | Google, multi-vendor |

**MCP** is for connecting agents to tools and data sources. It does NOT define agent-to-agent communication natively.

**A2A** (Agent-to-Agent, Google, April 2025) standardizes how agents discover, communicate, and collaborate regardless of framework. Donated to Linux Foundation June 2025.

### Practical Agent Communication Patterns for MindrianOS

**Pattern 1: Shared filesystem (simplest, recommended first)**
Agents communicate by reading/writing files in a shared directory structure. The file watcher MCP server detects changes and notifies interested agents.

```
Room Directory:
  .artifacts/        # Agents write outputs here
  .handoff/          # Inter-agent messages
  .state/            # Shared state files
  REASONING.md       # Shared reasoning document
```

**Pattern 2: MCP tool calls via orchestrator**
An orchestrator agent calls tools that internally route to other agents:

```
Orchestrator --> tool: "ask_red_hat" --> Red Hat persona agent
Orchestrator --> tool: "ask_black_hat" --> Black Hat persona agent
```

Each persona is an MCP tool that loads the persona's context and generates a response. Not truly concurrent, but sequential delegation works well for De Bono-style structured thinking.

**Pattern 3: Shared MCP server as event bus**
All agents connect to the same MCP server. The server provides:
- Tools for publishing events: `publish_event(topic, payload)`
- Resources for reading events: `events://{topic}/latest`
- Subscriptions for real-time notification

This is the most scalable pattern but requires more infrastructure.

**Recommendation for MindrianOS:** Start with Pattern 1 (shared filesystem) + Pattern 2 (orchestrator delegation). The filesystem is already the natural coordination surface for MindrianOS rooms. Only move to Pattern 3 if you need real-time multi-agent coordination beyond what file watching provides.

**Confidence:** MEDIUM - patterns are community-derived, A2A is still maturing.

---

## 7. Claude Code Remote Control

### What It Is

`claude --remote-control` (or `--rc`, or shorter: `claude remote-control`) is a February 2026 research preview feature that bridges a local Claude Code terminal session with:
- claude.ai/code (web interface)
- Claude iOS app
- Claude Android app

### How It Works

- Start a Claude Code session with `--remote-control` flag
- Get a QR code or URL
- Connect from any device
- One persistent conversation thread connects both devices
- Execution happens locally on your machine
- You can type locally AND remotely simultaneously

### Limitations

- 10-minute network timeout - session exits if machine cannot reach network
- Must restart `claude remote-control` after timeout
- Research preview - may change

### Relationship to Cowork Dispatch

Remote Control and Dispatch launched together but serve different purposes:
- **Remote Control:** Access your existing terminal session from phone/web
- **Dispatch:** Persistent background agent that works while you are away

Both signal Anthropic's push toward persistent, always-available AI development companions.

### Relevance to MindrianOS

Remote Control is NOT a deployment mechanism for persistent agents. It is a convenience feature for human operators. For persistent agent deployment, use:
1. A long-running MCP server process (Streamable HTTP)
2. Claude Desktop scheduled tasks for durable recurring work
3. Cowork Dispatch for interactive persistent agents

**Confidence:** MEDIUM - feature is research preview, third-party reporting confirms behavior.

---

## 8. Implementation Recommendations for MindrianOS

### Architecture: Room Intelligence Server

Build a single MCP server (Streamable HTTP) per room that serves as the intelligence gateway:

```
                    [Claude Code]   [Cowork]   [CLI]
                         |             |         |
                         v             v         v
                  [Room MCP Server - Streamable HTTP]
                  |          |           |          |
                  v          v           v          v
            [KuzuDB]   [File Watcher]  [Brain]   [Personas]
            (single     (chokidar)    (vector    (state in
             writer)                   search)    graph)
```

### Component Breakdown

| Component | Technology | Purpose |
|-----------|-----------|---------|
| MCP Server | `@modelcontextprotocol/sdk` + Express/Hono | Streamable HTTP endpoint |
| File Watcher | chokidar v4 | Detect room artifact changes |
| Database | KuzuDB (graph) + SQLite (metadata) | Room knowledge graph + state |
| Event Queue | SQLite WAL table | Buffer events, survive restarts |
| Persona Engine | Prompt templates + graph subgraphs | De Bono hat state |
| Notifications | MCP resource subscriptions | Push changes to clients |

### Capabilities to Declare

```json
{
  "capabilities": {
    "resources": {
      "subscribe": true,
      "listChanged": true
    },
    "tools": {},
    "prompts": {}
  }
}
```

### Key Tools to Expose

| Tool | Purpose |
|------|---------|
| `file_artifact` | Write/read room artifacts (serialized through server) |
| `query_graph` | Cypher queries against room KuzuDB |
| `ask_persona` | Query a De Bono persona with room context |
| `get_changes_since` | Retrieve file change events since timestamp |
| `publish_insight` | File a new insight into the room's knowledge graph |
| `get_room_state` | Current room status, active personas, recent activity |

### Key Resources to Expose

| Resource URI | Purpose |
|-------------|---------|
| `room://state` | Current room state (subscribable) |
| `room://graph/summary` | Knowledge graph summary |
| `room://artifacts/{path}` | Individual artifact access |
| `room://events/latest` | Recent change events |
| `room://personas/{hat}/handoff` | Persona handoff documents |

### Deployment Model

1. **Development:** stdio transport for single-user testing
2. **Local team:** Streamable HTTP on localhost:PORT, one server per room
3. **Production:** Streamable HTTP behind reverse proxy, OAuth authentication

### Phase Recommendations

**Phase 1:** File watcher MCP server with resource subscriptions (proves the pattern)
**Phase 2:** KuzuDB integration with serialized write access via tools
**Phase 3:** Persona engine with graph-backed state
**Phase 4:** Multi-room orchestration with shared event bus

---

## 9. Open Questions & Gaps

| Question | Status | Notes |
|----------|--------|-------|
| Does Claude Code support Streamable HTTP MCP servers natively? | NEEDS VERIFICATION | Most docs show stdio; Streamable HTTP may require proxy |
| Can Cowork Dispatch connect to custom MCP servers? | NEEDS VERIFICATION | Dispatch has 38+ connectors but custom MCP not confirmed |
| MCP Tasks - are they stable in the TypeScript SDK? | NEEDS VERIFICATION | Spec is 2025-11-25 but SDK adoption varies |
| A2A protocol maturity for multi-agent rooms | LOW CONFIDENCE | A2A is still growing; MCP shared-infra pattern may suffice |
| Vela KuzuDB fork stability | LOW CONFIDENCE | Interesting for multi-writer but unproven |
| Claude Code Channels feature | NEEDS RESEARCH | Referenced alongside Dispatch, may enable persistent agent channels |

---

## 10. Sources

### Official Specifications
- [MCP Transports Specification (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)
- [MCP Resources Specification (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25/server/resources)
- [MCP Tasks Specification (2025-11-25)](https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/tasks)

### MCP Architecture
- [MCP Transport Future - Official Blog](https://blog.modelcontextprotocol.io/posts/2025-12-19-mcp-transport-future/)
- [MCP Transports Explained - DEV Community](https://dev.to/jefe_cool/mcp-transports-explained-stdio-vs-streamable-http-and-when-to-use-each-3lco)
- [One Year of MCP - Official Blog](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/)
- [MCP Enterprise Readiness](https://subramanya.ai/2025/12/01/mcp-enterprise-readiness-how-the-2025-11-25-spec-closes-the-production-gap/)
- [MCP Async Tasks - WorkOS](https://workos.com/blog/mcp-async-tasks-ai-agent-workflows)
- [Everything Teams Need to Know About MCP 2026 - WorkOS](https://workos.com/blog/everything-your-team-needs-to-know-about-mcp-in-2026)

### Claude Code Features
- [Claude Code Remote Control - Official Docs](https://code.claude.com/docs/en/remote-control)
- [Claude Code Scheduled Tasks - Official Docs](https://code.claude.com/docs/en/scheduled-tasks)
- [Claude Code Q1 2026 Update Roundup - MindStudio](https://www.mindstudio.ai/blog/claude-code-q1-2026-update-roundup)
- [Cowork Dispatch Guide - DataCamp](https://www.datacamp.com/tutorial/claude-cowork-dispatch)
- [Claude Dispatch - LowCode Agency](https://www.lowcode.agency/blog/claude-dispatch-explained)

### Database Concurrency
- [KuzuDB Concurrency Docs](https://kuzudb.github.io/docs/concurrency/)
- [KuzuDB for AI Agent Memory - Vela Partners](https://www.vela.partners/blog/kuzudb-ai-agent-memory-graph-database)
- [SQLite WAL Mode](https://www.sqlite.org/wal.html)
- [SQLite File Locking](https://sqlite.org/lockingv3.html)

### Multi-Agent Communication
- [MCP vs A2A Guide - DEV Community](https://dev.to/pockit_tools/mcp-vs-a2a-the-complete-guide-to-ai-agent-protocols-in-2026-30li)
- [A2A Announcement - Google Developers Blog](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/)
- [9 MCP Production Patterns That Scale - DEV Community](https://dev.to/dohkoai/9-mcp-production-patterns-that-actually-scale-multi-agent-systems-2026-4ap3)
- [Multi-Agent Systems with MCP - Pluralsight](https://www.pluralsight.com/resources/blog/ai-and-data/multi-agent-systems-mcp-AI)

### File Watching
- [Chokidar - GitHub](https://github.com/paulmillr/chokidar)
- [MCP Filesystem Server - GitHub](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem)
- [MCP File Operations Server - GitHub](https://github.com/bsmi021/mcp-file-operations-server)

### Persistent Personas
- [Building AI Agents with Personas and Dynamic Memory](https://medium.com/@leviexraspk/building-ai-agents-with-personas-goals-and-dynamic-memory-6253acacdc0a)
- [MCP Resource Subscriptions and Notifications](https://apxml.com/courses/getting-started-model-context-protocol/chapter-2-defining-resources-and-prompts/resource-subscriptions-notifications)

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| MCP Transport Architecture | HIGH | Verified from official spec |
| MCP Notifications/Resources | HIGH | Verified from official spec |
| MCP Tasks/Async | HIGH | Spec-level, multiple confirming sources |
| Claude Code Remote/Dispatch | MEDIUM | Third-party reporting, some official docs |
| KuzuDB Concurrency | HIGH | Official documentation |
| SQLite WAL Concurrency | HIGH | Official documentation |
| Multi-Agent Communication | MEDIUM | Community patterns, A2A still maturing |
| Persistent Personas | MEDIUM | Community patterns, no single standard |
| File Watching via MCP | MEDIUM | Spec supports it, implementation is custom |
