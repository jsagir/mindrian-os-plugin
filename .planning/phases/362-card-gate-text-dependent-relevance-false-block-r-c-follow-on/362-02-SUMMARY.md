DISPOSITION: residual-known-false-block
---
phase: 362-card-gate-text-dependent-relevance-false-block-r-c-follow-on
plan: 02
subsystem: card-gate
tags: [card-fire, relevance, structured-signals, replay, tdd, r-c]
requires: [362-01]
provides: [pre-362.json snapshot, measure-relevance-signals-362.cjs, 362-SIGNALS.md, test-362-disposition.cjs]
affects: [362-03]
key-files:
  created:
    - tests/fixtures/card-fire-replay/pre-362.json
    - scripts/measure-relevance-signals-362.cjs
    - .planning/phases/362-card-gate-text-dependent-relevance-false-block-r-c-follow-on/362-SIGNALS.md
    - tests/test-362-disposition.cjs
  modified:
    - tests/fixtures/card-fire-replay/dogfood.json
decisions:
  - "SIGNAL: NONE - no D-03 structured signal clears dogfood-0f86dd63-092046 without silencing a genuine fork; the entry stays a residual known_false_block (D-04)"
metrics:
  completed: 2026-09-29
  tasks: 3
---

# Phase 362 Plan 02: Structured-signal measurement and residual disposition Summary

No structured signal clears the target, so the entry stays a known_false_block with the 362 measurement written into its reason. No gate runtime file changed.

- PLAN_BASE: 00fb9599f81ebf34a253e206e322410c2985437b
- PRE362: 00fb9599f81ebf34a253e206e322410c2985437b
- SIGNAL line: `SIGNAL: NONE`
- 359-OWNER-NOTIFIED: not applicable, tests/test-359-inertness.cjs not edited

## Per-family result

- C1 continuity-turn metadata: C1a (threshold 2-6, fresh floor kept) never clears the target, and min=6 is not monotone (live-2026-09-23-02 turns pass to block); C1b clears it only at min 5-6 by removing the WR-06 floor, which gives 11 new misses (all 9 BACKSTOP plus debug-reach-gate-stale-turn-input and debug-carveout-image-meta-after-human).
- C2 reach timing and state: C2a never clears (4 tokens is not low-signal); C2b clears only at T=10000 and then silences both 30000 ms PRIMARY forks; C2c is not measurable (0 timestamped records, every replayed reach is fresh and unconsumed).
- C3 token provenance: C3a, C3b and C3c all leave the target blocking; the reach subject has no dial layout, the overlap tokens `governance` and `thread` are unstructured prose, and C3b derives no new chrome token from dial-presenter literals.
- C4 359 declared options: C4a cannot apply (0 assistant records, fork_declared false); C4b clears the target but is the forbidden 357 D-08 label-absence rule and silences all three PRIMARY anti-vacuity forks.

## GREEN run (residual branch)

- `node tests/test-362-disposition.cjs` - exit 0, `PASS test-362-disposition 8/8`
- `node tests/test-362-disposition.cjs --mutation` - exit 77, `SKIP mutation: no gate runtime change since PRE362`
- `node tests/test-357-corpus-loader.cjs --dogfood-strict` - exit 0, `PASS test-357-corpus-loader (14 legs)`
- `node tests/test-357-replay.cjs` - exit 0, `PASS 12/12`
- `node tests/test-357-replay.cjs --mutation` - exit 0
- `node tests/test-359-inertness.cjs` - exit 0, `Passed: 4 / 4`
- `node tests/test-359-declared-arm.cjs --tripwires` - exit 0
- `node scripts/replay-card-fire.cjs --surface both --baseline compare` - exit 0
- `git diff --quiet <PRE362> HEAD -- <RUNTIME6>` - exit 0 (no gate runtime change)
- Every other dogfood entry, the meta block, and the target envelope, label and origin deep-equal PRE362

Mutation result: SKIPPED through exit 77, as designed for the residual branch (there is no signal to revert). No implementation-check fallback was needed.

## Commits

- 488722fef test(362-02): pre-362 snapshot and structured-signal measurement, SIGNAL: NONE (D-03, CARD362-03)
- 8212e255c test(362-02): add failing disposition test for dogfood-0f86dd63-092046 (residual, CARD362-04)
- 4b0f9cf44 docs(362-02): dogfood-0f86dd63-092046 stays known_false_block with the 362 measurement as evidence (D-04, CARD362-04)

## TDD Gate Compliance

RED: 8212e255c (D1 failed: the reason did not cite 362-SIGNALS.md yet; D2, D3, D4, D6, D7 passed). GREEN: 4b0f9cf44 (the residual branch's only change is the fixture reason, so the GREEN commit is `docs`, as the plan specifies, not `feat`).

## Deviations from Plan

1. [Rule 1 - measurement accuracy] Monotonicity is measured, not assumed. The plan said every candidate "only adds a pass path or removes gate-side tokens (monotone toward pass)". That is not strictly true: a strip that empties the gate token set makes `gateTopicallyRelevant` return true, and raising the low-signal threshold turns a zero-overlap check into the conservative true. The script therefore re-classifies all 60 entries under each variant and reports any pass-to-block flip; it caught one (C1a:min=6, live-2026-09-23-02).
2. The measurement script scores each variant by re-classifying captured turns with the real `classifyCardFire` (a BASE variant must reproduce all 60 HEAD verdicts first, else exit 2), rather than a separate feature-only predicate. Same inputs and outputs as planned, with a stronger guarantee.

## Self-Check: PASSED

- pre-362.json, measure-relevance-signals-362.cjs, 362-SIGNALS.md and test-362-disposition.cjs exist; the three commits are ancestors of HEAD
