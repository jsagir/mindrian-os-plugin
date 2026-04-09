---
phase: 71-opportunity-extraction-engine
plan: 01
subsystem: intelligence
tags: [opportunity-extraction, knight-uncertainty, djb2-hash, dedup, yaml-frontmatter]

requires: []
provides:
  - "Universal opportunity schema (OPPORTUNITY_SCHEMA_FIELDS) with 9 fields"
  - "extractOpportunities() converts GAP/CONVERGE/CONTRADICT signals to opportunity objects"
  - "opportunityHash() djb2-based dedup key generation"
  - "bankOpportunity() persists opportunities to room/opportunity-bank/ with dedup"
affects: [71-02, methodology-commands, intelligence-cascade, opportunity-bank]

tech-stack:
  added: []
  patterns: [knight-position-classification, problem-hash-dedup, confidence-mapping]

key-files:
  created: [lib/core/opportunity-extractor.cjs, tests/opportunity-extractor.test.cjs]
  modified: [lib/core/opportunity-ops.cjs]

key-decisions:
  - "djb2 hash for problem dedup - fast, deterministic, sufficient for file-level uniqueness"
  - "Knight position mapping: gaps=uncertainty, convergences=risk, contradictions=mixed"
  - "Confidence floor at 0.3 (LOW) - below that is noise, filtered out"

patterns-established:
  - "Opportunity schema: 9 fields always present on every opportunity object"
  - "Problem hash dedup: scan existing files by problem_hash frontmatter field before creating"
  - "Evidence accumulation: dedup hits append evidence rather than overwrite"

requirements-completed: [OPP-01, OPP-03]

duration: 4min
completed: 2026-04-09
---

# Phase 71 Plan 01: Opportunity Extraction Engine Summary

**Universal opportunity schema with Knight risk/uncertainty classification, djb2 dedup, and bankOpportunity persistence to room/opportunity-bank/**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-09T17:29:39Z
- **Completed:** 2026-04-09T17:33:39Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Universal opportunity schema (9 fields) defined and exported as OPPORTUNITY_SCHEMA_FIELDS constant
- extractOpportunities() converts GAP/CONVERGE/CONTRADICT analyze-room signals into structured opportunity objects with Knight position classification
- bankOpportunity() persists opportunities to room/opportunity-bank/ with full YAML frontmatter and problem_hash dedup
- 12 tests passing covering all insight types, confidence mapping, hash consistency, and empty-input handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create opportunity-extractor.cjs with universal schema and extraction logic** - `676315f` (feat) - TDD: RED then GREEN
2. **Task 2: Extend opportunity-ops.cjs with bankOpportunity() and dedup logic** - `b0a9688` (feat)

## Files Created/Modified
- `lib/core/opportunity-extractor.cjs` - Universal schema, djb2 hash, extraction from GAP/CONVERGE/CONTRADICT signals
- `tests/opportunity-extractor.test.cjs` - 12 tests covering all extraction paths
- `lib/core/opportunity-ops.cjs` - Extended with bankOpportunity() function and opportunity-extractor require

## Decisions Made
- Used djb2 hash (first 8 hex chars) as problem dedup key - fast, deterministic, collision-resistant enough for file naming
- Knight position mapping follows Frank Knight (1921): gaps are uncertainty (unknown unknowns), convergences are risk (quantifiable patterns), contradictions are mixed
- Confidence floor at 0.3 filters noise - LOW is the minimum actionable signal

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all data paths are wired end-to-end.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- opportunity-extractor.cjs ready for integration into intelligence-cascade.cjs (Phase 71 Plan 02)
- bankOpportunity() ready to be called from methodology command post-hooks
- Schema fields available for KuzuDB edge creation (OPP-04 in Phase 72)

## Self-Check: PASSED

- FOUND: lib/core/opportunity-extractor.cjs
- FOUND: tests/opportunity-extractor.test.cjs
- FOUND: .planning/phases/71-opportunity-extraction-engine/71-01-SUMMARY.md
- FOUND: lib/core/opportunity-ops.cjs (modified)
- FOUND: commit 676315f (Task 1)
- FOUND: commit b0a9688 (Task 2)

---
*Phase: 71-opportunity-extraction-engine*
*Completed: 2026-04-09*
