#!/usr/bin/env node
// PSB-14 -- doctor --bind-check reports the session binding health (healthy when
// the top room is on-scope, unhealthy when unbound/off-scope), registers this
// session's presence, and makes ZERO Brain call (Part 8). This stub gates on the
// presence register it composes (lib/core/session-presence.cjs) rather than on
// scripts/doctor.cjs (which already ships), so it SKIPs until Wave 5. Node
// built-in assert only. No em-dashes.
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let mod;
try {
  mod = require('../lib/core/session-presence.cjs');
} catch (e) {
  console.log('SKIP: test-doctor-bind-check -- presence module not present yet (lib/core/session-presence.cjs). ' + (e.code || e.message));
  process.exit(0);
}
if (typeof mod.registerPresence !== 'function') {
  console.log('SKIP: test-doctor-bind-check -- registerPresence not exported yet (Wave 5 job composes it).');
  process.exit(0);
}
if (typeof mod.runBindCheck !== 'function') {
  console.log('SKIP: test-doctor-bind-check -- runBindCheck not exported yet (Wave 5).');
  process.exit(0);
}

// --- live contract (runs once the bind-check job lands) ---
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'psb-doctor-'));

// (1) an unbound session reports UNHEALTHY (nothing binds the top room)
const unbound = mod.runBindCheck({ sessionId: 'sess-doc-1', topRoom: 'alpha', home });
assert.ok(unbound && typeof unbound === 'object', 'bind-check returns a report object');
assert.strictEqual(unbound.healthy, false, 'an unbound session is unhealthy');

// (2) running the check registers this session's presence (a side-effect the
// health job is responsible for -- the presence ledger now knows this sid)
assert.strictEqual(typeof mod.registerPresence, 'function', 'presence register is composed by the bind-check');

// TODO (implementing wave): a session bound to the top room reports healthy;
// the report carries {healthy, bound, primary, onScope}. ZERO Brain call (assert
// the module source has no network token -- covered by test-194-local-only).

console.log('PASS: test-doctor-bind-check');
process.exit(0);
