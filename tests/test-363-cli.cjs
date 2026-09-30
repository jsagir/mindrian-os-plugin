'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363 Plan 15 -- the planner facade (lib/core/research-planner/
 * planner.cjs) and the JSON-only CLI door (scripts/research-planner.cjs).
 * Legs C1-C12, all offline.
 *
 * C1-C8 run the facade in-process under the net guard. C9-C12 spawn the CLI
 * with NODE_OPTIONS=--require <replay preload> (writeReplayPreload, 363-02), so
 * the child's fetch is the recorded OpenAlex replay and no leg needs the
 * network. Rooms come from fixture-room-363; question sets from
 * tests/fixtures/363-question-sets/. Each leg prints exactly one PASS or FAIL
 * line that starts with its leg name.
 *
 * No em-dash or en-dash literals: those characters are spelled with
 * String.fromCharCode. Exit 0 pass, 1 fail, 77 skip (fixtures absent).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-cli-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(__dirname, 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.OPENALEX_API_KEY;
delete process.env.OPENALEX_EMAIL;
const guard = hygiene.installNetGuard();
const { check, summary } = hygiene.makeChecker('363-15 planner facade and CLI door');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

let buildRoom363 = null;
let writeReplayPreload = null;
try {
  buildRoom363 = require(path.join(__dirname, 'helpers', 'fixture-room-363.cjs')).buildRoom363;
  writeReplayPreload = require(path.join(__dirname, 'helpers', 'openalex-replay-363.cjs')).writeReplayPreload;
} catch (_e) {
  console.log('SKIP: 363-02 helpers absent');
  process.exit(77);
}

const QS_DIR = path.join(ROOT, 'tests', 'fixtures', '363-question-sets');
function qsFile(name) { return JSON.parse(fs.readFileSync(path.join(QS_DIR, name + '.json'), 'utf8')); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }

const planMod = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'plan.cjs'));
const grants = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'grants.cjs'));
const auditLedger = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'audit-ledger.cjs'));
const structure = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'structure.cjs'));
const framing = require(path.join(ROOT, 'lib', 'core', 'ambient-framing.cjs'));
const navigation = require(path.join(ROOT, 'lib', 'core', 'navigation.cjs'));

const PLANNER_PATH = path.join(ROOT, 'lib', 'core', 'research-planner', 'planner.cjs');
const CLI_PATH = path.join(ROOT, 'scripts', 'research-planner.cjs');
let PLANNER = null;
let loadError = null;
try {
  PLANNER = require(PLANNER_PATH);
} catch (e) {
  loadError = e;
}

const VIA = { surface: 'cli', decision_node_id: 'd-363-15-test' };
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-cli-scratch-'));
const rooms = [];
function newRoom(role, extra) {
  const r = buildRoom363(Object.assign({ role: role || 'founder' }, extra || {}));
  rooms.push(r);
  try { fs.rmSync(path.join(TMP_HOME, '.mindrian'), { recursive: true, force: true }); } catch (_e) { /* ok */ }
  return r;
}

function runDir(room, runId) { return path.join(room.roomDir, '.mindrian', 'research-runs', runId); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeScratch(name, obj) {
  const file = path.join(SCRATCH, name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
  return file;
}
function roundOneHashes(plan) {
  const out = [];
  plan.leaves.forEach(function (l) {
    (l.queries || []).forEach(function (q) {
      if ((q.round === undefined || q.round === 1) && out.indexOf(q.q_hash) === -1) out.push(q.q_hash);
    });
  });
  return out;
}
function standingFor(room, terms) {
  const proposal = grants.buildStandingProposal(room.roomDir, { terms: terms });
  const w = grants.writeGrant(room.roomDir, proposal, { approved_via: VIA });
  if (!w.ok) throw new Error('grant failed: ' + JSON.stringify(w));
  return w.grant;
}
function optionIds(card) { return (card && card.options ? card.options : []).map(function (o) { return o.id; }); }

// -- spawned CLI helpers ------------------------------------------------------
const PRELOAD = writeReplayPreload(path.join(SCRATCH, 'preload'), {});
const ROUTE_ALL_DERIVATION = path.join(SCRATCH, 'route-derivation.cjs');
fs.writeFileSync(ROUTE_ALL_DERIVATION, 'module.exports = function route() { return \'derivation_hit\'; };\n', 'utf8');
const PRELOAD_DEEP = writeReplayPreload(path.join(SCRATCH, 'preload-deep'), { routeModulePath: ROUTE_ALL_DERIVATION });

function cli(args, opts) {
  const o = opts || {};
  const env = Object.assign({}, process.env, {
    HOME: TMP_HOME,
    USERPROFILE: TMP_HOME,
    NODE_OPTIONS: '--require ' + (o.preload || PRELOAD),
  });
  delete env.OPENALEX_API_KEY;
  delete env.OPENALEX_EMAIL;
  delete env.TYPESAFE_API_KEY;
  const res = spawnSync(process.execPath, [CLI_PATH].concat(args), { encoding: 'utf8', env: env, timeout: 90000 });
  let json = null;
  try { json = JSON.parse(String(res.stdout || '').trim()); } catch (_e) { json = null; }
  return { code: res.status, stdout: String(res.stdout || ''), stderr: String(res.stderr || ''), json: json };
}

// plan -> grant approve -> run-quick, all through the CLI.
function cliQuickRun(room) {
  const qsPath = writeScratch('qs-whitespace-' + path.basename(path.dirname(room.roomDir)) + '.json', qsFile('whitespace-quick'));
  const planned = cli(['plan', qsPath, '--room', room.roomDir, '--mode', 'quick']);
  if (planned.code !== 0 || !planned.json) return { error: 'plan failed: ' + planned.code + ' ' + planned.stdout.slice(0, 200) + planned.stderr.slice(0, 200) };
  const runId = planned.json.run_id;
  if (!planned.json.proposal) return { error: 'plan gave no grant proposal: ' + JSON.stringify(planned.json).slice(0, 200) };
  const proposalPath = writeScratch('proposal-' + runId + '.json', planned.json.proposal);
  const approved = cli(['grant', 'approve', proposalPath, '--room', room.roomDir, '--approved-via', 'cli']);
  if (approved.code !== 0) return { error: 'grant approve failed: ' + approved.code + ' ' + approved.stdout.slice(0, 200) };
  const ran = cli(['run-quick', runId, '--room', room.roomDir]);
  return { runId: runId, planned: planned, approved: approved, ran: ran };
}

async function leg(name, fn) {
  try {
    const r = await fn();
    if (r === undefined) return;
    check(name, r === true, String(r));
  } catch (e) {
    check(name, false, (e && e.stack) || String(e));
  }
}

const LEG_NAMES = [
  'C1 buildPlan',
  'C2 restated-only',
  'C3 audit-tripped slot',
  'C4 lens selection',
  'C5 cardFor',
  'C6 approvals',
  'C7 pending cards',
  'C8 nextMove',
  'C9 CLI quick end to end',
  'C10 CLI deep loop',
  'C11 argv hygiene',
  'C12 file-run gate',
];

async function main() {
  if (loadError || !fs.existsSync(CLI_PATH)) {
    // RED: name every leg as failing so the count is visible.
    const why = loadError ? loadError.message : 'scripts/research-planner.cjs missing';
    LEG_NAMES.forEach(function (n) { check(n + ' (facade and CLI door not built)', false, why); });
    check('net guard: zero network attempts', guard.attempts() === 0);
    return summary();
  }

  // C1: the facade assembles the plan the same way for every door.
  await leg('C1 buildPlan: ready plan saved, hashed, rung and structure and engine set', async function () {
    const founder = newRoom('founder');
    const r = await PLANNER.buildPlan(founder.roomDir, qsFile('map-unknowns'), { mode: 'deep' });
    if (r.status !== 'ready') return 'status ' + r.status + ' ' + JSON.stringify(r.errors);
    if (r.mode !== 'deep') return 'mode ' + r.mode;
    const file = path.join(runDir(founder, r.run_id), 'plan.json');
    if (!fs.existsSync(file)) return 'plan.json not saved';
    const saved = readJson(file);
    const v = planMod.validatePlan(saved);
    if (!v.ok) return 'saved plan invalid ' + JSON.stringify(v.errors);
    if (planMod.planHash(saved) !== saved.plan_hash) return 'plan hash does not validate';
    if (saved.context.rung !== framing.resolveRoomRung(founder.roomDir).rung) return 'rung not from resolveRoomRung ' + saved.context.rung;
    if (['theo_ledger', 'local_template'].indexOf(saved.structure.source) === -1) return 'structure source ' + saved.structure.source;
    if (typeof saved.structure.reason !== 'string' || saved.structure.reason.length === 0) return 'structure reason missing';
    if (saved.perspective.engine !== 'constraint-layer') return 'founder engine ' + saved.perspective.engine;
    const quick = await PLANNER.buildPlan(founder.roomDir, qsFile('whitespace-quick'), {});
    if (quick.mode !== 'quick') return 'default mode ' + quick.mode;

    const researcher = newRoom('researcher');
    const r2 = await PLANNER.buildPlan(researcher.roomDir, qsFile('map-unknowns'), { mode: 'deep' });
    const saved2 = readJson(path.join(runDir(researcher, r2.run_id), 'plan.json'));
    if (saved2.perspective.engine !== 'scientific-roadmapping') return 'researcher engine ' + saved2.perspective.engine;
    if (saved2.context.scientific.signals.indexOf('S2') === -1) return 'no S2 signal ' + JSON.stringify(saved2.context.scientific);
    return true;
  });

  // C2: a plan that only restates the navigator is not ready and offers no run.
  await leg('C2 restated-only: incomplete, D-00 named, card offers no run', async function () {
    const room = newRoom('founder');
    const r = await PLANNER.buildPlan(room.roomDir, qsFile('restated-only'), { mode: 'quick' });
    if (r.status !== 'incomplete') return 'status ' + r.status;
    if ((r.errors || []).indexOf('d00_failed') === -1) return 'D-00 not named ' + JSON.stringify(r.errors);
    const c = PLANNER.cardFor(room.roomDir, r.plan);
    if (!c.card) return 'no card';
    if (optionIds(c.card).indexOf('run') !== -1 || c.next === 'run_quick' || c.next === 'review') return 'offers a run: ' + c.next + ' ' + optionIds(c.card);
    return true;
  });

  // C3: an audit-tripping slot keeps that leaf in the room and builds the rest.
  await leg('C3 audit-tripped slot: leaf local only without the string, rest built', async function () {
    const room = newRoom('founder');
    const trip = 'reach me at jane.doe@example.com';
    const qs = qsFile('whitespace-quick');
    qs.leaves[0].slots = { term: trip };
    const r = await PLANNER.buildPlan(room.roomDir, qs, { mode: 'quick' });
    if (r.status !== 'ready') return 'status ' + r.status + ' ' + JSON.stringify(r.errors);
    const l1 = r.plan.leaves.filter(function (l) { return l.id === 'L1'; })[0];
    const l2 = r.plan.leaves.filter(function (l) { return l.id === 'L2'; })[0];
    if (l1.researchable !== false || !l1.not_researchable_reason) return 'L1 not local only';
    if (l2.queries.length === 0) return 'L2 has no queries';
    const blob = JSON.stringify(r) + fs.readFileSync(path.join(runDir(room, r.run_id), 'plan.json'), 'utf8');
    if (blob.indexOf('jane.doe') !== -1) return 'the tripped string survived into the plan or result';
    const room2 = newRoom('founder');
    const qs2 = qsFile('whitespace-quick');
    qs2.leaves[0].slots = { term: trip };
    qs2.leaves[1].slots = { term: trip, synonyms: ['dielectric probes'] };
    const r2 = await PLANNER.buildPlan(room2.roomDir, qs2, { mode: 'quick' });
    if (r2.status !== 'local_only') return 'both tripped: status ' + r2.status;
    return true;
  });

  // C4: the diffusion lens joins for a named reason, and its leaves are required.
  await leg('C4 lens selection: diffusion from larry, missing df leaves need lens leaves', async function () {
    const room = newRoom('researcher');
    const qs = qsFile('scientific-roadmapping');
    const r = await PLANNER.buildPlan(room.roomDir, qs, { mode: 'deep' });
    if (r.status !== 'ready') return 'status ' + r.status + ' ' + JSON.stringify(r.errors);
    const sel = r.lenses_selected || [];
    if (sel.length !== 1 || sel[0].lens !== 'diffusion' || sel[0].source !== 'larry') return 'lenses ' + JSON.stringify(sel);
    if (r.plan.pyramid.lenses_selected.indexOf('diffusion') === -1) return 'pyramid lenses_selected missing diffusion';
    const stripped = clone(qs);
    stripped.leaves = stripped.leaves.filter(function (l) { return String(l.dimension).indexOf('df:') !== 0; });
    const r2 = await PLANNER.buildPlan(room.roomDir, stripped, { mode: 'deep' });
    if (r2.status !== 'needs_lens_leaves') return 'stripped status ' + r2.status;
    return true;
  });

  // C5: cardFor picks the next honest move.
  await leg('C5 cardFor: covered quick runs bare, uncovered asks F.0, deep asks F.6', async function () {
    const room = newRoom('founder');
    const built = await PLANNER.buildPlan(room.roomDir, qsFile('whitespace-quick'), { mode: 'quick' });
    if (built.status !== 'ready') return 'quick plan ' + built.status;
    const none = PLANNER.cardFor(room.roomDir, built.plan);
    if (none.next !== 'grant' || !none.card || none.card.shape !== 'F.0' || none.reason !== 'no_grant') return 'no grant: ' + JSON.stringify({ n: none.next, r: none.reason });
    standingFor(room, [{ term: 'unrelated topic here', synonyms: [] }]);
    const missing = PLANNER.cardFor(room.roomDir, built.plan);
    if (missing.reason !== 'new_term' || !missing.card || missing.card.shape !== 'F.0') return 'missing term: ' + JSON.stringify({ n: missing.next, r: missing.reason });
    if ((missing.new_terms || []).indexOf('thin-film sensors') === -1 || missing.card.body_md.indexOf('thin-film sensors') === -1) return 'new term not listed';
    const room2 = newRoom('founder');
    const built2 = await PLANNER.buildPlan(room2.roomDir, qsFile('whitespace-quick'), { mode: 'quick' });
    standingFor(room2, [{ term: 'thin-film sensors', synonyms: ['dielectric probes'] }]);
    const covered = PLANNER.cardFor(room2.roomDir, built2.plan);
    if (covered.next !== 'run_quick' || covered.card) return 'covered: ' + JSON.stringify({ n: covered.next, r: covered.reason });
    const room3 = newRoom('researcher');
    const deep = await PLANNER.buildPlan(room3.roomDir, qsFile('scientific-roadmapping'), { mode: 'deep' });
    const dc = PLANNER.cardFor(room3.roomDir, deep.plan);
    if (dc.next !== 'review' || !dc.card || dc.card.shape !== 'F.6') return 'deep: ' + JSON.stringify({ n: dc.next });
    return true;
  });

  // C6: approvals are persisted and become decision nodes; nothing is fetched.
  await leg('C6 approvals: run grant and standing grant persist with decision nodes, no fetch, no filing', async function () {
    const room = newRoom('researcher');
    const built = await PLANNER.buildPlan(room.roomDir, qsFile('scientific-roadmapping'), { mode: 'deep' });
    const before = guard.attempts();
    const a = PLANNER.approvePlanReview(room.roomDir, built.run_id, { approvedVia: 'cli' });
    if (!a.ok) return 'approvePlanReview ' + JSON.stringify(a);
    const g = a.grant;
    if (g.lifetime !== 'run' || g.run_id !== built.run_id) return 'grant shape ' + g.lifetime;
    const want = roundOneHashes(built.plan).sort();
    const got = g.approved_hashes.slice().sort();
    if (want.length === 0 || JSON.stringify(want) !== JSON.stringify(got)) return 'approved hashes differ ' + want.length + ' vs ' + got.length;
    if (g.approved_via.surface !== 'cli' || !g.approved_via.decision_node_id) return 'approved_via not recorded';
    const hood = navigation.getRecentDecisionNeighborhood(room.roomDir, {});
    if (!hood.nodes.length || hood.nodes[0].id !== g.approved_via.decision_node_id) return 'decision node not readable through navigation';
    if (fs.existsSync(path.join(room.roomDir, 'research'))) return 'an approval filed something';
    if (auditLedger.readAudit(room.roomDir, { run_id: built.run_id }).length !== 0) return 'an approval fetched';
    if (guard.attempts() !== before) return 'an approval touched the network';

    const proposal = grants.buildStandingProposal(room.roomDir, { terms: [{ term: 'thin-film sensors', synonyms: ['dielectric probes'] }] });
    const s = PLANNER.approveStandingGrant(room.roomDir, proposal, { approvedVia: 'cli' });
    if (!s.ok) return 'approveStandingGrant ' + JSON.stringify(s);
    if (s.grant.lifetime !== 'standing' || s.grant.providers.join() !== 'openalex' || s.grant.families.join() !== 'whitespace-gap/v1') return 'standing scope';
    const hood2 = navigation.getRecentDecisionNeighborhood(room.roomDir, {});
    if (!hood2.nodes.length || hood2.nodes[0].id !== s.grant.approved_via.decision_node_id) return 'standing decision node not readable';
    const ext = PLANNER.approveStandingGrant(room.roomDir, proposal, { approvedVia: 'cli', terms: [{ term: 'ultrasonic biofilm removal', synonyms: [] }] });
    if (!ext.ok || ext.grant.version !== 2 || ext.grant.grant_id !== s.grant.grant_id) return 'terms did not extend the standing grant ' + JSON.stringify(ext);
    const notStanding = PLANNER.approveStandingGrant(room.roomDir, grants.buildRunGrant(built.plan), { approvedVia: 'cli' });
    if (notStanding.ok) return 'a run proposal was accepted as a standing grant';
    const noVia = PLANNER.approveStandingGrant(room.roomDir, proposal, {});
    if (noVia.ok) return 'approval without approvedVia accepted';
    return true;
  });

  // C7: room-started cards are surfaced once.
  await leg('C7 pending cards: surfaced once, filed runs skipped', async function () {
    const room = newRoom('founder');
    const runA = 'rp-2026-09-30-aaaa1111';
    const runB = 'rp-2026-09-30-bbbb2222';
    fs.mkdirSync(runDir(room, runA), { recursive: true });
    fs.mkdirSync(runDir(room, runB), { recursive: true });
    fs.writeFileSync(path.join(runDir(room, runA), 'card.json'), JSON.stringify({ shape: 'evidence', title: 'Evidence', body_md: 'x', options: [] }), 'utf8');
    fs.writeFileSync(path.join(runDir(room, runB), 'card.json'), JSON.stringify({ shape: 'evidence', title: 'Evidence', body_md: 'y', options: [] }), 'utf8');
    fs.writeFileSync(path.join(runDir(room, runB), 'filing.json'), JSON.stringify({ schema: 'mos.research-filing/1', run_id: runB, filed: true }), 'utf8');
    PLANNER.queuePendingCard(room.roomDir, { run_id: runA, kind: 'evidence' });
    PLANNER.queuePendingCard(room.roomDir, { run_id: runB, kind: 'evidence' });
    const first = PLANNER.pendingCards(room.roomDir);
    if (first.length !== 1 || first[0].run_id !== runA) return 'first read ' + JSON.stringify(first.map(function (c) { return c.run_id; }));
    if (!first[0].card || first[0].card.shape !== 'evidence') return 'card not attached';
    const again = PLANNER.pendingCards(room.roomDir);
    if (again.length !== 1) return 'reading must not surface: ' + again.length;
    PLANNER.markSurfaced(room.roomDir, runA);
    const after = PLANNER.pendingCards(room.roomDir);
    if (after.length !== 0) return 'still pending after markSurfaced: ' + after.length;
    return true;
  });

  // C8: the weakest branch yields one offered next move, or an honest none.
  await leg('C8 nextMove: weakest branch to the next framework, honest none otherwise', async function () {
    const room = newRoom('researcher');
    const built = await PLANNER.buildPlan(room.roomDir, qsFile('scientific-roadmapping'), { mode: 'deep' });
    const plan = clone(built.plan);
    plan.context.rung = 'IllDefined';
    const run = { run_id: plan.run_id, mode: 'deep', pyramid: clone(plan.pyramid) };
    run.pyramid.key_line.forEach(function (k) { k.status = 'supported'; k.support_count = 3; });
    const weak = run.pyramid.key_line.filter(function (k) { return k.dimension === 'sr:limiters'; })[0];
    weak.status = 'unresolved';
    weak.support_count = 0;
    const expected = structure.nextFramework({ lensFramework: 'Scientific Roadmapping', rung: 'IllDefined' });
    if (expected.none) return 'fixture assumption broke: ' + JSON.stringify(expected);
    const m = PLANNER.nextMove(room.roomDir, run, plan);
    if (m.none || m.framework !== expected.framework || m.command !== expected.command) return 'move ' + JSON.stringify(m);
    run.pyramid.key_line.forEach(function (k) { k.status = 'supported'; k.support_count = 3; });
    const strong = PLANNER.nextMove(room.roomDir, run, plan);
    if (strong.none !== true || !strong.reason) return 'no weak branch should be an honest none: ' + JSON.stringify(strong);
    weak.status = 'unresolved';
    const unknownRung = clone(plan);
    unknownRung.context.rung = 'unknown';
    const u = PLANNER.nextMove(room.roomDir, run, unknownRung);
    if (u.none !== true || !u.reason) return 'unknown rung should be an honest none: ' + JSON.stringify(u);
    return true;
  });

  // C9: the CLI drives a quick run from plan to filing on the replay.
  await leg('C9 CLI quick run: plan, grant approve, run-quick, basket, file-run, status, pending', async function () {
    const room = newRoom('founder');
    const q = cliQuickRun(room);
    if (q.error) return q.error;
    if (q.planned.json.next !== 'grant' || !q.planned.json.card || q.planned.json.card.shape !== 'F.0') return 'plan card ' + JSON.stringify(q.planned.json.next);
    if (q.ran.code !== 0 || !q.ran.json || q.ran.json.status !== 'done') return 'run-quick ' + q.ran.code + ' ' + q.ran.stdout.slice(0, 300);
    if (auditLedger.readAudit(room.roomDir, { run_id: q.runId }).length !== 3) return 'expected three audited searches';
    const basket = cli(['basket', q.runId, '--room', room.roomDir]);
    if (basket.code !== 0 || !basket.json || !basket.json.card) return 'basket ' + basket.code + ' ' + basket.stdout.slice(0, 300);
    const defaults = basket.json.card.payload.defaults;
    if (!Array.isArray(defaults) || defaults.length === 0) return 'no default items';
    const selPath = writeScratch('sel-c9.json', { approved: true, items: defaults });
    const filed = cli(['file-run', q.runId, selPath, '--room', room.roomDir, '--approved-via', 'cli']);
    if (filed.code !== 0 || !filed.json || filed.json.ok !== true || !filed.json.report) return 'file-run ' + filed.code + ' ' + filed.stdout.slice(0, 300);
    if (!fs.existsSync(path.join(runDir(room, q.runId), 'filing.json'))) return 'filing marker missing';
    const st = cli(['status', q.runId, '--room', room.roomDir]);
    if (st.code !== 0 || !st.json || st.json.stage !== 'filed') return 'status ' + st.stdout.slice(0, 200);
    const pend = cli(['pending', '--room', room.roomDir]);
    if (pend.code !== 0 || !pend.json || !Array.isArray(pend.json.cards)) return 'pending ' + pend.stdout.slice(0, 200);
    const planners = cli(['planners', '--room', room.roomDir]);
    if (planners.code !== 0 || !planners.json || !Array.isArray(planners.json.planners)) return 'planners ' + planners.stdout.slice(0, 200);
    const gs = cli(['grant', 'status', '--room', room.roomDir]);
    if (gs.code !== 0 || !gs.json) return 'grant status ' + gs.stdout.slice(0, 200);
    if (q.ran.stderr.trim() !== '' || filed.stderr.trim() !== '') return 'stderr carried text: ' + q.ran.stderr.slice(0, 100);
    return true;
  });

  // C10: the CLI drives a deep run step by step, then offers the basket.
  await leg('C10 CLI deep loop: plan, review approve, deep steps to done, basket', async function () {
    const room = newRoom('researcher');
    const qsPath = writeScratch('qs-sr.json', qsFile('scientific-roadmapping'));
    const planned = cli(['plan', qsPath, '--room', room.roomDir, '--mode', 'deep'], { preload: PRELOAD_DEEP });
    if (planned.code !== 0 || !planned.json || planned.json.next !== 'review' || !planned.json.card || planned.json.card.shape !== 'F.6') return 'plan ' + planned.code + ' ' + planned.stdout.slice(0, 300);
    const runId = planned.json.run_id;
    const noVia = cli(['review', 'approve', runId, '--room', room.roomDir], { preload: PRELOAD_DEEP });
    if (noVia.code !== 2) return 'review approve without --approved-via must exit 2, got ' + noVia.code;
    const appr = cli(['review', 'approve', runId, '--room', room.roomDir, '--approved-via', 'cli'], { preload: PRELOAD_DEEP });
    if (appr.code !== 0 || !appr.json || appr.json.ok !== true) return 'review approve ' + appr.code + ' ' + appr.stdout.slice(0, 300);
    const steps = [];
    let finished = false;
    for (let i = 0; i < 80 && !finished; i += 1) {
      const n = cli(['deep-next', runId, '--room', room.roomDir], { preload: PRELOAD_DEEP });
      if (n.code !== 0 || !n.json || n.json.ok !== true) return 'deep-next ' + n.code + ' ' + n.stdout.slice(0, 300);
      const step = n.json.step;
      steps.push(step);
      if (step === 'fetch_round') {
        const f = cli(['deep-fetch', runId, '--room', room.roomDir], { preload: PRELOAD_DEEP });
        if (f.code !== 0 || !f.json || f.json.ok !== true) return 'deep-fetch ' + f.code + ' ' + f.stdout.slice(0, 300);
      } else if (step === 'dispatch_lanes') {
        const lanes = n.json.payload.lanes;
        for (let j = 0; j < lanes.length; j += 1) {
          const p = lanes[j];
          const records = readJson(path.join(room.roomDir, p.records_path)).records;
          const rows = [{ leaf_id: p.leaves[0].leaf_id, record_id: records[0].id, claim: 'Model claim for ' + p.leaves[0].leaf_id, quote: records[0].title, label: 'supports' }];
          const rp = writeScratch('rows-' + runId + '-' + p.lane + '-' + i + '.json', rows);
          const rec = cli(['deep-record', runId, p.lane, rp, '--room', room.roomDir], { preload: PRELOAD_DEEP });
          if (rec.code !== 0 || !rec.json || rec.json.ok !== true) return 'deep-record ' + rec.code + ' ' + rec.stdout.slice(0, 300);
        }
      } else if (step === 'reflect') {
        const fp = writeScratch('followups-' + runId + '-' + i + '.json', []);
        const r = cli(['deep-followups', runId, fp, '--room', room.roomDir], { preload: PRELOAD_DEEP });
        if (r.code !== 0 || !r.json || r.json.ok !== true) return 'deep-followups ' + r.code + ' ' + r.stdout.slice(0, 300);
      } else if (step === 'extend_card') {
        const dp = writeScratch('decision-' + runId + '-' + i + '.json', { decision: 'stop' });
        const r = cli(['deep-extend', runId, dp, '--room', room.roomDir], { preload: PRELOAD_DEEP });
        if (r.code !== 0 || !r.json || r.json.ok !== true) return 'deep-extend ' + r.code + ' ' + r.stdout.slice(0, 300);
      } else if (step === 'counterevidence') {
        const ce = cli(['deep-counterevidence', runId, '--room', room.roomDir], { preload: PRELOAD_DEEP });
        if (ce.code !== 0 || !ce.json || ce.json.ok !== true) return 'deep-counterevidence ' + ce.code + ' ' + ce.stdout.slice(0, 300);
        if (ce.json.lane_payload) {
          const p = ce.json.lane_payload;
          const records = readJson(path.join(room.roomDir, p.records_path)).records;
          const rows = [{ leaf_id: p.leaves[0].leaf_id, record_id: records[0].id, claim: 'Counter claim', quote: records[0].title, label: 'contradicts' }];
          const rp = writeScratch('rows-ce-' + runId + '.json', rows);
          const rec = cli(['deep-record', runId, 'CE', rp, '--room', room.roomDir], { preload: PRELOAD_DEEP });
          if (rec.code !== 0 || !rec.json || rec.json.ok !== true) return 'deep-record CE ' + rec.code + ' ' + rec.stdout.slice(0, 300);
        }
      } else if (step === 'synthesize') {
        const s = cli(['deep-synthesize', runId, '--room', room.roomDir], { preload: PRELOAD_DEEP });
        if (s.code !== 0 || !s.json || s.json.ok !== true) return 'deep-synthesize ' + s.code + ' ' + s.stdout.slice(0, 300);
        finished = true;
      } else if (step === 'done') {
        finished = true;
      }
    }
    if (!finished) return 'loop did not finish: ' + steps.join(',');
    if (steps.indexOf('counterevidence') === -1) return 'counterevidence pass skipped: ' + steps.join(',');
    if (!fs.existsSync(path.join(runDir(room, runId), 'run.json'))) return 'run.json missing';
    const basket = cli(['basket', runId, '--room', room.roomDir], { preload: PRELOAD_DEEP });
    if (basket.code !== 0 || !basket.json || !basket.json.card || !Array.isArray(basket.json.items)) return 'basket ' + basket.code + ' ' + basket.stdout.slice(0, 300);
    const nf = cli(['next-framework', runId, '--room', room.roomDir], { preload: PRELOAD_DEEP });
    if (nf.code !== 0 || !nf.json || (nf.json.none !== true && !nf.json.framework)) return 'next-framework ' + nf.stdout.slice(0, 200);
    const st = cli(['status', runId, '--room', room.roomDir], { preload: PRELOAD_DEEP });
    if (st.code !== 0 || !st.json || st.json.stage !== 'done') return 'status ' + st.stdout.slice(0, 200);
    return true;
  });

  // C11: no free text on argv, ever.
  await leg('C11 argv hygiene: free text refused with exit 2, marker never printed', async function () {
    const room = newRoom('founder');
    const marker = room.marker;
    const qsPath = writeScratch('qs-c11.json', qsFile('whitespace-quick'));
    const txt = path.join(SCRATCH, 'not-json.txt');
    fs.writeFileSync(txt, 'plain text ' + marker, 'utf8');
    const attempts = [
      ['plan', 'Is anyone covering ' + marker + ' in the literature', '--room', room.roomDir],
      ['plan', qsPath, '--room', room.roomDir, '--mode', marker],
      ['plan', qsPath, '--room', room.roomDir + '/' + marker],
      ['plan', qsPath, '--room', room.roomDir, '--section', 'x ' + marker],
      ['plan', txt, '--room', room.roomDir],
      ['plan', qsPath, '--room', room.roomDir, '--bogus-flag'],
      ['status', marker, '--room', room.roomDir],
      ['pending', marker, '--room', room.roomDir],
      [marker],
      ['some free text here'],
    ];
    for (let i = 0; i < attempts.length; i += 1) {
      const r = cli(attempts[i]);
      if (r.code !== 2) return 'attempt ' + i + ' exit ' + r.code + ' ' + r.stdout.slice(0, 120);
      if (!r.json || r.json.ok !== false || typeof r.json.reason !== 'string') return 'attempt ' + i + ' has no typed reason';
      if ((r.stdout + r.stderr).indexOf(marker) !== -1) return 'attempt ' + i + ' echoed the marker';
      if ((r.stdout + r.stderr).indexOf('free text here') !== -1) return 'attempt ' + i + ' echoed a token';
    }
    const plain = cli(['some free text here']);
    if (plain.json.reason !== 'free_text_argv_refused') return 'plain free text reason ' + plain.json.reason;
    const ok = cli(['plan', qsPath, '--room', room.roomDir, '--mode', 'quick']);
    if (ok.code !== 0) return 'a clean plan call was refused: ' + ok.stdout.slice(0, 200);
    if ((ok.stderr).indexOf(marker) !== -1) return 'stderr carried room prose';
    return true;
  });

  // C12: filing needs an explicit approval on the command line and in the file.
  await leg('C12 file-run gate: no --approved-via, approved false, or a grant selection writes nothing', async function () {
    const room = newRoom('founder');
    const q = cliQuickRun(room);
    if (q.error) return q.error;
    if (!q.ran.json || q.ran.json.status !== 'done') return 'quick run did not finish';
    const basket = cli(['basket', q.runId, '--room', room.roomDir]);
    const defaults = basket.json.card.payload.defaults;
    function nothingWritten() {
      return !fs.existsSync(path.join(room.roomDir, 'research')) && !fs.existsSync(path.join(runDir(room, q.runId), 'filing.json'));
    }
    const okSel = writeScratch('sel-c12-ok.json', { approved: true, items: defaults });
    const noVia = cli(['file-run', q.runId, okSel, '--room', room.roomDir]);
    if (noVia.code !== 2 || !noVia.json || noVia.json.ok !== false) return 'no --approved-via exit ' + noVia.code;
    if (!nothingWritten()) return 'no --approved-via wrote something';
    const notApproved = writeScratch('sel-c12-no.json', { approved: false, items: defaults });
    const r2 = cli(['file-run', q.runId, notApproved, '--room', room.roomDir, '--approved-via', 'cli']);
    if (r2.code !== 2 || !r2.json || r2.json.ok !== false) return 'approved:false exit ' + r2.code;
    if (!nothingWritten()) return 'approved:false wrote something';
    const grantSel = writeScratch('sel-c12-grant.json', { approved: true, items: defaults, grant_id: 'g-deadbeef' });
    const r3 = cli(['file-run', q.runId, grantSel, '--room', room.roomDir, '--approved-via', 'cli']);
    if (r3.code !== 2 || !r3.json || r3.json.reason !== 'grant_not_authority') return 'grant selection ' + r3.code + ' ' + (r3.json && r3.json.reason);
    if (!nothingWritten()) return 'a grant selection wrote something';
    return true;
  });

  // the em-dash rule holds for the files this plan writes
  await leg('C-dash the facade, the CLI and this test carry no em-dash or en-dash', async function () {
    const files = [PLANNER_PATH, CLI_PATH, __filename];
    for (let i = 0; i < files.length; i += 1) {
      const text = fs.readFileSync(files[i], 'utf8');
      if (text.indexOf(EM) !== -1 || text.indexOf(EN) !== -1) return 'dash character in ' + path.basename(files[i]);
    }
    return true;
  });

  check('net guard: zero network attempts', guard.attempts() === 0, String(guard.attempts()));
  return summary();
}

main().then(function (code) {
  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* ok */ } });
  try { fs.rmSync(SCRATCH, { recursive: true, force: true }); } catch (_e) { /* ok */ }
  try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_e) { /* ok */ }
  process.exit(code);
}).catch(function (e) {
  console.log('FAIL: test crashed (' + ((e && e.stack) || e) + ')');
  process.exit(1);
});
