#!/usr/bin/env node
'use strict';

/*
 * Phase 106-03 Task 2 -- /mos:doctor class G detection test.
 *
 * Six tests exercise the four-branch detector (RESEARCH §4.3) plus the
 * --all activation gate and the Desktop skip carve-out:
 *   1. clean fixture in HOME -> status='ok'
 *   2. stale user-settings fixture -> status='warn' + recoverable=true
 *   3. broken plugin pointer (CLAUDE_PLUGIN_ROOT override) -> status='error'
 *   4. disableAllHooks=true -> status='warn' + recoverable=false
 *   5. CLAUDE_DESKTOP=1 -> status='skip'
 *   6. --all activates class G key in checks
 *
 * Hermetic envelope: per-test mkdtempSync HOME + USERPROFILE override so
 * the detector reads scratch ~/.claude/settings.json. Mirrors Plan 106-01
 * Task 3 makeTmpHome pattern (see tests/test-stale-settings-migration.cjs
 * once it lands).
 *
 * Registered in lib/memory/run-feynman-tests.cjs (Plan 106-00 Task 3).
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');
const FIXTURES = path.join(REPO_ROOT, 'test', 'fixtures');

function makeTmpHome(fixtureSubdir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '106-03-'));
  const claudeDir = path.join(tmp, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  if (fixtureSubdir) {
    const src = path.join(FIXTURES, fixtureSubdir, 'settings.json');
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(claudeDir, 'settings.json'));
  }
  return tmp;
}

function runDoctor(home, extraEnv, extraArgs) {
  const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home }, extraEnv || {});
  // Ensure CLAUDE_DESKTOP is unset by default (process.env may carry it from a
  // previous invocation in the same shell). Tests that want it set pass it via
  // extraEnv.
  if (!extraEnv || extraEnv.CLAUDE_DESKTOP === undefined) {
    delete env.CLAUDE_DESKTOP;
  }
  // Plan 106-04 swapped doctor.cjs Step 0 from a bare CLAUDE_DESKTOP=1 probe to
  // the canonical lib/statusline/surface-detect.cjs helper, which treats non-TTY
  // child processes as DESKTOP by safe default (and would skip class G). Tests
  // 1-4 below exercise the four detection branches AS IF the doctor is running
  // on CLI. Force the surface explicitly so child-process spawnSync (no TTY)
  // does not get reclassified to DESKTOP. Tests that want a non-CLI surface
  // (Test 5: CLAUDE_DESKTOP=1 -> skip) opt out by passing CLAUDE_DESKTOP via
  // extraEnv; in that case we do NOT inject the SURFACE override so the
  // CLAUDE_DESKTOP probe still drives the detector.
  const wantsNonCli = extraEnv
    && (extraEnv.CLAUDE_DESKTOP !== undefined
        || extraEnv.COWORK_SESSION_ID !== undefined
        || extraEnv.MINDRIAN_STATUSLINE_SURFACE !== undefined);
  if (!wantsNonCli) {
    env.MINDRIAN_STATUSLINE_SURFACE = 'CLI';
  }
  const args = [DOCTOR, '--statusline-visibility', '--json'].concat(extraArgs || []);
  const r = spawnSync('node', args, { env, encoding: 'utf8' });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch (_e) { /* leave null */ }
  return { r, report };
}

function rmTmp(t) {
  try { fs.rmSync(t, { recursive: true, force: true }); } catch (_) { /* best-effort */ }
}

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + (err && err.message || err)); }

// Test 1: clean settings -> status='ok' (uses real plugin install; statusline-mos resolves)
try {
  const home = makeTmpHome('statusline-visibility-clean');
  const { r, report } = runDoctor(home);
  assert.strictEqual(r.status, 0, 'doctor exits 0; got ' + r.status);
  assert.ok(report && report.checks, 'JSON parses + checks key present');
  assert.strictEqual(report.checks['statusline-visibility'].status, 'ok',
    'expected ok; got ' + report.checks['statusline-visibility'].status);
  rmTmp(home);
  pass('Test 1 (clean fixture -> ok)');
} catch (err) { failTest('Test 1 (clean fixture -> ok)', err); }

// Test 2: stale user-settings fixture -> status='warn' + recoverable=true
try {
  const home = makeTmpHome('statusline-visibility-stale-settings');
  const { r, report } = runDoctor(home);
  assert.strictEqual(r.status, 0);
  const c = report.checks['statusline-visibility'];
  assert.strictEqual(c.status, 'warn', 'expected warn; got ' + c.status);
  assert.match(c.detail, /stale user-settings/);
  assert.strictEqual(c.recoverable, true, 'expected recoverable=true');
  rmTmp(home);
  pass('Test 2 (stale user-settings -> warn, recoverable)');
} catch (err) { failTest('Test 2 (stale user-settings -> warn, recoverable)', err); }

// Test 3: broken plugin pointer -> status='error'
// Strategy: point CLAUDE_PLUGIN_ROOT at a tmp dir whose settings.json
// statusLine.command references a non-existent script under that root.
try {
  const home = makeTmpHome('statusline-visibility-clean');
  const fakeRoot = fs.mkdtempSync(path.join(os.tmpdir(), '106-03-fakeroot-'));
  fs.mkdirSync(path.join(fakeRoot, 'scripts'), { recursive: true });
  // No statusline-mos AND no resolvable command target.
  fs.writeFileSync(path.join(fakeRoot, 'settings.json'), JSON.stringify({
    statusLine: { type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/scripts/does-not-exist"' },
  }));
  const { report } = runDoctor(home, { CLAUDE_PLUGIN_ROOT: fakeRoot });
  const c = report.checks['statusline-visibility'];
  assert.strictEqual(c.status, 'error', 'expected error; got ' + c.status);
  assert.match(c.detail, /plugin install corrupt/);
  rmTmp(home); rmTmp(fakeRoot);
  pass('Test 3 (broken plugin pointer -> error)');
} catch (err) { failTest('Test 3 (broken plugin pointer -> error)', err); }

// Test 4: disableAllHooks=true -> warn + recoverable=false
try {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), '106-03-disable-'));
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'),
    JSON.stringify({ disableAllHooks: true }));
  const { report } = runDoctor(home);
  const c = report.checks['statusline-visibility'];
  assert.strictEqual(c.status, 'warn', 'expected warn; got ' + c.status);
  assert.strictEqual(c.recoverable, false, 'expected recoverable=false');
  assert.match(c.detail, /disableAllHooks/);
  rmTmp(home);
  pass('Test 4 (disableAllHooks -> warn, not recoverable)');
} catch (err) { failTest('Test 4 (disableAllHooks -> warn, not recoverable)', err); }

// Test 5: CLAUDE_DESKTOP=1 -> status='skip'
try {
  const home = makeTmpHome('statusline-visibility-clean');
  const { report } = runDoctor(home, { CLAUDE_DESKTOP: '1' });
  assert.strictEqual(report.checks['statusline-visibility'].status, 'skip',
    'expected skip; got ' + report.checks['statusline-visibility'].status);
  rmTmp(home);
  pass('Test 5 (CLAUDE_DESKTOP=1 -> skip)');
} catch (err) { failTest('Test 5 (CLAUDE_DESKTOP=1 -> skip)', err); }

// Test 6: --all activates class G key
try {
  const home = makeTmpHome('statusline-visibility-clean');
  const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home });
  delete env.CLAUDE_DESKTOP;
  const r = spawnSync('node', [DOCTOR, '--all', '--json'], { env, encoding: 'utf8' });
  const report = JSON.parse(r.stdout);
  assert.ok(report.checks['statusline-visibility'], '--all activates class G key');
  rmTmp(home);
  pass('Test 6 (--all activates class G)');
} catch (err) { failTest('Test 6 (--all activates class G)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED');
  process.exit(1);
}
console.log('\nAll 6 tests PASS');
process.exit(0);
