'use strict';
/*
 * Phase 369.25 plan 03 -- the room identity owner API (lib/core/navigation/room-identity.cjs).
 *
 * RED first: this file is committed before the module exists. The module is required lazily inside each arm so a
 * missing module fails every arm by name instead of aborting the file at load.
 *
 * Arms: A1-A15 (RID-04 read with typed not_ready, RID-05 repair, RID-03 projection, RID-08 path normalization),
 * M1 (the reader never opens the write door), M2 (dash guard).
 *
 * Every fixture room lives under an isolated mkdtemp HOME and rooms home (tests/helpers/isolated-home-36925.cjs).
 * Nothing is written under ~/MindrianRooms or ~/.mindrian. Zero network.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');
const MOD_PATH = path.join(ROOT, 'lib', 'core', 'navigation', 'room-identity.cjs');

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

function mod() { return require(MOD_PATH); }
function nav() { return require(path.join(ROOT, 'lib', 'core', 'navigation.cjs')); }
function withRoomTx(db, fn) { return require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-change-log.cjs')).withRoomTx(db, fn); }

function dbPathOf(roomDir) { return path.join(roomDir, '.mindrian', 'room.db'); }
function rootSentinel(roomDir) { return JSON.parse(fs.readFileSync(path.join(roomDir, '.room-root'), 'utf8')); }
function writeSentinel(roomDir, obj) { fs.writeFileSync(path.join(roomDir, '.room-root'), JSON.stringify(obj), 'utf8'); }
function registryPath(iso) { return path.join(iso.roomsHome, '.rooms', 'registry.json'); }
function readRegistry(iso) { return JSON.parse(fs.readFileSync(registryPath(iso), 'utf8')); }

// A room born by birthRoom at HEAD: the legacy shape (seven migration and change-log rows, none naming the room).
function legacyRoom(tag, slug) {
  const iso = H.mkIsolatedHome(tag);
  const s = slug || ('rid-' + tag);
  const b = H.birthFixtureRoom({ iso, slug: s });
  if (!b || !fs.existsSync(dbPathOf(b.roomDir))) throw new Error('fixture birth produced no room.db for ' + s);
  return { iso, roomDir: fs.realpathSync(b.roomDir), slug: s };
}

function identityFor(r, over) {
  return Object.assign({
    room_id: crypto.randomUUID(),
    slug: r.slug,
    canonical_path: r.roomDir,
    parent: 'none',
    depth: '0',
    created_at: '2026-10-06T00:00:00.000Z',
    birth_version: 'test-36925',
  }, over || {});
}

// A ready room: write the seven keys through the module's own writer inside a transaction, then project.
function readyRoom(tag, slug) {
  const r = legacyRoom(tag, slug);
  const ident = identityFor(r);
  const db = nav().openRoomDbForCaller(r.roomDir);
  try { withRoomTx(db, (d) => mod().writeRoomIdentity(d, ident)); } finally { nav().closeRoomDbForCaller(db); }
  mod().projectRoomIdentity(r.roomDir, ident, { roomsHome: r.iso.roomsHome });
  return Object.assign(r, { ident });
}

function identityCount(roomDir) {
  const db = nav().openRoomDbForCaller(roomDir);
  try { return db.prepare("SELECT count(*) AS c FROM identity WHERE key LIKE 'room.%'").get().c; } finally { nav().closeRoomDbForCaller(db); }
}

// ---------------------------------------------------------------------------------------------------------------

arm('A1 born room reads not_ready identity_missing and the tree hash is unchanged', () => {
  const r = legacyRoom('a1');
  const before = H.treeHash(r.roomDir);
  const res = mod().readRoomIdentity(r.roomDir, { roomsHome: r.iso.roomsHome });
  const after = H.treeHash(r.roomDir);
  eq(res.ok, false, 'ok');
  eq(res.state, 'not_ready', 'state');
  eq(res.reason, 'identity_missing', 'reason');
  eq(after, before, 'treeHash changed across the read');
});

arm('A2 room.db removed reads room_db_missing', () => {
  const r = legacyRoom('a2');
  for (const s of ['', '-wal', '-shm']) { try { fs.rmSync(dbPathOf(r.roomDir) + s, { force: true }); } catch (_e) { /* none */ } }
  const res = mod().readRoomIdentity(r.roomDir, { roomsHome: r.iso.roomsHome });
  eq(res.state, 'not_ready', 'state');
  eq(res.reason, 'room_db_missing', 'reason');
});

arm('A3 room.db overwritten with 64 zero bytes reads room_db_unreadable', () => {
  const r = legacyRoom('a3');
  for (const s of ['-wal', '-shm']) { try { fs.rmSync(dbPathOf(r.roomDir) + s, { force: true }); } catch (_e) { /* none */ } }
  fs.writeFileSync(dbPathOf(r.roomDir), Buffer.alloc(64, 0));
  const res = mod().readRoomIdentity(r.roomDir, { roomsHome: r.iso.roomsHome });
  eq(res.state, 'not_ready', 'state');
  eq(res.reason, 'room_db_unreadable', 'reason');
});

arm('A4 three of seven keys present reads identity_incomplete naming the three', () => {
  const r = readyRoom('a4');
  const keys = mod().IDENTITY_KEYS;
  const drop = keys.slice(3);
  const keep = keys.slice(0, 3);
  const db = nav().openRoomDbForCaller(r.roomDir);
  try { for (const k of drop) db.prepare('DELETE FROM identity WHERE key = ?').run(k); } finally { nav().closeRoomDbForCaller(db); }
  const res = mod().readRoomIdentity(r.roomDir, { roomsHome: r.iso.roomsHome });
  eq(res.state, 'not_ready', 'state');
  eq(res.reason, 'identity_incomplete', 'reason');
  eq(res.present_keys.slice().sort(), keep.slice().sort(), 'present_keys');
});

arm('A5 a copied ready room reads identity_path_mismatch naming both paths', () => {
  const r = readyRoom('a5');
  const copyDir = path.join(r.iso.roomsHome, r.slug + '-copy');
  fs.cpSync(r.roomDir, copyDir, { recursive: true });
  const res = mod().readRoomIdentity(copyDir, { roomsHome: r.iso.roomsHome });
  eq(res.state, 'not_ready', 'state');
  eq(res.reason, 'identity_path_mismatch', 'reason');
  const blob = JSON.stringify(res);
  check(blob.indexOf(r.roomDir) !== -1, 'result does not name the stored (original) path ' + r.roomDir);
  check(blob.indexOf(fs.realpathSync(copyDir)) !== -1, 'result does not name the actual (copy) path');
  // and the original still reads ready
  const orig = mod().readRoomIdentity(r.roomDir, { roomsHome: r.iso.roomsHome });
  eq(orig.state, 'ready', 'original room state');
});

arm('A6 a ready room whose registry entry is removed reads registry_missing_room', () => {
  const r = readyRoom('a6');
  const reg = readRegistry(r.iso);
  delete reg.rooms[r.slug];
  fs.writeFileSync(registryPath(r.iso), JSON.stringify(reg, null, 2));
  const res = mod().readRoomIdentity(r.roomDir, { roomsHome: r.iso.roomsHome });
  eq(res.state, 'not_ready', 'state');
  eq(res.reason, 'registry_missing_room', 'reason');
  eq(res.stored && res.stored['room.slug'], r.slug, 'stored room.slug on a not_ready result');
});

arm('A7 repair on a legacy room writes every key with its source and the room reads ready', () => {
  const r = legacyRoom('a7');
  const sent = rootSentinel(r.roomDir);
  const res = mod().repairRoomIdentity(r.roomDir, { approvedBy: 'test-36925', roomsHome: r.iso.roomsHome });
  eq(res.ok, true, 'repair ok (' + JSON.stringify(res.reason || res.readback) + ')');
  eq(res.keys['room.slug'].value, r.slug, 'slug value');
  eq(res.keys['room.slug'].source, 'sentinel', 'slug source');
  eq(res.keys['room.canonical_path'].value, r.roomDir, 'canonical_path value');
  eq(res.keys['room.canonical_path'].source, 'filesystem', 'canonical_path source');
  eq(res.keys['room.birth_version'].value, 'unknown', 'birth_version value');
  eq(res.keys['room.birth_version'].source, 'none', 'birth_version source');
  eq(res.keys['room.room_id'].source, 'minted_by_repair', 'room_id source');
  eq(res.room_id_source, 'minted_by_repair', 'room_id_source');
  check(/^[0-9a-f-]{36}$/.test(res.keys['room.room_id'].value), 'room_id is a uuid');
  eq(res.keys['room.created_at'].value, sent.born, 'created_at is the more precise sentinel born');
  for (const k of mod().IDENTITY_KEYS) check(res.keys[k] && typeof res.keys[k].source === 'string', 'key ' + k + ' records a source');
  const back = mod().readRoomIdentity(r.roomDir, { roomsHome: r.iso.roomsHome });
  eq(back.state, 'ready', 'readback state (' + JSON.stringify(back.reason) + ')');
  check(back.unknown_keys.indexOf('room.birth_version') !== -1, 'unknown_keys names room.birth_version');
});

arm('A8 repair without approvedBy is refused and writes nothing', () => {
  const r = legacyRoom('a8');
  const before = H.treeHash(r.roomDir);
  const res = mod().repairRoomIdentity(r.roomDir, { roomsHome: r.iso.roomsHome });
  eq(res.ok, false, 'ok');
  eq(res.reason, 'no_approval', 'reason');
  const res2 = mod().repairRoomIdentity(r.roomDir, { approvedBy: '', roomsHome: r.iso.roomsHome });
  eq(res2.reason, 'no_approval', 'empty approvedBy reason');
  eq(H.treeHash(r.roomDir), before, 'treeHash changed');
});

arm('A9 repair never overwrites a different existing room_id (identity_conflict)', () => {
  const r = legacyRoom('a9');
  const sent = rootSentinel(r.roomDir);
  const sentinelId = crypto.randomUUID();
  const rowId = crypto.randomUUID();
  writeSentinel(r.roomDir, Object.assign({}, sent, { room_id: sentinelId }));
  const db = nav().openRoomDbForCaller(r.roomDir);
  try { db.prepare("INSERT INTO identity (key, value, updated_at) VALUES ('room.room_id', ?, ?)").run(rowId, new Date().toISOString()); } finally { nav().closeRoomDbForCaller(db); }
  const res = mod().repairRoomIdentity(r.roomDir, { approvedBy: 'test-36925', roomsHome: r.iso.roomsHome });
  eq(res.ok, false, 'ok');
  eq(res.reason, 'identity_conflict', 'reason');
  eq(res.existing_room_id, rowId, 'existing_room_id');
  const db2 = nav().openRoomDbForCaller(r.roomDir);
  let rows;
  try { rows = db2.prepare("SELECT key, value FROM identity WHERE key LIKE 'room.%'").all().map((x) => [x.key, x.value]); } finally { nav().closeRoomDbForCaller(db2); }
  eq(rows, [['room.room_id', rowId]], 'identity rows after the refused repair');
});

arm('A10 repair with createDb on a scaffold-only room creates room.db and reads ready', () => {
  const iso = H.mkIsolatedHome('a10');
  const slug = 'rid-a10';
  const roomDir = path.join(iso.roomsHome, slug);
  fs.mkdirSync(roomDir, { recursive: true });
  require(path.join(ROOT, 'lib', 'core', 'room-skeleton-scaffold.cjs')).scaffoldRoomSkeleton(roomDir, { blueprintFamily: 'venture' });
  writeSentinel(roomDir, { room: slug, active: true, born: '2026-10-05T10:00:00.000Z' });
  cp.execFileSync('bash', [path.join(ROOT, 'scripts', 'room-registry'), iso.roomsHome, 'create', slug, roomDir, slug, 'Pre-Opportunity'],
    { stdio: 'pipe', cwd: ROOT, env: iso.env });
  check(!fs.existsSync(dbPathOf(roomDir)), 'fixture must have no room.db');
  const refused = mod().repairRoomIdentity(roomDir, { approvedBy: 'test-36925', roomsHome: iso.roomsHome });
  eq(refused.reason, 'room_db_missing', 'without createDb the repair says room_db_missing');
  check(!fs.existsSync(dbPathOf(roomDir)), 'a refused repair must not create room.db');
  const res = mod().repairRoomIdentity(roomDir, { approvedBy: 'test-36925', createDb: true, roomsHome: iso.roomsHome });
  eq(res.ok, true, 'repair ok (' + JSON.stringify(res.reason || res.readback) + ')');
  eq(res.created_db, true, 'created_db');
  check(fs.existsSync(dbPathOf(roomDir)), 'room.db exists');
  eq(mod().readRoomIdentity(roomDir, { roomsHome: iso.roomsHome }).state, 'ready', 'readback state');
});

arm('A11 repair with moveAsideUnreadable renames the bad file, keeps its bytes, and reads ready', () => {
  const r = legacyRoom('a11');
  for (const s of ['-wal', '-shm']) { try { fs.rmSync(dbPathOf(r.roomDir) + s, { force: true }); } catch (_e) { /* none */ } }
  const bad = Buffer.alloc(64, 0);
  fs.writeFileSync(dbPathOf(r.roomDir), bad);
  const refused = mod().repairRoomIdentity(r.roomDir, { approvedBy: 'test-36925', roomsHome: r.iso.roomsHome });
  eq(refused.reason, 'room_db_unreadable', 'without moveAsideUnreadable');
  eq(fs.readFileSync(dbPathOf(r.roomDir)).length, 64, 'the unreadable file is untouched by a refused repair');
  const res = mod().repairRoomIdentity(r.roomDir, { approvedBy: 'test-36925', moveAsideUnreadable: true, roomsHome: r.iso.roomsHome });
  eq(res.ok, true, 'repair ok (' + JSON.stringify(res.reason || res.readback) + ')');
  const dir = path.join(r.roomDir, '.mindrian');
  const moved = fs.readdirSync(dir).filter((n) => /^room\.db\.unreadable-/.test(n));
  eq(moved.length, 1, 'one moved-aside file');
  check(!/[:.]/.test(moved[0].slice('room.db.unreadable-'.length).replace(/Z$/, '')), 'stamp has no colon or dot');
  check(fs.readFileSync(path.join(dir, moved[0])).equals(bad), 'moved file keeps its original 64 bytes');
  eq(mod().readRoomIdentity(r.roomDir, { roomsHome: r.iso.roomsHome }).state, 'ready', 'readback state');
});

arm('A12 projectRoomIdentity writes room_id into .room-root (fields kept) and the registry entry', () => {
  const r = legacyRoom('a12');
  const before = rootSentinel(r.roomDir);
  const ident = identityFor(r);
  const out = mod().projectRoomIdentity(r.roomDir, ident, { roomsHome: r.iso.roomsHome });
  eq(out.sentinel, true, 'sentinel projected');
  eq(out.registry, true, 'registry projected (' + JSON.stringify(out.detail) + ')');
  const after = rootSentinel(r.roomDir);
  eq(after.room_id, ident.room_id, 'sentinel room_id');
  for (const k of Object.keys(before)) eq(after[k], before[k], 'sentinel field ' + k + ' kept');
  eq(readRegistry(r.iso).rooms[r.slug].room_id, ident.room_id, 'registry room_id');
  // a slug the registry does not list is reported, never invented
  const other = mod().projectRoomIdentity(r.roomDir, Object.assign({}, ident, { slug: 'not-in-registry' }), { roomsHome: r.iso.roomsHome });
  eq(other.registry, 'skipped:no_entry', 'unlisted slug');
});

arm('A13 normalizeRoomPath: Windows shapes of one folder compare equal, a different folder differs', () => {
  const n = (p) => mod().normalizeRoomPath(p, { platform: 'win32' });
  const a = n('/c/Users/Ann/rooms/x/');
  eq(n('C:\\Users\\Ann\\rooms\\x'), a, 'C:\\ form');
  eq(n('c:/Users/Ann/rooms/x'), a, 'c:/ form');
  eq(n('C:\\Users\\Ann\\rooms\\x\\'), a, 'trailing backslash');
  eq(n('C:\\Users\\\\Ann\\rooms\\x'), a, 'duplicate separator');
  check(n('/c/Users/Ann/rooms/y') !== a, 'a different folder must differ');
  eq(mod().normalizeRoomPath('/home/a/rooms/x/', { platform: 'linux' }), '/home/a/rooms/x', 'posix trailing slash');
  eq(mod().normalizeRoomPath('/', { platform: 'linux' }), '/', 'posix root stays');
});

arm('A14 writeRoomIdentity with an unsafe slug throws inside BEGIN and the rollback leaves 0 room.* keys', () => {
  const r = legacyRoom('a14');
  const db = nav().openRoomDbForCaller(r.roomDir);
  let threw = null;
  try {
    try { withRoomTx(db, (d) => mod().writeRoomIdentity(d, identityFor(r, { slug: '../x' }))); } catch (e) { threw = e; }
  } finally { nav().closeRoomDbForCaller(db); }
  check(threw && /identity_invalid:slug/.test(String(threw.message)), 'expected identity_invalid:slug, got ' + (threw && threw.message));
  eq(identityCount(r.roomDir), 0, 'room.* keys after the rollback');
  // a failure after the first writes (bad insertNode path is not reachable), so also prove a mid-write throw rolls back
  const db2 = nav().openRoomDbForCaller(r.roomDir);
  let threw2 = null;
  try {
    try {
      withRoomTx(db2, (d) => {
        mod().writeRoomIdentity(d, identityFor(r));
        throw new Error('caller failure after a good write');
      });
    } catch (e) { threw2 = e; }
  } finally { nav().closeRoomDbForCaller(db2); }
  check(threw2, 'second write should have thrown');
  eq(identityCount(r.roomDir), 0, 'room.* keys after the caller-failure rollback');
});

arm('A15 door in_place returns the same seven values as the default copy door', () => {
  const r = readyRoom('a15');
  const viaCopy = mod().readRoomIdentity(r.roomDir, { roomsHome: r.iso.roomsHome });
  const viaPlace = mod().readRoomIdentity(r.roomDir, { roomsHome: r.iso.roomsHome, door: 'in_place' });
  eq(viaCopy.state, 'ready', 'copy door state');
  eq(viaPlace.state, 'ready', 'in_place door state');
  for (const f of ['room_id', 'slug', 'canonical_path', 'parent', 'depth', 'created_at', 'birth_version']) {
    eq(viaPlace[f], viaCopy[f], 'field ' + f);
  }
  eq(viaCopy.room_id, r.ident.room_id, 'room_id is the one written');
  eq(viaCopy.room_node, true, 'Room node present');
});

arm('M1 readRoomIdentity never calls the write door (openRoomDb) in its body', () => {
  const src = fs.readFileSync(MOD_PATH, 'utf8');
  const start = src.indexOf('function readRoomIdentity');
  check(start !== -1, 'readRoomIdentity not found in the module');
  const rest = src.slice(start + 1);
  const next = rest.search(/\n(?:async\s+)?function\s|\nmodule\.exports/);
  const body = src.slice(start, next === -1 ? src.length : start + 1 + next);
  check(body.length > 200, 'could not isolate the function body');
  check(!/\bopenRoomDb\s*\(/.test(body), 'body calls openRoomDb');
  check(!/\bopenRoomDbForCaller\s*\(/.test(body), 'body calls openRoomDbForCaller');
  check(/openRoomDbReadOnlyForCaller/.test(body), 'body does not use openRoomDbReadOnlyForCaller');
  check(!/require\('node:sqlite'\)/.test(src), 'module requires node:sqlite');
});

arm('M2 dash guard: no em dash or en dash in the test or the module', () => {
  const hit = H.dashGuard([__filename, MOD_PATH]);
  if (!fs.existsSync(MOD_PATH)) throw new Error('module missing: ' + MOD_PATH);
  eq(hit, [], 'files with a dash');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) console.log('FAILED ARMS: ' + failedNames.join(' | '));
process.exit(failed ? 1 : 0);
