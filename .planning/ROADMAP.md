# Roadmap: MindrianOS Plugin

## Milestones

- ✅ **v1.0 MVP** — Phases 1-5 (shipped 2026-03-22)
- ✅ **v2.0 Meeting Intelligence** — Phases 6-9 (shipped 2026-03-24)
- 🚧 **v3.0 MCP Platform & Intelligence Expansion** — Phases 10-14

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-5) — SHIPPED 2026-03-22</summary>

- [x] Phase 1: Install and Larry Talks (3/3 plans) — 2026-03-20
- [x] Phase 2: Core Methodologies (5/5 plans) — 2026-03-22
- [x] Phase 3: Pipeline Chaining (2/2 plans) — 2026-03-22
- [x] Phase 3.1: Data Room Dashboard (2/2 plans) — 2026-03-22
- [x] Phase 3.2: Document Generation (2/2 plans) — 2026-03-22
- [x] Phase 4: Brain MCP Toolbox (3/3 plans) — 2026-03-22
- [x] Phase 5: Plugin Intelligence (3/3 plans) — 2026-03-22

See: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Meeting Intelligence (Phases 6-9) — SHIPPED 2026-03-24</summary>

- [x] Phase 6: Stage 1 Core Capability (4/4 plans) — 2026-03-23
- [x] Phase 7: Team Room Structure (3/3 plans) — 2026-03-23
- [x] Phase 8: Cross-Meeting Intelligence (3/3 plans) — 2026-03-24
- [x] Phase 9: Meeting Knowledge Graph (3/3 plans) — 2026-03-24

See: `.planning/milestones/v2.0-ROADMAP.md`

</details>

### v3.0 MCP Platform & Intelligence Expansion

**Milestone Goal:** Deliver MindrianOS as a dual-surface platform (CLI plugin + MCP server) so Desktop/Cowork users access all capabilities, then expand with Opportunity Bank, Funding Room, and AI Team Personas. **Every feature ships to both surfaces — no exceptions.**

- [x] **Phase 10: Shared Core + CLI Tools** - Extract mindrian-tools.cjs entry point and core modules that both CLI and MCP share (completed 2026-03-24)
- [x] **Phase 11: MCP Server** - Expose all plugin capabilities to Desktop/Cowork via hierarchical MCP tools, resources, and prompts (completed 2026-03-24)
- [x] **Phase 12: Brain Hosting** - Deploy Brain as remote MCP service on Render with API key auth (COLLAB-02/03 deferred to v4.0) (completed 2026-03-24)
- [x] **Phase 13: Opportunity Bank + Funding Room** - Add grant discovery and funding lifecycle sections to the Data Room (completed 2026-03-25)
- [x] **Phase 14: AI Team Personas** - Generate domain expert perspectives from room intelligence using De Bono framework (completed 2026-03-25)
- [x] **Phase 15: User Knowledge Graph** - Per-project queryable LazyGraph using KuzuDB (embedded) for inter-room relationships + Pinecone semantic search (completed 2026-03-25)
- [x] **Phase 16: Reasoning Engine** - Per-section reasoning files + autonomous methodology orchestration + persistent chain-of-thought across all platforms (completed 2026-03-25)

## Phase Details

### Phase 10: Shared Core + CLI Tools
**Goal**: Plugin operations callable from a single Node.js entry point, enabling both CLI commands and future MCP tools to share identical logic
**Depends on**: Nothing (v3.0 foundation)
**Requirements**: CORE-01, CORE-02
**Success Criteria** (what must be TRUE):
  1. Running `node bin/mindrian-tools.cjs <subcommand>` executes the same logic as the corresponding Bash script
  2. Adding a new room section folder (e.g., opportunity-bank/) causes compute-state and analyze-room to discover it without code changes
  3. Existing hook scripts can call mindrian-tools.cjs for complex operations and receive structured output
  4. All 41 existing CLI commands continue to work identically after core extraction
**Plans**: 2 plans

Plans:
- [x] 10-01-PLAN.md — Core library modules, mindrian-tools.cjs entry point, test fixtures
- [x] 10-02-PLAN.md — Dynamic section discovery refactoring, P1 module wrappers

### Phase 11: MCP Server
**Goal**: Desktop and Cowork users can access every plugin capability through an MCP server without ever touching CLI
**Depends on**: Phase 10
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, CORE-03, COLLAB-01
**Success Criteria** (what must be TRUE):
  1. User adds one line to claude_desktop_config.json and all MindrianOS capabilities appear in Claude Desktop
  2. User can browse room state, sections, and artifacts as MCP Resources without making tool calls
  3. User can run methodology workflows (file meeting, run analysis, grade venture) via MCP Prompts pre-loaded with room context
  4. Larry personality and teaching mode behave identically in MCP context as in CLI
  5. CI parity check fails when a CLI command exists without a corresponding MCP tool
**Plans**: 3 plans

Plans:
- [x] 11-01-PLAN.md — MCP server skeleton, npm setup, hierarchical tool router (6 tools, 41 commands)
- [x] 11-02-PLAN.md — MCP Resources (room:// URI scheme) and Prompts (methodology workflows with Larry personality)
- [x] 11-03-PLAN.md — CLI/MCP parity check script and end-to-end verification

### Phase 12: Brain Hosting
**Goal**: Deploy Brain as a remote MCP service so paid-tier users connect from any surface with one config entry
**Depends on**: Phase 10 (can run parallel with Phase 11)
**Requirements**: BRAIN-01, BRAIN-02, BRAIN-03
**Success Criteria** (what must be TRUE):
  1. Desktop/Cowork user can add Brain MCP to their config and receive enriched intelligence identical to CLI users
  2. Brain access is gated by API key — requests without valid key are rejected with clear error
**Plans**: 2 plans

Plans:
- [ ] 12-01-PLAN.md — Brain MCP server (Express + StreamableHTTP, auth, Neo4j + Pinecone tools, smoke test)
- [ ] 12-02-PLAN.md — Render deployment config, user documentation, end-to-end verification

### Phase 13: Opportunity Bank + Funding Room
**Goal**: The Data Room proactively discovers grant opportunities and tracks funding lifecycle — accessible from both CLI plugin and MCP server
**Depends on**: Phase 10 (dynamic section discovery), Phase 11 (MCP tools for Desktop/Cowork delivery)
**Requirements**: OPP-01, OPP-02, OPP-03, OPP-04, FUND-01, FUND-02, FUND-03, FUND-04
**Dual delivery**: CLI commands + MCP tools for every capability
**Success Criteria** (what must be TRUE):
  1. User sees relevant grant opportunities filed in room/opportunity-bank/ with relevance scores and source provenance after session start
  2. Discovered opportunities appear in analyze-room intelligence output alongside existing DD sections
  3. User can create a per-grant folder in room/funding/ with lifecycle stages (Discovered through Awarded/Rejected)
  4. Grant progress with deadlines and next actions is tracked in the funding section STATE.md
  5. Cross-references link funding entries back to their opportunity-bank sources
  6. All Opportunity Bank and Funding Room operations work identically via CLI commands and MCP tools (Desktop/Cowork)
**Plans**: 3 plans

Plans:
- [ ] 13-01-PLAN.md — Core module, reference templates, test fixtures, test suite
- [ ] 13-02-PLAN.md — Context-driven grant discovery, opportunity filing, CLI + MCP integration
- [ ] 13-03-PLAN.md — Funding lifecycle management, cross-references, CLI + MCP integration

### Phase 14: AI Team Personas
**Goal**: Larry can adopt domain expert perspectives generated from room intelligence — accessible from both CLI plugin and MCP server
**Depends on**: Phase 13 (rich room content produces venture-specific personas)
**Requirements**: PERS-01, PERS-02, PERS-03, PERS-04
**Dual delivery**: CLI commands + MCP tools for every capability
**Success Criteria** (what must be TRUE):
  1. User can generate domain expert personas from current room state, stored as structured markdown in personas/ folder
  2. Each persona maps to a De Bono Thinking Hat and argues consistently from that perspective
  3. Larry can invoke any persona for multi-perspective analysis on a room artifact, producing distinct viewpoints
  4. Every persona output includes a "perspective lens" disclaimer and never claims expert authority
  5. All persona operations work identically via CLI commands and MCP tools (Desktop/Cowork)
**Plans**: 2 plans

Plans:
- [ ] 14-01-PLAN.md — Core persona-ops.cjs module, reference templates, test fixtures, test suite
- [ ] 14-02-PLAN.md — CLI routing, MCP tool registration, command docs, parity verification

### Phase 15: User Knowledge Graph
**Goal**: Each room automatically builds a queryable LazyGraph from its artifacts — .md files manage intra-section context, KuzuDB manages inter-room relationships as they evolve
**Depends on**: Phase 10 (dynamic section discovery), Phase 13 (room sections with content)
**Requirements**: GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-04, GRAPH-05
**Dual delivery**: CLI commands + MCP tools for every capability
**Success Criteria** (what must be TRUE):
  1. Room artifacts automatically indexed as KuzuDB nodes (embedded, one DB per project in room/.lazygraph/)
  2. Cross-references (INFORMS, CONTRADICTS, CONVERGES, ENABLES, INVALIDATES) stored as typed edges
  3. User can query their project graph via /mos:query with natural language (Larry translates to Cypher)
  4. Room artifacts embedded in user-owned Pinecone index for semantic search (optional Tier 2)
  5. Graph auto-updates when new artifacts are filed (hook-driven)
  6. All graph operations work identically via CLI commands and MCP tools (Desktop/Cowork)
**Plans**: 3 plans

Plans:
- [ ] 15-01-PLAN.md — Core lazygraph-ops.cjs module, KuzuDB schema, test fixtures, test suite
- [ ] 15-02-PLAN.md — CLI routing, hook integration, MCP tool registration, NL query wiring
- [ ] 15-03-PLAN.md — Pinecone Tier 2 stub, /mos:query command docs, schema reference

### Phase 16: Reasoning Engine
**Goal**: MindrianOS captures, persists, and visualizes its critical thinking per room section — with autonomous methodology orchestration and chain-of-thought across all platforms
**Depends on**: Phase 15 (LazyGraph for graph edges), Phase 14 (Personas reference reasoning)
**Requirements**: REASON-01, REASON-02, REASON-03, REASON-04, REASON-05
**Dual delivery**: CLI commands + MCP tools for every capability
**Success Criteria** (what must be TRUE):
  1. Each room section can have a REASONING.md with Minto/MECE structured analysis, frontmatter dependency graph, and goal-backward verification
  2. Larry autonomously chains methodology tools in sequence (diagnose -> framework -> apply -> file -> cross-ref -> graph-update) captured as run artifacts
  3. Chain-of-thought is SAVED as .reasoning/ artifacts, not just displayed — future sessions read them
  4. Reasoning visualization works across CLI (blockquotes), Desktop (MCP prompts), and Cowork (shared state)
  5. All reasoning operations work identically via CLI commands and MCP tools
**Plans**: 3 plans

Plans:
- [ ] 16-01-PLAN.md — Core reasoning-ops.cjs module, reference templates, test fixtures, test suite
- [ ] 16-02-PLAN.md — CLI routing, MCP tool router integration, LazyGraph REASONING_INFORMS edge type
- [ ] 16-03-PLAN.md — MCP resources (reasoning://), MCP prompt, /mos:reason command docs, schema reference

### Phase 17: Visual Identity — De Stijl CLI
**Goal**: MindrianOS has a visually distinctive CLI experience — De Stijl symbolism, Unicode diagrams, ASCII charts, Mermaid in artifacts, color-coded edge types, venture stage indicators
**Depends on**: Phase 16 (reasoning traces reference visual vocabulary), Phase 15 (graph edges need visual encoding)
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04, VIS-05
**Dual delivery**: CLI output + Mermaid in .md files + browser dashboard
**Success Criteria** (what must be TRUE):
  1. MindrianOS symbol system (⬡ brand, ◌◎◉◆★ stages, →⊗⊕▶⊘ edges) used consistently across all commands, statusline, and traces
  2. Room structure visualized as Unicode box diagram showing sections, gaps, and cross-references
  3. ASCII sparklines/charts in compute-state and analyze-room output (asciichart)
  4. Mermaid diagram blocks embedded in room artifacts (.md files render in GitHub/Obsidian)
  5. /mos:visualize command generates rich diagrams (room flowchart, graph view, framework chain) and opens in browser
**Plans**: 3 plans

Plans:
- [ ] 17-01-PLAN.md — Symbol system module (visual-ops.cjs), De Stijl color palette, statusline enhancement
- [ ] 17-02-PLAN.md — Unicode room diagram + ASCII sparklines in compute-state and analyze-room
- [ ] 17-03-PLAN.md — Mermaid diagram generators, render-viz script, /mos:visualize command + CLI/MCP wiring

### Phase 18: Dynamic Integration Prompting
**Goal**: MindrianOS proactively detects when an MCP/API/plugin would enhance the user's workflow and offers to set it up
**Depends on**: Phase 12 (Brain hosting), Phase 17 (visual identity for prompts)
**Requirements**: INTEG-01, INTEG-02, INTEG-03
**Success Criteria** (what must be TRUE):
  1. Larry detects unmet capabilities and offers setup conversationally (Brain, Obsidian, Notion, Velma, meeting sources)
  2. Detection is non-blocking — always offers, never forces, never interrupts methodology sessions
  3. Integration status visible in /mos:status and statusline
**Plans**: 2 plans

Plans:
- [x] 18-01-PLAN.md — Integration registry module, detection patterns reference, skill file updates for offer behavior
- [ ] 18-02-PLAN.md — /mos:status integration table, session-start statusline, MCP tool router wiring

### Phase 19: Wikipedia Data Room Dashboard
**Goal**: Localhost wiki-style viewer where room sections are pages, KuzuDB edges are hyperlinks, with chat, search, De Stijl design, and auto-expanding as room fills
**Depends on**: Phase 15 (KuzuDB LazyGraph), Phase 17 (visual identity)
**Requirements**: WIKI-01, WIKI-02, WIKI-03, WIKI-04, WIKI-05
**Success Criteria** (what must be TRUE):
  1. Every room section renders as a Wikipedia-style page with TOC, infobox, backlinks, and "See also" from KuzuDB edges
  2. KuzuDB relationships become clickable hyperlinks between pages (INFORMS → navigate, CONTRADICTS → red warning)
  3. Chat interface scoped to current page context — user talks to the Data Room through Larry
  4. Full-text search across all room pages with instant results
  5. Auto-refreshes when room content changes (file watcher)
  6. De Stijl design with embedded Mermaid diagrams, images, and media
**Plans**: 3 plans

Plans:
- [ ] 19-01-PLAN.md — Express wiki server, markdown rendering pipeline, De Stijl layout, /mos:wiki command
- [ ] 19-02-PLAN.md — KuzuDB graph integration: hyperlinks from edges, backlinks, "See also", graph view page
- [ ] 19-03-PLAN.md — FlexSearch full-text search, chat panel (stub), chokidar auto-refresh, Mermaid/media rendering

## Progress

**Execution Order:**
Phases 11 and 12 can run in parallel after Phase 10 completes. Phase 13 requires Phase 10. Phase 14 requires Phase 13. Phase 16 requires Phase 15. Phase 17 requires Phase 16. Phase 18 and 19 can run in parallel after Phase 17.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-5 | v1.0 | 20/20 | Complete | 2026-03-22 |
| 6-9 | v2.0 | 13/13 | Complete | 2026-03-24 |
| 10. Shared Core + CLI Tools | 2/2 | Complete    | 2026-03-24 | - |
| 11. MCP Server | 3/3 | Complete    | 2026-03-24 | - |
| 12. Brain Hosting | 2/2 | Complete    | 2026-03-24 | - |
| 13. Opportunity Bank + Funding Room | 3/3 | Complete    | 2026-03-25 | - |
| 14. AI Team Personas | 2/2 | Complete    | 2026-03-25 | - |
