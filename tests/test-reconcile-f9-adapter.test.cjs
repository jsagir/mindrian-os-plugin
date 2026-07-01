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
// The item carries the contested node id + a human-legible claim line.
assert.strictEqual(gate.items[0].item_id, 'node-xyz', 'the F.9 item is keyed on the contested node id');
assert.ok(/held it/.test(gate.items[0].claim), 'the claim line names the co-session clobber');

// --- the three per-item outcomes (Part 11: compose F.9, override only APPROVE) ---

// APPROVE -> yours wins: re-run the held UPDATE. We inject a reapply closure so the
// test needs no live room.db; the adapter must call it and report ok.
let reapplied = 0;
const approveRes = mod.applyReconcileDecision({
  conflict: { nodeId: 'node-xyz' },
  outcome: 'APPROVE',
  db: {},
  held: { nodeId: 'node-xyz', reapply: function () { reapplied += 1; return { ok: true }; } },
});
assert.strictEqual(approveRes.ok, true, 'APPROVE re-applies the held write');
assert.strictEqual(reapplied, 1, 'APPROVE re-runs the held UPDATE exactly once (yours wins)');

// REJECT -> theirs wins: the row is left untouched; the rejection is recorded as
// data (NOT_APPLIED), never a bad edge write.
const rejectRes = mod.applyReconcileDecision({
  conflict: { nodeId: 'node-xyz' },
  outcome: 'REJECT',
  db: {},
  reason: 'theirs is fresher',
});
assert.strictEqual(rejectRes.ok, true, 'REJECT records a structured NOT_APPLIED result');
assert.strictEqual(rejectRes.kind, 'not_applied', 'REJECT -> NOT_APPLIED (rejection is data)');

// DEFER -> both survive. With no distinct rival node (a pure single-row lost
// update) it degrades to a pending competing-claim record (never lose data).
const deferRes = mod.applyReconcileDecision({
  conflict: { nodeId: 'node-xyz' },
  outcome: 'DEFER',
  db: {},
});
assert.strictEqual(deferRes.ok, true, 'DEFER never loses data');
assert.strictEqual(deferRes.kind, 'pending_contradicts', 'DEFER with no rival -> pending competing claim');

// --- async / no-turn context defaults to DEFER (Open Q1) ---
const asyncRun = mod.reconcileViaF9({
  conflicts: [{ nodeId: 'node-xyz', readVersion: 1000, current: 2000 }],
  db: {},
  interactive: false,
});
assert.strictEqual(asyncRun.deferred, true, 'a non-interactive write context auto-DEFERs');
assert.ok(Array.isArray(asyncRun.pending) && asyncRun.pending.length === 1, 'the pending reconcile is queued for the next interactive turn');

console.log('PASS: test-reconcile-f9-adapter');
process.exit(0);
