'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 188-04 (SFS-09) -- captureCliScopePick: the CLI F.4 scope-pick capture
 * adapter. Clones the F.3 depth adapter (a thin surface adapter mapping a
 * rendered-card answer into the {pick} shape the consumer accepts). F.4 is a
 * progressive scope LADDER, not a single scalar: each rung ADDS to the prior
 * accumulated scope (the consumer + state module own the accumulation; this
 * adapter only maps one pick).
 *
 * Closed-vocab carve-out (research pitfall #4): F.4 has NO recommended marker and
 * NO Free-Text. The adapter maps the selected option to a closed ladder rung by
 * DETERMINISTIC MEMBERSHIP, NOT fuzzy NLP. An unknown answer yields
 * { scope: null } so the consumer no-ops (T-188-04-01).
 *
 * Part 8: the navigator's raw answer text rides the optional `sentence` LOCAL
 * lane ONLY. It is NEVER the pick value, an edge body, or a Brain packet.
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant). No em-dashes.
 *
 * API: captureCliScopePick(answer) -> { scope, sentence?, terminal?, back? }
 */

// The closed F.4 progressive ladder rungs (accumulating).
const SCOPE_RUNGS = ['Key insights', '+contradictions', '+actions'];
// The terminal option: hand the accumulated scope to synthesis (not a rung).
const CREATE_DRAFT = 'Create artifact draft';
const BACK = 'Back';

// Deterministic membership match against the closed ladder (clone of the F.3
// adapter's _matchDepth). The answer is a known enum from the rendered F.4 card.
function _matchRung(selected) {
  if (typeof selected !== 'string' || selected.length === 0) return null;
  return SCOPE_RUNGS.indexOf(selected) !== -1 ? selected : null;
}

// ---------------------------------------------------------------------------
// captureCliScopePick(answer) -> { scope, sentence?, terminal?, back? }
//
// answer: the AskUserQuestion F.4 answer. Either a bare option label string
//         ('Key insights') or an object
//         { answer|selectedOption: <label>, text?: <raw> }.
//
// Returns { scope } where scope is the matched closed rung, or { scope: null }
// on an unknown pick (deterministic no-op downstream). 'Create artifact draft'
// returns { scope: null, terminal: true } (hand the accumulated scope to
// synthesis). 'Back' returns { scope: null, back: true } (no state write). The
// raw answer text rides the optional `sentence` LOCAL lane ONLY (Part 8).
// ---------------------------------------------------------------------------
function captureCliScopePick(answer) {
  let selected = null;
  let rawText = null;
  if (typeof answer === 'string') {
    selected = answer;
  } else if (answer && typeof answer === 'object') {
    selected = (typeof answer.answer === 'string' && answer.answer.length > 0)
      ? answer.answer
      : (typeof answer.selectedOption === 'string' ? answer.selectedOption : null);
    if (typeof answer.text === 'string' && answer.text.length > 0) rawText = answer.text;
  }

  if (selected === BACK) {
    const backOut = { scope: null, back: true };
    if (rawText) backOut.sentence = rawText;
    return backOut;
  }
  if (selected === CREATE_DRAFT) {
    const draftOut = { scope: null, terminal: true };
    if (rawText) draftOut.sentence = rawText;
    return draftOut;
  }

  const rung = _matchRung(selected);
  const out = { scope: rung };
  // Part 8: raw navigator text on the LOCAL sentence lane ONLY.
  if (rawText) out.sentence = rawText;
  return out;
}

module.exports = {
  captureCliScopePick: captureCliScopePick,
  SCOPE_RUNGS: SCOPE_RUNGS.slice(),
  CREATE_DRAFT: CREATE_DRAFT,
  BACK: BACK,
};
