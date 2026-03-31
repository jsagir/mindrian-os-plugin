# Requirements: MindrianOS Plugin

**Defined:** 2026-03-31
**Core Value:** Users can run the full PWS methodology inside Claude Code with zero infrastructure, where Larry guides them through venture innovation

## v5.1 Requirements

Requirements for User Outlets milestone. Each maps to roadmap phases.

### CLI Identity

- [ ] **BANNER-01**: User sees Mondrian banner on first-ever cold start
- [ ] **BANNER-02**: User sees Mondrian banner after plugin update with version diff
- [ ] **BANNER-03**: User can type /mos:splash to display Mondrian banner anytime

### Onboarding

- [ ] **ONBOARD-01**: System detects first install via ~/.mindrian-onboarded marker
- [x] **ONBOARD-02**: User gets 7-step Larry-voiced walkthrough on first install (all skippable)
- [x] **ONBOARD-03**: USER.md generated from onboarding conversation and persisted
- [ ] **ONBOARD-04**: Update path shows "What's New" highlights from CHANGELOG
- [x] **ONBOARD-05**: User can type /mos:onboard to re-run onboarding anytime

### Command Wiring

- [ ] **WIRE-01**: /mos:present generates all 6 presentation views and opens dashboard in browser
- [ ] **WIRE-02**: /mos:dashboard opens interactive graph with chat panel in browser
- [ ] **WIRE-03**: /mos:speakers shows speaker profiles from filed meetings
- [ ] **WIRE-04**: /mos:reanalyze re-runs intelligence on already-filed meetings
- [ ] **WIRE-05**: /mos:graph provides direct KuzuDB graph exploration

### JTBD Warm Start

- [ ] **JTBD-01**: Larry's warm start nudges identify user's current job and frame commands as job acceleration
- [ ] **JTBD-02**: Nudges follow pattern "You have [state]. /mos:X [outcome]" -- max 2-3 per session
- [ ] **JTBD-03**: Dynamic command menu adapts to what user hasn't tried yet

### Validation

- [ ] **VAL-01**: Phase 32-02 generative tools (highlightCluster, filterEdgeType, showInsight) verified working
- [ ] **VAL-02**: End-to-end flow tested: install -> onboard -> file -> present -> share

## Future Requirements

Deferred from v5.1:

- Workflow triggers ("I just had a meeting" -> guided filing flow)
- Conversational router (natural language -> command routing)
- Graph surgery (user can edit/delete KuzuDB edges)
- HSI threshold tuning (user-configurable similarity parameters)
- Artifact provenance viewer (show where each insight came from)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New infrastructure/scripts | v5.1 wires existing infra only |
| Browser-based onboarding UI | CLI-native, Larry-voiced |
| New methodology commands | 26 already exist, focus on discoverability |
| Mobile/Desktop-specific features | CLI-first for this milestone |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BANNER-01 | Phase 34 | Pending |
| BANNER-02 | Phase 34 | Pending |
| BANNER-03 | Phase 34 | Pending |
| ONBOARD-01 | Phase 35 | Pending |
| ONBOARD-02 | Phase 35 | Complete |
| ONBOARD-03 | Phase 35 | Complete |
| ONBOARD-04 | Phase 35 | Pending |
| ONBOARD-05 | Phase 35 | Complete |
| WIRE-01 | Phase 36 | Pending |
| WIRE-02 | Phase 36 | Pending |
| WIRE-03 | Phase 36 | Pending |
| WIRE-04 | Phase 36 | Pending |
| WIRE-05 | Phase 36 | Pending |
| JTBD-01 | Phase 37 | Pending |
| JTBD-02 | Phase 37 | Pending |
| JTBD-03 | Phase 37 | Pending |
| VAL-01 | Phase 38 | Pending |
| VAL-02 | Phase 38 | Pending |

**Coverage:**
- v5.1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-03-31*
*Last updated: 2026-03-31 after roadmap creation*
