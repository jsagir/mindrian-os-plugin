#!/usr/bin/env node
// PSB-07 -- write-guard set-membership: a write to a room OUTSIDE the session
// bound set is blocked; a write to the reserved no-room sentinel is allowed.
// The guard composes the shipped session binding (Part 11: born WIRED, no new
// selector shape). This stub gates on lib/core/session-binding.cjs (the reader
// the guard composes) -- it never requires scripts/write-scope-check.cjs, which
// is a stdin hook that executes on load. SKIP-safe until the module lands.
// Node built-in assert only. No em-dashes.
'use strict';
const assert = require('node:assert');

let mod;
try {
  mod = require('../lib/core/session-binding.cjs');
} catch (e) {
  console.log('SKIP: test-write-scope-set-membership -- module not present yet (lib/core/session-binding.cjs). ' + (e.code || e.message));
  process.exit(0);
}
if (typeof mod.isRoomInWriteScope !== 'function') {
  console.log('SKIP: test-write-scope-set-membership -- isRoomInWriteScope not exported yet (Wave 3).');
  process.exit(0);
}

// --- live contract (runs once the membership predicate lands) ---
const binding = { bound: ['alpha', 'beta'], primary: 'alpha', sticky: false };

// (1) in-set room -> allowed
assert.strictEqual(mod.isRoomInWriteScope('alpha', binding), true, 'a bound room is in write scope');
assert.strictEqual(mod.isRoomInWriteScope('beta', binding), true, 'every bound room is in write scope');

// (2) off-bound room -> blocked
assert.strictEqual(mod.isRoomInWriteScope('gamma', binding), false, 'an off-bound room is out of write scope');

// TODO (implementing wave): the reserved no-room sentinel ("__no_room__") is
// ALWAYS in scope (a dev-repo/no-room session writes nowhere room-scoped, so the
// guard must not block it -- fail OPEN for the intentional no-room case).
// TODO: an unbound session (empty bound) degrades to the pre-194 allow-all.

console.log('PASS: test-write-scope-set-membership');
process.exit(0);
