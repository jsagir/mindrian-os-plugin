#!/usr/bin/env node
'use strict';
/*
 * lib/ui-shell/launch.cjs -- the way into the workspace (Phase 369 plans 22 and 40, SHELL369-08/09).
 *
 *   node lib/ui-shell/launch.cjs [start] [--port N] [--dist DIR] [--open]
 *   node lib/ui-shell/launch.cjs stop
 *   node lib/ui-shell/launch.cjs status
 *
 * start: (1) starts or reuses the flag-ON MCP daemon with MINDRIAN_MCP_FIRST=cowork (the shell
 * needs per-connection sessions, which exist only flag-ON; 369-SESSION-CONTRACT.md section 2);
 * (2) reads <dist>/manifest.json for the shell server entry; (3) starts the shell server bound to
 * 127.0.0.1 (or reuses one of ours started with the same build, daemon and proposal source);
 * (4) once the server's port answers, arms ONE sign-in through the 0600 control token:
 *
 *   - on a real terminal (stdout is a TTY) and without --open: mints a one-time code, sends the
 *     server only its sha256 (POST /control/bootstrap { sha256 }) and prints the one-time link on
 *     its own line. This is the only place a code is ever shown, because a person is reading it;
 *   - everywhere else (what Claude Code runs as `!node ... start` is not a terminal) and with
 *     --open: arms the single-use 60 s start slot (POST /control/bootstrap { start: true }) and
 *     opens the browser at the secret-free http://127.0.0.1:<port>/auth/start. No code exists, so
 *     none reaches the model's context, stdout or any process argument list (CR-01). When no
 *     browser can be opened from where this runs, it says so in plain words and names the command
 *     to run in the person's own terminal; it still prints no code.
 *
 * Boundaries: loopback only (Canon Part 8, T-369-22-01..04, T-369-40-01..07).
 *   - The shell server gets an ALLOW-LISTED environment (SHELL_ENV_ALLOWLIST below), never the
 *     launcher's whole environment: no API keys, no NODE_OPTIONS, no Claude Code tokens, never
 *     CLAUDE_CODE_SESSION_ID (WR-13, launcher half; the daemon half is lib/mcp/daemon-lifecycle.cjs).
 *   - Process identity (WR-12): a recorded pid is "our shell" only when argv[0] is a node binary and
 *     argv[1] equals the recorded server entry exactly (or the process title is Next's
 *     "next-server (v...)" AND its working directory is the entry's directory) AND the process
 *     start time equals the one recorded at spawn. Anything else is never signalled.
 *   - The control token file is read only when it is a plain file (no symbolic link, opened with
 *     O_NOFOLLOW), owned by the running user, mode 0600 (WR-14, launcher half).
 *   - The shell starts with MOS_PROPOSAL_SOURCE=adapter (the ruled room-proposal source,
 *     369-ADAPTER-RULING.md, A1) unless the launcher's own environment says fixed; a running shell
 *     started with another source is replaced, not reused.
 * Built-ins plus lib/mcp/daemon-lifecycle.cjs, no CLI framework (switch-case router, as the other
 * lib CLIs do). CJS. Hyphens only; no em-dashes.
 *
 * Windows: the process identity check needs /proc or ps and so, as before, finds no live shell
 * there; stop then only clears the record and never signals (IN-08 b is a navigator item).
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
const OPEN_EXIT_WAIT_MS = 1500;
const CODE_TTL_SECONDS = 60;
const CONTROL_HEADER = 'x-mos-control-token';
const LINK_NOTE = 'This link works once, for this computer only, for the next ' + CODE_TTL_SECONDS + ' seconds.';

// WR-13: the only names the launcher copies from its own environment into the shell server's. One reason per group.
const SHELL_ENV_ALLOWLIST = Object.freeze([
  'PATH', 'HOME', 'USER', 'LOGNAME', // find node and its tools; the person's home (the hermetic home in tests)
  'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ', // locale and time zone, so dates and text render as on the person's machine
  'TMPDIR', 'TEMP', 'TMP', // where temporary files go
  'NODE_PATH', // module resolution for an installed layout
]);
const SHELL_ENV_ALLOWLIST_WIN32 = Object.freeze(['SystemRoot', 'ComSpec', 'USERPROFILE']); // Windows cannot run a process without them
const PROPOSAL_SOURCES = Object.freeze(['adapter', 'fixed']);

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

// The argument vector of a pid as an array, or null when it cannot be read. /proc first (Linux: exact,
// NUL-separated), ps otherwise (one string, split on single spaces; a path with a space then never matches,
// which fails closed).
function argvOf(pid) {
  try {
    const raw = fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8');
    if (raw) {
      const parts = raw.split('\0');
      while (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
      return parts;
    }
  } catch (_e) { /* not Linux, or gone */ }
  try {
    const out = execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return out ? out.split(' ') : null;
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

// The start time of a pid as a comparable string, or null when it cannot be read (WR-12). A recycled pid is a
// different process with a different start time. Linux: field 22 of /proc/<pid>/stat (clock ticks since boot),
// qualified by the boot id so a reboot cannot repeat it; otherwise `ps -o lstart=`.
function processStartToken(pid) {
  try {
    const stat = fs.readFileSync('/proc/' + pid + '/stat', 'utf8');
    // The command name (field 2) is in parentheses and may hold spaces: split after the LAST ')'.
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' '); // fields[0] is field 3
    const ticks = fields[19]; // field 22
    if (/^[0-9]+$/.test(ticks)) {
      let boot = '';
      try { boot = fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim(); } catch (_e) { /* optional */ }
      return 'proc:' + boot + ':' + ticks;
    }
  } catch (_e) { /* not Linux, or gone */ }
  try {
    const out = execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env: { PATH: process.env.PATH || '', LC_ALL: 'C' } }).trim();
    return out ? 'ps:' + out : null;
  } catch (_e) {
    return null;
  }
}

// True only when the pid is alive AND it is the shell server we started (WR-12, plan 369-40):
//   (a) argv[0] is a node binary and argv[1] equals the recorded server entry exactly, OR
//   (b) the process is Next's renamed "next-server (v<version>)" (process.title in
//       next/dist/server/lib/start-server.js hides the entry) AND its working directory is the entry's directory
//       (the launcher spawns it with cwd set there and server.js chdirs to its own directory);
//   AND the pid's start time equals the one recorded at spawn.
// A record without a start time (an older launcher wrote it) is never ours: the caller clears it and signals nothing.
function isOurShell(rec) {
  if (!rec || !pidAlive(rec.pid)) return false;
  if (typeof rec.serverEntry !== 'string' || rec.serverEntry.length === 0) return false;
  if (typeof rec.started !== 'string' || rec.started.length === 0) return false;
  const argv = argvOf(rec.pid);
  if (argv === null || argv.length === 0) return false;
  let byEntry = false;
  if (argv.length >= 2 && path.basename(argv[0]).startsWith('node') && argv[1] === rec.serverEntry) byEntry = true;
  let byTitle = false;
  if (!byEntry && /^next-server \(v[0-9][^)]*\)/.test(argv.join(' ').trim())) {
    const cwd = cwdOf(rec.pid);
    byTitle = cwd !== null && sameDir(cwd, path.dirname(rec.serverEntry));
  }
  if (!byEntry && !byTitle) return false;
  const now = processStartToken(rec.pid);
  return now !== null && now === rec.started;
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

// 'adapter' (the ruled room-proposal source) unless the launcher's own environment says fixed.
function proposalSourceFromEnv() {
  return process.env.MOS_PROPOSAL_SOURCE === 'fixed' ? 'fixed' : 'adapter';
}

// True only when a person is reading: stdout is a real terminal and --open was not given (CR-01).
function shouldPrintLink(opts) {
  return !!(opts && opts.isTTY === true && opts.open !== true);
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

// POST /control/bootstrap with the control token. `payload` is { sha256 } or { start: true } (exactly one).
function postControl(port, token, payload) {
  return new Promise((resolve) => {
    const body = JSON.stringify(payload);
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

function controlFileRefusal(file, what, why, fix) {
  return new Refusal('The workspace control file ' + what + '.\n  Why: ' + file + ' ' + why + '\n  Fix: ' + (fix || 'run node lib/ui-shell/launch.cjs stop, then start it again.'));
}

// WR-14, launcher half: the token is read only from a plain file the running user owns, mode 0600, never through a
// symbolic link (lstat refuses a link; the open itself uses O_NOFOLLOW so a link planted in between is refused too).
function readControlToken() {
  const file = controlTokenFile();
  let lst;
  try {
    lst = fs.lstatSync(file);
  } catch (_e) {
    return null;
  }
  if (lst.isSymbolicLink()) {
    throw controlFileRefusal(file, 'is a symbolic link', 'must be a plain file the workspace wrote, and nothing is read through a link.', 'run node lib/ui-shell/launch.cjs stop, remove the link, then start it again.');
  }
  if (!lst.isFile()) {
    throw controlFileRefusal(file, 'is not a plain file', 'must be a plain file the workspace wrote.');
  }
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  } catch (e) {
    if (e && e.code === 'ELOOP') {
      throw controlFileRefusal(file, 'is a symbolic link', 'must be a plain file the workspace wrote, and nothing is read through a link.', 'run node lib/ui-shell/launch.cjs stop, remove the link, then start it again.');
    }
    return null;
  }
  try {
    const st = fs.fstatSync(fd);
    // Another local user must not own or read the token (T-369-22-03, T-369-40-06).
    if (typeof process.getuid === 'function' && st.uid !== process.getuid()) {
      throw controlFileRefusal(file, 'belongs to another user on this computer', 'is not owned by you, so it cannot be trusted.');
    }
    if (process.platform !== 'win32' && (st.mode & 0o077) !== 0) {
      throw controlFileRefusal(file, 'is readable by other users on this computer', 'is not private (mode 0600).');
    }
    const token = fs.readFileSync(fd, 'utf8').trim();
    return token || null;
  } finally {
    try { fs.closeSync(fd); } catch (_e) { /* ignore */ }
  }
}

// The server writes the token file after its port is up; wait for it (the real server writes it in its start hook).
async function waitForControlToken() {
  const deadline = Date.now() + startTimeoutMs();
  while (Date.now() < deadline) {
    const token = readControlToken();
    if (token) return token;
    await sleep(100);
  }
  throw new Refusal('The workspace server did not write its control file in time.\n  Why: ' + controlTokenFile() + ' did not appear.\n  Fix: run the command again, or set MOS_SHELL_START_TIMEOUT_MS higher.');
}

function linkFor(port, code) {
  return 'http://' + LOOPBACK + ':' + port + '/auth/bootstrap?code=' + code;
}

function startUrlFor(port) {
  return 'http://' + LOOPBACK + ':' + port + '/auth/start';
}

// The environment the shell server gets: the allow-list copied from the launcher's own, then the values the
// launcher sets itself. Nothing else is inherited (WR-13). MINDRIAN_TEST_MODE passes only as '1' (the e2e suites).
function shellEnvFor(opts) {
  const env = {};
  const names = process.platform === 'win32' ? SHELL_ENV_ALLOWLIST.concat(SHELL_ENV_ALLOWLIST_WIN32) : SHELL_ENV_ALLOWLIST;
  for (const name of names) {
    if (typeof process.env[name] === 'string') env[name] = process.env[name];
  }
  if (process.env.MINDRIAN_TEST_MODE === '1') env.MINDRIAN_TEST_MODE = '1';
  Object.assign(env, {
    MOS_DAEMON_URL: 'http://' + LOOPBACK + ':' + opts.daemonPort,
    MOS_SHELL_PORT: String(opts.port),
    MOS_SHELL_CONTROL_TOKEN_FILE: controlTokenFile(),
    MOS_PROPOSAL_SOURCE: opts.proposalSource,
    NODE_ENV: 'production',
    NEXT_TELEMETRY_DISABLED: '1',
    DO_NOT_TRACK: '1',
    // The Next standalone server reads PORT and HOSTNAME, not the MOS_ names.
    PORT: String(opts.port),
    HOSTNAME: LOOPBACK,
  });
  return env;
}

// A control token file left by a dead server must not be mistaken for the new server's: remove a leftover plain
// file before the spawn. A symbolic link or a directory is left alone so the server's own refusal stands.
function removeStaleControlFile() {
  const file = controlTokenFile();
  try {
    if (fs.lstatSync(file).isFile()) fs.unlinkSync(file);
  } catch (_e) { /* none */ }
}

async function spawnShell(opts) {
  const { serverEntry, port } = opts;
  if (await probePort(port, 500)) {
    throw new Refusal('Port ' + port + ' is already in use by another program.\n  Why: the workspace needs it to listen on 127.0.0.1.\n  Fix: run with --port <number> to pick a free one.');
  }
  fs.mkdirSync(stateDir(), { recursive: true, mode: 0o700 });
  removeStaleControlFile();
  const logFd = fs.openSync(logFile(), 'a', 0o600);
  const child = spawn(process.execPath, [serverEntry], {
    cwd: path.dirname(serverEntry),
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: shellEnvFor(opts),
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
    if (await probePort(port, 300)) {
      const started = processStartToken(child.pid);
      if (started === null) {
        // Without a start time the launcher could never prove this process is its own: do not leave it running.
        try { process.kill(child.pid, 'SIGTERM'); } catch (_e) { /* gone */ }
        throw new Refusal('The workspace server started, but its identity could not be recorded.\n  Why: this computer does not expose process start times to the launcher.\n  Fix: run the command again; if it repeats, restart Claude Code.');
      }
      return { pid: child.pid, started: started };
    }
    await sleep(100);
  }
  try { process.kill(child.pid, 'SIGTERM'); } catch (_e) { /* gone */ }
  throw new Refusal('The workspace server did not start in time.\n  Why: nothing answered on 127.0.0.1:' + port + ' within ' + Math.round(startTimeoutMs() / 1000) + ' seconds.\n  Fix: run the command again, or set MOS_SHELL_START_TIMEOUT_MS higher.');
}

async function stopShell() {
  const rec = readState();
  if (!rec) return { stopped: false, reason: 'not_running' };
  if (!isOurShell(rec)) {
    // The record is stale (dead pid, no start time) or the pid now belongs to another program: never signal it.
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

// The default browser opener: localhost URLs only, never in tests or CI, and an honest answer. Resolves true only
// when the platform opener started and did not fail at once; false when it is disabled, absent or exited non-zero.
// (lib/core/platform.cjs openBrowser returns nothing and lets a missing opener crash the process on its async
// 'error' event; the launcher needs the answer, so it spawns the opener itself with the same guard.)
function defaultOpenBrowser(url) {
  if (process.env.MINDRIAN_OPEN_BROWSER_DISABLE === '1' || process.env.MINDRIAN_TEST_MODE === '1' || process.env.CI === '1') return Promise.resolve(false);
  if (typeof url !== 'string' || !/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(url)) return Promise.resolve(false);
  let cmd;
  let args;
  if (process.platform === 'darwin') { cmd = 'open'; args = [url]; }
  else if (process.platform === 'win32') { cmd = 'cmd'; args = ['/c', 'start', '""', url]; }
  else { cmd = 'xdg-open'; args = [url]; }
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      resolve(ok);
    };
    let child;
    try {
      child = spawn(cmd, args, { stdio: 'ignore', detached: true, shell: false });
    } catch (_e) {
      finish(false);
      return;
    }
    child.once('error', () => finish(false));
    child.once('exit', (code) => finish(code === 0));
    const timer = setTimeout(() => finish(true), OPEN_EXIT_WAIT_MS); // still running: the opener handed the page over
    if (typeof timer.unref === 'function') timer.unref();
    try { child.unref(); } catch (_e) { /* ignore */ }
  });
}

function ownTerminalCommand() {
  const p = __filename;
  return 'node ' + (/\s/.test(p) ? '"' + p + '"' : p) + ' start';
}

// Arms one sign-in through the control channel: a code on the print path, the start slot otherwise.
async function armSignIn(port, token, printLink) {
  if (printLink) {
    const { code, sha256 } = mintCode();
    const status = await postControl(port, token, { sha256: sha256 });
    return { ok: status === 200, code: code };
  }
  const status = await postControl(port, token, { start: true });
  return { ok: status === 200, code: null };
}

async function start(flags, deps) {
  deps = deps || {};
  const dist = flags.dist ? path.resolve(flags.dist) : defaultDist();
  const manifest = readManifest(dist);
  const daemonPort = await ensureFlagOnDaemon(deps);
  const isTTY = typeof deps.isTTY === 'boolean' ? deps.isTTY : process.stdout.isTTY === true;
  const printLink = shouldPrintLink({ isTTY: isTTY, open: !!flags.open });
  const proposalSource = proposalSourceFromEnv();

  let port = Number.isInteger(flags.port) ? flags.port : DEFAULT_PORT;
  let armed = null;
  const rec = readState();
  if (rec && isOurShell(rec) && rec.serverEntry === manifest.serverEntry && rec.daemonPort === daemonPort && rec.proposalSource === proposalSource && (await probePort(rec.port, 500))) {
    const token = readControlToken(); // refuses a link, a foreign owner, a readable file
    if (token) {
      const a = await armSignIn(rec.port, token, printLink);
      if (a.ok) {
        port = rec.port;
        armed = a;
      }
    }
    if (!armed) {
      // Ours, but it would not take a sign-in (token lost or refused): replace it, never leave it half-owned.
      await stopShell();
    }
  } else if (rec) {
    // A record for a server that is gone, was started from another build, points at a restarted daemon or runs
    // another proposal source.
    if (isOurShell(rec)) await stopShell();
    else clearState();
  }

  if (!armed) {
    const spawned = await spawnShell({ serverEntry: manifest.serverEntry, port, daemonPort, proposalSource });
    writeState({
      pid: spawned.pid, port, daemonPort, started: spawned.started, proposalSource,
      started_at: new Date().toISOString(), serverEntry: manifest.serverEntry, version: manifest.version,
    });
    // The window (60 s) starts when the server can take it: the port answers, then the token file is there.
    const token = await waitForControlToken();
    armed = await armSignIn(port, token, printLink);
    if (!armed.ok) {
      throw new Refusal('The workspace server would not take a sign-in.\n  Why: its control channel refused the request.\n  Fix: run node lib/ui-shell/launch.cjs stop, then start it again.');
    }
  }

  if (printLink) {
    process.stdout.write(linkFor(port, armed.code) + '\n' + LINK_NOTE + '\n');
    return 0;
  }
  // Not a terminal, or --open: the browser goes to the secret-free start URL; no code exists to show.
  const opener = typeof deps.openBrowser === 'function' ? deps.openBrowser : defaultOpenBrowser;
  let opened = false;
  try {
    opened = (await opener(startUrlFor(port))) === true;
  } catch (_e) {
    opened = false;
  }
  if (opened) {
    process.stdout.write('Opening the workspace in your browser on this computer. Sign-in happens there, once.\n');
  } else {
    process.stdout.write('The workspace is running on this computer, but no browser could be opened from here.\n'
      + 'For a one-time sign-in link, run this in your own terminal:\n  ' + ownTerminalCommand() + '\n');
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

module.exports = {
  main, parseArgs, mintCode, isOurShell, processStartToken, shouldPrintLink, readState, stateFile, controlTokenFile,
  LINK_NOTE, DEFAULT_PORT, SHELL_ENV_ALLOWLIST, PROPOSAL_SOURCES,
};

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exit(code); }, (err) => {
    process.stderr.write('The workspace launcher failed unexpectedly: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  });
}
