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
  // Phase 82-04: wiki artifact injection fixture-based tests.
  path.join(REPO_ROOT, 'scripts', 'generate-presentation.test.cjs'),
  // Phase 83-04: cross-session scope injection Tier 1 tests.
  path.join(REPO_ROOT, 'scripts', '83-scope-injection.test.cjs'),
  // Phase 83-05: hook dispatch scaffold smoke tests.
  path.join(REPO_ROOT, 'test', '83-hook-dispatch.test.cjs'),
  // Phase 83-06: filesystem write interception (Tier 1.5) tests.
  path.join(REPO_ROOT, 'test', '83-write-scope-check.test.cjs'),
  // Phase 83-07: mid-session intent classifier (Tier 2) tests.
  path.join(REPO_ROOT, 'test', '83-intent-classifier.test.cjs'),
  // Phase 83-08: honesty layer markdown test.
  path.join(REPO_ROOT, 'test', '83-honesty-layer.test.cjs'),
  // Phase 84-08: smart notebook co-pilot fixture-based test suite (15 live + 3 skip-gated).
  path.join(REPO_ROOT, 'test', '84-smart-notebook-copilot.test.cjs'),
  // Phase 85-04 (WIN-FIX-F-02): run-hook.cmd exit-code propagation regression fence.
  path.join(REPO_ROOT, 'tests', 'test-run-hook-cmd.cjs'),
  // Phase 85-08 (WIN-FIX-I): brain-client param schema regression (Finding I, v1.10.9).
  path.join(REPO_ROOT, 'tests', 'test-brain-client-params.cjs'),
  // Phase 85-09 (Finding J / LASZLO-001): self-update Windows failure family regression fence.
  path.join(REPO_ROOT, 'tests', 'test-self-update-platform.cjs'),
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
