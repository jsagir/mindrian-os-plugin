#!/usr/bin/env node
'use strict';

/*
 * Phase 369.1 plan 03 (DPI-07, D-05): the Claude Code CLI install, re-proven from the
 * SAME two-entry manifest the Desktop path uses.
 * ===================================================================================
 * The marketplace carries two entries for one plugin (DPI-01, D-02):
 *   plugins[0]  mos          npm source {source:"npm", package:"@mindrian_os/cli", version:<pin>}
 *   plugins[1]  mos-desktop  relative path ./plugins/mos-desktop, built from npm pack minus bin/
 * This test installs EACH entry with the real `claude` CLI in its own isolated
 * CLAUDE_CONFIG_DIR (one config per leg, because a same-manifest-name copy is shadowed),
 * then starts both MCP servers of each install and requires their full toolsets.
 *
 * It is RED today: scripts/release-lib/build-desktop-artifact.cjs (plan 369.1-05) and the
 * writer scripts/release-lib/desktop-copy-gate.sh (plan 369.1-14) do not exist, so there is
 * no mos-desktop tree to install. The mos leg (npm source) is independent of them.
 *
 * MEASURED while writing this test (claude 2.1.289, a local marketplace added from a path):
 *   - the relative-path plugin is COPIED into <config>/plugins/cache/<marketplace>/<name>/<version>
 *     and that copy is what runs (installPath); the loader does NOT install its dependencies
 *     there (no node_modules), so the mos-desktop leg exercises the plugin's own self-install
 *     (D-14), not the loader. The npm-source entry gets node_modules from the loader.
 *   - the test prints `loader-installed-deps: yes|no` for each install.
 *
 * Steps (labels in the PASS/FAIL lines):
 *   preflight  claude --version answers, the npm registry answers (else exit 77, ENV GAP)
 *   manifest   sandbox marketplace named mindrian-marketplace; plugins[0] keeps the production
 *              npm pin; plugins[1] is written by mos_write_desktop_entry when
 *              scripts/release-lib/desktop-copy-gate.sh exists (`manifest source: release-writer`),
 *              else constructed here (`manifest source: constructed`)
 *   tree       node scripts/release-lib/build-desktop-artifact.cjs build --source <repo>
 *              --out <mp>/plugins/mos-desktop --version <v> --json exits 0
 *   validate   claude plugin validate <mp>: no "Validation failed", no "Duplicate plugin name"
 *   leg-mos / leg-mos-desktop
 *              marketplace add, plugin install, enabled with an installPath, then both servers
 *              answer initialize with their full toolsets (up to 240 s per server for a
 *              self-install: the first connection may be the one status tool, then a later
 *              connection must be full; a partial set is a FAIL)
 *   hygiene    no process this test started survives; the repo is untouched; the user's real
 *              ~/.claude/plugins/installed_plugins.json mtime is unchanged
 *
 * Options: --marketplace-dir <dir>  use an existing marketplace dir instead of building one
 *                                   (plan 369.1-11 points it at the probe). The test COPIES it
 *                                   (without .git and node_modules) into its temp root first.
 *          --only <entry>           run only the leg for mos or mos-desktop
 *
 * Hermetic (D-08, Canon Part 8): every claude call carries CLAUDE_CONFIG_DIR and HOME in a temp
 * dir; every server runs with a temp HOME and MINDRIAN_ROOMS_HOME, MINDRIAN_BRAIN_URL=
 * http://127.0.0.1:9 and no key; no room content, no Brain call. Never the user's real Claude
 * config, never the real marketplace repo (one file is READ from it). npm uses a temp cache.
 * The test never runs `npm install` or `npm ci` itself. No shared helper (copy, do not import).
 *
 * Exit: 1 on any FAIL; 77 (printed as `ENV GAP: <reason>`) when claude or the registry is
 * missing; else 0. Hyphens only; long dashes are built from char codes.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const REAL_HOME = os.homedir();
const REAL_INSTALLED = path.join(REAL_HOME, '.claude', 'plugins', 'installed_plugins.json');
const REAL_MARKETPLACE = '/home/jsagi/dev/mindrian-marketplace';
const BUILDER_REL = 'scripts/release-lib/build-desktop-artifact.cjs';
const BUILDER = path.join(REPO_ROOT, BUILDER_REL);
const GATE_LIB_REL = 'scripts/release-lib/desktop-copy-gate.sh';
const GATE_LIB = path.join(REPO_ROOT, GATE_LIB_REL);
const MARKETPLACE_NAME = 'mindrian-marketplace';
// D-09 wording; plan 369.1-14's writer emits it verbatim.
const DESKTOP_DESCRIPTION = 'MindrianOS for Claude Desktop: Larry and the room tools in Cowork and the Code tab; Chat gets the skills and commands. In Claude Code, install mos instead.';
const LONG_DASHES = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']');
const CLAUDE_TIMEOUT_MS = 180000;
const SELF_INSTALL_WAIT_MS = 240000;

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

function pass(step, name) {
  passed += 1;
  console.log('PASS: ' + step + ' ' + name);
}
function fail(step, name, reason) {
  failed += 1;
  console.log('FAIL: ' + step + ' ' + name + ' -- ' + reason);
}
function reasonOf(e) {
  if (e && e.name === 'AssertionError' && e.generatedMessage && 'actual' in e) {
    const j = (v) => JSON.stringify(v);
    return 'actual=' + String(j(e.actual)).slice(0, 220) + ' expected=' + String(j(e.expected)).slice(0, 220);
  }
  return e && e.message ? String(e.message).split('\n')[0].slice(0, 500) : String(e);
}
async function check(step, name, fn) {
  try {
    await fn();
    pass(step, name);
    return true;
  } catch (e) {
    fail(step, name, reasonOf(e));
    return false;
  }
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function withTimeout(p, ms, label) {
  let t;
  const timer = new Promise((_, rej) => { t = setTimeout(() => rej(new Error(label + ' did not answer within ' + ms + ' ms')), ms); });
  return Promise.race([p, timer]).finally(() => clearTimeout(t));
}

const argv = process.argv.slice(2);
let MARKETPLACE_DIR_ARG = null;
let ONLY = null;
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--marketplace-dir' && argv[i + 1]) { MARKETPLACE_DIR_ARG = path.resolve(argv[i + 1]); i += 1; }
  else if (argv[i] === '--only' && argv[i + 1]) { ONLY = argv[i + 1]; i += 1; }
}
if (ONLY !== null && ONLY !== 'mos' && ONLY !== 'mos-desktop') {
  console.log('FAIL: args only -- --only takes mos or mos-desktop, got ' + ONLY);
  console.log('RESULT: PASS=0 FAIL=1');
  process.exit(1);
}
if (MARKETPLACE_DIR_ARG && !fs.existsSync(path.join(MARKETPLACE_DIR_ARG, '.claude-plugin', 'marketplace.json'))) {
  console.log('FAIL: args marketplace-dir -- ' + MARKETPLACE_DIR_ARG + ' has no .claude-plugin/marketplace.json');
  console.log('RESULT: PASS=0 FAIL=1');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Temp root, process sweep, hermetic env
// ---------------------------------------------------------------------------
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 't3691-cli-'));
let tempCounter = 0;
function mkTemp(label) {
  tempCounter += 1;
  const d = path.join(TMP, label + '-' + tempCounter);
  fs.mkdirSync(d, { recursive: true });
  return d;
}
const statusFilesToRemove = new Set();
function expectedStatusFile(pluginRoot) {
  const h = crypto.createHash('sha256').update(pluginRoot).digest('hex').slice(0, 12);
  const f = path.join(os.tmpdir(), 'mindrian-dep-install-' + h + '.json');
  statusFilesToRemove.add(f);
  return f;
}
function readStatus(pluginRoot) {
  try { return JSON.parse(fs.readFileSync(expectedStatusFile(pluginRoot), 'utf8')); } catch (_e) { return null; }
}

// A process is ours when its command line or its working directory is inside the unique temp root.
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
  try { process.kill(pid, 0); } catch (_e) { return false; }
  try {
    const st = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
    return !/^\d+ \(.*\) Z /.test(st);
  } catch (_e) { return false; }
}
function cleanupAll() {
  sweep();
  for (const f of statusFilesToRemove) { try { fs.unlinkSync(f); } catch (_e) { /* absent */ } }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
}
process.on('exit', cleanupAll);
process.on('SIGINT', () => { cleanupAll(); process.exit(130); });
process.on('SIGTERM', () => { cleanupAll(); process.exit(143); });

const SCRUB = [
  'MINDRIAN_BRAIN_KEY', 'MINDRIAN_MCP_FIRST', 'MINDRIAN_MCP_DAEMON', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_ROOM',
  'MINDRIAN_TEST_NPM_CLI', 'MINDRIAN_TEST_CONNECT_BUDGET_MS', 'MINDRIAN_TEST_MODE', 'CLAUDE_PLUGIN_ROOT', 'MINDRIAN_OS_ROOT',
];
function hermeticEnv(extra) {
  const env = Object.assign({}, process.env);
  for (const k of SCRUB) delete env[k];
  env.HOME = mkTemp('home');
  env.MINDRIAN_ROOMS_HOME = mkTemp('rooms');
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9'; // unreachable loopback, never a real Brain
  env.MINDRIAN_TRANSPORT = 'stdio';
  env.npm_config_cache = mkTemp('npmcache'); // temp npm cache by default
  env.npm_config_update_notifier = 'false';
  return Object.assign(env, extra || {});
}
// An isolated Claude config for one leg.
function claudeEnv() {
  const cfg = mkTemp('claude-config');
  return { cfg, env: hermeticEnv({ CLAUDE_CONFIG_DIR: cfg }) };
}
function claude(env, args, cwd) {
  const r = spawnSync('claude', args, { env, cwd: cwd || TMP, encoding: 'utf8', timeout: CLAUDE_TIMEOUT_MS });
  return {
    status: r.status,
    out: String(r.stdout || '') + String(r.stderr || ''),
    error: r.error || null,
    tail: (String(r.stdout || '') + String(r.stderr || '')).trim().split('\n').slice(-6).join(' | ').slice(0, 600),
  };
}
function haveCmd(cmd, args) {
  const r = spawnSync(cmd, args || ['--version'], { encoding: 'utf8', timeout: 30000 });
  return !r.error && r.status === 0;
}
function registryPing() {
  return new Promise((resolve) => {
    const req = https.get('https://registry.npmjs.org/-/ping', { timeout: 8000 }, (res) => { res.resume(); resolve(res.statusCode >= 200 && res.statusCode < 400); });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

// ---------------------------------------------------------------------------
// MCP client (v2 SDK from the repo's node_modules)
// ---------------------------------------------------------------------------
let sdk = null;
function loadSdk() {
  if (sdk) return sdk;
  try {
    const req = createRequire(path.join(REPO_ROOT, 'package.json'));
    sdk = { Client: req('@modelcontextprotocol/client').Client, StdioClientTransport: req('@modelcontextprotocol/client/stdio').StdioClientTransport };
  } catch (e) {
    throw Object.assign(new Error('@modelcontextprotocol/client not loadable: ' + e.message), { envGap: true });
  }
  return sdk;
}
async function connectServer(spec, env, cwd, budgetMs) {
  const { Client, StdioClientTransport } = loadSdk();
  const transport = new StdioClientTransport({ command: spec.command, args: spec.args, env, cwd, stderr: 'ignore' });
  const client = new Client({ name: 'test-369.1-cli-install', version: '1' }, {});
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
  if (!conn) return;
  try { await conn.client.close(); } catch (_e) { /* best effort */ }
  if (conn.transport && typeof conn.transport.pid === 'number') { try { process.kill(conn.transport.pid, 'SIGKILL'); } catch (_e) { /* gone */ } }
}
function textOf(result) {
  return (result && result.content ? result.content : []).map((c) => c && c.text).filter((t) => typeof t === 'string').join('\n');
}
function readMcpEntries(installPath) {
  let mcp = null;
  const f = path.join(installPath, '.mcp.json');
  if (fs.existsSync(f)) mcp = JSON.parse(fs.readFileSync(f, 'utf8'));
  else {
    const pj = JSON.parse(fs.readFileSync(path.join(installPath, '.claude-plugin', 'plugin.json'), 'utf8'));
    mcp = { mcpServers: pj.mcpServers };
  }
  const out = {};
  for (const name of Object.keys(SERVERS)) {
    const e = mcp.mcpServers && mcp.mcpServers[name];
    if (!e) throw new Error('the installed plugin has no ' + name + ' MCP server');
    out[name] = {
      command: e.command === 'node' ? process.execPath : e.command,
      args: (e.args || []).map((a) => String(a).split('${CLAUDE_PLUGIN_ROOT}').join(installPath)),
    };
  }
  return out;
}

// Ground truth for the current tree: the tool names the repo's own servers serve.
const truth = {};
async function groundTruth(name) {
  if (truth[name]) return truth[name];
  const mcp = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.mcp.json'), 'utf8')).mcpServers[name];
  const spec = {
    command: mcp.command === 'node' ? process.execPath : mcp.command,
    args: (mcp.args || []).map((a) => String(a).split('${CLAUDE_PLUGIN_ROOT}').join(REPO_ROOT)),
  };
  const conn = await connectServer(spec, hermeticEnv({ CLAUDE_PLUGIN_ROOT: REPO_ROOT }), mkTemp('cwd'), 60000);
  try {
    truth[name] = (await conn.client.listTools()).tools.map((t) => t.name).sort();
  } finally {
    await closeConn(conn);
  }
  return truth[name];
}

// Connect until the server serves its FULL toolset. A single status tool means the plugin is
// still installing its own packages (allowed, retried up to SELF_INSTALL_WAIT_MS); anything
// between the two is a partial toolset and a FAIL.
async function waitForFullToolset(name, spec, env, installPath, exact) {
  const sp = SERVERS[name];
  const deadline = Date.now() + SELF_INSTALL_WAIT_MS;
  const t0 = Date.now();
  let statusSeen = false;
  let lastText = '';
  for (;;) {
    const conn = await connectServer(spec, env, mkTemp('cwd'), 25000);
    let names;
    try {
      names = (await conn.client.listTools()).tools.map((t) => t.name).sort();
      if (names.length === 1 && names[0] === sp.statusTool) {
        statusSeen = true;
        lastText = textOf(await conn.client.callTool({ name: sp.statusTool, arguments: {} }));
      }
    } finally {
      await closeConn(conn);
    }
    const isStatus = names.length === 1 && names[0] === sp.statusTool;
    if (isStatus) {
      const st = readStatus(installPath);
      if (st && (st.state === 'failed' || st.state === 'npm-not-found')) {
        throw new Error(name + ' self-install ended ' + st.state + ' (' + st.reason + '): ' + lastText.slice(0, 200));
      }
      if (Date.now() > deadline) throw new Error(name + ' still answered with its status tool after ' + (SELF_INSTALL_WAIT_MS / 1000) + ' s: ' + lastText.slice(0, 200));
      await sleep(4000);
      continue;
    }
    assert.ok(names.includes(sp.mustHave), name + ' is neither its status tool nor a full toolset (no ' + sp.mustHave + '); got ' + names.length + ' tools: ' + names.slice(0, 5).join(','));
    assert.ok(!names.some((n) => n.endsWith('_install_status')), name + ' must not list a *_install_status tool once its packages are installed');
    if (exact) {
      const full = await groundTruth(name);
      assert.deepEqual(names, full, name + ' toolset must equal the repo tree toolset (' + full.length + ' tools), never partial');
    }
    return { count: names.length, seconds: ((Date.now() - t0) / 1000).toFixed(1), statusSeen };
  }
}

// ---------------------------------------------------------------------------
// Manifest and tree
// ---------------------------------------------------------------------------
const FALLBACK_MARKETPLACE = {
  name: MARKETPLACE_NAME,
  owner: { name: 'Jonathan Sagir' },
  plugins: [{
    name: 'mos',
    description: 'test fixture',
    version: '2.0.0-beta.55',
    source: { source: 'npm', package: '@mindrian_os/cli', version: '2.0.0-beta.55' },
  }],
};
function repoVersion() {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version;
}
function copyDirFiltered(src, dst) {
  fs.cpSync(src, dst, {
    recursive: true,
    filter: (s) => {
      const base = path.basename(s);
      return base !== '.git' && base !== 'node_modules';
    },
  });
}

let MP = null; // the sandbox marketplace dir under test
let MANIFEST = null;
let TREE_OK = false;

async function stepManifest() {
  await check('manifest', 'a sandbox marketplace named ' + MARKETPLACE_NAME + ' with mos at plugins[0] and mos-desktop at plugins[1]', () => {
    const version = repoVersion();
    if (MARKETPLACE_DIR_ARG) {
      MP = mkTemp('mp');
      copyDirFiltered(MARKETPLACE_DIR_ARG, MP);
      console.log('    manifest source: provided (--marketplace-dir, copied without .git and node_modules)');
    } else {
      MP = mkTemp('mp');
      fs.mkdirSync(path.join(MP, '.claude-plugin'), { recursive: true });
      const live = path.join(REAL_MARKETPLACE, '.claude-plugin', 'marketplace.json');
      const base = fs.existsSync(live) ? JSON.parse(fs.readFileSync(live, 'utf8')) : FALLBACK_MARKETPLACE;
      fs.writeFileSync(path.join(MP, '.claude-plugin', 'marketplace.json'), JSON.stringify(base, null, 2) + '\n');
      if (fs.existsSync(GATE_LIB)) {
        const r = spawnSync('bash', ['-c', '. "$1"; mos_write_desktop_entry "$2" "$3"', 'bash', GATE_LIB, MP, version], {
          cwd: REPO_ROOT, encoding: 'utf8', env: hermeticEnv({}), timeout: 30000,
        });
        if (r.status !== 0) throw new Error('mos_write_desktop_entry exited ' + r.status + ': ' + String((r.stdout || '') + (r.stderr || '')).trim().slice(0, 240));
        console.log('    manifest source: release-writer');
      } else {
        const m = JSON.parse(fs.readFileSync(path.join(MP, '.claude-plugin', 'marketplace.json'), 'utf8'));
        const mos = m.plugins.find((p) => p.name === 'mos');
        assert.ok(mos, 'the production manifest has no mos entry');
        m.plugins = [mos, {
          name: 'mos-desktop',
          displayName: 'MindrianOS',
          description: DESKTOP_DESCRIPTION,
          version,
          source: './plugins/mos-desktop',
        }];
        fs.writeFileSync(path.join(MP, '.claude-plugin', 'marketplace.json'), JSON.stringify(m, null, 2) + '\n');
        console.log('    manifest source: constructed');
      }
    }
    MANIFEST = JSON.parse(fs.readFileSync(path.join(MP, '.claude-plugin', 'marketplace.json'), 'utf8'));
    assert.equal(MANIFEST.name, MARKETPLACE_NAME, 'marketplace name');
    assert.ok(Array.isArray(MANIFEST.plugins) && MANIFEST.plugins.length === 2, 'plugins must hold exactly two entries, got ' + (MANIFEST.plugins && MANIFEST.plugins.length));
    assert.equal(MANIFEST.plugins[0].name, 'mos', 'plugins[0].name');
    assert.equal(MANIFEST.plugins[0].source && MANIFEST.plugins[0].source.source, 'npm', 'plugins[0] is an npm source');
    assert.equal(MANIFEST.plugins[1].name, 'mos-desktop', 'plugins[1].name');
    assert.equal(MANIFEST.plugins[1].source, './plugins/mos-desktop', 'plugins[1].source');
    assert.ok(!LONG_DASHES.test(JSON.stringify(MANIFEST)), 'the manifest carries an em-dash or en-dash');
    console.log('    mos pin ' + MANIFEST.plugins[0].version + ', mos-desktop ' + MANIFEST.plugins[1].version);
  });
}

async function stepTree() {
  if (MARKETPLACE_DIR_ARG) {
    TREE_OK = fs.existsSync(path.join(MP, 'plugins', 'mos-desktop'));
    await check('tree', 'the provided marketplace carries plugins/mos-desktop', () => {
      assert.ok(TREE_OK, MARKETPLACE_DIR_ARG + ' has no plugins/mos-desktop');
    });
    return;
  }
  TREE_OK = await check('tree', BUILDER_REL + ' builds plugins/mos-desktop into the sandbox marketplace', () => {
    if (!fs.existsSync(BUILDER)) throw new Error(BUILDER_REL + ' is missing (plan 369.1-05 writes it): no mos-desktop tree to install');
    const out = path.join(MP, 'plugins', 'mos-desktop');
    const version = MANIFEST ? MANIFEST.plugins[1].version : repoVersion();
    const r = spawnSync(process.execPath, [BUILDER, 'build', '--source', REPO_ROOT, '--out', out, '--version', version, '--json'], {
      cwd: REPO_ROOT, encoding: 'utf8', timeout: 300000, env: hermeticEnv({}),
    });
    if (r.status !== 0) throw new Error('build-desktop-artifact build exited ' + r.status + ': ' + String((r.stdout || '') + (r.stderr || '')).trim().slice(0, 240));
    assert.ok(fs.existsSync(path.join(out, '.claude-plugin', 'plugin.json')), 'the built tree has no .claude-plugin/plugin.json');
    assert.ok(!fs.existsSync(path.join(out, 'bin')), 'the built tree must not carry a top-level bin/');
  });
}

async function stepValidate() {
  await check('validate', 'claude plugin validate accepts the two-entry marketplace (no failure, no duplicate name)', () => {
    assert.ok(fs.existsSync(path.join(MP, 'plugins', 'mos-desktop')), 'plugins/mos-desktop is absent in the sandbox marketplace, so the relative-path entry cannot validate');
    const { env } = claudeEnv();
    const r = claude(env, ['plugin', 'validate', MP]);
    if (r.error) throw new Error('claude plugin validate could not run: ' + r.error.message);
    assert.ok(!/Validation failed/i.test(r.out), 'validate says "Validation failed": ' + r.tail);
    assert.ok(!/Duplicate plugin name/i.test(r.out), 'validate says "Duplicate plugin name": ' + r.tail);
    assert.equal(r.status, 0, 'claude plugin validate exit status; ' + r.tail);
  });
}

// ---------------------------------------------------------------------------
// One install leg
// ---------------------------------------------------------------------------
async function runLeg(entry) {
  const step = 'leg-' + entry;
  const { cfg, env } = claudeEnv();
  let installPath = null;

  const added = await check(step, 'claude plugin marketplace add <sandbox> works in an isolated CLAUDE_CONFIG_DIR', () => {
    const r = claude(env, ['plugin', 'marketplace', 'add', MP]);
    if (r.error) throw new Error('claude could not run: ' + r.error.message);
    assert.equal(r.status, 0, 'marketplace add exit status; ' + r.tail);
  });
  if (!added) return;

  const installed = await check(step, 'claude plugin install ' + entry + '@' + MARKETPLACE_NAME + ' installs and is enabled with an installPath', () => {
    const r = claude(env, ['plugin', 'install', entry + '@' + MARKETPLACE_NAME]);
    if (r.error) throw new Error('claude could not run: ' + r.error.message);
    assert.equal(r.status, 0, 'plugin install exit status; ' + r.tail);
    let rec = null;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(cfg, 'plugins', 'installed_plugins.json'), 'utf8'));
      rec = ((j.plugins || {})[entry + '@' + MARKETPLACE_NAME] || [])[0] || null;
    } catch (_e) { /* fall through to list */ }
    const list = claude(env, ['plugin', 'list', '--json']);
    let item = null;
    try { item = JSON.parse(list.out.slice(list.out.indexOf('['))).find((p) => p.id === entry + '@' + MARKETPLACE_NAME) || null; } catch (_e) { /* unparsable */ }
    assert.ok(rec || item, entry + ' is not recorded in installed_plugins.json or `claude plugin list --json`');
    installPath = (rec && rec.installPath) || (item && item.installPath);
    assert.ok(installPath && fs.existsSync(installPath), 'installPath is missing or absent on disk: ' + installPath);
    assert.equal(item ? item.enabled : true, true, entry + ' is not enabled');
    assert.ok(installPath.startsWith(cfg), 'the install landed outside the isolated CLAUDE_CONFIG_DIR: ' + installPath);
    const hasNm = fs.existsSync(path.join(installPath, 'node_modules'));
    console.log('    loader-installed-deps: ' + (hasNm ? 'yes' : 'no'));
    if (entry === 'mos-desktop') {
      // Claude Desktop cannot carry dependencies (D-14), and the CLI loader may install them for a
      // relative-path plugin that ships a shrinkwrap (measured on claude 2.1.289: usually yes). To
      // make this leg a REAL exercise of the plugin's own self-install, a loader-made node_modules
      // is removed from the isolated install before the servers start.
      const nm = path.join(installPath, 'node_modules');
      if (hasNm) {
        const resolved = path.resolve(nm);
        assert.ok(resolved.startsWith(TMP + path.sep) && path.basename(resolved) === 'node_modules', 'refusing to remove ' + resolved);
        fs.rmSync(resolved, { recursive: true, force: true });
        console.log('    self-install forced: removed the loader-made node_modules from the isolated install');
      } else {
        console.log('    self-install forced: not needed, the loader left no node_modules');
      }
    }
    console.log('    installPath: ' + installPath.replace(TMP, '<tmp>'));
    if (item && item.mcpServers) console.log('    mcp servers recorded: ' + Object.keys(item.mcpServers).join(', '));
    if (entry === 'mos-desktop') {
      const d = claude(env, ['plugin', 'details', entry + '@' + MARKETPLACE_NAME]);
      const lines = d.out.split('\n');
      const first = (lines[0] || '').trim().slice(0, 60);
      const counts = lines.map((l) => l.match(/^\s*(Skills|Commands|Agents|Hooks|MCP servers|LSP servers) \((\d+)\)/)).filter(Boolean).map((m) => m[1] + ' ' + m[2]);
      console.log('    naming (plugin details): ' + (first || 'unavailable') + (counts.length ? ' ; ' + counts.join(', ') : ''));
    }
  });
  if (!installed) return;

  const exact = entry === 'mos-desktop';
  const entries = (() => { try { return readMcpEntries(installPath); } catch (e) { fail(step, 'the installed plugin declares both MCP servers', reasonOf(e)); return null; } })();
  if (!entries) return;
  const srvEnv = hermeticEnv({ CLAUDE_PLUGIN_ROOT: installPath });
  expectedStatusFile(installPath);
  for (const name of Object.keys(SERVERS)) {
    await check(step, name + ' answers initialize and serves its full toolset' + (exact ? ' (equal to the repo tree)' : ''), async () => {
      const r = await waitForFullToolset(name, entries[name], srvEnv, installPath, exact);
      console.log('    ' + name + ': ' + r.count + ' tools after ' + r.seconds + ' s' + (r.statusSeen ? ' (the status tool answered first, then the full set)' : ''));
    });
  }
  sweep();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function gitState() {
  const r = spawnSync('git', ['status', '--porcelain', '--', '.', ':(exclude).planning', ':(exclude)tests/e2e-369'], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 60000 });
  return r.error ? 'git-unavailable' : String(r.stdout);
}
function mtimeOf(f) {
  try { return String(fs.statSync(f).mtimeMs); } catch (_e) { return 'absent'; }
}

async function main() {
  if (!haveCmd('claude')) {
    console.log('ENV GAP: claude CLI not on PATH');
    process.exit(77);
  }
  if (!(await registryPing())) {
    console.log('ENV GAP: registry unreachable');
    process.exit(77);
  }
  pass('preflight', 'claude answers --version and the npm registry answers');

  const gitBefore = gitState();
  const realBefore = mtimeOf(REAL_INSTALLED);
  const realMarketBefore = (() => {
    if (!fs.existsSync(path.join(REAL_MARKETPLACE, '.git'))) return 'absent';
    const r = spawnSync('git', ['-C', REAL_MARKETPLACE, 'status', '--porcelain'], { encoding: 'utf8' });
    return r.status === 0 ? r.stdout : 'unreadable';
  })();

  await stepManifest();
  if (MP) {
    await stepTree();
    await stepValidate();
    const legs = ONLY ? [ONLY] : ['mos', 'mos-desktop'];
    for (const leg of legs) {
      if (leg === 'mos-desktop' && !TREE_OK) {
        fail('leg-mos-desktop', 'install of mos-desktop@' + MARKETPLACE_NAME, 'no mos-desktop tree exists in the sandbox marketplace (see the tree step); not installed');
        continue;
      }
      try {
        await runLeg(leg);
      } catch (e) {
        if (e && e.envGap) { envGap = envGap || e.message; console.log('ENV GAP: ' + e.message); }
        else fail('leg-' + leg, 'leg', reasonOf(e));
      }
    }
  }

  await check('hygiene', 'no process started by this test survives, the repo is untouched, the real Claude config and marketplace are unchanged', () => {
    const survivors = rootProcesses().filter((p) => isAlive(p.pid));
    if (survivors.length) {
      sweep();
      throw new Error(survivors.length + ' process(es) survived: ' + survivors.slice(0, 3).map((p) => p.pid + ' ' + p.cmdline.slice(0, 80)).join(' | '));
    }
    assert.equal(gitState(), gitBefore, 'git status of the repo changed during the run');
    assert.equal(mtimeOf(REAL_INSTALLED), realBefore, 'the real ' + REAL_INSTALLED + ' mtime changed (T-369.1-03-01)');
    if (realMarketBefore !== 'absent') {
      const r = spawnSync('git', ['-C', REAL_MARKETPLACE, 'status', '--porcelain'], { encoding: 'utf8' });
      assert.equal(r.stdout, realMarketBefore, 'the real marketplace repo status changed');
    }
  });

  cleanupAll();
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  if (failed > 0) process.exit(1);
  if (envGap) { console.log('ENV GAP: ' + envGap); process.exit(77); }
  process.exit(0);
}

main().catch((e) => {
  console.log('FAIL: harness main -- ' + reasonOf(e));
  cleanupAll();
  console.log('RESULT: PASS=' + passed + ' FAIL=' + (failed + 1));
  process.exit(1);
});
