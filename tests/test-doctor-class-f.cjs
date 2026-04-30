#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 95.1-02 -- RED skeleton for /mos:doctor class F detector
 * (UI Ruling System compliance scanner).
 *
 * Covers: DOCTOR-95.1-04.
 *
 * Behavior asserted (Wave 1 Plan 95.1-07 will implement
 * checkUIRulingCompliance() in scripts/doctor.cjs):
 *   1. Fake commands/ dir under scratch with one .md containing
 *      `body_shape: E (Action Report)` and one without
 *      -> only the missing-body_shape file is flagged
 *   2. Fake scripts/ dir with a .cjs file containing the box char `╭`
 *      -> flagged as box-char violation
 *   3. Fake scripts/ dir with `✗`
 *      -> flagged as glyph-vocabulary violation
 *   4. Approved glyphs only (■ ✓ ⚠ ⬜ ⚡ ▶ ▷ →)
 *      -> no flags
 *
 * Note: Class F detector has --fix deferred (D-13). Tests assert detection
 * only.
 *
 * IIFE harness pattern from tests/test-cascade-side-channel.cjs.
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const DOCTOR = path.join(REPO, 'scripts', 'doctor.cjs');

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) {
    process.stdout.write('    ' + (err.message || String(err)) + '\n');
  }
}

// ---------- Sandbox helpers ----------

function makeScratchDir(suffix) {
  const base = path.join(
    os.tmpdir(),
    'mos-doctor-class-f-' + Date.now().toString(36) + '-' + suffix
  );
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (_) { /* best-effort */ }
}

function runDoctorJson(scratch, args) {
  // For class F the scanner takes a --scan-dir override so the test can
  // point the detector at the scratch fake commands/ + scripts/ trees
  // rather than the real REPO ones. Wave 1 Plan 95.1-07 wires this.
  const opts = {
    encoding: 'utf8',
    timeout: 8000,
    env: Object.assign({}, process.env, { MINDRIAN_ROOMS_HOME: scratch }),
  };
  assert.equal(typeof opts.env.MINDRIAN_ROOMS_HOME, 'string',
    'Test must set MINDRIAN_ROOMS_HOME to scratch dir to avoid leaking into real active room');
  const res = spawnSync('node', [DOCTOR].concat(args), opts);
  return {
    stdout: res.stdout || '',
    stderr: res.stderr || '',
    status: typeof res.status === 'number' ? res.status : -1,
  };
}

// ---------- Scenarios ----------

(function test1_bodyShapeFrontmatterScan() {
  // RED: asserts behavior of checkUIRulingCompliance() which Wave 1 Plan 95.1-07 will implement
  const label = 'class F: body_shape frontmatter scan flags missing-only';
  const scratch = makeScratchDir('f-body-shape');
  try {
    const fakeCommandsDir = path.join(scratch, 'fake-commands');
    fs.mkdirSync(fakeCommandsDir, { recursive: true });
    fs.writeFileSync(path.join(fakeCommandsDir, 'compliant.md'),
      '---\nbody_shape: E (Action Report)\n---\n# compliant\n');
    fs.writeFileSync(path.join(fakeCommandsDir, 'noncompliant.md'),
      '---\nname: noncompliant\n---\n# noncompliant\n');
    const { stdout, status } = runDoctorJson(scratch,
      ['--ui-compliance', '--json', '--scan-commands=' + fakeCommandsDir]);
    assert.equal(status, 0, label + ': doctor must exit 0');
    const report = JSON.parse(stdout);
    const f = report.checks['ui-compliance'];
    assert.equal(typeof f, 'object',
      label + ': report.checks["ui-compliance"] must exist');
    assert.equal(f.status, 'warn',
      label + ': status must be "warn" when noncompliant file present');
    assert.equal(Array.isArray(f.violations), true,
      label + ': violations must be an array');
    const hits = f.violations.filter((v) =>
      v && v.file && v.file.indexOf('noncompliant.md') !== -1
        && v.kind === 'missing-body-shape');
    assert.equal(hits.length, 1,
      label + ': must flag noncompliant.md exactly once with kind missing-body-shape');
    const compliantHits = f.violations.filter((v) =>
      v && v.file && v.file.indexOf('compliant.md') !== -1);
    assert.equal(compliantHits.length, 0,
      label + ': must NOT flag compliant.md');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test2_boxCharViolation() {
  // RED: asserts behavior of checkUIRulingCompliance() which Wave 1 Plan 95.1-07 will implement
  const label = 'class F: box-char violation flagged';
  const scratch = makeScratchDir('f-box-char');
  try {
    const fakeScriptsDir = path.join(scratch, 'fake-scripts');
    fs.mkdirSync(fakeScriptsDir, { recursive: true });
    fs.writeFileSync(path.join(fakeScriptsDir, 'has-box-char.cjs'),
      '// Test fixture\nconst banner = "╭─ box ─╮";\nmodule.exports = { banner };\n');
    const { stdout, status } = runDoctorJson(scratch,
      ['--ui-compliance', '--json', '--scan-scripts=' + fakeScriptsDir]);
    assert.equal(status, 0, label + ': doctor must exit 0');
    const report = JSON.parse(stdout);
    const f = report.checks['ui-compliance'];
    assert.equal(f.status, 'warn',
      label + ': status must be "warn" when box chars present');
    const hits = (f.violations || []).filter((v) =>
      v && v.file && v.file.indexOf('has-box-char.cjs') !== -1
        && v.kind === 'unauthorized-box-char');
    assert.equal(hits.length >= 1, true,
      label + ': must flag has-box-char.cjs with kind unauthorized-box-char');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test3_unauthorizedGlyphViolation() {
  // RED: asserts behavior of checkUIRulingCompliance() which Wave 1 Plan 95.1-07 will implement
  const label = 'class F: unauthorized glyph (cross-mark) flagged';
  const scratch = makeScratchDir('f-bad-glyph');
  try {
    const fakeScriptsDir = path.join(scratch, 'fake-scripts');
    fs.mkdirSync(fakeScriptsDir, { recursive: true });
    fs.writeFileSync(path.join(fakeScriptsDir, 'has-cross-mark.cjs'),
      '// Test fixture\nconst label = "✗ fail";\nmodule.exports = { label };\n');
    const { stdout, status } = runDoctorJson(scratch,
      ['--ui-compliance', '--json', '--scan-scripts=' + fakeScriptsDir]);
    assert.equal(status, 0, label + ': doctor must exit 0');
    const report = JSON.parse(stdout);
    const f = report.checks['ui-compliance'];
    assert.equal(f.status, 'warn',
      label + ': status must be "warn" when unauthorized glyph present');
    const hits = (f.violations || []).filter((v) =>
      v && v.file && v.file.indexOf('has-cross-mark.cjs') !== -1
        && v.kind === 'unauthorized-glyph');
    assert.equal(hits.length >= 1, true,
      label + ': must flag has-cross-mark.cjs with kind unauthorized-glyph');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

(function test4_approvedGlyphsOnlyNoFlags() {
  // RED: asserts behavior of checkUIRulingCompliance() which Wave 1 Plan 95.1-07 will implement
  const label = 'class F: approved glyphs only -> no flags';
  const scratch = makeScratchDir('f-approved');
  try {
    const fakeScriptsDir = path.join(scratch, 'fake-scripts');
    fs.mkdirSync(fakeScriptsDir, { recursive: true });
    // Approved 12-glyph vocabulary per skills/ui-system/SKILL.md §3
    // (and per CONTEXT D-11): ■ ✓ ⚠ ⬜ ⚡ ▶ ▷ → • ▼ ├─ └─
    fs.writeFileSync(path.join(fakeScriptsDir, 'approved-glyphs.cjs'),
      '// Test fixture\nconst glyphs = "■ ✓ ⚠ ⬜ ⚡ ▶ ▷ →";\n' +
      'module.exports = { glyphs };\n');
    const fakeCommandsDir = path.join(scratch, 'fake-commands');
    fs.mkdirSync(fakeCommandsDir, { recursive: true });
    fs.writeFileSync(path.join(fakeCommandsDir, 'all-good.md'),
      '---\nbody_shape: E (Action Report)\n---\n# All good\n');
    const { stdout, status } = runDoctorJson(scratch,
      ['--ui-compliance', '--json',
        '--scan-commands=' + fakeCommandsDir,
        '--scan-scripts=' + fakeScriptsDir]);
    assert.equal(status, 0, label + ': doctor must exit 0');
    const report = JSON.parse(stdout);
    const f = report.checks['ui-compliance'];
    assert.equal(f.status, 'ok',
      label + ': status must be "ok" when only approved glyphs used');
    assert.equal(Array.isArray(f.violations), true,
      label + ': violations must be an array');
    assert.equal(f.violations.length, 0,
      label + ': violations must be empty for approved-only fixtures');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

// ---------- Report ----------

process.stdout.write('\n');
process.stdout.write(
  'doctor class F (UI compliance): ' + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
