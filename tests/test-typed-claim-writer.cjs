'use strict';
// Phase 150.8-01 Task 1 -- typed-claim writer driver (DIKW-01).
//
// Asserts the net-new writeClaimNode truth-claim writer mirrors the
// writeEvidenceClaim / writeDecisionNode precedent EXACTLY in shape:
//   - mints type='claim', created_by='system', review_status='proposed'
//     (NEVER 'confirmed' -- Canon Part 9 role 5; a claim is a TRUTH-CLAIM node)
//   - gates knowledge_type against the frozen 6-member KNOWLEDGE_TYPES Set;
//     an off-enum value returns { ok:false, reason:'invalid_knowledge_type' }
//   - a non-object params returns { ok:false, reason:'invalid_params' }
//   - re-filing the same (sessionId, segment) is idempotent (same node id,
//     ON CONFLICT updates properties, NEVER downgrades a confirmed status)
//   - KNOWLEDGE_TYPES is a frozen Set instance with exactly the 6 members
//   - the re-export identity holds: navigation.writeClaimNode === the module's
//
// SKIP 77 if node:sqlite is unavailable (the established Phase 150 discipline).
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const path = require('node:path');

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP test-typed-claim-writer.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const { DatabaseSync } = require('node:sqlite');
const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const typedClaim = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'typed-claim.cjs'));
const { applySchema } = require(path.join(__dirname, 'claim-harness', 'build-fixture-room-db.cjs'));

const { writeClaimNode, KNOWLEDGE_TYPES, CLAIM_NODE_ID } = navigation;

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

function freshDb() {
  const db = new DatabaseSync(':memory:');
  applySchema(db);
  return db;
}

console.log('test-typed-claim-writer');

// (1) Proposed mint -- a claim is a TRUTH-CLAIM node, never auto-confirmed.
check("writeClaimNode mints type='claim' review_status='proposed'", () => {
  const db = freshDb();
  const r = writeClaimNode(db, {
    knowledge_type: 'fact', text: 'The TAM is 190M USD', sessionId: 's1',
  });
  assert.equal(r.ok, true, `expected ok:true, got ${JSON.stringify(r)}`);
  const row = db.prepare('SELECT type, created_by, review_status FROM nodes WHERE id = ?').get(r.node_id);
  assert.equal(row.type, 'claim');
  assert.equal(row.created_by, 'system');
  assert.equal(row.review_status, 'proposed', 'a claim must NEVER mint confirmed');
  db.close();
});

// (2) Each of the 6 enum members is accepted.
check('all 6 knowledge_type enum members accepted (ok:true)', () => {
  const db = freshDb();
  for (const kt of ['fact', 'causal', 'heuristic', 'anomaly_cue', 'mental_model', 'assumption']) {
    const r = writeClaimNode(db, { knowledge_type: kt, text: 'claim text for ' + kt, sessionId: 'senum:' + kt });
    assert.equal(r.ok, true, `${kt} should be accepted, got ${JSON.stringify(r)}`);
    assert.equal(r.knowledge_type, kt);
  }
  db.close();
});

// (3) A plausible-but-off-enum value is rejected with a sliced detail.
check("off-enum knowledge_type='root_cause' rejected invalid_knowledge_type", () => {
  const db = freshDb();
  const r = writeClaimNode(db, { knowledge_type: 'root_cause', text: 'x', sessionId: 's2' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'invalid_knowledge_type');
  assert.equal(r.detail, 'root_cause');
  db.close();
});

// (4) Non-object params -> invalid_params.
check('non-object params -> invalid_params', () => {
  const db = freshDb();
  assert.equal(writeClaimNode(db, null).reason, 'invalid_params');
  assert.equal(writeClaimNode(db, 'nope').reason, 'invalid_params');
  assert.equal(writeClaimNode(db, []).reason, 'invalid_params');
  db.close();
});

// (5) Empty/absent text -> invalid_text.
check('empty text -> invalid_text', () => {
  const db = freshDb();
  assert.equal(writeClaimNode(db, { knowledge_type: 'fact', text: '', sessionId: 's3' }).reason, 'invalid_text');
  assert.equal(writeClaimNode(db, { knowledge_type: 'fact', sessionId: 's3' }).reason, 'invalid_text');
  db.close();
});

// (6) Idempotent re-filing: same node id, no review_status downgrade.
check('re-filing same (sessionId, segment) is idempotent + no-downgrade', () => {
  const db = freshDb();
  const params = { knowledge_type: 'fact', text: 'stable claim', sessionId: 's4', sourceSegment: 'seg-1' };
  const r1 = writeClaimNode(db, params);
  assert.equal(r1.ok, true);
  // Simulate a human confirming the claim.
  db.prepare("UPDATE nodes SET review_status='confirmed' WHERE id = ?").run(r1.node_id);
  // Re-file the same segment with updated props.
  const r2 = writeClaimNode(db, Object.assign({}, params, { conditions: 'now-with-conditions' }));
  assert.equal(r2.ok, true);
  assert.equal(r2.node_id, r1.node_id, 'same segment must mint the same id');
  const row = db.prepare('SELECT review_status, properties FROM nodes WHERE id = ?').get(r1.node_id);
  assert.equal(row.review_status, 'confirmed', 'ON CONFLICT must NOT downgrade a confirmed claim');
  assert.equal(JSON.parse(row.properties).conditions, 'now-with-conditions', 'properties must update');
  db.close();
});

// (7) KNOWLEDGE_TYPES is a frozen Set with exactly the 6 members.
check('KNOWLEDGE_TYPES is a frozen Set with exactly the 6 members', () => {
  assert.equal(KNOWLEDGE_TYPES instanceof Set, true);
  assert.equal(Object.isFrozen(KNOWLEDGE_TYPES), true);
  assert.equal(KNOWLEDGE_TYPES.size, 6);
  for (const kt of ['fact', 'causal', 'heuristic', 'anomaly_cue', 'mental_model', 'assumption']) {
    assert.equal(KNOWLEDGE_TYPES.has(kt), true, `missing member ${kt}`);
  }
});

// (8) Re-export identity.
check('navigation.writeClaimNode === typed-claim.writeClaimNode (re-export identity)', () => {
  assert.equal(navigation.writeClaimNode, typedClaim.writeClaimNode);
  assert.equal(navigation.KNOWLEDGE_TYPES, typedClaim.KNOWLEDGE_TYPES);
  assert.equal(navigation.CLAIM_NODE_ID, typedClaim.CLAIM_NODE_ID);
});

// (9) CLAIM_NODE_ID is deterministic + idempotent.
check('CLAIM_NODE_ID is deterministic for the same (sessionId, segmentKey)', () => {
  assert.equal(CLAIM_NODE_ID('s5', 'seg-a'), CLAIM_NODE_ID('s5', 'seg-a'));
  assert.notEqual(CLAIM_NODE_ID('s5', 'seg-a'), CLAIM_NODE_ID('s5', 'seg-b'));
  assert.equal(CLAIM_NODE_ID('s5', 'seg-a').indexOf('claim:s5:'), 0);
});

console.log(`\ntest-typed-claim-writer: ${pass} checks passed`);
