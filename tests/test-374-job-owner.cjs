'use strict';

// Phase 374 plan 05, test T8 (arms O0 to O5). RED first: plan 374-06 makes it green.
//
// What this pins: a retained Eureka job belongs to the MCP session and the room that started it.
//   O1  the same session reads status, result and cancel of its own job.
//   O2  another session gets job_session_wrong_owner from status, result and cancel, and the fake
//       engine client receives no tool call from that caller.
//   O3  the same session key with a different bound room id also gets job_session_wrong_owner.
//   O4  the stored record holds session_key_hash (64 hex) and no property equal to the raw session id.
//   O5  an unknown job id still gives job_session_not_found.
//
// The caller identity is injected through deps.callerIdentity, a function (extra) =>
// ({ sessionKeyHash, roomId }), passed as the last argument of startCapability, jobStatus,
// jobResult and cancelJob. Plan 374-06 adds that seam.
//
// No engine, no network, no room database (D-02, D-08). The engine is an in-process fake client.
// Output: "ok - <id> <text>" or "FAIL - <id> <text>" at column 1, exit 1 when any arm fails.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const jobs = require('../lib/mcp/tools/eureka-capability-jobs.cjs');

const CAPABILITY = 'opportunity.find_cross_domain_pairs';
const SCOPE = 'room:owner';
const SNAPSHOT = 'snapshot-owner';
const RAW_A = 'raw-session-id-alpha-7f3a';
const RAW_B = 'raw-session-id-bravo-91c2';

const fakeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-374-owner-'));
fs.writeFileSync(path.join(fakeRoot, 'pyproject.toml'), '[project]\nname = "fake"\n');

function sha256(text) { return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex'); }

// The injected identity: the hash of the raw session id, and a room id. The raw id is never returned.
function callerIdentity(extra) {
  return { sessionKeyHash: sha256(extra && extra.sessionId), roomId: (extra && extra.roomId) || null };
}
const extraA = { sessionId: RAW_A, roomId: 'room-one' };
const extraB = { sessionId: RAW_B, roomId: 'room-one' };
const extraARoom2 = { sessionId: RAW_A, roomId: 'room-two' };

function makeEngine() {
  const engine = { calls: [], closes: 0, jobCounter: 0 };
  engine.StdioClientTransport = class FakeTransport { constructor() {} };
  engine.Client = class FakeClient {
    constructor() {}
    async connect() {}
    async close() { engine.closes += 1; }
    async callTool(input) {
      engine.calls.push(input.name);
      if (input.name === 'scout_capabilities') return { structuredContent: { capabilities: [{
        id: CAPABILITY, status: 'experimental', routes: { mcp: { tool: 'scout_start' } },
      }] } };
      if (input.name === 'scout_capability_contract') return { structuredContent: {
        capability: { id: CAPABILITY }, schemas: { input: {}, output: {} },
      } };
      if (input.name === 'scout_start') {
        engine.jobCounter += 1;
        return { structuredContent: { job_id: 'job-owner-' + engine.jobCounter, status: 'queued' } };
      }
      if (input.name === 'scout_status') return { structuredContent: { status: 'completed', progress: 'complete', events: [] } };
      if (input.name === 'scout_cancel') return { structuredContent: { status: 'cancellation_requested' } };
      if (input.name === 'scout_result') return { structuredContent: {
        capability_id: CAPABILITY, status: 'completed', scope: { scope_id: SCOPE, snapshot_id: SNAPSHOT }, outputs: [],
      } };
      throw new Error('unexpected call ' + input.name);
    }
  };
  return engine;
}

function depsFor(engine) {
  return { env: { MINDRIAN_EUREKA_ROOT: fakeRoot }, Client: engine.Client,
    StdioClientTransport: engine.StdioClientTransport, callerIdentity };
}

async function resetSessions() {
  for (const id of Array.from(jobs.sessions.keys())) {
    try { await jobs.closeSession(id); } catch (_e) { /* best effort */ }
    jobs.sessions.delete(id);
  }
}

async function startOwned(engine, extra) {
  const out = await jobs.startCapability({ capability_id: CAPABILITY,
    request: { scope_id: SCOPE, snapshot_id: SNAPSHOT } }, extra, depsFor(engine));
  assert.equal(out.ok, true, 'the start must succeed first (reason ' + out.reason + ')');
  return out;
}

const ENGINE_JOB_CALLS = new Set(['scout_status', 'scout_result', 'scout_cancel']);
function jobCallCount(engine) { return engine.calls.filter((n) => ENGINE_JOB_CALLS.has(n)).length; }

let failed = 0;
async function arm(id, text, fn) {
  try {
    await resetSessions();
    await fn();
    console.log('ok - ' + id + ' ' + text);
  } catch (error) {
    failed += 1;
    console.log('FAIL - ' + id + ' ' + text);
    console.log('  reason: ' + String(error && error.message || error).split('\n')[0]);
  }
}

async function main() {
  await arm('O0', 'the caller identity seam exists: the session record binds to the injected identity', async () => {
    const engine = makeEngine();
    const started = await startOwned(engine, extraA);
    const record = jobs.sessions.get(started.job_id);
    assert.ok(record, 'the started job must be retained');
    assert.equal(record.session_key_hash, sha256(RAW_A),
      'the session record has no session_key_hash from deps.callerIdentity yet (plan 374-06 adds the callerIdentity seam to startCapability, jobStatus, jobResult and cancelJob)');
  });

  await arm('O1', 'the same session reads status, cancel and result of its own job', async () => {
    const engine = makeEngine();
    const started = await startOwned(engine, extraA);
    const deps = depsFor(engine);
    const status = await jobs.jobStatus({ job_id: started.job_id }, extraA, deps);
    assert.equal(status.ok, true, 'own status, reason ' + status.reason);
    const cancel = await jobs.cancelJob({ job_id: started.job_id }, extraA, deps);
    assert.equal(cancel.ok, true, 'own cancel, reason ' + cancel.reason);
    const result = await jobs.jobResult({ job_id: started.job_id }, extraA, deps);
    assert.equal(result.ok, true, 'own result, reason ' + result.reason);
  });

  await arm('O2', 'another session gets job_session_wrong_owner and the engine gets no call', async () => {
    const engine = makeEngine();
    const started = await startOwned(engine, extraA);
    const deps = depsFor(engine);
    const before = jobCallCount(engine);
    const status = await jobs.jobStatus({ job_id: started.job_id }, extraB, deps);
    const result = await jobs.jobResult({ job_id: started.job_id }, extraB, deps);
    const cancel = await jobs.cancelJob({ job_id: started.job_id }, extraB, deps);
    assert.equal(status.reason, 'job_session_wrong_owner', 'status by another session, got ' + status.reason);
    assert.equal(result.reason, 'job_session_wrong_owner', 'result by another session, got ' + result.reason);
    assert.equal(cancel.reason, 'job_session_wrong_owner', 'cancel by another session, got ' + cancel.reason);
    assert.equal(jobCallCount(engine), before, 'the engine client must receive no job call from the wrong caller');
    assert.equal(jobs.sessions.has(started.job_id), true, 'a wrong caller must not close the owner session');
  });

  await arm('O3', 'the same session key with another bound room gets job_session_wrong_owner', async () => {
    const engine = makeEngine();
    const started = await startOwned(engine, extraA);
    const deps = depsFor(engine);
    const before = jobCallCount(engine);
    const status = await jobs.jobStatus({ job_id: started.job_id }, extraARoom2, deps);
    const result = await jobs.jobResult({ job_id: started.job_id }, extraARoom2, deps);
    const cancel = await jobs.cancelJob({ job_id: started.job_id }, extraARoom2, deps);
    assert.equal(status.reason, 'job_session_wrong_owner', 'status from another room, got ' + status.reason);
    assert.equal(result.reason, 'job_session_wrong_owner', 'result from another room, got ' + result.reason);
    assert.equal(cancel.reason, 'job_session_wrong_owner', 'cancel from another room, got ' + cancel.reason);
    assert.equal(jobCallCount(engine), before, 'no job call may reach the engine from another room');
  });

  await arm('O4', 'the stored record holds session_key_hash (64 hex) and never the raw session id', async () => {
    const engine = makeEngine();
    const started = await startOwned(engine, extraA);
    const record = jobs.sessions.get(started.job_id);
    assert.ok(record, 'the started job must be retained');
    assert.match(String(record.session_key_hash), /^[a-f0-9]{64}$/, 'session_key_hash must be 64 hex characters');
    const plain = {};
    for (const key of Object.keys(record)) {
      if (key === 'client' || key === 'timer') continue;
      plain[key] = record[key];
    }
    assert.equal(JSON.stringify(plain).includes(RAW_A), false, 'the raw session id must not be stored in any property');
    for (const key of Object.keys(plain)) {
      assert.notEqual(plain[key], RAW_A, 'property ' + key + ' must not equal the raw session id');
    }
  });

  await arm('O5', 'an unknown job id still gives job_session_not_found', async () => {
    const engine = makeEngine();
    const deps = depsFor(engine);
    const status = await jobs.jobStatus({ job_id: 'job-from-nowhere' }, extraA, deps);
    const result = await jobs.jobResult({ job_id: 'job-from-nowhere' }, extraA, deps);
    const cancel = await jobs.cancelJob({ job_id: 'job-from-nowhere' }, extraA, deps);
    assert.equal(status.reason, 'job_session_not_found');
    assert.equal(result.reason, 'job_session_not_found');
    assert.equal(cancel.reason, 'job_session_not_found');
  });

  fs.rmSync(fakeRoot, { recursive: true, force: true });
  await resetSessions();
  console.log('374 job owner: 6 arms, ' + failed + ' failed');
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
