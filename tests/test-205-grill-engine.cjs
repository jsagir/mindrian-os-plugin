'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 205-08 -- GRILL engine test (SCOPE-3). GRILL is the anti-circular exit
 * for the SENS-10 assertion-unvalidated cause: two mandatory arms on a load-
 * bearing claim.
 *
 *   Arm A (LIVE)      logical red-team -- challenge-assumptions + the five
 *                     Beautiful-Questions bias techniques reached as the frozen
 *                     brain_consult reach, Part-8 fenced (bias SHAPE egresses,
 *                     never the claim content or user prose).
 *   Arm B (SCAFFOLD)  external validation -- bono hat-scoped fan -> adversarial-
 *                     verify to a structured verdict via the frozen deep_research
 *                     reach, MCP-stack-ask gated. BLOCKED-UNTIL-200: until the
 *                     single is200FanVerifyLive seam flips, Arm B DEGRADES
 *                     CLEANLY -- a marked not-available verdict, NO evidence node,
 *                     NO fabricated survives/flagged result, NO throw, and NO
 *                     external primitive invoked.
 *
 * FROZEN-SIX INVARIANT (item 7): GRILL mints NO new reach_id -- Arm A routes
 * brain_consult, Arm B routes deep_research, and the engine touches no other id.
 *
 * OFFLINE: no live Brain call, no network. Arm A's egress SHAPE is built and run
 * through the shipped part8-egress-guard classifier (a pure LOCAL function); the
 * primitive is never fired. Arm B degrades before any primitive.
 *
 * House rule: hyphens only, no em-dashes. CJS, node built-ins only.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const grill = require(path.join(REPO_ROOT, 'lib/core/grill-engine.cjs'));
const guard = require(path.join(REPO_ROOT, 'lib/core/part8-egress-guard.cjs'));
const sensorTypes = require(path.join(REPO_ROOT, 'lib/core/sensors/sensor-types.cjs'));

const FROZEN_SIX = ['context_block', 'contradiction', 'cross_room', 'brain_consult', 'deep_research', 'hats'];

// A distinctive load-bearing claim carrying user prose that MUST NOT egress.
const CLAIM = 'Our customer acquisition cost will drop because the two rival startups just folded.';

let pass = 0;
function check(label, fn) {
  fn();
  pass += 1;
  console.log('  ok - ' + label);
}

console.log('test-205-grill-engine.cjs (SCOPE-3): GRILL two mandatory arms, Part-8 fenced, frozen-six');

// ---------------------------------------------------------------------------
// Contract: the engine exports the three arms.
// ---------------------------------------------------------------------------
check('exports runGrill / armA / armB', () => {
  assert.strictEqual(typeof grill.runGrill, 'function', 'must export runGrill');
  assert.strictEqual(typeof grill.armA, 'function', 'must export armA');
  assert.strictEqual(typeof grill.armB, 'function', 'must export armB');
});

// ---------------------------------------------------------------------------
// Task 1 -- Arm A: brain_consult bias red-team, five LOCAL findings.
// ---------------------------------------------------------------------------
check('armA routes through the brain_consult reach and mints no new reach', () => {
  const a = grill.armA(CLAIM, {});
  assert.strictEqual(a.reach_id, 'brain_consult', 'Arm A must route the brain_consult reach');
  assert.strictEqual(a.minted_reach, false, 'Arm A mints no reach');
  assert.ok(FROZEN_SIX.indexOf(a.reach_id) !== -1, 'Arm A reach must be one of the frozen six');
});

check('armA returns the five bias-technique challenges as LOCAL structured findings', () => {
  const a = grill.armA(CLAIM, {});
  assert.ok(Array.isArray(a.findings), 'findings must be an array');
  assert.strictEqual(a.findings.length, 5, 'Arm A must raise the five bias-technique challenges');
  const expected = [
    'Consider-the-Opposite',
    'Base-Rate-Check',
    'Red-Team-Steelman',
    'Premortem',
    'Reference-Class-Forecasting',
  ];
  const techniques = a.findings.map(function (f) { return f.technique; });
  assert.deepStrictEqual(techniques, expected, 'the five Beautiful-Questions bias techniques, in order');
  a.findings.forEach(function (f) {
    assert.strictEqual(typeof f.challenge, 'string', 'each finding carries a local challenge string');
    assert.ok(f.challenge.length > 0, 'the challenge is non-empty');
  });
});

// ---------------------------------------------------------------------------
// Task 1 -- Part 8: the egress carries only bias SHAPE / technique names, never
// the claim content. Run the shipped guard; assert it does NOT block and the
// claim prose does NOT appear anywhere in the egress payload.
// ---------------------------------------------------------------------------
check('armA egress passes the Part-8 guard and strips the claim content', () => {
  const egress = grill.buildArmAEgress(CLAIM);
  assert.ok(egress && egress.payload, 'buildArmAEgress must return a payload');

  const serialized = JSON.stringify(egress);
  assert.strictEqual(serialized.indexOf(CLAIM), -1,
    'the claim content string must NOT appear in the egress payload (Part 8)');
  // No user token from the claim leaks either.
  assert.strictEqual(serialized.indexOf('customer acquisition cost'), -1,
    'no user prose fragment leaks into the egress payload');
  assert.strictEqual(serialized.indexOf('rival startups'), -1,
    'no user prose fragment leaks into the egress payload');

  const verdict = guard.classify(egress.payload, { toolName: egress.toolName });
  assert.notStrictEqual(verdict.verdict, 'block',
    'the bias-shape egress must clear the Part-8 default-deny (not block)');
});

check('runGrill invokes armA unconditionally (Arm A is mandatory)', () => {
  const g = grill.runGrill(CLAIM, {});
  assert.ok(g.armA, 'runGrill must always compose Arm A');
  assert.strictEqual(g.armA.reach_id, 'brain_consult', 'the composed Arm A routes brain_consult');
});

// ---------------------------------------------------------------------------
// Task 2 -- Arm B: deep_research reach, MCP-stack-ask gated, BLOCKED-UNTIL-200
// clean degradation.
// ---------------------------------------------------------------------------
check('armB routes through the deep_research reach and mints no new reach', () => {
  const b = grill.armB(CLAIM, {});
  assert.strictEqual(b.reach_id, 'deep_research', 'Arm B must route the deep_research reach');
  assert.strictEqual(b.minted_reach, false, 'Arm B mints no reach');
  assert.ok(FROZEN_SIX.indexOf(b.reach_id) !== -1, 'Arm B reach must be one of the frozen six');
});

check('armB degrades cleanly when Phase 200 fan/verify is absent (no fabricated verdict/evidence, no throw)', () => {
  const b = grill.armB(CLAIM, {});
  assert.strictEqual(b.status, 'not_available', 'Arm B returns a marked not-available status');
  assert.strictEqual(b.blocked_until, 200, 'Arm B is marked BLOCKED-UNTIL-200');
  assert.strictEqual(b.verdict, null, 'Arm B fabricates NO survives/flagged verdict while gated');
  assert.strictEqual(b.evidence_node, null, 'Arm B writes NO evidence node while gated');
});

check('the single 200-gating seam is legible and OFF by default', () => {
  assert.strictEqual(grill.BLOCKED_UNTIL_200, true, 'the BLOCKED-UNTIL-200 seam is engaged');
  assert.strictEqual(typeof grill.is200FanVerifyLive, 'function', 'the single is200FanVerifyLive predicate exists');
  assert.strictEqual(grill.is200FanVerifyLive({}), false,
    'the seam reports Phase 200 fan/verify NOT live (the one-point flip is closed)');
});

check('the MCP-stack-ask gate precedes any external primitive (none invoked in the not-available path)', () => {
  let tavilyCalls = 0;
  let webFetchCalls = 0;
  const ctx = {
    primitives: {
      tavily: function () { tavilyCalls += 1; return {}; },
      webFetch: function () { webFetchCalls += 1; return {}; },
    },
  };
  const b = grill.armB(CLAIM, ctx);

  assert.strictEqual(tavilyCalls, 0, 'no Tavily primitive is invoked in the degraded path');
  assert.strictEqual(webFetchCalls, 0, 'no WebFetch primitive is invoked in the degraded path');
  assert.strictEqual(b.external_invoked, false, 'Arm B records that no external primitive fired');
  assert.ok(b.mcp_gate && b.mcp_gate.resolved === true, 'the MCP-stack-ask gate resolved');
  assert.ok(Array.isArray(b.trace) && b.trace.length >= 1, 'Arm B records an execution trace');
  assert.strictEqual(b.trace[0], 'mcp_stack_ask_gate',
    'the MCP-stack-ask gate is the FIRST step -- it precedes any external pass');
  b.trace.forEach(function (step) {
    assert.strictEqual(step.indexOf('external:'), -1,
      'no external primitive step appears in the degraded trace');
  });
});

check('armB egress preview passes the Part-8 guard and strips the claim content', () => {
  const egress = grill.buildArmBEgress(CLAIM);
  assert.ok(egress && egress.payload, 'buildArmBEgress must return a payload');
  const serialized = JSON.stringify(egress);
  assert.strictEqual(serialized.indexOf(CLAIM), -1,
    'the claim content must NOT appear in the Arm B egress payload (Part 8)');
  const verdict = guard.classify(egress.payload, { toolName: egress.toolName });
  assert.notStrictEqual(verdict.verdict, 'block',
    'the Arm B external-query shape must clear the Part-8 default-deny (not block)');
});

// ---------------------------------------------------------------------------
// runGrill composes both arms; the frozen-six invariant holds.
// ---------------------------------------------------------------------------
check('runGrill composes Arm A then Arm B (both mandatory; Arm B degrades cleanly)', () => {
  const g = grill.runGrill(CLAIM, {});
  assert.ok(g.armA, 'runGrill composes Arm A');
  assert.ok(g.armB, 'runGrill composes Arm B');
  assert.strictEqual(g.armB.status, 'not_available', 'Arm B degrades cleanly inside runGrill');
  assert.strictEqual(g.verdict, null, 'the GRILL verdict is null until Arm B (the teeth) is live post-200');
});

check('GRILL touches only the brain_consult + deep_research frozen reaches (mints no new reach)', () => {
  const g = grill.runGrill(CLAIM, {});
  assert.ok(Array.isArray(g.reaches_used), 'runGrill reports the reaches it used');
  assert.deepStrictEqual(g.reaches_used.slice().sort(), ['brain_consult', 'deep_research'],
    'GRILL uses exactly brain_consult + deep_research');
  g.reaches_used.forEach(function (r) {
    assert.ok(sensorTypes.REACH_IDS.indexOf(r) !== -1, r + ' must be a frozen reach id');
  });
});

console.log('');
console.log('PASS test-205-grill-engine.cjs (' + pass + ' checks)');
process.exit(0);
