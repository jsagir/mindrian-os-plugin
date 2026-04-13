#!/usr/bin/env node
'use strict';

/**
 * Zero-dep test runner for lib/import/*.test.cjs.
 *
 * Walks this directory, finds every *.test.cjs file, runs each in a child
 * process (so module-level assert failures don't short-circuit the whole
 * suite), reports pass/fail, and exits non-zero on any failure.
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const dir = __dirname;
const self = path.basename(__filename);
const tests = fs
  .readdirSync(dir)
  .filter(function (f) { return f.endsWith('.test.cjs') && f !== self; })
  .sort();

let failed = 0;
for (const t of tests) {
  const full = path.join(dir, t);
  const res = spawnSync(process.execPath, [full], { stdio: 'inherit' });
  if (res.status === 0) {
    process.stdout.write('PASS ' + t + '\n');
  } else {
    process.stderr.write('FAIL ' + t + ' (exit ' + res.status + ')\n');
    failed += 1;
  }
}

process.stdout.write('\n' + (tests.length - failed) + '/' + tests.length + ' test files passed\n');
process.exit(failed === 0 ? 0 : 1);
