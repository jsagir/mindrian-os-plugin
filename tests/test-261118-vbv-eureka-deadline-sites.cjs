#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261118-vbv (Task B): the plugin deadline of plan 392-07 rides on the 7
 * Eureka call sites that main had without it: recover (scout_status,
 * scout_result, getContract), forgetOnEngine (scout_status, scout_delete_job)
 * and planPairScreen (getCatalog, the plan_tool call). Without it the MCP
 * client default of 60 s wins.
 *
 * Legs:
 *   D1  recover status (record only): scout_status gets timeout = the configured
 *       MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS (4321), maxTotalTimeout = timeout, a
 *       signal key.
 *   D2  recover result: scout_result and scout_capability_contract get the same.
 *   D3  forget: a live session (deadline = session.call_deadline_ms) and the
 *       record-only child path (deadline = configured) pass the options on
 *       scout_status and scout_delete_job.
 *   D4  pair-screen plan: scout_capabilities and the plan_tool call get them.
 *   D5  a request timeout (code -32001): recover status and result give
 *       engine_timeout with capability_id, job_id and persistence
 *       eureka_job_store_only; planPairScreen gives engine_timeout, never
 *       engine_start_failed; forget keeps engine_forget_error.
 *   D6  source scan of lib/mcp/tools/eureka-*.cjs and lib/mcp/eureka-*.cjs: no
 *       callTool options argument is a bare { signal } or { signal: p.signal };
 *       every getCatalog or getContract call passes a callOpts argument.
 *
 * In-process fake clients. No engine, no network, no sleep. Prints "ok - Dn"
 * or "FAIL - Dn"; exit 1 on a failure. No em dash and no en dash.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vbv-eureka-deadline-'));
const HOME = path.join(TMP, 'home');
fs.mkdirSync(HOME);
const SAVED = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, MINDRIAN_EUREKA_ROOT: process.env.MINDRIAN_EUREKA_ROOT,
  MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS: process.env.MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS };
let engineN = 0;
function freshEngine() {
  engineN += 1;
  const dir = path.join(TMP, 'engine-' + engineN);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'pyproject.toml'), '[project]\nname = "mindrian-eureka"\n\n[project.scripts]\neureka-mcp = "fixture:main"\n');
  return dir;
}
let ENGINE = freshEngine();
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
process.env.MINDRIAN_EUREKA_ROOT = ENGINE;
delete process.env.MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS;

const DEADLINE = 4321;
const LIVE_DEADLINE = 3456;
const contract = require(path.join(REPO, 'lib', 'mcp', 'eureka-tool-contract.cjs'));
const jobs = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-jobs.cjs'));
const run = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-run.cjs'));
const pairScreen = require(path.join(REPO, 'lib', 'mcp', 'eureka-pair-screen.cjs'));
const jobRecord = require(path.join(REPO, 'lib', 'mcp', 'eureka-job-record.cjs'));

const GENERIC = 'opportunity.find_cross_domain_pairs';
const PAIR_ID = pairScreen.PAIR_SCREEN_CAPABILITY_ID;
const PLAN_TOOL = 'scout_plan_pair_screen';
const SESSION = 'vbv-session-d';
const DAY = 24 * 60 * 60 * 1000;
const EXTRA = { sessionId: SESSION };

let failed = 0;
async function leg(id, label, fn) {
  try {
    run.clearCatalogCache();
    resetModule();
    ENGINE = freshEngine();
    await fn();
    process.stdout.write('ok - ' + id + ' ' + label + '\n');
  } catch (err) {
    failed += 1;
    const msg = (err && err.message) ? String(err.message).split('\n')[0] : String(err);
    process.stdout.write('FAIL - ' + id + ' ' + label + ' :: ' + msg + '\n');
  }
}
function resetModule() {
  for (const session of jobs.sessions.values()) { if (session.timer) clearTimeout(session.timer); }
  jobs.sessions.clear();
  jobs.resultPages.clear();
  contract.setProbeDeps({
    needsForCall: () => ({}),
    extrasInstalled: () => ({ venv_present: true, located: false, installed: {} }),
    nodeStatus: () => ({ ok: true }),
  });
}
function hex(text) { return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex'); }
function sc(payload) { return { structuredContent: payload, content: [{ type: 'text', text: JSON.stringify(payload) }] }; }
function iso(ms) { return new Date(ms).toISOString(); }

function makeWorld(envExtra) {
  const log = { calls: [], clients: [] };
  const engine = { status: 'completed', jobN: 0, timeoutOn: new Set() };
  class FakeTransport { constructor(options) { this.options = options; this.stderr = null; } }
  class FakeClient {
    constructor() { this.closed = false; log.clients.push(this); }
    async connect() { /* nothing */ }
    async close() { this.closed = true; }
    async callTool(call, opts) {
      log.calls.push({ name: call.name, opts: opts });
      if (engine.timeoutOn.has(call.name)) {
        const e = new Error('Request timed out');
        e.code = -32001;
        throw e;
      }
      const args = call.arguments || {};
      switch (call.name) {
        case 'scout_capabilities':
          return sc({ capabilities: [
            { id: GENERIC, status: 'experimental', routes: { mcp: { tool: 'scout_start' } } },
            { id: PAIR_ID, status: 'experimental', routes: { mcp: { tool: 'scout_start_pair_screen', plan_tool: PLAN_TOOL } } },
          ] });
        case 'scout_capability_contract':
          return sc({ capability: { id: args.capability_id }, schemas: { input: { type: 'object' }, output: { type: 'object' } } });
        case 'scout_start':
          engine.jobN += 1;
          return sc({ job_id: 'job-d-' + engine.jobN, status: 'queued' });
        case 'scout_status':
          return sc({ status: engine.status, progress: 'done', events: [] });
        case 'scout_result':
          return sc({ status: engine.status });
        case 'scout_delete_job':
          return sc({ job_id: args.job_id, deleted: true });
        case 'scout_cancel':
          return sc({ status: 'cancellation_requested' });
        case PLAN_TOOL:
          return sc({ status: 'invalid' });
        default:
          throw new Error('unexpected call ' + call.name);
      }
    }
  }
  const ident = { hash: hex(SESSION), room: 'room-d' };
  const deps = {
    env: Object.assign({ MINDRIAN_EUREKA_ROOT: ENGINE, HOME, MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS: String(DEADLINE) }, envExtra || {}),
    ctx: { surface: 'cli' },
    server: { registerTool() {}, server: { getClientCapabilities() { return {}; } } },
    Client: FakeClient,
    StdioClientTransport: FakeTransport,
    callerIdentity: () => ({ sessionKeyHash: ident.hash, roomId: ident.room }),
  };
  const optsOf = (name) => log.calls.filter((c) => c.name === name).map((c) => c.opts);
  return { log, engine, deps, ident, optsOf };
}

function baseOf(room) {
  const r = jobRecord.resolveBase({ room_id: room, env: { HOME } });
  assert.equal(r.ok, true);
  return r.base;
}
function plant(w, jobId, patch) {
  const now = Date.now();
  const record = Object.assign({
    job_id: jobId, capability_id: GENERIC, route: 'scout_start', scope_id: 'room:d', snapshot_id: 'snap-d', room_id: w.ident.room,
    session_key_hash: hex('someone-else'), request_sha256: hex('r'), artifact_count: 1, top_k: 4, plan_digest: null, approval_ref: null,
    idempotency_key: null, started_at: iso(now - 1000), engine_expires_at: iso(now + 30 * DAY), last_status: 'running',
    last_status_at: iso(now - 1000), terminal: false, manifest_sha256: null,
  }, patch || {});
  assert.equal(jobRecord.recordStart(baseOf(record.room_id), record).ok, true);
  return record;
}
function assertDeadline(opts, ms, where) {
  assert.ok(opts && typeof opts === 'object', where + ': no options object');
  assert.equal(opts.timeout, ms, where + ': timeout ' + opts.timeout);
  assert.equal(opts.maxTotalTimeout, opts.timeout, where + ': maxTotalTimeout ' + opts.maxTotalTimeout);
  assert.ok(Object.prototype.hasOwnProperty.call(opts, 'signal'), where + ': no signal key');
}
function lastOpts(w, name) {
  const all = w.optsOf(name);
  assert.ok(all.length > 0, 'no ' + name + ' call');
  return all[all.length - 1];
}
function pairRequest() {
  return { scope_id: 'room:d', snapshot_id: 'snap-d', objective: 'Find unusual pairs', artifacts: [{ id: 'n1', title: 't', text: 'x' }] };
}

async function main() {
  await leg('D1', 'recover status carries the configured deadline on scout_status', async () => {
    const w = makeWorld();
    plant(w, 'job-d1', {});
    w.engine.status = 'running';
    const out = await jobs.jobStatus({ job_id: 'job-d1' }, EXTRA, w.deps);
    assert.equal(out.recovered, true, JSON.stringify(out).slice(0, 200));
    assertDeadline(lastOpts(w, 'scout_status'), DEADLINE, 'scout_status');
  });

  await leg('D2', 'recover result carries the deadline on scout_result and scout_capability_contract', async () => {
    const w = makeWorld();
    plant(w, 'job-d2', { last_status: 'completed', terminal: true });
    w.engine.status = 'completed';
    await jobs.jobResult({ job_id: 'job-d2' }, EXTRA, w.deps);
    assertDeadline(lastOpts(w, 'scout_result'), DEADLINE, 'scout_result');
    assertDeadline(lastOpts(w, 'scout_capability_contract'), DEADLINE, 'scout_capability_contract');
  });

  await leg('D3', 'forget carries the session deadline (live) and the configured deadline (record only)', async () => {
    const w = makeWorld({ MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS: String(LIVE_DEADLINE) });
    const started = await jobs.startCapability({ capability_id: GENERIC, request: { scope_id: 'room:d', snapshot_id: 'snap-d', topic: 'topic d', artifacts: [{ id: 'n1', title: 't', text: 'x' }], top_k: 4 } }, EXTRA, w.deps);
    assert.equal(started.ok, true, 'start: ' + JSON.stringify(started).slice(0, 200));
    const session = jobs.sessions.get(started.job_id);
    assert.ok(session && session.call_deadline_ms === LIVE_DEADLINE, 'session deadline ' + (session && session.call_deadline_ms));
    w.engine.status = 'completed';
    const c0 = w.log.calls.length;
    const live = await jobs.forgetJob({ job_id: started.job_id, confirm: true }, EXTRA, w.deps);
    assert.equal(live.ok, true, JSON.stringify(live).slice(0, 200));
    const liveCalls = w.log.calls.slice(c0);
    assert.deepEqual(liveCalls.map((c) => c.name), ['scout_status', 'scout_delete_job']);
    liveCalls.forEach((c) => assertDeadline(c.opts, LIVE_DEADLINE, 'live ' + c.name));

    const w2 = makeWorld();
    plant(w2, 'job-d3', { last_status: 'completed', terminal: true });
    w2.engine.status = 'completed';
    const child = await jobs.forgetJob({ job_id: 'job-d3', confirm: true }, EXTRA, w2.deps);
    assert.equal(child.ok, true, JSON.stringify(child).slice(0, 200));
    const childCalls = w2.log.calls.filter((c) => c.name === 'scout_status' || c.name === 'scout_delete_job');
    assert.deepEqual(childCalls.map((c) => c.name), ['scout_status', 'scout_delete_job']);
    childCalls.forEach((c) => assertDeadline(c.opts, DEADLINE, 'child ' + c.name));
  });

  await leg('D4', 'the pair-screen plan carries the deadline on scout_capabilities and on the plan_tool call', async () => {
    const w = makeWorld();
    await pairScreen.planPairScreen({ request: pairRequest(), root: ENGINE, env: w.deps.env, signal: undefined, deps: w.deps });
    assertDeadline(lastOpts(w, 'scout_capabilities'), DEADLINE, 'scout_capabilities');
    assertDeadline(lastOpts(w, PLAN_TOOL), DEADLINE, PLAN_TOOL);
  });

  await leg('D5', 'a request timeout maps to engine_timeout at recover and at the pair-screen plan; forget keeps engine_forget_error', async () => {
    const w = makeWorld();
    plant(w, 'job-d5s', {});
    w.engine.timeoutOn.add('scout_status');
    const s = await jobs.jobStatus({ job_id: 'job-d5s' }, EXTRA, w.deps);
    assert.equal(s.reason, 'engine_timeout', 'status: ' + JSON.stringify(s).slice(0, 200));
    assert.equal(s.capability_id, GENERIC);
    assert.equal(s.job_id, 'job-d5s');
    assert.equal(s.persistence, 'eureka_job_store_only');
    assert.equal(s.recovered, true);
    assert.ok(/4 seconds/.test(s.message), 'the message names the limit: ' + s.message);

    const w2 = makeWorld();
    plant(w2, 'job-d5r', {});
    w2.engine.timeoutOn.add('scout_result');
    const r = await jobs.jobResult({ job_id: 'job-d5r' }, EXTRA, w2.deps);
    assert.equal(r.reason, 'engine_timeout', 'result: ' + JSON.stringify(r).slice(0, 200));
    assert.equal(r.capability_id, GENERIC);
    assert.equal(r.job_id, 'job-d5r');
    assert.equal(r.persistence, 'eureka_job_store_only');

    run.clearCatalogCache();
    const w3 = makeWorld();
    w3.engine.timeoutOn.add(PLAN_TOOL);
    const p = await pairScreen.planPairScreen({ request: pairRequest(), root: ENGINE, env: w3.deps.env, signal: undefined, deps: w3.deps });
    assert.equal(p.reason, 'engine_timeout', 'plan: ' + JSON.stringify(p).slice(0, 200));
    assert.notEqual(p.reason, 'engine_start_failed');

    run.clearCatalogCache();
    const w4 = makeWorld();
    w4.engine.timeoutOn.add('scout_capabilities');
    const p2 = await pairScreen.planPairScreen({ request: pairRequest(), root: freshEngine(), env: w4.deps.env, signal: undefined, deps: w4.deps });
    assert.equal(p2.reason, 'engine_timeout', 'plan catalog: ' + JSON.stringify(p2).slice(0, 200));

    const w5 = makeWorld();
    plant(w5, 'job-d5f', { last_status: 'completed', terminal: true });
    w5.engine.timeoutOn.add('scout_status');
    const f = await jobs.forgetJob({ job_id: 'job-d5f', confirm: true }, EXTRA, w5.deps);
    assert.equal(f.reason, 'engine_forget_error', 'forget: ' + JSON.stringify(f).slice(0, 200));
  });

  await leg('D6', 'source scan: no bare signal options on callTool; every getCatalog and getContract call passes callOpts', async () => {
    const files = [];
    for (const dir of [path.join(REPO, 'lib', 'mcp', 'tools'), path.join(REPO, 'lib', 'mcp')]) {
      for (const n of fs.readdirSync(dir)) if (/^eureka-.*\.cjs$/.test(n)) files.push(path.join(dir, n));
    }
    assert.ok(files.length >= 4, 'files ' + files.length);
    const bare = [];
    const short = [];
    for (const f of files) {
      const text = fs.readFileSync(f, 'utf8');
      const rel = path.relative(REPO, f);
      const re = /\},\s*\{\s*signal(?:\s*:\s*p\.signal)?\s*\}\s*\)/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const head = text.slice(Math.max(0, m.index - 400), m.index);
        if (/callTool\(/.test(head)) bare.push(rel + ':' + text.slice(0, m.index).split('\n').length);
      }
      const callRe = /\b(getCatalog|getContract)\(/g;
      while ((m = callRe.exec(text)) !== null) {
        const before = text.slice(Math.max(0, m.index - 16), m.index);
        if (/function\s+$/.test(before)) continue;
        let depth = 0; let i = m.index + m[1].length; let commas = 0;
        for (; i < text.length; i += 1) {
          const ch = text[i];
          if (ch === '(' || ch === '{' || ch === '[') depth += 1;
          else if (ch === ')' || ch === '}' || ch === ']') { depth -= 1; if (depth === 0) break; }
          else if (ch === ',' && depth === 1) commas += 1;
        }
        const need = m[1] === 'getCatalog' ? 3 : 4;
        if (commas < need) short.push(rel + ':' + text.slice(0, m.index).split('\n').length + ' ' + m[1]);
      }
    }
    assert.deepEqual(bare, [], 'bare signal options: ' + bare.join(', '));
    assert.deepEqual(short, [], 'a call without callOpts: ' + short.join(', '));
  });
}

main().then(() => {
  for (const k of Object.keys(SAVED)) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  console.log(failed === 0 ? 'test-261118-vbv-eureka-deadline-sites: all legs ok' : 'test-261118-vbv-eureka-deadline-sites: ' + failed + ' leg(s) failed');
  process.exit(failed === 0 ? 0 : 1);
}, (err) => {
  console.log('FAIL - main: ' + (err && err.message ? err.message : String(err)));
  process.exit(1);
});
