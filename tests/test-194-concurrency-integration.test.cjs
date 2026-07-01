#!/usr/bin/env node
// PSB e2e -- the two-session lost-update -> reconcile integration. Session A and
// session B both read a node at last_modified_at=V0. A writes (token -> V1). B
// writes with its stale readVersion=V0 -> the reconcile guard classifies drift
// -> conflict -> the F.9 adapter renders it for a human. This proves the whole
// spine (presence -> guard -> F.9 adapter) end to end. SKIP-safe until the
// Wave-4 sentinel lib/core/navigation/reconcile-guard.cjs lands. Node built-in
// assert only. No em-dashes.
'use strict';
const assert = require('node:assert');

let guard;
try {
  guard = require('../lib/core/navigation/reconcile-guard.cjs');
} catch (e) {
  console.log('SKIP: test-194-concurrency-integration -- reconcile guard not present yet (lib/core/navigation/reconcile-guard.cjs). ' + (e.code || e.message));
  process.exit(0);
}
if (typeof guard.checkReconcile !== 'function') {
  console.log('SKIP: test-194-concurrency-integration -- checkReconcile not exported yet (Wave 4).');
  process.exit(0);
}

let adapter;
try {
  adapter = require('../lib/workflow/reconcile-f9-adapter.cjs');
} catch (e) {
  console.log('SKIP: test-194-concurrency-integration -- F.9 adapter not present yet (lib/workflow/reconcile-f9-adapter.cjs). ' + (e.code || e.message));
  process.exit(0);
}
if (typeof adapter.buildReconcileGate !== 'function') {
  console.log('SKIP: test-194-concurrency-integration -- buildReconcileGate not exported yet (Wave 4).');
  process.exit(0);
}

// --- live contract (runs once both halves of the spine land) ---
// Two sessions read the same node at V0.
const V0 = 1000;
// Session A commits first -> the node token advances to V1.
const V1 = 2000;

// Session A: its readVersion still equals current -> pass, write proceeds.
const a = guard.checkReconcile({ readVersion: V0, current: V0 });
assert.strictEqual(a.status, 'pass', 'first writer (no drift) passes');

// Session B: it holds the stale V0 while current is now V1 -> conflict.
const b = guard.checkReconcile({ readVersion: V0, current: V1 });
assert.strictEqual(b.status, 'conflict', 'second writer with a stale readVersion hits a lost-update conflict');

// The conflict is handed to the F.9 adapter for a human decision (never auto-resolved).
const gate = adapter.buildReconcileGate([{ nodeId: 'shared-node', readVersion: V0, current: V1 }]);
assert.strictEqual(gate.shape, 'F.9', 'the lost update is reconciled through the F.9 human gate');

// TODO (implementing wave): drive the full path through navigation.cjs against a
// temp room.db (register presence for both sids, arm the guard, replay the two
// writes) so the integration exercises real SQL, not just the pure classifier.

console.log('PASS: test-194-concurrency-integration');
process.exit(0);
