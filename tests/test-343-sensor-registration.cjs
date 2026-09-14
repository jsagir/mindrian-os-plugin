'use strict';
/*
 * tests/test-343-sensor-registration.cjs -- Phase 343 Plan 06.
 *
 * Pins SENS-19 (lib/core/sensors/sensor-graph-integrity.cjs): the pure
 * detector's threshold/exclusion/frozen/sync contract (Task 1), the six
 * in-file registration places (Task 2), and the ctx producer block proved
 * through decide() end to end (Task 3). See docs/343-ROOM-GRAPH-CENSUS-
 * DECISIONS.md WD-6/WD-7/WD-19 for the ruled decisions this file pins.
 *
 * Bare node script: assert, an ok(label) counter, no framework, non-zero
 * exit on any assertion failure (uncaught throw), self-contained.
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const DETECTOR_PATH = path.join(REPO, 'lib', 'core', 'sensors', 'sensor-graph-integrity.cjs');

const { buildFixtureRoom } = require('./helpers/fixture-room-219.cjs');
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
const engine = require(path.join(REPO, 'lib', 'core', 'navigation-engine.cjs'));

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-343-sensor-registration:');

// ---------------------------------------------------------------------------
// Task 1: the pure detector.
// ---------------------------------------------------------------------------

const { sensorGraphIntegrity, INTEGRITY_DEFECT_THRESHOLD } = require(DETECTOR_PATH);

assert.strictEqual(typeof sensorGraphIntegrity, 'function', 'sensorGraphIntegrity must be exported as a function');
assert.strictEqual(typeof INTEGRITY_DEFECT_THRESHOLD, 'number', 'INTEGRITY_DEFECT_THRESHOLD must be a number');
ok('the detector and its threshold constant are exported with the right types');

assert.strictEqual(
  sensorGraphIntegrity.constructor.name,
  'Function',
  'sensorGraphIntegrity must not be async (an async fn constructor.name is AsyncFunction)'
);
ok('sensorGraphIntegrity is not async');

assert.strictEqual(sensorGraphIntegrity({}, {}, {}), null, 'an absent ctx.graph_integrity must return null');
assert.strictEqual(
  sensorGraphIntegrity({}, {}, { graph_integrity: 'not-an-object' }),
  null,
  'a non-object ctx.graph_integrity must return null'
);
assert.strictEqual(sensorGraphIntegrity({}, {}, null), null, 'a null ctx must return null, never throw');
assert.strictEqual(sensorGraphIntegrity({}, {}, undefined), null, 'an undefined ctx must return null, never throw');
ok('absent/malformed ctx.graph_integrity returns null and never throws');

const belowThreshold = sensorGraphIntegrity({}, {}, {
  graph_integrity: { edge_rows_missing_endpoint: 1, claim_nodes_no_anchor_new: 1, schema_variant: 'migrated' },
});
assert.strictEqual(belowThreshold, null, 'a sum below INTEGRITY_DEFECT_THRESHOLD must return null');
ok('a sum below threshold returns strictly null');

const fired = sensorGraphIntegrity({}, {}, {
  graph_integrity: { edge_rows_missing_endpoint: 26, claim_nodes_no_anchor_new: 0, schema_variant: 'migrated' },
});
assert.ok(fired, 'a sum above threshold must fire');
assert.strictEqual(fired.reach_id, 'contradiction', 'SENS-19 must reuse the frozen contradiction reach, mint no seventh');
assert.strictEqual(fired.posture, 'hold', 'SENS-19 is a standing offer, never auto-run');
assert.strictEqual(fired.dispatch, 'room-graph-integrity');
assert.strictEqual(fired.signal, 'graph_integrity_threshold');
assert.ok(Object.isFrozen(fired), 'the returned reach must be frozen');
assert.ok(Object.isFrozen(fired.evidence), 'the reach evidence must be frozen');
ok('a threshold-crossing ctx fires the frozen contradiction/hold reach with the right dispatch and signal');

for (const k of Object.keys(fired.evidence)) {
  const v = fired.evidence[k];
  const t = typeof v;
  assert.ok(t === 'string' || t === 'number' || t === 'boolean', 'evidence.' + k + ' must be a flat scalar, got ' + t);
}
ok("the fired reach's evidence carries flat scalars only");

const excludedOnly = sensorGraphIntegrity({}, {}, {
  graph_integrity: {
    claim_nodes_no_anchor_legacy: 9999,
    edge_rows_type_outside_allowlist: 9999,
    edge_rows_missing_endpoint: 0,
    claim_nodes_no_anchor_new: 0,
  },
});
assert.strictEqual(excludedOnly, null, 'the two fleet-wide excluded classes must never trigger the sensor on their own');
ok('the two fleet-wide-explained classes (legacy anchor cohort, edge-type-outside-allowlist) cannot trigger it');

let legacyThrew = false;
let legacyResult;
try {
  legacyResult = sensorGraphIntegrity({}, {}, {
    graph_integrity: {
      edge_rows_missing_endpoint: 0,
      claim_nodes_no_anchor_new: null,
      claim_nodes_no_anchor_legacy: null,
      proposed_nodes_past_window: null,
      schema_variant: 'legacy',
    },
  });
} catch (_e) {
  legacyThrew = true;
}
assert.strictEqual(legacyThrew, false, 'a legacy-schema ctx with null fields must never throw');
assert.strictEqual(legacyResult, null, 'a legacy-schema ctx with null trigger fields must return null');
ok('a legacy-schema ctx (null trigger fields) returns null and never throws');

const detectorSource = fs.readFileSync(DETECTOR_PATH, 'utf8');
assert.strictEqual(/navigation-engine/.test(detectorSource), false, 'the detector must never reference navigation-engine');
ok('the detector file contains no reference to navigation-engine (the routing fence)');

// ---------------------------------------------------------------------------
// Task 2: the six in-file registration places.
// ---------------------------------------------------------------------------

const insightSensors = require(path.join(REPO, 'lib', 'core', 'insight-sensors.cjs'));
const { SENSOR_REGISTRY, SENSOR_REGISTRY_IDS } = insightSensors;
const { SENS_PRIORITY, sensorPriorityRank } = require(path.join(REPO, 'lib', 'core', 'sensors', 'sensor-priority.cjs'));

assert.strictEqual(
  SENSOR_REGISTRY.length,
  SENSOR_REGISTRY_IDS.length,
  'SENSOR_REGISTRY and SENSOR_REGISTRY_IDS must stay the same length'
);
ok('SENSOR_REGISTRY and SENSOR_REGISTRY_IDS are the same length');

const sens19Index = SENSOR_REGISTRY_IDS.indexOf('SENS-19');
assert.notStrictEqual(sens19Index, -1, 'SENSOR_REGISTRY_IDS must contain SENS-19');
assert.strictEqual(
  SENSOR_REGISTRY_IDS.indexOf('SENS-19', sens19Index + 1),
  -1,
  'SENSOR_REGISTRY_IDS must contain SENS-19 exactly once'
);
assert.strictEqual(
  SENSOR_REGISTRY[sens19Index],
  sensorGraphIntegrity,
  "SENSOR_REGISTRY_IDS's SENS-19 index must point at the same function as sensorGraphIntegrity"
);
ok('SENSOR_REGISTRY_IDS names SENS-19 exactly once, at the index whose SENSOR_REGISTRY entry is the detector function');

assert.strictEqual(insightSensors.sensorGraphIntegrity, sensorGraphIntegrity, 'insight-sensors.cjs must export sensorGraphIntegrity by name');
ok('sensorGraphIntegrity is present on the module exports');

const sens19Record = SENS_PRIORITY.find((r) => r.id === 'SENS-19');
assert.ok(sens19Record, 'SENS_PRIORITY must contain a SENS-19 record');
for (const key of ['id', 'optimizes', 'watched_by', 'why']) {
  assert.ok(Object.prototype.hasOwnProperty.call(sens19Record, key), 'the SENS-19 record must carry its own "' + key + '" key');
}
ok('SENS_PRIORITY contains a SENS-19 record with all four keys');

assert.ok(
  sensorPriorityRank('SENS-19') < sensorPriorityRank('SENS-16'),
  'SENS-19 must outrank SENS-16 (SENS-19 is Group A, SENS-16 is Group D)'
);
ok('sensorPriorityRank(SENS-19) is less than sensorPriorityRank(SENS-16): Group A placement took effect');

// ---------------------------------------------------------------------------
// Task 3: the ctx producer block, proved through decide() end to end.
//
// Calling the detector directly with a hand-built ctx does NOT satisfy this
// task (the plan's own instruction): the failure this arm exists to catch is
// a MISSING PRODUCER BLOCK, and a hand-built ctx hides exactly that. Every
// assertion below runs through engine.decide() with a real, seeded room.db
// handle threaded on ctx exactly as a real caller would thread it.
//
// A NOTE ON WHAT decide() ACTUALLY RETURNS: trace.context_assembly.facts
// (buildContextAssembly, lib/core/navigation-engine.cjs) is the ONE place a
// fired sensor reach survives decide()'s return value; by design (Canon Part
// 8 flattening) each fact carries only { reach_id, posture, evidence,
// first_seen, last_updated } -- never the sensor's raw `dispatch` string.
// SENS-19 is, as of this plan, the ONLY registered sensor that fires the
// `contradiction` reach_id (grep confirms zero other sensors mint
// reach_id:'contradiction'), so a fact with reach_id === 'contradiction' is
// unambiguously SENS-19's, and evidence.sensor_id === 'SENS-19' is the
// central-stamp proof the plan asks for. The sensor's own `dispatch` value
// ('room-graph-integrity') is pinned directly against the detector's return
// value in the Task 1 arms above; this arm proves the SAME detector actually
// fires when reached through the full decide() pipeline, which is what a
// missing producer block would break.
// ---------------------------------------------------------------------------

function findContradictionFact(decision) {
  const facts = decision
    && decision.decision_trace
    && decision.decision_trace.context_assembly
    && Array.isArray(decision.decision_trace.context_assembly.facts)
    ? decision.decision_trace.context_assembly.facts
    : [];
  return facts.filter((f) => f && f.reach_id === 'contradiction');
}

function seedDanglingEdges(db, sourceId, count) {
  for (let i = 0; i < count; i += 1) {
    const res = navigation.writeEdge(db, {
      source_id: sourceId,
      target_id: 'ghost-343-06-' + i,
      edge_type: 'SUPPORTS',
    });
    assert.ok(res && res.ok === true, 'seeding a dangling edge must succeed: ' + JSON.stringify(res));
  }
}

// ---- ABOVE THRESHOLD: decide() fires the contradiction reach, SENS-19-stamped. ----
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-343-06-above-'));
  let db = null;
  try {
    const fixture = buildFixtureRoom(tmp);
    db = openRoomDb(fixture.roomDir, { allowExtension: true });
    const sourceId = fixture.ids.hubs[fixture.ids.sections[0]];
    seedDanglingEdges(db, sourceId, 30); // > INTEGRITY_DEFECT_THRESHOLD (25)

    const decision = engine.decide({ text: 'anything' }, { roomDb: db, roomDir: fixture.roomDir });
    const hits = findContradictionFact(decision);
    assert.strictEqual(hits.length, 1, 'exactly one contradiction reach must fire end to end: ' + JSON.stringify(hits));
    assert.strictEqual(hits[0].evidence.sensor_id, 'SENS-19', 'the central stamp must name SENS-19');
    assert.strictEqual(hits[0].reach_id, 'contradiction');
    assert.strictEqual(hits[0].posture, 'hold');
    assert.ok(hits[0].evidence.edge_rows_missing_endpoint >= 26, 'evidence must carry the measured defect count');
    assert.strictEqual(
      decision.decision_trace.routing_source,
      undefined,
      'decide() must never write routing_source (the sensor layer is not a second selection brain)'
    );
    ok('ABOVE THRESHOLD: decide() with a seeded room.db handle fires exactly one SENS-19-stamped contradiction reach');
  } finally {
    if (db) { try { closeRoomDb(db); } catch (_e) { /* ignore */ } }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }
}

// ---- BELOW THRESHOLD: the same pipeline, no contradiction reach. ----
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-343-06-below-'));
  let db = null;
  try {
    const fixture = buildFixtureRoom(tmp);
    db = openRoomDb(fixture.roomDir, { allowExtension: true });
    const sourceId = fixture.ids.hubs[fixture.ids.sections[0]];
    seedDanglingEdges(db, sourceId, 2); // well under INTEGRITY_DEFECT_THRESHOLD (25)

    const decision = engine.decide({ text: 'anything' }, { roomDb: db, roomDir: fixture.roomDir });
    const hits = findContradictionFact(decision);
    assert.strictEqual(hits.length, 0, 'a below-threshold room must never produce a contradiction reach: ' + JSON.stringify(hits));
    assert.strictEqual(decision.decision_trace.routing_source, undefined, 'routing_source must stay untouched below threshold too');
    ok('BELOW THRESHOLD: decide() with a seeded room.db handle under the count produces no contradiction reach');
  } finally {
    if (db) { try { closeRoomDb(db); } catch (_e) { /* ignore */ } }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }
}

// ---- NO HANDLE: ctx.roomDb absent -> no reach, never throws. ----
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-343-06-nohandle-'));
  try {
    const fixture = buildFixtureRoom(tmp);
    let decision;
    assert.doesNotThrow(() => {
      decision = engine.decide({ text: 'anything' }, { roomDir: fixture.roomDir });
    }, 'decide() with no ctx.roomDb must never throw');
    const hits = findContradictionFact(decision);
    assert.strictEqual(hits.length, 0, 'no room.db handle must never produce a contradiction reach');
    assert.strictEqual(decision.decision_trace.routing_source, undefined, 'routing_source must stay untouched with no handle too');
    ok('NO HANDLE: decide() with ctx.roomDb absent produces no reach and never throws');
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// WR-03 (343 review): the shared reach_id 'contradiction' collision must
// resolve DETERMINISTICALLY per the SENS_PRIORITY doctrine table
// (lib/core/sensors/sensor-priority.cjs), never by SENSOR_REGISTRY file
// order.
//
// CORRECTION to the review's own citation: the review named SENS-08 as
// SENS-19's collision partner. Read against the live code, SENS-08
// (sensorMemoryCortex) ALWAYS fires reach_id 'cross_room'
// (lib/core/sensors/sensor-memory-cortex.cjs:91) -- it never mints
// 'contradiction'. The ONLY other sensor that ever fires reach_id
// 'contradiction' is SENS-06 (sensorArtifactFiled, lib/core/insight-
// sensors.cjs:708, when the freshest cascade finding's type contains
// 'CONTRADICT'). This arm pins the REAL collision (SENS-06 vs SENS-19)
// rather than the one the review described, since a test asserting a rule
// the code does not implement (an SENS-08 vs SENS-19 collision that cannot
// occur) would be worse than no test at all.
//
// SENS_PRIORITY places SENS-19 in Group A (a confirmed room-state fact) and
// SENS-06 in Group B (a transient marker-file signal); Group A precedes
// Group B in its entirety, so SENS-19 must win every run.
// ---------------------------------------------------------------------------
{
  assert.ok(
    sensorPriorityRank('SENS-19') < sensorPriorityRank('SENS-06'),
    'doctrine precondition: SENS-19 (Group A) must outrank SENS-06 (Group B)'
  );

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-343-wr03-'));
  let db = null;
  try {
    const fixture = buildFixtureRoom(tmp);
    db = openRoomDb(fixture.roomDir, { allowExtension: true });
    const sourceId = fixture.ids.hubs[fixture.ids.sections[0]];
    seedDanglingEdges(db, sourceId, 30); // fires SENS-19's contradiction reach

    // Fires SENS-06's contradiction reach too: a fresh last-cascade.json
    // marker whose first finding's type carries 'CONTRADICT'. No session_id
    // is set, so isMarkerOwnedByCaller's fail-open rule applies regardless
    // of the (absent) caller session id.
    const sideDir = path.join(fixture.roomDir, '.mindrian');
    fs.mkdirSync(sideDir, { recursive: true });
    fs.writeFileSync(
      path.join(sideDir, 'last-cascade.json'),
      JSON.stringify({
        proactive_intelligence: {
          newFindings: [{ type: 'CONTRADICTS_CLAIM' }],
        },
      })
    );

    const decision = engine.decide({ text: 'anything' }, { roomDb: db, roomDir: fixture.roomDir });
    const hits = findContradictionFact(decision);

    assert.strictEqual(
      hits.length, 2,
      'both SENS-06 and SENS-19 must surface as facts -- neither silently dropped nor merged: '
        + JSON.stringify(hits)
    );
    const sensorIds = hits.map((h) => h.evidence && h.evidence.sensor_id);
    assert.ok(
      sensorIds.includes('SENS-19') && sensorIds.includes('SENS-06'),
      'both sensor stamps must be present: ' + JSON.stringify(sensorIds)
    );
    assert.strictEqual(
      hits[0].evidence.sensor_id, 'SENS-19',
      'the doctrine-ranked winner (SENS-19, Group A) must sort first, never SENS-06 (Group B): '
        + JSON.stringify(sensorIds)
    );
    ok('WR-03: the SENS-06/SENS-19 shared contradiction collision resolves deterministically, SENS-19 first, every run');
  } finally {
    if (db) { try { closeRoomDb(db); } catch (_e) { /* ignore */ } }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }
}

console.log('');
console.log('PASS test-343-sensor-registration.cjs (' + checks + ' checks, including the end-to-end decide() arms)');
