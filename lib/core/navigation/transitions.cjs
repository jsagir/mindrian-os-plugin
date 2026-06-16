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

// CANON PART 9 v1.5 HUMAN-ATTRIBUTION GUARD (Phase 129.5-02 / D-02).
// AGENT_IDENTITIES is the closed lowercased set of non-human callers that MUST
// NOT confirm or validate a truth-claim node. The human-confirms-truth rule
// (role 5) forbids any agent (larry / brain / system / assistant) from promoting
// a truth-claim node to confirmed or validated. The guard fires before any
// mutation. resolveByUser (confirm-node.cjs) coerces any of these out of a
// USER.md identity so a poisoned file cannot smuggle an agent into a confirm.
const AGENT_IDENTITIES = Object.freeze(new Set(['larry', 'brain', 'system', 'assistant']));

// Truth-claim node types per the Canon Part 9 v1.5 audit-node carve-out (Plan
// 129.5-01). Only these nodes assert something about the venture's world and so
// require a human byUser to reach confirmed or validated. System-bookkeeping
// nodes (memory_event / audit / focus) are EXEMPT: they record what the system
// DID, not what is TRUE, so created_by=system is canon-legal for them.
const TRUTH_CLAIM_TYPES = Object.freeze(new Set(['claim', 'CausalClaim', 'assumption', 'decision', 'opportunity']));

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

function promoteNodeStatus(db, nodeId, fromStatus, toStatus, byUser, reason, opts) {
  // Clock seam (opts.now) per Phase 160-04 D-01a so tests inject a fixed
  // reference and the Phase 160 last_modified_at write-discipline stamps the
  // reference now (getReferenceNow) rather than the raw system clock. Defaults
  // to Date.now in production -- byte-compatible for every existing caller that
  // passes no opts. Mirrors the logEvent(opts.now) seam in memory-events.cjs.
  const options = opts && typeof opts === 'object' ? opts : {};
  const nowFn = typeof options.now === 'function' ? options.now : Date.now;
  const key = fromStatus + '->' + toStatus;
  if (!TRANSITIONS.has(key)) {
    return { ok: false, reason: 'invalid_transition' };
  }
  const row = db.prepare('SELECT id, review_status, type FROM nodes WHERE id = ?').get(nodeId);
  if (!row) {
    return { ok: false, reason: 'unknown_node' };
  }
  if (row.review_status !== fromStatus) {
    return { ok: false, reason: 'state_mismatch', currentStatus: row.review_status };
  }
  const setsConfirmed = (toStatus === 'confirmed' || toStatus === 'validated');
  // Human-attribution guard (Canon Part 9 v1.5 / D-02). A confirm or validate of a
  // truth-claim node by an agent identity is REJECTED before any mutation. The
  // carve-out exempts system-bookkeeping node types (memory_event / audit / focus):
  // the guard keys on the node's type column, so only TRUTH_CLAIM_TYPES are gated.
  // Non-confirm/non-validate transitions (reject / stale / superseded) are never
  // gated -- an agent MAY reject or stale a node. The existing byUser default to
  // system stays byte-compatible for every non-guarded path.
  if (setsConfirmed
      && TRUTH_CLAIM_TYPES.has(row.type)
      && AGENT_IDENTITIES.has(String(byUser || '').toLowerCase())) {
    return { ok: false, reason: 'agent_attribution_forbidden' };
  }
  const nowMs = nowFn();
  db.exec('BEGIN');
  try {
    // Phase 160-04 R7 last_modified_at write discipline: every node-WRITE path
    // ALSO sets last_modified_at to the reference now (the options.now seam),
    // disambiguating a true modify-stamp from last_seen_at (which conflates
    // read + write). A node READ never runs this UPDATE, so reading never
    // bumps last_modified_at. Both branches below are write paths.
    if (setsConfirmed) {
      db.prepare('UPDATE nodes SET review_status = ?, confirmed_by = ?, confirmed_at = ?, last_seen_at = ?, last_modified_at = ? WHERE id = ?')
        .run(toStatus, byUser || 'system', nowMs, nowMs, nowMs, nodeId);
    } else {
      db.prepare('UPDATE nodes SET review_status = ?, last_seen_at = ?, last_modified_at = ? WHERE id = ?')
        .run(toStatus, nowMs, nowMs, nodeId);
    }
    const eventType = EVENT_FOR_TRANSITION[key];
    // The memory_event audit node's created_by column carries a CHECK constraint
    // (IN 'user','larry','import','brain','system'), so a human navigator identity
    // (jonathan / navigator / founder) cannot be stored there directly. Map any
    // non-agent, non-system human byUser to the canonical 'user' marker for the
    // audit row's created_by column, while preserving the LITERAL human identity in
    // the unconstrained confirmed_by payload field (and on the truth-claim node's
    // own confirmed_by column above). System-bookkeeping and agent reject/stale
    // paths keep their byUser-or-system value byte-compatible.
    const literalBy = byUser || 'system';
    const auditCreatedBy = AGENT_IDENTITIES.has(String(literalBy).toLowerCase()) || literalBy === 'system'
      ? literalBy
      : 'user';
    const evRes = logEvent(db, eventType, {
      target_node_id: nodeId,
      previous_status: fromStatus,
      new_status: toStatus,
      reason: typeof reason === 'string' ? reason : null,
      created_by: auditCreatedBy,
      confirmed_by: literalBy,
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

module.exports = { promoteNodeStatus, TRANSITIONS, EVENT_FOR_TRANSITION, AGENT_IDENTITIES, TRUTH_CLAIM_TYPES };
