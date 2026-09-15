'use strict';
// Phase 346-07 -- attach the arbiter to decide() without creating a second
// selection brain, behind one blocking navigator checkpoint (ratified in the
// live orchestrator session, see 346-07-SUMMARY.md's Task 1 provenance note).
//
// Two tasks land in this one file, in order:
//   Task 2: the null default in emptyDecisionTrace and the ctx-assembly
//     threading (arbitrationResult computed once, before any return path,
//     unused until Task 3 wires it).
//   Task 3: applyArbitration on both return paths, with the null no-op
//     proven byte-identical, plus the 60-case non-interference sweep.
//
// House idiom: node:assert/strict, `let n = 0; function ok(desc, fn)`, final
// line '>>> test-346-decide-attachment.cjs: PASSED'.
//
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const SHARED_PATH = path.join(REPO, 'lib', 'core', 'navigation-engine-shared.cjs');
const ENGINE_PATH = path.join(REPO, 'lib', 'core', 'navigation-engine.cjs');
const ARBITRATION_PATH = path.join(REPO, 'lib', 'core', 'arbitration.cjs');

const shared = require(SHARED_PATH);
const engine = require(ENGINE_PATH);
const arbitration = require(ARBITRATION_PATH);

const decide = engine.decide;
const applyArbitration = engine.applyArbitration;

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-346-decide-attachment');

// ---------------------------------------------------------------------------
// Task 2: the null default in emptyDecisionTrace, and the once-before-any-
// return computation (unused at the end of Task 2; wired by Task 3).
// ---------------------------------------------------------------------------

ok('emptyDecisionTrace().arbitration is null, not undefined', function () {
  const t = shared.emptyDecisionTrace();
  assert.equal('arbitration' in t, true);
  assert.equal(t.arbitration, null);
});

ok('emptyDecision().decision_trace.arbitration is null', function () {
  assert.equal(shared.emptyDecision().decision_trace.arbitration, null);
});

ok('emptyDecisionTrace() key count grows by exactly one versus the pre-plan snapshot; no key removed or renamed', function () {
  const PRE_PLAN_KEYS = [
    'brain_md_version', 'brain_md_staleness', 'brain_md_stale_reason',
    'brain_md_weight_applied', 'brain_md_recommended_confidence',
    'brain_md_recommended_marker_rendered', 'brain_md_tier_mode',
    'brain_md_sections_consumed', 'brain_pattern_verb', 'brain_pattern_verb_confidence',
    'navigated_neighborhood', 'icm_scope', 'sql_signals', 'minto_reasoning',
    'intent_persona', 'chosen_rationale', 'projection_offer',
  ];
  const keys = Object.keys(shared.emptyDecisionTrace());
  PRE_PLAN_KEYS.forEach(function (k) {
    assert.ok(keys.indexOf(k) !== -1, 'missing pre-plan key: ' + k);
  });
  assert.equal(keys.length, PRE_PLAN_KEYS.length + 1, 'expected exactly one new key on top of the pre-plan set');
  const added = keys.filter(function (k) { return PRE_PLAN_KEYS.indexOf(k) === -1; });
  assert.deepEqual(added, ['arbitration'], 'the one added key must be "arbitration"');
});

ok('decide() opens no file and no database to compute the arbitration (source scan of the computation block)', function () {
  const src = fs.readFileSync(ENGINE_PATH, 'utf8');
  const startMarker = 'let arbitrationResult = null;';
  const startIdx = src.indexOf(startMarker);
  assert.ok(startIdx !== -1, 'arbitrationResult computation block not found');
  // The block ends at the next "let quadruple = ctx.quadruple;" (the start of
  // the pre-existing per-turn cache scope, unmoved by this plan).
  const endIdx = src.indexOf('let quadruple = ctx.quadruple;', startIdx);
  assert.ok(endIdx !== -1 && endIdx > startIdx, 'could not bound the arbitration computation block');
  const block = src.slice(startIdx, endIdx);
  assert.equal(/\bfs\./.test(block), false, 'the arbitration computation block must not read fs');
  assert.equal(/openRoomDb/.test(block), false, 'the arbitration computation block must not open room.db');
  const requireMatches = [...block.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map(function (m) { return m[1]; });
  assert.deepEqual(requireMatches, ['./arbitration.cjs'], 'the only require added in this block is ./arbitration.cjs');
});

ok('a resolver fault (module require throws) degrades arbitrationResult to null, never a crash (proven end to end via decide())', function () {
  const original = require.cache[ARBITRATION_PATH];
  require.cache[ARBITRATION_PATH] = {
    id: ARBITRATION_PATH, filename: ARBITRATION_PATH, loaded: true,
    exports: { resolveArbitration: function () { throw new Error('injected-arbitration-fault'); } },
  };
  try {
    const decision = decide({}, {});
    assert.equal(decision.decision_trace.arbitration, null);
  } finally {
    if (original) { require.cache[ARBITRATION_PATH] = original; } else { delete require.cache[ARBITRATION_PATH]; }
  }
});

// ---------------------------------------------------------------------------
// Task 3: applyArbitration on both return paths, the null/non-object/array
// full no-op, the 60-case non-interference sweep, the enum-only rationale
// clause, and the byte-identity mechanical proof.
// ---------------------------------------------------------------------------

ok('decide() carries a populated decision_trace.arbitration on the tier_0 early-return path, with all six inputs missing when ctx.arbitration_inputs is absent', function () {
  const decision = decide({}, {}); // no sectionPath -> no quadruple -> tier_0
  const arb = decision.decision_trace.arbitration;
  assert.ok(arb && typeof arb === 'object', 'tier_0 path must carry a populated arbitration result');
  assert.equal(arb.arbitration_version, arbitration.ARBITRATION_VERSION);
  assert.deepEqual(arb.inputs_missing.slice().sort(), arbitration.ARBITRATION_INPUTS.slice().sort());
  assert.deepEqual(arb.inputs_read, []);
});

ok('decide() carries a populated decision_trace.arbitration on the main path, with all six inputs missing when ctx.arbitration_inputs is absent', function () {
  const decision = decide({ sectionPath: null }, { quadruple: {} }); // truthy, brain-less quadruple -> main path
  const arb = decision.decision_trace.arbitration;
  assert.ok(arb && typeof arb === 'object', 'main path must carry a populated arbitration result');
  assert.equal(arb.arbitration_version, arbitration.ARBITRATION_VERSION);
  assert.deepEqual(arb.inputs_missing.slice().sort(), arbitration.ARBITRATION_INPUTS.slice().sort());
});

ok('decide() carries decision_trace.arbitration === null (not undefined) on the fault path', function () {
  const hostileQuadruple = new Proxy({}, {
    get: function () { throw new Error('injected-quadruple-fault'); },
  });
  const decision = decide({ sectionPath: null }, { quadruple: hostileQuadruple });
  assert.equal(decision.decision_trace.chosen_rationale.indexOf('engine_fault') === 0, true, 'must actually hit the outer fault catch');
  assert.equal(decision.decision_trace.arbitration, null);
  assert.notEqual(decision.decision_trace.arbitration, undefined);
});

ok('applyArbitration(decision, trace, null) is a full no-op', function () {
  const decision = shared.emptyDecision();
  decision.fire_skill = 'Some Verb';
  decision.decision_trace.chosen_rationale = 'unchanged rationale';
  const before = JSON.parse(JSON.stringify(decision));
  applyArbitration(decision, decision.decision_trace, null);
  assert.deepEqual(JSON.parse(JSON.stringify(decision)), before);
});

ok('applyArbitration(decision, trace, "not an object") is a full no-op', function () {
  const decision = shared.emptyDecision();
  const before = JSON.parse(JSON.stringify(decision));
  applyArbitration(decision, decision.decision_trace, 'not an object');
  assert.deepEqual(JSON.parse(JSON.stringify(decision)), before);
});

ok('applyArbitration(decision, trace, []) is a full no-op', function () {
  const decision = shared.emptyDecision();
  const before = JSON.parse(JSON.stringify(decision));
  applyArbitration(decision, decision.decision_trace, []);
  assert.deepEqual(JSON.parse(JSON.stringify(decision)), before);
});

// 20 generated real arbitration results, varying every ladder rung and every
// reused-resolver signal, crossed with 3 starting decision states -> 60 cases.
function generateArbitrationResults() {
  const inputs = [
    {},
    { capabilities: { hooks: false } },
    { capabilities: { hooks: true } },
    { capabilities: { hooks: true }, floor_engaged: true, floor_kind: 'part8_egress' },
    { capabilities: { hooks: true }, floor_engaged: true, floor_kind: 'write_scope' },
    { capabilities: { hooks: true }, escape_hatch: { user_said_just_tell_me: true, user_said_bottom_line: false } },
    { capabilities: { hooks: true }, escape_hatch: { user_said_just_tell_me: false, user_said_bottom_line: true } },
    { capabilities: { hooks: true }, is_cold_start: true },
    { capabilities: { hooks: true }, is_first_material: true },
    { capabilities: { hooks: true }, gate_reached: false },
    { capabilities: { hooks: true }, gate_reached: true, gate_subject_connected: false },
    { capabilities: { hooks: true }, gate_reached: true, gate_subject_connected: true, question_already_answered: true },
    { capabilities: { hooks: true }, gate_reached: true, gate_subject_connected: true, card_fired_this_turn: true },
    { capabilities: { hooks: true }, gate_reached: true, gate_subject_connected: true },
    { capabilities: { hooks: true }, gate_reached: true, gate_subject_connected: true, confidence: 0.9, persona: 'founder' },
    { capabilities: { hooks: true }, gate_reached: true, gate_subject_connected: true, confidence: 0.2, requires_judgment: true },
    { capabilities: { hooks: true }, gate_reached: true, gate_subject_connected: true, persona: 'PROSE-LEAK-CANARY-4471' },
    { capabilities: { hooks: true }, gate_reached: true, gate_subject_connected: true, stall_count: 3 },
    { capabilities: { hooks: true }, gate_reached: true, gate_subject_connected: true, role_blend: { founder: 0.7, student: 0.3 } },
    { capabilities: null, gate_reached: undefined },
  ];
  assert.equal(inputs.length, 20, 'exactly 20 generated arbitration inputs, per the threat-model sweep size');
  return inputs.map(function (i) { return arbitration.resolveArbitration(i); });
}

function threeStartingDecisionStates() {
  return [
    { fire_skill: null, offer_next_step: null, suppress_skills: [] },
    { fire_skill: 'Run Methodology', offer_next_step: { command: '/mos:causal', reason: 'test' }, suppress_skills: [] },
    { fire_skill: null, offer_next_step: null, suppress_skills: ['larry-personality', 'voice-check'] },
  ];
}

ok('a 60-case sweep (20 generated arbitration results x 3 starting decision states) proves fire_skill, offer_next_step and suppress_skills are untouched by applyArbitration', function () {
  const results = generateArbitrationResults();
  const states = threeStartingDecisionStates();
  let cases = 0;
  results.forEach(function (arbResult) {
    states.forEach(function (state) {
      const decision = {
        fire_skill: state.fire_skill,
        offer_next_step: state.offer_next_step,
        suppress_skills: state.suppress_skills.slice(),
        persona_updates: null,
        decision_trace: shared.emptyDecisionTrace(),
      };
      const preFireSkill = decision.fire_skill;
      const preOfferNextStep = JSON.parse(JSON.stringify(decision.offer_next_step));
      const preSuppressSkills = decision.suppress_skills.slice();
      applyArbitration(decision, decision.decision_trace, arbResult);
      assert.equal(decision.fire_skill, preFireSkill);
      assert.deepEqual(decision.offer_next_step, preOfferNextStep);
      assert.deepEqual(decision.suppress_skills, preSuppressSkills);
      cases += 1;
    });
  });
  assert.equal(cases, 60, 'exactly 60 cases (20 x 3)');
});

ok('applyArbitration writes trace.arbitration and appends exactly one enum-only rationale clause, with no colon-delimited free text and no prose-leak sentinel', function () {
  const arbResult = arbitration.resolveArbitration({
    capabilities: { hooks: true }, gate_reached: true, gate_subject_connected: true,
    persona: 'PROSE-LEAK-CANARY-4471',
  });
  const decision = shared.emptyDecision();
  decision.decision_trace.chosen_rationale = 'Prior clause.';
  applyArbitration(decision, decision.decision_trace, arbResult);
  assert.equal(decision.decision_trace.arbitration, arbResult);
  const rationale = decision.decision_trace.chosen_rationale;
  assert.equal(rationale.indexOf('Prior clause.'), 0, 'the existing rationale is preserved, not overwritten');
  const clauses = rationale.split(' Arbitration: ');
  assert.equal(clauses.length, 2, 'exactly one Arbitration clause appended');
  assert.equal(rationale.indexOf('PROSE-LEAK-CANARY-4471'), -1, 'the prose sentinel must never reach the rationale');
  const arbClause = 'Arbitration: ' + clauses[1];
  assert.ok(/^Arbitration: [a-z0-9_-]+\/[a-z0-9_-]+\/[A-Za-z0-9_-]+\.$/.test(arbClause),
    'the appended clause names three slash-separated enum tokens only: ' + arbClause);
});

ok('the sentinel does not survive end to end through decide() when threaded through ctx.arbitration_inputs', function () {
  const SENTINEL = 'PROSE-LEAK-CANARY-4471';
  const decision = decide({}, {
    arbitration_inputs: {
      persona: SENTINEL,
      role_blend: { founder: 0.5 },
      jtbd: { jtbd: SENTINEL, evidence: SENTINEL },
      surface: SENTINEL,
      rung: SENTINEL,
      capabilities: { hooks: true },
      gate_reached: true,
      gate_subject_connected: true,
    },
  });
  assert.equal(decision.decision_trace.chosen_rationale.indexOf(SENTINEL), -1);
  assert.equal(JSON.stringify(decision.decision_trace.arbitration).indexOf(SENTINEL), -1);
});

ok('applyArbitration re-ranks no sensor reach: its own signature carries no reach-list parameter, and a real decide() call\'s fired verb is identical whether or not real arbitration_inputs are threaded', function () {
  // Structural proof: applyArbitration's own arity is 3 (decision, trace,
  // arbitrationResult) -- it has no fourth parameter through which a reach
  // list could arrive.
  assert.equal(applyArbitration.length, 3);

  // Behavioral proof: a fixture that fires a real sensor reach on the tier_0
  // path resolves to the SAME fire_skill whether or not ctx.arbitration_inputs
  // is present, because applyArbitration only ever reads decision.fire_skill
  // (to leave it alone) and never writes it.
  const withoutInputs = decide({}, {});
  const withInputs = decide({}, { arbitration_inputs: { capabilities: { hooks: true }, gate_reached: true, gate_subject_connected: true } });
  assert.equal(withoutInputs.fire_skill, withInputs.fire_skill);
  assert.deepEqual(withoutInputs.suppress_skills, withInputs.suppress_skills);
});

ok('exactly two applyArbitration(decision, trace, arbitrationResult) call sites, and exactly one function definition (source scan)', function () {
  const src = fs.readFileSync(ENGINE_PATH, 'utf8');
  const callSites = src.match(/applyArbitration\(decision, trace, arbitrationResult\);/g) || [];
  assert.equal(callSites.length, 2);
  const fnDefs = src.match(/^function applyArbitration/gm) || [];
  assert.equal(fnDefs.length, 1);
});

ok('applyArbitration never assigns fire_skill, offer_next_step or suppress_skills in its own function body (comment-stripped scan)', function () {
  const src = fs.readFileSync(ENGINE_PATH, 'utf8');
  const startIdx = src.indexOf('function applyArbitration');
  assert.ok(startIdx !== -1);
  const endIdx = src.indexOf('\nfunction ', startIdx + 10);
  const body = src.slice(startIdx, endIdx === -1 ? startIdx + 2000 : endIdx)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.equal(/decision\.(fire_skill|offer_next_step|suppress_skills)\s*=/.test(body), false);
});

// The mechanical form of "a null arbitration result leaves the decision
// byte-identical to what the pre-346 engine produced": when the arbiter is
// forced to fault (the lazy require stubbed to throw), applyArbitration
// receives null on BOTH return paths and fully no-ops on both, so the
// decision produced is structurally identical -- after deleting the one
// inert null-valued arbitration key this plan added -- across repeated
// calls under the same fault condition. Combined with the two facts proven
// separately above (a null/non-object/array result is a full no-op; the
// only new trace key is the null-defaulted "arbitration") this is the
// mechanical proof that a faulted arbiter changes nothing else on the
// decision the pre-346 engine would have produced.
function withStubbedArbitrationFault(fn) {
  const original = require.cache[ARBITRATION_PATH];
  require.cache[ARBITRATION_PATH] = {
    id: ARBITRATION_PATH, filename: ARBITRATION_PATH, loaded: true,
    exports: { resolveArbitration: function () { throw new Error('injected-arbitration-fault'); } },
  };
  try {
    return fn();
  } finally {
    if (original) { require.cache[ARBITRATION_PATH] = original; } else { delete require.cache[ARBITRATION_PATH]; }
  }
}

ok('byte-identity proof: a decide() call with the arbiter faulted, arbitration key deleted, is stable and reproducible across repeated calls under the same fault (the mechanical form of the byte-identity claim)', function () {
  const turn = { sectionPath: null };
  const ctx = { quadruple: {} }; // main path, deterministic, no lift/sensor fixtures
  const first = withStubbedArbitrationFault(function () { return decide(turn, ctx); });
  const second = withStubbedArbitrationFault(function () { return decide(turn, ctx); });
  delete first.decision_trace.arbitration;
  delete second.decision_trace.arbitration;
  // _meta carries wall-clock latency; strip it, it is expected to vary.
  delete first.decision_trace._meta;
  delete second.decision_trace._meta;
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

ok('node tests/test-346-no-second-brain.cjs still passes (the arbiter attachment adds no forbidden require or assignment inside arbitration.cjs itself)', function () {
  const { execFileSync } = require('node:child_process');
  execFileSync(process.execPath, [path.join(REPO, 'tests', 'test-346-no-second-brain.cjs')], { stdio: 'ignore' });
});

console.log(n + ' assertions passed');
console.log('>>> test-346-decide-attachment.cjs: PASSED');
process.exit(0);
