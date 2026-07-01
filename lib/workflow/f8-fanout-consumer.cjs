'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 188-06 -- consumeF8Fanout: the F.8 multi-select FAN-OUT consumer (SFS-03).
 * ================================================================================
 * F.1 resolves ONE pick to ONE closeOffer call (lib/workflow/f1-pick-consumer.cjs).
 * F.8 loops the captured ARRAY and calls the closer PER ITEM on ONE confirm:
 * 1 confirm -> N typed edges. The per-item body clones consumeF1Pick's two-channel
 * resolve; the outer loop is the only net-new structure.
 *
 * Part 9 chokepoint invariant (the load-bearing rule, f1-pick-consumer.cjs:44-49):
 * this consumer NEVER opens room.db. The caller owns the handle and passes a
 * populated roomState.db; every write routes through closeOffer -> navigation.cjs.
 * No native / node sqlite require; no room-db open of its own (the source-grep in
 * the suite proves the forbidden requires are absent). A test seam lets the caller
 * inject roomState.closer (a spy) so a fan-out can be counted WITHOUT a live room.db.
 *
 * The two-channel split (MEDIUM-2), preserved PER ITEM:
 *   (a) OUTCOME CHANNEL: the decision keyword accept|defer|reject|Free-Text is what
 *       gets passed as closeOffer({pick:<outcome-keyword>}). We pass the OUTCOME
 *       keyword, NEVER the matched verb -- passing the verb as {pick} would silently
 *       coerce every reject to accept downstream.
 *   (b) REACH CHANNEL: the matched verb looks up reach_id from priorPayload.reachIds
 *       and populates offer.command. Kept EXPLICIT, never conflated.
 *
 * Degrade-never-block PER ITEM: a cold / unmatched / malformed / closer-failed item
 * returns a structured no-op and does NOT abort the rest of the confirmed set. The
 * fan-out returns an appliedCount (D-09 what's-next re-entry is a downstream family
 * consumer's job -- NOT wired here; this module ships the fan-out + appliedCount).
 *
 * Framework: pure CJS, zero new dependencies (Phase 87 invariant). No em-dashes.
 * No emoji. No Brain call.
 *
 * License: BSL 1.1.
 */

const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');

// Lazy + tolerant require (mirrors f1-pick-consumer): a closer load failure degrades
// to a structured no-op rather than crashing the turn.
function _safeRequire(p) {
  try {
    return require(p);
  } catch (_e) {
    return null;
  }
}

// The four canonical dial outcomes. Reused, NOT a parallel enum.
const OUTCOMES = Object.freeze(['accept', 'defer', 'reject', 'Free-Text']);
const FREE_TEXT = 'Free-Text';

function _normalizeOutcome(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  if (raw === 'Free-Text' || raw === 'free-text') return 'Free-Text';
  const lower = raw.toLowerCase();
  if (lower === 'accept' || lower === 'approve') return 'accept';
  if (lower === 'defer') return 'defer';
  if (lower === 'reject') return 'reject';
  return null;
}

// Resolve {verb, outcome} from one captured array element. Deterministic; the
// capture adapter hands us {verb, outcome} (the array shape) or a bare string.
function _resolvePick(pick) {
  if (pick && typeof pick === 'object') {
    const verb = (typeof pick.verb === 'string' && pick.verb.length > 0) ? pick.verb : null;
    const outcome = _normalizeOutcome(pick.outcome);
    return { verb, outcome, sentence: (typeof pick.sentence === 'string' && pick.sentence.length > 0) ? pick.sentence : null };
  }
  if (typeof pick === 'string' && pick.length > 0) {
    const outcome = _normalizeOutcome(pick);
    if (outcome === FREE_TEXT) return { verb: FREE_TEXT, outcome: FREE_TEXT, sentence: null };
    if (outcome) return { verb: null, outcome, sentence: null };
    return { verb: pick, outcome: null, sentence: null };
  }
  return { verb: null, outcome: null, sentence: null };
}

// Resolve the closer. The caller MAY inject roomState.closer (a spy or a surface
// closer) so the fan-out is testable WITHOUT a live room.db (Part 9). Otherwise
// lazy-require the shipped offer-closer; a load failure degrades to null.
function _resolveCloser(roomState) {
  if (roomState && typeof roomState === 'object'
      && roomState.closer && typeof roomState.closer.closeOffer === 'function') {
    return roomState.closer;
  }
  return _safeRequire(path.join(REPO, 'lib', 'workflow', 'offer-closer.cjs'));
}

// consumeOne(pick, priorPayload, roomState, closer) -> { ok, reason?, outcome?, reach_id? }
// Clones the consumeF1Pick per-item body: two-channel resolve + one closeOffer.
// A no-op returns { ok:false, reason } and writes nothing (degrade-never-block).
function _consumeOne(pick, priorPayload, roomState, closer) {
  const resolved = _resolvePick(pick);
  let verb = resolved.verb;
  let outcome = resolved.outcome;

  // Deterministic membership match (HOW-2): the matched verb MUST be present in the
  // rendered card's verbs array. An unmatched pick is a no-op (never a false match).
  if (verb === null || priorPayload.verbs.indexOf(verb) === -1) {
    return { ok: false, reason: 'unmatched' };
  }

  if (verb === FREE_TEXT) {
    outcome = FREE_TEXT;
  }
  if (outcome === null) {
    outcome = 'accept';
  }
  if (OUTCOMES.indexOf(outcome) === -1) {
    return { ok: false, reason: 'unmatched' };
  }

  // REACH CHANNEL: the matched verb looks up its reach_id. The escape carries none.
  let reach_id = null;
  if (verb !== FREE_TEXT
      && priorPayload.reachIds
      && typeof priorPayload.reachIds === 'object'
      && typeof priorPayload.reachIds[verb] === 'string'
      && priorPayload.reachIds[verb].length > 0) {
    reach_id = priorPayload.reachIds[verb];
  }

  const scaffold = (roomState.offer && typeof roomState.offer === 'object') ? roomState.offer : {};
  const offer = {
    command: verb,
    framework: (typeof scaffold.framework === 'string' && scaffold.framework.length > 0)
      ? scaffold.framework : undefined,
    confidence: (typeof scaffold.confidence === 'number') ? scaffold.confidence : undefined,
    reason: (typeof scaffold.reason === 'string' && scaffold.reason.length > 0)
      ? scaffold.reason : undefined,
  };

  // OUTCOME CHANNEL: {pick} is the OUTCOME keyword, NEVER the matched verb.
  const closeArgs = { pick: outcome, offer: offer, roomState: roomState };
  if (reach_id) closeArgs.reach_id = reach_id;
  // Part 8 LOCAL lane: forward the per-element sentence when present.
  if (resolved.sentence) closeArgs.sentence = resolved.sentence;
  if (outcome === FREE_TEXT && resolved.sentence) closeArgs.user_intent = resolved.sentence;

  let r;
  try {
    r = closer.closeOffer(closeArgs);
  } catch (_e) {
    return { ok: false, reason: 'closer_threw' };
  }
  if (!r || r.ok !== true) {
    return { ok: false, reason: (r && r.reason) ? r.reason : 'close_failed' };
  }
  const out = { ok: true, recorded: true, outcome: outcome };
  if (reach_id) out.reach_id = reach_id;
  return out;
}

// ---------------------------------------------------------------------------
// consumeF8Fanout({ priorPayload, picks, roomState })
//   -> { ok, recorded, appliedCount, items }
//
// priorPayload: the prior turn's F.8 closer payload ({ verbs:[...], reachIds?:{} }).
// picks:        the captured ARRAY ([{verb, outcome, sentence?}, ...]) from the
//               F.8 array-capture adapter.
// roomState:    the caller-owned room state; roomState.db MUST be populated by the
//               caller (this consumer NEVER opens room.db; Part 9). roomState.closer
//               MAY be injected for testing.
//
// Fans out ONE closeOffer PER CONFIRMED item on ONE confirm (N typed edges). One
// bad item does NOT abort the set (degrade-never-block); appliedCount counts the
// items that wrote. A cold / empty / closer-absent turn returns a structured no-op.
// ---------------------------------------------------------------------------
function consumeF8Fanout(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const priorPayload = (a.priorPayload && typeof a.priorPayload === 'object') ? a.priorPayload : null;
  const roomState = (a.roomState && typeof a.roomState === 'object') ? a.roomState : {};
  const picks = Array.isArray(a.picks) ? a.picks : null;

  if (!priorPayload || !Array.isArray(priorPayload.verbs) || priorPayload.verbs.length === 0) {
    return { ok: false, reason: 'no_prior_payload', appliedCount: 0, recorded: 0, items: [] };
  }
  if (!picks || picks.length === 0) {
    return { ok: false, reason: 'no_picks', appliedCount: 0, recorded: 0, items: [] };
  }

  const closer = _resolveCloser(roomState);
  if (!closer || typeof closer.closeOffer !== 'function') {
    return { ok: false, reason: 'closer_unavailable', appliedCount: 0, recorded: 0, items: [] };
  }

  let appliedCount = 0;
  const items = [];
  for (const pick of picks) {
    const res = _consumeOne(pick, priorPayload, roomState, closer);
    items.push(res);
    if (res.ok === true) appliedCount++;
  }

  // The confirm itself succeeded (the fan-out ran); per-item failures degrade but
  // never fail the set. ok:true so a downstream re-entry can act on appliedCount.
  return { ok: true, recorded: appliedCount, appliedCount: appliedCount, items: items };
}

module.exports = {
  consumeF8Fanout: consumeF8Fanout,
  OUTCOMES: OUTCOMES,
};
