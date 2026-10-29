#!/usr/bin/env node
'use strict';

/**
 * Regression (quick 261029-lx3): SessionStart reuses STATE.md and a cached
 * analyze-room result on an unchanged room, and the SessionStart coordinator
 * runs the doctor checks at most once in 24 h per plugin version.
 *
 * Why: on 2026-10-29 the SessionStart event took a median of 23,407 ms on a
 * real room on /mnt/c. In one trace scripts/analyze-room took 24,207 ms and
 * scripts/compute-state took 9,876 ms inside scripts/session-start. The
 * coordinator took 12,438 ms, and almost all of it was spawnSync of
 * doctor.cjs. Claude Code holds the first reply until every hook ends.
 *
 * Contracts under test:
 *   C-1  An unchanged room: session-start does not run compute-state. The
 *        [Room State] text equals the persisted compute-state output. Only
 *        the gsd_state_version and status lines are removed (DD-1).
 *   C-2  An unchanged room with a valid cache: no analyze-room run. A failed
 *        or empty run never overwrites the cache (DD-6).
 *   C-3  A fresh stamp: no doctor process. A stale stamp: a detached refresh,
 *        and the contributor returns in under 300 ms. No stamp: one
 *        synchronous run (DD-8 to DD-12).
 *
 * Methods:
 *   S, A cases call scripts/session-start-state directly with a fake scripts
 *        dir. The fake compute-state and the fake analyze-room write a marker
 *        line per run, so "did it run" is a file fact.
 *   S5, W2 use the real scripts and the synthetic room of
 *        tests/test-k1u-session-start-envelope.cjs.
 *   D cases run node children that call throttled(id)() of
 *        scripts/preflight-doctor.cjs with a scratch HOME, a scratch
 *        CLAUDE_PLUGIN_ROOT that holds a fake doctor, and a scratch cwd.
 *   A6   (scope extension) the real scripts/analyze-room exits 0 on a room
 *        whose opportunity-bank/BRIEF.md has no status: line.
 *
 * Zero test frameworks. Node built-in modules only. CJS only.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const HELPER = path.join(REPO, 'scripts', 'session-start-state');
const REAL_SCRIPTS = path.join(REPO, 'scripts');
const REAL_VERSION = JSON.parse(fs.readFileSync(path.join(REPO, '.claude-plugin', 'plugin.json'), 'utf8')).version;
const FI = require(path.join(REPO, 'lib', 'sessionstart', 'contributor-interface.cjs'));

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

function setMtime(file, whenMs) {
  const t = new Date(whenMs);
  fs.utimesSync(file, t, t);
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

function rmTree(dir) {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

const HOUR = 3600 * 1000;

// ---------------------------------------------------------------------------
// Helper fixture (S and A cases)
// ---------------------------------------------------------------------------

const NODE_MARK = 'node -e \'require("fs").appendFileSync(process.env.%VAR%, "%WORD% " + Date.now() + "\\n")\'';
const FAKE_COMPUTE_STATE = [
  '#!/usr/bin/env bash',
  NODE_MARK.replace('%VAR%', 'LX3_MARKER_CS').replace('%WORD%', 'start'),
  'printf "%s\\n" "---" "computed: lx3-fake" "venture_stage: Validation" "total_entries: 1" "---" "# Data Room State" "" "lx3-fake-compute-token"',
  '',
].join('\n');
const FAKE_ANALYZE_ROOM = [
  '#!/usr/bin/env bash',
  NODE_MARK.replace('%VAR%', 'LX3_MARKER_AR').replace('%WORD%', 'run'),
  'if [ "${LX3_AR_OUT-GAP:lx3-fake-analyze-token}" != "EMPTY" ]; then printf "%s\\n" "${LX3_AR_OUT:-GAP:lx3-fake-analyze-token}"; fi',
  'exit "${LX3_AR_RC:-0}"',
  '',
].join('\n');

const PERSISTED_STATE = [
  '---', 'gsd_state_version: 1.0', 'status: active', 'computed: 2026-10-29T00:00:00Z',
  'venture_stage: Validation', 'total_entries: 1', 'current_room: venture', '---',
  '# Data Room State', '', '## Sections', 'lx3-state-token', '',
].join('\n');
const SEED_STATE = [
  '---', 'gsd_state_version: 1.0', 'status: active', '---', '', '# State', '', 'seed body', '',
].join('\n');

function mkHelperFx(opts) {
  const o = Object.assign({ mindrian: true }, opts || {});
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lx3-'));
  const roomsHome = path.join(tmp, 'rooms-home');
  const room = path.join(roomsHome, 'venture');
  fs.mkdirSync(room, { recursive: true });
  if (o.mindrian) fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(room, '.room-root'), '');
  const section = path.join(room, 'market-analysis');
  fs.mkdirSync(section, { recursive: true });
  fs.writeFileSync(path.join(section, 'ROOM.md'), '# market-analysis\n\nIdentity text.\n');
  fs.writeFileSync(path.join(section, 'artifact-01.md'), '# artifact 01\n\nBody.\n');
  const fake = path.join(tmp, 'fake-scripts');
  fs.mkdirSync(fake, { recursive: true });
  for (const [name, body] of [['compute-state', FAKE_COMPUTE_STATE], ['analyze-room', FAKE_ANALYZE_ROOM]]) {
    fs.writeFileSync(path.join(fake, name), body, { mode: 0o755 });
    fs.chmodSync(path.join(fake, name), 0o755);
    setMtime(path.join(fake, name), Date.now() - 2 * HOUR);
  }
  const home = path.join(tmp, 'home');
  fs.mkdirSync(home, { recursive: true });
  return {
    tmp, roomsHome, room, section, fake, home,
    artifact: path.join(section, 'artifact-01.md'),
    state: path.join(room, 'STATE.md'),
    cache: path.join(room, '.mindrian', 'analyze-room.cache'),
    log: path.join(room, '.mindrian', 'session-start-state.log'),
    markerCs: path.join(tmp, 'marker-cs.txt'),
    markerAr: path.join(tmp, 'marker-ar.txt'),
  };
}

function runHelper(fx, mode, extraEnv, scriptsDir) {
  const env = Object.assign({}, process.env);
  delete env.LX3_AR_OUT;
  delete env.LX3_AR_RC;
  Object.assign(env, {
    HOME: fx.home,
    MINDRIAN_ROOMS_HOME: fx.roomsHome,
    LX3_MARKER_CS: fx.markerCs,
    LX3_MARKER_AR: fx.markerAr,
  }, extraEnv || {});
  const res = spawnSync('bash', [HELPER, mode, fx.room, scriptsDir || fx.fake], {
    cwd: fx.room, env, encoding: 'utf8', timeout: 60000,
  });
  assert.strictEqual(res.status, 0, 'helper exit status ' + res.status + ' stderr: ' + (res.stderr || '').slice(0, 300));
  return res;
}

function countLines(file) {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).length; } catch (_) { return 0; }
}
function logText(fx) {
  try { return fs.readFileSync(fx.log, 'utf8'); } catch (_) { return ''; }
}
function readText(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (_) { return null; }
}

// Room files 1 h old. The caller sets the reference file times after this.
function backdateRoom(fx) { setTreeMtime(fx.room, Date.now() - HOUR); }

function writeUnchangedState(fx, text) {
  fs.writeFileSync(fx.state, text === undefined ? PERSISTED_STATE : text);
  backdateRoom(fx);
  setMtime(fx.state, Date.now() - 60 * 1000);
}

function stripKeys(text) {
  return text.split('\n').filter((l) => !/^(gsd_state_version|status):/.test(l)).join('\n');
}

// Plant a warm cache. Room files are 1 h old, the cache is 30 s old.
function writeWarmCache(fx, body) {
  backdateRoom(fx);
  fs.writeFileSync(fx.cache, body === undefined ? 'GAP:lx3-old-cache-token\n' : body);
  setMtime(fx.cache, Date.now() - 30 * 1000);
}

// ---------------------------------------------------------------------------
// Throttle fixture (D cases)
// ---------------------------------------------------------------------------

const FAKE_DOCTOR = [
  "'use strict';",
  "const fs = require('fs');",
  'const m = process.env.LX3_DOCTOR_MARKER;',
  "const args = process.argv.slice(2).join(' ');",
  "if (m) fs.appendFileSync(m, 'start ' + Date.now() + ' ' + args + '\\n');",
  'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Number(process.env.LX3_FAKE_DOCTOR_MS || 0));',
  "if (m) fs.appendFileSync(m, 'end ' + Date.now() + ' ' + args + '\\n');",
  "process.stdout.write(args.includes('--statusline-visibility')",
  "  ? JSON.stringify({ checks: { 'statusline-visibility': { status: 'warn' } } })",
  '  : JSON.stringify({ checks: {} }));',
  '',
].join('\n');

const THROTTLE_CHILD = [
  "const pd = require(process.env.LX3_REPO + '/scripts/preflight-doctor.cjs');",
  'const fn = pd.throttled(process.env.LX3_ID);',
  'const t0 = Date.now();',
  'const frag = fn();',
  'const t1 = Date.now();',
  "process.stdout.write('LX3RESULT ' + JSON.stringify({ ms: t1 - t0, returnedAt: t1, frag: frag }) + '\\n');",
].join('\n');

const TOK_ON = 'lx3-cached-onboarding-token';
const TOK_DRIFT = 'lx3-cached-drift-token';

function mkDFx() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lx3d-'));
  const home = path.join(tmp, 'home');
  const work = path.join(tmp, 'work');
  const plugin = path.join(tmp, 'plugin');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(work, { recursive: true });
  fs.mkdirSync(path.join(plugin, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(plugin, 'scripts', 'doctor.cjs'), FAKE_DOCTOR);
  return {
    tmp, home, work, plugin,
    realWork: fs.realpathSync(work),
    marker: path.join(tmp, 'doctor-marker.txt'),
    stampDir: path.join(home, '.mindrian', 'banner-state'),
  };
}
function stampPath(fx, id) { return path.join(fx.stampDir, 'sessionstart-throttle-' + id + '.json'); }
function tokenFragment(id) {
  return id === 'onboarding'
    ? FI.makeFragment({ id: 'onboarding', priority: 6, full_payload: TOK_ON, one_line_pointer: TOK_ON })
    : FI.makeFragment({ id: 'install-drift', priority: 1, full_payload: TOK_DRIFT, one_line_pointer: TOK_DRIFT });
}
function writeStamp(fx, id, o) {
  const ms = o.ranAtMs === undefined ? Date.now() : o.ranAtMs;
  fs.mkdirSync(fx.stampDir, { recursive: true });
  fs.writeFileSync(stampPath(fx, id), JSON.stringify({
    id,
    plugin_version: o.version === undefined ? REAL_VERSION : o.version,
    cwd: o.cwd === undefined ? fx.realWork : o.cwd,
    ran_at_ms: ms,
    ran_at: new Date(ms).toISOString(),
    fragment: tokenFragment(id),
  }));
}
function readStamp(fx, id) {
  try { return JSON.parse(fs.readFileSync(stampPath(fx, id), 'utf8')); } catch (_) { return null; }
}
function dEnv(fx, extra) {
  const env = Object.assign({}, process.env);
  delete env.MINDRIAN_MCP_FIRST;
  Object.assign(env, {
    HOME: fx.home,
    CLAUDE_PLUGIN_ROOT: fx.plugin,
    LX3_DOCTOR_MARKER: fx.marker,
    LX3_FAKE_DOCTOR_MS: '1000',
    LX3_REPO: REPO,
  }, extra || {});
  return env;
}
function runThrottle(fx, id) {
  const res = spawnSync(process.execPath, ['-e', THROTTLE_CHILD], {
    cwd: fx.work, env: dEnv(fx, { LX3_ID: id }), encoding: 'utf8', timeout: 60000,
  });
  const line = (res.stdout || '').split('\n').find((l) => l.startsWith('LX3RESULT '));
  assert.ok(line, 'child printed no LX3RESULT line; stdout: ' + (res.stdout || '').slice(0, 200) +
    ' stderr: ' + (res.stderr || '').slice(0, 200));
  return JSON.parse(line.slice('LX3RESULT '.length));
}
function readDoctorMarker(fx) {
  const out = [];
  const txt = readText(fx.marker);
  if (!txt) return out;
  for (const l of txt.split('\n')) {
    const m = /^(start|end) (\d+) (.*)$/.exec(l.trim());
    if (m) out.push({ kind: m[1], ts: Number(m[2]), args: m[3] });
  }
  return out;
}
function lockFiles(fx) {
  try { return fs.readdirSync(fx.stampDir).filter((n) => n.endsWith('.lock')); } catch (_) { return []; }
}
async function cleanupD(fx) {
  await pollUntil(() => {
    if (lockFiles(fx).length > 0) return false;
    const m = readDoctorMarker(fx);
    return m.filter((e) => e.kind === 'end').length >= m.filter((e) => e.kind === 'start').length;
  }, 20000);
  rmTree(fx.tmp);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
  const k1u = require('./test-k1u-session-start-envelope.cjs');

  // ----- S: STATE.md reuse -----
  await checkAsync('S1 reuse: an unchanged room does not run compute-state (C-1, DD-1)', async () => {
    const fx = mkHelperFx();
    try {
      writeUnchangedState(fx);
      const res = runHelper(fx, 'state');
      assert.ok(!fs.existsSync(fx.markerCs), 'compute-state ran on an unchanged room');
      const expected = stripKeys(PERSISTED_STATE).replace(/\n+$/, '') + '\n';
      assert.strictEqual(res.stdout, expected, 'stdout is not the STATE.md text without the two keys');
      assert.ok(/state mode=reuse/.test(logText(fx)), 'log has no "state mode=reuse": ' + logText(fx));
    } finally { rmTree(fx.tmp); }
  });

  await checkAsync('S2 compute: a room file newer than STATE.md runs compute-state (C-1)', async () => {
    const fx = mkHelperFx();
    try {
      writeUnchangedState(fx);
      setMtime(fx.artifact, Date.now());
      const res = runHelper(fx, 'state');
      assert.strictEqual(countLines(fx.markerCs), 1, 'compute-state marker should have 1 line');
      assert.ok(res.stdout.includes('lx3-fake-compute-token'), 'stdout is not the fake compute-state output');
      assert.ok(/state mode=compute reason=newer:/.test(logText(fx)), 'log has no compute reason=newer: ' + logText(fx));
    } finally { rmTree(fx.tmp); }
  });

  const s3 = [
    ['room-registry seed shape', (fx) => writeUnchangedState(fx, SEED_STATE)],
    ['a Live (auto) line', (fx) => writeUnchangedState(fx, PERSISTED_STATE + '## Live (auto)\nlive body\n')],
    ['no STATE.md', (fx) => { backdateRoom(fx); }],
    ['a 0-byte STATE.md', (fx) => { fs.writeFileSync(fx.state, ''); backdateRoom(fx); }],
  ];
  for (const [label, prep] of s3) {
    await checkAsync('S3 guard: ' + label + ' runs compute-state (DD-2)', async () => {
      const fx = mkHelperFx();
      try {
        prep(fx);
        const res = runHelper(fx, 'state');
        assert.strictEqual(countLines(fx.markerCs), 1, 'compute-state did not run exactly once');
        assert.ok(res.stdout.includes('lx3-fake-compute-token'), 'stdout is not the fake compute-state output');
      } finally { rmTree(fx.tmp); }
    });
  }

  await checkAsync('S4 registry newer than STATE.md runs compute-state (DD-3)', async () => {
    const fx = mkHelperFx();
    try {
      writeUnchangedState(fx);
      fs.mkdirSync(path.join(fx.roomsHome, '.rooms'), { recursive: true });
      const reg = path.join(fx.roomsHome, '.rooms', 'registry.json');
      fs.writeFileSync(reg, JSON.stringify({ rooms: {} }));
      setMtime(reg, Date.now());
      runHelper(fx, 'state');
      assert.strictEqual(countLines(fx.markerCs), 1, 'compute-state did not run after a registry change');
    } finally { rmTree(fx.tmp); }
  });

  await checkAsync('S4 STATE.md older than 24 h runs compute-state (DD-3)', async () => {
    const fx = mkHelperFx();
    try {
      fs.writeFileSync(fx.state, PERSISTED_STATE);
      setTreeMtime(fx.room, Date.now() - 3 * 24 * HOUR);
      setMtime(fx.state, Date.now() - 2 * 24 * HOUR);
      runHelper(fx, 'state');
      assert.strictEqual(countLines(fx.markerCs), 1, 'compute-state did not run on a 2 day old STATE.md');
    } finally { rmTree(fx.tmp); }
  });

  await checkAsync('S5 identity: reuse equals the real compute-state output (DD-1)', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'lx3-s5-'));
    try {
      const fx = k1u.buildFixture(base, { sections: 3, filesPerSection: 2 });
      const env = Object.assign({}, process.env, { HOME: fx.home, MINDRIAN_ROOMS_HOME: fx.roomsHome });
      const cs = spawnSync('bash', [path.join(REAL_SCRIPTS, 'compute-state'), fx.roomDir], {
        cwd: fx.roomDir, env, encoding: 'utf8', timeout: 120000,
      });
      assert.strictEqual(cs.status, 0, 'real compute-state failed: ' + (cs.stderr || '').slice(0, 200));
      const sw = spawnSync('node', [path.join(REAL_SCRIPTS, 'state-write.cjs'), fx.roomDir], {
        cwd: fx.roomDir, env, input: cs.stdout + '\n', encoding: 'utf8', timeout: 60000,
      });
      assert.strictEqual(sw.status, 0, 'state-write.cjs failed: ' + (sw.stderr || '').slice(0, 200));
      const now = Date.now();
      setTreeMtime(fx.roomDir, now - HOUR);
      setTreeMtime(path.join(fx.roomsHome, '.rooms'), now - HOUR);
      setMtime(path.join(fx.roomDir, 'STATE.md'), now - 60 * 1000);
      await sleep(1100);
      const res = spawnSync('bash', [HELPER, 'state', fx.roomDir, REAL_SCRIPTS], {
        cwd: fx.roomDir, env, encoding: 'utf8', timeout: 120000,
      });
      assert.strictEqual(res.status, 0, 'helper exit status ' + res.status + ' ' + (res.stderr || '').slice(0, 200));
      // session-start captures the text with $(...), which drops trailing newlines.
      assert.strictEqual(res.stdout.replace(/\n+$/, ''), cs.stdout.replace(/\n+$/, ''),
        'reuse text differs from the compute-state output');
    } finally { rmTree(base); }
  });

  // ----- A: analyze-room cache -----
  await checkAsync('A1 miss then hit: the second call does not run analyze-room (C-2)', async () => {
    const fx = mkHelperFx();
    try {
      backdateRoom(fx);
      const first = runHelper(fx, 'analyze');
      assert.strictEqual(countLines(fx.markerAr), 1, 'first call should run analyze-room once');
      assert.strictEqual(readText(fx.cache), first.stdout, 'cache is not the output plus one newline');
      setMtime(fx.cache, Date.now() - 30 * 1000);
      const second = runHelper(fx, 'analyze');
      assert.strictEqual(countLines(fx.markerAr), 1, 'second call ran analyze-room again');
      assert.strictEqual(second.stdout, first.stdout, 'second stdout differs from the first');
      assert.ok(/analyze mode=hit/.test(logText(fx)), 'log has no "analyze mode=hit": ' + logText(fx));
    } finally { rmTree(fx.tmp); }
  });

  await checkAsync('A2 change: a newer room file runs analyze-room and refreshes the cache (C-2)', async () => {
    const fx = mkHelperFx();
    try {
      writeWarmCache(fx);
      setMtime(fx.artifact, Date.now());
      const res = runHelper(fx, 'analyze', { LX3_AR_OUT: 'GAP:lx3-new-output' });
      assert.strictEqual(countLines(fx.markerAr), 1, 'analyze-room did not run on a changed room');
      assert.strictEqual(res.stdout, 'GAP:lx3-new-output\n');
      assert.strictEqual(readText(fx.cache), 'GAP:lx3-new-output\n', 'cache was not refreshed');
    } finally { rmTree(fx.tmp); }
  });

  const a3 = [
    ['STATE.md newer than the cache', (fx) => {
      writeWarmCache(fx);
      fs.writeFileSync(fx.state, PERSISTED_STATE);
      setMtime(fx.state, Date.now() - 10 * 1000);
    }],
    ['a cache 25 h old', (fx) => {
      setTreeMtime(fx.room, Date.now() - 3 * 24 * HOUR);
      fs.writeFileSync(fx.cache, 'GAP:lx3-old-cache-token\n');
      setMtime(fx.cache, Date.now() - 25 * HOUR);
    }],
    ['the analyze-room script newer than the cache', (fx) => {
      writeWarmCache(fx);
      setMtime(path.join(fx.fake, 'analyze-room'), Date.now() - 10 * 1000);
    }],
  ];
  for (const [label, prep] of a3) {
    await checkAsync('A3 miss: ' + label + ' runs analyze-room (DD-4)', async () => {
      const fx = mkHelperFx();
      try {
        prep(fx);
        const res = runHelper(fx, 'analyze');
        assert.strictEqual(countLines(fx.markerAr), 1, 'analyze-room did not run');
        assert.strictEqual(res.stdout, 'GAP:lx3-fake-analyze-token\n');
      } finally { rmTree(fx.tmp); }
    });
  }

  await checkAsync('A4 no poison: a non-zero exit keeps the old cache byte-identical (C-2, DD-6)', async () => {
    const fx = mkHelperFx();
    try {
      writeWarmCache(fx);
      setMtime(fx.artifact, Date.now());
      const before = fs.readFileSync(fx.cache);
      const beforeMtime = fs.statSync(fx.cache).mtimeMs;
      const res = runHelper(fx, 'analyze', { LX3_AR_OUT: 'lx3-partial', LX3_AR_RC: '1' });
      assert.strictEqual(res.stdout, 'lx3-partial\n', 'stdout is not the partial output');
      assert.ok(before.equals(fs.readFileSync(fx.cache)), 'cache changed after a failed run');
      assert.strictEqual(fs.statSync(fx.cache).mtimeMs, beforeMtime, 'cache mtime changed after a failed run');
      assert.ok(/rc=1 cached=no/.test(logText(fx)), 'log has no "rc=1 cached=no": ' + logText(fx));
    } finally { rmTree(fx.tmp); }
  });

  await checkAsync('A4 no poison: an empty output keeps the old cache (C-2, DD-6)', async () => {
    const fx = mkHelperFx();
    try {
      writeWarmCache(fx);
      setMtime(fx.artifact, Date.now());
      const before = fs.readFileSync(fx.cache);
      const res = runHelper(fx, 'analyze', { LX3_AR_OUT: 'EMPTY', LX3_AR_RC: '0' });
      assert.strictEqual(res.stdout, '\n', 'stdout is not a single newline');
      assert.ok(before.equals(fs.readFileSync(fx.cache)), 'cache changed after an empty run');
    } finally { rmTree(fx.tmp); }
  });

  await checkAsync('A5 no .mindrian directory: runs analyze-room, writes no cache (DD-5)', async () => {
    const fx = mkHelperFx({ mindrian: false });
    try {
      backdateRoom(fx);
      const res = runHelper(fx, 'analyze');
      assert.strictEqual(countLines(fx.markerAr), 1, 'analyze-room did not run');
      assert.strictEqual(res.stdout, 'GAP:lx3-fake-analyze-token\n');
      assert.ok(!fs.existsSync(path.join(fx.room, '.mindrian')), '.mindrian was created');
    } finally { rmTree(fx.tmp); }
  });

  await checkAsync('A6 analyze-room exits 0 when opportunity-bank/BRIEF.md has no status: line (scope extension)', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'lx3-a6-'));
    try {
      const fx = k1u.buildFixture(base, { sections: 3, filesPerSection: 2 });
      const bank = path.join(fx.roomDir, 'opportunity-bank');
      fs.mkdirSync(bank, { recursive: true });
      fs.writeFileSync(path.join(bank, 'BRIEF.md'), '# Brief\n\nNo frontmatter in this file.\n');
      const env = Object.assign({}, process.env, { HOME: fx.home, MINDRIAN_ROOMS_HOME: fx.roomsHome });
      const res = spawnSync('bash', [path.join(REAL_SCRIPTS, 'analyze-room'), fx.roomDir], {
        cwd: fx.roomDir, env, encoding: 'utf8', timeout: 120000,
      });
      assert.strictEqual(res.status, 0, 'analyze-room exit ' + res.status + ' after: ' +
        (res.stdout || '').split('\n').slice(-3).join(' | '));
      assert.ok(/^(GAP|CONVERGE):/m.test(res.stdout), 'no GAP or CONVERGE line in the output');
      assert.ok(res.stdout.includes('## Opportunity Bank'), 'no Opportunity Bank block in the output');
    } finally { rmTree(base); }
  });

  // ----- P1, W1: shape and wiring -----
  await checkAsync('P1 shape: the find command equals the scripts/on-stop-state find (C-1)', async () => {
    const norm = (file) => {
      const line = fs.readFileSync(file, 'utf8').split('\n').find((l) => l.includes('find -H'));
      assert.ok(line, 'no find -H line in ' + file);
      const m = /find -H .*?\|\| true/.exec(line);
      assert.ok(m, 'no find command that ends with "|| true" in ' + file);
      return m[0].replace(/-newer "[^"]*"/g, '-newer REF');
    };
    assert.strictEqual(norm(HELPER), norm(path.join(REAL_SCRIPTS, 'on-stop-state')));
  });

  await checkAsync('W1 wiring: session-start calls the helper and no longer calls the scripts', async () => {
    const lines = fs.readFileSync(path.join(REAL_SCRIPTS, 'session-start'), 'utf8').split('\n');
    const count = (needle) => lines.filter((l) => l.includes(needle)).length;
    assert.strictEqual(count('session-start-state" state'), 1, 'state call count');
    assert.strictEqual(count('session-start-state" analyze'), 2, 'analyze call count');
    assert.strictEqual(count('"${SCRIPT_DIR}/analyze-room"'), 0, 'direct analyze-room call remains');
    assert.strictEqual(count('"${SCRIPT_DIR}/compute-state" "$ROOM_DIR"'), 0, 'direct compute-state call remains');
  });

  // ----- W2: end to end with the real session-start -----
  await checkAsync('W2 end to end: the real session-start reuses STATE.md and the cache, then recomputes (C-1, C-2)', async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'lx3-w2-'));
    try {
      const fx = k1u.buildFixture(base, { sections: 3, filesPerSection: 2 });
      const env = Object.assign({}, process.env, { HOME: fx.home, MINDRIAN_ROOMS_HOME: fx.roomsHome });
      const cs = spawnSync('bash', [path.join(REAL_SCRIPTS, 'compute-state'), fx.roomDir], {
        cwd: fx.roomDir, env, encoding: 'utf8', timeout: 120000,
      });
      assert.strictEqual(cs.status, 0, 'real compute-state failed');
      const sw = spawnSync('node', [path.join(REAL_SCRIPTS, 'state-write.cjs'), fx.roomDir], {
        cwd: fx.roomDir, env, input: cs.stdout + '\n', encoding: 'utf8', timeout: 60000,
      });
      assert.strictEqual(sw.status, 0, 'state-write.cjs failed');
      const stateFile = path.join(fx.roomDir, 'STATE.md');
      fs.appendFileSync(stateFile, '\nlx3-e2e-state-token\n');
      const cacheFile = path.join(fx.roomDir, '.mindrian', 'analyze-room.cache');
      fs.writeFileSync(cacheFile, 'GAP:lx3-e2e-cache-token:x\n');
      const now = Date.now();
      setTreeMtime(fx.roomDir, now - HOUR);
      setTreeMtime(path.join(fx.roomsHome, '.rooms'), now - HOUR);
      setMtime(stateFile, now - 60 * 1000);
      setMtime(cacheFile, now);
      const run = (tier, key) => k1u.runSessionStart(fx, { key, extraEnv: { MINDRIAN_CONTEXT_TIER: tier } });
      for (const tier of ['rich', 'balanced']) {
        const r = run(tier, tier);
        assert.ok(r.fullText, tier + ': no full context file; stderr: ' + (r.stderr || '').slice(0, 200));
        assert.ok(r.fullText.includes('lx3-e2e-state-token'), tier + ': state token missing');
        assert.ok(r.fullText.includes('lx3-e2e-cache-token'), tier + ': cache token missing');
      }
      const min = run('minimal', 'minimal');
      assert.ok(min.fullText, 'minimal: no full context file');
      assert.ok(min.fullText.includes('lx3-e2e-state-token'), 'minimal: state token missing');
      assert.ok(!min.fullText.includes('lx3-e2e-cache-token'), 'minimal: cache token present');
      setMtime(path.join(fx.roomDir, fx.sections[0], fx.sections[0] + '-entry-0.md'), Date.now());
      const changed = run('rich', 'changed');
      assert.ok(changed.fullText, 'changed: no full context file');
      assert.ok(!changed.fullText.includes('lx3-e2e-state-token'), 'changed: stale state token still present');
      assert.ok(!changed.fullText.includes('lx3-e2e-cache-token'), 'changed: stale cache token still present');
    } finally { rmTree(base); }
  });

  // ----- D: doctor throttle -----
  await checkAsync('D1 fresh stamp: returns the cached fragment and spawns no doctor (C-3)', async () => {
    const fx = mkDFx();
    try {
      writeStamp(fx, 'onboarding', {});
      const r = runThrottle(fx, 'onboarding');
      assert.strictEqual(r.frag.full_payload, TOK_ON, 'not the cached fragment');
      assert.ok(r.ms < 300, 'call took ' + r.ms + ' ms');
      await sleep(1500);
      assert.ok(!fs.existsSync(fx.marker), 'a doctor process ran on a fresh stamp');
    } finally { await cleanupD(fx); }
  });

  await checkAsync('D2 stale age: returns the cached fragment fast, refreshes detached (C-3, DD-12)', async () => {
    const fx = mkDFx();
    try {
      const planted = Date.now() - 25 * HOUR;
      writeStamp(fx, 'onboarding', { ranAtMs: planted });
      const r = runThrottle(fx, 'onboarding');
      assert.strictEqual(r.frag.full_payload, TOK_ON, 'not the cached fragment');
      assert.ok(r.ms < 300, 'call took ' + r.ms + ' ms');
      const ok = await pollUntil(() => {
        const s = readStamp(fx, 'onboarding');
        return s && s.ran_at_ms > planted && lockFiles(fx).length === 0;
      }, 15000);
      assert.ok(ok, 'the refresh did not update the stamp and remove the lock');
      const m = readDoctorMarker(fx);
      const end = m.find((e) => e.kind === 'end' && e.args.includes('--statusline-visibility'));
      assert.ok(end, 'no end line for --statusline-visibility');
      assert.ok(end.ts > r.returnedAt, 'the doctor ended before the call returned: the call waited');
      const s = readStamp(fx, 'onboarding');
      assert.ok(s.fragment && String(s.fragment.full_payload).includes('First-session check'),
        'stamp fragment has no "First-session check"');
    } finally { await cleanupD(fx); }
  });

  await checkAsync('D3 stale version: returns an empty fragment fast, refreshes the stamp (C-3)', async () => {
    const fx = mkDFx();
    try {
      writeStamp(fx, 'onboarding', { version: '0.0.0-lx3-old' });
      const r = runThrottle(fx, 'onboarding');
      assert.strictEqual(r.frag.has_payload, false, 'a cached fragment of another version was used');
      assert.ok(r.ms < 300, 'call took ' + r.ms + ' ms');
      const ok = await pollUntil(() => {
        const s = readStamp(fx, 'onboarding');
        return s && s.plugin_version === REAL_VERSION;
      }, 15000);
      assert.ok(ok, 'the stamp never got the real plugin version');
    } finally { await cleanupD(fx); }
  });

  await checkAsync('D4 first install: no stamp runs the doctor once, synchronously (C-3)', async () => {
    const fx = mkDFx();
    try {
      const r = runThrottle(fx, 'onboarding');
      assert.strictEqual(r.frag.has_payload, true, 'no payload on the first run');
      assert.ok(String(r.frag.full_payload).includes('First-session check'), 'no "First-session check" in the payload');
      const m = readDoctorMarker(fx);
      for (const flag of ['--statusline-visibility', '--all']) {
        const s = m.find((e) => e.kind === 'start' && e.args.includes(flag));
        const e = m.find((x) => x.kind === 'end' && x.args.includes(flag));
        assert.ok(s && e, 'missing start or end line for ' + flag);
        assert.ok(s.ts <= r.returnedAt && e.ts <= r.returnedAt, flag + ' ended after the call returned');
      }
      const st = readStamp(fx, 'onboarding');
      assert.ok(st && st.plugin_version === REAL_VERSION, 'no stamp with the real version');
    } finally { await cleanupD(fx); }
  });

  await checkAsync('D5 live lock: no second refresh starts (DD-12)', async () => {
    const fx = mkDFx();
    try {
      writeStamp(fx, 'onboarding', { ranAtMs: Date.now() - 25 * HOUR });
      const lock = stampPath(fx, 'onboarding') + '.lock';
      fs.writeFileSync(lock, '99999 lx3-test-lock\n');
      const r = runThrottle(fx, 'onboarding');
      assert.strictEqual(r.frag.full_payload, TOK_ON, 'not the cached fragment');
      await sleep(2500);
      assert.ok(!fs.existsSync(fx.marker), 'a doctor ran under a live lock');
      assert.strictEqual(readText(lock), '99999 lx3-test-lock\n', 'lock content changed');
      fs.rmSync(lock, { force: true });
    } finally { await cleanupD(fx); }
  });

  await checkAsync('D6 gate off: no stamp, no doctor when the onboarding file holds the version (DD-11)', async () => {
    const fx = mkDFx();
    try {
      const dir = path.join(fx.home, '.mindrian', 'onboarding');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'statusline-onboarded.json'), JSON.stringify({ installed_version: REAL_VERSION }));
      const r = runThrottle(fx, 'onboarding');
      assert.strictEqual(r.frag.has_payload, false, 'a payload with the gate off');
      await sleep(1500);
      assert.ok(!fs.existsSync(fx.marker), 'a doctor ran with the gate off');
      assert.ok(!fs.existsSync(stampPath(fx, 'onboarding')), 'a stamp was written with the gate off');
    } finally { await cleanupD(fx); }
  });

  await checkAsync('D7 cwd key: install-drift uses the cached fragment only for the same cwd (DD-10)', async () => {
    const fx = mkDFx();
    try {
      writeStamp(fx, 'install-drift', {});
      const same = runThrottle(fx, 'install-drift');
      assert.strictEqual(same.frag.full_payload, TOK_DRIFT, 'same cwd did not return the cached fragment');
      assert.ok(same.ms < 300, 'same cwd call took ' + same.ms + ' ms');
      writeStamp(fx, 'install-drift', { cwd: '/nonexistent-lx3' });
      const other = runThrottle(fx, 'install-drift');
      assert.strictEqual(other.frag.has_payload, false, 'another cwd used the cached fragment');
      assert.ok(other.ms < 300, 'other cwd call took ' + other.ms + ' ms');
    } finally { await cleanupD(fx); }
  });

  await checkAsync('D8 coordinator end to end: fresh stamps give both fragments and no doctor (C-3)', async () => {
    const fx = mkDFx();
    try {
      writeStamp(fx, 'onboarding', {});
      writeStamp(fx, 'install-drift', {});
      const res = spawnSync(process.execPath, [path.join(REAL_SCRIPTS, 'sessionstart-coordinator.cjs')], {
        cwd: fx.work, env: dEnv(fx), encoding: 'utf8', timeout: 60000,
      });
      assert.strictEqual(res.status, 0, 'coordinator exit status ' + res.status);
      const obj = JSON.parse((res.stdout || '').trim().split('\n').pop());
      const ctx = obj.hookSpecificOutput && obj.hookSpecificOutput.additionalContext;
      assert.ok(typeof ctx === 'string', 'no additionalContext');
      assert.ok(ctx.includes(TOK_ON), 'onboarding token missing');
      assert.ok(ctx.includes(TOK_DRIFT), 'install-drift token missing');
      await sleep(1500);
      assert.ok(!fs.existsSync(fx.marker), 'a doctor ran with fresh stamps');
    } finally { await cleanupD(fx); }
  });

  if (failed > 0) {
    process.stderr.write('sessionstart-skip: ' + failed + ' FAILED\n');
    process.exit(1);
  }
  process.stdout.write('sessionstart-skip: ALL PASS\n');
}

main().catch((err) => {
  process.stderr.write('sessionstart-skip: crashed: ' + (err && err.stack ? err.stack : err) + '\n');
  process.exit(1);
});
