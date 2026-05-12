'use strict';
/**
 * Phase 109 nodes-table provenance migration.
 *
 * Implements PROVENANCE.md (Plan 108-02) 6 plus 3 fields contract.
 * Implements TRUTH-STATES.md (Plan 108-03) status_aliases backfill.
 * Idempotent via identity.key = 'phase_109_migration_v1' sentinel row.
 *
 * BEGIN/COMMIT/ROLLBACK transaction wrapper per Phase 87-06 invariant
 * (node:sqlite has no transaction(fn) higher-order helper).
 *
 * Canon Part 8 invariants:
 *   - Writes only to room.db.
 *   - Zero Brain queries.
 *   - Zero remote egress.
 *   - Sentinel row identity.phase_109_migration_v1 is local-only.
 *
 * Migration shape:
 *   Step 1. ALTER TABLE nodes ADD COLUMN x9 (each duplicate-resilient).
 *   Step 1. Backfill from properties JSON via json_extract.
 *   Step 1. status_aliases assumptions backfill to graph nodes.
 *   Step 1. state_alias_migration memory_event log per migrated row.
 *   Step 2. Re-create-table-with-NOT-NULL plus CHECK constraints
 *           (canonical SQLite 12-step recipe) plus 6 new indices.
 *   Insert sentinel row.
 *
 * Exports:
 *   runMigration(db) -> { applied, sentinelInserted, backfilledAssumptions }
 *   SENTINEL_KEY (string)
 */

const SENTINEL_KEY = 'phase_109_migration_v1';

// New columns added to the legacy 3-column nodes table.
// Order matters: the re-create-table SELECT in tightenSchema relies on this list
// matching the destination schema column order.
const NEW_COLUMNS = [
  // [colName, ALTER TABLE clause]
  ['source_path', 'TEXT'],
  ['created_by', 'TEXT'],
  ['confidence', 'REAL'],
  ['review_status', "TEXT DEFAULT 'proposed'"],
  ['created_at', 'INTEGER'],
  ['last_seen_at', 'INTEGER'],
  ['source_section', 'TEXT'],
  ['confirmed_by', 'TEXT'],
  ['confirmed_at', 'INTEGER'],
];

// ----- Helpers -----

function tableExists(db, name) {
  const row = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(name);
  return Boolean(row);
}

function identityHasUpdatedAt(db) {
  // Existing identity tables (Phase 84-02 memory-ops.cjs:24-29) have 3 columns
  // including updated_at TEXT NOT NULL. The Phase 108 PROVENANCE.md contract
  // assumed 2 columns. Detect at runtime so the sentinel insert builds the
  // correct INSERT statement.
  const cols = db.prepare("PRAGMA table_info(identity)").all().map((c) => c.name);
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
  // Create identity table compatible with both the 3-column memory-ops shape
  // (Phase 84-02) and the 2-column PROVENANCE.md spec. We default to the
  // 3-column shape because that is what real rooms ship with; openRoomDb
  // composition runs initMemorySchema before this migration so the table
  // already exists in the canonical 3-column form by the time runMigration
  // is invoked from production. The CREATE IF NOT EXISTS only fires for
  // hermetic test fixtures that build identity manually.
  db.exec(
    "CREATE TABLE IF NOT EXISTS identity (" +
    "key TEXT PRIMARY KEY, " +
    "value TEXT NOT NULL, " +
    "updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP" +
    ")"
  );
}

function addColumnsIdempotent(db) {
  // PRAGMA table_info gives us existing column names; skip ALTER for any
  // already present (safe against partial migrations or parallel races).
  const existing = new Set(db.prepare('PRAGMA table_info(nodes)').all().map((c) => c.name));
  for (const [col, clause] of NEW_COLUMNS) {
    if (existing.has(col)) continue;
    try {
      db.exec('ALTER TABLE nodes ADD COLUMN ' + col + ' ' + clause);
    } catch (err) {
      // Treat duplicate-column as no-op (parallel migration may have raced).
      if (!/duplicate column name/i.test(err.message)) throw err;
    }
  }
}

function backfillFromProperties(db) {
  // source_path: prefer properties.source_path, then properties.source_artifact,
  // then id for Artifact / Section nodes.
  db.exec(
    "UPDATE nodes SET source_path = json_extract(properties, '$.source_path') " +
    "WHERE source_path IS NULL " +
    "AND json_extract(properties, '$.source_path') IS NOT NULL"
  );
  db.exec(
    "UPDATE nodes SET source_path = json_extract(properties, '$.source_artifact') " +
    "WHERE source_path IS NULL " +
    "AND json_extract(properties, '$.source_artifact') IS NOT NULL"
  );
  db.exec(
    "UPDATE nodes SET source_path = id " +
    "WHERE source_path IS NULL AND type IN ('Artifact', 'Section')"
  );
  // Last-resort source_path fallback so the NOT NULL Step 2 constraint is
  // satisfiable for every legacy row. PROVENANCE.md L125 mandates "sensible
  // defaults" when JSON fields are missing; we synthesize a path-like handle
  // from the node id so provenance is at minimum self-referential.
  db.exec(
    "UPDATE nodes SET source_path = 'unknown:' || id WHERE source_path IS NULL"
  );

  // created_at: epoch ms from properties.created (ISO string) or fall back to now.
  db.exec(
    "UPDATE nodes SET created_at = CAST(strftime('%s', json_extract(properties, '$.created')) AS INTEGER) * 1000 " +
    "WHERE created_at IS NULL AND json_extract(properties, '$.created') IS NOT NULL"
  );
  db.exec(
    "UPDATE nodes SET created_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000 WHERE created_at IS NULL"
  );

  // last_seen_at: same as created_at on first migration (drives stale-marker job later).
  db.exec('UPDATE nodes SET last_seen_at = created_at WHERE last_seen_at IS NULL');

  // confidence: string enum to REAL; preserve existing REAL / INTEGER values.
  db.exec(
    "UPDATE nodes SET confidence = CASE " +
    "WHEN typeof(json_extract(properties, '$.confidence')) = 'real' THEN json_extract(properties, '$.confidence') " +
    "WHEN typeof(json_extract(properties, '$.confidence')) = 'integer' THEN json_extract(properties, '$.confidence') " +
    "WHEN json_extract(properties, '$.confidence') = 'high' THEN 0.8 " +
    "WHEN json_extract(properties, '$.confidence') = 'medium' THEN 0.5 " +
    "WHEN json_extract(properties, '$.confidence') = 'low' THEN 0.3 " +
    "ELSE NULL END " +
    "WHERE confidence IS NULL"
  );

  // created_by + review_status defaults for legacy rows.
  db.exec("UPDATE nodes SET created_by = 'system' WHERE created_by IS NULL");
  db.exec("UPDATE nodes SET review_status = 'proposed' WHERE review_status IS NULL");

  // source_section from properties.section.
  db.exec(
    "UPDATE nodes SET source_section = json_extract(properties, '$.section') " +
    "WHERE source_section IS NULL AND json_extract(properties, '$.section') IS NOT NULL"
  );

  // source_section fallback: section nodes use their own id.
  db.exec(
    "UPDATE nodes SET source_section = id " +
    "WHERE source_section IS NULL AND type = 'section'"
  );
}

function backfillAssumptionsAsGraphNodes(db) {
  if (!tableExists(db, 'assumptions')) return 0;

  // Promote each assumptions row to a graph node via status_aliases mapping.
  // assumptions.id is INTEGER per memory-ops.cjs:65 so we cast to TEXT for the
  // node id construction. INSERT OR IGNORE makes the operation idempotent if
  // the migration is re-run somehow (defense in depth on top of sentinel).
  const insertNodes = db.prepare(
    "INSERT OR IGNORE INTO nodes " +
    "(id, type, properties, source_path, created_by, confidence, " +
    " review_status, created_at, last_seen_at, source_section) " +
    "SELECT " +
    "  'assumption:' || CAST(a.id AS TEXT), " +
    "  'assumption', " +
    "  json_object(" +
    "    'claim', a.claim, " +
    "    'evidence_for', a.evidence_for, " +
    "    'evidence_against', a.evidence_against, " +
    "    'legacy_validity', a.validity" +
    "  ), " +
    "  COALESCE(a.section, 'unknown'), " +
    "  'system', " +
    "  NULL, " +
    "  CASE a.validity " +
    "    WHEN 'untested' THEN 'proposed' " +
    "    WHEN 'supported' THEN 'validated' " +
    "    WHEN 'contradicted' THEN 'invalidated' " +
    "    WHEN 'stale' THEN 'stale' " +
    "  END, " +
    "  CAST(strftime('%s', a.created_at) AS INTEGER) * 1000, " +
    "  CAST(strftime('%s', COALESCE(a.last_tested, a.created_at)) AS INTEGER) * 1000, " +
    "  a.section " +
    "FROM assumptions a"
  );
  insertNodes.run();

  // Log one state_alias_migration memory_event per assumption row.
  // Phase 108 TRUTH-STATES.md L68 mandates one event per migrated row.
  const nowMs = Date.now();
  const insertEvents = db.prepare(
    "INSERT OR IGNORE INTO nodes " +
    "(id, type, properties, source_path, created_by, confidence, " +
    " review_status, created_at, last_seen_at) " +
    "SELECT " +
    "  'memory_event:state_alias_migration:' || CAST(a.id AS TEXT), " +
    "  'memory_event', " +
    "  json_object(" +
    "    'event_type', 'state_alias_migration', " +
    "    'target_node_id', 'assumption:' || CAST(a.id AS TEXT), " +
    "    'from_validity', a.validity, " +
    "    'to_review_status', CASE a.validity " +
    "      WHEN 'untested' THEN 'proposed' " +
    "      WHEN 'supported' THEN 'validated' " +
    "      WHEN 'contradicted' THEN 'invalidated' " +
    "      WHEN 'stale' THEN 'stale' " +
    "    END" +
    "  ), " +
    "  'phase-109-migration', " +
    "  'system', " +
    "  NULL, " +
    "  'confirmed', " +
    "  ?, ? " +
    "FROM assumptions a"
  );
  insertEvents.run(nowMs, nowMs);

  return db.prepare("SELECT COUNT(*) AS n FROM assumptions").get().n;
}

function dependentSchemaObjects(db) {
  // Enumerate every view and trigger that mentions the legacy `nodes` table in
  // its definition. The SQLite "making other kinds of table schema changes"
  // recipe (the canonical 12-step procedure) requires these to be dropped
  // BEFORE the rename-out-of-existence rebuild and recreated AFTER -- otherwise
  // SQLite re-validates the schema during ALTER TABLE ... RENAME TO, finds the
  // now-dangling view, and throws "error in view <name>: no such table:
  // main.nodes". We do not hardcode rs_discoveries; any future view/trigger on
  // `nodes` is picked up automatically. Drop-then-recreate is idempotent: views
  // whose sql carries IF NOT EXISTS re-exec cleanly; ones without it are simply
  // recreated fresh since we dropped them first.
  const rows = db.prepare(
    "SELECT type, name, sql FROM sqlite_master " +
    "WHERE type IN ('view','trigger') AND sql IS NOT NULL " +
    // \bnodes\b style match: the token "nodes" not immediately followed by an
    // identifier char (so we do not mistakenly catch nodes_new). SQLite LIKE
    // has no word boundaries, so over-match a little and trust the recreate to
    // be a no-op for anything unrelated -- but exclude the obvious nodes_new.
    "AND sql LIKE '%nodes%' AND sql NOT LIKE '%nodes_new%'"
  ).all();
  // Defensive: drop NULL/empty sql rows (autogenerated indexes never appear
  // here because we filtered type, but be safe).
  return rows.filter((r) => r && r.name && typeof r.sql === 'string' && r.sql.trim());
}

function tightenSchemaWithCheckConstraints(db) {
  // Step 2: re-create-table-with-NOT-NULL plus CHECK constraints.
  // Canonical SQLite 12-step recipe (foreign_keys disabled for the duration;
  // operation runs inside the caller's BEGIN/COMMIT transaction).
  //
  // Note: foreign_keys PRAGMA cannot be changed inside a transaction, so we
  // do not flip it here; the BEGIN/COMMIT wrapper guarantees atomicity, and
  // FK behavior is unchanged because the only FK targeting nodes is from edges
  // which we do not drop.

  // Step 2a: capture and drop every view/trigger that depends on `nodes`. Must
  // happen before DROP TABLE nodes so the schema stays internally consistent
  // through the rename. Recreated verbatim at the end of this function.
  const dependents = dependentSchemaObjects(db);
  for (const obj of dependents) {
    if (obj.type === 'view') {
      db.exec('DROP VIEW IF EXISTS "' + obj.name.replace(/"/g, '""') + '"');
    } else {
      db.exec('DROP TRIGGER IF EXISTS "' + obj.name.replace(/"/g, '""') + '"');
    }
  }

  db.exec(
    "CREATE TABLE nodes_new (" +
    "  id TEXT PRIMARY KEY, " +
    "  type TEXT NOT NULL, " +
    "  properties TEXT DEFAULT '{}', " +
    "  source_path TEXT NOT NULL, " +
    "  created_by TEXT NOT NULL CHECK(created_by IN ('user','larry','import','brain','system')), " +
    "  confidence REAL, " +
    "  review_status TEXT NOT NULL DEFAULT 'proposed' " +
    "    CHECK(review_status IN ('proposed','confirmed','rejected','stale','superseded','needs_evidence','validated','invalidated')), " +
    "  created_at INTEGER NOT NULL, " +
    "  last_seen_at INTEGER NOT NULL, " +
    "  source_section TEXT, " +
    "  confirmed_by TEXT, " +
    "  confirmed_at INTEGER" +
    ")"
  );

  db.exec(
    "INSERT INTO nodes_new " +
    "SELECT id, type, properties, source_path, created_by, confidence, " +
    "       review_status, created_at, last_seen_at, source_section, " +
    "       confirmed_by, confirmed_at " +
    "FROM nodes"
  );
  db.exec('DROP TABLE nodes');
  db.exec('ALTER TABLE nodes_new RENAME TO nodes');

  // Recreate the existing index plus the 6 new ones (mandatory + recommended
  // per PROVENANCE.md L97-104).
  db.exec('CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_nodes_review_status ON nodes(review_status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_nodes_source_path ON nodes(source_path)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_nodes_created_by ON nodes(created_by)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_nodes_created_at ON nodes(created_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_nodes_last_seen_at ON nodes(last_seen_at)');
  db.exec(
    'CREATE INDEX IF NOT EXISTS idx_nodes_confirmed_by ON nodes(confirmed_by) ' +
    'WHERE confirmed_by IS NOT NULL'
  );

  // Step 2b: recreate the views/triggers we dropped in Step 2a, now that
  // `nodes` exists again with the tightened schema. The captured `sql` is the
  // exact CREATE statement from sqlite_master; many carry IF NOT EXISTS which
  // keeps the recreate idempotent, and any that do not were dropped above so
  // re-exec is still safe.
  for (const obj of dependents) {
    db.exec(obj.sql);
  }
}

function insertSentinel(db) {
  const now = new Date().toISOString();
  if (identityHasUpdatedAt(db)) {
    db.prepare(
      "INSERT OR REPLACE INTO identity (key, value, updated_at) VALUES (?, ?, ?)"
    ).run(SENTINEL_KEY, now, now);
  } else {
    // Fallback for the 2-column PROVENANCE.md spec (legacy / hypothetical).
    db.prepare(
      "INSERT OR REPLACE INTO identity (key, value) VALUES (?, ?)"
    ).run(SENTINEL_KEY, now);
  }
}

// ----- Public API -----

/**
 * Run the Phase 109 nodes-provenance migration. Idempotent.
 *
 * @param {import('node:sqlite').DatabaseSync} db
 * @returns {{applied: boolean, sentinelInserted: boolean, backfilledAssumptions: number}}
 */
function runMigration(db) {
  ensureIdentityTable(db);
  if (sentinelPresent(db)) {
    return { applied: false, sentinelInserted: false, backfilledAssumptions: 0 };
  }
  let backfilledAssumptions = 0;
  db.exec('BEGIN');
  try {
    addColumnsIdempotent(db);
    backfillFromProperties(db);
    backfilledAssumptions = backfillAssumptionsAsGraphNodes(db);
    tightenSchemaWithCheckConstraints(db);
    insertSentinel(db);
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_rbErr) { /* ignore */ }
    throw err;
  }
  return { applied: true, sentinelInserted: true, backfilledAssumptions };
}

module.exports = { runMigration, SENTINEL_KEY };
