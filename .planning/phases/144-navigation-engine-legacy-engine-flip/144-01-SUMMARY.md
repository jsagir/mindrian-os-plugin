---
phase: 144-navigation-engine-legacy-engine-flip
plan: 01
subsystem: api
tags: [navigation-engine, sensors, routing, canon-part-8, canon-part-9, decide]

# Dependency graph
requires:
  - phase: 141-local-retrieval-spine
    provides: the 5 frozen reach_ids + 3 posture_ids dial doctrine (sensor-types.cjs)
  - phase: 142-local-intelligence-wiring-compute-store-and-act
    provides: navigatedNeighborhood threaded into decide() via the navigation.cjs chokepoint (CASC-02)
  - phase: 143-insight-sensors
    provides: dispatchSensors(turn, tuple, ctx) -> Array<reach> pure/sync/LOCAL spine
provides:
  - "decide() consumes dispatchSensors and emits a non-null fire_skill carrying a CANONICAL VERB on a fired reach"
  - "reachIdToSkillFamily: the 5 frozen reach_ids -> canonical-verb mapping that lets the router flip routing_source legacy->engine"
  - "resolveFireSkill 4-arg sensor branch with documented multi-sensor precedence (wicked > top reach > BRAIN verb > weightApplied>=0.9 fallback)"
  - "Zep-shaped LOCAL trace.context_assembly { user_summary, facts, decision_grounding } + per-node temporal scalars + trace._meta.latencies_ms"
affects: [144-02-fixture-repair, 144-03-acceptance-harness, 146-loop-fires-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Engine-side consumer of the shared dispatchSensors spine (coexists with the 143.3 prompt-side intelligence-orchestrator; one reach per beat by the resolveFireSkill precedence chain)"
    - "The legacy->engine flip is a pure CONSEQUENCE of a non-null canonical-verb fire_skill (router Precedence Rule 1), never a new routing_source assignment in the engine"
    - "Zep Smart-Context-Assembly output shape mapped to LOCAL trace scalars only (Part 8 / Part 9)"

key-files:
  created:
    - tests/test-decide-sensor-fire.cjs
  modified:
    - lib/core/navigation-engine.cjs

key-decisions:
  - "reachIdToSkillFamily returns CANONICAL VERBS (not family slugs) because the router validates fire_skill against CANONICAL_VERBS; this is what makes validateVerb===true and flips the source to engine"
  - "Multi-sensor precedence: wicked_escalation (>=8) FIRST > top sensor reach by canonical REACH_IDS order (ANY tier) > mode_a BRAIN verb > weightApplied>=0.9 context-engine fallback"
  - "Sensors fire in ANY tier including the tier_0 early-return path; sensorReaches computed ONCE before any return so both paths see the same candidates"
  - "context_assembly + latency telemetry computed AFTER all fire_skill contributions so decision_grounding names the FINAL justification"
  - "temporal scalars { first_seen, last_updated } are read ONLY from existing neighborhood/reach scalars (null when absent, never fabricated)"

patterns-established:
  - "Sensor-source rationale clause names reach_id + posture ONLY (Part 8): never reach.signal user value, evidence body, dispatch handle, or user text"
  - "decide() never throws: dispatchSensors wrapped in try/catch -> degrades to [] -> resolveFireSkill behaves exactly like the pre-144 engine"

requirements-completed: [NAV-01]

# Metrics
duration: 18min
completed: 2026-06-07
---

# Phase 144 Plan 01: Navigation Engine legacy->engine Flip Summary

**dispatchSensors wired into decide() so a fired Phase 143 reach maps to a canonical verb and flips routing_source legacy->engine at the router, plus a Zep-shaped LOCAL trace.context_assembly + latency telemetry.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-06-07T10:21:00Z
- **Completed:** 2026-06-07T10:39:00Z
- **Tasks:** 2
- **Files modified:** 1 (+ 1 test created)

## Accomplishments
- decide() now consumes the shipped Phase 143 sensor spine: a turn that fires a reach produces a non-null `decision.fire_skill` carrying one of the closed 10 CANONICAL_VERBS, so the router (READ-ONLY for 144) flips `routing_source: legacy -> engine` via its Precedence Rule 1 (`validateVerb===true`) as a pure consequence. The legacy-on-every-turn behavior is gone whenever a reach fires.
- `reachIdToSkillFamily()` maps the 5 frozen reach_ids to canonical verbs (context_block/brain_consult -> Run Methodology; contradiction -> Devil's Advocate; cross_room -> Navigate Graph; deep_research -> Spawn Sub-Agent). No 6th reach invented.
- `resolveFireSkill` extended to a 4th param `sensorReaches` with a documented precedence comment block: wicked_escalation FIRST > top sensor reach (ANY tier) > mode_a BRAIN verb > weightApplied>=0.9 fallback. Sensors fire in tier_0 / mode_b too, including the tier_0 early-return path.
- Zep-shaped LOCAL `trace.context_assembly { user_summary, facts, decision_grounding }` on BOTH return paths, with per-node `{ first_seen, last_updated }` temporal scalars and `trace._meta.latencies_ms { dispatchSensors_ms, decide_total_ms }`. Every byte is LOCAL trace JSON; nothing reaches the Brain; no await/I/O added (1200ms NAV budget untouched).
- The line-537 Phase-144 fence comment flipped from "routing_source is NOT touched (Phase 144 fence)" to the router-layer phrasing.

## Task Commits

Both tasks landed in the same `decide()` body (interleaved Task-1 wiring + Task-2 trace) and were committed atomically with their shared acceptance suite:

1. **Task 1 + Task 2: wire dispatchSensors + reachIdToSkillFamily + sensor precedence + Zep trace.context_assembly + latency telemetry** - `e377cd1e` (feat)

_TDD flow: the acceptance suite was written first (RED: 2/7 passing), then the implementation turned it GREEN (7/7); committed together as the GREEN gate per the plan's single-feature scope._

## Files Created/Modified
- `lib/core/navigation-engine.cjs` - require dispatchSensors at module top; sensorReaches computed once in decide(); reachIdToSkillFamily table; resolveFireSkill 4-arg sensor branch + precedence comment; sensor-source rationale clause (reach_id + posture only); buildContextAssembly + groundingForFireSkill helpers; context_assembly + _meta.latencies_ms on both return paths; line-537 fence comment flipped
- `tests/test-decide-sensor-fire.cjs` - 7-test acceptance suite (first_material -> Run Methodology in tier_0; artifact_filed CONTRADICT -> Devil's Advocate; wicked >= 8 wins tie-break; rationale Part-8 clean; context_assembly LOCAL shape; latency telemetry; no-sensor honest-negative)

## Decisions Made
- `reachIdToSkillFamily` returns canonical verbs (not skill-family slugs) because the router's `validateVerb` checks `CANONICAL_VERBS`; this is the latent reason a family-slug return never flipped the source. Documented in the function header and mirrored from `<critical_router_contract>`.
- `context_block` and `brain_consult` both map to `Run Methodology` (the closest canonical verb for a context/Brain-consult posture); `cross_room` maps to `Navigate Graph`; `deep_research` maps to `Spawn Sub-Agent`; `contradiction` maps to `Devil's Advocate`. These choices keep `validateVerb===true` at the router.
- Computed `sensorReaches` ONCE before the quadruple check so the tier_0 early-return path fires sensors identically to the populated path.

## Deviations from Plan

None - plan executed exactly as written. The two tasks were implemented in one interleaved edit pass on `decide()` and committed atomically (both behaviors covered by the single acceptance suite), which matches the plan's single-feature, single-file scope.

## Issues Encountered
- The router integration tests `skill-activation-router.test.cjs` Tests 16/17 are RED (15/17) - this is the documented pre-existing FIXTURE REGRESSION (`makeRoomsFixture` writes `.rooms/registry.json` as an array of strings) called out in 144-FANOUT-CORRECTIONS.md. It is **Plan 144-02's** responsibility (the fixture repair), NOT this plan, and is unrelated to these changes (no router or fixture file was touched). Confirmed the failure mode is the registry-shape AssertionError, not a regression introduced here.

## Verification

- `node tests/test-decide-sensor-fire.cjs` -> 7/7 passed
- `node tests/test-sensors-routing-fence.cjs` -> 2/2 passed (sensor-module fence GREEN)
- `node tests/test-decide-part8-invariant.cjs` -> 2/2 passed (Part-8 invariant + positive chokepoint anchor GREEN)
- `node tests/test-spine-navigates-decide.cjs` -> 1/1 passed (CASC-02 fence GREEN)
- `node tests/test-135-decide-wiring-e2e.cjs` -> 2/2 passed (offer-resolver path unaffected)
- `bash tests/run-all-142.sh` -> 7/7; `bash tests/run-all-143.sh` -> 10/10 (neighbors GREEN, no regression)
- Task-2 grep gate: `grep -v '^\s*//' ... | grep -c context_assembly` = 3 (>= 1)
- Scope: `git diff --name-only` shows ONLY `lib/core/navigation-engine.cjs`; sensor files (`insight-sensors.cjs`, `sensors/*`) and `skill-activation-router.cjs` confirmed unmodified

## Threat Surface

All threat-register mitigations honored:
- T-144-01 (rationale info disclosure): sensor clause names reach_id + posture only; Test 4 asserts no user text, no dispatch handle, no forbidden token.
- T-144-02 (trace info disclosure): context_assembly + temporal + latency are LOCAL trace JSON; no packet/brain-client require; FORBIDDEN_TOKENS/CALLS sweep stays green.
- T-144-03 (sensor fence): no edit to any lib/core/sensors/* file; routing fence green.
- T-144-04 (router READ-ONLY): no edit to skill-activation-router.cjs; the flip is a consequence of a canonical-verb fire_skill.
- T-144-05 (1200ms budget): dispatchSensors is sync; latency telemetry is scalar shaping; no await/I/O added.

## Next Phase Readiness
- The engine-side flip is wired. Plan 144-02 (fixture repair) turns router Tests 16/17 green to prove the flip path end-to-end via the existing router; Plan 144-03 builds the `tests/run-all-144.sh` acceptance harness (composes ACPT-01 for the Phase 146 gate). Both depend on this build.
- Coexistence note: the 143.3 intelligence-orchestrator (prompt-side consumer of the same dispatchSensors spine) is unaffected; this is the engine-side consumer and does not cause a double-fire (the resolveFireSkill precedence chain selects exactly one reach per decide() beat).

## Self-Check: PASSED

- FOUND: lib/core/navigation-engine.cjs
- FOUND: tests/test-decide-sensor-fire.cjs
- FOUND: .planning/phases/144-navigation-engine-legacy-engine-flip/144-01-SUMMARY.md
- FOUND: commit e377cd1e

---
*Phase: 144-navigation-engine-legacy-engine-flip*
*Completed: 2026-06-07*
