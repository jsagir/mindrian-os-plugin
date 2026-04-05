---
decision: D20
title: Single-file tabbed hub as default export template
created: 2026-04-05
status: active
source: session-2026-04-05
supersedes: generate-snapshot.cjs multi-file output, generate-presentation.cjs card grid
---

# D20: Single-File Tabbed Hub as Default Export Template

## Decision

The synteris-hub.html format -- single standalone HTML file with tabbed navigation, all content inline, De Stijl header with Mondrian bars -- becomes the DEFAULT template for all room exports and snapshots.

The multi-file SnapshotHub (7 separate HTML files with shared.css/shared.js) and the Presentation hub (card grid landing page) are deprecated as defaults. They remain available via explicit flags if needed.

## Rationale

The synteris-hub.html format was the only export that:
1. Actually impressed a real user (Adam Peters said "I thought it was really funny, I liked reading through it")
2. Works as a single file -- no server needed, no broken links, share via email
3. Has tabbed navigation that scales to many sections
4. Embeds all content inline -- works offline, deploys to Vercel as one file
5. Has the De Stijl identity (Mondrian header bars, Bebas Neue headings)

The SnapshotHub multi-file format has chronic rendering issues (empty dashboards, broken Cytoscape, orphaned JS). The single-file format has zero dependencies.

## Implementation

The default export command (`/mos:export` or `/mos:snapshot`) should produce a single HTML file in the synteris-hub.html format. Tabs should be auto-generated from room sections. Custom sections (product/, ip/, decisions/, beta-testing/, product-evolution/) should map to tabs naturally.

## Reference Template

`/home/jsagi/room-adam/exports/synteris-hub.html` -- the proven format deployed at synteris-full-9g4clcj9w-jsagirs-projects.vercel.app
