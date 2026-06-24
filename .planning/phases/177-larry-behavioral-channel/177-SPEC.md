---
kind: spec
phase: 177
slug: larry-behavioral-channel
canon_parts: [1, 3, 4, 7, 8, 11]
---

# Phase 177 SPEC: The Behavioral Channel

Requirement IDs BCH-01 .. BCH-18. At scaffold time every requirement is PLANNED. State
moves to WIRED wave-by-wave; the phase gate (tests/run-all-177.sh) is the single source of
truth for green.

## Architecture decision (the bright line)

The engine owns the composed decision; the model emits observations only.
- ALLOWED (model emits):    `reframe_cue=solution_no_problem, confidence=0.8, escape_hatch=true`
- FORBIDDEN (model emits):  `dial=0.3, fire=context_block, investment_level=0.55`

Prose ordering is LOCKED to SAME-TURN two-pass: Pass 1 emits the observation block only ->
the engine composes observation + deterministic inputs + ignite persona + register
override -> Pass 2 writes prose descending from the engine's read of THIS turn.

Thresholds (provisional until BCH-CAL pins them; theater until then):
| Band           | Range     | Behavior                                                             |
|----------------|-----------|----------------------------------------------------------------------|
| Below floor    | < 0.50    | Cue discarded; engine runs base curve. STILL LOGGED.                 |
| Protected band | 0.50-0.85 | Cue fires SIGNAL-tier, outranks keyword, CANNOT override Brain>=0.70. |
| Above ceiling  | > 0.85    | Cue may outrank the graph.                                           |

Ceiling 0.85 is pinned >= 15 points above Brain's 0.70 gate (navigation-engine.cjs:74
RECOMMENDED_CONFIDENCE_FLOOR). All three numbers live in f-selector-ranker.cjs:47-52,
NONE in any prompt.

## Requirements

| ID | Requirement | Wave | State |
|----|-------------|------|-------|
| BCH-01 | Engine owns the decision; model emits observations only. Adversarial: the model output schema CANNOT carry dial/investment/reach fields. | 1-2 | PLANNED |
| BCH-02 | Observation block schema frozen and Zod-validated at the emit boundary. | 2 | PLANNED |
| BCH-03 | Two-pass same-turn ordering: observation -> compose -> prose. Prose generation receives the composed dial of the SAME turn. RELAXATION: if BCH-13's fallback is active, relaxes to same-OR-prior-turn so both criteria stay green during a latency incident. | 2 | PLANNED |
| BCH-04 | calibration_observations logs pre-threshold cues INCLUDING discarded. Test: a below-floor cue still writes a row. | 2 | PLANNED |
| BCH-05 | Floor/ceiling/band live in f-selector-ranker.cjs, NOT in any prompt. Adversarial grep: no threshold literal in skills/*/SKILL.md or larry-server-instructions.md. | 1 | PLANNED |
| BCH-06 | Ceiling > Brain floor by >= 15 points (0.85 vs nav-engine.cjs:74 0.70). | 1 | PLANNED |
| BCH-07 | SEAM 3 modifier inserts between nav-engine.cjs:466 and :468; null defers to Brain. Test: a null modifier leaves the legacy Brain path byte-identical. | 4 | PLANNED |
| BCH-08 | SIGNAL-tier cue outranks keyword (lib/core/sensors/sensor-types.cjs:174-180; note sensors/ path) but loses to Brain>=0.70 inside the protected band. Two tests, both directions. | 4 | PLANNED |
| BCH-09 | FORCED-MATERIAL guardrail: SEAM 2 suppresses the gate for autonomous_safe only; never for isIrreversibleStep() (chain-executor.cjs:147-173). Adversarial: an autonomous_safe step carrying "deploy" still halts. | 5 | PLANNED |
| BCH-10 | Four-arrow HUD renders every turn (TTY + degraded plain-text); arrows mutate investment_level (up/down) and posture (left/right) only. | 1 | PLANNED |
| BCH-11 | (folded into BCH-16) manual override writes a calibration_observations row. | 2 | PLANNED |
| BCH-12 | Per-turn badge driven by COMPOSED posture/mode; painted at composition so it cannot lie. Test: the color map has NO praise/grade key (invisibility by absence). | 2 | PLANNED |
| BCH-13 | Latency budget: two-pass turn within the agreed ceiling; documented fallback to one-turn-lag if breached. When the fallback triggers, BCH-03's same-turn invariant relaxes to same-or-prior-turn for the duration - reconciled, not contradictory. | 2 | PLANNED |
| BCH-14 | Part 8: zero egress. Adversarial tripwire: calibration_observations is never read by buildBrainPacket (navigation.cjs:87); role_blend/blueprint never leave. | cross | PLANNED |
| BCH-15 | (HOLE 1) BCH-CAL has a FAIL state. Test: a synthetic FLAT reliability dataset (AUC ~0.5) makes the gate FAIL - no floor/ceiling pinned, Wave-4 flag stays locked, a rework signal is emitted. A gate that cannot fail is not a gate. | 3 | PLANNED |
| BCH-16 | (HOLE 2) Keypress has TWO paths: CONTROL is synchronous and pre-compose (an Up arrow enters the same pre-Pass-1 escape_hatch gate as typed "just tell me", same turn, same latency); AUDIT is post-pipeline (manual_override @1.0). Test: an Up keypress before compose changes THIS turn's composed dial; the audit row is written after. | 1 | PLANNED |
| BCH-17 | Persona prior from ignite (Part 6) seeds dial default + problem_type_bind pre turn-1, deterministically from role_blend. Test: role_blend top=student yields ASK-leaning default + teaching-density branch with no model cue. Adversarial twin: role_blend top=founder/investor must NOT get the patient default (starts closer to TELL, terser). Degrade: no role_blend -> canonical_role scalar; neither -> cold-start neutral. Never fabricate a blend. | 1 | PLANNED |
| BCH-18 | RE-SCOPED (GAP 1 was STALE: the producer already exists at room-birth.cjs:426-430, Phase 155). Real work: compute a single-axis weighted blend { canonical_role: 1.0 } from the dual-path/shallow-doc scalar (mirror persona-override.cjs:280-281) and thread it to birthRoom opts.roleBlend. Test: a room born from a canonical_role scalar yields role_blend { role: 1.0 } in USER.md; degrade: with no scalar, cold-start neutral. Adversarial: assert no Brain egress of role_blend (Part 8). | 1 | PLANNED |

## Phase gate suites

tests/run-all-177.sh aggregates (CJS suites; exit 0 only if all pass; no literal em-dash):

| Suite | Covers | Wave |
|-------|--------|------|
| test-bch-01-ownership.cjs | BCH-01 (schema cannot carry composed state) | 1-2 |
| test-bch-04-shadow-log.cjs | BCH-04 (below-floor cue still logs) | 2 |
| test-bch-07-seam3-insertion.cjs | BCH-07 (null defers, legacy byte-identical) | 4 |
| test-bch-08-signal-tier.cjs | BCH-08 (outranks keyword, loses to Brain>=0.70) | 4 |
| test-bch-09-forced-material.cjs | BCH-09 (deploy step still halts) | 5 |
| test-bch-10-register-hud.cjs | BCH-10 (HUD renders; arrows mutate the two axes) | 1 |
| test-bch-12-color-register.cjs | BCH-12 (no praise key; painted at composition) | 2 |
| test-bch-14-part8-egress.cjs | BCH-14 (zero egress tripwire) | cross |
| test-bch-15-calibration-fail.cjs | BCH-15 (flat dataset FAILS the gate) | 3 |
| test-bch-16-keypress-latency.cjs | BCH-16 (control synchronous; audit deferred) | 1 |
| test-bch-17-ignite-persona.cjs | BCH-17 (student ASK-leaning; founder twin) | 1 |
| test-bch-18-persona-write.cjs | BCH-18 (producer writes role_blend; degrade real) | 1 |

Carried regression fences (stay GREEN; not part of the BCH count):
- test-reach-ids-drift.cjs   (frozen 6 reach_ids, no 7th)
- test-posture-ids-drift.cjs (frozen 3 postures, no 4th)

## Non-goals

- The blueprint-family "HOW" leg of persona is OUT of the deterministic Wave 1 (kept
  optional). NOTE: the bundle's GAP 2 ("room-blueprints.json absent") was STALE - the file
  exists (8 families, Phase 155-05) and birthRoom already consumes it, so this leg is no
  longer blocked; it is descoped by choice, not by absence.
- Not minting a 7th reach or a 4th posture (frozen-set fences must stay green).
- Not opening any Brain wire (the calibration log is LOCAL room.db only).
- Not shipping any semantic seam (Waves 4-5) before BCH-CAL PASSES.
- Not cutting a release (phase branch / scaffold-first commit only).

## Open machinery questions

Q1-Q13 are tracked in the bundle's 11-OPEN-QUESTIONS-MACHINERY.md and resolved during
/gsd-plan-phase (177-PLAN.md), not at scaffold time.
