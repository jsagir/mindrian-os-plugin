#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 15 Task 2 (EPV366-09, D-09): the Theo lateral-path lane, governed.
 *
 *   Y1  corpus theo is accepted at every corpus site; an unknown corpus is still refused
 *   Y2  a connections question set builds to a ready quick plan (not local_only)
 *   Y3  buildRunGrant adds provider theo and the pair hashes; an openalex-only plan is
 *       byte-equal to the golden captured before the edit; writeGrant accepts it
 *   Y3b the F.0 card for a theo grant names Theo, canon names only, the pair count; an
 *       openalex-only card is byte-equal to the golden
 *   Y4  runQuick with a run grant calls find_connections once per theo leaf with canon names
 *       only, zero OpenAlex fetches, writes theo-lane.json; coverFor says covered
 *   Y5  one 23-key audit row per call with provider theo
 *   Y6  no grant, an expired grant, a standing grant only: zero calls, the first failing reason
 *   Y7  a slot outside the canon snapshot is skipped and counted, never sent
 *   Y8  a verified stamp settles its leaf, yields one cross_domain_transfer candidate, and the
 *       filer reads the lane stamp for that pair
 *   Y9  a mixed plan runs OpenAlex first, then the lane
 *   Y10 the SEED-104 shape holds: openalex-only plans and the standing scope are unchanged
 *
 * Isolation: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at temp dirs and the session
 * env is cleared BEFORE any repo module loads. callTool and fetch are injected. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-theo-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-theo-roomshome-'));
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
const C = hygiene.makeChecker('test-366-theo-lateral-lane');

const { buildPerspectiveRoom } = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const RP = path.join(REPO_ROOT, 'lib/core/research-planner');
const Q = require(path.join(RP, 'question-templates.cjs'));
const planMod = require(path.join(RP, 'plan.cjs'));
const planner = require(path.join(RP, 'planner.cjs'));
const grants = require(path.join(RP, 'grants.cjs'));
const quick = require(path.join(RP, 'quick.cjs'));
const families = require(path.join(RP, 'families.cjs'));
const auditLedger = require(path.join(RP, 'audit-ledger.cjs'));
const filingStamped = require(path.join(RP, 'filing-stamped.cjs'));
const cn = require(path.join(RP, 'perspectives/connections-recall.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib/core/navigation.cjs'));
const verificationStamp = require(path.join(REPO_ROOT, 'lib/core/verification-stamp.cjs'));
let theoLane = null;
let theoLoadError = null;
try { theoLane = require(path.join(RP, 'theo-lane.cjs')); } catch (e) { theoLoadError = e; }

const GOLDEN = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests/fixtures/366-theo-lane/golden.json'), 'utf8'));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-theo-'));
const VIA = { surface: 'cli', decision_node_id: 'decision:366-15-test' };
const RS = 'Reverse Salient Analysis';
const LENSES = 'Four Lenses of Innovation';
const SYS = 'Systems Thinking';
let seq = 0;

function leg(name, fn) {
  return Promise.resolve().then(fn).then(function (ok) {
    C.check(name, ok === true, ok === true ? '' : String(ok));
  }, function (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 500));
  });
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function samePair(p, a, b) { return !!p && ((p.a === a && p.b === b) || (p.a === b && p.b === a)); }
function hasCanonPair(args, x, y) { return (args.from === x && args.to === y) || (args.from === y && args.to === x); }

// one planted room, one connections recall, one built quick plan
function mk(extra) {
  seq += 1;
  const built = buildPerspectiveRoom(path.join(root, 'r' + seq));
  const rec = cn.runRecall(built.roomDir, { tag: '20261002T12000' + seq + 'Z' });
  let qs = rec.question_set;
  if (typeof extra === 'function') qs = extra(clone(qs));
  const bp = planner.buildPlan(built.roomDir, qs, { mode: 'quick' });
  return { built: built, roomDir: built.roomDir, rec: rec, qs: qs, bp: bp, plan: bp && bp.ok ? bp.plan : null };
}
function approveRun(roomDir, plan, now) {
  const p = grants.buildRunGrant(plan);
  p.room_id = grants.roomIdFor(roomDir);
  return grants.writeGrant(roomDir, p, { approved_via: VIA, now: now });
}
// a scripted Theo: verified path for RS-LENSES, no path for SYS-RS, unavailable for SYS-LENSES
function makeTool() {
  const calls = [];
  async function callTool(name, args) {
    calls.push({ name: name, args: clone(args) });
    if (name !== 'find_connections') return { error: 'unknown tool' };
    if (hasCanonPair(args, RS, LENSES)) {
      return { paths: [{ path: [args.from, 'Hub', args.to], pathLabels: ['Framework', 'Framework', 'Framework'], edges: ['EXTENDS', 'SUPPORTS'], hops: 2 }] };
    }
    if (hasCanonPair(args, SYS, RS)) return { paths: [] };
    return { error: 'rate_limited' };
  }
  return { callTool: callTool, calls: calls };
}
function makeFetch() {
  const box = { n: 0 };
  box.fn = function () { box.n += 1; return Promise.reject(new Error('openalex stub failure')); };
  return box;
}

(async function main() {
  // ----- Y1 corpus sites -----
  const base = mk();
  await leg('Y1a validateQuestionSet accepts corpus theo, still refuses an unknown corpus', function () {
    const ok = Q.validateQuestionSet(base.qs);
    const bad = clone(base.qs);
    bad.leaves[0].corpus = 'bogus';
    const no = Q.validateQuestionSet(bad);
    return (ok.ok === true && no.ok === false && no.errors.some(function (e) { return /^leaf_corpus_invalid/.test(e); })) || JSON.stringify({ ok: ok, no: no.errors });
  });
  await leg('Y1b plan validator, add_leaf and toggle_source keep theo; unknown corpus refused', function () {
    if (!base.plan) return 'no plan: ' + JSON.stringify(base.bp);
    if (!planMod.validatePlan(base.plan).ok) return 'validatePlan: ' + JSON.stringify(planMod.validatePlan(base.plan).errors);
    const rc = function () { return { ok: true, queries: [] }; };
    const add = planMod.applyEdit(base.plan, { op: 'add_leaf', leaf: { id: 'cn-x', question: 'Is there a path?', corpus: 'theo', researchable: true, falsifier: { text: 'no path' } } }, { recompose: rc });
    const kept = add.ok && add.plan.leaves.filter(function (l) { return l.id === 'cn-x'; })[0].corpus === 'theo';
    const lat = base.plan.leaves.filter(function (l) { return l.corpus === 'theo'; })[0];
    const tog = planMod.applyEdit(base.plan, { op: 'toggle_source', leaf_id: lat.id, corpus: 'bogus' }, { recompose: rc });
    return (kept && tog.ok === false && tog.reason === 'corpus_invalid') || JSON.stringify({ add: add.reason, tog: tog.reason });
  });

  // ----- Y2 plan is ready -----
  await leg('Y2 a connections plan is ready, quick, with theo lateral leaves', function () {
    const p = base.plan;
    if (!p) return 'no plan: ' + JSON.stringify(base.bp && base.bp.errors);
    const theo = p.leaves.filter(function (l) { return l.corpus === 'theo'; });
    return (p.status === 'ready' && p.mode === 'quick' && theo.length >= 2 && theo.every(function (l) { return l.dimension === 'cn:lateral_path' && l.queries.length === 0; })) || JSON.stringify({ status: p.status, mode: p.mode, theo: theo.length });
  });

  // ----- Y3 grant coverage and the pinned openalex-only output -----
  await leg('Y3a buildRunGrant adds provider theo and the pair hashes; openalex-only output matches the golden', function () {
    const g = grants.buildRunGrant(base.plan);
    const theo = base.plan.leaves.filter(function (l) { return l.corpus === 'theo' && l.researchable; });
    const wantHashes = theo.map(function (l) { return families.qHash(l.slots.term + '|' + l.slots.term2); });
    const hashesOk = wantHashes.every(function (h) { return g.approved_hashes.indexOf(h) !== -1; });
    const goldenNow = JSON.stringify(grants.buildRunGrant(GOLDEN.plan)) === JSON.stringify(GOLDEN.buildRunGrant);
    return (g.providers.indexOf('theo') !== -1 && hashesOk && goldenNow) || JSON.stringify({ providers: g.providers, hashesOk: hashesOk, goldenNow: goldenNow });
  });
  await leg('Y3a2 standing scope stays openalex-only', function () {
    return (JSON.stringify(grants.STANDING_SCOPE.providers) === JSON.stringify(['openalex'])) || 'standing scope widened';
  });
  await leg('Y3a3 writeGrant accepts the theo run grant with an empty families list; refuses other empty-family grants', function () {
    const m = mk();
    const w = approveRun(m.roomDir, m.plan);
    const noHashes = grants.buildRunGrant(m.plan);
    noHashes.room_id = grants.roomIdFor(m.roomDir);
    noHashes.approved_hashes = [];
    const w2 = grants.writeGrant(m.roomDir, noHashes, { approved_via: VIA });
    const noTheo = grants.buildRunGrant(m.plan);
    noTheo.providers = ['openalex'];
    const w3 = grants.writeGrant(m.roomDir, noTheo, { approved_via: VIA });
    const standing = grants.buildStandingProposal(m.roomDir, { terms: [] });
    standing.families = [];
    const w4 = grants.writeGrant(m.roomDir, standing, { approved_via: VIA });
    return (w.ok === true && w.grant.families.length === 0 && w2.ok === false && w3.ok === false && w4.ok === false) || JSON.stringify({ w: w.ok, w2: w2, w3: w3, w4: w4 });
  });
  await leg('Y3b the theo card names Theo, canon names only, the pair count; openalex cards equal the golden', function () {
    const m = mk();
    const prop = grants.buildRunGrant(m.plan);
    prop.room_id = grants.roomIdFor(m.roomDir);
    const pairs = m.plan.leaves.filter(function (l) { return l.corpus === 'theo' && l.researchable; }).map(function (l) { return l.slots.term + '|' + l.slots.term2; });
    const card = grants.grantCard(prop, { theoPairs: pairs, now: Date.UTC(2026, 9, 2, 12, 0, 0) });
    const body = card.body_md;
    const head = body.split('\n')[0];
    const theoOk = /Theo/.test(head) && !/OpenAlex/.test(head) && /Theo/.test(body) && /canon framework names/.test(body) && /never room text/.test(body) &&
      new RegExp('Canon pairs checked with Theo: ' + pairs.length + '\\b').test(body) && !/nothing else leaves the room/.test(body) && !/Search shapes allowed/.test(body) && !/[\u2014\u2013]/.test(body);
    const onlyRun = card.options.map(function (o) { return o.id; }).join(',') === 'approve_run,not_now';
    const sCard = grants.grantCard(GOLDEN.standingProposal, { newTerms: ['alpha'], now: Date.UTC(2026, 9, 2, 12, 0, 0) });
    const rCard = grants.grantCard(GOLDEN.runProposal, { newTerms: [], now: Date.UTC(2026, 9, 2, 12, 0, 0) });
    const pick = function (c) { return JSON.stringify({ shape: c.shape, title: c.title, question: c.question, options: c.options, body_md: c.body_md, payload: c.payload }); };
    const same = pick(sCard) === JSON.stringify(GOLDEN.standingCard) && pick(rCard) === JSON.stringify(GOLDEN.runCard);
    return (theoOk && onlyRun && same) || JSON.stringify({ theoOk: theoOk, onlyRun: onlyRun, same: same, head: head });
  });
  await leg('Y3b2 a mixed plan card names both providers', function () {
    const m = mk(function (qs) {
      qs.leaves.push({ id: 'cn-oa', question: 'Is this written up anywhere?', origin: 'framework_dimension', dimension: 'cn:lateral_path', lens: 'cn.lateral', researchable: true, falsifier: { text: 'no paper' }, corpus: 'openalex', slots: { term: 'adaptive routing', term2: 'swarm coordination' } });
      return qs;
    });
    if (!m.plan) return 'no plan ' + JSON.stringify(m.bp);
    const prop = grants.buildRunGrant(m.plan);
    prop.room_id = grants.roomIdFor(m.roomDir);
    const card = grants.grantCard(prop, { theoPairs: ['a|b', 'c|d'], now: Date.UTC(2026, 9, 2, 12, 0, 0) });
    const head = card.body_md.split('\n')[0];
    return (/OpenAlex/.test(head) && /Theo/.test(head) && /What is searched: OpenAlex/.test(card.body_md) && /plus the Theo check below/.test(card.body_md) &&
      /Canon pairs checked with Theo: 2/.test(card.body_md) && /Search shapes allowed/.test(card.body_md)) || card.body_md;
  });

  // ----- Y4 / Y5 the lane end to end -----
  const run4 = mk();
  const tool4 = makeTool();
  const fetch4 = makeFetch();
  let res4 = null;
  await leg('Y4a no grant yet: coverFor asks, the lane makes zero calls', async function () {
    const cover = quick.coverFor(run4.roomDir, run4.plan, {});
    const r = await quick.runQuick(run4.roomDir, run4.plan, { callTool: tool4.callTool, fetchEnvelopeFn: fetch4.fn });
    return (cover.covered === false && cover.reason === 'no_grant' && !!cover.card && r.status === 'reask' && r.reason === 'no_grant' && tool4.calls.length === 0 && fetch4.n === 0) || JSON.stringify({ cover: cover.reason, r: r.status + ':' + r.reason, calls: tool4.calls.length });
  });
  await leg('Y4b the reask card for a theo plan is the run-grant card that names Theo', async function () {
    const cover = quick.coverFor(run4.roomDir, run4.plan, {});
    return (cover.proposal && cover.proposal.lifetime === 'run' && cover.proposal.providers.indexOf('theo') !== -1 && /Theo/.test(cover.card.body_md.split('\n')[0]) && /canon framework names/.test(cover.card.body_md)) || JSON.stringify(cover.proposal && cover.proposal.providers);
  });
  await leg('Y4c a run grant lets runQuick call find_connections once per theo leaf, canon names only, no OpenAlex fetch', async function () {
    const w = approveRun(run4.roomDir, run4.plan);
    if (!w.ok) return 'grant: ' + JSON.stringify(w);
    const cover = quick.coverFor(run4.roomDir, run4.plan, {});
    res4 = await quick.runQuick(run4.roomDir, run4.plan, { callTool: tool4.callTool, fetchEnvelopeFn: fetch4.fn });
    const theo = run4.plan.leaves.filter(function (l) { return l.corpus === 'theo' && l.researchable; });
    const canon = verificationStamp.loadFrameworkNames();
    const argsOk = tool4.calls.every(function (c) { return c.name === 'find_connections' && Object.keys(c.args).sort().join(',') === 'from,to' && canon.has(c.args.from) && canon.has(c.args.to); });
    const lane = path.join(run4.roomDir, '.mindrian', 'research-runs', run4.plan.run_id, 'theo-lane.json');
    let doc = null;
    try { doc = JSON.parse(fs.readFileSync(lane, 'utf8')); } catch (_e) { doc = null; }
    const keys = theo.map(function (l) { return filingStamped.pairKey(l.pair.a, l.pair.b); });
    const stamped = !!doc && doc.schema === 'mos.theo-lane/1' && keys.every(function (k) { return doc.stamps && Object.prototype.hasOwnProperty.call(doc.stamps, k); });
    return (cover.covered === true && res4.status === 'done' && tool4.calls.length === theo.length && argsOk && fetch4.n === 0 && stamped) ||
      JSON.stringify({ cover: cover.covered, status: res4.status, reason: res4.reason, calls: tool4.calls.length, theo: theo.length, argsOk: argsOk, fetch: fetch4.n, stamped: stamped });
  });
  await leg('Y5 each call wrote one 23-key audit row with provider theo', function () {
    const rows = auditLedger.readAudit(run4.roomDir, { run_id: run4.plan.run_id });
    const theo = rows.filter(function (r) { return r.provider === 'theo'; });
    const keysOk = theo.every(function (r) { return Object.keys(r).length === auditLedger.AUDIT_KEYS.length && auditLedger.AUDIT_KEYS.every(function (k) { return Object.prototype.hasOwnProperty.call(r, k); }); });
    const shape = theo.every(function (r) { return r.template_id === 'connections' && /^[^|]+\|[^|]+$/.test(r.q) && r.q_hash === families.qHash(r.q) && ['ok', 'empty_valid', 'failed'].indexOf(r.outcome) !== -1 && r.part8_verdict === 'pass'; });
    const outcomes = theo.map(function (r) { return r.outcome; }).sort().join(',');
    return (theo.length === tool4.calls.length && rows.length === theo.length && keysOk && shape && outcomes === 'empty_valid,failed,ok') || JSON.stringify({ n: theo.length, calls: tool4.calls.length, keysOk: keysOk, shape: shape, outcomes: outcomes });
  });

  // ----- Y6 no consent, no calls -----
  await leg('Y6a an expired run grant: zero calls, grant_expired', async function () {
    const m = mk();
    const tool = makeTool();
    const w = approveRun(m.roomDir, m.plan, Date.now() - 3 * 60 * 60 * 1000);
    if (!w.ok) return 'grant ' + JSON.stringify(w);
    const r = await quick.runQuick(m.roomDir, m.plan, { callTool: tool.callTool, fetchEnvelopeFn: makeFetch().fn, grant: w.grant });
    return (r.status === 'reask' && r.reason === 'grant_expired' && tool.calls.length === 0) || JSON.stringify({ s: r.status, reason: r.reason, calls: tool.calls.length });
  });
  await leg('Y6b a standing grant only never covers Theo: provider_not_in_policy, zero calls', async function () {
    const m = mk();
    const tool = makeTool();
    const sp = grants.buildStandingProposal(m.roomDir, { terms: [{ term: 'alpha', synonyms: [] }] });
    const w = grants.writeGrant(m.roomDir, sp, { approved_via: VIA });
    if (!w.ok) return 'grant ' + JSON.stringify(w);
    const cover = quick.coverFor(m.roomDir, m.plan, {});
    const r = await quick.runQuick(m.roomDir, m.plan, { callTool: tool.callTool, fetchEnvelopeFn: makeFetch().fn });
    return (cover.covered === false && cover.reason === 'provider_not_in_policy' && r.status === 'reask' && r.reason === 'provider_not_in_policy' && tool.calls.length === 0 &&
      cover.proposal && cover.proposal.lifetime === 'run') || JSON.stringify({ cover: cover.reason, r: r.reason, calls: tool.calls.length });
  });
  await leg('Y6c validateTheoCall order and cap', function () {
    const m = mk();
    const w = approveRun(m.roomDir, m.plan);
    const g = w.grant;
    const hash = g.approved_hashes[0];
    const st = { room_id: grants.roomIdFor(m.roomDir), now: Date.now(), calls_used: 0 };
    const ok = grants.validateTheoCall({ pair_hash: hash, slot_terms: [RS, LENSES] }, g, st);
    const none = grants.validateTheoCall({ pair_hash: hash }, null, st);
    const room = grants.validateTheoCall({ pair_hash: hash }, g, Object.assign({}, st, { room_id: 'other:000000000000' }));
    const rev = grants.validateTheoCall({ pair_hash: hash }, Object.assign({}, g, { revoked_at: new Date().toISOString() }), st);
    const exp = grants.validateTheoCall({ pair_hash: hash }, g, Object.assign({}, st, { now: Date.parse(g.expires_at) + 1 }));
    const ver = grants.validateTheoCall({ pair_hash: hash }, Object.assign({}, g, { policy_version: 'old' }), st);
    const prov = grants.validateTheoCall({ pair_hash: hash }, Object.assign({}, g, { providers: ['openalex'] }), st);
    const hsh = grants.validateTheoCall({ pair_hash: 'sha256:nope' }, g, st);
    const cap = grants.validateTheoCall({ pair_hash: hash }, g, Object.assign({}, st, { calls_used: 99 }));
    const got = [none.reason, room.reason, rev.reason, exp.reason, ver.reason, prov.reason, hsh.reason, cap.reason].join(',');
    const want = 'no_grant,room_mismatch,grant_revoked,grant_expired,grant_reversioned,provider_not_in_policy,hash_not_approved,cap_exceeded';
    return (ok.ok === true && got === want) || got;
  });

  // ----- Y7 canon guard -----
  await leg('Y7 a slot outside the canon snapshot is skipped and counted, never sent', async function () {
    const m = mk();
    const tool = makeTool();
    const lateral = m.plan.leaves.filter(function (l) { return l.corpus === 'theo' && l.researchable; });
    const plan2 = clone(m.plan);
    const victim = plan2.leaves.filter(function (l) { return l.id === lateral[0].id; })[0];
    victim.slots.term2 = 'A Room Specific Idea';
    const w = approveRun(m.roomDir, plan2);
    if (!w.ok) return 'grant ' + JSON.stringify(w);
    const out = await theoLane.runTheoLane(m.roomDir, { run_id: plan2.run_id, grant: w.grant, now: Date.now() }, plan2, { callTool: tool.callTool });
    const sent = tool.calls.some(function (c) { return c.args.from === 'A Room Specific Idea' || c.args.to === 'A Room Specific Idea'; });
    return (out.skipped === 1 && out.calls === lateral.length - 1 && !sent && tool.calls.length === lateral.length - 1) || JSON.stringify({ skipped: out.skipped, calls: out.calls, sent: sent });
  });

  // ----- Y8 verified stamp reaches verdict, opportunity and filer -----
  await leg('Y8 a verified lateral path settles its leaf, yields one candidate, and the filer reads the lane stamp', function () {
    if (!res4 || res4.status !== 'done') return 'Y4 did not finish';
    const settled = res4.run.leaves.filter(function (l) { return l.corpus === 'theo' && l.status === 'supported'; });
    const cands = res4.run.opportunity_candidates.filter(function (c) { return c.kind === 'cross_domain_transfer'; });
    const target = run4.plan.leaves.filter(function (l) { return l.corpus === 'theo' && l.researchable && ((l.slots.term === RS && l.slots.term2 === LENSES) || (l.slots.term === LENSES && l.slots.term2 === RS)); })[0];
    if (!target) return 'no RS-LENSES leaf';
    const mine = cands.filter(function (c) { return samePair(c.pair, target.pair.a, target.pair.b); });
    const db = navigation.openRoomDbReadOnlyForCaller(run4.roomDir);
    let stamp;
    try {
      stamp = filingStamped.stampForPair(target.pair, { db: db, roomDir: run4.roomDir, runHomes: [path.join('.mindrian', 'research-runs', run4.plan.run_id)] });
    } finally { try { db.close(); } catch (_e) { /* ro */ } }
    return (settled.length === 1 && cands.length === 1 && mine.length === 1 && stamp.verification === 'strong' && stamp.backend === 'theo' && !!stamp.path) ||
      JSON.stringify({ settled: settled.length, cands: cands.length, mine: mine.length, stamp: stamp });
  });
  await leg('Y8b the theo-only run answers about the lateral checks and offers no deep run', function () {
    if (!res4 || res4.status !== 'done') return 'Y4 did not finish';
    const r = res4.run;
    return (r.verdict === 'settled' && /lateral/i.test(r.answer_line) && r.escalation_offer === null && /Lateral-path checks with Theo/.test(res4.card.body_md) && !/[\u2014\u2013]/.test(res4.card.body_md)) ||
      JSON.stringify({ verdict: r.verdict, answer: r.answer_line, offer: r.escalation_offer });
  });

  // ----- Y9 mixed plan -----
  await leg('Y9 a mixed plan runs openalex first, then the lane', async function () {
    const m = mk(function (qs) {
      qs.leaves.push({ id: 'cn-oa', question: 'Is this written up anywhere?', origin: 'framework_dimension', dimension: 'cn:lateral_path', lens: 'cn.lateral', researchable: true, falsifier: { text: 'no paper' }, corpus: 'openalex', slots: { term: 'adaptive routing', term2: 'swarm coordination' } });
      return qs;
    });
    if (!m.plan) return 'no plan ' + JSON.stringify(m.bp);
    const tool = makeTool();
    const fetchBox = makeFetch();
    const w = approveRun(m.roomDir, m.plan);
    if (!w.ok) return 'grant ' + JSON.stringify(w);
    const r = await quick.runQuick(m.roomDir, m.plan, { callTool: tool.callTool, fetchEnvelopeFn: fetchBox.fn });
    const rows = auditLedger.readAudit(m.roomDir, { run_id: m.plan.run_id });
    const providers = rows.map(function (x) { return x.provider; });
    const firstTheo = providers.indexOf('theo');
    const lastOpenalex = providers.lastIndexOf('openalex');
    return (r.status === 'done' && fetchBox.n >= 1 && tool.calls.length >= 2 && providers.indexOf('openalex') !== -1 && firstTheo > lastOpenalex) ||
      JSON.stringify({ s: r.status, reason: r.reason, fetch: fetchBox.n, calls: tool.calls.length, providers: providers });
  });

  // ----- Y10 nothing else moved -----
  await leg('Y10 attachQueries still composes nothing for theo leaves and openalex leaves still compose', function () {
    const theo = base.plan.leaves.filter(function (l) { return l.corpus === 'theo'; });
    return theo.every(function (l) { return l.queries.length === 0; }) || 'theo leaf carries a query';
  });
  await leg('Y10b theo-lane exports and the lane module is on disk', function () {
    if (theoLoadError) return 'load: ' + String(theoLoadError.message).slice(0, 120);
    return (typeof theoLane.runTheoLane === 'function' && typeof theoLane.theoLeavesOf === 'function' && theoLane.theoLeavesOf(base.plan).length >= 2) || 'exports missing';
  });
  await leg('Y10c the lane has no second wire door: find_connections only through stampFinding', function () {
    const src = fs.readFileSync(path.join(RP, 'theo-lane.cjs'), 'utf8');
    return (/stampFinding\(\{ fromHandle: term/.test(src) && !/stampFinding\(\{ a:/.test(src) && !/brain-client/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''))) || 'lane source shape wrong';
  });

  C.check('zero network attempts', net.attempts() === 0, String(net.attempts()));
  net.restore();
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
  process.exit(C.summary());
})();
