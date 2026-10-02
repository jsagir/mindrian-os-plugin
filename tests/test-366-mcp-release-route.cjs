#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Quick 261002-cud Task 1 (EPV366-18, 366-11 deferred item): the MCP research_run basket mints a
 * session-keyed release gate for each unresolved room framework word, and the navigator's release
 * answer goes through the real gate_answer tool to canon-release's releaseTerm.
 *
 *   C1   replay transport on, theo line on: op basket lists one release offer with a minted gate id and
 *        an F.8 card (release / not_now); canon ids never appear on the filing gate or in items
 *   C1b  a session-less caller also gets a release gate id
 *   C2   nothing answered yet: zero theo audit rows
 *   C3   gate_answer release + approve sends exactly {raw: term} once; guard navigator_released
 *   C4   exactly one 23-key audit row (q the term, grant_id the gate id, part8_verdict pass, transport replay)
 *   C5   one PROPOSED translation row; the next basket lists it under confirm_items, not as an offer
 *   C6   a second answer on the same gate is refused and writes nothing more
 *   C7   not_now / reject sends nothing
 *   C8   an answer from another session sends nothing
 *   C9   no replay and no MOS_366_LIVE: no gate, live_not_enabled with the hint, nothing sent
 *   C10  theo line off: no gate, egress_line_off with the off note
 *   C11  transportFromEnv unit legs
 *   C12  zero network attempts; no em-dash or en-dash in the touched files
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are temp dirs, and the session and MOS_366_* env are
 * cleared BEFORE any repo module loads. The Theo answer comes from a recorded replay file. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-cud-rel-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-cud-rel-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;
delete process.env.OPENALEX_API_KEY;
delete process.env.OPENALEX_EMAIL;
delete process.env.MOS_366_LIVE;
delete process.env.MOS_366_THEO_REPLAY;

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('ENV GAP: node:sqlite unavailable (node ' + process.version + '); need node >= 22\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-366-mcp-release-route');

const { buildPerspectiveRoom } = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const RP = path.join(REPO_ROOT, 'lib/core/research-planner');
const Y = require(path.join(RP, 'pyramid.cjs'));
const planMod = require(path.join(RP, 'plan.cjs'));
const planner = require(path.join(RP, 'planner.cjs'));
const auditLedger = require(path.join(RP, 'audit-ledger.cjs'));
const recall = require(path.join(RP, 'perspectives/eureka-recall.cjs'));
const canonRelease = require(path.join(RP, 'canon-release.cjs'));
const canonTranslations = require(path.join(REPO_ROOT, 'lib/core/canon-translations.cjs'));
const jtbdState = require(path.join(REPO_ROOT, 'lib/hmi/jtbd-state.cjs'));
const roomDbMod = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
const { insertNode } = require(path.join(REPO_ROOT, 'lib/core/node-insert.cjs'));
const { registerCoreTools } = require(path.join(REPO_ROOT, 'lib/mcp/register-core-tools.cjs'));

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-cud-rel-'));
const TAG = '20261002T120000Z';
const RS = 'Reverse Salient Analysis';
const GATE_RE = /^gate-[0-9a-f]{16}$/;
const ITEM_RE = /^canon_term:[0-9a-f]{12}$/;
const TERM1 = 'Bottleneck Hunt';
const TERM2 = 'Zorp Method';
const HIT = { canonical: RS, matched_via: 'alias', coverage: { status: 'complete', matched: 1, total: 149 } };

function leg(name, fn) {
  return Promise.resolve().then(fn).then(function (ok) {
    C.check(name, ok === true, ok === true ? '' : String(ok));
  }, function (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 500));
  });
}
const DASH_RE = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']');
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function samePair(p, a, b) { return !!p && ((p.a === a && p.b === b) || (p.a === b && p.b === a)); }

// ---------------------------------------------------------------------------
// the room: two things that carry a room word as their framework, then two runs
// ---------------------------------------------------------------------------
const built = buildPerspectiveRoom(path.join(root, 'r1'));
const roomDir = built.roomDir;
const EU = built.planted.eureka;
(function addThings() {
  const db = roomDbMod.openRoomDb(roomDir);
  try {
    insertNode(db, 'pd/BH1', 'Artifact', JSON.stringify({ section: 'problem-definition', title: 'Where the venture is stuck', framework: TERM1, body: 'The slowest stage limits every other stage.' }), { source_path: 'test:cud', epistemic_type: 'observation' });
    insertNode(db, 'pd/ZM1', 'Artifact', JSON.stringify({ section: 'problem-definition', title: 'A second stuck place', framework: TERM2, body: 'Another unmatched room word.' }), { source_path: 'test:cud', epistemic_type: 'observation' });
  } finally { roomDbMod.closeRoomDb(db); }
})();

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

// the recorded Theo answers (the replay file shape the CLI door already reads)
const REPLAY = path.join(root, 'theo-replay.json');
fs.writeFileSync(REPLAY, JSON.stringify({ schema: 'mos.theo-replay/1', responses: { [TERM1]: HIT, [TERM2]: {} } }));

// ---------------------------------------------------------------------------
// the MCP seam (the real research_run and the real gate_answer share one ledger)
// ---------------------------------------------------------------------------
function parse(raw) {
  const text = raw && raw.content && raw.content[0] && raw.content[0].text;
  try { return JSON.parse(text); } catch (_e) { return { _unparsed: String(text).slice(0, 300) }; }
}
function boot() {
  const captured = new Map();
  const stub = {
    tool: function (name, _d, _s, fn) { captured.set(name, { handler: fn }); },
    registerTool: function (name, cfg, fn) { captured.set(name, { description: cfg && cfg.description, schema: cfg && cfg.inputSchema, handler: fn }); },
  };
  registerCoreTools(stub, { fallbackRoomDir: roomDir, pluginRoot: REPO_ROOT, surface: 'desktop' });
  return captured;
}
const captured = boot();
function client(sessionId) {
  const extra = sessionId === null ? {} : { sessionId: sessionId };
  return {
    call: async function (input) { return parse(await captured.get('research_run').handler(input, extra)); },
    answer: async function (gateId, chosen, verdict) { return parse(await captured.get('gate_answer').handler({ gate_id: gateId, chosen: chosen, verdict: verdict }, extra)); },
  };
}
const A = client('sess-cud-a');
const B = client('sess-cud-b');
const NOSESS = client(null);

function theoRows() {
  return auditLedger.readAudit(roomDir).filter(function (r) { return r.provider === 'theo' && r.template_id === 'canon-translation'; });
}
function offerFor(basket, term) { return (basket.release_offers || []).filter(function (o) { return o.term === term; })[0]; }
function setReplay() { process.env.MOS_366_THEO_REPLAY = REPLAY; }
function clearTransport() { delete process.env.MOS_366_THEO_REPLAY; delete process.env.MOS_366_LIVE; }
function writePolicy(body) {
  const pol = path.join(roomDir, '.mindrian', 'egress-policy.json');
  fs.mkdirSync(path.dirname(pol), { recursive: true });
  fs.writeFileSync(pol, JSON.stringify(body));
}
function removePolicy() { try { fs.unlinkSync(path.join(roomDir, '.mindrian', 'egress-policy.json')); } catch (_e) { /* absent */ } }
function filingOptionIds(basket) {
  const g = basket && basket.gate;
  const opts = (g && (g.options || (g.card && g.card.options))) || [];
  return opts.map(function (o) { return o.id; });
}

(async function main() {
  if (!RUN1 || !RUN2) {
    C.check('C0 the plans were built', false, 'plan1 ' + JSON.stringify(plan1 && plan1.errors) + ' plan2 ' + JSON.stringify(plan2 && plan2.errors));
    net.restore();
    process.exit(C.summary());
    return;
  }
  jtbdState.setCurrent(roomDir, { jtbd: 'find-bottleneck', confidence: 0.9, trigger: 'test', manual: true });

  let basket1 = null;
  let gate1 = null;
  await leg('C1 replay on, theo line on: one release offer with a minted gate id and an F.8 card; canon ids stay off the filing gate', async function () {
    setReplay();
    try { basket1 = await A.call({ op: 'basket', run_id: RUN1 }); } finally { clearTransport(); }
    if (basket1.ok !== true) return 'basket: ' + JSON.stringify(basket1).slice(0, 300);
    const offers = basket1.release_offers;
    if (!Array.isArray(offers) || offers.length !== 1) return 'offers: ' + JSON.stringify(offers).slice(0, 300);
    const o = offers[0];
    gate1 = o.gate_id;
    const optIds = o.card && Array.isArray(o.card.options) ? o.card.options.map(function (x) { return x.id; }) : [];
    const canonOnFiling = filingOptionIds(basket1).concat((basket1.items || []).map(function (i) { return i.id; })).some(function (id) { return /^canon_/.test(String(id)); });
    return (o.term === TERM1 && ITEM_RE.test(o.item_id) && GATE_RE.test(o.gate_id) && o.card.shape === 'F.8'
      && JSON.stringify(optIds) === JSON.stringify(['release', 'not_now']) && o.unavailable_reason === null
      && !canonOnFiling && Array.isArray(basket1.confirm_items) && basket1.confirm_items.length === 0) || JSON.stringify(basket1).slice(0, 500);
  });

  await leg('C1b a session-less caller also gets a release gate id', async function () {
    setReplay();
    let b = null;
    try { b = await NOSESS.call({ op: 'basket', run_id: RUN2 }); } finally { clearTransport(); }
    const o = b && offerFor(b, TERM2);
    return (!!o && GATE_RE.test(o.gate_id)) || JSON.stringify(b).slice(0, 400);
  });

  await leg('C2 nothing answered yet: zero theo audit rows', function () {
    return theoRows().length === 0 || 'rows ' + theoRows().length;
  });

  let ans1 = null;
  await leg('C3 gate_answer release + approve sends exactly {raw: term} once; navigator_released', async function () {
    ans1 = await A.answer(gate1, ['release'], 'approve');
    const cr = ans1 && ans1.chain_result;
    return (ans1.resumed === true && !!cr && cr.ok === true && cr.executed === true && JSON.stringify(cr.sent) === JSON.stringify({ raw: TERM1 })
      && cr.guard && cr.guard.class === 'navigator_released' && cr.outcome === 'hit' && cr.proposed === true && cr.canon_name === RS) || JSON.stringify(ans1).slice(0, 600);
  });

  await leg('C4 one 23-key audit row for the release', function () {
    const rows = theoRows();
    if (rows.length !== 1) return 'rows ' + rows.length;
    const r = rows[0];
    return (JSON.stringify(Object.keys(r).sort()) === JSON.stringify(auditLedger.AUDIT_KEYS.slice().sort())
      && r.q === TERM1 && r.grant_id === gate1 && r.part8_verdict === 'pass' && r.filters && r.filters.transport === 'replay') || JSON.stringify(r);
  });

  await leg('C5 one PROPOSED row; the next basket lists it under confirm_items, not as an offer', async function () {
    const rows = canonTranslations.listRows(roomDir).filter(function (r) { return r.term === TERM1; });
    if (rows.length !== 1 || rows[0].ratified_at !== null || rows[0].canon_name !== RS) return 'rows ' + JSON.stringify(rows);
    setReplay();
    let b = null;
    try { b = await A.call({ op: 'basket', run_id: RUN1 }); } finally { clearTransport(); }
    const c = (b.confirm_items || [])[0];
    return (!offerFor(b, TERM1) && !!c && c.term === TERM1 && c.canon_name === RS && /canon-confirm/.test(String(c.next_step))) || JSON.stringify(b).slice(0, 500);
  });

  await leg('C6 a second answer on the same gate is refused and writes nothing more', async function () {
    const again = await A.answer(gate1, ['release'], 'approve');
    return (again.ok === false && again.reason === 'unknown_or_expired_gate' && theoRows().length === 1) || JSON.stringify(again).slice(0, 300);
  });

  await leg('C7 not_now / reject sends nothing', async function () {
    setReplay();
    let b = null;
    try { b = await A.call({ op: 'basket', run_id: RUN2 }); } finally { clearTransport(); }
    const o = offerFor(b, TERM2);
    if (!o || !GATE_RE.test(o.gate_id)) return 'no gate ' + JSON.stringify(b).slice(0, 300);
    const before = theoRows().length;
    const out = await A.answer(o.gate_id, ['not_now'], 'reject');
    return ((!out.chain_result || out.chain_result.executed === false) && theoRows().length === before) || JSON.stringify(out).slice(0, 400);
  });

  await leg('C8 an answer from another session sends nothing', async function () {
    setReplay();
    let b = null;
    try { b = await A.call({ op: 'basket', run_id: RUN2 }); } finally { clearTransport(); }
    const o = offerFor(b, TERM2);
    if (!o || !GATE_RE.test(o.gate_id)) return 'no gate ' + JSON.stringify(b).slice(0, 300);
    const before = theoRows().length;
    const out = await B.answer(o.gate_id, ['release'], 'approve');
    return (out.ok === false && theoRows().length === before) || JSON.stringify(out).slice(0, 400);
  });

  await leg('C9 no replay and no MOS_366_LIVE: no gate, live_not_enabled with the hint, nothing sent', async function () {
    clearTransport();
    const before = theoRows().length;
    const b = await A.call({ op: 'basket', run_id: RUN2 });
    const o = offerFor(b, TERM2);
    return (!!o && o.gate_id === null && o.unavailable_reason === 'live_not_enabled' && /MOS_366_LIVE=1/.test(String(o.note)) && theoRows().length === before)
      || JSON.stringify(o);
  });

  await leg('C10 theo line off: no gate, egress_line_off with the off note', async function () {
    setReplay();
    writePolicy({ lines: { theo: false } });
    let b = null;
    try { b = await A.call({ op: 'basket', run_id: RUN2 }); } finally { removePolicy(); clearTransport(); }
    const o = offerFor(b, TERM2);
    return (!!o && o.gate_id === null && o.unavailable_reason === 'egress_line_off' && String(o.note).indexOf(canonRelease.OFF_NOTE) !== -1) || JSON.stringify(o);
  });

  await leg('C11 transportFromEnv unit legs', async function () {
    if (typeof canonRelease.transportFromEnv !== 'function') return 'transportFromEnv is not exported';
    const none = canonRelease.transportFromEnv({});
    const live = canonRelease.transportFromEnv({ MOS_366_LIVE: '1' });
    const missing = canonRelease.transportFromEnv({ MOS_366_THEO_REPLAY: path.join(root, 'no-such-file.json') });
    const rep = canonRelease.transportFromEnv({ MOS_366_THEO_REPLAY: REPLAY });
    if (!(none.ok === false && none.reason === 'live_not_enabled' && typeof none.hint === 'string')) return 'none ' + JSON.stringify(none);
    if (!(live.ok === true && live.deps && live.deps.transport === 'live' && live.deps.callTool === undefined)) return 'live ' + JSON.stringify(live);
    if (!(missing.ok === false && missing.reason === 'replay_unreadable')) return 'missing ' + JSON.stringify(missing);
    if (!(rep.ok === true && rep.deps.transport === 'replay' && typeof rep.deps.callTool === 'function')) return 'replay ' + JSON.stringify(rep);
    const other = await rep.deps.callTool('search_something', { raw: TERM1 });
    const absent = await rep.deps.callTool('normalize_framework_name', { raw: 'Not In The File' });
    const found = await rep.deps.callTool('normalize_framework_name', { raw: TERM1 });
    return (other === null && absent === null && found && found.canonical === RS) || JSON.stringify([other, absent, found]);
  });

  await leg('C12 zero network attempts; no em-dash or en-dash in the touched files', function () {
    const files = ['lib/mcp/tools/research.cjs', 'lib/core/research-planner/canon-release.cjs', 'scripts/research-planner.cjs', 'tests/test-366-mcp-release-route.cjs'];
    const dirty = files.filter(function (f) { return DASH_RE.test(fs.readFileSync(path.join(REPO_ROOT, f), 'utf8')); });
    return (net.attempts() === 0 && dirty.length === 0) || 'attempts ' + net.attempts() + ' dash in ' + dirty.join(',');
  });

  net.restore();
  process.exit(C.summary());
})();
