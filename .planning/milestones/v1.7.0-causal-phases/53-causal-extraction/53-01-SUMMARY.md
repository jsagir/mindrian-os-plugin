---
phase: 53-causal-extraction
plan: "01"
subsystem: graph
tags: [kuzudb, causal-extraction, lazygraph, three-gaps, provenance]

requires:
  - phase: 52-causal-schema-brain-enrichment
    provides: CAUSES and ROOT_CAUSE_OF edge types, Brain enrichment
provides:
  - createCausalClaim() CRUD function writing 12-property CausalClaim nodes
  - createExtractedFromEdge() provenance linking CausalClaim to source Artifact
  - causal-to-kuzu.cjs bridge script with Three Gaps enforcement
  - Automated test suite covering EXTRACT-01 through EXTRACT-06
affects: [causal-command, constellation-graph, fabric-chat, cascade-pipeline]

tech-stack:
  added: []
  patterns: [causal-claim-crud, three-gaps-validation, bridge-script-pattern]

key-files:
  created:
    - scripts/causal-to-kuzu.cjs
    - tests/test-phase-53-causal-extract.sh
    - tests/fixtures/test-room-causal/.causal-extract.json
    - tests/fixtures/test-room-causal/problem-definition/market-pain.md
  modified:
    - lib/core/lazygraph-ops.cjs

key-decisions:
  - "CausalClaim node table added to initSchema (was missing from worktree)"
  - "Cause/effect truncated to 200 chars, mechanism to 300 chars to prevent oversized nodes"
  - "Bridge exits silently (code 0) when .causal-extract.json missing"
  - "Array evidence serialized to JSON string for KuzuDB string column"

patterns-established:
  - "CausalClaim CRUD: MERGE with ON CREATE/ON MATCH SET for all 12 properties"
  - "Three Gaps validation: reject claims missing mechanism or falsifiable_prediction"
  - "Confidence-by-method map: observed=0.7, asserted=0.5, inferred=0.3"

metrics:
  duration: 4min
  completed: 2026-04-05
  tasks: 2
  files: 5
---

# Phase 53 Plan 01: Causal Extraction Pipeline Summary

**CausalClaim CRUD functions + bridge script with Three Gaps enforcement, confidence scoring, domain validation, and max 5 claims per artifact**

## What Was Built

Two CRUD functions added to `lib/core/lazygraph-ops.cjs`:
- `createCausalClaim(conn, claim)` - writes all 12 CausalClaim properties via MERGE with truncation guards
- `createExtractedFromEdge(conn, claimId, artifactId)` - links CausalClaim to source Artifact via EXTRACTED_FROM edge

Bridge script at `scripts/causal-to-kuzu.cjs`:
- Reads `.causal-extract.json` from room directory
- Sets confidence by extraction method (observed=0.7, asserted=0.5, inferred=0.3)
- Rejects claims missing mechanism or falsifiable_prediction (Three Gaps)
- Stops after 5 claims per artifact
- Validates domain against 7 valid values, defaults to 'general'
- Follows open-use-close pattern from hsi-to-kuzu.cjs

Test suite at `tests/test-phase-53-causal-extract.sh`:
- T1 (EXTRACT-01): CausalClaim node written with correct cause
- T2 (EXTRACT-02): EXTRACTED_FROM edge links claim to artifact
- T3 (EXTRACT-03): Confidence varies by method (0.7/0.5/0.3)
- T4 (EXTRACT-04): Domain stored correctly on node
- T5 (EXTRACT-05): Max 5 claims enforced (7 input, 5 written)
- T6 (EXTRACT-06): Incomplete claims rejected (Three Gaps)
- All 10 assertions pass

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 93d5d17 | createCausalClaim + createExtractedFromEdge CRUD functions |
| 2 | dd8dccf | Bridge script + test suite + fixtures |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added CausalClaim node table and EXTRACTED_FROM edge to initSchema**
- **Found during:** Task 1
- **Issue:** Plan references CausalClaim schema at lines 121-134 of lazygraph-ops.cjs, but the worktree (branched before Phase 52 parallel execution) did not contain the table. CRUD functions cannot write to non-existent tables.
- **Fix:** Added CausalClaim node table (12 properties) and EXTRACTED_FROM rel table to initSchema(), added EXTRACTED_FROM to EDGE_TYPES array and graphStats routing.
- **Files modified:** lib/core/lazygraph-ops.cjs
- **Commit:** 93d5d17

## Known Stubs

None - all data paths are fully wired.

## Self-Check: PASSED
