'use strict';
// Phase 109-08 Brain Result Ingestion. Per CONTEXT D-07 + RESEARCH section 8.
// Canon Part 9 LOAD-BEARING: Brain CAN'T write trusted memory.
// Every brain_insight row: created_by='brain', review_status='proposed', confirmed_by NULL.
//
// Per RESEARCH section 8.1: BEGIN/COMMIT/ROLLBACK transaction; partial failures roll back.
// Per RESEARCH section 8.3: ONE brain_suggestion_received memory_event per ingestion call,
// not one per insight. The event's review_status='confirmed' because it records a fact
// about what happened; created_by='system' because the ingestion code wrote it (not Brain).
// Per Phase 108 PROVENANCE.md L79-89: post-ingestion the canonical invariant SQL query
// SELECT id, type, source_path, created_by, confirmed_by FROM nodes
// WHERE review_status = 'confirmed' AND (confirmed_by IS NULL OR confirmed_by != 'user')
// MUST NOT return any brain_insight rows. brain_insight nodes are 'proposed', so they
// trivially satisfy the invariant.

const { logEvent } = require('./memory-events.cjs');
const { ALLOWED_EDGE_TYPES } = require('./edges.cjs');
const { insertNode } = require('../node-insert.cjs');

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function storeBrainSuggestions(db, packetResult, sessionId) {
  if (!isPlainObject(packetResult) || !Array.isArray(packetResult.suggestions) || packetResult.suggestions.length === 0) {
    return { ok: false, reason: 'no_suggestions' };
  }
  const jobId = packetResult.job_id || 'unknown_job';
  const insightIds = [];
  const rejectedEdgeTypes = [];
  db.exec('BEGIN');
  try {
    for (const sug of packetResult.suggestions) {
      const suggestionJobId = sug.job_id || jobId;
      const suggestionIndex = (sug.suggestion_index !== undefined && sug.suggestion_index !== null) ? sug.suggestion_index : insightIds.length;
      const insightId = 'brain_insight:' + suggestionJobId + ':' + suggestionIndex;
      const propsJson = JSON.stringify({
        summary: typeof sug.summary === 'string' ? sug.summary : '',
        methodology: typeof sug.methodology === 'string' ? sug.methodology : null,
        body: typeof sug.body === 'string' ? sug.body : '',
      });
      const sourcePath = 'brain:job:' + suggestionJobId;
      const confidence = typeof sug.confidence === 'number' ? sug.confidence : 0.5;
      // R17-01 delta (260903-gdm, navigator-confirmed Task 4): this write
      // previously had NO ON CONFLICT clause and threw on a duplicate id,
      // rolling back the WHOLE ingestion batch. The id
      // 'brain_insight:<jobId>:<index>' is fully deterministic, so
      // re-ingesting the same Brain job is a real, reachable path.
      // insertNode's default ON CONFLICT DO UPDATE makes a re-ingest a
      // silent refresh-in-place instead. created_by:'brain' (not 'system')
      // preserves the Canon Part 9 invariant this file's header cites: a
      // brain_insight row must never be review_status='confirmed' with a
      // non-user confirmed_by, and insertNode's DO UPDATE clause never
      // touches review_status, so a re-ingest cannot promote an insight.
      insertNode(db, insightId, 'brain_insight', propsJson, {
        source_path: sourcePath,
        created_by: 'brain',
        confidence: confidence,
        review_status: 'proposed',
        // R17-02 (Task 4 Decision 4): 'model_derived_assertion' -- the Brain
        // produced it, and Canon Part 9 already treats it as untrusted.
        epistemic_type: 'model_derived_assertion',
      });
      insightIds.push(insightId);

      if (Array.isArray(sug.graph_updates_proposed)) {
        for (const ep of sug.graph_updates_proposed) {
          if (!ep || typeof ep.source !== 'string' || typeof ep.target !== 'string' || typeof ep.type !== 'string') continue;
          // C3 (Phase 273): the closed edge-type allowlist is the SAME one writeEdge
          // enforces (edges.cjs::ALLOWED_EDGE_TYPES). Brain-supplied types are
          // remote-controlled input and MUST NOT bypass it. Reject-and-skip, not
          // throw: one bad suggestion must not roll back the whole ingestion batch
          // (the node-side contract two lines above this loop is per-suggestion too).
          if (!ALLOWED_EDGE_TYPES.has(ep.type)) {
            rejectedEdgeTypes.push(ep.type);
            continue;
          }
          const edgeProps = JSON.stringify({
            confidence: typeof ep.confidence === 'number' ? ep.confidence : 0.5,
            review_status: 'proposed',
            created_by: 'brain',
          });
          db.prepare("INSERT OR IGNORE INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)").run(ep.source, ep.target, ep.type, edgeProps);
        }
      }
    }

    // ONE memory_event per ingestion call (NOT one per insight; per RESEARCH section 8.3).
    const evRes = logEvent(db, 'brain_suggestion_received', {
      session_id: sessionId,
      insight_ids: insightIds,
      job_id: jobId,
      source_path: 'session:' + sessionId,
      created_by: 'system',
    });
    if (!evRes.ok) {
      db.exec('ROLLBACK');
      return { ok: false, reason: 'event_log_failed:' + evRes.reason };
    }

    db.exec('COMMIT');
    return { ok: true, insightIds, eventId: evRes.eventId, rejectedEdgeTypes };
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_rb) { /* ignore */ }
    return { ok: false, reason: err.message };
  }
}

module.exports = { storeBrainSuggestions };
