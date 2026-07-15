---
phase: 224-graph-derivation-harness-seed-034
plan: 02
subsystem: graph-derivation
tags: [per-write-trigger, cascade, detached-worker, encoder-skip, disclosure, cost-bound, review_status]

# Dependency graph
requires:
  - phase: 224-01-foundations
    provides: scoreBasedDeriveFn + buildNewArtifactPairs/buildAllPairs + edges.review_status column + fixture-room-224
  - phase: 169-graph-derivation-harness
    provides: runDerivation composer (producer-swap host) + the enqueue-then-drain Stop/SessionStart hooks this plan reworks
  - phase: 218-entity-extraction
    provides: openRoomDb D-05 write-safety (busy_timeout 5000, synchronous NORMAL) the detached worker inherits
provides:
  - "enqueueDerive(roomDir, opts): optional filePath per-write entries, deduped by the (resolved roomDir, resolved filePath) tuple"
  - "drainDerive default path: the score-based derivation worker (O(n) pair builders + scoreBasedDeriveFn injected into the untouched Phase-169 runDerivation composer)"
  - "D-04 encoder probe + skip + derivation_skipped disclosure marker (scalar-only, 60s deduped, non-blocking, no lexical fallback)"
  - "cascade Step 2b: per-write enqueue + detached unref'd spawn inside _runCascadeSteps (tri-polar: one body for CLI/Desktop/Cowork)"
  - "derivation_skipped EVENT_TYPES member (SEED-059 disclosure home)"
affects: [224-03-backfill-swap, 224-04-aggregate-harness]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Producer swap: reuse the Phase-169 runDerivation composer untouched; only the deriveFn producer changes (Part 7)"
    - "Async producer pre-resolution: await scoreBasedDeriveFn per pair, feed a synchronous deriveFn wrapper (runDerivation's sync loop treats a Promise return as [])"
    - "Polymorphic drain return: legacy deriveRunner path stays synchronous (byte-compatible with the Phase-169 spy test); the default score-based path returns a Promise"
    - "Detached-worker spawn (detached true + stdio ignore + unref) on the write path; never inline scoring, never awaited (D-02 refined)"
    - "SEED-059 disclosure marker at point of occurrence: additive event type, scalar-only payload, dedupe_key rides the logEvent 60s idempotency"

key-files:
  created:
    - tests/test-224-encoder-skip.cjs
    - tests/test-224-per-write-derive.cjs
    - tests/test-224-cost-bound.cjs
  modified:
    - lib/core/navigation/memory-events.cjs
    - scripts/gsd-graph-derive-sweep.cjs
    - scripts/gsd-graph-derive-drain.cjs
    - lib/core/intelligence-cascade.cjs

key-decisions:
  - "D-02 refined: cascade Step 2b ENQUEUES + spawns a DETACHED unref'd worker; scoring NEVER runs inline on the write-lock (source-grep proves no scoreMeasured, no await of the drain)"
  - "D-04: encoder-unavailable is a soft-fail, advisory SKIP with a derivation_skipped disclosure marker; NO lexical-only fallback (a symmetric score cannot honestly type edges), never a blocked write (Phase 210 caution)"
  - "Wave-1 fix honored: the async scoreBasedDeriveFn is pre-resolved per pair into a synchronous deriveFn before entering runDerivation's sync loop (a Promise return would be dropped as [])"
  - "Legacy deriveRunner seam kept byte-compatible: injected -> sync, legacy call shape, encoder probe SKIPPED (preserves the Phase-169 round-trip test's 4 assertions)"

patterns-established:
  - "Req 6 O(n): a per-write drain scopes to buildNewArtifactPairs (new-vs-existing), proven by an exact-N counting scorer (5 calls for 5 existing, not 25, not 10)"
  - "Req 1 wiring: a related pair lands a proposed CONVERGES edge; an unrelated pair lands zero (the no-false-positive floor), through the ONE shared cascade body"

requirements-completed: ["Req 1", "Req 6"]

# Metrics
duration: 25min
completed: 2026-07-15
---

# Phase 224 Plan 02: Per-Write Derivation Trigger Summary

**Every markdown write through the shared intelligence cascade now enqueues a per-write derive request and spawns a detached background worker that scores O(n) new-artifact-vs-existing pairs through the untouched Phase-169 composer, lands proposed CONVERGES/INFORMS edges, and soft-skips with a disclosure marker when the encoder is unavailable.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-15T09:33Z (approx)
- **Completed:** 2026-07-15T09:58Z
- **Tasks:** 2 (both TDD: RED then GREEN)
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments
- The twice-reconfirmed 0-typed-edge gap now closes on every normal conversational write: cascade Step 2b (Phase 224 Req 1, D-02) enqueues a `{roomDir, filePath}` derive request and spawns the drain DETACHED (unref'd, stdio ignored, env inherited), tri-polar by construction (the ONE shared `_runCascadeSteps` body covers CLI post-write, Desktop/MCP tool-router, and Cowork).
- The drain became the real score-based worker: it builds O(n) new-artifact pairs (Req 6), injects Plan 01's `scoreBasedDeriveFn` into the Phase-169 `runDerivation` composer as a producer swap (Part 7, no new engine), and writes proposed edges through the existing navigation chokepoint.
- D-04 encoder handling: a single-probe check runs BEFORE any pair; unavailable means skip every pair, write a `derivation_skipped` disclosure marker (scalar-only payload, 60s deduped), clear the queue, and return `ok:true`. No lexical-only degrade path exists anywhere; the skip is advisory and never blocks the write (Phase 210 caution).
- The Wave-1 hazard was handled precisely: `scoreBasedDeriveFn` is async, and `runDerivation`'s synchronous `deriveForPair` treats a Promise return as `[]`. The drain pre-resolves candidates per pair (awaited) and feeds a synchronous `deriveFn` wrapper into the composer, so the composer stays untouched and no candidate is silently dropped.

## Task Commits

Each task committed atomically (TDD RED then GREEN):

1. **Task 1 (RED): failing D-04 encoder-skip + disclosure-marker proof** - `88873f19` (test)
2. **Task 1 (GREEN): score-based drain + filePath queue + D-04 skip/disclose** - `ae5030a3` (feat)
3. **Task 2 (RED): Req 1 per-write + Req 6 cost-bound proof legs** - `165a3ad9` (test)
4. **Task 2 (GREEN): cascade Step 2b enqueue + detached spawn** - `04bb005c` (feat)

## Files Created/Modified
- `lib/core/navigation/memory-events.cjs` (modified) - added `derivation_skipped` to EVENT_TYPES as a purely additive member, copying the `reach_weight_state_unavailable` comment discipline (Phase 224 D-04, SEED-059 convention, emitter names, Part 8 scalar-only payload rule).
- `scripts/gsd-graph-derive-sweep.cjs` (modified) - `enqueueDerive(roomDir, opts)` gains an optional `opts.filePath`; entries become `{roomDir, filePath?, enqueued_at}` deduped by the (resolved roomDir, resolved filePath) tuple. Absent filePath dedupes exactly as the pre-224 room-scoped entry. The zero-arg Stop-hook `main()` path is untouched.
- `scripts/gsd-graph-derive-drain.cjs` (modified) - reworked `drainDerive` into the real worker: legacy `deriveRunner` seam kept byte-compatible (sync, no probe); default path builds pairs, pre-resolves the async producer, runs the untouched composer, and implements the D-04 probe/skip/disclose. New helpers `probeEncoder`, `discloseSkip`, `pairCountFor`, `clearQueue`, `drainScoreBased`. `main()` now awaits the polymorphic return.
- `lib/core/intelligence-cascade.cjs` (modified) - Step 2b added inside `_runCascadeSteps` after Step 2, in its own try/catch: `enqueueDerive(roomDir, {filePath})` then a detached unref'd spawn of the drain; `entry.deriveEnqueue` envelope surfaced on the flat `runCascade` result. Imported `spawn` from child_process.
- `tests/test-224-encoder-skip.cjs` (created) - D-04 behaviors 1-3 (skip + scalar-only marker + 60s dedupe), 11 assertions.
- `tests/test-224-per-write-derive.cjs` (created) - Req 1 related/unrelated + proposed-status + cascade-wiring + source assertions, 11 assertions.
- `tests/test-224-cost-bound.cjs` (created) - Req 6 exact-N scorer-call proof (5 calls for 5 existing, not 25, not 10).

## Decisions Made
- Followed the plan and the Wave-1 note exactly: the async producer is pre-resolved into a sync wrapper before entering `runDerivation`, never passed straight into its synchronous loop.
- The D-04 probe is SKIPPED on the legacy `deriveRunner` path (only) so `tests/test-graph-derive-sweep.cjs` stays byte-compatible (4/4 unchanged), as the plan-check note required.
- The disclosure marker's `dedupe_key` is `'derivation_skipped:' + resolved roomDir`, riding the existing `logEvent` 60s idempotency window so a repeat forced-unavailable drain writes no second marker.

## Deviations from Plan

### Auto-fixed / auto-added (Rule 3 - test-determinism seam)

**1. [Rule 3 - Blocking issue] Added a `MOS_NO_DETACHED_DERIVE` test seam to the cascade Step 2b spawn**
- **Found during:** Task 2 (per-write-derive test authoring)
- **Issue:** Step 2b spawns a REAL detached drain that (in production) loads the heavy encoder and clears the queue asynchronously. In a test that calls `runCascade` and then asserts the queue entry + drains in-process, the real detached worker races the assertions and could clear the queue or contaminate edges non-deterministically. The plan's own acceptance requires "no reliance on detached-process timing."
- **Fix:** guarded the spawn with `if (process.env.MOS_NO_DETACHED_DERIVE !== '1')`. Production always spawns; the test sets the env var so the in-process drain is the sole, race-free writer. Enqueue still happens (the foreground effect the test asserts).
- **Files modified:** `lib/core/intelligence-cascade.cjs`
- **Commit:** `04bb005c`

## Threat Model Coverage
- **T-224-05 (DoS, foreground cascade):** mitigated - Step 2b does only a JSON enqueue + unref'd spawn; the comment-stripped source-grep test asserts no inline `scoreMeasured` and no `await` of the drain.
- **T-224-06 (DoS, worker vs live-write WAL contention):** mitigated - the drain inherits Phase 218 D-05 `openRoomDb` write-safety (busy_timeout 5000, synchronous NORMAL); duplicate drains no-op on the cleared queue.
- **T-224-07 (Tampering, spawn argv):** mitigated - spawn uses an argv ARRAY (no shell); the drain validates roomDir before any work and exits 0 on a nonexistent room.
- **T-224-08 (Information disclosure, derivation_skipped payload):** mitigated - scalar-only fields (reason enum, basename, counts); the test asserts no artifact body text in the payload (Part 8).
- **T-224-09 (DoS, hook/worker crash blocking writes):** mitigated - every path try/catch + exit 0; the skip is advisory, never a hard-fail.
- **T-224-SC (supply chain):** mitigated - zero new dependencies.

## Issues Encountered
None blocking. Four pre-existing failures in `run-all-169.sh` (`test-edges-room-lineage-floor`, `test-edges-part4-cascade-floor`, `test-depth2-full-citizen`, `test-graph-derivation-verdict`) and one in `test-futures-cascade-integration.cjs` were VERIFIED pre-existing at the true baseline `8300a35b1` (by reverting every 224-02 file and re-running): they concern the FEYNMAN `## Timeline (auto)` renderer, edge-floor citizen markers, and the futures `writeCascadeEdges` path - all disjoint from this plan. Plan 224-02 introduces ZERO new failures. Logged to `deferred-items.md`.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 03 (backfill swap) can now drive `buildAllPairs` + `scoreBasedDeriveFn` through the same score-based drain default path, and has a tolerant assertion for the `derivation_skipped` EVENT_TYPES member this plan shipped.
- The per-write trigger, the disclosure marker, and the O(n) cost bound are all proven by deterministic tests with zero detached-process races.

## Regression Notes
- `tests/test-graph-derive-sweep.cjs`: PASS (4/4) unchanged (Phase-169 round-trip contract preserved via the byte-compatible legacy `deriveRunner` seam).
- Wave-1 legs: `test-224-migration` (6/6) and `test-224-classifier` (5/5) green.
- `run-all-169.sh`: the 4 failing legs are pre-existing (baseline-confirmed), NOT 224-02 regressions.

## Known Stubs
None. All Step 2b, drain, and disclosure code paths are wired to real data sources; no placeholder returns.

## Self-Check: PASSED

- All 3 created test files present on disk; SUMMARY present.
- All 4 commits (88873f19 test, ae5030a3 feat, 165a3ad9 test, 04bb005c feat) exist in git.
- Verification suite green: test-224-encoder-skip (11/11), test-224-per-write-derive (11/11), test-224-cost-bound (3/3), plus test-graph-derive-sweep (4/4), test-224-migration (6/6), test-224-classifier (5/5).

---
*Phase: 224-graph-derivation-harness-seed-034*
*Completed: 2026-07-15*
