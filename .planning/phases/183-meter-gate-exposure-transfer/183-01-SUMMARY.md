---
phase: 183-meter-gate-exposure-transfer
plan: 01
subsystem: telemetry
tags: [memory_event, navigation-chokepoint, gate_reached, two-gauge, part-8-local, meter]

# Dependency graph
requires:
  - phase: 109-sql-context-memory-navigation-spine
    provides: navigation.cjs memory_event chokepoint (logMemoryEvent / findRecentChanges) + frozen EVENT_TYPES Set
  - phase: 158-reach-reject-reader
    provides: reach_presented emission seam + the pure-reader injection-seam idiom
  - phase: 180-canon-31-two-gauge-metric
    provides: the v1.19 welded two-gauge contract (Appendix D entry 31) the meter instruments
provides:
  - gate_reached additive EVENT_TYPES member (86 -> 87) written once per engine-arm gate render
  - the surface-shared gate_reached emit at scripts/intent-classifier.cjs (deduped on the turn handle)
  - lib/core/meter/gate-density-reader.cjs (Gauge 1 invocation-density pure reader)
  - tests/run-all-183.sh phase aggregator + 5 meter test stubs (Wave 0 RED pins)
affects: [184-reader, 183-02-transfer-and-two-gauge-weld]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure reader over the memory_event log via navigation.findRecentChanges with a roomState injection seam (mirrors reach-reject-reader.cjs)"
    - "Gate-reach as a single additive memory_event marker beside the live reach_presented loop, deduped on the turn-start handle"
    - "Floor test asserts named membership + full prior floor, never a raw member count"

key-files:
  created:
    - lib/core/meter/gate-density-reader.cjs
    - tests/run-all-183.sh
    - tests/test-meter-gate-reach.cjs
    - tests/test-meter-density.cjs
    - tests/test-meter-event-types-floor.cjs
    - tests/test-meter-transfer.cjs
    - tests/test-meter-two-gauge-weld.cjs
  modified:
    - lib/core/navigation/memory-events.cjs
    - scripts/intent-classifier.cjs

key-decisions:
  - "Emit ONE additive gate_reached marker (Option A) rather than deriving gate-reach from reach_presented rows (Option B) - gives a clean per-turn count and a per-turn routing_source"
  - "Dedupe the gate_reached emit on the turn-start handle (startedAt) since no correlation/turn id is carried in decision_trace - the cleanest in-scope turn-stable key"
  - "Gauge-1 density basis leans on reach_presented + gate_reached (events that fire); framework_invocations is an additive term reading ~0 today (Open Question 1 verified: framework_invoked is read, never emitted at a production site)"
  - "denominator_unit = 'gate_reached' (Open Question 2: the cleanest per-turn unit)"

patterns-established:
  - "Pattern: additive EVENT_TYPES member via the verbatim Phase 181 1-string idiom; floor-not-size test contract keeps the addition safe"
  - "Pattern: Part 8 grep-sweep in the phase aggregator scopes the intent-classifier check to a BOUNDED emit-seam window (not the whole file, which carries network tokens elsewhere)"

requirements-completed: [METER-01]

# Metrics
duration: 18min
completed: 2026-06-27
---

# Phase 183 Plan 01: METER Gate-Exposure (Gauge 1) Summary

**Gate-reach is now a real LOCAL number: one additive gate_reached memory_event per engine-arm gate render (deduped on the turn), plus the Gauge-1 invocation-density reader over the Part 9 chokepoint - the welded two-gauge instrument's volume half, zero Brain egress.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-06-27
- **Completed:** 2026-06-27
- **Tasks:** 3
- **Files modified:** 9 (7 created, 2 modified)

## Accomplishments
- `gate_reached` added to the frozen `EVENT_TYPES` Set via the verbatim additive idiom (86 -> 87), with a Part 9 audit-node-carve-out comment block.
- One surface-shared `gate_reached` emit at `scripts/intent-classifier.cjs`, beside the live `reach_presented` loop, guarded by `offered.length > 0`, deduped on the turn-start handle, enum/scalar payload only. Answers "does a navigator reach the decide() gate" with a real number, surface-agnostic (CLI / Desktop / Cowork), zero dependence on any Brain request count.
- `lib/core/meter/gate-density-reader.cjs` - the Gauge-1 invocation-density pure reader (counts gate_reached + reach_presented + framework_invoked via `findRecentChanges`, cold-starts safely, makes no remote call, no bare-density export).
- The full phase Wave-0 test scaffold: `tests/run-all-183.sh` + 5 meter stubs, with the Part 8 grep-sweep and the reach-ids/posture-ids drift fences wired into the aggregator.

## Task Commits

1. **Task 1: Wave 0 scaffold (RED pins + aggregator)** - `0d08fff3` (test)
2. **Task 2: gate_reached EVENT_TYPES member + engine-arm emit** - `e0d46f51` (feat)
3. **Task 3: Gauge-1 invocation-density reader** - `3d650ede` (feat)

_TDD note: the Wave-0 RED pins from Task 1 served as the RED gate for Tasks 2 and 3; each implementation task turned its pins green (the GREEN gate)._

## Files Created/Modified
- `lib/core/navigation/memory-events.cjs` - added the `gate_reached` additive EVENT_TYPES member (86 -> 87).
- `scripts/intent-classifier.cjs` - the single `gate_reached` emit on the surface-shared engine arm.
- `lib/core/meter/gate-density-reader.cjs` - Gauge-1 invocation-density reader.
- `tests/run-all-183.sh` - phase aggregator (5 pins + Part 8 grep-sweep + drift fences).
- `tests/test-meter-gate-reach.cjs`, `tests/test-meter-density.cjs`, `tests/test-meter-event-types-floor.cjs` - the Plan-01 pins (now green).
- `tests/test-meter-transfer.cjs`, `tests/test-meter-two-gauge-weld.cjs` - the Plan-02 pins (RED until Plan 02 builds transfer-reader.cjs + two-gauge.cjs).

## Decisions Made
- **Option A (additive marker) over Option B (derive):** a single `gate_reached` marker gives a clean per-turn gate count and a per-turn `routing_source`, where deriving from 3 `reach_presented` rows per gate would only yield a coarser count.
- **Dedupe on `startedAt`:** decision_trace carries no correlation/turn id; the turn-start timestamp is the cleanest in-scope, turn-stable key, paired with logEvent's 60s idempotency window.
- **Density basis = reach_presented + gate_reached, framework_invoked additive (~0):** verified Open Question 1 - `framework_invoked` is read by `_invocationsSinceDecision`/`computeInvestmentLevel` but fires at no production emission site today.
- **denominator_unit = 'gate_reached':** the cleanest per-turn unit (Open Question 2), so a downstream transfer-per-invocation reading divides by the same unit.

## Deviations from Plan

None - plan executed exactly as written. The transfer + two-gauge-weld pins remain RED by design (they are Plan 02's targets); the aggregator therefore reports 6 passed / 2 failed, which is the intended Plan-01 state.

## Issues Encountered
- The Task-1 acceptance `grep -c "\.size"` initially returned 1 because a header comment in the floor test contained the literal token `.size`. Reworded the comment to "a raw member count" so the floor test carries no `.size` literal. Resolved before the Task-1 commit.

## Canon Compliance
- **Frozen-set discipline:** the ONLY frozen-set change is the single `gate_reached` string (86 -> 87) via the additive idiom. No new reach/node/edge/posture type. reach-ids (frozen 6) + posture-ids (frozen 3) drift fences green.
- **Part 8 LOCAL-only:** the grep-sweep over `lib/core/meter/` + the bounded gate_reached emit seam returns zero network tokens; payloads carry counts/enums/ids only.
- **Frozen render contracts untouched:** MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the 6-reach bank, `appendAskUserQuestionTrailer` - the gate_reached emit is an OBSERVATION beside the render and changes nothing about what is offered.
- **No em-dashes** introduced (hyphens only) in code, comments, or commit messages.

## Next Phase Readiness
- Plan 02 (METER-02) builds `lib/core/meter/transfer-reader.cjs` (the three named-debt Gauge-2 source proxies) and `lib/core/meter/two-gauge.cjs` (the welded read), which turn the two remaining RED pins green.
- Phase 184 READER is CONDITIONAL on METER showing a gate subject; the gate_reached signal + the Gauge-1 reader are the precondition substrate for that gate.
- The v1.19 self-binding clause (no Appendix D entry 32 until a real two-gauge reading from a live navigator) waits on the welded read landing in Plan 02 plus a live-navigator reading (the manual verification in 183-VALIDATION.md).

## Self-Check: PASSED

All created files exist on disk (gate-density-reader.cjs, run-all-183.sh, 5 meter test stubs, 183-01-SUMMARY.md) and all three task commits are present in git history (0d08fff3, e0d46f51, 3d650ede).

---
*Phase: 183-meter-gate-exposure-transfer*
*Completed: 2026-06-27*
