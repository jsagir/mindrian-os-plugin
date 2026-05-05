'use strict';
// Composition entry point for room.db. Phase 109 chains two idempotent migrations
// after the existing schema init: nodes-provenance (Plan 109-01) then session_focus
// (Plan 109-02).
//
// Phase 109-02 contract change (parallel-worktree merge surface):
// openRoomDb is now SYNCHRONOUS and returns the bare node:sqlite DatabaseSync
// handle (not the legacy { db, conn } async tuple). Pre-Phase-109 callers that
// did `const handle = await openRoomDb(roomDir); handle.db.prepare(...)` need to
// either:
//   (a) drop the await and use the returned db directly, or
//   (b) call the openGraph low-level API directly.
// The async tuple shape was a leak from lazygraph-ops.cjs openGraph(); the
// navigation API (Plan 109-04) and all 109-* helpers consume the bare db.
// Plan 109-01's nodes-provenance migration was authored against the same
// sync contract; the orchestrator merges both 109-01 and 109-02 worktrees
// onto the same single-line migration chain shown below.

const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const lazygraph = require('./lazygraph-ops.cjs');
const memory = require('./memory-ops.cjs');
const { runMigration: runPhase109SessionFocus } = require('./migrations/phase-109-session-focus.cjs');

// Plan 109-01 migration is loaded best-effort. In a parallel worktree where
// 109-01 has not yet shipped, the require will throw MODULE_NOT_FOUND and we
// fall back to the 109-02 migration's defensive ensureProvenanceColumns()
// backfill (which is a strict subset of the 109-01 schema work). Once 109-01
// merges, this loader resolves and the canonical migration runs first.
let runPhase109NodesProvenance = null;
try {
  runPhase109NodesProvenance = require('./migrations/phase-109-nodes-provenance.cjs').runMigration;
} catch (_e) {
  // 109-01 not present in this worktree; 109-02 migration handles its own
  // FK target schema needs additively.
}

function openRoomDb(roomDir) {
  const resolved = path.resolve(roomDir);
  const dbDir = path.join(resolved, '.mindrian');
  const dbPath = path.join(dbDir, 'room.db');
  fs.mkdirSync(dbDir, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  // Init lazygraph schema (nodes + edges + indices) sync via the same call
  // the async wrapper makes internally.
  lazygraph.initSchema(db);
  // Init memory schema (identity / facts / sessions / fragments / assumptions / etc).
  memory.initMemorySchema(db);
  // Phase 109 migrations in order: nodes provenance first (109-01), then
  // session_focus (109-02). Both are idempotent via identity sentinels.
  if (runPhase109NodesProvenance) {
    runPhase109NodesProvenance(db);
  }
  runPhase109SessionFocus(db);
  return db;
}

function closeRoomDb(handle) {
  // Tolerant: accept either bare DatabaseSync (current contract) or the legacy
  // { db, conn } shape during the merge cycle.
  const db = handle && handle.db ? handle.db : handle;
  try {
    db.close();
  } catch (_e) {
    // already closed; ignore
  }
}

module.exports = { openRoomDb, closeRoomDb };
