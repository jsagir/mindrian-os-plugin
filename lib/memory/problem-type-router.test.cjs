#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 91-07 -- Problem-Type Router fixture tests
 * =================================================
 * Exercises lib/core/problem-type-router.cjs. The router parses BRAIN.md
 * problemtype_classification + wicked_indicators section bodies and
 * returns canonical 4-type routing recommendations (UDP / IDP / WDP /
 * unknown) with wicked escalation per Canon Appendix E rule R4.
 *
 * Canon Part 2 Appendix E (Team Composition R4): wicked problem
 * (8-10 wickedness score) escalates to soft-systems family.
 *
 * Canon Part 3 (10-verb closed vocabulary): every recommended skill
 * maps to one of the canonical verbs (Run Methodology / Reformulate /
 * Spawn Sub-Agent / Navigate Graph / Devil's Advocate / Scenario Plan /
 * Synthesize / Bank Opportunity / Defer / Free-Text).
 *
 * Canon Part 8 (Graph Boundary): ProblemType is a generic enum, not
 * user content. The router never reads BRAIN.md directly; it only
 * consumes already-parsed section bodies from readQuadruple.
 *
 * Test map:
 *   Task 1 (Tests 1-18): parser + 4-type routing + wicked escalation
 *     1.  parseProblemTypeSection happy-path UDP + confidence 0.85
 *     2.  parseProblemTypeSection (no signal) -> null
 *     3.  parseProblemTypeSection type-only (no confidence) -> tolerant
 *     4.  parseProblemTypeSection out-of-range confidence -> null
 *     5.  parseProblemTypeSection unknown type 'FOO' -> {type: unknown}
 *     6.  routeByProblemType('UDP', 0.85) -> exploration skills
 *     7.  routeByProblemType('IDP', 0.8) -> definition-seeking skills
 *     8.  routeByProblemType('WDP', 0.9) -> execution skills
 *     9.  routeByProblemType('unknown', null) -> empty + fallback reason
 *     10. routeByProblemType(null, null) -> same as unknown
 *     11. detectWickedEscalation(null) -> false
 *     12. detectWickedEscalation(score 7) -> false
 *     13. detectWickedEscalation(score 8) -> true
 *     14. detectWickedEscalation(score 10) -> true
 *     15. applyWickedOverride sets wicked_override:true + Appendix E R4
 *     16. Canon Part 3 10-verb traceability across all routing tables
 *     17. Low-confidence routing reason annotation
 *     18. Suppress_skills array invariant + null-safe shape
 *
 *   Task 2 (Tests 19-21): navigation-engine.cjs decide() integration
 *     19. decide() with IDP fixture surfaces routing in chosen_rationale
 *     20. decide() with wicked_score 9 surfaces wicked escalation
 *     21. decide() with tier_0 (absent BRAIN.md) -- no regression
 *
 *   Task 3 (Tests 22-24): brain-client.isAvailable() upgrade
 *     22. Brain reachable + IDP fresh -> mode_a
 *     23. Brain unreachable + brain_offline -> mode_b; routing still works
 *     24. brain-client require failure -> brainAvailable=false; no throw
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..', '..');
const ROUTER_PATH = path.join(REPO, 'lib/core/problem-type-router.cjs');
const ENGINE_PATH = path.join(REPO, 'lib/core/navigation-engine.cjs');
const SHARED_PATH = path.join(REPO, 'lib/core/navigation-engine-shared.cjs');
const CLASSIFIER_PATH = path.join(REPO, 'scripts/intent-classifier.cjs');

function requireRouter() {
  return require(ROUTER_PATH);
}

function requireEngine() {
  return require(ENGINE_PATH);
}

function requireShared() {
  return require(SHARED_PATH);
}

// ---------- Test scaffolding ----------

let passed = 0;
let failed = 0;
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

// ---------- Section-body fixture helpers ----------

function makeProblemTypeSection(bodyText) {
  if (bodyText === null) return null;
  return { body: bodyText, tokens_estimate: Math.max(1, Math.ceil(bodyText.length / 4)) };
}

function makeWickedSection(score) {
  if (score === null) return null;
  return {
    body: '- wicked_score: ' + score + '\n- rationale: fixture',
    tokens_estimate: 8,
  };
}

// =========================================================
// Task 1 -- parser + routing tables (Tests 1..18)
// =========================================================

run('Test 1: parseProblemTypeSection happy-path UDP + confidence 0.85', () => {
  const { parseProblemTypeSection } = requireRouter();
  const section = makeProblemTypeSection('- type: UDP\n- confidence: 0.85\n- rationale: fixture');
  const out = parseProblemTypeSection(section);
  assert.equal(out.type, 'UDP');
  assert.equal(Math.abs(out.confidence - 0.85) < 1e-9, true);
});

run('Test 2: parseProblemTypeSection (no signal) -> null', () => {
  const { parseProblemTypeSection } = requireRouter();
  const section = makeProblemTypeSection('(no signal)');
  const out = parseProblemTypeSection(section);
  assert.equal(out, null);
});

run('Test 3: parseProblemTypeSection type-only -> tolerant {type, confidence:null}', () => {
  const { parseProblemTypeSection } = requireRouter();
  const section = makeProblemTypeSection('- type: UDP');
  const out = parseProblemTypeSection(section);
  assert.equal(out.type, 'UDP');
  assert.equal(out.confidence, null);
});

run('Test 4: parseProblemTypeSection out-of-range confidence rejected', () => {
  const { parseProblemTypeSection } = requireRouter();
  // > 1 rejected
  const section1 = makeProblemTypeSection('- type: UDP\n- confidence: 1.5');
  const out1 = parseProblemTypeSection(section1);
  assert.equal(out1.type, 'UDP');
  assert.equal(out1.confidence, null,
    'confidence > 1 must be null; got ' + out1.confidence);
  // 0.0 and 1.0 edge cases ARE permitted.
  const section2 = makeProblemTypeSection('- type: WDP\n- confidence: 1.0');
  const out2 = parseProblemTypeSection(section2);
  assert.equal(out2.confidence, 1.0);
  const section3 = makeProblemTypeSection('- type: WDP\n- confidence: 0.0');
  const out3 = parseProblemTypeSection(section3);
  assert.equal(out3.confidence, 0.0);
});

run('Test 5: parseProblemTypeSection unknown type FOO -> {type: unknown}', () => {
  const { parseProblemTypeSection } = requireRouter();
  const section = makeProblemTypeSection('- type: FOO\n- confidence: 0.5');
  const out = parseProblemTypeSection(section);
  assert.equal(out.type, 'unknown');
  assert.equal(out.confidence, 0.5);
});

run('Test 6: routeByProblemType(UDP, 0.85) -> exploration skills', () => {
  const { routeByProblemType } = requireRouter();
  const out = routeByProblemType('UDP', 0.85);
  assert.deepEqual(out.recommended_skills, [
    'explore-domains',
    'beautiful-question',
    'whitespace',
    'find-analogies',
    'find-connections',
  ]);
  assert.deepEqual(out.suppressed_skills, []);
  assert.equal(/Undefined/i.test(out.reason), true);
  assert.equal(/exploration/i.test(out.reason), true);
  assert.equal(out.wicked_override, false);
});

run('Test 7: routeByProblemType(IDP, 0.8) -> definition-seeking skills', () => {
  const { routeByProblemType } = requireRouter();
  const out = routeByProblemType('IDP', 0.8);
  assert.deepEqual(out.recommended_skills, [
    'beautiful-question',
    'structure-argument',
    'mullins',
    'lean-canvas',
    'map-unknowns',
  ]);
  assert.equal(/Ill-Defined/i.test(out.reason), true);
  assert.equal(/definition/i.test(out.reason), true);
});

run('Test 8: routeByProblemType(WDP, 0.9) -> execution skills', () => {
  const { routeByProblemType } = requireRouter();
  const out = routeByProblemType('WDP', 0.9);
  assert.deepEqual(out.recommended_skills, [
    'grade',
    'deep-grade',
    'score-innovation',
    'build-thesis',
    'challenge-assumptions',
  ]);
  assert.equal(/Well-Defined/i.test(out.reason), true);
  assert.equal(/execution/i.test(out.reason), true);
});

run('Test 9: routeByProblemType(unknown, null) -> empty + fallback reason', () => {
  const { routeByProblemType } = requireRouter();
  const out = routeByProblemType('unknown', null);
  assert.deepEqual(out.recommended_skills, []);
  assert.deepEqual(out.suppressed_skills, []);
  assert.equal(/unavailable|fallback/i.test(out.reason), true);
});

run('Test 10: routeByProblemType(null, null) -> same as unknown case', () => {
  const { routeByProblemType } = requireRouter();
  const out = routeByProblemType(null, null);
  assert.deepEqual(out.recommended_skills, []);
  assert.deepEqual(out.suppressed_skills, []);
  assert.equal(/unavailable|fallback/i.test(out.reason), true);
});

run('Test 11: detectWickedEscalation(null) -> false', () => {
  const { detectWickedEscalation } = requireRouter();
  assert.equal(detectWickedEscalation(null), false);
});

run('Test 12: detectWickedEscalation(score 7) -> false', () => {
  const { detectWickedEscalation } = requireRouter();
  const section = makeWickedSection(7);
  assert.equal(detectWickedEscalation(section), false);
});

run('Test 13: detectWickedEscalation(score 8) -> true', () => {
  const { detectWickedEscalation } = requireRouter();
  const section = makeWickedSection(8);
  assert.equal(detectWickedEscalation(section), true);
});

run('Test 14: detectWickedEscalation(score 10) -> true', () => {
  const { detectWickedEscalation } = requireRouter();
  const section = makeWickedSection(10);
  assert.equal(detectWickedEscalation(section), true);
});

run('Test 15: applyWickedOverride sets wicked_override:true + Canon Appendix E R4', () => {
  const { routeByProblemType, applyWickedOverride } = requireRouter();
  const base = routeByProblemType('IDP', 0.8);
  const out = applyWickedOverride(base);
  assert.equal(out.wicked_override, true);
  // Wicked override skills per Canon Appendix E R4 family.
  assert.deepEqual(out.recommended_skills, [
    'challenge-assumptions',
    'find-bottlenecks',
    'scenario-plan',
    'explore-futures',
  ]);
  assert.equal(/Wicked|Appendix E R4/i.test(out.reason), true);
  assert.equal(/Canon Appendix E R4/.test(out.reason), true,
    'Wicked override reason must cite Canon Appendix E R4 explicitly; got: ' + out.reason);
});

run('Test 16: Canon Part 3 10-verb traceability across routing tables', () => {
  const { TYPE_VERB_MAPPING, WICKED_VERB_MAPPING } = requireRouter();
  const { CANONICAL_VERBS } = requireShared();
  const canonSet = new Set(CANONICAL_VERBS);
  // Every type table maps each skill to a canonical verb.
  for (const typeKey of Object.keys(TYPE_VERB_MAPPING)) {
    const skills = TYPE_VERB_MAPPING[typeKey];
    for (const entry of skills) {
      assert.equal(canonSet.has(entry.verb), true,
        typeKey + ' skill ' + entry.skill + ' verb ' + entry.verb + ' not in CANONICAL_VERBS');
    }
  }
  // Wicked table also maps to canonical verbs.
  for (const entry of WICKED_VERB_MAPPING) {
    assert.equal(canonSet.has(entry.verb), true,
      'Wicked skill ' + entry.skill + ' verb ' + entry.verb + ' not in CANONICAL_VERBS');
  }
});

run('Test 17: Low-confidence (< 0.5) routing reason annotation', () => {
  const { routeByProblemType } = requireRouter();
  // High-conf reason has no low-conf marker.
  const high = routeByProblemType('UDP', 0.85);
  assert.equal(/low confidence/i.test(high.reason), false);
  // Low-conf reason carries the marker.
  const low = routeByProblemType('UDP', 0.2);
  assert.equal(/low confidence/i.test(low.reason), true);
  // Skills still surface (caller decides whether to weight down).
  assert.equal(low.recommended_skills.length > 0, true);
});

run('Test 18: routeByProblemType output shape invariants (suppressed_skills array; wicked_override bool)', () => {
  const { routeByProblemType, applyWickedOverride } = requireRouter();
  for (const t of ['UDP', 'IDP', 'WDP', 'unknown', null]) {
    const out = routeByProblemType(t, 0.5);
    assert.equal(Array.isArray(out.recommended_skills), true);
    assert.equal(Array.isArray(out.suppressed_skills), true);
    assert.equal(typeof out.reason, 'string');
    assert.equal(typeof out.wicked_override, 'boolean');
    assert.equal(out.wicked_override, false,
      'baseline routing must not set wicked_override');
    const wicked = applyWickedOverride(out);
    assert.equal(Array.isArray(wicked.recommended_skills), true);
    assert.equal(wicked.wicked_override, true);
  }
});

// =========================================================
// Task 2 -- decide() integration (Tests 19..21)
// =========================================================

function makeBrainWithProblemType(typeBody, wickedScore) {
  return {
    exists: true,
    section: 'market-analysis',
    brain_generated_at: '2026-04-27T12:00:00Z',
    brain_graph_version: 1,
    governing_thought_hash: 'sha256:fixture',
    staleness: 'fresh',
    stale_reason: null,
    author: 'brain',
    confidence_baseline: 0.5,
    parse_failed: false,
    sections: {
      pattern_matches: null,
      framework_chain_predictions: null,
      cross_domain_analogies: null,
      wicked_indicators: wickedScore !== null ? makeWickedSection(wickedScore) : null,
      unfilled_opportunity_matches: null,
      assessment_thinking_chain_position: null,
      problemtype_classification: typeBody !== null ? makeProblemTypeSection(typeBody) : null,
      flagged_contradictions_xroom: null,
      hsi_signals: null,
    },
    flagged_weaknesses: [],
  };
}

function makeQuadruple(brain) {
  return {
    room: { exists: true, identity_text: 'fixture', references: [] },
    state: { exists: true, artifact_count: 1, completeness_score: 0.5 },
    reasoning: {
      exists: true,
      governing_thought: 'fixture thought',
      reasoning_health_score: 0.7,
      is_stale: false,
      arguments: [],
    },
    brain: brain,
  };
}

run('Test 19: decide() with IDP classification surfaces routing in chosen_rationale', () => {
  const { decide } = requireEngine();
  const brain = makeBrainWithProblemType('- type: IDP\n- confidence: 0.8', null);
  const out = decide(
    { sectionPath: '/tmp/fixture', sessionId: 's1' },
    {
      quadruple: makeQuadruple(brain),
      brainAvailable: true,
      userPersona: null,
      intentSignal: null,
    }
  );
  // chosen_rationale must reference IDP and definition-seeking routing.
  const rationale = out.decision_trace.chosen_rationale || '';
  assert.equal(/IDP/i.test(rationale), true,
    'chosen_rationale must reference IDP; got: ' + rationale);
  assert.equal(/definition|Ill-Defined/i.test(rationale), true,
    'chosen_rationale must reference definition-seeking; got: ' + rationale);
});

run('Test 20: decide() with wicked_score 9 surfaces wicked escalation in rationale', () => {
  const { decide } = requireEngine();
  // Wicked override applies regardless of base type. Provide IDP + wicked_score 9.
  const brain = makeBrainWithProblemType('- type: IDP\n- confidence: 0.8', 9);
  const out = decide(
    { sectionPath: '/tmp/fixture', sessionId: 's1' },
    {
      quadruple: makeQuadruple(brain),
      brainAvailable: true,
      userPersona: null,
      intentSignal: null,
    }
  );
  const rationale = out.decision_trace.chosen_rationale || '';
  assert.equal(/wicked|Appendix E R4/i.test(rationale), true,
    'wicked rationale must reference wicked escalation; got: ' + rationale);
});

run('Test 21: decide() with tier_0 (absent BRAIN.md) -- no regression', () => {
  const { decide } = requireEngine();
  // No brain -> tier_0; problem-type routing contributes nothing.
  const quadruple = {
    room: { exists: true, identity_text: 'fx', references: [] },
    state: { exists: true, artifact_count: 0, completeness_score: 0 },
    reasoning: { exists: false, governing_thought: null, reasoning_health_score: 0, is_stale: true, arguments: [] },
    brain: null,
  };
  const out = decide(
    { sectionPath: '/tmp/fixture', sessionId: 's1' },
    {
      quadruple: quadruple,
      brainAvailable: false,
      userPersona: null,
      intentSignal: null,
    }
  );
  assert.equal(out.decision_trace.brain_md_tier_mode, 'tier_0');
  // Engine never throws and never claims a problem-type rationale when brain
  // is absent.
  const rationale = out.decision_trace.chosen_rationale || '';
  assert.equal(/IDP|UDP|WDP/i.test(rationale), false,
    'tier_0 rationale must NOT cite problem-type when brain is absent; got: ' + rationale);
});

// =========================================================
// Task 3 -- brain-client.isAvailable() upgrade (Tests 22..24)
// =========================================================

// Tests 22-24 spawn the classifier in a child process with mocked
// brain-client modules. We use require-cache injection in a tiny harness
// script to simulate isAvailable returning true / false / module-missing.

function runClassifierWithBrainMock(opts) {
  // opts.brainAvailableValue: true | false | 'throw' | 'absent' (don't replace)
  // opts.brainMd: optional BRAIN.md content to plant in the section
  // opts.userMd: optional USER.md content
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p91-07-mock-'));
  try {
    const roomsRoot = path.join(tmpRoot, 'MindrianRooms');
    const roomDir = path.join(roomsRoot, 'fixture-room');
    const sectionDir = path.join(roomDir, 'market-analysis');
    fs.mkdirSync(sectionDir, { recursive: true });
    fs.mkdirSync(path.join(roomsRoot, '.rooms'), { recursive: true });
    fs.writeFileSync(
      path.join(roomsRoot, '.rooms', 'registry.json'),
      JSON.stringify({ active: 'fixture-room', rooms: { 'fixture-room': {} } }, null, 2)
    );
    fs.writeFileSync(
      path.join(roomDir, 'STATE.md'),
      '---\nproject: fixture\n---\n\n# STATE\n'
    );
    fs.writeFileSync(
      path.join(roomDir, 'ROOM.md'),
      '---\nname: fixture-room\n---\n\n# Fixture\n'
    );
    fs.writeFileSync(
      path.join(sectionDir, 'ROOM.md'),
      '---\nname: market-analysis\n---\n\n# Market Analysis\n'
    );
    fs.writeFileSync(
      path.join(sectionDir, 'MINTO.md'),
      '---\nfm_version: 88\ngoverning_thought: Customers will pay for X\nlast_generated_at: 2026-04-27T12:00:00Z\nlast_artifact_write_seen_at: 2026-04-27T11:00:00Z\nreasoning_health_score: 0.8\nflagged_weaknesses: []\ndecision_log: []\n---\n\n# MINTO\n'
    );
    if (opts.brainMd !== undefined) {
      fs.writeFileSync(path.join(sectionDir, 'BRAIN.md'), opts.brainMd);
    }
    // Active section pointer
    fs.mkdirSync(path.join(roomDir, '.mindrian'), { recursive: true });
    fs.writeFileSync(
      path.join(roomDir, '.mindrian', 'active-section.json'),
      JSON.stringify({ section: 'market-analysis' })
    );

    // Build a tiny mock harness that replaces brain-client in require.cache
    // before invoking the classifier.
    const harness = `'use strict';
const Module = require('module');
const path = require('path');
const realResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  if (typeof request === 'string' && request.indexOf('brain-client.cjs') !== -1) {
    if (${JSON.stringify(opts.brainAvailableValue)} === 'absent') {
      // Trigger MODULE_NOT_FOUND
      const e = new Error("Cannot find module '" + request + "'");
      e.code = 'MODULE_NOT_FOUND';
      throw e;
    }
  }
  return realResolve.call(this, request, parent, isMain, options);
};
// Pre-populate require.cache for brain-client with a mock that responds
// according to the value flag.
const realBrainPath = ${JSON.stringify(path.join(REPO, 'lib/core/brain-client.cjs'))};
if (${JSON.stringify(opts.brainAvailableValue)} === 'throw') {
  require.cache[realBrainPath] = {
    id: realBrainPath, filename: realBrainPath, loaded: true,
    exports: { isAvailable: function() { throw new Error('mock-throw'); } },
  };
} else if (${JSON.stringify(opts.brainAvailableValue)} === true) {
  require.cache[realBrainPath] = {
    id: realBrainPath, filename: realBrainPath, loaded: true,
    exports: { isAvailable: function() { return true; }, schema: function() { return {}; } },
  };
} else if (${JSON.stringify(opts.brainAvailableValue)} === false) {
  require.cache[realBrainPath] = {
    id: realBrainPath, filename: realBrainPath, loaded: true,
    exports: { isAvailable: function() { return false; } },
  };
}
// Now run the classifier. It reads stdin -- we feed via process.stdin manually.
process.env.MINDRIAN_ROOMS_ROOT = ${JSON.stringify(roomsRoot)};
process.env.CLAUDE_SESSION_ID = 'mock-session-22';
require(${JSON.stringify(CLASSIFIER_PATH)});
`;
    const harnessPath = path.join(tmpRoot, 'harness.cjs');
    fs.writeFileSync(harnessPath, harness);

    const res = spawnSync(process.execPath, [harnessPath], {
      input: 'tell me about market sizing',
      encoding: 'utf8',
      timeout: 10000,
      env: Object.assign({}, process.env, {
        MINDRIAN_ROOMS_ROOT: roomsRoot,
        CLAUDE_SESSION_ID: 'mock-session-22',
        MINDRIAN_COPILOT_INJECT_FINDINGS: '0',
      }),
    });
    return {
      stdout: res.stdout || '',
      stderr: res.stderr || '',
      status: res.status,
      tmpRoot: tmpRoot,
      roomDir: roomDir,
      sectionDir: sectionDir,
    };
  } finally {
    // Best-effort cleanup; tests inspect the trace inline before this fires.
  }
}

run('Test 22: Brain reachable (isAvailable -> true) + fresh BRAIN.md IDP -> mode_a', () => {
  // BRAIN.md fixture for IDP at confidence 0.8.
  const brainMd =
    '---\n' +
    'fm_version: 90\n' +
    'brain_generated_at: 2026-04-27T11:00:00Z\n' +
    'brain_graph_version: 1\n' +
    'governing_thought_hash: sha256:fixture\n' +
    'staleness: fresh\n' +
    'stale_reason: null\n' +
    'author: brain\n' +
    'confidence_baseline: 0.5\n' +
    'flagged_weaknesses: []\n' +
    '---\n\n' +
    '# BRAIN.md\n\n' +
    '## ProblemType Classification\n\n' +
    '- type: IDP\n' +
    '- confidence: 0.8\n' +
    '- rationale: fixture\n';
  const result = runClassifierWithBrainMock({
    brainAvailableValue: true,
    brainMd: brainMd,
  });
  // The classifier should have written a decision-trace JSON file.
  const tracePath = path.join(result.roomDir, '.mindrian', 'decision-traces', 'mock-session-22.json');
  assert.equal(fs.existsSync(tracePath), true,
    'decision-trace must exist; stderr: ' + result.stderr);
  const data = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
  assert.equal(Array.isArray(data.traces), true);
  assert.equal(data.traces.length >= 1, true);
  const last = data.traces[data.traces.length - 1];
  // Brain reachable + fresh BRAIN.md -> mode_a.
  assert.equal(last.brain_md_tier_mode, 'mode_a',
    'expected mode_a; got ' + last.brain_md_tier_mode + '; stderr: ' + result.stderr);
});

run('Test 23: Brain unreachable (isAvailable -> false) + brain_offline -> mode_b; routing still works locally', () => {
  // BRAIN.md fixture for IDP, marked stale with brain_offline reason.
  const brainMd =
    '---\n' +
    'fm_version: 90\n' +
    'brain_generated_at: 2026-04-27T11:00:00Z\n' +
    'brain_graph_version: 1\n' +
    'governing_thought_hash: sha256:fixture\n' +
    'staleness: stale\n' +
    'stale_reason: brain_offline\n' +
    'author: brain\n' +
    'confidence_baseline: 0.5\n' +
    'flagged_weaknesses: []\n' +
    '---\n\n' +
    '# BRAIN.md\n\n' +
    '## ProblemType Classification\n\n' +
    '- type: IDP\n' +
    '- confidence: 0.8\n';
  const result = runClassifierWithBrainMock({
    brainAvailableValue: false,
    brainMd: brainMd,
  });
  const tracePath = path.join(result.roomDir, '.mindrian', 'decision-traces', 'mock-session-22.json');
  assert.equal(fs.existsSync(tracePath), true,
    'decision-trace must exist; stderr: ' + result.stderr);
  const data = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
  const last = data.traces[data.traces.length - 1];
  // Brain unreachable + brain_offline -> mode_b per Phase 90 contract.
  assert.equal(last.brain_md_tier_mode, 'mode_b',
    'expected mode_b; got ' + last.brain_md_tier_mode + '; stderr: ' + result.stderr);
  // RECOMMENDED never rendered in mode_b.
  assert.equal(last.brain_md_recommended_marker_rendered, false);
  // Local problem-type routing still contributes (rationale should mention IDP).
  const rationale = last.chosen_rationale || '';
  assert.equal(/IDP/i.test(rationale), true,
    'mode_b should still surface local IDP routing; got: ' + rationale);
});

run('Test 24: brain-client require failure -> brainAvailable=false; no throw', () => {
  // brainAvailableValue: 'throw' will inject a module that throws on isAvailable.
  // The intent-classifier must catch and default to brainAvailable=false.
  const brainMd =
    '---\n' +
    'fm_version: 90\n' +
    'brain_generated_at: 2026-04-27T11:00:00Z\n' +
    'brain_graph_version: 1\n' +
    'governing_thought_hash: sha256:fixture\n' +
    'staleness: stale\n' +
    'stale_reason: brain_offline\n' +
    'author: brain\n' +
    'confidence_baseline: 0.5\n' +
    'flagged_weaknesses: []\n' +
    '---\n\n' +
    '# BRAIN.md\n\n' +
    '## ProblemType Classification\n\n' +
    '- type: WDP\n' +
    '- confidence: 0.7\n';
  const result = runClassifierWithBrainMock({
    brainAvailableValue: 'throw',
    brainMd: brainMd,
  });
  // Classifier must NOT crash; exit 0 (advisory).
  assert.equal(result.status, 0,
    'classifier must exit 0 even when brain-client throws; got ' + result.status + '; stderr: ' + result.stderr);
  const tracePath = path.join(result.roomDir, '.mindrian', 'decision-traces', 'mock-session-22.json');
  assert.equal(fs.existsSync(tracePath), true);
  const data = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
  const last = data.traces[data.traces.length - 1];
  // brainAvailable defaults false -> mode_b (BRAIN.md is brain_offline) or tier_0.
  assert.equal(last.brain_md_tier_mode === 'mode_b' || last.brain_md_tier_mode === 'tier_0', true,
    'expected mode_b/tier_0 when isAvailable throws; got ' + last.brain_md_tier_mode);
});

// =========================================================
// Suite tail
// =========================================================

process.stdout.write(
  '\nProblem-Type Router tests: ' + passed + '/' + (passed + failed) + ' passed\n'
);
process.exit(failed === 0 ? 0 : 1);
