# Roadmap: MindrianOS Plugin v1.8.0 Cowork Adaptation

## Milestones

<details>
<summary>Previous milestones (Phases 1-51) -- SHIPPED</summary>

- v1.0 MVP (Phases 1-5) -- shipped 2026-03-22
- v2.0 Meeting Intelligence (Phases 6-9) -- shipped 2026-03-24
- v3.0 MCP Platform (Phases 10-19) -- shipped 2026-03-25
- v4.0 Brain API & CLI UI (Phases 20-25) -- shipped 2026-03-29
- v5.0 Presentation System (Phases 26-33) -- shipped 2026-03-31
- v5.1 User Outlets (Phases 34-38) -- shipped 2026-03-31
- v1.6.0 Powerhouse (Phases 39-46) -- shipped 2026-03-31
- v6.2 RoomHub + SnapshotHub (Phases 47-51) -- shipped 2026-04-01

</details>

### v1.8.0 Cowork Adaptation (In Progress)

**Milestone Goal:** Every MindrianOS command, pipeline, and intelligence capability works identically across CLI, Desktop, and Cowork -- with Brain-driven routing, optimized context/token budgets per user archetype, smart agent dispatch, scheduled external intelligence, persistent De Bono perspectives, and inline Data Room views on Cowork.

## Phases

- [ ] **Phase 52: MCP Foundation** - Intelligence cascade, router restructuring, SDK upgrade, 64-command coverage with Brain-driven routing
- [ ] **Phase 53: Surface Detection + Write Safety** - Auto-detect CLI/Desktop/Cowork, dual transport, KuzuDB write gateway
- [ ] **Phase 54: Token + Hook Optimization** - Native-first skills, UI system compression, progressive loading, HSI debounce, write batching, bridge isolation
- [ ] **Phase 55: Context Intelligence** - User archetype detection, tiered context loading, MCP session profiles, autocompact tuning, returning user and student progress
- [ ] **Phase 56: Pipeline Chaining** - Room-file-based state for LLM-orchestrated tool sequences, Brain chain recommendations
- [ ] **Phase 57: Agent Dispatch Optimization** - Dynamic swarm sizing, cost estimation, chain checkpoints, budget-aware model routing, Coordinator prep
- [ ] **Phase 58: Scheduled Intelligence** - Session catch-up, daily briefings, competitor/grant/news scanning on Cowork
- [ ] **Phase 59: De Bono Persistent Hats** - 6 perspective personas with cross-session memory feeding Brain routing
- [ ] **Phase 60: MCP Apps Data Room Views** - Dashboard, wiki, and graph rendered inline via ext-apps in Cowork/Desktop
- [ ] **Phase 61: Release v1.8.0 + Platform Readiness** - Integration testing across all 3 surfaces, KAIROS prep, UDS stubs, GrowthBook monitoring, version bump

## Phase Details

### Phase 52: MCP Foundation
**Goal**: All 64 plugin commands work as MCP tools on Desktop and Cowork with intelligence firing on every write operation and Brain-driven routing resilient to cold starts
**Depends on**: Phase 51 (v6.2 SnapshotHub)
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06
**Success Criteria** (what must be TRUE):
  1. A Desktop/Cowork user can invoke any of the 64 plugin commands via MCP tools -- no command is CLI-only
  2. Filing an artifact via MCP tool triggers the same HSI computation, cross-reference scan, and graph indexing that CLI hooks produce (intelligence-cascade.cjs shared module)
  3. Asking Larry "what should I do next?" on Cowork returns a Brain-informed framework recommendation within 2 seconds, falling back to local heuristic if Brain is cold/unreachable
  4. Each MCP router group contains 15 or fewer commands and MCP Inspector testing shows less than 5% misroute rate on 20 natural language queries
  5. Every MCP tool response includes a `## Suggested Next` section with the exact tool name to call next
**Plans:** 2/3 plans executed

Plans:
- [x] 52-01-PLAN.md - SDK upgrade + intelligence cascade extraction (shared module)
- [x] 52-02-PLAN.md - Router restructuring (6->9), 64-command coverage, Suggested Next
- [ ] 52-03-PLAN.md - Brain-driven routing with 3-tier fallback

### Phase 53: Surface Detection + Write Safety
**Goal**: The plugin auto-detects which surface it runs on and configures itself accordingly, with KuzuDB writes safe under concurrent CLI + MCP access
**Depends on**: Phase 52
**Requirements**: SURF-01, SURF-02, SURF-03, SURF-04, WRITE-01, WRITE-02, WRITE-03
**Success Criteria** (what must be TRUE):
  1. Starting the MCP server on Desktop uses stdio transport; starting on Cowork uses Streamable HTTP on 127.0.0.1:3847 -- no user configuration needed
  2. Running `/mos:setup` detects the surface and configures both MCP servers (Brain remote + MindrianOS local) with zero manual JSON editing
  3. Two processes (CLI hook + MCP server) writing to KuzuDB simultaneously produce zero data loss -- write gateway serializes all writes through promise chain
  4. MCP Apps registration only appears on Desktop/Cowork; CLI hooks only fire on CLI; feature registration adapts to detected surface
**Plans**: TBD

### Phase 54: Token + Hook Optimization
**Goal**: Fresh-install users pay half the per-turn token cost while retaining full capability, and the intelligence cascade fires efficiently with debouncing, caching, and batching
**Depends on**: Phase 52
**Requirements**: TOKEN-01, TOKEN-02, TOKEN-03, TOKEN-04, TOKEN-05, TOKEN-06, HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-05
**Success Criteria** (what must be TRUE):
  1. A fresh install with no room directory loads approximately 10,000 tokens per turn (down from approximately 20,500)
  2. Skills that reference room state (room-proactive, room-passive) only load after a room/ directory exists
  3. Brain-connector skill loads on demand when Brain is detected, not at startup
  4. The UI system skill compresses from approximately 28K bytes to approximately 8K bytes without losing any rendering rules
  5. Opening a room progressively loads Layer 1 skills; connecting Brain adds Layer 2 -- capability grows with context
  6. Writing the same file twice within 30 seconds triggers HSI computation only once (debounce)
  7. A swarm writing 3 artifacts produces a single batched HSI computation, not 3 separate ones
  8. Bridge file is stored per-room at ~/.mindrian/bridge/{room-hash}.json, not at a shared /tmp/ path
**Plans**: TBD

### Phase 55: Context Intelligence
**Goal**: The system detects user type and session intent, then loads only the context and MCP servers each user actually needs -- students get minimal overhead, venturists get full pipelines, returning users skip re-introductions
**Depends on**: Phase 54
**Requirements**: CTX-01, CTX-02, CTX-03, CTX-04, CTX-05, CTX-06
**Success Criteria** (what must be TRUE):
  1. A user with USER.md indicating "student" and >70% context budget used gets minimal context (~500 tokens) at session start, while a venturist in a fresh session gets rich context (~5K tokens)
  2. Setting MCP session profile to "learn" loads zero external MCP servers; setting to "full" loads all configured servers
  3. A returning user (session count > 3) sees a domain-specific greeting ("I see you're continuing work on [domain]") instead of the full introduction
  4. A student's completed tasks are persisted to room/.context/learning-progress.md at session end, and the next session reports "You completed X of 22 tasks"
  5. Autocompact threshold adapts to user type: 65% for students, 72% default, 75% venturist, 78% researcher
**Plans**: TBD

### Phase 56: Pipeline Chaining
**Goal**: Users can run multi-step methodology pipelines end-to-end on Desktop/Cowork where each tool's output feeds the next through room artifacts
**Depends on**: Phase 52, Phase 53
**Requirements**: PIPE-01, PIPE-02, PIPE-03
**Success Criteria** (what must be TRUE):
  1. Running scenario analysis on Cowork produces a room artifact that root-cause analysis can read as input without the user manually copying content
  2. A full pipeline (scenario analysis -> root cause -> causal tracing -> prediction tracking) completes end-to-end via MCP tools with each step reading the previous step's room artifact
  3. Brain recommendation includes chain ordering -- Larry suggests the next framework in sequence based on CO_OCCURS and FEEDS_INTO relationships
**Plans**: TBD

### Phase 57: Agent Dispatch Optimization
**Goal**: Agent dispatch is budget-aware -- swarms scale to context availability, chains checkpoint between steps, and expensive operations show cost estimates before running
**Depends on**: Phase 52
**Requirements**: AGENT-01, AGENT-02, AGENT-03, AGENT-04, AGENT-05
**Success Criteria** (what must be TRUE):
  1. Running /mos:act --swarm with 1 weak section dispatches 1 agent, not 3 -- swarm size equals min(weak_sections, context_budget / agent_cost)
  2. Before dispatching a multi-agent operation, the user sees "This will use ~150K tokens (3 agents x Opus)" and can confirm or cancel
  3. Multi-step pipeline chains pause between steps with "Continue to step N?" instead of auto-running all 3-5 steps
  4. When remaining context drops below 60%, agent dispatch automatically downgrades from Opus to Sonnet
  5. Agent output format is structured so that when CLAUDE_CODE_COORDINATOR_MODE ships, framework-runners map directly to Coordinator workers with no refactoring
**Plans**: TBD

### Phase 58: Scheduled Intelligence
**Goal**: Cowork users receive daily briefings, prediction deadline alerts, and proactive competitor/grant/news intelligence without manual triggering
**Depends on**: Phase 53
**Requirements**: SCHED-01, SCHED-02, SCHED-03, SCHED-04, SCHED-05, SCHED-06, SCHED-07
**Success Criteria** (what must be TRUE):
  1. Opening a Cowork session after 24+ hours shows a catch-up summary: what was missed, predictions approaching deadline, new files since last session
  2. A daily briefing generates automatically from room state -- approaching deadlines, new contradictions, stale sections -- and is readable as a room artifact
  3. Competitor analysis, grant discovery, and domain news scans run on schedule and file results to room/intelligence/ with provenance and timestamps
  4. Scout sentinel tasks (health check, deadline scan, competitor watch, HSI recomputation) execute on their configured schedule via Cowork's built-in task system
  5. All scheduled results are idempotent -- running twice produces the same output, and missed runs are recovered on next session start
**Plans**: TBD

### Phase 59: De Bono Persistent Hats
**Goal**: Six perspective personas maintain cross-session memory and feed their findings into Brain routing for richer methodology recommendations
**Depends on**: Phase 58
**Requirements**: HAT-01, HAT-02, HAT-03, HAT-04
**Success Criteria** (what must be TRUE):
  1. Each of the 6 De Bono hats (White/Red/Black/Yellow/Green/Blue) has persistent state in room/.mindrian/hats/{color}/ that survives across sessions
  2. Running a hat analysis loads one subagent that sequentially processes all 6 personas -- NOT 6 concurrent agents (token budget stays under 5K total)
  3. Black Hat concerns influence risk assessments and Yellow Hat opportunities feed HSI scoring when Brain recommends frameworks
  4. Each hat session produces a dated log at room/.mindrian/hats/{color}/session-log/YYYY-MM-DD.md showing what that perspective found
**Plans**: TBD
**UI hint**: yes

### Phase 60: MCP Apps Data Room Views
**Goal**: Desktop and Cowork users see interactive Data Room views (dashboard, wiki, graph) rendered inline in the conversation without a local server
**Depends on**: Phase 52
**Requirements**: APP-01, APP-02, APP-03, APP-04, APP-05, APP-06
**Success Criteria** (what must be TRUE):
  1. Asking to see the dashboard on Cowork renders a De Stijl Mondrian grid inline in the conversation via MCP Apps
  2. Room sections are browsable as wiki pages inline -- user can navigate between sections without opening files
  3. The knowledge graph renders inline with Cytoscape.js showing nodes, edges, and the existing De Stijl visual style
  4. All views use vanilla HTML/JS with no build step -- served as ui:// resources via ext-apps
  5. Views can call MCP tools via postMessage for on-demand data refresh (bidirectional communication)
**Plans**: TBD
**UI hint**: yes

### Phase 61: Release v1.8.0 + Platform Readiness
**Goal**: v1.8.0 is tested across all three surfaces, versioned, and prepared for upcoming Anthropic platform features (KAIROS, Coordinator, UDS)
**Depends on**: Phase 52, Phase 53, Phase 54, Phase 55, Phase 56, Phase 57, Phase 58, Phase 59, Phase 60
**Requirements**: READY-01, READY-02, READY-03, READY-04
**Success Criteria** (what must be TRUE):
  1. A fresh install on CLI, Desktop, and Cowork each complete a basic workflow (create room, file artifact, run methodology, view dashboard) without errors
  2. last-session.md includes structured fields (active_methodology, open_questions, next_suggested_action, confidence_level) consumable by future KAIROS daily logs
  3. When tengu_kairos activates, context-engine reads the KAIROS daily log instead of cold-start context rebuilding -- detection is wired, waiting for the gate
  4. UDS listener stubs exist in room-passive for future cross-instance room state sharing
  5. GrowthBook gates (tengu_kairos, tengu_harbor, tengu_scratch) are monitored and auto-activate features when they go live
  6. CHANGELOG.md has a v1.8.0 entry and plugin.json version reads 1.8.0
**Plans**: TBD

## Progress

**Execution Order:** 52 -> 53 -> [54 parallel with 56, 57] -> 55 -> [58 parallel with 60] -> 59 -> 61

Note: Phase 54 (Token + Hook) and Phases 56 (Pipeline) + 57 (Agent Dispatch) can run in parallel after Phase 52 -- they share no dependencies. Phase 55 (Context Intelligence) depends on Phase 54's skill compression foundation. Phase 60 (MCP Apps) depends only on Phase 52 and can start alongside Phase 58. Phase 59 (De Bono Hats) needs Phase 58's scheduled infrastructure.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 52. MCP Foundation | v1.8.0 | 2/3 | In Progress|  |
| 53. Surface Detection + Write Safety | v1.8.0 | 0/TBD | Not started | - |
| 54. Token + Hook Optimization | v1.8.0 | 0/TBD | Not started | - |
| 55. Context Intelligence | v1.8.0 | 0/TBD | Not started | - |
| 56. Pipeline Chaining | v1.8.0 | 0/TBD | Not started | - |
| 57. Agent Dispatch Optimization | v1.8.0 | 0/TBD | Not started | - |
| 58. Scheduled Intelligence | v1.8.0 | 0/TBD | Not started | - |
| 59. De Bono Persistent Hats | v1.8.0 | 0/TBD | Not started | - |
| 60. MCP Apps Data Room Views | v1.8.0 | 0/TBD | Not started | - |
| 61. Release v1.8.0 + Platform Readiness | v1.8.0 | 0/TBD | Not started | - |

## Dependency Chain

```
Phase 52 (MCP Foundation) --> Phase 53 (Surface Detection + Write Safety)
Phase 52 (MCP Foundation) --> Phase 54 (Token + Hook Optimization) [parallel track A]
Phase 52 (MCP Foundation) --> Phase 56 (Pipeline Chaining) [parallel track B, also needs 53]
Phase 52 (MCP Foundation) --> Phase 57 (Agent Dispatch Optimization) [parallel track B]
Phase 52 (MCP Foundation) --> Phase 60 (MCP Apps) [parallel track C]
Phase 54 (Token + Hook) --> Phase 55 (Context Intelligence)
Phase 53 (Surface Detection) --> Phase 58 (Scheduled Intelligence)
Phase 58 (Scheduled Intelligence) --> Phase 59 (De Bono Hats)
All phases --> Phase 61 (Release + Platform Readiness)
```
