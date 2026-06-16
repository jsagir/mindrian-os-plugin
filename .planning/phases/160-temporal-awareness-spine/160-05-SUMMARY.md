---
phase: 160-temporal-awareness-spine
plan: 05
subsystem: temporal
tags: [bitemporal, point-in-time, as-of, stale-detection, part-7-reuse, part-8-local, part-9-chokepoint]
requires:
  - "phase-160-nodes-bitemporal columns valid_from/valid_to/invalidated_at/last_modified_at (Plan 160-04)"
  - "supersede() non-lossy supersession through the chokepoint (Plan 160-04 R8)"
  - "findStaleDecisions 30-day pattern (Phase 109-05 insights.cjs)"
provides:
  - "queryAsOf(db, nodeKey, T_tx, T_v) point-in-time bitemporal query helper (R9)"
  - "findStaleClaims(db, roomId, opts) generalized stale detection beyond decisions (R10)"
  - "both re-exported on the navigation.cjs chokepoint"
affects:
  - "Wave 5 HITL gate + temporal-blindness sentinel (can reconstruct as-of state + sweep stale nodes)"
  - "any historical-reconstruction caller (what was true at phase X)"
tech-stack:
  added: []
  patterns:
    - "canonical bitemporal WHERE clause verbatim (half-open intervals, NULL=open)"
    - "opts.now clock-seam injection (supersession.cjs idiom) for deterministic time"
    - "additive thin re-export on navigation.cjs (Part 9 substrate guard)"
    - "Part 7 generalize-not-duplicate of the single 30-day relative-time computation"
key-files:
  created:
    - lib/core/temporal/point-in-time.cjs
    - lib/core/temporal/point-in-time.test.cjs
    - lib/core/navigation/insights-stale.test.cjs
  modified:
    - lib/core/navigation/insights.cjs
    - lib/core/navigation.cjs
decisions:
  - "queryAsOf keys the logical fact on source_path (the column three versions share) so a non-lossy supersession chain produces non-overlapping known-intervals and exactly one row matches"
  - "ORDER BY created_at DESC, valid_from DESC LIMIT 1 disambiguates the rare overlapping-known-interval case to the latest-known version, while the canonical chain matches one row"
  - "findStaleClaims keys on last_modified_at (Plan 04 write-time stamp), never last_seen_at, to avoid read-time misflagging (threat T-160-14); a NULL last_modified_at (never written-since-migration) is treated NOT stale rather than guessed from read time"
  - "stale flags only settled truth-claim states {confirmed, validated}; proposed/needs_evidence are not yet settled so cannot go stale"
metrics:
  duration_min: 22
  completed: 2026-06-16
---

# Phase 160 Plan 05: Point-in-Time Query Helper + Generalized Stale Detection Summary

Wave 4 part B of the temporal spine: one point-in-time `(T_tx, T_v)` bitemporal query helper that makes "what was true at phase X" answerable and closes the Plan 04 supersession round-trip, plus generalized stale detection that lifts the system's only relative-time computation from decisions-only to all claim types with a configurable window.

## What Was Built

R9 + R10. Both new symbols ride the navigation.cjs chokepoint.

- **`lib/core/temporal/point-in-time.cjs`** - `queryAsOf(db, nodeKey, T_tx, T_v)` implements the canonical bitemporal WHERE clause verbatim (160-RESEARCH item 2):
  `created_at <= T_tx AND (invalidated_at IS NULL OR invalidated_at > T_tx) AND valid_from <= T_v AND (valid_to IS NULL OR valid_to > T_v)`.
  NULL `invalidated_at` / `valid_to` read as open / unbounded. Half-open intervals (`<=` on lower bounds, strict `>` on upper bounds) are the off-by-one guard for the open boundary (threat T-160-12). The logical fact is keyed on `source_path` (the column three versions share); `ORDER BY created_at DESC, valid_from DESC LIMIT 1` returns the latest-known version when the predicate would match more than one (the non-lossy supersession chain produces non-overlapping known-intervals, so for that chain exactly one row matches). Pure LOCAL read of the Plan 04 columns; caller-owned db handle; NEVER opens room.db itself.
- **`lib/core/navigation/insights.cjs`** - added `findStaleClaims(db, roomId, opts)` that generalizes `findStaleDecisions` (the single relative-time computation, insights.cjs:110-125) to node types `{claim, assumption, opportunity, decision}` with a configurable `opts.windowDays` (default 30). It flags only settled nodes (`review_status IN {confirmed, validated}`) whose `last_modified_at` (the Plan 04 WRITE-time stamp, NOT `last_seen_at` which conflates read/write - threat T-160-14) is older than the window, measured against `getReferenceNow()` via the `opts.now` seam (the supersession.cjs idiom, so tests inject a fixed reference). A NULL `last_modified_at` (never written-since-migration) is treated NOT stale rather than guessed from read time. `findStaleDecisions` is left byte-unchanged for back-compat (Part 7 reuse: generalize, don't duplicate).
- **`lib/core/navigation.cjs`** - additive thin re-exports of `queryAsOf` and `findStaleClaims` (the logMemoryEvent / writeEdge / getRoomContext idiom), so both reach the surface through the Part 9 chokepoint, never a direct require of the submodule.

## Verification Results

Actual command output:

- **Task 1 (R9)** `node --test lib/core/temporal/point-in-time.test.cjs` -> **4 tests, 4 pass, 0 fail**:
  - the 3-version timeline (V1 known [100,200) valid [1000,2000); V2 known [200,300) valid [2000,3000); V3 known [300,open] valid [3000,open]) returns the correct version at three distinct `(T_tx, T_v)` points: `(150,1500)->V1`, `(250,2500)->V2`, `(350,3500)->V3`;
  - open intervals (NULL `invalidated_at`/`valid_to`) read unbounded: far-future `(9999999, 9999999)->V3`; a `T_v` before every `valid_from` returns null;
  - **R8 round-trip**: after `supersede(A,B)` (Plan 04 helper, fixed reference now 5000, closing A `invalidated_at=5000`, `valid_to=B.valid_from=2000`), an as-of query `(T_tx=4000 < 5000, T_v=500 inside A's [100,2000))` STILL RETURNS the superseded `rt:A`; an as-of `(T_tx=6000 > 5000, T_v=2500)` returns `rt:B`;
  - `queryAsOf` is re-exported on navigation.cjs and the chokepoint result agrees with the direct helper.
- **Task 2 (R10)** `node --test lib/core/navigation/insights-stale.test.cjs` -> **5 tests, 5 pass, 0 fail**:
  - a 31-day-old confirmed claim is FLAGGED stale; a 29-day-old one is NOT (SPEC R10 acceptance);
  - coverage across claim / assumption / opportunity / decision types (all four 40-day-old confirmed nodes flagged);
  - the window is configurable: a 10-day claim is fresh under the default 30-day window and stale under a `windowDays:7` window;
  - only `confirmed`/`validated` nodes flagged; `proposed` is not;
  - `findStaleClaims` is re-exported on navigation.cjs and `findStaleDecisions` is still present (back-compat).
- **Phase 157 Part 8 boundary scan stays GREEN**: `node tests/test-orchestration-projection-part8-boundary.cjs` -> `6 passed, 0 failed (6 checks)`.
- **findStaleDecisions back-compat**: `node --test tests/test-navigation-insights.cjs` -> 1 test, 1 pass, 0 fail (the existing 109-05 insights suite, unchanged).
- **navigation surface loads cleanly**: `queryAsOf: function`, `findStaleClaims: function`, `findStaleDecisions: function`.
- **Em-dash gate**: U+2014 scan over all created/modified files -> none (hyphens only).
- **No new dependency** (T-160-SC slopcheck N/A; this plan adds zero deps).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed the R8 round-trip test's valid-time construction**
- **Found during:** Task 1 GREEN (the round-trip test failed: returned B not A).
- **Issue:** the first round-trip test queried `(T_tx=4000, T_v=4000)`, but the Plan 04 `supersede()` closes `A.valid_to = B.valid_from` (a STATE-CHANGE chain, not an in-place correction). With `B.valid_from=1000` the close set `A.valid_to=1000`, so at `T_v=4000` A's valid interval `[100,1000)` no longer covered the query point and B (open valid-time) correctly won. The helper was right; the test's valid-time was wrong.
- **Fix:** reconstructed the timeline to match supersede() semantics: `A.valid_from=100`, `B.valid_from=2000`, so the close yields `A.valid_to=2000`. The pre-supersession query now uses `T_v=500` (inside A's `[100,2000)`) with `T_tx=4000<5000` -> A; the post query uses `T_v=2500` (inside B's `[2000,open)`) with `T_tx=6000>5000` -> B. This is a correct test of the transaction-time round-trip with a valid-time inside the surviving interval.
- **Files modified:** `lib/core/temporal/point-in-time.test.cjs`
- **Commit:** folded into the GREEN commit 79914536 (the RED commit f62b266f had already landed; the test-construction fix went in with the implementation).

No architectural deviations (Rule 4). No blocking issues (Rule 3). No new dependencies.

## Deferred Issues

None.

## Known Stubs

None. `queryAsOf` and `findStaleClaims` are fully wired, re-exported on the chokepoint, and exercised by tests. Both are LOCAL reads with no consumer required by this plan (Wave 5 + historical-reconstruction callers consume them downstream); an as-yet-unconsumed helper here is expected, not a smell, matching the Plan 04 note that the as-of helper was Plan 05's scope.

## Threat Flags

None. Both new symbols read only room.db scalars and return scalar/enum-shaped objects; no new network endpoint, auth path, or trust-boundary surface. T-160-12 (off-by-one on open intervals) is mitigated by the strict `>` + NULL=open clause pinned by the 3-version timeline test; T-160-14 (read-time misflagging) is mitigated by keying `findStaleClaims` on `last_modified_at` not `last_seen_at`; T-160-13 (egress) is mitigated by the GREEN Phase 157 boundary scan.

## Commits

- f62b266f: `test(160-05): add failing test for point-in-time (T_tx, T_v) query helper (R9)`
- 79914536: `feat(160-05): point-in-time (T_tx, T_v) bitemporal query helper (R9)`
- daab74b9: `test(160-05): add failing test for generalized stale detection (R10)`
- ec5569d9: `feat(160-05): generalized stale detection beyond decisions (R10)`

## Self-Check: PASSED

All 3 created files + 2 modified files exist on disk; all 4 task commits present in git history.
