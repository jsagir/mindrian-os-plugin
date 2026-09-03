#!/usr/bin/env node
'use strict';

/**
 * Phase 257 Plan 01, Task 2 (LOCUS-01, D-03) -- egress_blocked refusal kind
 * shape, status distinctness, no-echo, egress_class coercion, doctor
 * recognition, and no-outage-language proof.
 * ==========================================================================
 * Task 1 minted `egress_blocked` as the sixth REFUSAL_KIND at
 * lib/core/refusal-messaging.cjs. This suite proves the six properties that
 * make it a first-class, honest refusal kind rather than a hand-built shape:
 *
 *   Arm 1 - vocabulary: six members, frozen, rate_limited still at index 4,
 *           egress_blocked last.
 *   Arm 2 - status distinctness: KIND_STATUS.egress_blocked is
 *           BRAIN_EGRESS_BLOCKED and distinct from every other kind's status
 *           (derived by mapping over REFUSAL_KINDS, never a frozen literal --
 *           Pitfall 4 from 257-RESEARCH.md).
 *   Arm 3 - no-echo: a canary planted under message/question/cypher/query
 *           never reaches refusalResponse().reason, renderRefusal(), or
 *           larryRefusalLine('egress_blocked').
 *   Arm 4 - egress_class coercion: an unrecognized class coerces to
 *           'unknown' and the raw value never appears in the reason.
 *   Arm 5 - doctor recognition: every REFUSAL_KINDS status is present in
 *           class-m-brain-smoke.cjs's STRUCTURED_REFUSAL_STATUSES, derived
 *           from REFUSAL_KINDS so a future seventh kind added without a
 *           doctor amendment fails here, not silently.
 *   Arm 6 - no-outage-language: neither renderRefusal nor larryRefusalLine
 *           for egress_blocked contains "unreachable" or "down".
 *
 * node --test, CJS, node:assert/strict only (the tests/test-259 harness).
 * No new deps. No em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const CHOKEPOINT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'refusal-messaging.cjs');
const SMOKE_PATH = path.join(REPO_ROOT, 'lib', 'core', 'doctor', 'class-m-brain-smoke.cjs');

function freshChokepoint() {
  delete require.cache[CHOKEPOINT_PATH];
  return require(CHOKEPOINT_PATH);
}

// ---------------------------------------------------------------------------
// Arm 1: vocabulary.
// ---------------------------------------------------------------------------
test('Arm 1: REFUSAL_KINDS is a frozen six-member array, rate_limited at index 4, egress_blocked last', () => {
  const mod = freshChokepoint();
  assert.deepStrictEqual(
    mod.REFUSAL_KINDS,
    ['no_key', 'unreachable', 'tier_denied', 'not_ready', 'rate_limited', 'egress_blocked']
  );
  assert.equal(mod.REFUSAL_KINDS[4], 'rate_limited');
  assert.equal(mod.REFUSAL_KINDS[mod.REFUSAL_KINDS.length - 1], 'egress_blocked');
  assert.ok(Object.isFrozen(mod.REFUSAL_KINDS));
});

// ---------------------------------------------------------------------------
// Arm 2: status distinctness, derived from REFUSAL_KINDS, never a frozen
// literal list (257-RESEARCH.md Pitfall 4).
// ---------------------------------------------------------------------------
test('Arm 2: egress_blocked status is BRAIN_EGRESS_BLOCKED and distinct from every other kind\'s status', () => {
  const mod = freshChokepoint();
  const statuses = mod.REFUSAL_KINDS.map((kind) => mod.refusalResponse(kind, { tool: 'brain_ask' }).status);
  const egressIdx = mod.REFUSAL_KINDS.indexOf('egress_blocked');
  const egressStatus = statuses[egressIdx];

  assert.equal(egressStatus, 'BRAIN_EGRESS_BLOCKED');

  const others = statuses.filter((_s, i) => i !== egressIdx);
  assert.ok(others.every((s) => s !== egressStatus), 'no other kind may share egress_blocked\'s status');

  // Every status derived this way must be unique, not just egress_blocked's.
  const unique = new Set(statuses);
  assert.equal(unique.size, statuses.length, 'every REFUSAL_KINDS status must be distinct');
});

// ---------------------------------------------------------------------------
// Arm 3: no-echo. A canary planted under each free-form key must never reach
// reason, renderRefusal, or larryRefusalLine.
// ---------------------------------------------------------------------------
test('Arm 3: no-echo -- a canary under message/question/cypher/query never reaches any rendered surface', () => {
  const mod = freshChokepoint();
  const CANARY = 'CANARY7F3A2B dana@acme.io';
  const keys = ['message', 'question', 'cypher', 'query'];

  for (const key of keys) {
    const ctx = { tool: 'brain_ask', egress_class: 'content_set' };
    ctx[key] = CANARY;

    const r = mod.refusalResponse('egress_blocked', ctx);
    assert.ok(!r.reason.includes(CANARY), 'refusalResponse.reason must not echo the canary carried under ' + key);
    assert.ok(!r.reason.includes('dana@acme.io'), 'refusalResponse.reason must not echo the email fragment carried under ' + key);

    const rendered = mod.renderRefusal('egress_blocked', ctx);
    assert.ok(!rendered.includes(CANARY), 'renderRefusal must not echo the canary carried under ' + key);
    assert.ok(!rendered.includes('dana@acme.io'), 'renderRefusal must not echo the email fragment carried under ' + key);
  }

  const line = mod.larryRefusalLine('egress_blocked');
  assert.ok(!line.includes(CANARY), 'larryRefusalLine must never carry a canary -- it takes no ctx at all');
});

// ---------------------------------------------------------------------------
// Arm 4: egress_class coercion. An unrecognized class coerces to 'unknown';
// the raw value never appears in the reason.
// ---------------------------------------------------------------------------
test('Arm 4: unrecognized egress_class coerces to unknown, raw value never appears in the reason', () => {
  const mod = freshChokepoint();
  const r = mod.refusalResponse('egress_blocked', { tool: 'brain_ask', egress_class: 'not_a_real_class' });
  assert.match(r.reason, /unknown/);
  assert.ok(!r.reason.includes('not_a_real_class'));

  // A recognized class from classify()'s real closed set must survive
  // untouched -- coercion only clamps unrecognized values, it does not
  // rewrite legitimate ones.
  const r2 = mod.refusalResponse('egress_blocked', { tool: 'brain_ask', egress_class: 'freeform_unmatched' });
  assert.match(r2.reason, /freeform_unmatched/);
});

// ---------------------------------------------------------------------------
// Arm 5: doctor recognition. Every REFUSAL_KINDS status is present in
// STRUCTURED_REFUSAL_STATUSES, derived from REFUSAL_KINDS so a future
// seventh kind added without a doctor amendment fails here.
// ---------------------------------------------------------------------------
test('Arm 5: every REFUSAL_KINDS status is present in doctor\'s STRUCTURED_REFUSAL_STATUSES', () => {
  const mod = freshChokepoint();
  delete require.cache[SMOKE_PATH];
  const smoke = require(SMOKE_PATH);

  assert.ok(Array.isArray(smoke.STRUCTURED_REFUSAL_STATUSES), 'class-m-brain-smoke.cjs must export STRUCTURED_REFUSAL_STATUSES');

  const missing = [];
  for (const kind of mod.REFUSAL_KINDS) {
    const status = mod.refusalResponse(kind, { tool: 'brain_ask' }).status;
    if (smoke.STRUCTURED_REFUSAL_STATUSES.indexOf(status) === -1) {
      missing.push(kind + ' -> ' + status);
    }
  }
  assert.deepStrictEqual(missing, [], 'every refusal kind\'s status must be recognized by doctor\'s structured-refusal recognizer; missing: ' + missing.join(', '));
});

// ---------------------------------------------------------------------------
// Arm 6: no-outage-language.
// ---------------------------------------------------------------------------
test('Arm 6: egress_blocked copy never says unreachable or down', () => {
  const mod = freshChokepoint();
  const rendered = mod.renderRefusal('egress_blocked', { tool: 'brain_ask' });
  assert.ok(!/unreachable/i.test(rendered), 'renderRefusal must not use the word unreachable');
  assert.ok(!/\bdown\b/i.test(rendered), 'renderRefusal must not use the word down');

  const line = mod.larryRefusalLine('egress_blocked');
  assert.ok(!/unreachable/i.test(line), 'larryRefusalLine must not use the word unreachable');
  assert.ok(!/\bdown\b/i.test(line), 'larryRefusalLine must not use the word down');
});
