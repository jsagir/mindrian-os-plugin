#!/usr/bin/env node
'use strict';

/*
 * Phase 95.6 D-09 / R-01 -- install-receipt contract test.
 *
 * Owning plan: 95.6-05. RED until 95.6-05 lands the .install-receipt.json
 * write in install.sh AND the doctor class-H reader that consumes it.
 *
 * Contract (from 95.6-CONTEXT.md D-09 + 95.6-02-PLAN.md must-haves):
 *   - install.sh writes ~/.claude/plugins/mindrian-os/.install-receipt.json
 *     listing every install step it ran, with each step's exit code;
 *   - a *complete* receipt (all canonical steps, exit 0) -> doctor class H
 *     reads it and reports no gap;
 *   - a *halted* receipt (only the steps before the skill-loop) -> doctor
 *     class H reads it and names the missing tail steps BY NAME
 *     (e.g. "register_statusline did not run").
 *
 * Canonical step list (so 95.6-03/05 implement install.sh to match):
 *   preflight, clone, register_statusline, register_commands,
 *   register_skills, register_agents, configure_hooks
 *
 * Hermetic via MINDRIAN_PLUGIN_HOME (mirrors tests/test-doctor-atomic-swap.cjs):
 * a scratch ~/.claude/plugins tree under /tmp, with the receipt placed at
 * <scratch>/mindrian-os/.install-receipt.json.
 *
 * Until install.sh writes the receipt and doctor reads it, the assertions
 * below fail -- RED by design; 95.6-05 turns this GREEN.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO_ROOT, 'scripts', 'doctor.cjs');

// Canonical install-receipt step order. install.sh (95.6-05) MUST emit these
// names; doctor class H names any missing tail step from this list.
const CANONICAL_STEPS = [
  'preflight',
  'clone',
  'register_statusline',
  'register_commands',
  'register_skills',
  'register_agents',
  'configure_hooks',
];

const PLUGIN_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version;
  } catch (_e) { return '0.0.0'; }
})();

function makeScratchPluginHome(suffix) {
  const base = path.join(os.tmpdir(), 'mos-install-receipt-' + Date.now().toString(36) + '-' + suffix);
  fs.mkdirSync(path.join(base, 'mindrian-os', '.claude-plugin'), { recursive: true });
  fs.writeFileSync(
    path.join(base, 'mindrian-os', '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: 'mos', version: PLUGIN_VERSION }, null, 2),
  );
  return base;
}

function writeReceipt(scratch, receipt) {
  fs.writeFileSync(
    path.join(scratch, 'mindrian-os', '.install-receipt.json'),
    JSON.stringify(receipt, null, 2),
  );
}

function completeReceipt() {
  return {
    version: PLUGIN_VERSION,
    completed_at: new Date().toISOString(),
    steps: CANONICAL_STEPS.map((name) => ({ name, exit: 0 })),
  };
}

function haltedReceipt() {
  // Halted after `clone`, before the skill-loop -- exactly Gary's symptom.
  const ran = ['preflight', 'clone'];
  return {
    version: PLUGIN_VERSION,
    completed_at: null,
    steps: ran.map((name) => ({ name, exit: 0 })),
  };
}

function runDoctor(pluginHome, extraArgs) {
  const env = Object.assign({}, process.env, { MINDRIAN_PLUGIN_HOME: pluginHome });
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

function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* best-effort */ } }

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + ((err && err.message) || err)); }

// Test 0 (always GREEN): the receipt-shape fixtures themselves conform to the
// canonical step list. This documents the contract even before 95.6-05 lands.
try {
  const cr = completeReceipt();
  assert.strictEqual(typeof cr.version, 'string', 'receipt.version is a string');
  assert.ok('completed_at' in cr, 'receipt has completed_at');
  assert.deepStrictEqual(cr.steps.map((s) => s.name), CANONICAL_STEPS, 'complete receipt has all canonical steps in order');
  assert.ok(cr.steps.every((s) => s.exit === 0), 'complete receipt: every step exit 0');
  const hr = haltedReceipt();
  assert.deepStrictEqual(hr.steps.map((s) => s.name), ['preflight', 'clone'], 'halted receipt has only the pre-skill-loop steps');
  assert.strictEqual(hr.completed_at, null, 'halted receipt completed_at is null');
  pass('Test 0 (receipt fixtures conform to canonical step list)');
} catch (err) { failTest('Test 0 (receipt fixtures conform to canonical step list)', err); }

// Test 1: complete-install fixture -> doctor class H reports no gap.
try {
  const scratch = makeScratchPluginHome('complete');
  writeReceipt(scratch, completeReceipt());
  const { report } = runDoctor(scratch);
  const c = classHCheck(report);
  assert.ok(c, 'class H check key present (RED until 95.6-05 lands the receipt reader)');
  assert.strictEqual(c.status, 'ok', 'class H ok when receipt is complete; got ' + c.status);
  rmrf(scratch);
  pass('Test 1 (complete receipt -> class H ok)');
} catch (err) { failTest('Test 1 (complete receipt -> class H ok)', err); }

// Test 2: halted-install fixture -> doctor class H names the missing tail steps.
try {
  const scratch = makeScratchPluginHome('halted');
  writeReceipt(scratch, haltedReceipt());
  const { report } = runDoctor(scratch);
  const c = classHCheck(report);
  assert.ok(c, 'class H check key present (RED until 95.6-05)');
  assert.ok(c.status === 'warn' || c.status === 'error', 'class H warn/error for a halted install; got ' + c.status);
  assert.match(String(c.detail || ''), /register_statusline/,
    'class H detail names register_statusline as a missing tail step; got ' + JSON.stringify(c.detail));
  rmrf(scratch);
  pass('Test 2 (halted receipt -> class H names register_statusline gap)');
} catch (err) { failTest('Test 2 (halted receipt -> class H names register_statusline gap)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (expected RED until Plan 95.6-05 lands .install-receipt.json + the doctor reader)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
