'use strict';
// Phase 181-01 Task 1 (SEC-01) -- EvidenceClaim NON_PROMOTABLE structural-floor test.
//
// Canon Part 8 / Part 9: the node type that carries external web bytes
// (EvidenceClaim) must NEVER harden into trusted memory. Part 9 role 5 ("the human
// confirms truth") lets a human promote a truth-claim node, but an EvidenceClaim is
// the STRONGER bar: agent OR human attributed, to ANY non-proposed status, every
// promotion is structurally REJECTED. This is the DEDICATED NON_PROMOTABLE guard in
// promoteNodeStatus, NOT a TRUTH_CLAIM_TYPES member (D-181-01: adding EvidenceClaim
// to that frozen set is canon-blocked by the entry-31 self-binding clause, so a
// dedicated guard is minted instead).
//
// This is a FLOOR test mirroring tests/test-synthetic-expert-nodetype-floor.cjs
// (openRoomDb chokepoint, seedNode helper, check() runner, NO em-dashes, NO .size
// assertions). It pins, and BEFORE the guard exists fails on Tests A-D + the
// NON_PROMOTABLE membership assertion.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { TRUTH_CLAIM_TYPES, NON_PROMOTABLE, promoteNodeStatus, AGENT_IDENTITIES } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'transitions.cjs')
);
const { openRoomDb, closeRoomDb } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs')
);

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

function makeRoom() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-181-nonpromotable-'));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  const db = openRoomDb(tmp);
  return { tmp, db };
}

function cleanup(tmp, db) {
  try { if (db) closeRoomDb(db); } catch (_) { /* ignore */ }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) { /* ignore */ }
}

function seedNode(db, id, type, reviewStatus) {
  const nowMs = Date.now();
  db.prepare(
    "INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
    "VALUES (?, ?, '{}', 'fixture', 'larry', NULL, ?, ?, ?)"
  ).run(id, type, reviewStatus, nowMs, nowMs);
}

function reviewStatusOf(db, id) {
  const row = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(id);
  return row ? row.review_status : null;
}

function blockedEventCount(db, targetNodeId) {
  const row = db.prepare(
    "SELECT COUNT(*) AS c FROM nodes " +
    "WHERE type = 'memory_event' " +
    "AND json_extract(properties, '$.event_type') = 'evidence_claim_promotion_blocked' " +
    "AND json_extract(properties, '$.target_node_id') = ? " +
    "AND created_by = 'system'"
  ).get(targetNodeId);
  return row ? row.c : 0;
}

console.log('test-evidenceclaim-nonpromotable-floor');

// (membership) NON_PROMOTABLE exists, is a frozen Set, and bars EvidenceClaim.
check('NON_PROMOTABLE is a frozen Set containing EvidenceClaim', () => {
  assert.equal(NON_PROMOTABLE instanceof Set, true, 'NON_PROMOTABLE must be a Set');
  assert.equal(Object.isFrozen(NON_PROMOTABLE), true, 'NON_PROMOTABLE must be frozen');
  assert.equal(NON_PROMOTABLE.has('EvidenceClaim'), true, 'NON_PROMOTABLE must bar EvidenceClaim');
});

// (Test A) agent-attributed confirm of an EvidenceClaim is REJECTED; stays proposed.
check('Test A: agent-attributed EvidenceClaim confirm is rejected (stays proposed)', () => {
  const { tmp, db } = makeRoom();
  try {
    const agent = [...AGENT_IDENTITIES][0]; // an AGENT_IDENTITIES member (e.g. larry)
    seedNode(db, 'EvidenceClaim:sec01:a', 'EvidenceClaim', 'proposed');
    const r = promoteNodeStatus(db, 'EvidenceClaim:sec01:a', 'proposed', 'confirmed', agent);
    assert.equal(r.ok, false, `agent promotion must be rejected, got ${JSON.stringify(r)}`);
    assert.equal(r.reason, 'evidence_claim_non_promotable', 'rejection names the non-promotable guard');
    assert.equal(reviewStatusOf(db, 'EvidenceClaim:sec01:a'), 'proposed', 'node must stay proposed');
  } finally {
    cleanup(tmp, db);
  }
});

// (Test B) human-attributed confirm of an EvidenceClaim is REJECTED; stays proposed.
// The stronger-than-truth-claim bar: a human MAY confirm a truth-claim node, but
// NEVER an EvidenceClaim.
check('Test B: human-attributed EvidenceClaim confirm is rejected (stays proposed)', () => {
  const { tmp, db } = makeRoom();
  try {
    seedNode(db, 'EvidenceClaim:sec01:b', 'EvidenceClaim', 'proposed');
    const r = promoteNodeStatus(db, 'EvidenceClaim:sec01:b', 'proposed', 'confirmed', 'navigator');
    assert.equal(r.ok, false, `human promotion must be rejected, got ${JSON.stringify(r)}`);
    assert.equal(r.reason, 'evidence_claim_non_promotable', 'rejection names the non-promotable guard');
    assert.equal(reviewStatusOf(db, 'EvidenceClaim:sec01:b'), 'proposed', 'node must stay proposed');
  } finally {
    cleanup(tmp, db);
  }
});

// (Test C) any non-proposed target status is barred (the bar is not confirm-only).
check('Test C: EvidenceClaim proposed -> needs_evidence is also rejected', () => {
  const { tmp, db } = makeRoom();
  try {
    seedNode(db, 'EvidenceClaim:sec01:c', 'EvidenceClaim', 'proposed');
    const r = promoteNodeStatus(db, 'EvidenceClaim:sec01:c', 'proposed', 'needs_evidence', 'navigator');
    assert.equal(r.ok, false, `non-confirm promotion must be rejected, got ${JSON.stringify(r)}`);
    assert.equal(r.reason, 'evidence_claim_non_promotable', 'the bar is not confirm-only');
    assert.equal(reviewStatusOf(db, 'EvidenceClaim:sec01:c'), 'proposed', 'node must stay proposed');
  } finally {
    cleanup(tmp, db);
  }
});

// (Test D) a blocked attempt emits exactly one evidence_claim_promotion_blocked
// memory_event carrying the target node id with created_by 'system'.
check('Test D: a blocked attempt logs exactly one evidence_claim_promotion_blocked event', () => {
  const { tmp, db } = makeRoom();
  try {
    seedNode(db, 'EvidenceClaim:sec01:d', 'EvidenceClaim', 'proposed');
    const r = promoteNodeStatus(db, 'EvidenceClaim:sec01:d', 'proposed', 'confirmed', 'navigator');
    assert.equal(r.ok, false, 'attempt must be blocked');
    assert.equal(blockedEventCount(db, 'EvidenceClaim:sec01:d'), 1, 'exactly one system-attributed blocked event');
  } finally {
    cleanup(tmp, db);
  }
});

// (Test E) TRUTH_CLAIM_TYPES byte-unchanged (D-181-01): EvidenceClaim ABSENT; every
// FLOOR member present; a frozen Set instance. Never assert .size.
check('Test E: TRUTH_CLAIM_TYPES byte-unchanged (no EvidenceClaim; FLOOR intact; frozen)', () => {
  assert.equal(TRUTH_CLAIM_TYPES.has('EvidenceClaim'), false, 'EvidenceClaim must NOT be in TRUTH_CLAIM_TYPES (D-181-01)');
  const FLOOR = ['claim', 'CausalClaim', 'assumption', 'decision', 'opportunity', 'SyntheticExpert'];
  for (const t of FLOOR) {
    assert.equal(TRUTH_CLAIM_TYPES.has(t), true, `missing FLOOR member ${t}`);
  }
  assert.equal(TRUTH_CLAIM_TYPES instanceof Set, true, 'must be a Set instance');
  assert.equal(Object.isFrozen(TRUTH_CLAIM_TYPES), true, 'must be frozen');
});

// (Test F) no signature change: arity stays 7 (db, nodeId, fromStatus, toStatus,
// byUser, reason, opts) so a future widening trips the gate.
check('Test F: promoteNodeStatus signature is byte-unchanged (arity 7)', () => {
  assert.equal(promoteNodeStatus.length, 7, 'promoteNodeStatus arity must stay 7');
});

// (Honest control) a non-EvidenceClaim truth-claim ('claim') promoted by a human
// byUser STILL succeeds -- the guard is scoped to EvidenceClaim and did not break
// the existing human-confirm path.
check('Honest control: a human-attributed claim still promotes proposed -> confirmed', () => {
  const { tmp, db } = makeRoom();
  try {
    seedNode(db, 'claim:honest', 'claim', 'proposed');
    const r = promoteNodeStatus(db, 'claim:honest', 'proposed', 'confirmed', 'navigator', 'human confirmed');
    assert.equal(r.ok, true, `human confirm of a claim must still succeed, got ${JSON.stringify(r)}`);
    assert.equal(reviewStatusOf(db, 'claim:honest'), 'confirmed', 'claim must be confirmed');
  } finally {
    cleanup(tmp, db);
  }
});

console.log(`\nPASS (${pass}/8)`);
