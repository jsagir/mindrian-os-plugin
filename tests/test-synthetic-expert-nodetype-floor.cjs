'use strict';
// Phase 164-01 Task 1 -- SyntheticExpert truth-claim NODE type additive-floor test
// (the E1 SyntheticExpert node-type amendment, D-164-S1).
//
// The BONO Research/Debate Engine amendment (164-01-PLAN.md, D-164-S1 / E1) moves a
// FROZEN constitutional set: it adds SyntheticExpert as a truth-claim NODE type to
// lib/core/navigation/transitions.cjs::TRUTH_CLAIM_TYPES so a SyntheticExpert is
// human-confirm-gated (Part 9 role 5: the navigator decides which experts are kept).
// This is a NAVIGATOR-GATED change (the blocking checkpoint was navigator-ratified
// before any bytes landed, mirroring the Phase 169 D-169-11 / Phase 168 D-168 /
// Phase 163 D-163-03 / Phase 150.8 D-150.8 frozen-set moves) -- code-wise additive
// and reversible, but constitutionally a Part 9 + Phase 108 frozen-taxonomy move.
//
// This is a FLOOR test (mirroring tests/test-edges-domain-taxonomy-floor.cjs): it
// asserts SyntheticExpert is present AND that every prior truth-claim type is STILL
// present (additive / never-delete), that the Set is still a frozen Set instance so
// a future edit cannot silently swap it for a mutable one, plus a live
// promoteNodeStatus round-trip proving the human-confirm gate covers SyntheticExpert
// (an agent-attributed confirm is REJECTED, a human byUser promotes proposed ->
// confirmed).
//
// NEVER asserts .size (additive extensions must not regress the baseline; the
// edges.cjs FLOOR doctrine). NO em-dashes. Uses the canonical openRoomDb chokepoint
// (the Phase-109 provenance schema) for the live-write checks -- the same idiom the
// Phase 129.5 confirm-node suite uses -- so there is no SKIP path here.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { TRUTH_CLAIM_TYPES, promoteNodeStatus, AGENT_IDENTITIES } = require(
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-164-synthexpert-'));
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

console.log('test-synthetic-expert-nodetype-floor');

// (1) SyntheticExpert is a member of TRUTH_CLAIM_TYPES.
check('SyntheticExpert is in TRUTH_CLAIM_TYPES', () => {
  assert.equal(TRUTH_CLAIM_TYPES.has('SyntheticExpert'), true, 'missing SyntheticExpert');
});

// (2) The FLOOR: every prior truth-claim type is STILL present (additive, never-delete).
const FLOOR = ['claim', 'CausalClaim', 'assumption', 'decision', 'opportunity'];
check('all prior truth-claim FLOOR members preserved', () => {
  for (const t of FLOOR) {
    assert.equal(TRUTH_CLAIM_TYPES.has(t), true, `missing prior member ${t}`);
  }
});

// (3) Still a frozen Set instance.
check('TRUTH_CLAIM_TYPES is a frozen Set instance', () => {
  assert.equal(TRUTH_CLAIM_TYPES instanceof Set, true);
  assert.equal(Object.isFrozen(TRUTH_CLAIM_TYPES), true);
});

// (4a) Human-confirm gate: an AGENT-attributed confirm of a SyntheticExpert at
//      'proposed' is REJECTED (agent_attribution_forbidden) and the node is NOT
//      promoted -- the Part 9 role 5 gate now covers SyntheticExpert because the
//      guard keys on TRUTH_CLAIM_TYPES.has(row.type).
check('agent-attributed SyntheticExpert confirm is rejected (proposed stays proposed)', () => {
  const { tmp, db } = makeRoom();
  try {
    const agent = [...AGENT_IDENTITIES][0]; // an AGENT_IDENTITIES member (e.g. larry)
    seedNode(db, 'expert:dr-immuno', 'SyntheticExpert', 'proposed');
    const r = promoteNodeStatus(db, 'expert:dr-immuno', 'proposed', 'confirmed', agent);
    assert.equal(r.ok, false, `agent confirm must be rejected, got ${JSON.stringify(r)}`);
    assert.equal(r.reason, 'agent_attribution_forbidden', 'rejection names the human-confirm gate');
    assert.equal(reviewStatusOf(db, 'expert:dr-immuno'), 'proposed', 'node must stay proposed');
  } finally {
    cleanup(tmp, db);
  }
});

// (4b) Human-confirm gate: a HUMAN byUser promotes a SyntheticExpert proposed ->
//      confirmed (ok:true) and the node lands confirmed.
check('human byUser promotes SyntheticExpert proposed -> confirmed', () => {
  const { tmp, db } = makeRoom();
  try {
    seedNode(db, 'expert:dr-regulatory', 'SyntheticExpert', 'proposed');
    const r = promoteNodeStatus(db, 'expert:dr-regulatory', 'proposed', 'confirmed', 'navigator', 'navigator kept this expert');
    assert.equal(r.ok, true, `human confirm must succeed, got ${JSON.stringify(r)}`);
    assert.equal(reviewStatusOf(db, 'expert:dr-regulatory'), 'confirmed', 'node must be confirmed');
  } finally {
    cleanup(tmp, db);
  }
});

console.log(`\nPASS (${pass}/5)`);
