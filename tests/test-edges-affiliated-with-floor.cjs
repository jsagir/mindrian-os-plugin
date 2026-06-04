'use strict';
// Phase 139-03 Task 1 -- AFFILIATED_WITH additive-floor test.
//
// The umbilical_storage LOCKED decision (139-CONTEXT.md) projects .umbilical
// cords into each room.db as AFFILIATED_WITH edges via
// lib/core/navigation/edges.cjs::writeEdge. AFFILIATED_WITH must therefore be a
// member of the frozen ALLOWED_EDGE_TYPES Set.
//
// This is a FLOOR test (per the edges.cjs "Tests assert a FLOOR ... not an exact
// size" contract): it asserts AFFILIATED_WITH is present AND that every prior
// member is STILL present (additive / never-delete, mirroring the Phase 131-01
// CONTRADICTS/SUPERSEDES additive idiom). It also asserts the Set is still a
// frozen Set instance so a future edit cannot silently swap it for a mutable one.

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

console.log('test-edges-affiliated-with-floor');

// (1) AFFILIATED_WITH is a member.
check('AFFILIATED_WITH is in ALLOWED_EDGE_TYPES', () => {
  assert.equal(ALLOWED_EDGE_TYPES.has('AFFILIATED_WITH'), true);
});

// (2) The FLOOR: every prior member is STILL present (additive, never-delete).
const FLOOR = [
  'DEFERRED', 'REJECTED', 'DERIVED_FROM', 'FILED_AS_DECISION', 'FOLLOWS_FROM',
  'OPERATOR_TRANSITION', 'INFORMS', 'REJECTED_BECAUSE', 'CONTRADICTS', 'SUPERSEDES',
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

// (4) Live write: a trivially-constructable node:sqlite handle exists, so assert
//     writeEdge no longer rejects AFFILIATED_WITH with invalid_edge_type. The
//     edges table FK-references nodes(id); with foreign_keys OFF on this bare
//     in-memory handle the insert needs no node rows. (The full FK-ON projection
//     path is covered by Task 2's projection test against a real room.db.)
check('writeEdge accepts AFFILIATED_WITH (no longer invalid_edge_type)', () => {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(
    "CREATE TABLE edges (source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, " +
    "properties TEXT DEFAULT '{}', PRIMARY KEY(source, target, type));"
  );
  const r = writeEdge(db, {
    source_id: 'project:demo',
    target_id: 'room:demo',
    edge_type: 'AFFILIATED_WITH',
    properties: { relation: 'code', born: '2026-06-04' },
  });
  assert.equal(r.ok, true, `expected ok:true, got ${JSON.stringify(r)}`);
  assert.equal(r.type, 'AFFILIATED_WITH');
  db.close();
});

console.log(`\nPASS (${pass}/4)`);
