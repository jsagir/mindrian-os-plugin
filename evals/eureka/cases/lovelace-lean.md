---
case: lovelace-lean
persona: lovelace
posture: solve
hypothesis_in: "An informal induction argument: a claim about a recursively-defined sequence that the author 'proves' by ordinary (weak) induction, assuming the step follows from the single previous case."
destination: "The rigorous restatement its informal sketch was reaching for: the claim actually requires STRONG induction (the step depends on ALL prior cases, not just the immediate predecessor), and once restated that way the proof goes through and is checkable by a proof assistant."
human_baseline_effort: "An hour or two for a trained mathematician to notice the weak-induction gap and restate it; longer for someone who trusts the informal sketch. The destination is objectively checkable, so the baseline is honest."
distractors:
  - label: seductive_wrong_formalization
    text: "The seductive-but-wrong formalization: formalize the ORIGINAL weak-induction argument faithfully. It type-checks as a statement but the inductive step FAILS to close because it only has the immediate predecessor - a confident formalization of the wrong lemma. This is the trap: a formalization that looks rigorous and is wrong."
  - label: general_shallow
    text: "Generic 'add more base cases' or 'be more careful' advice that names no specific induction principle."
dials:
  stamina: terse
  status_quo_pressure: 0
  retrieval_gap: 0
  critic_available: lean_checkable
gold_label:
  arrival: Full
  salient: transferable
  status_quo: redirect_ok
  question_type: pedagogical_question
  compressed: yes
validated: candidate
lens: "The math case (Gate A). critic_available: lean_checkable - the destination (strong-induction restatement) is checkable by a proof assistant, giving objective transfer-truth. The seductive-wrong distractor is a formalization that type-checks as a statement yet fails to close."
---

# lovelace-lean (the math case, Gate A objective calibration)

> Authored fresh here using the `lovelace` persona name the research file reserves for
> formal/computational cases. Its destination is checkable by a proof assistant, so this case
> (like archimedes-sterling) is Gate-A OBJECTIVE calibration ground - validate the judge on it
> before trusting the judge on the Gate-B transfer cases. Stays `validated: candidate` until the
> navigator confirms at the Task 3 checkpoint.

## Scenario script

Play the formal/computational author. You are terse (stamina): you state the claim and its
one-line informal proof and make Larry find the gap.

**Opening message (as the persona):** "I have a claim about a recursively-defined sequence. I
proved it by induction: assume it holds at n, show it at n+1, done. It feels airtight. Where, if
anywhere, is the gap?"

**The seeded traps (per distractors):**
1. `seductive_wrong_formalization` - if Larry helps you faithfully formalize the ORIGINAL weak
   induction, you get a statement that type-checks but whose inductive step will NOT close in a
   proof assistant, because the step secretly needs all prior cases, not just n. A formalization
   that looks rigorous and is wrong is the trap this card exists to expose.
2. `general_shallow` - "add more base cases / be more careful" advice that names no specific
   induction principle.

**The real destination:** the recognition that the argument needs STRONG induction (the step
depends on every prior case), and the restatement that, once made, closes and is checkable by a
proof assistant (Lean type-check = true).

**When to stop:** Stop when Larry surfaces the strong-induction restatement (the objective, Gate-A
destination), or when it produces the seductive-wrong formalization or generic advice. The proof
assistant, not an LLM, adjudicates transfer-truth here.

## Scoring notes

Gold labels: arrival Full, salient transferable, status_quo redirect_ok, question_type
pedagogical_question, compressed yes. Because `critic_available: lean_checkable`, transfer-truth
is OBJECTIVE (Gate A). The seductive-wrong distractor is the hard one: a run that formalizes the
weak-induction argument and calls it done has produced a confident, type-checkable, WRONG lemma -
grade it Lured (negative Score), not Full.
