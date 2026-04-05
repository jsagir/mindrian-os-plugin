---
phase: 54-graph-engine
plan: 01
subsystem: database
tags: [kuzudb, causal-graph, cascades-to, json-export, test-seed]

requires:
  - phase: 52-53-causal-extraction
    provides: CausalClaim schema, createCausalClaim(), createExtractedFromEdge(), causal-to-kuzu.cjs
provides:
  - exportCausalGraph() writes .lazygraph-causal-export.json for Python engine consumption
  - createCascadesToEdge() creates idempotent CASCADES_TO edges between CausalClaim nodes
  - causal-to-kuzu.cjs handles cascades array from extraction output
  - Test seed script with 6 claims, 5 cascade edges, intentional cycle, cross-ref fixtures
affects: [54-02-compute-causal-py, 54-03-cross-reference-queries]

tech-stack:
  added: []
  patterns: [open-use-close KuzuDB pattern for export, separate connection cycles for write then export]

key-files:
  created:
    - tests/test-causal-seed.cjs
  modified:
    - lib/core/lazygraph-ops.cjs
    - scripts/causal-to-kuzu.cjs

key-decisions:
  - "exportCausalGraph uses its own open-close cycle separate from caller context"
  - "Test seed creates cross-ref fixtures (HSI, RS, Analogy) for ENGINE-05/06/07 testing in Plan 03"
  - "CASCADES_TO edges used as the universal causal chain edge (not CAUSES between CausalClaims)"

patterns-established:
  - "CJS export function pattern: query KuzuDB, write JSON to room dir, Python reads it"
  - "Test seed scripts: standalone CJS that populates a room for verification"

requirements-completed: [ENGINE-01, ENGINE-02]

duration: 8min
completed: 2026-04-05
---

# Phase 54 Plan 01: Causal Graph Engine Foundation Summary

**CJS export function + CASCADES_TO edge creation + test seed data for the causal graph engine -- Python engine and cross-ref queries can now consume KuzuDB causal data via JSON bridge**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-05T13:22:17Z
- **Completed:** 2026-04-05T13:30:41Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- exportCausalGraph() queries CausalClaim nodes + CASCADES_TO edges and writes .lazygraph-causal-export.json
- createCascadesToEdge() creates idempotent CASCADES_TO edges via MERGE with cascade_type, severity, path_length
- causal-to-kuzu.cjs now processes data.cascades array alongside claims
- Test seed script populates 6 claims, 5 cascade edges (chain A->B->C, cycle D->E->D, shortcut A->C), plus HSI/RS/Analogy fixtures

## Task Commits

Each task was committed atomically:

1. **Task 1: Add exportCausalGraph() and createCascadesToEdge() to lazygraph-ops.cjs** - `5219445` (feat)
2. **Task 2: Update causal-to-kuzu.cjs + create test seed script** - `4304149` (feat)

## Files Created/Modified
- `lib/core/lazygraph-ops.cjs` - Added createCascadesToEdge(), exportCausalGraph(), synced Phase 52-53 schema (CausalClaim, CAUSES, ROOT_CAUSE_OF)
- `scripts/causal-to-kuzu.cjs` - Added CASCADES_TO edge creation from data.cascades array
- `tests/test-causal-seed.cjs` - Standalone seed script: 6 claims, 5 cascades, 6 EXTRACTED_FROM, HSI/RS/Analogy fixtures

## Decisions Made
- exportCausalGraph() manages its own open-close KuzuDB cycle rather than requiring a caller-provided connection, making it safe to call from any context
- Test seed uses two separate connection cycles (write data, then export) to avoid KuzuDB segfault-on-close corruption
- CASCADES_TO edges are the universal causal chain for all Python engine algorithms (not a separate CAUSES edge between CausalClaims)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Synced worktree lazygraph-ops.cjs with main branch Phase 52-53 additions**
- **Found during:** Task 1
- **Issue:** Worktree was behind main branch -- missing CausalClaim schema, CAUSES, ROOT_CAUSE_OF, createCausalClaim(), createExtractedFromEdge()
- **Fix:** Wrote complete file matching main branch plus new Task 1 functions
- **Files modified:** lib/core/lazygraph-ops.cjs
- **Verification:** All exports resolve correctly
- **Committed in:** 5219445

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to bring worktree up to date. No scope creep.

## Issues Encountered
- KuzuDB segfault on close (exit code 139) is a known issue -- data writes complete successfully before the segfault occurs. Test seed works around this by using separate connection cycles.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functions are fully implemented with working KuzuDB queries.

## Next Phase Readiness
- .lazygraph-causal-export.json schema is ready for Python NetworkX engine (Plan 02)
- Test seed data with intentional cycle ready for contradiction detection (ENGINE-04)
- Cross-reference fixtures (HSI, RS, Analogy) ready for ENGINE-05/06/07 queries (Plan 03)

---
*Phase: 54-graph-engine*
*Completed: 2026-04-05*
