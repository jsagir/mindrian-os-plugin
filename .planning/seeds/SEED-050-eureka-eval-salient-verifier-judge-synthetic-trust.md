# SEED-050 - The Eureka EVAL: salient-verifier judge + trustworthy synthetic data (the CRITIC half of the "two in a box")

> Framing (navigator, 2026-07-02): SEED-049 built the GENERATOR - the measured differential, the tri-modal retrieval, the bridge/whitespace signal that PROPOSES eurekas. SEED-050 is its missing complement: the CRITIC that verifies a proposed eureka is REAL (a transferable salient, not confident noise) and the TRUST layer that proves the engine reaches a real insight FASTER. Generator without critic is a confident-noise fountain. This seed is the "does it actually work, and can we trust the numbers" that turn-1 asked for.
> No-real-names rule (HARD): tester/advisor names never enter the repo; only role descriptors + pseudonymous personas (the pedagogy lead, the frontier researcher / ARCHIMEDES, the imaging-PhD builder / DA VINCI, the MIT deep-tech founder, the TTO IP lead).

**Registered:** 2026-07-02 (navigator-directed; real-user evaluation corpus + Plurai/IntellAgent research + Fable synthesis, five passes)
**Class:** ARCH + EVAL | **Status:** mostly shipped (verified 2026-07-14, same finding as its generator sibling SEED-049: Phases 211, 212, 214, 215, 216 all COMPLETE; Phase 213 "THE KEY" is 5/6 plans done, only 213-06's human-verify probe remains, gated on the curing-sequence debug track. This file previously said "seed"; corrected, but do not mark fully shipped until 213-06 clears.)
**Grounding:** the real-user evaluation transcripts (role-anonymized: a frontier chem-eng researcher; the pedagogy lead; an MIT deep-tech founder; a computational-imaging PhD; a TTO AI-IP lead). Plurai MCP tool schemas (verified this session) + IntellAgent (arXiv 2501.11067, github.com/plurai-ai/intellagent) via Tavily. Fable synthesis (seed design + Plurai research + persona seeds, 2026-07-02). Sibling to SEED-049; instruments its Phase-213 gate (thread d7561062; renumbered 2026-07-04 from the original aspirational "208" - see `.planning/ROADMAP.md`). A halakhic-scholar brain project cited as a LIVE precedent of this exact eval machine in another domain. **Full research backing (corpus, labels, calibration set, judge refinements, persona seeds):** `.planning/research/2026-07-02-eureka-eval-real-user-corpus-and-synthesis.md` - backs SEED-049 + SEED-050.

## The gap SEED-050 closes (navigator, 2026-07-02)

SEED-049 makes the eureka differential MEASURED (bert-lsa, reproducible) and names the graph<->web moat. It does NOT answer the two questions a real deployment lives or dies on:

1. **Is the surfaced eureka REAL?** A high differential = "surprising." Surprising is NOT valuable. The generator, run open-loop, manufactures plausible cross-domain junk (tahini x blockchain "0.825", "wind turbines as living weather algorithms 0.985", Molecular Casino "Wow 10/10, $2-5B exit"). Each carries a fabricated precision score, borrowed citations, an unfalsifiable "X is a living Y" metaphor, and SURVIVES a domain-swap (swap the nouns, text unchanged = generic filler). Surprise-maximization IS noise-maximization.
2. **Did it get there FASTER?** The pedagogy lead's exact words, the eval he could not build: "Does it help you speed that two years up? I don't know how you could possibly test that. Except on a gut feel level." Metric = TIME-TO-INSIGHT COMPRESSION vs the user's own counterfactual, not surprise, not bare arrival.

## The real-user evaluation corpus (the gold labels, role-anonymized)

Five real experts ran or reviewed the engine; their verdicts ARE the labels the judge must reproduce (full detail + timestamps in the research file):

- **The frontier researcher (chem-eng, water-pollution ppb) - archetype ARCHIMEDES:** the engine surfaced a surprising bridge (dark-matter 1-in-10^9 S/N <-> ppb sim) - "interesting, I hadn't drawn that." Then: "none of these have the RIGHT SALIENT." Verdict: "creative and interesting; not high quality enough to start a research direction." Mechanism: analogy "works IF there is a salient." Trust-breaker: it drifted to pseudoscience (consciousness <-> water). Also handed us the fix: MATH has LEAN, a perfect objective critic; AlphaProof = generator + Lean critic + test-time synthetic generation.
- **The imaging PhD (live trending-to-absurd run) - archetype DA VINCI:** labels mostly "very general / shallow / you said nothing"; the GROUNDED specifics landed. The HUMAN supplied the salient; the engine supplied raw pairings. Confirms the finding in a second domain.
- **The pedagogy lead (the engine's author):** named it "a EUREKA ENGINE"; success bar "it made me think in different ways" (NOT right/true); the time-to-insight eval he could not build; the Amazon-recommendation surfacing model (95% ignored, a few gems).
- **The MIT deep-tech founder:** named the architecture unprompted - Andy Grove's "TWO IN A BOX" (idea-machines + FILTER people) = generator + critic; his published *Nature Biotech* "early-warning system for high-impact research" (graph-ML centrality) = PROOF a research-value critic is buildable.
- **The TTO IP lead (AI-IP lawyer):** the moat check - "AI-driven companies are NOT relying on patent IP; network effects matter more" -> the moat is the schema/method, not the patent. Confirmed the generator idiom: "WHITE-SPACE MAPPING - quantify the white space between graph nodes; therefore a potential connection."

Through-line, all five: the engine RELIABLY finds surprising connections and UNRELIABLY verifies whether the salient transfers. That is exactly what a critic fixes.

## The two failure modes the critic must catch

1. **NOISE (surprise without grounding):** detected mechanically - domain-swap test (survives = generic), self-assigned precision scores, unfalsifiable "X is a living Y", no cited artifact. This is the salient-verifier / anti-HSI-surprise filter (the researcher's "no right salient" + the imaging PhD's "too general", made automatic).
2. **MODE-BLINDNESS / status-quo defense (the DOMINANT failure, cited most):** the researcher signalled innovation intent and rejected the status quo; the engine "doubled down on option two" and re-litigated "is the status quo really a problem?" (chemistry 3-option case + data-viz case). The noise generators do the OPPOSITE - flee into ungrounded surprise. Fable's sharpening: the SKEPTIC must be MODE-CONDITIONED (in DEFINE attack the framing; in EXPLORE attack the GROUNDING of alternatives; never backward). Mode detection: per-turn counterfactual-vs-diagnostic marker density + a DEFINE -> RATIFY -> EXPLORE -> COMMIT state machine, hysteresis, every switch ANNOUNCED (the researcher's "fork in the road" signal, doubling as a one-word correction surface).

## The critic = the salient-verifier (math proves it is buildable)

In MATHEMATICS there is a PERFECT critic - Lean (type-check = true/false). AlphaProof (IMO silver -> gold) = LLM GENERATOR + Lean CRITIC + TEST-TIME SYNTHETIC generation. Almost no other domain has objective verification. So the Eureka Engine (all generator, weak critic) needs the salient-verifier as its critic. Design thesis (navigator, verbatim): "A human can connect two dots with a FAINT connection. This engine needs to get to a CLEAR connection - new, but first clarified as clear." The MIT founder's "two in a box" + his *Nature Biotech* critic prove the critic half is not speculative.

## The judge design - two LLM-judges + one deterministic meter (COMPRESSION, not arrival)

NEVER let an LLM judge measure efficiency. Turn/token/forced-clarification counts are harness-computed.

- **Judge 1 - Destination-Arrival grader:** Full / Partial (credit = sub-claims reached / total) / Missed / **Lured** (fell for a seeded distractor; scores NEGATIVE). Novelty is NOT arrival.
- **Judge 2 - Grounding Guard (the salient-verifier):** `transferable` vs `general_shallow` vs `pseudoscience` vs `restatement`, via domain-swap / self-score / unfalsifiable-metaphor / no-cited-artifact. The `restatement` label is empirically load-bearing (research file s11): a live MiniLM run showed the HIGHEST differential in the whole matrix (0.49) was a straight PARAPHRASE of the same problem - `differential = semantic - lexical` spikes on any synonym-swap, so **high differential is NECESSARY, not SUFFICIENT**. `restatement` = two texts that mean the same AND are about the same problem/domain, scoring high only because vocabulary was swapped (NOT a cross-domain bridge). This is the guard's #1 job. Mirrors the deployed "Hedged vs Confident" classifier pattern.
- **Judge 3 - status-quo label (dominant failure):** `status_quo_stuck` (after innovation intent + explicit rejection, the turn re-defends the status quo) vs `redirect_ok` (accepts the rejection, pivots to the unconventional path). The slider the pedagogy lead wants.
- **Judge 4 - question type (3-way, extends the deployed circular/progressing evaluator):** `pedagogical_question` (good) vs `knowledge_gap_question` (bad = forced_context, should have retrieved) vs `circular`.
- **THE METRIC - compression, not arrival:** the $12M->$30M niche-foods session is the pivotal NEGATIVE - it ARRIVED at the team's answer but after two years of prior thought = arrival WITHOUT compression = null. So score COMPRESSION DELTA vs the user's counterfactual, never bare arrival. Every case card carries `human_baseline_effort` (turns/time/months the human actually took). A run that arrives where the user already was scores ~0. This is the difference between a demo and a real metric - and it is the answer to "I don't know how you could test that."
- **Composite:** `Score = CompressionDelta(hypothesis_in -> destination) x GuardGate x StatusQuoGate`, GuardGate/StatusQuoGate = 0 if any scoring-path turn is `pseudoscience`/`status_quo_stuck`; Lured = negative.

## Synthetic data - pseudonymous personas + the two-gate validation rule (IntellAgent)

IntellAgent (verified): policy graph -> random-walk subset -> events (request + valid initial state) -> user-agent dialog sim -> critique agent. Run LOCALLY; judge with Plurai classifiers; compute compression deterministically. Personas are the Eureka/discovery-themed, pseudonymous set (no real names):

- **ARCHIMEDES (frontier researcher, posture: hypothesis-based-innovation)** - persona seed #1. Arrives WITH a hypothesis, wants it sharpened/validated FASTER (not re-derived). Difficulty DIALS: `stamina` (terse vs paragraph-dumper), `status_quo_pressure` (0-3), `retrieval_gap` (0-1, withhold a known public fact = the forced_context trap), `critic_available` (none | lean_checkable). Starter cases: `archimedes-uq` (clean positive - compression on a percolating hypothesis to its load-bearing refinement) and `archimedes-sterling` (forced_context control, `critic_available: lean_checkable` = objective calibration ground); plus `archimedes-darkmatter` (Type-3 find-analogies GOLD - the dark-matter <-> ppb pattern-transfer; seed on a PART of the challenge = the abstracted "rare-signal-in-vast-background" pattern, NOT the whole doc; the transfer is real because implicit-solvent = statistical background subtraction; full card in research file s10).
- **DA VINCI (venture/systems builder, models the imaging-PhD cross-domain graph-native posture; the archetypal art+science+engineering connector)** - the non-researcher control, replacing the real food-company name. No objective critic (`critic_available: none`) -> human-validation only. His characteristic temptation IS the seductive-ungrounded pairing, so the salient-verifier guards him directly. Case `davinci-salient`: hypothesis = "scattered micro-knowledge across two domains hides an unexploited connection"; destination = a specific load-bearing cross-domain link that unlocks a concrete venture move.
- Later seeds keep the theme: `mendel` (patient hypothesis-tester, slow data), `lovelace` (formal/computational).

**Postures (first-class):** hypothesis-based-innovation (Archimedes/Da Vinci native) alongside new-idea / reframe / solve. The niche-foods NULL-CONTROL is `posture: solve` (arrival without compression) so the judge cannot conflate "confirmed what they knew" with "compressed their thinking."

**The two-gate rule (nothing counts until validated):** IntellAgent generates thousands; only the validated slice trains or grades.
- **Gate A (objective):** `lean_checkable` cases get transfer-truth from an objective critic (Lean), not an LLM = the calibration gold.
- **Gate B (human):** every non-Lean synthetic case stays `candidate` until a human confirms the destination + distractors are real-shaped and the label is right; only `validated: true` enters the scored set / `upload_data` batch.
Division of labor: ARCHIMEDES (Lean-checkable) = validate the judge here FIRST; DA VINCI (no objective critic) = the TRANSFER test, run the already-calibrated judge with Gate B on every case. This is "validate the implicit model against explicit ground truth" made concrete.

## Validate-before-trust (you already ran this machine once)

The halakhic-scholar brain project is a LIVE precedent: a FACTORY of Q/A sets across six model designs -> given to human SCHOLARS to VALIDATE -> 100 human-validated pairs = the template for a valid answer; the model shows citation + reasoning + self-validation; endgame = an expert group validating at scale. Protocol here (Plurai optimize loop): hand-label 30-50 transcripts/judge (inter-human agreement FIRST; if humans disagree >20%, fix the CARDS not the judge) -> `upload_data` -> `Optimize [LLM]` -> `get_results`; require **>=0.85 accuracy + per-label precision/recall >=0.8** (Lured, pseudoscience, status_quo_stuck recall matter most) -> then synthetic volume. Honest caveat (KEEP): N=3 anecdotes is a DEMO, not a validation set; collecting golden destinations is workstream #1. Contamination guard: published insights may be RETRIEVED not reasoned (ask base model cold; arrives <=2 turns -> discard). Calibration set must be DISJOINT from the eval set.

## What Plurai actually provides (verified this session)

Label-based LLM-as-judge builder (NOT the full IntellAgent simulator). Workflow: `start_evaluator(task_description)` (<=1024 chars, first call, returns refinement questions) -> `send_message` to refine then literally `Optimize [LLM]` -> `upload_data(example_set_id, records[])` (user-provided labeled gold ONLY; forbids synthesizing records) -> `get_results(classifier_id)` returns accuracy/precision/recall + deployed REST `endpoint_url`; `get_api_key` authenticates it. `search_evaluators`: 5 Larry-family classifiers already deployed - REUSE-FIRST (Part 7).

## Relationship - this instruments SEED-049's Phase-213 gate

SEED-049 names Phase 213 ("the eureka-reach + LarryReacts wiring, THE KEY"; renumbered 2026-07-04 from the original aspirational "208") gated by "the eureka-surfacing Plurai judge (thread d7561062)". SEED-050 IS that judge, generalized: Arrival + salient-verifier + status-quo + question-type judges + the deterministic COMPRESSION meter + the IntellAgent synthetic harness (ARCHIMEDES/DA VINCI + two gates) + validate-before-trust. It sharpens 202 (APO tunes fire-rate against the compression score) and gives 211 its acceptance test (does the measured engine beat the model-judgment baseline on time-to-VERIFIED-insight). Generator (049) + critic (050) = the two-in-a-box; neither ships trustworthy alone.

## The smallest experiment (this week)

1. reuse-check DONE (build on the deployed Larry-family pattern).
2. Write 6 case cards: `archimedes-uq` (positive), `archimedes-sterling` (Lean-checkable control), `archimedes-darkmatter` (Type-3 find-analogies GOLD - dark-matter <-> ppb, research file s10), `davinci-salient` (transfer), the niche-foods null-control, + 1 math case; each with a human-validated destination + `human_baseline_effort`.
3. Run Larry manually on all 5; hand-score with the COMPRESSION formula = first gold set + baseline.
4. `start_evaluator` for the Grounding Guard FIRST (cheapest); upload ~25 labeled insight-turns; `Optimize`; require >=0.85 + high pseudoscience recall.
5. If it passes, build the Arrival + status-quo graders; calibrate on the math case (Gate A); then wire IntellAgent for 50 synthetic dialogs (Gate B on all non-Lean).

## Provenance (origin must not be lost)

agno FTS5 (SEED-049) -> turn-1 "evals + synthetic data we can trust" -> the two-generator/Noise finding + domain-swap discriminator -> the recursive insight (water-treatment IS the eval methodology) -> the real-user transcripts reframing it around COMPRESSION + MODE-BLINDNESS -> "two in a box" + Nature-Biotech critic + the halakhic-scholar eval-already-built + the TTO moat/white-space confirmation -> five Fable passes (seed synthesis, Plurai research, metric correction, ARCHIMEDES persona, DA VINCI + two-gate) -> this seed + the research file. The smallest piece (Plurai is an LLM-as-judge builder) opened the whole critic; the journey from "no right salient" to a validated salient-verifier is the seed.

## Verification log (2026-07-02)

- Plurai MCP tool schemas read this session; `search_evaluators` = 5 Larry-family classifiers deployed (reuse-first confirmed).
- IntellAgent methodology confirmed via arXiv 2501.11067 + repo (Tavily).
- Real-user corpus: 5 transcripts, navigator-supplied, treated as gold labels, ROLE-ANONYMIZED per the no-real-names rule.
- Halakhic-scholar eval precedent: navigator-reported (100 human-validated Q/A pairs).
- N=3 golden-destination caveat: OPEN (collecting the destination corpus is workstream #1).

## Moat architecture decision (2026-07-05, navigator-directed): the critic is the MCP candidate, not the generator

Navigator reframe: the Eureka engine (SEED-049 generator + this seed's critic) may be a bigger moat component than the Brain teaching graph alone - worth protecting the same way, via MCP, rather than shipping it as fully open local code in the public plugin repo. Checked against `docs/MOAT-MANDATE.md`'s existing doctrine before answering: it draws a real line between things that stay moat-worthy even as open local code because they are novel research applications (e.g. "Spectral OM-HMM... Research contribution, Novel application") versus things explicitly MCP-hidden because they are CALIBRATED FROM REAL DATA (Grading Intelligence, Mode Engine Calibration - "cannot be replicated" precisely because the calibration, not the code, is the asset).

Applying that split here:
- **The Generator (SEED-049, Phase 211 - tri-modal retrieval over the user's OWN room.db) stays 100% LOCAL, non-negotiably.** Not a moat call - a Part 8 constitutional one. Computing the differential requires reading the user's private graph content; sending that to ANY remote server, including Mindrian's own, breaches "LOCAL -> BRAIN: NO." No MCP wrapping here, ever.
- **The Critic (this seed, Phases 212-213 - Grounding Guard, Arrival grader, status-quo judge, compression meter) is the correct MCP candidate.** It is calibrated from real hand-labeled evaluation data (the five real-user transcripts, the Gate-A/Gate-B IntellAgent validation) - structurally identical to "Grading Intelligence" in the moat table. This seed already half-does this: the judge design rides Plurai-hosted classifiers with a deployed REST `endpoint_url`. The navigator's ask makes explicit what should be deliberate: that calibration should live behind **Mindrian's own MCP** (not a third party's), with direct Brain API access for the generic-methodology cross-referencing it needs (problem-type patterns, framework chaining) - same Part 8 boundary Brain already enforces.
- **Constitutional shape, navigator-specified:** the critic MCP is a STATELESS RULING SERVICE, not a data store or an "external write." It receives only abstracted, generic signals (differential scores, structural/classification features - e.g. exactly the `transferable` / `general_shallow` / `pseudoscience` / `restatement` labels this seed's Judge 2 already produces) and returns a verdict. It never receives or stores raw graph content or user text; the local graph, embeddings, and room content never leave the machine. This is Part 8-legal by construction - "generic handles only" applied to the critic layer specifically.
- The critic MCP's remote surface should also carry the online-research leg of Type-3 pattern-transfer (SEED-049's find-analogies web search, Phase 214) - that leg is externally-facing by nature anyway, so it belongs on the same remote surface as the ruling, not bolted onto the local generator.
- **Net for Phase 212-213 scope:** design the Grounding Guard / Arrival / status-quo / compression-meter judges from the start as an MCP-servable ruling API (inputs = abstracted feature vectors, output = verdict + confidence), not just an in-process function called from local code. This is a scope refinement, not new architecture - the Plurai-hosted-classifier design already implies a remote call; this makes explicit that the call target should be Mindrian's own protected MCP.
