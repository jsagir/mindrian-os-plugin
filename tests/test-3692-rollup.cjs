#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.2 Plan 18 (369.2-R19; SW-16, OK-06 preserved). A roll-up into a section whose directory exists
 * but which has no .reasoning/<section>/REASONING.md used to stay a partial with reason no_reasoning_file:
 * the roll-up had an undeclared prerequisite that most new sections lack, and no test pinned the path.
 *
 *   U1  the section directory market-analysis and STATE.md exist, REASONING.md does not: filing lands the
 *       roll-up (report.partial false, rollup.ok true, the file now exists with the run's entries)
 *   U2  a section the room does not have: the report stays partial, not_landed holds no_reasoning_file, the
 *       roll-up note reads 'No section named <section> exists in this room, so nothing was rolled up.', and
 *       no .reasoning/<section> folder was created
 *   U3  an existing REASONING.md rolls up exactly as before (the 363 FI9 path): entries land, no new
 *       feynman-minto violation, MINTO.md bytes unchanged
 *   U4  a room with the section directory but no STATE.md: generation cannot run, the partial stays with
 *       no_reasoning_file and the note says it could not be generated (it never writes a half file)
 *   U5  no em-dash or en-dash in this file
 *
 * Hermetic: HOME and USERPROFILE are mkdtemp dirs before any repo module loads; a net guard counts any fetch.
 *
 * Output: one PASS or FAIL line per leg, then PASS: n FAIL: n. Exit 0 pass, 1 fail.
 * House rule: hyphens only.
 */

const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 't3692-18-roll-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 't3692-18-roll-rooms-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(__dirname, 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
const NET = hygiene.installNetGuard();
const { check, summary } = hygiene.makeChecker('test-3692-rollup');

const { buildRoom363 } = require(path.join(__dirname, 'helpers', 'fixture-room-363.cjs'));
const reasoningOps = require(path.join(ROOT, 'lib', 'core', 'reasoning-ops.cjs'));
const minto = require(path.join(ROOT, 'lib', 'core', 'feynman-minto-invariants.cjs'));
const FILING = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'filing.cjs'));

const RUN_ID = 'rp-2026-10-05-abcd1818';
const NOW = new Date('2026-10-05T12:00:00Z');
const U1_URL = 'https://openalex.org/W1801';
const U2_URL = 'https://openalex.org/W1802';

const rooms = [];
function newRoom() {
  const r = buildRoom363({ role: 'researcher' });
  rooms.push(r);
  return r;
}
process.on('exit', function () {
  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* best effort */ } });
});

function row(id, leaf, label, url) {
  return {
    row_id: id, leaf_id: leaf, record_id: url, claim: 'Code-written claim for ' + id + '.', quote: 'Verbatim quote for ' + id + '.',
    label: label, source_url: url, source_title: 'Source title for ' + url.slice(-4), retrieved_at: '2026-10-05T10:00:00.000Z',
    content_hash: crypto.createHash('sha256').update(url).digest('hex'), evidence_tier: 'Academic', source_type: 'peer_reviewed',
    flags: { retracted: false, is_in_doaj: null, venue: null },
  };
}

// a deep-shaped run with one supported leaf and one contradicted leaf, returning into `section`
function fixture(section) {
  const leaves = [
    { id: 'L1', parent: 'K1', question: 'Does an acoustic method remove biofilm from closed loops?', origin: 'user_stated', dimension: 'ws:gap_claim', corpus: 'openalex', researchable: true, status: 'supported', support_count: 2, contradict_count: 0, falsifier: { text: 'A paper that answers the leaf directly.' }, queries: [] },
    { id: 'L2', parent: 'K1', question: 'Has the method been tested above one hundred liters?', origin: 'user_stated', dimension: 'ws:gap_claim', corpus: 'openalex', researchable: true, status: 'contradicted', support_count: 0, contradict_count: 1, falsifier: { text: 'A paper that answers the leaf directly.' }, queries: [] },
  ];
  const rows = [row('E-A-1', 'L1', 'supports', U1_URL), row('E-A-2', 'L1', 'supports', U2_URL), row('E-B-1', 'L2', 'contradicts', U2_URL)];
  const plan = {
    schema: 'mos.research-plan/1', run_id: RUN_ID, mode: 'deep', version: 1, max_revisions: 3, revision: 0, status: 'ready', parent_plan_hash: null,
    origin: { template_id: 'whitespace', command: '/mos:whitespace' },
    perspective: { engine: 'constraint-layer', depth: 'lite', version: 1, tension: { statement: 'Fouling raises cost.' }, goal: { target: 'Remove biofilm without chemicals.' }, limiters: [], paths: [], ranking: [], ratchet: { version: 1, parent_plan_hash: null, discarded: [], settled: [] }, next_binding_constraint: null },
    pyramid: { governing_question: 'Can acoustic biofilm removal replace chemical dosing?', governing_status: 'split', key_line: [{ id: 'K1', label: 'Efficacy', leaf_ids: ['L1', 'L2'], status: 'contested' }], coverage: { uncovered: [] }, dropped: [], mece: { warnings: [] } },
    leaves: leaves,
    budget: { breadth: 4, rounds: 2, queries_per_round: 2, results_per_query: 5, max_searches: 16, time_budget_ms: 1200000, counterevidence: true },
    stop_rules: ['cap'], grant_ref: { grant_id: 'g-1', lifetime: 'run' }, return_target: { section: section }, plan_hash: 'planhash-fixture-18',
  };
  const run = {
    schema: 'mos.research-run/1', run_id: RUN_ID, mode: 'deep', plan_hash: plan.plan_hash, grant_ref: plan.grant_ref, trigger: 'navigator',
    started_at: '2026-10-05T10:00:00.000Z', finished_at: '2026-10-05T10:20:00.000Z', stop_reason: 'cap', queries: [],
    records_path: '.mindrian/research-runs/' + RUN_ID + '/records.json', rows: rows, dropped: {}, leaves: leaves, verdict: null,
    answer_line: 'The run stopped on cap.', pyramid: plan.pyramid, perspective: plan.perspective, governing_status: 'split',
    unresolved_branches: [], opportunity_candidates: [], contradictions: [], escalation_offer: null, local_checks: [], timings: { total_ms: 1200000 },
    filed: false, classifications: [], next_binding_constraint: null,
  };
  return { plan: plan, run: run };
}

function file(room, section) {
  const fx = fixture(section);
  const basket = FILING.buildBasket(fx.run, fx.plan);
  const items = basket.filter(function (i) { return i.default_on === true; }).map(function (i) { return i.id; });
  const hasRollup = basket.some(function (i) { return i.kind === 'rollup'; });
  const res = FILING.fileRun(room.roomDir, fx.run, fx.plan, { approved: true, items: items }, { now: NOW, approvedVia: 'f8-basket' });
  return { res: res, hasRollup: hasRollup };
}

function reasoningPath(room, section) { return path.join(room.roomDir, '.reasoning', section, 'REASONING.md'); }
function leg(name, fn) {
  try {
    const r = fn();
    check(name, r === true, String(r));
  } catch (e) {
    check(name, false, String((e && e.message) || e).replace(/\s+/g, ' ').slice(0, 500));
  }
}

leg('U1 a section with a directory and no REASONING.md: the roll-up generates it and lands', function () {
  const room = newRoom();
  const section = 'market-analysis';
  assert.ok(fs.statSync(path.join(room.roomDir, section)).isDirectory(), 'fixture has no section directory');
  assert.ok(fs.existsSync(path.join(room.roomDir, 'STATE.md')), 'fixture has no STATE.md');
  assert.ok(!fs.existsSync(reasoningPath(room, section)), 'REASONING.md already exists');
  const out = file(room, section);
  assert.ok(out.hasRollup, 'the basket carries no roll-up item');
  assert.ok(out.res && out.res.ok === true, 'fileRun ' + JSON.stringify(out.res).slice(0, 300));
  const rep = out.res.report;
  console.log('U1 measured: partial=' + rep.partial + ' rollup=' + JSON.stringify(rep.rollup).slice(0, 240) + ' not_landed=' + JSON.stringify(rep.not_landed));
  assert.strictEqual(rep.partial, false, 'report is partial: ' + JSON.stringify(rep.not_landed));
  assert.ok(rep.rollup && rep.rollup.ok === true && rep.rollup.entries > 0, 'roll-up did not land');
  assert.ok(fs.existsSync(reasoningPath(room, section)), 'REASONING.md was not created');
  const all = JSON.stringify(reasoningOps.getReasoningFrontmatter(room.roomDir, section));
  assert.ok(all.indexOf(RUN_ID) !== -1 && all.indexOf('L1') !== -1 && all.indexOf('L2') !== -1, 'the run entries are not in the frontmatter');
  return true;
});

leg('U2 a section the room does not have stays an honest partial with a note naming it, and nothing is created', function () {
  const room = newRoom();
  const section = 'pedagogy-notes';
  assert.ok(!fs.existsSync(path.join(room.roomDir, section)), 'fixture already has the section');
  const out = file(room, section);
  assert.ok(out.res && out.res.ok === true, 'fileRun ' + JSON.stringify(out.res).slice(0, 300));
  const rep = out.res.report;
  console.log('U2 measured: partial=' + rep.partial + ' rollup=' + JSON.stringify(rep.rollup).slice(0, 300) + ' not_landed=' + JSON.stringify(rep.not_landed));
  assert.strictEqual(rep.partial, true);
  assert.ok(rep.not_landed.some(function (n) { return n.reason === 'no_reasoning_file'; }), 'no_reasoning_file is not in not_landed');
  assert.strictEqual(rep.rollup.ok, false);
  assert.strictEqual(rep.rollup.reason, 'no_reasoning_file');
  assert.ok(String(rep.rollup.note).indexOf('No section named ' + section + ' exists in this room, so nothing was rolled up.') !== -1, rep.rollup.note);
  assert.ok(!fs.existsSync(path.join(room.roomDir, '.reasoning', section)), 'a .reasoning folder was created for a section the room does not have');
  assert.ok(!fs.existsSync(path.join(room.roomDir, section)), 'a section directory was created');
  return true;
});

leg('U3 an existing REASONING.md rolls up exactly as before (no new violation, MINTO.md untouched)', function () {
  const room = newRoom();
  const section = 'market-analysis';
  reasoningOps.generateReasoning(room.roomDir, section);
  const rp = reasoningPath(room, section);
  assert.ok(fs.existsSync(rp), 'seed REASONING.md missing');
  const mintoFile = path.join(room.roomDir, section, 'MINTO.md');
  fs.writeFileSync(mintoFile, '# Market Analysis\n\nGenerated file. Never hand-edited.\n', 'utf8');
  const mintoBefore = fs.readFileSync(mintoFile, 'utf8');
  const keys = function () { return minto.validate(rp).violations.map(function (v) { return v.category + '|' + v.message; }); };
  const before = keys();
  const seeded = fs.readFileSync(rp, 'utf8');
  const out = file(room, section);
  assert.ok(out.res && out.res.ok === true, 'fileRun failed');
  const rep = out.res.report;
  assert.strictEqual(rep.partial, false, JSON.stringify(rep.not_landed));
  assert.ok(rep.rollup.ok === true && rep.rollup.entries > 0 && /MINTO\.md/.test(rep.rollup.note), JSON.stringify(rep.rollup));
  assert.notStrictEqual(fs.readFileSync(rp, 'utf8'), seeded, 'the roll-up did not change REASONING.md');
  assert.deepStrictEqual(keys().filter(function (k) { return before.indexOf(k) === -1; }), []);
  assert.strictEqual(fs.readFileSync(mintoFile, 'utf8'), mintoBefore);
  return true;
});

leg('U4 a section directory with no STATE.md: generation cannot run, the partial stays and says it could not be generated', function () {
  const room = newRoom();
  const section = 'market-analysis';
  fs.rmSync(path.join(room.roomDir, 'STATE.md'), { force: true });
  const out = file(room, section);
  assert.ok(out.res && out.res.ok === true, 'fileRun failed');
  const rep = out.res.report;
  console.log('U4 measured: rollup=' + JSON.stringify(rep.rollup).slice(0, 300));
  assert.strictEqual(rep.partial, true);
  assert.ok(rep.not_landed.some(function (n) { return n.reason === 'no_reasoning_file'; }));
  assert.ok(/could not be generated/.test(String(rep.rollup.note)), rep.rollup.note);
  assert.ok(!fs.existsSync(reasoningPath(room, section)), 'a REASONING.md was written without STATE.md');
  return true;
});

leg('U5 no em-dash or en-dash in this file', function () {
  const dash = new RegExp('[' + String.fromCharCode(0x2014) + String.fromCharCode(0x2013) + ']');
  assert.ok(!dash.test(fs.readFileSync(__filename, 'utf8')));
  return true;
});

check('U0 no fetch escaped', NET.attempts() === 0, 'attempts ' + NET.attempts());
process.exitCode = summary();
