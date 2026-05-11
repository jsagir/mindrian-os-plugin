#!/usr/bin/env node
'use strict';

/*
 * Phase 95.6 D-09 -- /mos:doctor class H (install-incomplete) detection test.
 *
 * Owning plan: 95.6-05. RED until 95.6-05 lands class H in scripts/doctor.cjs.
 * This file encodes the D-09 behavioral contract from 95.6-VALIDATION.md:
 * "the audit calls it class H -- install incomplete -- which subsumes the
 *  missing-statusLine case." A halted install.sh (D-03 bug) never reaches the
 * statusLine registration step, so settings.json lands without a `statusLine`
 * key. Class H must catch that and name it.
 *
 * Hermetic envelope: mirrors tests/test-doctor-class-g.cjs -- per-test
 * fs.mkdtempSync scratch HOME + USERPROFILE override so the detector reads
 * scratch ~/.claude/settings.json. MINDRIAN_STATUSLINE_SURFACE=CLI is forced
 * so the non-TTY spawnSync child is not reclassified to DESKTOP (same carve-out
 * the class-G suite uses post-Plan-106-04).
 *
 * Until class H exists in doctor.cjs, the `--statusline-visibility --json`
 * report has no `class-h` / `install-incomplete` key, so the assertions below
 * fail. That is the RED-by-design contract; 95.6-05 turns this GREEN.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');

// The canonical MindrianOS statusLine block install.sh's register_statusline()
// writes (D-09 / 95.6-05). Shape mirrors the existing class-G command-target
// convention (a `bash "<install-dir>/scripts/statusline-mos"` command).
const CANONICAL_STATUSLINE = {
  type: 'command',
  command: 'bash "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-mos"',
};

function makeTmpHome(settingsObj) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), '95.6-classH-'));
  const claudeDir = path.join(tmp, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  if (settingsObj !== undefined) {
    fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify(settingsObj, null, 2));
  }
  return tmp;
}

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

// Class H check may be keyed under any of these names depending on how 95.6-05
// slots it into the doctor taxonomy. Accept the first one present.
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

// Test 1: settings.json WITH a canonical statusLine block -> class H reports ok.
try {
  const home = makeTmpHome({ agent: 'larry-extended', statusLine: CANONICAL_STATUSLINE });
  const { r, report } = runDoctor(home);
  assert.strictEqual(r.status, 0, 'doctor exits 0; got ' + r.status);
  assert.ok(report && report.checks, 'JSON parses + checks key present');
  const c = classHCheck(report);
  assert.ok(c, 'class H check key present (RED until 95.6-05 lands it)');
  assert.strictEqual(c.status, 'ok', 'expected status ok with a canonical statusLine block; got ' + c.status);
  rmTmp(home);
  pass('Test 1 (settings.json with statusLine -> class H ok)');
} catch (err) { failTest('Test 1 (settings.json with statusLine -> class H ok)', err); }

// Test 2: settings.json present but WITHOUT a statusLine key -> class H warn/error,
// recoverable, detail names the missing statusLine block.
try {
  const home = makeTmpHome({ agent: 'larry-extended', env: { MINDRIAN_OS_ROOT: '/tmp/fake' } });
  const { r, report } = runDoctor(home);
  assert.strictEqual(r.status, 0, 'doctor exits 0; got ' + r.status);
  const c = classHCheck(report);
  assert.ok(c, 'class H check key present (RED until 95.6-05 lands it)');
  assert.ok(c.status === 'warn' || c.status === 'error', 'expected warn or error for missing statusLine; got ' + c.status);
  assert.strictEqual(c.recoverable, true, 'expected recoverable=true (statusLine block can be written)');
  assert.match(String(c.detail || ''), /statusLine block missing|statusLine.*missing|install incomplete/i,
    'detail names the missing statusLine block / install-incomplete; got ' + JSON.stringify(c.detail));
  rmTmp(home);
  pass('Test 2 (settings.json without statusLine -> class H warn, recoverable)');
} catch (err) { failTest('Test 2 (settings.json without statusLine -> class H warn, recoverable)', err); }

// Test 3: --all activates the class H key in report.checks.
try {
  const home = makeTmpHome({ agent: 'larry-extended', statusLine: CANONICAL_STATUSLINE });
  const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home });
  delete env.CLAUDE_DESKTOP;
  env.MINDRIAN_STATUSLINE_SURFACE = 'CLI';
  const r = spawnSync('node', [DOCTOR, '--all', '--json'], { env, encoding: 'utf8' });
  let report = null;
  try { report = JSON.parse(r.stdout); } catch (_e) { /* leave null */ }
  assert.ok(report && report.checks, 'JSON parses');
  assert.ok(classHCheck(report), '--all activates the class H key (RED until 95.6-05)');
  rmTmp(home);
  pass('Test 3 (--all activates class H)');
} catch (err) { failTest('Test 3 (--all activates class H)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (expected RED until Plan 95.6-05 lands class H)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
