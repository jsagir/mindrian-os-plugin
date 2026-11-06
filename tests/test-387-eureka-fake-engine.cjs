#!/usr/bin/env node
'use strict';
/*
 * Phase 387 plan 06, task 1: self-test of the fake engine fixture (tests/fixtures/eureka-fake-engine-387).
 *
 * Arms (each prints ok - or FAIL - with its label):
 *   F1  the fake, started as uv run --project ROOT --extra mcp-server eureka-mcp, serves the 7 tools
 *   F2  scout_capabilities returns 3 catalog entries, all experimental, on the two routes named in the plan
 *   F3  after one tool call observed.jsonl holds the argv, the working folder, the sorted env keys and the 3 offline values
 *   F4  the first argument sync creates .venv/pyvenv.cfg and the marker folders for the --extra names, exit 0
 *   F5  the arguments that end with eureka doctor --json print a doctor-shaped JSON with one failing check, exit 1
 *   F6  the fake writes nothing outside its working folder; its source holds no network require and no fetch call
 *
 * The fixture folder is copied to a temp folder first, so the fake writes its record there and the repo stays
 * clean. The real engine is never started. No network. Exit 77 on win32 (the fake is an executable script).
 * Hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const FIXTURE = path.join(REPO, 'tests', 'fixtures', 'eureka-fake-engine-387');

if (process.platform === 'win32') {
  process.stdout.write('SKIPPED (ENV GAP): the fake uv is an executable Node script; win32 is not covered\n');
  process.exit(77);
}

let passed = 0;
let failed = 0;
function ok(label, extra) { passed += 1; process.stdout.write('ok - ' + label + (extra ? ' (' + extra + ')' : '') + '\n'); }
function bad(label, detail) { failed += 1; process.stdout.write('FAIL - ' + label + '\n'); if (detail) process.stdout.write('    ' + String(detail).split('\n').join('\n    ') + '\n'); }

function copyFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-387-fake-engine-'));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  fs.chmodSync(path.join(dir, 'fake-uv.cjs'), 0o755);
  fs.writeFileSync(path.join(dir, 'repo-root.txt'), REPO + '\n');
  return dir;
}

function readObserved(dir) {
  try {
    return fs.readFileSync(path.join(dir, 'observed.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch (_e) { return []; }
}

function listTree(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      out.push(path.relative(dir, p));
      if (e.isDirectory()) walk(p);
    }
  })(dir);
  return out.sort();
}

async function main() {
  const { Client } = require('@modelcontextprotocol/client');
  const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');
  const dir = copyFixture();
  const fake = path.join(dir, 'fake-uv.cjs');
  const childEnv = { PATH: process.env.PATH, HOME: dir, UV_OFFLINE: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' };
  const client = new Client({ name: 'fake-engine-selftest', version: '1.0.0' }, { capabilities: {} });
  const transport = new StdioClientTransport({
    command: fake,
    args: ['run', '--project', dir, '--extra', 'mcp-server', 'eureka-mcp'],
    cwd: dir,
    env: childEnv,
    stderr: 'pipe',
  });
  let tools = null;
  let catalog = null;
  try {
    await client.connect(transport);
    tools = (await client.listTools()).tools.map((t) => t.name).sort();
    const res = await client.callTool({ name: 'scout_capabilities', arguments: {} });
    catalog = res.structuredContent;
  } catch (e) {
    bad('F1 the fake serves tools/list through the real StdioClientTransport', String(e && e.stack || e));
  } finally {
    try { await client.close(); } catch (_e) { /* best effort */ }
  }

  // F1
  const want = ['scout_cancel', 'scout_capabilities', 'scout_capability_contract', 'scout_result', 'scout_run_workflow',
    'scout_start_opportunity_signal_scout', 'scout_status'];
  if (tools && JSON.stringify(tools) === JSON.stringify(want)) ok('F1 the fake serves the 7 tools through the real StdioClientTransport');
  else if (tools) bad('F1 the fake serves the 7 tools', JSON.stringify(tools));

  // F2
  const caps = catalog && catalog.capabilities;
  const f2 = [];
  if (!Array.isArray(caps) || caps.length !== 3) f2.push('expected 3 catalog entries, got ' + JSON.stringify(caps && caps.length));
  else {
    const byId = Object.fromEntries(caps.map((c) => [c.id, c]));
    const expect = {
      'graph.explore_local_relationships': 'scout_run_workflow',
      'research.analyze_rs_domain_projection': 'scout_run_workflow',
      'opportunity.synthesize_discovery_signals': 'scout_start_opportunity_signal_scout',
    };
    for (const id of Object.keys(expect)) {
      const c = byId[id];
      if (!c) { f2.push('missing ' + id); continue; }
      if (c.status !== 'experimental') f2.push(id + ' status ' + c.status);
      if (!c.routes || !c.routes.mcp || c.routes.mcp.tool !== expect[id]) f2.push(id + ' route ' + JSON.stringify(c.routes));
    }
  }
  if (f2.length) bad('F2 scout_capabilities returns the 3 catalog entries', f2.join('\n')); else ok('F2 scout_capabilities returns 3 experimental entries on the 2 routes');

  // F3
  const rows = readObserved(dir);
  const start = rows.find((r) => r.kind === 'start');
  const call = rows.find((r) => r.kind === 'call');
  const f3 = [];
  if (!start) f3.push('no start row');
  else {
    if (JSON.stringify(start.argv) !== JSON.stringify(['run', '--project', dir, '--extra', 'mcp-server', 'eureka-mcp'])) f3.push('argv ' + JSON.stringify(start.argv));
    if (fs.realpathSync(start.cwd) !== fs.realpathSync(dir)) f3.push('cwd ' + start.cwd);
    if (JSON.stringify(start.env_keys) !== JSON.stringify(start.env_keys.slice().sort())) f3.push('env keys not sorted');
    for (const k of ['UV_OFFLINE', 'HF_HUB_OFFLINE', 'TRANSFORMERS_OFFLINE']) if (start[k] !== '1') f3.push(k + ' = ' + start[k]);
  }
  if (!call || call.tool !== 'scout_capabilities') f3.push('no call row for scout_capabilities');
  if (f3.length) bad('F3 observed.jsonl records the start and the call', f3.join('\n')); else ok('F3 observed.jsonl records argv, working folder, sorted env keys and the 3 offline values');

  // F4
  const dirSync = copyFixture();
  const syncRes = childProcess.spawnSync(path.join(dirSync, 'fake-uv.cjs'), ['sync', '--locked', '--no-python-downloads', '--extra', 'mcp-server', '--extra', 'modern-encoder'],
    { cwd: dirSync, env: { PATH: process.env.PATH, HOME: dirSync }, encoding: 'utf8', shell: false });
  const site = path.join(dirSync, '.venv', 'lib', 'python3.12', 'site-packages');
  const f4 = [];
  if (syncRes.status !== 0) f4.push('exit ' + syncRes.status);
  if (!fs.existsSync(path.join(dirSync, '.venv', 'pyvenv.cfg'))) f4.push('no pyvenv.cfg');
  for (const m of ['mcp-2.3.0.dist-info', 'sentence_transformers-5.0.0.dist-info']) if (!fs.existsSync(path.join(site, m))) f4.push('missing ' + m);
  if (fs.existsSync(path.join(site, 'pomegranate-1.0.0.dist-info'))) f4.push('hmm marker made without --extra hmm');
  const syncRows = readObserved(dirSync);
  if (syncRows.length !== 1 || syncRows[0].kind !== 'sync') f4.push('expected one sync record, got ' + syncRows.length);
  if (f4.length) bad('F4 sync creates the environment and the marker folders', f4.join('\n')); else ok('F4 sync creates .venv/pyvenv.cfg and the marker folders for the --extra names, exit 0');

  // F5
  const dirDoc = copyFixture();
  const docArgs = ['run', '--no-sync', '--offline', '--locked', '--no-python-downloads', '--project', dirDoc, '--extra', 'mcp-server', 'eureka', 'doctor', '--json'];
  const docRes = childProcess.spawnSync(path.join(dirDoc, 'fake-uv.cjs'), docArgs, { cwd: dirDoc, env: { PATH: process.env.PATH, HOME: dirDoc, UV_OFFLINE: '1' }, encoding: 'utf8', shell: false });
  const f5 = [];
  let doc = null;
  try { doc = JSON.parse(docRes.stdout); } catch (_e) { f5.push('stdout is not JSON'); }
  if (docRes.status !== 1) f5.push('exit ' + docRes.status);
  if (doc) {
    const failing = (doc.checks || []).filter((c) => c.status === 'FAIL');
    if (doc.ok !== false) f5.push('ok is not false');
    if (failing.length !== 1 || failing[0].message !== 'Missing Python libraries: sentence_transformers') f5.push('failing checks ' + JSON.stringify(failing));
  }
  const docRows = readObserved(dirDoc);
  if (docRows.length !== 1 || docRows[0].kind !== 'doctor') f5.push('expected one doctor record');
  if (f5.length) bad('F5 the doctor entry prints a doctor-shaped JSON and exits 1', f5.join('\n')); else ok('F5 the doctor entry prints a doctor-shaped JSON with one failing check, exit 1');

  // F6: nothing outside the working folder (the copy folder holds the only new files), and a clean source
  const f6 = [];
  const src = fs.readFileSync(FIXTURE + '/fake-uv.cjs', 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  if (/require\(\s*['"](node:)?(http|https|net|dns)['"]\s*\)/.test(code)) f6.push('a network module is required');
  if (/\bfetch\s*\(/.test(code)) f6.push('a fetch call');
  const treeBefore = listTree(FIXTURE).join(',');
  if (treeBefore !== 'fake-uv.cjs,pyproject.toml') f6.push('the repo fixture folder changed: ' + treeBefore);
  const sync = listTree(dirSync);
  for (const p of sync) {
    if (!(p === 'fake-uv.cjs' || p === 'pyproject.toml' || p === 'repo-root.txt' || p === 'observed.jsonl' || p.startsWith('.venv'))) f6.push('unexpected file in the working folder: ' + p);
  }
  if (f6.length) bad('F6 the fake writes only in its working folder and holds no network code', f6.join('\n')); else ok('F6 the fake writes only in its working folder; no network require, no fetch call');

  for (const d of [dir, dirSync, dirDoc]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } }
  process.stdout.write('\ntest-387-eureka-fake-engine: ' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { process.stderr.write(String(e && e.stack || e) + '\n'); process.exit(1); });
