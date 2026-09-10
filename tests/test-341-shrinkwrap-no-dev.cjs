#!/usr/bin/env node
'use strict';

/*
 * tests/test-341-shrinkwrap-no-dev.cjs -- Phase 341 Plan 04 (D-04).
 *
 * npm-shrinkwrap.json must carry zero `dev: true` entries. The Claude Code
 * loader runs `npm ci --ignore-scripts` with NO `--omit` flag (measured
 * against `npm config ls -l`, `omit = []`), so a dev-only package in the
 * shrinkwrap WOULD be installed on every user machine, not just this dev
 * box. This is a pure filesystem read, no spawn, no network.
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SHRINKWRAP_PATH = path.join(REPO_ROOT, 'npm-shrinkwrap.json');

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

function main() {
  console.log('test-341-shrinkwrap-no-dev.cjs');

  check(
    'npm-shrinkwrap.json exists',
    fs.existsSync(SHRINKWRAP_PATH),
    'expected ' + SHRINKWRAP_PATH + ' to exist'
  );

  if (!fs.existsSync(SHRINKWRAP_PATH)) {
    console.log('RESULT: PASS=' + PASS + ' FAIL=' + FAIL);
    process.exit(FAIL === 0 ? 0 : 1);
  }

  let shrinkwrap;
  try {
    shrinkwrap = JSON.parse(fs.readFileSync(SHRINKWRAP_PATH, 'utf8'));
  } catch (e) {
    check('npm-shrinkwrap.json parses as JSON', false, e.message);
    console.log('RESULT: PASS=' + PASS + ' FAIL=' + FAIL);
    process.exit(1);
  }
  check('npm-shrinkwrap.json parses as JSON', true);

  const packages = shrinkwrap.packages && typeof shrinkwrap.packages === 'object'
    ? shrinkwrap.packages
    : {};
  const packageKeys = Object.keys(packages);
  check('packages object is non-empty', packageKeys.length > 0, 'found ' + packageKeys.length + ' entries');

  const devEntries = packageKeys.filter(function (k) {
    const p = packages[k];
    return p && p.dev === true;
  });

  check(
    'zero dev:true entries in npm-shrinkwrap.json packages',
    devEntries.length === 0,
    devEntries.length
      ? 'found dev entries: ' + devEntries.join(', ') +
        ' -- the loader runs `npm ci --ignore-scripts` with NO --omit flag, ' +
        'so a dev entry here would install on every user machine'
      : ''
  );

  console.log('RESULT: PASS=' + PASS + ' FAIL=' + FAIL);
  process.exit(FAIL === 0 ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { main };
