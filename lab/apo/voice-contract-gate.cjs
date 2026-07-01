/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 202-03 -- the APO voice-contract gate (SEED-002-eval-gate, Canon Part 12).
 *
 * checkVoiceContract(outputText, opts) -> { pass, violations }
 *
 * The APO loop maximizes a reward signal. Left ungated, an optimizer will
 * produce a prompt whose OUTPUT scores higher but violates Larry's teaching
 * voice: it dumps an enumerated framework, runs past eight sentences, drops the
 * De Stijl voice mark, or slips in an em-dash (Canon Part 12 anti-patterns).
 * This gate makes the voice contract a HARD disqualifier: reward can never buy
 * a voice-contract violation.
 *
 * The four MECHANICAL violations are deterministic (a detector can prove them,
 * so we never spend an LLM call on them -- the Phase 205 hybrid lesson):
 *   - too_long           : more than 8 sentences.
 *   - em_dash_present    : an em-dash (U+2014) or en-dash (U+2013) appears.
 *   - framework_dump     : an enumerated list of >= 3 items with no question.
 *   - missing_voice_mark : no valid single De Stijl mark, decided by REUSING
 *                          lab/eval/voice-mark-hybrid.cjs::scoreVoiceMark
 *                          (Part 7 reuse -- the mark detector is not reimplemented).
 *
 * The subjective no_reframe_question beat is the ONLY LLM leg. Offline (no
 * opts.llmJudge) it is SKIPPED and treated as pass unless a mechanical check
 * already fails, so the local gate stays pure + deterministic (Canon Part 8:
 * zero network, zero Brain, zero egress). No data-swept thresholds.
 *
 * Node built-ins only, CJS, no runtime deps. No em-dashes in code/comments.
 */
'use strict';

const path = require('node:path');

// Part 7 reuse: the De Stijl mark check is the deterministic leg of the Phase
// 205 voice-mark hybrid; we do NOT reimplement mark detection.
const { scoreVoiceMark } = require(path.join(__dirname, '..', 'eval', 'voice-mark-hybrid.cjs'));

// The concision ceiling: Larry stays roughly 3 to 8 sentences (Part 12). More
// than 8 sentences is a framework-lecture tell.
const MAX_SENTENCES = 8;

// Enumerated-list threshold: 3 or more numbered items with no question is a
// framework dump, not a teaching move.
const DUMP_MIN_ITEMS = 3;

// Em-dash (U+2014) and en-dash (U+2013). The house rule is hyphens only; either
// dash in a Larry OUTPUT is a voice violation.
const DASH_RE = /[–—]/;

// A numbered-list marker: a digit run followed by '.' or ')', at string start or
// after whitespace (e.g. "1." or "3)"). Global so we can count occurrences.
const NUMBERED_RE = /(?:^|\s)\d+[.)]/g;

/**
 * countSentences(text) -> number
 * Deterministic sentence count: runs of terminal punctuation [.!?] collapse to
 * one boundary. Good enough for the >8 ceiling; no NLP, no thresholds swept.
 */
function countSentences(text) {
  const m = String(text).match(/[.!?]+/g);
  return m ? m.length : 0;
}

/**
 * countNumberedItems(text) -> number
 * How many enumerated-list markers ("1." / "2)" ...) appear.
 */
function countNumberedItems(text) {
  const m = String(text).match(NUMBERED_RE);
  return m ? m.length : 0;
}

/**
 * checkVoiceContract(outputText, opts) -> { pass, violations }
 *
 * opts = {
 *   llmJudge?: (text) => boolean   // OPTIONAL subjective reframe-plus-question
 *                                  // judge. Offline (omitted) -> skipped and
 *                                  // treated as pass unless a mechanical check
 *                                  // already failed.
 *   assumeLarryTurn?: boolean      // forwarded to scoreVoiceMark (default true)
 * }
 *
 * Every leg is additive: a candidate collects ALL of its violations. pass is
 * true only when the violations array is empty.
 */
function checkVoiceContract(outputText, opts = {}) {
  const text = String(outputText == null ? '' : outputText);
  const violations = [];

  // --- Mechanical leg 1: too long (> 8 sentences). ---
  if (countSentences(text) > MAX_SENTENCES) {
    violations.push('too_long');
  }

  // --- Mechanical leg 2: em-dash / en-dash present. ---
  if (DASH_RE.test(text)) {
    violations.push('em_dash_present');
  }

  // --- Mechanical leg 3: framework dump (>= 3 enumerated items, no question). ---
  const hasQuestion = text.indexOf('?') !== -1;
  if (countNumberedItems(text) >= DUMP_MIN_ITEMS && !hasQuestion) {
    violations.push('framework_dump');
  }

  // --- Mechanical leg 4: missing De Stijl mark (REUSE the hybrid detector). ---
  // scoreVoiceMark labels: 'Pass?' / 'Pass' = a valid single mark is present;
  // 'Missing' / 'Multiple' / 'Wrong-Color' = the mark contract is broken.
  const mark = scoreVoiceMark(text, {
    assumeLarryTurn: opts.assumeLarryTurn !== false,
  });
  if (mark.label !== 'Pass?' && mark.label !== 'Pass') {
    violations.push('missing_voice_mark');
  }

  // --- Subjective leg (LLM-only): reframe-plus-question. ---
  // This is the one beat a detector cannot prove. Offline it is SKIPPED and
  // treated as pass unless a mechanical check already fails. It fires ONLY when
  // an llmJudge callback is supplied AND no mechanical violation was found.
  if (violations.length === 0 && typeof opts.llmJudge === 'function') {
    if (opts.llmJudge(text) === false) {
      violations.push('no_reframe_question');
    }
  }

  return { pass: violations.length === 0, violations };
}

module.exports = {
  checkVoiceContract,
  countSentences,
  countNumberedItems,
  MAX_SENTENCES,
  DUMP_MIN_ITEMS,
};
