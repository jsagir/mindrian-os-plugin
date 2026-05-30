---
phase: 129-spine-repair-memory-event
plan: 01
subsystem: api
tags: [memory-event, navigation-chokepoint, sqlite, idempotency, cascade-edges, canon-part-9]

# Dependency graph
requires:
  - phase: 109-sql-context-memory-navigation-spine
    provides: navigation.cjs closed chokepoint + memory_event node type + EVENT_TYPES Set + logEvent/findRecentChanges
  - phase: 125-graph-native-f-selector
    provides: writeEdge + ALLOWED_EDGE_TYPES Set on navigation/edges.cjs
  - phase: 128-substrate-contract-adr
    provides: SUBSTRATE-CONTRACT.md M11 allow-list + live check-substrate.cjs guard (net-new-aware)
provides:
  - 5 net-new canonical spine memory_event types (spine_read, jtbd_transitioned, operator_transitioned, workflow_stage, suggestion_surfaced)
  - FOLLOWS_FROM as the 8th cascade edge type (enum-only properties)
  - 60-second idempotency layer inside logEvent (keyed on payload.dedupe_key, clock-seamed)
  - lib/core/navigation/spine-events.cjs -- 5 roomDir-taking log* helpers + getCurrentJTBD/getCurrentOperator
  - navigation.cjs re-exports of the 7 spine helpers
affects: [129-02, 129-03, 129-04, 130-lens-engine-skeleton, 131-research-as-graph-aware-workflow-step]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "roomDir-taking navigation submodule that opens/closes room.db internally (mirrors dashboard-helpers.cjs) so non-allowlisted callers never touch room.db directly"
    - "Clock-seamed (opts.now) dedup with an in-DB lookup keyed on a payload-supplied dedupe_key; absent the key, dedup is OFF (back-compat)"
    - "Event-log-authoritative getters with cache-file fallback (source: 'event_log' | 'cache_fallback')"

key-files:
  created:
    - lib/core/navigation/spine-events.cjs
    - tests/test-129-spine-substrate.cjs
  modified:
    - lib/core/navigation/memory-events.cjs
    - lib/core/navigation/edges.cjs
    - lib/core/navigation.cjs
    - docs/architecture/SUBSTRATE-CONTRACT.md

key-decisions:
  - "EVENT_TYPES grows by EXACTLY 5 net-new spine types (the v1.13.1 risk-3 event-cap-5 lock); status_rendered+memory_inspected consolidate into spine_read, set/override/clear into jtbd_transitioned, act+pipeline into workflow_stage"
  - "Dedup is opt-in via payload.dedupe_key so every pre-129 logEvent caller keeps writing every event byte-unchanged"
  - "spine-events.cjs lives under lib/core/navigation/ which is already in the substrate-guard allow-list; the 6 spine scripts (Wave 2) reach room.db ONLY through these helpers"
  - "getCurrentJTBD/getCurrentOperator make the event log authoritative; the cache file (jtbd-state.json / conversation-operator.json) is the fallback, NOT deprecated this phase"

patterns-established:
  - "Spine helper API: log<Surface>(roomDir, payload) opens room.db, logs the right memory_event, closes; returns {ok:false,reason:'no_room_db'} when absent"
  - "Optional FOLLOWS_FROM emission: when payload.follows_from is set, write an enum-only FOLLOWS_FROM edge (new event -> prior event); additive, never load-bearing"

requirements-completed: [SPINE-EVENTS, FOLLOWS-FROM, EVENT-CAP-5, STATE-AUTHORITY, IDEMPOTENCY-60S]

# Metrics
duration: ~35min
completed: 2026-05-30
---

# Phase 129 Plan 01: Spine Repair Memory-Event Substrate Summary

**The Wave-1 shared substrate: 5 net-new canonical spine memory_event types, FOLLOWS_FROM as the 8th cascade edge, a 60s idempotency layer in logEvent, and the roomDir-taking spine-events.cjs helper API that lets the 6 non-allowlisted spine scripts reach room.db only through navigation.cjs.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-05-30
- **Tasks:** 2 (both TDD)
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- EVENT_TYPES carries exactly 5 net-new spine strings (delta-of-5 enforced by named-membership test, not a brittle absolute size) honoring the v1.13.1 risk-3 event-cap-5 lock.
- FOLLOWS_FROM is the 8th canonical cascade edge type; lens-class taxonomy (ASSOCIATION_LENS/TRANSITION_LENS) stays rejected.
- logEvent now dedupes same-key spine emissions inside a 60s TTL (clock-seamed for deterministic tests) while leaving no-dedupe-key callers byte-unchanged.
- spine-events.cjs ships 5 log* helpers that open/close room.db internally (callers pass roomDir, never a db handle), graceful no_room_db, deterministic per-helper dedupe_key, and optional FOLLOWS_FROM emission.
- getCurrentJTBD/getCurrentOperator are event-log-authoritative with cache-file fallback.
- navigation.cjs re-exports all 7 helpers; SUBSTRATE-CONTRACT.md M11 allow-list + amendment line added per the M11 rule.
- spine-events.cjs passes the live substrate guard (it is allow-listed under lib/core/navigation/); Phase 109 acceptance test still green (zero regression).

## Task Commits

1. **RED test suite** - `67250de1` (test) -- 15-test RED-first behavior suite
2. **Task 1: enums + 60s dedup** - `bce99900` (feat) -- 5 event types, FOLLOWS_FROM, logEvent dedup
3. **Task 2: spine-events.cjs + re-exports** - `e5b83304` (feat) -- helper API, navigation.cjs wiring, ADR amendment

_TDD note: the suite was committed RED first (67250de1), then Task 1 and Task 2 turned it GREEN. Both feat commits passed the live pre-commit substrate guard._

## Files Created/Modified

- `lib/core/navigation/spine-events.cjs` (created) - 5 roomDir-taking log* helpers + getCurrentJTBD/getCurrentOperator; opens room.db internally; FOLLOWS_FROM emission; cache fallback.
- `tests/test-129-spine-substrate.cjs` (created) - 15 behavior tests covering the 5 types, delta-of-5, FOLLOWS_FROM allow/reject, dedup window + TTL + no-key back-compat, helper API, event-log-authority + cache fallback, FOLLOWS_FROM emission, navigation end-to-end.
- `lib/core/navigation/memory-events.cjs` (modified) - 5 net-new event strings + 60s-TTL dedup in logEvent (clock-seamed via opts.now).
- `lib/core/navigation/edges.cjs` (modified) - FOLLOWS_FROM added to ALLOWED_EDGE_TYPES.
- `lib/core/navigation.cjs` (modified) - re-exports the 7 spine helpers with per-export justification.
- `docs/architecture/SUBSTRATE-CONTRACT.md` (modified) - 7 export lines added to the M11 allow-list + a Phase 129-01 amendment line.

## Decisions Made

- Event-cap-5: consolidated status_rendered+memory_inspected -> spine_read (payload.surface enum), set/override/clear -> jtbd_transitioned (payload.kind enum), act dispatch/completion + pipeline entered/completed -> workflow_stage (payload.surface + payload.phase enums). operator_transitioned and suggestion_surfaced stand alone. Net-new count is exactly 5.
- Dedup is opt-in (payload.dedupe_key) so existing callers stay byte-unchanged; the log helpers derive a deterministic dedupe_key from scalar state so 10x /mos:status with no state change dedupes inside 60s.
- FOLLOWS_FROM properties are enum-only (a surface scalar) per Canon Part 8; the emission tolerates writeEdge failure and never blocks the log write.

## Deviations from Plan

None - plan executed exactly as written. One incidental test fix (seeding the two FK-referenced nodes before the FOLLOWS_FROM writeEdge assertion, since edges carry a FOREIGN KEY to nodes(id)) was made within the RED test before the GREEN commit; it is test-internal correctness, not a plan deviation.

## Issues Encountered

- The edges table enforces `FOREIGN KEY (source/target) REFERENCES nodes(id)` with `PRAGMA foreign_keys = ON`. The standalone FOLLOWS_FROM-allowed test used placeholder node ids; it now seeds those nodes first. The FOLLOWS_FROM-emission test was already correct because it references real memory_event node ids returned by the log helpers.

## User Setup Required

None - no external service configuration required. Zero new dependencies (node built-ins only).

## Next Phase Readiness

- Wave 2 plans (129-02 / 129-03 / 129-04) can now refactor the 6 spine scripts to call navigation.logSpineRead / logJtbdTransition / logOperatorTransition / logWorkflowStage / logSuggestionSurfaced and read state via navigation.getCurrentJTBD / getCurrentOperator -- all roomDir-only, no direct room.db access.
- The substrate guard is live and net-new-aware; the spine scripts (NOT allow-listed) must route every room.db touch through these helpers or the guard will block the commit.

## Self-Check: PASSED

- FOUND: lib/core/navigation/spine-events.cjs
- FOUND: tests/test-129-spine-substrate.cjs
- FOUND: .planning/phases/129-spine-repair-memory-event/129-01-SUMMARY.md
- FOUND commit: 67250de1 (test RED)
- FOUND commit: bce99900 (feat Task 1)
- FOUND commit: e5b83304 (feat Task 2)

---
*Phase: 129-spine-repair-memory-event*
*Completed: 2026-05-30*
