#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 135-02 -- Offer Resolver + Abstention unit suite (PROMOTED TO GREEN)
 * =========================================================================
 * Pins the resolveOfferNextStep contract (SC1 / SC2 / SC3 / SC4 / SC5 / SC6).
 * resolveOfferNextStep is NOT exported from navigation-engine.cjs; we exercise it
 * through the public decide(turn, context) entry and read decision.offer_next_step.
 * The resolver now delegates to lib/core/navigation-engine-offer.cjs (Phase 135-02),
 * so the Wave-0 runRed() targets are PROMOTED to hard run() here (the runRed wrapper
 * is deleted per the 135-01 contract).
 *
 * This suite covers the resolver CONTRACT on in-memory fixtures (db null -> the SC2
 * graph reads degrade gracefully; SC4 MD-aware reads still move the margin via the
 * quadruple-resident reasoning leg + context.jtbd). The real-room.db path (SC2
 * neighborhood + memory_event tail reads via the navigation chokepoint) is exercised
 * by the SC2-real-db case below and end-to-end by tests/test-135-decide-wiring-e2e.cjs.
 *
 * Test map:
 *   SC1  -- offer is null OR an object with EXACTLY {command, framework, jtbd,
 *           confidence, reason, scope}; never an array; never more than one.
 *   SC6  -- null when context.operator === 'JUST_TALK'.
 *   SC6  -- null when the top command is in rejection-backoff (shouldExclude).
 *   SC6  -- an offer at context.operator === 'DECISION_GATE' when margin is
 *           sufficient and the command is not in backoff.
 *   SC6  -- EXPLORE_CAPTURE / BUILD_ROOM offer ONLY when margin >= STRONG_SIGNAL.
 *   SC6  -- below MARGIN_THRESHOLD (0.15) returns null.
 *   SC4  -- the MINTO governing thought + active JTBD measurably move the outcome.
 *   SC5  -- the reason carries a [[wikilink]] and isReasonGrounded(reason) === 'ok'.
 *   SC2  -- real room.db: the resolver consumes the local graph neighborhood +
 *           memory_event tail via the navigation chokepoint without crashing.
 *   SC3  -- no-throw across mode_a / mode_b / tier_0 fixtures and when db is null.
 *
 * Framework: direct-CJS node:assert/strict, no external runner.
 * No em-dashes (hyphens only). No emoji.
 * Registered in tests/run-all-135.sh.
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

// The Wave-0 runRed() wrapper has been DELETED per the 135-01 contract: 135-02
// fills the resolver, so the previously-RED targets are now hard run() cases.

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

run('SC1: a populated resolver offer carries EXACTLY the six canonical keys', () => {
  const { decide } = requireEngine();
  const d = decide(makeTurn(), makeContext());
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

run('SC6: returns null when the top offered command is in rejection-backoff', () => {
  const { decide } = requireEngine();
  // First, learn which command the resolver WOULD offer at DECISION_GATE with no
  // backoff seeded.
  const baseline = decide(makeTurn(), makeContext());
  assert.notEqual(baseline.offer_next_step, null,
    'baseline DECISION_GATE turn should produce an offer');
  const offered = baseline.offer_next_step.command;
  assert.equal(typeof offered, 'string', 'offered command is a string');

  // Now seed THAT command into rejection-backoff. DECAY_WINDOW=5,
  // EXCLUSION_THRESHOLD=0.1: factor = 1 - exp(-(n/5)); n=0 gives factor 0 < 0.1 ->
  // excluded. shouldExclude(offered) is therefore true and the resolver must abstain.
  const ctx = makeContext({
    roomState: {
      db: null,
      roomDir: '/tmp/fixture-room',
      invocationsSinceDecision: { [offered]: 0 },
    },
  });
  const d = decide(makeTurn(), ctx);
  assert.equal(d.offer_next_step, null,
    'resolver must abstain when the top command is in rejection-backoff');
});

// ---------- SC6: positive -- offer at DECISION_GATE ----------

run('SC6: emits an offer at DECISION_GATE when margin is sufficient and not in backoff', () => {
  const { decide } = requireEngine();
  const d = decide(makeTurn(), makeContext({ operator: 'DECISION_GATE' }));
  assert.notEqual(d.offer_next_step, null,
    'resolver should emit an offer at DECISION_GATE when confident and not backed off');
  assertOfferShapeOrNull(d.offer_next_step, 'SC6-positive');
});

// ---------- SC6: operator strong-signal gate (rank-first, gate-second) ----------

run('SC6: EXPLORE_CAPTURE / BUILD_ROOM stay silent unless margin >= STRONG_SIGNAL_THRESHOLD', () => {
  const offerHelper = require(path.join(REPO, 'lib/core/navigation-engine-offer.cjs'));
  assert.equal(offerHelper.MARGIN_THRESHOLD, 0.15, 'MARGIN_THRESHOLD must be 0.15');
  assert.equal(offerHelper.STRONG_SIGNAL_THRESHOLD, 0.30, 'STRONG_SIGNAL_THRESHOLD must be 0.30');

  // With the in-memory fixture (db null), the ranker margin is a tie (0); the MD
  // relevance boost (present-fresh governing thought + present JTBD) lifts the
  // effective margin to ~0.24 -- enough for the DECISION_GATE floor (0.15) but
  // below the strong-signal bar (0.30). So EXPLORE_CAPTURE / BUILD_ROOM must abstain
  // while DECISION_GATE offers.
  const { decide } = requireEngine();
  const dg = decide(makeTurn(), makeContext({ operator: 'DECISION_GATE' }));
  assert.notEqual(dg.offer_next_step, null, 'DECISION_GATE offers at the ordinary floor');

  for (const op of ['EXPLORE_CAPTURE', 'BUILD_ROOM']) {
    const d = decide(makeTurn(), makeContext({ operator: op }));
    assert.equal(d.offer_next_step, null,
      op + ' must stay silent below the strong-signal bar (default-silent)');
  }
});

// ---------- SC6: margin floor -- low-confidence abstain ----------

run('SC6: below MARGIN_THRESHOLD returns null (absent governing thought + missing JTBD)', () => {
  const { decide } = requireEngine();
  // Strip the MD signal: stale + empty governing thought AND no active JTBD. Both
  // legs apply the MD penalty, dragging the effective margin below 0.15.
  const ctx = makeContext({
    operator: 'DECISION_GATE',
    jtbd: null,
    quadruple: makeQuadruple({
      reasoning: {
        exists: true, governing_thought: '', reasoning_health_score: 0.2,
        is_stale: true, arguments: [],
      },
    }),
  });
  const d = decide(makeTurn(), ctx);
  assert.equal(d.offer_next_step, null,
    'must abstain below the margin floor when the MD signal is absent / stale');
});

// ---------- SC4: MD-aware -- governing thought + active JTBD move the outcome ----------

run('SC4: a present-fresh governing thought + active JTBD raise confidence vs absent/missing', () => {
  const { decide } = requireEngine();
  // Strong MD signal -> an offer fires.
  const strong = decide(makeTurn(), makeContext({ operator: 'DECISION_GATE' }));
  assert.notEqual(strong.offer_next_step, null, 'strong MD signal yields an offer');

  // Same room, MD signal removed -> abstention. This proves the MINTO governing
  // thought + the active JTBD are CONSUMED into the decision, not present-but-ignored.
  const weak = decide(makeTurn(), makeContext({
    operator: 'DECISION_GATE',
    jtbd: null,
    quadruple: makeQuadruple({
      reasoning: {
        exists: true, governing_thought: '', reasoning_health_score: 0.2,
        is_stale: true, arguments: [],
      },
    }),
  }));
  assert.equal(weak.offer_next_step, null,
    'removing the governing thought + JTBD tips the outcome to abstention');
});

// ---------- SC5: grounded [[wikilink]] reason ----------

run('SC5: reason carries a [[wikilink]] and passes the presenter grounding gate', () => {
  const { decide } = requireEngine();
  const d = decide(makeTurn(), makeContext({ operator: 'DECISION_GATE' }));
  assert.notEqual(d.offer_next_step, null, 'offer present');
  const reason = d.offer_next_step.reason;
  assert.equal(typeof reason, 'string', 'reason is a string');
  assert.equal(reason.includes('[['), true, 'reason contains an opening wikilink');
  assert.equal(reason.includes(']]'), true, 'reason contains a closing wikilink');
  assert.equal(reason.includes('[[undefined]]'), false, 'reason is never [[undefined]]');
  const presenter = require(path.join(REPO, 'lib/core/offer-presenter.cjs'));
  assert.equal(presenter._isReasonGrounded(reason), 'ok',
    'presenter grounding gate must return ok');
});

// ---------- SC2: real room.db -- neighborhood + memory_event tail consumed ----------

run('SC2: with a real room.db handle the resolver consumes graph + memory_event reads without crashing', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const navigation = require(path.join(REPO, 'lib/core/navigation.cjs'));
  const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib/core/room-db.cjs'));
  const SEED_SQL = path.join(REPO, 'tests', 'fixtures', 'phase-109', 'sample-room', 'seed.sql');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-135-unit-sc2-'));
  let db = null;
  try {
    db = openRoomDb(tmp);
    db.exec(fs.readFileSync(SEED_SQL, 'utf8'));

    const { decide } = requireEngine();
    const ctx = makeContext({
      operator: 'DECISION_GATE',
      roomState: { db: db, roomDir: tmp },
    });
    let d;
    assert.doesNotThrow(() => { d = decide(makeTurn(), ctx); },
      'decide() must not throw with a live room.db handle');
    // The offer is null-or-well-formed; the SC2 reads (getNeighborhood /
    // findRecentChanges / firstCapturedLastTouchedBySection) run through the
    // chokepoint and feed confidence. We assert the path is exercised and stable.
    if (d.offer_next_step !== null) {
      assertOfferShapeOrNull(d.offer_next_step, 'SC2-real-db');
    }
  } finally {
    if (db) { try { closeRoomDb(db); } catch (_e) { /* ignore */ } }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* ignore */ }
  }
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
  '\nnavigation-engine-offer: ' + passed + '/' + total + ' passed, ' + failed + ' failed'
    + (red > 0 ? ', ' + red + ' RED' : '') + '\n'
);
// 135-02 promoted every Wave-0 runRed() target to a hard run(); the suite fails on
// any hard failure.
process.exit(failed === 0 ? 0 : 1);
