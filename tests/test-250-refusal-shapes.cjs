#!/usr/bin/env node
'use strict';

/**
 * Phase 250 Plan 01, Task 1 (HONEST-01) -- refusal kind shapes + the shim
 * conflation red proof.
 * ==========================================================================
 * Proves the four typed refusal kinds at the tier0-messaging chokepoint:
 *
 *   1. REFUSAL_KINDS is frozen, exactly the four members, in order.
 *   2. refusalResponse per-kind status mapping (no_key keeps the byte-locked
 *      DIRECTOR_NOT_AVAILABLE wire string; the other three get sibling
 *      statuses). Shape: {status, kind, reason, command_context, next_moves,
 *      upgrade_hint?}.
 *   3. THE CONFLATION RED PROOF: refusalResponse('unreachable', ...).reason
 *      never says "MINDRIAN_BRAIN_KEY not set" -- the live dishonesty bug
 *      this phase kills.
 *   4. Unknown kind coerces to 'unreachable'; ctx coercion mirrors the
 *      existing tier0Response defensive pattern.
 *   5. tier0Response byte-lock: same 5 keys, DIRECTOR_NOT_AVAILABLE status,
 *      FALLBACK_ADVICE matches /Larry/ but no longer carries the old
 *      graceful-degradation phrase.
 *   6. larryRefusalLine(kind, detail) is a statusline-safe one-liner (<120
 *      chars) for every kind.
 *   7. The shim source assertion: bin/mindrian-brain-mcp-client.cjs no
 *      longer conflates transport-null with the no-key sentinel, and calls
 *      refusalResponse('unreachable', ...) at least 5 times (the 5 raw
 *      tools), with brain_ask's envelope variant present.
 *
 * node --test, CJS, node:assert/strict + node:fs only. No new deps.
 * No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');
const CHOKEPOINT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'tier0-messaging.cjs');
const SHIM_PATH = path.join(REPO_ROOT, 'bin', 'mindrian-brain-mcp-client.cjs');

function freshChokepoint() {
  delete require.cache[CHOKEPOINT_PATH];
  return require(CHOKEPOINT_PATH);
}

// ---------------------------------------------------------------------------
// Test 1: REFUSAL_KINDS is frozen and equals the four-member closed set.
// ---------------------------------------------------------------------------
test('Test 1: REFUSAL_KINDS is frozen and equals the four refusal kinds in order', () => {
  const mod = freshChokepoint();
  assert.ok(Array.isArray(mod.REFUSAL_KINDS), 'REFUSAL_KINDS must be an array');
  assert.deepStrictEqual(mod.REFUSAL_KINDS, ['no_key', 'unreachable', 'tier_denied', 'not_ready']);
  assert.ok(Object.isFrozen(mod.REFUSAL_KINDS), 'REFUSAL_KINDS must be frozen');
});

// ---------------------------------------------------------------------------
// Test 2: refusalResponse status mapping + shape.
// ---------------------------------------------------------------------------
test('Test 2: refusalResponse status mapping is honest per kind, no_key keeps the locked wire string', () => {
  const mod = freshChokepoint();

  const noKey = mod.refusalResponse('no_key', { tool: 'brain_query' });
  assert.equal(noKey.status, 'DIRECTOR_NOT_AVAILABLE', 'no_key must keep the byte-locked wire string');
  assert.equal(typeof noKey.upgrade_hint, 'string', 'no_key must carry upgrade_hint');
  assert.equal(noKey.kind, 'no_key');
  assert.equal(noKey.command_context, 'brain_query');
  assert.ok(Array.isArray(noKey.next_moves));
  assert.equal(typeof noKey.reason, 'string');

  const unreachable = mod.refusalResponse('unreachable', { tool: 'brain_query' });
  assert.equal(unreachable.status, 'BRAIN_UNREACHABLE');
  assert.equal(unreachable.upgrade_hint, undefined, 'unreachable must not carry upgrade_hint');

  const tierDenied = mod.refusalResponse('tier_denied', { tool: 'brain_write', message: 'MoatViolation: write not allowed' });
  assert.equal(tierDenied.status, 'BRAIN_TIER_DENIED');

  const notReady = mod.refusalResponse('not_ready', { tool: 'brain_query', framework: 'SWOT Analysis', readiness_score: 1, missing_dimensions: ['structure'] });
  assert.equal(notReady.status, 'GRAPH_NOT_READY');
});

// ---------------------------------------------------------------------------
// Test 3: THE CONFLATION RED PROOF.
// ---------------------------------------------------------------------------
test('Test 3 (conflation red proof): unreachable reason never claims a missing key', () => {
  const mod = freshChokepoint();
  const r = mod.refusalResponse('unreachable', { tool: 'brain_query' });
  assert.ok(!r.reason.includes('MINDRIAN_BRAIN_KEY not set'), 'unreachable must never echo the no-key reason string');
  assert.match(r.reason, /reach|unreachable/i, 'unreachable reason must name unreachability honestly');
});

// ---------------------------------------------------------------------------
// Test 4: unknown kind coercion + ctx defensive coercion.
// ---------------------------------------------------------------------------
test('Test 4: unknown kind coerces to unreachable; bad ctx coerces command_context to unknown', () => {
  const mod = freshChokepoint();

  const bogus = mod.refusalResponse('not_a_real_kind', { tool: 'brain_query' });
  assert.equal(bogus.kind, 'unreachable', 'an unrecognized kind must coerce to unreachable');
  assert.equal(bogus.status, 'BRAIN_UNREACHABLE');

  const r1 = mod.refusalResponse('unreachable', null);
  const r2 = mod.refusalResponse('unreachable', undefined);
  const r3 = mod.refusalResponse('unreachable', 'not-an-object');
  const r4 = mod.refusalResponse('unreachable', {});
  assert.equal(r1.command_context, 'unknown');
  assert.equal(r2.command_context, 'unknown');
  assert.equal(r3.command_context, 'unknown');
  assert.equal(r4.command_context, 'unknown');
});

// ---------------------------------------------------------------------------
// Test 5: tier0Response byte-lock unchanged, FALLBACK_ADVICE rewritten.
// ---------------------------------------------------------------------------
test('Test 5: tier0Response byte-lock unchanged; FALLBACK_ADVICE is refusal-framed, not graceful-degradation-framed', () => {
  const mod = freshChokepoint();
  const r = mod.tier0Response('brain_ask');
  const keys = Object.keys(r).sort();
  assert.deepStrictEqual(keys, ['command_context', 'fallback_advice', 'reason', 'status', 'upgrade_hint'].sort());
  assert.equal(r.status, 'DIRECTOR_NOT_AVAILABLE');
  assert.match(r.fallback_advice, /Larry/, 'fallback_advice must still mention Larry (existing loose regex)');
  assert.ok(!r.fallback_advice.includes('Larry can still talk with you'), 'the old graceful-degradation phrase must be gone');
});

// ---------------------------------------------------------------------------
// Test 6: larryRefusalLine is a statusline-safe one-liner for every kind.
// ---------------------------------------------------------------------------
test('Test 6: larryRefusalLine(kind, detail) returns a string under 120 chars for every kind', () => {
  const mod = freshChokepoint();
  for (const kind of mod.REFUSAL_KINDS) {
    const line = mod.larryRefusalLine(kind, 'SWOT Analysis');
    assert.equal(typeof line, 'string', 'larryRefusalLine must return a string for kind=' + kind);
    assert.ok(line.length > 0, 'must be non-empty for kind=' + kind);
    assert.ok(line.length <= 120, 'must be <= 120 chars for kind=' + kind + ' (got ' + line.length + ')');
    assert.ok(!/\n/.test(line), 'must be a single line for kind=' + kind);
  }
});

// ---------------------------------------------------------------------------
// Test 7: shim source assertion -- the conflation is fixed at the source.
// ---------------------------------------------------------------------------
test('Test 7: shim source no longer conflates transport-null with the no-key sentinel', () => {
  const src = fs.readFileSync(SHIM_PATH, 'utf8');
  const conflationHits = src.match(/r == null \? tier0Response/g) || [];
  assert.equal(conflationHits.length, 0, 'the shim must not map transport-null to tier0Response anywhere');

  const unreachableHits = src.match(/refusalResponse\('unreachable'/g) || [];
  assert.ok(unreachableHits.length >= 5, 'the shim must call refusalResponse(\'unreachable\', ...) at least 5 times (the 5 raw tools); found ' + unreachableHits.length);

  assert.match(src, /brain_ask/, 'brain_ask handler must still be present');
});
