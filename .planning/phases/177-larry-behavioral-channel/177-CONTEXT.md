---
kind: context
phase: 177
slug: larry-behavioral-channel
milestone: v1.14.0
created: 2026-06-24
canon_parts: [1, 3, 4, 7, 8, 11]
cirs_relationship:
  surfaces_added: []
  surfaces_modified: [navigation-engine, f-selector-ranker, render-v2, nav-dial]
  surfaces_removed: []
  spine_consumed:
    - lib/core/navigation-engine.cjs
    - lib/workflow/f-selector-ranker.cjs
    - lib/core/navigation/projections.cjs
    - lib/core/navigation/memory-events.cjs
    - lib/render/render-v2.cjs
    - lib/core/persona-taxonomy.cjs
    - lib/core/user-md-ops.cjs
    - lib/core/navigation/room-birth.cjs
    - lib/core/sensors/sensor-types.cjs
    - lib/core/chain-executor.cjs
  gate_impact: "Makes Larry's conversational read a first-class SIGNAL-tier input to decide() instead of computing it twice and discarding it. The engine owns the composed decision; the model emits observations only. Adds a LOCAL-only calibration_observations table (Part 8 clean, zero egress), a four-arrow register HUD with a synchronous pre-compose control path, a per-turn De Stijl color badge painted at composition, and a deterministic ignite-persona prior. Everything semantic ships behind one calibration gate that is ALLOWED TO FAIL (BCH-CAL / BCH-15). No reach minted (frozen 6 hold), no posture minted (frozen 3 hold), no Brain wire opened. Adds tests/run-all-177.sh."
  explanation: "Closes the two-front-doors ownership bug: two routers over the same vocabulary (the 6 reaches, 3 postures, investment/dial axis), only one wired. The model becomes a SENSOR that emits {reframe_cue, escape_hatch, confidence, ...}; the engine composes those observations with deterministic inputs (turn count, node deltas, Brain confidence, decay, ignite persona) into the single dial number and the single fired reach. One read, two consumers (prose and routing), kept honest by a LOCAL ground-truth notebook and a calibration gate. Born-wired modifier per CIRS Part 11 - not a dark path."
status: context-captured
severity: NORMAL
sequence: "Follows the v1.14.0-beta train. Builds on the contextual-invocation spine (172) and the scenario wiring (176). The keystone phase of the Behavioral Channel design (bundle 2026-06-24); scaffold-only first commit, Wave 1 deterministic seams next."
---

# Phase 177 Context: The Behavioral Channel

<domain>
How Larry talks is already a structured signal stream over the engine's own vocabulary -
the 6 reaches, the 3 postures, and the investment/dial axis. Today the engine reads only
the mechanical sensors; the conversational reads Larry makes each turn (dial position,
escape hatch, reframe cues, saturation) are detected and thrown away. This is a
two-front-doors bug: two routers, the same vocabulary, only one of them wired.

The fix is single ownership. The ENGINE owns the composed decision; the MODEL emits
observations only, as first-class SIGNAL-tier inputs. One read, two consumers - prose and
routing - kept honest by a LOCAL ground-truth notebook and a calibration gate that is
allowed to fail. The pedagogy spec is the soul; the behavioral channel is the plumbing;
calibration keeps the plumbing honest to the soul.
</domain>

<why_now>
The design session (2026-06-24) produced a twice-revised spec with two holes closed
(BCH-15 flat-curve FAIL state; BCH-16 keypress control-path latency) and PART 6 corrected
after line-verification FALSIFIED two claims (the role_blend birth-write and
room-blueprints.json). The spec is grounded in real file:line into shipped
v1.14.0-beta.7. The single remaining blocker (a wedged WSL host) is cleared; this is the
scaffold-only first commit.
</why_now>

## The thesis in one paragraph

A thermostat where the wall display and the basement furnace each guess the temperature
separately and never compare notes is Larry today: one part reads how you talk to shape
his words, another reads sensors to decide what to do. Two guesses, same room, guaranteed
to drift - and the drift you feel is the moment he compliments you while the machine does
the wrong thing. The fix is one thermometer both read from. One read, two consumers.

## Recon findings (load-bearing, grounded in v1.14.0-beta.7)

- investment_level is real: computed at lib/core/navigation/projections.cjs:176-193,
  consumed by the ranker formula at lib/workflow/f-selector-ranker.cjs:47-52, gates
  content density at f-selector-ranker.cjs:118-141 (<0.4 teaching / 0.4-0.7 stitched /
  >=0.7 terse).
- posture is real and frozen: POSTURE_IDS=[push_forward,hold,pull_back] at
  lib/core/sensors/sensor-types.cjs:54-58 (PATH: the file is under sensors/, not
  lib/core/ as the bundle states). The 6 reaches are likewise frozen at :43-50 (no 7th).
- the dial curve + jumps exist: lib/mcp/larry-server-instructions.md:19-34. Thresholds
  (floor/ceiling/band) must live in f-selector-ranker.cjs (47-52), NOT in any prompt.
- SEAM 3 insertion point is grounded: inside resolveFireSkill() at navigation-engine.cjs,
  AFTER the sensor reach resolves (line 466) and BEFORE the Brain-verb path (line 468).
- the FORCED-MATERIAL guardrail is already hard: isIrreversibleStep() at
  chain-executor.cjs:147-173 (IRREVERSIBLE_HINTS = email,deploy,publish,send,release,
  external-write), checked FIRST at the gate (chain-executor.cjs:243-245).
- the calibration log is a SIBLING of existing memory events (f_selector_decision,
  f_selector_miss at memory-events.cjs:124,130), written through the Phase 109 chokepoint
  (navigation.cjs:100 -> memory-events.cjs:502). LOCAL room.db only; Part 8 clean.
- persona PART 6 corrections (RE-DERIVED 2026-06-24 after recon falsified the bundle's two
  gaps; see 177-RESEARCH.md sec 0): role_blend SCHEMA + 5 READ sites VERIFIED. The bundle's
  GAP 1 ("no role_blend write at room birth") is STALE - birthRoom() exists at
  room-birth.cjs:319 and writes role_blend at :426-430 (Phase 155). The bundle's GAP 2
  ("room-blueprints.json absent") is STALE - data/room-blueprints.json exists (8 families,
  Phase 155-05). The real gap is UPSTREAM: nothing computes a WEIGHTED blend;
  shallow-doc-parser emits only a canonical_role scalar (4 of 7 roles).

## Summary

The engine owns the composed decision; the model emits observations only. Same-turn
two-pass ordering (observation -> compose -> prose). A LOCAL calibration_observations
table logs every read, including discarded sub-floor cues. A four-arrow register HUD lets
the navigator grab the dial/posture wheel at the same pre-compose latency as typed escape
phrases. A per-turn De Stijl badge is painted at composition so it cannot lie. The ignite
persona prior seeds the dial default deterministically before turn 1. Everything semantic
waits behind BCH-CAL, which is allowed to FAIL.

## Requirements

Full acceptance criteria in 177-SPEC.md. Requirement IDs BCH-01 .. BCH-18 (the BCH-
governance prefix is coined for this phase). Seam IDs BCH-S1..S7 plus BCH-REG, BCH-LOG,
BCH-BADGE, BCH-PERSONA, BCH-PERSONA-WRITE, BCH-CAL map onto the waves below.

## Implementation Wave 1 - Deterministic seams (ship now, no model cues, low risk)

- BCH-S1   unify dial with investment_level (f-selector-ranker.cjs:47-52, 118-141). The
  honest first commit - everything reads this one number.
- BCH-S5   turn-stage reach-eligibility: suppress brain_consult / deep_research in turns
  1-2, unlock at turn 5. Deterministic.
- BCH-S4a  saturation by turn-count / node-delta near insight-sensors.cjs. "Turn 8+, no
  new nodes" is pure engine math.
- BCH-REG  the four-arrow register HUD + synchronous CONTROL path (Part 4, BCH-16).
- BCH-PERSONA  the ignite persona prior (Part 6): read role_blend if present, degrade to
  the canonical_role scalar, else cold-start neutral. Deterministic read, not a model cue.
- BCH-PERSONA-WRITE  RE-SCOPED (the producer already exists at room-birth.cjs:426; GAP 1
  was stale): compute a single-axis weighted blend { canonical_role: 1.0 } from the
  dual-path/shallow-doc scalar (mirror persona-override.cjs:280-281) and thread it to
  birthRoom's opts.roleBlend. NOT a net-new writeUserMdAtomic producer.

## Implementation Wave 2 - Shadow logging live (model emits, nothing fires)

- BCH-LOG    model emits the observation block; engine writes every emission to
  calibration_observations as SHADOW (logged, not wired). No user-visible change.
- BCH-BADGE  De Stijl per-turn color register (Part 5), deterministic on composed posture.
- BCH-REG-AUDIT  the keypress AUDIT write (manual_override @1.0), post-pipeline.

## Implementation Wave 3 - Calibration (the gate that can FAIL)

- BCH-CAL  run Part 3. Step 0 DISCRIMINATION GATE first. If the reliability curve is flat
  (BCH-15: AUC < AUC_MIN 0.65 OR slope < SLOPE_MIN 0.15), the gate FAILS - no floor/
  ceiling pinned, no mapping fit, the emit step is reworked, the dataset re-gathered, and
  Wave 4 stays LOCKED. CHANGE-CONTROL: AUC_MIN/SLOPE_MIN are set by judgment, NEVER swept
  to unblock a wave.

## Implementation Wave 4 - Calibrated cue seams (post-calibration ONLY)

- BCH-S3   behavioral channel into decide() between nav-engine.cjs:466 and :468; null
  defers to Brain (legacy path byte-identical). Fires SIGNAL-tier.
- BCH-S6   "insight did not land" fires pull_back.
- BCH-S4b  wire "circling 3+ turns" now its cue is calibrated.
- BCH-S7   dynamic persona correction (model proposes corrections to the ignite prior).

## Implementation Wave 5 - High blast radius (ship late, hard guardrail)

- BCH-S2   escape hatch as gate override (chain-executor.cjs:239-261). Suppresses the
  Decision Gate ONLY for autonomous_safe, NEVER for FORCED-MATERIAL. Routes THROUGH the
  isIrreversibleStep() gate, never around it.

## Phase Gate

- Run: `bash tests/run-all-177.sh`
- Scaffold state (this commit): the 12 BCH suite stubs are RED by design (TDD scaffold);
  the carried frozen-set drift fences (6 reaches, 3 postures) stay GREEN as regression.
- Done state: all 12 BCH suites GREEN, exit 0; the legacy Brain-verb path and the existing
  JTBD color accent remain byte-identical when the channel returns null / the badge falls
  back. Waves 4-5 do not merge until BCH-CAL PASSES (not merely runs).
- Blockers: Wave 1 none; Waves 4-5 block on Wave 3 (BCH-CAL must PASS).
