#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 260705-jeq Task 2 -- tests for the doctor --report-registration-bug
 * sibling mode (D-01, D-02).
 *
 * The mode is DIAGNOSTIC-ONLY: it assembles a paste-ready Anthropic bug report
 * proving every locally-checkable cause of "valid install yet a command did not
 * register" is CLEAN. It must never claim a "healthy"/"fixed" status, must exit 0
 * whenever the report assembles (even offline), and must never leak the invalid
 * "supabase" control (the valid control is generic per every-mos-command-unknown.md).
 *
 * Test map:
 *   1. Human mode: exit 0.
 *   2. Human mode: carries the escalate-to-Anthropic label, all 7 ruled-out line
 *      markers, and both provenance paths.
 *   3. Human mode: output does NOT match /healthy/i, does NOT match /\bfixed\b/i,
 *      does NOT contain "supabase".
 *   4. JSON mode: exit 0, JSON.parses, carries the same top-level keys.
 *
 * Spawns the real doctor.cjs (Canon Part 8: LOCAL only, offline-safe).
 */

const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO, 'scripts', 'doctor.cjs');

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) { failed += 1; console.log('FAIL: ' + name + '\n    ' + ((err && err.message) || err)); }

function runDoctor(extraArgs) {
  return spawnSync('node', [DOCTOR, '--report-registration-bug'].concat(extraArgs || []), {
    encoding: 'utf8', timeout: 60000,
  });
}

// The 7 ruled-out cause markers the report must surface, in the D-02 contract.
const RULED_OUT_MARKERS = [
  'install-cache drift',
  'enabledPlugins silent-disable',
  'legacy config.json pin',
  'marketplace clone git-dirty',
  'version-of-record legs',
  'command files present',
  'static precondition sweep',
];
const PROVENANCE = [
  '.planning/debug/every-mos-command-unknown.md',
  '.planning/debug/windows-install-update-ux.md',
];

const human = runDoctor([]);

// -- Test 1: human mode exits 0 ----------------------------------------------
try {
  assert.strictEqual(human.status, 0, 'exit 0; got ' + human.status + ' :: ' + (human.stderr || '').slice(0, 300));
  pass('Test 1 (human mode exits 0)');
} catch (err) { failTest('Test 1 (human mode exits 0)', err); }

// -- Test 2: escalate label + 7 markers + provenance -------------------------
try {
  const out = human.stdout || '';
  assert.ok(/escalate to Anthropic/i.test(out), 'carries the escalate-to-Anthropic label');
  const missingMarker = RULED_OUT_MARKERS.filter((m) => out.indexOf(m) === -1);
  assert.strictEqual(missingMarker.length, 0, 'all 7 ruled-out markers present; missing: ' + JSON.stringify(missingMarker));
  const missingProv = PROVENANCE.filter((p) => out.indexOf(p) === -1);
  assert.strictEqual(missingProv.length, 0, 'both provenance paths present; missing: ' + JSON.stringify(missingProv));
  pass('Test 2 (escalate label + all 7 ruled-out markers + both provenance paths)');
} catch (err) { failTest('Test 2 (escalate label + markers + provenance)', err); }

// -- Test 3: no status claim, no supabase ------------------------------------
try {
  const out = human.stdout || '';
  assert.ok(!/healthy/i.test(out), 'output does NOT claim "healthy"');
  assert.ok(!/\bfixed\b/i.test(out), 'output does NOT claim "fixed"');
  assert.ok(out.indexOf('supabase') === -1, 'output does NOT contain the invalid "supabase" control');
  pass('Test 3 (diagnostic-only: no healthy/fixed status claim, no supabase)');
} catch (err) { failTest('Test 3 (no status claim, no supabase)', err); }

// -- Test 4: JSON mode exit 0, parses, same top-level keys -------------------
try {
  const j = runDoctor(['--json']);
  assert.strictEqual(j.status, 0, 'json mode exit 0; got ' + j.status + ' :: ' + (j.stderr || '').slice(0, 300));
  const obj = JSON.parse(j.stdout);
  for (const key of ['mode', 'escalation', 'environment', 'ruled_out', 'control_test', 'provenance']) {
    assert.ok(Object.prototype.hasOwnProperty.call(obj, key), 'json carries top-level key "' + key + '"');
  }
  assert.strictEqual(obj.ruled_out.length, 7, 'json ruled_out carries all 7 causes');
  assert.ok(!/supabase/i.test(j.stdout), 'json output does NOT contain "supabase"');
  assert.ok(!/healthy/i.test(j.stdout), 'json output does NOT claim "healthy"');
  pass('Test 4 (json mode: exit 0, parses, same top-level keys, 7 causes)');
} catch (err) { failTest('Test 4 (json mode)', err); }

if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
