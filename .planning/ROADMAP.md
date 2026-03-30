# Roadmap: MindrianOS Plugin

## Milestones

- v1.0 MVP -- Phases 1-5 (shipped 2026-03-22)
- v2.0 Meeting Intelligence -- Phases 6-9 (shipped 2026-03-24)
- v3.0 MCP Platform & Intelligence Expansion -- Phases 10-19 (shipped 2026-03-25)
- v4.0 Brain API Control & CLI UI Ruling System -- Phases 20-25 (shipped 2026-03-29)
- v5.0 Data Room Presentation System -- Phases 26-32 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-5) -- SHIPPED 2026-03-22</summary>

- [x] Phase 1: Install and Larry Talks (3/3 plans) -- 2026-03-20
- [x] Phase 2: Core Methodologies (5/5 plans) -- 2026-03-22
- [x] Phase 3: Pipeline Chaining (2/2 plans) -- 2026-03-22
- [x] Phase 3.1: Data Room Dashboard (2/2 plans) -- 2026-03-22
- [x] Phase 3.2: Document Generation (2/2 plans) -- 2026-03-22
- [x] Phase 4: Brain MCP Toolbox (3/3 plans) -- 2026-03-22
- [x] Phase 5: Plugin Intelligence (3/3 plans) -- 2026-03-22

See: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>v2.0 Meeting Intelligence (Phases 6-9) -- SHIPPED 2026-03-24</summary>

- [x] Phase 6: Stage 1 Core Capability (4/4 plans) -- 2026-03-23
- [x] Phase 7: Team Room Structure (3/3 plans) -- 2026-03-23
- [x] Phase 8: Cross-Meeting Intelligence (3/3 plans) -- 2026-03-24
- [x] Phase 9: Meeting Knowledge Graph (3/3 plans) -- 2026-03-24

See: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>v3.0 MCP Platform & Intelligence Expansion (Phases 10-19) -- SHIPPED 2026-03-25</summary>

- [x] Phase 10: Shared Core + CLI Tools (2/2 plans) -- 2026-03-24
- [x] Phase 11: MCP Server (3/3 plans) -- 2026-03-24
- [x] Phase 12: Brain Hosting (2/2 plans) -- 2026-03-24
- [x] Phase 13: Opportunity Bank + Funding Room (3/3 plans) -- 2026-03-25
- [x] Phase 14: AI Team Personas (2/2 plans) -- 2026-03-25
- [x] Phase 15: User Knowledge Graph (3/3 plans) -- 2026-03-25
- [x] Phase 16: Reasoning Engine (3/3 plans) -- 2026-03-25
- [x] Phase 17: Visual Identity -- De Stijl CLI (3/3 plans) -- 2026-03-25
- [x] Phase 18: Dynamic Integration Prompting (2/2 plans) -- 2026-03-25
- [x] Phase 19: Wikipedia Data Room Dashboard (3/3 plans) -- 2026-03-25

See: `.planning/milestones/v3.0-ROADMAP.md`

</details>

<details>
<summary>v4.0 Brain API Control & CLI UI Ruling System (Phases 20-25) -- SHIPPED 2026-03-29</summary>

- [x] Phase 20: Brain API Control (2/2 plans) -- 2026-03-29
- [x] Phase 21: CLI UI Ruling System (2/2 plans) -- 2026-03-29
- [x] Phase 22: Admin Panel (1/1 plans) -- 2026-03-29
- [x] Phase 23: Multi-Room Management (3/3 plans) -- 2026-03-29
- [x] Phase 24: Autonomous Engine (2/2 plans) -- 2026-03-29
- [x] Phase 25: Data Room Export Template v2 (2/2 plans) -- 2026-03-29

See: `.planning/milestones/v4.0-ROADMAP.md`

</details>

### v5.0 Data Room Presentation System (In Progress)

- [x] **Phase 26: Git Integration** - Every room becomes a GitHub repo with auto-commit and auto-push on every filing (completed 2026-03-30)
- [ ] **Phase 27: Filing Pipeline + KuzuDB Engine** - Complete filing cascade (classify -> KuzuDB -> graph -> presentation -> git) with relationship intelligence
- [ ] **Phase 28: Binary Asset Filing** - PDFs, images, videos filed with manifests and displayed in presentation views
- [ ] **Phase 29: Canvas Graph Renderer** - Custom Canvas 2D graph with force simulation, particles, glow, and cluster highlighting (Milken Twin pattern)
- [ ] **Phase 30: Presentation Generator** - All 6 views (dashboard, wiki, deck, insights, diagrams, graph) with dual themes and branding
- [ ] **Phase 31: Auto-Update + Deploy Pipeline** - Localhost live reload, Vercel onboarding, auto-deploy on push, privacy controls
- [ ] **Phase 32: Generative UI + Chat** - Larry generates views conversationally in deployed site with BYOAPI chat panel

## Phase Details

### Phase 26: Git Integration
**Goal**: Every room CAN be a GitHub repo with automatic version control on every filing -- but users can opt out and stay purely local
**Depends on**: Phase 25 (Data Room Export Template v2)
**Requirements**: GIT-01, GIT-02, GIT-03, GIT-04, GIT-05, GIT-06
**Plans:** 2/2 plans complete
Plans:
- [x] 26-01-PLAN.md -- Git infrastructure: scripts/git-ops, lib/core/git-ops.cjs, registry extension, post-write hook
- [x] 26-02-PLAN.md -- New project git offer, gh CLI detection, /mos:rooms git-setup subcommand
**Success Criteria** (what must be TRUE):
  1. Running `/mos:new-project` offers to create a local git repo, a GitHub remote, and push the initial room structure -- but user can decline
  2. Every artifact written to the room (methodology, meeting, manual) results in a git commit with a descriptive provenance message -- only if git is initialized
  3. Commits auto-push to GitHub (configurable: auto/manual/off, default off)
  4. Binary files over 10MB are tracked via Git LFS automatically -- only when git is active
  5. If `gh` CLI is missing, the user gets a guided install flow instead of a cryptic error

### Phase 27: Filing Pipeline + KuzuDB Engine
**Goal**: Every filing triggers the complete cascade -- classify, KuzuDB index, compute-state, build-graph, generate-presentation, git commit, push -- with rich relationship intelligence
**Depends on**: Phase 26
**Requirements**: FILE-01, FILE-02, FILE-03, FILE-04, FILE-05, KUZU-01, KUZU-02, KUZU-03, KUZU-04, KUZU-05, ROOM-01, ROOM-02, ROOM-03, ROOM-04
**Plans:** 4 plans
Plans:
- [ ] 27-01-PLAN.md -- KuzuDB schema extension: Meeting, Speaker, Assumption node types + confidence edges + assumption indexing
- [ ] 27-02-PLAN.md -- Complete post-write cascade + artifact IDs + build-graph-from-kuzu.cjs
- [ ] 27-03-PLAN.md -- Meeting + speaker KuzuDB integration + SEGMENT_OF/SPOKE_IN/CONSULTED_ON edges
- [ ] 27-04-PLAN.md -- Room structure contract: STATE.md maintenance, cross-room detection, proactive intelligence persistence
**Success Criteria** (what must be TRUE):
  1. Filing any artifact (methodology session, meeting segment, manual entry, pipeline output, reasoning file) triggers the full chain ending in a git push
  2. Every artifact gets a stable hash ID in frontmatter and KuzuDB nodes + edges are created with typed relationships (INFORMS, CONTRADICTS, CONVERGES, ENABLES, SEGMENT_OF, CONSULTED_ON)
  3. graph.json is generated from KuzuDB queries (not just file scanning) with confidence scores on edges
  4. Assumptions are tracked as first-class KuzuDB entities with validity status that surfaces in the graph
  5. Room STATE.md and MINTO.md stay current after every filing, and proactive intelligence persists with repeat suppression

### Phase 28: Binary Asset Filing
**Goal**: PDFs, images, videos, and meeting recordings are filed as first-class room artifacts with manifests and cross-references
**Depends on**: Phase 27
**Requirements**: ASSET-01, ASSET-02, ASSET-03, ASSET-04
**Success Criteria** (what must be TRUE):
  1. A PDF, image, or video filed to the room gets a markdown wrapper with frontmatter in the correct section folder
  2. ASSET_MANIFEST.md is automatically updated listing all binary assets with metadata
  3. Meeting audio/video files are filed in meetings/ with a link to their transcript
**Plans**: TBD

### Phase 29: Canvas Graph Renderer
**Goal**: A custom Canvas 2D graph replaces Cytoscape with force simulation, animated particles, glow effects, and cluster highlighting -- the Milken Twin visual pattern
**Depends on**: Phase 27 (needs graph.json from KuzuDB)
**Requirements**: GRAPH-01, GRAPH-02, GRAPH-03, GRAPH-04, GRAPH-05, GRAPH-06, GRAPH-07, GRAPH-08
**Success Criteria** (what must be TRUE):
  1. The graph renders on Canvas 2D (~330 lines) with circular nodes sized by centrality, section-colored at 60% opacity, and force simulation positioning
  2. Animated particles travel along edges and glow rings pulse on core nodes, creating a living data-flow visualization
  3. Hovering a node dims everything else to 0.15 opacity while connected nodes stay bright, and clicking opens a detail panel with artifact summary
  4. `highlightCluster(group)` can be called programmatically to highlight any keyword/tag group
  5. Edge types are visually distinct: INFORMS (thin gray arrow), CONTRADICTS (dashed red), CONVERGES (dotted gold), ENABLES (solid blue arrow)
**Plans**: TBD
**UI hint**: yes

### Phase 30: Presentation Generator
**Goal**: One command produces all 6 self-contained HTML views from any room, with dual design themes and enforced branding
**Depends on**: Phase 28, Phase 29
**Requirements**: PRES-01, PRES-02, PRES-03, PRES-04, PRES-05, PRES-06, PRES-07, PRES-08, PRES-09
**Success Criteria** (what must be TRUE):
  1. Running `generate-presentation` on any room produces 6 HTML files: index.html (dashboard), wiki.html, deck.html, insights.html, diagrams.html, graph.html
  2. Dashboard shows stats bar, 6 view cards, video embed, assets grid, partners, opportunities, and governing thought
  3. Wiki provides 3-panel browsing with collapsible sidebar, search, TOC, infobox, [[wikilinks]], and section colors
  4. Both De Stijl dark (default) and PWS light themes render correctly across all 6 views
  5. Every generated view contains the MindrianOS logo header, "Built with MindrianOS" footer, and Mondrian color bar (non-removable branding)
**Plans**: TBD
**UI hint**: yes

### Phase 31: Auto-Update + Deploy Pipeline
**Goal**: Room changes appear in the browser within seconds (localhost) and deployed sites stay current via Vercel auto-deploy, with guided onboarding and privacy controls
**Depends on**: Phase 30
**Requirements**: SYNC-01, SYNC-02, SYNC-03, DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04, DEPLOY-05
**Success Criteria** (what must be TRUE):
  1. Localhost: chokidar watches the room folder and SSE triggers browser reload within ~1 second of any filing
  2. Post-write hook regenerates presentation views within ~2-3 seconds of any artifact change
  3. `/mos:publish` guides the user through one-time Vercel setup (link project, first deploy, optional custom domain) in under 5 minutes
  4. Every git push triggers Vercel auto-deploy so the shareable URL is always current (~30s latency)
  5. User can selectively publish sections (`--sections`) or deploy with password protection (`--private`)
**Plans**: TBD
**UI hint**: yes

### Phase 32: Generative UI + Chat
**Goal**: Visitors to a deployed room can chat with Larry who generates filtered views and visual highlights conversationally, using their own API key
**Depends on**: Phase 31
**Requirements**: GENUI-01, GENUI-02, GENUI-03, GENUI-04
**Success Criteria** (what must be TRUE):
  1. Larry can generate UI components declaratively via Vercel json-render integration in the deployed site
  2. `highlightCluster()` is wired as an AI tool call -- Larry saying "show me market analysis" highlights those graph nodes
  3. A visitor can enter their own API key in a BYOAPI chat panel (stored in localStorage) and converse with Larry directly from the browser
  4. Asking "show me contradictions" produces a filtered graph view with contradicting nodes highlighted plus an analysis card
**Plans**: TBD
**UI hint**: yes

## Progress

| Milestone | Phases | Plans | Status | Shipped |
|-----------|--------|-------|--------|---------|
| v1.0 MVP | 1-5 | 20/20 | Complete | 2026-03-22 |
| v2.0 Meeting Intelligence | 6-9 | 13/13 | Complete | 2026-03-24 |
| v3.0 MCP Platform | 10-19 | 26/26 | Complete | 2026-03-25 |
| v4.0 Brain API & CLI UI | 20-25 | 12/12 | Complete | 2026-03-29 |
| v5.0 Data Room Presentation | 26-32 | 6/TBD | In progress | - |

**Execution Order:**
Phases execute in numeric order: 26 -> 27 -> 28 -> 29 -> 30 -> 31 -> 32
Note: Phase 29 depends on Phase 27 (not 28), so 28 and 29 could theoretically parallelize.
