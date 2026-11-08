#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 392-03, Task 2: NFKC and format-character stripping before any pattern
 * runs in the Part 8 guard and in rs-egress-prompts.
 *
 * Why it failed on beta.81: every pattern (CREDENTIAL_SHAPES, ALWAYS and PROSE
 * patterns, the name rules, the typed proof) is written for the plain ASCII
 * form. A key whose letters are fullwidth forms (U+FF21 to U+FF3A, U+FF41 to
 * U+FF5A) or a key with a zero width space (U+200B) between every character
 * matches none of them and reached the wire as a generic question.
 *
 * Part 8: no credential shape is stored in this file. Every key-shaped string
 * is built at run time from parts (the {join} rule of
 * tests/helpers/audit-probe-loader.cjs). The email-shaped string is an
 * invented local part at an invented host. No room word, no room file name,
 * no Brain identifier.
 *
 * Cases:
 *   N1  normalizeForGuard turns fullwidth letters into their plain form.
 *   N2  normalizeForGuard strips zero width space, soft hyphen and zero width
 *       joiner (\p{Cf}).
 *   N3  a plain ASCII string is unchanged; a non-string gives an empty string;
 *       FORMAT_CHAR_RE is exported and matches a format character.
 *   N4  a fullwidth credential-shaped brain_ask question blocks.
 *   N5  a credential-shaped question with a zero width space between every
 *       character blocks.
 *   N6  auditQueryString reports the same matched pattern for a fullwidth
 *       email-shaped string as for the plain one.
 *   N7  the 535 extended questions still allow at the beta.81 count or higher;
 *       the 10 must_refuse cases still block.
 *   N8  classify on a 4,000 character payload stays under 200 ms (the plan's
 *       target on this machine is 50 ms; the timing is printed).
 *
 * Plain Node. Exit 1 on any failure. No em dash and no en dash anywhere.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const GUARD_PATH = path.join(REPO_ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const NORMALIZE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'part8-normalize.cjs');
const PROMPTS_PATH = path.join(REPO_ROOT, 'lib', 'core', 'rs-egress-prompts.cjs');
const BASELINE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', '392-part8-replay', 'baseline-beta81.json');
const replay = require(path.join(REPO_ROOT, 'tests', 'helpers', 'part8-overblock-replay.cjs'));

const ZWSP = '​';
const SOFT_HYPHEN = '­';
const ZWJ = '‍';

// Fullwidth form of an ASCII letter or digit: code point plus 0xFEE0.
function toFullwidth(s) {
  return s.replace(/[A-Za-z0-9]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0xFEE0); });
}

// A credential-shaped string built from parts at run time (never stored whole).
function keyShape() {
  const tail = [];
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let i = 0; i < 48; i++) tail.push(alphabet[(i * 7) % alphabet.length]);
  return ['sk', '-', 'ant', '-', 'api03', '-', tail.join('')].join('');
}

function emailShape() {
  return ['someone', '@', 'example', '.', 'com'].join('');
}

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

function groupCounts(rows, group) {
  const t = { allow: 0, ambiguous: 0, block: 0 };
  rows.forEach(function (r) { if (r.group === group) t[r.verdict] += 1; });
  return t;
}

function loadNormalizer() {
  delete require.cache[NORMALIZE_PATH];
  return require(NORMALIZE_PATH);
}

console.log('Plan 392-03 Task 2: NFKC and format-character strip\n');

delete require.cache[GUARD_PATH];
const guard = require(GUARD_PATH);
const prompts = require(PROMPTS_PATH);
const opts = { toolName: 'brain_ask', roomDir: null };

check('N1 normalizeForGuard turns fullwidth letters into the plain form', function () {
  const n = loadNormalizer();
  assert.strictEqual(n.normalizeForGuard('ａbc'), 'abc');
  assert.strictEqual(n.normalizeForGuard(toFullwidth('Frame42')), 'Frame42');
});

check('N2 normalizeForGuard strips zero width space, soft hyphen and zero width joiner', function () {
  const n = loadNormalizer();
  assert.strictEqual(n.normalizeForGuard('a' + ZWSP + 'b' + SOFT_HYPHEN + 'c' + ZWJ + 'd'), 'abcd');
});

check('N3 plain ASCII unchanged, non-string gives empty string, FORMAT_CHAR_RE exported', function () {
  const n = loadNormalizer();
  const plain = 'recommend a framework for a wicked problem';
  assert.strictEqual(n.normalizeForGuard(plain), plain);
  assert.strictEqual(n.normalizeForGuard(null), '');
  assert.strictEqual(n.normalizeForGuard(undefined), '');
  assert.strictEqual(n.normalizeForGuard(42), '');
  assert.strictEqual(n.normalizeForGuard({ a: 1 }), '');
  assert.ok(n.FORMAT_CHAR_RE instanceof RegExp, 'FORMAT_CHAR_RE must be a RegExp');
  const probe = new RegExp(n.FORMAT_CHAR_RE.source, 'u');
  assert.ok(probe.test(ZWSP), 'FORMAT_CHAR_RE must match a zero width space');
  assert.ok(!probe.test('a'), 'FORMAT_CHAR_RE must not match a letter');
});

check('N4 a fullwidth credential-shaped question blocks', function () {
  const plain = guard.classify({ question: 'use ' + keyShape() }, opts);
  assert.strictEqual(plain.verdict, 'block', 'the plain key shape must block (control): ' + JSON.stringify(plain));
  const v = guard.classify({ question: 'use ' + toFullwidth(keyShape()) }, opts);
  assert.strictEqual(v.verdict, 'block', 'fullwidth key shape not blocked: ' + JSON.stringify(v));
  assert.strictEqual(v.class, plain.class, 'fullwidth key shape must carry the same class as the plain form');
});

check('N5 a credential-shaped question with a zero width space between every character blocks', function () {
  const v = guard.classify({ question: 'use ' + keyShape().split('').join(ZWSP) }, opts);
  assert.strictEqual(v.verdict, 'block', 'zero width space key shape not blocked: ' + JSON.stringify(v));
  assert.strictEqual(v.class, 'content_set', 'expected class content_set, got ' + JSON.stringify(v));
});

check('N6 auditQueryString reports the same hit for a fullwidth email-shaped string as for the plain one', function () {
  let plainHit = null;
  try { prompts.auditQueryString('contact ' + emailShape(), 'test'); } catch (e) { plainHit = e && e.meta && e.meta.matched_pattern; }
  assert.ok(plainHit, 'the plain email shape must hit (control)');
  let fwHit = null;
  try { prompts.auditQueryString('contact ' + toFullwidth(emailShape()), 'test'); } catch (e) { fwHit = e && e.meta && e.meta.matched_pattern; }
  assert.ok(fwHit, 'fullwidth email shape did not hit auditQueryString');
  assert.strictEqual(fwHit, plainHit, 'fullwidth and plain email shapes must report the same pattern');
  let objHit = null;
  try { prompts.auditQueryObject({ meta: { contact: toFullwidth(emailShape()) } }, 'test'); } catch (e) { objHit = e && e.meta && e.meta.matched_pattern; }
  assert.strictEqual(objHit, plainHit, 'auditQueryObject must report the same pattern for the fullwidth form');
});

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
const fixtures = replay.replayFixtures();
const extended = groupCounts(fixtures.rows, 'extended');
const mustRefuse = groupCounts(fixtures.rows, 'must_refuse');
console.log('  extended: allow ' + extended.allow + ' block ' + extended.block + ' (baseline allow ' + baseline.matrix.by_group.extended.allow + ' block ' + baseline.matrix.by_group.extended.block + ')');
console.log('  must_refuse: block ' + mustRefuse.block + ' of ' + (mustRefuse.allow + mustRefuse.ambiguous + mustRefuse.block));

check('N7 the extended questions still allow at the beta.81 count or higher; must_refuse still blocks', function () {
  assert.strictEqual(fixtures.network_calls, 0, 'the replay opened a network call');
  assert.ok(extended.allow >= baseline.matrix.by_group.extended.allow, 'extended allow dropped: ' + extended.allow + ' < baseline ' + baseline.matrix.by_group.extended.allow);
  const total = mustRefuse.allow + mustRefuse.ambiguous + mustRefuse.block;
  assert.strictEqual(total, baseline.matrix.by_group.must_refuse.block, 'must_refuse group size changed: ' + total);
  assert.strictEqual(mustRefuse.block, total, 'must_refuse not fully blocked: ' + JSON.stringify(mustRefuse));
});

check('N8 classify on a 4,000 character payload stays under 200 ms', function () {
  // A 4,000 character body of invented methodology prose with format
  // characters and fullwidth letters mixed in, so the normaliser does work.
  const unit = 'which framework fits an ill' + SOFT_HYPHEN + 'defined problem at the discovery stage' + ZWSP + '? ' + toFullwidth('compare two') + ' options. ';
  let body = '';
  while (body.length < 4000) body += unit;
  body = body.slice(0, 4000);
  guard.classify({ question: body }, opts); // warm the require graph
  const runs = 5;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < runs; i++) guard.classify({ question: body }, opts);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / runs;
  console.log('  timing: classify on 4000 characters, mean of ' + runs + ' runs: ' + ms.toFixed(2) + ' ms');
  assert.ok(ms < 200, 'classify took ' + ms.toFixed(2) + ' ms, limit 200 ms');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed.');
if (failed > 0) {
  console.log('FAIL: test-392-nfkc-format-strip');
  process.exit(1);
}
console.log('PASS: test-392-nfkc-format-strip');
process.exit(0);
