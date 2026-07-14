---
id: SEED-057
status: dormant
planted: 2026-07-14
planted_during: v1.15.3-beta.19 working tree. Navigator-directed, same-session as Phase 222 scoping (reach-ranking-unification) -- a game-theory-toolbox framing for "what fires next" led to correcting Phase 222's scope (a wiring fix onto the already-shipped, already-scored `dial-reach-orchestrator.cjs` D4 path, plus a hand-rolled multiplicative-weights/Shapley layer, zero new deps per same-session deep-research verdict), then the navigator generalized one step further: treat `strategic_rank` (and by extension any candidate-producing surface) not as a silent, unrelated scoring bug to fix in isolation, but as another "expert" in the same voting system -- one whose vote is not "rank this existing candidate" but "synthesize a new one here."
trigger_when: |
  Surface when BOTH conditions are met:
  (1) Phase 222 (reach-ranking-unification) has shipped -- this seed's combiner IS the
      substrate a synthesis-triggering expert would vote inside; building this before
      222 lands has no ranking system to plug into.
  (2) The next /gsd:new-milestone or /gsd:plan-phase pass touches either the eureka
      engine (Phases 211-216, tri-modal cross-domain synthesis, shipped) or the
      opportunity-harvest formula (Phase 219, inbound qualification gate, shipped) --
      both are ALREADY LIVE, so gate (2) is really "the next time either surface is
      touched for other reasons," not a corpus-size or cohort gate like SEED-009.
  Surface during that milestone/phase scoping, not before -- acting on this seed before
  Phase 222's combiner exists would mean building a vote with nothing to vote inside.
scope: large
bundle: learning-loops
canon_parts: [Part 4, Part 7, Part 8, Part 9]
target_milestone: TBD (post Phase 222)
implementing_phase: TBD -- proposes an extension to Phase 222's combiner, not a new standalone surface
related_phases: [222, 158, 211, 212, 213, 214, 215, 216, 219]
related_seeds: [SEED-008, SEED-009, SEED-048, SEED-049, SEED-050, SEED-054-beautiful-question-seed-harvest-feynman-pipeline]
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
