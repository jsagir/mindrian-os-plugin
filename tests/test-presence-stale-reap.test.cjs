#!/usr/bin/env node
// PSB-13 -- stale-reap: a presence entry whose pid is dead OR whose mtime is
// older than the reap window (5m = 300000 ms, NOT a frozen-family scalar) is
// reaped; a live pid within the window is NEVER reaped. SKIP-safe until
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
  console.log('SKIP: test-presence-stale-reap -- module not present yet (lib/core/session-presence.cjs). ' + (e.code || e.message));
  process.exit(0);
}
if (typeof mod.reapStalePresence !== 'function' || typeof mod.registerPresence !== 'function') {
  console.log('SKIP: test-presence-stale-reap -- reapStalePresence/registerPresence not exported yet (Wave 5).');
  process.exit(0);
}

// --- live contract (runs once the reaper lands) ---
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'psb-reap-'));

// (1) a live self pid within the window is never reaped
mod.registerPresence({ sessionId: 'sess-live-1', room: 'alpha', pid: process.pid, home });
const reaped = mod.reapStalePresence({ room: 'alpha', now: Date.now(), home });
assert.ok(Array.isArray(reaped), 'reaper returns the list of reaped session ids');
assert.ok(!reaped.includes('sess-live-1'), 'a live pid within the window is never reaped');

// (2) a dead pid is reaped regardless of mtime
mod.registerPresence({ sessionId: 'sess-dead-2', room: 'alpha', pid: 2147483646, home });
const reaped2 = mod.reapStalePresence({ room: 'alpha', now: Date.now(), home });
assert.ok(reaped2.includes('sess-dead-2'), 'a dead pid is reaped');

// TODO (implementing wave): an entry with a (possibly reused) pid but mtime older
// than 300000 ms is reaped by the age rule; reaping is idempotent and LOCAL only.

console.log('PASS: test-presence-stale-reap');
process.exit(0);
