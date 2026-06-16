'use strict';
// Phase 160-05 Task 1: point-in-time (T_tx, T_v) bitemporal query helper (R9).
//
// queryAsOf(db, nodeKey, T_tx, T_v) reconstructs historical state: it returns the
// single fact version of the logical fact nodeKey (the source_path logical key)
// that was KNOWN-as-of transaction-time T_tx AND VALID-at valid-time T_v, applying
// the canonical bitemporal WHERE clause VERBATIM (160-RESEARCH item 2):
//
//   created_at      <= T_tx
//   AND (invalidated_at IS NULL OR invalidated_at > T_tx)
//   AND valid_from  <= T_v
//   AND (valid_to        IS NULL OR valid_to       > T_v)
//
// NULL invalidated_at / valid_to read as OPEN / UNBOUNDED (the row is still known /
// still valid). The strict > on invalidated_at / valid_to with NULL=open is the
// off-by-one guard for the open-interval boundary (threat T-160-12): a version is
// in force at exactly its valid_from and stops being in force at exactly its
// valid_to (half-open [valid_from, valid_to) intervals).
//
// Reads the Phase 160-04 bitemporal columns (valid_from / valid_to / invalidated_at
// added by migrations/phase-160-nodes-bitemporal.cjs). Closes the Plan 04 R8
// round-trip: because supersede() CLOSES the old fact A (sets invalidated_at) rather
// than deleting it, an as-of query with T_tx before the supersession still satisfies
// (invalidated_at > T_tx) and returns A.
//
// Canon Part 8: a pure LOCAL read of room.db scalars; zero Brain queries, zero
// egress. Caller owns the db handle (the writeEdge / supersede contract); this
// module NEVER opens room.db itself.
//
// House rule: hyphens only, no em-dashes.

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Return the fact version of nodeKey known-as-of T_tx and valid-at T_v, or null.
 *
 * @param {import('node:sqlite').DatabaseSync} db  caller-owned room.db handle
 * @param {string} nodeKey  the logical-fact key (source_path shared by versions)
 * @param {number} T_tx     transaction-time cut (epoch ms): "known as of"
 * @param {number} T_v      valid-time cut (epoch ms): "valid at"
 * @returns {object|null}   the matching node row, or null when none matches
 */
function queryAsOf(db, nodeKey, T_tx, T_v) {
  if (!db || typeof db.prepare !== 'function') return null;
  if (typeof nodeKey !== 'string' || nodeKey.length === 0) return null;
  if (!isFiniteNumber(T_tx) || !isFiniteNumber(T_v)) return null;

  let rows;
  try {
    // The canonical bitemporal WHERE clause (RESEARCH item 2). Half-open
    // intervals: <= on the lower bounds (created_at / valid_from), strict > on
    // the open upper bounds (invalidated_at / valid_to), NULL upper bound = open.
    // ORDER BY created_at DESC so that when more than one version satisfies the
    // predicate (overlapping known-intervals) the latest-known version wins;
    // the non-lossy supersession chain produces non-overlapping known-intervals,
    // so for that chain exactly one row matches.
    rows = db.prepare(
      "SELECT * FROM nodes " +
      "WHERE source_path = ? " +
      "AND created_at <= ? " +
      "AND (invalidated_at IS NULL OR invalidated_at > ?) " +
      "AND valid_from <= ? " +
      "AND (valid_to IS NULL OR valid_to > ?) " +
      "ORDER BY created_at DESC, valid_from DESC " +
      "LIMIT 1"
    ).all(nodeKey, T_tx, T_tx, T_v, T_v);
  } catch (_e) {
    return null;
  }

  return rows && rows.length > 0 ? rows[0] : null;
}

module.exports = { queryAsOf };
