'use strict';
// Phase 169-01 Wave 0 RED stub -- GDH-03 (rollupSubRooms one-hop, read-side ATTACH).
//
// IFACE (169-01 shared_iface_contract): lib/core/graph-derivation.cjs
//   rollupSubRooms(parentRoomDir) -> {edges}  -- a RECURSIVE, TRANSITIVE
//   read-side ATTACH (D-169-11). It walks the NESTED_WITHIN child links of
//   parentRoomDir and unions the children's edges WITHOUT merging rows into the
//   parent (read-side ATTACH only); idempotent re-apply at each nesting level.
//
// RED-by-require until Plan 04 ships graph-derivation.cjs. This stub asserts the
// one-hop case: build two temp room.db via room-db.openRoomDb, write an edge in
// the sub-room, write a NESTED_WITHIN child->parent link, and assert
// rollupSubRooms(parent) sees the sub-room edge while the parent's own edge rows
// are unchanged (parent never mutated). No em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { writeEdge } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));
// RED until Plan 04 ships graph-derivation.cjs (rollupSubRooms).
const { rollupSubRooms } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-derivation.cjs'));

let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('  ok -', label); }

console.log('test-subroom-rollup (GDH-03)');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'subroll-169-'));
const parent = path.join(tmp, 'parent-room');
const child = path.join(parent, 'child-room');
fs.mkdirSync(child, { recursive: true });
fs.writeFileSync(path.join(parent, '.room-root'), JSON.stringify({ slug: 'parent-room' }));
fs.writeFileSync(path.join(child, '.room-root'), JSON.stringify({ slug: 'child-room', parent: 'parent-room' }));

// Seed the child db with a distinct CONVERGES edge, and the parent with a
// NESTED_WITHIN child->parent lineage link.
const childDb = openRoomDb(child);
writeEdge(childDb, { source_id: 'artifact:child-a', target_id: 'section:child-b', edge_type: 'CONVERGES', properties: { relation: 'convergence' } });
const childEdgeRows = childDb.prepare("SELECT COUNT(*) AS n FROM edges").get().n;
closeRoomDb(childDb);

const parentDb = openRoomDb(parent);
writeEdge(parentDb, { source_id: 'room:child-room', target_id: 'room:parent-room', edge_type: 'NESTED_WITHIN', properties: { relation: 'nested', parent: 'parent-room' } });
const parentEdgeCountBefore = parentDb.prepare("SELECT COUNT(*) AS n FROM edges").get().n;
closeRoomDb(parentDb);

check('rollupSubRooms(parent) returns the sub-room CONVERGES edge', () => {
  const res = rollupSubRooms(parent);
  assert.ok(res && Array.isArray(res.edges), 'rollupSubRooms must return {edges:[]}');
  const sawChildEdge = res.edges.some(e =>
    (e.type === 'CONVERGES' || e.edge_type === 'CONVERGES') &&
    JSON.stringify(e).includes('child-a'));
  assert.ok(sawChildEdge, 'the parent rollup must see the sub-room CONVERGES edge via read-side ATTACH');
});

check('parent db rows are UNCHANGED (read-side ATTACH never merges)', () => {
  const db = openRoomDb(parent);
  const after = db.prepare("SELECT COUNT(*) AS n FROM edges").get().n;
  closeRoomDb(db);
  assert.equal(after, parentEdgeCountBefore,
    'rollupSubRooms must NOT copy sub-room rows into the parent db');
  assert.ok(childEdgeRows >= 1, 'the sub-room edge was seeded');
});

console.log(`\nPASS (${pass}/2)`);
