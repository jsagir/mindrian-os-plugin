'use strict';
// Phase 120-03 Wave 2 Task 2 -- D-18 4-tier hybrid ethics fence.
//
// Per CONTEXT.md D-18 LOCKED VERBATIM:
//   HARD FLOOR     -- D-20 Cypher provenance enforced (refuse if no DERIVED_FROM)
//   HARD CEILING   -- confidence > 0.50 AND full provenance = auto-surface
//   SOFT BAND      -- 0.35 <= confidence <= 0.50 = review queue (NOT surfaced);
//                     20% sampling weekly; becomes retraining data
//   BELOW FLOOR    -- confidence < 0.35 = soft-fire buffer only
//
// D-18 is the FOURTH structural enforcement point for D-20 Cypher-provable
// provenance. The other three:
//   1. Plan 120-00 schema.cjs::validateProvenance (writeBreakthrough entry guard)
//   2. Plan 120-01 renderShapeF7Breakthrough (refuses provenance-less render)
//   3. Plan 120-02 surfaceBreakthrough SQL check (refuses provenance-less surface)
//   4. Plan 120-03 classifyEthicsBand HARD_FLOOR branch (this file)
//
// Canon Part 5: evidence is graded by context; the 4 D-18 bands map to the four
//   evidence tiers (Academic / Operational / Practitioner / None) via confidence
//   bins. HARD_CEILING is Academic-or-Operational-tier evidence; SOFT_BAND is
//   Practitioner-tier; BELOW_FLOOR is None-tier; HARD_FLOOR is structural refusal
//   for any tier without Cypher-provable provenance.
// Canon Part 8: pure LOCAL; no Brain coupling. Review queue lives at
//   $ROOMS_HOME/.rooms/breakthrough-review-queue.db (sibling pattern, Phase 119-01
//   precedent); never sent to Brain.
// Canon Part 9: ALL memory_event writes via navigation.cjs::logMemoryEvent
//   chokepoint; review-queue writes via review-queue.cjs::insertReviewCandidate.
//
// Em-dash HARD RULE (CLAUDE.md feedback_no_emdashes): zero U+2014 in source.

// D-18 frozen threshold constants. Locked at canon-decision level; changing these
// numbers requires re-running /gsd:discuss-phase 120.
const HARD_CEILING_CONFIDENCE = 0.50;        // confidence > this -> HARD_CEILING (auto-surface)
const SOFT_BAND_MIN_CONFIDENCE = 0.35;       // confidence >= this -> SOFT_BAND (review queue)
const SOFT_BAND_MAX_CONFIDENCE = 0.50;       // confidence <= this AND > BELOW -> SOFT_BAND
const BELOW_FLOOR_THRESHOLD = 0.35;          // confidence < this -> BELOW_FLOOR (soft-fire buffer)

// The 4 D-18 bands, frozen verbatim. Ordering chosen to put HARD_FLOOR first
// (the most-blocked band) and HARD_CEILING last (the auto-surface band), with
// the two middle bands (BELOW_FLOOR + SOFT_BAND) in increasing-confidence order.
const ETHICS_BANDS = Object.freeze(['HARD_FLOOR', 'BELOW_FLOOR', 'SOFT_BAND', 'HARD_CEILING']);

// classifyEthicsBand(breakthrough) -> band name string.
//
// Returns one of the 4 ETHICS_BANDS values. HARD_FLOOR primacy: even at high
// confidence, a breakthrough without provenance is structurally refused (D-20
// Cypher-provable principle). This is defense in depth -- writeBreakthrough
// already rejects provenance-less inputs at the schema layer (Plan 120-00),
// but classifyEthicsBand is the fourth structural enforcement point at
// classification time.
function classifyEthicsBand(breakthrough) {
  if (!breakthrough || typeof breakthrough !== 'object') return 'HARD_FLOOR';
  const ids = Array.isArray(breakthrough.artifact_ids)
    ? breakthrough.artifact_ids.filter((s) => typeof s === 'string' && s.length > 0)
    : [];
  if (ids.length === 0) {
    // D-18 HARD FLOOR primacy: no provenance overrides any confidence value.
    // This is the fourth structural enforcement point for D-20.
    return 'HARD_FLOOR';
  }
  const conf = (typeof breakthrough.confidence === 'number' && Number.isFinite(breakthrough.confidence))
    ? breakthrough.confidence
    : 0;
  if (conf > HARD_CEILING_CONFIDENCE) return 'HARD_CEILING';
  if (conf >= SOFT_BAND_MIN_CONFIDENCE) return 'SOFT_BAND';
  return 'BELOW_FLOOR';
}

// queueForReview(breakthrough, roomsHome, roomState) -> {ok, queue_id, queued_at, band, ...}
//
// SOFT_BAND handler. Inserts the candidate into the .rooms/breakthrough-review-queue.db
// (the rooms-meta.db sibling pattern from Phase 119-01) AND emits a
// breakthrough_in_review_queue memory_event in the source room.db (if roomState.db
// is provided) so /mos:doctor + the scanner can find queued candidates.
//
// Caller contract: callers MUST classify the candidate first (only invoke this
// for SOFT_BAND classifications). HARD_FLOOR / BELOW_FLOOR / HARD_CEILING are
// silent-drop / soft-fire / auto-surface respectively, not queued.
//
// Graceful failure modes:
//   - review-queue open fails: returns {ok:false, reason} -- scanner swallows
//     the failure (Phase 120-03 plan: review-queue failure must NOT block the
//     scanner; defensive integration).
//   - memory_event emit fails: queue insert is still reported as ok.
function queueForReview(breakthrough, roomsHome, roomState) {
  const reviewQueueModule = require('./review-queue.cjs');
  const qResult = reviewQueueModule.openReviewQueue(roomsHome);
  if (!qResult.db) {
    return { ok: false, reason: qResult.reason || 'queue_open_failed', band: 'SOFT_BAND' };
  }
  const roomSlug = (roomState && typeof roomState.roomSlug === 'string') ? roomState.roomSlug : null;
  const insertResult = reviewQueueModule.insertReviewCandidate(qResult.db, breakthrough, roomSlug);
  if (!insertResult.ok) {
    try { qResult.db.close(); } catch (_e) { /* swallow */ }
    return Object.assign({ band: 'SOFT_BAND' }, insertResult);
  }
  // Emit memory_event mirror in the source room.db so /mos:doctor + the scanner
  // can find queued candidates. Defensive: only attempt if a db handle is provided
  // (the test harness or the scanner contract supplies it).
  if (roomState && roomState.db && typeof roomState.db.prepare === 'function') {
    try {
      const navigation = require('../navigation.cjs');
      // created_by is constrained at the schema layer to ('user','larry','import','brain','system');
      // use 'system' for the ethics-fence emit site (Phase 109 schema CHECK constraint).
      navigation.logMemoryEvent(roomState.db, 'breakthrough_in_review_queue', {
        breakthrough_id: breakthrough.id || null,
        kind: breakthrough.kind || null,
        confidence: typeof breakthrough.confidence === 'number' ? breakthrough.confidence : 0,
        queue_id: insertResult.queue_id,
        source_path: 'system:breakthrough-ethics-fence',
        created_by: 'system',
      });
    } catch (_e) { /* memory_event emit failure does NOT block the queue insert */ }
  }
  try { qResult.db.close(); } catch (_e) { /* swallow */ }
  return Object.assign({ band: 'SOFT_BAND' }, insertResult);
}

module.exports = {
  classifyEthicsBand,
  queueForReview,
  ETHICS_BANDS,
  HARD_CEILING_CONFIDENCE,
  SOFT_BAND_MIN_CONFIDENCE,
  SOFT_BAND_MAX_CONFIDENCE,
  BELOW_FLOOR_THRESHOLD,
};
