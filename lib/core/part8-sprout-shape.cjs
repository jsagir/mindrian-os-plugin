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
 *   body    BODY_MIN_SENTENCES or more sentences, or BODY_MIN_WORDS or more
 *           words, or BODY_MIN_NEWLINES or more newlines, or a quoted span
 *   edge    everything between
 *
 * The thresholds are measured on the corpora and written in the RCA
 * .planning/debug/part8-no-shape-test-for-sprouts-and-bodies.md.
 *
 * Pure: Node built-ins only (none are needed), no network, deterministic, never
 * throws. A non-string is a body (the safe class). This module changes no
 * verdict; the guard does not call it yet (plans 386-25, 386-27, 386-33 do).
 */

const SPROUT_MAX_WORDS = 12;
const BODY_MIN_WORDS = 40;
const BODY_MIN_SENTENCES = 3;
const BODY_MIN_NEWLINES = 2;
const QUOTE_MIN_WORDS = 4;

const WORD_TOKEN = /[\p{L}\p{N}]/u;
// A sentence ends at . ! or ? followed by a space and a letter, or at the end.
const SENTENCE_BREAK = /(?<=[.!?])\s+(?=\p{L})/u;
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
    return { kind: 'body', words: 0, sentences: 0, lines: 0, quoted: false, firstPersonStatement: false };
  }
  try {
    const text = value.trim();
    const words = countWords(text);
    const sentences = countSentences(text);
    const lines = countNewlines(text);
    const quoted = hasQuotedSpan(text);
    const firstPersonStatement = isFirstPersonStatement(text);

    let kind = 'edge';
    if (sentences >= BODY_MIN_SENTENCES || words >= BODY_MIN_WORDS || lines >= BODY_MIN_NEWLINES || quoted) {
      kind = 'body';
    } else if (words <= SPROUT_MAX_WORDS && sentences <= 1 && lines === 0 && !firstPersonStatement) {
      kind = 'sprout';
    }
    return { kind, words, sentences, lines, quoted, firstPersonStatement };
  } catch (_e) {
    return { kind: 'body', words: 0, sentences: 0, lines: 0, quoted: false, firstPersonStatement: false };
  }
}

module.exports = {
  classifyShape,
  SPROUT_MAX_WORDS,
  BODY_MIN_WORDS,
  BODY_MIN_SENTENCES,
  BODY_MIN_NEWLINES,
};
