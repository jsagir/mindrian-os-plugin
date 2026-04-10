# Roadmap: v2.0 Mindrian Platform -- SQLite + MCP Server

## Overview

Replace the dead KuzuDB with SQLite (graph + memory system), ship MindrianOS intelligence as a routed MCP server with interactive MCP Apps, and establish co-development infrastructure so every capability ships as both plugin command and MCP tool. SQLite migration is the critical path -- everything depends on room.db existing. MCP Apps leverage the existing 3 apps and ext-apps SDK v1.5.0 already in package.json.

## Milestones

<details>
<summary>v1.8.8 Brain Graph Optimization + Pam-Proof Install (Phases 60-64) - SHIPPED</summary>

5 phases, Brain normalization (FEEDS_INTO, PREREQUISITE, TYPICAL_AT enrichment), LazyGraph bridging, fragmentation cleanup, teaching wiring, dummy-proof install. See .planning/milestones/v1.8.8-ROADMAP.md

</details>

<details>
<summary>v1.9.0 Model Data Room + Self-Analysis (Phases 65-76) - SHIPPED</summary>

Google Drive integration, 168-artifact model room, HSI self-analysis, Investment Thesis, knowledge graph (179 nodes/383 edges). See .planning/milestones/v1.9.0-ROADMAP.md

</details>

- **v2.0 Mindrian Platform -- SQLite + MCP Server** - Phases 77-87 (in progress)

## Phases

- [ ] **Phase 77: SQLite Foundation** - Graph tables + lazygraph-ops.cjs replacement + WAL mode
- [ ] **Phase 78: Memory Layer + Assumptions** - Identity, facts, sessions, fragments tables + assumption tracking
- [ ] **Phase 79: SQLite Migration + Cleanup** - Migration tool, 24+ file updates, NL queries, kuzu removal
- [ ] **Phase 80: De Stijl Component Library + App Foundation** - Shared CSS/grid primitives, upgrade existing 3 apps, Shopify intent pattern
- [ ] **Phase 81: MCP Server Core** - Router architecture (5-7 tools), Larry Lite, dual transport, shared lib/core contract
- [ ] **Phase 82: MCP Router Tools** - Brain, Room, Compute routers + Text-to-Cypher + Cypher-to-Text
- [ ] **Phase 83: Co-Development Infrastructure** - Shared contract enforcement, dual-ship CI, test harness
- [ ] **Phase 84: MCP Apps - Core Views** - Mullins Assessment, Command Center, Graph Explorer, Wiki Browser
- [ ] **Phase 85: MCP Apps - Methodology + Meeting** - Mermaid Viewer, Meeting Timeline, FEEDS_INTO Explorer, Mode Card
- [ ] **Phase 86: MCP Apps - Interaction Primitives** - Form blocks, data tables, chart panels, action panels, wizard/stepper
- [ ] **Phase 87: Cross-Platform Testing** - Claude Desktop, ChatGPT, OpenClaw, postMessage bug guard

## Phase Details

### Phase 77: SQLite Foundation
**Goal**: Room graph stored in SQLite with WAL mode, lazygraph-ops.cjs fully replaced, concurrent plugin+MCP access works
**Depends on**: Nothing (critical path -- everything else blocks on this)
**Requirements**: SQLITE-01, SQLITE-02, SQLITE-03
**Success Criteria** (what must be TRUE):
  1. Running any lazygraph-ops function (addNode, addEdge, query, etc.) reads/writes room/.mindrian/room.db instead of .lazygraph/
  2. All 27 lazygraph-ops.cjs exports pass existing integration tests with SQLite backend (same signatures, same return shapes)
  3. Two separate Node.js processes can read room.db simultaneously without lock errors (WAL mode verified)
**Plans:** 2 plans
Plans:
- [x] 77-01-PLAN.md -- Install better-sqlite3, create test scaffold, rewrite lazygraph-ops.cjs from KuzuDB to SQLite
- [x] 77-02-PLAN.md -- Update graph-ops.cjs + write-lock.cjs wrappers, verify WAL concurrent access

### Phase 78: Memory Layer + Assumptions
**Goal**: Users have a persistent memory system across sessions -- Larry remembers who they are, what they said, and which assumptions are still valid
**Depends on**: Phase 77
**Requirements**: SQLITE-04, SQLITE-05
**Success Criteria** (what must be TRUE):
  1. Larry can recall user identity facts (name, role, venture) from L0 identity table without re-asking
  2. Facts stored with valid_from timestamps and can be invalidated (valid_from/invalidated_at lifecycle works)
  3. Session history (L2) and conversation fragments (L3) persist across Claude restarts
  4. Assumptions have validity status (untested/supported/contradicted/stale) that updates when new evidence is filed
**Plans**: TBD

### Phase 79: SQLite Migration + Cleanup
**Goal**: Existing rooms with .lazygraph/ data migrate cleanly to room.db, all 24+ KuzuDB-touching files updated, kuzu dependency removed
**Depends on**: Phase 78
**Requirements**: SQLITE-06, SQLITE-07, SQLITE-08, SQLITE-09
**Success Criteria** (what must be TRUE):
  1. User can ask "what frameworks connect to my problem?" in natural language and Larry translates to SQL, returns results (no Cypher exposure)
  2. Running migration tool on a room with existing .lazygraph/ data produces a room.db with identical node/edge counts
  3. grep -r "kuzu" across the entire repo returns zero matches outside migration tool and changelog
  4. package.json no longer lists kuzu as a dependency
**Plans**: TBD

### Phase 80: De Stijl Component Library + App Foundation
**Goal**: All MCP Apps share a consistent De Stijl visual language, existing 3 apps upgraded to ext-apps App class with bidirectional tool calling, Shopify intent pattern wired
**Depends on**: Phase 77 (apps read from room.db)
**Requirements**: APP-10, APP-01, APP-11
**Success Criteria** (what must be TRUE):
  1. A shared CSS file (or inline tokens) provides Mondrian grid primitives, health bars, badges, and color tokens reusable across all apps
  2. Existing dashboard, wiki, and graph apps use ext-apps App class with callServerTool for live data fetching
  3. Clicking a UI element in any app bubbles an intent to Larry (e.g., "analyze this section") rather than directly executing actions
**Plans**: TBD
**UI hint**: yes

### Phase 81: MCP Server Core
**Goal**: MindrianOS runs as an MCP server that any LLM host can connect to, with 5-7 router tools (not 23 flat), Larry Lite methodology instinct, and shared lib/core modules
**Depends on**: Phase 77 (server needs SQLite for room state)
**Requirements**: MCP-01, MCP-05, MCP-06, MCP-07
**Success Criteria** (what must be TRUE):
  1. Claude Desktop can connect to MindrianOS MCP server via stdio transport and see 5-7 router tools (not 23)
  2. Larry Lite system prompt (200-line methodology instinct) is served to host LLMs, enabling tool orchestration without full Larry personality
  3. Server starts on both stdio (local) and Streamable HTTP (remote) transports from same codebase
  4. MCP tool handlers import from lib/core/*.cjs -- same functions that plugin hooks call
**Plans**: TBD

### Phase 82: MCP Router Tools
**Goal**: All Brain, Room, and Compute intelligence accessible through routed MCP tools with subcommand dispatch
**Depends on**: Phase 81
**Requirements**: MCP-02, MCP-03, MCP-04, MCP-08, MCP-09
**Success Criteria** (what must be TRUE):
  1. Calling brain_router with subcommand "ask" returns Brain teaching intelligence, "query" runs Cypher, "grade" returns rubric scores
  2. Calling room_router with subcommand "analyze" returns room health, "state" returns current position, "file" files an artifact
  3. Calling compute_router with subcommand "hsi_score" returns HSI results, "reverse_salients" identifies weak sections
  4. User asks "what frameworks address wicked problems?" and Text-to-Cypher translates to Cypher, executes against Brain, and Cypher-to-Text renders readable answer
**Plans**: TBD

### Phase 83: Co-Development Infrastructure
**Goal**: Every new capability automatically ships as both plugin command and MCP tool, with CI enforcement and test parity
**Depends on**: Phase 81
**Requirements**: CODEV-01, CODEV-02, CODEV-03
**Success Criteria** (what must be TRUE):
  1. Every lib/core module exports both sync and async variants, importable from both plugin hooks and MCP server
  2. Opening a PR that adds an MCP tool without a matching plugin command (or vice versa) fails CI check
  3. Test harness runs same input through both plugin hook path and MCP tool path, asserts identical output
**Plans**: TBD

### Phase 84: MCP Apps - Core Views
**Goal**: Users see rich interactive views inside their chat -- Mullins assessment cards, room command center, knowledge graph explorer, and wiki browser
**Depends on**: Phase 80, Phase 82
**Requirements**: APP-02, APP-03, APP-04, APP-05
**Success Criteria** (what must be TRUE):
  1. Mullins Assessment renders 3-column card (Real/Win/Worth) with live evidence counts from room artifacts, clicking a cell shows supporting evidence
  2. Room Command Center shows Mondrian-grid section health with APPROVE/REJECT/DEFER buttons that bubble intents to Larry
  3. Knowledge Graph Explorer renders interactive Cytoscape.js graph with pan/zoom/filter, edge type toggles, and click-to-article navigation
  4. Wiki Browser displays room structure as hyperlinked pages with section drill-down, artifact content, and backlinks
**Plans**: TBD
**UI hint**: yes

### Phase 85: MCP Apps - Methodology + Meeting
**Goal**: Users can visually navigate methodology chains, meeting timelines, framework sequences, and select their working mode through interactive in-chat apps
**Depends on**: Phase 80, Phase 82
**Requirements**: APP-06, APP-07, APP-08, APP-09
**Success Criteria** (what must be TRUE):
  1. Mermaid/Flowchart Viewer renders methodology chains and causal diagrams as interactive Mermaid diagrams in-chat
  2. Meeting Timeline shows speaker bubbles along a timeline with decision points and action items, click-to-drill to meeting details
  3. FEEDS_INTO Chain Explorer visualizes framework chains from Brain, clicking a framework shows next steps and rationale
  4. Mode Selection Card presents 3 visual mode buttons (Explore+Capture, Deep Analysis, Quick File) that set Larry's working mode
**Plans**: TBD
**UI hint**: yes

### Phase 86: MCP Apps - Interaction Primitives
**Goal**: Reusable interaction components (forms, tables, charts, actions, wizards) available for all current and future MCP Apps
**Depends on**: Phase 80
**Requirements**: APP-12, APP-13, APP-14, APP-15, APP-16
**Success Criteria** (what must be TRUE):
  1. Form blocks collect structured input (meeting filing, room creation) and submit as tool calls
  2. Data tables render sortable artifact lists with ranked relevance from search results
  3. Chart panels display bar/line/pie/KPI for HSI scores, section coverage, room analytics
  4. Action panels show approve/retry/compare/branch buttons that cascade into next tool actions
  5. Wizard/stepper guides multi-step flows (onboarding, room setup) with progress tracking
**Plans**: TBD
**UI hint**: yes

### Phase 87: Cross-Platform Testing
**Goal**: MindrianOS MCP server and apps verified working on Claude Desktop, ChatGPT, and OpenClaw with known bugs guarded
**Depends on**: Phase 84, Phase 85, Phase 86
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. All MCP Apps render correctly and are interactive on Claude Desktop (verified manually)
  2. MCP Apps render correctly on ChatGPT with ext-apps SDK compatibility confirmed
  3. MCP server connects and responds to tool calls on OpenClaw via stdio transport
  4. All app HTML includes guard for Claude.ai postMessage bug (issue #47) -- no silent failures
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 77 -> 78 -> 79 -> 80 -> 81 -> 82 -> 83 -> 84 -> 85 -> 86 -> 87

Note: Phases 80 (Apps Foundation) and 81 (MCP Server Core) can start in parallel after Phase 77.
Phases 83 (Co-Dev) can run parallel with 82 (Router Tools).
Phases 84 and 85 can run parallel after 80+82 complete.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 77. SQLite Foundation | 2/2 | Complete | 2026-04-10 |
| 78. Memory Layer + Assumptions | 0/? | Not started | - |
| 79. SQLite Migration + Cleanup | 0/? | Not started | - |
| 80. De Stijl Component Library + App Foundation | 0/? | Not started | - |
| 81. MCP Server Core | 0/? | Not started | - |
| 82. MCP Router Tools | 0/? | Not started | - |
| 83. Co-Development Infrastructure | 0/? | Not started | - |
| 84. MCP Apps - Core Views | 0/? | Not started | - |
| 85. MCP Apps - Methodology + Meeting | 0/? | Not started | - |
| 86. MCP Apps - Interaction Primitives | 0/? | Not started | - |
| 87. Cross-Platform Testing | 0/? | Not started | - |
