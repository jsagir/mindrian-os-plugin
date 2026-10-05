# FeyMinto design v2 (navigator's refinement, pasted 2026-10-05 as "what if")

Filed verbatim by the orchestrator. It refines SEED-122 and FEYMINTO-CROSS.md; where they differ, this file wins and the adoption notes at the end say how.

---

**The navigator's JTBD**

> When I return to a room nest, or something changes its evidence, I want to understand what we currently think, what supports or challenges it, and which next move would advance the problem, so I can make a considered decision without reconstructing the whole investigation.

Three related needs sit inside that job:

- **Orientation:** Am I looking at the right subject and current information?
- **Understanding:** What is the argument, and where does it remain uncertain?
- **Agency:** What could I do next, why would it help, and what am I authorizing?

"The one next move" is a useful presentation preference when the reasoning supports a recommendation. It should not conceal a genuine choice between alternatives.

**The component's job**

> Turn the nest's current evidence, decisions and execution records into an inspectable reasoning brief that connects its purpose to its next unresolved question.

Each meaningful nest declares its JTBD. Its identity, state and reasoning files reference that job and describe their contribution. They do not need duplicate JTBD statements.

Theo's role is to help interpret and challenge that reasoning, explain it, and suggest relevant methods. The calling model applies Theo's retrieved guidance to the local context.

**Revised Situation, Complication, Question, Answer**

**Situation.** A room nest holds identity, work state and reasoning. Someone returning to it needs to resume both understanding and action.

**Complication.** Those records can look complete while leaving consequential questions unanswered: whether they concern the right nest, whether their evidence is current, whether the argument survives challenge, and why a proposed action follows. The supplied reference reports identity mismatches, unused reasoning and an unqueried Theo face. These are investigation leads. A zero query count alone does not establish poor reasoning.

**Question.** What must remain visible so a returning person can trust the limits of the current understanding and choose the next useful move?

**Proposed answer.** FeyMinto presents a versioned reasoning brief tied to the nest's identity and job. It shows the current argument, its evidence and uncertainty, and a justified next question or action. Theo helps challenge and develop that reasoning; ICM structures any selected investigation. The claim to test is whether this improves resumption and decisions, not merely whether the files exist.

**Knowns, assumptions and unknowns**

| Category | Entry | Consequence |
|---|---|---|
| Supplied observation | The reference reports slug-based reasoning identity and missing database identity. | Verify the affected version and distinguish moving a room from copying it into a new room. |
| Supplied observation | The reference reports that downstream consumers do not use the reasoning record. | Trace actual readers before assuming a shared record will change behavior. |
| Assumption | Consolidating reasoning will reduce reconstruction work. | Observe whether a returning reader can resume accurately. |
| Assumption | Framework advice improves the next move. | Check whether retrieved guidance changes the question or investigation usefully. |
| Assumption | One recommended move is sufficient. | Preserve alternatives when they imply materially different outcomes. |
| Unknown | Which evidence would reverse the governing thought? | Make this explicit before presenting the conclusion as settled. |
| Unknown | Which input changes make the reasoning stale? | Identify dependencies and expose freshness rather than assuming it. |

Do not collapse this into a confidence score. Evidence support, source reliability, agreement and execution success describe different things.

**The Beautiful Question.** The initial question asks how to make a folder trustworthy. A more consequential question may be: **What could make our current understanding wrong, and what would we need to notice before acting on it?** That question directs attention toward missing counterevidence and stale assumptions. Optional follow-ups: Why is the current conclusion important to this nest's job? What if its strongest supporting assumption is false? How could we distinguish that possibility from our current explanation?

**FeyMinto's three faces**

| Face | Job in this reference | Required content |
|---|---|---|
| **MINTO** | Make the current argument inspectable. | Governing thought; supporting arguments; evidence references; counterevidence; assumptions; what would change the conclusion. |
| **FEYNMAN** | Make the understanding recoverable in plain language. | What we think; why; what changed; what we cannot yet explain; links to details omitted for brevity. |
| **THEO** | Help identify useful methodological considerations. | Relevant guidance; why it fits the unresolved question; retrieval provenance; limitations; locally checked capability availability. |

The next-move recommendation draws on all three faces, the JTBD and current constraints. It should not simply copy the highest-ranked framework from the Theo face. Claim-state labels such as `quote_matched` or `independently_checked` require explicit definitions and supporting records. They should not silently become a ladder from uncertain to true.

**ICM as an inquiry pass.** The nest remains a durable subject. An ICM pass is a bounded activity concerning that subject.

| Stage | Single job | Output | Review focus |
|---|---|---|---|
| **Frame** | Establish the intended progress and decision. | Job and inquiry framing. | Does this reflect the navigator's actual purpose? |
| **Question** | Identify the consequential gap in understanding. | Evidence, assumptions, alternatives and selected question. | Could answering this change the decision? |
| **Compose** | Explain the current reasoning and propose a next move. | FeyMinto reasoning brief. | Does the recommendation follow from the evidence and job? |

This pass proposes the investigation. Executing that investigation requires its own appropriately scoped instruction or authorization.

**The reader-facing brief**

```
THIS NEST SERVES
The progress we are trying to make.

WE CURRENTLY THINK
The governing thought, or an explicit unresolved position.

BECAUSE
The supporting argument and evidence references.

BUT
The assumptions, contradictions and limits that matter.

WHAT CHANGED
New evidence, decisions or results since the previous revision.

THE QUESTION THAT MATTERS NOW
The uncertainty most likely to change our next decision.

PROPOSED NEXT MOVE
What to do, why it helps, and what different outcomes would mean.

THEO'S CONTRIBUTION
Methodological guidance used, its relevance and its limitations.

YOUR DECISION
Choose, revise, defer or reject the proposed move.

RECORD BASIS
Nest identity, input revisions, source references and freshness.
```

**Adjustments to the earlier reference.** "Every reader reads that place and nothing else" becomes: every reader starts from a consistent reasoning view and can inspect its basis; the doctor and release checks independently compare that view with authoritative records. "Only show what committed state can prove" becomes: show what the records establish, with interpretations and hypotheses visibly distinguished; persistence proves that a claim was recorded, not that it is true. A proposed move, a selected move, an attempted operation and a verified result remain separate; an interrupted or uncertain operation stays visibly unresolved until reconciled.

**The practical test.** A returning navigator should be able to identify the job, explain the current argument, locate its weakest assumption and understand the proposed move. When contradictory evidence arrives, the brief should reveal what needs reconsideration.

---

## Adoption notes (orchestrator, 2026-10-05; these bind Phase 369.3a planning)

1. The reasoning brief is a RENDER of the three faces, the ledger, the decisions and the identity, assembled at read time; it is not a fourth stored face, so there is still one owner per state. Its "version" is the set of input revisions in RECORD BASIS; freshness is derived from those, never asserted.
2. The FEYNMINTO-01 budget applies to the FEYNMAN face; the brief itself is bounded by what it renders, with "links to details omitted for brevity" pointing at the faces and the ledger.
3. The MINTO face gains three required blocks: counterevidence, assumptions, what would change the conclusion (the "BUT" block). The FEYNMAN face gains "what changed" and "what we cannot yet explain". The Theo face gains "why it fits the unresolved question" and "limitations" beside the capability marker.
4. "The one next move" is kept as presentation, with alternatives preserved when their outcomes differ; the recommendation is composed from all three faces, the JTBD and the constraints, never copied from the Theo face's top rank.
5. The claim-state labels are rendered only with their definitions and the record that supports each (the annex C16 definitions; each label links to its verification record); they are a vocabulary, not a ladder.
6. The two wording corrections replace the corresponding rows in FEYMINTO-CROSS.md: readers start from a consistent view and can inspect its basis, with doctor and release comparing it to authoritative records; records establish, interpretations and hypotheses are distinguished, persistence proves recorded not true.
7. Proposed, selected, attempted, verified stay four records; an interrupted operation renders as unresolved.
8. A zero Theo query count is an investigation lead in the inquiry map, not a verdict; the Phase 369.3a Phase 0 verifies the affected version and traces the actual readers of the reasoning record before any change (the inquiry map's first two rows are its first two tasks).
9. The ICM inquiry pass (Frame, Question, Compose) is how a nest's investigation is proposed; executing it needs its own card, which is the research planner's approval card named by its job.
