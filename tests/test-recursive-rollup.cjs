'use strict';
// Phase 169-01 Wave 0 RED stub -- GDH-03 / D-169-11 (rollupSubRooms TRANSITIVE recursion).
//
// IFACE (169-01 shared_iface_contract): lib/core/graph-derivation.cjs
//   rollupSubRooms(parentRoomDir) -> {edges}  -- a RECURSIVE, TRANSITIVE
//   read-side ATTACH (D-169-11 arbitrary depth): it walks the NESTED_WITHIN child
//   links of parentRoomDir, and for each child recurses into the child's own
//   sub-rooms, so a sub-sub-room's edges roll up to the TOP-level parent. NEVER
//   merges rows into the parent (read-side ATTACH only).
//
// RED-by-require until Plan 04 ships rollupSubRooms with TRANSITIVE recursion.
// Builds a 3-level topology top -> mid -> leaf and asserts a LEAF edge reaches
// the TOP-level rollup (arbitrary depth, not one hop). No em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const { writeEdge } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));
// RED until Plan 04 ships graph-derivation.cjs.
const { rollupSubRooms } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-derivation.cjs'));

let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('  ok -', label); }

console.log('test-recursive-rollup (GDH-03 / D-169-11 transitive)');

// Build top -> mid -> leaf, each with its own .room-root and room.db, each child
// carrying a NESTED_WITHIN edge UP to its parent.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'recroll-169-'));
const top = path.join(tmp, 'top');
const mid = path.join(top, 'mid');
const leaf = path.join(mid, 'leaf');
fs.mkdirSync(leaf, { recursive: true });
fs.writeFileSync(path.join(top, '.room-root'), JSON.stringify({ slug: 'top' }));
fs.writeFileSync(path.join(mid, '.room-root'), JSON.stringify({ slug: 'mid', parent: 'top' }));
fs.writeFileSync(path.join(leaf, '.room-root'), JSON.stringify({ slug: 'leaf', parent: 'mid' }));

// mid -> top lineage in top's db; leaf -> mid lineage in mid's db.
const topDb = openRoomDb(top);
writeEdge(topDb, { source_id: 'room:mid', target_id: 'room:top', edge_type: 'NESTED_WITHIN', properties: { relation: 'nested', parent: 'top' } });
const topRowsBefore = topDb.prepare("SELECT COUNT(*) AS n FROM edges").get().n;
closeRoomDb(topDb);

const midDb = openRoomDb(mid);
writeEdge(midDb, { source_id: 'room:leaf', target_id: 'room:mid', edge_type: 'NESTED_WITHIN', properties: { relation: 'nested', parent: 'mid' } });
closeRoomDb(midDb);

// A distinct edge in the LEAF that must transitively reach the TOP rollup.
const leafDb = openRoomDb(leaf);
writeEdge(leafDb, { source_id: 'artifact:leaf-deep', target_id: 'section:leaf-x', edge_type: 'INFORMS', properties: { relation: 'informs' } });
closeRoomDb(leafDb);

check('rollupSubRooms(top) TRANSITIVELY sees the LEAF edge (arbitrary depth)', () => {
  const res = rollupSubRooms(top);
  assert.ok(res && Array.isArray(res.edges), 'rollupSubRooms must return {edges:[]}');
  const sawLeaf = res.edges.some(e => JSON.stringify(e).includes('leaf-deep'));
  assert.ok(sawLeaf, 'a sub-sub-room (leaf) edge must roll up to the TOP-level parent (transitive)');
});

check('the TOP db rows are UNCHANGED (read-side ATTACH only, never merged)', () => {
  const db = openRoomDb(top);
  const after = db.prepare("SELECT COUNT(*) AS n FROM edges").get().n;
  closeRoomDb(db);
  assert.equal(after, topRowsBefore, 'rollupSubRooms must NOT merge descendant rows into the top db');
});

console.log(`\nPASS (${pass}/2)`);
