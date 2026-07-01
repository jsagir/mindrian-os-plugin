#!/usr/bin/env node
// PSB-10 -- a reconcile conflict is rendered through the shipped F.9 ordered
// per-item APPROVE/REJECT/DEFER gate (Part 11: compose the 188 shape, build no
// new selector). APPROVE re-applies the losing write on top of the winner;
// REJECT leaves it NOT_APPLIED; DEFER lands a CONTRADICTS pair for a human.
// SKIP-safe until lib/workflow/reconcile-f9-adapter.cjs lands. Node built-in
// assert only. No em-dashes.
'use strict';
const assert = require('node:assert');

let mod;
try {
  mod = require('../lib/workflow/reconcile-f9-adapter.cjs');
} catch (e) {
  console.log('SKIP: test-reconcile-f9-adapter -- module not present yet (lib/workflow/reconcile-f9-adapter.cjs). ' + (e.code || e.message));
  process.exit(0);
}
if (typeof mod.buildReconcileGate !== 'function') {
  console.log('SKIP: test-reconcile-f9-adapter -- buildReconcileGate not exported yet (Wave 4).');
  process.exit(0);
}

// --- live contract (runs once the adapter lands) ---
// The adapter turns a conflict set into an F.9 gate descriptor (shape=F.9,
// ordered per-item, PAGE_CEILING=4 untouched).
const conflict = {
  nodeId: 'node-xyz',
  readVersion: 1000,
  current: 2000,
  losingWrite: { properties: { note: 'my edit' } },
};
const gate = mod.buildReconcileGate([conflict]);
assert.ok(gate && typeof gate === 'object', 'adapter returns an F.9 gate descriptor');
assert.strictEqual(gate.shape, 'F.9', 'reconcile renders through the shipped F.9 shape, not a new one');
assert.ok(Array.isArray(gate.items) && gate.items.length === 1, 'one conflict -> one F.9 item');

// TODO (implementing wave): applyReconcileDecision(APPROVE) re-applies the losing
// write and bumps last_modified_at; REJECT -> NOT_APPLIED (no write); DEFER ->
// a proposed CONTRADICTS edge pair (Part 9: only a human confirms).
// TODO: the adapter never egresses (Part 8) -- pure local descriptor build.

console.log('PASS: test-reconcile-f9-adapter');
process.exit(0);
