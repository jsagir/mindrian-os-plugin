#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Plan 392-09 (phase wave 3, item P3; 392-SC1, 392-SC3, 392-SC4): the typed
 * shape arm of the Part 8 guard.
 *
 * The three free-form Theo tools (brain_ask, brain_search,
 * classify_problem_type) accept their free-text key (question, query,
 * statement) plus an optional `shape` object. The shape is validated by exact
 * enum membership through lib/core/brain-shape-packet.cjs validateShapePacket
 * before anything else; a bad shape is a typed block (class shape_invalid,
 * the field named), never a repair. The free-text key is decided by
 * theoVerdict under a 240 character cap (reason question_too_long). Any other
 * key beside the pair is a block. A credential shape in the free text still
 * blocks. brain_write stays blocked (plan 386-04). The old sprout, edge and
 * body rules stay as a belt on the free-text key only.
 *
 * Carried decision (392-03 deviation 1, decided in this plan): under the
 * typed arm a non-Latin question is NOT blocked for its script. It fails the
 * typed-question fast path and then takes the same rules as any question:
 * the Unicode-aware room lexicon, the sprout rule, the credential and body
 * patterns, the 240 cap. The bare (unshaped) path keeps the 392-03 block.
 *
 * Part 8: every string in this file is invented. No room word, no room file
 * name, no Brain identifier. The synthetic room is the gate-lexgen room of
 * tests/helpers/synthetic-room-db.cjs (venture name "Brightmoor Kiln",
 * invented). The Hebrew sentence is generic prose written in escape-free
 * form; its meaning is "how to choose a framework for a new project".
 *
 * Arms:
 *   A1  brain_ask {question, shape(room-a)} allows (typed_question or
 *       generic_question) and carries shape_validated true. RED anchor.
 *   A2  shape.problem_type 'wicked' (wrong case) blocks shape_invalid with
 *       field problem_type.
 *   A3  {question, shape, context: <paragraph>} blocks (sibling leaf); the
 *       verdict carries no text.
 *   A4  {question: <241 character generic text>, shape} blocks with reason
 *       question_too_long.
 *   A5  {question: <credential shape built from parts>, shape} blocks
 *       content_set.
 *   A6  brain_search {query, shape} allows; classify_problem_type
 *       {statement, shape} allows.
 *   A7  brain_write {cypher, shape} blocks write_blocked (386-04).
 *   A8  a bad shape beside a body paragraph is refused shape_invalid before
 *       the sprout rule runs; a valid shape's enum members never reach the
 *       free-text walk (A1 is the positive half).
 *   A9  the belt: {question: <3 sentence synthetic body>, shape} returns the
 *       sprouts_required outcome, the four 386-27 fields equal to the bare
 *       question's outcome.
 *   A10 Hebrew (carried item): bare {question: <Hebrew>} still blocks
 *       (392-03); shaped {question: <Hebrew>, shape} with no room word and
 *       no credential shape allows generic_question.
 *   A11 Hebrew sentence carrying a room lexicon word, shaped, bound to the
 *       synthetic room: blocks room_content; the verdict carries no text.
 *   A12 the committed matrix tests/fixtures/392-part8-replay/
 *       matrix-after-arm.json exists, extended_blocked below 37 and not
 *       above the beta.81 baseline, must_refuse_blocked 10; a live replay
 *       agrees with the committed counts; network_calls 0.
 *
 * Plain Node. Exit 1 on any failure. No em dash and no en dash anywhere.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const GUARD_PATH = path.join(REPO_ROOT, 'lib', 'core', 'part8-egress-guard.cjs');
const SHAPE_ROOM_A = path.join(REPO_ROOT, 'tests', 'fixtures', '392-shape-rooms', 'room-a');
const BASELINE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', '392-part8-replay', 'baseline-beta81.json');
const AFTER_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', '392-part8-replay', 'matrix-after-arm.json');

// Isolate HOME and the room registry before any plugin module loads.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos392-09-arm-'));
fs.mkdirSync(path.join(TMP, 'home'));
fs.mkdirSync(path.join(TMP, 'registry'));
process.env.HOME = path.join(TMP, 'home');
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'registry');

const loader = require(path.join(REPO_ROOT, 'tests', 'helpers', 'audit-probe-loader.cjs'));
const replay = require(path.join(REPO_ROOT, 'tests', 'helpers', 'part8-overblock-replay.cjs'));
const shapePacket = require(path.join(REPO_ROOT, 'lib', 'core', 'brain-shape-packet.cjs'));

const GENERIC = 'what is jobs to be done';
const ROOM_WORD = 'Brightmoor Kiln';
// 3 sentences, no room word, no forbidden pattern (no company suffix, no
// money, no address, no city).
const BODY = 'The first draft of the plan was signed last spring. ' +
  'The second part covers the market size. The third part covers the pricing tiers.';
// 3 sentences with the room word: the sibling-leaf carrier.
const ROOM_PARAGRAPH = ROOM_WORD + ' signed the first draft of the plan last spring. ' +
  'The second part covers the market size. The third part covers the pricing tiers.';
// Invented Hebrew prose, 7 words: "how to choose a framework for a new
// project". No room word, no credential shape, no digit.
const HEBREW_QUESTION = 'איך לבחור מסגרת עבודה עבור פרויקט חדש';
// The same prose with the room word inserted as the project name.
const HEBREW_WITH_ROOM_WORD = 'איך לבחור מסגרת עבודה עבור הפרויקט ' + ROOM_WORD;
// A key-shaped string, built at run time from parts; never stored whole.
const CREDENTIAL = ['sk', '-', 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef'].join('');
// 241 characters of generic methodology words.
let LONG_QUESTION = '';
while (LONG_QUESTION.length < 241) LONG_QUESTION += 'which framework fits a wicked problem ';
LONG_QUESTION = LONG_QUESTION.slice(0, 241);

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

function noText(v, words) {
  const s = JSON.stringify(v);
  return words.every(function (w) { return s.indexOf(w) === -1; });
}

function groupCounts(rows, group) {
  const t = { allow: 0, ambiguous: 0, block: 0 };
  rows.forEach(function (r) { if (r.group === group) t[r.verdict] += 1; });
  return t;
}

console.log('Plan 392-09 Task 2: the typed shape arm\n');

const guard = freshGuard();
const built = shapePacket.buildShapePacket({ roomDir: SHAPE_ROOM_A });
const SHAPE = built.shape;
const BAD_SHAPE = Object.assign({}, SHAPE, { problem_type: 'wicked' });
const noRoom = { toolName: 'brain_ask', roomDir: null };

check('A0 fixture sanity: the room-a shape validates, the bad shape is refused on problem_type', function () {
  assert.deepStrictEqual(shapePacket.validateShapePacket(SHAPE), { ok: true });
  const r = shapePacket.validateShapePacket(BAD_SHAPE);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.field, 'problem_type');
});

check('A1 brain_ask {question, shape} allows and carries shape_validated true', function () {
  const v = guard.classify({ question: GENERIC, shape: SHAPE }, noRoom);
  assert.strictEqual(v.verdict, 'allow', 'shaped question not allowed: ' + JSON.stringify(v));
  assert.ok(v.class === 'typed_question' || v.class === 'generic_question', 'class ' + v.class);
  assert.strictEqual(v.shape_validated, true, 'shape_validated missing: ' + JSON.stringify(v));
});

check('A2 shape.problem_type wicked (wrong case) blocks shape_invalid with the field', function () {
  const v = guard.classify({ question: GENERIC, shape: BAD_SHAPE }, noRoom);
  assert.strictEqual(v.verdict, 'block', 'bad shape not blocked: ' + JSON.stringify(v));
  assert.strictEqual(v.class, 'shape_invalid', 'class ' + v.class + ': ' + JSON.stringify(v));
  assert.strictEqual(v.field, 'problem_type', 'field ' + v.field);
});

check('A3 {question, shape, context: paragraph} blocks (sibling leaf) with no text in the verdict', function () {
  const v = guard.classify({ question: GENERIC, shape: SHAPE, context: ROOM_PARAGRAPH }, noRoom);
  assert.strictEqual(v.verdict, 'block', 'sibling leaf not blocked: ' + JSON.stringify(v));
  assert.ok(noText(v, ['Brightmoor', 'spring', 'pricing']), 'the verdict carries text: ' + JSON.stringify(v));
  const short = guard.classify({ question: GENERIC, shape: SHAPE, context: 'swot' }, noRoom);
  assert.strictEqual(short.verdict, 'block', 'a short sibling leaf beside a shaped question was allowed: ' + JSON.stringify(short));
});

check('A4 a 241 character question beside a shape blocks with reason question_too_long', function () {
  assert.strictEqual(LONG_QUESTION.length, 241);
  const v = guard.classify({ question: LONG_QUESTION, shape: SHAPE }, noRoom);
  assert.strictEqual(v.verdict, 'block', 'long question not blocked: ' + JSON.stringify(v));
  assert.strictEqual(v.reason, 'question_too_long', 'reason ' + v.reason);
  const ok240 = guard.classify({ question: LONG_QUESTION.slice(0, 240).trim(), shape: SHAPE }, noRoom);
  assert.notStrictEqual(ok240.reason, 'question_too_long', '240 characters hit the cap: ' + JSON.stringify(ok240));
});

check('A5 a credential shape in the question beside a valid shape blocks content_set', function () {
  const v = guard.classify({ question: 'the key is ' + CREDENTIAL, shape: SHAPE }, noRoom);
  assert.strictEqual(v.verdict, 'block', 'credential not blocked: ' + JSON.stringify(v));
  assert.strictEqual(v.class, 'content_set', 'class ' + v.class);
  assert.ok(noText(v, [CREDENTIAL]), 'the verdict carries the credential');
});

check('A6 brain_search {query, shape} and classify_problem_type {statement, shape} allow', function () {
  const s = guard.classify({ query: 'jobs to be done', shape: SHAPE }, { toolName: 'brain_search', roomDir: null });
  assert.strictEqual(s.verdict, 'allow', 'brain_search shaped query not allowed: ' + JSON.stringify(s));
  assert.strictEqual(s.shape_validated, true);
  const c = guard.classify({ statement: 'jobs to be done', shape: SHAPE }, { toolName: 'mcp__theo__classify_problem_type', roomDir: null });
  assert.strictEqual(c.verdict, 'allow', 'classify_problem_type shaped statement not allowed: ' + JSON.stringify(c));
  assert.strictEqual(c.shape_validated, true);
  const cBad = guard.classify({ statement: 'jobs to be done', shape: BAD_SHAPE }, { toolName: 'classify_problem_type', roomDir: null });
  assert.strictEqual(cBad.class, 'shape_invalid', 'classify_problem_type bad shape: ' + JSON.stringify(cBad));
  const sBad = guard.classify({ query: 'jobs to be done', shape: BAD_SHAPE }, { toolName: 'brain_search', roomDir: null });
  assert.strictEqual(sBad.class, 'shape_invalid', 'brain_search bad shape: ' + JSON.stringify(sBad));
});

check('A7 brain_write {cypher, shape} stays blocked write_blocked (386-04)', function () {
  const v = guard.classify({ cypher: 'CREATE (n)', shape: SHAPE }, { toolName: 'brain_write', roomDir: null });
  assert.strictEqual(v.verdict, 'block');
  assert.strictEqual(v.class, 'write_blocked', 'class ' + v.class);
});

check('A8 a bad shape beside a body is refused shape_invalid before the sprout rule; a shaped question is never typed_question by its shape alone', function () {
  const v = guard.classify({ question: BODY, shape: BAD_SHAPE }, noRoom);
  assert.strictEqual(v.class, 'shape_invalid', 'bad shape beside a body: ' + JSON.stringify(v));
  // A shape whose members are enum ids never enters the free-text walk: a
  // question that is generic stays generic_question with the shape beside it.
  const g = guard.classify({ question: 'how do teams pick a method for a new project', shape: SHAPE }, noRoom);
  assert.strictEqual(g.verdict, 'allow', JSON.stringify(g));
  assert.strictEqual(g.class, 'generic_question', 'class ' + g.class);
});

check('A9 the belt: a 3 sentence body beside a shape returns the sprouts_required outcome of the bare question', function () {
  const bare = guard.classify({ question: BODY }, noRoom);
  assert.strictEqual(bare.class, 'sprouts_required', 'bare body: ' + JSON.stringify(bare));
  const v = guard.classify({ question: BODY, shape: SHAPE }, noRoom);
  assert.strictEqual(v.verdict, bare.verdict);
  assert.strictEqual(v.class, bare.class);
  assert.strictEqual(v.token_class, bare.token_class);
  assert.strictEqual(v.reason, bare.reason);
  assert.strictEqual(v.shape_validated, true);
});

check('A10 Hebrew: the bare question still blocks (392-03); the shaped question with no room word allows generic_question', function () {
  const bare = guard.classify({ question: HEBREW_QUESTION }, noRoom);
  assert.strictEqual(bare.verdict, 'block', 'bare Hebrew question allowed: ' + JSON.stringify(bare));
  const v = guard.classify({ question: HEBREW_QUESTION, shape: SHAPE }, noRoom);
  assert.strictEqual(v.verdict, 'allow', 'shaped Hebrew question blocked: ' + JSON.stringify(v));
  assert.strictEqual(v.class, 'generic_question', 'class ' + v.class);
  assert.strictEqual(v.shape_validated, true);
});

const rooms = loader.makeRooms(path.join(TMP, 'rooms'), REPO_ROOT);
const roomDir = rooms.roomFor('gate-lexgen');

check('A11 Hebrew sentence carrying a room lexicon word, shaped and bound, blocks room_content with no text', function () {
  const v = guard.classify({ question: HEBREW_WITH_ROOM_WORD, shape: SHAPE }, { toolName: 'brain_ask', roomDir: roomDir });
  assert.strictEqual(v.verdict, 'block', 'room word in a Hebrew sentence allowed: ' + JSON.stringify(v));
  assert.strictEqual(v.class, 'room_content', 'class ' + v.class);
  assert.ok(noText(v, ['Brightmoor', 'Kiln']), 'the verdict carries the room word');
  const clean = guard.classify({ question: HEBREW_QUESTION, shape: SHAPE }, { toolName: 'brain_ask', roomDir: roomDir });
  assert.strictEqual(clean.verdict, 'allow', 'clean Hebrew question blocked under the bound room: ' + JSON.stringify(clean));
});

check('A12 the committed matrix after the arm: below 37, not above the beta.81 baseline, must_refuse 10, live replay agrees', function () {
  assert.ok(fs.existsSync(AFTER_PATH), 'missing ' + path.relative(REPO_ROOT, AFTER_PATH) + ' (record it with the harness)');
  const after = JSON.parse(fs.readFileSync(AFTER_PATH, 'utf8'));
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  replay.assertMatrixHygiene(after.matrix);
  replay.assertDocumentHygiene(after);
  assert.strictEqual(after.network_calls, 0, 'network_calls ' + after.network_calls);
  assert.ok(after.matrix.extended_blocked < 37, 'extended_blocked ' + after.matrix.extended_blocked + ' is not below 37');
  assert.ok(after.matrix.extended_blocked <= baseline.matrix.extended_blocked,
    'extended_blocked ' + after.matrix.extended_blocked + ' is above the beta.81 baseline ' + baseline.matrix.extended_blocked);
  assert.strictEqual(after.matrix.must_refuse_blocked, 10, 'must_refuse_blocked ' + after.matrix.must_refuse_blocked);
  const live = replay.replayFixtures();
  assert.strictEqual(live.network_calls, 0, 'the live replay opened a network call');
  const ext = groupCounts(live.rows, 'extended');
  const mr = groupCounts(live.rows, 'must_refuse');
  console.log('    live: extended allow ' + ext.allow + ' block ' + ext.block + ', must_refuse block ' + mr.block + ' of ' + (mr.allow + mr.ambiguous + mr.block));
  assert.strictEqual(ext.block, after.matrix.extended_blocked, 'live extended_blocked ' + ext.block + ' differs from the committed ' + after.matrix.extended_blocked);
  assert.strictEqual(mr.block, after.matrix.must_refuse_blocked, 'live must_refuse_blocked ' + mr.block + ' differs from the committed ' + after.matrix.must_refuse_blocked);
});

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }

console.log('\n' + passed + ' passed, ' + failed + ' failed.');
if (failed > 0) {
  console.log('FAIL: test-392-typed-shape-arm');
  process.exit(1);
}
console.log('PASS: test-392-typed-shape-arm');
process.exit(0);
