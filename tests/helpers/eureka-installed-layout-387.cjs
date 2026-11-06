#!/usr/bin/env node
'use strict';
/*
 * Phase 387 plan 01: the installed-layout Eureka probe.
 *
 * WHAT. Packs the repo (npm pack), lays the package out the way Claude Code runs it
 * (<HOME>/.claude/plugins/cache/mindrian-marketplace/mos/<version>/) inside a scratch HOME, starts
 * the REAL stdio MCP server from that layout, lists the tools, and calls every tool whose name
 * starts with eureka, under six engine states (S1 to S6). It records the exact reason code and the
 * exact refusal text of each call, unbound and bound to a synthetic fixture room.
 *
 * WHY. Every later plan in Phase 387 changes behavior that this probe measures first.
 *
 * SAFETY (Canon Part 8 and the plan rules).
 *   - The real Eureka engine is never started. No uv sync, no uv run, no pip, no python against an
 *     engine checkout. MINDRIAN_EUREKA_ROOT is never set to a real checkout.
 *   - S3 uses an empty folder. S4 and S5 use a folder that holds one pyproject.toml of two lines.
 *     S4 points MINDRIAN_EUREKA_UV at a path that does not exist. S5 gives the child a PATH that
 *     holds only the node folder, and aborts the scenario when a file named uv sits in it.
 *     S6 points MINDRIAN_EUREKA_UV at a fake uv script that the probe writes (no network code, no
 *     child process; it logs its argv and environment keys, prints one error line, exits 2).
 *   - The scratch HOME is a mkdtemp folder (mkIsolatedHome rules); the Brain URL is a dead loopback
 *     address; fixture rooms hold synthetic strings only.
 *   - Every temp path in the report becomes <TMP>; the home folder becomes <HOME>.
 *
 * CLI: node tests/helpers/eureka-installed-layout-387.cjs --report --out FILE [--npm-ci]
 * Exit: 0 report written, 1 failure, 77 ENV GAP (named reason on stdout).
 *
 * Node built-ins and the repo's own @modelcontextprotocol/client only. CommonJS. Hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const { Client } = require('@modelcontextprotocol/client');
const { StdioClientTransport } = require('@modelcontextprotocol/client/stdio');

const FIXTURE_SLUG = 'eureka-fixture-387';
const PERSPECTIVE_SLUG = 'eureka-perspective-387';
const UV_ERROR_LINE = 'error: No interpreter found for Python >=3.11 in managed installations or search path';
const CALL_TIMEOUT_MS = 90000;
const PYPROJECT_FIXTURE = '[project]\nname = "fixture-not-an-engine"\n';
const FAKE_JOB_ID = 'synthetic-job-387';

class EnvGap extends Error {}

// Synthetic node ids (fixed). The fixture builder creates exactly these nodes.
const N = Object.freeze({ a: 'syn/a', b: 'syn/b', c: 'syn/c', d: 'syn/d', e1: 'syn/e1', f1: 'syn/f1' });
const ALL_IDS = Object.freeze([N.a, N.b, N.c, N.d, N.e1, N.f1]);

// Smallest valid arguments per tool, derived from the inputSchema in each module.
const SYNTHETIC_ARGS = Object.freeze({
  eureka_capability_run: { capability_id: 'graph.explore_local_relationships', request: {} },
  eureka_capability_start: { capability_id: 'graph.explore_local_relationships', request: {} },
  eureka_capability_job_status: { job_id: FAKE_JOB_ID },
  eureka_capability_job_result: { job_id: FAKE_JOB_ID },
  eureka_capability_job_cancel: { job_id: FAKE_JOB_ID },
  eureka_graph_project: { node_ids: [N.a, N.b] },
  eureka_graph_analyze: { node_ids: [N.a, N.b, N.c] },
  eureka_graph_propose_relationships: { node_ids: [N.a, N.b, N.c] },
  eureka_graph_find_shared_neighbor_gaps: { node_ids: [N.a, N.b, N.c] },
  eureka_graph_find_network_holes: { node_ids: [N.a, N.b, N.c] },
  eureka_graph_find_community_bridge_pairs: { node_ids: [N.a, N.b, N.c] },
  eureka_graph_assess_category_edge_patterns: { node_ids: [N.a, N.b, N.c], category_attribute: 'review_status' },
  eureka_graph_find_similar_unlinked_items: { node_ids: [N.a, N.b, N.c] },
  eureka_graph_backtest: { node_ids: [N.a, N.b, N.c] },
  eureka_graph_compare_topics: { node_ids_a: [N.a, N.b], node_ids_b: [N.c, N.d] },
  eureka_graph_genesis_plan: { node_ids: [N.a, N.b, N.c], objective: 'Synthetic objective for the installed-layout probe.' },
  eureka_graph_map_neighbourhoods: { node_ids: [N.a, N.b, N.c], base_node_id: N.a, target_node_id: N.c },
  eureka_graph_opportunity_scout: { node_ids: [N.a, N.b, N.c], objective: 'Synthetic objective for the installed-layout probe.' },
  eureka_graph_package_relationships: {
    node_ids: [N.a, N.b, N.e1],
    relationships: [{ source_id: N.a, target_id: N.b, relation: 'related_to', rationale: 'Synthetic rationale.', evidence_ids: [N.e1] }],
  },
  eureka_graph_prepare_artifacts: { node_ids: [N.a, N.b, N.c], objective: 'Synthetic objective for the installed-layout probe.' },
  eureka_graph_rank_paths: { node_ids: [N.a, N.b], paths: [{ node_ids: [N.a, N.b], edge_types: ['INFORMS'] }] },
  eureka_graph_score_surprise: { node_ids: [N.a], claims: [{ id: N.a, prior: [0.5, 0.5], posterior: [0.6, 0.4] }] },
  eureka_hsi_interpret_whitespace: {
    node_ids: [N.a, N.f1],
    gaps: [{ id: 'gap-1', brain_framework_id: N.f1, brain_framework: 'Synthetic Framework', nearest_room_artifacts: [N.a] }],
    umap_2d: { room_artifacts: [{ id: N.a, x: 0, y: 0 }] },
  },
  eureka_critic: {
    differential_score: 0, semantic_similarity: 0, lsa_similarity: 0.5,
    surprise_type: 'structural_transfer', source_domain_tag: 'engineering', target_domain_tag: 'biology',
    rubric_pattern: '000000', schema_version: 1,
  },
});

// ---------------------------------------------------------------------------
// small helpers
// ---------------------------------------------------------------------------

function run(cmd, args, opts) {
  return cp.spawnSync(cmd, args, Object.assign({ encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }, opts));
}

function nodeFolder() { return path.dirname(process.execPath); }

function assertNoUvOnPath(pathValue) {
  const dirs = String(pathValue || '').split(path.delimiter).filter(Boolean);
  for (const d of dirs) {
    for (const n of ['uv', 'uv.exe', 'uv.cmd']) {
      if (fs.existsSync(path.join(d, n))) throw new EnvGap('ENV GAP: a file named ' + n + ' exists in the PATH folder ' + d + ' that the child would see');
    }
  }
}

const REMOVED_KEYS = [
  'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_ACTIVE_SESSION_ID', 'MINDRIAN_SESSION_ID', 'CLAUDE_ACTIVE_ROOM',
  'MINDRIAN_ROOM', 'MINDRIAN_BRAIN_KEY', 'MINDRIAN_MCP_FIRST', 'MINDRIAN_MCP_DAEMON', 'CLAUDE_SURFACE',
  'COWORK_SESSION_ID', 'NODE_OPTIONS',
];

function baseEnv(world) {
  const env = Object.assign({}, process.env);
  for (const k of Object.keys(env)) if (k.startsWith('MINDRIAN_EUREKA_')) delete env[k];
  for (const k of REMOVED_KEYS) delete env[k];
  env.HOME = world.home;
  env.USERPROFILE = world.home;
  env.MINDRIAN_ROOMS_HOME = world.roomsHome;
  env.MINDRIAN_TRANSPORT = 'stdio';
  env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9'; // dead loopback address, never a real Brain
  env.TMPDIR = world.tmpdir;
  return env;
}

// ---------------------------------------------------------------------------
// layout
// ---------------------------------------------------------------------------

function layOutInstalledCopy(opts) {
  const o = opts || {};
  const tmp = o.tmp;
  const home = o.home;
  const npmCi = o.npmCi === true;
  const version = run(process.execPath, [path.join(REPO, 'lib', 'core', 'repo-version.cjs')], { cwd: REPO }).stdout.trim();
  const installed = path.join(home, '.claude', 'plugins', 'cache', 'mindrian-marketplace', 'mos', version);
  const packDir = path.join(tmp, 'pack');
  fs.mkdirSync(packDir, { recursive: true });
  const npmEnv = Object.assign({}, process.env, { npm_config_cache: path.join(tmp, 'npm-cache'), npm_config_update_notifier: 'false' });
  const r = run('npm', ['pack', '--ignore-scripts', '--pack-destination', packDir, '--silent'], { cwd: REPO, env: npmEnv, timeout: 240000 });
  const tgzs = fs.readdirSync(packDir).filter((f) => f.endsWith('.tgz'));
  if (r.status !== 0 || tgzs.length !== 1) throw new Error('npm pack failed: status ' + r.status + ' ' + String(r.stderr).slice(0, 400));
  const ex = path.join(tmp, 'extract');
  fs.mkdirSync(ex, { recursive: true });
  const t = run('tar', ['-xzf', path.join(packDir, tgzs[0]), '-C', ex]);
  if (t.status !== 0) throw new Error('tar extract failed');
  fs.mkdirSync(path.dirname(installed), { recursive: true });
  fs.cpSync(path.join(ex, 'package'), installed, { recursive: true });

  let layoutMode = 'linked';
  if (npmCi) {
    layoutMode = 'npm-ci';
    const c = run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: installed, env: npmEnv, timeout: 300000 });
    const err = String(c.stderr || '') + (c.error ? String(c.error.message) : '');
    if (c.status !== 0) {
      if (/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED/.test(err) || (c.error && c.error.code === 'ETIMEDOUT')) {
        throw new EnvGap('npm registry unreachable for npm ci (' + ((err.match(/ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED/) || ['timeout'])[0]) + ')');
      }
      throw new Error('npm ci failed: ' + err.slice(0, 600));
    }
  } else {
    if (!fs.existsSync(path.join(REPO, 'node_modules'))) throw new EnvGap('the repo has no node_modules folder, so the linked layout cannot be built');
    fs.symlinkSync(path.join(REPO, 'node_modules'), path.join(installed, 'node_modules'), 'dir');
  }

  const must = ['bin/mindrian-mcp-server.cjs', 'lib/mcp/tools/eureka-capability-run.cjs', 'package.json'];
  const missing = must.filter((m) => !fs.existsSync(path.join(installed, m)));
  if (missing.length) throw new Error('packed layout is missing: ' + missing.join(', '));
  const forbidden = ['.planning', 'r-and-d', 'mindrian-eureka'].filter((f) => fs.existsSync(path.join(installed, f)));
  if (forbidden.length) throw new Error('packed layout holds a folder that must not ship: ' + forbidden.join(', '));
  return { installed, version, layoutMode };
}

// ---------------------------------------------------------------------------
// fixture rooms (built in a child process so this process env stays clean)
// ---------------------------------------------------------------------------

const BIRTH_SCRIPT = [
  "'use strict';",
  'const path = require("node:path");',
  'const repo = process.argv[2], home = process.argv[3], roomsHome = process.argv[4], kind = process.argv[5], slug = process.argv[6];',
  'process.env.HOME = home; process.env.USERPROFILE = home; process.env.MINDRIAN_ROOMS_HOME = roomsHome;',
  'delete process.env.CLAUDE_CODE_SESSION_ID; delete process.env.MINDRIAN_ACTIVE_SESSION_ID;',
  'const iso = require(path.join(repo, "tests/helpers/isolated-home-36925.cjs"));',
  'const born = iso.birthFixtureRoom({ iso: { home: home, roomsHome: roomsHome }, slug: slug, sessionId: "fixture-birth-387", ventureText: "A synthetic venture for the Phase 387 probe" });',
  'if (!born || born.ok === false) { process.stderr.write("birth failed: " + JSON.stringify(born).slice(0, 300)); process.exit(3); }',
  'const roomDb = require(path.join(repo, "lib/core/room-db.cjs"));',
  'const { insertNode } = require(path.join(repo, "lib/core/node-insert.cjs"));',
  'if (kind === "perspective") {',
  '  require(path.join(repo, "tests/helpers/fixture-366.cjs")).buildPerspectiveRoom(roomsHome, { name: slug });',
  '} else {',
  '  const db = roomDb.openRoomDb(born.roomDir);',
  '  try {',
  '    const mk = (id, type, props) => insertNode(db, id, type, JSON.stringify(props), { source_path: "test:fixture-387", epistemic_type: "observation" });',
  '    mk("syn/a", "Artifact", { title: "Synthetic node A", body: "Synthetic text about water filters and membranes." });',
  '    mk("syn/b", "Artifact", { title: "Synthetic node B", body: "Synthetic text about filter cleaning schedules." });',
  '    mk("syn/c", "Artifact", { title: "Synthetic node C", body: "Synthetic text about municipal maintenance crews." });',
  '    mk("syn/d", "Artifact", { title: "Synthetic node D", body: "Synthetic text about foraging insects and paths." });',
  '    mk("syn/e1", "Evidence", { title: "Synthetic evidence", body: "Synthetic evidence text for one relationship." });',
  '    mk("syn/f1", "framework", { name: "Synthetic Framework" });',
  '    const ins = db.prepare("INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)");',
  '    ins.run("syn/a", "syn/b", "INFORMS", "{}");',
  '    ins.run("syn/b", "syn/c", "INFORMS", "{}");',
  '  } finally { roomDb.closeRoomDb(db); }',
  '}',
  'process.stdout.write("BIRTH_OK " + slug + "\\n");',
].join('\n');

function buildFixtureRooms(world) {
  const scriptPath = path.join(world.tmp, 'birth-fixture-387.cjs');
  fs.writeFileSync(scriptPath, BIRTH_SCRIPT);
  const env = Object.assign({}, process.env, { HOME: world.home, USERPROFILE: world.home, MINDRIAN_ROOMS_HOME: world.roomsHome });
  for (const k of REMOVED_KEYS) delete env[k];
  for (const [kind, slug] of [['graph', FIXTURE_SLUG], ['perspective', PERSPECTIVE_SLUG]]) {
    const r = run(process.execPath, [scriptPath, REPO, world.home, world.roomsHome, kind, slug], { cwd: world.cwd, env, timeout: 120000 });
    if (r.status !== 0 || !String(r.stdout).includes('BIRTH_OK')) {
      throw new Error('fixture room birth failed (' + kind + '): status ' + r.status + ' ' + String(r.stderr).slice(0, 600));
    }
  }
}

// ---------------------------------------------------------------------------
// server
// ---------------------------------------------------------------------------

async function startServer(layout, world, envOverride, opts) {
  const o = opts || {};
  const server = path.join(layout.installed, 'bin', 'mindrian-mcp-server.cjs');
  let command = process.execPath;
  let args = [server];
  let env = envOverride;
  if (o.cleanEnv) {
    // A launch with no shell environment: env -i, then only the given variables (a Desktop-like simulation).
    const pairs = Object.keys(envOverride).map((k) => k + '=' + envOverride[k]);
    command = 'env';
    args = ['-i'].concat(pairs, [process.execPath, server]);
    env = { PATH: process.env.PATH || '' };
  }
  const transport = new StdioClientTransport({ command, args, env, cwd: world.cwd, stderr: 'pipe' });
  const stderrChunks = [];
  const stderr = { text: () => stderrChunks.join('') };
  if (transport.stderr) transport.stderr.on('data', (d) => { stderrChunks.push(String(d)); });
  const identity = o.identity || 'claude-code';
  const client = identity === 'claude-ai'
    ? new Client({ name: 'claude-ai', version: '0.1.0' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } } } })
    : new Client({ name: 'claude-code', version: '2.1.0' }, { capabilities: {} });
  await client.connect(transport);
  return { client, transport, stderr, identity };
}

async function stopServer(conn) {
  if (!conn) return;
  try { await conn.client.close(); } catch (_e) { /* best effort */ }
  if (conn.transport && typeof conn.transport.pid === 'number') {
    try { process.kill(conn.transport.pid, 'SIGKILL'); } catch (_e) { /* gone */ }
  }
}

async function listAllTools(client) {
  const tools = [];
  let cursor;
  for (let i = 0; i < 20; i += 1) {
    const page = await client.listTools(cursor ? { cursor } : {});
    for (const t of page.tools || []) tools.push(t.name);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return tools;
}

async function listEurekaTools(client) {
  const all = await listAllTools(client);
  const distinct = Array.from(new Set(all)).sort();
  return {
    total: all.length,
    distinct_total: distinct.length,
    eureka_names: distinct.filter((n) => n.startsWith('eureka')),
    eureka_count: distinct.filter((n) => n.startsWith('eureka')).length,
    other_serving: distinct.filter((n) => n === 'research_run' || n.startsWith('rs_')),
  };
}

function textOf(result) {
  const t = result && result.content && result.content.find((c) => c.type === 'text');
  return t ? t.text : '';
}

function looksLikeSchemaError(result, thrown) {
  if (thrown) return /-32602|invalid (input|arguments|params)|input validation/i.test(String(thrown && (thrown.message || thrown)));
  if (!result || !result.isError || result.structuredContent) return false;
  return /input validation|invalid (input|arguments)|-32602/i.test(textOf(result));
}

function readNewLogLines(logPath, seen) {
  if (!logPath || !fs.existsSync(logPath)) return [];
  const lines = fs.readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
  const fresh = lines.slice(seen.count);
  seen.count = lines.length;
  return fresh.map((l) => { try { return JSON.parse(l); } catch (_e) { return { raw: l }; } });
}

async function callOne(conn, tool, bound, logPath, seen) {
  const stderrBefore = conn.stderr.text().length;
  let result = null;
  let thrown = null;
  try {
    result = await conn.client.callTool({ name: tool, arguments: SYNTHETIC_ARGS[tool] }, { timeout: CALL_TIMEOUT_MS });
  } catch (e) { thrown = e; }
  if (looksLikeSchemaError(result, thrown)) {
    throw new Error('SYNTHETIC_ARGS for ' + tool + ' failed schema validation: ' + (thrown ? String(thrown.message) : textOf(result)).slice(0, 300));
  }
  const sc = (result && result.structuredContent) || {};
  const row = {
    tool,
    bound,
    isError: result ? result.isError === true : null,
    ok: typeof sc.ok === 'boolean' ? sc.ok : null,
    reason: sc.reason === undefined ? null : sc.reason,
    message: sc.message === undefined ? null : sc.message,
  };
  if (sc.engine_state !== undefined) row.engine_state = sc.engine_state;
  // A tool that returns text only (no structuredContent): keep the first 300 characters.
  if (result && !result.structuredContent) row.text = textOf(result).slice(0, 300);
  if (thrown) row.thrown = String(thrown.message || thrown).slice(0, 300);
  if (!result && !thrown) row.thrown = 'no result';
  const spawns = readNewLogLines(logPath, seen);
  if (logPath) {
    row.uv_spawns = spawns;
    const stderrNew = conn.stderr.text().slice(stderrBefore);
    row.server_stderr_has_uv_line = stderrNew.includes(UV_ERROR_LINE);
    row.message_has_uv_line = typeof row.message === 'string' && row.message.includes('No interpreter found');
  }
  return row;
}

// ---------------------------------------------------------------------------
// scenarios
// ---------------------------------------------------------------------------

function fakeUvSource(logPath) {
  return [
    '#!/usr/bin/env node',
    "'use strict';",
    "const fs = require('node:fs');",
    'const e = process.env;',
    'const line = JSON.stringify({',
    '  argv: process.argv.slice(2), cwd: process.cwd(), env_keys: Object.keys(e).sort(),',
    '  UV_OFFLINE: e.UV_OFFLINE === undefined ? null : e.UV_OFFLINE,',
    '  HF_HUB_OFFLINE: e.HF_HUB_OFFLINE === undefined ? null : e.HF_HUB_OFFLINE,',
    '  TRANSFORMERS_OFFLINE: e.TRANSFORMERS_OFFLINE === undefined ? null : e.TRANSFORMERS_OFFLINE,',
    '});',
    'fs.appendFileSync(' + JSON.stringify(logPath) + ", line + '\\n');",
    "process.stderr.write(" + JSON.stringify(UV_ERROR_LINE) + " + '\\n');",
    'process.exit(2);',
    '',
  ].join('\n');
}

// Each scenario: id, env_summary, build(world) -> { env, cleanEnv?, logPath?, preflight? }
const SCENARIOS = [
  {
    id: 'S1', name: 'unset-cli',
    env_summary: 'MINDRIAN_EUREKA_ROOT unset; full process environment minus the removed keys; scratch HOME with no engine setting and no engine folder',
    build(world) {
      const env = baseEnv(world);
      if (env.MINDRIAN_EUREKA_ROOT !== undefined) throw new Error('S1: MINDRIAN_EUREKA_ROOT must be absent');
      for (const rel of ['.mindrian/eureka-engine.json', '.mindrian/eureka-engine']) {
        if (fs.existsSync(path.join(world.home, rel))) throw new Error('S1: the scratch HOME holds ' + rel);
      }
      return { env };
    },
  },
  {
    id: 'S2', name: 'unset-minimal-env',
    env_summary: 'MINDRIAN_EUREKA_ROOT unset; env -i with only HOME, USERPROFILE, MINDRIAN_ROOMS_HOME, TMPDIR, PATH (node folder only) plus the harness keys MINDRIAN_TRANSPORT and MINDRIAN_BRAIN_URL; a simulation of a Desktop launch, not a real Desktop run',
    build(world) {
      const env = {
        HOME: world.home, USERPROFILE: world.home, MINDRIAN_ROOMS_HOME: world.roomsHome, TMPDIR: world.tmpdir,
        PATH: nodeFolder(), MINDRIAN_TRANSPORT: 'stdio', MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
      };
      return { env, cleanEnv: true };
    },
  },
  {
    id: 'S3', name: 'set-no-checkout',
    env_summary: 'MINDRIAN_EUREKA_ROOT is an empty folder (no pyproject.toml)',
    build(world) {
      const env = baseEnv(world);
      const dir = path.join(world.tmp, 'empty-engine-folder-387');
      fs.mkdirSync(dir, { recursive: true });
      env.MINDRIAN_EUREKA_ROOT = dir;
      return { env };
    },
  },
  {
    id: 'S4', name: 'set-fixture-uv-missing-binary',
    env_summary: 'MINDRIAN_EUREKA_ROOT is a fixture folder with a two-line pyproject.toml; MINDRIAN_EUREKA_UV is a path that does not exist',
    build(world) {
      const env = baseEnv(world);
      env.MINDRIAN_EUREKA_ROOT = world.fixtureEngine;
      env.MINDRIAN_EUREKA_UV = path.join(world.tmp, 'no-such-uv-387');
      if (fs.existsSync(env.MINDRIAN_EUREKA_UV)) throw new Error('S4: the nonexistent uv path exists');
      return { env };
    },
  },
  {
    id: 'S5', name: 'set-fixture-uv-absent-from-path',
    env_summary: 'same fixture folder; MINDRIAN_EUREKA_UV unset; PATH is the node folder only (no file named uv there)',
    build(world) {
      const env = baseEnv(world);
      env.MINDRIAN_EUREKA_ROOT = world.fixtureEngine;
      delete env.MINDRIAN_EUREKA_UV;
      env.PATH = nodeFolder();
      assertNoUvOnPath(env.PATH);
      return { env };
    },
  },
  {
    id: 'S6', name: 'set-fixture-uv-fails-with-stderr',
    env_summary: 'same fixture folder; MINDRIAN_EUREKA_UV is a fake uv script that logs argv and environment keys, prints one uv-style error line to stderr and exits 2; PATH is the node folder only',
    build(world) {
      const env = baseEnv(world);
      env.MINDRIAN_EUREKA_ROOT = world.fixtureEngine;
      const fake = path.join(world.tmp, 'fake-uv-fail-387.cjs');
      const log = path.join(world.tmp, 'fake-uv-fail-387.log');
      fs.writeFileSync(fake, fakeUvSource(log), { mode: 0o755 });
      fs.chmodSync(fake, 0o755);
      fs.writeFileSync(log, '');
      env.MINDRIAN_EUREKA_UV = fake;
      env.PATH = nodeFolder();
      assertNoUvOnPath(env.PATH);
      return { env, logPath: log };
    },
  },
];

const NET_PRELOAD = [
  "'use strict';",
  "const fs = require('node:fs'), net = require('node:net'), dns = require('node:dns');",
  'const log = process.env.MOS_387_NETLOG;',
  'function note(kind, target) { try { fs.appendFileSync(log, JSON.stringify({ kind: kind, target: String(target) }) + "\\n"); } catch (_e) { /* ignore */ } }',
  'const origConnect = net.Socket.prototype.connect;',
  'net.Socket.prototype.connect = function () {',
  '  const a = Array.isArray(arguments[0]) ? arguments[0][0] : arguments[0];',
  '  note("connect", a && typeof a === "object" ? (a.path || ((a.host || "") + ":" + (a.port || ""))) : (a + ":" + (arguments[1] || "")));',
  '  return origConnect.apply(this, arguments);',
  '};',
  'const origLookup = dns.lookup;',
  'dns.lookup = function (host) { note("dns", host); return origLookup.apply(this, arguments); };',
  '',
].join('\n');

function isLoopback(target) {
  return /^(127\.|localhost|::1|\[::1\])/.test(String(target)) || String(target).startsWith('/') || /^:/.test(String(target));
}

async function runScenario(layout, world, scenario) {
  const built = scenario.build(world);
  const out = { id: scenario.id, name: scenario.name, env_summary: scenario.env_summary, tools_list: {}, calls: [] };
  const seen = { count: 0 };
  // tools/list for both client identities (separate servers)
  for (const identity of ['claude-code', 'claude-ai']) {
    const conn = await startServer(layout, world, built.env, { cleanEnv: built.cleanEnv, identity });
    try { out.tools_list[identity] = await listEurekaTools(conn.client); } finally { await stopServer(conn); }
  }
  // calls: one server per scenario
  const conn = await startServer(layout, world, built.env, { cleanEnv: built.cleanEnv, identity: 'claude-code' });
  try {
    const listed = await listEurekaTools(conn.client);
    const names = listed.eureka_names;
    for (const n of names) if (!SYNTHETIC_ARGS[n]) throw new Error('SYNTHETIC_ARGS has no entry for the runtime tool ' + n);
    for (const n of names) out.calls.push(await callOne(conn, n, false, built.logPath, seen));
    const bind = await conn.client.callTool({ name: 'room_bind', arguments: { room: FIXTURE_SLUG } }, { timeout: CALL_TIMEOUT_MS });
    const bindText = textOf(bind);
    let bindJson = null;
    try { bindJson = JSON.parse(bindText.split('\n\n## Suggested Next')[0]); } catch (_e) { bindJson = null; }
    if (!bindJson || bindJson.ok !== true || bindJson.bound !== true) throw new Error('room_bind did not bind the fixture room: ' + bindText.slice(0, 300));
    out.room_bind = { ok: bindJson.ok, bound: bindJson.bound, effective: bindJson.effective, resolved_source: bindJson.resolved_source };
    for (const n of names) out.calls.push(await callOne(conn, n, true, built.logPath, seen));
  } finally { await stopServer(conn); }

  if (scenario.id === 'S1') out.perspective = await perspectiveArm(layout, world, built);
  if (scenario.id === 'S6') out.scout_direct = scoutDirect(layout, world, built);
  return out;
}

// The scout path (callEurekaOpportunityScout) is only reached through a tool after a successful artifact
// preparation, which the fake uv cannot give. So the S6 probe calls the shipped function directly, in a
// child node process, with the S6 environment, and reads the fake uv log for its argument list.
function scoutDirect(layout, world, built) {
  const script = path.join(world.tmp, 'scout-direct-387.cjs');
  fs.writeFileSync(script, [
    "'use strict';",
    'const mod = require(process.argv[2]);',
    "mod.callEurekaOpportunityScout({ objective: 'Synthetic objective', artifacts: [] }, process.env)",
    "  .then((r) => { process.stdout.write('RESULT ' + JSON.stringify(r) + '\\n'); process.exit(0); })",
    "  .catch((e) => { process.stdout.write('THROWN ' + String(e && e.message) + '\\n'); process.exit(0); });",
    '',
  ].join('\n'));
  const seen = { count: fs.readFileSync(built.logPath, 'utf8').split('\n').filter(Boolean).length };
  const r = run(process.execPath, [script, path.join(layout.installed, 'lib', 'mcp', 'tools', 'eureka-graph-analyze.cjs')], {
    cwd: world.cwd, env: built.env, timeout: CALL_TIMEOUT_MS,
  });
  const line = String(r.stdout || '').split('\n').find((l) => l.startsWith('RESULT ') || l.startsWith('THROWN '));
  let result = null;
  if (line && line.startsWith('RESULT ')) { try { result = JSON.parse(line.slice(7)); } catch (_e) { result = null; } }
  const spawns = readNewLogLines(built.logPath, seen);
  return {
    ok: result ? result.ok : null,
    reason: result ? result.reason : null,
    message: result ? result.message : (line || null),
    message_has_uv_line: !!(result && typeof result.message === 'string' && result.message.includes('No interpreter found')),
    uv_spawns: spawns,
  };
}

async function perspectiveArm(layout, world, built) {
  const preload = path.join(world.tmp, 'net-preload-387.cjs');
  const netlog = path.join(world.tmp, 'net-387.log');
  fs.writeFileSync(preload, NET_PRELOAD);
  fs.writeFileSync(netlog, '');
  // Positive control: the preload must log a real connect attempt, or a count of 0 means nothing.
  const controlLog = path.join(world.tmp, 'net-control-387.log');
  fs.writeFileSync(controlLog, '');
  run(process.execPath, ['--require', preload, '-e', "const s = require('node:net').connect({ host: '127.0.0.1', port: 9 }); s.on('error', () => {}); setTimeout(() => process.exit(0), 300);"],
    { env: { PATH: process.env.PATH, MOS_387_NETLOG: controlLog }, timeout: 20000 });
  const controlLines = fs.readFileSync(controlLog, 'utf8').split('\n').filter(Boolean).length;
  const env = Object.assign({}, built.env, { NODE_OPTIONS: '--require ' + preload, MOS_387_NETLOG: netlog });
  const conn = await startServer(layout, world, env, { identity: 'claude-code' });
  const res = { ok: null, recalled_pairs: null, reason: null };
  try {
    const bind = await conn.client.callTool({ name: 'room_bind', arguments: { room: PERSPECTIVE_SLUG } }, { timeout: CALL_TIMEOUT_MS });
    let bj = null;
    try { bj = JSON.parse(textOf(bind).split('\n\n## Suggested Next')[0]); } catch (_e) { bj = null; }
    res.bound = !!(bj && bj.bound);
    const r = await conn.client.callTool({ name: 'research_run', arguments: { op: 'perspective_recall', perspective: 'eureka' } }, { timeout: CALL_TIMEOUT_MS });
    let j = null;
    try { j = JSON.parse(textOf(r)); } catch (_e) { j = null; }
    if (j) {
      res.ok = j.ok === true;
      res.reason = j.reason === undefined ? null : j.reason;
      const counts = j.counts || {};
      res.counts = counts;
      const top = Array.isArray(j.top) ? j.top.length : null;
      res.top_length = top;
      res.recalled_pairs = typeof counts.pairs === 'number' ? counts.pairs : (typeof counts.recalled === 'number' ? counts.recalled : top);
    } else {
      res.ok = false;
      res.reason = 'unparsed_response';
      res.raw = textOf(r).slice(0, 300);
    }
  } finally {
    await stopServer(conn);
  }
  const lines = fs.readFileSync(netlog, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (_e) { return null; } }).filter(Boolean);
  res.network_counter_positive_control = controlLines >= 1;
  res.network_attempts_total = lines.length;
  res.network_attempts_non_loopback = lines.filter((l) => !isLoopback(l.target)).length;
  res.network_attempt_targets = Array.from(new Set(lines.map((l) => l.kind + ' ' + l.target))).sort();
  const se = conn.stderr.text().split('\n').filter((l) => /ECONNREFUSED|ENOTFOUND|fetch failed|connect /i.test(l)).slice(0, 5);
  res.server_stderr_connection_lines = se;
  return res;
}

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------

function scrub(value, world, layout) {
  let text = JSON.stringify(value, null, 2);
  const tmpdirs = new Set([os.tmpdir()]);
  try { tmpdirs.add(fs.realpathSync(os.tmpdir())); } catch (_e) { /* ignore */ }
  const roots = [world.tmp];
  try { roots.push(fs.realpathSync(world.tmp)); } catch (_e) { /* ignore */ }
  for (const r of roots) text = text.split(r).join('<TMP>');
  for (const t of tmpdirs) text = text.replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/[^"\\s\\\\,]*', 'g'), '<TMP>');
  const nf = nodeFolder();
  text = text.split(process.execPath).join('<NODE_BIN>').split(nf).join('<NODE_DIR>');
  const homes = new Set([os.homedir()]);
  try { homes.add(os.userInfo().homedir); } catch (_e) { /* ignore */ }
  for (const h of homes) if (h && h.length > 1) text = text.split(h).join('<HOME>');
  void layout;
  return JSON.parse(text);
}

async function buildReport(opts) {
  const o = opts || {};
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-387-layout-'));
  const home = path.join(tmp, 'home');
  const roomsHome = path.join(home, 'rooms');
  const cwd = path.join(tmp, 'cwd');
  const tmpdir = path.join(tmp, 'tmpdir');
  const fixtureEngine = path.join(tmp, 'fixture-engine-folder-387');
  for (const d of [home, roomsHome, cwd, tmpdir, fixtureEngine]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(fixtureEngine, 'pyproject.toml'), PYPROJECT_FIXTURE);
  const world = { tmp, home, roomsHome, cwd, tmpdir, fixtureEngine };
  try {
    const layout = layOutInstalledCopy({ tmp, home, npmCi: o.npmCi === true });
    buildFixtureRooms(world);
    const scenarios = [];
    for (const s of SCENARIOS) {
      try {
        scenarios.push(await runScenario(layout, world, s));
      } catch (e) {
        if (e instanceof EnvGap) { scenarios.push({ id: s.id, name: s.name, env_summary: s.env_summary, env_gap: e.message, tools_list: {}, calls: [] }); } else throw e;
      }
    }
    const gaps = scenarios.filter((s) => s.env_gap).map((s) => s.id + ': ' + s.env_gap);
    const report = {
      head_sha: run('git', ['rev-parse', 'HEAD'], { cwd: REPO }).stdout.trim(),
      version: layout.version,
      node_version: process.version,
      layout_mode: layout.layoutMode,
      scenarios,
    };
    const scrubbed = scrub(report, world, layout);
    if (gaps.length) scrubbed.env_gaps = gaps;
    return scrubbed;
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  }
}

module.exports = {
  layOutInstalledCopy, startServer, listEurekaTools, SYNTHETIC_ARGS, SCENARIOS, runScenario, buildReport,
  EnvGap, FIXTURE_SLUG, UV_ERROR_LINE, PYPROJECT_FIXTURE,
};

if (require.main === module) {
  const argv = process.argv.slice(2);
  const outIdx = argv.indexOf('--out');
  const out = outIdx >= 0 ? argv[outIdx + 1] : null;
  if (!argv.includes('--report') || !out) {
    process.stdout.write('usage: node tests/helpers/eureka-installed-layout-387.cjs --report --out FILE [--npm-ci]\n');
    process.exit(1);
  }
  buildReport({ npmCi: argv.includes('--npm-ci') }).then((report) => {
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
    if (report.env_gaps) {
      process.stdout.write('SKIPPED (ENV GAP): ' + report.env_gaps.join('; ') + '\n');
      process.exit(77);
    }
    process.stdout.write('report written: ' + out + ' (layout_mode ' + report.layout_mode + ', ' + report.scenarios.length + ' scenarios)\n');
    process.exit(0);
  }).catch((e) => {
    if (e instanceof EnvGap) { process.stdout.write('SKIPPED (ENV GAP): ' + e.message + '\n'); process.exit(77); }
    process.stderr.write(String(e && e.stack || e) + '\n');
    process.exit(1);
  });
}
