/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 188-01 (SFS-06) -- the Breakthrough Surface collapse dispatcher test.
 *
 * Contract (from 188-00 scaffolding + 188-01-PLAN.md):
 *   1. pickShape({requestedShape:'F.7'}) returns a DIAL render (bare F.7 is the
 *      canonical dial now, NOT the breakthrough renderer).
 *   2. NO code path returns a Breakthrough-shape render for bare F.7 (no
 *      closed-vocab 5-verb contract; no provenance_required error envelope).
 *   3. 'F.7-dial' still works (F.7's render path, unchanged).
 *   4. The provenance HARD FLOOR is preserved at the retained renderer home:
 *      renderShapeF7Breakthrough still refuses provenance-less content.
 *   5. Source: the bare-F.7 branch delegates to dial-selector.cjs::renderDialShape;
 *      the breakthrough renderer is no longer wired behind bare F.7.
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant).
 */
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const DISPATCHER_PATH = path.resolve(__dirname, 'selector-dispatcher.cjs');
const { pickShape, _internal } = require('./selector-dispatcher.cjs');
const breakthroughRenderer = require('./shape-f7-breakthrough-renderer.cjs');

const NON_ROOM = '/tmp/non-existent-188-01-test-room';

// --- 1: bare F.7 routes to the dial ---
test('SFS-06 T1: pickShape(F.7) returns a dial render, not a breakthrough render', () => {
  const out = pickShape({
    requestedShape: 'F.7',
    roomDir: NON_ROOM,
    tier: 1,
    payload: { investment_level: 0.5, posture: 'hold' },
  });
  assert.equal(out.shape, 'F.7');
  assert.ok(out.rendered && typeof out.rendered === 'object', 'rendered must be an object');
  // The dial render carries a { shape:'F.7-dial', hud, zones } envelope.
  assert.equal(out.rendered.shape, 'F.7-dial');
  assert.ok(out.rendered.hud, 'dial render must carry a hud');
});

// --- 2: no breakthrough path for bare F.7 ---
test('SFS-06 T2: bare F.7 never returns a Breakthrough-shape render', () => {
  const out = pickShape({
    requestedShape: 'F.7',
    roomDir: NON_ROOM,
    tier: 1,
    payload: {
      // A well-formed breakthrough payload MUST NOT resurrect the retired surface.
      breakthrough: {
        id: 'bk:1',
        kind: 'convergence',
        theme: 'X',
        artifact_ids: ['a1', 'a2'],
        detected_at: Date.now(),
      },
      more_count: 0,
    },
  });
  // Not the breakthrough contract (no closed-vocab 5-verb array).
  const contract = out.rendered && out.rendered.contract;
  const verbs = contract && contract.verbs;
  assert.notDeepEqual(verbs, ['Explore deeper', 'Confirm', 'File as decision', 'Dismiss', 'Back']);
  // Still a dial render.
  assert.equal(out.rendered.shape, 'F.7-dial');
});

test('SFS-06 T2b: provenance-less payload on bare F.7 does NOT emit provenance_required', () => {
  // Under the retired breakthrough branch, empty artifact_ids returned
  // {shape:'error', rendered:{error:'provenance_required'}}. The dial has no such
  // gate, so bare F.7 renders the dial regardless of any breakthrough payload.
  const out = pickShape({
    requestedShape: 'F.7',
    roomDir: NON_ROOM,
    tier: 1,
    payload: { breakthrough: { id: 'bk:1', artifact_ids: [] } },
  });
  assert.notEqual(out.shape, 'error');
  assert.equal(out.rendered.shape, 'F.7-dial');
});

// --- 3: F.7-dial still works ---
test('SFS-06 T3: F.7-dial render path is unchanged', () => {
  const out = pickShape({
    requestedShape: 'F.7-dial',
    roomDir: NON_ROOM,
    tier: 1,
    payload: { investment_level: 0.5, posture: 'hold' },
  });
  assert.equal(out.shape, 'F.7-dial');
  assert.equal(out.rendered.shape, 'F.7-dial');
  assert.ok(out.rendered.hud);
});

// --- 4: provenance HARD FLOOR preserved at the retained renderer home ---
test('SFS-06 T4: renderShapeF7Breakthrough still refuses provenance-less content', () => {
  const empty = breakthroughRenderer.renderShapeF7Breakthrough({
    tier: 1,
    breakthrough: { id: 'bk:1', artifact_ids: [] },
  });
  assert.equal(empty.error, 'provenance_required');

  const missing = breakthroughRenderer.renderShapeF7Breakthrough({ tier: 1 });
  assert.equal(missing.error, 'provenance_required');

  // The frozen 5-verb set survives as the definitional home of the verb vocab.
  assert.deepEqual(
    breakthroughRenderer.F7_VERBS.slice(),
    ['Explore deeper', 'Confirm', 'File as decision', 'Dismiss', 'Back']
  );
});

// --- 5: source-structure assertions ---
test('SFS-06 T5: bare F.7 branch delegates to dial-selector.cjs::renderDialShape', () => {
  const src = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  // Locate the bare-F.7 branch and assert it now wires the dial renderer.
  const branchIdx = src.indexOf("requestedShape === 'F.7'");
  assert.ok(branchIdx !== -1, 'the bare-F.7 branch must exist');
  const branch = src.slice(branchIdx, branchIdx + 900);
  assert.match(branch, /dial-selector\.cjs/);
  assert.match(branch, /renderDialShape/);
  // The retired breakthrough renderer must NOT be the active require in this branch.
  assert.ok(
    branch.indexOf("safeRequire('./shape-f7-breakthrough-renderer.cjs')") === -1,
    'bare F.7 must not safeRequire the breakthrough renderer'
  );
});

// --- 6: F_SUBSHAPES registry integrity ---
test('SFS-06 T6: F_SUBSHAPES still lists F.7 and F.7-dial (byte-stable prefix)', () => {
  const subShapes = _internal.F_SUBSHAPES;
  assert.ok(Array.isArray(subShapes));
  assert.deepEqual(subShapes.slice(0, 7), ['F.0', 'F.1', 'F.2', 'F.3', 'F.4', 'F.5', 'F.6']);
  assert.ok(subShapes.indexOf('F.7') !== -1);
  assert.ok(subShapes.indexOf('F.7-dial') !== -1);
});
