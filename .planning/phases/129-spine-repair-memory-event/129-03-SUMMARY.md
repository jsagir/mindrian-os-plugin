---
phase: 129-spine-repair-memory-event
plan: 03
subsystem: spine-scripts
tags: [memory-event, navigation-chokepoint, jtbd, operator, substrate-bypass-retirement, canon-part-9, canon-part-4]

# Dependency graph
requires:
  - phase: 129-01
    provides: navigation.logJtbdTransition / logOperatorTransition (roomDir-only helpers) + writeEdge + getCurrentJTBD/getCurrentOperator
  - phase: 128-substrate-contract-adr
    provides: live net-new-aware check-substrate.cjs guard + the baselined 195-violation ledger (operator.cjs was one entry)
  - phase: 125-graph-native-f-selector
    provides: writeEdge + ALLOWED_EDGE_TYPES Set on navigation/edges.cjs
provides:
  - "/mos:jtbd emits jtbd_transitioned on every confirmed set/clear/override (cache still updates)"
  - "/mos:operator emits operator_transitioned exactly once per transition (single emission site = operator.cjs transition())"
  - "OPERATOR_TRANSITION as a 9th ALLOWED_EDGE_TYPE; the edge now writes through navigation.cjs into .mindrian/room.db"
  - "lib/conversation/operator.cjs node:sqlite + raw INSERT bypass RETIRED (baselined Phase 128 violation closed)"
affects: [129-04, 129-05, 130-lens-engine-skeleton]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Best-effort post-side-effect emission: emit AFTER the cache write + re-read confirmation, BEFORE stdout, wrapped in try/catch so telemetry never blocks the user render"
    - "Single emission site for a transition event: operator.cjs transition() owns operator_transitioned (CLI + non-CLI callers all flow through it) so there is exactly one event per transition, no double-emit"
    - "Edge write through the chokepoint with FK-safe node seeding: logOperatorTransition seeds operator:<NAME> nodes then writeEdge OPERATOR_TRANSITION (enum-only props per Canon Part 8)"

key-files:
  created:
    - tests/test-129-state-transition-events.cjs
  modified:
    - scripts/jtbd-command.cjs
    - scripts/operator-command.cjs
    - scripts/operator-update.cjs
    - lib/conversation/operator.cjs
    - lib/core/navigation/edges.cjs
    - lib/core/navigation/spine-events.cjs
    - tests/test-operator-state.cjs

key-decisions:
  - "operator.cjs transition() is the SOLE operator_transitioned emission site (not the script layer); guarantees exactly-one-per-transition for CLI, hook, and MVA-router callers alike, mitigating the double-emit repudiation threat T-129-03-03"
  - "OPERATOR_TRANSITION edge writes through navigation.logOperatorTransition with payload.write_transition_edge:true; spine-events seeds operator:<NAME> nodes (FK to nodes(id)) then writeEdge with ENUM-ONLY props (trigger), dropping the old freeform timestamp/methodology props per Canon Part 8"
  - "jtbd kind enum = 'override' when the PRIOR state had an active (non-expired) manual sticky window (via jtbd-state _internal.manualOverrideActive), else 'set'; 'clear' on the clear subcommand"
  - "the edge migrates from the retired .room-graph/room.db target to the canonical .mindrian/room.db; operator-state scenario 12 was updated to assert the new chokepoint contract (it had encoded the bypass behavior)"

patterns-established:
  - "Spine script transition emission: capture prior state -> run the existing cache write/transition -> re-read/confirm -> navigation.log*Transition(roomDir, payload) best-effort -> render"

requirements-completed: [SPINE-EVENTS, STATE-AUTHORITY, FOLLOWS-FROM]

# Metrics
duration: ~40min
completed: 2026-05-30
---

# Phase 129 Plan 03: State-Transition Memory Events + operator.cjs Bypass Retirement Summary

**The 2 STATE-TRANSITION spine scripts now journal every transition to the canonical event log, and the baselined Phase 128 direct-sqlite OPERATOR_TRANSITION bypass in lib/conversation/operator.cjs is retired by routing its edge + event through the navigation.cjs chokepoint.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-05-30
- **Tasks:** 2 (both TDD)
- **Files:** 7 (1 created, 6 modified)

## Accomplishments

- `/mos:jtbd set` emits exactly one `jtbd_transitioned` with `kind=set` (or `kind=override` when the prior state carried an active sticky window), `from`/`to`/`confidence`, `trigger=manual_set` -- only after the re-read confirms `newState.jtbd === arg`. The `jtbd-state.json` cache still updates byte-for-byte (no deprecation).
- `/mos:jtbd clear` emits `jtbd_transitioned` with `kind=clear`, `to=null`, `trigger=manual_clear` after `mod.clear` succeeds.
- No event fires on a rejected jtbd (unknown id -> non-zero exit, zero events).
- `/mos:operator set` + `reset --confirm` emit `operator_transitioned` (`from`/`to`/`trigger`) exactly once per transition; no event on a no-op (already-in-target) set.
- `lib/conversation/operator.cjs` no longer does `require('node:sqlite')` or raw `INSERT OR IGNORE INTO edges` -- `writeOperatorTransitionEdge` is replaced by `emitOperatorTransition`, which routes the event + the typed `OPERATOR_TRANSITION` edge through `navigation.logOperatorTransition(... write_transition_edge:true)`. The substrate guard goes clean on it (the load-bearing bypass retirement).
- `OPERATOR_TRANSITION` is added to `ALLOWED_EDGE_TYPES`; the edge still lands after every successful transition, now in the canonical `.mindrian/room.db` between `operator:<FROM>` and `operator:<TO>` nodes with enum-only properties.
- The event log is authoritative; the JSON cache files (`jtbd-state.json`, `conversation-operator.json`) stay as fast-read fallbacks (per `navigation.getCurrentJTBD/getCurrentOperator`).

## Task Commits

1. **RED test suite** - `e2e5b90c` (test) -- 13-test RED-first behavior suite (jtbd set/clear/override, operator set/reset, no-op/rejected guards, bypass-retirement + substrate + allowed-edge assertions)
2. **Task 1: jtbd_transitioned emission** - `4f7eb97b` (feat) -- lazy navigation loader + best-effort emission on confirmed set/clear/override in scripts/jtbd-command.cjs
3. **Task 2: operator_transitioned + bypass retirement** - `a6ca075a` (feat) -- OPERATOR_TRANSITION allowed-edge + spine-events edge-write extension + operator.cjs reroute (single emission site) + operator-state scenario-12 chokepoint update + operator-update doc fix

_TDD note: the suite was committed RED first (e2e5b90c, 3 passed / 10 failed), then Task 1 and Task 2 turned it GREEN (13/13). Both feat commits passed the live pre-commit substrate guard (no --no-verify)._

## Files Created/Modified

- `tests/test-129-state-transition-events.cjs` (created) -- 13 behavior tests; exercises the two command scripts as child processes with `CLAUDE_ACTIVE_ROOM` pinned to a hermetic tmpdir room, asserting event counts/props, cache writes, no-op/rejected guards, the bypass retirement, the substrate guard, the allowed-edge-type, and that the OPERATOR_TRANSITION edge lands.
- `scripts/jtbd-command.cjs` (modified) -- lazy `loadNavigation` + `emitJtbdTransition`; emission added to the `set` (kind set/override) and `clear` (kind clear) success branches.
- `scripts/operator-command.cjs` (modified) -- header comment only (emission is owned by operator.cjs transition(), so the script adds none -- prevents double-emit). [No functional change beyond doc clarity; the substrate guard re-scans it clean.]
- `scripts/operator-update.cjs` (modified) -- stale doc comment repointed from `.room-graph/room.db` to the `.mindrian/room.db` chokepoint contract.
- `lib/conversation/operator.cjs` (modified) -- retired `writeOperatorTransitionEdge` (node:sqlite + raw INSERT into `.room-graph/room.db`); replaced with `emitOperatorTransition` routing through `navigation.logOperatorTransition`; `transition()` is the single emission site; `_internal` export updated.
- `lib/core/navigation/edges.cjs` (modified) -- `OPERATOR_TRANSITION` added to `ALLOWED_EDGE_TYPES` (additive-comment idiom).
- `lib/core/navigation/spine-events.cjs` (modified) -- `logOperatorTransition` extended with `_emitWithOperatorEdge`: seeds the two `operator:<NAME>` nodes then writes the typed OPERATOR_TRANSITION edge in the same room.db open/close, gated on `payload.write_transition_edge`.
- `tests/test-operator-state.cjs` (modified) -- scenario 12 rewritten to assert the new chokepoint contract (edge in `.mindrian/room.db`, `operator:<NAME>` node ids, enum-only props, plus the co-landed `operator_transitioned` event); `setupGraph` replaced with `setupCanonicalGraph` (openRoomDb).

## Decisions Made

- **Single emission site:** operator.cjs `transition()` owns `operator_transitioned` emission for ALL callers (CLI scripts, hooks, the MVA option router). The scripts emit nothing separately. This is the cleanest guarantee of exactly-one-event-per-transition and directly mitigates the double-emit repudiation threat (T-129-03-03). jtbd has no shared transition() chokepoint, so its emission lives in the script's set/clear success branches.
- **Edge through the chokepoint, FK-safe:** `logOperatorTransition` seeds `operator:<NAME>` nodes (the edges table carries `FOREIGN KEY (source/target) REFERENCES nodes(id)` with foreign_keys ON) before `writeEdge`. Properties are enum-only (`trigger`), dropping the old freeform `timestamp`/`methodology` payload per Canon Part 8.
- **override detection:** reuses `jtbd-state _internal.manualOverrideActive(priorState)` so `kind='override'` fires exactly when a re-set lands over a still-active sticky window.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] operator-state scenario 12 encoded the retired bypass behavior**
- **Found during:** Task 2 (regression sweep)
- **Issue:** `tests/test-operator-state.cjs` scenario 12 set up `.room-graph/room.db` and asserted the OPERATOR_TRANSITION edge + freeform `timestamp`/`methodology` props there -- the exact behavior this plan retires. It failed (0 edges) once the bypass was routed through the chokepoint.
- **Fix:** rewrote scenario 12 to seed the canonical `.mindrian/room.db` (openRoomDb) and assert the new contract: edge between `operator:BUILD_ROOM` and `operator:METHODOLOGY`, enum-only `trigger` prop, no freeform fields, plus the co-landed `operator_transitioned` memory_event. Replaced the `setupGraph` helper with `setupCanonicalGraph`.
- **Files modified:** tests/test-operator-state.cjs
- **Commit:** a6ca075a

**2. [Rule 3 - Blocking] substrate guard m4 false-positive on an operator.cjs stderr log line**
- **Found during:** Task 2
- **Issue:** the guard's Cypher-interpolation rule (`/MATCH\b[^`]*\$\{...\}/i`) matched the substring inside `schema_version mismatch: got ${parsed.schema_version}, expected ${SCHEMA_VERSION}` (the case-insensitive `\bMATCH\b` caught "match" with a `${...}` on the same line). operator.cjs is NOT allowlisted, so Task 2 required it clean.
- **Fix:** reworded the stderr line to `schema_version differs: found ... wanted ...` (no behavior change; a diagnostic string). Also reworded the new header comment so it does not contain a literal `require('node:sqlite')` call form (which the m3 rule + the test's own regex would catch as prose).
- **Files modified:** lib/conversation/operator.cjs
- **Commit:** a6ca075a

## Issues Encountered

- The test harness initially asserted `cache.jtbd` but `jtbd-state.json` nests the live value under `current` -- corrected to `cache.current.jtbd` (test-internal fix, within the RED suite before GREEN).
- `resolve-active-room.cjs` honors `CLAUDE_ACTIVE_ROOM` (not `MINDRIAN_ACTIVE_ROOM`) as the highest-precedence explicit-path override; the child-process test env was pointed accordingly.

## User Setup Required

None -- zero new dependencies (node built-ins only). No external service configuration.

## Next Phase Readiness

- 129-04 (act + pipeline `workflow_stage` with FOLLOWS_FROM chaining) reuses the identical post-side-effect, navigation-routed, best-effort emission pattern established here and in 129-02.
- The substrate guard is clean on all 4 Wave-2 state/read spine scripts to date (jtbd-command, operator-command, mos-status, suggest-next, memory-command) plus the now-rerouted operator.cjs; the baselined 195-violation ledger is reduced by one (operator.cjs closed).

## Self-Check: PASSED

- FOUND: tests/test-129-state-transition-events.cjs
- FOUND: scripts/jtbd-command.cjs (modified)
- FOUND: lib/conversation/operator.cjs (modified)
- FOUND: lib/core/navigation/edges.cjs (modified)
- FOUND commit: e2e5b90c (test RED)
- FOUND commit: 4f7eb97b (feat Task 1)
- FOUND commit: a6ca075a (feat Task 2)

---
*Phase: 129-spine-repair-memory-event*
*Completed: 2026-05-30*
