'use strict';
/*
 * tests/test-386-check-pending-hooks.cjs -- Phase 386 plan 11 (finding B6).
 *
 *   P1  3 runs of check-pending-ambiguous with source compact and ONE session_id: strike count 1, still ambiguous
 *   P2  3 runs with 3 different session_id values: dismissed on the 3rd run (3-strikes stays)
 *   P3  3 runs with no session_id: old per-run count, dismissed on the 3rd run, never throws
 *   P4  check-pending-breakthrough on a room with no .mindrian/room.db leaves no room.db and emits {continue:true}
 *   P5  check-pending-breakthrough on a room with a room.db and no candidates emits {continue:true} (pin)
 *
 * Fixture rooms with synthetic claims in a temporary home only (Canon Part 8).
 * Each hook runs as a child process with a SessionStart-shaped JSON on stdin.
 * Node built-ins only. Prints "ok - <label>" or "FAIL - <label>"; exit 1 on any failure.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (_e) {
  console.log('SKIP: node:sqlite unavailable');
  process.exit(0);
}

const ROOT = path.resolve(__dirname, '..');
const AMBIG = path.join(ROOT, 'scripts', 'check-pending-ambiguous.cjs');
const BREAK = path.join(ROOT, 'scripts', 'check-pending-breakthrough.cjs');
const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
const roomDb = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));

const made = [];
function tmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(d);
  return d;
}

// A rooms home with a registry (active slug) and one room. withDb: build room.db
// through openRoomDb with 2 synthetic ambiguous claims.
function makeRoom(withDb) {
  const home = tmp('t386-pending-');
  const roomDir = path.join(home, 'fx-room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(home, '.rooms', 'registry.json'),
    JSON.stringify({ version: 1, active: 'fx-room', rooms: { 'fx-room': { path: 'fx-room', status: 'active' } } }));
  if (withDb) {
    const db = roomDb.openRoomDb(roomDir);
    for (const n of ['one', 'two']) {
      navigation.writeClaimNode(db, {
        text: 'synthetic claim ' + n,
        knowledge_type: 'assumption',
        sessionId: 's-fixture',
        sourceSegment: 'seg-' + n,
        disambiguation: 'ambiguous',
      });
    }
    roomDb.closeRoomDb(db);
  }
  return { home, roomDir, dbPath: path.join(roomDir, '.mindrian', 'room.db') };
}

function runHook(script, room, stdinObj) {
  const hh = tmp('t386-hh-');
  const env = Object.assign({}, process.env, { HOME: hh, USERPROFILE: hh, MINDRIAN_ROOMS_HOME: room.home });
  delete env.MINDRIAN_ACTIVE_ROOM_DIR;
  return spawnSync(process.execPath, [script], {
    env, encoding: 'utf8', timeout: 8000,
    input: stdinObj === null ? '' : JSON.stringify(stdinObj),
  });
}

function claimState(room) {
  const d = new DatabaseSync(room.dbPath);
  try {
    return d.prepare("SELECT properties FROM nodes WHERE type='claim'").all()
      .map((r) => JSON.parse(r.properties))
      .map((p) => ({ dis: p.disambiguation, n: Number.isInteger(p.surfacing_count) ? p.surfacing_count : 0 }));
  } finally { d.close(); }
}

let failed = 0;
function arm(label, fn) {
  try { fn(); console.log('ok - ' + label); }
  catch (e) { failed++; console.log('FAIL - ' + label + ': ' + (e && e.message ? e.message.split('\n')[0] : e)); }
}
const lastLine = (s) => String(s || '').trim().split('\n').filter(Boolean).pop() || '';

arm('P1 three compact runs in one session add one strike and keep the claims ambiguous', () => {
  const room = makeRoom(true);
  for (let i = 0; i < 3; i++) {
    const r = runHook(AMBIG, room, { hook_event_name: 'SessionStart', source: 'compact', session_id: 'sess-A' });
    assert.strictEqual(r.status, 0, 'exit status');
  }
  const st = claimState(room);
  assert.ok(st.length >= 2, 'fixture claims');
  for (const c of st) {
    assert.strictEqual(c.dis, 'ambiguous', 'still ambiguous');
    assert.strictEqual(c.n, 1, 'surfacing_count');
  }
});

arm('P2 three different sessions dismiss the claims on the 3rd run', () => {
  const room = makeRoom(true);
  let out;
  ['sess-1', 'sess-2', 'sess-3'].forEach((sid, i) => {
    const r = runHook(AMBIG, room, { hook_event_name: 'SessionStart', source: 'startup', session_id: sid });
    assert.strictEqual(r.status, 0, 'exit status');
    if (i < 2) for (const c of claimState(room)) assert.strictEqual(c.dis, 'ambiguous', 'ambiguous before run 3');
    out = r.stdout;
  });
  for (const c of claimState(room)) assert.strictEqual(c.dis, 'dismissed', 'dismissed on run 3');
  assert.deepStrictEqual(JSON.parse(lastLine(out)), { continue: true });
});

arm('P3 no session_id keeps the per-run count and never throws', () => {
  const room = makeRoom(true);
  for (let i = 0; i < 3; i++) {
    const r = runHook(AMBIG, room, null);
    assert.strictEqual(r.status, 0, 'exit status');
    assert.strictEqual(JSON.parse(lastLine(r.stdout)).continue, true);
  }
  for (const c of claimState(room)) assert.strictEqual(c.dis, 'dismissed', 'dismissed on run 3');
});

arm('P4 the breakthrough hook creates no room.db in a room that has none', () => {
  const room = makeRoom(false);
  assert.strictEqual(fs.existsSync(room.dbPath), false, 'precondition');
  const r = runHook(BREAK, room, { hook_event_name: 'SessionStart', source: 'startup', session_id: 'sess-B' });
  assert.strictEqual(r.status, 0, 'exit status');
  assert.deepStrictEqual(JSON.parse(lastLine(r.stdout)), { continue: true });
  assert.strictEqual(fs.existsSync(room.dbPath), false, 'room.db must not exist after the hook');
});

arm('P5 the breakthrough hook on a room with a room.db and no candidates emits continue only', () => {
  const room = makeRoom(true);
  const r = runHook(BREAK, room, { hook_event_name: 'SessionStart', source: 'startup', session_id: 'sess-C' });
  assert.strictEqual(r.status, 0, 'exit status');
  assert.deepStrictEqual(JSON.parse(lastLine(r.stdout)), { continue: true });
  assert.strictEqual(fs.existsSync(room.dbPath), true, 'room.db still there');
});

for (const d of made) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* best effort */ } }
process.exit(failed ? 1 : 0);
