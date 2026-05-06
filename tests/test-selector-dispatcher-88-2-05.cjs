/*
 * Phase 88.2-05 -- dispatcher extension assertions for F.0.
 * Existing 88.2-04 19-assertion harness stays untouched.
 *
 * Covers:
 *   - F.0 sub-shape dispatch routes to shape-f0-renderer
 *   - Closed-vocab carve-out preserved (freeTextOffered:false; ensureFreeTextLast skips)
 *   - JUST_TALK refuse inheritance (88.2-04 union check at pickShape entry)
 *   - AskUserQuestion structural-marker trailer attached
 *   - F_SUBSHAPES export contains 'F.0' (and existing F.1-F.5 preserved)
 *   - Regression spot-check: F.1/F.3 dispatch unchanged
 */
'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { pickShape, _internal } = require('../lib/hmi/selector-dispatcher.cjs');

test('F.0 sub-shape dispatch routes to shape-f0-renderer', () => {
  const out = pickShape({ requestedShape: 'F.0', tier: 2, payload: { body: 'apply cascade?' } });
  assert.equal(out.shape, 'F.0');
  assert.deepEqual(out.rendered.contract.verbs, ['Approve', 'Reject', 'Defer']);
});

test('F.0 dispatch preserves closed-vocab carve-out (freeTextOffered:false)', () => {
  const out = pickShape({ requestedShape: 'F.0', tier: 2 });
  assert.equal(out.rendered.contract.freeTextOffered, false);
  // ensureFreeTextLast must NOT have appended a Free-Text verb.
  assert.equal(out.rendered.contract.verbs.indexOf('Free-Text'), -1,
    'F.0 closed-vocab: Free-Text must not be appended');
  assert.equal(out.rendered.contract.verbs.length, 3, 'F.0 must remain exactly 3 verbs');
});

test('F.0 + JUST_TALK refuses with render_v2_compaction_violation', () => {
  const out = pickShape({ requestedShape: 'F.0', operator: 'JUST_TALK', tier: 2 });
  assert.equal(out.shape, 'error');
  assert.equal(out.rendered.error, 'render_v2_compaction_violation');
  assert.equal(out.rendered.requested, 'F.0');
});

test('F.0 carries AskUserQuestion structural-marker trailer', () => {
  const out = pickShape({ requestedShape: 'F.0', tier: 2 });
  assert.ok(typeof out.rendered.askuserquestion_marker === 'string');
  assert.match(out.rendered.askuserquestion_marker, /^\[AskUserQuestion contract: shape=F\.0 verbs=3\]$/);
});

test('F.0 trailer also appears in zones.footer', () => {
  const out = pickShape({ requestedShape: 'F.0', tier: 2 });
  assert.ok(typeof out.rendered.zones.footer === 'string' && out.rendered.zones.footer.length > 0);
  assert.ok(out.rendered.zones.footer.indexOf('AskUserQuestion contract: shape=F.0') !== -1);
});

test('F.0 in F_SUBSHAPES export', () => {
  const list = (_internal && _internal.F_SUBSHAPES) || [];
  assert.ok(list.indexOf('F.0') !== -1, 'F_SUBSHAPES must include F.0');
  // Existing F.1-F.5 strings preserved:
  for (const s of ['F.1','F.2','F.3','F.4','F.5']) {
    assert.ok(list.indexOf(s) !== -1, 'F_SUBSHAPES must still include ' + s);
  }
});

test('F.0 dispatch surfaces caller-supplied parent_decision_id through to contract', () => {
  const out = pickShape({
    requestedShape: 'F.0',
    tier: 2,
    payload: { parent_decision_id: 'node:f4-insight-7', body: 'cascade?' },
  });
  assert.equal(out.rendered.contract.parent_decision_id, 'node:f4-insight-7');
});

test('F.0 contract.shape and recommended:null preserved through dispatcher', () => {
  const out = pickShape({ requestedShape: 'F.0', tier: 2 });
  assert.equal(out.rendered.contract.shape, 'F.0');
  assert.equal(out.rendered.contract.recommended, null);
  assert.equal(out.rendered.contract.border_style, 'single');
});

test('Existing F.1 dispatch unchanged (regression spot-check)', () => {
  const f1 = pickShape({ requestedShape: 'F.1', tier: 2 });
  assert.equal(f1.shape, 'F.1');
});

test('Existing F.3 closed-vocab dispatch unchanged (regression spot-check)', () => {
  const f3 = pickShape({ requestedShape: 'F.3', tier: 2 });
  assert.equal(f3.shape, 'F.3');
  assert.equal(f3.rendered.contract.freeTextOffered, false);
});
