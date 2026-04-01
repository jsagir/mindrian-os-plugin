---
phase: 49
plan: 1
subsystem: showcase-views
tags: [showcase, deep-links, templates, html, de-stijl]
dependency_graph:
  requires: [phase-48-constellation, phase-47-room-detection, phase-42-deep-links]
  provides: [overview-view, library-view, narrative-view, synthesis-view, blueprint-view, deep-link-integration]
  affects: [generate-snapshot, snapshot-export]
tech_stack:
  added: [flexsearch-cdn, mermaid-cdn]
  patterns: [inline-json-injection, template-rendering, 3-panel-layout, fullscreen-deck]
key_files:
  created:
    - templates/showcase/overview.html
    - templates/showcase/library.html
    - templates/showcase/narrative.html
    - templates/showcase/synthesis.html
    - templates/showcase/blueprint.html
  modified:
    - scripts/generate-snapshot.cjs
decisions:
  - Showcase templates in templates/showcase/ subdirectory (not templates/ root)
  - Room data injected as inline JSON via {{ROOM_DATA}} placeholder
  - Deep links use lib/core/deep-links.cjs with fallback if module unavailable
  - FlexSearch via CDN for library search, Mermaid via CDN for blueprint flowcharts
  - All views share consistent De Stijl nav bar for cross-view navigation
metrics:
  duration: 9m
  completed: 2026-04-01T11:44:14Z
  tasks: 6
  files: 6
requirements: [VIEW-01, VIEW-02, VIEW-03, VIEW-04, VIEW-05, LINK-01, LINK-02]
---

# Phase 49: Showcase Views + Deep Links Summary

5 Showcase HTML views + deep link integration into snapshot generator for MindrianOS RoomHub

## What Was Built

### VIEW-01: Overview (templates/showcase/overview.html)
- Adaptive stats bar driven by ROOM_TYPE_CONFIG (configurable metrics per room type)
- Section cards with Thesis governing thoughts as lead paragraphs
- Signal briefing panel showing top 5 extracted signals
- Sentinel digest from room intelligence extraction
- Deep links on every Section card opening Claude Code at exact location

### VIEW-02: Library (templates/showcase/library.html)
- 3-panel layout: sidebar (Section list) + article list + reader
- FlexSearch CDN integration for instant full-text search across all Entries
- Thread hyperlinks color-coded by all 12 Thread types (INFORMS=blue, CONTRADICTS=red, CONVERGES=green, etc.)
- TOC auto-generated from markdown headings in reader panel
- Deep links on every Entry

### VIEW-03: Narrative (templates/showcase/narrative.html)
- Fullscreen slide deck with smooth opacity transitions
- Title slide from Room name + Thesis, one slide per Section with populated content
- Top 5 Entries per Section shown as content cards
- Keyboard navigation (arrow keys, space, Home, End)
- Progress bar and slide counter
- Enforces minimum 3 populated Sections with graceful fallback message

### VIEW-04: Synthesis (templates/showcase/synthesis.html)
- Stat counters: entries, threads, surprises, bottlenecks, sections, gaps
- Timeline from Room activity history
- Bottleneck heat map with sections colored by reverse salient score (red=lagging, yellow=warning, green=healthy)
- Surprise cluster visualization grouped by source section from HSI_CONNECTION edges

### VIEW-05: Blueprint (templates/showcase/blueprint.html)
- SVG architecture diagram with Section boxes connected by Thread lines
- Thread colors match 12-type palette, ANALOGOUS_TO rendered as dashed lines
- Mermaid.js flowchart rendering via CDN with dark theme configured
- Thread distribution stats showing count per edge type
- Deep links on Section boxes (click to open in Claude Code)

### Snapshot Generator Updates (scripts/generate-snapshot.cjs)
- Imports deep-links.cjs with graceful fallback
- Injects deep links into every Section, Entry, and Thread during room scan
- Enriches articles with thread info from graph edges
- Generates all 5 Showcase view HTML files alongside index.html
- Room data JSON injected into each template via placeholder replacement
- Manifest.json tracks all generated view filenames

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **Templates in showcase/ subdirectory** - Placed templates in `templates/showcase/` rather than mixing with existing presentation templates at `templates/` root
2. **Inline JSON injection** - Room data injected as `{{ROOM_DATA}}` placeholder in a `<script type="application/json">` tag, parsed client-side
3. **CDN dependencies** - FlexSearch and Mermaid loaded from jsdelivr CDN (will be inlined in Phase 51 with --offline flag)
4. **Shared nav bar** - All 5 views plus Constellation share a consistent navigation bar for cross-view browsing
5. **Deep link fallback** - If deep-links.cjs module is not available, a fallback implementation generates correct claude-cli:// URLs

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Overview template | a40b3bf | templates/showcase/overview.html |
| 2 | Library template | 235d835 | templates/showcase/library.html |
| 3 | Narrative template | 367c6c7 | templates/showcase/narrative.html |
| 4 | Synthesis template | 6ce0933 | templates/showcase/synthesis.html |
| 5 | Blueprint template | 1fc4b5e | templates/showcase/blueprint.html |
| 6 | Snapshot generator | b6af298 | scripts/generate-snapshot.cjs |

## Self-Check: PASSED

- [x] templates/showcase/overview.html - FOUND
- [x] templates/showcase/library.html - FOUND
- [x] templates/showcase/narrative.html - FOUND
- [x] templates/showcase/synthesis.html - FOUND
- [x] templates/showcase/blueprint.html - FOUND
- [x] scripts/generate-snapshot.cjs - FOUND (modified)
- [x] Commit a40b3bf (Overview) - FOUND
- [x] Commit 235d835 (Library) - FOUND
- [x] Commit 367c6c7 (Narrative) - FOUND
- [x] Commit 6ce0933 (Synthesis) - FOUND
- [x] Commit 1fc4b5e (Blueprint) - FOUND
- [x] Commit b6af298 (Generator) - FOUND
