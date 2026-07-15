---
phase: 222-reach-ranking-unification-replace-the-three-disagreeing-what
plan: 03
subsystem: reach selection / engine + MCP wiring
tags: [rank-fired-candidates, decide, dispatch-candidate-reaches, born-wired, req-1, req-2, req-6, d-01, d-04]
requires:
  - "222-02: lib/workflow/reach-hedge-ranker.cjs rankFiredCandidates (the shared scored selection)"
  - "222-01: navigation.readHedgeWeightState / upsertHedgeWeightState + ranker_weights table"
provides:
  - "decide() re-orders sensorReaches via rankFiredCandidates before any [0] read (engine arm, Req 2)"
  - "dispatchCandidateReaches ranks the fired array for both suggest_next and reach_candidates (MCP arm, Req 1)"
  - "tests/test-222-reach-wired.cjs: born-wired reachability proof with a load-bearing negative arm (Req 6, D-04)"
affects:
  - "resolveFireSkill / suggest_next / reach_candidates now all act on the same scored pick (phase goal)"
tech-stack:
  added: []
  patterns:
    - "single-insertion / many-[0]-readers: one call re-orders the fired subset in place, every downstream reader sees the scored winner with zero further edits"
    - "engine-to-workflow lazy require (the :510 f-selector-ranker idiom) to avoid module-load cycles"
    - "0/1-candidate short-circuit on the MCP arm: skip the db open entirely, byte- AND cost-identical"
    - "born-wired proof: real decide() + real sensors.register handlers, never a bypassed internal call, with a negative arm proving the positive arms are load-bearing"
key-files:
  created:
    - tests/test-222-reach-wired.cjs
  modified:
    - lib/core/navigation-engine.cjs
    - lib/mcp/tools/sensors.cjs
decisions:
  - "D-01 honored: two call sites, one shared ranker; no second selection brain, resolveFireSkill body untouched"
  - "D-04 honored: reachability proven through the REAL decide() and REAL MCP registration with a negative arm, not a bypassed internal call (the Phase 150.5 anti-pattern)"
  - "score split seeded in room.db (weights favor d4_blend + Phase 158 reject history sinks context_block) rather than threading cortex priors, keeping the fixture deterministic and the sensor-firing recipe identical to test-213 ARM 3"
metrics:
  duration: ~20 min
  tasks: 3
  files-created: 1
  files-modified: 2
  completed: 2026-07-15
---

# Phase 222 Plan 03: Wire Both Consumers onto the Shared Ranker Summary

Wired the two unscored consumers onto Plan 02's shared `rankFiredCandidates` (D-01), turning "three disagreeing pickers" into one scored pick, then proved reachability the way this codebase mandates after the Phase 150.5 dead-sensor incident (D-04). One insertion in `decide()` covers `resolveFireSkill` and every other `sensorReaches[0]` read on the engine arm (Req 2); one rewire of `dispatchCandidateReaches` covers both `suggest_next` and `reach_candidates` on the MCP arm (Req 1). `tests/test-222-reach-wired.cjs` drives the REAL `decide()` and the REAL MCP tool registration with a load-bearing negative arm (Req 6). `resolveFireSkill`'s body, the Wicked-escalation precedence, and the dead-Brain degrade are byte-untouched and regression-pinned; `insight-sensors.cjs` detection is untouched (SPEC boundary held, `git diff` empty).

## What Was Built

- **Engine arm (`lib/core/navigation-engine.cjs::decide()`, commit `087522a8`):** one insertion immediately after the dispatch timing block (~:930) and before any `[0]` read. A function-local lazy `require('../workflow/reach-hedge-ranker.cjs')` (mirroring the :510 f-selector-ranker idiom to avoid a module-load cycle) re-orders `sensorReaches` via `rankFiredCandidates`, threading the projected `ctx.roomContext.cortexNodes` and the caller-owned `ctx.roomDb` handle (nullable; the ranker then degrades to equal weights with no event). Wrapped in a try/catch that leaves `sensorReaches` untouched on any error (belt-and-suspenders on the hot path; the ranker also self-guards and passes 0/1-candidate arrays through by reference). `resolveFireSkill` (:588-652), the Wicked-escalation branch (:591-597), and the dead-Brain degrade were not touched (`git diff` hunks confined to the single :930 insertion).
- **MCP arm (`lib/mcp/tools/sensors.cjs::dispatchCandidateReaches`, commit `cfe0bb54`):** a top-level `reach-hedge-ranker` require beside the existing workflow requires, plus a rewire that keeps `buildSensorInputs`/`dispatchSensors` exactly as-is, captures the fired array, returns it directly when `length <= 1` (skipping the db open entirely, so the 0/1 path stays byte- AND cost-identical), and otherwise opens `navigation.openRoomDbForCaller(roomDir)` (the RESEARCH A4 seam, the same call the neighboring tools make), ranks through `rankFiredCandidates(fired, { roomDir, db })`, and closes the handle in `finally` mirroring the neighboring tools' lifecycle. `suggest_next` and `reach_candidates` registration blocks, their zod schemas, and the connector `hitl_shape` declarations got zero edits (Part 11 fork status unchanged).
- **`tests/test-222-reach-wired.cjs` (commit `9964c26f`, 6 arms):** requires BOTH live surfaces (the engine AND the MCP tool module) as the anti-vacuous-green signature. A fixture (the test-213 co-fire recipe: text fires a `context_block` sensor and the fresh eureka side-channel fires `deep_research`) is skewed in `room.db` so the scored winner (`deep_research`) differs from the registry-order-first fired candidate (`context_block`): seeded `ranker_weights` favor the `d4_blend` expert, and `context_block` carries a Phase 158 reject history (2 presentations + 2 rejects, cp = 0.5) that sinks its composed D4 score below `deep_research` on the flat 0.5 floor.
  - ARM 1 (fixture): the co-fire turn surfaces >= 2 reaches, registry-first is `context_block`.
  - ARM 2 (NEGATIVE, load-bearing): registry-order-first reach !== the expected score-first reach, so the positive arms cannot pass vacuously.
  - ARM 3 (engine, Req 2): the REAL `nav.decide(turn, { roomDir, roomDb })` returns `fire_skill === nav.reachIdToSkillFamily('deep_research')` (the SHIPPED map) and NOT `reachIdToSkillFamily('context_block')`.
  - ARM 4 (MCP, Req 6): handlers captured off a fake server from the REAL `sensors.register`; `suggest_next` returns the scored top and `reach_candidates` returns combined-score order (`deep_research` first), not SENSOR_REGISTRY order.
  - ARM 5 (Wicked regression): `resolveFireSkill` with `wicked_score >= 8` and a re-ordered >= 2 reach array still returns `soft-systems` (precedence :591-597 untouched).
  - ARM 6 (degrade regression): the ranker returns the same array reference on an empty fired subset, and `resolveFireSkill(null, 0, 'tier_0', [])` returns `null` (the dead-Brain :582-585 path is invisible to the insertion).

## Verification

- `node tests/test-222-reach-wired.cjs` -> exit 0, all 6 arms green.
- `node -e "decide({},{})"` soft-path intact; `node tests/test-213-reach-wired.cjs` -> exit 0 (the strongest existing live-decide() regression).
- `node tests/test-198-contract-schema.test.cjs` -> exit 0 (112 assertions, MCP contract schemas unregressed).
- `node tests/test-222-frozen-scalars.cjs` -> exit 0 (Req 5 tripwire); all six `tests/test-222-*.cjs` -> exit 0.
- `node scripts/build-connector-registry.cjs --check` -> exit 0 (Part 11 fork status unchanged, registry green).
- Source greps: `grep -c rankFiredCandidates` == 1 in each of navigation-engine.cjs and sensors.cjs; `openRoomDbForCaller` in sensors.cjs increased by exactly 1 (2 -> 3); the suggest_next/reach_candidates registration blocks show an empty diff.
- Boundary held: `git diff lib/core/insight-sensors.cjs` is empty (detection boundary untouched).

## Deviations from Plan

None that change behavior. Two in-scope conformance choices:

- **Score split via reject-history + weights, not cortex priors.** The plan text offered either "threading ctx.roomContext.cortexNodes that give the later-registry reach a high D4 prior" OR "seeding reject history against the registry-first reach so the composed 158 discount sinks it." `buildReachScoresFromCortex` has no contribution entry that can raise `deep_research`, so the cortex route could not lift the later reach above the floor; the reject-history-plus-weights route was chosen instead (both are explicitly sanctioned by the plan's own "and/or"). This keeps the sensor-firing recipe byte-identical to test-213 ARM 3 (no extra cortex nodes perturbing which sensors fire) and makes the fixture fully deterministic.
- **ARM 4 binds the session room via `CLAUDE_ACTIVE_ROOM`.** The MCP handlers resolve their room through `resolveSessionRoomDir` -> `resolveActiveRoom`, which would otherwise consult the machine's real registry. The test sets `CLAUDE_ACTIVE_ROOM` to the temp fixture dir (precedence-1 override) for the duration of the arm and restores the prior value in `finally`, so the proof is hermetic and never touches a real room.

## Threat Model Coverage

- **T-222-01 (tampering, poisoned weight rows steering auto-fire):** Plan 02's scalar validation + the Req 7 disclosure apply unchanged on this path; ARM 3/4 prove the ranked path is live, ARM 5/6 prove the precedence/degrade guards still cap what a skewed rank can cause.
- **T-222-02 (elevation, a rank bug promoting past Wicked precedence):** the insertion sits BEFORE `resolveFireSkill`, whose precedence logic is byte-untouched; ARM 5 regression-pins it (a re-ordered array still yields `soft-systems`).
- **T-222-03 (DoS, per-call db open on the MCP path):** 0/1-candidate calls skip the open entirely; multi-candidate calls mirror the neighboring tool's existing open/close lifecycle; the ranker soft-fails to the unranked array.
- **T-222-04 (tampering, call sites reaching room.db directly):** both arms touch the db ONLY via navigation.cjs (`ctx.roomDb` passthrough on the engine arm, `openRoomDbForCaller` on the MCP arm); no new SQL anywhere in this plan.
- **T-222-SC (supply chain):** zero new packages; this plan adds two requires of repo-internal modules only.

## Self-Check: PASSED

- `tests/test-222-reach-wired.cjs` present on disk.
- All three task commits present in git history (087522a8 engine, cfe0bb54 MCP, 9964c26f test).
