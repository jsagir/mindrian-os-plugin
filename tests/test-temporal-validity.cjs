'use strict';
// Phase 150.8-01 Task 1 -- temporal-validity driver (DIKW-03).
//
// Asserts the four temporal-validity properties (conditions, counter_conditions,
// valid_from, valid_until) plus the optional provenance keys (source_speaker,
// source_segment) and the AMB-01 disambiguation marker round-trip as ADDITIVE
// JSON properties of the claim node with ZERO DDL change (no ALTER TABLE, no new
// column). The schema is the production nodes table from applySchema; the only
// CHECK-constrained status field is review_status. knowledge_type and every
// temporal field live inside the properties TEXT blob.
//
// SKIP 77 if node:sqlite is unavailable. NO em-dashes (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const path = require('node:path');

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP test-temporal-validity.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const { DatabaseSync } = require('node:sqlite');
const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const { applySchema } = require(path.join(__dirname, 'claim-harness', 'build-fixture-room-db.cjs'));

const { writeClaimNode } = navigation;

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

function extract(db, nodeId, key) {
  const row = db.prepare(
    "SELECT json_extract(properties, '$." + key + "') AS v FROM nodes WHERE id = ?"
  ).get(nodeId);
  return row ? row.v : undefined;
}

console.log('test-temporal-validity');

// (1) All four temporal fields round-trip the exact strings.
check('conditions / counter_conditions / valid_from / valid_until round-trip', () => {
  const db = freshDb();
  const r = writeClaimNode(db, {
    knowledge_type: 'causal',
    text: 'Raising price 20pct reduces churn when onboarding is strong',
    sessionId: 'tv1',
    sourceSegment: 'seg-tv-1',
    conditions: 'onboarding NPS > 50',
    counter_conditions: 'enterprise tier with annual contracts',
    valid_from: '2026-06-01',
    valid_until: '2026-12-31',
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(extract(db, r.node_id, 'conditions'), 'onboarding NPS > 50');
  assert.equal(extract(db, r.node_id, 'counter_conditions'), 'enterprise tier with annual contracts');
  assert.equal(extract(db, r.node_id, 'valid_from'), '2026-06-01');
  assert.equal(extract(db, r.node_id, 'valid_until'), '2026-12-31');
  assert.equal(extract(db, r.node_id, 'knowledge_type'), 'causal');
  db.close();
});

// (2) Absent temporal fields default to empty string (never null/undefined keys).
check('absent temporal fields default to empty string', () => {
  const db = freshDb();
  const r = writeClaimNode(db, { knowledge_type: 'fact', text: 'bare claim', sessionId: 'tv2' });
  assert.equal(r.ok, true);
  assert.equal(extract(db, r.node_id, 'conditions'), '');
  assert.equal(extract(db, r.node_id, 'counter_conditions'), '');
  assert.equal(extract(db, r.node_id, 'valid_from'), '');
  assert.equal(extract(db, r.node_id, 'valid_until'), '');
  db.close();
});

// (3) Zero DDL change: review_status is the ONLY CHECK-constrained field; the
//     temporal keys live in the properties blob, not as columns. Prove the
//     nodes table has NO conditions/valid_from/etc column.
check('temporal fields are additive JSON keys, NOT DDL columns', () => {
  const db = freshDb();
  const cols = db.prepare('PRAGMA table_info(nodes)').all().map((c) => c.name);
  for (const forbidden of ['knowledge_type', 'conditions', 'counter_conditions', 'valid_from', 'valid_until']) {
    assert.equal(cols.indexOf(forbidden), -1, `${forbidden} must NOT be a column (additive JSON only)`);
  }
  assert.ok(cols.indexOf('properties') !== -1, 'properties TEXT column must exist');
  assert.ok(cols.indexOf('review_status') !== -1, 'review_status column must exist');
  db.close();
});

// (4) source_speaker / source_segment provenance keys round-trip.
check('source_speaker / source_segment provenance keys round-trip', () => {
  const db = freshDb();
  const r = writeClaimNode(db, {
    knowledge_type: 'heuristic', text: 'ship on Monday', sessionId: 'tv3',
    sourceSpeaker: 'Lawrence', sourceSegment: 'seg-42',
  });
  assert.equal(r.ok, true);
  assert.equal(extract(db, r.node_id, 'source_speaker'), 'Lawrence');
  assert.equal(extract(db, r.node_id, 'source_segment'), 'seg-42');
  db.close();
});

// (5) AMB-01 disambiguation marker: present ONLY when a non-empty string passed.
check('disambiguation marker set only when a non-empty string is supplied', () => {
  const db = freshDb();
  const rAmb = writeClaimNode(db, {
    knowledge_type: 'assumption', text: 'they will pay', sessionId: 'tv4a',
    sourceSegment: 'seg-amb', disambiguation: 'ambiguous',
  });
  assert.equal(extract(db, rAmb.node_id, 'disambiguation'), 'ambiguous');
  const rClean = writeClaimNode(db, {
    knowledge_type: 'assumption', text: 'they will pay', sessionId: 'tv4b',
    sourceSegment: 'seg-clean',
  });
  // Absent disambiguation -> json_extract returns null (key not present).
  assert.equal(extract(db, rClean.node_id, 'disambiguation'), null);
  db.close();
});

console.log(`\ntest-temporal-validity: ${pass} checks passed`);
