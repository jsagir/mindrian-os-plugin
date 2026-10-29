#!/usr/bin/env node
'use strict';

/**
 * Regression (quick 261029-kqv): the Stop hook skips compute-state when the
 * room is unchanged, and runs the rebuild in a detached child under a
 * room-local lock when the room changed.
 *
 * Why: on 2026-10-29 scripts/compute-state took 8,382 ms on a real room on
 * /mnt/c (584 forks), and the hook paid that cost on every turn end because
 * scripts/on-stop ran it synchronously. The Stop event median was 15,754 ms.
 *
 * Contracts under test:
 *   C-1  An unchanged room: the hook does not run compute-state. STATE.md
 *        stays byte-identical.
 *   C-2  A changed room: a detached child rebuilds STATE.md through
 *        state-write.cjs, and the hook returns before the rebuild ends. A
 *        live lock (live pid, age 120 s or less) blocks a second rebuild. A
 *        dead-pid lock or an aged lock is taken over.
 *   DD-1 A missing STATE.md is rebuilt synchronously, before the hook returns.
 *   DD-4 A rooms registry newer than STATE.md, or a STATE.md older than 24 h,
 *        also triggers a rebuild.
 *
 * Hook-free method, no test seam in production code: each case builds a temp
 * plugin tree whose entries symlink to the real plugin, except scripts/compute-state,
 * which is a fake that records start and end times in a marker file and
 * prints a STATE.md body holding the line "kqv-fake-token". The real
 * scripts/on-stop is symlinked in; it resolves its siblings from the temp
 * tree because SCRIPT_DIR comes from dirname of $0.
 *
 * Zero test frameworks. Node built-in modules only. CJS only.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REAL_ROOT = path.resolve(__dirname, '..');
const TOKEN = 'kqv-fake-token';

let failed = 0;
async function checkAsync(name, fn) {
  try {
    await fn();
    process.stdout.write('  ok ' + name + '\n');
  } catch (err) {
    failed += 1;
    process.stderr.write('  FAIL ' + name + '\n    ' +
      (err && err.message ? err.message : err) + '\n');
  }
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function pollUntil(fn, deadlineMs) {
  const end = Date.now() + deadlineMs;
  for (;;) {
    let v = false;
    try { v = fn(); } catch (_) { v = false; }
    if (v) return true;
    if (Date.now() >= end) return false;
    await sleep(100);
  }
}

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const FAKE_COMPUTE_STATE = [
  '#!/usr/bin/env bash',
  'now_ms() { node -e "process.stdout.write(String(Date.now()))"; }',
  'if [ -n "${KQV_MARKER:-}" ]; then echo "start $(now_ms)" >> "$KQV_MARKER"; fi',
  'sleep "${KQV_FAKE_SLEEP_S:-0}"',
  'if [ -n "${KQV_MARKER:-}" ]; then echo "end $(now_ms)" >> "$KQV_MARKER"; fi',
  'printf "%s\\n" "---" "computed: kqv-fake" "---" "" "# Data Room State" "" "' + TOKEN + '"',
  '',
].join('\n');

function buildPluginTree(tmp) {
  const root = path.join(tmp, 'plugin');
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  for (const name of fs.readdirSync(REAL_ROOT)) {
    if (name === 'scripts') continue;
    fs.symlinkSync(path.join(REAL_ROOT, name), path.join(root, name));
  }
  for (const name of fs.readdirSync(path.join(REAL_ROOT, 'scripts'))) {
    if (name === 'compute-state') continue;
    fs.symlinkSync(path.join(REAL_ROOT, 'scripts', name), path.join(root, 'scripts', name));
  }
  const fake = path.join(root, 'scripts', 'compute-state');
  fs.writeFileSync(fake, FAKE_COMPUTE_STATE, { mode: 0o755 });
  fs.chmodSync(fake, 0o755);
  return root;
}

function buildFixture(opts) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kqv-stop-'));
  const pluginRoot = buildPluginTree(tmp);
  const roomsHome = path.join(tmp, 'rooms-home');
  const roomDir = path.join(roomsHome, 'venture');
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(roomDir, '.room-root'), '');
  const sec = path.join(roomDir, 'market-analysis');
  fs.mkdirSync(sec, { recursive: true });
  fs.writeFileSync(path.join(sec, 'ROOM.md'), '# market-analysis\n\nIdentity text.\n');
  fs.writeFileSync(path.join(sec, 'artifact-01.md'), '# artifact 01\n\nBody.\n');
  const workDir = path.join(tmp, 'work', 'venture');
  fs.mkdirSync(workDir, { recursive: true });
  const home = path.join(tmp, 'home');
  fs.mkdirSync(home, { recursive: true });
  const stateFile = path.join(roomDir, 'STATE.md');
  if (!opts || opts.state !== false) {
    fs.writeFileSync(stateFile, '# Data Room State\n\nprevious-state-body\n');
  }
  return {
    tmp, pluginRoot, roomsHome, roomDir, workDir, home, stateFile,
    section: sec,
    artifact: path.join(sec, 'artifact-01.md'),
    marker: path.join(tmp, 'marker.txt'),
    lock: path.join(roomDir, '.mindrian', 'state-recompute.lock'),
    log: path.join(roomDir, '.mindrian', 'session-close.log'),
  };
}

function setTreeMtime(dir, whenMs) {
  const t = new Date(whenMs);
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      fs.utimesSync(p, t, t);
    }
    fs.utimesSync(d, t, t);
  };
  walk(dir);
}

function setMtime(file, whenMs) {
  const t = new Date(whenMs);
  fs.utimesSync(file, t, t);
}

// STATE.md newer than every other room file.
function makeUnchanged(fx) {
  const now = Date.now();
  setTreeMtime(fx.roomDir, now - 3600 * 1000);
  setMtime(fx.stateFile, now - 60 * 1000);
}

function runHook(fx, sleepS) {
  const env = Object.assign({}, process.env);
  delete env.MINDRIAN_MCP_FIRST;
  delete env.CLAUDE_ACTIVE_ROOM;
  delete env.MINDRIAN_TRANSCRIPT_PATH;
  Object.assign(env, {
    HOME: fx.home,
    MINDRIAN_ROOMS_HOME: fx.roomsHome,
    PWD: fx.workDir,
    CLAUDE_PLUGIN_ROOT: fx.pluginRoot,
    KQV_MARKER: fx.marker,
    KQV_FAKE_SLEEP_S: String(sleepS || 0),
    MINDRIAN_GUARDIAN_ONSTOP_TIMEOUT_S: '1',
  });
  const res = spawnSync('bash', [path.join(fx.pluginRoot, 'scripts', 'on-stop')], {
    cwd: fx.workDir,
    env,
    input: JSON.stringify({ session_id: 'kqv-test-session', hook_event_name: 'Stop' }),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 60000,
  });
  res.returnedAt = Date.now();
  return res;
}

function readMarker(fx) {
  let txt = '';
  try { txt = fs.readFileSync(fx.marker, 'utf8'); } catch (_) { return { starts: [], ends: [] }; }
  const starts = [];
  const ends = [];
  for (const line of txt.split('\n')) {
    const m = /^(start|end) (\d+)$/.exec(line.trim());
    if (!m) continue;
    (m[1] === 'start' ? starts : ends).push(Number(m[2]));
  }
  return { starts, ends };
}

function stateHasToken(fx) {
  try { return fs.readFileSync(fx.stateFile, 'utf8').includes(TOKEN); } catch (_) { return false; }
}

function logText(fx) {
  try { return fs.readFileSync(fx.log, 'utf8'); } catch (_) { return ''; }
}

function assertContinueTrue(res) {
  assert.strictEqual(res.status, 0, 'hook exit status ' + res.status + ' stderr: ' + (res.stderr || '').slice(0, 300));
  const lines = (res.stdout || '').split('\n').filter((l) => l.trim());
  assert.ok(lines.length > 0, 'hook printed no stdout');
  const obj = JSON.parse(lines[lines.length - 1]);
  assert.strictEqual(obj.continue, true, 'last stdout line is not continue:true: ' + lines[lines.length - 1]);
}

async function cleanup(fx, plantedPid) {
  // Wait for a late detached child, then remove the tree.
  await pollUntil(() => {
    const m = readMarker(fx);
    if (m.ends.length < m.starts.length) return false;
    if (!fs.existsSync(fx.lock)) return true;
    try {
      const first = fs.readFileSync(fx.lock, 'utf8').split('\n')[0].trim();
      return plantedPid !== undefined && first === String(plantedPid);
    } catch (_) { return true; }
  }, 15000);
  fs.rmSync(fx.tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

function writeLock(fx, pid, ageS) {
  fs.writeFileSync(fx.lock, String(pid) + '\n');
  if (ageS) setMtime(fx.lock, Date.now() - ageS * 1000);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
  // Symlink probe.
  try {
    const probeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kqv-probe-'));
    try {
      fs.symlinkSync(__filename, path.join(probeDir, 'l'));
    } finally {
      fs.rmSync(probeDir, { recursive: true, force: true });
    }
  } catch (err) {
    if (err && (err.code === 'EPERM' || err.code === 'EACCES')) {
      process.stdout.write('SKIP: symlinks unavailable on this platform\n');
      process.exit(0);
    }
    throw err;
  }

  await checkAsync('A skip: an unchanged room does not run compute-state (C-1)', async () => {
    const fx = buildFixture();
    try {
      makeUnchanged(fx);
      const before = fs.readFileSync(fx.stateFile);
      const res = runHook(fx, 0);
      await sleep(2000);
      assert.ok(!fs.existsSync(fx.marker), 'compute-state ran on an unchanged room');
      assert.ok(before.equals(fs.readFileSync(fx.stateFile)), 'STATE.md changed on an unchanged room');
      assertContinueTrue(res);
      assert.ok(/mode=skip/.test(logText(fx)), 'session-close.log has no mode=skip line: ' + logText(fx).slice(-300));
    } finally {
      await cleanup(fx);
    }
  });

  await checkAsync('B detached: a changed room rebuilds in a child and the hook does not wait (C-2)', async () => {
    const fx = buildFixture();
    try {
      makeUnchanged(fx);
      setMtime(fx.artifact, Date.now());
      const res = runHook(fx, 6);
      assertContinueTrue(res);
      const ok = await pollUntil(() => stateHasToken(fx), 10000);
      assert.ok(ok, 'STATE.md never received the rebuilt body');
      const m = readMarker(fx);
      assert.strictEqual(m.starts.length, 1, 'expected 1 start line, got ' + m.starts.length);
      assert.strictEqual(m.ends.length, 1, 'expected 1 end line, got ' + m.ends.length);
      assert.ok(m.ends[0] > res.returnedAt, 'compute-state ended before the hook returned: the hook waited (end ' +
        m.ends[0] + ' vs return ' + res.returnedAt + ')');
      const gone = await pollUntil(() => !fs.existsSync(fx.lock), 3000);
      assert.ok(gone, 'lock file still present after the rebuild');
      assert.ok(/mode=detached/.test(logText(fx)), 'session-close.log has no mode=detached line');
    } finally {
      await cleanup(fx);
    }
  });

  await checkAsync('C live lock: no second rebuild starts (C-2)', async () => {
    const fx = buildFixture();
    try {
      makeUnchanged(fx);
      setMtime(fx.artifact, Date.now());
      writeLock(fx, process.pid, 0);
      const before = fs.readFileSync(fx.stateFile);
      const res = runHook(fx, 0);
      await sleep(3000);
      assert.ok(!fs.existsSync(fx.marker), 'compute-state ran while a live lock was held');
      const first = fs.readFileSync(fx.lock, 'utf8').split('\n')[0].trim();
      assert.strictEqual(first, String(process.pid), 'lock no longer holds the test pid');
      assert.ok(before.equals(fs.readFileSync(fx.stateFile)), 'STATE.md changed under a live lock');
      assertContinueTrue(res);
      assert.ok(/mode=locked/.test(logText(fx)), 'session-close.log has no mode=locked line');
    } finally {
      await cleanup(fx, process.pid);
    }
  });

  await checkAsync('D dead-pid lock: taken over (C-2)', async () => {
    const fx = buildFixture();
    try {
      makeUnchanged(fx);
      setMtime(fx.artifact, Date.now());
      const dead = spawnSync('true').pid;
      writeLock(fx, dead, 0);
      runHook(fx, 0);
      const ok = await pollUntil(() => stateHasToken(fx), 10000);
      assert.ok(ok, 'STATE.md never received the rebuilt body after a dead-pid lock');
      const gone = await pollUntil(() => !fs.existsSync(fx.lock), 5000);
      assert.ok(gone, 'lock file still present at the end');
    } finally {
      await cleanup(fx);
    }
  });

  await checkAsync('E aged lock: taken over although the pid is live (C-2)', async () => {
    const fx = buildFixture();
    try {
      makeUnchanged(fx);
      setMtime(fx.artifact, Date.now());
      writeLock(fx, process.pid, 300);
      runHook(fx, 0);
      const ok = await pollUntil(() => stateHasToken(fx), 10000);
      assert.ok(ok, 'STATE.md never received the rebuilt body after an aged lock');
      const gone = await pollUntil(() => !fs.existsSync(fx.lock), 5000);
      assert.ok(gone, 'lock file still present at the end');
    } finally {
      await cleanup(fx);
    }
  });

  await checkAsync('F missing STATE.md: rebuilt before the hook returns (DD-1)', async () => {
    const fx = buildFixture({ state: false });
    try {
      assert.ok(!fs.existsSync(fx.stateFile), 'fixture should have no STATE.md');
      runHook(fx, 0);
      assert.ok(fs.existsSync(fx.stateFile), 'STATE.md missing right after the hook returned');
      assert.ok(stateHasToken(fx), 'STATE.md does not hold the rebuilt body right after the hook returned');
    } finally {
      await cleanup(fx);
    }
  });

  await checkAsync('G registry newer than STATE.md triggers a rebuild (DD-4)', async () => {
    const fx = buildFixture();
    try {
      makeUnchanged(fx);
      fs.mkdirSync(path.join(fx.roomsHome, '.rooms'), { recursive: true });
      const reg = path.join(fx.roomsHome, '.rooms', 'registry.json');
      fs.writeFileSync(reg, JSON.stringify({ rooms: {} }));
      setMtime(reg, Date.now());
      runHook(fx, 0);
      const ok = await pollUntil(() => stateHasToken(fx), 10000);
      assert.ok(ok, 'STATE.md never received the rebuilt body after a registry change');
    } finally {
      await cleanup(fx);
    }
  });

  await checkAsync('H STATE.md older than 24 h triggers a rebuild (DD-4)', async () => {
    const fx = buildFixture();
    try {
      const now = Date.now();
      setTreeMtime(fx.roomDir, now - 3 * 86400 * 1000);
      setMtime(fx.stateFile, now - 2 * 86400 * 1000);
      runHook(fx, 0);
      const ok = await pollUntil(() => stateHasToken(fx), 10000);
      assert.ok(ok, 'STATE.md never received the rebuilt body when it was 2 days old');
    } finally {
      await cleanup(fx);
    }
  });

  if (failed > 0) {
    process.stderr.write('stop-skip-recompute: ' + failed + ' FAILED\n');
    process.exit(1);
  }
  process.stdout.write('stop-skip-recompute: ALL PASS\n');
}

main().catch((err) => {
  process.stderr.write('stop-skip-recompute: crashed: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
