#!/usr/bin/env node
// PSB-02 -- session-aware WRITE precedence: .room-root walk-up -> session.primary
// -> reg.active (demoted). SKIP-safe until resolveWriteRoom is exported.
// Node built-in assert only. No em-dashes.
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let rar;
try {
  rar = require('../lib/core/resolve-active-room.cjs');
} catch (e) {
  console.log('SKIP: test-resolve-write-room -- resolver module failed to load. ' + (e.code || e.message));
  process.exit(0);
}
if (typeof rar.resolveWriteRoom !== 'function') {
  console.log('SKIP: test-resolve-write-room -- resolveWriteRoom not exported yet (Wave 2).');
  process.exit(0);
}

// --- live contract (runs once the entry point lands) ---
// Unbound session with no .room-root and no reg.active -> resolves to null or
// the demoted seed-default, but NEVER throws (the resolver never throws).
const r = rar.resolveWriteRoom({ filePath: '/nonexistent/path/file.md', sessionId: 'sess-nope-0000' });
assert.ok(r === null || typeof r === 'object', 'resolveWriteRoom returns an object or null, never throws');
if (r) {
  assert.ok('source' in r, 'a resolved write room carries a precedence source tag');
  assert.ok(['room-root', 'session.primary', 'reg.active'].includes(r.source), 'source is one of the three precedence legs');
}

// --- precedence contract (PSB-02 / PSB-15) ---
// A clean env: CLAUDE_ACTIVE_ROOM would beat the registry inside resolveActiveRoom,
// so unset it for the hermetic reg.active leg. sessionId home is passed explicitly.
delete process.env.CLAUDE_ACTIVE_ROOM;

const sessionBinding = require('../lib/core/session-binding.cjs');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'psb-write-'));

// Fixture rooms on disk.
const roomAlpha = path.join(home, 'roomAlpha'); // has a .room-root sentinel
const roomBeta = path.join(home, 'roomBeta');   // exists, used as session.primary
const roomGamma = path.join(home, 'roomGamma'); // exists, the registry's reg.active
fs.mkdirSync(roomAlpha, { recursive: true });
fs.mkdirSync(roomBeta, { recursive: true });
fs.mkdirSync(roomGamma, { recursive: true });
fs.writeFileSync(path.join(roomAlpha, '.room-root'), '');

// Registry with reg.active = roomGamma (the DEMOTED seed-default).
const regDir = path.join(home, '.rooms');
fs.mkdirSync(regDir, { recursive: true });
fs.writeFileSync(
  path.join(regDir, 'registry.json'),
  JSON.stringify({ active: 'roomGamma', rooms: { roomGamma: { abs_path: roomGamma } } })
);

// A loose file with no .room-root ancestor (drives legs 2 and 3).
const looseDir = path.join(home, 'loose');
fs.mkdirSync(looseDir, { recursive: true });
const looseFile = path.join(looseDir, 'note.md');

// Case 1 -- .room-root walk-up WINS over session.primary and reg.active.
sessionBinding.writeSessionBinding('sess-1', { bound: ['roomBeta'], primary: 'roomBeta' }, { home });
const c1 = rar.resolveWriteRoom({ filePath: path.join(roomAlpha, 'sub', 'x.md'), sessionId: 'sess-1', home });
assert.strictEqual(c1.source, 'room-root', 'a file under a .room-root resolves to that room root');
assert.strictEqual(c1.abs_path, roomAlpha, 'room-root abs_path is the sentinel dir');
assert.strictEqual(c1.slug, 'roomAlpha', 'room-root slug is the dir basename');

// Case 2 -- no .room-root, session.primary set + room exists -> session.primary.
sessionBinding.writeSessionBinding('sess-2', { bound: ['roomBeta'], primary: 'roomBeta' }, { home });
const c2 = rar.resolveWriteRoom({ filePath: looseFile, sessionId: 'sess-2', home });
assert.strictEqual(c2.source, 'session.primary', 'primary wins over reg.active when the room exists');
assert.strictEqual(c2.slug, 'roomBeta', 'session.primary resolves to the primary slug');

// Case 3 -- session.primary points at a NON-EXISTENT room -> falls through to reg.active.
sessionBinding.writeSessionBinding('sess-3', { bound: ['ghost'], primary: 'ghost' }, { home });
const c3 = rar.resolveWriteRoom({ filePath: looseFile, sessionId: 'sess-3', home });
assert.strictEqual(c3.source, 'reg.active', 'a dead primary falls through, never returns a dead room');
assert.strictEqual(c3.slug, 'roomGamma', 'the demoted seed-default is the registry active');

// Case 4 -- unbound session, no .room-root -> reg.active (the demoted seed-default).
const c4 = rar.resolveWriteRoom({ filePath: looseFile, sessionId: 'sess-unbound', home });
assert.strictEqual(c4.source, 'reg.active', 'an unbound session lands on the demoted reg.active');
assert.strictEqual(c4.slug, 'roomGamma', 'reg.active is reached ONLY as leg 3 (PSB-15)');

// Case 5 -- nothing at all (empty home, unbound) -> null, never a throw.
const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'psb-empty-'));
const c5 = rar.resolveWriteRoom({ filePath: '/nonexistent/x.md', sessionId: 'nobody', home: emptyHome });
assert.strictEqual(c5, null, 'no room-root, no primary, no reg.active -> null');

console.log('PASS: test-resolve-write-room');
process.exit(0);
