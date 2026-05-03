#!/usr/bin/env node
'use strict';
/*
 * Phase 106-01 D-01 STATUS-106-01 -- Hermetic test suite for
 * scripts/migrate-stale-user-settings.cjs.
 *
 * Six tests cover the migrator's full surface:
 *   1. detect    -- --auto on stale fixture emits warning envelope, file unchanged
 *   2. clean     -- --auto on clean fixture emits {continue:true}, no warning
 *   3. no-file   -- --auto when settings.json absent, emits {continue:true}
 *   4. apply     -- --apply on stale fixture removes statusLine + creates backup
 *   5. idempotent -- second --apply is no-op (no new backup, file unchanged)
 *   6. disabled  -- --auto when disableAllHooks=true emits distinct guidance
 *
 * Hermeticity strategy (Phase 95.1 D-05 pattern): each test creates a tmp dir
 * with fs.mkdtempSync, points HOME + USERPROFILE at it via spawn env, copies
 * the fixture into tmp/.claude/settings.json, then recursively rms after.
 *
 * Replaces the Phase 100 canonical Wave 0 stub at this path.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'migrate-stale-user-settings.cjs');
const FIXTURES = path.join(REPO_ROOT, 'test', 'fixtures');

function makeTmpHome(fixtureSubdir) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '106-01-'));
  const claudeDir = path.join(tmp, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  if (fixtureSubdir) {
    const src = path.join(FIXTURES, fixtureSubdir, 'settings.json');
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(claudeDir, 'settings.json'));
    }
  }
  return tmp;
}

function runScript(home, ...args) {
  return spawnSync('node', [SCRIPT, ...args], {
    env: { ...process.env, HOME: home, USERPROFILE: home },
    encoding: 'utf8',
  });
}

function rmTmp(tmp) {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// Test 1: detect emits warning envelope; file unchanged
{
  const tmp = makeTmpHome('statusline-visibility-stale-settings');
  const settingsPath = path.join(tmp, '.claude', 'settings.json');
  const settingsBefore = fs.readFileSync(settingsPath, 'utf8');
  const r = runScript(tmp, '--auto', '--quiet');
  assert.strictEqual(r.status, 0, 'exit 0');
  let env;
  try {
    env = JSON.parse(r.stdout);
  } catch (e) {
    assert.fail('stdout not parseable as JSON: ' + JSON.stringify(r.stdout));
  }
  assert.strictEqual(env.continue, true, 'continue=true');
  assert.ok(env.hookSpecificOutput, 'has hookSpecificOutput');
  assert.match(
    env.hookSpecificOutput.additionalContext || '',
    /MindrianOS settings drift detected/,
    'additionalContext mentions drift'
  );
  const settingsAfter = fs.readFileSync(settingsPath, 'utf8');
  assert.strictEqual(settingsAfter, settingsBefore, 'settings.json unchanged in --auto mode');
  rmTmp(tmp);
  console.log('PASS: Test 1 (detect emits warning, file unchanged)');
}

// Test 2: clean fixture, no warning
{
  const tmp = makeTmpHome('statusline-visibility-clean');
  const r = runScript(tmp, '--auto', '--quiet');
  assert.strictEqual(r.status, 0);
  const env = JSON.parse(r.stdout);
  assert.strictEqual(env.continue, true);
  assert.ok(
    !env.hookSpecificOutput || !env.hookSpecificOutput.additionalContext,
    'no additionalContext on clean settings'
  );
  rmTmp(tmp);
  console.log('PASS: Test 2 (clean fixture)');
}

// Test 3: no settings.json at all
{
  const tmp = makeTmpHome(null);
  const r = runScript(tmp, '--auto', '--quiet');
  assert.strictEqual(r.status, 0);
  const env = JSON.parse(r.stdout);
  assert.strictEqual(env.continue, true);
  rmTmp(tmp);
  console.log('PASS: Test 3 (no settings.json)');
}

// Test 4: --apply removes stale entry + creates backup
{
  const tmp = makeTmpHome('statusline-visibility-stale-settings');
  const r = runScript(tmp, '--apply');
  assert.strictEqual(r.status, 0);
  const settings = JSON.parse(fs.readFileSync(path.join(tmp, '.claude', 'settings.json'), 'utf8'));
  assert.ok(!('statusLine' in settings), 'statusLine removed');
  const backups = fs
    .readdirSync(path.join(tmp, '.claude'))
    .filter(n => n.startsWith('settings.json.bak.'));
  assert.ok(backups.length >= 1, 'backup created');
  rmTmp(tmp);
  console.log('PASS: Test 4 (--apply removes stale entry + creates backup)');
}

// Test 5: idempotency -- second --apply is no-op
{
  const tmp = makeTmpHome('statusline-visibility-stale-settings');
  runScript(tmp, '--apply');
  const after1 = fs.readFileSync(path.join(tmp, '.claude', 'settings.json'), 'utf8');
  const backups1 = fs
    .readdirSync(path.join(tmp, '.claude'))
    .filter(n => n.startsWith('settings.json.bak.'));
  runScript(tmp, '--apply');
  const after2 = fs.readFileSync(path.join(tmp, '.claude', 'settings.json'), 'utf8');
  const backups2 = fs
    .readdirSync(path.join(tmp, '.claude'))
    .filter(n => n.startsWith('settings.json.bak.'));
  assert.strictEqual(after1, after2, 'second --apply is no-op');
  assert.strictEqual(backups1.length, backups2.length, 'no second backup on no-op');
  rmTmp(tmp);
  console.log('PASS: Test 5 (idempotent)');
}

// Test 6: disableAllHooks branch
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '106-01-'));
  fs.mkdirSync(path.join(tmp, '.claude'), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, '.claude', 'settings.json'),
    JSON.stringify({ disableAllHooks: true })
  );
  const r = runScript(tmp, '--auto', '--quiet');
  assert.strictEqual(r.status, 0);
  const env = JSON.parse(r.stdout);
  assert.strictEqual(env.continue, true);
  assert.ok(env.hookSpecificOutput, 'has hookSpecificOutput');
  assert.match(
    env.hookSpecificOutput.additionalContext || '',
    /MindrianOS hooks are disabled/,
    'additionalContext mentions disableAllHooks guidance'
  );
  rmTmp(tmp);
  console.log('PASS: Test 6 (disableAllHooks message)');
}

console.log('All 6 tests PASS');
process.exit(0);
