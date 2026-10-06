#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 20 (369.2-R12, 369.2-R13; CODE-09, SW-12, ACT-10, SW-13, ACT-05). Two correct guards
 * had no recovery path: a lane that an empty fetch already closed answered wrong_step (a sequencing error,
 * not a closure), and a valid quote rejected for an HTML entity could not be corrected.
 *
 *   C9a  SR deep run, one lane fetches 0 records: recordLaneRows on that lane answers
 *        {ok:false, reason:'lane_already_closed', closed_reason:'empty_fetch', closed_at:<ISO>}
 *   C9b  recordLaneRows before fetch_round still answers wrong_step
 *   C9c  a normal lane recorded twice: the second call answers already_recorded
 *   Q13a a literal '<' quote matches '&lt;' text, and an encoded quote matches literal text
 *   Q13b '&amp;' and '&' match both ways
 *   Q13c contentHash of an entity-bearing record is byte-identical to the value the pre-plan
 *        evidence-rows.cjs computes (loaded from git, the test-365 loadBase pattern)
 *   Q13d one correction window: a dropped quote is corrected once for the same record id; a third call
 *        answers already_recorded; a correction naming a record id that did not drop answers already_recorded
 *   Q13e OK-05: a paraphrase drops unverified_quote and an unknown record drops unknown_record
 *   Q13f validateRows reports dropped_ids.unverified_quote
 *   Q13g no em-dash or en-dash in this file
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
const { check, summary } = makeChecker('test-3692-recovery');

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const Module = require('node:module');

const ROOT = path.resolve(__dirname, '..');
const RP = path.join(ROOT, 'lib', 'core', 'research-planner');
const planner = require(path.join(RP, 'planner.cjs'));
const planMod = require(path.join(RP, 'plan.cjs'));
const grants = require(path.join(RP, 'grants.cjs'));
const deep = require(path.join(RP, 'deep.cjs'));
const ev = require(path.join(RP, 'evidence-rows.cjs'));
const corpus = require(path.join(ROOT, 'lib', 'core', 'research-corpus.cjs'));
const { buildRoom363 } = require('./helpers/fixture-room-363.cjs');
const { makeReplayFetch } = require('./helpers/openalex-replay-363.cjs');

const BODIES = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-openalex', 'bodies.json'), 'utf8'));
const QS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'scientific-roadmapping.json'), 'utf8'));
const VIA = { surface: 'cli', decision_node_id: 'd-3692-20-test' };
const BASE_SHA = '45577e112'; // the tree this plan started from (the pre-plan evidence-rows.cjs)

function fakeFetch(rp) {
  return async function (a) {
    const prev = globalThis.fetch;
    globalThis.fetch = rp;
    try { return await corpus.fetchCorpusEnvelope(a); } finally { globalThis.fetch = prev; }
  };
}

// session(route, bodies) -> a deep run initialised in a fresh fixture room, not yet fetched
function session(route, bodies) {
  const room = buildRoom363({ role: 'researcher' });
  const plan = planner.buildPlan(room.roomDir, QS, { mode: 'deep', now: new Date('2026-10-04T00:00:00Z') }).plan;
  // 369.2-24 (HARNESS-10): a deep SR run now opens with round 0, the field scan. These legs test how a lane is
  // recorded in round one, so the plan goes without the scan (test-3692-baseline owns round 0)
  delete plan.baseline;
  plan.plan_hash = planMod.planHash(plan);
  const grant = grants.writeGrant(room.roomDir, grants.buildRunGrant(plan), { approved_via: VIA }).grant;
  const rp = makeReplayFetch({ route: route, bodies: bodies || BODIES });
  const init = deep.initDeepState(room.roomDir, plan, grant, {});
  return { room: room, plan: plan, id: plan.run_id, seam: fakeFetch(rp), init: init };
}

function laneOne(s) {
  const n = deep.nextDeepStep(s.room.roomDir, s.id);
  const lane = n.payload.lanes[0];
  const recs = JSON.parse(fs.readFileSync(path.join(s.room.roomDir, lane.records_path), 'utf8')).records;
  return { lane: lane, recs: recs };
}

async function main() {
  // ---- C9a, C9b, C9c ---------------------------------------------------------------------------------
  {
    const route = function (q) {
      const t = String(q || '');
      if (/anode/.test(t)) return 'gap_primary_zero';
      if (/fundamental limit/.test(t)) return 'derivation_hit';
      if (/overcome/.test(t)) return 'retest_hit';
      return 'gap_primary_zero';
    };
    const s = session(route);
    check('C9 FIXTURE: deep run initialised', s.init && s.init.ok === true, JSON.stringify(s.init));
    const pre = deep.recordLaneRows(s.room.roomDir, s.id, 'LM1', []);
    check('C9b record before fetch_round answers wrong_step', pre.ok === false && pre.reason === 'wrong_step', JSON.stringify(pre));
    await deep.fetchRound(s.room.roomDir, s.id, { fetchEnvelopeFn: s.seam });
    const st = deep.loadState(s.room.roomDir, s.id).state;
    const closed = st.lane_results.filter(function (x) { return x.searched_not_found; })[0];
    const lane = closed && closed.lane;
    check('C9a FIXTURE: a lane closed on an empty fetch', !!lane && st.expected.indexOf(lane) === -1, JSON.stringify(closed));
    const rec = deep.recordLaneRows(s.room.roomDir, s.id, lane, []);
    check('C9a record against the closed lane answers lane_already_closed',
      rec.ok === false && rec.reason === 'lane_already_closed', JSON.stringify(rec));
    check('C9a the answer names the lane, the closure reason and an ISO time',
      rec.lane === lane && rec.closed_reason === 'empty_fetch'
      && typeof rec.closed_at === 'string' && !Number.isNaN(Date.parse(rec.closed_at)), JSON.stringify(rec));
    const exp = st.expected[0];
    const r1 = deep.recordLaneRows(s.room.roomDir, s.id, exp, []);
    const r2 = deep.recordLaneRows(s.room.roomDir, s.id, exp, []);
    check('C9c a normal lane recorded once is accepted', r1.ok === true, JSON.stringify(r1));
    check('C9c the second record of the same lane answers already_recorded',
      r2.ok === false && r2.reason === 'already_recorded', JSON.stringify(r2));
    s.room.cleanup();
  }

  // ---- Q13a, Q13b (unit) ------------------------------------------------------------------------------
  const rec = {
    id: 'https://openalex.org/Wtest1',
    title: 'Gap sizing note',
    abstract_inverted_index: null,
    abstract: 'Detection range is poor when contrast ratio R &lt; 0.3 at 40 m and signal &amp; noise overlap.',
  };
  const idx = ev.recordsIndex([rec]);
  const mk = function (quote, id) { return { leaf_id: 'L1', record_id: id || rec.id, claim: 'c', quote: quote, label: 'supports' }; };
  const vopts = { leafIds: ['L1'], lane: 'T', retrievedAt: '2026-10-05T00:00:00Z' };
  const kept = function (quote) { return ev.validateRows([mk(quote)], idx, vopts).rows.length; };
  check('Q13a a literal "<" quote matches "&lt;" text', kept('contrast ratio R < 0.3 at 40 m') === 1, 'kept ' + kept('contrast ratio R < 0.3 at 40 m'));
  check('Q13a an encoded quote matches the encoded text', kept('contrast ratio R &lt; 0.3 at 40 m') === 1, 'kept ' + kept('contrast ratio R &lt; 0.3 at 40 m'));
  const litRec = { id: 'https://openalex.org/Wtest2', title: 'Literal', abstract: 'Range holds when R < 0.3 and signal & noise overlap.' };
  const litIdx = ev.recordsIndex([litRec]);
  const litKept = function (quote) { return ev.validateRows([mk(quote, litRec.id)], litIdx, vopts).rows.length; };
  check('Q13a an encoded quote matches literal text', litKept('Range holds when R &lt; 0.3') === 1, 'kept ' + litKept('Range holds when R &lt; 0.3'));
  check('Q13b "&" matches "&amp;" text', kept('signal & noise overlap') === 1, 'kept ' + kept('signal & noise overlap'));
  check('Q13b "&amp;" matches "&amp;" text', kept('signal &amp; noise overlap') === 1, 'kept ' + kept('signal &amp; noise overlap'));
  check('Q13b "&amp;" matches literal "&" text', litKept('signal &amp; noise overlap') === 1, 'kept ' + litKept('signal &amp; noise overlap'));
  check('Q13b numeric entities decode both ways (&#60; and &#x3c;)',
    kept('contrast ratio R &#60; 0.3 at 40 m') === 1 && kept('contrast ratio R &#x3c; 0.3 at 40 m') === 1);

  // ---- Q13c: contentHash is pinned against the pre-plan file ---------------------------------------------
  {
    const file = path.join(RP, 'evidence-rows.cjs');
    const probe = cp.spawnSync('git', ['cat-file', '-e', BASE_SHA + ':lib/core/research-planner/evidence-rows.cjs'], { cwd: ROOT });
    if (probe.status !== 0) {
      console.log('SKIP: Q13c base object not available (shallow clone)');
    } else {
      const src = cp.spawnSync('git', ['show', BASE_SHA + ':lib/core/research-planner/evidence-rows.cjs'],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).stdout;
      const m = new Module(file, module);
      m.filename = file;
      m.paths = Module._nodeModulePaths(path.dirname(file));
      m._compile(src, file);
      const base = m.exports;
      const records = [
        rec,
        litRec,
        { id: 'https://openalex.org/Wtest3', title: 'Plain title & more', abstract: 'A &quot;quoted&quot; &#39;word&#39; and &lt;tag&gt; text' },
        { id: 'https://openalex.org/Wtest4', title: '', abstract_inverted_index: { 'R': [0], '&lt;': [1], '0.3': [2] } },
      ];
      const same = records.every(function (r) { return base.contentHash(r) === ev.contentHash(r); });
      check('Q13c contentHash of entity-bearing records equals the pre-plan value', same,
        records.map(function (r) { return base.contentHash(r).slice(0, 14) + '/' + ev.contentHash(r).slice(0, 14); }).join(' '));
      const baseIdx = base.recordsIndex(records);
      const nowIdx = ev.recordsIndex(records);
      const hashesSame = Array.from(baseIdx.keys()).every(function (k) {
        return nowIdx.has(k) && baseIdx.get(k).content_hash === nowIdx.get(k).content_hash;
      });
      check('Q13c the stored index content_hash values are unchanged', hashesSame);
      const row = ev.validateRows([mk('contrast ratio R < 0.3 at 40 m')], nowIdx, vopts).rows[0];
      check('Q13h a kept entity row carries the pre-plan content_hash', !!row && row.content_hash === base.contentHash(rec),
        row ? row.content_hash : 'no row');
    }
  }

  // ---- Q13d: one correction window ------------------------------------------------------------------------
  {
    const bodies = JSON.parse(JSON.stringify(BODIES));
    bodies.derivation_hit.results[0].title = 'Capacity bound holds when ratio R &lt; 0.3 in the host';
    const route = function (q) { return /fundamental limit/.test(String(q)) ? 'derivation_hit' : 'gap_primary_zero'; };
    const prep = async function () {
      const s = session(route, bodies);
      await deep.fetchRound(s.room.roomDir, s.id, { fetchEnvelopeFn: s.seam });
      const l = laneOne(s);
      const bad = l.recs.filter(function (r) { return /&lt;/.test(JSON.stringify(r)); })[0];
      const other = l.recs.filter(function (r) { return r.id !== bad.id && r.title; })[0];
      s.l = l; s.bad = bad; s.other = other;
      s.row = function (rec2, quote) {
        return { leaf_id: l.lane.leaves[0].leaf_id, record_id: rec2.id, claim: 'bound holds', quote: quote, label: 'derivation' };
      };
      return s;
    };

    // run 1: bad quote, one correction, then a third call
    const s1 = await prep();
    check('Q13d FIXTURE: an entity record and a second record are fetched', !!s1.bad && !!s1.other, 'recs ' + s1.l.recs.length);
    const a1 = deep.recordLaneRows(s1.room.roomDir, s1.id, s1.l.lane.lane, [s1.row(s1.bad, 'ratio R < 0.4 in the host')]);
    check('Q13d attempt 1 (a wrong number) drops as unverified_quote',
      a1.ok === true && a1.kept === 0 && a1.dropped && a1.dropped.unverified_quote === 1, JSON.stringify(a1));
    const a2 = deep.recordLaneRows(s1.room.roomDir, s1.id, s1.l.lane.lane, [s1.row(s1.bad, 'ratio R < 0.3 in the host')]);
    check('Q13d attempt 2 (corrected quote, same record id) is accepted and keeps 1',
      a2.ok === true && a2.kept === 1 && a2.corrected === true, JSON.stringify(a2));
    const a3 = deep.recordLaneRows(s1.room.roomDir, s1.id, s1.l.lane.lane, [s1.row(s1.bad, 'ratio R < 0.3 in the host')]);
    check('Q13d attempt 3 answers already_recorded', a3.ok === false && a3.reason === 'already_recorded', JSON.stringify(a3));
    const body = JSON.parse(fs.readFileSync(path.join(s1.room.roomDir, s1.l.lane.records_path.replace(/\.records\.json$/, '.rows.json')), 'utf8'));
    const ids = body.rows.map(function (r) { return r.row_id; });
    check('Q13d the corrected row is stored with a unique row_id', body.rows.length === 1 && new Set(ids).size === ids.length, JSON.stringify(ids));
    s1.room.cleanup();

    // run 2: a correction naming a record id that did not drop
    const s2 = await prep();
    const good = s2.other.title;
    const b1 = deep.recordLaneRows(s2.room.roomDir, s2.id, s2.l.lane.lane,
      [s2.row(s2.other, good), s2.row(s2.bad, 'ratio R < 0.4 in the host')]);
    check('Q13d FIXTURE: one row kept, one dropped', b1.ok === true && b1.kept === 1 && b1.dropped.unverified_quote === 1, JSON.stringify(b1));
    const b2 = deep.recordLaneRows(s2.room.roomDir, s2.id, s2.l.lane.lane, [s2.row(s2.other, good)]);
    check('Q13d a correction naming a record id that did not drop answers already_recorded',
      b2.ok === false && b2.reason === 'already_recorded', JSON.stringify(b2));
    s2.room.cleanup();

    // run 3: no window when nothing dropped as unverified_quote
    const s3 = await prep();
    const c1 = deep.recordLaneRows(s3.room.roomDir, s3.id, s3.l.lane.lane, [s3.row(s3.bad, 'ratio R < 0.3 in the host')]);
    const c2 = deep.recordLaneRows(s3.room.roomDir, s3.id, s3.l.lane.lane, [s3.row(s3.bad, 'ratio R < 0.3 in the host')]);
    check('Q13d no window opens when every row was kept (the entity quote now verifies)',
      c1.ok === true && c1.kept === 1 && c2.ok === false && c2.reason === 'already_recorded', JSON.stringify([c1, c2]));
    s3.room.cleanup();

    // run 4: the window closes once validate has run
    const s4 = await prep();
    deep.recordLaneRows(s4.room.roomDir, s4.id, s4.l.lane.lane, [s4.row(s4.bad, 'ratio R < 0.4 in the host')]);
    deep.loadState(s4.room.roomDir, s4.id).state.expected.forEach(function (ln) {
      if (ln !== s4.l.lane.lane) deep.recordLaneRows(s4.room.roomDir, s4.id, ln, []);
    });
    deep.nextDeepStep(s4.room.roomDir, s4.id);
    const st4 = deep.loadState(s4.room.roomDir, s4.id).state;
    const d2 = deep.recordLaneRows(s4.room.roomDir, s4.id, s4.l.lane.lane, [s4.row(s4.bad, 'ratio R < 0.3 in the host')]);
    check('Q13d the window is closed once the validate step has run',
      st4.step !== 'validate' && st4.step !== 'dispatch_lanes' && d2.ok === false, 'step ' + st4.step + ' ' + JSON.stringify(d2));
    s4.room.cleanup();
  }

  // ---- Q13e (OK-05) and Q13f ----------------------------------------------------------------------------
  {
    const para = ev.validateRows([mk('the contrast ratio is below 0.3 at forty metres')], idx, vopts);
    check('Q13e a paraphrase still drops as unverified_quote', para.rows.length === 0 && para.dropped.unverified_quote === 1, JSON.stringify(para.dropped));
    const unk = ev.validateRows([mk('contrast ratio R < 0.3 at 40 m', 'https://openalex.org/Wnope')], idx, vopts);
    check('Q13e an unknown record still drops as unknown_record', unk.rows.length === 0 && unk.dropped.unknown_record === 1, JSON.stringify(unk.dropped));
    check('Q13f validateRows reports dropped_ids.unverified_quote',
      !!para.dropped_ids && Array.isArray(para.dropped_ids.unverified_quote)
      && para.dropped_ids.unverified_quote.length === 1 && para.dropped_ids.unverified_quote[0] === rec.id,
      JSON.stringify(para.dropped_ids));
    check('Q13f the exports decodeEntities and quoteKey exist',
      typeof ev.decodeEntities === 'function' && typeof ev.quoteKey === 'function'
      && ev.decodeEntities('R &lt; 0.3 &amp; &#65;&#x42;') === 'R < 0.3 & AB');
  }

  const dash = new RegExp('[' + String.fromCharCode(0x2014) + String.fromCharCode(0x2013) + ']');
  check('Q13g no em-dash or en-dash in this file', !dash.test(fs.readFileSync(__filename, 'utf8')));
  check('C9 no fetch escaped the replay', NET.attempts() === 0, 'net guard attempts ' + NET.attempts());
  process.exitCode = summary();
}

main().catch(function (e) {
  console.log('FAIL: harness ' + String((e && e.stack) || e).slice(0, 800));
  process.exit(1);
});
