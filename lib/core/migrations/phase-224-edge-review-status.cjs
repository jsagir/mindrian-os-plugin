'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 224-01 (D-05) -- edges.review_status column migration.
 * ===========================================================
 * Copies the phase-222-ranker-weights.cjs sentinel-idempotent, transaction-
 * wrapped shape EXACTLY (per the navigator's D-05 ruling, which OVERRODE the
 * researcher's node-status recommendation): derived edges must literally carry
 * review_status AS A COLUMN ON THE EDGES TABLE, matching SPEC Req 4's wording.
 *
 * WHAT IT DOES: an additive ALTER TABLE edges ADD COLUMN review_status TEXT
 * DEFAULT NULL, guarded by a defensive PRAGMA table_info(edges) probe so a
 * partially-migrated db (column already present, sentinel not yet written) is
 * safe. Idempotent via an identity-table sentinel: a second run is a no-op and
 * returns { applied: false }.
 *
 * EXISTING-ROWS DEFAULT SEMANTICS (D-05, Claude's-discretion item documented
 * here per the plan):
 *   review_status NULL means "a pre-224 or non-derivation edge". Every consumer
 *   treats NULL as NOT-a-proposal. This is deliberate on two fronts:
 *     - NULL rows are NEVER retroactively demoted to 'proposed'. A legacy edge
 *       that a human already trusts (or that structural indexing wrote) must not
 *       suddenly appear in the "machine proposed this, please ratify" surface.
 *     - NULL is chosen OVER a 'confirmed' backfill so legacy edges are ALSO not
 *       silently PROMOTED to human-ratified. 'confirmed' is reserved for the
 *       explicit human byUser confirmation path (Req 4); a migration must never
 *       mint that trust on a user's behalf. NULL is the honest third state:
 *       "unknown / not part of the proposal lifecycle".
 *   Only writeEdge's explicit review_status:'proposed' (the derivation writer)
 *   and a future human-confirm path ('confirmed') ever set a non-NULL value.
 *
 * The upsert in navigation/edges.cjs::writeEdge sets review_status at FIRST
 * INSERT only and NEVER mutates it on conflict, so re-derivation is idempotent
 * (the Ralph invariant): a confirmed edge is never downgraded and a NULL legacy
 * edge is never demoted.
 *
 * Scalar column only (Canon Part 8): no prose, no venture bytes ever land here.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const SENTINEL_KEY = 'phase_224_edge_review_status_v1';

function sentinelPresent(db) {
  try {
    const row = db.prepare('SELECT value FROM identity WHERE key = ?').get(SENTINEL_KEY);
    return Boolean(row && row.value);
  } catch (_) {
    return false;
  }
}

// Defensive probe: does the edges table already carry a review_status column?
// Protects a partially-migrated db (column added but sentinel not yet written)
// from a duplicate-column ALTER TABLE error.
function reviewStatusColumnPresent(db) {
  try {
    const cols = db.prepare('PRAGMA table_info(edges)').all();
    return cols.some((c) => c && c.name === 'review_status');
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
    // Only ALTER when the column is genuinely absent (partial-migration guard).
    if (!reviewStatusColumnPresent(db)) {
      db.exec('ALTER TABLE edges ADD COLUMN review_status TEXT DEFAULT NULL');
    }
    const nowIso = new Date().toISOString();
    db.prepare('INSERT OR REPLACE INTO identity (key, value, updated_at) VALUES (?, ?, ?)')
      .run(SENTINEL_KEY, nowIso, nowIso);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { applied: true };
}

module.exports = { runMigration, SENTINEL_KEY };
