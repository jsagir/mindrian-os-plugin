---
phase: 54-token-hook-optimization
plan: 02
subsystem: intelligence-cascade, bridge-files, brain-router
tags: [optimization, debounce, batching, caching, bridge-migration]
dependency_graph:
  requires: [52-01, 52-03]
  provides: [HOOK-01, HOOK-02, HOOK-03, HOOK-04, HOOK-05]
  affects: [scripts/session-start, scripts/context-monitor, scripts/track-analytics, scripts/pre-compact, scripts/post-compact]
tech_stack:
  added: []
  patterns: [djb2-hash, debounce-map, batch-queue, per-room-isolation]
key_files:
  created: []
  modified:
    - lib/core/intelligence-cascade.cjs
    - lib/mcp/brain-router.cjs
    - scripts/context-monitor
    - scripts/session-start
    - scripts/track-analytics
    - scripts/pre-compact
    - scripts/post-compact
decisions:
  - "djb2 hash for STATE.md content comparison (fast, non-crypto, sufficient for cache keys)"
  - "500ms batch window balances latency vs batching efficiency"
  - "Bridge file hash uses md5 (Node crypto + bash md5sum + Python hashlib) for cross-language consistency"
  - "Periodic cache eviction every 100 calls instead of every call (reduces iteration overhead)"
metrics:
  duration_seconds: 192
  completed: "2026-04-05T20:40:10Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 7
---

# Phase 54 Plan 02: Hook Optimization Summary

HSI debounce with 30s per-room deduplication, 500ms write batching via queueCascade, STATE.md hash cache with 5-min TTL, bridge files migrated to per-room ~/.mindrian/bridge/{hash}.json, and brain-router cache confirmed with periodic eviction.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Add debounce, batch queue, and analyze-room cache | 1a7f120 | intelligence-cascade.cjs: HSI debounce (30s), queueCascade (500ms batch), getCachedAnalysis (5-min TTL) |
| 2 | Migrate bridge files + framework cache | 2565606 | 5 scripts migrated from /tmp/mindrian-* to ~/.mindrian/bridge/, brain-router periodic eviction |

## Implementation Details

### HSI Debounce (HOOK-01)
- Module-level `lastHsiByRoom` Map tracks last HSI timestamp per room directory
- 30-second window: if same room triggered within 30s, steps 3-5 return `{status: 'debounced'}`
- Timestamp recorded after successful HSI computation only

### Analyze-Room Cache (HOOK-02)
- `analyzeRoomCache` Map keyed by roomDir, stores djb2 hash of STATE.md content
- 5-minute TTL: if STATE.md unchanged within window, returns cached result
- `getCachedAnalysis()` exported for callers (session-start, analyze-room)
- `invalidateAnalysisCache()` called after every cascade run (room state may have changed)
- `setAnalysisCache()` exported for callers to store fresh results

### Write Batching (HOOK-03)
- `batchQueues` Map per roomDir with 500ms debounce timer
- `queueCascade()` collects file paths and returns Promise
- When timer fires: classify + graph-index run per-file, HSI runs once for batch
- All queued Promises resolve with combined result object
- Existing `runCascade` unchanged for single-file direct calls

### Bridge File Per-Room (HOOK-04)
- All 5 scripts migrated from `/tmp/mindrian-*` to `~/.mindrian/bridge/`
- Room-specific files use md5 hash of room path (first 8 hex chars)
- Cross-language consistency: Node crypto, bash md5sum, Python hashlib
- update-check cache also migrated to `~/.mindrian/bridge/update-check.json`
- pre-compact/post-compact share `~/.mindrian/bridge/pre-compact-state.json`

### Framework Recommendation Cache (HOOK-05)
- brain-router.cjs already had correct 3-tier flow: cache -> local -> Brain
- Cache key: roomDir + djb2 hash of STATE.md content (buildCacheKey at line 47)
- 10-min TTL enforced in getFromCache() (line 61)
- Added: `cacheHits` counter for monitoring
- Changed: periodic eviction every 100 recommend() calls instead of every call
- CACHE_EVICT = 20 min (2x TTL) already existed, now gated by call counter

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- `grep -rn "/tmp/mindrian" scripts/ lib/` returns zero matches
- `node -e "require('./lib/core/intelligence-cascade.cjs')"` exports: runCascade, queueCascade, getCachedAnalysis, setAnalysisCache, invalidateAnalysisCache
- `~/.mindrian/bridge/` directory is creatable and valid
- brain-router.cjs cache check runs at Tier 1, before any heuristic or API call

## Self-Check: PASSED

All 7 modified files exist. Both commit hashes (1a7f120, 2565606) verified in git log.
