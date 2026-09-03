'use strict';
// Phase 109-02 focus helpers. Internal to lib/core/navigation/.
// Re-exported by lib/core/navigation.cjs (Plan 109-04) as the closed surface.
//
// Canon Part 1: the focus node is the wicked navigator's working-memory
// anchor. Canon Part 4: every setFocus writes a focus_changed memory_event
// (audit trail). Canon Part 9: focus persists in room.db, never in process
// memory.

const path = require('node:path');
const crypto = require('node:crypto');
const { insertNode } = require('../node-insert.cjs');

const VALID_SET_BY = new Set(['user', 'larry', 'auto-from-jtbd', 'auto-from-operator', 'auto-from-state']);

function getActiveFocus(db, sessionId) {
  const row = db.prepare(
    "SELECT sf.session_id, sf.focus_node_id, sf.focus_type, sf.set_at, sf.set_by " +
    "FROM session_focus sf " +
    "WHERE sf.session_id = ?"
  ).get(sessionId);
  if (!row) return null;
  return {
    sessionId: row.session_id,
    focusNodeId: row.focus_node_id,
    focusType: row.focus_type,
    setAt: row.set_at,
    setBy: row.set_by,
  };
}

function lookupNodeType(db, nodeId) {
  const row = db.prepare('SELECT type FROM nodes WHERE id = ?').get(nodeId);
  return row ? row.type : null;
}

function setFocus(db, sessionId, nodeId, setBy) {
  if (!VALID_SET_BY.has(setBy)) {
    return { ok: false, reason: 'invalid_set_by' };
  }
  const nodeType = lookupNodeType(db, nodeId);
  if (!nodeType) {
    return { ok: false, reason: 'unknown_node' };
  }
  // Capture previous focus for the focus_changed event payload.
  const prior = getActiveFocus(db, sessionId);
  const previousId = prior ? prior.focusNodeId : null;
  const nowMs = Date.now();
  const eventId = 'memory_event:focus_changed:' + sessionId + ':' + nowMs + ':' + crypto.randomBytes(4).toString('hex');
  db.exec('BEGIN');
  try {
    db.prepare(
      "INSERT OR REPLACE INTO session_focus (session_id, focus_node_id, focus_type, set_at, set_by) VALUES (?, ?, ?, ?, ?)"
    ).run(sessionId, nodeId, nodeType, nowMs, setBy);
    const props = JSON.stringify({
      event_type: 'focus_changed',
      session_id: sessionId,
      previous_focus_node_id: previousId,
      new_focus_node_id: nodeId,
      set_by: setBy,
    });
    // CANON PART 9 AUDIT-NODE CARVE-OUT (v1.5, Phase 129.5 / D-03):
    // The node written below is a system-bookkeeping audit node (a
    // focus_changed memory_event), NOT a truth-claim node. Per the Part 9
    // audit-node carve-out, memory_event / audit / focus nodes are EXEMPT
    // from the human-confirm rule and MAY carry created_by=system with
    // review_status=confirmed. Here review_status=confirmed means
    // write-completed (the audit fact happened), not human-attributed truth.
    // Only truth-claim nodes {claim / CausalClaim / assumption / decision /
    // opportunity} require a human byUser to reach confirmed. This write is
    // therefore canon-legal, not a constitutional violation of role 5.
    //
    // R17-01 delta (260903-gdm, navigator-confirmed Task 4): this write
    // previously had NO ON CONFLICT clause and threw on a duplicate id,
    // rolling back the transaction. The id carries a timestamp plus 4 random
    // bytes, so a duplicate is effectively unreachable; insertNode's default
    // ON CONFLICT DO UPDATE is a no-op in practice here.
    insertNode(db, eventId, 'memory_event', props, {
      source_path: 'session:' + sessionId,
      created_by: 'system',
      review_status: 'confirmed',
    });
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    return { ok: false, reason: err.message };
  }
  return { ok: true, eventId };
}

function loadJtbdState(roomDir, mocks) {
  if (mocks && mocks.jtbd) return mocks.jtbd;
  try {
    return require(path.resolve(__dirname, '..', '..', 'hmi', 'jtbd-state.cjs'));
  } catch (_) {
    return null;
  }
}

function loadOperator(roomDir, mocks) {
  if (mocks && mocks.operator) return mocks.operator;
  try {
    return require(path.resolve(__dirname, '..', '..', 'conversation', 'operator.cjs'));
  } catch (_) {
    return null;
  }
}

function ensureNodeExists(db, nodeId) {
  const row = db.prepare('SELECT id FROM nodes WHERE id = ?').get(nodeId);
  return Boolean(row);
}

function computeAutoFocus(db, roomDir, sessionId, opts) {
  const options = opts || {};
  const mocks = options._mocks;
  const roomId = options.roomId || (roomDir ? path.basename(roomDir) : null);

  // Rule 1: active JTBD.
  const jtbdMod = loadJtbdState(roomDir, mocks);
  const jtbd = jtbdMod ? jtbdMod.getCurrent(roomDir) : null;
  if (jtbd && jtbd.current && jtbd.current.id) {
    const candidate = 'jtbd:' + jtbd.current.id;
    if (ensureNodeExists(db, candidate)) {
      return { focusNodeId: candidate, focusType: 'jtbd', setBy: 'auto-from-jtbd' };
    }
  }

  // Rule 2: operator DECISION_GATE -> most recent unconfirmed decision.
  const opMod = loadOperator(roomDir, mocks);
  const op = opMod ? opMod.getCurrent(roomDir) : null;
  if (op && op.current === 'DECISION_GATE') {
    const row = db.prepare(
      "SELECT id, type FROM nodes WHERE type = 'decision' AND review_status IN ('proposed','needs_evidence') ORDER BY created_at DESC LIMIT 1"
    ).get();
    if (row) {
      return { focusNodeId: row.id, focusType: row.type, setBy: 'auto-from-operator' };
    }
  }

  // Rule 3: room root node.
  if (roomId) {
    const candidate = 'room:' + roomId;
    if (ensureNodeExists(db, candidate)) {
      return { focusNodeId: candidate, focusType: 'room', setBy: 'auto-from-state' };
    }
  }

  // Rule 4: cold start.
  return null;
}

module.exports = { getActiveFocus, setFocus, computeAutoFocus, VALID_SET_BY };
