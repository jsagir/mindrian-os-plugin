---
phase: 166-gated-chain-executor
plan: 02
subsystem: chain-executor-core
tags: [EXEC-01, EXEC-02, EXEC-03, EXEC-04, EXEC-06, B2, B3, D-166-04, D-166-05, part-3, part-4, part-7, part-8, part-9]
requires:
  - lib/core/recipe-maps.cjs (Wave 1: postureForCommand / wiringForReach / rankedNextReach)
  - lib/mcp/pipeline-state.cjs (Wave 1: sole chain-state truth + isNext hard gate)
  - lib/core/navigation-engine.cjs (decide(); B2: return shape NEVER mutated)
  - agents/framework-runner.md (per-step brick: previous_output -> chain_output + quality)
  - lib/core/sensors/sensor-types.cjs (POSTURE_IDS frozen 3-posture bank)
provides:
  - lib/core/chain-executor.cjs runChain -- the ONE shared gated loop (CLI+MCP, D-166-04); no consumer owns a loop
  - the six-callback contract { postureFn, gateFn, onStep, provenanceFn, maxSteps, onHalt } + the injectable decideFn seam
  - makeGateFn -- the default posture x evidence-quality gate (the SPEC's single leverage point)
  - isIrreversibleStep + IRREVERSIBLE_HINTS -- forced-material classification (EXEC-03 HARD RULE)
affects:
  - Wave 3+ migration (act/pipeline/ignite re-host their loops on runChain)
  - Phases 164 + 165 (RIDE the runChain spine instead of cloning a fresh orchestrator)
tech-stack:
  added: []
  patterns:
    - six-callback inversion-of-control loop (no consumer owns the loop body, D-166-04)
    - injectable decideFn seam (lazy default = the real decide; tests stub it) preserving B2
    - fail-closed gate (any gate/onStep/decide fault degrades to a withhold-default halt)
    - reference-equal decision_trace recording (B2: never copy / reshape decide()'s return)
key-files:
  created:
    - lib/core/chain-executor.cjs
    - tests/test-chain-executor-loop.cjs
    - tests/test-chain-executor-gate.cjs
  modified:
    - tests/run-all-166.sh
decisions:
  - "runChain is the ONE shared loop in lib/core (CLI+MCP, D-166-04); the six callbacks invert control so no consumer owns a loop body"
  - "decide() is re-called per loop as the LIVE next-step authority (EXEC-01); its decision_trace is recorded reference-equal / UNCHANGED (B2); rankedNextReach stays contract-only (Phase 157 deferred)"
  - "the default gate (makeGateFn) runs ONLY push_forward + not-low-quality + reversible; everything else halts (EXEC-03)"
  - "irreversible steps (email/deploy/publish/external-write or explicit flag) are forced-material and halt regardless of an autonomous_safe tag (EXEC-03 HARD RULE, D-166-05)"
  - "stop condition is posture / quality / maxSteps ONLY -- NO convergence 'all-passing' branch (B3)"
  - "EXEC-06: maxSteps hard cap (budget_brake) + quality early-stop (quality_early_stop), each recording a haltedAt reason"
metrics:
  duration_minutes: 9
  completed: 2026-06-18
  tasks: 3
  files_created: 3
  files_modified: 1
---

# Phase 166 Plan 02: Wave 2 Core (runChain spine) Summary

The missing RUNTIME landed. `lib/core/chain-executor.cjs` ships `runChain` -- the ONE shared gated loop in `lib/core` (called by both the CLI entry and the MCP server through thin wrappers, Tri-Polar parity per D-166-04). It takes a sequence of reaches/commands and runs it as autopilot-with-gates: invoke a step, capture its structured output, pass that output (carrying the framework-runner `quality` enum) into the next step, and loop -- auto-running the gate-greenlit steps and halting at material-decision steps for the Tri-Context Decision Gate (Canon Part 3). No consumer owns a loop; act/pipeline/ignite migrate onto this spine in later waves.

## What Was Built

### Task 1 (EXEC-01 / EXEC-02 / EXEC-04, B2): the loop runner
- `runChain(steps, { postureFn, gateFn, onStep, provenanceFn, maxSteps, onHalt, decideFn })` extracted and generalized from the donor loop in `scripts/act-command.cjs` (the `planChainRun` + walk at act-command.cjs:131-147, the stop/gate render at 172-224, the workflow_stage journaling at 245-295). No new dispatch path.
- **EXEC-01 next-step authority + B2:** the loop re-calls `decideFn` (the injectable `decide()` seam; production default lazy-requires `navigation-engine.cjs` decide) ONCE PER LOOP to re-derive the next reach from the navigated graph neighborhood, and records its `decision_trace` handle UNCHANGED (reference-equal, never copied or reshaped). `decide()` is the LIVE next-step authority; `recipe-maps.rankedNextReach` is NOT consulted by the loop (it stays contract-only per the SPEC Out-of-scope; live nav-engine consumption deferred with Phase 157). The loop asserts (via the test) that the recorded handle is reference-equal to what `decideFn` returned, proving B2 by instrumentation.
- **EXEC-02 output-passing with quality carry:** each step's `chain_output` folds into the next step's `previousOutput`, and the result object carries the `quality` enum forward so the gate can fire on `quality:low` next hop (stops garbage-in-garbage-out down the chain, loop R3).
- **EXEC-04 single trace + kill switch:** every run step appends ONE entry `{ step, chain_output, quality, decision_trace }` to the ONE ordered trace. A `[stop]` verb from `onHalt` flushes (returns the trace built ABOVE the stop, never drops it) and ends cleanly with `completed:false` + `haltedAt` naming the stop step + `haltedAt.stopped:true`.
- **B3 (no convergence stop):** the stop condition is posture / quality / maxSteps ONLY. There is no "loop until all PASSING" branch -- the chain halts at the first material step per Canon Part 3.

### Task 2 (EXEC-03 / EXEC-06): the gate predicate + budget brake
- `makeGateFn(opts)` is the default gate predicate (the SPEC's single leverage point), used when no `gateFn` is injected. It returns `'run'` ONLY when ALL three hold: (1) the step's posture maps to push_forward / autonomous_safe (read via `postureFn`, default `recipe-maps.postureForCommand` -- the ONE posture authority), (2) the inbound `priorOutput.quality !== 'low'` (EXEC-02 quality carry), and (3) the step is NOT irreversible. Otherwise `'halt'`.
- **EXEC-03 forced-material irreversible (HARD RULE + D-166-05):** `isIrreversibleStep` flags a step via an explicit `step.irreversible` flag OR a frozen `IRREVERSIBLE_HINTS` keyword match (email / deploy / publish / send / release / external-write). A forced-material step ALWAYS halts even when tagged autonomous_safe; the irreversibility check runs FIRST so no tag can override it.
- **EXEC-06 budget:** `maxSteps` (default 25, caller may lower) is a hard cap -- when the budget is reached the loop halts with `haltedAt.reason = 'budget_brake'`. A step returning `quality:'low'` on a gate-passed path triggers a quality early-stop with `haltedAt.reason = 'quality_early_stop'` (the low-quality step lands in the trace first, then the chain stops).
- Fail-closed throughout: any `gateFn` / `onStep` / `decideFn` fault degrades to a withhold-default halt (recorded reason) rather than silently continuing.

### Task 3: register the Wave-2 suites in run-all-166.sh
- Appended `test-chain-executor-loop.cjs` + `test-chain-executor-gate.cjs` to `CJS_SUITES` after the Wave-1 entries (dependency order preserved).
- Extended the Part-8 grep sweep to cover `lib/core/chain-executor.cjs` (same BRAIN_WRITE + RAW_FETCH + external-http + brain-client regexes, comment-line filtering so a doc-comment cannot self-invalidate the count). chain-executor.cjs makes zero Brain calls and dispatches only through `onStep` / recipe-maps.
- Extended the em-dash sweep (U+2014 codepoint escape) to cover chain-executor.cjs + the two new suites.

## Canon Compliance

- **Part 3 (Tri-Context Decision Gate):** the loop halts at material steps and hands to `onHalt` (the gate render returning one of the 10 verbs); auto-run is strictly the gate-greenlit autonomous_safe subset.
- **Part 4 (Every Choice Is Graph Data):** every run step appends to the ONE chain trace built from `decide()`'s decision_trace plus each chain_output -- the trace is the resumable journal and observability surface.
- **Part 7 (Reuse Before Build):** ~80-85 percent repoint -- the act-command loop body, the recipe-maps posture authority, the navigation-engine decide(), and the framework-runner brick all pre-exist; net-new is the contract + the gate predicate + the trace join.
- **Part 8 (Graph Boundary):** chain-executor.cjs opens NO Brain wire (verified by the extended Part-8 sweep). Posture is joined from the LOCAL command-registry via recipe-maps; egress (if any) is the framework-runner's existing chokepoint, reached through onStep. `decide()`'s return shape is unchanged and Part-8-clean.
- **Part 9 (Memory Locality):** the loop opens no new write path of its own; chain-state persistence rides the Wave-1 pipeline-state.cjs chokepoint (the consumer wiring lands in the migration waves).
- **No em-dashes** anywhere (verified across all 4 touched files via the runner sweep and a direct codepoint grep).

## Truth-in-Labeling (do not regress)

The loop's next-step authority is `decide()`, re-called per iteration, NOT `recipe-maps.rankedNextReach`. The projection's ranked list stays a contract-only reader; live nav-engine consumption is deferred with Phase 157 (166-SPEC.md Out-of-scope). B2 is load-bearing: the trace records `decide()`'s `decision_trace` reference-equal / UNCHANGED, and Test 2 of the loop suite asserts `strictEqual` against what `decideFn` returned. decide()'s return shape was NOT touched this wave.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test correctness] Aligned the loop test's haltedAt assertion to the contract**
- **Found during:** Task 1 (GREEN run)
- **Issue:** The initial loop test asserted `result.haltedAt.step === 2` (a bare index), but the runChain contract records `haltedAt.step` as the full step OBJECT (`{ step: 2, command }`), so the bare-index assertion failed.
- **Fix:** Assert `result.haltedAt.step.step === 2` (the step object's index) and add a `haltedAt.stopped === true` assertion to lock the [stop]-verb marker.
- **Files modified:** tests/test-chain-executor-loop.cjs
- **Commit:** fa8ada42 (landed with the GREEN impl)

### Implementation note (TDD gate compliance)

The default gate predicate (`makeGateFn`), the forced-material classification (`isIrreversibleStep` / `IRREVERSIBLE_HINTS`), and the EXEC-06 budget (`maxSteps` cap + quality early-stop) are part of the single cohesive `chain-executor.cjs` module and therefore co-shipped in the Task 1 GREEN commit (`fa8ada42`). Task 2's RED test (`43607002`) was authored after that commit and validates these behaviors against the existing implementation; all 4 gate behaviors pass. This is a within-module ordering artifact, not a skipped GREEN -- the gate behaviors are net-new functionality with dedicated assertions in `test-chain-executor-gate.cjs`.

## Verification

- `node tests/test-chain-executor-loop.cjs` -> 4/4 PASS (LOOP_OK 4/4)
- `node tests/test-chain-executor-gate.cjs` -> 4/4 PASS (GATE_OK 4/4)
- `bash tests/run-all-166.sh` -> GREEN 6/6 (4 suites + Part 8 sweep + em-dash sweep)
- chain-executor.cjs: zero `mcp__brain` / `brain-client` / `fetch(` / external-http matches (direct grep + runner sweep)
- Em-dash sweep clean across all 4 touched files (direct U+2014 grep returns nothing)
- min_lines met: chain-executor.cjs 355 (>=140), test-chain-executor-loop.cjs 172 (>=60), test-chain-executor-gate.cjs 144 (>=60)

## Commits

- 1ee95c62 test(166-02): add failing runChain loop + output-passing + single-trace + stop-verb test (EXEC-01/02/04, B2) [RED]
- fa8ada42 feat(166-02): runChain loop runner + output-passing + single trace + kill switch (EXEC-01/02/04, B2) [GREEN]
- 43607002 test(166-02): posture x quality gate + forced-material irreversible + budget brake (EXEC-03/06)
- a68e598f test(166-02): register Wave-2 suites + extend Part 8 / em-dash sweeps in run-all-166.sh

## TDD Gate Compliance

Task 1 followed RED -> GREEN: test `1ee95c62` failed (module-missing), feat `fa8ada42` made it green. Task 2's gate predicate co-shipped in `fa8ada42` (one cohesive module) with its dedicated RED-shaped suite `43607002` asserting the four EXEC-03/06 behaviors. No REFACTOR commit was needed (the GREEN implementation was already clean). Task 3 is test-infrastructure registration (no behavior).

## Self-Check: PASSED

All 5 deliverable files present on disk (3 created, 1 modified, 1 summary) and all 4 per-task commits found in git history.
