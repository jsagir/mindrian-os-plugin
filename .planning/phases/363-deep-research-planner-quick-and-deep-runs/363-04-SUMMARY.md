---
phase: 363-deep-research-planner-quick-and-deep-runs
plan: 04
subsystem: research-cache
tags: [cache, cache-first, counts, meta, d-16, d-03, wave-0]

requires:
  - phase: 363-03
    provides: envelope meta {count, cost_usd, remaining_usd, limit_usd, x_query}, count null when unresolved
provides:
  - research-cache putCached stores an optional scalar-only meta beside results (additive, pre-363 layout unchanged when omitted)
  - getCachedEntry returns {results, meta, fetched_at}; meta is null for an entry written before 363
  - fetchSourceCached exported from source-lens-driver.cjs, passing envelope meta on write and returning it on hit and live paths
  - versioned cache namespace openalex-v2 (filename-safe, distinct path from openalex; pre-363 entries are simply a miss)
affects: [363-11, 363-12, 363-13]

key-files:
  created:
    - tests/test-363-cache.cjs
  modified:
    - lib/core/research-cache.cjs
    - lib/lens-engine/source-lens-driver.cjs

key-decisions:
  - "getCached keeps returning a plain results array for every pre-363 caller; the meta read path is a new getCachedEntry (a plain-array return cannot carry meta without breaking callers)"
  - "meta is sanitized to scalars (finite number, string, boolean, null) on write and on read, so a cache file can never carry structured room content or be read back as a nested object"
  - "fetchSourceCached keeps its 219/221 fields byte-identical and adds results (alias of items), provenance ('research-cache' | 'live') and meta at top level; the same meta is attached to the envelope after construction because the envelope constructor drops unknown keys"
  - "failed and blocked envelopes were already never cached (succeeded gate: ok, empty_valid, degraded only); C5 now pins that"

patterns-established:
  - "Cache-first reuse: the 363 engine calls the one exported fetchSourceCached with source 'openalex-v2' and maps it to the openalex provider inside its fetchEnvelopeFn"

requirements-completed: [DRP363-06, DRP363-07]

duration: 20min
completed: 2026-09-29
---

# Phase 363 Plan 04: Cache carries counts Summary

**The shared research cache now keeps an OpenAlex result count and budget with the results, so a warm cache answers the whitespace question instead of handing the verdict a list with no count; the existing cache-first helper is exported, not copied.**

## PLAN_BASE

`210fb43fa6ac0e660b44089a808544abd332adcb`

## Task commits

| Task | Commit | Files |
|------|--------|-------|
| 1 RED | e8413da39 | tests/test-363-cache.cjs |
| 2 GREEN | 24753541c | lib/core/research-cache.cjs, lib/lens-engine/source-lens-driver.cjs |

Both are ancestors of HEAD.

## What was built

- `research-cache.cjs`: `sanitizeMeta` (scalars only), `putCached(..., opts.meta)` stores `meta` beside `results` only when non-empty, new `getCachedEntry` returns `{results, meta, fetched_at}` (meta null for pre-363 entries), `getCached` delegates and keeps its array return. TTL, key format and file layout unchanged.
- `source-lens-driver.cjs`: `fetchSourceCached` reads via `getCachedEntry`, rebuilds the hit envelope with `provenance: ['research-cache']` and the stored meta, passes `env.meta` (or `payload.meta`) to `putCached` on a live ok, empty_valid or degraded result, and is now in `module.exports`.
- Final `fetchSourceCached(source, query, roomDir, fetchEnvelopeFn)` return shape: `{ items, results, status, reason, freshness, provenance, meta, envelope }`. `provenance` is `'research-cache'` on a hit, `'live'` on a live fetch; `meta` is `{count, cost_usd, remaining_usd, limit_usd, x_query}` or null; `envelope.provenance` includes `'research-cache'` on a hit and `envelope.meta` mirrors `meta`. The failed and skipped return shapes are unchanged except a failed live result also carries `meta`.

## Verification

- `node tests/test-363-cache.cjs`: PASS 12, FAIL 0 (C1-C9 plus C1b, C4a/b split, net guard). On PLAN_BASE code it exited 1 with C1-C6 and C8 failing (C3 among them).
- `tests/run-all-130.5.sh`: exit 0.
- `tests/run-all-131.sh`: exit 1, Failed 2 (`test-131-substrate.cjs`, `test-131-e2e.cjs`), the exact pre-existing pair recorded by the 363 aggregator signature. Causes are unrelated to the cache: substrate asserts a pre-131 edge/event-type delta (44 vs 10, 104 vs 73); e2e trips its zero-leak gate on a read of `~/.mindrian/persona-override.json`. `test-131-source-lens-driver.cjs` (the direct fetchSourceCached caller) passes.
- Zero em-dash or en-dash in the three files.

## Deviations from Plan

None on scope. One implementation call the plan left open: `getCached` cannot return meta without changing its array return for existing callers, so meta is read through the new `getCachedEntry` (documented above, pinned by C1 and C1b). The scratch-worktree rerun of run-all-131 at PLAN_BASE was attempted but a bare worktree lacks the installed dependencies, so its output was not comparable; equivalence rests on the identical two-leg failure list matching the aggregator's recorded signature and on the failure causes above being outside the cache path.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path or trust-boundary file access: the cache is local and the key derives from the approved query string only (C8). T-363-03, T-363-09 and T-363-20 mitigated as planned (openalex-v2 namespace, no key in path or content, failed and blocked never cached).

## Self-Check: PASSED

- tests/test-363-cache.cjs, lib/core/research-cache.cjs, lib/lens-engine/source-lens-driver.cjs present.
- Commits e8413da39 and 24753541c are ancestors of HEAD.

## Post-plan regression fix (2026-09-30)

- **Symptom:** `bash tests/run-all-221.sh` moved from its recorded `PASS=11 FAIL=3` to `PASS=10 FAIL=4`; `tests/run-all-363.sh` flagged both. The failing leg was `tests/test-221-envelopes.cjs` C3 part (b), assertion `the cache-read failure rides as a WARNING: []`.
- **Root cause (confirmed):** commit 24753541c made `fetchSourceCached` in `lib/lens-engine/source-lens-driver.cjs` read the cache through `researchCache.getCachedEntry` (so the stored meta rides on a hit) and type a read throw as a `cache_read_failed: ...` warning. C3 (b) still stubbed `researchCache.getCached` to throw. `getCached` now wraps `getCachedEntry` by an internal call, so replacing the exported `getCached` never fires on the driver path: no throw, no warning, empty `warnings`. The product kept the warning; the test seam was stale.
- **Trace:** `getCachedEntry` has exactly one reader in lib/ (the driver). `getCached` callers in lib/ are `domain-insight-sweep.cjs` (its own path) and the doc comment in `futures/orchestrator.cjs`; neither reaches the driver.
- **Fix:** C3 (b) now saves, stubs and restores `researchCache.getCachedEntry` instead. Every assertion is unchanged (status ok, warning matches `/cache/i`, `failure_class` null). No product change.
- **Result:** `node tests/test-221-envelopes.cjs` 18 passed, 0 failed; `run-all-221.sh` back to its recorded signature (see the commit trail).
- **Also:** em-dash and en-dash characters removed from the 05, 09 and 12 SUMMARY files (em-dash guard).
