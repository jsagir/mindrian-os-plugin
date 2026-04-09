# Roadmap: Opportunity Engine + Conversation-First Entry v1.9.4

## Overview

Three-layer build: first the opportunity extraction engine (every framework interaction produces bankable opportunities), then conversation-first entry (persona-aware mode routing with Brain-guided exploration), then onboarding redesign (teach what Layers 1+2 built). Each layer depends on the previous -- you can't bank opportunities in conversation without the extraction engine, and you can't teach entry paths that don't exist yet.

## Milestones

<details>
<summary>v1.8.6 MindrianRooms (Phases 56-59.2) - SHIPPED 2026-04-06</summary>

6 phases, 35 requirements. See .planning/milestones/v1.8.6-ROADMAP.md

</details>

<details>
<summary>v1.8.8 Brain Graph Optimization + Dummy-Proof Install (Phases 60-64) - SHIPPED 2026-04-07</summary>

5 phases, 27 requirements. Causal discovery, lazy graph bridge, fragmentation cleanup, agent wiring, install experience.

</details>

<details>
<summary>v1.9.0 Model Data Room + Self-Analysis (Phases 65-66) - SHIPPED 2026-04-08</summary>

Google Drive integration, 168-artifact model room, HSI self-analysis, Investment Thesis gate.
v1.9.1: VPS scoring. v1.9.2: 13 wiring fixes + intelligence cascade wired end-to-end.

</details>

<details>
<summary>v1.9.3 Wiring Integrity + Intelligence Loop (Phases 67-70) - SHIPPED 2026-04-09</summary>

4 phases. APPROVE/REJECT/DEFER cascade, mid-session intelligence, filing completeness, macOS portability.

</details>

- **v1.9.4 Opportunity Engine + Conversation-First Entry** - Phases 71-75 (in progress)

## Phases

- [x] **Phase 71: Opportunity Extraction Engine** - Universal schema, framework side-effects, persistence to opportunity-bank/ (completed 2026-04-09)
- [x] **Phase 72: Opportunity Graph + Brain Enrichment** - KuzuDB integration, Brain cross-referencing against 100 frameworks (completed 2026-04-09)
- [ ] **Phase 73: Conversation Mode Routing** - Three entry modes, persona detection, Brain framework chain selection
- [ ] **Phase 74: Conversation Capture + Room Seeding** - Opportunity banking during conversation, room seeding from banked opportunities, persistent scratchpad
- [ ] **Phase 75: Onboarding Redesign** - Three entry paths taught, opportunity bank explained, Knight framing, returning user greeting

## Phase Details

### Phase 71: Opportunity Extraction Engine
**Goal**: Every methodology command produces bankable opportunities as a universal side effect, persisted in a standard schema
**Depends on**: Phase 70 (intelligence loop must exist -- opportunities are a new artifact type that flows through the filing cascade)
**Requirements**: OPP-01, OPP-02, OPP-03
**Success Criteria** (what must be TRUE):
  1. User runs any methodology command (/mos:diagnose, /mos:lean-canvas, /mos:find-bottlenecks, /mos:explore-domains) and opportunities appear in room/opportunity-bank/ without any extra action
  2. Each banked opportunity file contains YAML frontmatter with all schema fields: problem, mirror_solution, domain, evidence, source_framework, knight_position, confidence
  3. User can run /mos:opportunities and see all banked opportunities listed with their knight_position (risk vs uncertainty) and confidence scores
  4. A methodology command that produces zero opportunities does not create empty or stub files
**Plans**: 2 plans

Plans:
- [x] 71-01-PLAN.md -- Universal opportunity schema + extraction + bankOpportunity persistence
- [x] 71-02-PLAN.md -- Intelligence cascade Step 11 wiring + /mos:opportunities command update

### Phase 72: Opportunity Graph + Brain Enrichment
**Goal**: Banked opportunities become queryable graph nodes with cross-framework validation suggestions from the Brain
**Depends on**: Phase 71 (opportunities must exist before they can be graphed or enriched)
**Requirements**: OPP-04, OPP-05
**Success Criteria** (what must be TRUE):
  1. After banking an opportunity, KuzuDB contains an Opportunity node with ADDRESSES edges to Problem nodes and IN_DOMAIN edges to Domain nodes
  2. When Brain is connected, banked opportunities receive "next validation steps" suggestions drawn from the 100 frameworks x 131 FEEDS_INTO chains
  3. User can query opportunities by domain, knight_position, or confidence through /mos:opportunities with filter flags
**Plans**: 2 plans

Plans:
- [x] 72-01-PLAN.md -- KuzuDB Opportunity node + ADDRESSES/IN_DOMAIN edges + indexOpportunity + filter flags
- [x] 72-02-PLAN.md -- Brain enrichment: suggestValidationSteps + enrichOpportunity with FEEDS_INTO chains

### Phase 73: Conversation Mode Routing
**Goal**: Every session starts with persona-aware mode selection that routes to the right Brain framework chain
**Depends on**: Phase 72 (Mode 2's "explore+capture" needs the opportunity engine to exist for banking)
**Requirements**: CONV-01, CONV-02, CONV-03
**Success Criteria** (what must be TRUE):
  1. On session start, user sees three modes with JTBD statements: Explore (just talk, nothing saved), Explore+Capture (room builds as you talk), Build Then Work (jump to /mos:new-project)
  2. In Mode 2, Larry detects user persona (TTO, Researcher, or Business) within 2-3 exchanges through targeted questions
  3. After persona detection, Larry follows the corresponding Brain framework chain: TTO (tech push -> domain -> problem), Researcher (problem -> JTBD -> value prop), Business (opportunity -> market -> problem definition)
  4. Mode 1 and Mode 3 work without Brain connection (Tier 0 principle)
**Plans**: 2 plans
**UI hint**: yes

Plans:
- [ ] 73-01-PLAN.md -- Session-start mode routing + JTBD mode menu + conversation-mode skill
- [ ] 73-02-PLAN.md -- getFrameworkChain in brain-client + Tier 0 persona-chains reference

### Phase 74: Conversation Capture + Room Seeding
**Goal**: Mode 2 conversations produce banked opportunities in real-time, and those opportunities can seed a new Data Room when the user is ready
**Depends on**: Phase 73 (mode routing and persona detection must exist before capture can happen within Mode 2)
**Requirements**: CONV-04, CONV-05, CONV-06
**Success Criteria** (what must be TRUE):
  1. During a Mode 2 conversation, Larry extracts well-defined problems and mirror solutions from the user's own words and banks them as opportunities (user sees confirmation after each extraction)
  2. User can say "I'm ready to build" and banked opportunities seed a new Data Room with pre-loaded sections (problem-definition, solution-design, market-analysis populated from conversation, not empty)
  3. Pre-room scratchpad persists across sessions -- user can close Claude, return tomorrow, and Mode 1 conversations from previous sessions are still available to upgrade to Mode 2
  4. Scratchpad contents survive session boundaries without requiring a room to exist
**Plans**: TBD

Plans:
- [ ] 74-01: Real-time opportunity extraction during Mode 2 conversation + banking flow
- [ ] 74-02: Room seeding from banked opportunities + persistent pre-room scratchpad

### Phase 75: Onboarding Redesign
**Goal**: New and returning users understand all three entry paths and the opportunity bank as universal output
**Depends on**: Phase 74 (can't teach entry paths that don't exist yet)
**Requirements**: ONBD-01, ONBD-02, ONBD-03, ONBD-04
**Success Criteria** (what must be TRUE):
  1. Running /mos:onboard walks user through all three modes with a persona-specific guided first experience (TTO users see tech-push framing, Researchers see problem-first framing, Business users see opportunity-first framing)
  2. Onboarding explains the opportunity bank as the universal output -- every framework interaction, every conversation capture, every room analysis feeds the same bank
  3. Knight risk vs uncertainty distinction is presented as the "why" -- MindrianOS converts uncertainty to manageable risk, and the onboarding makes this concrete with examples
  4. Returning users who have previously banked opportunities see them surfaced in their session greeting (not just onboarding -- this persists)
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 75-01: /mos:onboard three-path walkthrough + persona-specific guided experience
- [ ] 75-02: Opportunity bank explanation + Knight framing + returning user greeting integration

## Progress

**Execution Order:**
Phases execute in numeric order: 71 -> 72 -> 73 -> 74 -> 75

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 71. Opportunity Extraction Engine | 2/2 | Complete   | 2026-04-09 |
| 72. Opportunity Graph + Brain Enrichment | 2/2 | Complete   | 2026-04-09 |
| 73. Conversation Mode Routing | 0/2 | Not started | - |
| 74. Conversation Capture + Room Seeding | 0/2 | Not started | - |
| 75. Onboarding Redesign | 0/2 | Not started | - |
