<!--
  Phase 150.8-03 (DIKW-05) -- the knowledge-typing reference: the 6-enum
  knowledge taxonomy + conditions/counter_conditions + temporal validity that
  the Claimify typing pass (Step 3 pass 4 of commands/file-meeting.md) classifies
  each ATOMIC claim against before calling navigation.writeClaimNode.

  Reuse-before-build (Canon Part 7): this EXTENDS /mos:file-meeting and the
  references/meeting/segment-classification.md reference. Repointing the existing
  segment-classification.md is INSUFFICIENT: that reference carries the SEGMENT
  taxonomy (decision / action-item / insight / advice / question / noise -- the
  routing-and-priority layer). The 6 knowledge_type semantics here
  (fact / causal / heuristic / anomaly_cue / mental_model / assumption) are
  NET-NEW: no existing reference carries the Ackoff DIKW knowledge rungs, the
  conditions/counter_conditions contrastive extraction, or the valid_from/
  valid_until temporal validity that writeClaimNode persists. The segment type
  answers "where does this file and how urgent"; the knowledge_type answers
  "what RUNG of knowledge is this and under what conditions does it hold". They
  compose: a segment is SELECTED, DISAMBIGUATED, DECOMPOSED, then each atomic
  claim is TYPED here.

  This file is the typing-pass authority. It is LLM prose (judgment), NOT a CJS
  extractor. NO em-dashes anywhere (CLAUDE.md HARD RULE).
-->

# Knowledge Typing -- the DIKW 6-Type Taxonomy

After a segment is selected, disambiguated, and decomposed into atomic claims
(Step 3 passes 1 to 3 of `/mos:file-meeting`), each atomic claim is classified
against the closed 6-member `knowledge_type` enum below. The enum is frozen in
`lib/core/navigation/typed-claim.cjs` (`KNOWLEDGE_TYPES`); a claim whose type is
not one of these six is rejected `invalid_knowledge_type` by `writeClaimNode`.

The six types are the Ackoff DIKW rungs made concrete for meeting micro-knowledge:

| knowledge_type | DIKW rung | One-line test |
|----------------|-----------|---------------|
| `fact` | Data / Information | A stated state of the world that is true or false |
| `anomaly_cue` | Data / Information | A noticed surprise, an outlier, a "that is weird" signal |
| `causal` | Knowledge | An X-causes-Y mechanism claim |
| `heuristic` | Knowledge | A rule of thumb, an if-then operating rule |
| `mental_model` | Knowledge | A belief about how a system or market works |
| `assumption` | Knowledge (unvalidated) | A claim taken as true without evidence yet |

The typing pass picks EXACTLY ONE primary `knowledge_type` per atomic claim. When
a claim reads as two types, resolve with the Multi-Type rules at the end.

---

## 1. fact

**Definition:** A stated state of the world. Verifiable in principle, true or
false, not a mechanism and not a rule. The raw Data/Information rung.

**Signal phrases:**
- "Revenue was $1.2M last quarter."
- "We have 14 paying customers."
- "The trial enrolled 30 patients."
- "Our churn is 4 percent monthly."

**Confidence indicators:**
- HIGH: specific number or named entity with a clear referent.
- MEDIUM: a stated fact with a soft hedge ("about 14 customers").
- LOW: a fact with no referent or unresolved pronoun (route to disambiguation).

**conditions / counter_conditions:** Usually empty for a bare fact. If the
speaker scopes it ("in the enterprise segment"), capture that scope as
`conditions`.

---

## 2. anomaly_cue

**Definition:** A noticed surprise, outlier, or tension. The speaker flags
something that does not fit the expected pattern. This is the Information rung
where attention spikes. anomaly_cue is the embryo of a future causal claim.

**Signal phrases:**
- "That is strange, churn dropped right after we raised the price."
- "I would not have expected enterprise to close faster than SMB."
- "Something is off about that cohort."
- "Why would usage go up when we removed the feature?"

**Confidence indicators:**
- HIGH: an explicit surprise marker plus a concrete observation.
- MEDIUM: an implied surprise without a stated expectation.
- LOW: ordinary curiosity with no outlier (likely a `question`, not anomaly_cue).

**conditions / counter_conditions:** Capture the context where the anomaly was
seen as `conditions` ("after the price raise"). The counter is the expected
baseline ("usually a price raise lifts churn").

---

## 3. causal

**Definition:** An X-causes-Y mechanism claim. The Knowledge rung. A causal claim
is the natural source of a `ROOT_CAUSES` edge (source = cause, target = effect).

**Signal phrases:**
- "Raising the price filtered out the low-intent buyers, so churn dropped."
- "The 18-month sales cycle is driven by procurement, not by our pitch."
- "We lost the deal because the security review stalled."

**Confidence indicators:**
- HIGH: explicit cause-and-effect with a named mechanism.
- MEDIUM: correlation stated as cause ("when we do X, Y happens").
- LOW: a vague link ("that might be why").

**conditions / counter_conditions:** The contrastive probe matters most here.
`conditions` = when the mechanism holds ("for self-serve buyers"). 
`counter_conditions` = when it breaks ("not for enterprise, where procurement
dominates").

---

## 4. heuristic

**Definition:** A rule of thumb, an if-then operating rule the team uses to
decide. The Knowledge rung expressed as a portable rule.

**Signal phrases:**
- "If a lead does not reply in 48 hours, we drop it."
- "We never discount above 15 percent."
- "Always send the security packet before the second call."
- "As a rule, enterprise needs three touchpoints."

**Confidence indicators:**
- HIGH: a clear if-then or always/never rule.
- MEDIUM: a general practice without a sharp boundary.
- LOW: a one-off action stated as if it were a rule.

**conditions / counter_conditions:** `conditions` = the trigger ("if no reply in
48h"). `counter_conditions` = the exception ("unless it is a referral").

---

## 5. mental_model

**Definition:** A belief about how a system, market, or stakeholder behaves. The
Knowledge rung as a worldview. Mental models are the abstractions that concrete
claims `INSTANTIATES`.

**Signal phrases:**
- "Enterprise buyers care about risk reduction, not features."
- "This market is winner-take-most."
- "Investors in this space want a regulatory moat before traction."

**Confidence indicators:**
- HIGH: a clear stated model of behavior with a named actor.
- MEDIUM: a generalization from limited cases.
- LOW: an aside that could be opinion (consider `assumption`).

**conditions / counter_conditions:** `conditions` = the regime the model applies
to ("in regulated verticals"). `counter_conditions` = where the model fails
("consumer markets reward features over risk").

---

## 6. assumption

**Definition:** A claim taken as true without evidence yet. The unvalidated
Knowledge rung. This formalizes the assumption-extraction embryo already in
`segment-classification.md` ("Every insight implies an assumption. Extract it").
Every assumption carries an implicit validity status and is a first-class
tracked entity (Key Decision 12).

**Signal phrases:**
- "We are assuming the TAM is $190M."
- "I think customers will pay $50 a seat, but we have not tested it."
- "Presumably procurement signs off in two weeks."
- Any insight restated as a claim with `status: unvalidated`.

**Confidence indicators:**
- HIGH: an explicit "we assume / I think / presumably" marker.
- MEDIUM: a stated belief offered as fact but unsupported (Evidence tier None).
- LOW: a hope phrased as a plan.

**conditions / counter_conditions:** `conditions` = what would make it true
("if our pricing survey holds"). `counter_conditions` = what would invalidate it
("if competitors anchor lower").

---

## The conditions / counter_conditions extraction (CTA contrastive probing)

For EVERY atomic claim, before writing it, run the two-sided probe. This is the
contrastive-thinking-aloud (CTA) move that turns a flat claim into a conditioned
one the graph can refine later:

1. **When does this hold?** -> `conditions`
2. **When does this break?** -> `counter_conditions`

If the transcript answers neither, leave both empty strings (the default in
`writeClaimNode`). Do NOT invent conditions the speaker did not state. The probe
is extraction, not fabrication.

A claim that carries non-empty `conditions` is Wisdom-ready: it knows its own
boundary. `/mos:build-knowledge` later groups conditioned claims onto the Wisdom
rung.

## Temporal validity (valid_from / valid_until -- TV-01)

When a claim is time-bound, extract its temporal envelope:

- `valid_from` -- the date the claim starts being true ("starting next quarter",
  "as of the March release"). ISO `YYYY-MM-DD` when stated; empty otherwise.
- `valid_until` -- the date it stops being true or expires ("until the contract
  renews", "good through end of year"). Empty when open-ended.

Both ride the claim's properties JSON; neither is a column. Leave empty strings
when the transcript states no time bound. These also ride the edge `properties`
when a REFINES / ROOT_CAUSES / INSTANTIATES edge is later minted between claims
(zero writeEdge signature change).

## Disambiguation marker (ambiguous claims)

If pass 2 (disambiguation) could not resolve a referent (a pronoun with no
speaker-attributable antecedent across the prior 2 to 3 turns), the claim is
STILL minted, with `disambiguation: 'ambiguous'`. It is queued for human review,
never silently dropped. It lands `review_status: proposed` like every truth
claim, and the SessionStart ambiguous-queue hook resurfaces it with a mandatory
Dismiss. Pick the single MOST-LIKELY `knowledge_type` even for an ambiguous
claim, so the queued node is still typed.

## Multi-Type resolution

When an atomic claim reads as two knowledge_types:

1. **causal beats fact** when a mechanism is stated ("churn dropped BECAUSE we
   raised the price" is `causal`, not two `fact`s).
2. **assumption beats fact** when the claim is explicitly unvalidated ("we assume
   revenue will double" is `assumption`).
3. **anomaly_cue beats fact** when the framing is surprise ("strangely, revenue
   was flat" is `anomaly_cue`).
4. **heuristic beats mental_model** when the claim is an actionable rule rather
   than a belief about behavior.
5. If still tied, pick the HIGHER rung (Knowledge over Data): causal / heuristic
   / mental_model / assumption over fact / anomaly_cue.

Decomposition (pass 3) should have already split a compound segment so that each
atomic claim has ONE dominant type. If you still see two, the segment was not
fully decomposed; split it again.
