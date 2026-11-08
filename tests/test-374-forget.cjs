#!/usr/bin/env node
'use strict';

/**
 * Phase 374 plan 13, Task 1 (owner card OD-2 = ADD-FORGET-TOOL, decision D-10, threats T-374-58 and T-374-60).
 * eureka_capability_job_forget: forget ONE finished run. It needs confirm true. It deletes the engine row through
 * scout_delete_job, then the plugin pointer record and any cached result page. Fixed sentences only.
 *
 * Arms (one line each at column 1: "ok - F<n> ...", "FAIL - F<n> ..." or "skip - F<n> <reason>"):
 *   F1  the tool is registered by the jobs file through registerEurekaTool; input { job_id, confirm } strict;
 *       confirm is the literal true; destructive annotations; a job lifecycle tool (no engine gate)
 *   F2  without confirm true the schema refuses and the function refuses; nothing is deleted
 *   F3  a finished job with a live session: the retained client gets scout_delete_job once, the session closes,
 *       the pointer record and the cached result page are removed, the answer says the run cannot be recovered
 *   F4  a job that has not finished is refused with job_not_finished; the sentence says to cancel it first
 *   F5  a recovered job (record only): the engine check and the busy guard run first, one child is opened,
 *       scout_delete_job is called, the record is removed, the child is closed, the answer states the consequence
 *       for another running job (EXT-02)
 *   F6  another room gets job_session_wrong_owner and no engine call; an engine error keeps the record and says
 *       so; after a forget, jobStatus answers job_session_not_found
 *
 * In-process fake clients. No engine, no network. CJS. Hyphens only.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't374-13-forget-'));
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
const jobRecord = require(path.join(REPO, 'lib', 'mcp', 'eureka-job-record.cjs'));

const GENERIC = 'opportunity.find_cross_domain_pairs';
const SCOPE = 'room:f';
const SNAPSHOT = 'snap-f';
const SESSION = 'f-session-374-13';
const MARK = 'PLANTF-6e03';
const DAY = 24 * 60 * 60 * 1000;
const TOOL = 'eureka_capability_job_forget';

let failed = 0;
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

function makeWorld() {
  const log = { transports: 0, clients: [], calls: [] };
  const engine = { status: 'completed', jobN: 0, deleted: true, throwDelete: false };
  class FakeTransport { constructor(options) { log.transports += 1; this.options = options; this.stderr = null; } }
  class FakeClient {
    constructor() { this.closed = false; this.id = log.clients.length; log.clients.push(this); }
    async connect() { /* nothing */ }
    async close() { this.closed = true; }
    async callTool(call) {
      log.calls.push({ name: call.name, client: this.id, args: call.arguments });
      const args = call.arguments || {};
      switch (call.name) {
        case 'scout_capabilities':
          return sc({ capabilities: [{ id: GENERIC, status: 'experimental', routes: { mcp: { tool: 'scout_start' } } }] });
        case 'scout_capability_contract':
          return sc({ capability: { id: args.capability_id }, schemas: { input: { type: 'object' }, output: { type: 'object' } } });
        case 'scout_start':
          engine.jobN += 1;
          return sc({ job_id: 'job-f-' + engine.jobN, status: 'queued' });
        case 'scout_status':
          return sc({ status: engine.status, progress: 'done', events: [] });
        case 'scout_delete_job':
          if (engine.throwDelete) throw new Error('engine client is gone ' + ENGINE + ' ' + MARK);
          return sc({ job_id: args.job_id, deleted: engine.deleted });
        case 'scout_cancel':
          return sc({ status: 'cancellation_requested' });
        default:
          throw new Error('unexpected call ' + call.name);
      }
    }
  }
  const ident = { hash: hex(SESSION), room: 'room-f' };
  const deps = {
    env: { MINDRIAN_EUREKA_ROOT: ENGINE, HOME },
    ctx: { surface: 'cli' },
    server: { registerTool() {}, server: { getClientCapabilities() { return {}; } } },
    Client: FakeClient,
    StdioClientTransport: FakeTransport,
    callerIdentity: () => ({ sessionKeyHash: ident.hash, roomId: ident.room }),
  };
  return { log, engine, deps, ident };
}

const EXTRA = { sessionId: SESSION };
function genericRequest() {
  return { scope_id: SCOPE, snapshot_id: SNAPSHOT, topic: MARK + ' topic', artifacts: [{ id: 'n1', title: 't', text: 'x' }], top_k: 4 };
}
async function startGeneric(w) {
  const out = await jobs.startCapability({ capability_id: GENERIC, request: genericRequest() }, EXTRA, w.deps);
  assert.equal(out.ok, true, 'generic start: ' + JSON.stringify(out).slice(0, 200));
  return out;
}
function baseOf(room) {
  const r = jobRecord.resolveBase({ room_id: room, env: { HOME } });
  assert.equal(r.ok, true);
  return r.base;
}
function recordFile(room, jobId) { return path.join(baseOf(room), jobId + '.json'); }
function plant(w, jobId, patch) {
  const now = Date.now();
  const record = Object.assign({
    job_id: jobId, capability_id: GENERIC, route: 'scout_start', scope_id: SCOPE, snapshot_id: SNAPSHOT, room_id: w.ident.room,
    session_key_hash: hex('someone-else'), request_sha256: hex('r'), artifact_count: 1, top_k: 4, plan_digest: null, approval_ref: null,
    idempotency_key: null, started_at: iso(now - 1000), engine_expires_at: iso(now + 30 * DAY), last_status: 'completed',
    last_status_at: iso(now - 1000), terminal: true, manifest_sha256: null,
  }, patch || {});
  assert.equal(jobRecord.recordStart(baseOf(record.room_id), record).ok, true);
  return record;
}
function restartHost() {
  for (const session of jobs.sessions.values()) { if (session.timer) clearTimeout(session.timer); }
  jobs.sessions.clear();
}
function makeServer() {
  const handlers = new Map();
  const configs = new Map();
  return { handlers, configs, registerTool(name, config, fn) { handlers.set(name, fn); configs.set(name, config); } };
}
function deletes(w) { return w.log.calls.filter((c) => c.name === 'scout_delete_job'); }
function plantPage(jobId, w) {
  jobs.resultPages.set(jobId, { answer: { ok: true, engine_result: { outputs: [] } }, stored_at: Date.now(),
    owner: { sessionKeyHash: w.ident.hash, roomId: w.ident.room } });
}

async function main() {
  await chk('F1', 'the forget tool is registered, strict, destructive, confirm is the literal true', async () => {
    const server = makeServer();
    jobs.register(server, { surface: 'cli' });
    assert.ok(server.configs.has(TOOL), 'eureka_capability_job_forget is not registered');
    const cfg = server.configs.get(TOOL);
    const schema = cfg.inputSchema;
    assert.equal(schema.safeParse({ job_id: 'job-f-1', confirm: true }).success, true);
    assert.equal(schema.safeParse({ job_id: 'job-f-1' }).success, false);
    assert.equal(schema.safeParse({ job_id: 'job-f-1', confirm: false }).success, false);
    assert.equal(schema.safeParse({ job_id: 'job-f-1', confirm: 'true' }).success, false);
    assert.equal(schema.safeParse({ job_id: 'job-f-1', confirm: true, extra: 1 }).success, false);
    assert.equal(schema.safeParse({ job_id: '', confirm: true }).success, false);
    assert.equal(cfg.annotations.destructiveHint, true);
    assert.equal(cfg.annotations.readOnlyHint, false);
    assert.equal(cfg.annotations.idempotentHint, true);
    assert.equal(contract.JOB_LIFECYCLE_TOOLS.has(TOOL), true, 'the tool must be a job lifecycle tool');
    const row = jobs.connectors.find((c) => c.tool === TOOL);
    assert.ok(row, 'no connector row');
    assert.ok(/^F\.[0-9]$/.test(row.hitl_shape), 'hitl_shape ' + row.hitl_shape);
    assert.ok(row.hitl_why.length > 20);
  });

  await chk('F2', 'without confirm true nothing is deleted', async () => {
    const w = makeWorld();
    const started = await startGeneric(w);
    const before = w.log.calls.length;
    for (const bad of [{ job_id: started.job_id }, { job_id: started.job_id, confirm: false }, { job_id: started.job_id, confirm: 'true' }]) {
      const out = await jobs.forgetJob(bad, EXTRA, w.deps);
      assert.equal(out.ok, false);
      assert.equal(out.reason, 'confirm_required');
    }
    assert.equal(w.log.calls.length, before, 'an engine call was made');
    assert.equal(deletes(w).length, 0);
    assert.equal(jobs.sessions.has(started.job_id), true);
    assert.equal(fs.existsSync(recordFile('room-f', started.job_id)), true);
  });

  await chk('F3', 'a finished job with a live session is forgotten: engine row, session, record and cached page', async () => {
    const w = makeWorld();
    const started = await startGeneric(w);
    assert.equal(started.record_persisted, true);
    plantPage(started.job_id, w);
    w.engine.status = 'completed';
    const session = jobs.sessions.get(started.job_id);
    const out = await jobs.forgetJob({ job_id: started.job_id, confirm: true }, EXTRA, w.deps);
    assert.equal(out.ok, true, JSON.stringify(out).slice(0, 300));
    assert.equal(out.job_id, started.job_id);
    assert.equal(out.forgotten, true);
    assert.equal(out.engine_deleted, true);
    assert.equal(out.record_removed, true);
    assert.equal(out.cached_result_dropped, true);
    assert.ok(/cannot be recovered/.test(out.message), out.message);
    const del = deletes(w);
    assert.equal(del.length, 1, 'scout_delete_job must be called once');
    assert.equal(del[0].client, w.log.clients.indexOf(session.client), 'the retained client must make the call');
    assert.deepEqual(del[0].args, { job_id: started.job_id });
    assert.equal(w.log.transports, 1, 'no extra child for a live session');
    assert.equal(jobs.sessions.has(started.job_id), false, 'the session must close');
    assert.equal(session.client.closed, true);
    assert.equal(fs.existsSync(recordFile('room-f', started.job_id)), false, 'the record must be removed');
    assert.equal(jobs.resultPages.has(started.job_id), false, 'the cached page must be dropped');
    assert.ok(JSON.stringify(out).indexOf(MARK) === -1, 'no engine or request text in the answer');
  });

  await chk('F4', 'a job that has not finished is refused: cancel it first', async () => {
    const w = makeWorld();
    const started = await startGeneric(w);
    w.engine.status = 'running';
    const out = await jobs.forgetJob({ job_id: started.job_id, confirm: true }, EXTRA, w.deps);
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'job_not_finished');
    assert.ok(/[Cc]ancel/.test(out.message), out.message);
    assert.equal(deletes(w).length, 0);
    assert.equal(jobs.sessions.has(started.job_id), true, 'the session must stay');
    assert.equal(fs.existsSync(recordFile('room-f', started.job_id)), true, 'the record must stay');
  });

  await chk('F5', 'a recovered job: engine check and busy guard first, one child, delete, record removed, child closed', async () => {
    const w = makeWorld();
    const started = await startGeneric(w);
    restartHost();
    w.engine.status = 'completed';
    plantPage(started.job_id, w);
    const t0 = w.log.transports;
    const c0 = w.log.calls.length;
    const k0 = w.log.clients.length;
    const out = await jobs.forgetJob({ job_id: started.job_id, confirm: true }, EXTRA, w.deps);
    assert.equal(out.ok, true, JSON.stringify(out).slice(0, 300));
    assert.equal(out.forgotten, true);
    assert.equal(out.record_removed, true);
    assert.equal(w.log.transports - t0, 1, 'exactly one child');
    assert.deepEqual(w.log.calls.slice(c0).map((c) => c.name), ['scout_status', 'scout_delete_job']);
    assert.equal(w.log.clients.slice(k0).every((c) => c.closed), true, 'the child was not closed');
    assert.equal(fs.existsSync(recordFile('room-f', started.job_id)), false);
    assert.equal(jobs.resultPages.has(started.job_id), false);
    assert.equal(jobs.sessions.size, 0);
    assert.ok(/another MindrianOS process/.test(out.engine_note || ''), 'the child-opening consequence (EXT-02) is not stated');
    assert.ok(/server_restarted/.test(out.engine_note || ''));

    // busy guard first: a job of this process runs, no child opens, the record stays
    const second = await startGeneric(w);
    plant(w, 'job-f-recorded', {});
    w.engine.status = 'running';
    const t1 = w.log.transports;
    const busy = await jobs.forgetJob({ job_id: 'job-f-recorded', confirm: true }, EXTRA, w.deps);
    assert.equal(busy.ok, false);
    assert.equal(busy.reason, 'engine_busy');
    assert.equal(busy.job_id, second.job_id);
    assert.equal(w.log.transports, t1, 'a child started while busy');
    assert.equal(fs.existsSync(recordFile('room-f', 'job-f-recorded')), true);

    // engine absent first: typed refusal, no child
    restartHost();
    const bare = { ...w.deps, env: { HOME, MINDRIAN_EUREKA_ROOT: path.join(TMP, 'no-such-engine') } };
    const savedRoot = process.env.MINDRIAN_EUREKA_ROOT;
    process.env.MINDRIAN_EUREKA_ROOT = path.join(TMP, 'no-such-engine');
    let gone;
    try { gone = await jobs.forgetJob({ job_id: 'job-f-recorded', confirm: true }, EXTRA, bare); } finally { process.env.MINDRIAN_EUREKA_ROOT = savedRoot; }
    assert.equal(gone.ok, false);
    assert.notEqual(gone.reason, 'forgotten');
    assert.equal(w.log.transports, t1, 'a child started with no engine');
    assert.equal(fs.existsSync(recordFile('room-f', 'job-f-recorded')), true);
  });

  await chk('F6', 'wrong room refused with no engine call; an engine error keeps the record; status after forget is not found', async () => {
    const w = makeWorld();
    const started = await startGeneric(w);
    // another room
    const other = { ...w.deps, callerIdentity: () => ({ sessionKeyHash: hex('other'), roomId: 'room-other' }) };
    const c0 = w.log.calls.length;
    const wrong = await jobs.forgetJob({ job_id: started.job_id, confirm: true }, EXTRA, other);
    assert.equal(wrong.ok, false);
    assert.equal(wrong.reason, 'job_session_wrong_owner');
    assert.equal(w.log.calls.length, c0, 'an engine call was made for another room');
    restartHost();
    const wrong2 = await jobs.forgetJob({ job_id: started.job_id, confirm: true }, EXTRA, other);
    assert.equal(wrong2.reason, 'job_session_wrong_owner');
    assert.equal(w.log.calls.length, c0);
    // engine error keeps the record
    w.engine.throwDelete = true;
    const failedOut = await jobs.forgetJob({ job_id: started.job_id, confirm: true }, EXTRA, w.deps);
    assert.equal(failedOut.ok, false);
    assert.equal(failedOut.reason, 'engine_forget_error');
    assert.ok(/record was kept/.test(failedOut.message), failedOut.message);
    assert.ok(JSON.stringify(failedOut).indexOf(MARK) === -1 && JSON.stringify(failedOut).indexOf(ENGINE) === -1, 'engine text in the refusal');
    assert.equal(fs.existsSync(recordFile('room-f', started.job_id)), true);
    // a retry works, then the job is unknown
    w.engine.throwDelete = false;
    const ok = await jobs.forgetJob({ job_id: started.job_id, confirm: true }, EXTRA, w.deps);
    assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 200));
    const again = await jobs.jobStatus({ job_id: started.job_id }, EXTRA, w.deps);
    assert.equal(again.ok, false);
    assert.equal(again.reason, 'job_session_not_found');
    // a second forget of the same id is also not found (nothing to forget)
    const twice = await jobs.forgetJob({ job_id: started.job_id, confirm: true }, EXTRA, w.deps);
    assert.equal(twice.ok, false);
    assert.equal(twice.reason, 'job_session_not_found');
  });

  cleanup();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { process.stdout.write('FAIL - F0 ' + String((e && e.stack) || e) + '\n'); cleanup(); process.exit(1); });
