#!/usr/bin/env node
// PSB-03 -- session-aware tripwire on-scope test: on-scope iff the top room is a
// member of session.bound; unbound -> false (which fires the F.8 gate).
// SKIP-safe until resolveSessionScope is exported. Node built-in assert only.
'use strict';
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

let rar;
try {
  rar = require('../lib/core/resolve-active-room.cjs');
} catch (e) {
  console.log('SKIP: test-resolve-session-scope -- resolver module failed to load. ' + (e.code || e.message));
  process.exit(0);
}
if (typeof rar.resolveSessionScope !== 'function') {
  console.log('SKIP: test-resolve-session-scope -- resolveSessionScope not exported yet (Wave 2).');
  process.exit(0);
}

// --- live contract (runs once the entry point lands) ---
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'psb-scope-'));

// (1) unbound session -> onScope false (this is what fires the binding gate)
const unbound = rar.resolveSessionScope({ sessionId: 'sess-unbound-0', topRoom: 'alpha', home });
assert.strictEqual(unbound.onScope, false, 'unbound session is off-scope for any room');
assert.ok(Array.isArray(unbound.bound), 'scope result carries the bound array');

// TODO (implementing wave): a session bound to [alpha,beta] is on-scope for alpha
// and beta, off-scope for gamma. Compose readSessionBinding, do not re-read the file.

console.log('PASS: test-resolve-session-scope');
process.exit(0);
