#!/usr/bin/env node
'use strict';

/**
 * Quick 261005-l8g (SEED-119 plan 1) -- the bare Theo path.
 * ==========================================================================
 * Theo needs no key (Phase 0 fixture J2: `tools/list` answers HTTP 200 with
 * 42 tools with no Authorization header, and with a garbage Bearer). The only
 * key gate on the Theo path was the plugin's own. This suite pins the bare
 * contract: with NOTHING configured (a fresh HOME, no env key, no install
 * json) the first Brain call reaches Theo with no Authorization header, no
 * POST /register is made, no install token is written, and no surface a user
 * can see names a Brain key, Tier 0 or no_key.
 *
 * Shape borrowed from the Phase 0 J2 probe (fixtures/phase0/J2/keyprobe.cjs):
 * an isolated HOME, a child process that requires brain-client.cjs, and a
 * local HTTP server standing in for Theo (MINDRIAN_BRAIN_URL points at it;
 * BRAIN_URL is read at module load, so the client runs in a child).
 *
 * Arms:
 *   A1 isAvailable() is true with nothing configured.
 *   A2 one stats() call: 0 Authorization headers, 0 /register requests, no
 *      ~/.mindrian-install.json afterwards, node count equals the fixture's.
 *   A3 the shim answers brain_stats over stdio with the fixture payload, not
 *      a tier0 or no_key refusal.
 *   A4 grep gate over the shipped surface: no key / Tier 0 / no_key lines.
 *   A5 scripts/session-start run offline under the isolated HOME prints no
 *      "Brain key" / "Tier 0" / "not configured" line.
 *   A6 dash guard: no em or en dash in the files this quick touches.
 *   A7 Part 8 stays: the two egress suites exit 0 (369.2-08: no tolerated red).
 *
 * No em-dashes (hyphens only).
 */

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SHIM = path.join(REPO, 'scripts', 'mindrian-brain-mcp-client.cjs');
const FIXTURE_NODES = 4242;
const FIXTURE_RELS = 7;

// ---------------------------------------------------------------------------
// The fake Theo. Records every request; answers initialize, tools/list and
// tools/call (brain_stats -> the fixed payload, anything else -> {ok:true}).
// A POST /register is recorded and answered 200 with a token, so a client that
// still registers is caught by the assertion, not by a hang.
// ---------------------------------------------------------------------------
const seen = [];

function startFakeTheo() {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      let parsed = null;
      try { parsed = JSON.parse(body); } catch (_e) { parsed = null; }
      seen.push({
        method: req.method,
        path: req.url,
        headers: Object.assign({}, req.headers),
        rpc: parsed && parsed.method ? parsed.method : null,
        tool: parsed && parsed.params ? parsed.params.name || null : null,
      });
      if (req.url === '/register') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ token: 'fake-registered-token' }));
        return;
      }
      if (!parsed) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"bad_json"}');
        return;
      }
      let result;
      if (parsed.method === 'initialize') {
        result = { protocolVersion: '2024-11-05', capabilities: {} };
      } else if (parsed.method === 'tools/list') {
        result = { tools: [{ name: 'brain_stats' }] };
      } else if (parsed.method === 'tools/call') {
        const payload = (parsed.params && parsed.params.name === 'brain_stats')
          ? { nodes: FIXTURE_NODES, relationships: FIXTURE_RELS, labels: [] }
          : { ok: true };
        result = { content: [{ type: 'text', text: JSON.stringify(payload) }] };
      } else {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        res.end('');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end('data: ' + JSON.stringify({ jsonrpc: '2.0', id: parsed.id, result: result }) + '\n');
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server: server, url: 'http://127.0.0.1:' + server.address().port });
    });
  });
}

// A clean child env: nothing that could carry a key or opt out of anything.
function bareEnv(home, url) {
  const env = {};
  for (const k of Object.keys(process.env)) {
    if (/^MINDRIAN_/.test(k)) continue;
    env[k] = process.env[k];
  }
  env.HOME = home;
  env.USERPROFILE = home;
  env.MINDRIAN_BRAIN_URL = url;
  return env;
}

function run(cmd, args, opts) {
  return new Promise((resolve) => {
    const p = cp.spawn(cmd, args, Object.assign({ stdio: ['pipe', 'pipe', 'pipe'] }, opts));
    let out = '';
    let err = '';
    p.stdout.on('data', (c) => { out += c.toString('utf8'); });
    p.stderr.on('data', (c) => { err += c.toString('utf8'); });
    const timer = setTimeout(() => { try { p.kill('SIGKILL'); } catch (_e) { /* gone */ } }, 60000);
    p.on('close', (code) => { clearTimeout(timer); resolve({ code: code, out: out, err: err }); });
    if (opts && typeof opts.input === 'string') p.stdin.write(opts.input);
    p.stdin.end();
  });
}

// ---------------------------------------------------------------------------
// Walk the shipped surface (never a git index: a new untracked file counts).
// ---------------------------------------------------------------------------
// Built from char codes so this file itself carries no literal dash.
const DASH_RE = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']');

const SURFACE_DIRS = ['lib', 'scripts', 'bin', 'commands', 'skills', 'agents', 'hooks'];
const SKIP_DIR = new Set(['node_modules', 'dist', '.next', '.git', 'fixtures']);

function walk(dir, out) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else if (e.isFile()) {
      out.push(path.join(dir, e.name));
    }
  }
}

function surfaceFiles() {
  const all = [];
  for (const d of SURFACE_DIRS) walk(path.join(REPO, d), all);
  return all.map((f) => path.relative(REPO, f).split(path.sep).join('/'));
}

// Excluded from A4 by name, each for a stated reason:
//  - tests and test infrastructure (they pin behavior, they are not a user surface);
//  - scripts/admin-brain-write.cjs, scripts/backfill-correlation-id.cjs and
//    scripts/seed-brain-commands.cjs: ADMIN write paths, not user-facing, with
//    their own write-tier credential (Phase 369.5 work, named in the SUMMARY);
//  - scripts/eureka-jev-judge.cjs and scripts/spike-366.cjs: they say `no_key`
//    about the Jev (TypeSafe) evals credential, a different service entirely.
const A4_EXCLUDED = new Set([
  'scripts/admin-brain-write.cjs',
  'scripts/backfill-correlation-id.cjs',
  'scripts/seed-brain-commands.cjs',
  'scripts/eureka-jev-judge.cjs',
  'scripts/spike-366.cjs',
  'lib/memory/run-feynman-tests.cjs',
]);

function a4Candidate(rel) {
  if (A4_EXCLUDED.has(rel)) return false;
  if (/\.test\.cjs$/.test(rel)) return false;
  if (/(^|\/)test-[^/]*\.(cjs|js|py)$/.test(rel)) return false;
  if (!/\.(cjs|js|mjs|ts|md|json|sh|py)$/.test(rel) && !/^scripts\/[^./]+$/.test(rel) && !/^hooks\/[^./]+$/.test(rel)) return false;
  return true;
}

// Every line a user can read about a key, the register leg or Tier 0 on the
// Theo path. `Tier 0` is also the name of an unrelated cold-start rung in the
// local room-graph code (room.db absent), so it is checked only on the files
// that carry the Theo path (TIER0_FILES), never repo-wide.
const KEY_PAT = /MINDRIAN_BRAIN_KEY|no_key\b|tier0Response|mindrian-install\.json|DISABLE_AUTO_REGISTER|Brain key|\/register(?![-\w])/;
const TIER0_PAT = /Tier 0/;
const TIER0_FILES = [
  'lib/core/brain-client.cjs',
  'lib/core/resolve-brain-key.cjs',
  'lib/core/install-id.cjs',
  'lib/core/refusal-messaging.cjs',
  'lib/hmi/tier-check.cjs',
  'lib/hmi/decoy-tier.cjs',
  'lib/statusline/cockpit-signals.cjs',
  'lib/core/doctor/mcp-surface-module.cjs',
  'lib/core/doctor/class-m-brain-smoke.cjs',
  'lib/mcp/surface-detect.cjs',
  'scripts/mindrian-brain-mcp-client.cjs',
  'scripts/session-start',
  'scripts/context-monitor',
  'scripts/first-install-router.cjs',
  'scripts/build-brain-census.cjs',
  'scripts/check-flagship-floor.cjs',
  'scripts/probe-brain-contract.cjs',
  'skills/brain-connector/SKILL.md',
  'bin/cli.js',
];
// commands/setup.md and skills/setup/SKILL.md are checked against KEY_PAT above but not for
// `Tier 0`: their HSI section has an unrelated tier ladder (tier:0 keyword-only HSI).

// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];

function record(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => { passed += 1; console.log('  ok   ' + name); })
    .catch((e) => {
      failed += 1;
      failures.push(name);
      console.log('  FAIL ' + name);
      console.log('       ' + String(e && e.message ? e.message : e).split('\n').join('\n       '));
    });
}

async function main() {
  console.log('Quick 261005-l8g: the bare Theo path (no key, no bearer, no register, no Tier 0)');
  const { server, url } = await startFakeTheo();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'l8g-home-'));
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'l8g-cwd-'));
  const env = bareEnv(home, url);

  const probeSrc = [
    "const bc = require(" + JSON.stringify(path.join(REPO, 'lib', 'core', 'brain-client.cjs')) + ");",
    "(async () => {",
    "  const out = { available: bc.isAvailable() };",
    "  const s = await bc.stats();",
    "  out.nodes = s && s.nodes;",
    "  out.raw = JSON.stringify(s);",
    "  console.log('PROBE ' + JSON.stringify(out));",
    "})().catch((e) => { console.log('PROBE ' + JSON.stringify({ threw: String(e && e.message) })); });",
  ].join('\n');

  let probe = null;
  try {
    const r = await run('node', ['-e', probeSrc], { cwd: cwd, env: env });
    const line = r.out.split('\n').find((l) => l.startsWith('PROBE '));
    probe = line ? JSON.parse(line.slice(6)) : { parseFailed: r.out + r.err };
  } catch (e) {
    probe = { spawnFailed: String(e) };
  }

  await record('A1 isAvailable() is true with nothing configured', () => {
    assert.equal(probe.available, true, 'isAvailable() was ' + probe.available + ' on a fresh HOME (probe: ' + JSON.stringify(probe) + ')');
  });

  await record('A2 one stats() call: no Authorization header, no /register, no install json, fixture node count', () => {
    const withAuth = seen.filter((r) => r.headers && r.headers.authorization !== undefined);
    const registers = seen.filter((r) => r.path === '/register');
    assert.equal(withAuth.length, 0, withAuth.length + ' request(s) carried an Authorization header: ' +
      JSON.stringify(withAuth.map((r) => ({ path: r.path, rpc: r.rpc, authorization: '(present)' }))));
    assert.equal(registers.length, 0, registers.length + ' POST /register request(s) reached the fake Theo');
    assert.equal(fs.existsSync(path.join(home, '.mindrian-install.json')), false, '~/.mindrian-install.json was written');
    assert.equal(probe.nodes, FIXTURE_NODES, 'stats() node count was ' + probe.nodes + ', fixture is ' + FIXTURE_NODES + ' (raw: ' + String(probe.raw).slice(0, 200) + ')');
  });

  await record('A3 the shim answers brain_stats over stdio with the fixture payload, not a tier0 or no_key refusal', async () => {
    const before = seen.length;
    const input = [
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'l8g', version: '1.0.0' } } },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'brain_stats', arguments: {} } },
    ].map((o) => JSON.stringify(o)).join('\n') + '\n';
    // The shim exits when stdin closes; give it a moment to answer first.
    const shimResult = await new Promise((resolve) => {
      const p = cp.spawn('node', [SHIM], { cwd: cwd, env: env, stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      let done = false;
      const finish = (v) => { if (done) return; done = true; try { p.kill('SIGKILL'); } catch (_e) { /* gone */ } resolve(v); };
      p.stdout.on('data', (c) => {
        out += c.toString('utf8');
        for (const l of out.split('\n')) {
          if (!l.trim()) continue;
          try {
            const o = JSON.parse(l);
            if (o && o.id === 2) finish({ resp: o, err: err });
          } catch (_e) { /* partial line */ }
        }
      });
      p.stderr.on('data', (c) => { err += c.toString('utf8'); });
      p.on('close', () => finish({ resp: null, err: err }));
      setTimeout(() => finish({ resp: null, err: err + ' (timeout)' }), 30000);
      p.stdin.write(input);
    });
    assert.ok(shimResult.resp, 'no tools/call answer from the shim; stderr tail: ' + shimResult.err.slice(-400));
    const content = shimResult.resp.result && shimResult.resp.result.content && shimResult.resp.result.content[0];
    assert.ok(content && content.type === 'text', 'expected text content: ' + JSON.stringify(shimResult.resp).slice(0, 300));
    const body = JSON.parse(content.text);
    assert.notEqual(body.status, 'DIRECTOR_NOT_AVAILABLE', 'the shim answered the keyless sentinel: ' + content.text.slice(0, 300));
    assert.ok(!/no_key|Tier 0|tier_0/i.test(content.text), 'the shim answer names a key refusal: ' + content.text.slice(0, 300));
    assert.equal(body.nodes, FIXTURE_NODES, 'shim brain_stats nodes was ' + body.nodes + ', fixture is ' + FIXTURE_NODES);
    const shimReqs = seen.slice(before);
    assert.equal(shimReqs.filter((r) => r.headers.authorization !== undefined).length, 0, 'the shim sent an Authorization header');
    assert.equal(shimReqs.filter((r) => r.path === '/register').length, 0, 'the shim made a /register call');
  });

  await record('A4 no key / Tier 0 / no_key / register lines on the shipped surface', () => {
    const offenders = [];
    for (const rel of surfaceFiles()) {
      if (!a4Candidate(rel)) continue;
      let text = '';
      try { text = fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch (_e) { continue; }
      const lines = text.split('\n');
      const tier0Here = TIER0_FILES.indexOf(rel) !== -1;
      for (let i = 0; i < lines.length; i += 1) {
        if (KEY_PAT.test(lines[i]) || (tier0Here && TIER0_PAT.test(lines[i]))) {
          offenders.push(rel + ':' + (i + 1) + ': ' + lines[i].trim().slice(0, 160));
        }
      }
    }
    assert.equal(offenders.length, 0, offenders.length + ' offending line(s):\n' + offenders.join('\n'));
  });

  await record('A5 scripts/session-start offline under the isolated HOME names no key, Tier 0 or "not configured"', async () => {
    // A brand-new HOME: earlier arms must not leave state (an install json) behind for this one.
    const freshHome = fs.mkdtempSync(path.join(os.tmpdir(), 'l8g-ss-home-'));
    const r = await run('bash', [path.join(REPO, 'scripts', 'session-start')], {
      cwd: cwd,
      env: Object.assign({}, bareEnv(freshHome, 'http://127.0.0.1:9')),
      input: '',
    });
    try { fs.rmSync(freshHome, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
    const bad = (r.out + '\n' + r.err).split('\n').filter((l) => /Brain key|Tier 0|not configured/.test(l));
    assert.equal(bad.length, 0, bad.length + ' offending line(s) from session-start:\n' + bad.join('\n'));
  });

  await record('A6 no em or en dash in the files this quick touches', () => {
    const touched = [
      'lib/core/brain-client.cjs', 'lib/core/resolve-brain-key.cjs', 'lib/core/install-id.cjs',
      'lib/core/refusal-messaging.cjs', 'lib/hmi/tier-check.cjs', 'lib/hmi/decoy-tier.cjs',
      'lib/statusline/cockpit-signals.cjs', 'lib/core/doctor/mcp-surface-module.cjs',
      'lib/core/doctor/class-m-brain-smoke.cjs', 'lib/mcp/surface-detect.cjs',
      'scripts/mindrian-brain-mcp-client.cjs', 'scripts/session-start', 'scripts/context-monitor',
      'scripts/first-install-router.cjs', 'scripts/build-brain-census.cjs',
      'scripts/check-flagship-floor.cjs', 'scripts/probe-brain-contract.cjs',
      'commands/setup.md', 'skills/setup/SKILL.md', 'skills/brain-connector/SKILL.md',
      'bin/cli.js', 'tests/test-l8g-theo-bare.cjs',
    ];
    const hits = [];
    for (const rel of touched) {
      let text = '';
      try { text = fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch (_e) { continue; }
      text.split('\n').forEach((l, i) => { if (DASH_RE.test(l)) hits.push(rel + ':' + (i + 1)); });
    }
    // CHANGELOG.md carries pre-existing dashes in old entries; only this quick's own entry is checked.
    const cl = fs.readFileSync(path.join(REPO, 'CHANGELOG.md'), 'utf8').split('\n');
    cl.forEach((l, i) => { if (/No key on the Theo path/.test(l) && DASH_RE.test(l)) hits.push('CHANGELOG.md:' + (i + 1)); });
    assert.equal(hits.length, 0, hits.length + ' dash(es): ' + hits.join(', '));
  });

  await record('A7 Part 8 stays: test-239 canary and test-257 egress invariant both exit 0', async () => {
    const a = await run('node', [path.join(REPO, 'tests', 'test-239-query-egress-canary.cjs')], { cwd: REPO });
    assert.equal(a.code, 0, 'test-239-query-egress-canary exited ' + a.code + '\n' + a.out.slice(-600));
    const b = await run('node', [path.join(REPO, 'tests', 'test-257-brain-tool-egress-invariant.cjs')], { cwd: REPO });
    // 369.2-08 (CODE-07, 2026-10-05): this arm used to tolerate exactly one known
    // red, test-257 Arm 2, because the shim's startup pre-warm (quick 260911-ddd)
    // sends a content-free theo_health call that the suite's zero-socket
    // assertion counted. 369.2-08 root-caused it (the pre-warm lands inside the
    // second canary call's window; the Part 8 check itself runs first and opens
    // no socket) and fixed it in the suite, which now ignores only that empty
    // theo_health shape. The suite exits 0, so the arm asks for exactly that:
    // no tolerated failure remains.
    assert.equal(b.code, 0, 'test-257-brain-tool-egress-invariant exited ' + b.code + '\n' + b.out.slice(-600));
  });

  server.close();
  try { fs.rmSync(home, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  try { fs.rmSync(cwd, { recursive: true, force: true }); } catch (_e) { /* best effort */ }

  console.log('\nl8g bare Theo path: ' + passed + ' passed, ' + failed + ' failed' + (failed ? ' (' + failures.join('; ') + ')' : ''));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error('FATAL ' + (e && e.stack || e)); process.exit(2); });
