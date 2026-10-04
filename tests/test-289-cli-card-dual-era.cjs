#!/usr/bin/env node
'use strict';

/**
 * Normal card on CLI (navigator ruling 2026-10-02): a gate is the AskUserQuestion card on every Claude host surface, on both protocol eras, and never also an MCP elicitation for the same decision.
 * ==========================================================================
 * Phase 289 plan 01 (CARD289-02). Live, hermetic, three legs. This is the ONLY
 * Phase 289 test that carries the ruling's literal name: Phase 369's probe
 * accepts a passing tests/test-289-*.cjs containing it, and
 * 289-CLI-CARD-RULING.md will name THIS file as the proof.
 *
 * Why each leg exists:
 *   - stdio era 2025: the 2.1.281-style CLI that declared elicitation at
 *     initialize. Today the server hands that client an elicitation dialog
 *     (rung (a)); the ruling says it must get the card (rung (b)). Run twice:
 *     (a) CLAUDE_SURFACE=cli with MINDRIAN_TRANSPORT unset, (b) the default
 *     hermetic env (MINDRIAN_TRANSPORT=stdio, which the server reads as the
 *     desktop surface).
 *   - stdio era 2026: what Claude Code 2.1.287 does today. It opens with
 *     server/discover and sends no initialize-time capabilities
 *     (267-TRIPOLAR-PROBES.md lines 69-87), so the server cannot see a
 *     declared elicitation. The card must still come back.
 *   - HTTP daemon (flag ON, surface cowork): SDK 2.1.0's HTTP handler
 *     backfills client capabilities from each 2026 request envelope
 *     (@modelcontextprotocol/server dist/index.cjs:1405-1408, read in research,
 *     MEASURED HERE for the first time). A 2026 client that declares
 *     elicitation must therefore still get the card, not a dialog. A
 *     legacy-mode client on the same daemon is checked the same way.
 *
 * The gate is never answered here: no room write, the ledger is another
 * plan's concern. Every test is hermetic: temp HOME and MINDRIAN_ROOMS_HOME,
 * MINDRIAN_BRAIN_URL=http://127.0.0.1:9, every spawned PID SIGKILLed in
 * finally. A daemon that cannot start, or a missing client package, is exit 77
 * (ENV GAP), never a PASS. Exit 1 on any assertion failure.
 *
 * No em-dashes (hyphens only). CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const { hermeticEnv, LOCAL_SERVER } = require('./helpers/mcp-wire-267.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');

console.log('Normal card on CLI');

let sdk = null;
let sdkStdio = null;
try {
  sdk = require('@modelcontextprotocol/client');
  sdkStdio = require('@modelcontextprotocol/client/stdio');
} catch (e) {
  console.log('ENV GAP: @modelcontextprotocol/client cannot be required (' + (e && e.message ? e.message : e) + ')');
  process.exit(77);
}
const { Client, StreamableHTTPClientTransport } = sdk;
const { StdioClientTransport } = sdkStdio;

let passed = 0;
let failed = 0;
async function leg(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  ok ' + name);
  } catch (err) {
    failed += 1;
    console.log('  FAIL ' + name);
    console.log('    ' + (err && err.message ? err.message : String(err)));
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Process bookkeeping (copied from tests/test-267-mcpv2-dual-era.cjs so a peer
// edit to a shared helper cannot move this proof).
// ---------------------------------------------------------------------------
const spawnedPids = [];
const cleanups = [];

function isAlive(pid) {
  if (typeof pid !== 'number') return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return !(e && e.code === 'ESRCH');
  }
}

function serverPids() {
  const escaped = LOCAL_SERVER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    const out = cp.execSync('pgrep -f "node .*' + escaped + '" || true').toString().trim();
    return out ? out.split('\n').map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n)) : [];
  } catch (_e) {
    return [];
  }
}
const PIDS_BEFORE = new Set(serverPids());

function killPid(pid) {
  if (typeof pid !== 'number') return;
  try {
    process.kill(pid, 'SIGKILL');
  } catch (_e) {
    /* already gone */
  }
}

// ---------------------------------------------------------------------------
// The fixture card. Ids differ from labels on purpose.
// ---------------------------------------------------------------------------
const GATE_CARD = {
  gate_id: 'gate-289-dual-era',
  header: 'Pick one',
  options: [
    { id: 'opt-top', label: 'Top choice', rank: 1 },
    { id: 'opt-second', label: 'Second choice', rank: 2 },
  ],
};

function parseToolText(result) {
  const text = result && result.content && result.content[0] && result.content[0].text;
  assert.ok(typeof text === 'string' && text.length > 0, 'tool must return text content');
  return JSON.parse(text);
}

const AUTO = { versionNegotiation: { mode: 'auto' } };
const LEGACY = { versionNegotiation: { mode: 'legacy' } };

// A client that declares elicitation and records every elicitation/create it receives.
function elicitingClient(extraOptions) {
  const seen = [];
  const client = new Client(
    { name: 'test-289-card-probe', version: '1' },
    Object.assign({ capabilities: { elicitation: {} } }, extraOptions || {})
  );
  client.setRequestHandler('elicitation/create', async (request) => {
    seen.push(request);
    return { action: 'accept', content: { choice: 'opt-top' } };
  });
  return { client, seen };
}

async function stdioConnect(env, extraOptions) {
  const transport = new StdioClientTransport({ command: 'node', args: [LOCAL_SERVER], env: env, cwd: REPO_ROOT });
  const { client, seen } = elicitingClient(extraOptions);
  // Track the pid as soon as the transport has one, even if connect() throws.
  const origStart = transport.start.bind(transport);
  transport.start = async function () {
    const r = await origStart();
    if (typeof transport.pid === 'number') spawnedPids.push(transport.pid);
    return r;
  };
  await client.connect(transport);
  if (typeof transport.pid === 'number' && !spawnedPids.includes(transport.pid)) spawnedPids.push(transport.pid);
  return { client, transport, seen };
}

async function stdioClose(conn) {
  try {
    await conn.client.close();
  } catch (_e) {
    /* best effort */
  }
  killPid(conn.transport.pid);
}

// Call gate_render on the fixture card and assert the ruling: zero elicitation
// requests reached the client, and the result is the AskUserQuestion card.
async function assertCard(conn, expectedVersion, label) {
  // 369-41 (plan 369-38 WR-05): a caller-chosen gate_id that is still open is gate_id_in_use, so each leg draws the card
  // under its own id (the 2026 and the legacy HTTP legs share one daemon).
  const card = Object.assign({}, GATE_CARD, { gate_id: GATE_CARD.gate_id + '-' + label.replace(/[^a-z0-9]+/gi, '-') });
  const result = await conn.client.callTool({ name: 'gate_render', arguments: card });
  let body = null;
  let parseError = null;
  try {
    body = parseToolText(result);
  } catch (e) {
    parseError = e;
  }
  console.log(
    '    ' + label + ': negotiated ' + conn.client.getNegotiatedProtocolVersion() +
    '; elicitation requests seen: ' + conn.seen.length +
    '; renderer ' + (body ? body.renderer : 'unparseable') +
    (body && body.ok === false ? '; refused: ' + body.reason + ' (' + String(body.detail || '').slice(0, 140) + ')' : '')
  );
  if (expectedVersion) {
    assert.equal(conn.client.getNegotiatedProtocolVersion(), expectedVersion, 'must negotiate ' + expectedVersion);
  }
  assert.equal(conn.seen.length, 0, 'no elicitation request may reach a Claude host client, saw ' + conn.seen.length);
  assert.ok(!parseError, 'gate_render result must parse as JSON');
  assert.equal(body.ok, true, 'gate_render must succeed');
  assert.equal(body.renderer, 'askuserquestion', 'renderer must be rung (b), the AskUserQuestion card');
  assert.equal(body.gate_id, card.gate_id, 'the result must carry the card gate_id usable by gate_answer');
  const rows = body.rendered && body.rendered.contract && body.rendered.contract.superset_options;
  assert.ok(Array.isArray(rows), 'rendered.contract.superset_options must be an array');
  assert.deepEqual(rows.map((r) => r.id), ['opt-top', 'opt-second'], 'superset option ids must be the card option ids');
}

// ---------------------------------------------------------------------------
// The HTTP daemon recipe (copied from tests/test-267-mcpv2-flag-on.cjs).
// ---------------------------------------------------------------------------
function startDaemon() {
  const hermetic = hermeticEnv({ MINDRIAN_TRANSPORT: 'http', MINDRIAN_MCP_FIRST: 'cowork' });
  cleanups.push(hermetic.cleanup);
  const roomsHome = hermetic.dirs.roomsHome;
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  fs.writeFileSync(
    path.join(roomsHome, '.rooms', 'registry.json'),
    JSON.stringify(
      { active: 'room-267', rooms: { 'room-267': { slug: 'room-267', abs_path: hermetic.dirs.roomDir } } },
      null,
      2
    )
  );
  const child = cp.spawn('node', [LOCAL_SERVER], { cwd: REPO_ROOT, env: hermetic.env, stdio: ['ignore', 'pipe', 'pipe'] });
  if (typeof child.pid === 'number') spawnedPids.push(child.pid);
  let stderr = '';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('daemon did not report its port within 30s; stderr: ' + stderr.slice(-400)));
    }, 30000);
    child.stderr.on('data', (c) => {
      stderr += c.toString('utf8');
      const m = stderr.match(/HTTP on 127\.0\.0\.1:(\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve({ child, hermetic, port: Number(m[1]) });
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error('daemon exited early (code ' + code + '); stderr: ' + stderr.slice(-400)));
    });
  });
}

async function httpConnect(port, extraOptions) {
  const { client, seen } = elicitingClient(extraOptions);
  const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:' + port + '/mcp'));
  await client.connect(transport);
  return { client, transport, seen };
}

async function httpClose(conn) {
  try {
    await conn.transport.terminateSession();
  } catch (_e) {
    /* best effort */
  }
  try {
    await conn.client.close();
  } catch (_e) {
    /* best effort */
  }
}

async function main() {
  // Leg 1: stdio era 2025, two surface variants.
  await leg('stdio era 2025, CLAUDE_SURFACE=cli (MINDRIAN_TRANSPORT unset): the card, no elicitation request', async () => {
    const hermetic = hermeticEnv({ CLAUDE_SURFACE: 'cli' });
    cleanups.push(hermetic.cleanup);
    delete hermetic.env.MINDRIAN_TRANSPORT; // hermeticEnv sets stdio, which would win over CLAUDE_SURFACE
    const conn = await stdioConnect(hermetic.env);
    try {
      await assertCard(conn, '2025-11-25', 'stdio 2025 cli');
    } finally {
      await stdioClose(conn);
    }
  });

  await leg('stdio era 2025, default hermetic env (surface desktop): the card, no elicitation request', async () => {
    const hermetic = hermeticEnv({});
    cleanups.push(hermetic.cleanup);
    const conn = await stdioConnect(hermetic.env);
    try {
      await assertCard(conn, '2025-11-25', 'stdio 2025 desktop');
    } finally {
      await stdioClose(conn);
    }
  });

  // Leg 2: stdio era 2026.
  await leg('stdio era 2026 (auto-negotiating client): the card, no elicitation request', async () => {
    const hermetic = hermeticEnv({});
    cleanups.push(hermetic.cleanup);
    const conn = await stdioConnect(hermetic.env, AUTO);
    try {
      await assertCard(conn, '2026-07-28', 'stdio 2026');
    } finally {
      await stdioClose(conn);
    }
  });

  // Leg 3: the HTTP daemon.
  let srv = null;
  let pidfilePid = null;
  let envGap = null;
  try {
    try {
      srv = await startDaemon();
    } catch (e) {
      envGap = 'daemon cannot start: ' + (e && e.message ? e.message : String(e));
    }
    if (srv) {
      const pidfile = path.join(srv.hermetic.dirs.roomsHome, '.rooms', 'daemon', 'mcp-daemon.json');
      try {
        pidfilePid = JSON.parse(fs.readFileSync(pidfile, 'utf8')).pid;
      } catch (_e) {
        pidfilePid = srv.child.pid;
      }

      await leg('HTTP daemon (cowork), 2026 client declaring elicitation: the card, no elicitation request', async () => {
        const conn = await httpConnect(srv.port, AUTO);
        try {
          await assertCard(conn, '2026-07-28', 'http 2026');
        } finally {
          await httpClose(conn);
        }
      });

      await leg('HTTP daemon (cowork), legacy-mode client declaring elicitation: the card, no elicitation request', async () => {
        const conn = await httpConnect(srv.port, LEGACY);
        try {
          await assertCard(conn, null, 'http legacy');
        } finally {
          await httpClose(conn);
        }
      });
    }
  } finally {
    if (srv && srv.child) killPid(srv.child.pid);
    // The pidfile lives inside this test's hermetic rooms home, so a pid in it
    // was written by the daemon this test spawned.
    if (srv && pidfilePid && srv.child && pidfilePid !== srv.child.pid) killPid(pidfilePid);
    await sleep(300);
  }

  // Hygiene leg: nothing this test started survives.
  await leg('process hygiene: no bin/mindrian-mcp-server.cjs process this test started survives', async () => {
    for (const pid of spawnedPids) killPid(pid);
    await sleep(300);
    for (const pid of spawnedPids) {
      assert.equal(isAlive(pid), false, 'pid ' + pid + ' (a process this test started) is still alive');
    }
    if (pidfilePid && !spawnedPids.includes(pidfilePid)) {
      assert.equal(isAlive(pidfilePid), false, 'pidfile pid ' + pidfilePid + ' is still alive');
    }
    const leaked = serverPids().filter((p) => !PIDS_BEFORE.has(p));
    if (leaked.length > 0) {
      for (const p of leaked) killPid(p);
      assert.fail('local server process(es) started by this test survived: ' + leaked.join(', '));
    }
  });

  for (const c of cleanups) {
    try {
      c();
    } catch (_e) {
      /* best effort */
    }
  }

  console.log('');
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  if (failed > 0) process.exit(1);
  if (envGap) {
    console.log('ENV GAP: ' + envGap);
    process.exit(77);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  for (const pid of spawnedPids) killPid(pid);
  process.exit(1);
});
