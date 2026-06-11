'use strict';
// Phase 150.8-03 Task 2 (DIKW-06) -- the ambiguous-queue WRITER/QUEUE unit.
//
// Asserts the queue partition semantics on a real in-memory room.db built with
// the canonical applySchema (tests/claim-harness/build-fixture-room-db.cjs):
//
//   1. a claim minted with disambiguation='ambiguous' + review_status='proposed'
//      is FOUND by the queue scan (json_extract(properties,'$.disambiguation')).
//   2. a non-ambiguous claim is NOT in the queue.
//   3. an ambiguous claim is NEVER silently dropped -- it persists as a proposed
//      node until dismissed/resolved.
//
// The scan SQL here is the same predicate scripts/check-pending-ambiguous.cjs
// runs (json_extract through the navigation chokepoint). Minting goes through
// navigation.writeClaimNode (the Plan 01 truth-claim writer), NEVER a raw INSERT.
//
// SKIP 77 on a no-sqlite box (mirrors claim-c5.cjs). NO em-dashes. NO emoji.

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// --- node:sqlite availability probe (SKIP 77 like the claim harness) ---
let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (_e) {
  console.log('SKIP: node:sqlite unavailable (exit 77)');
  process.exit(77);
}

const { applySchema } = require(
  path.join(REPO_ROOT, 'tests', 'claim-harness', 'build-fixture-room-db.cjs')
);
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));

// The exact predicate the SessionStart hook scans with.
const QUEUE_SQL =
  "SELECT id, properties, review_status FROM nodes " +
  "WHERE type='claim' " +
  "AND json_extract(properties,'$.disambiguation')='ambiguous' " +
  "AND review_status='proposed'";

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

console.log('test-ambiguous-queue');

const db = new DatabaseSync(':memory:');
applySchema(db);

// Mint one ambiguous claim (unresolved referent) and two resolved claims.
const amb = navigation.writeClaimNode(db, {
  text: 'They said the deal would close in Q3.',
  knowledge_type: 'assumption',
  sessionId: 'sess-amb',
  sourceSegment: 'seg-amb-1',
  sourceSpeaker: 'unknown',
  disambiguation: 'ambiguous',
});
const clean1 = navigation.writeClaimNode(db, {
  text: 'Revenue was 1.2M last quarter.',
  knowledge_type: 'fact',
  sessionId: 'sess-clean',
  sourceSegment: 'seg-clean-1',
  sourceSpeaker: 'sarah',
});
const clean2 = navigation.writeClaimNode(db, {
  text: 'Raising the price filtered low-intent buyers, so churn dropped.',
  knowledge_type: 'causal',
  sessionId: 'sess-clean',
  sourceSegment: 'seg-clean-2',
  sourceSpeaker: 'sarah',
});

check('all three claims minted ok', () => {
  assert.equal(amb.ok, true, JSON.stringify(amb));
  assert.equal(clean1.ok, true, JSON.stringify(clean1));
  assert.equal(clean2.ok, true, JSON.stringify(clean2));
});

check('all three mint at review_status=proposed (Part 9 role 5)', () => {
  const rows = db.prepare("SELECT review_status FROM nodes WHERE type='claim'").all();
  assert.equal(rows.length, 3);
  for (const r of rows) assert.equal(r.review_status, 'proposed');
});

check('queue scan finds the ambiguous claim', () => {
  const rows = db.prepare(QUEUE_SQL).all();
  assert.equal(rows.length, 1, 'exactly one ambiguous claim should be queued');
  assert.equal(rows[0].id, amb.node_id);
});

check('queue scan does NOT include the resolved claims', () => {
  const rows = db.prepare(QUEUE_SQL).all();
  const ids = rows.map((r) => r.id);
  assert.equal(ids.indexOf(clean1.node_id), -1, 'resolved fact must not be queued');
  assert.equal(ids.indexOf(clean2.node_id), -1, 'resolved causal must not be queued');
});

check('ambiguous claim is never silently dropped -- persists as proposed node', () => {
  const row = db.prepare('SELECT id, review_status FROM nodes WHERE id = ?').get(amb.node_id);
  assert.ok(row, 'ambiguous node must persist');
  assert.equal(row.review_status, 'proposed', 'still proposed (not dropped, not auto-confirmed)');
});

check('disambiguation marker round-trips through properties JSON (additive, no DDL)', () => {
  const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(amb.node_id);
  const props = JSON.parse(row.properties);
  assert.equal(props.disambiguation, 'ambiguous');
  assert.equal(props.knowledge_type, 'assumption');
});

db.close();

console.log('test-ambiguous-queue: ' + pass + ' checks passed');
process.exit(0);
