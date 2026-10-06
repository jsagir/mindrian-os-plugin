#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 21 (369.2-R16; HARNESS-09 and ACT-12; SEED-118 positive finding; brief test 21).
 * A researchable question may carry four query kinds (direct, practice, mechanism, adjacent), and no room
 * sentence is ever sent as one quoted phrase.
 *
 * Measured before this plan (RESEARCH on OpenAlex): 'thin wire detection' 6 works, 'optical time domain
 * reflectometry' 5,085, 'powerline detection' 386, the SEED-118 limiter sentence 0. families.cjs had 5 families
 * and 19 templates and 0 of the 4 query families.
 *
 *   K0  the fiber-sensing fixture builds in quick and deep mode (invented venture, no real names)
 *   K1  deep: L1 carries a direct query with 'thin-wire detection' and practice, mechanism and adjacent queries
 *       with their own values, each tagged with its kind, before any fetch. Quick: direct and practice are in
 *       the plan, and every kind is either a query or a queries_cut entry with its kind (the cap of 3 cannot hold
 *       four kinds; ordering of the cut is plan 22)
 *   K2  deep initDeepState mints ops with the kind field set; a quick run closes a cut kind as a not_executed op
 *       with reason quick_cap and its kind
 *   K3  shapeWebPhrase of a room question returns an unquoted string of at most 8 tokens that keeps the city,
 *       the venture and the product words and no question word; a composed web query carries it unquoted; the
 *       card lists that exact string
 *   K4  a value of six words or fewer that is not sentence-shaped stays quoted exactly as before
 *   K5  a value with fewer than 2 content tokens ('what is it?') is refused bad_slot
 *   K6  a limiter slot is never shaped, and plan 17's bad_slot:limiter refusal still holds
 *   K7  a theo leaf is never shaped and never composes kinds
 *   K8  query_kinds is validated (query_kinds_invalid:<leaf_id>) and changes the plan hash
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are mkdtemp dirs before any repo module loads; vendor
 * keys are deleted; the provider is the OpenAlex replay reached through the REAL corpus path.
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
const { check, summary } = makeChecker('test-3692-query-kinds');

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const ROOT = path.resolve(__dirname, '..');
const RP = path.join(ROOT, 'lib', 'core', 'research-planner');
const planMod = require(path.join(RP, 'plan.cjs'));
const planner = require(path.join(RP, 'planner.cjs'));
const grants = require(path.join(RP, 'grants.cjs'));
const deepMod = require(path.join(RP, 'deep.cjs'));
const quickMod = require(path.join(RP, 'quick.cjs'));
const families = require(path.join(RP, 'families.cjs'));
const operations = require(path.join(RP, 'operations.cjs'));
const { buildRoom363 } = require('./helpers/fixture-room-363.cjs');

const FIX = path.join(ROOT, 'tests', 'fixtures', '3692-question-sets', 'fiber-sensing.json');
const QS_FIBER = JSON.parse(fs.readFileSync(FIX, 'utf8'));
const QS_SR = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'scientific-roadmapping.json'), 'utf8'));
const VIA = { surface: 'cli', decision_node_id: 'd-3692-21-test' };
const NOW = new Date('2026-10-04T00:00:00Z');

const DASH_RE = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']');
const SENTENCE = 'How do I keep Nimbus Robotics cold lockers working in Haifa summers?';
const QUESTION_WORDS = ['how', 'what', 'why', 'when', 'where', 'which', 'who', 'does', 'did', 'can', 'could', 'should', 'would'];
const LIMITER_SENTENCE = 'Thin wires cannot be reliably detected by the autonomous terminal guidance stack because contrast falls below sensor noise at range?';

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

function build(room, mode, mutate) {
  const qs = clone(QS_FIBER);
  if (mutate) mutate(qs);
  const built = planner.buildPlan(room.roomDir, qs, { mode: mode, now: NOW });
  if (!built.ok) throw new Error('buildPlan ' + JSON.stringify(built).slice(0, 300));
  return built.plan;
}
function leafOf(plan, id) { return plan.leaves.filter(function (l) { return l.id === id; })[0]; }
function kindQ(leaf, kind) { return (leaf.queries || []).filter(function (q) { return q.kind === kind; }); }
function hasText(list, text) { return list.some(function (q) { return String(q.q).toLowerCase().indexOf(text) !== -1; }); }
function approveRun(room, plan) {
  const p = grants.buildRunGrant(plan);
  p.room_id = grants.roomIdFor(room.roomDir);
  const w = grants.writeGrant(room.roomDir, p, { approved_via: VIA });
  if (!w.ok) throw new Error('grant failed: ' + JSON.stringify(w));
  return w.grant;
}
function readyDeep(plan) {
  const p = clone(plan);
  p.status = 'ready';
  p.plan_hash = planMod.planHash(p);
  return p;
}

async function main() {
  // ---- K0 ----
  await leg('K0 the fixture builds in quick and deep mode and names no real person', async function () {
    const raw = fs.readFileSync(FIX, 'utf8');
    assert.ok(raw.indexOf('optical time domain reflectometry') !== -1, 'fixture lacks the practice name');
    assert.ok(!DASH_RE.test(raw), 'dash in fixture');
    const room = newRoom();
    const q = build(room, 'quick');
    const d = build(room, 'deep');
    assert.ok(leafOf(q, 'L1') && leafOf(d, 'L1'), 'L1 missing');
    return true;
  });

  // ---- K1 ----
  await leg('K1 deep: L1 carries direct, practice, mechanism and adjacent queries tagged with their kind before any fetch', async function () {
    const room = newRoom();
    const plan = build(room, 'deep');
    const l1 = leafOf(plan, 'L1');
    const direct = kindQ(l1, 'direct');
    const practice = kindQ(l1, 'practice');
    const mechanism = kindQ(l1, 'mechanism');
    const adjacent = kindQ(l1, 'adjacent');
    console.log('K1 measured (deep): direct=' + direct.length + ' practice=' + practice.length + ' mechanism=' + mechanism.length + ' adjacent=' + adjacent.length);
    console.log('K1 direct q: ' + (direct[0] && direct[0].q));
    console.log('K1 practice q: ' + (practice[0] && practice[0].q));
    console.log('K1 mechanism q: ' + (mechanism[0] && mechanism[0].q));
    console.log('K1 adjacent q: ' + (adjacent[0] && adjacent[0].q));
    assert.ok(hasText(direct, 'thin-wire detection'), 'no direct query with thin-wire detection');
    assert.ok(hasText(practice, 'optical time domain reflectometry'), 'no practice query');
    assert.ok(hasText(mechanism, 'fiber backscatter'), 'no mechanism query');
    assert.ok(hasText(adjacent, 'powerline detection'), 'no adjacent query');
    assert.ok(!hasText(direct, 'optical time domain reflectometry'), 'the practice value leaked into a direct query');
    return true;
  });

  await leg('K1 quick: direct and practice are in the plan; every kind is a query or a queries_cut entry with its kind', async function () {
    const room = newRoom();
    const plan = build(room, 'quick');
    const l1 = leafOf(plan, 'L1');
    assert.ok(hasText(kindQ(l1, 'direct'), 'thin-wire detection'), 'no direct query');
    assert.ok(hasText(kindQ(l1, 'practice'), 'optical time domain reflectometry'), 'no practice query');
    const cut = Array.isArray(l1.queries_cut) ? l1.queries_cut : [];
    ['mechanism', 'adjacent'].forEach(function (k) {
      const inQ = kindQ(l1, k).length > 0;
      const inCut = cut.some(function (c) { return c.kind === k && c.reason === 'quick_cap' && typeof c.template_id === 'string'; });
      assert.ok(inQ || inCut, 'kind ' + k + ' is neither a query nor a queries_cut entry: cut=' + JSON.stringify(cut));
    });
    const total = plan.leaves.reduce(function (n, l) { return n + (l.queries || []).length; }, 0);
    assert.ok(total <= 3, 'quick plan holds ' + total + ' queries, cap is 3');
    return true;
  });

  // ---- K2 ----
  await leg('K2 deep initDeepState mints ops with the kind field set (practice, mechanism, adjacent beside direct)', async function () {
    const room = newRoom();
    const plan = readyDeep(build(room, 'deep'));
    const w = grants.writeGrant(room.roomDir, grants.buildRunGrant(plan), { approved_via: VIA });
    assert.ok(w.ok, 'grant ' + JSON.stringify(w));
    const init = deepMod.initDeepState(room.roomDir, plan, w.grant, {});
    assert.ok(init.ok, 'init ' + JSON.stringify(init).slice(0, 300));
    const ledger = operations.readLedger(room.roomDir, plan.run_id);
    const l1ops = ledger.operations.filter(function (o) { return o.plan_dimension === 'L1'; });
    const kinds = l1ops.map(function (o) { return o.kind; });
    console.log('K2 measured (deep L1 ops): ' + JSON.stringify(kinds));
    ['direct', 'practice', 'mechanism', 'adjacent'].forEach(function (k) {
      assert.ok(kinds.indexOf(k) !== -1, 'no op with kind ' + k + ': ' + JSON.stringify(kinds));
    });
    return true;
  });

  await leg('K2 quick run: a kind the cap cut is a not_executed op with reason quick_cap and its kind', async function () {
    const room = newRoom();
    const plan = build(room, 'quick');
    const l1 = leafOf(plan, 'L1');
    const cut = Array.isArray(l1.queries_cut) ? l1.queries_cut : [];
    assert.ok(cut.length > 0, 'the quick plan cut nothing: the cap of 3 cannot hold four kinds');
    approveRun(room, plan);
    const out = await quickMod.runQuick(room.roomDir, plan, { fetchEnvelopeFn: real.realFetchEnvelope(function () { return 'gap_primary_zero'; }), now: Date.now() });
    assert.strictEqual(out.status, 'done', 'runQuick ' + out.status + ' ' + (out.reason || ''));
    const ledger = operations.readLedger(room.roomDir, plan.run_id);
    const miss = ledger.operations.filter(function (o) { return o.state === 'not_executed' && o.reason === 'quick_cap'; });
    console.log('K2 measured (quick): cut kinds=' + JSON.stringify(cut.map(function (c) { return c.kind; })) + ' quick_cap ops=' + JSON.stringify(miss.map(function (o) { return o.kind; })));
    cut.forEach(function (c) {
      assert.ok(miss.some(function (o) { return o.kind === c.kind && o.plan_dimension === 'L1'; }), 'no quick_cap op for cut kind ' + c.kind);
    });
    return true;
  });

  // ---- K3 ----
  await leg('K3 shapeWebPhrase keeps the venture, product and city words, drops the question word, and is unquoted', async function () {
    assert.strictEqual(typeof families.shapeWebPhrase, 'function', 'shapeWebPhrase is not exported');
    const r = families.shapeWebPhrase(SENTENCE);
    assert.ok(r && typeof r.value === 'string', 'shapeWebPhrase returned ' + JSON.stringify(r));
    assert.strictEqual(r.shaped, true, 'not marked shaped');
    const low = r.value.toLowerCase();
    const toks = low.split(/\s+/);
    console.log('K3 measured: shaped=' + JSON.stringify(r.value));
    assert.ok(toks.length <= 8, 'tokens ' + toks.length);
    ['nimbus', 'robotics', 'haifa'].forEach(function (t) { assert.ok(toks.indexOf(t) !== -1, 'token lost: ' + t); });
    QUESTION_WORDS.forEach(function (w) { assert.ok(toks.indexOf(w) === -1, 'question word kept: ' + w); });
    assert.ok(r.value.indexOf('"') === -1 && r.value.indexOf('?') === -1, 'quote or question mark in ' + r.value);
    const c = families.composeFamily('concept-evidence/v1', { term: SENTENCE }, { templateIds: ['ce.exact'], destination: 'web' });
    assert.ok(c.ok, 'compose ' + JSON.stringify(c));
    assert.strictEqual(c.queries[0].q, r.value, 'composed q ' + c.queries[0].q);
    assert.ok(c.queries[0].slot_terms.indexOf(r.value) !== -1, 'slot_terms ' + JSON.stringify(c.queries[0].slot_terms));
    return true;
  });

  await leg('K3 the card lists the exact shaped string, and no sentence is quoted whole', async function () {
    const room = newRoom();
    const plan = build(room, 'quick', function (qs) { qs.leaves[1].slots = { term: SENTENCE }; });
    const l2 = leafOf(plan, 'L2');
    const shaped = families.shapeWebPhrase(SENTENCE).value;
    const qs = l2.queries.map(function (q) { return q.q; });
    assert.ok(qs.some(function (q) { return q.indexOf(shaped) !== -1; }), 'L2 queries ' + JSON.stringify(qs));
    qs.forEach(function (q) { assert.ok(q.indexOf('"' + SENTENCE) === -1 && q.indexOf(SENTENCE) === -1, 'sentence sent whole: ' + q); });
    const c = planner.cardFor(room.roomDir, plan, {});
    assert.strictEqual(c.next, 'grant', 'next ' + c.next + ' ' + (c.reason || ''));
    const body = String(c.card.body_md || '');
    assert.ok(body.indexOf('- ' + qs[0]) !== -1, 'the card does not list ' + qs[0]);
    assert.ok(body.indexOf(SENTENCE) === -1, 'the card shows the sentence whole');
    return true;
  });

  // ---- K4 ----
  await leg('K4 a short phrase that is not a sentence stays quoted exactly as before', async function () {
    const short = 'Nimbus Robotics cold lockers Haifa';
    const r = families.shapeWebPhrase(short);
    assert.ok(r && r.shaped === false && r.value === short, 'shape ' + JSON.stringify(r));
    const c = families.composeFamily('concept-evidence/v1', { term: short }, { templateIds: ['ce.exact', 'ce.counter'], destination: 'web' });
    assert.ok(c.ok, 'compose');
    assert.strictEqual(c.queries[0].q, '"' + short + '"', 'q ' + c.queries[0].q);
    assert.strictEqual(c.queries[1].q, '"' + short + '" AND (limitation OR failure OR "no effect")', 'q2 ' + c.queries[1].q);
    return true;
  });

  // ---- K5 ----
  await leg('K5 a value with fewer than 2 content tokens is refused bad_slot', async function () {
    assert.strictEqual(families.shapeWebPhrase('what is it?'), null, 'shapeWebPhrase should return null');
    const c = families.composeFamily('concept-evidence/v1', { term: 'what is it?' }, { templateIds: ['ce.exact'], destination: 'web' });
    assert.ok(!c.ok && c.reason === 'bad_slot', 'compose ' + JSON.stringify(c));
    return true;
  });

  // ---- K6 ----
  await leg('K6 a limiter slot is never shaped; plan 17 bad_slot:limiter still refuses an unbound limiter', async function () {
    const c = families.composeFamily('constraint-interrogation/v1', { limiter: LIMITER_SENTENCE }, { templateIds: ['ci.derivation'], destination: 'web' });
    assert.ok(c.ok, 'compose ' + JSON.stringify(c));
    assert.ok(c.queries[0].q.indexOf('"') === 0, 'the limiter was shaped: ' + c.queries[0].q);
    const room = newRoom();
    const qs = clone(QS_SR);
    qs.leaves.forEach(function (l) { if (['L6', 'L7', 'L8', 'L9', 'L10', 'L11'].indexOf(l.id) !== -1) l.slots = {}; });
    const built = planner.buildPlan(room.roomDir, qs, { mode: 'deep', now: NOW });
    assert.ok(built.ok, 'buildPlan');
    const r1 = deepMod.roundOneQueries(built.plan);
    assert.strictEqual(r1.refusals.length, 4, 'refusals ' + r1.refusals.length);
    r1.refusals.forEach(function (x) { assert.strictEqual(x.reason, 'bad_slot:limiter', 'reason ' + x.reason); });
    return true;
  });

  // ---- K7 ----
  await leg('K7 a theo leaf is never shaped and never composes kinds', async function () {
    const prose = families.composeForLeaf({ lens: 'mu.verify', slots: { term: 'Cold lockers fail. Nimbus Robotics in Haifa summers' }, corpus: 'theo' }, { round: 1 });
    assert.ok(!prose.ok && prose.reason === 'term_not_composed', 'theo prose ' + JSON.stringify(prose));
    const asked = families.composeForLeaf({ lens: 'mu.verify', slots: { term: SENTENCE }, corpus: 'theo' }, { round: 1 });
    assert.ok(!asked.ok, 'a theo leaf composed a room question: ' + JSON.stringify(asked));
    assert.strictEqual(typeof families.composeForKinds, 'function', 'composeForKinds is not exported');
    const k = families.composeForKinds({ lens: 'mu.verify', slots: { term: 'cable cutting' }, corpus: 'theo', query_kinds: { practice: 'optical time domain reflectometry' } }, { round: 1 });
    assert.ok(k.ok, 'composeForKinds ' + JSON.stringify(k));
    assert.ok(k.queries.length > 0 && k.queries.every(function (q) { return q.kind === 'direct'; }), 'a theo leaf composed a non-direct kind');
    return true;
  });

  // ---- K8 ----
  await leg('K8 query_kinds is validated and changes the plan hash', async function () {
    assert.deepStrictEqual(families.QUERY_KINDS, ['direct', 'practice', 'mechanism', 'adjacent'], 'QUERY_KINDS');
    const room = newRoom();
    const plan = build(room, 'quick');
    const v = planMod.validatePlan(plan);
    assert.ok(v.ok, 'valid plan refused ' + JSON.stringify(v.errors));
    const bad = clone(plan);
    leafOf(bad, 'L1').query_kinds = { folklore: 'x y' };
    const vb = planMod.validatePlan(bad);
    assert.ok(!vb.ok && vb.errors.indexOf('query_kinds_invalid:L1') !== -1, 'errors ' + JSON.stringify(vb.errors));
    const bad2 = clone(plan);
    leafOf(bad2, 'L1').query_kinds = { practice: 42 };
    assert.ok(planMod.validatePlan(bad2).errors.indexOf('query_kinds_invalid:L1') !== -1, 'a non-string value passed');
    const other = clone(plan);
    leafOf(other, 'L1').query_kinds = { practice: 'distributed acoustic sensing' };
    assert.notStrictEqual(planMod.planHash(other), planMod.planHash(plan), 'planHash did not move');
    return true;
  });

  await leg('K9 no em-dash or en-dash in this file', async function () {
    const self = fs.readFileSync(__filename, 'utf8');
    assert.ok(!DASH_RE.test(self), 'dash present');
    return true;
  });

  check('K10 no network escaped the replay', NET.attempts() === 0, 'attempts ' + NET.attempts());
  process.exit(summary());
}

main().catch(function (e) {
  console.error('FAIL: harness ' + String((e && e.stack) || e));
  process.exit(1);
});
