#!/usr/bin/env node
'use strict';

/*
 * Phase 369.1 plan 01 (DPI-04, D-10): the bin/ relocation gate.
 * =============================================================
 * The five runtime executables (mindrian-mcp-server, mindrian-brain-mcp-client,
 * mindrian-mcp-shim, mindrian-tools, local-chain-recommender) live in bin/ today
 * and about 25 shipped lines invoke them there. Claude Desktop's plugin sync
 * strips bin/ from a plugin (the 369.1 research), so the real files move to
 * scripts/ and bin/ keeps cli.js plus five tiny forwarding shims so every old
 * path keeps working. This test is RED today and goes green only when the
 * move is real.
 *
 * Arms (repeatable --arm <id>; no flag runs all six):
 *   layout      scripts/ holds the real files, bin/ holds cli.js + five shims
 *   references  no shipped runtime line invokes a bin/ executable
 *               (--surface code | docs narrows it; no flag scans both)
 *   mcp-json    .mcp.json points at scripts/ and the files exist
 *   shims-run   bin/ shim and scripts/ original behave identically
 *   pack        npm pack lists exactly six bin/ entries and all five scripts/
 *   mirrors     generated mirrors and the path-anchoring check stay green
 *
 * Hermetic (D-08, Canon Part 8): temp HOME, MINDRIAN_ROOMS_HOME and
 * CLAUDE_CONFIG_DIR, MINDRIAN_BRAIN_URL=http://127.0.0.1:9, no Brain key, no
 * room content. Every spawned PID is recorded and SIGKILLed in finally; a last
 * check asserts none survives. No shared helper (copy, do not import).
 *
 * Exit: 1 on any FAIL, 77 only when the pack arm cannot find npm and nothing
 * else failed, else 0. Hyphens only.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

const NAMES = [
  'mindrian-mcp-server.cjs',
  'mindrian-brain-mcp-client.cjs',
  'mindrian-mcp-shim.cjs',
  'mindrian-tools.cjs',
  'local-chain-recommender.cjs',
];

// Six invocation patterns, as RegExp sources. Plan 05's builder is checked for
// drift against this array, so it is exported.
const RUNTIME_BIN_PATTERNS = [
  // (1) node bin/<name>
  'node\\s+["\']?bin/(mindrian-[a-z-]+|local-chain-recommender)\\.cjs',
  // (2) a root anchor followed by /bin/<name>
  '(\\$\\{CLAUDE_PLUGIN_ROOT\\}|\\{plugin_root\\}|\\$\\{?PLUGIN_ROOT\\}?|\\$\\{MINDRIAN_OS_ROOT[^}]*\\}\\}?)/bin/(mindrian-[a-z-]+|local-chain-recommender)\\.cjs',
  // (3) path pieces 'bin', '<name>'
  '[\'"]bin[\'"]\\s*,\\s*[\'"](mindrian-[a-z-]+|local-chain-recommender)\\.cjs[\'"]',
  // (4) a relative require climbing into bin/
  '[\'"](\\.\\./)+bin/(mindrian-|local-chain)',
  // (5) path.join / path.resolve with a bin/<name> piece
  'path\\.(join|resolve)\\([^)]*[\'"]bin/(mindrian-|local-chain)',
  // (6) JSON string value "bin/<name>"
  '"bin/(mindrian-[a-z-]+|local-chain-recommender)\\.cjs"',
];

module.exports = { RUNTIME_BIN_PATTERNS };

if (require.main !== module) return;

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
let envGap = false;

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
  return e && e.message ? String(e.message).split('\n')[0] : String(e);
}
function check(arm, name, fn) {
  try {
    fn();
    pass(arm, name);
  } catch (e) {
    fail(arm, name, reasonOf(e));
  }
}
async function checkAsync(arm, name, fn) {
  try {
    await fn();
    pass(arm, name);
  } catch (e) {
    fail(arm, name, reasonOf(e));
  }
}

const argv = process.argv.slice(2);
const ARMS = [];
let SURFACE = null;
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--arm' && argv[i + 1]) { ARMS.push(argv[i + 1]); i += 1; }
  else if (argv[i] === '--surface' && argv[i + 1]) { SURFACE = argv[i + 1]; i += 1; }
}
const ALL_ARMS = ['layout', 'references', 'mcp-json', 'shims-run', 'pack', 'mirrors'];
const WANT = ARMS.length ? ARMS : ALL_ARMS;
if (SURFACE && SURFACE !== 'code' && SURFACE !== 'docs') {
  console.log('FAIL: args surface -- --surface must be code or docs');
  console.log('RESULT: PASS=0 FAIL=1');
  process.exit(1);
}
for (const a of WANT) {
  if (!ALL_ARMS.includes(a)) {
    console.log('FAIL: args arm -- unknown arm ' + a);
    console.log('RESULT: PASS=0 FAIL=1');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Hermetic env + temp bookkeeping
// ---------------------------------------------------------------------------
const tempDirs = [];
function mkTemp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of tempDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
});

function hermeticEnv() {
  const env = Object.assign({}, process.env);
  delete env.MINDRIAN_BRAIN_KEY;
  delete env.MINDRIAN_MCP_FIRST;
  delete env.MINDRIAN_MCP_DAEMON;
  delete env.CLAUDE_CODE_SESSION_ID;
  env.HOME = mkTemp('t3691-home-');
  env.MINDRIAN_ROOMS_HOME = mkTemp('t3691-rooms-');
  env.CLAUDE_CONFIG_DIR = mkTemp('t3691-claude-');
  env.MINDRIAN_TRANSPORT = 'stdio';
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
  return env;
}

const spawnedPids = new Set();

function nonCommentLines(file, kind) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  return lines.filter((l) => {
    const t = l.trim();
    if (!t) return false;
    if (t.startsWith('#!')) return false;
    if (kind === 'js') return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    return !t.startsWith('#');
  });
}

// ---------------------------------------------------------------------------
// Arm layout
// ---------------------------------------------------------------------------
function armLayout() {
  for (const n of NAMES) {
    check('layout', 'scripts/' + n + ' is the real file (more than 40 lines)', () => {
      const f = path.join(REPO_ROOT, 'scripts', n);
      assert.ok(fs.existsSync(f), 'scripts/' + n + ' is missing');
      const lines = fs.readFileSync(f, 'utf8').split('\n').length;
      assert.ok(lines > 40, 'scripts/' + n + ' has only ' + lines + ' lines');
    });
    check('layout', 'bin/' + n + ' is a forwarding shim (<= 15 non-comment lines, requires ../scripts/' + n + ')', () => {
      const f = path.join(REPO_ROOT, 'bin', n);
      assert.ok(fs.existsSync(f), 'bin/' + n + ' is missing');
      const body = nonCommentLines(f, 'js');
      assert.ok(body.length <= 15, 'bin/' + n + ' has ' + body.length + ' non-comment lines (a shim is at most 15)');
      const re = /require(\.resolve)?\(\s*['"]\.\.\/scripts\/([^'"]+)['"]\s*\)/;
      const m = body.join('\n').match(re);
      assert.ok(m && m[2] === n, 'bin/' + n + ' does not require or require.resolve ../scripts/' + n);
    });
  }
  check('layout', 'bin/ lists exactly cli.js plus the five shims', () => {
    const have = fs.readdirSync(path.join(REPO_ROOT, 'bin')).sort();
    const want = ['cli.js'].concat(NAMES).sort();
    assert.deepEqual(have, want);
  });
}

// ---------------------------------------------------------------------------
// Arm references
// ---------------------------------------------------------------------------
const SKIP_DIRS = new Set(['node_modules', 'dist', '.next', '.git']);
const SHELL_EXTENSIONLESS = new Set(['session-start', 'post-write', 'compute-opportunity-state']);

function walk(dir, out, opts) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), out, opts);
    } else if (e.isFile()) {
      if (/\.test\.cjs$/.test(e.name)) continue;
      out.push(path.join(dir, e.name));
    }
  }
}

function listCodeSurface() {
  const files = [];
  for (const rel of ['.mcp.json', 'settings.json']) {
    if (fs.existsSync(path.join(REPO_ROOT, rel))) files.push(path.join(REPO_ROOT, rel));
  }
  for (const d of ['hooks', 'scripts', 'lib']) walk(path.join(REPO_ROOT, d), files, {});
  const dataDir = path.join(REPO_ROOT, 'data');
  if (fs.existsSync(dataDir)) {
    for (const n of fs.readdirSync(dataDir)) {
      if (n.endsWith('.json') && n !== 'capability-ledger.json') files.push(path.join(dataDir, n));
    }
  }
  return files.filter((f) => {
    const rel = path.relative(REPO_ROOT, f).split(path.sep).join('/');
    if (rel === 'lib/import/PRECONDITIONS.md') return false;
    if (rel === 'CHANGELOG.md') return false;
    return true;
  });
}

function listDocsSurface() {
  const files = [];
  const cmd = path.join(REPO_ROOT, 'commands');
  if (fs.existsSync(cmd)) {
    for (const n of fs.readdirSync(cmd)) if (n.endsWith('.md')) files.push(path.join(cmd, n));
  }
  const skills = path.join(REPO_ROOT, 'skills');
  if (fs.existsSync(skills)) {
    for (const d of fs.readdirSync(skills, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const f = path.join(skills, d.name, 'SKILL.md');
      if (fs.existsSync(f)) files.push(f);
    }
  }
  const agents = path.join(REPO_ROOT, 'agents');
  if (fs.existsSync(agents)) {
    for (const n of fs.readdirSync(agents)) if (n.endsWith('.md')) files.push(path.join(agents, n));
  }
  const pipes = [];
  walk(path.join(REPO_ROOT, 'pipelines'), pipes, {});
  for (const f of pipes) if (f.endsWith('.md')) files.push(f);
  walk(path.join(REPO_ROOT, 'templates'), files, {});
  walk(path.join(REPO_ROOT, 'references'), files, {});
  return files;
}

function isProbablyBinary(buf) {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i += 1) if (buf[i] === 0) return true;
  return false;
}

function commentKind(file) {
  const base = path.basename(file);
  const ext = path.extname(base);
  if (['.cjs', '.js', '.mjs', '.ts', '.tsx'].includes(ext)) return 'js';
  if (ext === '.sh' || ext === '.bash' || (ext === '' && SHELL_EXTENSIONLESS.has(base))) return 'sh';
  if (ext === '') {
    // Any other extension-less script: decide by its shebang.
    try {
      const head = fs.readFileSync(file, 'utf8').slice(0, 80);
      if (/^#!.*\b(bash|sh|zsh)\b/.test(head)) return 'sh';
      if (/^#!.*\bnode\b/.test(head)) return 'js';
    } catch (_e) { /* fall through */ }
  }
  return 'none';
}

function scanFiles(files) {
  const regs = RUNTIME_BIN_PATTERNS.map((s) => new RegExp(s));
  const hits = [];
  for (const f of files) {
    let buf;
    try {
      const st = fs.statSync(f);
      if (st.size > 4 * 1024 * 1024) continue;
      buf = fs.readFileSync(f);
    } catch (_e) { continue; }
    if (isProbablyBinary(buf)) continue;
    const kind = commentKind(f);
    const lines = buf.toString('utf8').split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const t = lines[i].trim();
      if (kind === 'js' && (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'))) continue;
      if (kind === 'sh' && t.startsWith('#')) continue;
      if (regs.some((r) => r.test(lines[i]))) {
        hits.push(path.relative(REPO_ROOT, f).split(path.sep).join('/') + ':' + (i + 1) + ': ' + t.slice(0, 160));
      }
    }
  }
  return hits;
}

function armReferences() {
  const surfaces = SURFACE ? [SURFACE] : ['code', 'docs'];
  for (const s of surfaces) {
    check('references', 'no shipped ' + s + ' line invokes a bin/ executable', () => {
      const files = s === 'code' ? listCodeSurface() : listDocsSurface();
      const hits = scanFiles(files);
      if (hits.length) {
        for (const h of hits) console.log('  HIT: ' + h);
        throw new Error(hits.length + ' ' + s + ' line(s) still invoke a bin/ executable (listed above as file:line)');
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Arm mcp-json
// ---------------------------------------------------------------------------
function armMcpJson() {
  const want = {
    'mindrian-os': '${CLAUDE_PLUGIN_ROOT}/scripts/mindrian-mcp-server.cjs',
    'mindrian-brain': '${CLAUDE_PLUGIN_ROOT}/scripts/mindrian-brain-mcp-client.cjs',
  };
  for (const key of Object.keys(want)) {
    check('mcp-json', '.mcp.json ' + key + ' args point at scripts/ and resolve to an existing file', () => {
      const j = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.mcp.json'), 'utf8'));
      const srv = j.mcpServers && j.mcpServers[key];
      assert.ok(srv, 'server ' + key + ' missing from .mcp.json');
      assert.deepEqual(srv.args, [want[key]]);
      const resolved = path.join(REPO_ROOT, srv.args[0].replace('${CLAUDE_PLUGIN_ROOT}', ''));
      assert.ok(fs.existsSync(resolved), resolved + ' does not exist');
    });
  }
}

// ---------------------------------------------------------------------------
// Arm shims-run
// ---------------------------------------------------------------------------
function runNode(file, args, env) {
  const r = spawnSync('node', [file].concat(args || []), {
    cwd: REPO_ROOT, env, encoding: 'utf8', timeout: 60000,
  });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

async function listToolNames(file) {
  let Client;
  let StdioClientTransport;
  try {
    ({ Client } = require('@modelcontextprotocol/client'));
    ({ StdioClientTransport } = require('@modelcontextprotocol/client/stdio'));
  } catch (e) {
    const err = new Error('ENV GAP: @modelcontextprotocol/client cannot be required (' + e.message + ')');
    err.envGap = true;
    throw err;
  }
  if (!fs.existsSync(file)) throw new Error(path.relative(REPO_ROOT, file) + ' does not exist');
  const transport = new StdioClientTransport({
    command: 'node', args: [file], env: hermeticEnv(), cwd: REPO_ROOT,
  });
  const client = new Client({ name: 'test-369.1-bin-relocation', version: '1' }, {});
  const origStart = transport.start.bind(transport);
  transport.start = async function () {
    const r = await origStart();
    if (typeof transport.pid === 'number') spawnedPids.add(transport.pid);
    return r;
  };
  try {
    await client.connect(transport);
    if (typeof transport.pid === 'number') spawnedPids.add(transport.pid);
    const { tools } = await client.listTools();
    return tools.map((t) => t.name).sort();
  } finally {
    try { await client.close(); } catch (_e) { /* best effort */ }
    if (typeof transport.pid === 'number') {
      try { process.kill(transport.pid, 'SIGKILL'); } catch (_e) { /* gone */ }
    }
  }
}

async function armShimsRun() {
  for (const n of ['mindrian-mcp-server.cjs', 'mindrian-brain-mcp-client.cjs']) {
    await checkAsync('shims-run', 'bin/' + n + ' and scripts/' + n + ' expose the same sorted tool names', async () => {
      const real = path.join(REPO_ROOT, 'scripts', n);
      if (!fs.existsSync(real)) throw new Error('scripts/' + n + ' is missing (the real file has not moved)');
      const viaBin = await listToolNames(path.join(REPO_ROOT, 'bin', n));
      const viaScripts = await listToolNames(real);
      assert.ok(viaScripts.length > 0, 'scripts/' + n + ' exposed zero tools');
      assert.deepEqual(viaBin, viaScripts);
    });
  }
  check('shims-run', 'bin/mindrian-tools.cjs and scripts/mindrian-tools.cjs agree with no args', () => {
    const real = path.join(REPO_ROOT, 'scripts', 'mindrian-tools.cjs');
    if (!fs.existsSync(real)) throw new Error('scripts/mindrian-tools.cjs is missing (the real file has not moved)');
    const env = hermeticEnv();
    const a = runNode(path.join(REPO_ROOT, 'bin', 'mindrian-tools.cjs'), [], env);
    const b = runNode(real, [], env);
    assert.equal(a.status, b.status, 'exit codes differ: bin=' + a.status + ' scripts=' + b.status);
    assert.equal(a.stdout, b.stdout);
  });
  check('shims-run', 'bin/local-chain-recommender.cjs and scripts/ agree on --json --room <empty dir>', () => {
    const real = path.join(REPO_ROOT, 'scripts', 'local-chain-recommender.cjs');
    if (!fs.existsSync(real)) throw new Error('scripts/local-chain-recommender.cjs is missing (the real file has not moved)');
    const env = hermeticEnv();
    const room = mkTemp('t3691-emptyroom-');
    const a = runNode(path.join(REPO_ROOT, 'bin', 'local-chain-recommender.cjs'), ['--json', '--room', room], env);
    const b = runNode(real, ['--json', '--room', room], env);
    assert.equal(b.status, 0, 'scripts/ form exited ' + b.status);
    assert.equal(a.status, b.status, 'exit codes differ: bin=' + a.status + ' scripts=' + b.status);
    assert.ok(b.stdout.trim().length > 0, 'scripts/ form printed nothing');
    assert.equal(a.stdout, b.stdout);
  });
  check('shims-run', 'require of the local-chain-recommender shim still exports recommendLocalCanonicalTargets', () => {
    const real = path.join(REPO_ROOT, 'scripts', 'local-chain-recommender.cjs');
    if (!fs.existsSync(real)) throw new Error('scripts/local-chain-recommender.cjs is missing (the real file has not moved)');
    const mod = require(path.join(REPO_ROOT, 'bin', 'local-chain-recommender.cjs'));
    assert.equal(typeof mod.recommendLocalCanonicalTargets, 'function');
  });
}

// ---------------------------------------------------------------------------
// Arm pack
// ---------------------------------------------------------------------------
function armPack() {
  let out;
  const r = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: REPO_ROOT, env: hermeticEnv(), encoding: 'utf8', timeout: 180000, maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error && r.error.code === 'ENOENT') {
    envGap = true;
    console.log('ENV GAP: npm is not on PATH, pack arm not run');
    return;
  }
  check('pack', 'npm pack --dry-run --json succeeds', () => {
    assert.equal(r.status, 0, 'npm pack exited ' + r.status + ': ' + String(r.stderr).split('\n').slice(-3).join(' | '));
    out = JSON.parse(r.stdout);
  });
  if (!out) return;
  const files = (out[0] && out[0].files ? out[0].files : []).map((f) => f.path);
  check('pack', 'exactly six bin/ entries: cli.js plus the five shims', () => {
    const bins = files.filter((p) => p.startsWith('bin/')).sort();
    assert.deepEqual(bins, ['bin/cli.js'].concat(NAMES.map((n) => 'bin/' + n)).sort());
  });
  check('pack', 'all five scripts/ files are in the pack', () => {
    const missing = NAMES.filter((n) => !files.includes('scripts/' + n));
    assert.deepEqual(missing, []);
  });
}

// ---------------------------------------------------------------------------
// Arm mirrors
// ---------------------------------------------------------------------------
function armMirrors() {
  const cmds = [
    ['scripts/build-skill-mirrors.cjs', ['--check']],
    ['scripts/build-command-registry.cjs', ['--check']],
    ['scripts/check-plugin-path-anchoring.cjs', ['--check-scripts']],
  ];
  for (const [script, args] of cmds) {
    check('mirrors', 'node ' + script + ' ' + args.join(' ') + ' exits 0', () => {
      const r = runNode(path.join(REPO_ROOT, script), args, hermeticEnv());
      assert.equal(r.status, 0, 'exit ' + r.status + ': ' + (r.stdout + r.stderr).split('\n').filter(Boolean).slice(-2).join(' | '));
    });
  }
}

// ---------------------------------------------------------------------------
// Hygiene: no server process this test started survives
// ---------------------------------------------------------------------------
// pgrep set of runtime server processes anchored to THIS repo (the repo root as
// a path prefix), so a shim that spawns a grandchild cannot leak it unseen.
function repoServerPids() {
  const esc = REPO_ROOT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    const out = execSync('pgrep -f "node .*' + esc + '/(bin|scripts)/(mindrian-mcp-server|mindrian-brain-mcp-client)\\.cjs" || true').toString().trim();
    return out ? out.split('\n').map((x) => parseInt(x, 10)).filter(Number.isFinite) : [];
  } catch (_e) {
    return [];
  }
}
const PIDS_BEFORE = new Set(repoServerPids());

function armHygiene() {
  check('hygiene', 'no MCP child (or grandchild) this test started survives', () => {
    // Give SIGKILL a moment to land.
    try { execSync('sleep 0.3'); } catch (_e) { /* ignore */ }
    const alive = [];
    for (const pid of spawnedPids) {
      try { process.kill(pid, 0); alive.push(pid); } catch (_e) { /* gone */ }
    }
    for (const pid of repoServerPids()) {
      if (!PIDS_BEFORE.has(pid) && !alive.includes(pid)) alive.push(pid);
    }
    for (const pid of alive) {
      try { process.kill(pid, 'SIGKILL'); } catch (_e) { /* gone */ }
    }
    assert.deepEqual(alive, []);
  });
}

(async () => {
  try {
    if (WANT.includes('layout')) armLayout();
    if (WANT.includes('references')) armReferences();
    if (WANT.includes('mcp-json')) armMcpJson();
    if (WANT.includes('shims-run')) {
      try {
        await armShimsRun();
      } catch (e) {
        fail('shims-run', 'arm', e && e.message ? e.message : String(e));
      }
    }
    if (WANT.includes('pack')) armPack();
    if (WANT.includes('mirrors')) armMirrors();
  } finally {
    for (const pid of spawnedPids) {
      try { process.kill(pid, 'SIGKILL'); } catch (_e) { /* gone */ }
    }
    if (WANT.includes('shims-run')) armHygiene();
  }
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  if (failed > 0) process.exit(1);
  process.exit(envGap ? 77 : 0);
})().catch((e) => {
  console.log('FAIL: harness -- ' + (e && e.message ? e.message : String(e)));
  console.log('RESULT: PASS=' + passed + ' FAIL=' + (failed + 1));
  process.exit(1);
});
