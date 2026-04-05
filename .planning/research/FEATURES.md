# Feature Research: v1.8.0 Cowork Adaptation

**Domain:** MCP-native methodology routing, persistent intelligence, and interactive UI for Claude Desktop/Cowork
**Researched:** 2026-04-05
**Confidence:** HIGH (MCP spec verified, Cowork scheduled tasks verified, surface detection verified)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist when a plugin claims Desktop/Cowork support. Missing any of these = the product feels broken on non-CLI surfaces.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Full MCP tool parity (15 orphaned commands)** | Desktop/Cowork users have NO slash commands. MCP tools are their ONLY interface. 15 commands (act, causal, dashboard, find-analogies, models, present, publish, query, reanalyze, rooms, scout, speakers, wiki, splash, admin) are invisible. | MEDIUM | Add 2 new routers (`autonomous`, `admin`) to existing 6. Keep total at 8. Expand Zod schemas with explicit parameters per router (act needs `mode`, scout needs `task`, present needs `format`). |
| **Surface auto-detection** | Users install once from marketplace. They should never manually declare "I am on Desktop." `/mos:setup` must detect CLI vs Desktop vs Cowork automatically. | LOW | MCP `initialize` handshake sends `clientInfo.name`: `"claude-desktop"` for Desktop, `"claude-code"` for CLI. Cowork = Desktop + `00_Context/` directory present or Cowork-specific env. Server captures clientInfo in `server.oninitialized` callback. |
| **Pipeline chaining via MCP** | The Week 7 pattern (scenario -> root-cause -> causal -> prediction) is the product's core methodology value. If this breaks on Desktop, the product is hollow. | MEDIUM | MCP chaining is LLM-orchestrated, not server-orchestrated. LLM reads Tool A output, decides to call Tool B. Works naturally IF every tool returns structured output with `## Suggested Next` section. Standardize all tool output shapes. |
| **Brain-driven routing as MCP tool** | The moat IS Brain-driven framework selection. Without it, Desktop/Cowork gets dumb routing. `/mos:act` already does this on CLI via `brain-client.cjs`. | MEDIUM | The MCP `autonomous` router calls the same `brain-client.cjs`. Local fallback = `references/methodology/problem-types.md` routing table. Already built for CLI Tier 0 degradation. |
| **Hook-to-MCP equivalence** | CLI hooks (SessionStart, PostToolUse, FileChanged) do not exist on Desktop/Cowork. Features depending on hooks must have MCP-native alternatives or the product silently loses half its intelligence. | MEDIUM | SessionStart equivalent = first tool call detection in MCP server (set flag, run room analysis). PostToolUse equivalent = Desktop Scheduled Tasks polling for changes. FileChanged = scheduled task checking room mtime. |
| **Graceful degradation without Brain** | Desktop/Cowork users may not have MINDRIAN_BRAIN_KEY configured. Every MCP tool must work at Tier 0. | LOW | Already built for CLI. Verify the same code path fires through MCP wrappers. No new work if `lib/core/*` is properly shared. |

**Dependencies on existing infra:** `lib/core/*.cjs` shared modules, `lib/mcp/tool-router.cjs` (6 routers), `lib/core/brain-client.cjs`, `commands/*.md` (64 total). All table stakes are wiring work - connecting existing core logic to MCP surface.

### Differentiators (Competitive Advantage)

Features that create the "no other Claude plugin does this" moment. Not expected, but create lock-in and deepen the MWP moat.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **De Bono Persistent Hats (6 always-on perspective agents)** | Every artifact automatically gets 6 perspectives. Black Hat catches risks nobody asked about. Yellow Hat spots opportunities. Blue Hat orchestrates. No other plugin provides persistent multi-perspective analysis that survives across sessions. | HIGH | Cowork primary, Desktop degraded, CLI hook-driven. Implementation: 6 Desktop Scheduled Task SKILL.md files (one per hat), staggered nightly runs. Memory in `room/.hats/{color}/memory.json`. Morning briefing aggregator at 9am. Cross-session memory IS the differentiator. |
| **MCP Apps Data Room Views (interactive UI in conversation)** | Users see the De Stijl Mondrian dashboard, wiki, and knowledge graph INSIDE Claude rather than in a separate browser tab. Context preserved alongside the conversation that generated it. No context-switching. | VERY HIGH | Tools declare `_meta.ui.resourceUri` pointing to `ui://mindrian-os/dashboard`. Host renders bundled HTML in sandboxed iframe. Bidirectional: iframe calls MCP tools via postMessage JSON-RPC. Requires `@modelcontextprotocol/ext-apps` SDK. Existing HTML templates in `room/exports/presentation/` are the starting point. |
| **Cowork Scheduled Intelligence** | Larry produces a morning briefing from overnight room changes, approaching prediction deadlines, and new contradictions. The room "thinks while you sleep" (when computer is on). | MEDIUM | 4 Desktop Scheduled Tasks: daily briefing (9am), prediction deadline tracker (daily), competitor watch (weekly), room health monitor (daily). Pure SKILL.md prompt files calling existing MCP tools. Zero new libraries. |
| **Brain-driven tool chaining recommendations** | Brain doesn't just select ONE framework - it recommends a CHAIN of frameworks with ordering rationale. `CO_OCCURS` and `ADDRESSES_PROBLEM_TYPE` relationships encode 30+ years of teaching intelligence about what sequences work. | MEDIUM | Expose existing `/mos:act` chain mode via MCP `autonomous` router. Brain Cypher query returns ordered framework chain. Room context (STATE.md summary) feeds the query. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **KAIROS-style persistent daemon** | "Larry never sleeps" sounds amazing | KAIROS is unshipped Anthropic internal (source leak). Building our own daemon fights the platform and may conflict with future official release. | Desktop Scheduled Tasks are the sanctioned pattern. They persist across restarts, catch up on missed runs, and have full MCP access. |
| **Real-time push via MCP resource subscriptions** | Live-updating dashboard feels modern | MCP resource subscriptions are NOT implemented by any Claude client (Desktop, Cowork, Claude.ai). Building push is dead code. | Desktop Scheduled Tasks poll periodically. MCP Apps can call `tools/call` from iframe on user interaction for on-demand refresh. |
| **Flat tool registration (64 tools)** | Simplest architecture | Consumes 30-60K context tokens vs 5000 budget. LLM reasoning quality degrades catastrophically with too many tool options. | Hierarchical router: 8 routers with `z.enum()` sub-commands. Proven at 49 commands, scales to 64. |
| **React/Next.js for MCP App views** | Modern web dev comfort | Build step, massive deps, bundle size. De Stijl views are self-contained HTML+CSS+JS. MCP Apps spec explicitly supports vanilla JS. | Vanilla JS + CDN libs (Cytoscape, D3). Inline in `ui://` resource responses. MCP Apps examples include vanilla JS starter. |
| **WebSocket live dashboard** | Real-time metrics feel polished | Sandboxed MCP App iframes communicate via postMessage only. WebSocket to external server violates CSP. | MCP Apps bidirectional postMessage. Iframe calls `tools/call` to fetch fresh data on demand. |
| **Cross-user intelligence in v1.8** | Team patterns would be powerful | Requires Anthropic team sharing (not yet available). Privacy controls nonexistent for cross-user data. | Defer to v2.0. Room-level patterns only. Build artifact structure KAIROS-ready for eventual background agent consumption. |
| **State outside room/ directory** | Simpler to store hat memory in ~/.config | Breaks ICM principle (folder IS orchestration). Creates sync issues. Room must be self-contained for portability. | All persistence in `room/.hats/`, `room/.briefings/`, `room/.snapshots/`. |
| **node-cron in MCP server** | Familiar scheduling pattern | stdio servers are spawned per-session and killed on disconnect. Cron in an ephemeral process is wasted CPU. | Desktop Scheduled Tasks handle persistence externally. MCP server stays stateless. |
| **chokidar file watching in MCP server** | Detect room changes in real-time | Without push notification delivery (resource subscriptions not implemented), watching files generates events nobody receives. Wasted overhead. | Scheduled tasks poll room state on interval. |
| **MCP Apps on CLI** | Feature parity across surfaces | Terminal cannot render iframes. Zero value add. Attempting it creates complexity for no user benefit. | CLI keeps rich text output. MCP Apps = Desktop/Cowork only. Feature parity does NOT mean identical UI. |
| **Custom MCP transport** | More control over server lifecycle | The SDK already supports stdio + Streamable HTTP dual transport on same `McpServer` instance. Custom transport adds maintenance burden for zero capability gain. | Use SDK transports. stdio for local (Desktop), Streamable HTTP for remote (future team access). |

## Feature Dependencies

```
Surface Auto-Detection
    |
    v
Full MCP Tool Parity (15 orphans)
    |
    +---> Pipeline Chaining (standardized output shapes)
    |       |
    |       v
    +---> Brain-Driven Routing (autonomous router + brain-client)
    |       |
    |       +---> Cowork Scheduled Intelligence (daily briefing, deadline tracking)
    |       |       |
    |       |       v
    |       +---> De Bono Persistent Hats (6 scheduled tasks + memory layer)
    |
    +---> MCP Apps Data Room Views (parallel track from Phase 2)
            |
            +---> Dashboard (read-only first)
            |       |
            |       v
            +---> Wiki + Graph (read-only)
                    |
                    v
                    Bidirectional tool calls from iframe (Phase 4b)
```

### Dependency Notes

- **Tool Parity requires Surface Detection:** Detection determines which features to advertise (MCP Apps capability check, scheduling availability).
- **Pipeline Chaining requires Tool Parity:** Cannot chain through tools that don't exist as MCP endpoints.
- **Brain-Driven Routing requires Tool Parity:** The autonomous router IS one of the new routers.
- **Scheduled Intelligence requires Brain Routing:** Briefings and prediction tracking call Brain-enriched analysis tools.
- **Persistent Hats requires Scheduled Intelligence:** Hats are a specialized form of scheduled analysis with memory.
- **MCP Apps is a parallel track:** Depends on tool parity but NOT on scheduling or Brain routing. Can develop alongside Phase 2-3 work.
- **Bidirectional MCP Apps conflict with read-only first approach:** Build read-only dashboard/wiki/graph first, add iframe-to-tool calls later. Reduces risk.

## User Experience by Surface

### CLI (Existing - Reference Baseline)

The user types `/mos:*` commands. Hooks fire automatically (SessionStart runs room analysis, PostToolUse detects cascades). Larry speaks with full personality. Pipeline chaining happens conversationally - Larry suggests next step, user confirms. Dashboard opens in browser via `open` command. Full bash script execution for HSI, export, transcription. Power user surface.

### Desktop (MCP Tools + Conversational)

The user talks to Larry naturally: "Analyze my market section" or "What should I work on next?" Larry (via MCP tool calls) runs the analysis and returns structured text. No slash commands. No hooks. The user never sees tool names - Claude selects the right router and sub-command. MCP Apps render dashboards and wiki inline in the conversation. Brain-driven routing suggests framework chains conversationally. Export generates artifacts that appear in the conversation thread.

**Key UX difference from CLI:** Desktop is conversational, not command-driven. The 8 router tools are Claude's vocabulary, not the user's. The user says "grade my project" and Claude calls `intelligence grade` without the user knowing a tool exists.

### Cowork (Desktop + Persistent Intelligence)

Same as Desktop, plus: scheduled tasks run overnight analysis. The user opens Cowork in the morning to find a briefing from Larry, hat perspectives on yesterday's filed artifacts, approaching prediction deadlines, and room health warnings in the sidebar. Each scheduled task appears as its own session in the "Scheduled" panel.

**Key UX difference from Desktop:** Cowork adds TIME. The room evolves between sessions. Larry has something to say before the user asks. The 6 De Bono hats have been thinking overnight - the user reviews perspectives rather than requesting them.

**Key constraint:** Computer must be on and Claude Desktop open. "Larry never sleeps" is technically "Larry never sleeps while your laptop lid is open." Mitigation: catch-up runs execute when app reopens (within 7 days).

## MVP Definition

### Launch With (v1.8.0 Phase 1-2)

- [ ] **Surface auto-detection** via MCP `clientInfo.name` - unlocks conditional behavior across all features
- [ ] **15 orphaned commands registered** in 2 new routers (autonomous + admin) - table stakes for Desktop/Cowork viability
- [ ] **Standardized tool output shapes** with `## Suggested Next` - enables LLM-orchestrated chaining
- [ ] **Brain-driven routing as MCP autonomous router** - the moat, accessible from all surfaces
- [ ] **Daily room briefing** Desktop Scheduled Task - immediate value, first "wow" for Cowork users
- [ ] **Prediction deadline tracking** scheduled task - unique differentiator, surfaces time-sensitive intelligence

### Add After Validation (v1.8.0 Phase 3)

- [ ] **De Bono persistent hats** (6 scheduled tasks) - after confirming scheduled task reliability
- [ ] **Cross-session hat memory** in `room/.hats/` - after hat perspectives prove useful
- [ ] **Hat-triggered cascade detection** - after hat memory is populated enough to detect patterns
- [ ] **Competitor watch** scheduled task - after scout MCP tool proves reliable

### Future Consideration (v1.8.0 Phase 4+)

- [ ] **MCP Apps dashboard** (De Stijl Mondrian grid in iframe) - highest effort, highest wow, defer until MCP Apps ecosystem matures in practice
- [ ] **MCP Apps wiki** (section navigation) - after dashboard proves the pattern
- [ ] **MCP Apps knowledge graph** (Cytoscape interactive) - most complex view, last to port
- [ ] **Bidirectional tool calls from MCP Apps** - after read-only views are stable

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Surface auto-detection | HIGH | LOW | P1 |
| 15 orphaned command registration | HIGH | MEDIUM | P1 |
| Standardized tool output shapes | HIGH | MEDIUM | P1 |
| Brain-driven MCP routing | HIGH | MEDIUM | P1 |
| Hook-to-MCP equivalence mapping | HIGH | MEDIUM | P1 |
| Daily room briefing | HIGH | LOW | P1 |
| Prediction deadline tracking | MEDIUM | LOW | P1 |
| Room health monitoring | MEDIUM | LOW | P2 |
| Competitor watch scheduling | MEDIUM | MEDIUM | P2 |
| De Bono persistent hats | HIGH | HIGH | P2 |
| Cross-session hat memory | HIGH | HIGH | P2 |
| Hat-triggered cascades | MEDIUM | HIGH | P2 |
| MCP Apps dashboard | HIGH | VERY HIGH | P3 |
| MCP Apps wiki | MEDIUM | VERY HIGH | P3 |
| MCP Apps knowledge graph | MEDIUM | VERY HIGH | P3 |
| Bidirectional MCP Apps | LOW | VERY HIGH | P3 |

**Priority key:**
- P1: Must have for v1.8.0 launch (MCP Foundation + initial scheduling)
- P2: Should have, add in Phase 2-3 (persistent intelligence + perspectives)
- P3: Nice to have, Phase 4+ (interactive visual views)

## Desktop vs Cowork vs CLI Capability Matrix

| Capability | CLI | Desktop | Cowork |
|------------|-----|---------|--------|
| Command interface | /mos:* slash commands | Natural language -> MCP tools | Natural language -> MCP tools |
| Hook-driven intelligence | Full (SessionStart, PostToolUse, FileChanged) | None (use first-call detection) | None (use first-call detection) |
| MCP tool access | Via plugin commands | Full (stdio transport) | Full (stdio bridged into VM) |
| MCP Apps (interactive UI) | None (terminal) | Full (sandboxed iframe) | Full (sandboxed iframe) |
| Persistent scheduled tasks | None | Desktop Scheduled Tasks (SKILL.md) | Desktop Scheduled Tasks (SKILL.md) |
| File system access | Full | Full (local paths) | Sandboxed VM (mounted folders only) |
| Brain MCP access | Via .mcp.json | Via claude_desktop_config.json | Via connector config |
| De Bono hats | PostToolUse hook (immediate) | On-demand via tool call | Scheduled nightly + on-demand |
| Morning briefing | SessionStart hook | First tool call | Scheduled task (automatic) |
| Pipeline chaining | Larry suggests, user confirms | LLM orchestrates via tool calls | LLM orchestrates via tool calls |
| Dashboard | `open` command (browser) | MCP App (inline iframe) | MCP App (inline iframe) |
| Export/publish | Bash scripts (full) | MCP tool (full) | MCP tool (sandboxed paths) |

**Key insight:** Desktop and Cowork are functionally identical for MindrianOS. Both speak MCP, both support scheduled tasks, both render MCP Apps. The only material difference is Cowork's sandboxed VM which limits file access to mounted folders. All Desktop features work on Cowork if paths resolve within the mount.

## Sources

- [MCP Apps Overview](https://modelcontextprotocol.io/extensions/apps/overview) - Official interactive UI spec, build guide, security model [HIGH]
- [MCP Apps Blog Post](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) - Launch announcement, supported clients, technical architecture [HIGH]
- [MCP Apps ext-apps GitHub](https://github.com/modelcontextprotocol/ext-apps/) - SDK (`@modelcontextprotocol/ext-apps`), examples (vanilla JS, React, Vue, etc.), specification [HIGH]
- [Claude Cowork Scheduled Tasks](https://support.claude.com/en/articles/13854387-schedule-recurring-tasks-in-cowork) - SKILL.md format, persistence, catch-up behavior, limitations [HIGH]
- [Claude Cowork Getting Started](https://support.claude.com/en/articles/13345190-get-started-with-cowork) - Sandboxed VM, plugin access, MCP bridging [HIGH]
- [MCP Architecture](https://modelcontextprotocol.io/docs/learn/architecture) - Initialize handshake, clientInfo detection, protocol lifecycle [HIGH]
- [KAIROS Architecture](https://codepointer.substack.com/p/claude-code-architecture-of-kairos) - Unreleased background agent, design artifacts [LOW - unshipped, do not build against]
- Existing codebase: `lib/mcp/tool-router.cjs` (6 routers, 49 commands), `lib/core/brain-client.cjs`, `lib/core/persona-ops.cjs`, `commands/*.md` (64 total) [HIGH - local verification]

---
*Feature research for: MindrianOS v1.8.0 Cowork Adaptation*
*Researched: 2026-04-05*
