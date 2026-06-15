'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 159-01 Task 3 -- captureCliPick: the CLI F.1 pick-capture adapter (HOW-3).
 * ================================================================================
 * The Tri-Polar split (DCW-07): the consumer (lib/workflow/f1-pick-consumer.cjs)
 * is the SHARED CORE; each surface supplies a thin capture adapter that turns the
 * surface's turn input into the {pick} shape consumeF1Pick accepts. This is the
 * CLI adapter: it maps an AskUserQuestion Shape F.1 answer into {pick, sentence?}.
 * Desktop/Cowork adapters are documented seam contracts only (live capture
 * deferred); CAPTURE_ADAPTER_CONTRACT names the signature they implement.
 *
 * On CLI the F.1 dial renders via the AskUserQuestion trailer (shape-f1-renderer
 * exposes contract.verbs -- the option labels). The navigator's pick arrives as
 * the next user turn's selected option + chosen outcome. captureCliPick:
 *   - maps the selected option to the matching verb in priorPayload.verbs
 *     DETERMINISTICALLY (HOW-2: the answer is a known enum from the rendered card,
 *     NOT free prose); returns {pick:{verb, outcome}}.
 *   - carries the raw answer text ONLY as the optional `sentence` field, destined
 *     for the FIX-05 LOCAL lane (HOW-5 / Part 8): consumeF1Pick forwards it to
 *     closeOffer({sentence}) where it is classified to a scalar at the write seam
 *     and NEVER stored in a row body. The raw text is NEVER returned as a pick
 *     value, NEVER an edge body, NEVER a Brain packet.
 *
 * Canon binding:
 *   Part 7: the adapter is thin glue; it does NO persistence (it produces the
 *           {pick} the shared-core consumer routes).
 *   Part 8: the navigator's pick text rides the sentence (LOCAL lane) only; the
 *           pick verb/outcome are deterministic enums. The Part 8 SECRETREASON159
 *           tripwire in the suite proves a seeded marker never lands in a row.
 *
 * Framework: pure CJS, zero new dependencies (Phase 87 invariant). No em-dashes.
 * No emoji. No Brain call.
 *
 * License: BSL 1.1.
 */

// The Free-Text escape (mirrors offer-closer FREE_TEXT). The escape routes to the
// miss path and never carries a reach_id.
const FREE_TEXT = 'Free-Text';

// The four canonical dial outcomes. Mirrored locally to keep the adapter
// decoupled from the consumer (no require cycle); the consumer is the gate of
// record.
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
// AskUserQuestion answer is a known enum (the option label IS a verb in
// priorPayload.verbs), so this is a membership match, NOT fuzzy NLP.
function _matchVerb(selectedOption, verbs) {
  if (typeof selectedOption !== 'string' || selectedOption.length === 0) return null;
  if (!Array.isArray(verbs)) return null;
  return verbs.indexOf(selectedOption) !== -1 ? selectedOption : null;
}

// ---------------------------------------------------------------------------
// captureCliPick(answer, priorPayload) -> { pick: { verb, outcome }, sentence? }
//
// answer: the AskUserQuestion F.1 answer
//         { selectedOption: <verb label>, outcome?: <decision keyword>,
//           text?: <raw navigator text> }.
// priorPayload: the prior turn's f1_closer_payload ({ verbs:[...], ... }).
//
// Returns { pick: { verb, outcome } } where verb is the matched enum from the
// rendered card and outcome is the chosen decision keyword. The raw answer text
// rides the optional `sentence` (the FIX-05 LOCAL lane) ONLY. When the answer
// does not match a rendered verb, returns { pick: { verb: null, outcome } } so
// the shared-core consumer no-ops deterministically (DCW-04).
// ---------------------------------------------------------------------------
function captureCliPick(answer, priorPayload) {
  const a = (answer && typeof answer === 'object') ? answer : {};
  const payload = (priorPayload && typeof priorPayload === 'object') ? priorPayload : {};
  const verbs = Array.isArray(payload.verbs) ? payload.verbs : [];

  // The selected option label is the verb (or the Free-Text escape).
  const matched = _matchVerb(a.selectedOption, verbs);

  // The outcome is the navigator's chosen decision keyword. When the answer
  // carries no explicit outcome and the matched verb is the escape, the outcome
  // is Free-Text; otherwise it defers to the consumer's accept default.
  let outcome = _normalizeOutcome(a.outcome);
  if (matched === FREE_TEXT) {
    outcome = FREE_TEXT;
  }
  if (outcome !== null && OUTCOMES.indexOf(outcome) === -1) {
    outcome = null;
  }

  const pick = { verb: matched, outcome: outcome };

  const out = { pick: pick };
  // The raw answer text rides the LOCAL lane ONLY (FIX-05 / Part 8). Never a pick
  // value, never an edge body. Carried as the optional sentence for the consumer
  // to forward to closeOffer({sentence}).
  if (typeof a.text === 'string' && a.text.length > 0) {
    out.sentence = a.text;
  }
  return out;
}

// The Desktop/Cowork capture-adapter seam contract (DCW-07). Desktop/Cowork
// LIVE conversational capture is OUT of this phase; this constant names the
// signature + expected shape those adapters implement so the Wave-3 seam doc can
// reference it. A surface adapter MUST return the same {pick:{verb, outcome},
// sentence?} shape captureCliPick returns, with verb a deterministic enum from
// the rendered card and the raw navigator text confined to the LOCAL sentence
// lane (Part 8).
const CAPTURE_ADAPTER_CONTRACT = Object.freeze({
  signature: 'captureSurfacePick(surfaceAnswer, priorPayload) -> { pick: { verb, outcome }, sentence? }',
  returns: '{ pick: { verb: <enum from priorPayload.verbs | null>, outcome: accept|defer|reject|Free-Text|null }, sentence?: <raw navigator text, LOCAL lane only> }',
  surfaces: Object.freeze(['cli (live, this module)', 'desktop (seam only, deferred)', 'cowork (seam only, deferred)']),
  part8_note: 'The raw navigator text rides ONLY the optional sentence (FIX-05 LOCAL lane). It is NEVER a pick value, an edge body, or a Brain packet. consumeF1Pick forwards it to closeOffer({sentence}) where it is classified to a scalar at the write seam and never stored.',
  consumer: 'lib/workflow/f1-pick-consumer.cjs::consumeF1Pick({ priorPayload, pick, roomState })',
});

module.exports = {
  captureCliPick: captureCliPick,
  CAPTURE_ADAPTER_CONTRACT: CAPTURE_ADAPTER_CONTRACT,
  FREE_TEXT: FREE_TEXT,
};
