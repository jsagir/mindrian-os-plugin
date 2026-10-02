'use strict';
// RCA test-birth-registry-leak -- structural guard regression test.
//
// The bug class: a test (or any caller) births/registers a room whose directory
// lives under the OS temp dir into a registry that is NOT itself under the OS temp
// dir (the navigator's real ~/MindrianRooms/.rooms/registry.json). That silently
// flips the machine-wide `active` pointer onto a throwaway fixture, and on Claude
// Desktop (no session id) claim_write then lands in the fixture.
//
// The guard lives in the single registry writer, scripts/room-registry `create`
// (every registration passes through it: birthRoom, /mos:rooms new, direct calls).
// It refuses (exit 3, stderr token REGISTRY_GUARD_REFUSED) BEFORE any write when
//   realpath(room dir) is under a temp root AND realpath(registry file) is not.
// Temp-to-temp, non-temp-to-non-temp, and non-temp-room-into-temp-registry are all
// allowed (a hermetic test that points MINDRIAN_ROOMS_HOME at a mkdtemp dir keeps
// working). MINDRIAN_ALLOW_TMP_ROOM=1 is the loud, audited opt-out.
//
// Also asserts birthRoom fails CLOSED (ok:false, reason registry_guard_refused)
// instead of reporting a false success when the guard refuses.
//
// Run: node tests/test-registry-tmp-leak-guard.cjs
// SKIP-77: no python3 on PATH, or no writable non-temp base dir.
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const REGISTRY_SCRIPT = path.join(REPO_ROOT, 'scripts', 'room-registry');

let pass = 0;
let fail = 0;
function ok(name) { pass += 1; console.log('  PASS ' + name); }
function bad(name, e) { fail += 1; console.log('  FAIL ' + name + ' -- ' + (e && e.message ? e.message : e)); }
function test(name, fn) { try { fn(); ok(name); } catch (e) { bad(name, e); } }

function real(p) {
  try { return fs.realpathSync.native(p); } catch (_e) { return path.resolve(p); }
}
function norm(p) { return process.platform === 'win32' ? p.toLowerCase() : p; }
function tempRoots() {
  const raw = [os.tmpdir(), process.env.TMPDIR, process.env.TEMP, process.env.TMP];
  if (process.platform !== 'win32') raw.push('/tmp', '/var/tmp');
  return Array.from(new Set(raw.filter(Boolean).map((p) => norm(real(p)))));
}
function underTemp(p) {
  const rp = norm(real(p));
  return tempRoots().some((r) => rp === r || rp.startsWith(r + path.sep));
}

// Probe prerequisites.
const probe = spawnSync('python3', ['--version'], { encoding: 'utf8' });
if (probe.error || probe.status !== 0) {
  process.stdout.write('SKIP-77: python3 unavailable -- skipping registry tmp-leak guard test\n');
  process.exit(77);
}

// A base dir that is genuinely NOT under any temp root (the "real registry" stand-in).
// tests/artifacts/ is gitignored runtime output, so a crash-leftover never shows in git.
const ARTIFACTS = path.join(REPO_ROOT, 'tests', 'artifacts');
try { fs.mkdirSync(ARTIFACTS, { recursive: true }); } catch (_e) {}
const nonTmpBases = [ARTIFACTS, os.homedir()].filter((b) => b && fs.existsSync(b) && !underTemp(b));
if (nonTmpBases.length === 0) {
  process.stdout.write('SKIP-77: no writable non-temp base dir (repo artifacts dir and home are both under a temp root)\n');
  process.exit(77);
}
const NON_TMP_BASE = nonTmpBases[0];

const cleanup = [];
function nonTmpDir(prefix) {
  const d = fs.mkdtempSync(path.join(NON_TMP_BASE, prefix));
  cleanup.push(d);
  return d;
}
function tmpDir(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  cleanup.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of cleanup) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) {} }
});

const CANARY = JSON.stringify({ version: 1, active: 'canary', rooms: { canary: { path: 'canary', status: 'active' } } }, null, 2);

// Seed a registry under <home>/.rooms/registry.json and return its path.
function seedRegistry(home) {
  const dir = path.join(home, '.rooms');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.bootstrap-127.3-done'), '');
  const reg = path.join(dir, 'registry.json');
  fs.writeFileSync(reg, CANARY);
  return reg;
}

// Run `room-registry <home> create <slug> <roomPath>` with a clean ownership env.
function create(home, slug, roomPath, extraEnv) {
  const env = Object.assign({}, process.env);
  delete env.MINDRIAN_ROOMS_HOME;
  delete env.CLAUDE_CODE_SESSION_ID;
  delete env.MINDRIAN_ACTIVE_SESSION_ID;
  delete env.CLAUDE_PID;
  delete env.MINDRIAN_ALLOW_TMP_ROOM;
  Object.assign(env, extraEnv || {});
  return spawnSync('bash', [REGISTRY_SCRIPT, home, 'create', slug, roomPath, 'V', 'S'], { encoding: 'utf8', env: env });
}

console.log('RCA test-birth-registry-leak: registry tmp-leak guard (NON_TMP_BASE=' + NON_TMP_BASE + ')');

// ---- G1: REFUSE tmp room into non-tmp registry; nothing is written ----
test('G1 refuses a temp-dir room registered into a non-temp registry (exit 3, REGISTRY_GUARD_REFUSED, zero writes)', () => {
  const home = nonTmpDir('.guard-real-');
  const reg = seedRegistry(home);
  const before = fs.readFileSync(reg, 'utf8');
  const mtimeBefore = fs.statSync(reg).mtimeMs;
  const roomDir = path.join(tmpDir('guard-room-'), 'leaky-room');
  const r = create(home, 'leaky-room', roomDir);
  assert.strictEqual(r.status, 3, 'expected exit 3, got ' + r.status + ' stderr=' + r.stderr);
  assert.ok(/REGISTRY_GUARD_REFUSED/.test(r.stderr), 'stderr must carry the REGISTRY_GUARD_REFUSED token: ' + r.stderr);
  assert.strictEqual(fs.readFileSync(reg, 'utf8'), before, 'registry bytes must be unchanged');
  assert.strictEqual(fs.statSync(reg).mtimeMs, mtimeBefore, 'registry mtime must be unchanged');
  assert.ok(!fs.existsSync(path.join(home, path.relative(path.parse(roomDir).root, roomDir))), 'no ROOMS_HOME/<abs path> nesting may be created');
  assert.ok(!fs.existsSync(path.join(home, '.rooms', 'sessions')), 'no session-binding dir may be created');
});

// ---- G1b: refusal must not even create a missing registry/ROOMS_HOME ----
test('G1b a refused create does not create a missing registry or ROOMS_HOME', () => {
  const base = nonTmpDir('.guard-absent-');
  const home = path.join(base, 'MindrianRooms');
  fs.mkdirSync(home);
  const roomDir = path.join(tmpDir('guard-room-'), 'leaky-room');
  const r = create(home, 'leaky-room', roomDir);
  assert.strictEqual(r.status, 3, 'expected exit 3, got ' + r.status + ' stderr=' + r.stderr);
  assert.ok(!fs.existsSync(path.join(home, '.rooms')), 'refused create must not mkdir the registry dir');
});

// ---- G2: ALLOW temp room into temp registry (a hermetic test sandbox) ----
test('G2 allows a temp-dir room registered into a temp registry (hermetic sandbox keeps working)', () => {
  const home = tmpDir('guard-sandbox-');
  const reg = seedRegistry(home);
  const roomDir = path.join(tmpDir('guard-room-'), 'sandboxed-room');
  const r = create(home, 'sandboxed-room', roomDir);
  assert.strictEqual(r.status, 0, 'expected exit 0, got ' + r.status + ' stderr=' + r.stderr);
  const parsed = JSON.parse(fs.readFileSync(reg, 'utf8'));
  assert.ok(parsed.rooms['sandboxed-room'], 'room must be registered');
  assert.strictEqual(parsed.active, 'sandboxed-room');
});

// ---- G3: ALLOW non-temp room into non-temp registry (real-world shape) ----
test('G3 allows a non-temp room registered into a non-temp registry', () => {
  const home = nonTmpDir('.guard-real-ok-');
  const reg = seedRegistry(home);
  const roomDir = path.join(home, 'real-room');
  fs.mkdirSync(roomDir);
  const r = create(home, 'real-room', roomDir);
  assert.strictEqual(r.status, 0, 'expected exit 0, got ' + r.status + ' stderr=' + r.stderr);
  assert.ok(JSON.parse(fs.readFileSync(reg, 'utf8')).rooms['real-room'], 'room must be registered');
});

// ---- G3b: ALLOW relative path (rooms-new shape: resolved under ROOMS_HOME) ----
test('G3b allows a relative room path (resolved under ROOMS_HOME, same side as the registry)', () => {
  const home = nonTmpDir('.guard-rel-');
  const reg = seedRegistry(home);
  const r = create(home, 'rel-room', 'rel-room');
  assert.strictEqual(r.status, 0, 'expected exit 0, got ' + r.status + ' stderr=' + r.stderr);
  assert.ok(JSON.parse(fs.readFileSync(reg, 'utf8')).rooms['rel-room'], 'room must be registered');
});

// ---- G4: audited opt-out is loud ----
test('G4 MINDRIAN_ALLOW_TMP_ROOM=1 is an audited opt-out (registers, and says so on stderr)', () => {
  const home = nonTmpDir('.guard-optout-');
  const reg = seedRegistry(home);
  const roomDir = path.join(tmpDir('guard-room-'), 'deliberate-room');
  const r = create(home, 'deliberate-room', roomDir, { MINDRIAN_ALLOW_TMP_ROOM: '1' });
  assert.strictEqual(r.status, 0, 'expected exit 0, got ' + r.status + ' stderr=' + r.stderr);
  assert.ok(/REGISTRY_GUARD_BYPASSED/.test(r.stderr), 'bypass must be loud on stderr: ' + r.stderr);
  assert.ok(JSON.parse(fs.readFileSync(reg, 'utf8')).rooms['deliberate-room'], 'room must be registered');
});

// ---- G4b: opt-out only honors the exact value 1 ----
test('G4b MINDRIAN_ALLOW_TMP_ROOM=true does NOT bypass (only the exact value 1)', () => {
  const home = nonTmpDir('.guard-optout2-');
  seedRegistry(home);
  const roomDir = path.join(tmpDir('guard-room-'), 'nope-room');
  const r = create(home, 'nope-room', roomDir, { MINDRIAN_ALLOW_TMP_ROOM: 'true' });
  assert.strictEqual(r.status, 3, 'expected exit 3, got ' + r.status);
});

// ---- G4c: `update <name> path <tmp>` cannot bypass the guard ----
test('G4c update <name> path <temp dir> into a non-temp registry is refused; other fields are untouched by the guard', () => {
  const home = nonTmpDir('.guard-update-');
  const reg = seedRegistry(home);
  const okRoom = path.join(home, 'ok-room');
  fs.mkdirSync(okRoom);
  assert.strictEqual(create(home, 'ok-room', okRoom).status, 0, 'seed create must pass');
  const before = fs.readFileSync(reg, 'utf8');
  const env = Object.assign({}, process.env);
  delete env.MINDRIAN_ROOMS_HOME; delete env.MINDRIAN_ALLOW_TMP_ROOM;
  const tmpTarget = path.join(tmpDir('guard-upd-room-'), 'moved');
  const bad = spawnSync('bash', [REGISTRY_SCRIPT, home, 'update', 'ok-room', 'path', tmpTarget], { encoding: 'utf8', env: env });
  assert.strictEqual(bad.status, 3, 'update path -> temp dir must be refused, got ' + bad.status + ' ' + bad.stderr);
  assert.strictEqual(fs.readFileSync(reg, 'utf8'), before, 'registry unchanged after refused update');
  const good = spawnSync('bash', [REGISTRY_SCRIPT, home, 'update', 'ok-room', 'venture_stage', 'Seed'], { encoding: 'utf8', env: env });
  assert.strictEqual(good.status, 0, 'non-path update must pass, got ' + good.status + ' ' + good.stderr);
});

// ---- G5/G6: realpath semantics (POSIX symlinks; macOS /var -> /private/var class) ----
if (process.platform !== 'win32') {
  test('G5 judges the REAL location: a /tmp symlink that points at a non-temp dir is NOT a temp room', () => {
    const home = nonTmpDir('.guard-real-sym-');
    seedRegistry(home);
    const realRoom = path.join(home, 'actually-here');
    fs.mkdirSync(realRoom);
    const linkParent = tmpDir('guard-link-');
    const link = path.join(linkParent, 'lnk');
    fs.symlinkSync(realRoom, link);
    const r = create(home, 'sym-room', link);
    assert.strictEqual(r.status, 0, 'expected exit 0 (real dir is non-temp), got ' + r.status + ' stderr=' + r.stderr);
  });

  test('G6 judges the REAL location: a non-temp symlink that points into /tmp IS a temp registry', () => {
    const base = nonTmpDir('.guard-symreg-');
    const tmpHome = tmpDir('guard-tmphome-');
    const linkHome = path.join(base, 'MindrianRooms');
    fs.symlinkSync(tmpHome, linkHome);
    const reg = seedRegistry(tmpHome);
    const roomDir = path.join(tmpDir('guard-room-'), 'in-tmp-room');
    const r = create(linkHome, 'in-tmp-room', roomDir);
    assert.strictEqual(r.status, 0, 'expected exit 0 (registry really lives in temp), got ' + r.status + ' stderr=' + r.stderr);
    assert.ok(JSON.parse(fs.readFileSync(reg, 'utf8')).rooms['in-tmp-room'], 'room must be registered');
  });
}

// ---- G7: birthRoom fails CLOSED (the original bug path) ----
test('G7 birthRoom with a temp roomDir and a non-temp registry returns ok:false registry_guard_refused and writes nothing', () => {
  try { require('node:sqlite'); } catch (_e) { return; }
  const { birthRoom } = require('../lib/core/navigation/room-birth.cjs');
  const home = nonTmpDir('.guard-birth-');
  const reg = seedRegistry(home);
  const before = fs.readFileSync(reg, 'utf8');
  const roomDir = path.join(tmpDir('guard-birth-room-'), 'birthed');
  const saved = {
    MINDRIAN_ROOMS_HOME: process.env.MINDRIAN_ROOMS_HOME,
    CLAUDE_CODE_SESSION_ID: process.env.CLAUDE_CODE_SESSION_ID,
    MINDRIAN_ALLOW_TMP_ROOM: process.env.MINDRIAN_ALLOW_TMP_ROOM,
  };
  process.env.MINDRIAN_ROOMS_HOME = home;
  delete process.env.CLAUDE_CODE_SESSION_ID;
  delete process.env.MINDRIAN_ALLOW_TMP_ROOM;
  try {
    const res = birthRoom({ slug: 'birthed', roomDir, sessionId: 'sess-guard', ventureText: 'guard', approvedBy: 'tester' });
    assert.strictEqual(res.ok, false, 'must fail closed, got ' + JSON.stringify(res));
    assert.strictEqual(res.reason, 'registry_guard_refused', 'reason: ' + JSON.stringify(res));
    assert.strictEqual(fs.readFileSync(reg, 'utf8'), before, 'registry bytes must be unchanged');
    assert.ok(!fs.existsSync(path.join(home, '.rooms', 'sessions')), 'no session-binding may be written');
    assert.deepStrictEqual(fs.readdirSync(home).sort(), ['.rooms'], 'nothing but .rooms may exist under the non-temp home');
    assert.deepStrictEqual(fs.readdirSync(path.join(home, '.rooms')).sort(), ['.bootstrap-127.3-done', 'registry.json'], 'registry dir must hold only the seeded files');
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  }
});

// ---- R1: the tests that birth rooms in a temp dir are hermetic (the original bug, end to end) ----
// Each listed test is run as a child with HOME/USERPROFILE pointed at a NON-temp canary
// home (stand-in for the navigator's real home) and MINDRIAN_ROOMS_HOME unset - exactly
// the environment in which tests/test-section-nodes-birth-and-migration.cjs leaked into
// the real ~/MindrianRooms/.rooms/registry.json (active=idem-room) on 2026-10-02. The
// canary home must come out byte-identical: no registry change, no ROOMS_HOME/tmp/<abs>
// nesting, no .rooms/sessions, no .rooms/.room-graph.
const LEAK_PRONE_TESTS = [
  'tests/test-section-nodes-birth-and-migration.cjs',
  'tests/test-room-birth.cjs',
  'tests/test-195-birth-gate.cjs',
  'tests/test-195-born-wired-birth.cjs',
  'tests/test-195-inherit-seed.cjs',
  'tests/test-sentinel-self-heal.cjs',
];
function snapshotTree(dir) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { out.push('D ' + path.relative(dir, p)); walk(p); }
      else out.push('F ' + path.relative(dir, p) + ' ' + fs.readFileSync(p).toString('base64'));
    }
  })(dir);
  return out.sort().join('\n');
}
for (const rel of LEAK_PRONE_TESTS) {
  test('R1 ' + rel + ' leaves a non-temp canary HOME byte-identical (hermetic)', () => {
    const fakeHome = nonTmpDir('.guard-r1-');
    seedRegistry(path.join(fakeHome, 'MindrianRooms'));
    fs.mkdirSync(path.join(fakeHome, 'MindrianRooms', 'canary'));
    const before = snapshotTree(fakeHome);
    const env = Object.assign({}, process.env, { HOME: fakeHome, USERPROFILE: fakeHome });
    for (const k of ['MINDRIAN_ROOMS_HOME', 'CLAUDE_CODE_SESSION_ID', 'MINDRIAN_ACTIVE_SESSION_ID', 'CLAUDE_PID', 'MINDRIAN_ALLOW_TMP_ROOM', 'MINDRIAN_BRAIN_KEY']) delete env[k];
    const r = spawnSync(process.execPath, [path.join(REPO_ROOT, rel)], { encoding: 'utf8', env: env, cwd: REPO_ROOT, timeout: 120000 });
    const after = snapshotTree(fakeHome);
    // SKIP-77 children (no node:sqlite) count as hermetic: they did nothing.
    assert.ok(r.status === 0 || r.status === 77, rel + ' exited ' + r.status + '\n' + String(r.stdout).slice(-600) + String(r.stderr).slice(-600));
    const changed = before === after ? '' : 'canary home changed';
    // .mindrian/ at the HOME root is the global user dir (scratchpad/bridge/telemetry), a different
    // concern from the room registry; compare only the MindrianRooms subtree for the leak.
    const roomsBefore = snapshotTree(path.join(fakeHome, 'MindrianRooms'));
    fs.rmSync(path.join(fakeHome, '.mindrian'), { recursive: true, force: true });
    const roomsAfter = snapshotTree(path.join(fakeHome, 'MindrianRooms'));
    assert.strictEqual(roomsAfter, roomsBefore, rel + ' mutated the canary MindrianRooms tree (registry/tmp nesting/sessions/room-graph); ' + changed);
  });
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
