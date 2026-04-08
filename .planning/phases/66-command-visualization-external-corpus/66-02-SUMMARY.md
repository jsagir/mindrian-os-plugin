---
phase: 66-command-visualization-external-corpus
plan: 02
subsystem: whitespace-detection
tags: [semantic-scholar, embeddings, cross-domain, external-corpus, llm-embedder]

requires:
  - phase: 60-embedding-infrastructure
    provides: whitespace-embeddings.json room artifact embeddings
  - phase: 61-novelty-scoring-gap-detection
    provides: whitespace-results.json gap zones
provides:
  - Semantic Scholar API query script with 7-day TTL cache
  - External corpus embedding in same 768-dim space as room artifacts
  - Cross-domain whitespace zone detection
  - Gap-filling paper suggestions for room whitespace zones
affects: [66-command-visualization-external-corpus, whitespace-command, discovery-cycle]

tech-stack:
  added: [Semantic Scholar API (free, no auth)]
  patterns: [external corpus caching with TTL, cross-domain cosine distance detection]

key-files:
  created:
    - scripts/query-semantic-scholar.cjs
    - scripts/compute-external-whitespace.py
  modified: []

key-decisions:
  - "Semantic Scholar API chosen for free academic paper access (no auth required)"
  - "7-day TTL cache prevents redundant API calls while keeping data fresh"
  - "Same embedding model (BAAI/llm-embedder) used for external papers to ensure cosine comparability with room artifacts"
  - "0.6 cosine distance threshold for external whitespace, 0.5 similarity for gap-filling"

patterns-established:
  - "CJS-to-Python pipeline: CJS fetches external data, Python embeds and analyzes"
  - "Multi-source keyword extraction: embeddings titles + interpretation results + topic forest labels"
  - "Cross-domain detection: fieldsOfStudy mismatch with semantic proximity"

requirements-completed: [EMBED-05]

duration: 4min
completed: 2026-04-08
---

# Phase 66 Plan 02: External Corpus Integration Summary

**Semantic Scholar API integration with cross-domain whitespace detection using same llm-embedder model for cosine-comparable external paper analysis**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-08T02:42:07Z
- **Completed:** 2026-04-08T02:46:35Z
- **Tasks:** 2/2
- **Files created:** 2

## Accomplishments

### Task 1: query-semantic-scholar.cjs
- CJS script that queries Semantic Scholar API based on room content keywords
- Extracts keywords from 3 sources: whitespace-embeddings titles/sections, interpretation-results problem types/frameworks, topic-forest labels
- Groups keywords into 3-5 query strings for API search
- Caches results at room/.mindrian/external-corpus-cache.json with 7-day TTL
- Rate limits API calls to 1 request/second
- Filters papers: non-empty abstract required, year >= 2015
- Handles API timeouts (10s), rate limits (429), network failures gracefully

### Task 2: compute-external-whitespace.py
- Python script that embeds external paper abstracts in same 768-dim space as room artifacts
- Uses same model loading pattern as compute-whitespace-embeddings.py (BAAI/llm-embedder primary, MiniLM fallback)
- Detects 3 types of cross-domain whitespace:
  1. External whitespace zones: papers covering territory room hasn't explored (cosine distance > 0.6)
  2. Gap-filling suggestions: papers semantically close to known room whitespace zones (similarity > 0.5)
  3. Cross-domain papers: different fieldsOfStudy but semantically near room content
- Outputs room/.mindrian/external-whitespace-results.json

## Commit Log

| Task | Commit | Message |
|------|--------|---------|
| 1 | a769c55 | feat(66-02): create Semantic Scholar API query script with 7-day TTL cache |
| 2 | 24c6ac6 | feat(66-02): create external whitespace detection with cross-domain analysis |

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - both scripts are fully functional with real API integration and embedding pipeline.
