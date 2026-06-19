'use strict';
// Phase 169-00 Task 1 -- NESTED_WITHIN room-lineage additive-floor test (the
// room-lineage edge minted to give the D-169-11 fractal joint a LEGAL,
// graph-navigable frozen-set representation; the constitutional prerequisite for
// the rollup walk (Plan 04) and the heal lineage edge (Plan 07)).
//
// The room-lineage edge amendment (169-00-PLAN.md / 169-SPEC.md) mints ONE new
// edge type, NESTED_WITHIN (child-room-node -> parent-room-node), into the Part 9
// writeEdge chokepoint frozen set (lib/core/navigation/edges.cjs::ALLOWED_EDGE_TYPES).
// The 8-agent ICM/fractal fan-out (verdict MISSING) proved the joint had no legal
// home: PART_OF is the domain-taxonomy structural edge (consumed by typed-domain.cjs
// + get-domains-for-trends.cjs; a room is an illegal PART_OF target), and BELONGS_TO
// is NOT in this navigation frozen set at all (so writeEdge rejects it). The clean
// LEGAL representation is a NEW dedicated lineage type, NOT a PART_OF endpoint
// widening, so room-lineage walks never pollute the domain-taxonomy traversals.
//
// This is a NAVIGATOR-GATED change (a blocking ratification at the Task-0 checkpoint,
// navigator-ratified as option-a BEFORE these bytes landed, mirroring the Phase 168
// D-168 reconciliation, the Phase 163 D-163-03 four-edge amendment, and the Phase
// 150.8 D-150.8 trio) -- code-wise additive and reversible, but constitutionally a
// Part 4 + Phase 108 frozen-taxonomy move.
//
// This is a FLOOR test (per the edges.cjs "Tests assert a FLOOR ... not an exact
// size" contract): it asserts the new member is present AND that every prior member
// is STILL present (additive / never-delete, mirroring the Phase 168
// CONVERGES / INVALIDATES / ENABLES floor test). It also asserts the Set is still a
// frozen Set instance so a future edit cannot silently swap it for a mutable one,
// plus a live writeEdge round-trip on a room->room NESTED_WITHIN edge and an
// honest-negative made-up-type reject.
//
// NEVER asserts .size (additive extensions must not regress the baseline). NO
// em-dashes (hyphens only). node:sqlite is used for the live-write checks; they
// construct a bare in-memory handle so there is no SKIP path here.
//
// PART_OF is NOT touched in this phase (the room-lineage joint gets its OWN type);
// typed-domain.cjs stays the domain-taxonomy consumer of PART_OF unchanged.

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

console.log('test-edges-room-lineage-floor');

// (1) The new room-lineage member is present.
check('NESTED_WITHIN is in ALLOWED_EDGE_TYPES', () => {
  assert.equal(ALLOWED_EDGE_TYPES.has('NESTED_WITHIN'), true, 'missing NESTED_WITHIN');
});

// (2) The FLOOR: every prior member is STILL present (additive, never-delete).
//     The full vocabulary through the Phase 168 CONVERGES / INVALIDATES / ENABLES
//     reconciliation, including the Phase 150.8 REFINES / ROOT_CAUSES / INSTANTIATES
//     trio and the Phase 163 DECOMPOSED_INTO / PART_OF / TAGGED_WITH / RELATED_TO quad.
const FLOOR = [
  'DEFERRED', 'REJECTED', 'DERIVED_FROM', 'FILED_AS_DECISION', 'FOLLOWS_FROM',
  'OPERATOR_TRANSITION', 'INFORMS', 'REJECTED_BECAUSE', 'CONTRADICTS', 'SUPERSEDES',
  'AFFILIATED_WITH', 'PIVOTED', 'SELECTED_REACH', 'FEEDS_INTO', 'VALIDATES',
  'STATES', 'SUPPORTS', 'DESCRIBES', 'REFINES', 'ROOT_CAUSES', 'INSTANTIATES',
  'DECOMPOSED_INTO', 'PART_OF', 'TAGGED_WITH', 'RELATED_TO',
  'CONVERGES', 'INVALIDATES', 'ENABLES',
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

// (4) Live write: writeEdge accepts a room->room NESTED_WITHIN lineage edge and the
//     enum/scalar props round-trip through the properties JSON (Part 8 enum/scalar-
//     only: a relation enum + the parent slug handle, never prose, never a room body).
check('writeEdge accepts a room->room NESTED_WITHIN + props round-trip', () => {
  const db = freshEdgesDb();
  const r = writeEdge(db, {
    source_id: 'room:child',
    target_id: 'room:parent',
    edge_type: 'NESTED_WITHIN',
    properties: { relation: 'nested', parent: 'parent' },
  });
  assert.equal(r.ok, true, `expected ok:true, got ${JSON.stringify(r)}`);
  assert.equal(r.type, 'NESTED_WITHIN');
  assert.equal(r.source, 'room:child');
  assert.equal(r.target, 'room:parent');
  const row = db.prepare(
    "SELECT properties FROM edges WHERE source = ? AND target = ? AND type = 'NESTED_WITHIN'"
  ).get('room:child', 'room:parent');
  assert.ok(row, 'the NESTED_WITHIN edge must be queryable');
  const props = JSON.parse(row.properties);
  assert.equal(props.relation, 'nested', 'relation enum must round-trip');
  assert.equal(props.parent, 'parent', 'parent slug scalar must round-trip');
  db.close();
});

// (5) Honest-negative: a made-up lineage edge type is REJECTED by the closed-set gate.
check('writeEdge rejects a made-up lineage edge type (invalid_edge_type)', () => {
  const db = freshEdgesDb();
  const r = writeEdge(db, {
    source_id: 'room:child', target_id: 'room:parent',
    edge_type: 'MADE_UP_LINEAGE_EDGE', properties: {},
  });
  assert.equal(r.ok, false, 'a made-up lineage edge type must be rejected');
  assert.equal(r.reason, 'invalid_edge_type', 'rejection reason names the allow-list gate');
  db.close();
});

console.log(`\nPASS (${pass}/5)`);
