'use strict';
/*
 * Phase 150.5-03 -- ACPT-06 dogfood driver: dial text + card contract emit
 * ATOMICALLY on the engine arm (Canon Part 6 / DIAL-ATOM-02).
 * =======================================================================
 *
 * THE PROOF this acceptance leg exists to make: the two defects Phase 150.5
 * repaired can never again hide behind a green harness.
 *
 *   1. The dead-sensor spine (SENS-FIX-01): the turn driven here is the EXACT
 *      PRODUCTION shape the hook builds (userText / sectionPath / sessionId,
 *      scripts/intent-classifier.cjs builder) with NO hand-shaped signal bag
 *      and NO text alias. The Plan-01 seam (dispatchSensors entry
 *      normalization in lib/core/insight-sensors.cjs) must derive the
 *      artifact-filed signal fuel from the REAL on-disk side-channel
 *      (.mindrian/last-cascade.json) for the sensor to fire. If the seam dies,
 *      this arm goes RED.
 *
 *   2. The split render (DIAL-ATOM-01): on the engine arm the emitted block
 *      must carry BOTH the dial text ('Choose next reach:' -- the F.7 prompt
 *      that FIX-09/150.6-04 substituted for the legacy 'Larry can reach for:')
 *      AND the
 *      AskUserQuestion card contract trailer ('[AskUserQuestion contract:')
 *      together -- one emission site, never text-only. If the trailer is ever
 *      dropped again (the :896-899 discard SEED-021 found), this arm goes RED.
 *
 *   Arm A (FIRE, production shape): contradict fixture room -> the REAL
 *         engine.decide() with the production turn -> fire_skill non-null
 *         (seam-derived signal fuel; sensorArtifactFiled fired) ->
 *         routeActivation source === engine.
 *   Arm B (ATOMIC EMISSION): renderEngineDecisionWithDial on the engine arm
 *         emits dial text AND card contract together (trigger-chain gate 11
 *         closed). The tier_0 arm here IS the D-01 sensor-fired cold card.
 *   Arm C (NEGATIVE, honest): a COLD room (no side-channel), same production
 *         turn shape -> fire_skill null -> source legacy -> the rendered block
 *         contains NEITHER the dial text NOR the contract trailer.
 *   Arm D (Part-8 sentinel): an obviously-fictional proprietary sentinel in
 *         the side-channel finding body never rides the emitted block or the
 *         stringified decision_trace (generic scalars only).
 *
 * Mirrors tests/test-acpt-01-engine-fires.cjs: real units only (engine.decide,
 * router.routeActivation, the classifier's renderEngineDecisionWithDial), no
 * stub of any unit under test, tmp fixtures cleaned in finally, clear exit
 * code, completes well under the doctor 120000ms spawn budget. No network, no
 * live Brain. ACPT-06 samples trigger-chain gates 4, 6, 7 and 11 in one pass.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const engine = require(path.join(ROOT, 'lib', 'core', 'navigation-engine.cjs'));
const router = require(path.join(ROOT, 'lib', 'core', 'skill-activation-router.cjs'));
const classifier = require(path.join(ROOT, 'scripts', 'intent-classifier.cjs'));
const { makeSyntheticRoom } = require(path.join(__dirname, 'dogfood', 'fixtures', 'synthetic-room.cjs'));

// Guard: this suite must NEVER prove the stub. Scrub the env defensively so
// every positive is unambiguously the SENSOR's (the proof is the sensor, not
// the MOS_NAV_TEST_FIRE_SKILL stub -- T-150.5-10 false-green guard).
delete process.env.MOS_NAV_TEST_FIRE_SKILL;
delete process.env.MOS_NAV_TEST_SUPPRESS_SKILLS;

// An obviously-fictional proprietary sentinel for the Part-8 provenance proof.
const PART8_SENTINEL = 'SECRET-ACPT06-DIALMARGIN-77pct-FICTIONAL';

// The two atomic-emission assertion substrings (DIAL-ATOM-01). FIX-09 (150.6-04):
// the dial-text marker is now the F.7 'Choose next reach:' prompt (SKILL.md:257),
// which replaced the legacy 'Larry can reach for:' header.
const DIAL_TEXT_SUBSTRING = 'Choose next reach:';
const CONTRACT_SUBSTRING = '[AskUserQuestion contract:';

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// The legacy file-state activation the classifier passes as routeActivation's
// 2nd arg. A populated room's legacy lane carries room-passive.
function legacyActivation() { return ['room-passive']; }

// The EXACT production turn shape the hook builds (intent-classifier builder):
// userText / sectionPath / sessionId ONLY. NO signal bag is ever set here --
// the Plan-01 seam must derive the signal fuel from the side-channel, or the
// fire arm honestly fails.
function productionTurn() {
  return { userText: '', sectionPath: null, sessionId: 'acpt-06' };
}

// =====================================================================
// Arm A -- FIRE: the production-shaped turn fires a REAL sensor via the seam
// =====================================================================
(function armA_productionTurnFiresRealSensor() {
  const label =
    'ACPT-06 A FIRE: the PRODUCTION turn shape (no hand-shaped signal bag) -> seam-derived fuel -> real sensor fires -> routeActivation source === engine';
  let fixture = null;
  try {
    fixture = makeSyntheticRoom({ contradict: true });

    const decision = engine.decide(productionTurn(), {
      quadruple: null,        // tier_0: no Brain quadruple
      brainAvailable: false,  // the fire must NOT depend on Brain
      roomDir: fixture.roomDir,
    });
    assert.ok(
      decision.fire_skill !== null && decision.fire_skill !== undefined,
      label + ': fire_skill must be non-null -- the Plan-01 seam derived the artifact-filed fuel from the FRESH side-channel and sensorArtifactFiled fired'
    );

    const routing = router.routeActivation(decision, legacyActivation());
    assert.equal(
      routing.source,
      'engine',
      label + ': a real-sensor canonical fire_skill must flip routing_source to engine (trigger-chain gate 6)'
    );
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    if (fixture) fixture.cleanup();
  }
})();

// =====================================================================
// Arm B -- ATOMIC EMISSION: dial text + card contract together (gate 11)
// =====================================================================
(function armB_atomicEmissionTextAndContractTogether() {
  const label =
    'ACPT-06 B ATOMIC: renderEngineDecisionWithDial on the engine arm emits the dial text AND the AskUserQuestion card contract together (never text-only)';
  let fixture = null;
  try {
    fixture = makeSyntheticRoom({ contradict: true });

    const decision = engine.decide(productionTurn(), {
      quadruple: null,
      brainAvailable: false,
      roomDir: fixture.roomDir,
    });
    const routing = router.routeActivation(decision, legacyActivation());
    assert.equal(routing.source, 'engine', label + ': precondition -- the engine flip must hold before the render');

    const block = classifier.renderEngineDecisionWithDial(
      decision, routing, null, { cortexNodes: [] }
    );
    assert.equal(typeof block, 'string', label + ': the render must return a string block');
    assert.ok(
      block.indexOf(DIAL_TEXT_SUBSTRING) !== -1,
      label + ': the emitted block must contain the dial text header (the navigator SEES the reaches)'
    );
    assert.ok(
      block.indexOf(CONTRACT_SUBSTRING) !== -1,
      label + ': the emitted block must contain the AskUserQuestion contract trailer (DIAL-ATOM-01: text and card are atomic; gate 11 closed)'
    );
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    if (fixture) fixture.cleanup();
  }
})();

// =====================================================================
// Arm C -- NEGATIVE (honest): a cold room emits NEITHER text NOR contract
// =====================================================================
(function armC_coldRoomLegacyEmitsNeither() {
  const label =
    'ACPT-06 C NEGATIVE: a COLD room (no side-channel) + the production turn -> fire_skill null -> source legacy -> the block contains NEITHER dial text NOR contract';
  let fixture = null;
  try {
    fixture = makeSyntheticRoom({ contradict: false });

    const decision = engine.decide(productionTurn(), {
      quadruple: null,
      brainAvailable: false,
      roomDir: fixture.roomDir,
    });
    assert.equal(
      decision.fire_skill,
      null,
      label + ': no side-channel fuel + tier_0 -> fire_skill must stay null (the seam derives nothing from an absent side-channel)'
    );

    const routing = router.routeActivation(decision, legacyActivation());
    assert.equal(
      routing.source,
      'legacy',
      label + ': a silent engine must degrade honestly to legacy (Phase 144 honest-negative unamended)'
    );

    const block = classifier.renderEngineDecisionWithDial(
      decision, routing, null, { cortexNodes: [] }
    );
    assert.equal(typeof block, 'string', label + ': the render must return a string block');
    assert.equal(
      block.indexOf(DIAL_TEXT_SUBSTRING),
      -1,
      label + ': the legacy arm must NOT render the dial text (no dead chrome on a silent loop)'
    );
    assert.equal(
      block.indexOf(CONTRACT_SUBSTRING),
      -1,
      label + ': the legacy arm must NOT render the card contract (no broken promise on a silent loop)'
    );
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    if (fixture) fixture.cleanup();
  }
})();

// =====================================================================
// Arm D -- Part-8 sentinel: user content never rides the render or the trace
// =====================================================================
(function armD_part8SentinelNeverLeaks() {
  const label =
    'ACPT-06 D PART-8: the fictional proprietary sentinel in the side-channel finding body never appears in the emitted block or the stringified decision_trace';
  let fixture = null;
  try {
    fixture = makeSyntheticRoom({ contradict: true, sentinel: PART8_SENTINEL });

    const decision = engine.decide(productionTurn(), {
      quadruple: null,
      brainAvailable: false,
      roomDir: fixture.roomDir,
    });
    const routing = router.routeActivation(decision, legacyActivation());
    assert.equal(routing.source, 'engine', label + ': precondition -- the engine flip must hold before the sweep');

    const block = classifier.renderEngineDecisionWithDial(
      decision, routing, null, { cortexNodes: [] }
    );
    assert.equal(
      block.indexOf(PART8_SENTINEL),
      -1,
      label + ': the emitted block must NOT contain the sentinel (generic scalars only ride the render)'
    );
    const traceStr = JSON.stringify(decision.decision_trace || {});
    assert.equal(
      traceStr.indexOf(PART8_SENTINEL),
      -1,
      label + ': the stringified decision_trace must NOT contain the sentinel (Part 8 hard fence)'
    );
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    if (fixture) fixture.cleanup();
  }
})();

// =====================================================================
// GUARD: the suite never relied on the stub (the proof is the SENSOR)
// =====================================================================
(function guard_noStubInEnv() {
  const label =
    'ACPT-06 GUARD: MOS_NAV_TEST_FIRE_SKILL is unset for the whole suite (every positive proves the SENSOR via the seam, never the stub)';
  try {
    assert.equal(
      process.env.MOS_NAV_TEST_FIRE_SKILL,
      undefined,
      label + ': the stub env override must never be set'
    );
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write(
  'ACPT-06 dial atomic emission (Phase 150.5-03 acceptance): ' +
  passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
