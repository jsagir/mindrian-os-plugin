/**
 * MindrianOS Plugin -- Room DB Composition Module (Phase 84-02)
 *
 * Composes lazygraph-ops.cjs openGraph() and memory-ops.cjs initMemorySchema()
 * behind a single entry point. Existing lazygraph-only consumers keep calling
 * openGraph() directly and remain byte-identical. New callers that also want
 * the memory-layer tables (identity, facts, sessions, fragments, assumptions,
 * scaffold_log, voice_log, held_contradictions, decisions_index) call
 * openRoomDb() instead.
 *
 * The composition is intentionally a new file rather than a modification of
 * lazygraph-ops.cjs so that v1.10.7 consumers of openGraph() remain untouched
 * and rollback is a single-file delete.
 *
 * Exports: openRoomDb, closeRoomDb
 */

'use strict';

const lazygraph = require('./lazygraph-ops.cjs');
const memory = require('./memory-ops.cjs');

/**
 * Open a room's SQLite database with BOTH the lazygraph schema (nodes, edges,
 * plus all discovery-cycle tables) AND the memory schema (identity, facts,
 * sessions, fragments, assumptions, scaffold_log, voice_log, held_contradictions,
 * decisions_index). Idempotent: calling twice on the same roomDir is safe,
 * because both schema initializers use CREATE IF NOT EXISTS.
 *
 * @param {string} roomDir - Path to room directory
 * @returns {Promise<{db: import('better-sqlite3').Database, conn: import('better-sqlite3').Database}>}
 */
async function openRoomDb(roomDir) {
  const handle = await lazygraph.openGraph(roomDir);
  // lazygraph.openGraph resolves to { db, conn } where db === conn (single
  // better-sqlite3 instance). memory-ops operates on the same handle.
  memory.initMemorySchema(handle.db);
  return handle;
}

/**
 * Close a room database handle opened by openRoomDb. Delegates to
 * lazygraph.closeGraph. Accepts either the full { db, conn } handle or a
 * bare db instance for forward compatibility.
 *
 * @param {import('better-sqlite3').Database | {db: import('better-sqlite3').Database}} handle
 * @returns {Promise<void>}
 */
async function closeRoomDb(handle) {
  const db = handle && handle.db ? handle.db : handle;
  return lazygraph.closeGraph(db);
}

module.exports = {
  openRoomDb,
  closeRoomDb,
};
