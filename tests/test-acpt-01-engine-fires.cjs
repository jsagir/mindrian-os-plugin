'use strict';
/*
 * Phase 146-01 -- ACPT-01 dogfood driver: the loop FIRES (Canon Part 6).
 * ====================================================================
 *
 * THE PROOF this acceptance leg exists to make: a scripted dogfood turn whose
 * REAL fired sensor (the shipped SENS-06 CASC-01 side-channel, a CONTRADICT
 * finding) flips routing_source legacy -> engine through the PRODUCTION
 * decide() -> routeActivation boundary, persists a decision trace, and renders
 * the fired reach_id + posture via the REAL scripts/explain-decision-command.cjs.
 *
 * This is the gate that distinguishes "the loop EXISTS" from "the loop FIRES"
 * (Canon Part 6 dog-fooding mandate). It drives the REAL shipped units and
 * NEVER the MOS_NAV_TEST_FIRE_SKILL stub -- the proof is the SENSOR, not a stub.
 *
 * Path chosen (per Plan 144-03 + the 146 ACPT-01 fence): the decide() ->
 * routeActivation BOUNDARY. That is the exact production wiring the classifier
 * uses (intent-classifier.cjs:1385 calls router.routeActivation(out.decision,
 * legacyActivation)). Driving it with a turn carrying a REAL sensor signal is a
 * faithful, stub-free proof of the flip.
 *
 *   Test A (POSITIVE, REAL sensor): a contradict room -> decide() canonical
 *          fire_skill "Devil's Advocate" -> routeActivation source === engine
 *          + reason === engine_fire_skill_set. No stub anywhere.
 *   Test B (TRACE PERSIST + RENDER): a persisted decision-traces/<session>.json
 *          carrying routing_source: engine + the fired reach_id 'contradiction'
 *          + posture 'pull_back' renders through the REAL explain-decision CLI;
 *          stdout contains "source: engine" AND "contradiction" AND "pull_back".
 *   Test C (NEGATIVE, honest): a cold room -> fire_skill null -> source legacy.
 *          The gate is not a false-green: a silent loop reports legacy.
 *   Test D (Part 8 provenance): the chosen_rationale names reach_id + posture
 *          ONLY -- it must NOT contain the fictional sentinel written into the
 *          side-channel finding body.
 *
 * Structured so the Phase 146 Plan 04 aggregator can require it as-is: a single
 * node-runnable file, clear pass/fail exit code, tmp fixtures cleaned in finally.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const engine = require(path.join(ROOT, 'lib', 'core', 'navigation-engine.cjs'));
const router = require(path.join(ROOT, 'lib', 'core', 'skill-activation-router.cjs'));
const shared = require(path.join(ROOT, 'lib', 'core', 'navigation-engine-shared.cjs'));
const { makeSyntheticRoom } = require(path.join(__dirname, 'dogfood', 'fixtures', 'synthetic-room.cjs'));
const CANONICAL_VERBS = shared.CANONICAL_VERBS;
const EXPLAIN_CLI = path.join(ROOT, 'scripts', 'explain-decision-command.cjs');

// Guard: this suite must NEVER prove the stub. Scrub the env defensively so the
// flip is unambiguously the sensor's (T-146-02 repudiation guard).
delete process.env.MOS_NAV_TEST_FIRE_SKILL;
delete process.env.MOS_NAV_TEST_SUPPRESS_SKILLS;

// An obviously-fictional proprietary sentinel for the Part-8 provenance proof.
const PART8_SENTINEL = 'SECRET-DOGFOOD-MARGIN-42pct-FICTIONAL';

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

// =====================================================================
// Test A -- POSITIVE: REAL fired sensor -> routing_source: engine (NO stub)
// =====================================================================
(function testA_realSensorFlipsToEngine() {
  const label =
    'ACPT-01 A POSITIVE: a REAL fired SENS-06 sensor (no stub) -> decide() canonical fire_skill -> routeActivation source === engine';
  let fixture = null;
  try {
    fixture = makeSyntheticRoom({ contradict: true, sentinel: PART8_SENTINEL });

    // The REAL sensor signal, threaded the way decide() consumes it. NO
    // MOS_NAV_TEST_FIRE_SKILL: the fire_skill is produced by the sensor branch
    // reading the on-disk CONTRADICT side-channel, not by an env override.
    const turn = { signals: ['artifact_filed'], sectionPath: null };
    const context = {
      quadruple: null,        // tier_0: no Brain quadruple
      brainAvailable: false,  // Brain absent -- the flip must NOT depend on Brain
      roomDir: fixture.roomDir,
    };

    const decision = engine.decide(turn, context);
    assert.equal(
      decision.fire_skill,
      "Devil's Advocate",
      label + ': the REAL CONTRADICT sensor must drive fire_skill to the Devil\'s Advocate canonical verb'
    );
    assert.ok(
      CANONICAL_VERBS.indexOf(decision.fire_skill) !== -1,
      label + ': fire_skill must be one of the closed 10 canonical verbs'
    );

    const rationale = (decision.decision_trace && decision.decision_trace.chosen_rationale) || '';
    assert.ok(
      rationale.indexOf('contradiction') !== -1,
      label + ': the rationale must name the fired reach_id (sensor-driven provenance)'
    );

    const routing = router.routeActivation(decision, legacyActivation());
    assert.equal(
      routing.source,
      'engine',
      label + ': a real-sensor canonical fire_skill must flip routing_source to engine'
    );
    assert.equal(
      routing.reason,
      'engine_fire_skill_set',
      label + ': the flip reason must be engine_fire_skill_set (Precedence Rule 1)'
    );
    assert.deepEqual(
      routing.activated_skills,
      ["Devil's Advocate"],
      label + ': the engine fire_skill must win over the legacy room-passive activation'
    );
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    if (fixture) fixture.cleanup();
  }
})();

// =====================================================================
// Test B -- TRACE PERSIST + RENDER through the REAL explain-decision CLI
// =====================================================================
(function testB_persistedTraceRendersEngineReachPosture() {
  const label =
    'ACPT-01 B RENDER: a persisted engine trace renders source: engine + reach_id contradiction + posture pull_back via the REAL explain-decision CLI';
  let fixture = null;
  try {
    // activeRegistry: the room sits under a rooms-home with .rooms/registry.json
    // so explain-decision's resolveActiveRoomDir resolves THIS fixture room.
    fixture = makeSyntheticRoom({ contradict: true, activeRegistry: true });

    // Drive the REAL engine to get an authentic engine decision + routing, then
    // persist a trace turn mirroring the intent-classifier merge shape
    // (turn.routing_source + chosen_rationale naming the reach/posture).
    const decision = engine.decide(
      { signals: ['artifact_filed'], sectionPath: null },
      { quadruple: null, brainAvailable: false, roomDir: fixture.roomDir }
    );
    const routing = router.routeActivation(decision, legacyActivation());
    assert.equal(routing.source, 'engine', label + ': precondition -- engine flip must hold before render');

    const sessionId = 'acpt01-render-session';
    const t = decision.decision_trace;
    const traceTurn = {
      turn: 1,
      at: new Date().toISOString(),
      elapsed_ms: 0,
      brain_md_tier_mode: t.brain_md_tier_mode,
      brain_md_weight_applied: t.brain_md_weight_applied,
      chosen_rationale: t.chosen_rationale,
      // The intent-classifier merge: routing.source -> turn.routing_source.
      routing_source: routing.source,
      routing_reason: routing.reason,
      routing_activated_skills: routing.activated_skills,
    };
    const tracesDir = path.join(fixture.roomDir, '.mindrian', 'decision-traces');
    fs.mkdirSync(tracesDir, { recursive: true });
    fs.writeFileSync(
      path.join(tracesDir, sessionId + '.json'),
      JSON.stringify({ traces: [traceTurn] }),
      'utf8'
    );

    // Run the REAL explain-decision CLI against the fixture room. Point
    // MINDRIAN_ROOMS_HOME at the rooms-home so resolveActiveRoomDir resolves it;
    // pass --session so the renderer reads our persisted trace.
    const env = Object.assign({}, process.env, {
      MINDRIAN_ROOMS_HOME: fixture.roomsHome,
    });
    delete env.CLAUDE_SESSION_ID; // do not let an ambient session shadow --session
    const res = spawnSync('node', [EXPLAIN_CLI, '--session', sessionId], {
      env: env,
      encoding: 'utf8',
    });
    const out = (res.stdout || '') + (res.stderr || '');

    assert.equal(res.status, 0, label + ': the explain-decision CLI must exit 0 (advisory-only contract)');
    assert.ok(
      out.indexOf('source: engine') !== -1,
      label + ': the rendered trace must show "source: engine" (the flip is audit-visible)'
    );
    assert.ok(
      out.indexOf('contradiction') !== -1,
      label + ': the rendered trace must name the fired reach_id "contradiction"'
    );
    assert.ok(
      out.indexOf('pull_back') !== -1,
      label + ': the rendered trace must name the fired posture "pull_back"'
    );
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    if (fixture) fixture.cleanup();
  }
})();

// =====================================================================
// Test C -- NEGATIVE (honest): cold room -> routing_source: legacy
// =====================================================================
(function testC_coldRoomStaysLegacy() {
  const label =
    'ACPT-01 C NEGATIVE: a cold room with NO sensor signal -> decide() fire_skill null -> routeActivation source === legacy (honest negative)';
  let fixture = null;
  try {
    // No contradict side-channel: the engine genuinely runs and is silent.
    fixture = makeSyntheticRoom({ contradict: false });

    const turn = { signals: [], sectionPath: null };
    const context = { quadruple: null, brainAvailable: false, roomDir: fixture.roomDir };

    const decision = engine.decide(turn, context);
    assert.equal(
      decision.fire_skill,
      null,
      label + ': no sensor reach + tier_0 -> fire_skill must stay null'
    );

    const routing = router.routeActivation(decision, legacyActivation());
    assert.equal(
      routing.source,
      'legacy',
      label + ': a silent engine must degrade honestly to legacy (the flip is a CONSEQUENCE of a fired reach, never unconditional)'
    );
    assert.deepEqual(
      routing.activated_skills,
      ['room-passive'],
      label + ': the legacy file-state activation must pass through unchanged'
    );
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    if (fixture) fixture.cleanup();
  }
})();

// =====================================================================
// Test D -- Part 8 provenance: rationale names reach_id + posture ONLY
// =====================================================================
(function testD_part8RationaleCarriesNoUserContent() {
  const label =
    'ACPT-01 D PART-8: the chosen_rationale names reach_id + posture only and NEVER echoes the fictional sentinel from the side-channel finding body';
  let fixture = null;
  try {
    // The fixture writes PART8_SENTINEL into the CONTRADICT finding body.
    fixture = makeSyntheticRoom({ contradict: true, sentinel: PART8_SENTINEL });

    const decision = engine.decide(
      { signals: ['artifact_filed'], sectionPath: null },
      { quadruple: null, brainAvailable: false, roomDir: fixture.roomDir }
    );
    const rationale = (decision.decision_trace && decision.decision_trace.chosen_rationale) || '';

    // Positive: the rationale DOES name the generic reach_id + posture.
    assert.ok(
      rationale.indexOf('contradiction') !== -1 && rationale.indexOf('pull_back') !== -1,
      label + ': the rationale must name the generic reach_id + posture (the audit surface)'
    );
    // The Part-8 fence: the user-content sentinel must NOT ride the rationale.
    assert.equal(
      rationale.indexOf(PART8_SENTINEL),
      -1,
      label + ': the rationale must NOT contain the fictional sentinel (Part 8: no user content rides the trace)'
    );
    // Defense-in-depth: stringify the WHOLE decision and assert the sentinel is
    // absent anywhere in the engine output (not just the rationale string).
    const whole = JSON.stringify(decision);
    assert.equal(
      whole.indexOf(PART8_SENTINEL),
      -1,
      label + ': the whole decision struct must NOT contain the sentinel anywhere (Part 8 hard fence)'
    );
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    if (fixture) fixture.cleanup();
  }
})();

// =====================================================================
// GUARD: the suite never relied on the stub (T-146-02 repudiation guard)
// =====================================================================
(function testGuard_noStubInEnv() {
  const label =
    'ACPT-01 GUARD: MOS_NAV_TEST_FIRE_SKILL is unset for the whole suite (every positive proves the SENSOR, not the stub)';
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
  'ACPT-01 engine fires (Phase 146-01 acceptance): ' +
  passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
