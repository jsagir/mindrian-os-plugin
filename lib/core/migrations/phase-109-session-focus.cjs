'use strict';
// Phase 109 session_focus table migration. Idempotent via identity sentinel.
// Runs AFTER Plan 109-01 nodes-provenance migration (FK target schema must exist).
//
// Parallel-worktree note (Phase 109-02 isolated execution):
// This migration is authored to run primarily against the post-109-01 nodes
// schema (12 columns including source_path / created_by / confidence /
// review_status / created_at / last_seen_at). When 109-01 has not yet run in
// the same worktree, ensureProvenanceColumns() defensively backfills the
// missing nodes columns via additive ALTER TABLE so the FK target accepts
// our test fixtures (which insert with all 9 provenance fields). The 109-01
// canonical migration will re-add the same columns idempotently when it
// later runs in the merged trunk; ALTER TABLE ADD COLUMN IF NOT EXISTS
// semantics (we wrap each in try/catch since SQLite < 3.35 lacks IF NOT
// EXISTS on ADD COLUMN) keep the operation safe in either order.

const SENTINEL_KEY = 'phase_109_session_focus_v1';

function sentinelPresent(db) {
  try {
    const row = db.prepare('SELECT value FROM identity WHERE key = ?').get(SENTINEL_KEY);
    return Boolean(row && row.value);
  } catch (_) {
    return false;
  }
}

function ensureIdentityTable(db) {
  // identity table is canonically created by memory-ops.cjs initMemorySchema
  // with shape (key TEXT PK, value TEXT NOT NULL, updated_at TEXT NOT NULL).
  // We re-issue CREATE TABLE IF NOT EXISTS as a safety net for callers that
  // skip initMemorySchema; the IF NOT EXISTS clause makes this a no-op when
  // memory-ops already created the table.
  db.exec(
    "CREATE TABLE IF NOT EXISTS identity (" +
    "key TEXT PRIMARY KEY, " +
    "value TEXT NOT NULL, " +
    "updated_at TEXT NOT NULL" +
    ")"
  );
}

// Defensive backfill of 109-01 provenance columns when running in a parallel
// worktree where 109-01 has not yet executed. Each ADD COLUMN is wrapped in a
// try/catch so re-runs (when 109-01 has already added the column) are no-ops.
// This is additive ONLY; it never alters existing column types or drops data.
function ensureProvenanceColumns(db) {
  const additions = [
    "ALTER TABLE nodes ADD COLUMN source_path TEXT",
    "ALTER TABLE nodes ADD COLUMN created_by TEXT",
    "ALTER TABLE nodes ADD COLUMN confidence REAL",
    "ALTER TABLE nodes ADD COLUMN review_status TEXT",
    "ALTER TABLE nodes ADD COLUMN created_at INTEGER",
    "ALTER TABLE nodes ADD COLUMN last_seen_at INTEGER",
    "ALTER TABLE nodes ADD COLUMN source_section TEXT",
  ];
  for (const sql of additions) {
    try {
      db.exec(sql);
    } catch (_e) {
      // Column already exists or table missing; either is acceptable here.
      // The migration cannot proceed if nodes table is absent; that error
      // surfaces below at session_focus FK creation time.
    }
  }
}

function runMigration(db) {
  ensureIdentityTable(db);
  if (sentinelPresent(db)) {
    return { applied: false };
  }
  // Defensive backfill BEFORE creating session_focus, so the FK target column
  // set is present whether or not 109-01 has run in this worktree.
  ensureProvenanceColumns(db);
  db.exec('BEGIN');
  try {
    db.exec(
      "CREATE TABLE IF NOT EXISTS session_focus ( " +
      "session_id    TEXT PRIMARY KEY, " +
      "focus_node_id TEXT NOT NULL, " +
      "focus_type    TEXT NOT NULL, " +
      "set_at        INTEGER NOT NULL, " +
      "set_by        TEXT NOT NULL CHECK(set_by IN ('user','larry','auto-from-jtbd','auto-from-operator','auto-from-state')), " +
      "FOREIGN KEY (focus_node_id) REFERENCES nodes(id) " +
      ")"
    );
    db.exec("CREATE INDEX IF NOT EXISTS idx_session_focus_set_at ON session_focus(set_at DESC)");
    const nowIso = new Date().toISOString();
    db.prepare("INSERT OR REPLACE INTO identity (key, value, updated_at) VALUES (?, ?, ?)").run(SENTINEL_KEY, nowIso, nowIso);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { applied: true };
}

module.exports = { runMigration, SENTINEL_KEY };
