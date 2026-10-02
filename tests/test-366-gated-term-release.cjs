#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 11 Task 2 (D-13, D-14, D-15, EPV366-18/19): the gated, per-term release to Theo.
 *
 *   R1  the basket lists one canon_term item per distinct unresolved carried framework or
 *       methodology term (never a title), each with a gate id; with the theo line off the item
 *       shows with no gate and the off note
 *   R2  no gate answer: the injected callTool is called zero times
 *   R3  gate answered yes: exactly one callTool('normalize_framework_name', {raw: term}); the
 *       guard classified the envelope with the receipt as navigator_released
 *   R4  one audit row with exactly the 23 AUDIT_KEYS (provider theo, template canon-translation,
 *       family canon-term/v1, q the term, grant_id the gate id, part8_verdict pass, origin_ref
 *       jtbd|section|perspective)
 *   R5  a hit whose canonical name is in the snapshot writes a PROPOSED row (ratified_at null);
 *       a miss (or a canonical outside the snapshot) writes nothing and counts release_miss
 *   R6  the gate is single-use and session-scoped; releaseTerm refuses a gate it did not mint
 *   R7  the next basket lists a canon_translation item for the proposed row; confirming it sets
 *       ratified_at and resolveEndpoint then resolves the term via translation
 *   R8  the CLI canon-release / canon-confirm work and refuse free text with exit 2
 *   R9  the release card says "term only" and "NOT sent", names intent, section and perspective as
 *       recorded locally, and never implies that intent reaches Theo
 *   R10 fileRun ignores the canon item kinds
 *
 * Isolation: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at temp dirs and the session env is
 * cleared BEFORE any repo module loads. callTool is injected; the net guard counts attempts. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-release-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-release-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;
delete process.env.OPENALEX_API_KEY;
delete process.env.OPENALEX_EMAIL;
delete process.env.MOS_366_LIVE;
delete process.env.MOS_366_THEO_REPLAY;

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-366-gated-term-release');

const { buildPerspectiveRoom } = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const RP = path.join(REPO_ROOT, 'lib/core/research-planner');
const Y = require(path.join(RP, 'pyramid.cjs'));
const planMod = require(path.join(RP, 'plan.cjs'));
const planner = require(path.join(RP, 'planner.cjs'));
const auditLedger = require(path.join(RP, 'audit-ledger.cjs'));
const recall = require(path.join(RP, 'perspectives/eureka-recall.cjs'));
const gateLedger = require(path.join(REPO_ROOT, 'lib/mcp/gate-ledger.cjs'));
const canonTranslations = require(path.join(REPO_ROOT, 'lib/core/canon-translations.cjs'));
const verificationStamp = require(path.join(REPO_ROOT, 'lib/core/verification-stamp.cjs'));
const jtbdState = require(path.join(REPO_ROOT, 'lib/hmi/jtbd-state.cjs'));
const roomDbMod = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const { insertNode } = require(path.join(REPO_ROOT, 'lib/core/node-insert.cjs'));
let canonRelease = null;
let loadError = null;
try { canonRelease = require(path.join(RP, 'canon-release.cjs')); } catch (e) { loadError = e; }

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-release-'));
const TAG = '20261002T120000Z';
const RS = 'Reverse Salient Analysis';
const GATE_RE = /^gate-[0-9a-f]{16}$/;
const ITEM_RE = /^canon_term:[0-9a-f]{12}$/;
const CONFIRM_RE = /^canon_translation:[0-9a-f]{12}$/;
const TERM1 = 'Bottleneck Hunt';
const TERM2 = 'Zorp Method';
const TITLE_M1 = 'Suppliers of antifouling coating for seawater membranes';

function leg(name, fn) {
  return Promise.resolve().then(fn).then(function (ok) {
    C.check(name, ok === true, ok === true ? '' : String(ok));
  }, function (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 500));
  });
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function samePair(p, a, b) { return !!p && ((p.a === a && p.b === b) || (p.a === b && p.b === a)); }
function dashFree(s) { return !/[\u2013\u2014]/.test(String(s)); }

// ---------------------------------------------------------------------------
// the room: the planted fixture plus two things that carry a room word as their framework
// ---------------------------------------------------------------------------
const built = buildPerspectiveRoom(path.join(root, 'r1'));
const roomDir = built.roomDir;
const EU = built.planted.eureka;
(function addThings() {
  const db = roomDbMod.openRoomDb(roomDir);
  try {
    insertNode(db, 'pd/BH1', 'Artifact', JSON.stringify({ section: 'problem-definition', title: 'Where the venture is stuck', framework: TERM1, body: 'The slowest stage limits every other stage.' }), { source_path: 'test:366-11', epistemic_type: 'observation' });
    insertNode(db, 'pd/ZM1', 'Artifact', JSON.stringify({ section: 'problem-definition', title: 'A second stuck place', framework: TERM2, body: 'Another unmatched room word.' }), { source_path: 'test:366-11', epistemic_type: 'observation' });
  } finally { roomDbMod.closeRoomDb(db); }
})();

// one recall, then two plans whose eureka leaf pair carries each new thing
const rec = recall.runRecall(roomDir, { tag: TAG });
function planWithPairA(aId) {
  const qs = clone(rec.question_set);
  const leaf = qs.leaves.filter(function (l) { return l.pair && samePair(l.pair, EU[0], EU[1]); })[0];
  if (!leaf) return null;
  leaf.pair = Object.assign({}, leaf.pair, { a: aId });
  return planner.buildPlan(roomDir, qs, {});
}
function writeRun(plan) {
  const leaf = plan.plan.leaves.filter(function (l) { return l.pair && l.pair.perspective === 'eureka'; })[0];
  const v = {}; v[leaf.id] = 'settled';
  const rolled = Y.rollUp(plan.plan.pyramid, plan.plan.leaves, [], { verdictByLeaf: v });
  const opps = Y.opportunityCandidates(rolled.pyramid, rolled.leaves, [], {});
  const run = {
    schema: planMod.RUN_SCHEMA, run_id: plan.run_id, mode: 'quick', plan_hash: plan.plan_hash, trigger: 'navigator',
    started_at: '2026-10-02T12:00:00.000Z', finished_at: '2026-10-02T12:00:01.000Z', stop_reason: 'complete',
    queries: [], rows: [], dropped: {}, leaves: rolled.leaves, verdict: 'settled', answer_line: 'Replayed supported verdict.',
    pyramid: rolled.pyramid, perspective: plan.plan.perspective, governing_status: rolled.governing_status,
    unresolved_branches: rolled.unresolved_branches, opportunity_candidates: opps, contradictions: rolled.contradictions,
    escalation_offer: null, local_checks: [], filed: false,
  };
  const dir = path.join(roomDir, '.mindrian', 'research-runs', plan.run_id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify(run, null, 2));
  return run;
}
const plan1 = planWithPairA('pd/BH1');
const plan2 = planWithPairA('pd/ZM1');
const RUN1 = plan1 && plan1.ok ? plan1.run_id : null;
const RUN2 = plan2 && plan2.ok ? plan2.run_id : null;
if (RUN1) writeRun(plan1);
if (RUN2) writeRun(plan2);

// the injected Theo
const calls = [];
function theoReturning(answer) {
  return async function (tool, args) { calls.push({ tool: tool, args: JSON.parse(JSON.stringify(args)) }); return answer; };
}
const HIT = { canonical: RS, matched_via: 'alias', coverage: { status: 'complete', matched: 1, total: 149 } };
const MISS = { coverage: { status: 'empty', matched: 0, total: 149 }, refusal: { code: 'not_found', detail: 'no such framework' } };
const OFF_SNAPSHOT = { canonical: 'Invented Framework Nobody Ships', matched_via: 'alias', coverage: { status: 'complete', matched: 1, total: 149 } };

function itemFor(basket, term) { return basket.items.filter(function (i) { return i.kind === 'canon_release' && i.term === term; })[0]; }
function theoRows() {
  return auditLedger.readAudit(roomDir).filter(function (r) { return r.provider === 'theo' && r.template_id === 'canon-translation'; });
}

async function main() {
  await leg('R0 canon-release loads and the plans were built', function () {
    if (loadError) return 'load: ' + String(loadError.message).slice(0, 200);
    return (!!canonRelease && !!RUN1 && !!RUN2) || 'plan1 ' + JSON.stringify(plan1 && plan1.errors) + ' plan2 ' + JSON.stringify(plan2 && plan2.errors);
  });
  if (!canonRelease || !RUN1 || !RUN2) { net.restore(); process.exit(C.summary()); return; }

  jtbdState.setCurrent(roomDir, { jtbd: 'find-bottleneck', confidence: 0.9, trigger: 'test', manual: true });
  const ledgerSizeBefore = gateLedger._internal._ledger.size;

  // ----- R1
  let basket1 = null;
  await leg('R1 the basket lists one canon_term item for the carried framework term, with a gate id; never a title', function () {
    basket1 = planner.basketFor(roomDir, RUN1, { sessionId: 'sess-1', deps: { callTool: theoReturning(HIT) } });
    if (!basket1.ok) return 'basket: ' + JSON.stringify(basket1).slice(0, 300);
    const rel = basket1.items.filter(function (i) { return i.kind === 'canon_release'; });
    if (rel.length !== 1) return 'release items: ' + JSON.stringify(rel);
    const it = rel[0];
    const body = JSON.stringify(rel);
    return (ITEM_RE.test(it.id) && it.term === TERM1 && GATE_RE.test(it.gate_id) && it.default_on === false
      && body.indexOf(TITLE_M1) === -1 && body.indexOf('Where the venture is stuck') === -1
      && basket1.card.payload.item_ids.indexOf(it.id) !== -1 && dashFree(basket1.card.body_md)) || JSON.stringify(it);
  });

  await leg('R1b a distinct term is offered once even when two pairs carry it', function () {
    const run = JSON.parse(fs.readFileSync(path.join(roomDir, '.mindrian', 'research-runs', RUN1, 'run.json'), 'utf8'));
    const plan = planner.loadPlan(roomDir, RUN1).plan;
    const items = canonRelease.offerItemsFor(roomDir, run, plan, {});
    const doubled = clone(run);
    doubled.opportunity_candidates = doubled.opportunity_candidates.concat(clone(doubled.opportunity_candidates));
    const items2 = canonRelease.offerItemsFor(roomDir, doubled, plan, {});
    return (items.length === 1 && items2.length === 1 && items2[0].id === items[0].id) || JSON.stringify([items.length, items2.length]);
  });

  await leg('R1c with the theo line off the item shows with no gate and the off note, and mints nothing', function () {
    const pol = path.join(roomDir, '.mindrian', 'egress-policy.json');
    fs.mkdirSync(path.dirname(pol), { recursive: true });
    fs.writeFileSync(pol, JSON.stringify({ lines: { theo: false } }));
    const before = gateLedger._internal._ledger.size;
    const b = planner.basketFor(roomDir, RUN1, { sessionId: 'sess-off', deps: { callTool: theoReturning(HIT) } });
    const after = gateLedger._internal._ledger.size;
    fs.unlinkSync(pol);
    if (!b.ok) return 'basket: ' + JSON.stringify(b).slice(0, 300);
    const it = itemFor(b, TERM1);
    return (!!it && (it.gate_id === null || it.gate_id === undefined) && /Theo is off in this room's egress policy/.test(it.label + ' ' + (it.note || ''))
      && after === before) || JSON.stringify(it) + ' ' + before + '/' + after;
  });

  // ----- R2
  await leg('R2 no gate answer: the injected callTool is called zero times', function () {
    return calls.length === 0 || 'calls ' + calls.length;
  });

  // ----- R9 (before any answer, uses the item as basketed)
  await leg('R9 the release card says term only and NOT sent, names intent, section, perspective as recorded locally, never implies intent reaches Theo', function () {
    const it = itemFor(basket1, TERM1);
    const card = canonRelease.releaseCard(it);
    const b = card.body_md;
    const impliesSent = /intent[^.\n]*\b(reaches|is sent to|goes to|sent to) theo/i.test(b) && b.indexOf('NOT sent') === -1;
    return (card.shape === 'F.8' && /Release this term to Theo\?/.test(card.title)
      && b.indexOf(TERM1) !== -1 && b.indexOf('term only') !== -1 && b.indexOf('NOT sent') !== -1
      && /intent/.test(b) && /section/.test(b) && /perspective/.test(b) && /recorded/i.test(b)
      && b.indexOf('find-bottleneck') !== -1 && b.indexOf('problem-definition') !== -1 && b.indexOf('eureka') !== -1
      && /name alone/.test(b) && /cannot read your intent/.test(b) && !impliesSent && dashFree(b)
      && JSON.stringify(card.options.map(function (o) { return o.id; })) === JSON.stringify(['release', 'not_now'])) || b.slice(0, 600);
  });

  // ----- R3, R4, R5
  let answered1 = null;
  await leg('R3 a yes calls normalize_framework_name once with {raw: term} and the guard allowed navigator_released', async function () {
    const it = itemFor(basket1, TERM1);
    const entry = gateLedger.consumeGate(it.gate_id, 'sess-1');
    if (!entry || entry.ok === false || typeof entry.resumeFn !== 'function') return 'gate not consumable: ' + JSON.stringify(entry && Object.keys(entry));
    answered1 = await entry.resumeFn({ gate_id: it.gate_id, chosen: ['release'], verdict: 'approve' });
    return (calls.length === 1 && calls[0].tool === 'normalize_framework_name' && JSON.stringify(calls[0].args) === JSON.stringify({ raw: TERM1 })
      && answered1 && answered1.ok === true && answered1.guard && answered1.guard.class === 'navigator_released') || JSON.stringify([calls, answered1]).slice(0, 500);
  });

  await leg('R4 one audit row with exactly the 23 keys and the release fields', function () {
    const rows = theoRows();
    if (rows.length !== 1) return 'rows ' + rows.length;
    const r = rows[0];
    const it = itemFor(basket1, TERM1);
    const keysOk = JSON.stringify(Object.keys(r).sort()) === JSON.stringify(auditLedger.AUDIT_KEYS.slice().sort());
    return (keysOk && r.provider === 'theo' && r.template_id === 'canon-translation' && r.family === 'canon-term/v1' && r.q === TERM1
      && r.grant_id === it.gate_id && r.part8_verdict === 'pass' && r.run_id === RUN1 && r.outcome === 'ok'
      && r.origin_ref === 'jtbd:find-bottleneck|section:problem-definition|perspective:eureka'
      && JSON.stringify(r.filters) === JSON.stringify({ intent: 'find-bottleneck', section: 'problem-definition', perspective: 'eureka' }))
      || JSON.stringify(r);
  });

  await leg('R5 a hit in the snapshot writes a proposed row with ratified_at null; the resolver ignores it', function () {
    const rows = canonTranslations.listRows(roomDir);
    const row = rows.filter(function (r) { return r.term === TERM1; })[0];
    const ctx = verificationStamp.resolverCtxFor(roomDir);
    const r = verificationStamp.resolveEndpoint({ framework: TERM1 }, ctx);
    return (!!row && row.canon_name === RS && row.ratified_at === null && r.name === null && answered1.proposed === true) || JSON.stringify([rows, r, answered1]);
  });

  // ----- R5 miss legs on the second run
  let basket2 = null;
  await leg('R5b a miss writes nothing and counts release_miss', async function () {
    basket2 = planner.basketFor(roomDir, RUN2, { sessionId: 'sess-2', deps: { callTool: theoReturning(MISS) } });
    const it = itemFor(basket2, TERM2);
    if (!it || !GATE_RE.test(it.gate_id)) return 'no gate on ' + JSON.stringify(basket2.items).slice(0, 300);
    const before = canonTranslations.listRows(roomDir).length;
    const callsBefore = calls.length;
    const countsBefore = canonRelease.releaseCounts(roomDir);
    const entry = gateLedger.consumeGate(it.gate_id, 'sess-2');
    const out = await entry.resumeFn({ gate_id: it.gate_id, chosen: ['release'], verdict: 'approve' });
    const after = canonTranslations.listRows(roomDir).length;
    const countsAfter = canonRelease.releaseCounts(roomDir);
    const rows = theoRows().filter(function (r) { return r.q === TERM2; });
    return (out.ok === true && out.proposed === false && out.release_miss === 1 && before === after && calls.length === callsBefore + 1
      && countsAfter.release_miss === countsBefore.release_miss + 1 && rows.length === 1 && rows[0].outcome === 'empty_valid' && rows[0].count === 0)
      || JSON.stringify([out, countsBefore, countsAfter, rows]).slice(0, 600);
  });

  await leg('R5c a canonical name outside the snapshot is a counted miss, never a row', async function () {
    const it = itemFor(planner.basketFor(roomDir, RUN2, { sessionId: 'sess-3', deps: { callTool: theoReturning(OFF_SNAPSHOT) } }), TERM2);
    if (!it || !GATE_RE.test(it.gate_id)) return 'no gate';
    const before = canonTranslations.listRows(roomDir).length;
    const out = await gateLedger.consumeGate(it.gate_id, 'sess-3').resumeFn({ gate_id: it.gate_id, chosen: ['release'], verdict: 'approve' });
    const after = canonTranslations.listRows(roomDir);
    return (out.ok === true && out.proposed === false && out.release_miss === 1 && after.length === before
      && !after.some(function (r) { return r.canon_name === 'Invented Framework Nobody Ships'; })) || JSON.stringify([out, after]);
  });

  await leg('R5d a failed call (null) writes nothing, audits outcome failed, never throws', async function () {
    const it = itemFor(planner.basketFor(roomDir, RUN2, { sessionId: 'sess-4', deps: { callTool: theoReturning(null) } }), TERM2);
    const before = canonTranslations.listRows(roomDir).length;
    const out = await gateLedger.consumeGate(it.gate_id, 'sess-4').resumeFn({ gate_id: it.gate_id, chosen: ['release'], verdict: 'approve' });
    const rows = theoRows().filter(function (r) { return r.q === TERM2 && r.grant_id === it.gate_id; });
    return (out.ok === true && out.proposed === false && canonTranslations.listRows(roomDir).length === before
      && rows.length === 1 && rows[0].outcome === 'failed' && typeof rows[0].failure_class === 'string') || JSON.stringify([out, rows]);
  });

  // ----- R6
  await leg('R6 single-use: a second answer calls nothing', async function () {
    const it = itemFor(basket1, TERM1);
    const before = calls.length;
    const again = gateLedger.consumeGate(it.gate_id, 'sess-1');
    return (again === null && calls.length === before) || JSON.stringify(again);
  });

  await leg('R6b session-scoped: another session cannot consume the gate, and the gate is spent anyway', async function () {
    const b = planner.basketFor(roomDir, RUN2, { sessionId: 'sess-A', deps: { callTool: theoReturning(HIT) } });
    const it = itemFor(b, TERM2);
    const before = calls.length;
    const wrong = gateLedger.consumeGate(it.gate_id, 'sess-B');
    const right = gateLedger.consumeGate(it.gate_id, 'sess-A');
    return (wrong && wrong.ok === false && wrong.reason === 'session_mismatch' && right === null && calls.length === before) || JSON.stringify([wrong, right]);
  });

  await leg('R6c releaseTerm refuses a gate id it did not mint, and a mismatched term, with zero calls', async function () {
    const before = calls.length;
    const a = await canonRelease.releaseTerm(roomDir, { term: TERM1, gate_id: 'gate-ffffffffffffffff', run_id: RUN1 }, { callTool: theoReturning(HIT) });
    const it = itemFor(planner.basketFor(roomDir, RUN2, { sessionId: 'sess-5', deps: { callTool: theoReturning(HIT) } }), TERM2);
    const b = await canonRelease.releaseTerm(roomDir, { term: 'Some Other Term', gate_id: it.gate_id, run_id: RUN2 }, { callTool: theoReturning(HIT) });
    return (a.ok === false && a.reason === 'gate_not_minted' && b.ok === false && b.reason === 'gate_not_minted' && calls.length === before) || JSON.stringify([a, b]);
  });

  await leg('R6d a not-now answer calls nothing and writes nothing', async function () {
    const it = itemFor(planner.basketFor(roomDir, RUN2, { sessionId: 'sess-6', deps: { callTool: theoReturning(HIT) } }), TERM2);
    const before = calls.length;
    const rowsBefore = theoRows().length;
    const out = await gateLedger.consumeGate(it.gate_id, 'sess-6').resumeFn({ gate_id: it.gate_id, chosen: ['not_now'], verdict: 'reject' });
    return (out.ok === true && out.executed === false && calls.length === before && theoRows().length === rowsBefore) || JSON.stringify(out);
  });

  await leg('R6e the theo line off at answer time: the call is not made and no row is written', async function () {
    const it = itemFor(planner.basketFor(roomDir, RUN2, { sessionId: 'sess-7', deps: { callTool: theoReturning(HIT) } }), TERM2);
    const pol = path.join(roomDir, '.mindrian', 'egress-policy.json');
    fs.mkdirSync(path.dirname(pol), { recursive: true });
    fs.writeFileSync(pol, JSON.stringify({ lines: { theo: false } }));
    const before = calls.length;
    const rowsBefore = theoRows().length;
    let out;
    try { out = await gateLedger.consumeGate(it.gate_id, 'sess-7').resumeFn({ gate_id: it.gate_id, chosen: ['release'], verdict: 'approve' }); } finally { fs.unlinkSync(pol); }
    return (out.ok === false && out.reason === 'egress_line_off' && calls.length === before && theoRows().length === rowsBefore) || JSON.stringify(out);
  });

  // ----- R7
  let confirmItem = null;
  await leg('R7 the next basket lists a canon_translation item; confirming sets ratified_at and the resolver then resolves via translation', function () {
    const b = planner.basketFor(roomDir, RUN1, { sessionId: 'sess-8', deps: { callTool: theoReturning(HIT) } });
    confirmItem = b.items.filter(function (i) { return i.kind === 'canon_confirm' && i.term === TERM1; })[0];
    if (!confirmItem || !CONFIRM_RE.test(confirmItem.id) || confirmItem.canon_name !== RS || confirmItem.default_on !== false) return 'no confirm item: ' + JSON.stringify(b.items.map(function (i) { return i.id + ':' + i.kind; }));
    if (itemFor(b, TERM1)) return 'the proposed term must not be offered for release again';
    const noAuth = canonRelease.confirmTranslation(roomDir, confirmItem.id, {});
    const unknown = canonRelease.confirmTranslation(roomDir, 'canon_translation:000000000000', { approved_via: 'cli' });
    if (noAuth.ok !== false || noAuth.reason !== 'approval_required' || unknown.ok !== false) return JSON.stringify([noAuth, unknown]);
    if (canonTranslations.listRows(roomDir).filter(function (r) { return r.term === TERM1; })[0].ratified_at !== null) return 'ratified without approval';
    const ok = canonRelease.confirmTranslation(roomDir, confirmItem.id, { approved_via: 'cli' });
    const row = canonTranslations.listRows(roomDir).filter(function (r) { return r.term === TERM1; })[0];
    const r = verificationStamp.resolveEndpoint({ framework: TERM1 }, verificationStamp.resolverCtxFor(roomDir));
    const b2 = planner.basketFor(roomDir, RUN1, {});
    const gone = !b2.items.some(function (i) { return i.kind === 'canon_confirm' && i.term === TERM1; });
    return (ok.ok === true && !!row && typeof row.ratified_at === 'string' && r.name === RS && r.via === 'translation' && gone) || JSON.stringify([ok, row, r, gone]);
  });

  // ----- R8 CLI
  const CLI = path.join(REPO_ROOT, 'scripts/research-planner.cjs');
  function cli(args, env) {
    const r = spawnSync(process.execPath, [CLI].concat(args), {
      cwd: REPO_ROOT,
      env: Object.assign({}, process.env, { HOME: TMP_HOME, USERPROFILE: TMP_HOME, MOS_366_LIVE: '', MOS_366_THEO_REPLAY: '' }, env || {}),
      encoding: 'utf8',
      timeout: 120000,
    });
    let json = null;
    try { json = JSON.parse(String(r.stdout || '').trim().split('\n').pop()); } catch (_e) { json = null; }
    return { status: r.status, json: json, out: String(r.stdout || ''), err: String(r.stderr || '') };
  }
  // the release id of TERM2 as the CLI will compute it
  const run2obj = JSON.parse(fs.readFileSync(path.join(roomDir, '.mindrian', 'research-runs', RUN2, 'run.json'), 'utf8'));
  const plan2obj = planner.loadPlan(roomDir, RUN2).plan;
  const term2Id = canonRelease.offerItemsFor(roomDir, run2obj, plan2obj, {}).filter(function (i) { return i.term === TERM2; })[0];
  const replayFile = path.join(root, 'replay.json');
  fs.writeFileSync(replayFile, JSON.stringify({ schema: 'mos.theo-replay/1', responses: { [TERM2]: HIT } }));

  await leg('R8a free text on --item is refused with exit 2 and never echoed', function () {
    const r = cli(['canon-release', RUN2, '--room', roomDir, '--item', 'Zorp Method', '--approved-via', 'cli']);
    return (r.status === 2 && r.json && r.json.reason === 'free_text_argv_refused' && r.out.indexOf('Zorp') === -1 && r.err.indexOf('Zorp') === -1) || JSON.stringify([r.status, r.out, r.err]).slice(0, 300);
  });

  await leg('R8b canon-release without --approved-via, without --item, and with a translation item are refused', function () {
    const a = cli(['canon-release', RUN2, '--room', roomDir, '--item', term2Id ? term2Id.id : 'canon_term:000000000000']);
    const b = cli(['canon-release', RUN2, '--room', roomDir, '--approved-via', 'cli']);
    const c = cli(['canon-release', RUN2, '--room', roomDir, '--item', 'canon_translation:000000000000', '--approved-via', 'cli']);
    return (a.status === 2 && a.json.reason === 'approved_via_required' && b.status === 2 && b.json.reason === 'item_required'
      && c.status === 2 && c.json.reason === 'wrong_item_kind') || JSON.stringify([a.json, b.json, c.json]);
  });

  await leg('R8c without MOS_366_LIVE or a replay file the CLI refuses live_not_enabled and sends nothing', function () {
    const r = cli(['canon-release', RUN2, '--room', roomDir, '--item', term2Id.id, '--approved-via', 'cli']);
    const rowsNow = theoRows().filter(function (x) { return x.q === TERM2; }).length;
    return (r.status === 2 && r.json.reason === 'live_not_enabled') || JSON.stringify([r.status, r.json, rowsNow]);
  });

  let cliRowsBefore = 0;
  await leg('R8d canon-release with a replay transport answers the release: a proposed row, one audit row with the minted gate id', function () {
    const before = canonTranslations.listRows(roomDir).filter(function (r) { return r.term === TERM2; }).length;
    cliRowsBefore = theoRows().length;
    const r = cli(['canon-release', RUN2, '--room', roomDir, '--item', term2Id.id, '--approved-via', 'cli'], { MOS_366_THEO_REPLAY: replayFile });
    const row = canonTranslations.listRows(roomDir).filter(function (x) { return x.term === TERM2; })[0];
    const rows = theoRows();
    const last = rows[rows.length - 1];
    return (r.status === 0 && r.json && r.json.ok === true && r.json.proposed === true && before === 0 && !!row && row.canon_name === RS && row.ratified_at === null
      && rows.length === cliRowsBefore + 1 && last.q === TERM2 && GATE_RE.test(last.grant_id) && last.filters.transport === 'replay'
      && JSON.stringify(Object.keys(last).sort()) === JSON.stringify(auditLedger.AUDIT_KEYS.slice().sort())) || JSON.stringify([r.status, r.json, row, last]).slice(0, 600);
  });

  await leg('R8e canon-confirm needs --approved-via, the right item kind and a proposed row; then it ratifies', function () {
    const items = canonRelease.confirmItemsFor(roomDir);
    const it = items.filter(function (i) { return i.term === TERM2; })[0];
    if (!it) return 'no confirm item: ' + JSON.stringify(items);
    const a = cli(['canon-confirm', RUN2, '--room', roomDir, '--item', it.id]);
    const b = cli(['canon-confirm', RUN2, '--room', roomDir, '--item', term2Id.id, '--approved-via', 'cli']);
    const c = cli(['canon-confirm', RUN2, '--room', roomDir, '--item', 'canon_translation:000000000000', '--approved-via', 'cli']);
    const stillProposed = canonTranslations.listRows(roomDir).filter(function (x) { return x.term === TERM2; })[0].ratified_at === null;
    const d = cli(['canon-confirm', RUN2, '--room', roomDir, '--item', it.id, '--approved-via', 'cli']);
    const row = canonTranslations.listRows(roomDir).filter(function (x) { return x.term === TERM2; })[0];
    return (a.status === 2 && a.json.reason === 'approved_via_required' && b.status === 2 && b.json.reason === 'wrong_item_kind'
      && c.status === 2 && stillProposed && d.status === 0 && d.json.ok === true && typeof row.ratified_at === 'string') || JSON.stringify([a.json, b.json, c.json, d.json, row]);
  });

  // ----- R10
  await leg('R10 fileRun ignores the canon item kinds; a canon-only selection files nothing', function () {
    const b = planner.basketFor(roomDir, RUN2, { sessionId: 'sess-9', deps: { callTool: theoReturning(HIT) } });
    // after the confirm above the term resolves, so offer a fresh canon item id by shape
    const fake = 'canon_term:aaaaaaaaaaaa';
    const only = planner.fileFromState(roomDir, RUN2, { approved: true, items: [fake] }, { approvedVia: 'cli' });
    if (only.ok !== false || only.reason !== 'no_items_selected') return 'canon-only: ' + JSON.stringify(only).slice(0, 300);
    const mixed = planner.fileFromState(roomDir, RUN2, { approved: true, items: ['run_home', fake, 'canon_translation:bbbbbbbbbbbb'] }, { approvedVia: 'cli' });
    return (mixed.ok === true && Array.isArray(mixed.ignored_items) && mixed.ignored_items.length === 2 && b.ok === true) || JSON.stringify(mixed).slice(0, 400);
  });

  await leg('R13 the recorded live answer (366-theo-replay) replays offline as a counted miss with the same audit shape', async function () {
    const fx = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests/fixtures/366-theo-replay/bottleneck-hunt.json'), 'utf8'));
    if (fx.schema !== 'mos.theo-replay/1' || !fx.responses || !Object.prototype.hasOwnProperty.call(fx.responses, TERM1)) return 'fixture shape';
    if (JSON.stringify(fx).indexOf('venture') !== -1 || JSON.stringify(Object.keys(fx.responses)) !== JSON.stringify([TERM1])) return 'fixture holds more than the term and the answer';
    const item = { id: canonRelease.termItemId(TERM1), kind: 'canon_release', term: TERM1, section: 'problem-definition', perspective: 'eureka', run_id: RUN1 };
    const replayCall = async function (tool, args) { calls.push({ tool: tool, args: args }); return Object.prototype.hasOwnProperty.call(fx.responses, args.raw) ? fx.responses[args.raw] : null; };
    const rowsBefore = canonTranslations.listRows(roomDir).length;
    const auditBefore = theoRows().length;
    const out = await canonRelease.answerRelease(roomDir, item, { sessionId: 'sess-replay', deps: { callTool: replayCall, transport: 'replay' } });
    const last = theoRows().slice(-1)[0];
    return (out.ok === true && out.outcome === 'miss' && out.proposed === false && out.release_miss === 1
      && canonTranslations.listRows(roomDir).length === rowsBefore && theoRows().length === auditBefore + 1
      && last.outcome === 'empty_valid' && JSON.stringify(Object.keys(last).sort()) === JSON.stringify(auditLedger.AUDIT_KEYS.slice().sort())) || JSON.stringify(out).slice(0, 400);
  });

  await leg('R11 the module reaches Theo by normalize_framework_name only and never offers a title', function () {
    const src = fs.readFileSync(path.join(RP, 'canon-release.cjs'), 'utf8');
    return ((src.match(/normalize_framework_name/g) || []).length >= 1 && !/brain_search|framework_search/.test(src) && dashFree(src)) || 'source check';
  });

  await leg('R12 the gate ledger gained only gates this test minted (no leak of the term into the ledger entries)', function () {
    const dump = JSON.stringify(Array.from(gateLedger._internal._ledger.values()).map(function (e) { return e.card; }));
    return (gateLedger._internal._ledger.size >= ledgerSizeBefore && dump.indexOf('Where the venture is stuck') === -1) || 'ledger';
  });

  const attempts = (net && typeof net.attempts === 'function') ? net.attempts() : ((net && Array.isArray(net.attempts)) ? net.attempts.length : 0);
  C.check('zero network attempts', attempts === 0, String(attempts));
  net.restore();
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
  process.exit(C.summary());
}

main().catch(function (e) {
  process.stderr.write('test crashed: ' + String(e && e.stack ? e.stack : e).slice(0, 600) + '\n');
  process.exit(1);
});
