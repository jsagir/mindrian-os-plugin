#!/usr/bin/env node
'use strict';

/*
 * Phase 126 Plan-01 /mos:doctor --fix renderer contract test, trimmed in
 * Phase 341 plan 09.
 *
 * The original Tests 1 to 7 drove the class A (install-cache) recovery render:
 * `recovered to <version>`, `backup <path>`, exit code 2, the missing-install
 * scaffold. Class A and its atomic-swap recovery were RETIRED in Phase 341
 * plan 09 (the loader owns the swap, one install location), so those arms had
 * no subject and were deleted rather than left passing vacuously.
 *
 * What survives is the generic renderer contract, driven in-process through the
 * additive exports of scripts/doctor.cjs (the require.main guard prevents main()):
 *
 *   Test 1  exports       renderHumanReport + computeSummary are functions.
 *   Test 2  warn rows     every warn check renders name + detail + warn glyph.
 *   Test 3  summary       computeSummary drift matches the visible warn rows;
 *                         skip checks are omitted.
 *   Test 4  fix outcomes  report.recovered entries render tool + detail.
 *   Test 5  glyphs        no ballot X, no box-drawing characters.
 *   Test 6  class A gone  a report with no install, cache or drift keys renders
 *                         without throwing, the rendered text carries no
 *                         install-cache row, and the summary counts only the
 *                         dev source and the checks.
 *
 * Zero network. No filesystem writes.
 */

const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
function pass(name) { passed += 1; console.log('PASS: ' + name); }
function failTest(name, err) {
  failed += 1;
  console.log('FAIL: ' + name + '\n    ' + (err && err.message || err));
}

// Strip ANSI escape codes so regex matches survive color output.
function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return (s || '').replace(/\[[0-9;]*m/g, '');
}

// -- Hermetic unit sub-tests via the additive module exports --
//
// Task 1 additively exports renderHumanReport + computeSummary from
// scripts/doctor.cjs (the require.main guard prevents main() on require).
// These sub-tests drive them in-process against a synthetic report that
// reproduces the observed 2026-07-11 state: four warn-status checks that the
// old empty generic loop counted as drift but never printed. They fail if the
// generic render loop or the recovered-line rendering is ever reverted.
//
// Glyph literals in this scan-adjacent test are written via Unicode escape
// discipline: the warn glyph is U+26A0. BOX_CHAR_RE mirrors
// tests/test-doctor-ui-self-compliant.cjs so a reverted or box-char render is
// caught here too.
const WARN_GLYPH = '⚠';
const BOX_CHAR_RE = /[╭╮╰╯┌┐└┘│─━]/;

const { renderHumanReport, computeSummary } = require(path.join(REPO_ROOT, 'scripts', 'doctor.cjs'));

function makeSyntheticReport() {
  return {
    fixRequested: false,
    dev:     { status: 'ok', pluginJson: '1.15.0' },
    recovered: [],
    checks: {
      'cascade-rooms':        { status: 'warn', detail: '15 room(s) missing .room-root sentinel' },
      'cascade-rooms-active': { status: 'warn', detail: 'writes to mindrianOS would be silenced (active=iris2026)' },
      'room-md':              { status: 'warn', detail: '9 dir(s) missing ROOM.md or MINTO.md' },
      'ui-compliance':        { status: 'warn', detail: '3 violation(s)' },
      'verify-surface':       { status: 'ok' },
      'skipped-example':      { status: 'skip', detail: 'not applicable' }
    }
  };
}

const WARN_CHECKS = {
  'cascade-rooms':        '15 room(s) missing .room-root sentinel',
  'cascade-rooms-active': 'writes to mindrianOS would be silenced (active=iris2026)',
  'room-md':              '9 dir(s) missing ROOM.md or MINTO.md',
  'ui-compliance':        '3 violation(s)'
};

// -- Test 1: exports are functions ---------------------------------------
try {
  assert.strictEqual(typeof renderHumanReport, 'function', 'renderHumanReport must be an exported function');
  assert.strictEqual(typeof computeSummary, 'function', 'computeSummary must be an exported function');
  pass('Test 1 (exports: renderHumanReport + computeSummary are functions)');
} catch (err) {
  failTest('Test 1 (exports)', err);
}

// -- Test 2: warn visibility ---------------------------------------------
// Each of the four warn checks must render a line carrying BOTH its name and
// its exact detail string AND the warn glyph (U+26A0).
try {
  const rendered = renderHumanReport(makeSyntheticReport());
  const clean = stripAnsi(rendered);
  const lines = clean.split('\n');
  for (const [name, detail] of Object.entries(WARN_CHECKS)) {
    const hit = lines.find((l) => l.includes(name) && l.includes(detail));
    assert.ok(hit, 'warn check `' + name + '` must render a line containing its detail `' + detail + '`;\nrendered:\n' + clean);
    assert.ok(hit.includes(WARN_GLYPH), 'the `' + name + '` line must carry the warn glyph (U+26A0); got: ' + hit);
  }
  pass('Test 2 (warn visibility: all four warn checks render name + detail + warn glyph)');
} catch (err) {
  failTest('Test 2 (warn visibility)', err);
}

// -- Test 3: summary parity ---------------------------------------------
// computeSummary drift count matches the four visible warn rows; every
// non-skip check appears in the rendered output; the skip entry does not.
try {
  const report = makeSyntheticReport();
  const summary = computeSummary(report);
  assert.strictEqual(summary.drift, 4, 'computeSummary drift must equal the four warn checks; got ' + summary.drift);
  assert.ok(summary.healthy >= 2, 'computeSummary healthy must be >= 2 (dev + verify-surface); got ' + summary.healthy);
  const clean = stripAnsi(renderHumanReport(report));
  for (const name of Object.keys(report.checks)) {
    if (report.checks[name].status === 'skip') continue;
    assert.ok(clean.includes(name), 'non-skip check `' + name + '` must appear in rendered output;\nrendered:\n' + clean);
  }
  assert.ok(!clean.includes('skipped-example'), 'the skip check `skipped-example` must NOT appear in rendered output;\nrendered:\n' + clean);
  pass('Test 3 (summary parity: drift === 4, non-skip checks visible, skip omitted)');
} catch (err) {
  failTest('Test 3 (summary parity)', err);
}

// -- Test 4: recovered lines --------------------------------------------
// A --fix run pushes outcomes into report.recovered; each must render a line.
try {
  const report = makeSyntheticReport();
  report.fixRequested = true;
  report.recovered = [{ status: 'error', detail: 'generator failed: boom', tool: 'generate-section-intelligence' }];
  const clean = stripAnsi(renderHumanReport(report));
  assert.ok(clean.includes('generate-section-intelligence'), 'recovered line must name the tool `generate-section-intelligence`;\nrendered:\n' + clean);
  assert.ok(clean.includes('generator failed: boom'), 'recovered line must carry the outcome detail `generator failed: boom`;\nrendered:\n' + clean);
  pass('Test 4 (recovered lines: fix outcome renders tool + detail)');
} catch (err) {
  failTest('Test 4 (recovered lines)', err);
}

// -- Test 5: glyph hygiene ----------------------------------------------
// Neither report renders a ballot X (U+2717) nor any box-drawing char.
try {
  const a = renderHumanReport(makeSyntheticReport());
  const fixReport = makeSyntheticReport();
  fixReport.fixRequested = true;
  fixReport.recovered = [{ status: 'error', detail: 'generator failed: boom', tool: 'generate-section-intelligence' }];
  const b = renderHumanReport(fixReport);
  for (const [label, out] of [['default', a], ['fix', b]]) {
    assert.ok(!/✗/.test(out), label + ' render must not contain a ballot X (U+2717)');
    assert.ok(!BOX_CHAR_RE.test(out), label + ' render must not contain box-drawing chars');
  }
  pass('Test 5 (glyph hygiene: no ballot X, no box-drawing chars in either render)');
} catch (err) {
  failTest('Test 5 (glyph hygiene)', err);
}

// -- Test 6: class A is gone from the renderer and the summary ------------
try {
  const report = makeSyntheticReport();
  for (const k of ['install', 'cache', 'drift', 'classARecovered', 'recoveryError', 'recoverySkipped']) {
    assert.ok(!(k in report), 'the synthetic report must not carry the retired key ' + k);
  }
  const clean = stripAnsi(renderHumanReport(report));
  assert.ok(!/install-cache/.test(clean), 'the render must carry no install-cache row;\nrendered:\n' + clean);
  const summary = computeSummary(report);
  // dev source (ok) + verify-surface (ok) healthy; four warn checks drift; nothing else.
  assert.strictEqual(summary.healthy, 2, 'healthy must be dev + verify-surface only; got ' + summary.healthy);
  assert.strictEqual(summary.drift, 4, 'drift must be the four warn checks only; got ' + summary.drift);
  assert.strictEqual(summary.warnings, 0, 'warnings must be 0; got ' + summary.warnings);
  pass('Test 6 (class A gone: no install-cache row, summary counts only dev source and checks)');
} catch (err) {
  failTest('Test 6 (class A gone)', err);
}

// -- Tally ---------------------------------------------------------------
if (failed > 0) {
  console.log('\n' + failed + ' test(s) FAILED (' + passed + ' passed)');
  process.exit(1);
}
console.log('\nAll ' + passed + ' tests PASS');
process.exit(0);
