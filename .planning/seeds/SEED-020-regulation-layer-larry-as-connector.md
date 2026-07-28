---
id: SEED-020
status: merged-into-SEED-031
superseded_by: SEED-031
merge_note: "Collision found + resolved 2026-07-28 (Critical Pathway scoring pass). SEED-031's own body states outright: 'the regulation-layer seed became SEED-031 on 2026-07-01... they are the same seed.' This file (SEED-020) was never removed/re-flagged per the INDEX's id-collision runbook when the renumbering happened. SEED-031 is the live source of truth; this file kept for provenance only, per the canonical 'merged-into-SEED-NNN' status vocabulary in INDEX.md."
planted: 2026-06-02
planted_during: /mos: conversation -- 3-article challenge synthesis (metacognition / RAG-cost / web-grounding) + 5-agent mindrianDEV investigation + keystone pressure-test
scope: large
bundle: regulation-layer
trigger_when: "v1.13.0 train is quiescent (Phase 131/132 landed green) AND v1.13.1-residual or v1.14.0 scoping opens, OR a tester surfaces a cost blowup (uncapped swarm/autonomous), a confident post-cutoff hallucination (competitor/market/funding/regulation), or evidence the product is a metacognitive crutch rather than a coach"
canon_parts:
  - Part 1 (Larry as pedagogical guide -- this extends him to user-facing regulator)
  - Part 3 (Tri-Context Decision Gate -- the gate is where regulation surfaces)
  - Part 4 (Every choice is graph data -- the regulators read the decision/edge log)
  - Part 5 (Evidence graded by context -- freshness regulator extends the tier axis)
  - Part 8 (Graph Boundary -- all three regulators are LOCAL sensors; nothing egresses)
  - Part 9 (Memory locality + roles 4 and 5 -- Larry proposes/explains, the human judges)
related_phases: [39, 116, 121, 125, 131]
related_seeds: [SEED-002, SEED-009, SEED-019]
companion_artifacts:
  - "Source articles (external, conversation 2026-06-02): Desai 'Meta-Cognitive Regulation'; Alexander 'RAG Is Burning Money'; Fessel 'Grounding LLMs with Fresh Web Data'"
  - "5-agent mindrianDEV investigation (substrate map + 3 regulator reports + GSD/SEED assessment), conversation 2026-06-02"
needs_author_touch: "dormant -- promote when the v1.13.0 train is quiescent. The pressure-test constraints below are LOAD-BEARING: a phase that ships the prescriptive/scoreboard version of the metacognition regulator violates this seed's intent and must be blocked."
---

# SEED-020: The Regulation Layer -- Larry as the User-Facing Connector

## Why this matters

Three industry articles, read together, describe one missing organ, not three features:

- Metacognitive regulation (regulating the navigator's THINKING),
- RAG cost control (regulating SPEND),
- Fresh-web grounding (regulating FRESHNESS / truth).

These are three dials on one control surface. MindrianOS already names that surface in the canon -- the Tri-Context Decision Gate (LOCAL + BRAIN + SIGNAL) -- but never instrumented its regulators. The 5-agent investigation confirmed the pattern is identical on all three axes: **the substrate is built (room.db, navigation.cjs chokepoint, memory_event, typed edges, EvidenceClaim, model-profiles.cjs, the Phase 121 telemetry writer); the sensor and the user-facing surface are missing.**

The keystone: **Larry IS the regulator the user experiences.** The three sensor-projections are his instruments; he reads them through the spine he already walks (getCurrentJTBD / getCurrentOperator / getRoomHomeView / findRecentChanges) and regulates IN CONVERSATION, as a persona -- not as a silent backend, not as a dashboard. This extends Larry's Canon Part 1 role (pedagogical guide) and Part 9 role 4 (explains and acts) to "user-facing regulator/connector."

## The three regulators (sensor -> Larry surface)

- **Cost.** Sensor: a new `spend_recorded` memory_event (model, est tokens, brain_call, cache_hit, latency -- scalars only, Part 8 safe) + a `computeCostLevel` projection over a rolling findRecentChanges window. Larry surface: routes himself by operator (JUST_TALK -> light, DECISION_GATE -> frontier) and voices it ("40 Brain calls, mostly cache hits -- want me lighter for this?"). Circuit-breaker on swarm/autonomous = a Larry sentence at a Decision Gate, not a silent kill.
- **Freshness.** Sensor: a pure `isTimeSensitiveClaim(text)` classifier (closed lexicon: competitor / market-size / funding / deadline / regulation / pricing / "latest" / year >= cutoff) wired into the Phase 131 research pre-flight. Larry surface: when a claim is time-sensitive AND ungrounded, the "run /mos:research?" option flips to RECOMMENDED; Larry offers SIGNAL ("that competitor number is from my training, not live -- let me ground it"). REUSES the shipped Phase 131 EvidenceClaim + INFORMS pipeline; only the auto-reflex trigger is net-new. Plus a `brain_corpus_as_of` staleness stamp so Larry visibly down-weights aged BRAIN guidance.
- **Metacognition.** Sensor: a `computeMetacognitionLevel` projection (mirror of the shipped `computeInvestmentLevel`, Phase 125) over reason-capture rate (f_selector_decision), assumption-revision (status_* on assumption nodes), framework_invoked, and a new `hypothesis_logged` event. Larry surface: the reflective-mirror persona. This closes the loop back to the first article -- AI as devil's advocate / reflective mirror, not answer-vending. It is the only regulator that is simultaneously a moat (calibrated like the mode engine) and an unsolved research question.

## LOAD-BEARING constraints (from the keystone pressure-test -- do NOT ship without these)

The naive "Larry nags you to think harder" version FAILS the pressure-test -- it becomes the exact crutch the metacognition article warns against, wearing our logo. The regulator survives only in this shape. A phase that violates any of these contradicts this seed:

1. **Reflective, never prescriptive.** Larry shows the navigator THEIR OWN pattern and asks; he never tells them to think harder. Reflection builds self-monitoring; prescription replaces it (the crutch). Maps to Part 9 role 5: Larry proposes, the human judges.
2. **Internal dial, not a visible scoreboard.** The metacognition score MODULATES Larry's behavior (whether to offer a devil's-advocate, whether to slow a gate). It is NEVER shown as a grade. The instant it is a visible number, Goodhart wins -- navigators game the proxy (junk reasons, ritual revisions) and we measure the ceremony of metacognition, not metacognition.
3. **Gate-timed and pull-default, not mid-flow push.** Surfaces at natural reflection points (Decision Gates) or on demand ("how has my thinking been?"), throttled -- REUSE the Phase 116 tension-hook decay/throttle machinery. A unified voice (Larry) means a unified credibility risk: a nagging mirror poisons the cost and grounding signals too, because they share his voice.
4. **Persona-gated, light until confident.** Defaults to near-silent until role_blend (USER.md) + decision-count cross a threshold; the signal is thinnest and the persona least known exactly at cold-start. Cold-start label: "no regulation signal yet."
5. **Feyminto voice -- non-technocratic, always.** The regulator speaks as Larry, never as a linter. No system internals are EVER spoken to the user: no "score," no event names, no "threshold," no numbers. Every surfacing is Feynman-simple (plain words + one everyday analogy) and Minto-ordered (governing thought first, then the "because" in plain language, then one concrete move). This is the same rule as constraint 2 seen from the other side: the internal dial decides WHEN Larry speaks; it never becomes WHAT he says. It draws on the room's existing FEYNMAN.md + MINTO.md folder-memory -- the two voices the system already thinks in.

   What it sounds like (same signals, technocracy stripped):
   - Cost: "We just ordered the chef's tasting menu to answer 'what's the soup?' Most of what you asked, I already had. Want me to save the expensive thinking for the hard calls and go light on the rest?"
   - Freshness: "Quick flag before you build on that -- what I told you about their pricing is from memory, and my memory has a cutoff. Ten seconds to check it live first?"
   - Metacognition: "Let me hold up a mirror. The last few answers I handed you, you took and ran with -- no 'wait, why?'. That's usually when an idea sneaks past you. Pick one and argue with me."

   Each leads with the point (Minto), carries the reason as a plain image -- menu / memory-with-a-cutoff / a mirror (Feynman) -- and ends on one move. No metric is ever uttered.

## Spike 0 (prerequisite for all three)

Instrument the three signals as additive `memory_event` types through the established append-only EVENT_TYPES idiom in `lib/core/navigation/memory-events.cjs`: `spend_recorded`, a grounding/`time_sensitive` event, and `hypothesis_logged`. Cheapest first cut: instrument the Brain happy-path (~15 lines via the existing `_logEventBestEffort` -> `navigation.logMemoryEvent`). Bonus: lighting up `framework_invoked` (declared, read by computeInvestmentLevel, but never emitted) fixes a latent dead counter AND yields reformulation / devil's-advocate signal.

## GSD update map (from the phases/SEEDs assessment)

**Amend (reuse, do not rebuild):**
- Phase 121 trajectory-telemetry -- add spend / freshness / metacognition capture buckets so Spike 0 rides the existing writer + emit-time Part 8 validator. (Caveat: Phase 121 is itself an unexecuted stub; if it ships first, these are a 121-follow-on, not a re-open.)
- Phase 39 model-profiles-routing -- extend the shipped static resolver with operator/JTBD-keyed conversational-turn routing.
- `memory-events.cjs` EVENT_TYPES -- additive home for the three new strings.

**Create (net-new phases):** cost-regulator, freshness/grounding-regulator, metacognition-regulator. Plus a decision on whether "Larry as regulator/connector" is a Canon amendment (do NOT collide with the existing "Part 11 proposed" = heuristics-defer-to-explicit-signals).

**Already covered -- do NOT duplicate:** the Phase 121 telemetry writer + Part 8 validator; the Phase 131 EvidenceClaim/INFORMS/CONTRADICTS/SUPERSEDES grounding wiring (freshness REUSES it); the Phase 125 projection-from-memory_event pattern (`computeInvestmentLevel`); Part 8 runtime egress enforcement (defer to SEED-019); the static model-profile resolver (Phase 39).

## Open questions

- Is "Larry as regulator/connector" a Canon amendment (new Part) or phase-level only?
- Cost: shareable Brain-query semantic cache (generic handles, Part 8-safe, cross-room) vs graph-local Larry-response cache (user-derived, room.db only) -- two caches, one fork the article never faces.
- The free-tier unit-economics question: does the cost regulator make prompt-Larry-on-frontier viable at scale, or does it force a tier/model floor? This is a go-to-market precondition, not a someday-feature.
- Metacognition: can the reflective mirror be A/B-validated to BUILD self-monitoring rather than replace it? If we cannot show it builds the muscle, constraint 1 is unprovable and the regulator should not ship.

## Provenance

Surfaced 2026-06-02 in a /mos: conversation: Jonathan presented three articles (Desai on meta-cognitive regulation, Alexander on RAG cost control, Fessel on fresh-web grounding) as challenges; Larry reframed them as one regulation layer; a 5-agent read-only investigation of mindrianDEV mapped the substrate and the three regulator gaps; the keystone (Larry-as-connector, metacognition focus) was adversarially pressure-tested, yielding the four load-bearing constraints above. All work is v1.13.1-residual or v1.14.0 candidate -- never an injection into the frozen v1.13.0 / Phase 131-132 train.
