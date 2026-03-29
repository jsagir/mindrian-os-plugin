# Roadmap: MindrianOS Plugin

## Milestones

- ✅ **v1.0 MVP** -- Phases 1-5 (shipped 2026-03-22)
- ✅ **v2.0 Meeting Intelligence** -- Phases 6-9 (shipped 2026-03-24)
- ✅ **v3.0 MCP Platform & Intelligence Expansion** -- Phases 10-19 (shipped 2026-03-25)
- [ ] **v4.0 Brain API Control & CLI UI Ruling System** -- Phases 20-24 (in progress)

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

### v4.0 Brain API Control & CLI UI Ruling System

**Milestone Goal:** Protect the moat (Brain API key management with admin control), establish the visual grammar for all MindrianOS terminal interactions, then enable multi-room management and autonomous framework execution.

- [x] **Phase 20: Brain API Control** - Supabase-backed key management with approve/revoke/extend, usage tracking, and production auth (completed 2026-03-29)
- [x] **Phase 21: CLI UI Ruling System** - The skill file that governs all MindrianOS output: 4-zone anatomy, 5 body shapes, symbol vocabulary, color contract, dual context (completed 2026-03-29)
- [x] **Phase 22: Admin Panel** - Hidden self-teaching admin experience for Brain key management and system operations (completed 2026-03-29)
- [ ] **Phase 23: Multi-Room Management** - Room registry, switching, context safety, and header canary for multi-project workflows
- [ ] **Phase 24: Autonomous Engine** - Brain-driven framework selection with subagent execution, thinking traces, and chain mode

## Phase Details

### Phase 20: Brain API Control
**Goal**: Jonathan can manage who accesses the Brain -- create, revoke, extend, and monitor API keys -- with all state in Supabase and production auth wired into the deployed Brain MCP server
**Depends on**: Phase 12 (Brain Hosting -- auth middleware already exists)
**Requirements**: BRAIN-01, BRAIN-02, BRAIN-03, BRAIN-04, BRAIN-05, BRAIN-06
**Success Criteria** (what must be TRUE):
  1. Admin can run a CLI command to create a time-limited API key for a specific user with a plan tier, and that key immediately works against the deployed Brain MCP
  2. Admin can list all active keys, revoke any key instantly (rejected on next request), and extend expiry dates
  3. Non-admin API keys cannot call brain_write tools -- requests are rejected with clear error explaining the restriction
  4. Usage is tracked per key (request count, last used timestamp) and queryable by admin
  5. Brain MCP on Render reads credentials from Supabase in production -- no local env files needed on the server
**Plans**: 2 plans
Plans:
- [ ] 20-01-PLAN.md -- Supabase SQL schema + brain_write guard + render.yaml
- [ ] 20-02-PLAN.md -- brain-admin.cjs CLI tool

### Phase 21: CLI UI Ruling System
**Goal**: Every MindrianOS CLI interaction follows a consistent visual grammar defined in a single skill file -- Larry, commands, session start, and all output conform to the same 4-zone anatomy, symbol vocabulary, and color contract
**Depends on**: Nothing (independent of Phase 20, can run in parallel)
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07
**Success Criteria** (what must be TRUE):
  1. A skill file at skills/ui-system/SKILL.md is auto-loaded every session and all MindrianOS output visibly follows the 4-zone layout (header with room context, body, intelligence strip, footer)
  2. The 5 body shapes (Mondrian board, semantic tree, room card, document view, action report) are each used by at least one existing command
  3. Session start greeting follows the cold/warm/signals contract with max 2 intelligence signals and adapts correctly across CLI, Desktop, and Cowork
  4. Every folder with a STATE.md also has a MINTO.md, and both are read before routing decisions
**Plans**: 2 plans
Plans:
- [ ] 21-01-PLAN.md -- SKILL.md creation + body shape definitions + command mapping
- [ ] 21-02-PLAN.md -- Retrofit existing commands with body_shape frontmatter + help grouping

### Phase 22: Admin Panel
**Goal**: Jonathan has a hidden, self-teaching admin experience that re-explains itself every time and makes destructive actions safe through consequence previews
**Depends on**: Phase 20 (Brain API Control -- admin panel manages keys)
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03
**Success Criteria** (what must be TRUE):
  1. Running /mos:admin shows the admin panel with available actions -- but only for the admin user; non-admin users see no trace of the command
  2. Every invocation starts with a brief explanation of what each action does -- the panel teaches itself so the admin never needs to remember
  3. Any destructive action (revoke key, purge data) shows exactly what will happen and requires explicit confirmation before executing
**Plans**: 1 plan
Plans:
- [ ] 22-01-PLAN.md -- Admin command + help visibility filtering

### Phase 23: Multi-Room Management
**Goal**: Users can maintain multiple project rooms simultaneously with safe context switching -- the system always knows which room is active and prevents cross-contamination
**Depends on**: Phase 21 (UI system -- header canary uses Zone 1, session start shows multi-room context)
**Requirements**: ROOM-01, ROOM-02, ROOM-03, ROOM-04, ROOM-05
**Success Criteria** (what must be TRUE):
  1. A .rooms/registry.json tracks all rooms with metadata, and /mos:rooms list shows them with status indicators
  2. User can create, open, close, and archive rooms via /mos:rooms subcommands, and /mos:rooms where shows the currently active room
  3. All file-writing commands check the active room lock before writing -- attempting to write to an inactive room is blocked with a clear error
  4. The room name is always visible in the Zone 1 header (canary), and session start shows multi-room context when 2+ rooms are registered
**Plans**: 3 plans
Plans:
- [ ] 23-01-PLAN.md -- Registry infrastructure + resolve-room keystone + hook/script retrofit
- [ ] 23-02-PLAN.md -- /mos:rooms command with 6 subcommands + new-project registry support
- [ ] 23-03-PLAN.md -- Context safety (room lock) + Zone 1 header canary + multi-room greeting

### Phase 24: Autonomous Engine
**Goal**: Larry can autonomously select and execute methodology frameworks based on room state -- with full thinking transparency, subagent isolation, and the ability to chain multiple frameworks in sequence
**Depends on**: Phase 21 (UI system -- thinking traces use visual grammar), Phase 23 (room management -- /mos:act reads active room state)
**Requirements**: ACT-01, ACT-02, ACT-03, ACT-04, ACT-05
**Success Criteria** (what must be TRUE):
  1. Running /mos:act reads the active room's STATE.md + MINTO.md, queries the Brain (with local fallback) for the best framework, and displays a thinking trace explaining why that framework was selected
  2. Framework execution happens in an isolated subagent context (agents/framework-runner.md) -- the main session context is not polluted
  3. Running /mos:act --chain selects and executes 3-5 frameworks in sequence, where each framework's output feeds the next via a structured output contract
  4. Running /mos:act --dry-run shows the full execution plan (framework selection, reasoning, expected outputs) without executing anything
**Plans**: TBD
Plans:
- [To be planned]

## Progress

**Execution Order:**
Phase 20 and 21 can run in parallel. Phase 22 requires Phase 20. Phase 23 requires Phase 21. Phase 24 requires Phase 21 and Phase 23.

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-5 | v1.0 | 20/20 | Complete | 2026-03-22 |
| 6-9 | v2.0 | 13/13 | Complete | 2026-03-24 |
| 10-19 | v3.0 | 26/26 | Complete | 2026-03-25 |
| 20. Brain API Control | v4.0 | 0/2 | Complete    | 2026-03-29 |
| 21. CLI UI Ruling System | v4.0 | 1/2 | Complete    | 2026-03-29 |
| 22. Admin Panel | v4.0 | 0/1 | Complete    | 2026-03-29 |
| 23. Multi-Room Management | v4.0 | 0/3 | Not started | - |
| 24. Autonomous Engine | v4.0 | 0/TBD | Not started | - |

### Phase 25: Data Room Export Template v2

**Goal:** `/mos:room export` generates a single self-contained HTML file that any user can share -- combining a Mondrian grid overview (clickable section cells), sidebar navigation for easy browsing, a document rail reader with TOC, an intelligence view (gaps/convergence/contradictions), a Cytoscape knowledge graph view, and rich content rendering (Mermaid diagrams, SVGs, tables, markdown). The template reads room/ state dynamically so it works for any MindrianOS user's data room.
**Requirements**: EXPORT-01, EXPORT-02, EXPORT-03, EXPORT-04, EXPORT-05
**Depends on:** Phase 19 (Wiki Dashboard -- shares rendering patterns and graph data)
**Plans:** 2/2 plans complete

Plans:
- [ ] 25-01-PLAN.md -- De Stijl HTML export template with 4 views (Mondrian grid, document reader, intelligence, graph)
- [ ] 25-02-PLAN.md -- generate-export.cjs script + room command wiring
