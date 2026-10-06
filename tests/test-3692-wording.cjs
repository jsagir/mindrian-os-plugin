#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 16 (369.2-R07, R25 report share; annex C01-C03, C16, C17; brief AI-04 gate half and
 * test 16, incomplete-evidence wording half). The run's own words carry its execution truth.
 *
 * Measured before this plan: the deep answer line read "The deep run stopped on <stop> after N searches and
 * K validated rows; the governing thought reads X with Y unresolved branches", and the quick line counted
 * rows only. Neither said which question was not searched, that an empty result is only what one query
 * returned, or whether the searches for evidence against the claim ran.
 *
 *   WD1  HARNESS-01 cap 8 (default reserve): the deep answer names 'Only <x> of <y> searches for evidence
 *        against it ran (' with the search-budget reason words
 *   WD1b a deep run whose falsifier operations never ran: 'Not verified: the searches for evidence against it
 *        did not run ('
 *   WD2  a deep run with a lane_cap operation: '"<that question>" was not searched: the run looks at a
 *        limited number of lines of inquiry at once'
 *   WD3  a quick run with executed_empty queries: the C03 sentence, exact, naming the query and OpenAlex
 *   WD4  C17: evidence-against work done in round one reads 'ran inside the first round ('
 *   WD5  the register lint over every answer line from WD1-WD4 and the quick run: violations=0
 *   WD6  hermetic real-room-run (release-room seed, replay preload, --read-by): the report counts operations
 *        'of' planned, "It could not" names incomplete jobs, the receipt carries the six new numbers, and
 *        the release gate still accepts it
 *   WD7  job-lines unit contract: the exact reason words, the label cut, the collapse by dimension, the
 *        count of the rest, the four evidence-against sentences, no line for not_needed
 *   WD9  a refused search slot: not searched with its reason, verdict unresolved, card section Not searched
 *   WD8  no em-dash or en-dash in this file
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
const { check, summary } = makeChecker('test-3692-wording');

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const RP = path.join(ROOT, 'lib', 'core', 'research-planner');
const planMod = require(path.join(RP, 'plan.cjs'));
const planner = require(path.join(RP, 'planner.cjs'));
const grants = require(path.join(RP, 'grants.cjs'));
const deepMod = require(path.join(RP, 'deep.cjs'));
const quickMod = require(path.join(RP, 'quick.cjs'));
const operations = require(path.join(RP, 'operations.cjs'));
const { buildRoom363 } = require('./helpers/fixture-room-363.cjs');
const { makeReplayFetch } = require('./helpers/openalex-replay-363.cjs');
const { lintLine } = require('./helpers/jobs-moves-lint-3692.cjs');
const corpus = require(path.join(ROOT, 'lib', 'core', 'research-corpus.cjs'));

const QS_SR = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'scientific-roadmapping.json'), 'utf8'));
const QS_WS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'whitespace-quick.json'), 'utf8'));
const BODIES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-openalex', 'bodies.json'), 'utf8'));
const VIA = { surface: 'cli', decision_node_id: 'd-3692-16-test' };

const rooms = [];
function newRoom() {
  const r = buildRoom363({ role: 'researcher' });
  rooms.push(r);
  return r;
}
const TMP = [];
function mk(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 't3692-16-' + prefix + '-'));
  TMP.push(d);
  return d;
}
process.on('exit', function () {
  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* best effort */ } });
  TMP.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
});

function clone(v) { return JSON.parse(JSON.stringify(v)); }
function isCe(o) { return typeof o.plan_dimension === 'string' && o.plan_dimension.indexOf('CE:') === 0; }

async function leg(name, fn) {
  try {
    const r = await fn();
    check(name, r === true, String(r));
  } catch (e) {
    check(name, false, String((e && e.message) || e).replace(/\s+/g, ' ').slice(0, 500));
  }
}

// ---- the HARNESS-01 probe, ported (same as tests/test-3692-ce-budget.cjs) ----
function srRoute(q) {
  const s = String(q || '');
  if (/fundamental limit/.test(s)) return 'derivation_hit';
  if (/overcome/.test(s)) return 'retest_hit';
  if (/saturation/.test(s)) return /host volume swing/.test(s) ? 'scurve_headroom' : 'scurve_ceiling';
  if (/\(review OR survey\)/.test(s)) return 'prior_review_two';
  return 'gap_primary_zero';
}
function rowOf(key, i, leaf, label) {
  const r = BODIES[key].results[i];
  return { leaf_id: leaf, record_id: r.id, claim: 'c ' + leaf, quote: r.title, label: label };
}
function analyst(p, round) {
  const rows = [];
  if (round === 1 && p.lane === 'LM1') rows.push(rowOf('derivation_hit', 0, 'L8', 'derivation'));
  if (round === 1 && p.lane === 'LM2') rows.push(rowOf('retest_hit', 0, 'L9', 'retest'));
  if (round === 2 && p.lane === 'LM2') rows.push(rowOf('scurve_ceiling', 0, 'L9', 'scurve_ceiling'));
  return rows;
}
function deepPlan(room, budget) {
  const built = planner.buildPlan(room.roomDir, clone(QS_SR), { mode: 'deep', now: new Date('2026-10-04T00:00:00Z') });
  const plan = built.plan;
  Object.assign(plan.budget, budget || {});
  plan.plan_hash = planMod.planHash(plan);
  return plan;
}
function deepSeam() {
  const rp = makeReplayFetch({ route: srRoute, bodies: BODIES });
  return async function (args) {
    const prev = globalThis.fetch;
    globalThis.fetch = rp;
    try { return await corpus.fetchCorpusEnvelope(args); } finally { globalThis.fetch = prev; }
  };
}
function deepInit(room, plan, initOpts) {
  const w = grants.writeGrant(room.roomDir, grants.buildRunGrant(plan), { approved_via: VIA });
  if (!w.ok) throw new Error('deep grant refused ' + JSON.stringify(w));
  const init = deepMod.initDeepState(room.roomDir, plan, w.grant, initOpts || {});
  if (!init.ok) throw new Error('init ' + JSON.stringify(init));
  return init;
}
async function driveDeep(room, plan) {
  const id = plan.run_id;
  const env = { fetchEnvelopeFn: deepSeam() };
  let result = null;
  for (let g = 0; g < 60; g += 1) {
    const n = deepMod.nextDeepStep(room.roomDir, id);
    if (!n.ok) throw new Error('nextDeepStep ' + JSON.stringify(n));
    if (n.step === 'fetch_round') {
      const fr = await deepMod.fetchRound(room.roomDir, id, env);
      if (!fr.ok) throw new Error('fetchRound ' + JSON.stringify(fr));
    } else if (n.step === 'dispatch_lanes') {
      n.payload.lanes.forEach(function (p) { deepMod.recordLaneRows(room.roomDir, id, p.lane, analyst(p, n.round)); });
    } else if (n.step === 'reflect') {
      deepMod.proposeFollowups(room.roomDir, id, []);
    } else if (n.step === 'extend_card') {
      deepMod.applyExtendDecision(room.roomDir, id, 'stop', { approved_via: VIA });
    } else if (n.step === 'counterevidence') {
      const ce = await deepMod.runCounterevidence(room.roomDir, id, env);
      if (!ce.ok) throw new Error('runCounterevidence ' + JSON.stringify(ce));
      if (ce.lane_payload) deepMod.recordLaneRows(room.roomDir, id, 'CE', []);
    } else if (n.step === 'synthesize') {
      result = deepMod.synthesize(room.roomDir, id);
      break;
    } else if (n.step === 'done') {
      break;
    }
  }
  if (!result || !result.ok) throw new Error('synthesize ' + JSON.stringify(result));
  return result;
}
async function scenario(planBudget, initOpts) {
  const room = newRoom();
  const plan = deepPlan(room, planBudget || {});
  deepInit(room, plan, initOpts);
  const result = await driveDeep(room, plan);
  return { room: room, plan: plan, run: result.run, ledger: operations.readLedger(room.roomDir, plan.run_id) };
}
// a quick whitespace run through the REAL corpus; every query is a counted zero (executed_empty)
async function quickScenario() {
  const room = newRoom();
  const built = planner.buildPlan(room.roomDir, clone(QS_WS), { mode: 'quick', now: new Date('2026-10-04T00:00:00Z') });
  const plan = built.plan;
  const w = grants.writeGrant(room.roomDir, grants.buildRunGrant(plan), { approved_via: VIA });
  if (!w.ok) throw new Error('quick grant refused ' + JSON.stringify(w));
  const env = real.realFetchEnvelope(function () { return 'gap_primary_zero'; });
  const out = await quickMod.runQuick(room.roomDir, plan, { fetchEnvelopeFn: env, now: Date.now() });
  if (out.status !== 'done') throw new Error('quick ' + out.status + ' ' + out.reason);
  return { room: room, plan: plan, run: out.run, card: out.card };
}

const ANSWERS = [];
function lintAll() {
  const bad = [];
  ANSWERS.forEach(function (a) {
    lintLine(a.line, { complete: a.complete }).forEach(function (v) { bad.push(a.tag + ':' + v.rule + '=' + v.match); });
  });
  return bad;
}

async function main() {
  // ---- WD1 cap 8, default reserve ----
  await leg('WD1 cap 8: the answer says only some of the searches for evidence against it ran, with the search-budget reason', async function () {
    const s = await scenario({ max_searches: 8 });
    const line = s.run.answer_line;
    ANSWERS.push({ tag: 'WD1', line: line, complete: s.run.completion.complete });
    console.log('WD1 measured: ce=' + JSON.stringify({ status: s.run.counterevidence.status, planned: s.run.counterevidence.planned, executed: s.run.counterevidence.executed }) + ' answer=' + line);
    assert.ok(line.indexOf('Only ') !== -1 && line.indexOf(' searches for evidence against it ran (') !== -1, 'no Only x of y sentence');
    assert.ok(/searches for evidence against it ran \([^)]*search budget[^)]*\)/.test(line), 'no search-budget reason words');
    assert.ok(line.indexOf('The deep run stopped on') === -1, 'the old sentence is still present');
    return true;
  });

  // ---- WD1b falsifiers never ran ----
  await leg('WD1b a deep run whose falsifier operations never ran says Not verified and the reason', async function () {
    const s = await scenario({ max_searches: 1 }, { ceReserve: 0 });
    const line = s.run.answer_line;
    ANSWERS.push({ tag: 'WD1b', line: line, complete: s.run.completion.complete });
    console.log('WD1b measured: ce status=' + s.run.counterevidence.status + ' answer=' + line);
    assert.strictEqual(s.run.counterevidence.status, 'not_run');
    assert.ok(line.indexOf('Not verified: the searches for evidence against it did not run (') !== -1, 'no Not verified sentence');
    return true;
  });

  // ---- WD2 lane_cap ----
  await leg('WD2 a lane cut by the fan-out cap is named by its question and the limit, never an id', async function () {
    const s = await scenario({ breadth: 2 });
    const line = s.run.answer_line;
    ANSWERS.push({ tag: 'WD2', line: line, complete: s.run.completion.complete });
    const cut = s.run.completion.incomplete.filter(function (i) { return i.reason === 'lane_cap' && typeof i.dimension_label === 'string'; });
    const label = cut.length ? cut[0].dimension_label.replace(/\s*\?\s*$/, '') : null;
    console.log('WD2 measured: lane_cap ops=' + cut.length + ' first label=' + label + ' answer=' + line);
    assert.ok(cut.length > 0 && label.length <= 90, 'no short lane_cap label to look for');
    assert.ok(line.indexOf('"' + label + '" was not searched: the run looks at a limited number of lines of inquiry at once') !== -1, 'the lane_cap sentence is absent');
    return true;
  });

  // ---- WD3 empty results ----
  let quick = null;
  await leg('WD3 an empty result names its query and provider and says it is not proof the literature is silent', async function () {
    quick = await quickScenario();
    const line = quick.run.answer_line;
    ANSWERS.push({ tag: 'WD3', line: line, complete: quick.run.completion.complete });
    const empty = quick.run.operations.filter(function (o) { return o.state === 'executed_empty'; });
    console.log('WD3 measured: executed_empty ops=' + empty.length + ' answer=' + line);
    assert.ok(empty.length > 0, 'no executed_empty op in the quick run');
    const exact = 'These searches ran and returned no records: "' + empty[0].q + '" (OpenAlex)' + (empty.length > 1 ? ' and ' + (empty.length - 1) + ' more' : '') + '. That is what these searches returned, not proof the literature is silent.';
    assert.ok(line.indexOf(exact) !== -1, 'the exact C03 sentence is absent: ' + exact);
    return true;
  });

  // ---- WD4 C17 round one ----
  await leg('WD4 C17: evidence-against work done in round one reads as ran inside the first round', async function () {
    // the real cap-16 run already ran its round-one falsifiers; an HARNESS-01 run whose pass had nothing
    // left to plan is the same ledger with the pass operations removed, read through the words module
    const s = await scenario({});
    const all = s.ledger.operations;
    const noExtra = { operations: all.filter(function (o) { return !isCe(o); }) };
    const st = operations.counterevidenceStatus(noExtra, { needed: true });
    const jobLines = require(path.join(RP, 'job-lines.cjs'));
    const words = jobLines.counterevidenceLine(st, { roundOneOnly: true });
    const ownLine = s.run.answer_line;
    ANSWERS.push({ tag: 'WD4', line: ownLine, complete: s.run.completion.complete });
    ANSWERS.push({ tag: 'WD4-roundone', line: words, complete: false });
    console.log('WD4 measured: no-extra status=' + st.status + ' executed=' + st.executed + ' words=' + words + ' | own answer ends: ' + ownLine.slice(-160));
    assert.strictEqual(st.status, 'complete');
    assert.ok(words.indexOf('ran inside the first round (' + st.executed + ')') !== -1, 'roundOneOnly sentence: ' + words);
    assert.ok(ownLine.indexOf('The searches for evidence against it ran (' + s.run.counterevidence.executed + ').') !== -1, 'the complete sentence is absent from the real cap-16 answer');
    return true;
  });

  // ---- WD5 lint ----
  await leg('WD5 the register lint finds no violation in any answer line above', async function () {
    const bad = lintAll();
    console.log('WD5 lint: lines=' + ANSWERS.length + ' violations=' + bad.length + (bad.length ? ' ' + bad.join(', ') : ''));
    assert.ok(ANSWERS.length >= 5, 'too few answer lines to lint: ' + ANSWERS.length);
    assert.strictEqual(bad.length, 0, bad.join(', '));
    return true;
  });

  // ---- WD6 hermetic real-room-run ----
  await leg('WD6 the real-room report and receipt read completion, and the release gate still accepts the receipt', async function () {
    const world = mk('world');
    const preloadDir = mk('preload');
    const routeModule = path.join(__dirname, 'helpers', 'replay-route-3692.cjs');
    const preload = real.writePreload(preloadDir, routeModule);
    const seed = path.join(mk('seed'), 'release-room');
    fs.cpSync(path.join(ROOT, 'tests', 'fixtures', 'release-room'), seed, { recursive: true });
    const receipts = path.join(world, 'receipts');
    const roomsHome = path.join(world, 'rooms');
    const home = path.join(world, 'home');
    fs.mkdirSync(home, { recursive: true });
    const env = Object.assign({}, process.env, {
      HOME: home, USERPROFILE: home, MINDRIAN_ROOMS_HOME: roomsHome, MINDRIAN_REAL_ROOM_RECEIPT_DIR: receipts,
      MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9', MINDRIAN_BRAIN_KEY: 'test-key-not-real', NODE_OPTIONS: '--require ' + preload,
      MOS_3692_REPLAY_LOG: path.join(world, 'replay.jsonl'),
    });
    delete env.CLAUDE_CODE_SESSION_ID;
    delete env.MINDRIAN_ACTIVE_SESSION_ID;
    delete env.TAVILY_API_KEY;
    const r = cp.spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'real-room-run.cjs'), '--seed', seed, '--receipt-dir', receipts, '--rooms-home', roomsHome, '--read-by', 'test-3692-16'],
      { cwd: ROOT, env: env, encoding: 'utf8', timeout: 540000, maxBuffer: 64 * 1024 * 1024 });
    const report = String(r.stdout || '');
    const quickBlock = report.split('== Quick research ==')[1] || '';
    const quickText = quickBlock.split('== Deep research ==')[0];
    const deepText = (quickBlock.split('== Deep research ==')[1] || '').split('== Eureka ==')[0];
    console.log('WD6 measured: exit=' + r.status + ' report chars=' + report.length);
    assert.strictEqual(r.status, 0, 'exit ' + r.status + ' ' + String(r.stderr || '').slice(-300));
    [['Quick', quickText], ['Deep', deepText]].forEach(function (p) {
      const gotLine = (p[1].split('\n').filter(function (l) { return /^\s*It got:/.test(l); })[0]) || '';
      const couldNot = (p[1].split('\n').filter(function (l) { return /^\s*It could not:/.test(l); })[0]) || '';
      console.log('WD6 ' + p[0] + ' It got: ' + gotLine.trim().slice(0, 300));
      console.log('WD6 ' + p[0] + ' It could not: ' + couldNot.trim().slice(0, 300));
      assert.ok(/\d+ of \d+ planned searches ran \(\d+ with records, \d+ came back empty\)/.test(gotLine), p[0] + ' It got lacks the executed-of-planned count');
      assert.ok(/was not searched:|nothing it promised was left undone/.test(couldNot), p[0] + ' It could not names neither an incomplete job nor none');
    });
    const sha = cp.spawnSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
    const rec = JSON.parse(fs.readFileSync(path.join(receipts, sha + '.json'), 'utf8'));
    const six = ['operations_planned', 'executed_with_results', 'executed_empty', 'refused_before_fetch', 'not_executed', 'complete'];
    ['quick', 'deep'].forEach(function (k) {
      const c = rec.perspectives[k].counts;
      six.forEach(function (key) { assert.ok(typeof c[key] === 'number' && Number.isFinite(c[key]), k + ' counts.' + key + ' is ' + c[key]); });
      assert.ok(c.complete === 0 || c.complete === 1, k + ' complete is ' + c.complete);
      assert.strictEqual(c.operations_planned, c.executed_with_results + c.executed_empty + c.refused_before_fetch + c.not_executed, k + ' operations_planned is not the sum of the four states');
    });
    const g = cp.spawnSync('bash', ['-c', '. "$LIB" && mos_real_room_gate "$ROOT" 0 0'], {
      env: Object.assign({}, env, { LIB: path.join(ROOT, 'scripts', 'release-lib', 'real-room-gate.sh'), ROOT: ROOT, NODE_OPTIONS: '' }),
      encoding: 'utf8', timeout: 60000,
    });
    console.log('WD6 gate: exit=' + g.status + ' ' + String(g.stdout || '').split('\n').filter(Boolean).slice(0, 3).join(' / ').slice(0, 300));
    assert.strictEqual(g.status, 0, 'gate exit ' + g.status + ': ' + String(g.stdout || '') + String(g.stderr || ''));
    const reportLint = lintLine(quickText + '\n' + deepText, { complete: true }).filter(function (v) { return v.rule === 'leaf_id' || v.rule === 'run_id' || v.rule === 'confirmed'; });
    assert.strictEqual(reportLint.length, 0, 'ids in the report text: ' + JSON.stringify(reportLint));
    return true;
  });

  // ---- WD7 unit contract ----
  await leg('WD7 job-lines: exact reason words, label cut, collapse by dimension, the rest counted, the four sentences', async function () {
    const jl = require(path.join(RP, 'job-lines.cjs'));
    const W = jl.REASON_WORDS;
    assert.strictEqual(W.quick_cap, 'the quick run\'s three searches went to other questions first');
    assert.strictEqual(W.search_cap, 'the run\'s search budget ran out before it');
    assert.strictEqual(W.lane_cap, 'the run looks at a limited number of lines of inquiry at once, and this one was past the limit');
    assert.strictEqual(W.no_query_composed, 'no search phrase could be formed from its words');
    assert.strictEqual(jl.reasonWords('provider_failed:network_timeout'), 'the search service did not answer (it timed out)');
    assert.strictEqual(jl.reasonWords('provider_failed:weird'), 'the search service did not answer (an error)');
    assert.strictEqual(jl.reasonWords('provider_unavailable:tavily'), 'industry search needs a Tavily key, and none is set');
    assert.strictEqual(jl.reasonWords('bad_slot:limiter'), 'the wall it tests is written as a sentence; name it in a few words');
    assert.strictEqual(jl.reasonWords('bad_slot:term'), 'one of its search terms could not be used');
    assert.strictEqual(jl.reasonWords('unused_slot:synonyms'), 'the extra term given for it is not used by its search shape');
    function miss(dim, label, reason) { return { operation_id: 'op-' + dim, plan_dimension: dim, dimension_label: label, state: 'not_executed', reason: reason, mandatory: true }; }
    const long = 'Does the sensor drift rate stay inside the stated tolerance band when the host volume swing is wide and the temperature moves across the whole range of the test?';
    const comp = { complete: false, incomplete: [miss('A', 'First question?', 'search_cap'), miss('B', long, 'lane_cap'), miss('A', 'First question?', 'no_query_composed'), miss('C', 'Third?', 'time'), miss('D', 'Fourth?', 'time'), miss('E', 'Fifth?', 'time')] };
    const lines = jl.incompleteLines(comp, { max: 3 });
    console.log('WD7 measured lines: ' + JSON.stringify(lines));
    assert.strictEqual(lines.length, 4, 'three sentences and a count');
    assert.ok(lines[0].indexOf('"First question" was not searched: the run\'s search budget ran out before it') === 0, lines[0]);
    assert.ok(lines[0].indexOf('no search phrase could be formed from its words') !== -1, 'ops of one dimension did not collapse: ' + lines[0]);
    const cutLabel = lines[1].split('"')[1];
    assert.ok(cutLabel.length <= 90 && long.indexOf(cutLabel) === 0 && !/\s$/.test(cutLabel), 'label cut: ' + cutLabel);
    assert.strictEqual(lines[3], '2 more questions were not searched.');
    const one = jl.incompleteLines({ incomplete: [miss('A', 'Only one?', 'time'), miss('B', 'Two?', 'time'), miss('C', 'Three?', 'time'), miss('D', 'Four?', 'time')] }, { max: 3 });
    assert.strictEqual(one[3], '1 more question was not searched.');
    const e = jl.counterevidenceLine;
    assert.strictEqual(e({ status: 'complete', planned: 4, executed: 4, failed: 0, reasons: [] }, {}), 'The searches for evidence against it ran (4).');
    assert.strictEqual(e({ status: 'complete', planned: 4, executed: 4, failed: 0, reasons: [] }, { roundOneOnly: true }), 'The searches for evidence against it ran inside the first round (4), so no extra pass was needed.');
    assert.strictEqual(e({ status: 'partial', planned: 9, executed: 5, failed: 4, reasons: ['search_cap'] }, {}), 'Only 5 of 9 searches for evidence against it ran (the run\'s search budget ran out).');
    assert.strictEqual(e({ status: 'not_run', planned: 3, executed: 0, failed: 3, reasons: ['time'] }, {}), 'Not verified: the searches for evidence against it did not run (the time budget ran out).');
    assert.strictEqual(e({ status: 'not_needed', planned: 0, executed: 0, failed: 0, reasons: [] }, {}), '');
    const em = jl.emptyResultLine([{ state: 'executed_empty', q: '"a b"', provider: 'openalex', kind: 'direct' }, { state: 'executed_empty', q: 'c', provider: 'openalex', kind: 'falsifier' }, { state: 'executed_with_results', q: 'z', provider: 'openalex', kind: 'direct' }]);
    assert.strictEqual(em, 'These searches ran and returned no records: ""a b"" (OpenAlex) and 1 more. That is what these searches returned, not proof the literature is silent.');
    assert.strictEqual(jl.emptyResultLine([]), '');
    const open = jl.deepOpeningLine({ executed: 12, planned: 20, rows: 7, governing: 'weakened', stop: 'cap' });
    assert.strictEqual(open, 'The deep run made 12 of 20 planned searches and kept 7 checked rows; the main question now reads weaker. It stopped because the search budget ran out.');
    return true;
  });

  // ---- WD9 refused slot ----
  await leg('WD9 a refused search slot reads as not searched with its reason, keeps the verdict unresolved, and the card has a Not searched section', async function () {
    const room = newRoom();
    const qs = clone(QS_WS);
    qs.leaves[0].slots = { term: 'x' };
    const built = planner.buildPlan(room.roomDir, qs, { mode: 'quick', now: new Date('2026-10-04T00:00:00Z') });
    const plan = built.plan;
    const w = grants.writeGrant(room.roomDir, grants.buildRunGrant(plan), { approved_via: VIA });
    if (!w.ok) return 'grant ' + JSON.stringify(w);
    const env = real.realFetchEnvelope(function () { return 'gap_primary_zero'; });
    const out = await quickMod.runQuick(room.roomDir, plan, { fetchEnvelopeFn: env, now: Date.now() });
    if (out.status !== 'done') return 'quick ' + out.status + ' ' + out.reason;
    const line = out.run.answer_line;
    ANSWERS.push({ tag: 'WD9', line: line, complete: out.run.completion.complete });
    console.log('WD9 measured: verdict=' + out.run.verdict + ' complete=' + out.run.completion.complete + ' answer=' + line);
    assert.strictEqual(out.run.verdict, 'unresolved', 'a refused dimension must keep the verdict unresolved');
    assert.strictEqual(out.run.completion.complete, false);
    assert.ok(line.indexOf(' was not searched: one of its search terms could not be used.') !== -1, 'the refused-slot sentence is absent');
    assert.ok(out.card.body_md.indexOf('### Not searched') !== -1 && out.card.body_md.indexOf('one of its search terms could not be used') !== -1, 'the card lacks the Not searched section');
    const bad = lintLine(out.card.body_md.split('### Not searched')[1].split('###')[0], { complete: false });
    assert.strictEqual(bad.length, 0, 'lint on the section: ' + JSON.stringify(bad));
    return true;
  });

  // ---- WD7c-WD10: every card names the job and the move, never an id (369.2-30, INPUT addendum 2, R23) ----
  // The square-bracketed row citation is the one exempt token, so brackets are stripped per line before the lint.
  function lintBody(body) {
    const bad = [];
    String(body).split('\n').forEach(function (raw) {
      const line = raw.replace(/\[[^\]]*\]/g, '');
      if (!line.trim()) return;
      lintLine(line, { complete: false }).forEach(function (v) { bad.push(v.rule + '=' + v.match + ' in "' + raw.trim().slice(0, 90) + '"'); });
    });
    return bad;
  }
  function srDeepPlan(room) {
    return planner.buildPlan(room.roomDir, clone(QS_SR), { mode: 'deep', now: new Date('2026-10-04T00:00:00Z') }).plan;
  }
  const QS_FIBER = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '3692-question-sets', 'fiber-sensing.json'), 'utf8'));

  await leg('WD7c the quick evidence card: rows, searches, local checks and Theo skips read as jobs and moves, zero lint violations', async function () {
    const room = newRoom();
    const built = planner.buildPlan(room.roomDir, clone(QS_WS), { mode: 'quick', now: new Date('2026-10-04T00:00:00Z') });
    const plan = built.plan;
    const w = grants.writeGrant(room.roomDir, grants.buildRunGrant(plan), { approved_via: VIA });
    if (!w.ok) return 'grant ' + JSON.stringify(w);
    const env = real.realFetchEnvelope(function () { return 'contested_rows'; });
    const out = await quickMod.runQuick(room.roomDir, plan, {
      fetchEnvelopeFn: env, now: Date.now(),
      rowsProvider: async function (c) {
        return c.records.slice(0, 2).map(function (r, i) { return { leaf_id: c.leaves[0].id, record_id: String(r.id), claim: 'c', quote: r.title, label: i === 0 ? 'supports' : 'contradicts' }; });
      },
    });
    if (out.status !== 'done') return 'quick ' + out.status + ' ' + out.reason;
    const body = out.card.body_md;
    const skipRun = Object.assign({}, out.run, { theo_checks: [
      { leaf_id: plan.leaves[0].id, outcome: 'skipped', reason: 'egress_line_off' },
      { leaf_id: plan.leaves[1].id, outcome: 'skipped', reason: 'not_canon' },
    ] });
    const body2 = quickMod.evidenceCard(skipRun, plan).body_md;
    const bad = lintBody(body).concat(lintBody(body2));
    console.log('WD7c lint: violations=' + bad.length + (bad.length ? ' ' + bad.slice(0, 6).join(' || ') : ''));
    assert.strictEqual(bad.length, 0, bad.slice(0, 6).join(' || '));
    const q1 = 'Is there published work on thin-film sensors for milk quality';
    const rowLines = body.split('\n').filter(function (l) { return /^- \[E-[A-Z]+-\d+\] /.test(l); });
    assert.strictEqual(rowLines.length, 2, 'row lines ' + rowLines.length);
    assert.ok(/^- \[E-[A-Z]+-\d+\] ".+" supports "/.test(rowLines[0]) && rowLines[0].indexOf('supports "' + q1 + '": ') !== -1, 'supports row: ' + rowLines[0]);
    assert.ok(rowLines[1].indexOf('argues against "' + q1 + '": ') !== -1, 'contradicts row: ' + rowLines[1]);
    assert.ok(/\(https?:\/\/[^,]+, retrieved \d{4}-\d{2}-\d{2}\)$/.test(rowLines[0]) && rowLines[0].indexOf('record hash') === -1, 'row tail: ' + rowLines[0]);
    assert.ok(/^- .*: 64 works in OpenAlex \(searched\)$/m.test(body), 'search line shape absent');
    const found = body.split('### What the searches found')[1].split('###')[0];
    assert.ok(found.indexOf('exact-phrase') === -1 && found.indexOf('empty_valid') === -1 && found.indexOf('(ok') === -1, 'a search outcome code is in the searches section: ' + found);
    const qLeaf3 = plan.leaves.filter(function (l) { return l.dimension === 'ws:extraction_failure'; })[0].question.replace(/\s*\?+\s*$/, '');
    assert.ok(body.indexOf('- Checked in this room for "' + qLeaf3 + '": 0 room artifacts already mention it. Nothing was sent for this check.') !== -1, 'local check line absent');
    const q1b = plan.leaves[0].question.replace(/\s*\?+\s*$/, '');
    const q2b = plan.leaves[1].question.replace(/\s*\?+\s*$/, '');
    assert.ok(body2.indexOf('- The framework pair behind "' + q1b + '": not checked, the Theo line is off for this room, so nothing was sent') !== -1, 'egress skip line absent');
    assert.ok(body2.indexOf('- The framework pair behind "' + q2b + '": not checked, one of the names is not a canon framework name, so nothing was sent') !== -1, 'canon skip line absent');
    return true;
  });

  await leg('WD8c the deep plan review card (SR and fiber-sensing) names the lens by its question, paths and limiters by label, zero lint violations', async function () {
    const room = newRoom();
    const sr = srDeepPlan(room);
    const fiber = planner.buildPlan(room.roomDir, clone(QS_FIBER), { mode: 'deep', now: new Date('2026-10-04T00:00:00Z') }).plan;
    const qroom = newRoom();
    const quickPlan = planner.buildPlan(qroom.roomDir, clone(QS_WS), { mode: 'quick', now: new Date('2026-10-04T00:00:00Z') }).plan;
    const all = [['sr', sr], ['fiber', fiber], ['quick', quickPlan]].map(function (p) { return { tag: p[0], body: planMod.planReviewCard(p[1]).body_md }; });
    const bad = [];
    all.forEach(function (c) { lintBody(c.body).forEach(function (b) { bad.push(c.tag + ': ' + b); }); });
    console.log('WD8c lint: violations=' + bad.length + (bad.length ? ' ' + bad.slice(0, 6).join(' || ') : ''));
    assert.strictEqual(bad.length, 0, bad.slice(0, 6).join(' || '));
    all.forEach(function (c) {
      assert.ok(c.body.indexOf('   - lens:') === -1, c.tag + ' still prints lens:');
      const sub = c.body.split('\n').filter(function (l) { return /^   - looked at as:/.test(l); });
      assert.ok(sub.length > 0, c.tag + ' has no looked-at-as line');
      sub.forEach(function (l) { assert.ok(/^   - looked at as: [^;]+; asked by \/mos:[a-z-]+; searches (OpenAlex|the room|Theo)$/.test(l), c.tag + ' sub-question line shape: ' + l); });
    });
    const srBody = all[0].body;
    assert.ok(srBody.indexOf('- Lithium metal anode\n') !== -1, 'path line without its id');
    assert.ok(srBody.indexOf('- Conversion cathode, from the 10X resurvey') !== -1, 'the 10X path line');
    assert.ok(/\| Cathode theoretical capacity \[near ceiling\] \| Interface resistance at the anode \|/.test(srBody), 'limiter row by label');
    assert.ok(srBody.indexOf('Ranked by what each one unlocks downstream: Interface resistance at the anode; ') !== -1, 'ranked line by label');
    assert.ok(/^- Interface resistance at the anode unlocks a chain of 2 steps$/m.test(srBody), 'chain line by label');
    return true;
  });

  await leg('WD9c the extend card and the not-ready cards read as jobs and moves, zero lint violations', async function () {
    const room = newRoom();
    const sr = srDeepPlan(room);
    const fam = [
      ['whitespace-gap/v1', 'gap search'], ['concept-evidence/v1', 'evidence search'], ['causal-link/v1', 'cause and effect search'],
      ['constraint-interrogation/v1', 'wall test'], ['diffusion/v1', 'adoption search'],
    ];
    const tids = ['ws.exact', 'ce.exact', 'cl.break', 'ci.derivation', 'df.timing'];
    const qs = fam.map(function (f, i) { return { template_id: tids[i], family: f[0], q: '"term ' + i + '" AND (a OR b)', q_hash: 'h' + i }; });
    const state = { run_id: 'rp-2026-10-06-00000000', max_searches_base: 16, searches_used: 4, remaining_usd: null };
    const ext = deepMod.extendCard(state, qs, false);
    const promo = deepMod.extendCard(state, qs, false, 'baseline_promotion');
    const bad = [];
    [['extend', ext.body_md], ['promo', promo.body_md]].forEach(function (c) { lintBody(c[1]).forEach(function (b) { bad.push(c[0] + ': ' + b); }); });
    // the not-ready cards of cardFor, from a ready plan whose status and coverage are set the way each status sets them
    const fiber = planner.buildPlan(room.roomDir, clone(QS_FIBER), { mode: 'deep', now: new Date('2026-10-04T00:00:00Z') }).plan;
    const cards = {};
    ['incomplete', 'needs_lens_leaves', 'wish', 'local_only'].forEach(function (st) {
      const p = clone(fiber);
      p.status = st;
      p.pyramid.coverage.uncovered = ['df:timing', 'sr:paths'];
      const cf = planner.cardFor(room.roomDir, p, {});
      cards[st] = cf.card ? cf.card.body_md : '';
      lintBody(cards[st]).forEach(function (b) { bad.push(st + ': ' + b); });
    });
    console.log('WD9c lint: violations=' + bad.length + (bad.length ? ' ' + bad.slice(0, 6).join(' || ') : ''));
    assert.strictEqual(bad.length, 0, bad.slice(0, 6).join(' || '));
    assert.ok(ext.body_md.indexOf('New searches (none has been sent yet):') !== -1, 'extend header');
    fam.forEach(function (f, i) { assert.ok(ext.body_md.indexOf('\n- ' + f[1] + ': "term ' + i + '" AND (a OR b)') !== -1, 'extend line for ' + f[1]); });
    assert.ok(promo.body_md.indexOf('New searches (none has been sent yet):') !== -1, 'promotion header');
    assert.ok(cards.incomplete.indexOf('- Timing: no sub-question covers this yet') !== -1 && cards.incomplete.indexOf('- Paths: no sub-question covers this yet') !== -1, 'uncovered lines by label: ' + cards.incomplete);
    assert.ok(cards.incomplete.indexOf('[root') === -1, 'a [root] path prefix is still on a warning');
    assert.ok(sr.leaves.length > 0, 'sr');
    return true;
  });

  await leg('WD10 no card says confirmed, and a limiter the field scan refuted reads as already overcome, never as a code', async function () {
    const room = newRoom();
    const sr = srDeepPlan(room);
    const lim = sr.perspective.limiters;
    const second = clone(sr);
    second.perspective.limiters[1].baseline = 'contradicted';
    second.perspective.limiters[2].baseline = 'supported';
    const body = planMod.planReviewCard(second).body_md;
    const firstWords = lim[1].statement;
    const secondWords = lim[2].statement;
    const bad = lintBody(body).filter(function (b) { return /^confirmed=/.test(b); });
    console.log('WD10 measured: confirmed findings=' + bad.length + ' (first limiter "' + firstWords + '", second "' + secondWords + '")');
    assert.strictEqual(bad.length, 0, 'the word confirmed is on the card');
    assert.ok(!/confirmed/i.test(body), 'confirmed on the plan card');
    assert.ok(body.indexOf(firstWords + ' (the field scan found it already overcome)') !== -1, 'refuted limiter wording');
    assert.ok(body.indexOf(secondWords + ' (the field scan supports it)') !== -1, 'supported limiter wording');
    assert.ok(!/contradicted/.test(body), 'a status code is on the card');
    assert.ok(body.indexOf(firstWords + ' goes last: the field scan found it already overcome.') !== -1, 'the demoted limiter line');
    return true;
  });

  // ---- WD8 dash ----
  await leg('WD8 no em-dash or en-dash in this file or the lint helper', async function () {
    const files = [__filename, path.join(__dirname, 'helpers', 'jobs-moves-lint-3692.cjs')];
    const bad = files.filter(function (f) {
      const src = fs.readFileSync(f, 'utf8');
      return src.indexOf(String.fromCharCode(0x2014)) !== -1 || src.indexOf(String.fromCharCode(0x2013)) !== -1;
    });
    return bad.length === 0 || ('a dash is present in ' + bad.join(', '));
  });

  check('net guard: zero network attempts', NET.attempts() === 0, String(NET.attempts()));
  return summary();
}

main().then(function (code) { process.exit(code); }, function (e) {
  console.log('FAIL: harness (' + String((e && e.stack) || e).slice(0, 500) + ')');
  process.exit(1);
});
