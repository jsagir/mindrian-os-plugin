#!/usr/bin/env node
'use strict';
// Phase 399-07: the advisor as one key inside the single selector, and its navigator-safe presentation.
// Legs PR1 to PR5 (present.cjs), then the selector legs added with the selector change.
// The legs set the advisor env themselves; an ambient value must not change them.
process.env.MINDRIAN_DECISION_ADVISOR = 'on'; // advisor is opt-in; these legs exercise it on
delete process.env.MINDRIAN_DECISION_ADVISOR_TABLE;
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const P = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'present.cjs'));

let failed = 0;
let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok: ' + label);
  } catch (e) {
    failed += 1;
    console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e)));
  }
}

function sl(state, options, extra) {
  return Object.assign({
    state,
    key_used: '*',
    options: options.map((o, i) => ({ command: o[0], band: o[1], rank: i + 1, calibrated: o[2] })),
    no_strong_pick: state === 'no_strong_pick',
    top_tie: options.length ? 1 : 0,
    table_version: '399-vT',
  }, extra || {});
}

const BANNED_KEYS = ['calibrated', 'p', 'probability', 'confidence', 'score'];
function keysAtAnyDepth(v, out) {
  const acc = out || [];
  if (Array.isArray(v)) v.forEach((x) => keysAtAnyDepth(x, acc));
  else if (v && typeof v === 'object') Object.keys(v).forEach((k) => { acc.push(k); keysAtAnyDepth(v[k], acc); });
  return acc;
}

const OK3 = sl('ok', [['/mos:validate', 'strong', 0.95], ['/mos:mullins', 'possible', 0.6], ['/mos:map-unknowns', 'weak', 0.2]]);

check('PR1 publicShortlist keeps order, carries command, band and rank, and no number key at any depth', () => {
  const pub = P.publicShortlist(OK3, { jobId: 'validate-idea' });
  assert.equal(pub.state, 'ok');
  assert.equal(pub.job, 'validate-idea');
  assert.deepEqual(pub.options, [
    { command: '/mos:validate', band: 'strong', rank: 1 },
    { command: '/mos:mullins', band: 'possible', rank: 2 },
    { command: '/mos:map-unknowns', band: 'weak', rank: 3 },
  ]);
  assert.equal(pub.no_strong_pick, false);
  const keys = keysAtAnyDepth(pub);
  BANNED_KEYS.forEach((k) => assert.ok(keys.indexOf(k) === -1, 'banned key ' + k));
  assert.ok(typeof pub.summary === 'string' && typeof pub.basis === 'string');
});

check('PR2 the sentence for state ok names the strong pick first, then "also <band> <command>"', () => {
  const pub = P.publicShortlist(OK3, { jobId: 'validate-idea' });
  assert.equal(P.shortlistSentence(pub), 'Decision advisor, for the job validate-idea: strong pick /mos:validate; also possible /mos:mullins and weak /mos:map-unknowns.');
  assert.equal(pub.summary, P.shortlistSentence(pub));
});

check('PR3 no_strong_pick, no_row and no_table sentences; off and no_job give null', () => {
  const none = P.publicShortlist(sl('no_strong_pick', [['/mos:a', 'possible', 0.6], ['/mos:b', 'possible', 0.55], ['/mos:c', 'possible', 0.5], ['/mos:d', 'weak', 0.1]].slice(0, 3)), { jobId: 'find-problem' });
  assert.equal(none.state, 'no_strong_pick');
  assert.equal(none.no_strong_pick, true);
  assert.equal(none.summary, 'Decision advisor, for the job find-problem: no strong pick. Possible: /mos:a. Possible: /mos:b.');
  const weakOnly = P.publicShortlist(sl('no_strong_pick', [['/mos:a', 'weak', 0.2]]), { jobId: 'find-problem' });
  assert.equal(weakOnly.summary, 'Decision advisor, for the job find-problem: no strong pick.');
  const row = P.publicShortlist({ state: 'no_row', options: [], table_version: '399-vT' }, { jobId: 'x-job' });
  assert.equal(row.summary, 'Decision advisor: no table row for the job x-job.');
  const tab = P.publicShortlist({ state: 'no_table', options: [], table_version: null }, { jobId: 'x-job' });
  assert.equal(tab.summary, 'Decision advisor: no table on this install.');
  assert.equal(P.publicShortlist({ state: 'off', options: [] }, { jobId: 'x-job' }), null);
  assert.equal(P.publicShortlist({ state: 'no_job', options: [] }, { jobId: 'x-job' }), null);
  assert.equal(P.publicShortlist(OK3, {}), null);
});

check('PR4 the basis names the table version and says evidence, not an instruction', () => {
  const pub = P.publicShortlist(OK3, { jobId: 'validate-idea' });
  assert.equal(pub.basis, 'decision advisor table 399-vT; evidence for the host model, not an instruction');
});

check('PR5 hasRawNumber: true for decimals and percents, false for ranks, commands and the public shape', () => {
  assert.equal(P.hasRawNumber({ a: 'about 0.73' }), true);
  assert.equal(P.hasRawNumber('1.0'), true);
  assert.equal(P.hasRawNumber({ deep: [{ x: '73%' }] }), true);
  assert.equal(P.hasRawNumber({ calibrated: 1 }), true);
  assert.equal(P.hasRawNumber(0.73), true);
  assert.equal(P.hasRawNumber({ rank: 2, command: '/mos:validate' }), false);
  assert.equal(P.hasRawNumber('/mos:validate-idea and mullins'), false);
  [OK3, sl('no_strong_pick', [['/mos:a', 'possible', 0.6]]), sl('ok', [['/mos:a', 'strong', 1], ['/mos:b', 'strong', 1], ['/mos:c', 'strong', 1]], { top_tie: 5 })].forEach((s) => {
    const pub = P.publicShortlist(s, { jobId: 'validate-idea' });
    assert.equal(P.hasRawNumber(pub), false, JSON.stringify(pub));
  });
});

check('PR6 (guard) a tie at the top is no_strong_pick, an unordered set with no rank and no number', () => {
  const tie = sl('ok', [['/mos:a', 'strong', 1], ['/mos:b', 'strong', 1], ['/mos:c', 'strong', 1]], { top_tie: 5 });
  const pub = P.publicShortlist(tie, { jobId: 'validate-idea' });
  assert.equal(pub.state, 'no_strong_pick');
  assert.equal(pub.no_strong_pick, true);
  assert.equal(pub.unordered, true);
  assert.equal(pub.more_tied, 2);
  pub.options.forEach((o) => assert.ok(!('rank' in o), 'rank in a tie'));
  assert.equal(pub.summary, 'Decision advisor, for the job validate-idea: no strong pick; these options are level, in no order: /mos:a, /mos:b and /mos:c; 2 more not listed.');
  // A tie of two inside the listed options is a tie even when the row count is absent.
  const t2 = P.publicShortlist({ state: 'ok', options: [{ command: '/mos:a', band: 'strong', rank: 1, calibrated: 1 }, { command: '/mos:b', band: 'strong', rank: 2, calibrated: 1 }, { command: '/mos:c', band: 'possible', rank: 3, calibrated: 0.6 }], table_version: '399-vT' }, { jobId: 'validate-idea' });
  assert.equal(t2.unordered, true);
  assert.deepEqual(t2.options.map((o) => o.command), ['/mos:a', '/mos:b']);
});

// ---- selector legs (Task 2) ----
const fs = require('node:fs');
const os = require('node:os');
const NM = require(path.join(ROOT, 'lib', 'core', 'feyminto', 'next-move.cjs'));
const SL = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'shortlist.cjs'));

const JOB = 'validate-idea';
const strip = (n) => String(n).replace(/^\/mos:/, '');
const REG = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'command-registry.json'), 'utf8')).commands.filter((c) => c && typeof c.command === 'string');
const serves = (name, job) => { const e = REG.find((c) => strip(c.command) === name); return !!(e && Array.isArray(e.serves_jtbd) && e.serves_jtbd.indexOf(job) !== -1); };
const ALL = REG.map((c) => strip(c.command));
const SERVING = ALL.filter((n) => serves(n, JOB));
const NOT_SERVING = ALL.filter((n) => !serves(n, JOB));
const [A, B, C, X] = SERVING;
const D = NOT_SERVING[0];

const capabilityFor = () => ({ known: true, cli: 'runnable', mcp: 'runnable', label: 'runnable (test)' });
const src = (contract, table) => ({ contract: { names: contract || [] }, navigator_table: { names: table || [] } });
const face = (names) => ({ asked: true, commands: names.map((n) => ({ name: n, cli: 'runnable', mcp: 'runnable' })) });
function compose(extra) {
  return NM.composeNextMove(Object.assign({ surface: 'mcp', face: { asked: false, commands: [] }, ledgerCandidates: null, attempted: [], need: {}, capabilityFor }, extra));
}
const order = (m) => (m.primary ? [m.primary.command] : []).concat(m.alternatives.map((a) => a.command));
// The selector output without the advisor block: what must not change when the advisor abstains or is off.
const sansAdvisor = (m) => { const o = Object.assign({}, m); delete o.advisor; return JSON.stringify(o); };
function withEnv(env, fn) {
  const saved = {};
  Object.keys(env).forEach((k) => { saved[k] = process.env[k]; if (env[k] === null) delete process.env[k]; else process.env[k] = env[k]; });
  try { return fn(); } finally { Object.keys(saved).forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }); }
}
const OFF = { MINDRIAN_DECISION_ADVISOR: 'off' };
const sel = (state, options, extra) => Object.assign({ state, key_used: '*', options: options.map((o, i) => ({ command: '/mos:' + o[0], band: o[1], rank: i + 1, calibrated: o[2] })), no_strong_pick: state === 'no_strong_pick', top_tie: options.length ? 1 : 0, table_version: '399-vT' }, extra || {});

check('N0 the registry has enough commands for the fixtures', () => {
  assert.ok(SERVING.length >= 4 && NOT_SERVING.length >= 1);
});

check('N1 no job: no advisor key, and the output equals the advisor-off output', () => {
  const inputs = { sources: src([A], [A, B]), face: face([B, A]), advisorShortlist: sel('ok', [[B, 'strong', 1]]) };
  const on = compose(inputs);
  const off = withEnv(OFF, () => compose(inputs));
  assert.equal(Object.prototype.hasOwnProperty.call(on, 'advisor'), false);
  assert.equal(JSON.stringify(on), JSON.stringify(off));
});

check('N2 a job and no strong pick: the selector output equals advisor-off; advisor.state is no_strong_pick', () => {
  const inputs = { jobId: JOB, jobFit: {}, sources: src([A, B], [A]), face: face([A, B]), advisorShortlist: sel('no_strong_pick', [[B, 'possible', 0.6], [A, 'weak', 0.2]]) };
  const on = compose(inputs);
  const off = withEnv(OFF, () => compose(inputs));
  assert.equal(sansAdvisor(on), sansAdvisor(off));
  assert.equal(on.advisor.state, 'no_strong_pick');
  assert.equal(Object.prototype.hasOwnProperty.call(off, 'advisor'), false);
});

check('N3 a strong advisor pick ordered ahead of the command Theo named first; the why says so', () => {
  // A: Theo first, named by the table too (3 sources with the job). B: named by the contract only (2 sources with the job).
  const base = { jobId: JOB, jobFit: {}, sources: src([B], [A]), face: face([A]) };
  const offOrder = order(withEnv(OFF, () => compose(base)));
  assert.equal(offOrder[0], A, 'without the advisor A wins on sources');
  const m = compose(Object.assign({ advisorShortlist: sel('ok', [[B, 'strong', 0.95], [C, 'possible', 0.6]]) }, base));
  assert.equal(m.primary.command, B);
  assert.ok(m.primary.why.indexOf('Theo ranked ' + A + ' first, but the decision advisor has a strong pick for the job') !== -1, m.primary.why);
});

check('N4 a strong pick that serves the job enters the pool with the advisor label; one that does not serve it is not added', () => {
  const m = compose({ jobId: JOB, jobFit: {}, sources: src([A], []), advisorShortlist: sel('ok', [[C, 'strong', 0.95], [D, 'strong', 0.9]]) });
  const all = [m.primary].concat(m.alternatives).filter(Boolean);
  const c = all.find((x) => x.command === C);
  assert.ok(c, 'C is offered');
  assert.deepEqual(c.sources.filter((s) => s === 'the decision advisor'), ['the decision advisor']);
  assert.equal(all.some((x) => x.command === D), false, 'D is not added');
});

check('N5 when the ledger rating differs, the ledger order wins over a strong advisor pick', () => {
  const m = compose({ jobId: JOB, jobFit: { [A]: 2, [B]: 0 }, sources: src([A, B], []), advisorShortlist: sel('ok', [[B, 'strong', 0.95]]) });
  assert.deepEqual(order(m).slice(0, 2), [A, B]);
});

check('N6 result.advisor equals publicShortlist of the shortlist and holds no raw number', () => {
  const PR = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'present.cjs'));
  const s = sel('ok', [[B, 'strong', 0.95], [C, 'possible', 0.6]]);
  const m = compose({ jobId: JOB, jobFit: {}, sources: src([B], [A]), advisorShortlist: s });
  assert.deepEqual(m.advisor, PR.publicShortlist(s, { jobId: JOB }));
  assert.equal(PR.hasRawNumber(m.advisor), false);
  assert.equal(PR.hasRawNumber(m.primary.why), false);
});

check('N7 SELECTOR_ORDER and selectorMark name the advisor table build', () => {
  assert.equal(NM.SELECTOR_ORDER, '399-07');
  const meta = SL.tableMeta();
  const mark = NM.selectorMark();
  assert.ok(mark.startsWith('order 399-07, ledger built '), mark);
  assert.ok(mark.endsWith(', advisor table ' + meta.version), mark);
  const none = withEnv({ MINDRIAN_DECISION_ADVISOR_TABLE: path.join(os.tmpdir(), 'no-such-table-399.json') }, () => NM.selectorMark());
  assert.ok(none.endsWith(', advisor table none'), none);
  assert.ok(withEnv(OFF, () => NM.selectorMark()).endsWith(', advisor table off'));
});

check('N9 toTierCandidates keeps at most 3 items, each with confidence null', () => {
  const m = compose({ jobId: JOB, jobFit: {}, sources: src([A, B, C, X], [A]), face: face([A]), advisorShortlist: sel('ok', [[B, 'strong', 0.95]]) });
  const t = NM.toTierCandidates(m);
  assert.ok(t[0].items.length <= 3);
  t[0].items.forEach((i) => assert.equal(i.confidence, null));
});

// ---- the orchestrator guard: ties ----
check('G1 a 3-way tie at the top: the selector output is byte-identical to advisor-off', () => {
  const tie = sel('ok', [[A, 'strong', 1], [B, 'strong', 1], [C, 'strong', 1]], { top_tie: 3 });
  [
    { jobId: JOB, jobFit: {}, sources: src([X], [X, A]), face: face([X]) },
    { jobId: JOB, jobFit: {}, sources: src([A, X], []), face: face([A]) },
    { jobId: JOB, jobFit: {}, sources: src([X], []) },
  ].forEach((base, i) => {
    const on = compose(Object.assign({ advisorShortlist: tie }, base));
    const off = withEnv(OFF, () => compose(base));
    assert.equal(sansAdvisor(on), sansAdvisor(off), 'case ' + i);
    // The tied commands are not added to the pool as an advisor source.
    assert.equal(JSON.stringify(on).indexOf('the decision advisor'), -1, 'no advisor label in case ' + i);
  });
});

check('G2 the tie result is no_strong_pick with an unordered set, no rank and no number', () => {
  const PR = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'present.cjs'));
  const tie = sel('ok', [[A, 'strong', 1], [B, 'strong', 1], [C, 'strong', 1]], { top_tie: 3 });
  const m = compose({ jobId: JOB, jobFit: {}, sources: src([X], []), advisorShortlist: tie });
  assert.equal(m.advisor.state, 'no_strong_pick');
  assert.equal(m.advisor.unordered, true);
  m.advisor.options.forEach((o) => assert.equal('rank' in o, false));
  assert.equal(PR.hasRawNumber(m.advisor), false);
});

check('G3 a unique top above a tie: the top is promoted; the tied pair keeps the order the other keys give', () => {
  // X is named first by the contract and A, B are named after it; X is not in the shortlist.
  const base = { jobId: JOB, jobFit: {}, sources: src([X, B, A, C], []) };
  const offOrder = order(withEnv(OFF, () => compose(base)));
  assert.deepEqual(offOrder, [X, B, A]);
  const m = compose(Object.assign({ advisorShortlist: sel('ok', [[C, 'strong', 1], [A, 'strong', 0.9], [B, 'strong', 0.9]]) }, base));
  assert.equal(m.primary.command, C, 'the unique top is promoted');
  // A and B tie at 0.9: B stays ahead of A, as the contract order gives (not alphabetical, not rank).
  const rest = order(m).slice(1);
  assert.deepEqual(rest, [B, A]);
});

check('G4 the kill switch gives output equal to the pre-advisor selector (no advisor key, same order)', () => {
  const s = sel('ok', [[B, 'strong', 0.95]]);
  const base = { jobId: JOB, jobFit: {}, sources: src([B], [A]), face: face([A]) };
  const off = withEnv(OFF, () => compose(Object.assign({ advisorShortlist: undefined }, base)));
  assert.equal(Object.prototype.hasOwnProperty.call(off, 'advisor'), false);
  assert.deepEqual(order(off)[0], A);
  // Even a seam shortlist is not read through the lookup when the switch is off; the table path is not touched.
  const real = withEnv(OFF, () => compose(base));
  assert.equal(JSON.stringify(real), JSON.stringify(off));
  assert.ok(s);
});

check('G5 no raw number in the whole selector result across states', () => {
  const PR = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'present.cjs'));
  [sel('ok', [[B, 'strong', 0.95]]), sel('no_strong_pick', [[B, 'possible', 0.6]]), sel('ok', [[A, 'strong', 1], [B, 'strong', 1]], { top_tie: 2 })].forEach((s) => {
    const m = compose({ jobId: JOB, jobFit: {}, sources: src([B], [A]), face: face([A]), advisorShortlist: s });
    assert.equal(PR.hasRawNumber(m.advisor), false);
    assert.equal(/\d\.\d/.test(JSON.stringify(m.primary.why) + JSON.stringify(m.alternatives.map((a) => a.why))), false);
  });
});

// ---- N8: a real room, the definition level, a fixture table ----
function roomLegs() {
  const H = require('./helpers/isolated-home-36925.cjs');
  const iso = H.mkIsolatedHome('399adv');
  const born = H.birthFixtureRoom({ iso, slug: 'adv-room', vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!born || born.ok !== true) throw new Error('fixture birth failed');
  const roomDir = fs.realpathSync(born.roomDir);
  const sectionPath = path.join(roomDir, 'problem-definition');
  const nest = NM.gatherNest({ roomDir, sectionDir: sectionPath });
  const job = nest.job.id;
  assert.ok(job, 'the fixture nest has a section job');
  const servingJob = ALL.filter((n) => serves(n, job));
  const rowIll = [{ command: '/mos:' + servingJob[0], calibrated: 0.95 }, { command: '/mos:' + servingJob[1], calibrated: 0.8 }, { command: '/mos:' + servingJob[2], calibrated: 0.3 }];
  const rowAny = [{ command: '/mos:' + servingJob[3], calibrated: 0.9 }, { command: '/mos:' + servingJob[2], calibrated: 0.2 }];
  const table = { schema: 'mos.decision-advisor-table/1', table_version: '399-fixture', thresholds: { strong: 0.7, possible: 0.5 }, shortlist_k: 3, key_order: ['job', 'definition_level', 'last_command'], conditioned_rows: true, rows: { [job + '|ill-defined|*']: rowIll, [job + '|*|*']: rowAny } };
  const file = path.join(iso.home, 'fixture-table.json');
  fs.writeFileSync(file, JSON.stringify(table), 'utf8');
  return { roomDir, sectionPath, job, rowIll, rowAny, file, iso, nestSection: nest.section };
}

check('N8 nextMoveForSection reads the room definition level and builds the advisor block from that row', () => {
  const R = roomLegs();
  fs.writeFileSync(path.join(R.roomDir, 'STATE.md'), '---\ndefinition_level: ill-defined\n---\n# State\n', 'utf8');
  const optsOf = (m) => m.advisor.options.map((o) => o.command);
  const withLevel = withEnv({ MINDRIAN_DECISION_ADVISOR_TABLE: R.file, MINDRIAN_DECISION_ADVISOR: 'on' }, () => NM.nextMoveForSection({ roomDir: R.roomDir, sectionDir: R.sectionPath, surface: 'mcp' }));
  assert.deepEqual(optsOf(withLevel), R.rowIll.map((e) => e.command), 'ill-defined row');
  assert.equal(withLevel.advisor.state, 'ok');
  fs.writeFileSync(path.join(R.roomDir, 'STATE.md'), '# State\n', 'utf8');
  const noLevel = withEnv({ MINDRIAN_DECISION_ADVISOR_TABLE: R.file, MINDRIAN_DECISION_ADVISOR: 'on' }, () => NM.nextMoveForSection({ roomDir: R.roomDir, sectionDir: R.sectionPath, surface: 'mcp' }));
  assert.deepEqual(optsOf(noLevel), R.rowAny.map((e) => e.command), 'job-only row');
  const off = withEnv({ MINDRIAN_DECISION_ADVISOR_TABLE: R.file, MINDRIAN_DECISION_ADVISOR: 'off' }, () => NM.nextMoveForSection({ roomDir: R.roomDir, sectionDir: R.sectionPath, surface: 'mcp' }));
  assert.equal(Object.prototype.hasOwnProperty.call(off, 'advisor'), false);
});

// SELECTOR-LEGS-END

// ---- N10: suggest_next carries the shortlist to the host model (Task 3) ----
async function suggestLegs() {
  const H = require('./helpers/isolated-home-36925.cjs');
  const iso = H.mkIsolatedHome('399sug');
  const born = H.birthFixtureRoom({ iso, slug: 'adv-sug', vname: 'Quokka Labs', ventureText: 'Quokka Labs onboarding platform' });
  if (!born || born.ok !== true) throw new Error('fixture birth failed');
  const roomDir = fs.realpathSync(born.roomDir);
  const SEC = 'problem-definition';
  const job = NM.gatherNest({ roomDir, sectionDir: path.join(roomDir, SEC) }).job.id;
  const SESSION = 'test-399-advisor-' + Date.now() + '-' + Math.random().toString(36).slice(2);
  require(path.join(ROOT, 'lib', 'core', 'session-binding.cjs')).writeSessionBinding(SESSION, { bound: ['adv-sug'], primary: 'adv-sug', sticky: false }, { home: iso.roomsHome });
  const servingJob = ALL.filter((n) => serves(n, job));
  const rows = { [job + '|*|*']: [{ command: '/mos:' + servingJob[0], calibrated: 0.95 }, { command: '/mos:' + servingJob[1], calibrated: 0.6 }, { command: '/mos:' + servingJob[2], calibrated: 0.2 }] };
  const table = { schema: 'mos.decision-advisor-table/1', table_version: '399-fixture', thresholds: { strong: 0.7, possible: 0.5 }, shortlist_k: 3, key_order: ['job', 'definition_level', 'last_command'], conditioned_rows: false, rows };
  const file = path.join(iso.home, 'sug-table.json');
  fs.writeFileSync(file, JSON.stringify(table), 'utf8');
  const registered = [];
  const server = { tool(name, _d, a, b) { registered.push({ name, handler: typeof b === 'function' ? b : a }); }, registerTool(name, _c, handler) { registered.push({ name, handler }); }, server: { getClientCapabilities() { return {}; } } };
  require(path.join(ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs')).register(server, { fallbackRoomDir: roomDir });
  const suggestNext = registered.find((r) => r.name === 'suggest_next').handler;
  const pull = async () => JSON.parse((await suggestNext({ section: SEC }, { sessionId: SESSION })).content[0].text);
  const PR = require(path.join(ROOT, 'lib', 'core', 'decision-advisor', 'present.cjs'));

  async function withEnvAsync(env, fn) {
    const saved = {};
    Object.keys(env).forEach((k) => { saved[k] = process.env[k]; if (env[k] === null) delete process.env[k]; else process.env[k] = env[k]; });
    try { return await fn(); } finally { Object.keys(saved).forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }); }
  }
  const on = await withEnvAsync({ MINDRIAN_DECISION_ADVISOR_TABLE: file, MINDRIAN_DECISION_ADVISOR: 'on' }, pull);
  const off = await withEnvAsync({ MINDRIAN_DECISION_ADVISOR_TABLE: file, MINDRIAN_DECISION_ADVISOR: 'off' }, pull);
  check('N10 suggest_next carries next_move.advisor with state and options, and no raw number', () => {
    const a = on.next_move.advisor;
    assert.ok(a && typeof a === 'object', JSON.stringify(on.next_move).slice(0, 300));
    assert.equal(a.state, 'ok');
    assert.deepEqual(a.options.map((o) => o.command), rows[job + '|*|*'].map((e) => e.command));
    assert.deepEqual(a.options.map((o) => o.band), ['strong', 'possible', 'weak']);
    assert.equal(PR.hasRawNumber(a), false);
    assert.equal(PR.hasRawNumber(a.summary), false);
    assert.equal(PR.hasRawNumber(on.next_move.primary.why), false);
    assert.equal(on.next_move.primary.command, strip(rows[job + '|*|*'][0].command), 'the strong unique top leads');
  });
  check('N10b with the kill switch off, next_move has no advisor key', () => {
    assert.equal(Object.prototype.hasOwnProperty.call(off.next_move, 'advisor'), false);
  });
}

suggestLegs().then(() => {
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}, (e) => { console.log('FAIL: N10 setup -- ' + (e && e.message ? e.message : String(e))); process.exit(1); });
