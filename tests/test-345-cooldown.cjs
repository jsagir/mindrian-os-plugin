#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 345-03 Task 3 -- strategy-throttle.cjs: the three-mechanism cool-down
 * (hard minimum interval, dismissal-rate throttle, REJECT-only suppression).
 *
 * Grounds every leg against the shipped organs this module composes:
 *   - lib/core/breakthrough/canary.cjs (the dismissal-rate SHAPE, per-kind
 *     isolation, the rate/sample_size/throttled return contract)
 *   - lib/workflow/reach-reject-reader.cjs::rejectCountInWindow (the
 *     reject-keyed suppression leg, called as-is, not reimplemented)
 *   - lib/core/strategy/goal-cadence.cjs (STRATEGY_MIN_INTERVAL_REACHES, the
 *     hard floor this module's first mechanism reuses)
 *
 * Plain-node house style: hand-rolled ok()/skip() helpers, a failing
 * assertion prints and process.exit(1)s. Fixture legs SKIP honestly (never
 * silently PASS) when node:sqlite is unavailable. CJS. NO em-dashes.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const THROTTLE_PATH = path.join(ROOT, 'lib', 'core', 'strategy', 'strategy-throttle.cjs');
const CADENCE_PATH = path.join(ROOT, 'lib', 'core', 'strategy', 'goal-cadence.cjs');
const NAVIGATION_PATH = path.join(ROOT, 'lib', 'core', 'navigation.cjs');
const FIXTURE_PATH = path.join(ROOT, 'tests', 'helpers', 'fixture-room-347.cjs');

let checks = 0;
let failed = 0;
let skipped = 0;

function ok(label, cond) {
  checks++;
  if (!cond) {
    failed++;
    console.log('FAIL: ' + label);
  } else {
    console.log('ok: ' + label);
  }
}

function skip(label) {
  skipped++;
  console.log('SKIP: ' + label);
}

const throttle = require(THROTTLE_PATH);
const cadence = require(CADENCE_PATH);
const navigation = require(NAVIGATION_PATH);

// ---------------------------------------------------------------------------
// Leg 1: exported constants.
// ---------------------------------------------------------------------------
console.log('--- Leg 1: exported constants ---');

ok('exports computeDismissalRate', typeof throttle.computeDismissalRate === 'function');
ok('exports isThrottled', typeof throttle.isThrottled === 'function');
ok('exports emitThrottleEvent', typeof throttle.emitThrottleEvent === 'function');
ok('STRATEGY_DISMISSAL_THRESHOLD === 0.5', throttle.STRATEGY_DISMISSAL_THRESHOLD === 0.5);
ok('STRATEGY_FIRE_WINDOW === 6', throttle.STRATEGY_FIRE_WINDOW === 6);
ok('STRATEGY_MIN_SAMPLE === 3', throttle.STRATEGY_MIN_SAMPLE === 3);
ok('STRATEGY_REJECT_SUPPRESS_AT === 2', throttle.STRATEGY_REJECT_SUPPRESS_AT === 2);

// ---------------------------------------------------------------------------
// Leg 2: isThrottled, pure, no db -- the cold path and the hard floor.
// ---------------------------------------------------------------------------
console.log('--- Leg 2: isThrottled cold path and the hard floor ---');

(function () {
  const r = throttle.isThrottled(null, null);
  ok('isThrottled(null, null) is not throttled (absence is not a signal)', r.throttled === false);
}());

(function () {
  const r = throttle.isThrottled(null, null, { reaches_since: cadence.STRATEGY_MIN_INTERVAL_REACHES - 1 });
  ok('below the hard floor, isThrottled is true', r.throttled === true);
  ok('below the hard floor, reason is min_interval', r.reason === 'min_interval');
}());

(function () {
  // Mirrors the plan's own acceptance_criteria node -e command verbatim.
  const r = throttle.isThrottled(null, null, { reaches_since: 9999 });
  ok('past the hard floor with no other signal, isThrottled is false', r.throttled === false);
}());

// ---------------------------------------------------------------------------
// Leg 3: the dismissal-rate mechanism, driven entirely through the roomState
// injection seam (db = null).
// ---------------------------------------------------------------------------
console.log('--- Leg 3: dismissal-rate throttle (injection seam) ---');

(function () {
  // STRATEGY_FIRE_WINDOW=6 fires, rate 0.6 > STRATEGY_DISMISSAL_THRESHOLD=0.5,
  // sample_size=6 >= STRATEGY_MIN_SAMPLE=3.
  const roomState = { dismissalRate: { rate: 0.6, sample_size: 6 } };
  const r = throttle.isThrottled(null, roomState, { reaches_since: cadence.STRATEGY_MIN_INTERVAL_REACHES });
  ok('a dismissal rate over threshold with sample >= floor throttles', r.throttled === true);
  ok('the reason is dismissal_rate', r.reason === 'dismissal_rate');
}());

(function () {
  // Below STRATEGY_MIN_SAMPLE: never throttles on rate alone, however high.
  const roomState = { dismissalRate: { rate: 1.0, sample_size: 2 } };
  const r = throttle.isThrottled(null, roomState, { reaches_since: cadence.STRATEGY_MIN_INTERVAL_REACHES });
  ok('a below-floor sample never throttles on dismissal rate, regardless of rate', r.throttled === false);
}());

// ---------------------------------------------------------------------------
// Leg 4: the reject-keyed suppression mechanism, via reach-reject-reader's
// own injection seam (roomState.rejectCountInWindow.contradiction).
// ---------------------------------------------------------------------------
console.log('--- Leg 4: reject-keyed suppression (injection seam) ---');

(function () {
  const roomState = { rejectCountInWindow: { contradiction: throttle.STRATEGY_REJECT_SUPPRESS_AT } };
  const r = throttle.isThrottled(null, roomState, { reaches_since: cadence.STRATEGY_MIN_INTERVAL_REACHES });
  ok('a reject count at or above STRATEGY_REJECT_SUPPRESS_AT throttles', r.throttled === true);
  ok('the reason is reject_suppression', r.reason === 'reject_suppression');
}());

(function () {
  const roomState = { rejectCountInWindow: { contradiction: throttle.STRATEGY_REJECT_SUPPRESS_AT - 1 } };
  const r = throttle.isThrottled(null, roomState, { reaches_since: cadence.STRATEGY_MIN_INTERVAL_REACHES });
  ok('a reject count below STRATEGY_REJECT_SUPPRESS_AT does not throttle', r.throttled === false);
}());

// DEFER / PIVOT never contribute: inherited from reach-reject-reader.cjs's
// own _isRejectRow filter (decision==='reject' OR edge_semantic==='REJECTED'
// only). This module never re-derives that filter; it calls
// rejectCountInWindow as-is, so a DEFER/PIVOT-only room injects 0 here by
// construction, proven by the reader's own suite. This leg asserts the
// wiring: a caller that injects 0 (the DEFER/PIVOT-only reading) is not
// throttled by this mechanism.
(function () {
  const roomState = { rejectCountInWindow: { contradiction: 0 } };
  const r = throttle.isThrottled(null, roomState, { reaches_since: cadence.STRATEGY_MIN_INTERVAL_REACHES });
  ok(
    'a DEFER/PIVOT-only reading (injected 0) never trips reject_suppression',
    r.reason !== 'reject_suppression'
  );
}());

// ---------------------------------------------------------------------------
// Leg 5: fixture-based legs -- emitThrottleEvent writes exactly one row, and
// computeDismissalRate never throws on a real (empty) db.
// ---------------------------------------------------------------------------
console.log('--- Leg 5: fixture-based emitThrottleEvent ---');

let sqliteAvailable = true;
try {
  require('node:sqlite');
} catch (_e) {
  sqliteAvailable = false;
}

if (!sqliteAvailable) {
  skip('emitThrottleEvent writes exactly one strategy_throttled row (node:sqlite unavailable)');
  skip('computeDismissalRate never throws against a real empty db (node:sqlite unavailable)');
} else {
  const { buildChainFixtureRoom, closeChainFixtureRoom } = require(FIXTURE_PATH);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-345-cooldown-'));
  const fixture = buildChainFixtureRoom(tmpDir, 'wide');
  try {
    const db = fixture.db;

    const cold = throttle.computeDismissalRate(db, null);
    ok(
      'computeDismissalRate never throws against a real, empty db',
      cold && typeof cold.rate === 'number' && typeof cold.sample_size === 'number'
    );

    const result = { throttled: true, reason: 'min_interval', rate: 0, sample_size: 0 };
    const before = navigation.findRecentChanges(db, 0, { eventType: 'strategy_throttled', limit: 100 });
    ok('no strategy_throttled row exists before emitThrottleEvent', before.length === 0);

    const emitResult = throttle.emitThrottleEvent(db, result);
    ok('emitThrottleEvent returns the logMemoryEvent ok result', emitResult && emitResult.ok === true);

    const after = navigation.findRecentChanges(db, 0, { eventType: 'strategy_throttled', limit: 100 });
    ok('emitThrottleEvent writes exactly one strategy_throttled row', after.length === 1);

    const row = after[0];
    ok('the row carries reason', row.properties.reason === 'min_interval');
    ok('the row carries rate', typeof row.properties.rate === 'number');
    ok('the row carries sample_size', typeof row.properties.sample_size === 'number');
    ok('the row carries threshold', row.properties.threshold === cadence.STRATEGY_MIN_INTERVAL_REACHES);

    // Calling emitThrottleEvent a second time with a DIFFERENT mechanism must
    // not produce more than one row per call (never one row per mechanism).
    const secondResult = { throttled: true, reason: 'dismissal_rate', rate: 0.6, sample_size: 6 };
    throttle.emitThrottleEvent(db, secondResult);
    const afterSecond = navigation.findRecentChanges(db, 0, { eventType: 'strategy_throttled', limit: 100 });
    ok('a second emitThrottleEvent call writes exactly one more row (never one per mechanism)', afterSecond.length === 2);
  } finally {
    closeChainFixtureRoom(fixture);
  }
}

// ---------------------------------------------------------------------------
// Leg 6: source discipline.
// ---------------------------------------------------------------------------
console.log('--- Leg 6: source discipline ---');

const throttleSource = fs.readFileSync(THROTTLE_PATH, 'utf8');
ok('strategy-throttle.cjs never reads properties.reason', !/properties\.reason/.test(throttleSource));
ok('strategy-throttle.cjs names all three reason enums', ['min_interval', 'dismissal_rate', 'reject_suppression'].every(function (r) {
  return throttleSource.indexOf("'" + r + "'") !== -1;
}));
ok('the test names all three reason enums too', ['min_interval', 'dismissal_rate', 'reject_suppression'].every(function (r) {
  return fs.readFileSync(__filename, 'utf8').indexOf("'" + r + "'") !== -1;
}));

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('');
console.log('======================================');
console.log('Checks: ' + checks + '  Failed: ' + failed + '  Skipped: ' + skipped);
console.log('======================================');

if (failed > 0) {
  process.exit(1);
}
