---
phase: 172-contextual-invocation-coverage
plan: 11
subsystem: infra
tags: [cirs, r11, inv-09, inv-16, nested-within, coverage-rollup, projection-monitor, fractal, simon]

# Dependency graph
requires:
  - phase: 169-graph-derivation-harness
    provides: NESTED_WITHIN room-lineage edge + the recursive rollup walk idiom (_directChildSlugs + _childDirForSlug in graph-derivation.cjs)
  - phase: 172-01 (connector-coverage-ledger)
    provides: the per-room wired/excluded/gap coverage scalar shape (data/connector-coverage-ledger.json)
  - phase: 172-03 (orchestration-projection + validateProjection)
    provides: brain-orchestration-projection.json + the UN-WIRED/UN-RANKED/STALE/command_gaps classification the monitor composes
provides:
  - rollupCoverage(room): ONE scale-invariant depth-3 coverage rollup over NESTED_WITHIN (R11/INV-16)
  - monitorCoverage(projection): projection-level coverage + chain-health monitor (INV-09), Local-Only
  - tests/test-coverage-rollup.cjs: 4 rollup behaviors + 4 monitor behaviors, registered in run-all-172.sh
affects: [172-13 (hard-FAIL gate flip), R11 fractal coverage consumers, future nested-room coverage monitoring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Scale-invariant fractal rollup: ONE rollup(room) operator applied at every level, depth-3 capped (SEED-022), normalized by subtree size"
    - "Aggregate-SCALAR-only across room boundaries: reuse the Phase 169 NESTED_WITHIN child-DISCOVERY walk (slug+dir) but read child coverage SCALARS, never child edges (entry 23)"
    - "Pure projection monitor: a disk-free in-memory composition of validateProjection categories + a chain-reachability check; zero Brain, zero network"

key-files:
  created:
    - lib/core/coverage-rollup.cjs
    - lib/core/coverage-monitor.cjs
    - tests/test-coverage-rollup.cjs
  modified:
    - tests/run-all-172.sh

key-decisions:
  - "REUSE the Phase 169 NESTED_WITHIN child-DISCOVERY walk idiom, NOT rollupSubRooms itself: rollupSubRooms ATTACHes child EDGES across the boundary, which is exactly what entry 23 forbids for cross-room AGGREGATION. Only scalars cross here."
  - "Per-room coverage scalars source = .mindrian/coverage.json { counts: {wired, excluded, gap} } (the per-room equivalent of the connector-coverage-ledger counts block); a missing file degrades to a zero-scalar room."
  - "STALE in the monitor reports projection-carried freshness markers only; the on-disk byte-compare STALE stays in scripts/build-orchestration-projection.cjs validateProjection so the monitor is a PURE in-memory read (Test 3 forbids any non-projection dependency)."
  - "R11/INV-09 enforcement stays WARN/aspirational (deferred-enforcement): the monitor reports 23 unwired + 46 command_gaps on the live projection without hard-failing."

patterns-established:
  - "Depth-cap reporting: depth_capped:true is set iff deeper rooms exist beyond the cap, so a consumer can tell a true leaf from a cap-truncated subtree."
  - "Chain-reachability: FEEDS_INTO/CHAINS/PREREQUISITE edges with an absent target/source node are flagged unreachable (R13 dangling-chain detection), robust to the currently SOURCE-EMPTY chain layer."

requirements-completed: [INV-09, INV-16]

# Metrics
duration: 22min
completed: 2026-06-23
---

# Phase 172 Plan 11: Fractal Coverage Rollup + Projection Monitor Summary

**ONE scale-invariant depth-3 coverage rollup over NESTED_WITHIN (aggregate-scalar-only across room boundaries, R11/INV-16) plus a Local-Only projection-level coverage + chain-health monitor (INV-09).**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-06-23 (PLAN_START)
- **Completed:** 2026-06-23
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- `rollupCoverage(room, opts)`: the ONE scale-invariant operator. Reads a room's LOCAL coverage scalars, walks DOWN its NESTED_WITHIN children to DEPTH_CAP=3 inclusive (root depth 0), aggregates every in-cap room's wired/excluded/gap by SUM, normalizes by subtree size into a coverage_ratio. Same function applies at every level; a 4th-level descendant beyond the cap is NOT aggregated (proven by an attached wired:99 room d that does not leak).
- Cross-room boundary contract honored (Appendix D entry 23 / Part 11 R11): only aggregate SCALARS cross a room boundary. The rollup reuses the Phase 169 NESTED_WITHIN child-DISCOVERY walk (slug + dir resolution) to learn the subtree shape, but reads each room's coverage SCALARS, never the child's edge rows. Test 3 asserts no child INFORMS edge content (a-secret/b-secret/c-secret) and no INFORMS type ever crosses into the parent rollup.
- `monitorCoverage(projection)`: a projection-level health report `{unwired, unranked, stale, command_gaps, chain_reachability, counts}`. Composes the validateProjection UN-WIRED/UN-RANKED/COMMAND-GAP classification (Part 7 reuse) plus a chain-reachability check over FEEDS_INTO/CHAINS/PREREQUISITE edges. Pure in-memory read of the LOCAL projection: zero Brain, zero network (Part 8 / INV-12), proven by a static source-scan assertion in the test.

## Task Commits

1. **RED (TDD): failing test** - `b2cca80c` (test)
2. **Task 1: scale-invariant coverage rollup** - `b9fa4f3f` (feat)
3. **Task 2: projection-level coverage + chain-health monitor** - `729d2607` (feat)

_Plan metadata commit follows this SUMMARY (docs)._

## Files Created/Modified
- `lib/core/coverage-rollup.cjs` - the scale-invariant rollup(room) operator over NESTED_WITHIN, depth-3 capped, normalized by subtree size, aggregate-scalar-only
- `lib/core/coverage-monitor.cjs` - projection-level coverage + chain-health monitor (UN-WIRED/UN-RANKED/STALE/command_gaps/chain_reachability), Local-Only
- `tests/test-coverage-rollup.cjs` - 4 rollup behaviors + 4 monitor behaviors (9 checks incl. DEPTH_CAP), all green
- `tests/run-all-172.sh` - registered test-coverage-rollup.cjs in the phase aggregator

## Decisions Made
- **Reuse the WALK, not the ATTACH.** Phase 169's `rollupSubRooms` does a read-side ATTACH that unions child EDGES into the parent. That is forbidden for cross-room AGGREGATION (entry 23). The rollup here rides the Phase 169 `_directChildSlugs` + `_childDirForSlug` child-discovery idiom (Part 7) but substitutes a per-room coverage-SCALAR read for the edge ATTACH at every boundary.
- **Per-room scalar source = `.mindrian/coverage.json`.** The per-room equivalent of the connector-coverage-ledger `counts` block. Missing/unreadable degrades to a zero-scalar room (still counted as a subtree node).
- **Monitor STALE stays projection-carried.** The on-disk byte-compare STALE remains the script's validateProjection job; the monitor reports only projection-carried freshness markers, keeping it a pure in-memory read so synthetic in-memory projections (and the Test 3 zero-network assertion) hold.
- **Enforcement stays WARN/aspirational** (R11/R6 DECLARED-but-DEFERRED-ENFORCEMENT). The monitor surfaces 23 unwired + 46 command_gaps on the live projection without hard-failing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected a stale leaf assertion in the shared test**
- **Found during:** Task 1 (rollup GREEN)
- **Issue:** Test 2 attaches a depth-4 room `d` (wired:99) under `c` to prove the depth-3 cap. Test 4 then asserted `rollupCoverage(c)` aggregates only `c`'s own 5 surfaces - but after Test 2, `c` is no longer a leaf (it has child `d` at depth 1 from `c`, within `c`'s own cap), so `c` correctly rolls up `c(5) + d(99) = 104`. The assertion was stale, not the implementation.
- **Fix:** Re-pointed Test 4's leaf-case to the genuine leaf `d` (subtree_size 1, total 99, coverage_ratio 1). The implementation was correct as written.
- **Files modified:** tests/test-coverage-rollup.cjs
- **Verification:** `node tests/test-coverage-rollup.cjs` -> PASS (9/9); the rollup behavior was never wrong.
- **Committed in:** b9fa4f3f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, in the test fixture assertion only - no implementation change).
**Impact on plan:** None on scope. The rollup + monitor shipped exactly as specified; the only fix was a self-inflicted stale test assertion caused by Test 2 mutating the shared fixture.

## Issues Encountered
- Bash surfaced intermittent permission prompts on some compound `cd ...; grep` and shell-quote-heavy commands. Retrying the same intent as simpler single commands (or via `node -e`) cleared every one, per the environment note. No blocker; all tasks, tests, and commits ran.

## TDD Gate Compliance
- RED gate: `b2cca80c` (test - fails by-require, modules absent).
- GREEN gates: `b9fa4f3f` (rollup) + `729d2607` (monitor).
- No REFACTOR commit needed (minimal implementation passed clean).

## User Setup Required
None - pure-Node rollup + monitor, no external service configuration.

## Next Phase Readiness
- R11/INV-16 (rollup) + INV-09 (monitor) shipped as WARN/aspirational per deferred-enforcement.
- The hard-FAIL gate flip (Wave 4 / Plan 172-13) can now lean on `monitorCoverage` for the projection-level signal and `rollupCoverage` for the nested-room fractal signal.
- Full Phase 172 aggregator green: `bash tests/run-all-172.sh` -> Total 9, Passed 9, Failed 0.

## Self-Check: PASSED
- FOUND: lib/core/coverage-rollup.cjs
- FOUND: lib/core/coverage-monitor.cjs
- FOUND: tests/test-coverage-rollup.cjs
- FOUND commit b2cca80c (RED test)
- FOUND commit b9fa4f3f (Task 1 rollup)
- FOUND commit 729d2607 (Task 2 monitor)

---
*Phase: 172-contextual-invocation-coverage*
*Completed: 2026-06-23*
