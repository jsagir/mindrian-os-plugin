/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 120-01 Task 2 -- dispatcher F.7 sub-shape integration test harness.
 *
 * Covers the 8 behavior tests from 120-01-PLAN.md Task 2:
 *   T1 F_SUBSHAPES extension: literal 'F.7' present as the 8th entry
 *   T2 dispatchShapeFSubShape F.7 happy path returns {shape:'F.7', rendered:{...}}
 *   T3 closed-vocab carve-out preserved (Free-Text NOT appended to F.7)
 *   T4 D-20 HARD FLOOR propagates through dispatcher as {shape:'error', rendered:{error:'provenance_required'}}
 *   T5 F.7 missing-renderer graceful degradation -- exercised indirectly via grep
 *   T6 F.6 plan-review byte-stability invariant -- existing path unchanged
 *   T7 umbrella 'F' dispatch unchanged -- F.7 NOT in JTBD fallback path
 *   T8 selector_presentation telemetry emitted with sub_shape='F.7' when opted in
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

// --- T1: F_SUBSHAPES extension ---
test('T1: F_SUBSHAPES contains F.7 as the 8th entry', () => {
  const subShapes = _internal.F_SUBSHAPES;
  assert.ok(Array.isArray(subShapes));
  assert.equal(subShapes.length, 8);
  assert.equal(subShapes[7], 'F.7');
  // Pre-existing 7 entries preserved byte-stable (R1 invariant).
  assert.deepEqual(subShapes.slice(0, 7), ['F.0', 'F.1', 'F.2', 'F.3', 'F.4', 'F.5', 'F.6']);
});

test('T1b: F_SUBSHAPES literal "F.7" appears in selector-dispatcher.cjs source', () => {
  const src = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  // At least one occurrence in the F_SUBSHAPES array literal + one in the dispatch branch.
  const matches = src.match(/'F\.7'/g) || [];
  assert.ok(matches.length >= 2, 'expected >= 2 occurrences of \'F.7\' in dispatcher source, got ' + matches.length);
});

test('T1c: shape-f7-breakthrough-renderer require landed in dispatcher source', () => {
  const src = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  assert.match(src, /shape-f7-breakthrough-renderer/);
});

// --- T2: F.7 happy path ---
test('T2: pickShape({requestedShape:F.7, ...}) returns {shape:F.7, rendered:{...}}', () => {
  const out = pickShape({
    requestedShape: 'F.7',
    roomDir: '/tmp/non-existent-120-01-test-room',
    tier: 1,
    payload: {
      breakthrough: {
        id: 'bk:1',
        kind: 'convergence',
        theme: 'X',
        artifact_ids: ['a1', 'a2', 'a3'],
        detected_at: Date.now(),
      },
      more_count: 0,
    },
  });
  assert.equal(out.shape, 'F.7');
  assert.equal(out.rendered.contract.shape, 'F.7');
  assert.deepEqual(out.rendered.contract.verbs, ['Explore deeper', 'Confirm', 'File as decision', 'Dismiss', 'Back']);
  assert.equal(out.rendered.contract.breakthrough_id, 'bk:1');
});

// --- T3: closed-vocab carve-out preserved ---
test('T3: F.7 closed-vocab -- Free-Text NOT appended; exactly 5 verbs', () => {
  const out = pickShape({
    requestedShape: 'F.7',
    roomDir: '/tmp/non-existent-120-01-test-room',
    tier: 1,
    payload: {
      breakthrough: {
        id: 'bk:1',
        kind: 'convergence',
        theme: 'X',
        artifact_ids: ['a1'],
        detected_at: Date.now(),
      },
      more_count: 0,
    },
  });
  assert.equal(out.rendered.contract.verbs.length, 5);
  assert.equal(out.rendered.contract.verbs.indexOf('Free-Text'), -1);
  assert.equal(out.rendered.contract.freeTextOffered, false);
});

// --- T4: D-20 HARD FLOOR propagation ---
test('T4: F.7 empty artifact_ids -> {shape:error, rendered:{error:provenance_required}}', () => {
  const out = pickShape({
    requestedShape: 'F.7',
    roomDir: '/tmp/non-existent-120-01-test-room',
    tier: 1,
    payload: {
      breakthrough: { id: 'bk:1', artifact_ids: [] },
    },
  });
  assert.equal(out.shape, 'error');
  assert.equal(out.rendered.error, 'provenance_required');
});

test('T4b: F.7 missing breakthrough -> {shape:error, rendered:{error:provenance_required}}', () => {
  const out = pickShape({
    requestedShape: 'F.7',
    roomDir: '/tmp/non-existent-120-01-test-room',
    tier: 1,
    payload: {},
  });
  assert.equal(out.shape, 'error');
  assert.equal(out.rendered.error, 'provenance_required');
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

// --- T5: F.7 missing-renderer path (cannot easily simulate; verify source structure) ---
test('T5: F.7 missing-renderer path has graceful degradation via safeRequire', () => {
  const src = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  // The F.7 branch lazy-requires via safeRequire -- inherits the no-subshape-renderer
  // error envelope from the existing dispatcher path (lines around 359-367).
  assert.match(src, /safeRequire\(['"]\.\/shape-f7-breakthrough-renderer\.cjs['"]\)/);
});

// --- T8: telemetry mirror (recordPresentation called with sub_shape='F.7' when opted in) ---
test('T8: F.7 dispatch emits selector_presentation telemetry with sub_shape=F.7 when emitTelemetry:true', () => {
  // Monkey-patch the selector-telemetry module's cache entry so we can capture
  // the call. The dispatcher pulls the module via safeRequire('./selector-telemetry.cjs')
  // which goes through the standard require cache.
  const telPath = path.resolve(__dirname, '..', 'lib', 'hmi', 'selector-telemetry.cjs');
  const tel = require(telPath);
  const original = tel.recordPresentation;
  let captured = null;
  tel.recordPresentation = function (roomDir, record) { captured = { roomDir: roomDir, record: record }; };
  try {
    pickShape({
      requestedShape: 'F.7',
      roomDir: '/tmp/non-existent-120-01-test-room',
      tier: 1,
      payload: {
        emitTelemetry: true,
        breakthrough: {
          id: 'bk:1',
          kind: 'convergence',
          theme: 'X',
          artifact_ids: ['a1'],
          detected_at: Date.now(),
        },
        more_count: 0,
      },
    });
  } finally {
    tel.recordPresentation = original;
  }
  assert.ok(captured, 'recordPresentation must be called when emitTelemetry:true');
  assert.equal(captured.record.sub_shape, 'F.7');
  assert.equal(captured.record.options_count, 5);
  assert.equal(captured.record.recommended_present, false);
});

// --- Bonus: Phase 120-01 provenance comment landed ---
test('Bonus: Phase 120-01 provenance comment landed in dispatcher', () => {
  const src = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  assert.match(src, /Phase 120-01/);
});
