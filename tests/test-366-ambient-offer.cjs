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
          measureAndGuard: async function () { return { ok: true, score: 0.9, guard: { cleared: true } }; },
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
