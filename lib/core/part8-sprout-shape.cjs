'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 386 plan 37 (E-SHAPE): the sprout, edge and body shape helper.
 * Debug session: part8-no-shape-test-for-sprouts-and-bodies.
 *
 * Owner principle for Part 8 (2026-11-06): a short specific keyword query for
 * research or for the remote graph may leave the room; a full body of text may
 * not. A word list on ordinary keywords (an author, a company, a month, a
 * place, "runway") is the wrong tool and counts as over-blocking. Shape is the
 * measure: size, sentences, lines, quoted text, and a first-person statement.
 * So this module holds NO list of names, companies, months, places or business
 * words. The only words it knows are grammar words that open a question.
 *
 * Classes:
 *   sprout  a short keyword query: at most SPROUT_MAX_WORDS words, at most 1
 *           sentence, 0 newlines, no quoted span, not a first-person statement
 *   body    BODY_MIN_SENTENCES or more sentences, and nothing else (owner
 *           ruling 35, 2026-11-16, plan 395-13: "a body of text is minimum 3
 *           sentences"). A line break ends a sentence, so 3 or more lines
 *           with words are a body. Word count, line count and a quoted span
 *           do not make a body.
 *   edge    everything between. A quoted span is never a sprout. An edge
 *           that has LONG_EDGE_MIN_WORDS or more words, LONG_EDGE_MIN_NEWLINES
 *           or more newlines, or a quoted span is a long edge (longEdge
 *           true): the size that was a body before ruling 35. The guard
 *           applies the private-claim marker rule to a long edge too.
 *
 * The thresholds are measured on the corpora and written in the RCA
 * .planning/debug/part8-no-shape-test-for-sprouts-and-bodies.md.
 *
 * Pure: Node built-ins only (none are needed), no network, deterministic, never
 * throws. A non-string is a body (the safe class). This module changes no
 * verdict; the guard does not call it yet (plans 386-25, 386-27, 386-33 do).
 */

const SPROUT_MAX_WORDS = 12;
const BODY_MIN_SENTENCES = 3;
const LONG_EDGE_MIN_WORDS = 40;
const LONG_EDGE_MIN_NEWLINES = 2;
const QUOTE_MIN_WORDS = 4;

const WORD_TOKEN = /[\p{L}\p{N}]/u;
// Sentence rule (plan 395-13). A sentence ends at a token that ends with . ! or
// ? (closing quotes or brackets may follow) when the next token starts with a
// letter (an opening quote or bracket may come first). A line break also ends
// a sentence. A last sentence with no end mark still counts. A sentence counts
// only when it holds a letter, so a list marker such as "1." or "-" is not a
// sentence of its own.
// Plan 395-13 review CR-05: the abbreviation rule is narrow and fails closed
// (an over-count only refuses a question; an under-count sends a body). A full
// stop after a word of ABBREVIATIONS or a dotted abbreviation (e.g. U.S.) does
// not end a sentence only when the next word starts with a lower-case letter
// and the text uses sentence case (its first letter is a capital). A full stop
// after a title (Dr. Mr. Prof.) does not end a sentence before a capital word
// that is not a common sentence opener. A single-letter initial (J. Doe) does
// not end a sentence only before a capital word that is not a common sentence
// opener, when the word before the initial is a capital word, an initial, a
// name bridge word (of, by, from) or nothing. "no." is not an abbreviation.
const LETTER = /\p{L}/u;
const LETTER_GLOBAL = /\p{L}/u;
// Plan 395-13 review CR-06: one line-break set for the count, the cut and
// countNewlines: CR LF, LF, CR, NEL (U+0085), LINE SEPARATOR (U+2028) and
// PARAGRAPH SEPARATOR (U+2029).
const LINE_BREAK = /\r\n|[\n\r\u0085\u2028\u2029]/;
// Plan 395-13 review WR-03: the sentence split is a manual left-to-right scan
// (countLineSentences), not a look-behind pattern. Each character is read a
// bounded number of times, so the time is linear in the length of the text.
// Plan 395-13 review CR-06: the end marks. A full stop, ! and ? end a
// sentence before white space, or with no space before a word of 2 or more
// letters or a digit (audit.the, audit.40) when the word before the mark has 2
// or more letters (so e.g. and U.S. do not split inside). A decimal number
// (2.0) never splits. The ideographic and full-width marks, the ellipsis
// character and the other script marks end a sentence with or without a
// space. A semicolon before white space and a word, and a run of 2 or more
// tabs, also end a sentence (fail closed: an over-count only refuses a
// question; an under-count sends a body).
const END_MARKS = new Set(['.', '!', '?']);
const STRONG_MARKS = new Set(['\u3002', '\uFF0E', '\uFF01', '\uFF1F', '\u2026', '\u203C', '\u2047', '\u2048', '\u2049', '\u061F', '\u06D4', '\u0964', '\u0965', '\uFF61']);
const CLOSERS = new Set(['"', "'", '\u201D', '\u2019', ')', ']', '}', '\u00BB', '\u300D', '\u300F', '\uFF09', '\uFF02']);
const OPENERS = new Set(['"', "'", '\u201C', '\u2018', '\u201E', '(', '[', '{', '\u00AB', '\u300C', '\u300E', '\uFF08', '\uFF02', '*', '_', '`', '-', '#']);
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
const DIGIT = /\p{Nd}/u;
const DOTTED_ABBREVIATION = /^(?:\p{L}\.){2,}$/u;
const INITIAL = /^\p{L}\.$/u;
const ABBREVIATIONS = new Set(['etc.', 'vs.', 'cf.', 'approx.', 'incl.', 'al.', 'fig.', 'jr.', 'sr.']);
const TITLES = new Set(['dr.', 'mr.', 'mrs.', 'ms.', 'st.', 'prof.']);
const NAME_BRIDGES = new Set(['of', 'by', 'from', 'with', 'to', 'and', 'for', 'at', 'per', 'via']);
const COMMON_OPENERS = new Set(['the', 'a', 'an', 'it', 'its', 'we', 'i', 'they', 'he', 'she', 'you', 'this', 'that',
  'these', 'those', 'there', 'then', 'our', 'my', 'your', 'their', 'his', 'her', 'which', 'what', 'how', 'why', 'when',
  'where', 'who', 'is', 'are', 'was', 'were', 'do', 'does', 'did', 'but', 'and', 'so', 'if', 'in', 'on', 'at', 'for',
  'to', 'of', 'no', 'yes', 'not', 'all', 'some', 'each', 'after', 'before', 'now', 'also', 'can', 'will', 'should']);
const UPPER_START = /^\p{Lu}/u;
const LOWER_START = /^\p{Ll}/u;
// A question opens with one of these grammar words, or ends with a question mark.
const QUESTION_OPENER = /^(?:what|which|who|whom|whose|when|where|why|how|is|are|do|does|did|can|could|should|would|will|explain|define|compare|describe)\b/i;
// my, our, we or I at the start of a clause, followed by a word.
const FIRST_PERSON_CLAUSE = /(?:^|[,;:.!]\s+|\b(?:and|but|so|because|that|when|while)\s+)(?:i|we|my|our)\b\s*[\p{L}']/iu;

function countWords(text) {
  const tokens = text.split(/\s+/);
  let n = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    if (WORD_TOKEN.test(tokens[i])) n += 1;
  }
  return n;
}

function stripMarks(token) {
  return token.replace(/^["'\u201C\u2018(\[]+/u, '').replace(/["'\u201D\u2019)\]]+$/u, '');
}

// token: the word before the break, with its marks. next: the next word (at
// most 24 characters). prev: the word before token, or null. sentenceCase:
// the first letter of the text is a capital.
function isAbbreviation(token, next, prev, sentenceCase) {
  const core = stripMarks(token).toLowerCase();
  const nextLower = LOWER_START.test(next);
  const nextUpper = UPPER_START.test(next);
  const nextWord = next.replace(/[^\p{L}]+$/u, '').toLowerCase();
  if (ABBREVIATIONS.has(core) || DOTTED_ABBREVIATION.test(core)) return nextLower && sentenceCase;
  if (TITLES.has(core)) return (nextUpper && !COMMON_OPENERS.has(nextWord)) || (nextLower && sentenceCase);
  if (INITIAL.test(core)) {
    if (!nextUpper || COMMON_OPENERS.has(nextWord)) return false;
    if (prev === null) return true;
    const p = stripMarks(prev);
    return UPPER_START.test(p) || INITIAL.test(p) || NAME_BRIDGES.has(p.toLowerCase());
  }
  return false;
}

function isSpaceChar(ch) {
  return ch === ' ' || ch === '\t' || ch === '\f' || ch === '\v' || ch === '\u00A0' || (ch >= '\u2000' && ch <= '\u200A') || ch === '\u3000';
}

// One line -> the number of sentences that hold a letter. A break is a run of
// end marks and closers, then white space (or none, see CR-06 above), then
// optional openers, then a letter or a digit. A break after an abbreviation
// does not count. At most 1 no-space break counts in each token, and a token
// that holds / @ : or a backslash (a link or a path) has no no-space break.
function countLineSentences(line, sentenceCase) {
  const len = line.length;
  let n = 0;
  let hasLetter = false;
  let tokStart = 0;
  let prevStart = -1;
  let prevEnd = -1;
  let tokNoSpaceBreak = false;
  let tokLink = -1;
  let letterRun = 0;
  let tabRun = 0;
  let i = 0;
  const brk = function () { if (hasLetter) { n += 1; hasLetter = false; } };
  while (i < len) {
    const ch = line[i];
    if (isSpaceChar(ch)) {
      tabRun = ch === '\t' ? tabRun + 1 : 0;
      if (tabRun >= 2 && i + 1 < len && LETTER_OR_DIGIT.test(line[i + 1])) brk();
      if (i > tokStart) { prevStart = tokStart; prevEnd = i; }
      i += 1; tokStart = i; tokNoSpaceBreak = false; tokLink = -1; letterRun = 0; continue;
    }
    tabRun = 0;
    if (LETTER.test(ch)) { hasLetter = true; letterRun += 1; i += 1; continue; }
    const isEnd = END_MARKS.has(ch);
    const isStrong = STRONG_MARKS.has(ch);
    const isSemi = ch === ';';
    if (!isEnd && !isStrong && !isSemi) { letterRun = 0; i += 1; continue; }
    const before = letterRun;
    letterRun = 0;
    let strong = isStrong;
    let closer = false;
    let j = i + 1;
    while (j < len && (END_MARKS.has(line[j]) || STRONG_MARKS.has(line[j]) || CLOSERS.has(line[j]))) {
      if (STRONG_MARKS.has(line[j])) strong = true;
      else if (CLOSERS.has(line[j])) closer = true;
      j += 1;
    }
    let k = j;
    while (k < len && isSpaceChar(line[k])) k += 1;
    let m = k;
    while (m < len && OPENERS.has(line[m])) m += 1;
    const next = m < len ? line[m] : '';
    if (next && LETTER_OR_DIGIT.test(next)) {
      const spaced = k > j;
      if (strong) {
        brk();
      } else if (isSemi) {
        if (spaced && LETTER.test(next)) brk();
      } else if (spaced) {
        let e = m;
        while (e < len && e - m < 24 && !isSpaceChar(line[e])) e += 1;
        const prev = prevStart >= 0 ? line.slice(prevStart, prevEnd) : null;
        if (!isAbbreviation(line.slice(tokStart, j), line.slice(m, e), prev, sentenceCase)) brk();
      } else if (!closer && m === k && !tokNoSpaceBreak && before >= 2) {
        // No space after the mark: never a decimal, never inside a link or a path.
        const decimal = DIGIT.test(line[i - 1]) && DIGIT.test(next);
        let after = 0;
        while (after < 2 && k + after < len && LETTER.test(line[k + after])) after += 1;
        if (!decimal && (DIGIT.test(next) || after >= 2)) {
          if (tokLink === -1) tokLink = tokenIsLink(line, tokStart) ? 1 : 0;
          if (tokLink === 0) { brk(); tokNoSpaceBreak = true; }
        }
      }
    }
    i = j;
  }
  if (hasLetter) n += 1;
  return n;
}

// A token that holds / @ : or a backslash is a link, a path or an address: it
// has no no-space break. The scan reads the token once (to the next white
// space), and the caller keeps the answer for the whole token.
function tokenIsLink(line, start) {
  for (let p = start; p < line.length; p += 1) {
    const c = line[p];
    if (isSpaceChar(c)) return false;
    if (c === '/' || c === '@' || c === ':' || c === '\\') return true;
  }
  return false;
}

// Plan 395-13 review CR-01: the paste note is a sentence boundary that is not
// a sentence of its own. The cut joins the lines around a note line with a
// space; without this rule a body of line-sentences with a block quote, a
// fence or a quoted line between them became 1 sentence and went to Theo.
// The rule holds for every string, so the cut input that the hook gives back
// for a resend is counted the same way.
function countSentences(text) {
  if (!text) return 0;
  if (text.indexOf(PASTE_NOTE) !== -1) text = text.split(PASTE_NOTE).join('\n');
  const first = LETTER_GLOBAL.exec(text);
  const sentenceCase = first !== null && UPPER_START.test(first[0]);
  const lines = text.split(LINE_BREAK);
  let n = 0;
  for (let l = 0; l < lines.length; l += 1) n += countLineSentences(lines[l], sentenceCase);
  return n;
}

function countNewlines(text) {
  let n = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (c === 10 || c === 0x85 || c === 0x2028 || c === 0x2029) n += 1;
    else if (c === 13 && text.charCodeAt(i + 1) !== 10) n += 1;
  }
  return n;
}

// Plan 395-13 review CR-03: a string holds a quoted span when the cut finds
// a span to cut, or when the quote marks cannot be paired cleanly (then the
// cut fails closed). hasQuotedSpan and cutPastedText use the same parse.
function hasQuotedSpan(text) {
  const cut = cutPastedText(text);
  return cut.count > 0 || cut.ambiguous === true;
}

// Plan 395-13 (owner ruling 37, 2026-11-16, "cut the paste, send the rest").
// cutPastedText(text) -> { text, count, ambiguous }. It puts PASTE_NOTE in
// place of each pasted span: a fenced code block (CR-02), a run of block-quote
// lines (a line that starts with >), and a quoted span that holds
// QUOTE_MIN_WORDS or more words (CR-03). A line that holds only the note joins
// the lines around it with a space, so the note never counts as a sentence of
// its own; countSentences reads each note as a sentence boundary (CR-01), so
// the sentences on each side of the note still count. Runs of spaces and tabs
// become 1 space. count is the number of spans cut; when it is 0 the text
// comes back unchanged. ambiguous is true when the quote marks cannot be
// paired cleanly; the guard then cuts nothing and keeps the block. Linear
// time: each pass is a left-to-right scan or a line split.
const PASTE_NOTE = '[pasted text kept local]';
const LINE_SPLIT = LINE_BREAK;
const BLOCK_QUOTE_LINE = /^[ \t]*>/;

// Plan 395-13 review CR-02: a fence is a run of 3 or more backticks or 3 or
// more tildes (CommonMark). It closes only at a later run of the same mark
// that is at least as long as the opening run, so a 6-mark fence does not
// close on its own marks and a 4-mark fence does not close on an inner 3-mark
// fence. A fence with no close is cut to the end of the text. Linear: the
// search for the close starts where the opening run ends, and the scan goes
// on from the close.
function cutFences(text, counter) {
  const len = text.length;
  let out = '';
  let at = 0;
  let i = 0;
  while (i < len) {
    const ch = text[i];
    if (ch !== '`' && ch !== '~') { i += 1; continue; }
    let j = i;
    while (j < len && text[j] === ch) j += 1;
    const run = j - i;
    if (run < 3) { i = j; continue; }
    let close = -1;
    let k = j;
    while (k < len) {
      if (text[k] !== ch) { k += 1; continue; }
      let e = k;
      while (e < len && text[e] === ch) e += 1;
      if (e - k >= run) { close = e; break; }
      k = e;
    }
    out += text.slice(at, i) + ' ' + PASTE_NOTE + ' ';
    counter.count += 1;
    at = close === -1 ? len : close;
    i = at;
  }
  return out + text.slice(at);
}

// Plan 395-13 review CR-03: the quote parser. Each quote mark gets a role from
// the characters on each side of it (CommonMark flanking): an opener has no
// white space after it, a closer has no white space before it. Openers go on a
// stack, so a nested quote ("he said "no deal" then") stays inside the outer
// span, and the outer span is cut whole. A straight double quote between 2
// letters or digits is not a quote (a Hebrew gershayim, 5"x7). The pairing is
// ambiguous, and the cut fails closed, when a closer has no opener (an inch
// mark: 5" screen), an opener is never closed, or a mark has white space on
// both sides. The parse stops at the first ambiguity.
const DOUBLE_EITHER = new Set(['"', '\u201C', '\u201D']);
const DOUBLE_OPEN = new Set([]);
const DOUBLE_CLOSE = new Set([]);
const OPEN_PUNCT = new Set(['(', '[', '{', '<', '-', '/', '\u00AB', '\u2018', '\u201C', '\u201E']);
const ALNUM = /[\p{L}\p{N}]/u;

function isBlankChar(c) {
  return c === undefined || isSpaceChar(c) || c === '\n' || c === '\r' || c === '\u0085' || c === '\u2028' || c === '\u2029';
}

// -> 'open' | 'close' | 'skip' | 'ambiguous'
function doubleRole(text, i) {
  const ch = text[i];
  if (DOUBLE_OPEN.has(ch)) return 'open';
  if (DOUBLE_CLOSE.has(ch)) return 'close';
  const prev = i > 0 ? text[i - 1] : undefined;
  const next = i + 1 < text.length ? text[i + 1] : undefined;
  const pa = prev !== undefined && ALNUM.test(prev);
  const na = next !== undefined && ALNUM.test(next);
  if (pa && na) return ch === '"' ? 'skip' : 'ambiguous';
  const pw = isBlankChar(prev);
  const nw = isBlankChar(next);
  if (pw && nw) return 'ambiguous';
  if (pw) return 'open';
  if (nw) return 'close';
  if (pa) return 'close';
  if (na) return 'open';
  return OPEN_PUNCT.has(prev) ? 'open' : 'close';
}

// -> { spans: [[start, end]], ambiguous }
function scanDoubleQuotes(text) {
  const spans = [];
  const stack = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (!DOUBLE_EITHER.has(ch) && !DOUBLE_OPEN.has(ch) && !DOUBLE_CLOSE.has(ch)) continue;
    const role = doubleRole(text, i);
    if (role === 'skip') continue;
    if (role === 'ambiguous') return { spans: spans, ambiguous: true };
    if (role === 'open') { stack.push(i); continue; }
    if (stack.length === 0) return { spans: spans, ambiguous: true };
    const start = stack.pop();
    if (stack.length === 0) spans.push([start, i + 1]);
  }
  return { spans: spans, ambiguous: stack.length > 0 };
}

function cutQuotePairs(text, counter) {
  const scan = scanDoubleQuotes(text);
  if (scan.ambiguous) { counter.ambiguous = true; return text; }
  let out = '';
  let at = 0;
  for (let s = 0; s < scan.spans.length; s += 1) {
    const span = scan.spans[s];
    if (countWords(text.slice(span[0] + 1, span[1] - 1)) < QUOTE_MIN_WORDS) continue;
    out += text.slice(at, span[0]) + PASTE_NOTE;
    at = span[1];
    counter.count += 1;
  }
  return out + text.slice(at);
}

function cutQuoteLines(text, counter) {
  const lines = text.split(LINE_SPLIT);
  const kept = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!BLOCK_QUOTE_LINE.test(lines[i])) { kept.push(lines[i]); continue; }
    if (kept.length > 0 && kept[kept.length - 1] === PASTE_NOTE) continue;
    kept.push(PASTE_NOTE);
    counter.count += 1;
  }
  return kept.join('\n');
}

function joinNoteLines(text) {
  const kept = text.split(LINE_SPLIT);
  let out = '';
  for (let i = 0; i < kept.length; i += 1) {
    if (i > 0) out += (kept[i - 1].trim() === PASTE_NOTE || kept[i].trim() === PASTE_NOTE) ? ' ' : '\n';
    out += kept[i];
  }
  return out;
}

function cutPastedText(value) {
  if (typeof value !== 'string') return { text: '', count: 0, ambiguous: false };
  const counter = { count: 0, ambiguous: false };
  const out = joinNoteLines(cutQuotePairs(cutQuoteLines(cutFences(value, counter), counter), counter));
  if (counter.count === 0) return { text: value, count: 0, ambiguous: counter.ambiguous };
  return { text: out.replace(/[ \t]{2,}/g, ' ').trim(), count: counter.count, ambiguous: counter.ambiguous };
}

function isQuestion(text) {
  return /\?\s*$/.test(text) || QUESTION_OPENER.test(text);
}

function isFirstPersonStatement(text) {
  if (isQuestion(text)) return false;
  return FIRST_PERSON_CLAUSE.test(text);
}

function classifyShape(value) {
  if (typeof value !== 'string') {
    return { kind: 'body', words: 0, sentences: 0, lines: 0, quoted: false, firstPersonStatement: false, longEdge: false };
  }
  try {
    const text = value.trim();
    const words = countWords(text);
    const sentences = countSentences(text);
    const lines = countNewlines(text);
    const quoted = hasQuotedSpan(text);
    const firstPersonStatement = isFirstPersonStatement(text);

    let kind = 'edge';
    if (sentences >= BODY_MIN_SENTENCES) {
      kind = 'body';
    } else if (words <= SPROUT_MAX_WORDS && sentences <= 1 && lines === 0 && !quoted && !firstPersonStatement) {
      kind = 'sprout';
    }
    const longEdge = kind === 'edge' && (words >= LONG_EDGE_MIN_WORDS || lines >= LONG_EDGE_MIN_NEWLINES || quoted);
    return { kind, words, sentences, lines, quoted, firstPersonStatement, longEdge };
  } catch (_e) {
    return { kind: 'body', words: 0, sentences: 0, lines: 0, quoted: false, firstPersonStatement: false, longEdge: false };
  }
}

module.exports = {
  classifyShape,
  SPROUT_MAX_WORDS,
  BODY_MIN_SENTENCES,
  LONG_EDGE_MIN_WORDS,
  LONG_EDGE_MIN_NEWLINES,
  cutPastedText,
  PASTE_NOTE,
};
