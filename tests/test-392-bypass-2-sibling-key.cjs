#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 392-05, Task 1 (bypass 2 of F6): a free-text sibling key beside a
 * generic question must be scanned.
 *
 * Why it passed on beta.81: _extractFreeFormString (part8-egress-guard.cjs
 * :255) reads the first FREEFORM_KEY only, so {question: generic, context:
 * <room paragraph>} is decided by the question alone. Step 1 (the default-deny
 * scan) still runs over the sibling, but a paragraph that names a room word
 * and matches no forbidden pattern clears it, and the payload reaches the
 * wire as generic_question. The same hole covers an array leaf and a nested
 * leaf.
 *
 * Part 8: every string in this file is invented. The room is the synthetic
 * gate-lexgen room of tests/helpers/synthetic-room-db.cjs (venture name
 * "Brightmoor Kiln", invented); no real room word, room file name or Brain
 * identifier appears here.
 *
 * Cases:
 *   S1  {question: generic, context: <paragraph>} blocks.
 *   S2  {question: generic, notes: [<paragraph>]} (array leaf) blocks.
 *   S3  {question: generic, meta: {deep: {text: <paragraph>}}} (nested leaf)
 *       blocks.
 *   S4  the generic question alone still allows; a generic sibling handle
 *       (job key, framework handle) still allows.
 *   S5  a sibling block names the key path (leaf_path) and never the text.
 *   S6  _collectStringLeaves is exported: every string leaf with its path;
 *       past depth 8 or 2,000 nodes it answers {over_budget: true}; classify
 *       refuses such a payload (content_set, over_budget).
 *   S7  the 535 extended questions still allow at the beta.81 count or higher
 *       and the 10 must_refuse cases still block.
 *
 * Plain Node. Exit 1 on any failure. No em dash and no en dash anywhere.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const GUARD_PATH = path.join(REPO_ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const BASELINE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', '392-part8-replay', 'baseline-beta81.json');

// Isolate HOME and the room registry before any plugin module loads.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos392-05-b2-'));
fs.mkdirSync(path.join(TMP, 'home'));
fs.mkdirSync(path.join(TMP, 'registry'));
process.env.HOME = path.join(TMP, 'home');
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'registry');

const loader = require(path.join(REPO_ROOT, 'tests', 'helpers', 'audit-probe-loader.cjs'));
const replay = require(path.join(REPO_ROOT, 'tests', 'helpers', 'part8-overblock-replay.cjs'));

const ROOM_WORD = 'Brightmoor Kiln';
const GENERIC = 'what is jobs to be done';
// 3 sentences, one room word, no forbidden pattern (no company suffix, no
// money, no address): the default-deny scan of step 1 clears it on purpose.
const PARAGRAPH = ROOM_WORD + ' signed the first draft of the plan last spring. ' +
  'The second paragraph covers the market size. The third paragraph covers the pricing tiers.';

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

function noText(v) {
  const s = JSON.stringify(v);
  return s.indexOf('Brightmoor') === -1 && s.indexOf('paragraph') === -1 && s.indexOf('pricing') === -1;
}

console.log('Plan 392-05 Task 1: bypass 2, sibling free-text key\n');

const guard = freshGuard();
const rooms = loader.makeRooms(path.join(TMP, 'rooms'), REPO_ROOT);
const roomDir = rooms.roomFor('gate-lexgen');
const opts = { toolName: 'brain_ask', roomDir: roomDir };

check('S0 the paragraph alone blocks under the synthetic room (fixture sanity)', function () {
  const v = guard.classify({ question: PARAGRAPH }, opts);
  assert.strictEqual(v.verdict, 'block', 'paragraph alone did not block: ' + JSON.stringify(v));
});

check('S1 a sibling key (context) beside a generic question is scanned and blocks', function () {
  const v = guard.classify({ question: GENERIC, context: PARAGRAPH }, opts);
  assert.strictEqual(v.verdict, 'block', 'sibling key not scanned: ' + JSON.stringify(v));
});

check('S2 an array leaf (notes[0]) beside a generic question is scanned and blocks', function () {
  const v = guard.classify({ question: GENERIC, notes: [PARAGRAPH] }, opts);
  assert.strictEqual(v.verdict, 'block', 'array leaf not scanned: ' + JSON.stringify(v));
});

check('S3 a nested leaf (meta.deep.text) beside a generic question is scanned and blocks', function () {
  const v = guard.classify({ question: GENERIC, meta: { deep: { text: PARAGRAPH } } }, opts);
  assert.strictEqual(v.verdict, 'block', 'nested leaf not scanned: ' + JSON.stringify(v));
});

check('S4 the generic question alone, and with a generic sibling handle, still allows', function () {
  const alone = guard.classify({ question: GENERIC }, opts);
  assert.strictEqual(alone.verdict, 'allow', 'generic question alone: ' + JSON.stringify(alone));
  const withJob = guard.classify({ question: 'swot analysis', job: 'select_methodology' }, opts);
  assert.strictEqual(withJob.verdict, 'allow', 'generic question with a job key: ' + JSON.stringify(withJob));
  const withHandle = guard.classify({ question: GENERIC, framework: 'jobs to be done' }, opts);
  assert.strictEqual(withHandle.verdict, 'allow', 'generic question with a framework handle: ' + JSON.stringify(withHandle));
});

check('S5 a sibling block names the key path and never the text', function () {
  const a = guard.classify({ question: GENERIC, context: PARAGRAPH }, opts);
  assert.strictEqual(a.leaf_path, 'context', 'leaf_path for the sibling: ' + JSON.stringify(a));
  const b = guard.classify({ question: GENERIC, notes: [PARAGRAPH] }, opts);
  assert.strictEqual(b.leaf_path, 'notes.0', 'leaf_path for the array leaf: ' + JSON.stringify(b));
  const c = guard.classify({ question: GENERIC, meta: { deep: { text: PARAGRAPH } } }, opts);
  assert.strictEqual(c.leaf_path, 'meta.deep.text', 'leaf_path for the nested leaf: ' + JSON.stringify(c));
  [a, b, c].forEach(function (v) { assert.ok(noText(v), 'a verdict carries text: ' + JSON.stringify(v)); });
});

check('S6 _collectStringLeaves: every string leaf with its path; over budget is typed and refused', function () {
  assert.strictEqual(typeof guard._collectStringLeaves, 'function', '_collectStringLeaves is not exported');
  const leaves = guard._collectStringLeaves({ question: GENERIC, notes: ['a', 'b'], meta: { deep: { text: 'c' } }, n: 3 });
  assert.ok(Array.isArray(leaves), 'leaves is not an array: ' + JSON.stringify(leaves));
  const paths = leaves.map(function (l) { return l.path; }).sort();
  assert.deepStrictEqual(paths, ['meta.deep.text', 'notes.0', 'notes.1', 'question']);
  // depth 10
  const deep = {};
  let cur = deep;
  for (let i = 0; i < 10; i += 1) { cur.k = {}; cur = cur.k; }
  cur.leaf = GENERIC;
  const d = guard._collectStringLeaves(Object.assign({ question: GENERIC }, deep));
  assert.strictEqual(d && d.over_budget, true, 'depth 10 did not answer over_budget: ' + JSON.stringify(d));
  // 2,100 nodes
  const wide = { question: GENERIC };
  for (let i = 0; i < 2100; i += 1) wide['k' + i] = 'swot';
  const w = guard._collectStringLeaves(wide);
  assert.strictEqual(w && w.over_budget, true, '2,100 nodes did not answer over_budget: ' + JSON.stringify(w));
  const vd = guard.classify(Object.assign({ question: GENERIC }, deep), opts);
  assert.strictEqual(vd.verdict, 'block', 'deep payload not refused: ' + JSON.stringify(vd));
  assert.strictEqual(vd.class, 'content_set', 'deep payload class: ' + JSON.stringify(vd));
  assert.strictEqual(vd.reason, 'over_budget', 'deep payload reason: ' + JSON.stringify(vd));
  const vw = guard.classify(wide, opts);
  assert.strictEqual(vw.verdict, 'block', 'wide payload not refused: ' + JSON.stringify(vw));
  assert.strictEqual(vw.reason, 'over_budget', 'wide payload reason: ' + JSON.stringify(vw));
});

const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
const baseExtended = baseline.matrix.by_group.extended;
const baseMustRefuse = baseline.matrix.by_group.must_refuse;
const fixtures = replay.replayFixtures();
const extended = groupCounts(fixtures.rows, 'extended');
const mustRefuse = groupCounts(fixtures.rows, 'must_refuse');
console.log('  extended: allow ' + extended.allow + ' block ' + extended.block + ' (baseline allow ' + baseExtended.allow + ' block ' + baseExtended.block + ')');
console.log('  must_refuse: block ' + mustRefuse.block + ' of ' + (mustRefuse.allow + mustRefuse.ambiguous + mustRefuse.block));

check('S7 the extended questions allow at the beta.81 count or higher; must_refuse all block', function () {
  assert.strictEqual(fixtures.network_calls, 0, 'the replay opened a network call');
  assert.ok(extended.allow >= baseExtended.allow, 'extended allow dropped: ' + extended.allow + ' < baseline ' + baseExtended.allow);
  const total = mustRefuse.allow + mustRefuse.ambiguous + mustRefuse.block;
  assert.strictEqual(total, baseMustRefuse.block, 'must_refuse group size changed: ' + total);
  assert.strictEqual(mustRefuse.block, total, 'must_refuse not fully blocked: ' + JSON.stringify(mustRefuse));
});

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }

console.log('\n' + passed + ' passed, ' + failed + ' failed.');
if (failed > 0) {
  console.log('FAIL: test-392-bypass-2-sibling-key');
  process.exit(1);
}
console.log('PASS: test-392-bypass-2-sibling-key');
process.exit(0);
