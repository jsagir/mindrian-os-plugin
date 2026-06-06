---
phase: 143-insight-sensors-the-7-row-trigger-map
plan: 02
subsystem: sensors
tags: [insight-sensors, trigger-map, reach-ids, dispatch-chokepoint, reverse-salient, brain-framework-chain, breakthrough-scan, part-8, phase-144-fence, loop-fires]

# Dependency graph
requires:
  - phase: 143-01
    provides: the SENSOR_REGISTRY dispatch chokepoint + makeReach candidate-reach factory + the Phase 144 routing fence + Part-8 5-tripwire sweep + run-all-143.sh aggregator
  - phase: 89-reverse-salient-engine
    provides: the shipped rs-engine.py 4-mode reverse-salient CLI + commands/find-bottlenecks.md (SENS-02 dispatch target)
  - phase: 120-breakthrough-scan-category-g
    provides: lib/core/breakthrough/scanner.cjs scanForBreakthroughs + agents/investor.md (SENS-07 dispatch target)
provides:
  - lib/core/sensors/sensor-lagging-component.cjs -- SENS-02 conversation-pattern detector dispatching the shipped rs-engine (reach_id context_block)
  - lib/core/sensors/sensor-methodology-decision.cjs -- SENS-03 methodology-decision detector auto-invoking brain_framework_chain (generic handles only)
  - lib/core/sensors/sensor-gate-approach.cjs -- SENS-07 gate-approach detector firing the breakthrough scan + investor-objection surface
  - 3 net registrations into SENSOR_REGISTRY + 3 appended suites in run-all-143.sh (now 8 suites)
affects: [143-03, 144-navigation-engine-routing-flip, 146-loop-fires-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Net-new conversation/state-pattern DETECTOR that DISPATCHES a shipped engine via a handle string -- never re-runs or re-implements the engine (Canon Part 7)"
    - "SENS-02/07 surface LOCAL-analysis reaches (reach_id context_block) because find-bottlenecks + breakthrough-scan read the room's own artifact corpus, not Brain/web"
    - "SENS-03 is the Brain-touching detector: the brain_framework_chain companion carries ONLY framework-name handles + the problem_type enum (Canon Part 8 seam)"
    - "Doc-comment hygiene under the inherited Part-8 sweep: the words 'sha256'/'createHash' in prose trip the forbidden-call regex, so comments name 'hashing call site' instead"

key-files:
  created:
    - lib/core/sensors/sensor-lagging-component.cjs
    - lib/core/sensors/sensor-methodology-decision.cjs
    - lib/core/sensors/sensor-gate-approach.cjs
    - tests/test-sens02-lagging-component-fires.cjs
    - tests/test-sens03-methodology-decision-fires.cjs
    - tests/test-sens07-gate-approach-fires.cjs
  modified:
    - lib/core/insight-sensors.cjs
    - tests/run-all-143.sh

decisions:
  - "SENS-02 posture is pull_back -- a stated lagging component is a signal to pull back to the weakest subsystem and re-set rather than push past it"
  - "SENS-03 posture is hold -- surface the next-framework recommendation and hold for the navigator's Decision Gate selection"
  - "SENS-03 companion format is 'brain_framework_chain:<problem_type_enum>:<framework_name>', one per already-applied framework, plus a bare enum companion -- only enum + framework name ever ride the reach"
  - "SENS-07 reach_id is context_block (not brain_consult) -- the breakthrough scan + investor objection argue from LOCAL state, not a Brain/web call"
  - "SENS-07 fires from either tuple.stage OR LOCAL ctx.venture_stage being commit-near (Well-Defined Problem / Ready to Build / Investment / Commit)"

metrics:
  duration: ~5m
  completed: 2026-06-06
  tasks: 3
  files: 8
  tests: 3 new suites / 15 assertions; full run-all-143.sh = 8 suites, all green
---

# Phase 143 Plan 02: SENS-02 / SENS-03 / SENS-07 Detectors Summary

Three net-new conversation/state-pattern DETECTORS, each dispatching a SHIPPED
engine (Canon Part 7 reuse), registered into the Plan-01 SENSOR_REGISTRY
chokepoint and appended to the run-all-143.sh aggregator. The detector files live
under lib/core/sensors/ so the Plan-01 routing fence (Phase 144) and Part-8
5-tripwire sweep span them automatically.

## What Shipped

- **lib/core/sensors/sensor-lagging-component.cjs (SENS-02)**: a conversation
  pattern detector. When the navigator names a lagging component ("the bottleneck
  is X", "X is lagging", "X is holding us back", "reverse salient", "weakest
  link") it surfaces a `context_block` / `pull_back` reach dispatching the SHIPPED
  Phase 89 rs-engine via the handle `find-bottlenecks (rs-engine reverse-salient)`.
  reach_id is `context_block` because find-bottlenecks reads the room's OWN
  artifact corpus + section fill levels -- a LOCAL analysis surface, not a
  Brain/web call. Reads only `turn.text` (+ optional LOCAL section-fill scalar on
  ctx); makes no network call; never throws on malformed input. Does NOT re-run
  rs-engine inline.

- **lib/core/sensors/sensor-methodology-decision.cjs (SENS-03)**: the
  Brain-touching detector. On a methodology-decision signal
  (`methodology_completed` / `decision_point` / Decision Gate verb-1 etc.) it
  surfaces a `brain_consult` / `hold` reach whose companion is the EXISTING but
  never-fired `brain_framework_chain` CHAINS_TO query (references/brain/
  query-patterns.md Section 1). The companion carries ONLY generic handles -- the
  framework NAMES from `tuple.current_frameworks` + the `problem_type` ENUM. The
  sensor makes NO Brain call; it constructs the generic-handle companion and
  surfaces the reach for the Decision Gate (Canon Part 3). The SENS-03 no-leak
  test injects secret artifact text into turn/tuple/ctx and asserts it appears
  nowhere in the returned reach.

- **lib/core/sensors/sensor-gate-approach.cjs (SENS-07)**: a state-pattern
  detector. On a commit-near stage (`Well-Defined Problem` / `Ready to Build` /
  `Investment` / `Commit`, from `tuple.stage` OR LOCAL `ctx.venture_stage`) it
  surfaces a `context_block` / `push_forward` reach dispatching the SHIPPED
  Phase 120 `scanForBreakthroughs` (Category G) + the `agents/investor` objection
  surface. Early stages (Pre-Opportunity / Opportunity Identified) return null.
  Does NOT re-run the scanner inline and does NOT re-implement breakthrough
  scoring (T-143-06: the sensor surfaces a candidate; the navigator approves).

- **3 new loop-fires suites** (15 assertions) + **run-all-143.sh** appended (now
  8 suites). Each new suite asserts THE SENSOR FIRES on its signal, the
  non-matching case returns null, and dispatchSensors includes the reach
  (registration proof).

## Hard Fences Honored

- **Phase 144 fence (no routing_source flip):** no Plan-02 detector assigns
  `routing_source = 'engine'`, requires `navigation-engine.cjs`, or defines/calls
  `decide()`. The inherited `test-sensors-routing-fence.cjs` now spans all three
  new files and passes; verification grep
  `routing_source\s*[:=]\s*['"]engine['"]` over lib/core/sensors/ returns zero
  matches.
- **Part 8 (LOCAL -> Brain: NO):** the inherited `test-sensors-part8-sweep.cjs`
  (no packet/brain-client require, no projection token, no hashing call site)
  passes over all three new files. SENS-03 -- the only Brain-touching detector --
  carries ONLY framework-name handles + the `problem_type` enum on its
  brain_framework_chain companion; the no-leak assertion proves no artifact bytes
  ride the reach.
- **Reuse before build (Part 7):** SENS-02 dispatches the shipped rs-engine,
  SENS-07 dispatches the shipped breakthrough scanner + investor agent, SENS-03
  auto-invokes the existing (never-fired) brain_framework_chain pattern. None
  re-implements its engine.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Doc-comment words tripped the inherited Part-8 sweep**
- **Found during:** Task 2 (SENS-03)
- **Issue:** Two doc-comment lines in `sensor-methodology-decision.cjs` contained
  the literal words `sha256` / `createHash` (describing what the file does NOT
  do). The inherited Part-8 5-tripwire sweep matches the regex `/\bsha256\b/i`
  and the substring `createHash(` ANYWHERE in the file, including comments, so the
  prose tripped the forbidden-call gate.
- **Fix:** Reworded the two comments to say "hashing call site" / "no hashing or
  egress-projection path" instead of naming the forbidden tokens. No behavior
  change; the sensor never hashes anything.
- **Files modified:** lib/core/sensors/sensor-methodology-decision.cjs
- **Commit:** 1b0631f2 (folded into the SENS-03 GREEN commit)

## TDD Gate Compliance

All three tasks followed the RED -> GREEN cycle. Each has a `test(...)` (RED)
commit preceding its `feat(...)` (GREEN) commit in git log:
- SENS-02: `a2acb604` test -> `d57d8f43` feat
- SENS-03: `3c18833f` test -> `1b0631f2` feat
- SENS-07: `c645ae49` test -> `0c01a7d0` feat

No refactor commit was needed.

## Verification

- `bash tests/run-all-143.sh` -> Total 8, Passed 8, Failed 0, exit 0.
- `node tests/test-sensors-part8-sweep.cjs` -> PASS over all four sensor files
  (spine + 3 new detectors).
- `node tests/test-sensors-routing-fence.cjs` -> PASS over all four sensor files.
- `grep -rEn "routing_source\s*[:=]\s*['"]engine['"]" lib/core/sensors/` -> 0 matches.
- Zero new dependencies (pure CJS, node built-ins + project libs).
- Zero em-dashes across all 8 touched files.

## Commits

- `a2acb604` test(143-02): failing SENS-02 lagging-component loop-fires test
- `d57d8f43` feat(143-02): SENS-02 lagging-component detector over shipped rs-engine
- `3c18833f` test(143-02): failing SENS-03 methodology-decision loop-fires test
- `1b0631f2` feat(143-02): SENS-03 methodology-decision detector auto-invoking brain_framework_chain
- `c645ae49` test(143-02): failing SENS-07 gate-approach loop-fires test
- `0c01a7d0` feat(143-02): SENS-07 gate-approach detector over shipped breakthrough scan + investor

## Self-Check: PASSED

All 6 created files exist on disk; all 6 task commits present in git log.
