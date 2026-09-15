'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 346-02 -- the `enforcement` axis (enforce vs judge vs not-applicable)
 * and the LOCAL escape-hatch detector the Claude Code path has been missing.
 * =========================================================================
 * CRITICAL NAMING DISAMBIGUATION (read before touching this file):
 *
 * The word "posture" is already bound THREE times in this codebase, one of
 * them drift-tested to an exact count:
 *
 *   1. `sensor-types.POSTURE_IDS` = push_forward / hold / pull_back, the
 *      Hierarchical Navigator / Usher-cycle read, asserted EXACTLY 3 (no
 *      more, no fewer) by tests/test-posture-ids-drift.cjs.
 *   2. `recipe-maps.postureForCommand(command)`, "the ONE registry posture
 *      authority."
 *   3. `stance-state.STANCES` = ['research', 'tell-act', 'ask', 'redteam'],
 *      the SEED-042 4-pole MANUAL override dial (`lib/core/stance-state.cjs`,
 *      which already fought and settled this exact naming fight for its own
 *      axis).
 *
 * The ruling, mirroring stance-state.cjs's own resolution in spirit: the
 * CODE identifier for this module's output is "arbitration" everywhere
 * (module, function, JSON key, event type, trace field). User-facing prose
 * may still say "the posture decision", exactly as the roadmap's own
 * language reads; only the CODE identifier must avoid the collision. Prose
 * may still say "posture decision"; code may not use the word "posture" as
 * an identifier. This module mints NO fourth posture id and names no
 * literal posture token anywhere outside THIS comment.
 * =========================================================================
 *
 * Purity contract: pure-function module, zero I/O, zero network, never
 * throws. Canon Part 8: LOCAL only -- this module receives coerced scalars
 * and booleans and never a room body, never user prose beyond the single
 * detector entry point below (detectEscapeHatch). Mirrors the "Pure-function
 * module. Zero I/O." header claim in lib/core/nav-dial.cjs and the reason
 * lib/core does not import from lib/mcp or lib/memory (Pitfall 9:
 * capabilities arrive threaded on the input, never required from
 * lib/mcp/surface-detect.cjs).
 *
 * House rule: CJS, Node built-ins only, hyphens only, no em-dashes.
 */

// ---------------------------------------------------------------------------
// The escape-hatch detector -- the ONLY function in this module that accepts
// user text. It returns exactly two booleans and never echoes any input
// substring; resolveEnforcement below and the composed resolver landing in
// 346-04 never receive the text itself (Canon Part 8 fence, pinned
// behaviorally here and by a source-scan drift test in 346-04).
// ---------------------------------------------------------------------------

// ESCAPE_HATCH_PHRASES -- the doctrine source is skills/larry-personality/
// SKILL.md's Hierarchical Navigator / arbitration rule 7 ("An explicit 'just
// tell me / bottom line' is the captain overriding the instrument -- deliver
// immediately"). The wider regex in mcp-server-brain/lib/brain-ask.cjs:331
// (deriveModeSignals: /just tell me|bottom line|skip the question/) is a
// DIFFERENT server's producer and is deliberately not mirrored key-for-key
// here: this detector covers exactly the two phrases the navigator named.
const ESCAPE_HATCH_PHRASES = Object.freeze(['just tell me', 'bottom line']);

/**
 * Detect the two explicit user-override phrases on the Claude Code path.
 * Non-string input coerces to both-false immediately -- never throws.
 *
 * Part 8 fence: this is the ONLY function in the module that accepts user
 * text; it returns booleans. resolveEnforcement and the composed resolver in
 * 346-04 never receive the text.
 *
 * The two returned key names are byte-identical to the two flags selectMode
 * reads at directive-envelope.cjs:42 (rule 1, highest precedence).
 *
 * @param {*} userText
 * @returns {{user_said_just_tell_me: boolean, user_said_bottom_line: boolean}}
 */
function detectEscapeHatch(userText) {
  if (typeof userText !== 'string') {
    return { user_said_just_tell_me: false, user_said_bottom_line: false };
  }
  const lowered = userText.toLowerCase();
  return {
    user_said_just_tell_me: lowered.indexOf(ESCAPE_HATCH_PHRASES[0]) !== -1,
    user_said_bottom_line: lowered.indexOf(ESCAPE_HATCH_PHRASES[1]) !== -1,
  };
}

module.exports = {
  ESCAPE_HATCH_PHRASES,
  detectEscapeHatch,
};
