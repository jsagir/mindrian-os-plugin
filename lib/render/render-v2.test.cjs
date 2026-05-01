#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 99-03 -- renderer integration contract stub.
 * OPERATOR-99-03 (renderer integration contract).
 *
 * Background:
 *   Phase 99 ships the conversation operator state machine. Phase 99-03
 *   ships the RENDERER INTEGRATION CONTRACT that Phase 102's
 *   lib/render/render-v2.cjs will eventually consume. Phase 99 does NOT
 *   modify any renderer; it ships the SIGNATURE + a no-op pass-through
 *   stub so Phase 99-04 (hooks) and Phase 99-05 (/mos:operator command)
 *   can call into the contract today.
 *
 *   Per Phase 99 CONTEXT.md D-16, the contract surface is:
 *     render(zones, mode, operator, tier) -> envelope
 *
 *   The 5 canonical operators (D-03, frozen):
 *     JUST_TALK / EXPLORE_CAPTURE / BUILD_ROOM / METHODOLOGY / DECISION_GATE
 *
 *   The Phase 99-03 stub envelope:
 *     { zones, mode, operator, tier, rendered: false, _stub: 'phase-99-03' }
 *
 *   Phase 102 replaces the stub internals with real rendering logic
 *   without changing the import surface; any caller that imports
 *   `{ render }` today continues to work after Phase 102 lands.
 *
 * Scenarios (7):
 *   1. 5-operator round-trip -- each canonical operator round-trips through
 *      render() with envelope.operator === input, rendered === false,
 *      _stub === 'phase-99-03'.
 *   2. JUST_TALK default when operator omitted (undefined) -- envelope.operator
 *      === 'JUST_TALK'.
 *   3. JUST_TALK default when operator null -- envelope.operator === 'JUST_TALK'.
 *   4. Throw on invalid operator -- 'WRONG' raises Error whose message names
 *      'WRONG' AND each of the 5 canonical operator names.
 *   5. Envelope shape stable -- exactly 6 keys: zones, mode, operator, tier,
 *      rendered, _stub. No extras.
 *   6. mode passthrough -- 'cli' / 'desktop' / 'cowork' all pass through
 *      unchanged. Phase 99-03 stub does NOT validate mode.
 *   7. tier passthrough -- 'tier-0' / 'mode-a' / 'mode-b' all pass through
 *      unchanged. Phase 99-03 stub does NOT validate tier.
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const RENDER_MODULE = path.resolve(__dirname, 'render-v2.cjs');
const { render, OPERATORS } = require(RENDER_MODULE);

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

const CANONICAL = [
  'JUST_TALK',
  'EXPLORE_CAPTURE',
  'BUILD_ROOM',
  'METHODOLOGY',
  'DECISION_GATE',
];

// ---------------------------------------------------------------------------
// Scenario 1: 5-operator round-trip
// ---------------------------------------------------------------------------
(function test1_fiveOperatorRoundTrip() {
  for (const op of CANONICAL) {
    const label = '5-operator round-trip: ' + op;
    try {
      const env = render({ a: 1 }, 'cli', op, 'mode-a');
      assert.equal(env.operator, op, 'envelope.operator should equal input');
      assert.equal(env.rendered, false, 'rendered must be false in stub');
      assert.equal(env._stub, 'phase-99-03', '_stub provenance tag');
      assert.deepEqual(env.zones, { a: 1 }, 'zones pass through unchanged');
      assert.equal(env.mode, 'cli', 'mode pass through');
      assert.equal(env.tier, 'mode-a', 'tier pass through');
      ok(label);
    } catch (e) { fail(label, e); }
  }
})();

// ---------------------------------------------------------------------------
// Scenario 2: JUST_TALK default when operator undefined
// ---------------------------------------------------------------------------
(function test2_defaultJustTalkUndefined() {
  const label = 'JUST_TALK default when operator undefined';
  try {
    const env = render({ a: 1 }, 'cli', undefined, 'mode-a');
    assert.equal(env.operator, 'JUST_TALK', 'undefined -> JUST_TALK');
    assert.equal(env._stub, 'phase-99-03');
    assert.equal(env.rendered, false);
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Scenario 3: JUST_TALK default when operator null
// ---------------------------------------------------------------------------
(function test3_defaultJustTalkNull() {
  const label = 'JUST_TALK default when operator null';
  try {
    const env = render({ a: 1 }, 'cli', null, 'mode-a');
    assert.equal(env.operator, 'JUST_TALK', 'null -> JUST_TALK');
    assert.equal(env._stub, 'phase-99-03');
    assert.equal(env.rendered, false);
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Scenario 4: Throw on invalid operator (message names bad value + 5 canonical)
// ---------------------------------------------------------------------------
(function test4_throwOnInvalidOperator() {
  const label = 'throw on invalid operator names bad value AND 5 canonical';
  try {
    let thrown = null;
    try {
      render({ a: 1 }, 'cli', 'WRONG', 'mode-a');
    } catch (e) { thrown = e; }
    assert.ok(thrown, 'invalid operator must throw');
    assert.ok(thrown instanceof Error, 'thrown value is Error');
    const msg = thrown.message;
    assert.ok(msg.indexOf('WRONG') !== -1, 'message names bad value WRONG');
    for (const op of CANONICAL) {
      assert.ok(
        msg.indexOf(op) !== -1,
        'message names canonical operator ' + op
      );
    }
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Scenario 5: Envelope shape stable (exactly 6 keys, no extras)
// ---------------------------------------------------------------------------
(function test5_envelopeShapeStable() {
  const label = 'envelope shape stable: exactly 6 keys, no extras';
  try {
    const env = render({ a: 1 }, 'cli', 'BUILD_ROOM', 'mode-a');
    const keys = Object.keys(env).sort();
    const expected = ['_stub', 'mode', 'operator', 'rendered', 'tier', 'zones'];
    assert.deepEqual(keys, expected, 'envelope keys are exactly the 6');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Scenario 6: mode passthrough (cli, desktop, cowork all unchanged)
// ---------------------------------------------------------------------------
(function test6_modePassthrough() {
  const label = 'mode passthrough: cli / desktop / cowork unchanged';
  try {
    for (const mode of ['cli', 'desktop', 'cowork']) {
      const env = render({}, mode, 'BUILD_ROOM', 'mode-a');
      assert.equal(env.mode, mode, 'mode ' + mode + ' passes through');
    }
    // Stub does NOT validate mode -- arbitrary string also passes through.
    const env = render({}, 'arbitrary-mode', 'BUILD_ROOM', 'mode-a');
    assert.equal(
      env.mode,
      'arbitrary-mode',
      'stub does not validate mode (Phase 102 owns)'
    );
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Scenario 7: tier passthrough (tier-0, mode-a, mode-b all unchanged)
// ---------------------------------------------------------------------------
(function test7_tierPassthrough() {
  const label = 'tier passthrough: tier-0 / mode-a / mode-b unchanged';
  try {
    for (const tier of ['tier-0', 'mode-a', 'mode-b']) {
      const env = render({}, 'cli', 'BUILD_ROOM', tier);
      assert.equal(env.tier, tier, 'tier ' + tier + ' passes through');
    }
    // Stub does NOT validate tier -- arbitrary string also passes through.
    const env = render({}, 'cli', 'BUILD_ROOM', 'arbitrary-tier');
    assert.equal(
      env.tier,
      'arbitrary-tier',
      'stub does not validate tier (Phase 102 owns)'
    );
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Bonus integrity assertion: OPERATORS export matches the 5 canonical names.
// ---------------------------------------------------------------------------
(function test8_operatorsExportFrozen() {
  const label = 'OPERATORS export is frozen and equals 5 canonical names';
  try {
    assert.ok(Array.isArray(OPERATORS), 'OPERATORS is an array');
    assert.deepEqual(
      [...OPERATORS].sort(),
      [...CANONICAL].sort(),
      'OPERATORS equals 5 canonical names'
    );
    assert.ok(Object.isFrozen(OPERATORS), 'OPERATORS is frozen');
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write(
  'Phase 99-03 renderer contract stub: ' +
    passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
