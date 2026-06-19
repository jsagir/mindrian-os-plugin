'use strict';
// Phase 169-01 Wave 0 RED stub -- D-169-11 (depth>=2 full-citizen acceptance).
//
// IFACE (169-01 shared_iface_contract): the depth>=2 full-citizen acceptance.
//   A 3-level topology motj-ecosystem -> jonathan-contractor-motj -> b2-journey
//   is built and EACH nested level is a FULL CITIZEN: ROOM.md + own room.db +
//   per-section FEYNMAN + ## Timeline (auto) + NESTED_WITHIN up + visible from
//   the parent rollup down. The heal REUSES birthRoom + timeline-runner
//   (D-169-10) so a healed room has the byte-shape of a born room.
//
// RED-by-require until Plan 07 ships graph-self-heal.cjs (healRoom) and Plan 04
// ships rollupSubRooms. Builds the topology by healing each sentinel-less level
// and asserts the full-citizen markers per nested level. No em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
// RED until Plan 07 (healRoom) + Plan 04 (rollupSubRooms) ship.
const { healRoom } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-self-heal.cjs'));
const { rollupSubRooms } = require(path.join(REPO_ROOT, 'lib', 'core', 'graph-derivation.cjs'));

let pass = 0;
function check(label, fn) { fn(); pass += 1; console.log('  ok -', label); }

console.log('test-depth2-full-citizen (D-169-11)');

// Build the 3-level shape: top is a real room; mid + leaf are sentinel-less
// artifact folders to be healed into full-citizen child rooms.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'depth2-169-'));
const top = path.join(tmp, 'motj-ecosystem');
const mid = path.join(top, 'jonathan-contractor-motj');
const leaf = path.join(mid, 'b2-journey');
fs.mkdirSync(leaf, { recursive: true });
fs.writeFileSync(path.join(top, '.room-root'), JSON.stringify({ slug: 'motj-ecosystem' }));
fs.writeFileSync(path.join(mid, 'context.md'), '# mid context\n');
fs.writeFileSync(path.join(leaf, 'interview.md'), '# leaf interview\n');

function assertFullCitizen(roomDir, slug, parentNode) {
  // ROOM.md present.
  assert.ok(fs.existsSync(path.join(roomDir, 'ROOM.md')), `${slug}: ROOM.md present`);
  // own room.db present.
  assert.ok(fs.existsSync(path.join(roomDir, '.mindrian', 'room.db')), `${slug}: own room.db present`);
  // at least one per-section FEYNMAN.md present.
  const feynmans = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith('.')) walk(path.join(d, e.name));
      else if (e.isFile() && e.name === 'FEYNMAN.md') feynmans.push(path.join(d, e.name));
    }
  })(roomDir);
  assert.ok(feynmans.length >= 1, `${slug}: at least one per-section FEYNMAN.md present`);
  // the FEYNMAN body carries a ## Timeline (auto) section.
  const anyTimeline = feynmans.some(f => /##\s+Timeline \(auto\)/.test(fs.readFileSync(f, 'utf8')));
  assert.ok(anyTimeline, `${slug}: a FEYNMAN body carries the ## Timeline (auto) section`);
  // a NESTED_WITHIN edge UP to its parent.
  const db = openRoomDb(roomDir);
  const row = db.prepare("SELECT source, target FROM edges WHERE type = 'NESTED_WITHIN'").get();
  closeRoomDb(db);
  assert.ok(row, `${slug}: a NESTED_WITHIN edge up to the parent`);
  assert.equal(row.source, 'room:' + slug, `${slug}: lineage source is this room`);
  assert.equal(row.target, parentNode, `${slug}: lineage target is the parent room`);
}

let healedMid;
let healedLeaf;
check('the two nested levels heal into full-citizen child rooms', () => {
  healedMid = healRoom({ folder: mid, parentRoomDir: top, slug: 'jonathan-contractor-motj', approvedBy: 'tester', runTimeline: true });
  assert.equal(healedMid.ok, true, `mid heal must succeed, got ${JSON.stringify(healedMid)}`);
  healedLeaf = healRoom({ folder: leaf, parentRoomDir: mid, slug: 'b2-journey', approvedBy: 'tester', runTimeline: true });
  assert.equal(healedLeaf.ok, true, `leaf heal must succeed, got ${JSON.stringify(healedLeaf)}`);
});

check('the MID level is a FULL CITIZEN (ROOM.md + room.db + FEYNMAN + ## Timeline (auto) + NESTED_WITHIN up)', () => {
  assertFullCitizen(mid, 'jonathan-contractor-motj', 'room:motj-ecosystem');
});

check('the LEAF level is a FULL CITIZEN (ROOM.md + room.db + FEYNMAN + ## Timeline (auto) + NESTED_WITHIN up)', () => {
  assertFullCitizen(leaf, 'b2-journey', 'room:jonathan-contractor-motj');
});

check('the LEAF level is visible from the TOP rollup DOWN (transitive)', () => {
  // seed a distinct leaf edge then assert the top rollup sees it.
  const db = openRoomDb(leaf);
  const { writeEdge } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));
  writeEdge(db, { source_id: 'artifact:leaf-mark', target_id: 'section:leaf-y', edge_type: 'INFORMS', properties: { relation: 'informs' } });
  closeRoomDb(db);
  const res = rollupSubRooms(top);
  const sawLeaf = res.edges.some(e => JSON.stringify(e).includes('leaf-mark'));
  assert.ok(sawLeaf, 'the leaf edge must be visible from the top-level rollup (depth>=2 down)');
});

console.log(`\nPASS (${pass}/4)`);
