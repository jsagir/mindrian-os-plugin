'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 18 (369.2-R18). The content-token helpers quick.cjs used privately for the room check,
 * moved here (no requires) so verdict.cjs and later modules read them without a require cycle.
 *
 *   STOP_WORDS                 a closed English function-word list; these never count toward keyword coverage
 *   contentTokens(normalized)  the distinct content tokens, in order: runs of letters and numbers of length
 *                              >= 3 (or holding a digit), minus the function words
 *   coversByMajority(set, needleTokens)
 *                              true when the needle has 2 or more content tokens and more than half of them
 *                              are in `set` (a strict majority; a one-token needle never covers by majority)
 *
 * Pure: no fs, no network, no clock. Hyphens only.
 */

// A closed English function-word list: these never count toward keyword coverage.
const STOP_WORDS = Object.freeze(new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into', 'is', 'it', 'its', 'of', 'on', 'onto',
  'or', 'over', 'per', 'than', 'that', 'the', 'their', 'these', 'this', 'those', 'to', 'under', 'via', 'was', 'were',
  'with', 'within', 'without',
]));

// contentTokens(normalized) -> the distinct content tokens, in order: runs of letters and numbers of length >= 3
// (or holding a digit), minus the function words.
function contentTokens(normalized) {
  const out = new Set(); // a Set keeps insertion order and the dedupe cheap on a 256 KB artifact
  String(normalized).split(/[^\p{L}\p{N}]+/u).forEach(function (tok) {
    if (tok.length === 0 || STOP_WORDS.has(tok)) return;
    if (tok.length < 3 && !/\p{N}/u.test(tok)) return;
    out.add(tok);
  });
  return Array.from(out);
}

// coversByMajority(textTokensSet, needleTokens) -> boolean
function coversByMajority(textTokensSet, needleTokens) {
  const needle = Array.isArray(needleTokens) ? needleTokens : [];
  if (needle.length < 2 || !textTokensSet || typeof textTokensSet.has !== 'function') return false;
  let got = 0;
  needle.forEach(function (tok) { if (textTokensSet.has(tok)) got += 1; });
  return got > needle.length / 2;
}

module.exports = { contentTokens: contentTokens, STOP_WORDS: STOP_WORDS, coversByMajority: coversByMajority };
