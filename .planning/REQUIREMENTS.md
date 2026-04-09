# Requirements: v2.0 Mindrian Platform -- SQLite + MCP Server

**Defined:** 2026-04-10
**Core Value:** Ship MindrianOS intelligence as a platform -- any LLM host gets routed tools, interactive UI (MCP Apps), and a room memory system. Replace dead KuzuDB with SQLite. Co-develop plugin and MCP server from shared core.

## SQLite Migration

- [ ] **SQLITE-01**: Room graph stored in SQLite (nodes + edges tables) at room/.mindrian/room.db replacing .lazygraph/
- [ ] **SQLITE-02**: All 27 lazygraph-ops.cjs exports work identically with SQLite backend (same function signatures)
- [ ] **SQLITE-03**: WAL mode enabled for concurrent read access (plugin + MCP server simultaneously)
- [ ] **SQLITE-04**: Memory layer: identity table (L0), facts table with valid_from/invalidated_at (L1), sessions table (L2), fragments table (L3)
- [ ] **SQLITE-05**: Assumption tracking table with validity lifecycle (untested/supported/contradicted/stale) and evidence linking
- [ ] **SQLITE-06**: Natural language graph queries -- Larry translates user questions to SQL, no Cypher exposure to users
- [ ] **SQLITE-07**: Migration tool converts existing .lazygraph/ data to room.db (or rebuilds from artifacts)
- [ ] **SQLITE-08**: All 24+ files touching KuzuDB updated (scripts, CLI, MCP tools, wiki, cascade)
- [ ] **SQLITE-09**: kuzu npm package removed from dependencies

## MCP Server (Goal-Oriented Tools)

**Design principle:** Tools are goals, not endpoints. Each tool orchestrates the full internal pipeline. The LLM picks a tool matching the user's intent -- the server does all chaining. Brain queries, Room analysis, HSI scoring, and UI attachment happen INSIDE each tool. The moat (methodology chaining) lives in server code, not in exposed subcommand documentation.

- [ ] **MCP-01**: 10 goal-oriented tools where each orchestrates complete internal pipeline, returns JSON data + _meta.ui.resourceUri for MCP App
- [ ] **MCP-02**: explore_opportunity(description) -- chains domain exploration + reverse salient + S-curve + JTBD + HSI internally, attaches Knowledge Graph Explorer UI
- [ ] **MCP-03**: validate_idea(claim) -- chains Mullins Triple Validation + Six Hats + Ackoff + assumption creation internally, attaches Mullins Assessment UI
- [ ] **MCP-04**: file_artifact(content, section) -- triggers full filing cascade (classify, graph-index, HSI, cross-ref scan, assumption check), attaches updated Command Center UI
- [ ] **MCP-05**: whats_weak() -- runs analyze-room + reverse salients + blindspot coverage + bias scan + Brain routing, attaches Command Center + Bias Heatmap UI
- [ ] **MCP-06**: grade_my_work() -- runs full grading rubric with Brain calibration + evidence mapping, attaches Grading Scorecard UI
- [ ] **MCP-07**: red_team(target) -- adversarial stress-test orchestrating Devil's Advocate + Black Hat + investor perspective + Brain failure pattern matching, attaches Red Team Report UI
- [ ] **MCP-08**: detect_bias(target) -- systematic bias scan (confirmation, survivorship, anchoring, selection) across room evidence with balance scoring, attaches Bias Heatmap UI
- [ ] **MCP-09**: file_meeting(transcript) -- full meeting pipeline (parse, extract speakers, file segments, team update, cascade), attaches Meeting Timeline UI
- [ ] **MCP-10**: whats_next() -- Brain-routed suggestion based on room state + venture stage + FEEDS_INTO chain traversal, attaches Chain Explorer UI
- [ ] **MCP-11**: track_assumption(claim, evidence) -- create/update assumption with validity lifecycle + evidence linking, attaches Assumption Dashboard UI
- [ ] **MCP-12**: Larry Lite server instructions (200-line methodology instinct, not personality) -- teaches host LLMs WHEN to call which tool based on user intent
- [ ] **MCP-13**: stdio transport (local Desktop) + Streamable HTTP transport (remote/OpenClaw) on same server instance
- [ ] **MCP-14**: Shared lib/core/*.cjs contract -- every core module callable from both plugin hooks and MCP tool handlers
- [ ] **MCP-15**: Text-to-Cypher + Cypher-to-Text wrapped INSIDE tools that need Brain (not exposed as separate tools) -- natural language in, readable insights out
- [ ] **MCP-16**: Brain-driven tool selection -- given user intent, Brain's ADDRESSES_PROBLEM_TYPE + FEEDS_INTO graph determines which goal-oriented tool(s) to invoke and in what order. Server can auto-chain tools when Brain recommends a sequence.
- [ ] **MCP-17**: Brain-driven agent spawning -- Brain's FrameworkAgent nodes (10 agents: ReverseSalientAgent, HSIAgent, JTBDAgent, etc.) determine which specialist agent to spawn for deep analysis. MCP server spawns agents as sub-tool-calls with isolated context.
- [ ] **MCP-18**: Dynamic tool recommendation -- after any tool completes, Brain suggests the next logical tool based on FEEDS_INTO chains and current room state. Returned in tool response as `_meta.suggested_next`.

## MCP Apps (Interactive UI)

- [ ] **APP-01**: Upgrade existing 3 apps (dashboard, wiki, graph) to use ext-apps App class with bidirectional callServerTool
- [ ] **APP-02**: PWS Value Proposition / Mullins Assessment -- 3-column interactive card (Is it Real / Can We Win / Is it Worth It) with live evidence mapping from room artifacts, click-to-drill per cell, Brain-routed methodology suggestions per weak cell
- [ ] **APP-03**: Room Command Center -- Mondrian-grid dashboard with section health, APPROVE/REJECT/DEFER buttons, mode selection widget, suggested next panel
- [ ] **APP-04**: Knowledge Graph Explorer -- interactive Cytoscape.js graph in-chat with pan/zoom/filter, edge type toggles, click-to-article, search
- [ ] **APP-05**: Wiki Browser -- nested room structure as hyperlinked pages, section drill-down, artifact content, backlinks
- [ ] **APP-06**: Mermaid/Flowchart Viewer -- methodology chains, causal diagrams, system maps rendered as interactive Mermaid in-chat
- [ ] **APP-07**: Meeting Timeline -- visual timeline with speaker bubbles, decision points, action items, click-to-drill
- [ ] **APP-08**: FEEDS_INTO Chain Explorer -- visual framework chain navigator showing Brain methodology sequences, click framework to see next + why
- [ ] **APP-09**: Mode Selection Card -- entry point for new users, 3 visual buttons (Explore+Capture, Deep Analysis, Quick File), persona-aware
- [ ] **APP-10**: De Stijl component library -- shared CSS tokens, Mondrian grid primitives, health bars, badges, reusable across all apps
- [ ] **APP-11**: All apps use Shopify intent pattern -- UI bubbles intents to Larry, Larry takes action with full context
- [ ] **APP-12**: Form blocks -- structured input collection for meeting filing, room creation, methodology configuration
- [ ] **APP-13**: Data tables -- sortable results, artifact lists, search output with ranked relevance
- [ ] **APP-14**: Chart panels -- bar/line/pie/KPI for room analytics, section coverage, HSI scores, coverage percentages
- [ ] **APP-15**: Action panels -- approve/retry/compare/branch into next tool action from UI, cascade decision buttons
- [ ] **APP-16**: Wizard/stepper -- multi-step onboarding, guided room setup, methodology pipeline progress
- [ ] **APP-17**: Red Team Report -- attack vectors as severity-rated cards with "Defend" action buttons, each defense tracked as assumption with evidence
- [ ] **APP-18**: Bias Heatmap -- section-level bias risk visualization (confirmation=dark red, anchoring=yellow, balanced=green), click to see specific bias instances
- [ ] **APP-19**: Assumption Validity Dashboard -- visual assumption lifecycle cards stacked by section, color-coded validity (green=supported, yellow=untested, red=contradicted, gray=stale), evidence for/against per assumption

## Co-Development Infrastructure

- [ ] **CODEV-01**: Shared lib/core/ contract -- every core module exports both sync and async, plugin and MCP server import same functions
- [ ] **CODEV-02**: Dual-ship CI rule -- PR check validates new MCP tools have matching plugin commands (and vice versa)
- [ ] **CODEV-03**: Test harness -- validates both plugin hooks and MCP tool calls produce identical results for same inputs

## Cross-Platform Testing

- [ ] **TEST-01**: MCP Apps render correctly on Claude Desktop
- [ ] **TEST-02**: MCP Apps render correctly on ChatGPT (verify Apps SDK compatibility)
- [ ] **TEST-03**: MCP server works on OpenClaw via stdio transport
- [ ] **TEST-04**: Guard for Claude.ai postMessage bug (issue #47) in all app HTML

## Future Requirements (Deferred)

- OpenClaw cousin plugin (dedicated skill files, channel adapters)
- Session conversation auto-capture into fragments table via hooks
- MCP Apps for: Grading Scorecard, Opportunity Board, Pipeline Monitor, Persona Gallery
- Cross-room ATTACH database queries
- MCP Apps offline mode / state persistence across conversations
- MemPalace-style AAAK compression for memory tiers
- 3D knowledge graph (Three.js MCP App)

## Out of Scope

- Replacing Neo4j Brain with SQLite (Brain stays remote, Cypher-native, the moat)
- Full Larry personality in MCP server (host LLMs get Larry Lite methodology instinct, not voice)
- MCP Apps for Cursor/Windsurf (no MCP Apps support yet -- tools-only on those platforms)
- Mobile/native apps (MCP Apps covers this via chat clients)
- Payment processing (handled externally)

## Traceability

| REQ | Phase | Status |
|-----|-------|--------|
| SQLITE-01 | Phase 77: SQLite Foundation | Pending |
| SQLITE-02 | Phase 77: SQLite Foundation | Pending |
| SQLITE-03 | Phase 77: SQLite Foundation | Pending |
| SQLITE-04 | Phase 78: Memory Layer + Assumptions | Pending |
| SQLITE-05 | Phase 78: Memory Layer + Assumptions | Pending |
| SQLITE-06 | Phase 79: SQLite Migration + Cleanup | Pending |
| SQLITE-07 | Phase 79: SQLite Migration + Cleanup | Pending |
| SQLITE-08 | Phase 79: SQLite Migration + Cleanup | Pending |
| SQLITE-09 | Phase 79: SQLite Migration + Cleanup | Pending |
| MCP-01 | Phase 81: MCP Server Core | Pending |
| MCP-02 | Phase 82: Goal-Oriented Tools | Pending |
| MCP-03 | Phase 82: Goal-Oriented Tools | Pending |
| MCP-04 | Phase 82: Goal-Oriented Tools | Pending |
| MCP-05 | Phase 82: Goal-Oriented Tools | Pending |
| MCP-06 | Phase 82: Goal-Oriented Tools | Pending |
| MCP-07 | Phase 82: Goal-Oriented Tools | Pending |
| MCP-08 | Phase 82: Goal-Oriented Tools | Pending |
| MCP-09 | Phase 82: Goal-Oriented Tools | Pending |
| MCP-10 | Phase 82: Goal-Oriented Tools | Pending |
| MCP-11 | Phase 82: Goal-Oriented Tools | Pending |
| MCP-12 | Phase 81: MCP Server Core | Pending |
| MCP-13 | Phase 81: MCP Server Core | Pending |
| MCP-14 | Phase 81: MCP Server Core | Pending |
| MCP-15 | Phase 82: Goal-Oriented Tools | Pending |
| APP-01 | Phase 80: De Stijl Component Library + App Foundation | Pending |
| APP-02 | Phase 84: MCP Apps - Core Views | Pending |
| APP-03 | Phase 84: MCP Apps - Core Views | Pending |
| APP-04 | Phase 84: MCP Apps - Core Views | Pending |
| APP-05 | Phase 84: MCP Apps - Core Views | Pending |
| APP-06 | Phase 85: MCP Apps - Methodology + Meeting | Pending |
| APP-07 | Phase 85: MCP Apps - Methodology + Meeting | Pending |
| APP-08 | Phase 85: MCP Apps - Methodology + Meeting | Pending |
| APP-09 | Phase 85: MCP Apps - Methodology + Meeting | Pending |
| APP-10 | Phase 80: De Stijl Component Library + App Foundation | Pending |
| APP-11 | Phase 80: De Stijl Component Library + App Foundation | Pending |
| APP-12 | Phase 86: MCP Apps - Interaction Primitives | Pending |
| APP-13 | Phase 86: MCP Apps - Interaction Primitives | Pending |
| APP-14 | Phase 86: MCP Apps - Interaction Primitives | Pending |
| APP-15 | Phase 86: MCP Apps - Interaction Primitives | Pending |
| APP-16 | Phase 86: MCP Apps - Interaction Primitives | Pending |
| APP-17 | Phase 85: MCP Apps - Methodology + Meeting | Pending |
| APP-18 | Phase 85: MCP Apps - Methodology + Meeting | Pending |
| APP-19 | Phase 84: MCP Apps - Core Views | Pending |
| CODEV-01 | Phase 83: Co-Development Infrastructure | Pending |
| CODEV-02 | Phase 83: Co-Development Infrastructure | Pending |
| CODEV-03 | Phase 83: Co-Development Infrastructure | Pending |
| TEST-01 | Phase 87: Cross-Platform Testing | Pending |
| TEST-02 | Phase 87: Cross-Platform Testing | Pending |
| TEST-03 | Phase 87: Cross-Platform Testing | Pending |
| TEST-04 | Phase 87: Cross-Platform Testing | Pending |
