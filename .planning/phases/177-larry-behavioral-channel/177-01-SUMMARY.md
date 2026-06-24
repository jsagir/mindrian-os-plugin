---
phase: 177-larry-behavioral-channel
plan: 01
subsystem: navigation / workflow ranker
tags: [behavioral-channel, investment-level, ignite-persona, thresholds, BCH-S1, BCH-05, BCH-06, BCH-17]
requires:
  - lib/core/navigation/projections.cjs (computeInvestmentLevel, Phase 125)
  - lib/workflow/f-selector-ranker.cjs (rankForSelector consumer, Phase 125)
  - lib/core/navigation-engine.cjs (RECOMMENDED_CONFIDENCE_FLOOR, Phase 91)
  - lib/core/persona-override.cjs (ROLE_BLEND_KEYS frozen 7-role set)
provides:
  - "investment_level extended with a runtime turn_count term (THE single canonical runtime number, D-177-Q5)"
  - "BEHAVIORAL_CHANNEL_FLOOR / CEILING / MARGIN engine-owned consts (BCH-05/06)"
  - "igniteDialSeed + hasIgnitePrior deterministic ignite-persona dial seed (BCH-17)"
  - "navigation-engine.RECOMMENDED_CONFIDENCE_FLOOR now exported (computed-not-hand-typed ceiling)"
affects:
  - lib/workflow/f-selector-ranker.cjs (rankForSelector now biases investment_level from the persona prior)
tech-stack:
  added: []
  patterns:
    - "computed-not-hand-typed threshold: ceiling derived from the live Brain floor const (+0.15)"
    - "bias-only-when-prior-present: a personaless room keeps its pure runtime gradient (byte-stable)"
    - "frozen-set-ordered tie-break for determinism (ROLE_BLEND_KEYS)"
key-files:
  created:
    - tests/test-bch-17-ignite-persona.cjs (replaced the scaffold stub with 20 real assertions)
  modified:
    - lib/core/navigation/projections.cjs
    - lib/workflow/f-selector-ranker.cjs
    - lib/core/navigation-engine.cjs
decisions:
  - "D-177-Q5 honored: investment_level (engine-owned) is the single canonical runtime number; extended with a NEW turn_count term + reserved jump conditions on top of framework_invocations."
  - "Ceiling COMPUTED from RECOMMENDED_CONFIDENCE_FLOOR + 0.15 (== 0.85); the const is now exported from navigation-engine.cjs so the >= 15-point invariant is provable, not a duplicated literal (addresses plan-checker WARNING 1, option a)."
  - "The ignite seed biases investment_level ONLY when an actual persona prior is present; the cold-start neutral seed is never silently injected into a personaless room (keeps pre-177 ranker behavior byte-stable)."
metrics:
  duration: "~1 session"
  completed: 2026-06-24
  tasks: 3
  files: 4
---

# Phase 177 Plan 01: The Behavioral Channel substrate Summary

Established THE single canonical runtime investment number (investment_level extended with a turn_count term), pinned the behavioral-channel floor/ceiling/band thresholds in the engine-side ranker (never a prompt), and seeded the dial default deterministically from the ignite persona prior -- turning test-bch-17-ignite-persona GREEN.

## What shipped

### Task 1 -- runtime turn_count term in computeInvestmentLevel (BCH-S1) -- commit 1bbe4d5b
`lib/core/navigation/projections.cjs::computeInvestmentLevel` now folds a clamped `turn_count` term (`turn_count / 20`) ADDITIVELY on top of the existing `framework_invocations / 10` term, result clamped to [0,1], function still pure. Absent / non-number / negative `turn_count` contributes 0, so every framework_invocations-only caller stays byte-stable (the 20-test navigation-projections suite and the 34-test f-selector-ranker suite are unchanged). The four deterministic jump-condition fields (`investment_jump_escape_hatch / _saturation / _pushback / _evidence`) are read-if-present and default no-op, documented as reserved for later waves so the canonical number has one home.

### Task 2 -- behavioral-channel thresholds in the ranker (BCH-05, BCH-06) -- commit 277e3935
`lib/workflow/f-selector-ranker.cjs` gained `BEHAVIORAL_CHANNEL_FLOOR` (0.50), `BEHAVIORAL_CHANNEL_MARGIN` (0.15), and `BEHAVIORAL_CHANNEL_CEILING` (== 0.85), all exported. The ceiling is COMPUTED from the live Brain floor: `lib/core/navigation-engine.cjs` now exports `RECOMMENDED_CONFIDENCE_FLOOR` (0.70), the ranker requires it, and `CEILING = RECOMMENDED_CONFIDENCE_FLOOR + MARGIN`. The >= 15-point-above-Brain-floor invariant therefore holds by construction and tracks the Brain floor if it ever moves. The adversarial prompt-leak grep returns zero threshold literals in `skills/` or `larry-server-instructions.md`.

### Task 3 -- ignite-persona dial seed + green test (BCH-17, BCH-PERSONA) -- commit dc9f9df2
`igniteDialSeed(roomState)` is a pure deterministic read: `role_blend` top role -> `canonical_role` scalar -> cold-start neutral, never fabricating a blend. student -> ASK-leaning 0.20 (< 0.4 teaching-density branch); founder/investor -> TELL-leaning 0.80 (>= 0.7 terse branch); other known roles -> neutral 0.55. Ties break by the frozen `ROLE_BLEND_KEYS` order. The seed biases `investment_level` via `max(computedLevel, seed)` ONLY when `hasIgnitePrior(roomState)` is true; a personaless room keeps its pure runtime gradient. The scaffold stub at `tests/test-bch-17-ignite-persona.cjs` was replaced with 20 real assertions (student ASK / founder + investor twin TELL / weighted-blend top role / degrade-to-scalar / cold-start neutral / never-fabricate / purity / the ranker bias path / personaless byte-stability).

## Verification

- Task 1 byte-stability + turn_count probe: PASS (`a.level===0.5`, `b.level` rises and clamps, `c.level===0`).
- Task 2 thresholds probe + adversarial prompt-leak grep: PASS (ceiling == 0.85, >= 15pts above 0.70, floor == 0.50; zero prompt leak).
- Task 3 `node tests/test-bch-17-ignite-persona.cjs`: PASS (exit 0, 20/20 assertions).
- Regression fences: navigation-projections.test.cjs 20/20, f-selector-ranker.test.cjs 34/34, test-150-decision-projection all-pass, run-all-144.sh 5/5.
- Phase gate `bash tests/run-all-177.sh`: 4 pass / 10 fail (was 3 pass / 11 fail). test-bch-17 flipped GREEN; the frozen-set drift fences (reach-ids 6, posture-ids 3) and bch-14 stay GREEN. The other 10 BCH suites remain RED by design -- they belong to 177-02/03/04 and later waves.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Personaless-room regression from the cold-start neutral seed**
- **Found during:** Task 3.
- **Issue:** Threading `investment_level = max(computedLevel, igniteDialSeed(...))` unconditionally injected the cold-start NEUTRAL seed (0.55) into rooms with no persona prior, breaking 4 of the 34 f-selector-ranker regression tests (they assert cold-start investment_level 0).
- **Fix:** Added a `hasIgnitePrior(roomState)` predicate and bias `investment_level` ONLY when an actual persona prior (a usable role_blend or recognized canonical_role) is present. `igniteDialSeed` still returns the neutral value for the cold case (the BCH-17 test contract), but the ranker no longer applies it to a personaless room. Added a dedicated test assertion (personaless cold-start keeps investment_level 0).
- **Files modified:** lib/workflow/f-selector-ranker.cjs, tests/test-bch-17-ignite-persona.cjs.
- **Commit:** dc9f9df2.

### Plan-checker warning addressed

WARNING 1 (Task 2 ceiling computed-not-hand-typed): resolved via option (a) -- `RECOMMENDED_CONFIDENCE_FLOOR` is now exported from `navigation-engine.cjs` and required by the ranker, so the ceiling is genuinely computed from the live Brain floor const. The verify command asserts `CEILING - 0.70 >= 0.15` against the exported live const, not a hardcoded number.

## Canon / boundary notes

- Part 8: turn_count, investment_level, role_blend, canonical_role stay LOCAL. No Brain wire opened. bch-14 (Part 8 zero-egress tripwire) stays GREEN.
- Part 11: realizes one-governed-path -- the engine composes investment_level; the model only observes (no dial/investment field added to any model-facing schema).
- Frozen sets untouched: no 7th reach, no 4th posture, MAX_K=3 / DIAL_REACH_K=6 / the 0.70/0.15 gate unchanged. Both drift fences GREEN.
- No em-dashes, no emoji. Atomic per-task commits, prefix `177-01:`.

## Known Stubs

None introduced by this plan. The 10 still-RED BCH suites in run-all-177.sh are scaffold stubs owned by other plans (177-02 lib/hmi/*, 177-03 shallow-doc/graph-self-heal, 177-04 insight-sensors, plus the Wave 2-5 logging/calibration/semantic seams) and are out of scope here.

## Self-Check: PASSED
- FOUND: lib/core/navigation/projections.cjs
- FOUND: lib/workflow/f-selector-ranker.cjs
- FOUND: lib/core/navigation-engine.cjs
- FOUND: tests/test-bch-17-ignite-persona.cjs
- FOUND commit: 1bbe4d5b
- FOUND commit: 277e3935
- FOUND commit: dc9f9df2
