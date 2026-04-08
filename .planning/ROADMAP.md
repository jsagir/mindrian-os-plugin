# Roadmap: Brain Graph Optimization + Pam-Proof Install v1.8.8

## Overview

Two parallel workstreams: (A) Execute the Brain normalization scripts from v1.8.2 -- enriching framework chains, prerequisite edges, stage mappings, and wiring orphaned nodes in the Neo4j teaching graph. (B) Test and polish the install experience for non-technical users with screenshots, error handling, and onboarding verification.

## Milestones

<details>
<summary>v1.8.2 Brain Graph Optimization (Phases 52-55) - SUPERSEDED by v1.8.8</summary>

Original 4 phases absorbed into v1.8.8 Phases 60-63. Scripts written, research complete.

</details>

<details>
<summary>v1.8.6 MindrianRooms -- ICM Room Organization (Phases 56-59.2) - SHIPPED</summary>

6 phases, 35 requirements. See .planning/milestones/v1.8.6-ROADMAP.md

</details>

- **v1.8.8 Brain Graph Optimization + Pam-Proof Install** - Phases 60-64 (in progress)

## Phases

- [ ] **Phase 60: Causal Discovery Optimization** - FEEDS_INTO, PREREQUISITE, TYPICAL_AT, ADDRESSES_PROBLEM_TYPE enrichment
- [ ] **Phase 61: Lazy Graph Bridge** - ALIAS_OF bridging, LazyGraphConcept promotion, orphan cleanup
- [ ] **Phase 62: Fragmentation Cleanup** - ProblemType consolidation, Book dedup, label normalization
- [ ] **Phase 63: Agent + Teaching Wiring** - FrameworkAgents, CaseStudies, Workshops, Bots, CorePrinciples
- [ ] **Phase 64: Dummy-Proof Install Experience** - Test, screenshot, error messages, onboarding flow, email templates

## Phase Details

### Phase 60: Causal Discovery Optimization
**Goal**: Enrich the Brain's causal discovery spine so framework chaining, stage-aware suggestions, and problem-type routing actually work
**Depends on**: Nothing (first phase, scripts already written)
**Requirements**: BRAIN-01, BRAIN-02, BRAIN-03, BRAIN-04, BRAIN-05, BRAIN-06
**Success Criteria**:
  1. FEEDS_INTO edges >= 35 between Framework nodes (verified by Cypher count)
  2. PREREQUISITE edges >= 14 (verified by Cypher count)
  3. TYPICAL_AT edges >= 30 connecting Frameworks to VentureStages
  4. ADDRESSES_PROBLEM_TYPE edges cleaned of __Entity__ noise
  5. 2D ProblemType matrix queryable: given (definition_level, complexity) return ranked frameworks
  6. Provenance chain traversable: Book -> Framework -> ProblemType in single Cypher query
**Scripts**: brain-normalize-final.cypher, brain-normalize-supplement.cypher
**Plans**: TBD

### Phase 61: Lazy Graph Bridge
**Goal**: Connect the LazyGraph layer (8,425 nodes) to the Curated layer (281 nodes) so semantic intelligence reaches Larry
**Depends on**: Phase 60
**Requirements**: LAZY-01, LAZY-02, LAZY-03, LAZY-04
**Success Criteria**:
  1. ALIAS_OF edges bridge top-50 LazyGraphConcepts to canonical Framework/Concept nodes
  2. LazyGraphConcepts with 3+ CO_OCCURS promoted to Concept label
  3. 511 orphan LazyGraphConcepts cleaned (deleted or aliased)
  4. CO_OCCURS queries with weight >= 2 filter return meaningful results
**Scripts**: brain-normalize-supplement.cypher
**Plans**: TBD

### Phase 62: Fragmentation Cleanup
**Goal**: Consolidate fragmented nodes so graph traversal is reliable
**Depends on**: Phase 60
**Requirements**: FRAG-01, FRAG-02, FRAG-03, FRAG-04, FRAG-05
**Success Criteria**:
  1. ProblemType nodes reduced from 150+ to 4 canonical with ALIAS_OF and SUBTYPE_OF
  2. Book nodes deduped (0 null-title, 0 duplicates)
  3. Opportunity Bank consolidated to 1 canonical node
  4. DictionaryTerm deduped (1 per problem type, not 8)
  5. All labels PascalCase, no base/UNKNOWN labels remaining
**Scripts**: brain-normalize-problemtype.cypher
**Plans**: TBD

### Phase 63: Agent + Teaching Wiring
**Goal**: Wire orphaned teaching layer nodes so the Brain knows which agents implement which frameworks, which case studies illustrate them, and which principles govern them
**Depends on**: Phase 60
**Requirements**: WIRE-01, WIRE-02, WIRE-03, WIRE-04, WIRE-05
**Success Criteria**:
  1. 10/10 FrameworkAgents connected (DERIVED_FROM + APPLIES_TO + IMPLEMENTED_BY)
  2. 26+/30 CaseStudies connected to relevant Frameworks
  3. 16+ Workshop -> TEACHES -> Framework edges
  4. 15+ Bot -> IMPLEMENTS -> Framework edges
  5. 20+ CorePrinciple -> GOVERNS edges
**Plans**: TBD

### Phase 64: Dummy-Proof Install Experience
**Goal**: Non-technical users can install MindrianOS alone in 10 minutes using the website guide
**Depends on**: Nothing (parallel with Brain phases)
**Requirements**: INST-01, INST-02, INST-03, INST-04, INST-05, INST-06, INST-07, INST-08
**Success Criteria**:
  1. Fresh Mac install completes successfully following only the website guide
  2. Fresh Windows install completes successfully following only the website guide
  3. Screenshots exist for every step on both platforms
  4. No raw stack traces in any MindrianOS script error output
  5. /mos:onboard completes without errors on fresh install
  6. /mos:onboard whats-new shows correct changelog after update
  7. Install page has troubleshooting section with top 10 failure modes
  8. Email template renders correctly in Gmail, Outlook, and Apple Mail
**Plans**: TBD

## Progress

**Execution Order:**
Phases 60-63 (Brain) execute in sequence: 60 -> 61/62 (parallel) -> 63
Phase 64 (Install) runs in PARALLEL with all Brain phases (no dependency)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 60. Causal Discovery | v1.8.8 | 0/0 | Not started | - |
| 61. Lazy Graph Bridge | v1.8.8 | 0/0 | Not started | - |
| 62. Fragmentation Cleanup | v1.8.8 | 0/0 | Not started | - |
| 63. Agent + Teaching Wiring | v1.8.8 | 0/0 | Not started | - |
| 64. Pam-Proof Install | v1.8.8 | 0/0 | Not started | - |
