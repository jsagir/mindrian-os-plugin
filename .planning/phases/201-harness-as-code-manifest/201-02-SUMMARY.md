---
phase: 201-harness-as-code-manifest
plan: 02
subsystem: chain-executor-runtime
tags: [SEED-033-L1, D-201-3, CANON-Part3, ralph-safe-step-retry, harness-as-code]
requires:
  - lib/core/chain-executor.cjs (Phase 166 - runChain spine + EXEC-06 budget brake)
  - lib/core/chain-retry.cjs (Phase 166-03 - bounded retry-with-backoff substrate)
  - data/harness-manifest.json (Phase 201-01 - orchestration_spine surface digest)
provides:
  - runChain wraps the autonomous_safe self-critique seam in a BOUNDED verify -> retry loop (opt-in via step.ralph_verify), capped at RETRY_CAP=2 and by the SAME EXEC-06 budget
  - an exhausted safe-step retry HALTS with a DISTINCT haltedAt.reason (retry_exhausted vs budget_brake), never silently proceeds
  - material + irreversible steps are provably unreachable by the retry loop (Canon Part 3 B3 intact)
affects:
  - a transient self-critique miss on a safe step now self-corrects within the budget instead of costing a full human round-trip
tech-stack:
  added: []
  patterns: [ralph-safe-step-retry, bounded-twice-over-cap-and-budget, distinct-halt-reason, regenerate-on-surface-change]
key-files:
  created: []
  modified:
    - lib/core/chain-executor.cjs
    - tests/test-201-bounded-retry.cjs
    - data/harness-manifest.json
decisions:
  - "D-201-3 honored + verified in code: RETRY_CAP default = 2 (RALPH_RETRY_CAP_DEFAULT), drawn from the SAME EXEC-06 budget (budgetRemaining = maxSteps - stepsRun - 1); no separate budget, never unbounded."
  - "Retry is OPT-IN (step.ralph_verify === true) per D-167-04 token economy - a safe step is NOT re-critiqued unless the caller opts it in AND a selfCritiqueFn is supplied. The material-gate invariant holds regardless of the flag."
  - "Task 3 reason granularity: an exhausted retry emits retry_exhausted when the cap bound, budget_brake when the EXEC-06 budget bound strictly below the cap; both still fall through to the gate (LOW quality forced)."
metrics:
  duration: ~20m
  completed: 2026-07-01
  tasks: 3
  files_changed: 3
---

# Phase 201 Plan 02: Bounded Ralph Verify-Retry on Autonomous_Safe Steps Summary

Closed SEED-033 L1: a failed self-critique on an `autonomous_safe` step now drives a BOUNDED verify -> retry-until-pass loop (Ralph inside the safe step) instead of an immediate halt, capped twice over by RETRY_CAP=2 AND the shared EXEC-06 budget, while material and irreversible steps remain provably unretriable and halt at the gate exactly as before (Canon Part 3 B3 intact).

## State on entry (important context)

The phase-201 cluster was landed OUT OF ORDER in a prior session. The core of this plan - the `_ralphSafeRetry` substrate, the opt-in wiring in `runChain`, and the first six behavior-locking assertions - had already been committed at `70ae6f82` (`feat(201-02): opt-in bounded Ralph verify+retry on autonomous_safe steps`), which is an ancestor of HEAD. That commit already satisfied all four frontmatter `must_haves`:

1. safe-step failed critique triggers a bounded retry capped at RETRY_CAP (default 2) - `RALPH_RETRY_CAP_DEFAULT = 2` at :285
2. material steps NEVER retried (guarded by `!_isMaterialStep`, and the gate halts them before onStep even runs) - B3 intact
3. retry draws from the SAME EXEC-06 budget (`budgetRemaining = maxSteps - stepsRun - 1`) - no separate budget
4. cap exhausted without a pass HALTS (forces LOW -> gate), never silently proceeds

What was genuinely MISSING was the plan's **Task 3**: the distinct `haltedAt.reason` observability (`retry_exhausted` vs `budget_brake`). That is what this execution implemented, test-first.

## What shipped (this execution)

- **`lib/core/chain-executor.cjs`** - `_ralphSafeRetry` now returns `{ result, quality, attempts, exhausted, haltReason }`. `haltReason` distinguishes `budget_brake` (the EXEC-06 budget bound the retries strictly below the cap: `budgetRemaining < cap`) from `retry_exhausted` (the cap itself bound). `runChain` captures `ralphHaltReason` and, when set, HALTS the step with that specific reason BEFORE the generic `quality_early_stop` branch - so the halt is observable as a Ralph-loop exhaustion. The step still falls through to the gate (quality forced LOW); it never silently proceeds. The material-step path is byte-unchanged (the branch is guarded by `!_isMaterialStep` and is structurally downstream of the gate that already halts material steps).
- **`tests/test-201-bounded-retry.cjs`** - retitled the never-passes case to assert the new `retry_exhausted` reason + exactly-cap retry count + LOW-quality gate fall-through; added a Task 3(b)+(c) case proving that when `maxSteps` binds below the cap the reason is `budget_brake`, not `retry_exhausted`. 7 assertions total.
- **`data/harness-manifest.json`** - regenerated the `orchestration_spine` runtime-surface digest so the DECLARED harness tracks the RUNNING harness (the 201-01 drift tripwire correctly fired on my chain-executor.cjs edit).

## Test results (actual)

```
$ node tests/test-201-bounded-retry.cjs
test-201-bounded-retry
  ok   opted-in safe step retries until the critique passes, then proceeds
  ok   opted-in safe step that never passes halts as retry_exhausted after exactly the cap
  ok   DEFAULT (no ralph_verify): safe step is NOT critiqued or retried (token economy)
  ok   MATERIAL step with ralph_verify is NOT retried (B3 intact)
  ok   IRREVERSIBLE step with ralph_verify never retries (forced-material halt)
  ok   retries are bounded by the EXEC-06 budget (maxSteps), not just the cap
  ok   Task 3(b)+(c): when the EXEC-06 budget binds below the cap, the halt reason is budget_brake

PASS test-201-bounded-retry (7 assertions)
```

The load-bearing **material-step-not-retried proof** (`MATERIAL step with ralph_verify is NOT retried (B3 intact)`): a step with `material:true` + a material posture + `ralph_verify:true` halts at the gate with `onStep.count() === 0` - the retry loop is never entered. The irreversible case is the second proof: `deploy-thing` with `ralph_verify:true` halts with reason `forced_material`, `onStep` never runs.

Regression (no material-gate change; the RED test proved the code was needed):

```
$ bash tests/run-all-201.sh   -> Phase 201: PASS=5 FAIL=0 SKIP=0
$ bash tests/run-all-167.sh   -> Passed: 12  Failed: 0
$ bash tests/run-all-166.sh   -> Passed: 23  Failed: 0
$ node scripts/build-harness-manifest.cjs --check  -> harness-manifest: OK
```

Per-file chain-executor regression (all PASS): test-chain-executor-loop, -gate, -fable-mode, -verdict, -part8-leak, test-chain-graceful-partial, test-chain-retry-backoff, test-act-on-runchain, test-ignite-on-runchain, test-pipeline-on-runchain.

RED gate was observed before GREEN: against `70ae6f82` code the new assertions failed (`actual 'quality_early_stop' expected 'retry_exhausted'`), committed at `7ac6d3a3`, then made green by `6ff5e94e`.

## Deviations from Plan

**1. [Rule 3 - blocking issue] Regenerated data/harness-manifest.json.**
- **Found during:** Task 3 GREEN. My legitimate edit to chain-executor.cjs tripped the 201-01 drift tripwire (`STALE: the orchestration_spine runtime surface digest drifts from the on-disk file`), failing run-all-201 and run-all-167.
- **Fix:** ran `node scripts/build-harness-manifest.cjs` to re-declare the `orchestration_spine` digest. Exactly one line changed (the digest). This is the intended regenerate-on-surface-change workflow from 201-01, not a hand-edit.
- **Files:** data/harness-manifest.json.
- **Commit:** `6ff5e94e`.

**2. [Prior out-of-order landing] Task 2 core was already committed.**
- The `_ralphSafeRetry` substrate + opt-in wiring + the first six assertions landed earlier at `70ae6f82` (ancestor of HEAD). All four `must_haves` were already met by it. This execution added only the Task 3 reason-distinction refinement and its edge-case tests. Task 1's "characterize the pre-change baseline" step could not be honored literally (the change was already landed); the behavior-locking assertions from `70ae6f82` serve the same regression-guard purpose.

**3. [Material gate D-201-3 pre-resolved]** The plan's Task 2 Step 1 is a material gate for navigator sign-off on RETRY_CAP=2 + shared-budget. The orchestrator prompt confirmed D-201-3 is resolved (cap=2, drawn from the EXEC-06 budget). Verified both hold in code (`RALPH_RETRY_CAP_DEFAULT = 2`; `budgetRemaining = maxSteps - stepsRun - 1`), so no halt was needed.

## Self-review

- **Canon Part 3 B3 intact:** material + irreversible steps are unreachable by the retry loop - proven by two assertions (`onStep.count() === 0` for both). The gate halts them upstream; the ralph branch is additionally guarded by `!_isMaterialStep`.
- **Bounded twice over:** cap (default 2) AND the EXEC-06 budget (`min(cap, budgetRemaining)`); never unbounded, never a separate budget, never a convergence stop for material steps.
- **Halts, never proceeds:** an exhausted retry forces LOW and falls through to the gate; the distinct reason is observability only, not an escape.
- **No em-dashes** in any changed file (verified).

## Commits

- `7ac6d3a3` test(201-02): retry cap + budget-brake edge cases (retry_exhausted vs budget_brake) [RED]
- `6ff5e94e` feat(201-02): distinct halt reasons for exhausted safe-step retry (SEED-033 L1) [GREEN]
- (prior, ancestor) `70ae6f82` feat(201-02): opt-in bounded Ralph verify+retry on autonomous_safe steps

## Self-Check: PASSED

- FOUND commit 7ac6d3a3 (RED)
- FOUND commit 6ff5e94e (GREEN)
- FOUND commit 70ae6f82 (prior Task 2 core, ancestor of HEAD)
- FOUND lib/core/chain-executor.cjs, tests/test-201-bounded-retry.cjs, 201-02-SUMMARY.md
- node tests/test-201-bounded-retry.cjs -> 7 passed, 0 failed
- bash tests/run-all-201.sh -> PASS=5 FAIL=0 SKIP=0
- bash tests/run-all-167.sh -> 12 passed, 0 failed ; run-all-166.sh -> 23 passed, 0 failed
- node scripts/build-harness-manifest.cjs --check -> OK
