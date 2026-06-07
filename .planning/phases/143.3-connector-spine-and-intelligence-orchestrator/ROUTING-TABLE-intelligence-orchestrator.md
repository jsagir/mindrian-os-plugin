---
phase: 143.2
type: routing-table-refinement (working artifact - the spec the intelligence-orchestrator plan will consume; NOT a plan yet)
status: refining (per navigator 2026-06-07 "keep refining the routing table first")
decisions_locked:
  - live dispatchSensors call, gated behind a Tier check (degrade to doctrine-sim at tier_0)
  - fileEvidenceWithReadback as the filing path, wireAccept as the fallback if readback errors
  - new skill (intelligence-orchestrator), not folded into room-proactive; arbitrate via the Intelligence Hierarchy
managed_under: MindrianOS-Plugin / decisions (the parallel session that proposed the intelligence-orchestrator skill ran in the plugin repo's decisions context - NOT motj-ecosystem); this doc is the dev-repo reconciliation of that proposal + the research+hats map
---

# intelligence-orchestrator - Refined Routing Table

The skill is the FIRST CONSUMER of the SENS sensor spine (`lib/core/insight-sensors.cjs::dispatchSensors`), which is built+tested but has ZERO production consumers today. It reads candidate reaches, maps each to an intelligence sub-mode (a RENDER LABEL under one of the frozen 5 reach-ids), gates to ONE per beat, and surfaces it as a Shape-F Decision Gate. Never auto-fires.

## The core loop (5 steps, decisions baked in)

1. **Read the spine (LIVE, tier-gated).** Call `dispatchSensors(turn, tuple, ctx)` -> `Array<{reach_id, posture, dispatch, companions, signal, evidence}>`. GATE: only when `brain_md_tier_mode !== 'tier_0'` (mode_a/mode_b) is the live call authoritative; at tier_0 (cold room) degrade to the doctrine-sim floor (Larry's Provoked-table doctrine) so the skill is safe pre-144. [OPEN-2: confirm the exact tier predicate.]
2. **Map to sub-mode** via the dispatch handle (table below). The sub-mode is a RENDER LABEL, never a reach-id.
3. **Gate to one (one-reach-per-beat).** If multiple fired, rank by the Intelligence Hierarchy (Tensions > Bottlenecks > HSI Surprises > Convergences > Blind Spots) then evidence strength. `deep_research` is the SANCTIONED exception (may chain a multi-angle plan, plan-gated).
4. **Offer, never fire.** Surface the chosen reach as a Shape-F Decision Gate (Part 3). Generic handles only to Brain (Part 8); web hat-scoped (Part 2).
5. **On APPROVE:** resolve the REAL command via `commandsForFramework("<EXACT framework name>")` (WFL-01 - never hardcode the slug); fire it; file the result via `fileEvidenceWithReadback` (fallback `wireAccept` on readback error); `surfaceFileEvidenceResult` to remind the navigator what landed (the FILEVAL honesty rule).

## The routing table (reconciled - parallel session + the research+hats map + WFL-01)

| PUSH | Sensor | dispatch handle (live, from the sensor) | reach_id (frozen 5) | sub-mode (render label) | EXACT framework name (-> resolver) | callable on APPROVE | posture | Intel-Hierarchy rank |
|------|--------|------------------------------------------|---------------------|--------------------------|-------------------------------------|---------------------|---------|----------------------|
| 01 | SENS-03 methodology-decision | `brain_framework_chain (CHAINS_TO next-framework)` | brain_consult | framework-chain | (Brain query, generic handles) | brain_framework_chain via brain-connector | hold | (meta - chains the others) |
| 02 | SENS-02 lagging-component | `find-bottlenecks (rs-engine reverse-salient)` | context_block | reverse-salient | Reverse Salient Analysis | reverse-salient-agent.surfaceFinding (F.0) -> resolver | pull_back | 2 (Bottlenecks) |
| 03 | SENS-06 + 20+ artifacts + surprise>=0.7 | (cascade recompute) | context_block | hsi / whitespace (Rule 7e split) | HSI Semantic Surprise Analysis Assistant | resolver -> score-innovation / whitespace | hold | 3 (HSI Surprises) |
| 04 | SENS-01/06 tension or 2+ domains | (cascade / first-material) | brain_consult (connect) / context_block (analogy) | cross-domain-connect / cross-domain-analogy | Usher's Model of Cumulative Synthesis / Four Lenses of Innovation | resolver -> find-connections / find-analogies | hold->push | 1 (Tensions, when CONTRADICTS) |
| 05 | SENS-05/07 team-stuck | `breakthrough-scan (Category G) + agents/investor objection` (07) / `jtbd-reweight` (05) | brain_consult | six-hats (team_perspective) | Six Thinking Hats | resolver -> think-hats / persona --parallel + Appendix-E 5 handoff lines | hold | 4/5 (Convergences/Blind Spots) |
| 06 | SENS-04 external-fact (3 fire conditions) | `mos:research (hat-scoped WebSearch)` | deep_research (Green) / context_block | hat-scoped-research | Hypothesis-Driven Problem Solving (hat-scoped) | hatScopeFor(hat) -> research pipeline (extractContext -> runSourceLens -> filing-selector -> fileEvidenceWithReadback); Green -> Skill(deep-research) | hold->plan-gate | (escalation, any hat) |

### The hat-scope map (PUSH-06, confirmed vs hat-scoping-table.cjs)
White [Tavily, arxiv] data, deep_research:NO | Green [patents, arxiv, deep-research] innovation, deep_research:YES | Black [Tavily, arxiv] failure-cases | Yellow [Tavily, arxiv] success-cases | Red [] intuition-only web_enabled:false | Blue [synthesis] cross-hat. The 3 deep-research fire conditions: (a) cheap-layer-thin; (b) load-bearing claim Practitioner/None evidence near commit (Well-Defined/Ready-to-Build); (c) the active BONO hat affords it (Green/Blue).

## What this closes vs what is already callable
- **Net-new (ABSENT today):** HSI/whitespace push (03), Six-Hats push (05), deep-research fire-triggers (06), AND the FIRST CONSUMER of the sensor spine itself.
- **Already callable, just unrouted (Part 7 reuse):** every rs surface (`reverse-salient-agent.surfaceFinding` renders the F.0 gate), the research pipeline (`wireAccept`/`fileEvidenceWithReadback` are live), `hatScopeFor`, the resolver. The skill is mostly WIRING, not new engines - which is why it is a skill, not a phase of new lib code.

## STILL-TO-RESOLVE (the refinement openers - need the navigator / parallel session)

- **OPEN-1 (the dispatch-handle -> framework-name map - the heart of WFL-01 in the skill):** the sensor `dispatch` field carries HUMAN HANDLES ('find-bottlenecks (rs-engine reverse-salient)', and even a raw 'mos:research' slug), NOT exact framework names. The orchestrator needs a DETERMINISTIC map: dispatch-handle/sub-mode -> EXACT framework name (data/framework-names.json) -> resolver. Where does this map live - in the skill doctrine (a frozen table), or a small lib data file? It must be drift-tested against framework-names.json (the same name-drift trap WFL-01 flagged). The raw 'mos:research' handle in the sensor is itself a WFL-01 smell - the orchestrator must translate it to 'Hypothesis-Driven Problem Solving' -> resolver, never pass the slug through.
- **OPEN-2 (the Tier-gate predicate for the live call):** decision #1 said "gated behind a Tier check." Specify: live dispatchSensors authoritative at mode_a + mode_b; degrade to doctrine-sim at tier_0? Or a separate feature flag so it does not preempt Phase 144's decide()-wiring? (Phase 144 wires the ENGINE-side consumer; this skill is the PROMPT-side consumer - two consumers of one spine. Confirm they coexist without double-firing.)
- **OPEN-3 (filing path per family):** `fileEvidenceWithReadback` fits the families that PRODUCE evidence (06 research, 04 find-connections). But 02 reverse-salient and 05 six-hats SURFACE findings / spawn perspectives - do they file an EvidenceClaim, or just write a memory_event + the cascade edge? Map each family to its write path (fileEvidenceWithReadback vs a lighter surface-only memory_event).
- **OPEN-4 (the rs-agent [BRAIN] header vs the local context_block reach):** `reverse-salient-agent.surfaceFinding` returns a `[BRAIN]` header (brain-suggestion-template), but PUSH-02's reach_id is context_block (LOCAL). Reconcile: is the [BRAIN] header just a render choice (fine), or does it imply a Brain call that contradicts the local reach (Part 8 check)?
- **OPEN-5 (coexistence with room-proactive):** room-proactive surfaces CASCADE findings (Part-4 edges from filing); the orchestrator surfaces SENSOR reaches (Engine 1/2). Both want the Decision Gate. Confirm the arbitration: the Intelligence Hierarchy ranks BOTH (a room-proactive CONTRADICTS finding = Tensions = rank 1, outranks a bottleneck reach); one-reach-per-beat across BOTH skills. Does the orchestrator READ room-proactive's last-cascade.json too, or do they stay separate surfaces that the hierarchy arbitrates downstream?
