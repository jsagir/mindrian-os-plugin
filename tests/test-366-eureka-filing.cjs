#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 02 (EPV366-12): the eureka filing wire, end to end and hermetic.
 *
 *   F1 OPPORTUNITY_KINDS gains cross_domain_transfer (appended last); normalizeLeaf
 *      carries a closed pair {a, b, perspective, run_tag} into the plan hash.
 *   F2 one generic pair branch: a supported eu:mechanism_transfer leaf with no
 *      already-known hit yields one cross_domain_transfer item carrying the pair;
 *      an already-known hit (same pair either order, or a pair-less run-level
 *      known leaf) yields none; a stub rule proves the branch is template-driven.
 *   F3 no double emission and no dedicated-branch condition for pair leaves:
 *      pair-carrying literature_gap and constraint_attack leaves emit once each;
 *      the same leaves without pair match the goldens captured before the edit.
 *
 * Isolation: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at temp dirs and
 * the session env is cleared BEFORE any repo module loads (the seed103 idiom).
 * Zero network: fetch is replaced by a counting thrower. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-filing-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-filing-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;
delete process.env.OPENALEX_API_KEY;
delete process.env.OPENALEX_EMAIL;

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-366-eureka-filing');

const { buildPerspectiveRoom } = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const Y = require(path.join(REPO_ROOT, 'lib/core/research-planner/pyramid.cjs'));
const Q = require(path.join(REPO_ROOT, 'lib/core/research-planner/question-templates.cjs'));
const planMod = require(path.join(REPO_ROOT, 'lib/core/research-planner/plan.cjs'));
const planner = require(path.join(REPO_ROOT, 'lib/core/research-planner/planner.cjs'));
const recall = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspectives/eureka-recall.cjs'));

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-filing-'));
const TAG = '20261001T120000Z';

function leg(name, fn) {
  try {
    const ok = fn();
    C.check(name, ok === true, ok === true ? '' : String(ok));
  } catch (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 400));
  }
}
function samePair(p, a, b) { return !!p && ((p.a === a && p.b === b) || (p.a === b && p.b === a)); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }

// ---------------------------------------------------------------------------
// the planted room and one eureka recall + plan, shared by the legs
// ---------------------------------------------------------------------------
const built = buildPerspectiveRoom(path.join(root, 'r1'));
const roomDir = built.roomDir;
const EU = built.planted.eureka;
const rec = recall.runRecall(roomDir, { tag: TAG });
const euLeafQs = rec.question_set.leaves.filter(function (l) { return l.pair && samePair(l.pair, EU[0], EU[1]); })[0];
const plan = planner.buildPlan(roomDir, rec.question_set, {});
const planLeaves = plan && plan.ok ? plan.plan.leaves : [];
const euLeaf = planLeaves.filter(function (l) { return l.pair && samePair(l.pair, EU[0], EU[1]); })[0];

// ---------------------------------------------------------------------------
// F1 kind and closed pair carry
// ---------------------------------------------------------------------------
leg('F1a OPPORTUNITY_KINDS appends cross_domain_transfer last, six kinds unchanged', function () {
  const want = ['literature_gap', 'constraint_attack', 'untried_intervention', 'mechanism_transfer', 'trend_break', 'funding_signal', 'cross_domain_transfer'];
  return JSON.stringify(Y.OPPORTUNITY_KINDS) === JSON.stringify(want) || JSON.stringify(Y.OPPORTUNITY_KINDS);
});

leg('F1b recall leaves carry the closed pair, never the old candidate field', function () {
  const eu = rec.question_set.leaves.filter(function (l) { return l.dimension === 'eu:mechanism_transfer'; });
  if (eu.length === 0) return 'no eureka leaves';
  const bad = eu.filter(function (l) {
    return l.candidate !== undefined || !l.pair || Object.keys(l.pair).sort().join(',') !== 'a,b,perspective,run_tag'
      || l.pair.perspective !== 'eureka' || l.pair.run_tag !== TAG;
  });
  return (bad.length === 0 && !!euLeafQs) || JSON.stringify(eu[0]).slice(0, 300);
});

leg('F1c normalizeLeaf copies the closed pair and drops extra keys and bad fields', function () {
  if (!plan.ok) return 'plan failed: ' + JSON.stringify(plan.errors);
  if (!euLeaf) return 'planted eureka leaf not in the plan';
  if (Object.keys(euLeaf.pair).sort().join(',') !== 'a,b,perspective,run_tag') return JSON.stringify(euLeaf.pair);
  const qs = clone(rec.question_set);
  qs.leaves[0].pair = Object.assign({}, qs.leaves[0].pair, { smuggled: 'x', lanes: ['lexical'] });
  qs.leaves[1].pair = { a: 'x', b: 7, perspective: 'eureka', run_tag: TAG };
  const bp = Y.buildPyramid(qs, {});
  if (!bp.ok) return 'buildPyramid failed';
  const l0 = bp.leaves[0].pair;
  const l1 = bp.leaves[1].pair;
  return (Object.keys(l0).sort().join(',') === 'a,b,perspective,run_tag' && l1 === undefined) || JSON.stringify([l0, l1]);
});

leg('F1d the pair rides the plan hash (pair.a change changes the hash)', function () {
  const qs1 = clone(rec.question_set);
  const qs2 = clone(rec.question_set);
  qs2.leaves[0].pair.a = qs2.leaves[0].pair.a + '-other';
  const b1 = Y.buildPyramid(qs1, {});
  const b2 = Y.buildPyramid(qs2, {});
  const h1 = planMod.planHash({ leaves: b1.leaves, pyramid: b1.pyramid });
  const h2 = planMod.planHash({ leaves: b2.leaves, pyramid: b2.pyramid });
  return h1 !== h2 || 'hash unchanged';
});

// ---------------------------------------------------------------------------
// F2 the generic pair branch
// ---------------------------------------------------------------------------
function rolledWith(verdicts, extraLeaves) {
  const leaves = clone(planLeaves).concat(extraLeaves || []);
  return Y.rollUp(plan.plan.pyramid, leaves, [], { verdictByLeaf: verdicts });
}

leg('F2a a supported eureka pair leaf with no known hit yields one cross_domain_transfer item', function () {
  if (!euLeaf) return 'no eureka leaf';
  const v = {}; v[euLeaf.id] = 'settled';
  const r = rolledWith(v);
  const c = Y.opportunityCandidates(r.pyramid, r.leaves, [], {});
  const x = c.filter(function (i) { return i.kind === 'cross_domain_transfer'; });
  return (x.length === 1 && x[0].leaf_ids.length === 1 && x[0].leaf_ids[0] === euLeaf.id && samePair(x[0].pair, EU[0], EU[1])
    && Array.isArray(x[0].row_ids) && typeof x[0].reason === 'string') || JSON.stringify(c).slice(0, 400);
});

leg('F2b an unsupported eureka leaf yields nothing', function () {
  const r = rolledWith({});
  const c = Y.opportunityCandidates(r.pyramid, r.leaves, [], {});
  return c.filter(function (i) { return i.kind === 'cross_domain_transfer'; }).length === 0 || JSON.stringify(c);
});

leg('F2c a pair-less run-level known hit (eu-known supported) suppresses the item', function () {
  const v = {}; v[euLeaf.id] = 'settled'; v['eu-known'] = 'settled';
  const r = rolledWith(v);
  const c = Y.opportunityCandidates(r.pyramid, r.leaves, [], {});
  return c.filter(function (i) { return i.kind === 'cross_domain_transfer'; }).length === 0 || JSON.stringify(c);
});

leg('F2d a known leaf on the same pair in reverse order suppresses; a known leaf on another pair does not', function () {
  const v = {}; v[euLeaf.id] = 'settled'; v['eu-known-x'] = 'settled';
  const known = { id: 'eu-known-x', question: 'Does the room already connect these?', origin: 'framework_dimension', dimension: 'eu:already_known', lens: 'eu.known', researchable: true, corpus: 'room', status: 'open', queries: [], falsifier: { text: 'x' } };
  const same = Object.assign({}, known, { pair: { a: euLeaf.pair.b, b: euLeaf.pair.a, perspective: 'eureka', run_tag: TAG } });
  const other = Object.assign({}, known, { pair: { a: 'zz/1', b: 'zz/2', perspective: 'eureka', run_tag: TAG } });
  const r1 = rolledWith(v, [same]);
  const r2 = rolledWith(v, [other]);
  const c1 = Y.opportunityCandidates(r1.pyramid, r1.leaves, [], {}).filter(function (i) { return i.kind === 'cross_domain_transfer'; });
  const c2 = Y.opportunityCandidates(r2.pyramid, r2.leaves, [], {}).filter(function (i) { return i.kind === 'cross_domain_transfer'; });
  return (c1.length === 0 && c2.length === 1) || JSON.stringify([c1.length, c2.length]);
});

function stubLeaf(id, dimension, status, pair) {
  const l = { id: id, question: 'Stub question ' + id + '?', origin: 'framework_dimension', dimension: dimension, lens: 'x.lens', researchable: true, corpus: 'openalex', status: status, queries: [], falsifier: { text: 'x' } };
  if (pair) l.pair = pair;
  return l;
}
const STUB_PAIR = { a: 'pd/X1', b: 'ma/X2', perspective: 'stub', run_tag: TAG };

leg('F2e a stub template rule {kind mechanism_transfer, dimension x:pair} drives the same branch', function () {
  const tpl = { id: 'stub', opportunity_rules: [{ kind: 'mechanism_transfer', dimension: 'x:pair' }], dimensions: [] };
  const py = { template_id: 'stub', lenses_selected: [] };
  const hit = Y.opportunityCandidates(py, [stubLeaf('x1', 'x:pair', 'supported', STUB_PAIR)], [], { template: tpl });
  const known = Y.opportunityCandidates(py, [stubLeaf('x1', 'x:pair', 'supported', STUB_PAIR), stubLeaf('xk', 'x:already_known', 'supported', { a: 'ma/X2', b: 'pd/X1', perspective: 'stub', run_tag: TAG })], [], { template: tpl });
  return (hit.length === 1 && hit[0].kind === 'mechanism_transfer' && samePair(hit[0].pair, 'pd/X1', 'ma/X2') && known.length === 0) || JSON.stringify([hit, known]);
});

// ---------------------------------------------------------------------------
// F3 one emission per pair leaf, goldens unchanged for pair-less leaves
// ---------------------------------------------------------------------------
// Goldens captured from the pre-366-02 pyramid.cjs (commit 459497f81).
const GOLDEN_GAP = [{ kind: 'literature_gap', leaf_ids: ['g1'], row_ids: [], reason: 'The gap claim held up against the search: nothing found that addresses the zone directly.' }];
const GOLDEN_CA = [];

leg('F3a a pair-carrying ws:gap_claim leaf yields exactly one literature_gap item carrying the pair', function () {
  const tpl = Q.TEMPLATES.whitespace;
  const py = { template_id: 'whitespace', lenses_selected: [] };
  const c = Y.opportunityCandidates(py, [stubLeaf('g1', 'ws:gap_claim', 'supported', STUB_PAIR)], [], { template: tpl, verdict: 'gap-confirmed' });
  const cNoVerdict = Y.opportunityCandidates(py, [stubLeaf('g1', 'ws:gap_claim', 'supported', STUB_PAIR)], [], { template: tpl });
  return (c.length === 1 && c[0].kind === 'literature_gap' && samePair(c[0].pair, 'pd/X1', 'ma/X2') && cNoVerdict.length === 1) || JSON.stringify([c, cNoVerdict]);
});

leg('F3b a pair-carrying constraint_attack leaf yields exactly one item with no perspective at all', function () {
  const tpl = { id: 'stub', opportunity_rules: [{ kind: 'constraint_attack', dimension: 'x:pair' }], dimensions: [] };
  const py = { template_id: 'stub', lenses_selected: [] };
  const c = Y.opportunityCandidates(py, [stubLeaf('x1', 'x:pair', 'supported', STUB_PAIR)], [], { template: tpl });
  return (c.length === 1 && c[0].kind === 'constraint_attack' && samePair(c[0].pair, 'pd/X1', 'ma/X2')) || JSON.stringify(c);
});

leg('F3c the same leaves without pair yield exactly the pre-edit goldens', function () {
  const gap = Y.opportunityCandidates({ template_id: 'whitespace', lenses_selected: [] }, [stubLeaf('g1', 'ws:gap_claim', 'supported')], [], { template: Q.TEMPLATES.whitespace, verdict: 'gap-confirmed' });
  const ca = Y.opportunityCandidates({ template_id: 'stub', lenses_selected: [] }, [stubLeaf('x1', 'x:pair', 'supported')], [], { template: { id: 'stub', opportunity_rules: [{ kind: 'constraint_attack', dimension: 'x:pair' }], dimensions: [] } });
  return (JSON.stringify(gap) === JSON.stringify(GOLDEN_GAP) && JSON.stringify(ca) === JSON.stringify(GOLDEN_CA)) || JSON.stringify([gap, ca]);
});

// ---------------------------------------------------------------------------
// F4-F9 one stamped filer in the planner; filing writes the pair edges and stamp
// ---------------------------------------------------------------------------
// A counting spy on the ONE wire door: verification-stamp requires brain-client
// lazily and reads .callTool at call time, so patching the export catches any
// Theo call made anywhere in this process.
let theoCalls = 0;
try {
  const brainClient = require(path.join(REPO_ROOT, 'lib/core/brain-client.cjs'));
  brainClient.callTool = async function spyCallTool() { theoCalls += 1; return null; };
} catch (_e) { /* no brain client: zero calls is still asserted below */ }

const navigation = require(path.join(REPO_ROOT, 'lib/core/navigation.cjs'));
const stamped = require(path.join(REPO_ROOT, 'lib/core/research-planner/filing-stamped.cjs'));
const CN = built.planted.connections;

function withReadDb(fn) {
  const db = navigation.openRoomDbReadOnlyForCaller(roomDir);
  try { return fn(db); } finally { try { db.close(); } catch (_e) { /* read-only */ } }
}
function nodeRow(db, id) {
  const r = db.prepare('SELECT id, type, review_status, properties FROM nodes WHERE id = ?').get(id);
  return r ? { id: r.id, type: r.type, review_status: r.review_status, props: JSON.parse(r.properties || '{}') } : null;
}

// Plan 366-22 retired the runner re-export identity half of F4 (the runner is
// deleted); ambient-run and filing.cjs resolve the filer from filing-stamped.cjs,
// and the export shape below stays pinned.
leg('F4 filing-stamped exports fileStampedOpportunity, readPwsStage and sourcedFromTarget', function () {
  return (typeof stamped.fileStampedOpportunity === 'function'
    && typeof stamped.readPwsStage === 'function' && typeof stamped.sourcedFromTarget === 'function') || 'export shape broken';
});

leg('F5 stampForPair with an unresolved endpoint stamps unverified / not_called / handle_unresolved, zero calls', function () {
  const before = theoCalls;
  const s = withReadDb(function (db) { return stamped.stampForPair({ a: EU[0], b: EU[1] }, { db: db, roomDir: roomDir, runHomes: [] }); });
  return (s.verification === 'unverified' && s.backend === 'not_called' && s.reason === 'handle_unresolved' && theoCalls === before) || JSON.stringify(s);
});

leg('F6 stampForPair returns a recorded theo-lane.json stamp unchanged; bad or outside files degrade', function () {
  const runHomeRel = path.join('.mindrian', 'research-runs', 'rp-2026-10-01-0000aaaa');
  const laneDir = path.join(roomDir, runHomeRel);
  fs.mkdirSync(laneDir, { recursive: true });
  const verified = { verification: 'strong', backend: 'theo', direction: 'none', judge: 'none', path: { nodes: [built.ids.canon.rs, built.ids.canon.lenses], labels: ['Framework', 'Framework'], edges: ['COMPLEMENTS'] } };
  const stamps = {}; stamps[stamped.pairKey(CN[0], CN[1])] = verified;
  fs.writeFileSync(path.join(laneDir, 'theo-lane.json'), JSON.stringify({ schema: 'mos.theo-lane/1', stamps: stamps }));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-outside-'));
  fs.writeFileSync(path.join(outside, 'theo-lane.json'), JSON.stringify({ schema: 'mos.theo-lane/1', stamps: stamps }));
  const badDir = path.join(roomDir, '.mindrian', 'research-runs', 'rp-2026-10-01-0000bbbb');
  fs.mkdirSync(badDir, { recursive: true });
  fs.writeFileSync(path.join(badDir, 'theo-lane.json'), '{ not json');
  const before = theoCalls;
  const got = withReadDb(function (db) {
    return {
      hit: stamped.stampForPair({ a: CN[1], b: CN[0] }, { db: db, roomDir: roomDir, runHomes: [runHomeRel] }),
      none: stamped.stampForPair({ a: CN[0], b: CN[1] }, { db: db, roomDir: roomDir, runHomes: [] }),
      out: stamped.stampForPair({ a: CN[0], b: CN[1] }, { db: db, roomDir: roomDir, runHomes: [outside] }),
      bad: stamped.stampForPair({ a: CN[0], b: CN[1] }, { db: db, roomDir: roomDir, runHomes: [path.relative(roomDir, badDir)] }),
    };
  });
  try { fs.rmSync(outside, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
  const degraded = function (s) { return s.verification === 'unverified' && s.backend === 'not_called' && s.reason === 'handle_unresolved'; };
  return (JSON.stringify(got.hit) === JSON.stringify(verified) && degraded(got.none) && degraded(got.out) && degraded(got.bad) && theoCalls === before)
    || JSON.stringify(got).slice(0, 500);
});

// Drive the planner path: recall -> plan (saved by buildPlan) -> a replayed
// supported verdict through the real rollUp and opportunityCandidates -> run.json
// -> basket -> file with an approved selection (the test-363-filing seams).
let filed = null;
let oppItemId = null;
const runId = plan.ok ? plan.run_id : null;
function writeRun() {
  const v = {}; v[euLeaf.id] = 'settled';
  const rolled = Y.rollUp(plan.plan.pyramid, plan.plan.leaves, [], { verdictByLeaf: v });
  const opps = Y.opportunityCandidates(rolled.pyramid, rolled.leaves, [], {});
  const run = {
    schema: planMod.RUN_SCHEMA, run_id: runId, mode: 'quick', plan_hash: plan.plan_hash, trigger: 'navigator',
    started_at: '2026-10-01T12:00:00.000Z', finished_at: '2026-10-01T12:00:01.000Z', stop_reason: 'complete',
    queries: [], rows: [], dropped: {}, leaves: rolled.leaves, verdict: 'settled', answer_line: 'Replayed supported verdict.',
    pyramid: rolled.pyramid, perspective: plan.plan.perspective, governing_status: rolled.governing_status,
    unresolved_branches: rolled.unresolved_branches, opportunity_candidates: opps, contradictions: rolled.contradictions,
    escalation_offer: null, local_checks: [], filed: false,
  };
  const dir = path.join(roomDir, '.mindrian', 'research-runs', runId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify(run, null, 2));
  return run;
}

leg('F7 approving the cross_domain_transfer item files one proposed candidate opportunity carrying the stamp', function () {
  if (!plan.ok || !euLeaf) return 'no plan';
  writeRun();
  const basket = planner.basketFor(roomDir, runId);
  if (!basket.ok) return 'basket: ' + JSON.stringify(basket);
  const item = basket.items.filter(function (i) { return i.kind === 'opportunity' && i.candidate_kind === 'cross_domain_transfer'; });
  if (item.length !== 1) return 'basket items: ' + JSON.stringify(basket.items.map(function (i) { return i.id + ':' + (i.candidate_kind || ''); }));
  if (item[0].default_on !== false) return 'opportunity item must default off';
  oppItemId = item[0].id;
  filed = planner.fileFromState(roomDir, runId, { approved: true, items: [oppItemId] }, { approvedVia: 'cli' });
  if (!filed || filed.ok !== true) return 'file: ' + JSON.stringify(filed).slice(0, 400);
  const opps = filed.report.opportunities.filter(function (o) { return o.kind === 'cross_domain_transfer'; });
  if (opps.length !== 1) return 'report: ' + JSON.stringify(filed.report).slice(0, 400);
  const n = withReadDb(function (db) { return nodeRow(db, opps[0].node_id); });
  if (!n) return 'node missing';
  const p = n.props;
  return (n.type === 'opportunity' && n.review_status === 'proposed' && p.lifecycle === 'candidate' && p.candidate_kind === 'cross_domain_transfer'
    && p.verification === 'unverified' && p.backend === 'not_called' && p.reason === 'handle_unresolved' && p.judge === 'none'
    && p.path_len === 0 && Array.isArray(p.path) && p.engine_mode === 'navigator' && p.direction === 'none')
    || JSON.stringify(n).slice(0, 600);
});

leg('F8 the filed node has DERIVED_FROM edges to pair.a, pair.b and the run home; Theo asked zero times; the pair leaves recall', function () {
  if (!filed || !filed.ok) return 'not filed';
  const nodeId = filed.report.opportunities[0].node_id;
  const targets = withReadDb(function (db) {
    return db.prepare("SELECT target FROM edges WHERE source = ? AND type = 'DERIVED_FROM'").all(nodeId).map(function (r) { return r.target; });
  });
  const okEdges = targets.indexOf(EU[0]) !== -1 && targets.indexOf(EU[1]) !== -1 && targets.indexOf(filed.run_home.node_id) !== -1;
  const again = recall.runRecall(roomDir, { tag: '20261001T130000Z' });
  const stillThere = again.candidates.some(function (c) { return samePair({ a: c.a, b: c.b }, EU[0], EU[1]); });
  return (okEdges && theoCalls === 0 && !stillThere) || JSON.stringify({ targets: targets, theoCalls: theoCalls, stillThere: stillThere });
});

leg('F9 filing the same approved basket twice writes one opportunity node (single-use approval)', function () {
  if (!filed || !filed.ok) return 'not filed';
  const second = planner.fileFromState(roomDir, runId, { approved: true, items: [oppItemId] }, { approvedVia: 'cli' });
  const basket2 = planner.basketFor(roomDir, runId);
  const count = withReadDb(function (db) {
    return db.prepare("SELECT properties FROM nodes WHERE type = 'opportunity'").all().filter(function (r) {
      const p = JSON.parse(r.properties || '{}');
      return p.candidate_kind === 'cross_domain_transfer' && p.run_id === runId;
    }).length;
  });
  return (second.ok === false && second.reason === 'already_filed' && basket2.ok === false && count === 1) || JSON.stringify({ second: second, count: count });
});

// ---------------------------------------------------------------------------
// zero network
// ---------------------------------------------------------------------------
C.check('zero network attempts', net.attempts() === 0, String(net.attempts()));
C.check('zero Theo calls across the whole test', typeof theoCalls === 'number' && theoCalls === 0, String(theoCalls));
net.restore();
try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
process.exit(C.summary());
