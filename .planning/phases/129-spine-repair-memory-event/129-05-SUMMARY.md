---
phase: 129-spine-repair-memory-event
plan: 05
subsystem: testing
tags: [memory-event, navigation-chokepoint, sqlite, fs-instrument, acceptance-test, follows-from, canon-part-9]

# Dependency graph
requires:
  - phase: 109-sql-context-memory-navigation-spine
    provides: tests/test-navigation-acceptance.cjs + tests/helpers/fs-instrument.cjs (the zero-non-SQLite-reads gate pattern this mirrors)
  - phase: 129-01-spine-repair-memory-event
    provides: spine-events.cjs log* helpers + 60s dedup + FOLLOWS_FROM edge re-exported on navigation.cjs
  - phase: 129-02
    provides: read-surface emission behavior suite (test-129-read-surface-events.cjs)
  - phase: 129-03
    provides: state-transition emission behavior suite (test-129-state-transition-events.cjs)
  - phase: 129-04
    provides: workflow-stage emission behavior suite (test-129-workflow-stage-events.cjs)
provides:
  - the load-bearing instrumented proactive-loop acceptance test (the Phase 129 release gate)
  - a minimal phase-129 fixture seed (room + 2 sections + 2 artifacts + 1 decision)
  - tests/run-all-129.sh scoped aggregator running all 5 phase-129 suites
  - a Phase 129 registration block in lib/memory/run-feynman-tests.cjs registering all 5 suites in CI
affects: [130-lens-engine-skeleton, 131-research-as-graph-aware-workflow-step]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Instrumented acceptance test: fs-instrument zero-reads gate spanning the full loop, with a per-test allow-list filter for the two named cache filenames on top of the helper's room.db allow-list"
    - "Exact-count + dedupe assertion pins event production: 4 new memory_event rows per loop pass, the repeated status spine_read dedupes inside the 60s TTL"
    - "Additive-tail Feynman-runner registration block (mirrors the Phase 124 / Phase 125 precedent), every existing entry byte-unchanged"

key-files:
  created:
    - tests/test-129-spine-acceptance.cjs
    - tests/fixtures/phase-129/sample-room/seed.sql
    - tests/run-all-129.sh
    - .planning/phases/129-spine-repair-memory-event/deferred-items.md
  modified:
    - lib/memory/run-feynman-tests.cjs

key-decisions:
  - "The acceptance test holds loop state (section/jtbd/operator) constant across the two status passes so the second spine_read carries the SAME derived dedupe_key and dedupes inside the 60s TTL, proving the repeat-render produces 0 new rows"
  - "The two cache filenames (jtbd-state.json, conversation-operator.json) are filtered OUT of fsInstrument.calls() per the 129-CONTEXT allow-list; the assertion is zero OTHER non-SQLite reads"
  - "The pre-existing Phase 122 e2e Canon Part 8 proximity-scan failure is OUT OF SCOPE (logged to deferred-items DI-129-05-01); Phase 129 touched no Phase 122 file"

patterns-established:
  - "Phase-129 acceptance assertion trio: (a) zero non-SQLite reads outside the cache files, (b) exact memory_event count + dedupe, (c) the next render reads the just-emitted events -- plus the FOLLOWS_FROM linkage"
  - "Aggregator + Feynman-runner registration are the two CI surfaces every phase test suite lands on"

requirements-completed: [SPINE-ACCEPTANCE, EVENT-CAP-5, NO-REGRESSION]

# Metrics
duration: ~30min
completed: 2026-05-31
---

# Phase 129 Plan 05: Instrumented Acceptance + Aggregator + Zero-Regression Summary

**The load-bearing instrumented proactive-loop acceptance test that proves Phase 129 closed the backward arc: the full loop (status -> suggest-next -> act entered/completed -> next status) produces exactly 4 memory_event rows with the repeated status deduped, zero non-SQLite filesystem reads outside the two named cache files, a FOLLOWS_FROM edge linking the act completed event to the act entered event, and the next status render reading the just-emitted events -- plus the Phase 129 aggregator and the Feynman-runner registration of all 5 suites.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-31
- **Completed:** 2026-05-31
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- `tests/test-129-spine-acceptance.cjs` drives the full proactive loop ONLY through the `lib/core/navigation.cjs` chokepoint (logSpineRead / logSuggestionSurfaced / logWorkflowStage), mirroring the Phase 109 `tests/test-navigation-acceptance.cjs` structure (node:assert/strict, direct-CJS, zero new npm deps, setupRoom / cleanup / run).
- The three LOAD-BEARING assertions all pass: (a) zero non-SQLite filesystem reads outside the two allow-listed cache files during the loop, (b) exactly 4 memory_event rows for one loop pass with the repeated status spine_read deduped inside the 60s TTL (1 spine_read + 1 suggestion_surfaced + 2 workflow_stage), (c) the next status render (findRecentChanges) reads the just-emitted events by id -- the backward arc is closed.
- A FOLLOWS_FROM edge is asserted to link the act completed event to the act entered event (the "one memory_event clearly follows another in the proactive loop" demonstration).
- A minimal phase-129 fixture seed (`tests/fixtures/phase-129/sample-room/seed.sql`) -- room + 2 sections + 2 artifacts + 1 decision -- trimmed from the phase-109 500-node seed to the minimum the loop touches; the two cache files are written by setupRoom pre-proxy so the getCurrent* fallback path has something to read.
- `tests/run-all-129.sh` (mirrors `run-all-128.sh`) runs all 5 phase-129 suites GREEN (5/5, ~18s); executable.
- `lib/memory/run-feynman-tests.cjs` carries an additive Phase 129 registration block registering all 5 suites in CI, every existing entry byte-unchanged.
- Zero regression on the surface Phase 129 owns: `tests/test-navigation-acceptance.cjs` (Phase 109) still exits 0.

## Task Commits

1. **Task 1: instrumented acceptance test + fixture seed** - `10ca89fc` (test) -- the full-loop acceptance test + phase-129 seed
2. **Task 2: aggregator + Feynman registration** - `6b516bca` (test) -- run-all-129.sh + the Phase 129 Feynman-runner block
3. **Deferred-items log** - `480e27e8` (docs) -- DI-129-05-01 (the pre-existing Phase 122 e2e failure)

**Plan metadata:** this SUMMARY + STATE.md + ROADMAP.md (docs commit).

## Files Created/Modified

- `tests/test-129-spine-acceptance.cjs` (created) - the instrumented proactive-loop acceptance test; the phase release gate.
- `tests/fixtures/phase-129/sample-room/seed.sql` (created) - minimal seeded room for the loop.
- `tests/run-all-129.sh` (created, executable) - Phase 129 scoped aggregator (5 suites).
- `.planning/phases/129-spine-repair-memory-event/deferred-items.md` (created) - DI-129-05-01.
- `lib/memory/run-feynman-tests.cjs` (modified) - additive Phase 129 registration block (5 suites).

## Decisions Made

- The loop holds section/jtbd/operator constant across the two status passes so the second `spine_read` carries the same derived `dedupe_key` and dedupes inside the 60s TTL. This makes the "repeat render emits 0 new rows" behavior testable numerically (4 total, not 5).
- The two cache filenames are filtered out of `fsInstrument.calls()` (the fs-instrument helper only allow-lists room.db; the two cache files are the EXPECTED getCurrent* fallback reads per 129-CONTEXT). The assertion is zero OTHER non-SQLite reads.
- The cache fixtures use the exact on-disk shapes the readers expect (`jtbd-state.json` = `{current:{jtbd,...}}`; `conversation-operator.json` = `{schema_version:'1.0.0', current:<valid enum>, ...}`) so getCurrentJTBD / getCurrentOperator resolve via the allow-listed cache fallback (source: 'cache_fallback') -- no jtbd_transitioned / operator_transitioned events were written this loop, so the event-log-authoritative path correctly defers to the cache.

## Deviations from Plan

None - plan executed exactly as written.

The one fixture detail not spelled out in the plan (the exact JSON shape of the two cache files) was resolved by reading the two cache readers (`lib/hmi/jtbd-state.cjs` getCurrent and `lib/conversation/operator.cjs` getCurrent) and matching their expected shapes -- this is fixture-internal correctness inside Task 1, not a plan deviation.

## Issues Encountered

- The first run failed `getCurrentJTBD resolves the seeded jtbd (got null)` because the initial cache-file fixtures used a flat shape. Fixed by matching the readers' expected shapes (jtbd-state.json needs a `current` wrapper; conversation-operator.json needs `schema_version` + a valid operator enum). All three LOAD-BEARING assertions had already passed before this fixture fix.

## Deferred Issues (out of scope -- see deferred-items.md)

- **DI-129-05-01:** The Phase 122 workflow-layer e2e test (`lib/memory/workflow-layer-e2e.test.cjs`) exits 1 on a Canon Part 8 proximity-scan over `lib/workflow/selector-decisions.cjs`. PROVEN pre-existing: with all Phase 129 changes stashed, it still fails on clean `main` HEAD. Both implicated files were last touched by Phase 125-07 and Phase 122-05 respectively; Phase 129 touched neither. Per the executor SCOPE BOUNDARY rule it is logged and deferred to a dedicated `/gsd:debug` session, not fixed here. The Phase 109 navigation acceptance test (the substrate Phase 129 extends) passes clean -- zero regression on the surface Phase 129 owns.

## User Setup Required

None - no external service configuration required. Zero new dependencies (node built-ins + bash only).

## Next Phase Readiness

- Phase 129 is COMPLETE: all 6 spine scripts journal their surface through navigation.cjs (Waves 1+2) and the instrumented acceptance test proves the backward arc is closed and leak-free (Wave 3). The phase release gate is GREEN.
- Phase 130 (lens-engine-skeleton) and Phase 131 (research-as-graph-aware-workflow-step) can adopt the memory_event emission + acceptance-instrumentation patterns established here.

## Self-Check: PASSED

- FOUND: tests/test-129-spine-acceptance.cjs
- FOUND: tests/fixtures/phase-129/sample-room/seed.sql
- FOUND: tests/run-all-129.sh
- FOUND: .planning/phases/129-spine-repair-memory-event/deferred-items.md
- FOUND commit: 10ca89fc (test Task 1)
- FOUND commit: 6b516bca (test Task 2)
- FOUND commit: 480e27e8 (docs deferred-items)

---
*Phase: 129-spine-repair-memory-event*
*Completed: 2026-05-31*
