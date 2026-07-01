'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 205-05 (item 5) -- the NO-CUTE-IRONY tone filter.
 * =========================================================================
 * The Test 6 tone slip was the quip "a paper about AI written by AI would be
 * its own punchline" -- a cute, self-referential aside dropped on a PROFESSOR.
 * With a peer or in a sensitive domain, that cuteness reads as presumptuous.
 * This filter strips ironic quips + teacherly asides when the audience is a
 * professor/researcher OR the domain is sensitive
 * {defence, intelligence, geopolitics}.
 *
 * It is a TONE gate, not a CONTENT gate: it removes the cuteness, never the
 * substantive claim. Two invariants hold by construction:
 *   1. Hedged-always: the filter never makes a statement MORE confident and
 *      never removes a hedge. A candidate sentence that carries a hedge marker
 *      is KEPT (treated as substantive), so no hedge is ever stripped.
 *   2. No em-dashes: the output is swept for em-dash / en-dash and normalized
 *      to hyphens (CLAUDE.md HARD RULE).
 *
 * Gates on role_level/domain, NEVER globally: a student in a non-sensitive
 * domain gets the text back untouched (a light aside is permitted).
 *
 * Constraints: CJS, Node built-ins only, zero network, LOCAL only (Part 8 --
 * text is processed in-memory and never egresses). House rule: hyphens only.
 *
 * License: BSL 1.1.
 */

// The role_levels that trigger the filter (peers / experts). Frozen.
const GATED_ROLE_LEVELS = Object.freeze(['professor', 'researcher']);

// The sensitive domains that trigger the filter regardless of role_level. Frozen.
const SENSITIVE_DOMAINS = Object.freeze(['defence', 'intelligence', 'geopolitics']);

// Hedge markers. A sentence carrying any of these is SUBSTANTIVE (kept) even if
// it also trips a cuteness pattern -- this is the hedged-always guarantee: the
// filter can never strip a hedge. Frozen.
const HEDGE_MARKERS = Object.freeze([
  'might', 'maybe', 'perhaps', 'possibly', 'i think', 'i suspect',
  'could be', 'may be', 'it seems', 'arguably', 'i wonder', 'likely',
  'it may', 'one reading', 'here is why', 'if i read',
]);

// The cute-irony pattern class the Test 6 slip belongs to: self-referential
// punchline quips, "the irony" asides, "see what I did there" winks, and
// teacherly rhetorical questions aimed at a peer. Frozen.
const CUTE_IRONY_PATTERNS = Object.freeze([
  /\bpunchline\b/i,
  /\bthe irony\b/i,
  /\bhow ironic\b/i,
  /\bironically\b/i,
  /see what i did there/i,
  /\bno pun intended\b/i,
  /\bpun intended\b/i,
  /\bwouldn'?t you agree\b/i,
  /\bisn'?t it (?:funny|amusing|ironic)\b/i,
  /\bone might quip\b/i,
  /\bwhich is rather fitting\b/i,
]);

// Split text into sentences, preserving the trailing punctuation. Splits on a
// sentence terminator (. ! ?) followed by whitespace. Pure, no I/O.
function _splitSentences(text) {
  const raw = text.split(/(?<=[.!?])\s+/);
  const out = [];
  for (const s of raw) {
    const t = s.trim();
    if (t.length > 0) out.push(t);
  }
  return out;
}

function _isHedge(sentence) {
  const low = sentence.toLowerCase();
  for (const m of HEDGE_MARKERS) {
    if (low.indexOf(m) !== -1) return true;
  }
  return false;
}

function _isCuteIrony(sentence) {
  for (const re of CUTE_IRONY_PATTERNS) {
    if (re.test(sentence)) return true;
  }
  return false;
}

// Normalize any em-dash / en-dash to a hyphen (CLAUDE.md HARD RULE). Applied to
// EVERY output path so the filter can never emit an em-dash.
function _noEmDash(text) {
  // \u2014 = em-dash, \u2013 = en-dash. Referenced by escape so this source
  // file itself carries no literal em-dash byte (CLAUDE.md HARD RULE).
  return text.replace(/[\u2014\u2013]/g, '-');
}

/**
 * Strip cute irony / teacherly asides when gated by role_level or domain.
 *
 * @param {string} text
 * @param {object} opts {role_level, domain}
 * @returns {string} the filtered text (substantive claim intact, no em-dashes),
 *   or the input untouched when the gate is not tripped.
 */
function applyNoCuteIrony(text, opts) {
  if (typeof text !== 'string' || text.length === 0) return text;
  const o = (opts && typeof opts === 'object') ? opts : {};
  const role_level = (typeof o.role_level === 'string') ? o.role_level.toLowerCase() : null;
  const domain = (typeof o.domain === 'string') ? o.domain.toLowerCase() : null;

  const gated = (role_level !== null && GATED_ROLE_LEVELS.indexOf(role_level) !== -1)
    || (domain !== null && SENSITIVE_DOMAINS.indexOf(domain) !== -1);

  // Gates on role_level/domain, never globally: ungated input is returned as-is
  // (a light aside is permitted for a student in a non-sensitive domain).
  if (!gated) return text;

  const sentences = _splitSentences(text);
  const kept = sentences.filter(function (s) {
    // Hedged-always: never strip a hedge. A sentence carrying a hedge marker is
    // substantive by definition, so it survives even if it looks cute.
    if (_isHedge(s)) return true;
    return !_isCuteIrony(s);
  });

  let out = kept.join(' ').replace(/\s+/g, ' ').trim();
  // If stripping removed everything (a text that was ALL quip), fall back to the
  // original text rather than emit an empty string -- but still sweep em-dashes.
  if (out.length === 0) return _noEmDash(text);
  return _noEmDash(out);
}

module.exports = {
  applyNoCuteIrony,
  GATED_ROLE_LEVELS,
  SENSITIVE_DOMAINS,
  // Test seam (private).
  _test: {
    HEDGE_MARKERS,
    CUTE_IRONY_PATTERNS,
    _splitSentences,
    _isHedge,
    _isCuteIrony,
    _noEmDash,
  },
};
