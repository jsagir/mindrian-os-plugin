/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 88.2-06 Task 3 -- dispatcher F.6 sub-shape integration test harness.
 *
 * Covers:
 *   - F_SUBSHAPES list extended with 'F.6' (88.2-05 added 'F.0'; this plan adds 'F.6')
 *   - Explicit requestedShape:'F.6' routes to lib/hmi/shape-f6-plan-review-renderer.cjs
 *     (NOT to Phase 101-01 lib/hmi/shape-f6-renderer.cjs)
 *   - Closed-vocab carve-out preserved (freeTextOffered:false; no Free-Text appended)
 *   - JUST_TALK refuse inheritance (operator gate at pickShape entry catches F.6)
 *   - AskUserQuestion structural-marker trailer attached: shape=F.6 verbs=3
 *   - Umbrella 'F' branch byte-stable (still routes via JTBD logic to Phase 101-01)
 *   - R1 invariant: lib/hmi/shape-f6-renderer.cjs sha256 byte-equal pre/post
 *
 * Implementing plan: .planning/phases/88.2-uiux-selector-block/88.2-06-PLAN.md (Task 3)
 */
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const dispatcherMod = require('../lib/hmi/selector-dispatcher.cjs');
const { pickShape } = dispatcherMod;

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

test('F.6 explicit dispatch routes to plan-review renderer (NOT Phase 101-01)', () => {
  const out = pickShape({
    requestedShape: 'F.6',
    tier: 2,
    payload: { position: 7, totalQuestions: 20, claim: 'Phase 89 ships rs-external Pinecone' },
  });
  assert.equal(out.shape, 'F.6');
  assert.deepEqual(out.rendered.contract.verbs, ['Confirm', 'Reject', 'Discuss']);
  assert.equal(out.rendered.contract.border_style, 'double');
  // Plan-review-renderer-specific contract field that Phase 101-01 does NOT carry:
  assert.equal(out.rendered.contract.total_questions, 20);
});

test('F.6 closed-vocab carve-out preserved (freeTextOffered:false; no Free-Text appended)', () => {
  const out = pickShape({
    requestedShape: 'F.6',
    tier: 2,
    payload: { position: 1, totalQuestions: 20 },
  });
  assert.equal(out.rendered.contract.freeTextOffered, false);
  assert.equal(out.rendered.contract.verbs.indexOf('Free-Text'), -1,
    'F.6 must NOT have Free-Text appended (closed-vocab carve-out)');
  assert.equal(out.rendered.contract.verbs.length, 3,
    'F.6 must have exactly 3 verbs (Confirm/Reject/Discuss)');
});

test('F.6 + JUST_TALK refuses with render_v2_compaction_violation', () => {
  const out = pickShape({
    requestedShape: 'F.6',
    operator: 'JUST_TALK',
    tier: 2,
  });
  assert.equal(out.shape, 'error');
  assert.equal(out.rendered.error, 'render_v2_compaction_violation');
});

test('F.6 carries AskUserQuestion structural-marker trailer (shape=F.6 verbs=3)', () => {
  const out = pickShape({
    requestedShape: 'F.6',
    tier: 2,
    payload: { position: 1, totalQuestions: 20 },
  });
  assert.match(out.rendered.askuserquestion_marker,
    /^\[AskUserQuestion contract: shape=F\.6 verbs=3\]$/);
  // Footer surface should also carry the trailer.
  assert.ok(out.rendered.zones.footer && out.rendered.zones.footer.indexOf('shape=F.6 verbs=3') !== -1,
    'zones.footer must include the trailer');
});

test('F.6 in F_SUBSHAPES export (after 88.2-05 F.0 + this plan F.6)', () => {
  const list = (dispatcherMod._internal && dispatcherMod._internal.F_SUBSHAPES) || dispatcherMod.F_SUBSHAPES;
  assert.ok(Array.isArray(list), 'F_SUBSHAPES must be an array (got ' + typeof list + ')');
  for (const s of ['F.0', 'F.1', 'F.2', 'F.3', 'F.4', 'F.5', 'F.6']) {
    assert.ok(list.indexOf(s) !== -1, 'F_SUBSHAPES must include ' + s);
  }
});

test('F.6 personaContext flows through dispatcher to renderer (founder lens suffix)', () => {
  const out = pickShape({
    requestedShape: 'F.6',
    tier: 2,
    payload: {
      position: 1, totalQuestions: 20,
      claim: 'always emit edges',
      personaContext: 'founder',
    },
  });
  assert.equal(out.shape, 'F.6');
  assert.ok(out.rendered.zones.header.indexOf('(founder lens)') !== -1,
    'header must include "(founder lens)" suffix; got: ' + out.rendered.zones.header);
  assert.equal(out.rendered.contract.personaContext, 'founder');
});

test('F.6 round_id pass-through from payload to contract', () => {
  const out = pickShape({
    requestedShape: 'F.6',
    tier: 2,
    payload: { position: 1, totalQuestions: 20, round_id: 'round-uuid-pass-through' },
  });
  assert.equal(out.rendered.contract.round_id, 'round-uuid-pass-through');
});

test('Umbrella F still routes to Phase 101-01 (NOT plan-review renderer)', () => {
  const out = pickShape({ requestedShape: 'F', tier: 2 });
  // Umbrella 'F' resolves via JTBD to F.6 (Phase 101-01) or F.1 (fallback) -- both legitimate.
  // The load-bearing assertion: it does NOT route to the plan-review renderer, which
  // would leak total_questions or position scalars on the contract envelope.
  if (out.shape === 'F.6') {
    assert.equal(out.rendered.contract.total_questions, undefined,
      'umbrella F -> F.6 must NOT carry total_questions (plan-review-renderer-specific field)');
    assert.equal(out.rendered.contract.position, undefined,
      'umbrella F -> F.6 must NOT carry position (plan-review-renderer-specific field)');
  }
});

test('F.6 mode B (tier 1) prepends Brain-unreachable Zone-1 prefix to header', () => {
  const out = pickShape({
    requestedShape: 'F.6',
    tier: 1,
    payload: { position: 1, totalQuestions: 20 },
  });
  assert.equal(out.shape, 'F.6');
  // Mode B prefix is applied at the dispatcher level; verify a marker appears in header.
  assert.ok(out.rendered.zones.header.indexOf('Brain unreachable') !== -1,
    'Mode B header must include the Brain-unreachable prefix; got: ' + out.rendered.zones.header);
});

test('R1 invariant: Phase 101-01 lib/hmi/shape-f6-renderer.cjs sha256 byte-equal pre/post (Wave-2 close)', () => {
  const expected = '1792535860abc791222bf0ecf59599d66e49ad9cc1606b3d8679fca2922150cf';
  const actual = sha256File(path.resolve(__dirname, '..', 'lib', 'hmi', 'shape-f6-renderer.cjs'));
  assert.equal(actual, expected,
    'lib/hmi/shape-f6-renderer.cjs (Phase 101-01 JTBD-aware Next Move) MUST be byte-equal pre/post Phase 88.2-06 (R1 collision invariant)');
});

test('Regression spot-check: F.0 still dispatches (88.2-05 contract preserved)', () => {
  const out = pickShape({
    requestedShape: 'F.0',
    tier: 2,
    payload: { body: 'apply the cascade?' },
  });
  assert.equal(out.shape, 'F.0');
  assert.deepEqual(out.rendered.contract.verbs, ['Approve', 'Reject', 'Defer']);
  assert.equal(out.rendered.contract.border_style, 'single');
});

test('Regression spot-check: F.1 still dispatches (88.2-01 + 88.2-04 contract preserved)', () => {
  const out = pickShape({
    requestedShape: 'F.1',
    tier: 2,
  });
  assert.equal(out.shape, 'F.1');
  // F.1 is open-vocab; Free-Text MUST be the last verb.
  const verbs = out.rendered.contract.verbs;
  assert.equal(verbs[verbs.length - 1], 'Free-Text');
});
