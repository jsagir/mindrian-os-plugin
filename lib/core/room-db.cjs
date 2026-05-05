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
const { runMigration: runPhase109Migration } = require('./migrations/phase-109-nodes-provenance.cjs');

/**
 * Open a room's SQLite database with BOTH the lazygraph schema (nodes, edges,
 * plus all discovery-cycle tables) AND the memory schema (identity, facts,
 * sessions, fragments, assumptions, scaffold_log, voice_log, held_contradictions,
 * decisions_index). Idempotent: calling twice on the same roomDir is safe,
 * because both schema initializers use CREATE IF NOT EXISTS.
 *
 * Phase 109 extension (Plan 109-01): runs the nodes-provenance migration
 * after both schema initializers. The migration is idempotent via the
 * identity sentinel row 'phase_109_migration_v1' so cold and warm calls
 * both return a handle whose nodes table carries the 12-column provenance
 * schema (PROVENANCE.md 6 plus 3 fields contract) plus assumption rows
 * promoted to graph nodes via the status_aliases mapping.
 *
 * @param {string} roomDir - Path to room directory
 * @returns {Promise<{db: import('node:sqlite').DatabaseSync, conn: import('node:sqlite').DatabaseSync}>}
 */
async function openRoomDb(roomDir) {
  const handle = await lazygraph.openGraph(roomDir);
  // lazygraph.openGraph resolves to { db, conn } where db === conn (single
  // node:sqlite DatabaseSync instance). memory-ops operates on the same handle.
  memory.initMemorySchema(handle.db);
  // Phase 109 nodes-provenance migration. Idempotent (sentinel-protected).
  // Must run AFTER initMemorySchema so the identity table (which carries the
  // sentinel row) exists in its canonical 3-column shape before we touch it.
  runPhase109Migration(handle.db);
  return handle;
}

/**
 * Close a room database handle opened by openRoomDb. Delegates to
 * lazygraph.closeGraph. Accepts either the full { db, conn } handle or a
 * bare db instance for forward compatibility.
 *
 * @param {import('node:sqlite').DatabaseSync | {db: import('node:sqlite').DatabaseSync}} handle
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
