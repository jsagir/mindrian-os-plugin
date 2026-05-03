#!/usr/bin/env node
'use strict';

/*
 * Phase 106 Plan 05 -- D-05 onboarding gate hermetic tests.
 * Replaces the Wave 0 stub with 6 real assertions.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'check-onboard-statusline.cjs');
const PLUGIN_VERSION = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')
).version;

function makeTmpHome() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '106-05-'));
  fs.mkdirSync(path.join(tmp, '.mindrian', 'onboarding'), { recursive: true });
  return tmp;
}
function setTouchFile(tmp, body) {
  const p = path.join(tmp, '.mindrian', 'onboarding', 'statusline-onboarded.json');
  fs.writeFileSync(p, typeof body === 'string' ? body : JSON.stringify(body));
}
function run(tmp) {
  return spawnSync(process.execPath, [SCRIPT], {
    env: Object.assign({}, process.env, { HOME: tmp, USERPROFILE: tmp }),
    encoding: 'utf8',
    input: JSON.stringify({ hook_event_name: 'SessionStart' }),
  });
}
function rm(p) { fs.rmSync(p, { recursive: true, force: true }); }

let passed = 0, failed = 0;
function pass(n) { passed++; console.log('PASS: ' + n); }
function failTest(n, e) { failed++; console.log('FAIL: ' + n + '\n  ' + (e && e.message || e)); }

// Test 1: first-session (no touch-file) -> fires
try {
  const tmp = makeTmpHome();
  const r = run(tmp);
  assert.strictEqual(r.status, 0, 'exit 0; stderr=' + r.stderr);
  const env = JSON.parse(r.stdout);
  assert.strictEqual(env.continue, true);
  assert.ok(env.hookSpecificOutput, 'has hookSpecificOutput');
  const ctx = env.hookSpecificOutput.additionalContext;
  assert.ok(ctx, 'additionalContext present');
  assert.match(ctx, /MindrianOS/, 'mentions MindrianOS');
  assert.match(ctx, /\/mos:doctor/, 'references /mos:doctor');
  rm(tmp);
  pass('Test 1 (first session fires gate)');
} catch (e) { failTest('Test 1', e); }

// Test 2: subsequent same-version session -> skips
try {
  const tmp = makeTmpHome();
  setTouchFile(tmp, {
    installed_version: PLUGIN_VERSION,
    completed_at: new Date().toISOString(),
  });
  const r = run(tmp);
  assert.strictEqual(r.status, 0);
  const env = JSON.parse(r.stdout);
  assert.strictEqual(env.continue, true);
  assert.ok(!env.hookSpecificOutput || !env.hookSpecificOutput.additionalContext,
    'same-version subsequent session emits no additionalContext');
  rm(tmp);
  pass('Test 2 (subsequent same-version skips)');
} catch (e) { failTest('Test 2', e); }

// Test 3: version mismatch -> re-fires
try {
  const tmp = makeTmpHome();
  setTouchFile(tmp, {
    installed_version: '0.0.1',
    completed_at: '2025-01-01T00:00:00Z',
  });
  const r = run(tmp);
  assert.strictEqual(r.status, 0);
  const env = JSON.parse(r.stdout);
  assert.ok(env.hookSpecificOutput && env.hookSpecificOutput.additionalContext,
    'version mismatch refires gate');
  rm(tmp);
  pass('Test 3 (version mismatch refires)');
} catch (e) { failTest('Test 3', e); }

// Test 4: graceful when plugin.json unreadable -> empty envelope, exit 0
try {
  const tmp = makeTmpHome();
  const isolatedScript = path.join(tmp, 'check-onboard-statusline.cjs');
  fs.copyFileSync(SCRIPT, isolatedScript);
  const r = spawnSync(process.execPath, [isolatedScript], {
    env: Object.assign({}, process.env, { HOME: tmp, USERPROFILE: tmp }),
    encoding: 'utf8',
    input: JSON.stringify({ hook_event_name: 'SessionStart' }),
  });
  assert.strictEqual(r.status, 0, 'exit 0 despite missing plugin.json');
  const env = JSON.parse(r.stdout);
  assert.strictEqual(env.continue, true);
  assert.ok(!env.hookSpecificOutput || !env.hookSpecificOutput.additionalContext,
    'graceful no-op when plugin.json unreadable (do not spam)');
  rm(tmp);
  pass('Test 4 (graceful on missing plugin.json)');
} catch (e) { failTest('Test 4', e); }

// Test 5: corrupt touch-file -> treated as missing, gate fires
try {
  const tmp = makeTmpHome();
  setTouchFile(tmp, '{ this is not valid JSON');
  const r = run(tmp);
  assert.strictEqual(r.status, 0);
  const env = JSON.parse(r.stdout);
  assert.ok(env.hookSpecificOutput && env.hookSpecificOutput.additionalContext,
    'corrupt touch-file treated as missing (fire)');
  rm(tmp);
  pass('Test 5 (corrupt touch-file -> fires)');
} catch (e) { failTest('Test 5', e); }

// Test 6: gate text contains brand glyph + doctor command
try {
  const tmp = makeTmpHome();
  const r = run(tmp);
  const env = JSON.parse(r.stdout);
  const ctx = env.hookSpecificOutput.additionalContext;
  assert.match(ctx, /⬡/, 'contains brand glyph');
  assert.match(ctx, /\/mos:doctor/, 'contains /mos:doctor');
  rm(tmp);
  pass('Test 6 (brand glyph + doctor reference)');
} catch (e) { failTest('Test 6', e); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED');
  process.exit(1);
}
console.log('\nAll 6 tests PASS');
process.exit(0);
