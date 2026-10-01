#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 07 (EPV366-14, D-03): the ambient Eureka producer is the
 * perspective recall and only ever offers. No judge, no fetch, no filing in
 * the background.
 *
 *   O1 _eurekaAdapter on the fixture-366 room returns offer_only findings
 *      (producer eureka, no stamp key, at most AMBIENT_TOP_N) in the order
 *      recallCandidates gives, and outcome 'offered' with an id-only offer.
 *   O2 selectCardFinding never selects an offer_only finding; a composition
 *      run with the real eureka adapter files nothing, writes no
 *      last-eureka.json and never calls the guard.
 *   O3 compResult.producers.eureka carries outcome 'offered' and an offer of
 *      {a, b, section_a, section_b} only (no titles, no text); 'offered' is the
 *      last member of the closed guard list; the ambient ledger written after
 *      a child run validates with producers.eureka.outcome 'offered'.
 *   O4 a filed finding from another producer goes through
 *      research-planner/filing-stamped.cjs fileStampedOpportunity.
 *   O5 static: ambient-run.cjs no longer requires room-native-substrate,
 *      rs-differential-scorer or scripts/eureka-portfolio-report.cjs.
 *   O6 zero network and the injected callTool is never called for eureka.
 *   O7 maybeQuick with an eureka offer and no whitespace card records
 *      plan_card_eureka_offer: a run_id and a pending plan-only card.
 *   O8 with a standing grant that covers the plan's terms the branch still
 *      returns plan_card_eureka_offer and fetchEnvelopeFn is never called.
 *   O9 a whitespace card produced in the same pass wins: no eureka card.
 *   O10 an unsurfaced plan-only card already pending dedupes the offer
 *      (deduped true) and leaves no new run dir.
 *   O11 the offered plan validates (mos.research-plan/1) and its leaves carry
 *      the closed pair shape.
 *   O12 leaf questions name both titles (no "undefined"); the offer in
 *      compResult stays ids and slugs; an unresolved endpoint row is dropped
 *      and counted.
 *
 * Isolation: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at temp dirs and
 * the session env is cleared BEFORE any repo module loads. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-offer-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-offer-roomshome-'));
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:1';
process.env.MINDRIAN_BRAIN_TIMEOUT_MS = '500';
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
const C = hygiene.makeChecker('test-366-ambient-offer');

try {
  require('node:sqlite');
} catch (_e) {
  console.log('SKIP test-366-ambient-offer.cjs (node:sqlite unavailable)');
  process.exit(77);
}

const { buildPerspectiveRoom } = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const { buildDeltaRoom } = require(path.join(REPO_ROOT, 'tests/helpers/fixture-room-3551.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib/core/navigation.cjs'));
const eurekaRecall = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspectives/eureka-recall.cjs'));
const filingStamped = require(path.join(REPO_ROOT, 'lib/core/research-planner/filing-stamped.cjs'));
const cadenceGuard = require(path.join(REPO_ROOT, 'scripts/scout-cadence-guard.cjs'));
const ambientRun = require(path.join(REPO_ROOT, 'lib/core/ambient-run.cjs'));
const plannerAmbient = require(path.join(REPO_ROOT, 'lib/core/research-planner/ambient.cjs'));
const planner = require(path.join(REPO_ROOT, 'lib/core/research-planner/planner.cjs'));
const planMod = require(path.join(REPO_ROOT, 'lib/core/research-planner/plan.cjs'));
const grants = require(path.join(REPO_ROOT, 'lib/core/research-planner/grants.cjs'));

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-offer-'));
const cleanups = [];

async function leg(name, fn) {
  try {
    const ok = await fn();
    C.check(name, ok === true, ok === true ? '' : String(ok).slice(0, 1200));
  } catch (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 600));
  }
}

function withReadDb(roomDir, fn) {
  const db = navigation.openRoomDbReadOnlyForCaller(roomDir);
  try { return fn(db); } finally { try { navigation.closeRoomDbForCaller(db); } catch (_e) { /* read-only */ } }
}

function countOpportunities(roomDir) {
  return withReadDb(roomDir, function (db) {
    return db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'opportunity'").get().n;
  });
}

function stub(outcomeName) {
  return async function () { return { outcome: outcomeName || 'no_candidate', findings: [] }; };
}

function adaptersWithRealEureka(extra) {
  return Object.assign({
    eureka: ambientRun.PRODUCER_ADAPTERS.eureka,
    'find-connections': stub(),
    'find-bottlenecks': stub(),
    hsi: stub(),
    whitespace: stub(),
  }, extra || {});
}

function strongStamp() {
  return {
    verification: 'strong', backend: 'theo', direction: 'none', judge: 'none',
    path: { nodes: ['A', 'B'], labels: ['Framework', 'Framework'], edges: ['EXTENDS'] },
  };
}

function countingCallTool() {
  const calls = [];
  const fn = async function (tool, args) { calls.push({ tool: tool, args: args }); return { paths: [] }; };
  fn.calls = calls;
  return fn;
}

const built = buildPerspectiveRoom(path.join(root, 'r1'));
const roomDir = built.roomDir;
const TITLES = withReadDb(roomDir, function (db) {
  return eurekaRecall.buildSubstrate(db, { roomDir: roomDir }).things.map(function (t) { return t.title; });
});

async function main() {
  const TOP = ambientRun.AMBIENT_TOP_N;

  // ---------------------------------------------------------------------------
  // O1 adapter shape and order
  // ---------------------------------------------------------------------------
  let adapterRes = null;
  await leg('O1 _eurekaAdapter returns offer_only eureka findings, no stamp, <= AMBIENT_TOP_N, in recall order', async function () {
    const callTool = countingCallTool();
    adapterRes = await ambientRun.PRODUCER_ADAPTERS.eureka(roomDir, { deps: { callTool: callTool }, roomDir: roomDir, priorFindings: [], now: Date.now });
    const want = withReadDb(roomDir, function (db) {
      const sub = eurekaRecall.buildSubstrate(db, { roomDir: roomDir });
      return eurekaRecall.recallCandidates(sub, roomDir, { max_candidates: TOP }).candidates;
    });
    const f = adapterRes && Array.isArray(adapterRes.findings) ? adapterRes.findings : [];
    const shapeOk = f.length > 0 && f.length <= TOP && f.every(function (x, i) {
      return x.producer === 'eureka' && x.offer_only === true && !Object.prototype.hasOwnProperty.call(x, 'stamp')
        && x.rank === i && x.a && x.b && x.a.text === '' && x.b.text === '';
    });
    const orderOk = f.length === want.length && f.every(function (x, i) { return x.a.handle === want[i].a && x.b.handle === want[i].b; });
    const plantedIn = f.some(function (x) {
      return (x.a.handle === built.planted.eureka[0] && x.b.handle === built.planted.eureka[1])
        || (x.a.handle === built.planted.eureka[1] && x.b.handle === built.planted.eureka[0]);
    });
    return (adapterRes.outcome === 'offered' && shapeOk && orderOk && plantedIn && callTool.calls.length === 0)
      || JSON.stringify({ outcome: adapterRes && adapterRes.outcome, n: f.length, want: want.length, shapeOk: shapeOk, orderOk: orderOk, plantedIn: plantedIn, first: f[0] });
  });

  // ---------------------------------------------------------------------------
  // O2 offer_only is never the card; nothing filed, no side channel
  // ---------------------------------------------------------------------------
  await leg('O2 selectCardFinding skips offer_only; the real eureka adapter files nothing and writes no last-eureka.json', async function () {
    const offerOnlyStrong = { producer: 'eureka', a: { handle: 'x', text: '' }, b: { handle: 'y', text: '' }, stamp: strongStamp(), rank: 0, offer_only: true };
    const unitOk = ambientRun.selectCardFinding([offerOnlyStrong]) === null;
    const before = countOpportunities(roomDir);
    let guardCalls = 0;
    const res = await ambientRun.runAmbientComposition(roomDir, {
      deps: {
        adapters: adaptersWithRealEureka(),
        callTool: countingCallTool(),
        measureAndGuard: async function () { guardCalls += 1; return { ok: true, score: 1, guard: {} }; },
      },
    });
    const after = countOpportunities(roomDir);
    const side = fs.existsSync(path.join(roomDir, '.mindrian', 'last-eureka.json'));
    return (unitOk && res.card === null && res.surfaced_via === 'none' && guardCalls === 0 && after === before && side === false)
      || JSON.stringify({ unitOk: unitOk, card: res.card, guardCalls: guardCalls, before: before, after: after, side: side });
  });

  // ---------------------------------------------------------------------------
  // O3 offer payload: ids and slugs only; 'offered' survives; the ledger validates
  // ---------------------------------------------------------------------------
  await leg('O3 producers.eureka is {outcome offered, offer of ids and slugs}; offered is the last guard outcome; the ledger validates', async function () {
    const list = cadenceGuard.AMBIENT_PRODUCER_OUTCOMES;
    const listOk = Object.isFrozen(list) && list[list.length - 1] === 'offered'
      && JSON.stringify(list.slice(0, -1)) === JSON.stringify(['filed', 'no_candidate', 'below_floor', 'guard_not_cleared', 'error', 'skipped', 'deps_missing']);
    const res = await ambientRun.runAmbientComposition(roomDir, { deps: { adapters: adaptersWithRealEureka(), callTool: countingCallTool() } });
    const eu = res.producers && res.producers.eureka;
    const offer = eu && Array.isArray(eu.offer) ? eu.offer : [];
    const rowsOk = offer.length > 0 && offer.length <= TOP && offer.every(function (r) {
      return JSON.stringify(Object.keys(r).sort()) === JSON.stringify(['a', 'b', 'section_a', 'section_b'])
        && typeof r.a === 'string' && typeof r.b === 'string' && typeof r.section_a === 'string' && typeof r.section_b === 'string';
    });
    const text = JSON.stringify(eu || {});
    const leaked = TITLES.filter(function (t) { return t && text.indexOf(t) !== -1; });

    // the child path: the ledger record keeps {outcome, posture} only and validates
    const delta = buildDeltaRoom('o3-ledger');
    cleanups.push(delta);
    delta.addArtifact();
    const child = await ambientRun.runAmbientInChild(delta.roomDir, {
      seam: 'material', materialId: 'ab12cd34ef56', sessionId: 's',
      deps: {
        composition: async function () { return res; },
        researchPlanner: { maybeQuick: async function () { return { outcome: 'skipped_no_whitespace' }; } },
      },
      now: Date.now(),
    });
    let ledger = null;
    try { ledger = JSON.parse(fs.readFileSync(path.join(delta.roomDir, '.mindrian', 'ambient-run-ledger.json'), 'utf8')); } catch (_e) { ledger = null; }
    const ledgerOk = !!ledger && cadenceGuard.validateAmbientLedger(ledger) === true
      && ledger.producers && ledger.producers.eureka && ledger.producers.eureka.outcome === 'offered'
      && JSON.stringify(Object.keys(ledger.producers.eureka).sort()) === JSON.stringify(['outcome', 'posture']);
    return (listOk && eu && eu.outcome === 'offered' && rowsOk && leaked.length === 0 && child.state === 'completed' && ledgerOk)
      || JSON.stringify({ listOk: listOk, eu: eu && { outcome: eu.outcome, n: offer.length, first: offer[0] }, rowsOk: rowsOk, leaked: leaked, child: child, ledger: ledger && ledger.producers });
  });

  // ---------------------------------------------------------------------------
  // O4 the other producers still file, through the planner's stamped filer
  // ---------------------------------------------------------------------------
  await leg('O4 a strong hsi finding is filed through research-planner/filing-stamped.cjs fileStampedOpportunity', async function () {
    const room2 = buildPerspectiveRoom(path.join(root, 'r-o4'));
    const original = filingStamped.fileStampedOpportunity;
    let filerCalls = 0;
    filingStamped.fileStampedOpportunity = function () { filerCalls += 1; return original.apply(this, arguments); };
    let res;
    try {
      const hsiFinding = {
        producer: 'hsi', a: { handle: 'ma/M2', text: 'Municipal crews dispatched by neighbourhood demand' },
        b: { handle: 'ca/C1', text: 'Ant colony pheromone trails' }, stamp: strongStamp(), rank: 0,
      };
      res = await ambientRun.runAmbientComposition(room2.roomDir, {
        deps: {
          adapters: adaptersWithRealEureka({ hsi: async function () { return { outcome: 'no_candidate', findings: [hsiFinding] }; } }),
          callTool: countingCallTool(),
          measureAndGuard: async function () { return { ok: true, score: { direction: 'structural_transfer', abs_diff: 0.5, band: 'opportunity', passes: true, semantic: 0.1, lexical: 0.1 }, guard: { cleared: true, verdict: 'transferable', confidence: 'high', tags: [] } }; },
        },
      });
    } finally {
      filingStamped.fileStampedOpportunity = original;
    }
    const filed = res && res.card && typeof res.card.opportunity_handle === 'string';
    return (filerCalls === 1 && filed && res.producers.hsi.outcome === 'filed' && res.producers.eureka.outcome === 'offered' && res.surfaced_via === 'sens13')
      || JSON.stringify({ filerCalls: filerCalls, card: res && res.card, producers: res && res.producers, surfaced: res && res.surfaced_via });
  });

  // ---------------------------------------------------------------------------
  // O5 static: the title-only scorer and the runner are gone
  // ---------------------------------------------------------------------------
  await leg('O5 ambient-run.cjs no longer requires room-native-substrate, rs-differential-scorer or eureka-portfolio-report', function () {
    const file = path.join(REPO_ROOT, 'lib', 'core', 'ambient-run.cjs');
    const code = hygiene.nonCommentLines(file).join('\n');
    const banned = ['room-native-substrate', 'rs-differential-scorer', 'eureka-portfolio-report', 'stampRankedPairs', 'scoreMeasured'];
    const hits = banned.filter(function (b) { return code.indexOf(b) !== -1; });
    const uses = ['filing-stamped', 'recallCandidates', 'offer_only'].filter(function (s) { return code.indexOf(s) === -1; });
    return (hits.length === 0 && uses.length === 0) || JSON.stringify({ banned_present: hits, missing: uses });
  });

  // ---------------------------------------------------------------------------
  // O6 zero network, zero callTool for eureka
  // ---------------------------------------------------------------------------
  await leg('O6 zero network attempts and the injected callTool is never called for eureka', async function () {
    const callTool = countingCallTool();
    await ambientRun.runAmbientComposition(roomDir, { deps: { adapters: adaptersWithRealEureka(), callTool: callTool } });
    return (callTool.calls.length === 0 && net.attempts() === 0) || JSON.stringify({ calls: callTool.calls.length, net: net.attempts() });
  });
  // ---------------------------------------------------------------------------
  // O7-O12 the planner's ambient step: the offer becomes one plan-only card
  // ---------------------------------------------------------------------------
  const NOW = Date.now();
  let roomSeq = 0;
  function freshRoom() {
    roomSeq += 1;
    return buildPerspectiveRoom(path.join(root, 'r-plan-' + roomSeq)).roomDir;
  }
  function runDirsOf(dir) {
    try { return fs.readdirSync(path.join(dir, '.mindrian', 'research-runs')); } catch (_e) { return []; }
  }
  function compWith(offer, whitespaceOutcome) {
    return {
      producers: {
        eureka: { outcome: 'offered', posture: 'run', offer: offer },
        whitespace: { outcome: whitespaceOutcome || 'deps_missing', posture: 'run' },
      },
      tier_counts: { strong: 0, indirect: 0, unverified: 0 },
      card: null,
      surfaced_via: 'none',
    };
  }
  function fetchSpy() {
    const calls = [];
    const fn = async function (args) { calls.push(args); return { status: 'error' }; };
    fn.calls = calls;
    return fn;
  }
  const OFFER = adapterRes && Array.isArray(adapterRes.offer) ? adapterRes.offer : [];
  const optsWith = function (spy) { return { now: NOW, budgetMs: 4 * 60 * 1000, deps: { fetchEnvelopeFn: spy } }; };

  await leg('O7 an eureka offer with no whitespace card records plan_card_eureka_offer and a pending plan-only card', async function () {
    const dir = freshRoom();
    const spy = fetchSpy();
    const out = await plannerAmbient.maybeQuick(dir, compWith(OFFER), optsWith(spy));
    const pending = planner.pendingCards(dir).filter(function (p) { return p.run_id === out.run_id; })[0];
    const run = out.run_id ? path.join(dir, '.mindrian', 'research-runs', out.run_id) : null;
    return (plannerAmbient.AMBIENT_OUTCOMES.indexOf('plan_card_eureka_offer') !== -1
      && out.outcome === 'plan_card_eureka_offer' && /^rp-/.test(String(out.run_id)) && !out.deduped
      && !!pending && pending.kind === 'plan_card_no_grant'
      && fs.existsSync(path.join(run, 'plan.json')) && fs.existsSync(path.join(run, 'card.json'))
      && !fs.existsSync(path.join(run, 'run.json')) && spy.calls.length === 0)
      || JSON.stringify({ out: out, pending: !!pending, fetch: spy.calls.length });
  });

  await leg('O8 a standing grant, and even a forced covering cover, still yield the plan-only offer and zero fetches', async function () {
    const quickMod = require(path.join(REPO_ROOT, 'lib/core/research-planner/quick.cjs'));
    // (a) a real standing grant over every recalled title: the standing scope
    // (whitespace family only) never covers an eureka plan, so the card shows
    // the family re-ask text; either way nothing is fetched.
    const dirA = freshRoom();
    const terms = TITLES.filter(Boolean).map(function (t) { return { term: t, synonyms: [] }; });
    const w = grants.writeGrant(dirA, grants.buildStandingProposal(dirA, { terms: terms }), { approved_via: { surface: 'cli', decision_node_id: 'd-366-07-test' } });
    if (!w.ok) return 'grant failed ' + JSON.stringify(w);
    const spyA = fetchSpy();
    const outA = await plannerAmbient.maybeQuick(dirA, compWith(OFFER), optsWith(spyA));
    // (b) cover forced to covered:true (what a run grant would give): the branch
    // must still end at the plan-only card and never reach runQuick.
    const dirB = freshRoom();
    const realCover = quickMod.coverFor;
    const realRun = quickMod.runQuick;
    let runQuickCalls = 0;
    quickMod.coverFor = function () { return { covered: true, grant: { lifetime: 'standing' } }; };
    quickMod.runQuick = async function () { runQuickCalls += 1; return { status: 'refused', reason: 'test' }; };
    const spyB = fetchSpy();
    let outB;
    try {
      outB = await plannerAmbient.maybeQuick(dirB, compWith(OFFER), optsWith(spyB));
    } finally {
      quickMod.coverFor = realCover;
      quickMod.runQuick = realRun;
    }
    const ledgerB = grants.readRunLedger(dirB, { now: NOW });
    const pendB = planner.pendingCards(dirB).filter(function (p) { return p.run_id === outB.run_id; })[0];
    return (outA.outcome === 'plan_card_eureka_offer' && !outA.deduped && spyA.calls.length === 0
      && outB.outcome === 'plan_card_eureka_offer' && outB.reason === 'eureka_offer' && !!pendB
      && spyB.calls.length === 0 && runQuickCalls === 0 && (ledgerB.runs || []).length === 0 && net.attempts() === 0)
      || JSON.stringify({ outA: outA, outB: outB, fetchA: spyA.calls.length, fetchB: spyB.calls.length, runQuickCalls: runQuickCalls, pendB: !!pendB });
  });

  await leg('O9 a whitespace card produced in the same pass wins; no eureka card is recorded', async function () {
    const dir = freshRoom();
    fs.writeFileSync(path.join(dir, '.mindrian', 'whitespace-results.json'), JSON.stringify({
      metadata: { frozen_for: 'phase-366-07-test' },
      gaps: [{ zone_id: 'z1', zone_term: 'municipal crew dispatch', density_score: 0.1, sections: ['market-analysis', 'solution-design'] }],
    }), 'utf8');
    const spy = fetchSpy();
    const out = await plannerAmbient.maybeQuick(dir, compWith(OFFER, 'no_candidate'), optsWith(spy));
    const pend = planner.pendingCards(dir);
    return (out.outcome === 'plan_card_no_grant' && pend.length === 1 && runDirsOf(dir).length === 1 && spy.calls.length === 0)
      || JSON.stringify({ out: out, pending: pend.length, dirs: runDirsOf(dir).length });
  });

  await leg('O10 an unsurfaced plan-only card already pending dedupes the offer and leaves no run dir behind', async function () {
    const dir = freshRoom();
    const spy = fetchSpy();
    const first = await plannerAmbient.maybeQuick(dir, compWith(OFFER), optsWith(spy));
    const dirsAfterFirst = runDirsOf(dir).length;
    const second = await plannerAmbient.maybeQuick(dir, compWith(OFFER), optsWith(spy));
    return (first.outcome === 'plan_card_eureka_offer' && second.outcome === 'plan_card_eureka_offer'
      && second.deduped === true && second.run_id === first.run_id
      && runDirsOf(dir).length === dirsAfterFirst && planner.pendingCards(dir).length === 1)
      || JSON.stringify({ first: first, second: second, dirs: runDirsOf(dir) });
  });

  await leg('O11 the offered plan validates and its leaves carry the closed pair shape', async function () {
    const dir = freshRoom();
    const out = await plannerAmbient.maybeQuick(dir, compWith(OFFER), optsWith(fetchSpy()));
    const plan = JSON.parse(fs.readFileSync(path.join(dir, '.mindrian', 'research-runs', out.run_id, 'plan.json'), 'utf8'));
    const v = planMod.validatePlan(plan);
    const pairLeaves = plan.leaves.filter(function (l) { return l.pair; });
    const shapeOk = pairLeaves.length > 0 && pairLeaves.length <= plannerAmbient.EUREKA_OFFER_PAIRS && pairLeaves.every(function (l) {
      return JSON.stringify(Object.keys(l.pair).sort()) === JSON.stringify(['a', 'b', 'perspective', 'run_tag']) && l.pair.perspective === 'eureka';
    });
    return (v.ok === true && plan.mode === 'quick' && shapeOk && plannerAmbient.EUREKA_OFFER_PAIRS === 3)
      || JSON.stringify({ valid: v, shapeOk: shapeOk, n: pairLeaves.length });
  });

  await leg('O12 leaf questions name both titles, the offer stays ids and slugs, an unresolved row is dropped and counted', async function () {
    const dir = freshRoom();
    const ghost = { a: 'ghost-node-1', b: 'ghost-node-2', section_a: 'market-analysis', section_b: 'solution-design' };
    const comp = compWith([ghost].concat(OFFER));
    const offerBefore = JSON.stringify(comp.producers.eureka.offer);
    // the ghost row sits first, so with EUREKA_OFFER_PAIRS = 3 two real rows remain
    const out = await plannerAmbient.maybeQuick(dir, comp, optsWith(fetchSpy()));
    const plan = JSON.parse(fs.readFileSync(path.join(dir, '.mindrian', 'research-runs', out.run_id, 'plan.json'), 'utf8'));
    const questions = plan.leaves.filter(function (l) { return l.pair; }).map(function (l) { return String(l.question); });
    const noUndef = questions.length > 0 && questions.every(function (q) { return q.indexOf('undefined') === -1; });
    const namesTitles = questions.every(function (q) { return TITLES.filter(Boolean).filter(function (t) { return q.indexOf(t) !== -1; }).length >= 2; });
    const offerRowsOk = comp.producers.eureka.offer.every(function (r) {
      return JSON.stringify(Object.keys(r).sort()) === JSON.stringify(['a', 'b', 'section_a', 'section_b']);
    }) && JSON.stringify(comp.producers.eureka.offer) === offerBefore;
    const ghostLeaf = plan.leaves.some(function (l) { return l.pair && (l.pair.a === 'ghost-node-1' || l.pair.b === 'ghost-node-2'); });
    return (out.outcome === 'plan_card_eureka_offer' && out.dropped === 1 && noUndef && namesTitles && offerRowsOk && !ghostLeaf)
      || JSON.stringify({ out: out, noUndef: noUndef, namesTitles: namesTitles, offerRowsOk: offerRowsOk, ghostLeaf: ghostLeaf, questions: questions });
  });
}

main().then(function () {
  C.check('zero network attempts (whole test)', net.attempts() === 0, String(net.attempts()));
  net.restore();
  cleanups.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* tmp */ } });
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
  process.exit(C.summary());
}, function (e) {
  console.error(e);
  process.exit(1);
});
