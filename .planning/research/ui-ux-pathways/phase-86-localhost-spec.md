---
type: phase-spec
phase: 86
name: localhost-dashboard-live
status: ready-to-plan
estimated_effort: 2-3 days
depends_on: v1.10.9 (node:sqlite), v1.10.0 (wikilinks), v1.10.8 (room.db)
source: Session 2026-04-16 discussion
---

# Phase 86: Localhost Live Dashboard

## Goal

Ship `/mos:dashboard live` -- a single command that opens a browser tab at localhost:3131 showing the active room's knowledge graph, wiki, intelligence alerts, and section navigator, live-updating as Claude Code writes new artifacts, with zero ongoing token cost.

## What ships

### scripts/serve-dashboard (new, ~150 lines)

Node HTTP server using only built-in modules (http, fs, path, node:sqlite):

1. Reads active room from `.rooms/registry.json`
2. Calls `generate-presentation.cjs` ONCE to build the initial HTML payload
3. Starts `http.createServer` on port 3131 (configurable via `--port`)
4. Serves: dashboard HTML, shared.css, graph.json, section data
5. Opens browser automatically: `open` (macOS), `xdg-open` (Linux), `start` (Windows)
6. Watches room directory with `fs.watch` (recursive)
7. On file change: reads the changed file, computes the delta, pushes SSE event
8. Reads room.db directly via `node:sqlite` for graph edges (INFORMS, CONTRADICTS, CONVERGES, etc.)
9. Graceful shutdown on SIGINT/SIGTERM

### Graph from SQLite (replaces filesystem scan)

Current `generate-presentation.cjs` builds graph.json by scanning room/*.md frontmatter. Phase 86 adds a SECOND path: read directly from room.db LazyGraph tables. SQLite path is faster, richer (has edge types, confidence, timestamps), and already populated by the intelligence cascade.

```sql
SELECT * FROM artifacts ORDER BY created DESC;
SELECT * FROM edges WHERE type IN ('INFORMS','CONTRADICTS','CONVERGES','INVALIDATES');
SELECT * FROM stakeholders;
```

Cytoscape.js renders with Mondrian colors per edge type:
- INFORMS: blue (#1E3A6E)
- CONTRADICTS: red (#A63D2F)
- CONVERGES: green (#2D6B4A)
- INVALIDATES: yellow/sienna (#B5602A)

### Wikilinks as navigation

Regex pass on artifact HTML content:
```
/\[\[([^\]]+)\]\]/g → <a href="#$1" class="wikilink" data-target="$1">$1</a>
```

Click handler in the browser navigates the wiki panel to the target artifact and highlights the corresponding node in the graph. Bidirectional: clicking a graph node also opens the artifact in the wiki panel.

### SSE live-reload

Server sends `text/event-stream` on `/events` endpoint:
```
event: artifact-changed
data: {"section":"market-analysis","file":"jtbd-merck-deal-flow.md","action":"modified"}

event: edge-added
data: {"from":"artifact-123","to":"artifact-456","type":"CONVERGES","confidence":0.7}

event: intelligence-alert
data: {"type":"convergence","message":"Cap-table formalization converges across 3 sources"}
```

Browser-side JS receives events and patches DOM incrementally. No full page reload.

### De Stijl theme (already exists)

The dashboard uses `templates/shared.css` (the same design system deployed to Vercel for Noga and Lital's decks). No new CSS needed. The theme IS the product.

## What does NOT ship in Phase 86

- Operational buttons (Phase 87)
- Chrome extension (Phase 88+)
- RemoteTrigger integration (when Claude Code API stabilizes)
- Quarto export (Phase 87 or later, separate use case)
- Multi-room portfolio view (v1.12+)
- Authentication / sharing (not needed for localhost)

## Success criteria

1. User runs `/mos:dashboard live` and a browser tab opens at localhost:3131 within 2 seconds
2. The graph shows all room artifacts as nodes with typed edges from room.db
3. Clicking a wikilink in the wiki panel navigates to the target artifact
4. Clicking a graph node opens the artifact in the wiki panel
5. When Larry files a new artifact in the terminal, the browser updates within 1 second (SSE push)
6. Zero tokens consumed for ongoing dashboard rendering
7. Works on macOS, Linux, and Windows (Git Bash)
8. Graceful degradation when room.db is empty or missing (falls back to filesystem scan)

## Estimated plans

1. 86-01: scripts/serve-dashboard core (HTTP + fs.watch + auto-open)
2. 86-02: SQLite graph reader (room.db -> Cytoscape JSON)
3. 86-03: Wikilink resolver + wiki panel navigation
4. 86-04: SSE incremental update pipeline
5. 86-05: Cross-platform testing + /mos:dashboard command wiring + release
