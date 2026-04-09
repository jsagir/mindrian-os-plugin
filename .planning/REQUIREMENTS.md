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

## MCP Server

- [ ] **MCP-01**: 5-7 router tools (not 23 flat) covering Brain, Room, Graph, Methodology, Export, Meeting, Compute
- [ ] **MCP-02**: Brain router: brain_ask, brain_query, brain_search, brain_grade, brain_route, brain_chain as subcommands
- [ ] **MCP-03**: Room router: room_analyze, room_state, room_file, room_sections as subcommands
- [ ] **MCP-04**: Compute router: hsi_score, reverse_salients, whitespace_detect, blindspot, surprise, novelty, disruption as subcommands
- [ ] **MCP-05**: Larry Lite server instructions (methodology instinct, not personality) -- teaches host LLMs tool orchestration
- [ ] **MCP-06**: stdio transport (local Desktop) + Streamable HTTP transport (remote/OpenClaw) on same server
- [ ] **MCP-07**: Shared lib/core/*.cjs contract -- every core module callable from both plugin hooks and MCP tool handlers
- [ ] **MCP-08**: Text-to-Cypher -- natural language questions translated to Cypher queries against Brain Neo4j (21K nodes), executed via brain_query, structured results returned
- [ ] **MCP-09**: Cypher-to-Text -- raw Cypher query results translated back to natural language explanations, graph traversal results rendered as readable insights

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
| SQLITE-01 through SQLITE-09 | TBD | Pending |
| MCP-01 through MCP-09 | TBD | Pending |
| APP-01 through APP-16 | TBD | Pending |
| CODEV-01 through CODEV-03 | TBD | Pending |
| TEST-01 through TEST-04 | TBD | Pending |
