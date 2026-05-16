---
type: architectural-review-C
reviewer: adversarial-framing
target: dual-graph proposal (2026-05-16-dual-graph-architectural-proposal.md)
created: 2026-05-16
---

# Adversarial Review C -- The Case Against the Dual-Graph Framing

**Scope:** the architectural idea itself, not canon compliance and not v1.13.1 wave timing (sibling agents own those). I attack the framing, the abstractions, the data-readiness assumption, and the necessity of architectural ceremony.

## Verdict

**PROPOSAL-IS-OVERSPECIFIED.**

The 30% genuinely-new gap is real. The dual-graph framing that sits on top of it is aesthetic surface borrowed from an education-specific paper; it is not load-bearing for the three concrete code changes the gap actually requires. Reject the framing; ship the three code changes plainly.

---

## Attack 1 -- The DGEKT mapping is borrowed vocabulary, not borrowed architecture

DGEKT (Yang et al., the paper the proposal cites) trains a dual-graph knowledge tracing model where: (a) a hypergraph captures *exercise-concept* associations with supervised signal from answer correctness; (b) a directed graph captures *concept-concept transitions* learned from sequenced student responses; (c) an attention ensemble predicts the next exercise's answer probability. The supervised target is next-answer-correct.

MindrianOS has none of those primitives. There is no "exercise" with a binary correct/incorrect outcome. There is no "concept mastery" curve being traced. There is no supervised next-answer target. The proposal at §1 (lines 36-43) reuses the *words* "association graph + transition graph + ensemble" but throws away the supervision signal that gives those words meaning in DGEKT. What remains is shape without source.

A MindrianOS-native naming for the three real gaps would speak the substrate's vocabulary: not ASSOCIATION_LENS and TRANSITION_LENS but, say, `transition_aggregate` (a derived view over `memory_event`), `score_weight_history` (an outcome-conditioned tuning record on the F-selector formula), and `local_chain_fallback` (a sibling of `chain-recommender.cjs` that walks room history instead of Brain FEEDS_INTO). Three named helpers. Zero lens-class taxonomy.

The proposal author already noticed this -- §7 question 1 (line 186) literally asks "is the analogy load-bearing for MindrianOS or aesthetic?" My answer: aesthetic. The analogy is a story, not a structure.

## Attack 2 -- "Association lens vs transition lens" collapses meaningful structure

The shipped substrate already has typed cascade edges with semantic meaning: INFORMS / CONTRADICTS / CONVERGES / INVALIDATES / ENABLES (Canon Part 4; Phase 84 + 87), plus REJECTED / DEFERRED (Phase 125 D7; see `lib/core/navigation/memory-events.cjs:105` -- `f_selector_decision`). These are not "associations." A CONTRADICTS edge is a load-bearing claim that one node falsifies another; an INFORMS edge is a load-bearing claim that one node provides evidence for another. They are *different cognitive operations* on the graph.

The proposal at §2.3 (line 60) folds all seven of these into one bucket called "association layer." This is the same flattening mistake as calling "subject-verb-object" and "cause-effect" both "word relationships." Yes, technically both connect two tokens. No, they are not the same operation. The lens-class taxonomy buys vocabulary at the cost of erasing the semantic gradient that the cascade edges were specifically designed to encode.

A real architectural framing would *extend* the cascade-edge taxonomy with one or two new edge types (e.g., `FOLLOWS_FROM` for transition-aggregate, `TUNED_BY` for outcome-conditioned weight history) rather than introducing a parallel typology that competes with it.

## Attack 3 -- Transition aggregates without a clean success signal are noise

The proposal at §3.1 (lines 82-86) proposes `transition_aggregates(from_event, to_event, count, success_rate, latency_ms)`. The phrase `success_rate` is doing enormous work here and the proposal never defends it.

Phase 125 D7 emits exactly two outcome edges: REJECTED and DEFERRED (`memory-events.cjs:98-105`). The *accept* path -- the dominant case by volume -- is implicit. There is no `f_selector_accepted` event. When the user picks option 1 of an F.1 selector, that selection IS the answer, but nothing in the substrate currently marks that selection as "this trajectory succeeded" versus "this trajectory was the least-bad option of three." The graph cannot distinguish a confident accept from a resigned accept.

Without an outcome label, `success_rate` collapses to "frequency of transition" -- which is just `count` divided by a normalization. That is not learning, that is a histogram. And a histogram of which event follows which event, on a four-tester room, will be dominated by the testers' habitual workflow patterns -- not by what *works*.

The proposal needs to either (a) commit to an explicit acceptance-quality signal (a thumbs-up surface, a "did this answer the question" follow-up, an N-day staleness check that promotes accepts to validated) or (b) drop `success_rate` from the aggregate schema and rename it `transition_frequency`. The current shape pretends to learn while actually only counting.

## Attack 4 -- Learned weights on four testers is overfitting four people

Wave-1 cohort is four humans (per `feedback_no_real_names_in_repo.md` context). The F-selector ranker is one surface among ~25 methodology commands. Even on a generous estimate, each tester triggers the ranker 10-50 times per week. Multiply by four testers, by four weeks of post-ship usage in v1.13.1: 640-3200 ranker invocations. Of those, the proposal's "successful runs" filter (attack 3 shows this is undefined) cuts an unknown fraction further. The ensemble has three tunable weights (α/β/γ) per problem-type per JTBD; the parameter space is on the order of dozens of cells.

Learning three-to-six weight values from a few hundred observations spread across a parameter grid is overfitting to four specific people's specific preferences during a specific four-week window. The "learned weights" feature would *feel* adaptive while actually encoding "Jonathan and three friends like this kind of methodology after this kind of trigger" as if it were universal truth.

A more honest path: keep the weights hardcoded; let Jonathan re-tune them by hand every release based on REJECTED-edge clustering (which is a graph query, not an ML pipeline). When the cohort crosses (say) 50 testers with at least 30 days of usage each, *then* revisit learned weights. The proposal's §6.A (line 151) actually concedes this by plant-seeding learned-weights to v1.14.0; the deeper point is that the v1.14.0 trigger condition itself is too generous -- the cohort needs to be one to two orders of magnitude larger than four for learned weights to mean anything.

## Attack 5 -- The "30% new" is three helpers, not an architecture

Section 3 of the proposal names the three real gaps. Each one is a single helper:

1. **Transition aggregates (§3.1).** A new function `aggregateTransitions(sinceEpochMs, opts)` inside `lib/core/navigation/memory-events.cjs` next to `findRecentChanges` at line 143. Reads existing `memory_event` rows, returns a grouped projection. Maybe 40 lines of Node + SQL. No lens-class taxonomy required.

2. **Outcome-conditioned weight history (§3.2).** A new file `lib/workflow/score-weight-history.cjs` that on each F-selector decision logs `{weights_at_decision, outcome_edge}` into memory_event. Maybe 60 lines. Wraps `f-selector-ranker.cjs:47-52` without modifying it. No ensemble-scoring vocabulary required.

3. **Local chain fallback (§3.3).** A new file `lib/brain/local-chain-recommender.cjs` that mirrors `chain-recommender.cjs:6-36` but walks `memory_event` rows of type `framework_invoked` (already in EVENT_TYPES per `memory-events.cjs:97`) instead of Brain FEEDS_INTO edges. Maybe 80 lines. No DGEKT-inspired anything.

Total real change: ~180 lines across three files, all extending shipped surfaces. The proposal at §6.A asks for amendments to FIVE phase CONTEXT.md files plus a Canon-Phase-Map update plus reserved vocabulary in Phase 130's lens-engine plus a `transition_lens_contribution` slot in the F-selector contract. That is architectural ceremony on top of three helpers. The ceremony does no work the helpers do not already do.

## Attack 6 -- The hold-flag created the urgency it claims to resolve

Read `121.5-CONTEXT.md:40-52`. The hold-flag instructs the in-flight 121.5 plans (00 through 09) to use the words "current" instead of "final" when documenting the F-selector contract, the statusline composition, the SKILL.md v2 catalog, and the render-v2 disposition. **That linguistic discipline alone is sufficient protection against foreclosure.** If the four surfaces never claim to be closed, the eventual addition of transition-aggregate input is an additive expansion regardless of whether the dual-graph framing is named or rejected.

Without the hold-flag, 121.5 plans would have shipped using "current" language anyway (Sub-plan D rewrite per `feedback_121_5_statusline_co_design.md`). The dual-graph idea could have been captured as a plant-seed for v1.14.0 via `/gsd:plant-seed`, surfaced when the data-readiness trigger fired, and processed without forcing a verdict on five locked phases of the v1.13.1 plan.

The hold-flag converts a v1.14.0 design question into a v1.13.0 release-gate blocker. That is artificial urgency. The architectural framing is being asked to defend itself *now* because the hold-flag set up the showdown. Retract the hold-flag, ship 121.5 with "current"-language discipline, plant-seed the dual-graph for v1.14.0, and the proposal's three real gaps wait their turn until the data exists to evaluate them.

---

## The alternative shape -- what Larry would argue for instead

- **Drop the dual-graph framing.** No ASSOCIATION_LENS, no TRANSITION_LENS, no lens-class registry, no DGEKT vocabulary in any shipped CONTEXT.md.
- **Add one cascade edge type:** `FOLLOWS_FROM(from_event, to_event, count)` in `lib/core/navigation/memory-events.cjs`, extending the existing cascade taxonomy rather than competing with it. This is the entire transition-aggregate surface, in the substrate's own vocabulary.
- **Defer outcome-conditioned weights to a real cohort.** Plant-seed for v1.14.0 with trigger condition: cohort >= 30 testers AND >= 60 days post-ship AND >= 500 REJECTED/DEFERRED edges in aggregate across rooms.
- **Ship `local-chain-recommender.cjs` as a standalone helper** behind Phase 127's Tier LOCAL flag, no architectural ceremony, no lens-engine slot reservation.
- **Honor the hold-flag's linguistic discipline ("current" not "final") in 121.5 without naming what's coming next.** Future expansion stays available; current shipment stays clean.

## The strongest case for REJECT (even if I do not personally endorse it)

The proposal is an architectural narrative looking for a problem to solve. The three real gaps it correctly identifies are local code changes that fit cleanly inside the shipped substrate (`navigation.cjs` chokepoint, cascade-edge taxonomy, `chain-recommender.cjs` pattern). The dual-graph framing imports vocabulary from a paper whose supervisory regime does not exist here, flattens a semantically rich cascade-edge taxonomy into a single "association" bucket, asks for learned weights at a cohort size two orders of magnitude too small, and forces a v1.13.0 release-gate decision via a self-imposed hold-flag. Naming the architecture now creates lock-in cost on a vocabulary the team has not yet earned through real outcome data; deferring the naming costs only one paragraph of plant-seed text. Rejection is the cheaper, more honest, and more reversible call.

## Final read (one sentence)

The 30% gap is real and shippable in three helpers; the 70% framing is borrowed clothing -- reject the framing, ship the helpers under MindrianOS-native names, plant-seed the rest until the cohort earns it.
