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
- [ ] **Phase 11: MCP Server** - Expose all plugin capabilities to Desktop/Cowork via hierarchical MCP tools, resources, and prompts
- [ ] **Phase 12: Brain Hosting + Room Collaboration** - Deploy Brain as remote MCP service and enable git-based team room sharing
- [ ] **Phase 13: Opportunity Bank + Funding Room** - Add grant discovery and funding lifecycle sections to the Data Room
- [ ] **Phase 14: AI Team Personas** - Generate domain expert perspectives from room intelligence using De Bono framework

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
- [ ] 11-01-PLAN.md — MCP server skeleton, npm setup, hierarchical tool router (6 tools, 41 commands)
- [ ] 11-02-PLAN.md — MCP Resources (room:// URI scheme) and Prompts (methodology workflows with Larry personality)
- [ ] 11-03-PLAN.md — CLI/MCP parity check script and end-to-end verification

### Phase 12: Brain Hosting + Room Collaboration
**Goal**: Paid-tier users connect to Brain from any surface, and teams share room state through git
**Depends on**: Phase 10 (can run parallel with Phase 11)
**Requirements**: BRAIN-01, BRAIN-02, BRAIN-03, COLLAB-02, COLLAB-03
**Success Criteria** (what must be TRUE):
  1. Desktop/Cowork user can add Brain MCP to their config and receive enriched intelligence identical to CLI users
  2. Brain access is gated by API key — requests without valid key are rejected with clear error
  3. Team members can clone a room git repo, work locally, push changes, and pull others' updates
  4. When two team members edit STATE.md concurrently, git sync resolves the conflict without data loss
**Plans**: TBD

Plans:
- [ ] 12-01: TBD
- [ ] 12-02: TBD

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
**Plans**: TBD

Plans:
- [ ] 13-01: TBD
- [ ] 13-02: TBD
- [ ] 13-03: TBD

### Phase 14: AI Team Personas
**Goal**: Larry can adopt domain expert perspectives generated from room intelligence — accessible from both CLI plugin and MCP server
**Depends on**: Phase 13 (rich room content produces venture-specific personas)
**Requirements**: PERS-01, PERS-02, PERS-03, PERS-04
**Dual delivery**: CLI commands + MCP tools for every capability
**Success Criteria** (what must be TRUE):
  1. User can generate domain expert personas from current room state, stored as structured markdown in team/ folder
  2. Each persona maps to a De Bono Thinking Hat and argues consistently from that perspective
  3. Larry can invoke any persona for multi-perspective analysis on a room artifact, producing distinct viewpoints
  4. Every persona output includes a "perspective lens" disclaimer and never claims expert authority
  5. All persona operations work identically via CLI commands and MCP tools (Desktop/Cowork)
**Plans**: TBD

Plans:
- [ ] 14-01: TBD
- [ ] 14-02: TBD

## Progress

**Execution Order:**
Phases 11 and 12 can run in parallel after Phase 10 completes. Phase 13 requires Phase 10. Phase 14 requires Phase 13.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-5 | v1.0 | 20/20 | Complete | 2026-03-22 |
| 6-9 | v2.0 | 13/13 | Complete | 2026-03-24 |
| 10. Shared Core + CLI Tools | 2/2 | Complete    | 2026-03-24 | - |
| 11. MCP Server | 1/3 | In Progress|  | - |
| 12. Brain Hosting + Room Collaboration | v3.0 | 0/TBD | Not started | - |
| 13. Opportunity Bank + Funding Room | v3.0 | 0/TBD | Not started | - |
| 14. AI Team Personas | v3.0 | 0/TBD | Not started | - |
