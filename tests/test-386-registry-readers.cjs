'use strict';
/*
 * tests/test-386-registry-readers.cjs -- Phase 386 plan 06 (finding B3).
 *
 * Three readers must resolve a room on the registry shape that
 * scripts/room-registry writes (an `active` slug plus a `rooms` object keyed
 * by slug), and still resolve on the legacy array shape:
 *   R1  scripts/hmi-status-command.cjs        resolveActiveRoom
 *   R2  lib/hmi/across-session-memory.cjs     _internal.resolveRoomDirForSlug, isRoomOptOut
 *   R3  scripts/memory-completion-detector.cjs resolveRoomSlug
 *   R4  the legacy array shape, one arm per reader
 *
 * Canon Part 8: fixture rooms in a temporary home only. No room content.
 * Node built-ins only. Prints "ok - <label>" or "FAIL - <label>"; exit 1 on any failure.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'test-386-registry-readers-'));
process.env.MINDRIAN_ROOMS_HOME = home;
process.env.HOME = home;
process.env.USERPROFILE = home;
delete process.env.CLAUDE_ACTIVE_ROOM;

// Fixture room: nested, and its slug differs from its folder basename.
const SLUG = 'fixture-slug';
const REL = path.join('nest', 'fixture-dir');
const roomDir = path.join(home, REL);
fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
fs.writeFileSync(path.join(roomDir, '.mindrian', '.memory-opt-out'), '');

function writeRegistry(obj) {
  fs.mkdirSync(path.join(home, '.rooms'), { recursive: true });
  fs.writeFileSync(path.join(home, '.rooms', 'registry.json'), JSON.stringify(obj));
}
// The shape scripts/room-registry create writes.
function keyed() {
  writeRegistry({
    version: 1,
    active: SLUG,
    rooms: { [SLUG]: { path: REL, status: 'active', venture_name: 'fixture', venture_stage: 'seed' } },
  });
}
// The legacy shape (tests/test-resolve-active-room-canonical.cjs rar.2). The
// entry carries both abs_path and path, the two conventions the old readers used.
function legacy() {
  writeRegistry({
    active_room: SLUG,
    rooms: [{ slug: SLUG, abs_path: roomDir, path: REL, status: 'active' }],
  });
}

const hmi = require(path.join(ROOT, 'scripts', 'hmi-status-command.cjs'));
const asm = require(path.join(ROOT, 'lib', 'hmi', 'across-session-memory.cjs'));
const mcd = require(path.join(ROOT, 'scripts', 'memory-completion-detector.cjs'));

let failed = 0;
function arm(label, fn) {
  try { fn(); console.log('ok - ' + label); }
  catch (e) { failed++; console.log('FAIL - ' + label + ': ' + (e && e.message ? e.message.split('\n')[0] : e)); }
}
const same = (a, b) => path.resolve(a) === path.resolve(b);

keyed();
arm('R1 hmi-status-command resolves the active room on the keyed shape', () => {
  const r = hmi.resolveActiveRoom();
  assert.ok(r, 'resolveActiveRoom returned null');
  assert.strictEqual(r.slug, SLUG, 'slug');
  assert.ok(same(r.abs_path, roomDir), 'abs_path');
});
arm('R2 across-session-memory resolveRoomDirForSlug returns the room dir on the keyed shape', () => {
  const d = asm._internal.resolveRoomDirForSlug(SLUG);
  assert.ok(d, 'resolveRoomDirForSlug returned null');
  assert.ok(same(d, roomDir), 'dir');
});
arm('R2 across-session-memory isRoomOptOut sees the opt-out marker of a nested room on the keyed shape', () => {
  assert.strictEqual(asm.isRoomOptOut(SLUG), true);
});
arm('R3 memory-completion-detector resolveRoomSlug returns the registry slug on the keyed shape', () => {
  assert.strictEqual(mcd.resolveRoomSlug(roomDir), SLUG);
});

legacy();
arm('R4 hmi-status-command still resolves on the legacy array shape', () => {
  const r = hmi.resolveActiveRoom();
  assert.ok(r, 'null');
  assert.strictEqual(r.slug, SLUG);
  assert.ok(same(r.abs_path, roomDir));
});
arm('R4 across-session-memory still resolves on the legacy array shape', () => {
  const d = asm._internal.resolveRoomDirForSlug(SLUG);
  assert.ok(d && same(d, roomDir), 'resolveRoomDirForSlug');
  assert.strictEqual(asm.isRoomOptOut(SLUG), true, 'isRoomOptOut');
});
arm('R4 memory-completion-detector still resolves on the legacy array shape', () => {
  assert.strictEqual(mcd.resolveRoomSlug(roomDir), SLUG);
});

try { fs.rmSync(home, { recursive: true, force: true }); } catch (_) { /* best effort */ }
process.exit(failed ? 1 : 0);
