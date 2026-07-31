'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-06 Task 3 -- the Requirement 3 ACCEPTANCE test for SENS-17.
 *
 * WHAT THIS PINS
 *
 * `hats` is one of the six frozen Phase-148 reach ids. For seven weeks it was
 * reachable ONLY by a manual navigator pick: no sensor in the bank ever
 * assigned it. This suite asserts that a turn whose projected cortex carries
 * >= 2 fresh contradictions now yields `reach_id: 'hats'` PROACTIVELY, with no
 * manual pick anywhere in the fixture.
 *
 * WHY IT DRIVES dispatchSensors AND NEVER THE SENSOR DIRECTLY
 *
 * Calling sensorPerspectiveLock(...) directly would prove only that a pure
 * function returns a struct. Requirement 3 is about the GOVERNED path: the
 * sensor has to be registered, has to survive the membership check and the
 * turn-stage eligibility gate, and has to come back carrying the central
 * evidence.sensor_id stamp. Only dispatchSensors exercises all of that, so
 * every fire assertion below goes through its real signature.
 *
 * Standalone node script, exit 0/1. Zero network, zero fs writes, no temp room
 * needed: the ctx-threaded path reads a scalar and touches no db and no disk.
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
const REGISTRY = require(path.join(REPO_ROOT, 'data', 'connector-registry.json'));

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

// The fixture: a bare turn and a bare tuple. Nothing here names a reach,
// names a command, or expresses a preference. The ONLY input is the cortex
// scalar, which is the whole point: the reach must be PROACTIVE.
function hatsReachesAt(freshContradictions) {
  const reaches = dispatchSensors({}, {}, { freshContradictions: freshContradictions });
  return reaches.filter((r) => r.reach_id === 'hats');
}

// ---------- (1) THE FIRE, AT THE THRESHOLD ----------

check('H1: the threshold constant is 2 (the D-14 figure this suite is written against)', () => {
  assert.equal(PERSPECTIVE_LOCK_THRESHOLD, 2);
});

check('H2: freshContradictions = 2 yields a hats reach through dispatchSensors, no manual pick', () => {
  const hats = hatsReachesAt(2);
  assert.equal(hats.length, 1, 'exactly one hats reach');
  assert.equal(hats[0].reach_id, 'hats');
  assert.equal(hats[0].posture, 'hold', 'a perspective rotation HALTS the current line (D-12)');
  assert.equal(hats[0].signal, 'perspective_lock');
  assert.equal(hats[0].evidence.sensor_id, 'SENS-17', 'centrally stamped by dispatchSensors');
  assert.equal(hats[0].evidence.fresh_contradictions, 2);
});

check('H3: freshContradictions = 7 yields the same contract, count carried through', () => {
  const hats = hatsReachesAt(7);
  assert.equal(hats.length, 1, 'exactly one hats reach');
  assert.equal(hats[0].posture, 'hold');
  assert.equal(hats[0].signal, 'perspective_lock');
  assert.equal(hats[0].evidence.sensor_id, 'SENS-17');
  assert.equal(hats[0].evidence.fresh_contradictions, 7);
});

check('H4: the dispatch handle names the shipped hats surface, not user content', () => {
  const hats = hatsReachesAt(2);
  assert.equal(hats[0].dispatch, 'think-hats (six-hats perspective rotation)');
  assert.deepEqual(hats[0].companions, [], 'no companions ride the hats reach');
});

// ---------- (2) CANON PART 8: THE EVIDENCE BAG ----------

check('H5: the evidence bag is exactly {trigger, fresh_contradictions, sensor_id}', () => {
  const ev = hatsReachesAt(4)[0].evidence;
  const keys = Object.keys(ev).sort();
  assert.deepEqual(keys, ['fresh_contradictions', 'sensor_id', 'trigger'],
    'closed key set: two local scalars plus the central stamp, nothing else');
  assert.equal(ev.trigger, 'perspective_lock', 'a generic enum, not a description');
  assert.equal(typeof ev.fresh_contradictions, 'number');
  assert.equal(ev.fresh_contradictions, 4);
});

check('H6: no evidence value is prose (every value is a scalar; strings are short enums)', () => {
  const ev = hatsReachesAt(3)[0].evidence;
  for (const k of Object.keys(ev)) {
    const v = ev[k];
    const t = typeof v;
    assert.ok(t === 'string' || t === 'number' || t === 'boolean',
      'evidence.' + k + ' is a flat scalar (got ' + t + ')');
    if (t === 'string') {
      // A closed-vocabulary enum, never a sentence: no spaces, and short.
      assert.ok(v.length <= 32, 'evidence.' + k + ' is short (' + v.length + ' chars)');
      assert.ok(v.indexOf(' ') === -1, 'evidence.' + k + ' carries no spaces, so it cannot be prose');
    }
  }
});

check('H7: the reach struct is deeply frozen (makeReach contract)', () => {
  const r = hatsReachesAt(2)[0];
  assert.ok(Object.isFrozen(r), 'reach frozen');
  assert.ok(Object.isFrozen(r.evidence), 'evidence frozen');
  assert.ok(Object.isFrozen(r.companions), 'companions frozen');
});

// ---------- (3) REGISTRY TRUTH: THE THREE REPAIRED DECLARATIONS ----------
//
// D-15: commands/think-hats.md, commands/persona.md and commands/bono.md each
// declared `sensor_triggers: [SENS-05]` alongside `reach_id: hats`, but SENS-05
// is sensor-jtbd-reweight.cjs, which fires `context_block`. Those three
// declarations asserted a link the code did not implement. SENS-17 is what
// makes them true, and this case regression-pins the repair so it cannot
// silently drift back.

check('H8: sensor_index maps SENS-17 to all three hats surfaces', () => {
  const idx = REGISTRY.sensor_index['SENS-17'];
  assert.ok(Array.isArray(idx), 'SENS-17 has a sensor_index entry');
  for (const surface of ['/mos:think-hats', '/mos:persona', '/mos:bono']) {
    assert.ok(idx.indexOf(surface) !== -1, 'SENS-17 -> ' + surface);
  }
});

check('H9: SENS-05 no longer claims any of the three hats surfaces', () => {
  const idx = REGISTRY.sensor_index['SENS-05'] || [];
  for (const surface of ['/mos:think-hats', '/mos:persona', '/mos:bono']) {
    assert.ok(idx.indexOf(surface) === -1, 'SENS-05 released ' + surface);
  }
  // SENS-05 legitimately retains its other declaring surfaces. Asserted rather
  // than assumed, so a future edit that empties it is visible here.
  assert.ok(idx.length > 0, 'SENS-05 still has its own surfaces (got ' + idx.length + ')');
});

// The three D-15 surfaces, named explicitly. This is deliberately NOT "every
// connector whose reach_id is hats".
//
// Writing this case as a blanket sweep surfaced a FOURTH surface of the same
// defect class that D-15 never enumerated: /mos:hat-briefing declares
// `reach_id: hats` with `sensor_triggers: [SENS-07]`, and SENS-07
// (sensor-gate-approach.cjs:89) fires `context_block`, not hats. That is a real
// finding and it is logged in this phase's deferred-items.md, but it is OUT OF
// SCOPE for 245-06, whose declared files_modified covers three command files
// and whose action block explicitly forbids chasing sensor_index's other gaps.
// Pinning it here would redden this suite on a defect this plan is not
// authorized to fix, so the assertion matches the plan's must_have exactly: the
// THREE commands declaring reach_id hats declare a sensor that actually fires
// hats. When hat-briefing is repaired, widen this list rather than loosening it.
const D15_HATS_SURFACES = ['/mos:think-hats', '/mos:persona', '/mos:bono'];

check('H10: each of the three D-15 hats surfaces declares a sensor that fires hats', () => {
  for (const surface of D15_HATS_SURFACES) {
    const c = REGISTRY.connectors.find((x) => x && x.surface === surface);
    assert.ok(c, surface + ' is present in the connector registry');
    assert.equal(c.reach_id, 'hats', surface + ' still declares reach_id hats (unchanged by this plan)');
    assert.ok(Array.isArray(c.sensor_triggers) && c.sensor_triggers.indexOf('SENS-17') !== -1,
      surface + ' declares SENS-17, the sensor that actually fires hats');
    assert.ok(c.sensor_triggers.indexOf('SENS-05') === -1,
      surface + ' no longer declares SENS-05 (which fires context_block, not hats)');
  }
});

console.log('\ntest-245-sens17-hats: ' + pass + '/' + total + ' passed');
if (failures.length) {
  console.log('FAILURES:');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
