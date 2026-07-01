'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 188-07 -- captureCliOrderedGate: the CLI F.9 ordered-capture adapter (SFS-04).
 * ================================================================================
 * The Tri-Polar split (DCW-07, inherited from f8-action-capture-cli.cjs): the
 * ordered consumer (lib/workflow/f9-ordered-consumer.cjs) is the SHARED CORE; each
 * surface supplies a thin capture adapter that turns the surface's turn input into
 * the ordered per-item picks the consumer accepts. F.8 captures an UNORDERED set;
 * F.9 captures an ORDERED array -- POSITION IS PRESERVED (array order IS meaning),
 * each element carrying { item_id, outcome }.
 *
 * This is the CLI adapter. The F.9 answer carries `orderedOutcomes[]` -- one
 * per-item ordered decision, in the SAME order as the rendered cascade questions.
 * captureCliOrderedGate:
 *   - walks the answer IN ORDER, zipping each element to the matching question's
 *     item_id from priorPayload.questions (position-matched, NOT fuzzy NLP);
 *   - folds each ordered token onto the reused OUTCOMES enum via the same alias the
 *     renderer uses (APPROVE->accept, REJECT->reject, DEFER->defer) so no parallel
 *     enum is minted; the consumer keys on the canonical ordered token;
 *   - carries any raw navigator text on the optional per-element `sentence` LOCAL
 *     lane ONLY (Part 8) -- never a pick value, an edge body, or a Brain packet;
 *   - carries the per-element `reason` for a REJECT (rejection is data, Decision 13).
 *
 * An unknown / unmatched ordered token degrades to { item_id, outcome: null } so the
 * ordered consumer no-ops that item deterministically (never a false decision).
 *
 * Framework: pure CJS, zero new dependencies (Phase 87 invariant). No em-dashes.
 * No emoji. No Brain call.
 *
 * License: BSL 1.1.
 */

// The closed ordered-outcome vocabulary (canon literal tokens). Mirrored locally
// to keep the adapter decoupled from the consumer (no require cycle).
const ORDERED_OUTCOMES = ['APPROVE', 'REJECT', 'DEFER'];

// The reused four-outcome enum (accept==APPROVE). Mirrored locally; the consumer is
// the gate of record. This is the SAME enum the F.8 machinery reuses.
const OUTCOMES = ['accept', 'defer', 'reject', 'Free-Text'];

// Normalize any ordered-token spelling onto the canonical closed set. Accepts the
// literal APPROVE/REJECT/DEFER and the reused-enum spellings (accept/approve, etc).
function _normalizeOrdered(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const lower = raw.toLowerCase();
  if (lower === 'approve' || lower === 'accept') return 'APPROVE';
  if (lower === 'reject') return 'REJECT';
  if (lower === 'defer') return 'DEFER';
  return null;
}

// Resolve one orderedOutcomes[] element into { outcome, text, reason }. The element
// is either a bare token string OR an object { outcome|token, text?, reason? }.
function _resolveElement(el) {
  if (typeof el === 'string') {
    return { outcome: _normalizeOrdered(el), text: null, reason: null };
  }
  if (el && typeof el === 'object') {
    const token = (typeof el.outcome === 'string' && el.outcome.length > 0)
      ? el.outcome
      : ((typeof el.token === 'string' && el.token.length > 0) ? el.token : null);
    const text = (typeof el.text === 'string' && el.text.length > 0) ? el.text : null;
    const reason = (typeof el.reason === 'string' && el.reason.length > 0) ? el.reason : null;
    return { outcome: _normalizeOrdered(token), text: text, reason: reason };
  }
  return { outcome: null, text: null, reason: null };
}

// The item_id for the question at POSITION i (order IS meaning). Falls back to a
// synthetic id when the prior payload did not carry an explicit item_id.
function _itemIdAt(questions, i) {
  if (Array.isArray(questions) && questions[i] && typeof questions[i] === 'object') {
    const q = questions[i];
    if (typeof q.item_id === 'string' && q.item_id.length > 0) return q.item_id;
    if (typeof q.id === 'string' && q.id.length > 0) return q.id;
  }
  return 'item:' + String(i);
}

// ---------------------------------------------------------------------------
// captureCliOrderedGate(answer, priorPayload)
//   -> [ { item_id, outcome, reason?, sentence? }, ... ]  (POSITION PRESERVED)
//
// answer: the F.9 answer { orderedOutcomes: [ <token> | { outcome, text?, reason? } ] }.
// priorPayload: the prior turn's F.9 render contract ({ questions:[{item_id,...}] }).
//
// Returns an ARRAY of ordered picks in the SAME order as the answer, each keyed to
// its position's item_id, outcome the canonical ordered token (or null when
// unmatched so the consumer no-ops it). Raw text rides the optional per-element
// `sentence` LOCAL lane; a REJECT reason rides `reason`. A non-array answer -> [].
// ---------------------------------------------------------------------------
function captureCliOrderedGate(answer, priorPayload) {
  const a = (answer && typeof answer === 'object') ? answer : {};
  const payload = (priorPayload && typeof priorPayload === 'object') ? priorPayload : {};
  const questions = Array.isArray(payload.questions) ? payload.questions : [];
  const ordered = Array.isArray(a.orderedOutcomes) ? a.orderedOutcomes : [];

  const picks = [];
  for (let i = 0; i < ordered.length; i++) {
    const resolved = _resolveElement(ordered[i]);
    const pick = {
      item_id: _itemIdAt(questions, i),
      outcome: resolved.outcome,
    };
    // Rejection is data (Decision 13): the REJECT reason survives as a per-element
    // field the consumer records as a graph node.
    if (resolved.outcome === 'REJECT' && resolved.reason) {
      pick.reason = resolved.reason;
    }
    // The raw navigator text rides the LOCAL lane ONLY (Part 8). Never a pick value,
    // never an edge body, never a Brain packet.
    if (resolved.text) {
      pick.sentence = resolved.text;
    }
    picks.push(pick);
  }
  return picks;
}

// The Desktop/Cowork capture-adapter seam contract (DCW-07). Desktop/Cowork LIVE
// ordered capture is OUT of this phase; this constant names the signature + expected
// POSITION-PRESERVED array those adapters implement.
const CAPTURE_ADAPTER_CONTRACT = Object.freeze({
  signature: 'captureSurfaceOrderedGate(surfaceAnswer, priorPayload) -> [ { item_id, outcome, reason?, sentence? }, ... ]',
  returns: '[ { item_id: <from priorPayload.questions[i]>, outcome: APPROVE|REJECT|DEFER|null, reason?: <REJECT reason>, sentence?: <raw navigator text, LOCAL lane only> }, ... ]  POSITION PRESERVED',
  surfaces: Object.freeze(['cli (live, this module)', 'desktop (seam only, deferred)', 'cowork (seam only, deferred)']),
  part8_note: 'The raw navigator text rides ONLY the optional per-element sentence (LOCAL lane). It is NEVER a pick value, an edge body, or a Brain packet.',
  consumer: 'lib/workflow/f9-ordered-consumer.cjs::consumeF9Ordered({ items, roomState })',
});

module.exports = {
  captureCliOrderedGate: captureCliOrderedGate,
  CAPTURE_ADAPTER_CONTRACT: CAPTURE_ADAPTER_CONTRACT,
  ORDERED_OUTCOMES: ORDERED_OUTCOMES.slice(),
  OUTCOMES: OUTCOMES.slice(),
};
