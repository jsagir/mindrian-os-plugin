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

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
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
  try {
    fs.writeFileSync(path.join(tmpDist, 'manifest.json'), JSON.stringify({
      serverEntry: path.relative(tmpDist, FAKE),
      version: 'test-build',
      sourceHash: 'abc123def456abc123def456',
    }));
    daemon = await startDaemon({ rooms: [] });
    const port = await freePort();
    const envDump = path.join(daemon.env.HOME, 'env-dump.json');
    const env = Object.assign({}, daemon.env, {
      CLAUDE_CODE_SESSION_ID: 'cli-session-369-22',
      FAKE_SHELL_ENV_DUMP: envDump,
      MOS_SHELL_START_TIMEOUT_MS: '15000',
      MINDRIAN_OPEN_BROWSER_DISABLE: '1',
    });
    delete env.MOS_SHELL_CONTROL_TOKEN_FILE;
    const args = ['start', '--port', String(port), '--dist', tmpDist];
    const stateDir = path.join(daemon.env.HOME, '.mindrian', 'ui-shell');
    let firstLink = null;
    let firstPid = null;

    await test('arm 1a: start prints one one-time link and the 60-second line', () => {
      const r = runLauncher(args, env);
      assert.equal(r.status, 0, 'exit 0, got ' + r.status + '; stderr: ' + r.stderr);
      const lines = r.stdout.trim().split('\n');
      assert.equal(lines.length, 2, 'exactly two lines on stdout: ' + JSON.stringify(lines));
      assert.match(lines[0], new RegExp('^http://127\\.0\\.0\\.1:' + port + '/auth/bootstrap\\?code=[A-Za-z0-9_-]{43}$'));
      assert.equal(lines[1], 'This link works once, for this computer only, for the next 60 seconds.');
      firstLink = lines[0];
      const state = JSON.parse(fs.readFileSync(path.join(stateDir, 'shell.json'), 'utf8'));
      assert.equal(state.port, port);
      assert.ok(Number.isInteger(state.pid) && pidAlive(state.pid), 'the shell server is running');
      firstPid = state.pid;
    });

    await test('arm 1b: the link answers 303 once and the second use does not', async () => {
      assert.ok(firstLink, 'needs arm 1a');
      const a = await get(firstLink);
      assert.equal(a.status, 303);
      assert.ok(String(a.headers['set-cookie'] || '').includes('HttpOnly'));
      const b = await get(firstLink);
      assert.notEqual(b.status, 303, 'a used code must not sign in again');
    });

    await test('arm 1c: the spawned server has no CLAUDE_CODE_SESSION_ID and no code in its argv', () => {
      const dump = JSON.parse(fs.readFileSync(envDump, 'utf8'));
      assert.ok(!dump.keys.includes('CLAUDE_CODE_SESSION_ID'), 'CLAUDE_CODE_SESSION_ID must not reach the shell server');
      assert.ok(dump.keys.includes('MOS_SHELL_BOOTSTRAP_SHA256'), 'only the sha256 is handed down');
      assert.equal(dump.argvHasCode, false);
      assert.equal(dump.hostname, '127.0.0.1');
      assert.equal(dump.daemonUrl, 'http://127.0.0.1:' + daemon.port);
    });

    await test('arm 1d: the control token file is 0600 in a 0700 directory', () => {
      const file = path.join(stateDir, 'control.token');
      assert.equal(fs.statSync(file).mode & 0o777, 0o600);
      assert.equal(fs.statSync(stateDir).mode & 0o777, 0o700);
    });

    await test('arm 1e: a second start reuses the running server and prints a new working link', async () => {
      const r = runLauncher(args, env);
      assert.equal(r.status, 0, 'stderr: ' + r.stderr);
      const link = r.stdout.trim().split('\n')[0];
      assert.notEqual(link, firstLink, 'a fresh code each run');
      const state = JSON.parse(fs.readFileSync(path.join(stateDir, 'shell.json'), 'utf8'));
      assert.equal(state.pid, firstPid, 'same server process');
      const res = await get(link);
      assert.equal(res.status, 303, 'the new link signs in');
    });

    await test('arm 1f: status reports the running server', () => {
      const r = runLauncher(['status'], env);
      assert.equal(r.status, 0);
      assert.match(r.stdout, new RegExp('^running on 127\\.0\\.0\\.1:' + port));
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
  } finally {
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
