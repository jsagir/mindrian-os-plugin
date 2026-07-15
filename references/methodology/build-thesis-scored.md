# Investment Thesis -- Scored, Non-Gating Variant (Fallback Reference)

> FALLBACK mechanism for the PWS_grading chain. The PRIMARY score-and-continue
> mechanism is the frozen `references/methodology/rubric-huji.md` appended via
> `--append-system-prompt-file`. This file is invoked by the PWS_grading recipe
> ONLY if the demo run shows build-thesis still halts under the rubric override
> alone (CONTRACTS SCORED_MODE fallback, decided by the `--suite demo` arbiter).
> It is a scored, non-gating variant of the Ten-Questions body in
> `references/methodology/build-thesis.md`. No em-dashes; hyphens only.

## What Changes vs. the Shipped Gate

The shipped `build-thesis.md` runs a "Ten Questions Rapid Assessment" with a
6/10 Binary gate that STOPS below threshold and waits for a human decision. This
variant removes the halt entirely. Everything else about the Ten Questions (the
questions, the 0/1 scoring, the evidence discipline) is preserved; only the gate
logic is replaced.

## Gate Logic (Replaced): Score-and-Continue

There is NO threshold and NO stop. The rule is score-and-continue:

- Score each of the ten questions 0 or 1. A 1 requires evidence quoted or
  timestamped from the student's own transcript, not enthusiasm.
- After scoring all ten, CONTINUE unconditionally to the next stage. Never halt,
  never print "STOP" or "the gate is 6", never wait for a decision.
- Emit the per-question scores WITH their one-line evidence as feedback input for
  the Minto packaging stage. A low total is not a failure verdict; it is a map of
  where the student's next steps concentrate.

## The Ten Questions (Course-Tiered)

Score at the depth an intro course assignment teaches, not at investor depth. Do
NOT fail a pitch on unit economics, moat, or valuation the assignment never
asked for (see `rubric-huji.md` Section 2 for the full course-tier calibration).

| # | Question | What You Are Testing (course tier) |
|---|----------|-----------------------------------|
| 1 | Is the problem real? | Observable in what the student said, not hypothetical. |
| 2 | Do users care enough to act? | Any evidence of a workaround, complaint, or spend the student named. |
| 3 | Will they pay for a solution? | Any signal of willingness to pay the student cited. |
| 4 | Is the solution differentiated? | Different, not just "better"; at course depth. |
| 5 | Is there momentum? | Any measurable traction signal the student mentioned. |
| 6 | Is the roadmap clear? | A concrete next few months, not aspirational. |
| 7 | Are resource needs realistic? | The ask is proportional to a student project. |
| 8 | Does the team fit the problem? | Founder-problem fit at intro level. |
| 9 | Is the funding need justified? | Only if the pitch raised it; not required at course tier. |
| 10 | Is the valuation defensible? | Only if the pitch raised it; never demanded at course tier. |

For each question, credit self-identified gaps (never double-punish
metacognition) and never penalize disfluencies, diarization noise, or non-native
phrasing as content weaknesses. All tone rules in `rubric-huji.md` Section 3
apply here too.

## Output

Produce the per-question scores and evidence, then hand off to the packaging
stage. No PASS/FAIL gate line, no investment go/no-go halt. The disclaimer rule
from the parent methodology still applies: this is an educational analysis, not
financial advice.
