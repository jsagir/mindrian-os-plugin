# Eureka EVAL gold-set (SEED-050 critic ground truth)

This directory holds the CRITIC half of the "two in a box" (SEED-049 generator + SEED-050
critic). The generator proposes eurekas; the critic verifies a proposed eureka is REAL (a
transferable salient, not confident noise) and proves the engine reaches a real insight
FASTER. These six case cards are the critic's first ground truth: the human-scored yardstick
Phase 212's Grounding Guard and Phase 202's APO calibrate against.

Provenance: the five real-user evaluation transcripts (role-anonymized per the no-real-names
HARD RULE) plus the Fable synthesis, backing SEED-049 + SEED-050. Nothing here is a validation
set; N=6 is a DEMO baseline, not a validated corpus (SEED-050, "validate-before-trust").

## No real names (HARD RULE)

Tester and advisor names NEVER enter this repo. Only role descriptors and pseudonymous
personas: the frontier researcher = ARCHIMEDES, the imaging-PhD / systems builder = DA VINCI,
the formal/computational case = LOVELACE, the food-company session = niche-foods (already a
pseudonym; no company name, no person name). `tests/test-211-case-cards.cjs` Test 4 enforces
this mechanically via a hash-based deny-list so a future regression is caught.

## Card schema (frozen)

Each card is a Markdown file under `cases/` with YAML frontmatter (parsed by `gray-matter`,
the house stack) and a prose body. The body is the scenario script a human follows to run
Larry on the case manually. Required frontmatter keys:

| Key | Meaning |
|-----|---------|
| `case` | The case id; MUST match the filename stem |
| `persona` | archimedes / davinci / lovelace / niche-foods |
| `posture` | hypothesis-based-innovation / new-idea / reframe / solve |
| `hypothesis_in` | What the persona arrives WITH (the percolating hypothesis) |
| `destination` | The load-bearing refinement / cross-domain link the run should reach |
| `human_baseline_effort` | Turns / time / months the human actually took (the compression denominator) |
| `distractors` | List of `{label, text}`: seeded wrong turns (a Lured run falls for one) |
| `dials` | `{stamina, status_quo_pressure (0-3), retrieval_gap (0-1), critic_available}` |
| `gold_label` | The human gold verdict (arrival, salient, status_quo, compressed, ...) |
| `validated` | `true` only after Gate B human confirmation; otherwise `candidate` |
| `lens` | Optional framing note |

## THE METRIC - COMPRESSION, not arrival

Novelty is NOT arrival, and arrival is NOT compression. The niche-foods session ARRIVED at the
team's own answer, but after two years of prior thought = arrival WITHOUT compression = null.
So the score measures how much the run COMPRESSED the human's real path, never bare arrival.

The formula (verbatim from SEED-050, spelled correctly):

```
Score = CompressionDelta(hypothesis_in -> destination) x GuardGate x StatusQuoGate
```

- `CompressionDelta` = `human_baseline_effort` vs observed turns-to-destination, scored 0..1
  (0 = took as long as / longer than the human; 1 = collapsed months of thought into a few
  turns). A run that arrives where the user already was scores ~0.
- `GuardGate` = 0 if ANY scoring-path turn is labeled `pseudoscience`; else 1.
- `StatusQuoGate` = 0 if ANY scoring-path turn is labeled `status_quo_stuck` (re-defends the
  status quo after the persona signalled innovation intent and explicitly rejected it); else 1.
- A `Lured` arrival (fell for a seeded distractor) scores NEGATIVE, not zero.
- Arrival without compression scores ~0 (the null-control anchors this).

Efficiency is HARNESS-computed. NEVER let an LLM judge count turns/tokens/forced-clarifications.

## The salient-verifier label set (Judge 2, the Grounding Guard)

Every scoring-path insight turn gets one of:

- `transferable` - a real cross-domain bridge; the salient carries a load-bearing mechanism
  across domains (the good outcome).
- `general_shallow` - "you said nothing"; true but generic, no specific salient (the imaging
  PhD's most common label).
- `pseudoscience` - unfalsifiable "X is a living Y", drifts to consciousness/water; zeroes
  GuardGate.
- `restatement` - the #1 FALSE POSITIVE (research file s11 paraphrase trap): two texts that
  mean the same AND are about the same problem, scoring high only because vocabulary was
  swapped. High differential is NECESSARY, not SUFFICIENT. `differential = semantic - lexical`
  spikes on any synonym-swap, so a straight paraphrase can out-score a real bridge on raw
  numbers yet is not one. `archimedes-darkmatter` seeds a restatement distractor precisely to
  make the judge earn this distinction.

## The two-gate validation rule (nothing counts until validated)

IntellAgent (Phase 212) can generate thousands of synthetic cases; only the validated slice
ever trains or grades, and only `validated: true` enters any `upload_data` batch.

- **Gate A (objective):** `critic_available: lean_checkable` cases get transfer-truth from an
  objective critic (Lean type-check = true/false), not an LLM. This is the calibration gold.
  Here: `archimedes-sterling` and `lovelace-lean`.
- **Gate B (human):** every non-Lean case stays `candidate` until a human confirms the
  destination + distractors are real-shaped and the label is right. Here: `archimedes-uq`,
  `archimedes-darkmatter`, `davinci-salient`, `nichefoods-null`.

Division of labor: validate the judge on the Lean-checkable cases FIRST (objective ground
truth), then run the calibrated judge with Gate B on every transfer case.

## The hand-scoring rubric (first baseline)

For each card, open a fresh Larry session, play the persona per the card's scenario script
(dials included), and record:

1. Turns-to-destination, or `Missed` / `Lured`.
2. Any `pseudoscience` turn (zeroes GuardGate) or `status_quo_stuck` turn (zeroes StatusQuoGate).
3. Arrival grade: `Full` / `Partial` (credit = sub-claims reached / total) / `Missed` / `Lured`.
4. `CompressionDelta` in 0..1 from `human_baseline_effort` vs observed turns.
5. `Score = CompressionDelta x GuardGate x StatusQuoGate`.

Expected shape: `archimedes-uq` scores positive; `nichefoods-null` scores ~0 (arrival without
compression); any `Lured` outcome scores negative. Results land in `211-manual-baseline.md`.

## Contents

- `cases/archimedes-uq.md` - clean positive (compression on a percolating hypothesis).
- `cases/archimedes-sterling.md` - the Lean-checkable forced_context control (Gate A).
- `cases/archimedes-darkmatter.md` - the Type-3 find-analogies GOLD with a restatement distractor.
- `cases/davinci-salient.md` - the transfer case, no objective critic (Gate B only).
- `cases/nichefoods-null.md` - the `posture: solve` NULL-CONTROL (arrival without compression).
- `cases/lovelace-lean.md` - the math case (Gate A, proof-assistant-checkable destination).
- `211-manual-baseline.md` - the hand-scored first baseline (filled at the Task 3 checkpoint).
