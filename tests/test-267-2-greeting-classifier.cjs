'use strict';
// Phase 267.2 W1a/W1c -- corpus, Part-8 shape, and zero-network pins for
// lib/core/greeting-intent-detector.cjs (HOOK-05, HOOK-06). Anchored on the
// module's real exports, never restated bucket lists, so a corpus author
// cannot silently drift from the shipped classifier.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const classifier = require('../lib/core/greeting-intent-detector.cjs');

const REPO = path.join(__dirname, '..');
const CLASSIFIER_SOURCE_PATH = path.join(REPO, 'lib', 'core', 'greeting-intent-detector.cjs');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-267-2-greeting-classifier');

// ---------------------------------------------------------------------
// 1. TABLE-DRIVEN CORPUS. 17 rows, sentences a real first-install user
//    would actually type, not keyword bait.
// ---------------------------------------------------------------------

const CORPUS = [
  // new_venture (3 required, 4 shipped)
  { sentence: 'I want to start a new venture around clinical trial recruitment.', expected: 'new_venture' },
  { sentence: 'Thinking about launching a new project to track patient outcomes across our lab.', expected: 'new_venture' },
  { sentence: "We're founding a startup focused on genomics data sharing.", expected: 'new_venture' },
  { sentence: "I'd like to kick off a new initiative around remote patient monitoring.", expected: 'new_venture' },

  // prior_work (3 required, 4 shipped, at least one referencing an artifact)
  { sentence: 'I want to continue working on the grant proposal I started last month.', expected: 'prior_work' },
  { sentence: 'Picking this back up after a few weeks away.', expected: 'prior_work' },
  { sentence: "I'd like to review my pitch deck and pick up where I left off.", expected: 'prior_work' },
  { sentence: 'I want to resume my research project from before the summer break.', expected: 'prior_work' },

  // just_talk (3 required, 4 shipped, including one first-time-orientation)
  { sentence: 'I just want to talk through some ideas, no real agenda today.', expected: 'just_talk' },
  { sentence: "Honestly I'm just thinking out loud right now, nothing concrete yet.", expected: 'just_talk' },
  { sentence: 'This is my first time here, and I just wanted to talk something through.', expected: 'just_talk' },
  { sentence: 'I just want a sounding board today, nothing to build yet.', expected: 'just_talk' },

  // ambiguous (3 required): a two-word answer, a new-build verb mixed with
  // hesitation language, and a sentence with no intent signal at all.
  { sentence: 'Not sure.', expected: 'ambiguous' },
  { sentence: "I want to start something new, but honestly I'm not sure yet.", expected: 'ambiguous' },
  { sentence: 'The weather has been pretty nice this week.', expected: 'ambiguous' },

  // adversarial (2 required): a very long sentence with signals for two
  // buckets, which must return ambiguous on the margin rule (a tie), and a
  // sentence with a regex metacharacter run so a pathological pattern would
  // surface as a hang rather than a silent pass.
  {
    sentence: "I'm torn between wanting to start a new venture from scratch and also wanting to "
      + 'continue working on the existing venture I already have, since I keep going back and forth '
      + "between the two options and can't quite decide which direction feels right for me long "
      + "term, so I guess I'm curious what makes more sense.",
    expected: 'ambiguous',
  },
  {
    sentence: "Here's my situation: " + '('.repeat(40) + 'please' + ')'.repeat(40) + ' help.',
    expected: 'ambiguous',
  },
];

assert.ok(CORPUS.length >= 16, 'corpus must have at least 16 rows, has ' + CORPUS.length);

const seenBuckets = new Set(CORPUS.map(function (row) { return row.expected; }));
for (const b of classifier.BUCKETS) {
  assert.ok(seenBuckets.has(b), 'corpus does not cover bucket: ' + b);
}

const corpusStart = Date.now();
for (const row of CORPUS) {
  ok('classify(' + JSON.stringify(row.sentence.slice(0, 60)) + '...) -> ' + row.expected, function () {
    const result = classifier.classify(row.sentence);
    assert.equal(
      result.bucket,
      row.expected,
      'corpus miss: sentence=' + JSON.stringify(row.sentence)
        + ' got bucket=' + result.bucket
        + ' expected=' + row.expected
        + ' scores=' + JSON.stringify(result.scores)
        + ' margin=' + result.margin,
    );
  });
}
const corpusElapsedMs = Date.now() - corpusStart;

ok('the whole corpus classifies in under 250ms (T-267.2-12: bounded-runtime, ' + corpusElapsedMs + 'ms observed)', function () {
  assert.ok(corpusElapsedMs < 250, 'corpus took ' + corpusElapsedMs + 'ms, exceeds the 250ms backtracking-regression budget');
});

// ---------------------------------------------------------------------
// 2. PART 8 SHAPE. Every features value is a number or boolean, and no
//    8-or-more character substring of the input sentence appears anywhere
//    in the classify() return value. This is what makes plan 267.2-06's
//    telemetry safe by construction rather than by discipline.
// ---------------------------------------------------------------------

for (const row of CORPUS) {
  ok('Part 8 shape holds for ' + JSON.stringify(row.sentence.slice(0, 40)) + '...', function () {
    const result = classifier.classify(row.sentence);
    for (const [key, value] of Object.entries(result.features)) {
      assert.ok(
        typeof value === 'number' || typeof value === 'boolean',
        'non-scalar feature ' + key + ': ' + typeof value,
      );
    }
    const serialized = JSON.stringify(result);
    const normalized = row.sentence.replace(/[()]/g, ''); // strip corpus-only regex-run padding
    for (let i = 0; i + 8 <= normalized.length; i += 1) {
      const chunk = normalized.slice(i, i + 8);
      if (/^\s*$/.test(chunk)) continue; // whitespace-only chunks are not content leaks
      assert.equal(
        serialized.indexOf(chunk),
        -1,
        'Canon Part 8 violation: an 8+ character substring of the input sentence ("' + chunk
          + '") leaked into classify()\'s return value: ' + serialized,
      );
    }
  });
}

// ---------------------------------------------------------------------
// 3. ZERO NETWORK. Source grep on the classifier module itself.
// ---------------------------------------------------------------------

ok('lib/core/greeting-intent-detector.cjs has no network, Brain, or fs surface (CONTEXT.md D-07: '
  + 'the chokepoint is the only legal network path, and the classifier never needs one)', function () {
  const src = fs.readFileSync(CLASSIFIER_SOURCE_PATH, 'utf8');
  const forbidden = [
    'fetch',
    'node:http',
    'node:https',
    "require('http",
    'brain-client',
    'mindrian-brain-mcp-client',
    'process.env',
    "require('node:fs')",
  ];
  for (const token of forbidden) {
    assert.equal(
      src.indexOf(token),
      -1,
      'CONTEXT.md D-07 violation: forbidden token "' + token + '" found in '
        + 'lib/core/greeting-intent-detector.cjs -- the classifier must never reach the network, '
        + 'the filesystem, process.env, or a Brain-specific chokepoint bypass',
    );
  }
});

console.log('\nPASS test-267-2-greeting-classifier (' + n + ' assertions)');
