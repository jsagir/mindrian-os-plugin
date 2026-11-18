#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 392-03, Task 1 (bypass 1 of F6): a Hebrew or CJK sentence must not
 * pass _proveTypedQuestion.
 *
 * Why it passed on beta.81: the tokenizer at part8-egress-guard.cjs:1100
 * splits on /[^a-z0-9_-]+/, so a string with no ASCII letter yields no token,
 * the loop body never runs, and the proof returns true (an empty proof was a
 * proof). The guard then answered allow with the class typed_question and the
 * sentence reached the wire.
 *
 * Part 8: every sentence in this file is invented. No room word, no room file
 * name, no Brain identifier. The Hebrew and CJK sentences are plain prose
 * written with escape sequences; their meaning is a generic question about
 * choosing a method for a private team plan.
 *
 * Cases:
 *   U1  Hebrew sentence (9 words) is not allowed as typed_question.
 *   U2  CJK sentence is not allowed as typed_question.
 *   U3  one Latin methodology word plus Hebrew prose is not allowed as
 *       typed_question.
 *   U4  _proveTypedQuestion: Hebrew false, canonical question true, a string
 *       with zero letter or digit tokens false.
 *   U5  the 535 extended questions still allow at the beta.81 count or higher
 *       (tests/fixtures/392-part8-replay/baseline-beta81.json).
 *   U6  the 10 must_refuse cases still block.
 *
 * Plain Node. Exit 1 on any failure. No em dash and no en dash anywhere.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const GUARD_PATH = path.join(REPO_ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const BASELINE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', '392-part8-replay', 'baseline-beta81.json');
const replay = require(path.join(REPO_ROOT, 'tests', 'helpers', 'part8-overblock-replay.cjs'));

// Invented Hebrew prose, 9 words: "how to choose a framework for the project of
// our secret team". Escape sequences keep the file ASCII.
const HEBREW_9 = [
  'איך',
  'לבחור',
  'מסגרת',
  'עבור',
  'הפרויקט',
  'של',
  'הצוות',
  'הסודי',
  'שלנו',
].join(' ');

// Invented Japanese prose: "tell me about our secret acquisition plan, next
// month, contract".
const CJK = '私たちの秘密の買収計画について教えてください 来月 契約';

// One Latin methodology word, then the Hebrew prose.
const MIXED = 'swot ' + HEBREW_9;

// The plan named "what is jobs to be done"; on beta.81 that string already
// returned false (jobs and done are not methodology tokens, and the phrase is
// canonical only inside longer phrases). This question is template 1 of the
// 354 generic corpus and proves on beta.81 and after this plan.
const CANONICAL_QUESTION = 'recommend a framework for a wicked problem';
const NO_TOKEN = '?? !! ... --';

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('  ok - ' + name);
  } catch (err) {
    failed += 1;
    console.error('  FAIL - ' + name);
    console.error('    ' + (err && err.message ? err.message : err));
  }
}

function freshGuard() {
  delete require.cache[GUARD_PATH];
  return require(GUARD_PATH);
}

function groupCounts(rows, group) {
  const t = { allow: 0, ambiguous: 0, block: 0 };
  rows.forEach(function (r) { if (r.group === group) t[r.verdict] += 1; });
  return t;
}

console.log('Plan 392-03 Task 1: bypass 1, Unicode tokens\n');

const guard = freshGuard();
const opts = { toolName: 'brain_ask', roomDir: null };

check('U1 Hebrew sentence is not allowed as typed_question', function () {
  const v = guard.classify({ question: HEBREW_9 }, opts);
  assert.notStrictEqual(v.verdict, 'allow', 'Hebrew sentence allowed as typed_question: ' + JSON.stringify(v));
});

check('U2 CJK sentence is not allowed as typed_question', function () {
  const v = guard.classify({ question: CJK }, opts);
  assert.notStrictEqual(v.verdict, 'allow', 'CJK sentence allowed as typed_question: ' + JSON.stringify(v));
});

check('U3 one Latin methodology word plus Hebrew prose is not allowed as typed_question', function () {
  const v = guard.classify({ question: MIXED }, opts);
  assert.notStrictEqual(v.verdict, 'allow', 'mixed sentence allowed as typed_question: ' + JSON.stringify(v));
});

check('U4 _proveTypedQuestion: Hebrew false, canonical true, zero-token string false', function () {
  assert.strictEqual(guard._proveTypedQuestion(HEBREW_9), false, 'Hebrew sentence proved as a typed question');
  assert.strictEqual(guard._proveTypedQuestion(CJK), false, 'CJK sentence proved as a typed question');
  assert.strictEqual(guard._proveTypedQuestion(CANONICAL_QUESTION), true, 'the canonical question must prove');
  assert.strictEqual(guard._proveTypedQuestion(NO_TOKEN), false, 'a string with zero letter or digit tokens proved (empty proof is no proof)');
});

const baseline = JSON.parse(require('node:fs').readFileSync(BASELINE_PATH, 'utf8'));
const baseExtended = baseline.matrix.by_group.extended;
const baseMustRefuse = baseline.matrix.by_group.must_refuse;
const fixtures = replay.replayFixtures();
const extended = groupCounts(fixtures.rows, 'extended');
const mustRefuse = groupCounts(fixtures.rows, 'must_refuse');
console.log('  extended: allow ' + extended.allow + ' block ' + extended.block + ' (baseline allow ' + baseExtended.allow + ' block ' + baseExtended.block + ')');
console.log('  must_refuse: block ' + mustRefuse.block + ' of ' + (mustRefuse.allow + mustRefuse.ambiguous + mustRefuse.block));

check('U5 the extended questions still allow at the beta.81 count or higher', function () {
  assert.strictEqual(fixtures.network_calls, 0, 'the replay opened a network call');
  assert.ok(extended.allow >= baseExtended.allow, 'extended allow dropped: ' + extended.allow + ' < baseline ' + baseExtended.allow);
});

check('U6 the must_refuse cases still block', function () {
  const total = mustRefuse.allow + mustRefuse.ambiguous + mustRefuse.block;
  assert.strictEqual(total, baseMustRefuse.block, 'must_refuse group size changed: ' + total);
  assert.strictEqual(mustRefuse.block, total, 'must_refuse not fully blocked: ' + JSON.stringify(mustRefuse));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed.');
if (failed > 0) {
  console.log('FAIL: test-396-bypass-1-unicode-tokens');
  process.exit(1);
}
console.log('PASS: test-396-bypass-1-unicode-tokens');
process.exit(0);
