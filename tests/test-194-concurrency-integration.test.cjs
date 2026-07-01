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

// --- full SQL spine: presence -> guard -> lost_update -> F.9 (real room.db) ---
// Gated on node:sqlite so a no-sqlite box still passes the pure-classifier legs.
let sqliteOk = true;
let DatabaseSync = null;
try { ({ DatabaseSync } = require('node:sqlite')); } catch (_e) { sqliteOk = false; }

if (sqliteOk) {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const REPO = path.resolve(__dirname, '..');
  const { applySchema } = require(path.join(__dirname, 'claim-harness', 'build-fixture-room-db.cjs'));
  const nav = require(path.join(REPO, 'lib', 'core', 'navigation.cjs'));
  const presence = require(path.join(REPO, 'lib', 'core', 'session-presence.cjs'));

  const roomsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'psb-concur-'));
  const room = 'shared';
  const roomDir = path.join(roomsHome, room);
  fs.mkdirSync(roomDir, { recursive: true });

  const db = new DatabaseSync(':memory:');
  applySchema(db);

  // Seed a claim node whose CAS token starts at V0.
  const NODE = 'claim:contested';
  db.prepare(
    'INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at, last_modified_at) ' +
    "VALUES (?, 'claim', '{}', 'test:seed', 'system', 'proposed', ?, ?, ?)"
  ).run(NODE, V0, V0, V0);

  // Two live co-sessions share the room (each armed against the other).
  presence.registerPresence({ sessionId: 'sess-A', room, home: roomsHome });
  presence.registerPresence({ sessionId: 'sess-B', room, home: roomsHome });
  assert.strictEqual(presence.hasCoSession({ sessionId: 'sess-A', room, home: roomsHome }), true, 'A sees B live -> guard armed');

  // Session A: reads at V0, writes -> no drift -> the token advances past V0.
  const aWrite = nav.persistAbstractionLevel(db, {
    nodeId: NODE, abstraction_level: 'structure',
    readVersion: V0, roomDir, room, home: roomsHome, sessionId: 'sess-A',
  });
  assert.strictEqual(aWrite.ok, true, 'A (no drift) writes through the chokepoint');

  const afterA = db.prepare('SELECT last_modified_at AS t FROM nodes WHERE id = ?').get(NODE);
  assert.ok(afterA.t > V0, 'A bumped the CAS token past V0');

  // Session B: still holds the stale V0 -> the guard catches the lost update.
  const bWrite = nav.persistAbstractionLevel(db, {
    nodeId: NODE, abstraction_level: 'instances',
    readVersion: V0, roomDir, room, home: roomsHome, sessionId: 'sess-B',
  });
  assert.strictEqual(bWrite.ok, false, 'B is blocked from silently clobbering A');
  assert.strictEqual(bWrite.reason, 'lost_update', 'B raises a lost_update, not a silent overwrite');
  assert.strictEqual(bWrite.reconcile.nodeId, NODE, 'the reconcile payload names the contested node');

  // Exactly one RECONCILE, rendered through the shipped F.9 gate.
  const e2eGate = adapter.buildReconcileGate([{
    nodeId: bWrite.reconcile.nodeId,
    readVersion: bWrite.reconcile.readVersion,
    current: bWrite.reconcile.currentVersion,
  }]);
  assert.strictEqual(e2eGate.shape, 'F.9', 'the end-to-end lost update surfaces one F.9 reconcile');
  assert.strictEqual(e2eGate.items.length, 1, 'exactly one RECONCILE item');

  // The single-session fast-path: with B deregistered, A alone pays zero guard cost
  // (a stale readVersion no longer blocks -- the guard never arms).
  presence.deregisterPresence({ sessionId: 'sess-B', room, home: roomsHome });
  const soloWrite = nav.persistAbstractionLevel(db, {
    nodeId: NODE, abstraction_level: 'unsure',
    readVersion: V0, roomDir, room, home: roomsHome, sessionId: 'sess-A',
  });
  assert.strictEqual(soloWrite.ok, true, 'no co-session -> fast-path -> the guard never arms (PSB-12)');

  db.close();
  try { fs.rmSync(roomsHome, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  console.log('PASS: test-194-concurrency-integration (pure + full SQL spine)');
} else {
  console.log('PASS: test-194-concurrency-integration (pure classifier; node:sqlite absent so SQL spine skipped)');
}
process.exit(0);
