'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 240 Plan 03 -- MEM-01 write-then-read round-trip proof.
 *
 * This file answers MEM-01's write-then-read round-trip leg of SC1: every
 * `current` object it passes to promoteIfEligible comes from a real
 * jtbdState.setCurrent followed by a real jtbdState.getCurrent, never a
 * literal, because tests/test-jtbd-transition-graph-wiring.cjs:94-97
 * hand-fed fields production never produced (turn_count, manual_set) and
 * that is why it stayed green over an empty store (240-RESEARCH.md Finding
 * 1). The ONE deliberate exception is test 5 below, which hand-feeds on
 * purpose to pin an external-caller contract, and says so at the assertion.
 *
 * Harness copied structurally from tests/test-jtbd-transition-graph-
 * wiring.cjs (pass/fail/assert counter, withRegisteredRoom, loadFreshModule
 * for across-session-memory.cjs so ROOMS_HOME() re-resolves per test).
 *
 * Hermeticity: every test runs inside withRegisteredRoom, so
 * MINDRIAN_ROOMS_HOME always points at a throwaway root. Nothing is
 * asserted about the real store. Zero network reach.
 *
 * NO em-dashes in this file (CLAUDE.md HARD RULE). No emoji.
 */

const { ok, equal } = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const jtbdState = require(path.join(REPO_ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));
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

// withRegisteredRoom: mkdtempSync a home, create <home>/<slug>/.mindrian,
// open and close a real room.db, write <home>/.rooms/registry.json, set
// MINDRIAN_ROOMS_HOME, restore the prior value in finally, rmSync the home.
function withRegisteredRoom(slug, fn) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'jtbd-roundtrip-'));
  const roomDir = path.join(home, slug);
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  const db = openRoomDb(roomDir);
  closeRoomDb(db);
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  fs.writeFileSync(
    path.join(home, '.rooms', 'registry.json'),
    JSON.stringify({ version: 1, rooms: [{ slug: slug, path: slug }] })
  );
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

function readMemoryFile(home) {
  try {
    return JSON.parse(fs.readFileSync(path.join(home, '.memory', 'jtbd-history.json'), 'utf8'));
  } catch (_) { return null; }
}

// ---------------------------------------------------------------------------
// Test 1: the manual round-trip is literally true in both directions.
// ---------------------------------------------------------------------------
function test1_manualRoundTripLiteral() {
  withRegisteredRoom('roundtrip-test1', (home, roomDir) => {
    jtbdState.setCurrent(roomDir, {
      jtbd: 'decide-pursue', confidence: 1.0, evidence: ['manual_set'],
      trigger: 'manual_set', manual: true,
    });
    const cur = jtbdState.getCurrent(roomDir);
    const keys = cur ? Object.keys(cur).sort() : [];
    const expectedKeys = ['confidence', 'entered_at', 'evidence', 'expires_at', 'jtbd', 'manual_set', 'turn_count'];
    assert(
      cur && cur.manual_set === true,
      'test1: getCurrent().manual_set === true (observed keys: ' + keys.join(',') + ')'
    );
    assert(
      cur && cur.turn_count === 1,
      'test1: getCurrent().turn_count === 1 (observed keys: ' + keys.join(',') + ')'
    );
    assert(
      cur && !!cur.expires_at,
      'test1: getCurrent().expires_at is truthy (observed keys: ' + keys.join(',') + ')'
    );
    assert(
      expectedKeys.every((k) => keys.includes(k)),
      'test1: Object.keys contains all 7 of jtbd,confidence,entered_at,evidence,expires_at,turn_count,manual_set (observed: ' + keys.join(',') + ')'
    );
  });
}

// ---------------------------------------------------------------------------
// Test 2: that real object promotes at turn_count 1, and the write LANDS in
// the Layer 2 store (not just a returned shape).
// ---------------------------------------------------------------------------
function test2_realObjectPromotesAtTurnCountOne() {
  withRegisteredRoom('roundtrip-test2', (home, roomDir) => {
    jtbdState.setCurrent(roomDir, {
      jtbd: 'decide-pursue', confidence: 1.0, evidence: ['manual_set'],
      trigger: 'manual_set', manual: true,
    });
    const cur = jtbdState.getCurrent(roomDir);
    const mem = loadFreshModule();
    const result = mem.promoteIfEligible('roundtrip-test2', {
      current: cur,
      history: jtbdState.history(roomDir, 50),
    });
    assert(
      result && result.action === 'promoted' && result.jtbd === 'decide-pursue',
      'test2: promoteIfEligible({action:"promoted", jtbd:"decide-pursue"})',
      new Error('got ' + JSON.stringify(result))
    );
    const store = readMemoryFile(home);
    const inFlight = (store && store.rooms && store.rooms['roundtrip-test2'] && store.rooms['roundtrip-test2'].in_flight) || [];
    const landed = inFlight.find((r) => r.jtbd === 'decide-pursue');
    assert(
      !!landed && landed.manual_set === true,
      'test2: Layer 2 store rooms[slug].in_flight has decide-pursue with manual_set true (write landed, not just a returned shape)',
      new Error('in_flight=' + JSON.stringify(inFlight))
    );
  });
}

// ---------------------------------------------------------------------------
// Test 3: an AUTO write does not fake a manual override (false-positive
// guard). Without this, a bug that made everything look manual would be
// indistinguishable from a correct fix.
// ---------------------------------------------------------------------------
function test3_autoWriteDoesNotFakeManual() {
  withRegisteredRoom('roundtrip-test3', (home, roomDir) => {
    jtbdState.setCurrent(roomDir, {
      jtbd: 'decide-pursue', confidence: 0.9, evidence: [],
      trigger: 'user_message', manual: false,
    });
    const cur = jtbdState.getCurrent(roomDir);
    assert(cur && cur.manual_set === false, 'test3: getCurrent().manual_set === false on an auto write');
    assert(cur && cur.expires_at === null, 'test3: getCurrent().expires_at === null on an auto write');
    assert(cur && cur.turn_count === 1, 'test3: getCurrent().turn_count === 1 on an auto write');
    const mem = loadFreshModule();
    const result = mem.promoteIfEligible('roundtrip-test3', { current: cur, history: [] });
    assert(
      result === null,
      'test3: promoteIfEligible returns null (turn_count 1 < NOISE_FLOOR_TURNS 3, manual false)',
      new Error('got ' + JSON.stringify(result))
    );
  });
}

// ---------------------------------------------------------------------------
// Test 4: bumpTurnCount reaches the gate through the same round trip, and
// preserves entered_at / expires_at / history.length exactly.
// ---------------------------------------------------------------------------
function test4_bumpTurnCountReachesGate() {
  withRegisteredRoom('roundtrip-test4', (home, roomDir) => {
    jtbdState.setCurrent(roomDir, {
      jtbd: 'decide-pursue', confidence: 0.9, evidence: [],
      trigger: 'user_message', manual: false,
    });
    const afterSetCurrent = jtbdState.getCurrent(roomDir);
    const histAfterSetCurrent = jtbdState.history(roomDir, 50).length;

    const bump1 = jtbdState.bumpTurnCount(roomDir, 'decide-pursue');
    const bump2 = jtbdState.bumpTurnCount(roomDir, 'decide-pursue');
    assert(bump1 === 2 && bump2 === 3, 'test4: two bumpTurnCount calls return 2 then 3', new Error('bump1=' + bump1 + ' bump2=' + bump2));

    const cur = jtbdState.getCurrent(roomDir);
    assert(cur && cur.turn_count === 3, 'test4: getCurrent().turn_count === 3 after two bumps', new Error('turn_count=' + (cur && cur.turn_count)));
    assert(cur && cur.entered_at === afterSetCurrent.entered_at, 'test4: entered_at byte-identical across two bumps (dwell signal preserved)');
    assert(cur && cur.expires_at === null, 'test4: expires_at still null after two bumps');
    const histAfterBumps = jtbdState.history(roomDir, 50).length;
    assert(histAfterBumps === histAfterSetCurrent, 'test4: history.length UNCHANGED across two bumps (no per-turn row appended)', new Error('before=' + histAfterSetCurrent + ' after=' + histAfterBumps));

    const mem = loadFreshModule();
    const result = mem.promoteIfEligible('roundtrip-test4', { current: cur, history: jtbdState.history(roomDir, 50) });
    assert(
      result && result.action === 'promoted' && result.jtbd === 'decide-pursue',
      'test4: promoteIfEligible promotes on the auto path once turn_count reaches 3 via bumpTurnCount alone (no manual involved)',
      new Error('got ' + JSON.stringify(result))
    );
  });
}

// ---------------------------------------------------------------------------
// Test 5: the DELIBERATE hand-feed that pins the external-caller string
// contract (scripts/jtbd-command.cjs-shaped callers pass trigger:'manual_set'
// with no manual_set field). This object is hand-constructed ON PURPOSE. It
// is NOT a claim about production `current` shape. Its only job is to pin
// the leg 2 string reconciliation so that removing the 'manual_set' string
// comparison from the gate turns something red.
// ---------------------------------------------------------------------------
function test5_deliberateHandFeedPinsStringContract() {
  withRegisteredRoom('roundtrip-test5', (home, roomDir) => {
    const mem = loadFreshModule();
    // HAND-CONSTRUCTED ON PURPOSE (the one deliberate exception in this
    // file): pins the gate's cur.trigger === 'manual_set' leg for callers
    // that pass a current-shaped object with `trigger` but no `manual_set`
    // field, exactly as scripts/jtbd-command.cjs-style callers would.
    const result = mem.promoteIfEligible('roundtrip-test5', {
      current: { jtbd: 'prepare-pitch', confidence: 0.9, turn_count: 1, evidence: [], trigger: 'manual_set' },
      history: [],
    });
    assert(
      result && result.action === 'promoted' && result.jtbd === 'prepare-pitch',
      'test5 (DELIBERATE hand-feed, not a production-shape claim): promotes via the trigger==="manual_set" gate leg',
      new Error('got ' + JSON.stringify(result))
    );
  });
}

// ---------------------------------------------------------------------------
// Test 6: the counter refuses to cross a topic change.
// ---------------------------------------------------------------------------
function test6_counterRefusesTopicChange() {
  withRegisteredRoom('roundtrip-test6', (home, roomDir) => {
    jtbdState.setCurrent(roomDir, {
      jtbd: 'decide-pursue', confidence: 0.9, evidence: [],
      trigger: 'user_message', manual: false,
    });
    const mismatch = jtbdState.bumpTurnCount(roomDir, 'find-bottleneck');
    assert(mismatch === null, 'test6: bumpTurnCount with a different expectedJtbd returns null', new Error('got ' + mismatch));
    const curAfterMismatch = jtbdState.getCurrent(roomDir);
    assert(curAfterMismatch && curAfterMismatch.turn_count === 1, 'test6: turn_count unchanged at 1 after the mismatched bump attempt');

    const match = jtbdState.bumpTurnCount(roomDir, 'decide-pursue');
    assert(match === 2, 'test6: bumpTurnCount with the matching expectedJtbd returns 2', new Error('got ' + match));
  });
}

const TESTS = [
  test1_manualRoundTripLiteral,
  test2_realObjectPromotesAtTurnCountOne,
  test3_autoWriteDoesNotFakeManual,
  test4_bumpTurnCountReachesGate,
  test5_deliberateHandFeedPinsStringContract,
  test6_counterRefusesTopicChange,
];

process.stdout.write('[test-240-jtbd-manual-override-roundtrip] running ' + TESTS.length + ' tests\n');
for (const t of TESTS) {
  try {
    t();
  } catch (e) {
    fail(t.name + ' (uncaught)', e);
  }
}
process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
