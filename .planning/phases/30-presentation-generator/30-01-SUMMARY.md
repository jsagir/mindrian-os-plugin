---
phase: 30-presentation-generator
plan: 01
subsystem: export
tags: [html-generator, de-stijl, canvas-graph, presentation, self-contained]

requires:
  - phase: 29-canvas-graph
    provides: Canvas 2D graph renderer + detail panel
  - phase: 25-export-system
    provides: generate-export.cjs patterns, ROOM_DATA shape, export-template.html
provides:
  - Master presentation generator (scripts/generate-presentation.cjs)
  - Dashboard template with stats, view cards, governing thought, opportunities, video, assets, mini graph
  - Standalone graph template with Canvas renderer and detail panel
  - Post-write cascade integration for auto-regeneration
affects: [30-02, 30-03, post-write, exports]

tech-stack:
  added: []
  patterns: [6-template presentation system, ROOM_DATA_PLACEHOLDER injection, inline JS embedding, graceful template skip]

key-files:
  created:
    - scripts/generate-presentation.cjs
    - templates/presentation/dashboard.html
    - templates/presentation/graph.html
  modified:
    - scripts/post-write

key-decisions:
  - "Zero npm dependencies for generator - pure Node.js built-ins (continues Phase 10 pattern)"
  - "Graceful degradation: missing templates skipped with warning, not failure"
  - "canvas-graph.js and graph-detail-panel.js inlined via fs.readFileSync for self-contained HTML"
  - "Post-write only fires when exports/presentation/ exists (opt-in via first manual generate)"

patterns-established:
  - "Template placeholder pattern: ROOM_DATA_PLACEHOLDER, CANVAS_GRAPH_JS, GRAPH_DETAIL_PANEL_JS, {{ROOM_NAME}}, {{THEME}}, {{GENERATED_DATE}}"
  - "6-template output: dashboard->index.html, wiki.html, deck.html, insights.html, diagrams.html, graph.html"

requirements-completed: [PRES-01, PRES-02, PRES-07, PRES-09]

duration: 4min
completed: 2026-03-31
---

# Phase 30 Plan 01: Presentation Generator + Dashboard & Graph Templates Summary

**Master presentation generator producing self-contained De Stijl HTML from room data, with dashboard (stats/cards/graph/opportunities) and standalone Canvas graph view**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-31T02:47:21Z
- **Completed:** 2026-03-31T02:51:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Master generator reads any room directory and produces 6 self-contained HTML views (2 templates now, 4 to come in Plans 02/03)
- Dashboard template includes stats bar, 6 view cards, governing thought, opportunities grid, video embed, assets grid, and mini Canvas graph
- Graph template renders full-viewport Canvas 2D force graph with detail panel, edge legend, and back-to-dashboard navigation
- Both templates enforce branding contract: MindrianOS logo header, "Built with MindrianOS" footer, Mondrian color bar
- Post-write cascade wired for automatic presentation regeneration on every room filing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create generate-presentation.cjs master generator** - `ed8bb83` (feat)
2. **Task 2: Wire generate-presentation into post-write cascade** - `78ebb5e` (feat)

## Files Created/Modified
- `scripts/generate-presentation.cjs` - Master generator: reads room data, injects ROOM_DATA JSON into 6 HTML templates
- `templates/presentation/dashboard.html` - Dashboard with stats, view cards, governing thought, opportunities, video, assets, mini graph
- `templates/presentation/graph.html` - Standalone full-viewport Canvas graph with detail panel and edge legend
- `scripts/post-write` - Added background generate-presentation step after HSI computation

## Decisions Made
- Zero npm dependencies for generator - pure Node.js built-ins (continues Phase 10 pattern)
- Graceful degradation: missing templates skipped with warning, not failure (4 templates pending Plans 02/03)
- canvas-graph.js and graph-detail-panel.js read via fs.readFileSync and inlined as script tags for self-contained HTML
- Post-write only fires when exports/presentation/ directory already exists (user opts in by running first manual generate)
- Dark/light theme toggle via data-theme attribute and CSS variable overrides

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plans 02/03 will add wiki.html, deck.html, insights.html, diagrams.html templates
- Generator infrastructure ready: new templates just need to be placed in templates/presentation/ and they are automatically picked up
- Post-write integration active: rooms with exports/presentation/ get auto-regenerated on every filing

---
*Phase: 30-presentation-generator*
*Completed: 2026-03-31*
