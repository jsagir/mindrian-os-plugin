#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 101-02 -- tests/test-shape-g.cjs
 * Validation suite for Shape G (Comparison Matrix) renderer.
 *
 * 7 assertions per 101-02-PLAN Task 2:
 *   1.  valid_matrix         3x3 matrix renders with all rows + separator
 *   2.  degenerate_fallthrough  2 options OR 1 criterion -> fallthrough to E
 *   3.  cell_clamping        30-char cell clamped to 12 + "..."
 *   4.  criterion_clamping   20-char criterion clamped to 10 + "..."
 *   5.  glyph_audit          rendered output contains zero forbidden glyphs;
 *                            only U+2500 dash + ASCII pipe + canonical glyphs
 *   6.  zone4_present        rendered output has Zone 4 with >= 2 /mos: refs
 *   7.  zone1_dimensions     Zone 1 header includes "N options x M criteria"
 *
 * Exit 0 on full pass; exit 1 on any failure. IIFE harness per Phase 99 +
 * Phase 100 convention.
 *
 * License: BSL 1.1.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const RENDERER_SRC = path.join(REPO, 'lib', 'hmi', 'shape-g-renderer.cjs');
const renderer = require(RENDERER_SRC);

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  PASS ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.stack || err.message || String(err)) + '\n');
}

// Forbidden output glyphs - the box-drawing chars from scripts/doctor.cjs
// FORBIDDEN_BOX_CHARS regex MINUS U+2500 (the approved separator dash for
// table rules per RESEARCH section 3 + skills/ui-system/SKILL.md section 3
// branch tail glyph). Source uses Unicode escapes (\uXXXX) so this test
// file itself contains zero literal forbidden chars - mirrors the pattern
// in tests/test-operator-command.cjs T14.
//   U+256D-U+2570  curved corners
//   U+250C/U+2510  light corners (top-left, top-right)
//   U+2514/U+2518  light corners (bottom-left, bottom-right)
//   U+2502         light vertical
//   U+2501         heavy horizontal
//   U+2503         heavy vertical
// Build regex via String.fromCharCode so this source file contains zero
// literal forbidden chars (mirrors lib/hmi/shape-g-renderer.cjs G_DASH and
// the Phase 99 operator-command pattern).
const FORBIDDEN_CODEPOINTS = [
  0x256D, 0x256E, 0x256F, 0x2570, // curved corners
  0x250C, 0x2510, 0x2514, 0x2518, // light corners
  0x2502,                          // light vertical
  0x2501,                          // heavy horizontal
  0x2503,                          // heavy vertical
];
const FORBIDDEN_OUTPUT_CHARS = new RegExp(
  '[' + FORBIDDEN_CODEPOINTS.map((c) => String.fromCharCode(c)).join('') + ']',
  'g'
);

// Helper: assemble all 4 zones into a single string for substring/regex tests.
function assemble(rendered) {
  if (!rendered || !rendered.zones) {
    throw new Error('rendered has no zones: ' + JSON.stringify(rendered));
  }
  const z = rendered.zones;
  return [z.header, z.body, z.signals, z.footer].join('\n');
}

// ---------- Test 1: valid_matrix ----------

(function test_1_valid_matrix() {
  const label = '1. valid_matrix';
  try {
    const r = renderer.renderShapeG({
      options: ['Sprites', 'Native', 'Hosted'],
      criteria: ['Cost', 'Speed', 'Risk'],
      cells: {
        Sprites: { Cost: 'High', Speed: 'Low', Risk: 'Med' },
        Native: { Cost: 'Low', Speed: 'High', Risk: 'High' },
        Hosted: { Cost: 'Med', Speed: 'Med', Risk: 'Med' },
      },
    });
    assert.ok(r.zones && r.zones.body, 'zones.body must exist');
    assert.equal(r.contract.shape, 'G', 'contract.shape must be G');
    assert.equal(r.contract.options_count, 3);
    assert.equal(r.contract.criteria_count, 3);
    // All 3 option rows must appear in body.
    assert.ok(r.zones.body.indexOf('Sprites') >= 0, 'body must contain Sprites');
    assert.ok(r.zones.body.indexOf('Native') >= 0, 'body must contain Native');
    assert.ok(r.zones.body.indexOf('Hosted') >= 0, 'body must contain Hosted');
    // Separator row must contain U+2500.
    const dashChar = String.fromCharCode(0x2500);
    assert.ok(r.zones.body.indexOf(dashChar) >= 0,
      'body must contain U+2500 separator');
    // Header row + separator row + 3 option rows + 1 title line = 6 lines
    // minimum.
    assert.ok(r.zones.body.split('\n').length >= 6,
      'body must be at least 6 lines');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------- Test 2: degenerate_fallthrough ----------

(function test_2_degenerate_fallthrough() {
  const label = '2. degenerate_fallthrough';
  try {
    // Sub-case A: 2 options.
    const r1 = renderer.renderShapeG({
      options: ['A', 'B'],
      criteria: ['X', 'Y'],
      cells: { A: { X: 'a', Y: 'a' }, B: { X: 'b', Y: 'b' } },
    });
    assert.equal(r1.fallthrough, true, '2 options must fallthrough');
    assert.equal(r1.fallthroughTo, 'E', '2 options must route to Shape E');
    assert.equal(typeof r1.reason, 'string', 'reason must be a string');
    // Sub-case B: 1 criterion.
    const r2 = renderer.renderShapeG({
      options: ['A', 'B', 'C'],
      criteria: ['X'],
      cells: { A: { X: 'a' }, B: { X: 'b' }, C: { X: 'c' } },
    });
    assert.equal(r2.fallthrough, true, '1 criterion must fallthrough');
    assert.equal(r2.fallthroughTo, 'E', '1 criterion must route to Shape E');
    // Sub-case C: empty arrays.
    const r3 = renderer.renderShapeG({ options: [], criteria: [], cells: {} });
    assert.equal(r3.fallthrough, true, 'empty arrays must fallthrough');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------- Test 3: cell_clamping ----------

(function test_3_cell_clamping() {
  const label = '3. cell_clamping';
  try {
    const longCell = 'A'.repeat(30); // 30 chars
    const r = renderer.renderShapeG({
      options: ['Opt1', 'Opt2', 'Opt3'],
      criteria: ['X', 'Y'],
      cells: {
        Opt1: { X: longCell, Y: 'short' },
        Opt2: { X: 'short', Y: 'short' },
        Opt3: { X: 'short', Y: 'short' },
      },
    });
    // The clamped cell should appear in body as 12 chars: 9 As + "..."
    const expected = 'A'.repeat(9) + '...'; // 12 chars total
    assert.ok(r.zones.body.indexOf(expected) >= 0,
      'body must contain clamped cell ' + expected
      + ' (got body=' + JSON.stringify(r.zones.body) + ')');
    // The full 30-char string must NOT appear.
    assert.equal(r.zones.body.indexOf(longCell), -1,
      'body must not contain the full 30-char cell');
    // Direct internal check.
    const clampFn = renderer._internal.clamp;
    const clampLen = renderer._internal.CELL_CLAMP;
    assert.equal(clampFn(longCell, clampLen).length, 12,
      'clamp(longCell, 12) length must be 12');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------- Test 4: criterion_clamping ----------

(function test_4_criterion_clamping() {
  const label = '4. criterion_clamping';
  try {
    const longCrit = 'C'.repeat(20); // 20 chars
    const r = renderer.renderShapeG({
      options: ['A', 'B', 'C'],
      criteria: [longCrit, 'Y'],
      cells: {
        A: { [longCrit]: 'a', Y: 'a' },
        B: { [longCrit]: 'b', Y: 'b' },
        C: { [longCrit]: 'c', Y: 'c' },
      },
    });
    // The clamped criterion should appear: 7 Cs + "..." = 10 chars total.
    const expectedCrit = 'C'.repeat(7) + '...';
    assert.ok(r.zones.body.indexOf(expectedCrit) >= 0,
      'body must contain clamped criterion ' + expectedCrit
      + ' (got body=' + JSON.stringify(r.zones.body) + ')');
    // The full 20-char criterion must NOT appear.
    assert.equal(r.zones.body.indexOf(longCrit), -1,
      'body must not contain the full 20-char criterion');
    // Direct internal check.
    const clampFn = renderer._internal.clamp;
    const critClamp = renderer._internal.CRITERION_CLAMP;
    assert.equal(clampFn(longCrit, critClamp).length, 10,
      'clamp(longCrit, 10) length must be 10');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------- Test 5: glyph_audit ----------

(function test_5_glyph_audit() {
  const label = '5. glyph_audit';
  try {
    const r = renderer.renderShapeG({
      options: ['Sprites', 'Native', 'Hosted'],
      criteria: ['Cost', 'Speed', 'Risk', 'Coverage'],
      cells: {
        Sprites: { Cost: 'High', Speed: 'Low', Risk: 'Med', Coverage: 'Wide' },
        Native: { Cost: 'Low', Speed: 'High', Risk: 'High', Coverage: 'Narrow' },
        Hosted: { Cost: 'Med', Speed: 'Med', Risk: 'Med', Coverage: 'Wide' },
      },
    });
    const full = assemble(r);
    const matches = full.match(FORBIDDEN_OUTPUT_CHARS);
    assert.equal(matches, null,
      'rendered output must contain zero forbidden box-drawing chars; got '
      + JSON.stringify(matches));
    // Allowed-glyph audit: U+2500 dash, ASCII pipe, U+25A0/U+25B6/U+25B7.
    const dashChar = String.fromCharCode(0x2500);
    assert.ok(full.indexOf(dashChar) >= 0, 'output must contain U+2500');
    assert.ok(full.indexOf('|') >= 0, 'output must contain ASCII pipe');
    assert.ok(full.indexOf('■') >= 0, 'output must contain U+25A0 filled-square');
    assert.ok(full.indexOf('▶') >= 0 || full.indexOf('▷') >= 0,
      'output must contain a triangle glyph (U+25B6 or U+25B7)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------- Test 6: zone4_present ----------

(function test_6_zone4_present() {
  const label = '6. zone4_present';
  try {
    const r = renderer.renderShapeG({
      options: ['A', 'B', 'C'],
      criteria: ['X', 'Y'],
      cells: {
        A: { X: 'a', Y: 'a' }, B: { X: 'b', Y: 'b' }, C: { X: 'c', Y: 'c' },
      },
    });
    assert.equal(typeof r.zones.footer, 'string', 'footer must be a string');
    const mosMatches = r.zones.footer.match(/\/mos:/g);
    assert.ok(mosMatches && mosMatches.length >= 2,
      'footer must contain at least 2 /mos: references; got '
      + (mosMatches ? mosMatches.length : 0));
    // Footer must contain a primary-action glyph.
    assert.ok(r.zones.footer.indexOf('▶') >= 0,
      'footer must contain primary-action glyph U+25B6');
    // Custom footerVerbs override.
    const r2 = renderer.renderShapeG({
      options: ['A', 'B', 'C'],
      criteria: ['X', 'Y'],
      cells: {
        A: { X: 'a', Y: 'a' }, B: { X: 'b', Y: 'b' }, C: { X: 'c', Y: 'c' },
      },
      footerVerbs: [
        { command: '/mos:custom-1', hint: 'one' },
        { command: '/mos:custom-2', hint: 'two' },
      ],
    });
    assert.ok(r2.zones.footer.indexOf('/mos:custom-1') >= 0,
      'custom footerVerbs[0] must appear in footer');
    assert.ok(r2.zones.footer.indexOf('/mos:custom-2') >= 0,
      'custom footerVerbs[1] must appear in footer');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------- Test 7: zone1_dimensions ----------

(function test_7_zone1_dimensions() {
  const label = '7. zone1_dimensions';
  try {
    const r = renderer.renderShapeG({
      options: ['A', 'B', 'C'],
      criteria: ['X', 'Y', 'Z'],
      cells: {
        A: { X: 'a', Y: 'a', Z: 'a' },
        B: { X: 'b', Y: 'b', Z: 'b' },
        C: { X: 'c', Y: 'c', Z: 'c' },
      },
    });
    assert.equal(typeof r.zones.header, 'string', 'header must be a string');
    // PLAN must_have: header includes "N options x M criteria" substring.
    const expectedDims = '3 options x 3 criteria';
    assert.ok(r.zones.header.indexOf(expectedDims) >= 0,
      'header must include "' + expectedDims + '"; got: '
      + JSON.stringify(r.zones.header));
    // Header must follow the "-- ... -- ... -- ... --" pattern.
    const headerPattern = /^-- .+ -- .+ -- .+ --$/;
    assert.ok(headerPattern.test(r.zones.header),
      'header must follow Zone 1 4-segment pattern; got: '
      + JSON.stringify(r.zones.header));
    // Custom title override.
    const r2 = renderer.renderShapeG({
      options: ['A', 'B', 'C'],
      criteria: ['X', 'Y'],
      cells: {
        A: { X: 'a', Y: 'a' }, B: { X: 'b', Y: 'b' }, C: { X: 'c', Y: 'c' },
      },
      title: 'roi-comparison',
    });
    assert.ok(r2.zones.header.indexOf('roi-comparison') >= 0,
      'custom title must appear in header');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------- Summary ----------

process.stdout.write('\n');
process.stdout.write('Shape G renderer: ' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) {
  process.exit(1);
}
process.exit(0);
