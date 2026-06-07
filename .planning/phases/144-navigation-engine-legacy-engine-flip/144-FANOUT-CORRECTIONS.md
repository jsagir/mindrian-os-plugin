---
phase: 144
type: fan-out-verification-corrections
gathered: 2026-06-06
status: AUTHORITATIVE - read alongside 144-CONTEXT.md; where they conflict, THIS wins
method: 8 parallel read-only audits + 3 adversarial verifiers + synthesis (workflow wf_d3620aa0-de3, 12 agents)
overall_readiness: ready-with-corrections
---

# Phase 144 - Fan-Out Verification Corrections (LOCKED)

A 12-agent fan-out audited every related past + future phase and adversarially refuted the 3 load-bearing claims. Results below are AUTHORITATIVE over the draft 144-CONTEXT.md.

## The exact flip point (confirmed)

`routing_source` flips at `lib/core/skill-activation-router.cjs::routeActivation()` **Precedence Rule 1** (~lines 224-246): `fireSkillRaw` non-null/non-empty AND `validateVerb(fireSkillRaw)===true` -> returns `source='engine'`. It is the ONLY `source='engine'` assignment in the codebase. Invoked from `scripts/intent-classifier.cjs:1385`, persisted at `:1535`, emitted at `:826`. **The router is READ-ONLY for Phase 144.** The flip is a pure CONSEQUENCE of `lib/core/navigation-engine.cjs::decide()` line 592 (`decision.fire_skill = resolveFireSkill(...)`) returning a non-null canonical verb.

- **Claim 1 (flip is a consequence, not a hidden assignment): CONFIRMED.**
- **Claim 2 (wire sensors + flip at router WITHOUT weakening test-sensors-routing-fence.cjs): CONFIRMED.** dispatchSensors is a pure local call; wiring it inside decide() touches no sensor file.
- **Claim 3 (NAV-01 bar + Tests 16/17 = ACPT-01): REFUTED in part - see the CRITICAL correction.**

## CRITICAL correction - Tests 16/17 FAIL TODAY, and partly for a FIXTURE reason (not only sensors)

`lib/memory/skill-activation-router.test.cjs` is **15/17 today - Tests 16 and 17 FAIL** (AssertionError on empty stdout). My draft CONTEXT wrongly assumed this contract was green. The adversarial verifier was right they fail, but the synthesis pinned the real cause:

- The integration tests inject `MOS_NAV_TEST_FIRE_SKILL='Run Methodology'` at `intent-classifier.cjs:1293` (sets `decision.fire_skill` DIRECTLY, bypassing resolveFireSkill). So they SHOULD prove the flip with zero sensor code.
- They fail because of a **FIXTURE REGRESSION**: `makeRoomsFixture` writes `.rooms/registry.json` as `{"rooms":["fixture-room"]}` (array of STRINGS), but Phase 127.3 routed `resolveActiveRoomDir` through `lib/core/resolve-active-room.cjs` whose Array branch matches `r.slug===slug || r.name===slug`. A bare string has neither -> `resolveActiveRoom` returns null -> the engine block at `intent-classifier.cjs:1369 (if (roomDir))` is skipped -> stdout empty -> assertion fails.
- **PROVEN by the fan-out:** patching the fixture registry to `[{slug, abs_path}]` makes `routing_source: engine` emit IMMEDIATELY through the EXISTING router with NO sensor code.

**Implication for the plan:** this is the single highest-leverage correction. It splits the work cleanly: a FIXTURE REPAIR makes Tests 16/17 green and proves the flip path works end-to-end (the router is fine), and the SENSOR WIRING is the genuine new capability that makes fire_skill non-null in real tier_0/mode_b turns (not just under the test-injection stub).

## Other corrections to the draft CONTEXT

1. **REACH_IDS are exactly 5, not 7.** `lib/core/sensors/sensor-types.cjs` freezes exactly: `context_block, contradiction, cross_room, brain_consult, deep_research`. There are 7 SENSORS (detectors) in SENSOR_REGISTRY but they emit reaches keyed to these 5 ids. The `reachIdToSkillFamily()` mapping table MUST key on these 5 actual values.
2. **The Mode-A gate (navigation-engine.cjs line 284) only constrains the BRAIN.md path.** Sensors are not consulted today. Phase 144's required relaxation: let sensor candidates produce a non-null `fire_skill` in ANY tier (sensors are LOCAL-first and must fire even in tier_0/mode_b). The sensor branch must run BEFORE the mode_a BRAIN gate.
3. **'mixed' routing_source is unreachable in 144 scope** (Rule 2 needs suppress_skills non-empty; resolveSuppressSkills returns [] at lines 326-328). Only `engine` and `legacy` are live. Plans must not rely on 'mixed'.
4. **dispatchSensors signature is `dispatchSensors(turn, tuple, ctx)`** -> `Array<reach>`, where tuple = `{problem_type, complexity, stage}` (from /mos:diagnose) and ctx = LOCAL handles `{roomDir, lowFillSections}`. The caller (intent-classifier hot path) must thread the tuple, or sensors honestly degrade to fewer firings - confirm the hot path supplies it.

## The 144 build (implementation-concrete)

In `lib/core/navigation-engine.cjs::decide()`, after `brain_md_tier_mode` is resolved (~line 449) and before `resolveFireSkill` (line 592): `require('./insight-sensors.cjs')` at module top; call `const sensorReaches = dispatchSensors(turn, tuple, ctx)`. Change `resolveFireSkill(brain, weightApplied, tierMode)` -> `resolveFireSkill(brain, weightApplied, tierMode, sensorReaches)`; add a `reachIdToSkillFamily()` table (mirroring `verbToSkillFamily` at lines 303-319) mapping the 5 REACH_IDS to the closed 10-verb skill families. New precedence inside resolveFireSkill: **wicked_escalation (>=8 -> soft-systems) FIRST, then sensor reach -> fire_skill (ANY tier), then the existing mode_a BRAIN.md pattern_matches verb as secondary.** Append a sensor-source clause to `chosen_rationale` (line 589) naming the reach_id + posture (Part 8: reach_id + posture only, never the sensor's internal detection string). Update the line-537 fence comment to "NOT assigned here; flipped at the router layer when fire_skill is non-null." The router flips routing_source to engine as a pure consequence (no router edit).

**Sensor->fire_skill precedence when multiple fire (the core design decision, document it):** wicked_escalation > top sensor reach by canonical REACH_IDS order > BRAIN.md verb > weightApplied>=0.9 context-engine fallback.

## Zep-informed, Part-8-safe recommendations (LOCAL graph only - never to Brain)

1. **Adopt Zep's Smart-Context-Assembly OUTPUT SHAPE inside decide()'s TRACE ONLY:** `trace.context_assembly = { user_summary, facts, decision_grounding }` - user_summary = top-3 navigatedNeighborhood node ids/types/scores (already Part-8-safe scalars); facts = fired sensor reach_ids + evidence scalars (counts/enums/phase_ids); decision_grounding = which fact justified the chosen fire_skill. LOCAL trace JSON; nothing reaches the Brain. (This is the Zep `USER_SUMMARY` + `FACTS` block, mapped to local graph scalars.)
2. **LOCAL temporal scalars** `{first_seen, last_updated}` on each neighborhood node + sensor candidate (read via the navigation.cjs chokepoint) - records WHEN routing inputs were fresh; feeds Phase 146's freshness check. Pure LOCAL (mirrors Zep's fact valid-date-ranges).
3. **Mirror Zep's last-2-messages seeding using the ALREADY-SHIPPED Leg C seed** (room-context.cjs SEED_FRAGMENT_COUNT=2). Sensors needing "what the user said" read `context.roomContext.recentMessages` (windowed/capped LOCAL) or `turn.userText`. No new retrieval surface, no Brain call.
4. **LOCAL latency telemetry** `trace._meta.latencies_ms { getRoomContext_ms, dispatchSensors_ms, decide_total_ms }` to ~/.mindrian/telemetry JSONL; guard the 1200ms NAV budget (141 benched getRoomContext at 0.7-1.0ms; dispatchSensors is sync). LOCAL diagnostics, never transmitted.
5. **Do NOT import Zep's semantic-fact-grounding assumption.** Leg C is rule-based getNeighborhood ranking with NO FTS5/embeddings (Phase 141 D-04b punted FTS5). Build sensor->fire_skill on the LOCAL frozen-score ranking only. If a populated-room benchmark exceeds ~900ms, that triggers the documented FTS5 contingency - NOT Phase 144's job, but the plan must be aware.

## Fences that MUST stay green (verified green now unless noted)

- `tests/test-sensors-routing-fence.cjs` (GREEN, 2/2) - never edit any lib/core/sensors/* file; wire dispatchSensors as a LOCAL call inside decide().
- `tests/test-decide-part8-invariant.cjs` (GREEN, 2/2) - new decide() code adds no forbidden surface (no packet/brain-client require, no projectText/hashText/sha256).
- `skill-activation-router.test.cjs` Tests 1-15 (GREEN) - must not regress.
- `skill-activation-router.test.cjs` Tests 16/17 (**RED today**) - Phase 144 must turn GREEN (the fixture repair does this; they are ACPT-01 of the Phase 146 gate).
- `tests/test-spine-navigates-decide.cjs` (CASC-02 fence) - relax ONLY the navigation-engine line-537 comment; never weaken the sensor-module fence.

## Suggested plan shape (3 plans, 2 waves)

- **Wave 1 (parallel-safe, independent files):**
  - **Plan 01 (the one genuine BUILD):** the engine wiring - require insight-sensors, call dispatchSensors in decide(), extend resolveFireSkill signature + reachIdToSkillFamily table (5 reach_ids) + sensor-first precedence + sensor-source rationale + the Zep trace.context_assembly shape + latency telemetry, update the line-537 fence comment.
  - **Plan 02 (the fixture REPAIR):** fix makeRoomsFixture's registry.json to the `{slug, abs_path}` object shape -> turns Tests 16/17 GREEN independent of Plan 01 (proves the flip path via the existing router), add the cold-room honest-negative assertion.
- **Wave 2 (depends on both):**
  - **Plan 03 (the acceptance harness):** tests/run-all-144.sh mirroring run-all-143.sh, aggregating (a) populated-room positive `routing_source: engine` via a REAL fired sensor (not just the stub), (b) cold-room negative `legacy`, (c) reruns of test-sensors-routing-fence + test-decide-part8-invariant + skill-activation-router Tests 1-17 all green; structured so Phase 146 ACPT-01 composes it.

ONE genuine build (Plan 01); Plans 02-03 are repair + verification (Canon Part 7).
