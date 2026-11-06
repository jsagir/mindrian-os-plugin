#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 387 plan 05 -- pins the typed engine states at the registerEurekaTool chokepoint.
 *
 * Arms G1 to G9. The real engine is never started: the fixture engine folder holds a pyproject.toml only,
 * the uv path is a nonexistent absolute path, and process.env is changed only inside a try and restored in a
 * finally. Synthetic strings only. Node built-ins and the repo modules only.
 */
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const TOOLS_DIR = path.join(REPO, 'lib', 'mcp', 'tools');
const CONTRACT = path.join(REPO, 'lib', 'mcp', 'eureka-tool-contract.cjs');
const { mkIsolatedHome } = require('./helpers/isolated-home-36925.cjs');
const { SYNTHETIC_ARGS } = require('./helpers/eureka-installed-layout-387.cjs');

// Measured at git sha 16b4bf2f8 (HEAD before Plan 387-05): the 23 tools registered through lib/mcp/tools
// (eureka_critic registers elsewhere), and the sum of their description byte lengths.
const BASELINE_NAMES = [
  'eureka_capability_job_cancel', 'eureka_capability_job_result', 'eureka_capability_job_status',
  'eureka_capability_run', 'eureka_capability_start', 'eureka_graph_analyze',
  'eureka_graph_assess_category_edge_patterns', 'eureka_graph_backtest', 'eureka_graph_compare_topics',
  'eureka_graph_find_community_bridge_pairs', 'eureka_graph_find_network_holes',
  'eureka_graph_find_shared_neighbor_gaps', 'eureka_graph_find_similar_unlinked_items',
  'eureka_graph_genesis_plan', 'eureka_graph_map_neighbourhoods', 'eureka_graph_opportunity_scout',
  'eureka_graph_package_relationships', 'eureka_graph_prepare_artifacts', 'eureka_graph_project',
  'eureka_graph_propose_relationships', 'eureka_graph_rank_paths', 'eureka_graph_score_surprise',
  'eureka_hsi_interpret_whitespace',
];
const BASELINE_DESC_BYTES = 9096;

let passed = 0;
let failed = 0;
function arm(label, fn) {
  try {
    fn();
    console.log('ok - ' + label);
    passed += 1;
  } catch (error) {
    console.log('FAIL - ' + label + ' :: ' + (error && error.message ? String(error.message).split('\n')[0] : String(error)));
    failed += 1;
  }
}
async function armAsync(label, fn) {
  try {
    await fn();
    console.log('ok - ' + label);
    passed += 1;
  } catch (error) {
    console.log('FAIL - ' + label + ' :: ' + (error && error.message ? String(error.message).split('\n')[0] : String(error)));
    failed += 1;
  }
}

const TO_REMOVE = [];
function tmp(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '387-05-' + prefix + '-'));
  TO_REMOVE.push(dir);
  return dir;
}
process.on('exit', () => { for (const d of TO_REMOVE) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } } });

const ENV_KEYS = ['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_EUREKA_ROOT', 'MINDRIAN_EUREKA_UV', 'MINDRIAN_ACTIVE_SESSION_ID', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_ACTIVE_ROOM'];

// Run fn with process.env set to an isolated home plus the given engine variables; restore in a finally.
async function withEnv(overrides, fn) {
  const saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  const iso = mkIsolatedHome('g');
  try {
    process.env.HOME = iso.home;
    process.env.USERPROFILE = iso.home;
    process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
    for (const k of ['MINDRIAN_EUREKA_ROOT', 'MINDRIAN_EUREKA_UV', 'MINDRIAN_ACTIVE_SESSION_ID', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_ACTIVE_ROOM']) delete process.env[k];
    for (const [k, v] of Object.entries(overrides || {})) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    return await fn(iso);
  } finally {
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    iso.cleanup();
  }
}

function captureAll() {
  const cap = {};
  const server = { registerTool(name, config, handler) { cap[name] = { config, handler }; } };
  for (const f of fs.readdirSync(TOOLS_DIR).filter((x) => /^eureka-.*\.cjs$/.test(x)).sort()) {
    const m = require(path.join(TOOLS_DIR, f));
    if (typeof m.register === 'function') m.register(server, {});
  }
  return cap;
}

function fixtureEngine() {
  const dir = tmp('engine');
  fs.writeFileSync(path.join(dir, 'pyproject.toml'), '[project]\nname = "fixture-not-an-engine"\n');
  // Plan 387-11: the route gate refuses a folder with no prepared environment (env_not_synced). The fixture
  // holds an environment folder with a config file only (layout unreadable, so the gate does not refuse).
  fs.mkdirSync(path.join(dir, '.venv'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.venv', 'pyvenv.cfg'), 'home = /synthetic\n');
  return dir;
}

function gatedNames(contract, cap) {
  return Object.keys(cap).filter((n) => !contract.ENGINE_FREE_TOOLS.has(n) && !contract.JOB_LIFECYCLE_TOOLS.has(n)).sort();
}

function sc(result) { return (result && result.structuredContent) || {}; }

const FIX_ABSENT = '/mos:eureka enable engine --path <folder>';

console.log('Phase 387 plan 05 -- typed Eureka engine states');

async function main() {
  await armAsync('G1 no engine: every gated tool answers engine_not_configured, state absent, before the room check', async () => {
    await withEnv({}, async () => {
      const contract = require(CONTRACT);
      const cap = captureAll();
      const names = gatedNames(contract, cap);
      assert.ok(names.length >= 19, 'expected at least 19 gated tools, got ' + names.length);
      for (const name of names) {
        const result = await cap[name].handler(SYNTHETIC_ARGS[name], {});
        const body = sc(result);
        assert.strictEqual(result.isError, true, name);
        assert.strictEqual(body.reason, 'engine_not_configured', name + ' reason ' + body.reason);
        assert.strictEqual(body.engine_state, 'absent', name);
        assert.strictEqual(body.fix, FIX_ABSENT, name);
        assert.ok(String(body.message).indexOf('The Eureka engine is not set up on this machine.') === 0, name + ' message ' + body.message);
      }
    });
  });

  await armAsync('G2 a missing engine folder answers engine_checkout_unavailable, broken, checkout_missing', async () => {
    const missing = path.join(os.tmpdir(), '387-05-no-such-folder-' + process.pid);
    await withEnv({ MINDRIAN_EUREKA_ROOT: missing }, async () => {
      const contract = require(CONTRACT);
      const cap = captureAll();
      for (const name of gatedNames(contract, cap)) {
        const body = sc(await cap[name].handler(SYNTHETIC_ARGS[name], {}));
        assert.strictEqual(body.reason, 'engine_checkout_unavailable', name);
        assert.strictEqual(body.engine_state, 'broken', name);
        assert.strictEqual(body.cause, 'checkout_missing', name);
      }
    });
  });

  await armAsync('G3 an empty engine folder answers engine_checkout_unavailable with cause pyproject_missing', async () => {
    const empty = tmp('empty');
    await withEnv({ MINDRIAN_EUREKA_ROOT: empty }, async () => {
      const contract = require(CONTRACT);
      const cap = captureAll();
      for (const name of gatedNames(contract, cap)) {
        const body = sc(await cap[name].handler(SYNTHETIC_ARGS[name], {}));
        assert.strictEqual(body.reason, 'engine_checkout_unavailable', name);
        assert.strictEqual(body.engine_state, 'broken', name);
        assert.strictEqual(body.cause, 'pyproject_missing', name);
      }
    });
  });

  await armAsync('G4 a missing uv is uv_missing on the four spawning functions; a plain start failure is engine_start_failed', async () => {
    const root = fixtureEngine();
    const noUv = path.join(os.tmpdir(), '387-05-no-such-uv-' + process.pid);
    await withEnv({ MINDRIAN_EUREKA_ROOT: root, MINDRIAN_EUREKA_UV: noUv }, async () => {
      const env = Object.assign({}, process.env);
      const run = require(path.join(TOOLS_DIR, 'eureka-capability-run.cjs'));
      const analyze = require(path.join(TOOLS_DIR, 'eureka-graph-analyze.cjs'));
      const jobs = require(path.join(TOOLS_DIR, 'eureka-capability-jobs.cjs'));
      const results = {
        capability: await run.callEurekaCapability('graph.explore_local_relationships', {}, env),
        workflow: await analyze.callEurekaWorkflow('graph.explore_local_relationships', {}, env),
        scout: await analyze.callEurekaOpportunityScout({ objective: 'Synthetic objective', artifacts: [] }, env),
        start: await jobs.startCapability({ capability_id: 'graph.explore_local_relationships', request: {} }, {}, { env }),
      };
      for (const [label, r] of Object.entries(results)) {
        assert.strictEqual(r.ok, false, label);
        assert.strictEqual(r.reason, 'engine_unavailable', label + ' reason ' + r.reason);
        assert.strictEqual(r.engine_state, 'broken', label);
        assert.strictEqual(r.cause, 'uv_missing', label);
        assert.ok(String(r.message).indexOf('The tool uv is not installed or is not on the PATH, so the engine cannot start.') === 0, label + ' message ' + r.message);
        assert.ok(!/ENOENT/.test(JSON.stringify(r)), label + ' holds raw spawn text');
      }
      // a plain start failure (a fake client whose connect throws a plain error)
      class FakeTransport { constructor(options) { this.options = options; } }
      class FakeClient {
        constructor() {}
        async connect() { throw new Error('boom from the engine ' + root); }
        async close() {}
      }
      const deps = { StdioClientTransport: FakeTransport, Client: FakeClient };
      const failures = {
        workflow: await analyze.callEurekaWorkflow('graph.explore_local_relationships', {}, env, undefined, deps),
        scout: await analyze.callEurekaOpportunityScout({ objective: 'Synthetic objective', artifacts: [] }, env, undefined, deps),
        start: await jobs.startCapability({ capability_id: 'graph.explore_local_relationships', request: {} }, {}, Object.assign({ env }, deps)),
        capability: await run.callEurekaCapability('graph.explore_local_relationships', {}, env, undefined, deps),
      };
      for (const [label, r] of Object.entries(failures)) {
        assert.strictEqual(r.reason, 'engine_unavailable', label);
        assert.strictEqual(r.cause, 'engine_start_failed', label + ' cause ' + r.cause);
        assert.strictEqual(r.fix, '/mos:eureka enable engine --check --deep', label);
        assert.ok(JSON.stringify(r).indexOf(root) === -1, label + ' leaks the folder');
      }
    });
  });

  await armAsync('G5 the wrapper calls the handler once when the engine is present, and for free and lifecycle tools without one', async () => {
    const contract = require(CONTRACT);
    const root = fixtureEngine();
    const make = (name) => {
      const calls = [];
      const server = { registerTool(n, config, handler) { server.handler = handler; } };
      contract.registerEurekaTool(server, name, { title: 't', description: 'd' }, async () => { calls.push(1); return { content: [], structuredContent: { ok: true } }; });
      return { server, calls };
    };
    await withEnv({ MINDRIAN_EUREKA_ROOT: root }, async () => {
      const a = make('eureka_graph_analyze');
      await a.server.handler({}, {});
      assert.strictEqual(a.calls.length, 1, 'present engine: handler must run once');
    });
    await withEnv({}, async () => {
      assert.ok(contract.ENGINE_FREE_TOOLS.has('eureka_graph_project'));
      for (const name of ['eureka_graph_project', 'eureka_capability_job_status', 'eureka_capability_job_result', 'eureka_capability_job_cancel']) {
        const t = make(name);
        await t.server.handler({}, {});
        assert.strictEqual(t.calls.length, 1, name + ': handler must run once with no engine');
      }
      const gated = make('eureka_graph_analyze');
      const out = await gated.server.handler({}, {});
      assert.strictEqual(gated.calls.length, 0, 'absent engine: a gated handler must not run');
      assert.strictEqual(out.isError, true);
    });
  });

  await armAsync('G6 free and lifecycle tools: project has no engine_state; job_status adds the engine state', async () => {
    await withEnv({}, async () => {
      const cap = captureAll();
      const project = sc(await cap.eureka_graph_project.handler(SYNTHETIC_ARGS.eureka_graph_project, {}));
      assert.strictEqual(project.reason, 'no_bound_room');
      assert.ok(!('engine_state' in project), 'project must not carry engine_state');
      const status = sc(await cap.eureka_capability_job_status.handler(SYNTHETIC_ARGS.eureka_capability_job_status, {}));
      assert.strictEqual(status.reason, 'job_session_not_found');
      assert.strictEqual(status.engine_state, 'absent');
      assert.ok(typeof status.fix === 'string' && status.fix.length > 0);
      assert.ok(/no job can start/.test(status.message), status.message);
    });
  });

  await armAsync('G7 a saved setting passes the gate with no environment variable', async () => {
    const contract = require(CONTRACT);
    const resolver = require(path.join(REPO, 'lib', 'core', 'eureka', 'eureka-engine-resolver.cjs'));
    const root = fixtureEngine();
    await withEnv({}, async () => {
      const w = resolver.writePointer(root, process.env);
      assert.ok(w.ok, 'writePointer failed');
      const calls = [];
      const server = { registerTool(n, c, h) { server.handler = h; } };
      contract.registerEurekaTool(server, 'eureka_graph_analyze', { title: 't', description: 'd' }, async () => { calls.push(1); return { content: [], structuredContent: { ok: true } }; });
      await server.handler({}, {});
      assert.strictEqual(calls.length, 1, 'the saved setting must pass the gate');
    });
  });

  await armAsync('G8 refusals hold neither the fixture folder nor the temp directory', async () => {
    const root = fixtureEngine();
    const empty = tmp('empty8');
    const noUv = path.join(os.tmpdir(), '387-05-no-such-uv8-' + process.pid);
    const seen = [];
    await withEnv({ MINDRIAN_EUREKA_ROOT: empty }, async () => {
      const contract = require(CONTRACT);
      const cap = captureAll();
      for (const name of gatedNames(contract, cap)) seen.push(JSON.stringify(sc(await cap[name].handler(SYNTHETIC_ARGS[name], {}))));
    });
    await withEnv({ MINDRIAN_EUREKA_ROOT: root, MINDRIAN_EUREKA_UV: noUv }, async () => {
      const run = require(path.join(TOOLS_DIR, 'eureka-capability-run.cjs'));
      seen.push(JSON.stringify(await run.callEurekaCapability('graph.explore_local_relationships', {}, Object.assign({}, process.env))));
    });
    assert.ok(seen.length > 5);
    for (const text of seen) {
      assert.ok(text.indexOf(root) === -1 && text.indexOf(empty) === -1 && text.indexOf(noUv) === -1, 'a refusal holds a local path');
      assert.ok(text.indexOf(os.tmpdir()) === -1, 'a refusal holds the temp directory');
    }
  });

  await armAsync('G9 descriptions: no old variable text, the 3 engine descriptions name the enable command, nothing hidden or added', async () => {
    await withEnv({}, async () => {
      const cap = captureAll();
      const names = Object.keys(cap).sort();
      assert.deepStrictEqual(names, BASELINE_NAMES);
      let bytes = 0;
      for (const n of names) {
        const d = String(cap[n].config.description || '');
        bytes += Buffer.byteLength(d, 'utf8');
        assert.ok(d.indexOf('Set MINDRIAN_EUREKA_ROOT') === -1, n + ' still says Set MINDRIAN_EUREKA_ROOT');
      }
      for (const n of ['eureka_graph_analyze', 'eureka_graph_find_shared_neighbor_gaps', 'eureka_graph_opportunity_scout']) {
        assert.ok(String(cap[n].config.description).indexOf('/mos:eureka enable engine') !== -1, n + ' must name /mos:eureka enable engine');
      }
      assert.ok(bytes <= BASELINE_DESC_BYTES + 300, 'description bytes ' + bytes + ' exceed ' + (BASELINE_DESC_BYTES + 300));
      console.log('   description bytes: baseline ' + BASELINE_DESC_BYTES + ', now ' + bytes);
    });
  });

  console.log('\ntest-387-eureka-engine-states: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.log(String(e && e.stack || e)); process.exit(1); });
