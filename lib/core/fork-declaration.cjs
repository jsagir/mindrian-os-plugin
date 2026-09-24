'use strict';
// lib/core/fork-declaration.cjs -- Phase 359-01 (FORK359-03, SPEC R3, amended
// by navigator ruling N-3).
//
// The ONE fork declaration grammar and its pure parser. Larry declares a
// prose fork on the last non-empty line of a turn's output, in the exact
// shape:
//
//   Your call: <practical> | <practical>[ | <practical>] | What if <moonshot>
//
// 2 or 3 practical labels, then exactly one final label that starts with the
// case-sensitive literal `What if` (a lateral, relevant-yet-radical moonshot
// option, N-3). 3 to 4 labels total (AskUserQuestion renders at most 4
// options plus its own "Other" field, so a 5th label could never reach the
// card -- N-3).
//
// This module is PURE: no fs, no network, no clock. It NEVER throws (bad
// input, including non-string, returns {declared: false}). The parser reads
// ONLY the last non-empty line of the text and never any other line (SPEC
// R3). D-06 step 5 / R5 inertness depends on this module changing nothing
// about how any OTHER text is read.
//
// House rule: hyphens only, no em-dashes anywhere.

// Guarded require of MARK_GLYPHS (Finding 3 / D-04: lib/core -> lib/hmi is an
// established direction, lib/core/voice-transition-detector.cjs:22-25 already
// does this exact guarded require of this exact module). On failure the
// glyph set stays null and every call below returns NOT_DECLARED: a
// declaration parser that cannot confirm "this line carries no voice glyph"
// must fail INERT, the same as today's no-declaration behavior, not fail
// open into accepting a possibly-glyph-carrying line.
let MARK_GLYPHS = null;
try {
  MARK_GLYPHS = require('../hmi/voice-color-mark.cjs').MARK_GLYPHS || null;
} catch (_e) {
  MARK_GLYPHS = null;
}

const DECLARATION_PREFIX = 'Your call: ';
const DECLARATION_SEPARATOR = ' | ';
const MOONSHOT_PREFIX = 'What if';
const MIN_PRACTICAL = 2;
const MAX_PRACTICAL = 3;
const MIN_LABELS = 3;
const MAX_LABELS = 4;
const MAX_LABEL_CHARS = 80; // code points, so Hebrew and other non-ASCII labels work
const MAX_LINE_CHARS = 512; // size guard before any split; the only regex below is bounded by this

const NOT_DECLARED = Object.freeze({ declared: false });

// codePointLength(s) -- code-point count (not UTF-16 code unit count), so an
// 80-code-point Hebrew label is accepted the same as an 80-code-point ASCII
// one. Never throws (caller already guarantees a string).
function codePointLength(s) {
  return Array.from(s).length;
}

/**
 * parseForkDeclaration(outputText) -- the ONE parser for the N-3 declaration
 * grammar. Returns {declared: true, labels, practical, moonshot} on a valid
 * line, else {declared: false}. Never throws.
 * @param {*} outputText
 * @returns {{declared: boolean, labels?: string[], practical?: string[], moonshot?: string}}
 */
function parseForkDeclaration(outputText) {
  try {
    if (typeof outputText !== 'string' || outputText.length === 0) return NOT_DECLARED;
    if (MARK_GLYPHS === null) return NOT_DECLARED; // fail inert (D-04)

    // The parser reads ONLY the last non-empty line (SPEC R3). Trailing
    // blank lines, trailing whitespace and CRLF endings are all tolerated.
    const lines = outputText.split('\n');
    let i = lines.length - 1;
    while (i >= 0 && lines[i].trim() === '') i -= 1;
    if (i < 0) return NOT_DECLARED;
    const line = lines[i].replace(/[ \t\r]+$/, '');

    if (!line.startsWith(DECLARATION_PREFIX)) return NOT_DECLARED; // column 0, case-sensitive, no leading whitespace, no emphasis
    if (codePointLength(line) > MAX_LINE_CHARS) return NOT_DECLARED; // size guard before the one regex below

    if (line.indexOf('[') !== -1 || line.indexOf(']') !== -1) return NOT_DECLARED;

    for (const ch of line) {
      if (Object.prototype.hasOwnProperty.call(MARK_GLYPHS, ch)) return NOT_DECLARED;
    }

    // The one regex in this module, bounded by the MAX_LINE_CHARS guard
    // above (T-359-02): the retired numbered-prose backstop literal.
    if (/type\s+1\s*,\s*2\s*,\s*or\s+3/i.test(line)) return NOT_DECLARED;

    const rest = line.slice(DECLARATION_PREFIX.length);
    const labels = rest.split(DECLARATION_SEPARATOR).map(function (s) { return s.trim(); });

    if (labels.length < MIN_LABELS || labels.length > MAX_LABELS) return NOT_DECLARED;

    const seen = new Set();
    for (const l of labels) {
      if (!l) return NOT_DECLARED;
      if (l.indexOf('|') !== -1) return NOT_DECLARED;
      if (codePointLength(l) > MAX_LABEL_CHARS) return NOT_DECLARED;
      const key = l.normalize('NFKC').toLowerCase();
      if (seen.has(key)) return NOT_DECLARED;
      seen.add(key);
    }

    const moonshot = labels[labels.length - 1];
    const practical = labels.slice(0, -1);

    if (practical.length < MIN_PRACTICAL || practical.length > MAX_PRACTICAL) return NOT_DECLARED;

    // Exactly one final label starting with the case-sensitive literal
    // `What if`, with a non-space character after it. No earlier (practical)
    // label may start with the same literal (N-3: the moonshot is always
    // last).
    if (!moonshot.startsWith(MOONSHOT_PREFIX + ' ')) return NOT_DECLARED;
    if (moonshot.slice((MOONSHOT_PREFIX + ' ').length).trim().length === 0) return NOT_DECLARED;
    for (const p of practical) {
      if (p.startsWith(MOONSHOT_PREFIX)) return NOT_DECLARED;
    }

    return { declared: true, labels: labels, practical: practical, moonshot: moonshot };
  } catch (_e) {
    return NOT_DECLARED;
  }
}

/**
 * formatDeclaration(labels) -- the inverse of parseForkDeclaration's line
 * shape (round-trips every valid label set). Returns '' for a non-array.
 * Never throws.
 * @param {*} labels
 * @returns {string}
 */
function formatDeclaration(labels) {
  if (!Array.isArray(labels)) return '';
  return DECLARATION_PREFIX + labels.join(DECLARATION_SEPARATOR);
}

module.exports = {
  parseForkDeclaration: parseForkDeclaration,
  formatDeclaration: formatDeclaration,
  DECLARATION_PREFIX: DECLARATION_PREFIX,
  DECLARATION_SEPARATOR: DECLARATION_SEPARATOR,
  MOONSHOT_PREFIX: MOONSHOT_PREFIX,
  MIN_PRACTICAL: MIN_PRACTICAL,
  MAX_PRACTICAL: MAX_PRACTICAL,
  MIN_LABELS: MIN_LABELS,
  MAX_LABELS: MAX_LABELS,
  MAX_LABEL_CHARS: MAX_LABEL_CHARS,
};
