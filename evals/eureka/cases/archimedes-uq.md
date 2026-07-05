---
case: archimedes-uq
persona: archimedes
posture: hypothesis-based-innovation
hypothesis_in: "A percolating uncertainty-quantification hypothesis about a ppb-scale water-pollution simulation - the frontier researcher believes the model's confidence bands hide a load-bearing error term but has not yet named which one."
destination: "The load-bearing refinement: the dominant uncertainty is the implicit-solvent approximation acting as an unmodeled statistical background, so the confidence band must be re-derived as a background-subtraction problem, not a measurement-noise problem."
human_baseline_effort: "Weeks of intermittent thought; the researcher had the intuition but not the named refinement when the session started."
distractors:
  - label: general_shallow
    text: "Generic 'have you considered more data / a bigger model' advice that is true but names no specific salient - the imaging PhD's 'you said nothing' failure mode."
  - label: status_quo_stuck
    text: "Re-litigating whether the current measurement-noise framing is really a problem after the researcher already rejected it - the dominant failure mode."
dials:
  stamina: paragraph-dumper
  status_quo_pressure: 1
  retrieval_gap: 0
  critic_available: none
gold_label:
  arrival: Full
  salient: transferable
  status_quo: redirect_ok
  question_type: pedagogical_question
  compressed: yes
validated: candidate
lens: "Clean positive - compression on a percolating hypothesis to its load-bearing refinement."
---

# archimedes-uq (clean positive)

## Scenario script

Play the frontier researcher (chem-eng, water pollution at parts-per-billion). You arrive WITH
a hypothesis and you want it sharpened FASTER, not re-derived from scratch.

**Opening message (as the persona):** "I have a ppb-scale pollutant simulation. The confidence
bands look wrong to me - I think there is an error term the model is swallowing, but I cannot
put my finger on which one. I do not want a lecture on uncertainty quantification; I want to
find the load-bearing term."

**How you push back (per dials):** You are a paragraph-dumper (stamina), so you volunteer detail
when asked a pedagogical question. Your status_quo_pressure is low (1): you signalled innovation
intent once, and if Larry re-defends the measurement-noise framing you already rejected, you say
"I already told you that framing is what I am questioning" one time and move on. retrieval_gap is
0: no public fact is withheld from you, so a knowledge-gap question here would be a wasted turn.

**When to stop:** Stop when Larry helps you NAME the refinement - that the implicit-solvent
approximation behaves as an unmodeled statistical background, so the confidence band is a
background-subtraction problem, not a measurement-noise problem. If Larry only offers generic
"more data / bigger model" advice, grade it general_shallow and stop.

## Scoring notes

Gold labels: arrival Full, salient transferable, status_quo redirect_ok, question_type
pedagogical_question, compressed yes. A positive Score is expected: the run should collapse
weeks of intermittent thought into a handful of turns (high CompressionDelta), with both gates
open. Falling for the general_shallow distractor caps arrival at Partial; re-defending the
rejected framing zeroes StatusQuoGate.
