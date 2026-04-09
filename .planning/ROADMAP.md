# Roadmap: Wiring Integrity + Intelligence Loop v1.9.3

## Overview

Complete the remaining audit findings from the 8-audit plugin scan. The centerpiece is making the APPROVE/REJECT/DEFER cascade workflow real -- from artifact filed to Larry surfaces finding to user decides to decision becomes graph data. Alongside: fix filing cascade gaps, macOS portability, radar registration, and stale docs.

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

- **v1.9.3 Wiring Integrity + Intelligence Loop** - Phases 67-70 (in progress)

## Phases

- [x] **Phase 67: Portability + Polish** - macOS compat, radar registration, stale doc fixes (completed 2026-04-09)
- [x] **Phase 68: Filing Cascade Completeness** - Git-commit on file, classify consumption, status reporting (completed 2026-04-09)
- [ ] **Phase 69: APPROVE/REJECT/DEFER Workflow** - Cross-subsystem impact surfacing, user decision capture, decision-as-graph-data
- [ ] **Phase 70: Mid-Session Intelligence Loop** - Post-filing injection, repeat suppression, live intelligence during session

## Phase Details

### Phase 67: Portability + Polish
**Goal**: Plugin scripts run correctly on macOS and all registered commands are reachable
**Depends on**: Nothing (independent fixes, no new subsystem dependencies)
**Requirements**: PORT-01, PORT-02, PORT-03, PORT-04
**Success Criteria** (what must be TRUE):
  1. Running any hook script on macOS produces no GNU-specific errors (stat -c and find -printf replaced with portable alternatives)
  2. User can invoke /mos:radar from the plugin system and it resolves to the radar command
  3. REQUIREMENTS.md checkboxes for phases 39, 60, 61, 62 reflect actual implementation status (checked if done, unchecked if not)
**Plans:** 2/2 plans complete

Plans:
- [x] 67-01-PLAN.md -- Replace GNU stat/find with cross-platform helpers in 7 hook scripts
- [x] 67-02-PLAN.md -- Register /mos:radar in plugin.json and update stale VERIFICATION.md files

### Phase 68: Filing Cascade Completeness
**Goal**: Every artifact filing produces a complete audit trail -- git history, classification metadata, and visible status reporting
**Depends on**: Phase 67 (portability fixes ensure cascade scripts run on all platforms)
**Requirements**: FILE-01, FILE-02, FILE-03
**Success Criteria** (what must be TRUE):
  1. After filing a markdown artifact, a git commit exists with message format "file(section): artifact title"
  2. Filed artifacts contain a classification: field in their YAML frontmatter (populated by classify-insight)
  3. Larry receives cascade completion status in hook output (user can see "cascade complete" or "cascade failed" in session context)
**Plans:** 2/2 plans complete

Plans:
- [x] 68-01-PLAN.md -- Synchronous classify-insight + frontmatter injection + git commit step in cascade
- [x] 68-02-PLAN.md -- Foreground cascade in post-write + status reporting to Larry via stdout

### Phase 69: APPROVE/REJECT/DEFER Workflow
**Goal**: Users can make decisions on cross-subsystem impacts and those decisions become persistent, queryable graph data
**Depends on**: Phase 68 (filing must be complete before decision layer can respond to filings)
**Requirements**: INTEL-01, INTEL-02, INTEL-03
**Success Criteria** (what must be TRUE):
  1. After filing an artifact, Larry presents up to 2 cross-subsystem impacts with confidence scores (e.g., "This changes your financial model assumption [0.82]")
  2. User can respond APPROVE, REJECT (with reason), or DEFER to each surfaced impact
  3. APPROVE/REJECT/DEFER decisions appear in .proactive-intelligence.json with timestamp and decision type
  4. KuzuDB contains corresponding edges (INVALIDATES for approve-cascade, CONFIRMS for reject-reason, DEFERRED for parked items)
  5. Rejected reasons are stored as queryable data (Decision #13: "Rejection is data")
**Plans**: TBD

### Phase 70: Mid-Session Intelligence Loop
**Goal**: Intelligence findings surface throughout the session (not just at start) and repeat suppression prevents noise fatigue
**Depends on**: Phase 69 (APPROVE/REJECT/DEFER must exist before mid-session can present decisions)
**Requirements**: INTEL-04, INTEL-05
**Success Criteria** (what must be TRUE):
  1. After a post-write cascade completes mid-session, new findings are available in Larry's next response (not deferred to next session start)
  2. Insights surfaced 3+ times without new evidence are suppressed from Larry's output
  3. When new evidence changes a previously-suppressed insight, it re-surfaces with a "new evidence" indicator
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 67 -> 68 -> 69 -> 70

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 67. Portability + Polish | 2/2 | Complete   | 2026-04-09 |
| 68. Filing Cascade Completeness | 2/2 | Complete   | 2026-04-09 |
| 69. APPROVE/REJECT/DEFER Workflow | 0/TBD | Not started | - |
| 70. Mid-Session Intelligence Loop | 0/TBD | Not started | - |
