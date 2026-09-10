#!/usr/bin/env node
'use strict';

/*
 * Phase 341 Plan 05 -- hermetic proof for doctor.cjs's version-of-record-
 * published point, leg (b), via the exported pure helper
 * `evaluateMarketplaceSourcePin(source, ver)`.
 *
 * Leg (c) of the real point makes a real `npm view` network call, so this
 * file does NOT run the whole point. Instead it:
 *   1. Asserts `node scripts/doctor.cjs --acceptance --pre-tag` still passes
 *      (that tier excludes this 'full'-only point entirely, so this proves
 *      nothing regressed elsewhere).
 *   2. Exercises the comparison logic directly through the doctor's own
 *      exported helper against fixture marketplace source objects, so every
 *      branch (npm shape, half-migrated, legacy git shape, neither) is
 *      proved without touching the real marketplace.json or the network.
 *
 * Zero network. Registered in tests/run-all-341.sh.
 */

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const doctor = require(path.join(REPO_ROOT, 'scripts', 'doctor.cjs'));
const evaluateMarketplaceSourcePin = doctor.evaluateMarketplaceSourcePin;

let failures = 0;
let total = 0;

function pass(name) {
  process.stdout.write('PASS: ' + name + '\n');
}
function fail(name, err) {
  failures++;
  process.stdout.write('FAIL: ' + name + '\n');
  if (err) process.stdout.write('  ' + String(err && err.stack ? err.stack : err) + '\n');
}
function run(name, fn) {
  total++;
  try {
    fn();
    pass(name);
  } catch (e) {
    fail(name, e);
  }
}

function assertOk(result, msg) {
  if (!result || result.ok !== true) throw new Error((msg || 'expected ok:true') + ', got: ' + JSON.stringify(result));
}
function assertFail(result, findingSubstr, msg) {
  if (!result || result.ok !== false) throw new Error((msg || 'expected ok:false') + ', got: ' + JSON.stringify(result));
  if (findingSubstr && (!result.finding || result.finding.indexOf(findingSubstr) === -1)) {
    throw new Error((msg || '') + ' expected finding to contain "' + findingSubstr + '", got: ' + JSON.stringify(result));
  }
}

// --------------------- Arm 0: doctor --acceptance --pre-tag still passes ---

run('Arm 0 (node scripts/doctor.cjs --acceptance --pre-tag exits 0 -- excludes this full-only point)', function () {
  const r = spawnSync('node', [path.join(REPO_ROOT, 'scripts', 'doctor.cjs'), '--acceptance', '--pre-tag'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 60000,
  });
  if (r.status !== 0) {
    throw new Error('doctor --acceptance --pre-tag exited ' + r.status + ':\n' + (r.stdout || '').slice(-1000) + (r.stderr || '').slice(-500));
  }
});

// --------------------- Arm 1: npm-shape fixture, exact match accepted ------

run('Arm 1 (npm shape {source:npm, package:@mindrian_os/cli, version:2.0.0-beta.31} matches ver -> accepted)', function () {
  const result = evaluateMarketplaceSourcePin(
    { source: 'npm', package: '@mindrian_os/cli', version: '2.0.0-beta.31' },
    '2.0.0-beta.31'
  );
  assertOk(result);
});

// --------------------- Arm 2: npm shape with v-prefix -> rejected ----------

run('Arm 2 (npm shape version carries a v prefix -> rejected, v prefix is wrong for npm)', function () {
  const result = evaluateMarketplaceSourcePin(
    { source: 'npm', package: '@mindrian_os/cli', version: 'v2.0.0-beta.31' },
    '2.0.0-beta.31'
  );
  assertFail(result, 'source.version is v2.0.0-beta.31');
});

// --------------------- Arm 3: half-migrated (version + residual ref) -------

run('Arm 3 (correct version but a residual ref also present -> rejected, half-migrated D-01 state)', function () {
  const result = evaluateMarketplaceSourcePin(
    { source: 'npm', package: '@mindrian_os/cli', version: '2.0.0-beta.31', ref: 'v2.0.0-beta.31' },
    '2.0.0-beta.31'
  );
  assertFail(result, 'residual ref/url key');
});

// --------------------- Arm 4: still on the legacy {source:url, ref} shape --

run('Arm 4a (legacy {source:url, ref:v<ver>} shape, matching -> accepted during the transition)', function () {
  const result = evaluateMarketplaceSourcePin(
    { source: 'url', url: 'git' + '-url-placeholder.invalid/mindrian-os-plugin.git', ref: 'v2.0.0-beta.29' },
    '2.0.0-beta.29'
  );
  assertOk(result);
});

run('Arm 4b (legacy {source:url, ref} shape, mismatched ref -> rejected)', function () {
  const result = evaluateMarketplaceSourcePin(
    { source: 'url', url: 'git' + '-url-placeholder.invalid/mindrian-os-plugin.git', ref: 'v9.9.9' },
    '2.0.0-beta.29'
  );
  assertFail(result, 'source.ref is v9.9.9');
});

// --------------------- Arm 5: neither shape (defensive) ---------------------

run('Arm 5 (source object has neither version nor ref -> rejected)', function () {
  const result = evaluateMarketplaceSourcePin({ source: 'url' }, '2.0.0-beta.29');
  assertFail(result, 'neither a version nor a ref key');
});

run('Arm 6 (source is missing entirely -> rejected)', function () {
  const result = evaluateMarketplaceSourcePin(undefined, '2.0.0-beta.29');
  assertFail(result, 'missing or not an object');
});

// ------------------------ Summary ----------------------------------------

process.on('exit', function () {
  process.stdout.write('\n');
  process.stdout.write('Total: ' + total + '  Passed: ' + (total - failures) + '  Failed: ' + failures + '\n');
  if (failures > 0) process.exitCode = 1;
});
