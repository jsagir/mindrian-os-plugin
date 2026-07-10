# Phase 212 Eureka Grounding Guard Calibration Report

> First REAL rulings of the Grounding Guard: the full local pipeline (Stage A
> deterministic gates plus the Stage B two-pass rubric plus verdict-by-code plus the
> calibration ruling) run against the 6 SEED-050 gold cards and the 2 JHU Opportunity
> Statement fixtures, with the REAL local embedder (MongoDB/mdbr-leaf-ir) computing Stage A
> features and a REAL local judge (this Claude session) answering the two rubric passes.
> The >=0.85 accuracy bar is NOT self-certified here: it is a blocking human-verify leg
> (plan 05 Task 2). Status stays baseline_deferred until the navigator approves.

## Provenance

| Field | Value |
| ----- | ----- |
| Run mode | LIVE local pipeline (no stubs) |
| Embedder (Q4 lock) | MongoDB/mdbr-leaf-ir |
| Local judge | this Claude session, two-pass (neutral + adversarial), per D2 |
| Effective Stage A floors | swap-invariance >= 0, entity >= 0, swap_k = 3 |
| Fabricated-quantity Gate 1 | REAL default (the D6 pseudoscience-recall gate) |
| Network egress | none (local model cache only; no Plurai, no Brain) |
| Baseline status | baseline_deferred (human-gated flip in Task 2) |
| Run date | 2026-07-10 |

Why the two content-shaped floors are permissive here: on real destination prose the
shipped mdbr-leaf-ir-calibrated swap-invariance floor (0.05) and entity floor (2) over-kill
genuine transferable cards, because the swap perturbation moves only 3 nouns in a long
paragraph. The plan-05 calibration TARGET is the Stage B rubric plus verdict-by-code; the
two content floors own their own calibration in tests/test-212-critic-stage-a.cjs. Nothing
is hidden: the raw default-gate route (what the shipped floors WOULD do) is recorded per
candidate below, and the swap/entity over-kill on long prose is flagged for the navigator.

## Per-candidate rulings

`match` compares the code verdict to the gold label (cards only; drafts carry no gold).
`conf(prov)` is the confidence the populated buckets WOULD yield; `conf(live)` is what the
runtime returns today (unknown, because the baseline is deferred until Task 2 approval).

| Candidate | Kind | Stage | shift | entity | rubric_pattern (N/A) | verdict / tag | conf(prov) | conf(live) | gold | match |
| --------- | ---- | ----- | ----- | ------ | -------------------- | ------------- | ---------- | ---------- | ---- | ----- |
| archimedes-sterling | gold-card | B | 0.13 | 1 | 111111 (n=111111/a=111111) | transferable / passes_all_gates | high | unknown | transferable | yes |
| archimedes-uq | gold-card | B | 0.15 | 0 | 111111 (n=111111/a=111111) | transferable / passes_all_gates | high | unknown | transferable | yes |
| archimedes-darkmatter | gold-card | B | 0.08 | 3 | 111111 (n=111111/a=111111) | transferable / passes_all_gates | high | unknown | transferable | yes |
| davinci-salient | gold-card | B | 0.05 | 0 | xxxxx1 (n=111111/a=000001) | general_shallow / rubric_disagreement | unknown | unknown | transferable | NO |
| lovelace-lean | gold-card | B | 0.15 | 2 | 111111 (n=111111/a=111111) | transferable / passes_all_gates | high | unknown | transferable | yes |
| nichefoods-null | gold-card | B | 0.17 | 3 | 111011 (n=111011/a=111011) | general_shallow / low_novelty_delta | high | unknown | general_shallow | yes |
| pair-1-arrhythmias | jhu-draft | B | 0.03 | 31 | 1x1111 (n=111111/a=101111) | general_shallow / rubric_disagreement | unknown | unknown | pending_human_review | n/a |
| pair-2-cerebral-aneurysm | jhu-draft | B | 0.04 | 15 | 111111 (n=111111/a=111111) | transferable / passes_all_gates | high | unknown | pending_human_review | n/a |

## Gold-card accuracy

Gold-card accuracy: 5/6 = 0.83.

- archimedes-sterling (the lean-checkable objective ANCHOR, the one non-negotiable ground
  truth per D3): routed **transferable**, gold **transferable** -> CORRECT.
- MISS: davinci-salient routed general_shallow / rubric_disagreement, gold transferable.

## Pseudoscience recall and precision

- Recall: the D6 negative corpus (Molecular Casino $2-5B, tahini x blockchain 0.825, wind
  turbines as living weather algorithms 0.985) is held at 3/3 by the automated suite
  tests/test-212-negative-corpus.cjs (run under bash tests/run-all-212.sh). This runner does
  not re-assert that automated recall; it confirms PRECISION on the gold + draft set below.
- Precision on this run: clean. No gold card or draft was WRONGLY routed to pseudoscience.

## FIRST REAL RULINGS -- the two JHU Opportunity Statements

Until this run both drafts were flagged "not yet critic-verified" in the 2026-07-06 room
entry. These are the Grounding Guard's first real-workload rulings, produced by the real
embedder and the real two-pass local judge. They carry NO invented gold label; the navigator
rules on them at the Task 2 checkpoint.

### pair-1-arrhythmias

- Verdict: **general_shallow**
- reasoning_tag: `rubric_disagreement`
- rubric_pattern: `1x1111` (neutral `111111`, adversarial `101111`)
- coarse confidence: provisional `unknown`, live `unknown` (unknown until the Task 2 approval flips the baseline to calibrated)
- Stage A features: shift 0.03, entity_count 31, embedder MongoDB/mdbr-leaf-ir

### pair-2-cerebral-aneurysm

- Verdict: **transferable**
- reasoning_tag: `passes_all_gates`
- rubric_pattern: `111111` (neutral `111111`, adversarial `111111`)
- coarse confidence: provisional `high`, live `unknown` (unknown until the Task 2 approval flips the baseline to calibrated)
- Stage A features: shift 0.04, entity_count 15, embedder MongoDB/mdbr-leaf-ir

Reading of the two first rulings (why they differ): pair-2-cerebral-aneurysm is the stronger,
genuinely SYNERGISTIC combination -- the arterial-territories atlas informs the EmboGel delivery
(it predicts the catheter path and injection volume, and flags where to co-deliver therapeutics),
so the two inventions interlock with no schema orphan; both the neutral and adversarial passes
agree it is a real transfer. pair-1-arrhythmias is a plausible but more ADDITIVE bundle -- the
MRI-compatibility (shim coil) and the low-pain electrode (cardiac sock) are two separable benefits
of the same device class rather than one interlocking mechanism, so the skeptical adversarial pass
completes a counter-mapping (schema orphan) where the charitable neutral pass does not; the two
passes disagree and the guard routes it to the cautious verdict rather than blessing it. That is
the two-pass protocol working as designed: it separates a synergistic combination from a stapled one.

## Raw default-gate Stage A (honesty note, nothing hidden)

What the SHIPPED mdbr-leaf-ir-calibrated floors (swap-invariance >= 0.05, entity >= 2) WOULD have done, derived from the measured features:

| Candidate | measured shift | measured entity | default-gate route / tag |
| --------- | -------------- | --------------- | ------------------------ |
| archimedes-sterling | 0.13 | 1 | general_shallow / entity_nonspecific |
| archimedes-uq | 0.15 | 0 | general_shallow / entity_nonspecific |
| archimedes-darkmatter | 0.08 | 3 | pass / passes_stage_a |
| davinci-salient | 0.05 | 0 | general_shallow / entity_nonspecific |
| lovelace-lean | 0.15 | 2 | pass / passes_stage_a |
| nichefoods-null | 0.17 | 3 | pass / passes_stage_a |
| pair-1-arrhythmias | 0.03 | 31 | general_shallow / domain_swap_invariant |
| pair-2-cerebral-aneurysm | 0.04 | 15 | general_shallow / domain_swap_invariant |

Finding for the navigator: on long real prose the swap-invariance and entity floors over-kill
genuine transferable candidates (including sterling, the objective anchor, and both drafts).
That is a Stage A CONTENT-FLOOR calibration question (Pitfall 7: criteria drift needs a
re-calibration pass, not a quiet threshold nudge), tracked separately from this rubric
calibration. It does not change the rubric-level rulings above.

## Calibration buckets (populated, status still baseline_deferred)

Keyed by rubric_pattern -> {n, correct, verdict_observed}. Confidence bands derive from
correct/n: >=0.9 high, >=0.7 medium, else low; disagreement and unseen patterns stay unknown.

| rubric_pattern | n | correct | verdict_observed | band |
| -------------- | - | ------- | ---------------- | ---- |
| 111011 | 1 | 1 | general_shallow | high |
| 111111 | 4 | 4 | transferable | high |

## Honesty block

- The 6 gold cards still carry `validated: candidate` (the 211-04 / 211-05 human checkpoints
  are pending), so this is a STRUCTURAL calibration baseline over N=6+2, not a validated
  corpus. SEED-050: validate before trust.
- The status flip baseline_deferred -> calibrated is HUMAN-GATED (plan 05 Task 2, navigator
  Q2 lock). This runner never self-certifies the >=0.85 bar; it produces the evidence.
- The two JHU drafts carry NO invented gold label; their verdicts above are the critic's
  first real rulings, pending the navigator's confirmation.
- Live runtime confidence is `unknown` for every Stage B candidate today (the baseline is
  deferred); the provisional bands show what approval will make live.

## Navigator checkpoint (Task 2, blocking)

On "approved": flip evals/eureka/212-critic-baseline.json status to `calibrated`, add
`approved_at` (ISO) and `gold_accuracy` (0.83), then re-run
`bash tests/run-all-212.sh` and confirm green. On "deferred": keep baseline_deferred and
append the stated reason here. On specific misrulings: log them here and stop for a
gap-closure pass (do not quietly re-tune thresholds).

