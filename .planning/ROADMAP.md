# Roadmap: MindrianOS Plugin v1.6.0 Powerhouse

## Milestone

v1.6.0 Powerhouse -- Phases 39-46
Goal: Transform MindrianOS from reactive teaching partner into proactive, cost-optimized, parallel-processing venture intelligence engine with Design-by-Analogy discovery.

## Phases

- [x] **Phase 39: Model Profiles & Routing** -- 2/2 plans complete (2026-03-31)
- [x] **Phase 40: Hook Expansion** -- 6 new Claude Code hooks wiring the intelligence nervous system (completed 2026-03-31)
- [ ] **Phase 41: Hub Page** -- Stats bar, view cards, section cards, insights, red team, methodology cards, breakthroughs, opportunities
- [ ] **Phase 42: Platform Optimization** -- Prompt cache hits, modular CLAUDE.md, deep links, environment variable tuning
- [ ] **Phase 43: Sentinel Intelligence** -- Scheduled room health, grant monitoring, competitor watch, HSI recomputation
- [ ] **Phase 44: Design-by-Analogy Foundation** -- KuzuDB edge types, TRIZ matrix, SAPPhIRE encoding, Brain query patterns
- [ ] **Phase 45: Design-by-Analogy Pipeline** -- 5-stage analogy pipeline with /mos:find-analogies command
- [ ] **Phase 46: Future-Proofing & Moat Documentation** -- KAIROS prep, Coordinator Mode manifest, MWP specification

## Phase Details

### Phase 39: Model Profiles & Routing
**Goal:** Users can control cost and quality of every agent interaction through profiles, and the system auto-adapts model selection based on venture stage
**Depends on:** Nothing (foundation for parallel agents and sentinel)
**Requirements:** MODEL-01, MODEL-02, MODEL-03, MODEL-04, MODEL-05, MODEL-06
**Status:** COMPLETE (2026-03-31)
**Plans:** 2/2 complete
- [x] 39-01: Core model-profiles.cjs module
- [x] 39-02: /mos:models command + dispatch wiring

### Phase 40: Hook Expansion
**Goal:** The plugin's intelligence nervous system fires automatically on context changes, external edits, agent completions, and pipeline stage transitions
**Depends on:** Phase 39 (SubagentStop needs model resolution for cascade routing)
**Requirements:** HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-05, HOOK-06
**Success Criteria:**
1. User works for 3+ hours and Larry retains venture stage and MINTO confidence after autocompact
2. User edits a room file in VS Code and the KuzuDB graph updates automatically
3. User cd's to a different registered room and Larry switches context without manual command
4. A framework-runner subagent completes and its output is automatically filed through the cascade pipeline
5. Pipeline stage completion updates STATE.md progress and surfaces readiness notification
**Plans:** 1/0 plans complete

### Phase 41: Hub Page
**Goal:** Snapshot hub page (index.html) shows full room intelligence: stats, breakthroughs, opportunities, view cards, section overview, key insights, red team severity, and methodology artifacts
**Depends on:** Phase 40 (generate-snapshot.cjs skeleton from Phase 40)
**Requirements:** HUB-01, HUB-02, HUB-03, HUB-04, HUB-05, HUB-06, ATF-01, ATF-02
**Success Criteria:**
1. Stats bar shows 5 counters (sections, articles, connections, gaps, grants) always
2. Breakthrough angle cards render from ADJACENT_POSSIBLE graph nodes, silently skip when none
3. Opportunities scored list from funding-strategy/ with CTA when empty
4. View cards grid with conditional grayed-out state for unavailable views
5. Section cards in 4-column grid with colored borders and gap indicators
6. Key insights (max 5) extracted from graph edges + red team, always include 1 positive
7. Red team severity boxes (CRITICAL/HIGH/MEDIUM/LOW) when red team data exists
8. Methodology artifact cards with badges detected from frontmatter
**Plans:** 1/2 plans executed
Plans:
- [x] 41-01-PLAN.md -- Above-fold content: data extractors + breakthroughs + opportunities + view cards + section grid
- [ ] 41-02-PLAN.md -- Below-fold intelligence: insights + red team severity + methodology cards

### Phase 42: Platform Optimization
**Goal:** Sessions start faster with better cache hits, CLAUDE.md loads only what is needed, and environment variables are tuned
**Depends on:** Nothing (independent optimization track)
**Requirements:** PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05, PLAT-06
**Success Criteria:**
1. Session-start has stable prefix sections that hit prompt cache on repeated sessions
2. CLAUDE.md uses @include directives for on-demand section loading
3. Deep link URLs navigate directly to specific rooms or sections from dashboard
4. AUTOCOMPACT_PCT_OVERRIDE, MAX_THINKING_TOKENS, CLAUDE_CODE_MAX_CONTEXT_TOKENS set with rationale
**Plans:** TBD

### Phase 43: Sentinel Intelligence
**Goal:** Room generates proactive intelligence on schedule without user prompting
**Depends on:** Phase 40 (hooks for scheduling), Phase 39 (model routing for cost control)
**Requirements:** SENT-01, SENT-02, SENT-03, SENT-04, SENT-05, SENT-06, SENT-07
**Success Criteria:**
1. Weekly room health check compares STATE.md against previous snapshot
2. Daily grant deadline monitor alerts about approaching deadlines
3. Weekly competitor watch produces brief with contradiction flagging
4. /mos:scout runs all sentinel tasks as manual fallback
5. Outputs persist in room/.intelligence/ and room/.snapshots/
**Plans:** TBD

### Phase 44: Design-by-Analogy Foundation
**Goal:** Knowledge graph and reference library extended with analogy-specific edge types, TRIZ parameters, SAPPhIRE encoding
**Depends on:** Nothing (schema and reference files are independent)
**Requirements:** DBA-08, DBA-09, DBA-10, DBA-11, DBA-12
**Success Criteria:**
1. KuzuDB includes ANALOGOUS_TO, STRUCTURALLY_ISOMORPHIC, RESOLVES_VIA edge types
2. CONTRADICTS edges can be enriched with TRIZ parameters
3. triz-matrix.json and triz-principles.md in references/methodology/
4. sapphire-encoding.md provides SAPPhIRE extraction guide
5. brain_analogy_search Cypher pattern retrieves cross-domain matches
**Plans:** TBD

### Phase 45: Design-by-Analogy Pipeline
**Goal:** Users discover cross-domain analogies through structured 5-stage pipeline searching internally and externally
**Depends on:** Phase 44 (edge types and references must exist)
**Requirements:** DBA-01, DBA-02, DBA-03, DBA-04, DBA-05, DBA-06, DBA-07
**Success Criteria:**
1. pipelines/analogy/CHAIN.md defines 5-stage pipeline with stage contracts
2. /mos:find-analogies extracts functional abstractions and presents correspondence tables
3. --brain mode enriches with cross-domain framework patterns from teaching graph
4. --external mode searches AskNature, patents, academic sources via Tavily
5. Validated analogies persisted as KuzuDB edges with source attribution
**Plans:** TBD

### Phase 46: Future-Proofing & Moat Documentation
**Goal:** MindrianOS prepared for KAIROS, Coordinator Mode, and MWP protocol formally specified
**Depends on:** Phase 39 (model profiles feed into team manifest)
**Requirements:** FUTURE-01, FUTURE-02, FUTURE-03, FUTURE-04, MOAT-01, MOAT-02, MOAT-03
**Success Criteria:**
1. room/.context/ exists with template files ready for KAIROS consumption
2. Enhanced Stop hook writes session summary to last-session.md
3. .claude/teams/mindrian.json defines Larry as lead with 7 member agents
4. docs/MWP-SPECIFICATION.md formally describes the 7-layer protocol
5. CLAUDE.md moat section + phase review template with moat assessment field
**Plans:** TBD

## Progress

| Phase | Status | Plans | Completed |
|-------|--------|-------|-----------|
| 39 | Complete | 2/2 | 2026-03-31 |
| 40 | Not Started | Complete    | 2026-03-31 |
| 41 | 1/2 | In Progress|  |
| 42 | Not Started | TBD | -- |
| 43 | Not Started | TBD | -- |
| 44 | Not Started | TBD | -- |
| 45 | Not Started | TBD | -- |
| 46 | Not Started | TBD | -- |

## Dependency Chain

Phase 39 (Models) --> Phase 41 (Hub Page)
Phase 40 (Hooks) --> Phase 41 (Hub Page)
Phase 42 (Platform) -- independent, can run parallel with 40-41
Phase 44 (DBA Foundation) --> Phase 45 (DBA Pipeline)
Phase 46 (Future) -- independent
