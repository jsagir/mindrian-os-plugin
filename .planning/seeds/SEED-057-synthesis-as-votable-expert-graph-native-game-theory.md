---
id: SEED-057
status: dormant
planted: 2026-07-14
planted_during: v1.15.3-beta.19 working tree. Navigator-directed, same-session as Phase 222 scoping (reach-ranking-unification) -- a game-theory-toolbox framing for "what fires next" led to correcting Phase 222's scope (a wiring fix onto the already-shipped, already-scored `dial-reach-orchestrator.cjs` D4 path, plus a hand-rolled multiplicative-weights/Shapley layer, zero new deps per same-session deep-research verdict), then the navigator generalized one step further: treat `strategic_rank` (and by extension any candidate-producing surface) not as a silent, unrelated scoring bug to fix in isolation, but as another "expert" in the same voting system -- one whose vote is not "rank this existing candidate" but "synthesize a new one here."
trigger_when: |
  Surface when ALL THREE conditions are met:
  (1) Phase 222 (reach-ranking-unification) has shipped -- this seed's combiner IS the
      substrate a synthesis-triggering expert would vote inside; building this before
      222 lands has no ranking system to plug into.
  (2) The next /gsd:new-milestone or /gsd:plan-phase pass touches either the eureka
      engine (Phases 211-216, tri-modal cross-domain synthesis, shipped) or the
      opportunity-harvest formula (Phase 219, inbound qualification gate, shipped) --
      both are ALREADY LIVE, so gate (2) is really "the next time either surface is
      touched for other reasons," not a corpus-size or cohort gate like SEED-009.
  (3) ADDED 2026-07-14 (same-session risk check against SEED-034/SEED-058, sourced from
      the 2026-07-14 intern-QA incident): at least one of SEED-034 (graph-derivation
      harness -- the write path currently never populates room.db's graph on normal
      conversational filing, confirmed structural and default-case, not an edge case)
      or SEED-058 (Eureka reasoning-mode fallback -- Eureka hard-gates to
      pairs_scored:0 with no degrade path when the embedding index or graph substrate
      is unavailable) has shipped. Without at least SEED-058, a synthesis-trigger vote
      routed through the eureka engine would, on a normal room, very likely invoke an
      engine that returns nothing -- a real blocking dependency, not a soft one. See
      "Dependency risk" section below for the full finding.
  Surface during that milestone/phase scoping, not before -- acting on this seed before
  Phase 222's combiner exists would mean building a vote with nothing to vote inside.
scope: large
bundle: learning-loops
canon_parts: [Part 4, Part 7, Part 8, Part 9]
target_milestone: TBD (post Phase 222, and post at least SEED-058)
implementing_phase: TBD -- proposes an extension to Phase 222's combiner, not a new standalone surface
related_phases: [222, 158, 211, 212, 213, 214, 215, 216, 219]
related_seeds: [SEED-008, SEED-009, SEED-034-graph-derivation-harness, SEED-048, SEED-049, SEED-050, SEED-054-beautiful-question-seed-harvest-feynman-pipeline, SEED-058-eureka-reasoning-mode-fallback]
companion_artifacts:
  - .planning/phases/222-reach-ranking-unification-replace-the-three-disagreeing-what/222-SPEC.md
authority:
  - Same-session navigator directive, 2026-07-14 (no separate research doc yet -- see
    "Dev-Research Compositing" note below, filing to rethinking-mindrianos is a named
    follow-up, not yet done as of this seed's planting)
  - ~/MindrianRooms/rethinking-mindrianos/research/2026-07-07-fable-max-pack/opportunity-harvest-formula/opportunity-harvest-formula.md
    (Section 5 Algorithm A6 -- the sibling per-room Thompson-sampling surfacing system
    this seed's combiner-expert framing generalizes)
---

# SEED-057: Synthesis as a votable expert (graph-native game theory over "what's next")

## Why This Matters

Phase 222 fixes a real but narrow problem: two competing reach-ranking paths exist
(`dispatchSensors` raw registry order vs. `dial-reach-orchestrator.cjs`'s real D4-scored
path), and the weaker one feeds the MCP tools (`suggest_next`, `reach_candidates`) and the
engine's own auto-fire decision. Phase 222 wires both onto the strong path and adds a
hand-rolled multiplicative-weights layer on top, learning from the outcome log that
`offer-closer.cjs` (Phase 159) already writes.

That combiner treats its inputs as fixed: it reweights EXISTING scored candidates. But
this session's research surfaced a second, structurally separate scoring island:
`strategic_rank` on whitespace zones (`scripts/compute-whitespace-gaps.py:302-304`,
`1.0 / (i + 1)` positional by default, boosted when reverse-salient bottleneck data
matches). It scores a different node type entirely -- WhitespaceZone, not reach
candidates -- so it was correctly scoped OUT of Phase 222 (folding it in would have
diluted a tight wiring fix with an unrelated candidate type).

The navigator's generalization: don't just fix `strategic_rank`'s formula and stop there.
A whitespace zone with a high strategic_rank isn't merely "note this gap," it's a
standing instruction -- "go synthesize something here." This system already HAS the
machinery to act on that instruction: the eureka engine (Phases 211-216, tri-modal
cross-domain bridge/whitespace signal detection with a Grounding Guard critic) and the
opportunity-harvest formula (Phase 219, the A1-A7 algorithm stack that qualifies signals
into candidates via a five-verb gate) both already produce NEW candidates from raw
signal. They just don't currently compete for the navigator's attention alongside the
Phase 222 combiner's reach candidates -- they're three separate systems that don't talk
to each other.

The unification this seed proposes: extend Phase 222's expert-voting frame so that one
class of "expert" doesn't vote on an existing candidate at all -- it votes to CREATE one.
A high-strategic_rank whitespace zone, or any signal crossing the eureka engine's
calibrated differential floor, becomes a vote of the form "spend synthesis budget here,"
routed through the ALREADY-SHIPPED eureka/opportunity-harvest pipelines, and whatever
they produce re-enters the SAME pool the other (non-synthesizing) experts are ranking.
This is not new synthesis machinery -- Part 7 reuse is total here, eureka and
opportunity-harvest already exist and already work. What's missing is the decision layer
that lets "produce a candidate" compete on equal footing with "rank a candidate," inside
one coherent expert-weighting system, instead of three disconnected surfaces the
navigator has to separately know about.

## The graph-native angle (why this is a SEED and not a Phase 222 sub-task)

Same-session deep-research (2026-07-14, 107-agent fan-out, 5 angles, full findings in
Phase 222's research trail) found ZERO published prior art for running game-theoretic /
online-learning algorithms (bandits, Shapley value, mechanism design, equilibrium
computation) directly over a property graph as first-class state. The closest analog
found (KGQR) uses a knowledge graph only to enrich state for a conventional Dueling-DQN
reinforcement learner -- not a game-theoretic algorithm operating on graph nodes/edges
as the state itself. Every candidate library or reference implementation surfaced treats
state as a flat feature vector or tabular record.

MindrianOS's state genuinely IS a typed graph (room.db nodes/edges locally, Neo4j Brain
remotely) -- not a feature table. This seed, if built well, is not "catch up to a known
pattern," it's a first move in unexplored territory: a synthesis-triggering expert whose
"arm" is itself a graph traversal (find the highest-strategic_rank WhitespaceZone node,
follow its edges to the claims/artifacts that created it, decide whether the eureka
engine's differential floor is worth crossing there) rather than a row in a table. That
novelty is exactly why it is a SEED (deferred-but-load-bearing reasoning) and not a
same-session addition to Phase 222 -- doing it well needs Phase 222's combiner to exist
and be observed working first, not theorized about in the same sitting it was scoped.

## The decision rule: Weitzman's Pandora's Box, not a generic bandit (added 2026-07-14)

Same-session research (WebSearch-verified, full citation list in this seed's
Provenance section) sharpened the vague "vote to synthesize" framing into an actual,
citable decision rule. The synthesis-trigger expert's real question -- pay a real cost
(an eureka-engine run) to reveal a whitespace zone's unknown value, or take the best
already-known candidate for free -- is NOT a generic multi-armed bandit (bandits assume
a fixed, already-known set of arms to repeatedly pull; this is instead a one-shot
reveal-then-keep-the-best decision over a set of zones that already carry a rough
heuristic score). The correct classical match is **Weitzman's Pandora's Box problem**
(Weitzman 1979, "Optimal Search for the Best Alternative," Econometrica 47(3), 641-654),
specifically its **nonobligatory-inspection variant** (you may either pay to open a box,
or take an unopened box's estimated value without inspecting it -- exactly "run eureka
on this zone" vs. "just show the existing ranked candidate").

Weitzman's classical result: each box gets a **reservation index** *z_i*, defined by
*c_i = E[(v_i - z_i)+]* (the opening cost equals the expected upside above the
reservation point). Open boxes in decreasing order of *z_i*; stop as soon as the best
value already revealed beats every remaining unopened box's index. The nonobligatory-
inspection variant (this seed's exact shape) is proven NP-hard in general, with only
approximation schemes known (Fu, Li &amp; Xu, "Pandora Box Problem with Nonobligatory
Inspection," arXiv:2207.09545) -- an honest finding, not a discouraging one: even the
textbook-correct version of this exact problem has no clean closed form, so an
engineering approximation is the expected path, not a shortcut being taken.

This is not untested theory for this exact shape of problem: Belloni, Chen &amp; Wei,
"Online Pandora's Box for Contextual LLM Cascading" (arXiv:2606.07392, 2026) maps LLM
API calls onto Pandora's Box directly -- query cost = opening cost, generated-output
value = prize -- and learns the reservation index online (GMM + UCB) rather than
assuming the reward distribution is known upfront, since it never is in a real system.
This is close to isomorphic to "should the eureka engine run for this zone," not a
distant analogy. A second applied precedent, Xie et al. "Cost-aware Bayesian
Optimization via the Pandora's Box Gittins Index" (arXiv:2406.20062, 2024), does the
same translation for expensive function evaluations. No open-source, plug-and-play
library computes this for a recommendation/content-generation system specifically --
both are real translation work this seed would still have to do, not a solved,
importable component.

Concrete, implementable (approximate) decision rule for this seed, honest about which
parts are unavoidable engineering approximation rather than the textbook-exact result:

```
for zone in candidate_zones:                          # per turn
    mu_i    = zone.heuristic_score                     # proxy for E[value if explored]
    sigma_i = zone.spread_estimate or DEFAULT_SIGMA     # from eureka-run history, or a default
    c_i     = estimate_cost(zone)                       # LLM/embedding cost, value-scale-converted

    p_i = clamp(mu_i / VALUE_CEILING, 0, 1)              # rough odds of a genuine find (Bernoulli case)
    z_i = VALUE_CEILING - c_i / max(p_i, EPS)            # Weitzman reservation index
    zone.index = z_i

ranked = sort(candidate_zones, by=index, descending=True)
best_known = value_of_best_existing_ranked_candidate      # what ships for free, no spend
budget = EUREKA_CALLS_PER_TURN                            # hard cap, bolted on -- not in the classic theorem

for zone in ranked:
    if zone.index <= best_known: break    # stopping rule: nothing left beats what's in hand
    if budget <= 0: break                 # compute/attention budget exhausted
    run_eureka(zone)
    budget -= 1
    best_known = max(best_known, observed_value(zone))
```

Unavoidable approximations, named rather than hidden: (1) no true reward distribution
per zone exists upfront, only the heuristic score -- a distribution SHAPE must be
assumed (the Bernoulli form above, or a Normal form if a real spread estimate exists);
(2) synthesis cost and candidate value are in different units and need an explicit
value-per-cost conversion; (3) zones are not independent (they share graph/domain
context) -- the exact correlated-boxes problem is also NP-hard (Chawla et al.,
"Pandora's Box with Correlations," arXiv:1911.01632; tractable approximation in
Gergatsouli et al., NeurIPS 2023), so this seed would approximate via dedup/clustering
rather than solve the correlated case exactly; (4) this reapplies a one-shot theorem
repeatedly, turn over turn, with a renewing budget -- a repeated-application heuristic,
not the literal infinite-horizon result.

## Dependency risk: the eureka engine's default-case reliability (added 2026-07-14)

Same-session risk check, prompted directly by the navigator, against two seeds that
appeared mid-session via an unrelated intern-QA sweep (`.planning/debug/interns-round-eureka-david-session-2026-07-14.md`):

- **SEED-034 (graph-derivation harness, open since 2026-06-18, independently
  reconfirmed 2026-07-14):** `scripts/post-write`'s freshness-triple block never calls
  `navigation.cjs` on a normal room-section write. Result: a room's `room.db` graph
  stays at zero content nodes regardless of how much markdown gets filed through
  ordinary conversation, unless a separate, never-automatically-triggered derivation
  pass runs. Confirmed twice, independently, from two different rooms and workflows
  (`b2-journey` 2026-06-18; `david-innovation-studio`, 30 files, 2026-07-14) -- this is
  the DEFAULT case, not an edge case.
- **SEED-058 (eureka reasoning-mode fallback, opened 2026-07-14 from the same
  incident):** `scripts/eureka-portfolio-report.cjs` hard-gates on `idx.embedded ===
  true` (its embedding index) with no secondary path. When the embedding model hasn't
  been fetched yet (cold machine, one-time opt-in fetch) or the graph is thin/empty
  (SEED-034's gap), Eureka returns `pairs_scored: 0`, `statements: []`, rendered as
  "not enough entries" -- true of the symptom, wrong about the cause, and with no
  fallback result of any kind.

Why this matters here: this seed's whole proposal routes a `synthesis-trigger` expert's
winning vote through the eureka engine to actually produce a candidate. If that engine
hard-fails to zero on a normal room by default (which SEED-034's finding says is the
common case, not the exception), then most synthesis-trigger votes would resolve to
"invoked the engine, got nothing back" -- not a soft inconvenience, a vote that is
functionally always wrong until the dependency clears. SEED-058 is the more directly
load-bearing of the two for this seed's purposes specifically: it does not require
every write to populate the graph (SEED-034's fuller fix), it only requires that
*when invoked*, Eureka returns something real and labeled instead of a hard zero --
which is exactly the guarantee a synthesis-trigger vote needs to not be wasted.
SEED-034 remains valuable (a populated graph produces better eureka results generally,
and feeds Requirement-style acceptance elsewhere in this system) but is not, by itself,
sufficient or necessary for this seed to be viable; SEED-058 alone would likely clear
the trigger-gate condition (3) above even if SEED-034 is still in flight.

## What This Seed Proposes (NOT a phase yet -- scoping input only)

1. **A fourth expert class in Phase 222's combiner: `synthesis-trigger`.** Unlike the
   other experts (which score existing candidates), this expert's "vote" is a graph
   query result: does any node (WhitespaceZone via strategic_rank, or an eureka
   differential-floor crossing) exceed a threshold worth spending synthesis compute on
   this turn. Its weight in the multiplicative-weights combiner adapts from outcomes the
   SAME way the other experts' weights do (Phase 159's outcome log), so a
   synthesis-trigger that produces candidates nobody ever qualifies loses voice over
   time, exactly like a bad ranking expert would.

2. **A routing seam from that vote to the ALREADY-SHIPPED producers.** When
   `synthesis-trigger` wins the turn, it dispatches to the eureka engine or the
   opportunity-harvest gate (whichever produced the crossing signal) -- reusing A1-A7 of
   the opportunity-harvest formula and Phases 211-216 verbatim. Zero new synthesis
   machinery. The net-new surface is the routing decision, not the producers.

3. **`strategic_rank`'s formula gets fixed as a side effect, not a separate patch.**
   Folding it into the expert-voting frame forces an honest formula (currently `1/(i+1)`
   positional-by-default) because a positional-only score would make a lazy, low-signal
   expert -- the SAME multiplicative-weights mechanism that would down-weight a bad
   reach-ranking expert would down-weight a whitespace-zone expert that never earns its
   votes either. The fix is emergent from the architecture, not a manually-authored patch.

## Canon Part Compliance Notes

- **Part 4 (Every Choice Is Graph Data):** a synthesis-trigger vote and its outcome
  (candidate produced, qualified, or ignored) is itself graph data -- the same
  `opportunity_added` / `opportunity_reflected` / `opportunity_answered` memory-event
  vocabulary the harvest formula already mints, reused, not re-minted.
- **Part 7 (Reuse-Before-Build):** total reuse of the eureka engine, the opportunity-
  harvest A1-A7 stack, and Phase 222's combiner. Net-new is one routing decision.
- **Part 8 (Graph Boundary):** the synthesis-trigger expert reads room.db only; the
  producers it dispatches to already carry their own Part-8-compliant Brain legs
  (typed packets, enums+counts, never raw candidate text). This seed adds no new egress.
- **Part 9 (Memory Locality):** all writes through navigation.cjs, same chokepoint the
  combiner and the harvest gate already use.

## What Could Make This Seed Die

- If Phase 222's combiner, once observed live, turns out not to need a fourth expert
  class -- e.g., if simply having a good scored ranking of EXISTING candidates already
  satisfies the navigator most turns, and synthesis stays a deliberate, navigator-
  invoked action (as it is today) rather than something that should compete
  automatically. This is a real possible outcome, not a foregone conclusion -- the
  A2/D3 "one card, one candidate" design decision in the harvest formula was deliberately
  conservative about card fatigue, and folding synthesis into the automatic ranking loop
  could recreate exactly the fatigue risk that design avoided.
- If the eureka engine or opportunity-harvest formula gets replaced by a different
  producer surface before this seed's trigger fires -- retire without action, the
  routing seam targets whatever the live producer is at build time, not these specific
  phase numbers.

## Dev-Research Compositing (outstanding follow-up, not yet done)

Per this repo's CLAUDE.md mandate, architecture research like this session's thread
should also be filed to `~/MindrianRooms/rethinking-mindrianos/research/` as the durable
reasoning trail, cross-linked back to this seed. Not yet done as of planting -- named
here so it is not silently dropped. The nearest existing room entry to build on is
`2026-07-07-fable-max-pack/opportunity-harvest-formula/` (the sibling A6 Thompson-
sampling design this seed's expert-voting frame generalizes).

## Provenance

Planted 2026-07-14, same session as Phase 222 (reach-ranking-unification) scoping. Full
technical grounding (file:line verification of `f-selector-ranker.cjs`,
`insight-sensors.cjs`, `dial-reach-orchestrator.cjs`, `compute-whitespace-gaps.py`) and
the zero-new-dependency deep-research verdict live in Phase 222's own research trail and
SPEC.md, not duplicated here.

**Pandora's Box research citations** (WebSearch-verified, 2026-07-14):
Weitzman (1979), "Optimal Search for the Best Alternative," Econometrica 47(3) 641-654
(https://www.econometricsociety.org/publications/econometrica/1979/05/01/optimal-search-best-alternative,
PDF: https://scholar.harvard.edu/files/weitzman/files/optimalsearchbestalternative.pdf);
plain-language explainer: https://www.bowaggoner.com/blog/2018/07-20-pandoras-box/;
Gittins-index relationship survey: https://arxiv.org/html/2506.10872;
nonobligatory-inspection hardness: Fu, Li &amp; Xu, arXiv:2207.09545
(https://arxiv.org/pdf/2207.09545); order-constrained variant: arXiv:2002.06968
(https://arxiv.org/pdf/2002.06968); correlated boxes: Chawla et al., arXiv:1911.01632
(https://arxiv.org/pdf/1911.01632), tractable approximation in Gergatsouli et al.,
NeurIPS 2023 (https://proceedings.neurips.cc/paper_files/paper/2023/file/29d319f7c1513c9ecd81d3a6e9632a6e-Paper-Conference.pdf);
applied precedent (near-isomorphic to this seed's use case): Belloni, Chen &amp; Wei,
"Online Pandora's Box for Contextual LLM Cascading," arXiv:2606.07392
(https://arxiv.org/abs/2606.07392); Xie et al., "Cost-aware Bayesian Optimization via
the Pandora's Box Gittins Index," arXiv:2406.20062 (https://arxiv.org/pdf/2406.20062);
survey of variants: SIGecom Exchanges (https://www.sigecom.org/exchanges/volume_21/1/BEYHAGHI.pdf);
alternatives evaluated and rejected: infinite-armed bandits (arXiv:1803.04665,
arXiv:1811.06149 -- repeated-pull regret-minimization shape, wrong fit for a one-shot
reveal-then-keep decision), the secretary problem (https://en.wikipedia.org/wiki/Secretary_problem
-- assumes blind sequential presentation with no recall, wrong fit given full up-front
visibility of all zones); value-of-information framing confirmed as the correct umbrella
theory, with Weitzman's index as VoI's tractable special case for this exact
reveal-then-keep-the-max structure (https://link.springer.com/article/10.1007/s40273-014-0219-x).
