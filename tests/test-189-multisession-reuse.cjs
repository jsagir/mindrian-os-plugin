'use strict';
/*
 * Phase 189-04 Task 2 -- multi-session reuse proof + runChain HITL safe-halt scan.
 * ============================================================================
 * Proves, WITHOUT writing any new reconcile code, that a governance candidate is
 * NOT a special case: the SAME Phase-194 machinery guards and reconciles it.
 *
 *   (a) a governance-candidate node with a stale readVersion and a live co-session
 *       present -> reconcile-guard.checkLostUpdate reports a conflict (the exact
 *       guard 194-06 shipped applies unmodified to a governance node),
 *   (b) that conflict routed through reconcile-f9-adapter.reconcileViaF9 (imported
 *       unmodified) produces an F.9 gate exactly as for any other lost update,
 *   (c) source-text scan: none of the three governance files this phase created or
 *       modified declares autonomous_safe:true -> runChain (Phase 166) halts on
 *       every governance offer by construction (HITL safe-halt, T-189-04-03).
 *
 * Plain node script, integration-style. Hyphens only, no em-dashes. No emoji.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const guard = require(path.join(REPO, 'lib', 'core', 'navigation', 'reconcile-guard.cjs'));
const adapter = require(path.join(REPO, 'lib', 'workflow', 'reconcile-f9-adapter.cjs'));

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

// Two sessions read the same governance-candidate node at V0. Session A commits
// first (token -> V1). Session B still holds the stale V0.
const V0 = 1000;
const V1 = 2000;
const CAND = 'claim:governed-contested';

// ---- (a) checkLostUpdate flags the governance node's conflict ----------------
// Full SQL fixture path when node:sqlite is available (mirrors 194-06's own
// integration setup: a real nodes row + two live co-sessions). Falls back to the
// pure checkReconcile comparator when node:sqlite is absent, still proving the same
// guard classifies a governance node's conflict.
let sqliteOk = true;
let DatabaseSync = null;
try { ({ DatabaseSync } = require('node:sqlite')); } catch (_e) { sqliteOk = false; }

if (sqliteOk) {
  const os = require('node:os');
  const { applySchema } = require(path.join(__dirname, 'claim-harness', 'build-fixture-room-db.cjs'));
  const presence = require(path.join(REPO, 'lib', 'core', 'session-presence.cjs'));

  const roomsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'hmg-multisession-'));
  const room = 'governed';
  const roomDir = path.join(roomsHome, room);
  fs.mkdirSync(roomDir, { recursive: true });

  const db = new DatabaseSync(':memory:');
  applySchema(db);

  // Seed the governance-candidate node whose CAS token has ALREADY advanced to V1
  // (session A committed first). Session B holds the stale V0.
  db.prepare(
    'INSERT INTO nodes (id, type, properties, source_path, created_by, review_status, created_at, last_seen_at, last_modified_at) ' +
    "VALUES (?, 'claim', '{}', 'test:seed', 'system', 'proposed', ?, ?, ?)"
  ).run(CAND, V0, V1, V1);

  // Two live co-sessions share the room (the presence fast-path arms the guard).
  presence.registerPresence({ sessionId: 'sess-A', room, home: roomsHome });
  presence.registerPresence({ sessionId: 'sess-B', room, home: roomsHome });
  ok('(a) co-session present -> the reconcile guard is armed', presence.hasCoSession({ sessionId: 'sess-B', room, home: roomsHome }) === true);

  // BEFORE any governance writeEdge, the SAME 194-06 guard classifies the write.
  const verdict = guard.checkLostUpdate(db, CAND, V0);
  ok('(a) checkLostUpdate reports a conflict on the governance node', verdict.conflict === true);
  ok('(a) the conflict status is the shipped classifier verdict', verdict.status === 'conflict');
  ok('(a) the guard read the current CAS token (V1)', verdict.currentVersion === V1);

  // The single-session fast-path: no co-session -> the guard never arms (PSB-12
  // zero-cost-when-alone) -- callers pass no readVersion so it is a no-op.
  const solo = guard.checkLostUpdate(db, CAND, null);
  ok('(a) no readVersion -> no-claim (append-safe, zero cost when alone)', solo.conflict === false && solo.status === 'no-claim');

  db.close();
  try { fs.rmSync(roomsHome, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
} else {
  // Pure classifier fallback: the same guard rule applies to a governance node.
  const verdict = guard.checkReconcile({ readVersion: V0, current: V1 });
  ok('(a) pure classifier reports a conflict on the governance node', verdict.status === 'conflict');
  ok('(a) equal versions on a governance node -> pass', guard.checkReconcile({ readVersion: V0, current: V0 }).status === 'pass');
}

// ---- (b) the conflict reconciles through the UNMODIFIED F.9 adapter ----------
// A governance candidate is NOT a special case: reconcileViaF9 renders it exactly
// as it would any other lost update.
const reconciled = adapter.reconcileViaF9({
  conflicts: [{ nodeId: CAND, readVersion: V0, current: V1 }],
  db: null,
  interactive: false,
});
ok('(b) reconcileViaF9 returns ok', reconciled.ok === true);
ok('(b) it builds an F.9 gate for the governance node', reconciled.gate && reconciled.gate.shape === 'F.9');
ok('(b) exactly one reconcile item', reconciled.gate.items.length === 1);
ok('(b) the item names the contested governance node', reconciled.gate.items[0].item_id === CAND);
ok('(b) async/no-turn defers (never loses data, never auto-resolves)', reconciled.deferred === true);

// buildReconcileGate directly is identical for a governance node (no special case).
const directGate = adapter.buildReconcileGate([{ nodeId: CAND, readVersion: V0, current: V1 }]);
ok('(b) buildReconcileGate is F.9 for a governance node too', directGate.shape === 'F.9' && directGate.items.length === 1);

// ---- (c) HITL safe-halt: no governance file declares autonomous_safe:true -----
// runChain (Phase 166) halts on any step that is not explicitly autonomous_safe.
// A plain source-text scan proves, by construction, that none of the three
// governance files marks a memory-governance step safe to auto-apply.
const GOVERNANCE_FILES = [
  path.join(REPO, 'lib', 'workflow', 'memory-governance-closer.cjs'),
  path.join(REPO, 'lib', 'workflow', 'memory-cascade-f9-adapter.cjs'),
  path.join(REPO, 'lib', 'core', 'memory', 'governance-candidate-raiser.cjs'),
];
const AUTON_RE = /autonomous_safe\s*:\s*true/;
for (const f of GOVERNANCE_FILES) {
  const src = fs.readFileSync(f, 'utf8');
  if (AUTON_RE.test(src)) {
    console.error('AUTONOMOUS_SAFE_LEAK ' + path.basename(f) + ' declares autonomous_safe:true (runChain would auto-apply a governance step)');
    process.exit(1);
  }
  ok('(c) ' + path.basename(f) + ' never declares autonomous_safe:true', true);
}

console.log('MULTISESSION_REUSE_OK (' + pass + ' assertions passed)');
process.exit(0);
