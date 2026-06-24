---
kind: planning-brief
phase: 177-larry-behavioral-channel
wave: 2
title: "Wave 2 - Shadow logging live (model emits, nothing fires)"
canon_parts: [1, 3, 4, 8, 9, 11]
prepared_by: "177-04 executor (recon-grounded hand-off for /gsd-plan-phase 177 --wave 2)"
date: 2026-06-24
status: ready-to-plan
blocks: ["177 Wave 3 (BCH-CAL) which blocks 177 Wave 4 (BCH-07/08 brain-aware reach resolution + research invocation)"]
---

# Phase 177 Wave 2 Planning Brief - Shadow Logging Live

## Why this wave is the next step (the ordering constraint)

The navigator's request - "invoke brain use if connected" + "research invocation" - is
**BCH-07 + BCH-08 (Wave 4)**. Those are hard-gated:

```
Wave 2 (shadow logging: BCH-01/04/12)   <- THIS BRIEF (unblocked now)
   -> Wave 3 (BCH-CAL / BCH-15: the calibration gate, ALLOWED to FAIL)
        -> Wave 4 (BCH-07/08: brain-aware reach resolution + research invocation)
```

177-SPEC non-goal (line 89): "Not shipping any semantic seam (Waves 4-5) before BCH-CAL
PASSES." 177-CONTEXT (line 159): "Waves 4-5 block on Wave 3 (BCH-CAL must PASS)." Without
shadow data the calibration gate has nothing to calibrate; without a passing calibration gate
the brain-invocation seam stays locked by design. Wave 2 produces the shadow data.

This brief does NOT author PLAN.md files (that is /gsd-plan-phase's job, and CIRS R12 requires
each plan to carry a cirs_relationship block authored at plan time). It is the recon-grounded
input the planner consumes.

## The three Wave-2 requirements (from 177-SPEC)

| ID | Requirement (verbatim intent) | Suite (currently RED stub) |
|----|-------------------------------|----------------------------|
| BCH-01 | Engine owns the decision; model emits observations only. The model output schema CANNOT carry dial/investment/reach fields. | tests/test-bch-01-ownership.cjs |
| BCH-04 | calibration_observations logs pre-threshold cues INCLUDING discarded. A below-floor cue still writes a row. | tests/test-bch-04-shadow-log.cjs |
| BCH-12 | Per-turn badge driven by COMPOSED posture/mode, painted at composition so it cannot lie. The color map has NO praise/grade key (invisibility by absence). | tests/test-bch-12-color-register.cjs |

## Recon (live anchors, opened and verified 2026-06-24)

### BCH-04 - calibration_observations (GREENFIELD; LOCAL only, Part 8/9)
- The table does NOT exist anywhere: `grep -rln "calibration_observation" lib/ scripts/ data/`
  returns empty. Matches 177-RESEARCH sec 1 ("absent from lib/ scripts/ data/").
- Co-locate the new table with the existing LOCAL schema idiom at
  **lib/core/memory-ops.cjs:23 `initMemorySchema(db)`** (which already mints identity / facts /
  sessions / fragments / assumptions / scaffold_log / voice_log / held_contradictions /
  decisions_index via `CREATE TABLE IF NOT EXISTS`). Add an idempotent
  `initCalibrationSchema(db)` in the same family (RESEARCH sec 2 preferred this over
  lazygraph-ops.cjs).
- 177-RESEARCH Part-8 caution (sec 3): a DEDICATED table is structurally invisible to
  buildBrainPacket (packet.cjs reads only {nodes, identity, edges}), so BCH-14's zero-egress
  tripwire holds BY CONSTRUCTION. Do NOT store calibration as memory_event nodes - that path
  IS swept by findRecentChanges inside buildBrainPacket (packet.cjs:330). A scalar audit
  marker MAY ride EVENT_TYPES (frozen set at **lib/core/navigation/memory-events.cjs:10**),
  but the row store is the dedicated table.
- The load-bearing test assert: a BELOW-FLOOR cue (< 0.50) still writes a row. "Shadow before
  trust" means EVERY cue is logged, including discarded ones.

### BCH-01 - engine owns the decision (observation schema)
- Existing observation/cue vocabulary lives at **lib/workflow/f-selector-ranker.cjs** and
  **lib/core/navigation/projections.cjs** (the `reframe_cue` / `escape_hatch` family;
  `computeInvestmentLevel` is the engine-owned number 177-01 extended with turn_count).
- The adversarial assert (177-SPEC): the model output schema CANNOT carry `dial`,
  `investment_level`, or `reach` fields. ALLOWED model emit: `reframe_cue=...,
  confidence=0.8, escape_hatch=true`. FORBIDDEN: `dial=0.3, fire=context_block`. The schema
  is the bright line - the engine composes the dial FROM the observation, the model never
  emits it.
- Zod is already the project's schema lib (CLAUDE.md stack; telemetry/schema.cjs precedent).
  Validate at the emit boundary (BCH-02 is the same wave's freeze).

### BCH-12 - per-turn badge painted at composition
- PATH CORRECTION: 177-RESEARCH cites "render-v2.cjs:199-205" with no directory; the file is
  **lib/render/render-v2.cjs** (not lib/core/ or lib/hmi/). The planner must open it there.
- The seam: the color gate is JTBD-anchored + posture-ready but unwired today (RESEARCH sec 1
  ledger: "render() has no posture arg"). BCH-12 adds a `posture` arg to render() and drives
  color from the COMPOSED posture, falling back to jtbd. Painted AT composition so the badge
  cannot lie about a later state.
- The invisibility-by-absence assert: the color map has NO praise/grade key. CLI has 5 colors;
  map the 3 postures (pull_back->red, hold->yellow, push_forward->green/cyan) per RESEARCH sec 2.

## Frozen contracts that MUST stay green (carried regression fences)
- The 6-reach frozen bank (test-reach-ids-drift.cjs) + the 3-posture frozen bank
  (test-posture-ids-drift.cjs). Wave 2 mints NO reach, NO posture.
- BCH-14 part8-egress (already GREEN): the dedicated calibration table must NOT become
  readable by buildBrainPacket.
- The two 177-04 seams already GREEN: test-bch-s5-turn-stage-eligibility,
  test-bch-s4a-saturation. Wave 2 reads the same turn_count; it must not regress them.
- MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the F.1 keyboard contract (Part 3 frozen).

## CIRS (Part 11) note for the planner
Wave 2 adds a LOCAL table + an observation schema + a render arg. It modifies NO invocable
surface's TRIGGER wire (no new command/skill/agent, no new reach). The likely
cirs_relationship is `surfaces_added: [], surfaces_modified: [render-v2 (badge arg only)]`
with `spine_consumed: []` for BCH-01/04 - but the planner confirms and authors the block per
docs/CIRS-RELATIONSHIP-CONTRACT.md. Declaring any cirs_relationship field auto-implies 11 in
canon_parts.

## Suggested wave shape (planner decides; this is a starting DAG)
1. BCH-04 calibration schema (initCalibrationSchema + the below-floor-still-logs test). The
   substrate the whole channel writes into.
2. BCH-01 observation schema + Zod emit-boundary (the bright line; the thing that gets logged).
3. BCH-12 badge at composition (the visible-but-honest surface; render-v2 posture arg).

Each turns its named RED stub GREEN and stays inside run-all-177.sh (currently 9 pass / 7 fail
after 177-04). House rule: hyphens, no em-dashes, no emoji. `git add -f` for .planning/.

## Entry point
```
/gsd-plan-phase 177 --wave 2
```
After Wave 2 lands and accumulates shadow data: `/gsd-plan-phase 177 --wave 3` (BCH-CAL), then
- if BCH-CAL PASSES - `/gsd-plan-phase 177 --wave 4` (the navigator's brain-aware reach
resolution + research invocation: BCH-07 SEAM-3 modifier at navigation-engine.cjs:466-468
makes a fired brain_consult resolve to a real Brain methodology packet when
context.brainAvailable, degrade to Tier-0 local when offline; BCH-08 SIGNAL-tier cue outranks
keyword, loses to Brain>=0.70).
