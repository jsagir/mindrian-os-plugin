#!/usr/bin/env node
'use strict';
// Phase 177 - The Behavioral Channel
// BCH-15 (BCH-CAL): the calibration gate that CAN FAIL.
//
// The headline is the FAIL path: a synthetic FLAT reliability dataset (per
// cue_type ROC-AUC ~0.5, reliability slope ~0) makes the Step-0 DISCRIMINATION
// GATE fail BEFORE any curve-fit -- no floor/ceiling pinned, no isotonic/Platt
// fit attempted, the Wave-4 arming flag stays LOCKED, and a rework signal is
// emitted. A complementary DISCRIMINATING dataset proves the gate also PASSES, so
// it is not a gate that always fails. The change-control invariant proves the
// judgment-set thresholds AUC_MIN (0.65) / SLOPE_MIN (0.15) are constants that
// never move -- the gate cannot lower its own bar to pass weak data.
//
// Pure node asserts, no deps. Drives the real BCH-CAL harness on in-test synthetic
// observation arrays (no db, no IO), so the FAIL path is provable on synthetic data.

const path = require('path');

const ROOT = path.resolve(__dirname, '..');

let failed = 0;
function ok(cond, msg) {
  console.log((cond ? '  ok   - ' : '  FAIL - ') + msg);
  if (!cond) failed++;
}

console.log('--- test-bch-15-calibration-fail ---');

const gate = require(path.join(ROOT, 'lib/core/navigation/calibration-gate.cjs'));
const {
  runCalibrationGate,
  AUC_MIN,
  SLOPE_MIN,
  BEHAVIORAL_CHANNEL_ARMED,
} = gate;

// The engine-owned floor/ceiling a PASS verdict reports (read from the ranker, not
// re-typed) -- the test compares the verdict against THESE, never against a literal.
const {
  BEHAVIORAL_CHANNEL_FLOOR,
  BEHAVIORAL_CHANNEL_CEILING,
} = require(path.join(ROOT, 'lib/workflow/f-selector-ranker.cjs'));

// --- synthetic fixtures (plain in-test arrays; no db, no IO) -----------------

// FLAT (the headline FAIL): raw_confidence is decorrelated from ground_truth_label
// so ROC-AUC computes ~0.5 and the reliability slope ~0. Labels alternate
// independently of confidence; 200 rows for a stable estimate. This is the
// "AUC ~0.5 flat reliability dataset" the SPEC names.
function flatDataset() {
  const rows = [];
  for (let i = 0; i < 200; i++) {
    rows.push({
      raw_confidence: (i % 10) / 10, // 0.0..0.9 cycling, spread across bins
      ground_truth_label: i % 2,     // alternates, independent of confidence
      cue_type: 'reframe_cue',
    });
  }
  return { reframe_cue: rows };
}

// DISCRIMINATING (the complement PASS): high-confidence rows are predominantly
// label 1 and low-confidence rows predominantly 0, and observed frequency tracks
// predicted confidence, so AUC is clearly above 0.65 and slope clearly above 0.15.
function discriminatingDataset() {
  const rows = [];
  for (let i = 0; i < 200; i++) {
    const c = (i % 20) / 20; // 0.00..0.95 spread across all bins
    // observed frequency tracks predicted confidence: mostly label 1 when c is
    // high, mostly label 0 when c is low (a small mismatch keeps it realistic).
    const label = c > 0.5 ? (i % 5 !== 0 ? 1 : 0) : (i % 5 === 0 ? 1 : 0);
    rows.push({ raw_confidence: c, ground_truth_label: label, cue_type: 'reframe_cue' });
  }
  return { reframe_cue: rows };
}

// --- FAIL path (the headline) ------------------------------------------------

const flatVerdict = runCalibrationGate(flatDataset());
ok(flatVerdict.pass === false,
  'test-bch-15-calibration-fail: FLAT dataset (AUC ~0.5) makes BCH-CAL FAIL (pass:false)');
ok(flatVerdict.floor === null && flatVerdict.ceiling === null,
  'test-bch-15-calibration-fail: FAIL pins NO floor/ceiling (both null)');
ok(flatVerdict.fit === null,
  'test-bch-15-calibration-fail: FAIL attempts NO isotonic/Platt fit (fit null) -- Step-0 runs before any fit');
ok(flatVerdict.armed_allowed === false,
  'test-bch-15-calibration-fail: FAIL keeps the Wave-4 arming flag LOCKED (armed_allowed:false)');
ok(flatVerdict.rework_signal && flatVerdict.rework_signal.reason === 'discrimination_gate_failed',
  'test-bch-15-calibration-fail: FAIL emits a rework_signal with reason discrimination_gate_failed');
ok(BEHAVIORAL_CHANNEL_ARMED === false,
  'test-bch-15-calibration-fail: the module-level BEHAVIORAL_CHANNEL_ARMED is still false (the gate never armed it)');

// --- PASS complement (proves the gate works in both directions) --------------

const discVerdict = runCalibrationGate(discriminatingDataset());
ok(discVerdict.pass === true,
  'DISCRIMINATING dataset makes BCH-CAL PASS (pass:true) -- not a gate that always fails');
ok(discVerdict.armed_allowed === true,
  'PASS allows the Wave-4 flag to arm (armed_allowed:true)');
ok(discVerdict.floor === BEHAVIORAL_CHANNEL_FLOOR && discVerdict.ceiling === BEHAVIORAL_CHANNEL_CEILING,
  'PASS reports floor/ceiling === the engine-owned BEHAVIORAL_CHANNEL_FLOOR / _CEILING');

// --- change-control invariant (D-9 / BCH-15) --------------------------------

ok(AUC_MIN === 0.65,
  'change-control: AUC_MIN is the frozen literal 0.65');
ok(SLOPE_MIN === 0.15,
  'change-control: SLOPE_MIN is the frozen literal 0.15');

// The constants do NOT move when the harness runs against a sub-threshold (FLAT)
// dataset -- capture before, run, assert byte-identical after. Proves the gate does
// not lower its own bar to pass a weak dataset.
const aucBefore = AUC_MIN;
const slopeBefore = SLOPE_MIN;
runCalibrationGate(flatDataset()); // a dataset whose empirical AUC is below 0.65
ok(gate.AUC_MIN === aucBefore && gate.AUC_MIN === 0.65,
  'change-control: AUC_MIN is byte-identical after a sub-threshold run (never swept down to unblock)');
ok(gate.SLOPE_MIN === slopeBefore && gate.SLOPE_MIN === 0.15,
  'change-control: SLOPE_MIN is byte-identical after a sub-threshold run (never swept down to unblock)');

console.log((failed ? 'FAIL' : 'PASS') + ' test-bch-15-calibration-fail (' + (11 - failed) + '/11)');
process.exit(failed ? 1 : 0);
