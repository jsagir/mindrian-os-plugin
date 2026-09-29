---
phase: 363
artifact: D-06 human rubric
written: 2026-09-29
written_by: 363-01 (before any plan is judged)
used_by: 363-21 (the navigator scores 363-D06-REVIEW.md against this sheet)
decisions: [D-00, D-06, D-18]
---

# Phase 363 - D-06 Human Rubric

This is the standard a human uses to judge whether a research plan does what Mindrian is for: push
the navigator to ask the questions they did not know to ask (D-00). It is written before any plan is
produced, so the bar cannot drift to fit whatever the code happens to emit.

Code can check structure (every leaf has an origin tag, a falsifier field, a lens). Only a person can
judge whether the questions are good and whether they would have come up unprompted. That judgment is
what this rubric is for.

## What is being judged

One research plan, produced by a question-asking command running in research-planner mode (the first
case is `/mos:map-unknowns` or `/mos:root-cause`, per D-06).

The plan is judged as a set of questions, not as prose. The question to hold in mind while scoring:
did the framework do the asking, or did the plan just repeat what the navigator already said?

D-00, in one line: a plan whose questions are only the navigator's own question restated fails,
however neat it looks.

## Inputs the reviewer sees

1. The navigator's stated question, verbatim, exactly as it was typed.
2. The plan's research perspective and its Minto pyramid, as rendered on the F.6 Plan Review card:
   the governing question at the top, the MECE key line of sub-questions, and the leaves beneath.
3. The list of leaves, each with its origin tag (for example `user_stated`, a quadrant, a why-link, a
   hat, a whitespace falsifier, a diffusion dimension, or a Scientific Roadmapping operation), its
   lens, its falsifier, and whether it is marked researchable.
4. The physics-versus-assumed limiter columns from the perspective (D-18 step 6), when the plan
   carries them.

The reviewer does not see the evidence. The rubric judges the plan before anything is fetched.

## Criteria

Each criterion is scored Yes or No, with a one-line reason. R1, R2, R3, R4 and R7 are scored per
leaf; R5 is scored per group of sibling leaves; R6 is scored per plan.

- **R1 - Beyond the stated question.** The leaf asks something the stated question does not already
  ask. A leaf whose origin tag is `user_stated` scores No here by definition; rewording the
  navigator's own question into a new sentence also scores No.
- **R2 - Framework-grounded.** The leaf names what raised it: the Rumsfeld quadrant, the why-link in
  the 5 Whys chain, the thinking hat, the whitespace falsifier, the diffusion dimension, or the
  Scientific Roadmapping operation. A leaf that could have come from anywhere scores No.
- **R3 - Falsifiable.** The leaf carries a falsifier that could actually come back true: a named
  result that would show the leaf's assumption is wrong. "More research is needed" is not a
  falsifier.
- **R4 - Researchable, or honestly not.** A researchable leaf has a plausible literature query (one a
  real corpus such as OpenAlex could answer). A leaf marked not researchable says why (an unknowable,
  a private fact, a future event). A leaf that pretends to be researchable when it is not scores No.
- **R5 - Non-duplicative.** No two sibling leaves ask the same thing in different words. Score No for
  the pair when they overlap.
- **R6 - Assumed limiters the navigator did not name (D-18 step 6).** At least one limiter sits in
  the assumed column that the navigator's framing treated as fixed, and it is rewritten as a
  question ("what if we attacked ___, which this field treats as fixed?"). A limiter the navigator
  already named as a doubt does not count.
- **R7 - Would the navigator have asked this unprompted?** The reviewer's honest yes or no per leaf.
  "No" is the good answer here: it means the framework surfaced something new.

## Pass rule

The plan passes when all four of these hold:

1. R3, R4 and R5 hold for every researchable leaf.
2. R1 and R2 both hold for at least 3 leaves.
3. R6 holds for at least 1 limiter.
4. R7 is "no" for at least 2 leaves.

Anything short of that is a fail, and the review records which condition missed. A fail is useful
data, not a verdict on the phase: it names the framework seam that did not ask enough.

## Scoring sheet

Copy this table into `363-D06-REVIEW.md`, one row per leaf. R5 is filled on each leaf of an
overlapping pair; R6 is filled once, on the plan line below the table.

| Leaf id | Origin | R1 | R2 | R3 | R4 | R5 | R7 | Reason (one line) |
|---------|--------|----|----|----|----|----|----|-------------------|
| L1 | | | | | | | | |
| L2 | | | | | | | | |
| L3 | | | | | | | | |

Plan-level: R6 (assumed limiter not named by the navigator): Yes / No - which limiter:

Pass rule result: condition 1 __ / condition 2 __ / condition 3 __ / condition 4 __ -> PASS / FAIL

## What this rubric does not judge

- Benchmark scores of other deep-research agents. D-06 is explicit: a surveyed project's benchmark
  number is not acceptance for 363.
- Prose quality, tone or length of the card.
- The evidence itself. Whether the literature supports a leaf is the run's job, judged by the
  evidence card or the deep report, never by this rubric.
- Whether the executor thinks its own plan is good. The executor that built the plan does not score
  it; a human does.
