#!/usr/bin/env node
'use strict';

/**
 * Phase 267 Plan 13 (MCPV2-14, MCPV2-15) -- process lifecycle of the LOCAL
 * server (bin/mindrian-mcp-server.cjs).
 * ==========================================================================
 * RCA 5 (.planning/debug/mcp-server-sigterm-no-exit.md): registerShutdownHandler
 * installs SIGTERM/SIGINT listeners that snapshot and tear down but never exit,
 * and installing any listener removes Node's default exit-on-signal. The server
 * therefore survives SIGTERM and holds its port.
 * RCA 6 (.planning/debug/mcp-http-listen-error-false-started.md): Express 5
 * passes bind errors to the app.listen callback, which ignored them, so a failed
 * bind printed the "started" line (and flag-ON wrote a pidfile).
 *
 * Arms:
 *   1. HTTP flag-OFF: SIGTERM after the listen line -> exit 0 within 3000 ms,
 *      stderr has the session snapshot line, port 3847 released.
 *   2. HTTP flag-ON (MINDRIAN_MCP_FIRST=cowork, hermetic rooms home): pidfile
 *      exists after listen; SIGTERM -> exit 0 within 3000 ms, pidfile gone.
 *   3. stdio: initialize sent, stdin held open, SIGTERM -> exit within 3000 ms.
 *   4. Listen error: 127.0.0.1:3847 held by a TEST-OWNED net server -> the
 *      flag-OFF server exits 1 within 5000 ms, stderr names EADDRINUSE and 3847,
 *      and never prints the "started ... HTTP on 127.0.0.1:3847" success line.
 *
 * Port 3847 is fixed. If something this test did not spawn holds it, exit 77
 * (ENV GAP) naming the PID; never kill it. Only PIDs this test spawned are
 * SIGKILLed (in finally). SIGKILL is also the cleanup for any arm that fails
 * to exit on its own.
 *
 * No em-dashes (hyphens only). CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const cp = require('node:child_process');

const { hermeticEnv, LOCAL_SERVER } = require('./helpers/mcp-wire-267.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const PORT = 3847;
const EXIT_BOUND_MS = 3000;
const LISTEN_ERROR_BOUND_MS = 5000;
const SNAPSHOT_LINE = '[session-catchup] Session state saved on shutdown.';

let passed = 0;
let failed = 0;
const spawned = [];

async function test(name, fn) {
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

function portHeld() {
  return new Promise((resolve) => {
    const s = net.connect({ host: '127.0.0.1', port: PORT });
    s.once('connect', () => {
      s.destroy();
      resolve(true);
    });
    s.once('error', () => resolve(false));
  });
}

function holderPid() {
  try {
    const out = cp.execSync('ss -ltnp 2>/dev/null | grep ":' + PORT + ' " || true').toString();
    const m = out.match(/pid=(\d+)/);
    return m ? m[1] : 'unknown';
  } catch (_e) {
    return 'unknown';
  }
}

function killSpawned(child) {
  if (child && typeof child.pid === 'number') {
    try {
      process.kill(child.pid, 'SIGKILL');
    } catch (_e) {
      /* already gone */
    }
  }
}

// Spawn the local server. Tracks stderr, exit state and exit time.
function spawnServer(overrides) {
  const hermetic = hermeticEnv(overrides);
  const child = cp.spawn('node', [LOCAL_SERVER], { cwd: REPO_ROOT, env: hermetic.env, stdio: ['pipe', 'pipe', 'pipe'] });
  spawned.push(child);
  const state = { child, hermetic, stderr: '', exited: false, exitCode: null, exitSignal: null, exitAt: 0 };
  child.stderr.on('data', (c) => {
    state.stderr += c.toString('utf8');
  });
  child.stdout.on('data', () => {});
  child.on('exit', (code, signal) => {
    state.exited = true;
    state.exitCode = code;
    state.exitSignal = signal;
    state.exitAt = Date.now();
  });
  return state;
}

async function waitFor(pred, timeoutMs, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (pred()) return;
    await sleep(50);
  }
  throw new Error('timed out after ' + timeoutMs + ' ms waiting for ' + label);
}

// Send a signal and wait up to boundMs for exit. Returns elapsed ms or throws.
async function signalAndAwaitExit(state, signal, boundMs) {
  const t0 = Date.now();
  state.child.kill(signal);
  const deadline = t0 + boundMs;
  while (Date.now() < deadline && !state.exited) await sleep(25);
  if (!state.exited) {
    throw new Error('process did not exit within ' + boundMs + ' ms after ' + signal + ' (still alive; stderr tail: ' + state.stderr.slice(-300) + ')');
  }
  return state.exitAt - t0;
}

async function waitListening(state) {
  await waitFor(() => state.stderr.includes('HTTP on 127.0.0.1:') || state.exited, 30000, 'the HTTP listen line');
  if (state.exited) throw new Error('server exited before listening (code ' + state.exitCode + '); stderr: ' + state.stderr.slice(-300));
}

async function main() {
  if (await portHeld()) {
    console.log('ENV GAP: port ' + PORT + ' is held by pid ' + holderPid() + ' (not spawned by this test); not killing it.');
    process.exit(77);
  }

  // ---- Arm 1: HTTP flag-OFF -------------------------------------------------
  await test('HTTP flag-OFF: SIGTERM exits 0 within ' + EXIT_BOUND_MS + ' ms, snapshot saved, port released', async () => {
    const srv = spawnServer({ MINDRIAN_TRANSPORT: 'http' });
    try {
      await waitListening(srv);
      const ms = await signalAndAwaitExit(srv, 'SIGTERM', EXIT_BOUND_MS);
      console.log('    flag-OFF exit after ' + ms + ' ms, code ' + srv.exitCode);
      assert.equal(srv.exitCode, 0, 'exit code must be 0, got ' + srv.exitCode + ' (signal ' + srv.exitSignal + ')');
      assert.ok(srv.stderr.includes(SNAPSHOT_LINE), 'stderr must contain the session snapshot line (teardown ran before exit)');
      await sleep(100);
      assert.equal(await portHeld(), false, 'port ' + PORT + ' must be released after exit');
    } finally {
      killSpawned(srv.child);
      await sleep(150);
      srv.hermetic.cleanup();
    }
  });

  // ---- Arm 2: HTTP flag-ON --------------------------------------------------
  await test('HTTP flag-ON: pidfile written, SIGTERM exits 0 within ' + EXIT_BOUND_MS + ' ms, pidfile cleared', async () => {
    const srv = spawnServer({ MINDRIAN_TRANSPORT: 'http', MINDRIAN_MCP_FIRST: 'cowork' });
    const pidfile = path.join(srv.hermetic.dirs.roomsHome, '.rooms', 'daemon', 'mcp-daemon.json');
    try {
      await waitListening(srv);
      await waitFor(() => fs.existsSync(pidfile), 5000, 'the flag-ON pidfile');
      const rec = JSON.parse(fs.readFileSync(pidfile, 'utf8'));
      assert.equal(rec.pid, srv.child.pid, 'pidfile pid must be the spawned server pid');
      const ms = await signalAndAwaitExit(srv, 'SIGTERM', EXIT_BOUND_MS);
      console.log('    flag-ON exit after ' + ms + ' ms, code ' + srv.exitCode);
      assert.equal(srv.exitCode, 0, 'exit code must be 0, got ' + srv.exitCode + ' (signal ' + srv.exitSignal + ')');
      assert.equal(fs.existsSync(pidfile), false, 'pidfile must be cleared on shutdown');
      assert.ok(srv.stderr.includes(SNAPSHOT_LINE), 'stderr must contain the session snapshot line');
    } finally {
      killSpawned(srv.child);
      await sleep(150);
      srv.hermetic.cleanup();
    }
  });

  // ---- Arm 3: stdio ---------------------------------------------------------
  await test('stdio: initialize sent, stdin open, SIGTERM exits within ' + EXIT_BOUND_MS + ' ms', async () => {
    const srv = spawnServer({ MINDRIAN_TRANSPORT: 'stdio' });
    try {
      await waitFor(() => srv.stderr.includes('started (') || srv.exited, 30000, 'the stdio started line');
      if (srv.exited) throw new Error('server exited before start (code ' + srv.exitCode + ')');
      srv.child.stdin.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test-267-13', version: '1' } },
        }) + '\n'
      );
      await sleep(500);
      const ms = await signalAndAwaitExit(srv, 'SIGTERM', EXIT_BOUND_MS);
      console.log('    stdio exit after ' + ms + ' ms, code ' + srv.exitCode);
      assert.equal(srv.exitCode, 0, 'exit code must be 0, got ' + srv.exitCode + ' (signal ' + srv.exitSignal + ')');
    } finally {
      killSpawned(srv.child);
      await sleep(150);
      srv.hermetic.cleanup();
    }
  });

  // ---- Arm 4: listen error --------------------------------------------------
  await test('listen error: port held by a foreign listener -> exit 1 within ' + LISTEN_ERROR_BOUND_MS + ' ms, honest EADDRINUSE line, no started line, no pidfile', async () => {
    const holder = net.createServer();
    await new Promise((resolve, reject) => {
      holder.once('error', reject);
      holder.listen(PORT, '127.0.0.1', resolve);
    });
    // The pidfile lands under the hermetic rooms home; flag-OFF must never write it.
    const srv = spawnServer({ MINDRIAN_TRANSPORT: 'http' });
    const pidfile = path.join(srv.hermetic.dirs.roomsHome, '.rooms', 'daemon', 'mcp-daemon.json');
    try {
      const t0 = Date.now();
      while (Date.now() - t0 < LISTEN_ERROR_BOUND_MS && !srv.exited) await sleep(50);
      assert.ok(srv.exited, 'server must exit within ' + LISTEN_ERROR_BOUND_MS + ' ms of a failed bind (still alive; stderr tail: ' + srv.stderr.slice(-300) + ')');
      assert.equal(srv.exitCode, 1, 'exit code must be 1, got ' + srv.exitCode + ' (signal ' + srv.exitSignal + ')');
      assert.ok(/EADDRINUSE/.test(srv.stderr), 'stderr must name EADDRINUSE; got: ' + srv.stderr.slice(-300));
      assert.ok(srv.stderr.includes(String(PORT)), 'stderr must name port ' + PORT);
      const falseStarted = /MCP server v/.test(srv.stderr) && srv.stderr.includes('HTTP on 127.0.0.1:' + PORT);
      assert.equal(falseStarted, false, 'stderr must NOT print the "started ... HTTP on 127.0.0.1:' + PORT + '" success line');
      assert.equal(fs.existsSync(pidfile), false, 'no pidfile may be written on a failed bind');
    } finally {
      killSpawned(srv.child);
      await new Promise((resolve) => holder.close(() => resolve()));
      await sleep(150);
      srv.hermetic.cleanup();
    }
  });

  // ---- Hygiene --------------------------------------------------------------
  await test('process hygiene: no spawned server alive and port ' + PORT + ' free', async () => {
    for (const c of spawned) {
      let alive = true;
      try {
        process.kill(c.pid, 0);
      } catch (_e) {
        alive = false;
      }
      assert.equal(alive, false, 'spawned pid ' + c.pid + ' still alive');
    }
    assert.equal(await portHeld(), false, 'port ' + PORT + ' still held after the run');
  });

  console.log('');
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  for (const c of spawned) killSpawned(c);
  console.error('FATAL:', err);
  process.exit(1);
});
