'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363 Plan 14 -- research run filing (lib/core/research-planner/
 * filing.cjs). Legs FI1-FI13, all offline.
 *
 * RunResult and Plan fixtures are built inline in the 363-05 shapes. Rooms come
 * from fixture-room-363. Graph assertions read room.db through navigation read
 * functions only (findOpenQuestions, findContradictions, getNeighborhood); no
 * raw SQL here. No em-dash or en-dash literals: those characters are spelled
 * with String.fromCharCode.
 *
 * Exit 0 pass, 1 fail, 77 skip (fixtures absent).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-filing-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(__dirname, 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.OPENALEX_API_KEY;
delete process.env.OPENALEX_EMAIL;
const guard = hygiene.installNetGuard();
const { check, summary } = hygiene.makeChecker('363-14 research run filing');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let buildRoom363 = null;
try {
  buildRoom363 = require(path.join(__dirname, 'helpers', 'fixture-room-363.cjs')).buildRoom363;
} catch (_e) {
  console.log('SKIP: 363-02 fixture room absent');
  process.exit(77);
}

const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));
const roomDbMod = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
const opportunityOps = require(path.join(ROOT, 'lib', 'core', 'opportunity-ops.cjs'));
const reasoningOps = require(path.join(ROOT, 'lib', 'core', 'reasoning-ops.cjs'));
const minto = require(path.join(ROOT, 'lib', 'core', 'feynman-minto-invariants.cjs'));
const perspective = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'perspective.cjs'));
const auditLedger = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'audit-ledger.cjs'));

let FILING = null;
let loadError = null;
const FILING_PATH = path.join(ROOT, 'lib', 'core', 'research-planner', 'filing.cjs');
try {
  FILING = require(FILING_PATH);
} catch (e) {
  loadError = e;
}

const SECTION = 'market-analysis';
const RUN_ID = 'rp-2026-09-30-abcd1234';
const DATE = '2026-09-30';
const NOW = new Date('2026-09-30T12:00:00Z');
const U1 = 'https://openalex.org/W1001';
const U2 = 'https://openalex.org/W1002';
const U3 = 'https://openalex.org/W1003';
const U4 = 'https://openalex.org/W1004';

const rooms = [];
function newRoom() {
  const r = buildRoom363({ role: 'researcher' });
  rooms.push(r);
  return r;
}

function row(id, leaf, label, url, extra) {
  return Object.assign({
    row_id: id,
    leaf_id: leaf,
    record_id: url,
    claim: 'Code-written claim for ' + id + '.',
    quote: 'Verbatim quote for ' + id + '.',
    label: label,
    source_url: url,
    source_title: 'Source title for ' + url.slice(-5),
    retrieved_at: '2026-09-30T10:00:00.000Z',
    content_hash: crypto.createHash('sha256').update(url).digest('hex'),
    evidence_tier: 'Academic',
    source_type: 'peer_reviewed',
    flags: { retracted: false, is_in_doaj: null, venue: null },
  }, extra || {});
}

function leaf(id, question, status, extra) {
  return Object.assign({
    id: id,
    parent: 'K1',
    question: question,
    origin: 'user_stated',
    dimension: 'ws:gap_claim',
    corpus: 'openalex',
    researchable: true,
    status: status,
    falsifier: { text: 'A paper that answers the leaf directly.' },
    queries: [],
  }, extra || {});
}

function makeFixture(opts) {
  const o = opts || {};
  const rows = [
    row('E-A-1', 'L1', 'supports', U1),
    row('E-A-2', 'L1', 'supports', U2),
    row('E-B-1', 'L2', 'supports', U1),
    row('E-B-2', 'L2', 'contradicts', U3),
    row('E-C-1', 'L3', 'contradicts', U4),
    row('E-F-1', 'L2', 'funding_signal', U2, { funder: 'NSF', program: 'Water Innovation Grants' }),
  ];
  const leaves = [
    leaf('L1', 'Does an acoustic method remove biofilm from closed loops?', 'supported', { support_count: 2, contradict_count: 0 }),
    leaf('L2', 'Is the method cheaper than chemical dosing?', 'contested', { support_count: 1, contradict_count: 1 }),
    leaf('L3', 'Has the method been tested above one hundred liters?', 'contradicted', { support_count: 0, contradict_count: 1 }),
    leaf('L4', 'Who owns the relevant patents?', 'unresolved', { support_count: 0, contradict_count: 0 }),
    leaf('L5', 'What does the room already say about fouling?', 'not_run', { researchable: false, not_researchable_reason: 'room only', corpus: 'room', falsifier: undefined }),
  ];
  const plan = {
    schema: 'mos.research-plan/1',
    run_id: RUN_ID,
    mode: o.mode || 'deep',
    version: 1,
    max_revisions: 3,
    revision: 0,
    status: 'ready',
    parent_plan_hash: null,
    origin: { template_id: 'whitespace', command: '/mos:whitespace' },
    perspective: {
      engine: 'constraint-layer',
      depth: 'lite',
      version: 1,
      tension: { statement: 'Fouling raises cost.' },
      goal: { target: 'Remove biofilm without chemicals.' },
      limiters: [
        { id: 'LM1', statement: 'Interface resistance at the anode', column: 'assumed', s_curve: 'unknown' },
        { id: 'LM2', statement: 'Cavitation energy floor', column: 'physics', s_curve: 'near_ceiling' },
      ],
      paths: [],
      ranking: ['LM1', 'LM2'],
      ratchet: {
        version: 1,
        parent_plan_hash: null,
        discarded: [{ id: 'P2', kind: 'path', reason: 'out_of_scope', version: 1 }],
        settled: [],
      },
      next_binding_constraint: 'LM1',
    },
    pyramid: {
      governing_question: 'Can acoustic biofilm removal replace chemical dosing?',
      governing_status: 'split',
      key_line: [{ id: 'K1', label: 'Efficacy', leaf_ids: ['L1', 'L2', 'L3', 'L4'], status: 'contested' }],
      coverage: { uncovered: [] },
      dropped: [],
      mece: { warnings: [] },
    },
    leaves: leaves,
    budget: { breadth: 4, rounds: 2, queries_per_round: 2, results_per_query: 5, max_searches: 16, time_budget_ms: 1200000, counterevidence: true },
    stop_rules: ['cap'],
    grant_ref: { grant_id: 'g-1', lifetime: 'run' },
    return_target: { section: SECTION },
    plan_hash: 'planhash-fixture',
  };
  const run = {
    schema: 'mos.research-run/1',
    run_id: RUN_ID,
    mode: plan.mode,
    plan_hash: plan.plan_hash,
    grant_ref: plan.grant_ref,
    trigger: 'navigator',
    started_at: '2026-09-30T10:00:00.000Z',
    finished_at: '2026-09-30T10:20:00.000Z',
    stop_reason: 'cap',
    queries: [],
    records_path: '.mindrian/research-runs/' + RUN_ID + '/records.json',
    rows: rows,
    dropped: {},
    leaves: leaves,
    verdict: plan.mode === 'quick' ? 'thin' : null,
    answer_line: 'The run stopped on cap.',
    pyramid: plan.pyramid,
    perspective: plan.perspective,
    governing_status: 'split',
    unresolved_branches: ['Patent ownership'],
    opportunity_candidates: [
      { kind: 'constraint_attack', limiter_id: 'LM1', leaf_ids: ['L1'], row_ids: ['E-A-1'], reason: 'An assumed limiter that unlocks a downstream step.' },
      { kind: 'funding_signal', funder: 'NSF', program: 'Water Innovation Grants', leaf_ids: ['L2'], row_ids: ['E-F-1'], reason: 'A validated row names a funder and a program.' },
      { kind: 'funding_signal', funder: 'NSF', program: '', leaf_ids: ['L2'], row_ids: ['E-F-1'], reason: 'No program.' },
    ],
    contradictions: [{ leaf_id: 'L2', row_ids: ['E-B-1', 'E-B-2'] }],
    escalation_offer: null,
    local_checks: [],
    timings: { total_ms: 1200000 },
    filed: false,
    classifications: [
      { limiter_id: 'LM1', statement: 'Interface resistance at the anode', column: 'assumed', s_curve: 'unknown', basis_row_ids: ['E-A-1'], reason: 're_tested' },
      { limiter_id: 'LM2', statement: 'Cavitation energy floor', column: 'physics', s_curve: 'near_ceiling', basis_row_ids: ['E-A-2'], reason: 'derivation' },
    ],
    next_binding_constraint: 'LM1',
  };
  run.next_version = perspective.nextVersion(plan, {
    run_id: RUN_ID,
    classifications: run.classifications.map(function (c) { return { limiter_id: c.limiter_id, column: c.column, basis_row_ids: c.basis_row_ids }; }),
    discarded: [],
  });
  return { plan: plan, run: run };
}

// Snapshot of every file under the room: relative path -> sha256.
function snapshot(dir) {
  const out = {};
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) { walk(abs); return; }
      if (!e.isFile()) return;
      out[path.relative(dir, abs)] = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
    });
  })(dir);
  return out;
}

function sameSnapshot(a, b) {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.length !== kb.length) return false;
  return ka.every(function (k, i) { return k === kb[i] && a[k] === b[k]; });
}

function readJson(abs) { return JSON.parse(fs.readFileSync(abs, 'utf8')); }

function withDb(roomDir, fn) {
  const db = roomDbMod.openRoomDb(roomDir);
  try { return fn(db); } finally { roomDbMod.closeRoomDb(db); }
}

function neighbors(db, id) {
  return navigation.getNeighborhood(db, id, { maxDepth: 1, topK: 100 });
}

function leg(name, fn) {
  try {
    fn();
  } catch (e) {
    check(name, false, 'threw: ' + String((e && e.stack) || e).split('\n').slice(0, 3).join(' | '));
  }
}

check('module load', FILING !== null, loadError ? String(loadError.message).slice(0, 160) : '');
if (FILING === null) {
  for (let i = 1; i <= 13; i += 1) check('FI' + i + ' (filing.cjs not loaded)', false);
  check('net guard zero attempts', guard.attempts() === 0);
  rooms.forEach(function (r) { r.cleanup(); });
  process.exitCode = summary();
  return;
}

const ALL_DEFAULT = function (basket) {
  return basket.filter(function (i) { return i.default_on === true; }).map(function (i) { return i.id; });
};

// ---------------------------------------------------------------- FI11 (basket shape)
leg('FI11', function () {
  const fx = makeFixture();
  const basket = FILING.buildBasket(fx.run, fx.plan);
  const kinds = basket.map(function (i) { return i.kind; });
  const opp = basket.filter(function (i) { return i.kind === 'opportunity'; });
  const card = FILING.basketCard(basket);
  check('FI11 basket order and defaults',
    kinds[0] === 'run_home' && basket[0].default_on === true
      && kinds.indexOf('claim') > 0 && kinds.indexOf('contradiction') > 0
      && kinds.indexOf('settled_limiter') > 0 && kinds.indexOf('rollup') > 0 && kinds.indexOf('discarded_path') > 0
      && opp.length >= 1 && opp.every(function (i) { return i.default_on === false; }),
    JSON.stringify(kinds));
  const listsAll = basket.every(function (i) { return typeof card.body_md === 'string' && card.body_md.indexOf(i.label) !== -1; });
  check('FI11 card is F.8 with at most 3 options and lists every item',
    card && card.shape === 'F.8' && Array.isArray(card.options) && card.options.length <= 3 && card.options.length >= 2 && listsAll
      && /Recommended/.test(card.options[0].label) && card.options.some(function (o) { return /nothing/i.test(o.label); }),
    JSON.stringify(card && card.options));
  const claimLeaves = basket.filter(function (i) { return i.kind === 'claim'; }).map(function (i) { return i.leaf_id; }).sort();
  const conLeaves = basket.filter(function (i) { return i.kind === 'contradiction'; }).map(function (i) { return i.leaf_id; });
  check('FI11 claim items for supported and contradicted leaves, contradiction items for contested',
    JSON.stringify(claimLeaves) === '["L1","L3"]' && JSON.stringify(conLeaves) === '["L2"]',
    JSON.stringify({ claimLeaves: claimLeaves, conLeaves: conLeaves }));
});

// ---------------------------------------------------------------- FI1 (nothing before yes)
leg('FI1', function () {
  const room = newRoom();
  const fx = makeFixture();
  const basket = FILING.buildBasket(fx.run, fx.plan);
  const before = snapshot(room.roomDir);
  const r1 = FILING.fileRun(room.roomDir, fx.run, fx.plan, undefined, { now: NOW });
  const r2 = FILING.fileRun(room.roomDir, fx.run, fx.plan, { approved: false, items: ALL_DEFAULT(basket) }, { now: NOW });
  const r3 = FILING.fileRun(room.roomDir, fx.run, fx.plan, { grant_id: 'g-1', lifetime: 'standing', approved: true, items: ALL_DEFAULT(basket) }, { now: NOW });
  const r4 = FILING.fileRun(room.roomDir, fx.run, fx.plan, { grant_id: 'g-1', lifetime: 'run' }, { now: NOW });
  const r5 = FILING.fileRun(room.roomDir, fx.run, fx.plan, { approved: true, items: [] }, { now: NOW });
  const r6 = FILING.fileRun(room.roomDir, fx.run, fx.plan, { approved: true, items: ['not-in-basket'] }, { now: NOW });
  const after = snapshot(room.roomDir);
  check('FI1 refusals write nothing', sameSnapshot(before, after));
  check('FI1 every refusal is ok:false',
    [r1, r2, r3, r4, r5, r6].every(function (r) { return r && r.ok === false && typeof r.reason === 'string'; }),
    JSON.stringify([r1, r2, r3, r4, r5, r6].map(function (r) { return r && r.reason; })));
  const openQ = withDb(room.roomDir, function (db) { return navigation.findOpenQuestions(db); });
  check('FI1 no open questions minted', Array.isArray(openQ) && openQ.length === 0);
  check('FI1 no research/ and no opportunity-bank/ folder',
    !fs.existsSync(path.join(room.roomDir, 'research')) && !fs.existsSync(path.join(room.roomDir, 'opportunity-bank')));
});

// ---------------------------------------------------------------- main filing (FI2-FI10)
const main = { room: null, res: null, fx: null, basket: null, minto: null, mintoBefore: null, reasoningPath: null, violationsBefore: null, run_home_abs: null };
leg('FI2', function () {
  const room = newRoom();
  const fx = makeFixture();
  main.room = room;
  main.fx = fx;
  // Seed the originating section's REASONING.md and a MINTO.md through their own doors/files.
  const gen = reasoningOps.generateReasoning(room.roomDir, SECTION);
  main.reasoningPath = path.join(room.roomDir, '.reasoning', SECTION, 'REASONING.md');
  main.violationsBefore = minto.validate(main.reasoningPath).violations.map(function (v) { return v.category + '|' + v.message; }).sort();
  main.minto = path.join(room.roomDir, SECTION, 'MINTO.md');
  fs.writeFileSync(main.minto, '# Market Analysis\n\nGenerated file. Never hand-edited.\n', 'utf8');
  main.mintoBefore = fs.readFileSync(main.minto, 'utf8');
  // Two audit records for this run and one for another run.
  const mk = function (runId, qh) {
    return {
      ts: '2026-09-30T10:00:00.000Z', run_id: runId, grant_id: 'g-1', grant_version: 1, q: 'acoustic biofilm removal', q_hash: qh,
      template_id: 'ws.exact', family: 'whitespace-gap/v1', part8_verdict: 'pass', provider: 'openalex', filters: {},
      pagination: { per_page: 5, page: 1 }, fallback_used: false, origin_ref: null, result_ids: [], content_hashes: [],
      outcome: 'ok', failure_class: null, count: 3, cost_usd: 0, remaining_usd: 1, x_query: null, latency_ms: 10,
    };
  };
  auditLedger.appendAudit(room.roomDir, mk(RUN_ID, 'hash-mine-1'));
  auditLedger.appendAudit(room.roomDir, mk(RUN_ID, 'hash-mine-2'));
  auditLedger.appendAudit(room.roomDir, mk('rp-2026-09-30-99999999', 'hash-other'));

  const basket = FILING.buildBasket(fx.run, fx.plan);
  main.basket = basket;
  const selection = { approved: true, items: ALL_DEFAULT(basket).concat(basket.filter(function (i) { return i.kind === 'opportunity'; }).map(function (i) { return i.id; })) };
  const res = FILING.fileRun(room.roomDir, fx.run, fx.plan, selection, { now: NOW, approvedVia: 'f8-basket' });
  main.res = res;
  check('FI2 fileRun ok', res && res.ok === true && res.run_home && typeof res.run_home.rel === 'string',
    JSON.stringify(res && { ok: res.ok, reason: res.reason, report: res.report }).slice(0, 400));
  if (!res || res.ok !== true) return;
  const homeRel = res.run_home.rel;
  const homeAbs = path.join(room.roomDir, homeRel);
  main.run_home_abs = homeAbs;
  const slug = path.basename(homeRel);
  check('FI2 run home is top-level research/<date>-<slug>/', /^research\/\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,64}$/.test(homeRel) && homeRel.startsWith('research/' + DATE), homeRel);
  const files = ['ROOM.md', slug + '.md', 'plan.json', 'ledger.json', 'records.json', 'rows.json'];
  check('FI2 run home holds ROOM.md, report, plan, ledger, records, rows',
    files.every(function (f) { return fs.existsSync(path.join(homeAbs, f)); }), fs.existsSync(homeAbs) ? fs.readdirSync(homeAbs).join(',') : 'missing');
  const report = fs.readFileSync(path.join(homeAbs, slug + '.md'), 'utf8');
  check('FI2 report names governing question, every leaf status with row citations, stop reason and unresolved branches',
    report.indexOf('Can acoustic biofilm removal replace chemical dosing?') !== -1
      && ['L1', 'L2', 'L3', 'L4'].every(function (id) { return report.indexOf(id) !== -1; })
      && report.indexOf('[E-A-1]') !== -1 && report.indexOf('[E-B-2]') !== -1 && report.indexOf('[E-C-1]') !== -1
      && /supported/.test(report) && /contested/.test(report) && /contradicted/.test(report) && /unresolved/.test(report)
      && /cap/.test(report) && report.indexOf('Patent ownership') !== -1);
  const plan = readJson(path.join(homeAbs, 'plan.json'));
  check('FI2 plan.json carries the perspective ratchet with the settled limiter',
    plan.perspective && plan.perspective.ratchet && Array.isArray(plan.perspective.ratchet.settled)
      && plan.perspective.ratchet.settled.length >= 1 && plan.perspective.ratchet.discarded.some(function (d) { return d.id === 'P2'; }));
  const settledFromHome = perspective.loadSettled(room.roomDir);
  check('FI2 perspective.loadSettled reads the filed run home', settledFromHome.length >= 1 && settledFromHome.every(function (s) { return typeof s.limiter_key === 'string'; }));
  const ledger = readJson(path.join(homeAbs, 'ledger.json'));
  const audit = Array.isArray(ledger.audit) ? ledger.audit : [];
  check('FI2 ledger.json holds only this run audit slice and its q hashes',
    audit.length === 2 && audit.every(function (a) { return a.run_id === RUN_ID; })
      && Array.isArray(ledger.q_hashes) && ledger.q_hashes.indexOf('hash-mine-1') !== -1 && ledger.q_hashes.indexOf('hash-other') === -1);
  const records = readJson(path.join(homeAbs, 'records.json'));
  const rowsJson = readJson(path.join(homeAbs, 'rows.json'));
  check('FI2 records.json has ids, titles and content hashes; rows.json has the rows',
    Array.isArray(records.records) && records.records.length >= 4
      && records.records.every(function (r) { return typeof r.id === 'string' && typeof r.content_hash === 'string' && 'title' in r; })
      && Array.isArray(rowsJson.rows) && rowsJson.rows.length === fx.run.rows.length);
});

leg('FI3', function () {
  if (!main.res || main.res.ok !== true) { check('FI3 (skipped: filing failed)', false); return; }
  const room = main.room;
  const rep = main.res.report;
  const leafNodes = rep && rep.leaf_nodes ? rep.leaf_nodes : {};
  const evNodes = rep && rep.evidence_claims ? rep.evidence_claims : {};
  withDb(room.roomDir, function (db) {
    const open = navigation.findOpenQuestions(db).map(function (q) { return q.question.id; });
    check('FI3 one open-question node per researchable leaf (L5 has none)',
      ['L1', 'L2', 'L3', 'L4'].every(function (id) { return typeof leafNodes[id] === 'string'; }) && leafNodes.L5 === undefined,
      JSON.stringify(leafNodes));
    check('FI3 leaves with no SUPPORTS edge (L3, L4) read as open questions; supported leaves (L1, L2) do not',
      open.indexOf(leafNodes.L3) !== -1 && open.indexOf(leafNodes.L4) !== -1 && open.indexOf(leafNodes.L1) === -1 && open.indexOf(leafNodes.L2) === -1,
      JSON.stringify({ open: open, leafNodes: leafNodes }));
    const urls = Object.keys(evNodes).sort();
    check('FI3 one EvidenceClaim per unique URL, session research:<run_id>',
      JSON.stringify(urls) === JSON.stringify([U1, U2, U3, U4].sort())
        && urls.every(function (u) { return evNodes[u].indexOf('EvidenceClaim:research:' + RUN_ID + ':') === 0; }),
      JSON.stringify(evNodes));
    const shared = neighbors(db, evNodes[U1]);
    const sharedLeaves = shared.filter(function (n) { return n.id === leafNodes.L1 || n.id === leafNodes.L2; });
    check('FI3 the paper cited by two leaves is one claim with two edges', sharedLeaves.length === 2, JSON.stringify(shared.map(function (n) { return n.id; })));
    const allProposed = Object.keys(evNodes).every(function (u) {
      const self = neighbors(db, evNodes[u]);
      return self.every(function (n) { return n.reviewStatus !== 'confirmed'; });
    });
    check('FI3 nothing is confirmed', allProposed);
  });
});

leg('FI4', function () {
  if (!main.res || main.res.ok !== true) { check('FI4 (skipped: filing failed)', false); return; }
  const rep = main.res.report;
  const leafNodes = rep.leaf_nodes;
  const evNodes = rep.evidence_claims;
  withDb(main.room.roomDir, function (db) {
    const l1 = neighbors(db, leafNodes.L1);
    const l2 = neighbors(db, leafNodes.L2);
    const l3 = neighbors(db, leafNodes.L3);
    const edgeTo = function (list, id, type) { return list.some(function (n) { return n.id === id && n.edgeTypeIn === type; }); };
    check('FI4 SUPPORTS edges reach supported leaves', edgeTo(l1, evNodes[U1], 'SUPPORTS') && edgeTo(l1, evNodes[U2], 'SUPPORTS'), JSON.stringify(l1.map(function (n) { return [n.id, n.edgeTypeIn]; })));
    check('FI4 the contested leaf keeps both a SUPPORTS and a CONTRADICTS edge',
      edgeTo(l2, evNodes[U1], 'SUPPORTS') && edgeTo(l2, evNodes[U3], 'CONTRADICTS'), JSON.stringify(l2.map(function (n) { return [n.id, n.edgeTypeIn]; })));
    check('FI4 the contradicted leaf has a CONTRADICTS edge', edgeTo(l3, evNodes[U4], 'CONTRADICTS'));
    const cons = navigation.findContradictions(db, leafNodes.L2);
    check('FI4 findContradictions returns the contested leaf CONTRADICTS edge', Array.isArray(cons) && cons.length >= 1, JSON.stringify(cons).slice(0, 200));
  });
});

leg('FI5', function () {
  if (!main.res || main.res.ok !== true) { check('FI5 (skipped: filing failed)', false); return; }
  const rep = main.res.report;
  const lim = rep.limiter_nodes || {};
  withDb(main.room.roomDir, function (db) {
    check('FI5 one proposed claim node per classified limiter', typeof lim.LM1 === 'string' && typeof lim.LM2 === 'string', JSON.stringify(lim));
    const n1 = neighbors(db, lim.LM1);
    check('FI5 limiter claim is linked to its evidence claim and nothing is confirmed',
      n1.some(function (n) { return n.id === rep.evidence_claims[U1]; }) && n1.every(function (n) { return n.reviewStatus !== 'confirmed'; }),
      JSON.stringify(n1.map(function (n) { return [n.id, n.reviewStatus]; })));
  });
});

leg('FI6', function () {
  if (!main.res || main.res.ok !== true) { check('FI6 (skipped: filing failed)', false); return; }
  const rep = main.res.report;
  const plan = readJson(path.join(main.run_home_abs, 'plan.json'));
  check('FI6 discarded path is in plan.json ratchet', plan.perspective.ratchet.discarded.some(function (d) { return d.id === 'P2' && d.kind === 'path'; }));
  const disc = rep.discarded_nodes || {};
  if (typeof disc.P2 === 'string') {
    withDb(main.room.roomDir, function (db) {
      const n = neighbors(db, disc.P2);
      check('FI6 REJECTED_BECAUSE edge links the discarded path to the run home node',
        n.some(function (x) { return x.id === main.res.run_home.node_id; }), JSON.stringify(n.map(function (x) { return [x.id, x.edgeTypeIn]; })));
    });
  } else {
    check('FI6 when no edge, the report states where the reason lives', typeof rep.discarded_note === 'string' && /plan\.json/.test(rep.discarded_note), JSON.stringify(rep.discarded_note));
  }
});

leg('FI7', function () {
  if (!main.res || main.res.ok !== true) { check('FI7 (skipped: filing failed)', false); return; }
  const rep = main.res.report;
  const opps = rep.opportunities || [];
  const research = opps.filter(function (o) { return o.kind === 'constraint_attack'; })[0];
  check('FI7 approved candidate produced a node id and a card path', research && typeof research.node_id === 'string' && typeof research.card_path === 'string', JSON.stringify(opps));
  if (!research) return;
  const cardAbs = path.join(main.room.roomDir, research.card_path);
  const card = fs.existsSync(cardAbs) ? fs.readFileSync(cardAbs, 'utf8') : '';
  check('FI7 card sits in opportunity-bank/ and links back to the run home',
    research.card_path.split('/')[0] === 'opportunity-bank' && card.indexOf(main.res.run_home.rel) !== -1, research.card_path);
  withDb(main.room.roomDir, function (db) {
    const n = neighbors(db, research.node_id);
    check('FI7 opportunity node is DERIVED_FROM the run artifact node and SUPPORTS-linked to its evidence',
      n.some(function (x) { return x.id === main.res.run_home.node_id; }) && n.some(function (x) { return x.id === rep.evidence_claims[U1]; }),
      JSON.stringify(n.map(function (x) { return [x.id, x.edgeTypeIn]; })));
    check('FI7 opportunity node is proposed', n.every(function (x) { return x.reviewStatus !== 'confirmed'; }));
  });
  const ledger = readJson(path.join(main.run_home_abs, 'ledger.json'));
  const fwd = JSON.stringify(ledger.links || {});
  check('FI7 the run home links forward to the node and the card', fwd.indexOf(research.node_id) !== -1 && fwd.indexOf(research.card_path) !== -1, fwd.slice(0, 200));
});

leg('FI8', function () {
  if (!main.res || main.res.ok !== true) { check('FI8 (skipped: filing failed)', false); return; }
  const rep = main.res.report;
  const opps = rep.opportunities || [];
  const funding = opps.filter(function (o) { return o.kind === 'funding_signal'; });
  const listed = opportunityOps.listOpportunities(main.room.roomDir);
  const nsf = listed.opportunities.filter(function (o) { return o.funder === 'NSF' && o.program === 'Water Innovation Grants'; });
  check('FI8 funding signal with funder and program files through fileOpportunity', nsf.length === 1 && funding.length === 1 && funding[0].node_id === undefined, JSON.stringify({ funding: funding, n: nsf.length }));
  const basketFunding = main.basket.filter(function (i) { return i.kind === 'opportunity' && i.candidate_kind === 'funding_signal'; });
  check('FI8 a funding signal without a program is not offered', basketFunding.length === 1, String(basketFunding.length));
});

leg('FI9', function () {
  if (!main.res || main.res.ok !== true) { check('FI9 (skipped: filing failed)', false); return; }
  const rep = main.res.report;
  const fm = reasoningOps.getReasoningFrontmatter(main.room.roomDir, SECTION);
  const all = JSON.stringify(fm);
  check('FI9 REASONING.md frontmatter gained the roll-up naming supported and contradicted leaves',
    fm && fm.confidence && all.indexOf('L1') !== -1 && all.indexOf('L3') !== -1 && all.indexOf(RUN_ID) !== -1
      && fm.verification && Array.isArray(fm.verification.must_be_true) && fm.verification.must_be_true.some(function (s) { return /L1/.test(s); }),
    all.slice(0, 300));
  const after = minto.validate(main.reasoningPath).violations.map(function (v) { return v.category + '|' + v.message; }).sort();
  const fresh = after.filter(function (v) { return main.violationsBefore.indexOf(v) === -1; });
  check('FI9 feynman-minto validate shows no new violations', fresh.length === 0, JSON.stringify(fresh));
  check('FI9 MINTO.md bytes are unchanged', fs.readFileSync(main.minto, 'utf8') === main.mintoBefore);
  check('FI9 report says MINTO.md regenerates on the next generator run', rep.rollup && /MINTO\.md/.test(String(rep.rollup.note || '')), JSON.stringify(rep.rollup));
});

leg('FI10', function () {
  if (!main.res || main.res.ok !== true) { check('FI10 (skipped: filing failed)', false); return; }
  withDb(main.room.roomDir, function (db) {
    const n = neighbors(db, main.res.run_home.node_id);
    check('FI10 run home is linked to the originating section by an INFORMS or MAPS_TO_SECTION edge',
      n.some(function (x) { return x.id === 'section:' + SECTION && (x.edgeTypeIn === 'INFORMS' || x.edgeTypeIn === 'MAPS_TO_SECTION'); }) || (main.res.report.section_link && main.res.report.section_link.ok === true && ['INFORMS', 'MAPS_TO_SECTION'].indexOf(main.res.report.section_link.edge_type) !== -1),
      JSON.stringify(main.res.report.section_link));
  });
});

// ---------------------------------------------------------------- FI12 (quick unresolved)
leg('FI12', function () {
  const room = newRoom();
  const fx = makeFixture({ mode: 'quick' });
  fx.run.verdict = 'unresolved';
  fx.run.rows = [];
  fx.run.leaves = fx.run.leaves.map(function (l) { return Object.assign({}, l, { status: l.researchable ? 'unresolved' : 'not_run', support_count: 0, contradict_count: 0 }); });
  fx.run.contradictions = [];
  fx.run.classifications = [];
  fx.run.opportunity_candidates = [];
  fx.run.unresolved_branches = ['Efficacy'];
  fx.run.answer_line = 'The quick run could not settle the question.';
  const basket = FILING.buildBasket(fx.run, fx.plan);
  check('FI12 no claim or contradiction items when there are no rows',
    basket.every(function (i) { return i.kind !== 'claim' && i.kind !== 'contradiction'; }), JSON.stringify(basket.map(function (i) { return i.id; })));
  const res = FILING.fileRun(room.roomDir, fx.run, fx.plan, { approved: true, items: ALL_DEFAULT(basket) }, { now: NOW });
  check('FI12 filing an unresolved quick run works', res && res.ok === true, JSON.stringify(res && { reason: res.reason, report: res.report }).slice(0, 300));
  if (!res || res.ok !== true) return;
  const slug = path.basename(res.run_home.rel);
  const report = fs.readFileSync(path.join(room.roomDir, res.run_home.rel, slug + '.md'), 'utf8');
  check('FI12 the report says unresolved', /unresolved/i.test(report));
  check('FI12 no evidence claims filed', Object.keys(res.report.evidence_claims || {}).length === 0);
});

// ---------------------------------------------------------------- FI13 (static scan)
leg('FI13', function () {
  const src = fs.readFileSync(FILING_PATH, 'utf8');
  check('FI13 no raw SQL write keywords in filing.cjs', !/\b(INSERT INTO|UPDATE [a-z_]+ SET|DELETE FROM)\b/i.test(src));
  check('FI13 no network or Brain require in filing.cjs',
    !/require\(\s*['"](node:)?(http|https|net|tls|dgram|child_process)['"]\s*\)/.test(src)
      && !/brain-client|mindrian-brain|\bfetch\s*\(/.test(src));
  check('FI13 no sqlite driver require in filing.cjs', !/node:sqlite|better-sqlite3/.test(src));
  check('FI13 no em-dash or en-dash character in filing.cjs or this test',
    src.indexOf(EM) === -1 && src.indexOf(EN) === -1
      && fs.readFileSync(__filename, 'utf8').split(EM).length === 1 && fs.readFileSync(__filename, 'utf8').split(EN).length === 1);
});

check('net guard zero attempts', guard.attempts() === 0, String(guard.attempts()));
rooms.forEach(function (r) { r.cleanup(); });
try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_e) { /* ok */ }
process.exitCode = summary();
