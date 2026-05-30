---
phase: 130-lens-engine-skeleton
plan: 01
subsystem: database
tags: [navigation, room-db, sqlite, cascade-edges, lens-engine, hat-persistence, canon-part-4, canon-part-9]

# Dependency graph
requires:
  - phase: 109-sql-context-memory-navigation-spine
    provides: navigation.cjs chokepoint + the Phase-109 nodes provenance schema + openRoomDb
  - phase: 128-substrate-contract-adr
    provides: the M11 navigation export allow-list + the live substrate guard (check-substrate.cjs)
  - phase: 129-spine-repair-memory-event
    provides: the FOLLOWS_FROM additive-edge idiom + spine-events.cjs roomDir-taking sibling pattern
provides:
  - "INFORMS + REJECTED_BECAUSE on ALLOWED_EDGE_TYPES (closes review finding H2, the edge-allowlist bypass)"
  - "lib/core/navigation/lens-nodes.cjs: writeHatState / readHatState / readAllHatStates / writeLensFinding node-write chokepoint"
  - "navigation.cjs re-exports of the 4 lens-node writers/readers"
  - "SUBSTRATE-CONTRACT M11 allow-list amended (4 new export keys + Phase 130-01 amendment paragraph)"
  - "tests/run-all-130.sh aggregator + tests/test-130-lens-substrate.cjs (10 behavior tests)"
affects: [130-02 lens-engine, 130-03 hat-persistence-rewrite, 130-04, 116 tension-resolution, 131 research-as-graph]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Caller-owned db-handle node writers (lens-nodes.cjs mirrors edges.cjs writeEdge, NOT the roomDir-taking spine-events.cjs)"
    - "System-bookkeeping node write via Canon Part 9 v1.5 audit-node carve-out (created_by=system review_status=confirmed without human byUser)"
    - "Additive edge-enum extension with a per-phase comment block mirroring the FOLLOWS_FROM / OPERATOR_TRANSITION idiom"

key-files:
  created:
    - lib/core/navigation/lens-nodes.cjs
    - tests/test-130-lens-substrate.cjs
    - tests/run-all-130.sh
  modified:
    - lib/core/navigation/edges.cjs
    - lib/core/navigation.cjs
    - docs/architecture/SUBSTRATE-CONTRACT.md

key-decisions:
  - "lens-nodes.cjs takes a caller-owned db handle (like writeEdge), NOT a roomDir (unlike spine-events.cjs), so the engine can batch a node write and its INFORMS/REJECTED_BECAUSE edge on one handle"
  - "HatState node is system-bookkeeping (Canon Part 9 v1.5 carve-out): created_by=system review_status=confirmed is canon-legal without a human byUser"
  - "lens_finding node is review_status=proposed (awaiting the Decision Gate, never auto-confirmed)"

patterns-established:
  - "Lens node writers are the chokepoint door for Plan 02/03; the live substrate guard blocks any filesystem-mediated HatState write"

requirements-completed: [LENS-EDGE-ENUM, LENS-NODE-CHOKEPOINT, REJECTED-BECAUSE, INFORMS-EDGE, HATSTATE-NODE]

# Metrics
duration: 22min
completed: 2026-05-31
---

# Phase 130 Plan 01: Lens-Engine Skeleton Shared Substrate Summary

**Two net-new cascade edge types (INFORMS, REJECTED_BECAUSE) on the closed allowlist plus an allow-listed lens-nodes.cjs submodule that writes typed HatState + lens_finding nodes to room.db through a caller-owned db handle.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-05-31T (plan start)
- **Completed:** 2026-05-31
- **Tasks:** 3
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- Closed review finding H2: INFORMS was named in the shipped-vocabulary comment since Phase 129-01 but never actually in ALLOWED_EDGE_TYPES, so writeEdge would have rejected it. INFORMS + REJECTED_BECAUSE are now members.
- Shipped lib/core/navigation/lens-nodes.cjs: the typed HatState + lens-finding node-write chokepoint, taking a caller-owned db handle (zero node:sqlite require, never opens room.db) so it stays inside the navigation allow-list with zero substrate bypass.
- navigation.cjs re-exports the 4 writers/readers; the SUBSTRATE-CONTRACT M11 allow-list carries the 4 new export keys plus a Phase 130-01 amendment paragraph (the amendment rule is honored).
- Zero regression: the Phase 129 spine substrate suite and the Phase 109 navigation acceptance suite both still pass after the additive edges.cjs + navigation.cjs changes.

## Task Commits

Each task was committed atomically (TDD: RED then GREEN):

1. **RED test suite** - `3976140c` (test) - 10 behavior tests across Task 1 + Task 2, failing because lens-nodes.cjs is absent and the two edge types are not yet in the Set
2. **Task 1: INFORMS + REJECTED_BECAUSE edge enum (close H2)** - `4c8f4a91` (feat)
3. **Task 2: lens-nodes.cjs chokepoint + navigation re-exports + M11 amendment** - `1b07ae65` (feat)
4. **Task 3: run-all-130.sh aggregator + zero-regression gate** - `1de18e10` (test)

_TDD note: the RED suite covers both Task 1 and Task 2 behaviors (they share one test file); GREEN was reached in two feat commits._

## Files Created/Modified
- `lib/core/navigation/lens-nodes.cjs` - the 4 lens-node writers/readers; mirrors ingestion.cjs INSERT shape; defensive, never throws on caller input
- `tests/test-130-lens-substrate.cjs` - 10 behavior tests (edge enum floor + writes, HatState round-trip, color rejection, readAllHatStates defaults, lens_finding write, no-direct-sqlite + no-em-dash source grep, navigation re-export presence)
- `tests/run-all-130.sh` - phase-130 scoped aggregator mirroring run-all-129.sh; executable
- `lib/core/navigation/edges.cjs` - INFORMS + REJECTED_BECAUSE added with a Phase 130-01 additive comment block
- `lib/core/navigation.cjs` - re-exports the 4 lens-node functions with a per-export justification block
- `docs/architecture/SUBSTRATE-CONTRACT.md` - M11 allow-list + Phase 130-01 amendment paragraph

## Decisions Made
- lens-nodes.cjs takes a caller-owned db handle (like edges.cjs writeEdge), deliberately NOT a roomDir (unlike spine-events.cjs). Rationale: Plan 02's onAccept needs to write a lens_finding node AND an INFORMS edge from it on the same handle; a db-handle signature keeps both writes on one open/close.
- HatState node carries created_by=system review_status=confirmed without a human byUser, cited in-source as the Canon Part 9 v1.5 audit-node carve-out (HatState is system-bookkeeping, not in the truth-claim set).
- lens_finding node is review_status=proposed (it is a surface awaiting the Decision Gate, never auto-confirmed truth).

## Deviations from Plan

None - plan executed exactly as written. INFORMS + REJECTED_BECAUSE added; lens-nodes.cjs created with the 4 documented exports; navigation re-exports and the M11 amendment landed; ASSOCIATION_LENS / TRANSITION_LENS stay rejected per the dual-graph verdict; zero em-dashes across all touched files; commits passed the live substrate guard with no --no-verify.

## Issues Encountered
None. The Phase-109 nodes provenance schema CHECK constraint (created_by IN the closed set, review_status IN the closed set) accepted created_by='system' and review_status of 'confirmed'/'proposed' as expected; the source_path NOT NULL column is supplied by both writers.

## Known Stubs
None. Both writers perform real room.db inserts; readHatState / readAllHatStates round-trip real rows and return canonical defaults for unwritten colors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 02 (lens-engine.cjs) has a canon-legal door for every edge + node write it needs: INFORMS (onAccept), REJECTED_BECAUSE (onReject), lens_finding (the node INFORMS points FROM), all through navigation.cjs.
- Plan 03 (hat-persistence.cjs rewrite) has writeHatState / readHatState / readAllHatStates to RETIRE the filesystem .mindrian/hats/{color}/STATE.md writes to typed HatState nodes.
- run-all-130.sh is wired so Plans 02/03/04 append their suites.

## Self-Check: PASSED

---
*Phase: 130-lens-engine-skeleton*
*Completed: 2026-05-31*
