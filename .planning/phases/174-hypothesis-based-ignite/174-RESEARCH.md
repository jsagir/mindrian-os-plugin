# Phase 174 Research - Hypothesis-Based Ignite Starting Point

**Created:** 2026-06-23
**Status:** research (phase SEEDED, not yet specced)
**Precedent:** a live flying-blind hypothesis-to-idea exercise run against a tech-bio venture studio's published challenge (2026-06-23). Domain-specific specifics (the studio, the scientific reviewer, the oncology target work) are kept in the user-local `aion-eureka-synergy` room; this file captures only the GENERALIZABLE mechanism, per the no-real-names-in-tracked-repo rule.

## Why this precedent matters

A hypothesis-based start was run end-to-end against a real domain (tech-bio / drug discovery) with the operator FLYING BLIND - no domain expertise. It produced 25 ranked opportunities, the top one validated by a domain expert as "a good start" with a specific, actionable correction. This de-risks Phase 174 from "nice idea" to "we have run this; here is the shape and the failure mode."

## A. The hypothesis-to-idea pipeline (the mechanism to generalize)

1. **Derive or state the hypothesis.** The hypothesis was DERIVED from a scraped public challenge ("this is what they want, this is how they want to do it -> this is the hypothesis"). Takeaway: the arrival mode must accept a hypothesis that is *typed* OR *derived from an artifact* (a website, a challenge brief, a memo).
2. **Deep research + validate** the hypothesis against external sources.
3. **Whitespace mapping.** "These are the nodes we know; the hypothesis sits BETWEEN them; what is needed to get from this node to that node?" Narrowing to two specific nodes narrows the conditions that must hold between them. The system is "looking for the blank - what we do not see but should." (Existing engine: `/mos:whitespace`, sentence-transformers + LSA.)
4. **Reverse salient.** Treat the problem as a system; find the single component inhibiting the whole system from progressing; solving it "releases the whole system." (Existing engine: Canon Part 2 Engine 1; `/mos:find-bottlenecks`.)
5. **Claims breakdown + per-claim validation.** Decompose the candidate into claims, validate EACH claim with references, render a verdict ("is this real? does this make sense?"). (Existing substrate: the claim/evidence graph, Part 4/Part 5.)
6. **Ranked opportunities.** 25 surfaced, ranked, top-first; each opportunity page shows the PROCESS (reverse-salient cross-domain match) that reached it - the logical flow is part of the artifact.
7. **End on a path forward.** Never a solution. "The whole point is not to give you a solution - it is to help you with BETTER QUESTIONS." A run must terminate in a path forward, not a verdict.

## B. The three research-grade lessons (design constraints, not nice-to-haves)

1. **The abstraction-level trap.** The expert's correction: the hypothesis anchored on the wrong layer (the concrete instances - "drugs interacting with targets") instead of the structural layer ("the pathways the targets work in"), so it matched instance-combinations, not structural-combinations. **Design constraint:** a hypothesis start MUST let the domain expert SET and CORRECT the level of abstraction, or it optimizes the wrong layer with confidence. The hypothesis frame is the highest-leverage and highest-risk input.
2. **Flying-blind is a feature, but the expert is the judge.** The operator reached a domain-expert-validated opportunity with zero domain knowledge - because the system surfaced CLAIMS + REFERENCES the expert could judge. **Design constraint:** the hypothesis start must externalize its claims and evidence so a domain expert can validate/correct without trusting the machine.
3. **Better questions, not answers.** The repeated framing: the value is questions the expert "would not have thought to ask but have logic to them," ending in a path forward. **Design constraint:** the hypothesis arrival must produce next-questions + a path, not a graded conclusion.

## C. The starting-point taxonomy (where "hypothesis" fits)

The precedent articulated the entry modes explicitly. Hypothesis is one door among several; "it depends WHEN you enter the problem":
- **Business case looking for a problem/solution** to exploit.
- **Solution looking for a problem** (the dead-company-with-live-IP case: "this is the IP I have, what can I do with it?").
- **Problem that needs both.**
- **Topic / "ballpark"** - a domain with no clear idea ("make artillery accurate").
- **Blank slate** - "I want to start something, I do not know where to begin."
- **Knowledge/expertise extraction** - take raw knowhow/experience and transmutate it into something well-defined.
- **Hypothesis** (THIS PHASE) - "something you want to validate true or false," the scientific cold-start, generalizable to any field.

Phase 174 adds the hypothesis door; it does NOT replace the others. Ignite's B1 starting-point gate should treat hypothesis as a peer arrival mode.

## D. Mapping to the ignite build (reuse, do not rebuild - Part 7)

- **Arrival classification:** extend the Phase 115 dual-path first-touch detector with a hypothesis branch; reuse the ignite B1/B2/B3 birth transaction. NEW arrival classification, not a new birth engine.
- **Seed artifact:** the hypothesis files as the room's first claim/assumption (Part 9 truth-claim node, `review_status: proposed`; Part 5 evidence tier None/Practitioner initially), promotable as evidence accrues.
- **The pipeline above is already mostly shipped:** deep research (`/mos:research`), whitespace (`/mos:whitespace`), reverse salient (Engine 1 / `/mos:find-bottlenecks`), claims+evidence (Part 4/5 graph), opportunity ranking (`opportunity-bank` + HSI). Phase 174's net-new is the hypothesis ARRIVAL + the abstraction-level control + the "end on a path forward" contract.
- **Microknowledge capture** (observed in the precedent): an agent extracts critical-path microknowledge from conversation and files it as graph nodes with a question mark (things-to-investigate). Relevant to how a hypothesis room keeps accreting open questions. (Cf. Phase 150.8 meeting micro-knowledge DIKW filing.)

## E. Open questions for the spec

1. Does the hypothesis get captured as ONE falsifiable statement, or a hypothesis + its variations/sub-hypotheses?
2. How does the abstraction-level control surface to the navigator (a Shape F gate: "is your hypothesis about the instances, or the structures behind them?")?
3. Persona framing (Part 2a): researcher = testable claim; founder = market bet; investor = thesis precondition. Is the framing auto-selected from role_blend?
4. Does the hypothesis arrival auto-fire the Act 1 triple-filter (decompose + whitespace + reverse salient) per Part 10 sub-claim 5, or gate it?
5. Relationship to Phase 173's HEART deck (H = Hypothesis): does a hypothesis-started room pre-fill the deck's H section?

## F. The room-side methodology (the deeper, generalizable workflow)

The data room the exercise produced encodes a far richer hypothesis-to-idea workflow than the live demo showed. Generalized (domain specifics stay in the user-local room):

**The seed move - reframe a challenge into a meta-hypothesis.** The room was not seeded with a molecular guess; it was seeded by reframing the challenge into a structural meta-hypothesis of the form *"the real bottleneck is X (here: justification/rationale), and X is reachable by Y (reasoning) not Z (more raw data)."* The ignite hypothesis door should support this reframe, not just literal "I believe" capture.

**The four-beat hypothesis-to-idea narrative (domain-agnostic):**
1. **Import reasoning layers** from adjacent domains (the room imported 6 from non-biology sciences). The STRUCTURE generalizes; WHICH layers is a domain parameter.
2. **Filter the hypothesis space with a 2x2** on `novelty x explainability` (or `novelty x defensibility`), targeting the empty **novel-AND-defensible** quadrant - not novelty for its own sake, not black-box. (Reusable selector framework.)
3. **Validate survivors adversarially** via a mechanism chain + critique - and EXPECT MOST TO DIE (the room's run: 1 survived, 2 killed). Kills are the value, not a failure.
4. **Extrapolate** a single validated hypothesis into a compounding pipeline.

**The Brain-derived master chain (reusable command sequence):** generate (`/mos:find-analogies`, `/mos:beautiful-question`) -> mechanism (`/mos:causal`, `/mos:systems-thinking`) -> structure (`/mos:structure-argument` Minto/MECE) -> adversarial validate (`/mos:challenge-assumptions`) -> stress-test (`/mos:think-hats`, `/mos:scenario-plan`).

**The five-element defensible-hypothesis rubric (generalizes to any field):** a hypothesis is admissible only if it has (1) a directed/signed **causal chain** from intervention to outcome, (2) **provenance** (edges traced to prior knowledge), (3) **parsimony** (smallest sufficient explanation), (4) enumerated **alternatives** (the competing hypotheses), (5) **quantitative plausibility** (a feasibility/dose check). Replace "drug-target" with feature-importance (ML), market-dynamics (business), user-behavior (product), etc. Each element is also a falsification condition.

**The falsifying-base-case pattern.** The room anchored ranking on a counterexample that breaks the naive assumption ("two validated targets imply synergy" was broken by a real negative case). Generalize: a hypothesis room should hunt for the case that disproves the naive prior and rank against it. This is Popper operationalized.

**Reusable vs domain-specific (the parameterization boundary).** Mindrian supplies the STRUCTURE (the 2x2, the four-beat, the master chain, the five-element rubric, the falsifying base case, the `problem -> mirror-solution -> evidence -> framework -> confidence` opportunity template). The NAVIGATOR/DOMAIN EXPERT supplies the PARAMETERS (which adjacent-domain reasoning layers to import, which knowledge substrates to query, which emergence/synergy archetypes apply, which validation modality - RCT vs user-test vs market-test). Phase 174 must make this boundary explicit: ignite's hypothesis door is structure; the domain fills the parameters.

**Design implications for the spec (174):**
- The hypothesis door accepts a typed belief OR a challenge/artifact, and offers a META-HYPOTHESIS reframe.
- It runs the four-beat / master chain, enforcing the five-element rubric on each candidate.
- It EXPECTS-AND-SURFACES kills (most hypotheses die; that is the signal).
- It parameterizes adjacent-domain reasoning by the room's domain (the abstraction-level control from section B.1 is the first such parameter: instances vs structures).
- Full domain-specific exemplar (oncology target-pairs, the C08 benchmark, the eureka spine) lives in the `aion-eureka-synergy` room for reference.

## G. Generality + the person-anchored arrival (navigator, 2026-06-23)

**This phase applies to ANY case of hypothesis -> problem definition, not the pharma/AION case.** AION is the precedent that proves the mechanism; the mechanism itself imports ZERO domain assumptions. Every structure in sections A-F (the pipeline, the four-beat, the 2x2, the five-element rubric, the falsifying base case) is domain-agnostic; the domain only supplies parameters (section F). The spec must state domain-neutrality as a hard requirement and test it on a non-pharma fixture.

**The arrival can start from a PERSON, not just a bare hypothesis.** The richer cold-start the navigator wants:

- **Inputs (three, captured together):**
  1. **The person** - their CV / capabilities / skills (what they can actually do; their domain credibility and access).
  2. **The hypothesis** - the falsifiable "I believe X" the person wants to validate.
  3. **The motivation / logic / reason** - WHY this person holds this hypothesis (the "why this, why me"); the human-level provenance of the belief.
- **First move - domain + sub-domain extraction.** From `(person + hypothesis + motivation)`, extract the **domain and its sub-domains** (Engine 1 decomposition: the 5 lenses; domain -> subdomain -> focus_area). This turns a person's "ballpark" into a navigable decomposition and gives the hypothesis a place to sit. (Existing engine: `/mos:explore-domains`, `lib/core/domain-ops.cjs`; the Part-4 DECOMPOSED_INTO / PART_OF taxonomy edges from Phase 163.)
- **Then** run the four-beat / master-chain hypothesis -> problem-definition pipeline (sections A, F).

**Why capture the person + motivation (not just the hypothesis):**
- The **CV/skills set the person's IKA** (Interest / Knowledge / Access). The AION room used exactly this - an IKA score (Interest 5, Knowledge 2-3, Access 2->4) that graded the domain collision. A person's capability grades the hypothesis's *reachability* and the room's *founder-fit*.
- The **motivation/logic** is the belief's human-level provenance - it sets the initial evidence tier (Part 5) and answers the "why now / why this person" every problem-definition needs.
- It unifies the starting-point taxonomy (section C): a `person + hypothesis + motivation` start is the bridge between "solution looking for a problem" (person has capability/IP), "hypothesis" (belief to validate), and "topic/ballpark" (domain). Domain/sub-domain extraction is what converts the ballpark into structure.

**Maps to the ignite build (reuse - Part 7):**
- **Phase 115 already extracts a person from a CV** (the dual-path first-touch + `shallow-doc-parser` -> 1 user + 1 venture + claims). Extend that path: also capture the **hypothesis** + the **motivation/logic**, then fire **domain/sub-domain extraction** (Engine 1) as the first move.
- Persona framing rides **Part 2a** (role_blend) and the captured motivation; the person record + hypothesis + motivation become the room's seed (Part 9 truth-claim node, `proposed`; Part 5 tiered).
- **Design implication for the spec:** ignite's hypothesis arrival captures a PERSON RECORD (CV / capabilities / skills) + a HYPOTHESIS + a MOTIVATION, runs domain/sub-domain extraction first, and emits the problem-definition seed - all domain-neutral.
