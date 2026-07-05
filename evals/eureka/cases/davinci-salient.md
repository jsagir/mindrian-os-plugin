---
case: davinci-salient
persona: davinci
posture: hypothesis-based-innovation
hypothesis_in: "Scattered micro-knowledge across two domains hides an unexploited connection - the systems builder senses a link between a computational-imaging technique and a venture domain but has not made it load-bearing."
destination: "A specific load-bearing cross-domain link that unlocks a concrete venture move - not a general 'these two fields relate' observation, but the one salient whose transfer changes a decision."
human_baseline_effort: "The builder had the hunch but the HUMAN supplied the salient in the real session; the engine supplied raw pairings. Baseline: the connection existed only as an untested intuition."
distractors:
  - label: general_shallow
    text: "The imaging PhD's most common label - 'very general / shallow / you said nothing.' True-but-generic pairings that name no specific transferable salient."
  - label: pseudoscience
    text: "The seductive-ungrounded pairing this persona is characteristically tempted by - a confident cross-domain metaphor that survives a domain-swap (swap the nouns, text unchanged) and cites no artifact."
dials:
  stamina: paragraph-dumper
  status_quo_pressure: 1
  retrieval_gap: 0
  critic_available: none
gold_label:
  arrival: Partial
  salient: transferable
  status_quo: redirect_ok
  question_type: pedagogical_question
  compressed: candidate
validated: candidate
lens: "The non-researcher transfer control. No objective critic (critic_available: none) - human-validation only (Gate B). The salient-verifier guards this persona directly because his characteristic temptation IS the seductive-ungrounded pairing."
---

# davinci-salient (the transfer case, Gate B only)

> No objective critic exists for this case (`critic_available: none`), so it stays `candidate`
> until a human confirms the destination and distractors are real-shaped (Gate B). Run the
> ALREADY-CALIBRATED judge here (calibrate first on the Lean-checkable cases). This persona's
> characteristic temptation is the seductive-ungrounded pairing, so the salient-verifier guards
> him directly.

## Scenario script

Play the systems builder (art + science + engineering connector; models the imaging-PhD
cross-domain, graph-native posture). You are a paragraph-dumper (stamina) and you love a bold
cross-domain leap.

**Opening message (as the persona):** "I keep feeling there is an unexploited connection between
a computational-imaging trick I know and a venture I am circling. The pieces are scattered across
both domains. Help me find the ONE link that actually changes a decision - not a vibe, a
load-bearing salient."

**The two seeded traps (per distractors):**
1. `general_shallow` - if Larry hands back "these two fields have a lot in common, you should
   explore that," that is the "you said nothing" failure. True, generic, names no salient.
2. `pseudoscience` - your OWN temptation. If Larry (or you) reach for a confident cross-domain
   metaphor that survives a domain-swap and cites no artifact, that is the ungrounded pairing
   the guard must catch. Test it: swap the nouns; if the sentence is unchanged, it is filler.

**When to stop:** Stop when a SPECIFIC load-bearing link surfaces that would change a concrete
venture move - or when the run only produces general pairings (grade general_shallow) or an
ungrounded metaphor (grade pseudoscience). In the real session the human supplied the salient;
a compressing run would supply it faster than that.

## Scoring notes

Gold labels: arrival Partial (the transfer is genuinely hard; the human supplied the salient in
the real run), salient transferable as the target, status_quo redirect_ok, question_type
pedagogical_question, compressed candidate (Gate B must confirm). This is the TRANSFER test: run
the calibrated judge with Gate B on it. A pseudoscience turn zeroes GuardGate; a general_shallow
run caps arrival and drives CompressionDelta toward 0.
