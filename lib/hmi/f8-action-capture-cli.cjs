'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 188-06 -- captureCliActionSet: the CLI F.8 array-capture adapter (SFS-02).
 * ================================================================================
 * The Tri-Polar split (DCW-07, inherited from f1-pick-capture-cli.cjs): the fan-out
 * consumer (lib/workflow/f8-fanout-consumer.cjs) is the SHARED CORE; each surface
 * supplies a thin capture adapter that turns the surface's turn input into the
 * {verb, outcome} picks the consumer accepts. F.1 captures ONE pick; F.8 captures
 * an ARRAY -- the navigator toggled a SET on and confirmed ONCE.
 *
 * This is the CLI adapter. The AskUserQuestion F.8 answer carries
 * `selectedOptions[]` (the CONFIRMED toggle set; a pre-checked-but-unconfirmed
 * toggle is NOT a selection until confirm). captureCliActionSet:
 *   - maps EACH selected option to its matching verb in priorPayload.verbs
 *     DETERMINISTICALLY (reuse _matchVerb membership match, NOT fuzzy NLP);
 *   - reuses the OUTCOMES enum + _normalizeOutcome (NO parallel enum); a bare
 *     toggle defaults to `accept` (toggling an action ON = accept it), while a
 *     per-element outcome (accept/defer/reject/Free-Text) is honored so the
 *     two-channel split (outcome keyword vs reach verb) survives per element;
 *   - carries the raw navigator text on the optional `sentence` LOCAL lane per
 *     element ONLY (Part 8) -- never a pick value, an edge body, or a Brain packet.
 *
 * An unknown / unmatched option degrades to { verb: null, outcome } so the
 * fan-out consumer no-ops that item deterministically (never a false match).
 *
 * Framework: pure CJS, zero new dependencies (Phase 87 invariant). No em-dashes.
 * No emoji. No Brain call.
 *
 * License: BSL 1.1.
 */

const FREE_TEXT = 'Free-Text';

// The four canonical dial outcomes. Mirrored locally to keep the adapter decoupled
// from the consumer (no require cycle); the consumer is the gate of record. This is
// the SAME enum f1-pick-capture-cli.cjs reuses -- NOT a parallel one.
const OUTCOMES = ['accept', 'defer', 'reject', 'Free-Text'];

function _normalizeOutcome(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  if (raw === 'Free-Text' || raw === 'free-text') return 'Free-Text';
  const lower = raw.toLowerCase();
  if (lower === 'accept' || lower === 'approve') return 'accept';
  if (lower === 'defer') return 'defer';
  if (lower === 'reject') return 'reject';
  return null;
}

// Deterministic option -> verb match against the rendered card's verbs. The CLI
// AskUserQuestion answer is a known enum (the toggle label IS a verb in
// priorPayload.verbs), so this is a membership match, NOT fuzzy NLP.
function _matchVerb(selectedOption, verbs) {
  if (typeof selectedOption !== 'string' || selectedOption.length === 0) return null;
  if (!Array.isArray(verbs)) return null;
  return verbs.indexOf(selectedOption) !== -1 ? selectedOption : null;
}

// Resolve a single selectedOptions[] element into { label, outcome, text }. The
// element is either a bare label string (a toggled-on action, default accept) or
// an object { label|selectedOption, outcome?, text? } carrying a per-element
// outcome + optional raw navigator text.
function _resolveElement(el) {
  if (typeof el === 'string') {
    return { label: el, outcome: null, text: null };
  }
  if (el && typeof el === 'object') {
    const label = (typeof el.label === 'string' && el.label.length > 0)
      ? el.label
      : ((typeof el.selectedOption === 'string' && el.selectedOption.length > 0) ? el.selectedOption : null);
    const outcome = _normalizeOutcome(el.outcome);
    const text = (typeof el.text === 'string' && el.text.length > 0) ? el.text : null;
    return { label: label, outcome: outcome, text: text };
  }
  return { label: null, outcome: null, text: null };
}

// ---------------------------------------------------------------------------
// captureCliActionSet(answer, priorPayload) -> [ { verb, outcome, sentence? }, ... ]
//
// answer: the AskUserQuestion F.8 answer
//         { selectedOptions: [ <verb label> | { label, outcome?, text? } ] }.
// priorPayload: the prior turn's F.8 closer payload ({ verbs:[...], ... }).
//
// Returns an ARRAY of picks, one per CONFIRMED toggle, each { verb, outcome }
// where verb is the matched enum from the rendered card (or null when unmatched,
// so the consumer no-ops that item) and outcome is the per-element decision
// keyword (default accept). The raw text rides the optional `sentence` LOCAL lane
// per element ONLY. A non-array / empty answer yields [].
// ---------------------------------------------------------------------------
function captureCliActionSet(answer, priorPayload) {
  const a = (answer && typeof answer === 'object') ? answer : {};
  const payload = (priorPayload && typeof priorPayload === 'object') ? priorPayload : {};
  const verbs = Array.isArray(payload.verbs) ? payload.verbs : [];
  const selected = Array.isArray(a.selectedOptions) ? a.selectedOptions : [];

  const picks = [];
  for (const el of selected) {
    const resolved = _resolveElement(el);
    const matched = _matchVerb(resolved.label, verbs);

    // Per-element outcome. The Free-Text escape is always its own outcome; a bare
    // confirmed toggle with no explicit outcome is an accept (toggled ON = accept).
    let outcome = resolved.outcome;
    if (matched === FREE_TEXT) {
      outcome = FREE_TEXT;
    } else if (outcome === null) {
      outcome = 'accept';
    }
    if (outcome !== null && OUTCOMES.indexOf(outcome) === -1) {
      outcome = null;
    }

    const pick = { verb: matched, outcome: outcome };
    // The raw navigator text rides the LOCAL lane ONLY (Part 8). Never a pick
    // value, never an edge body, never a Brain packet.
    if (resolved.text) {
      pick.sentence = resolved.text;
    }
    picks.push(pick);
  }
  return picks;
}

// The Desktop/Cowork capture-adapter seam contract (DCW-07). Desktop/Cowork LIVE
// conversational multi-select capture is OUT of this phase; this constant names the
// signature + expected ARRAY shape those adapters implement so a later seam doc can
// reference it. A surface adapter MUST return the same [{verb, outcome}, sentence?]
// array captureCliActionSet returns, with verb a deterministic enum from the
// rendered card and any raw navigator text confined to the LOCAL sentence lane.
const CAPTURE_ADAPTER_CONTRACT = Object.freeze({
  signature: 'captureSurfaceActionSet(surfaceAnswer, priorPayload) -> [ { verb, outcome }, sentence? ]',
  returns: '[ { verb: <enum from priorPayload.verbs | null>, outcome: accept|defer|reject|Free-Text|null, sentence?: <raw navigator text, LOCAL lane only> }, ... ]',
  surfaces: Object.freeze(['cli (live, this module)', 'desktop (seam only, deferred)', 'cowork (seam only, deferred)']),
  part8_note: 'The raw navigator text rides ONLY the optional per-element sentence (LOCAL lane). It is NEVER a pick value, an edge body, or a Brain packet. The consumer forwards it to closeOffer({sentence}) where it is classified to a scalar at the write seam and never stored.',
  consumer: 'lib/workflow/f8-fanout-consumer.cjs::consumeF8Fanout({ priorPayload, picks, roomState })',
});

module.exports = {
  captureCliActionSet: captureCliActionSet,
  CAPTURE_ADAPTER_CONTRACT: CAPTURE_ADAPTER_CONTRACT,
  OUTCOMES: OUTCOMES.slice(),
  FREE_TEXT: FREE_TEXT,
};
