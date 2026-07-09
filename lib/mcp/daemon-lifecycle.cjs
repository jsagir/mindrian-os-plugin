'use strict';
// Phase 198-03 (D-01) -- daemon-lifecycle: pidfile write/read, port discovery,
// crash recovery, stale-lock reap for the ONE durable localhost MCP daemon.
//
// WIRE-AND-CONSUME shape (Canon Part 7): the atomic tmp+fsync+rename write
// discipline and the safe-default-on-corrupt read discipline are cloned from
// lib/core/session-binding.cjs (readSessionBinding / writeSessionBinding)
// rather than inventing a new persistence idiom. This module owns ONLY the
// daemon's own pid+port record under $MINDRIAN_ROOMS_HOME/.rooms/daemon/ --
// it never touches room state or session-binding files.
//
// T-198-09 (Tampering, pidfile/port record on disk): a dead-PID or
// unparseable pidfile is reaped, NEVER trusted. reapStale() is the guard;
// readPidfile() collapses any corrupt/missing file to null rather than
// throwing into a caller (never wedges startup).
//
// T-198-06 (Information Disclosure / EoP): all bind/probe is 127.0.0.1 ONLY
// (ASVS V9). This module never binds a wildcard/public interface and never
// opens a remote socket.
//
// No em-dashes. CJS only. Canon Part 8: zero Brain/network token beyond the
// loopback health ping (a bare TCP connect to 127.0.0.1, never an HTTP call
// to a remote host).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');

const LOOPBACK = '127.0.0.1';
const DEFAULT_BASE_PORT = 3847;
const HEALTH_PING_TIMEOUT_MS = 500;
const PORT_SCAN_CEILING = 1000; // bounded upward scan -- never loop forever
const DEFAULT_SPAWN_TIMEOUT_MS = 5000;
const SPAWN_POLL_INTERVAL_MS = 100;

function resolveHome(opts) {
  if (opts && typeof opts.home === 'string' && opts.home.length > 0) return opts.home;
  const env = process.env.MINDRIAN_ROOMS_HOME || process.env.MINDRIAN_ROOMS_ROOT;
  if (typeof env === 'string' && env.length > 0) return env;
  return path.join(os.homedir(), 'MindrianRooms');
}

function daemonDir(opts) {
  return path.join(resolveHome(opts), '.rooms', 'daemon');
}

function pidfilePath(opts) {
  return path.join(daemonDir(opts), 'mcp-daemon.json');
}

/**
 * readPidfile(opts) -- the daemon's current pid+port record, or null when
 * missing/corrupt. Mirrors session-binding.cjs's safe-default-on-corrupt
 * contract: any read/parse failure returns null rather than throwing.
 *
 * @param {{home?: string}} [opts]
 * @returns {{pid: number, port: number, updated: string|null}|null}
 */
function readPidfile(opts) {
  try {
    const raw = fs.readFileSync(pidfilePath(opts), 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const pid = Number.isInteger(parsed.pid) ? parsed.pid : null;
    const port = Number.isInteger(parsed.port) ? parsed.port : null;
    if (pid === null || port === null) return null;
    return {
      pid: pid,
      port: port,
      updated: (typeof parsed.updated === 'string') ? parsed.updated : null,
    };
  } catch (_e) {
    // Missing file, non-JSON, or any other read failure -> null. Never throw
    // into the caller (a corrupt pidfile must never wedge startup).
    return null;
  }
}

/**
 * writePidfile({pid, port}, opts) -- atomic tmp + fsync + rename, cloned from
 * session-binding.cjs writeSessionBinding (T-198-09: a tampered/partial
 * pidfile must never be read mid-write). Fire-and-forget: a write failure
 * never rethrows into the caller (mirrors session-binding.cjs).
 *
 * @param {{pid: number, port: number}} record
 * @param {{home?: string}} [opts]
 */
function writePidfile(record, opts) {
  try {
    const pid = (record && Number.isInteger(record.pid)) ? record.pid : null;
    const port = (record && Number.isInteger(record.port)) ? record.port : null;
    if (pid === null || port === null) return;

    const dir = daemonDir(opts);
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_e) {}
    const filePath = pidfilePath(opts);
    const data = { pid: pid, port: port, updated: new Date().toISOString() };

    const rnd = Math.random().toString(36).slice(2, 10);
    const tmpPath = filePath + '.tmp.' + process.pid + '.' + rnd + '.daemon';
    let fd;
    try {
      fd = fs.openSync(tmpPath, 'wx');
    } catch (e) {
      if (e && e.code === 'EEXIST') {
        try { fs.unlinkSync(tmpPath); } catch (_e2) {}
        fd = fs.openSync(tmpPath, 'wx');
      } else {
        return;
      }
    }
    try {
      fs.writeSync(fd, JSON.stringify(data, null, 2));
      try { fs.fsyncSync(fd); } catch (_e3) {
        // ENOTSUP on tmpfs / overlayfs -- best-effort durability is acceptable.
      }
    } finally {
      try { fs.closeSync(fd); } catch (_e4) {}
    }
    try {
      fs.renameSync(tmpPath, filePath);
    } catch (_e5) {
      try { fs.unlinkSync(tmpPath); } catch (_e6) {}
    }
  } catch (_e) {
    // Fire-and-forget, mirrors session-binding.cjs.
  }
}

/**
 * clearPidfile(opts) -- idempotent unlink (absent file is not an error).
 * @param {{home?: string}} [opts]
 */
function clearPidfile(opts) {
  try {
    fs.unlinkSync(pidfilePath(opts));
  } catch (_e) {
    // Idempotent.
  }
}

// pid liveness, cloned from session-presence.cjs isAlive. Signal 0 raises when
// the pid is dead (ESRCH) or otherwise not signalable; alive returns true.
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * reapStale(opts) -- a pidfile whose PID is dead is removed, never trusted. A
 * live PID is left untouched (liveness is advisory; a false-live only keeps a
 * file, it never blocks a fresh spawn attempt from probing). Returns true iff
 * a stale record was reaped.
 *
 * @param {{home?: string}} [opts]
 * @returns {boolean}
 */
function reapStale(opts) {
  const rec = readPidfile(opts);
  if (!rec) return false;
  if (isAlive(rec.pid)) return false;
  clearPidfile(opts);
  return true;
}

/**
 * probePort(port, timeoutMs) -- loopback-only TCP connect probe ("is
 * something listening on this port"). Never a full HTTP round-trip: a bare
 * TCP accept is a sufficient liveness signal for ensureDaemon's health check
 * without this module needing to speak the daemon's own MCP transport
 * protocol (T-198-06 keeps the probe minimal and loopback-only).
 *
 * @param {number} port
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
function probePort(port, timeoutMs) {
  return new Promise((resolve) => {
    let socket;
    try {
      socket = net.createConnection({ host: LOOPBACK, port: port });
    } catch (_e) {
      resolve(false);
      return;
    }
    let done = false;
    const finish = (alive) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch (_e2) {}
      resolve(alive);
    };
    socket.setTimeout(timeoutMs || HEALTH_PING_TIMEOUT_MS);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

// Synchronous loopback-only "is this port free" check. node's stdlib has no
// synchronous socket API, so this spawns a tiny inline node subprocess that
// tries to bind-then-close 127.0.0.1:<port> and reports success/failure via
// exit code -- a real probe (not a heuristic), kept synchronous so
// discoverPort() can stay a plain synchronous export (matches the plan's
// acceptance-criteria call shape: `d.discoverPort()`, no await). This runs at
// most a handful of times per daemon startup, never in a hot path.
function isPortFreeSync(port, timeoutMs) {
  try {
    const script =
      'const net=require("node:net");' +
      'const s=net.createServer();' +
      's.once("error",function(){process.exit(1);});' +
      's.listen(' + Number(port) + ',"127.0.0.1",function(){s.close(function(){process.exit(0);});});';
    execFileSync(process.execPath, ['-e', script], {
      timeout: timeoutMs || 1500,
      stdio: 'ignore',
    });
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * discoverPort(opts) -- prefer the recorded port when its owning pid is still
 * alive (the live daemon's actual port, not a fresh probe); otherwise probe
 * loopback-only from opts.basePort (default 3847) upward for the first FREE
 * port, so two installs on one machine never collide. Bounded scan (never
 * loops forever); falls back to basePort if the scan is exhausted (the
 * caller's own bind attempt then surfaces the real OS error).
 *
 * @param {{basePort?: number, home?: string}} [opts]
 * @returns {number}
 */
function discoverPort(opts) {
  const basePort = (opts && Number.isInteger(opts.basePort)) ? opts.basePort : DEFAULT_BASE_PORT;
  const rec = readPidfile(opts);
  if (rec && isAlive(rec.pid) && Number.isInteger(rec.port)) {
    return rec.port;
  }
  const ceiling = basePort + PORT_SCAN_CEILING;
  let candidate = basePort;
  while (candidate < ceiling) {
    if (isPortFreeSync(candidate)) return candidate;
    candidate += 1;
  }
  return basePort;
}

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

/**
 * ensureDaemon(opts) -- if a live, healthy daemon is recorded (pidfile
 * present, PID alive, port answering the loopback health ping), return its
 * {pid, port}. Otherwise reap any stale record and spawn a fresh daemon
 * process (bin/mindrian-mcp-server.cjs, MINDRIAN_TRANSPORT=http), then poll
 * for the pidfile THAT SERVER writes on listen (Task 2 wiring) rather than
 * pre-deciding a port here -- port selection stays a single decision made
 * ONCE, inside the spawned process, at its own discoverPort() bind time
 * (avoids two independent discoverPort() calls in two processes racing onto
 * different ports).
 *
 * @param {{home?: string, serverPath?: string, spawnTimeoutMs?: number,
 *   healthTimeoutMs?: number, env?: object}} [opts]
 * @returns {Promise<{pid: number, port: number|null}>}
 */
async function ensureDaemon(opts) {
  opts = opts || {};
  const existing = readPidfile(opts);
  if (existing && isAlive(existing.pid)) {
    const healthy = await probePort(existing.port, opts.healthTimeoutMs);
    if (healthy) return { pid: existing.pid, port: existing.port };
  }
  // Stale (dead pid) or unhealthy (pid alive, port not answering) -- never
  // wedge startup on a stale record (T-198-09). Reap before spawning fresh.
  reapStale(opts);

  const serverPath = (typeof opts.serverPath === 'string' && opts.serverPath.length > 0)
    ? opts.serverPath
    : path.join(__dirname, '..', '..', 'bin', 'mindrian-mcp-server.cjs');
  const env = Object.assign({}, process.env, { MINDRIAN_TRANSPORT: 'http' }, (opts.env || {}));
  const child = spawn(process.execPath, [serverPath], {
    detached: true,
    stdio: 'ignore',
    env: env,
  });
  try { child.unref(); } catch (_e) {}

  const timeoutMs = Number.isInteger(opts.spawnTimeoutMs) ? opts.spawnTimeoutMs : DEFAULT_SPAWN_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const rec = readPidfile(opts);
    if (rec && isAlive(rec.pid)) return { pid: rec.pid, port: rec.port };
    await sleep(SPAWN_POLL_INTERVAL_MS);
  }
  // The spawn did not confirm within the timeout -- surface what we spawned
  // (never wedge; a caller can retry ensureDaemon(), which will re-probe).
  return { pid: child.pid, port: null };
}

module.exports = {
  ensureDaemon,
  readPidfile,
  writePidfile,
  clearPidfile,
  discoverPort,
  reapStale,
};
