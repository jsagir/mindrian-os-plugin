#!/usr/bin/env node
'use strict';

/*
 * Phase 106-03 Task 3 -- /mos:doctor class G --fix integration test.
 *
 * Three tests verify the --fix dispatch (RESEARCH §4.3):
 *   1. stale fixture + --fix -> migrator runs, recovered[] records the fix
 *      with the locked-language action string, settings.json statusLine
 *      key removed, backup file created, post-fix re-check returns 'ok'.
 *   2. clean fixture + --fix -> no migrator entry in recovered[] (the
 *      --fix gate is keyed on status='warn' AND recoverable=true; clean
 *      fixture's status is 'ok', so the migrator must NOT be invoked).
 *   3. disableAllHooks fixture + --fix -> recoverable=false gates the
 *      migrator. recovered[] does NOT contain a migrate-stale-user-settings
 *      entry. Post-fix status remains 'warn'.
 *
 * Locked language asserted in Test 1 per RESEARCH Open Question #6:
 *   'removes stale user-settings.json statusLine override so plugin-level
 *    config takes effect'
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '106-03-fix-'));
  const claudeDir = path.join(tmp, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  if (fixtureSubdir) {
    const src = path.join(FIXTURES, fixtureSubdir, 'settings.json');
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(claudeDir, 'settings.json'));
  }
  return tmp;
}

function runDoctor(home, extraArgs) {
  const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home });
  delete env.CLAUDE_DESKTOP;
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

// Test 1: stale + --fix -> recovered records migrator, settings cleaned, backup exists
try {
  const home = makeTmpHome('statusline-visibility-stale-settings');
  const { report } = runDoctor(home, ['--fix']);
  assert.ok(report, 'JSON parses');
  const recovered = report.recovered || [];
  const migratorEntry = recovered.find(function (e) { return e && e.tool === 'migrate-stale-user-settings'; });
  assert.ok(migratorEntry, 'recovered contains migrate-stale-user-settings entry');
  assert.match(migratorEntry.action,
    /removes stale user-settings\.json statusLine override so plugin-level config takes effect/,
    'action carries locked language verbatim');
  // Post-fix re-check should be ok
  assert.strictEqual(report.checks['statusline-visibility'].status, 'ok',
    'post-fix re-check status is ok; got ' + report.checks['statusline-visibility'].status);
  // settings.json no longer has statusLine
  const settingsRaw = fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8');
  const settings = JSON.parse(settingsRaw);
  assert.ok(!('statusLine' in settings), 'statusLine key removed from settings.json');
  // backup file created
  const backups = fs.readdirSync(path.join(home, '.claude'))
    .filter(function (n) { return n.indexOf('settings.json.bak.') === 0; });
  assert.ok(backups.length >= 1, 'at least one backup file created (got ' + backups.length + ')');
  rmTmp(home);
  pass('Test 1 (stale + --fix -> ok, settings cleaned, backup exists, locked language present)');
} catch (err) { failTest('Test 1 (stale + --fix -> ok)', err); }

// Test 2: clean + --fix -> no migrator invocation
try {
  const home = makeTmpHome('statusline-visibility-clean');
  const { report } = runDoctor(home, ['--fix']);
  const migratorEntries = (report.recovered || [])
    .filter(function (e) { return e && e.tool === 'migrate-stale-user-settings'; });
  assert.strictEqual(migratorEntries.length, 0,
    'no migrator entry on clean fixture; got ' + migratorEntries.length);
  rmTmp(home);
  pass('Test 2 (clean + --fix -> no migrator invocation)');
} catch (err) { failTest('Test 2 (clean + --fix -> no migrator invocation)', err); }

// Test 3: disableAllHooks + --fix -> recoverable=false gates the migrator
try {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), '106-03-fix-disable-'));
  fs.mkdirSync(path.join(home, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(home, '.claude', 'settings.json'),
    JSON.stringify({ disableAllHooks: true }));
  const { report } = runDoctor(home, ['--fix']);
  const migratorEntries = (report.recovered || [])
    .filter(function (e) { return e && e.tool === 'migrate-stale-user-settings'; });
  assert.strictEqual(migratorEntries.length, 0,
    'recoverable=false must gate migrator; got ' + migratorEntries.length + ' entries');
  assert.strictEqual(report.checks['statusline-visibility'].status, 'warn',
    'status remains warn after --fix gate; got ' + report.checks['statusline-visibility'].status);
  rmTmp(home);
  pass('Test 3 (disableAllHooks + --fix -> recoverable gate prevents migrator)');
} catch (err) { failTest('Test 3 (disableAllHooks + --fix -> recoverable gate prevents migrator)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED');
  process.exit(1);
}
console.log('\nAll 3 tests PASS');
process.exit(0);
