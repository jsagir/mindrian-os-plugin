#!/usr/bin/env node
'use strict';

/**
 * Phase 374 plan 11, Task 1 (test T11): the interim engine_busy guard (card OD-6 = ENGINE-BUSY-GUARD,
 * decision D-11, research Pitfall 2, threats T-374-49 to T-374-52).
 *
 * Why: every new eureka-mcp process marks all running job rows failed when it opens the job store. A second
 * engine child inside this host process could therefore end a long run. The guard refuses the second call
 * before any child starts. It covers ONE host process only (the Eureka owner lock, EXT-01, does not exist yet).
 *
 * The engine is an in-process fake client. No engine, no network, no live run. A scratch HOME holds the records.
 *
 * Arms (one line each at column 1: "ok - B<n> ...", "skip - B<n> ..." or "FAIL - B<n> ..."):
 *   B1  a retained running job: an engine-using tool (eureka_capability_run, eureka_graph_analyze) answers
 *       engine_busy with the job id and the next step; the handler did not run and no child started; the answer
 *       holds no path and no engine text
 *   B2  eureka_graph_project and the three job lifecycle tools are not blocked while a job runs
 *   B3  after jobStatus reads a terminal state the same call proceeds; an unobserved job says to read its
 *       status first
 *   B4  closing the session (result, expiry) clears the guard; cancel clears it once status reads terminal
 *   B5  a second start while a job runs, and a start while another start is still connecting, answer
 *       engine_busy and create no second child
 *   B6  a pair-screen approval given while another job runs gives engine_busy, tells the person to plan again
 *       and does not call the start route; a new plan is refused before its child starts
 *   B7  when the engine client throws on a status call the session is marked unreachable and the guard clears
 *   B8  a recovery status call for a recorded job while another job runs gives engine_busy before any child
 *       starts; with no running job recovery still works (the 374-10 path is not broken)
 *   B9  the tool surface is pinned: the five job tool descriptions and schemas keep their fingerprint and
 *       test-270 prints the recorded budget line (both moved once, by plan 374-13)
 *
 * CJS. Hyphens only.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const util = require('node:util');

const REPO = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't374-11-busy-'));
const HOME = path.join(TMP, 'home');
const ENGINE = path.join(TMP, 'engine');
fs.mkdirSync(HOME);
fs.mkdirSync(ENGINE);
fs.writeFileSync(path.join(ENGINE, 'pyproject.toml'), '[project]\nname = "mindrian-eureka"\n\n[project.scripts]\neureka-mcp = "fixture:main"\n');
const SAVED = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, MINDRIAN_EUREKA_ROOT: process.env.MINDRIAN_EUREKA_ROOT };
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
process.env.MINDRIAN_EUREKA_ROOT = ENGINE;
function cleanup() {
  for (const k of Object.keys(SAVED)) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

const contract = require(path.join(REPO, 'lib', 'mcp', 'eureka-tool-contract.cjs'));
const jobs = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-jobs.cjs'));
const run = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-run.cjs'));
const gateLedger = require(path.join(REPO, 'lib', 'mcp', 'gate-ledger.cjs'));
let pairScreen = null;
try { pairScreen = require(path.join(REPO, 'lib', 'mcp', 'eureka-pair-screen.cjs')); } catch (_e) { pairScreen = null; }
const recordModulePath = path.join(REPO, 'lib', 'mcp', 'eureka-job-record.cjs');
const recordExists = fs.existsSync(recordModulePath);
const jobRecord = recordExists ? require(recordModulePath) : null;

const GENERIC = 'opportunity.find_cross_domain_pairs';
const PAIR = 'opportunity.run_pair_screen';
const SCOPE = 'room:b';
const SNAPSHOT = 'snap-b';
const SESSION = 'b-session-374-11';
const MARK = 'PLANTB-4c19';

// The BEFORE figures of this plan (HEAD baea19a8f, measured 2026-11-08).
// Plan 374-12 added the page argument to eureka_capability_job_result (schema bytes 47531 -> 47586). Plan 374-13 moved this line
// once, for the forget tool and the description rewrite: 76 tools, 37764 desc bytes, 47835 schema bytes, 85599 total.
const BASELINE_BUDGET_LINE = 'budget: 76 tools, 37764 desc bytes, 47835 schema bytes, 85599 total, ~21400 approx tokens (router 9 / atomic 67)';

let failed = 0;
// The check helper: run one arm, print one line. An arm may throw { skip: reason } to print a skip line.
async function chk(id, label, fn) {
  try {
    run.clearCatalogCache();
    resetModule();
    await fn();
    process.stdout.write('ok - ' + id + ' ' + label + '\n');
  } catch (err) {
    if (err && err.skip) { process.stdout.write('skip - ' + id + ' ' + err.skip + '\n'); return; }
    failed += 1;
    const msg = (err && err.message) ? String(err.message).split('\n')[0] : String(err);
    process.stdout.write('FAIL - ' + id + ' ' + label + ' :: ' + msg + '\n');
  }
}
function resetModule() {
  for (const session of jobs.sessions.values()) { if (session.timer) clearTimeout(session.timer); }
  jobs.sessions.clear();
  contract.setProbeDeps({
    needsForCall: () => ({}),
    extrasInstalled: () => ({ venv_present: true, located: false, installed: {} }),
    nodeStatus: () => ({ ok: true }),
  });
}

function hex(text) { return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex'); }
function sc(payload) { return { structuredContent: payload, content: [{ type: 'text', text: JSON.stringify(payload) }] }; }

function makeWorld() {
  const log = { transports: 0, clients: [], calls: [] };
  const engine = { status: 'running', throwStatus: false, jobN: 0, holdConnect: null, result: null };
  class FakeTransport { constructor(options) { log.transports += 1; this.options = options; this.stderr = null; } }
  class FakeClient {
    constructor() { this.closed = false; log.clients.push(this); }
    async connect() { if (engine.holdConnect) await engine.holdConnect; }
    async close() { this.closed = true; }
    async callTool(call) {
      log.calls.push(call.name);
      const args = call.arguments || {};
      switch (call.name) {
        case 'scout_capabilities':
          return sc({ capabilities: [
            { id: GENERIC, status: 'experimental', routes: { mcp: { tool: 'scout_start' } } },
            { id: PAIR, status: 'experimental', routes: { mcp: { tool: 'scout_start_pair_screen', plan_tool: 'scout_plan_pair_screen' } } },
          ] });
        case 'scout_capability_contract':
          return sc({ capability: { id: args.capability_id }, schemas: { input: { type: 'object' }, output: { type: 'object' } } });
        case 'scout_start':
          engine.jobN += 1;
          return sc({ job_id: 'job-b-' + engine.jobN, status: 'queued' });
        case 'scout_plan_pair_screen': {
          const request = args.request;
          return sc({
            schema_version: 'eureka.pair-screen-plan.v1', status: 'ready', label: 'candidate, not verified', capability_id: PAIR,
            plan_digest: hex(JSON.stringify(request)), expires_at: '2026-11-09T10:00:00Z', scope_id: request.scope_id,
            snapshot_id: request.snapshot_id, objective: request.objective, top_k: request.top_k === undefined ? 200 : request.top_k,
            counts: { artifacts: 3, text_bytes: 4242, records_usable: 2, records_dropped: 1 },
            engines: [{ name: 'Find Unusual Pairs Across a Research Collection', capability_id: 'opportunity.find_unusual_pairs' },
              { name: 'Rank Unusual Pairs by Wording and Meaning', capability_id: 'opportunity.rank_unusual_pairs_wording_meaning' }],
            model: { found: true, origin: 'local model source' }, outputs_expected: ['unusual-pairs.json'],
            network: 'denied; the run is offline and makes no network call',
            writes: { room: 'none', portfolio: 'none', job_store: 'kept 30 days' }, approval_required: true,
            how_to_approve: 'Ask the person.', stages: ['validate'], warnings: [], host_handoff: { state: 'awaiting_approval', owner: 'mindrianos' },
          });
        }
        case 'scout_start_pair_screen':
          engine.jobN += 1;
          return sc({ job_id: 'job-bp-' + engine.jobN, status: 'queued' });
        case 'scout_status':
          if (engine.throwStatus) throw new Error('engine client is gone ' + ENGINE + ' ' + MARK);
          return sc({ status: engine.status, progress: 'screening', events: [] });
        case 'scout_result':
          return sc(engine.result || { status: engine.status });
        case 'scout_cancel':
          return sc({ status: 'cancellation_requested' });
        default:
          throw new Error('unexpected call ' + call.name);
      }
    }
  }
  const ident = { hash: hex(SESSION), room: 'room-b' };
  const artifacts = ['n1', 'n2', 'n3'].map((id) => ({
    id, source_ref: 'mindrian-graph://node/' + id, title: MARK + '-t-' + id, text: MARK + ' text ' + id, sha256: hex(MARK + ' text ' + id),
  }));
  const deps = {
    env: { MINDRIAN_EUREKA_ROOT: ENGINE, HOME },
    ctx: { surface: 'cli' },
    server: { registerTool() {}, server: { getClientCapabilities() { return {}; } } },
    Client: FakeClient,
    StdioClientTransport: FakeTransport,
    callerIdentity: () => ({ sessionKeyHash: ident.hash, roomId: ident.room }),
    prepare: async () => ({ ok: true, scope_id: SCOPE, snapshot_id: SNAPSHOT, projection: {}, room_binding: { room_id: ident.room },
      bundle: { artifacts: JSON.parse(JSON.stringify(artifacts)) } }),
  };
  return { log, engine, deps, ident };
}

function genericRequest() {
  return { scope_id: SCOPE, snapshot_id: SNAPSHOT, topic: MARK + ' topic', artifacts: [{ id: 'n1', title: 't', text: 'x' }], top_k: 4 };
}
const EXTRA = { sessionId: SESSION };
async function startGeneric(w) {
  const out = await jobs.startCapability({ capability_id: GENERIC, request: genericRequest() }, EXTRA, w.deps);
  assert.equal(out.ok, true, 'generic start: ' + JSON.stringify(out).slice(0, 200));
  return out;
}

// A recording fake server and the real registerEurekaTool wrapper, so the real gate path is the one tested.
function makeServer() {
  const handlers = new Map();
  return { handlers, registerTool(name, _config, fn) { handlers.set(name, fn); } };
}
function registerStub(server, name) {
  const hit = { calls: 0 };
  contract.registerEurekaTool(server, name, { title: name, description: 'stub', inputSchema: {} }, async () => {
    hit.calls += 1;
    return contract.response({ ok: true, reason: 'stub_ran' }, false);
  });
  return hit;
}
async function callTool(server, name) { return server.handlers.get(name)({}, EXTRA); }
function allText(value) { return JSON.stringify(value); }

function needGuard() {
  assert.equal(typeof contract.engineBusyRefusal, 'function', 'engineBusyRefusal is not exported yet');
  assert.equal(typeof contract.setBusyProbe, 'function', 'setBusyProbe is not exported yet');
}

async function main() {
  await chk('B1', 'a running job makes engine-using tools answer engine_busy; handler and child do not run', async () => {
    needGuard();
    const w = makeWorld();
    const started = await startGeneric(w);
    const server = makeServer();
    const hits = { run: registerStub(server, 'eureka_capability_run'), analyze: registerStub(server, 'eureka_graph_analyze') };
    const before = { transports: w.log.transports, calls: w.log.calls.length, clients: w.log.clients.length };
    for (const name of ['eureka_capability_run', 'eureka_graph_analyze']) {
      const out = await callTool(server, name);
      assert.equal(out.isError, true, name + ' was not an error');
      const body = out.structuredContent;
      assert.equal(body.ok, false);
      assert.equal(body.reason, 'engine_busy', name + ': ' + body.reason);
      assert.equal(body.job_id, started.job_id);
      assert.ok(String(body.message).indexOf(started.job_id) !== -1, 'the message does not name the job id');
      assert.ok(/status/.test(body.message) && /cancel/.test(body.message), 'the next step is missing');
      assert.ok(typeof body.fix === 'string' && body.fix.length > 0, 'no fix');
      const text = allText(out);
      assert.ok(text.indexOf(ENGINE) === -1 && text.indexOf(HOME) === -1 && text.indexOf(MARK) === -1, 'path or planted text in the answer');
    }
    assert.equal(hits.run.calls + hits.analyze.calls, 0, 'a handler ran');
    assert.equal(w.log.transports, before.transports, 'a child started');
    assert.equal(w.log.clients.length, before.clients);
    assert.equal(w.log.calls.length, before.calls, 'the engine client received a call');
  });

  await chk('B2', 'eureka_graph_project and the three job tools are not blocked while a job runs', async () => {
    needGuard();
    const w = makeWorld();
    const started = await startGeneric(w);
    const server = makeServer();
    const names = ['eureka_graph_project', 'eureka_capability_job_status', 'eureka_capability_job_result', 'eureka_capability_job_cancel'];
    const hits = names.map((n) => registerStub(server, n));
    for (const name of names) {
      const out = await callTool(server, name);
      assert.equal(out.structuredContent.reason, 'stub_ran', name + ' was blocked: ' + out.structuredContent.reason);
    }
    assert.deepEqual(hits.map((h) => h.calls), [1, 1, 1, 1]);
    // the real lifecycle functions of a job this process owns still answer
    const status = await jobs.jobStatus({ job_id: started.job_id }, EXTRA, w.deps);
    assert.equal(status.ok, true, JSON.stringify(status).slice(0, 200));
    assert.equal(status.status, 'running');
    const cancel = await jobs.cancelJob({ job_id: started.job_id }, EXTRA, w.deps);
    assert.equal(cancel.ok, true, JSON.stringify(cancel).slice(0, 200));
  });

  await chk('B3', 'a terminal status clears the guard; an unobserved job says to read its status first', async () => {
    needGuard();
    const w = makeWorld();
    const started = await startGeneric(w);
    const server = makeServer();
    const hit = registerStub(server, 'eureka_capability_run');
    const first = (await callTool(server, 'eureka_capability_run')).structuredContent;
    assert.equal(first.reason, 'engine_busy');
    assert.ok(/read its status first/.test(first.message), 'the unobserved sentence is missing');
    // a running status read: still busy, and the unobserved sentence is gone
    w.engine.status = 'running';
    await jobs.jobStatus({ job_id: started.job_id }, EXTRA, w.deps);
    const second = (await callTool(server, 'eureka_capability_run')).structuredContent;
    assert.equal(second.reason, 'engine_busy');
    assert.ok(!/read its status first/.test(second.message), 'the unobserved sentence stayed after a status read');
    // a terminal status read: the same call proceeds
    w.engine.status = 'completed';
    const read = await jobs.jobStatus({ job_id: started.job_id }, EXTRA, w.deps);
    assert.equal(read.status, 'completed');
    const third = (await callTool(server, 'eureka_capability_run')).structuredContent;
    assert.equal(third.reason, 'stub_ran', 'still busy after a terminal status: ' + third.reason);
    assert.equal(hit.calls, 1);
  });

  await chk('B4', 'closing the session (result, expiry) clears the guard; cancel clears it when status reads terminal', async () => {
    needGuard();
    const w = makeWorld();
    const server = makeServer();
    registerStub(server, 'eureka_capability_run');
    const busy = async () => (await callTool(server, 'eureka_capability_run')).structuredContent.reason === 'engine_busy';
    // result closes the session
    const a = await startGeneric(w);
    assert.equal(await busy(), true);
    w.engine.status = 'completed';
    w.engine.result = { capability_id: GENERIC, status: 'completed', scope: { scope_id: SCOPE, snapshot_id: SNAPSHOT }, outputs: [] };
    const got = await jobs.jobResult({ job_id: a.job_id }, EXTRA, w.deps);
    assert.equal(got.ok, true, JSON.stringify(got).slice(0, 200));
    assert.equal(jobs.sessions.size, 0);
    assert.equal(await busy(), false, 'busy after result');
    // expiry closes the session
    w.engine.status = 'running';
    w.engine.result = null;
    const b = await startGeneric(w);
    assert.equal(await busy(), true);
    w.engine.status = 'cancelled';
    assert.equal(await jobs.expireSession(b.job_id), true);
    assert.equal(jobs.sessions.size, 0);
    assert.equal(await busy(), false, 'busy after expiry');
    // a session past its lifetime does not hold the guard even before the timer closes it
    w.engine.status = 'running';
    const c = await startGeneric(w);
    assert.equal(await busy(), true);
    jobs.sessions.get(c.job_id).expires_at = Date.now() - 1;
    assert.equal(await busy(), false, 'busy after the lifetime ended');
    jobs.sessions.clear();
    // cancel is cooperative: the guard stays until a status read shows a terminal state
    w.engine.status = 'running';
    const d = await startGeneric(w);
    await jobs.cancelJob({ job_id: d.job_id }, EXTRA, w.deps);
    assert.equal(await busy(), true, 'cleared by a cancel request alone');
    w.engine.status = 'cancelled';
    await jobs.jobStatus({ job_id: d.job_id }, EXTRA, w.deps);
    assert.equal(await busy(), false, 'busy after a cancelled status');
  });

  await chk('B5', 'a second start (running job, or another start still connecting) gives engine_busy and no second child', async () => {
    needGuard();
    const w = makeWorld();
    const first = await startGeneric(w);
    const before = { transports: w.log.transports, clients: w.log.clients.length, calls: w.log.calls.length };
    const second = await jobs.startCapability({ capability_id: GENERIC, request: genericRequest() }, EXTRA, w.deps);
    assert.equal(second.ok, false);
    assert.equal(second.reason, 'engine_busy');
    assert.equal(second.job_id, first.job_id);
    assert.equal(w.log.transports, before.transports, 'a second child started');
    assert.equal(w.log.calls.length, before.calls);
    assert.equal(jobs.sessions.size, 1);
    // a start that is still connecting counts as busy
    jobs.sessions.clear();
    const w2 = makeWorld();
    let release;
    w2.engine.holdConnect = new Promise((resolve) => { release = resolve; });
    const pending = jobs.startCapability({ capability_id: GENERIC, request: genericRequest() }, EXTRA, w2.deps);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(w2.log.transports, 1, 'the first start did not reach connect');
    const blocked = await jobs.startCapability({ capability_id: GENERIC, request: genericRequest() }, EXTRA, w2.deps);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, 'engine_busy');
    assert.equal(w2.log.transports, 1, 'a second child started while the first was connecting');
    const server = makeServer();
    const hit = registerStub(server, 'eureka_graph_analyze');
    const viaTool = (await callTool(server, 'eureka_graph_analyze')).structuredContent;
    assert.equal(viaTool.reason, 'engine_busy');
    assert.equal(hit.calls, 0);
    release();
    const done = await pending;
    assert.equal(done.ok, true, JSON.stringify(done).slice(0, 200));
    assert.equal(w2.log.transports, 1);
  });

  await chk('B6', 'a pair-screen approval given while another job runs gives engine_busy and does not call the start route', async () => {
    if (!pairScreen || typeof jobs.startCapability !== 'function') throw { skip: 'B6 plan 374-08 declined: no pair-screen branch' };
    needGuard();
    const w = makeWorld();
    const before = Array.from(gateLedger._internal._ledger.keys());
    try {
      const planned = await jobs.startCapability({ capability_id: PAIR, request: { node_ids: ['n1', 'n2', 'n3'], objective: 'Find unusual pairs' } }, EXTRA, w.deps);
      assert.equal(planned.ok, true, JSON.stringify(planned).slice(0, 300));
      assert.equal(planned.status, 'awaiting_approval');
      // another job begins before the person answers
      const other = await startGeneric(w);
      const transportsBefore = w.log.transports;
      const entry = gateLedger.consumeGate(planned.gate_id, SESSION);
      assert.ok(entry && entry.ok !== false && typeof entry.resumeFn === 'function', 'no gate entry');
      const res = await entry.resumeFn({ gate_id: planned.gate_id, chosen: ['approve_run'], verdict: 'approve' });
      assert.equal(res.ok, false, JSON.stringify(res).slice(0, 300));
      assert.equal(res.reason, 'engine_busy');
      assert.equal(res.executed, false);
      assert.equal(res.job_id, other.job_id);
      assert.ok(/[Pp]lan again/.test(res.message), 'the answer does not tell the person to plan again');
      assert.equal(w.log.calls.filter((n) => n === 'scout_start_pair_screen').length, 0, 'the start route was called');
      assert.equal(w.log.transports, transportsBefore, 'a child started');
      // a new plan is refused before its child starts
      const planCalls = w.log.calls.filter((n) => n === 'scout_plan_pair_screen').length;
      const replan = await jobs.startCapability({ capability_id: PAIR, request: { node_ids: ['n1', 'n2', 'n3'], objective: 'Find unusual pairs' } }, EXTRA, w.deps);
      assert.equal(replan.ok, false);
      assert.equal(replan.reason, 'engine_busy');
      assert.equal(w.log.transports, transportsBefore, 'a plan child started while busy');
      assert.equal(w.log.calls.filter((n) => n === 'scout_plan_pair_screen').length, planCalls);
    } finally {
      for (const id of Array.from(gateLedger._internal._ledger.keys())) { if (!before.includes(id)) gateLedger._internal._ledger.delete(id); }
    }
  });

  await chk('B7', 'an engine client that throws on status marks the session unreachable and the guard clears', async () => {
    needGuard();
    const w = makeWorld();
    const started = await startGeneric(w);
    const server = makeServer();
    const hit = registerStub(server, 'eureka_capability_run');
    assert.equal((await callTool(server, 'eureka_capability_run')).structuredContent.reason, 'engine_busy');
    w.engine.throwStatus = true;
    const out = await jobs.jobStatus({ job_id: started.job_id }, EXTRA, w.deps);
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'engine_status_error');
    assert.equal(jobs.sessions.get(started.job_id).last_status, 'unreachable');
    const after = (await callTool(server, 'eureka_capability_run')).structuredContent;
    assert.equal(after.reason, 'stub_ran', 'still busy after the client threw: ' + after.reason);
    assert.equal(hit.calls, 1);
  });

  await chk('B8', 'recovery of a recorded job answers engine_busy while another job runs, before any child starts', async () => {
    if (!recordExists) throw { skip: 'B8 OD-4 is KEEP: the recovery path does not exist' };
    needGuard();
    const w = makeWorld();
    const recorded = await startGeneric(w);
    assert.equal(recorded.record_persisted, true);
    // the old host is gone: the recorded job has no session in this host
    jobs.sessions.clear();
    // without a running job, recovery still opens its one child (the 374-10 path)
    const t0 = w.log.transports;
    const ok = await jobs.jobStatus({ job_id: recorded.job_id }, EXTRA, w.deps);
    assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
    assert.equal(ok.recovered, true);
    assert.equal(w.log.transports - t0, 1, 'recovery did not open exactly one child');
    assert.equal(jobs.sessions.size, 0);
    // a different job now runs in this host
    const running = await startGeneric(w);
    const t1 = w.log.transports;
    const c1 = w.log.calls.length;
    for (const op of [jobs.jobStatus, jobs.jobResult]) {
      const out = await op({ job_id: recorded.job_id }, EXTRA, w.deps);
      assert.equal(out.ok, false);
      assert.equal(out.reason, 'engine_busy');
      assert.equal(out.job_id, running.job_id);
    }
    assert.equal(w.log.transports, t1, 'a recovery child started while busy');
    assert.equal(w.log.calls.length, c1);
    // cancel of a recovered job never opens a child, so it keeps its own answer
    const cancel = await jobs.cancelJob({ job_id: recorded.job_id }, EXTRA, w.deps);
    assert.equal(cancel.reason, 'cancel_unavailable_after_restart');
    assert.ok(jobRecord, 'record module');
  });

  await chk('B9', 'the tool descriptions and schemas keep their pinned fingerprint and test-270 budget line', async () => {
    const server = makeServer();
    const configs = [];
    server.registerTool = (name, config, fn) => { server.handlers.set(name, fn); configs.push([name, config]); };
    jobs.register(server, { surface: 'cli' });
    assert.equal(configs.length, 5);
    configs.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const fingerprint = hex(configs.map(([name, cfg]) => name + '|' + cfg.description + '|' + util.inspect(cfg.inputSchema._def, { depth: 12 })).join('\n'));
    assert.equal(fingerprint, '73360231292fb99c9e9a6e6c21fc185dba7a3c62c6025bd2dfa6148fc36aa03f', 'job tool fingerprint changed: ' + fingerprint);
    const out = cp.spawnSync(process.execPath, [path.join(REPO, 'tests', 'test-270-tool-schema-budget.cjs')], { encoding: 'utf8', timeout: 60000 });
    assert.equal(out.status, 0, 'test-270 failed');
    const line = String(out.stdout).split('\n').find((l) => l.indexOf('budget:') === 0);
    assert.equal(line, BASELINE_BUDGET_LINE, 'budget line changed: ' + line);
    assert.ok(/5 passed, 0 failed/.test(out.stdout));
  });

  cleanup();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { process.stdout.write('FAIL - B0 ' + String((e && e.stack) || e) + '\n'); cleanup(); process.exit(1); });
