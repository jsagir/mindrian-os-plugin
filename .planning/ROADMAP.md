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

**Milestone Goal:** Every MindrianOS command, pipeline, and intelligence capability works identically across CLI, Desktop, and Cowork -- with Brain-driven routing, scheduled external intelligence, persistent De Bono perspectives, and inline Data Room views on Cowork.

## Phases

- [ ] **Phase 52: MCP Foundation** - Intelligence cascade, router restructuring, SDK upgrade, 64-command coverage with Brain-driven routing
- [ ] **Phase 53: Surface Detection + Write Safety** - Auto-detect CLI/Desktop/Cowork, dual transport, KuzuDB write gateway
- [ ] **Phase 54: Token Optimization** - Native-first skills, UI system compression, progressive loading to halve per-turn token cost
- [ ] **Phase 55: Pipeline Chaining** - Room-file-based state for LLM-orchestrated tool sequences, Brain chain recommendations
- [ ] **Phase 56: Scheduled Intelligence** - Session catch-up, daily briefings, competitor/grant/news scanning on Cowork
- [ ] **Phase 57: De Bono Persistent Hats** - 6 perspective personas with cross-session memory feeding Brain routing
- [ ] **Phase 58: MCP Apps Data Room Views** - Dashboard, wiki, and graph rendered inline via ext-apps in Cowork/Desktop
- [ ] **Phase 59: Release v1.8.0** - Integration testing across all 3 surfaces, version bump, release

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
**Plans**: TBD

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

### Phase 54: Token Optimization
**Goal**: Fresh-install users pay half the per-turn token cost while retaining full capability through progressive skill loading
**Depends on**: Phase 52
**Requirements**: TOKEN-01, TOKEN-02, TOKEN-03, TOKEN-04, TOKEN-05, TOKEN-06
**Success Criteria** (what must be TRUE):
  1. A fresh install with no room directory loads approximately 10,000 tokens per turn (down from approximately 20,500)
  2. Skills that reference room state (room-proactive, room-passive) only load after a room/ directory exists
  3. Brain-connector skill loads on demand when Brain is detected, not at startup
  4. The UI system skill compresses from approximately 28K bytes to approximately 8K bytes without losing any rendering rules
  5. Opening a room progressively loads Layer 1 skills; connecting Brain adds Layer 2 -- capability grows with context
**Plans**: TBD

### Phase 55: Pipeline Chaining
**Goal**: Users can run multi-step methodology pipelines end-to-end on Desktop/Cowork where each tool's output feeds the next through room artifacts
**Depends on**: Phase 52, Phase 53
**Requirements**: PIPE-01, PIPE-02, PIPE-03
**Success Criteria** (what must be TRUE):
  1. Running scenario analysis on Cowork produces a room artifact that root-cause analysis can read as input without the user manually copying content
  2. A full pipeline (scenario analysis -> root cause -> causal tracing -> prediction tracking) completes end-to-end via MCP tools with each step reading the previous step's room artifact
  3. Brain recommendation includes chain ordering -- Larry suggests the next framework in sequence based on CO_OCCURS and FEEDS_INTO relationships
**Plans**: TBD

### Phase 56: Scheduled Intelligence
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

### Phase 57: De Bono Persistent Hats
**Goal**: Six perspective personas maintain cross-session memory and feed their findings into Brain routing for richer methodology recommendations
**Depends on**: Phase 56
**Requirements**: HAT-01, HAT-02, HAT-03, HAT-04
**Success Criteria** (what must be TRUE):
  1. Each of the 6 De Bono hats (White/Red/Black/Yellow/Green/Blue) has persistent state in room/.mindrian/hats/{color}/ that survives across sessions
  2. Running a hat analysis loads one subagent that sequentially processes all 6 personas -- NOT 6 concurrent agents (token budget stays under 5K total)
  3. Black Hat concerns influence risk assessments and Yellow Hat opportunities feed HSI scoring when Brain recommends frameworks
  4. Each hat session produces a dated log at room/.mindrian/hats/{color}/session-log/YYYY-MM-DD.md showing what that perspective found
**Plans**: TBD
**UI hint**: yes

### Phase 58: MCP Apps Data Room Views
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

### Phase 59: Release v1.8.0
**Goal**: v1.8.0 is tested across all three surfaces, versioned, and ready for users
**Depends on**: Phase 52, Phase 53, Phase 54, Phase 55, Phase 56, Phase 57, Phase 58
**Success Criteria** (what must be TRUE):
  1. A fresh install on CLI, Desktop, and Cowork each complete a basic workflow (create room, file artifact, run methodology, view dashboard) without errors
  2. CHANGELOG.md has a v1.8.0 entry documenting all new capabilities with surface-specific guidance
  3. plugin.json version reads 1.8.0
**Plans**: TBD

## Progress

**Execution Order:** 52 -> 53 -> [54 parallel with 55] -> 56 -> 57 -> [58 parallel with 56-57] -> 59

Note: Phase 54 (Token Optimization) can run parallel with Phase 55 (Pipeline Chaining) -- both depend on Phase 52 but not each other. Phase 58 (MCP Apps) depends only on Phase 52 and can start in parallel with Phases 56-57.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 52. MCP Foundation | v1.8.0 | 0/TBD | Not started | - |
| 53. Surface Detection + Write Safety | v1.8.0 | 0/TBD | Not started | - |
| 54. Token Optimization | v1.8.0 | 0/TBD | Not started | - |
| 55. Pipeline Chaining | v1.8.0 | 0/TBD | Not started | - |
| 56. Scheduled Intelligence | v1.8.0 | 0/TBD | Not started | - |
| 57. De Bono Persistent Hats | v1.8.0 | 0/TBD | Not started | - |
| 58. MCP Apps Data Room Views | v1.8.0 | 0/TBD | Not started | - |
| 59. Release v1.8.0 | v1.8.0 | 0/TBD | Not started | - |

## Dependency Chain

```
Phase 52 (MCP Foundation) --> Phase 53 (Surface Detection + Write Safety)
Phase 52 (MCP Foundation) --> Phase 54 (Token Optimization) [parallel track]
Phase 52 (MCP Foundation) --> Phase 58 (MCP Apps) [parallel track]
Phase 52 + 53 --> Phase 55 (Pipeline Chaining)
Phase 53 (Surface Detection) --> Phase 56 (Scheduled Intelligence)
Phase 56 (Scheduled Intelligence) --> Phase 57 (De Bono Hats)
All phases --> Phase 59 (Release)
```
