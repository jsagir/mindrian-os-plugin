#!/usr/bin/env node
'use strict';

/*
 * Phase 369.1 plan 03 (DPI-06, D-04, D-14, decision 8): the Desktop-safe loading path.
 * ===================================================================================
 * Dependencies cannot travel in the Desktop payload (D-14), so the plugin installs
 * them itself the first time a server starts, and while it does it must answer IN
 * BAND, honestly, never crash at the 15 s connect budget and never serve a partial
 * toolset. This test pins that behaviour BEFORE the production code exists, so it is
 * RED today and goes green only when plans 369.1-06 (heal, resolver, detached
 * installer, responder) and 369.1-10 (entry points) land.
 *
 * PINNED INTERFACES (plans 369.1-06 and 369.1-10 build exactly these):
 *   lib/core/npm-cli-resolve.cjs
 *     buildInstallArgs(descriptor, installArgs, opts)
 *       - no installArgs and opts.frozen === true  -> descriptor.baseArgs plus
 *         ['ci','--ignore-scripts','--no-audit','--no-fund']
 *       - no installArgs, no opts                  -> baseArgs plus
 *         ['install','--no-audit','--no-fund','--silent'] (unchanged)
 *       - explicit installArgs                     -> baseArgs plus ['install', ...installArgs]
 *         (lib/core/eureka/eureka-enable.cjs depends on this; frozen does not change it)
 *     resolveNpmCli() honours MINDRIAN_TEST_NPM_CLI ONLY when MINDRIAN_TEST_MODE === '1':
 *       a path to a JS file is run as npm-cli.js; a path that does not exist yields a
 *       spawn that fails with ENOENT (the same branch a machine without npm takes).
 *   lib/core/mcp-dep-heal.cjs
 *     runGuardedInstall(dir, opts) passes { frozen: true } when <dir>/npm-shrinkwrap.json
 *       exists and returns { ran, waited, ok, reason }, reason one of null,
 *       'npm-not-found', 'timeout', 'exit-<code>'.
 *     startDetachedInstall(dir) -> { started, pid, statusFile }; never starts a second
 *       install while one holds the lock.
 *     ensureDepsPresent keeps its return keys and adds reason.
 *     MINDRIAN_TEST_CONNECT_BUDGET_MS overrides CONNECT_PATH_BUDGET_MS only under
 *       MINDRIAN_TEST_MODE=1.
 *   lib/core/dep-install-detached.cjs <pluginRoot>: the detached child; writes the status file.
 *   lib/core/mcp-install-responder.cjs
 *     serveInstallingResponder({ serverName, version, pluginRoot, status }): dependency-free
 *       stdio JSON-RPC responder serving exactly one status tool.
 *     installStatusLine(status, serverName), statusFilePath(pluginRoot),
 *     STATUS_TOOL_NAMES = { 'mindrian-os': 'mos_install_status', 'mindrian-brain': 'brain_install_status' }.
 *     statusFilePath = <home>/.mindrian/run/dep-install-<first 12 hex of sha256(normalised root)>.json
 *       (369.1-REVIEW CR-01 / WR-05: a per-user 0700 directory, never the shared tmpdir; the
 *       root is normalised: realpath, forward slashes, no trailing slash)
 *     Status shape: { state: 'installing'|'done'|'failed'|'npm-not-found', startedAt,
 *                     finishedAt, reason, pid, attempts } (no plugin path is stored).
 *   The MCP entry points (whatever path .mcp.json names: bin/ today, scripts/ after plan
 *     369.1-04) serve the responder on the stdio path when the bounded install does not finish.
 *
 * Arms (repeatable --arm <id>; no flag runs every arm except real-npm, which downloads
 * the dependency set and runs only when named):
 *   unit             argv shapes, reasons, seam gating, budget override (fake npm)
 *   responder-module the responder on both protocol eras plus a raw JSON-RPC session
 *   detached         startDetachedInstall: done, single-flight, failed
 *   entries          both real MCP entries from an npm-pack scratch plugin with no node_modules
 *   real-npm         live: the real npm ci --ignore-scripts, measured
 *
 * Hermetic (D-08, Canon Part 8): temp HOME, MINDRIAN_ROOMS_HOME, unreachable
 * MINDRIAN_BRAIN_URL (http://127.0.0.1:9), no Brain key, no room content, npm registry
 * pointed at an unreachable port everywhere except the real-npm arm. NO npm install or
 * npm ci ever runs in the repo root: every install happens in a scratch copy made from
 * npm pack. Every process this test starts has its temp root in its command line and is
 * killed in finally; nothing is written in the repo (git status outside .planning/ and
 * tests/e2e-369/, which a parallel plan owns, is compared before and after).
 * No shared helper (copy, do not import).
 *
 * Exit: 1 on any FAIL, 77 (printed as ENV GAP) only when the registry, npm, tar or the
 * MCP client is missing for a named arm and nothing failed, else 0. Hyphens only.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawn, spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const HEAL = path.join(REPO_ROOT, 'lib', 'core', 'mcp-dep-heal.cjs');
const RESOLVE = path.join(REPO_ROOT, 'lib', 'core', 'npm-cli-resolve.cjs');
const RESPONDER = path.join(REPO_ROOT, 'lib', 'core', 'mcp-install-responder.cjs');
const DETACHED = path.join(REPO_ROOT, 'lib', 'core', 'dep-install-detached.cjs');
const LOCK_NAME = '.mindrian-npm-install.lock';
const LONG_DASHES = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']');

const SERVERS = {
  'mindrian-os': { statusTool: 'mos_install_status', mustHave: 'room_list' },
  'mindrian-brain': { statusTool: 'brain_install_status', mustHave: 'brain_ask' },
};

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
let envGap = null;

function pass(arm, name) {
  passed += 1;
  console.log('PASS: ' + arm + ' ' + name);
}
function fail(arm, name, reason) {
  failed += 1;
  console.log('FAIL: ' + arm + ' ' + name + ' -- ' + reason);
}
function reasonOf(e) {
  if (e && e.name === 'AssertionError' && e.generatedMessage && 'actual' in e) {
    const j = (v) => JSON.stringify(v);
    return 'actual=' + String(j(e.actual)).slice(0, 220) + ' expected=' + String(j(e.expected)).slice(0, 220);
  }
  return e && e.message ? String(e.message).split('\n')[0].slice(0, 400) : String(e);
}
async function check(arm, name, fn) {
  try {
    await fn();
    pass(arm, name);
    return true;
  } catch (e) {
    fail(arm, name, reasonOf(e));
    return false;
  }
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function withTimeout(p, ms, label) {
  let t;
  const timer = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(label + ' did not answer within ' + ms + ' ms')), ms);
  });
  return Promise.race([p, timer]).finally(() => clearTimeout(t));
}

const argv = process.argv.slice(2);
const ARMS = [];
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--arm' && argv[i + 1]) { ARMS.push(argv[i + 1]); i += 1; }
}
const ALL_ARMS = ['unit', 'responder-module', 'detached', 'entries', 'real-npm'];
const DEFAULT_ARMS = ['unit', 'responder-module', 'detached', 'entries'];
const WANT = ARMS.length ? ARMS : DEFAULT_ARMS;
for (const a of WANT) {
  if (!ALL_ARMS.includes(a)) {
    console.log('FAIL: args arm -- unknown arm ' + a);
    console.log('RESULT: PASS=0 FAIL=1');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Temp root, process sweep, hermetic env
// ---------------------------------------------------------------------------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't3691-dep-'));
let tempCounter = 0;
function mkTemp(label) {
  tempCounter += 1;
  const d = path.join(TMP, label + '-' + tempCounter);
  fs.mkdirSync(d, { recursive: true });
  return d;
}
const statusFilesToRemove = new Set();
// One HOME for the whole run: the status record lives under <HOME>/.mindrian/run (369.1-REVIEW CR-01),
// so every process this test starts must share it with the parent that reads the record.
const TEST_HOME = mkTemp('home');

function expectedStatusFile(pluginRoot) {
  const norm = fs.realpathSync(pluginRoot).split(path.sep).join('/').replace(/\/+$/, '');
  const h = crypto.createHash('sha256').update(norm).digest('hex').slice(0, 12);
  const f = path.join(TEST_HOME, '.mindrian', 'run', 'dep-install-' + h + '.json');
  statusFilesToRemove.add(f);
  return f;
}
function readStatus(pluginRoot) {
  try {
    return JSON.parse(fs.readFileSync(expectedStatusFile(pluginRoot), 'utf8'));
  } catch (_e) {
    return null;
  }
}

// Every process whose command line carries this test's unique temp root was
// started by this test (servers, detached installers, fake npm, node -e children).
function rootProcesses() {
  const out = [];
  let entries = [];
  try { entries = fs.readdirSync('/proc'); } catch (_e) { return out; }
  for (const d of entries) {
    if (!/^\d+$/.test(d)) continue;
    const pid = Number(d);
    if (pid === process.pid) continue;
    let cl = '';
    try { cl = fs.readFileSync('/proc/' + d + '/cmdline', 'utf8').split('\0').join(' '); } catch (_e) { continue; }
    let cwd = '';
    try { cwd = fs.readlinkSync('/proc/' + d + '/cwd'); } catch (_e) { /* unreadable */ }
    if (cl.includes(TMP) || cwd === TMP || cwd.startsWith(TMP + path.sep)) out.push({ pid, cmdline: cl });
  }
  return out;
}
function sweep() {
  const killed = [];
  for (const p of rootProcesses()) {
    try { process.kill(p.pid, 'SIGKILL'); killed.push(p.pid); } catch (_e) { /* gone */ }
  }
  return killed;
}
function isAlive(pid) {
  if (typeof pid !== 'number') return false;
  try { process.kill(pid, 0); } catch (_e) { return false; }
  try {
    // A zombie counts as gone.
    const st = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
    return !/^\d+ \(.*\) Z /.test(st);
  } catch (_e) { return false; }
}
function cmdlineOf(pid) {
  try { return fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8').split('\0').join(' '); } catch (_e) { return ''; }
}

function cleanupAll() {
  sweep();
  for (const f of statusFilesToRemove) {
    try { fs.unlinkSync(f); } catch (_e) { /* absent */ }
  }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}
process.on('exit', cleanupAll);
process.on('SIGINT', () => { cleanupAll(); process.exit(130); });
process.on('SIGTERM', () => { cleanupAll(); process.exit(143); });

const SCRUB = [
  'MINDRIAN_BRAIN_KEY', 'MINDRIAN_MCP_FIRST', 'MINDRIAN_MCP_DAEMON', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_ROOM',
  'MINDRIAN_TEST_NPM_CLI', 'MINDRIAN_TEST_CONNECT_BUDGET_MS', 'MINDRIAN_TEST_MODE', 'FAKE_NPM_MODE', 'FAKE_NPM_LOG',
  'CLAUDE_PLUGIN_ROOT', 'MINDRIAN_OS_ROOT',
];
function hermeticEnv(extra) {
  const env = Object.assign({}, process.env);
  for (const k of SCRUB) delete env[k];
  env.HOME = TEST_HOME;
  env.MINDRIAN_ROOMS_HOME = mkTemp('rooms');
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9'; // unreachable loopback, never a real Brain
  env.MINDRIAN_TRANSPORT = 'stdio';
  env.npm_config_registry = 'http://127.0.0.1:9/'; // any stray real npm fails fast
  env.npm_config_cache = mkTemp('npmcache');
  env.npm_config_update_notifier = 'false';
  return Object.assign(env, extra || {});
}

// The fake npm: a node script run as npm-cli.js through MINDRIAN_TEST_NPM_CLI.
const FAKE_NPM = path.join(TMP, 'fake-npm.cjs');
fs.writeFileSync(FAKE_NPM, [
  "'use strict';",
  "const fs = require('fs');",
  "const path = require('path');",
  "const mode = process.env.FAKE_NPM_MODE || 'ok-link';",
  'const args = process.argv.slice(2);',
  'if (process.env.FAKE_NPM_LOG) {',
  "  try { fs.appendFileSync(process.env.FAKE_NPM_LOG, JSON.stringify(args) + '\\n'); } catch (e) { /* ignore */ }",
  '}',
  "if (mode === 'fail') { process.stderr.write('npm ERR! simulated\\n'); process.exit(1); }",
  "if (mode === 'partial-slow') {",
  "  // An interrupted install: every dependency directory exists (so a naive presence probe passes) but is empty.",
  "  let deps = {};",
  "  try { deps = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')).dependencies || {}; } catch (e) { /* none */ }",
  "  for (const d of Object.keys(deps)) {",
  "    const dir = path.join(process.cwd(), 'node_modules', ...d.split('/'));",
  "    fs.mkdirSync(dir, { recursive: true });",
  "    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: d }));",
  "  }",
  "  setTimeout(() => process.exit(0), 60000);",
  "}",
  "else if (mode === 'slow') { setTimeout(() => process.exit(0), 60000); }",
  "else {",
  "  if (args[0] === 'ci' && !fs.existsSync(path.join(process.cwd(), 'npm-shrinkwrap.json')) && !fs.existsSync(path.join(process.cwd(), 'package-lock.json'))) {",
  "    process.stderr.write('npm ERR! ci needs a lockfile\\n'); process.exit(1);",
  '  }',
  "  const nm = path.join(process.cwd(), 'node_modules');",
  '  if (!fs.existsSync(nm)) fs.symlinkSync(' + JSON.stringify(path.join(REPO_ROOT, 'node_modules')) + ", nm, 'dir');",
  '  process.exit(0);',
  '}',
  '',
].join('\n'));

// The recording wrapper for the real-npm arm: log argv, then run the real npm-cli.js.
const RECORD_NPM = path.join(TMP, 'record-npm.cjs');
fs.writeFileSync(RECORD_NPM, [
  "'use strict';",
  "const fs = require('fs');",
  "const path = require('path');",
  'const args = process.argv.slice(2);',
  'if (process.env.FAKE_NPM_LOG) {',
  "  try { fs.appendFileSync(process.env.FAKE_NPM_LOG, JSON.stringify(args) + '\\n'); } catch (e) { /* ignore */ }",
  '}',
  'const nodeBin = path.dirname(process.execPath);',
  'const cands = [',
  "  path.join(nodeBin, 'node_modules', 'npm', 'bin', 'npm-cli.js'),",
  "  path.join(nodeBin, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),",
  "  path.join(nodeBin, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js'),",
  '];',
  'const real = cands.find((c) => fs.existsSync(c));',
  "if (!real) { process.stderr.write('record-npm: no real npm-cli.js found\\n'); process.exit(127); }",
  'process.argv = [process.argv[0], real].concat(args);',
  "require(real);",
  '',
].join('\n'));

function runNode(code, args, env, timeoutMs) {
  return spawnSync(process.execPath, ['-e', code].concat(args || []), {
    env, encoding: 'utf8', timeout: timeoutMs || 60000, cwd: TMP,
  });
}
function parseJsonOut(r, what) {
  if (r.error) throw new Error(what + ': ' + r.error.message);
  const text = String(r.stdout || '').trim().split('\n').pop();
  try { return JSON.parse(text); } catch (_e) {
    throw new Error(what + ' printed no JSON (status ' + r.status + '): ' + String((r.stderr || '') + (r.stdout || '')).trim().split('\n').slice(-2).join(' | ').slice(0, 300));
  }
}
function readLog(logPath) {
  try {
    return fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch (_e) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Scratch plugin from npm pack (never an install in the repo root)
// ---------------------------------------------------------------------------
let packTgz = null;
function haveCmd(cmd) {
  const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
  return !r.error && r.status === 0;
}
function ensurePack() {
  if (packTgz) return packTgz;
  if (!haveCmd('npm')) throw Object.assign(new Error('npm is not on PATH'), { envGap: true });
  if (!haveCmd('tar')) throw Object.assign(new Error('tar is not on PATH'), { envGap: true });
  const dest = mkTemp('pack');
  const r = spawnSync('npm', ['pack', '--pack-destination', dest, '--ignore-scripts', '--silent'], {
    cwd: REPO_ROOT, encoding: 'utf8', timeout: 180000, env: hermeticEnv({}),
  });
  if (r.error || r.status !== 0) {
    throw new Error('npm pack failed: ' + String(r.error ? r.error.message : (r.stderr || '').trim().split('\n').slice(-1)[0]));
  }
  const tgz = fs.readdirSync(dest).find((f) => f.endsWith('.tgz'));
  if (!tgz) throw new Error('npm pack produced no tarball');
  packTgz = path.join(dest, tgz);
  return packTgz;
}
function makeScratch(label) {
  const tgz = ensurePack();
  const dir = mkTemp('plugin-' + label);
  const r = spawnSync('tar', ['-xzf', tgz, '-C', dir, '--strip-components=1'], { encoding: 'utf8', timeout: 120000 });
  if (r.error || r.status !== 0) throw new Error('tar extract failed: ' + String(r.stderr || (r.error && r.error.message)).slice(0, 200));
  if (fs.existsSync(path.join(dir, 'node_modules'))) throw new Error('scratch plugin unexpectedly carries node_modules');
  return dir;
}
function readMcpEntries(root, pluginRoot) {
  const mcp = JSON.parse(fs.readFileSync(path.join(root, '.mcp.json'), 'utf8'));
  const out = {};
  for (const name of Object.keys(SERVERS)) {
    const e = mcp.mcpServers && mcp.mcpServers[name];
    if (!e) throw new Error('.mcp.json has no ' + name + ' entry');
    out[name] = {
      command: e.command === 'node' ? process.execPath : e.command,
      args: (e.args || []).map((a) => String(a).split('${CLAUDE_PLUGIN_ROOT}').join(pluginRoot)),
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// MCP clients (v2 SDK from the repo's node_modules)
// ---------------------------------------------------------------------------
let sdk = null;
function loadSdk() {
  if (sdk) return sdk;
  try {
    const req = createRequire(path.join(REPO_ROOT, 'package.json'));
    sdk = {
      Client: req('@modelcontextprotocol/client').Client,
      StdioClientTransport: req('@modelcontextprotocol/client/stdio').StdioClientTransport,
    };
  } catch (e) {
    throw Object.assign(new Error('@modelcontextprotocol/client not loadable: ' + e.message), { envGap: true });
  }
  return sdk;
}
const ERAS = [
  { id: '2025-default', options: {} },
  { id: 'auto', options: { versionNegotiation: { mode: 'auto' } } },
];
async function connectServer(spec, env, cwd, eraOptions, budgetMs) {
  const { Client, StdioClientTransport } = loadSdk();
  const transport = new StdioClientTransport({ command: spec.command, args: spec.args, env, cwd, stderr: 'ignore' });
  const client = new Client({ name: 'test-369.1-dep-self-install', version: '1' }, eraOptions || {});
  const t0 = Date.now();
  try {
    await withTimeout(client.connect(transport), budgetMs || 25000, 'initialize');
  } catch (e) {
    try { await client.close(); } catch (_e) { /* best effort */ }
    throw e;
  }
  return { client, transport, ms: Date.now() - t0 };
}
async function closeConn(conn) {
  try { await conn.client.close(); } catch (_e) { /* best effort */ }
  if (conn && conn.transport && typeof conn.transport.pid === 'number') {
    try { process.kill(conn.transport.pid, 'SIGKILL'); } catch (_e) { /* gone */ }
  }
}
function textOf(result) {
  return (result && result.content ? result.content : []).map((c) => c && c.text).filter((t) => typeof t === 'string').join('\n');
}

// A raw newline-delimited JSON-RPC exchange (SDK independent).
function rawSession(spec, env, cwd, requests, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(spec.command, spec.args, { env, cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    const wanted = new Set(requests.filter((r) => r.id !== undefined).map((r) => r.id));
    const got = {};
    let buf = '';
    let done = false;
    const finish = (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { child.kill('SIGKILL'); } catch (_e) { /* gone */ }
      if (err) reject(err); else resolve(got);
    };
    const timer = setTimeout(() => finish(new Error('raw session timed out; answered ids: ' + Object.keys(got).join(',') + ' of ' + Array.from(wanted).join(','))), timeoutMs || 20000);
    child.on('error', (e) => finish(e));
    child.stdout.on('data', (d) => {
      buf += d.toString('utf8');
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch (_e) { continue; }
        if (msg && msg.id !== undefined && msg.id !== null) got[msg.id] = msg;
        if (Array.from(wanted).every((id) => got[id] !== undefined)) finish();
      }
    });
    child.stderr.on('data', () => { /* drained */ });
    for (const r of requests) child.stdin.write(JSON.stringify(Object.assign({ jsonrpc: '2.0' }, r)) + '\n');
  });
}

// Ground truth: the tool names the real servers serve from the repo itself.
const truth = {};
async function groundTruth(name) {
  if (truth[name]) return truth[name];
  const entries = readMcpEntries(REPO_ROOT, REPO_ROOT);
  const env = hermeticEnv({ CLAUDE_PLUGIN_ROOT: REPO_ROOT });
  const conn = await connectServer(entries[name], env, mkTemp('cwd'), {}, 60000);
  try {
    const { tools } = await conn.client.listTools();
    truth[name] = tools.map((t) => t.name).sort();
  } finally {
    await closeConn(conn);
  }
  return truth[name];
}

async function assertToolSetIsStatusOrFull(name, tools, want) {
  const names = tools.map((t) => t.name).sort();
  const spec = SERVERS[name];
  const full = await groundTruth(name);
  const isStatus = names.length === 1 && names[0] === spec.statusTool;
  const isFull = JSON.stringify(names) === JSON.stringify(full);
  assert.ok(isStatus || isFull, name + ' served neither exactly [' + spec.statusTool + '] nor its full toolset (' + full.length + '); got ' + names.length + ' tools: ' + names.slice(0, 6).join(','));
  if (want === 'status') assert.ok(isStatus, name + ' must serve exactly the one status tool ' + spec.statusTool + ' here; got ' + names.slice(0, 6).join(','));
  if (want === 'full') {
    assert.ok(isFull, name + ' must serve its full toolset (' + full.length + ' tools) here; got ' + names.slice(0, 6).join(','));
    assert.ok(names.includes(spec.mustHave), name + ' must list ' + spec.mustHave);
    assert.ok(!names.some((n) => n.endsWith('_install_status')), name + ' must not list a *_install_status tool once installed');
  }
  return { isStatus, isFull };
}

// ---------------------------------------------------------------------------
// Arm: unit
// ---------------------------------------------------------------------------
async function armUnit() {
  const A = 'unit';
  const childEnv = (mode, log, extra) => hermeticEnv(Object.assign({
    MINDRIAN_TEST_MODE: '1', MINDRIAN_TEST_NPM_CLI: FAKE_NPM, FAKE_NPM_MODE: mode, FAKE_NPM_LOG: log,
  }, extra || {}));

  await check(A, 'buildInstallArgs: frozen -> ci --ignore-scripts --no-audit --no-fund', () => {
    const { buildInstallArgs } = require(RESOLVE);
    const d = { baseArgs: ['/x/npm-cli.js'] };
    assert.deepEqual(buildInstallArgs(d, undefined, { frozen: true }), ['/x/npm-cli.js', 'ci', '--ignore-scripts', '--no-audit', '--no-fund']);
    assert.deepEqual(buildInstallArgs({ baseArgs: [] }, undefined, { frozen: true }), ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  });
  await check(A, 'buildInstallArgs: default and explicit shapes are unchanged', () => {
    const { buildInstallArgs } = require(RESOLVE);
    const d = { baseArgs: ['/x/npm-cli.js'] };
    assert.deepEqual(buildInstallArgs(d), ['/x/npm-cli.js', 'install', '--no-audit', '--no-fund', '--silent']);
    assert.deepEqual(buildInstallArgs(d, undefined, {}), ['/x/npm-cli.js', 'install', '--no-audit', '--no-fund', '--silent']);
    assert.deepEqual(buildInstallArgs(d, ['--omit=dev']), ['/x/npm-cli.js', 'install', '--omit=dev']);
    assert.deepEqual(buildInstallArgs(d, ['--omit=dev'], { frozen: true }), ['/x/npm-cli.js', 'install', '--omit=dev'], 'explicit installArgs stay install plus them even when frozen');
  });

  let seamOk = false;
  await check(A, 'MINDRIAN_TEST_NPM_CLI is honoured under MINDRIAN_TEST_MODE=1 (a JS path runs as npm-cli.js)', () => {
    const r = runNode("const m=require(process.argv[1]); process.stdout.write(JSON.stringify(m.resolveNpmCli()));", [RESOLVE], childEnv('ok-link', path.join(TMP, 'seam.log')));
    const d = parseJsonOut(r, 'resolveNpmCli');
    assert.equal(d.npmCli, FAKE_NPM, 'resolveNpmCli().npmCli');
    assert.deepEqual(d.baseArgs, [FAKE_NPM], 'baseArgs run the fake as npm-cli.js');
    seamOk = true;
  });
  await check(A, 'MINDRIAN_TEST_NPM_CLI is IGNORED when MINDRIAN_TEST_MODE is unset or not "1" (T-369.1-03-06)', () => {
    for (const mode of [undefined, '0', 'true']) {
      const env = childEnv('ok-link', path.join(TMP, 'seam.log'));
      delete env.MINDRIAN_TEST_MODE;
      if (mode !== undefined) env.MINDRIAN_TEST_MODE = mode;
      const r = runNode("const m=require(process.argv[1]); process.stdout.write(JSON.stringify(m.resolveNpmCli()));", [RESOLVE], env);
      const d = parseJsonOut(r, 'resolveNpmCli');
      assert.notEqual(d.npmCli, FAKE_NPM, 'the seam must not apply with MINDRIAN_TEST_MODE=' + String(mode));
      assert.ok(!(d.baseArgs || []).includes(FAKE_NPM), 'baseArgs must not carry the fake with MINDRIAN_TEST_MODE=' + String(mode));
    }
  });
  await check(A, 'a MINDRIAN_TEST_NPM_CLI path that does not exist yields a spawn that fails with ENOENT', () => {
    const missing = path.join(TMP, 'no-such-npm-cli.js');
    const env = childEnv('ok-link', path.join(TMP, 'seam.log'), { MINDRIAN_TEST_NPM_CLI: missing });
    const code = [
      "const cp=require('child_process'); const m=require(process.argv[1]);",
      'const d=m.resolveNpmCli();',
      "const r=cp.spawnSync(d.command, d.baseArgs.concat(['--version']), {shell:d.shell, encoding:'utf8'});",
      "process.stdout.write(JSON.stringify({code: r.error ? r.error.code : null, status: r.status}));",
    ].join('');
    const d = parseJsonOut(runNode(code, [RESOLVE], env), 'missing-seam spawn');
    assert.equal(d.code, 'ENOENT');
  });
  await check(A, 'MINDRIAN_TEST_CONNECT_BUDGET_MS overrides the connect budget only under MINDRIAN_TEST_MODE=1', () => {
    const code = "const h=require(process.argv[1]); h.beginConnectPathBudget(); process.stdout.write(JSON.stringify({left:h.connectPathRemainingMs()}));";
    const on = parseJsonOut(runNode(code, [HEAL], childEnv('ok-link', path.join(TMP, 'b.log'), { MINDRIAN_TEST_CONNECT_BUDGET_MS: '1234' })), 'budget on');
    assert.ok(on.left > 0 && on.left <= 1234, 'with the seam on, remaining must be <= 1234, got ' + on.left);
    const env = childEnv('ok-link', path.join(TMP, 'b.log'), { MINDRIAN_TEST_CONNECT_BUDGET_MS: '1234' });
    delete env.MINDRIAN_TEST_MODE;
    const off = parseJsonOut(runNode(code, [HEAL], env), 'budget off');
    assert.ok(off.left > 10000, 'without MINDRIAN_TEST_MODE the override must be ignored, remaining ' + off.left);
  });

  const guardedCode = "const h=require(process.argv[1]); const r=h.runGuardedInstall(process.argv[2], {timeoutMs: Number(process.argv[3])}); process.stdout.write(JSON.stringify(r));";
  const need = (msg) => { if (!seamOk) throw new Error('skipped: ' + msg + ' (the MINDRIAN_TEST_NPM_CLI seam is missing, refusing to run the real npm)'); };

  await check(A, 'runGuardedInstall with npm-shrinkwrap.json present runs npm ci --ignore-scripts --no-audit --no-fund', () => {
    need('frozen install');
    const dir = mkTemp('unit-lock');
    fs.writeFileSync(path.join(dir, 'npm-shrinkwrap.json'), '{}\n');
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"x","version":"1.0.0"}\n');
    const log = path.join(TMP, 'unit-frozen.log');
    const r = parseJsonOut(runNode(guardedCode, [HEAL, dir, '20000'], childEnv('ok-link', log)), 'runGuardedInstall');
    assert.deepEqual(readLog(log), [['ci', '--ignore-scripts', '--no-audit', '--no-fund']], 'recorded npm argv');
    assert.equal(r.ran, true);
    assert.equal(r.ok, true);
    assert.equal(r.reason, null, 'reason is null on success');
  });
  await check(A, 'runGuardedInstall without any lockfile runs npm install --no-audit --no-fund --silent', () => {
    need('plain install');
    const dir = mkTemp('unit-nolock');
    fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"x","version":"1.0.0"}\n');
    const log = path.join(TMP, 'unit-plain.log');
    const r = parseJsonOut(runNode(guardedCode, [HEAL, dir, '20000'], childEnv('ok-link', log)), 'runGuardedInstall');
    assert.deepEqual(readLog(log), [['install', '--no-audit', '--no-fund', '--silent']], 'recorded npm argv');
    assert.equal(r.ok, true);
    assert.equal(r.reason, null);
  });
  await check(A, 'runGuardedInstall reports reason exit-1, timeout and npm-not-found', () => {
    need('reasons');
    const mk = () => {
      const dir = mkTemp('unit-reason');
      fs.writeFileSync(path.join(dir, 'npm-shrinkwrap.json'), '{}\n');
      return dir;
    };
    const failR = parseJsonOut(runNode(guardedCode, [HEAL, mk(), '20000'], childEnv('fail', path.join(TMP, 'r1.log'))), 'fail');
    assert.equal(failR.ok, false, 'fail: ok');
    assert.equal(failR.reason, 'exit-1', 'fail: reason');
    const slowR = parseJsonOut(runNode(guardedCode, [HEAL, mk(), '1500'], childEnv('slow', path.join(TMP, 'r2.log'))), 'slow');
    assert.equal(slowR.ok, false, 'slow: ok');
    assert.equal(slowR.reason, 'timeout', 'slow: reason');
    const absentR = parseJsonOut(runNode(guardedCode, [HEAL, mk(), '20000'], childEnv('ok-link', path.join(TMP, 'r3.log'), { MINDRIAN_TEST_NPM_CLI: path.join(TMP, 'missing-npm.js') })), 'absent');
    assert.equal(absentR.ok, false, 'absent: ok');
    assert.equal(absentR.reason, 'npm-not-found', 'absent: reason');
  });
  sweep();
}

// ---------------------------------------------------------------------------
// Arm: responder-module
// ---------------------------------------------------------------------------
async function armResponder() {
  const A = 'responder-module';
  let mod = null;
  const present = await check(A, 'lib/core/mcp-install-responder.cjs exists and exports the pinned API', () => {
    assert.ok(fs.existsSync(RESPONDER), 'lib/core/mcp-install-responder.cjs is missing');
    mod = require(RESPONDER);
    for (const f of ['serveInstallingResponder', 'installStatusLine', 'statusFilePath']) {
      assert.equal(typeof mod[f], 'function', 'export ' + f + ' is not a function');
    }
    assert.deepEqual(mod.STATUS_TOOL_NAMES, { 'mindrian-os': 'mos_install_status', 'mindrian-brain': 'brain_install_status' });
  });
  if (!present) return;

  await check(A, 'statusFilePath is <home>/.mindrian/run/dep-install-<12 hex of sha256(normalised root)>.json', () => {
    const root = mkTemp('some-plugin-root');
    const r = runNode("process.stdout.write(JSON.stringify(require(process.argv[1]).statusFilePath(process.argv[2])));", [RESPONDER, root], hermeticEnv({}));
    assert.equal(parseJsonOut(r, 'statusFilePath'), expectedStatusFile(root));
  });
  await check(A, 'installStatusLine: installing, failed and npm-not-found name the state and a fix, hyphens only', () => {
    const lines = {
      installing: mod.installStatusLine({ state: 'installing', startedAt: new Date().toISOString(), pid: 1, pluginRoot: TMP }, 'mindrian-os'),
      failed: mod.installStatusLine({ state: 'failed', reason: 'exit-1', startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), pid: 1, pluginRoot: TMP }, 'mindrian-os'),
      noNpm: mod.installStatusLine({ state: 'npm-not-found', reason: 'npm-not-found', startedAt: new Date().toISOString(), pid: 1, pluginRoot: TMP }, 'mindrian-brain'),
    };
    for (const k of Object.keys(lines)) {
      assert.equal(typeof lines[k], 'string', k + ' line is a string');
      assert.ok(lines[k].length > 20, k + ' line is too short to be an explanation');
      assert.ok(!LONG_DASHES.test(lines[k]), k + ' line carries an em-dash or en-dash');
    }
    assert.ok(/installing its packages/i.test(lines.installing), 'installing line must say "installing its packages"');
    assert.ok(/failed/i.test(lines.failed) && lines.failed.includes('exit-1'), 'failed line must say failed and carry the reason exit-1');
    assert.ok(lines.failed.includes('Fix:'), 'failed line must carry "Fix:"');
    assert.ok(/npm[^\n]{0,60}not found|not found[^\n]{0,60}npm/i.test(lines.noNpm), 'npm-not-found line must say npm was not found');
    assert.ok(lines.noNpm.includes('Fix:'), 'npm-not-found line must carry "Fix:"');
  });

  const responderCode = "const r=require(process.argv[1]); r.serveInstallingResponder({serverName:process.argv[2], version:'0.0.0-test', pluginRoot:process.argv[3], status:JSON.parse(process.argv[4])});";
  for (const name of Object.keys(SERVERS)) {
    for (const era of ERAS) {
      await check(A, name + ' on era ' + era.id + ': initialize, exactly one status tool, honest text, ping', async () => {
        const root = mkTemp('responder-root');
        const status = { state: 'installing', startedAt: new Date().toISOString(), pid: process.pid, pluginRoot: root };
        const spec = { command: process.execPath, args: ['-e', responderCode, RESPONDER, name, root, JSON.stringify(status)] };
        const env = hermeticEnv({});
        const conn = await connectServer(spec, env, TMP, era.options, 25000);
        try {
          console.log('    negotiated ' + conn.client.getNegotiatedProtocolVersion() + ' (era ' + conn.client.getProtocolEra() + ') in ' + conn.ms + ' ms');
          const { tools } = await conn.client.listTools();
          assert.deepEqual(tools.map((t) => t.name), [SERVERS[name].statusTool], 'tools/list');
          assert.equal(tools[0].inputSchema && tools[0].inputSchema.type, 'object', 'the status tool needs an object inputSchema');
          const res = await conn.client.callTool({ name: SERVERS[name].statusTool, arguments: {} });
          const text = textOf(res);
          assert.ok(text.includes('installing its packages'), 'tools/call text must say "installing its packages", got: ' + text.slice(0, 160));
          assert.ok(!LONG_DASHES.test(text), 'tools/call text carries an em-dash or en-dash');
          await conn.client.ping();
        } finally {
          await closeConn(conn);
        }
      });
    }
    await check(A, name + ' raw JSON-RPC: initialize, tools/list, tools/call, ping answer; an unknown method gets an error, not silence', async () => {
      const root = mkTemp('responder-raw');
      const status = { state: 'installing', startedAt: new Date().toISOString(), pid: process.pid, pluginRoot: root };
      const spec = { command: process.execPath, args: ['-e', responderCode, RESPONDER, name, root, JSON.stringify(status)] };
      const got = await rawSession(spec, hermeticEnv({}), TMP, [
        { id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'raw', version: '1' } } },
        { method: 'notifications/initialized' },
        { id: 2, method: 'tools/list', params: {} },
        { id: 3, method: 'tools/call', params: { name: SERVERS[name].statusTool, arguments: {} } },
        { id: 4, method: 'ping' },
        { id: 5, method: 'no/such/method', params: {} },
      ], 20000);
      assert.ok(got[1] && got[1].result, 'initialize has a result');
      assert.equal(typeof got[1].result.protocolVersion, 'string', 'initialize carries a protocolVersion');
      assert.equal(got[1].result.serverInfo && got[1].result.serverInfo.name, name, 'serverInfo.name');
      assert.ok(got[1].result.capabilities && got[1].result.capabilities.tools, 'capabilities.tools declared');
      assert.deepEqual((got[2].result.tools || []).map((t) => t.name), [SERVERS[name].statusTool], 'raw tools/list');
      assert.ok(textOf(got[3].result).includes('installing its packages'), 'raw tools/call text');
      assert.ok(got[4] && got[4].result && !got[4].error, 'ping answers with a result');
      assert.ok(got[5] && got[5].error && typeof got[5].error.code === 'number', 'an unknown method must get a JSON-RPC error');
    });
  }
  sweep();
}

// ---------------------------------------------------------------------------
// Arm: detached
// ---------------------------------------------------------------------------
async function pollUntil(fn, timeoutMs, stepMs) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(stepMs || 100);
  }
}
function detachedPlugin(label) {
  const dir = mkTemp(label);
  fs.writeFileSync(path.join(dir, 'npm-shrinkwrap.json'), '{}\n');
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"scratch","version":"1.0.0","dependencies":{}}\n');
  return dir;
}
function startDetachedIn(dir, mode, log) {
  const env = hermeticEnv({ MINDRIAN_TEST_MODE: '1', MINDRIAN_TEST_NPM_CLI: FAKE_NPM, FAKE_NPM_MODE: mode, FAKE_NPM_LOG: log });
  const code = "const h=require(process.argv[1]); const r=h.startDetachedInstall(process.argv[2]); process.stdout.write(JSON.stringify(r)); setTimeout(()=>process.exit(0),200);";
  return parseJsonOut(runNode(code, [HEAL, dir], env), 'startDetachedInstall');
}
async function armDetached() {
  const A = 'detached';
  const seam = (() => {
    const r = runNode("const m=require(process.argv[1]); process.stdout.write(JSON.stringify(m.resolveNpmCli()));", [RESOLVE],
      hermeticEnv({ MINDRIAN_TEST_MODE: '1', MINDRIAN_TEST_NPM_CLI: FAKE_NPM }));
    try { return parseJsonOut(r, 'seam').npmCli === FAKE_NPM; } catch (_e) { return false; }
  })();
  const needSeam = () => {
    if (!seam) throw new Error('the MINDRIAN_TEST_NPM_CLI seam is missing; refusing to start a detached install against the real npm');
  };
  const hasApi = () => {
    assert.ok(fs.existsSync(DETACHED), 'lib/core/dep-install-detached.cjs is missing');
    assert.equal(typeof require(HEAL).startDetachedInstall, 'function', 'mcp-dep-heal.cjs does not export startDetachedInstall');
  };

  await check(A, 'ok-link: startDetachedInstall starts, the status file reaches done within 20 s, the lock is released, the installer exits', async () => {
    hasApi();
    needSeam();
    const dir = detachedPlugin('detached-ok');
    const log = path.join(TMP, 'detached-ok.log');
    const r = startDetachedIn(dir, 'ok-link', log);
    assert.equal(r.started, true, 'started');
    assert.equal(typeof r.pid, 'number', 'pid');
    assert.equal(r.statusFile, expectedStatusFile(dir), 'statusFile path');
    const st = await pollUntil(() => { const s = readStatus(dir); return s && s.state === 'done' ? s : (s && s.state === 'failed' ? s : null); }, 20000, 100);
    assert.ok(st, 'no terminal status within 20 s');
    assert.equal(st.state, 'done', 'state (reason ' + st.reason + ')');
    assert.ok(!('pluginRoot' in st), 'the record must not store the plugin path (369.1-REVIEW CR-01)');
    assert.equal(typeof st.startedAt === 'string' || typeof st.startedAt === 'number', true, 'status.startedAt');
    assert.ok(st.finishedAt, 'status.finishedAt');
    assert.deepEqual(readLog(log), [['ci', '--ignore-scripts', '--no-audit', '--no-fund']], 'the detached install runs the frozen argv');
    assert.equal(fs.existsSync(path.join(dir, LOCK_NAME)), false, 'the install lock must be released');
    assert.ok(fs.existsSync(path.join(dir, 'node_modules')), 'node_modules was installed');
    const gone = await pollUntil(() => !isAlive(r.pid), 5000, 100);
    assert.ok(gone, 'the detached installer pid ' + r.pid + ' must exit once done');
  });
  await check(A, 'slow: a second startDetachedInstall while one holds the lock returns started false', async () => {
    hasApi();
    needSeam();
    const dir = detachedPlugin('detached-slow');
    const log = path.join(TMP, 'detached-slow.log');
    const first = startDetachedIn(dir, 'slow', log);
    assert.equal(first.started, true, 'first started');
    const locked = await pollUntil(() => fs.existsSync(path.join(dir, LOCK_NAME)), 10000, 100);
    assert.ok(locked, 'the first install must take the lock');
    const second = startDetachedIn(dir, 'slow', log);
    assert.equal(second.started, false, 'a second install must not start while one holds the lock');
    const st = readStatus(dir);
    assert.ok(st && st.state === 'installing', 'status stays installing, got ' + (st && st.state));
    assert.equal(typeof st.pid, 'number', 'status.pid');
    assert.ok(cmdlineOf(st.pid).includes('dep-install-detached.cjs'), 'status.pid is the detached installer');
    assert.ok(readLog(log).length <= 1, 'npm ran at most once, ran ' + readLog(log).length + ' times');
    sweep();
  });
  await check(A, 'fail: the status reaches failed with reason exit-1', async () => {
    hasApi();
    needSeam();
    const dir = detachedPlugin('detached-fail');
    const log = path.join(TMP, 'detached-fail.log');
    const r = startDetachedIn(dir, 'fail', log);
    assert.equal(r.started, true, 'started');
    const st = await pollUntil(() => { const s = readStatus(dir); return s && (s.state === 'failed' || s.state === 'done') ? s : null; }, 20000, 100);
    assert.ok(st, 'no terminal status within 20 s');
    assert.equal(st.state, 'failed', 'state');
    assert.equal(st.reason, 'exit-1', 'reason');
    assert.equal(fs.existsSync(path.join(dir, LOCK_NAME)), false, 'the install lock must be released after a failure');
  });
  sweep();
}

// ---------------------------------------------------------------------------
// Arm: entries
// ---------------------------------------------------------------------------
function entryEnv(scratch, mode, log, extra) {
  return hermeticEnv(Object.assign({
    CLAUDE_PLUGIN_ROOT: scratch,
    MINDRIAN_TEST_MODE: '1',
    MINDRIAN_TEST_NPM_CLI: FAKE_NPM,
    MINDRIAN_TEST_CONNECT_BUDGET_MS: '3000',
    FAKE_NPM_MODE: mode,
    FAKE_NPM_LOG: log,
  }, extra || {}));
}
async function connectBoth(entries, env, eraOptions) {
  const names = Object.keys(SERVERS);
  const conns = await Promise.all(names.map((n) => connectServer(entries[n], env, mkTemp('cwd'), eraOptions, 25000).then((c) => ({ n, c }))));
  const out = {};
  for (const { n, c } of conns) out[n] = c;
  return out;
}
async function closeAll(conns) {
  for (const n of Object.keys(conns || {})) await closeConn(conns[n]);
}
async function armEntries() {
  const A = 'entries';
  const seamOk = (() => {
    const r = runNode("const m=require(process.argv[1]); process.stdout.write(JSON.stringify(m.resolveNpmCli()));", [RESOLVE],
      hermeticEnv({ MINDRIAN_TEST_MODE: '1', MINDRIAN_TEST_NPM_CLI: FAKE_NPM }));
    try { return parseJsonOut(r, 'seam').npmCli === FAKE_NPM; } catch (_e) { return false; }
  })();
  if (!seamOk) {
    fail(A, 'prerequisite', 'the MINDRIAN_TEST_NPM_CLI seam is missing in lib/core/npm-cli-resolve.cjs, so the entries cannot be driven without the real npm (arm not run)');
    return;
  }

  const slowScenario = async (label, mode, eras) => {
    const scratch = makeScratch(label);
    const log = path.join(TMP, 'entries-' + label + '.log');
    const entries = readMcpEntries(scratch, scratch);
    const env = entryEnv(scratch, mode, log);
    for (const era of eras) {
      const conns = await connectBoth(entries, env, era.options);
      try {
        for (const n of Object.keys(SERVERS)) {
          const { tools } = await conns[n].client.listTools();
          await assertToolSetIsStatusOrFull(n, tools, 'status');
          const text = textOf(await conns[n].client.callTool({ name: SERVERS[n].statusTool, arguments: {} }));
          assert.ok(text.includes('installing its packages'), n + ' status text must say "installing its packages", got: ' + text.slice(0, 160));
          console.log('    ' + n + ' era ' + era.id + ': negotiated ' + conns[n].client.getNegotiatedProtocolVersion() + ', initialize in ' + conns[n].ms + ' ms');
        }
      } finally {
        await closeAll(conns);
      }
    }
    const st = readStatus(scratch);
    assert.ok(st && st.state === 'installing', 'status file must record state installing, got ' + (st && st.state));
    assert.equal(typeof st.pid, 'number', 'status.pid');
    assert.ok(isAlive(st.pid), 'the detached installer pid ' + st.pid + ' must be alive while the install runs');
    assert.ok(cmdlineOf(st.pid).includes('dep-install-detached.cjs'), 'status.pid must be the detached installer');
    assert.ok(!cmdlineOf(st.pid).includes('mindrian-mcp-server') && !cmdlineOf(st.pid).includes('mindrian-brain-mcp-client'), 'the installer must not be a server process');
    sweep();
  };
  await check(A, 'slow, both eras: both servers answer within 25 s with exactly their one status tool; the detached installer pid is recorded', () => slowScenario('slow', 'slow', ERAS));
  await check(A, 'interrupted install (every dependency dir present but empty), connected twice: the servers still answer with exactly their status tool on the restart, never crash or hang', () => slowScenario('partial', 'partial-slow', [ERAS[0], ERAS[0]]));

  await check(A, 'fail: the status tool text names the failure and the fix', async () => {
    const scratch = makeScratch('fail');
    const log = path.join(TMP, 'entries-fail.log');
    const entries = readMcpEntries(scratch, scratch);
    const env = entryEnv(scratch, 'fail', log);
    const first = await connectBoth(entries, env, {});
    await closeAll(first);
    const st = await pollUntil(() => { const s = readStatus(scratch); return s && s.state === 'failed' ? s : null; }, 25000, 200);
    assert.ok(st, 'the status file must reach failed');
    assert.equal(st.reason, 'exit-1', 'status.reason');
    const conns = await connectBoth(entries, env, {});
    try {
      for (const n of Object.keys(SERVERS)) {
        const { tools } = await conns[n].client.listTools();
        await assertToolSetIsStatusOrFull(n, tools, 'status');
        const text = textOf(await conns[n].client.callTool({ name: SERVERS[n].statusTool, arguments: {} }));
        assert.ok(/failed/i.test(text) && text.includes('exit-1'), n + ' text must name the failure (failed, exit-1), got: ' + text.slice(0, 200));
        assert.ok(text.includes('Fix:'), n + ' text must carry "Fix:"');
        assert.ok(!LONG_DASHES.test(text), n + ' text carries an em-dash or en-dash');
      }
    } finally {
      await closeAll(conns);
    }
    sweep();
  });

  await check(A, 'absent npm: the status tool text says npm was not found and names the fix', async () => {
    const scratch = makeScratch('absent');
    const log = path.join(TMP, 'entries-absent.log');
    const entries = readMcpEntries(scratch, scratch);
    const env = entryEnv(scratch, 'ok-link', log, { MINDRIAN_TEST_NPM_CLI: path.join(TMP, 'no-such-npm-cli.js') });
    const first = await connectBoth(entries, env, {});
    await closeAll(first);
    const st = await pollUntil(() => { const s = readStatus(scratch); return s && s.state === 'npm-not-found' ? s : null; }, 25000, 200);
    assert.ok(st, 'the status file must reach npm-not-found');
    const conns = await connectBoth(entries, env, {});
    try {
      for (const n of Object.keys(SERVERS)) {
        const { tools } = await conns[n].client.listTools();
        await assertToolSetIsStatusOrFull(n, tools, 'status');
        const text = textOf(await conns[n].client.callTool({ name: SERVERS[n].statusTool, arguments: {} }));
        assert.ok(/npm[^\n]{0,60}not found|not found[^\n]{0,60}npm/i.test(text), n + ' text must say npm was not found, got: ' + text.slice(0, 200));
        assert.ok(text.includes('Fix:'), n + ' text must carry "Fix:"');
        assert.ok(!LONG_DASHES.test(text), n + ' text carries an em-dash or en-dash');
      }
    } finally {
      await closeAll(conns);
    }
    sweep();
  });

  await check(A, 'ok-link, both eras: both servers serve their full toolset (never partial), no *_install_status tool, npm ci --ignore-scripts was the install', async () => {
    const scratch = makeScratch('oklink');
    const log = path.join(TMP, 'entries-ok.log');
    const entries = readMcpEntries(scratch, scratch);
    const env = entryEnv(scratch, 'ok-link', log);
    for (const era of ERAS) {
      const conns = await connectBoth(entries, env, era.options);
      try {
        for (const n of Object.keys(SERVERS)) {
          const { tools } = await conns[n].client.listTools();
          let verdict = await assertToolSetIsStatusOrFull(n, tools, null);
          if (verdict.isStatus) {
            // The install may still be settling on the very first connection; a fresh connection must be full.
            await pollUntil(() => { const s = readStatus(scratch); return s && s.state === 'done' ? s : null; }, 20000, 200);
            const again = await connectServer(entries[n], env, mkTemp('cwd'), era.options, 25000);
            try {
              const t2 = (await again.client.listTools()).tools;
              verdict = await assertToolSetIsStatusOrFull(n, t2, 'full');
            } finally {
              await closeConn(again);
            }
          } else {
            await assertToolSetIsStatusOrFull(n, tools, 'full');
          }
          console.log('    ' + n + ' era ' + era.id + ': full toolset (' + tools.length + ' tools on first connect), initialize in ' + conns[n].ms + ' ms');
        }
      } finally {
        await closeAll(conns);
      }
    }
    const lines = readLog(log);
    assert.ok(lines.length >= 1, 'the fake npm must have been invoked at least once');
    for (const a of lines) {
      assert.equal(a[0], 'ci', 'every install must be npm ci, saw ' + JSON.stringify(a));
      assert.ok(a.includes('--ignore-scripts'), 'every install must pass --ignore-scripts, saw ' + JSON.stringify(a));
    }
    const settled = await pollUntil(() => !rootProcesses().some((p) => p.cmdline.includes('dep-install-detached.cjs') && isAlive(p.pid)), 8000, 200);
    assert.ok(settled, 'no detached installer may survive once the install is done');
    sweep();
  });
  sweep();
}

// ---------------------------------------------------------------------------
// Arm: real-npm (live)
// ---------------------------------------------------------------------------
function registryPingOnce() {
  return new Promise((resolve) => {
    const req = https.get('https://registry.npmjs.org/-/ping', { timeout: 15000 }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}
// Three attempts: a transient network hiccup right after heavy npm traffic is not an environment gap.
async function registryPing() {
  for (let i = 0; i < 3; i += 1) {
    if (await registryPingOnce()) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}
async function armRealNpm() {
  const A = 'real-npm';
  if (!(await registryPing())) {
    envGap = envGap || 'registry unreachable';
    console.log('ENV GAP: registry unreachable');
    return;
  }
  // Never let an entry run the real npm without the recording seam: that would run lifecycle scripts
  // (T-369.1-03-03) and skip the argv assertion. Without the seam the arm fails fast instead.
  const seam = (() => {
    const r = runNode("const m=require(process.argv[1]); process.stdout.write(JSON.stringify(m.resolveNpmCli()));", [RESOLVE],
      hermeticEnv({ MINDRIAN_TEST_MODE: '1', MINDRIAN_TEST_NPM_CLI: RECORD_NPM }));
    try { return parseJsonOut(r, 'seam').npmCli === RECORD_NPM; } catch (_e) { return false; }
  })();
  if (!seam) {
    fail(A, 'prerequisite', 'the MINDRIAN_TEST_NPM_CLI seam is missing in lib/core/npm-cli-resolve.cjs, so the real npm cannot be recorded or kept to --ignore-scripts (arm not run)');
    return;
  }
  await check(A, 'a fresh scratch plugin self-installs with the real npm ci --ignore-scripts: status tool first, then the full toolset', async () => {
    const scratch = makeScratch('real');
    const log = path.join(TMP, 'real-npm.log');
    const entries = readMcpEntries(scratch, scratch);
    const shared = process.env.MOS_3691_NPM_CACHE === 'shared';
    // A 4 s connect budget is shorter than any real npm ci (measured 3.8 s warm to 13.3 s cold on fast x64,
    // and the install here is cold), so the budget is exceeded for certain: the in-band path is exercised
    // with the REAL npm, including a real npm that must be stopped or left running without blocking the answer.
    const env = hermeticEnv({
      CLAUDE_PLUGIN_ROOT: scratch,
      MINDRIAN_TEST_MODE: '1',
      MINDRIAN_TEST_NPM_CLI: RECORD_NPM,
      MINDRIAN_TEST_CONNECT_BUDGET_MS: '4000',
      FAKE_NPM_LOG: log,
      npm_config_registry: 'https://registry.npmjs.org/',
      npm_config_cache: shared ? path.join(os.homedir(), '.npm') : mkTemp('real-npm-cache'),
    });
    // Ground truth first (from the repo), so the clock measures only the install.
    const full = await groundTruth('mindrian-os');
    const t0 = Date.now();
    const conn = await connectServer(entries['mindrian-os'], env, mkTemp('cwd'), {}, 25000);
    let firstText = '';
    try {
      const { tools } = await conn.client.listTools();
      const names = tools.map((t) => t.name).sort();
      const v = await assertToolSetIsStatusOrFull('mindrian-os', tools, null);
      if (v.isStatus) firstText = textOf(await conn.client.callTool({ name: SERVERS['mindrian-os'].statusTool, arguments: {} }));
      else assert.deepEqual(names, full, 'full set');
      console.log('    first connection in ' + conn.ms + ' ms: ' + (v.isStatus ? 'the status tool' : 'the full toolset'));
    } finally {
      await closeConn(conn);
    }
    if (firstText) assert.ok(firstText.includes('installing its packages'), 'status text, got: ' + firstText.slice(0, 160));
    const st = await pollUntil(() => {
      const s2 = readStatus(scratch);
      return s2 && (s2.state === 'done' || s2.state === 'failed' || s2.state === 'npm-not-found') ? s2 : null;
    }, 180000, 500);
    assert.ok(st, 'the status file did not reach a terminal state within 180 s');
    assert.equal(st.state, 'done', 'install state (reason ' + st.reason + ')');
    const seconds = ((Date.now() - t0) / 1000).toFixed(1);
    const second = await connectServer(entries['mindrian-os'], env, mkTemp('cwd'), {}, 25000);
    try {
      const { tools } = await second.client.listTools();
      await assertToolSetIsStatusOrFull('mindrian-os', tools, 'full');
    } finally {
      await closeConn(second);
    }
    const lines = readLog(log);
    assert.ok(lines.length >= 1, 'the recording npm wrapper was never invoked');
    for (const a2 of lines) {
      assert.equal(a2[0], 'ci', 'the install must be npm ci, saw ' + JSON.stringify(a2));
      assert.ok(a2.includes('--ignore-scripts'), 'the install must pass --ignore-scripts, saw ' + JSON.stringify(a2));
    }
    assert.ok(!lines.some((a2) => a2.includes('install')), 'npm install must never run');
    const gone = await pollUntil(() => !rootProcesses().some((p) => isAlive(p.pid)), 8000, 200);
    assert.ok(gone, 'a process started by the install survived: ' + rootProcesses().map((p) => p.pid + ' ' + p.cmdline.slice(0, 60)).join(' | '));
    console.log('    measured ' + seconds + ' s to done (npm cache ' + (shared ? 'shared' : 'temp') + '); npm calls: ' + lines.length);
    sweep();
  });
  sweep();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function gitState() {
  const r = spawnSync('git', ['status', '--porcelain', '--', '.', ':(exclude).planning', ':(exclude)tests/e2e-369'], {
    cwd: REPO_ROOT, encoding: 'utf8', timeout: 60000,
  });
  return r.error ? 'git-unavailable' : String(r.stdout);
}

async function runArm(id, fn) {
  try {
    await fn();
  } catch (e) {
    if (e && e.envGap) {
      envGap = envGap || e.message;
      console.log('ENV GAP: ' + e.message + ' (arm ' + id + ')');
    } else {
      fail(id, 'arm', reasonOf(e));
    }
  }
}

async function main() {
  const gitBefore = gitState();
  const table = { unit: armUnit, 'responder-module': armResponder, detached: armDetached, entries: armEntries, 'real-npm': armRealNpm };
  for (const id of WANT) await runArm(id, table[id]);

  await check('hygiene', 'no process started by this test survives, and the repo is untouched', async () => {
    const survivors = rootProcesses().filter((p) => isAlive(p.pid));
    if (survivors.length) {
      sweep();
      throw new Error(survivors.length + ' process(es) survived: ' + survivors.slice(0, 3).map((p) => p.pid + ' ' + p.cmdline.slice(0, 80)).join(' | '));
    }
    assert.equal(gitState(), gitBefore, 'git status changed during the run');
  });

  cleanupAll();
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  if (failed > 0) process.exit(1);
  if (envGap) {
    console.log('ENV GAP: ' + envGap);
    process.exit(77);
  }
  process.exit(0);
}

main().catch((e) => {
  console.log('FAIL: harness main -- ' + reasonOf(e));
  cleanupAll();
  console.log('RESULT: PASS=' + passed + ' FAIL=' + (failed + 1));
  process.exit(1);
});
