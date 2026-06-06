---
phase: 143-insight-sensors-the-7-row-trigger-map
plan: 01
subsystem: sensors
tags: [insight-sensors, trigger-map, reach-ids, dispatch-chokepoint, part-8, phase-144-fence, loop-fires]

# Dependency graph
requires:
  - phase: 141-local-retrieval-spine-and-capability-dial
    provides: the 5 reach-ids + 3 posture-ids dial doctrine (LARRY-03/D-12, exactly-5/exactly-3 drift contracts)
  - phase: 117-auto-explore-domains-on-first-material
    provides: the shipped first-material auto-explore fire path (scripts/auto-explore-fire.cjs) SENS-01 surfaces
  - phase: 142-local-intelligence-wiring-compute-store-and-act
    provides: the shipped CASC-01 cascade side-channel (last-cascade.json) SENS-06 reads
provides:
  - lib/core/insight-sensors.cjs -- the pure/sync/LOCAL dispatchSensors chokepoint + SENSOR_REGISTRY + SENS-01/SENS-06 sensors
  - lib/core/sensors/sensor-types.cjs -- REACH_IDS (5) + POSTURE_IDS (3) frozen banks + makeReach candidate-reach factory
  - the Phase 144 routing fence + Part-8 5-tripwire sweep gates over the sensor surface
  - tests/run-all-143.sh -- the Phase 143 loop-fires aggregator (mirrors run-all-142.sh)
affects: [143-02, 143-03, 144-navigation-engine-routing-flip, 146-loop-fires-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure/sync/LOCAL-first sensor module: sensorFn(turn, tuple, ctx) -> candidate-reach|null, collected by a single dispatch chokepoint"
    - "Frozen candidate-reach struct (makeReach) validates reach_id + posture against committed banks; null-on-invalid never throws"
    - "Soft-fail-to-null dispatch: a throwing sensor is treated as did-not-fire, so one bad sensor cannot poison the array"
    - "Module-level gate tests that span every lib/core/sensors/*.cjs so downstream plans inherit the fence without rework"

key-files:
  created:
    - lib/core/insight-sensors.cjs
    - lib/core/sensors/sensor-types.cjs
    - tests/test-sensor-spine-dispatch.cjs
    - tests/test-sens01-first-material-fires.cjs
    - tests/test-sens06-artifact-filed-fires.cjs
    - tests/test-sensors-routing-fence.cjs
    - tests/test-sensors-part8-sweep.cjs
    - tests/run-all-143.sh
  modified: []

decisions:
  - "SENS-01 companion handle format is 'brain_framework_chain:<problem_type>' -- the enum is the ONLY payload, the Part-8 seam"
  - "SENS-06 chooses reach_id by finding edge type: CONTRADICT -> contradiction/pull_back; any other edge -> cross_room/push_forward"
  - "evidence carries LOCAL scalars only (counts + enums); makeReach drops non-primitive evidence values defensively"

metrics:
  duration: ~25m
  completed: 2026-06-06
  tasks: 3
  files: 8
  tests: 5 suites / 17 assertions, all green
---

# Phase 143 Plan 01: Insight-Sensor Spine + SENS-01/SENS-06 Summary

The net-new spine of the 7-row trigger map: ONE pure dispatch chokepoint
(`dispatchSensors`) over a `SENSOR_REGISTRY`, the frozen 5-reach / 3-posture id
banks + `makeReach` candidate-reach factory, the two shipped-substrate sensors
(SENS-01 first-material over Phase 117 auto-explore, SENS-06 artifact-filed over
the Phase 142 CASC-01 cascade), and the two module-level gates (Phase 144 routing
fence + Part-8 5-tripwire sweep) plus `run-all-143.sh` that Plans 02/03 inherit.

## What Shipped

- **lib/core/sensors/sensor-types.cjs** (120 lines): `REACH_IDS` = exactly
  `[context_block, contradiction, cross_room, brain_consult, deep_research]`,
  `POSTURE_IDS` = exactly `[push_forward, hold, pull_back]` (both frozen, both
  drift-tested per Phase 141 D-05/D-12). `makeReach(opts)` validates reach_id +
  posture against the banks and returns a frozen `{reach_id, posture, dispatch,
  companions, signal, evidence}` struct, or `null` on any invalid input. Pure,
  zero-I/O.

- **lib/core/insight-sensors.cjs** (240 lines): `dispatchSensors(turn, tuple,
  ctx)` runs the registry in canonical order, collects non-null reaches, never
  throws (a throwing sensor soft-fails to null), never mutates routing_source,
  never calls decide(). `sensorFirstMaterial` (SENS-01) surfaces a
  `context_block`/`push_forward` reach over the shipped Phase 117 path with the
  `brain_framework_chain:<problem_type>` companion (enum only). `sensorArtifactFiled`
  (SENS-06) reads `<roomDir>/.mindrian/last-cascade.json` (the shipped CASC-01
  side-channel, LOCAL only) and surfaces `contradiction`/`cross_room` by finding
  edge type. Both registered in `SENSOR_REGISTRY`.

- **5 test suites** (17 assertions) + **tests/run-all-143.sh**: the spine
  contract, the two loop-fires suites, the Phase 144 routing fence, the Part-8
  5-tripwire sweep. The runner mirrors `run-all-142.sh` exactly (SHELL_SUITES +
  CJS_SUITES arrays, per-suite plan-ownership header, runs to completion on
  failure, exits non-zero on any fail) so the Phase 146 gate composes them.

## Hard Fences Honored

- **Phase 144 fence:** no sensor file assigns `routing_source = 'engine'`, requires
  the navigation engine, or defines/calls `decide()`. Asserted by
  `test-sensors-routing-fence.cjs` over the spine module + every `lib/core/sensors/*.cjs`.
  Verification grep `routing_source\s*[:=]\s*['"]engine['"]` returns zero matches.
- **Part 8 (LOCAL -> Brain: NO):** SENS-01's `brain_framework_chain` companion
  carries ONLY the `problem_type` enum; the SENS-01 no-leak test injects secret
  artifact text into the turn/tuple/ctx and asserts it appears nowhere in the
  returned reach. The 5-tripwire sweep (no packet/brain-client require, no
  projection token, no sha256/createHash) gates the whole sensor surface.
- **SENS-01 does NOT re-run the Phase 117 pipeline** -- it surfaces the reach the
  shipped path represents.
- **SENS-06 does NOT re-implement the Phase 95/142 cascade** -- it locks it with a
  loop-fires read over a populated `last-cascade.json` fixture.

## Deviations from Plan

None - plan executed exactly as written across all 3 tasks. Tasks 1-2 followed
the TDD RED -> GREEN cycle (failing test committed, then implementation); Task 3
(gates + aggregator) executed as `type="auto"`.

## TDD Gate Compliance

Tasks 1 and 2 each have a `test(...)` (RED) commit preceding their `feat(...)`
(GREEN) commit in git log: `0d542379` test -> `c6f6cffd` feat (Task 1);
`6a00990e` test -> `809c5360` feat (Task 2). No refactor commit was needed.

## Verification

- `bash tests/run-all-143.sh` -> Total 5, Passed 5, Failed 0, exit 0.
- `grep -rEn "routing_source\s*[:=]\s*['\"]engine['\"]" lib/core/insight-sensors.cjs lib/core/sensors/` -> 0 matches.
- `grep -rn "context_block\|brain_consult\|deep_research" lib/core/sensors/sensor-types.cjs` -> reach bank present.
- Zero new dependencies (pure CJS, node built-ins + project libs).
- Zero em-dashes across all 8 files.

## Commits

- `0d542379` test(143-01): failing sensor-spine dispatch contract test
- `c6f6cffd` feat(143-01): sensor-types contract + insight-sensors dispatch chokepoint
- `6a00990e` test(143-01): failing SENS-01 + SENS-06 loop-fires tests
- `809c5360` feat(143-01): SENS-01 first-material + SENS-06 artifact-filed sensors
- `aceeee13` test(143-01): routing fence + Part-8 sweep gates + run-all-143.sh aggregator

## Self-Check: PASSED

All 9 created files exist on disk; all 5 task commits present in git log.
