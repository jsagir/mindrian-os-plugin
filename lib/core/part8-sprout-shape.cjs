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
 *           sentence, 0 newlines, no quoted span, not a first-person statement,
 *           no word over WORD_MAX_CHARS, no more than STRING_MAX_CHARS in total
 *   body    BODY_MIN_SENTENCES or more sentences, or BODY_MIN_WORDS or more
 *           words, or BODY_MIN_NEWLINES or more newlines, or a quoted span, or
 *           a word over WORD_MAX_CHARS, or more than STRING_MAX_CHARS
 *   edge    everything between
 *
 * Words (Phase 392 plan 04, bypass 4): a word ends at whitespace, at an
 * underscore, or at a format character (\p{Cf}: the zero width space U+200B,
 * the joiners U+200C and U+200D, the soft hyphen, U+FEFF); none of those joins
 * words in an ordinary question. A dash (\p{Pd}, the hyphen included) is
 * ordinary English inside ONE compound ("room-scoped", "decision-making"), so a
 * token with a single dash stays one word; a token with 2 or more dashes is a
 * chain and splits at every dash. Before this change a paragraph glued with
 * any of those joiners counted as one word and passed as a sprout. The two
 * caps close the same hole from the other side: a single token longer than
 * WORD_MAX_CHARS, or a string longer than STRING_MAX_CHARS, is a body whatever
 * its word count, and the result names the cap in `reason` ('word_too_long' |
 * 'string_too_long'; null otherwise) so a typed guard outcome can carry it.
 *
 * The thresholds are measured on the corpora and written in the RCA
 * .planning/debug/part8-no-shape-test-for-sprouts-and-bodies.md. The word rule
 * and the caps are checked against the 535 extended questions by the Phase 392
 * replay matrix (tests/fixtures/392-part8-replay): splitting a single-dash
 * compound refused one legitimate 12-word question (C:extended:C81), so the
 * single-dash compound stays one word; no legitimate question is longer than
 * STRING_MAX_CHARS.
 *
 * Pure: Node built-ins only (none are needed), no network, deterministic, never
 * throws. A non-string is a body (the safe class). The guard calls classifyShape
 * through lib/core/part8-egress-guard.cjs _shapeOfFreeform (plan 386-33) and
 * lib/core/part8-split-route.cjs validateSprouts.
 */

const SPROUT_MAX_WORDS = 12;
const BODY_MIN_WORDS = 40;
const BODY_MIN_SENTENCES = 3;
const BODY_MIN_NEWLINES = 2;
const QUOTE_MIN_WORDS = 4;
const WORD_MAX_CHARS = 80;
const STRING_MAX_CHARS = 240;

const WORD_TOKEN = /[\p{L}\p{N}]/u;
// A word boundary for counting: whitespace, an underscore or a format
// character. Each joiner ends a word, so a glued paragraph counts its true words.
const WORD_SPLIT = /[\s_\p{Cf}]+/u;
// A dash chain: a token that holds 2 or more dashes splits at every dash; a
// token with one dash is an ordinary compound and stays one word.
const DASH = /\p{Pd}/u;
const DASH_SPLIT = /\p{Pd}+/u;

function wordTokens(text) {
  const raw = text.split(WORD_SPLIT);
  const out = [];
  for (let i = 0; i < raw.length; i += 1) {
    const t = raw[i];
    if (!t) continue;
    const first = t.search(DASH);
    if (first !== -1 && t.slice(first + 1).search(DASH) !== -1) {
      const parts = t.split(DASH_SPLIT);
      for (let j = 0; j < parts.length; j += 1) out.push(parts[j]);
    } else {
      out.push(t);
    }
  }
  return out;
}
// A sentence ends at . ! or ? followed by a space and a letter, or at the end.
const SENTENCE_BREAK = /(?<=[.!?])\s+(?=\p{L})/u;
// A question opens with one of these grammar words, or ends with a question mark.
const QUESTION_OPENER = /^(?:what|which|who|whom|whose|when|where|why|how|is|are|do|does|did|can|could|should|would|will|explain|define|compare|describe)\b/i;
// my, our, we or I at the start of a clause, followed by a word.
const FIRST_PERSON_CLAUSE = /(?:^|[,;:.!]\s+|\b(?:and|but|so|because|that|when|while)\s+)(?:i|we|my|our)\b\s*[\p{L}']/iu;
const QUOTE_PAIRS = /"([^"]*)"|“([^”]*)”/g;

function countWords(text) {
  const tokens = wordTokens(text);
  let n = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    if (WORD_TOKEN.test(tokens[i])) n += 1;
  }
  return n;
}

// The length (in UTF-16 code units) of the longest word token.
function longestWord(text) {
  const tokens = wordTokens(text);
  let max = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i].length > max && WORD_TOKEN.test(tokens[i])) max = tokens[i].length;
  }
  return max;
}

function countSentences(text) {
  if (!text) return 0;
  const parts = text.split(SENTENCE_BREAK);
  let n = 0;
  for (let i = 0; i < parts.length; i += 1) {
    if (WORD_TOKEN.test(parts[i])) n += 1;
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

function isQuestion(text) {
  return /\?\s*$/.test(text) || QUESTION_OPENER.test(text);
}

function isFirstPersonStatement(text) {
  if (isQuestion(text)) return false;
  return FIRST_PERSON_CLAUSE.test(text);
}

function classifyShape(value) {
  if (typeof value !== 'string') {
    return { kind: 'body', words: 0, sentences: 0, lines: 0, quoted: false, firstPersonStatement: false, reason: null };
  }
  try {
    const text = value.trim();
    const words = countWords(text);
    const sentences = countSentences(text);
    const lines = countNewlines(text);
    const quoted = hasQuotedSpan(text);
    const firstPersonStatement = isFirstPersonStatement(text);

    // The caps (bypass 4): a token over WORD_MAX_CHARS or a string over
    // STRING_MAX_CHARS is a body, whatever the word count says.
    let reason = null;
    if (longestWord(text) > WORD_MAX_CHARS) reason = 'word_too_long';
    else if (text.length > STRING_MAX_CHARS) reason = 'string_too_long';

    let kind = 'edge';
    if (reason !== null || sentences >= BODY_MIN_SENTENCES || words >= BODY_MIN_WORDS || lines >= BODY_MIN_NEWLINES || quoted) {
      kind = 'body';
    } else if (words <= SPROUT_MAX_WORDS && sentences <= 1 && lines === 0 && !firstPersonStatement) {
      kind = 'sprout';
    }
    return { kind, words, sentences, lines, quoted, firstPersonStatement, reason };
  } catch (_e) {
    return { kind: 'body', words: 0, sentences: 0, lines: 0, quoted: false, firstPersonStatement: false, reason: null };
  }
}

module.exports = {
  classifyShape,
  SPROUT_MAX_WORDS,
  BODY_MIN_WORDS,
  BODY_MIN_SENTENCES,
  BODY_MIN_NEWLINES,
  WORD_MAX_CHARS,
  STRING_MAX_CHARS,
};
