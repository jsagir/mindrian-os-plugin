/**
 * MindrianOS Plugin -- Futures Wheel advisory causal-cue flagger (Phase 156, FW-03)
 *
 * A lightweight, pattern-based pass that flags each proposed consequence
 * cue-supported or cue-thin to combat LLM causal hallucination. It is ADVISORY
 * ONLY: it NEVER drops a consequence (dropped is always false). The HITL
 * Decision Gate (Part 3) decides; the flagger only annotates. The truth-claim
 * confirmation is deferred to the Wave 3 confirmNode gate (Part 9).
 *
 * Reuse-not-ML (Part 7 + Part 8 constraint): a static causal-cue lexicon over
 * built-in regex only. NO ML model, NO new runtime dependency, NO network.
 *
 * Pure Node.js built-ins only (zero npm deps per Phase 10 decision).
 * No em-dashes (hyphens only).
 */

'use strict';

// The static causal-cue lexicon. Frozen: this is the closed advisory set.
// Phrases an explicit cause-effect relation; their PRESENCE raises displayed
// confidence, their ABSENCE lowers it. Order is matched-priority irrelevant
// (all matches are collected).
const CAUSAL_CUE_LEXICON = Object.freeze([
  'leads to',
  'led to',
  'because',
  'enables',
  'results in',
  'causes',
  'drives',
  'forces',
  'triggers',
  'gives rise to',
]);

// Advisory confidence deltas. Small, never load-bearing: the gate, not these
// numbers, decides. cue-supported nudges displayed confidence UP, cue-thin
// nudges it DOWN. Neither ever drops the consequence.
const CUE_SUPPORTED_ADJUST = 0.1;
const CUE_THIN_ADJUST = -0.05;

/**
 * Escape a lexicon phrase for safe use inside a RegExp.
 * @param {string} s
 * @returns {string}
 */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Run the advisory causal-cue pass over a consequence text.
 *
 * @param {string} text - the consequence text to flag
 * @returns {{
 *   flag: 'cue-supported' | 'cue-thin',
 *   matched: string[],
 *   confidence_adjust: number,
 *   dropped: false
 * }}
 *   matched lists the cue phrases found (case-insensitive). confidence_adjust is
 *   an advisory delta applied to DISPLAYED confidence -- it is returned, never a
 *   mutation of the input. dropped is ALWAYS false (FW-03: advisory only).
 */
function flagCausalCue(text) {
  const haystack = typeof text === 'string' ? text : '';
  const matched = [];

  for (const cue of CAUSAL_CUE_LEXICON) {
    // Case-insensitive substring match via regex. Built-in only, no dependency.
    const re = new RegExp(escapeRegex(cue), 'i');
    if (re.test(haystack)) {
      matched.push(cue);
    }
  }

  const supported = matched.length > 0;

  return {
    flag: supported ? 'cue-supported' : 'cue-thin',
    matched,
    confidence_adjust: supported ? CUE_SUPPORTED_ADJUST : CUE_THIN_ADJUST,
    // FW-03: ADVISORY ONLY. The flagger NEVER drops a consequence; the gate decides.
    dropped: false,
  };
}

module.exports = {
  CAUSAL_CUE_LEXICON,
  flagCausalCue,
};
