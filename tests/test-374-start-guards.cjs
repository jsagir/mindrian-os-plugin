'use strict';

// Phase 374 plan 05, test T6 (arms G0 to G4). RED first: plan 374-06 makes it green.
//
// What this pins on the generic Eureka job path (eureka_capability_start and job_result):
//   G1  a request over 20 MiB is refused with request_too_large before any child starts.
//   G2  a request without scope_id, or without snapshot_id, is refused with lineage_required,
//       and no child starts.
//   G3  a request with both ids and a normal size still starts.
//   G4  the lineage check on a result is unconditional: a result with no scope gives
//       engine_lineage_missing, a different scope_id or snapshot_id gives engine_lineage_mismatch,
//       an equal scope gives ok; the retained session is closed in every case.
//
// No engine, no network, no room database (D-02, D-08). The engine is an in-process fake client
// (the idiom of tests/test-eureka-capability-run.cjs). The test holds no room content.
// Output: "ok - <id> <text>" or "FAIL - <id> <text>" at column 1, exit 1 when any arm fails.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const run = require('../lib/mcp/tools/eureka-capability-run.cjs');
const jobs = require('../lib/mcp/tools/eureka-capability-jobs.cjs');

const CAPABILITY = 'opportunity.find_cross_domain_pairs';
const SCOPE = 'room:guard';
const SNAPSHOT = 'snapshot-guard';
const MIB = 1024 * 1024;

const fakeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-374-guards-'));
fs.writeFileSync(path.join(fakeRoot, 'pyproject.toml'), '[project]\nname = "fake"\n');

// A fresh fake engine for every arm. Counters show whether a child was ever started.
function makeEngine() {
  const engine = { transports: 0, connects: 0, closes: 0, calls: [], resultPayload: null, jobCounter: 0 };
  engine.StdioClientTransport = class FakeTransport { constructor() { engine.transports += 1; } };
  engine.Client = class FakeClient {
    constructor() {}
    async connect() { engine.connects += 1; }
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
        return { structuredContent: { job_id: 'job-guard-' + engine.jobCounter, status: 'queued' } };
      }
      if (input.name === 'scout_result') return { structuredContent: engine.resultPayload };
      if (input.name === 'scout_status') return { structuredContent: { status: 'completed', progress: 'complete', events: [] } };
      if (input.name === 'scout_cancel') return { structuredContent: { status: 'cancellation_requested' } };
      throw new Error('unexpected call ' + input.name);
    }
  };
  return engine;
}

function depsFor(engine) {
  return {
    env: { MINDRIAN_EUREKA_ROOT: fakeRoot },
    Client: engine.Client,
    StdioClientTransport: engine.StdioClientTransport,
    // The identity seam of plan 374-06. Ignored by the current code; harmless now.
    callerIdentity: () => ({ sessionKeyHash: 'a'.repeat(64), roomId: 'room-guard' }),
  };
}

function goodResult(scope) {
  return { capability_id: CAPABILITY, status: 'completed', outputs: [], ...(scope === undefined ? {} : { scope }) };
}

async function resetSessions() {
  for (const id of Array.from(jobs.sessions.keys())) {
    const rec = jobs.sessions.get(id);
    if (rec && rec.client && typeof rec.client.close === 'function') {
      try { await jobs.closeSession(id); } catch (_e) { /* best effort */ }
    }
    jobs.sessions.delete(id);
  }
}

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

async function startWith(engine, request) {
  return jobs.startCapability({ capability_id: CAPABILITY, request }, {}, depsFor(engine));
}

async function main() {
  await arm('G0', 'the shared size helper requestTooLarge is exported by eureka-capability-run.cjs', async () => {
    assert.equal(typeof run.requestTooLarge, 'function',
      'requestTooLarge is not exported by lib/mcp/tools/eureka-capability-run.cjs yet (plan 374-06 adds the shared size helper and the job start guards)');
    assert.equal(run.MAX_REQUEST_BYTES, 20 * MIB, 'MAX_REQUEST_BYTES must be exported and equal 20 MiB');
  });

  await arm('G1', 'a request over 20 MiB gives request_too_large and no child starts', async () => {
    const engine = makeEngine();
    const big = { scope_id: SCOPE, snapshot_id: SNAPSHOT, filler: 'x'.repeat(20 * MIB + 1024) };
    const out = await startWith(engine, big);
    assert.equal(out.ok, false, 'a start with an oversize request must be refused (the job path has no size cap today)');
    assert.equal(out.reason, 'request_too_large');
    assert.equal(engine.transports, 0, 'no transport (child) may be created for an oversize request');
    assert.equal(engine.connects, 0, 'the client must never connect for an oversize request');
    assert.equal(jobs.sessions.size, 0, 'no session may be retained');
  });

  await arm('G2', 'a request without scope_id, or without snapshot_id, gives lineage_required and no child starts', async () => {
    for (const missing of ['scope_id', 'snapshot_id']) {
      const engine = makeEngine();
      const request = { scope_id: SCOPE, snapshot_id: SNAPSHOT };
      delete request[missing];
      const out = await startWith(engine, request);
      assert.equal(out.ok, false, 'a start without ' + missing + ' must be refused');
      assert.equal(out.reason, 'lineage_required', 'missing ' + missing);
      assert.equal(engine.transports, 0, 'no child may start when ' + missing + ' is missing');
      assert.equal(engine.connects, 0);
    }
  });

  await arm('G3', 'a request with both ids and a normal size starts and returns a job id', async () => {
    const engine = makeEngine();
    const out = await startWith(engine, { scope_id: SCOPE, snapshot_id: SNAPSHOT, topic: 'care systems' });
    assert.equal(out.ok, true, 'a good start must proceed: ' + JSON.stringify({ reason: out.reason }));
    assert.equal(typeof out.job_id, 'string');
    assert.equal(out.scope_id, SCOPE);
    assert.equal(out.snapshot_id, SNAPSHOT);
    assert.equal(engine.connects, 1);
  });

  await arm('G4', 'the lineage check on a result is unconditional and the session closes in every case', async () => {
    const cases = [
      { name: 'no scope', scope: undefined, ok: false, reason: 'engine_lineage_missing' },
      { name: 'different scope_id', scope: { scope_id: 'room:other', snapshot_id: SNAPSHOT }, ok: false, reason: 'engine_lineage_mismatch' },
      { name: 'different snapshot_id', scope: { scope_id: SCOPE, snapshot_id: 'snapshot-other' }, ok: false, reason: 'engine_lineage_mismatch' },
      { name: 'equal scope', scope: { scope_id: SCOPE, snapshot_id: SNAPSHOT }, ok: true },
    ];
    for (const c of cases) {
      const engine = makeEngine();
      const started = await startWith(engine, { scope_id: SCOPE, snapshot_id: SNAPSHOT });
      assert.equal(started.ok, true, c.name + ': the start must succeed first');
      engine.resultPayload = goodResult(c.scope);
      const result = await jobs.jobResult({ job_id: started.job_id }, {}, depsFor(engine));
      assert.equal(result.ok, c.ok, c.name + ': ok flag, got reason ' + result.reason);
      if (!c.ok) assert.equal(result.reason, c.reason, c.name + ': expected ' + c.reason + ', got ' + result.reason);
      assert.equal(jobs.sessions.has(started.job_id), false, c.name + ': the retained session must be closed');
      assert.equal(engine.closes >= 1, true, c.name + ': the worker client must be closed');
    }
  });

  fs.rmSync(fakeRoot, { recursive: true, force: true });
  await resetSessions();
  console.log('374 start guards: 5 arms, ' + failed + ' failed');
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
