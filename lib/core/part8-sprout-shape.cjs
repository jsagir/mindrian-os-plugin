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
// a sentence. A last sentence with no end mark still counts. A full stop does
// not end a sentence after a dotted abbreviation (e.g. i.e. U.S.), after a
// single-letter initial, or after a word of the short grammar list
// ABBREVIATIONS. A sentence counts only when it holds a letter, so a list
// marker such as "1." or "-" is not a sentence of its own.
const LETTER = /\p{L}/u;
const LINE_BREAK = /\r\n|\r|\n/;
const SENTENCE_BREAK = /(?<=[.!?]["'\u201D\u2019)\]]*)\s+(?=["'\u201C\u2018(\[]*\p{L})/u;
const LAST_TOKEN = /\S+$/u;
const DOTTED_ABBREVIATION = /^(?:\p{L}\.){2,}$/u;
const INITIAL = /^\p{L}\.$/u;
const ABBREVIATIONS = new Set(['etc.', 'vs.', 'cf.', 'approx.', 'incl.', 'al.', 'fig.', 'no.', 'dr.', 'mr.', 'mrs.', 'ms.', 'st.', 'prof.', 'jr.', 'sr.']);
// A question opens with one of these grammar words, or ends with a question mark.
const QUESTION_OPENER = /^(?:what|which|who|whom|whose|when|where|why|how|is|are|do|does|did|can|could|should|would|will|explain|define|compare|describe)\b/i;
// my, our, we or I at the start of a clause, followed by a word.
const FIRST_PERSON_CLAUSE = /(?:^|[,;:.!]\s+|\b(?:and|but|so|because|that|when|while)\s+)(?:i|we|my|our)\b\s*[\p{L}']/iu;
const QUOTE_PAIRS = /"([^"]*)"|“([^”]*)”/g;

function countWords(text) {
  const tokens = text.split(/\s+/);
  let n = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    if (WORD_TOKEN.test(tokens[i])) n += 1;
  }
  return n;
}

function isAbbreviation(token) {
  const core = token.replace(/^["'\u201C\u2018(\[]+/u, '').replace(/["'\u201D\u2019)\]]+$/u, '').toLowerCase();
  return ABBREVIATIONS.has(core) || DOTTED_ABBREVIATION.test(core) || INITIAL.test(core);
}

function countSentences(text) {
  if (!text) return 0;
  const lines = text.split(LINE_BREAK);
  let n = 0;
  for (let l = 0; l < lines.length; l += 1) {
    const parts = lines[l].split(SENTENCE_BREAK);
    let open = false;
    for (let i = 0; i < parts.length; i += 1) {
      if (!open && LETTER.test(parts[i])) open = true;
      if (!open) continue;
      if (i === parts.length - 1) { n += 1; break; }
      const last = parts[i].match(LAST_TOKEN);
      if (last && isAbbreviation(last[0])) continue;
      n += 1;
      open = false;
    }
  }
  return n;
}

function countNewlines(text) {
  let n = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) n += 1;
  }
  return n;
}

function hasQuotedSpan(text) {
  if (/^[ \t]*>/m.test(text)) return true;
  if (text.indexOf('```') !== -1 || text.indexOf('~~~') !== -1) return true;
  QUOTE_PAIRS.lastIndex = 0;
  let m;
  while ((m = QUOTE_PAIRS.exec(text)) !== null) {
    const inner = m[1] !== undefined ? m[1] : m[2];
    if (countWords(inner) >= QUOTE_MIN_WORDS) return true;
  }
  return false;
}

// Plan 395-13 (owner ruling 37, 2026-11-16, "cut the paste, send the rest").
// cutPastedText(text) -> { text, count }. It cuts what hasQuotedSpan finds and
// puts PASTE_NOTE in its place: a fenced code block (from ``` or ~~~ to the
// same closing fence, or to the end of the text), a run of block-quote lines
// (a line that starts with >), and a pair of double quotes that holds
// QUOTE_MIN_WORDS or more words. A line that holds only the note joins the
// lines around it with a space, so the note never counts as a sentence of its
// own. Runs of spaces and tabs become 1 space. count is the number of spans
// cut; when it is 0 the text comes back unchanged. Linear time: indexOf and a
// line split, no backtracking pattern.
const PASTE_NOTE = '[pasted text kept local]';
const LINE_SPLIT = /\r\n|[\n\r\u2028\u2029]/;
const BLOCK_QUOTE_LINE = /^[ \t]*>/;

function cutFences(text, counter) {
  let out = '';
  let at = 0;
  for (;;) {
    const a = text.indexOf('```', at);
    const b = text.indexOf('~~~', at);
    let open = -1;
    let fence = '';
    if (a !== -1 && (b === -1 || a <= b)) { open = a; fence = '```'; } else if (b !== -1) { open = b; fence = '~~~'; }
    if (open === -1) break;
    const close = text.indexOf(fence, open + 3);
    out += text.slice(at, open) + ' ' + PASTE_NOTE + ' ';
    counter.count += 1;
    at = close === -1 ? text.length : close + 3;
  }
  return out + text.slice(at);
}

function cutQuotePairs(text, counter) {
  return text.replace(QUOTE_PAIRS, function (m, p1, p2) {
    const inner = p1 !== undefined ? p1 : p2;
    if (countWords(inner) < QUOTE_MIN_WORDS) return m;
    counter.count += 1;
    return PASTE_NOTE;
  });
}

function cutBlockQuotes(text, counter) {
  const lines = text.split(LINE_SPLIT);
  const kept = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!BLOCK_QUOTE_LINE.test(lines[i])) { kept.push(lines[i]); continue; }
    if (kept.length > 0 && kept[kept.length - 1] === PASTE_NOTE) continue;
    kept.push(PASTE_NOTE);
    counter.count += 1;
  }
  let out = '';
  for (let i = 0; i < kept.length; i += 1) {
    if (i > 0) out += (kept[i - 1].trim() === PASTE_NOTE || kept[i].trim() === PASTE_NOTE) ? ' ' : '\n';
    out += kept[i];
  }
  return out;
}

function cutPastedText(value) {
  if (typeof value !== 'string') return { text: '', count: 0 };
  const counter = { count: 0 };
  const out = cutBlockQuotes(cutQuotePairs(cutFences(value, counter), counter), counter);
  if (counter.count === 0) return { text: value, count: 0 };
  return { text: out.replace(/[ \t]{2,}/g, ' ').trim(), count: counter.count };
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
