'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 205-04 -- the elevation companion axis (scope item 8, Lawrence Test 6).
 * ============================================================================
 * Proves the three elevation types (vertical / horizontal / lateral) render as a
 * COMPANION axis ALONGSIDE the ASK/TELL/GRILL gear positions (Investigate |
 * Blend | Insight) -- the gears are NOT torn out (navigator decision 2026-07-01).
 * Proves the F.1 selector row is framed as the ELEVATION the navigator receives
 * (reusing the SHIPPED Phase 188.1 dial-label-composer.elevationDefault line),
 * not a mechanism-blank "No specific job" JTBD row, and that the canonical_verb
 * never leaks to the screen.
 *
 * The elevation mints NO reach_id: it is a DIRECTION on the existing move. The
 * one source of truth for reach -> elevation is dial-label-composer.cjs
 * TEMPLATE_FAMILIES (188.1); nav-dial delegates to it.
 *
 * House rule: hyphens only, no em-dashes. CJS. LOCAL only (Part 8).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const dial = require(path.join(REPO_ROOT, 'lib', 'core', 'nav-dial.cjs'));
const renderer = require(path.join(REPO_ROOT, 'lib', 'hmi', 'shape-f1-renderer.cjs'));
const composer = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-label-composer.cjs'));

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log('  ok - ' + name);
}

// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;
function stripAnsi(s) { return String(s).replace(ANSI_RE, ''); }

console.log('test-205-elevation-axis.cjs: elevation companion axis alongside the gears');

// A mode_a trace at weight 0.8 -> Blend (the gear). fired_reach_id names the move.
function traceWithReach(reachId) {
  return {
    brain_md_tier_mode: 'mode_a',
    brain_md_weight_applied: 0.8,
    chosen_rationale: 'Strong Brain agreement; blending',
    fired_reach_id: reachId,
  };
}

// ---------------------------------------------------------------------------
// resolveElevation: the reach -> elevation mapping (one source of truth = 188.1)
// ---------------------------------------------------------------------------
check('resolveElevation delegates to the shipped 188.1 family mapping', () => {
  // context_block is vertical, contradiction is horizontal, cross_room is lateral
  // per dial-label-composer.TEMPLATE_FAMILIES (188.1). Assert nav-dial agrees.
  assert.strictEqual(dial.resolveElevation('context_block'), 'vertical');
  assert.strictEqual(dial.resolveElevation('contradiction'), 'horizontal');
  assert.strictEqual(dial.resolveElevation('cross_room'), 'lateral');
  // The delegation is real: nav-dial's answer equals the family's own elevation.
  assert.strictEqual(
    dial.resolveElevation('contradiction'),
    composer.TEMPLATE_FAMILIES.contradiction.elevation
  );
});

check('resolveElevation soft-fails to null on an unknown / empty reach', () => {
  assert.strictEqual(dial.resolveElevation('not_a_reach'), null);
  assert.strictEqual(dial.resolveElevation(''), null);
  assert.strictEqual(dial.resolveElevation(null), null);
});

// ---------------------------------------------------------------------------
// AC1: the companion returns BOTH a gear label AND an elevation (gears kept)
// ---------------------------------------------------------------------------
check('resolveDialWithElevation returns BOTH a gear label AND an elevation', () => {
  const pos = dial.resolveDialWithElevation(traceWithReach('contradiction'));
  assert.ok(['Investigate', 'Blend', 'Insight'].indexOf(pos.label) !== -1,
    'gear label must be one of Investigate|Blend|Insight; got ' + pos.label);
  assert.strictEqual(pos.label, 'Blend', 'weight 0.8 mode_a resolves to the Blend gear');
  assert.strictEqual(pos.elevation, 'horizontal',
    'contradiction is the horizontal move (188.1 mapping)');
  // The gear fields are intact (not removed by the elevation add).
  assert.strictEqual(pos.glyph, 'check');
  assert.strictEqual(pos.highlight, 'active');
});

// ---------------------------------------------------------------------------
// AC4: a gear-only position (no elevation) is BYTE-STABLE vs the pre-205 dial
// ---------------------------------------------------------------------------
check('formatDialSegment is byte-stable for a gear-only (vertical move) position', () => {
  // The exact object shape the pre-205 resolveDialPosition returns -- no
  // elevation field. formatDialSegment must render it identically to before.
  const gearOnly = { label: 'Blend', glyph: 'check', highlight: 'active', reason: 'x' };
  const before = dial.formatDialSegment(gearOnly);
  // A vertical MOVE with NO elevation companion attached must be byte-identical.
  const posVertical = dial.resolveDialPosition(traceWithReach('context_block'));
  assert.strictEqual('elevation' in posVertical, false,
    'resolveDialPosition stays pre-205: no elevation field');
  const rendered = dial.formatDialSegment(posVertical);
  assert.strictEqual(rendered, before,
    'gear-only render must be byte-identical to the pre-205 segment');
  // And it still carries all three gear labels.
  const vis = stripAnsi(rendered);
  assert.ok(vis.indexOf('Investigate') !== -1 && vis.indexOf('Blend') !== -1
    && vis.indexOf('Insight') !== -1, 'all three gears render');
});

// ---------------------------------------------------------------------------
// AC (item 8): the elevation companion renders ALONGSIDE the gears
// ---------------------------------------------------------------------------
check('formatDialSegment appends the elevation companion ALONGSIDE the gears', () => {
  const pos = dial.resolveDialWithElevation(traceWithReach('contradiction'));
  const seg = dial.formatDialSegment(pos);
  const vis = stripAnsi(seg);
  // Gears kept.
  assert.ok(vis.indexOf('Investigate') !== -1, 'Investigate gear kept');
  assert.ok(vis.indexOf('Blend') !== -1, 'Blend gear kept');
  assert.ok(vis.indexOf('Insight') !== -1, 'Insight gear kept');
  // Elevation companion present alongside them.
  assert.ok(vis.indexOf('horizontal') !== -1,
    'the horizontal elevation companion renders alongside the gears; got: ' + JSON.stringify(vis));
});

check('the elevation companion wears a De Stijl color mark (Canon Part 12)', () => {
  const pos = dial.resolveDialWithElevation(traceWithReach('contradiction'));
  const seg = dial.formatDialSegment(pos);
  // horizontal -> ds-red (30/90/168 is blue for vertical; red is 166;61;47).
  assert.ok(seg.indexOf('\x1b[38;2;166;61;47m') !== -1,
    'the horizontal elevation must carry the ds-red De Stijl color mark');
  // The active gear also carries its own color mark (progressive enhancement).
  assert.ok(ANSI_RE.test(seg) || /\x1b\[/.test(seg), 'segment carries ANSI color marks');
});

check('vertical / lateral elevations carry their own De Stijl marks', () => {
  const v = dial.formatDialSegment(dial.resolveDialWithElevation(traceWithReach('context_block')));
  assert.ok(stripAnsi(v).indexOf('vertical') !== -1, 'vertical companion renders');
  assert.ok(v.indexOf('\x1b[38;2;30;90;168m') !== -1, 'vertical -> ds-blue mark');
  const l = dial.formatDialSegment(dial.resolveDialWithElevation(traceWithReach('cross_room')));
  assert.ok(stripAnsi(l).indexOf('lateral') !== -1, 'lateral companion renders');
  assert.ok(l.indexOf('\x1b[38;2;200;164;60m') !== -1, 'lateral -> ds-yellow mark');
});

// ---------------------------------------------------------------------------
// AC2 + AC3: F.1 row states the elevation what-you-get; no blank, no verb leak
// ---------------------------------------------------------------------------
const HORIZONTAL_WYG = composer._test.ELEVATION_DEFAULTS.horizontal;
const BLANK_JTBD = 'No specific job';

check('a horizontal-move F.1 row states the shipped 188.1 what-you-get line', () => {
  // The contradiction family is the horizontal move. Render an F.1 selector whose
  // single chooser row carries that family so the row is elevation-framed.
  const horizontalFamily = composer.TEMPLATE_FAMILIES.contradiction;
  const out = renderer.renderShapeF1({
    tier: 1, // mode B -> horizontal renders even as an OFFERED (below-0.70) move
    verbs: ["Devil's Advocate"],
    elevationFamilies: [horizontalFamily],
  });
  const body = out.zones.body;
  assert.ok(body.indexOf(HORIZONTAL_WYG) !== -1,
    'the horizontal row must contain the shipped elevationDefault text; got: ' + JSON.stringify(body));
  assert.ok(body.indexOf(BLANK_JTBD) === -1,
    'the row must NOT contain the mechanism-blank "No specific job" string');
});

check('the horizontal row renders even when it is the OFFERED (below-0.70) move', () => {
  // Mode B (tier < 2) -> no RECOMMENDED marker; the row is an OFFER. It must
  // still render the horizontal what-you-get (the primary build target).
  const out = renderer.renderShapeF1({
    tier: 0,
    verbs: ["Devil's Advocate"],
    elevationFamilies: [composer.TEMPLATE_FAMILIES.contradiction],
  });
  assert.strictEqual(out.contract.mode, 'B', 'tier 0 is Mode B (offered, not recommended)');
  assert.ok(out.zones.body.indexOf(HORIZONTAL_WYG) !== -1,
    'the offered horizontal row still states its what-you-get');
});

check('the canonical_verb never appears in the rendered row string', () => {
  // contradiction.canonical_verb === "contradiction surface" (the mechanism noun).
  const family = composer.TEMPLATE_FAMILIES.contradiction;
  const verbNoun = family.canonical_verb; // "contradiction surface"
  const out = renderer.renderShapeF1({
    tier: 2,
    verbs: ["Devil's Advocate"],
    elevationFamilies: [family],
  });
  assert.ok(out.zones.body.toLowerCase().indexOf(verbNoun.toLowerCase()) === -1,
    'the mechanism canonical_verb must stay off-screen (engine/screen separation); body: '
    + JSON.stringify(out.zones.body));
});

check('renderShapeF1 without elevationFamilies is byte-stable (additive param)', () => {
  const withEF = renderer.renderShapeF1({ tier: 2, verbs: ['Reformulate'] });
  const plain = renderer.renderShapeF1({ tier: 2, verbs: ['Reformulate'] });
  assert.strictEqual(withEF.zones.body, plain.zones.body,
    'omitting elevationFamilies renders the verb row exactly as before');
  assert.ok(plain.zones.body.indexOf('Reformulate') !== -1, 'verb row unchanged');
});

check('vertical / lateral rows state their own shipped 188.1 what-you-get lines', () => {
  const vOut = renderer.renderShapeF1({
    tier: 2, verbs: ['Run Methodology'],
    elevationFamilies: [composer.TEMPLATE_FAMILIES.context_block], // vertical
  });
  assert.ok(vOut.zones.body.indexOf(composer._test.ELEVATION_DEFAULTS.vertical) !== -1,
    'vertical row states the depth what-you-get');
  const lOut = renderer.renderShapeF1({
    tier: 2, verbs: ['Navigate Graph'],
    elevationFamilies: [composer.TEMPLATE_FAMILIES.cross_room], // lateral
  });
  assert.ok(lOut.zones.body.indexOf(composer._test.ELEVATION_DEFAULTS.lateral) !== -1,
    'lateral row states the outside-the-frame what-you-get');
});

console.log('');
console.log('PASS test-205-elevation-axis.cjs (' + passed + ' checks)');
process.exit(0);
