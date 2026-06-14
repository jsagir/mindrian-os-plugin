#!/usr/bin/env node
/**
 * Phase 156 Plan 03 -- unit test for the subsystem + ring render (FW-07, D-03).
 *
 * Asserts (node built-in assert, no framework):
 *   - renderSubsystemMap on consequences spanning >= 2 PESTEL domains produces
 *     output with a distinct group header per PRESENT domain (the default view)
 *   - renderRingView groups by ring 1|2|3 (the on-demand view)
 *   - both render through the ui-system De Stijl renderer (lib/render/render-v2)
 *     -- NO hand-rolled <html>/<div> string literals in the source
 *   - the command footer offers both views (subsystem default + ring on demand)
 *
 * Single run only, no external test framework. No em-dashes (hyphens only).
 */

'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SUITE = 'test-futures-render';
const REPO = path.join(__dirname, '..');
const MODULE_PATH = path.join(REPO, 'lib', 'core', 'futures', 'subsystem-render.cjs');
const { renderSubsystemMap, renderRingView, VIEW_TOGGLE_FOOTER } = require(MODULE_PATH);

try {
  // Consequences spanning FOUR PESTEL domains across rings 1-3.
  const consequences = [
    { id: 'c1', ring: 1, domain: 'Economic', horizon: 'near', confidence: 0.8, label: 'No horses to feed' },
    { id: 'c2', ring: 1, domain: 'Technological', horizon: 'near', confidence: 0.7, label: 'Gas stations appear' },
    { id: 'c3', ring: 2, domain: 'Social', horizon: 'mid', confidence: 0.6, label: 'Working class forms' },
    { id: 'c4', ring: 2, domain: 'Economic', horizon: 'mid', confidence: 0.55, label: 'Mass-production factories' },
    { id: 'c5', ring: 3, domain: 'Legal', horizon: 'long', confidence: 0.5, label: 'Healthcare + retirement policy' },
  ];

  // --- renderSubsystemMap (DEFAULT view): a distinct group per present domain. ---
  const sub = renderSubsystemMap(consequences, { seed: 'automobile adoption' });
  assert.strictEqual(sub.view, 'subsystem', 'default view is the subsystem map');
  // 4 distinct PESTEL domains present.
  assert.deepStrictEqual(
    sub.domains.slice().sort(),
    ['Economic', 'Legal', 'Social', 'Technological'],
    'present PESTEL domains grouped'
  );
  for (const dom of ['Economic', 'Social', 'Technological', 'Legal']) {
    assert.ok(sub.rendered.indexOf('## ' + dom) >= 0, 'subsystem map carries a header for domain ' + dom);
  }
  // The two Economic consequences both appear under the Economic grouping.
  assert.ok(sub.rendered.indexOf('No horses to feed') >= 0, 'economic c1 present');
  assert.ok(sub.rendered.indexOf('Mass-production factories') >= 0, 'economic c4 present');
  // Footer offers both views.
  assert.ok(sub.rendered.indexOf(VIEW_TOGGLE_FOOTER) >= 0, 'footer offers subsystem default + ring on demand');

  // --- renderRingView (ON-DEMAND view): groups by ring 1|2|3. ---
  const ringv = renderRingView(consequences, { seed: 'automobile adoption' });
  assert.strictEqual(ringv.view, 'ring', 'ring view tagged');
  assert.deepStrictEqual(ringv.rings.slice().sort(), [1, 2, 3], 'rings 1|2|3 grouped');
  for (const r of [1, 2, 3]) {
    assert.ok(ringv.rendered.indexOf('## Ring ' + r) >= 0, 'ring view carries a header for ring ' + r);
  }

  // --- SOURCE gate: reuses ui-system render, no hand-rolled HTML literals. ---
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  assert.ok(/render-v2|render\(/.test(src), 'source reuses the ui-system render-v2 primitive');
  assert.ok(!/<html|<div|<\/div>|<body/.test(src), 'NO hand-rolled HTML string literals (Dashboard Export Integrity)');
  // Defensive: rendered output is text, not HTML.
  assert.ok(!/<div|<html/.test(sub.rendered), 'rendered subsystem map is text, not HTML');

  console.log('PASS ' + SUITE);
  process.exit(0);
} catch (e) {
  console.error('FAIL ' + SUITE + ': ' + (e && e.message));
  console.error(e && e.stack);
  process.exit(1);
}
