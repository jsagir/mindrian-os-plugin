#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 102-01 -- renderer contract regression fence.
 *
 * History:
 *   - Phase 99-03 shipped a positional 4-arg pass-through stub at this
 *     module path with the contract `render(zones, mode, operator, tier)
 *     -> envelope` and tests targeted that envelope.
 *   - Phase 102-01 (CONTEXT D-10, RESEARCH §2) evolves the renderer to
 *     a destructured single-arg signature `render({ zones, mode,
 *     operator, tier, jtbd, tokenBudget, roomDir, provenance }) ->
 *     { rendered, contract }`. The legacy 4-arg signature lives on at
 *     lib/render/render.cjs (v1 shim) for unmigrated callers.
 *   - This file is the new contract regression fence for Phase 102. The
 *     scope mirrors the 99-03 fence (operator vocab + defaults + error
 *     paths + envelope stability + mode/tier passthrough) but exercises
 *     the v2 destructured surface.
 *
 * Scenarios (8 IIFE blocks):
 *   1. 5-operator round-trip via v2 destructured API. JUST_TALK is the
 *      explicit suppress case; the other 4 round-trip into composed output.
 *   2. JUST_TALK default when operator omitted (undefined) -- explicit
 *      operator: undefined is treated as "no operator" (renderer does
 *      not throw and returns a normal envelope).
 *   3. JUST_TALK default when operator null -- same as above; null is a
 *      no-op operator value, NOT 'JUST_TALK' (which is a real value).
 *   4. v2 must not throw on unknown operator strings -- Phase 102 owns
 *      operator semantics; only specific operators (JUST_TALK,
 *      METHODOLOGY) trigger gates. Unknown operators fall through to
 *      composition so callers can route arbitrary string values without
 *      a defensive try/catch wrapper.
 *   5. Envelope shape stable -- exactly 2 keys: rendered + contract. No
 *      `_stub` provenance leak (Phase 99-03 sentinel removed).
 *   6. mode passthrough -- 'A' / 'B' / 'tier-0' all pass through; v2
 *      does NOT validate mode (Phase 102-04 owns Mode B prefix logic).
 *   7. tier passthrough -- 0 / 1 / 2 / 3 all pass through; v2 does NOT
 *      validate tier (Phase 90 follow-on owns tier-check semantics).
 *   8. OPERATORS export is frozen and equals the 5 canonical names.
 *
 * Registered in lib/memory/run-feynman-tests.cjs (same registration the
 * 99-03 fence used; Phase 102 inherits the slot).
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
// Scenario 1: 5-operator round-trip via the v2 destructured API.
// ---------------------------------------------------------------------------
(function test1_fiveOperatorRoundTrip() {
  for (const op of CANONICAL) {
    const label = '5-operator round-trip: ' + op;
    try {
      const env = render({
        zones: { header: '-- h --', body: 'b' },
        mode: 'A',
        operator: op,
        tier: 1,
      });
      assert.ok(env && typeof env === 'object', 'envelope is an object');
      assert.equal(typeof env.rendered, 'string', 'rendered is a string');
      assert.ok(env.contract && typeof env.contract === 'object', 'contract is an object');

      if (op === 'JUST_TALK') {
        // Explicit suppress per Phase 102-01 algorithm step 6.
        assert.equal(env.rendered, '', 'JUST_TALK rendered === ""');
        assert.equal(env.contract.suppressed, true, 'JUST_TALK contract.suppressed === true');
        assert.equal(env.contract.reason, 'just-talk', 'JUST_TALK contract.reason === "just-talk"');
      } else {
        // All other operators compose normally.
        assert.ok(env.rendered.indexOf('-- h --') !== -1, op + ' header round-trips');
        assert.ok(env.rendered.indexOf('b') !== -1, op + ' body round-trips');
      }
      ok(label);
    } catch (e) { fail(label, e); }
  }
})();

// ---------------------------------------------------------------------------
// Scenario 2: undefined operator does not crash, renders normally.
// ---------------------------------------------------------------------------
(function test2_undefinedOperator() {
  const label = 'undefined operator does not crash';
  try {
    const env = render({
      zones: { header: 'h', body: 'b' },
      mode: 'A',
      operator: undefined,
      tier: 1,
    });
    assert.equal(typeof env.rendered, 'string', 'rendered is a string');
    assert.ok(env.rendered.indexOf('h') !== -1, 'header rendered without an operator');
    assert.ok(env.rendered.indexOf('b') !== -1, 'body rendered without an operator');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Scenario 3: null operator does not crash, renders normally.
// ---------------------------------------------------------------------------
(function test3_nullOperator() {
  const label = 'null operator does not crash';
  try {
    const env = render({
      zones: { header: 'h', body: 'b' },
      mode: 'A',
      operator: null,
      tier: 1,
    });
    assert.equal(typeof env.rendered, 'string', 'rendered is a string');
    assert.ok(env.rendered.indexOf('h') !== -1, 'header rendered with null operator');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Scenario 4: unknown operator does not throw -- v2 falls through to
// composition. Phase 99-03 stub threw; Phase 102 deliberately tolerates
// unknown operators so upstream callers (hooks, /mos:operator command)
// can route arbitrary strings without defensive try/catch wrappers.
// ---------------------------------------------------------------------------
(function test4_unknownOperatorTolerated() {
  const label = 'unknown operator does not throw (v2 tolerates)';
  try {
    let thrown = null;
    let env = null;
    try {
      env = render({
        zones: { header: 'h', body: 'b' },
        mode: 'A',
        operator: 'NOT_A_REAL_OPERATOR',
        tier: 1,
      });
    } catch (e) { thrown = e; }
    assert.equal(thrown, null, 'unknown operator must NOT throw');
    assert.ok(env && typeof env.rendered === 'string', 'still returns a normal envelope');
    assert.ok(env.rendered.indexOf('h') !== -1, 'composes normally for unknown operator');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Scenario 5: Envelope shape stable (exactly 2 keys, no _stub leak).
// ---------------------------------------------------------------------------
(function test5_envelopeShapeStable() {
  const label = 'envelope shape stable: exactly 2 keys (rendered + contract)';
  try {
    const env = render({
      zones: { header: 'h' },
      mode: 'A',
      operator: 'BUILD_ROOM',
      tier: 1,
    });
    const keys = Object.keys(env).sort();
    assert.deepEqual(keys, ['contract', 'rendered'], 'envelope keys are exactly {rendered, contract}');
    assert.ok(!('_stub' in env), 'no Phase 99-03 _stub provenance leak');
    assert.ok(!('zones' in env), 'no zones leak (Phase 99-03 pass-through removed)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Scenario 6: mode passthrough.
// ---------------------------------------------------------------------------
(function test6_modePassthrough() {
  const label = 'mode passthrough: A / B / tier-0 all render without throwing';
  try {
    for (const mode of ['A', 'B', 'tier-0']) {
      const env = render({
        zones: { header: 'h' },
        mode: mode,
        operator: 'BUILD_ROOM',
        tier: 1,
      });
      assert.equal(typeof env.rendered, 'string', 'mode ' + mode + ' renders');
    }
    // Stub does NOT validate mode -- arbitrary string also passes through.
    const env = render({
      zones: { header: 'h' },
      mode: 'arbitrary-mode',
      operator: 'BUILD_ROOM',
      tier: 1,
    });
    assert.equal(typeof env.rendered, 'string', 'arbitrary mode renders');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Scenario 7: tier passthrough.
// ---------------------------------------------------------------------------
(function test7_tierPassthrough() {
  const label = 'tier passthrough: 0 / 1 / 2 / 3 all render without throwing';
  try {
    for (const tier of [0, 1, 2, 3]) {
      const env = render({
        zones: { header: 'h' },
        mode: 'A',
        operator: 'BUILD_ROOM',
        tier: tier,
      });
      assert.equal(typeof env.rendered, 'string', 'tier ' + tier + ' renders');
    }
    // Stub does NOT validate tier -- string tier also passes through.
    const env = render({
      zones: { header: 'h' },
      mode: 'A',
      operator: 'BUILD_ROOM',
      tier: 'arbitrary-tier',
    });
    assert.equal(typeof env.rendered, 'string', 'arbitrary tier renders');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------------------------------------------------------------------------
// Scenario 8: OPERATORS export is frozen and equals the 5 canonical names.
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
  'Phase 102-01 renderer contract regression: ' +
    passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
