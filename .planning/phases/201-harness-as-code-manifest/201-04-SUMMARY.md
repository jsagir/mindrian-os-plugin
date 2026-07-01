---
phase: 201-harness-as-code-manifest
plan: 04
subsystem: ralph-loop-eval-gate
tags: [SEED-033-eval-gate, REUSE-196, CANON-Part8, plurai-local-parity, hard-invariant-gate]
requires:
  - lib/core/chain-executor.cjs (Phase 201-02 - the L1 bounded-retry behavior being regression-locked)
  - lib/core/graph-refine-loop.cjs (Phase 201-03 - the L2 verified-write behavior being regression-locked)
  - evals/plurai harness (Phase 196 - synthetic-CSV -> offline-baseline -> local-parity pattern, reused not forked)
provides:
  - classifyLoopTrace(trace) -> { label: correct|incorrect, violations: [] } - a local, deterministic, offline reproduction of the Plurai judge
  - evals/plurai/08-ralph-loop-behavior.csv - 18 labeled synthetic loop traces (7 correct / 11 incorrect)
  - evals/plurai/201-baseline.json - persisted CI baseline (baseline_deferred degrade path)
  - tests/run-all-201.sh - the phase aggregator (4 test legs + the --check tripwire leg)
affects:
  - the two Ralph behaviors (L1 bounded retry, L2 graph-refine) are now regression-locked WITHOUT any runtime Plurai call (Canon Part 8: Plurai is build/CI only)
tech-stack:
  added: []
  patterns: [plurai-local-parity, hard-invariant-not-threshold, frozen-boolean-predicates, baseline-deferred-degrade, run_if-skip-aggregator]
key-files:
  created:
    - lib/core/ralph-loop-gate.cjs
    - evals/plurai/08-ralph-loop-behavior.csv
    - evals/plurai/201-baseline.json
    - tests/run-all-201.sh
    - tests/test-201-ralph-loop-gate.cjs
  modified:
    - evals/plurai/README.md
decisions:
  - "The four violations are HARD invariant checks encoded as frozen boolean predicates (ralph-loop-gate.cjs:29-34), never a data-swept threshold. A trace that retries a material step, or is unbounded, or carries an unverified write, or proceeds silently after cap exhaustion, is ALWAYS incorrect."
  - "classifyLoopTrace deliberately IGNORES its second (options) argument for the verdict (:37-39) - 'a gate that cannot fail is not a gate'. The invariant cannot be talked into passing by any caller context."
  - "REUSE-196: same synthetic-CSV -> baseline -> local-parity pattern; no new eval harness (Canon Part 7 reuse-before-build)."
  - "baseline_deferred: true (201-baseline.json) - the sanctioned DEGRADE path (same as 196-baseline.json): the Plurai eval is an interactive multi-turn MCP flow that cannot run in the non-interactive executor, so the 18 rows are hand-labeled deterministically and the local gate reproduces every label (100% parity). Standing follow-up: re-run /evals:eval interactively to replace with a hosted Plurai baseline."
metrics:
  completed: 2026-07-01
  tasks: 3
  files_changed: 7
  reconstructed: "SUMMARY authored 2026-07-02 from shipped commit 5ba0e932; the earlier out-of-order pass that landed the code did not write a SUMMARY."
---

# Phase 201 Plan 04: Ralph-Loop Behavior Eval Gate (Plurai parity) Summary

Regression-locked the two Ralph behaviors (L1 bounded retry from 201-02, L2 graph-refine from 201-03) with an eval gate, reusing the Phase 196 synthetic-CSV -> offline-baseline -> local-parity pattern. The judge answers one question: is this loop trace CORRECT against the SEED-033 contract (retry-only-safe-steps, halt-at-material, verified-writes-only, bounded)? `lib/core/ralph-loop-gate.cjs::classifyLoopTrace` reproduces that verdict deterministically and offline, so nothing calls Plurai at runtime (Canon Part 8). This is the phase GATE - no phase closes without it.

## State on entry (important context)

The phase-201 cluster landed OUT OF ORDER in a prior session. The code for this plan was committed at `5ba0e932` (`feat(201-04): Ralph-loop behavior eval gate + phase aggregator (Plurai parity)`), an ancestor of HEAD, but that pass did not write a SUMMARY. This SUMMARY is reconstructed from the shipped source, the persisted baseline, and the live test run; no code was changed in the reconstruction.

Note on the commit footprint: `5ba0e932` also touched `data/harness-runtime-manifest.json` (a one-line digest bump). That file was the SIBLING fork manifest later DELETED by the 201-01 re-run (commit 5658c7b1, Canon Part 11 consolidation); the one-line edit went away with the deletion. There is exactly one manifest on HEAD (`data/harness-manifest.json`).

## What shipped

- **`lib/core/ralph-loop-gate.cjs`** (created) - `classifyLoopTrace(trace)` runs four HARD invariant predicates (`retried_material_step`, `unbounded`, `unverified_write`, `silent_proceed_after_cap`) frozen in `HARD_VIOLATIONS` (:29-34); any hit yields `incorrect` with the violation list. The second argument is accepted but deliberately ignored for the verdict (:37-39).
- **`evals/plurai/08-ralph-loop-behavior.csv`** (created) - 18 synthetic loop traces (`Sample,Label,Reasoning`), 7 `correct` (safe-step retried then passed, material step halted, verified-only writes, bounded) and 11 `incorrect` (retried a material step, unbounded, wrote an unverified edge, proceeded silently after cap).
- **`evals/plurai/201-baseline.json`** (created) - persisted CI baseline with the judge prompt, the canon contract, and precision/recall/f1/accuracy all 1.0 over the hand-labeled rows; `baseline_deferred: true`.
- **`tests/run-all-201.sh`** (created) - the phase aggregator: 4 test legs (harness-manifest, bounded-retry, graph-refine-loop, ralph-loop-gate) plus the `build-harness-manifest.cjs --check` tripwire as its own leg, each `run_if`-guarded (wave-0 SKIP contract, modeled on run-all-196.sh).
- **`tests/test-201-ralph-loop-gate.cjs`** (created) - the parity test (local label matches CSV Label on every row) plus the explicit material-retry-always-incorrect invariant test.
- **`evals/plurai/README.md`** (modified) - the task row mapping this CSV to the SEED-033 contract + judge prompt.

## Test results (actual, live-verified)

```
$ node tests/test-201-ralph-loop-gate.cjs
test-201-ralph-loop-gate
  ok   CSV parsed with both labels present
  ok   local gate matches the Plurai label on every row (parity)
  ok   a material retry is ALWAYS incorrect, regardless of options (hard invariant)
  ok   an unbounded loop and an unverified write are each incorrect
  ok   a clean trace is correct with no violations
  ok   201-baseline.json exists with precision/recall and the local gate meets it
PASS test-201-ralph-loop-gate (6 assertions)

$ bash tests/run-all-201.sh   -> Phase 201: PASS=5 FAIL=0 SKIP=0
```

## Canon invariants (source-verified)

- **Hard checks, not thresholds:** the four violations are frozen boolean predicates (:29-34); any hit -> incorrect. No data sweep, no tunable threshold.
- **Not overridable:** the options argument is deliberately ignored for the verdict (:37-39) - a violating trace cannot be talked into passing.
- **Part 8 offline:** the runtime gate is local + deterministic; Plurai is invoked only build/CI, synthetic-only. `baseline_deferred:true` records the degrade path.
- **REUSE-196:** same synthetic-CSV -> baseline -> local-parity pattern; no new harness (Canon Part 7).

## Known caveat (tracked, not a defect)

`201-baseline.json` is `baseline_deferred: true` with `method: hand-labeled` - the sanctioned degrade path (identical to 196-baseline.json), because the Plurai eval is an interactive multi-turn MCP flow the sequential executor cannot drive. The 18 rows are hand-labeled deterministically and the local gate reproduces every label (100% parity). Standing follow-up: re-run `/evals:eval` interactively after `/reload-plugins` to replace this with a hosted Plurai baseline.

## Self-review

- Reuse-196: no new eval harness (Part 7).
- Part 8: Plurai synthetic/offline; the runtime gate is local + deterministic.
- The invariants (no material retry, bounded, verified-only, no-silent-proceed) are hard checks, not swept thresholds.
- No em-dashes in any shipped file (verified).

## Commits

- `5ba0e932` feat(201-04): Ralph-loop behavior eval gate + phase aggregator (Plurai parity)
