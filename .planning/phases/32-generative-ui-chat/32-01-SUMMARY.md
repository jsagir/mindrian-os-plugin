---
phase: 32-generative-ui-chat
plan: 01
subsystem: ui
tags: [chat, anthropic-api, byoapi, streaming, sse, vanilla-js, de-stijl, localStorage]

requires:
  - phase: 30-canvas-graph-renderer
    provides: CanvasGraph with highlightCluster API
provides:
  - BYOAPI chat panel with streaming Anthropic API calls
  - Room context builder assembling system prompt from ROOM_DATA
  - Tool call bridge for graph.highlightCluster
  - Chat injection points in graph.html template
affects: [32-02-generative-tools, 33-vercel-deploy]

tech-stack:
  added: []
  patterns: [BYOAPI browser-to-API direct calls, SSE stream parsing, localStorage key management]

key-files:
  created:
    - lib/chat/chat-context.js
    - lib/chat/chat-panel.js
  modified:
    - templates/presentation/graph.html
    - scripts/generate-presentation.cjs

key-decisions:
  - "BYOAPI pattern with anthropic-dangerous-direct-browser-access header for zero-server chat"
  - "Larry voice DNA hardcoded inline rather than fetched to maintain zero-dependency constraint"
  - "Chat panel uses CSS variables from existing De Stijl theme for consistent styling"

patterns-established:
  - "BYOAPI: visitor provides API key stored in localStorage, direct browser-to-Anthropic calls"
  - "Chat context builder pattern: buildRoomContext + buildSystemPrompt as reusable pipeline"
  - "Tool call bridge: window.__mosChatPanel and window.__mosGraph exposed for generative tools"

requirements-completed: [GENUI-03]

duration: 5min
completed: 2026-03-31
---

# Phase 32 Plan 01: BYOAPI Chat Panel Summary

**Streaming BYOAPI chat panel with Larry voice DNA, room-scoped context from ROOM_DATA, and graph tool call bridge**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-31T06:42:00Z
- **Completed:** 2026-03-31T06:47:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Visitors can chat with Larry on deployed graph.html using their own Anthropic API key
- API key persisted in localStorage only, never sent anywhere except Anthropic
- Streaming SSE responses with inline markdown rendering (bold, italic, code, lists)
- Room context (name, stage, MINTO governing thought, sections, graph stats) injected into system prompt
- Tool call bridge wired to graph.highlightCluster for Plan 32-02

## Task Commits

Each task was committed atomically:

1. **Task 1: Chat context builder + chat panel module** - `eee83de` (feat)
2. **Task 2: Wire chat panel into graph.html template + generator** - `fc7e301` (feat)

## Files Created/Modified
- `lib/chat/chat-context.js` - Room context builder: buildRoomContext + buildSystemPrompt with Larry voice DNA
- `lib/chat/chat-panel.js` - Embeddable vanilla JS chat panel: BYOAPI key management, collapsible UI, SSE streaming, markdown
- `templates/presentation/graph.html` - Added CHAT_CONTEXT_JS and CHAT_PANEL_JS injection points + chat init IIFE
- `scripts/generate-presentation.cjs` - Generator reads and inlines both chat JS files, adds state/currentView to ROOM_DATA

## Decisions Made
- Used anthropic-dangerous-direct-browser-access header for zero-server browser-to-API calls
- Hardcoded Larry voice DNA excerpt inline in chat-context.js (no external fetch) to keep zero dependencies
- Chat panel styled with CSS variables from De Stijl theme (--mondrian-yellow, --bg-card, etc.)
- Conversation history capped at 20 messages to stay within token limits
- Default model set to claude-sonnet-4-20250514 (configurable via options.model)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Generator file at scripts/ not lib/presentation/**
- **Found during:** Task 2
- **Issue:** Plan referenced lib/presentation/generate-presentation.cjs but file is at scripts/generate-presentation.cjs
- **Fix:** Updated scripts/generate-presentation.cjs instead
- **Files modified:** scripts/generate-presentation.cjs
- **Verification:** grep confirms chat-panel and chat-context references present (3 matches)
- **Committed in:** fc7e301

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Path correction only, no scope change.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all functionality is fully wired. Chat panel makes real API calls when visitor provides their key.

## Next Phase Readiness
- Chat panel exposed via window.__mosChatPanel for Plan 32-02 generative tools
- Graph exposed via window.__mosGraph for highlightCluster tool calls
- Tool call bridge (onToolCall callback) ready for Plan 32-02 to wire AI-invoked tools

---
*Phase: 32-generative-ui-chat*
*Completed: 2026-03-31*
