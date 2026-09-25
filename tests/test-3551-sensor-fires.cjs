#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 03 Task 1 -- test-3551-sensor-fires: pins SENS-21's
 * fallback-only firing rule (AMB-02) through THREE surfaces -- the raw
 * sensor call, the MCP pull (lib/mcp/tools/sensors.cjs
 * _internal.dispatchCandidateReaches), and decide() -- so the sensor is
 * proven to fire through the real production paths, never only by calling
 * sensorRoomDelta directly (Pitfall 2).
 *
 * The writer that produces <roomDir>/.mindrian/last-room-delta.json belongs
 * to plan 355.1-05; this test writes the fixture file directly with fs, the
 * exact shape the sensor reads.
 *
 * hygiene-355 preamble (scrubVendorKey + installNetGuard BEFORE any repo
 * require, attempts() === 0 last -- Pitfall 16). House rule: hyphens only,
 * no em-dashes.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildDeltaRoom, MARKER_PREFIX } = require('./helpers/fixture-room-3551.cjs');

let sensorFile;
try {
  sensorFile = require('../lib/core/sensors/sensor-room-delta.cjs');
} catch (_e) {
  sensorFile = null;
}
const sensorsMcpTool = require('../lib/mcp/tools/sensors.cjs');
const engine = require('../lib/core/navigation-engine.cjs');

let checks = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}

console.log('test-3551-sensor-fires:');

assert.ok(sensorFile, 'lib/core/sensors/sensor-room-delta.cjs must exist and load (module missing)');

const DELTA_STATE_RELPATH = sensorFile.DELTA_STATE_RELPATH || path.join('.mindrian', 'last-room-delta.json');
const DELTA_STATE_SCHEMA_VERSION = (typeof sensorFile.DELTA_STATE_SCHEMA_VERSION === 'number') ? sensorFile.DELTA_STATE_SCHEMA_VERSION : 1;
const ROOM_DELTA_FRESHNESS_MS = (typeof sensorFile.ROOM_DELTA_FRESHNESS_MS === 'number') ? sensorFile.ROOM_DELTA_FRESHNESS_MS : (30 * 60 * 1000);

// writeDeltaState(roomDir, payload, opts) -- writes the fixture file directly
// with fs (this plan's own test double for the plan 355.1-05 writer), then
// optionally overrides mtime with fs.utimesSync.
function writeDeltaState(roomDir, payload, opts) {
  const options = opts || {};
  const abs = path.join(roomDir, DELTA_STATE_RELPATH);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(payload), 'utf8');
  if (typeof options.mtimeMs === 'number') {
    const t = options.mtimeMs / 1000;
    fs.utimesSync(abs, t, t);
  }
  return abs;
}

function freshPayload(runState, classes) {
  return {
    schema_version: DELTA_STATE_SCHEMA_VERSION,
    run_state: runState,
    classes: Array.isArray(classes) ? classes : ['a'],
  };
}

const rooms = [];
function trackedRoom(label, opts) {
  const room = buildDeltaRoom(label, opts);
  rooms.push(room);
  return room;
}

try {
  // ---------------------------------------------------------------------
  // fires: a fresh last-room-delta.json { schema_version 1, run_state
  // 'spawn_failed', classes ['a'] } -> the sensor returns a reach with
  // reach_id 'context_block', posture 'hold', signal 'room_delta', dispatch
  // 'auto-explore', evidence { run_state: 'spawn_failed', classes: 'a' };
  // same for 'deps_missing'.
  // ---------------------------------------------------------------------
  (function test_firesOnSpawnFailed() {
    const room = trackedRoom('fires-spawn-failed');
    writeDeltaState(room.roomDir, freshPayload('spawn_failed', ['a']));
    const reach = sensorFile.sensorRoomDelta({}, {}, { roomDir: room.roomDir });
    assert.ok(reach, 'a fresh spawn_failed delta state must fire the sensor');
    assert.strictEqual(reach.reach_id, 'context_block', 'reach_id must be context_block');
    assert.strictEqual(reach.posture, 'hold', 'posture must be hold');
    assert.strictEqual(reach.signal, 'room_delta', 'signal must be room_delta');
    assert.strictEqual(reach.dispatch, 'auto-explore', 'dispatch must be auto-explore');
    assert.strictEqual(reach.evidence.run_state, 'spawn_failed', 'evidence.run_state must be spawn_failed');
    assert.strictEqual(reach.evidence.classes, 'a', "evidence.classes must be the joined string 'a'");
    ok('fresh run_state \'spawn_failed\' fires: reach_id context_block, posture hold, signal room_delta, dispatch auto-explore, evidence.run_state spawn_failed, evidence.classes \'a\'');
  })();

  (function test_firesOnDepsMissing() {
    const room = trackedRoom('fires-deps-missing');
    writeDeltaState(room.roomDir, freshPayload('deps_missing', ['b', 'a']));
    const reach = sensorFile.sensorRoomDelta({}, {}, { roomDir: room.roomDir });
    assert.ok(reach, 'a fresh deps_missing delta state must fire the sensor');
    assert.strictEqual(reach.evidence.run_state, 'deps_missing', 'evidence.run_state must be deps_missing');
    assert.strictEqual(reach.evidence.classes, 'a|b', 'evidence.classes must be sorted+joined (a before b)');
    ok('fresh run_state \'deps_missing\' also fires the sensor; evidence.classes is the sorted, joined class string');
  })();

  // ---------------------------------------------------------------------
  // fires: run_state 'started', 'running' or 'completed' -> null; a stale
  // file, a future mtime, a corrupt file, schema_version 2, or no file ->
  // null; the sensor call writes no file (fs write spy) and never throws on
  // a non-object ctx.
  // ---------------------------------------------------------------------
  (function test_silentOnNonDegradeStates() {
    for (const runState of ['started', 'running', 'completed']) {
      const room = trackedRoom('silent-' + runState);
      writeDeltaState(room.roomDir, freshPayload(runState, ['a']));
      const reach = sensorFile.sensorRoomDelta({}, {}, { roomDir: room.roomDir });
      assert.strictEqual(reach, null, 'run_state \'' + runState + '\' must NOT fire (SENS-13 carries the card in the normal path)');
    }
    ok('run_state started/running/completed never fire SENS-21 (the honest fallback stays silent on the normal path)');
  })();

  (function test_staleFutureCorruptMissing() {
    const staleRoom = trackedRoom('stale');
    writeDeltaState(staleRoom.roomDir, freshPayload('spawn_failed', ['a']), { mtimeMs: Date.now() - (ROOM_DELTA_FRESHNESS_MS + 60000) });
    assert.strictEqual(sensorFile.sensorRoomDelta({}, {}, { roomDir: staleRoom.roomDir }), null, 'a stale delta file must not fire');

    const futureRoom = trackedRoom('future');
    writeDeltaState(futureRoom.roomDir, freshPayload('spawn_failed', ['a']), { mtimeMs: Date.now() + 60 * 60 * 1000 });
    assert.strictEqual(sensorFile.sensorRoomDelta({}, {}, { roomDir: futureRoom.roomDir }), null, 'a future-mtime delta file must not fire (WR-01 guard)');

    const corruptRoom = trackedRoom('corrupt');
    const abs = path.join(corruptRoom.roomDir, DELTA_STATE_RELPATH);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, '{not json', 'utf8');
    assert.strictEqual(sensorFile.sensorRoomDelta({}, {}, { roomDir: corruptRoom.roomDir }), null, 'a corrupt delta file must not fire');

    const wrongSchemaRoom = trackedRoom('wrong-schema');
    writeDeltaState(wrongSchemaRoom.roomDir, { schema_version: 2, run_state: 'spawn_failed', classes: ['a'] });
    assert.strictEqual(sensorFile.sensorRoomDelta({}, {}, { roomDir: wrongSchemaRoom.roomDir }), null, 'schema_version 2 must not fire');

    const noFileRoom = trackedRoom('no-file');
    assert.strictEqual(sensorFile.sensorRoomDelta({}, {}, { roomDir: noFileRoom.roomDir }), null, 'no delta file must not fire');
    ok('a stale file, a future mtime, a corrupt file, schema_version 2, and no file at all all fail closed to null');
  })();

  (function test_writesNoFileAndNeverThrows() {
    const room = trackedRoom('write-spy');
    writeDeltaState(room.roomDir, freshPayload('spawn_failed', ['a']));
    const before = fs.readdirSync(path.join(room.roomDir, '.mindrian')).sort();
    sensorFile.sensorRoomDelta({}, {}, { roomDir: room.roomDir });
    const after = fs.readdirSync(path.join(room.roomDir, '.mindrian')).sort();
    assert.deepEqual(before, after, 'the sensor call must write NO file (pure detector, never a producer)');

    assert.doesNotThrow(() => sensorFile.sensorRoomDelta({}, {}, 'not-an-object'), 'sensorRoomDelta must never throw on a non-object ctx');
    assert.doesNotThrow(() => sensorFile.sensorRoomDelta({}, {}, null), 'sensorRoomDelta must never throw on a null ctx');
    assert.doesNotThrow(() => sensorFile.sensorRoomDelta({}, {}, {}), 'sensorRoomDelta must never throw on an empty ctx');
    ok('the sensor call writes no file and never throws on a non-object, null, or empty ctx');
  })();

  // ---------------------------------------------------------------------
  // fires through the MCP pull: dispatchCandidateReaches(sessionId, roomDir,
  // {}) returns a reach stamped SENS-21 for the degrade fixture and none for
  // the completed fixture.
  // ---------------------------------------------------------------------
  (function test_firesThroughMcpPull() {
    const degradeRoom = trackedRoom('mcp-degrade');
    writeDeltaState(degradeRoom.roomDir, freshPayload('spawn_failed', ['a']));
    const degradeResult = sensorsMcpTool._internal.dispatchCandidateReaches('sess-3551-mcp', degradeRoom.roomDir, {});
    const degradeReaches = Array.isArray(degradeResult.reaches) ? degradeResult.reaches : degradeResult;
    const stamped = degradeReaches.find((r) => r && r.evidence && r.evidence.sensor_id === 'SENS-21');
    assert.ok(stamped, 'dispatchCandidateReaches must return a reach stamped SENS-21 for the degrade fixture');
    assert.strictEqual(stamped.reach_id, 'context_block', 'the MCP-path SENS-21 reach must ride context_block');

    const completedRoom = trackedRoom('mcp-completed');
    writeDeltaState(completedRoom.roomDir, freshPayload('completed', ['a']));
    const completedResult = sensorsMcpTool._internal.dispatchCandidateReaches('sess-3551-mcp-2', completedRoom.roomDir, {});
    const completedReaches = Array.isArray(completedResult.reaches) ? completedResult.reaches : completedResult;
    const noStamp = completedReaches.find((r) => r && r.evidence && r.evidence.sensor_id === 'SENS-21');
    assert.strictEqual(noStamp, undefined, 'dispatchCandidateReaches must return no SENS-21 reach for the completed fixture');
    ok('the MCP pull (dispatchCandidateReaches) surfaces a SENS-21-stamped reach for the degrade fixture and none for the completed fixture');
  })();

  // ---------------------------------------------------------------------
  // fires through decide(): a decide() call with ctx.roomDir on the degrade
  // fixture includes a SENS-21 reach among its fired sensor reaches (turn
  // count 1: context_block is never turn-gated).
  // ---------------------------------------------------------------------
  (function test_firesThroughDecide() {
    const room = trackedRoom('decide-degrade');
    writeDeltaState(room.roomDir, freshPayload('deps_missing', ['a']));
    const turn = { signals: [], sectionPath: null };
    const context = { quadruple: null, brainAvailable: false, roomDir: room.roomDir };
    const decision = engine.decide(turn, context);
    const fired = (decision.decision_trace && Array.isArray(decision.decision_trace.sensorReaches))
      ? decision.decision_trace.sensorReaches
      : [];
    const stamped = fired.find((r) => r && r.evidence && r.evidence.sensor_id === 'SENS-21');
    assert.ok(stamped, 'decide() must include a SENS-21-stamped reach among its fired sensor reaches on the degrade fixture (turn 1, never turn-gated)');
    ok('decide() with ctx.roomDir on the degrade fixture includes a SENS-21 reach among decision_trace.sensorReaches');
  })();

  // ---------------------------------------------------------------------
  // evidence values are enums only: no value contains the SECRET-3551
  // marker, a slug or a path separator.
  // ---------------------------------------------------------------------
  (function test_evidenceIsEnumOnly() {
    const room = trackedRoom('evidence-clean');
    writeDeltaState(room.roomDir, freshPayload('spawn_failed', ['a', 'b']));
    const reach = sensorFile.sensorRoomDelta({}, {}, { roomDir: room.roomDir });
    assert.ok(reach, 'sanity: the fixture must fire');
    for (const key of Object.keys(reach.evidence)) {
      const v = reach.evidence[key];
      const s = String(v);
      assert.equal(s.indexOf(MARKER_PREFIX), -1, 'evidence.' + key + ' must not contain the ' + MARKER_PREFIX + ' marker: ' + s);
      assert.equal(s.indexOf(room.slug), -1, 'evidence.' + key + ' must not contain the room slug: ' + s);
      assert.equal(s.indexOf('/'), -1, 'evidence.' + key + ' must not contain a path separator: ' + s);
      assert.equal(s.indexOf('\\'), -1, 'evidence.' + key + ' must not contain a path separator: ' + s);
    }
    ok('the sensor evidence bag carries enums only: no SECRET-3551 marker, no slug, no path separator in any evidence value');
  })();
} finally {
  for (const room of rooms) room.cleanup();
}

console.log('');
console.log('PASS test-3551-sensor-fires.cjs (' + checks + ' checks)');

assert.strictEqual(netGuard.attempts(), 0, 'installNetGuard must record zero fetch attempts (Pitfall 16)');
netGuard.restore();
