---
phase: quick
plan: 261006-d4
subsystem: research-planner
tags: [counterevidence, plan-17, bad_slot, sentence-limiter, closure-D4]
key-files:
  modified:
    - lib/core/research-planner/families.cjs
    - lib/core/research-planner/deep.cjs
    - tests/test-3692-routing.cjs
decisions:
  - "The new rule lives in a new helper composableDerivationTerm, used only by the counterevidence composer. composableTerm is unchanged, so grants, slot checks and the connections recall keep their behavior."
  - "Threshold: 5 or more content words (whitespace words that keep a content token) is a sentence."
metrics:
  tasks: 2
  commits: 2
completed: 2026-10-06
---

# Quick 261006-d4: short sentence limiter is a CE gap Summary

A limiter statement or goal target of 5 or more content words is now a sentence in the counterevidence composer, even without sentence punctuation. It becomes a gap (`bad_slot:limiter` or `bad_slot:goal`, a `refused_before_fetch` operation) and is never quoted into a query.

## Root cause

LM1 has no derivation row, so it classifies as `assumed`. `prepareCounterevidence` composed its statement through `composableTerm`, which flags prose only by markdown marks, a leading marker or a sentence boundary (end punctuation, space, more text). `Entanglement requires pre-positioned physical barriers` has none of these. Plan 17's own test used a 132-character statement ending in a question mark, so the gap did not show in R5d.

## Commits

- 4e4fdc6ca test: RED leg R5e. Measured before the fix: `CE:limiter_derivation:L9 executed_empty`, the short sentence was sent (1 ledger operation carried it).
- fix commit (this task): `composableDerivationTerm` in families.cjs, two call sites in deep.cjs.

## Verification (PROVEN, each file run singly after the fix)

- `node tests/test-3692-routing.cjs`: PASS 19 FAIL 0 (R5d and R5e green).
- `node tests/test-3692-query-kinds.cjs`: PASS 14 FAIL 0.
- `node tests/test-3692-closure.cjs`: PASS 26 FAIL 1 KNOWN 3. D4 and D10 pass. The 1 FAIL is LINT (plan 369.2-30). LINT read 78 violations at the plan 33 run and 21 in this run, because plan 30 edits card wording in parallel.
- Every other `tests/test-3692-*.cjs` exit 0, no FAIL line, except `test-3692-wording.cjs` (see Risks).
- `node tests/test-355-part8-egress.cjs`: PASS 34 FAIL 0. `node tests/test-363-runner-contract.cjs`: PASS 9 FAIL 0.
- `tests/test-363-*.cjs`, each singly: all exit 0 except `test-363-acceptance-whitespace` (W3, W4), `test-363-cli` (C13) and `test-363-live-smoke` (exit 77, skip code). `test-363-baseline` and `test-363-perspective` print no PASS line and exit 0.

## Risks and notes

- `test-3692-wording`, `test-363-acceptance-whitespace` (W3, W4) and `test-363-cli` (C13) failed in the sweep while plan 30 had uncommitted edits in plan.cjs, job-lines.cjs, planner.cjs and quick.cjs. They are card wording tests. To check the cause I ran them on a `git archive` copy of HEAD with only my two lib files overlaid: acceptance-whitespace 15/0 and cli 23/0 pass there, routing 19/0 pass. `test-3692-wording` fails 5 legs (WD6, WD7c, WD8c, WD9c, WD10) in that copy; they are the plan 30 RED tests committed at 52fb81688 (WD6 also reads the git head, absent in an archive). In the live tree wording read 14/1 in the sweep and 15/0 on a later re-run, so plan 30 moved during the run.
- Not run: any `tests/run-all-*.sh` aggregator. UNVERIFIED-BY-EXECUTOR.
- The round-one lane path (`spec.slot`, a limiter the user bound in `slots.limiter`) is not changed. A bound slot is the user's own term.

## Deviations

None.
