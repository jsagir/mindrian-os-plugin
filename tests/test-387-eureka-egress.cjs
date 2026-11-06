#!/usr/bin/env node
'use strict';
/*
 * Phase 387 plan 06: Part 8 for Eureka, proven on the plugin side with a fake engine.
 *
 * The engine child is the fake uv of tests/fixtures/eureka-fake-engine-387 (a Node script, copied to a temp
 * folder). The real engine is never started, no uv sync runs, no network is used, no real room is read.
 *
 * Arms (each prints ok - or FAIL - with its label):
 *   P1   static: no Brain/Theo/network require or fetch in the Eureka modules; child_process only in the two
 *        engine core modules; only the projection module opens the room database; every transport cwd is the
 *        engine root; no tool module builds a uv argument array by hand (each calls uvRunArgs)
 *   A1   child environment keys are a subset of the allowlist plus the 3 offline variables; the allowlist holds
 *        neither UV_CACHE_DIR nor UV_PYTHON_INSTALL_DIR
 *   U1   the runtime allowlist holds UV_PROJECT_ENVIRONMENT (the engine finds the environment the sync wrote)
 *   A2   the child environment holds no CLAUDE_, MINDRIAN_ROOM, MINDRIAN_BRAIN, MINDRIAN_EUREKA_ROOT,
 *        MINDRIAN_EUREKA_ALLOW or MINDRIAN_EUREKA_UV key
 *   A3   UV_OFFLINE, HF_HUB_OFFLINE, TRANSFORMERS_OFFLINE are 1 in the child, per path: analyze,
 *        capability_run, capability_start, scout
 *   A4   with MINDRIAN_EUREKA_ALLOW_NETWORK=1 the offline variables are not forced and the opt-in is not copied
 *   A5   analyze with a real bound fixture room: the engine receives the snapshot only; no room folder, no room.db
 *   A6   the child working folder is the engine folder
 *   A7   the host makes 0 non-loopback connection attempts (the counter is proven by a loopback control)
 *   A8   the Brain capture server saw 0 requests (brain-client in require.cache is information only)
 *   A9   per path the uv argument array holds --no-sync --offline --locked --no-python-downloads and equals uvRunArgs
 *   A10  with the opt-in the array equals uvRunArgs(..., { allowNetwork: true }) (only --locked remains)
 *   P3   runEngineSync (the only sync) spawns once with sync --locked --no-python-downloads --extra mcp-server and a clean env;
 *        without the approval flag the command spawns no sync
 *   P4   runEngineDoctor spawns once with the uvRunArgs array for eureka doctor --json and the 3 offline variables
 *
 * Exit: 0 all pass; 1 any FAIL; 77 ENV GAP on win32. Hyphens only.
 */

if (process.platform === 'win32') {
  process.stdout.write('SKIPPED (ENV GAP): the fake uv is an executable Node script; win32 is not covered\n');
  process.exit(77);
}

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const dns = require('node:dns');

const REPO = path.resolve(__dirname, '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'eureka-fake-engine-387');

// ---------------------------------------------------------------------------
// the network counter: installed BEFORE any tool module is required
// ---------------------------------------------------------------------------

const attempts = [];
function isLoopbackHost(host) {
  const h = String(host === undefined || host === null ? 'localhost' : host).toLowerCase().replace(/^\[|\]$/g, '');
  return h === 'localhost' || h === '::1' || h === '0.0.0.0' || /^127\./.test(h) || /^::ffff:127\./.test(h);
}
function describeConnect(args) {
  let a0 = args[0];
  if (Array.isArray(a0)) a0 = a0[0];
  if (a0 && typeof a0 === 'object') {
    if (a0.path) return { kind: 'unix', host: null, local: true };
    const host = a0.host === undefined ? 'localhost' : a0.host;
    return { kind: 'inet', host: String(host), local: isLoopbackHost(host) };
  }
  if (typeof a0 === 'string' && Number.isNaN(Number(a0))) return { kind: 'unix', host: null, local: true };
  const host = typeof args[1] === 'string' ? args[1] : 'localhost';
  return { kind: 'inet', host, local: isLoopbackHost(host) };
}
const origConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function wrappedConnect(...args) {
  try { attempts.push(describeConnect(args)); } catch (_e) { attempts.push({ kind: 'unknown', host: null, local: false }); }
  return origConnect.apply(this, args);
};
const origLookup = dns.lookup;
dns.lookup = function wrappedLookup(hostname, ...rest) {
  attempts.push({ kind: 'dns', host: String(hostname), local: isLoopbackHost(hostname) });
  return origLookup.call(this, hostname, ...rest);
};
if (dns.promises && typeof dns.promises.lookup === 'function') {
  const origPromiseLookup = dns.promises.lookup;
  dns.promises.lookup = function wrappedPromiseLookup(hostname, ...rest) {
    attempts.push({ kind: 'dns', host: String(hostname), local: isLoopbackHost(hostname) });
    return origPromiseLookup.call(this, hostname, ...rest);
  };
}

let passed = 0;
let failed = 0;
function ok(label, extra) { passed += 1; process.stdout.write('ok - ' + label + (extra ? ' (' + extra + ')' : '') + '\n'); }
function bad(label, detail) { failed += 1; process.stdout.write('FAIL - ' + label + '\n'); if (detail) process.stdout.write('    ' + String(detail).split('\n').join('\n    ') + '\n'); }
function arm(label, problems, extra) { if (problems.length) bad(label, problems.slice(0, 8).join('\n')); else ok(label, extra); }

// ---------------------------------------------------------------------------
// P1: static
// ---------------------------------------------------------------------------

function codeOf(file) {
  let src = fs.readFileSync(file, 'utf8');
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return src.split('\n').filter((l) => !/^\s*(\/\/|\*|#)/.test(l)).join('\n');
}

function staticProblems() {
  const problems = [];
  const toolsDir = path.join(REPO, 'lib', 'mcp', 'tools');
  const toolFiles = fs.readdirSync(toolsDir).filter((f) => /^eureka-.*\.cjs$/.test(f)).sort().map((f) => path.join(toolsDir, f));
  const engineCore = ['eureka-engine-resolver.cjs', 'eureka-engine-requirements.cjs', 'eureka-engine-enable.cjs'].map((f) => path.join(REPO, 'lib', 'core', 'eureka', f));
  const contract = path.join(REPO, 'lib', 'mcp', 'eureka-tool-contract.cjs');
  const all = toolFiles.concat([contract], engineCore);
  const rel = (f) => path.relative(REPO, f);
  for (const f of all) {
    const code = codeOf(f);
    if (/require\(\s*['"][^'"]*(brain-client|mindrian-brain|theo-)[^'"]*['"]\s*\)/.test(code)) problems.push(rel(f) + ': requires a Brain or Theo module');
    if (/require\(\s*['"](node:)?(http|https|net|dns)['"]\s*\)/.test(code)) problems.push(rel(f) + ': requires a network module');
    if (/\bfetch\s*\(/.test(code)) problems.push(rel(f) + ': calls fetch(');
    const spawns = /require\(\s*['"](node:)?child_process['"]\s*\)/.test(code);
    const isEngineCore = f.indexOf(path.join('lib', 'core', 'eureka') + path.sep) !== -1 && /eureka-engine-(requirements|enable)\.cjs$/.test(f);
    if (spawns && !isEngineCore) problems.push(rel(f) + ': child_process outside the two engine core modules');
  }
  if (toolFiles.length < 15) problems.push('expected at least 15 eureka tool modules, found ' + toolFiles.length);
  const roomDb = toolFiles.filter((f) => /openRoomDb/.test(codeOf(f))).map((f) => path.basename(f));
  if (JSON.stringify(roomDb) !== JSON.stringify(['eureka-graph-projection.cjs'])) problems.push('room database opened by: ' + JSON.stringify(roomDb));
  for (const f of toolFiles) {
    const code = codeOf(f);
    for (const line of code.split('\n')) {
      if (/\bcwd\s*:/.test(line) && !/\bcwd:\s*root\b/.test(line)) problems.push(rel(f) + ': transport cwd is not the engine root: ' + line.trim());
    }
    if (/\[\s*'run'\s*,/.test(code) || /'eureka-mcp'/.test(code)) problems.push(rel(f) + ': builds a uv argument array by hand');
    if (/\bcommand\s*:/.test(code) && !/\buvRunArgs\b/.test(code)) problems.push(rel(f) + ': builds transport options without uvRunArgs');
  }
  return problems;
}

// ---------------------------------------------------------------------------
// helpers over the fake engine record
// ---------------------------------------------------------------------------

function copyFixture(dir) {
  fs.cpSync(FIXTURE, dir, { recursive: true });
  fs.chmodSync(path.join(dir, 'fake-uv.cjs'), 0o755);
  fs.writeFileSync(path.join(dir, 'repo-root.txt'), REPO + '\n');
}

function rowsOf(engine) {
  try {
    return fs.readFileSync(path.join(engine, 'observed.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch (_e) { return []; }
}

function sameList(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-387-egress-'));
  const engine = path.join(tmp, 'engine');
  fs.mkdirSync(engine);
  copyFixture(engine);
  const fake = path.join(engine, 'fake-uv.cjs');

  const isolatedHelper = require('./helpers/isolated-home-36925.cjs');
  const iso = isolatedHelper.mkIsolatedHome('387-egress');
  const capture = require('./helpers/brain-capture-server.cjs');
  const cap = await capture.startCaptureServer();
  capture.resetCaptured();

  const saved = {};
  const SET = {
    MINDRIAN_EUREKA_ROOT: engine,
    MINDRIAN_EUREKA_UV: fake,
    MINDRIAN_BRAIN_URL: cap.url,
    MINDRIAN_BRAIN_KEY: 'synthetic-key-387',
    CLAUDE_387_PROBE: 'must-not-reach-the-engine',
    HF_HUB_OFFLINE: '0',
    TRANSFORMERS_OFFLINE: '0',
    UV_OFFLINE: '0',
  };
  const cleanup = async () => {
    try { await capture.stopCaptureServer(); } catch (_e) { /* best effort */ }
    try { iso.cleanup(); } catch (_e) { /* best effort */ }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  };

  try {
    // ---- the room: a real bound fixture room (reuse of the bound-session setup of test-eureka-graph-projection.cjs)
    const born = isolatedHelper.birthFixtureRoom({ iso, slug: 'eureka-egress-387', sessionId: 'fixture-birth' });
    const nav = require('../lib/core/navigation.cjs');
    const boundSession = 'eureka-egress-387-bound-session';
    const writeDb = nav.openRoomDbForCaller(born.roomDir);
    let nodeId;
    try {
      const claim = nav.writeClaimNode(writeDb, {
        knowledge_type: 'fact', text: 'A synthetic claim for the egress fixture room.', sessionId: boundSession, sourceSegment: 'eureka-egress-387',
      });
      if (!claim.ok) throw new Error('fixture claim not written: ' + JSON.stringify(claim));
      nodeId = claim.node_id;
    } finally { nav.closeRoomDbForCaller(writeDb); }
    require('../lib/core/session-binding.cjs').writeSessionBinding(boundSession, { bound: [born.slug], primary: born.slug, sticky: true }, { home: iso.roomsHome });
    process.env.MINDRIAN_ROOMS_HOME = iso.roomsHome;
    delete process.env.CLAUDE_ACTIVE_ROOM;
    for (const k of Object.keys(SET)) { saved[k] = process.env[k]; process.env[k] = SET[k]; }

    // The counter is installed above, before this require. Brain client state is read for information only.
    const run = require('../lib/mcp/tools/eureka-capability-run.cjs');
    const jobs = require('../lib/mcp/tools/eureka-capability-jobs.cjs');
    const graph = require('../lib/mcp/tools/eureka-graph-analyze.cjs');
    const { project } = require('../lib/mcp/tools/eureka-graph-projection.cjs');
    const requirements = require('../lib/core/eureka/eureka-engine-requirements.cjs');
    const enable = require('../lib/core/eureka/eureka-engine-enable.cjs');
    const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');

    // positive control of the counter: a loopback connect to the capture server must be counted
    const control = attempts.length;
    await new Promise((resolve) => {
      const s = net.connect({ host: '127.0.0.1', port: cap.port }, () => { s.destroy(); resolve(); });
      s.on('error', () => resolve());
    });
    const controlCounted = attempts.length > control;
    const sandbox = attempts.length; // attempts before this index are the control; engine calls are counted after it

    const proj = project({ node_ids: [nodeId] }, {}, { sessionId: boundSession });
    if (!proj.ok) throw new Error('fixture projection failed: ' + JSON.stringify(proj));
    fs.writeFileSync(path.join(engine, 'expected-lineage.json'), JSON.stringify({ scope_id: proj.scope_id, snapshot_id: proj.snapshot_id }));
    fs.writeFileSync(path.join(engine, 'watch.json'), JSON.stringify([born.roomDir, 'room.db', iso.roomsHome]));

    const realEngine = path.resolve(engine);
    const ids = { run: 'research.analyze_rs_domain_projection', start: 'opportunity.synthesize_discovery_signals' };
    const requestBody = { scope_id: proj.scope_id, snapshot_id: proj.snapshot_id, topic: 'synthetic topic' };
    const PATHS = ['analyze', 'capability_run', 'capability_start', 'scout'];

    const failures = [];
    async function runPath(name, mode) {
      const before = rowsOf(engine).length;
      const env = Object.assign({}, process.env);
      if (mode === 'allow') env.MINDRIAN_EUREKA_ALLOW_NETWORK = '1';
      let result;
      let capturedOptions = null;
      try {
        if (name === 'analyze') {
          if (mode === 'allow') {
            result = await graph.callEurekaWorkflow('graph.explore_local_relationships', { snapshot: proj.snapshot }, env);
          } else {
            const prev = process.env.MINDRIAN_EUREKA_ALLOW_NETWORK;
            delete process.env.MINDRIAN_EUREKA_ALLOW_NETWORK;
            try { result = await graph.analyze({ node_ids: [nodeId] }, {}, { sessionId: boundSession }); } finally { if (prev !== undefined) process.env.MINDRIAN_EUREKA_ALLOW_NETWORK = prev; }
          }
        } else if (name === 'capability_run') {
          result = await run.callEurekaCapability(ids.run, requestBody, env);
        } else if (name === 'capability_start') {
          result = await jobs.startCapability({ capability_id: ids.start, request: requestBody }, {}, { env });
          if (result && result.ok && result.job_id) await jobs.closeSession(result.job_id);
        } else {
          class CapturingTransport extends StdioClientTransport {
            constructor(options) { super(options); capturedOptions = options; }
          }
          result = await graph.callEurekaOpportunityScout({ scope_id: proj.scope_id, snapshot_id: proj.snapshot_id, snapshot: proj.snapshot }, env, undefined, { StdioClientTransport: CapturingTransport });
        }
      } catch (error) {
        result = { ok: false, thrown: String(error && error.message || error) };
      }
      const rows = rowsOf(engine).slice(before);
      return { name, mode, result, rows, start: rows.find((r) => r.kind === 'start') || null, capturedOptions };
    }

    const defaults = [];
    for (const name of PATHS) defaults.push(await runPath(name, 'default'));
    const allows = [];
    for (const name of PATHS) allows.push(await runPath(name, 'allow'));
    for (const r of defaults.concat(allows)) {
      if (!r.result || r.result.ok !== true || !r.start) failures.push(r.name + ' (' + r.mode + '): ' + JSON.stringify(r.result).slice(0, 200));
    }
    if (failures.length) bad('A0 every path reached the fake engine and answered ok', failures.join('\n')); else ok('A0 every path reached the fake engine and answered ok (8 starts)');

    const starts = defaults.concat(allows).map((r) => r.start).filter(Boolean);
    const defaultStarts = defaults.map((r) => r.start).filter(Boolean);

    // ---- P1
    arm('P1 static: no Brain/network require, child_process only in the engine core, room db only in the projection, no hand-built uv array', staticProblems());

    // ---- A1 and U1
    const SDK_DEFAULT_KEYS = ['HOME', 'LOGNAME', 'PATH', 'SHELL', 'TERM', 'USER'];
    const allowed = new Set(run.EUREKA_CHILD_ENV_KEYS.concat(['UV_OFFLINE', 'HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE'], SDK_DEFAULT_KEYS));
    const a1 = [];
    for (const s of starts) for (const k of s.env_keys) if (!allowed.has(k)) a1.push('unexpected child environment key: ' + k);
    if (run.EUREKA_CHILD_ENV_KEYS.includes('UV_CACHE_DIR')) a1.push('the runtime allowlist holds UV_CACHE_DIR');
    if (run.EUREKA_CHILD_ENV_KEYS.includes('UV_PYTHON_INSTALL_DIR')) a1.push('the runtime allowlist holds UV_PYTHON_INSTALL_DIR');
    arm('A1 child environment keys are a subset of the allowlist plus the 3 offline variables; no UV_CACHE_DIR or UV_PYTHON_INSTALL_DIR', a1);
    arm('U1 the runtime allowlist holds UV_PROJECT_ENVIRONMENT', run.EUREKA_CHILD_ENV_KEYS.includes('UV_PROJECT_ENVIRONMENT') ? [] : ['UV_PROJECT_ENVIRONMENT is not in EUREKA_CHILD_ENV_KEYS']);

    // ---- A2
    const forbiddenPrefix = ['CLAUDE_', 'MINDRIAN_ROOM', 'MINDRIAN_BRAIN', 'MINDRIAN_EUREKA_ROOT', 'MINDRIAN_EUREKA_ALLOW', 'MINDRIAN_EUREKA_UV'];
    const a2 = [];
    for (const s of starts) for (const k of s.env_keys) if (forbiddenPrefix.some((p) => k.startsWith(p))) a2.push('forbidden child environment key: ' + k);
    arm('A2 no CLAUDE_, MINDRIAN_ROOM, MINDRIAN_BRAIN, MINDRIAN_EUREKA_ROOT, MINDRIAN_EUREKA_ALLOW or MINDRIAN_EUREKA_UV key in the child', a2);

    // ---- A3, per path
    for (const r of defaults) {
      const s = r.start;
      const bad3 = ['UV_OFFLINE', 'HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE'].filter((k) => !s || s[k] !== '1');
      arm('A3 ' + r.name, bad3.length ? ['not 1 in the child: ' + bad3.join(', ')] : []);
    }
    const scoutDefault = defaults.find((r) => r.name === 'scout');
    if (scoutDefault && scoutDefault.capturedOptions) {
      const e = scoutDefault.capturedOptions.env || {};
      arm('A3 scout (options handed to the transport)', ['UV_OFFLINE', 'HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE'].filter((k) => e[k] !== '1').map((k) => k + ' is not 1 in the transport options'));
    }

    // ---- A4
    const a4 = [];
    for (const r of allows) {
      const s = r.start;
      if (!s) continue;
      for (const k of ['UV_OFFLINE', 'HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE']) if (s[k] === '1') a4.push(r.name + ': ' + k + ' is forced to 1 under the opt-in');
      if (s.env_keys.includes('MINDRIAN_EUREKA_ALLOW_NETWORK')) a4.push(r.name + ': the opt-in reached the child');
    }
    arm('A4 with MINDRIAN_EUREKA_ALLOW_NETWORK=1 the offline variables are not forced and the opt-in is not copied', a4);

    // ---- A5
    const analyzeRows = defaults.find((r) => r.name === 'analyze').rows;
    const workflowCall = analyzeRows.find((r) => r.kind === 'call' && r.tool === 'scout_run_workflow');
    const a5 = [];
    if (!workflowCall) a5.push('the fake saw no scout_run_workflow call');
    else {
      if (!sameList(workflowCall.shape.keys, ['snapshot'])) a5.push('request keys ' + JSON.stringify(workflowCall.shape.keys) + ' expected ["snapshot"]');
      if (workflowCall.shape.snapshot_nodes !== 1) a5.push('snapshot nodes ' + workflowCall.shape.snapshot_nodes);
      if (!Array.isArray(workflowCall.watch_hits)) a5.push('the fake read no watch.json');
      else if (workflowCall.watch_hits.some((n) => n !== 0)) a5.push('the raw request holds a room path or room.db: ' + JSON.stringify(workflowCall.watch_hits));
    }
    const analyzeStart = defaults.find((r) => r.name === 'analyze').start;
    if (analyzeStart) {
      const blob = JSON.stringify([analyzeStart.argv, analyzeStart.cwd, analyzeStart.env_all]);
      if (blob.includes(born.roomDir)) a5.push('the argv, working folder or environment holds the room folder');
      if (blob.includes('room.db')) a5.push('the argv, working folder or environment holds room.db');
      if (blob.includes(iso.roomsHome)) a5.push('the child environment holds the rooms home');
    }
    // control: the watch list can see a leak. A request that does hold the room folder is counted by the fake.
    const beforeControl = rowsOf(engine).length;
    await graph.callEurekaWorkflow('graph.explore_local_relationships', { snapshot: proj.snapshot, note: born.roomDir + '/.mindrian/room.db' }, Object.assign({}, process.env));
    const controlCall = rowsOf(engine).slice(beforeControl).find((r) => r.kind === 'call' && r.tool === 'scout_run_workflow');
    if (!controlCall || !Array.isArray(controlCall.watch_hits) || controlCall.watch_hits[0] < 1 || controlCall.watch_hits[1] < 1) a5.push('control: the watch list did not see a planted room path');
    arm('A5 analyze with a bound fixture room: the engine receives the snapshot only', a5);

    // ---- A6
    const a6 = [];
    for (const s of starts) { let c; try { c = fs.realpathSync(s.cwd); } catch (_e) { c = s.cwd; } if (c !== fs.realpathSync(engine)) a6.push('working folder ' + s.cwd); }
    arm('A6 the child working folder is the engine folder', a6);

    // ---- A9 and A10
    const extrasFor = {
      analyze: () => requirements.needsForCall('eureka_graph_analyze', {}, process.env).extras,
      capability_run: () => requirements.needsForCall('eureka_capability_run', { capability_id: ids.run }, process.env).extras,
      capability_start: () => requirements.needsForCall('eureka_capability_start', { capability_id: ids.start }, process.env).extras,
      scout: () => requirements.needsForCall('eureka_graph_opportunity_scout', {}, process.env).extras,
    };
    for (const r of defaults) {
      const want = requirements.uvRunArgs(realEngine, extrasFor[r.name](), {});
      const got = r.start ? r.start.argv : null;
      const p = [];
      for (const f of ['--no-sync', '--offline', '--locked', '--no-python-downloads']) if (!got || !got.includes(f)) p.push('argv lacks ' + f);
      if (!sameList(got, want)) p.push('argv ' + JSON.stringify(got) + ' expected ' + JSON.stringify(want));
      arm('A9 ' + r.name, p);
    }
    const a10 = [];
    for (const r of allows) {
      const want = requirements.uvRunArgs(realEngine, extrasFor[r.name](), { allowNetwork: true });
      const got = r.start ? r.start.argv : null;
      if (!sameList(got, want)) a10.push(r.name + ': argv ' + JSON.stringify(got) + ' expected ' + JSON.stringify(want));
    }
    arm('A10 with the opt-in the array equals uvRunArgs(..., { allowNetwork: true }): only --locked remains', a10);

    // ---- P3: the one sync
    const syncEngine = path.join(tmp, 'sync-engine');
    fs.mkdirSync(syncEngine);
    copyFixture(syncEngine);
    // the sync command checks the project name before it shows the grant card: use the synthetic engine pyproject
    fs.writeFileSync(path.join(syncEngine, 'pyproject.toml'), '[project]\nname = "mindrian-eureka"\nrequires-python = ">=3.11"\n\n[project.scripts]\neureka-mcp = "synthetic:main"\n');
    const syncEnv = {
      PATH: process.env.PATH, HOME: iso.home, MINDRIAN_EUREKA_UV: path.join(syncEngine, 'fake-uv.cjs'), MINDRIAN_EUREKA_ROOT: syncEngine,
      CLAUDE_387_PROBE: 'x', MINDRIAN_BRAIN_KEY: 'synthetic-key-387', MINDRIAN_ROOMS_HOME: iso.roomsHome,
      UV_CACHE_DIR: path.join(tmp, 'uv-cache'), UV_PYTHON_INSTALL_DIR: path.join(tmp, 'uv-python'), UV_PROJECT_ENVIRONMENT: path.join(tmp, 'uv-env'),
    };
    const p3 = [];
    const syncRes = enable.runEngineSync(syncEngine, [], { env: syncEnv });
    const syncRows = rowsOf(syncEngine).filter((r) => r.kind === 'sync');
    if (syncRes.status !== 0) p3.push('sync exit ' + syncRes.status);
    if (syncRows.length !== 1) p3.push('expected 1 sync spawn, got ' + syncRows.length);
    else {
      const r = syncRows[0];
      if (!sameList(r.argv, ['sync', '--locked', '--no-python-downloads', '--extra', 'mcp-server'])) p3.push('argv ' + JSON.stringify(r.argv));
      if (fs.realpathSync(r.cwd) !== fs.realpathSync(syncEngine)) p3.push('cwd ' + r.cwd);
      const leaked = r.env_keys.filter((k) => k.startsWith('CLAUDE_') || k.startsWith('MINDRIAN_'));
      if (leaked.length) p3.push('child environment holds: ' + leaked.join(', '));
      for (const k of ['UV_CACHE_DIR', 'UV_PYTHON_INSTALL_DIR', 'UV_PROJECT_ENVIRONMENT']) if (!r.env_keys.includes(k)) p3.push('child environment lacks ' + k);
    }
    // without the approval flag the command shows the grant card and spawns no sync
    const noApproval = enable.run(['--sync'], { env: syncEnv });
    const afterRows = rowsOf(syncEngine).filter((r) => r.kind === 'sync');
    if (noApproval.exitCode !== 2) p3.push('without the approval flag the exit code is ' + noApproval.exitCode + ', expected 2');
    if (afterRows.length !== 1) p3.push('a sync spawned without the approval flag');
    arm('P3 the one sync: argv, working folder and clean environment; none without the approval flag', p3);

    // ---- P4: the doctor child
    const docEngine = path.join(tmp, 'doctor-engine');
    fs.mkdirSync(docEngine);
    copyFixture(docEngine);
    const docEnv = { PATH: process.env.PATH, HOME: iso.home, MINDRIAN_EUREKA_UV: path.join(docEngine, 'fake-uv.cjs'), CLAUDE_387_PROBE: 'x' };
    const docRes = enable.runEngineDoctor(docEngine, { env: docEnv });
    const docRows = rowsOf(docEngine).filter((r) => r.kind === 'doctor');
    const p4 = [];
    if (docRes.status !== 1) p4.push('doctor exit ' + docRes.status);
    if (docRows.length !== 1) p4.push('expected 1 doctor spawn, got ' + docRows.length);
    else {
      const r = docRows[0];
      const want = requirements.uvRunArgs(docEngine, ['mcp-server'], { entry: ['eureka', 'doctor', '--json'] });
      if (!sameList(r.argv, want)) p4.push('argv ' + JSON.stringify(r.argv));
      for (const f of ['--no-sync', '--offline', '--locked', '--no-python-downloads']) if (!r.argv.includes(f)) p4.push('argv lacks ' + f);
      for (const k of ['UV_OFFLINE', 'HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE']) if (r[k] !== '1') p4.push(k + ' is not 1 in the doctor child');
      if (r.env_keys.some((k) => k.startsWith('CLAUDE_'))) p4.push('a CLAUDE_ key reached the doctor child');
    }
    arm('P4 the doctor child runs offline with the uvRunArgs array', p4);

    // ---- A7 and A8 (last, so they cover every call above)
    const engineAttempts = attempts.slice(sandbox);
    const nonLoopback = engineAttempts.filter((a) => !a.local);
    const a7 = [];
    if (!controlCounted) a7.push('the counter did not count a loopback control connect');
    if (nonLoopback.length) a7.push('non-loopback attempts: ' + JSON.stringify(nonLoopback.slice(0, 4)));
    arm('A7 the host made 0 non-loopback connection attempts during the engine calls', a7, engineAttempts.length + ' loopback or local attempts counted');
    const brainClientLoaded = Object.keys(require.cache).some((k) => /lib[\\/]core[\\/]brain-client\.cjs$/.test(k));
    arm('A8 the Brain capture server saw 0 requests', capture.captured.length === 0 ? [] : ['captured ' + capture.captured.length + ' requests'], 'information: brain-client in require.cache = ' + brainClientLoaded);
  } catch (error) {
    bad('SETUP the egress test could not run', String(error && error.stack || error));
  } finally {
    for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    await cleanup();
  }
  process.stdout.write('\ntest-387-eureka-egress: ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); });
