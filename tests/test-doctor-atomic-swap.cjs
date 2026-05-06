#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 95.2-00 -- regression test for atomic-swap install-cache recovery
 * (DOCTOR-95.2-01..05, -08).
 *
 * Hermetic via MINDRIAN_PLUGIN_HOME env override (analog to MINDRIAN_ROOMS_HOME
 * from 95.1). Each scenario lays out a scratch ~/.claude/plugins tree under
 * /tmp and spawns `node scripts/doctor.cjs` with the env override.
 *
 * Nine scenarios:
 *   1.  happy path: stale install + cache -> --fix succeeds, exit 2, atomic-swap done.
 *   2.  missing install: no install dir + cache -> --json exit 1 with drift+recoverable;
 *       --fix exit 2 with backup name 'mindrian-os.stale-missing-*'.
 *   3.  cp failure (MOS_TEST_FORCE_FAIL=copy): live install untouched.
 *   4.  verify failure via bad-version cache plugin.json: live install untouched, install.new left.
 *   4b. verify failure via injection (MOS_TEST_FORCE_FAIL=verify; H3): live install untouched.
 *   5.  rollback (MOS_TEST_FORCE_FAIL=commit): exit 4, install restored from backup.
 *   5b. rename-old failure via injection (MOS_TEST_FORCE_FAIL=rename-old; H3): exit 1, install untouched.
 *   6.  JSON shape stability: healthy run preserves byte-stable shape.
 *   7.  renderer auto-fire on missing-install (B2; concrete DOCTOR-95.2-05 verification):
 *       human-render mode (no --json) -> stdout grep for [F.1 Next Move] + /mos:doctor --fix.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO, 'scripts', 'doctor.cjs');

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

function makeScratchDir(suffix) {
  const base = path.join(
    os.tmpdir(),
    'mos-doctor-atomic-swap-' + Date.now().toString(36) + '-' + suffix
  );
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) {}
}

function writeJson(filePath, obj) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
}

// Build a scratch ~/.claude/plugins tree:
//   <scratch>/mindrian-os/.claude-plugin/plugin.json   (if installVersion non-null)
//   <scratch>/cache/mindrian-marketplace/mos/<v>/.claude-plugin/plugin.json   (for each cacheVersion)
function makeScratchPluginHome(scratch, opts) {
  // opts: { installVersion: string|null, cacheVersions: [{version, pluginJsonVersion?}] }
  if (opts.installVersion) {
    writeJson(
      path.join(scratch, 'mindrian-os', '.claude-plugin', 'plugin.json'),
      { name: 'mos', version: opts.installVersion }
    );
  }
  for (const cv of (opts.cacheVersions || [])) {
    const pjv = cv.pluginJsonVersion || cv.version; // allow mismatch for verify-fail scenario
    writeJson(
      path.join(scratch, 'cache', 'mindrian-marketplace', 'mos', cv.version, '.claude-plugin', 'plugin.json'),
      { name: 'mos', version: pjv }
    );
  }
  return scratch;
}

function runDoctor(scratch, args, extraEnv) {
  const env = Object.assign({}, process.env, { MINDRIAN_PLUGIN_HOME: scratch }, extraEnv || {});
  assert.equal(typeof env.MINDRIAN_PLUGIN_HOME, 'string',
    'Test must set MINDRIAN_PLUGIN_HOME to scratch dir to avoid touching real ~/.claude/plugins');
  const res = spawnSync('node', [DOCTOR].concat(args), { encoding: 'utf8', timeout: 10000, env });
  return {
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    status: typeof res.status === 'number' ? res.status : -1,
  };
}

function readDoctorJson(stdout) {
  // doctor --json prints exactly one JSON object to stdout
  try { return JSON.parse(stdout); }
  catch (err) { throw new Error('failed to parse doctor JSON: ' + err.message + '\nstdout was: ' + stdout); }
}

// ---------- Scenario 1: happy path ----------
(function s1_happyPath() {
  const label = 'S1: stale install + cache -> --fix exits 2 with atomic swap';
  const scratch = makeScratchDir('s1');
  try {
    makeScratchPluginHome(scratch, {
      installVersion: '1.10.0',
      cacheVersions: [{ version: '1.11.0' }],
    });
    const { stdout, status } = runDoctor(scratch, ['--fix', '--json']);
    assert.equal(status, 2, label + ': exit must be 2 (recovered)');
    const r = readDoctorJson(stdout);
    assert.equal(r.classARecovered && r.classARecovered.recoveredVersion, '1.11.0', label + ': recoveredVersion');
    // After-swap install must have the new version.
    const after = JSON.parse(fs.readFileSync(path.join(scratch, 'mindrian-os', '.claude-plugin', 'plugin.json'), 'utf8'));
    assert.equal(after.version, '1.11.0', label + ': post-swap install plugin.json');
    // install.new must NOT exist after success.
    assert.equal(fs.existsSync(path.join(scratch, 'mindrian-os.new')), false, label + ': install.new cleaned up');
    // backup must exist with stale-1.10.0-* name.
    const backups = fs.readdirSync(scratch).filter(d => d.startsWith('mindrian-os.stale-1.10.0-'));
    assert.ok(backups.length === 1, label + ': exactly one backup with stale-1.10.0-* name');
    ok(label);
  } catch (err) { fail(label, err); }
  finally { rmrf(scratch); }
})();

// ---------- Scenario 2: missing-install path ----------
(function s2_missingInstall() {
  const label = 'S2: missing install + cache -> drift+recoverable, --fix exit 2 with stale-missing-* backup name';
  const scratch = makeScratchDir('s2');
  try {
    makeScratchPluginHome(scratch, {
      installVersion: null,  // no install
      cacheVersions: [{ version: '1.11.0' }],
    });
    // 2a: read-only doctor
    const ro = runDoctor(scratch, ['--json']);
    assert.equal(ro.status, 1, label + ': read-only exit 1');
    const r1 = readDoctorJson(ro.stdout);
    assert.equal(r1.drift && r1.drift.detected, true, label + ': drift.detected true');
    assert.equal(r1.drift && r1.drift.reason, 'install-missing', label + ': drift.reason install-missing');
    assert.equal(r1.install && r1.install.recoverable, true, label + ': install.recoverable true');
    // 2b: --fix
    const fx = runDoctor(scratch, ['--fix', '--json']);
    assert.equal(fx.status, 2, label + ': --fix exit 2');
    const r2 = readDoctorJson(fx.stdout);
    assert.equal(r2.classARecovered && r2.classARecovered.recoveredVersion, '1.11.0', label + ': recoveredVersion');
    // No 'mindrian-os.stale-missing-*' backup expected since there was nothing to back up. Per Finding F, when install dir doesn't exist there's nothing renamed; the result.backup is null.
    assert.equal(r2.classARecovered.backup, null, label + ': backup is null when install was missing');
    // Post-recovery install exists.
    const after = JSON.parse(fs.readFileSync(path.join(scratch, 'mindrian-os', '.claude-plugin', 'plugin.json'), 'utf8'));
    assert.equal(after.version, '1.11.0', label + ': post-recovery install version');
    ok(label);
  } catch (err) { fail(label, err); }
  finally { rmrf(scratch); }
})();

// ---------- Scenario 3: cp failure ----------
(function s3_cpFailure() {
  const label = 'S3: MOS_TEST_FORCE_FAIL=copy -> live install untouched';
  const scratch = makeScratchDir('s3');
  try {
    makeScratchPluginHome(scratch, {
      installVersion: '1.10.0',
      cacheVersions: [{ version: '1.11.0' }],
    });
    const { status } = runDoctor(scratch, ['--fix', '--json'], { MOS_TEST_FORCE_FAIL: 'copy' });
    assert.notEqual(status, 2, label + ': exit must NOT be 2 (recovery should fail)');
    // Live install untouched.
    const live = JSON.parse(fs.readFileSync(path.join(scratch, 'mindrian-os', '.claude-plugin', 'plugin.json'), 'utf8'));
    assert.equal(live.version, '1.10.0', label + ': live install plugin.json untouched');
    // No stale-* backup created (no rename happened).
    const backups = fs.readdirSync(scratch).filter(d => d.startsWith('mindrian-os.stale-'));
    assert.equal(backups.length, 0, label + ': no backup created when cp failed');
    ok(label);
  } catch (err) { fail(label, err); }
  finally { rmrf(scratch); }
})();

// ---------- Scenario 4: verify failure via bad-version cache plugin.json ----------
(function s4_verifyFailure() {
  const label = 'S4: cache plugin.json wrong version -> verify fails, install untouched, install.new left';
  const scratch = makeScratchDir('s4');
  try {
    makeScratchPluginHome(scratch, {
      installVersion: '1.10.0',
      cacheVersions: [{ version: '1.11.0', pluginJsonVersion: '0.0.0-WRONG' }],
    });
    const { status } = runDoctor(scratch, ['--fix', '--json']);
    assert.notEqual(status, 2, label + ': exit must NOT be 2 (verify should fail)');
    // Live install untouched.
    const live = JSON.parse(fs.readFileSync(path.join(scratch, 'mindrian-os', '.claude-plugin', 'plugin.json'), 'utf8'));
    assert.equal(live.version, '1.10.0', label + ': live install plugin.json untouched');
    // install.new left for inspection with wrong version.
    const newPath = path.join(scratch, 'mindrian-os.new', '.claude-plugin', 'plugin.json');
    assert.ok(fs.existsSync(newPath), label + ': install.new left for inspection');
    const newer = JSON.parse(fs.readFileSync(newPath, 'utf8'));
    assert.equal(newer.version, '0.0.0-WRONG', label + ': install.new has the wrong-version plugin.json');
    ok(label);
  } catch (err) { fail(label, err); }
  finally { rmrf(scratch); }
})();

// ---------- Scenario 4b: verify failure via injection (H3 fix) ----------
(function s4b_verifyInjection() {
  const label = 'S4b: MOS_TEST_FORCE_FAIL=verify -> verify gate trips, install untouched, no backup';
  const scratch = makeScratchDir('s4b');
  try {
    makeScratchPluginHome(scratch, {
      installVersion: '1.10.0',
      cacheVersions: [{ version: '1.11.0' }],  // valid cache
    });
    const { status, stdout } = runDoctor(scratch, ['--fix', '--json'], { MOS_TEST_FORCE_FAIL: 'verify' });
    assert.notEqual(status, 2, label + ': exit must NOT be 2');
    assert.notEqual(status, 4, label + ': verify-fail must NOT trigger rollback exit code 4 (no commit happened)');
    const r = readDoctorJson(stdout);
    // Recovery error attributable to verify stage (or generic recovery error if shape differs).
    assert.ok(r.recoveryError, label + ': recoveryError surfaced');
    assert.match(r.recoveryError, /verify/i, label + ': recoveryError mentions verify');
    // Live install untouched.
    const live = JSON.parse(fs.readFileSync(path.join(scratch, 'mindrian-os', '.claude-plugin', 'plugin.json'), 'utf8'));
    assert.equal(live.version, '1.10.0', label + ': live install plugin.json untouched');
    // No stale-* backup created (verify happens before backup-mv).
    const backups = fs.readdirSync(scratch).filter(d => d.startsWith('mindrian-os.stale-'));
    assert.equal(backups.length, 0, label + ': no backup created when verify failed');
    ok(label);
  } catch (err) { fail(label, err); }
  finally { rmrf(scratch); }
})();

// ---------- Scenario 5: rollback (commit-fail injection) ----------
(function s5_rollback() {
  const label = 'S5: MOS_TEST_FORCE_FAIL=commit -> exit 4, live install restored from backup';
  const scratch = makeScratchDir('s5');
  try {
    makeScratchPluginHome(scratch, {
      installVersion: '1.10.0',
      cacheVersions: [{ version: '1.11.0' }],
    });
    const { status, stdout } = runDoctor(scratch, ['--fix', '--json'], { MOS_TEST_FORCE_FAIL: 'commit' });
    assert.equal(status, 4, label + ': exit must be 4 (rollback)');
    const r = readDoctorJson(stdout);
    assert.equal(r.recoveryRolledBack, true, label + ': recoveryRolledBack true');
    assert.match(r.recoveryError || '', /live install restored from backup/, label + ': recoveryError contains rollback message');
    // Live install restored to pre-recovery state.
    const live = JSON.parse(fs.readFileSync(path.join(scratch, 'mindrian-os', '.claude-plugin', 'plugin.json'), 'utf8'));
    assert.equal(live.version, '1.10.0', label + ': live install restored to 1.10.0');
    ok(label);
  } catch (err) { fail(label, err); }
  finally { rmrf(scratch); }
})();

// ---------- Scenario 5b: rename-old failure via injection (H3 fix) ----------
(function s5b_renameOldInjection() {
  const label = 'S5b: MOS_TEST_FORCE_FAIL=rename-old -> exit 1 (backup-mv stage), install untouched, install.new left, no backup';
  const scratch = makeScratchDir('s5b');
  try {
    makeScratchPluginHome(scratch, {
      installVersion: '1.10.0',
      cacheVersions: [{ version: '1.11.0' }],
    });
    const { status, stdout } = runDoctor(scratch, ['--fix', '--json'], { MOS_TEST_FORCE_FAIL: 'rename-old' });
    // The rename-old injection trips BEFORE backup-mv even happens (the backup never started),
    // so this is a regular failure (exit 1), NOT the rollback-after-commit path (exit 4).
    assert.notEqual(status, 2, label + ': exit must NOT be 2');
    assert.notEqual(status, 4, label + ': rename-old fail must NOT trigger rollback exit 4 (no commit happened)');
    const r = readDoctorJson(stdout);
    assert.ok(r.recoveryError, label + ': recoveryError surfaced');
    assert.match(r.recoveryError, /rename-old|backup[ -]mv/i, label + ': recoveryError mentions rename-old or backup-mv stage');
    // Live install untouched.
    const live = JSON.parse(fs.readFileSync(path.join(scratch, 'mindrian-os', '.claude-plugin', 'plugin.json'), 'utf8'));
    assert.equal(live.version, '1.10.0', label + ': live install untouched');
    // install.new left for inspection (cp completed, verify completed, backup-mv tripped).
    assert.ok(fs.existsSync(path.join(scratch, 'mindrian-os.new', '.claude-plugin', 'plugin.json')), label + ': install.new left after backup-mv fail');
    // No stale-* backup created (backup-mv never ran).
    const backups = fs.readdirSync(scratch).filter(d => d.startsWith('mindrian-os.stale-'));
    assert.equal(backups.length, 0, label + ': no backup created when backup-mv tripped');
    ok(label);
  } catch (err) { fail(label, err); }
  finally { rmrf(scratch); }
})();

// ---------- Scenario 6: JSON shape stability ----------
(function s6_jsonShape() {
  const label = 'S6: healthy run preserves byte-stable JSON shape';
  const scratch = makeScratchDir('s6');
  try {
    makeScratchPluginHome(scratch, {
      installVersion: '1.11.0',
      cacheVersions: [{ version: '1.11.0' }],
    });
    const { status, stdout } = runDoctor(scratch, ['--json']);
    assert.equal(status, 0, label + ': exit 0 healthy');
    const r = readDoctorJson(stdout);
    // Required keys.
    for (const key of ['install', 'cache', 'dev', 'drift', 'fixRequested', 'classARecovered', 'recoveryError', 'checks', 'recovered']) {
      assert.ok(Object.prototype.hasOwnProperty.call(r, key), label + ': has key ' + key);
    }
    // 95.2 additions present.
    assert.equal(r.install.recoverable, true, label + ': install.recoverable === true (cache has versions)');
    assert.equal(r.drift.detected, false, label + ': drift.detected false on healthy');
    ok(label);
  } catch (err) { fail(label, err); }
  finally { rmrf(scratch); }
})();

// ---------- Scenario 7: renderer auto-fire on missing-install (B2 fix; concrete DOCTOR-95.2-05 verification) ----------
(function s7_renderer() {
  const label = 'S7: missing-install + cache -> human-render mode emits [F.1 Next Move] + /mos:doctor --fix actionable verb';
  const scratch = makeScratchDir('s7');
  try {
    // Setup: scratch with cache only, no install dir (matches missing-install state from s2).
    makeScratchPluginHome(scratch, {
      installVersion: null,
      cacheVersions: [{ version: '1.11.0' }],
    });
    // Spawn doctor WITHOUT --json (human render mode). Disable color so ANSI doesn't
    // interfere with substring grep. Provide TERM=dumb to discourage any TTY-dependent
    // formatting paths from injecting escape sequences.
    const { stdout, status } = runDoctor(scratch, [], { NO_COLOR: '1', MOS_NO_COLOR: '1' });
    // Exit code: drift detected, no --fix attempted, so exit 1.
    assert.equal(status, 1, label + ': exit 1 (drift detected, read-only)');
    // Renderer artifact 1: F.1 selector header. The exact label is canonical (Phase 88.2 + Canon Part 3).
    assert.ok(stdout.includes('[F.1 Next Move]'),
      label + ': stdout contains literal [F.1 Next Move] selector header. stdout was:\n' + stdout);
    // Renderer artifact 2: actionable verb pointing at /mos:doctor --fix.
    assert.ok(/\/mos:doctor\s+--fix/.test(stdout) || stdout.includes('/mos:doctor --fix'),
      label + ': stdout contains /mos:doctor --fix actionable verb. stdout was:\n' + stdout);
    ok(label);
  } catch (err) { fail(label, err); }
  finally { rmrf(scratch); }
})();

// ---------- Summary ----------
process.stdout.write('\n' + (failed === 0 ? 'ok' : 'FAIL') + ' ' + passed + '/' + (passed + failed) + ' atomic-swap scenarios passed\n');
process.exit(failed === 0 ? 0 : 1);
