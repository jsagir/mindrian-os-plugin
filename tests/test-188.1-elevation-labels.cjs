'use strict';
/*
 * Phase 188.1 -- Shape-F elevation labels.
 *
 * Guards the fix for the defect Lawrence Aronhime named (2026-07-01): "Your
 * Shape F does not tell me what I will get or how my thinking improves." The
 * LIVE selector printed the mechanism-blank explore one_line ("No specific job
 * - general thinking, talking, ranging.") on every degraded row. Phase 188.1
 * repoints the degraded path to an ELEVATION-framed what-you-get default
 * (Canon Part 12: vertical / horizontal / lateral), so every selector row names
 * an elevation direction + a concrete outcome, never a mechanism-blank string.
 *
 * Assertions:
 *   1. Every composer family declares a valid elevation direction.
 *   2. A degraded label (empty slotContext) is the family's elevation default -
 *      never the "No specific job" / "general thinking" mechanism-blank line.
 *   3. The canonical_verb still persists on the degraded row (graph-edge truth).
 *   4. No degraded label carries a raw {slot} or an em-dash.
 *   5. The three elevation defaults are distinct and non-empty.
 *   6. Presenter integration: a rendered cold dial carries no "No specific job"
 *      / "general thinking" row and no literal "(Recommended)"; each offered row
 *      carries its family's elevation line.
 *
 * House rule: hyphens only, no em-dashes. Pure CJS, zero npm deps.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const composer = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-label-composer.cjs'));
const presenter = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-presenter.cjs'));

const EM_DASH = '—';
const VALID_DIRECTIONS = ['vertical', 'horizontal', 'lateral'];
const BLANK_MARKERS = ['No specific job', 'general thinking'];

let failures = 0;
function check(label, fn) {
  try {
    fn();
    console.log('  ok  - ' + label);
  } catch (e) {
    failures++;
    console.error('  FAIL - ' + label + '\n        ' + (e && e.message ? e.message : e));
  }
}

const FAMILIES = composer.TEMPLATE_FAMILIES;
const FAMILY_IDS = Object.keys(FAMILIES);
const ELEVATION_DEFAULTS = composer._test.ELEVATION_DEFAULTS;

// 1. Every family declares a valid elevation direction.
check('every composer family declares a valid elevation direction', () => {
  for (const id of FAMILY_IDS) {
    const dir = FAMILIES[id].elevation;
    assert.ok(VALID_DIRECTIONS.indexOf(dir) !== -1,
      id + ' declares an invalid elevation direction: ' + JSON.stringify(dir));
  }
});

// 2-4. Degraded labels are elevation-framed, never mechanism-blank, verb persists.
check('a degraded label is the family elevation default, never the blank line', () => {
  for (const id of FAMILY_IDS) {
    // Empty slotContext -> the family cannot resolve its slots -> degraded.
    const out = composer.composeLabel(id, {});
    assert.strictEqual(out.degraded, true, id + ' must degrade with an empty slotContext');
    assert.ok(typeof out.label === 'string' && out.label.length > 0, id + ' degraded label must be non-empty');
    // The heart of 188.1: NO mechanism-blank marker.
    for (const marker of BLANK_MARKERS) {
      assert.ok(out.label.indexOf(marker) === -1,
        id + ' degraded label still carries the mechanism-blank marker "' + marker + '": ' + JSON.stringify(out.label));
    }
    // It IS the elevation default for the family's direction.
    assert.strictEqual(out.label, ELEVATION_DEFAULTS[FAMILIES[id].elevation],
      id + ' degraded label is not its elevation default');
    // Verb still persists (graph-edge truth).
    assert.strictEqual(out.canonical_verb, FAMILIES[id].canonical_verb,
      id + ' must still persist its canonical_verb on the degraded row');
    // Never a raw slot; never an em-dash.
    assert.ok(out.label.indexOf('{') === -1, id + ' degraded label carries a raw {slot}');
    assert.ok(out.label.indexOf(EM_DASH) === -1, id + ' degraded label carries an em-dash');
  }
});

// 5. The three elevation defaults are distinct + non-empty.
check('the three elevation defaults are distinct and non-empty', () => {
  const vals = VALID_DIRECTIONS.map((d) => ELEVATION_DEFAULTS[d]);
  for (let i = 0; i < vals.length; i++) {
    assert.ok(typeof vals[i] === 'string' && vals[i].length > 0, VALID_DIRECTIONS[i] + ' default must be non-empty');
    assert.ok(vals[i].indexOf(EM_DASH) === -1, VALID_DIRECTIONS[i] + ' default carries an em-dash');
    for (const marker of BLANK_MARKERS) {
      assert.ok(vals[i].indexOf(marker) === -1, VALID_DIRECTIONS[i] + ' default carries "' + marker + '"');
    }
  }
  assert.strictEqual(new Set(vals).size, vals.length, 'the three elevation defaults must be distinct');
});

// 6. Presenter integration: a cold dial carries no blank row, no literal marker.
check('a rendered cold dial carries elevation rows, no "No specific job", no "(Recommended)"', () => {
  // A cold tier_0 dial with an empty slotContext -> every offered row degrades.
  const rl = {
    reaches: [
      { reach_id: 'context_block', score: 0.0, recommended: false },
      { reach_id: 'contradiction', score: 0.0, recommended: false },
      { reach_id: 'cross_room', score: 0.0, recommended: false },
    ],
    tier_mode: 'tier_0',
    total_count: 6,
  };
  const out = presenter.renderDial(rl, { slotContext: {} });
  const txt = out.text;
  for (const marker of BLANK_MARKERS) {
    assert.ok(txt.indexOf(marker) === -1, 'rendered dial still shows the mechanism-blank marker "' + marker + '"');
  }
  assert.ok(txt.indexOf('(Recommended)') === -1, 'rendered dial must never carry the literal "(Recommended)"');
  // Each offered row carries its family elevation default.
  assert.ok(txt.indexOf(ELEVATION_DEFAULTS.vertical) !== -1, 'context_block row must carry its vertical elevation line');
  assert.ok(txt.indexOf(ELEVATION_DEFAULTS.horizontal) !== -1, 'contradiction row must carry its horizontal elevation line');
  assert.ok(txt.indexOf(ELEVATION_DEFAULTS.lateral) !== -1, 'cross_room row must carry its lateral elevation line');
});

if (failures > 0) {
  console.error('\nPhase 188.1 elevation-labels test: ' + failures + ' assertion group(s) FAILED');
  process.exit(1);
}
console.log('\nPhase 188.1 elevation-labels test: all assertion groups PASSED');
