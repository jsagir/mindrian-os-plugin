---
phase: 44
plan: 01
subsystem: knowledge-graph, methodology-references, brain-queries
tags: [dba, triz, sapphire, analogy, kuzudb, brain]
dependency_graph:
  requires: [lazygraph-ops.cjs, query-patterns.md]
  provides: [ANALOGOUS_TO edge, STRUCTURALLY_ISOMORPHIC edge, RESOLVES_VIA edge, triz-matrix.json, triz-principles.md, sapphire-encoding.md, brain_analogy_search]
  affects: [graphStats, initSchema, methodology/index.md]
tech_stack:
  added: [TRIZ contradiction matrix, SAPPhIRE ontology]
  patterns: [open-use-close KuzuDB, CJS module.exports, string-interpolated Cypher]
key_files:
  created:
    - references/methodology/triz-matrix.json
    - references/methodology/triz-principles.md
    - references/methodology/sapphire-encoding.md
  modified:
    - lib/core/lazygraph-ops.cjs
    - references/brain/query-patterns.md
    - references/methodology/index.md
decisions:
  - "TRIZ enrichment stored as RESOLVES_VIA edge (not CONTRADICTS properties) because KuzuDB 0.11.3 does not support ALTER TABLE ADD COLUMN on REL tables"
  - "SAPPhIRE layers mapped 1:1 to room sections for intuitive extraction"
  - "brain_analogy_search ranks by structural bridge presence (CO_OCCURS) over simple problem-type match"
metrics:
  duration: "8min"
  completed: "2026-03-31"
  tasks: 5
  files: 6
---

# Phase 44 Plan 01: Design-by-Analogy Foundation Summary

Extended knowledge graph and reference library with analogy-specific edge types, TRIZ contradiction parameters, and SAPPhIRE functional encoding for cross-domain innovation discovery.

## One-liner

3 new KuzuDB edge types (ANALOGOUS_TO, STRUCTURALLY_ISOMORPHIC, RESOLVES_VIA) + TRIZ 39x39 contradiction matrix + SAPPhIRE 7-layer encoding guide + brain_analogy_search Cypher pattern

## What Was Built

### DBA-08: Three New KuzuDB Edge Types

Added to `lib/core/lazygraph-ops.cjs`:

- **ANALOGOUS_TO** (Artifact-to-Artifact): Records functional analogies between room artifacts with `analogy_distance` (near/far/cross-domain), `structural_fitness` (0-1), `source_domain`, `transfer_map` (JSON), `discovery_method` (hsi/brain/llm/external/user)
- **STRUCTURALLY_ISOMORPHIC** (Section-to-Section): Records identical relational topology between room sections with `isomorphism_score` (0-1), `mapped_elements` (JSON), `source`
- **RESOLVES_VIA** (Artifact-to-Artifact): Links a contradiction to its resolution with `resolution_type` (analogy/triz_principle/direct), `triz_principle`, `analogy_source`, `confidence` (0-1)

Three creation functions exported: `createAnalogyEdge()`, `createIsomorphismEdge()`, `createResolutionEdge()`. All follow the existing open-use-close pattern with MERGE for idempotent upserts.

`graphStats()` updated to route STRUCTURALLY_ISOMORPHIC as Section-to-Section edge (like REASONING_INFORMS and REVERSE_SALIENT).

EDGE_TYPES array extended from 9 to 12 entries. Backward compatible -- existing edge types untouched.

### DBA-09: TRIZ Contradiction Enrichment

Added `enrichContradictionWithTRIZ(conn, artifactA, artifactB, improvingParam, worseningParam)` function that:
1. Loads `references/methodology/triz-matrix.json`
2. Looks up the improving/worsening parameter pair
3. Returns suggested inventive principle numbers
4. Creates a RESOLVES_VIA edge with `resolution_type='triz_principle'`

Design decision: TRIZ data stored as RESOLVES_VIA edges rather than additional properties on CONTRADICTS edges, because KuzuDB 0.11.3 does not support ALTER TABLE ADD COLUMN on relationship tables.

### DBA-10: TRIZ Reference Files

- **triz-matrix.json**: 39x39 contradiction matrix with parameter names as keys, mapping to arrays of inventive principle numbers. Based on Altshuller's analysis of 2.5 million patents.
- **triz-principles.md**: All 40 inventive principles with: number, name, description, and 2-3 application examples each. Includes the 39 engineering parameters reference table.

### DBA-11: SAPPhIRE Encoding Guide

- **sapphire-encoding.md**: Complete guide with 7 SAPPhIRE layers explained, each mapped to a MindrianOS room section. Includes YAML extraction template for encoding room artifacts, 3 fully worked examples (EdTech/regulate, Supply Chain/connect, Drug Delivery/filter), structural fitness scoring rubric, and integration instructions for the DbA pipeline stages.

### DBA-12: Brain Analogy Search Query Pattern

Added Pattern 9 (`brain_analogy_search`) to `references/brain/query-patterns.md`:
- Finds frameworks from different domains addressing the same problem type
- Uses ADDRESSES_PROBLEM_TYPE and CO_OCCURS relationships
- Returns `analogy_framework`, `analogy_domain`, `shared_problem_type`, `structural_bridge`
- Ranked by structural bridge presence for graph-validated analogies

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | DBA-08 + DBA-09: Edge types + TRIZ enrichment | 9e63cf3 | lib/core/lazygraph-ops.cjs |
| 2 | DBA-10: TRIZ reference files | 0dc0573 | references/methodology/triz-matrix.json, triz-principles.md |
| 3 | DBA-11: SAPPhIRE encoding guide | 7e2ee15 | references/methodology/sapphire-encoding.md |
| 4 | DBA-12: Brain analogy search pattern | f37d623 | references/brain/query-patterns.md |
| 5 | Methodology index update | 3ed92ef | references/methodology/index.md |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TRIZ data stored as RESOLVES_VIA edge instead of CONTRADICTS properties**
- **Found during:** Task 1 (DBA-09 implementation)
- **Issue:** KuzuDB 0.11.3 does not support ALTER TABLE ADD COLUMN on existing REL tables, so triz_improving_param/triz_worsening_param/triz_principles cannot be added to existing CONTRADICTS edges
- **Fix:** Store TRIZ enrichment data in a RESOLVES_VIA edge with resolution_type='triz_principle' and analogy_source capturing the improving vs worsening parameters
- **Files modified:** lib/core/lazygraph-ops.cjs
- **Commit:** 9e63cf3

## Known Stubs

None -- all files are complete and functional.

## Self-Check: PASSED

- [x] references/methodology/triz-matrix.json: FOUND
- [x] references/methodology/triz-principles.md: FOUND
- [x] references/methodology/sapphire-encoding.md: FOUND
- [x] lib/core/lazygraph-ops.cjs: FOUND (modified)
- [x] references/brain/query-patterns.md: FOUND (modified)
- [x] references/methodology/index.md: FOUND (modified)
- [x] Commit 9e63cf3: FOUND
- [x] Commit 0dc0573: FOUND
- [x] Commit 7e2ee15: FOUND
- [x] Commit f37d623: FOUND
- [x] Commit 3ed92ef: FOUND
