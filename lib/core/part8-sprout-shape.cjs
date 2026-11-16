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
 *   body    BODY_MIN_SENTENCES or more sentences (owner ruling 35,
 *           2026-11-16, plan 395-13: "a body of text is minimum 3
 *           sentences"), or a text longer than BODY_MAX_CHARS characters
 *           (owner ruling 2026-11-16, review WR-04). A line break ends a
 *           sentence, so 3 or more lines with words are a body. Word count,
 *           line count and a quoted span do not make a body.
 *   edge    everything between. A quoted span is never a sprout. An edge
 *           that has LONG_EDGE_MIN_WORDS or more words, LONG_EDGE_MIN_NEWLINES
 *           or more newlines, or a quoted span is a long edge (longEdge
 *           true): the size that was a body before ruling 35. The guard
 *           applies the private-claim marker rule to a long edge too. The
 *           rest of a paste cut (a text with PASTE_NOTE) is a long edge.
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
const BODY_MAX_CHARS = 4000;
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
// and the text uses sentence case (its first letter is a capital). A title
// (Dr. Mr. Prof.) is one of these abbreviations (round 3 R3-WR-01), so it
// ends a sentence before a capital word. A single-letter initial ends a
// sentence unless it is in a run of initials (J. R. R. Tolkien); round 2
// NEW-WR-01. "no." is not an abbreviation.
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
// A file extension or a domain ending after a full stop with no space
// (SKILL.md, node.js, example.com) is not a sentence end when the word ends
// there. "audit.the" is not on the list, so it still ends a sentence.
const NAME_ENDINGS = new Set(['md', 'mdx', 'js', 'cjs', 'mjs', 'ts', 'tsx', 'jsx', 'json', 'jsonl', 'txt', 'py', 'ipynb',
  'html', 'htm', 'css', 'yml', 'yaml', 'toml', 'csv', 'tsv', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'png',
  'jpg', 'jpeg', 'gif', 'svg', 'webp', 'sh', 'bash', 'zsh', 'rb', 'go', 'rs', 'java', 'kt', 'swift', 'cpp', 'hpp', 'sql',
  'db', 'xml', 'zip', 'tar', 'gz', 'log', 'env', 'ini', 'cfg', 'lock', 'com', 'org', 'net', 'io', 'ai', 'dev', 'app',
  'co', 'edu', 'gov', 'uk', 'il', 'de', 'fr', 'eu', 'us', 'ca', 'au', 'in', 'jp', 'cn', 'ru', 'me', 'info', 'biz']);
const DIGIT = /\p{Nd}/u;
const DOTTED_ABBREVIATION = /^(?:\p{L}\.){2,}$/u;
const INITIAL = /^\p{L}\.$/u;
// Round 3 R3-WR-01: the titles (dr. mr. mrs. ms. st. prof.) follow the same
// rule as the other abbreviations: before a capital word they end a sentence
// (fail closed; the proper-name rule decides "Dr. Smith").
const ABBREVIATIONS = new Set(['etc.', 'vs.', 'cf.', 'approx.', 'incl.', 'al.', 'fig.', 'jr.', 'sr.', 'dr.', 'mr.', 'mrs.', 'ms.', 'st.', 'prof.']);
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
  if (INITIAL.test(core)) {
    // Round 2 NEW-WR-01 (fail closed): a single initial ends a sentence
    // ("the head of B. Revenue fell", "J. Doe" counts 2). Only a run of
    // initials stays open: the next word is an initial (J. R.), or the word
    // before is an initial and the next word is a capital word that is not
    // a common opener (R. Tolkien).
    if (INITIAL.test(stripMarks(next))) return true;
    if (prev === null || !INITIAL.test(stripMarks(prev))) return false;
    return nextUpper && !COMMON_OPENERS.has(nextWord);
  }
  return false;
}

function isSpaceChar(ch) {
  return ch === ' ' || ch === '\t' || ch === '\f' || ch === '\v' || ch === '\u00A0' || (ch >= '\u2000' && ch <= '\u200A') || ch === '\u3000';
}

// One line -> the number of sentences that hold a letter. A break is a run of
// end marks and closers, then white space (or none, see CR-06 above), then
// optional openers, then a letter or a digit. A break after an abbreviation
// does not count. A full stop with no space before a lower-case word breaks at
// most 1 time in each token (a file or a domain name); ! and ? and a full stop
// before a capital break every time. A token that holds / @ : or a backslash
// (a link or a path) has no no-space break.
function countLineSentences(line, sentenceCase, stats) {
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
        if (spaced && LETTER.test(next) && hasLetter) { brk(); if (stats) stats.semicolons += 1; }
      } else if (spaced) {
        let e = m;
        while (e < len && e - m < 24 && !isSpaceChar(line[e])) e += 1;
        const prev = prevStart >= 0 ? line.slice(prevStart, prevEnd) : null;
        if (!isAbbreviation(line.slice(tokStart, j), line.slice(m, e), prev, sentenceCase)) brk();
      } else if (!closer && m === k && before >= 2 && (ch !== '.' || !tokNoSpaceBreak || UPPER_START.test(next))) {
        // The 1-break cap of a token holds only for a full stop before a
        // lower-case word (a file or a domain name). ! and ? and a full stop
        // before a capital break every time (coordinator fuzz: Alpha!Beta!Gamma).
        // No space after the mark: never a decimal, never inside a link or a path.
        const decimal = DIGIT.test(line[i - 1]) && DIGIT.test(next);
        let after = 0;
        while (after < 2 && k + after < len && LETTER.test(line[k + after])) after += 1;
        let w = k;
        while (w < len && w - k <= 6 && LETTER.test(line[w])) w += 1;
        // Round 2 NEW-WR-02: only a lower-case ending is a name ending
        // (SKILL.md, example.com); "audit.In short" still ends a sentence.
        const nameEnding = ch === '.' && LOWER_START.test(next) && (w >= len || !LETTER.test(line[w])) &&
          NAME_ENDINGS.has(line.slice(k, w));
        if (!decimal && !nameEnding && (DIGIT.test(next) || after >= 2)) {
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

// Plan 395-13 review CR-01: the cut keeps the line structure (a pasted line
// becomes a line that holds only the note), so the lines around a note stay
// separate sentences. The note itself is not a sentence: its words do not
// count. The same count holds for the cut input that the hook gives back for
// a resend.
// stats (optional) gets semicolons: the number of breaks at a semicolon. The
// body rule counts them (fail closed); the sprout rule does not (a short
// keyword query with a semicolon stays a sprout, as before plan 395-13).
function countSentences(text, stats) {
  if (!text) return 0;
  if (text.indexOf(PASTE_NOTE) !== -1) text = text.split(PASTE_NOTE).join(' ');
  const first = LETTER_GLOBAL.exec(text);
  const sentenceCase = first !== null && UPPER_START.test(first[0]);
  const lines = text.split(LINE_BREAK);
  let n = 0;
  for (let l = 0; l < lines.length; l += 1) n += countLineSentences(lines[l], sentenceCase, stats);
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
// QUOTE_MIN_WORDS or more words (CR-03). The cut never joins lines (CR-01): a
// pasted line or block becomes a line that holds only the note, and a span
// inside a line stays inside that line. countSentences does not count the
// words of the note. A span that holds line breaks becomes the note and the
// same number of LF (NEW-BL-02). Each line has its runs of spaces and tabs
// made 1 space and is trimmed; every line break becomes LF; no line is
// dropped, so the line count never goes down. count is the number of spans cut; when it is 0 the text
// comes back unchanged. ambiguous is true when the quote marks cannot be
// paired cleanly; the guard then cuts nothing and keeps the block. spans
// holds the first SPAN_KEEP_MAX cut spans (IN-03). Linear time: each pass is
// a left-to-right scan or a line split.
const PASTE_NOTE = '[pasted text kept local]';
// Plan 395-13 review round 2 NEW-BL-02: a cut span that holds line breaks is
// replaced by the note and the same number of line breaks, so the cut never
// joins lines and never lowers the line count.
const LINE_BREAK_ALL = /\r\n|[\n\r\u0085\u2028\u2029]/g;
function breaksIn(str) {
  const m = str.match(LINE_BREAK_ALL);
  return m ? m.length : 0;
}
// Plan 395-13 review round 2 NEW-BL-01: US punctuation puts the end mark of
// a sentence inside the quote ("cut the budget by half." The lead ...). The
// note keeps the end marks that close the span content, so the cut text
// counts the same sentences as the text around the span. inner: the span
// content without its own quote or fence marks.
function endMarksOf(inner) {
  let e = inner.length;
  while (e > 0 && (isBlankChar(inner[e - 1]) || CLOSERS.has(inner[e - 1]))) e -= 1;
  let b = e;
  while (b > 0 && (END_MARKS.has(inner[b - 1]) || STRONG_MARKS.has(inner[b - 1]))) b -= 1;
  return inner.slice(b, e);
}
// Round 3 R3-WR-02: a span that holds a sentence end inside it (an end mark,
// white space, then a letter or a digit) gives the note 1 end mark when its
// content does not end with one, so the cut never hides every sentence end
// of the span. The pattern has 1 end mark as its first item, so each try is
// bounded by the run of closers and white space after that mark.
const MID_SPAN_END = /[.!?\u3002\uFF0E\uFF01\uFF1F\u2026\u203C\u2047-\u2049\u061F\u06D4\u0964\u0965\uFF61]["'\u201D\u2019)\]]*\s+["'\u201C\u2018(\[]*[\p{L}\p{N}]/u;
function noteFor(span, inner) {
  const content = typeof inner === 'string' ? inner : span;
  let marks = endMarksOf(content);
  if (marks === '' && MID_SPAN_END.test(content)) marks = '.';
  return PASTE_NOTE + marks + '\n'.repeat(breaksIn(span));
}
const LINE_SPLIT = LINE_BREAK;
const BLOCK_QUOTE_LINE = /^[ \t]*>/;
// Plan 395-13 review WR-05: a line indented by 4 or more spaces or a tab is
// indented code, cut the same way as a block-quote line.
const INDENTED_CODE_LINE = /^(?: {4,}|\t)[ \t]*\S/;

// Plan 395-13 review CR-02: a fence is a run of 3 or more backticks or 3 or
// more tildes (CommonMark). It closes only at a later run of the same mark
// that is at least as long as the opening run, so a 6-mark fence does not
// close on its own marks and a 4-mark fence does not close on an inner 3-mark
// fence (round 2 NEW-WR-03 below: the close of a fence at a line start is a
// run on its own line; a run that opens inside a line closes at the same
// length). A fence with no close is cut to the end of the text. Linear: the
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
    if (run < 3 && ch === '~') { i = j; continue; }
    if (run < 3) {
      // Plan 395-13 review WR-05: an inline code span of 1 or 2 backticks
      // closes at a run of exactly the same length. A span of QUOTE_MIN_WORDS
      // or more words, or a span that looks like code (brackets, = or ;, a dot
      // or an underscore inside a word, camelCase), is cut; a short name such
      // as `SWOT` stays. An unclosed span fails closed (the parse stops here).
      let close = -1;
      let k = j;
      while (k < len) {
        if (text[k] !== '`') { k += 1; continue; }
        let e = k;
        while (e < len && text[e] === '`') e += 1;
        if (e - k === run) { close = k; break; }
        k = e;
      }
      if (close === -1) { counter.ambiguous = true; break; }
      const inner = text.slice(j, close);
      if (countWords(inner) >= QUOTE_MIN_WORDS || CODE_LIKE.test(inner)) {
        out += text.slice(at, i) + ' ' + noteFor(inner, inner) + ' ';
        counter.count += 1;
        keepSpan(counter, inner);
        at = close + run;
      }
      i = close + run;
      continue;
    }
    // Round 2 NEW-WR-03 (CommonMark): a fence that opens at the start of a
    // line closes only at a run of the same mark, at least as long, that
    // stands alone on its line (spaces may come before and after it). A run
    // inside a line does not close it. A run that opens inside a line is an
    // inline code span: it closes only at a run of exactly the same length.
    let b = i;
    while (b > 0 && (text[b - 1] === ' ' || text[b - 1] === '\t')) b -= 1;
    const blockFence = b === 0 || isLineBreakChar(text[b - 1]);
    let close = -1;
    let k = j;
    let lineStart = false;
    while (k < len) {
      const c = text[k];
      if (isLineBreakChar(c)) { lineStart = true; k += 1; continue; }
      if (c !== ch) { if (c !== ' ' && c !== '\t') lineStart = false; k += 1; continue; }
      let e = k;
      while (e < len && text[e] === ch) e += 1;
      if (blockFence) {
        let t = e;
        while (t < len && (text[t] === ' ' || text[t] === '\t')) t += 1;
        if (lineStart && e - k >= run && (t >= len || isLineBreakChar(text[t]))) { close = e; break; }
      } else if (e - k === run) {
        close = e;
        break;
      }
      lineStart = false;
      k = e;
    }
    out += text.slice(at, i) + ' ' + noteFor(text.slice(j, close === -1 ? len : close), text.slice(j, close === -1 ? len : close - run)) + ' ';
    counter.count += 1;
    keepSpan(counter, text.slice(j, close === -1 ? len : close));
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
// Plan 395-13 review WR-05: the double family also holds the low quote
// (U+201E), the reversed quote (U+201F), the full-width quote (U+FF02), the
// guillemets and the CJK corner brackets. A guillemet or a corner bracket has a
// fixed role (French text puts a space inside a guillemet).
const DOUBLE_EITHER = new Set(['"', '\u201C', '\u201D', '\u201F', '\uFF02']);
const DOUBLE_OPEN = new Set(['\u201E', '\u00AB', '\u300C', '\u300E', '\u301D']);
const DOUBLE_CLOSE = new Set(['\u00BB', '\u300D', '\u300F', '\u301E', '\u301F']);
// The single family: straight and typographic single quotes and the single
// guillemets. An apostrophe (a mark between 2 letters or digits, don't,
// board\u2019s), an elision ('90s, 'til, 'n) and a closer with no opener (a
// plural possessive: users') are not quotes. An opener that is never closed
// fails closed.
const SINGLE_EITHER = new Set(["'", '\u2018', '\u2019', '\u201B']);
const SINGLE_OPEN = new Set(['\u201A', '\u2039']);
const SINGLE_CLOSE = new Set(['\u203A']);
const ELISIONS = new Set(['em', 'til', 'tis', 'twas', 'n', 'cause', 'round', 'bout', 's']);
const OPEN_PUNCT = new Set(['(', '[', '{', '<', '-', '/', '\u00AB', '\u2018', '\u201C', '\u201E']);
const ALNUM = /[\p{L}\p{N}]/u;
const CODE_LIKE = /[(){};=<>[\]]|[\p{L}\p{N}][._][\p{L}\p{N}]|\p{Ll}\p{Lu}/u;

function isLineBreakChar(c) {
  return c === '\n' || c === '\r' || c === '\u0085' || c === '\u2028' || c === '\u2029';
}

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

// -> 'open' | 'close' | 'skip'
function singleRole(text, i) {
  const ch = text[i];
  if (SINGLE_OPEN.has(ch)) return 'open';
  if (SINGLE_CLOSE.has(ch)) return 'close';
  const prev = i > 0 ? text[i - 1] : undefined;
  const next = i + 1 < text.length ? text[i + 1] : undefined;
  const pa = prev !== undefined && ALNUM.test(prev);
  const na = next !== undefined && ALNUM.test(next);
  if (pa && na) return 'skip';
  const pw = isBlankChar(prev);
  const nw = isBlankChar(next);
  if (pw && nw) return 'skip';
  if (pw || (!pa && na)) {
    if (next !== undefined && DIGIT.test(next)) return 'skip';
    let e = i + 1;
    while (e < text.length && e - i <= 6 && LETTER.test(text[e])) e += 1;
    if (ELISIONS.has(text.slice(i + 1, e).toLowerCase()) && (e >= text.length || !LETTER.test(text[e]))) return 'skip';
    return 'open';
  }
  if (nw || pa) return 'close';
  return OPEN_PUNCT.has(prev) ? 'open' : 'close';
}

// -> { spans: [[start, end]], ambiguous }
function scanQuotes(text, single) {
  const spans = [];
  const stack = [];
  const either = single ? SINGLE_EITHER : DOUBLE_EITHER;
  const opens = single ? SINGLE_OPEN : DOUBLE_OPEN;
  const closes = single ? SINGLE_CLOSE : DOUBLE_CLOSE;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (!either.has(ch) && !opens.has(ch) && !closes.has(ch)) continue;
    const role = single ? singleRole(text, i) : doubleRole(text, i);
    if (role === 'skip') continue;
    if (role === 'ambiguous') return { spans: spans, ambiguous: true };
    if (role === 'open') { stack.push(i); continue; }
    if (stack.length === 0) {
      if (single) continue;
      return { spans: spans, ambiguous: true };
    }
    const start = stack.pop();
    if (stack.length === 0) spans.push([start, i + 1]);
  }
  return { spans: spans, ambiguous: stack.length > 0 };
}

function cutQuoteFamily(text, counter, single) {
  const scan = scanQuotes(text, single);
  if (scan.ambiguous) { counter.ambiguous = true; return text; }
  let out = '';
  let at = 0;
  for (let s = 0; s < scan.spans.length; s += 1) {
    const span = scan.spans[s];
    if (countWords(text.slice(span[0] + 1, span[1] - 1)) < QUOTE_MIN_WORDS) continue;
    out += text.slice(at, span[0]) + noteFor(text.slice(span[0], span[1]), text.slice(span[0] + 1, span[1] - 1));
    at = span[1];
    counter.count += 1;
    keepSpan(counter, text.slice(span[0] + 1, span[1] - 1));
  }
  return out + text.slice(at);
}

function cutQuotePairs(text, counter) {
  return cutQuoteFamily(cutQuoteFamily(text, counter, false), counter, true);
}

// Plan 395-13 review WR-05: an HTML <pre> or <code> element is cut from the
// opening tag to the closing tag, or to the end of the text when it is not
// closed. The tag pattern stops at the next < or >, so the scan stays linear.
const HTML_CODE_OPEN = /<(pre|code)\b[^<>]*>/gi;

function cutHtmlCode(text, counter) {
  let out = '';
  let at = 0;
  HTML_CODE_OPEN.lastIndex = 0;
  let m;
  while ((m = HTML_CODE_OPEN.exec(text)) !== null) {
    const closeRe = new RegExp('</' + m[1] + '\\s*>', 'gi');
    closeRe.lastIndex = HTML_CODE_OPEN.lastIndex;
    const c = closeRe.exec(text);
    out += text.slice(at, m.index) + ' ' + noteFor(text.slice(m.index, c ? closeRe.lastIndex : text.length)) + ' ';
    counter.count += 1;
    keepSpan(counter, text.slice(HTML_CODE_OPEN.lastIndex, c ? c.index : text.length));
    at = c ? closeRe.lastIndex : text.length;
    HTML_CODE_OPEN.lastIndex = at;
    if (!c) break;
  }
  return out + text.slice(at);
}

function cutQuoteLines(text, counter) {
  const lines = text.split(LINE_SPLIT);
  const kept = [];
  let inRun = false;
  for (let i = 0; i < lines.length; i += 1) {
    if (!BLOCK_QUOTE_LINE.test(lines[i]) && !INDENTED_CODE_LINE.test(lines[i])) { kept.push(lines[i]); inRun = false; continue; }
    keepSpan(counter, lines[i]);
    // NEW-BL-02: a run of pasted lines is 1 note line and 1 empty line for
    // each further line, so the line count stays the same.
    if (inRun) { kept.push(''); continue; }
    kept.push(PASTE_NOTE);
    inRun = true;
    counter.count += 1;
  }
  return kept.join('\n');
}

// Plan 395-13 review IN-03: the cut keeps the first SPAN_KEEP_MAX cut spans so
// the guard can check that no pasted span stands in the text it sends.
const SPAN_KEEP_MAX = 64;
function keepSpan(counter, str) {
  if (counter.spans && counter.spans.length < SPAN_KEEP_MAX) counter.spans.push(str);
}

function tidyLines(text) {
  const lines = text.split(LINE_SPLIT);
  for (let i = 0; i < lines.length; i += 1) lines[i] = lines[i].replace(/[ \t]{2,}/g, ' ').trim();
  return lines.join('\n');
}

function cutPastedText(value) {
  if (typeof value !== 'string') return { text: '', count: 0, ambiguous: false };
  const counter = { count: 0, ambiguous: false, spans: [] };
  const out = tidyLines(cutQuotePairs(cutQuoteLines(cutHtmlCode(cutFences(value, counter), counter), counter), counter));
  if (counter.count === 0) return { text: value, count: 0, ambiguous: counter.ambiguous };
  return { text: out, count: counter.count, ambiguous: counter.ambiguous, spans: counter.spans };
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
    const stats = { semicolons: 0 };
    // A text longer than BODY_MAX_CHARS is a body whatever its sentences, so
    // the count is not run there (time: 1 MB stays far under the hook budget);
    // sentences then reads BODY_MIN_SENTENCES, a lower bound.
    const sentences = text.length > BODY_MAX_CHARS ? BODY_MIN_SENTENCES : countSentences(text, stats);
    const lines = countNewlines(text);
    const quoted = hasQuotedSpan(text);
    const firstPersonStatement = isFirstPersonStatement(text);

    let kind = 'edge';
    // Owner ruling 2026-11-16 (plan 395-13 review WR-04): a text of 1 or 2
    // sentences that is longer than BODY_MAX_CHARS characters is a body too.
    if (sentences >= BODY_MIN_SENTENCES || text.length > BODY_MAX_CHARS) {
      kind = 'body';
    } else if (words <= SPROUT_MAX_WORDS && sentences - stats.semicolons <= 1 && lines === 0 && !quoted && !firstPersonStatement) {
      kind = 'sprout';
    }
    // Plan 395-13 review WR-02: a text that holds the paste note is the rest
    // of a cut. The paste made it a long edge before the cut, so it stays a
    // long edge and keeps the private-claim marker rule (plan D3), on the
    // shim cut and on a hook resend.
    const pasteNote = text.indexOf(PASTE_NOTE) !== -1;
    const longEdge = kind === 'edge' && (words >= LONG_EDGE_MIN_WORDS || lines >= LONG_EDGE_MIN_NEWLINES || quoted || pasteNote);
    return { kind, words, sentences, lines, quoted, firstPersonStatement, longEdge };
  } catch (_e) {
    return { kind: 'body', words: 0, sentences: 0, lines: 0, quoted: false, firstPersonStatement: false, longEdge: false };
  }
}

module.exports = {
  classifyShape,
  SPROUT_MAX_WORDS,
  BODY_MIN_SENTENCES,
  BODY_MAX_CHARS,
  LONG_EDGE_MIN_WORDS,
  LONG_EDGE_MIN_NEWLINES,
  cutPastedText,
  PASTE_NOTE,
  countNewlines,
};
