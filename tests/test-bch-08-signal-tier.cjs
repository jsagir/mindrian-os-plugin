#!/usr/bin/env node
'use strict';
// Phase 177 - The Behavioral Channel
// BCH-08: the protected-band tier ordering. A SIGNAL-tier cue outranks a
// KEYWORD-tier cue INSIDE the protected band (0.50 <= confidence < 0.85), but
// the same band cue LOSES to a Brain RECOMMENDED confidence >= 0.70
// (RECOMMENDED_CONFIDENCE_FLOOR). Both directions tested. The 0.85 ceiling is
// >= 0.70 + 0.15 by construction (BCH-06), so a cue at the band ceiling still
// loses to Brain 0.70 -- the 15-point margin holds.
//
// All thresholds are READ from the engine-owned constants via the require idiom;
// NONE is re-typed in this test (BCH-05). Exercised against the modifier's pure
// ordering helpers directly, since the gated runtime call returns null when the
// flag is unarmed (which it always is today). Pure node asserts, no deps.
// Mirrors the test-bch-04 ok()/failed idiom. No emoji. No em-dashes.

const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let failed = 0;
function ok(cond, msg) {
  console.log((cond ? '  ok   - ' : '  FAIL - ') + msg);
  if (!cond) failed++;
}

console.log('--- test-bch-08-signal-tier ---');

// REQUIRE ORDER MATTERS: f-selector-ranker MUST be required BEFORE
// navigation-engine. The two modules form a load-time cycle (the ranker reads
// navigation-engine's RECOMMENDED_CONFIDENCE_FLOOR to COMPUTE its CEILING =
// floor + 0.15). When navigation-engine is required first, the ranker loads
// mid-cycle and reads an undefined floor, leaving CEILING NaN -- a PRE-EXISTING
// latent quirk of the pair (present on the pre-177-09 baseline). Requiring the
// ranker first lets it finish its computation with the floor available. This
// mirrors calibration-gate.cjs (177-08), which reads floor/ceiling the same way.
const ranker = require(path.join(ROOT, 'lib/workflow/f-selector-ranker.cjs'));
const engine = require(path.join(ROOT, 'lib/core/navigation-engine.cjs'));
const sensorTypes = require(path.join(ROOT, 'lib/core/sensors/sensor-types.cjs'));

// Engine-owned constants, READ never re-typed (BCH-05).
const FLOOR = ranker.BEHAVIORAL_CHANNEL_FLOOR;       // 0.50
const CEILING = ranker.BEHAVIORAL_CHANNEL_CEILING;   // 0.85 (== Brain floor + 0.15)
const BRAIN_FLOOR = engine.RECOMMENDED_CONFIDENCE_FLOOR; // 0.70

// Sanity: the helpers exist + the tier order is signal-above-keyword (read, not typed).
ok(typeof engine.rankBehavioralCue === 'function', 'rankBehavioralCue is exported');
ok(typeof engine.bandCueLosesToBrain === 'function', 'bandCueLosesToBrain is exported');
ok(sensorTypes.TRIGGER_TIERS.indexOf('signal') < sensorTypes.TRIGGER_TIERS.indexOf('keyword'),
  'TRIGGER_TIERS ranks signal above keyword (read from sensor-types, never a re-typed order)');

// A mid-band confidence both cues share (so tier, not confidence, decides Test A).
const midBand = (FLOOR + CEILING) / 2; // ~0.675, strictly inside [FLOOR, CEILING)
ok(midBand >= FLOOR && midBand < CEILING, 'midBand test value is inside the protected band');

// ---------------------------------------------------------------------------
// Test A -- signal > keyword, in band. Two competing cues at the SAME in-band
// confidence; the SIGNAL-tier cue wins on tier precedence.
// ---------------------------------------------------------------------------
const signalCue = { tier: 'signal', confidence: midBand };
const keywordCue = { tier: 'keyword', confidence: midBand };
ok(engine.rankBehavioralCue(signalCue, keywordCue) === signalCue,
  'Test A: signal-tier cue outranks keyword-tier cue at equal in-band confidence (arg order 1)');
ok(engine.rankBehavioralCue(keywordCue, signalCue) === signalCue,
  'Test A: signal-tier cue outranks keyword-tier cue (arg order reversed -- order-independent)');
// Even when the keyword cue has HIGHER confidence, signal tier still wins (tier first).
const keywordHigher = { tier: 'keyword', confidence: CEILING - 0.001 };
const signalLower = { tier: 'signal', confidence: FLOOR + 0.001 };
ok(engine.rankBehavioralCue(keywordHigher, signalLower) === signalLower,
  'Test A: signal tier beats keyword tier even when keyword has higher confidence (tier precedes confidence)');

// ---------------------------------------------------------------------------
// Test B -- signal loses to Brain >= 0.70, in band. A SIGNAL-tier cue inside the
// protected band CANNOT override a Brain RECOMMENDED confidence >= 0.70.
// ---------------------------------------------------------------------------
ok(engine.bandCueLosesToBrain(signalCue, BRAIN_FLOOR) === true,
  'Test B: an in-band signal cue LOSES to Brain at exactly the RECOMMENDED floor (0.70)');
ok(engine.bandCueLosesToBrain(signalCue, BRAIN_FLOOR + 0.10) === true,
  'Test B: an in-band signal cue LOSES to Brain above the floor');
// Below the Brain floor, the band cue does NOT lose to Brain (the other direction).
ok(engine.bandCueLosesToBrain(signalCue, BRAIN_FLOOR - 0.01) === false,
  'Test B (other direction): an in-band cue does NOT lose to a Brain confidence below 0.70');
// A cue OUTSIDE the band is not subject to the band-loses rule (defensive).
const aboveCeil = { tier: 'signal', confidence: CEILING + 0.05 };
ok(engine.bandCueLosesToBrain(aboveCeil, BRAIN_FLOOR) === false,
  'Test B (boundary): a cue ABOVE the ceiling is not a protected-band cue, so the band-loses rule does not apply');

// ---------------------------------------------------------------------------
// Test C -- band-boundary 15-point margin. The ceiling is the Brain floor + 0.15
// by construction, so a cue at the band ceiling still loses to Brain 0.70.
// We read both constants and assert the >= 15-point margin holds (never typed).
// ---------------------------------------------------------------------------
ok(Math.abs((CEILING - BRAIN_FLOOR) - 0.15) < 1e-9,
  'Test C: ceiling - Brain-floor == 0.15 (the BCH-06 15-point margin, computed from the engine constants)');
ok(CEILING >= BRAIN_FLOOR + 0.15 - 1e-9,
  'Test C: the ceiling sits at least 15 points above the Brain floor');
// A cue at the TOP of the protected band (just below the ceiling) still loses to Brain 0.70.
const atTopOfBand = { tier: 'signal', confidence: CEILING - 1e-6 };
ok(engine.bandCueLosesToBrain(atTopOfBand, BRAIN_FLOOR) === true,
  'Test C: a cue at the top of the protected band still loses to Brain at the 0.70 floor');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
if (failed === 0) {
  console.log('PASS test-bch-08-signal-tier (BCH-08: signal>keyword in band, signal loses to Brain>=0.70, 15-point margin holds)');
  process.exit(0);
} else {
  console.log('FAIL test-bch-08-signal-tier (' + failed + ' assertion(s) failed)');
  process.exit(1);
}
