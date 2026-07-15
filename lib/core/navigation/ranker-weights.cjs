'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 222-01 typed accessor pair over the ranker_weights table (D-02).
 * ======================================================================
 * This module and the migration (lib/core/migrations/phase-222-ranker-weights.cjs)
 * are the ONLY two places SQL touches the ranker_weights table (Canon Part 9
 * single-chokepoint invariant). navigation.cjs re-exports readWeightState /
 * upsertWeightState as readHedgeWeightState / upsertHedgeWeightState so every
 * caller reaches the table through the one governed door, never a bare
 * db.prepare escape hatch.
 *
 * Read side DISCLOSES, write side VALIDATES:
 *   - readWeightState returns values AS STORED (no clamping, no laundering) so a
 *     corrupt row is VISIBLE to the ranker (Plan 02), which decides whether to
 *     emit the Req 7 reach_weight_state_unavailable degrade event. Zero rows
 *     (cold start) returns null, never a throw and never an event. A missing or
 *     unreadable table THROWS (SQL errors propagate) so the ranker can disclose
 *     the fault.
 *   - upsertWeightState rejects non-finite / non-object weights at the write
 *     boundary (TypeError), and wraps all row upserts in ONE transaction (D-02
 *     atomic-write discipline), mirroring the migration's own BEGIN/COMMIT/ROLLBACK.
 *
 * This module never opens its own db; it operates only on the caller-passed
 * handle (which the navigation chokepoint owns).
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

function readWeightState(db) {
  // SQL errors (missing/unreadable table) PROPAGATE by design so the ranker can
  // emit the Req 7 degrade event; only the zero-rows case returns null.
  const rows = db.prepare(
    'SELECT expert_id, weight, update_count, updated_at FROM ranker_weights'
  ).all();
  if (!rows || rows.length === 0) {
    return null; // cold start: table exists, zero rows. NO event (Pitfall 5).
  }
  const weights = {};
  let updateCount = 0;
  let updatedAt = 0;
  for (const r of rows) {
    weights[r.expert_id] = r.weight; // AS STORED, no validation or clamping
    if (typeof r.update_count === 'number' && r.update_count > updateCount) {
      updateCount = r.update_count;
    }
    if (typeof r.updated_at === 'number' && r.updated_at > updatedAt) {
      updatedAt = r.updated_at;
    }
  }
  return { weights, updateCount, updatedAt };
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function upsertWeightState(db, weights, opts) {
  if (!isPlainObject(weights)) {
    throw new TypeError('upsertWeightState: weights must be a non-empty object of finite numbers');
  }
  const expertIds = Object.keys(weights);
  if (expertIds.length === 0) {
    throw new TypeError('upsertWeightState: weights must be a non-empty object of finite numbers');
  }
  for (const id of expertIds) {
    const w = weights[id];
    if (typeof w !== 'number' || !Number.isFinite(w)) {
      throw new TypeError('upsertWeightState: weight for ' + id + ' must be a finite number; got ' + String(w));
    }
  }
  const options = isPlainObject(opts) ? opts : {};
  const updateCount = Number.isInteger(options.updateCount) ? options.updateCount : 0;
  const updatedAt = typeof options.updatedAt === 'number' && Number.isFinite(options.updatedAt)
    ? options.updatedAt
    : Date.now();

  db.exec('BEGIN');
  try {
    const stmt = db.prepare(
      'INSERT INTO ranker_weights (expert_id, weight, update_count, updated_at) VALUES (?, ?, ?, ?) ' +
      'ON CONFLICT(expert_id) DO UPDATE SET weight=excluded.weight, ' +
      'update_count=excluded.update_count, updated_at=excluded.updated_at'
    );
    for (const id of expertIds) {
      stmt.run(id, weights[id], updateCount, updatedAt);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { applied: true, count: expertIds.length };
}

module.exports = { readWeightState, upsertWeightState };
