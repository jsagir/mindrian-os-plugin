#!/usr/bin/env node
'use strict';

/**
 * Phase 374 plan 10, Task 2 (test T10): recovery of a job after a host restart, by asking the engine
 * (ADAPT374-02, owner card OD-4 = USER-DIR, threats T-374-42 to T-374-48).
 *
 * A host restart is simulated by clearing the in-process session table (the child clients of the old host are
 * gone). The engine is an in-process fake client. A scratch HOME holds the records. No engine, no network.
 *
 * Arms (one line each, "ok - K<n> ..." or "FAIL - K<n> ..." at column 1):
 *   K1  after the session table is cleared, jobStatus for a recorded job opens one child, calls scout_status,
 *       returns the engine state with recovered true, updates the record and closes the child
 *   K2  jobResult for a recorded generic job runs the lineage check against the record's ids; a pair-screen job
 *       runs verifyPairScreenResult (a tampered result gives engine_result_hash_mismatch, a good one passes)
 *   K3  cancelJob for a recovered job gives cancel_unavailable_after_restart and no child is created
 *   K4  a caller bound to another room gets job_session_wrong_owner; the session key is not checked; the answer
 *       says whether the same session started the job
 *   K5  with the engine folder absent the answer is the typed engine refusal and no child starts
 *   K6  an expired record is removed and the answer is job_session_not_found
 *   K7  a terminal record answers status from the record without a child; result still reads the engine
 *   K8  a failed job with failure_code server_restarted is shown as that, with the fixed limit sentence
 *   K9  a failed record write does not fail the job and the start answer carries a fixed note; a missing
 *       record folder is created
 *   K10 the record is written at start for a generic job and for a pair-screen job, with plan_digest and
 *       approval_ref from the approval block and request_sha256 equal to the digest of the request without it
 *
 * CJS. Hyphens only.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't374-10-recovery-'));
const HOME = path.join(TMP, 'home');
const ENGINE = path.join(TMP, 'engine');
fs.mkdirSync(HOME);
fs.mkdirSync(ENGINE);
fs.writeFileSync(path.join(ENGINE, 'pyproject.toml'), '[project]\nname = "mindrian-eureka"\n\n[project.scripts]\neureka-mcp = "fixture:main"\n');
const SAVED = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
function cleanup() {
  for (const k of Object.keys(SAVED)) { if (SAVED[k] === undefined) delete process.env[k]; else process.env[k] = SAVED[k]; }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}

const jobs = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-jobs.cjs'));
const run = require(path.join(REPO, 'lib', 'mcp', 'tools', 'eureka-capability-run.cjs'));
const gateLedger = require(path.join(REPO, 'lib', 'mcp', 'gate-ledger.cjs'));
let rec = null;
let loadError = null;
try { rec = require(path.join(REPO, 'lib', 'mcp', 'eureka-job-record.cjs')); } catch (e) { loadError = e; }

const GENERIC = 'opportunity.find_cross_domain_pairs';
const PAIR = 'opportunity.run_pair_screen';
const SCOPE = 'room:k';
const SNAPSHOT = 'snap-k';
const DAY = 24 * 60 * 60 * 1000;
const MARK = 'PLANTK-7d21';
const RAW_SESSION = 'raw-session-k-1';

let failed = 0;
async function arm(id, label, fn) {
  try {
    run.clearCatalogCache();
    jobs.sessions.clear();
    await fn();
    process.stdout.write('ok - ' + id + ' ' + label + '\n');
  } catch (err) {
    failed += 1;
    const msg = (err && err.message) ? String(err.message).split('\n')[0] : String(err);
    process.stdout.write('FAIL - ' + id + ' ' + label + ' :: ' + msg + '\n');
  }
}
function need() { if (!rec) throw new Error('lib/mcp/eureka-job-record.cjs does not load yet: ' + String(loadError && loadError.message).split('\n')[0]); }

function hex(text) { return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex'); }
function sc(payload) { return { structuredContent: payload, content: [{ type: 'text', text: JSON.stringify(payload) }] }; }
function iso(ms) { return new Date(ms).toISOString(); }
function canon(value) {
  if (Array.isArray(value)) return '[' + value.map(canon).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canon(value[k])).join(',') + '}';
  return JSON.stringify(value);
}

// ---------------------------------------------------------------------------
// the world: fake engine child, caller identity, deps
// ---------------------------------------------------------------------------

function goodPairResult() {
  const pairs = JSON.stringify({ pairs: [{ left: 'a', right: 'b' }] }) + '\n';
  const manifest = JSON.stringify({ files: [{ path: 'unusual-pairs.json', sha256: hex(pairs) }] }) + '\n';
  const file = (p, c) => ({ path: p, bytes: Buffer.byteLength(c, 'utf8'), sha256: hex(c), inline: true, content: c });
  return {
    schema_version: 'eureka.pair-screen.v1', capability_id: PAIR, status: 'completed', label: 'candidate, not verified',
    summary_line: 'All results are candidates, not verified.', scope: { scope_id: SCOPE, snapshot_id: SNAPSHOT },
    approval: { plan_digest: 'a'.repeat(64), approval_ref: 'gate-1', verified_by_engine: false },
    counts: { records_read: 3, records_used: 3, dropped: 0, unusual_pairs: 1, wording_and_meaning_pairs: 1 },
    caps_hit: [], warnings: [], manifest_sha256: hex(manifest),
    files: [file('unusual-pairs.json', pairs), file('manifest.json', manifest)], outputs: [{ id: 'pair-1', kind: 'pair' }],
    host_handoff: { state: 'results_ready', owner: 'mindrianos' }, room_write: 'not_performed', portfolio_write: 'not_performed',
  };
}

function makeWorld() {
  const log = { transports: 0, clients: [], calls: [] };
  const engine = { status: 'running', progress: 'screening', failure_code: null, result: null, jobN: 0, planned: null };
  class FakeTransport { constructor(options) { log.transports += 1; this.options = options; this.stderr = null; } }
  class FakeClient {
    constructor() { this.closed = false; log.clients.push(this); }
    async connect() { /* nothing */ }
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
          return sc({ job_id: 'job-k-' + engine.jobN, status: 'queued' });
        case 'scout_plan_pair_screen': {
          const request = args.request;
          engine.planned = request;
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
          return sc({ job_id: 'job-kp-' + engine.jobN, status: 'queued' });
        case 'scout_status':
          return sc({ status: engine.status, progress: engine.progress, events: [], ...(engine.failure_code ? { failure_code: engine.failure_code } : {}) });
        case 'scout_result':
          return sc(typeof engine.result === 'function' ? engine.result(args.job_id) : (engine.result || { status: engine.status }));
        case 'scout_cancel':
          return sc({ status: 'cancellation_requested' });
        default:
          throw new Error('unexpected call ' + call.name);
      }
    }
  }
  const ident = { hash: hex(RAW_SESSION), room: 'room-k' };
  const artifacts = ['n1', 'n2', 'n3'].map((id) => ({
    id, source_ref: 'mindrian-graph://node/' + id, title: MARK + '-title-' + id, text: MARK + ' text ' + id, sha256: hex(MARK + ' text ' + id),
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

// The old host is gone: its sessions and child clients no longer exist in the new host.
function restartHost() {
  for (const session of jobs.sessions.values()) { if (session.timer) clearTimeout(session.timer); }
  jobs.sessions.clear();
}

function genericRequest(patch) {
  return Object.assign({
    scope_id: SCOPE, snapshot_id: SNAPSHOT, topic: MARK + ' topic',
    artifacts: [{ id: 'n1', title: MARK + ' title', text: MARK + ' text' }], top_k: 4,
  }, patch || {});
}
async function startGeneric(w, patch, idem) {
  const out = await jobs.startCapability({ capability_id: GENERIC, request: genericRequest(patch), ...(idem ? { idempotency_key: idem } : {}) }, {}, w.deps);
  assert.equal(out.ok, true, 'generic start: ' + JSON.stringify(out).slice(0, 200));
  return out;
}
function baseOf(room, home) {
  const r = rec.resolveBase({ room_id: room, env: { HOME: home || HOME } });
  assert.equal(r.ok, true);
  return r.base;
}
function plant(w, jobId, patch) {
  const now = Date.now();
  const record = Object.assign({
    job_id: jobId, capability_id: GENERIC, route: 'scout_start', scope_id: SCOPE, snapshot_id: SNAPSHOT, room_id: w.ident.room,
    session_key_hash: hex('someone-else'), request_sha256: hex('r'), artifact_count: 1, top_k: 4, plan_digest: null, approval_ref: null,
    idempotency_key: null, started_at: iso(now - 1000), engine_expires_at: iso(now + 30 * DAY), last_status: 'queued',
    last_status_at: iso(now - 1000), terminal: false, manifest_sha256: null,
  }, patch || {});
  const out = rec.recordStart(baseOf(record.room_id), record);
  assert.equal(out.ok, true, JSON.stringify(out));
  return record;
}
function recordFile(room, jobId, home) { return path.join(baseOf(room, home), jobId + '.json'); }
function readRec(room, jobId) { return JSON.parse(fs.readFileSync(recordFile(room, jobId), 'utf8')); }

async function main() {
  await arm('K1', 'status after a restart opens one child, calls scout_status, updates the record and closes the child', async () => {
    need();
    const w = makeWorld();
    const started = await startGeneric(w);
    assert.equal(started.record_persisted, true);
    restartHost();
    const before = { transports: w.log.transports, calls: w.log.calls.length, clients: w.log.clients.length };
    w.engine.status = 'running';
    w.engine.progress = 'screening';
    const out = await jobs.jobStatus({ job_id: started.job_id }, {}, w.deps);
    assert.equal(out.ok, true, JSON.stringify(out).slice(0, 300));
    assert.equal(out.recovered, true);
    assert.equal(out.source, 'engine_status');
    assert.equal(out.status, 'running');
    assert.equal(out.progress, 'screening');
    assert.equal(out.job_id, started.job_id);
    assert.equal(out.scope_id, SCOPE);
    assert.equal(out.snapshot_id, SNAPSHOT);
    assert.ok(/does not resume/.test(out.recovery_note || ''), 'the limit sentence is missing');
    assert.equal(w.log.transports - before.transports, 1, 'exactly one child');
    assert.deepEqual(w.log.calls.slice(before.calls), ['scout_status']);
    assert.equal(w.log.clients.slice(before.clients).every((c) => c.closed), true, 'the child was not closed');
    assert.equal(jobs.sessions.size, 0, 'recovery must not keep a session');
    const row = readRec('room-k', started.job_id);
    assert.equal(row.last_status, 'running');
    assert.equal(row.terminal, false);
    assert.ok(Date.parse(row.last_status_at) >= Date.parse(row.started_at));
  });

  await arm('K2', 'result after a restart checks lineage (generic) and verifies a pair-screen result', async () => {
    need();
    const w = makeWorld();
    const started = await startGeneric(w);
    restartHost();
    // generic: good lineage passes, mismatched and missing lineage are refused
    w.engine.status = 'completed';
    w.engine.result = { capability_id: GENERIC, status: 'completed', scope: { scope_id: SCOPE, snapshot_id: SNAPSHOT }, outputs: [] };
    const good = await jobs.jobResult({ job_id: started.job_id }, {}, w.deps);
    assert.equal(good.ok, true, JSON.stringify(good).slice(0, 300));
    assert.equal(good.recovered, true);
    assert.deepEqual(good.engine_result.scope, { scope_id: SCOPE, snapshot_id: SNAPSHOT });
    assert.equal(readRec('room-k', started.job_id).terminal, true);
    w.engine.result = { capability_id: GENERIC, status: 'completed', scope: { scope_id: 'room:other', snapshot_id: SNAPSHOT }, outputs: [] };
    const mismatch = await jobs.jobResult({ job_id: started.job_id }, {}, w.deps);
    assert.equal(mismatch.ok, false);
    assert.equal(mismatch.reason, 'engine_lineage_mismatch');
    w.engine.result = { capability_id: GENERIC, status: 'completed', outputs: [] };
    const missing = await jobs.jobResult({ job_id: started.job_id }, {}, w.deps);
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, 'engine_lineage_missing');
    assert.ok(!('engine_result' in missing));
    // pair screen
    plant(w, 'job-kp-x', { capability_id: PAIR, route: 'scout_start_pair_screen', plan_digest: hex('plan'), approval_ref: 'gate-1' });
    w.engine.result = () => goodPairResult();
    const pairGood = await jobs.jobResult({ job_id: 'job-kp-x' }, {}, w.deps);
    assert.equal(pairGood.ok, true, JSON.stringify(pairGood).slice(0, 300));
    assert.equal(pairGood.label, 'candidate, not verified');
    assert.equal(pairGood.lineage_verified, true);
    assert.equal(pairGood.recovered, true);
    assert.equal(readRec('room-k', 'job-kp-x').manifest_sha256, goodPairResult().manifest_sha256);
    const tampered = goodPairResult();
    tampered.files[0].content += ' ' + MARK;
    w.engine.result = () => tampered;
    const pairBad = await jobs.jobResult({ job_id: 'job-kp-x' }, {}, w.deps);
    assert.equal(pairBad.ok, false);
    assert.equal(pairBad.reason, 'engine_result_hash_mismatch');
    assert.ok(!('engine_result' in pairBad));
    assert.ok(JSON.stringify(pairBad).indexOf(MARK) === -1, 'the planted text shows in the refusal');
  });

  await arm('K3', 'cancel of a recovered job gives cancel_unavailable_after_restart and creates no child', async () => {
    need();
    const w = makeWorld();
    const started = await startGeneric(w);
    restartHost();
    const before = { transports: w.log.transports, clients: w.log.clients.length, calls: w.log.calls.length };
    const out = await jobs.cancelJob({ job_id: started.job_id }, {}, w.deps);
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'cancel_unavailable_after_restart');
    assert.equal(out.job_id, started.job_id);
    assert.equal(w.log.transports, before.transports, 'a transport was created');
    assert.equal(w.log.clients.length, before.clients, 'a client was created');
    assert.equal(w.log.calls.length, before.calls, 'a tool call was made');
    // the same answer for a job of an unknown room is still not found / wrong owner
    w.ident.room = 'room-other';
    const other = await jobs.cancelJob({ job_id: started.job_id }, {}, w.deps);
    assert.equal(other.reason, 'job_session_wrong_owner');
  });

  await arm('K4', 'another room gets job_session_wrong_owner; the session key is not checked; the answer says who started it', async () => {
    need();
    const w = makeWorld();
    const started = await startGeneric(w);
    restartHost();
    const base = { transports: w.log.transports, calls: w.log.calls.length };
    w.ident.room = 'room-other';
    for (const op of [jobs.jobStatus, jobs.jobResult]) {
      const out = await op({ job_id: started.job_id }, {}, w.deps);
      assert.equal(out.ok, false);
      assert.equal(out.reason, 'job_session_wrong_owner');
      assert.ok(!('capability_id' in out) || out.capability_id === undefined, 'the refusal shows job detail');
    }
    w.ident.room = null;
    assert.equal((await jobs.jobStatus({ job_id: started.job_id }, {}, w.deps)).reason, 'job_session_wrong_owner');
    assert.equal(w.log.transports, base.transports, 'a child started for a wrong owner');
    assert.equal(w.log.calls.length, base.calls);
    // same room, new session (a restart changes the key): allowed, and the answer says another session started it
    w.ident.room = 'room-k';
    w.ident.hash = hex('a-new-session-after-restart');
    const other = await jobs.jobStatus({ job_id: started.job_id }, {}, w.deps);
    assert.equal(other.ok, true, JSON.stringify(other).slice(0, 200));
    assert.equal(other.started_by_this_session, false);
    w.ident.hash = hex(RAW_SESSION);
    const same = await jobs.jobStatus({ job_id: started.job_id }, {}, w.deps);
    assert.equal(same.ok, true);
    assert.equal(same.started_by_this_session, true);
    // an unknown job id and an unsafe job id are still not found
    assert.equal((await jobs.jobStatus({ job_id: 'job-none' }, {}, w.deps)).reason, 'job_session_not_found');
    assert.equal((await jobs.jobStatus({ job_id: '../x' }, {}, w.deps)).reason, 'job_session_not_found');
  });

  await arm('K5', 'with the engine folder absent the answer is the typed engine refusal and no child starts', async () => {
    need();
    const w = makeWorld();
    const started = await startGeneric(w);
    restartHost();
    const before = { transports: w.log.transports, clients: w.log.clients.length };
    const absent = Object.assign({}, w.deps, { env: { MINDRIAN_EUREKA_ROOT: path.join(TMP, 'no-such-engine'), HOME } });
    for (const op of [jobs.jobStatus, jobs.jobResult]) {
      const out = await op({ job_id: started.job_id }, {}, absent);
      assert.equal(out.ok, false, JSON.stringify(out).slice(0, 200));
      assert.notEqual(out.reason, 'job_session_not_found');
      assert.ok(out.engine_state, 'no engine_state in the typed refusal: ' + JSON.stringify(out).slice(0, 200));
      assert.ok(typeof out.message === 'string' && out.message.length > 0);
    }
    assert.equal(w.log.transports, before.transports, 'a child started without an engine');
    assert.equal(w.log.clients.length, before.clients);
  });

  await arm('K6', 'an expired record is removed and the answer is job_session_not_found', async () => {
    need();
    const w = makeWorld();
    const now = Date.now();
    plant(w, 'job-k-old', { started_at: iso(now - 40 * DAY), engine_expires_at: iso(now - 10 * DAY) });
    assert.equal(fs.existsSync(recordFile('room-k', 'job-k-old')), true);
    const out = await jobs.jobStatus({ job_id: 'job-k-old' }, {}, w.deps);
    assert.equal(out.ok, false);
    assert.equal(out.reason, 'job_session_not_found');
    assert.equal(fs.existsSync(recordFile('room-k', 'job-k-old')), false, 'the expired record was not removed');
    assert.equal(w.log.transports, 0);
  });

  await arm('K7', 'a terminal record answers status from the record without a child; result still reads the engine', async () => {
    need();
    const w = makeWorld();
    plant(w, 'job-k-term', { last_status: 'completed', terminal: true });
    const status = await jobs.jobStatus({ job_id: 'job-k-term' }, {}, w.deps);
    assert.equal(status.ok, true, JSON.stringify(status).slice(0, 200));
    assert.equal(status.status, 'completed');
    assert.equal(status.recovered, true);
    assert.equal(status.source, 'plugin_record');
    assert.equal(w.log.transports, 0, 'status of a terminal record made a child');
    w.engine.status = 'completed';
    w.engine.result = { capability_id: GENERIC, status: 'completed', scope: { scope_id: SCOPE, snapshot_id: SNAPSHOT }, outputs: [] };
    const result = await jobs.jobResult({ job_id: 'job-k-term' }, {}, w.deps);
    assert.equal(result.ok, true, JSON.stringify(result).slice(0, 200));
    assert.equal(w.log.transports, 1, 'result must read the engine through one child');
    assert.ok(w.log.calls.includes('scout_result'));
  });

  await arm('K8', 'a job that reads failed with server_restarted shows that and the fixed limit sentence', async () => {
    need();
    const w = makeWorld();
    const started = await startGeneric(w);
    restartHost();
    w.engine.status = 'failed';
    w.engine.progress = 'interrupted';
    w.engine.failure_code = 'server_restarted';
    const status = await jobs.jobStatus({ job_id: started.job_id }, {}, w.deps);
    assert.equal(status.ok, true);
    assert.equal(status.status, 'failed');
    assert.equal(status.failure_code, 'server_restarted');
    assert.ok(/still running when the host stopped/.test(status.recovery_note) && /does not resume/.test(status.recovery_note), status.recovery_note);
    assert.equal(readRec('room-k', started.job_id).terminal, true);
    w.engine.result = { status: 'failed', progress: 'interrupted', failure_code: 'server_restarted' };
    const result = await jobs.jobResult({ job_id: started.job_id }, {}, w.deps);
    assert.equal(result.ok, true);
    assert.equal(result.result_kind, 'job_state_only');
    assert.equal(result.lineage_verified, false);
    assert.equal(result.engine_state.failure_code, 'server_restarted');
    assert.equal(result.recovered, true);
    assert.ok(/does not resume/.test(result.recovery_note));
  });

  await arm('K9', 'a failed record write does not fail the job; a missing record folder is created', async () => {
    need();
    // a home where .mindrian is a plain file: the folder cannot be made
    const badHome = path.join(TMP, 'home-bad');
    fs.mkdirSync(badHome);
    fs.writeFileSync(path.join(badHome, '.mindrian'), 'not a folder');
    const wBad = makeWorld();
    wBad.deps.env = { MINDRIAN_EUREKA_ROOT: ENGINE, HOME: badHome };
    const bad = await startGeneric(wBad);
    assert.equal(bad.ok, true);
    assert.equal(bad.record_persisted, false);
    assert.equal(typeof bad.record_note, 'string');
    assert.ok(/could not be saved/.test(bad.record_note), bad.record_note);
    assert.ok(jobs.sessions.has(bad.job_id), 'the job session was not kept');
    // no room id: no record, the job still starts
    const wNoRoom = makeWorld();
    wNoRoom.ident.room = null;
    const noRoom = await startGeneric(wNoRoom);
    assert.equal(noRoom.record_persisted, false);
    // a home without the folder: the folder is created
    const freshHome = path.join(TMP, 'home-fresh');
    fs.mkdirSync(freshHome);
    const wFresh = makeWorld();
    wFresh.deps.env = { MINDRIAN_EUREKA_ROOT: ENGINE, HOME: freshHome };
    const fresh = await startGeneric(wFresh);
    assert.equal(fresh.record_persisted, true);
    assert.equal(fs.existsSync(recordFile('room-k', fresh.job_id, freshHome)), true);
  });

  await arm('K10', 'the record is written at start for a generic job and a pair-screen job', async () => {
    need();
    // generic
    const w = makeWorld();
    const idem = hex('caller-idem');
    const request = genericRequest();
    const started = await jobs.startCapability({ capability_id: GENERIC, request, idempotency_key: idem }, {}, w.deps);
    assert.equal(started.ok, true);
    const file = recordFile('room-k', started.job_id);
    const text = fs.readFileSync(file, 'utf8');
    const row = JSON.parse(text);
    assert.equal(row.job_id, started.job_id);
    assert.equal(row.capability_id, GENERIC);
    assert.equal(row.route, 'scout_start');
    assert.equal(row.scope_id, SCOPE);
    assert.equal(row.snapshot_id, SNAPSHOT);
    assert.equal(row.room_id, 'room-k');
    assert.equal(row.session_key_hash, hex(RAW_SESSION));
    assert.equal(row.request_sha256, hex(canon(request)));
    assert.equal(row.artifact_count, 1);
    assert.equal(row.top_k, 4);
    assert.equal(row.plan_digest, null);
    assert.equal(row.approval_ref, null);
    assert.equal(row.idempotency_key, idem);
    assert.equal(Date.parse(row.engine_expires_at) - Date.parse(row.started_at), 30 * DAY);
    assert.ok(text.indexOf(MARK) === -1, 'a marker string reached the record');
    assert.equal(row.terminal, false);
    // pair screen: plan, approve through the ledger, start
    run.clearCatalogCache();
    const wp = makeWorld();
    const sessionId = 'k-pair-session';
    const before = Array.from(gateLedger._internal._ledger.keys());
    const awaiting = await jobs.startCapability({ capability_id: PAIR, request: { node_ids: ['n1', 'n2', 'n3'], objective: 'Find unusual pairs ' + MARK } },
      { sessionId }, wp.deps);
    try {
      assert.equal(awaiting.ok, true, JSON.stringify(awaiting).slice(0, 200));
      const entry = gateLedger.consumeGate(awaiting.gate_id, sessionId);
      assert.ok(entry && typeof entry.resumeFn === 'function', 'no gate entry');
      const res = await entry.resumeFn({ gate_id: awaiting.gate_id, chosen: ['approve_run'], verdict: 'approve' });
      assert.equal(res.ok, true, JSON.stringify(res).slice(0, 300));
      const planned = wp.engine.planned;
      const prow = readRec('room-k', res.job_id);
      const ptext = fs.readFileSync(recordFile('room-k', res.job_id), 'utf8');
      assert.equal(prow.capability_id, PAIR);
      assert.equal(prow.route, 'scout_start_pair_screen');
      assert.equal(prow.plan_digest, hex(JSON.stringify(planned)));
      assert.equal(prow.approval_ref, awaiting.gate_id);
      assert.equal(prow.request_sha256, hex(canon(planned)), 'request_sha256 must be the digest of the request without the approval block');
      assert.equal(prow.artifact_count, planned.artifacts.length);
      assert.equal(prow.top_k, planned.top_k === undefined ? null : planned.top_k);
      assert.match(prow.idempotency_key, /^[a-f0-9]{64}$/);
      assert.ok(ptext.indexOf(MARK) === -1, 'a marker string reached the pair-screen record');
      for (const key of Object.keys(prow)) assert.ok(rec.ALLOWED_KEYS.includes(key), 'key outside the list: ' + key);
    } finally {
      for (const id of Array.from(gateLedger._internal._ledger.keys())) if (!before.includes(id)) gateLedger._internal._ledger.delete(id);
      restartHost();
    }
  });

  cleanup();
  process.exit(failed ? 1 : 0);
}

main();
