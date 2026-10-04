#!/usr/bin/env node
'use strict';
/*
 * lib/ui-shell/launch.cjs -- the way into the workspace (Phase 369 plan 22, SHELL369-08/09).
 *
 *   node lib/ui-shell/launch.cjs [start] [--port N] [--dist DIR] [--open]
 *   node lib/ui-shell/launch.cjs stop
 *   node lib/ui-shell/launch.cjs status
 *
 * start: (1) starts or reuses the flag-ON MCP daemon with MINDRIAN_MCP_FIRST=cowork (the shell
 * needs per-connection sessions, which exist only flag-ON; 369-SESSION-CONTRACT.md section 2);
 * (2) reads <dist>/manifest.json for the shell server entry; (3) starts the shell server bound to
 * 127.0.0.1 or, when one of ours is already running, asks it for a fresh one-time code through the
 * 0600 control token; (4) prints the one-time link on its own line. The code itself never appears
 * in a process argument list: the server only ever receives its sha256 (environment at start, the
 * control endpoint afterwards).
 *
 * Boundaries: loopback only (Canon Part 8, T-369-22-01..04). CLAUDE_CODE_SESSION_ID is never
 * handed to the daemon or the shell server. stop kills only the pid this launcher recorded, and
 * only after its command line is confirmed to be the shell server entry. Built-ins plus
 * lib/mcp/daemon-lifecycle.cjs, no CLI framework (switch-case router, as the other lib CLIs do).
 * CJS. Hyphens only; no em-dashes.
 *
 * Exit codes: 0 ok, 1 refusal with a plain message on stderr.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');

const LOOPBACK = '127.0.0.1';
const DEFAULT_PORT = 3369; // the default plan 19's config.ts uses
const DEFAULT_START_TIMEOUT_MS = 20000; // cold start in a fresh install; MOS_SHELL_START_TIMEOUT_MS overrides
const STOP_GRACE_MS = 3000;
const CODE_TTL_SECONDS = 60;
const CONTROL_HEADER = 'x-mos-control-token';
const LINK_NOTE = 'This link works once, for this computer only, for the next ' + CODE_TTL_SECONDS + ' seconds.';

class Refusal extends Error {}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function stateDir() {
  return path.join(os.homedir(), '.mindrian', 'ui-shell');
}

function stateFile() {
  return path.join(stateDir(), 'shell.json');
}

function controlTokenFile() {
  return process.env.MOS_SHELL_CONTROL_TOKEN_FILE || path.join(stateDir(), 'control.token');
}

function logFile() {
  return path.join(stateDir(), 'shell.log');
}

function defaultDist() {
  return path.join(__dirname, 'dist');
}

function readState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Number.isInteger(parsed.pid) || !Number.isInteger(parsed.port)) return null;
    return parsed;
  } catch (_e) {
    return null;
  }
}

function writeState(rec) {
  fs.mkdirSync(stateDir(), { recursive: true, mode: 0o700 });
  fs.writeFileSync(stateFile(), JSON.stringify(rec, null, 2) + '\n', { mode: 0o600 });
}

function clearState() {
  try { fs.unlinkSync(stateFile()); } catch (_e) { /* already gone */ }
}

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return !!(e && e.code === 'EPERM');
  }
}

// The command line of a pid, or null when it cannot be read. /proc first (Linux), ps otherwise.
function commandLineOf(pid) {
  try {
    const raw = fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8');
    if (raw) return raw.split('\0').join(' ').trim();
  } catch (_e) { /* not Linux, or gone */ }
  try {
    const out = execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.trim() || null;
  } catch (_e) {
    return null;
  }
}

// The working directory of a pid, or null when it cannot be read. /proc first (Linux), lsof otherwise.
function cwdOf(pid) {
  try {
    return fs.readlinkSync('/proc/' + pid + '/cwd');
  } catch (_e) { /* not Linux, or gone */ }
  try {
    const out = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const line = out.split('\n').find((l) => l.startsWith('n'));
    return line ? line.slice(1) : null;
  } catch (_e) {
    return null;
  }
}

function sameDir(a, b) {
  try {
    return fs.realpathSync(a) === fs.realpathSync(b);
  } catch (_e) {
    return false;
  }
}

// True only when the pid is alive AND it is the shell server we started. The command line names the server
// entry for the plain-Node stand-in; the real Next standalone server renames its own process to
// "next-server (v<version>)" (process.title in next/dist/server/lib/start-server.js), which hides the entry,
// so that title counts only together with a working directory equal to the server entry's directory (the
// launcher spawns it with cwd set there and server.js chdirs to its own directory).
function isOurShell(rec) {
  if (!rec || !pidAlive(rec.pid)) return false;
  if (typeof rec.serverEntry !== 'string' || rec.serverEntry.length === 0) return false;
  const cmd = commandLineOf(rec.pid);
  if (cmd === null) return false;
  if (cmd.indexOf(rec.serverEntry) !== -1) return true;
  if (/^next-server \(v[0-9][^)]*\)/.test(cmd)) {
    const cwd = cwdOf(rec.pid);
    return cwd !== null && sameDir(cwd, path.dirname(rec.serverEntry));
  }
  return false;
}

function probePort(port, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const socket = net.createConnection({ host: LOOPBACK, port: port });
    const finish = (ok) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch (_e) { /* ignore */ }
      resolve(ok);
    };
    socket.setTimeout(timeoutMs || 500);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

function mintCode() {
  const code = crypto.randomBytes(32).toString('base64url'); // 256 bits, SESSION-CONTRACT section 3
  const sha256 = crypto.createHash('sha256').update(code).digest('hex');
  return { code, sha256 };
}

function readManifest(dist) {
  const file = path.join(dist, 'manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_e) {
    throw new Refusal('The workspace is not built in this install.\n  Why: ' + file + ' is missing or unreadable.\n  Fix: update MindrianOS, or ask the maintainer for a build that includes the workspace.');
  }
  if (!manifest || typeof manifest.serverEntry !== 'string' || manifest.serverEntry.length === 0) {
    throw new Refusal('The workspace is not built in this install.\n  Why: the build manifest names no server entry.\n  Fix: update MindrianOS.');
  }
  const serverEntry = path.resolve(dist, manifest.serverEntry);
  if (!fs.existsSync(serverEntry)) {
    throw new Refusal('The workspace is not built in this install.\n  Why: the server entry ' + serverEntry + ' is missing.\n  Fix: update MindrianOS.');
  }
  const version = typeof manifest.version === 'string' && manifest.version
    ? manifest.version
    : (typeof manifest.sourceHash === 'string' ? manifest.sourceHash.slice(0, 12) : 'unknown');
  return { serverEntry, version, sourceHash: typeof manifest.sourceHash === 'string' ? manifest.sourceHash : null };
}

function startTimeoutMs() {
  const raw = Number(process.env.MOS_SHELL_START_TIMEOUT_MS);
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_START_TIMEOUT_MS;
}

// Starts or reuses the flag-ON daemon and answers its loopback port.
async function ensureFlagOnDaemon(deps) {
  const lifecycle = (deps && deps.lifecycle) || require('../mcp/daemon-lifecycle.cjs');
  const rec = await lifecycle.ensureDaemon({ env: { MINDRIAN_MCP_FIRST: 'cowork' }, spawnTimeoutMs: startTimeoutMs() });
  let port = rec && Number.isInteger(rec.port) ? rec.port : null;
  if (port === null) port = lifecycle.discoverPort(); // the recorded port when its owner is alive
  if (!Number.isInteger(port) || !(await probePort(port, 1000))) {
    throw new Refusal('MindrianOS is not answering on this machine.\n  Why: the MindrianOS server did not start.\n  Fix: run the command again; if it repeats, restart Claude Code.');
  }
  return port;
}

function postControl(port, token, sha256) {
  return new Promise((resolve) => {
    const body = JSON.stringify({ sha256: sha256 });
    const headers = { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) };
    headers[CONTROL_HEADER] = token;
    const req = http.request({ host: LOOPBACK, port: port, path: '/control/bootstrap', method: 'POST', headers: headers, timeout: 5000 }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.once('timeout', () => { req.destroy(); resolve(0); });
    req.once('error', () => resolve(0));
    req.end(body);
  });
}

function readControlToken() {
  const file = controlTokenFile();
  let st;
  try {
    st = fs.statSync(file);
  } catch (_e) {
    return null;
  }
  // Another local user must not be able to read the token (T-369-22-03).
  if (process.platform !== 'win32' && (st.mode & 0o077) !== 0) {
    throw new Refusal('The workspace control file is readable by other users on this computer.\n  Why: ' + file + ' is not private (mode 0600).\n  Fix: run node lib/ui-shell/launch.cjs stop, then start it again.');
  }
  const token = fs.readFileSync(file, 'utf8').trim();
  return token || null;
}

function linkFor(port, code) {
  return 'http://' + LOOPBACK + ':' + port + '/auth/bootstrap?code=' + code;
}

async function spawnShell(opts) {
  const { serverEntry, port, daemonPort, sha256 } = opts;
  if (await probePort(port, 500)) {
    throw new Refusal('Port ' + port + ' is already in use by another program.\n  Why: the workspace needs it to listen on 127.0.0.1.\n  Fix: run with --port <number> to pick a free one.');
  }
  fs.mkdirSync(stateDir(), { recursive: true, mode: 0o700 });
  const env = Object.assign({}, process.env);
  delete env.CLAUDE_CODE_SESSION_ID; // T-369-22-04: no CLI session identity in the shell server
  Object.assign(env, {
    MOS_DAEMON_URL: 'http://' + LOOPBACK + ':' + daemonPort,
    MOS_SHELL_PORT: String(port),
    MOS_SHELL_BOOTSTRAP_SHA256: sha256,
    MOS_SHELL_CONTROL_TOKEN_FILE: controlTokenFile(),
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    DO_NOT_TRACK: '1',
    // The Next standalone server reads PORT and HOSTNAME, not the MOS_ names.
    PORT: String(port),
    HOSTNAME: LOOPBACK,
  });
  const logFd = fs.openSync(logFile(), 'a', 0o600);
  const child = spawn(process.execPath, [serverEntry], {
    cwd: path.dirname(serverEntry),
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: env,
  });
  try { fs.closeSync(logFd); } catch (_e) { /* ignore */ }
  let exited = null;
  child.once('exit', (code) => { exited = code === null ? 1 : code; });
  child.once('error', () => { exited = 1; });
  try { child.unref(); } catch (_e) { /* ignore */ }

  const deadline = Date.now() + startTimeoutMs();
  while (Date.now() < deadline) {
    if (exited !== null) {
      throw new Refusal('The workspace server stopped while starting.\n  Why: see ' + logFile() + '.\n  Fix: run the command again; if it repeats, update MindrianOS.');
    }
    if (await probePort(port, 300)) return child.pid;
    await sleep(100);
  }
  try { process.kill(child.pid, 'SIGTERM'); } catch (_e) { /* gone */ }
  throw new Refusal('The workspace server did not start in time.\n  Why: nothing answered on 127.0.0.1:' + port + ' within ' + Math.round(startTimeoutMs() / 1000) + ' seconds.\n  Fix: run the command again, or set MOS_SHELL_START_TIMEOUT_MS higher.');
}

async function stopShell() {
  const rec = readState();
  if (!rec) return { stopped: false, reason: 'not_running' };
  if (!isOurShell(rec)) {
    // The record is stale (dead pid) or the pid now belongs to another program: never kill it.
    clearState();
    return { stopped: false, reason: 'stale' };
  }
  try { process.kill(rec.pid, 'SIGTERM'); } catch (_e) { /* gone */ }
  const deadline = Date.now() + STOP_GRACE_MS;
  while (Date.now() < deadline && pidAlive(rec.pid)) await sleep(50);
  if (pidAlive(rec.pid) && isOurShell(rec)) {
    try { process.kill(rec.pid, 'SIGKILL'); } catch (_e) { /* gone */ }
  }
  clearState();
  try { fs.unlinkSync(controlTokenFile()); } catch (_e) { /* already gone */ }
  return { stopped: true, pid: rec.pid };
}

async function start(flags, deps) {
  const dist = flags.dist ? path.resolve(flags.dist) : defaultDist();
  const manifest = readManifest(dist);
  const daemonPort = await ensureFlagOnDaemon(deps);
  const { code, sha256 } = mintCode();

  let port = Number.isInteger(flags.port) ? flags.port : DEFAULT_PORT;
  let reused = false;
  const rec = readState();
  if (rec && isOurShell(rec) && rec.serverEntry === manifest.serverEntry && rec.daemonPort === daemonPort && (await probePort(rec.port, 500))) {
    const token = readControlToken();
    if (token) {
      const status = await postControl(rec.port, token, sha256);
      if (status === 200) {
        port = rec.port;
        reused = true;
      }
    }
    if (!reused) {
      // Ours, but it would not take a new code (token lost or refused): replace it, never leave it half-owned.
      await stopShell();
    }
  } else if (rec) {
    // A record for a server that is gone, was started from another build, or points at a restarted daemon.
    if (isOurShell(rec)) await stopShell();
    else clearState();
  }

  if (!reused) {
    const pid = await spawnShell({ serverEntry: manifest.serverEntry, port, daemonPort, sha256 });
    writeState({ pid, port, daemonPort, started_at: new Date().toISOString(), serverEntry: manifest.serverEntry, version: manifest.version });
  }

  const link = linkFor(port, code);
  process.stdout.write(link + '\n' + LINK_NOTE + '\n');
  if (flags.open) {
    try { require('../core/platform.cjs').openBrowser(link); } catch (_e) { /* the link is already printed */ }
  }
  return 0;
}

async function status() {
  const rec = readState();
  if (rec && isOurShell(rec) && (await probePort(rec.port, 500))) {
    process.stdout.write('running on 127.0.0.1:' + rec.port + ' (version ' + (rec.version || 'unknown') + ', pid ' + rec.pid + ')\n');
  } else {
    process.stdout.write('not running\n');
  }
  return 0;
}

function parseArgs(argv) {
  const flags = { command: 'start', port: null, dist: null, open: false };
  let commandSeen = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--port': {
        const n = Number(argv[i + 1]);
        i += 1;
        if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Refusal('--port needs a whole number from 1 to 65535.');
        flags.port = n;
        break;
      }
      case '--dist':
        flags.dist = argv[i + 1];
        i += 1;
        if (!flags.dist) throw new Refusal('--dist needs a directory.');
        break;
      case '--open':
        flags.open = true;
        break;
      case 'start':
      case 'stop':
      case 'status':
        if (!commandSeen) {
          flags.command = a;
          commandSeen = true;
          break;
        }
        throw new Refusal('Unknown argument: ' + a);
      default:
        throw new Refusal('Unknown argument: ' + a + '\n  Fix: use start, stop or status.');
    }
  }
  return flags;
}

async function main(argv, deps) {
  try {
    const flags = parseArgs(argv);
    switch (flags.command) {
      case 'stop': {
        const r = await stopShell();
        process.stdout.write(r.stopped ? 'stopped\n' : 'not running\n');
        return 0;
      }
      case 'status':
        return await status();
      case 'start':
      default:
        return await start(flags, deps);
    }
  } catch (err) {
    if (err instanceof Refusal) {
      process.stderr.write(err.message + '\n');
      return 1;
    }
    throw err;
  }
}

module.exports = { main, parseArgs, mintCode, isOurShell, readState, stateFile, controlTokenFile, LINK_NOTE, DEFAULT_PORT };

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exit(code); }, (err) => {
    process.stderr.write('The workspace launcher failed unexpectedly: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  });
}
