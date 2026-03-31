# Roadmap: MindrianOS Plugin

## Milestones

- v1.0 MVP -- Phases 1-5 (shipped 2026-03-22)
- v2.0 Meeting Intelligence -- Phases 6-9 (shipped 2026-03-24)
- v3.0 MCP Platform & Intelligence Expansion -- Phases 10-19 (shipped 2026-03-25)
- v4.0 Brain API Control & CLI UI Ruling System -- Phases 20-25 (shipped 2026-03-29)
- v5.0 Data Room Presentation System -- Phases 26-33 (shipped 2026-03-31)
- v5.1 User Outlets -- Phases 34-38 (in progress)

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

<details>
<summary>v5.0 Data Room Presentation System (Phases 26-33) -- SHIPPED 2026-03-31</summary>

- [x] Phase 26: Git Integration (2/2 plans) -- 2026-03-30
- [x] Phase 27: Filing Pipeline + KuzuDB Engine (4/4 plans) -- 2026-03-30
- [x] Phase 27.1: HSI + Reverse Salient Pipeline (2/2 plans) -- 2026-03-31
- [x] Phase 28: Binary Asset Filing (1/1 plans) -- 2026-03-31
- [x] Phase 29: Canvas Graph Renderer (1/1 plans) -- 2026-03-31
- [x] Phase 30: Presentation Generator (3/3 plans) -- 2026-03-31
- [x] Phase 31: Auto-Update + Deploy Pipeline (2/2 plans) -- 2026-03-31
- [x] Phase 32: Generative UI + Chat (2/2 plans) -- 2026-03-31
- [x] Phase 33: Interactive Onboarding System (spec complete) -- 2026-03-31

See: `.planning/milestones/v5.0-ROADMAP.md`

</details>

### v5.1 User Outlets (In Progress)

**Milestone Goal:** Make MindrianOS's power reachable -- wire user-facing commands to built infrastructure, build onboarding, and ensure everything from v5.0 actually works from a user's perspective. No new infrastructure -- just outlets.

- [x] **Phase 34: CLI Identity** - Mondrian banner fires reliably on cold start, update, and on-demand via /mos:splash (completed 2026-03-31)
- [x] **Phase 35: Interactive Onboarding** - First-install detection, Larry-voiced walkthrough, USER.md generation, update path (completed 2026-03-31)
- [ ] **Phase 36: Command Wiring** - Five new /mos: commands connecting users to existing presentation, graph, and meeting infrastructure
- [ ] **Phase 37: JTBD Warm Start** - Larry reads room state and frames session nudges as job acceleration, not feature descriptions
- [ ] **Phase 38: End-to-End Validation** - Phase 32-02 generative tools verified, full install-to-share flow tested

## Phase Details

### Phase 34: CLI Identity
**Goal**: User sees MindrianOS identity on every meaningful session boundary -- cold start, update, and on-demand
**Depends on**: Nothing (banner script already exists at scripts/banner)
**Requirements**: BANNER-01, BANNER-02, BANNER-03
**Success Criteria** (what must be TRUE):
  1. User sees Mondrian banner automatically on first-ever cold start (no manual command needed)
  2. User sees Mondrian banner with version diff after plugin update (shows old -> new version)
  3. User can type /mos:splash and see the Mondrian banner at any time
  4. Banner renders correctly across standard terminal widths (80-200 columns)
**Plans**: 1 plan

Plans:
- [ ] 34-01: Wire banner into session-start hook + create /mos:splash command + terminal width handling

### Phase 35: Interactive Onboarding
**Goal**: New users are guided through MindrianOS by Larry's voice; returning users see what changed since last session
**Depends on**: Phase 34 (banner fires before onboarding begins)
**Requirements**: ONBOARD-01, ONBOARD-02, ONBOARD-03, ONBOARD-04, ONBOARD-05
**Success Criteria** (what must be TRUE):
  1. System detects first install (no ~/.mindrian-onboarded marker) and auto-triggers walkthrough
  2. User experiences 7-step Larry-voiced walkthrough where every step is individually skippable
  3. USER.md file is generated from onboarding conversation with user's stated goals and context
  4. Returning user after update sees "What's New" highlights pulled from CHANGELOG entries
  5. User can type /mos:onboard to re-run the full onboarding flow at any time
**Plans**: 2 plans
**Spec**: .planning/phases/33-interactive-onboarding-system/ (Phase 33 design work reused)

Plans:
- [x] 35-01-PLAN.md -- First-install detection (scripts/check-onboard) + session-start integration + marker file
- [x] 35-02-PLAN.md -- 7-step walkthrough command (commands/onboard.md) + USER.md generation + CHANGELOG onboarding registry (D-NEW-1)

### Phase 36: Command Wiring
**Goal**: Users can reach all existing infrastructure through five discoverable /mos: commands -- no new scripts, just markdown command files that tell Larry what to call
**Depends on**: Phase 35 (onboarding introduces these commands to users)
**Requirements**: WIRE-01, WIRE-02, WIRE-03, WIRE-04, WIRE-05
**Success Criteria** (what must be TRUE):
  1. User types /mos:present and gets all 6 presentation views generated with dashboard opening in browser
  2. User types /mos:dashboard and gets interactive graph with chat panel in browser
  3. User types /mos:speakers and sees formatted speaker profiles from filed meetings
  4. User types /mos:reanalyze and intelligence re-runs on already-filed meetings with progress feedback
  5. User types /mos:graph and gets direct KuzuDB exploration (query interface, not raw Cypher)
**Plans**: 2 plans
**UI hint**: yes

Plans:
- [ ] 36-01-PLAN.md -- /mos:present + /mos:dashboard (presentation + graph browser views)
- [ ] 36-02-PLAN.md -- /mos:speakers + /mos:reanalyze + /mos:graph (meeting + graph exploration)

### Phase 37: JTBD Warm Start
**Goal**: Larry's session greeting tells users what they can DO next based on their room state, not what features exist
**Depends on**: Phase 36 (commands must exist for Larry to recommend them)
**Requirements**: JTBD-01, JTBD-02, JTBD-03
**Success Criteria** (what must be TRUE):
  1. Larry reads room STATE.md and identifies what the user has (meetings, sections, graph) before suggesting next actions
  2. Every nudge follows "You have [state]. /mos:X [outcome that matters to you]" -- max 2-3 per session, never feature descriptions
  3. Command suggestions adapt to what user hasn't tried yet (user who already used /mos:present gets different nudges)
**Plans**: TBD

Plans:
- [ ] 37-01: Room state reader + JTBD nudge engine in session-start skill + dynamic command menu

### Phase 38: End-to-End Validation
**Goal**: Everything from v5.0 and v5.1 works as a cohesive user experience from install to share
**Depends on**: Phase 37 (all user-facing features must be complete before validation)
**Requirements**: VAL-01, VAL-02
**Success Criteria** (what must be TRUE):
  1. Phase 32-02 generative tools (highlightCluster, filterEdgeType, showInsight) execute correctly when called from browser chat
  2. Full flow works end-to-end: fresh install -> onboard -> file a meeting -> /mos:present -> share deployed link
  3. All 6 presentation views (dashboard, wiki, deck, insights, diagrams, graph) render correctly with actual room data
**Plans**: TBD

Plans:
- [ ] 38-01: Verify 32-02 generative tools + execute full install-to-share flow test

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 34. CLI Identity | v5.1 | 0/1 | Complete    | 2026-03-31 |
| 35. Interactive Onboarding | v5.1 | 2/2 | Complete    | 2026-03-31 |
| 36. Command Wiring | v5.1 | 0/2 | Not started | - |
| 37. JTBD Warm Start | v5.1 | 0/1 | Not started | - |
| 38. End-to-End Validation | v5.1 | 0/1 | Not started | - |
