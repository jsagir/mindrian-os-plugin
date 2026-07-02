'use strict';
/*
 * card-fire-gate.cjs -- local, deterministic classifier for card-fired-vs-prose
 * fidelity at a Shape-F Decision Gate.
 * =========================================================================
 * Phase 209-04. The runtime-safe half of the phase's mandatory eval GATE: it
 * reproduces the Plurai judge's pass/violation verdict OFFLINE, so the phase's
 * core claim ("a declared gate fires the AskUserQuestion card, prose or an
 * ASCII frame at a gate is a violation") is regression-checked WITHOUT calling
 * Plurai at runtime (Canon Part 8: Plurai is build/CI only).
 *
 * A turn trace is a PASS only when every hard invariant below is clean. The
 * four violations are HARD invariant checks (booleans), never data-swept and
 * never overridable by an options object -- a violating trace stays a
 * violation (the ralph-loop-gate.cjs / calibration-gate.cjs precedent: "a gate
 * that cannot fail is not a gate").
 *
 * Trace shape: { declared_gate: bool, card_fired: bool, output_text: string,
 * trailer_present: bool }.
 *
 *   rendered_prose_instead_of_card -- a Decision Gate was declared, no card
 *                                     fired, and the output text carries a
 *                                     numbered or bracket-labeled option list
 *                                     (a hand-rolled menu standing in for the
 *                                     tool call).
 *   ascii_box_at_gate               -- no card fired and the output matches a
 *                                     labeled-box glyph form (same-line or
 *                                     multiline "[1]...[2]", or the literal
 *                                     "type 1, 2, or 3" exemplar). A BARE
 *                                     U+25A0 alone is deliberately EXCLUDED --
 *                                     it is sanctioned UI vocabulary
 *                                     (selector-dispatcher.cjs:256,
 *                                     ui-system SKILL.md:131,
 *                                     dial-presenter.cjs:134).
 *   no_card_at_declared_gate        -- the floor invariant: a gate was
 *                                     declared and no card fired, regardless
 *                                     of output text shape.
 *   trailer_present_card_absent     -- the self-decoding BINDING trailer was
 *                                     in context (Wave 1, E1) and still no
 *                                     card fired -- the trigger reached Larry
 *                                     and was ignored.
 *
 * Pure + offline. Node built-ins only. No em-dashes.
 */

// Mirrors the sanctioned-glyph carve-out in scripts/check-card-fire.cjs's
// ASCII_BOX_GLYPH_RE (post Phase 209-07 H1 tightening): a labeled-box form
// (same-line or multiline "[1]...[2]") or the literal "type 1, 2, or 3"
// exemplar is a violation; a bare U+25A0 alone is NOT.
const LABELED_BOX_RE = /\[\s*1\s*\][\s\S]*?\[\s*2\s*\]/i;
const TYPE_MENU_RE = /type\s+1\s*,\s*2\s*,\s*or\s+3/i;

// A hand-rolled numbered or bracket-labeled option list standing in for the
// AskUserQuestion tool call (e.g. "1. Option A\n2. Option B" or "[1] a [2] b").
const NUMBERED_OPTION_LIST_RE = /(^|\n)\s*1[.)]\s+\S/;

function isAsciiBoxAtGate(outputText) {
  const s = typeof outputText === 'string' ? outputText : '';
  return LABELED_BOX_RE.test(s) || TYPE_MENU_RE.test(s);
}

function isProseOptionList(outputText) {
  const s = typeof outputText === 'string' ? outputText : '';
  return NUMBERED_OPTION_LIST_RE.test(s) || LABELED_BOX_RE.test(s);
}

const HARD_VIOLATIONS = Object.freeze([
  {
    name: 'rendered_prose_instead_of_card',
    hit: function (t) {
      return t.declared_gate === true && t.card_fired !== true && isProseOptionList(t.output_text);
    },
  },
  {
    name: 'ascii_box_at_gate',
    hit: function (t) {
      return t.card_fired !== true && isAsciiBoxAtGate(t.output_text);
    },
  },
  {
    name: 'no_card_at_declared_gate',
    hit: function (t) {
      return t.declared_gate === true && t.card_fired !== true;
    },
  },
  {
    name: 'trailer_present_card_absent',
    hit: function (t) {
      return t.trailer_present === true && t.card_fired !== true;
    },
  },
]);

// classifyCardFireTrace(trace, _optsIgnored) -> { classification: 'pass' |
// 'violation', violations: [...] }. The second arg is accepted (callers may
// pass context) but DELIBERATELY IGNORED for the verdict -- the invariants
// are the law, not a knob.
function classifyCardFireTrace(trace, _optsIgnored) {
  const t = (trace && typeof trace === 'object') ? trace : {};
  const violations = [];
  for (const v of HARD_VIOLATIONS) {
    if (v.hit(t)) violations.push(v.name);
  }
  return { classification: violations.length === 0 ? 'pass' : 'violation', violations: violations };
}

module.exports = { classifyCardFireTrace, HARD_VIOLATIONS };
