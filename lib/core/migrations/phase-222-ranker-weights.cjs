'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 222-01 ranker_weights table migration. Idempotent via an identity
 * sentinel, mirroring phase-109-session-focus.cjs (D-02: weight state lives in a
 * REAL room.db table, not memory_event rows).
 *
 * The table is the persistence substrate for the Phase 222 Hedge (multiplicative-
 * weights) ranking layer. Rows are keyed per expert_id ('d4_blend',
 * 'registry_order', ...) rather than a single weight_a/weight_b row, so SEED-057's
 * future fourth expert class needs a new ROW, not a schema migration (CONTEXT.md:
 * "stay general enough for a future fourth expert class"). Scalar columns only
 * (Canon Part 8): no prose, no venture bytes ever land here.
 *
 * The migration creates the table EMPTY. A fresh table with zero rows IS the
 * cold-start contract; the seeded rows are written by the accessor at first upsert
 * (lib/core/navigation/ranker-weights.cjs), never by this migration.
 *
 * This table has no FK dependency on any other new table, so unlike
 * phase-109-session-focus.cjs there is NO defensive ALTER TABLE backfill block.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const SENTINEL_KEY = 'phase_222_ranker_weights_v1';

function sentinelPresent(db) {
  try {
    const row = db.prepare('SELECT value FROM identity WHERE key = ?').get(SENTINEL_KEY);
    return Boolean(row && row.value);
  } catch (_) {
    return false;
  }
}

function runMigration(db) {
  if (sentinelPresent(db)) {
    return { applied: false };
  }
  db.exec('BEGIN');
  try {
    db.exec(
      "CREATE TABLE IF NOT EXISTS ranker_weights ( " +
      "expert_id     TEXT PRIMARY KEY, " +
      "weight        REAL NOT NULL, " +
      "update_count  INTEGER NOT NULL DEFAULT 0, " +
      "updated_at    INTEGER NOT NULL" +
      ")"
    );
    const nowIso = new Date().toISOString();
    db.prepare("INSERT OR REPLACE INTO identity (key, value, updated_at) VALUES (?, ?, ?)")
      .run(SENTINEL_KEY, nowIso, nowIso);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { applied: true };
}

module.exports = { runMigration, SENTINEL_KEY };
