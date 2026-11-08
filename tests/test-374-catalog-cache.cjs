'use strict';

// Phase 374 plan 05, test T13 (arms C0 to C6). RED first: plan 374-06 adds the cache.
//
// What this pins: the Eureka catalog (scout_capabilities) and each capability contract
// (scout_capability_contract) are fetched once per engine root, not once per call.
//   C1  two calls for one engine root: one scout_capabilities, one scout_capability_contract
//       for each capability.
//   C2  after clearCatalogCache() the next call fetches again.
//   C3  a different engine root fetches again.
//   C4  a changed modification time of the root's pyproject.toml fetches again.
//   C5  startCapability and callEurekaCapability for one root share the cache.
//   C6  an entry lives 30 minutes (the test injects a clock through setCatalogClock; no sleeping).
//
// The child process still starts for every call (the cache saves the two tool calls, not the
// spawn). No engine, no network, no room database (D-02, D-08): the engine is an in-process fake
// client that counts calls by tool name. The cache holds no request and no room data.
// Output: "ok - <id> <text>" or "FAIL - <id> <text>" at column 1, exit 1 when any arm fails.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const run = require('../lib/mcp/tools/eureka-capability-run.cjs');
const jobs = require('../lib/mcp/tools/eureka-capability-jobs.cjs');

const SYNC_ID = 'research.analyze_rs_domain_projection';
const ASYNC_ID = 'opportunity.find_cross_domain_pairs';
const LIFETIME_MS = 30 * 60 * 1000;
const REQUEST = { scope_id: 'room:cache', snapshot_id: 'snapshot-cache', topic: 'care systems' };

const roots = [];
function makeRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-374-cache-'));
  fs.writeFileSync(path.join(dir, 'pyproject.toml'), '[project]\nname = "fake"\n');
  roots.push(dir);
  return dir;
}

// A fresh fake engine for every arm. counts holds the number of calls per tool name.
function makeEngine() {
  const engine = { counts: {}, spawns: 0, jobCounter: 0 };
  const count = (name) => { engine.counts[name] = (engine.counts[name] || 0) + 1; };
  engine.StdioClientTransport = class FakeTransport { constructor() { engine.spawns += 1; } };
  engine.Client = class FakeClient {
    constructor() {}
    async connect() {}
    async close() {}
    async callTool(input) {
      count(input.name);
      if (input.name === 'scout_capabilities') return { structuredContent: { capabilities: [
        { id: SYNC_ID, status: 'experimental', routes: { mcp: { tool: 'scout_run_workflow' } } },
        { id: ASYNC_ID, status: 'experimental', routes: { mcp: { tool: 'scout_start' } } },
      ] } };
      if (input.name === 'scout_capability_contract') return { structuredContent: {
        capability: { id: input.arguments.capability_id }, schemas: { input: { type: 'object' }, output: { type: 'object' } },
      } };
      if (input.name === 'scout_run_workflow') return { structuredContent: {
        capability_id: input.arguments.capability_id, status: 'completed', outputs: [],
      } };
      if (input.name === 'scout_start') {
        engine.jobCounter += 1;
        return { structuredContent: { job_id: 'job-cache-' + engine.jobCounter, status: 'queued' } };
      }
      throw new Error('unexpected call ' + input.name);
    }
  };
  return engine;
}

function depsFor(engine) { return { Client: engine.Client, StdioClientTransport: engine.StdioClientTransport }; }

async function callSync(engine, root, capabilityId) {
  const out = await run.callEurekaCapability(capabilityId || SYNC_ID, REQUEST, { MINDRIAN_EUREKA_ROOT: root }, undefined, depsFor(engine));
  assert.equal(out.ok, true, 'callEurekaCapability must succeed on the fake (reason ' + out.reason + ')');
  return out;
}

async function startAsync(engine, root) {
  const out = await jobs.startCapability({ capability_id: ASYNC_ID, request: REQUEST }, {},
    { env: { MINDRIAN_EUREKA_ROOT: root }, ...depsFor(engine) });
  assert.equal(out.ok, true, 'startCapability must succeed on the fake (reason ' + out.reason + ')');
  return out;
}

async function closeAllSessions() {
  for (const id of Array.from(jobs.sessions.keys())) {
    try { await jobs.closeSession(id); } catch (_e) { /* best effort */ }
    jobs.sessions.delete(id);
  }
}

function resetCache() {
  if (typeof run.clearCatalogCache === 'function') run.clearCatalogCache();
  if (typeof run.setCatalogClock === 'function') run.setCatalogClock();
}

const n = (engine, name) => engine.counts[name] || 0;

let failed = 0;
async function arm(id, text, fn) {
  try {
    await closeAllSessions();
    resetCache();
    await fn();
    console.log('ok - ' + id + ' ' + text);
  } catch (error) {
    failed += 1;
    console.log('FAIL - ' + id + ' ' + text);
    console.log('  reason: ' + String(error && error.message || error).split('\n')[0]);
  } finally {
    resetCache();
  }
}

function needFn(name) {
  assert.equal(typeof run[name], 'function',
    name + ' is not exported by lib/mcp/tools/eureka-capability-run.cjs yet (plan 374-06 adds the catalog cache)');
}

async function main() {
  await arm('C0', 'clearCatalogCache is exported by eureka-capability-run.cjs', async () => {
    needFn('clearCatalogCache');
  });

  await arm('C1', 'two calls for one root fetch the catalog once and each contract once', async () => {
    const engine = makeEngine();
    const root = makeRoot();
    await callSync(engine, root, SYNC_ID);
    await callSync(engine, root, SYNC_ID);
    await callSync(engine, root, SYNC_ID);
    assert.equal(n(engine, 'scout_capabilities'), 1, 'scout_capabilities calls for three runs of one root, expected 1, got ' + n(engine, 'scout_capabilities'));
    assert.equal(n(engine, 'scout_capability_contract'), 1, 'scout_capability_contract calls for one capability, expected 1, got ' + n(engine, 'scout_capability_contract'));
    assert.equal(engine.spawns, 3, 'the child still starts for every call');
    // a second capability adds exactly one contract fetch and no catalog fetch
    await startAsync(engine, root);
    await closeAllSessions(); // plan 374-11: a running job refuses a second start, so the first job ends here
    await startAsync(engine, root);
    assert.equal(n(engine, 'scout_capabilities'), 1, 'the catalog is still fetched once');
    assert.equal(n(engine, 'scout_capability_contract'), 2, 'one contract fetch for each capability, expected 2, got ' + n(engine, 'scout_capability_contract'));
  });

  await arm('C2', 'after clearCatalogCache() the next call fetches again', async () => {
    needFn('clearCatalogCache');
    const engine = makeEngine();
    const root = makeRoot();
    await callSync(engine, root);
    await callSync(engine, root);
    assert.equal(n(engine, 'scout_capabilities'), 1, 'before the clear: expected 1 catalog fetch, got ' + n(engine, 'scout_capabilities'));
    run.clearCatalogCache();
    await callSync(engine, root);
    assert.equal(n(engine, 'scout_capabilities'), 2, 'after the clear: expected 2 catalog fetches, got ' + n(engine, 'scout_capabilities'));
    assert.equal(n(engine, 'scout_capability_contract'), 2, 'after the clear: the contract is fetched again');
  });

  await arm('C3', 'a different engine root fetches again', async () => {
    const engine = makeEngine();
    const rootOne = makeRoot();
    const rootTwo = makeRoot();
    await callSync(engine, rootOne);
    await callSync(engine, rootOne);
    assert.equal(n(engine, 'scout_capabilities'), 1, 'one root, two calls: expected 1 catalog fetch, got ' + n(engine, 'scout_capabilities'));
    await callSync(engine, rootTwo);
    assert.equal(n(engine, 'scout_capabilities'), 2, 'a second root must fetch again, got ' + n(engine, 'scout_capabilities'));
    await callSync(engine, rootTwo);
    await callSync(engine, rootOne);
    assert.equal(n(engine, 'scout_capabilities'), 2, 'each root is cached on its own, got ' + n(engine, 'scout_capabilities'));
  });

  await arm('C4', 'a changed modification time of pyproject.toml fetches again', async () => {
    const engine = makeEngine();
    const root = makeRoot();
    await callSync(engine, root);
    await callSync(engine, root);
    assert.equal(n(engine, 'scout_capabilities'), 1, 'before the touch: expected 1 catalog fetch, got ' + n(engine, 'scout_capabilities'));
    const future = new Date(Date.now() + 3600 * 1000);
    fs.utimesSync(path.join(root, 'pyproject.toml'), future, future);
    await callSync(engine, root);
    assert.equal(n(engine, 'scout_capabilities'), 2, 'after the touch: expected 2 catalog fetches, got ' + n(engine, 'scout_capabilities'));
  });

  await arm('C5', 'startCapability and callEurekaCapability share the cache for one root', async () => {
    const engine = makeEngine();
    const root = makeRoot();
    await callSync(engine, root, SYNC_ID);
    await startAsync(engine, root);
    await closeAllSessions(); // plan 374-11: a running job refuses a second start, so the first job ends here
    await callSync(engine, root, SYNC_ID);
    await startAsync(engine, root);
    assert.equal(n(engine, 'scout_capabilities'), 1, 'both paths, one root: expected 1 catalog fetch, got ' + n(engine, 'scout_capabilities'));
    assert.equal(n(engine, 'scout_capability_contract'), 2, 'one contract fetch per capability across both paths, expected 2, got ' + n(engine, 'scout_capability_contract'));
  });

  await arm('C6', 'an entry lives 30 minutes (injected clock)', async () => {
    needFn('setCatalogClock');
    const engine = makeEngine();
    const root = makeRoot();
    let now = 1_800_000_000_000;
    run.setCatalogClock(() => now);
    await callSync(engine, root);
    now += LIFETIME_MS - 1000;
    await callSync(engine, root);
    assert.equal(n(engine, 'scout_capabilities'), 1, 'just inside 30 minutes: expected 1 catalog fetch, got ' + n(engine, 'scout_capabilities'));
    now += 2000;
    await callSync(engine, root);
    assert.equal(n(engine, 'scout_capabilities'), 2, 'just past 30 minutes: expected 2 catalog fetches, got ' + n(engine, 'scout_capabilities'));
  });

  await closeAllSessions();
  for (const dir of roots) fs.rmSync(dir, { recursive: true, force: true });
  console.log('374 catalog cache: 7 arms, ' + failed + ' failed');
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
