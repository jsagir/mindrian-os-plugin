# Pitfalls Research: CLI-to-MCP+Cowork Adaptation (v1.8.0)

**Domain:** Adapting existing 64-command CLI plugin for MCP tool exposure + Cowork sandbox
**Researched:** 2026-04-05
**Confidence:** HIGH (verified against actual codebase, confirmed bugs, official docs)

---

## Critical Pitfalls

### Pitfall 1: Hooks Do Not Fire in Cowork -- Confirmed Anthropic Bug

**What goes wrong:**
The entire intelligence cascade -- PostToolUse (HSI, cross-reference, graph update), SessionStart (room context loading), FileChanged (external file processing), SubagentStop (agent output processing), TaskCompleted (pipeline progress) -- silently fails in Cowork. All 8 hooks in hooks.json are dead. No errors logged. The plugin appears to work but intelligence never fires.

**Why it happens:**
Cowork VM spawns Claude CLI with `--setting-sources user`, which is hardcoded in the Cowork host code and not user-configurable. This restricts settings resolution to user-scope only. Plugin hooks discovered from `hooks/hooks.json` are plugin-scoped, so they are silently excluded. MCP servers load because they use `--mcp-config` (explicit), but hooks use convention-based discovery (scoped). Confirmed in GitHub issue #27398 (anthropics/claude-code), filed February 2026, closed as duplicate.

**How to avoid:**
1. Accept that hooks will NOT work in Cowork for the foreseeable future -- design around this constraint, not against it
2. Implement a "MCP intelligence wrapper" pattern: every MCP tool that writes to the room must internally call the same intelligence functions that hooks would trigger
3. Create `lib/core/intelligence-cascade.cjs` that both hooks AND MCP tool handlers can call
4. The cascade function signature: `runCascade(roomDir, { trigger, filePath, section })` -- same logic, two entry points
5. For SessionStart equivalent: use MCP resource subscriptions with `room://state` that auto-load context when a client connects

**Warning signs:**
- Room intelligence files (HSI scores, cross-references, convergence signals) stop updating after moving to Cowork
- `STATE.md` timestamps are stale
- No graph edges being created despite filing artifacts
- Users report "Larry seems dumber on Desktop/Cowork"

**Phase to address:**
Phase 1 (MCP Foundation) -- must be solved before ANY tool is useful on Cowork. The intelligence cascade IS the product differentiator.

**Severity: CRITICAL** -- Without this fix, Cowork users get a hollow shell. The plugin works but doesn't think.

---

### Pitfall 2: Hierarchical Router Token Budget Blown by 15 New Commands

**What goes wrong:**
Current 6 routers with 49 commands use ~5,000 tokens. Adding 15 orphan commands (act, causal, dashboard, find-analogies, rooms, scout, wiki, etc.) pushes token cost to ~7,000-8,000. But the subtler problem: Claude's tool selection accuracy degrades when individual z.enum arrays exceed ~15-20 values. The data_room router already has 34 commands in its enum -- Claude misroutes ~15% of the time above 20 values per enum.

**Why it happens:**
The hierarchical pattern was designed for 49 commands across 6 groups. The data_room router accumulated 34 commands including reasoning-*, graph-*, visualize-*, persona-*, opportunity-*, and funding-* subcommands. Adding 15 orphans doesn't just increase tokens -- it makes the largest group too big for reliable intent matching. Each z.enum value adds ~15-20 tokens to the tool schema, but the real cost is Claude scanning 34+ options and picking the wrong one.

**How to avoid:**
1. Split data_room into 3 sub-routers: `room_state` (status, analyze, compute, get-state, suggest-next -- 5 cmds), `room_content` (opportunities, funding, personas, reasoning -- 15 cmds), `room_graph` (graph-*, visualize-* -- 7 cmds)
2. Keep each router under 15 commands maximum
3. Add the 15 orphans as new routers: `orchestration` (act, rooms, dashboard, scout, wiki, causal, find-analogies) and `admin` (setup, help, update, detect-integrations)
4. Target: 8-10 routers, each with 5-12 commands, total token budget ~6,000-7,000
5. Test routing accuracy with MCP Inspector before shipping -- 20 natural language queries, measure misroute rate per router

**Warning signs:**
- Claude calls `data_room` with command `analyze` when user asked for `analyze-perspectives` (persona operation)
- Tool calls succeed but return wrong results because the wrong subcommand was dispatched
- Users report "Larry doesn't understand what I'm asking" on Desktop/Cowork

**Phase to address:**
Phase 1 (MCP Foundation) -- router restructuring must happen before adding new commands.

**Severity: CRITICAL** -- Misrouting breaks user trust. Hard to debug because tools succeed with wrong results.

---

### Pitfall 3: KuzuDB Single-Writer Contention Between CLI and MCP Server

**What goes wrong:**
KuzuDB enforces single-writer access at the file level via permission flags. When the CLI hook fires `graph-index` (PostToolUse) and the MCP server simultaneously runs `data_room({command: 'graph-rebuild'})`, one process gets a lock error. The loser either crashes, hangs, or silently drops the write. Since hooks fire asynchronously, timing is unpredictable. The current open-use-close pattern in `graph-ops.cjs` is correct but insufficient when two separate Node.js processes race for the same database file.

**Why it happens:**
KuzuDB is embedded -- it sets permission flags on the database file when opened. Only one READ_WRITE Database instance can exist at a time. CLI hooks and MCP server are separate processes. Both call `lazygraph.openGraph(roomDir)` which attempts READ_WRITE access. KuzuDB's lock is per-process, not per-thread.

**How to avoid:**
1. Designate the MCP server as the SOLE write gateway for KuzuDB when it is running. CLI hooks should detect MCP server presence and delegate graph writes via local IPC or skip them
2. If CLI-only mode (no MCP server running), CLI hooks write directly -- detect surface and route accordingly
3. Implement a file-based write lock: `room/.graph/write.lock` with PID and timestamp, 5-second stale lock cleanup
4. Add a write queue in `lazygraph-ops.cjs`: serialize all graph writes through an async queue with `setImmediate()` yield between operations
5. For the ambitious: use the Vela-Engineering KuzuDB fork with concurrent multi-writer support -- but this adds a non-standard dependency

**Warning signs:**
- `EBUSY` or `EACCES` errors in MCP server logs during graph operations
- Graph index falls behind -- artifacts filed but not indexed
- Graph stats show fewer nodes than expected vs artifact count
- Intermittent "database is locked" errors that only appear under concurrent use

**Phase to address:**
Phase 2 (Surface Detection + Auto-Setup) -- the write gateway pattern must be established when surface detection determines CLI vs MCP mode.

**Severity: CRITICAL** -- Data loss in the knowledge graph means lost intelligence edges. Users never see what was silently dropped.

---

### Pitfall 4: Brain MCP Unreachable Turns Routing Into a Brick Wall

**What goes wrong:**
Brain-driven routing at the MCP layer means every `/mos:act` equivalent makes a network call to brain.mindrian.ai before choosing which methodology to chain. Brain runs on Render free tier (sleeps after 15 min idle). Cold start takes 10-30s. If Brain is down, slow, or user has no internet, the routing layer blocks. Every tool call that uses Brain-driven routing becomes a 30-second wait followed by timeout.

**Why it happens:**
The v1.8.0 design elevates Brain from "optional enrichment" to "routing oracle" -- a single point of failure. Unlike CLI where Brain calls happen in background hooks with graceful degradation, MCP tool handlers are synchronous request-response. A blocking Brain call freezes the tool until timeout.

**How to avoid:**
1. Brain consultation MUST be fire-and-forget with a 2-second hard timeout. No tool call should block on Brain
2. Build a local routing heuristic in `lib/core/brain-client.cjs`: room STATE.md keywords mapped to a framework table (50 entries covers 80% of cases)
3. Cache Brain routing decisions in `room/.brain-cache.json` with 24-hour TTL. Same room context = same routing
4. Three-tier routing: (a) cache hit -> instant, (b) local heuristic -> <100ms, (c) Brain query -> 2s timeout, fallback to (b)
5. Pre-warm Brain on MCP server start -- fire a lightweight `/health` ping to wake Render
6. NEVER make Brain required for any tool to function. The Tier 0 design principle must extend to routing

**Warning signs:**
- Tool calls take >5 seconds consistently
- Users on airplane mode get error responses from every methodology tool
- MCP server logs show repeated timeout errors to brain.mindrian.ai
- Render dashboard shows frequent cold starts

**Phase to address:**
Phase 1 (MCP Foundation) -- the routing layer must be resilient from day one.

**Severity: CRITICAL** -- Blocks all tool usage when Brain is down. Destroys the "zero infrastructure" promise.

---

### Pitfall 5: Cowork Sandbox Path Access for Plugin References

**What goes wrong:**
Cowork runs in a VZVirtualMachine. The agent can ONLY access folders explicitly mounted into the VM. The plugin's reference files (`references/methodology/*.md`, `references/personality/*.md`), Larry's personality context, and command definitions live in the plugin installation directory -- NOT the mounted project folder. MCP tools that call `loadReference(pluginRoot, command)` or `loadLarryContext(pluginRoot)` may fail if `pluginRoot` resolves to an inaccessible path.

**Why it happens:**
The MCP server is spawned with `MINDRIAN_ROOM` pointing to the project folder (mounted). The plugin code reads reference files from its own installation directory via `__dirname`-relative paths. In Cowork, the server process IS executing (so its own code files are readable), but whether it can read sibling directories in the same installation tree depends on how the Cowork host mounts the plugin.

**How to avoid:**
1. TEST THIS FIRST -- before building anything, deploy a minimal MCP server to Cowork that does `fs.readFileSync(path.join(__dirname, '../references/methodology/lean-canvas.md'))` and verify it works
2. If the server CAN read its own directory tree: no change needed, `__dirname`-relative resolution works
3. If it CANNOT: bundle all references as inline data objects in the server binary, OR copy essential references to `room/00_Context/` during `/mos:setup`
4. The `00_Context/` pattern already exists in Cowork projects -- use it as the reference delivery fallback
5. Always use `__dirname`-relative paths, never absolute paths that assume host filesystem structure

**Warning signs:**
- MCP tools return "Reference file not found" for every methodology command
- Larry's personality context is empty -- Larry sounds generic
- `buildContext()` function returns only room state, no reference content
- Works on CLI and Desktop, fails only on Cowork

**Phase to address:**
Phase 2 (Surface Detection + Auto-Setup) -- surface detection must verify path accessibility and adapt reference loading.

**Severity: HIGH** -- Without references, methodology tools return empty guidance. Without Larry context, the personality differentiator disappears.

---

## Moderate Pitfalls

### Pitfall 6: Pipeline Chaining Loses Context Across MCP Tool Calls

**What goes wrong:**
CLI pipeline chains methodology outputs through the room: scenario analysis output -> filed to room -> root cause reads it -> files results -> causal tracing reads those. In CLI, Claude's conversation context carries the chain. In MCP, each tool call is stateless -- the output of `methodology({command: 'scenario-plan'})` returns to the client, but the next call to `analysis({command: 'root-cause'})` has no memory of what scenario-plan produced. The MCP server doesn't see conversation context between tool calls.

**Why it happens:**
MCP protocol is designed for stateless tool execution. Each invocation is independent. The client (Claude Desktop/Cowork) maintains conversation context, but the MCP server's tool handler doesn't see it. Pipeline state that lived in conversation context on CLI has no equivalent in MCP.

**How to avoid:**
1. Chain state lives in the ROOM, not conversation context. This is already Decision #7 ("pipelines chain through Room"). Enforce it strictly
2. Every methodology tool must (a) read relevant room state before executing, (b) file results after executing, (c) return a structured "next step" hint
3. Add `previous_step` optional parameter to methodology tools: `{ command: 'root-cause', previous_step: 'scenario-plan', context: 'room/problem-definition/scenario-analysis-2026-04-05.md' }`
4. Implement `room/.pipeline-state.json` tracking current pipeline position, last output path, pending steps
5. Tool responses include actionable chain hints: `{ result: "...", next: { tool: "analysis", command: "root-cause", context: "Read room/problem-definition/scenario-*.md" } }`

**Warning signs:**
- Methodology sessions produce good outputs but never build on each other
- Users manually explain "I just ran X, now run Y on that" every time
- Room intelligence edges between methodology outputs are missing

**Phase to address:**
Phase 3 (Pipeline Chaining via MCP)

**Severity: HIGH** -- Pipeline chaining is the Week 7 pattern. Without it, 25 disconnected tools instead of a methodology system.

---

### Pitfall 7: De Bono 6 Persistent Hats Consuming 6x Context/Tokens

**What goes wrong:**
Naive implementation: 6 agents each maintain their own conversation thread in Cowork. At ~10K tokens per hat persona + room state = 60K tokens of overhead before any user work. On Max plan, this could consume 30-40% of daily token budget on hat maintenance alone. Background agents are also hard to stop (confirmed issue #41461 -- background agents cannot be stopped, massive token waste).

**Why it happens:**
The design says "6 always-on perspective agents." Cowork token usage scales proportionally with active agent count. Each agent runs its own context window. "Persistent" = "always consuming."

**How to avoid:**
1. Hats are NOT 6 separate agents. They are 6 persona profiles loaded on-demand into a SINGLE agent
2. Store hat state as files: `room/team/ai-personas/black-hat.md` -- already supported by persona-ops.cjs
3. `invoke-persona` loads ONE hat's context, runs analysis, files results, frees context
4. `analyze-perspectives` loads all 6 sequentially (not parallel) in a single subagent call
5. For "always-on" feel: scheduled task runs `analyze-perspectives` daily -- not 6 persistent processes
6. Each hat analysis should be <5K tokens total
7. "Persistence" is in filed outputs, not live context. Hat outputs accumulate in `room/team/ai-personas/analyses/`

**Warning signs:**
- Token usage spikes 5-10x after enabling De Bono hats
- Cowork shows 6 active "conversations" user didn't start
- Max plan usage warnings after 2-3 days
- Hat analyses repeat the same observations (no room state delta awareness)

**Phase to address:**
Phase 5 (De Bono Persistent Hats)

**Severity: HIGH** -- Token cost is a hard constraint. 6x overhead is economically unfeasible for most users.

---

### Pitfall 8: Scheduled Task Unreliability (Desktop-Only, Bug-Prone)

**What goes wrong:**
Building scheduled intelligence (daily briefings, prediction checks, scout runs) on Cowork's `/schedule` API, then discovering: (a) tasks only run when Desktop app is open and computer is awake, (b) MCP connectors sometimes don't load in scheduled sessions (confirmed bugs #43397, #32000, #36327), (c) the API surface is new (January 2026) and may change.

**Why it happens:**
Cowork scheduled tasks are a Desktop-local feature, not a cloud service. They depend on the app running. The MCP connector loading bug means tools the task needs may be unavailable. And the feature is recent enough that the contract isn't battle-hardened.

**How to avoid:**
1. Design all scheduled intelligence as "catch-up capable" -- missed schedules get run on next manual session
2. Store scheduling intent in `room/.scheduled-intelligence.json` (what to run, frequency, last success timestamp)
3. SessionStart (or MCP connect) checks this file and runs overdue tasks -- works on ALL surfaces
4. Use Cowork `/schedule` as a convenience trigger, not the source of truth
5. Implement idempotency: running a daily briefing twice produces same output or deduplicates
6. NEVER depend on Cowork scheduling as the ONLY trigger for periodic intelligence

**Warning signs:**
- Briefings stop appearing when user closes laptop overnight
- Scheduled tasks show "completed" in Cowork UI but room intelligence files weren't updated
- Different behavior between Mac and Windows Cowork users

**Phase to address:**
Phase 4 (Cowork Scheduled Intelligence)

**Severity: HIGH** -- Silent failures destroy trust in automated intelligence.

---

### Pitfall 9: MCP Apps Spec Still Maturing -- Build on Shifting Ground

**What goes wrong:**
Building interactive Data Room views (dashboard, wiki, graph) as MCP Apps, then the spec evolves how tools return UI, iframe sandboxing, or host communication. The ext-apps SDK has 4 packages, all actively maintained. Client implementations vary across Claude, VS Code, Goose, Postman.

**Why it happens:**
MCP Apps spec 2026-01-26 is marked "stable" but has a separate "draft" version. The SDK publishes 4 packages (@modelcontextprotocol/ext-apps, ext-apps/react, ext-apps/app-bridge, ext-apps/server). Cross-client rendering differences exist.

**How to avoid:**
1. Build views as self-contained HTML files that ALSO work as standalone exports (v5.0 De Stijl pattern already does this)
2. ext-apps layer should wrap existing HTML generators, not replace them
3. Abstract communication in `lib/mcp/apps-bridge.cjs` -- if spec changes, only the bridge changes
4. HTML export = primary view mechanism. MCP Apps = progressive enhancement
5. Keep views under 500KB. Lazy-load data via tool callbacks
6. Test against multiple clients (Claude Desktop, VS Code)

**Warning signs:**
- Views render differently in Claude Desktop vs VS Code
- ext-apps publishes breaking change in minor version
- New MCP clients don't support Apps extension

**Phase to address:**
Phase 6 (MCP Apps Data Room Views) -- defer to last phase. By then spec will be more stable.

**Severity: MEDIUM** -- Existing HTML exports are the fallback. MCP Apps adds convenience, not capability.

---

## Minor Pitfalls

### Pitfall 10: Resource Subscription Memory Leak from File Watchers

**What goes wrong:** MCP resource subscriptions start chokidar watchers for room files. Clients subscribe but never unsubscribe. Watchers accumulate. MCP server memory grows unbounded.

**How to avoid:** Tie all watchers to MCP session lifecycle. Session end = cleanup. Max 50 watchers per session. Set TTL on subscriptions (auto-expire after 1 hour if not refreshed).

**Phase to address:** Phase 1 (MCP Foundation)

---

### Pitfall 11: Session State Leaks Between Cowork Users

**What goes wrong:** Two Cowork sessions share server-side state because session isolation is missing. Module-level variables in Node.js persist across requests.

**How to avoid:** Use `MCP-Session-Id` for all session-scoped data. Never store session state in module-level variables. Use filesystem for state (room/ directory), not in-memory.

**Phase to address:** Phase 2 (Surface Detection)

---

### Pitfall 12: MCP Apps Iframe Blocks Cytoscape.js Rendering

**What goes wrong:** MCP Apps sandboxed iframe may block Cytoscape.js WebGL, CDN script loading, or canvas operations.

**How to avoid:** Bundle Cytoscape.js inline (no CDN). Test in actual Cowork sandbox early. Have text-based graph fallback.

**Phase to address:** Phase 6 (MCP Apps Views)

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Duplicate intelligence logic in hooks AND MCP handlers | Ship faster without refactoring | Two codepaths diverge, bugs fixed in one not the other | Never -- extract to shared `intelligence-cascade.cjs` immediately |
| Hard-code Brain URL in tool handlers | Avoid config complexity | Can't switch Brain environments | Phase 1 only. Extract to config by Phase 2 |
| Skip graph write serialization | Avoid write queue complexity | Silent data loss under concurrent access | Never -- the lock is lightweight |
| Use conversation context for pipeline state | Chains work in demo | Breaks on compaction, lost on session restart | Phase 1 demo only. Room-file state by Phase 3 |
| Bundle all 64 commands in one router | Simple implementation | 34+ enum values = misrouting | Never -- split was needed at 49, worse at 64 |
| Same tool response format for all surfaces | One codepath | CLI users get verbose output Desktop doesn't need; Cowork misses hook intelligence | Phase 2 -- surface detection enables adaptive responses |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Brain MCP (remote) | Treating Brain response as required for tool execution | Brain is enrichment. 2s timeout, local fallback, cache results. Tool MUST work without it |
| KuzuDB (embedded) | Two processes opening same DB as READ_WRITE | Single write gateway. MCP server when running, CLI when not. File-based lock |
| Cowork scheduling | Assuming tasks always fire on schedule | Catch-up pattern: room stores intent, any session checks for overdue tasks |
| MCP Apps (ext-apps) | Rebuilding HTML views from scratch for MCP Apps | Wrap existing HTML generators. ext-apps is delivery, not the view engine |
| Chokidar watchers | Starting watchers for subscriptions and never cleaning up | Tie watchers to session lifecycle. Session end = cleanup. Max 50 per session |
| MCP transport | Building on Streamable HTTP for local use | stdio for Desktop/local. HTTP only for remote (future). Same McpServer supports both |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Intelligence cascade on every write | PostToolUse equivalent fires HSI + cross-ref + graph on every MCP write | Debounce: batch updates every 30s or on explicit trigger | >10 artifacts filed quickly (meeting pipeline) |
| Brain routing on every tool call | Each methodology tool queries Brain | Cache per room context hash, invalidate on STATE.md change only | 3+ tool calls in one conversation |
| Full room state in every response | `loadRoomState()` returns full STATE.md on every call | Return 5-field summary, full state via explicit `get-state` only | Room with >20 sections (>5KB STATE.md) |
| KuzuDB open-close per operation | Opens DB, runs query, closes for every single operation | Batch operations + connection pooling (keep open 5s after last write) | >50 graph ops per session |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Brain API key in tool response text | Key leaks into conversation history, visible to team | Brain client strips keys from all responses. Return intelligence, never credentials |
| Room paths exposing host filesystem | Cowork users see `/Users/jonathan/rooms/...` | Sanitize all paths to room-relative in tool responses |
| HTTP transport on 0.0.0.0 | Server accessible from network | Always bind 127.0.0.1. Use `createMcpExpressApp()` with DNS rebinding protection |
| Scheduled task prompts with secrets | Keys in Cowork scheduling system | Environment variables for keys. Task prompts reference room paths, not secrets |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Larry sounds different on Desktop vs CLI | Users notice personality inconsistency | Load identical Larry context on all surfaces |
| Tool names don't match CLI commands | User learns `/mos:lean-canvas`, Desktop has `methodology({command: 'lean-canvas'})` | Surface-specific help that translates between CLI and conversational modes |
| Pipeline steps need manual re-invocation on Desktop | CLI hooks auto-chain, Desktop doesn't | MCP responses include "next step" with exact tool call suggestion |
| Scheduled results appear without explanation | Daily briefing shows up, user doesn't know why | Prefix: "[Scheduled: Daily Briefing]" + what changed since last |
| De Bono analyses flood room | 6 hats x daily = 6 files/day | Single `daily-perspectives.md` with all 6 sections. Replace, don't accumulate |

## "Looks Done But Isn't" Checklist

- [ ] **MCP tool coverage:** All 64 commands have wrappers -- but do reference-only tools (return prompt text for Claude) produce useful output on Desktop where user sees raw markdown?
- [ ] **Intelligence cascade:** Tools file artifacts -- but does HSI + cross-ref + graph fire after MCP writes? Without hooks, probably not
- [ ] **Pipeline chaining:** Individual tools work -- but does scenario-plan -> root-cause -> causal-tracing chain without manual intervention on Desktop?
- [ ] **Larry personality:** Context loads -- but is it the full personality (mode engine, assessment philosophy, storytelling) or just compact?
- [ ] **Brain fallback:** Routing works online -- but does offline/timeout fallback produce reasonable decisions?
- [ ] **Graph write safety:** Operations work in isolation -- but what happens when CLI hooks and MCP server both write concurrently?
- [ ] **Scheduled catch-up:** Tasks configured -- but do missed tasks actually run on next session?
- [ ] **Surface detection:** Plugin detects CLI/Desktop/Cowork -- but does it correctly adapt (hook-based vs MCP-based intelligence)?
- [ ] **Router accuracy:** All commands reachable -- but does Claude select the right router+command for natural language requests?

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Hooks dead in Cowork (#1) | MEDIUM | Create `intelligence-cascade.cjs` shared module. Each MCP write-tool calls cascade. 2-3 day refactor |
| Router misrouting (#2) | LOW | Split routers, update groupings, test with Inspector. 1 day |
| KuzuDB contention (#3) | HIGH | Write gateway pattern + file lock + surface detection. 3-5 days |
| Brain timeout (#4) | LOW | 2s timeout + local heuristic fallback in brain-client.cjs. 1 day |
| Sandbox path access (#5) | MEDIUM | Bundle references inline OR copy to 00_Context/. Test-first. 1-2 days |
| Pipeline context (#6) | MEDIUM | pipeline-state.json + previous_step parameter. 2-3 days across tools |
| De Bono tokens (#7) | LOW | Redesign from 6 agents to 1 agent + 6 persona files. 1 day |
| Scheduled task failure (#8) | MEDIUM | Catch-up pattern in room/.scheduled-intelligence.json. 2 days |
| MCP Apps drift (#9) | LOW | Thin apps-bridge.cjs wrapper. HTML exports unaffected |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Hooks dead in Cowork (#1) | Phase 1: MCP Foundation | Every MCP write-tool triggers cascade. Test: file artifact via MCP, verify HSI + graph updated |
| Router accuracy (#2) | Phase 1: MCP Foundation | Each router <15 commands. Inspector test: 20 queries, <5% misroute |
| KuzuDB contention (#3) | Phase 2: Surface Detection | Simultaneous CLI hook + MCP write. Verify: no lock errors, both persisted |
| Brain unreachable (#4) | Phase 1: MCP Foundation | Kill Brain server, run 10 tools. All complete in <3s with local routing |
| Sandbox paths (#5) | Phase 2: Surface Detection | Deploy to Cowork VM. Verify: loadReference() + loadLarryContext() return content |
| Pipeline context (#6) | Phase 3: Pipeline Chaining | Run 5-step pipeline on Desktop. Each step builds on previous without manual context |
| De Bono tokens (#7) | Phase 5: De Bono Hats | analyze-perspectives: <15K total tokens, single subagent |
| Scheduled tasks (#8) | Phase 4: Scheduled Intelligence | Close Desktop overnight. Reopen. Overdue tasks run automatically |
| MCP Apps spec (#9) | Phase 6: MCP Apps Views | HTML export standalone. Apps wrapper <100 lines |
| File watchers (#10) | Phase 1: MCP Foundation | Start/stop 10 sessions. Memory stable, no leaked watchers |
| Session leaks (#11) | Phase 2: Surface Detection | Two concurrent sessions. Verify isolated room state |
| Cytoscape iframe (#12) | Phase 6: MCP Apps Views | Graph renders in actual Cowork sandbox, not just local browser |

## Sources

- [GitHub #27398: Cowork plugin hooks never fire](https://github.com/anthropics/claude-code/issues/27398) -- `--setting-sources user` excludes plugin-scoped hooks. Confirmed, closed as duplicate. [HIGH confidence]
- [MCP Token Limits: Hidden Cost of Tool Overload](https://deploystack.io/blog/mcp-token-limits-the-hidden-cost-of-tool-overload) -- Avg tool = 300-600 tokens, degradation above 50 tools, hierarchical routing = 98% reduction. [HIGH confidence]
- [KuzuDB Concurrency docs](https://docs.kuzudb.com/concurrency/) -- Single READ_WRITE instance enforced via file permission flags. [HIGH confidence]
- [Vela-Engineering KuzuDB fork](https://www.vela.partners/blog/kuzudb-ai-agent-memory-graph-database) -- Multi-writer fork exists. Non-standard dependency. [MEDIUM confidence]
- [Cowork scheduled tasks](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-cowork) -- Tasks only run when Desktop open + computer awake. [HIGH confidence]
- [MCP Apps ext-apps](https://github.com/modelcontextprotocol/ext-apps/) -- Spec 2026-01-26 stable, draft for future. 4 SDK packages. [HIGH confidence]
- [GitHub #43397, #32000, #36327](https://github.com/anthropics/claude-code) -- MCP connectors not loading in scheduled tasks. [HIGH confidence]
- [GitHub #41461: Background agents cannot be stopped](https://github.com/anthropics/claude-code/issues/41461) -- Massive token waste from unstoppable agents. [HIGH confidence]
- [Cowork sandbox architecture](https://pvieito.com/2026/01/inside-claude-cowork) -- VZVirtualMachine, only mounted folders accessible. [HIGH confidence]
- [MCP stateless execution](https://www.getknit.dev/blog/advanced-mcp-agent-orchestration-chaining-and-handoffs) -- State must be managed externally. [HIGH confidence]
- [Claude Code sandboxing docs](https://code.claude.com/docs/en/sandboxing) -- Filesystem isolation to cwd. [HIGH confidence]
- [Cowork security guide](https://www.harmonic.security/resources/securing-claude-cowork-a-security-practitioners-guide) -- Network restricted, folder mounting only. [MEDIUM confidence]

---
*Pitfalls research for: CLI-to-MCP+Cowork adaptation of MindrianOS v1.8.0*
*Researched: 2026-04-05*
