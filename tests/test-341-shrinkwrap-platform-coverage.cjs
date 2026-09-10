#!/usr/bin/env node
'use strict';

/*
 * tests/test-341-shrinkwrap-platform-coverage.cjs -- Phase 341 Plan 04 (D-04).
 *
 * npm-shrinkwrap.json must carry all five published sqlite-vec platform
 * packages, each with its `os`/`cpu` constraints and `optional: true`, so
 * each user machine resolves only its own native binary. sqlite-vec does
 * NOT publish a windows-arm64 platform package upstream: a Windows-on-ARM
 * machine gets `sqlite-vec` present with no native binary and degrades to
 * the cjs fallback in lib/core/eureka/vector-store.cjs. That silent-degrade
 * class is exactly what `bundleDependencies` was rejected for elsewhere in
 * this phase, so it must be VISIBLE in this test's own output, not
 * discovered later by a tester on a Windows-on-ARM box.
 *
 * Pure filesystem read, no spawn, no network.
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SHRINKWRAP_PATH = path.join(REPO_ROOT, 'npm-shrinkwrap.json');

const EXPECTED_PLATFORMS = [
  { key: 'sqlite-vec-darwin-arm64', os: 'darwin', cpu: 'arm64' },
  { key: 'sqlite-vec-darwin-x64', os: 'darwin', cpu: 'x64' },
  { key: 'sqlite-vec-linux-arm64', os: 'linux', cpu: 'arm64' },
  { key: 'sqlite-vec-linux-x64', os: 'linux', cpu: 'x64' },
  { key: 'sqlite-vec-windows-x64', os: 'win32', cpu: 'x64' },
];

let PASS = 0;
let FAIL = 0;

function check(name, cond, detail) {
  if (cond) {
    PASS++;
    console.log('  PASS: ' + name);
  } else {
    FAIL++;
    console.log('  FAIL: ' + name + (detail ? ' -- ' + detail : ''));
  }
}

function findPackageKey(packages, suffix) {
  return Object.keys(packages).find(function (k) {
    return k === 'node_modules/' + suffix || k === suffix;
  });
}

function main() {
  console.log('test-341-shrinkwrap-platform-coverage.cjs');

  if (!fs.existsSync(SHRINKWRAP_PATH)) {
    check('npm-shrinkwrap.json exists', false, 'expected ' + SHRINKWRAP_PATH);
    console.log('RESULT: PASS=' + PASS + ' FAIL=' + FAIL);
    process.exit(1);
  }
  check('npm-shrinkwrap.json exists', true);

  const shrinkwrap = JSON.parse(fs.readFileSync(SHRINKWRAP_PATH, 'utf8'));
  const packages = shrinkwrap.packages && typeof shrinkwrap.packages === 'object'
    ? shrinkwrap.packages
    : {};

  for (const plat of EXPECTED_PLATFORMS) {
    const key = findPackageKey(packages, plat.key);
    check(plat.key + ' present in npm-shrinkwrap.json', !!key, 'expected an entry naming ' + plat.key);
    if (!key) continue;

    const entry = packages[key];
    const osArr = Array.isArray(entry.os) ? entry.os : [];
    const cpuArr = Array.isArray(entry.cpu) ? entry.cpu : [];
    check(
      plat.key + ' carries os:[' + plat.os + ']',
      osArr.indexOf(plat.os) !== -1,
      'found os=' + JSON.stringify(entry.os)
    );
    check(
      plat.key + ' carries cpu:[' + plat.cpu + ']',
      cpuArr.indexOf(plat.cpu) !== -1,
      'found cpu=' + JSON.stringify(entry.cpu)
    );
    check(
      plat.key + ' is optional:true',
      entry.optional === true,
      'found optional=' + JSON.stringify(entry.optional)
    );
  }

  // Explicitly-reported PASSING arm: sqlite-vec-windows-arm64 does NOT exist
  // upstream. This is not a failure of this phase's packaging; it is a real
  // upstream gap that must stay visible rather than be discovered silently.
  const winArmKey = findPackageKey(packages, 'sqlite-vec-windows-arm64');
  check(
    'sqlite-vec-windows-arm64 absence is VISIBLE (no upstream platform package; ' +
      'a Windows-on-ARM machine gets sqlite-vec with no native binary and ' +
      'degrades to the cjs fallback in lib/core/eureka/vector-store.cjs)',
    !winArmKey,
    winArmKey ? 'unexpectedly found an entry for sqlite-vec-windows-arm64' : ''
  );

  console.log('RESULT: PASS=' + PASS + ' FAIL=' + FAIL);
  process.exit(FAIL === 0 ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { main };
