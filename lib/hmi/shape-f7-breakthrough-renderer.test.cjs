/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 120-01 Task 1 -- F.7 Breakthrough Surface renderer test suite.
 *
 * Per 120-01-PLAN.md behavior tests (11 tests):
 *   T1  F7_VERBS verbatim lock (5 strings, exact order, Object.freeze invariant)
 *   T2  F7_DISMISS_INDEX === 3 (zero-indexed position of 'Dismiss')
 *   T3  renderShapeF7Breakthrough happy path (contract envelope)
 *   T4  Two-row layout (title + verbs)
 *   T5  [Dismiss] MANDATORY guard (D-10 -- assertContractInvariants refuses without 'Dismiss')
 *   T6  D-20 HARD FLOOR -- empty artifact_ids returns {error: 'provenance_required'}
 *   T7  "More breakthroughs (N)" affordance (D-11; only when more_count > 0)
 *   T8  Closed-vocab carve-out -- contract.freeTextOffered === false; no Free-Text
 *   T9  formatTimeAnchor buckets (in the last hour / today / this week / etc.)
 *   T10 Canon Part 8 source-grep (zero brain-client / fetch brain.mindrian / cross-room aggregat*)
 *   T11 Em-dash invariant (HARD RULE; zero U+2014 in the renderer source)
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant).
 */
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const RENDERER_PATH = path.resolve(__dirname, 'shape-f7-breakthrough-renderer.cjs');
const renderer = require('./shape-f7-breakthrough-renderer.cjs');
const {
  renderShapeF7Breakthrough,
  F7_VERBS,
  F7_DISMISS_INDEX,
  formatTimeAnchor,
  assertContractInvariants,
  KIND_DISPLAY_NAMES,
} = renderer;

// --- T1: F7_VERBS verbatim lock ---
test('T1: F7_VERBS is the 5 verbs verbatim in exact order', () => {
  assert.deepEqual(F7_VERBS, ['Explore deeper', 'Confirm', 'File as decision', 'Dismiss', 'Back']);
  assert.equal(F7_VERBS.length, 5);
});

test('T1b: F7_VERBS is Object.freeze-d -- mutation does not change the array', () => {
  const before = F7_VERBS.slice();
  // Frozen arrays: push throws in strict mode OR silently no-ops in sloppy mode.
  // Either way, the canonical array contents must be unchanged after the attempt.
  try { F7_VERBS.push('Free-Text'); } catch (_e) { /* expected in strict */ }
  assert.deepEqual(F7_VERBS.slice(0, 5), before);
  assert.equal(F7_VERBS.length, 5, 'mutation must not extend the frozen array');
});

// --- T2: F7_DISMISS_INDEX ---
test('T2: F7_DISMISS_INDEX === 3 (zero-indexed slot of Dismiss in F7_VERBS)', () => {
  assert.equal(F7_DISMISS_INDEX, 3);
  assert.equal(F7_VERBS[F7_DISMISS_INDEX], 'Dismiss');
});

// --- T3: happy path ---
test('T3: renderShapeF7Breakthrough returns canonical {zones, contract} envelope', () => {
  const now = Date.now();
  const out = renderShapeF7Breakthrough({
    tier: 1,
    breakthrough: {
      id: 'bk:1',
      kind: 'convergence',
      theme: 'X',
      confidence: 0.55,
      artifact_ids: ['a1', 'a2', 'a3', 'a4'],
      detected_at: now - 3600 * 1000,
    },
    more_count: 2,
  });
  assert.equal(typeof out, 'object');
  assert.equal(out.contract.shape, 'F.7');
  assert.deepEqual(out.contract.verbs, F7_VERBS);
  assert.equal(out.contract.freeTextOffered, false);
  assert.equal(out.contract.mode, 'closed');
  assert.equal(out.contract.recommended, null);
  assert.equal(out.contract.breakthrough_id, 'bk:1');
  assert.equal(out.contract.more_count, 2);
  assert.equal(typeof out.zones.header, 'string');
  assert.equal(typeof out.zones.body, 'string');
});

// --- T4: two-row layout ---
test('T4: zones.body contains title row + 5-verb row with [X] brackets', () => {
  const now = Date.now();
  const out = renderShapeF7Breakthrough({
    tier: 1,
    breakthrough: {
      id: 'bk:1',
      kind: 'convergence',
      theme: 'X',
      artifact_ids: ['a1', 'a2', 'a3'],
      detected_at: now - 1800 * 1000,
    },
    more_count: 0,
  });
  // Row 1: title with kind capitalized + theme + time anchor
  assert.match(out.zones.body, /Convergence: X/);
  assert.match(out.zones.body, /\(in the last hour\)/i);
  // Row 2: 5 verbs in [X] brackets in the locked order
  assert.match(out.zones.body, /\[Explore deeper\]/);
  assert.match(out.zones.body, /\[Confirm\]/);
  assert.match(out.zones.body, /\[File as decision\]/);
  assert.match(out.zones.body, /\[Dismiss\]/);
  assert.match(out.zones.body, /\[Back\]/);
});

// --- T5: D-10 mandatory Dismiss guard ---
test('T5: assertContractInvariants refuses a verbs array missing Dismiss (D-10 MANDATORY)', () => {
  // Direct invariant call: a verbs array with the same length but Dismiss replaced.
  const broken = ['Explore deeper', 'Confirm', 'File as decision', 'NotDismiss', 'Back'];
  const result = assertContractInvariants(broken);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'dismiss_required');
});

test('T5b: assertContractInvariants refuses a wrong-count verbs array', () => {
  const tooShort = ['Explore deeper', 'Confirm', 'File as decision', 'Dismiss'];
  const r1 = assertContractInvariants(tooShort);
  assert.equal(r1.ok, false);
  assert.equal(r1.reason, 'verb_count_mismatch');

  const wrong = ['Explore deeper', 'wrongverb', 'File as decision', 'Dismiss', 'Back'];
  const r2 = assertContractInvariants(wrong);
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, 'verb_order_mismatch');
});

// --- T6: D-20 HARD FLOOR -- empty artifact_ids ---
test('T6: D-20 HARD FLOOR -- empty artifact_ids returns {error: provenance_required}', () => {
  const out = renderShapeF7Breakthrough({
    tier: 1,
    breakthrough: { id: 'bk:1', kind: 'convergence', theme: 'X', artifact_ids: [], detected_at: Date.now() },
    more_count: 0,
  });
  assert.equal(typeof out, 'object');
  assert.equal(out.error, 'provenance_required');
  assert.equal(out.zones, undefined);
  assert.equal(out.contract, undefined);
});

test('T6b: missing breakthrough returns provenance_required', () => {
  const out = renderShapeF7Breakthrough({ tier: 1, more_count: 0 });
  assert.equal(out.error, 'provenance_required');
});

test('T6c: artifact_ids not an array returns provenance_required', () => {
  const out = renderShapeF7Breakthrough({
    tier: 1,
    breakthrough: { id: 'bk:1', kind: 'convergence', theme: 'X', artifact_ids: 'not-array', detected_at: Date.now() },
    more_count: 0,
  });
  assert.equal(out.error, 'provenance_required');
});

// --- T7: More breakthroughs (N) affordance ---
test('T7: more_count > 0 renders "More breakthroughs (N)" in zones.footer', () => {
  const out = renderShapeF7Breakthrough({
    tier: 1,
    breakthrough: { id: 'bk:1', kind: 'convergence', theme: 'X', artifact_ids: ['a1'], detected_at: Date.now() },
    more_count: 2,
  });
  assert.match(out.zones.footer, /More breakthroughs \(2\)/);
});

test('T7b: more_count === 0 leaves zones.footer empty (no affordance)', () => {
  const out = renderShapeF7Breakthrough({
    tier: 1,
    breakthrough: { id: 'bk:1', kind: 'convergence', theme: 'X', artifact_ids: ['a1'], detected_at: Date.now() },
    more_count: 0,
  });
  assert.equal(out.zones.footer.indexOf('More breakthroughs'), -1);
});

// --- T8: closed-vocab carve-out ---
test('T8: contract.freeTextOffered === false; verbs does NOT contain Free-Text', () => {
  const out = renderShapeF7Breakthrough({
    tier: 1,
    breakthrough: { id: 'bk:1', kind: 'convergence', theme: 'X', artifact_ids: ['a1'], detected_at: Date.now() },
    more_count: 0,
  });
  assert.equal(out.contract.freeTextOffered, false);
  assert.equal(out.contract.verbs.indexOf('Free-Text'), -1);
  assert.equal(out.contract.verbs.length, 5);
});

// --- T9: formatTimeAnchor buckets ---
test('T9: formatTimeAnchor returns the correct bucket string per age', () => {
  const now = Date.now();
  // < 1 hour -> "in the last hour"
  assert.equal(formatTimeAnchor(now - 30 * 60 * 1000), 'in the last hour');
  // 1-8 hours -> "in the last N hours"
  assert.match(formatTimeAnchor(now - 4 * 3600 * 1000), /in the last \d+ hours/);
  // 8-24 hours -> "today"
  assert.equal(formatTimeAnchor(now - 12 * 3600 * 1000), 'today');
  // 1-2 days -> "in the last day"
  assert.equal(formatTimeAnchor(now - 36 * 3600 * 1000), 'in the last day');
  // 2-7 days -> "this week"
  assert.equal(formatTimeAnchor(now - 4 * 24 * 3600 * 1000), 'this week');
  // 7-14 days -> "in the last two weeks"
  assert.equal(formatTimeAnchor(now - 10 * 24 * 3600 * 1000), 'in the last two weeks');
  // > 14 days -> "on YYYY-MM-DD"
  assert.match(formatTimeAnchor(now - 30 * 24 * 3600 * 1000), /^on \d{4}-\d{2}-\d{2}$/);
});

// --- T10: Canon Part 8 source-grep ---
test('T10: Canon Part 8 invariant -- zero brain-client / brain.mindrian / cross-room aggregat in renderer source', () => {
  const src = fs.readFileSync(RENDERER_PATH, 'utf8');
  assert.equal(/require\([^)]*brain-client[^)]*\)/.test(src), false, 'must not require brain-client');
  assert.equal(/fetch\([^)]*brain\.mindrian[^)]*\)/.test(src), false, 'must not fetch brain.mindrian');
  assert.equal(/cross.{0,3}room.{0,3}aggregat/i.test(src), false, 'must not mention cross-room aggregat');
});

// --- T11: em-dash invariant ---
test('T11: em-dash invariant -- zero U+2014 in renderer source (HARD RULE)', () => {
  const src = fs.readFileSync(RENDERER_PATH, 'utf8');
  // U+2014 is the em-dash. The test file itself avoids the literal char so this
  // suite stays em-dash-free.
  const emDash = String.fromCharCode(0x2014);
  assert.equal(src.indexOf(emDash), -1, 'renderer source must contain zero em-dashes');
});

// --- Bonus: KIND_DISPLAY_NAMES sanity ---
test('Bonus: KIND_DISPLAY_NAMES covers the four known detector kinds', () => {
  assert.equal(KIND_DISPLAY_NAMES.convergence, 'Convergence');
  assert.equal(KIND_DISPLAY_NAMES.contradiction_resolved, 'Contradiction resolved');
  assert.equal(KIND_DISPLAY_NAMES.cross_domain_analogy, 'Cross-domain analogy');
  assert.equal(KIND_DISPLAY_NAMES.reverse_salient_closed, 'Reverse salient closed');
});
