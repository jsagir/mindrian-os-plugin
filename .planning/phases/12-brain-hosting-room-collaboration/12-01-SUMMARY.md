---
phase: 12-brain-hosting-room-collaboration
plan: 01
subsystem: infra
tags: [mcp, express, neo4j, pinecone, api-key-auth, streamable-http]

requires:
  - phase: 11-mcp-server
    provides: MCP SDK patterns (server.tool API, zod schemas)
provides:
  - Standalone Brain MCP server (mcp-server-brain/) with 5 tools
  - API key auth middleware for paid-tier gating
  - Health endpoint for uptime monitoring
  - Local smoke test suite (13 assertions, no external deps)
affects: [12-02-render-deploy, 12-03-room-collaboration]

tech-stack:
  added: [express@4.21, neo4j-driver@5.28, "@pinecone-database/pinecone@5.1", "@modelcontextprotocol/sdk@1.27.1"]
  patterns: [stateless-streamable-http, per-request-mcp-server, singleton-driver, bearer-api-key-auth]

key-files:
  created:
    - mcp-server-brain/package.json
    - mcp-server-brain/server.cjs
    - mcp-server-brain/lib/auth.cjs
    - mcp-server-brain/lib/neo4j-tools.cjs
    - mcp-server-brain/lib/pinecone-tools.cjs
    - mcp-server-brain/test-brain.cjs
  modified:
    - .gitignore

key-decisions:
  - "Stateless MCP: new McpServer per request (no session state, Render-friendly)"
  - "db.labels() fallback instead of apoc.meta.schema() for Aura free tier"
  - "SSE response parsing in test client for StreamableHTTPServerTransport output"
  - "searchRecords with integrated inference error detection and clear fallback message"

patterns-established:
  - "Stateless StreamableHTTP: create McpServer + transport per POST /mcp request"
  - "Singleton driver: neo4j.driver() and Pinecone() created once, reused across requests"
  - "Bearer auth middleware: BRAIN_API_KEYS comma-separated env var"

requirements-completed: [BRAIN-01, BRAIN-03]

duration: 3min
completed: 2026-03-24
---

# Phase 12 Plan 01: Brain MCP Server Summary

**Standalone Express + StreamableHTTP MCP server wrapping Neo4j (3 tools) and Pinecone (2 tools) behind API key auth, with 13-assertion smoke test**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T22:50:30Z
- **Completed:** 2026-03-24T22:53:27Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Complete mcp-server-brain/ standalone Node.js project with 5 dependencies
- 5 MCP tools: brain_schema, brain_query, brain_write, brain_search, brain_stats
- API key validation middleware gating all /mcp requests
- Health endpoint at GET /health for uptime monitoring
- Local smoke test (13 assertions) covering health, auth rejection, MCP initialize, and tools/list

## Task Commits

Each task was committed atomically:

1. **Task 1: Create mcp-server-brain package and server skeleton with auth** - `b7c7f87` (feat)
2. **Task 2: Register Neo4j and Pinecone tools, create local smoke test** - `bd60a0a` (feat)

## Files Created/Modified
- `mcp-server-brain/package.json` - Standalone npm project with 5 dependencies
- `mcp-server-brain/server.cjs` - Express + StreamableHTTPServerTransport entry point
- `mcp-server-brain/lib/auth.cjs` - API key validation middleware (validateApiKey)
- `mcp-server-brain/lib/neo4j-tools.cjs` - 3 Neo4j tools (schema, query, write)
- `mcp-server-brain/lib/pinecone-tools.cjs` - 2 Pinecone tools (search, stats)
- `mcp-server-brain/test-brain.cjs` - 13-assertion smoke test suite
- `.gitignore` - Added mcp-server-brain/node_modules and package-lock.json exclusions

## Decisions Made
- Stateless MCP: new McpServer instance per request avoids session state and memory pressure on Render free tier
- Used db.labels() + db.relationshipTypes() + db.propertyKeys() instead of apoc.meta.schema() to avoid Aura free tier incompatibility
- SSE response parsing needed in test client because StreamableHTTPServerTransport returns text/event-stream format
- brain_search uses searchRecords (integrated inference) with clear error message fallback if index uses external embeddings

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Accept header required for MCP requests**
- **Found during:** Task 2 (smoke test)
- **Issue:** StreamableHTTPServerTransport returns 406 if client doesn't send `Accept: application/json, text/event-stream`
- **Fix:** Added Accept header to test requests and SSE response parsing in the test client
- **Files modified:** mcp-server-brain/test-brain.cjs
- **Verification:** All 13 assertions pass
- **Committed in:** bd60a0a (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for smoke test to work with StreamableHTTP transport. No scope creep.

## Issues Encountered
None beyond the Accept header deviation documented above.

## User Setup Required
None - no external service configuration required. Server uses env vars at deploy time.

## Next Phase Readiness
- Brain MCP server is ready for Render deployment (Plan 02)
- All 5 tools registered and locally validated
- API key auth working — keys will be generated at deploy time
- Pinecone integrated inference vs external embedding will be validated at deploy time (Open Question 1 from research)

---
*Phase: 12-brain-hosting-room-collaboration*
*Completed: 2026-03-24*
