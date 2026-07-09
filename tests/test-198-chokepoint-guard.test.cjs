#!/usr/bin/env node
// Phase 198 SPEC-2 (chokepoint half) -- graph writes only through
// navigation.cjs (Canon Part 9, R4: no second selection/write brain). Real
// behavior: graph_write/memory_event route EXCLUSIVELY through
// navigation.writeEdge / navigation.logMemoryEvent, this module never opens
// the graph store directly, and a write attempted with a type outside
// navigation.cjs's declared edge vocabulary (a bypass of the chokepoint's own
// governed taxonomy) is REJECTED before it lands.
//
// Four legs:
//   (1) static source-grep -- graph.cjs requires navigation.cjs, contains
//       zero sqlite/room.db/new Database tokens, and never calls db.prepare
//       directly (the ONLY door into the graph store is navigation.cjs).
//   (2) dynamic spy proof -- graphWrite/memoryEvent delegate the SAME db
//       handle to navigation.writeEdge/logMemoryEvent and never touch
//       db.prepare themselves (isolates "graph.cjs never opens a second
//       surface" from "navigation.cjs's real implementation does the I/O").
//   (3) real end-to-end proof -- a genuine temp room.db, a real graph_write
//       lands a real edge row, a real memory_event lands a real node row.
//   (4) rejection proof -- an edge_type outside navigation.cjs's
//       ALLOWED_EDGE_TYPES vocabulary is REJECTED (ok:false), not silently
//       written -- the chokepoint's governed taxonomy holds even when a
//       caller tries to walk around it with an invented type.
//
// SKIP-safe until lib/mcp/tools/graph.cjs exists. Node built-in assert only.
// No em-dashes.
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let graphTool;
try {
  graphTool = require('../lib/mcp/tools/graph.cjs');
} catch (e) {
  console.log('SKIP: test-198-chokepoint-guard -- lib/mcp/tools/graph.cjs not present yet. ' + (e.code || e.message));
  process.exit(0);
}

const hasWriteApi = typeof graphTool.graphWrite === 'function'
  || typeof graphTool.registerGraphTools === 'function';
if (!hasWriteApi) {
  console.log('SKIP: test-198-chokepoint-guard -- graph.cjs present but write API not exported yet.');
  process.exit(0);
}

const navigation = require('../lib/core/navigation.cjs');
const { ALLOWED_EDGE_TYPES } = require('../lib/core/navigation/edges.cjs');
const roomDb = require('../lib/core/room-db.cjs');

let passed = 0;
function check(label, cond) {
  assert.ok(cond, label);
  passed += 1;
  console.log('  ok - ' + label);
}

(async function main() {
  // -------------------------------------------------------------------------
  // (1) Static source-grep: the ONLY door into the graph store from this file
  // is lib/core/navigation.cjs.
  // -------------------------------------------------------------------------
  const graphFile = path.join(__dirname, '..', 'lib', 'mcp', 'tools', 'graph.cjs');
  const src = fs.readFileSync(graphFile, 'utf8');
  check('graph.cjs requires navigation.cjs', /require\(['"][./]+core\/navigation\.cjs['"]\)/.test(src));
  check('graph.cjs has zero sqlite/room.db/new Database tokens', !/sqlite|room\.db|new Database/i.test(src));
  check('graph.cjs never calls db.prepare directly (all graph-store access delegates through navigation.cjs)', !/\.prepare\(/.test(src));

  // -------------------------------------------------------------------------
  // (2) Dynamic spy proof: graphWrite/memoryEvent delegate the SAME db handle
  // to navigation.writeEdge/logMemoryEvent -- not a second writer -- and never
  // touch db.prepare themselves. A poisoned fakeDb whose .prepare throws
  // proves graph.cjs itself never reaches for it (only the delegated
  // navigation call would legitimately touch it, and that call is mocked out
  // here so any prepare() call can ONLY have come from graph.cjs).
  // -------------------------------------------------------------------------
  const fakeDb = {
    prepareCalls: 0,
    prepare() {
      this.prepareCalls += 1;
      throw new Error('graph.cjs must never call db.prepare directly -- the chokepoint is navigation.cjs');
    },
  };

  const origWriteEdge = navigation.writeEdge;
  let writeEdgeSpyArgs = null;
  navigation.writeEdge = function (db, params) {
    writeEdgeSpyArgs = { db, params };
    return { ok: true, edge_id: 'edge:TEST', type: params.edge_type, source: params.source_id, target: params.target_id };
  };
  try {
    const result = await graphTool.graphWrite(fakeDb, { sourceId: 'node:a', targetId: 'node:b', edgeType: 'INFORMS' });
    check('graph_write delegates the SAME db handle to navigation.writeEdge (chokepoint)', writeEdgeSpyArgs !== null && writeEdgeSpyArgs.db === fakeDb);
    check('graph_write never touches db.prepare directly (chokepoint discipline)', fakeDb.prepareCalls === 0);
    check('graph_write result comes from navigation.writeEdge, not a second writer', result && result.ok === true && result.edge_id === 'edge:TEST');
  } finally {
    navigation.writeEdge = origWriteEdge;
  }

  const origLogMemoryEvent = navigation.logMemoryEvent;
  let logEventSpyArgs = null;
  navigation.logMemoryEvent = function (db, eventType, payload) {
    logEventSpyArgs = { db, eventType, payload };
    return { ok: true, eventId: 'memory_event:TEST' };
  };
  try {
    const result = await graphTool.memoryEvent(fakeDb, { label: 'unit-test-event', payload: { foo: 'bar' } });
    check('memory_event delegates the SAME db handle to navigation.logMemoryEvent (chokepoint)', logEventSpyArgs !== null && logEventSpyArgs.db === fakeDb);
    check("memory_event always logs the closed 'mcp_client_event_logged' type (never a caller-picked internal type)", logEventSpyArgs.eventType === 'mcp_client_event_logged');
    check('memory_event never touches db.prepare directly (chokepoint discipline)', fakeDb.prepareCalls === 0);
    check('memory_event result comes from navigation.logMemoryEvent, not a second writer', result && result.ok === true && result.eventId === 'memory_event:TEST');
  } finally {
    navigation.logMemoryEvent = origLogMemoryEvent;
  }

  // -------------------------------------------------------------------------
  // (3) Real end-to-end proof: a genuine temp room.db, real writes.
  // -------------------------------------------------------------------------
  const tmpRoom = fs.mkdtempSync(path.join(os.tmpdir(), 'psb198-chokepoint-'));
  const bootHandle = roomDb.openRoomDb(tmpRoom); // creates .mindrian/room.db + schema
  roomDb.closeRoomDb(bootHandle);

  const db = navigation.openRoomDbForCaller(tmpRoom);
  check('a real graph-store handle opens through navigation.openRoomDbForCaller once the db exists', db !== null);

  try {
    const writeResult = await graphTool.graphWrite(db, {
      sourceId: 'node:real-a',
      targetId: 'node:real-b',
      edgeType: 'INFORMS',
      properties: { note: 'chokepoint-guard real write' },
    });
    check('a real graph_write through the chokepoint returns ok:true', writeResult && writeResult.ok === true);

    const row = db.prepare('SELECT * FROM edges WHERE source = ? AND target = ? AND type = ?')
      .get('node:real-a', 'node:real-b', 'INFORMS');
    check('the edge actually landed in the graph store (real write, not a mock)', !!row);

    const eventResult = await graphTool.memoryEvent(db, { label: 'chokepoint-guard-real-event', payload: { source: 'test' } });
    check('a real memory_event through the chokepoint returns ok:true', eventResult && eventResult.ok === true);

    const eventRow = db.prepare("SELECT * FROM nodes WHERE type = 'memory_event' AND properties LIKE '%chokepoint-guard-real-event%'").get();
    check('the memory_event node actually landed in the graph store (real write, not a mock)', !!eventRow);

    // -----------------------------------------------------------------------
    // (4) Rejection proof: an edge_type OUTSIDE navigation.cjs's declared
    // vocabulary -- a bypass of the chokepoint's own governed taxonomy -- is
    // REJECTED, not silently written.
    // -----------------------------------------------------------------------
    check('BYPASS_EDGE_TYPE is genuinely outside the chokepoint vocabulary (test fixture sanity)', !ALLOWED_EDGE_TYPES.has('BYPASS_EDGE_TYPE_NOT_IN_VOCAB'));
    const bypassResult = await graphTool.graphWrite(db, {
      sourceId: 'node:real-a',
      targetId: 'node:real-c',
      edgeType: 'BYPASS_EDGE_TYPE_NOT_IN_VOCAB',
    });
    check('a write attempted around the chokepoint\'s governed edge vocabulary is REJECTED', bypassResult && bypassResult.ok === false && bypassResult.reason === 'invalid_edge_type');
    const bypassRow = db.prepare('SELECT * FROM edges WHERE source = ? AND target = ?').get('node:real-a', 'node:real-c');
    check('the rejected bypass edge did NOT land in the graph store', !bypassRow);
  } finally {
    navigation.closeRoomDbForCaller(db);
    try { fs.rmSync(tmpRoom, { recursive: true, force: true }); } catch (_e) { /* best-effort cleanup */ }
  }

  console.log(`PASS: test-198-chokepoint-guard (${passed} assertions -- graph_write/memory_event route exclusively through navigation.cjs; a chokepoint-vocabulary bypass is rejected; a poisoned db handle proves graph.cjs never opens the graph store directly)`);
  process.exit(0);
})().catch((e) => {
  console.error('FAIL: test-198-chokepoint-guard -- ' + (e && e.stack ? e.stack : String(e)));
  process.exit(1);
});
