# Phase 157: Brain orchestration graph - Research

**Researched:** 2026-06-15 (systems-thinking multi-agent fan-out, navigator-directed)
**Method:** 5 parallel Explore investigators (systems-thinking facets: M1 boundary, M2 feedback loops, M4 leverage points, reverse-salient, HITL-UX + Phase-157 fit) + 1 synthesizer. Workflow run wf_47620b9a-763. Generic plugin machinery only (Canon Part 8, no user data).
**Consumes-into:** 157-CONTEXT.md + 157-SPEC.md (the planner reads this for the HOW + the sequencing correction).

---

## System map (the what-next proactive HITL layer)

A single FEED-FORWARD pipeline with five stations and a MISSING return path:

- **STATION 1 SENSE** - `intent-classifier.cjs` builds `turn={userText,sectionPath,sessionId}` and calls `navigation-engine.decide()` (`navigation-engine.cjs:657` -> `dispatchSensors(t, sensorTuple, sensorCtx)` with `sensorCtx.roomDir` populated at :622, cortex scalars at :633-651). `dispatchSensors` runs `normalizeTurn` (`insight-sensors.cjs:390`) over the 8-sensor canonical registry.
- **STATION 2 DECIDE** - `resolveFireSkill` applies the 4-level precedence (wicked>=8 > sensor reach > Brain verb > mode_a pattern), sets `fire_skill`, flips `routing_source` legacy->engine.
- **STATION 3 RANK** - `dial-reach-orchestrator.buildReachList` ranks the frozen 6 reaches (context_block / contradiction / cross_room / brain_consult / deep_research / hats), each scored by the D4 formula `brain_confidence*0.40 + (1-recency)*0.30*inv + problem_type*0.30*inv` (HARDCODED, `lib/workflow/f-selector-ranker.cjs:287-290`), then the frozen 0.70/0.15 RECOMMEND gate (Mode A only).
- **STATION 4 SURFACE** - `dial-presenter` renders the Shape F.7 tri-context header + the F.1 selector (MAX_K=3 of DIAL_REACH_K=6).
- **STATION 5 COMMIT+FILE** - navigator picks; `closeReach` writes a typed edge (SELECTED_REACH / PIVOTED / DEFERRED / REJECTED) + an `f_selector_decision` memory_event to room.db.

**The forward path is structurally COMPLETE and shipped.** What is missing is the wire from STATION 5 back to STATION 1/3: rejection outcomes file as graph data (Part 4) but NO production code reads REJECTED edges to retune the ensemble weights, reorder sensors, or suppress a chronically-rejected reach. **The layer SENSES, RANKS, SURFACES, and RECORDS, but it does not LEARN.** It also does not EXPLAIN: the navigator sees a confidence percentage and a machine reach name, never the score breakdown, the firing sensors, or the framework-to-reach chain.

## Feedback loops

- **FORWARD R-loop (shipped)**: sensor fires -> fire_skill -> routing_source flips -> reach ranked + offered -> navigator selects -> SELECTED_REACH edge + memory_event -> investment_level grows via invoke count -> next ranking leans more on LOCAL (recency + problem_type terms scale with `inv`, ranker:287-289) -> matured rooms get personalized rankings. The one genuinely closed loop, but it ONLY reinforces on ACCEPTANCE.
- **PARTIAL B-loop (PIVOT/DEFER, shipped)**: PIVOTED -> `applyDecayWeight` (`selector-decisions.cjs:330`) discounts ONE term (recency) of ONE reach via the ranker IoC hook (`f-selector-ranker.cjs:378-421`), investment-scaled; DEFER -> +30d expiry skip. Touch a single reach + single term, not the ensemble.
- **THE MISSING LEARNING LOOP (critical, all 5 investigators converge)**: navigator REJECTS -> REJECTED / REJECTED_BECAUSE edge + `f_selector_decision(outcome=reject)` filed (Part 4, Decision 13) -> ...nothing. NO production consumer reads REJECTED to nudge the 0.40/0.30/0.30 weights, reorder sensors, or suppress the reach. `applyDecayWeight` reads PIVOTED/DEFERRED only; no `readEdge('REJECTED')` feeds the ranker. SEED-009 names it ("the ranker is deaf to that signal") and sits dormant (trigger >=30 users + >=1000 outcome edges; current ~4 users, <100 edges).
- **COLD-START B-loop (works, but silent)**: tier_0 -> registry reaches default brain_confidence=0.5 -> never solo-cross 0.70 -> zero markers by design (`dial-reach-orchestrator:34-36`) -> navigator picks freely -> graph grows -> markers appear. Correct humility, but no signal explains WHY there are no markers, so a cold room feels inert rather than honestly-unsure.
- **SENSOR-DRIFT R-loop (latent)**: stale governing thought / thin cortex -> sensors fail to fire -> fewer reaches -> maintenance re-populates cortex -> sensors re-evaluate. Depends on the navigator knowing to run maintenance; no automated "room gone reach-silent for N turns" detector.

## THE reverse salient

The **hardcoded ensemble weights + static rank/sensor order**: concretely `{0.40 brain_confidence, 0.30 recency_decay, 0.30 problem_type_bind}` at `lib/workflow/f-selector-ranker.cjs:287-290` plus the fixed `SENSOR_REGISTRY` order (`insight-sensors.cjs:351-363`). Every other station is built for learning (sensors fire, decide() flips routing_source, reaches rank, the dial surfaces, outcomes file as typed edges, SEED-009 is written and ready) - but the circuit is open at exactly one point: the weights that knit the signals together are static priors NEVER tuned on a single rejection. PIVOT/DEFER nudge one term of one reach; REJECTED nudges nothing. If a navigator rejects the same reach five turns running, the static D4 score re-surfaces it at the top on turn six. **The weights are simultaneously the most-unfrozen parameter in the system and the most-frozen in practice** - that paradox is the reverse salient. Canon Decision 13 ("rejection is data; why-not teaches as much as yes") is contradicted by the code.

## Top leverage points (Meadows-ranked)

1. **Close the rejection->weight learning loop** (L4 Rules + Information Flow). Read REJECTED / `f_selector_decision(outcome=reject)` per reach, subtract a bounded investment-scaled `REJECTION_PENALTY = (reject_count/presentations) * penalty_weight` from the D4 score; stage SEED-009's full ensemble refit for when its trigger clears. Converts STATIC RANKING into a LEARNING SYSTEM; honors Decision 13. **LOCAL-only - does NOT need the Brain orchestration graph.**
2. **Expose the ranking inputs** (L5 Information Flow) = the exact **BOG-07** deliverable. Surface per reach: the D4 score, the three weighted contributions, the framework->command->reach chain, the firing sensor(s), as a collapsed "why" block. Transparency is the precondition for trust AND for high-fidelity rejection reasons (the fuel for leverage point 1).
3. **Complete + validate the sensor-reach firability matrix** (L6). Only SENS-01/06/08 are tested; SENS-02..05 + SENS-07 are untested; the `hats` reach has NO sensor. Author the SENS-NN -> reach -> condition -> test matrix; resolve the `hats` orphan (mint a sensor or formally de-scope to pre-scored-only, navigator-gated). The supply side - without firing sensors the dial never appears and 1+2 have nothing to learn from.
4. **Auto-generate the connector registry from command frontmatter + --check** (L4 Rules) = the **BOG-06** wiring-completeness gate. `connector-registry.json` is "do not edit by hand" yet hand-edited; this is exactly how `/mos:futures` shipped un-wired and dial-invisible. Replicate the Phase 122 generator pattern; deletes a drift class.
5. **Reach-selection telemetry + completion-rate health** (L3 Goals + Measures). Enrich SELECTED_REACH with `{confidence_at_selection, was_recommended, margin_to_2nd}`; add a reach_selected -> framework_invoked -> framework_completed chain + `/mos:doctor --reach-health`. Shifts the goal from ADOPTION (was it picked) to OUTCOME (did it lead to completed validated work = the JTBD). The true metric that should eventually drive the learned weights.

## Recommended enhancements (with Phase-157-fit + HITL note)

| # | Enhancement | Fits 157? | HITL note |
|---|-------------|-----------|-----------|
| 1 | **Negative-feedback wire**: REJECTED edges penalize the reach score (bounded, investment-scaled, mirrors applyDecayWeight) | NO (LOCAL fast-follow) | Removes chronically-unwanted reaches from the top-3; strictly increases signal-to-noise |
| 2 | **Per-reach score+chain+sensor breakdown in the dial** (BOG-07 surface) | YES | Passive trust -> active understanding; richer REJECTED_BECAUSE data |
| 3 | **Complete + test SENS-02..05/07 firability; resolve hats orphan** | NO (sensor supply side) | Makes proactive offers appear when they should; hats de-scope is a navigator gate |
| 4 | **Auto-generate connector-registry + --check** (BOG-06) | YES | No navigator-facing change; failure shifts silent-runtime -> author-time CI |
| 5 | **Reach completion-rate measurement** | NO (follow-on) | Navigator sees which reaches led to finished work, not just clicks |
| 6 | **Honest cold-start entry + sensor-fired-cold-card** | NO (Phase 154) | Converts cold-start silence into a guided first move |
| 7 | **Zero-sensor fallback test + reach-silence health check** | NO | Protects against a blank/broken dial on low-signal turns |

## Phase 157 impact (CONFIRMS + sharpens + reshapes)

1. **CONFIRMS BOG-06** (wiring frameworks to reaches): the connector registry is hand-maintained and demonstrably lets commands ship un-wired and dial-invisible; the generator + --check is the right structural fix; replicate the Phase 122 pattern exactly.
2. **CONFIRMS + ELEVATES BOG-07** (expose ranking inputs): all 5 investigators independently flag the same opacity. Phase 157 should treat BOG-07 not as a nice-to-have data projection but as the **load-bearing enabler of the missing learning loop** - legible inputs are the precondition for high-fidelity rejection reasons, the fuel for SEED-009.
3. **RESHAPES via a sequencing correction**: the highest-leverage fix (closing the rejection->weight loop) is **LOCAL-only and does NOT require the Brain orchestration graph at all**. Phase 157 wires the supply side (frameworks->reaches) + the legibility side (exposed inputs); it should **hand off the demand-side learning loop (rejection->ranking) to a tightly-scoped LOCAL follow-on (SEED-009 minimal form)** so the layer stops being deaf while the larger graph is built. This confirms the 157-CONTEXT "nav-engine consumption deferred" boundary AND names the specific follow-on it defers to.

## Open questions (for discuss/plan)

1. **Sensor firability (empirical)**: `dispatchSensors` IS called with `sensorCtx.roomDir` populated and `normalizeTurn` runs (the seam is reached), but do SENS-02..05/07 actually mint reaches on a PRODUCTION cold-room turn, or return null for lack of room state (venture_stage, JTBD, cortex)? Needs a LIVE trace on a fresh room, not a code read.
2. **Outcome-edge count**: SEED-009's trigger is >=1000 outcome edges; estimate is <100. If true, the full learned-weight refit is premature and the bounded rejection-penalty (enh. 1) is the only justified learning mechanism now. Needs a count query across the room registry.
3. **Rank by machine reach_id or by JTBD label?** Investigator-2's deepest point (L1 paradigm): the navigator thinks "stress-test my assumptions," not "pick the contradiction reach." Inverting the surface would unlock feedback on the label->reach MAPPING. A larger Phase 149 (JTBD-label re-anchor) question Phase 157 should explicitly defer-or-adopt (BOG-07 partially overlaps it).
4. **Is the frozen 0.70/0.15 gate empirically optimal** or a Phase 88.2 UI constant never validated on behavior? An A/B variant needs a telemetry harness + risks a constitutionally-frozen constant. Scope only after the learning loop + completion-rate metric exist.
5. **Cross-navigator pattern detection** ("N other WDP navigators rejected this reach") is Part-8-sensitive: per canon Part 8 it is a separate product with a separate installer + legal review, NOT a flag on this one. Explicitly OUT of Phase 157's room-local scope.
6. **Does `hats` get a sensor or get de-scoped?** A navigator-gated frozen-bank-adjacent decision (mirrors D-09); blocks closing the sensor-reach matrix; cannot be resolved by an engineer unilaterally.

## RESEARCH COMPLETE
