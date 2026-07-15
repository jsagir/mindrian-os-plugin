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
 * Isolation invariant: the orchestrator NEVER imports the chain (chain-executor);
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
// runBatch({config, submissionsDir, workspaceDir}) - the outer loop.
// Task 1 scope: preflight, pool, ledger, resume. Returns
// { ok, completed, skipped, ledgerPath, outDir }.
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
    onLedger: o.onLedger || null,
    halted: false,
    haltReason: null,
    rateLimitHits: 0,
  };

  for (const s of subs) {
    if (!ledger[s.subId]) ledger[s.subId] = { status: 'pending', attempts: 0, cost: 0 };
  }
  writeLedger(state, ledger);

  // Resume: skip any unit already done (ledger OR .done marker).
  const pending = subs.filter((s) => !isDone(s.subId, ledger, outDir));
  const skipped = subs.length - pending.length;

  // The worker: mark running (transition), run the unit, hand the result to onSettle.
  const worker = async (sub) => {
    ledger[sub.subId] = Object.assign({}, ledger[sub.subId], { status: 'running' });
    writeLedger(state, ledger);
    const res = await runUnit(sub, { config, outDir, roomsDir });
    return res;
  };

  const getLimit = () => {
    if (state.halted) return 0;
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
  };

  await runPool({ items: pending, getLimit, worker, onSettle });

  let completed = 0;
  for (const s of subs) if (ledger[s.subId] && ledger[s.subId].status === 'done') completed++;

  return { ok: true, completed, skipped, total: subs.length, ledgerPath, outDir };
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

function usage() {
  console.log('Usage: node scripts/huji-batch.cjs <--dry-run N | --dry-run-failure | --test-d10 | --selftest-killresume>');
  console.log('  (runBatch is consumed programmatically over an out-of-tree workspace.)');
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  (async () => {
    try {
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
  collectStrings,
  listSubmissions,
};
