#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 213-01 -- regression fixture for the deterministic COMPRESSION meter.
 *
 * This is the CRITIC half's local arithmetic (SEED-050 THE METRIC). It reproduces
 * the hand-scoring rubric arithmetic from evals/eureka/README.md:96-108 as a code
 * fixture: Score = CompressionDelta x GuardGate x StatusQuoGate, a Lured arrival
 * scores NEGATIVE (not zero), and the nichefoods-null shape (arrival Full,
 * CompressionDelta 0) scores ~0 (arrival WITHOUT compression = null result).
 *
 * The 211 gold set (evals/eureka/) is the calibration baseline. The numbers here
 * are FIXTURE arithmetic, never gold labels (T-213-02: the simulated
 * 211-manual-baseline table is arithmetic input only, never trusted as truth).
 *
 * Pure CJS, node built-ins only, zero network. Never opens a room database.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const METER_PATH = path.join(REPO, 'lib', 'core', 'eureka', 'compression-meter.cjs');

const meter = require(METER_PATH);
const {
  computeCompressionDelta,
  guardGate,
  statusQuoGate,
  compressionScore,
  LURED_PENALTY,
  MIN_LURED_MAGNITUDE,
  GUARD_ZERO_LABEL,
  STATUS_QUO_ZERO_LABEL,
} = meter;

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
  return Math.abs(a - b) <= (eps == null ? 1e-9 : eps);
}

// ---------------------------------------------------------------------------
// Behaviors (plan 213-01 Task 1).
// ---------------------------------------------------------------------------

// Test 1: the clean composite = CompressionDelta x GuardGate x StatusQuoGate.
ok('Test 1: Full arrival, open gates -> score === compressionDelta', function () {
  const score = compressionScore({
    compressionDelta: 0.85,
    guardEvents: [],
    statusQuoEvents: [],
    arrival: 'Full',
  });
  assert(score === 0.85, 'expected 0.85, got ' + score);
});

// Test 2: any pseudoscience guard event zeroes GuardGate -> score 0.
ok('Test 2: a pseudoscience guard event zeroes the score', function () {
  assert(GUARD_ZERO_LABEL === 'pseudoscience', 'GUARD_ZERO_LABEL must be pseudoscience');
  const score = compressionScore({
    compressionDelta: 0.9,
    guardEvents: ['transferable', 'pseudoscience'],
    statusQuoEvents: [],
    arrival: 'Full',
  });
  assert(score === 0, 'expected 0 (guard gate closed), got ' + score);
  assert(guardGate(['pseudoscience']) === 0, 'guardGate should be 0 on pseudoscience');
  assert(guardGate(['transferable']) === 1, 'guardGate should be 1 without pseudoscience');
});

// Test 3: any status_quo_stuck event zeroes StatusQuoGate -> score 0.
ok('Test 3: a status_quo_stuck event zeroes the score', function () {
  assert(STATUS_QUO_ZERO_LABEL === 'status_quo_stuck', 'STATUS_QUO_ZERO_LABEL must be status_quo_stuck');
  const score = compressionScore({
    compressionDelta: 0.9,
    guardEvents: [],
    statusQuoEvents: ['redirect_ok', 'status_quo_stuck'],
    arrival: 'Full',
  });
  assert(score === 0, 'expected 0 (status-quo gate closed), got ' + score);
  assert(statusQuoGate(['status_quo_stuck']) === 0, 'statusQuoGate should be 0 on stuck');
  assert(statusQuoGate(['redirect_ok']) === 1, 'statusQuoGate should be 1 without stuck');
});

// Test 4: a Lured arrival scores NEGATIVE (SEED-050: "Lured = negative, not zero"),
// strictly < 0 even when both gates are open, and even penalizing the would-be
// compression (a high-compression run that got lured is penalized MORE).
ok('Test 4: Lured arrival scores strictly negative, gates cannot rescue it', function () {
  assert(LURED_PENALTY < 0, 'LURED_PENALTY must be a negative constant');
  // High compressionDelta above the floor: penalty tracks the would-be gain.
  const hi = compressionScore({
    compressionDelta: 0.85,
    guardEvents: [],
    statusQuoEvents: [],
    arrival: 'Lured',
  });
  assert(hi === LURED_PENALTY * 0.85, 'expected LURED_PENALTY x 0.85, got ' + hi);
  assert(hi < 0, 'Lured score must be strictly negative, got ' + hi);
  // Below the floor: never a soft zero, floored at MIN_LURED_MAGNITUDE magnitude.
  const lo = compressionScore({
    compressionDelta: 0.1,
    guardEvents: [],
    statusQuoEvents: [],
    arrival: 'Lured',
  });
  assert(lo === LURED_PENALTY * MIN_LURED_MAGNITUDE, 'expected floored penalty, got ' + lo);
  assert(lo < 0, 'floored Lured score must be strictly negative, got ' + lo);
  // Even a closed guard gate does not turn a Lured run into a zero: Lured dominates.
  const withGuard = compressionScore({
    compressionDelta: 0.5,
    guardEvents: ['pseudoscience'],
    statusQuoEvents: ['status_quo_stuck'],
    arrival: 'Lured',
  });
  assert(withGuard < 0, 'Lured must stay negative even with gates closed, got ' + withGuard);
});

// Test 5: the nichefoods-null shape -> arrival Full but CompressionDelta 0 -> ~0.
// Arrival WITHOUT compression is a null result (README:44, the pivotal negative).
ok('Test 5: arrival without compression (nichefoods-null) scores ~0', function () {
  const score = compressionScore({
    compressionDelta: 0,
    guardEvents: [],
    statusQuoEvents: [],
    arrival: 'Full',
  });
  assert(score === 0, 'nichefoods-null must score 0, got ' + score);
});

// Test 6: computeCompressionDelta clamps to [0,1]; non-finite/absent -> 0; never throws.
ok('Test 6: computeCompressionDelta clamps [0,1] and is defensive', function () {
  // Collapsed months of thought into a few turns -> near 1.
  assert(almost(computeCompressionDelta(100, 5), 0.95), 'expected 0.95');
  // Arrived where the human already was (same effort) -> 0.
  assert(computeCompressionDelta(100, 100) === 0, 'same effort -> 0');
  // Took LONGER than the human -> clamped to 0, never negative.
  assert(computeCompressionDelta(100, 150) === 0, 'longer than human -> 0');
  // Zero observed turns against a real baseline -> full compression, clamped to 1.
  assert(computeCompressionDelta(100, 0) === 1, 'zero observed -> 1');
  // Defensive: non-finite / absent / non-numeric inputs -> 0, never NaN, never throw.
  assert(computeCompressionDelta(NaN, 5) === 0, 'NaN baseline -> 0');
  assert(computeCompressionDelta(100, Infinity) === 0, 'Infinity observed -> 0');
  assert(computeCompressionDelta(undefined, undefined) === 0, 'absent -> 0');
  assert(computeCompressionDelta('two years', 5) === 0, 'string baseline -> 0');
  assert(computeCompressionDelta(0, 0) === 0, 'zero baseline -> 0 (no divide)');
});

// Test 7: the module loads standalone and has zero network/MCP import strings.
ok('Test 7: meter is LOCAL (zero network, zero Brain, zero MCP imports)', function () {
  const src = fs.readFileSync(METER_PATH, 'utf8');
  assert(!/modelcontextprotocol/.test(src), 'no MCP SDK import');
  assert(!/server\.tool/.test(src), 'no server.tool');
  assert(!/fetch\s*\(/.test(src), 'no fetch(');
  assert(!/https?:\/\//.test(src), 'no http(s) URL');
  // The formula must be documented verbatim in the module.
  assert(src.indexOf('CompressionDelta x GuardGate x StatusQuoGate') !== -1,
    'formula string must be present verbatim');
});

console.log('\nPhase 213 compression-meter: PASS=' + PASS + ' FAIL=' + FAIL);
process.exit(FAIL === 0 ? 0 : 1);
