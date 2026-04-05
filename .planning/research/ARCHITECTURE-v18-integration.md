# Architecture Patterns: v1.8.0 Cowork Adaptation - Integration Deep Dive

**Domain:** Multi-surface MCP plugin with persistent intelligence
**Researched:** 2026-04-05
**Focus:** Orphaned command integration, Brain-driven routing, Cowork scheduled tasks, surface detection

## 1. The 15 Orphaned Commands - Integration Map

Currently 49 of 64 commands are exposed via tool-router.cjs's 6 hierarchical routers. The 15 orphans fall into 4 integration categories based on how they must attach to the MCP layer.

### Category A: New Router Group (7 commands)

These need a 7th router tool because they don't fit existing groups.

| Command | What It Does | Router Group | Core Module Needed |
|---------|-------------|--------------|-------------------|
| `act` | Autonomous framework selection + execution | `orchestration` | brain-router.cjs (NEW) + existing brain-client.cjs |
| `rooms` | Multi-room management (8 subcommands) | `orchestration` | room-registry via scripts/room-registry |
| `scout` | 5-task sentinel intelligence sweep | `orchestration` | sentinel scripts (3 existing) + proactive-intelligence.cjs |
| `reanalyze` | Re-run meeting intelligence | `orchestration` | scripts/compute-meetings-intelligence |
| `onboard` | Interactive walkthrough | `orchestration` | state-ops.cjs + room-ops.cjs |
| `models` | Agent model routing profiles | `orchestration` | model-profiles.cjs (existing) |
| `admin` | Brain API key management (hidden) | `orchestration` | scripts/seed-brain-commands.cjs |

**Router definition:**
```javascript
const ORCHESTRATION_COMMANDS = [
  'act', 'act-chain', 'act-swarm', 'act-dry-run',
  'rooms-list', 'rooms-new', 'rooms-open', 'rooms-close', 'rooms-archive', 'rooms-where',
  'scout', 'scout-health', 'scout-deadlines', 'scout-competitors', 'scout-hsi', 'scout-snapshot',
  'reanalyze', 'onboard', 'models', 'admin'
];
```

**Why a new group:** These commands orchestrate other commands -- act dispatches methodology tools, scout chains 5 analysis operations, rooms manages which room all other tools target. They are meta-commands, not methodology/analysis/intelligence operations. Mixing them into existing routers would muddy the semantic boundaries.

### Category B: Extend Existing Routers (3 commands)

| Command | Current Router | How to Add |
|---------|---------------|-----------|
| `find-analogies` | `methodology` | Add to METHODOLOGY_COMMANDS. Reference-based like other methodology tools. |
| `causal` | `analysis` | Add to ANALYSIS_COMMANDS. 3 subcommands: extract, trace, predict. Uses graph-ops.cjs + scripts/causal-to-kuzu.cjs. |
| `speakers` | `meeting` | Add to MEETING_COMMANDS. Reads from room/team/ directory. |

These require minimal changes -- just adding the command name to the z.enum array and adding a case to the switch block.

### Category C: Extend Export Router (5 commands)

| Command | What It Does | Integration |
|---------|-------------|-------------|
| `dashboard` | Open interactive graph in browser | Export group. Calls scripts/serve-dashboard. On Cowork, becomes MCP App instead. |
| `wiki` | Open localhost wiki | Export group. Calls scripts/serve-wiki. On Cowork, becomes MCP App. |
| `present` | Generate 6-view presentation | Export group. Calls scripts/generate-presentation.cjs. |
| `publish` | Deploy to Vercel | Export group. Calls scripts/publish-ops. |
| `snapshot` | Generate single-file HTML | Export group. Calls scripts/generate-snapshot.cjs. |

```javascript
// Expanded EXPORT_COMMANDS
const EXPORT_COMMANDS = [
  'export', 'radar', 'dashboard', 'wiki', 'present', 'publish', 'snapshot'
];
```

### Category D: No MCP Registration Needed (2 commands)

| Command | Treatment |
|---------|-----------|
| `splash` | Not a tool. Session-start banner only. No MCP registration needed. |
| `funding` | Already fully covered by data_room router via list-funding, create-funding, update-funding-stage sub-commands. The CLI funding command is a convenience wrapper that routes to these. |

### Revised Router Tool Count

| Router | Current | After Integration |
|--------|---------|-------------------|
| data_room | 34 commands | 34 (unchanged) |
| methodology | 13 commands | 14 (+find-analogies) |
| analysis | 10 commands | 13 (+causal-extract, causal-trace, causal-predict) |
| intelligence | 7 commands | 7 (unchanged) |
| meeting | 2 commands | 3 (+speakers) |
| export | 2 commands | 7 (+dashboard, wiki, present, publish, snapshot) |
| orchestration (NEW) | 0 | 20 (act variants + rooms variants + scout variants + reanalyze + onboard + models + admin) |
| **Total** | **49** | **98 sub-commands across 7 routers** |

**Token budget impact:** Adding 1 new router tool adds ~300 tokens to tool definitions. Still well under the 5000-token hierarchical design budget.

## 2. Brain-Driven Routing Architecture

### The Problem

act, pipeline, and suggest-next all need to answer: "Given this room's state and the user's intent, which methodology/chain should run?" Today this logic lives in act.md's Step 3 as a prompt -- it runs in Claude's context. For MCP, this must happen programmatically so Cowork/Desktop can invoke framework chains.

### Architecture: brain-router.cjs

```
User Intent (via MCP tool call)
        |
        v
+------------------+
| brain-router.cjs |
| (NEW module)     |
+------------------+
        |
        +-- 1. Read room STATE.md (via state-ops.cjs)
        |       - venture_stage, problem_type, applied_frameworks, section_fill_levels
        |
        +-- 2. Classify intent
        |       - "act" -> autonomous selection
        |       - "pipeline" -> full stage pipeline  
        |       - "suggest-next" -> recommendation only
        |       - "act --chain" -> multi-framework sequence
        |
        +-- 3. Consult Brain (if available)
        |       |
        |       v
        |   brain-client.cjs.callTool('recommend-framework-chain', {
        |     venture_stage, problem_type, applied_frameworks,
        |     intent_type, weakest_sections
        |   })
        |       |
        |       +-- Returns: { chain: ['root-cause', 'causal', 'scenario-plan'],
        |       |              confidence: 0.87, source: 'brain_graph' }
        |       |
        |       +-- OR null (no Brain key / Brain down)
        |
        +-- 4. Local Fallback (if Brain unavailable)
        |       |
        |       v
        |   Load references/methodology/problem-types.md
        |   Cross-reference problem_type x definition_level
        |   Exclude already-applied frameworks
        |   Score: 40% weakest-section + 30% problem-match + 20% not-applied + 10% progression
        |       |
        |       +-- Returns: { chain: ['diagnose'], confidence: 0.65, source: 'local_routing' }
        |
        +-- 5. Return recommendation
                |
                v
            { chain: [...], confidence: N, source: 'brain_graph'|'local_routing',
              reasoning: "...", target_sections: [...] }
```

### Integration with tool-router.cjs

brain-router.cjs is NOT called for every tool. It is called only by the `orchestration` router for `act*` and `suggest-next` commands. The data flow:

```javascript
// In tool-router.cjs, orchestration router handler:
case 'act': {
  const brainRouter = require('./brain-router.cjs');
  const recommendation = await brainRouter.recommend(roomDir, {
    intent: 'autonomous',
    mode: 'single'  // or 'chain' or 'swarm'
  });
  
  // Return recommendation as structured text for Claude to execute
  const actRef = loadReference(pluginRoot, 'act');
  return textResponse(JSON.stringify({
    recommendation,
    reference: actRef,
    roomState: loadRoomState(roomDir)
  }, null, 2));
}
```

**Key design choice:** The MCP tool returns the Brain's recommendation + the command reference. Claude (on Desktop/Cowork) then executes the methodology using the methodology/analysis routers. The orchestration router RECOMMENDS, it does not EXECUTE the chain itself. This keeps the execution path through the existing methodology/analysis tool handlers and avoids duplicating framework execution logic.

### Brain-Router Module Interface

```javascript
// lib/mcp/brain-router.cjs
module.exports = {
  /**
   * Get methodology recommendation for a room.
   * @param {string} roomDir
   * @param {{ intent: 'autonomous'|'pipeline'|'suggest', mode: 'single'|'chain'|'swarm' }} opts
   * @returns {{ chain: string[], confidence: number, source: string, reasoning: string, target_sections: string[] }}
   */
  recommend: async function(roomDir, opts) { ... },
  
  /**
   * Validate that a framework chain makes sense for the current state.
   * Called when user modifies the suggested chain.
   * @returns {{ valid: boolean, warnings: string[] }}
   */
  validateChain: async function(roomDir, chain) { ... }
};
```

### Dependencies

| Module | Depends On | Already Exists? |
|--------|-----------|----------------|
| brain-router.cjs | brain-client.cjs | Yes -- lib/core/brain-client.cjs |
| brain-router.cjs | state-ops.cjs | Yes -- lib/core/state-ops.cjs |
| brain-router.cjs | model-profiles.cjs | Yes -- lib/core/model-profiles.cjs |
| brain-router.cjs | references/methodology/problem-types.md | Yes -- references/methodology/ |

No new external dependencies. brain-router.cjs is pure orchestration logic over existing modules.

## 3. Surface Detection Flow

### Detection Mechanism

Surface detection happens at MCP server startup, not per-request. The server reads environment signals to determine which surface spawned it.

```
+---------------------------+
|    Environment Signals    |
+---------------------------+
| CLAUDE_SURFACE            | Set by Anthropic runtime (if available)
| MINDRIAN_TRANSPORT        | Set by user config (explicit override)
| COWORK_SESSION_ID         | Present in Cowork VM only
| /sessions directory       | Exists only in Cowork VM (Ubuntu 22.04)
| process.stdin.isTTY       | true for CLI, false for stdio pipe
+---------------------------+
            |
            v
+---------------------------+
| lib/mcp/surface-detect.cjs|
| (NEW - ~40 lines)         |
+---------------------------+
            |
            v
    Returns: { surface: 'cli'|'desktop'|'cowork',
               transport: 'stdio'|'http',
               capabilities: { hooks, apps, tasks, scripts } }
```

### Detection Logic

```javascript
// lib/mcp/surface-detect.cjs
function detectSurface() {
  // Explicit override takes priority
  if (process.env.MINDRIAN_TRANSPORT === 'http') {
    return { surface: 'cowork', transport: 'http', capabilities: COWORK_CAPS };
  }
  
  // Anthropic-set surface indicator
  if (process.env.CLAUDE_SURFACE === 'cowork') {
    return { surface: 'cowork', transport: 'http', capabilities: COWORK_CAPS };
  }
  
  // Cowork VM indicators (per pvieito's reverse-engineering)
  if (process.env.COWORK_SESSION_ID || fs.existsSync('/sessions')) {
    return { surface: 'cowork', transport: 'http', capabilities: COWORK_CAPS };
  }
  
  // CLI entry point (not MCP server at all)
  if (process.argv[1] && process.argv[1].includes('mindrian-tools')) {
    return { surface: 'cli', transport: 'none', capabilities: CLI_CAPS };
  }
  
  // Default: Desktop via stdio
  return { surface: 'desktop', transport: 'stdio', capabilities: DESKTOP_CAPS };
}

const CLI_CAPS     = { hooks: true,  apps: false, tasks: false, scripts: true  };
const DESKTOP_CAPS = { hooks: false, apps: true,  tasks: false, scripts: false };
const COWORK_CAPS  = { hooks: false, apps: true,  tasks: true,  scripts: false };
```

### How Surface Detection Flows Through the System

```
mindrian-mcp-server.cjs startup
    |
    +-- surface-detect.cjs -> { surface, transport, capabilities }
    |
    +-- Transport selection:
    |   |
    |   +-- if transport === 'http':
    |   |       const app = createMcpExpressApp(server);
    |   |       app.listen(3847, '127.0.0.1');
    |   |
    |   +-- else:
    |           const transport = new StdioServerTransport();
    |           server.connect(transport);
    |
    +-- Conditional registration:
    |   |
    |   +-- registerRouterTools(server, roomDir, pluginRoot, larryContext)
    |   |   // Always: all 7 router tools registered (tools work on all surfaces)
    |   |
    |   +-- if capabilities.apps:
    |   |       registerApps(server, roomDir);  // MCP Apps for dashboard/wiki/graph
    |   |
    |   +-- if capabilities.tasks:
    |   |       registerTasks(server, roomDir);  // Async task support
    |   |
    |   +-- registerResources(server, roomDir)
    |   |   // if transport === 'http': enable chokidar + subscription handler
    |   |
    |   +-- registerPrompts(server, roomDir, pluginRoot)
    |
    +-- Cowork catch-up (if surface === 'cowork'):
            checkSessionCatchUp(roomDir);  // See Section 4
```

### Capability Degradation by Surface

| Capability | CLI | Desktop | Cowork |
|-----------|-----|---------|--------|
| Hook-based intelligence (PostToolUse, etc.) | Yes | No | No |
| MCP tool intelligence (equivalent) | N/A | Yes | Yes |
| Bash script execution (via child_process in MCP server) | Yes | Yes* | Yes* |
| MCP Apps (interactive views in chat) | No | Yes | Yes |
| MCP Tasks (background operations) | No | No | Yes |
| Resource subscriptions (live updates) | No | Partial | Yes |
| Brain consultation | Yes | Yes | Yes |
| Room filesystem read/write | Direct | Via MCP tools | Via mounted folder + MCP tools |

\* Scripts executed by the MCP server process via child_process work on all surfaces. The MCP server CAN run `scripts/compute-state` etc. because it has Node.js child_process. What does NOT work is Bash hooks that the Claude Code client triggers (PostToolUse etc.) -- those are CLI-only.

### Hook-to-MCP Equivalence Map

The 9 CLI hooks need MCP-native equivalents for Desktop/Cowork:

| CLI Hook | MCP Equivalent | Implementation |
|----------|---------------|---------------|
| SessionStart | Server init + first tool call | brain-router.cjs auto-loads room state. Cowork catch-up runs deferred checks. |
| PreCompact | Not needed | MCP server is stateless. Nothing to save before compact. |
| PostCompact | Not needed | MCP server is stateless. |
| Stop | Server shutdown handler | `process.on('SIGTERM')` writes last-session.json |
| PostToolUse (Write) | Inline in tool handlers | After data_room/methodology tools that write, run `graphOps.indexArtifact()` + proactive scan |
| FileChanged | chokidar + resource notifications | resources.cjs watches room/, emits `notifications/resources/updated` |
| CwdChanged | rooms-open command | When user switches rooms via orchestration router, reload room context |
| SubagentStop | Task completion callback | tasks.cjs handles agent completion state |
| TaskCompleted | Task status update | tasks.cjs marks task done, emits notification |

## 4. Cowork Scheduled Tasks and Persistent Agents

### The Constraint

Cowork runs in a sandboxed VM. No cron. No persistent daemon outside the session. The MCP server lives only as long as the Cowork session. But "persistent intelligence" means Larry remembers between sessions and runs checks proactively.

### Architecture: Filesystem-Based Persistence + Session-Start Catch-Up

Instead of true scheduled agents, the architecture uses **session-start catch-up** -- when a Cowork session starts and the MCP server initializes, it checks what was missed since last session.

```
Session N ends:
  -> SIGTERM handler writes room/.mindrian/last-session.json
     { 
       ended: "2026-04-05T18:30:00Z",
       predictions_checked: ["prediction-1", "prediction-3"],
       scout_ran: "2026-04-05T14:00:00Z",
       briefing_generated: "2026-04-05T10:00:00Z",
       hat_states_saved: true
     }

Session N+1 starts:
  -> Server init reads room/.mindrian/last-session.json
  -> Computes delta:
     - hours_since_scout = (now - scout_ran) / 3600000
     - predictions_due = check REGISTRY.json for deadlines between last_session and now
     - new_files = git diff or mtime comparison
  -> Queues catch-up tasks (as MCP Tasks if on Cowork):
     - If hours_since_scout > 24: queue scout-health + scout-deadlines
     - If predictions_due.length > 0: queue deadline check
     - If new_files.length > 0: queue reanalyze
  -> Returns catch-up summary in first resource update notification
```

### Daily Briefing Generation

When catch-up detects >24h since last briefing:

```javascript
// lib/mcp/session-catchup.cjs
async function generateBriefing(roomDir) {
  const state = stateOps.getState(roomDir);
  const predictions = loadPredictions(roomDir);  // from REGISTRY.json
  const hatStates = loadHatStates(roomDir);      // from room/.mindrian/hats/
  const lastIntel = proactiveIntelligence.loadIntelligence(roomDir);
  
  return {
    room_health: extractHealthMetrics(state),
    predictions_due: predictions.filter(p => p.deadline < nextWeek()),
    hat_highlights: {
      black: hatStates.black?.top_concern,
      yellow: hatStates.yellow?.top_opportunity,
      blue: hatStates.blue?.methodology_effectiveness
    },
    new_intelligence: lastIntel.insights.filter(i => i.timestamp > lastSession.ended),
    suggested_action: 'Run /mos:scout for full sentinel sweep'
  };
}
```

### Persistent Hat State

The 6 De Bono hats maintain state across sessions via filesystem:

```
room/.mindrian/hats/
  black/
    STATE.md        # Current concerns, risk register, last-updated timestamp
    session-log/    # What black hat found each session (YYYY-MM-DD.md)
  yellow/
    STATE.md        # Current opportunities, HSI connections
    session-log/
  blue/
    STATE.md        # Process meta-analysis, methodology effectiveness
    session-log/
  red/
    STATE.md        # Emotional signals from meetings, team sentiment
    session-log/
  green/
    STATE.md        # Creative alternatives, unexplored directions
    session-log/
  white/
    STATE.md        # Data gaps, information quality assessment
    session-log/
```

Hat state feeds brain-router.cjs:
- Black hat STATE.md -> risk assessment during framework selection
- Yellow hat STATE.md -> opportunity scoring for HSI-heavy chains
- Blue hat STATE.md -> methodology effectiveness tracking (avoid repeating ineffective frameworks)

### MCP Tasks for Background Operations

Long-running operations on Cowork use the MCP Tasks primitive:

```javascript
// lib/mcp/tasks.cjs
const activeTasks = new Map();

function registerTasks(server) {
  server.setRequestHandler('tasks/get', async (request) => {
    const task = activeTasks.get(request.params.taskId);
    if (!task) return { error: { code: -32602, message: 'Unknown task' } };
    return task;
  });
}

function createTask(toolName, roomDir, params) {
  const taskId = `${toolName}-${Date.now()}`;
  const task = {
    taskId,
    status: 'working',
    statusMessage: `Running ${toolName}...`,
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString()
  };
  activeTasks.set(taskId, task);
  
  setImmediate(async () => {
    try {
      const result = await executeOperation(toolName, roomDir, params);
      task.status = 'completed';
      task.result = result;
    } catch (err) {
      task.status = 'failed';
      task.error = err.message;
    }
    task.lastUpdatedAt = new Date().toISOString();
  });
  
  return task;
}
```

**Operations that become tasks on Cowork:**
| Operation | Sync Duration | Why Async |
|-----------|--------------|-----------|
| `scout` (full 5-task suite) | 30-60s | Runs 5 analysis scripts sequentially |
| `reanalyze` (meeting re-intelligence) | 15-30s | Re-processes all meeting transcripts |
| `act --swarm` (3 parallel frameworks) | 60-120s | 3 framework executions |
| `graph-rebuild` (full LazyGraph rebuild) | 10-30s | Re-indexes all room artifacts |
| HSI computation (Python) | 10-20s | sentence-transformers + LSA |

## 5. KuzuDB Single-Writer Gateway

### The Problem

KuzuDB is strictly single-writer. On CLI, only one process ever accesses it. With MCP server handling multiple tool calls, concurrent writes could corrupt the database.

### Solution: Write Queue in graph-ops.cjs

```javascript
// lib/core/graph-ops.cjs - add write serialization
let writeQueue = Promise.resolve();

function enqueueWrite(fn) {
  writeQueue = writeQueue.then(fn).catch(err => {
    process.stderr.write(`[graph-ops] Write failed: ${err.message}\n`);
  });
  return writeQueue;
}

// All write operations go through the queue
async function indexArtifact(roomDir, filePath) {
  return enqueueWrite(async () => {
    // ... existing indexing logic, unchanged
  });
}

async function rebuildGraph(roomDir) {
  return enqueueWrite(async () => {
    // ... existing rebuild logic, unchanged
  });
}

// Read operations are unqueued (KuzuDB allows concurrent reads)
async function queryGraph(roomDir, cypher) {
  // ... direct read, no queue needed
}
```

Minimal change (~30 lines). No external dependency. The promise chain serializes writes while allowing concurrent reads.

## 6. Build Order (Dependency-Respecting)

### Phase 1: Foundation (no new deps, unblocks everything)
1. **surface-detect.cjs** -- 40 lines, no deps. Enables all subsequent conditional logic.
2. **Expand existing routers** -- Add find-analogies, causal, speakers, dashboard, wiki, present, publish, snapshot to existing router groups. Changes to tool-router.cjs only.

### Phase 2: Orchestration Router (depends on Phase 1)
3. **brain-router.cjs** -- Depends on brain-client.cjs (exists), state-ops.cjs (exists). ~150 lines.
4. **orchestration router** in tool-router.cjs -- 7th router. Depends on brain-router.cjs for act/suggest-next, scripts/room-registry for rooms, sentinel scripts for scout.

### Phase 3: Cowork Capabilities (depends on Phase 1 surface detection)
5. **tasks.cjs** -- MCP Tasks registration. Wraps long-running operations.
6. **apps.cjs** -- MCP Apps registration. Dashboard/wiki/graph as interactive views. Requires @modelcontextprotocol/ext-apps.
7. **Resource subscriptions** -- Add chokidar file watching + subscription handlers to resources.cjs.

### Phase 4: Persistent Intelligence (depends on Phases 2-3)
8. **Hat persistence** -- room/.mindrian/hats/ filesystem + load/save in persona-ops.cjs.
9. **Session catch-up** -- room/.mindrian/last-session.json + catch-up logic at server init.
10. **KuzuDB write queue** -- Promise-chain serialization in graph-ops.cjs.

### Phase 5: Integration Testing
11. **Surface-specific test matrix** -- Verify all 7 routers on CLI, Desktop, Cowork.
12. **Brain routing E2E** -- act -> brain-router -> recommendation -> methodology execution.

## 7. New vs Modified Components

| Component | Status | Lines Est. | New Dependencies |
|-----------|--------|-----------|-----------------|
| `lib/mcp/surface-detect.cjs` | NEW | ~40 | None (fs builtin) |
| `lib/mcp/brain-router.cjs` | NEW | ~150 | None (uses existing brain-client.cjs) |
| `lib/mcp/tasks.cjs` | NEW | ~120 | None (pure orchestration) |
| `lib/mcp/apps.cjs` | NEW | ~200 | @modelcontextprotocol/ext-apps |
| `lib/mcp/session-catchup.cjs` | NEW | ~100 | None (uses existing state-ops, proactive-intelligence) |
| `lib/mcp/tool-router.cjs` | MODIFY | +~300 | brain-router.cjs (internal) |
| `lib/mcp/resources.cjs` | MODIFY | +~80 | chokidar |
| `lib/core/graph-ops.cjs` | MODIFY | +~30 | None |
| `lib/core/persona-ops.cjs` | MODIFY | +~60 | None |
| `bin/mindrian-mcp-server.cjs` | MODIFY | +~40 | surface-detect.cjs (internal) |

### New npm Dependencies

| Package | Purpose | When | Required? |
|---------|---------|------|-----------|
| `@modelcontextprotocol/ext-apps` | MCP Apps registration helpers | Phase 3 | No -- graceful degradation if missing |
| `chokidar` | File watching for resource subscriptions | Phase 3 | No -- subscriptions disabled without it |

Both are optional. The server runs without them but with reduced Cowork capabilities. Detection via try/catch require.

## Sources

- [MCP Apps official docs](https://modelcontextprotocol.io/docs/extensions/apps) -- ui:// resource URI, sandboxed iframe rendering, bidirectional data flow via postMessage [HIGH confidence]
- [Inside Claude Cowork VM](https://pvieito.com/2026/01/inside-claude-cowork) -- VirtioFS, bubblewrap sandbox, MCP passthrough via SDK type, /sessions directory [HIGH confidence]
- [MCP 2026 Roadmap](http://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) -- Tasks primitive status, lifecycle gaps (retry semantics, expiry policies) [HIGH confidence]
- [MCP Resources spec](https://modelcontextprotocol.io/specification/2025-06-18/server/resources) -- subscription protocol, notifications/resources/updated [HIGH confidence]
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) -- transport spec, session management [HIGH confidence]
- Existing codebase: tool-router.cjs (6 routers, 49 commands), brain-client.cjs (HTTP client to Brain), proactive-intelligence.cjs (insight persistence) -- verified by direct code reading [HIGH confidence]
