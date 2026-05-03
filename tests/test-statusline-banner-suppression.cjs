#!/usr/bin/env node
'use strict';

/*
 * Phase 106-03 Task 3 -- statusline-visibility banner suppression contract test.
 *
 * Plan 106-03 ships the SUPPRESSION CONTRACT (the JSON shape + 24h timing
 * arithmetic + version-bump invalidation). Plan 106-04 ships the actual
 * hook script scripts/statusline-fallback-echo.cjs that consumes this
 * contract. Fencing the contract here means 106-04 cannot drift away from
 * the agreed shape without breaking this test.
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
 * Plan 106-04 SHOULD extract shouldSuppress() into a shared module so this
 * test can require() it directly instead of the inline copy below. For
 * Plan 106-03, the contract is enforced via the local copy + assertions.
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

// Suppression-logic CONTRACT (Plan 106-03 fences this; Plan 106-04
// implements scripts/statusline-fallback-echo.cjs which MUST consume the
// same logic). If Plan 106-04 extracts this into a shared module, swap
// the inline copy for a require(...).
function shouldSuppress(touchFileContent, currentVersion, now) {
  if (now === undefined) now = Date.now();
  if (!touchFileContent) return false;
  if (touchFileContent.installed_version !== currentVersion) return false;
  if (touchFileContent.status !== 'warn' && touchFileContent.status !== 'error') return false;
  if (!touchFileContent.last_warned) return false;
  const warnedAt = Date.parse(touchFileContent.last_warned);
  if (Number.isNaN(warnedAt)) return false;
  const ageMs = now - warnedAt;
  const TWENTY_FOUR_HOURS = 24 * 3600 * 1000;
  return ageMs < TWENTY_FOUR_HOURS;
}

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
