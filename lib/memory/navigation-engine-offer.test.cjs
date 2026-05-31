#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 135-01 Wave 0 -- Offer Resolver + Abstention RED unit suite
 * =================================================================
 * Pins the resolveOfferNextStep contract (SC1 / SC3 / SC6) BEFORE the resolver
 * body exists. resolveOfferNextStep is NOT exported from navigation-engine.cjs;
 * we exercise it through the public decide(turn, context) entry and read
 * decision.offer_next_step. The resolver runs at navigation-engine.cjs:475 and
 * is currently a `return null` stub (lines 280-282) -- so the explicit-null
 * cases (JUST_TALK silence, no-throw graceful) pass GREEN now, while the
 * positive-offer cases are RED until 135-02 fills the stub.
 *
 * This suite covers the resolver CONTRACT on in-memory fixtures only. The
 * production-wiring path (real room.db, real reason grounding, no [[undefined]])
 * is covered separately by tests/test-135-decide-wiring-e2e.cjs (Task 4). The
 * two are complementary; neither replaces the other.
 *
 * Test map:
 *   SC1  -- offer is null OR an object with EXACTLY {command, framework, jtbd,
 *           confidence, reason, scope}; never an array; never more than one.
 *   SC6  -- null when context.operator === 'JUST_TALK'.
 *   SC6  -- null when the top command is in rejection-backoff.
 *   SC6  -- an offer at context.operator === 'DECISION_GATE' when margin is
 *           sufficient and the command is not in backoff.       [RED until 135-02]
 *   SC3  -- no-throw across mode_a / mode_b / tier_0 fixtures.
 *
 * Framework: direct-CJS node:assert/strict, no external runner.
 * No em-dashes (hyphens only). No emoji.
 * Registered in tests/run-all-135.sh (Task 3).
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const ENGINE_PATH = path.join(REPO, 'lib/core/navigation-engine.cjs');

function requireEngine() {
  return require(ENGINE_PATH);
}

// ---------- Test scaffolding ----------

let passed = 0;
let failed = 0;
let red = 0;

function run(name, fn) {
  try {
    fn();
    process.stdout.write('ok  ' + name + '\n');
    passed += 1;
  } catch (err) {
    process.stderr.write('FAIL ' + name + '\n');
    process.stderr.write(String(err && err.stack ? err.stack : err) + '\n');
    failed += 1;
  }
}

// runRed: an assertion that depends on the unbuilt resolver (135-02). It is
// EXPECTED to fail today against the `return null` stub. We report it as a
// tracked RED target rather than a hard failure so this Wave 0 suite can land
// alongside Task 1 without blocking the wave; it flips to a hard `run()` once
// 135-02 lands (the executor of 135-02 deletes the runRed wrapper).
function runRed(name, fn) {
  try {
    fn();
    process.stdout.write('ok  ' + name + ' (RED target now GREEN -- promote to run())\n');
    passed += 1;
  } catch (_err) {
    process.stdout.write('RED ' + name + ' (expected RED until 135-02)\n');
    red += 1;
  }
}

// ---------- Fixture builders ----------

function makeBrain(overrides) {
  const base = {
    exists: true,
    section: 'market-analysis',
    brain_generated_at: '2026-04-20T12:00:00Z',
    brain_graph_version: 1,
    governing_thought_hash: 'sha256:abc123',
    staleness: 'fresh',
    stale_reason: null,
    author: 'brain',
    confidence_baseline: 0.5,
    parse_failed: false,
    sections: {
      pattern_matches: null,
      framework_chain_predictions: null,
      cross_domain_analogies: null,
      wicked_indicators: null,
      unfilled_opportunity_matches: null,
      assessment_thinking_chain_position: null,
      problemtype_classification: null,
      flagged_contradictions_xroom: null,
      hsi_signals: null,
    },
    flagged_weaknesses: [],
  };
  return Object.assign({}, base, overrides || {});
}

function makeQuadruple(overrides) {
  const base = {
    room: { exists: true, identity_text: 'market analysis section', references: [] },
    state: { exists: true, artifact_count: 3, completeness_score: 0.6 },
    reasoning: {
      exists: true,
      governing_thought: 'Customers will pay a premium for X',
      reasoning_health_score: 0.7,
      is_stale: false,
      arguments: [],
    },
    brain: makeBrain(),
  };
  return Object.assign({}, base, overrides || {});
}

function makeTurn(overrides) {
  return Object.assign(
    {
      userText: null,
      sectionPath: '/tmp/fixture-room/market-analysis',
      sessionId: 'test-session-offer',
    },
    overrides || {}
  );
}

// makeContext: the engine context carrying the Phase 135-01 resolver inputs.
// roomState uses an in-memory fixture (no real room.db) per the unit-suite
// boundary; the resolver is pure-local sync and reads roomState as passed in.
function makeContext(overrides) {
  return Object.assign(
    {
      quadruple: makeQuadruple(),
      brainAvailable: true,
      userPersona: { archetype: 'Founder', problem_type: 'IDP', venture_stage: 'discovery' },
      intentSignal: null,
      // Phase 135-01 resolver inputs:
      operator: 'DECISION_GATE',
      sectionPath: 'market-analysis',
      problemType: 'IDP',
      jtbd: 'size the addressable market',
      roomState: {
        db: null,
        roomDir: '/tmp/fixture-room',
        // invocationsSinceDecision can be patched per-test to drive shouldExclude.
      },
    },
    overrides || {}
  );
}

const OFFER_KEYS = ['command', 'framework', 'jtbd', 'confidence', 'reason', 'scope'];

function assertOfferShapeOrNull(offer, label) {
  if (offer === null) return; // abstention is always a valid return
  assert.equal(Array.isArray(offer), false, label + ': offer must never be an array');
  assert.equal(typeof offer, 'object', label + ': offer must be an object or null');
  const keys = Object.keys(offer).sort();
  assert.deepEqual(keys, OFFER_KEYS.slice().sort(),
    label + ': offer must have EXACTLY ' + JSON.stringify(OFFER_KEYS) + ', got ' + JSON.stringify(keys));
}

// ---------- SC1: offer-or-null, never >1, exact key set ----------

run('SC1: decide() offer_next_step is null OR a single well-formed offer object', () => {
  const { decide } = requireEngine();
  const d = decide(makeTurn(), makeContext());
  // Today the stub returns null (or the composer may set {command, reason} as a
  // fallback). The resolver-grade six-key contract is the 135-02 target; here we
  // pin the SHAPE invariant: never an array, and when the RESOLVER populates it,
  // it carries exactly the six keys. The composer fallback two-key shape is a
  // separate (existing) contract and is allowed to coexist.
  if (d.offer_next_step !== null) {
    assert.equal(Array.isArray(d.offer_next_step), false, 'offer must never be an array');
    assert.equal(typeof d.offer_next_step, 'object', 'offer must be an object');
  }
});

runRed('SC1: a populated resolver offer carries EXACTLY the six canonical keys', () => {
  const { decide } = requireEngine();
  const d = decide(makeTurn(), makeContext());
  // RED until 135-02: the stub returns null, so there is no six-key offer yet.
  assert.notEqual(d.offer_next_step, null, 'resolver should emit an offer at DECISION_GATE');
  assertOfferShapeOrNull(d.offer_next_step, 'SC1');
});

// ---------- SC6: abstention -- JUST_TALK silence ----------

run('SC6: returns null when context.operator === JUST_TALK', () => {
  const { decide } = requireEngine();
  const d = decide(makeTurn(), makeContext({ operator: 'JUST_TALK' }));
  assert.equal(d.offer_next_step, null, 'must stay silent in JUST_TALK');
});

// ---------- SC6: abstention -- rejection backoff ----------

runRed('SC6: returns null when the top command is in rejection-backoff', () => {
  const { decide } = requireEngine();
  // Seed a roomState whose invocationsSinceDecision makes shouldExclude true.
  // DECAY_WINDOW=5, EXCLUSION_THRESHOLD=0.1: factor = 1 - exp(-(n/5)); n=0 gives
  // factor 0 < 0.1 -> excluded. We seed n=0 for the would-be top command so the
  // resolver must abstain. RED until 135-02 wires shouldExclude into the gate.
  const ctx = makeContext({
    roomState: {
      db: null,
      roomDir: '/tmp/fixture-room',
      invocationsSinceDecision: { 'mos:explore-domains': 0 },
    },
  });
  const d = decide(makeTurn(), ctx);
  // The resolver should either abstain (null) OR not offer the backed-off
  // command. RED target: prove the gate actually consults shouldExclude. Until
  // 135-02, the stub returns null which trivially satisfies this -- so this
  // assertion is the WEAK contract; the strong positive case is the SC6
  // DECISION_GATE offer below.
  if (d.offer_next_step !== null) {
    assert.notEqual(d.offer_next_step.command, 'mos:explore-domains',
      'must not offer a command that is in rejection-backoff');
  }
  // Force RED until the resolver exists so 135-02 has a failing target.
  assert.equal(typeof requireEngine().decide, 'function');
  throw new Error('RED until 135-02: backoff gate not yet wired into resolver');
});

// ---------- SC6: positive -- offer at DECISION_GATE ----------

runRed('SC6: emits an offer at DECISION_GATE when margin is sufficient and not in backoff', () => {
  const { decide } = requireEngine();
  const d = decide(makeTurn(), makeContext({ operator: 'DECISION_GATE' }));
  // RED until 135-02: the stub returns null. After 135-02 with a real ranker
  // margin >= MARGIN_THRESHOLD (0.15) this returns a six-key offer.
  assert.notEqual(d.offer_next_step, null,
    'resolver should emit an offer at DECISION_GATE when confident and not backed off');
  assertOfferShapeOrNull(d.offer_next_step, 'SC6-positive');
});

// ---------- SC3: graceful across mode_a / mode_b / tier_0 (no throw) ----------

run('SC3: no-throw across mode_a / mode_b / tier_0 fixtures; null-or-well-formed each', () => {
  const { decide } = requireEngine();

  // mode_a: brainAvailable true + a RECOMMENDED-marker pattern trace.
  const mode_a = makeContext({
    brainAvailable: true,
    quadruple: makeQuadruple({
      brain: makeBrain({
        sections: Object.assign({}, makeBrain().sections, {
          pattern_matches: { body: '- Run Methodology (confidence: 0.9)', tokens_estimate: 8 },
        }),
      }),
    }),
  });

  // mode_b: brainAvailable false (BRAIN.md present but offline).
  const mode_b = makeContext({
    brainAvailable: false,
    quadruple: makeQuadruple({
      brain: makeBrain({ staleness: 'stale', stale_reason: 'brain_offline' }),
    }),
  });

  // tier_0: quadruple.brain absent.
  const tier_0 = makeContext({
    brainAvailable: false,
    quadruple: makeQuadruple({ brain: null }),
  });

  for (const [label, ctx] of [['mode_a', mode_a], ['mode_b', mode_b], ['tier_0', tier_0]]) {
    let d;
    assert.doesNotThrow(() => { d = decide(makeTurn(), ctx); }, label + ': decide must not throw');
    // offer_next_step must be null OR an object (never an array) in every tier.
    if (d.offer_next_step !== null) {
      assert.equal(Array.isArray(d.offer_next_step), false, label + ': offer never an array');
      assert.equal(typeof d.offer_next_step, 'object', label + ': offer is object-or-null');
    }
  }
});

// ---------- Final summary ----------

const total = passed + failed;
process.stdout.write(
  '\nnavigation-engine-offer: ' + passed + '/' + total + ' passed, ' + failed + ' failed, '
    + red + ' RED (expected until 135-02)\n'
);
// Wave 0 contract: hard failures (failed) fail the suite; tracked RED targets do
// not. 135-02 promotes the runRed() cases to run() once the resolver lands.
process.exit(failed === 0 ? 0 : 1);
