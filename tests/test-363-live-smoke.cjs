'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363 Plan 20 Task 2 -- the opt-in live smoke (D-06, T-363-51).
 *
 * Opt-in only: without MOS_363_LIVE=1 this prints `ENV GAP: MOS_363_LIVE unset`
 * and exits 77. It never reports PASSED without having really run.
 *
 * With MOS_363_LIVE=1 it runs the Whitespace slice against REAL OpenAlex, in
 * both modes, in an mkdtemp fixture room under test grants, with generic fixture
 * phrases only (GAP_TERM_363 and one generic synonym; the deep lanes reuse the
 * same generic phrases). At most 3 quick searches and 16 deep searches, about
 * $0.02 at the measured keyless price. An OPENALEX_API_KEY already present in
 * the environment is used only as a Bearer header by the fetcher; its value is
 * never printed, stored or asserted on. HOME is redirected to a scratch dir so
 * the shared egress telemetry sink and cache of the real home are untouched.
 *
 * Honest outcomes:
 *   - every audit record must be typed (ok, empty_valid, cache_hit, or a
 *     failure with a failure_class); meta.count is a number on ok / empty_valid;
 *   - no network, a 429, an exhausted budget, a timeout or an HTTP error is an
 *     ENV GAP: print the typed reason and exit 77 (never PASSED);
 *   - a parse error or a contract violation from a live body is a real defect:
 *     exit 1.
 * Prints `LIVE_METRICS {...}` (per-query latency, counts, remaining budget).
 *
 * No em-dash or en-dash literals: those characters are spelled with
 * String.fromCharCode. Exit 0 pass, 1 fail, 77 ENV GAP.
 */

if (process.env.MOS_363_LIVE !== '1') {
  console.log('ENV GAP: MOS_363_LIVE unset');
  process.exit(77);
}

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const KEY_PRESENT = typeof process.env.OPENALEX_API_KEY === 'string' && process.env.OPENALEX_API_KEY.length > 0;
const KEY_VALUE = KEY_PRESENT ? process.env.OPENALEX_API_KEY : null;

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos363-live-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:1';
process.env.MINDRIAN_BRAIN_TIMEOUT_MS = '500';

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(__dirname, 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
const { check, summary } = hygiene.makeChecker('363-20 live OpenAlex smoke');

const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

const { buildRoom363, GAP_TERM_363 } = require(path.join(__dirname, 'helpers', 'fixture-room-363.cjs'));
const planner = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'planner.cjs'));
const quick = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'quick.cjs'));
const deep = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'deep.cjs'));
const grants = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'grants.cjs'));
const auditLedger = require(path.join(ROOT, 'lib', 'core', 'research-planner', 'audit-ledger.cjs'));

const SYN = 'ultrasonic biofilm removal';
const QS_DIR = path.join(ROOT, 'tests', 'fixtures', '363-question-sets');
const QUICK_CAP = 3;
const DEEP_CAP = 16;

const GAP_CLASSES = ['network_timeout', 'http_error', 'missing_credential'];
const TYPED_OK = ['ok', 'empty_valid', 'cache_hit'];

function ms(startNs) { return Number(process.hrtime.bigint() - startNs) / 1e6; }
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function walkFiles(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return out; }
  entries.forEach(function (e) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walkFiles(abs, out); else if (e.isFile()) out.push(abs);
  });
  return out;
}

function wsQs(room) {
  const qs = JSON.parse(fs.readFileSync(path.join(QS_DIR, 'whitespace-quick.json'), 'utf8'));
  qs.stated_question = 'Is there published work on ' + GAP_TERM_363 + '?';
  qs.leaves[0].question = qs.stated_question;
  qs.leaves[0].slots = { term: GAP_TERM_363 };
  qs.leaves[1].slots = { term: GAP_TERM_363, synonyms: [SYN] };
  qs.return_target = { section: room.zones.twoSection.sections[0] };
  return qs;
}

const METRICS = { keyed: KEY_PRESENT, quick: null, deep: null, queries: [], budget_remaining_usd_min: null };
const GAPS = [];

function noteAudit(rows, phase) {
  rows.forEach(function (a) {
    METRICS.queries.push({
      phase: phase, template_id: a.template_id, role: a.family, outcome: a.outcome, failure_class: a.failure_class,
      count: a.count, results: (a.result_ids || []).length, cost_usd: a.cost_usd, remaining_usd: a.remaining_usd, latency_ms: a.latency_ms,
    });
    if (typeof a.remaining_usd === 'number' && (METRICS.budget_remaining_usd_min === null || a.remaining_usd < METRICS.budget_remaining_usd_min)) {
      METRICS.budget_remaining_usd_min = a.remaining_usd;
    }
  });
}

// Classify audit rows: returns a list of typed problems. GAP kinds are ENV GAPs,
// DEFECT kinds fail the smoke.
function classifyAudit(rows) {
  const gaps = [];
  const defects = [];
  rows.forEach(function (a) {
    if (TYPED_OK.indexOf(a.outcome) !== -1) {
      if ((a.outcome === 'ok' || a.outcome === 'empty_valid') && !(typeof a.count === 'number' && Number.isFinite(a.count))) defects.push('untyped count on ' + a.template_id);
      return;
    }
    if (a.outcome === 'failed' || a.outcome === 'blocked') {
      if (typeof a.failure_class !== 'string' || a.failure_class.length === 0) { defects.push('failed record with no failure_class on ' + a.template_id); return; }
      if (GAP_CLASSES.indexOf(a.failure_class) !== -1) gaps.push(a.failure_class);
      else defects.push('live failure ' + a.failure_class + ' on ' + a.template_id);
      return;
    }
    defects.push('untyped outcome ' + String(a.outcome));
  });
  return { gaps: gaps, defects: defects };
}

function finish(code, reason) {
  console.log('LIVE_METRICS ' + JSON.stringify(METRICS));
  if (reason) console.log(reason);
  process.exit(code);
}

async function deepLoop(room, plan) {
  const id = plan.run_id;
  const appr = planner.approvePlanReview(room.roomDir, id, { approvedVia: 'cli' });
  if (!appr.ok) return { error: 'approvePlanReview ' + JSON.stringify(appr) };
  const init = deep.initDeepState(room.roomDir, plan, appr.grant, {});
  if (!init.ok) return { error: 'init ' + JSON.stringify(init) };
  for (let n = 0; n < 60; n += 1) {
    const s = deep.nextDeepStep(room.roomDir, id);
    if (!s.ok) return { error: 'step ' + JSON.stringify(s) };
    if (s.step === 'fetch_round') {
      const fr = await deep.fetchRound(room.roomDir, id, {});
      if (!fr.ok) return { error: 'fetch ' + JSON.stringify(fr), reason: fr.reason };
    } else if (s.step === 'dispatch_lanes') {
      for (let i = 0; i < s.payload.lanes.length; i += 1) {
        const p = s.payload.lanes[i];
        const records = readJson(path.join(room.roomDir, p.records_path)).records;
        // Deterministic lane rows: quote the first fetched record's title.
        const rows = records.length === 0 ? [] : [{ leaf_id: p.leaves[0].leaf_id, record_id: records[0].id, claim: 'Deterministic smoke row for ' + p.leaves[0].leaf_id, quote: records[0].title, label: 'supports' }];
        const rr = deep.recordLaneRows(room.roomDir, id, p.lane, rows);
        if (rr && rr.ok === false) return { error: 'record ' + JSON.stringify(rr) };
      }
    } else if (s.step === 'reflect') {
      const pf = deep.proposeFollowups(room.roomDir, id, []);
      if (!pf.ok) return { error: 'followups ' + JSON.stringify(pf) };
    } else if (s.step === 'extend_card') {
      const d = deep.applyExtendDecision(room.roomDir, id, 'stop', {});
      if (!d.ok) return { error: 'extend ' + JSON.stringify(d) };
    } else if (s.step === 'counterevidence') {
      const ce = await deep.runCounterevidence(room.roomDir, id, {});
      if (!ce.ok) return { error: 'ce ' + JSON.stringify(ce), reason: ce.reason };
      if (ce.lane_payload) {
        const p = ce.lane_payload;
        const records = readJson(path.join(room.roomDir, p.records_path)).records;
        const rows = records.length === 0 ? [] : [{ leaf_id: p.leaves[0].leaf_id, record_id: records[0].id, claim: 'Deterministic smoke counter row', quote: records[0].title, label: 'contradicts' }];
        const rr = deep.recordLaneRows(room.roomDir, id, 'CE', rows);
        if (rr && rr.ok === false) return { error: 'ce record ' + JSON.stringify(rr) };
      }
    } else if (s.step === 'synthesize') {
      const res = deep.synthesize(room.roomDir, id);
      return { result: res };
    } else if (s.step === 'done') {
      return { result: null };
    }
  }
  return { error: 'loop guard' };
}

async function main() {
  const room = buildRoom363({ role: 'researcher' });
  let exitCode = 0;
  try {
    // Test standing grant: only the generic fixture phrases.
    const proposal = grants.buildStandingProposal(room.roomDir, { terms: [{ term: GAP_TERM_363, synonyms: [SYN] }] });
    const g = planner.approveStandingGrant(room.roomDir, proposal, { approvedVia: 'cli' });
    if (!g.ok) { check('test standing grant approved', false, JSON.stringify(g)); return summary(); }

    // ---- quick, real OpenAlex ---------------------------------------------------
    const built = planner.buildPlan(room.roomDir, wsQs(room), { mode: 'quick' });
    if (built.status !== 'ready') { check('quick plan is ready', false, built.status); return summary(); }
    const t0 = process.hrtime.bigint();
    const ran = await quick.runQuick(room.roomDir, built.plan, {});
    const quickMs = ms(t0);
    if (ran.status !== 'done') { check('quick run finished', false, ran.status + ' ' + ran.reason); return summary(); }
    const quickAudit = auditLedger.readAudit(room.roomDir, { run_id: built.run_id });
    noteAudit(quickAudit, 'quick');
    METRICS.quick = { wall_ms: Number(quickMs.toFixed(1)), searches: quickAudit.length, verdict: ran.run.verdict, stop_reason: ran.run.stop_reason };
    const qc = classifyAudit(quickAudit);
    if (qc.defects.length > 0) { check('quick envelopes are typed', false, qc.defects.join('; ')); return summary(); }
    check('quick envelopes are typed (ok, empty_valid, cache_hit or failed with a class)', true);
    check('quick run made at most ' + QUICK_CAP + ' searches and wrote one audit record each', quickAudit.length >= 1 && quickAudit.length <= QUICK_CAP, 'audit ' + quickAudit.length);
    if (qc.gaps.length > 0) {
      GAPS.push('quick: ' + qc.gaps.join(','));
    } else {
      check('quick verdict is one of the typed verdicts', ['settled', 'thin', 'contested', 'gap-confirmed', 'unresolved'].indexOf(ran.run.verdict) !== -1, ran.run.verdict);
      check('quick meta.count is a number on every ok or empty_valid search', quickAudit.filter(function (a) { return a.outcome === 'ok' || a.outcome === 'empty_valid'; }).every(function (a) { return typeof a.count === 'number'; }));
    }

    // ---- escalate and deep, real OpenAlex -----------------------------------------
    if (GAPS.length === 0) {
      const esc = planner.escalate(room.roomDir, built.run_id, {});
      if (!esc.ok || esc.next !== 'review') { check('escalate produced a plan at the review card', false, JSON.stringify({ ok: esc.ok, next: esc.next, reason: esc.reason })); return summary(); }
      // The deep run must send its own searches, not read the quick run's cache.
      try { fs.rmSync(path.join(room.roomDir, '.mindrian', 'research-cache'), { recursive: true, force: true }); } catch (_e) { /* ok */ }
      const t1 = process.hrtime.bigint();
      const out = await deepLoop(room, esc.plan);
      const deepMs = ms(t1);
      const deepAudit = auditLedger.readAudit(room.roomDir, { run_id: esc.run_id });
      noteAudit(deepAudit, 'deep');
      const dc = classifyAudit(deepAudit);
      METRICS.deep = {
        wall_ms: Number(deepMs.toFixed(1)), searches: deepAudit.length,
        stop_reason: out.result && out.result.ok ? out.result.run.stop_reason : null,
        unresolved_branches: out.result && out.result.ok ? out.result.run.unresolved_branches.length : null,
      };
      if (dc.defects.length > 0) { check('deep envelopes are typed', false, dc.defects.join('; ')); return summary(); }
      if (dc.gaps.length > 0) GAPS.push('deep: ' + dc.gaps.join(','));
      else if (out.error) {
        const r = String(out.reason || '');
        if (/budget|throttle|no_network|network/i.test(r)) GAPS.push('deep: ' + r);
        else { check('deep loop ran to synthesis', false, out.error); return summary(); }
      } else {
        check('deep envelopes are typed', true);
        check('deep run used at most ' + DEEP_CAP + ' searches', deepAudit.length >= 1 && deepAudit.length <= DEEP_CAP, 'searches ' + deepAudit.length);
        check('deep run ended with a stop reason', !!(out.result && out.result.ok && typeof out.result.run.stop_reason === 'string' && out.result.run.stop_reason.length > 0));
        check('deep meta.count is a number on every ok or empty_valid search', deepAudit.filter(function (a) { return a.outcome === 'ok' || a.outcome === 'empty_valid'; }).every(function (a) { return typeof a.count === 'number'; }));
      }
    }

    // ---- audit records hold no key ---------------------------------------------------
    const auditText = fs.existsSync(path.join(room.roomDir, '.mindrian', 'research-audit.jsonl')) ? fs.readFileSync(path.join(room.roomDir, '.mindrian', 'research-audit.jsonl'), 'utf8') : '';
    check('audit records exist', auditText.trim().length > 0);
    check('audit records hold no Bearer header text', !/Bearer /i.test(auditText) && !/api_key=/i.test(auditText));
    if (KEY_PRESENT) {
      let leaked = null;
      walkFiles(room.roomDir, []).concat(walkFiles(TMP_HOME, [])).forEach(function (f) {
        if (leaked) return;
        if (fs.readFileSync(f).includes(Buffer.from(KEY_VALUE))) leaked = f;
      });
      check('the API key value is in no room or home file', leaked === null, String(leaked));
    }
    check('dash guard: no em-dash or en-dash in this test', (function () {
      const s = fs.readFileSync(__filename, 'utf8');
      return s.indexOf(EM) === -1 && s.indexOf(EN) === -1;
    })());

    // A gap is never a pass: name it and exit 77, whatever else passed.
    const code = summary();
    exitCode = GAPS.length > 0 ? (code === 0 ? 77 : 1) : code;
  } finally {
    try { room.cleanup(); } catch (_e) { /* ok */ }
    try { fs.rmSync(TMP_HOME, { recursive: true, force: true }); } catch (_e) { /* ok */ }
  }
  return exitCode;
}

main().then(function (code) {
  finish(code, code === 77 && GAPS.length > 0 ? 'ENV GAP: ' + GAPS.join(' | ') : null);
}).catch(function (e) {
  const msg = String((e && e.message) || e);
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|EAI_AGAIN|fetch failed|network/i.test(msg)) {
    GAPS.push('network: ' + msg.slice(0, 80));
    finish(77, 'ENV GAP: ' + GAPS.join(' | '));
    return;
  }
  console.log('FAIL: harness ' + ((e && e.stack) || msg));
  finish(1);
});
