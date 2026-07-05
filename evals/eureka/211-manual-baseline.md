# 211 manual COMPRESSION baseline (first gold set)

**STATUS: PENDING NAVIGATOR HAND-SCORING (honest deferral, not scored).**

This file is the honest deferral record for Task 3 of plan 211-04. The six gold case cards are
authored, schema-valid, and committed. The hand-scoring step below CANNOT be done by the
autonomous executor by design: the hand-scores ARE the human gold labels the critic will later
be validated against, so a model self-scoring here would CONTAMINATE the baseline (the same
reason SEED-050 forbids synthesizing `upload_data` records). No scores have been fabricated.

## What the navigator does to close this (the exact steps)

For each of the six cards under `evals/eureka/cases/`, in a FRESH Larry session:

1. Play the persona per the card's scenario script, honoring its `dials`
   (stamina, status_quo_pressure, retrieval_gap, critic_available).
2. Record per card: turns-to-destination (or `Missed` / `Lured`), any `pseudoscience` turn
   (zeroes GuardGate), any `status_quo_stuck` turn (zeroes StatusQuoGate), and the arrival grade
   (`Full` / `Partial` / `Missed` / `Lured`).
3. Hand-score with the README rubric: `Score = CompressionDelta x GuardGate x StatusQuoGate`,
   where `CompressionDelta` in 0..1 comes from `human_baseline_effort` vs observed turns.
4. Fill the table below and add the dated provenance line.
5. For each card the run CONFIRMS (destination + distractors real-shaped, label right = Gate B,
   or Gate A objective check for the lean_checkable cases), flip that card's `validated:
   candidate` to `validated: true`. Unconfirmed cards STAY `candidate`.
6. Re-run `node tests/test-211-case-cards.cjs` - it must still exit 0 after the flips.

Contamination guard (SEED-050): if a published insight arrives in <= 2 turns from the base model
cold, it was RETRIEVED not reasoned - discard that row. The calibration set must stay DISJOINT
from the eval set.

## Baseline table (TO BE FILLED BY THE NAVIGATOR)

| case | arrival | guard events | status-quo events | turns observed | human_baseline_effort | CompressionDelta (0..1) | final Score |
|------|---------|--------------|-------------------|----------------|-----------------------|-------------------------|-------------|
| archimedes-uq | _pending_ | _pending_ | _pending_ | _pending_ | weeks (intermittent) | _pending_ | _pending_ |
| archimedes-sterling | _pending_ | _pending_ | _pending_ | _pending_ | a few hours | _pending_ | _pending_ |
| archimedes-darkmatter | _pending_ | _pending_ | _pending_ | _pending_ | none (never drawn) | _pending_ | _pending_ |
| davinci-salient | _pending_ | _pending_ | _pending_ | _pending_ | hunch only (human supplied salient) | _pending_ | _pending_ |
| nichefoods-null | _pending_ | _pending_ | _pending_ | _pending_ | ~2 years | _pending_ (expect ~0) | _pending_ (expect ~0) |
| lovelace-lean | _pending_ | _pending_ | _pending_ | _pending_ | an hour or two | _pending_ | _pending_ |

Expected shape once scored (from SEED-050, for sanity-checking the fill): archimedes-uq scores
positive; nichefoods-null scores ~0 (arrival WITHOUT compression); any `Lured` outcome scores
negative.

## Provenance line (TO BE ADDED ON FILL)

> _(fill on scoring)_ hand-scored by the navigator, first baseline, N=6 - a DEMO not a
> validation set per SEED-050, dated YYYY-MM-DD.

---

*Deferral recorded 2026-07-05 by the autonomous executor (plan 211-04, Task 3). Cards authored
and committed; the run-and-hand-score step awaits real navigator judgment.*
