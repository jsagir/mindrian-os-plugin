'use strict';
// Phase 160-04 Task 2: non-lossy supersession through the Part 9 chokepoint (R8).
//
// supersede(db, oldNodeId, newNodeId, opts) closes the OLD fact A when a NEW fact
// B supersedes it:
//   - A.invalidated_at = reference now,
//   - A.valid_to = B.valid_from,
//   - A.review_status = 'superseded',
//   - a SUPERSEDES edge B->A is written,
//   - a status_superseded memory_event is logged.
//
// The A row is NEVER deleted: after supersession the old node still exists with
// invalidated_at populated, so a point-in-time query as-of BEFORE supersession
// still returns it (the as-of helper itself is Plan 05). This is the audit-trail
// guarantee Canon Part 9 role 5 + Part 4 demand: superseded facts are CLOSED,
// not erased.
//
// Canon Part 9 (substrate guard): this module routes EVERY write through the
// navigation.cjs chokepoint -- promoteNodeStatus for the status + bitemporal
// close, writeEdge for the SUPERSEDES edge. It NEVER opens room.db itself
// (no require of room-db.cjs) and NEVER issues a side-door DELETE / INSERT INTO
// nodes. The db handle is owned by the caller (via openRoomDb), exactly like the
// writeEdge contract.
//
// Canon Part 8: supersession touches only room.db scalars; zero Brain queries,
// zero egress.
//
// Reuses getReferenceNow via the options.now seam (D-01a) so tests inject a fixed
// reference.
//
// House rule: hyphens only, no em-dashes.

const navigation = require('../navigation.cjs');

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Supersede oldNodeId (A) with newNodeId (B), non-lossily.
 *
 * @param {import('node:sqlite').DatabaseSync} db  caller-owned room.db handle
 * @param {string} oldNodeId  the fact being closed (A)
 * @param {string} newNodeId  the fact that supersedes it (B)
 * @param {{now?: function, byUser?: string, reason?: string}} [opts]
 * @returns {{ok: true, oldNodeId, newNodeId, invalidatedAt, validTo, edge}
 *           | {ok: false, reason: string, detail?: string}}
 */
function supersede(db, oldNodeId, newNodeId, opts) {
  if (!db || typeof db.prepare !== 'function') {
    return { ok: false, reason: 'invalid_db' };
  }
  if (typeof oldNodeId !== 'string' || oldNodeId.length === 0) {
    return { ok: false, reason: 'invalid_old_node_id' };
  }
  if (typeof newNodeId !== 'string' || newNodeId.length === 0) {
    return { ok: false, reason: 'invalid_new_node_id' };
  }
  if (oldNodeId === newNodeId) {
    return { ok: false, reason: 'cannot_supersede_self' };
  }

  const options = opts && typeof opts === 'object' ? opts : {};
  const nowFn = typeof options.now === 'function' ? options.now : Date.now;
  let referenceNow;
  try { referenceNow = nowFn(); } catch (_e) { referenceNow = Date.now(); }
  if (!isFiniteNumber(referenceNow)) referenceNow = Date.now();

  // Read B.valid_from (the close boundary for A.valid_to). A READ -- never bumps
  // B.last_modified_at (Phase 160-04 R7 read discipline). Caller-owned handle.
  let bRow;
  try {
    bRow = db.prepare('SELECT id, valid_from, review_status FROM nodes WHERE id = ?').get(newNodeId);
  } catch (e) {
    return { ok: false, reason: 'read_new_node_failed', detail: String(e.message || '').slice(0, 80) };
  }
  if (!bRow) {
    return { ok: false, reason: 'unknown_new_node' };
  }

  // A must currently be confirmed: the closed status taxonomy only allows
  // confirmed->superseded (transitions.cjs TRANSITIONS). Surface the precise
  // reason from the chokepoint rather than pre-judging here.
  const aRow = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(oldNodeId);
  if (!aRow) {
    return { ok: false, reason: 'unknown_old_node' };
  }

  const validTo = isFiniteNumber(bRow.valid_from) ? bRow.valid_from : null;
  const byUser = typeof options.byUser === 'string' && options.byUser ? options.byUser : 'system';
  const reason = typeof options.reason === 'string' ? options.reason : 'superseded_by:' + newNodeId;

  // Close A through the truth-state chokepoint. promoteNodeStatus runs its own
  // BEGIN/COMMIT, sets review_status='superseded' + last_modified_at, logs a
  // status_superseded memory_event (Part 9), AND -- via the Phase 160-04 R8
  // bitemporal-close opts -- sets invalidated_at + valid_to in the SAME UPDATE.
  // No side-door write; the entire close is one chokepoint call.
  const closeRes = navigation.promoteNodeStatus(
    db, oldNodeId, aRow.review_status, 'superseded', byUser, reason,
    { now: () => referenceNow, invalidatedAt: referenceNow, validTo: validTo }
  );
  if (!closeRes || !closeRes.ok) {
    return { ok: false, reason: 'status_close_failed:' + (closeRes && closeRes.reason ? closeRes.reason : 'unknown') };
  }

  // Write the SUPERSEDES edge B->A through the chokepoint (SUPERSEDES is already
  // in ALLOWED_EDGE_TYPES). ENUM/scalar properties only (Part 8): the reference
  // now + the close boundary -- never the claim BODY.
  const edgeRes = navigation.writeEdge(db, {
    source_id: newNodeId,
    target_id: oldNodeId,
    edge_type: 'SUPERSEDES',
    properties: { invalidated_at: referenceNow, valid_to: validTo },
  });
  if (!edgeRes || !edgeRes.ok) {
    // The status close already committed (non-lossy: A is closed). Surface the
    // edge failure so the caller knows the SUPERSEDES edge did not land, rather
    // than swallowing it (honesty floor).
    return { ok: false, reason: 'edge_write_failed:' + (edgeRes && edgeRes.reason ? edgeRes.reason : 'unknown') };
  }

  return {
    ok: true,
    oldNodeId,
    newNodeId,
    invalidatedAt: referenceNow,
    validTo,
    edge: edgeRes.type,
  };
}

module.exports = { supersede };
