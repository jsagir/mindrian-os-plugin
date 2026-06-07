'use strict';
/*
 * Phase 144-03 -- NAV-01 acceptance suite (the positive + the honest negative).
 *
 * THE PROOF Phase 144 exists to make: a POPULATED-room turn driven by a REAL
 * fired sensor (NOT the MOS_NAV_TEST_FIRE_SKILL stub) produces
 * routing_source: engine; a COLD room with no sensor signal honestly degrades
 * to routing_source: legacy. This is the long-unmet Phase 94-03 criterion
 * (SEED-008); 144 makes the flip POSSIBLE (Plan 01 wired the engine, Plan 02
 * repaired the fixture), and this suite PROVES it end-to-end.
 *
 * Path chosen (per the plan's second acceptance bullet + the 144-FANOUT
 * hot-path tuple-threading caveat): the decide() -> routeActivation BOUNDARY.
 *
 * Why the boundary, not the classifier hook hot path: the classifier builds the
 * engine `turn` from a LOCAL conversation seed (deriveConversationSeed ->
 * turn.userText), NOT from explicit sensor signals
 * (intent-classifier.cjs:1241-1245). There is no hook-input parameter that
 * threads turn.signals: ['artifact_filed'] into the decide() call from stdin
 * alone, so the only way to drive a REAL sensor through the hot path would be to
 * either set the stub (forbidden -- proves the stub, not the sensor) or rewrite
 * production threading (out of scope for an acceptance harness). The decide() ->
 * routeActivation boundary exercises the EXACT production wiring the classifier
 * uses (intent-classifier.cjs:1385 calls router.routeActivation(out.decision,
 * legacyActivation)) with a turn carrying a REAL sensor signal -- a faithful,
 * stub-free proof of the flip. Plan 144-02's router integration Tests 16/17
 * already cover the classifier-hook plumbing via the stub; this suite covers the
 * REAL-sensor flip the stub cannot.
 *
 * POSITIVE: a real SENS-06 CONTRADICT sensor (the shipped CASC-01 side-channel
 * at <roomDir>/.mindrian/last-cascade.json) fires through decide()'s Plan-01
 * sensor branch -> fire_skill "Devil's Advocate" (a canonical verb) -> fed to
 * routeActivation -> source === 'engine'. No MOS_NAV_TEST_FIRE_SKILL anywhere.
 *
 * NEGATIVE: a cold room (resolvable populated-room context, NO sensor signal,
 * tier_0 brain absent) -> fire_skill null -> routeActivation -> source ===
 * 'legacy'. The honest negative.
 *
 * Structured so Phase 146 ACPT-01 can require it as-is: a single node-runnable
 * file with a clear pass/fail exit code, tmp fixtures cleaned in finally.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const engine = require(path.join(__dirname, '..', 'lib', 'core', 'navigation-engine.cjs'));
const router = require(path.join(__dirname, '..', 'lib', 'core', 'skill-activation-router.cjs'));
const shared = require(path.join(__dirname, '..', 'lib', 'core', 'navigation-engine-shared.cjs'));
const CANONICAL_VERBS = shared.CANONICAL_VERBS;

let passed = 0;
let failed = 0;
function ok(name) { passed += 1; process.stdout.write('  ok ' + name + '\n'); }
function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) process.stdout.write('    ' + (err.message || String(err)) + '\n');
}

// Guard: this suite must NEVER prove the stub. If MOS_NAV_TEST_FIRE_SKILL leaks
// in from the parent env, the engine decision would carry a stubbed fire_skill
// at the classifier layer (not here, since we call decide() directly), but we
// scrub it defensively so the proof is unambiguous: the flip is the sensor's.
delete process.env.MOS_NAV_TEST_FIRE_SKILL;
delete process.env.MOS_NAV_TEST_SUPPRESS_SKILLS;

// Build a populated room whose state makes a REAL sensor fire: write the SENS-06
// CASC-01 side-channel (<roomDir>/.mindrian/last-cascade.json) with a CONTRADICT
// newFinding -- the shipped contract scripts/post-write writes and
// skills/room-proactive/SKILL.md reads. Returns the absolute roomDir.
function makePopulatedContradictRoom() {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nav01-pos-'));
  const mdir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(mdir, { recursive: true });
  const payload = {
    proactive_intelligence: {
      newFindings: [
        // A CONTRADICT finding -> SENS-06 surfaces reach_id 'contradiction'
        // posture 'pull_back' -> reachIdToSkillFamily -> "Devil's Advocate".
        { type: 'CONTRADICT', confidence: 0.9 },
      ],
    },
  };
  fs.writeFileSync(path.join(mdir, 'last-cascade.json'), JSON.stringify(payload), 'utf8');
  return roomDir;
}

// A cold room: resolvable + populated-room context but NO sensor signal and no
// side-channel, brain absent (tier_0). The engine genuinely runs and is silent.
function makeColdRoom() {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nav01-neg-'));
  fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
  return roomDir;
}

// The legacy file-state activation the classifier passes as routeActivation's
// 2nd arg (computeLegacyActivation). A populated room's legacy lane carries
// room-passive; this is what the flip must OVERRIDE on the positive case and
// FALL BACK TO on the negative case.
function legacyActivation() {
  return ['room-passive'];
}

// =====================================================================
// POSITIVE: real fired sensor -> routing_source: engine (NO stub)
// =====================================================================
(function test_populatedRoomRealSensorFlipsToEngine() {
  const label =
    'NAV-01 POSITIVE: a REAL fired SENS-06 sensor (no stub) -> decide() canonical fire_skill -> routeActivation source === engine';
  let roomDir = null;
  try {
    roomDir = makePopulatedContradictRoom();

    // The REAL sensor signal -- threaded the way decide() consumes it (Plan 01).
    // NO MOS_NAV_TEST_FIRE_SKILL: the fire_skill below is produced by the sensor
    // branch reading the on-disk CONTRADICT side-channel, not by an env override.
    const turn = { signals: ['artifact_filed'], sectionPath: null };
    const context = {
      quadruple: null,        // tier_0: no Brain quadruple
      brainAvailable: false,  // Brain absent -- the flip must NOT depend on Brain
      roomDir: roomDir,       // SENS-06 reads <roomDir>/.mindrian/last-cascade.json
    };

    // Step 1: the engine produces a non-null canonical-verb fire_skill BECAUSE a
    // real sensor fired (the contradiction reach), not because of any stub.
    const decision = engine.decide(turn, context);
    assert.equal(
      decision.fire_skill,
      "Devil's Advocate",
      label + ': the REAL CONTRADICT sensor must drive fire_skill to the Devil\'s Advocate canonical verb'
    );
    assert.ok(
      CANONICAL_VERBS.indexOf(decision.fire_skill) !== -1,
      label + ': fire_skill must be one of the closed 10 canonical verbs (the router validates this)'
    );
    // Provenance: the chosen_rationale must name the fired reach_id (proof the
    // flip is sensor-driven, not stub-driven) and stay Part-8 clean.
    const rationale = (decision.decision_trace && decision.decision_trace.chosen_rationale) || '';
    assert.ok(
      rationale.indexOf('contradiction') !== -1,
      label + ': the rationale must name the fired reach_id (sensor-driven provenance)'
    );

    // Step 2: feed the engine decision to the EXACT production router call
    // (intent-classifier.cjs:1385). A canonical-verb fire_skill flips the source.
    const routing = router.routeActivation(decision, legacyActivation());
    assert.equal(
      routing.source,
      'engine',
      label + ': a real-sensor canonical fire_skill must flip routing_source to engine'
    );
    assert.deepEqual(
      routing.activated_skills,
      ["Devil's Advocate"],
      label + ': the engine fire_skill must win over the legacy room-passive activation'
    );
    assert.equal(
      routing.reason,
      'engine_fire_skill_set',
      label + ': the flip reason must be engine_fire_skill_set (Precedence Rule 1)'
    );
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    if (roomDir) { try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) {} }
  }
})();

// =====================================================================
// NEGATIVE: cold room, no sensor -> routing_source: legacy (honest)
// =====================================================================
(function test_coldRoomNoSensorStaysLegacy() {
  const label =
    'NAV-01 NEGATIVE: a cold room with NO sensor signal -> decide() fire_skill null -> routeActivation source === legacy (honest negative)';
  let roomDir = null;
  try {
    roomDir = makeColdRoom();

    // No signal, brain absent, no side-channel -> the engine runs and is silent.
    const turn = { signals: [], sectionPath: null };
    const context = {
      quadruple: null,
      brainAvailable: false,
      roomDir: roomDir,
    };

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
    if (roomDir) { try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) {} }
  }
})();

// =====================================================================
// GUARD: the suite never relied on the stub (T-144-08 repudiation guard)
// =====================================================================
(function test_noStubInEnv() {
  const label =
    'NAV-01 GUARD: MOS_NAV_TEST_FIRE_SKILL is unset for the whole suite (the positive proves the SENSOR, not the stub)';
  try {
    assert.equal(
      process.env.MOS_NAV_TEST_FIRE_SKILL,
      undefined,
      label + ': the stub env override must never be set on the positive path'
    );
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write(
  'NAV-01 populated-room engine fires (Phase 144-03 acceptance): ' +
  passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
