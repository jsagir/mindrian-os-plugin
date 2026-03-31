---
phase: 45
plan: 01
subsystem: pipelines
tags: [dba, analogy, triz, sapphire, cross-domain, innovation]
dependency_graph:
  requires: [lazygraph-ops, brain-query-patterns, challenge-assumptions, reason, research, structure-argument]
  provides: [analogy-pipeline, find-analogies-command, brain-analogy-search]
  affects: [competitive-analysis, solution-design, problem-definition]
tech_stack:
  added: []
  patterns: [SAPPhIRE encoding, TRIZ contradiction matrix, dual-mode search, correspondence tables]
key_files:
  created:
    - pipelines/analogy/CHAIN.md
    - pipelines/analogy/01-decompose.md
    - pipelines/analogy/02-abstract.md
    - pipelines/analogy/03-search.md
    - pipelines/analogy/04-transfer.md
    - pipelines/analogy/05-validate.md
    - commands/find-analogies.md
  modified:
    - references/brain/query-patterns.md
decisions:
  - SAPPhIRE triples map to existing room sections (State=problem-def, Action=solution-design, etc.)
  - TRIZ parameter mapping uses static reference files from Phase 44
  - Dual-mode search follows existing Tier 0/1/2 degradation pattern
  - /mos:find-analogies is a compressed pipeline (Stages 1-3 in single pass)
  - Stage 3 includes brain_analogy_search as query pattern 9 in query-patterns.md
  - Body Shape D (Comparison Matrix) for find-analogies output
metrics:
  duration: 5min
  completed: 2026-03-31
  tasks: 8
  files: 8
requirements: [DBA-01, DBA-02, DBA-03, DBA-04, DBA-05, DBA-06, DBA-07]
---

# Phase 45 Plan 01: Design-by-Analogy Pipeline Summary

5-stage Design-by-Analogy pipeline formalizing what HSI already discovers -- SAPPhIRE decomposition, TRIZ abstraction, dual-mode search (KuzuDB+Brain+Tavily), correspondence table transfer, and Devil's Advocate validation.

## What Was Built

### Pipeline (pipelines/analogy/)

- **CHAIN.md**: Pipeline definition with 5 stages, venture stage targeting (Discovery/Design/Investment), and chain provenance contract
- **01-decompose.md**: SAPPhIRE function-behavior-structure triple extraction using /mos:reason, maps SAPPhIRE layers to room sections
- **02-abstract.md**: Domain language stripping, functional verb replacement, TRIZ 39-parameter contradiction mapping
- **03-search.md**: Dual-mode retrieval -- internal (Tier 0 LLM + Tier 1 KuzuDB HSI edges + Tier 2 Brain MCP) and external (Tavily for AskNature, patents, academic)
- **04-transfer.md**: Correspondence table construction, concrete design proposals, transfer feasibility scoring (structural_fit x implementation_distance)
- **05-validate.md**: Devil's Advocate stress-testing of structural mappings, new contradiction detection, SURVIVED/WOUNDED/KILLED classification

### Command (commands/)

- **find-analogies.md**: /mos:find-analogies with --brain and --external flags, compressed pipeline for quick analogy discovery, tri-polar behavior (CLI matrix, Desktop conversational, Cowork team report)

### Brain Integration (references/brain/)

- **query-patterns.md**: Added pattern 9 (brain_analogy_search) -- cross-domain framework retrieval by shared problem type with bridge framework detection

## Requirements Coverage

| Requirement | Status | Implementation |
|-------------|--------|---------------|
| DBA-01 | Done | pipelines/analogy/CHAIN.md with 5 stages |
| DBA-02 | Done | 01-decompose.md with SAPPhIRE triples |
| DBA-03 | Done | 02-abstract.md with TRIZ parameter mapping |
| DBA-04 | Done | 03-search.md with dual-mode internal+external |
| DBA-05 | Done | 04-transfer.md with correspondence tables |
| DBA-06 | Done | 05-validate.md with structural stress-testing |
| DBA-07 | Done | commands/find-analogies.md with --brain and --external |

## Deviations from Plan

### Auto-added (Rule 2 - Missing Critical Functionality)

**1. brain_analogy_search query pattern (DBA-12)**
- **Found during:** Task 7 (find-analogies command)
- **Issue:** The command references brain_analogy_search but it didn't exist in query-patterns.md yet (was planned for Phase 44 but not present)
- **Fix:** Added as pattern 9 to references/brain/query-patterns.md
- **Commit:** ba21029

## Commits

| # | Hash | Message | Files |
|---|------|---------|-------|
| 1 | e61cdae | feat(45): add Design-by-Analogy pipeline CHAIN.md (DBA-01) | pipelines/analogy/CHAIN.md |
| 2 | 0207805 | feat(45): add Stage 1 DECOMPOSE (DBA-02) | pipelines/analogy/01-decompose.md |
| 3 | fccbf95 | feat(45): add Stage 2 ABSTRACT (DBA-03) | pipelines/analogy/02-abstract.md |
| 4 | 524252b | feat(45): add Stage 3 SEARCH (DBA-04) | pipelines/analogy/03-search.md |
| 5 | b605626 | feat(45): add Stage 4 TRANSFER (DBA-05) | pipelines/analogy/04-transfer.md |
| 6 | 12ec2ed | feat(45): add Stage 5 VALIDATE (DBA-06) | pipelines/analogy/05-validate.md |
| 7 | d311754 | feat(45): add /mos:find-analogies (DBA-07) | commands/find-analogies.md |
| 8 | ba21029 | feat(45): add brain_analogy_search (DBA-12) | references/brain/query-patterns.md |

## Known Stubs

None. All files are complete pipeline definitions and command instructions. No placeholder data or unresolved TODOs.

## Self-Check: PASSED

- All 7 created files verified present on disk
- All 8 commit hashes verified in git log
- brain_analogy_search pattern confirmed in query-patterns.md
