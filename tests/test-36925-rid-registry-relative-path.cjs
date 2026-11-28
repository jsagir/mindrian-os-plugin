'use strict';
/*
 * Regression: repairRoomIdentity must match a registry entry whose path is RELATIVE to the rooms home (the form
 * scripts/room-registry writes and resolves: os.path.join(home, path)), or starts with "~", whatever the process
 * cwd is. Before the fix findRegistryEntry resolved entry.path against process.cwd(), so a legacy room with an
 * empty .room-root and no ROOM.md icm_self got slug 'unknown' and could never become ready (debug session
 * room-identity-relative-registry-path).
 *
 * Every fixture lives under a mkdtemp directory. Nothing is written under ~/MindrianRooms or ~/.mindrian. Zero network.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MOD_PATH = path.join(ROOT, 'lib', 'core', 'navigation', 'room-identity.cjs');

let passed = 0;
let failed = 0;
function arm(name, fn) {
  try { fn(); passed += 1; console.log('PASS: ' + name); } catch (e) {
    failed += 1; console.log('FAIL: ' + name + '\n    ' + String((e && e.message) || e));
  }
}
function eq(a, b, msg) {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  if (x !== y) throw new Error(msg + ' (expected ' + y + ', got ' + x + ')');
}

// A legacy room in the shape of a real one: empty .room-root, ROOM.md with a top-level room_id and no icm_self,
// no room.db, a registry entry with a relative path and no depth or parent.
function legacyFixture(tag, entryPath, opts) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'rid-relpath-' + tag + '-')));
  const roomsHome = path.join(base, 'rooms');
  const slug = 'legacy-' + tag;
  const roomDir = path.join(roomsHome, slug);
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '', 'utf8');
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'),
    '---\nroom_id: ' + slug + '\nventure_name: Legacy\ncreated: 2026-08-26T08:09:19Z\n---\n\n# Legacy\n', 'utf8');
  const rooms = {};
  rooms[slug] = { path: entryPath(slug, roomsHome), created: '2026-08-26T08:09:19Z', status: 'parked' };
  if (opts && opts.extra) Object.assign(rooms, opts.extra(roomsHome));
  fs.writeFileSync(path.join(roomsHome, '.rooms', 'registry.json'),
    JSON.stringify({ version: 3, root: '~/MindrianRooms', active: null, rooms: rooms }, null, 2), 'utf8');
  return { base, roomsHome, roomDir, slug };
}

function repairFrom(fx, cwd) {
  const prev = process.cwd();
  process.chdir(cwd);
  try {
    return require(MOD_PATH).repairRoomIdentity(fx.roomDir, {
      approvedBy: 'test', createDb: true, roomsHome: fx.roomsHome, checkRegistry: true,
    });
  } finally { process.chdir(prev); }
}

arm('R1 relative registry path matches with cwd outside the rooms home', () => {
  const fx = legacyFixture('r1', (slug) => slug);
  const r = repairFrom(fx, os.tmpdir());
  eq(r.keys['room.slug'], { value: fx.slug, source: 'registry', corroborated_by: [] }, 'slug from the registry key');
  eq(r.keys['room.created_at'].value, '2026-08-26T08:09:19Z', 'created_at from registry.created');
  eq(r.ok, true, 'readback is ready');
  eq(r.readback.state, 'ready', 'readback state');
});

arm('R2 nested relative registry path matches', () => {
  const fx = legacyFixture('r2', (slug) => slug);
  // move the room one level down and point the registry at the nested relative path
  const nested = path.join(fx.roomsHome, 'parent-x', 'sub-rooms', fx.slug);
  fs.mkdirSync(path.dirname(nested), { recursive: true });
  fs.renameSync(fx.roomDir, nested);
  const regPath = path.join(fx.roomsHome, '.rooms', 'registry.json');
  const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  reg.rooms[fx.slug].path = 'parent-x/sub-rooms/' + fx.slug;
  fs.writeFileSync(regPath, JSON.stringify(reg), 'utf8');
  fx.roomDir = nested;
  const r = repairFrom(fx, os.tmpdir());
  eq(r.keys['room.slug'].value, fx.slug, 'nested slug from the registry key');
});

arm('R3 a "~/" registry path is expanded against HOME', () => {
  const fx = legacyFixture('r3', (slug) => '~/rooms/' + slug);
  const prevHome = process.env.HOME;
  const prevProfile = process.env.USERPROFILE;
  process.env.HOME = fx.base;
  process.env.USERPROFILE = fx.base;
  try {
    const r = repairFrom(fx, os.tmpdir());
    eq(r.keys['room.slug'].value, fx.slug, 'slug from the registry key after ~ expansion');
  } finally {
    if (prevHome === undefined) delete process.env.HOME; else process.env.HOME = prevHome;
    if (prevProfile === undefined) delete process.env.USERPROFILE; else process.env.USERPROFILE = prevProfile;
  }
});

arm('R4 copy guard holds: a relative path naming another folder does not match', () => {
  const fx = legacyFixture('r4', () => 'some-other-folder');
  const r = repairFrom(fx, os.tmpdir());
  eq(r.keys['room.slug'], { value: 'unknown', source: 'none' }, 'no registry adoption for a different folder');
});

arm('R5 the match does not depend on cwd (cwd inside the rooms home gives the same answer)', () => {
  const fx = legacyFixture('r5', (slug) => slug);
  const r = repairFrom(fx, fx.roomsHome);
  eq(r.keys['room.slug'].value, fx.slug, 'same slug with cwd = rooms home');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
