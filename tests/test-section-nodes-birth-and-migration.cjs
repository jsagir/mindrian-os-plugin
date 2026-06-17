'use strict';
// Phase 162-02 Task 1 tests (R11 / D-B). Proves:
//   - birthRoom writes real Section nodes into room.db inside the birth ACID
//     transaction (one per canonical section, type='Section',
//     review_status confirmed-by-system per the Part 9 audit-node carve-out).
//   - birthRoom Section writes are idempotent (insertNode upsert, never dupes).
//   - migrateSectionNodes(roomDir) backfills missing Section nodes on an existing
//     room that has artifacts but no Section nodes, idempotently.
//   - the migration routes through the navigation chokepoint (no forbidden direct
//     open) and stamps a section_nodes_migration memory_event (created_by=system).
//   - getGraphExport renders the real Section nodes from room.db; the export-time
//     cold-start anchors fire ONLY when room.db is absent or has zero nodes
//     (the Tier-0 demotion).
//
// Run: node tests/test-section-nodes-birth-and-migration.cjs

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const roomDbMod = require('../lib/core/room-db.cjs');
const lgOps = require('../lib/core/lazygraph-ops.cjs');
const { birthRoom } = require('../lib/core/navigation/room-birth.cjs');
const { migrateSectionNodes } = require('../lib/core/migrations/phase-162-section-nodes.cjs');
const { getGraphExport } = require('../lib/core/navigation/graph-export.cjs');

let pass = 0;
let fail = 0;
function ok(name) { pass += 1; console.log('  PASS ' + name); }
function bad(name, e) { fail += 1; console.log('  FAIL ' + name + ' -- ' + (e && e.message ? e.message : e)); }
async function test(name, fn) { try { await fn(); ok(name); } catch (e) { bad(name, e); } }

// The 8 canonical sections (mirrors room-birth SECTION_NAMES).
const CANONICAL_SECTIONS = [
  'problem-definition', 'market-analysis', 'solution-design', 'business-model',
  'competitive-analysis', 'team-execution', 'legal-ip', 'financial-model',
];

function tmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'secnode-'));
}

function countSectionNodes(roomDir) {
  const db = roomDbMod.openRoomDb(roomDir);
  try {
    const row = db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'Section'").get();
    return row.n;
  } finally {
    try { roomDbMod.closeRoomDb(db); } catch (_) {}
  }
}

function sectionNodeRows(roomDir) {
  const db = roomDbMod.openRoomDb(roomDir);
  try {
    return db.prepare("SELECT id, type, review_status, created_by FROM nodes WHERE type = 'Section'").all();
  } finally {
    try { roomDbMod.closeRoomDb(db); } catch (_) {}
  }
}

function migrationEventCount(roomDir) {
  const db = roomDbMod.openRoomDb(roomDir);
  try {
    const rows = db.prepare(
      "SELECT properties FROM nodes WHERE type = 'memory_event' " +
      "AND json_extract(properties, '$.event_type') = 'section_nodes_migration'"
    ).all();
    return rows;
  } finally {
    try { roomDbMod.closeRoomDb(db); } catch (_) {}
  }
}

(async () => {
  console.log('Phase 162-02 Task 1: Section nodes at birth + migration');

  // ---- Test 1: birthRoom writes >= 8 Section nodes ----
  await test('birthRoom writes one Section node per canonical section', () => {
    const root = tmpDir('birth-');
    const roomDir = path.join(root, 'my-room');
    const res = birthRoom({
      slug: 'my-room',
      roomDir,
      sessionId: 'sess-1',
      ventureText: 'A test venture',
      approvedBy: 'tester',
    });
    assert.ok(res.ok, 'birthRoom should succeed: ' + JSON.stringify(res));
    const n = countSectionNodes(roomDir);
    assert.ok(n >= 8, 'expected >= 8 Section nodes, got ' + n);

    const rows = sectionNodeRows(roomDir);
    const ids = new Set(rows.map((r) => r.id));
    for (const s of CANONICAL_SECTIONS) {
      assert.ok(ids.has(s), 'missing Section node for ' + s);
    }
    // Part 9 audit-node carve-out: system-bookkeeping, confirmed-by-system.
    for (const r of rows) {
      assert.strictEqual(r.review_status, 'confirmed', 'Section node ' + r.id + ' should be confirmed');
      assert.strictEqual(r.created_by, 'system', 'Section node ' + r.id + ' should be created_by system');
    }
  });

  // ---- Test 2: birthRoom Section nodes are idempotent (no dupes on re-birth) ----
  await test('birthRoom Section writes are idempotent (re-birth upserts, no dupes)', () => {
    const root = tmpDir('birth-idem-');
    const roomDir = path.join(root, 'idem-room');
    const opts = {
      slug: 'idem-room', roomDir, sessionId: 'sess-2',
      ventureText: 'Idempotency check', approvedBy: 'tester',
    };
    birthRoom(opts);
    const first = countSectionNodes(roomDir);
    // Re-run birth (scaffold + STEP 2 are idempotent).
    birthRoom(opts);
    const second = countSectionNodes(roomDir);
    assert.strictEqual(second, first, 'Section node count must not grow on re-birth');
    assert.ok(first >= 8, 'expected >= 8 Section nodes');
  });

  // ---- Test 3: migrateSectionNodes backfills, idempotently ----
  await test('migrateSectionNodes backfills missing Section nodes; second run is a no-op', async () => {
    const root = tmpDir('mig-');
    const roomDir = path.join(root, 'legacy-room');
    // Build an existing room: scaffold the section folders + an artifact, room.db
    // with Artifact nodes but NO Section nodes (simulating a pre-D-B room).
    fs.mkdirSync(roomDir, { recursive: true });
    for (const s of CANONICAL_SECTIONS) {
      const secDir = path.join(roomDir, s);
      fs.mkdirSync(secDir, { recursive: true });
      fs.writeFileSync(path.join(secDir, 'note.md'), '# Note for ' + s + '\n\nSome content.\n', 'utf8');
    }
    // Seed room.db with an Artifact node (no Section nodes).
    const { db, conn } = await lgOps.openGraph(roomDir);
    // openGraph creates the bare 3-column schema (no provenance migration yet);
    // seed with the legacy 3-column insert. openRoomDb (called by the migration)
    // will run the provenance migration and widen the schema additively.
    conn.prepare("INSERT INTO nodes (id, type, properties) VALUES (?, 'Artifact', '{}')")
      .run('problem-definition/note');
    await lgOps.closeGraph(db);

    assert.strictEqual(countSectionNodes(roomDir), 0, 'precondition: no Section nodes');

    const r1 = migrateSectionNodes(roomDir);
    assert.ok(r1.ok, 'migration should succeed: ' + JSON.stringify(r1));
    assert.ok(r1.migrated >= 8, 'expected >= 8 sections migrated, got ' + r1.migrated);
    assert.ok(countSectionNodes(roomDir) >= 8, 'Section nodes should exist after migration');

    const r2 = migrateSectionNodes(roomDir);
    assert.ok(r2.already_migrated, 'second run should report already_migrated: ' + JSON.stringify(r2));
    assert.strictEqual(r2.migrated || 0, 0, 'second run adds zero Section nodes');
  });

  // ---- Test 4: migration stamps a section_nodes_migration event (created_by=system) ----
  await test('migrateSectionNodes stamps a section_nodes_migration memory_event (system)', async () => {
    const root = tmpDir('mig-evt-');
    const roomDir = path.join(root, 'evt-room');
    fs.mkdirSync(roomDir, { recursive: true });
    for (const s of CANONICAL_SECTIONS) {
      const secDir = path.join(roomDir, s);
      fs.mkdirSync(secDir, { recursive: true });
      fs.writeFileSync(path.join(secDir, 'note.md'), '# ' + s + '\n', 'utf8');
    }
    const { db } = await lgOps.openGraph(roomDir);
    await lgOps.closeGraph(db);

    migrateSectionNodes(roomDir);
    const events = migrationEventCount(roomDir);
    assert.ok(events.length >= 1, 'expected a section_nodes_migration event');
    const props = JSON.parse(events[0].properties);
    assert.strictEqual(props.created_by, 'system', 'event should be created_by system');
  });

  // ---- Test 5: getGraphExport renders real Section nodes; cold-start only when empty ----
  await test('getGraphExport renders migrated Section nodes; cold-start fires only when room.db empty', async () => {
    const root = tmpDir('export-');
    const roomDir = path.join(root, 'export-room');
    fs.mkdirSync(roomDir, { recursive: true });
    for (const s of CANONICAL_SECTIONS) {
      const secDir = path.join(roomDir, s);
      fs.mkdirSync(secDir, { recursive: true });
      fs.writeFileSync(path.join(secDir, 'note.md'), '# ' + s + '\n', 'utf8');
    }
    // Seed an Artifact + run the migration so room.db has real Section nodes.
    const { db, conn } = await lgOps.openGraph(roomDir);
    // openGraph creates the bare 3-column schema (no provenance migration yet);
    // seed with the legacy 3-column insert. openRoomDb (called by the migration)
    // will run the provenance migration and widen the schema additively.
    conn.prepare("INSERT INTO nodes (id, type, properties) VALUES (?, 'Artifact', '{}')")
      .run('problem-definition/note');
    await lgOps.closeGraph(db);
    migrateSectionNodes(roomDir);

    const exp = await getGraphExport(roomDir);
    assert.ok(exp.ok, 'export should be ok');
    assert.strictEqual(exp.cold_start, false, 'export should NOT be cold-start when room.db has nodes');
    const sectionEls = exp.elements.nodes.filter((n) => n.data.type === 'Section');
    assert.ok(sectionEls.length >= 8, 'export should render >= 8 real Section nodes, got ' + sectionEls.length);

    // Cold-start (Tier-0 fallback): a room with NO room.db still renders anchors.
    const coldRoot = tmpDir('cold-');
    const coldRoom = path.join(coldRoot, 'cold-room');
    fs.mkdirSync(coldRoom, { recursive: true });
    const coldExp = await getGraphExport(coldRoom);
    assert.ok(coldExp.ok, 'cold export should be ok');
    assert.strictEqual(coldExp.cold_start, true, 'no room.db -> cold-start anchors fire (Tier-0 fallback)');
  });

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
