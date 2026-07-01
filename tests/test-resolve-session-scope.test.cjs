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

const sessionBinding = require('../lib/core/session-binding.cjs');

// (2) a session bound to [alpha, beta] -- on-scope for members, off for gamma.
sessionBinding.writeSessionBinding('sess-bound', { bound: ['alpha', 'beta'], primary: 'alpha' }, { home });
const alphaScope = rar.resolveSessionScope({ sessionId: 'sess-bound', topRoom: 'alpha', home });
assert.strictEqual(alphaScope.onScope, true, 'a bound member is on-scope');
assert.deepStrictEqual(alphaScope.bound.slice().sort(), ['alpha', 'beta'], 'bound array reflects the session set');
const betaScope = rar.resolveSessionScope({ sessionId: 'sess-bound', topRoom: 'beta', home });
assert.strictEqual(betaScope.onScope, true, 'the second bound member is on-scope');
const gammaScope = rar.resolveSessionScope({ sessionId: 'sess-bound', topRoom: 'gamma', home });
assert.strictEqual(gammaScope.onScope, false, 'a non-member is off-scope (arms the F.8 gate)');

// (3) the reserved __no_room__ sentinel is a first-class member: a session that
// chose dev-repo/no-room is on-scope for a no-room write.
sessionBinding.writeSessionBinding('sess-norroom', { bound: ['__no_room__'], primary: null }, { home });
const noroom = rar.resolveSessionScope({ sessionId: 'sess-norroom', topRoom: '__no_room__', home });
assert.strictEqual(noroom.onScope, true, 'the no-room sentinel is on-scope for a no-room write');

// (4) a corrupt binding file -> safe default (onScope:false), never throws.
const badDir = path.join(home, '.rooms', 'sessions');
fs.mkdirSync(badDir, { recursive: true });
fs.writeFileSync(path.join(badDir, 'sess-corrupt.json'), '{ this is not json ');
const corrupt = rar.resolveSessionScope({ sessionId: 'sess-corrupt', topRoom: 'alpha', home });
assert.strictEqual(corrupt.onScope, false, 'a corrupt binding is off-scope (safe default)');
assert.deepStrictEqual(corrupt.bound, [], 'a corrupt binding yields an empty bound array');

console.log('PASS: test-resolve-session-scope');
process.exit(0);
