---
phase: "60"
plan: "01"
subsystem: mcp-apps
tags: [mcp-apps, ext-apps, data-room, dashboard, wiki, graph, de-stijl, cytoscape]
dependency_graph:
  requires: [52-01, 53-01]
  provides: [app-views, ui-resources, bidirectional-mcp-apps]
  affects: [capability-registry, mcp-server]
tech_stack:
  added: ["@modelcontextprotocol/ext-apps@^1.5.0"]
  patterns: [registerAppTool, registerAppResource, ui-resource-scheme, postMessage-json-rpc]
key_files:
  created:
    - lib/mcp/app-views.cjs
    - lib/mcp/app-html/dashboard.html
    - lib/mcp/app-html/wiki.html
    - lib/mcp/app-html/graph.html
  modified:
    - lib/mcp/capability-registry.cjs
    - package.json
    - package-lock.json
decisions:
  - "_meta.ui.resourceUri is the ext-apps pattern for linking tools to ui:// resources"
  - "Vanilla JS + inline CSS (no React, no build step) for all MCP App templates"
  - "Cytoscape.js loaded via CDN (only external dependency in graph template)"
  - "Non-fatal error handling: MCP Apps registration failure does not crash server"
  - "scanRoomData is shared across all 3 views (single room scan, 3 renderings)"
metrics:
  duration: "6 minutes"
  completed: "2026-04-05"
  tasks_completed: 5
  tasks_total: 5
  files_created: 4
  files_modified: 3
requirements: [APP-01, APP-02, APP-03, APP-04, APP-05, APP-06]
---

# Phase 60 Plan 01: MCP Apps Data Room Views Summary

ext-apps SDK registered 3 inline MCP App views (dashboard, wiki, graph) with De Stijl styling, Cytoscape.js graph, and bidirectional postMessage communication for on-demand data refresh.

## What Was Built

### 1. ext-apps Installation (APP-01)
Installed `@modelcontextprotocol/ext-apps@^1.5.0`. Peer dependency on SDK ^1.29.0 already satisfied. Exports verified: `registerAppTool`, `registerAppResource`, `RESOURCE_MIME_TYPE`.

### 2. app-views.cjs Module (APP-02, APP-03, APP-04)
Created `lib/mcp/app-views.cjs` with:
- `registerAppViews(server, roomDir)` -- registers 3 tools + 3 ui:// resources
- `scanRoomData(roomDir)` -- scans STATE.md, sections, articles, LazyGraph, KuzuDB export
- Each tool returns room data as JSON; each has a paired HTML template

### 3. HTML Templates (APP-05)
Created `lib/mcp/app-html/` with 3 self-contained files:

| Template | Size | CDN | Features |
|----------|------|-----|----------|
| dashboard.html | 8.9 KB | Fonts only | Mondrian grid, stats row, section cards, accent bar |
| wiki.html | 11.4 KB | Fonts only | Sidebar navigation, article browser, search, section dots |
| graph.html | 12.8 KB | Cytoscape 3.28.1 + Fonts | Interactive graph, thread filters, layout switcher, node info panel |

All use De Stijl design tokens (--ds-bg, --ds-cream, --ds-blue, etc.) matching the existing SnapshotHub templates.

### 4. Capability Registry Wiring (SURF-04 integration)
Modified `capability-registry.cjs` to call `registerAppViews()` when `capabilities.apps === true` (Desktop/Cowork only). CLI users pay zero overhead. Error handling is non-fatal.

### 5. Bidirectional Communication (APP-06)
Each template includes:
- `app.callServerTool()` -- refresh button calls back to MCP tool for fresh data
- `app.updateModelContext()` -- wiki article selection and graph node clicks update conversation context
- `app.ontoolresult` -- receives initial tool result data on load

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed _meta.ui.resourceUri structure**
- **Found during:** Task 2 integration test
- **Issue:** `registerAppTool` expects `_meta: { ui: { resourceUri } }` in the definition object, not `resourceUri` at top level
- **Fix:** Restructured all 3 tool definitions to use correct `_meta.ui.resourceUri` path
- **Files modified:** lib/mcp/app-views.cjs
- **Commit:** 7736369

## Decisions Made

1. **_meta.ui.resourceUri pattern**: ext-apps wraps `server.registerTool()` and expects `_meta.ui.resourceUri` in the tool definition. This is the official linking mechanism between tools and ui:// resources.
2. **Shared scanRoomData**: One function scans the room once and returns data usable by all 3 views. No duplicate scanning.
3. **Vanilla JS everywhere**: No React, no build step. Templates are pure HTML with inline CSS and JS. Only CDN dependency is Cytoscape.js for the graph view.
4. **Non-fatal registration**: If ext-apps fails to register (e.g., SDK version mismatch), the server continues with all other capabilities intact.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | a543e89 | Install ext-apps@^1.5.0 |
| 2 | 371f943 | Create app-views.cjs with 3 tools |
| 3 | 58aa925 | Add 3 HTML templates |
| 4 | 02892fc | Wire into capability-registry |
| 5 (fix) | 7736369 | Fix _meta.ui.resourceUri structure |

## Known Stubs

None. All 3 views render real room data. Templates gracefully handle empty rooms (show "Loading..." then empty grid/list/graph).

## Verification

- All 3 templates contain ext-apps SDK script tag
- All 3 templates implement callServerTool for bidirectional refresh
- capability-registry conditionally registers on Desktop/Cowork only
- scanRoomData handles non-existent rooms without crashing
- McpServer accepts all 3 tool + resource registrations without error

## Self-Check: PASSED

All 4 created files exist. All 5 commits found in git log.
