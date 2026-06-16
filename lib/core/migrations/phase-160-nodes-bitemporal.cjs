'use strict';
/**
 * Phase 160-04 nodes-table bitemporal migration (R7).
 *
 * Generalizes the half-built Phase 150.8 edge valid-time pattern to nodes:
 * adds four bitemporal columns (epoch ms, nullable) to the nodes table and
 * backfills valid_from from the existing created_at column.
 *
 * Authored as the phase-109-nodes-provenance.cjs ANALOG (Canon Part 7 -- the
 * named additive-idempotent-backfill template): SENTINEL_KEY sentinel-row
 * idempotency, addColumnsIdempotent with duplicate-column tolerance,
 * backfillValidFrom, the BEGIN/COMMIT/ROLLBACK wrapper, and additive indices.
 * Unlike phase-109 this migration needs NO re-create-table step: every new
 * column is nullable, so a plain duplicate-resilient ALTER TABLE is sufficient
 * and the existing CHECK-constrained schema is left untouched.
 *
 * Idempotent via identity.key = 'phase_160_bitemporal_migration_v1' sentinel
 * row. Running twice yields no error and an identical schema + data result.
 *
 * Canon Part 8 invariants (mirrors the phase-109 invariant):
 *   - Writes only to room.db.
 *   - Zero Brain queries.
 *   - Zero remote egress.
 *   - Sentinel row identity.phase_160_bitemporal_migration_v1 is local-only.
 *
 * Migration shape:
 *   Step 1. ALTER TABLE nodes ADD COLUMN x4 (each duplicate-resilient):
 *           valid_from / valid_to / invalidated_at / last_modified_at, all
 *           INTEGER epoch ms, nullable.
 *   Step 2. Backfill valid_from = created_at for every existing row; leave
 *           valid_to / invalidated_at / last_modified_at NULL.
 *   Step 3. Additive indices on valid_from + invalidated_at.
 *   Step 4. Insert sentinel row.
 *
 * Exports:
 *   runMigration(db) -> { applied, sentinelInserted }
 *   SENTINEL_KEY (string)
 */

const SENTINEL_KEY = 'phase_160_bitemporal_migration_v1';

// New bitemporal columns added to the Phase-109 tightened nodes table. All
// nullable INTEGER epoch ms, so a plain ALTER TABLE suffices (no re-create).
const NEW_COLUMNS = [
  // [colName, ALTER TABLE clause]
  ['valid_from', 'INTEGER'],
  ['valid_to', 'INTEGER'],
  ['invalidated_at', 'INTEGER'],
  ['last_modified_at', 'INTEGER'],
];

// ----- Helpers -----

function tableExists(db, name) {
  const row = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(name);
  return Boolean(row);
}

function identityHasUpdatedAt(db) {
  // Real rooms ship the 3-column identity table (key/value/updated_at). Detect
  // at runtime so the sentinel INSERT builds the correct statement -- mirrors
  // phase-109-nodes-provenance.cjs identityHasUpdatedAt.
  const cols = db.prepare('PRAGMA table_info(identity)').all().map((c) => c.name);
  return cols.includes('updated_at');
}

function sentinelPresent(db) {
  if (!tableExists(db, 'identity')) return false;
  try {
    const row = db.prepare('SELECT value FROM identity WHERE key = ?').get(SENTINEL_KEY);
    return Boolean(row && row.value);
  } catch (_) {
    return false;
  }
}

function ensureIdentityTable(db) {
  // Default to the canonical 3-column shape (Phase 84-02 memory-ops). In
  // production openRoomDb runs initMemorySchema before this migration, so the
  // table already exists; the CREATE IF NOT EXISTS only fires for hermetic
  // test fixtures. Mirrors phase-109 ensureIdentityTable.
  db.exec(
    "CREATE TABLE IF NOT EXISTS identity (" +
    "key TEXT PRIMARY KEY, " +
    "value TEXT NOT NULL, " +
    "updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP" +
    ")"
  );
}

function addColumnsIdempotent(db) {
  // PRAGMA table_info gives existing column names; skip ALTER for any already
  // present (safe against partial migrations or parallel races). Duplicate
  // column errors are treated as no-ops. Mirrors phase-109 addColumnsIdempotent.
  const existing = new Set(db.prepare('PRAGMA table_info(nodes)').all().map((c) => c.name));
  for (const [col, clause] of NEW_COLUMNS) {
    if (existing.has(col)) continue;
    try {
      db.exec('ALTER TABLE nodes ADD COLUMN ' + col + ' ' + clause);
    } catch (err) {
      if (!/duplicate column name/i.test(err.message)) throw err;
    }
  }
}

function backfillValidFrom(db) {
  // valid_from = created_at for every existing row that has not been set.
  // valid_to / invalidated_at / last_modified_at intentionally stay NULL:
  // a freshly-migrated row is open-ended (no closure, never modified-since).
  db.exec(
    'UPDATE nodes SET valid_from = created_at ' +
    'WHERE valid_from IS NULL AND created_at IS NOT NULL'
  );
}

function addIndices(db) {
  // Additive indices for point-in-time / supersession queries (Plan 05 helper
  // + Plan 04 supersession close). IF NOT EXISTS keeps the recreate idempotent.
  db.exec('CREATE INDEX IF NOT EXISTS idx_nodes_valid_from ON nodes(valid_from)');
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_nodes_invalidated_at ON nodes(invalidated_at) ' +
    'WHERE invalidated_at IS NOT NULL'
  );
}

function insertSentinel(db) {
  const now = new Date().toISOString();
  if (identityHasUpdatedAt(db)) {
    db.prepare(
      "INSERT OR REPLACE INTO identity (key, value, updated_at) VALUES (?, ?, ?)"
    ).run(SENTINEL_KEY, now, now);
  } else {
    db.prepare(
      "INSERT OR REPLACE INTO identity (key, value) VALUES (?, ?)"
    ).run(SENTINEL_KEY, now);
  }
}

// ----- Public API -----

/**
 * Run the Phase 160 nodes-bitemporal migration. Idempotent.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {{applied: boolean, sentinelInserted: boolean}}
 */
function runMigration(db) {
  ensureIdentityTable(db);
  if (sentinelPresent(db)) {
    return { applied: false, sentinelInserted: false };
  }
  db.exec('BEGIN');
  try {
    addColumnsIdempotent(db);
    backfillValidFrom(db);
    addIndices(db);
    insertSentinel(db);
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_rbErr) { /* ignore */ }
    throw err;
  }
  return { applied: true, sentinelInserted: true };
}

module.exports = { runMigration, SENTINEL_KEY };
