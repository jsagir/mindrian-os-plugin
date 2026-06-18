'use strict';
// Phase 163-01 Task 1 -- DECOMPOSED_INTO / PART_OF / TAGGED_WITH / RELATED_TO
// additive-floor test (the four domain-taxonomy relationship edges, D-163-03).
//
// The Trending-to-the-Absurd Harness amendment (163-01-PLAN.md, D-163-03) moves a
// FROZEN constitutional set: it adds four domain-taxonomy edge types to
// lib/core/navigation/edges.cjs::ALLOWED_EDGE_TYPES so domains/subdomains/focus_areas
// become first-class connected graph citizens (D-163-01). This is a NAVIGATOR-GATED
// change (a blocking ratification at the Task 3 checkpoint, mirroring the Phase 150.8
// D-150.8 trio and the Phase 148 D-09 reach-count amendment) -- code-wise additive
// and reversible, but constitutionally a Part 4 + Phase 108 frozen-taxonomy move.
//
// This is a FLOOR test (per the edges.cjs "Tests assert a FLOOR ... not an exact
// size" contract): it asserts the four new members are present AND that every prior
// member is STILL present (additive / never-delete, mirroring the Phase 150.8
// REFINES / ROOT_CAUSES / INSTANTIATES floor test). It also asserts the Set is still
// a frozen Set instance so a future edit cannot silently swap it for a mutable one,
// plus a live writeEdge round-trip for each new edge and an honest-negative
// made-up-type reject.
//
// NEVER asserts .size (additive extensions must not regress the baseline). NO
// em-dashes. node:sqlite is used for the live-write checks; they construct a bare
// in-memory handle so there is no SKIP path here.

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

console.log('test-edges-domain-taxonomy-floor');

// (1) The four new members are present.
check('DECOMPOSED_INTO / PART_OF / TAGGED_WITH / RELATED_TO are in ALLOWED_EDGE_TYPES', () => {
  assert.equal(ALLOWED_EDGE_TYPES.has('DECOMPOSED_INTO'), true, 'missing DECOMPOSED_INTO');
  assert.equal(ALLOWED_EDGE_TYPES.has('PART_OF'), true, 'missing PART_OF');
  assert.equal(ALLOWED_EDGE_TYPES.has('TAGGED_WITH'), true, 'missing TAGGED_WITH');
  assert.equal(ALLOWED_EDGE_TYPES.has('RELATED_TO'), true, 'missing RELATED_TO');
});

// (2) The FLOOR: every prior member is STILL present (additive, never-delete).
//     The full vocabulary through STATES / SUPPORTS / DESCRIBES plus the Phase
//     150.8 REFINES / ROOT_CAUSES / INSTANTIATES trio.
const FLOOR = [
  'DEFERRED', 'REJECTED', 'DERIVED_FROM', 'FILED_AS_DECISION', 'FOLLOWS_FROM',
  'OPERATOR_TRANSITION', 'INFORMS', 'REJECTED_BECAUSE', 'CONTRADICTS', 'SUPERSEDES',
  'AFFILIATED_WITH', 'PIVOTED', 'SELECTED_REACH', 'FEEDS_INTO', 'VALIDATES',
  'STATES', 'SUPPORTS', 'DESCRIBES', 'REFINES', 'ROOT_CAUSES', 'INSTANTIATES',
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

// (4) Live write: writeEdge accepts a DECOMPOSED_INTO hierarchy edge
//     (domain -> subdomain) and the taxonomy-node-id + relation enum props
//     round-trip through the properties JSON (Part 8 enum/scalar-only).
check('writeEdge accepts DECOMPOSED_INTO (domain->subdomain) + props round-trip', () => {
  const db = freshEdgesDb();
  const r = writeEdge(db, {
    source_id: 'domain:biotech',
    target_id: 'subdomain:cell-therapy',
    edge_type: 'DECOMPOSED_INTO',
    properties: { relation: 'hierarchy', taxonomy_node: 'subdomain:cell-therapy' },
  });
  assert.equal(r.ok, true, `expected ok:true, got ${JSON.stringify(r)}`);
  assert.equal(r.type, 'DECOMPOSED_INTO');
  const row = db.prepare(
    "SELECT properties FROM edges WHERE source = ? AND target = ? AND type = 'DECOMPOSED_INTO'"
  ).get('domain:biotech', 'subdomain:cell-therapy');
  assert.ok(row, 'the DECOMPOSED_INTO edge must be queryable');
  const props = JSON.parse(row.properties);
  assert.equal(props.relation, 'hierarchy', 'relation enum must round-trip');
  assert.equal(props.taxonomy_node, 'subdomain:cell-therapy', 'taxonomy node id must round-trip');
  db.close();
});

// (5) Live write: PART_OF + TAGGED_WITH + RELATED_TO are also accepted
//     (structural membership / lightweight tag / symmetric cross-domain relatedness).
check('writeEdge accepts PART_OF, TAGGED_WITH, and RELATED_TO', () => {
  const db = freshEdgesDb();
  const rp = writeEdge(db, {
    source_id: 'opportunity:opp-01', target_id: 'subdomain:cell-therapy',
    edge_type: 'PART_OF', properties: { relation: 'membership' },
  });
  assert.equal(rp.ok, true, `expected PART_OF ok:true, got ${JSON.stringify(rp)}`);
  const rt = writeEdge(db, {
    source_id: 'claim:c-12', target_id: 'domain:biotech',
    edge_type: 'TAGGED_WITH', properties: { relation: 'tag' },
  });
  assert.equal(rt.ok, true, `expected TAGGED_WITH ok:true, got ${JSON.stringify(rt)}`);
  const rr = writeEdge(db, {
    source_id: 'domain:biotech', target_id: 'domain:materials-science',
    edge_type: 'RELATED_TO', properties: { relation: 'cross_domain' },
  });
  assert.equal(rr.ok, true, `expected RELATED_TO ok:true, got ${JSON.stringify(rr)}`);
  db.close();
});

// (6) Honest-negative: a made-up domain edge type is REJECTED by the closed-set gate.
check('writeEdge rejects a made-up domain edge type (invalid_edge_type)', () => {
  const db = freshEdgesDb();
  const r = writeEdge(db, {
    source_id: 'domain:a', target_id: 'domain:b',
    edge_type: 'MADE_UP_DOMAIN_EDGE', properties: {},
  });
  assert.equal(r.ok, false, 'a made-up domain edge type must be rejected');
  assert.equal(r.reason, 'invalid_edge_type', 'rejection reason names the allow-list gate');
  db.close();
});

console.log(`\nPASS (${pass}/6)`);
