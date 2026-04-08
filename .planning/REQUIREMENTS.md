# Requirements: Brain Graph Optimization + Dummy-Proof Install v1.8.8

**Defined:** 2026-04-07
**Core Value:** Make the Brain graph actually chain frameworks, and make the install experience zero-friction for non-technical users

## v1.8.8 Requirements

### Brain: Causal Discovery (Workstream A)

- [ ] **BRAIN-01**: FEEDS_INTO enrichment from 4 to 35+ Framework-to-Framework chains including full PWS spine
- [ ] **BRAIN-02**: PREREQUISITE edges from 0 to 14 (enables "do X before Y" warnings in /mos:suggest-next)
- [ ] **BRAIN-03**: TYPICAL_AT stage mapping from 4 to 30+ (powers /mos:suggest-next and /mos:act stage-aware selection)
- [ ] **BRAIN-04**: ADDRESSES_PROBLEM_TYPE cleanup (remove __Entity__ noise, add effectiveness scores)
- [ ] **BRAIN-05**: 2D ProblemType matrix wiring (Definition x Complexity with Framework recommendations)
- [ ] **BRAIN-06**: Full provenance chain: Book -> GROUNDS_FRAMEWORK -> Framework -> ADDRESSES_PROBLEM_TYPE -> ProblemType

### Brain: Lazy Graph Bridge (Workstream A)

- [ ] **LAZY-01**: ALIAS_OF bridge from high-rel LazyGraphConcepts to canonical nodes
- [ ] **LAZY-02**: Promote valuable LazyGraphConcepts (3+ Framework CO_OCCURS) to Concept
- [ ] **LAZY-03**: Clean 511 orphan LazyGraphConcepts
- [ ] **LAZY-04**: CO_OCCURS weight-based query patterns (weight >= 2 filter)

### Brain: Fragmentation Cleanup (Workstream A)

- [ ] **FRAG-01**: ProblemType consolidation (150+ nodes -> 4 canonical + ALIAS_OF + SUBTYPE_OF)
- [ ] **FRAG-02**: Book dedup (88 null-title + 6x duplicates) + INTRODUCES_FRAMEWORK mislanding fix
- [ ] **FRAG-03**: Opportunity Bank consolidation (21 nodes -> 1 canonical with full wiring)
- [ ] **FRAG-04**: DictionaryTerm dedup (8x copies per problem type)
- [ ] **FRAG-05**: Label normalization (lowercase -> PascalCase, base/UNKNOWN removal)

### Brain: Agent + Teaching Wiring (Workstream A)

- [ ] **WIRE-01**: FrameworkAgents 10/10 wired (DERIVED_FROM + APPLIES_TO + IMPLEMENTED_BY)
- [ ] **WIRE-02**: CaseStudies 26+/30 wired (Challenger, NASA, Marconi, Naval Aviation + student projects)
- [ ] **WIRE-03**: Workshop -> TEACHES -> Framework (0 -> 16+ edges)
- [ ] **WIRE-04**: Bot -> IMPLEMENTS -> Framework (0 -> 15+ edges)
- [ ] **WIRE-05**: CorePrinciple -> GOVERNS (0 -> 20+ edges)

### Install: Dummy-Proof Experience (Workstream B)

- [ ] **INST-01**: Test install guide page on fresh Mac (Node.js from scratch, Claude Code, MindrianOS, Brain)
- [ ] **INST-02**: Test install guide page on fresh Windows (same flow)
- [ ] **INST-03**: Generate screenshots for every install step (Mac + Windows)
- [ ] **INST-04**: Improve error messages in scripts to be human-readable (no raw stack traces)
- [ ] **INST-05**: Test /mos:onboard flow end-to-end on fresh install
- [ ] **INST-06**: Test /mos:onboard whats-new flow after update
- [ ] **INST-07**: Document top 10 failure modes with one-line fixes on install page
- [ ] **INST-08**: Verify email template renders correctly in Gmail, Outlook, Apple Mail

## Out of Scope

| Feature | Reason |
|---------|--------|
| Context engineering optimization | Separate milestone v1.9.0 |
| New Brain node types (Room, RoomGroup) | Already shipped in v1.8.6 Phase 59.2 |
| Grading calibration data | Requires Lawrence's actual grading records -- flagged as SystemGap |
| Video walkthrough | Nice-to-have, defer to v1.9.0 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BRAIN-01 | Phase 60 | Pending |
| BRAIN-02 | Phase 60 | Pending |
| BRAIN-03 | Phase 60 | Pending |
| BRAIN-04 | Phase 60 | Pending |
| BRAIN-05 | Phase 60 | Pending |
| BRAIN-06 | Phase 60 | Pending |
| LAZY-01 | Phase 61 | Pending |
| LAZY-02 | Phase 61 | Pending |
| LAZY-03 | Phase 61 | Pending |
| LAZY-04 | Phase 61 | Pending |
| FRAG-01 | Phase 62 | Pending |
| FRAG-02 | Phase 62 | Pending |
| FRAG-03 | Phase 62 | Pending |
| FRAG-04 | Phase 62 | Pending |
| FRAG-05 | Phase 62 | Pending |
| WIRE-01 | Phase 63 | Pending |
| WIRE-02 | Phase 63 | Pending |
| WIRE-03 | Phase 63 | Pending |
| WIRE-04 | Phase 63 | Pending |
| WIRE-05 | Phase 63 | Pending |
| INST-01 | Phase 64 | Pending |
| INST-02 | Phase 64 | Pending |
| INST-03 | Phase 64 | Pending |
| INST-04 | Phase 64 | Pending |
| INST-05 | Phase 64 | Pending |
| INST-06 | Phase 64 | Pending |
| INST-07 | Phase 64 | Pending |
| INST-08 | Phase 64 | Pending |

**Coverage:**
- v1.8.8 requirements: 28 total
- Mapped to phases: 28
- Unmapped: 0

---
*Requirements defined: 2026-04-07*
*Last updated: 2026-04-07 after initial definition*
