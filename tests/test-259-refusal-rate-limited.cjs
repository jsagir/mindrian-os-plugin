#!/usr/bin/env node
'use strict';

/**
 * Phase 259 Plan 02 (TRUST-01, F-09 Option B) -- rate_limited as the fifth
 * refusal kind, closing the coercion trap.
 * ==========================================================================
 * lib/core/refusal-messaging.cjs holds a frozen four-member REFUSAL_KINDS
 * enum, and refusalResponse/renderRefusal/larryRefusalLine all coerce any
 * unrecognized kind to 'unreachable'. Plan 259-01's new rate_limited
 * sentinel would fall through that coercion the moment anything renders it
 * through this module -- TRUST-01's own bug, one layer up. This suite
 * proves the coercion trap is closed: rate_limited is now IN the enum, gets
 * its own status/reason/next_moves/render copy/larry line, and unknown
 * kinds still coerce defensively.
 *
 * Skeleton copied from tests/test-250-refusal-shapes.cjs (freshChokepoint
 * require-cache helper). No new deps. No em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const CHOKEPOINT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'refusal-messaging.cjs');

function freshChokepoint() {
  delete require.cache[CHOKEPOINT_PATH];
  return require(CHOKEPOINT_PATH);
}

test('REFUSAL_KINDS is a frozen five-member array ending in rate_limited', () => {
  const mod = freshChokepoint();
  assert.deepStrictEqual(mod.REFUSAL_KINDS, ['no_key', 'unreachable', 'tier_denied', 'not_ready', 'rate_limited'], 'rate_limited must be appended last, the original four unchanged');
  assert.ok(Object.isFrozen(mod.REFUSAL_KINDS), 'REFUSAL_KINDS must still be frozen');
});

test('RED PROOF (coercion trap closure): refusalResponse(rate_limited) must not coerce to BRAIN_UNREACHABLE', () => {
  const mod = freshChokepoint();
  const r = mod.refusalResponse('rate_limited', { tool: 'brain_query' });
  assert.notEqual(r.status, 'BRAIN_UNREACHABLE', 'RED PROOF: a rate_limited sentinel must not render as BRAIN_UNREACHABLE -- that is TRUST-01\'s own bug, one layer up');
  assert.equal(r.status, 'BRAIN_RATE_LIMITED', 'rate_limited must map to its own status');
});

test('refusalResponse(rate_limited) full shape: kind, command_context, next_moves array, no upgrade_hint', () => {
  const mod = freshChokepoint();
  const r = mod.refusalResponse('rate_limited', { tool: 'brain_query' });
  assert.equal(r.kind, 'rate_limited');
  assert.equal(r.command_context, 'brain_query');
  assert.ok(Array.isArray(r.next_moves) && r.next_moves.length > 0, 'next_moves must be a non-empty array');
  assert.equal(r.upgrade_hint, undefined, 'upgrade_hint stays exclusive to no_key');
});

test('refusalResponse(rate_limited) reason names the wait when retry_after_s is provided, and stays honest without it', () => {
  const mod = freshChokepoint();
  const withWait = mod.refusalResponse('rate_limited', { tool: 'brain_query', retry_after_s: 42 });
  assert.match(withWait.reason, /42/, 'the reason must surface the observed wait so an operator knows how long to wait');

  const withoutWait = mod.refusalResponse('rate_limited', { tool: 'brain_query' });
  assert.equal(typeof withoutWait.reason, 'string');
  assert.ok(withoutWait.reason.length > 0, 'the reason must still render sensibly without a retry_after_s');
  assert.doesNotMatch(withoutWait.reason, /\bundefined\b|\bNaN\b/, 'must never print a bogus number when retry_after_s is absent');
});

test('renderRefusal(rate_limited) is a non-empty multi-line block that never says unreachable', () => {
  const mod = freshChokepoint();
  const copy = mod.renderRefusal('rate_limited', { tool: 'brain_query' });
  assert.equal(typeof copy, 'string');
  assert.ok(copy.length > 0);
  assert.ok(!/unreachable/i.test(copy), 'rate_limited copy must not use the word unreachable -- it is a distinct, more honest kind');
});

test('larryRefusalLine(rate_limited) is a distinct single-line under 120 chars', () => {
  const mod = freshChokepoint();
  const line = mod.larryRefusalLine('rate_limited');
  assert.equal(typeof line, 'string');
  assert.ok(line.length > 0 && line.length <= 120, 'must be a non-empty statusline-safe line');
  assert.ok(!/\n/.test(line), 'must be a single line');
  assert.notEqual(line, mod.larryRefusalLine('unreachable'), 'rate_limited must have its own distinct copy, not reuse unreachable\'s');
});

test('the four pre-existing kinds are byte-unchanged', () => {
  const mod = freshChokepoint();
  assert.equal(mod.refusalResponse('no_key', { tool: 'x' }).status, 'DIRECTOR_NOT_AVAILABLE');
  assert.equal(typeof mod.refusalResponse('no_key', { tool: 'x' }).upgrade_hint, 'string', 'no_key must still carry upgrade_hint');
  assert.equal(mod.refusalResponse('unreachable', { tool: 'x' }).status, 'BRAIN_UNREACHABLE');
  assert.equal(mod.refusalResponse('tier_denied', { tool: 'x' }).status, 'BRAIN_TIER_DENIED');
  assert.equal(mod.refusalResponse('not_ready', { tool: 'x' }).status, 'GRAPH_NOT_READY');
});

test('an unrecognized kind still coerces to unreachable -- only the rate_limited hole was closed', () => {
  const mod = freshChokepoint();
  const bogus = mod.refusalResponse('nonsense', { tool: 'x' });
  assert.equal(bogus.kind, 'unreachable');
  assert.equal(bogus.status, 'BRAIN_UNREACHABLE');
});
