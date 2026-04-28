#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 93 D4 — regression test for /mos:doctor drift detection + --fix recovery.
 *
 * STRATEGY:
 *   - Build a throwaway test environment under a temp directory
 *   - Populate it with a fake "stale" install + a fake marketplace cache
 *     containing two versions (one stale, one latest)
 *   - Run scripts/doctor.cjs against the throwaway env (via TEST_HOME override)
 *   - Verify drift is detected (exit 1), then re-run with --fix
 *   - Verify install is now at latest (exit 2) and a backup directory exists
 *
 * Does NOT touch ~/.claude/. The test isolates itself completely.
 *
 * NOTE: doctor.cjs uses os.homedir() as the root for paths. To redirect it
 * for testing, the test sets HOME and runs the script as a child process.
 *
 * Exit codes:
 *   0 -> all assertions passed
 *   1 -> at least one assertion failed
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync, execSync } = require('child_process');

const DOCTOR_SCRIPT = path.resolve(__dirname, 'doctor.cjs');

// ── Test harness ────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(name, condition, detail) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}`);
    if (detail) console.log(`    ${detail}`);
    failed++;
  }
}

// ── Test environment builder ────────────────────────────────────────

function buildEnv(tmpRoot, installVersion, cachedVersions) {
  const installDir = path.join(tmpRoot, '.claude/plugins/mindrian-os');
  const cacheRoot = path.join(tmpRoot, '.claude/plugins/cache/mindrian-marketplace/mos');

  fs.mkdirSync(path.join(installDir, '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(installDir, '.claude-plugin/plugin.json'),
    JSON.stringify({ name: 'mos', version: installVersion }, null, 2)
  );
  // Populate a few sentinel files so cp -aT actually has something to copy
  fs.writeFileSync(path.join(installDir, 'README-stale.md'), `STALE ${installVersion}\n`);

  for (const version of cachedVersions) {
    const verDir = path.join(cacheRoot, version);
    fs.mkdirSync(path.join(verDir, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(
      path.join(verDir, '.claude-plugin/plugin.json'),
      JSON.stringify({ name: 'mos', version }, null, 2)
    );
    fs.writeFileSync(path.join(verDir, 'README-cached.md'), `CACHED ${version}\n`);
  }

  return { installDir, cacheRoot };
}

function runDoctor(home, args) {
  const result = spawnSync('node', [DOCTOR_SCRIPT, ...args, '--json'], {
    env: { ...process.env, HOME: home },
    encoding: 'utf8',
  });
  let report = null;
  try {
    report = JSON.parse(result.stdout);
  } catch (_) { /* non-JSON output; report stays null */ }
  return { exitCode: result.status, stdout: result.stdout, stderr: result.stderr, report };
}

// ── Test cases ──────────────────────────────────────────────────────

function testDriftDetection(tmpRoot) {
  console.log('\n[1] Drift detection (read-only)');
  buildEnv(tmpRoot, '1.10.10', ['1.10.12', '1.10.17', '1.11.0']);

  const result = runDoctor(tmpRoot, []);

  assert('exits with code 1 (drift detected)', result.exitCode === 1, `got exit=${result.exitCode}`);
  assert('install version reported as 1.10.10',
    result.report && result.report.install && result.report.install.version === '1.10.10',
    JSON.stringify(result.report && result.report.install));
  assert('latest cache reported as 1.11.0',
    result.report && result.report.cache && result.report.cache.latest === '1.11.0',
    JSON.stringify(result.report && result.report.cache && result.report.cache.latest));
  assert('drift.detected === true',
    result.report && result.report.drift && result.report.drift.detected === true,
    JSON.stringify(result.report && result.report.drift));
  assert('cache enumerates all three versions',
    result.report && result.report.cache && result.report.cache.versions.length === 3,
    JSON.stringify(result.report && result.report.cache && result.report.cache.versions));
}

function testAutoRecovery(tmpRoot) {
  console.log('\n[2] --fix auto-recovery');
  buildEnv(tmpRoot, '1.10.10', ['1.10.12', '1.10.17', '1.11.0']);

  const result = runDoctor(tmpRoot, ['--fix']);

  assert('exits with code 2 (recovered)', result.exitCode === 2, `got exit=${result.exitCode}`);
  assert('recovered.recoveredVersion === 1.11.0',
    result.report && result.report.recovered && result.report.recovered.recoveredVersion === '1.11.0',
    JSON.stringify(result.report && result.report.recovered));

  // Verify on disk
  const installPluginJson = path.join(tmpRoot, '.claude/plugins/mindrian-os/.claude-plugin/plugin.json');
  const live = JSON.parse(fs.readFileSync(installPluginJson, 'utf8'));
  assert('live plugin.json now reports 1.11.0', live.version === '1.11.0', `got ${live.version}`);

  // Verify backup exists
  const backupPath = result.report && result.report.recovered && result.report.recovered.backup;
  assert('backup directory was created', backupPath && fs.existsSync(backupPath), `backup=${backupPath}`);

  // Verify backup retains stale plugin.json
  if (backupPath && fs.existsSync(backupPath)) {
    const backupJson = path.join(backupPath, '.claude-plugin/plugin.json');
    if (fs.existsSync(backupJson)) {
      const backup = JSON.parse(fs.readFileSync(backupJson, 'utf8'));
      assert('backup retains stale 1.10.10', backup.version === '1.10.10', `backup version=${backup.version}`);
    } else {
      assert('backup retains stale 1.10.10', false, 'backup plugin.json missing');
    }
  }

  // Verify cached sentinel landed (cp -aT brought new content over)
  const newSentinel = path.join(tmpRoot, '.claude/plugins/mindrian-os/README-cached.md');
  assert('new cached content present in install', fs.existsSync(newSentinel));

  // Verify stale sentinel is GONE from install (replaced) but PRESENT in backup
  const oldSentinel = path.join(tmpRoot, '.claude/plugins/mindrian-os/README-stale.md');
  assert('stale content removed from install', !fs.existsSync(oldSentinel));
  if (backupPath) {
    const backupSentinel = path.join(backupPath, 'README-stale.md');
    assert('stale content preserved in backup', fs.existsSync(backupSentinel));
  }
}

function testHealthyNoDrift(tmpRoot) {
  console.log('\n[3] Healthy state (no drift)');
  buildEnv(tmpRoot, '1.11.0', ['1.10.12', '1.10.17', '1.11.0']);

  const result = runDoctor(tmpRoot, []);

  assert('exits with code 0 (healthy)', result.exitCode === 0, `got exit=${result.exitCode}`);
  assert('drift.detected === false',
    result.report && result.report.drift && result.report.drift.detected === false,
    JSON.stringify(result.report && result.report.drift));
}

function testFixNoDriftIsNoop(tmpRoot) {
  console.log('\n[4] --fix on healthy install is no-op');
  buildEnv(tmpRoot, '1.11.0', ['1.10.12', '1.10.17', '1.11.0']);

  const result = runDoctor(tmpRoot, ['--fix']);

  assert('exits with code 0 (no-op)', result.exitCode === 0, `got exit=${result.exitCode}`);
  assert('no recovery performed',
    !(result.report && result.report.recovered),
    JSON.stringify(result.report && result.report.recovered));
}

// ── Main ────────────────────────────────────────────────────────────

function main() {
  const baseTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-doctor-test-'));
  console.log(`Test harness root: ${baseTmp}`);

  try {
    const tests = [
      { name: 'drift-detection', fn: testDriftDetection },
      { name: 'auto-recovery', fn: testAutoRecovery },
      { name: 'healthy-no-drift', fn: testHealthyNoDrift },
      { name: 'fix-no-drift-noop', fn: testFixNoDriftIsNoop },
    ];

    for (const test of tests) {
      const subDir = fs.mkdtempSync(path.join(baseTmp, `${test.name}-`));
      test.fn(subDir);
    }

    console.log('');
    console.log(`────────────────────────────────────────────`);
    console.log(`  Passed: ${passed}    Failed: ${failed}`);
    console.log(`────────────────────────────────────────────`);

    if (failed > 0) {
      console.log('');
      console.log(`Inspect harness: ${baseTmp}`);
      process.exit(1);
    }

    // Clean up on success
    execSync(`rm -rf ${baseTmp}`);
    process.exit(0);
  } catch (err) {
    console.error('Harness error:', err);
    console.error(`Inspect: ${baseTmp}`);
    process.exit(1);
  }
}

main();
