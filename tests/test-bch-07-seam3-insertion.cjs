#!/usr/bin/env node
'use strict';
// Phase 177 - The Behavioral Channel
// BCH-07: the SEAM 3 modifier WIRED-BUT-SHADOWED inside resolveFireSkill(),
// between the sensor-reach branch (nav-engine :466) and the mode_a Brain path
// (:468). The whole contract is the SAFETY INVARIANT: when
// BEHAVIORAL_CHANNEL_ARMED is false (ALWAYS, today), the modifier returns null
// UNCONDITIONALLY, the legacy Brain path runs unchanged, and decide() output is
// BYTE-IDENTICAL to the pre-seam engine. routing_source stays legacy in the
// dormant (null) path -- the seam fires nothing semantic when unarmed.
//
// Pure node asserts, no deps. Mirrors the test-bch-04 ok()/failed idiom.
// No emoji. No em-dashes. Per .planning/phases/177-larry-behavioral-channel/177-SPEC.md.

const path = require('path');
const ROOT = path.resolve(__dirname, '..');

let failed = 0;
function ok(cond, msg) {
  console.log((cond ? '  ok   - ' : '  FAIL - ') + msg);
  if (!cond) failed++;
}

console.log('--- test-bch-07-seam3-insertion ---');

const engine = require(path.join(ROOT, 'lib/core/navigation-engine.cjs'));
const gate = require(path.join(ROOT, 'lib/core/navigation/calibration-gate.cjs'));

// The shipped, constitutional default: the channel is LOCKED today.
ok(gate.BEHAVIORAL_CHANNEL_ARMED === false,
  'BEHAVIORAL_CHANNEL_ARMED is false (the shipped default; channel LOCKED today)');

// (0) The modifier exists and is exported.
ok(typeof engine.behavioralChannelModifier === 'function',
  'behavioralChannelModifier is exported (the SEAM 3 modifier fn exists)');

// ---------------------------------------------------------------------------
// Test 1 -- dormant returns null for ANY input when unarmed.
// ---------------------------------------------------------------------------
const fakeReach = { reach_id: 'contradiction', posture: 'hold' };
const cueInBand = { tier: 'signal', confidence: 0.70 };
const cueKeyword = { tier: 'keyword', confidence: 0.80 };

ok(engine.behavioralChannelModifier(fakeReach, cueInBand, false) === null,
  'Test 1a: unarmed (false) returns null for a fired reach + in-band signal cue');
ok(engine.behavioralChannelModifier(fakeReach, cueKeyword, false) === null,
  'Test 1b: unarmed (false) returns null for a fired reach + keyword cue');
ok(engine.behavioralChannelModifier(null, null, false) === null,
  'Test 1c: unarmed (false) returns null for null reach + null cue');
ok(engine.behavioralChannelModifier(fakeReach, cueInBand, undefined) === null,
  'Test 1d: armed undefined (not true) returns null -- the kill-switch is fail-closed');
ok(engine.behavioralChannelModifier(fakeReach, cueInBand, 'true') === null,
  'Test 1e: armed truthy-but-not-boolean-true returns null -- strict === true gate');
// The gate flag itself, read via the require idiom, drives null today.
ok(engine.behavioralChannelModifier(fakeReach, cueInBand, gate.BEHAVIORAL_CHANNEL_ARMED) === null,
  'Test 1f: armed = BEHAVIORAL_CHANNEL_ARMED (false today) returns null');

// ---------------------------------------------------------------------------
// Test 2 -- byte-identical legacy: decide() with the dormant seam equals the
// pre-seam engine. We prove this two ways:
//   (a) resolveFireSkill (the seam host) returns the SAME value with the seam
//       present as the documented legacy mode_a Brain path produces -- the
//       fall-through is byte-identical because the modifier returns null.
//   (b) decide() output for a representative turn JSON-serializes identically
//       across two calls (determinism + the seam adds nothing semantic).
// ---------------------------------------------------------------------------

// (a) The mode_a Brain quadruple with a parseable pattern_matches verb. The seam
//     sits BEFORE this path; because it returns null, resolveFireSkill must yield
//     the legacy verb's skill family unchanged.
const brainModeA = {
  author: 'brain',
  sections: {
    pattern_matches: {
      body: '- Run Methodology (confidence: 0.85, source: SWOT)\n',
    },
  },
};
// No sensor reaches -> the seam host falls to the mode_a Brain path.
const fsLegacy = engine.resolveFireSkill(brainModeA, 1.0, 'mode_a', []);
ok(fsLegacy === 'methodology-router',
  'Test 2a: resolveFireSkill mode_a Brain path returns the legacy verb family (methodology-router); the dormant seam did not intercept');

// A fired sensor reach still resolves through the sensor branch (BEFORE the seam),
// proving the seam insertion did not displace the sensor-reach precedence.
const fsSensor = engine.resolveFireSkill(null, 0.0, 'tier_0', [{ reach_id: 'contradiction', posture: 'hold' }]);
ok(fsSensor === "Devil's Advocate",
  'Test 2b: a fired sensor reach still maps to its canonical verb (Devil\'s Advocate); sensor branch precedes the dormant seam');

// (b) decide() determinism + dormant-path stability across two identical calls.
const turn = { sectionPath: null, text: 'we should reconsider the framing' };
const context = {
  quadruple: {
    governing_thought: 'gt',
    feynman: 'f',
    minto: 'm',
    brain: brainModeA,
  },
};
const d1 = engine.decide(turn, context);
const d2 = engine.decide(turn, context);
// Strip the LOCAL latency telemetry (Date.now-derived, non-deterministic by design).
function stripVolatile(d) {
  const c = JSON.parse(JSON.stringify(d));
  if (c && c._meta) delete c._meta;
  if (c && c.decision_trace && c.decision_trace._meta) delete c.decision_trace._meta;
  return c;
}
const s1 = JSON.stringify(stripVolatile(d1));
const s2 = JSON.stringify(stripVolatile(d2));
ok(s1 === s2,
  'Test 2c: decide() output is byte-identical across two dormant-seam calls (no semantic contribution)');
ok(d1.fire_skill === 'methodology-router',
  'Test 2d: decide() fire_skill is the legacy mode_a verb family; the dormant seam left fire_skill unchanged');

// ---------------------------------------------------------------------------
// Test 3 -- routing_source stays legacy in the dormant path. For a turn where
// NO sensor reach fires and NO Brain verb resolves, decide() leaves
// routing_source legacy; the dormant modifier does not flip it.
// ---------------------------------------------------------------------------
const tier0Turn = { sectionPath: null, text: '' };
const tier0Context = { quadruple: null }; // brain absent -> tier_0, no verb
const d3 = engine.decide(tier0Turn, tier0Context);
ok(d3.fire_skill === null,
  'Test 3a: tier_0 with no sensor reach and no Brain verb yields fire_skill null');
const rs = (d3.decision_trace && d3.decision_trace.routing_source !== undefined)
  ? d3.decision_trace.routing_source
  : d3.routing_source;
ok(rs === undefined || rs === null || rs === 'legacy',
  'Test 3b: routing_source stays legacy (not flipped to engine) in the dormant path');

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
if (failed === 0) {
  console.log('PASS test-bch-07-seam3-insertion (BCH-07 dormant seam: null defers byte-identical, routing_source legacy)');
  process.exit(0);
} else {
  console.log('FAIL test-bch-07-seam3-insertion (' + failed + ' assertion(s) failed)');
  process.exit(1);
}
