#!/usr/bin/env node
// PSB-08/09 -- the optimistic lost-update reconcile guard at the navigation
// chokepoint. Cases: drift (readVersion != current last_modified_at) -> conflict;
// equal -> pass (write proceeds); NULL current -> no-claim (fresh node, allow);
// append-only content -> no-op (nothing to reconcile). SKIP-safe until
// lib/core/navigation/reconcile-guard.cjs lands. Node built-in assert only.
// No em-dashes.
'use strict';
const assert = require('node:assert');

let mod;
try {
  mod = require('../lib/core/navigation/reconcile-guard.cjs');
} catch (e) {
  console.log('SKIP: test-reconcile-guard -- module not present yet (lib/core/navigation/reconcile-guard.cjs). ' + (e.code || e.message));
  process.exit(0);
}
if (typeof mod.checkReconcile !== 'function') {
  console.log('SKIP: test-reconcile-guard -- checkReconcile not exported yet (Wave 4).');
  process.exit(0);
}

// --- live contract (runs once the guard lands) ---
// The guard compares a caller-held readVersion against the node's current
// last_modified_at CAS token and classifies the write.

// (1) equal -> pass (no drift since read)
const pass = mod.checkReconcile({ readVersion: 1000, current: 1000 });
assert.strictEqual(pass.status, 'pass', 'equal versions -> pass');

// (2) drift -> conflict (someone bumped last_modified_at since our read)
const drift = mod.checkReconcile({ readVersion: 1000, current: 2000 });
assert.strictEqual(drift.status, 'conflict', 'a bumped token since read -> conflict');

// (3) NULL current -> no-claim (fresh node with no prior token; nothing to lose)
const fresh = mod.checkReconcile({ readVersion: null, current: null });
assert.strictEqual(fresh.status, 'no-claim', 'a NULL current token cannot be in conflict');

// TODO (implementing wave): append-only content (a pure edge/relationship add
// that does not mutate properties/review_status) -> no-op, the guard is skipped.
// TODO: a conflict result carries enough context (nodeId, readVersion, current)
// to feed the F.9 reconcile adapter (PSB-10). Fail OPEN on a malformed input.

console.log('PASS: test-reconcile-guard');
process.exit(0);
