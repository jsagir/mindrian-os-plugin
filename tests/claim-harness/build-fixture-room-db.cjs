'use strict';
// Phase 150-08 (MEM-09 / D-09) -- the claim-harness fixture builder.
// ========================================================================
// Builds a REAL room.db for the obviously-fictional claim-room fixture by
// projecting its committed memory MD files (ROOM / STATE / MINTO / BRAIN /
// FEYNMAN / USER) THROUGH lib/core/navigation.cjs -- the Phase 109 navigation
// chokepoint -- via the Wave-1/2 reconcileMemoryArtifacts spine. It is NOT a
// hand-stitched SQLite file: every node and lineage edge is written by the
// shipped navigation writers (writeMemoryArtifactNode / writeGoverningThoughtNode
// / writeNavigatorPersonaNode / writeDecisionNode / writeCortexLineageEdge), so a
// driver that reads this db is reading a real cortex, not a fiction.
//
// Real-room fixture discipline (mirrors tests/test-cascade-surface-e2e.cjs):
//   1. Copy the committed fixtures/claim-room/ tree to a tmpdir so a build never
//      dirties the committed fixture.
//   2. Set MINDRIAN_ROOMS_HOME=<tmpdir-parent> on this process so any downstream
//      spawn that resolves a room falls into the tmpdir copy, NEVER the user's
//      real ~/MindrianRooms/ (the Pitfall-2 guard).
//   3. Build the room.db at <tmpdir>/room.db.
//
// NO mocked Brain anywhere. NO network. NO em-dashes (CLAUDE.md HARD RULE);
// forbidden dash codepoints (if ever asserted) are referenced via
// String.fromCharCode.
//
// Exports: buildFixtureRoomDb(opts) -> { roomDir, dbPath, db, cleanup, report }.
//   opts.keepOpen (default true): when true the returned db handle stays open for
//     the caller to query; cleanup() closes it and removes the tmpdir.
//   When node:sqlite is unavailable the MODULE still requires cleanly; a CALL to
//   buildFixtureRoomDb throws a tagged error the drivers catch and SKIP (exit 77).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const COMMITTED_FIXTURE = path.join(__dirname, 'fixtures', 'claim-room');

// The six memory-file basenames the cortex contract recognizes (case-exact).
const MEMORY_BASENAMES = Object.freeze([
  'ROOM.md', 'STATE.md', 'MINTO.md', 'BRAIN.md', 'FEYNMAN.md', 'USER.md',
]);

// node:sqlite probe -- the module loads regardless; a build throws if absent so
// the drivers can SKIP with exit 77 (the established Phase 150 discipline).
function _databaseSync() {
  try {
    return require('node:sqlite').DatabaseSync;
  } catch (_e) {
    const err = new Error('node:sqlite unavailable');
    err.code = 'ESQLITE_UNAVAILABLE';
    throw err;
  }
}

// applySchema -- the full production nodes + edges column set (the canonical
// shape from tests/test-150-reconcile.cjs). The navigation writers INSERT into
// exactly these columns.
function applySchema(db) {
  db.exec(
    'CREATE TABLE IF NOT EXISTS nodes (' +
    '  id TEXT PRIMARY KEY, ' +
    '  type TEXT NOT NULL, ' +
    "  properties TEXT DEFAULT '{}', " +
    '  source_path TEXT NOT NULL, ' +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    '  confidence REAL, ' +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    '  created_at INTEGER NOT NULL, ' +
    '  last_seen_at INTEGER NOT NULL, ' +
    '  source_section TEXT, ' +
    '  confirmed_by TEXT, ' +
    '  confirmed_at INTEGER, ' +
    // Phase 160-04 bitemporal migration added last_modified_at (the reconcile-guard
    // CAS token). This fixture predated it; Phase 194-06 adds it so the fixture
    // matches production and the content-UPDATE writers (which now bump the token)
    // do not hit "no such column". Nullable -> pre-migration NULL semantics preserved.
    '  last_modified_at INTEGER' +
    ');'
  );
  db.exec(
    'CREATE TABLE IF NOT EXISTS edges (' +
    '  source TEXT NOT NULL, target TEXT NOT NULL, type TEXT NOT NULL, ' +
    "  properties TEXT DEFAULT '{}', created_by TEXT, confidence REAL, " +
    '  review_status TEXT, created_at INTEGER, last_seen_at INTEGER, ' +
    '  PRIMARY KEY (source, target, type)' +
    ');'
  );
}

// copyTree -- recursive copy of the committed fixture into the tmpdir. Uses
// fs.cpSync (Node 16.7+) which the repo already relies on elsewhere.
function copyTree(src, dest) {
  fs.cpSync(src, dest, { recursive: true });
}

// buildFixtureRoomDb -- the single entry point.
function buildFixtureRoomDb(opts) {
  const options = opts || {};
  const keepOpen = options.keepOpen !== false;

  const DatabaseSync = _databaseSync();

  if (!fs.existsSync(COMMITTED_FIXTURE)) {
    throw new Error('committed fixture missing: ' + COMMITTED_FIXTURE);
  }

  // 1. Copy the committed fixture into an isolated tmpdir (rooms-home/room).
  const roomsHome = fs.mkdtempSync(path.join(os.tmpdir(), 'claim-harness-rooms-'));
  const roomDir = path.join(roomsHome, 'claim-room');
  copyTree(COMMITTED_FIXTURE, roomDir);

  // 2. Bind MINDRIAN_ROOMS_HOME to the tmpdir parent so any downstream room
  //    resolution lands in the copy, NEVER the user's real ~/MindrianRooms/.
  process.env.MINDRIAN_ROOMS_HOME = roomsHome;

  // 3. Build the real room.db by projecting the memory files THROUGH
  //    navigation.cjs (the reconcile spine calls the navigation writers).
  const dbPath = path.join(roomDir, 'room.db');
  const db = new DatabaseSync(dbPath);
  applySchema(db);

  // require here (after the sqlite probe) so the module loads on a no-sqlite box.
  const reconcile = require(path.join(REPO_ROOT, 'lib', 'core', 'memory', 'reconcile-memory-runner.cjs'));
  const report = reconcile.reconcileMemoryArtifacts(roomDir, { db: db, roomRoot: roomDir });

  function cleanup() {
    try { db.close(); } catch (_e) { /* already closed */ }
    try { fs.rmSync(roomsHome, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }

  if (!keepOpen) {
    try { db.close(); } catch (_e) { /* ignore */ }
  }

  return {
    roomDir: roomDir,
    roomsHome: roomsHome,
    dbPath: dbPath,
    db: keepOpen ? db : null,
    report: report,
    cleanup: cleanup,
  };
}

module.exports = {
  buildFixtureRoomDb: buildFixtureRoomDb,
  applySchema: applySchema,
  COMMITTED_FIXTURE: COMMITTED_FIXTURE,
  MEMORY_BASENAMES: MEMORY_BASENAMES,
};
