'use strict';
/*
 * Phase 191 Plan 03 -- the decide() lift wire test. Drives the REAL decide()
 * (lib/core/navigation-engine.cjs) with an injected fixture projection (via
 * ctx.projectionOverride, decide-projection-reader.cjs's documented injection
 * seam) so the whole wire -- reader -> lift -> decision.fire_skill / trace.
 * projection_offer -- is exercised end to end, on BOTH return paths.
 *
 * decide() calls liftFiringCandidate with the REAL rankFn (f-selector-
 * ranker.cjs rankForSelector) and the REAL command registry (191-IFACE.md
 * section 5 does not expose a rankFn/verbFn/gate seam through decide()). To
 * stay deterministic without depending on registry drift, this fixture:
 *   - picks a real, stable registry command (/mos:causal, framework "Root
 *     Cause Analysis") that already carries jtbd_summary + teaching (the D6/
 *     D11 fail-closed preconditions rankForSelector enforces).
 *   - drives its D4 brain_confidence term via a packetOptional
 *     framework_chain_hint edge that touches ONLY that framework, so /mos:
 *     causal is the uniquely-boosted top-ranked entry regardless of its
 *     position in the registry (every other command stays at the baseline
 *     brain_confidence default of 0.5).
 *   - keeps roomState empty (no ignite persona prior) so investment_level is
 *     0, which makes the D4 formula reduce to score === brain_confidence
 *     exactly (no drift from decay / problem-type-bind terms).
 * This lets the fixture pick an EXACT confidence (0.90 above the 0.70 gate,
 * 0.60 below it) with no dependency on any other command's registry score.
 *
 * Canon Part 8: all fixtures are synthetic enum/scalar shapes; zero live
 * Brain / network / room bytes. House rule: hyphens only, no em-dashes.
 */

const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const navigationEngine = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine.cjs'));
const shared = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine-shared.cjs'));

const decide = navigationEngine.decide;

let pass = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log('  ok - ' + name);
  pass += 1;
}

// B2 (191-IFACE.md section 8): the canonical key sets. Rather than the empty
// shell constructors (which omit runtime-only fields like trace._meta that
// decide() attaches on every real call, lift or no lift), snapshot a REAL
// decide() call that carries no lift candidate at all (an empty context ->
// 'no_offer' / no match) as the baseline "pre-191 shape". Every lifted call
// below is asserted to carry the IDENTICAL key set -- proving the lift only
// changes existing-field VALUES, never the shape (191-IFACE.md section 8's
// snapshot-and-diff pattern).
const BASELINE_DECISION = decide({}, {});
const EXPECTED_DECISION_KEYS = Object.keys(BASELINE_DECISION).slice().sort();
const EXPECTED_TRACE_KEYS = Object.keys(BASELINE_DECISION.decision_trace).slice().sort();

// Parity check: every shell key (emptyDecision / emptyDecisionTrace) is a
// subset of the real baseline (the real call only ADDS runtime-only fields
// like _meta on top of the shell; it never drops a shell key).
(function () {
  const shellDecisionKeys = Object.keys(shared.emptyDecision());
  const shellTraceKeys = Object.keys(shared.emptyDecisionTrace());
  ok('baseline decision keys are a superset of the emptyDecision shell',
    shellDecisionKeys.every((k) => EXPECTED_DECISION_KEYS.indexOf(k) !== -1));
  ok('baseline trace keys are a superset of the emptyDecisionTrace shell',
    shellTraceKeys.every((k) => EXPECTED_TRACE_KEYS.indexOf(k) !== -1));
})();

// A real, stable registry command with a distinctive, low-collision
// frameworks[0] value (191-CONTEXT.md D-03a: the LOCAL command subgraph).
const FIXTURE_COMMAND = '/mos:causal';
const FIXTURE_FRAMEWORK = 'Root Cause Analysis';
// brain_consult maps to the canonical verb 'Run Methodology'
// (navigation-engine.cjs reachIdToSkillFamily, 191-IFACE.md section 2 anchor).
const FIXTURE_REACH_ID = 'brain_consult';
const EXPECTED_VERB = 'Run Methodology';

function fixtureProjection() {
  return {
    nodes: [
      {
        id: 'proj-node-causal',
        kind: 'command',
        methodology_tier: 'pws',
        ranking: {},
        name: FIXTURE_COMMAND,
        reach_id: FIXTURE_REACH_ID,
        sub_mode: 'test-fixture',
        framework: FIXTURE_FRAMEWORK,
        hierarchy_rank: 1,
        posture: 'push_forward',
      },
    ],
  };
}

// Drives the D4 brain_confidence term for FIXTURE_FRAMEWORK ONLY (every other
// registry command keeps its 0.5 baseline default -- no packetOptional edge
// touches their frameworks). No roomState / ignite prior -> investment_level
// is 0 -> D4's formula reduces to score === brain_confidence exactly.
function packetOptionalWithConfidence(confidence) {
  return {
    local_graph_summary: {
      framework_chain_hint: {
        edges: [
          { from: FIXTURE_FRAMEWORK, to: 'Synthesis', confidence: confidence },
        ],
      },
    },
  };
}

function baseContext(confidence) {
  return {
    projectionOverride: fixtureProjection(),
    packetOptional: packetOptionalWithConfidence(confidence),
    roomState: {},
  };
}

function assertKeySets(decision, label) {
  ok(label + ': decision top-level key set is unchanged (B2)',
    JSON.stringify(Object.keys(decision).slice().sort()) === JSON.stringify(EXPECTED_DECISION_KEYS));
  ok(label + ': decision_trace key set is unchanged (B2)',
    JSON.stringify(Object.keys(decision.decision_trace).slice().sort()) === JSON.stringify(EXPECTED_TRACE_KEYS));
}

// =====================================================================
// TIER_0 EARLY-RETURN PATH (no quadruple) -- above-gate fixture.
// =====================================================================
(function () {
  const turn = {}; // no sectionPath -> no quadruple -> tier_0 early return
  const context = baseContext(0.90);
  const decision = decide(turn, context);

  ok('tier_0 lifted: fire_skill flips to the canonical verb',
    decision.fire_skill === EXPECTED_VERB);
  ok('tier_0 lifted: trace.projection_offer.lifted_candidate is populated',
    decision.decision_trace.projection_offer
    && decision.decision_trace.projection_offer.lifted_candidate
    && decision.decision_trace.projection_offer.lifted_candidate.command === FIXTURE_COMMAND);
  ok('tier_0 lifted: trace.projection_offer.command_recommendation carries the D-03 shape',
    decision.decision_trace.projection_offer.command_recommendation
    && decision.decision_trace.projection_offer.command_recommendation.command_slug === FIXTURE_COMMAND
    && typeof decision.decision_trace.projection_offer.command_recommendation.hitl_shape === 'string'
    && typeof decision.decision_trace.projection_offer.command_recommendation.confidence === 'number');
  ok('tier_0 lifted: rationale names the lift (Part-8 safe, enum-only)',
    typeof decision.decision_trace.chosen_rationale === 'string'
    && decision.decision_trace.chosen_rationale.indexOf('Projection candidate lifted') !== -1);
  assertKeySets(decision, 'tier_0 lifted');
})();

// =====================================================================
// TIER_0 EARLY-RETURN PATH (no quadruple) -- below-gate fixture.
// =====================================================================
(function () {
  const turn = {};
  const context = baseContext(0.60); // below the 0.70 gate
  const decision = decide(turn, context);

  ok('tier_0 below-gate: fire_skill stays at the pre-191 value (null)',
    decision.fire_skill === null);
  ok('tier_0 below-gate: trace.projection_offer.lifted_candidate is null (advisory only)',
    decision.decision_trace.projection_offer
    && decision.decision_trace.projection_offer.lifted_candidate === null);
  ok('tier_0 below-gate: rationale does NOT mention the lift',
    typeof decision.decision_trace.chosen_rationale === 'string'
    && decision.decision_trace.chosen_rationale.indexOf('Projection candidate lifted') === -1);
  assertKeySets(decision, 'tier_0 below-gate');
})();

// =====================================================================
// MAIN PATH (quadruple present, decide() does not take the early return) --
// above-gate fixture. 191-IFACE.md section 5's "main path" anchor is
// reaching line ~1041 (NOT the tier_0 early return at ~901); a truthy but
// brain-less quadruple exercises exactly that code path.
// =====================================================================
(function () {
  const turn = { sectionPath: null }; // irrelevant; ctx.quadruple below wins
  const context = Object.assign(baseContext(0.90), { quadruple: {} });
  const decision = decide(turn, context);

  ok('main path lifted: fire_skill flips to the canonical verb',
    decision.fire_skill === EXPECTED_VERB);
  ok('main path lifted: trace.projection_offer.lifted_candidate is populated',
    decision.decision_trace.projection_offer
    && decision.decision_trace.projection_offer.lifted_candidate
    && decision.decision_trace.projection_offer.lifted_candidate.command === FIXTURE_COMMAND);
  ok('main path lifted: trace.projection_offer.command_recommendation carries the D-03 shape',
    decision.decision_trace.projection_offer.command_recommendation
    && decision.decision_trace.projection_offer.command_recommendation.command_slug === FIXTURE_COMMAND
    && typeof decision.decision_trace.projection_offer.command_recommendation.hitl_shape === 'string'
    && typeof decision.decision_trace.projection_offer.command_recommendation.confidence === 'number');
  ok('main path lifted: rationale names the lift (Part-8 safe, enum-only)',
    typeof decision.decision_trace.chosen_rationale === 'string'
    && decision.decision_trace.chosen_rationale.indexOf('Projection candidate lifted') !== -1);
  assertKeySets(decision, 'main path lifted');
})();

// =====================================================================
// MAIN PATH (quadruple present) -- below-gate fixture.
// =====================================================================
(function () {
  const turn = { sectionPath: null };
  const context = Object.assign(baseContext(0.60), { quadruple: {} });
  const decision = decide(turn, context);

  ok('main path below-gate: fire_skill stays at the pre-191 value (null)',
    decision.fire_skill === null);
  ok('main path below-gate: trace.projection_offer.lifted_candidate is null (advisory only)',
    decision.decision_trace.projection_offer
    && decision.decision_trace.projection_offer.lifted_candidate === null);
  ok('main path below-gate: rationale does NOT mention the lift',
    typeof decision.decision_trace.chosen_rationale === 'string'
    && decision.decision_trace.chosen_rationale.indexOf('Projection candidate lifted') === -1);
  assertKeySets(decision, 'main path below-gate');
})();

// =====================================================================
// D-01: the Phase-184 reader stays byte-unchanged. Structural proof that
// this wire test file never edits it (the executor's git-diff check covers
// the on-disk byte-identity guarantee; this is the in-process companion --
// the reader module exports remain exactly the READER-01..04 surface).
// =====================================================================
(function () {
  const reader = require(path.join(REPO_ROOT, 'lib', 'core', 'reader', 'decide-projection-reader.cjs'));
  const readerKeys = Object.keys(reader).slice().sort();
  ok('reader export surface unchanged (D-01)',
    JSON.stringify(readerKeys) === JSON.stringify([
      'READER_BUDGET_MS', 'READER_MAX_OPTIONS', 'VALID_TIERS', '__resetCache',
      'loadProjection', 'validateProjection', 'offerProjectionCapabilities',
      'rankCapabilities', 'surfaceAsOptionContent',
    ].slice().sort()));
})();

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> decide-lift-wire-191.test.cjs: PASSED');
process.exit(0);
