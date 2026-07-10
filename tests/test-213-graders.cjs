#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 213-01 -- the eval-side graders test: Arrival grader + status-quo judge,
 * verdict-by-code (the 212 D2 idiom, mirrored not imported).
 *
 * These modules compute the verdict enum BY CODE from boolean/scalar item inputs.
 * Any LLM pass (the session judge that produces those booleans from a transcript)
 * happens OUTSIDE these modules; its per-item outputs are the inputs here (T-213-01:
 * judged booleans/scalars cross, raw transcript text does NOT enter these modules).
 *
 * The 211 gold set (evals/eureka/) is the calibration baseline.
 *
 * Pure CJS, node built-ins only, zero network. Loads both modules standalone.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const ARRIVAL_PATH = path.join(REPO, 'lab', 'eureka-graders', 'arrival-grader.cjs');
const STATUS_QUO_PATH = path.join(REPO, 'lab', 'eureka-graders', 'status-quo-judge.cjs');

const { ARRIVAL_VERDICTS, gradeArrival } = require(ARRIVAL_PATH);
const { STATUS_QUO_LABELS, judgeStatusQuo } = require(STATUS_QUO_PATH);

// ---------------------------------------------------------------------------
// Tiny test harness (house test-21x-*.cjs shape).
// ---------------------------------------------------------------------------

let PASS = 0;
let FAIL = 0;

function ok(label, fn) {
  try {
    fn();
    console.log('ok   ' + label);
    PASS += 1;
  } catch (e) {
    console.log('FAIL ' + label + ' -- ' + (e && e.message ? e.message : e));
    FAIL += 1;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

function almost(a, b, eps) {
  return Math.abs(a - b) <= (eps == null ? 1e-3 : eps);
}

// ---------------------------------------------------------------------------
// Arrival grader (SEED-050 Judge 1).
// ---------------------------------------------------------------------------

// Test 1: all sub-claims reached, no lure -> Full, credit 1.
ok('Test 1: all sub-claims reached -> Full, credit 1', function () {
  const r = gradeArrival({ subClaimsReached: 3, subClaimsTotal: 3, luredDistractor: false });
  assert(r.verdict === 'Full', 'expected Full, got ' + r.verdict);
  assert(r.credit === 1, 'expected credit 1, got ' + r.credit);
});

// Test 2: partial credit = reached / total.
ok('Test 2: partial credit = sub-claims reached / total', function () {
  const r = gradeArrival({ subClaimsReached: 1, subClaimsTotal: 3, luredDistractor: false });
  assert(r.verdict === 'Partial', 'expected Partial, got ' + r.verdict);
  assert(almost(r.credit, 1 / 3), 'expected credit ~0.333, got ' + r.credit);
});

// Test 3: falling for a seeded distractor dominates -> Lured, regardless of sub-claims.
ok('Test 3: luredDistractor -> Lured regardless of sub-claims', function () {
  const r = gradeArrival({ subClaimsReached: 3, subClaimsTotal: 3, luredDistractor: true });
  assert(r.verdict === 'Lured', 'expected Lured (lure dominates), got ' + r.verdict);
});

// Test 4: nothing reached, no lure -> Missed, credit 0.
ok('Test 4: zero reached, no lure -> Missed, credit 0', function () {
  const r = gradeArrival({ subClaimsReached: 0, subClaimsTotal: 3, luredDistractor: false });
  assert(r.verdict === 'Missed', 'expected Missed, got ' + r.verdict);
  assert(r.credit === 0, 'expected credit 0, got ' + r.credit);
});

// ---------------------------------------------------------------------------
// Status-quo judge (SEED-050 Judge 3, mode-conditioned).
// ---------------------------------------------------------------------------

// Test 5: intent signalled AND status quo rejected AND the turn re-defends it -> stuck.
ok('Test 5: all three conditions -> status_quo_stuck', function () {
  const label = judgeStatusQuo({
    innovationIntentSignalled: true,
    statusQuoRejected: true,
    turnRelitigatesStatusQuo: true,
  });
  assert(label === 'status_quo_stuck', 'expected status_quo_stuck, got ' + label);
});

// Test 6: no re-defence -> redirect_ok; no intent -> redirect_ok (mode-conditioned).
ok('Test 6: no re-defence or no intent -> redirect_ok', function () {
  const noRelitigate = judgeStatusQuo({
    innovationIntentSignalled: true,
    statusQuoRejected: true,
    turnRelitigatesStatusQuo: false,
  });
  assert(noRelitigate === 'redirect_ok', 'no re-defence -> redirect_ok, got ' + noRelitigate);
  const noIntent = judgeStatusQuo({
    innovationIntentSignalled: false,
    statusQuoRejected: true,
    turnRelitigatesStatusQuo: true,
  });
  assert(noIntent === 'redirect_ok', 'no intent -> redirect_ok, got ' + noIntent);
});

// Test 7: closed enums are exactly the frozen sets.
ok('Test 7: ARRIVAL_VERDICTS and STATUS_QUO_LABELS are frozen closed enums', function () {
  assert(JSON.stringify(ARRIVAL_VERDICTS) === JSON.stringify(['Full', 'Partial', 'Missed', 'Lured']),
    'ARRIVAL_VERDICTS mismatch: ' + JSON.stringify(ARRIVAL_VERDICTS));
  assert(JSON.stringify(STATUS_QUO_LABELS) === JSON.stringify(['status_quo_stuck', 'redirect_ok']),
    'STATUS_QUO_LABELS mismatch: ' + JSON.stringify(STATUS_QUO_LABELS));
  assert(Object.isFrozen(ARRIVAL_VERDICTS), 'ARRIVAL_VERDICTS must be frozen');
  assert(Object.isFrozen(STATUS_QUO_LABELS), 'STATUS_QUO_LABELS must be frozen');
});

// Both modules must be LOCAL: zero network / MCP import strings.
ok('Bonus: both grader modules are LOCAL (zero network / MCP)', function () {
  const srcA = fs.readFileSync(ARRIVAL_PATH, 'utf8');
  const srcB = fs.readFileSync(STATUS_QUO_PATH, 'utf8');
  const scan = function (src, name) {
    assert(!/modelcontextprotocol/.test(src), name + ': no MCP SDK import');
    assert(!/server\.tool/.test(src), name + ': no server.tool');
    assert(!/fetch\s*\(/.test(src), name + ': no fetch(');
    assert(!/https?:\/\//.test(src), name + ': no http(s) URL');
  };
  scan(srcA, 'arrival-grader');
  scan(srcB, 'status-quo-judge');
});

console.log('\nPhase 213 graders: PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
