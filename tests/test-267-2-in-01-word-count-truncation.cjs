'use strict';
// Phase 267.2 code review fix IN-01 -- lib/core/greeting-intent-detector.cjs's
// header comment states: "The input is also truncated to the first 2000
// characters before any regex runs; features.char_count still records the
// untruncated length" -- explicitly naming char_count as the ONE deliberate
// untruncated exception. But word_count was ALSO computed from the
// untruncated `trimmed` (derived from the raw `text`), not from `truncated`
// -- undocumented and inconsistent with the file's own stated contract.
//
// Fix: word_count is now computed from `truncated.trim()`, matching every
// other feature. char_count remains the one deliberate untruncated field.
//
// No em-dashes. Plain node:assert/strict, no I/O (classify() is pure).

const assert = require('node:assert/strict');
const path = require('node:path');

const classifier = require(path.join(__dirname, '..', 'lib', 'core', 'greeting-intent-detector.cjs'));

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-267-2-in-01-word-count-truncation');

// MAX_SCORE_CHARS is 2000 (not exported; mirrored here as a literal, matching the source's
// own frozen constant -- this test fails loudly if that constant ever moves, since the
// long-input construction below is built directly against 2000).
const MAX_SCORE_CHARS = 2000;

ok('IN-01 FIXED: word_count is computed on the TRUNCATED input, not the untruncated raw text', function () {
  // Build an input whose word count differs depending on whether it is measured before or
  // after the 2000-char truncation: 500 single-character "words" (999 chars with spaces,
  // well under the cap) followed by a single very long word that pushes the TOTAL length
  // well past MAX_SCORE_CHARS. The long trailing word is what gets sliced mid-word by
  // truncation, which is exactly the case that would produce a DIFFERENT split count
  // before vs after truncation.
  const leadingWords = new Array(500).fill('w').join(' '); // 500 words, 999 chars
  const trailingLongWord = 'x'.repeat(5000); // pushes total length far past MAX_SCORE_CHARS
  const text = leadingWords + ' ' + trailingLongWord;

  assert.ok(text.length > MAX_SCORE_CHARS, 'sanity: fixture must exceed MAX_SCORE_CHARS to exercise truncation');

  const result = classifier.classify(text);

  // Truncated text = leadingWords + ' ' + trailingLongWord.slice(0, MAX_SCORE_CHARS - leadingWords.length - 1)
  const truncated = text.slice(0, MAX_SCORE_CHARS);
  const expectedWordCountFromTruncated = truncated.trim().split(/\s+/).filter(Boolean).length;
  const wordCountFromUntruncated = text.trim().split(/\s+/).filter(Boolean).length;

  // Both counts happen to be 501 in this construction (500 leading words + 1 trailing
  // partial/full word survives either way), so this fixture alone would not distinguish
  // the two computations. The REAL distinguishing fixture follows below; this assertion
  // is a baseline sanity check that classify() does not throw or misbehave on a long input.
  assert.equal(result.features.word_count, expectedWordCountFromTruncated);

  // The distinguishing case: many short words AFTER the truncation boundary. If word_count
  // were computed on the untruncated text, it would count every one of those trailing
  // words too; computed on `truncated`, it must not.
  const beforeBoundary = 'a'.repeat(MAX_SCORE_CHARS - 10); // one long run, no spaces, well
                                                            // under the cap on its own
  const manyTrailingWords = new Array(50).fill('trailingword').join(' '); // 50 real words,
                                                                           // entirely past
                                                                           // the boundary
  const distinguishingText = beforeBoundary + ' ' + manyTrailingWords;
  assert.ok(distinguishingText.length > MAX_SCORE_CHARS, 'sanity: distinguishing fixture must exceed the cap');

  const distinguishingResult = classifier.classify(distinguishingText);
  const distinguishingTruncated = distinguishingText.slice(0, MAX_SCORE_CHARS);
  const expectedFromTruncated = distinguishingTruncated.trim().split(/\s+/).filter(Boolean).length;
  const expectedFromUntruncated = distinguishingText.trim().split(/\s+/).filter(Boolean).length;

  assert.notEqual(
    expectedFromTruncated,
    expectedFromUntruncated,
    'fixture construction error: the truncated and untruncated word counts must differ for '
      + 'this assertion to actually distinguish the two implementations',
  );
  assert.equal(
    distinguishingResult.features.word_count,
    expectedFromTruncated,
    'IN-01 REGRESSED: word_count (' + distinguishingResult.features.word_count + ') does not '
      + 'match the count computed from the TRUNCATED input (' + expectedFromTruncated + ') -- '
      + 'it is being computed from the untruncated raw text again '
      + '(untruncated count would be ' + expectedFromUntruncated + ')',
  );
});

ok('char_count REMAINS the one deliberate untruncated field (unchanged contract)', function () {
  const longText = 'a '.repeat(1500); // 3000 chars, well past MAX_SCORE_CHARS
  const result = classifier.classify(longText);
  assert.equal(
    result.features.char_count,
    longText.length,
    'char_count must still record the UNTRUNCATED length -- this is the file\'s one named exception',
  );
  assert.notEqual(
    result.features.char_count,
    MAX_SCORE_CHARS,
    'sanity: char_count must not equal the truncation cap itself for this fixture to prove anything',
  );
});

console.log('\nPASS test-267-2-in-01-word-count-truncation (' + n + ' assertions)');
