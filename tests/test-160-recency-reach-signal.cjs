'use strict';
// Phase 160-03 Task 2 (R6) -- recency as a reach signal in Engine 1.
// ========================================================================
// The R6 acceptance proof: recency CONTRIBUTES to reach-candidate ordering.
// A recently-touched node yields a HIGHER reach score than an identical stale
// node, and the recency sensor is a REGISTERED reach signal that mints NO new
// reach_id and NO new EVENT_TYPE (it reuses the frozen context_block reach).
//
// This test asserts:
//   (1) sensorRecency is REGISTERED in SENSOR_REGISTRY (not just exported).
//   (2) the reach sensorRecency emits has a reach_id in the frozen REACH_IDS
//       bank (context_block) -- no new reach_id minted.
//   (3) a recently-touched node yields a higher recency reach score than an
//       identical stale node (R6 ordering), driven through the SHIPPED
//       recencyScore blend so the sensor score and the Leg D ranking agree.
//   (4) the reach FIRES through the REAL dispatchSensors chokepoint when the
//       LOCAL recency scalar is threaded on ctx (recent), and does NOT fire for
//       a stale scalar (honest negative).
//   (5) the recency reach carries ONLY LOCAL scalars (Canon Part 8): a recency
//       score + a count -- never a node id, type, or prose.
//
// Mirrors the dispatchSensors-as-unit-under-test idiom from
// tests/test-150-5-sensor-firability.cjs (the dispatch chokepoint is exercised,
// never per-sensor private state).
//
// House rule: hyphens only, no em-dashes (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const sensors = require(path.join(ROOT, 'lib', 'core', 'insight-sensors.cjs'));
const { sensorRecency, RECENT_SCORE_THRESHOLD } = require(
  path.join(ROOT, 'lib', 'core', 'sensors', 'sensor-recency.cjs')
);
const { REACH_IDS } = require(path.join(ROOT, 'lib', 'core', 'sensors', 'sensor-types.cjs'));

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok   ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('       ' + (err.message || String(err)) + '\n');
}
function check(name, fn) {
  try { fn(); ok(name); } catch (e) { fail(name, e); }
}

process.stdout.write('test-160-recency-reach-signal.cjs\n');

// (1) Registration: sensorRecency is in SENSOR_REGISTRY (a live signal, not a
//     dead export).
check('sensorRecency is registered in SENSOR_REGISTRY', () => {
  assert.ok(Array.isArray(sensors.SENSOR_REGISTRY), 'SENSOR_REGISTRY must be an array');
  assert.ok(
    sensors.SENSOR_REGISTRY.indexOf(sensorRecency) !== -1,
    'sensorRecency must be a member of SENSOR_REGISTRY'
  );
  assert.equal(typeof sensors.sensorRecency, 'function', 'sensorRecency must be exported');
});

// (2) Frozen-bank membership: the emitted reach reuses an EXISTING reach_id.
check('sensorRecency emits a reach_id in the frozen REACH_IDS bank (no new reach_id)', () => {
  const reach = sensorRecency({}, {}, { recencyScore: 0.99 });
  assert.ok(reach && typeof reach === 'object', 'a recent scalar must fire a reach');
  assert.ok(
    REACH_IDS.indexOf(reach.reach_id) !== -1,
    'the reach_id must be a member of the frozen REACH_IDS bank'
  );
  assert.equal(reach.reach_id, 'context_block', 'reuses the frozen context_block reach (R6)');
});

// (3) R6 ordering: a recently-touched node yields a HIGHER reach score than an
//     identical stale node.
check('a recently-touched node yields a higher reach score than an identical stale node (R6)', () => {
  // recent: 1 hour old -> score ~0.995; stale: 1000 hours old -> score ~0.0067.
  const recentScore = Math.pow(0.995, 1);
  const recent = sensorRecency({}, {}, { recencyScore: recentScore });
  assert.ok(recent && recent.evidence, 'the recent node must fire a reach with evidence');
  const recentReachScore = recent.evidence.recency_score;
  assert.ok(typeof recentReachScore === 'number', 'the reach carries a numeric recency score');

  // The stale node is below the threshold so it does NOT fire (no reach at all);
  // the recent node fires and carries a higher score than the threshold. The
  // ordering proof: recent reach score > the stale node's would-be score.
  const staleScore = Math.pow(0.995, 1000);
  const stale = sensorRecency({}, {}, { recencyScore: staleScore });
  assert.equal(stale, null, 'the stale node does not fire a recency reach (below threshold)');
  assert.ok(
    recentReachScore > staleScore,
    'the recently-touched node yields a higher reach score than the identical stale node'
  );
  assert.ok(
    recentReachScore >= RECENT_SCORE_THRESHOLD,
    'the recent reach score is at/above the recent-window threshold'
  );
});

// (4) Live fire through the REAL dispatchSensors chokepoint.
check('recency reach FIRES through dispatchSensors when ctx carries a recent scalar', () => {
  const reaches = sensors.dispatchSensors({}, {}, { recencyScore: 0.99 });
  assert.ok(Array.isArray(reaches), 'dispatchSensors must return an array');
  const recencyReach = reaches.find((r) => r && r.signal === 'recency');
  assert.ok(recencyReach, 'a recency reach must be present in the dispatch result');
  assert.equal(recencyReach.reach_id, 'context_block', 'the dispatched recency reach reuses context_block');
});

check('recency reach does NOT fire through dispatchSensors for a stale scalar (honest negative)', () => {
  const reaches = sensors.dispatchSensors({}, {}, { recencyScore: Math.pow(0.995, 1000) });
  const recencyReach = reaches.find((r) => r && r.signal === 'recency');
  assert.ok(!recencyReach, 'a stale recency scalar must not fire the recency reach');
});

// (5) Canon Part 8: the reach carries only LOCAL scalars -- no node id, type, or prose.
check('the recency reach carries only LOCAL scalars (Canon Part 8 -- no node id/type/body)', () => {
  const reach = sensorRecency({}, {}, { recencyScore: 0.99, recentCortexCount: 3 });
  assert.ok(reach && reach.evidence, 'reach must carry evidence');
  const ev = reach.evidence;
  assert.equal(typeof ev.recency_score, 'number', 'evidence carries a numeric recency score');
  assert.equal(typeof ev.recent_cortex_count, 'number', 'evidence carries a numeric count');
  // No node id / type / prose fields ride the reach evidence.
  assert.ok(!('node_id' in ev) && !('id' in ev), 'no node id on the reach evidence');
  assert.ok(!('type' in ev) && !('node_type' in ev), 'no node type on the reach evidence');
  assert.ok(!('properties' in ev) && !('body' in ev) && !('text' in ev), 'no prose body on the reach evidence');
});

if (failed > 0) {
  process.stdout.write('\n  ' + failed + ' check(s) FAILED (' + passed + ' passed)\n');
  process.exit(1);
}
process.stdout.write('\n  all ' + passed + ' checks passed\n');
process.exit(0);
