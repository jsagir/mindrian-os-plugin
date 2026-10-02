'use strict';
/*
 * tests/helpers/mcp-daemon-369.cjs -- Phase 369-04 hermetic flag-ON daemon
 * harness, the same for every later Phase 369 test (D-19).
 *
 * Exports:
 *   startDaemon({ rooms, extraEnv })  spawn the shipped Phase 267 server
 *                                     (bin/mindrian-mcp-server.cjs) over HTTP
 *                                     with seeded fixture rooms; resolves
 *                                     { child, port, roomsHome, roomDirs,
 *                                       pidfilePath, getStderr, env, cleanup }
 *   restartDaemon(handle)             SIGKILL only the spawned child, wait for
 *                                     it to exit, respawn on the SAME hermetic
 *                                     env and rooms home (room.db files and
 *                                     .rooms/sessions/ binding files survive
 *                                     exactly as on a user's machine); resolves
 *                                     a fresh handle with the new port
 *   stopDaemon(handle)                SIGKILL only handle.child.pid (and the
 *                                     pidfile pid if it differs and lives in
 *                                     this hermetic rooms home), then remove
 *                                     the hermetic dirs
 *   legacyClient(port, name)          connected { client, transport, close }
 *                                     with versionNegotiation { mode: 'legacy' }
 *                                     (explicit per D-19, so an SDK default
 *                                     change cannot silently move the shell's
 *                                     tests onto the stateless leg)
 *   autoClient(port, name)            the same with { mode: 'auto' }
 *
 * `rooms` is a list of { slug, variant, migrate, seed } built with
 * fixture-room-369.buildRoom369 under the hermetic rooms home.
 *
 * Canon Part 8: hermeticEnv sets MINDRIAN_BRAIN_URL=http://127.0.0.1:9, drops
 * the Brain key and CLAUDE_CODE_SESSION_ID, so a test daemon can never reach
 * a real Brain or inherit a CLI session. Never kills a process it did not
 * spawn. Hyphens only; no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SERVER = path.join(REPO_ROOT, 'bin', 'mindrian-mcp-server.cjs');
const { hermeticEnv } = require('./mcp-wire-267.cjs');
const { buildRoom369, writeRegistry } = require('./fixture-room-369.cjs');

const START_TIMEOUT_MS = 30000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return !(e && e.code === 'ESRCH');
  }
}

function readPidfilePid(file) {
  try {
    const p = JSON.parse(fs.readFileSync(file, 'utf8')).pid;
    return Number.isInteger(p) ? p : null;
  } catch (_e) {
    return null;
  }
}

function spawnServer(env, state) {
  const child = cp.spawn('node', [SERVER], { cwd: REPO_ROOT, env: env, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      try { process.kill(child.pid, 'SIGKILL'); } catch (_e) { /* already gone */ }
      reject(new Error('daemon did not report its port within 30s; stderr: ' + stderr.slice(-400)));
    }, START_TIMEOUT_MS);
    child.stdout.on('data', () => {});
    child.stderr.on('data', (c) => {
      stderr += c.toString('utf8');
      const m = stderr.match(/HTTP on 127\.0\.0\.1:(\d+)/);
      if (m) {
        clearTimeout(timer);
        resolve({ child, port: Number(m[1]), getStderr: () => stderr });
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error('daemon exited early (code ' + code + '); stderr: ' + stderr.slice(-400)));
    });
    child.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    if (state) state.child = child;
  });
}

async function startDaemon(opts) {
  const o = opts || {};
  const hermetic = hermeticEnv(
    Object.assign({ MINDRIAN_TRANSPORT: 'http', MINDRIAN_MCP_FIRST: 'cowork' }, o.extraEnv || {})
  );
  const roomsHome = hermetic.dirs.roomsHome;

  const roomDirs = {};
  const registryRooms = [];
  try {
    for (const spec of o.rooms || []) {
      const built = buildRoom369({
        tmpDir: path.join(roomsHome, spec.slug),
        slug: spec.slug,
        variant: spec.variant || 'wide',
        migrate: spec.migrate === true,
        seed: spec.seed,
      });
      roomDirs[spec.slug] = built.roomDir;
      registryRooms.push({ slug: spec.slug, abs_path: built.roomDir });
    }
  } catch (err) {
    hermetic.cleanup();
    throw err;
  }
  // The hermetic default room stays registered, as in the 267 helper.
  registryRooms.push({ slug: 'room-267', abs_path: hermetic.dirs.roomDir });
  writeRegistry(roomsHome, registryRooms, registryRooms[0].slug);

  const pidfile = path.join(roomsHome, '.rooms', 'daemon', 'mcp-daemon.json');
  let spawned;
  try {
    spawned = await spawnServer(hermetic.env);
  } catch (err) {
    hermetic.cleanup();
    throw err;
  }
  return {
    child: spawned.child,
    port: spawned.port,
    roomsHome: roomsHome,
    roomDirs: roomDirs,
    pidfilePath: pidfile,
    getStderr: spawned.getStderr,
    env: hermetic.env,
    cleanup: hermetic.cleanup,
  };
}

async function killOwnChild(child) {
  if (!child || typeof child.pid !== 'number') return;
  const exited = new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('exit', () => resolve());
  });
  try { process.kill(child.pid, 'SIGKILL'); } catch (_e) { /* already gone */ }
  await Promise.race([exited, sleep(5000)]);
}

async function restartDaemon(handle) {
  await killOwnChild(handle.child);
  const spawned = await spawnServer(handle.env);
  return Object.assign({}, handle, {
    child: spawned.child,
    port: spawned.port,
    getStderr: spawned.getStderr,
  });
}

async function stopDaemon(handle) {
  if (!handle) return;
  const pidfilePid = readPidfilePid(handle.pidfilePath);
  await killOwnChild(handle.child);
  // The pidfile lives inside this hermetic rooms home, so a pid in it was
  // written by the daemon this helper spawned.
  if (pidfilePid && handle.child && pidfilePid !== handle.child.pid && pidAlive(pidfilePid)) {
    try { process.kill(pidfilePid, 'SIGKILL'); } catch (_e) { /* already gone */ }
  }
  await sleep(300);
  if (typeof handle.cleanup === 'function') handle.cleanup();
}

async function connectClient(port, name, negotiation) {
  const { Client, StreamableHTTPClientTransport } = require('@modelcontextprotocol/client');
  const client = new Client(
    { name: name || 'test-369', version: '1.0.0' },
    { capabilities: {}, versionNegotiation: negotiation }
  );
  const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:' + port + '/mcp'));
  await client.connect(transport);
  return {
    client: client,
    transport: transport,
    async close() {
      try { await transport.terminateSession(); } catch (_e) { /* best effort */ }
      try { await client.close(); } catch (_e) { /* best effort */ }
    },
  };
}

function legacyClient(port, name) {
  return connectClient(port, name, { mode: 'legacy' });
}

function autoClient(port, name) {
  return connectClient(port, name, { mode: 'auto' });
}

module.exports = {
  startDaemon,
  restartDaemon,
  stopDaemon,
  legacyClient,
  autoClient,
};
