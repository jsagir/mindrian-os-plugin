'use strict';
/*
 * Phase 140-01 -- node-insert: the ONE shared NOT-NULL-safe node-insert helper.
 * Extended R17-01 (260903-gdm): insertNode is now the SINGLE node-write
 * chokepoint for production code (Canon Part 7 reuse-before-build, D-02).
 * Every production `INSERT INTO nodes` outside two named exclusions
 * (`lib/core/navigation/memory-events.cjs` append-only bookkeeping dedupe,
 * `lib/core/rs-sqlite-mirror.cjs` bulk-write hot path) routes through here.
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
 *   review_status: DEFAULT 'proposed'      (left to the column DEFAULT, or
 *                                           the opts.review_status override)
 *   confidence:    NULL unless opts.confidence is a number
 *   created_at:    Date.now()
 *   last_seen_at:  Date.now()
 *
 * R17-01 overrides (all optional, all fail closed on an invalid value):
 *   opts.confidence:    number -> bound `confidence` column; omitted -> NULL
 *   opts.review_status: one of the eight Phase-109 CHECK enum members
 *                        ('proposed','confirmed','rejected','stale',
 *                        'superseded','needs_evidence','validated',
 *                        'invalidated'); a non-empty out-of-enum string
 *                        THROWS before prepare(). Omitted -> column DEFAULT.
 *   opts.on_conflict:   'update' (default, existing DO UPDATE clause) or
 *                        'nothing' (DO NOTHING; an existing row is left
 *                        byte-identical). Any other value THROWS.
 * Column NAMES are never caller-supplied (T-R17-01): the column list is
 * built from fixed literals gated on typeof/set-membership checks, never
 * from a caller string. Every caller value binds as a `?` parameter.
 *
 * On the legacy un-migrated 3-column schema, all three overrides are
 * accepted and silently ignored (there are no such columns to write); the
 * legacy branch is unchanged from its pre-R17 shape.
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
 * Named coverage gaps (NOT closed by this chokepoint, per the ratified R17
 * exclusions): `lib/core/navigation/memory-events.cjs:772` (append-only
 * bookkeeping dedupe contract, only ever writes `memory_event` nodes) and
 * `lib/core/rs-sqlite-mirror.cjs:407` (bulk-write hot path; a per-row
 * insertNode call would add a `PRAGMA table_info(nodes)` round trip per row).
 * Nodes written by these two files carry no chokepoint-validated data.
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

// Mirrors the eight-member Phase-109 CHECK constraint at
// lib/core/migrations/phase-109-nodes-provenance.cjs:300. This is a WIDER
// set than edges.cjs's two-member VALID_REVIEW_STATUS; they govern
// different tables and must not be conflated or shared.
const VALID_REVIEW_STATUS = Object.freeze(new Set([
  'proposed', 'confirmed', 'rejected', 'stale',
  'superseded', 'needs_evidence', 'validated', 'invalidated',
]));

const VALID_ON_CONFLICT = Object.freeze(new Set(['update', 'nothing']));

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
 * NOT-NULL-safe node upsert. The single node-write chokepoint (R17-01):
 * every production `INSERT INTO nodes` outside the two named exclusions
 * routes through this function so the whole HARD-02 bug-class is fixed once
 * (D-02 + D-02a), and so confidence / review_status / on_conflict can be
 * expressed at the call site without a raw INSERT.
 *
 * Preserves the existing ON CONFLICT(id) DO UPDATE upsert semantics by
 * default: re-inserting an existing id updates type + properties (and
 * refreshes last_seen_at on the migrated schema) rather than creating a
 * duplicate. review_status and confidence are NEVER touched by the DO
 * UPDATE clause (the no-downgrade contract: a human-confirmed node is never
 * silently downgraded by a system re-projection).
 *
 * @param {{prepare: Function}} conn - node:sqlite DatabaseSync (or compatible)
 * @param {string} id - node id (primary key)
 * @param {string} type - node type (Section / Artifact / CausalClaim / ...)
 * @param {string} properties - JSON-serialized properties bag
 * @param {object} [overrides] - optional provenance / write-shape overrides
 * @param {string} [overrides.source_path] - default 'system:hsi-to-graph'
 * @param {string} [overrides.created_by] - default 'system'
 *   (MUST be one of user/larry/import/brain/system per the Phase-109 CHECK)
 * @param {number} [overrides.confidence] - bound `confidence` column value;
 *   omitted (or non-number) leaves the column NULL
 * @param {string} [overrides.review_status] - one of the eight Phase-109
 *   CHECK enum members; omitted leaves the column DEFAULT ('proposed'); an
 *   out-of-enum non-empty string THROWS before prepare()
 * @param {string} [overrides.on_conflict] - 'update' (default) or 'nothing';
 *   any other value THROWS before prepare()
 * @returns {void}
 * @throws {Error} if review_status or on_conflict is present but invalid
 */
function insertNode(conn, id, type, properties, overrides) {
  const opts = overrides || {};
  const sourcePath = typeof opts.source_path === 'string' ? opts.source_path : SYSTEM_SOURCE_PATH;
  const createdBy = typeof opts.created_by === 'string' ? opts.created_by : SYSTEM_CREATED_BY;

  // Fail closed before any prepare(). Do not let SQLite's CHECK constraint
  // be the only guard (mirrors the writeEdge precedent in navigation/edges.cjs).
  const hasReviewStatus = opts.review_status !== undefined && opts.review_status !== null && opts.review_status !== '';
  if (hasReviewStatus && (typeof opts.review_status !== 'string' || !VALID_REVIEW_STATUS.has(opts.review_status))) {
    throw new Error('insertNode: invalid review_status ' + JSON.stringify(String(opts.review_status).slice(0, 40)));
  }
  const onConflict = opts.on_conflict === undefined || opts.on_conflict === null ? 'update' : opts.on_conflict;
  if (!VALID_ON_CONFLICT.has(onConflict)) {
    throw new Error('insertNode: invalid on_conflict ' + JSON.stringify(String(onConflict).slice(0, 40)));
  }
  const hasConfidence = typeof opts.confidence === 'number';

  if (isMigratedSchema(conn)) {
    // Wide NOT-NULL insert. Build the column list dynamically, keeping the
    // placeholder list and the bound-parameter array in lockstep so a
    // future column cannot drift out of order.
    const now = Date.now();
    const columns = ['id', 'type', 'properties', 'source_path', 'created_by', 'created_at', 'last_seen_at'];
    const params = [id, type, properties, sourcePath, createdBy, now, now];
    if (hasConfidence) {
      columns.push('confidence');
      params.push(opts.confidence);
    }
    if (hasReviewStatus) {
      columns.push('review_status');
      params.push(opts.review_status);
    }
    const placeholders = columns.map(() => '?').join(', ');
    const conflictClause = onConflict === 'nothing'
      ? 'ON CONFLICT(id) DO NOTHING'
      : 'ON CONFLICT(id) DO UPDATE SET ' +
        'type = excluded.type, properties = excluded.properties, ' +
        'last_seen_at = excluded.last_seen_at';
    conn.prepare(
      'INSERT INTO nodes (' + columns.join(', ') + ') VALUES (' + placeholders + ') ' + conflictClause
    ).run(...params);
    return;
  }

  // Legacy un-migrated 3-column schema. There are no confidence /
  // review_status columns to write, so the three new overrides are silently
  // ignored here; this branch stays exactly as it was pre-R17. on_conflict
  // is still honored since it only changes the conflict clause shape.
  const legacyConflictClause = onConflict === 'nothing'
    ? 'ON CONFLICT(id) DO NOTHING'
    : 'ON CONFLICT(id) DO UPDATE SET type = excluded.type, properties = excluded.properties';
  conn.prepare(
    'INSERT INTO nodes (id, type, properties) VALUES (?, ?, ?) ' + legacyConflictClause
  ).run(id, type, properties);
}

module.exports = {
  insertNode,
  isMigratedSchema,
  SYSTEM_SOURCE_PATH,
  SYSTEM_CREATED_BY,
  VALID_REVIEW_STATUS,
};
