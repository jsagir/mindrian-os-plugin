#!/usr/bin/env node
'use strict';
/*
 * Phase 387 plan 06: a fake uv that stands in for the Eureka engine in tests. It is a Node script.
 *
 * It behaves by its arguments (argv[2] onward):
 *   sync ...                       creates .venv/pyvenv.cfg and marker folders for the --extra names, records, exits 0
 *   ... eureka doctor --json       prints a doctor-shaped JSON with one failing check, records, exits 1
 *   --version                      prints a version line (no record, no file)
 *   python find ...                prints a path (no record, no file)
 *   run ...                        serves a minimal Eureka MCP over stdio (7 tools) and records every call
 *
 * It records one JSON line per start and per tool call to ./observed.jsonl in its working folder: the
 * arguments, the working folder, the sorted environment keys, the values of UV_OFFLINE, HF_HUB_OFFLINE and
 * TRANSFORMERS_OFFLINE and, for a tool call, the request with every string value replaced by its length
 * (except values under a key named node_ids). An optional ./watch.json (array of strings) makes the fake
 * count, per needle index, how often the raw request holds that needle; the needle itself is never recorded.
 * An optional ./expected-lineage.json ({scope_id, snapshot_id}) sets the lineage ids of the answers.
 *
 * It makes no network call, requires no network module, and writes only inside its working folder.
 * It is synthetic: the real engine is never started by the tests that use it. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const argv = process.argv.slice(2);
const cwd = process.cwd();
const OFFLINE = ['UV_OFFLINE', 'HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE'];

function record(entry) {
  const row = Object.assign({
    argv,
    cwd,
    env_keys: Object.keys(process.env).sort(),
    UV_OFFLINE: process.env.UV_OFFLINE === undefined ? null : process.env.UV_OFFLINE,
    HF_HUB_OFFLINE: process.env.HF_HUB_OFFLINE === undefined ? null : process.env.HF_HUB_OFFLINE,
    TRANSFORMERS_OFFLINE: process.env.TRANSFORMERS_OFFLINE === undefined ? null : process.env.TRANSFORMERS_OFFLINE,
  }, entry);
  // env values are recorded only for the variables a test may need to read back
  row.env_values = {};
  for (const key of OFFLINE.concat(['UV_CACHE_DIR', 'UV_PYTHON_INSTALL_DIR', 'UV_PROJECT_ENVIRONMENT', 'MINDRIAN_EUREKA_DATA_DIR', 'MINDRIAN_EUREKA_CACHE_DIR'])) {
    if (process.env[key] !== undefined) row.env_values[key] = process.env[key];
  }
  row.env_all = Object.assign({}, process.env);
  fs.appendFileSync(path.join(cwd, 'observed.jsonl'), JSON.stringify(row) + '\n');
}

function extraNames() {
  const names = [];
  for (let i = 0; i < argv.length - 1; i += 1) if (argv[i] === '--extra') names.push(argv[i + 1]);
  return names;
}

const MARKERS = {
  'mcp-server': ['mcp-2.3.0.dist-info'],
  'modern-encoder': ['sentence_transformers-5.0.0.dist-info'],
  'reference-encoder': ['torch-2.0.0.dist-info', 'transformers-4.0.0.dist-info'],
  hmm: ['pomegranate-1.0.0.dist-info'],
};

function doSync() {
  const venv = path.join(cwd, '.venv');
  const site = path.join(venv, 'lib', 'python3.12', 'site-packages');
  fs.mkdirSync(site, { recursive: true });
  fs.writeFileSync(path.join(venv, 'pyvenv.cfg'), 'home = /synthetic\n');
  for (const extra of extraNames()) {
    for (const marker of MARKERS[extra] || []) fs.mkdirSync(path.join(site, marker), { recursive: true });
  }
  record({ kind: 'sync' });
  process.exit(0);
}

function doDoctor() {
  record({ kind: 'doctor' });
  const body = {
    ok: false,
    checks: [
      { id: 'C1', name: 'Python version', status: 'PASS', message: 'ok', fix: '' },
      { id: 'C2', name: 'Python libraries', status: 'FAIL', message: 'Missing Python libraries: sentence_transformers', fix: 'Install the modern-encoder group.' },
    ],
  };
  process.stdout.write(JSON.stringify(body) + '\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// the engine
// ---------------------------------------------------------------------------

function repoNodeModulesRoot() {
  // in the repo: tests/fixtures/eureka-fake-engine-387 -> repo root is three folders up
  const inRepo = path.resolve(__dirname, '..', '..', '..');
  if (fs.existsSync(path.join(inRepo, 'node_modules', '@modelcontextprotocol', 'server'))) return inRepo;
  // a copy in a temp folder: the test writes repo-root.txt next to the fake
  try { return fs.readFileSync(path.join(cwd, 'repo-root.txt'), 'utf8').trim(); } catch (_e) { return null; }
}

function redact(value, key) {
  if (typeof value === 'string') return key === 'node_ids' ? value : value.length;
  if (Array.isArray(value)) return value.map((item) => redact(item, key));
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = redact(value[k], k);
    return out;
  }
  return value;
}

function readJson(name) {
  try { return JSON.parse(fs.readFileSync(path.join(cwd, name), 'utf8')); } catch (_e) { return null; }
}

function watchHits(raw) {
  const needles = readJson('watch.json');
  if (!Array.isArray(needles)) return null;
  return needles.map((needle) => (typeof needle === 'string' && needle ? raw.split(needle).length - 1 : 0));
}

function serve() {
  const base = repoNodeModulesRoot();
  if (!base) { process.stderr.write('fake-uv: no node_modules root\n'); process.exit(2); }
  const { createRequire } = require('node:module');
  const req = createRequire(path.join(base, 'package.json'));
  const { McpServer } = req('@modelcontextprotocol/server');
  const { serveStdio } = req('@modelcontextprotocol/server/stdio');
  const { z } = req('zod');

  record({ kind: 'start' });

  const CATALOG = [
    { id: 'graph.explore_local_relationships', status: 'experimental', routes: { mcp: { tool: 'scout_run_workflow' } } },
    { id: 'research.analyze_rs_domain_projection', status: 'experimental', routes: { mcp: { tool: 'scout_run_workflow' } } },
    { id: 'opportunity.synthesize_discovery_signals', status: 'experimental', routes: { mcp: { tool: 'scout_start_opportunity_signal_scout' } } },
  ];
  const JOB_ID = 'fake-job-387';
  let lastScope = { scope_id: 'fake-scope', snapshot_id: 'fake-snapshot' };

  function lineage(request) {
    const file = readJson('expected-lineage.json');
    const snapshotMeta = request && request.snapshot && request.snapshot.meta;
    const scope = (request && request.scope_id) || (snapshotMeta && snapshotMeta.scope_id) || (file && file.scope_id) || 'fake-scope';
    const snap = (request && request.snapshot_id) || (snapshotMeta && snapshotMeta.snapshot_id) || (file && file.snapshot_id) || 'fake-snapshot';
    lastScope = { scope_id: scope, snapshot_id: snap };
    return lastScope;
  }

  function shapeOf(request) {
    if (!request || typeof request !== 'object') return null;
    const snapshot = request.snapshot;
    return {
      keys: Object.keys(request).sort(),
      snapshot_nodes: snapshot && Array.isArray(snapshot.nodes) ? snapshot.nodes.length : null,
      snapshot_edges: snapshot && Array.isArray(snapshot.edges) ? snapshot.edges.length : null,
    };
  }

  function answer(payload) {
    return { content: [{ type: 'text', text: JSON.stringify(payload) }], structuredContent: payload };
  }

  function observe(tool, args) {
    let raw = '';
    try { raw = JSON.stringify(args === undefined ? null : args); } catch (_e) { raw = ''; }
    record({ kind: 'call', tool, request: redact(args === undefined ? null : args), shape: shapeOf(args && args.request), watch_hits: watchHits(raw) });
  }

  const permissive = z.object({}).passthrough();
  const server = new McpServer({ name: 'fake-eureka-387', version: '0.0.0' });

  server.registerTool('scout_capabilities', { description: 'fake catalog', inputSchema: permissive }, async (args) => {
    observe('scout_capabilities', args);
    return answer({ capabilities: CATALOG });
  });
  server.registerTool('scout_capability_contract', { description: 'fake contract', inputSchema: permissive }, async (args) => {
    observe('scout_capability_contract', args);
    return answer({ capability: { id: args && args.capability_id }, schemas: { input: { type: 'object' }, output: { type: 'object' } } });
  });
  server.registerTool('scout_run_workflow', { description: 'fake workflow', inputSchema: permissive }, async (args) => {
    observe('scout_run_workflow', args);
    const ids = lineage(args && args.request);
    return answer(Object.assign({ capability_id: args && args.capability_id, status: 'completed_analysis' }, ids));
  });
  server.registerTool('scout_start_opportunity_signal_scout', { description: 'fake async start', inputSchema: permissive }, async (args) => {
    observe('scout_start_opportunity_signal_scout', args);
    lineage(args && args.request);
    return answer({ job_id: JOB_ID, status: 'queued' });
  });
  server.registerTool('scout_status', { description: 'fake status', inputSchema: permissive }, async (args) => {
    observe('scout_status', args);
    return answer({ job_id: JOB_ID, status: 'completed' });
  });
  server.registerTool('scout_result', { description: 'fake result', inputSchema: permissive }, async (args) => {
    observe('scout_result', args);
    return answer({ capability_id: 'opportunity.synthesize_discovery_signals', status: 'completed', scope: lastScope });
  });
  server.registerTool('scout_cancel', { description: 'fake cancel', inputSchema: permissive }, async (args) => {
    observe('scout_cancel', args);
    return answer({ ok: true });
  });

  serveStdio(() => server);
}

// ---------------------------------------------------------------------------
// router
// ---------------------------------------------------------------------------

if (argv[0] === 'sync') doSync();
else if (argv[0] === '--version') { process.stdout.write('uv 0.0.0-fake\n'); process.exit(0); }
else if (argv[0] === 'python' && argv[1] === 'find') { process.stdout.write('/synthetic/python3\n'); process.exit(0); }
else if (argv.length >= 3 && argv.slice(-3).join(' ') === 'eureka doctor --json') doDoctor();
else if (argv[0] === 'run') serve();
else { process.stderr.write('fake-uv: unknown arguments\n'); process.exit(2); }
