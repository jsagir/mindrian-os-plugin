#!/usr/bin/env node
// PSB-06 -- the binding gate/guard FAILS OPEN: on an injected error it degrades
// to the old racy behavior and exits 0, never a lockout. SKIP-safe until
// lib/workflow/session-binding-consumer.cjs lands. Node built-in assert only.
// No em-dashes.
'use strict';
const assert = require('node:assert');

let mod;
try {
  mod = require('../lib/workflow/session-binding-consumer.cjs');
} catch (e) {
  console.log('SKIP: test-binding-gate-degrade -- module not present yet (lib/workflow/session-binding-consumer.cjs). ' + (e.code || e.message));
  process.exit(0);
}
if (typeof mod.runBindingGate !== 'function') {
  console.log('SKIP: test-binding-gate-degrade -- runBindingGate not exported yet (Wave 3).');
  process.exit(0);
}

// --- live contract (runs once the gate lands) ---
// Fail-OPEN doctrine (Canon: every new surface degrades to the old racy behavior
// on error, never a lockout or a leak). Feed the gate a poisoned reader that
// throws, and assert it still returns a degraded PASS instead of propagating.
const poison = () => { throw new Error('injected: session file unreadable'); };
const res = mod.runBindingGate({
  sessionId: 'sess-degrade-1',
  topRoom: 'alpha',
  readSessionBinding: poison,
});
assert.ok(res && typeof res === 'object', 'gate returns a result object even on injected error');
assert.strictEqual(res.degraded, true, 'the gate flags that it degraded');
assert.notStrictEqual(res.blocked, true, 'fail-OPEN: an injected error never blocks');

// TODO (implementing wave): the healthy path (no error) fires F.8 only when
// unbound/off-scope; the degraded path mirrors the pre-194 racy resolveActiveRoom.
// TODO: exit code is 0 in the degraded path (no lockout for the human).

console.log('PASS: test-binding-gate-degrade');
process.exit(0);
