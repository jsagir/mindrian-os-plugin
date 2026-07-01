/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 120-01 Task 2 -- dispatcher F.7 sub-shape integration test harness.
 *
 * Phase 188-01 (SFS-06) REPOINT: bare 'F.7' is the CANONICAL DIAL now, NOT the
 *   Breakthrough Surface (D-10 canonical ten). The breakthrough render CONTRACT
 *   (closed-vocab 5 verbs verbatim + the D-20 provenance HARD FLOOR) is retained
 *   in lib/hmi/shape-f7-breakthrough-renderer.cjs and is now tested DIRECTLY
 *   against that module rather than through a bare-F.7 dispatch. The bare-F.7 ->
 *   dial routing is covered by lib/hmi/selector-dispatcher.test.cjs (the SFS-06
 *   canonical test). This file keeps the still-valid F_SUBSHAPES / F.6 / umbrella
 *   invariants and repoints the breakthrough-contract tests to the module.
 *
 * Mirrors tests/test-selector-dispatcher-88-2-06.cjs (the F.6 plan-review precedent).
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant).
 */
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const DISPATCHER_PATH = path.resolve(__dirname, '..', 'lib', 'hmi', 'selector-dispatcher.cjs');
const dispatcherMod = require('../lib/hmi/selector-dispatcher.cjs');
const { pickShape, _internal } = dispatcherMod;
const breakthroughRenderer = require('../lib/hmi/shape-f7-breakthrough-renderer.cjs');

// --- T1: F_SUBSHAPES extension ---
test('T1: F_SUBSHAPES contains F.7 as the 8th entry', () => {
  const subShapes = _internal.F_SUBSHAPES;
  assert.ok(Array.isArray(subShapes));
  // Phase 177-02 additively appended 'F.7-dial' (the four-arrow register HUD
  // branch, BCH-10/BCH-16) as the 9th entry. F.7 stays the 8th entry (index 7)
  // and the prior 7 stay byte-stable, so the 120-01 R1 invariant holds.
  assert.equal(subShapes.length, 9);
  assert.equal(subShapes[7], 'F.7');
  assert.equal(subShapes[8], 'F.7-dial');
  // Pre-existing 7 entries preserved byte-stable (R1 invariant).
  assert.deepEqual(subShapes.slice(0, 7), ['F.0', 'F.1', 'F.2', 'F.3', 'F.4', 'F.5', 'F.6']);
});

test('T1b: F_SUBSHAPES literal "F.7" appears in selector-dispatcher.cjs source', () => {
  const src = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  // At least one occurrence in the F_SUBSHAPES array literal + one in the dispatch branch.
  const matches = src.match(/'F\.7'/g) || [];
  assert.ok(matches.length >= 2, 'expected >= 2 occurrences of \'F.7\' in dispatcher source, got ' + matches.length);
});

test('T1c: shape-f7-breakthrough-renderer referenced in dispatcher source (retained-module note)', () => {
  const src = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  // SFS-06: the retired-branch comment documents the historic route; the module
  // stays live as the verb-set home even though bare F.7 no longer wires it.
  assert.match(src, /shape-f7-breakthrough-renderer/);
});

// --- T2 (repointed): breakthrough render CONTRACT via the retained module ---
test('T2: renderShapeF7Breakthrough returns the closed-vocab breakthrough contract', () => {
  const out = breakthroughRenderer.renderShapeF7Breakthrough({
    tier: 1,
    breakthrough: {
      id: 'bk:1',
      kind: 'convergence',
      theme: 'X',
      artifact_ids: ['a1', 'a2', 'a3'],
      detected_at: Date.now(),
    },
    more_count: 0,
  });
  assert.equal(out.contract.shape, 'F.7');
  assert.deepEqual(out.contract.verbs, ['Explore deeper', 'Confirm', 'File as decision', 'Dismiss', 'Back']);
  assert.equal(out.contract.breakthrough_id, 'bk:1');
});

// --- T2-dial (SFS-06): bare F.7 dispatch now yields the dial ---
test('T2-dial: pickShape(F.7) returns the dial render (SFS-06 collapse)', () => {
  const out = pickShape({
    requestedShape: 'F.7',
    roomDir: '/tmp/non-existent-120-01-test-room',
    tier: 1,
    payload: { investment_level: 0.5, posture: 'hold' },
  });
  assert.equal(out.shape, 'F.7');
  assert.equal(out.rendered.shape, 'F.7-dial');
  assert.ok(out.rendered.hud);
});

// --- T3 (repointed): closed-vocab carve-out preserved on the module ---
test('T3: F.7 closed-vocab -- Free-Text NOT appended; exactly 5 verbs', () => {
  const out = breakthroughRenderer.renderShapeF7Breakthrough({
    tier: 1,
    breakthrough: {
      id: 'bk:1',
      kind: 'convergence',
      theme: 'X',
      artifact_ids: ['a1'],
      detected_at: Date.now(),
    },
    more_count: 0,
  });
  assert.equal(out.contract.verbs.length, 5);
  assert.equal(out.contract.verbs.indexOf('Free-Text'), -1);
  assert.equal(out.contract.freeTextOffered, false);
});

// --- T4 (repointed): D-20 HARD FLOOR on the retained module ---
test('T4: F.7 empty artifact_ids -> {error:provenance_required}', () => {
  const out = breakthroughRenderer.renderShapeF7Breakthrough({
    tier: 1,
    breakthrough: { id: 'bk:1', artifact_ids: [] },
  });
  assert.equal(out.error, 'provenance_required');
});

test('T4b: F.7 missing breakthrough -> {error:provenance_required}', () => {
  const out = breakthroughRenderer.renderShapeF7Breakthrough({ tier: 1 });
  assert.equal(out.error, 'provenance_required');
});

// --- T6: F.6 plan-review byte-stability invariant ---
test('T6: F.6 plan-review path unchanged after F.7 addition (R1 byte-stability)', () => {
  const out = pickShape({
    requestedShape: 'F.6',
    roomDir: '/tmp/non-existent-120-01-test-room',
    tier: 2,
    payload: {
      round_id: 'r1',
      position: 1,
      totalQuestions: 5,
      claim: 'test claim',
      counts: {},
    },
  });
  assert.equal(out.shape, 'F.6');
  assert.deepEqual(out.rendered.contract.verbs, ['Confirm', 'Reject', 'Discuss']);
});

// --- T7: umbrella 'F' dispatch unchanged ---
test('T7: umbrella F dispatch routes to F.1/F.6 only (NOT F.7)', () => {
  // No JTBD set + no F.6 resolution -> F.1 fallback. Should NOT touch F.7.
  const out = pickShape({
    requestedShape: 'F',
    roomDir: '/tmp/non-existent-120-01-test-room',
    tier: 1,
    payload: {},
  });
  // The umbrella path picks F.1 (fallback) or F.6 (JTBD-aware) only.
  assert.ok(out.shape === 'F.1' || out.shape === 'F.6' || out.shape === 'error',
    'umbrella F must NOT resolve to F.7; got ' + out.shape);
  assert.notEqual(out.shape, 'F.7');
});

// --- T5 (repointed): bare F.7 branch delegates to the dial, not the renderer ---
test('T5: bare F.7 branch wires dial-selector.cjs::renderDialShape (SFS-06)', () => {
  const src = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  const branchIdx = src.indexOf("requestedShape === 'F.7'");
  assert.ok(branchIdx !== -1);
  const branch = src.slice(branchIdx, branchIdx + 900);
  assert.match(branch, /safeRequire\(['"]\.\/dial-selector\.cjs['"]\)/);
  assert.match(branch, /renderDialShape/);
});

// --- Bonus: Phase 188-01 SFS-06 collapse comment landed ---
test('Bonus: Phase 188-01 SFS-06 comment landed in dispatcher', () => {
  const src = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  assert.match(src, /188-01|SFS-06/);
});
