---
phase: 166-gated-chain-executor
plan: 04
subsystem: chain-executor
tags: [act, runChain, migration, donor, gated-chain, drift-net, canon-part-3, canon-part-7, canon-part-8]
requires:
  - 166-02 (chain-executor.cjs runChain spine + makeGateFn + isIrreversibleStep)
  - 166-03 (chain-retry + graceful-partial + pipeline-state isNext)
  - lib/core/recipe-maps.cjs postureForCommand (the ONE posture authority, Wave 1)
  - lib/brain/chain-recommender.cjs recommendFrameworkChain
  - lib/workflow/command-resolver.cjs composeWorkflow + validateChainAutonomy
provides:
  - act-command.cjs as the thinnest caller of runChain (the donor owns no loop)
  - buildRunChainPlan delegation seam (runChain-driven walk, donor plan shape preserved)
  - tests/fixtures/act-prebehavior-baseline.json (the committed pre-migration drift net)
  - PRE === POST identity verification for the three act paths
affects:
  - scripts/act-command.cjs
  - commands/act.md
  - tests/run-all-166.sh
tech-stack:
  added: []
  patterns:
    - "donor -> thinnest caller: extract the loop to the shared spine, repoint the origin onto it"
    - "capture-before-refactor drift net: snapshot SHIPPED behavior to a committed fixture, assert PRE === POST after"
    - "thin shim preserves the call surface (planChainRun) while ownership moves (runChain)"
key-files:
  created:
    - tests/test-act-prebehavior-snapshot.cjs
    - tests/fixtures/act-prebehavior-baseline.json
    - tests/test-act-on-runchain.cjs
  modified:
    - scripts/act-command.cjs
    - commands/act.md
    - tests/run-all-166.sh
decisions:
  - "act passes provenanceFn:null (it is not the pipeline) and a no-op decideFn (act PLANS a precomposed chain rather than re-deriving the next reach per loop -- decide() shape untouched, B2)"
  - "planChainRun is kept as a thin shim routing through buildRunChainPlan so renderChainReport + emitWorkflowStages + the snapshot/identity suites drive off the same plan shape unchanged -- byte/behavior-identity preserved"
  - "the gateFn reads THIS chain's validateChainAutonomy report (recipe-maps' verdict for the chain) rather than re-deriving posture per step, because act's stop semantics are 'first non-autonomous_safe (or command-less) step'"
metrics:
  duration: ~5 minutes
  completed: 2026-06-18
  tasks: 3
  files_created: 3
  files_modified: 3
  commits: 3
---

# Phase 166 Plan 04: MIGRATE act onto runChain Summary

act (the DONOR the runChain spine was extracted from in Wave 2) is now the thinnest caller of `lib/core/chain-executor.cjs` `runChain`: it composes the framework chain (recommender + resolver, unchanged) then delegates the walk to the shared spine, supplying callbacks only -- and "no behavior drift" is VERIFIED, not asserted, against a pre-migration baseline captured before any refactor landed.

## What Was Built

**Task 1 (commit `01c40bff`) -- the drift net.** `tests/test-act-prebehavior-snapshot.cjs` exercises the SHIPPED `act.planChainRun` (act-command.cjs:131-147) and `act.renderChainReport` (act-command.cjs:151-226) over three deterministic in-test fixtures (whole-chain-autonomous_safe / a non-autonomous_safe step at position 2 / the [stop] filed-above-the-stop prefix) and serializes the render bytes + the three path outcomes to `tests/fixtures/act-prebehavior-baseline.json`. The suite is idempotent: it WRITES the baseline on first run (the pre-migration record) and ASSERTS identity thereafter. This was committed BEFORE Task 2 mutated act -- the donor's truth recorded before the refactor.

**Task 2 (commit `9cdfb1eb`) -- the migration (TDD).** RED: `tests/test-act-on-runchain.cjs` asserting `act.buildRunChainPlan` existed failed (undefined). GREEN: `scripts/act-command.cjs` gained `buildRunChainPlan(workflow, autonomyReport)`, which DELEGATES the walk to `runChain` and derives the same `{ wouldRun, stopAt, stopReason }` plan shape from runChain's `{ trace, completed, haltedAt }` return. act supplies `postureFn` = `recipe-maps.postureForCommand` (the ONE posture authority), a chain-autonomy `gateFn`, an `onStep` recording the would-run step (the way planChainRun pushed `{ step, command, framework }`), an `onHalt` recording the stop step, `provenanceFn: null`, and a no-op `decideFn`. `planChainRun` became a thin shim routing through `buildRunChainPlan`; the donor's manual step walk is gone. The identity suite asserts PRE === POST against the committed baseline for all three paths.

**Task 3 (commit `a30f8635`) -- prose + registration.** `commands/act.md` Chain Mode prose now names `lib/core/chain-executor.cjs` `runChain` as the shared runtime act rides (act is the thinnest caller; posture from recipe-maps; single runChain trace); the user contract is unchanged. `tests/run-all-166.sh` registers both new suites in dependency order (snapshot FIRST, then the migration/identity suite) and extends the em-dash sweep to `scripts/act-command.cjs`, `commands/act.md`, and the two new suites.

## How "No Drift" Is VERIFIED

The HIGH-1 gap the checker named was that act had NO pre-existing regression suite (confirmed: tests/ carried none). The fix is instrumentation, not assertion:

1. The SHIPPED `renderChainReport` bytes + the whole-autonomous / gated-halt / [stop] outcomes are captured to a committed fixture BEFORE the refactor (Task 1).
2. After the refactor, the migrated act re-runs over the same fixtures and `assert.deepEqual` proves the render bytes + plan are byte/behavior-identical to the baseline (Task 2, Tests 1-3).
3. The same fixture is asserted idempotently by the snapshot suite itself (it now takes the ASSERT branch), so a future drift in either the render OR the walk trips a test.

The migration is faithful only if PRE === POST, and that is what the green suites prove.

## Deviations from Plan

None - plan executed exactly as written. The plan's suggestion "keep planChainRun as a thin shim that builds the runChain step list, whichever preserves behavior with less churn" was taken: planChainRun is a one-line shim over buildRunChainPlan, which preserved the render + journaling byte-for-behavior.

## Canon / Hard-Rule Gates

- **Canon Part 7 (Reuse Before Build):** the walk ownership MOVED to the shared runChain spine; act re-implements no loop and no posture. ~repoint, not rewrite -- renderChainReport + emitWorkflowStages + the seed logic all preserved.
- **Canon Part 8 (Graph Boundary), B2:** act-command.cjs sweep clean (no Brain-write / raw-fetch tokens); `decide()` shape untouched (navigation-engine.cjs unmodified -- act passes a no-op decideFn because it plans a precomposed chain). Part-8 grep sweep in run-all-166.sh PASSED.
- **Canon Part 3:** the F.0 "needs you here" gate render + the [stop] kill switch are preserved (byte-identical per the baseline).
- **No em-dashes:** em-dash sweep PASSED over all edited + created files.
- **Suite registration:** both new suites appended to run-all-166.sh CJS_SUITES (prior entries untouched); full suite green 10/10.

## Verification Evidence

- `node tests/test-act-prebehavior-snapshot.cjs` -> PASS (4/5; writes-then-asserts baseline)
- `node tests/test-act-on-runchain.cjs` -> PASS (6/6; PRE === POST for all three paths)
- `bash tests/run-all-166.sh` -> 10/10 PASSED (Waves 1-4 + Part-8 sweep + em-dash sweep)
- `node scripts/act-command.cjs --chain --problem-type ill-defined --room ./room` -> live walk rides runChain, renders the whole-autonomous report
- `grep -q "chain-executor" commands/act.md` -> ACT_DOC_OK

## Known Stubs

None. The onStep returns a benign `{ chain_output, quality:'high' }` BY DESIGN: act's --chain helper PLANS the walk (records would-run) and does not dispatch framework-runner -- the /mos:act command body dispatches the greenlit prefix, exactly as the donor planChainRun did. This is the documented separation, not a stub.

## Self-Check: PASSED

All created files exist on disk (test-act-prebehavior-snapshot.cjs, act-prebehavior-baseline.json, test-act-on-runchain.cjs, 166-04-SUMMARY.md) and all three task commits (01c40bff, 9cdfb1eb, a30f8635) are present in git history.
