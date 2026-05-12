#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 91-08 -- Framework Chain Composer fixture tests
 * ======================================================
 * Exercises lib/core/framework-chain-composer.cjs. The composer parses
 * BRAIN.md framework_chain_predictions section bodies (FEEDS_INTO edges
 * authored by Phase 90-01 deriveSection) and proposes the next framework
 * to run when the user just completed framework A.
 *
 * Canon Part 2 Engine 1 + Appendix E: framework chains power Act 1 to
 * BONO Orchestration handoffs; FEEDS_INTO is the graph infrastructure.
 *
 * Canon Part 3 Section 6 RECOMMENDED gate: chain proposals respect the
 * gate (Mode A + confidence >= 0.7 -> recommended_eligible:true). The
 * gate result is consumed by offer-presenter.cjs (Plan 91-04).
 *
 * Canon Part 7 Reuse Before Build: FEEDS_INTO edges are existing graph
 * infrastructure. This module CONSUMES them; it does not invent a chain
 * representation.
 *
 * Canon Part 8 Graph Boundary: composer reads only the LOCAL BRAIN.md
 * body via readQuadruple.brain.sections. NEVER queries Brain at engine
 * time. The pre-derivation ran in Phase 90-01 inside the Plan 90-01
 * chokepoint, hours before this code runs.
 *
 * Test map:
 *   Task 1 (Tests 1-15): parser + completion detection + chain proposal
 *     1.  parseFrameworkChainSection 4 FEEDS_INTO lines -> 4 edges
 *     2.  parseFrameworkChainSection (no signal) -> []
 *     3.  parseFrameworkChainSection format-tolerant (FEEDS_INTO + ->)
 *     4.  parseFrameworkChainSection missing confidence -> null edge.confidence
 *     5.  detectCompletedFramework via governing_thought match
 *     6.  detectCompletedFramework mtime fallback
 *     7.  detectCompletedFramework no signal -> null
 *     8.  proposeNextFramework happy path -> {next, confidence, source}
 *     9.  proposeNextFramework no outgoing edge -> null
 *     10. proposeNextFramework confidence gating (<0.5 -> null)
 *     11. proposeNextFramework tie-breaking by confidence desc
 *     12. proposeNextFramework /mos: command mapping
 *     13. proposeNextFramework grounding rule (reason has FEEDS_INTO + Brain + conf)
 *     14. proposeNextFramework RECOMMENDED eligibility flag
 *     15. proposeNextFramework empty edges -> null
 *
 *   Task 2 (Tests 16-18): navigation-engine.cjs decide() integration
 *     16. decide() with chain section + governing_thought -> offer_next_step
 *         non-null + reason contains 'FEEDS_INTO'
 *     17. decide() Mode A confidence 0.85 -> recommended_eligible flag set
 *         in trace; offer-presenter would render RECOMMENDED marker
 *     18. decide() user override path: turn 1 offers /mos:porter-five-forces;
 *         turn 2 userText invokes /mos:lean-canvas -> trace records
 *         REJECTED chain suggestion + offer-history outcome=ignored
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO = path.resolve(__dirname, '..', '..');
const COMPOSER_PATH = path.join(REPO, 'lib/core/framework-chain-composer.cjs');
const ENGINE_PATH = path.join(REPO, 'lib/core/navigation-engine.cjs');

function requireComposer() {
  return require(COMPOSER_PATH);
}

function requireEngine() {
  return require(ENGINE_PATH);
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

function makeChainSection(bodyText) {
  if (bodyText === null) return null;
  return { body: bodyText, tokens_estimate: Math.max(1, Math.ceil(bodyText.length / 4)) };
}

const SAMPLE_4_LINES = [
  '- SWOT Analysis FEEDS_INTO Porter Five Forces (confidence: 0.85, phase: early-market)',
  '- Porter Five Forces FEEDS_INTO Value Chain Analysis (confidence: 0.78, phase: early-market)',
  '- Business Model Canvas FEEDS_INTO Lean Canvas (confidence: 0.82, phase: thesis-build)',
  '- Jobs-to-be-Done FEEDS_INTO Value Proposition Canvas (confidence: 0.90, phase: pre-opportunity)',
].join('\n');

// Phase 122-04: a chain whose `next` framework IS registered in
// data/command-registry.json, so proposeNextFramework returns a non-null
// /mos: command (Tests 16 + 18 need the engine's offer_next_step.command
// to be a real command string -- only the resolver-registered frameworks
// yield one; unregistered ones degrade to null per reliability rule 5).
// 'Business Model Canvas' is in KNOWN_FRAMEWORKS (detectable from a
// governing thought); 'Lean Canvas' resolves to /mos:lean-canvas.
const SAMPLE_REGISTERED_CHAIN = [
  '- Business Model Canvas FEEDS_INTO Lean Canvas (confidence: 0.85, phase: thesis-build)',
].join('\n');

// =========================================================
// Task 1 -- parser + completion detection + proposal (Tests 1..15)
// =========================================================

run('Test 1: parseFrameworkChainSection 4 FEEDS_INTO lines -> 4 edges', () => {
  const { parseFrameworkChainSection } = requireComposer();
  const section = makeChainSection(SAMPLE_4_LINES);
  const edges = parseFrameworkChainSection(section);
  assert.equal(Array.isArray(edges), true);
  assert.equal(edges.length, 4, 'expected 4 edges; got ' + edges.length);
  // Each edge has the four expected fields.
  for (const e of edges) {
    assert.equal(typeof e.from, 'string');
    assert.equal(typeof e.to, 'string');
    assert.equal(typeof e.confidence === 'number' || e.confidence === null, true);
    // phase_indicator may be null when not present; in this fixture all
    // four lines provide one.
    assert.equal(typeof e.phase_indicator === 'string' || e.phase_indicator === null, true);
  }
  // Spot-check the first edge.
  assert.equal(edges[0].from, 'SWOT Analysis');
  assert.equal(edges[0].to, 'Porter Five Forces');
  assert.equal(Math.abs(edges[0].confidence - 0.85) < 1e-9, true);
  assert.equal(edges[0].phase_indicator, 'early-market');
});

run('Test 2: parseFrameworkChainSection (no signal) -> []', () => {
  const { parseFrameworkChainSection } = requireComposer();
  const section = makeChainSection('(no signal)');
  const edges = parseFrameworkChainSection(section);
  assert.equal(Array.isArray(edges), true);
  assert.equal(edges.length, 0);
  // Also null section.
  assert.deepEqual(parseFrameworkChainSection(null), []);
  // Also undefined.
  assert.deepEqual(parseFrameworkChainSection(undefined), []);
  // Also empty body.
  assert.deepEqual(parseFrameworkChainSection({ body: '', tokens_estimate: 0 }), []);
});

run('Test 3: parseFrameworkChainSection tolerant format (FEEDS_INTO + arrow)', () => {
  const { parseFrameworkChainSection } = requireComposer();
  // Mix: FEEDS_INTO form + arrow form. Arrow form drops the phase indicator.
  const body = [
    '- SWOT FEEDS_INTO Porter (confidence: 0.8)',
    '- Lean Canvas -> Value Proposition Canvas (confidence: 0.7)',
  ].join('\n');
  const edges = parseFrameworkChainSection(makeChainSection(body));
  assert.equal(edges.length, 2, 'expected 2 edges; got ' + edges.length);
  // Both should parse with valid confidence numbers.
  assert.equal(typeof edges[0].confidence, 'number');
  assert.equal(typeof edges[1].confidence, 'number');
  // From/to extracted (whitespace-trimmed; case preserved).
  assert.equal(edges[0].from, 'SWOT');
  assert.equal(edges[0].to, 'Porter');
  assert.equal(edges[1].from, 'Lean Canvas');
  assert.equal(edges[1].to, 'Value Proposition Canvas');
});

run('Test 4: parseFrameworkChainSection missing confidence -> null edge.confidence (not filtered)', () => {
  const { parseFrameworkChainSection } = requireComposer();
  // Confidence absent. The edge MUST still parse so callers see the
  // structural FEEDS_INTO relationship; downstream gating decides what
  // to do with null confidence.
  const body = '- SWOT Analysis FEEDS_INTO Porter Five Forces';
  const edges = parseFrameworkChainSection(makeChainSection(body));
  // Either the parser tolerantly emits an edge with null confidence,
  // OR (acceptable) the parser drops it. The plan requires "not
  // filtered", so we assert the edge survives.
  assert.equal(edges.length >= 1, true,
    'parser should preserve edge with missing confidence; got 0 edges');
  const e = edges[0];
  assert.equal(e.from, 'SWOT Analysis');
  assert.equal(e.to, 'Porter Five Forces');
  assert.equal(e.confidence, null);
});

run('Test 5: detectCompletedFramework via governing_thought match', () => {
  const { detectCompletedFramework } = requireComposer();
  // Reasoning fixture contains "SWOT Analysis" in governing_thought.
  const reasoning = {
    exists: true,
    governing_thought: 'After running our SWOT Analysis we identified two threats.',
    reasoning_health_score: 0.8,
    is_stale: false,
    arguments: [],
  };
  const result = detectCompletedFramework('/tmp/nonexistent', '/tmp/nonexistent/section', reasoning);
  assert.equal(result, 'SWOT Analysis',
    'should detect SWOT Analysis from governing_thought; got: ' + result);
});

run('Test 6: detectCompletedFramework mtime fallback', () => {
  const { detectCompletedFramework } = requireComposer();
  // Build a tmp section dir with a recently-touched file matching a
  // framework slug. Reasoning is empty so the fallback path runs.
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p91-08-mtime-'));
  try {
    const sectionDir = path.join(tmpRoot, 'market-analysis');
    fs.mkdirSync(sectionDir, { recursive: true });
    // File slug matching a known framework (lean-canvas).
    fs.writeFileSync(path.join(sectionDir, 'lean-canvas.md'), '# Lean Canvas\n');
    // Touch mtime so it's clearly within window.
    const now = Date.now();
    fs.utimesSync(path.join(sectionDir, 'lean-canvas.md'), now / 1000, now / 1000);

    const reasoning = {
      exists: true,
      governing_thought: 'Some thought without any framework name in it.',
      reasoning_health_score: 0.5,
      is_stale: false,
      arguments: [],
    };
    const result = detectCompletedFramework(tmpRoot, sectionDir, reasoning);
    // Should match the lean-canvas slug -> 'Lean Canvas' (or any
    // canonical name; here we accept any non-null match).
    assert.equal(result !== null, true,
      'mtime fallback should detect framework slug; got: ' + result);
    assert.equal(/lean.?canvas/i.test(result), true,
      'detected framework should reference Lean Canvas; got: ' + result);
  } finally {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
  }
});

run('Test 7: detectCompletedFramework no signal -> null', () => {
  const { detectCompletedFramework } = requireComposer();
  // Empty reasoning + no section dir.
  const reasoning = {
    exists: true,
    governing_thought: 'No framework names here, just prose about widgets.',
    reasoning_health_score: 0.5,
    is_stale: false,
    arguments: [],
  };
  const result = detectCompletedFramework('/tmp/nonexistent-' + Date.now(), '/tmp/nonexistent-' + Date.now() + '/x', reasoning);
  assert.equal(result, null);
  // Also null reasoning.
  assert.equal(detectCompletedFramework('/tmp/nope', '/tmp/nope/x', null), null);
});

run('Test 8: proposeNextFramework happy path', () => {
  const { parseFrameworkChainSection, proposeNextFramework } = requireComposer();
  const edges = parseFrameworkChainSection(makeChainSection(SAMPLE_4_LINES));
  const out = proposeNextFramework('SWOT Analysis', edges);
  assert.equal(out !== null, true);
  assert.equal(out.next, 'Porter Five Forces');
  assert.equal(Math.abs(out.confidence - 0.85) < 1e-9, true);
  assert.equal(out.source, 'FEEDS_INTO');
  assert.equal(out.phase_indicator, 'early-market');
});

run('Test 9: proposeNextFramework no outgoing edge -> null', () => {
  const { parseFrameworkChainSection, proposeNextFramework } = requireComposer();
  const edges = parseFrameworkChainSection(makeChainSection(SAMPLE_4_LINES));
  // SAMPLE_4_LINES has no outgoing edge from "Random Framework".
  const out = proposeNextFramework('Random Framework', edges);
  assert.equal(out, null);
});

run('Test 10: proposeNextFramework confidence gating (< 0.5 noise floor)', () => {
  const { proposeNextFramework } = requireComposer();
  // Manually-built edges with sub-0.5 confidence.
  const lowEdges = [
    { from: 'SWOT', to: 'Porter', confidence: 0.4, phase_indicator: null },
  ];
  const out = proposeNextFramework('SWOT', lowEdges);
  assert.equal(out, null, 'sub-0.5 confidence must be filtered as noise; got: ' + JSON.stringify(out));
  // Boundary: 0.5 is acceptable (it's the floor, not strictly less than).
  // Either the implementation accepts 0.5 OR rejects it; we accept both
  // behaviors but document the floor as < 0.5 = null.
  const boundaryEdges = [
    { from: 'SWOT', to: 'Porter', confidence: 0.55, phase_indicator: null },
  ];
  const boundaryOut = proposeNextFramework('SWOT', boundaryEdges);
  assert.equal(boundaryOut !== null, true,
    '0.55 confidence must propose; got: ' + JSON.stringify(boundaryOut));
});

run('Test 11: proposeNextFramework tie-breaking by confidence desc', () => {
  const { proposeNextFramework } = requireComposer();
  // Multiple edges from SWOT; engine returns the highest-confidence one.
  const edges = [
    { from: 'SWOT', to: 'Lean Canvas', confidence: 0.7, phase_indicator: 'thesis' },
    { from: 'SWOT', to: 'Porter', confidence: 0.85, phase_indicator: 'early' },
    { from: 'SWOT', to: 'Value Chain', confidence: 0.6, phase_indicator: 'thesis' },
  ];
  const out = proposeNextFramework('SWOT', edges);
  assert.equal(out !== null, true);
  assert.equal(out.next, 'Porter', 'highest-confidence edge wins; got: ' + out.next);
  assert.equal(Math.abs(out.confidence - 0.85) < 1e-9, true);
});

run('Test 12: proposeNextFramework command resolution via the resolver (Phase 122-04: degrade to null, not fabricate)', () => {
  const { proposeNextFramework } = requireComposer();
  const resolver = require('../workflow/command-resolver.cjs');
  // 'Lean Canvas' has an existing /mos:lean-canvas command in the registry.
  const knownEdges = [
    { from: 'Business Model Canvas', to: 'Lean Canvas', confidence: 0.82, phase_indicator: 'thesis' },
  ];
  const known = proposeNextFramework('Business Model Canvas', knownEdges);
  assert.equal(known !== null, true);
  // Phase 122-04: command comes from the resolver (commandsForFramework[0]).
  const expected = resolver.commandsForFramework('Lean Canvas');
  assert.equal(known.command, expected.length > 0 ? expected[0] : null,
    'command must equal commandsForFramework(next)[0] (or null); got: ' + known.command);
  assert.equal(typeof known.command === 'string' && known.command.indexOf('/mos:') === 0, true,
    'Lean Canvas is registered, so command must be a /mos: string; got: ' + known.command);
  // A workflow array (the resolver's composeWorkflow for the chain) is on
  // the proposal as data -- a list of { step, framework, command|null, optional }.
  assert.equal(Array.isArray(known.workflow), true, 'workflow must be a composeWorkflow array');
  assert.equal(known.workflow.length >= 2, true, 'workflow includes [completed, next, ...]');
  assert.equal(known.workflow[0].step, 1);
  for (let i = 0; i < known.workflow.length; i += 1) {
    const s = known.workflow[i];
    assert.equal(s.step, i + 1);
    assert.equal('command' in s && 'optional' in s && 'framework' in s, true);
    assert.equal(s.command === null || (typeof s.command === 'string' && s.command.indexOf('/mos:') === 0), true);
  }
  // A framework name the registry does not know yet -> command is null
  // (degrade, do not fabricate -- WORKFLOW-LAYER-SPEC reliability rule 5).
  const unknownEdges = [
    { from: 'X', to: 'A Wholly Imaginary Framework', confidence: 0.8, phase_indicator: null },
  ];
  const unknown = proposeNextFramework('X', unknownEdges);
  assert.equal(unknown !== null, true);
  assert.equal(unknown.command, null, 'command must be null for an unregistered framework; got: ' + unknown.command);
  assert.equal(Array.isArray(unknown.workflow), true);
  assert.equal(unknown.workflow.every(function (s) { return s.command === null; }), true,
    'an unregistered chain composes to all-null commands (run manually)');
});

run('Test 13: proposeNextFramework grounding rule (FEEDS_INTO + Brain + confidence in reason)', () => {
  const { proposeNextFramework } = requireComposer();
  const edges = [
    { from: 'SWOT', to: 'Porter', confidence: 0.85, phase_indicator: 'early-market' },
  ];
  const out = proposeNextFramework('SWOT', edges);
  assert.equal(typeof out.reason, 'string');
  assert.equal(/FEEDS_INTO/.test(out.reason), true,
    'reason must reference FEEDS_INTO; got: ' + out.reason);
  assert.equal(/Brain/i.test(out.reason), true,
    'reason must reference Brain; got: ' + out.reason);
  // Confidence number appears in the reason (either '0.85' or '0.8' fragment).
  assert.equal(/0\.85|0\.8/.test(out.reason), true,
    'reason must include confidence number; got: ' + out.reason);
});

run('Test 14: proposeNextFramework RECOMMENDED eligibility flag', () => {
  const { proposeNextFramework } = requireComposer();
  // 0.85 -> eligible.
  const high = proposeNextFramework('SWOT', [
    { from: 'SWOT', to: 'Porter', confidence: 0.85, phase_indicator: null },
  ]);
  assert.equal(high.recommended_eligible, true,
    '0.85 confidence must mark recommended_eligible:true');
  // 0.65 -> not eligible (between 0.5 noise floor and 0.7 recommended floor).
  const mid = proposeNextFramework('SWOT', [
    { from: 'SWOT', to: 'Porter', confidence: 0.65, phase_indicator: null },
  ]);
  assert.equal(mid.recommended_eligible, false,
    '0.65 confidence must NOT mark recommended_eligible:true');
});

run('Test 15: proposeNextFramework empty edges -> null', () => {
  const { proposeNextFramework } = requireComposer();
  assert.equal(proposeNextFramework('SWOT', []), null);
  assert.equal(proposeNextFramework('SWOT', null), null);
  // Null completedFramework -> null.
  assert.equal(proposeNextFramework(null, [
    { from: 'X', to: 'Y', confidence: 0.9, phase_indicator: null },
  ]), null);
});

// =========================================================
// Task 2 -- decide() integration (Tests 16..18)
// =========================================================

function makeBrainWithChain(chainBody, governingThought) {
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
      framework_chain_predictions: chainBody !== null ? makeChainSection(chainBody) : null,
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
}

function makeQuadrupleWithChain(chainBody, governingThought) {
  return {
    room: { exists: true, identity_text: 'fixture', references: [] },
    state: { exists: true, artifact_count: 1, completeness_score: 0.5 },
    reasoning: {
      exists: true,
      governing_thought: governingThought,
      reasoning_health_score: 0.7,
      is_stale: false,
      arguments: [],
    },
    brain: makeBrainWithChain(chainBody, governingThought),
  };
}

run('Test 16: decide() with chain + governing_thought -> offer_next_step with FEEDS_INTO reason', () => {
  const { decide } = requireEngine();
  // Phase 122-04: use a chain whose `next` framework is registered, so the
  // resolver yields a real /mos: command (an unregistered `next` would
  // degrade to command:null -- a true statement, but the presenter then
  // treats it as not-an-offer; this test wants the command-carrying path).
  const quadruple = makeQuadrupleWithChain(
    SAMPLE_REGISTERED_CHAIN,
    'After our Business Model Canvas work we mapped the value flows.'
  );
  const out = decide(
    { sectionPath: '/tmp/fixture', sessionId: 's1' },
    {
      quadruple: quadruple,
      brainAvailable: true,
      userPersona: null,
      intentSignal: null,
    }
  );
  // Engine should compose a chain offer: Business Model Canvas -> Lean Canvas.
  assert.equal(out.offer_next_step !== null, true,
    'expected non-null offer_next_step; trace: ' + (out.decision_trace.chosen_rationale || ''));
  assert.equal(typeof out.offer_next_step.command, 'string',
    'offer command must be a string (Lean Canvas is registered); got: ' + out.offer_next_step.command);
  assert.equal(out.offer_next_step.command.indexOf('/mos:') === 0, true);
  assert.equal(/FEEDS_INTO/.test(out.offer_next_step.reason), true,
    'offer reason must reference FEEDS_INTO; got: ' + out.offer_next_step.reason);
});

run('Test 17: decide() Mode A confidence 0.85 chain -> recommended_eligible flag in trace', () => {
  const { decide } = requireEngine();
  const quadruple = makeQuadrupleWithChain(
    SAMPLE_4_LINES,
    'We just completed a SWOT Analysis review with the team.'
  );
  const out = decide(
    { sectionPath: '/tmp/fixture', sessionId: 's1' },
    {
      quadruple: quadruple,
      brainAvailable: true,
      userPersona: null,
      intentSignal: null,
    }
  );
  // The chain proposal sets a recommended_eligible flag in decision_trace
  // OR sets brain_md_recommended_marker_rendered when the chain confidence
  // qualifies and Mode A holds. Either field signals offer-presenter to
  // render the marker.
  const trace = out.decision_trace;
  const eligible =
    trace.brain_md_recommended_marker_rendered === true ||
    (trace.chain_recommended_eligible === true);
  assert.equal(eligible, true,
    'Mode A + chain conf 0.85 must mark eligibility; trace: ' + JSON.stringify(trace));
});

run('Test 18: decide() user override path: turn 1 offer; turn 2 different command -> REJECTED chain trace', () => {
  const { decide } = requireEngine();
  // Turn 1: chain proposes /mos:lean-canvas (Business Model Canvas FEEDS_INTO
  // Lean Canvas; Lean Canvas is resolver-registered so the command is real).
  // Engine sets offer_next_step with the chain command + reason.
  const turn1Quad = makeQuadrupleWithChain(
    SAMPLE_REGISTERED_CHAIN,
    'After our Business Model Canvas work we mapped the value flows.'
  );
  const turn1 = decide(
    { sectionPath: '/tmp/fixture', sessionId: 's1', userText: '' },
    {
      quadruple: turn1Quad,
      brainAvailable: true,
      userPersona: null,
      intentSignal: null,
    }
  );
  assert.equal(turn1.offer_next_step !== null, true,
    'turn 1 must produce a chain offer; trace: ' + turn1.decision_trace.chosen_rationale);
  const turn1Command = turn1.offer_next_step.command;
  assert.equal(typeof turn1Command === 'string' && turn1Command.length > 0, true,
    'turn 1 chain command must be a real /mos: string; got: ' + turn1Command);

  // Turn 2: user invokes a DIFFERENT /mos: command. Engine should record
  // this as REJECTED chain suggestion in decision_trace.
  const turn2 = decide(
    {
      sectionPath: '/tmp/fixture',
      sessionId: 's1',
      userText: '/mos:mullins run the 7-domains screen instead',
    },
    {
      quadruple: turn1Quad,
      brainAvailable: true,
      userPersona: null,
      intentSignal: null,
      lastTurnOffer: { command: turn1Command, reason: turn1.offer_next_step.reason },
    }
  );
  // The override is captured either in chosen_rationale or in a dedicated
  // trace field. Both are acceptable -- /mos:explain-decision can read
  // either. We assert at least one path is present.
  const rationale = turn2.decision_trace.chosen_rationale || '';
  const hasOverride =
    /REJECTED chain suggestion/i.test(rationale) ||
    turn2.decision_trace.chain_override_recorded === true;
  assert.equal(hasOverride, true,
    'turn 2 must record REJECTED chain suggestion; rationale: ' + rationale);
});

// ---------- Suite footer ----------

const total = passed + failed;
process.stdout.write('\nframework-chain-composer: ' + passed + '/' + total + ' passed\n');
process.exit(failed === 0 ? 0 : 1);
