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
// N-7 (navigator ruling, 359-06 checkpoint; quick 261028-v6m) tolerates
// COSMETIC slips and nothing structural:
//   1. lowercase `what if` as the final label prefix;
//   2. markdown emphasis (`**`, `__`, `*`, `_`) as ONE balanced pair around
//      the `Your call:` prefix, OR around the WHOLE line, OR (interpretation)
//      around the `What if` prefix of the final label;
//   3. one trailing blank line, or ONE short sign-off line after the
//      declaration line (interpretation: at most 120 code points, no voice
//      glyph, no bracket; a blank line may sit between the two).
// The returned labels are canonical (marks removed, capital `What if`), and a
// strict N-3 line returns byte-identical labels. Every line the strict grammar
// accepted is still accepted. Still rejected: fewer than 3 or more than 4
// labels in total, brackets, duplicates, voice glyphs, a non-final What-if,
// a line that is not a declaration. No prose guessing.
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
const SIGNOFF_MAX_CHARS = 120; // N-7: one trailing sign-off line, code points
const EMPHASIS_MARKS = ['**', '__', '*', '_']; // N-7: bold and italic marks (longest first)
const MAX_LINE_CHARS = 512; // size guard before any split; the only regex below is bounded by this

const NOT_DECLARED = Object.freeze({ declared: false });

// codePointLength(s) -- code-point count (not UTF-16 code unit count), so an
// 80-code-point Hebrew label is accepted the same as an 80-code-point ASCII
// one. Never throws (caller already guarantees a string).
function codePointLength(s) {
  return Array.from(s).length;
}

// hasVoiceGlyph(line) -- true when any code point of the line is a voice
// glyph. Only called after the MARK_GLYPHS null-guard in the caller.
function hasVoiceGlyph(line) {
  for (const ch of line) {
    if (Object.prototype.hasOwnProperty.call(MARK_GLYPHS, ch)) return true;
  }
  return false;
}

// unwrapEmphasis(line) -- N-7 cosmetic tolerance 2. Returns the line with the
// `Your call: ` prefix in its exact strict form, or null when the line is not
// a declaration line. Accepted: the strict prefix; the prefix wrapped in one
// balanced mark pair (`**Your call:** `); the WHOLE line wrapped in one
// balanced mark pair (`**Your call: A | B | What if C**`). Marks anywhere else
// are NOT removed.
function unwrapEmphasis(line) {
  if (line.startsWith(DECLARATION_PREFIX)) return line;
  const core = DECLARATION_PREFIX.trim();
  for (const m of EMPHASIS_MARKS) {
    const wrapped = m + core + m + ' ';
    if (line.startsWith(wrapped)) return DECLARATION_PREFIX + line.slice(wrapped.length);
  }
  for (const m of EMPHASIS_MARKS) {
    if (!line.startsWith(m + DECLARATION_PREFIX) || !line.endsWith(m)) continue;
    const inner = line.slice(m.length, line.length - m.length);
    if (inner.endsWith(m[0])) continue; // `*...**` is a mismatched pair, not one balanced pair
    if (inner.length > DECLARATION_PREFIX.length) return inner;
  }
  return null;
}

// normalizeMoonshot(label) -- N-7 cosmetic tolerances 1 and 2. Returns the
// label with a canonical `What if` prefix (marks removed, capital W), or null
// when the label does not start with `What if` or `what if` followed by a
// space and a body. The prefix may be wrapped in one balanced mark pair. Only
// the prefix is touched; the body of the label is returned as written.
function normalizeMoonshot(label) {
  const words = MOONSHOT_PREFIX.toLowerCase(); // 'what if'
  const n = MOONSHOT_PREFIX.length;
  const candidates = [''].concat(EMPHASIS_MARKS);
  for (const m of candidates) {
    if (m && !label.startsWith(m)) continue;
    const body = label.slice(m.length);
    const head = body.slice(0, n);
    if (head !== MOONSHOT_PREFIX && head !== words) continue;
    const after = body.slice(n);
    const rest = m ? (after.startsWith(m) ? after.slice(m.length) : null) : after;
    if (rest === null) continue;
    if (!rest.startsWith(' ')) continue;
    if (rest.trim().length === 0) continue;
    return MOONSHOT_PREFIX + rest;
  }
  return null;
}

// isSignOff(line) -- N-7 cosmetic tolerance 3. A sign-off is one short line
// (at most SIGNOFF_MAX_CHARS code points) with no voice glyph and no bracket.
function isSignOff(line) {
  if (codePointLength(line) > SIGNOFF_MAX_CHARS) return false;
  if (line.indexOf('[') !== -1 || line.indexOf(']') !== -1) return false;
  return !hasVoiceGlyph(line);
}

// parseDeclarationLine(rawLine) -- the strict N-3 grammar plus the N-7
// cosmetic tolerances, applied to ONE line. Structural checks are unchanged.
function parseDeclarationLine(rawLine) {
  const line = rawLine.replace(/[ \t\r]+$/, '');

  if (codePointLength(line) > MAX_LINE_CHARS) return NOT_DECLARED; // size guard before the one regex below
  const stripped = unwrapEmphasis(line); // column 0, case-sensitive, no leading whitespace
  if (stripped === null) return NOT_DECLARED;
  const text = stripped;

  if (text.indexOf('[') !== -1 || text.indexOf(']') !== -1) return NOT_DECLARED;

  if (hasVoiceGlyph(text)) return NOT_DECLARED;

  // The one regex in this module, bounded by the MAX_LINE_CHARS guard
  // above (T-359-02): the retired numbered-prose backstop literal.
  if (/type\s+1\s*,\s*2\s*,\s*or\s+3/i.test(text)) return NOT_DECLARED;

  const rest = text.slice(DECLARATION_PREFIX.length);
  const labels = rest.split(DECLARATION_SEPARATOR).map(function (s) { return s.trim(); });

  if (labels.length < MIN_LABELS || labels.length > MAX_LABELS) return NOT_DECLARED;

  // Final label: must be a What-if (strict, lowercase, or marked prefix).
  // Normalize it to the canonical `What if ...` form before the duplicate
  // check so the returned labels never carry the cosmetic slip.
  const moonshot = normalizeMoonshot(labels[labels.length - 1]);
  if (moonshot === null) return NOT_DECLARED;
  labels[labels.length - 1] = moonshot;

  const seen = new Set();
  for (const l of labels) {
    if (!l) return NOT_DECLARED;
    if (l.indexOf('|') !== -1) return NOT_DECLARED;
    if (codePointLength(l) > MAX_LABEL_CHARS) return NOT_DECLARED;
    const key = l.normalize('NFKC').toLowerCase();
    if (seen.has(key)) return NOT_DECLARED;
    seen.add(key);
  }

  const practical = labels.slice(0, -1);
  if (practical.length < MIN_PRACTICAL || practical.length > MAX_PRACTICAL) return NOT_DECLARED;

  // No earlier (practical) label may start with the strict `What if` literal
  // (N-3: the moonshot is always last). The check is the strict one on
  // purpose: every line the strict grammar accepted stays accepted.
  for (const p of practical) {
    if (p.startsWith(MOONSHOT_PREFIX)) return NOT_DECLARED;
  }

  return { declared: true, labels: labels, practical: practical, moonshot: moonshot };
}

/**
 * parseForkDeclaration(outputText) -- the ONE parser for the N-3 declaration
 * grammar, with the N-7 cosmetic tolerances. Returns
 * {declared: true, labels, practical, moonshot} on a valid line, else
 * {declared: false}. Never throws.
 * @param {*} outputText
 * @returns {{declared: boolean, labels?: string[], practical?: string[], moonshot?: string}}
 */
function parseForkDeclaration(outputText) {
  try {
    if (typeof outputText !== 'string' || outputText.length === 0) return NOT_DECLARED;
    if (MARK_GLYPHS === null) return NOT_DECLARED; // fail inert (D-04)

    // The declaration is the last non-empty line (SPEC R3), or the non-empty
    // line just before ONE trailing sign-off line (N-7). Trailing blank
    // lines, trailing whitespace and CRLF endings are all tolerated.
    const lines = outputText.split('\n');
    let i = lines.length - 1;
    while (i >= 0 && lines[i].trim() === '') i -= 1;
    if (i < 0) return NOT_DECLARED;

    const last = lines[i].replace(/[ \t\r]+$/, '');
    if (unwrapEmphasis(last) !== null) return parseDeclarationLine(last);

    // The last line is not a declaration line. Allow exactly one sign-off.
    if (!isSignOff(last)) return NOT_DECLARED;
    let j = i - 1;
    while (j >= 0 && lines[j].trim() === '') j -= 1;
    if (j < 0) return NOT_DECLARED;
    return parseDeclarationLine(lines[j]);
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
