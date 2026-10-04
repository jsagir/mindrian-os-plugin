#!/usr/bin/env node
'use strict';

/**
 * Phase 369 Plan 22 (SHELL369-08, SHELL369-09) -- the launch surface.
 * ==========================================================================
 * The navigator ruled (369-LAUNCH-RULING.md, 2026-10-03): the shell opens through a `shell`
 * argument on /mos:dashboard, and Claude Desktop gets the D-03 two sentences through the
 * room_list tool description. Arms:
 *
 *   1. launcher   against the fake shell server and a real hermetic flag-ON daemon: start prints
 *                 one link with a code= parameter and the 60-second line; the link answers 303
 *                 once and then not again; a second start reuses the running server through the
 *                 control endpoint and prints a new working link; status reports it; the spawned
 *                 server never sees CLAUDE_CODE_SESSION_ID and its argv carries no code; the
 *                 control token file is 0600 in a 0700 directory; stop kills only the recorded
 *                 shell pid (a foreign pid in shell.json is left alone) and not the daemon; a
 *                 missing build is a plain refusal, exit 1.
 *   2. command    the Desktop and Cowork section of commands/dashboard.md holds the exact two
 *                 sentences with the ruled command, and none of the forbidden words; copy.ts
 *                 carries the same command; the skill mirror matches.
 *   3. generators the mirror, registry, connector, projection, render-coverage and shape
 *                 declaration checks exit 0 (spawned), with no violation naming the dashboard.
 *   4. frozen     the Part 8 BOUNDARIES paragraph is untouched.
 *   5. D-02       the three MCP App views, their HTML and lib/mcp/app-views.cjs are untouched by
 *                 this plan.
 *   6. Desktop    369-LAUNCH-RULING.md has a Desktop delivery: line; the live room_list
 *                 description carries the two sentences with the ruled command; the 267, 270 and
 *                 276 suites exit 0 (spawned).
 *
 * No em-dashes (hyphens only). CJS.
 */

const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const LAUNCHER = path.join(REPO, 'lib', 'ui-shell', 'launch.cjs');
const FAKE = path.join(__dirname, 'fixtures', '369', 'fake-shell-server.cjs');
const RULING = path.join(REPO, '.planning', 'phases', '369-ui-shell-an-agent-native-app-over-the-mindrianos-mcp-server-', '369-LAUNCH-RULING.md');
const DASHBOARD = path.join(REPO, 'commands', 'dashboard.md');
const DASHBOARD_MIRROR = path.join(REPO, 'skills', 'dashboard', 'SKILL.md');
const COPY_TS = path.join(REPO, 'ui', 'shell', 'client', 'copy.ts');
const { startDaemon, stopDaemon } = require('./helpers/mcp-daemon-369.cjs');

let passed = 0;
let failed = 0;
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

function pidAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return !!(e && e.code === 'EPERM');
  }
}

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

// The three fetch-metadata headers a real browser navigation sends (plan 369-37); a curl-shaped request has none.
const NAV = { 'sec-fetch-site': 'none', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' };

function get(url, headers) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers: headers || {} }, (res) => {
      res.resume();
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers }));
    }).on('error', reject);
  });
}

function runLauncher(args, env) {
  return cp.spawnSync(process.execPath, [LAUNCHER].concat(args), { env, encoding: 'utf8', timeout: 60000 });
}

// The two sentences, with the ruled command, from the ruling file's own Launch command: line.
function ruledCommand() {
  const m = fs.readFileSync(RULING, 'utf8').match(/^Launch command:\s*`([^`]+)`/m);
  assert.ok(m, '369-LAUNCH-RULING.md must carry a "Launch command:" line with the command in backticks');
  return m[1];
}

function twoSentences(command) {
  return 'This runs on your machine from Claude Code. Open Claude Code on this computer and run ' + command + ' to see your room in the browser.';
}

function section(md, heading) {
  const start = md.indexOf('\n' + heading + '\n');
  assert.ok(start !== -1, 'missing section ' + heading);
  const rest = md.slice(start + heading.length + 2);
  const end = rest.search(/\n## /);
  return end === -1 ? rest : rest.slice(0, end);
}

function spawnedExit(args, env) {
  return cp.spawnSync(process.execPath, args, { cwd: REPO, env: env || process.env, encoding: 'utf8', timeout: 480000 });
}

async function main() {
  console.log('Phase 369-22 (SHELL369-08/09): launch surface');

  // ---------------------------------------------------------------- arm 1
  let daemon = null;
  const tmpDist = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-launch-dist-'));
  const savedEnv = {};
  const patchEnv = (patch) => {
    for (const k of Object.keys(patch)) {
      if (!(k in savedEnv)) savedEnv[k] = process.env[k];
      if (patch[k] === null) delete process.env[k]; else process.env[k] = patch[k];
    }
  };
  try {
    fs.writeFileSync(path.join(tmpDist, 'manifest.json'), JSON.stringify({
      serverEntry: path.relative(tmpDist, FAKE),
      version: 'test-build',
      sourceHash: 'abc123def456abc123def456',
    }));
    daemon = await startDaemon({ rooms: [] });
    const port = await freePort();
    const stateDir = path.join(daemon.env.HOME, '.mindrian', 'ui-shell');
    const dumpFile = path.join(stateDir, 'fake-env-dump.json');
    const armsFile = path.join(stateDir, 'fake-arms.json');
    const readDump = () => JSON.parse(fs.readFileSync(dumpFile, 'utf8'));
    const readArms = () => { try { return JSON.parse(fs.readFileSync(armsFile, 'utf8')); } catch (_e) { return []; } };
    const readRec = () => JSON.parse(fs.readFileSync(path.join(stateDir, 'shell.json'), 'utf8'));
    const env = Object.assign({}, daemon.env, {
      CLAUDE_CODE_SESSION_ID: 'cli-session-369-22',
      MOS_SHELL_START_TIMEOUT_MS: '15000',
      MINDRIAN_OPEN_BROWSER_DISABLE: '1',
    });
    delete env.MOS_SHELL_CONTROL_TOKEN_FILE;
    delete env.MOS_PROPOSAL_SOURCE;
    const args = ['start', '--port', String(port), '--dist', tmpDist];

    // In-process runs (an injected terminal flag and an injected opener) use the launcher's main(argv, deps)
    // against the same hermetic daemon: HOME points at the hermetic home, the daemon lifecycle is a stub that
    // answers the already-running hermetic daemon.
    patchEnv({
      HOME: daemon.env.HOME, MOS_SHELL_CONTROL_TOKEN_FILE: null, MOS_PROPOSAL_SOURCE: null,
      MOS_SHELL_START_TIMEOUT_MS: '15000', CLAUDE_CODE_SESSION_ID: 'cli-session-369-22',
    });
    const launcher = require(LAUNCHER);
    const lifecycle = { ensureDaemon: async () => ({ port: daemon.port }), discoverPort: () => daemon.port };
    async function inProcess(argv, deps) {
      const chunks = [];
      const real = process.stdout.write;
      process.stdout.write = (s) => { chunks.push(String(s)); return true; };
      let code;
      try { code = await launcher.main(argv, Object.assign({ lifecycle }, deps || {})); } finally { process.stdout.write = real; }
      return { code, stdout: chunks.join('') };
    }
    const linkRe = new RegExp('^http://127\\.0\\.0\\.1:' + port + '/auth/bootstrap\\?code=[A-Za-z0-9_-]{43}$');
    let firstLink = null;
    let firstPid = null;

    await test('arm 1a: on a terminal, start prints one one-time link and the 60-second line', async () => {
      const r = await inProcess(args, { isTTY: true, openBrowser: async () => true });
      assert.equal(r.code, 0, 'exit 0, got ' + r.code);
      const lines = r.stdout.trim().split('\n');
      assert.equal(lines.length, 2, 'exactly two lines on stdout: ' + JSON.stringify(lines));
      assert.match(lines[0], linkRe);
      assert.equal(lines[1], 'This link works once, for this computer only, for the next 60 seconds.');
      firstLink = lines[0];
      const state = readRec();
      assert.equal(state.port, port);
      assert.ok(Number.isInteger(state.pid) && pidAlive(state.pid), 'the shell server is running');
      assert.ok(typeof state.started === 'string' && state.started.length > 0, 'the process start time is recorded (WR-12)');
      firstPid = state.pid;
    });

    await test('arm 1b: the link answers 303 once, only to a browser navigation, and the second use does not', async () => {
      assert.ok(firstLink, 'needs arm 1a');
      const bare = await get(firstLink);
      assert.equal(bare.status, 403, 'a request with no navigation headers (curl-shaped, no Origin) redeems nothing');
      const a = await get(firstLink, NAV);
      assert.equal(a.status, 303, 'the refusal above burned nothing');
      assert.ok(String(a.headers['set-cookie'] || '').includes('HttpOnly'));
      const b = await get(firstLink, NAV);
      assert.notEqual(b.status, 303, 'a used code must not sign in again');
    });

    await test('arm 1c: the spawned server has no CLAUDE_CODE_SESSION_ID, no bootstrap hash and no code in its argv', () => {
      const dump = readDump();
      assert.ok(!dump.keys.includes('CLAUDE_CODE_SESSION_ID'), 'CLAUDE_CODE_SESSION_ID must not reach the shell server');
      assert.ok(!dump.keys.includes('MOS_SHELL_BOOTSTRAP_SHA256'), 'the hash goes through the control channel, not the environment');
      assert.equal(dump.argvHasCode, false);
      assert.equal(dump.hostname, '127.0.0.1');
      assert.equal(dump.daemonUrl, 'http://127.0.0.1:' + daemon.port);
    });

    await test('arm 1d: the control token file is 0600 in a 0700 directory', () => {
      const file = path.join(stateDir, 'control.token');
      assert.equal(fs.statSync(file).mode & 0o777, 0o600);
      assert.equal(fs.statSync(stateDir).mode & 0o777, 0o700);
    });

    await test('arm 1e: a second start on a terminal reuses the running server and prints a new working link', async () => {
      const r = await inProcess(args, { isTTY: true, openBrowser: async () => true });
      assert.equal(r.code, 0);
      const link = r.stdout.trim().split('\n')[0];
      assert.notEqual(link, firstLink, 'a fresh code each run');
      assert.equal(readRec().pid, firstPid, 'same server process');
      const res = await get(link, NAV);
      assert.equal(res.status, 303, 'the new link signs in');
    });

    await test('arm 1f: status reports the running server', () => {
      const r = runLauncher(['status'], env);
      assert.equal(r.status, 0);
      assert.match(r.stdout, new RegExp('^running on 127\\.0\\.0\\.1:' + port));
    });

    // ------------------------------------------------------------ CR-01: not a terminal
    await test('arm 1j (CR-01): not a terminal, start prints no code and no sign-in link, and names the own-terminal command', () => {
      const armsBefore = readArms().length;
      const r = runLauncher(args, env); // spawnSync: stdout is a pipe, never a terminal
      assert.equal(r.status, 0, 'stderr: ' + r.stderr);
      const all = r.stdout + r.stderr;
      assert.ok(!/code=/.test(all), 'no code= anywhere in the output a command relay would carry: ' + JSON.stringify(all));
      assert.ok(!/\/auth\/bootstrap/.test(all), 'no bootstrap link in the output');
      assert.ok(!/[A-Za-z0-9_-]{43}/.test(all.replace(LAUNCHER, '')), 'nothing code-shaped in the output');
      assert.ok(all.includes('no browser could be opened'), 'plain words when the opener is off: ' + JSON.stringify(all));
      assert.ok(all.includes('node ' + LAUNCHER + ' start'), 'names the command to run in the own terminal');
      const arms = readArms().slice(armsBefore);
      assert.ok(arms.length === 1 && arms[0].kind === 'start', 'armed the start slot through the control channel: ' + JSON.stringify(arms));
    });

    await test('arm 1k (CR-01): not a terminal, the browser opens at the secret-free /auth/start (nothing in the URL)', async () => {
      const opened = [];
      const armsBefore = readArms().length;
      const r = await inProcess(args, { isTTY: false, openBrowser: async (u) => { opened.push(u); return true; } });
      assert.equal(r.code, 0);
      assert.deepEqual(opened, ['http://127.0.0.1:' + port + '/auth/start'], 'the opener got exactly /auth/start');
      assert.ok(!/[?#]/.test(opened[0]), 'no query and no fragment');
      assert.ok(!/code=|\/auth\/bootstrap/.test(r.stdout), 'stdout carries no code: ' + JSON.stringify(r.stdout));
      assert.match(r.stdout, /Opening the workspace in your browser on this computer\. Sign-in happens there, once\./);
      const arms = readArms().slice(armsBefore);
      assert.equal(arms.length, 1);
      assert.equal(arms[0].kind, 'start');
      assert.ok(arms[0].listeningAt !== null && arms[0].at >= arms[0].listeningAt, 'armed after the port answered');
      const slot = await get('http://127.0.0.1:' + port + '/auth/start', NAV);
      assert.equal(slot.status, 303, 'the opened URL signs in once');
      const again = await get('http://127.0.0.1:' + port + '/auth/start', NAV);
      assert.notEqual(again.status, 303, 'and not twice');
    });

    await test('arm 1l (CR-01): --open on a terminal also opens /auth/start and prints no code', async () => {
      const opened = [];
      const r = await inProcess(args.concat(['--open']), { isTTY: true, openBrowser: async (u) => { opened.push(u); return true; } });
      assert.equal(r.code, 0);
      assert.deepEqual(opened, ['http://127.0.0.1:' + port + '/auth/start']);
      assert.ok(!/code=|\/auth\/bootstrap/.test(r.stdout), 'stdout carries no code: ' + JSON.stringify(r.stdout));
    });

    await test('arm 1l2: an opener that throws or answers false says so in plain words, never prints a code', async () => {
      for (const opener of [async () => false, async () => { throw new Error('no display'); }]) {
        const r = await inProcess(args, { isTTY: false, openBrowser: opener });
        assert.equal(r.code, 0);
        assert.match(r.stdout, /no browser could be opened from here/);
        assert.ok(r.stdout.includes('node ' + LAUNCHER + ' start'));
        assert.ok(!/code=|\/auth\/bootstrap/.test(r.stdout));
      }
    });

    await test('arm 1l3: shouldPrintLink is true only on a terminal without --open', () => {
      assert.equal(typeof launcher.shouldPrintLink, 'function', 'shouldPrintLink is exported');
      assert.equal(launcher.shouldPrintLink({ isTTY: false, open: false }), false);
      assert.equal(launcher.shouldPrintLink({ isTTY: false, open: true }), false);
      assert.equal(launcher.shouldPrintLink({ isTTY: true, open: true }), false);
      assert.equal(launcher.shouldPrintLink({ isTTY: true, open: false }), true);
    });

    await test('arm 1m: under a pseudo-terminal the same command prints the link (ENV GAP and skipped when script is absent)', () => {
      const probe = cp.spawnSync('script', ['--version'], { encoding: 'utf8' });
      if (probe.error) { console.log('    ENV GAP: the script utility is not installed; the pseudo-terminal arm is skipped'); return; }
      const cmd = [process.execPath, LAUNCHER].concat(args).map((a) => "'" + a + "'").join(' ');
      const r = cp.spawnSync('script', ['-q', '-c', cmd, '/dev/null'], { env, encoding: 'utf8', timeout: 60000 });
      const text = r.stdout.replace(/\r/g, '');
      const line = text.split('\n').find((l) => linkRe.test(l.trim()));
      assert.ok(line, 'a terminal run prints the link: ' + JSON.stringify(text.slice(0, 300)));
      assert.ok(text.includes('This link works once'), 'and the 60-second line');
    });

    await test('arm 1g: stop kills only the recorded shell pid and leaves the daemon alone', async () => {
      const daemonPidBefore = daemon.child.pid;
      const r = runLauncher(['stop'], env);
      assert.equal(r.status, 0);
      for (let i = 0; i < 40 && pidAlive(firstPid); i += 1) await sleep(50);
      assert.ok(!pidAlive(firstPid), 'the shell server is gone');
      assert.ok(pidAlive(daemonPidBefore), 'the daemon is untouched');
      assert.ok(!fs.existsSync(path.join(stateDir, 'shell.json')));
    });

    await test('arm 1h: stop never kills a pid it did not start (a foreign pid in shell.json)', async () => {
      const foreign = cp.spawn(process.execPath, ['-e', 'setTimeout(function(){},60000)'], { stdio: 'ignore' });
      try {
        fs.writeFileSync(path.join(stateDir, 'shell.json'), JSON.stringify({ pid: foreign.pid, port: port, serverEntry: FAKE }));
        const r = runLauncher(['stop'], env);
        assert.equal(r.status, 0);
        await sleep(300);
        assert.ok(pidAlive(foreign.pid), 'the foreign process must survive stop');
        assert.ok(!fs.existsSync(path.join(stateDir, 'shell.json')), 'the stale record is cleared');
      } finally {
        try { process.kill(foreign.pid, 'SIGKILL'); } catch (_e) { /* gone */ }
      }
    });

    await test('arm 1i: a missing build is a plain refusal (exit 1) and nothing starts', () => {
      const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-launch-empty-'));
      try {
        const r = runLauncher(['start', '--port', String(port), '--dist', empty], env);
        assert.equal(r.status, 1);
        assert.match(r.stderr, /^The workspace is not built in this install\./);
        assert.ok(!fs.existsSync(path.join(stateDir, 'shell.json')));
      } finally {
        fs.rmSync(empty, { recursive: true, force: true });
      }
    });

    // ------------------------------------------------------------ WR-13: the environment
    await test('arm 1n (WR-13): the spawned server gets the allow-list and none of the launcher\'s secrets', () => {
      const canary = Object.assign({}, env, {
        ANTHROPIC_API_KEY: 'sk-test-canary', NODE_OPTIONS: '--no-warnings', CLAUDE_CODE_OAUTH_TOKEN: 'canary-oauth',
        MOS_TEST_CANARY: 'canary', MINDRIAN_BRAIN_KEY: 'canary-brain', GITHUB_TOKEN: 'canary-gh',
      });
      const r = runLauncher(args, canary);
      assert.equal(r.status, 0, 'stderr: ' + r.stderr);
      const keys = readDump().keys;
      for (const k of ['ANTHROPIC_API_KEY', 'NODE_OPTIONS', 'CLAUDE_CODE_OAUTH_TOKEN', 'MOS_TEST_CANARY', 'MINDRIAN_BRAIN_KEY', 'GITHUB_TOKEN', 'CLAUDE_CODE_SESSION_ID', 'MOS_SHELL_BOOTSTRAP_SHA256', 'FAKE_SHELL_ENV_DUMP']) {
        assert.ok(!keys.includes(k), k + ' must not reach the shell server; got ' + keys.join(','));
      }
      for (const k of ['PATH', 'HOME', 'MOS_DAEMON_URL', 'MOS_SHELL_PORT', 'MOS_SHELL_CONTROL_TOKEN_FILE', 'MOS_PROPOSAL_SOURCE', 'PORT', 'HOSTNAME', 'NODE_ENV', 'NEXT_TELEMETRY_DISABLED', 'DO_NOT_TRACK']) {
        assert.ok(keys.includes(k), k + ' must reach the shell server; got ' + keys.join(','));
      }
      const allowed = new Set(['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TZ', 'TMPDIR', 'TEMP', 'TMP', 'NODE_PATH', 'MINDRIAN_TEST_MODE',
        'MOS_DAEMON_URL', 'MOS_SHELL_PORT', 'MOS_SHELL_CONTROL_TOKEN_FILE', 'MOS_PROPOSAL_SOURCE', 'NODE_ENV', 'NEXT_TELEMETRY_DISABLED', 'DO_NOT_TRACK', 'PORT', 'HOSTNAME']);
      const extra = keys.filter((k) => !allowed.has(k));
      assert.deepEqual(extra, [], 'only allow-listed names reach the shell server');
    });

    // ------------------------------------------------------------ gap 1: the proposal source
    await test('arm 1o (gap 1): a default start runs the adapter; fixed only when asked; a shell with another source is replaced', () => {
      const pidOf = () => readRec().pid;
      let r = runLauncher(['stop'], env);
      assert.equal(r.status, 0);
      r = runLauncher(args, env);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(readDump().proposalSource, 'adapter', 'default is the ruled room-proposal adapter');
      assert.equal(readRec().proposalSource, 'adapter');
      const adapterPid = pidOf();
      r = runLauncher(args, env);
      assert.equal(pidOf(), adapterPid, 'same source: reused');
      r = runLauncher(args, Object.assign({}, env, { MOS_PROPOSAL_SOURCE: 'fixed' }));
      assert.equal(r.status, 0, r.stderr);
      assert.notEqual(pidOf(), adapterPid, 'a shell started with another source is replaced');
      assert.equal(readDump().proposalSource, 'fixed', 'fixed passes only when the launcher env says fixed');
      assert.equal(readRec().proposalSource, 'fixed');
      const fixedPid = pidOf();
      r = runLauncher(args, Object.assign({}, env, { MOS_PROPOSAL_SOURCE: 'something-else' }));
      assert.equal(r.status, 0, r.stderr);
      assert.notEqual(pidOf(), fixedPid, 'fixed shell replaced');
      assert.equal(readDump().proposalSource, 'adapter', 'any other value is the adapter');
    });

    // ------------------------------------------------------------ WR-12: exact process identity
    await test('arm 1p (WR-12): a decoy that carries the entry path in its argv is not our shell; a changed start time is not ours', async () => {
      assert.equal(typeof launcher.processStartToken, 'function', 'processStartToken is exported');
      const live = readRec();
      assert.equal(launcher.isOurShell(live), true, 'the real shell with matching argv and start time is ours');
      assert.equal(launcher.isOurShell(Object.assign({}, live, { started: 'proc:not-the-start-time' })), false, 'a different start time is not ours');
      const noStart = Object.assign({}, live);
      delete noStart.started;
      assert.equal(launcher.isOurShell(noStart), false, 'a record without a start time is never ours');
      const decoy = cp.spawn(process.execPath, ['-e', 'setInterval(function(){},1e9)', FAKE], { stdio: 'ignore' });
      try {
        await sleep(150);
        const rec = { pid: decoy.pid, port: port, serverEntry: FAKE, started: launcher.processStartToken(decoy.pid) };
        assert.equal(launcher.isOurShell(rec), false, 'the entry path as a later argv element is not the entry');
        runLauncher(['stop'], env); // the real shell goes first, then the decoy is recorded as the shell
        fs.writeFileSync(path.join(stateDir, 'shell.json'), JSON.stringify(rec));
        const r = runLauncher(['stop'], env);
        assert.equal(r.status, 0);
        await sleep(300);
        assert.ok(pidAlive(decoy.pid), 'stop leaves the decoy alone');
        assert.ok(!fs.existsSync(path.join(stateDir, 'shell.json')), 'and clears the record');
      } finally {
        try { process.kill(decoy.pid, 'SIGKILL'); } catch (_e) { /* gone */ }
      }
    });

    await test('arm 1q (WR-12): the Next process title counts only with the working directory equal to the entry directory', async () => {
      if (!fs.existsSync('/proc/self/cmdline')) { console.log('    ENV GAP: no /proc; the title arm is skipped'); return; }
      const script = "process.title='next-server (v16.2.10)'; setInterval(function(){},1e9); // padding so the title fits the original argv: " + 'x'.repeat(80);
      const holdDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-369-launch-cwd-'));
      const inEntryDir = cp.spawn(process.execPath, ['-e', script], { cwd: path.dirname(FAKE), stdio: 'ignore' });
      const elsewhere = cp.spawn(process.execPath, ['-e', script], { cwd: holdDir, stdio: 'ignore' });
      try {
        await sleep(300);
        const mk = (p) => ({ pid: p.pid, port: port, serverEntry: FAKE, started: launcher.processStartToken(p.pid) });
        assert.equal(launcher.isOurShell(mk(inEntryDir)), true, 'titled process with cwd = entry directory is ours');
        assert.equal(launcher.isOurShell(mk(elsewhere)), false, 'titled process elsewhere is not ours');
        assert.equal(launcher.isOurShell(Object.assign(mk(inEntryDir), { started: 'proc:other' })), false, 'and the start time still has to match');
      } finally {
        for (const p of [inEntryDir, elsewhere]) { try { process.kill(p.pid, 'SIGKILL'); } catch (_e) { /* gone */ } }
        fs.rmSync(holdDir, { recursive: true, force: true });
      }
    });

    // ------------------------------------------------------------ WR-14: the token file
    await test('arm 1r (WR-14): a symlink at the control token path is refused with a plain message; nothing arms through it', () => {
      let r = runLauncher(args, env);
      assert.equal(r.status, 0, r.stderr);
      const tokenPath = path.join(stateDir, 'control.token');
      const real = path.join(stateDir, 'control.token.real');
      fs.copyFileSync(tokenPath, real);
      fs.chmodSync(real, 0o600);
      fs.unlinkSync(tokenPath);
      fs.symlinkSync(real, tokenPath);
      const armsBefore = readArms().length;
      r = runLauncher(args, env);
      assert.equal(r.status, 1, 'refused, exit 1; got ' + r.status + ' stdout ' + r.stdout);
      assert.match(r.stderr, /symbolic link/);
      assert.match(r.stderr, /Why:/);
      assert.match(r.stderr, /Fix:/);
      assert.equal(readArms().length, armsBefore, 'no arm went through the link');
      fs.unlinkSync(tokenPath);
      fs.copyFileSync(real, tokenPath);
      fs.chmodSync(tokenPath, 0o600);
      fs.unlinkSync(real);
    });

    await test('arm 1s (WR-14): a token file readable by others is refused; the owner is compared with process.getuid', () => {
      const tokenPath = path.join(stateDir, 'control.token');
      fs.chmodSync(tokenPath, 0o644);
      const armsBefore = readArms().length;
      const r = runLauncher(args, env);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /readable by other users/);
      assert.equal(readArms().length, armsBefore);
      fs.chmodSync(tokenPath, 0o600);
      const src = fs.readFileSync(LAUNCHER, 'utf8');
      assert.match(src, /process\.getuid/, 'the launcher compares the file owner with the running user');
      assert.match(src, /\.uid\s*!==\s*process\.getuid\(\)/);
    });

    await test('arm 1t: stop at the end of the launcher arms', () => {
      const r = runLauncher(['stop'], env);
      assert.equal(r.status, 0);
    });
  } finally {
    for (const k of Object.keys(savedEnv)) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
    // Safety net: never leave a shell server behind.
    try {
      const rec = JSON.parse(fs.readFileSync(path.join(daemon ? daemon.env.HOME : '/nonexistent', '.mindrian', 'ui-shell', 'shell.json'), 'utf8'));
      if (rec && rec.pid && rec.serverEntry === FAKE && pidAlive(rec.pid)) process.kill(rec.pid, 'SIGKILL');
    } catch (_e) { /* none */ }
    if (daemon) await stopDaemon(daemon);
    fs.rmSync(tmpDist, { recursive: true, force: true });
  }

  // ---------------------------------------------------------------- arm 2
  const command = ruledCommand();
  const sentences = twoSentences(command);

  await test('arm 2a: the Desktop and Cowork section of the command doc holds the exact two sentences', () => {
    const md = fs.readFileSync(DASHBOARD, 'utf8');
    const sec = section(md, '## Desktop and Cowork');
    assert.ok(sec.includes(sentences), 'the exact two sentences with ' + command);
    assert.equal(md.split('This runs on your machine from Claude Code.').length - 1, 1, 'the line appears once in the doc');
    assert.match(sec, /never simulate it/);
    for (const word of ['error', 'unsupported', 'not available', 'sorry']) {
      assert.ok(!sec.toLowerCase().includes(word), 'the section must not say "' + word + '"');
    }
    assert.ok(!/[\u2013\u2014]/.test(md), 'no em-dash or en-dash in the command doc');
  });

  await test('arm 2b: the dashboard command takes the shell argument and runs the launcher', () => {
    const md = fs.readFileSync(DASHBOARD, 'utf8');
    assert.match(md, /^argument-hint: "\[live\|stop\|open\|shell\]"$/m);
    assert.match(md, /^hitl_shape: "F\.1"$/m);
    assert.ok(md.includes('ui-shell/launch.cjs'), 'the shell argument runs the launcher');
    assert.ok(!fs.existsSync(path.join(REPO, 'commands', 'workspace.md')), 'no new /mos:workspace command (extend-dashboard ruling)');
    assert.ok(!fs.existsSync(path.join(REPO, 'skills', 'workspace')), 'no workspace skill mirror');
  });

  await test('arm 2c: the skill mirror carries the same two sentences; copy.ts names the ruled command', () => {
    assert.ok(fs.readFileSync(DASHBOARD_MIRROR, 'utf8').includes(sentences));
    const m = fs.readFileSync(COPY_TS, 'utf8').match(/export const LAUNCH_COMMAND = '([^']*)';/);
    assert.ok(m, 'LAUNCH_COMMAND constant');
    assert.equal(m[1], command);
    assert.ok(!m[1].includes('{'), 'no placeholder left');
    const r = spawnedExit(['-e', "import('./ui/shell/client/copy.ts').then(m=>{if(!m.LAUNCH_COMMAND||m.LAUNCH_COMMAND.includes('{'))process.exit(1)})"]);
    assert.equal(r.status, 0, r.stderr);
  });

  // ---------------------------------------------------------------- arm 3
  await test('arm 3: the generator checks exit 0 and no shape violation names the dashboard', () => {
    for (const c of [
      ['scripts/build-skill-mirrors.cjs', '--check'],
      ['scripts/build-command-registry.cjs', '--check'],
      ['scripts/build-connector-registry.cjs', '--check'],
      ['scripts/build-orchestration-projection.cjs', '--check'],
      ['scripts/check-render-coverage.cjs'],
    ]) {
      const r = spawnedExit(c);
      assert.equal(r.status, 0, c.join(' ') + ' exited ' + r.status + ': ' + (r.stdout + r.stderr).slice(-300));
    }
    const shape = spawnedExit(['scripts/check-shape-declaration.cjs', '--check']);
    assert.equal(shape.status, 0, (shape.stdout + shape.stderr).slice(-300));
    const bad = (shape.stdout + shape.stderr).split('\n').filter((l) => /dashboard/i.test(l) && /(WARN|VIOLATION|FAIL)/i.test(l));
    assert.deepEqual(bad, [], 'no violation naming the dashboard command');
  });

  // ---------------------------------------------------------------- arm 4
  await test('arm 4: the Part 8 BOUNDARIES paragraph is untouched', () => {
    const src = fs.readFileSync(path.join(REPO, 'lib', 'mcp', 'runtime-instructions.cjs'), 'utf8');
    assert.ok(src.includes('Heavy pipeline work belongs in Claude Code - say so when asked for it here.'));
    const r = spawnedExit([path.join('lib', 'mcp', 'no-instructions.test.cjs')]);
    assert.equal(r.status, 0, (r.stdout + r.stderr).slice(-300));
  });

  // ---------------------------------------------------------------- arm 5
  await test('arm 5: the MCP App views and their HTML are untouched by this plan', () => {
    const files = ['lib/mcp/app-views.cjs', 'lib/mcp/runtime-instructions.cjs']
      .concat(fs.readdirSync(path.join(REPO, 'lib', 'mcp', 'app-html')).map((f) => 'lib/mcp/app-html/' + f));
    const dirty = cp.spawnSync('git', ['diff', '--name-only', 'HEAD', '--'].concat(files), { cwd: REPO, encoding: 'utf8' });
    assert.equal(dirty.stdout.trim(), '', 'no working-tree change to ' + dirty.stdout.trim());
    const log = cp.spawnSync('git', ['log', '--format=', '--name-only', '--grep=(369-22)', '--'].concat(files), { cwd: REPO, encoding: 'utf8' });
    assert.equal(log.stdout.trim(), '', 'no 369-22 commit touched ' + log.stdout.trim());
  });

  // ---------------------------------------------------------------- arm 6
  await test('arm 6: the Desktop delivery matches the ruling', () => {
    const ruling = fs.readFileSync(RULING, 'utf8');
    const line = ruling.match(/^Desktop delivery:\s*`([^`]+)`/m);
    assert.ok(line, '369-LAUNCH-RULING.md must carry a "Desktop delivery:" line');
    const configs = new Map();
    const fake = { registerTool: (name, config) => { configs.set(name, config); }, tool: () => {} };
    require(path.join(REPO, 'lib', 'mcp', 'tools', 'room.cjs')).register(fake, {});
    const description = configs.get('room_list').description;
    if (line[1] === 'room_list tool description') {
      assert.ok(description.includes(sentences), 'the live room_list description carries the two sentences with ' + command);
      assert.ok(!/^D-03 amendment:/m.test(ruling), 'D-03 stays as locked: no amendment');
    } else {
      assert.match(ruling, /^D-03 amendment:/m, 'BOUNDARIES-line-only needs a recorded D-03 amendment');
      assert.ok(!description.includes('This runs on your machine'), 'room_list unchanged');
    }
  });

  await test('arm 6b: the 267 registration, 270 budget and 276 honesty suites exit 0', () => {
    for (const t of ['test-267-mcpv2-registration-api.cjs', 'test-270-tool-schema-budget.cjs', 'test-276-tool-honesty-findings-closed.cjs']) {
      const r = spawnedExit([path.join('tests', t)]);
      assert.equal(r.status, 0, t + ' exited ' + r.status + ': ' + (r.stdout + r.stderr).slice(-300));
    }
  });

  process.stdout.write('\n' + passed + ' passed, ' + failed + ' failed\n');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
