#!/usr/bin/env node
'use strict';

/*
 * Phase 106 Plan 04 -- statusline fallback echo 30-day default-flip test.
 *
 * Tests scripts/statusline-fallback-echo.cjs default-flip semantic:
 *   - Within 30 days post-install: echo default-on
 *   - Past 30 days post-install: echo default-off
 *   - Explicit MINDRIAN_STATUSLINE_FALLBACK_ECHO env override beats default
 *   - Missing ~/.mindrian-onboarded marker treated as fresh-install
 *
 * Strategy: per-test hermetic mkdtempSync HOME; vary line 2 of
 * ~/.mindrian-onboarded (the install date) and the env override; assert
 * presence/absence of hookSpecificOutput.additionalContext.
 *
 * Replaces Wave 0 stub created by Plan 106-00.
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'statusline-fallback-echo.cjs');
const PLUGIN_VERSION = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')
).version;

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

function makeRoom(installDate) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '106-04-30day-'));
  const room = path.join(tmp, 'room');
  fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  fs.mkdirSync(path.join(tmp, '.mindrian', 'bridge'), { recursive: true });
  if (installDate !== null) {
    fs.writeFileSync(
      path.join(tmp, '.mindrian-onboarded'),
      PLUGIN_VERSION + '\n' + installDate + '\n'
    );
  }
  // Populate bridge so the echo CAN render if not gated by 30d / override.
  const hash = crypto.createHash('md5').update(room).digest('hex').slice(0, 8);
  fs.writeFileSync(
    path.join(tmp, '.mindrian', 'bridge', hash + '.json'),
    JSON.stringify({
      ctx_pct: 23,
      ctx_remaining: 77,
      ctx_size: 200000,
      timestamp: Math.floor(Date.now() / 1000),
      model_id: 'claude-sonnet-4-5',
      model_name: 'Sonnet',
    })
  );
  return { tmp, room };
}

function run(tmp, room, surface, extraEnv) {
  const env = Object.assign({}, process.env, {
    HOME: tmp,
    USERPROFILE: tmp,
    MINDRIAN_STATUSLINE_SURFACE: surface,
  }, extraEnv || {});
  delete env.CLAUDE_DESKTOP;
  delete env.COWORK_SESSION_ID;
  // Explicitly clear any inherited override unless the test set one.
  if (!extraEnv || extraEnv.MINDRIAN_STATUSLINE_FALLBACK_ECHO === undefined) {
    delete env.MINDRIAN_STATUSLINE_FALLBACK_ECHO;
  }
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: room,
    env: env,
    encoding: 'utf8',
    input: JSON.stringify({
      hook_event_name: 'SessionStart',
      workspace: { current_dir: room },
    }),
  });
}

function hasEcho(envObj) {
  return !!(envObj && envObj.hookSpecificOutput && envObj.hookSpecificOutput.additionalContext);
}

function rm(p) { fs.rmSync(p, { recursive: true, force: true }); }

let passed = 0;
let failed = 0;
function pass(n) { passed += 1; console.log('PASS: ' + n); }
function failTest(n, e) { failed += 1; console.log('FAIL: ' + n + '\n    ' + (e && e.message || e)); }

// Test 1: 5 days post-install, no override -> echo (default-on within 30d)
try {
  const ctx = makeRoom(isoDaysAgo(5));
  const r = run(ctx.tmp, ctx.room, 'DESKTOP');
  assert.strictEqual(r.status, 0, 'exit 0; stderr=' + r.stderr);
  assert.ok(hasEcho(JSON.parse(r.stdout || '{}')), 'echo present within 30d');
  rm(ctx.tmp);
  pass('Test 1 (5d post-install -> echo)');
} catch (e) { failTest('Test 1 (5d post-install -> echo)', e); }

// Test 2: 35 days post-install, no override -> NO echo (default-flip)
try {
  const ctx = makeRoom(isoDaysAgo(35));
  const r = run(ctx.tmp, ctx.room, 'DESKTOP');
  assert.strictEqual(r.status, 0);
  assert.ok(!hasEcho(JSON.parse(r.stdout || '{}')), 'echo gone after 30d');
  rm(ctx.tmp);
  pass('Test 2 (35d post-install -> no echo)');
} catch (e) { failTest('Test 2 (35d post-install -> no echo)', e); }

// Test 3: 35 days post-install, explicit override on -> echo
try {
  const ctx = makeRoom(isoDaysAgo(35));
  const r = run(ctx.tmp, ctx.room, 'DESKTOP', { MINDRIAN_STATUSLINE_FALLBACK_ECHO: '1' });
  assert.strictEqual(r.status, 0);
  assert.ok(hasEcho(JSON.parse(r.stdout || '{}')),
    'explicit override on -> echo even past 30d');
  rm(ctx.tmp);
  pass('Test 3 (35d + override on -> echo)');
} catch (e) { failTest('Test 3 (35d + override on -> echo)', e); }

// Test 4: 5 days post-install, explicit override off -> NO echo
try {
  const ctx = makeRoom(isoDaysAgo(5));
  const r = run(ctx.tmp, ctx.room, 'DESKTOP', { MINDRIAN_STATUSLINE_FALLBACK_ECHO: '0' });
  assert.strictEqual(r.status, 0);
  assert.ok(!hasEcho(JSON.parse(r.stdout || '{}')), 'explicit off beats default-on');
  rm(ctx.tmp);
  pass('Test 4 (5d + override off -> no echo)');
} catch (e) { failTest('Test 4 (5d + override off -> no echo)', e); }

// Test 5: no marker file -> default-on (treat as fresh install)
try {
  const ctx = makeRoom(null);
  const r = run(ctx.tmp, ctx.room, 'DESKTOP');
  assert.strictEqual(r.status, 0);
  assert.ok(hasEcho(JSON.parse(r.stdout || '{}')), 'no marker -> default-on');
  rm(ctx.tmp);
  pass('Test 5 (no marker file -> default-on)');
} catch (e) { failTest('Test 5 (no marker file -> default-on)', e); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED');
  process.exit(1);
}
console.log('\nAll 5 tests PASS');
process.exit(0);
