'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 159-01 Task 2 -- consumeF1Pick: the turn-N+1 dial-pick shared-core consumer.
 * ================================================================================
 * The producer half is wired (offer-closer.cjs::renderF1 persists
 * decision_trace.f1_closer_payload with verbs[] + a per-verb reachIds{} map;
 * scripts/intent-classifier.cjs:1890). NOTHING reads it back next turn, so no
 * f_selector_decision row is ever written from the dial in a real room. This
 * module is the missing read half: on a turn that follows a rendered F.1 dial
 * offer, it matches the navigator's pick to a verb deterministically, resolves
 * the two independent channels (outcome + reach_id), and delegates ALL
 * persistence to closeOffer over the caller-supplied roomState.db.
 *
 * HOW-2 (deterministic verb-match, NO fuzzy NLP): the AskUserQuestion answer is
 * a known enum from the rendered F.1 card. The capture adapter (per surface)
 * hands us {verb, outcome} (or a bare verb/keyword). We match the verb by
 * membership against payload.verbs; the outcome is the decision keyword
 * (accept/defer/reject/Free-Text).
 *
 * MEDIUM-2 (the load-bearing two-channel split -- EXPLICIT, never conflated):
 *   (a) OUTCOME CHANNEL: the decision keyword accept|defer|reject|Free-Text. This
 *       is what gets passed as closeOffer({pick:<outcome-keyword>}). We pass the
 *       OUTCOME keyword string, NEVER the matched verb. offer-closer.cjs
 *       ::_normalizePick falls through ANY non-keyword string to 'accept', so
 *       passing the verb as {pick} would silently coerce every reject to accept
 *       and break the whole phase.
 *   (b) REACH CHANNEL: the matched verb, used ONLY to look up
 *       payload.reachIds[verb] (forwarded as reach_id) and to populate
 *       offer.command. The frozen REACH_IDS enum-gate downstream
 *       (selector-decisions.cjs:224) keys the row when reach_id is a frozen
 *       member and drops it otherwise (DCW-08 never mis-keyed).
 *
 * Canon binding:
 *   Part 7: thin glue over the SHIPPED closeOffer (-> recordSelectorDecision /
 *           recordSelectorMiss). Net-new = the read+match+resolve, not a
 *           re-implemented recorder.
 *   Part 8: the consumer forwards ONLY {verb enum, outcome enum, reach_id enum}.
 *           The navigator's raw pick text rides the FIX-05 LOCAL sentence lane:
 *           payload.sentence is forwarded to closeOffer({sentence}) so it is
 *           classified to a scalar boolean + source enum at the write seam and
 *           NEVER stored in any row body or egressed.
 *   Part 9: this module NEVER opens room.db itself. The caller (the Wave-2
 *           turn-start wiring in intent-classifier) owns the handle via
 *           navigation.openRoomDbForCaller and passes a populated roomState.db
 *           in; closeOffer routes every write through the navigation chokepoint.
 *           No better-sqlite3 / node:sqlite require; no fs read of room data
 *           (DCW-06 source assertion in the suite).
 *
 * Framework: pure CJS, zero new dependencies (Phase 87 invariant). No em-dashes.
 * No emoji. No Brain call.
 *
 * License: BSL 1.1.
 */

const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');

// Lazy + tolerant require (mirrors the producer's best-effort idiom): a closer
// load failure degrades to a structured no-op rather than crashing the turn.
function _safeRequire(p) {
  try {
    return require(p);
  } catch (_e) {
    return null;
  }
}

// The four canonical dial outcomes. accept/defer/reject route to
// recordSelectorDecision via closeOffer; Free-Text routes to recordSelectorMiss.
const OUTCOMES = Object.freeze(['accept', 'defer', 'reject', 'Free-Text']);

// Normalize a raw outcome token to one of the four canonical outcomes, or null.
// Accepts the Free-Text escape under either casing form the rendered card uses.
function _normalizeOutcome(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  if (raw === 'Free-Text' || raw === 'free-text') return 'Free-Text';
  const lower = raw.toLowerCase();
  if (lower === 'accept' || lower === 'approve') return 'accept';
  if (lower === 'defer') return 'defer';
  if (lower === 'reject') return 'reject';
  return null;
}

// Resolve {verb, outcome} from the surface-supplied pick. The capture adapter
// hands us either {verb, outcome} (the CLI adapter shape, HOW-3) or a bare
// string (a verb OR an outcome keyword). Deterministic, no fuzzy NLP.
function _resolvePick(pick) {
  if (pick && typeof pick === 'object') {
    const verb = (typeof pick.verb === 'string' && pick.verb.length > 0) ? pick.verb : null;
    const outcome = _normalizeOutcome(pick.outcome);
    return { verb, outcome };
  }
  if (typeof pick === 'string' && pick.length > 0) {
    // A bare string: it is the Free-Text escape, an outcome keyword, or a verb.
    const outcome = _normalizeOutcome(pick);
    if (outcome === 'Free-Text') return { verb: 'Free-Text', outcome: 'Free-Text' };
    if (outcome) return { verb: null, outcome };
    return { verb: pick, outcome: null };
  }
  return { verb: null, outcome: null };
}

// ---------------------------------------------------------------------------
// consumeF1Pick({ priorPayload, pick, roomState })
//   -> { ok, recorded?, reason?, outcome?, reach_id? }
//
// priorPayload: the prior turn's decision_trace.f1_closer_payload
//               ({ verbs:[...], reachIds?:{verb:reach_id}, sentence? }).
// pick:         the surface-captured pick ({verb, outcome} or a bare string).
// roomState:    the caller-owned room state; roomState.db MUST be populated by
//               the caller (the consumer NEVER opens room.db; Part 9). An
//               optional roomState.offer carries the offer scaffold
//               (framework/confidence) the matched verb completes.
//
// Returns a structured no-op ({ok:false, reason}) on any cold / unmatched /
// malformed / absent-db turn, writing nothing and raising nothing (DCW-04).
// ---------------------------------------------------------------------------
function consumeF1Pick(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const priorPayload = (a.priorPayload && typeof a.priorPayload === 'object') ? a.priorPayload : null;
  const roomState = (a.roomState && typeof a.roomState === 'object') ? a.roomState : {};

  // Validate the prior payload: an object with a non-empty verbs array.
  if (!priorPayload || !Array.isArray(priorPayload.verbs) || priorPayload.verbs.length === 0) {
    return { ok: false, reason: 'no_prior_payload' };
  }

  // Resolve the two channels' raw inputs from the captured pick.
  const resolved = _resolvePick(a.pick);
  let verb = resolved.verb;
  let outcome = resolved.outcome;

  // Deterministic membership match (HOW-2): the matched verb MUST be present in
  // the rendered card's verbs array. An unmatched pick is a no-op (DCW-04).
  if (verb === null || priorPayload.verbs.indexOf(verb) === -1) {
    return { ok: false, reason: 'unmatched' };
  }

  // The Free-Text escape is always its own outcome regardless of the captured
  // outcome token (the escape verb routes to the miss path).
  const FREE_TEXT = 'Free-Text';
  if (verb === FREE_TEXT) {
    outcome = FREE_TEXT;
  }
  // A matched non-escape verb with no explicit outcome is treated as an accept
  // of the offered move (the user picked the offered command).
  if (outcome === null) {
    outcome = 'accept';
  }
  if (OUTCOMES.indexOf(outcome) === -1) {
    return { ok: false, reason: 'unmatched' };
  }

  // REACH CHANNEL (MEDIUM-2 b): the matched verb looks up its reach_id from the
  // payload's per-verb reachIds map. The escape never carries a reach_id.
  let reach_id = null;
  if (verb !== FREE_TEXT
      && priorPayload.reachIds
      && typeof priorPayload.reachIds === 'object'
      && typeof priorPayload.reachIds[verb] === 'string'
      && priorPayload.reachIds[verb].length > 0) {
    reach_id = priorPayload.reachIds[verb];
  }

  // Lazy-require the closer; a load failure degrades to a no-op (DCW-04).
  const closer = _safeRequire(path.join(REPO, 'lib', 'workflow', 'offer-closer.cjs'));
  if (!closer || typeof closer.closeOffer !== 'function') {
    return { ok: false, reason: 'closer_unavailable' };
  }

  // Build the offer object closeOffer expects from the matched verb (REACH
  // CHANNEL: offer.command IS the matched verb). Any framework/confidence
  // scaffold the caller carried on roomState.offer is merged so the decision
  // edge target (framework:<...>) resolves; the matched verb always wins as the
  // command.
  const scaffold = (roomState.offer && typeof roomState.offer === 'object') ? roomState.offer : {};
  const offer = {
    command: verb,
    framework: (typeof scaffold.framework === 'string' && scaffold.framework.length > 0)
      ? scaffold.framework : undefined,
    confidence: (typeof scaffold.confidence === 'number') ? scaffold.confidence : undefined,
    reason: (typeof scaffold.reason === 'string' && scaffold.reason.length > 0)
      ? scaffold.reason : undefined,
  };

  // Build the closeOffer args. MEDIUM-2 (a): {pick} is the OUTCOME keyword, NEVER
  // the matched verb. The reach_id is forwarded on the REACH channel.
  const closeArgs = {
    pick: outcome,
    offer: offer,
    roomState: roomState,
  };
  if (reach_id) {
    closeArgs.reach_id = reach_id;
  }
  // HOW-5 (FIX-05 LOCAL lane): forward the prior payload's sentence (the
  // navigator's conversation seed) so closeOffer classifies it to a scalar at the
  // write seam and never stores it (Part 8). Forwarded only when present.
  if (typeof priorPayload.sentence === 'string' && priorPayload.sentence.length > 0) {
    closeArgs.sentence = priorPayload.sentence;
  }
  // For the Free-Text escape, closeOffer routes to recordSelectorMiss; carry the
  // sentence as the LOCAL user_intent when present (it stays in room.db only).
  if (outcome === FREE_TEXT
      && typeof priorPayload.sentence === 'string' && priorPayload.sentence.length > 0) {
    closeArgs.user_intent = priorPayload.sentence;
  }

  let r;
  try {
    r = closer.closeOffer(closeArgs);
  } catch (_e) {
    return { ok: false, reason: 'closer_threw' };
  }

  if (!r || r.ok !== true) {
    // Surface the downstream reason verbatim (e.g. invalid_db) as a no-op.
    return { ok: false, reason: (r && r.reason) ? r.reason : 'close_failed' };
  }

  const out = { ok: true, recorded: true, outcome: outcome };
  if (reach_id) out.reach_id = reach_id;
  return out;
}

module.exports = {
  consumeF1Pick: consumeF1Pick,
  OUTCOMES: OUTCOMES,
};
