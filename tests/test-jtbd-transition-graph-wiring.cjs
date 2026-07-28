'use strict';
// RCA graph-edge-pending-undrained-dead-letter-queue (2026-07-28), Option B
// verification. Proves lib/hmi/across-session-memory.cjs's promoteIfEligible /
// parkJtbd / completeJtbd route into the REAL navigation.logJtbdTransition sink
// (memory_events 'jtbd_transitioned', kind 'promote'/'park'/'complete') instead
// of the retired graph-edge-pending.log dead-letter file.
//
// Mutation-proof by construction: each positive test asserts a real
// jtbd_transitioned row with the expected kind exists in room.db. If the
// wiring at across-session-memory.cjs's 3 call sites is removed or the
// logGraphTransition helper is gutted, the assertion finds zero matching rows
// and the test goes red -- it does not merely check that the old dead-letter
// file is absent (that would pass even with the wiring silently missing).
//
// Hermetic: every test gets its own MINDRIAN_ROOMS_HOME tmpdir with a real
// .rooms/registry.json and a real room.db (via lib/core/room-db.cjs::openRoomDb),
// mirroring tests/test-129-spine-substrate.cjs's makeRoom() idiom.
//
// NO em-dashes in this file (CLAUDE.md HARD RULE).

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const memoryEvents = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'memory-events.cjs'));
const MEM_MODULE_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'across-session-memory.cjs');

let passed = 0;
let failed = 0;

function pass(label) { passed += 1; process.stdout.write('  PASS  ' + label + '\n'); }
function fail(label, err) {
  failed += 1;
  process.stdout.write('  FAIL  ' + label + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}
function assert(cond, label, err) { if (cond) pass(label); else fail(label, err); }

function loadFreshModule() {
  delete require.cache[MEM_MODULE_PATH];
  return require(MEM_MODULE_PATH);
}

// Builds a hermetic MINDRIAN_ROOMS_HOME with one registered room that has a
// REAL room.db (schema initialized via openRoomDb, then closed so the module
// under test opens its own handle, exactly like production).
function makeRegisteredRoom(slug) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'jtbd-graph-wiring-'));
  const roomDir = path.join(home, slug);
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const db = openRoomDb(roomDir);
  closeRoomDb(db);
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.rooms', 'registry.json'),
    JSON.stringify({ version: 1, rooms: [{ slug: slug, path: slug }] })
  );
  return { home, roomDir };
}

function withRegisteredRoom(slug, fn) {
  const { home, roomDir } = makeRegisteredRoom(slug);
  const priorEnv = process.env.MINDRIAN_ROOMS_HOME;
  process.env.MINDRIAN_ROOMS_HOME = home;
  try {
    fn(home, roomDir);
  } finally {
    if (priorEnv === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = priorEnv;
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
  }
}

function readJtbdTransitions(roomDir, kind) {
  const db = openRoomDb(roomDir);
  try {
    const rows = memoryEvents.findRecentChanges(db, 0, { eventType: 'jtbd_transitioned', limit: 100 });
    return rows.filter((r) => r.properties && r.properties.kind === kind);
  } finally {
    closeRoomDb(db);
  }
}

// ---------------------------------------------------------------------------
// Test 1: promoteIfEligible (manual override) writes a real kind:'promote'
// jtbd_transitioned event into the room's own room.db.
// ---------------------------------------------------------------------------
function test1_promoteWritesRealEvent() {
  withRegisteredRoom('wiring-promote-room', (home, roomDir) => {
    const mem = loadFreshModule();
    const result = mem.promoteIfEligible('wiring-promote-room', {
      current: { jtbd: 'prepare-pitch', confidence: 0.9, turn_count: 1, manual_set: true, evidence: [] },
      history: [],
    });
    assert(result && result.action === 'promoted', 'test1: promoteIfEligible returns promoted');
    const rows = readJtbdTransitions(roomDir, 'promote');
    assert(rows.length === 1, 'test1: exactly one kind:promote jtbd_transitioned row', new Error('found ' + rows.length));
    if (rows.length === 1) {
      equal(rows[0].properties.to, 'prepare-pitch');
      equal(rows[0].properties.roomSlug, 'wiring-promote-room');
      equal(rows[0].properties.manual, true);
      pass('test1: row carries to/roomSlug/manual correctly');
    }
  });
}

// ---------------------------------------------------------------------------
// Test 2: parkJtbd writes a real kind:'park' jtbd_transitioned event.
// ---------------------------------------------------------------------------
function test2_parkWritesRealEvent() {
  withRegisteredRoom('wiring-park-room', (home, roomDir) => {
    const mem = loadFreshModule();
    mem.promoteIfEligible('wiring-park-room', {
      current: { jtbd: 'prepare-pitch', confidence: 0.9, turn_count: 5, manual_set: false, evidence: [] },
      history: [],
    });
    const result = mem.parkJtbd('wiring-park-room', 'prepare-pitch', 'replaced by find-bottleneck');
    assert(result && result.action === 'parked', 'test2: parkJtbd returns parked');
    const rows = readJtbdTransitions(roomDir, 'park');
    assert(rows.length === 1, 'test2: exactly one kind:park jtbd_transitioned row', new Error('found ' + rows.length));
    if (rows.length === 1) {
      equal(rows[0].properties.to, 'prepare-pitch');
      equal(rows[0].properties.reason, 'replaced by find-bottleneck');
      pass('test2: row carries to/reason correctly');
    }
  });
}

// ---------------------------------------------------------------------------
// Test 3: completeJtbd writes a real kind:'complete' jtbd_transitioned event.
// ---------------------------------------------------------------------------
function test3_completeWritesRealEvent() {
  withRegisteredRoom('wiring-complete-room', (home, roomDir) => {
    const mem = loadFreshModule();
    mem.promoteIfEligible('wiring-complete-room', {
      current: { jtbd: 'prepare-pitch', confidence: 0.9, turn_count: 5, manual_set: false, evidence: [] },
      history: [],
    });
    const shape = { artifact_glob: 'presentation/*.html', cascade_edge: 'PRODUCES' };
    const result = mem.completeJtbd('wiring-complete-room', 'prepare-pitch', shape, 'presentation/index.html');
    assert(result && result.action === 'completed', 'test3: completeJtbd returns completed');
    const rows = readJtbdTransitions(roomDir, 'complete');
    assert(rows.length === 1, 'test3: exactly one kind:complete jtbd_transitioned row', new Error('found ' + rows.length));
    if (rows.length === 1) {
      equal(rows[0].properties.to, 'prepare-pitch');
      equal(rows[0].properties.completion_evidence, 'presentation/index.html');
      pass('test3: row carries to/completion_evidence correctly');
    }
  });
}

// ---------------------------------------------------------------------------
// Test 4: an unregistered roomSlug degrades gracefully -- the primary
// jtbd-history.json write still happens, no throw, and (since there is no
// resolvable roomDir) no jtbd_transitioned event is attempted.
// ---------------------------------------------------------------------------
function test4_unregisteredSlugGraceful() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'jtbd-graph-wiring-unreg-'));
  const priorEnv = process.env.MINDRIAN_ROOMS_HOME;
  process.env.MINDRIAN_ROOMS_HOME = home;
  try {
    const mem = loadFreshModule();
    let threw = null;
    let result = null;
    try {
      result = mem.promoteIfEligible('never-registered-room', {
        current: { jtbd: 'prepare-pitch', confidence: 0.9, turn_count: 5, manual_set: false, evidence: [] },
        history: [],
      });
    } catch (e) { threw = e; }
    assert(!threw, 'test4: promoteIfEligible does not throw for an unregistered room', threw);
    assert(result && result.action === 'promoted', 'test4: jtbd-history.json write still happens (primary path unaffected)');
  } finally {
    if (priorEnv === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = priorEnv;
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
  }
}

// ---------------------------------------------------------------------------
// Test 5: a registered room with NO room.db yet (Tier 0 cold start) degrades
// gracefully via navigation.logJtbdTransition's own {ok:false,
// reason:'no_room_db'} contract -- no throw, primary write still happens.
// ---------------------------------------------------------------------------
function test5_registeredNoRoomDbGraceful() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'jtbd-graph-wiring-nodb-'));
  const roomDir = path.join(home, 'cold-start-room');
  fs.mkdirSync(roomDir, { recursive: true }); // no .mindrian/room.db
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.rooms', 'registry.json'),
    JSON.stringify({ version: 1, rooms: [{ slug: 'cold-start-room', path: 'cold-start-room' }] })
  );
  const priorEnv = process.env.MINDRIAN_ROOMS_HOME;
  process.env.MINDRIAN_ROOMS_HOME = home;
  try {
    const mem = loadFreshModule();
    let threw = null;
    let result = null;
    try {
      result = mem.promoteIfEligible('cold-start-room', {
        current: { jtbd: 'prepare-pitch', confidence: 0.9, turn_count: 5, manual_set: false, evidence: [] },
        history: [],
      });
    } catch (e) { threw = e; }
    assert(!threw, 'test5: promoteIfEligible does not throw when room has no room.db yet', threw);
    assert(result && result.action === 'promoted', 'test5: jtbd-history.json write still happens with no room.db');
  } finally {
    if (priorEnv === undefined) delete process.env.MINDRIAN_ROOMS_HOME;
    else process.env.MINDRIAN_ROOMS_HOME = priorEnv;
    try { fs.rmSync(home, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
  }
}

// ---------------------------------------------------------------------------
// Test 6: the retired graph-edge-pending.log path is never created by a
// fresh module load's ensureDir (confirms the dead-letter file is fully gone,
// not merely unread). Weak signal on its own (hence tests 1-3 are load-
// bearing), but a useful regression guard against the file quietly coming back.
// ---------------------------------------------------------------------------
function test6_deadLetterFileNeverCreated() {
  withRegisteredRoom('wiring-nofile-room', (home, roomDir) => {
    const mem = loadFreshModule();
    mem.promoteIfEligible('wiring-nofile-room', {
      current: { jtbd: 'prepare-pitch', confidence: 0.9, turn_count: 5, manual_set: false, evidence: [] },
      history: [],
    });
    mem.parkJtbd('wiring-nofile-room', 'prepare-pitch', 'test');
    const legacyPath = path.join(home, '.memory', 'graph-edge-pending.log');
    assert(!fs.existsSync(legacyPath), 'test6: graph-edge-pending.log is never created');
  });
}

const TESTS = [
  test1_promoteWritesRealEvent,
  test2_parkWritesRealEvent,
  test3_completeWritesRealEvent,
  test4_unregisteredSlugGraceful,
  test5_registeredNoRoomDbGraceful,
  test6_deadLetterFileNeverCreated,
];

process.stdout.write('[test-jtbd-transition-graph-wiring] running ' + TESTS.length + ' tests\n');
for (const t of TESTS) {
  try {
    t();
  } catch (e) {
    fail(t.name + ' (uncaught)', e);
  }
}
process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
