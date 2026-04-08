---
phase: 64-pipeline-integration
plan: 01
subsystem: pipelines
tags: [whitespace, hsi, reverse-salients, analogy, embeddings, cosine-similarity, k-nn, numpy, sklearn]

# Dependency graph
requires:
  - phase: 60-embedding-infrastructure
    provides: whitespace-embeddings.json and brain-baseline.json in .mindrian/
  - phase: 61-whitespace-detection
    provides: load_embeddings/load_baselines patterns, density check approach
provides:
  - HSI-seeded whitespace detection (centroid-based gap detection between surprising pairs)
  - RS-seeded whitespace detection (downstream section gap detection beyond bottlenecks)
  - Analogy-seeded whitespace detection (unarticulated transfer mechanism detection)
  - discovery-hsi-whitespace.json, discovery-rs-whitespace.json, discovery-analogy-whitespace.json output formats
affects: [64-02-pipeline-integration, discovery-cycle orchestrator]

# Tech tracking
tech-stack:
  added: []
  patterns: [centroid-based whitespace probing, gap signal classification (strong/moderate/weak), articulation gap scoring, dual-source analogy loading (KuzuDB + HSI fallback)]

key-files:
  created:
    - scripts/discover-hsi-whitespace.py
    - scripts/discover-rs-whitespace.py
    - scripts/discover-analogy-whitespace.py
  modified: []

key-decisions:
  - "Used cosine metric in NearestNeighbors for k-NN density checks (consistent with existing pipeline)"
  - "Gap signal classified as strong/moderate/weak based on brain vs room density contrast thresholds"
  - "Analogy script uses dual-source loading: KuzuDB pre-exported edges first, HSI fallback second"
  - "Articulation gap = 1.0 - max(cosine_sim of any room artifact to centroid) for analogy detection"

patterns-established:
  - "Centroid probe pattern: compute midpoint between two artifact embeddings, check Brain/room density contrast at that point"
  - "Graceful degradation: all three scripts exit 0 with empty zones when source data is missing"
  - "Discovery output convention: .mindrian/discovery-{type}-whitespace.json with metadata + zones array"

requirements-completed: [PIPE-01, PIPE-02, PIPE-03]

# Metrics
duration: 4min
completed: 2026-04-08
---

# Phase 64 Plan 01: Pipeline Integration Discovery Scripts Summary

**Three seeded whitespace detection scripts that use HSI pair centroids, RS downstream mapping, and analogy transfer verification to find what's MISSING in a room's understanding**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-08T01:41:14Z
- **Completed:** 2026-04-08T01:45:50Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- HSI-seeded script computes centroids between surprising pairs (hsi_score > 0.4), checks Brain framework density vs room artifact density to find missing connecting insights
- RS-seeded script maps downstream sections of bottlenecks, checks Brain framework coverage to find gaps the bottleneck prevents seeing
- Analogy-seeded script checks whether cross-domain transfer mechanisms have been articulated, using either KuzuDB pre-exported edges or HSI fallback candidates (semantic_sim > 0.6, lsa_sim < 0.3)

## Task Commits

Each task was committed atomically:

1. **Task 1: HSI-seeded and RS-seeded whitespace detection scripts** - `0a5dcb6` (feat)
2. **Task 2: Analogy-seeded whitespace detection script** - `a4d0c64` (feat)

## Files Created/Modified
- `scripts/discover-hsi-whitespace.py` - Finds whitespace zones between surprising HSI pairs using centroid-based density contrast
- `scripts/discover-rs-whitespace.py` - Finds whitespace zones downstream of RS bottleneck sections
- `scripts/discover-analogy-whitespace.py` - Finds unarticulated cross-domain transfer mechanisms via analogy centroid analysis

## Decisions Made
- Used cosine metric in sklearn NearestNeighbors (consistent with existing whitespace pipeline)
- Gap signal classification: strong (brain > 0.5, room < 0.3), moderate (brain > 0.3, room < 0.5), weak (otherwise)
- Analogy dual-source: tries .mindrian/analogy-edges.json first (Plan 02 orchestrator will export), falls back to HSI pairs with cross-domain analogy pattern
- Articulation gap formula: 1.0 - max(cosine_sim) measures how well the transfer mechanism has been written down

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three discovery scripts ready for Plan 02 (discovery-cycle orchestrator) to chain them
- Output JSON files follow consistent convention (.mindrian/discovery-{type}-whitespace.json)
- Each script handles missing inputs gracefully, enabling partial cycle execution (per D-13)

---
*Phase: 64-pipeline-integration*
*Completed: 2026-04-08*
