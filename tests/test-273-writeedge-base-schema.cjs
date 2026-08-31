'use strict';
// Phase 273 D-01 / D-01b / D-06 -- defect C2 (writeEdge throws against an
// openGraph base-schema handle).
//
// Requirements: CHOKE-04, CHOKE-05, CHOKE-06.
//
// RED BY DESIGN until plan 273-03 lands. Today writeEdge's INSERT names
// review_status unconditionally (lib/core/navigation/edges.cjs:835), so it
// throws "table edges has no column named review_status" against a handle
// opened via lazygraph-ops.cjs::openGraph, whose base schema has exactly
// source/target/type/properties and no review_status column.
//
// Structural conclusion (D-01b, not a preference): an openGraph handle has
// NO identity table (verified: exactly three tables -- edges, nodes,
// stakeholders). The Phase 224 migration writes its idempotency sentinel
// into identity, so it cannot run against this handle without also running
// the whole memory-schema chain (that is M12, explicitly deferred).
// room-db.cjs requires lazygraph-ops.cjs at module top level, so a reverse
// require from lazygraph-ops back into the migration chain would be
// circular. The write site (writeEdge itself) is therefore the ONLY
// viable fix site for C2.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const lazygraph = require(path.join(REPO, 'lib', 'core', 'lazygraph-ops.cjs'));
const { writeEdge } = require(path.join(REPO, 'lib', 'core', 'navigation', 'edges.cjs'));

// MIGRATED schema (has review_status). openRoomDb runs the full migration
// chain including phase-224-edge-review-status.
function migratedDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p273-mig-'));
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  return { dir, db: openRoomDb(dir) };
}

// BASE schema (no review_status, no identity table). openGraph runs
// initSchema only. openGraph is async; conn === db.
async function baseDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p273-base-'));
  const h = await lazygraph.openGraph(dir);
  return { dir, h, db: h.conn };
}

async function main() {
  const base = await baseDb();
  const migrated = migratedDb();

  try {
    // --- Assert 1 (precondition, passes today): the base schema has
    // exactly source/target/type/properties, no review_status.
    const baseCols = base.db.prepare('PRAGMA table_info(edges)').all().map((c) => c.name);
    assert.deepEqual(
      baseCols, ['source', 'target', 'type', 'properties'],
      'C2 precondition: a base openGraph handle has exactly the four unmigrated edges columns'
    );

    // --- Assert 2 (precondition, passes today, PIN IT): the base schema has
    // exactly edges/nodes/stakeholders and NO identity table. This is the
    // assertion that documents why the C2 fix is writeEdge-side, not
    // migration-side (D-01b) -- a future M12 phase must see it.
    const baseTables = base.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all().map((r) => r.name);
    assert.deepEqual(
      baseTables, ['edges', 'nodes', 'stakeholders'],
      'C2 precondition: a base openGraph handle has exactly edges/nodes/stakeholders'
    );
    assert.equal(
      baseTables.includes('identity'), false,
      'C2 structural conclusion (D-01b): a base openGraph handle has NO identity table, so the ' +
      'Phase 224 migration (which writes its sentinel there) cannot run against it -- the fix ' +
      'must live in writeEdge, not in a migration'
    );

    // --- Assert 3 (RED): writeEdge against a base handle succeeds and
    // reports written:true, instead of today's edge_write_failed throw.
    const baseWrite = writeEdge(base.db, {
      source_id: 'x', target_id: 'y', edge_type: 'INFORMS',
      properties: { v: 1 },
    });
    assert.equal(
      baseWrite.ok, true,
      'C2: writeEdge must succeed against a base openGraph handle, not throw ' +
      'table edges has no column named review_status'
    );
    assert.equal(
      baseWrite.written, true,
      'C2: a successful write against the base schema must report written:true'
    );

    // --- Assert 4 (RED): the row actually landed.
    const baseRows = base.db.prepare('SELECT * FROM edges').all();
    assert.equal(baseRows.length, 1, 'C2: the base-schema write must actually land a row');
    assert.equal(baseRows[0].source, 'x', 'C2: the landed row must carry the source id');
    assert.equal(baseRows[0].target, 'y', 'C2: the landed row must carry the target id');

    // --- Assert 5 (RED, D-06): a base-handle write carrying
    // review_status: 'proposed' returns ok:true AND an explicit
    // review_status_persisted:false signal -- never silently dropped, never
    // thrown.
    const baseWriteWithStatus = writeEdge(base.db, {
      source_id: 'p1', target_id: 'p2', edge_type: 'INFORMS',
      properties: { v: 1 }, review_status: 'proposed',
    });
    assert.equal(
      baseWriteWithStatus.ok, true,
      'C2/D-06: a base-handle write carrying review_status must still succeed'
    );
    assert.equal(
      baseWriteWithStatus.review_status_persisted, false,
      'C2/D-06: the base schema gap must be signalled via review_status_persisted:false, ' +
      'never silently dropped and never thrown'
    );

    // --- Assert 6 (non-cannibalisation): a MIGRATED handle write carrying
    // review_status: 'proposed' still stores 'proposed' in the real column
    // and returns review_status_persisted:true.
    const migratedWriteWithStatus = writeEdge(migrated.db, {
      source_id: 'm1', target_id: 'm2', edge_type: 'INFORMS',
      properties: { v: 1 }, review_status: 'proposed',
    });
    assert.equal(
      migratedWriteWithStatus.ok, true,
      'C2 non-cannibalisation: a migrated-handle write carrying review_status must succeed'
    );
    assert.equal(
      migratedWriteWithStatus.review_status_persisted, true,
      'C2 non-cannibalisation: a migrated handle must persist review_status:true, proving the ' +
      'base-schema fallback did not cannibalize the wide path'
    );
    const migratedRow = migrated.db.prepare(
      'SELECT review_status FROM edges WHERE source = ? AND target = ? AND type = ?'
    ).get('m1', 'm2', 'INFORMS');
    assert.equal(
      migratedRow.review_status, 'proposed',
      'C2 non-cannibalisation: the migrated handle must actually store proposed in the real column'
    );

    // --- Assert 7 (base-branch honesty): on the base schema, a second write
    // to the same (source, target, type) still reports written:true -- there
    // is no confirmed guard to suppress it there, and the two branches must
    // not be given different written semantics by accident.
    const baseRewrite = writeEdge(base.db, {
      source_id: 'x', target_id: 'y', edge_type: 'INFORMS',
      properties: { v: 2 },
    });
    assert.equal(
      baseRewrite.ok, true,
      'C2 base-branch honesty: a re-write on the base schema must succeed'
    );
    assert.equal(
      baseRewrite.written, true,
      'C2 base-branch honesty: a re-write on the base schema must report written:true -- there ' +
      'is no confirmed guard on this branch to suppress it'
    );

    console.log('PASS test-273-writeedge-base-schema');
  } finally {
    await lazygraph.closeGraph(base.h.db);
    fs.rmSync(base.dir, { recursive: true, force: true });
    closeRoomDb(migrated.db);
    fs.rmSync(migrated.dir, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
