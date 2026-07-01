'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 188-04 (SFS-08) -- captureCliDepthPick: the CLI F.3 depth-pick capture
 * adapter. Clones the f1-pick-capture-cli.cjs STRUCTURE (a thin surface adapter
 * that maps a rendered-card answer into the {pick} shape the consumer accepts)
 * MINUS the two-channel outcome/reach machinery -- F.3 is a single closed depth
 * scalar, not a verb+outcome dial.
 *
 * Closed-vocab carve-out (research pitfall #4): F.3 has NO recommended marker and
 * NO Free-Text. The adapter maps the selected option to one of the closed depth
 * values by DETERMINISTIC MEMBERSHIP (clone of _matchVerb), NOT fuzzy NLP. An
 * unknown answer yields { depth: null } so the consumer no-ops (T-188-04-01).
 *
 * Part 8: the navigator's raw answer text rides the optional `sentence` LOCAL
 * lane ONLY. It is NEVER the pick value, an edge body, or a Brain packet.
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant). No em-dashes.
 *
 * API: captureCliDepthPick(answer) -> { depth, sentence? }
 */

// The closed F.3 axis (renderer F3_OPTIONS). 'Back' is the control return: it
// carries no depth and is surfaced as a { back:true } signal (no state write).
const DEPTH_VALUES = ['Shallow', 'Medium', 'Deep', 'Extreme'];
const BACK = 'Back';

// Deterministic membership match against the closed depth axis (clone of the F.1
// adapter's _matchVerb). The AskUserQuestion answer is a known enum from the
// rendered F.3 card, so this is a membership match, NOT fuzzy NLP.
function _matchDepth(selected) {
  if (typeof selected !== 'string' || selected.length === 0) return null;
  return DEPTH_VALUES.indexOf(selected) !== -1 ? selected : null;
}

// ---------------------------------------------------------------------------
// captureCliDepthPick(answer) -> { depth, sentence?, back? }
//
// answer: the AskUserQuestion F.3 answer. Either a bare option label string
//         ('Deep') or an object { answer|selectedOption: <label>, text?: <raw> }.
//
// Returns { depth } where depth is the matched closed value, or { depth: null }
// on an unknown pick (deterministic no-op downstream). 'Back' returns
// { depth: null, back: true } (return to previous shape, no state write). The
// raw answer text rides the optional `sentence` LOCAL lane ONLY (Part 8).
// ---------------------------------------------------------------------------
function captureCliDepthPick(answer) {
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
    const backOut = { depth: null, back: true };
    if (rawText) backOut.sentence = rawText;
    return backOut;
  }

  const depth = _matchDepth(selected);
  const out = { depth: depth };
  // Part 8: raw navigator text on the LOCAL sentence lane ONLY.
  if (rawText) out.sentence = rawText;
  return out;
}

module.exports = {
  captureCliDepthPick: captureCliDepthPick,
  DEPTH_VALUES: DEPTH_VALUES.slice(),
  BACK: BACK,
};
