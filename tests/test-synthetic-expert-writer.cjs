'use strict';
// Phase 164-02 Task 1 -- writeSyntheticExpertNode chokepoint test suite (the
// E1 SyntheticExpert WRITER, D-164-S1 / E1).
//
// WAVE 2. With the SyntheticExpert node type frozen in Wave 1 (TRUTH_CLAIM_TYPES
// + aliases.yml + the promoteNodeStatus human-confirm gate), this wave ships
// lib/core/navigation/synthetic-expert.cjs writeSyntheticExpertNode -- the single
// chokepoint that mints a SyntheticExpert node at review_status 'proposed',
// carrying GENERIC-LENS metadata ONLY (164-SYNTHETIC-EXPERTS.md section 2 table:
// hat / name / surname / archetype / beautiful_question / research_approach /
// evidence_tier / invocation_count / last_used / provenance). It mirrors
// lib/core/navigation/typed-domain.cjs writeDomainNode VERBATIM in shape.
//
// Canon Part 8 (the load-bearing gate): the SYNTHETIC_EXPERT_FIELDS allow-list
//   rejects ANY non-generic field (forbidden_field) BEFORE any insert -- no
//   venture body ever rides the props bag (generic-lens-only).
// Canon Part 9 role 5: a SyntheticExpert is a truth-claim node; it lands
//   'proposed' and is NEVER auto-confirmed by the writer; the human promotes it
//   via the existing confirmNode(byUser) door (an agent-attributed confirm is
//   rejected -- the Wave-1 TRUTH_CLAIM_TYPES extension covers it for free).
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE). node:sqlite builds an in-memory
// migrated-nodes-schema db (the typed-domain test idiom) so there is no SKIP path.

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const syntheticExpertPath = path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'synthetic-expert.cjs');
const {
  writeSyntheticExpertNode, SYNTHETIC_EXPERT_FIELDS, HAT_COLORS, SYNTHETIC_EXPERT_NODE_ID,
} = require(syntheticExpertPath);
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { confirmNode } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'confirm-node.cjs'));
const { AGENT_IDENTITIES } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'transitions.cjs'));

let pass = 0;
let total = 0;
function check(label, fn) {
  total += 1;
  fn();
  pass += 1;
  console.log('  ok -', label);
}

// In-memory db with the Phase-109-migrated nodes schema (the wide NOT-NULL +
// CHECK shape from lib/core/migrations/phase-109-nodes-provenance.cjs) plus the
// edges + memory_events tables so promoteNodeStatus (which logs an event) and
// confirmNode round-trip. Mirrors tests/test-typed-domain.cjs freshDb. No SKIP.
function freshDb() {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(
    'CREATE TABLE nodes (' +
    '  id TEXT PRIMARY KEY, ' +
    '  type TEXT NOT NULL, ' +
    "  properties TEXT DEFAULT '{}', " +
    '  source_path TEXT NOT NULL, ' +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    '  confidence REAL, ' +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    '  created_at INTEGER NOT NULL, ' +
    '  last_seen_at INTEGER NOT NULL, ' +
    '  last_modified_at INTEGER, ' +
    '  source_section TEXT, ' +
    '  confirmed_by TEXT, ' +
    '  confirmed_at INTEGER, ' +
    '  invalidated_at INTEGER, ' +
    '  valid_to INTEGER' +
    ')'
  );
  db.exec(
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type));"
  );
  // memory_events table so logEvent (called by promoteNodeStatus) does not fail.
  // The nodes table doubles as the memory_event node store in the real schema;
  // logEvent inserts a node of type memory_event, so the nodes table above
  // suffices. No separate table needed for this idiom.
  return db;
}

const VALID = {
  hat: 'Black',
  name: 'Regulatory',
  surname: 'IND',
  archetype: 'Domain Expert',
  beautifulQuestion: 'Where does this break against physical reality?',
  researchApproach: 'failure-case and risk searches; FDA 21 CFR Part 11 lens',
  evidenceTier: 'Operational',
  sessionId: 's1',
  provenance: { runId: 'run-001', domainNodeIds: ['domain:regulatory'] },
};

console.log('test-synthetic-expert-writer');

// Test 1: writeSyntheticExpertNode mints a SyntheticExpert node at 'proposed'.
check('Test 1 -- mints a proposed SyntheticExpert node with generic-lens fields', () => {
  const db = freshDb();
  const r = writeSyntheticExpertNode(db, { ...VALID });
  assert.equal(r.ok, true, `expected ok:true, got ${JSON.stringify(r)}`);
  assert.ok(typeof r.node_id === 'string' && r.node_id.length > 0, 'node_id present');
  assert.equal(r.hat, 'Black', 'hat echoed');
  const row = db.prepare('SELECT type, review_status, created_by, properties FROM nodes WHERE id = ?').get(r.node_id);
  assert.ok(row, 'node queryable');
  assert.equal(row.type, 'SyntheticExpert', "type must be 'SyntheticExpert'");
  assert.equal(row.review_status, 'proposed', "lands 'proposed' (never auto-confirmed)");
  assert.equal(row.created_by, 'system', "created_by 'system' (the writer never attributes a human)");
  const props = JSON.parse(row.properties);
  assert.equal(props.hat, 'Black', 'hat in props');
  assert.equal(props.name, 'Regulatory', 'name in props');
  assert.equal(props.surname, 'IND', 'surname in props');
  assert.equal(props.evidence_tier, 'Operational', 'evidence_tier mapped to snake_case in props');
  assert.ok(props.provenance && props.provenance.runId === 'run-001', 'provenance scalars preserved');
  db.close();
});

// Test 2: a venture-body field is rejected (forbidden_field) -- Part 8 gate.
check('Test 2 -- a venture-body field is rejected (forbidden_field, Part 8)', () => {
  const db = freshDb();
  const r = writeSyntheticExpertNode(db, {
    ...VALID,
    ventureNotes: 'our proprietary CAR-T construct uses a novel costimulatory domain',
  });
  assert.equal(r.ok, false, 'a non-allow-listed prose key must be rejected');
  assert.equal(r.reason, 'forbidden_field', 'reason names the generic-lens allow-list gate');
  const cnt = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'SyntheticExpert'").get();
  assert.equal(cnt.n, 0, 'nothing was inserted (the gate fires before any write)');
  db.close();
});

// Test 3: the minted node is NOT auto-confirmed; confirmNode(navigator) promotes
//         it; confirmNode(<agent>) is rejected (Part 9 role 5, Wave-1 gate).
check('Test 3 -- never auto-confirmed; human confirmNode promotes, agent confirm rejected', () => {
  const db = freshDb();
  const r = writeSyntheticExpertNode(db, { ...VALID, surname: 'IND-3' });
  assert.equal(r.ok, true);
  // proposed, not confirmed.
  const before = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(r.node_id);
  assert.equal(before.review_status, 'proposed', 'writer never auto-confirms');
  // an agent-attributed confirm is rejected.
  const agent = [...AGENT_IDENTITIES][0];
  const agentRes = confirmNode(db, r.node_id, agent);
  assert.equal(agentRes.ok, false, 'agent confirm rejected');
  assert.equal(agentRes.reason, 'agent_attribution_forbidden', 'rejection names the human gate');
  const stillProposed = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(r.node_id);
  assert.equal(stillProposed.review_status, 'proposed', 'still proposed after the rejected agent confirm');
  // a human byUser promotes it.
  const humanRes = confirmNode(db, r.node_id, 'navigator', 'navigator kept this expert');
  assert.equal(humanRes.ok, true, `human confirm must succeed, got ${JSON.stringify(humanRes)}`);
  const after = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(r.node_id);
  assert.equal(after.review_status, 'confirmed', 'human byUser promotes proposed -> confirmed');
  db.close();
});

// Test 4: an invalid hat is rejected (invalid_hat); missing name/surname is a
//         defensive failure, never a throw.
check('Test 4 -- invalid hat rejected; missing name/surname is defensive (no throw)', () => {
  const db = freshDb();
  const badHat = writeSyntheticExpertNode(db, { ...VALID, hat: 'Purple' });
  assert.equal(badHat.ok, false, 'a non-de-Bono hat must be rejected');
  assert.equal(badHat.reason, 'invalid_hat', 'reason names the hat gate');
  const noName = writeSyntheticExpertNode(db, { ...VALID, name: '' });
  assert.equal(noName.ok, false, 'missing name is a defensive failure');
  assert.ok(typeof noName.reason === 'string' && noName.reason.length > 0, 'a reason is returned');
  const noSurname = writeSyntheticExpertNode(db, { ...VALID, surname: undefined });
  assert.equal(noSurname.ok, false, 'missing surname is a defensive failure');
  // params not an object -> defensive failure, not a throw.
  const notObj = writeSyntheticExpertNode(db, null);
  assert.equal(notObj.ok, false, 'a non-object params bag is a defensive failure');
  db.close();
});

// Test 5: writeSyntheticExpertNode is reachable as navigation.writeSyntheticExpertNode.
check('Test 5 -- navigation.cjs re-exports writeSyntheticExpertNode', () => {
  assert.equal(typeof navigation.writeSyntheticExpertNode, 'function', 'writeSyntheticExpertNode re-exported');
  assert.ok(navigation.HAT_COLORS instanceof Set, 'HAT_COLORS re-exported as a Set');
  assert.ok(navigation.SYNTHETIC_EXPERT_FIELDS instanceof Set, 'SYNTHETIC_EXPERT_FIELDS re-exported as a Set');
});

// Test 6: re-writing the same (hat, surname, sessionId) UPSERTs (idempotent id).
check('Test 6 -- same (hat, surname, sessionId) UPSERTs (no duplicate row)', () => {
  const db = freshDb();
  const r1 = writeSyntheticExpertNode(db, { ...VALID });
  const r2 = writeSyntheticExpertNode(db, { ...VALID, evidenceTier: 'Academic' });
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(r1.node_id, r2.node_id, 'same (hat, surname, sessionId) yields the same idempotent id');
  const cnt = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'SyntheticExpert'").get();
  assert.equal(cnt.n, 1, 're-write UPSERTs, never duplicates');
  db.close();
});

// Test 7: synthetic-expert.cjs carries no forbidden substrate require (chokepoint-only).
check('Test 7 -- synthetic-expert.cjs carries no forbidden substrate require', () => {
  const src = fs.readFileSync(syntheticExpertPath, 'utf8');
  assert.equal(/require\(['"][^'"]*room-db\.cjs['"]\)/.test(src), false, 'no room-db.cjs require');
  assert.equal(/require\(['"][^'"]*lazygraph-ops\.cjs['"]\)/.test(src), false, 'no lazygraph-ops.cjs require');
  assert.equal(/require\(['"]node:sqlite['"]\)/.test(src), false, 'no node:sqlite require');
});

// Allow-list + frozen-Set sanity (Part 8: SYNTHETIC_EXPERT_FIELDS is the gate).
check('SYNTHETIC_EXPERT_FIELDS + HAT_COLORS are frozen Sets', () => {
  assert.equal(SYNTHETIC_EXPERT_FIELDS instanceof Set, true);
  assert.equal(Object.isFrozen(SYNTHETIC_EXPERT_FIELDS), true);
  assert.equal(HAT_COLORS instanceof Set, true);
  assert.equal(Object.isFrozen(HAT_COLORS), true);
  for (const h of ['White', 'Red', 'Black', 'Yellow', 'Green', 'Blue']) {
    assert.equal(HAT_COLORS.has(h), true, `HAT_COLORS has ${h}`);
  }
  assert.equal(typeof SYNTHETIC_EXPERT_NODE_ID, 'function', 'SYNTHETIC_EXPERT_NODE_ID exported');
});

console.log(`\nPASS (${pass}/${total})`);
