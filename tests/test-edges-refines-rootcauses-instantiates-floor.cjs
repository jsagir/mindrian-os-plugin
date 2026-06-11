'use strict';
// Phase 150.8-02 Task 2 -- REFINES / ROOT_CAUSES / INSTANTIATES additive-floor test.
//
// The Meeting Micro-Knowledge DIKW Filing amendment (150.8-02-PLAN.md, DIKW-04)
// moves a FROZEN constitutional set: it adds three Knowledge-rung relationship
// edge types to lib/core/navigation/edges.cjs::ALLOWED_EDGE_TYPES. This was a
// NAVIGATOR-GATED change (blocking AskUserQuestion approval D-150.8, 2026-06-12,
// mirroring the Phase 148 D-09 reach-count amendment) -- code-wise additive and
// reversible, but constitutionally a Part 4 + Phase 108 frozen-taxonomy move.
//
// This is a FLOOR test (per the edges.cjs "Tests assert a FLOOR ... not an exact
// size" contract): it asserts the three new members are present AND that every
// prior member is STILL present (additive / never-delete, mirroring the Phase
// 139-03 AFFILIATED_WITH floor test). It also asserts the Set is still a frozen
// Set instance so a future edit cannot silently swap it for a mutable one, plus
// the TV-01 edge round-trip (valid_from / valid_until ride the existing edge
// properties JSON, DIKW-03 edge half) and an honest-negative made-up-type reject.
//
// NEVER asserts .size (Pitfall 3). NO em-dashes. node:sqlite unavailable -> the
// live-write checks are the only ones that need it; they construct a bare
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

console.log('test-edges-refines-rootcauses-instantiates-floor');

// (1) The three new members are present.
check('REFINES / ROOT_CAUSES / INSTANTIATES are in ALLOWED_EDGE_TYPES', () => {
  assert.equal(ALLOWED_EDGE_TYPES.has('REFINES'), true, 'missing REFINES');
  assert.equal(ALLOWED_EDGE_TYPES.has('ROOT_CAUSES'), true, 'missing ROOT_CAUSES');
  assert.equal(ALLOWED_EDGE_TYPES.has('INSTANTIATES'), true, 'missing INSTANTIATES');
});

// (2) The FLOOR: every prior member is STILL present (additive, never-delete).
//     The full vocabulary through STATES / SUPPORTS / DESCRIBES plus the
//     PIVOTED / SELECTED_REACH / FEEDS_INTO / VALIDATES additions.
const FLOOR = [
  'DEFERRED', 'REJECTED', 'DERIVED_FROM', 'FILED_AS_DECISION', 'FOLLOWS_FROM',
  'OPERATOR_TRANSITION', 'INFORMS', 'REJECTED_BECAUSE', 'CONTRADICTS', 'SUPERSEDES',
  'AFFILIATED_WITH', 'PIVOTED', 'SELECTED_REACH', 'FEEDS_INTO', 'VALIDATES',
  'STATES', 'SUPPORTS', 'DESCRIBES',
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

// (4) Live write: writeEdge accepts a REFINES edge carrying valid_from /
//     valid_until (TV-01) and they round-trip through the properties JSON. The
//     edges table FK-references nodes(id); with foreign_keys OFF on this bare
//     in-memory handle the insert needs no node rows.
check('writeEdge accepts REFINES + valid_from/valid_until round-trip (TV-01)', () => {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type));"
  );
  const r = writeEdge(db, {
    source_id: 'claim:refining',
    target_id: 'claim:prior',
    edge_type: 'REFINES',
    properties: { reason: 'tightens_conditions', valid_from: '2026-06-11', valid_until: '' },
  });
  assert.equal(r.ok, true, `expected ok:true, got ${JSON.stringify(r)}`);
  assert.equal(r.type, 'REFINES');
  const row = db.prepare(
    "SELECT properties FROM edges WHERE source = ? AND target = ? AND type = 'REFINES'"
  ).get('claim:refining', 'claim:prior');
  assert.ok(row, 'the REFINES edge must be queryable');
  const props = JSON.parse(row.properties);
  assert.equal(props.valid_from, '2026-06-11', 'valid_from must round-trip');
  assert.equal(props.valid_until, '', 'valid_until must round-trip');
  assert.equal(props.reason, 'tightens_conditions', 'reason scalar must round-trip');
  db.close();
});

// (5) Live write: ROOT_CAUSES + INSTANTIATES also accepted (directional + example).
check('writeEdge accepts ROOT_CAUSES and INSTANTIATES', () => {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type));"
  );
  const rc = writeEdge(db, {
    source_id: 'claim:cause', target_id: 'claim:effect',
    edge_type: 'ROOT_CAUSES', properties: { mechanism: 'direct' },
  });
  assert.equal(rc.ok, true, `expected ROOT_CAUSES ok:true, got ${JSON.stringify(rc)}`);
  const ri = writeEdge(db, {
    source_id: 'claim:example', target_id: 'claim:abstract',
    edge_type: 'INSTANTIATES', properties: { kind: 'concrete_example' },
  });
  assert.equal(ri.ok, true, `expected INSTANTIATES ok:true, got ${JSON.stringify(ri)}`);
  db.close();
});

// (6) Honest-negative: a made-up type is REJECTED by the closed-set gate.
check('writeEdge rejects a made-up edge type (invalid_edge_type)', () => {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type));"
  );
  const r = writeEdge(db, {
    source_id: 'claim:a', target_id: 'claim:b',
    edge_type: 'GENERALIZES', properties: {},
  });
  assert.equal(r.ok, false, 'a deferred/made-up type must be rejected');
  assert.equal(r.reason, 'invalid_edge_type', 'rejection reason names the allow-list gate');
  db.close();
});

console.log(`\nPASS (${pass}/6)`);
