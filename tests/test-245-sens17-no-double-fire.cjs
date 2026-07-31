'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-06 Task 3 -- the D-14 threshold guard for SENS-17.
 *
 * WHAT THIS PINS, AND WHY IT IS A SEPARATE SUITE
 *
 * SENS-08 (lib/core/sensors/sensor-memory-cortex.cjs:84) already fires the
 * `cross_room` reach on `ctx.freshContradictions > 0`. SENS-17 reads the SAME
 * ctx field. If SENS-17 had been written at `> 0` it would double-fire on every
 * single contradiction the projected cortex ever produces, which is both a
 * de-duplication defect and a Canon Part 12 invisibility defect (a navigator
 * interrupted on every contradiction is the opposite of invisible).
 * PERSPECTIVE_LOCK_THRESHOLD = 2 is what prevents that, and a threshold that is
 * not pinned by test is a threshold a future edit will quietly lower.
 *
 * BOTH DIRECTIONS ARE ASSERTED, ON PURPOSE:
 *
 *   at freshContradictions = 1  -> SENS-08 cross_room fires, ZERO hats.
 *                                  One fresh contradiction is a memory-cortex
 *                                  bridge, not a perspective lock.
 *   at freshContradictions = 2  -> BOTH fire. SENS-08's `> 0` still holds and
 *                                  SENS-17's `>= 2` now also holds. That
 *                                  co-fire is the intended DESIGNED behavior,
 *                                  not a leak: the two sensors emit different
 *                                  reach ids describing genuinely different
 *                                  states of the same signal. A future edit
 *                                  that suppressed either one should redden
 *                                  this suite.
 *
 * Exact counts are asserted, never mere presence: "at least one hats reach" and
 * "exactly one hats reach" fail differently, and only the second one catches a
 * duplicate registration.
 *
 * Standalone node script, exit 0/1. Zero network, zero fs writes, no temp room.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const { dispatchSensors } = require(path.join(REPO_ROOT, 'lib', 'core', 'insight-sensors.cjs'));
const {
  PERSPECTIVE_LOCK_THRESHOLD,
} = require(path.join(REPO_ROOT, 'lib', 'core', 'sensors', 'sensor-perspective-lock.cjs'));

let pass = 0;
let total = 0;
const failures = [];
function check(label, fn) {
  total += 1;
  try {
    fn();
    pass += 1;
    console.log('  ok -', label);
  } catch (e) {
    failures.push(label + ': ' + (e && e.message));
    console.log('  FAIL -', label, '::', e && e.message);
  }
}

function dispatchAt(freshContradictions) {
  return dispatchSensors({}, {}, { freshContradictions: freshContradictions });
}
function countOf(reaches, reachId) {
  return reaches.filter((r) => r.reach_id === reachId).length;
}
function bySensor(reaches, sensorId) {
  return reaches.filter((r) => r.evidence && r.evidence.sensor_id === sensorId);
}

// ---------- (0) THE THRESHOLD THIS SUITE IS WRITTEN AGAINST ----------

check('N0: PERSPECTIVE_LOCK_THRESHOLD is 2', () => {
  assert.equal(PERSPECTIVE_LOCK_THRESHOLD, 2,
    'lowering this constant is exactly what the rest of this suite exists to catch');
});

// ---------- (1) ONE CONTRADICTION: BRIDGE ONLY, NEVER A ROTATION ----------

check('N1: at freshContradictions = 1, SENS-08 fires exactly one cross_room reach', () => {
  const reaches = dispatchAt(1);
  assert.equal(countOf(reaches, 'cross_room'), 1, 'exactly one cross_room reach');
  const s08 = bySensor(reaches, 'SENS-08');
  assert.equal(s08.length, 1, 'exactly one reach stamped SENS-08');
  assert.equal(s08[0].reach_id, 'cross_room');
  assert.equal(s08[0].evidence.trigger, 'fresh_contradiction');
});

check('N2: at freshContradictions = 1, ZERO hats reaches (the D-14 guard)', () => {
  const reaches = dispatchAt(1);
  assert.equal(countOf(reaches, 'hats'), 0,
    'one fresh contradiction is a memory-cortex bridge, not a perspective lock');
  assert.equal(bySensor(reaches, 'SENS-17').length, 0, 'SENS-17 did not fire at 1');
});

check('N3: at freshContradictions = 1 the dispatch is exactly one reach total', () => {
  const reaches = dispatchAt(1);
  assert.equal(reaches.length, 1,
    'exact count, not presence: a second reach here would mean something else started firing');
});

// ---------- (2) TWO CONTRADICTIONS: BOTH FIRE, BY DESIGN ----------

check('N4: at freshContradictions = 2, BOTH sensors fire (the intended co-fire)', () => {
  const reaches = dispatchAt(2);
  assert.equal(countOf(reaches, 'cross_room'), 1, 'exactly one cross_room reach (SENS-08 > 0 still holds)');
  assert.equal(countOf(reaches, 'hats'), 1, 'exactly one hats reach (SENS-17 >= 2 now holds)');
  assert.equal(reaches.length, 2, 'exactly two reaches total, no more');
});

check('N5: at freshContradictions = 2 the two reaches carry distinct sensor stamps', () => {
  const reaches = dispatchAt(2);
  assert.equal(bySensor(reaches, 'SENS-08').length, 1, 'exactly one SENS-08 reach');
  assert.equal(bySensor(reaches, 'SENS-17').length, 1, 'exactly one SENS-17 reach');
  assert.equal(bySensor(reaches, 'SENS-08')[0].reach_id, 'cross_room');
  assert.equal(bySensor(reaches, 'SENS-17')[0].reach_id, 'hats');
});

// ---------- (3) THE BOUNDARY, WALKED ----------

check('N6: 0 fires nothing, 1 fires cross_room only, 2 and 3 fire both', () => {
  const at0 = dispatchAt(0);
  assert.equal(at0.length, 0, 'zero contradictions is not a signal at all');

  const at1 = dispatchAt(1);
  assert.equal(countOf(at1, 'cross_room'), 1);
  assert.equal(countOf(at1, 'hats'), 0);

  for (const n of [2, 3]) {
    const at = dispatchAt(n);
    assert.equal(countOf(at, 'cross_room'), 1, 'cross_room at ' + n);
    assert.equal(countOf(at, 'hats'), 1, 'hats at ' + n);
  }
});

check('N7: a malformed or absent contradiction count fires neither sensor', () => {
  for (const ctx of [{}, { freshContradictions: 'two' }, { freshContradictions: NaN },
    { freshContradictions: Infinity }, { freshContradictions: -3 }, null]) {
    const reaches = dispatchSensors({}, {}, ctx);
    assert.equal(countOf(reaches, 'hats'), 0,
      'no hats reach for ctx ' + JSON.stringify(ctx));
    assert.equal(countOf(reaches, 'cross_room'), 0,
      'no cross_room reach for ctx ' + JSON.stringify(ctx));
  }
});

console.log('\ntest-245-sens17-no-double-fire: ' + pass + '/' + total + ' passed');
if (failures.length) {
  console.log('FAILURES:');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
