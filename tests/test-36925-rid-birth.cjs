'use strict';
/*
 * Phase 369.25 plan 07 -- RID-01, RID-02, RID-03: the owner commits the identity at birth.
 *
 * RED first: this file is committed before room-birth.cjs writes any identity. Arms:
 *   RB1 a top-level birth returns ok:true with room_id; the identity reads ready with all seven values
 *   RB2 a born-wired child records parent = the parent slug and depth = the parent's depth + 1
 *   RB3 _faultInject 'identity' rolls back the whole transaction: 0 room.* keys, no room node, no venture claim
 *   RB4 _faultInject 'identity_readback' returns identity_readback_failed and removes a directory birth created
 *   RB5 projections: .room-root, the registry entry and the root ROOM.md icm_self carry the committed room_id
 *   RB6 the room.db room_id is a uuid and two births mint two different ids
 *   RB7 dash guard on this file
 *
 * Every room lives under an isolated mkdtemp HOME and rooms home (tests/helpers/isolated-home-36925.cjs).
 * Nothing is written under ~/MindrianRooms or ~/.mindrian. Zero network.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const H = require('./helpers/isolated-home-36925.cjs');

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
function readRegistry(iso) { return JSON.parse(fs.readFileSync(path.join(iso.roomsHome, '.rooms', 'registry.json'), 'utf8')); }

// A birth with full option control, in-process, in the isolated home (the helper's birthFixtureRoom shape).
function birth(iso, slug, extra) {
  process.env.HOME = iso.home;
  process.env.USERPROFILE = iso.home;
  process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  delete process.env.MINDRIAN_ACTIVE_SESSION_ID;
  const roomDir = path.join(iso.roomsHome, slug);
  const r = require(path.join(ROOT, 'lib', 'core', 'navigation', 'room-birth.cjs')).birthRoom(Object.assign({
    slug, roomDir, sessionId: 'test-36925-rb', ventureText: 'A fixture venture for the identity birth test',
    approvedBy: 'test-36925', vname: slug, vstage: 'Pre-Opportunity',
  }, extra || {}));
  return { roomDir, slug, r };
}

function dbRows(roomDir, sql, params) {
  const n = nav();
  const db = n.openRoomDbForCaller(roomDir);
  if (!db) throw new Error('could not open room.db read-only at ' + roomDir);
  try { const st = db.prepare(sql); return st.all(...(params || [])); } finally { n.closeRoomDbForCaller(db); }
}

function rootMdSelf(roomDir) {
  const matter = require('gray-matter');
  return matter(fs.readFileSync(path.join(roomDir, 'ROOM.md'), 'utf8')).data.icm_self || null;
}

const REAL_VERSION = require(path.join(ROOT, 'lib', 'core', 'repo-version.cjs')).readRepoVersion().version;

arm('RB1 top-level birth: ok:true with room_id, identity reads ready with the seven values', () => {
  const iso = H.mkIsolatedHome('rb1');
  const b = birth(iso, 'rb1-room');
  check(b.r && b.r.ok === true, 'birth: ' + JSON.stringify(b.r));
  check(typeof b.r.room_id === 'string' && b.r.room_id.length > 0, 'result has no room_id: ' + JSON.stringify(b.r));
  const id = identityMod().readRoomIdentity(b.roomDir, { roomsHome: iso.roomsHome });
  eq(id.state, 'ready', 'identity state (' + JSON.stringify(id) + ')');
  eq(id.room_id, b.r.room_id, 'room_id');
  eq(id.slug, 'rb1-room', 'slug');
  eq(id.canonical_path, fs.realpathSync(b.roomDir), 'canonical_path');
  eq(id.parent, 'none', 'parent');
  eq(id.depth, '0', 'depth');
  const born = JSON.parse(fs.readFileSync(path.join(b.roomDir, '.room-root'), 'utf8')).born;
  eq(id.created_at, born, 'created_at equals the .room-root born value');
  eq(id.birth_version, REAL_VERSION, 'birth_version');
  eq(id.room_node, true, 'room_node');
  eq(id.unknown_keys, [], 'unknown_keys');
});

arm('RB2 born-wired child: parent is the parent slug, depth is the parent depth plus 1', () => {
  const iso = H.mkIsolatedHome('rb2');
  const p = birth(iso, 'rb2-parent');
  check(p.r && p.r.ok === true, 'parent birth: ' + JSON.stringify(p.r));
  const pid = identityMod().readRoomIdentity(p.roomDir, { roomsHome: iso.roomsHome });
  const c = birth(iso, 'rb2-child', {
    parent: 'rb2-parent', parentRoomDir: p.roomDir, bornWired: true, birthGate: { approved: true, canonical_verb: 'Approve' },
  });
  check(c.r && c.r.ok === true, 'child birth: ' + JSON.stringify(c.r));
  const id = identityMod().readRoomIdentity(c.roomDir, { roomsHome: iso.roomsHome });
  eq(id.state, 'ready', 'child identity state (' + JSON.stringify(id) + ')');
  eq(id.parent, 'rb2-parent', 'child parent');
  eq(id.depth, String(Number(pid.depth) + 1), 'child depth');
  check(id.room_id !== pid.room_id, 'child shares the parent room_id');
  eq(id.room_node, true, 'child room_node');
  const nodes = dbRows(c.roomDir, "SELECT COUNT(*) AS n FROM nodes WHERE id = 'room:rb2-child'");
  eq(nodes[0].n, 1, 'one Room node for the child');
});

arm('RB3 _faultInject identity: the whole transaction rolls back (0 keys, no room node, no venture claim)', () => {
  const iso = H.mkIsolatedHome('rb3');
  const b = birth(iso, 'rb3-room', { _faultInject: 'identity' });
  check(b.r && b.r.ok === false, 'birth did not fail: ' + JSON.stringify(b.r));
  eq(b.r.reason, 'birth_transaction_failed', 'reason');
  if (fs.existsSync(path.join(b.roomDir, '.mindrian', 'room.db'))) {
    eq(dbRows(b.roomDir, "SELECT COUNT(*) AS n FROM identity WHERE key LIKE 'room.%'")[0].n, 0, 'room.* keys left behind');
    eq(dbRows(b.roomDir, "SELECT COUNT(*) AS n FROM nodes WHERE id = 'room:rb3-room'")[0].n, 0, 'room node left behind');
    eq(dbRows(b.roomDir, "SELECT COUNT(*) AS n FROM nodes WHERE source_path LIKE '%birth:venture:%'")[0].n, 0, 'venture claim left behind');
    eq(dbRows(b.roomDir, "SELECT COUNT(*) AS n FROM nodes WHERE type = 'Section'")[0].n, 0, 'section nodes left behind');
  }
});

arm('RB4 _faultInject identity_readback: identity_readback_failed, the directory birth created is removed', () => {
  const iso = H.mkIsolatedHome('rb4');
  const b = birth(iso, 'rb4-room', { _faultInject: 'identity_readback' });
  check(b.r && b.r.ok === false, 'birth did not fail: ' + JSON.stringify(b.r));
  eq(b.r.reason, 'identity_readback_failed', 'reason');
  eq(b.r.rolled_back, 'directory_removed', 'rolled_back');
  check(!fs.existsSync(b.roomDir), 'directory left behind: ' + b.roomDir);
  const reg = fs.existsSync(path.join(iso.roomsHome, '.rooms', 'registry.json')) ? readRegistry(iso) : { rooms: {} };
  check(!(reg.rooms && reg.rooms['rb4-room']), 'registry still lists rb4-room');
});

arm('RB5 projections: .room-root, the registry entry and the root ROOM.md icm_self carry the room.db room_id', () => {
  const iso = H.mkIsolatedHome('rb5');
  const b = birth(iso, 'rb5-room');
  check(b.r && b.r.ok === true, 'birth: ' + JSON.stringify(b.r));
  const dbId = dbRows(b.roomDir, "SELECT value FROM identity WHERE key = 'room.room_id'")[0].value;
  eq(dbId, b.r.room_id, 'room.db room_id equals the result room_id');
  eq(JSON.parse(fs.readFileSync(path.join(b.roomDir, '.room-root'), 'utf8')).room_id, dbId, '.room-root room_id');
  eq(readRegistry(iso).rooms['rb5-room'].room_id, dbId, 'registry room_id');
  const self = rootMdSelf(b.roomDir);
  check(self, 'root ROOM.md has no icm_self');
  eq(self.room_id, dbId, 'root ROOM.md icm_self room_id');
  eq(b.r.projections, { sentinel: true, registry: true, room_md: true }, 'result.projections');
});

arm('RB6 the room_id is a uuid and two births mint two different ids', () => {
  const iso = H.mkIsolatedHome('rb6');
  const a = birth(iso, 'rb6-a');
  const b = birth(iso, 'rb6-b');
  check(a.r.ok === true && b.r.ok === true, 'births: ' + JSON.stringify([a.r, b.r]));
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  check(uuid.test(a.r.room_id) && uuid.test(b.r.room_id), 'not uuids: ' + a.r.room_id + ' ' + b.r.room_id);
  check(a.r.room_id !== b.r.room_id, 'two births share one room_id');
});

arm('RB7 dash guard: no em or en dash in this file', () => {
  eq(H.dashGuard([__filename]), [], 'dash characters');
});

console.log('\ntest-36925-rid-birth: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) { console.log('FAILED: ' + failedNames.join(' | ')); process.exit(1); }
process.exit(0);
