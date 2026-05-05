'use strict';
// Phase 109-04 truth-state transition chokepoint. Per Phase 108 TRUTH-STATES.md L40-58
// and L88. Every promoteNodeStatus call validates the transition pair against the
// closed Set; logs a status_* memory_event; populates confirmed_by + confirmed_at when
// transitioning to confirmed or validated.
//
// Canon Part 4: every status change is graph data; the memory_event row IS the audit
// edge for the transition.
// Canon Part 9: truth-state promotion is gated by the documented 8-transition closed
// taxonomy; any other (from, to) pair is rejected.

const { logEvent } = require('./memory-events.cjs');

// Closed Set of allowed (from, to) transitions. The Set member is 'from->to' string.
const TRANSITIONS = Object.freeze(new Set([
  'proposed->confirmed',
  'proposed->needs_evidence',
  'needs_evidence->validated',
  'confirmed->validated',
  'validated->invalidated',
  'proposed->rejected',
  'confirmed->superseded',
  'confirmed->stale',
]));

// event_type for each transition.
const EVENT_FOR_TRANSITION = Object.freeze({
  'proposed->confirmed': 'status_promoted',
  'proposed->needs_evidence': 'status_promoted',
  'needs_evidence->validated': 'status_promoted',
  'confirmed->validated': 'status_promoted',
  'validated->invalidated': 'status_promoted',
  'proposed->rejected': 'status_rejected',
  'confirmed->superseded': 'status_superseded',
  'confirmed->stale': 'status_stale',
});

function promoteNodeStatus(db, nodeId, fromStatus, toStatus, byUser, reason) {
  const key = fromStatus + '->' + toStatus;
  if (!TRANSITIONS.has(key)) {
    return { ok: false, reason: 'invalid_transition' };
  }
  const row = db.prepare('SELECT id, review_status FROM nodes WHERE id = ?').get(nodeId);
  if (!row) {
    return { ok: false, reason: 'unknown_node' };
  }
  if (row.review_status !== fromStatus) {
    return { ok: false, reason: 'state_mismatch', currentStatus: row.review_status };
  }
  const setsConfirmed = (toStatus === 'confirmed' || toStatus === 'validated');
  const nowMs = Date.now();
  db.exec('BEGIN');
  try {
    if (setsConfirmed) {
      db.prepare('UPDATE nodes SET review_status = ?, confirmed_by = ?, confirmed_at = ?, last_seen_at = ? WHERE id = ?')
        .run(toStatus, byUser || 'system', nowMs, nowMs, nodeId);
    } else {
      db.prepare('UPDATE nodes SET review_status = ?, last_seen_at = ? WHERE id = ?')
        .run(toStatus, nowMs, nodeId);
    }
    const eventType = EVENT_FOR_TRANSITION[key];
    const evRes = logEvent(db, eventType, {
      target_node_id: nodeId,
      previous_status: fromStatus,
      new_status: toStatus,
      reason: typeof reason === 'string' ? reason : null,
      created_by: byUser || 'system',
      source_path: 'transition:' + key,
    });
    if (!evRes.ok) {
      db.exec('ROLLBACK');
      return { ok: false, reason: 'event_log_failed:' + evRes.reason };
    }
    db.exec('COMMIT');
    return { ok: true, eventId: evRes.eventId };
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) { /* ignore */ }
    return { ok: false, reason: err.message };
  }
}

module.exports = { promoteNodeStatus, TRANSITIONS, EVENT_FOR_TRANSITION };
