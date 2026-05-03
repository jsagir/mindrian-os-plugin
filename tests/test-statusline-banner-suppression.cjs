#!/usr/bin/env node
'use strict';

/*
 * Phase 106 Plan 03 + Plan 04 -- statusline banner suppression contract test.
 *
 * Plan 106-03 fenced the SUPPRESSION CONTRACT (the JSON shape + 24h timing
 * arithmetic + version-bump invalidation) inline. Plan 106-04 extracted
 * shouldSuppress() into lib/statusline/banner-suppression.cjs as a shared
 * module consumed by both this test and scripts/statusline-fallback-echo.cjs.
 * The 5 fenced assertions below are byte-identical to the 106-03 originals --
 * they enforce the same contract, now sourced from the shared module.
 *
 * Touch-file at ~/.mindrian/banner-state/statusline-visibility-warned.json
 * Shape:
 *   {
 *     "status": "ok" | "warn" | "error",
 *     "last_check": "<ISO>",        // populated when status='ok'
 *     "last_warned": "<ISO>",       // populated when status='warn' or 'error'
 *     "installed_version": "<plugin.json version>"
 *   }
 *
 * shouldSuppress() returns true ONLY when:
 *   - touch-file exists, AND
 *   - installed_version === current plugin version, AND
 *   - status in {'warn', 'error'}, AND
 *   - last_warned is a parseable ISO timestamp, AND
 *   - last_warned is within 24h of `now`.
 *
 * Registered in lib/memory/run-feynman-tests.cjs (Plan 106-00 Task 3).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const PLUGIN_VERSION = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')
).version;

// Plan 106-04 extracted shouldSuppress() into lib/statusline/banner-suppression.cjs.
// This test now require()s the canonical module instead of carrying an inline
// copy. The 5 fenced assertions below remain byte-identical -- they enforce
// the same contract as before, now sourced from the shared module.
const { shouldSuppress } = require('../lib/statusline/banner-suppression.cjs');

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.message || err)); }

// Test 1: warned within 24h, same version -> suppress
try {
  const tf = {
    status: 'warn',
    last_warned: new Date().toISOString(),
    installed_version: PLUGIN_VERSION,
  };
  assert.strictEqual(shouldSuppress(tf, PLUGIN_VERSION), true);
  pass('Test 1 (warned within 24h same version -> suppress)');
} catch (err) { failTest('Test 1 (warned within 24h same version -> suppress)', err); }

// Test 2: warned 25h ago -> do NOT suppress
try {
  const tf = {
    status: 'warn',
    last_warned: new Date(Date.now() - 25 * 3600 * 1000).toISOString(),
    installed_version: PLUGIN_VERSION,
  };
  assert.strictEqual(shouldSuppress(tf, PLUGIN_VERSION), false);
  pass('Test 2 (warned 25h ago -> do not suppress)');
} catch (err) { failTest('Test 2 (warned 25h ago -> do not suppress)', err); }

// Test 3: no touch-file -> do NOT suppress
try {
  assert.strictEqual(shouldSuppress(null, PLUGIN_VERSION), false);
  pass('Test 3 (no touch-file -> do not suppress)');
} catch (err) { failTest('Test 3 (no touch-file -> do not suppress)', err); }

// Test 4: installed_version mismatch -> do NOT suppress
try {
  const tf = {
    status: 'warn',
    last_warned: new Date().toISOString(),
    installed_version: '0.0.1',
  };
  assert.strictEqual(shouldSuppress(tf, PLUGIN_VERSION), false);
  pass('Test 4 (installed_version mismatch -> do not suppress)');
} catch (err) { failTest('Test 4 (installed_version mismatch -> do not suppress)', err); }

// Test 5: status=ok -> do NOT suppress (no banner to suppress in the first place)
try {
  const tf = {
    status: 'ok',
    last_check: new Date().toISOString(),
    installed_version: PLUGIN_VERSION,
  };
  assert.strictEqual(shouldSuppress(tf, PLUGIN_VERSION), false);
  pass('Test 5 (status=ok -> do not suppress)');
} catch (err) { failTest('Test 5 (status=ok -> do not suppress)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED');
  process.exit(1);
}
console.log('\nAll 5 tests PASS');
process.exit(0);
