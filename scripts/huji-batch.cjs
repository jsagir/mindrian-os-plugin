#!/usr/bin/env node
'use strict';
/*
 * scripts/huji-batch.cjs - Phase 229-08, seam (e): the OUTER batch orchestrator.
 * ==========================================================================
 * The one genuine net-new build of Phase 229 (No Analog Found - PATTERNS). It
 * loops N=200 submissions through a bounded concurrency pool, spawning ONE
 * isolated headless session per student via runOne (scripts/huji-run-one.cjs),
 * checkpoints every transition to a filesystem ledger (batch-state.json, atomic
 * write-temp-rename), resumes cleanly by skipping .done units, retries transient
 * failures in fresh scratch rooms, enforces batch-level guardrails (G3 Part-8 +
 * G4 model-provenance escalate to a WHOLE-BATCH HALT; G5 cost fuse + failure-rate
 * pause/stop), aggregates the cohort report (huji-eval --report), and cleans up
 * scratch rooms after .done.
 *
 * Isolation invariant: the orchestrator NEVER imports the in-session chain module;
 * the deep-grade -> mullins -> build-thesis -> structure-argument chain runs INSIDE
 * each spawned session (runOne, Plan 07). Importing it here would collapse the
 * per-submission isolation boundary that gives Part-8 containment and zero
 * cross-student bleed. The batch workspace lives OUTSIDE the repo
 * (~/MindrianRooms/huji-pilot-batch/) and is never committed (T-229-08-05).
 *
 * CJS only. No em-dashes (CLAUDE.md HARD RULE). Zero new dependencies.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

// The pinned FULL model ID default (never a bare alias - Pitfall 1 fairness bug).
const PINNED_MODEL_DEFAULT = 'claude-opus-4-8';

// Concurrency cap 3-4 (Pitfall 6: parallel sessions share one key's rate limits).
const DEFAULT_CONCURRENCY = 4;

// Repeated rate_limit signals -> DROP to serial (never add retries on top; that
// amplifies the storm - Pitfall 6 / T-229-08-03).
const RATE_LIMIT_SERIAL_THRESHOLD = 2;

// --------------------------------------------------------------------------
// Small dependency-free helpers.
// --------------------------------------------------------------------------

// Flatten every string leaf of an object graph (per-unit entity inventory for G3).
function collectStrings(node, acc) {
  acc = acc || [];
  if (node == null) return acc;
  if (typeof node === 'string') { acc.push(node); return acc; }
  if (Array.isArray(node)) { for (const x of node) collectStrings(x, acc); return acc; }
  if (typeof node === 'object') { for (const k of Object.keys(node)) collectStrings(node[k], acc); }
  return acc;
}

const tick = () => new Promise((r) => setImmediate(r));

// Atomic write-temp-then-rename: a crash never leaves a half-written ledger.
function writeAtomic(filePath, contents) {
  const tmp = filePath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
  fs.writeFileSync(tmp, contents, 'utf8');
  fs.renameSync(tmp, filePath);
}

function loadLedger(ledgerPath) {
  try { return JSON.parse(fs.readFileSync(ledgerPath, 'utf8')); } catch (_e) { return {}; }
}

// Persist the ledger atomically and fire the optional transition hook (used by the
// --dry-run selftest to observe pending -> running -> done transitions).
function writeLedger(state, ledger) {
  writeAtomic(state.ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
  if (typeof state.onLedger === 'function') {
    const snap = {};
    for (const k of Object.keys(ledger)) snap[k] = ledger[k].status;
    state.onLedger(snap);
  }
}

// Resume predicate: a unit is done if the ledger marks it done OR it carries a
// .done idempotency marker on disk (either is authoritative - PATTERNS resume).
function isDone(subId, ledger, outDir) {
  if (ledger[subId] && ledger[subId].status === 'done') return true;
  return fs.existsSync(path.join(outDir, subId, '.done'));
}

// Enumerate submissionsDir/<id>/transcript.md (+ optional deck) into work items.
function listSubmissions(submissionsDir) {
  const subs = [];
  let entries = [];
  try { entries = fs.readdirSync(submissionsDir, { withFileTypes: true }).filter((d) => d.isDirectory()); } catch (_e) { entries = []; }
  for (const d of entries) {
    const dir = path.join(submissionsDir, d.name);
    const transcriptPath = path.join(dir, 'transcript.md');
    if (!fs.existsSync(transcriptPath)) continue;
    let deckPath = null;
    for (const cand of ['deck.md', 'deck.pdf', 'paper.md', 'paper.pdf']) {
      if (fs.existsSync(path.join(dir, cand))) { deckPath = path.join(dir, cand); break; }
    }
    subs.push({ subId: d.name, transcriptPath, deckPath });
  }
  return subs;
}

function mkTmpWorkspace(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

// --------------------------------------------------------------------------
// resolveBatchConfig - fill defaults; a real batch passes pinned full model IDs
// and its own out-of-tree workspace paths via batch.config.json.
// --------------------------------------------------------------------------
function resolveBatchConfig(config) {
  const c = config || {};
  return {
    model: c.model || PINNED_MODEL_DEFAULT,               // Stage B spine (pinned full ID)
    extractModel: c.extractModel || 'claude-haiku-4-5',   // Stage A extraction
    aggregateModel: c.aggregateModel || 'claude-sonnet-5', // cohort report summarizer
    pluginDir: c.pluginDir || REPO_ROOT,
    budgetPerUnitUsd: typeof c.budgetPerUnitUsd === 'number' ? c.budgetPerUnitUsd : 3.0,
    maxTurns: typeof c.maxTurns === 'number' ? c.maxTurns : 40,
    schemaPath: c.schemaPath || null,
    concurrency: typeof c.concurrency === 'number' && c.concurrency > 0 ? c.concurrency : DEFAULT_CONCURRENCY,
  };
}

// --------------------------------------------------------------------------
// assertPinnedModelId - PREFLIGHT of the plan-checker advisory (model-alias-drift
// fairness bug, Pitfall 1). G4 catches an alias REACTIVELY on unit 1; this asserts
// it fail-fast BEFORE spawning any submission, so the batch never wastes a real
// unit + a human page discovering a bare alias on unit 1. The full ID pattern is
// claude-<family>-<digit...>; a bare alias ("opus"/"sonnet"/"haiku") is rejected.
// --------------------------------------------------------------------------
function assertPinnedModelId(model) {
  const BARE_ALIASES = ['opus', 'sonnet', 'haiku', 'opusplan', 'default', 'inherit'];
  if (!model || typeof model !== 'string') return { ok: false, reason: 'model_missing' };
  if (BARE_ALIASES.includes(model.toLowerCase())) return { ok: false, reason: 'bare_alias', model };
  if (!/^claude-[a-z]+-[0-9]/.test(model)) return { ok: false, reason: 'not_full_model_id', model };
  return { ok: true, model };
}

// --------------------------------------------------------------------------
// assertOutsideRepo - the batch workspace must live OUTSIDE the dev repo so
// batch artifacts are never git-added (T-229-08-05). Fails closed otherwise.
// --------------------------------------------------------------------------
function assertOutsideRepo(workspaceDir) {
  if (typeof workspaceDir !== 'string' || workspaceDir.length === 0) return { ok: false, reason: 'invalid_workspaceDir' };
  const resolved = path.resolve(workspaceDir);
  if (resolved === REPO_ROOT || resolved.startsWith(REPO_ROOT + path.sep)) {
    return { ok: false, reason: 'workspace_inside_repo', workspaceDir: resolved };
  }
  return { ok: true, workspaceDir: resolved };
}

// --------------------------------------------------------------------------
// preflightPluginLoad - ONE stream-json run asserting system/init carries the
// plugin in `plugins` and `plugin_errors` is absent; fail the batch closed
// otherwise (AI-SPEC Section 3 / Tool Use). Live path only - the selftests pass
// preflight:false since they call no model.
// --------------------------------------------------------------------------
function preflightPluginLoad(config) {
  const args = [
    '-p', 'preflight: confirm the plugin is loaded',
    '--plugin-dir', config.pluginDir,
    '--output-format', 'stream-json',
    '--verbose',
    '--max-turns', '1',
    '--no-session-persistence',
  ];
  const res = spawnSync('claude', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 120000 });
  if (res.error) return { ok: false, reason: 'preflight_spawn_failed', detail: String(res.error.message || res.error).slice(0, 200) };
  let sawInit = false;
  let pluginLoaded = false;
  let pluginErrors = false;
  for (const ln of String(res.stdout || '').split('\n').filter(Boolean)) {
    let ev = null;
    try { ev = JSON.parse(ln); } catch (_e) { continue; }
    if (!ev || typeof ev !== 'object') continue;
    if ((ev.type === 'system' && ev.subtype === 'init') || ev.plugins !== undefined) {
      sawInit = true;
      const plugins = ev.plugins || [];
      if (Array.isArray(plugins) && plugins.some((p) => /mos|mindrian/i.test(JSON.stringify(p)))) pluginLoaded = true;
      const errs = ev.plugin_errors;
      if (errs && ((Array.isArray(errs) && errs.length) || (typeof errs === 'object' && Object.keys(errs).length))) pluginErrors = true;
    }
  }
  if (!sawInit) return { ok: false, reason: 'no_system_init' };
  if (pluginErrors) return { ok: false, reason: 'plugin_errors_present' };
  if (!pluginLoaded) return { ok: false, reason: 'plugin_not_loaded' };
  return { ok: true };
}

// --------------------------------------------------------------------------
// runPool - dependency-free bounded concurrency pool. Maintains a `running` set,
// launches the worker while running.size < the CURRENT limit (getLimit re-read
// every iteration so a mid-batch drop-to-serial or a halt takes effect at once),
// and reaps settled entries. ~30 lines, no promise-library dependency.
// --------------------------------------------------------------------------
async function runPool({ items, getLimit, worker, onSettle }) {
  let idx = 0;
  const running = [];
  const results = [];
  const limitNow = () => Math.max(0, getLimit());
  while (idx < items.length || running.length > 0) {
    while (idx < items.length && running.length < limitNow()) {
      const item = items[idx++];
      const entry = { done: false };
      entry.promise = (async () => {
        try { entry.settled = { item, res: await worker(item) }; }
        catch (err) { entry.settled = { item, err }; }
        entry.done = true;
        return entry.settled;
      })();
      running.push(entry);
    }
    if (running.length === 0) break; // halted to 0 with nothing in flight
    await Promise.race(running.map((e) => e.promise));
    for (let i = running.length - 1; i >= 0; i--) {
      if (running[i].done) {
        const settled = running[i].settled;
        results.push(settled);
        running.splice(i, 1);
        if (onSettle) onSettle(settled);
      }
    }
  }
  return results;
}

// --------------------------------------------------------------------------
// defaultRunUnit - the production worker: wraps runOne (Plan 07) for one
// submission. runOne scaffolds a fresh scratch room, runs Stage A extraction +
// Stage B grading spine IN-SESSION, gates .done on the per-unit guardrails.
// --------------------------------------------------------------------------
function defaultRunUnit(sub, ctx) {
  const { runOne } = require('./huji-run-one.cjs');
  const r = runOne({
    subId: sub.subId,
    transcriptPath: sub.transcriptPath,
    deckPath: sub.deckPath,
    config: ctx.config,
    outDir: ctx.outDir,
  });
  return Object.assign({ subId: sub.subId }, r);
}

// --------------------------------------------------------------------------
// Failure classifiers + batch halt.
// --------------------------------------------------------------------------

// Terminal (do-not-retry) failures are input errors from runOne (invalid_*); a
// retry cannot fix a bad subId/path. Everything else is transient (retry).
function isTerminalFailure(res) {
  const reason = (res && res.reason) || '';
  return /^invalid_/.test(String(reason));
}

// A repeated rate_limit signal (Pitfall 6) is a reason to DROP to serial, never
// to add retries on top.
function isRateLimited(res) {
  const s = String((res && (res.detail || res.reason)) || '');
  return res && (res.rateLimited === true) || /rate.?limit/i.test(s);
}

// The --max-budget-usd CLI fuse tripping (G5).
function isBudgetTrip(res) {
  const s = String((res && (res.detail || res.reason)) || '');
  return res && (res.budgetTripped === true) || /budget/i.test(s);
}

function haltBatch(state, gate, detail) {
  if (state.halted) return;
  state.halted = true;
  state.haltReason = gate;
  state.haltDetail = detail;
  console.error('*** BATCH HALT [' + gate + '] - PAGE HUMAN: ' + detail);
}

// --------------------------------------------------------------------------
// attemptSubmission - the per-submission retry loop. 2 retries on transient
// failure, a FRESH scratch room each attempt (rm the prior room so no partial
// state poisons the rerun), then the caller marks it failed and continues.
// --------------------------------------------------------------------------
async function attemptSubmission(sub, ctx) {
  const { config, outDir, roomsDir, runUnit, maxRetries } = ctx;
  const totalTries = 1 + (typeof maxRetries === 'number' ? maxRetries : 2);
  let last = null;
  for (let attempt = 1; attempt <= totalTries; attempt++) {
    // Fresh scratch room per attempt (rerun = clean overwrite, PATTERNS retry).
    try { fs.rmSync(path.join(roomsDir, sub.subId), { recursive: true, force: true }); } catch (_e) { /* graceful */ }
    last = await runUnit(sub, { config, outDir, roomsDir, attempt });
    last = last || { ok: false, reason: 'null_unit_result' };
    last.attempts = attempt;
    if (last.ok) return last;
    if (isTerminalFailure(last)) return last; // input error - retry cannot help
  }
  return last;
}

// --------------------------------------------------------------------------
// failures.md - the partial-failure report (a deliverable, not a log): every
// failed submission with its truncated stderr + last session_id.
// --------------------------------------------------------------------------
function appendFailure(state, sub, res) {
  state.failures.push({
    subId: sub.subId,
    reason: (res && res.reason) || 'unknown',
    stderr: String((res && res.detail) || '').slice(0, 1000).replace(/\n/g, ' '),
    session_id: (res && res.session_id) || null,
    attempts: (res && res.attempts) || 1,
  });
  const lines = ['# Batch failures (partial-failure report - a deliverable)', ''];
  for (const f of state.failures) {
    lines.push('## ' + f.subId + ' (failed after ' + f.attempts + ' attempt(s))');
    lines.push('- reason: ' + f.reason);
    lines.push('- last session_id: ' + (f.session_id || 'none'));
    lines.push('- stderr (truncated): ' + f.stderr);
    lines.push('');
  }
  writeAtomic(state.failuresPath, lines.join('\n'));
}

// --------------------------------------------------------------------------
// Batch guardrails escalating to a WHOLE-BATCH halt.
//   G3 Part-8 egress: reuses huji-eval part8Hygiene (the same gate as
//       `node scripts/huji-eval.cjs --check part8-hygiene`) over the unit's
//       Brain-query log; ANY hit means the hygiene MECHANISM is broken for all
//       200 - zero tolerance (T-229-08-01).
//   G4 model provenance: result.json model_id != the pinned config.model means
//       cohort fairness is broken mid-batch (Pitfall 1 / T-229-08-02).
// --------------------------------------------------------------------------
function loadQueryPayloads(roomDir, outDir) {
  const payloads = [];
  for (const base of [roomDir, outDir]) {
    if (!base) continue;
    for (const name of ['brain-query-log.jsonl', 'query-log.jsonl']) {
      const p = path.join(base, name);
      if (!fs.existsSync(p)) continue;
      for (const ln of fs.readFileSync(p, 'utf8').split('\n').filter(Boolean)) {
        try { const o = JSON.parse(ln); payloads.push(o.payload || o); } catch (_e) { /* ignore */ }
      }
    }
  }
  return payloads;
}

function checkG3(res) {
  const { part8Hygiene } = require('./huji-eval.cjs');
  let evidence = {};
  try {
    if (res.evidencePath && fs.existsSync(res.evidencePath)) evidence = JSON.parse(fs.readFileSync(res.evidencePath, 'utf8'));
  } catch (_e) { /* ignore */ }
  const entities = collectStrings(evidence);
  const payloads = loadQueryPayloads(res.roomDir, res.outDir);
  return part8Hygiene({ payloads, entities });
}

function checkG4(res, pinnedModel) {
  let modelId = res.model_id;
  try {
    if (res.resultPath && fs.existsSync(res.resultPath)) {
      const rj = JSON.parse(fs.readFileSync(res.resultPath, 'utf8'));
      modelId = rj.model_id || modelId;
    }
  } catch (_e) { /* ignore */ }
  if (modelId !== pinnedModel) return { ok: false, detail: String(modelId) + ' != pinned ' + pinnedModel };
  return { ok: true };
}

// Cleanup after .done: archive/delete the scratch room, dropping any residue and
// db handles (Pitfall 5 / T-229-08-04). runOne closes its own db handle; here we
// remove the room dir so N=200 leaves no scratch residue.
function cleanupRoom(roomDir) {
  if (!roomDir) return;
  try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) { /* graceful */ }
}

// Cohort aggregation: render the report via huji-eval --report over the batch
// out dir (cost curve, score distribution, drift, similarity, Part-8 line).
function runAggregation(outDir, aggregateModel) {
  const res = spawnSync('node', [path.join(REPO_ROOT, 'scripts', 'huji-eval.cjs'), '--report', '--out', outDir], {
    encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  return { ok: res.status === 0, model: aggregateModel, stdout: String(res.stdout || ''), stderr: String(res.stderr || '') };
}

// --------------------------------------------------------------------------
// runBatch({config, submissionsDir, workspaceDir}) - the outer loop.
// Preflight, pool, ledger, resume, retry, batch guardrails (G3/G4/G5 +
// failure-rate), aggregation, cleanup. Returns
// { ok, halted, haltReason, completed, failed, skipped, ledgerPath, outDir }.
// --------------------------------------------------------------------------
async function runBatch(opts) {
  const o = opts || {};
  const config = resolveBatchConfig(o.config);
  const workspaceDir = o.workspaceDir;

  // Workspace must live OUTSIDE the repo (never commit batch artifacts).
  const ws = assertOutsideRepo(workspaceDir);
  if (!ws.ok) return { ok: false, reason: 'workspace_invalid', detail: ws };

  // PREFLIGHT model-ID pinning (plan-checker advisory): fail fast on a bare alias.
  const mv = assertPinnedModelId(config.model);
  if (!mv.ok) return { ok: false, reason: 'model_not_pinned', detail: mv };

  const outDir = path.join(ws.workspaceDir, 'out');
  const roomsDir = path.join(ws.workspaceDir, 'rooms');
  const ledgerPath = path.join(ws.workspaceDir, 'batch-state.json');
  const failuresPath = path.join(ws.workspaceDir, 'failures.md');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(roomsDir, { recursive: true });

  // PREFLIGHT plugin load (live path only): one stream-json system/init assertion.
  if (o.preflight !== false) {
    const pf = preflightPluginLoad(config);
    if (!pf.ok) return { ok: false, reason: 'preflight_failed', detail: pf };
  }

  // Enumerate submissions (injectable for selftests via _submissions).
  const subs = o._submissions || listSubmissions(o.submissionsDir);

  // Load ledger + seed any not-yet-seen unit as pending (visible transition floor).
  const ledger = loadLedger(ledgerPath);
  const runUnit = o.runUnit || defaultRunUnit;

  const state = {
    ledgerPath,
    failuresPath,
    onLedger: o.onLedger || null,
    halted: false,
    haltReason: null,
    haltDetail: null,
    rateLimitHits: 0,
    fuseTrips: 0,
    failures: [],
    window: [],
    total: subs.length,
  };

  for (const s of subs) {
    if (!ledger[s.subId]) ledger[s.subId] = { status: 'pending', attempts: 0, cost: 0 };
  }
  writeLedger(state, ledger);

  // Resume: skip any unit already done (ledger OR .done marker).
  const pending = subs.filter((s) => !isDone(s.subId, ledger, outDir));
  const skipped = subs.length - pending.length;

  const maxRetries = typeof o.maxRetries === 'number' ? o.maxRetries : 2;

  // The worker: mark running (transition), then run the retry loop for the unit.
  const worker = async (sub) => {
    ledger[sub.subId] = Object.assign({}, ledger[sub.subId], { status: 'running' });
    writeLedger(state, ledger);
    return attemptSubmission(sub, { config, outDir, roomsDir, runUnit, maxRetries });
  };

  const getLimit = () => {
    if (state.halted) return 0;
    // Repeated rate_limit signals -> serial (never more retries on top).
    return state.rateLimitHits >= RATE_LIMIT_SERIAL_THRESHOLD ? 1 : config.concurrency;
  };

  const onSettle = (settled) => {
    const sub = settled.item;
    const res = settled.res || { ok: false, reason: 'worker_threw', detail: String(settled.err && settled.err.message || settled.err) };
    ledger[sub.subId] = {
      status: res.ok ? 'done' : 'failed',
      attempts: res.attempts || 1,
      cost: res.cost || 0,
    };
    writeLedger(state, ledger);

    state.window.push(res.ok ? 1 : 0);
    if (isRateLimited(res)) state.rateLimitHits++;
    if (isBudgetTrip(res)) state.fuseTrips++;
    if (!res.ok) appendFailure(state, sub, res);

    if (res.ok) {
      // G3 Part-8 egress: ANY hit HALTS THE ENTIRE BATCH + pages human.
      const g3 = checkG3(res);
      if (!g3.ok) { haltBatch(state, 'G3', 'Part-8 egress hit on ' + sub.subId + ': ' + JSON.stringify((g3.hits || []).slice(0, 2))); return; }
      // G4 model provenance: any mismatch HALTS THE BATCH (fairness broken).
      const g4 = checkG4(res, config.model);
      if (!g4.ok) { haltBatch(state, 'G4', 'model_id mismatch on ' + sub.subId + ': ' + g4.detail); return; }
      // Cleanup scratch room after .done (no residue, close db handles).
      cleanupRoom(res.roomDir);
    }

    // G5 cost fuse: > 2% of units trip the --max-budget-usd fuse -> PAUSE (systemic).
    if (state.total > 0 && state.fuseTrips / state.total > 0.02) {
      haltBatch(state, 'G5', 'cost fuse tripped on ' + state.fuseTrips + '/' + state.total + ' units (> 2%)');
      return;
    }
    // Failure-rate alert: >= 5% over a rolling 20-window -> STOP (systemic bug).
    if (state.window.length >= 20) {
      const last20 = state.window.slice(-20);
      const fails = last20.filter((x) => x === 0).length;
      if (fails / 20 >= 0.05) { haltBatch(state, 'failure-rate', fails + '/20 failed in the rolling window (>= 5%)'); return; }
    }
  };

  await runPool({ items: pending, getLimit, worker, onSettle });

  let completed = 0;
  let failed = 0;
  for (const s of subs) {
    const st = ledger[s.subId] && ledger[s.subId].status;
    if (st === 'done') completed++;
    else if (st === 'failed') failed++;
  }

  // Aggregation: cohort report (only when the batch was not halted).
  let aggregation = null;
  if (!state.halted) aggregation = runAggregation(outDir, config.aggregateModel);

  return {
    ok: !state.halted,
    halted: state.halted,
    haltReason: state.haltReason,
    haltDetail: state.haltDetail,
    completed,
    failed,
    skipped,
    total: subs.length,
    failuresCount: state.failures.length,
    ledgerPath,
    outDir,
    failuresPath,
    aggregation,
  };
}

// --------------------------------------------------------------------------
// Stub helpers shared by the CLI selftests (no model calls).
// --------------------------------------------------------------------------
function makeStubSubs(n) {
  const subs = [];
  for (let i = 0; i < n; i++) {
    const id = 'stub-' + String(i + 1).padStart(4, '0');
    subs.push({ subId: id, transcriptPath: null, deckPath: null, _entity: 'ZebraVenture' + String(i + 1).padStart(4, '0') });
  }
  return subs;
}

// Write a stub unit's artifacts + .done (mirrors the runOne output layout). The
// feedback.md contains ONLY this unit's distinctive entity (cross-bleed fixture).
function writeStubUnit(ws, sub, o) {
  o = o || {};
  const outUnit = path.join(ws, 'out', sub.subId);
  const roomDir = path.join(ws, 'rooms', sub.subId);
  fs.mkdirSync(outUnit, { recursive: true });
  fs.mkdirSync(roomDir, { recursive: true });
  const evidence = {
    submission_id: sub.subId,
    problem_claim: { stated: true, quote: sub._entity + ' addresses a real problem', timestamp: null },
    entities: [sub._entity],
  };
  fs.writeFileSync(path.join(outUnit, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(outUnit, 'feedback.md'), '# Feedback: ' + sub.subId + '\n\n' + sub._entity + ' shows a clear concept; its main gap is unproven demand.\n', 'utf8');
  fs.writeFileSync(path.join(outUnit, 'result.json'), JSON.stringify({
    submission_id: sub.subId, model_id: o.model || PINNED_MODEL_DEFAULT, total_cost_usd: o.cost != null ? o.cost : 0.5, session_id: 'sess-' + sub.subId,
  }, null, 2) + '\n', 'utf8');
  if (o.leak) {
    fs.writeFileSync(path.join(roomDir, 'brain-query-log.jsonl'), JSON.stringify({ payload: { question: 'how should I grade the ' + sub._entity + ' pitch' } }) + '\n', 'utf8');
  }
  fs.writeFileSync(path.join(outUnit, '.done'), new Date().toISOString() + '\n', 'utf8');
  return {
    subId: sub.subId, ok: true, cost: o.cost != null ? o.cost : 0.5, roomDir,
    outDir: outUnit,
    evidencePath: path.join(outUnit, 'evidence.json'),
    feedbackPath: path.join(outUnit, 'feedback.md'),
    resultPath: path.join(outUnit, 'result.json'),
    donePath: path.join(outUnit, '.done'),
    session_id: 'sess-' + sub.subId,
    model_id: o.model || PINNED_MODEL_DEFAULT,
  };
}

// --------------------------------------------------------------------------
// --dry-run <N>: simulate the pool over N stub submissions (no model calls),
// verifying ledger pending -> running -> done transitions, the concurrency cap,
// and resume-skip (a second run does zero work).
// --------------------------------------------------------------------------
async function cliDryRun(n) {
  const assert = require('node:assert');
  const ws = mkTmpWorkspace('huji-batch-dryrun-');
  try {
    const seenStatuses = new Set();
    const live = { cur: 0, max: 0 };
    const runUnit = async (sub) => {
      live.cur++; live.max = Math.max(live.max, live.cur);
      await tick();
      const r = writeStubUnit(ws, sub, { leak: false, model: PINNED_MODEL_DEFAULT });
      live.cur--;
      return r;
    };
    const onLedger = (snap) => { for (const k of Object.keys(snap)) seenStatuses.add(snap[k]); };

    const res = await runBatch({
      config: { concurrency: 3, model: PINNED_MODEL_DEFAULT },
      workspaceDir: ws,
      preflight: false,
      _submissions: makeStubSubs(n),
      runUnit,
      onLedger,
    });

    assert.ok(res.ok, 'dry-run batch should complete ok: ' + JSON.stringify(res));
    assert.strictEqual(res.completed, n, 'all ' + n + ' units should reach done');
    assert.ok(seenStatuses.has('pending'), 'ledger must show a pending transition');
    assert.ok(seenStatuses.has('running'), 'ledger must show a running transition');
    assert.ok(seenStatuses.has('done'), 'ledger must show a done transition');
    assert.ok(live.max <= 3, 'concurrency must be capped at config.concurrency (saw max ' + live.max + ')');
    assert.ok(live.max > 1 || n === 1, 'pool should run more than one unit concurrently for N>1 (saw ' + live.max + ')');

    // Resume: a second run must skip every done unit (runUnit throws if called).
    const resumeRunUnit = async (sub) => { throw new Error('resume must NOT re-run done unit ' + sub.subId); };
    const res2 = await runBatch({
      config: { concurrency: 3, model: PINNED_MODEL_DEFAULT },
      workspaceDir: ws,
      preflight: false,
      _submissions: makeStubSubs(n),
      runUnit: resumeRunUnit,
    });
    assert.ok(res2.ok, 'resume run should complete ok');
    assert.strictEqual(res2.skipped, n, 'resume must skip all ' + n + ' done units');

    console.log('=== huji-batch --dry-run ' + n + ' ===');
    console.log('  ledger transitions observed: ' + [...seenStatuses].sort().join(' -> '));
    console.log('  concurrency: capped at 3, max-in-flight observed = ' + live.max);
    console.log('  resume: skipped ' + res2.skipped + '/' + n + ' done units (zero re-runs)');
    console.log('OK - dry-run assertions passed (no model called).');
  } finally {
    fs.rmSync(ws, { recursive: true, force: true });
  }
}

// --------------------------------------------------------------------------
// --dry-run-failure: exercise (1) the retry -> failures.md path, and (2) the two
// mechanism-broken batch halts - a simulated Part-8 hit (G3) and a model_id
// mismatch (G4). No model calls (stub runUnit).
// --------------------------------------------------------------------------
async function cliDryRunFailure() {
  const assert = require('node:assert');

  // Scenario 1: subA fails twice then succeeds (retry, fresh room); subB always
  // fails -> failures.md with truncated stderr + last session_id.
  const ws = mkTmpWorkspace('huji-batch-failure-');
  try {
    const tries = {};
    const runUnit = async (sub) => {
      tries[sub.subId] = (tries[sub.subId] || 0) + 1;
      await tick();
      if (sub.subId === 'stub-0001') {
        if (tries[sub.subId] < 3) return { subId: sub.subId, ok: false, reason: 'stageB_nonzero', detail: 'transient boom', session_id: 'sess-A-' + tries[sub.subId] };
        return writeStubUnit(ws, sub, { model: PINNED_MODEL_DEFAULT });
      }
      return { subId: sub.subId, ok: false, reason: 'stageB_nonzero', detail: 'permanent boom', session_id: 'sess-B-final' };
    };
    const subs = [{ subId: 'stub-0001', _entity: 'ZebraA' }, { subId: 'stub-0002', _entity: 'ZebraB' }];
    const res = await runBatch({ config: { concurrency: 2, model: PINNED_MODEL_DEFAULT }, workspaceDir: ws, preflight: false, _submissions: subs, runUnit, maxRetries: 2 });
    assert.ok(res.ok && !res.halted, 'transient failures alone must not halt the batch');
    assert.strictEqual(tries['stub-0001'], 3, 'subA should retry to success on attempt 3 (got ' + tries['stub-0001'] + ')');
    assert.strictEqual(tries['stub-0002'], 3, 'subB should exhaust 1 + 2 retries (got ' + tries['stub-0002'] + ')');
    const failuresMd = fs.readFileSync(path.join(ws, 'failures.md'), 'utf8');
    assert.ok(/stub-0002/.test(failuresMd), 'failures.md must list the failed unit');
    assert.ok(/sess-B-final/.test(failuresMd), 'failures.md must carry the last session_id');
    assert.ok(/permanent boom/.test(failuresMd), 'failures.md must carry the truncated stderr');
    const ledger = JSON.parse(fs.readFileSync(path.join(ws, 'batch-state.json'), 'utf8'));
    assert.strictEqual(ledger['stub-0001'].status, 'done', 'subA ledger status must be done');
    assert.strictEqual(ledger['stub-0002'].status, 'failed', 'subB ledger status must be failed');
    console.log('=== huji-batch --dry-run-failure ===');
    console.log('  retry: subA failed x2 then succeeded on attempt ' + tries['stub-0001'] + ' (fresh room each attempt)');
    console.log('  failures.md: subB exhausted retries -> stderr + last session_id recorded');
  } finally { fs.rmSync(ws, { recursive: true, force: true }); }

  // Scenario 2: a Part-8 (G3) egress hit HALTS the whole batch + pages the human.
  const ws2 = mkTmpWorkspace('huji-batch-g3halt-');
  try {
    const runUnit = async (sub) => { await tick(); return writeStubUnit(ws2, sub, { leak: true, model: PINNED_MODEL_DEFAULT }); };
    const res = await runBatch({ config: { concurrency: 2, model: PINNED_MODEL_DEFAULT }, workspaceDir: ws2, preflight: false, _submissions: makeStubSubs(3), runUnit });
    assert.ok(res.halted && res.haltReason === 'G3', 'a Part-8 (G3) egress hit must HALT the batch (got ' + res.haltReason + ')');
    console.log('  simulated Part-8 hit (G3): batch HALTED + human paged (haltReason=' + res.haltReason + ')');
  } finally { fs.rmSync(ws2, { recursive: true, force: true }); }

  // Scenario 3: a model_id mismatch (G4) HALTS the batch (cohort fairness broken).
  const ws3 = mkTmpWorkspace('huji-batch-g4halt-');
  try {
    const runUnit = async (sub) => { await tick(); return writeStubUnit(ws3, sub, { leak: false, model: 'claude-sonnet-5' }); };
    const res = await runBatch({ config: { concurrency: 2, model: PINNED_MODEL_DEFAULT }, workspaceDir: ws3, preflight: false, _submissions: makeStubSubs(3), runUnit });
    assert.ok(res.halted && res.haltReason === 'G4', 'a model_id mismatch (G4) must HALT the batch (got ' + res.haltReason + ')');
    console.log('  simulated model mismatch (G4): batch HALTED (haltReason=' + res.haltReason + ')');
  } finally { fs.rmSync(ws3, { recursive: true, force: true }); }

  console.log('OK - dry-run-failure assertions passed (retry, failures.md, G3 + G4 batch halt; no model called).');
}

// --------------------------------------------------------------------------
// --test-d10 / --selftest-killresume: the D10 harness leg (AI-SPEC Section 5).
// A deterministic, model-free proof of kill/resume correctness + cross-student
// isolation. Stub runUnit writes fixtures; no model is called. This is the guard
// file that makes the run-all-229 D10 leg RUN (no longer SKIP).
// --------------------------------------------------------------------------
async function cliTestD10() {
  const assert = require('node:assert');
  const ws = mkTmpWorkspace('huji-batch-d10-');
  try {
    const N = 4;
    const subs = makeStubSubs(N); // stub-0001..0004, each with a distinctive entity

    // Phase 1: run the full cohort to done.
    const ran1 = [];
    const runUnit1 = async (sub) => { ran1.push(sub.subId); await tick(); return writeStubUnit(ws, sub, { leak: false }); };
    const r1 = await runBatch({ config: { concurrency: 2, model: PINNED_MODEL_DEFAULT }, workspaceDir: ws, preflight: false, _submissions: subs, runUnit: runUnit1 });
    assert.ok(r1.ok, 'phase-1 batch should complete');
    assert.strictEqual(r1.completed, N, 'phase-1: all ' + N + ' units done');

    // Simulate a KILL mid-batch: drop .done + reset the ledger to running for 2
    // units, as if the orchestrator died after starting them but before .done.
    const interrupted = ['stub-0002', 'stub-0004'];
    const survived = ['stub-0001', 'stub-0003'];
    const ledger = JSON.parse(fs.readFileSync(path.join(ws, 'batch-state.json'), 'utf8'));
    for (const id of interrupted) {
      fs.rmSync(path.join(ws, 'out', id, '.done'), { force: true });
      ledger[id] = { status: 'running', attempts: 1, cost: 0 };
    }
    fs.writeFileSync(path.join(ws, 'batch-state.json'), JSON.stringify(ledger, null, 2) + '\n', 'utf8');

    // Record survived-unit feedback mtimes (must NOT be rewritten on resume).
    const mtimeBefore = {};
    for (const id of survived) mtimeBefore[id] = fs.statSync(path.join(ws, 'out', id, 'feedback.md')).mtimeMs;
    await new Promise((r) => setTimeout(r, 12)); // mtime-resolution gap to catch a rewrite

    // Phase 2: RESUME. Track which units re-run + whether the room was fresh.
    const ran2 = [];
    const freshRoom = {};
    const runUnit2 = async (sub) => {
      ran2.push(sub.subId);
      // attemptSubmission rm's the room before calling us: it must not preexist.
      freshRoom[sub.subId] = !fs.existsSync(path.join(ws, 'rooms', sub.subId));
      await tick();
      return writeStubUnit(ws, sub, { leak: false });
    };
    const r2 = await runBatch({ config: { concurrency: 2, model: PINNED_MODEL_DEFAULT }, workspaceDir: ws, preflight: false, _submissions: subs, runUnit: runUnit2 });
    assert.ok(r2.ok, 'resume batch should complete');

    // (a) done units skipped on resume.
    for (const id of survived) assert.ok(!ran2.includes(id), 'resume must SKIP done unit ' + id);
    assert.strictEqual(r2.skipped, survived.length, 'resume skip count must equal the done units');
    // (b) interrupted units re-run in FRESH scratch rooms.
    for (const id of interrupted) {
      assert.ok(ran2.includes(id), 'resume must re-run interrupted unit ' + id);
      assert.ok(freshRoom[id], 'resume must re-run ' + id + ' in a FRESH scratch room');
    }
    // (c) no artifact double-written for the survived (already-done) units.
    for (const id of survived) {
      const after = fs.statSync(path.join(ws, 'out', id, 'feedback.md')).mtimeMs;
      assert.strictEqual(after, mtimeBefore[id], 'survived unit ' + id + ' feedback.md must NOT be rewritten on resume');
    }

    // Cross-bleed: no student's distinctive entity appears in any OTHER feedback.md.
    let bleeds = 0;
    for (const a of subs) {
      for (const b of subs) {
        if (a.subId === b.subId) continue;
        const other = fs.readFileSync(path.join(ws, 'out', b.subId, 'feedback.md'), 'utf8');
        if (other.includes(a._entity)) { bleeds++; console.error('CROSS-BLEED: ' + a.subId + ' entity in ' + b.subId + ' feedback.md'); }
      }
    }
    assert.strictEqual(bleeds, 0, 'zero cross-student entity bleed across feedback.md');

    console.log('=== huji-batch --test-d10 (kill/resume + cross-bleed) ===');
    console.log('  phase 1: ' + N + ' units to done');
    console.log('  kill simulated: dropped .done for ' + interrupted.join(', '));
    console.log('  resume: skipped ' + survived.join(', ') + ' (done); re-ran ' + interrupted.join(', ') + ' in FRESH rooms; zero double-write');
    console.log('  cross-bleed: 0 of any student entity found in any other feedback.md');
    console.log('OK - D10 kill/resume + cross-bleed passed (deterministic, no model called).');
  } finally { fs.rmSync(ws, { recursive: true, force: true }); }
}

function usage() {
  console.log('Usage: node scripts/huji-batch.cjs <--dry-run N | --dry-run-failure | --test-d10 | --selftest-killresume>');
  console.log('  (runBatch is consumed programmatically over an out-of-tree workspace.)');
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  (async () => {
    try {
      if (argv.includes('--test-d10') || argv.includes('--selftest-killresume')) { await cliTestD10(); process.exit(0); }
      if (argv.includes('--dry-run-failure')) { await cliDryRunFailure(); process.exit(0); }
      if (argv.includes('--dry-run')) {
        const n = parseInt(argv[argv.indexOf('--dry-run') + 1], 10) || 5;
        await cliDryRun(n);
        process.exit(0);
      }
      usage();
      process.exit(0);
    } catch (e) {
      console.error('FAILED:', e && e.message ? e.message : e);
      process.exit(1);
    }
  })();
}

module.exports = {
  runBatch,
  resolveBatchConfig,
  assertPinnedModelId,
  assertOutsideRepo,
  preflightPluginLoad,
  runPool,
  attemptSubmission,
  checkG3,
  checkG4,
  runAggregation,
  collectStrings,
  listSubmissions,
};
