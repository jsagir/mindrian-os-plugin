'use strict';
/*
 * Phase 120-02 Wave 2 Task 2 -- F.7 verb dispatch consumer. Per CONTEXT.md
 * D-08 + D-09 + D-10:
 *
 *   [Explore deeper]   -- navigational; drills to artifact pair view; NO event.
 *   [Confirm]          -- positive training signal; emits breakthrough_confirmed.
 *   [File as decision] -- D-09 bridge to Phase 88 decision-log; emits
 *                         breakthrough_filed_as_decision AND writes a FILED_AS_DECISION
 *                         typed edge (Canon Part 4 -- every choice is graph data).
 *   [Dismiss]          -- D-10 mandatory; negative training signal + canary input;
 *                         emits breakthrough_dismissed WITH artifact_ids_at_dismiss
 *                         (the D-13 baseline for the resurfacing predicate).
 *   [Back]             -- escape; NO event.
 *
 * Canon Part 4: every choice is graph data; these 5 events ARE the graph signal.
 * Canon Part 8: pure LOCAL; no Brain coupling; no cross-room aggregation.
 * Canon Part 9: ALL writes route through navigation.cjs::logMemoryEvent +
 *   navigation.cjs::writeEdge chokepoints. The Breakthrough-node property update
 *   uses direct UPDATE because there is no dedicated node-update chokepoint -- it
 *   mirrors the lib/core/breakthrough/schema.cjs precedent of direct INSERT into
 *   the nodes table (the per-type schema helper pattern).
 *
 * Em-dash HARD RULE (CLAUDE.md feedback_no_emdashes): zero U+2014 in source.
 *
 * Pure CJS, node built-ins only, zero deps.
 */

const navigation = require('../navigation.cjs');

// CONTEXT.md D-08 verbatim lock. Object.freeze prevents accidental mutation of
// the canonical verb -> event mapping. The 5 verbs match the retained F7_VERBS
// array in lib/hmi/shape-f7-breakthrough-renderer.cjs (Plan 120-01) -- the
// definitional home of the breakthrough verb set. Phase 188-01 (SFS-06) collapsed
// the Breakthrough SHAPE (bare F.7 is the dial now); the verb set re-homes to an
// F.1 next-move but its canonical definition stays in that retained module.
const VERB_TO_EVENT = Object.freeze({
  'Explore deeper':   null,                          // navigational; no event
  'Confirm':          'breakthrough_confirmed',
  'File as decision': 'breakthrough_filed_as_decision',
  'Dismiss':          'breakthrough_dismissed',
  'Back':             null,                          // escape; no event
});

// readBreakthroughNode -- defensive read of the breakthrough node for payload
// composition. Returns null on missing node, malformed properties JSON, or any
// throw (graceful-degradation: dispatchVerb still emits the event with a partial
// payload so the user's choice is captured even if the breakthrough node was
// purged in a concurrent operation).
function readBreakthroughNode(db, breakthroughId) {
  try {
    if (!db || typeof breakthroughId !== 'string' || breakthroughId.length === 0) return null;
    const row = db.prepare(
      "SELECT id, type, properties FROM nodes WHERE id = ? AND type = 'breakthrough'"
    ).get(breakthroughId);
    if (!row) return null;
    let props = {};
    try { props = JSON.parse(row.properties); } catch (_e) { props = {}; }
    return { id: row.id, type: row.type, properties: props };
  } catch (_e) {
    return null;
  }
}

// readArtifactIdsAtDismiss -- read the current DERIVED_FROM edges to compute the
// artifact_ids[] snapshot at dismiss time. This is the D-13 second-half baseline
// that resurfacing.cjs::isEligibleForSurfacing compares against later.
//
// Note: the edges table uses snake-case column names `source` + `target` + `type`
// (per lib/core/lazygraph-ops.cjs::initSchema), NOT `source_id` + `edge_type`.
function readArtifactIdsAtDismiss(db, breakthroughId) {
  try {
    const rows = db.prepare(
      "SELECT target FROM edges WHERE source = ? AND type = 'DERIVED_FROM'"
    ).all(breakthroughId);
    return rows.map(function (r) { return r.target; });
  } catch (_e) {
    return [];
  }
}

// handleConfirm -- positive training signal. Emits breakthrough_confirmed with
// kind + confidence + theme provenance. Plan 120-01 scoring.cjs reads these events
// via getUserEngagementPrior to update the per-detector prior in subsequent fires.
function handleConfirm(db, breakthroughId, bk) {
  const props = (bk && bk.properties) || {};
  const payload = {
    breakthrough_id: breakthroughId,
    kind: typeof props.kind === 'string' ? props.kind : null,
    confidence: typeof props.confidence === 'number' ? props.confidence : null,
    theme: typeof props.theme === 'string' ? props.theme.slice(0, 200) : '',
    source_path: 'system:breakthrough-verb-dispatch',
    created_by: 'system',
  };
  return navigation.logMemoryEvent(db, 'breakthrough_confirmed', payload);
}

// handleDismiss -- D-10 mandatory exit. Emits breakthrough_dismissed WITH the
// artifact_ids_at_dismiss baseline so the D-13 newArtifactsAccumulated predicate
// can compare against it on potential resurfacing. The baseline is read from the
// CURRENT DERIVED_FROM edges (the snapshot at the moment of dismiss).
function handleDismiss(db, breakthroughId, bk) {
  const props = (bk && bk.properties) || {};
  const artifactIdsAtDismiss = readArtifactIdsAtDismiss(db, breakthroughId);
  const payload = {
    breakthrough_id: breakthroughId,
    kind: typeof props.kind === 'string' ? props.kind : null,
    confidence: typeof props.confidence === 'number' ? props.confidence : null,
    theme: typeof props.theme === 'string' ? props.theme.slice(0, 200) : '',
    artifact_ids_at_dismiss: artifactIdsAtDismiss, // D-13 baseline for resurfacing
    source_path: 'system:breakthrough-verb-dispatch',
    created_by: 'system',
  };
  return navigation.logMemoryEvent(db, 'breakthrough_dismissed', payload);
}

// handleFileAsDecision -- D-09 bridge to Phase 88 decision-log. TWO side effects:
//   (a) emits breakthrough_filed_as_decision (memory_event in the event log).
//   (b) writes a FILED_AS_DECISION typed edge (Breakthrough -> Decision) via
//       the navigation.cjs::writeEdge chokepoint. The destination Decision node
//       id is 'decision:' + breakthroughId by convention; Phase 88 (or a future
//       Phase 121 housekeeping pass) is responsible for materializing the
//       Decision node body if it does not yet exist.
//
// The event always lands. The edge MAY soft-fail (FK to a non-existent Decision
// node) -- in that case the event remains as the audit trail and /mos:doctor
// can find the missing edge later. This mirrors the Phase 120-00 schema.cjs
// soft-fail pattern: defensive enrichment, never throws.
function handleFileAsDecision(db, breakthroughId, bk) {
  const props = (bk && bk.properties) || {};
  const payload = {
    breakthrough_id: breakthroughId,
    kind: typeof props.kind === 'string' ? props.kind : null,
    theme: typeof props.theme === 'string' ? props.theme.slice(0, 200) : '',
    source_path: 'system:breakthrough-verb-dispatch',
    created_by: 'system',
  };
  const eventResult = navigation.logMemoryEvent(db, 'breakthrough_filed_as_decision', payload);
  // D-09 typed-edge bridge. FILED_AS_DECISION is an additive ALLOWED_EDGE_TYPES
  // extension shipped in this plan (Phase 120-02 Wave 2; mirrors the Phase 120-00
  // DERIVED_FROM additive idiom).
  try {
    navigation.writeEdge(db, {
      source_id: breakthroughId,
      target_id: 'decision:' + breakthroughId,
      edge_type: 'FILED_AS_DECISION',
      properties: { filed_at: Date.now(), source_kind: payload.kind },
    });
  } catch (_e) {
    // Soft failure: the event was logged; the edge is the "nice-to-have" bridge.
    // /mos:doctor will find missing edges in a future housekeeping pass.
  }
  return eventResult;
}

// dispatchVerb(verb, breakthroughId, roomState) -- the 5-way switch.
// Returns:
//   { ok: true, navigational: true, drill_target } -- Explore deeper.
//   { ok: true, navigational: true, escape: true } -- Back.
//   { ok: true, navigational: false, eventId } -- Confirm / Dismiss / File as decision.
//   { ok: false, reason: 'unknown_verb' } -- defense against drift from F7_VERBS.
//   { ok: false, reason: 'no_db' } -- defensive degradation (caller forgot db handle).
//
// After a state-changing verb (Confirm / Dismiss / File as decision), the
// Breakthrough node's properties are updated additively with handled_at + handled_verb
// so downstream telemetry can find recently-handled breakthroughs without scanning
// the full event log. The update is best-effort (try/catch) -- never throws.
function dispatchVerb(verb, breakthroughId, roomState) {
  if (typeof verb !== 'string' || !Object.prototype.hasOwnProperty.call(VERB_TO_EVENT, verb)) {
    return { ok: false, reason: 'unknown_verb' };
  }
  const db = roomState && roomState.db;
  if (!db) return { ok: false, reason: 'no_db' };

  if (verb === 'Explore deeper') {
    return { ok: true, navigational: true, drill_target: breakthroughId };
  }
  if (verb === 'Back') {
    return { ok: true, navigational: true, escape: true };
  }

  const bk = readBreakthroughNode(db, breakthroughId);
  // Note: bk may be null in degraded cases (node was purged); we still emit the
  // event with breakthrough_id but null fields. Defensive-degradation pattern
  // mirrors the Phase 117 graceful-degradation idiom.

  let result;
  if (verb === 'Confirm') result = handleConfirm(db, breakthroughId, bk);
  else if (verb === 'Dismiss') result = handleDismiss(db, breakthroughId, bk);
  else if (verb === 'File as decision') result = handleFileAsDecision(db, breakthroughId, bk);

  // Best-effort node update: mark handled_at + handled_verb on the breakthrough node.
  // Never throws -- the dispatch result is the authoritative success signal.
  //
  // Phase 194-06 Task 1 (PSB-08 pre-req): this best-effort read-merge-write bumps
  // last_modified_at alongside last_seen_at so a co-session mutating the same
  // breakthrough node's properties is detectable by the reconcile-guard CAS token.
  // Both stamps bound to the same now.
  try {
    if (bk) {
      const nowMs = Date.now();
      const updated = Object.assign({}, bk.properties, {
        handled_at: nowMs,
        handled_verb: verb,
      });
      db.prepare("UPDATE nodes SET properties = ?, last_seen_at = ?, last_modified_at = ? WHERE id = ?")
        .run(JSON.stringify(updated), nowMs, nowMs, breakthroughId);
    }
  } catch (_e) { /* best-effort */ }

  return Object.assign(
    { navigational: false },
    result || { ok: false, reason: 'handler_returned_nothing' }
  );
}

// F7_VERB_HANDLERS exposed for granular test fixtures + future Phase 121
// reflection. The 3-handler map covers the event-emitting verbs only;
// navigational verbs are inlined in dispatchVerb.
const F7_VERB_HANDLERS = Object.freeze({
  'Confirm': handleConfirm,
  'Dismiss': handleDismiss,
  'File as decision': handleFileAsDecision,
});

module.exports = {
  dispatchVerb: dispatchVerb,
  VERB_TO_EVENT: VERB_TO_EVENT,
  F7_VERB_HANDLERS: F7_VERB_HANDLERS,
};
