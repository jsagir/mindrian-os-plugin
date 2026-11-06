#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 387 plan 11 -- pins the route needs gate, the typed refusals and the start-phase capture.
 *
 * Arms N1 to N9 live here. Arm N10 (the installed-layout S6 expectation) is in
 * tests/test-387-eureka-installed-layout.cjs, because that file owns the installed-layout table.
 *
 * The real engine is never started. Fixture engine folders hold a pyproject.toml and a fake environment
 * folder (names only). Fake transports and fake clients stand in for the engine process. The one real spawn
 * uses a nonexistent absolute command. Synthetic strings only. process.env is changed inside a try and
 * restored in a finally. Node built-ins and the repo modules only.
 */
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PassThrough } = require('node:stream');

const REPO = path.resolve(__dirname, '..');
const TOOLS_DIR = path.join(REPO, 'lib', 'mcp', 'tools');
const CONTRACT = path.join(REPO, 'lib', 'mcp', 'eureka-tool-contract.cjs');
const RESOLVER = path.join(REPO, 'lib', 'core', 'eureka', 'eureka-engine-resolver.cjs');
const { mkIsolatedHome } = require('./helpers/isolated-home-36925.cjs');

const UV_LINE = 'error: No interpreter found for Python >=3.11 in managed installations or search path';
const TAIL = ' The default /mos:eureka run needs no engine.';

let passed = 0;
let failed = 0;
async function arm(label, fn) {
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '387-11-' + prefix + '-'));
  TO_REMOVE.push(dir);
  return dir;
}
process.on('exit', () => { for (const d of TO_REMOVE) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } } });

// kind: none (no environment folder), cfg (pyvenv.cfg only: layout unreadable), mcp (mcp package only),
// encoder (mcp and the modern encoder package).
function fixtureEngine(kind) {
  const dir = tmp('engine-' + kind);
  fs.writeFileSync(path.join(dir, 'pyproject.toml'), '[project]\nname = "mindrian-eureka"\n\n[project.scripts]\neureka-mcp = "fixture:main"\n');
  if (kind === 'none') return dir;
  fs.mkdirSync(path.join(dir, '.venv'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.venv', 'pyvenv.cfg'), 'home = /synthetic\n');
  if (kind === 'cfg') return dir;
  const site = path.join(dir, '.venv', 'lib', 'python3.12', 'site-packages');
  fs.mkdirSync(path.join(site, 'mcp-2.3.0.dist-info'), { recursive: true });
  if (kind === 'encoder') fs.mkdirSync(path.join(site, 'sentence_transformers-5.0.0.dist-info'), { recursive: true });
  return dir;
}

const ENV_KEYS = ['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_EUREKA_ROOT', 'MINDRIAN_EUREKA_UV', 'MINDRIAN_EUREKA_RS_ENCODER', 'UV_PROJECT_ENVIRONMENT', 'MINDRIAN_ACTIVE_SESSION_ID', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_ACTIVE_ROOM'];

async function withEnv(overrides, fn) {
  const saved = {};
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  const iso = mkIsolatedHome('n');
  try {
    process.env.HOME = iso.home;
    process.env.USERPROFILE = iso.home;
    process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
    for (const k of ENV_KEYS.slice(3)) delete process.env[k];
    for (const [k, v] of Object.entries(overrides || {})) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    return await fn(iso);
  } finally {
    try { require(CONTRACT).setProbeDeps(); } catch (_e) { /* the export may not exist yet */ }
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    iso.cleanup();
  }
}

function sc(result) { return (result && result.structuredContent) || {}; }

// One registered tool with a spy handler. Returns { call(args), runs() }.
function spyTool(contract, name) {
  const holder = {};
  let runs = 0;
  const server = { registerTool(n, c, h) { holder.handler = h; } };
  contract.registerEurekaTool(server, name, { title: 't', description: 'd' }, async () => { runs += 1; return { content: [], structuredContent: { ok: true } }; });
  return { call: (args) => holder.handler(args, {}), runs: () => runs };
}

const SEEN = [];
function note(value) { SEEN.push(JSON.stringify(value)); }

class FakeTransport {
  constructor(options) {
    this.options = options;
    this.stderr = options && options.stderr === 'pipe' ? new PassThrough() : null;
  }
}
// connect behavior: 'fail' writes the lines to stderr then throws; 'ok' connects, then writes lines to
// stderr after the connect settled. callTool returns the reply.
function fakeClientClass(opts) {
  return class FakeClient {
    constructor() {}
    async connect(transport) {
      if (opts.mode === 'fail') {
        if (transport.stderr) for (const l of opts.lines || []) transport.stderr.write(l + '\n');
        await new Promise((resolve) => setImmediate(resolve));
        await new Promise((resolve) => setTimeout(resolve, 5));
        throw new Error('MCP error -32000: Connection closed');
      }
    }
    async callTool() {
      if (opts.mode === 'late') {
        if (opts.transportRef && opts.transportRef.t && opts.transportRef.t.stderr) opts.transportRef.t.stderr.write('late stderr line\n');
        await new Promise((resolve) => setImmediate(resolve));
        throw new Error('post-start failure');
      }
      return opts.reply;
    }
    async close() {}
  };
}

function errorReply(text) { return { isError: true, content: [{ type: 'text', text }] }; }

console.log('Phase 387 plan 11 -- route needs and typed start causes');

async function main() {
  await arm('N1 route gate: a missing package group refuses before the start; graph tools still run', async () => {
    const root = fixtureEngine('mcp');
    await withEnv({ MINDRIAN_EUREKA_ROOT: root }, async () => {
      const contract = require(CONTRACT);
      const graph = spyTool(contract, 'eureka_graph_analyze');
      await graph.call({});
      assert.strictEqual(graph.runs(), 1, 'a graph tool must run on a minimal setup');

      const scout = spyTool(contract, 'eureka_graph_opportunity_scout');
      const b1 = sc(await scout.call({}));
      note(b1);
      assert.strictEqual(scout.runs(), 0, 'the scout handler must not run');
      assert.strictEqual(b1.reason, 'engine_extra_missing');
      assert.strictEqual(b1.cause, 'extra_missing');
      assert.strictEqual(b1.engine_state, 'present');
      assert.strictEqual(b1.route_state, 'needs_extra');
      assert.deepStrictEqual(b1.needs, ['modern-encoder']);
      assert.ok(String(b1.fix).indexOf('/mos:eureka enable engine --sync --extras modern-encoder') !== -1, 'fix ' + b1.fix);

      const run = spyTool(contract, 'eureka_capability_run');
      const b2 = sc(await run.call({ capability_id: 'decision.fit_sequence_patterns', request: {} }));
      note(b2);
      assert.strictEqual(run.runs(), 0);
      assert.strictEqual(b2.reason, 'engine_extra_missing');
      assert.deepStrictEqual(b2.needs, ['hmm']);

      const start = spyTool(contract, 'eureka_capability_start');
      const b3 = sc(await start.call({ capability_id: 'opportunity.synthesize_discovery_signals', request: {} }));
      note(b3);
      assert.strictEqual(start.runs(), 0);
      assert.deepStrictEqual(b3.needs, ['modern-encoder']);

      process.env.MINDRIAN_EUREKA_RS_ENCODER = 'reference-bert';
      const b4 = sc(await start.call({ capability_id: 'opportunity.synthesize_discovery_signals', request: {} }));
      note(b4);
      assert.deepStrictEqual(b4.needs, ['reference-encoder']);
    });
    const withEncoder = fixtureEngine('encoder');
    await withEnv({ MINDRIAN_EUREKA_ROOT: withEncoder }, async () => {
      const contract = require(CONTRACT);
      const scout = spyTool(contract, 'eureka_graph_opportunity_scout');
      await scout.call({});
      assert.strictEqual(scout.runs(), 1, 'with the encoder group installed the scout must run');
    });
  });

  await arm('N2 an engine folder with no prepared environment refuses before the start; an unreadable layout does not', async () => {
    const none = fixtureEngine('none');
    await withEnv({ MINDRIAN_EUREKA_ROOT: none }, async () => {
      const contract = require(CONTRACT);
      for (const [name, args] of [['eureka_graph_analyze', {}], ['eureka_graph_opportunity_scout', {}], ['eureka_capability_run', { capability_id: 'graph.explore_local_relationships', request: {} }], ['eureka_capability_start', { capability_id: 'graph.explore_local_relationships', request: {} }]]) {
        const spy = spyTool(contract, name);
        const body = sc(await spy.call(args));
        note(body);
        assert.strictEqual(spy.runs(), 0, name + ' handler must not run');
        assert.strictEqual(body.reason, 'engine_unavailable', name);
        assert.strictEqual(body.cause, 'env_not_synced', name);
        assert.strictEqual(body.engine_state, 'broken', name);
      }
    });
    await withEnv({ MINDRIAN_EUREKA_ROOT: none, UV_PROJECT_ENVIRONMENT: path.join(none, 'elsewhere') }, async () => {
      const spy = spyTool(require(CONTRACT), 'eureka_graph_analyze');
      await spy.call({});
      assert.strictEqual(spy.runs(), 1, 'UV_PROJECT_ENVIRONMENT set: no env_not_synced refusal');
    });
    const cfg = fixtureEngine('cfg');
    await withEnv({ MINDRIAN_EUREKA_ROOT: cfg }, async () => {
      const contract = require(CONTRACT);
      for (const name of ['eureka_graph_analyze', 'eureka_graph_opportunity_scout']) {
        const spy = spyTool(contract, name);
        await spy.call({});
        assert.strictEqual(spy.runs(), 1, name + ': an unreadable layout must not refuse (unknown never refuses)');
      }
    });
  });

  await arm('N3 a route that needs Node.js 22 or newer is refused only when the needs table says yes', async () => {
    const root = fixtureEngine('mcp');
    await withEnv({ MINDRIAN_EUREKA_ROOT: root }, async () => {
      const contract = require(CONTRACT);
      const yes = () => ({ extras: ['mcp-server'], model: 'no', node: 'yes' });
      contract.setProbeDeps({ needsForCall: yes, nodeStatus: () => ({ ok: false, version: 'v18.0.0', cause: 'node_too_old' }) });
      let spy = spyTool(contract, 'eureka_graph_genesis_plan');
      let body = sc(await spy.call({}));
      note(body);
      assert.strictEqual(spy.runs(), 0);
      assert.strictEqual(body.reason, 'engine_node_missing');
      assert.strictEqual(body.cause, 'node_too_old');
      assert.strictEqual(body.route_state, 'needs_node');
      assert.strictEqual(body.engine_state, 'present');

      contract.setProbeDeps({ needsForCall: yes, nodeStatus: () => ({ ok: false, version: null, cause: 'node_missing' }) });
      body = sc(await spyTool(contract, 'eureka_graph_genesis_plan').call({}));
      note(body);
      assert.strictEqual(body.cause, 'node_missing');
      assert.strictEqual(body.reason, 'engine_node_missing');

      contract.setProbeDeps({ needsForCall: yes, nodeStatus: () => ({ ok: true, version: 'v22.1.0', cause: null }) });
      spy = spyTool(contract, 'eureka_graph_genesis_plan');
      await spy.call({});
      assert.strictEqual(spy.runs(), 1, 'node ok must pass');

      for (const node of ['unknown', 'no']) {
        contract.setProbeDeps({
          needsForCall: () => ({ extras: ['mcp-server'], model: 'unknown', node }),
          nodeStatus: () => { throw new Error('nodeStatus must not be called for node ' + node); },
        });
        spy = spyTool(contract, 'eureka_graph_genesis_plan');
        await spy.call({});
        assert.strictEqual(spy.runs(), 1, 'node ' + node + ' must never be gated');
      }
    });
  });

  await arm('N4 the engine own words become typed fixed answers, never raw text', async () => {
    const root = fixtureEngine('mcp');
    await withEnv({ MINDRIAN_EUREKA_ROOT: root }, async () => {
      const run = require(path.join(TOOLS_DIR, 'eureka-capability-run.cjs'));
      const analyze = require(path.join(TOOLS_DIR, 'eureka-graph-analyze.cjs'));
      const capability = { id: 'opportunity.find_cross_domain_pairs', status: 'experimental', routes: { mcp: { tool: 'scout_run_workflow' } } };
      const cases = [
        ['No local model found. Searched: SECRET-PATH', { reason: 'engine_model_missing', cause: 'model_missing', route_state: 'needs_model' }],
        ["Install the optional extra: pip install 'mindrian-eureka[modern-encoder]'", { reason: 'engine_extra_missing', cause: 'extra_missing', route_state: 'needs_extra', needs: ['modern-encoder'] }],
        ['RS expert extraction requires Node.js 22 or newer', { reason: 'engine_node_missing', cause: 'node_too_old', route_state: 'needs_node' }],
      ];
      for (const [text, want] of cases) {
        const reply = errorReply(text);
        const client = { callTool: async () => reply };
        const viaRun = await run.invokeCapabilityWithClient(client, capability, {}, process.env);
        const viaAnalyze = await analyze.callEurekaWorkflow('graph.explore_local_relationships', {}, Object.assign({}, process.env), undefined, {
          StdioClientTransport: FakeTransport, Client: fakeClientClass({ mode: 'ok', reply }),
        });
        for (const [label, r] of [['run', viaRun], ['workflow', viaAnalyze]]) {
          note(r);
          assert.strictEqual(r.ok, false, label);
          assert.strictEqual(r.reason, want.reason, label + ' reason ' + r.reason);
          assert.strictEqual(r.cause, want.cause, label + ' cause ' + r.cause);
          assert.strictEqual(r.route_state, want.route_state, label);
          assert.strictEqual(r.engine_state, 'present', label);
          if (want.needs) assert.deepStrictEqual(r.needs, want.needs, label);
          assert.ok(String(r.message).endsWith(TAIL), label + ' message is not the fixed sentence: ' + r.message);
          assert.ok(JSON.stringify(r).indexOf('SECRET-PATH') === -1, label + ' leaks the engine text');
          assert.ok(JSON.stringify(r).indexOf(text) === -1, label + ' holds the raw engine text');
        }
      }
      // An unrelated error reply keeps today's behavior.
      const other = await run.invokeCapabilityWithClient({ callTool: async () => errorReply('some other failure') }, capability, {}, process.env);
      assert.strictEqual(other.reason, 'engine_rejected_request');
      const other2 = await analyze.callEurekaWorkflow('graph.explore_local_relationships', {}, Object.assign({}, process.env), undefined, {
        StdioClientTransport: FakeTransport, Client: fakeClientClass({ mode: 'ok', reply: errorReply('some other failure') }),
      });
      assert.strictEqual(other2.reason, 'engine_rejected_request');
    });
  });

  await arm('N5 a start failure is typed from the first stderr line, cleaned, and only from the start phase', async () => {
    const root = fixtureEngine('mcp');
    await withEnv({ MINDRIAN_EUREKA_ROOT: root }, async () => {
      const analyze = require(path.join(TOOLS_DIR, 'eureka-graph-analyze.cjs'));
      const run = require(path.join(TOOLS_DIR, 'eureka-capability-run.cjs'));
      const call = (lines, target) => {
        const deps = { StdioClientTransport: FakeTransport, Client: fakeClientClass({ mode: 'fail', lines }) };
        if (target === 'capability') return run.callEurekaCapability('graph.explore_local_relationships', {}, Object.assign({}, process.env), undefined, deps);
        return analyze.callEurekaWorkflow('graph.explore_local_relationships', {}, Object.assign({}, process.env), undefined, deps);
      };
      for (const target of ['workflow', 'capability']) {
        const r = await call([UV_LINE, 'second line'], target);
        note(r);
        assert.strictEqual(r.ok, false, target);
        assert.strictEqual(r.reason, 'engine_unavailable', target);
        assert.strictEqual(r.cause, 'python_missing', target);
        assert.strictEqual(r.engine_state, 'broken', target);
        assert.strictEqual(r.message, 'No Python that meets the engine requirement was found.' + TAIL, target);
        assert.strictEqual(r.engine_start_line, UV_LINE, target);
      }
      const withRoot = await call(['error: cannot read ' + root + '/pyproject.toml'], 'workflow');
      note(withRoot);
      assert.ok(String(withRoot.engine_start_line).indexOf('<MINDRIAN_EUREKA_ROOT>') !== -1, 'root not replaced: ' + withRoot.engine_start_line);
      assert.ok(JSON.stringify(withRoot).indexOf(root) === -1, 'root leaks');

      const odd = await call(['something odd'], 'workflow');
      note(odd);
      assert.strictEqual(odd.cause, 'engine_start_failed');
      assert.strictEqual(odd.engine_start_line, 'something odd');
      assert.strictEqual(odd.fix, '/mos:eureka enable engine --check --deep');

      // A stderr line emitted after the connect settled is never captured.
      const ref = {};
      class RefTransport extends FakeTransport { constructor(o) { super(o); ref.t = this; } }
      const late = await analyze.callEurekaWorkflow('graph.explore_local_relationships', {}, Object.assign({}, process.env), undefined, {
        StdioClientTransport: RefTransport, Client: fakeClientClass({ mode: 'late', transportRef: ref }),
      });
      note(late);
      assert.strictEqual(late.ok, false);
      assert.ok(!('engine_start_line' in late), 'a line after the connect must not be captured');
      assert.ok(JSON.stringify(late).indexOf('late stderr line') === -1);
    });
    // The real transport: a nonexistent absolute command gives uv_missing and no start line.
    const noUv = path.join(os.tmpdir(), '387-11-no-such-uv-' + process.pid);
    await withEnv({ MINDRIAN_EUREKA_ROOT: root, MINDRIAN_EUREKA_UV: noUv }, async () => {
      const run = require(path.join(TOOLS_DIR, 'eureka-capability-run.cjs'));
      const r = await run.callEurekaCapability('graph.explore_local_relationships', {}, Object.assign({}, process.env));
      note(r);
      assert.strictEqual(r.reason, 'engine_unavailable');
      assert.strictEqual(r.cause, 'uv_missing');
      assert.ok(JSON.stringify(r).indexOf(noUv) === -1, 'the uv path leaks');
    });
  });

  await arm('N6 a start line with a token-like run or a Traceback is dropped but the cause stays typed', async () => {
    const root = fixtureEngine('mcp');
    await withEnv({ MINDRIAN_EUREKA_ROOT: root }, async () => {
      const analyze = require(path.join(TOOLS_DIR, 'eureka-graph-analyze.cjs'));
      for (const line of [UV_LINE + ' token ABCDEFGHIJKLMNOPQRSTUVWXYZ0123', 'Traceback (most recent call last): No interpreter found for Python']) {
        const r = await analyze.callEurekaWorkflow('graph.explore_local_relationships', {}, Object.assign({}, process.env), undefined, {
          StdioClientTransport: FakeTransport, Client: fakeClientClass({ mode: 'fail', lines: [line] }),
        });
        note(r);
        assert.strictEqual(r.cause, 'python_missing', line);
        assert.ok(!('engine_start_line' in r), 'engine_start_line must be absent for: ' + line);
        assert.ok(JSON.stringify(r).indexOf('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123') === -1);
        assert.ok(JSON.stringify(r).indexOf('Traceback') === -1);
      }
    });
  });

  await arm('N7 the 3 new reasons are known to the five graph services (fixed sentences)', async () => {
    const resolver = require(RESOLVER);
    const signals = require(path.join(TOOLS_DIR, 'eureka-graph-discovery-signals.cjs'));
    const host = () => ({
      ok: true, scope_id: 'room-test', snapshot_id: 'snapshot-test',
      room_binding: { room_id: 'room-test', source: 'session.primary', registry_fallback: false },
      snapshot: { nodes: [{ id: 'n1' }], edges: [], meta: { complete: true, omissions: {} } },
    });
    const want = {
      engine_extra_missing: resolver.describeEngineState({ state: 'broken', cause: 'extra_missing' }).sentence,
      engine_model_missing: resolver.describeEngineState({ state: 'broken', cause: 'model_missing' }).sentence,
      engine_node_missing: resolver.describeEngineState({ state: 'broken', cause: 'node_missing' }).sentence,
    };
    for (const spec of signals.TOOLS) {
      for (const [reason, sentence] of Object.entries(want)) {
        const out = await signals.runDiscoverySignal(spec, { node_ids: ['n1'] }, {}, {}, {
          project: () => host(),
          callEurekaWorkflow: async () => ({ ok: false, reason, message: 'RAW-ENGINE-TEXT /home/secret' }),
        });
        note(out);
        assert.strictEqual(out.reason, reason, spec.capability_id + ' ' + reason);
        assert.strictEqual(out.message, sentence, spec.capability_id + ' message');
      }
    }
  });

  await arm('N8 no refusal holds a fixture folder, the temp folder or SECRET-PATH', async () => {
    assert.ok(SEEN.length >= 10, 'too few refusals collected: ' + SEEN.length);
    for (const text of SEEN) {
      assert.ok(text.indexOf('SECRET-PATH') === -1, 'SECRET-PATH leaks');
      assert.ok(text.indexOf(os.tmpdir()) === -1, 'the temp folder leaks');
      assert.ok(text.indexOf('387-11-') === -1, 'a fixture folder leaks');
    }
  });

  await arm('N9 setProbeDeps restores the real functions; the gate never throws when a probe throws', async () => {
    const root = fixtureEngine('mcp');
    await withEnv({ MINDRIAN_EUREKA_ROOT: root }, async () => {
      const contract = require(CONTRACT);
      assert.strictEqual(typeof contract.routeGate, 'function');
      contract.setProbeDeps({
        needsForCall: () => { throw new Error('probe boom'); },
        extrasInstalled: () => { throw new Error('probe boom'); },
        nodeStatus: () => { throw new Error('probe boom'); },
      });
      let gate;
      assert.doesNotThrow(() => { gate = contract.routeGate('eureka_graph_opportunity_scout', {}, process.env); });
      assert.strictEqual(gate, null, 'an internal error must give no refusal');
      contract.setProbeDeps();
      const real = contract.routeGate('eureka_graph_opportunity_scout', {}, process.env);
      assert.ok(real && real.reason === 'engine_extra_missing', 'the real probes must be back');
    });
  });

  console.log('\ntest-387-eureka-route-needs: ' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.log(String(e && e.stack || e)); process.exit(1); });
