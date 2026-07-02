---
phase: 205-larry-loop-elevation
plan: 06
subsystem: sens10-pipelining
tags: [SCOPE-6, CANON-Part7, one-posture-door, recon-gate-synthesis, GUIDED-safe-halt]
requires:
  - lib/core/sensors/sensor-circularity.cjs (205-03 - the SENS-10 cause enums this composes over)
  - lib/core/recipe-maps.cjs (the registry posture authority - postureForCommand, the ONE door)
  - lib/core/chain-executor.cjs (Phase 166 runChain - auto-runs the recon prefix, halts at the material gate)
provides:
  - lib/core/framework-chain-composer.cjs composeWorkflow(cause) - the SENS-10 cause -> ordered recon-gate-synthesis chain
  - lib/core/recipe-maps.cjs recipeForCause - the ordered command recipe per SENS-10 cause
affects:
  - the four SENS-10 exits COMPOSE into a pipeline (recon prefix -> material gate -> TELL synthesis) instead of being a flat menu
tech-stack:
  added: []
  patterns: [one-posture-door, autonomous-safe-recon-prefix, material-gate-halt, withhold-default-degrade, GUIDED-safe-halt]
key-files:
  created: []
  modified:
    - lib/core/framework-chain-composer.cjs
    - lib/core/recipe-maps.cjs
    - tests/test-205-pipelining.cjs
    - tests/run-all-205.sh
decisions:
  - "The SENS-10 exits COMPOSE, they are NOT a menu (SCOPE-6). composeWorkflow(cause) reads the ordered command chain from recipe-maps.recipeForCause and builds an ordered step list: the autonomous_safe RECON PREFIX -> the MATERIAL GATE (bono) -> the TELL SYNTHESIS terminal."
  - "Every step's autonomous_safe / posture is SOURCED from recipe-maps.postureForCommand (the registry authority, the ONE posture door) - NEVER fabricated here (T-166-02 / T-205-06-E). A command with no registry autonomous_safe flag degrades to a withhold-default halt step (posture 'halt', gate:true), never a fabricated run."
  - "This is the compose half of the wiring: composeWorkflow -> validateChainAutonomy -> chain-executor.runChain, where runChain auto-runs the leading autonomous_safe recon steps and HALTS at the first material gate (GUIDED safe-halt, Reach rule 8 / Phase 166). An unknown / empty cause -> []; never throws."
metrics:
  completed: 2026-07-01
  reconstructed: "SUMMARY authored 2026-07-02 from shipped commit 5641b314; the earlier pass landed code without a SUMMARY. No code changed."
---

# Phase 205 Plan 06: SENS-10 Exits Compose into a Recon-Gate-Synthesis Chain Summary

Closed SCOPE-6: the four SENS-10 exits (answer_unheard / assertion_unvalidated / stuck_unlocated / wrong_frame) COMPOSE into a pipeline rather than being a flat menu. `framework-chain-composer.cjs::composeWorkflow(cause)` reads the ordered command chain from `recipe-maps.recipeForCause` and builds an ordered step list: the autonomous_safe RECON PREFIX, then the MATERIAL GATE (bono), then the TELL SYNTHESIS terminal. Every step's `autonomous_safe` / `posture` is sourced from `recipe-maps.postureForCommand` (the ONE posture door, never fabricated - T-166-02); a command unknown to the registry degrades to a withhold-default halt step. This is the compose half of the wiring that feeds `validateChainAutonomy -> chain-executor.runChain`, where runChain auto-runs the recon prefix and HALTS at the first material gate (the GUIDED safe-halt, Phase 166 reach rule 8).

## State on entry

Landed out of order in a prior session as commit `5641b314` (`feat(205-06): SENS-10 exits compose into a recon-gate-synthesis chain (pipelining)`), an ancestor of `feat/v1.15`, with no SUMMARY. Reconstructed from the shipped source + live test run; no code changed.

## What shipped

- **`lib/core/framework-chain-composer.cjs`** (modified) - `composeWorkflow(cause)` added: cause -> ordered `{step, command, autonomous_safe, posture, gate}` list; posture sourced from `recipe-maps.postureForCommand`; unknown command -> withhold-default halt; unknown/empty cause -> `[]`; never throws.
- **`lib/core/recipe-maps.cjs`** (modified) - `recipeForCause`: the ordered command recipe per SENS-10 cause.
- **`tests/test-205-pipelining.cjs`** (created) + **`tests/run-all-205.sh`** (aggregator wired).

## Test results (live-verified)

```
$ node tests/test-205-pipelining.cjs   -> PIPELINING_OK 10/10
     (incl. "answer_unheard: the material TELL synthesis never auto-runs (halts at step 1)"
      and   "the forced-material always-halt is unchanged - an irreversible step never push-forwards")
$ bash tests/run-all-205.sh            -> ALL 205 TESTS PASS
```

## Canon

- Part 7: reuses the runChain spine + the registry posture authority; no new posture door.
- Part 3 / GUIDED safe-halt: the material TELL step never auto-runs; runChain halts at the first material gate.
- One posture door: postureForCommand only, never fabricated.
- No em-dashes.

## Commits

- `5641b314` feat(205-06): SENS-10 exits compose into a recon-gate-synthesis chain (pipelining)
