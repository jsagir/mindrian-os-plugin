#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 17 (EPV366-22, ADR-E16): one declared egress policy, read by the audit ledger.
 *
 *   E1   loadEgressPolicy(roomDir) returns the seven lines with the planning defaults
 *   E2   a room override can turn research off; one that sets judge_jev true is ignored and reported
 *   E3   loadEgressPolicy(roomDir, {offline:true}) returns every line off
 *   E4   lineForProvider maps openalex, theo, typesafe, anthropic, huggingface; unknown is null
 *   E4b  provider sweep: every provider string the planner can write maps to a line
 *   E5   appendAudit for openalex with research off returns egress_line_off and writes nothing
 *   E6   a malformed override file is ignored, named in policy.ignored, never throws
 *   E7   run-quick with the research line off makes zero fetches and answers plan only, not sent
 *   E8   the CLI --offline chain (recall, judge, run-quick) completes with exit 0, nothing sent
 *   E9   with the theo line off the lane makes zero calls and its leaves report the off line
 *   E10  the default policy keeps research on per grant: the run fetches and audits as before
 *
 * Isolation: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at temp dirs and the session env is
 * cleared BEFORE any repo module loads. No live network. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-egress-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-egress-roomshome-'));
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
const C = hygiene.makeChecker('test-366-egress-policy');

const RP = path.join(REPO_ROOT, 'lib/core/research-planner');
const auditLedger = require(path.join(RP, 'audit-ledger.cjs'));
const grants = require(path.join(RP, 'grants.cjs'));
let egress = null;
let egressLoadError = null;
try { egress = require(path.join(RP, 'egress-policy.cjs')); } catch (e) { egressLoadError = e; }

const { spawnSync } = require('node:child_process');
const { buildPerspectiveRoom } = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const planner = require(path.join(RP, 'planner.cjs'));
const quick = require(path.join(RP, 'quick.cjs'));
const theoLane = require(path.join(RP, 'theo-lane.cjs'));
const eurekaRecall = require(path.join(RP, 'perspectives/eureka-recall.cjs'));
const cnRecall = require(path.join(RP, 'perspectives/connections-recall.cjs'));
const CLI = path.join(REPO_ROOT, 'scripts', 'research-planner.cjs');
const VIA = { surface: 'cli', decision_node_id: 'decision:366-17-test' };

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-egress-'));
let seq = 0;

function leg(name, fn) {
  return Promise.resolve().then(fn).then(function (ok) {
    C.check(name, ok === true, ok === true ? '' : String(ok));
  }, function (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 500));
  });
}
function mkRoom() {
  seq += 1;
  const dir = path.join(root, 'room' + seq);
  fs.mkdirSync(path.join(dir, '.mindrian'), { recursive: true });
  return dir;
}
function writeOverride(roomDir, body) {
  fs.writeFileSync(path.join(roomDir, '.mindrian', 'egress-policy.json'), typeof body === 'string' ? body : JSON.stringify(body), 'utf8');
}
function auditRecord(provider) {
  return {
    ts: '2026-10-02T12:00:00.000Z', run_id: 'run-x', grant_id: 'grant-x', grant_version: 1,
    q: 'adaptive routing', q_hash: 'sha256:abc', template_id: 'eureka', family: 'concept-evidence/v1',
    part8_verdict: 'pass', provider: provider, filters: {}, pagination: { per_page: 5, page: 1 },
    fallback_used: false, origin_ref: 'run-x/l1', result_ids: [], content_hashes: [], outcome: 'ok',
    failure_class: null, count: 0, cost_usd: null, remaining_usd: null, x_query: null, latency_ms: 1,
  };
}
const LINES = ['vector_model_download', 'judge_jev', 'research', 'citation_check', 'prose', 'theo', 'entity_extraction'];
const DEFAULTS = { vector_model_download: false, judge_jev: false, research: true, citation_check: false, prose: true, theo: true, entity_extraction: false };

(async function main() {
  await leg('E0 the reader module loads', function () {
    if (egressLoadError) return 'load: ' + String(egressLoadError.message).slice(0, 160);
    return (typeof egress.loadEgressPolicy === 'function' && typeof egress.lineAllowed === 'function' && typeof egress.lineForProvider === 'function') || 'exports missing';
  });
  if (!egress) {
    C.check('zero network attempts', net.attempts() === 0, String(net.attempts()));
    process.exit(C.summary());
  }

  // ----- E1 -----
  await leg('E1 loadEgressPolicy returns the seven lines with the planning defaults', function () {
    const room = mkRoom();
    const p = egress.loadEgressPolicy(room);
    const names = Object.keys(p.lines).sort().join(',');
    const defaultsOk = LINES.every(function (l) { return egress.lineAllowed(p, l) === DEFAULTS[l]; });
    const fileCount = Object.keys(require(path.join(REPO_ROOT, 'data/egress-policy.json')).lines).length;
    return (names === LINES.slice().sort().join(',') && defaultsOk && fileCount === 7 && p.offline === false && Array.isArray(p.ignored) && p.ignored.length === 0) ||
      JSON.stringify({ names: names, defaultsOk: defaultsOk, fileCount: fileCount, ignored: p.ignored });
  });
  await leg('E1b a line with no entry (or a null line) is never allowed', function () {
    const p = egress.loadEgressPolicy(mkRoom());
    return (egress.lineAllowed(p, 'no_such_line') === false && egress.lineAllowed(p, null) === false && egress.lineAllowed(null, 'research') === false) || 'unknown line allowed';
  });

  // ----- E2 -----
  await leg('E2 a room override can turn research off; judge_jev true cannot widen and is reported', function () {
    const room = mkRoom();
    writeOverride(room, { schema: 'mos.egress-policy/1', lines: { research: { default: false }, judge_jev: { default: true } } });
    const p = egress.loadEgressPolicy(room);
    const named = p.ignored.some(function (x) { return /judge_jev/.test(String(x)); });
    return (egress.lineAllowed(p, 'research') === false && egress.lineAllowed(p, 'judge_jev') === false && egress.lineAllowed(p, 'theo') === true && named) ||
      JSON.stringify({ research: egress.lineAllowed(p, 'research'), jev: egress.lineAllowed(p, 'judge_jev'), ignored: p.ignored });
  });
  await leg('E2b a bare boolean override works the same; an unknown line is ignored and named', function () {
    const room = mkRoom();
    writeOverride(room, { lines: { theo: false, mystery: true } });
    const p = egress.loadEgressPolicy(room);
    return (egress.lineAllowed(p, 'theo') === false && p.ignored.some(function (x) { return /mystery/.test(String(x)); })) || JSON.stringify(p.ignored);
  });

  // ----- E3 -----
  await leg('E3 offline returns every line off', function () {
    const p = egress.loadEgressPolicy(mkRoom(), { offline: true });
    return (p.offline === true && LINES.every(function (l) { return egress.lineAllowed(p, l) === false; })) || JSON.stringify(Object.keys(p.lines).map(function (l) { return l + ':' + egress.lineAllowed(p, l); }));
  });

  // ----- E4 -----
  await leg('E4 lineForProvider maps the vendors and is null for an unknown one', function () {
    const got = ['openalex', 'theo', 'typesafe', 'anthropic', 'huggingface'].map(egress.lineForProvider).join(',');
    return (got === 'research,theo,judge_jev,prose,vector_model_download' && egress.lineForProvider('bogus-vendor') === null && egress.lineForProvider(undefined) === null) || got;
  });
  await leg('E4b every provider string the planner can write maps to a non-null line', function () {
    const found = {};
    (function walk(dir) {
      fs.readdirSync(dir, { withFileTypes: true }).forEach(function (d) {
        const f = path.join(dir, d.name);
        if (d.isDirectory()) { walk(f); return; }
        if (!/\.cjs$/.test(d.name) || d.name === 'egress-policy.cjs') return;
        const src = fs.readFileSync(f, 'utf8');
        let m;
        const a = /PROVIDER\s*=\s*'([^']+)'/g;
        while ((m = a.exec(src))) found[m[1]] = path.relative(RP, f);
        const b = /\bprovider:\s*'([^']+)'/g;
        while ((m = b.exec(src))) found[m[1]] = path.relative(RP, f);
      });
    })(RP);
    grants.STANDING_SCOPE.providers.forEach(function (p) { found[p] = 'grants.STANDING_SCOPE'; });
    found[grants.THEO_PROVIDER] = 'grants.THEO_PROVIDER';
    const missing = Object.keys(found).filter(function (p) { return egress.lineForProvider(p) === null; });
    return (Object.keys(found).length >= 2 && missing.length === 0) || 'no policy entry for provider(s): ' + missing.map(function (p) { return p + ' (' + found[p] + ')'; }).join(', ');
  });

  // ----- E5 -----
  await leg('E5 appendAudit refuses an off line with egress_line_off and writes nothing', function () {
    const room = mkRoom();
    writeOverride(room, { lines: { research: { default: false } } });
    const res = auditLedger.appendAudit(room, auditRecord('openalex'));
    const wrote = fs.existsSync(path.join(room, '.mindrian', 'research-audit.jsonl'));
    return (res.ok === false && res.reason === 'egress_line_off' && !wrote) || JSON.stringify({ res: res, wrote: wrote });
  });
  await leg('E5b an allowed line writes; an injected policy is honored; an unknown provider is refused', function () {
    const room = mkRoom();
    const ok = auditLedger.appendAudit(room, auditRecord('openalex'));
    const theo = auditLedger.appendAudit(room, auditRecord('theo'));
    const off = auditLedger.appendAudit(room, auditRecord('openalex'), { policy: egress.loadEgressPolicy(room, { offline: true }) });
    const unknown = auditLedger.appendAudit(room, auditRecord('bogus-vendor'));
    const rows = auditLedger.readAudit(room, {});
    return (ok.ok === true && theo.ok === true && off.ok === false && off.reason === 'egress_line_off' && unknown.ok === false && unknown.reason === 'egress_line_off' && rows.length === 2) ||
      JSON.stringify({ ok: ok, theo: theo, off: off, unknown: unknown, rows: rows.length });
  });
  await leg('E5c the closed key set is unchanged and a bad record still reports its own reason first', function () {
    const bad = auditRecord('openalex');
    delete bad.latency_ms;
    const res = auditLedger.appendAudit(mkRoom(), bad);
    return (auditLedger.AUDIT_KEYS.length === 23 && res.ok === false && res.reason === 'missing_key') || JSON.stringify(res);
  });

  // ----- E6 -----
  await leg('E6 a malformed override is ignored, named, and never throws', function () {
    const room = mkRoom();
    writeOverride(room, '{ not json');
    const p = egress.loadEgressPolicy(room);
    return (egress.lineAllowed(p, 'research') === true && p.ignored.some(function (x) { return /egress-policy\.json/.test(String(x)); })) || JSON.stringify(p.ignored);
  });
  await leg('E6b an override that is a symlink out of the room is ignored', function () {
    const room = mkRoom();
    const outside = path.join(root, 'outside-policy.json');
    fs.writeFileSync(outside, JSON.stringify({ lines: { research: { default: false } } }), 'utf8');
    fs.symlinkSync(outside, path.join(room, '.mindrian', 'egress-policy.json'));
    const p = egress.loadEgressPolicy(room);
    return (egress.lineAllowed(p, 'research') === true && p.ignored.length >= 1) || JSON.stringify({ research: egress.lineAllowed(p, 'research'), ignored: p.ignored });
  });
  await leg('E6c a room that does not exist or a non-string room still returns the plugin default', function () {
    const a = egress.loadEgressPolicy(path.join(root, 'no-such-room'));
    const b = egress.loadEgressPolicy(undefined);
    return (egress.lineAllowed(a, 'research') === true && egress.lineAllowed(b, 'research') === true) || 'default not returned';
  });

  // ----- E7 .. E10 the quick run honors the policy -----
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  // a planted room with one built, ready quick plan from the given perspective module
  function mkPlan(mod) {
    seq += 1;
    const built = buildPerspectiveRoom(path.join(root, 'plan' + seq));
    const rec = mod.runRecall(built.roomDir, { tag: '20261002T13000' + seq + 'Z' });
    const bp = planner.buildPlan(built.roomDir, rec.question_set, { mode: 'quick' });
    return { roomDir: built.roomDir, plan: bp && bp.ok ? bp.plan : null, bp: bp };
  }
  function approveRun(roomDir, plan) {
    const p = grants.buildRunGrant(plan);
    p.room_id = grants.roomIdFor(roomDir);
    return grants.writeGrant(roomDir, p, { approved_via: VIA });
  }
  function stubFetch() {
    const box = { n: 0 };
    box.fn = function () { box.n += 1; return Promise.reject(new Error('openalex stub failure')); };
    return box;
  }
  function stubTool() {
    const box = { calls: [] };
    box.callTool = async function (name, args) { box.calls.push({ name: name, args: clone(args) }); return { paths: [] }; };
    return box;
  }
  const AUDIT_FILE = function (room) { return path.join(room, '.mindrian', 'research-audit.jsonl'); };

  const eu = mkPlan(eurekaRecall);
  const cn = mkPlan(cnRecall);

  await leg('E7 research line off (room override): zero fetches, plan only, not sent, plan card intact', async function () {
    if (!eu.plan) return 'no plan ' + JSON.stringify(eu.bp && eu.bp.errors);
    writeOverride(eu.roomDir, { lines: { research: { default: false } } });
    const w = approveRun(eu.roomDir, eu.plan);
    if (!w.ok) return 'grant ' + JSON.stringify(w);
    const f = stubFetch();
    const r = await quick.runQuick(eu.roomDir, eu.plan, { fetchEnvelopeFn: f.fn });
    const cover = quick.coverFor(eu.roomDir, eu.plan, {});
    const cardOk = !!r.card && typeof r.card.body_md === 'string' && r.card.body_md.indexOf(eu.plan.pyramid.stated_question.replace(/\s+/g, ' ').trim()) !== -1;
    const stateWritten = fs.existsSync(path.join(eu.roomDir, '.mindrian', 'research-runs', eu.plan.run_id, 'run.json'));
    return (r.status === 'plan_only' && r.reason === 'egress_line_off' && r.line === 'research' && r.sent === false && /not sent/i.test(r.answer_line || '') && f.n === 0 &&
      cardOk && !fs.existsSync(AUDIT_FILE(eu.roomDir)) && !stateWritten && cover.covered === false && cover.reason === 'egress_line_off') ||
      JSON.stringify({ s: r.status, reason: r.reason, line: r.line, sent: r.sent, fetch: f.n, cardOk: cardOk, cover: cover.reason, audit: fs.existsSync(AUDIT_FILE(eu.roomDir)) });
  });
  await leg('E7b opts.offline gives the same answer with no override file', async function () {
    const m = mkPlan(eurekaRecall);
    const w = approveRun(m.roomDir, m.plan);
    if (!w.ok) return 'grant ' + JSON.stringify(w);
    const f = stubFetch();
    const r = await quick.runQuick(m.roomDir, m.plan, { fetchEnvelopeFn: f.fn, offline: true });
    const noGrant = await quick.runQuick(mkPlan(eurekaRecall).roomDir, m.plan, { fetchEnvelopeFn: f.fn, offline: true });
    return (r.status === 'plan_only' && r.offline === true && f.n === 0 && noGrant.status === 'plan_only') || JSON.stringify({ s: r.status, off: r.offline, fetch: f.n, noGrant: noGrant.status });
  });

  // ----- E8 the CLI chain -----
  function cli(args) {
    const env = Object.assign({}, process.env, { HOME: TMP_HOME, USERPROFILE: TMP_HOME, MINDRIAN_ROOMS_HOME: process.env.MINDRIAN_ROOMS_HOME });
    delete env.CLAUDE_ACTIVE_ROOM;
    delete env.CLAUDE_CODE_SESSION_ID;
    delete env.ANTHROPIC_API_KEY;
    delete env.OPENALEX_API_KEY;
    delete env.TYPESAFE_API_KEY;
    const res = spawnSync(process.execPath, [CLI].concat(args), { encoding: 'utf8', env: env, timeout: 90000 });
    let json = null;
    try { json = JSON.parse(String(res.stdout || '').trim()); } catch (_e) { json = null; }
    return { code: res.status, stdout: String(res.stdout || ''), json: json };
  }
  await leg('E8 CLI: recall --offline, judge --offline, run-quick --offline completes, exit 0, nothing sent', function () {
    seq += 1;
    const built = buildPerspectiveRoom(path.join(root, 'cli' + seq));
    const R = built.roomDir;
    const rec = cli(['perspective-recall', '--room', R, '--perspective', 'eureka', '--tag', '20261002T140001Z', '--offline']);
    const jud = cli(['perspective-judge', '--room', R, '--perspective', 'eureka', '--tag', '20261002T140001Z', '--judge', 'none', '--offline']);
    const runId = rec.json && rec.json.plan && rec.json.plan.run_id;
    if (!runId) return 'no run id: ' + rec.stdout.slice(0, 200);
    const run = cli(['run-quick', runId, '--room', R, '--offline']);
    const candFile = path.join(R, '.mindrian', 'eureka-runs', '20261002T140001Z', '02_recall', 'output', 'candidates.jsonl');
    const anyCandidates = fs.existsSync(path.join(R, '.mindrian')) && rec.json.top && rec.json.top.length >= 1;
    const verdicts = jud.json && jud.json.ok === true && !!jud.json.file;
    const noRows = !fs.existsSync(AUDIT_FILE(R)) && !fs.existsSync(path.join(R, '.mindrian', 'research-runs', runId, 'theo-lane.json'));
    return (rec.code === 0 && rec.json.ok === true && rec.json.offline === true && anyCandidates && jud.code === 0 && verdicts && jud.json.offline === true &&
      run.code === 0 && run.json && run.json.ok === true && run.json.status === 'plan_only' && run.json.sent === false && run.json.offline === true && noRows && candFile.length > 0) ||
      JSON.stringify({ rec: rec.code, jud: jud.code, run: run.code, runOut: run.stdout.slice(0, 240), noRows: noRows });
  });
  await leg('E8b CLI: a connections plan under --offline makes zero Theo calls and still exits 0', function () {
    seq += 1;
    const built = buildPerspectiveRoom(path.join(root, 'cli' + seq));
    const R = built.roomDir;
    const rec = cli(['perspective-recall', '--room', R, '--perspective', 'connections', '--tag', '20261002T140002Z', '--offline']);
    const runId = rec.json && rec.json.plan && rec.json.plan.run_id;
    if (!runId) return 'no run id: ' + rec.stdout.slice(0, 200);
    const run = cli(['run-quick', runId, '--room', R, '--offline']);
    const lane = path.join(R, '.mindrian', 'research-runs', runId, 'theo-lane.json');
    return (run.code === 0 && run.json && run.json.status === 'plan_only' && run.json.line === 'theo' && !fs.existsSync(lane) && !fs.existsSync(AUDIT_FILE(R))) || run.stdout.slice(0, 240);
  });
  await leg('E8c the --offline flag is valueless and only on the three commands; elsewhere it is refused', function () {
    seq += 1;
    const built = buildPerspectiveRoom(path.join(root, 'cli' + seq));
    const R = built.roomDir;
    const bad = cli(['grant', 'status', '--room', R, '--offline']);
    const withValue = cli(['perspective-recall', '--room', R, '--perspective', 'eureka', '--offline', 'yes']);
    return (bad.code === 2 && bad.json && bad.json.reason === 'free_text_argv_refused' && withValue.code === 2 && withValue.json && withValue.json.reason === 'free_text_argv_refused') ||
      JSON.stringify({ bad: bad.stdout.slice(0, 100), withValue: withValue.stdout.slice(0, 100) });
  });

  // ----- E9 the theo line -----
  await leg('E9 theo line off: runTheoLane makes zero calls and each leaf reports the off line', async function () {
    if (!cn.plan) return 'no plan ' + JSON.stringify(cn.bp && cn.bp.errors);
    writeOverride(cn.roomDir, { lines: { theo: false } });
    const w = approveRun(cn.roomDir, cn.plan);
    if (!w.ok) return 'grant ' + JSON.stringify(w);
    const t = stubTool();
    const out = await theoLane.runTheoLane(cn.roomDir, { run_id: cn.plan.run_id, grant: w.grant, now: Date.now() }, cn.plan, { callTool: t.callTool });
    const leaves = theoLane.theoLeavesOf(cn.plan);
    const reported = out.checks.length === leaves.length && out.checks.every(function (c) { return c.outcome === 'skipped' && c.reason === 'egress_line_off'; });
    const unresolved = leaves.every(function (l) { return out.verdictByLeaf[l.id] === 'unresolved'; });
    return (t.calls.length === 0 && out.calls === 0 && reported && unresolved && !fs.existsSync(AUDIT_FILE(cn.roomDir))) ||
      JSON.stringify({ calls: t.calls.length, out: out.calls, checks: out.checks.map(function (c) { return c.reason; }) });
  });
  await leg('E9b theo-only plan with the theo line off: runQuick answers plan only and makes zero calls', async function () {
    const t = stubTool();
    const f = stubFetch();
    const r = await quick.runQuick(cn.roomDir, cn.plan, { callTool: t.callTool, fetchEnvelopeFn: f.fn });
    return (r.status === 'plan_only' && r.line === 'theo' && t.calls.length === 0 && f.n === 0) || JSON.stringify({ s: r.status, line: r.line, calls: t.calls.length });
  });
  await leg('E9c research on, theo off, mixed plan: openalex still runs, the lane reports the off line', async function () {
    seq += 1;
    const built = buildPerspectiveRoom(path.join(root, 'mix' + seq));
    const rec = cnRecall.runRecall(built.roomDir, { tag: '20261002T150001Z' });
    const qs = clone(rec.question_set);
    qs.leaves.push({ id: 'cn-oa', question: 'Is this written up anywhere?', origin: 'framework_dimension', dimension: 'cn:lateral_path', lens: 'cn.lateral', researchable: true, falsifier: { text: 'no paper' }, corpus: 'openalex', slots: { term: 'adaptive routing', term2: 'swarm coordination' } });
    const bp = planner.buildPlan(built.roomDir, qs, { mode: 'quick' });
    if (!bp || !bp.ok) return 'no plan ' + JSON.stringify(bp && bp.errors);
    writeOverride(built.roomDir, { lines: { theo: false } });
    const w = approveRun(built.roomDir, bp.plan);
    if (!w.ok) return 'grant ' + JSON.stringify(w);
    const t = stubTool();
    const f = stubFetch();
    const r = await quick.runQuick(built.roomDir, bp.plan, { callTool: t.callTool, fetchEnvelopeFn: f.fn });
    const rows = auditLedger.readAudit(built.roomDir, { run_id: bp.plan.run_id });
    return (r.status === 'done' && f.n >= 1 && t.calls.length === 0 && rows.length >= 1 && rows.every(function (x) { return x.provider === 'openalex'; }) &&
      Array.isArray(r.run.theo_checks) && r.run.theo_checks.every(function (c) { return c.reason === 'egress_line_off'; })) ||
      JSON.stringify({ s: r.status, reason: r.reason, fetch: f.n, calls: t.calls.length, rows: rows.length });
  });

  // ----- E10 default policy unchanged -----
  await leg('E10 default policy: research stays on per grant, the run fetches and audits openalex rows', async function () {
    const m = mkPlan(eurekaRecall);
    const w = approveRun(m.roomDir, m.plan);
    if (!w.ok) return 'grant ' + JSON.stringify(w);
    const f = stubFetch();
    const r = await quick.runQuick(m.roomDir, m.plan, { fetchEnvelopeFn: f.fn });
    const rows = auditLedger.readAudit(m.roomDir, { run_id: m.plan.run_id });
    const cover = quick.coverFor(m.roomDir, m.plan, {});
    return (r.status === 'done' && f.n >= 1 && rows.length === f.n && rows.every(function (x) { return x.provider === 'openalex'; }) && cover.covered === true) ||
      JSON.stringify({ s: r.status, reason: r.reason, fetch: f.n, rows: rows.length, cover: cover.reason });
  });

  C.check('zero network attempts', net.attempts() === 0, String(net.attempts()));
  net.restore();
  try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
  process.exit(C.summary());
})();
