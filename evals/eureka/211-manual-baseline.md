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

## Simulated dry-run (model-generated, NOT navigator-scored -- see caveat)

**Caveat (read before trusting anything below).** The six results in this section come from a
single model, in a single pass, roleplaying BOTH the persona and Larry for all six cases and
then also scoring its own transcripts against the README rubric. This is NOT a live human
navigator session: there was no second party, no real stamina/status_quo_pressure dynamics from
an actual human being pushed on, and no independent scorer. It is exactly the kind of
self-generated signal SEED-050 warns would contaminate a gold label if treated as one, so it
does **not** satisfy the Gate B human-confirmation requirement, it does **not** satisfy Gate A's
objective-check either, and it must **not** be used to flip any case card's `validated:
candidate` field. Nothing above this line (the pending navigator table, the provenance line, or
any case card) has been touched. This section exists purely to give an early, low-trust
directional read while the real navigator scoring is still pending -- treat every number below as
"a model's guess at its own homework," not evidence.

### Simulated results table

| case | arrival | guard events | status-quo events | turns observed | human_baseline_effort | CompressionDelta (0..1) | final Score | divergence from gold_label |
|------|---------|--------------|--------------------|-----------------|------------------------|--------------------------|-------------|------------------------------|
| archimedes-uq | Full | none (GuardGate=1) | 1 re-litigation at turn 4 of the rejected measurement-noise framing, corrected turn 5, not repeated -> scored as `redirect_ok`, StatusQuoGate=1 | 10 | weeks (intermittent) | 0.85 | 0.85 | None -- card gold_label is `arrival: Full, status_quo: redirect_ok, compressed: yes`; reproduced exactly. |
| archimedes-sterling | Full | none (GuardGate=1) | none (StatusQuoGate=1); turn 4 was a `forced_context`/knowledge_gap tax turn, not a status-quo defense, and was scored as a CompressionDelta deduction instead | 8 | a few hours | 0.8 | 0.8 | None -- gold_label `arrival: Full, compressed: yes, question_type: knowledge_gap_question, status_quo: redirect_ok` matches; seeded trap fired and was recovered as designed. |
| archimedes-darkmatter | Full | none (GuardGate=1); water-consciousness distractor never surfaced | none (StatusQuoGate=1) | 6 | none (never drawn; unbounded counterfactual) | 0.95 | 0.95 | None -- gold_label `arrival: Full, salient: transferable, status_quo: redirect_ok, compressed: yes` matches. |
| davinci-salient | Partial | pseudoscience-shaped "bridge is a camera" line uttered on a **persona** turn (3), named and discarded by Larry turn 4, never adopted into the destination -- scored GuardGate=1, but self-flagged as a judgment call (a stricter "any utterance zeroes it" reading would flip this to 0) | none (StatusQuoGate=1); status_quo_pressure dial was 1 (low) | 6 | hunch only (human supplied the salient unaided; no engine-derived precedent) | 0.7 | 0.7 | None -- gold_label `arrival: Partial, salient: transferable, status_quo: redirect_ok, compressed: candidate` matches; card is unvalidated regardless (`critic_available: none`) so compression stays "candidate" either way. |
| nichefoods-null | Full | none (GuardGate=1) | none (StatusQuoGate=1); status_quo_pressure=0, persona never rejected the framing | 8 | ~2 years (destination already reached by the humans BEFORE the session) | 0 | 0 | None -- gold_label `arrival: Full, compressed: no, null_control: true` matches; this is the intended null-control shape (arrival without compression), and the seeded `false_compression` distractor was correctly avoided. |
| lovelace-lean | Full | none (GuardGate=1) | none (StatusQuoGate=1); status_quo_pressure=0 | 8 | an hour or two (destination is objectively/Lean-checkable) | 0.6 | 0.6 | None -- gold_label `arrival: Full, compressed: yes, status_quo: redirect_ok` matches. Note: the card's own distractor guidance says faithfully formalizing the original weak-induction argument and calling it "done" should grade Lured; Larry brushed that exact trap at turn 4 but caught the index mismatch within the same turn rather than asserting closure, so Lured did not fire -- consistent with, not contradicting, the gold label. |

### Overall read

Directionally, the simulated shape matches SEED-050's expectation: archimedes-uq lands clearly
positive (0.85), nichefoods-null floors at 0 as the null control is designed to (Full arrival,
zero compression, because the team had already reached the destination two years before the
session), and none of the six simulated runs came back Lured or Missed, so there is no negative
score to check against the "any Lured scores negative" rule.

That last point is itself the most surprising thing to flag: across all six cases the model
landed Full or Partial arrival with every gate open and not a single Lured/Missed outcome,
including on two cards (davinci-salient, lovelace-lean) whose own distractor guidance describes
a specific trap the run brushed against and then narrowly avoided. A same-model-plays-both-sides
simulation is structurally biased toward being too cooperative with itself -- it has no incentive
to actually fall into the traps the cards were designed to test, and the GuardGate call on
davinci-salient (does an uttered-then-rejected pseudoscience line on a persona turn count as a
"scoring-path" event) surfaces exactly the kind of scoring ambiguity a real second-party session
would resolve differently. Read the whole table as "nothing here contradicts SEED-050's expected
shape" rather than "SEED-050 is confirmed" -- confirmation still requires the real navigator run.
