#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 18 (369.2-R18; INPUT defect 3). A "thin" verdict counted only supports and contradicts
 * rows as bearing on the question, so a run that fetched the two papers that would decide the question
 * said nothing about them. The run now scores every fetched record against the governing question, the
 * leaf questions and the slot terms with the strict-majority content-token rule, carries
 * run.bearing_records {count, ids}, and the thin line says how many records match.
 *
 *   T1   a quick run (root-cause template, the INPUT governing question) whose searches all return the
 *        recorded body input_session_lane_b: run.bearing_records.count is 2 and holds both record ids
 *        (before this plan the verdict counted 0)
 *   T2   the verdict is thin and the answer line reads '2 records match the question, and none were read
 *        for or against it'; the line passes the jobs-and-moves register lint
 *   T2b  answerLine unit contract: 0 bearing, 1 bearing (singular), rows present keeps the old sentence,
 *        and a context without a bearing count keeps the old sentence
 *   T3   a record that shares only one content token with every needle is not bearing, and the thin line
 *        says no fetched record matches the question
 *   T4   quick.localRoomCheck returns identical results before and after the content-tokens move (the
 *        pre-plan quick.cjs is loaded from git at b88dbd417 and run on the same fixture room)
 *   T5   content-tokens.cjs: no requires, the three exports, quick.cjs no longer defines contentTokens
 *   T6   no em-dash or en-dash in this file or in the fixture body file
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are mkdtemp dirs before any repo module loads; vendor
 * keys are deleted; the provider is the OpenAlex replay reached through the REAL corpus path; a net guard
 * counts any fetch that escapes the replay.
 *
 * Output: one PASS or FAIL line per leg, then PASS: n FAIL: n. Exit 0 pass, 1 fail.
 * House rule: hyphens only.
 */

const real = require('./helpers/real-corpus-3692.cjs');
const hermetic = real.hermeticEnv();
['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_BRAIN_URL'].forEach(function (k) {
  process.env[k] = hermetic[k];
});
real.VENDOR_KEYS.forEach(function (k) { delete process.env[k]; });
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const { check, summary } = makeChecker('test-3692-thin');

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const Module = require('node:module');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const RP = path.join(ROOT, 'lib', 'core', 'research-planner');
const planner = require(path.join(RP, 'planner.cjs'));
const grants = require(path.join(RP, 'grants.cjs'));
const quickMod = require(path.join(RP, 'quick.cjs'));
const verdictMod = require(path.join(RP, 'verdict.cjs'));
const { buildRoom363 } = require('./helpers/fixture-room-363.cjs');
const { makeReplayFetch } = require('./helpers/openalex-replay-363.cjs');
const { lintLine } = require('./helpers/jobs-moves-lint-3692.cjs');
const corpus = require(path.join(ROOT, 'lib', 'core', 'research-corpus.cjs'));

const BODY_FILE = path.join(ROOT, 'tests', 'fixtures', '3692-openalex', 'bodies.json');
const BODIES = JSON.parse(fs.readFileSync(BODY_FILE, 'utf8'));
const QS_RC = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'root-cause.json'), 'utf8'));
const VIA = { surface: 'cli', decision_node_id: 'd-3692-18-test' };
const BASE_SHA = 'b88dbd417'; // the tree this plan started from

const GOVERNING = 'Can AI placed on the evidence side help high school students test historical claims?';

// A record that shares exactly one content token ("evidence") with the governing question and with every
// other needle of the plan (a synthetic geology note).
const ONE_TOKEN_BODY = {
  meta: { count: 1, db_response_time_ms: 41, page: 1, per_page: 200, groups_count: null, cost_usd: 0.001 },
  results: [{
    id: 'https://openalex.org/W9369290',
    doi: 'https://doi.org/10.0000/synth3692.290',
    title: 'Evidence from lake sediment cores',
    abstract_inverted_index: { Synthetic: [0], fixture: [1], text: [2], on: [3], sediment: [4], layers: [5], and: [6], pollen: [7], counts: [8] },
    publication_year: 2015,
    type: 'article',
    is_retracted: false,
    cited_by_count: 3,
    primary_location: { source: { display_name: 'Synthetic Journal of Geology', is_in_doaj: false } },
    authorships: [],
  }],
  group_by: [],
};

const rooms = [];
function newRoom() {
  const r = buildRoom363({ role: 'researcher' });
  rooms.push(r);
  return r;
}
process.on('exit', function () {
  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* best effort */ } });
});

function clone(v) { return JSON.parse(JSON.stringify(v)); }

async function leg(name, fn) {
  try {
    const r = await fn();
    check(name, r === true, String(r));
  } catch (e) {
    check(name, false, String((e && e.message) || e).replace(/\s+/g, ' ').slice(0, 500));
  }
}

// the INPUT session's question set: the governing question is the INPUT one, every leaf carries slot terms
// that compose a search within the quick cap, and no slot term appears verbatim in any fixture abstract (so no deterministic row)
function inputQuestionSet() {
  const qs = clone(QS_RC);
  qs.stated_question = GOVERNING;
  qs.scqa.question = GOVERNING;
  qs.leaves[0].question = GOVERNING;
  qs.leaves[0].slots = { cause: 'source verification software', effect: 'claim testing skill' };
  qs.leaves[1].question = 'Does a planted account survive debriefing in a high school history class?';
  qs.leaves[1].slots = { cause: 'planted account', effect: 'student belief' };
  // two leaves: the quick cap of 3 searches reaches both, so no leaf is left without a composed search
  qs.leaves = qs.leaves.slice(0, 2);
  return qs;
}

// one quick run through the REAL corpus; every search is answered with bodyKey from `bodies`
async function quickRun(bodyKey, bodies) {
  const room = newRoom();
  const built = planner.buildPlan(room.roomDir, inputQuestionSet(), { mode: 'quick', now: new Date('2026-10-04T00:00:00Z') });
  if (!built.ok) throw new Error('buildPlan ' + JSON.stringify(built));
  const plan = built.plan;
  const w = grants.writeGrant(room.roomDir, grants.buildRunGrant(plan), { approved_via: VIA });
  if (!w.ok) throw new Error('quick grant refused ' + JSON.stringify(w));
  const rp = makeReplayFetch({ route: function () { return bodyKey; }, bodies: bodies });
  async function fetchEnvelopeFn(args) {
    const prev = globalThis.fetch;
    globalThis.fetch = rp;
    try { return await corpus.fetchCorpusEnvelope(args); } finally { globalThis.fetch = prev; }
  }
  const out = await quickMod.runQuick(room.roomDir, plan, { fetchEnvelopeFn: fetchEnvelopeFn, now: Date.now() });
  if (out.status !== 'done') throw new Error('quick ' + out.status + ' ' + out.reason);
  return { room: room, plan: plan, run: out.run, calls: rp.calls };
}

const LINES = [];

async function main() {
  const lead = await quickRun('input_session_lane_b', BODIES);

  await leg('T1 the two lane-B records of the INPUT session count as 2 bearing records (before this plan: 0)', async function () {
    const run = lead.run;
    const oldCount = run.rows.filter(function (r) { return r && (r.label === 'supports' || r.label === 'contradicts'); }).length;
    console.log('T1 measured: verdict=' + run.verdict + ' searches=' + lead.calls.length + ' rows_that_bear_old_rule=' + oldCount
      + ' bearing_records=' + JSON.stringify(run.bearing_records));
    assert.ok(run.bearing_records && typeof run.bearing_records === 'object', 'run.bearing_records is absent');
    assert.strictEqual(run.bearing_records.count, 2, 'bearing count ' + run.bearing_records.count);
    assert.deepStrictEqual(run.bearing_records.ids.slice().sort(), ['https://openalex.org/W9369201', 'https://openalex.org/W9369202']);
    const dois = BODIES.input_session_lane_b.results.map(function (r) { return r.doi; });
    assert.deepStrictEqual(dois, ['https://doi.org/10.1080/08850607.2016.1230706', 'https://doi.org/10.1080/02684527.2017.1400230']);
    assert.strictEqual(oldCount, 0, 'the old rule would have counted ' + oldCount + ' rows');
    return true;
  });

  await leg('T2 a thin verdict says how many records match the question and that none were read for or against it', async function () {
    const line = lead.run.answer_line;
    LINES.push(line);
    console.log('T2 measured: answer=' + line);
    assert.strictEqual(lead.run.verdict, 'thin', 'verdict ' + lead.run.verdict);
    assert.ok(line.indexOf('There is not enough here to call it') !== -1, 'thin opening is absent');
    assert.ok(line.indexOf('2 records match the question, and none were read for or against it') !== -1, 'bearing sentence is absent');
    assert.ok(line.indexOf('bear on the question') === -1, 'the old row sentence is still present');
    const bad = lintLine(line, { complete: lead.run.completion.complete });
    assert.strictEqual(bad.length, 0, bad.map(function (v) { return v.rule + '=' + v.match; }).join(', '));
    return true;
  });

  await leg('T2b answerLine: 0 bearing, 1 bearing, rows present, and no bearing count each read as specified', async function () {
    const thin = { verdict: 'thin', primary_count: null, cover_count: null, floor: 3 };
    const none = verdictMod.answerLine(thin, { rows: [], bearing: 0 });
    const one = verdictMod.answerLine(thin, { rows: [], bearing: 1 });
    const two = verdictMod.answerLine(thin, { rows: [], bearing: 2 });
    const withRows = verdictMod.answerLine(thin, { rows: [{ label: 'supports' }, { label: 'contradicts' }], bearing: 4 });
    const noCtx = verdictMod.answerLine(thin, { rows: [] });
    assert.ok(none.indexOf('no fetched record matches the question.') !== -1, none);
    assert.ok(one.indexOf('1 record matches the question, and none were read for or against it.') !== -1, one);
    assert.ok(two.indexOf('2 records match the question, and none were read for or against it.') !== -1, two);
    assert.ok(withRows.indexOf('2 rows bear on the question.') !== -1, withRows);
    assert.ok(noCtx.indexOf('0 rows bear on the question.') !== -1, noCtx);
    return true;
  });

  await leg('T3 a record sharing one content token with every needle is not bearing; the thin line says none match', async function () {
    const bodies = Object.assign({}, BODIES, { one_token: ONE_TOKEN_BODY });
    const r = await quickRun('one_token', bodies);
    const line = r.run.answer_line;
    LINES.push(line);
    console.log('T3 measured: verdict=' + r.run.verdict + ' bearing_records=' + JSON.stringify(r.run.bearing_records) + ' answer=' + line);
    assert.ok(r.run.bearing_records, 'bearing_records absent');
    assert.strictEqual(r.run.bearing_records.count, 0);
    assert.deepStrictEqual(r.run.bearing_records.ids, []);
    assert.strictEqual(r.run.verdict, 'thin');
    assert.ok(line.indexOf('no fetched record matches the question.') !== -1, line);
    return true;
  });

  await leg('T4 localRoomCheck is identical before and after the content-tokens move on the 363 fixture room', async function () {
    const room = newRoom();
    const note = path.join(room.roomDir, 'market-analysis', 'cavitation-note', 'cavitation-note.md');
    fs.mkdirSync(path.dirname(note), { recursive: true });
    fs.writeFileSync(note, '# Cavitation note\n\nAcoustic cavitation methods for removing biofilm from closed water loops, with 3 trials.\n', 'utf8');
    const terms = [
      ['acoustic cavitation'],
      ['biofilm cavitation methods'],
      ['removing biofilm closed loops'],
      ['quantum entanglement'],
      ['water'],
      ['the and of'],
      ['trials 3'],
      ['biofilm removal methods', 'quantum entanglement'],
      [],
    ];
    const src = cp.spawnSync('git', ['-C', ROOT, 'show', BASE_SHA + ':lib/core/research-planner/quick.cjs'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    assert.strictEqual(src.status, 0, 'git show ' + BASE_SHA + ' failed: ' + String(src.stderr).slice(0, 200));
    // compile the pre-plan source at the real path so its relative requires resolve to the live modules
    const realPath = path.join(RP, 'quick.cjs');
    const old = new Module(realPath, null);
    old.filename = realPath;
    old.paths = Module._nodeModulePaths(path.dirname(realPath));
    old._compile(src.stdout, realPath);
    assert.strictEqual(typeof old.exports.localRoomCheck, 'function', 'the pre-plan module has no localRoomCheck');
    const before = terms.map(function (t) { return old.exports.localRoomCheck(room.roomDir, t); });
    const after = terms.map(function (t) { return quickMod.localRoomCheck(room.roomDir, t); });
    const flagged = after.filter(function (a) { return a.flagged; }).length;
    console.log('T4 measured: term sets=' + terms.length + ' flagged=' + flagged + ' identical=' + (JSON.stringify(before) === JSON.stringify(after)));
    assert.ok(flagged >= 3 && flagged < terms.length, 'the term sets do not separate hits from misses: flagged=' + flagged);
    assert.deepStrictEqual(after, before);
    return true;
  });

  await leg('T5 content-tokens.cjs has no requires and three exports; quick.cjs no longer defines contentTokens', async function () {
    const file = path.join(RP, 'content-tokens.cjs');
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(!/\brequire\s*\(/.test(text), 'content-tokens.cjs requires something');
    const mod = require(file);
    ['contentTokens', 'STOP_WORDS', 'coversByMajority'].forEach(function (k) { assert.ok(k in mod, 'missing export ' + k); });
    assert.deepStrictEqual(mod.contentTokens('the cat and a dog on 7'), ['cat', 'dog', '7']);
    const set = new Set(['alpha', 'beta', 'gamma']);
    assert.strictEqual(mod.coversByMajority(set, ['alpha', 'beta', 'delta']), true, '2 of 3 is a majority');
    assert.strictEqual(mod.coversByMajority(set, ['alpha', 'delta', 'omega']), false, '1 of 3 is not');
    assert.strictEqual(mod.coversByMajority(set, ['alpha']), false, 'a one-token needle never covers by majority');
    assert.strictEqual(mod.coversByMajority(set, ['alpha', 'delta']), false, '1 of 2 is not more than half');
    assert.ok(mod.STOP_WORDS.has('the') && !mod.STOP_WORDS.has('evidence'));
    const quickSrc = fs.readFileSync(path.join(RP, 'quick.cjs'), 'utf8');
    assert.ok(!/function contentTokens/.test(quickSrc), 'quick.cjs still defines contentTokens');
    return true;
  });

  await leg('T6 no em-dash or en-dash in this file or in the fixture body file', async function () {
    const dash = new RegExp('[' + String.fromCharCode(0x2014) + String.fromCharCode(0x2013) + ']');
    [__filename, BODY_FILE].forEach(function (f) {
      assert.ok(!dash.test(fs.readFileSync(f, 'utf8')), 'dash in ' + f);
    });
    return true;
  });

  check('T0 no fetch escaped the replay', NET.attempts() === 0, 'net guard attempts ' + NET.attempts());
  process.exitCode = summary();
}

main().catch(function (e) {
  console.log('FAIL: harness ' + String((e && e.stack) || e).slice(0, 800));
  process.exit(1);
});
