---
phase: 20-brain-api-control
plan: 01
subsystem: database, auth, infra
tags: [supabase, sql, rpc, api-keys, neo4j, render]

requires:
  - phase: 12-brain-hosting-room-collaboration
    provides: Brain MCP server with auth.cjs, neo4j-tools.cjs, render.yaml
provides:
  - Supabase SQL migration for brain_api_keys and brain_access_requests tables
  - validate_brain_key RPC function matching auth.cjs contract
  - Plan-gated brain_write (admin-only)
  - Supabase env var declarations in render.yaml
  - Lawrence permanent admin seed key
affects: [20-02, brain-api-control, auth, brain-server]

tech-stack:
  added: [supabase-rpc, plpgsql]
  patterns: [plan-gated-tools, closure-based-options-passing]

key-files:
  created:
    - mcp-server-brain/sql/01-brain-api-keys.sql
  modified:
    - mcp-server-brain/lib/neo4j-tools.cjs
    - mcp-server-brain/server.cjs
    - mcp-server-brain/render.yaml

key-decisions:
  - "Plan guard uses closure capture from options parameter, not req object (avoids scope issue)"
  - "SUPABASE_URL committed as inline value (public endpoint), SUPABASE_SERVICE_KEY uses sync: false"
  - "Lawrence seed uses ON CONFLICT DO NOTHING for idempotent reruns"

patterns-established:
  - "Plan-gated MCP tools: registerXTools(server, { plan }) with closure-based access control"
  - "SQL migration files in mcp-server-brain/sql/ directory for Supabase SQL Editor execution"

requirements-completed: [BRAIN-03, BRAIN-04, BRAIN-06]

duration: 1min
completed: 2026-03-26
---

# Phase 20 Plan 01: Brain API Control Summary

**Supabase SQL migration with validate_brain_key RPC, plan-gated brain_write admin guard, and Render env var declarations**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-26T09:59:46Z
- **Completed:** 2026-03-26T10:01:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Created complete SQL migration with brain_api_keys table, validate_brain_key RPC, and brain_access_requests table
- Added plan-based access control to brain_write tool (admin-only, exact D-08 error message)
- Declared Supabase env vars in render.yaml without exposing secrets

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Supabase SQL migration file** - `89564b2` (feat)
2. **Task 2: Add brain_write plan guard and pass plan context** - `5e89e3e` (feat)
3. **Task 3: Update render.yaml with Supabase env var declarations** - `9813ca0` (chore)

## Files Created/Modified
- `mcp-server-brain/sql/01-brain-api-keys.sql` - DDL for brain_api_keys + brain_access_requests, validate_brain_key RPC, Lawrence seed
- `mcp-server-brain/lib/neo4j-tools.cjs` - Plan-gated brain_write with admin check via options closure
- `mcp-server-brain/server.cjs` - Passes req.brainPlan to registerNeo4jTools
- `mcp-server-brain/render.yaml` - SUPABASE_URL and SUPABASE_SERVICE_KEY env var declarations

## Decisions Made
- Plan guard uses closure capture from options parameter, not req object (avoids scope issue in tool handlers)
- SUPABASE_URL committed as inline value (public endpoint safe to commit), SUPABASE_SERVICE_KEY uses sync: false
- Lawrence seed uses ON CONFLICT DO NOTHING for idempotent SQL reruns

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## Next Phase Readiness
- SQL migration ready to run in Supabase SQL Editor
- auth.cjs already calls validate_brain_key RPC -- this SQL creates the function it expects
- Plan 20-02 can proceed with auth.cjs Supabase migration and access request endpoint

## Self-Check: PASSED

All files exist. All 3 commits verified (89564b2, 5e89e3e, 9813ca0).

---
*Phase: 20-brain-api-control*
*Completed: 2026-03-26*
