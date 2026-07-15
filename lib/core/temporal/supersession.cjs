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
  // Phase 194-06 Task 2: supersede runs NO own UPDATE -- it rides the transitions
  // chokepoint. Thread the caller's readVersion + presence context through the
  // options bag so a concurrent close of the SAME node A is detectable by the
  // reconcile guard (no separate guard insertion here; the token flows through).
  const closeRes = navigation.promoteNodeStatus(
    db, oldNodeId, aRow.review_status, 'superseded', byUser, reason,
    {
      now: () => referenceNow,
      invalidatedAt: referenceNow,
      validTo: validTo,
      readVersion: options.readVersion,
      roomDir: options.roomDir,
      room: options.room,
      home: options.home,
      sessionId: options.sessionId,
    }
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

/**
 * walkSupersedesChain(db, nodeId, opts) -- the net-new READ-SIDE chain walker
 * (Phase 223-02, Req 2; RESEARCH finding 4: supersession.cjs only WROTE a chain,
 * it shipped no reader for it). Plan 03's bono --version-log renders this walker's
 * output.
 *
 * From nodeId, this follows SUPERSEDES edges in BOTH directions to the chain
 * ends and returns the chain ordered NEWEST -> OLDEST. A SUPERSEDES edge is
 * written source=NEWER target=OLDER (supersede above writes B->A, B newer). So:
 *   - the node that supersedes `n` (newer) is the SOURCE of the edge whose
 *     TARGET is `n`;
 *   - the node `n` supersedes (older) is the TARGET of the edge whose SOURCE
 *     is `n`.
 * The walk first climbs to the newest head, then descends collecting each older
 * node. review_status is IGNORED ENTIRELY (D-04: the chain is purely mechanical
 * bookkeeping, independent of confirmation state -- a confirmed conclusion and a
 * proposed one appear identically in chain order).
 *
 * This is READ-ONLY: it issues only SELECTs over the caller-owned handle (reads
 * are legal outside the write chokepoint; supersede above owns all writes). It
 * guards cycles with a visited set (returns { ok:false, reason:'cycle_detected' }
 * carrying the partial chain) and caps depth via opts.maxDepth (default 100).
 *
 * @param {import('node:sqlite').DatabaseSync} db  caller-owned room.db handle
 * @param {string} nodeId  any node on the chain (an end OR the middle)
 * @param {{maxDepth?: number}} [opts]
 * @returns {{ok:true, chain:Array<{node_id, superseded_at:(number|null)}>}
 *           | {ok:false, reason:string, chain?:Array}}
 */
function walkSupersedesChain(db, nodeId, opts) {
  if (!db || typeof db.prepare !== 'function') {
    return { ok: false, reason: 'invalid_db' };
  }
  if (typeof nodeId !== 'string' || nodeId.length === 0) {
    return { ok: false, reason: 'invalid_node_id' };
  }
  const options = opts && typeof opts === 'object' ? opts : {};
  const maxDepth = Number.isInteger(options.maxDepth) && options.maxDepth > 0 ? options.maxDepth : 100;

  // Read-only edge lookups. `newerOf` finds the node that supersedes `n`;
  // `olderOf` finds the node `n` supersedes. Both return { id, invalidatedAt }
  // or null. The invalidated_at scalar on the incoming edge is when `n` itself
  // was closed (its superseded_at).
  function edgeRow(sql, bind) {
    try { return db.prepare(sql).get(bind); } catch (_e) { return null; }
  }
  function parseInvalidatedAt(props) {
    try {
      const p = JSON.parse(props || '{}');
      return (p && Number.isFinite(p.invalidated_at)) ? p.invalidated_at : null;
    } catch (_e) { return null; }
  }
  function newerOf(n) {
    const row = edgeRow("SELECT source, properties FROM edges WHERE target = ? AND type = 'SUPERSEDES' LIMIT 1", n);
    return row ? { id: row.source, invalidatedAt: parseInvalidatedAt(row.properties) } : null;
  }
  function olderOf(n) {
    const row = edgeRow("SELECT target, properties FROM edges WHERE source = ? AND type = 'SUPERSEDES' LIMIT 1", n);
    return row ? { id: row.target, invalidatedAt: parseInvalidatedAt(row.properties) } : null;
  }
  function supersededAtOf(n) {
    const inc = newerOf(n);
    return inc ? inc.invalidatedAt : null;
  }

  // 1. Climb to the newest head (follow the "newer" direction to its end).
  let head = nodeId;
  const climbSeen = new Set([nodeId]);
  let steps = 0;
  while (true) {
    if (steps > maxDepth) {
      return { ok: false, reason: 'cycle_detected', chain: [{ node_id: head, superseded_at: null }] };
    }
    steps += 1;
    const nx = newerOf(head);
    if (!nx) break;
    if (climbSeen.has(nx.id)) {
      return { ok: false, reason: 'cycle_detected', chain: [{ node_id: head, superseded_at: supersededAtOf(head) }] };
    }
    climbSeen.add(nx.id);
    head = nx.id;
  }

  // 2. Descend from head, collecting each older node (newest -> oldest).
  const chain = [];
  const seen = new Set();
  let cur = head;
  steps = 0;
  while (cur) {
    if (seen.has(cur)) {
      return { ok: false, reason: 'cycle_detected', chain: chain };
    }
    if (steps > maxDepth) {
      return { ok: false, reason: 'cycle_detected', chain: chain };
    }
    steps += 1;
    seen.add(cur);
    chain.push({ node_id: cur, superseded_at: supersededAtOf(cur) });
    const older = olderOf(cur);
    cur = older ? older.id : null;
  }

  return { ok: true, chain: chain };
}

module.exports = { supersede, walkSupersedesChain };
