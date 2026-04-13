#!/usr/bin/env node
'use strict';

/**
 * Phase 81-01 test runner for the Feynman-MINTO foundation work.
 *
 * Discovers and runs test files that belong to the Feynman-MINTO pipeline:
 *   - lib/memory/feynman-prompts.test.cjs
 *   - lib/memory/narrative-schema.test.cjs
 *   - scripts/vault-section-minto-generator.test.cjs
 *
 * Runs each in a child process so a module-level assertion failure in one
 * file does not short-circuit the rest of the suite. Exits 0 on all pass,
 * 1 on any failure. Mirrors the lib/import/run-all-tests.cjs pattern.
 *
 * Usage:
 *   MINTO_FROZEN_DATE=2026-04-14 node lib/memory/run-feynman-tests.cjs
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const TEST_FILES = [
  path.join(REPO_ROOT, 'lib', 'memory', 'feynman-prompts.test.cjs'),
  path.join(REPO_ROOT, 'lib', 'memory', 'narrative-schema.test.cjs'),
  path.join(REPO_ROOT, 'scripts', 'vault-section-minto-generator.test.cjs'),
  // Phase 81-02 additions:
  path.join(REPO_ROOT, 'lib', 'memory', 'feynman-prompts-drift.test.cjs'),
  path.join(
    REPO_ROOT,
    'scripts',
    'vault-section-minto-generator.integration.test.cjs'
  ),
  // Phase 81-04:
  path.join(REPO_ROOT, 'scripts', 'vault-regenerate-all.test.cjs'),
];

let failed = 0;
for (const t of TEST_FILES) {
  const rel = path.relative(REPO_ROOT, t);
  if (!fs.existsSync(t)) {
    process.stderr.write('MISS ' + rel + ' (file does not exist)\n');
    failed += 1;
    continue;
  }
  const res = spawnSync(process.execPath, [t], { stdio: 'inherit' });
  if (res.status === 0) {
    process.stdout.write('PASS ' + rel + '\n');
  } else {
    process.stderr.write('FAIL ' + rel + ' (exit ' + res.status + ')\n');
    failed += 1;
  }
}

const total = TEST_FILES.length;
const passed = total - failed;
process.stdout.write(
  '\nFeynman test runner: ' + passed + '/' + total + ' test files passed\n'
);
process.exit(failed === 0 ? 0 : 1);
