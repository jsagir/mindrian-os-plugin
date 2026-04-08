---
phase: 61-novelty-scoring-gap-detection
plan: 02
subsystem: database
tags: [kuzudb, whitespace, lazygraph, novelty-scoring, gap-detection]

requires:
  - phase: 61-01
    provides: "compute-whitespace-gaps.py producing whitespace-results.json"
  - phase: 60-embedding-infrastructure
    provides: "KuzuDB lazygraph-ops.cjs with CausalClaim schema pattern"
provides:
  - "WhitespaceZone node table in KuzuDB schema"
  - "WHITESPACE_DETECTED and WHITESPACE_NEAR edge tables"
  - "addWhitespaceZone(), linkWhitespaceToArtifact(), linkWhitespaceToSection() CRUD functions"
  - "whitespace-to-kuzu.cjs bridge script for persisting gap results"
affects: [61-03, whitespace-command, dashboard-views]

tech-stack:
  added: []
  patterns: ["WhitespaceZone as carrier node for novelty scores", "section-via-artifact edge discovery"]

key-files:
  created: ["scripts/whitespace-to-kuzu.cjs"]
  modified: ["lib/core/lazygraph-ops.cjs"]

key-decisions:
  - "Novelty scores stored as WhitespaceZone carrier nodes linked to artifacts (KuzuDB lacks ALTER TABLE ADD COLUMN for dynamic schema)"
  - "WHITESPACE_NEAR edges derived from artifact BELONGS_TO section traversal"

patterns-established:
  - "WhitespaceZone CRUD: same MERGE/upsert pattern as CausalClaim and Analogy edges"
  - "Bridge script pattern: open-use-close with silent exit on missing results file"

requirements-completed: [OUT-03]

duration: 3min
completed: 2026-04-08
---

# Phase 61 Plan 02: KuzuDB Whitespace Schema & Bridge Summary

**WhitespaceZone node table, WHITESPACE_DETECTED/NEAR edges, and whitespace-to-kuzu.cjs bridge persisting gap detection results into KuzuDB**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-08T00:21:18Z
- **Completed:** 2026-04-08T00:24:06Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- WhitespaceZone node table with 10 properties (density_score, knn_density, nearest_frameworks, hypothesis, strategic_rank, problem_type, exploration_status, brain_framework, created, id)
- WHITESPACE_DETECTED (WhitespaceZone->Artifact) and WHITESPACE_NEAR (WhitespaceZone->Section) edge tables
- Three helper functions (addWhitespaceZone, linkWhitespaceToArtifact, linkWhitespaceToSection) exported from lazygraph-ops.cjs
- graphStats() updated to count WhitespaceZone nodes and route edge queries correctly
- whitespace-to-kuzu.cjs bridge script following hsi-to-kuzu.cjs pattern exactly

## Task Commits

Each task was committed atomically:

1. **Task 1: Add WhitespaceZone schema to lazygraph-ops.cjs** - `58c9956` (feat)
2. **Task 2: Create whitespace-to-kuzu.cjs bridge script** - `d93d14c` (feat)

## Files Created/Modified
- `lib/core/lazygraph-ops.cjs` - WhitespaceZone node table, WHITESPACE_DETECTED/NEAR edge tables, addWhitespaceZone/linkWhitespaceToArtifact/linkWhitespaceToSection helpers, graphStats update
- `scripts/whitespace-to-kuzu.cjs` - Bridge script reading .mindrian/whitespace-results.json and writing zones/edges to KuzuDB

## Decisions Made
- Novelty scores stored as WhitespaceZone carrier nodes linked to artifacts because KuzuDB does not support ALTER TABLE ADD COLUMN on existing node tables dynamically
- WHITESPACE_NEAR edges derived by traversing artifact BELONGS_TO section edges rather than requiring section data in the results JSON
- Added linkWhitespaceToSection() helper (not in original plan) for completeness of the edge creation API

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- WhitespaceZone schema and bridge ready for 61-03 (whitespace command integration)
- Running `node scripts/whitespace-to-kuzu.cjs /path/to/room` after compute-whitespace-gaps.py will persist all detected gaps into KuzuDB
- graphStats() will include WhitespaceZone counts in room analysis output

---
*Phase: 61-novelty-scoring-gap-detection*
*Completed: 2026-04-08*
