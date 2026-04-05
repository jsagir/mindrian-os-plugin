# Project Research Summary

**Project:** MindrianOS Plugin — v1.8.0 Cowork Adaptation
**Domain:** Multi-surface MCP plugin with persistent intelligence (CLI + Desktop + Cowork)
**Researched:** 2026-04-05
**Confidence:** HIGH

## Executive Summary

MindrianOS v1.8.0 extends an already-shipped 64-command CLI plugin into a full Desktop and Cowork product. The core challenge is not building new features — it is adapting existing intelligence (9 hooks, PostToolUse cascade, Brain-driven routing, LazyGraph, methodology pipelines) to a fundamentally different execution model. On CLI, the product is hook-driven. On Desktop and Cowork, hooks are permanently dead (confirmed Anthropic bug #27398: `--setting-sources user` excludes plugin-scoped hooks silently). The MCP protocol is the only surface available, and every piece of intelligence that CLI users receive automatically must be re-wired to fire through MCP tool handlers. This adaptation requires a single critical refactor — extract all intelligence triggers into a shared `intelligence-cascade.cjs` module called by both hook scripts AND MCP tool write-handlers. Without this, Cowork users get a hollow shell that appears to work while intelligence silently stops firing.

The recommended approach follows a strict phase order driven by dependency: surface detection first (enables all conditional logic), orphaned command registration second (unblocks Desktop/Cowork usability — 15 commands are currently invisible on non-CLI surfaces), Brain-driven routing third (the moat, the differentiator), then scheduled intelligence and De Bono hats (the persistent layer), and MCP Apps views last (highest effort, most immature spec). Stack changes are minimal — one SDK upgrade (`@modelcontextprotocol/sdk` 1.27.1 to 1.29.0, required as peer dependency of `ext-apps`) and one new package (`@modelcontextprotocol/ext-apps@1.5.0`, used only in the final phase). SSE transport is permanently deprecated as of April 1, 2026; Streamable HTTP is the mandatory replacement for Cowork connectivity.

The dominant risk across all four critical pitfalls is silent failure. Hooks die without error. KuzuDB writes contend without error. Brain timeouts block without fallback. Router misrouting succeeds with wrong results. Prevention requires: shared cascade module (not two codepaths), promise-chain write serialization in `graph-ops.cjs` (~30 lines), 2-second hard Brain timeout with local fallback heuristic, and router splitting to keep each enum group under 15 commands. All four are low-to-medium recovery cost if addressed in Phase 1 — trust-destroying if discovered after users rely on the product.

---

## Key Findings

### Recommended Stack

The existing stack is sound and requires minimal change. The SDK upgrade to 1.29.0 is mandatory — not for features but as a hard peer dependency of `@modelcontextprotocol/ext-apps`. It also unlocks `StreamableHTTPServerTransport`, which replaces the now-deprecated SSE transport (SSE connections stopped being accepted April 1, 2026). All other existing packages (express@5.1.0, chokidar@4.0.3, kuzu@0.11.3, flexsearch@0.7.43, zod@^3.25) remain unchanged. The `ext-apps` package is the only genuinely new dependency, and it is needed only for Phase 6 MCP Apps views — implement as a graceful-degradation optional require so the server runs without it.

**Core technologies:**
- `@modelcontextprotocol/sdk@^1.29.0`: SDK upgrade only — unlocks Streamable HTTP transport, MCP Apps compatibility, session management; mandatory peer dep for ext-apps
- `@modelcontextprotocol/ext-apps@^1.5.0`: Interactive UI in conversation — `registerAppTool` / `registerAppResource`, vanilla JS, no React required; defer to Phase 6 only
- `express@5.1.0` (installed): Streamable HTTP endpoint via `createMcpExpressApp()` with DNS rebinding protection — already installed, no change
- `chokidar@4.0.3` (installed): File watching for resource subscription cleanup — already proven in this project
- `kuzu@0.11.3` (installed): LazyGraph embedded graph — requires write queue serialization (~30 lines) to be safe under concurrent MCP access

**Transport strategy:** stdio for Desktop (zero-config, spawned as child process via `claude_desktop_config.json`), Streamable HTTP on `127.0.0.1:3847` for Cowork (env-gated via `MINDRIAN_TRANSPORT=http`). Same `McpServer` instance serves both transports via env detection in `surface-detect.cjs`.

**What NOT to add:** node-cron (Cowork has built-in scheduler), ws/socket.io (MCP Streamable HTTP handles SSE push already), React/Next.js (De Stijl views are vanilla HTML/JS — no build step), any state management library (room/ IS the state store per ICM principle), `@modelcontextprotocol/sdk@2.0.0-alpha` (breaking changes: TaskManager refactor, Standard Schema replaces Zod, WebSocket removed).

**Total new packages: 1** (`@modelcontextprotocol/ext-apps`). **Total upgrades: 1** (SDK 1.27.1 to 1.29.0). **Total removed: 0**.

### Expected Features

The 15 currently orphaned commands — act, causal, dashboard, find-analogies, models, present, publish, query, reanalyze, rooms, scout, speakers, wiki, splash, admin — are table stakes. Desktop and Cowork users have NO slash commands; MCP tools are their only interface. Missing 15 of 64 commands means the product is visibly broken. Surface auto-detection via MCP `initialize` handshake's `clientInfo.name` field is a zero-cost unlock that enables all conditional behavior. Brain-driven routing as a proper MCP tool (`orchestration` router) is the product's moat — it must be accessible from Cowork, not just CLI.

**Must have (table stakes):**
- 15 orphaned commands registered in 2 new routers (`orchestration` + expanded `export`) — Desktop/Cowork users have NO slash commands; MCP tools are their only interface
- Surface auto-detection (CLI/Desktop/Cowork) — detect via `clientInfo.name` in `server.oninitialized`; users install once, plugin adapts
- Standardized tool output shapes with `## Suggested Next` — enables LLM-orchestrated chaining; each tool tells Claude what to call next
- Brain-driven routing as `orchestration` router MCP tool — the moat, must work from all surfaces with 3-tier fallback
- Hook-to-MCP equivalence via `intelligence-cascade.cjs` shared module — without this, Cowork users get a hollow shell
- Graceful degradation at Tier 0 (no Brain, no internet) — already built for CLI; must extend through all MCP wrappers
- Daily room briefing scheduled task — first differentiating moment for Cowork users

**Should have (competitive differentiators):**
- De Bono 6 persistent hats — cross-session memory IS the differentiator; NOT 6 separate agents (token catastrophe per Pitfall 7), but 6 persona files loaded sequentially by one subagent, state in `room/.mindrian/hats/`
- Prediction deadline tracking scheduled task — unique intelligence nobody else surfaces
- Session catch-up pattern — missed scheduled runs execute on next manual session; makes scheduling a convenience, not a dependency
- KuzuDB write queue serialization — prevents silent graph data loss under concurrent MCP + CLI access

**Defer (v2+):**
- MCP Apps Data Room views (dashboard/wiki/graph as inline iframes) — highest effort, spec still maturing; existing HTML exports are the always-working fallback
- Cross-user intelligence — requires Anthropic team sharing features not yet available
- Real-time push via MCP resource subscriptions — no Claude client implements the subscription protocol yet; build when spec ships, not before

### Architecture Approach

The architecture is an expansion of the existing 6-router hierarchical MCP tool structure to 8 routers. Two new files (`surface-detect.cjs` ~40 lines, `brain-router.cjs` ~150 lines) and one critical refactor (`intelligence-cascade.cjs`) unlock the rest. The principle throughout: the MCP orchestration layer RECOMMENDS, existing `lib/core/*` modules EXECUTE. No methodology logic is duplicated — Claude (on Desktop/Cowork) reads the Brain's recommendation and invokes existing methodology/analysis routers. The `intelligence-cascade.cjs` refactor is the single highest-leverage change in the entire milestone; it prevents the "looks done but isn't" failure mode that would otherwise appear only after users lose trust.

**Major components:**
1. `lib/mcp/surface-detect.cjs` (NEW ~40 lines) — detects CLI/Desktop/Cowork from env signals (`MINDRIAN_TRANSPORT`, `CLAUDE_SURFACE`, `COWORK_SESSION_ID`, `/sessions` dir); gates all conditional registration
2. `lib/mcp/brain-router.cjs` (NEW ~150 lines) — wraps `brain-client.cjs` + `state-ops.cjs`; 3-tier routing: cache hit (instant) / local heuristic from `problem-types.md` (<100ms) / Brain query (2s hard timeout then fallback)
3. `lib/core/intelligence-cascade.cjs` (NEW) — shared module called by both CLI hooks AND MCP tool write-handlers; HSI computation, cross-reference scan, graph indexing; same logic, two entry points
4. `lib/mcp/tasks.cjs` (NEW ~120 lines) — MCP Tasks for long-running operations on Cowork: scout (~60s), reanalyze (~30s), act-swarm (~120s)
5. `lib/mcp/session-catchup.cjs` (NEW ~100 lines) — reads `room/.mindrian/last-session.json` on server init, computes delta, queues overdue tasks; resilient to scheduling failures
6. `lib/mcp/apps.cjs` (NEW ~200 lines, Phase 6 only) — MCP Apps registration via `ext-apps`; thin delivery wrapper over existing De Stijl HTML generators; not the view engine itself
7. `lib/mcp/tool-router.cjs` (MODIFY +~300 lines) — expand from 6 to 8 routers; split `data_room` into `room_state` / `room_content` / `room_graph` to keep all enums under 15 commands
8. `lib/core/graph-ops.cjs` (MODIFY +~30 lines) — promise-chain write queue; serializes all writes through async queue; concurrent reads unaffected

**Filesystem persistence model (ICM principle — room IS the state):** Hat state in `room/.mindrian/hats/{color}/STATE.md`. Session state in `room/.mindrian/last-session.json`. Pipeline state in `room/.mindrian/pipeline-state.json`. Brain cache in `room/.mindrian/brain-cache.json`. No in-memory state that doesn't also live in the room. No new databases.

### Critical Pitfalls

1. **Hooks are dead in Cowork (Confirmed Anthropic bug #27398)** — Cowork spawns Claude CLI with `--setting-sources user`, which silently excludes plugin-scoped hooks. All 9 hooks (SessionStart, PostToolUse, FileChanged, etc.) are dead. Prevention: extract ALL intelligence triggers into `intelligence-cascade.cjs`; call it from every MCP write-tool handler. This is not optional — it IS the product differentiator.

2. **Router misrouting from oversized enums** — Claude tool selection accuracy degrades above ~15 commands per router. Current `data_room` router has 34 commands and already misroutes ~15% of the time. Adding 15 orphans without splitting makes it worse. Prevention: split `data_room` into 3 sub-routers; add 2 new routers; keep ALL groups under 15 commands. Target: 8-10 routers, 5-12 commands each. Must be done before adding any new commands.

3. **KuzuDB single-writer contention** — CLI hooks and MCP server are separate Node.js processes; both call `lazygraph.openGraph()` with READ_WRITE access; the loser fails silently (no error, just lost writes). Prevention: promise-chain write queue in `graph-ops.cjs` (~30 lines); file-based PID lock at `room/.graph/write.lock`. Must be done before any concurrent CLI + MCP usage.

4. **Brain unreachable = routing brick wall** — Brain runs on Render free tier (sleeps after 15 min idle, 10-30s cold start). v1.8.0 elevates Brain from "optional enrichment" to "routing oracle," making every `act`/`suggest-next` call a potential 30-second block. Prevention: 2-second hard timeout, 3-tier routing (cache / local heuristic / Brain), pre-warm ping on server start (async, non-blocking), Brain NEVER required for any tool to function.

5. **Cowork sandbox path access for plugin references** — Cowork VM only mounts user-selected folders; `references/methodology/*.md` and `references/personality/*.md` may be inaccessible via `__dirname`-relative paths even though the server process itself runs. Prevention: TEST THIS FIRST before any other Cowork work; if it fails, copy essential references to `room/00_Context/` during `/mos:setup` (pattern already exists in Cowork projects).

---

## Implications for Roadmap

Based on the combined research, 6 phases are recommended. The dependency graph from FEATURES.md is the primary ordering signal: surface detection unlocks everything else; tool parity unlocks chaining and Brain routing; Brain routing unlocks scheduled intelligence; scheduled intelligence provides infrastructure for De Bono hats; MCP Apps is a parallel track requiring only tool parity. The `intelligence-cascade.cjs` refactor in Phase 1 is non-negotiable — it is cheaper now than after users discover the hollow shell.

### Phase 1: MCP Foundation
**Rationale:** Three of four critical pitfalls (hooks dead, router accuracy, Brain timeout) must be resolved before any other work delivers user value. Surface detection enables all conditional logic. This phase creates the trusted infrastructure all later phases build on.
**Delivers:** All 64 commands exposed on Desktop/Cowork via 8 routers; `intelligence-cascade.cjs` shared module firing on all MCP writes; router accuracy verified via MCP Inspector (20 natural language queries, <5% misroute rate); Brain routing resilient with 2-second hard timeout and local fallback; file watcher subscription cleanup (Pitfall 10)
**Addresses:** Surface auto-detection, 15 orphaned commands, standardized tool output shapes, Hook-to-MCP equivalence, Tier 0 graceful degradation
**Avoids:** Pitfalls 1 (hooks dead), 2 (router misrouting), 4 (Brain timeout), 10 (resource subscription memory leak)
**Research flag:** Standard patterns — well-documented MCP SDK, verified codebase integration points. Skip research-phase.

### Phase 2: Surface Detection + Write Safety
**Rationale:** KuzuDB write contention (Pitfall 3) and sandbox path access (Pitfall 5) must be resolved before Cowork users can file any artifacts safely. Session isolation (Pitfall 11) must be established before multi-session testing begins.
**Delivers:** `surface-detect.cjs` module; write queue in `graph-ops.cjs`; Cowork path access verified and adapted; `MCP-Session-Id` session isolation; dual transport architecture in `bin/mindrian-mcp-server.cjs`
**Uses:** Streamable HTTP via SDK 1.29.0 `StreamableHTTPServerTransport`; `createMcpExpressApp()` for DNS rebinding protection; existing `express@5.1.0`
**Implements:** stdio for Desktop (zero-config), Streamable HTTP on `127.0.0.1:3847` for Cowork (env-gated); surface-adaptive reference loading
**Avoids:** Pitfalls 3 (KuzuDB contention), 5 (sandbox paths), 11 (session state leaks)
**Research flag:** Cowork sandbox path behavior requires empirical verification — deploy minimal `fs.readFileSync(__dirname + '/references/...')` test before building the phase. One known unknown that cannot be resolved without deployment.

### Phase 3: Pipeline Chaining
**Rationale:** Pipeline chaining (the Week 7 pattern: scenario -> root-cause -> causal -> prediction) is the core methodology value. Without it, Desktop/Cowork users have 64 disconnected tools rather than a methodology system. Requires Phase 1 tool parity and standardized output shapes.
**Delivers:** `room/.mindrian/pipeline-state.json` tracking current pipeline position; `previous_step` optional parameter on methodology tools; every tool response includes actionable `## Suggested Next` with exact tool call syntax; structured chaining between methodology and analysis routers
**Implements:** Room-file-based pipeline state (stateless MCP calls chain through room artifacts, not conversation context — enforces Decision #7)
**Avoids:** Pitfall 6 (pipeline context loss across stateless MCP tool calls)
**Research flag:** Standard patterns — enforces existing Decision #7 (pipelines chain through Room). Skip research-phase.

### Phase 4: Scheduled Intelligence
**Rationale:** Daily briefing and prediction deadline tracking are the first Cowork-exclusive differentiators — the "Larry thinks while you sleep" moment. Requires Phase 1 tool parity (briefing calls existing MCP tools) and Phase 2 write safety (briefing writes to room/).
**Delivers:** Daily room briefing (9am SKILL.md scheduled task), prediction deadline tracker (daily), room health monitor (daily), competitor watch (weekly), `session-catchup.cjs` for missed-run recovery
**Uses:** Cowork built-in task scheduler via SKILL.md files (no node-cron); `room/.mindrian/last-session.json`; existing `proactive-intelligence.cjs` and `state-ops.cjs`
**Implements:** Catch-up architecture — stored scheduling intent in room, checked on every session start regardless of scheduler reliability; idempotent briefing generation (runs twice produces same output)
**Avoids:** Pitfall 8 (scheduled task unreliability — catch-up pattern makes scheduling a convenience, not a dependency); known MCP connector bug (#43397) mitigated by `~/.claude/mcp.json` configuration
**Research flag:** Cowork scheduler MCP connector bugs (#43397, #32000, #36327) are active with no resolution timeline. Mitigation pattern documented. No additional research needed; monitor during testing.

### Phase 5: De Bono Persistent Hats
**Rationale:** De Bono hats are the cross-session perspective memory differentiator, but must be built correctly. Naive 6-agent implementation would multiply token usage 6x (Pitfall 7, confirmed issue #41461). Requires Phase 4 scheduled intelligence as infrastructure for nightly hat runs.
**Delivers:** 6 hat persona files (`room/.mindrian/hats/{color}/STATE.md`); sequential single-subagent analysis (one agent loads 6 persona files, NOT 6 separate agents); single `daily-perspectives.md` replacing not accumulating; hat state feeding `brain-router.cjs` recommendations (black hat risks, yellow hat opportunities, blue hat methodology effectiveness)
**Implements:** Persona-file-based hat architecture; cross-session memory via filesystem accumulation; hat outputs as Brain enrichment input per moat mandate
**Avoids:** Pitfall 7 (De Bono token catastrophe — one agent + 6 persona files, NOT 6 persistent processes; each hat analysis <5K tokens total)
**Research flag:** Hat-triggered cascade detection (hats noticing cross-section contradictions) is Phase 5b and has no existing codebase precedent. May need additional design research before implementation.

### Phase 6: MCP Apps Data Room Views
**Rationale:** Highest implementation effort, most visually impressive, most immature spec. Defer until Phases 1-5 are production-proven. HTML exports are the always-working fallback — MCP Apps is progressive enhancement, not new capability.
**Delivers:** Dashboard (De Stijl Mondrian grid), wiki (section navigation), knowledge graph (Cytoscape) rendered inline in Claude conversation; read-only first, bidirectional tool calls from iframe as Phase 6b
**Uses:** `@modelcontextprotocol/ext-apps@1.5.0` (`ext-apps/server` subpackage only — no React peer dep); existing De Stijl HTML generators wrapped, not replaced; Cytoscape.js bundled inline (no CDN due to iframe CSP restrictions)
**Implements:** `lib/mcp/apps.cjs` as thin delivery wrapper; HTML export remains primary view mechanism; MCP Apps layer adds <100 lines via `apps-bridge.cjs` abstraction
**Avoids:** Pitfall 9 (MCP Apps spec drift — HTML exports unaffected by any spec change), Pitfall 12 (Cytoscape iframe CSP blocking — bundle inline, test in actual Cowork VM, not just local browser)
**Research flag:** MCP Apps rendering in actual Cowork VM sandbox requires empirical testing — cross-client rendering differences documented. Test in real Cowork sandbox at phase start before completing any implementation.

### Phase Ordering Rationale

- Phases 1-2 are a hard prerequisite gate. Nothing shipped on Cowork is trustworthy until `intelligence-cascade.cjs` fires on MCP writes and KuzuDB writes are safe. The hollow shell failure mode is invisible — users won't know intelligence stopped; they'll just notice Larry "seems dumber."
- Phase 3 (pipeline chaining) can run in parallel with Phase 4 if capacity allows — both depend on Phase 1 tool parity but not on each other.
- Phases 4-5 form a scheduled intelligence stack where each phase provides infrastructure the next requires. Phase 5 cannot precede Phase 4.
- Phase 6 is explicitly the last phase and can be started in parallel with Phase 5 on a separate track if capacity allows, since it depends only on Phase 1 tool parity.
- The `intelligence-cascade.cjs` refactor is the single highest-leverage commit in the roadmap. It prevents the most trust-destroying failure mode and costs 1-2 days to do correctly versus 3-5 days to retrofit after discovery.

### Research Flags

Phases needing deeper research during planning:
- **Phase 2:** Cowork sandbox path accessibility for `__dirname`-relative `references/` files — empirical test required before implementation. Deploy a 10-line test MCP server to Cowork VM and verify `loadReference()` returns content. This is the single most critical unknown in the entire roadmap.
- **Phase 6:** MCP Apps rendering behavior in actual Cowork VM sandbox — spec is stable but cross-client rendering differences are documented. Run a minimal `registerAppTool` test in real Cowork before completing the phase.
- **Phase 5b (hat cascade detection):** Hat-triggered cross-section contradiction detection has no existing codebase precedent. May need design research before Phase 5b implementation.

Phases with standard patterns (skip research-phase):
- **Phase 1:** MCP SDK tool registration, router hierarchy, surface detection — fully documented with verified codebase examples. The existing 6-router pattern is the blueprint; this is an expansion, not a redesign.
- **Phase 3:** Pipeline chaining — enforces existing Decision #7, uses `room/` filesystem as state store per ICM principle. Standard pattern.
- **Phase 4:** Cowork scheduled tasks + catch-up pattern — fully documented in official Cowork help. Workarounds for known bugs verified. SKILL.md format is established.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | SDK 1.29.0 and ext-apps 1.5.0 verified via npm registry April 5 2026. Peer deps confirmed via `npm view`. SSE deprecation date confirmed (April 1, 2026). |
| Features | HIGH | MCP spec verified, Cowork scheduled task format verified, surface detection mechanism verified via official MCP initialize handshake docs. 15 orphaned commands identified via direct codebase inspection. |
| Architecture | HIGH | Based on direct codebase reading of `tool-router.cjs`, `brain-client.cjs`, `graph-ops.cjs`. Component sizes estimated from actual module patterns. Build order validated against dependency analysis. |
| Pitfalls | HIGH | Critical pitfalls verified against confirmed GitHub issues (#27398, #43397, #41461), KuzuDB concurrency docs, MCP token budget research, and direct codebase state inspection. |

**Overall confidence:** HIGH

### Gaps to Address

- **Cowork VM `__dirname` path resolution:** Cannot be confirmed without deployment. PITFALLS.md correctly says "test this first." Treat as an unknown until Phase 2 empirical test. The fix (copy references to `room/00_Context/` during setup) is ready if needed.
- **MCP Apps iframe CSP in Cowork sandbox:** Cytoscape.js CDN loading may be blocked. Bundle-vs-CDN decision must be made after testing in actual Cowork VM. Bundling inline is the safer default.
- **Cowork scheduler MCP connector bug scope:** Bugs #43397 and #32000 are filed but resolution timeline unknown. The catch-up pattern mitigates but does not eliminate the risk if `~/.claude/mcp.json` workaround also fails.
- **Brain cold start pre-warm timing:** The pre-warm `/health` ping on MCP server start must be async and fire-and-forget. A synchronous pre-warm would itself block server initialization by ~30s on cold start. Must not block `server.connect()`.
- **`ext-apps` draft spec evolution:** A draft spec exists alongside the stable 2026-01-26 spec. If a breaking `1.6.0` releases between Phase 1 and Phase 6, `apps-bridge.cjs` abstraction is the insurance. Keep the wrapper thin.

---

## Sources

### Primary (HIGH confidence)
- [@modelcontextprotocol/sdk npm](https://www.npmjs.com/package/@modelcontextprotocol/sdk) — v1.29.0 latest stable, peer deps, Node >=18 requirement; verified April 5 2026
- [@modelcontextprotocol/ext-apps npm](https://www.npmjs.com/package/@modelcontextprotocol/ext-apps) — v1.5.0, peer dep on SDK ^1.29.0, React optional confirmed via peerDependenciesMeta
- [MCP Apps official spec](https://modelcontextprotocol.io/docs/extensions/apps) — ui:// scheme, sandboxed iframe, bidirectional JSON-RPC, security model; stable Jan 2026
- [MCP Apps blog post](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) — launch announcement, supported clients, technical architecture
- [ext-apps GitHub + Quickstart](https://apps.extensions.modelcontextprotocol.io/api/documents/Quickstart.html) — registerAppTool, registerAppResource, RESOURCE_MIME_TYPE; vanilla JS example verified
- [TypeScript SDK server docs](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md) — Streamable HTTP, dual transport, session management
- [Claude Cowork help center](https://support.claude.com/en/articles/13345190-get-started-with-cowork) — VM sandbox, folder mount constraints, MCP bridging
- [Cowork scheduled tasks docs](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-cowork) — SKILL.md format, catch-up behavior, constraints
- [GitHub #27398](https://github.com/anthropics/claude-code/issues/27398) — Cowork plugin hooks never fire, `--setting-sources user` confirmed, closed as duplicate
- [GitHub #43397, #32000, #36327](https://github.com/anthropics/claude-code) — MCP connectors not loading in scheduled tasks
- [GitHub #41461](https://github.com/anthropics/claude-code/issues/41461) — background agents cannot be stopped, massive token waste confirmed
- [KuzuDB concurrency docs](https://docs.kuzudb.com/concurrency/) — single READ_WRITE instance enforced via file permission flags; multi-process contention behavior
- [Inside Claude Cowork VM](https://pvieito.com/2026/01/inside-claude-cowork) — VirtioFS, bubblewrap sandbox, /sessions directory marker, folder mount constraints
- [Build custom connectors via remote MCP](https://support.claude.com/en/articles/11503834-build-custom-connectors-via-remote-mcp-servers) — remote servers added via Settings > Integrations (not JSON config)
- Existing codebase: `lib/mcp/tool-router.cjs` (6 routers, 49 commands), `lib/core/brain-client.cjs`, `lib/core/graph-ops.cjs` — verified by direct code reading

### Secondary (MEDIUM confidence)
- [MCP Streamable HTTP deep dive](https://www.claudemcp.com/blog/mcp-streamable-http) — SSE deprecation date, Streamable HTTP replacement; April 1 2026 cutoff
- [MCP Token Limits: Hidden Cost of Tool Overload](https://deploystack.io/blog/mcp-token-limits-the-hidden-cost-of-tool-overload) — ~15-20 enum accuracy threshold, 300-600 tokens per tool definition
- [Cowork security guide](https://www.harmonic.security/resources/securing-claude-cowork-a-security-practitioners-guide) — network restrictions, folder mounting behavior
- [MCP stateless execution](https://www.getknit.dev/blog/advanced-mcp-agent-orchestration-chaining-and-handoffs) — state must be managed externally, pipeline state design

### Tertiary (LOW confidence)
- [ccleaks KAIROS analysis](https://ccleaks.com) — background agent, autoDream, always-on memory consolidation; NOT shipped, do not build against; MindrianOS room artifacts are KAIROS-compatible (plain files, MCP tools as API surface) but no code dependency on KAIROS
- [Vela-Engineering KuzuDB fork](https://www.vela.partners/blog/kuzudb-ai-agent-memory-graph-database) — multi-writer fork exists as fallback if promise-chain queue proves insufficient; adds non-standard dependency, use only as last resort

---
*Research completed: 2026-04-05*
*Ready for roadmap: yes*
