---
phase: 216-eureka-user-command
plan: 01
subsystem: eureka
tags: [eureka, room-db, substrate, adapter, cjs, tail-quadrant, ahp]

# Dependency graph
requires:
  - phase: 215-eureka-portfolio-fusion
    provides: "loadGraph {meta,techMap,convergesPairs} contract in scripts/eureka-portfolio-report.cjs; the four Wave-1 modules (ahp-weights, portfolio-dimensions, tail-quadrant, opportunity-statement); percentileRank + classifyTail + MIN_COHORT=30 floor"
  - phase: 211-eureka-room-report
    provides: "openRoomDb(roomDir,{allowExtension:true}) room.db handle; nodes + typed edges schema"
provides:
  - "lib/core/eureka/room-native-substrate.cjs: buildRoomNativeSubstrate(db, opts) -> {meta, techMap, convergesPairs}, the room-native analog of loadGraph()"
  - "Room-native signal mapping: attention = node degree (pair_count/degree), growth = created_at recency (epoch-seconds cnumber)"
  - "Graceful sub-MIN_COHORT degradation proven at module level (no crash on tens-of-entries rooms)"
  - "Injected opts.canonicalId seam (default row.id; runner will pass catalogId) with no runner require-cycle"
affects: [216-02 runner wiring, 216-03 command surface, eureka, room-native]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adapter produces the exact shipped consumer shape rather than a new engine (Canon Part 7 composition)"
    - "Caller-owns-db-handle: the adapter neither opens nor closes room.db (tail-quadrant precedent)"
    - "Injected canonicalId function instead of importing the runner (breaks the future require cycle)"
    - "Defensive parseProps try/catch + Array/typeof guards on every user-authored field (tampering mitigation)"

key-files:
  created:
    - lib/core/eureka/room-native-substrate.cjs
    - tests/test-216-room-substrate.cjs
  modified: []

key-decisions:
  - "cnumber = String(epochSeconds(created_at)) so the SHIPPED cnumberNumeric->percentileRank growth axis reads room recency with zero runner math changes"
  - "Degree counts ALL typed edges (both source and target columns), aggregated per canonical id (the room-native analog of idea-graph edge_count)"
  - "No minCohort override and no recalibration knob in the adapter: the honest MIN_COHORT=30 floor degrades gracefully; threshold changes are UNCALIBRATED 202-APO territory"

patterns-established:
  - "Pattern: room-native substrate adapter (D-01) - room.db nodes/edges to loadGraph shape, NOT delegate to the plain 211 report"
  - "Pattern: hermetic offline substrate test via makeRoom(openRoomDb + INSERT nodes/edges) + finally cleanup"

requirements-completed: [216-R1]

# Metrics
duration: 16min
completed: 2026-07-10
---

# Phase 216 Plan 01: Room-Native Substrate Adapter Summary

**`buildRoomNativeSubstrate(db, opts)` reads a normal room.db (nodes + typed edges) into the exact `loadGraph` `{meta, techMap, convergesPairs}` shape - attention = node degree, growth = created_at recency - so the shipped AHP / dimensions / tail / statement engines compose against any MindrianOS room with no CSV-derived idea-graph.json and honest sub-MIN_COHORT degradation.**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-07-10 (this session)
- **Completed:** 2026-07-10
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments
- The ONE real engineering deliverable of Phase 216 is on disk and green: the room-native adapter that implements the D-01 navigator directive (pairs + signals from room.db directly, NOT a delegate to the plain 211 `eureka-room-report.cjs`).
- Exact byte-level analog of `loadGraph()`'s return: a 9-field tech contract per node (`id`, `cnumber`, `title`, `primary_tier`=undefined, `pair_count`, `degree`, `section`, `primary_problem`, `problems`), `meta` with `source:'room-native'` + honest run-time counts, and deduped unordered `convergesPairs` in canonical-id space.
- D-01 signal mapping proven: `pair_count`/`degree` = room-graph node degree (the attention axis the shipped `percentileRank` already reads); `cnumber` = epoch-seconds of `created_at` so the shipped `cnumberNumeric` -> growth axis carries recency ordering with zero runner changes.
- Graceful degradation pinned at module level: empty, edge-less, malformed-properties, sub-MIN_COHORT (10-tech), and all-tie (36-tech) rooms all flow through the adapter and the SHIPPED `classifyTail` without a crash - a sub-30 cohort returns the honest `insufficient_structure` verdict, not an exception.
- Zero modification to any shipped module: `git diff` touches only the two new files. run-all-215 (Phase 215 PASS=8, Phase 211 no-regression PASS=10) still green.

## Task Commits

Each task was committed atomically (TDD RED -> GREEN, then the degenerate-room pin):

1. **Task 1 (RED): failing test for the adapter contract** - `011ca87f` (test)
2. **Task 1 (GREEN): implement buildRoomNativeSubstrate** - `503b8e63` (feat)
3. **Task 2: pin degenerate-room graceful degradation (behaviors 7-11)** - `eb488e5a` (test)

## Files Created/Modified
- `lib/core/eureka/room-native-substrate.cjs` - the adapter: `buildRoomNativeSubstrate(db, opts)` + `_test` seam (`epochSeconds`, `parseProps`, `degreeMap`). Node built-ins only, zero network, no runner import.
- `tests/test-216-room-substrate.cjs` - hermetic offline unit test, 33 assertions across all 11 behaviors; requires only the adapter, `room-db.cjs`, and the shipped `portfolio-dimensions` + `tail-quadrant` classifiers (read-only).

## Decisions Made
- **Epoch-seconds recency proxy:** encoding `created_at` as `String(Math.floor(Date.parse(v)/1000))` was chosen over any bespoke growth number because the shipped runner already parses `cnumber` via strip-leading-C + parseInt; epoch seconds slot straight into that axis and preserve newer-is-larger ordering. Documented in the module header.
- **Degree over all typed edges:** every edge row is a citation by the room's own hand, so degree counts both endpoints of every edge (aggregated per canonical id), mirroring the idea-graph `edge_count` the attention axis consumes.
- **No threshold knob:** deliberately did NOT add a `minCohort` override or lower MIN_COHORT; the adapter feeds the same 30-floor classifier and lets it emit the honest degenerate verdict (recalibration is a later 202-APO concern). Enforced by the acceptance grep `minCohort` count = 0 in non-comment lines.
- **`_test.degreeMap` exported:** the artifact table listed `degreeMap` in the `_test` seam alongside `epochSeconds`/`parseProps`, so degree was factored into a standalone testable function and exported (superset of the action step's two-function seam).

## Deviations from Plan

None - plan executed exactly as written. The Task 1 adapter was written with the full defensive guards the plan specified (parseProps try/catch, edges-table-absent catch, `Number.isFinite` in `epochSeconds`, Array/typeof guards on every field), so behaviors 7-9 in Task 2 passed against the unchanged adapter and no additional hardening code was needed. Task 2's contribution is the tests that PIN that behavior - which is exactly the Task 2 deliverable ("extend the test... harden whatever behaviors 7-9 surface"; nothing new surfaced).

## Issues Encountered
None.

## Known Stubs
None. `primary_tier: undefined` is the intended contract value (a normal room has no tier taxonomy; `scoreTechDimensions` handles undefined via the shipped `techFor` precedent), not a stub.

## User Setup Required
None - no external service configuration required. Local-only, zero egress (Canon Part 8).

## Next Phase Readiness
- Interface contract is stable for Plan 02: `buildRoomNativeSubstrate(db, opts)` returns `{meta, techMap, convergesPairs}`; Plan 02's runner passes its exported `catalogId` as `opts.canonicalId` and opens/owns the db handle.
- No blockers. The adapter is pure composition input; Plan 02 wires the additive `--pairs room` runner mode + the fire-and-return dispatcher on top of it.

## Self-Check: PASSED

- Files verified on disk: `lib/core/eureka/room-native-substrate.cjs`, `tests/test-216-room-substrate.cjs`, `216-01-SUMMARY.md`
- Commits verified in git log: `011ca87f` (test RED), `503b8e63` (feat GREEN), `eb488e5a` (test degenerate-room)

---
*Phase: 216-eureka-user-command*
*Completed: 2026-07-10*
