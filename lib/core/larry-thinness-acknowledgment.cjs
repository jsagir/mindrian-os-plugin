'use strict';
/*
 * Phase 119-02 -- Larry thinness-acknowledgment voice + thin-finding detector.
 *
 * Per CONTEXT.md D-05: when Phase 117's composeAutoExploreFinding returns
 * thin output (null OR <= 1 finding), the room is still scaffolded but
 * Larry's voice acknowledges thinness honestly via the verbatim copy below.
 *
 * The verbatim copy is LOCKED per .planning/phases/119-room-as-receipt-invariant/
 * 119-02-PLAN.md objective block (lines 89-93). Do NOT paraphrase.
 *
 * Em-dash HARD RULE: uses `--` (two ASCII hyphens) NEVER `-` (U+2014).
 * Smart-quote BAN: uses ASCII apostrophe `'` (0x27) only -- never `’`.
 *
 * Canon Part 8 invariant: pure-local module; no Brain call, no telemetry
 * egress; the voice line is a static string with zero outbound surface.
 * Canon Part 10 sub-claim 1: Larry IS the product -- the voice line is
 * the conversational anchor that makes "rooms are receipts" feel honest
 * rather than apologetic when the source material is thin (D-05).
 */

// The verbatim D-05 voice line. Locked per the plan. Length: 152 chars (ASCII).
// Composed via two string literals (concat) for readability; the runtime
// value is one continuous string.
const THINNESS_VOICE_LINE =
  "I made a room around this -- it's mostly empty until we have more to work with. " +
  "Want to keep going and see what fills in?";

/**
 * Decide whether the room should surface the thinness acknowledgment to the user.
 *
 * Per .planning/phases/119-room-as-receipt-invariant/119-02-PLAN.md Task 1
 * <behavior> Test 6: D-05 threshold is "2+ findings = substantive; <=1 finding
 * = thin". The detector treats null / undefined / non-object / missing
 * findings array / empty findings array / single-finding all as thin.
 *
 * @param {object|null} autoExploreFinding  the JSON shape Phase 117 writes
 *                                          to .mindrian/auto-explore-<material_id>.json
 *                                          (shape: { material_id, findings: [...], composed_at_ms })
 * @returns {boolean}  true if Larry should render the thinness voice line
 */
function shouldAcknowledgeThinness(autoExploreFinding) {
  if (autoExploreFinding === null || autoExploreFinding === undefined) return true;
  if (typeof autoExploreFinding !== 'object') return true;
  const findings = Array.isArray(autoExploreFinding.findings) ? autoExploreFinding.findings : [];
  return findings.length <= 1;
}

/**
 * Return the verbatim D-05 thinness voice line. Single source of truth -- callers
 * MUST use this function (or the THINNESS_VOICE_LINE constant) rather than
 * inlining the string. This avoids cross-file string drift.
 *
 * @returns {string}  the locked verbatim voice line
 */
function voiceLine() {
  return THINNESS_VOICE_LINE;
}

module.exports = {
  THINNESS_VOICE_LINE: THINNESS_VOICE_LINE,
  shouldAcknowledgeThinness: shouldAcknowledgeThinness,
  voiceLine: voiceLine,
};
