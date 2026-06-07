---
phase: 144
phase_name: Navigation Engine legacy->engine Flip
gathered: 2026-06-06
status: Ready for planning
source: Synthesized from SEED-008 sub-loop 3 + the 00c-TRIGGER-MAP Section 9 + live grounding of decide() and the routing-source resolution layer. No Q&A discuss round.
canon_parts: [Part 2, Part 3, Part 8, Part 9]
requirements: [NAV-01]
---

# Phase 144: Navigation Engine legacy->engine Flip - Context

**Gathered:** 2026-06-06
**Source:** SEED-008 sub-loop 3 (the unifier) + `docs/UI-UX-CONVERGENCE-2026-05-10/00c-TRIGGER-MAP.md` Section 9 (the wiring spec) + a live grounding pass (2026-06-06) of `decide()`, `scripts/intent-classifier.cjs`, and the skill-activation-router contract. This is the milestone KEYSTONE - the single change SEED-008 says flips `routing_source: legacy -> engine`.

<domain>
## Phase Boundary

Phase 144 makes the SHIPPED Phase 91 navigation engine `decide()` actually ROUTE from the graph instead of file-presence - so a turn that should fire a reach produces `routing_source: engine` (not `legacy`) in the trace. Per the 00c correction (2026-05-10): Phase 91 already SHIPPED (v1.11.0 - `decide()`, the UserPromptSubmit integration, the 8-field trace, the tier modes). The gap is NOT building the engine; it is WIRING `decide()` to consume {local graph + BRAIN.md + the trigger map} so it emits a non-null `fire_skill` / `offer_next_step`, which is what flips the routing source to `engine`.

**This is a single-requirement (NAV-01) but architecturally CENTRAL phase.** Most of its inputs already shipped:
- The navigated graph neighborhood -> Phase 142 CASC-02 (decide() already computes `navigatedNeighborhood` from `getRoomContext`'s Leg C).
- The BRAIN.md tier -> Phase 142 NAV-02 (decide() already reads `readQuadruple` -> `brain_md_tier_mode`).
- The trigger map -> Phase 143 sensors (`lib/core/insight-sensors.cjs` SENSOR_REGISTRY) - NOT yet wired into decide().

**IN SCOPE:** NAV-01 - wire the 143 sensors into decide(); make decide() produce a non-null decision from {neighborhood + BRAIN.md tier + sensors}; resolve `routing.source = 'engine'` when it does; reconcile the prior-phase routing fences.

**OUT OF SCOPE:** Scheduled sensors -> Phase 145. The loop-fires acceptance gate -> Phase 146 (144 makes the flip POSSIBLE; 146 is the scripted dogfood proof). The dial-TUI render -> 143.1 (done). No new sensors (143 owns the 7).
</domain>

<critical_finding>
## The flip mechanism already exists - 144 makes decide() PRODUCE a decision

Live grounding (2026-06-06):
- `routing_source` is NOT assigned inside `navigation-engine.cjs` (only a Phase-144 fence comment at line 537). It is resolved in the ROUTER layer: `scripts/intent-classifier.cjs:1535` sets `traceEntry.routing_source = routing.source`, emitted at line 826.
- The engine-vs-legacy contract is ALREADY DEFINED by the skill-activation-router (see `lib/memory/skill-activation-router.test.cjs` Tests 16/17): **engine fire_skill (non-null) -> `routing_source: engine`; engine null/silent -> `routing_source: legacy`.** So the flip is a CONSEQUENCE of decide() producing a non-null fire_skill, not a separate assignment to hunt down.
- `decide()` returns `fire_skill: null` today because: (a) BRAIN.md is often absent -> `tier_0` -> the engine falls to its dumbest mode; (b) the 143 sensors are NOT wired in, so no sensor-driven candidate reach reaches the decision. Every turn this session emitted `routing_source: legacy / tier_0` for exactly these reasons.

**So NAV-01 is:** wire the sensors into decide(), let decide() consume the (already-threaded) neighborhood + the BRAIN.md tier + the sensor candidates to emit a non-null `fire_skill` / `offer_next_step`, and the router's engine-vs-legacy contract flips `routing_source` to `engine` as a consequence. The work is concentrated in `decide()` (the sensor consumption + the non-null decision production) and the router resolution (confirm `routing.source` becomes `engine` on a non-null engine decision).

## The fence reconciliation (the subtle part)

Phases 142 and 143 added routing fences asserting their layer does NOT flip `routing_source` to `engine` (test-sensors-routing-fence.cjs over lib/core/sensors/*; test-decide-part8-invariant.cjs; the navigation-engine fence comment). Those fences were correct FOR THOSE PHASES. Phase 144 is the phase that INTENTIONALLY flips it - but at the ROUTER/engine-decision layer, NOT inside the sensor module. So:
- The 143 sensor-module fence STAYS VALID: the sensors still do not assign routing_source; they produce candidate reaches. KEEP test-sensors-routing-fence.cjs green.
- The flip happens where decide()'s non-null fire_skill drives the router's `routing.source = 'engine'`. The planner must place the flip at the right layer and update/relax ONLY the navigation-engine-level fence that was a placeholder for "144 not done yet" - without weakening the sensor-module fence.
</critical_finding>

<decisions>
## Implementation Decisions (LOCKED from research + grounding)

- **Wire the 143 sensors into decide().** Import `lib/core/insight-sensors.cjs` SENSOR_REGISTRY; run the applicable sensors on the turn signal + the `/mos:diagnose` tuple; a fired sensor's reach becomes a candidate `fire_skill` / `offer_next_step`. Reuse the sensor dispatch - do not re-implement detection.
- **Make decide() produce a non-null decision from the live inputs.** Compose {the navigatedNeighborhood (142 CASC-02, already threaded) + the brain_md_tier_mode (142 NAV-02, already read) + the sensor candidates (143)} into a non-null `fire_skill` / `offer_next_step` when the inputs warrant it. When inputs are genuinely empty (cold room, no sensor fired, tier_0), it correctly stays null -> legacy (that is honest, not a bug).
- **The flip is a consequence, not a new assignment.** Confirm/wire that a non-null engine decision drives `routing.source = 'engine'` in the router (intent-classifier / skill-activation-router), per the existing Test 16/17 contract. Do NOT invent a parallel routing_source assignment.
- **Fence reconciliation (HARD):** keep the 143 sensor-module routing fence (test-sensors-routing-fence.cjs) GREEN - the sensors never assign routing_source. Flip only at the engine-decision/router layer. Update the navigation-engine Phase-144 fence comment/test from "must not flip" to "flips here, at this layer" with a test asserting `routing_source: engine` appears on a non-null engine decision.
- **Mode-awareness (Canon Part 3):** the flip respects the tier modes - Mode A (Brain reachable, BRAIN.md present) is where `engine` most reliably appears; Mode B / Tier 0 may still legitimately emit `legacy` when there is genuinely nothing to route against. NAV-01's bar: `routing_source: engine` appears in >=1 trace per session in a POPULATED room when Brain reachable - not on every turn.
- **Canon Part 8 fence (HARD):** any Brain reach the engine makes carries generic handles only (framework names, problem-type enums, phase ids) - never user content. Keep test-decide-part8-invariant.cjs green over the new decide() code.

### Verification posture (loop-fires; seeds Phase 146)
- An acceptance test must drive a populated-room turn end-to-end and assert `routing_source: engine` appears in the trace (this IS ACPT-01 of the Phase 146 gate - SEED-008 calls it Phase 94-03's long-unmet criterion). Mirror tests/run-all-143.sh as tests/run-all-144.sh. A cold-room turn must still legitimately emit `legacy` (the honest negative).
</decisions>

<canonical_refs>
## Canonical References (downstream agents MUST read before planning/implementing)

### The keystone spec
- `docs/UI-UX-CONVERGENCE-2026-05-10/00c-TRIGGER-MAP.md` Section 9 (the wiring directive: "wire the shipped Phase 91 engine to {graph + BRAIN.md + this map}") + Section 8 (the closed-loop cycle) + the "Important correction" header (Phase 91 shipped; the gap is wiring).
- `.planning/seeds/SEED-008-...md` sub-loop 3 (the unifier) + the Acceptance Contract item 1 (routing_source: engine).
- `.planning/research/v1.13.1-larryreach-fanout/raw-slices/SLICE-B.md` (focus seeding) + `SLICE-C.md` (BRAIN.md tier).

### The code to wire (live grounding)
- `lib/core/navigation-engine.cjs` `decide()` - already computes `navigatedNeighborhood` (CASC-02, ~line 403) + reads `readQuadruple` -> `brain_md_tier_mode` (NAV-02, ~line 339-363) + resolves `fire_skill` (resolveFireSkill ~line 270, 592). The sensor consumption + non-null decision production lands here. The Phase-144 fence comment is at line 537.
- `lib/core/insight-sensors.cjs` (Phase 143 SENSOR_REGISTRY) - the sensors to wire in. KEEP lib/core/sensors/* fence (test-sensors-routing-fence.cjs) green.
- `scripts/intent-classifier.cjs` (line 1535 `routing_source = routing.source`; line 826 the emitter; the strict_mode source) - the router resolution layer where engine-vs-legacy is decided.
- `lib/memory/skill-activation-router.test.cjs` Tests 16/17 - the EXISTING engine-vs-legacy contract (non-null fire_skill -> engine; null -> legacy). Honor it; do not contradict it.
- `lib/core/navigation-engine-shared.cjs` (line 212 - routing_source stays untouched note).

### Canon + test pattern
- `docs/MINDRIAN-CANON.md` Part 3 (Mode A/B/Tier 0 option-generation tier-awareness), Part 2 (the engine selects next verbs), Part 9 (the engine navigates SQL not folders), Part 8 (generic handles only).
- `tests/run-all-143.sh` - the aggregator pattern to mirror as `tests/run-all-144.sh`.
</canonical_refs>

<specifics>
## Specific Ideas
- The flip is a CONSEQUENCE of decide() producing a non-null fire_skill from the live inputs - not a hunt for a hidden routing_source assignment. The router contract (Test 16/17) already does the rest.
- The hardest correctness risk is the fence reconciliation: flip at the engine/router layer WITHOUT weakening the 143 sensor-module fence. The sensors produce candidates; the engine decides; the router labels the source.
- NAV-01's bar is >=1 engine trace per session in a populated room when Brain reachable - NOT every turn. A cold-room legacy trace is honest, not a failure.
- This is ACPT-01 of the Phase 146 gate. Structure the acceptance test so 146 composes it.
</specifics>

<deferred>
## Deferred Ideas
- Scheduled sensors -> Phase 145.
- The full 5-criterion loop-fires dogfood gate -> Phase 146 (144 enables ACPT-01; 146 proves all 5).
</deferred>

---

*Phase: 144-navigation-engine-legacy-engine-flip*
*Context synthesized 2026-06-06 from SEED-008 sub-loop 3 + 00c Section 9 + live decide()/router grounding*
