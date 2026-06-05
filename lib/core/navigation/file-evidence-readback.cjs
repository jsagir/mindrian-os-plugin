'use strict';
/*
 * Phase 141-04 -- FILEVAL-02: the read-back-validation filing wrapper.
 *
 * This module is a THIN wrapper over two already-shipped writers (Canon Part 7,
 * reuse before build): it NEVER contains its own node-table insert statement. It
 * wraps:
 *   - writeEvidenceClaim (lib/core/navigation/evidence-claim.cjs) -- the LOCKED
 *     Phase 136 forward-contract EvidenceClaim node writer (review_status
 *     'proposed', created_by 'system', the 4 locked provenance fields).
 *   - writeEdge (lib/core/navigation/edges.cjs) -- the typed cascade-edge writer;
 *     INFORMS is in the frozen ALLOWED_EDGE_TYPES set.
 *
 * The NET-NEW layer no shipped path has: after writing the node + its INFORMS
 * edge in one hand-rolled BEGIN/COMMIT/ROLLBACK transaction (mirrors
 * lib/core/navigation/focus.cjs:49-80; the sqlite built-in has no
 * transaction(fn) helper), it READS the row back and asserts it landed with the expected
 * provenance. This is the FILEVAL honesty rule: a filing that did not land is
 * SURFACED as a structured { ok:false, reason } -- never swallowed, never a
 * silent fake-recall (threat T-141-07).
 *
 * Caller-owned db handle (mirrors evidence-claim.cjs:10-17): this module NEVER
 * requires the sqlite built-in and NEVER opens room.db. The caller (a deferred DRSCH
 * executor or the Phase 143 FILEVAL-01 producer) owns and closes the handle, so
 * the node write and the INFORMS edge batch onto a single handle in one txn.
 *
 * Graph-first only (D-09): this writes to room.db; it builds NO Markdown /
 * fractal-artifact projection (that render-from-graph projection is deferred to
 * Phase 143 MEMDIAL). The reserved artifact_path key (D-10) keeps that future
 * projection possible without precluding it.
 *
 * Fixture-first (D-02a): Phase 141 has NO live producer; this is built and tested
 * against tests/fixtures/room-141-fixture.cjs. An "unused consumer" is expected.
 *
 * Canon Part 9 role 5: an EvidenceClaim is a TRUTH-CLAIM node -- it lands
 * review_status 'proposed' and is NEVER auto-confirmed here; the read-back
 * asserts 'proposed'. Promotion to 'confirmed' is a human Decision Gate, out of
 * scope (threat T-141-08).
 *
 * Exports:
 *   fileEvidenceWithReadback(db, params) -> { ok:true, node_id } | { ok:false, reason, node_id? }
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const { writeEvidenceClaim } = require('./evidence-claim.cjs');
const { writeEdge } = require('./edges.cjs');

// The 4 LOCKED Phase 136 forward-contract provenance fields. The read-back
// asserts each survived the write unchanged (threat T-141-09). artifact_path is
// purely additive and is asserted separately, never instead of these four.
const LOCKED_PROVENANCE_FIELDS = Object.freeze(['source', 'url', 'retrieved_at', 'evidence_tier']);

// fileEvidenceWithReadback(db, params) -- file a typed EvidenceClaim node with
// provenance through the SHIPPED writeEvidenceClaim, wire its INFORMS edge to a
// target node via the SHIPPED writeEdge, then read the row back and assert it
// landed. All three steps run inside one BEGIN/COMMIT/ROLLBACK transaction.
//
// params (same shape writeEvidenceClaim consumes, plus two additive keys):
//   { topic, source, url, retrieved_at, evidence_tier, summary, sessionId,
//     artifact_path?, informsTargetId? }
//
// Returns:
//   { ok:true, node_id }                                       on success
//   { ok:false, reason:<writeEvidenceClaim reason> }           node write rejected
//   { ok:false, reason:'informs_edge_failed', node_id }        INFORMS edge rejected
//   { ok:false, reason:'filing_did_not_land', node_id }        read-back caught a mismatch
//   { ok:false, reason:'transaction_failed', detail }          the handle could not transact
//
// Defensive: never throws on caller input or on a dead handle; a closed db
// surfaces as { ok:false } rather than propagating (the honesty rule).
function fileEvidenceWithReadback(db, params) {
  if (!params || typeof params !== 'object') {
    return { ok: false, reason: 'invalid_params' };
  }
  const targetId = typeof params.informsTargetId === 'string' ? params.informsTargetId : '';

  let inTxn = false;
  try {
    db.exec('BEGIN');
    inTxn = true;

    // (1) The SHIPPED node writer. Pass through the locked provenance fields plus
    //     the additive artifact_path (D-10). Never rebuild the INSERT here.
    const nodeRes = writeEvidenceClaim(db, params);
    if (!nodeRes || nodeRes.ok !== true) {
      db.exec('ROLLBACK');
      inTxn = false;
      return nodeRes && typeof nodeRes === 'object'
        ? nodeRes
        : { ok: false, reason: 'evidence_claim_write_failed' };
    }
    const nodeId = nodeRes.node_id;

    // (2) The SHIPPED edge writer: INFORMS from the new evidence node to its
    //     target. Surface an edge failure honestly (threat T-141-07).
    if (targetId.length > 0) {
      const edgeRes = writeEdge(db, {
        source_id: nodeId,
        target_id: targetId,
        edge_type: 'INFORMS',
        properties: { reason: 'evidence_informs_target' },
      });
      if (!edgeRes || edgeRes.ok !== true) {
        db.exec('ROLLBACK');
        inTxn = false;
        return { ok: false, reason: 'informs_edge_failed', node_id: nodeId };
      }
    }

    db.exec('COMMIT');
    inTxn = false;

    // (3) The NET-NEW honesty layer: read the row back and assert it landed.
    //     No shipped path does this. A SELECT only, never a node-table insert here.
    const row = db.prepare(
      'SELECT id, type, review_status, properties FROM nodes WHERE id = ?'
    ).get(nodeId);
    if (!row) {
      return { ok: false, reason: 'filing_did_not_land', node_id: nodeId };
    }
    // Canon Part 9 role 5: a truth-claim node lands 'proposed', never confirmed.
    if (row.review_status !== 'proposed') {
      return { ok: false, reason: 'filing_did_not_land', node_id: nodeId };
    }
    let landed;
    try {
      landed = JSON.parse(row.properties || '{}');
    } catch (_e) {
      return { ok: false, reason: 'filing_did_not_land', node_id: nodeId };
    }
    // The 4 LOCKED provenance fields must round-trip unchanged (threat T-141-09).
    for (const field of LOCKED_PROVENANCE_FIELDS) {
      if (typeof params[field] === 'string' && landed[field] !== params[field]) {
        return { ok: false, reason: 'filing_did_not_land', node_id: nodeId };
      }
    }
    // artifact_path (D-10) is additive -- when the caller supplied it, it must
    // round-trip through the same properties JSON blob unchanged.
    if (typeof params.artifact_path === 'string' && params.artifact_path.length > 0) {
      if (landed.artifact_path !== params.artifact_path) {
        return { ok: false, reason: 'filing_did_not_land', node_id: nodeId };
      }
    }

    return { ok: true, node_id: nodeId };
  } catch (e) {
    // A dead handle (closed db) or any unexpected sqlite error is surfaced, not
    // swallowed. Best-effort rollback if a txn is still open on a live handle.
    if (inTxn) {
      try { db.exec('ROLLBACK'); } catch (_rb) { /* handle already gone */ }
    }
    return { ok: false, reason: 'transaction_failed', detail: String(e && e.message ? e.message : e).slice(0, 80) };
  }
}

module.exports = { fileEvidenceWithReadback };
