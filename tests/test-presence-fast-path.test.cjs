#!/usr/bin/env node
// PSB-11/12 -- presence register + fast-path: when no OTHER live session shares
// the room, the reconcile guard is SKIPPED (fast-path, zero overhead); when a
// co-session is live, the guard is ARMED. SKIP-safe until
// lib/core/session-presence.cjs lands. Node built-in assert only. No em-dashes.
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let mod;
try {
  mod = require('../lib/core/session-presence.cjs');
} catch (e) {
  console.log('SKIP: test-presence-fast-path -- module not present yet (lib/core/session-presence.cjs). ' + (e.code || e.message));
  process.exit(0);
}
if (typeof mod.registerPresence !== 'function' || typeof mod.hasCoSession !== 'function') {
  console.log('SKIP: test-presence-fast-path -- registerPresence/hasCoSession not exported yet (Wave 1).');
  process.exit(0);
}

// --- live contract (runs once the presence ledger lands) ---
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'psb-presence-'));

// (1) a solo session in a room has no co-session -> fast-path (guard skipped)
mod.registerPresence({ sessionId: 'sess-solo-1', room: 'alpha', home });
assert.strictEqual(mod.hasCoSession({ sessionId: 'sess-solo-1', room: 'alpha', home }), false, 'a solo session sees no co-session -> fast-path');

// (2) a second live session in the same room -> co-session present -> guard armed
mod.registerPresence({ sessionId: 'sess-other-2', room: 'alpha', home });
assert.strictEqual(mod.hasCoSession({ sessionId: 'sess-solo-1', room: 'alpha', home }), true, 'a live co-session arms the reconcile guard');

// TODO (implementing wave): the register is LOCAL only (Part 8) -- a file/ledger
// under the room, no Brain call. hasCoSession excludes the caller's own sid.
// TODO: presence in a DIFFERENT room does not arm the guard for this room.

console.log('PASS: test-presence-fast-path');
process.exit(0);
