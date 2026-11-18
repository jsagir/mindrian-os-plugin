#!/usr/bin/env node
'use strict';
/*
 * Phase 392 plan 07: the plugin deadline must reach every Eureka client.callTool (loop check L2, fact F9).
 *
 * The MCP SDK default request timeout is 60 s (node_modules/@modelcontextprotocol/client/dist/src-D0qEN74R.cjs,
 * DEFAULT_REQUEST_TIMEOUT_MSEC). A callTool that passes only {signal} loses the plugin deadline of 120 s or
 * 900 s, and the 60 s error lands in startFailureRefusal as engine_start_failed. This test drives the shipped
 * tool modules against the Phase 387 fake engine, which sleeps 65 s on scout_run_workflow and scout_result.
 *
 * Legs (each prints one line with the elapsed seconds):
 *   A  graph workflow, configured timeout left at its default (120 s): expected ok true at about 65 s.
 *      On beta.81: engine_start_failed at about 60 s.
 *   B  graph workflow, MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS=62000 (the variable eureka-graph-analyze.cjs reads
 *      for configuredTimeout): expected reason engine_timeout at about 62 s, never engine_start_failed.
 *      On beta.81: engine_start_failed at about 60 s.
 *   C  a job session (eureka-capability-jobs.cjs) with MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS=70000: the result call
 *      sleeps 65 s and must return ok true; then a second job session is started, its engine child is killed,
 *      and the session must leave the session map within 1 s.
 *      On beta.81: engine_result_error at about 60 s, and the session stays in the map after the kill.
 *   In every leg the fake records the request, which proves the engine was connected when the error came.
 *
 * Environment. The test runs under the plugin's Node MCP client (@modelcontextprotocol/client) against the
 * fake engine, a Node script started through its shebang (/usr/bin/env node) by the StdioClientTransport. The
 * real engine's locked environment (uv run --no-sync --offline --locked --no-python-downloads, mcp 2.3.0) is
 * never started, and the system Python (mcp 1.25.0) is never used. The plugin copies only allowlisted
 * variables to the engine child, so FAKE_EUREKA_SLEEP_MS is set by a 3-line launcher script in the temp
 * folder that MINDRIAN_EUREKA_UV points at; the launcher requires the fake. No network: the engine is a local
 * child on stdio, and the fake writes only inside its temp folder.
 *
 * Runtime about 200 s. Exit 0 pass, 1 fail, 77 on win32 (the fake is an executable script). Hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'eureka-fake-engine-387');
const SLEEP_MS = 65000;
const TIMEOUT_VARIABLE = 'MINDRIAN_EUREKA_WORKFLOW_TIMEOUT_MS';

if (process.platform === 'win32') {
  process.stdout.write('SKIPPED (ENV GAP): the fake uv is an executable Node script; win32 is not covered\n');
  process.exit(77);
}

let passed = 0;
let failed = 0;
function ok(label, extra) { passed += 1; process.stdout.write('ok - ' + label + (extra ? ' (' + extra + ')' : '') + '\n'); }
function bad(label, detail) { failed += 1; process.stdout.write('FAIL - ' + label + '\n'); if (detail) process.stdout.write('    ' + String(detail).split('\n').join('\n    ') + '\n'); }
function arm(label, problems, extra) { if (problems.length) bad(label, problems.join('\n')); else ok(label, extra); }
function seconds(ms) { return (ms / 1000).toFixed(1) + ' s'; }

function rowsOf(engine) {
  try {
    return fs.readFileSync(path.join(engine, 'observed.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch (_e) { return []; }
}

function prepareEngine(tmp) {
  const engine = path.join(tmp, 'engine');
  fs.mkdirSync(engine);
  fs.cpSync(FIXTURE, engine, { recursive: true });
  fs.chmodSync(path.join(engine, 'fake-uv.cjs'), 0o755);
  fs.writeFileSync(path.join(engine, 'repo-root.txt'), REPO + '\n');
  // The launcher: sets the sleep and hands over to the fake. It lives outside the engine folder.
  const launcher = path.join(tmp, 'fake-uv-sleep.cjs');
  fs.writeFileSync(launcher, [
    '#!/usr/bin/env node',
    "process.env.FAKE_EUREKA_SLEEP_MS = '" + SLEEP_MS + "';",
    'require(' + JSON.stringify(path.join(engine, 'fake-uv.cjs')) + ');',
    '',
  ].join('\n'), { mode: 0o755 });
  fs.chmodSync(launcher, 0o755);
  return { engine, launcher };
}

function baseEnv(tmp, world) {
  const home = path.join(tmp, 'home');
  fs.mkdirSync(home, { recursive: true });
  return {
    PATH: process.env.PATH,
    HOME: home,
    TMPDIR: tmp,
    MINDRIAN_EUREKA_ROOT: world.engine,
    MINDRIAN_EUREKA_UV: world.launcher,
  };
}

async function timed(fn) {
  const t0 = Date.now();
  let result;
  try { result = await fn(); } catch (error) { result = { ok: false, thrown: String(error && error.message || error) }; }
  return { result, elapsedMs: Date.now() - t0 };
}

function sawCall(rows, tool) {
  return rows.some((r) => r.kind === 'call' && r.tool === tool);
}

async function legA(graph, env, engine) {
  const before = rowsOf(engine).length;
  const { result, elapsedMs } = await timed(() => graph.callEurekaWorkflow('graph.explore_local_relationships', { snapshot: { nodes: [], edges: [], meta: {} } }, env));
  const rows = rowsOf(engine).slice(before);
  process.stdout.write('leg A: ok=' + result.ok + ' reason=' + (result.reason || '-') + ' elapsed=' + seconds(elapsedMs) + '\n');
  const problems = [];
  if (result.ok !== true) problems.push('expected ok true, got ' + JSON.stringify(result).slice(0, 300));
  if (elapsedMs < SLEEP_MS - 1000 || elapsedMs > SLEEP_MS + 25000) problems.push('elapsed ' + seconds(elapsedMs) + ', expected about 65 s');
  if (!sawCall(rows, 'scout_run_workflow')) problems.push('the fake did not record the scout_run_workflow call (not connected)');
  arm('A default 120 s deadline: a 65 s engine answer completes', problems, seconds(elapsedMs));
}

async function legB(graph, env, engine) {
  const before = rowsOf(engine).length;
  const envB = Object.assign({}, env, { [TIMEOUT_VARIABLE]: '62000' });
  const { result, elapsedMs } = await timed(() => graph.callEurekaWorkflow('graph.explore_local_relationships', { snapshot: { nodes: [], edges: [], meta: {} } }, envB));
  const rows = rowsOf(engine).slice(before);
  process.stdout.write('leg B: ok=' + result.ok + ' reason=' + (result.reason || '-') + ' elapsed=' + seconds(elapsedMs) + '\n');
  const problems = [];
  if (result.reason !== 'engine_timeout') problems.push('expected reason engine_timeout, got ' + JSON.stringify(result).slice(0, 300));
  if (result.reason === 'engine_start_failed' || result.cause === 'engine_start_failed') problems.push('the SDK default timeout was reported as a start failure after a connect');
  if (elapsedMs < 61000 || elapsedMs > 72000) problems.push('elapsed ' + seconds(elapsedMs) + ', expected about 62 s');
  if (!sawCall(rows, 'scout_run_workflow')) problems.push('the fake did not record the scout_run_workflow call (not connected)');
  arm('B ' + TIMEOUT_VARIABLE + '=62000: a 65 s engine answer ends as engine_timeout at the plugin deadline', problems, seconds(elapsedMs));
}

function waitUntil(predicate, limitMs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => {
      if (predicate()) return resolve(true);
      if (Date.now() - t0 >= limitMs) return resolve(false);
      setTimeout(tick, 50);
    };
    tick();
  });
}

async function legC(jobs, env, engine) {
  const envC = Object.assign({}, env, { [TIMEOUT_VARIABLE]: '70000' });
  const capabilityId = 'opportunity.synthesize_discovery_signals';
  const problems = [];
  const before = rowsOf(engine).length;
  const started = await jobs.startCapability({ capability_id: capabilityId, request: { scope_id: 'room:q35-deadline', snapshot_id: 'snapshot-q35-deadline', topic: 'synthetic' } }, {}, { env: envC });
  if (!started.ok) {
    process.stdout.write('leg C: start failed ' + JSON.stringify(started).slice(0, 300) + '\n');
    arm('C job session: the 65 s result returns under a 70 s deadline', ['start failed: ' + JSON.stringify(started).slice(0, 300)]);
    return;
  }
  const jobId = started.job_id;
  const { result, elapsedMs } = await timed(() => jobs.jobResult({ job_id: jobId }, {}));
  const rows = rowsOf(engine).slice(before);
  process.stdout.write('leg C result: ok=' + result.ok + ' reason=' + (result.reason || '-') + ' status=' + (result.status || '-') + ' elapsed=' + seconds(elapsedMs) + '\n');
  if (result.ok !== true) problems.push('expected ok true from the result call, got ' + JSON.stringify(result).slice(0, 300));
  if (elapsedMs < SLEEP_MS - 1000 || elapsedMs > SLEEP_MS + 25000) problems.push('elapsed ' + seconds(elapsedMs) + ', expected about 65 s');
  if (!sawCall(rows, 'scout_result')) problems.push('the fake did not record the scout_result call (not connected)');
  arm('C job session: the 65 s result returns under a 70 s deadline', problems, seconds(elapsedMs));
  if (jobs.sessions.has(jobId)) await jobs.closeSession(jobId);

  // eviction: a second session, its engine child killed
  const evict = [];
  const second = await jobs.startCapability({ capability_id: capabilityId, request: { scope_id: 'room:q35-deadline', snapshot_id: 'snapshot-q35-deadline', topic: 'synthetic' } }, {}, { env: envC });
  if (!second.ok) {
    arm('C eviction: a killed engine child removes its session within 1 s', ['second start failed: ' + JSON.stringify(second).slice(0, 300)]);
    return;
  }
  const session = jobs.sessions.get(second.job_id);
  const pid = session && session.client && session.client.transport ? session.client.transport.pid : null;
  if (typeof pid !== 'number') {
    evict.push('no child pid on the retained session');
  } else {
    const t0 = Date.now();
    try { process.kill(pid, 'SIGKILL'); } catch (error) { evict.push('kill failed: ' + String(error && error.message)); }
    const gone = await waitUntil(() => !jobs.sessions.has(second.job_id), 1000);
    const waited = Date.now() - t0;
    process.stdout.write('leg C eviction: session_gone=' + gone + ' after ' + seconds(waited) + '\n');
    if (!gone) evict.push('the session is still in the session map 1 s after its transport closed');
  }
  arm('C eviction: a killed engine child removes its session within 1 s', evict);
  if (jobs.sessions.has(second.job_id)) await jobs.closeSession(second.job_id);
}

async function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-392-deadline-'));
  const world = prepareEngine(tmp);
  const env = baseEnv(tmp, world);
  const graph = require('../lib/mcp/tools/eureka-graph-analyze.cjs');
  const jobs = require('../lib/mcp/tools/eureka-capability-jobs.cjs');
  const t0 = Date.now();
  try {
    await legA(graph, env, world.engine);
    await legB(graph, env, world.engine);
    await legC(jobs, env, world.engine);
  } finally {
    for (const id of Array.from(jobs.sessions.keys())) { try { await jobs.closeSession(id); } catch (_e) { /* best effort */ } }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
  process.stdout.write('\ntest-396-eureka-deadline: ' + passed + ' passed, ' + failed + ' failed, total ' + seconds(Date.now() - t0) + '\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); });
