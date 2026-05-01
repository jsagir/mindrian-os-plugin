#!/usr/bin/env node
/*
 * Phase 101-03 Task 2 - Shape H (Timeline / Roadmap) renderer test suite.
 * Replaces the Wave-0 stub from 101-00. IIFE harness, exit 0 on full pass.
 *
 * Assertions:
 *   T1 proportional_placement   markers at expected cols for 90-day span
 *   T2 width_clamp              200 -> 80, 10 -> 40
 *   T3 empty_milestones         3-line error envelope
 *   T4 crowded_stacks           labels stack across multiple rows
 *   T5 glyph_audit              body contains only allowed glyphs + ASCII
 *   T6 zone4_default            default footer has 3 /mos: references
 *   T7 end_before_start_error   reversed dates yield error
 */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const RENDERER_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'shape-h-renderer.cjs');
const { renderShapeH } = require(RENDERER_PATH);

let passed = 0;
let failed = 0;
function ok(name) { console.log('  PASS  ' + name); passed++; }
function fail(name, e) { console.log('  FAIL  ' + name + ': ' + (e && e.message || e)); failed++; }

// T1: proportional_placement
// 3 milestones at start, middle, end of a 90-day span; default width 60.
// pixelsPerMs = (60 - 2) / span. Expected cols ~0, ~29, ~58.
(function t1() {
  try {
    const r = renderShapeH({
      start: '2026-05-01',
      end: '2026-07-30',
      milestones: [
        { at: '2026-05-01', label: 'A' },
        { at: '2026-06-15', label: 'B' },
        { at: '2026-07-30', label: 'C' },
      ],
    });
    assert.ok(!r.error, 'should not error');
    assert.equal(r.contract.shape, 'H', 'shape is H');
    assert.equal(r.contract.width, 60, 'default width 60');
    assert.equal(r.contract.milestoneCount, 3, '3 milestones');

    // Find marker columns directly from body
    const lines = r.zones.body.split('\n');
    const markerLine = lines.find(l => l.includes('■'));
    assert.ok(markerLine, 'marker line present');
    const cols = [];
    for (let i = 0; i < markerLine.length; i++) {
      if (markerLine[i] === '■') cols.push(i);
    }
    assert.equal(cols.length, 3, '3 marker cols');
    assert.ok(cols[0] >= 0 && cols[0] <= 2, 'first marker near col 0..2 (got ' + cols[0] + ')');
    assert.ok(cols[1] >= 27 && cols[1] <= 31, 'middle marker near col ~29 (got ' + cols[1] + ')');
    assert.ok(cols[2] >= 56 && cols[2] <= 59, 'last marker near col ~58 (got ' + cols[2] + ')');
    ok('T1: proportional placement at start/middle/end');
  } catch (e) { fail('T1', e); }
})();

// T2: width_clamp
(function t2() {
  try {
    const big = renderShapeH({
      start: '2026-05-01', end: '2026-07-30',
      milestones: [{ at: '2026-06-01', label: 'x' }],
      width: 200,
    });
    assert.equal(big.contract.width, 80, '200 clamps to 80');

    const tiny = renderShapeH({
      start: '2026-05-01', end: '2026-07-30',
      milestones: [{ at: '2026-06-01', label: 'x' }],
      width: 10,
    });
    assert.equal(tiny.contract.width, 40, '10 clamps to 40');

    // Also verify default
    const def = renderShapeH({
      start: '2026-05-01', end: '2026-07-30',
      milestones: [{ at: '2026-06-01', label: 'x' }],
    });
    assert.equal(def.contract.width, 60, 'default width 60');

    ok('T2: width clamping (200->80, 10->40, default 60)');
  } catch (e) { fail('T2', e); }
})();

// T3: empty_milestones - 3-line error
(function t3() {
  try {
    const r = renderShapeH({
      start: '2026-05-01', end: '2026-07-30', milestones: [],
    });
    assert.ok(r.error, 'returns error envelope');
    const lines = r.error.split('\n');
    assert.equal(lines.length, 3, '3-line error');
    assert.ok(lines[0].startsWith('x '), 'line 1 starts with x');
    assert.ok(lines[1].startsWith('Why:'), 'line 2 starts with Why:');
    assert.ok(lines[2].startsWith('Fix:'), 'line 3 starts with Fix:');
    assert.ok(lines[2].includes('/mos:'), 'line 3 has /mos: command');
    ok('T3: empty milestones -> 3-line Canon Part 3 Rule 2 error');
  } catch (e) { fail('T3', e); }
})();

// T4: crowded_stacks - 3 milestones within 5 days stack
(function t4() {
  try {
    const r = renderShapeH({
      start: '2026-05-01', end: '2026-07-30',
      milestones: [
        { at: '2026-06-01', label: 'first' },
        { at: '2026-06-02', label: 'second' },
        { at: '2026-06-03', label: 'third' },
      ],
    });
    assert.ok(!r.error, 'no error');
    assert.equal(r.contract.crowded, true, 'crowded flag set');
    const lines = r.zones.body.split('\n');
    // axis line + marker line + N label rows; with 3 crowded, expect >= 3 label rows
    // plus axis (1) + marker (1) = at least 5 lines total (no title)
    assert.ok(lines.length >= 5, 'crowded body has >= 5 lines (got ' + lines.length + ')');
    // Check that 'first', 'second', 'third' all appear on different lines
    const firstLine = lines.findIndex(l => l.includes('first'));
    const secondLine = lines.findIndex(l => l.includes('second'));
    const thirdLine = lines.findIndex(l => l.includes('third'));
    assert.ok(firstLine !== secondLine, 'first and second on different lines');
    assert.ok(secondLine !== thirdLine, 'second and third on different lines');
    ok('T4: crowded milestones stack labels vertically');
  } catch (e) { fail('T4', e); }
})();

// T5: glyph_audit - body uses only allowed glyphs (and ASCII)
(function t5() {
  try {
    const r = renderShapeH({
      start: '2026-05-01', end: '2026-07-30',
      milestones: [
        { at: '2026-05-15', label: 'A' },
        { at: '2026-06-15', label: 'B' },
        { at: '2026-07-15', label: 'C' },
      ],
    });
    assert.ok(!r.error, 'no error');
    // 12-glyph allowlist (filled-square, down-tri, right-tri-fill,
    // right-tri-empty, branch, last-branch, check, bullet, lightning,
    // empty-square, arrow) plus dash/axis primitive used in tree-style output.
    const allowed = new Set([
      '■',      // filled-square (also U+25A0)
      '▼',      // down-triangle
      '▶',      // right-tri-fill
      '▷',      // right-tri-empty
      '├',      // branch
      '└',      // last-branch
      '✓',      // check
      '•',      // bullet
      '⚡',      // lightning
      '□',      // empty-square
      '→',      // arrow
      '─',      // dash (axis primitive)
    ]);
    // Body should only contain ASCII + the 12-glyph set above.
    // We verify body has no disallowed non-ASCII chars.
    const body = r.zones.body;
    let bad = [];
    for (const ch of body) {
      const c = ch.codePointAt(0);
      if (c < 0x80) continue; // ASCII OK
      if (allowed.has(ch)) continue;
      bad.push(ch + ' (U+' + c.toString(16).toUpperCase() + ')');
    }
    assert.equal(bad.length, 0, 'no disallowed glyphs in body: ' + bad.join(', '));

    // Also verify body contains the marker glyph
    assert.ok(body.includes('■'), 'body contains filled-square marker');

    // Check the source file too: forbid the em-dash codepoint entirely
    // (project hard rule - hyphens only)
    const src = fs.readFileSync(RENDERER_PATH, 'utf8');
    const emDashCp = String.fromCodePoint(0x2014);
    assert.equal(src.indexOf(emDashCp), -1, 'source has no em-dash codepoint');

    ok('T5: glyph audit - body is 12-glyph compliant; source has no em-dash');
  } catch (e) { fail('T5', e); }
})();

// T6: zone4_default - omitted footerVerbs gives 3 default /mos: references
(function t6() {
  try {
    const r = renderShapeH({
      start: '2026-05-01', end: '2026-07-30',
      milestones: [{ at: '2026-06-01', label: 'A' }],
      // no footerVerbs supplied
    });
    assert.ok(!r.error, 'no error');
    assert.ok(r.zones.footer, 'footer present');
    const lines = r.zones.footer.split('\n');
    assert.equal(lines.length, 3, 'default footer has 3 lines (got ' + lines.length + ')');
    // Each line references /mos:
    for (const l of lines) {
      assert.ok(l.includes('/mos:'), 'footer line has /mos: reference: ' + l);
    }
    // First line is primary glyph
    assert.ok(lines[0].startsWith('▶ '), 'primary glyph on line 1');
    assert.ok(lines[1].startsWith('▷ '), 'alt glyph on line 2');
    assert.ok(lines[2].startsWith('▷ '), 'alt glyph on line 3');

    // Custom footer also honored
    const r2 = renderShapeH({
      start: '2026-05-01', end: '2026-07-30',
      milestones: [{ at: '2026-06-01', label: 'A' }],
      footerVerbs: [{ command: '/mos:custom', description: 'custom verb' }],
    });
    assert.ok(r2.zones.footer.includes('/mos:custom'), 'custom verb honored');
    assert.equal(r2.zones.footer.split('\n').length, 1, 'custom footer is 1 line');

    ok('T6: zone4 default footer has 3 /mos: references');
  } catch (e) { fail('T6', e); }
})();

// T7: end_before_start_error
(function t7() {
  try {
    const r1 = renderShapeH({
      start: '2026-07-30', end: '2026-05-01',
      milestones: [{ at: '2026-06-01', label: 'A' }],
    });
    assert.ok(r1.error, 'reversed dates -> error');
    assert.ok(r1.error.split('\n').length === 3, '3-line error');
    assert.ok(r1.error.includes('end > start') || r1.error.includes('not after start'),
      'error mentions ordering');

    // equal dates
    const r2 = renderShapeH({
      start: '2026-06-01', end: '2026-06-01',
      milestones: [{ at: '2026-06-01', label: 'A' }],
    });
    assert.ok(r2.error, 'equal dates -> error');

    // bad date strings
    const r3 = renderShapeH({
      start: 'not-a-date', end: '2026-07-30',
      milestones: [{ at: '2026-06-01', label: 'A' }],
    });
    assert.ok(r3.error, 'bad start -> error');

    ok('T7: end_before_start, equal dates, bad date strings all error');
  } catch (e) { fail('T7', e); }
})();

console.log('\nShape H test suite: ' + passed + ' passed, ' + failed + ' failed.');
process.exit(failed === 0 ? 0 : 1);
