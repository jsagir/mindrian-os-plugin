'use strict';
/*
 * tests/test-resolve-umbilical-target.cjs -- Phase 139 Plan 01 Task 1.
 *
 * Hermetic (mkdtempSync + MINDRIAN_ROOMS_HOME / cwd opts) coverage for the
 * single umbilical/room target resolver:
 *   - `.umbilical` cord -> source==='umbilical'
 *   - `.room-root` sentinel -> source==='sentinel'
 *   - registry.active -> source==='registry'
 *   - non-room cwd + empty registry -> null (NOT a throw, NOT a fabricated path)
 *   - `.umbilical` with an unresolvable room: -> falls through (no fabrication)
 *   - source-grep tripwire: ZERO network tokens in the module (Canon Part 8)
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { resolveUmbilicalTarget } = require('../lib/core/resolve-umbilical-target.cjs');

let passed = 0;
function ok(name) { passed++; console.log('  ok  ' + name); }

function mkScratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'umbilical-test-'));
}

// Build a hermetic rooms-home with a registry.json + a real room dir on disk.
// Returns { home, roomDir }.
function mkRoomsHome(slug, opts) {
  opts = opts || {};
  const home = mkScratch();
  const roomsDir = path.join(home, '.rooms');
  fs.mkdirSync(roomsDir, { recursive: true });
  const roomDir = path.join(home, slug);
  fs.mkdirSync(roomDir, { recursive: true });
  // mark it as a room (a .room-root sentinel) so it is a believable target
  fs.writeFileSync(path.join(roomDir, '.room-root'), '', 'utf8');
  const registry = {
    version: 3,
    active: opts.active || null,
    rooms: {},
  };
  registry.rooms[slug] = { path: slug, status: opts.status || 'active' };
  fs.writeFileSync(
    path.join(roomsDir, 'registry.json'),
    JSON.stringify(registry, null, 2),
    'utf8'
  );
  return { home, roomDir };
}

// ---------------------------------------------------------------------------
// 1. `.umbilical` cord present pointing at a registered room -> source umbilical
// ---------------------------------------------------------------------------
(function testCordHit() {
  const { home, roomDir } = mkRoomsHome('acme-room');
  // a NON-room project dir with a .umbilical marker pointing at acme-room
  const project = mkScratch();
  fs.writeFileSync(
    path.join(project, '.umbilical'),
    'room: acme-room\nrelation: code\nborn: 2026-06-04\n',
    'utf8'
  );
  const r = resolveUmbilicalTarget({ cwd: project, home });
  assert.ok(r, 'expected a hit');
  assert.strictEqual(r.source, 'umbilical', 'source should be umbilical');
  assert.strictEqual(path.resolve(r.abs_path), path.resolve(roomDir), 'abs_path -> acme-room');
  assert.strictEqual(r.slug, 'acme-room');
  ok('.umbilical cord -> source==="umbilical", correct abs_path');
})();

// ---------------------------------------------------------------------------
// 2. no cord, `.room-root` sentinel above cwd -> source sentinel
// ---------------------------------------------------------------------------
(function testSentinelHit() {
  const { home } = mkRoomsHome('other-room');
  // a standalone room tree with a .room-root sentinel, cwd is a subdir of it
  const roomTree = mkScratch();
  fs.writeFileSync(path.join(roomTree, '.room-root'), '', 'utf8');
  const sub = path.join(roomTree, 'problem-definition');
  fs.mkdirSync(sub, { recursive: true });
  const r = resolveUmbilicalTarget({ cwd: sub, home });
  assert.ok(r, 'expected a hit');
  assert.strictEqual(r.source, 'sentinel', 'source should be sentinel');
  assert.strictEqual(path.resolve(r.abs_path), path.resolve(roomTree), 'abs_path -> room root');
  ok('no cord, .room-root sentinel -> source==="sentinel"');
})();

// ---------------------------------------------------------------------------
// 3. neither cord nor sentinel, registry.active set -> source registry
// ---------------------------------------------------------------------------
(function testRegistryHit() {
  const { home, roomDir } = mkRoomsHome('active-room', { active: 'active-room' });
  // cwd is a plain scratch dir with NO cord and NO sentinel anywhere above it
  const plain = mkScratch();
  const r = resolveUmbilicalTarget({ cwd: plain, home });
  assert.ok(r, 'expected a hit');
  assert.strictEqual(r.source, 'registry', 'source should be registry');
  assert.strictEqual(path.resolve(r.abs_path), path.resolve(roomDir), 'abs_path -> active room');
  assert.strictEqual(r.slug, 'active-room');
  ok('no cord/sentinel, registry.active -> source==="registry"');
})();

// ---------------------------------------------------------------------------
// 4. non-room cwd, empty registry -> null (NOT a throw, NOT a fabricated path)
// ---------------------------------------------------------------------------
(function testNullOnMiss() {
  const home = mkScratch(); // no .rooms/registry.json at all
  const plain = mkScratch();
  let r;
  assert.doesNotThrow(function () { r = resolveUmbilicalTarget({ cwd: plain, home }); });
  assert.strictEqual(r, null, 'must return null, never a fabricated path');
  ok('non-room cwd + empty registry -> null (no throw, no fabrication)');
})();

// ---------------------------------------------------------------------------
// 5. `.umbilical` with an unresolvable room: -> falls through (no fabrication)
// ---------------------------------------------------------------------------
(function testUnresolvableCordFallsThrough() {
  const { home } = mkRoomsHome('real-room'); // registry has real-room only, no active
  const project = mkScratch();
  fs.writeFileSync(
    path.join(project, '.umbilical'),
    'room: ghost-room-that-does-not-exist\nrelation: deck\n',
    'utf8'
  );
  const r = resolveUmbilicalTarget({ cwd: project, home });
  // cord does not resolve, no sentinel, no active -> null. Crucially NOT a
  // fabricated path to ghost-room.
  assert.strictEqual(r, null, 'unresolvable cord must fall through to null, never fabricate');
  ok('.umbilical with unresolvable room: -> falls through (no fabrication)');
})();

// ---------------------------------------------------------------------------
// 6. source-grep tripwire: ZERO network tokens (Canon Part 8 no-egress floor)
// ---------------------------------------------------------------------------
(function testNoEgress() {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'lib', 'core', 'resolve-umbilical-target.cjs'),
    'utf8'
  );
  const forbidden = /fetch\(|https?:|onrender|tavily|brain/i;
  const m = forbidden.exec(src);
  assert.strictEqual(m, null, 'Canon Part 8: no network token allowed; found: ' + (m && m[0]));
  ok('Canon Part 8 source-grep: zero fetch/http/onrender/tavily/brain tokens');
})();

console.log('\nresolve-umbilical-target: ' + passed + ' assertions passed.');
