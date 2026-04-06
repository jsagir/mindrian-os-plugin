# Requirements: Brain Graph Optimization v1.8.2

**Defined:** 2026-04-06
**Core Value:** Make the Neo4j Brain graph work for MindrianOS -- causal discovery chains, Lazy-to-Curated bridge, fragmentation cleanup

## v1.8.2 Requirements

### Causal Discovery

- [ ] **CAUSAL-01**: FEEDS_INTO edges enriched from 4 to 35+ Framework->Framework chains covering PWS spine, Cynefin cluster, wicked chain, design chain, structuring chain, and due diligence cluster
- [ ] **CAUSAL-02**: PREREQUISITE edges created (0->14) enabling gap warnings when frameworks are attempted without dependencies
- [ ] **CAUSAL-03**: TYPICAL_AT edges enriched from 4 to 30+ mapping frameworks to all 5 VentureStages including ValidationTool mappings
- [ ] **CAUSAL-04**: ADDRESSES_PROBLEM_TYPE cleaned of __Entity__/Concept/Technique noise and enriched with effectiveness scores for all 4 canonical ProblemTypes + 7 matrix intersections
- [ ] **CAUSAL-05**: VentureStage progression chain wired (Pre-Opportunity -> Opportunity Identified -> Problem Validation -> Well-Defined Problem -> Ready to Build)

### Lazy Graph

- [ ] **LAZY-01**: ALIAS_OF edges created from 20+ high-rel LazyGraphConcepts to their canonical ProblemType nodes (covering 1,900+ orphaned relationships)
- [ ] **LAZY-02**: Valuable LazyGraphConcepts with 3+ Framework CO_OCCURS promoted to Concept label
- [ ] **LAZY-03**: 511 orphan LazyGraphConcepts (zero relationships) deleted
- [ ] **LAZY-04**: Full provenance chain wired: Book -[GROUNDS_FRAMEWORK]-> Framework -[ADDRESSES_PROBLEM_TYPE]-> ProblemType with 30+ curriculum mappings
- [ ] **LAZY-05**: DictionaryTerm->Framework bridging via Book path (USED_IN edges)

### Fragmentation

- [ ] **FRAG-01**: ProblemType consolidated from 250+ nodes to 4 canonical with ALIAS_OF, SUBTYPE_OF for matrix combos, and CLARIFIES_TO progression chain
- [ ] **FRAG-02**: DictionaryTerm duplicates merged (8x Ill-defined, 8x Well-defined, 3x Wicked, plus Un-defined and Problem Type Progression sets)
- [ ] **FRAG-03**: Book layer deduped (25 duplicate titles merged via apoc.refactor.mergeNodes) and title property normalized for 88 null-title books
- [ ] **FRAG-04**: INTRODUCES_FRAMEWORK mislanding fixed (123 edges redirected from Concept to Framework targets, remaining retyped as INTRODUCES_CONCEPT)
- [ ] **FRAG-05**: Opportunity Bank consolidated from 21 nodes to 1 canonical DictionaryTerm with HAS_PROCESS, FEEDS_INTO, IMPLEMENTS, GOVERNED_BY wiring
- [ ] **FRAG-06**: Label normalization applied (concept->Concept, base/UNKNOWN removed, Safe fail culture merged, 12 lowercase->PascalCase promotions)

### Agent Wiring

- [ ] **AGENT-01**: All 10 FrameworkAgents wired with DERIVED_FROM->Framework, APPLIES_TO->ProblemType, IMPLEMENTED_BY->Bot, and parent Framework HAS_AGENT edges
- [ ] **AGENT-02**: CaseStudies wired (26+/30) with ILLUSTRATES->Framework and DEMONSTRATES->ProblemType including Challenger, NASA, Marconi, Naval Aviation, and student projects
- [ ] **AGENT-03**: Mullins Model Validation promoted from Technique to ValidationTool with full pipeline wiring (FEEDS_INTO from Triple Validation, FEEDS_INTO to Due Diligence, PREREQUISITE, TYPICAL_AT, Workshop TEACHES)
- [ ] **AGENT-04**: Workshop->TEACHES->Framework edges created (16+ edges mapping 8 workshops to their frameworks)
- [ ] **AGENT-05**: Bot->IMPLEMENTS->Framework edges created (15+ edges mapping 15 bots to their frameworks)
- [ ] **AGENT-06**: CorePrinciple->GOVERNS edges created (20+ edges) plus EMBODIED_IN->Workshop wiring
- [ ] **AGENT-07**: Grading calibration gap flagged as SystemGap node with severity=CRITICAL, marking 0/100+ missing Example nodes with rubric scores

### Verification

- [ ] **VERIFY-01**: Post-normalization verification queries confirm all target edge counts met (FEEDS_INTO 35+, TYPICAL_AT 30+, PREREQUISITE 14+, ADDRESSES_PROBLEM_TYPE 50+)
- [ ] **VERIFY-02**: Zero orphan FrameworkAgents, zero duplicate DictionaryTerms, zero INTRODUCES_FRAMEWORK edges landing on non-Framework nodes
- [ ] **VERIFY-03**: graph-architecture.md updated with post-normalization metrics and working query patterns verified against live graph
- [ ] **VERIFY-04**: All scripts verified idempotent (safe to re-run without creating duplicate edges)

## Future Requirements

### Grading Calibration (v1.9+)

- **GRADE-01**: 100+ Example nodes created with grade, grade_numeric, rubric_scores, feedback_patterns, percentile from Lawrence's actual grading records
- **GRADE-02**: APPLIED_IN edges connecting Example nodes to Frameworks used in each graded project
- **GRADE-03**: Grading Agent calibration verified against real distribution

### L3 Entity Bridge Enrichment (v1.9+)

- **BRIDGE-01**: Entity->Framework RELATES_TO edges enriched from ~70 to 200+ using semantic matching
- **BRIDGE-02**: Cross-domain discovery patterns tested end-to-end through Lazy->Chunk->Entity->Framework path

## Out of Scope

| Feature | Reason |
|---------|--------|
| Delete LazyGraphConcepts with relationships | CO_OCCURS fabric is valuable for semantic discovery. Use ALIAS_OF instead. |
| Rewrite CO_OCCURS edges to add weight | 122K edges. Weight exists on 99.99% already. Bulk rewrite not justified. |
| Merge __Entity__ nodes into curated labels | 5,316 nodes. Too risky without manual review. ALIAS_OF is safer. |
| Create grading Example nodes from scratch | Requires Lawrence's actual grading data. Can't synthesize. |
| Build Cypher write automation from CLI | Aura console or write MCP is sufficient for this milestone. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FRAG-06 | Phase 52 | Pending |
| CAUSAL-05 | Phase 52 | Pending |
| FRAG-01 | Phase 52 | Pending |
| FRAG-02 | Phase 52 | Pending |
| FRAG-03 | Phase 52 | Pending |
| FRAG-04 | Phase 52 | Pending |
| LAZY-04 | Phase 52 | Pending |
| FRAG-05 | Phase 52 | Pending |
| CAUSAL-01 | Phase 53 | Pending |
| CAUSAL-02 | Phase 53 | Pending |
| CAUSAL-03 | Phase 53 | Pending |
| CAUSAL-04 | Phase 53 | Pending |
| AGENT-03 | Phase 54 | Pending |
| AGENT-04 | Phase 54 | Pending |
| AGENT-05 | Phase 54 | Pending |
| AGENT-06 | Phase 54 | Pending |
| AGENT-01 | Phase 54 | Pending |
| AGENT-02 | Phase 54 | Pending |
| AGENT-07 | Phase 54 | Pending |
| LAZY-01 | Phase 55 | Pending |
| LAZY-02 | Phase 55 | Pending |
| LAZY-03 | Phase 55 | Pending |
| LAZY-05 | Phase 55 | Pending |
| VERIFY-01 | Phase 55 | Pending |
| VERIFY-02 | Phase 55 | Pending |
| VERIFY-03 | Phase 55 | Pending |
| VERIFY-04 | Phase 55 | Pending |

**Coverage:**
- v1.8.2 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after initial definition*
