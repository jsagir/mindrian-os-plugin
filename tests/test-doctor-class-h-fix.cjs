#!/usr/bin/env node
'use strict';

/*
 * Phase 95.6 D-09 -- /mos:doctor class H --fix (statusLine remediation) test.
 *
 * Owning plan: 95.6-05. RED until 95.6-05 lands the class-H --fix path in
 * scripts/doctor.cjs. Mirrors tests/test-doctor-class-g-fix.cjs.
 *
 * Contract (from 95.6-VALIDATION.md D-09 + 95.6-CONTEXT.md D-09 step 4):
 *   - given a scratch settings.json missing `statusLine`, `doctor --fix`
 *     writes the canonical MindrianOS statusLine block;
 *   - re-running `--fix` is a no-op (idempotent): the file is byte-identical
 *     the second time;
 *   - after `--fix`, `doctor --statusline-visibility --json` reports the
 *     class-H key as `status: ok`.
 *
 * The word "idempotent" appears in this header by contract (the must-haves
 * artifact spec for this file requires it). Until class H --fix exists, the
 * assertions below fail -- RED by design; 95.6-05 turns this GREEN.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');

function makeTmpHome(settingsObj) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '95.6-classH-fix-'));
  const claudeDir = path.join(tmp, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  if (settingsObj !== undefined) {
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify(settingsObj, null, 2));
  }
  return tmp;
}

function settingsPath(home) { return path.join(home, '.claude', 'settings.json'); }

function runDoctor(home, extraArgs) {
  const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home });
  delete env.CLAUDE_DESKTOP;
  env.MINDRIAN_STATUSLINE_SURFACE = 'CLI';
  const args = [DOCTOR, '--statusline-visibility', '--json'].concat(extraArgs || []);
  const r = spawnSync('node', args, { env, encoding: 'utf8' });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch (_e) { /* leave null */ }
  return { r, report };
}

function classHCheck(report) {
  if (!report || !report.checks) return undefined;
  const keys = ['install-incomplete', 'class-h', 'classH', 'install-receipt'];
  for (const k of keys) {
    if (report.checks[k] !== undefined) return report.checks[k];
  }
  return undefined;
}

function rmTmp(t) { try { fs.rmSync(t, { recursive: true, force: true }); } catch (_) { /* best-effort */ } }

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + ((err && err.message) || err)); }

// Test 1: --fix on a settings.json missing statusLine writes the canonical block.
let homeForReuse = null;
try {
  const home = makeTmpHome({ agent: 'larry-extended' });
  homeForReuse = home;
  runDoctor(home, ['--fix']);
  const after = JSON.parse(fs.readFileSync(settingsPath(home), 'utf8'));
  assert.ok(after.statusLine, '--fix wrote a statusLine block (RED until 95.6-05)');
  assert.strictEqual(after.statusLine.type, 'command', 'statusLine.type === command');
  assert.match(String(after.statusLine.command || ''), /statusline-mos/,
    'statusLine.command references the statusline-mos wrapper; got ' + JSON.stringify(after.statusLine.command));
  pass('Test 1 (--fix writes canonical statusLine block)');
} catch (err) { failTest('Test 1 (--fix writes canonical statusLine block)', err); }

// Test 2: re-running --fix is idempotent (byte-identical settings.json).
try {
  assert.ok(homeForReuse, 'Test 1 produced a home dir to reuse');
  const before = fs.readFileSync(settingsPath(homeForReuse), 'utf8');
  runDoctor(homeForReuse, ['--fix']);
  const afterAgain = fs.readFileSync(settingsPath(homeForReuse), 'utf8');
  assert.strictEqual(afterAgain, before, 'second --fix run is a no-op: settings.json is byte-identical');
  pass('Test 2 (--fix is idempotent on re-run)');
} catch (err) { failTest('Test 2 (--fix is idempotent on re-run)', err); }

// Test 3: after --fix, --statusline-visibility --json reports class H ok.
try {
  assert.ok(homeForReuse, 'Test 1 produced a home dir to reuse');
  const { report } = runDoctor(homeForReuse);
  const c = classHCheck(report);
  assert.ok(c, 'class H check key present after --fix (RED until 95.6-05)');
  assert.strictEqual(c.status, 'ok', 'class H status ok after --fix; got ' + c.status);
  rmTmp(homeForReuse);
  pass('Test 3 (post-fix class H -> ok)');
} catch (err) { failTest('Test 3 (post-fix class H -> ok)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (expected RED until Plan 95.6-05 lands class H --fix)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
