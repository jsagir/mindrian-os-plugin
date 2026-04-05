---
wish: Single-file tabbed hub should be the default export for ALL users
observed: 2026-04-05
context: "The multi-file SnapshotHub and card-grid Presentation hub both have rendering issues and feel empty. The synteris-hub.html single-file format with tabs is the only one that actually works and impresses users. This should be the default for everyone, not a custom build."
status: OPEN
priority: critical
decision: D20
---

# W013: Single-File Hub as Default Export Template

## The Problem

MindrianOS has 3 export generators that all produce different formats:
- `generate-snapshot.cjs` -- 7 separate HTML files, shared CSS/JS, card grid landing
- `generate-presentation.cjs` -- 6 view cards, same card grid landing
- `generate-standalone` -- Cytoscape dashboard, broken layout for 30+ nodes

None of them produce the format that actually worked: the synteris-hub.html single-file tabbed format.

## What Needs to Happen

Build a new default generator (`generate-hub.cjs` or replace `generate-snapshot.cjs`) that:
1. Scans room/ recursively (already fixed)
2. Maps sections to tabs dynamically (standard 8 + any custom sections)
3. Renders all article content inline in one HTML file
4. Uses De Stijl template: Mondrian header, Bebas Neue, dark theme
5. Works for ANY user's room, not just MindrianOS's own room
6. Zero external dependencies -- no CDN, no shared.css, everything inline
7. Auto-detects room type and adapts tab names

## Reference

Template: `/home/jsagi/room-adam/exports/synteris-hub.html`
Live: `synteris-full-9g4clcj9w-jsagirs-projects.vercel.app`
Decision: D20
