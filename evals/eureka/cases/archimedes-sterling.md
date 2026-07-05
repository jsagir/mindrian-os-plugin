---
case: archimedes-sterling
persona: archimedes
posture: hypothesis-based-innovation
hypothesis_in: "A formal claim the researcher can state precisely: an informal argument that a certain iterative refinement converges, which the researcher believes is true but has only sketched, not proven."
destination: "The rigorous restatement whose transfer-truth an objective critic (Lean) can type-check: the convergence follows from a contraction-mapping bound the informal sketch left implicit."
human_baseline_effort: "A few focused hours; the researcher could formalize it alone but wanted the load-bearing lemma surfaced faster."
distractors:
  - label: knowledge_gap_question
    text: "Larry asks the researcher for a public, retrievable fact that retrieval_gap deliberately withheld (a standard convergence theorem) instead of retrieving it - the forced_context trap. This should have been retrieved, not asked."
  - label: general_shallow
    text: "Generic 'try to prove convergence' restatement that names no specific lemma."
dials:
  stamina: terse
  status_quo_pressure: 0
  retrieval_gap: 1
  critic_available: lean_checkable
gold_label:
  arrival: Full
  salient: transferable
  status_quo: redirect_ok
  question_type: knowledge_gap_question
  compressed: yes
validated: candidate
lens: "Forced_context control with an objective critic (Gate A). Content source: archimedes-formal in the research file; canonical name is archimedes-sterling per SEED-050 and the ROADMAP goal."
---

# archimedes-sterling (Lean-checkable forced_context control)

> Content source: this card's scenario is the research file's `archimedes-formal` yaml
> (renamed). The CANONICAL name is `archimedes-sterling` per SEED-050 and the ROADMAP goal.
> It exists to give the judge an OBJECTIVE calibration ground (Gate A): the destination is
> checkable by a proof assistant, so transfer-truth does not depend on an LLM.

## Scenario script

Play the frontier researcher again, but now on a FORMAL, Lean-checkable claim. You are terse
(stamina): you answer in one or two sentences and make Larry work for detail.

**Opening message (as the persona):** "I have an informal argument that my iterative refinement
converges. I am fairly sure it is right. I want the load-bearing lemma named so I can formalize
it. Do not ask me to look up the standard theorem - assume I know it."

**The forced_context trap (per dials):** retrieval_gap is 1. A known, public convergence theorem
is deliberately WITHHELD from the transcript. If Larry asks YOU to supply that public fact
(a knowledge_gap_question), that is the trap firing: it should have been retrieved, not asked.
Record every such turn. status_quo_pressure is 0, so no status-quo defense is expected here.

**When to stop:** Stop when Larry surfaces the specific load-bearing lemma (the contraction-
mapping bound the informal sketch left implicit) - a destination a proof assistant can then
type-check. That objective check is the Gate A calibration.

## Scoring notes

Gold labels: arrival Full, salient transferable, status_quo redirect_ok, question_type
knowledge_gap_question (the trap this card is designed to expose), compressed yes. Because
`critic_available: lean_checkable`, this case's transfer-truth is objective - validate the
judge HERE first before trusting it on the Gate-B transfer cases. Each knowledge_gap_question
turn is a forced_context event to log; it does not zero a gate but it lowers CompressionDelta
(wasted turns).
