'use strict';
// Phase 168-01 Task 1 -- CONVERGES / INVALIDATES / ENABLES additive-floor test
// (the three Part-4-blessed cascade edges, reconciled into the Part 9 chokepoint
// frozen set; EDGE-01 + EDGE-02).
//
// The Part 4 edge-vocabulary RECONCILIATION (168-01-PLAN.md / 168-SPEC.md) brings
// the Part 9 chokepoint frozen set into line with what Canon Part 4 prose ALREADY
// declares. Canon Part 4 lists the cascade edges INFORMS / CONTRADICTS / CONVERGES /
// INVALIDATES / ENABLES, and the legacy lib/core/lazygraph-ops.cjs path already
// carries them, but the Part 9 writeEdge chokepoint frozen set
// (lib/core/navigation/edges.cjs::ALLOWED_EDGE_TYPES) never caught up: it carried
// INFORMS + CONTRADICTS but was MISSING CONVERGES / INVALIDATES / ENABLES. This
// adds the three missing members so writeEdge accepts them. This is a
// NAVIGATOR-GATED change (a blocking ratification at the Task 3 checkpoint,
// mirroring the Phase 163 D-163-03 four-edge amendment and the Phase 150.8 D-150.8
// trio) -- code-wise additive and reversible, but constitutionally a Part 4 +
// Phase 108 frozen-taxonomy move. It is a RECONCILIATION (honor the prose in code),
// not a net-new vocabulary expansion.
//
// This is a FLOOR test (per the edges.cjs "Tests assert a FLOOR ... not an exact
// size" contract): it asserts the three new members are present AND that every prior
// member is STILL present (additive / never-delete, mirroring the Phase 163
// DECOMPOSED_INTO / PART_OF / TAGGED_WITH / RELATED_TO floor test). It also asserts
// the Set is still a frozen Set instance so a future edit cannot silently swap it
// for a mutable one, plus a live writeEdge round-trip for each new edge and an
// honest-negative made-up-type reject.
//
// NEVER asserts .size (additive extensions must not regress the baseline). NO
// em-dashes. node:sqlite is used for the live-write checks; they construct a bare
// in-memory handle so there is no SKIP path here.
//
// BELONGS_TO is NOT added in this phase (the 164 issue-tree remaps it to PART_OF);
// the lazygraph-ops.cjs legacy-array two-vocabulary unification is OUT of scope.

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { ALLOWED_EDGE_TYPES, writeEdge } = require(
  path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs')
);

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok -', label);
}

function freshEdgesDb() {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type));"
  );
  return db;
}

console.log('test-edges-part4-cascade-floor');

// (1) The three new members are present.
check('CONVERGES / INVALIDATES / ENABLES are in ALLOWED_EDGE_TYPES', () => {
  assert.equal(ALLOWED_EDGE_TYPES.has('CONVERGES'), true, 'missing CONVERGES');
  assert.equal(ALLOWED_EDGE_TYPES.has('INVALIDATES'), true, 'missing INVALIDATES');
  assert.equal(ALLOWED_EDGE_TYPES.has('ENABLES'), true, 'missing ENABLES');
});

// (2) The FLOOR: every prior member is STILL present (additive, never-delete).
//     The full vocabulary through STATES / SUPPORTS / DESCRIBES plus the Phase
//     150.8 REFINES / ROOT_CAUSES / INSTANTIATES trio plus the Phase 163
//     DECOMPOSED_INTO / PART_OF / TAGGED_WITH / RELATED_TO quad.
const FLOOR = [
  'DEFERRED', 'REJECTED', 'DERIVED_FROM', 'FILED_AS_DECISION', 'FOLLOWS_FROM',
  'OPERATOR_TRANSITION', 'INFORMS', 'REJECTED_BECAUSE', 'CONTRADICTS', 'SUPERSEDES',
  'AFFILIATED_WITH', 'PIVOTED', 'SELECTED_REACH', 'FEEDS_INTO', 'VALIDATES',
  'STATES', 'SUPPORTS', 'DESCRIBES', 'REFINES', 'ROOT_CAUSES', 'INSTANTIATES',
  'DECOMPOSED_INTO', 'PART_OF', 'TAGGED_WITH', 'RELATED_TO',
  // Phase 169-00 room-lineage edge (added additively after the 168-01 baseline).
  'NESTED_WITHIN',
];
check('all prior FLOOR members preserved', () => {
  for (const t of FLOOR) {
    assert.equal(ALLOWED_EDGE_TYPES.has(t), true, `missing prior member ${t}`);
  }
});

// (3) Still a frozen Set instance.
check('ALLOWED_EDGE_TYPES is a frozen Set instance', () => {
  assert.equal(ALLOWED_EDGE_TYPES instanceof Set, true);
  assert.equal(Object.isFrozen(ALLOWED_EDGE_TYPES), true);
});

// (4) Live write: writeEdge accepts a CONVERGES cascade edge and the enum/scalar
//     props round-trip through the properties JSON (Part 8 enum/scalar-only).
check('writeEdge accepts CONVERGES + props round-trip', () => {
  const db = freshEdgesDb();
  const r = writeEdge(db, {
    source_id: 'artifact:a-12',
    target_id: 'section:financial-model',
    edge_type: 'CONVERGES',
    properties: { relation: 'convergence', count: 3 },
  });
  assert.equal(r.ok, true, `expected ok:true, got ${JSON.stringify(r)}`);
  assert.equal(r.type, 'CONVERGES');
  const row = db.prepare(
    "SELECT properties FROM edges WHERE source = ? AND target = ? AND type = 'CONVERGES'"
  ).get('artifact:a-12', 'section:financial-model');
  assert.ok(row, 'the CONVERGES edge must be queryable');
  const props = JSON.parse(row.properties);
  assert.equal(props.relation, 'convergence', 'relation enum must round-trip');
  assert.equal(props.count, 3, 'count scalar must round-trip');
  db.close();
});

// (5) Live write: INVALIDATES + ENABLES are also accepted (assumption-stale /
//     unblocks-another-section cascade edges per Canon Part 4 + CLAUDE.md decision 16).
check('writeEdge accepts INVALIDATES and ENABLES', () => {
  const db = freshEdgesDb();
  const ri = writeEdge(db, {
    source_id: 'artifact:market-finding', target_id: 'assumption:tam-2b',
    edge_type: 'INVALIDATES', properties: { relation: 'stale' },
  });
  assert.equal(ri.ok, true, `expected INVALIDATES ok:true, got ${JSON.stringify(ri)}`);
  const re = writeEdge(db, {
    source_id: 'artifact:reg-clearance', target_id: 'section:go-to-market',
    edge_type: 'ENABLES', properties: { relation: 'unblocks' },
  });
  assert.equal(re.ok, true, `expected ENABLES ok:true, got ${JSON.stringify(re)}`);
  db.close();
});

// (6) Honest-negative: a made-up cascade edge type is REJECTED by the closed-set gate.
check('writeEdge rejects a made-up cascade edge type (invalid_edge_type)', () => {
  const db = freshEdgesDb();
  const r = writeEdge(db, {
    source_id: 'artifact:a', target_id: 'section:b',
    edge_type: 'MADE_UP_CASCADE_EDGE', properties: {},
  });
  assert.equal(r.ok, false, 'a made-up cascade edge type must be rejected');
  assert.equal(r.reason, 'invalid_edge_type', 'rejection reason names the allow-list gate');
  db.close();
});

console.log(`\nPASS (${pass}/6)`);
