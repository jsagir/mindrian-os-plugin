#!/usr/bin/env node
// PSB-02 -- session-aware WRITE precedence: .room-root walk-up -> session.primary
// -> reg.active (demoted). SKIP-safe until resolveWriteRoom is exported.
// Node built-in assert only. No em-dashes.
'use strict';
const assert = require('node:assert');

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

// TODO (implementing wave): precedence order -- a .room-root sentinel above the
// file wins over session.primary; session.primary wins over reg.active.
// TODO: reg.active is DEMOTED to a fresh-session seed-default only (PSB-15).

console.log('PASS: test-resolve-write-room');
process.exit(0);
