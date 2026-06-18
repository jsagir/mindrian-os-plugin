---
phase: 167-harness-manifest-and-surface-generator
plan: 03
subsystem: chain-executor-runtime
tags: [fable-mode, self-critique, chain-executor, posture-scoped, HARN-02, D-167-04]
requires:
  - lib/core/chain-executor.cjs runChain spine (Phase 166, both sync + async paths)
  - makeGateFn LOW_QUALITY halt + quality_early_stop branches (Phase 166)
  - framework-runner.md Step-3 quality gate + FRAMEWORK_RUNNER_RESULT enum
provides:
  - posture-scoped selfCritiqueFn(step, result) seam in BOTH chain-executor paths
  - _isMaterialStep(step, posture) posture-scoped material classifier
  - _applySelfCritique ONE shared seam helper (no sync/async drift)
  - fable-mode self-critique contract named on framework-runner.md
affects:
  - lib/core/chain-executor.cjs
  - agents/framework-runner.md
  - tests/run-all-167.sh
tech-stack:
  added: []
  patterns:
    - "additive opt-gated seam: default no-op keeps absent opt byte-identical to prior contract"
    - "ONE shared helper applied at two mirror seams so the paths cannot drift (MEDIUM-3)"
    - "verdict augments quality -> feeds existing halt; gate INPUT, never a stop condition"
key-files:
  created:
    - tests/test-chain-executor-fable-mode.cjs
  modified:
    - lib/core/chain-executor.cjs
    - agents/framework-runner.md
    - tests/run-all-167.sh
decisions:
  - "fable-mode is naming over the shipped quality machinery: no fable model tier, no new quality enum value"
  - "self-critique is posture-scoped: fires only on material steps (D-167-04 token scoping), skips trivially-safe push_forward reversible steps"
  - "the seam is mirrored in BOTH the sync runChain and the async _runChainResilient paths via one shared helper (MEDIUM-3)"
metrics:
  duration: ~20m
  completed: 2026-06-18
  tasks: 2
  files: 4
---

# Phase 167 Plan 03: Fable-Mode Posture-Scoped Self-Critique Seam Summary

A posture-scoped `selfCritiqueFn(step, result)` seam in `lib/core/chain-executor.cjs`, mirrored in BOTH the sync `runChain` path and the async `_runChainResilient` path via ONE shared helper, that augments `result.quality` to LOW_QUALITY on a failed self-critique of a MATERIAL step, feeding the EXISTING quality_early_stop / `makeGateFn` LOW_QUALITY halt so a failed self-critique escalates autonomous_safe to a halt at the next hop in whichever path ran.

## What Was Built

### Task 1: the posture-scoped selfCritiqueFn seam in both chain-executor paths (commit f82af89a)

- `_isMaterialStep(step, posture)`: posture-scoped material classifier (D-167-04). True when the step is irreversible, flagged `step.material === true`, or its posture verb is not `run` (push_forward); an absent posture is treated as uncertain -> material (withhold-default). A trivially-safe push_forward + reversible step is NOT material, so the critique is SKIPPED on it (respects the 166 token analysis).
- `_applySelfCritique(selfCritiqueFn, step, posture, result, quality)`: the ONE shared seam helper. Runs only when a `selfCritiqueFn` is supplied AND the step is material; calls `selfCritiqueFn(step, result)`; a verdict with `quality === 'low'` OR `passed === false` augments the captured quality to LOW_QUALITY. A thrown critic fails OPEN (no augmentation, T-167-12). Returns the (possibly augmented) quality.
- The seam is applied at BOTH mirror positions (MEDIUM-3): in the sync path between the `result.quality` capture and the `previousOutput` fold; in the async path AFTER the post-withBackoff dispatchError guard and BEFORE the `previousOutput` fold. Both call the same `_applySelfCritique` so the paths cannot drift.
- `selfCritiqueFn` is an OPTIONAL opt on both paths, defaulting to a no-op (null) so an absent opt is byte-identical to the Wave-166 contract. Documented in the `runChain` JSDoc callback list and the `_runChainResilient` JSDoc.
- The augmented quality feeds the EXISTING `quality_early_stop` branch (sync :381-385 / async :613-617) and the next-hop `makeGateFn` LOW_QUALITY halt (:195). NO new halt reason, NO retry, NO loop.
- `tests/test-chain-executor-fable-mode.cjs` (7 checks, sync + async): SYNC material critiqued -> halt; ASYNC material critiqued -> SAME quality_early_stop / LOW_QUALITY halt (driven via roomDir + injected no-op sleep, asserting partial:false so the dispatchError path is untouched); trivially-safe NOT critiqued in either path; default no-op byte-identical in both paths; B3 no-convergence grep (comment-filtered); no fable model tier grep; B2 decision_trace recorded by reference unchanged in both paths.

### Task 2: name the fable-mode self-critique contract on framework-runner.md (commit 7c77a25a)

- Added a `#### fable-mode self-critique contract (HARN-02 / D-167-04)` subsection under Step 3 (Quality Gate). It names: (1) verify + self-critique on every material chain step before chain_output becomes the next previous_output, with the trivially-safe skip; (2) the verdict rides the existing `FRAMEWORK_RUNNER_RESULT` `quality` field (`high|medium|low`), `quality: low` maps to a HALT via the chain-executor `selfCritiqueFn` seam in BOTH the sync and async execution paths; (3) naming over shipped machinery (no new model, no fable tier, no new enum value); (4) no auto-retry to convergence (166 B3). Step-3 criteria and the FRAMEWORK_RUNNER_RESULT block are untouched.
- `tests/run-all-167.sh`: registered `test-chain-executor-fable-mode.cjs` in `CJS_SUITES`; added `chain-executor.cjs` to the Part 8 grep sweep; added `chain-executor.cjs` + `framework-runner.md` + the new test to the em-dash sweep.

## Deviations from Plan

None - plan executed exactly as written. The TDD task implemented the seam and the test together; the test went GREEN on first run against the implementation (7/7), the 166 regression suite stayed 23/23 (proving the absent-opt byte-identical guarantee), and the 167 aggregator went 8/8.

## Verification

- `node tests/test-chain-executor-fable-mode.cjs` -> 7/7 checks passed (FABLE_MODE_OK).
- `bash tests/run-all-166.sh` -> 23/23 green (the absent-selfCritiqueFn byte-identical regression guard).
- `bash tests/run-all-167.sh` -> 8/8 green (fable-mode suite registered; Part 8 + em-dash sweeps pass).
- `grep -q 'fable-mode' agents/framework-runner.md` -> present.
- `model-profiles.cjs` fable count: 0 (no fable model tier introduced; stays opus/sonnet/haiku).
- Em-dash sweep clean on `lib/core/chain-executor.cjs` and `tests/test-chain-executor-fable-mode.cjs`.

## Threat Surface

All mitigations from the plan's threat register are honored by construction:
- T-167-09 / T-167-09b: the seam augments quality on material steps in BOTH paths; the async test drives `_runChainResilient` and asserts the same LOW_QUALITY halt.
- T-167-10: the B3 no-convergence grep (comment-filtered) asserts no loop / no stop condition added.
- T-167-11: the no-fable-model-tier grep over the executor + model-profiles.
- T-167-12: a thrown selfCritiqueFn fails open (no augmentation); a LOW verdict still halts.
- T-167-13: the seam touches `result.quality` only; chain-executor.cjs is in the Part 8 grep sweep (clean).
- T-167-14: B2 decision_trace recorded by reference, asserted reference-equal in both paths.
- T-167-SC: zero new packages.

## Known Stubs

None. The seam is wired to the real `runChain` / `_runChainResilient` paths; the test drives the real executor (not a mock).

## Self-Check: PASSED

All created/modified files exist on disk (chain-executor.cjs, test-chain-executor-fable-mode.cjs, framework-runner.md, run-all-167.sh, 167-03-SUMMARY.md) and both per-task commits (f82af89a, 7c77a25a) are present in git history.
