'use strict';
/*
 * Phase 144-01 -- decide() sensor-fire acceptance suite (NAV-01).
 *
 * The ONE genuine BUILD of Phase 144: a turn that fires a Phase 143 sensor
 * reach produces a non-null decision.fire_skill carrying a CANONICAL VERB, so
 * the router (READ-ONLY for 144) flips routing_source legacy -> engine via its
 * Precedence Rule 1 (validateVerb===true). This suite proves the engine side of
 * that flip:
 *
 *   - a first_material turn -> fire_skill 'Run Methodology' EVEN in tier_0
 *   - an artifact_filed CONTRADICT turn -> fire_skill "Devil's Advocate"
 *   - wicked >= 8 + a sensor reach -> the wicked soft-systems return wins
 *   - chosen_rationale on a sensor-driven turn names reach_id + posture ONLY
 *     (Part 8: never the sensor's internal detection string nor user text)
 *
 * Plus the Task-2 LOCAL-trace shape gate:
 *   - trace.context_assembly { user_summary, facts, decision_grounding }
 *   - trace._meta.latencies_ms { dispatchSensors_ms, decide_total_ms }
 *
 * The fired fire_skill MUST be one of the closed 10 CANONICAL_VERBS so the
 * router validates it. This suite asserts against the canonical verbs directly,
 * mirroring router test Test 9.
 *
 * House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const engine = require(path.join(__dirname, '..', 'lib', 'core', 'navigation-engine.cjs'));
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

// Build a throwaway roomDir carrying a last-cascade.json with a CONTRADICT
// newFinding (the SENS-06 side-channel contract). Returns the absolute roomDir.
function makeContradictRoom() {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-144-'));
  const mdir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(mdir, { recursive: true });
  const payload = {
    proactive_intelligence: {
      newFindings: [
        { type: 'CONTRADICT', confidence: 0.9 },
      ],
    },
  };
  fs.writeFileSync(path.join(mdir, 'last-cascade.json'), JSON.stringify(payload), 'utf8');
  return roomDir;
}

// A minimal context that drives tier_0 (no quadruple, brain absent). The sensor
// branch must fire REGARDLESS of tier, so tier_0 is the strictest proof.
function tier0Context(extra) {
  return Object.assign({
    quadruple: null,
    brainAvailable: false,
  }, extra || {});
}

// ---------- Test 1: first_material -> 'Run Methodology' in tier_0 ----------
(function test_firstMaterialFiresInTier0() {
  const label = "Test 1: first_material sensor -> fire_skill 'Run Methodology' in tier_0";
  try {
    const turn = { signals: ['first_material'], sectionPath: null };
    const context = tier0Context({
      problem_type: 'innovation',
      complexity: 'complex',
      stage: 'discovery',
    });
    const d = engine.decide(turn, context);
    assert.equal(d.decision_trace.brain_md_tier_mode, 'tier_0',
      label + ': must be tier_0 (no quadruple)');
    assert.equal(d.fire_skill, 'Run Methodology',
      label + ': context_block reach -> Run Methodology canonical verb');
    assert.ok(CANONICAL_VERBS.indexOf(d.fire_skill) !== -1,
      label + ': fire_skill must be a canonical verb (router validates against the closed 10)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------- Test 2: artifact_filed CONTRADICT -> "Devil's Advocate" ----------
(function test_artifactFiledContradiction() {
  const label = 'Test 2: artifact_filed CONTRADICT sensor -> fire_skill "Devil\'s Advocate"';
  let roomDir = null;
  try {
    roomDir = makeContradictRoom();
    const turn = { signals: ['artifact_filed'], sectionPath: null };
    const context = tier0Context({ roomDir: roomDir });
    const d = engine.decide(turn, context);
    assert.equal(d.fire_skill, "Devil's Advocate",
      label + ': contradiction reach -> Devil\'s Advocate canonical verb');
    assert.ok(CANONICAL_VERBS.indexOf(d.fire_skill) !== -1,
      label + ': fire_skill must be a canonical verb');
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    if (roomDir) { try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) {} }
  }
})();

// ---------- Test 3: wicked >= 8 + a sensor reach -> soft-systems wins ----------
(function test_wickedWinsTieBreak() {
  const label = 'Test 3: wicked_score >= 8 + a sensor reach -> wicked soft-systems return wins';
  try {
    const quadruple = {
      room: { exists: true },
      state: { artifact_count: 3 },
      reasoning: { exists: true, reasoning_health_score: 0.6, governing_thought: 'gt', is_stale: false },
      brain: {
        author: 'brain',
        staleness: 'fresh',
        brain_graph_version: 1,
        sections: {
          wicked_indicators: { body: 'wicked_score: 9' },
          pattern_matches: { body: '- Run Methodology (confidence: 0.85, source: SWOT)' },
        },
      },
    };
    // A first_material sensor reach is ALSO present; wicked must still win.
    const turn = { signals: ['first_material'], sectionPath: null };
    const context = {
      quadruple: quadruple,
      brainAvailable: true,
      problem_type: 'innovation',
    };
    const d = engine.decide(turn, context);
    assert.equal(d.fire_skill, 'soft-systems',
      label + ': wicked escalation outranks the sensor reach in the precedence chain');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------- Test 4: rationale names reach_id + posture only (Part 8) ----------
(function test_rationalePart8Clean() {
  const label = 'Test 4: sensor-driven chosen_rationale names reach_id + posture only (Part 8 clean)';
  let roomDir = null;
  try {
    roomDir = makeContradictRoom();
    const turn = { signals: ['artifact_filed'], sectionPath: null, userText: 'SECRET-USER-PROSE-12345' };
    const context = tier0Context({ roomDir: roomDir });
    const d = engine.decide(turn, context);
    const rationale = d.decision_trace.chosen_rationale || '';
    // Must name the reach_id + posture.
    assert.ok(rationale.indexOf('contradiction') !== -1,
      label + ': rationale must name the reach_id');
    assert.ok(rationale.indexOf('pull_back') !== -1,
      label + ': rationale must name the posture');
    // Must NOT carry user text or the sensor evidence body / dispatch string.
    assert.ok(rationale.indexOf('SECRET-USER-PROSE-12345') === -1,
      label + ': rationale must NOT carry user text');
    assert.ok(rationale.indexOf('cascade-cross-relationship-surface') === -1,
      label + ': rationale must NOT carry the sensor dispatch handle');
    // Forbidden Part-8 egress tokens must never appear in the rationale string.
    const forbidden = ['projectText', 'hashText', 'sha256', 'createHash'];
    for (const tok of forbidden) {
      assert.ok(rationale.indexOf(tok) === -1,
        label + ': rationale must not carry forbidden token ' + tok);
    }
    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    if (roomDir) { try { fs.rmSync(roomDir, { recursive: true, force: true }); } catch (_e) {} }
  }
})();

// ---------- Test 5: trace.context_assembly LOCAL shape (Task 2) ----------
(function test_contextAssemblyShape() {
  const label = 'Test 5: trace.context_assembly { user_summary, facts, decision_grounding } on a sensor turn';
  try {
    const turn = { signals: ['first_material'], sectionPath: null };
    const context = tier0Context({ problem_type: 'innovation' });
    const d = engine.decide(turn, context);
    const ca = d.decision_trace.context_assembly;
    assert.ok(ca && typeof ca === 'object', label + ': context_assembly must be an object');
    assert.ok(Array.isArray(ca.user_summary), label + ': user_summary must be an array');
    assert.ok(Array.isArray(ca.facts), label + ': facts must be an array');
    assert.ok('decision_grounding' in ca, label + ': decision_grounding key must be present');
    // The fired reach_id must surface as a fact (scalar) on a sensor-driven turn.
    const factIds = ca.facts.map(function (f) { return f && f.reach_id; });
    assert.ok(factIds.indexOf('context_block') !== -1,
      label + ': the fired reach_id must appear as a fact scalar');
    // decision_grounding must name the reach_id that justified fire_skill.
    assert.equal(ca.decision_grounding, 'context_block',
      label + ': decision_grounding must be the reach_id that drove fire_skill');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------- Test 6: trace._meta.latencies_ms LOCAL telemetry (Task 2) ----------
(function test_latencyTelemetry() {
  const label = 'Test 6: trace._meta.latencies_ms { dispatchSensors_ms, decide_total_ms } LOCAL telemetry';
  try {
    const turn = { signals: ['first_material'], sectionPath: null };
    const d = engine.decide(turn, tier0Context({ problem_type: 'innovation' }));
    const meta = d.decision_trace._meta;
    assert.ok(meta && typeof meta === 'object', label + ': _meta must be an object');
    const lat = meta.latencies_ms;
    assert.ok(lat && typeof lat === 'object', label + ': latencies_ms must be an object');
    assert.equal(typeof lat.dispatchSensors_ms, 'number', label + ': dispatchSensors_ms must be a number');
    assert.equal(typeof lat.decide_total_ms, 'number', label + ': decide_total_ms must be a number');
    assert.ok(lat.dispatchSensors_ms >= 0, label + ': dispatchSensors_ms must be >= 0');
    assert.ok(lat.decide_total_ms >= 0, label + ': decide_total_ms must be >= 0');
    ok(label);
  } catch (e) { fail(label, e); }
})();

// ---------- Test 7: no sensor fired -> pre-144 behavior preserved ----------
(function test_noSensorDegradesToLegacy() {
  const label = 'Test 7: a turn that fires no sensor -> fire_skill null in tier_0 (honest legacy negative)';
  try {
    const turn = { signals: [], sectionPath: null };
    const d = engine.decide(turn, tier0Context({}));
    assert.equal(d.fire_skill, null,
      label + ': no sensor reach + tier_0 -> fire_skill stays null (router emits legacy)');
    ok(label);
  } catch (e) { fail(label, e); }
})();

process.stdout.write('\n');
process.stdout.write('decide() sensor-fire acceptance (Phase 144 NAV-01): ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed === 0 ? 0 : 1);
