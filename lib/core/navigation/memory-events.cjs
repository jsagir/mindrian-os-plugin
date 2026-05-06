'use strict';
// Phase 109-03 memory event log primitives. Internal to lib/core/navigation/.
// Re-exported by lib/core/navigation.cjs (Plan 109-04) as findRecentChanges (closed surface).
// logEvent is internal (not in the closed 13-function surface); other navigation/* helpers
// call it directly. Plan 109-02 setFocus writes focus_changed events inline (predates this
// plan); Plan 109-08 storeBrainSuggestions uses logEvent for brain_suggestion_received.

const crypto = require('node:crypto');

const EVENT_TYPES = Object.freeze(new Set([
  'node_created',
  'status_promoted',
  'status_rejected',
  'status_stale',
  'status_superseded',
  'focus_changed',
  'brain_query_sent',
  'brain_suggestion_received',
  'edge_added',
  'edge_removed',
  'opportunity_added',
  'opportunity_reacted',
  'opportunity_reflected',
  'opportunity_answered',
  'state_alias_migration',
  // Phase 88.2-00 Wave 0 extension (D-AMEND-02 telemetry mirror, R1-safe, INTERNAL Set)
  'selector_presentation',
  'selector_response',
  'selector_rejection_captured',
  'f6_round_completed',
  // Phase 89-07 Wave 0 extension (graph-native HARD RULE; ReverseSalientAgent dual-surface
  // telemetry mirror per memory feedback_reverse_salient_agent_graph_native.md rule 3).
  'reverse_salient_detected',
  'reverse_salient_acted_on',
  // Phase 116-00 Wave 0 extension (graph-native HARD RULE; unresolved-tension-hook
  // dual-surface telemetry mirror per memory feedback_reverse_salient_agent_graph_native.md
  // rule 3, mirroring the 89-07 ReverseSalientAgent pattern).
  'tension_detected',
  'tension_surfaced',
  'tension_resolved',
  'tension_decayed',
  'tension_skipped',
  // Phase 117-00 Wave 0 extension (graph-native HARD RULE; auto-explore-domains
  // dual-surface telemetry mirror per memory feedback_reverse_salient_agent_graph_native.md
  // rule 3, mirroring the 116-00 + 89-07-00 ReverseSalientAgent extension pattern).
  // Per RESEARCH §4.7 + §8.6: 4 auto_explore lifecycle events + 1 Brain-canon-drift event:
  //   fired (fingerprint detection -> spawn) -> finding_surfaced (drain -> F.1)
  //   -> user_response (Explore/Skip/Later/Free-text) OR skipped (suppression).
  //   brain_canon_drift_observed (FourLenses Brain vs FiveLenses Canon; emitted once per
  //   session by 117-05 emitBrainCanonDrift via this EVENT_TYPES string; size 31 invariant).
  'auto_explore_fired',
  'auto_explore_finding_surfaced',
  'auto_explore_user_response',
  'auto_explore_skipped',
  'auto_explore_sanitizer_hit',
  'brain_canon_drift_observed',
]));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function logEvent(db, eventType, payload) {
  if (!EVENT_TYPES.has(eventType)) {
    return { ok: false, reason: 'invalid_event_type' };
  }
  if (!isPlainObject(payload)) {
    return { ok: false, reason: 'invalid_payload' };
  }
  const nowMs = Date.now();
  const eventId = 'memory_event:' + eventType + ':' + nowMs + ':' + crypto.randomBytes(4).toString('hex');
  // Merge event_type as top-level key (overrides any caller-supplied event_type to prevent drift).
  const merged = Object.assign({}, payload, { event_type: eventType });
  const propsJson = JSON.stringify(merged);
  const sourcePath = typeof payload.source_path === 'string' ? payload.source_path : 'system:default';
  const createdBy = typeof payload.created_by === 'string' ? payload.created_by : 'system';
  try {
    db.prepare(
      "INSERT INTO nodes (id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) " +
      "VALUES (?, 'memory_event', ?, ?, ?, NULL, 'confirmed', ?, ?)"
    ).run(eventId, propsJson, sourcePath, createdBy, nowMs, nowMs);
  } catch (err) {
    return { ok: false, reason: err.message };
  }
  return { ok: true, eventId };
}

function findRecentChanges(db, sinceEpochMs, opts) {
  const options = opts || {};
  const limit = Number.isInteger(options.limit) && options.limit > 0 ? options.limit : 100;
  const eventTypeFilter = typeof options.eventType === 'string' && EVENT_TYPES.has(options.eventType) ? options.eventType : null;

  let sql =
    "SELECT n.id, json_extract(n.properties, '$.event_type') AS event_type, " +
    "json_extract(n.properties, '$.target_node_id') AS target_node_id, " +
    "n.created_at, n.source_path, n.properties " +
    "FROM nodes n " +
    "WHERE n.type = 'memory_event' AND n.created_at > ? ";
  const params = [sinceEpochMs];
  if (eventTypeFilter) {
    sql += "AND json_extract(n.properties, '$.event_type') = ? ";
    params.push(eventTypeFilter);
  }
  sql += "ORDER BY n.created_at DESC LIMIT ?";
  params.push(limit);

  const rows = db.prepare(sql).all(...params);
  return rows.map((r) => ({
    id: r.id,
    eventType: r.event_type,
    targetNodeId: r.target_node_id,
    createdAt: r.created_at,
    sourcePath: r.source_path,
    properties: JSON.parse(r.properties),
  }));
}

module.exports = { EVENT_TYPES, logEvent, findRecentChanges };
