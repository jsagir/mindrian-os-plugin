---
phase: 52-mcp-foundation
plan: 03
subsystem: mcp
tags: [mcp, brain-router, framework-routing, 3-tier-fallback, brain-api, cache]

# Dependency graph
requires:
  - phase: 52-mcp-foundation/02
    provides: 9 hierarchical MCP routers with orchestration router for act* commands
provides:
  - brain-router.cjs module with recommend() and validateChain() exports
  - 3-tier fallback routing: cache (10-min TTL) -> local heuristic -> Brain API (2s timeout)
  - Orchestration router (7th) with act, act-chain, act-dry-run commands
  - Brain-informed suggest-next in data_room router
affects: [53-surface-detection, 54-token-hook, 57-agent-dispatch]

# Tech tracking
tech-stack:
  added: []
  patterns: [3-tier-fallback, djb2-cache-key, promise-race-timeout, problem-type-matrix-routing]

key-files:
  created:
    - lib/mcp/brain-router.cjs
  modified:
    - lib/mcp/tool-router.cjs

key-decisions:
  - "brain-router RECOMMENDS only, never executes -- orchestration router returns chain for Claude to orchestrate"
  - "Local heuristic parses problem-types.md 2D matrix (definition x complexity) for offline Tier 2 routing"
  - "djb2 string hash for cache keys -- fast non-crypto hash sufficient for TTL cache"
  - "Orchestration router added as 7th router in worktree -- will merge with 52-02 9-router restructure"

patterns-established:
  - "3-tier fallback: cache -> local heuristic -> Brain API with hard timeout"
  - "Promise.race with 2s timeout for Brain API calls -- never blocks on cold starts"
  - "problem-type extraction from STATE.md frontmatter with venture_stage inference"

requirements-completed: [MCP-04]

# Metrics
duration: 3min
completed: 2026-04-05
---

# Phase 52 Plan 03: Brain-Driven Routing Summary

**3-tier Brain routing module (cache/local/API) with orchestration router for act*/suggest-next commands**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-05T19:34:09Z
- **Completed:** 2026-04-05T19:36:47Z
- **Tasks:** 2
- **Files created:** 1
- **Files modified:** 1

## Accomplishments

- Created brain-router.cjs (294 lines) with 3-tier fallback: in-memory cache with 10-min TTL using djb2 hash keys, local heuristic parsing problem-types.md 2D classification matrix, and Brain API with 2-second hard timeout via Promise.race
- Wired brain-router into data_room router's suggest-next command -- now returns Brain-informed framework recommendations instead of static reference files
- Added orchestration router (7th tool) with act, act-chain, and act-dry-run commands -- all call brain-router.recommend() and return framework chains for Claude to orchestrate
- Local heuristic extracts problem type from STATE.md frontmatter (definition_level, complexity, venture_stage inference) and maps to routing table
- Brain unavailable returns local fallback within milliseconds -- no blocking on cold starts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create brain-router.cjs with 3-tier fallback** - `96c840b` (feat)
2. **Task 2: Wire brain-router into orchestration router and validate end-to-end** - `de05550` (feat)

## Files Created/Modified

- `lib/mcp/brain-router.cjs` - 3-tier Brain routing module (294 lines): cache, local heuristic, Brain API with timeout
- `lib/mcp/tool-router.cjs` - suggest-next uses brain-router, new orchestration router for act/act-chain/act-dry-run

## Decisions Made

1. **brain-router RECOMMENDS only** -- returns chain array and confidence, never executes frameworks. Orchestration is Claude's job.
2. **Local heuristic uses problem-types.md** -- the existing 2D classification matrix (definition level x complexity) provides offline Tier 2 routing without any external calls.
3. **djb2 hash for cache keys** -- fast non-crypto hash of STATE.md content, sufficient for 10-minute TTL cache invalidation.
4. **Orchestration router added as 7th** -- the 52-02 worktree has 9 routers; this adds brain-router wiring that will merge cleanly since the orchestration router is additive.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree has 6-router version, plan expects 9-router version from 52-02**
- **Found during:** Task 2
- **Issue:** The 52-02 plan executed in a different worktree, so this worktree still has the 6-router tool-router.cjs (623 lines) instead of the 9-router version (849 lines).
- **Fix:** Added orchestration router as a new 7th router section in the existing 6-router file, and wired brain-router into the existing data_room suggest-next. Both changes are additive and will merge cleanly with 52-02's 9-router restructure.
- **Files modified:** lib/mcp/tool-router.cjs
- **Commit:** de05550

## Verification Results

1. `node -e "require('./lib/mcp/brain-router.cjs')"` -- module loads: PASS
2. `node -e "require('./lib/mcp/brain-router.cjs').recommend('/tmp', {}).then(r => console.log(r.source, r.chain))"` -- returns `local ['explore-trends', 'scenario-plan']`: PASS
3. `grep -c 'brain-router' lib/mcp/tool-router.cjs` -- 2 references (suggest-next + orchestration): PASS
4. `timeout 3 node bin/mindrian-mcp-server.cjs` -- server starts cleanly: PASS
5. Brain unavailable returns local fallback instantly: PASS

## Known Stubs

None -- all data paths are wired. Local heuristic provides real routing from problem-types.md. Brain enrichment activates when MINDRIAN_BRAIN_KEY is set.

## Self-Check: PASSED
