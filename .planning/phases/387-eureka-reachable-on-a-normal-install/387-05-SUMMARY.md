---
phase: 387-eureka-reachable-on-a-normal-install
plan: "05"
subsystem: eureka-tool-contract
tags: [engine-states, registration-chokepoint, typed-refusal, tdd]
requires: ["387-03"]
provides:
  - "lib/mcp/eureka-tool-contract.cjs: one engine gate at the registration chokepoint, typed refusals (absent, present, broken) with a fix line"
affects: [387-11]
key-files:
  modified:
    - lib/mcp/eureka-tool-contract.cjs
    - lib/mcp/tools/eureka-capability-run.cjs
    - lib/mcp/tools/eureka-capability-jobs.cjs
    - lib/mcp/tools/eureka-graph-analyze.cjs
    - lib/mcp/tools/eureka-graph-discovery-signals.cjs
    - lib/mcp/tools/eureka-graph-opportunity-scout.cjs
    - tests/test-387-eureka-installed-layout.cjs
    - tests/helpers/eureka-installed-layout-387.cjs
  created:
    - tests/test-387-eureka-engine-states.cjs
metrics:
  completed: 2026-11-06
---

# Phase 387 Plan 05: Typed engine states in the tool contract Summary

The engine tools now check the engine once, before the room projection, and answer with a typed state and a fix line. The shared refusal builder replaces the repeated root checks. Plan 387-11 later added route needs on top of this builder (commit 173a5b1e9).

## What was done (TDD)

- RED (c46efc0ed): `tests/test-387-eureka-engine-states.cjs` (309 lines, arms G1 to G9); the installed-layout test was rewritten on purpose (EXPECT moved to the honest states, scenario S7 added in the helper).
- GREEN (2b83948cc): the contract gained the gate and the typed refusal functions; the 5 tool modules switched to it.

## Verification (run in this session)

- `node tests/test-387-eureka-engine-states.cjs`: exit 0, 9 passed, 0 failed. Output line: "description bytes: baseline 9096, now 9355".
- `node tests/test-387-eureka-installed-layout.cjs`: exit 0, 9 passed, 0 failed (I1 to I9). I9 is scenario S7: a saved setting with no variable passes the gate and then fails at the missing uv. I1 shows tools/list holds the 24 runtime names.
- `bash tests/run-all-387.sh`: exit 0, PASS=13 FAIL=0 SKIPPED=1 (live leak test, env gap).
- G arms: G1 absent engine before the room check; G2 and G3 broken engine (missing folder, empty folder with cause pyproject_missing); G4 uv_missing versus plain start failure; G5 handler called once; G6 free and lifecycle tools; G7 saved setting needs no variable; G8 no path in refusals; G9 descriptions.

## Deviations from Plan

**1. Optional fifth parameter.** `callEurekaCapability(capabilityId, request, env, signal, deps = {})` gained a `deps` parameter (verified in `lib/mcp/tools/eureka-capability-run.cjs`). Existing callers are unchanged.

**2. Start failure answer.** A failure after the connect now answers `engine_start_failed`. Plan 387-11 refined this later with typed start causes. The earlier report said so; the refinement itself belongs to the 387-11 summary.

**3. Description size.** Tool descriptions grew from 9096 to 9355 bytes (+259). The plan limit stated by the earlier agent is baseline plus 300; the limit value was not re-read from the plan for this summary.

## Known Stubs

None found.

## UNVERIFIED

- The statement that the empty-folder scenario S3 reports engine_state broken: G3 pins the empty-folder cause; the S3 state value was not read from the layout test output separately.
- Behavior with a real engine, a real Desktop host or a real Cowork host. No real run was made.

## Risks

- The test files and the contract were later changed by 387-11 (173a5b1e9). This summary describes the 387-05 commits only.

## Self-Check: PASSED (as run above)

- Commits c46efc0ed and 2b83948cc exist.
