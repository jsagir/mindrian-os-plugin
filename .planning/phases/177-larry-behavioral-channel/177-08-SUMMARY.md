---
phase: 177-larry-behavioral-channel
plan: 08
subsystem: behavioral-channel / calibration-gate
tags: [bch-cal, bch-15, calibration, discrimination-gate, roc-auc, reliability-slope, change-control, shadow, part-8]
requires:
  - "177-05 (calibration_observations table + logCalibrationObservation chokepoint)"
  - "177-01 (engine-owned BEHAVIORAL_CHANNEL_FLOOR/CEILING in f-selector-ranker.cjs)"
provides:
  - "lib/core/navigation/calibration-gate.cjs -- the BCH-CAL harness (Step-0 discrimination gate + runCalibrationGate entry point + rocAuc/reliabilitySlope pure helpers + AUC_MIN/SLOPE_MIN judgment-set constants + default-LOCKED BEHAVIORAL_CHANNEL_ARMED flag)"
  - "test-bch-15-calibration-fail GREEN (FAIL-on-flat headline + PASS-on-discriminating complement + change-control invariant)"
affects:
  - "Wave 4-5 arming: BEHAVIORAL_CHANNEL_ARMED stays LOCKED until the gate honestly PASSES on real data"
tech-stack:
  added: []
  patterns:
    - "pure-function discrimination gate (no IO on the hot path); reads a passed-in observation array, not the db, so the FAIL path is provable on synthetic data"
    - "judgment-set thresholds AUC_MIN/SLOPE_MIN are module constants, never swept from the dataset (change-control invariant, test-asserted)"
    - "Wave-4 arming flag defaults LOCKED; only a PASS verdict RETURNS armed_allowed -- a gate that cannot fail is not a gate"
    - "ROC-AUC via Mann-Whitney U rank-sum (tie-averaged ranks); reliability-diagram slope via least-squares of observed-frequency vs mean-predicted across confidence bins"
    - "engine-owned FLOOR/CEILING read via the calibration-log.cjs require idiom (never re-typed)"
key-files:
  created:
    - "lib/core/navigation/calibration-gate.cjs"
  modified:
    - "tests/test-bch-15-calibration-fail.cjs (RED scaffold stub -> real asserts)"
decisions:
  - "BCH-CAL ships as a SYNTHETIC-PROVEN HARNESS; the live isotonic/Platt fit + real floor/ceiling pinning are DEFERRED (fit.method:'deferred') until ground-truth-labeled shadow data exists (DI-177-CALIB-LABEL)"
  - "AUC_MIN (0.65) / SLOPE_MIN (0.15) are judgment-set CONSTANTS, never derived from data, never lowered to unblock a wave"
  - "the Step-0 discrimination gate runs BEFORE any curve-fit; on FAIL no fit is attempted and no thresholds are pinned"
metrics:
  duration: "~15 min"
  completed: 2026-06-24
  tasks: 2
  commits: 2
  files: 2
---

# Phase 177 Plan 08: BCH-CAL Calibration Gate Summary

The calibration gate that CAN FAIL, shipped as a synthetic-proven harness whose headline is the FAIL-on-flat path.

## What was built

**`lib/core/navigation/calibration-gate.cjs`** -- the BCH-CAL harness, all pure functions so the FAIL path is provable on synthetic data with no db:

- `runCalibrationGate(observationsByCueType)` -- the entry point. Runs the Step-0 discrimination gate FIRST, before any curve-fit. On FAIL returns `{ pass:false, stage:'discrimination', floor:null, ceiling:null, fit:null, armed_allowed:false, rework_signal:{ reason:'discrimination_gate_failed', ... } }` -- no isotonic/Platt fit attempted, no threshold pinned. On PASS returns `{ pass:true, stage:'calibrated', floor:BEHAVIORAL_CHANNEL_FLOOR, ceiling:BEHAVIORAL_CHANNEL_CEILING, fit:{ method:'deferred', ... }, armed_allowed:true, rework_signal:null }`.
- `runDiscriminationGate(observationsByCueType)` -- per cue_type computes `auc = rocAuc(rows)` and `slope = reliabilitySlope(rows)`; a cue_type passes iff `auc >= AUC_MIN AND slope >= SLOPE_MIN`; overall pass iff every cue_type passes (an empty map fails -- never fakes a pass on no data).
- `rocAuc(observations)` -- ROC-AUC via the Mann-Whitney U rank-sum identity with tie-averaged ranks; returns 0.5 (chance) when there are zero positives or zero negatives, so a flat/degenerate dataset reads as chance and FAILS.
- `reliabilitySlope(observations, bins)` -- least-squares slope of observed positive frequency (y) on mean predicted confidence (x) across non-empty bins (default 10); a flat reliability curve yields slope ~0 and FAILS SLOPE_MIN.
- `AUC_MIN = 0.65`, `SLOPE_MIN = 0.15` -- judgment-set module constants, never derived from any input array; the top-of-file change-control comment names the D-9 / BCH-15 rule that they may never be lowered to unblock a wave.
- `BEHAVIORAL_CHANNEL_ARMED = false` -- the Wave-4 arming flag, default LOCKED; the harness never mutates it (PASS only RETURNS `armed_allowed`).
- engine-owned `BEHAVIORAL_CHANNEL_FLOOR` / `BEHAVIORAL_CHANNEL_CEILING` are read from `lib/workflow/f-selector-ranker.cjs` using the exact require idiom `calibration-log.cjs` uses (never re-typed; resolves to 0.50 / 0.85, verified).

**`tests/test-bch-15-calibration-fail.cjs`** -- the RED scaffold stub replaced with 13 real asserts (mirroring the test-bch-04 `ok()`/`failed` idiom): the FAIL-on-flat headline (pass:false + floor/ceiling null + fit null + armed_allowed false + rework_signal `discrimination_gate_failed` + module flag still false), the PASS-on-discriminating complement (pass:true + armed_allowed:true + floor/ceiling === engine values), and the change-control invariant (AUC_MIN===0.65 / SLOPE_MIN===0.15 byte-identical across a sub-threshold run).

## Verification

- `node tests/test-bch-15-calibration-fail.cjs` exits 0 (13/13 asserts green).
- `bash tests/run-all-177.sh`: **12 pass / 4 fail -> 13 pass / 3 fail**. bch-15 flipped GREEN; the remaining 3 (bch-07 / bch-08 / bch-09) are Wave-4/5 suites, out of scope for this plan.
- Carried fences GREEN: test-reach-ids-drift (frozen 6), test-posture-ids-drift (frozen 3), test-bch-04-shadow-log, test-bch-14-part8-egress.
- Part 8 egress scan over calibration-gate.cjs: zero code egress (the only "Brain" token is the "opens NO Brain wire" doctrine comment; no require/fetch/http/buildBrainPacket).
- Prompt-cleanliness scan: no AUC_MIN / SLOPE_MIN threshold name in skills/ or agents/.

## Deviations from Plan

None - plan executed exactly as written. (TDD ordering: the plan authored Task 1 as the harness and Task 2 as the test; both shipped in plan order, each with its own atomic commit.)

## Deferred (honest, not a stub)

- The LIVE calibration -- pinning the real behavioral-channel floor/ceiling from accumulated shadow usage via a real isotonic/Platt fit -- is DEFERRED (`fit.method:'deferred'`) until real ground-truth-labeled shadow data exists. The shipped `calibration_observations` table (177-05) carries no `ground_truth_label` column today (DI-177-CALIB-LABEL), so the harness operates on explicit synthetic observation arrays. No live pass is fabricated on empty/synthetic data; the live ground-truth-labeled DB read path is the deferred follow-on. This is documented behavior, not a hidden stub: the gate must be ALLOWED to fail, never faked to pass.

## Commits

- 8e98f69f: 177-08 build the BCH-CAL harness (calibration-gate.cjs)
- 7be33e56: 177-08 turn test-bch-15 GREEN (FAIL-on-flat + PASS-on-discriminating + change-control)

## Self-Check: PASSED

- lib/core/navigation/calibration-gate.cjs: FOUND
- tests/test-bch-15-calibration-fail.cjs: FOUND (modified)
- 8e98f69f: FOUND
- 7be33e56: FOUND
