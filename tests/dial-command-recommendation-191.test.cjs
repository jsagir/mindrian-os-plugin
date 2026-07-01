'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 191 Plan 04 -- Wave 3 Surface B (191-04, D-03/D-03a). Proves the
 * command-recommendation candidate (trace.projection_offer.command_recommendation,
 * the Wave 2/3a lift-module output) surfaces on the EXISTING live F.7 dial as the
 * recommended single ranked reach, reusing 'brain_consult' (D-03: no new
 * LarryReach) and the frozen render contract (DIAL_REACH_K=6, MAX_K=3, 0.70/0.15
 * untouched), with clean graceful degrade when the recommendation is absent.
 *
 * Two composition stages under test, wired exactly as production wires them:
 *   1. lib/core/navigation-engine-offer.cjs composeCommandRecommendationReach
 *      folds trace.projection_offer.command_recommendation into a
 *      dial-reach-orchestrator ReachList as the recommended 'brain_consult' row.
 *   2. lib/hmi/dial-presenter.cjs renderDial renders that composed ReachList,
 *      the command_slug appearing verbatim as the row label, the recommended
 *      glyph marker prefixed, the confidence cell reused (_confidenceCell).
 *
 * Standalone runner (mirrors tests/decide-lift-wire-191.test.cjs /
 * tests/test-dial-end-to-end-states.cjs): plain node:assert + process.exit, no
 * node:test. No em-dashes (hyphens only). CJS only.
 */

const assert = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const offerResolver = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation-engine-offer.cjs'));
const orchestrator = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-reach-orchestrator.cjs'));
const presenter = require(path.join(REPO_ROOT, 'lib', 'hmi', 'dial-presenter.cjs'));

const { composeCommandRecommendationReach, BRAIN_CONSULT_REACH_ID } = offerResolver;
const { buildReachList, DIAL_REACH_K } = orchestrator;
const { renderDial, MARKER_RECOMMENDED, OFFERED_K } = presenter;

let pass = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log('  ok - ' + name);
  pass += 1;
}

// A roomState where NO reach clears the frozen 0.70 gate on its own -- proves
// the command-recommendation composition (not the pre-existing frozen gate) is
// what puts the marker on the row.
function subFloorRoomState() {
  return {
    tierMode: 'mode_a',
    reachScores: {
      context_block: 0.44,
      contradiction: 0.41,
      cross_room: 0.38,
      brain_consult: 0.30,
      deep_research: 0.20,
      hats: 0.10,
    },
  };
}

const FIXTURE_RECOMMENDATION = {
  command_slug: '/mos:causal',
  hitl_shape: 'confirm',
  confidence: 0.86,
};

function fixtureTrace(recommendation) {
  return { projection_offer: { options: [], command_recommendation: recommendation } };
}

const FULL_SLOTS = Object.freeze({
  topic: 'pricing',
  topic_a: 'pricing',
  topic_b: 'CAC',
  room_name: 'synteris',
  framework: 'SWOT',
});

// =====================================================================
// composeCommandRecommendationReach -- composition correctness.
// =====================================================================
(function () {
  const reachList = buildReachList(subFloorRoomState());
  const before = reachList.reaches.filter(function (r) { return r.recommended; }).length;
  ok('precondition: sub-floor roomState yields zero pre-existing markers', before === 0);

  const composed = composeCommandRecommendationReach(reachList, fixtureTrace(FIXTURE_RECOMMENDATION));

  ok('composeCommandRecommendationReach: mints NO new reach id (still 6 reaches)',
    composed.reaches.length === reachList.reaches.length);
  ok('composeCommandRecommendationReach: DIAL_REACH_K stays 6 (frozen)', DIAL_REACH_K === 6);

  const brainConsult = composed.reaches.find(function (r) { return r.reach_id === BRAIN_CONSULT_REACH_ID; });
  ok('composeCommandRecommendationReach: brain_consult row is present', !!brainConsult);
  ok('composeCommandRecommendationReach: brain_consult.score === confidence',
    brainConsult.score === FIXTURE_RECOMMENDATION.confidence);
  ok('composeCommandRecommendationReach: brain_consult.recommended === true',
    brainConsult.recommended === true);
  ok('composeCommandRecommendationReach: brain_consult.command_slug carries the D-03 slug',
    brainConsult.command_slug === FIXTURE_RECOMMENDATION.command_slug);
  ok('composeCommandRecommendationReach: brain_consult.hitl_shape carries the D-03a enum',
    brainConsult.hitl_shape === FIXTURE_RECOMMENDATION.hitl_shape);

  const recommendedCount = composed.reaches.filter(function (r) { return r.recommended; }).length;
  ok('composeCommandRecommendationReach: exactly ONE recommended reach this turn (R8)', recommendedCount === 1);

  ok('composeCommandRecommendationReach: reaches re-sorted desc by score (recommended row leads)',
    composed.reaches[0].reach_id === BRAIN_CONSULT_REACH_ID);

  // Purity: the caller's original reachList object is never mutated.
  ok('composeCommandRecommendationReach: pure (input reachList reaches untouched)',
    reachList.reaches.find(function (r) { return r.reach_id === BRAIN_CONSULT_REACH_ID; }).recommended === false);
})();

// =====================================================================
// composeCommandRecommendationReach -- graceful degrade (R7).
// =====================================================================
(function () {
  const reachList = buildReachList(subFloorRoomState());

  const noOffer = composeCommandRecommendationReach(reachList, {});
  ok('graceful degrade: absent trace.projection_offer returns the reachList unchanged',
    JSON.stringify(noOffer) === JSON.stringify(reachList));

  const nullRec = composeCommandRecommendationReach(reachList, { projection_offer: { command_recommendation: null } });
  ok('graceful degrade: null command_recommendation returns the reachList unchanged',
    JSON.stringify(nullRec) === JSON.stringify(reachList));

  const malformed = composeCommandRecommendationReach(reachList, {
    projection_offer: { command_recommendation: { command_slug: '', confidence: 0.9 } },
  });
  ok('graceful degrade: an empty command_slug returns the reachList unchanged',
    JSON.stringify(malformed) === JSON.stringify(reachList));

  const badInput = composeCommandRecommendationReach(null, fixtureTrace(FIXTURE_RECOMMENDATION));
  ok('graceful degrade: a null reachList degrades to null (never throws, R7)', badInput === null);

  const noBrainConsult = composeCommandRecommendationReach(
    { reaches: [{ reach_id: 'context_block', score: 0.5, recommended: false }] },
    fixtureTrace(FIXTURE_RECOMMENDATION)
  );
  ok('graceful degrade: a reachList with no brain_consult member returns unchanged',
    noBrainConsult.reaches.length === 1 && noBrainConsult.reaches[0].recommended === false);
})();

// =====================================================================
// Render path -- the composed reach surfaces on the EXISTING live F.7 dial.
// =====================================================================
(function () {
  const reachList = buildReachList(subFloorRoomState());
  const composed = composeCommandRecommendationReach(reachList, fixtureTrace(FIXTURE_RECOMMENDATION));

  const rendered = renderDial(composed, { slotContext: FULL_SLOTS });

  ok('render: the command_slug appears verbatim in the rendered dial text',
    rendered.text.indexOf(FIXTURE_RECOMMENDATION.command_slug) !== -1);
  ok('render: the recommended glyph marker is present exactly once',
    rendered.rows.filter(function (r) { return r.recommended; }).length === 1);
  ok('render: the filled-triangle marker renders in the body',
    rendered.body.indexOf(MARKER_RECOMMENDED) !== -1);
  ok('render: the confidence cell reflects the D-03 confidence (86%)',
    rendered.text.indexOf('86%') !== -1);
  ok('render: the row count never exceeds OFFERED_K (the MAX_K=3 chooser clamp)',
    rendered.rows.length <= OFFERED_K);
  ok('render: the recommended row is the FIRST offered row (re-sort landed it top)',
    rendered.rows[0].recommended === true);
})();

// =====================================================================
// Render path -- graceful degrade: absent command_recommendation renders the
// pre-191 dial unchanged (byte-identical render).
// =====================================================================
(function () {
  const reachList = buildReachList(subFloorRoomState());
  const composed = composeCommandRecommendationReach(reachList, {}); // no recommendation

  const preRendered = renderDial(reachList, { slotContext: FULL_SLOTS });
  const postRendered = renderDial(composed, { slotContext: FULL_SLOTS });

  ok('render graceful degrade: absent recommendation renders the pre-191 dial byte-identical',
    preRendered.text === postRendered.text);
  ok('render graceful degrade: no command_slug leaks into the render',
    postRendered.text.indexOf(FIXTURE_RECOMMENDATION.command_slug) === -1);
})();

console.log('');
console.log('PASS ' + pass + ' assertions');
console.log('>>> dial-command-recommendation-191.test.cjs: PASSED');
process.exit(0);
