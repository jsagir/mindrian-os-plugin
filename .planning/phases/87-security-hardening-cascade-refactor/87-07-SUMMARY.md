---
phase: 87-security-hardening-cascade-refactor
plan: 07
subsystem: infra
tags: [lru-cache, session-cache, brain-client, intelligence-cascade, sha256, pending-promise, cascade-06]

# Dependency graph
requires:
  - phase: 87-03
    provides: shared _runCascadeSteps body + owner-aware lastHsiByRoom updates so the 3 cascade Maps sit at stable declaration sites for the LRU swap
  - phase: 87-01
    provides: brain-client.cjs hardened with sanitizeCypherInput + checkFilePermissions, so the Brain session cache layers over known-good init logic
provides:
  - lib/core/lru-cache.cjs hand-rolled LRU class (doubly-linked list + Map) with Map-parity iteration -- reusable across the plugin for any bounded cache
  - brain-client.cjs session reuse within 5-minute TTL windows -- eliminates the wasted init handshake on every callTool()
  - Pending-promise concurrency guard so 10 concurrent callTool() on the same api_key fire exactly ONE init (R-87-07-RACE fix)
  - sha256-truncated cache keys (16 hex chars, 64-bit key space) -- zero realistic collision risk
  - lastHsiByRoom / batchQueues / analyzeRoomCache in intelligence-cascade.cjs bounded at 100 entries, no unbounded memory growth in long-running MCP servers
  - brain-cache-lru.test.cjs with 9 assertion groups covering capacity, promotion, update, iteration parity, sha256 hashing, TTL constant, 10-way concurrent race, TTL expiry, and post-swap load-time smoke
affects: [87-09, 88, 90, 91, future MCP long-running server work, future cache reuse]

# Tech tracking
tech-stack:
  added:
    - node:crypto (for sha256 session-cache keys -- Node builtin, no new runtime dep)
  patterns:
    - "Hand-rolled bounded LRU: doubly-linked list + Map keeps get/set/has/delete O(1) while also enabling O(n) MRU->LRU iteration without promoting on read"
    - "Map-parity iteration on custom cache classes: entries/keys/values/forEach/clear/[Symbol.iterator] = drop-in replacement for `new Map()` at every call site with zero refactoring"
    - "Pending-promise cache: store the in-flight Promise (not just resolved value) so concurrent callers share one await; on rejection purge the entry so the next caller retries fresh"
    - "Zero-runtime-dep cryptographic cache key: crypto.createHash('sha256').update(k).digest('hex').slice(0, 16) gives 64 bits of key space for ~0 cost"

key-files:
  created:
    - lib/core/lru-cache.cjs
    - lib/memory/brain-cache-lru.test.cjs
  modified:
    - lib/core/brain-client.cjs
    - lib/core/intelligence-cascade.cjs
    - lib/memory/run-feynman-tests.cjs

key-decisions:
  - "LRU backed by doubly-linked list + Map (not Map-plus-delete-reinsert) so eviction is O(1) and we can walk iteration MRU->LRU explicitly without relying on Map's internal insertion order after deletions. Hand-rolled ~90 lines, zero runtime deps."
  - "Map-parity iteration on LRU so intelligence-cascade swap is a literal `new Map()` -> `new LRU(100)` edit with zero call-site refactoring. Iteration does NOT promote (reading via iterator is not a `use`) -- otherwise dashboards/debug-dumps would scramble eviction order."
  - "Pending-promise pattern (R-87-07-RACE): install the in-flight init promise in sessionCache BEFORE the first await, so concurrent callers within the same event-loop tick see the same promise. Handles the in-flight + resolved + rejected cases uniformly; reject branch purges the cache entry so the next caller retries."
  - "sha256 truncated to 16 hex chars as cache key. The 64-bit space eliminates collision risk across any realistic user count; performance is negligible at Brain-call cadence."
  - "Opaque session marker `validated-<timestamp>` returned from _ensureSession. The Brain Streamable-HTTP transport is stateless at the HTTP level, so subsequent tools/call requests don't need to echo a sessionId -- what matters is that we validated the key is live within this TTL window."
  - "Cap 100 on all 3 cascade caches. Single users rarely touch 100 distinct rooms in a session; for team MCP servers it bounds worst-case memory. Generous enough not to cause false evictions in normal use."

patterns-established:
  - "Pattern 1: Bounded LRU helper with Map-parity iteration is the canonical tool for any long-running in-memory cache in this codebase (not just for cascade's 3 caches)"
  - "Pattern 2: Promise-as-cache-entry pattern: concurrent callers share one in-flight async operation without extra locks, extra state machines, or a mutex library"
  - "Pattern 3: sha256-truncated cache keys are the cheap default when you care about cross-user collision resistance"

requirements-completed: [CASCADE-06]

# Metrics
duration: 12min
completed: 2026-04-19
---

# Phase 87 Plan 07: Brain session cache + cascade LRU eviction Summary

**Brain re-init handshake eliminated within 5-min TTL windows via pending-promise sessionCache; 3 intelligence-cascade Maps bounded to 100-entry LRUs with zero call-site refactoring due to Map-parity iteration.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-19T19:32:00Z (approx, lru-cache.cjs created)
- **Completed:** 2026-04-19T19:46:00Z
- **Tasks:** 2 (Task 7-1 LRU helper + Task 7-2 session cache + cascade swap + tests)
- **Files modified:** 5 total (2 created, 3 modified)

## Accomplishments

- `lib/core/lru-cache.cjs` (NEW): bounded LRU class with Map-parity iteration — O(1) get/set/has/delete, O(n) iteration MRU->LRU without promotion, invalid-capacity guard at construction, zero runtime deps, 139 lines.
- Brain `callTool()` (brain-client.cjs) now reuses an initialized session for up to 5 minutes per api-key-hash — previously every call wasted one `initialize` round-trip.
- **R-87-07-RACE fixed:** 10 concurrent `_ensureSession()` calls on the same api_key share ONE in-flight init promise (pending-promise pattern). Asserted in `testConcurrentInitRaceGuard` — initCallCount === 1.
- Session-cache keys use sha256 truncated to 16 hex chars (64 bits of key space, zero realistic collision risk).
- `lastHsiByRoom`, `batchQueues`, `analyzeRoomCache` in `intelligence-cascade.cjs` swapped from `new Map()` to `new LRU(100)`. No call-site refactoring was needed because LRU exposes Map-parity iteration (`.entries/.keys/.values/.forEach/.clear/[Symbol.iterator]`) on top of `.get/.set/.has/.delete`.
- `lib/memory/brain-cache-lru.test.cjs` (NEW, 203 lines): 9 assertion groups covering LRU capacity, LRU promotion, LRU update, LRU iteration parity (entries/keys/values/forEach/clear/for-of + forEach thisArg + TypeError on non-function callback), sha256 cache-key hashing, SESSION_TTL_MS constant, 10-way concurrent-race init guard, TTL expiry, intelligence-cascade post-swap load-time smoke.
- Feynman suite now 26/26 (was 25/25). Cascade-e2e baseline preserved exact: `{INFORMS:3, CONTRADICTS:1, CONVERGES:0, INVALIDATES:1}`.

## Task Commits

Each task was committed atomically:

1. **Task 7-1: LRU helper module with Map-parity iteration** — `8f3018c` (feat)
   - `lib/core/lru-cache.cjs` only
2. **Task 7-2a: Brain sessionCache with pending-promise + sha256** — `6f54a7b` (feat)
   - `lib/core/brain-client.cjs` only (session cache, _ensureSession helper, _hashKey, callTool refactor, _test surface)
3. **Task 7-2b: Cascade Map->LRU swap + regression suite** — `b642d11` (feat)
   - `lib/core/intelligence-cascade.cjs` (3 Map -> LRU swaps + require)
   - `lib/memory/brain-cache-lru.test.cjs` (new 9-group test suite)
   - `lib/memory/run-feynman-tests.cjs` (registers new test)

**Plan metadata commit:** (this SUMMARY.md + STATE.md + ROADMAP.md — committed at plan close)

## Brain session flow (before -> after)

### Before (pre-87-07)

```
callTool(tool, args)
  |-- getApiKey()
  |-- POST /mcp {method: initialize}          <-- wasted on every call
  |-- POST /mcp {method: tools/call, ...}
  |-- parse SSE -> return result
```

Every single Brain round-trip cost a duplicate init handshake. Concurrent callers
both ran the init, the second overwrote state behind the first (race).

### After (87-07, pending-promise pattern)

```
callTool(tool, args)
  |-- getApiKey()
  |-- _ensureSession(key):
  |     keyHash = sha256(key).slice(0,16)
  |     cached = sessionCache.get(keyHash)
  |     if cached and !expired:
  |         return cached.promise        <-- cache hit, fast path
  |     promise = (async () => { POST /mcp initialize; return marker })()
  |     sessionCache.set(keyHash, {promise, expiresAt: now + 5min})
  |     promise.catch(() => sessionCache.delete(keyHash))  <-- self-purge on fail
  |     return promise
  |-- POST /mcp {method: tools/call, ...}
  |-- parse SSE -> return result
```

**Concurrent callers:** both hit `sessionCache.get()` inside the same event-loop tick. The first caller sees no cache entry, builds the promise, calls `.set()`, returns the promise. By the time the second caller reaches the same line, the Map already has the entry (Map.set is synchronous) — the second caller hits the cache-hit branch and shares the same in-flight promise. Both awaiters resolve to the same session marker; init fired ONCE.

**Failure path:** if the init throws (network error, 401, 5xx), the `.catch()` tail deletes the cache entry. The NEXT caller hits a cache miss and builds a fresh promise. No poisoned cache.

## Cascade Map -> LRU call-site survey

All call sites on the 3 caches use `.get/.set/.delete` only (grep audit):

- `lastHsiByRoom.get(roomDir)` at lines 305, 518, 618 — O(1) in LRU
- `lastHsiByRoom.set(roomDir, ts)` at lines 528, 630 — O(1) in LRU
- `batchQueues.get(roomDir)` at lines 566, 587 — O(1) in LRU
- `batchQueues.set(roomDir, batch)` at line 575 — O(1) in LRU
- `batchQueues.delete(roomDir)` at line 588 — O(1) in LRU
- `analyzeRoomCache.get(roomDir)` at line 91 — O(1) in LRU
- `analyzeRoomCache.set(roomDir, {...})` at line 109 — O(1) in LRU
- `analyzeRoomCache.delete(roomDir)` at line 118 — O(1) in LRU

No current caller uses `.entries/.forEach/.keys/.values/for-of` on these caches, but the LRU's Map-parity iteration surface is there for future proactive-dump / debug endpoints (e.g. 87-08 dashboard's /api/internal/caches if it materializes). Map-parity = future-proofing for zero marginal cost.

## Files Created/Modified

- `lib/core/lru-cache.cjs` **(created)** — hand-rolled LRU class, BSL 1.1 licensed, Map-parity iteration
- `lib/core/brain-client.cjs` — +93 lines for sessionCache + _ensureSession + _hashKey + callTool refactor + _test surface extension
- `lib/core/intelligence-cascade.cjs` — 3-line change: require lru-cache + swap 3 `new Map()` -> `new LRU(100)` (plus comment updates)
- `lib/memory/brain-cache-lru.test.cjs` **(created)** — 9 assertion groups, 203 lines
- `lib/memory/run-feynman-tests.cjs` — registers the new test in suite (was 25 entries, now 26)

## Decisions Made

1. **Doubly-linked list + Map backing** rather than Map-plus-delete-reinsert on `get`. Explicit list nodes keep eviction O(1) and let iteration walk MRU->LRU without depending on Map's internal insertion-order semantics after deletions.
2. **Map-parity iteration on LRU** so the intelligence-cascade swap was a literal `new Map()` -> `new LRU(100)` edit with zero call-site refactoring — eliminates the "inventory every caller" work that the original 50-line LRU spec would have required.
3. **Pending-promise pattern** (cache the Promise, not the resolved value). Concurrent callers share the in-flight await; TTL reuse case is a microtask no-op on an already-resolved promise; rejection path purges the entry so the next caller retries fresh. No mutex, no extra state machine.
4. **sha256 truncated to 16 hex chars** for cache keys. Node builtin `crypto` — zero new runtime dep. 64 bits of key space = zero realistic collision risk across any team MCP deployment.
5. **Opaque session marker `validated-<timestamp>`**. The Brain Streamable-HTTP transport is stateless at the HTTP level — subsequent tools/call requests don't need to echo a sessionId back. What the cache proves is that the key is live within the TTL window.
6. **Iteration does NOT promote entries**. Reading via `.entries/.forEach/etc.` is not a "use" per LRU semantics — otherwise any debug-dump endpoint would scramble eviction order.
7. **Inline literal `new LRU(100)` rather than a named `CASCADE_CACHE_CAP` constant.** The plan's success criteria asserts `grep -c "new LRU(100)"` returns 3. Keeping the literal stamp at each site makes the bound visible where it's used.
8. **Test strengthened from 2 -> 10 concurrent callers** for the race guard, per the plan's must-haves ("10 concurrent `callTool()` calls on the same cacheKey → Brain client's createSession method is called exactly once"). Observability of the pending-promise behaviour is higher at 10 than at 2.

## Deviations from Plan

None — plan executed exactly as written. The 8th decision above (literal `new LRU(100)` vs named constant) is a minor interpretation choice that preserves the plan's literal grep assertion; all other implementation matches the plan's `<action>` sketches line for line.

## Issues Encountered

- One flaky initial feynman run showed 25/26 with 1 failure, but the suite immediately re-ran clean 26/26 twice. The flake was in a pre-existing test (the brain-cache-lru suite itself runs in ~100ms with no network dependency). Not a regression introduced by this plan.
- `dashboard/graph.json` had pre-existing uncommitted drift from prior session work — left untouched per scope boundary (Rule scope: only auto-fix issues directly caused by the current task's changes).

## User Setup Required

None — zero infrastructure or external service configuration.

## Self-Check: PASSED

**Files checked:**
- `lib/core/lru-cache.cjs` — EXISTS
- `lib/core/brain-client.cjs` — MODIFIED (sessionCache, _ensureSession, _hashKey added)
- `lib/core/intelligence-cascade.cjs` — MODIFIED (3 Maps -> LRU(100))
- `lib/memory/brain-cache-lru.test.cjs` — EXISTS
- `lib/memory/run-feynman-tests.cjs` — MODIFIED (test registered)

**Commits checked:**
- `8f3018c` — LRU helper module (FOUND in git log)
- `6f54a7b` — Brain sessionCache (FOUND in git log)
- `b642d11` — Cascade LRU swap + regression suite (FOUND in git log)

**Verification:**
- Feynman suite: 26/26 passed, 0 skipped, 0 failed
- brain-cache-lru standalone: all assertions passed
- Cascade-e2e baseline exact-match: `{INFORMS:3, CONTRADICTS:1, CONVERGES:0, INVALIDATES:1}` (unchanged)
- Grep matrix (all plan criteria satisfied):
  - `new LRU(100)` in intelligence-cascade.cjs == 3 (plan: == 3) PASS
  - `sessionCache` in brain-client.cjs == 6 (plan: >= 3) PASS
  - `SESSION_TTL_MS` in brain-client.cjs == 4 (plan: >= 2) PASS
  - `_ensureSession` in brain-client.cjs == 4 (plan: >= 2) PASS
  - `crypto.createHash.*sha256` in brain-client.cjs == 1 (plan: >= 1) PASS
  - `djb2` in brain-client.cjs == 0 (plan: == 0) PASS
  - `require.*lru-cache` in intelligence-cascade.cjs == 1 (plan: >= 1) PASS
  - iteration methods in lru-cache.cjs == 13 (plan: >= 6) PASS
  - `testConcurrentInitRaceGuard|initCallCount` in test == 13 (plan: >= 2) PASS
  - `sha256` in test == 5 (plan: >= 1) PASS

## Next Phase Readiness

- 87-07 closes the last of the CASCADE-06 items (session reuse + LRU eviction) for v1.10.12.
- LRU helper is reusable across future plans (88 skill-offer engine, 90 Chrome extension, 91 Goose — any long-running cache-bearing code can import `./lru-cache.cjs`).
- Pending-promise pattern established for future concurrent-init cache sites (e.g. if 87-09 BYO chat needs per-token key caches).
- Wave 3 of v1.10.12 now has both halves done: 87-04 (sync/async split) + 87-07 (Brain cache + LRU).
- Next plan: Wave 4 — 87-09 BYO API chat panel + 87-09a token plumbing + 87-09b stakeholder verification.

## CHANGELOG line for v1.10.12

```
### Changed
- Brain session reuse within 5-minute TTL windows (CASCADE-06); concurrent `callTool()` on the same api_key share ONE in-flight init (R-87-07-RACE fix via pending-promise pattern); sha256 session-cache keys.

### Added
- `lib/core/lru-cache.cjs` -- hand-rolled bounded LRU with Map-parity iteration (entries/keys/values/forEach/clear/[Symbol.iterator]), reusable across the plugin.

### Fixed
- Long-running MCP server memory growth in `intelligence-cascade.cjs`: `lastHsiByRoom`, `batchQueues`, `analyzeRoomCache` previously grew unbounded per distinct room; now capped at 100 entries each via LRU eviction.
```

---
*Phase: 87-security-hardening-cascade-refactor*
*Plan: 07*
*Completed: 2026-04-19*
