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
  //   session by 117-05 emitBrainCanonDrift via this EVENT_TYPES string).
  // Size-invariant note: additive set; downstream phases extend (see the Phase 88.2-00,
  // 89-07-00, 116-00, 117-00, 110-02 blocks). Tests assert a FLOOR + named membership,
  // not an exact count -- so a future phase adding an event type cannot regress baseline.
  'auto_explore_fired',
  'auto_explore_finding_surfaced',
  'auto_explore_user_response',
  'auto_explore_skipped',
  'auto_explore_sanitizer_hit',
  'brain_canon_drift_observed',
  // Phase 110-02 extension (Brain Context Packet Contract; D-07 + D-10 telemetry mirror):
  //   brain_packet_rejected   -> an outbound packet failed in-schema validation in
  //                              brain-client.sendPacket (reject hard -- thrown error).
  //   brain_response_rejected -> a Brain response failed out-schema validation -> degraded
  //                              soft, NOT ingested, no partial-ingest.
  //   brain_legacy_path_used  -> the forward-looking deprecation guard fired (no current
  //                              call site shipped in 110-02; see brain-client.cjs).
  // Additive extension only; mirrors the Phase 116-00 5-tension-strings idiom and the
  // 117-00 6-auto_explore-strings idiom. logEvent already rejects event_type values
  // outside EVENT_TYPES -- so these are accepted only because they are now IN the Set.
  'brain_packet_rejected',
  'brain_response_rejected',
  'brain_legacy_path_used',
  // Phase 124-02 extension (FEYNMAN.md Temporal Awareness; D-10 telemetry mirror):
  //   feynman_timeline_refreshed      -> the runner successfully rendered + wrote the
  //                                      sentinel-bounded ## Timeline (auto) section for one
  //                                      FEYNMAN.md (per section, per refresh).
  //   feynman_timeline_refresh_failed -> the runner caught an exception during render or write;
  //                                      watermark NOT updated; FEYNMAN.md NOT corrupted (atomic
  //                                      .tmp write means the original is preserved on failure).
  // Additive extension only; mirrors the Phase 110-02 3-string idiom verbatim. logEvent already
  // rejects event_type values outside EVENT_TYPES -- so these are accepted only because they
  // are now IN the Set. Set size grows by 2 (was 35 before Phase 124; now 37 baseline; coexists
  // with the Phase 125-01 framework_invoked extension which adds +1 in parallel).
  'feynman_timeline_refreshed',
  'feynman_timeline_refresh_failed',
  // Phase 125-01 extension (counter source for D3 continuous investment gradient).
  // Each /mos:* methodology command run logs one framework_invoked event with payload
  // {framework, command, timestamp}. computeInvestmentLevel(roomState) projects
  // COUNT(memory_event WHERE event_type='framework_invoked') -> investment_level.
  // The actual emission site is a follow-on instrumentation pass (lib/render/render-v2.cjs
  // or per-command hook); Plan 01 only ships the event_type allowlist entry so
  // computeInvestmentLevel can call findRecentChanges with this filter and get 0 (cold)
  // back from a fresh room. The instrumentation is non-blocking for Plan 01 acceptance
  // since computeInvestmentLevel reads from roomState.framework_invocations (which a
  // separate caller will populate by calling findRecentChanges + counting); when no
  // such count is available, the helper returns level: 0 -- the cold-start path.
  'framework_invoked',
  // Phase 125-06 extension (D7: F-selector reject/defer become typed graph signal).
  // Emitted by lib/workflow/selector-decisions.cjs::recordSelectorDecision.
  // Payload: {decision: 'defer'|'reject', command, framework, reason, edge_semantic,
  //   expires_at|null, score_at_decision, investment_level_at_decision}. The corresponding
  //   DEFERRED/REJECTED cascade edge is written via navigation.writeEdge (Plan 00).
  //   Canon Part 4: every choice is graph data. The F-selector's adaptive-questioning
  //   surface relies on this signal to apply decay-weight in subsequent rankings.
  'f_selector_decision',
  // Phase 125-07 extension (D8: none-fit affordance + ranker-miss capture).
  // Emitted by lib/workflow/selector-decisions.cjs::recordSelectorMiss.
  // Payload: {top_k_offered: [{command, score}, ...], user_intent: <verbatim user text>,
  //   investment_level_at_decision}. NO cascade edge written (miss is temporal-only).
  //   Canon Part 8: user_intent stays LOCAL; never sent to Brain.
  'f_selector_miss',
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
