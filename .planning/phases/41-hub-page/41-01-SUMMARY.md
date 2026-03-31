---
phase: 41-hub-page
plan: 01
subsystem: export
tags: [snapshot, html, de-stijl, breakthroughs, opportunities, views, stats]

requires:
  - phase: 40-export-skeleton
    provides: generate-snapshot.cjs with branded skeleton (header, footer, stats, section cards)
provides:
  - Above-fold content: breakthrough angles, opportunities, view cards
  - Data extractors: extractBreakthroughs, extractOpportunities, extractViews
  - 4-column section grid with responsive breakpoints
  - Stats bar always showing 5 counters
affects: [42-view-generation, 43-insights-redteam]

tech-stack:
  added: []
  patterns: [conditional-section-rendering, graph-node-filtering, frontmatter-parsing-for-opportunities]

key-files:
  created: []
  modified:
    - scripts/generate-snapshot.cjs

key-decisions:
  - "Breakthrough tag derived from node classes (e.g. breakthrough-node -> Breakthrough Node) with Cross-Domain fallback"
  - "Opportunities parser scans both frontmatter fields and markdown body patterns for flexibility"
  - "View cards always render all 4 views with grayed-out state until Phase 42 generates them"
  - "Stats bar grantCount unconditionally rendered (was previously conditional on > 0)"

patterns-established:
  - "Extraction functions: standalone functions called from scanRoom, results added to model"
  - "Conditional sections: entire HTML block wrapped in ternary based on data presence"
  - "Grid variants: card-grid-3 and card-grid-4 CSS classes with responsive breakpoints"

requirements-completed: [HUB-01, HUB-02, HUB-03, ATF-01, ATF-02]

duration: 9min
completed: 2026-03-31
---

# Phase 41 Plan 01: Hub Page Above-Fold Content Summary

**Data extractors for breakthroughs/opportunities/views plus above-fold HTML sections with De Stijl styling and 4-column section grid**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-31T23:36:57Z
- **Completed:** 2026-03-31T23:46:17Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- 3 data extractors (extractBreakthroughs, extractOpportunities, extractViews) integrated into scanRoom model
- Breakthrough Angles section renders 5 blue-accented cards from demo room graph nodes
- Top Opportunities section with scored list or CTA fallback for empty rooms
- View Cards section showing 4 views (Intelligence Map, Wiki, Doc Hub, Deck) all grayed out until Phase 42
- Section cards grid upgraded from auto-fill to fixed 4-column layout
- Stats bar always shows all 5 counters (Sections, Articles, Connections, Gaps, Grants)

## Task Commits

1. **Task 1: Add data extractors to scanRoom and model** - `53c2b46` (feat)
2. **Task 2: Render above-fold sections and view cards in HTML template** - `8680f4b` (feat)

## Files Created/Modified
- `scripts/generate-snapshot.cjs` - Added extractBreakthroughs, extractOpportunities, extractViews functions; new HTML sections for breakthroughs, opportunities, views; CSS for card-grid-3, card-grid-4, score-badge, view-card-disabled, cta-card, breakthrough-card, opp-row; stats bar fix

## Decisions Made
- Breakthrough tag is derived from the node's classes field rather than a separate tag field, since demo data uses classes like "breakthrough-node"
- Opportunities parser handles two formats: structured frontmatter (relevance_score, funder, etc.) and body-scanning for numbered items with score patterns
- CTA card shows when no opportunities exist with /mos:opportunities scan command suggestion
- View cards render all 4 views regardless of availability, using disabled styling per D-05

## Deviations from Plan

None -- plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None -- all sections render real data from the demo room or show proper empty states.

## User Setup Required

None -- no external service configuration required.

## Next Phase Readiness
- Hub page now has above-fold content (breakthroughs, opportunities) and navigable view cards
- Phase 42 will generate the actual view files (intelligence-map.html, wiki.html, dochub.html, deck.html) that view cards link to
- Key Insights and Red Team sections (HUB-04, HUB-05) can be added in Phase 41 Plan 02

---
*Phase: 41-hub-page*
*Completed: 2026-03-31*
