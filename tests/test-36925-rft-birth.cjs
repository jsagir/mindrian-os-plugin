'use strict';
/*
 * Phase 369.25 plan 07 -- RFT-02 and RFT-08: failure tests 2 and 8 of the phase.
 *
 *   RF2  a registry failure after scaffold: a new directory is removed; a pre-existing directory keeps its files and
 *        is left in the explicit recoverable partial state (identity committed, registry missing the room)
 *   RF8  a retry into that same pre-existing directory reconciles: the room_id already in its room.db is reused,
 *        one Room node, seven identity keys, the user's file untouched, the same section node count as a clean birth
 *   RF8b a pre-existing directory whose room.db names a different slug is refused with identity_conflict, and
 *        RF8c so is one whose room.db names a different canonical path; in both nothing in the directory changes
 *   RF9  dash guard on this file
 *
 * RED first: committed before room-birth.cjs commits the identity. The python3 shim is built in the CHILD env only
 * (the quick l9o idiom): a PATH dir whose python3 answers --version and exits 1 for everything else, so the
 * registry script fails and nothing else about the parent process changes.
 *
 * Every room lives under an isolated mkdtemp HOME and rooms home (tests/helpers/isolated-home-36925.cjs).
 * Nothing is written under ~/MindrianRooms or ~/.mindrian. Zero network.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');
const MARK = 'RFT_JSON=';

// Child mode: one birth in an env-controlled subprocess. `node this-file --child <json-args>`.
if (process.argv[2] === '--child') {
  const a = JSON.parse(process.argv[3] || '{}');
  const ret = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs')).birthRoom({
    slug: a.slug, roomDir: a.roomDir, sessionId: 'test-36925-rft', ventureText: 'A fixture venture for the failure tests',
    approvedBy: 'test-36925', vname: a.slug, vstage: 'Pre-Opportunity',
  });
  process.stdout.write('\n' + MARK + JSON.stringify(ret) + '\n');
  process.exit(0);
}

let passed = 0;
let failed = 0;
const failedNames = [];
function arm(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('PASS: ' + name);
  } catch (e) {
    failed += 1;
    failedNames.push(name);
    console.log('FAIL: ' + name + '\n    ' + String((e && e.message) || e).split('\n').join('\n    '));
  }
}
function check(cond, msg) { if (!cond) throw new Error(msg); }
function eq(a, b, msg) {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  if (x !== y) throw new Error(msg + ' (expected ' + y + ', got ' + x + ')');
}

function identityMod() { return require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-identity.cjs')); }
function nav() { return require(path.join(ROOT, 'lib', 'core', 'navigation.cjs')); }

function dbRows(roomDir, sql) {
  const n = nav();
  const db = n.openRoomDbForCaller(roomDir);
  if (!db) throw new Error('could not open room.db read-only at ' + roomDir);
  try { return db.prepare(sql).all(); } finally { n.closeRoomDbForCaller(db); }
}

// A PATH dir whose python3 answers --version and exits 1 for everything else (registry create fails).
function shimBoom() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '36925-rft-boombin-'));
  const p = path.join(d, 'python3');
  fs.writeFileSync(p, '#!/bin/sh\nif [ "$1" = "--version" ]; then echo "Python 9.9.9"; exit 0; fi\necho boom >&2\nexit 1\n');
  fs.chmodSync(p, 0o755);
  return d;
}

// One birth in a child process under the isolated env; shimDir (optional) is put first on PATH.
function childBirth(iso, slug, roomDir, shimDir) {
  const env = Object.assign({}, iso.env);
  if (shimDir) env.PATH = shimDir + path.delimiter + process.env.PATH;
  const r = cp.spawnSync(process.execPath, [__filename, '--child', JSON.stringify({ slug, roomDir })], { env, encoding: 'utf8', timeout: 120000 });
  const line = String(r.stdout || '').split('\n').filter((l) => l.indexOf(MARK) === 0).pop();
  if (!line) throw new Error('child produced no result (status ' + r.status + '): ' + String(r.stderr || '').slice(-400));
  return JSON.parse(line.slice(MARK.length));
}

function readFileBytes(p) { return fs.readFileSync(p); }

arm('RF2 registry failure: a new directory is removed, no identity claim is left behind', () => {
  const iso = H.mkIsolatedHome('rf2a');
  const roomDir = path.join(iso.roomsHome, 'rf2a-room');
  const shim = shimBoom();
  const r = childBirth(iso, 'rf2a-room', roomDir, shim);
  eq(r.ok, false, 'birth did not fail: ' + JSON.stringify(r));
  check(typeof r.reason === 'string' && r.reason.indexOf('registry_create_failed') === 0, 'reason: ' + JSON.stringify(r.reason));
  check(!fs.existsSync(roomDir), 'the directory birth created is still there');
});

arm('RF2 registry failure over a pre-existing directory: user file untouched, partial state is registry_missing_room', () => {
  const iso = H.mkIsolatedHome('rf2b');
  const roomDir = path.join(iso.roomsHome, 'rf2b-room');
  fs.mkdirSync(roomDir, { recursive: true });
  const keep = path.join(roomDir, 'user-notes.md');
  fs.writeFileSync(keep, 'my own notes, do not touch\n');
  const before = readFileBytes(keep);
  const shim = shimBoom();
  const r = childBirth(iso, 'rf2b-room', roomDir, shim);
  eq(r.ok, false, 'birth did not fail: ' + JSON.stringify(r));
  check(String(r.reason).indexOf('registry_create_failed') === 0, 'reason: ' + JSON.stringify(r.reason));
  eq(r.rolled_back, 'registry_only', 'rolled_back');
  check(Buffer.compare(before, readFileBytes(keep)) === 0, 'user-notes.md changed');
  const id = identityMod().readRoomIdentity(roomDir, { roomsHome: iso.roomsHome });
  eq(id.state, 'not_ready', 'identity state (' + JSON.stringify(id) + ')');
  eq(id.reason, 'registry_missing_room', 'identity reason');
});

arm('RF8 retry into the same pre-existing directory reuses the room_id: one Room node, seven keys, files untouched', () => {
  const iso = H.mkIsolatedHome('rf8');
  const roomDir = path.join(iso.roomsHome, 'rf8-room');
  fs.mkdirSync(roomDir, { recursive: true });
  const keep = path.join(roomDir, 'user-notes.md');
  fs.writeFileSync(keep, 'my own notes, do not touch\n');
  const before = readFileBytes(keep);
  const first = childBirth(iso, 'rf8-room', roomDir, shimBoom());
  eq(first.ok, false, 'first birth did not fail: ' + JSON.stringify(first));
  const priorRows = dbRows(roomDir, "SELECT value FROM identity WHERE key = 'room.room_id'");
  eq(priorRows.length, 1, 'the failed first birth left no room.room_id to reconcile against');
  const priorId = priorRows[0].value;

  const second = childBirth(iso, 'rf8-room', roomDir, null);
  eq(second.ok, true, 'retry did not succeed: ' + JSON.stringify(second));
  eq(second.room_id, priorId, 'retry minted a new room_id instead of reusing the one in room.db');
  eq(dbRows(roomDir, "SELECT COUNT(*) AS n FROM nodes WHERE id = 'room:rf8-room'")[0].n, 1, 'Room node count');
  eq(dbRows(roomDir, "SELECT COUNT(*) AS n FROM identity WHERE key LIKE 'room.%'")[0].n, 7, 'identity key count');
  eq(dbRows(roomDir, "SELECT COUNT(DISTINCT value) AS n FROM identity WHERE key = 'room.room_id'")[0].n, 1, 'distinct room_ids');
  check(Buffer.compare(before, readFileBytes(keep)) === 0, 'user-notes.md changed on retry');

  const clean = H.mkIsolatedHome('rf8c');
  const cleanDir = path.join(clean.roomsHome, 'rf8-clean');
  const c = childBirth(clean, 'rf8-clean', cleanDir, null);
  eq(c.ok, true, 'clean birth: ' + JSON.stringify(c));
  const sec = "SELECT COUNT(*) AS n FROM nodes WHERE type = 'Section'";
  eq(dbRows(roomDir, sec)[0].n, dbRows(cleanDir, sec)[0].n, 'section node count equals a clean birth');
  const id = identityMod().readRoomIdentity(roomDir, { roomsHome: iso.roomsHome });
  eq(id.state, 'ready', 'identity after retry (' + JSON.stringify(id) + ')');
});

arm('RF8b a directory whose room.db names a different slug is refused with identity_conflict and nothing changes', () => {
  const iso = H.mkIsolatedHome('rf8d');
  const a = H.birthFixtureRoom({ iso, slug: 'rf8d-a' });
  check(a && a.ok === true, 'fixture birth: ' + JSON.stringify(a));
  const target = path.join(iso.roomsHome, 'rf8d-b');
  fs.cpSync(a.roomDir, target, { recursive: true });
  const before = H.treeHash(target);
  const r = childBirth(iso, 'rf8d-b', target, null);
  eq(r.ok, false, 'birth did not fail: ' + JSON.stringify(r));
  eq(r.reason, 'identity_conflict', 'reason');
  eq(H.treeHash(target), before, 'tree hash changed');
});

arm('RF8c a directory whose room.db names a different canonical path is refused with identity_conflict and nothing changes', () => {
  const iso = H.mkIsolatedHome('rf8e');
  const a = H.birthFixtureRoom({ iso, slug: 'rf8e-room' });
  check(a && a.ok === true, 'fixture birth: ' + JSON.stringify(a));
  const elsewhere = path.join(iso.home, 'moved', 'rf8e-room');
  fs.mkdirSync(path.dirname(elsewhere), { recursive: true });
  fs.cpSync(a.roomDir, elsewhere, { recursive: true });
  const before = H.treeHash(elsewhere);
  const r = childBirth(iso, 'rf8e-room', elsewhere, null);
  eq(r.ok, false, 'birth did not fail: ' + JSON.stringify(r));
  eq(r.reason, 'identity_conflict', 'reason');
  eq(H.treeHash(elsewhere), before, 'tree hash changed');
});

arm('RF9 dash guard: no em or en dash in this file', () => {
  eq(H.dashGuard([__filename]), [], 'dash characters');
});

console.log('\ntest-36925-rft-birth: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) { console.log('FAILED: ' + failedNames.join(' | ')); process.exit(1); }
process.exit(0);
