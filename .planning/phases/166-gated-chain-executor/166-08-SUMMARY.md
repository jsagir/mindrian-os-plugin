---
phase: 166-gated-chain-executor
plan: 08
subsystem: chain-executor
tags: [verify, adversarial-verdict, harness-as-code, phase-gate, part-8, part-9, part-3, canon-guards]
wave: 8
requires:
  - 166-01 (recipe-maps three-map authority + pipeline-state isNext hard gate)
  - 166-02 (chain-executor.cjs runChain spine + gate)
  - 166-03 (chain-retry.cjs + graceful partial)
  - 166-04 (act migration onto runChain)
  - 166-05 (pipeline migration + reconcileResume sole-truth)
  - 166-06 (ignite migration, all-material birth chain)
  - 166-07 (larry handoff seam)
provides:
  - "the adversarial structured {passed, findings[]} verdict over the 8 SPEC acceptance tests + canon guards (harness-as-code property 6)"
  - "the B3 convergence-stop NEGATIVE proof by instrumentation (the gap the checker named)"
  - "the Part 8 leak scan over all 10 Phase-166 surfaces"
  - "tests/run-all-166.sh finalized as the SINGLE PASS/FAIL phase gate"
affects:
  - tests/run-all-166.sh (the phase gate; all 8 waves registered)
tech-stack:
  added: []
  patterns:
    - "Phase 163 verdict pattern (record(check,passed,detail) accumulator) mirrored verbatim in shape"
    - "run-all-156.sh aggregator + Part-8/em-dash sweep structure mirrored"
    - "comment-stripped grep-asserts (grep -v '^#'-style) so a doc-comment cannot self-invalidate a count"
key-files:
  created:
    - tests/test-chain-executor-verdict.cjs
    - tests/test-chain-executor-part8-leak.cjs
  modified:
    - tests/run-all-166.sh
decisions:
  - "B3 proven by INSTRUMENTATION (dedicated negative grep, comments stripped) mirroring the B2 grep-assert, not by prose"
  - "the verdict drives the SHIPPED runChain spine through every SPEC scenario; this wave VERIFIES, it does NOT re-implement"
  - "no real defect found in the Waves 1-7 spine; the verdict's leak-net caught one self-defect (its own em-dash) and surfaced it before passing"
metrics:
  duration: ~30m
  completed: 2026-06-18
  tasks: 2
  commits: 2
  files: 3
  verdict_checks: 15
  phase_gate_tally: "23/23 PASS, exit 0"
---

# Phase 166 Plan 08: WAVE 8 VERIFY -- the adversarial structured verdict + the finalized phase gate Summary

The adversarial structured verdict proves BY INSTRUMENTATION that the runChain spine (Waves 1-7) honors the constitution end to end, and tests/run-all-166.sh is finalized as the single green phase gate at 23/23.

## What was built

### Task 1: the adversarial structured verdict + the Part 8 leak scan (53451fa5)

`tests/test-chain-executor-verdict.cjs` (680 lines) returns a structured `{ passed, findings[] }` over 15 checks, mirroring the Phase 163 `record(check, passed, detail)` accumulator verbatim in shape (the harness-as-code property 6 -- "adversarial verify returns a structured verdict, not a vibe"). It drives the SHIPPED `runChain` spine through every SPEC acceptance scenario:

- **acc1** -- three `autonomous_safe` steps run end to end with NO gate, output passed each hop (step 2 SEES step 1's `chain_output`), ONE trace of 3 entries (EXEC-01/02/04).
- **acc2** -- a hold-tagged step at position 2 auto-runs step 1, HALTS at step 2 (`reason: gate_halt`), and resumes step 3 after APPROVE without re-running step 1 (EXEC-03).
- **acc3** -- a `quality:low` output halts the chain even on an `autonomous_safe` step; defense-in-depth asserts `makeGateFn` returns `halt` for a low-quality carry (EXEC-02 quality carry).
- **acc4** -- an irreversible step (publish/email/deploy) is forced-material, halts regardless of an `autonomous_safe` tag, and is NEVER dispatched (`reason: forced_material`; T-166-28 / EXEC-03 HARD RULE).
- **acc5** -- `[stop]` mid-chain ends the chain cleanly with the pre-stop trace FLUSHED (preserved) and no downstream dispatch (EXEC-04 kill switch).
- **acc6** -- a chain killed at step 2 resumes from `pipeline-state.json` (the sole truth) and does NOT re-run step 1; the `isNext` hard gate (`checkPosition` gate=`withhold`/`not_next` for the journaled step) skips it (B1/D-166-02). Asserts `CHAIN_STATE_SOURCE === 'pipeline-state.json'`.
- **acc7** -- delegates the Part 8 sweep to the leak suite (asserts it exits zero); posture joined from the LOCAL registry only (B4/D-166-03).
- **acc8** -- the act/pipeline/ignite/larry migration suites all exit zero (regression: the migration onto runChain did not break the shipped surfaces).

Plus the canon guards by instrumentation:

- **guard_b2** -- decide()'s `decision_trace` is recorded by REFERENCE in the chain trace (reference-identity `===` + `assert.deepStrictEqual`), the decision object's keys are unchanged, and the LIVE `decide()` still returns its documented 5-key shape after the loop calls it (B2: never reshape decide()'s return).
- **guard_b3** -- a DEDICATED NEGATIVE grep over `chain-executor.cjs` source, COMMENTS STRIPPED, asserting NO autonomous-convergence termination branch (`all.?passing` / `all.?green` / `loop until all` / `until.*converge` / `convergence`), mirroring the B2 grep-assert; plus positive proof that the legitimate `gate_halt` / `quality_early_stop` / `budget_brake` stop conditions ARE present. The chain halts on posture per Part 3, never on convergence (B3 by instrumentation -- the gap the checker named).
- **guard_b4** -- recipe-maps exposes three layered authorities (`postureForCommand` / `wiringForReach` / `rankedNextReach`), each read for one job; an unknown command degrades to a withhold-default, never a fabricated `autonomous_safe` (T-166-02).
- **guard_part9** -- the chain journal records a generic step handle (`chain-output:<command>`), never a confirmed truth-claim node and never the `chain_output` body (Part 9: the spine writes bookkeeping; the human confirms truth).
- **guard_exec05** -- a transient 5xx exhaustion returns a graceful partial: the upstream trace is preserved, a failure marker (code 503) is folded into the ONE trace, never a silent drop (SEED-028).
- **guard_exec06** -- `maxSteps` caps the run with a `budget_brake` at the cap.
- **guard_no_em_dash** -- no U+2014 across the Phase-166 lib surfaces + the Wave-8 suites.

`tests/test-chain-executor-part8-leak.cjs` (149 lines) walks all 10 Phase-166 surfaces (lib spine + commands + skill + agent) and asserts zero Brain-write / raw-fetch / external-http / brain-client tokens, mirroring the run-all-156.sh `BRAIN_WRITE` + `RAW_FETCH` regexes with the comment-stripping discipline (a doc-comment naming a forbidden token cannot self-invalidate the count).

### Task 2: finalize tests/run-all-166.sh as the single phase gate (3af82987)

`tests/run-all-166.sh` (462 lines) now aggregates every Phase-166 suite (Waves 1-8) in dependency order, plus:

- the Part-8 grep sweep over the lib + larry surfaces;
- the NEW Wave-8 FROZEN-CONTRACT checks block: (a) B2 no decide()-return mutation (scans for `decision.<known-key> =` assignment), (b) B4 three layered map authorities none merged, (c) the B3 convergence-stop NEGATIVE grep (comment-stripped) + positive stop-condition proof;
- the Wave-6 / Wave-7 doc-content grep gates (carried forward);
- the em-dash sweep (extended to the two Wave-8 suites).

A missing suite gates to a FAIL line, never a crash (`set -uo pipefail`; bash only; no emoji; no em-dashes via the U+2014 codepoint escape).

## The structured verdict (the deliverable)

```
VERDICT: {"passed":true,"checks":[
  acc1_three_autonomous_no_gate_one_trace:true,
  acc2_hold_halts_resume_after_approve:true,
  acc3_quality_low_forces_halt:true,
  acc4_irreversible_forces_halt:true,
  acc5_stop_kill_switch_flushes:true,
  acc6_resume_does_not_rerun_upstream:true,
  acc7_part8_no_brain_egress:true,
  acc8_migration_suites_green:true,
  guard_b2_decide_shape_unchanged:true,
  guard_b3_no_convergence_stop:true,
  guard_b4_three_map_authority_layered:true,
  guard_part9_journal_is_bookkeeping_not_truth:true,
  guard_exec05_graceful_partial:true,
  guard_exec06_maxsteps_cap:true,
  guard_no_em_dash:true
]}
test-chain-executor-verdict: PASS (15/15 checks; the runChain spine honors the constitution)
```

## The full phase gate tally

```
bash tests/run-all-166.sh
========================================
  Summary (166 verification)
========================================
  Total:  23
  Passed: 23
  Failed: 0
========================================
exit 0
```

23 = 17 CJS suites (Waves 1-7) + 2 Wave-8 suites + Part-8 grep sweep + Wave-8 frozen-contract checks + Wave-6 doc gate + Wave-7 doc gate + em-dash sweep.

## Findings (the adversarial result)

No REAL defect was found in the Waves 1-7 runChain spine. Every SPEC acceptance criterion and every canon guard passed against the SHIPPED code by instrumentation. The verify wave behaved as the leak-net the Phase 163 precedent proved: it caught ONE self-defect during construction (a literal em-dash the verdict file itself carried in its em-dash-detector constant) and SURFACED it as a failing finding (`guard_no_em_dash: XX`) rather than silently passing -- exactly the FINDING-163-06-01 pattern. The fix replaced the literal with `String.fromCharCode(0x2014)` so the file carries no literal em-dash to trip its own sweep. After the fix the verdict is 15/15 green.

The B3 convergence-stop negative grep was proven LOAD-BEARING (not a no-op gate): a smuggled `if (allPassing) { break; }` line injected into a copy of `chain-executor.cjs` is correctly caught by the comment-stripped grep.

## Deviations from Plan

None - plan executed exactly as written. The verdict and leak suites were created with the specified structure; run-all-166.sh was finalized with the three frozen-contract checks (B2/B3/B4) and the em-dash sweep extension as the plan required.

## Canon alignment

- **Part 3** -- acc2/acc4 prove the gate halts at material/forced-material steps; the chain never auto-runs a non-`autonomous_safe` step.
- **Part 6** -- the plugin dog-foods its own harness: the verify wave is itself the harness-as-code property-6 adversarial verify, and it caught its own self-defect.
- **Part 7** -- the verdict reuses the shipped Phase 163 pattern + the run-all-156 aggregator structure verbatim in shape; no verify substrate was rewritten.
- **Part 8** -- the leak scan over all 10 surfaces proves zero Brain egress; the Part-8 grep sweep is in the gate.
- **Part 9** -- guard_part9 proves the chain journal writes bookkeeping (a generic step handle), never a confirmed truth-claim and never a body.

## Self-Check: PASSED

- tests/test-chain-executor-verdict.cjs -- FOUND (680 lines, exits 0, 15/15)
- tests/test-chain-executor-part8-leak.cjs -- FOUND (149 lines, exits 0)
- tests/run-all-166.sh -- FOUND (462 lines, 23/23 exit 0)
- commit 53451fa5 -- FOUND (Task 1)
- commit 3af82987 -- FOUND (Task 2)
