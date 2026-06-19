'use strict';
// Phase 169-01 Wave 0 RED stub -- GDH-09 (the NESTED_WITHIN lineage edge from the heal).
//
// IFACE (169-01 shared_iface_contract): healRoom (graph-self-heal.cjs) writes the
//   GRAPH-NAVIGABLE joint -- the NESTED_WITHIN typed edge room:<child> ->
//   room:<parent> via navigation.writeEdge. The edge is present + walkable; its
//   properties are enum/scalar only (no prose). NESTED_WITHIN is a frozen
//   ALLOWED_EDGE_TYPES member (Plan 00, already minted).
//
// RED-by-require until Plan 07 ships graph-self-heal.cjs. No em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
// RED until Plan 07 ships graph-self-heal.cjs.
const { healRoom } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-self-heal.cjs'));

let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('  ok -', label); }

console.log('test-room-lineage-edge (GDH-09 NESTED_WITHIN)');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lineage-169-'));
const parent = path.join(tmp, 'parent-room');
const child = path.join(parent, 'child-room');
fs.mkdirSync(child, { recursive: true });
fs.writeFileSync(path.join(parent, '.room-root'), JSON.stringify({ slug: 'parent-room' }));
fs.writeFileSync(path.join(child, 'one.md'), '# one\n');
fs.writeFileSync(path.join(child, 'two.md'), '# two\n');

let healed;
check('healRoom (with approvedBy) succeeds and reports a lineage edge', () => {
  healed = healRoom({ folder: child, parentRoomDir: parent, slug: 'child-room', approvedBy: 'tester', runTimeline: false });
  assert.equal(healed.ok, true, `healRoom must succeed, got ${JSON.stringify(healed)}`);
  assert.ok(healed.lineageEdge, 'healRoom must report the NESTED_WITHIN lineage edge it wrote');
});

check('a NESTED_WITHIN edge room:<child> -> room:<parent> is present in the child room.db', () => {
  const db = openRoomDb(healed.roomDir || child);
  const row = db.prepare(
    "SELECT source, target, type, properties FROM edges WHERE type = 'NESTED_WITHIN'"
  ).get();
  closeRoomDb(db);
  assert.ok(row, 'a NESTED_WITHIN edge must exist in the child room.db');
  assert.equal(row.source, 'room:child-room', 'source is the child room node');
  assert.equal(row.target, 'room:parent-room', 'target is the parent room node');
});

check('the lineage edge properties are enum/scalar only (no prose)', () => {
  const db = openRoomDb(healed.roomDir || child);
  const row = db.prepare("SELECT properties FROM edges WHERE type = 'NESTED_WITHIN'").get();
  closeRoomDb(db);
  const props = JSON.parse(row.properties || '{}');
  for (const v of Object.values(props)) {
    assert.ok(['string', 'number', 'boolean'].includes(typeof v), 'props must be enum/scalar only');
    if (typeof v === 'string') {
      assert.ok(v.length <= 64, 'a lineage prop string must be a short handle/enum, never prose');
    }
  }
});

console.log(`\nPASS (${pass}/3)`);
