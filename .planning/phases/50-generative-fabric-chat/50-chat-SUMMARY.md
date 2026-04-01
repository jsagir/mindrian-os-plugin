---
phase: 50
plan: chat
subsystem: fabric-chat
tags: [chat, nl-to-cypher, byoapi, constellation, fabric]
dependency_graph:
  requires: [phase-48-constellation, phase-49-showcase-views]
  provides: [VIEW-07, CHAT-01, CHAT-02, CHAT-03, CHAT-04]
  affects: [generate-snapshot.cjs, constellation-view]
tech_stack:
  added: [anthropic-messages-api-browser, sse-streaming]
  patterns: [byoapi, nl-to-cypher, postMessage-injection, cjs-browser-dual]
key_files:
  created:
    - lib/chat/fabric-chat.cjs
    - templates/chat-panel.html
    - scripts/generate-chat-embed.cjs
    - templates/constellation-chat-hooks.js
  modified:
    - scripts/generate-snapshot.cjs
decisions:
  - Used Haiku model for NL-to-Cypher translation (fast, cheap, sufficient for query generation)
  - Separate localStorage key (mos-fabric-api-key) from existing chat panel to avoid conflicts
  - Created constellation-chat-hooks.js as standalone script since constellation.html template does not exist yet (Phase 48)
  - Chat panel uses SSE streaming with Claude Sonnet for conversation responses
metrics:
  duration: ~15min
  completed: 2026-03-31
---

# Phase 50: Generative Fabric Chat Summary

NL-to-Cypher chat panel docked in all Showcase views, querying the Room's Fabric (KuzuDB) via BYOAPI with Constellation click injection.

## What Was Built

### 1. Fabric Chat NL-to-Cypher Module (`lib/chat/fabric-chat.cjs`)
- `nlToCypher(question, apiKey, options)`: translates natural language to KuzuDB Cypher via Anthropic Messages API
- `executeAndFormat(cypher, conn)`: runs query against KuzuDB, formats results as markdown table
- `injectContext(nodeId, nodeType, label)`: builds context question from Constellation click events
- `GRAPH_SCHEMA`: complete schema with all 12 Thread types, node properties, and 6 sample queries
- `buildSchemaDescription(schema)`: generates LLM-readable schema for NL-to-Cypher system prompt
- Dual environment: Node.js CJS module + browser global (`window.FabricChat`)

### 2. Embeddable Fabric Chat Panel (`templates/chat-panel.html`)
- Self-contained HTML component with inline CSS and JS
- Docked bottom-right, expandable/collapsible toggle button
- Settings gear icon opens overlay modal for API key management
- Key stored in `localStorage` under `mos-fabric-api-key` -- never transmitted to MindrianOS
- "Connect API key to enable Fabric Chat" CTA when no key configured
- Messages display: user question, collapsible Cypher query block, markdown-formatted answer
- SSE streaming of Claude Sonnet responses with incremental rendering
- Receives `window.postMessage({ type: 'chat-inject' })` events from Constellation
- De Stijl dark theme, zero border-radius, Mondrian accent colors

### 3. Chat Embed Generator (`scripts/generate-chat-embed.cjs`)
- `buildRoomSchema(roomDir)`: scans room directory for sections and entry counts, enriches base schema
- `generateChatEmbed(roomDir)`: produces complete chat HTML with room-specific schema injected
- `generateChatSnippet(roomDir)`: minimal snippet for embedding in any view
- CLI mode: `node scripts/generate-chat-embed.cjs [ROOM_PATH]`

### 4. Constellation Click-to-Chat Hooks (`templates/constellation-chat-hooks.js`)
- `ConstellationChatHooks.attach(cy)`: binds Cytoscape node/edge tap events
- Node clicks: send `postMessage` with `nodeId`, `label`, `nodeType` (Artifact or Section)
- Edge clicks: inject Thread context (type + source/target labels)
- Ready for Phase 48 Constellation view to include

### 5. Snapshot Generator Integration (`scripts/generate-snapshot.cjs`)
- Imports `generateChatSnippet` with graceful fallback if module unavailable
- Generates room-specific chat snippet during `scanRoom()`
- Injects chat panel HTML before closing `</body>` tag in all exported views
- Chat panel degrades silently if generation fails

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Constellation template does not exist yet**
- **Found during:** Task 3 (Update constellation.html)
- **Issue:** `templates/constellation.html` is Phase 48 work and does not exist yet
- **Fix:** Created `templates/constellation-chat-hooks.js` as a standalone script that Phase 48 can include. The hooks are decoupled from the template itself.
- **Files created:** `templates/constellation-chat-hooks.js`
- **Commit:** `4193ff9`

## Requirement Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| VIEW-07 | Complete | Chat panel docked bottom-right in all views via generate-snapshot.cjs |
| CHAT-01 | Complete | NL-to-Cypher via fabric-chat.cjs, schema includes all 12 Thread types |
| CHAT-02 | Complete | Constellation clicks inject context via postMessage + constellation-chat-hooks.js |
| CHAT-03 | Complete | BYOAPI with localStorage key, settings modal, CTA when no key |
| CHAT-04 | Complete | Chat embedded in all 7 views via generate-snapshot.cjs integration |

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `3add710` | feat(50-chat): add Fabric Chat NL-to-Cypher translation module |
| 2 | `af99564` | feat(50-chat): add embeddable Fabric Chat panel HTML component |
| 3 | `77d226c` | feat(50-chat): add chat embed generator with room-specific schema |
| 4 | `c4b5874` | feat(50-chat): embed Fabric Chat panel in all snapshot views |
| 5 | `4193ff9` | feat(50-chat): add Constellation click-to-chat injection hooks |

## Known Stubs

None. All components are fully wired:
- NL-to-Cypher calls Anthropic API directly from browser
- Chat panel receives and handles postMessage injection events
- generate-snapshot.cjs embeds chat in all exported views
- Constellation hooks ready for Phase 48 to attach

## Self-Check: PASSED

- FOUND: lib/chat/fabric-chat.cjs
- FOUND: templates/chat-panel.html
- FOUND: scripts/generate-chat-embed.cjs
- FOUND: templates/constellation-chat-hooks.js
- FOUND: scripts/generate-snapshot.cjs (modified)
- FOUND: commit 3add710
- FOUND: commit af99564
- FOUND: commit 77d226c
- FOUND: commit c4b5874
- FOUND: commit 4193ff9
