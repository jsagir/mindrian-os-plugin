'use strict';
// Phase 218-01 Task 1 -- domain-relationship edge-vocabulary extension (D-02).
//
// This phase's entity extractor needs three domain-relationship edge types to
// wire company / technology / market nodes to each other and to their sources:
// COMPETES_WITH, USES_COMPONENT, SUPPLIES_TO. They are added ADDITIVELY to the
// frozen ALLOWED_EDGE_TYPES set in lib/core/navigation/edges.cjs, never invented
// per-phase, so the closed edge surface stays the single source of truth.
//
// FLOOR test (per the edges.cjs contract, cloned from test-200-02-rs-edge-vocab):
// asserts the three new members are present AND a sample of the 37 prior members
// survive AND the Set is still a frozen Set. NEVER asserts .size, so the additive
// extension cannot regress the baseline (and cannot race a concurrent addition).

const assert = require('node:assert/strict');
const path = require('node:path');
const { ALLOWED_EDGE_TYPES, writeEdge } = require(
  path.join(__dirname, '..', 'lib', 'core', 'navigation', 'edges.cjs')
);

let n = 0;
function check(desc, fn) { fn(); n += 1; console.log('ok - ' + desc); }

// In-memory edges table so the writeEdge acceptance leg round-trips. No SKIP path.
function freshDb() {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type));"
  );
  return db;
}

console.log('test-218-edge-vocab');

// The three newly minted domain-relationship edge types.
check('COMPETES_WITH is a member', function () {
  assert.equal(ALLOWED_EDGE_TYPES.has('COMPETES_WITH'), true, 'missing COMPETES_WITH');
});
check('USES_COMPONENT is a member', function () {
  assert.equal(ALLOWED_EDGE_TYPES.has('USES_COMPONENT'), true, 'missing USES_COMPONENT');
});
check('SUPPLIES_TO is a member', function () {
  assert.equal(ALLOWED_EDGE_TYPES.has('SUPPLIES_TO'), true, 'missing SUPPLIES_TO');
});

// The 37-member prior floor survives the additive change (named membership,
// never an exact count).
check('prior frozen-set floor survives', function () {
  for (const t of [
    'DEFERRED', 'REJECTED', 'FEEDS_INTO', 'SHARES_JOB', 'NESTED_WITHIN',
    'NOT_REMEMBERED_BECAUSE',
  ]) {
    assert.equal(ALLOWED_EDGE_TYPES.has(t), true, 'missing prior member ' + t);
  }
});

check('the set is still a frozen Set (closed surface intact)', function () {
  assert.equal(ALLOWED_EDGE_TYPES instanceof Set, true);
  assert.equal(Object.isFrozen(ALLOWED_EDGE_TYPES), true);
});

// A non-member still rejected (the set stays closed, not opened up).
check('a non-member string is still not a member', function () {
  assert.equal(ALLOWED_EDGE_TYPES.has('COMPETES_WITH_MAGIC'), false);
});

// writeEdge accepts a new type on a fixture DatabaseSync and rejects an unlisted one.
check('writeEdge accepts COMPETES_WITH (ok:true)', function () {
  const db = freshDb();
  const r = writeEdge(db, {
    source_id: 'entity:s1:a', target_id: 'entity:s1:b',
    edge_type: 'COMPETES_WITH', properties: {},
  });
  assert.equal(r.ok, true, 'expected ok:true, got ' + JSON.stringify(r));
  const cnt = db.prepare('SELECT COUNT(*) AS n FROM edges').get();
  assert.equal(cnt.n, 1, 'edge landed in the edges table');
  db.close();
});
check('writeEdge rejects an unlisted edge_type (ok:false)', function () {
  const db = freshDb();
  const r = writeEdge(db, {
    source_id: 'entity:s1:a', target_id: 'entity:s1:b',
    edge_type: 'NOT_A_REAL_EDGE', properties: {},
  });
  assert.equal(r.ok, false, 'unlisted edge_type must be rejected');
  assert.equal(r.reason, 'invalid_edge_type', 'reason names the type gate');
  db.close();
});

console.log('\n' + n + ' assertions passed');
