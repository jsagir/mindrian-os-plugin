// lib/core/gate-relevance.cjs -- Phase 210-05 (item 210-E-1, the relevance gate)
//
// THE shared relevance predicate in front of Phase 209's force-fire machinery.
// scripts/check-card-fire.cjs (the Stop-hook backstop) consults these predicates
// BEFORE its final intercept so the engine can distinguish "a genuine unanswered
// fork" from "a follow-up already answered" (the 2026-07-02 live incident) and
// from "a stale artifact with zero connection to the current conversation".
//
// Three exports:
//   - extractOptionLabels(text)        : the option-label extraction + normalization
//                                        MOVED (not copied) from check-card-fire.cjs's
//                                        gateSignature so there is exactly ONE
//                                        implementation (retry keys must stay
//                                        byte-equivalent across the move).
//   - gateAlreadyAnswered(userText, gateLabels) : did the preceding user turn already
//                                        plainly answer the gate?
//   - gateTopicallyRelevant(userText, gateText) : does the gate's subject matter have
//                                        ANY connection to the current turn? false
//                                        ONLY on zero subject-token overlap (the
//                                        stale-artifact pattern).
//
// CONSERVATIVE VERDICT CONTRACT (Pitfall 3 -- bare removal is forbidden): on empty,
// absent, or unparseable user text the verdicts are answered=false / relevant=true,
// so uncertainty ALWAYS defaults to intercept. The Phase 209 guarantee (a genuine,
// relevant, unanswered fork still force-fires) is the reverse-regression floor.
//
// CR-03 INVARIANT (enforced by the caller, restated here): the preceding user text
// feeds ONLY these relevance verdicts. It must NEVER be folded into gateSignature
// or turnContextHash -- the retry key is anchored on gate-identifying content alone.
//
// Canon Part 8 (Graph Boundary): pure LOCAL string work. Zero network, zero Brain,
// zero fs. Deterministic (no clock, no random). Every function is input-guarded and
// never throws (the check-card-fire predicate-header contract).
//
// House rule: hyphens only, no em-dashes. CJS module, node built-ins only.

'use strict';

// ---------------------------------------------------------------------------
// OPTION_LABEL_RE -- MOVED from scripts/check-card-fire.cjs::gateSignature
// (Phase 210-05). An option-label line is `[n] text`, `n) text`, or `n. text`
// where n is a SINGLE low ordinal (1-9) AND a whitespace separator follows the
// marker. The whitespace requirement is load-bearing: it rejects a decimal
// number like `0.123456789` (no space after the dot) from being mistaken for
// an `n.` option marker, which would inject a volatile phantom label and flap
// the retry-key signature across retries (the exact bug that broke the
// growing-transcript convergence).
// ---------------------------------------------------------------------------
const OPTION_LABEL_RE = /^\s*(?:\[\s*[1-9]\s*\]|[1-9][).])\s+(.+?)\s*$/;

// The unambiguous plain-text affirmation / negation token sets for the 2-option
// yes/no gate shape (the live-incident "yes"). Deliberately NARROW: a token
// outside these sets is NOT treated as an answer (conservative -> intercept).
const AFFIRMATIONS = Object.freeze(new Set([
  'yes', 'y', 'yeah', 'yep', 'sure', 'ok', 'okay',
  'confirm', 'confirmed', 'approve', 'approved',
  'go', 'goahead', 'proceed', 'doit',
]));
const NEGATIONS = Object.freeze(new Set([
  'no', 'n', 'nope', 'nah', 'hold', 'stop', 'cancel',
  'dont', 'notnow', 'later', 'abort', 'skip',
]));

// Subject-token filter for the topical-relevance check: tokens shorter than
// MIN_SUBJECT_TOKEN_LEN or in the stopword set carry no subject signal, so a
// shared "the"/"with"/"that" can never make a stale gate look relevant.
const MIN_SUBJECT_TOKEN_LEN = 4;

// The irrelevance pass needs REAL signal on the user side before it may fire: a
// turn with fewer than this many subject tokens (e.g. "option 2 please", "go on")
// carries too little evidence to declare ZERO connection, so the verdict stays
// conservative (relevant -> intercept). Proven necessary by the WR-06 floor in
// tests/test-ga4-card-fire-e2e-179.cjs (a terse "option 2 please" turn followed
// by a NEW un-fired gate must still block).
const MIN_USER_SUBJECT_TOKENS = 2;
const STOPWORDS = Object.freeze(new Set([
  'that', 'this', 'with', 'have', 'from', 'what', 'when', 'where', 'which',
  'will', 'would', 'could', 'should', 'your', 'yours', 'about', 'them',
  'they', 'their', 'then', 'than', 'does', 'been', 'were', 'into', 'over',
  'just', 'like', 'also', 'more', 'some', 'such', 'only', 'very', 'please',
  'thanks', 'thank', 'want', 'need', 'know', 'think', 'still', 'here',
  'there', 'while', 'because', 'after', 'before', 'between', 'again',
  'other', 'another', 'each', 'something', 'anything', 'everything',
]));

// normalizeAnswer(text) -- the SAME normalization gateSignature applies to option
// labels (lowercase, non-alphanumeric collapsed away), applied to a candidate
// answer so answers and labels compare in one token space. Never throws.
function normalizeAnswer(text) {
  if (typeof text !== 'string') return '';
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// subjectTokens(text) -- the subject-token set for the relevance overlap check:
// lowercase, split on non-alphanumeric runs, drop short tokens, stopwords, and
// pure numbers. Returns a Set of tokens. Never throws.
function subjectTokens(text) {
  const out = new Set();
  if (typeof text !== 'string' || !text) return out;
  const parts = text.toLowerCase().split(/[^a-z0-9]+/);
  for (const p of parts) {
    if (p.length < MIN_SUBJECT_TOKEN_LEN) continue;
    if (STOPWORDS.has(p)) continue;
    if (/^\d+$/.test(p)) continue;
    out.add(p);
  }
  return out;
}

/**
 * extractOptionLabels(text) -- extract the normalized option-label set from
 * gate-shaped text. MOVED from scripts/check-card-fire.cjs::gateSignature
 * (Phase 210-05) so the retry-key signature and the relevance predicate share
 * exactly one implementation. Returns the deduped normalized labels in
 * encounter order (the caller sorts when it needs sorted output, exactly as
 * gateSignature did before the move). Never throws.
 * @param {*} text
 * @returns {string[]}
 */
function extractOptionLabels(text) {
  try {
    if (typeof text !== 'string' || !text) return [];
    const labelSet = [];
    const seen = new Set();
    const lines = text.split('\n');
    for (const line of lines) {
      const mm = line.match(OPTION_LABEL_RE);
      if (!mm) continue;
      const norm = mm[1].toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (!norm || seen.has(norm)) continue;
      seen.add(norm);
      labelSet.push(norm);
    }
    return labelSet;
  } catch (_e) {
    return [];
  }
}

/**
 * gateAlreadyAnswered(precedingUserText, gateLabels) -- true when the preceding
 * user turn already plainly answered the gate. Three NARROW answer shapes only:
 *   (a) the normalized user text exactly matches one of the gate's normalized
 *       option labels;
 *   (b) the user text is a single ordinal (1-9) naming an existing option;
 *   (c) the user text is an unambiguous plain-text affirmation/negation of a
 *       2-option yes/no-shaped gate (one label starts with "yes", the other
 *       with "no" -- the live-incident "yes" shape).
 * Anything else, including empty/absent text, returns false (the CONSERVATIVE
 * verdict: uncertainty defaults to intercept). Pure, deterministic, never throws.
 * @param {*} precedingUserText
 * @param {*} gateLabels normalized labels (extractOptionLabels output)
 * @returns {boolean}
 */
function gateAlreadyAnswered(precedingUserText, gateLabels) {
  try {
    const norm = normalizeAnswer(precedingUserText);
    if (!norm) return false;
    const labels = Array.isArray(gateLabels)
      ? gateLabels.filter(function (l) { return typeof l === 'string' && l; })
      : [];
    if (labels.length === 0) return false;

    // (a) exact normalized-label match.
    if (labels.indexOf(norm) !== -1) return true;

    // (b) a single ordinal naming an existing option ("1", "2", ...).
    if (/^[1-9]$/.test(norm) && Number(norm) <= labels.length) return true;

    // (c) plain-text affirmation/negation of a 2-option yes/no-shaped gate.
    if (labels.length === 2) {
      const hasYes = labels.some(function (l) { return l.indexOf('yes') === 0; });
      const hasNo = labels.some(function (l) { return l.indexOf('no') === 0; });
      if (hasYes && hasNo && (AFFIRMATIONS.has(norm) || NEGATIONS.has(norm))) {
        return true;
      }
    }
    return false;
  } catch (_e) {
    return false;
  }
}

/**
 * gateTopicallyRelevant(precedingUserText, gateText) -- false ONLY when the
 * user turn and the gate's subject tokens have ZERO overlap (the stale-artifact
 * pattern). Empty/absent user text, empty gate text, or an all-stopword turn
 * all return true (the CONSERVATIVE verdict: uncertainty defaults to
 * intercept). Pure, deterministic, never throws.
 * @param {*} precedingUserText
 * @param {*} gateText
 * @returns {boolean}
 */
function gateTopicallyRelevant(precedingUserText, gateText) {
  try {
    const userTokens = subjectTokens(precedingUserText);
    if (userTokens.size < MIN_USER_SUBJECT_TOKENS) return true;
    const gateTokens = subjectTokens(gateText);
    if (gateTokens.size === 0) return true;
    // Prefix-stem overlap: two subject tokens overlap when they are equal OR one
    // is a prefix of the other ("start" vs "starting", "publish" vs "publishing").
    // Both sides are already >= MIN_SUBJECT_TOKEN_LEN, so a short function word can
    // never prefix-match. This deliberately errs toward RELEVANT (more intercepts,
    // never fewer genuine fires) -- proven necessary by the CR-02 growing-transcript
    // floor in tests/test-ga4-card-fire-e2e-179.cjs ("start a venture" must stay
    // relevant to "Choose your starting point").
    for (const u of userTokens) {
      for (const g of gateTokens) {
        if (u === g || u.indexOf(g) === 0 || g.indexOf(u) === 0) return true;
      }
    }
    return false;
  } catch (_e) {
    return true;
  }
}

module.exports = {
  extractOptionLabels,
  gateAlreadyAnswered,
  gateTopicallyRelevant,
};
