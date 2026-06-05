'use strict';
/*
 * Phase 140-01 -- node-insert: the ONE shared NOT-NULL-safe node-insert helper.
 *
 * HARD-02 root cause: the bare 3-column upsert
 *   INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?) ON CONFLICT(id) ...
 * fails on a Phase-109-migrated room.db with
 *   `NOT NULL constraint failed: nodes.source_path`
 * because the migration (lib/core/migrations/phase-109-nodes-provenance.cjs)
 * tightened the nodes table with four NOT NULL provenance columns
 * (source_path, created_by, created_at, last_seen_at) plus a CHECK constraint
 * on created_by. The legacy bare insert omits all four.
 *
 * This module is the single chokepoint (Canon Part 7 reuse-before-build, D-02):
 * all four bare-3-column insert sites route through insertNode --
 *   - scripts/hsi-to-graph.cjs (the Section upsert on the reverse-salient path)
 *   - lib/core/lazygraph-ops.cjs _indexArtifactBody (Artifact + Section upserts)
 *   - lib/core/lazygraph-ops.cjs createCausalClaim (CausalClaim upsert)
 *   - lib/core/lazygraph-ops.cjs addWhitespaceZone (WhitespaceZone upsert)
 *
 * Both-schema safety (D-02a): a migrated db requires the wide insert; an
 * un-migrated 3-col db (the current dogfood room) rejects the wide insert
 * (no such column). So insertNode detects the schema once via
 * PRAGMA table_info(nodes) and builds the correct column-set:
 *   - migrated  -> wide NOT-NULL insert with the provenance scalars
 *   - un-migrated -> legacy 3-column insert
 *
 * Provenance values for these system-written nodes (per RESEARCH HARD-02 +
 * lib/core/navigation/evidence-claim.cjs:110 correct pattern):
 *   source_path:   'system:hsi-to-graph'   (a synthetic handle, not a real path)
 *   created_by:    'system'                (satisfies the Phase-109 CHECK:
 *                                           one of user/larry/import/brain/system)
 *   review_status: DEFAULT 'proposed'      (left to the column DEFAULT)
 *   created_at:    Date.now()
 *   last_seen_at:  Date.now()
 *
 * Canon Part 9: these are SYSTEM-BOOKKEEPING graph nodes (Section / Artifact /
 * CausalClaim / WhitespaceZone written by the HSI + indexer pipelines), not
 * human truth-claims, so created_by='system' is canon-legal (Part 9
 * audit-node carve-out spirit -- the system wrote them, no human byUser needed
 * to reach the system-set status).
 *
 * Canon Part 8: zero network surface. Pure LOCAL SQLite over a caller-owned
 * conn handle. node-insert NEVER opens room.db itself (it receives the conn),
 * so it does not trip the room-db.cjs navigation-bypass audit and stays a
 * thin, dependency-free insert primitive.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

// The four provenance columns the Phase-109 migration adds as NOT NULL.
// source_path / created_by / created_at / last_seen_at are NOT NULL; if all
// are present we are on the migrated (wide) schema and must supply them.
const MIGRATED_MARKER_COLUMN = 'source_path';

// System provenance defaults for HSI / indexer node writes.
const SYSTEM_SOURCE_PATH = 'system:hsi-to-graph';
const SYSTEM_CREATED_BY = 'system';

/**
 * Detect whether the nodes table carries the Phase-109 provenance columns.
 * Robust to both schemas (D-02a). Defensive: any PRAGMA failure falls back to
 * the legacy 3-column shape (the wider insert would throw on a real legacy db,
 * so defaulting to legacy is the safe choice).
 * @param {{prepare: Function}} conn - node:sqlite DatabaseSync (or compatible)
 * @returns {boolean} true if the migrated (wide) schema is present
 */
function isMigratedSchema(conn) {
  try {
    const cols = conn.prepare('PRAGMA table_info(nodes)').all();
    return cols.some((c) => c && c.name === MIGRATED_MARKER_COLUMN);
  } catch (_e) {
    return false;
  }
}

/**
 * NOT-NULL-safe node upsert. Routes every bare-3-column node insert through one
 * helper so the whole HARD-02 bug-class is fixed once (D-02 + D-02a).
 *
 * Preserves the existing ON CONFLICT(id) DO UPDATE upsert semantics: re-inserting
 * an existing id updates type + properties (and refreshes last_seen_at on the
 * migrated schema) rather than creating a duplicate.
 *
 * @param {{prepare: Function}} conn - node:sqlite DatabaseSync (or compatible)
 * @param {string} id - node id (primary key)
 * @param {string} type - node type (Section / Artifact / CausalClaim / ...)
 * @param {string} properties - JSON-serialized properties bag
 * @param {object} [overrides] - optional provenance overrides
 * @param {string} [overrides.source_path] - default 'system:hsi-to-graph'
 * @param {string} [overrides.created_by] - default 'system'
 *   (MUST be one of user/larry/import/brain/system per the Phase-109 CHECK)
 * @returns {void}
 */
function insertNode(conn, id, type, properties, overrides) {
  const opts = overrides || {};
  const sourcePath = typeof opts.source_path === 'string' ? opts.source_path : SYSTEM_SOURCE_PATH;
  const createdBy = typeof opts.created_by === 'string' ? opts.created_by : SYSTEM_CREATED_BY;

  if (isMigratedSchema(conn)) {
    // Wide NOT-NULL insert. review_status is left to the column DEFAULT
    // ('proposed') so we do not list it. created_at / last_seen_at are stamped.
    const now = Date.now();
    conn.prepare(
      'INSERT INTO nodes ' +
      '(id, type, properties, source_path, created_by, created_at, last_seen_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(id) DO UPDATE SET ' +
      'type = excluded.type, properties = excluded.properties, ' +
      'last_seen_at = excluded.last_seen_at'
    ).run(id, type, properties, sourcePath, createdBy, now, now);
    return;
  }

  // Legacy un-migrated 3-column insert (the current dogfood room shape).
  conn.prepare(
    'INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?) ' +
    'ON CONFLICT(id) DO UPDATE SET type = excluded.type, properties = excluded.properties'
  ).run(id, type, properties);
}

module.exports = { insertNode, isMigratedSchema, SYSTEM_SOURCE_PATH, SYSTEM_CREATED_BY };
