---
phase: 51
plan: 1
subsystem: snapshot-hub
tags: [export, static-html, responsive, offline, signature]
dependency_graph:
  requires: [phase-49-showcase-views, phase-50-chat]
  provides: [snapshot-command, shared-css, signature-footer, manifest-json]
  affects: [room-exports, presentation-system]
tech_stack:
  added: [shared.css, shared.js, signature-footer.html]
  patterns: [mobile-first-responsive, co-located-html, cdn-with-offline-fallback]
key_files:
  created:
    - commands/snapshot.md
    - templates/shared.css
    - templates/signature-footer.html
  modified:
    - scripts/generate-snapshot.cjs
decisions:
  - Extract shared.css as linked file rather than inline for co-located views
  - Use mobile-first breakpoints (375/768/1024/1440) not desktop-down
  - Inline CDN deps via Node.js child_process for --offline mode
  - manifest.json v2 schema with full Room metrics and spectral summary
metrics:
  duration: ~15min
  completed: 2026-03-31
  tasks: 4/4
  files: 4
requirements: [SNAP-01, SNAP-02, SNAP-03, SNAP-04, POLISH-01, POLISH-02, POLISH-03, POLISH-04]
---

# Phase 51: SnapshotHub Export + Polish Summary

SnapshotHub freezes any RoomHub into 7 co-located static HTML views with shared De Stijl CSS, responsive 375-1440px, offline mode, and MindrianOS signature footer.

## Commits

| # | Hash | Message | Files |
|---|------|---------|-------|
| 1 | b44817d | feat(51): add /mos:snapshot command definition | commands/snapshot.md |
| 2 | 88cb875 | feat(51): add shared.css with De Stijl tokens and mobile-first breakpoints | templates/shared.css |
| 3 | 7733304 | feat(51): add signature footer template with Mondrian color bar | templates/signature-footer.html |
| 4 | 95e9bf6 | feat(51): rewrite generate-snapshot.cjs for full 7-view SnapshotHub | scripts/generate-snapshot.cjs |

## What Was Built

### 1. /mos:snapshot Command (commands/snapshot.md)
- Defines the user-facing command with --offline and --open flags
- Documents tri-polar behavior (CLI/Desktop/Cowork)
- Maps all 8 requirements (SNAP-01..04, POLISH-01..04)

### 2. Shared De Stijl Stylesheet (templates/shared.css)
- Design tokens: Mondrian palette, typography (Bebas Neue, Inter, JetBrains Mono)
- Mobile-first responsive: 375px base, 768px tablet, 1024px desktop, 1440px wide
- Components: header nav, stats bar, card grid, version sidebar, signature footer
- Zero border-radius mandate, reduced-motion support

### 3. Signature Footer (templates/signature-footer.html)
- "Built with MindrianOS" + mindrian.ai link
- 5-block Mondrian color bar (red, blue, yellow, cream, black)
- MindrianOS logo SVG
- Embeddable template with date/stats placeholders

### 4. SnapshotHub Generator (scripts/generate-snapshot.cjs)
Complete rewrite generating 7 co-located HTML views:
- **index.html** (Overview): Stats bar, section cards with thesis, version history sidebar
- **library.html**: 3-panel entry browser with sidebar nav, search, section filtering
- **narrative.html**: Fullscreen deck slides with keyboard navigation
- **synthesis.html**: Section completeness bars, thread breakdown, spectral summary
- **blueprint.html**: Mermaid.js room architecture diagram
- **constellation.html**: Cytoscape.js knowledge graph with 12 thread type filters
- **chat.html**: BYOAPI Fabric chat with Claude API, localStorage key storage

Plus: shared.css, shared.js (nav highlighting, keyboard shortcuts), manifest.json (v2 schema)

## Verification

Tested against demo-cancer-room: generated 10 files to room/exports/2026-04-01-1455/
- Room correctly detected as "research" type
- 8 entries, 39 threads, 8 sections
- manifest.json contains all metrics and section completeness
- All 7 views include signature footer with Mondrian bar

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Shared CSS as linked file**: Co-located views link to shared.css rather than embedding it inline, reducing total export size and enabling browser caching
2. **Mobile-first breakpoints**: 375px base with min-width queries at 768/1024/1440, matching modern best practices
3. **Offline inlining via child_process**: The --offline flag uses Node.js execSync to fetch CDN scripts at build time, avoiding any runtime dependency on npm packages
4. **Manifest v2 schema**: Added room_type, spectral summary, section_completeness, and thread_counts beyond the original v1 schema

## Known Stubs

None -- all views are fully functional with real Room data.

## Self-Check: PASSED

- [x] commands/snapshot.md -- FOUND
- [x] templates/shared.css -- FOUND
- [x] templates/signature-footer.html -- FOUND
- [x] scripts/generate-snapshot.cjs -- FOUND
- [x] Commit b44817d -- FOUND
- [x] Commit 88cb875 -- FOUND
- [x] Commit 7733304 -- FOUND
- [x] Commit 95e9bf6 -- FOUND
- [x] Test run against demo-cancer-room: 10 files generated successfully
