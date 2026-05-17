'use strict';
/*
 * Phase 120-02 Wave 2 Task 1 -- D-13..D-15 resurfacing rules. Per CONTEXT.md verbatim:
 *
 *   D-13 (dismissed): 7-day cooldown MINIMUM, AND only if new artifacts have accumulated
 *                     since the dismiss. BOTH conditions REQUIRED. Time passing alone
 *                     does NOT license resurfacing (user verbatim 2026-05-16:
 *                     "that's manipulation").
 *
 *   D-14 (confirmed): once-only. Never resurface. Resurfacing what the user already
 *                     accepted is patronizing.
 *
 *   D-15 (filed-as-decision): never resurface as breakthrough. May be referenced as
 *                              ENABLES in future related breakthroughs via Phase 88
 *                              decision-log machinery -- the decision becomes load-bearing
 *                              for future patterns.
 *
 * Canon Part 8: pure LOCAL; no Brain coupling; no cross-room aggregation.
 *   ALL reads via navigation.cjs::findRecentChanges chokepoint (Canon Part 9 D-06).
 *
 * Canon Part 9: SQL is the local mind; resurfacing is a read-only function over the
 *   event log. The composite isEligibleForSurfacing is a pure predicate -- no writes,
 *   no side effects.
 *
 * Em-dash HARD RULE (CLAUDE.md feedback_no_emdashes): use "--" not U+2014.
 *
 * Pure CJS, node built-ins only, zero deps.
 */

const navigation = require('../navigation.cjs');

// CONTEXT.md D-13 verbatim: 7 days * 24 hours * 3600 sec * 1000 ms = 604800000 ms.
const SEVEN_DAY_COOLDOWN_MS = 7 * 24 * 3600 * 1000;

// 90-day search window for resurfacing lookups (older events stay in log but the
// resurfacing predicates only look at trailing 90 days for memory locality + perf).
const RESURFACING_WINDOW_MS = 90 * 24 * 3600 * 1000;
const RESURFACING_QUERY_LIMIT = 500;

// findFirstEventForBreakthrough -- chokepoint-routed lookup for a specific event type
// against a specific breakthrough_id. Returns the most-recent matching event (since
// findRecentChanges orders DESC) or null if none. Graceful-degradation on any throw.
function findFirstEventForBreakthrough(id, eventType, db) {
  try {
    if (!db || typeof id !== 'string' || typeof eventType !== 'string') return null;
    const since = Date.now() - RESURFACING_WINDOW_MS;
    const events = navigation.findRecentChanges(db, since, {
      eventType: eventType,
      limit: RESURFACING_QUERY_LIMIT,
    }) || [];
    return events.find(function (e) {
      return e && e.properties && e.properties.breakthrough_id === id;
    }) || null;
  } catch (_e) {
    return null;
  }
}

// D-14 once-only marker. A breakthrough that has ever been confirmed cannot resurface
// as a breakthrough -- the user already accepted it; re-surfacing is patronizing.
function hasBeenConfirmed(id, db) {
  return !!findFirstEventForBreakthrough(id, 'breakthrough_confirmed', db);
}

// D-15 never-resurface marker. A breakthrough that has been filed as a decision is
// now a first-class decision (Canon Part 4 bridge via Phase 88 decision-log).
// Re-surfacing it as a breakthrough would conflate two different graph entities.
function hasBeenFiledAsDecision(id, db) {
  return !!findFirstEventForBreakthrough(id, 'breakthrough_filed_as_decision', db);
}

// D-13 first half. Returns true when EITHER (a) the breakthrough has never been
// dismissed (vacuously eligible) OR (b) the most-recent dismiss is older than 7 days.
function dismissalCooldownExpired(id, db) {
  const dismiss = findFirstEventForBreakthrough(id, 'breakthrough_dismissed', db);
  if (!dismiss) return true; // vacuously eligible re: cooldown
  const ts = (typeof dismiss.createdAt === 'number') ? dismiss.createdAt : 0;
  const ageMs = Date.now() - ts;
  return ageMs >= SEVEN_DAY_COOLDOWN_MS;
}

// D-13 second half. The scanner passes the CURRENT candidate's artifact_ids[] length
// via opts.current_artifact_count; this function compares it against the baseline
// stored in the breakthrough_dismissed event's properties.artifact_ids_at_dismiss[].
// Returns true IFF current > baseline. Returns false on missing baseline (defensive).
//
// Note: callers should normally use isEligibleForSurfacing (the composite gate). This
// helper is exported for granular telemetry + per-rule unit tests.
function newArtifactsAccumulated(id, db, opts) {
  const dismiss = findFirstEventForBreakthrough(id, 'breakthrough_dismissed', db);
  if (!dismiss) return false; // cannot measure delta without baseline
  const baselineIds = (dismiss.properties && Array.isArray(dismiss.properties.artifact_ids_at_dismiss))
    ? dismiss.properties.artifact_ids_at_dismiss : [];
  const baselineCount = baselineIds.length;
  const currentCount = (opts && Number.isInteger(opts.current_artifact_count))
    ? opts.current_artifact_count : 0;
  return currentCount > baselineCount;
}

// Composite resurfacing gate. Encodes D-13 BOTH-condition + D-14 + D-15.
//
// Priority order (highest precedence first):
//   1. D-14 confirmed once-only -> reason: 'confirmed_once_only'
//   2. D-15 filed-as-decision   -> reason: 'filed_as_decision_never_resurfaces'
//   3. D-13 first half (cooldown active) -> reason: 'dismiss_cooldown_active'
//   4. D-13 second half (no new artifacts) -> reason: 'dismiss_no_new_artifacts'
//   5. Eligible -> { eligible: true }
//
// The BOTH-condition rule for D-13 is structurally enforced by two SEPARATE checks
// joined with explicit AND semantics (priority 3 must clear before priority 4 is
// even checked). This prevents the OR drift that would land if a single helper
// merged the two conditions. User verbatim: "that's manipulation".
function isEligibleForSurfacing(id, db, opts) {
  // D-14 first (highest priority): confirmed once-only.
  if (hasBeenConfirmed(id, db)) {
    return { eligible: false, reason: 'confirmed_once_only' };
  }
  // D-15 next: filed-as-decision never resurfaces.
  if (hasBeenFiledAsDecision(id, db)) {
    return { eligible: false, reason: 'filed_as_decision_never_resurfaces' };
  }
  // D-13 first half: cooldown must have expired.
  if (!dismissalCooldownExpired(id, db)) {
    return { eligible: false, reason: 'dismiss_cooldown_active' };
  }
  // D-13 second half: IF the breakthrough was previously dismissed (i.e., a baseline
  // exists), new artifacts MUST have accumulated. The check is gated on existence of
  // the dismiss event -- a never-dismissed breakthrough skips the artifacts check
  // (it's vacuously eligible per priority 5).
  const dismiss = findFirstEventForBreakthrough(id, 'breakthrough_dismissed', db);
  if (dismiss) {
    const baselineCount = (dismiss.properties && Array.isArray(dismiss.properties.artifact_ids_at_dismiss))
      ? dismiss.properties.artifact_ids_at_dismiss.length : 0;
    const currentCount = (opts && Number.isInteger(opts.current_artifact_count))
      ? opts.current_artifact_count : 0;
    if (currentCount <= baselineCount) {
      return { eligible: false, reason: 'dismiss_no_new_artifacts' };
    }
  }
  return { eligible: true };
}

module.exports = {
  hasBeenConfirmed: hasBeenConfirmed,
  hasBeenFiledAsDecision: hasBeenFiledAsDecision,
  dismissalCooldownExpired: dismissalCooldownExpired,
  newArtifactsAccumulated: newArtifactsAccumulated,
  isEligibleForSurfacing: isEligibleForSurfacing,
  SEVEN_DAY_COOLDOWN_MS: SEVEN_DAY_COOLDOWN_MS,
};
